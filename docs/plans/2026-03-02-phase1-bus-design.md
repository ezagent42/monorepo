# Phase 1 Bus Implementation Design

> **日期**: 2026-03-02
> **范围**: Engine (4 组件) + Backend Persistence + Built-in (4 Datatypes) + Operations
> **方法**: Bottom-Up (Engine framework → Persistence → Datatypes → API)
> **测试**: ~120 test cases, Rust-only (Python bindings deferred to Phase 2.5)

---

## 1. Crate Structure

```
ezagent/crates/
├── ezagent-protocol/     # [existing] Protocol types
├── ezagent-backend/      # [existing + enhanced] Backend traits + impls
│   └── src/
│       ├── traits.rs         # CrdtBackend, NetworkBackend (existing)
│       ├── yrs_backend.rs    # In-memory YrsBackend (existing)
│       ├── zenoh_backend.rs  # ZenohBackend (existing)
│       └── persistence.rs    # [NEW] RocksDB-backed persistent backend
├── ezagent-engine/       # [NEW] Core Engine
│   └── src/
│       ├── lib.rs
│       ├── engine.rs
│       ├── registry/
│       │   ├── mod.rs          # DatatypeRegistry
│       │   ├── datatype.rs     # DatatypeDeclaration, StorageType, WriterRule
│       │   └── dependency.rs   # Topological sort, cycle detection
│       ├── hooks/
│       │   ├── mod.rs          # HookPipeline
│       │   ├── phase.rs        # HookPhase, HookDeclaration
│       │   └── executor.rs     # Priority-sorted execution
│       ├── annotation.rs       # Annotation key validation
│       ├── index/
│       │   ├── mod.rs          # IndexBuilder
│       │   └── refresh.rs      # on_change / on_demand / periodic
│       ├── builtins/
│       │   ├── mod.rs          # Built-in registration
│       │   ├── identity.rs     # Identity datatype + hooks
│       │   ├── room.rs         # Room datatype + hooks + config schema
│       │   ├── timeline.rs     # Timeline datatype + hooks + sharding
│       │   └── message.rs      # Message datatype + hooks + content hash
│       ├── operations.rs       # Operation definitions + dispatch
│       └── events.rs           # Event types + Event Stream
└── ezagent-py/           # [existing] PyO3 bridge (Phase 2.5)
```

### Dependency graph

```
ezagent-engine → ezagent-protocol + ezagent-backend
ezagent-backend → ezagent-protocol + yrs + zenoh + rocksdb
ezagent-protocol → (no internal deps)
```

---

## 2. Engine Core — Datatype Registry

### Types

```rust
pub enum StorageType { CrdtMap, CrdtArray, CrdtText, Blob, Ephemeral }
pub enum SyncMode { Eager, Batched { batch_ms: u64 }, Lazy }

pub struct DataEntry {
    pub id: String,
    pub storage_type: StorageType,
    pub key_pattern: KeyPattern,
    pub persistent: bool,
    pub writer_rule: WriterRule,
    pub sync_strategy: SyncMode,
}

pub struct DatatypeDeclaration {
    pub id: String,
    pub version: String,
    pub dependencies: Vec<String>,
    pub data_entries: Vec<DataEntry>,
    pub hooks: HookSet,
    pub indexes: Vec<IndexDeclaration>,
}
```

### Dependency Resolution

- Algorithm: Kahn's topological sort
- Cycle detection → `ProtocolError::CircularDependency { cycle: Vec<String> }`
- Deterministic tie-breaking: alphabetical by datatype id
- Built-in datatypes always loaded (identity, room, timeline, message)
- Extension datatypes filtered by room's `enabled_extensions`
- Missing extension dependency → `DependencyNotMet { ext, requires }`

### Test coverage: TC-1-ENGINE-001 ~ TC-1-ENGINE-006

---

## 3. Engine Core — Hook Pipeline

### Types

```rust
pub enum HookPhase { PreSend, AfterWrite, AfterRead }
pub enum TriggerEvent { Insert, Update, Delete, Any }

pub struct HookDeclaration {
    pub id: String,
    pub phase: HookPhase,
    pub trigger_datatype: String,  // "*" for global
    pub trigger_event: TriggerEvent,
    pub trigger_filter: Option<String>,
    pub priority: u32,
    pub source: String,
}

pub enum HookAction { Continue(HookContext), Reject(String) }
pub trait HookHandler: Send + Sync {
    fn execute(&self, ctx: &mut HookContext) -> Result<HookAction, HookError>;
}
```

### Execution order

1. Sort by `priority` ascending (0 = highest)
2. Same priority → sort by dependency topology of `source` datatype
3. Same priority + no dependency → alphabetical by `source` id
4. **Special:** `identity.sign_envelope` (pre_send, p=0) runs **last** in pre_send
5. **Special:** `identity.verify_signature` (after_write, p=0) runs **first** in after_write

### Failure semantics

| Phase | On Error |
|-------|----------|
| pre_send | Abort entire write, CRDT untouched, chain stops |
| after_write | CRDT already applied, log error, chain **continues** |
| after_read | Return unenhanced raw data, no error to caller |

### Global hook restriction

Only Built-in datatypes may register `trigger_datatype: "*"`. Extensions attempting
this → `ExtensionCannotRegisterGlobalHook`.

### Test coverage: TC-1-HOOK-001 ~ TC-1-HOOK-011

---

## 4. Engine Core — Annotation & Index

### Annotation

Annotation is a design pattern, not a separate store. Key rules:

- `ext.{ext_id}` namespace within ref crdt_map or room_config crdt_map
- Key format: `{semantic}:{entity_id}` (e.g. `note:@bob:relay-a.example.com`)
- Writer can only modify keys containing their own entity_id
- Unknown `ext.*` fields MUST be preserved (CRDT default behavior)
- Annotations sync with their host document

### Index Builder

```rust
pub enum RefreshStrategy { OnChange, OnDemand, Periodic { interval_secs: u64 } }

pub struct IndexDeclaration {
    pub id: String,
    pub input: String,
    pub transform: String,
    pub refresh: RefreshStrategy,
    pub operation_id: Option<String>,
}
```

- `on_change`: Updated by after_write hooks, reflects within <1s
- `on_demand`: Computed from current CRDT state per request
- `periodic`: Rebuild on timer (not used by Built-in, reserved for extensions)
- `operation_id` links Index to an Engine Operation

### Test coverage: TC-1-ANNOT-001 ~ TC-1-ANNOT-005, TC-1-INDEX-001 ~ TC-1-INDEX-003

---

## 5. Built-in Datatypes

### 5.1 Identity

**Data entries:** `entity_keypair` (blob, `ezagent/@{entity_id}/identity/pubkey`)

**Hooks:**
- `sign_envelope` — pre_send, global, p=0 (runs last): wrap update in SignedEnvelope
- `verify_signature` — after_write, global, p=0 (runs first): verify Ed25519 sig + ±5min timestamp

**Key behaviors:**
- Entity ID format: `@{local_part}:{relay_domain}`, strict ABNF validation (lowercase only)
- Ed25519 keypair generation (32-byte privkey, 32-byte pubkey)
- Public key cache for P2P verification
- Registration flow: keypair gen → TLS to relay → register → persist locally

**Test coverage:** TC-1-IDENT-001 ~ TC-1-IDENT-008

### 5.2 Room

**Data entries:** `room_config` (crdt_map, `ezagent/{room_id}/config/{state|updates}`)

**Hooks:**
- `check_room_write` — pre_send, global, p=10: verify signer ∈ members
- `check_config_permission` — pre_send, room_config, p=20: verify power_level >= admin
- `extension_loader` — after_write, room_config, p=10: load/unload extensions
- `member_change_notify` — after_write, room_config, p=50: emit SSE events

**Room Config schema:**
- `room_id` (UUIDv7), `name`, `created_by`, `created_at`
- `membership.policy` (open/knock/invite), `membership.members` (Map<EntityId, Role>)
- `power_levels.default`, `power_levels.events_default`, `power_levels.admin`, `power_levels.users`
- `relays` (Array), `timeline.shard_max_refs` (default 10000)
- `enabled_extensions` (string[]), `ext.*` (preserved)

**Power levels:** owner=100, admin=50, member=0. Kick requires strict `>`.

**Test coverage:** TC-1-ROOM-001 ~ TC-1-ROOM-009

### 5.3 Timeline

**Data entries:** `timeline_index` (crdt_array, `ezagent/{room_id}/index/{shard_id}/{state|updates}`)

**Hooks:**
- `generate_ref` — pre_send, timeline_index insert, p=20: gen ULID, set status=active
- `ref_change_detect` — after_write, timeline_index, p=30: emit message.new/deleted SSE
- `timeline_pagination` — after_read, timeline_index, p=30: cursor-based pagination

**Ref schema:** ref_id (ULID), author, content_type, content_id, created_at, status, signature, ext.*

**Sharding:** UUIDv7 shard_id, new shard when refs >= shard_max_refs.
**Ordering:** YATA CRDT order, not timestamp-based.
**Deletion:** status → "deleted_by_author", ref stays in crdt_array.

**Test coverage:** TC-1-TL-001 ~ TC-1-TL-008

### 5.4 Message

**Data entries:** `immutable_content` (blob, `ezagent/{room_id}/content/{sha256_hash}`)

**Hooks:**
- `compute_content_hash` — pre_send, immutable_content insert, p=20: canonical JSON → SHA-256
- `validate_content_ref` — pre_send, timeline_index insert, p=25: verify hash + author match
- `resolve_content` — after_read, timeline_index, p=40: resolve content_id to body

**Content schema:** content_id, type="immutable", author, body, format, media_refs, created_at, signature

**Test coverage:** TC-1-MSG-001 ~ TC-1-MSG-005

---

## 6. Backend Persistence (RocksDB)

New `RocksDbBackend` implementing `CrdtBackend`:

| Column Family | Purpose |
|---------------|---------|
| `docs` | CRDT doc_id → yrs state bytes |
| `pending_updates` | doc_id → Vec<serialized update> |
| `blobs` | sha256_hash → binary content |
| `meta` | doc_id → metadata (update count, last snapshot time) |

**Behaviors:**
- Startup: load docs from disk → apply pending → initial sync for diff
- State snapshots: merge updates into single state every 100 updates
- Ephemeral data: in-memory only, not written to RocksDB
- Blob: content-addressed, write-once enforced (duplicate write is no-op)
- Pending updates persisted across restarts

**Test coverage:** TC-1-PERSIST-001 ~ TC-1-PERSIST-004

---

## 7. Sync Protocol Enhancements

Built on existing ZenohBackend:

- Initial sync via state vector query to `{key_pattern}/state`
- Live sync via pub/sub to `{key_pattern}/updates` with SignedEnvelope
- Multi-source query: select response with most complete state vector
- Peer registers as Zenoh queryable for held documents
- Causal ordering: same-sender updates delivered in order
- Disconnect recovery: persist pending → reconnect → initial sync → publish pending

**Test coverage:** TC-1-SYNC-001 ~ TC-1-SYNC-007

---

## 8. Operations & Event Stream

### Operations (Rust methods on Engine)

```
identity.init / identity.whoami / identity.get_pubkey
room.create / room.list / room.get / room.update_config
room.join / room.leave / room.invite / room.members
timeline.list / timeline.get_ref
message.send / message.delete
annotation.list / annotation.add / annotation.remove
events.stream / status
```

### Event Stream

- Backed by `tokio::broadcast` channel
- Event types: message.new, message.deleted, room.member.joined, room.member.left
- Cursor-based replay for disconnect recovery
- Room filtering supported

**Test coverage:** TC-1-API-001 ~ TC-1-API-005

---

## 9. Implementation Order (Bottom-Up)

| Step | Component | Depends On | TCs |
|------|-----------|------------|-----|
| 1 | Registry + Dependency Resolution | protocol types | ENGINE-001~006 |
| 2 | Hook Pipeline + Executor | Registry | HOOK-001~011 |
| 3 | Annotation + Index Builder | Pipeline | ANNOT-001~005, INDEX-001~003 |
| 4 | RocksDB Persistence | backend traits | PERSIST-001~004 |
| 5 | Sync Protocol Enhancements | backend + persistence | SYNC-001~007 |
| 6 | Identity Built-in | Engine core | IDENT-001~008, SIGN-001~004 |
| 7 | Room Built-in | Engine + Identity | ROOM-001~009 |
| 8 | Timeline Built-in | Engine + Room | TL-001~008 |
| 9 | Message Built-in | Engine + Timeline | MSG-001~005 |
| 10 | Operations + Events | All above | API-001~005 |

---

## 10. Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | Full Phase 1 at once | Holistic design, ordered work units |
| Persistence | RocksDB | Production-ready, spec-aligned |
| Python SDK | Deferred to Phase 2.5 | Focus on Rust core first |
| Crate layout | Single `ezagent-engine` | Cohesive, all Engine+Builtins together |
| Approach | Bottom-Up | Natural dependency flow |

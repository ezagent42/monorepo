# Phase 2: Extensions — Design Document

> **Date**: 2026-03-03
> **Author**: Allen & Claude collaborative design
> **Status**: Approved
> **Scope**: EXT-01 through EXT-17, Extension Loader, URI Path Registry

---

## 1. Overview

Phase 2 implements the full Extension layer (Layer 2) of the ezagent protocol. This includes:

- **Extension Plugin API** (`ezagent-ext-api`) — C ABI entry points + safe Rust wrapper
- **Extension Loader** — manifest.toml parsing, `dlopen`, runtime registration
- **URI Path Registry** — conflict detection and path resolution
- **17 Extension crates** — one per extension, each compiled to `.dylib`/`.so`
- **Extension interaction tests** and **URI registration tests**

## 2. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Loading model | Dynamic (`dlopen`) | Matches spec §4.7; enables third-party extensions |
| Code organization | One crate per extension | Clean separation; each `.dylib` is independently deployable |
| Plugin ABI | C ABI + Rust wrapper | Stable, proven; `extern "C"` entry points with safe Rust types |
| Implementation order | Dependency graph (topological) | Infrastructure first, then leaf extensions, then dependents |
| EXT-17 Runtime | In scope | Completes the full Extension layer before Phase 3 |

## 3. Extension Plugin API (`ezagent-ext-api`)

### 3.1 C ABI Entry Point

Every extension `.dylib` exports a single symbol:

```rust
/// C ABI entry point. Engine calls this after dlopen.
/// Returns 0 on success, non-zero on failure.
pub type ExtEntryFn = unsafe extern "C" fn(ctx: *mut ExtRegistrationContext) -> i32;

pub const ENTRY_SYMBOL: &str = "ezagent_ext_register";
```

### 3.2 Registration Context

`ExtRegistrationContext` is an opaque C struct wrapping the Engine's registration APIs:

```rust
#[repr(C)]
pub struct ExtRegistrationContext { /* opaque pointer to Rust internals */ }

impl ExtRegistrationContext {
    pub fn register_datatype(&mut self, decl: DatatypeDeclaration) -> Result<(), ExtError>;
    pub fn register_hook(&mut self, decl: HookDeclaration, handler: HookFn) -> Result<(), ExtError>;
}
```

### 3.3 Safe Rust Wrapper

Extension authors implement the `ExtensionPlugin` trait and use the export macro:

```rust
pub trait ExtensionPlugin {
    fn manifest() -> ExtensionManifest;
    fn register(ctx: &mut RegistrationContext) -> Result<(), ExtError>;
}

// In extension crate:
ezagent_ext_api::export_extension!(ReactionsExtension);
```

### 3.4 Manifest Types

```rust
pub struct ExtensionManifest {
    pub name: String,
    pub version: String,
    pub api_version: u32,
    pub datatype_ids: Vec<String>,
    pub hook_ids: Vec<String>,
    pub dependencies: Vec<String>,
    pub uri_paths: Vec<UriPathDeclaration>,
}

pub struct UriPathDeclaration {
    pub pattern: String,
    pub description: String,
}
```

### 3.5 Dependencies

- `ezagent-protocol` (shared types: `KeyPattern`, `EntityId`, etc.)
- Re-exports: `DatatypeDeclaration`, `HookDeclaration`, `HookContext`, `HookPhase`, `TriggerEvent`
- **No dependency on `ezagent-engine` internals**

## 4. Extension Loader (in `ezagent-engine`)

### 4.1 Loading Pipeline (bus-spec §4.7)

```
Engine::load_extensions(extensions_dir: &Path)
  1. Scan {dir}/*/manifest.toml → Vec<ExtensionManifest>
  2. Filter: skip if api_version incompatible (log WARNING)
  3. Build dependency graph → topological sort
     - Circular deps → all involved extensions fail to load
  4. For each extension in topo order:
     a. dlopen("{dir}/{name}/lib{name}.{so|dylib}")
     b. Resolve symbol "ezagent_ext_register"
     c. Call entry fn with RegistrationContext
     d. Validate: registered datatypes/hooks match manifest declarations
     e. Check URI path conflicts (Section 5)
     f. On failure: log error, mark as NOT_LOADED, continue
  5. Update Engine state: loaded_extensions map
```

### 4.2 Engine API Additions

```rust
impl Engine {
    pub fn load_extensions(&mut self, dir: &Path) -> Vec<ExtensionLoadError>;
    pub fn is_extension_loaded(&self, name: &str) -> bool;
    pub fn loaded_extensions(&self) -> Vec<String>;
}
```

### 4.3 Error Handling

- Single extension failure does NOT block Engine startup (SHOULD per spec)
- Failed extensions produce `EXTENSION_NOT_LOADED` errors when referenced
- Circular dependencies fail all involved extensions

### 4.4 New Error Variants

```rust
ExtensionNotLoaded(String),
ExtensionLoadFailed { name: String, reason: String },
UriPathConflict { pattern: String, ext_a: String, ext_b: String },
IncompatibleApiVersion { name: String, got: u32, expected: u32 },
```

### 4.5 New Dependencies

- `toml` — manifest.toml parsing
- `libloading` — cross-platform dlopen wrapper

## 5. URI Path Registry

### 5.1 Types

```rust
pub struct UriPathRegistry {
    entries: Vec<UriPathEntry>,
}

struct UriPathEntry {
    pattern: String,
    extension_id: String,
}
```

### 5.2 Conflict Detection

Two patterns conflict if they have the same number of segments and every corresponding segment either matches literally or both are placeholders (e.g., `{room_id}` vs `{room_id}`).

### 5.3 Engine Integration

```rust
impl Engine {
    pub fn uri_registry(&self) -> &UriPathRegistry;
    pub fn resolve_uri(&self, path: &str) -> Option<&str>;
}
```

### 5.4 Test Cases

- TC-2-URI-001: Conflict detection (same pattern from two extensions)
- TC-2-URI-002: Non-conflicting patterns register successfully
- TC-2-URI-003: Extension without `[uri]` section loads fine

## 6. Per-Extension Crate Structure

### 6.1 Template

```
ezagent/crates/ezagent-ext-{name}/
├── Cargo.toml          # crate-type = ["cdylib", "rlib"]
├── manifest.toml       # Extension manifest
└── src/
    ├── lib.rs          # ExtensionPlugin impl + export macro
    ├── datatype.rs     # DatatypeDeclaration (if extension declares one)
    └── hooks.rs        # Hook implementations
```

### 6.2 Complete Crate List

| Crate | Extension | Ext Dependencies | URI Paths |
|-------|-----------|-----------------|-----------|
| `ezagent-ext-mutable` | EXT-01 | message | — |
| `ezagent-ext-collab` | EXT-02 | mutable, room | — |
| `ezagent-ext-reactions` | EXT-03 | timeline | `/r/{room_id}/m/{ref_id}/reactions` |
| `ezagent-ext-reply-to` | EXT-04 | timeline | — |
| `ezagent-ext-cross-room` | EXT-05 | reply-to | — |
| `ezagent-ext-channels` | EXT-06 | timeline, room | `/r/{room_id}/c/{channel_name}` |
| `ezagent-ext-moderation` | EXT-07 | timeline, room | — |
| `ezagent-ext-receipts` | EXT-08 | timeline, room | — |
| `ezagent-ext-presence` | EXT-09 | room | — |
| `ezagent-ext-media` | EXT-10 | message | `/r/{room_id}/blob/{blob_id}` |
| `ezagent-ext-threads` | EXT-11 | reply-to | `/r/{room_id}/m/{ref_id}/thread` |
| `ezagent-ext-drafts` | EXT-12 | room | — |
| `ezagent-ext-profile` | EXT-13 | identity | `/@{entity_id}/profile` |
| `ezagent-ext-watch` | EXT-14 | timeline, reply-to | — |
| `ezagent-ext-command` | EXT-15 | timeline, room | — |
| `ezagent-ext-link-preview` | EXT-16 | message | — |
| `ezagent-ext-runtime` | EXT-17 | channels, reply-to, command | `/r/{room_id}/sw/{namespace}` |

## 7. Implementation Order

```
Phase 2.0 — Infrastructure
├── ezagent-ext-api crate
├── ExtensionLoader in ezagent-engine
├── UriPathRegistry in ezagent-engine
└── Workspace deps: toml, libloading

Phase 2.1 — Leaf extensions (depend only on built-ins)
├── EXT-03 Reactions, EXT-06 Channels, EXT-07 Moderation
├── EXT-08 Read Receipts, EXT-09 Presence, EXT-10 Media
├── EXT-12 Drafts, EXT-13 Profile, EXT-16 Link Preview

Phase 2.2 — First-level dependents
├── EXT-01 Mutable, EXT-04 Reply To, EXT-15 Command

Phase 2.3 — Second-level dependents
├── EXT-02 Collab, EXT-05 Cross-Room Ref
├── EXT-11 Threads, EXT-14 Watch

Phase 2.4 — Top-level
└── EXT-17 Runtime

Phase 2.5 — Integration
├── Extension interaction tests (TC-2-INTERACT-001 ~ 005)
└── URI path registration tests (TC-2-URI-001 ~ 003)
```

## 8. Test Strategy

- **Unit tests**: Each extension crate tests its own hooks and declarations
- **Integration tests**: `ezagent-engine/tests/` verifies dlopen loading, room activation, hook priority ordering, URI conflicts
- **Test case IDs**: `TC-2-EXT{NN}-{NNN}` per plan document
- **Fixtures**: Reuse entities/rooms from `docs/plan/fixtures.md`

### Gate Criteria

- All ~100 TC pass
- Complete Extension API coverage
- Spec traceability 100%
- No P0/P1 bugs

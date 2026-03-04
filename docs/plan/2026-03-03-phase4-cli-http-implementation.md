# Phase 4: CLI + HTTP API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build user-facing interfaces for the ezagent engine — a Rust CLI binary and a Python FastAPI HTTP server — covering 82 test cases across 3 levels.

**Architecture:** Hybrid Rust+Python. The Rust CLI (`ezagent`) links directly to the engine crates for offline-capable commands. The Python HTTP server (FastAPI) uses the PyO3 bindings for REST API + WebSocket. `ezagent start` spawns the Python server. Both share `~/.ezagent/data/` (RocksDB not opened concurrently).

**Tech Stack:**
- **Rust CLI:** clap (derive), tabled, serde_json, ezagent-engine, ezagent-backend, ezagent-protocol
- **Python HTTP:** FastAPI, uvicorn, ezagent-py (PyO3), websockets
- **Shared:** RocksDB (local persistence), Zenoh (P2P networking), tokio (async runtime)

**Spec references:** `docs/products/cli-spec.md`, `docs/products/http-spec.md`, `docs/plan/phase-4-cli-http.md`

---

## Level 1: CLI Core — 34 Test Cases (Rust)

### Task 1: Workspace Setup

**Files:**
- Modify: `ezagent/Cargo.toml` (workspace root)
- Create: `ezagent/crates/ezagent-cli/Cargo.toml`
- Create: `ezagent/crates/ezagent-cli/src/main.rs`

**Step 1: Add new workspace dependencies**

Add to `ezagent/Cargo.toml` `[workspace.dependencies]`:

```toml
clap = { version = "4", features = ["derive"] }
tabled = "0.17"
dirs = "6"
```

Add `"crates/ezagent-cli"` to `[workspace] members`.

**Step 2: Create the CLI crate**

Create `ezagent/crates/ezagent-cli/Cargo.toml`:

```toml
[package]
name = "ezagent-cli"
version.workspace = true
edition.workspace = true
license.workspace = true

[[bin]]
name = "ezagent"
path = "src/main.rs"

[dependencies]
clap = { workspace = true }
tabled = { workspace = true }
dirs = { workspace = true }
serde = { workspace = true }
serde_json = { workspace = true }
toml = { workspace = true }
tokio = { workspace = true }
ezagent-engine = { workspace = true }
ezagent-backend = { workspace = true }
ezagent-protocol = { workspace = true }
```

Create `ezagent/crates/ezagent-cli/src/main.rs`:

```rust
use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "ezagent", about = "EZAgent42 — Programmable Organization OS")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Initialize identity and register with a relay
    Init {
        #[arg(long)]
        relay: String,
        #[arg(long)]
        name: String,
        #[arg(long)]
        ca_cert: Option<String>,
        #[arg(long)]
        force: bool,
    },
}

fn main() {
    let cli = Cli::parse();
    match cli.command {
        Commands::Init { relay, name, .. } => {
            println!("TODO: init --relay {relay} --name {name}");
        }
    }
}
```

**Step 3: Verify it compiles**

Run: `/Users/h2oslabs/.cargo/bin/cargo build -p ezagent-cli --manifest-path ezagent/Cargo.toml`
Expected: Compiles successfully.

**Step 4: Commit**

```bash
git add ezagent/Cargo.toml ezagent/crates/ezagent-cli/
git commit -m "feat(ezagent): scaffold ezagent-cli crate with clap"
```

---

### Task 2: EngineStore — In-Memory State Management

The Engine currently has no internal state management. Operations like `room_list`, `room_get`, `message_send` need a store to track rooms, messages, and timeline entries.

**Files:**
- Create: `ezagent/crates/ezagent-engine/src/store.rs`
- Modify: `ezagent/crates/ezagent-engine/src/engine.rs`
- Modify: `ezagent/crates/ezagent-engine/src/lib.rs`

**Step 1: Write the failing test**

Add to `ezagent/crates/ezagent-engine/src/store.rs`:

```rust
//! In-memory store for Engine state (rooms, messages, timeline).
//!
//! This provides the backing storage that operations.rs methods use.
//! Future: swap in CrdtBackend (RocksDB + yrs) for persistence.

use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use crate::builtins::message::MessageContent;
use crate::builtins::room::RoomConfig;
use crate::builtins::timeline::TimelineRef;

/// In-memory store for engine state.
#[derive(Default)]
pub struct EngineStore {
    rooms: Arc<RwLock<HashMap<String, RoomConfig>>>,
    /// Messages keyed by (room_id, content_id).
    messages: Arc<RwLock<HashMap<String, Vec<MessageContent>>>>,
    /// Timeline refs keyed by room_id, ordered by creation time.
    timeline: Arc<RwLock<HashMap<String, Vec<TimelineRef>>>>,
    /// Annotations keyed by (room_id, ref_id), value is Vec<(key, value)>.
    annotations: Arc<RwLock<HashMap<(String, String), Vec<(String, String)>>>>,
}

impl EngineStore {
    pub fn new() -> Self {
        Self::default()
    }

    // -- Room operations --

    pub fn insert_room(&self, config: RoomConfig) {
        let mut rooms = self.rooms.write().expect("rooms lock");
        rooms.insert(config.room_id.clone(), config);
    }

    pub fn get_room(&self, room_id: &str) -> Option<RoomConfig> {
        let rooms = self.rooms.read().expect("rooms lock");
        rooms.get(room_id).cloned()
    }

    pub fn list_rooms(&self) -> Vec<RoomConfig> {
        let rooms = self.rooms.read().expect("rooms lock");
        rooms.values().cloned().collect()
    }

    pub fn update_room<F>(&self, room_id: &str, f: F) -> bool
    where
        F: FnOnce(&mut RoomConfig),
    {
        let mut rooms = self.rooms.write().expect("rooms lock");
        if let Some(config) = rooms.get_mut(room_id) {
            f(config);
            true
        } else {
            false
        }
    }

    // -- Message operations --

    pub fn insert_message(&self, room_id: &str, content: MessageContent) {
        let mut messages = self.messages.write().expect("messages lock");
        messages
            .entry(room_id.to_string())
            .or_default()
            .push(content);
    }

    pub fn list_messages(&self, room_id: &str, limit: usize, before: Option<&str>) -> Vec<MessageContent> {
        let messages = self.messages.read().expect("messages lock");
        let Some(room_msgs) = messages.get(room_id) else {
            return vec![];
        };

        let end_idx = if let Some(before_id) = before {
            room_msgs.iter().position(|m| m.content_id == before_id).unwrap_or(room_msgs.len())
        } else {
            room_msgs.len()
        };

        let start_idx = end_idx.saturating_sub(limit);
        room_msgs[start_idx..end_idx].to_vec()
    }

    // -- Timeline operations --

    pub fn insert_timeline_ref(&self, room_id: &str, tref: TimelineRef) {
        let mut timeline = self.timeline.write().expect("timeline lock");
        timeline
            .entry(room_id.to_string())
            .or_default()
            .push(tref);
    }

    pub fn get_timeline_ref(&self, room_id: &str, ref_id: &str) -> Option<TimelineRef> {
        let timeline = self.timeline.read().expect("timeline lock");
        timeline
            .get(room_id)?
            .iter()
            .find(|r| r.ref_id == ref_id)
            .cloned()
    }

    pub fn list_timeline_refs(&self, room_id: &str) -> Vec<TimelineRef> {
        let timeline = self.timeline.read().expect("timeline lock");
        timeline.get(room_id).cloned().unwrap_or_default()
    }

    // -- Annotation operations --

    pub fn add_annotation(&self, room_id: &str, ref_id: &str, key: &str, value: &str) {
        let mut annotations = self.annotations.write().expect("annotations lock");
        annotations
            .entry((room_id.to_string(), ref_id.to_string()))
            .or_default()
            .push((key.to_string(), value.to_string()));
    }

    pub fn list_annotations(&self, room_id: &str, ref_id: &str) -> Vec<(String, String)> {
        let annotations = self.annotations.read().expect("annotations lock");
        annotations
            .get(&(room_id.to_string(), ref_id.to_string()))
            .cloned()
            .unwrap_or_default()
    }

    pub fn remove_annotation(&self, room_id: &str, ref_id: &str, key: &str) -> bool {
        let mut annotations = self.annotations.write().expect("annotations lock");
        if let Some(anns) = annotations.get_mut(&(room_id.to_string(), ref_id.to_string())) {
            let before = anns.len();
            anns.retain(|(k, _)| k != key);
            anns.len() < before
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::builtins::room::{
        MembershipConfig, MembershipPolicy, PowerLevelConfig, Role, TimelineConfig,
    };
    use std::collections::HashMap;

    fn make_room(room_id: &str, name: &str) -> RoomConfig {
        let mut members = HashMap::new();
        members.insert("@alice:relay.example.com".to_string(), Role::Owner);
        RoomConfig {
            room_id: room_id.to_string(),
            name: name.to_string(),
            created_by: "@alice:relay.example.com".to_string(),
            created_at: "1709337600Z".to_string(),
            membership: MembershipConfig {
                policy: MembershipPolicy::Invite,
                members,
            },
            power_levels: PowerLevelConfig {
                default: 0,
                events_default: 0,
                admin: 50,
                users: HashMap::new(),
            },
            relays: vec![],
            timeline: TimelineConfig {
                shard_max_refs: 10000,
            },
            enabled_extensions: vec![],
            extra: HashMap::new(),
        }
    }

    #[test]
    fn store_room_crud() {
        let store = EngineStore::new();

        // Insert and retrieve.
        let room = make_room("room-001", "Alpha");
        store.insert_room(room);

        let got = store.get_room("room-001").expect("room should exist");
        assert_eq!(got.name, "Alpha");

        // List.
        let rooms = store.list_rooms();
        assert_eq!(rooms.len(), 1);

        // Not found.
        assert!(store.get_room("nonexistent").is_none());
    }

    #[test]
    fn store_room_update() {
        let store = EngineStore::new();
        store.insert_room(make_room("room-001", "Alpha"));

        let updated = store.update_room("room-001", |r| {
            r.name = "Alpha v2".to_string();
        });
        assert!(updated);

        let got = store.get_room("room-001").expect("room");
        assert_eq!(got.name, "Alpha v2");
    }

    #[test]
    fn store_message_crud() {
        let store = EngineStore::new();

        let msg = MessageContent {
            content_id: "hash-001".to_string(),
            content_type: "immutable".to_string(),
            author: "@alice:relay.example.com".to_string(),
            body: serde_json::json!("Hello"),
            format: "text/plain".to_string(),
            media_refs: vec![],
            created_at: "1709337600Z".to_string(),
            signature: None,
        };

        store.insert_message("room-001", msg);

        let msgs = store.list_messages("room-001", 20, None);
        assert_eq!(msgs.len(), 1);
        assert_eq!(msgs[0].content_id, "hash-001");

        // Empty room.
        let empty = store.list_messages("room-999", 20, None);
        assert!(empty.is_empty());
    }

    #[test]
    fn store_annotation_crud() {
        let store = EngineStore::new();

        store.add_annotation("room-001", "ref-001", "review:@alice:r.com", "approved");

        let anns = store.list_annotations("room-001", "ref-001");
        assert_eq!(anns.len(), 1);
        assert_eq!(anns[0].0, "review:@alice:r.com");

        let removed = store.remove_annotation("room-001", "ref-001", "review:@alice:r.com");
        assert!(removed);

        let anns = store.list_annotations("room-001", "ref-001");
        assert!(anns.is_empty());
    }
}
```

**Step 2: Register module and add store to Engine**

Add `pub mod store;` to `ezagent/crates/ezagent-engine/src/lib.rs`.

In `ezagent/crates/ezagent-engine/src/engine.rs`, add:

```rust
use crate::store::EngineStore;

pub struct Engine {
    // ... existing fields ...
    pub store: EngineStore,
}
```

Initialize `store: EngineStore::new()` in `Engine::new()`.

**Step 3: Run tests to verify**

Run: `/Users/h2oslabs/.cargo/bin/cargo test -p ezagent-engine --manifest-path ezagent/Cargo.toml`
Expected: All existing 525 tests + new store tests pass.

**Step 4: Commit**

```bash
git add ezagent/crates/ezagent-engine/src/store.rs ezagent/crates/ezagent-engine/src/engine.rs ezagent/crates/ezagent-engine/src/lib.rs
git commit -m "feat(ezagent): add EngineStore for in-memory state management"
```

---

### Task 3: Wire Engine Stubs to EngineStore

Replace all 12 stub operations in `operations.rs` with real implementations backed by `EngineStore`.

**Files:**
- Modify: `ezagent/crates/ezagent-engine/src/operations.rs`

**Step 1: Write failing tests for room operations**

Add to the existing `tests` module in `operations.rs`:

```rust
#[test]
fn tc_4_store_001_room_create_and_list() {
    let mut engine = Engine::new().expect("engine");
    let kp = Keypair::generate();
    let eid = EntityId::parse("@alice:relay.example.com").expect("eid");
    engine.identity_init(eid, kp).expect("init");

    // Create a room.
    let room = engine.room_create("Alpha").expect("create");
    let room_id = room.room_id.clone();

    // List should contain it.
    let rooms = engine.room_list().expect("list");
    assert_eq!(rooms.len(), 1);
    assert!(rooms.contains(&room_id));

    // Get should return it.
    let got = engine.room_get(&room_id).expect("get");
    assert_eq!(got["name"], "Alpha");
}

#[test]
fn tc_4_store_002_room_members_and_invite() {
    let mut engine = Engine::new().expect("engine");
    let kp = Keypair::generate();
    let eid = EntityId::parse("@alice:relay.example.com").expect("eid");
    engine.identity_init(eid, kp).expect("init");

    let room = engine.room_create("Alpha").expect("create");
    let room_id = room.room_id.clone();

    // Members should include creator.
    let members = engine.room_members(&room_id).expect("members");
    assert_eq!(members.len(), 1);
    assert!(members.contains(&"@alice:relay.example.com".to_string()));

    // Invite another member.
    engine.room_invite(&room_id, "@bob:relay.example.com").expect("invite");

    let members = engine.room_members(&room_id).expect("members");
    assert_eq!(members.len(), 2);
    assert!(members.contains(&"@bob:relay.example.com".to_string()));
}

#[test]
fn tc_4_store_003_message_send_and_list() {
    let mut engine = Engine::new().expect("engine");
    let kp = Keypair::generate();
    let eid = EntityId::parse("@alice:relay.example.com").expect("eid");
    engine.identity_init(eid, kp).expect("init");

    let room = engine.room_create("Alpha").expect("create");
    let room_id = room.room_id.clone();

    // Send a message.
    let content = engine
        .message_send(&room_id, serde_json::json!("Hello!"), "text/plain")
        .expect("send");

    // Timeline should have the ref.
    let refs = engine.timeline_list(&room_id).expect("timeline");
    assert_eq!(refs.len(), 1);

    // Get the ref.
    let tref = engine.timeline_get_ref(&room_id, &refs[0]).expect("get ref");
    assert_eq!(tref["content_id"], content.content_id);
}

#[test]
fn tc_4_store_004_room_not_found() {
    let engine = Engine::new().expect("engine");
    let result = engine.room_get("nonexistent");
    assert!(result.is_err());
}
```

**Step 2: Run tests to verify they fail**

Run: `/Users/h2oslabs/.cargo/bin/cargo test -p ezagent-engine tc_4_store --manifest-path ezagent/Cargo.toml`
Expected: FAIL (stubs return `NotImplemented`).

**Step 3: Implement the operations**

Replace the stub methods in `operations.rs`. Key implementations:

```rust
pub fn identity_get_pubkey(&self, entity_id: &str) -> Result<String, EngineError> {
    self.pubkey_cache
        .get(entity_id)
        .map(|pk| hex::encode(pk.as_bytes()))
        .ok_or_else(|| EngineError::DatatypeNotFound(format!("pubkey for {entity_id}")))
}

pub fn room_create(&self, name: &str) -> Result<RoomConfig, EngineError> {
    // ... existing code that builds RoomConfig ...
    // ADD: store the room
    self.store.insert_room(room.clone());
    Ok(room)
}

pub fn room_list(&self) -> Result<Vec<String>, EngineError> {
    Ok(self.store.list_rooms().iter().map(|r| r.room_id.clone()).collect())
}

pub fn room_get(&self, room_id: &str) -> Result<serde_json::Value, EngineError> {
    self.store
        .get_room(room_id)
        .map(|r| serde_json::to_value(r).expect("serialize RoomConfig"))
        .ok_or_else(|| EngineError::DatatypeNotFound(format!("room {room_id}")))
}

pub fn room_members(&self, room_id: &str) -> Result<Vec<String>, EngineError> {
    self.store
        .get_room(room_id)
        .map(|r| r.membership.members.keys().cloned().collect())
        .ok_or_else(|| EngineError::DatatypeNotFound(format!("room {room_id}")))
}

pub fn room_invite(&mut self, room_id: &str, entity_id: &str) -> Result<(), EngineError> {
    let found = self.store.update_room(room_id, |r| {
        r.membership
            .members
            .insert(entity_id.to_string(), crate::builtins::room::Role::Member);
    });
    if found {
        Ok(())
    } else {
        Err(EngineError::DatatypeNotFound(format!("room {room_id}")))
    }
}

pub fn room_join(&mut self, room_id: &str) -> Result<(), EngineError> {
    let entity_id = self
        .entity_id()
        .ok_or_else(|| EngineError::PermissionDenied("identity not initialized".into()))?
        .to_string();
    self.room_invite(room_id, &entity_id)
}

pub fn room_leave(&mut self, room_id: &str) -> Result<(), EngineError> {
    let entity_id = self
        .entity_id()
        .ok_or_else(|| EngineError::PermissionDenied("identity not initialized".into()))?
        .to_string();
    let found = self.store.update_room(room_id, |r| {
        r.membership.members.remove(&entity_id);
    });
    if found { Ok(()) } else { Err(EngineError::DatatypeNotFound(format!("room {room_id}"))) }
}

pub fn room_update_config(&mut self, room_id: &str, updates: serde_json::Value) -> Result<(), EngineError> {
    let found = self.store.update_room(room_id, |r| {
        if let Some(name) = updates.get("name").and_then(|v| v.as_str()) {
            r.name = name.to_string();
        }
    });
    if found { Ok(()) } else { Err(EngineError::DatatypeNotFound(format!("room {room_id}"))) }
}
```

For `message_send`, modify the existing implementation to also store the message and create a timeline ref:

```rust
pub fn message_send(&self, room_id: &str, body: serde_json::Value, format: &str) -> Result<MessageContent, EngineError> {
    // ... existing hook pipeline code ...

    // Store the message.
    self.store.insert_message(room_id, content.clone());

    // Create and store a timeline ref.
    let tref = TimelineRef {
        ref_id: ulid::Ulid::new().to_string(),
        author: entity_id.to_string(),
        content_type: "immutable".to_string(),
        content_id: content.content_id.clone(),
        created_at: content.created_at.clone(),
        status: RefStatus::Active,
        signature: None,
        ext: HashMap::new(),
    };
    self.store.insert_timeline_ref(room_id, tref);

    Ok(content)
}

pub fn timeline_list(&self, room_id: &str) -> Result<Vec<String>, EngineError> {
    Ok(self.store.list_timeline_refs(room_id).iter().map(|r| r.ref_id.clone()).collect())
}

pub fn timeline_get_ref(&self, room_id: &str, ref_id: &str) -> Result<serde_json::Value, EngineError> {
    self.store
        .get_timeline_ref(room_id, ref_id)
        .map(|r| serde_json::to_value(r).expect("serialize TimelineRef"))
        .ok_or_else(|| EngineError::DatatypeNotFound(format!("ref {ref_id}")))
}

pub fn message_delete(&mut self, room_id: &str, ref_id: &str) -> Result<(), EngineError> {
    // Soft-delete: mark the timeline ref as deleted.
    let timeline = self.store.list_timeline_refs(room_id);
    if timeline.iter().any(|r| r.ref_id == ref_id) {
        // For in-memory store, we'd need to update status. Simplified for now.
        Ok(())
    } else {
        Err(EngineError::DatatypeNotFound(format!("ref {ref_id}")))
    }
}

pub fn annotation_list(&self, room_id: &str, ref_id: &str) -> Result<Vec<String>, EngineError> {
    Ok(self.store.list_annotations(room_id, ref_id).iter().map(|(k, v)| format!("{k}={v}")).collect())
}

pub fn annotation_add(&mut self, room_id: &str, ref_id: &str, key: &str, value: &str) -> Result<(), EngineError> {
    self.store.add_annotation(room_id, ref_id, key, value);
    Ok(())
}

pub fn annotation_remove(&mut self, room_id: &str, ref_id: &str, key: &str) -> Result<(), EngineError> {
    if self.store.remove_annotation(room_id, ref_id, key) {
        Ok(())
    } else {
        Err(EngineError::DatatypeNotFound(format!("annotation {key}")))
    }
}
```

**Note:** `RoomConfig` needs `#[derive(Serialize)]` if not already. Check and add if needed.

**Step 4: Run tests to verify they pass**

Run: `/Users/h2oslabs/.cargo/bin/cargo test -p ezagent-engine --manifest-path ezagent/Cargo.toml`
Expected: All tests pass (existing 525 + new tc_4_store tests).

**Step 5: Commit**

```bash
git add ezagent/crates/ezagent-engine/src/operations.rs
git commit -m "feat(ezagent): wire engine stubs to EngineStore"
```

---

### Task 4: Config Module (~/.ezagent/ Management)

**Files:**
- Create: `ezagent/crates/ezagent-cli/src/config.rs`

**Step 1: Write the config module**

```rust
//! Config management for ~/.ezagent/ directory.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::fs;

#[derive(Debug, Serialize, Deserialize)]
pub struct AppConfig {
    pub identity: IdentityConfig,
    #[serde(default)]
    pub network: NetworkConfig,
    #[serde(default)]
    pub relay: Option<RelayConfig>,
    #[serde(default)]
    pub storage: StorageConfig,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IdentityConfig {
    pub keyfile: String,
    pub entity_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkConfig {
    #[serde(default = "default_listen_port")]
    pub listen_port: u16,
    #[serde(default = "default_true")]
    pub scouting: bool,
}

impl Default for NetworkConfig {
    fn default() -> Self {
        Self { listen_port: 7447, scouting: true }
    }
}

fn default_listen_port() -> u16 { 7447 }
fn default_true() -> bool { true }

#[derive(Debug, Serialize, Deserialize)]
pub struct RelayConfig {
    pub endpoint: String,
    #[serde(default)]
    pub ca_cert: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StorageConfig {
    #[serde(default = "default_data_dir")]
    pub data_dir: String,
}

impl Default for StorageConfig {
    fn default() -> Self {
        Self { data_dir: default_data_dir() }
    }
}

fn default_data_dir() -> String {
    ezagent_home().join("data").to_string_lossy().to_string()
}

/// Returns the ~/.ezagent/ directory path.
pub fn ezagent_home() -> PathBuf {
    dirs::home_dir()
        .expect("home directory must exist")
        .join(".ezagent")
}

/// Load config from ~/.ezagent/config.toml if it exists.
pub fn load_config() -> Result<Option<AppConfig>, String> {
    let config_path = ezagent_home().join("config.toml");
    if !config_path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("failed to read config: {e}"))?;
    let config: AppConfig = toml::from_str(&content)
        .map_err(|e| format!("failed to parse config: {e}"))?;
    Ok(Some(config))
}

/// Write config to ~/.ezagent/config.toml.
pub fn save_config(config: &AppConfig) -> Result<(), String> {
    let home = ezagent_home();
    fs::create_dir_all(&home)
        .map_err(|e| format!("failed to create ~/.ezagent/: {e}"))?;
    let content = toml::to_string_pretty(config)
        .map_err(|e| format!("failed to serialize config: {e}"))?;
    fs::write(home.join("config.toml"), content)
        .map_err(|e| format!("failed to write config: {e}"))?;
    Ok(())
}

/// Save keypair bytes to ~/.ezagent/identity.key.
pub fn save_keypair(bytes: &[u8; 32]) -> Result<PathBuf, String> {
    let home = ezagent_home();
    fs::create_dir_all(&home)
        .map_err(|e| format!("failed to create ~/.ezagent/: {e}"))?;
    let keyfile = home.join("identity.key");
    fs::write(&keyfile, bytes)
        .map_err(|e| format!("failed to write identity.key: {e}"))?;
    Ok(keyfile)
}

/// Load keypair bytes from ~/.ezagent/identity.key.
pub fn load_keypair() -> Result<[u8; 32], String> {
    let keyfile = ezagent_home().join("identity.key");
    let bytes = fs::read(&keyfile)
        .map_err(|e| format!("failed to read identity.key: {e}"))?;
    let arr: [u8; 32] = bytes
        .try_into()
        .map_err(|_| "identity.key must be exactly 32 bytes".to_string())?;
    Ok(arr)
}

/// Resolve a config value with priority: env > cli_arg > config_file > default.
pub fn resolve_port(cli_port: Option<u16>, config: &Option<AppConfig>) -> u16 {
    // 1. Environment variable
    if let Ok(val) = std::env::var("EZAGENT_PORT") {
        if let Ok(port) = val.parse::<u16>() {
            return port;
        }
    }
    // 2. CLI argument
    if let Some(port) = cli_port {
        return port;
    }
    // 3. Config file
    if let Some(cfg) = config {
        return cfg.network.listen_port;
    }
    // 4. Default
    8847
}
```

**Step 2: Verify it compiles**

Run: `/Users/h2oslabs/.cargo/bin/cargo build -p ezagent-cli --manifest-path ezagent/Cargo.toml`

**Step 3: Commit**

```bash
git add ezagent/crates/ezagent-cli/src/config.rs
git commit -m "feat(ezagent): add CLI config module for ~/.ezagent/ management"
```

---

### Task 5: CLI `init` Command (TC-4-CLI-001~003)

**Files:**
- Create: `ezagent/crates/ezagent-cli/src/commands/mod.rs`
- Create: `ezagent/crates/ezagent-cli/src/commands/init.rs`
- Modify: `ezagent/crates/ezagent-cli/src/main.rs`
- Test: `ezagent/crates/ezagent-cli/tests/cli_init.rs`

**Step 1: Write the integration test**

Create `ezagent/crates/ezagent-cli/tests/cli_init.rs`:

```rust
//! Integration tests for `ezagent init`.

use std::fs;
use std::process::Command;
use tempfile::TempDir;

fn ezagent_bin() -> String {
    // Build location for the ezagent binary.
    let mut path = std::env::current_dir().unwrap();
    // Navigate up to workspace root, then to target.
    while !path.join("Cargo.toml").exists() || !path.join("crates").exists() {
        path = path.parent().unwrap().to_path_buf();
    }
    path.join("target/debug/ezagent").to_string_lossy().to_string()
}

/// TC-4-CLI-001: ezagent init creates identity and config.
#[test]
#[ignore = "requires built binary — run: cargo build -p ezagent-cli"]
fn tc_4_cli_001_init_creates_identity() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path().join(".ezagent");

    let output = Command::new(ezagent_bin())
        .env("EZAGENT_HOME", tmp.path())
        .args(["init", "--relay", "relay-a.example.com", "--name", "alice"])
        .output()
        .expect("failed to run ezagent");

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("Identity created: @alice:relay-a.example.com"),
        "stdout: {stdout}");
    assert_eq!(output.status.code(), Some(0));

    // Verify files created.
    assert!(home.join("identity.key").exists(), "identity.key should exist");
    assert!(home.join("config.toml").exists(), "config.toml should exist");

    // Verify config content.
    let config = fs::read_to_string(home.join("config.toml")).unwrap();
    assert!(config.contains("@alice:relay-a.example.com"));
    assert!(config.contains("relay-a.example.com"));
}

/// TC-4-CLI-003: ezagent init rejects duplicate registration.
#[test]
#[ignore = "requires built binary — run: cargo build -p ezagent-cli"]
fn tc_4_cli_003_init_duplicate_rejected() {
    let tmp = TempDir::new().unwrap();

    // First init.
    Command::new(ezagent_bin())
        .env("EZAGENT_HOME", tmp.path())
        .args(["init", "--relay", "relay-a.example.com", "--name", "alice"])
        .output()
        .expect("first init");

    // Second init without --force.
    let output = Command::new(ezagent_bin())
        .env("EZAGENT_HOME", tmp.path())
        .args(["init", "--relay", "relay-a.example.com", "--name", "bob"])
        .output()
        .expect("second init");

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(stderr.contains("Identity already exists"),
        "stderr: {stderr}");
    assert_eq!(output.status.code(), Some(1));
}
```

**Step 2: Implement the init command**

Create `ezagent/crates/ezagent-cli/src/commands/init.rs`:

```rust
use crate::config::{self, AppConfig, IdentityConfig, RelayConfig};
use ezagent_protocol::{EntityId, Keypair};

pub fn run(relay: &str, name: &str, ca_cert: Option<&str>, force: bool) -> i32 {
    // Check for existing identity.
    let home = config::ezagent_home();
    if home.join("config.toml").exists() && !force {
        eprintln!("Identity already exists. Use --force to overwrite.");
        return 1;
    }

    // Parse entity ID.
    let entity_id_str = format!("@{name}:{relay}");
    let entity_id = match EntityId::parse(&entity_id_str) {
        Ok(eid) => eid,
        Err(e) => {
            eprintln!("Invalid identity: {e}");
            return 2;
        }
    };

    // Generate keypair.
    let keypair = Keypair::generate();

    // Save keypair.
    if let Err(e) = config::save_keypair(&keypair.to_bytes()) {
        eprintln!("{e}");
        return 1;
    }

    // Build relay endpoint.
    let endpoint = format!("tls/{relay}:7448");

    // Save config.
    let app_config = AppConfig {
        identity: IdentityConfig {
            keyfile: home.join("identity.key").to_string_lossy().to_string(),
            entity_id: entity_id.to_string(),
        },
        network: Default::default(),
        relay: Some(RelayConfig {
            endpoint,
            ca_cert: ca_cert.unwrap_or("").to_string(),
        }),
        storage: Default::default(),
    };

    if let Err(e) = config::save_config(&app_config) {
        eprintln!("{e}");
        return 1;
    }

    // TODO: Register with relay (requires network connection).
    // For now, local-only identity creation.

    println!("Identity created: {entity_id}");
    0
}
```

Update `main.rs` to route to the command.

**Step 3: Run tests**

Run: `/Users/h2oslabs/.cargo/bin/cargo build -p ezagent-cli --manifest-path ezagent/Cargo.toml && /Users/h2oslabs/.cargo/bin/cargo test -p ezagent-cli --manifest-path ezagent/Cargo.toml -- --ignored`
Expected: TC-4-CLI-001, TC-4-CLI-003 pass.

**Step 4: Commit**

```bash
git add ezagent/crates/ezagent-cli/
git commit -m "feat(ezagent): implement ezagent init command (TC-4-CLI-001~003)"
```

---

### Task 6: CLI `identity whoami` (TC-4-CLI-004~005)

**Files:**
- Create: `ezagent/crates/ezagent-cli/src/commands/identity.rs`
- Modify: `ezagent/crates/ezagent-cli/src/main.rs`

**Step 1: Write failing test**

Add to integration test file:

```rust
/// TC-4-CLI-004: ezagent identity whoami shows identity info.
#[test]
#[ignore = "requires built binary"]
fn tc_4_cli_004_identity_whoami() {
    let tmp = TempDir::new().unwrap();

    // Init first.
    Command::new(ezagent_bin())
        .env("EZAGENT_HOME", tmp.path())
        .args(["init", "--relay", "relay-a.example.com", "--name", "alice"])
        .output()
        .expect("init");

    let output = Command::new(ezagent_bin())
        .env("EZAGENT_HOME", tmp.path())
        .args(["identity", "whoami"])
        .output()
        .expect("whoami");

    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(stdout.contains("@alice:relay-a.example.com"), "stdout: {stdout}");
    assert!(stdout.contains("relay-a.example.com"), "stdout: {stdout}");
    assert_eq!(output.status.code(), Some(0));
}

/// TC-4-CLI-005: ezagent identity whoami fails when not initialized.
#[test]
#[ignore = "requires built binary"]
fn tc_4_cli_005_identity_whoami_not_initialized() {
    let tmp = TempDir::new().unwrap();

    let output = Command::new(ezagent_bin())
        .env("EZAGENT_HOME", tmp.path())
        .args(["identity", "whoami"])
        .output()
        .expect("whoami");

    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(stderr.contains("Not initialized"), "stderr: {stderr}");
    assert_eq!(output.status.code(), Some(1));
}
```

**Step 2: Implement identity whoami**

```rust
// commands/identity.rs
use crate::config;

pub fn whoami() -> i32 {
    let config = match config::load_config() {
        Ok(Some(cfg)) => cfg,
        Ok(None) => {
            eprintln!("Not initialized. Run 'ezagent init' first.");
            return 1;
        }
        Err(e) => {
            eprintln!("{e}");
            return 1;
        }
    };

    // Load keypair for pubkey fingerprint.
    let pubkey_fp = match config::load_keypair() {
        Ok(bytes) => {
            let kp = ezagent_protocol::Keypair::from_bytes(&bytes);
            hex::encode(&kp.public_key().as_bytes()[..8])
        }
        Err(_) => "unknown".to_string(),
    };

    let relay = config.relay
        .as_ref()
        .map(|r| r.endpoint.clone())
        .unwrap_or_else(|| "none".to_string());

    println!("Entity ID:  {}", config.identity.entity_id);
    println!("Relay:      {relay}");
    println!("Public Key: {pubkey_fp}");
    0
}
```

**Note:** Add `hex = "0.4"` to workspace dependencies for pubkey fingerprint display.

**Step 3: Run tests, verify pass, commit**

---

### Task 7: CLI `rooms` / `room create/show/invite` (TC-4-CLI-010~016)

**Files:**
- Create: `ezagent/crates/ezagent-cli/src/commands/room.rs`
- Create: `ezagent/crates/ezagent-cli/src/output.rs` (table/json/quiet formatter)

**Implementation approach:**

1. Create an `OutputFormat` enum with `Table`, `Json`, `Quiet` variants
2. Implement `room create`, `rooms` (list), `room show`, `room invite` commands
3. Each command: loads config → creates Engine → loads state → executes → outputs
4. For `rooms` list: support `--json` and `--quiet` flags (TC-4-CLI-011~013)
5. `room show` displays config + member list (TC-4-CLI-014)
6. `room invite` adds a member (TC-4-CLI-015)
7. `room show` with nonexistent ID returns error (TC-4-CLI-016)

**Key code for output formatting:**

```rust
// output.rs
pub enum OutputFormat { Table, Json, Quiet }

impl OutputFormat {
    pub fn from_flags(json: bool, quiet: bool) -> Self {
        if json { Self::Json } else if quiet { Self::Quiet } else { Self::Table }
    }
}
```

For table output, use `tabled` crate. For JSON, use `serde_json::to_string_pretty`. For quiet, just print IDs one per line.

**Note on state persistence:** CLI commands that modify state (room create, invite) need to persist the EngineStore. For L1, we use a simple JSON file `~/.ezagent/data/state.json` that serializes the EngineStore. Future: replace with RocksDB.

---

### Task 8: CLI `send` / `messages` (TC-4-CLI-020~024)

**Files:**
- Create: `ezagent/crates/ezagent-cli/src/commands/message.rs`

**Implementation:**

1. `ezagent send <room_id> --body "text"` — calls `engine.message_send()`, outputs ref_id
2. `ezagent messages <room_id>` — calls `engine.timeline_list()` + `engine.timeline_get_ref()`, outputs table
3. `--limit` and `--before` for pagination (TC-4-CLI-023~024)
4. Non-member rejection (TC-4-CLI-021) — exit code 5

---

### Task 9: CLI `events` (TC-4-CLI-030~032)

**Files:**
- Create: `ezagent/crates/ezagent-cli/src/commands/events.rs`

**Implementation:**

1. Create a tokio runtime
2. Subscribe to `EventStream`
3. Loop: receive events, format, print to stdout
4. `--room` flag filters by room_id (TC-4-CLI-031)
5. `--json` outputs JSON Lines format (TC-4-CLI-032)
6. Ctrl+C exits cleanly

```rust
pub async fn run(room_filter: Option<&str>, json: bool, event_stream: &EventStream) -> i32 {
    let mut rx = event_stream.subscribe();
    loop {
        match rx.recv().await {
            Ok(event) => {
                if let Some(room) = room_filter {
                    // Filter by room_id.
                    // ... check event's room_id field ...
                }
                if json {
                    println!("{}", serde_json::to_string(&event).unwrap());
                } else {
                    // Human-readable format.
                    // [10:05:00] message.new  R-alpha  @bob:relay-a  "Review complete"
                }
            }
            Err(broadcast::error::RecvError::Closed) => break,
            Err(broadcast::error::RecvError::Lagged(_)) => continue,
        }
    }
    0
}
```

---

### Task 10: CLI `status` (TC-4-CLI-040~041)

**Files:**
- Create: `ezagent/crates/ezagent-cli/src/commands/status.rs`

**Implementation:** Load config, create engine, display entity ID, relay connection status, room count.

---

### Task 11: CLI `start` (TC-4-CLI-042~043)

**Files:**
- Create: `ezagent/crates/ezagent-cli/src/commands/start.rs`

**Implementation:** This spawns the Python FastAPI server. For L1, create a minimal stub that confirms the command works:

```rust
pub fn run(port: u16, no_ui: bool) -> i32 {
    println!("Server running at http://localhost:{port}");
    // TODO L2: spawn Python FastAPI server
    // For now, block until Ctrl+C.
    std::thread::park();
    0
}
```

The actual HTTP server implementation is in Level 2.

---

### Task 12: Config Priority + Exit Codes (TC-4-CLI-050~054)

**Files:**
- Modify: `ezagent/crates/ezagent-cli/src/config.rs`
- Modify: `ezagent/crates/ezagent-cli/src/main.rs`

**Implementation:**

1. `resolve_port()` already implements env > arg > file priority
2. Extend to all configurable values (listen_port, scouting, etc.)
3. Map `EngineError` variants to exit codes in `main.rs`:

```rust
fn error_to_exit_code(err: &EngineError) -> i32 {
    match err {
        EngineError::PermissionDenied(_) => 5,
        EngineError::NotAMember { .. } => 5,
        EngineError::SignatureVerificationFailed(_) => 4,
        EngineError::HookRejected(_) => 1,
        _ => 1,
    }
}
```

---

## Level 2: HTTP API — 37 Test Cases (Python)

### Task 13: Extend PyO3 Bindings

**Files:**
- Modify: `ezagent/crates/ezagent-py/src/lib.rs`
- Create: `ezagent/crates/ezagent-py/src/engine_bridge.rs`

**Implementation:**

Expose the full Engine operations API to Python:

```rust
#[pyclass]
struct PyEngine {
    inner: Engine,
}

#[pymethods]
impl PyEngine {
    #[new]
    fn new() -> PyResult<Self> { ... }

    fn identity_init(&mut self, entity_id: &str, keypair_bytes: &[u8]) -> PyResult<()> { ... }
    fn identity_whoami(&self) -> PyResult<String> { ... }
    fn room_create(&self, name: &str) -> PyResult<String> { ... }  // returns JSON
    fn room_list(&self) -> PyResult<Vec<String>> { ... }
    fn room_get(&self, room_id: &str) -> PyResult<String> { ... }  // returns JSON
    fn message_send(&self, room_id: &str, body: &str, format: &str) -> PyResult<String> { ... }
    fn timeline_list(&self, room_id: &str) -> PyResult<Vec<String>> { ... }
    // ... all operations ...
}
```

Build with: `cd ezagent && maturin develop -p ezagent-py`

---

### Task 14: Python FastAPI Server Scaffold

**Files:**
- Create: `ezagent/python/ezagent/server.py`
- Create: `ezagent/python/ezagent/__init__.py`
- Create: `ezagent/python/pyproject.toml`

**Implementation:**

```python
# python/ezagent/server.py
from fastapi import FastAPI, HTTPException
from ezagent._native import PyEngine

app = FastAPI(title="ezagent", version="0.1.0")
engine: PyEngine = None

@app.on_event("startup")
async def startup():
    global engine
    engine = PyEngine()
    # TODO: load config, init identity

@app.get("/api/status")
async def get_status():
    return {"status": "ok"}

@app.get("/api/identity")
async def get_identity():
    whoami = engine.identity_whoami()
    return {"entity_id": whoami}
```

---

### Task 15-22: HTTP Endpoints (Bus API + Extensions)

Each task implements a group of related endpoints following the route table in the design doc. TDD approach: write pytest test first, implement handler, verify.

**Test example (pytest):**

```python
# tests/test_http_rooms.py
from fastapi.testclient import TestClient
from ezagent.server import app

client = TestClient(app)

def test_tc_4_http_010_create_room():
    response = client.post("/api/rooms", json={"name": "new-room"})
    assert response.status_code == 201
    data = response.json()
    assert "room_id" in data
    assert data["name"] == "new-room"

def test_tc_4_http_011_list_rooms():
    response = client.get("/api/rooms")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
```

**Endpoint groups (one task each):**

| Task | Endpoints | TCs |
|------|-----------|-----|
| 15 | Identity: GET /api/identity, GET /api/identity/{id}/pubkey | 001-003 |
| 16 | Rooms: POST/GET /api/rooms, GET/PATCH /api/rooms/{id} | 010-013 |
| 17 | Room membership: invite/join/leave/members | 014-015 |
| 18 | Messages: POST/GET/DELETE /api/rooms/{id}/messages | 020-024 |
| 19 | Annotations: POST/GET/DELETE | 030-032 |
| 20 | Extensions: EXT-01~03 (mutable, reactions) | 040-042 |
| 21 | Extensions: EXT-06~12 (channels, moderation, receipts, presence, media, threads, drafts) | 043-051 |
| 22 | Extensions: EXT-13~14 (profile, watch) + Render Pipeline | 052-062 |

---

### Task 23: HTTP Error Handling (TC-4-HTTP-070~074)

**Implementation:** FastAPI exception handler that maps `EngineError` to HTTP status codes:

```python
@app.exception_handler(EngineException)
async def engine_error_handler(request, exc):
    status_map = {
        "INVALID_PARAMS": 400,
        "UNAUTHORIZED": 401,
        "NOT_A_MEMBER": 403,
        "ROOM_NOT_FOUND": 404,
        "ENTITY_EXISTS": 409,
    }
    return JSONResponse(
        status_code=status_map.get(exc.code, 500),
        content={"error": {"code": exc.code, "message": str(exc)}},
    )
```

---

## Level 3: WebSocket + URI — 16 Test Cases

### Task 24: Expose EventStream via PyO3

**Files:**
- Modify: `ezagent/crates/ezagent-py/src/engine_bridge.rs`

**Implementation:** Add `subscribe_events()` method that returns a Python async iterator backed by `EventStream::subscribe()`.

---

### Task 25: WebSocket Event Handler (TC-4-WS-001~006)

**Files:**
- Modify: `ezagent/python/ezagent/server.py`

**Implementation:**

```python
@app.websocket("/ws")
async def ws_events(websocket: WebSocket, room: str = None):
    await websocket.accept()
    async for event in engine.subscribe_events():
        event_data = json.loads(event)
        if room and event_data.get("room_id") != room:
            continue
        await websocket.send_json(event_data)
```

---

### Task 26: CLI `ezagent open` — URI Navigation (TC-4-CLI-URI-001~005)

**Files:**
- Create: `ezagent/crates/ezagent-cli/src/commands/open.rs`

**Implementation:**

1. Parse `ezagent://` URI scheme
2. Normalize authority (lowercase, strip trailing slash)
3. Route to Room display or Message display
4. Handle errors: INVALID_URI (exit 2), RESOURCE_NOT_FOUND (exit 3)

```rust
pub fn run(uri: &str) -> i32 {
    let parsed = match parse_ezagent_uri(uri) {
        Ok(u) => u,
        Err(e) => {
            eprintln!("INVALID_URI: {e}");
            return 2;
        }
    };

    match resolve_resource(&parsed) {
        Ok(resource) => {
            println!("{resource}");
            0
        }
        Err(_) => {
            eprintln!("RESOURCE_NOT_FOUND");
            3
        }
    }
}

fn parse_ezagent_uri(uri: &str) -> Result<ParsedUri, String> {
    let trimmed = uri.trim().trim_end_matches('/');
    if !trimmed.starts_with("ezagent://") {
        return Err("scheme must be 'ezagent'".to_string());
    }
    let rest = &trimmed["ezagent://".len()..];
    let (authority, path) = rest.split_once('/').unwrap_or((rest, ""));
    Ok(ParsedUri {
        authority: authority.to_lowercase(),
        path: format!("/{path}"),
    })
}
```

---

### Task 27: Final Integration + CLAUDE.md Update

**Files:**
- Modify: `ezagent/CLAUDE.md`

**Steps:**

1. Run full test suite: `cargo test --workspace` + `uv run pytest`
2. Verify all 82 TCs have corresponding tests
3. Update `ezagent/CLAUDE.md` with new crate documentation, HTTP endpoints, CLI commands
4. Commit

---

## Dependency Graph

```
Task 1 (workspace setup)
  └─→ Task 2 (EngineStore)
       └─→ Task 3 (wire stubs)
            ├─→ Tasks 4-12 (CLI commands) [sequential]
            └─→ Task 13 (PyO3 bindings)
                 └─→ Tasks 14-23 (Python HTTP) [sequential]
                      └─→ Tasks 24-26 (WebSocket + URI)
                           └─→ Task 27 (integration)
```

**Parallelizable:** After Task 3 completes, CLI tasks (4-12) and PyO3 extension (Task 13) can run in parallel.

---

## Test Strategy

### Rust Tests (CLI + Engine)

```bash
# All deterministic tests
/Users/h2oslabs/.cargo/bin/cargo test --workspace --manifest-path ezagent/Cargo.toml

# CLI integration tests (require built binary)
/Users/h2oslabs/.cargo/bin/cargo build -p ezagent-cli --manifest-path ezagent/Cargo.toml
/Users/h2oslabs/.cargo/bin/cargo test -p ezagent-cli --manifest-path ezagent/Cargo.toml -- --ignored
```

### Python Tests (HTTP)

```bash
cd ezagent
maturin develop -p ezagent-py
uv run pytest tests/
```

### Full Phase 4 Verification

All 82 test cases must pass. Test count by level:

| Level | TCs | Test file pattern |
|-------|-----|-------------------|
| L1 CLI | 34 | `ezagent-cli/tests/cli_*.rs` |
| L2 HTTP | 37 | `python/tests/test_http_*.py` |
| L3 WS+URI | 11+5 | `python/tests/test_ws_*.py` + `ezagent-cli/tests/cli_uri.rs` |

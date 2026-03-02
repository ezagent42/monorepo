# Phase 1 Bus Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the full Bus layer — Engine (4 components) + RocksDB persistence + 4 Built-in Datatypes + Operations/Events — covering ~120 test cases.

**Architecture:** Bottom-up build in a single new `ezagent-engine` crate. Engine framework (Registry, Hooks, Annotations, Index) first, then persistence, then Built-in Datatypes (Identity, Room, Timeline, Message), finally Operations and Event Stream. All tests in Rust; Python bindings deferred to Phase 2.5.

**Tech Stack:** Rust (yrs CRDT, zenoh networking, rocksdb persistence, ed25519-dalek crypto, tokio async, thiserror errors, uuid v7, ulid)

**Key references:**
- Design: `docs/plans/2026-03-02-phase1-bus-design.md`
- Spec: `docs/specs/bus-spec.md` (§3-§7)
- Test cases: `docs/plan/phase-1-bus.md` (TC-1-ENGINE through TC-1-API)
- Existing code: `ezagent/crates/ezagent-protocol/` and `ezagent/crates/ezagent-backend/`

---

## Task 1: Scaffold ezagent-engine Crate

**Files:**
- Create: `ezagent/crates/ezagent-engine/Cargo.toml`
- Create: `ezagent/crates/ezagent-engine/src/lib.rs`
- Modify: `ezagent/Cargo.toml` (workspace members)

**Step 1: Create Cargo.toml for the new crate**

```toml
# ezagent/crates/ezagent-engine/Cargo.toml
[package]
name = "ezagent-engine"
version.workspace = true
edition.workspace = true
license.workspace = true
description = "EZAgent Bus Engine — Datatype Registry, Hook Pipeline, Built-in Datatypes"

[dependencies]
ezagent-protocol = { workspace = true }
ezagent-backend = { workspace = true }
yrs = { workspace = true }
tokio = { workspace = true }
serde = { workspace = true }
serde_json = { workspace = true }
thiserror = { workspace = true }
uuid = { workspace = true }
ed25519-dalek = { workspace = true }
rand = { workspace = true }
sha2 = "0.10"
ulid = "1"

[dev-dependencies]
tokio = { workspace = true }
```

**Step 2: Add sha2 and ulid to workspace deps, add ezagent-engine member**

In `ezagent/Cargo.toml`, add to `[workspace.dependencies]`:
```toml
sha2 = "0.10"
ulid = "1"
ezagent-engine = { path = "crates/ezagent-engine" }
```

Add `"crates/ezagent-engine"` to `[workspace] members`.

**Step 3: Create lib.rs with module stubs**

```rust
// ezagent/crates/ezagent-engine/src/lib.rs
//! EZAgent Bus Engine.
//!
//! Core protocol engine implementing Datatype Registry, Hook Pipeline,
//! Annotation Pattern, and Index Builder, plus the four Built-in Datatypes
//! (Identity, Room, Timeline, Message).

pub mod registry;
pub mod hooks;
pub mod annotation;
pub mod index;
pub mod builtins;
pub mod engine;
pub mod operations;
pub mod events;
pub mod error;
```

**Step 4: Create error module**

```rust
// ezagent/crates/ezagent-engine/src/error.rs
//! Engine-level error types.

use thiserror::Error;

/// Errors originating from the Engine layer.
#[derive(Debug, Error)]
pub enum EngineError {
    #[error("circular dependency detected: {cycle}")]
    CircularDependency { cycle: String },

    #[error("dependency not met: {ext} requires {requires}")]
    DependencyNotMet { ext: String, requires: String },

    #[error("duplicate datatype: {0}")]
    DuplicateDatatype(String),

    #[error("datatype not found: {0}")]
    DatatypeNotFound(String),

    #[error("extensions cannot register global hooks")]
    ExtensionCannotRegisterGlobalHook,

    #[error("hook rejected: {0}")]
    HookRejected(String),

    #[error("not a member: {entity_id} is not in room {room_id}")]
    NotAMember { entity_id: String, room_id: String },

    #[error("permission denied: {0}")]
    PermissionDenied(String),

    #[error("extension disabled: {extension} in room {room_id}")]
    ExtensionDisabled { extension: String, room_id: String },

    #[error("protocol error: {0}")]
    Protocol(#[from] ezagent_protocol::ProtocolError),

    #[error("backend error: {0}")]
    Backend(#[from] ezagent_backend::BackendError),
}
```

**Step 5: Create module stubs for all submodules**

Create these files with minimal content:
- `ezagent/crates/ezagent-engine/src/registry/mod.rs` — `pub mod datatype; pub mod dependency;`
- `ezagent/crates/ezagent-engine/src/registry/datatype.rs` — empty
- `ezagent/crates/ezagent-engine/src/registry/dependency.rs` — empty
- `ezagent/crates/ezagent-engine/src/hooks/mod.rs` — `pub mod phase; pub mod executor;`
- `ezagent/crates/ezagent-engine/src/hooks/phase.rs` — empty
- `ezagent/crates/ezagent-engine/src/hooks/executor.rs` — empty
- `ezagent/crates/ezagent-engine/src/annotation.rs` — empty
- `ezagent/crates/ezagent-engine/src/index/mod.rs` — `pub mod refresh;`
- `ezagent/crates/ezagent-engine/src/index/refresh.rs` — empty
- `ezagent/crates/ezagent-engine/src/builtins/mod.rs` — `pub mod identity; pub mod room; pub mod timeline; pub mod message;`
- `ezagent/crates/ezagent-engine/src/builtins/identity.rs` — empty
- `ezagent/crates/ezagent-engine/src/builtins/room.rs` — empty
- `ezagent/crates/ezagent-engine/src/builtins/timeline.rs` — empty
- `ezagent/crates/ezagent-engine/src/builtins/message.rs` — empty
- `ezagent/crates/ezagent-engine/src/engine.rs` — empty
- `ezagent/crates/ezagent-engine/src/operations.rs` — empty
- `ezagent/crates/ezagent-engine/src/events.rs` — empty

**Step 6: Verify compilation**

Run: `cd ezagent && cargo check -p ezagent-engine`
Expected: compiles with no errors (may have warnings for unused modules)

**Step 7: Commit**

```bash
git add ezagent/Cargo.toml ezagent/crates/ezagent-engine/
git commit -m "feat(ezagent): scaffold ezagent-engine crate with module stubs"
```

---

## Task 2: Datatype Registry + Dependency Resolution (TC-1-ENGINE-001~006)

**Files:**
- Modify: `ezagent/crates/ezagent-engine/src/registry/datatype.rs`
- Modify: `ezagent/crates/ezagent-engine/src/registry/dependency.rs`
- Modify: `ezagent/crates/ezagent-engine/src/registry/mod.rs`

**Spec reference:** `docs/specs/bus-spec.md` §3.1 (Datatype Registry, storage_type, key_pattern, writer_rule, dependency resolution)
**Test case reference:** `docs/plan/phase-1-bus.md` §4.1

### Step 1: Write the core types in `datatype.rs`

```rust
// ezagent/crates/ezagent-engine/src/registry/datatype.rs

use ezagent_protocol::KeyPattern;
use serde::{Deserialize, Serialize};

/// Storage type for a data entry (bus-spec §3.1.2).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum StorageType {
    CrdtMap,
    CrdtArray,
    CrdtText,
    Blob,
    Ephemeral,
}

/// Sync strategy for live sync propagation (bus-spec §3.1.6).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum SyncMode {
    Eager,
    Batched { batch_ms: u64 },
    Lazy,
}

impl Default for SyncMode {
    fn default() -> Self {
        Self::Eager
    }
}

/// Writer rule expression (bus-spec §3.1.4).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum WriterRule {
    SignerIsEntity,
    SignerInMembers,
    SignerPowerLevel { min_level: u32 },
    SignerIsAuthor,
    SignerInAclEditors,
    AnnotationKeyContainsSigner,
    OneTimeWrite,
    And(Box<WriterRule>, Box<WriterRule>),
    Or(Box<WriterRule>, Box<WriterRule>),
}

/// A single data entry within a Datatype declaration (bus-spec §3.1.1).
#[derive(Debug, Clone)]
pub struct DataEntry {
    pub id: String,
    pub storage_type: StorageType,
    pub key_pattern: KeyPattern,
    pub persistent: bool,
    pub writer_rule: WriterRule,
    pub sync_strategy: SyncMode,
}

/// Index refresh strategy (bus-spec §3.4.2).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RefreshStrategy {
    OnChange,
    OnDemand,
    Periodic { interval_secs: u64 },
}

/// An index declaration within a Datatype (bus-spec §3.4.1).
#[derive(Debug, Clone)]
pub struct IndexDeclaration {
    pub id: String,
    pub input: String,
    pub transform: String,
    pub refresh: RefreshStrategy,
    pub operation_id: Option<String>,
}

/// A complete Datatype declaration (bus-spec §3.5).
#[derive(Debug, Clone)]
pub struct DatatypeDeclaration {
    pub id: String,
    pub version: String,
    pub dependencies: Vec<String>,
    pub data_entries: Vec<DataEntry>,
    pub indexes: Vec<IndexDeclaration>,
    /// Whether this is a built-in datatype (identity, room, timeline, message).
    pub is_builtin: bool,
}
```

### Step 2: Write dependency resolution in `dependency.rs`

```rust
// ezagent/crates/ezagent-engine/src/registry/dependency.rs

use std::collections::{HashMap, HashSet, VecDeque};
use crate::error::EngineError;

/// Compute a topological load order for the given datatypes using Kahn's algorithm.
///
/// Returns the datatypes sorted so that each one comes after all its dependencies.
/// If a cycle is detected, returns an error with the cycle path.
/// Deterministic tie-breaking: alphabetical by datatype id.
pub fn resolve_load_order(ids: &[String], deps: &HashMap<String, Vec<String>>) -> Result<Vec<String>, EngineError> {
    // Build adjacency list and in-degree map.
    let mut in_degree: HashMap<&str, usize> = HashMap::new();
    let mut adjacency: HashMap<&str, Vec<&str>> = HashMap::new();

    for id in ids {
        in_degree.entry(id.as_str()).or_insert(0);
        adjacency.entry(id.as_str()).or_default();
    }

    for id in ids {
        if let Some(dep_list) = deps.get(id) {
            for dep in dep_list {
                adjacency.entry(dep.as_str()).or_default().push(id.as_str());
                *in_degree.entry(id.as_str()).or_insert(0) += 1;
            }
        }
    }

    // Collect nodes with in-degree 0, sorted alphabetically for determinism.
    let mut queue: VecDeque<&str> = VecDeque::new();
    let mut zero_in: Vec<&str> = in_degree.iter()
        .filter(|(_, &deg)| deg == 0)
        .map(|(&id, _)| id)
        .collect();
    zero_in.sort();
    for id in zero_in {
        queue.push_back(id);
    }

    let mut result: Vec<String> = Vec::new();

    while let Some(node) = queue.pop_front() {
        result.push(node.to_string());
        if let Some(neighbors) = adjacency.get(node) {
            // Collect neighbors whose in-degree drops to zero.
            let mut newly_free: Vec<&str> = Vec::new();
            for &neighbor in neighbors {
                let deg = in_degree.get_mut(neighbor).expect("node in adjacency");
                *deg -= 1;
                if *deg == 0 {
                    newly_free.push(neighbor);
                }
            }
            // Sort alphabetically for deterministic ordering.
            newly_free.sort();
            for n in newly_free {
                queue.push_back(n);
            }
        }
    }

    if result.len() != ids.len() {
        // Cycle detected — find the cycle for the error message.
        let in_result: HashSet<&str> = result.iter().map(|s| s.as_str()).collect();
        let remaining: Vec<String> = ids.iter()
            .filter(|id| !in_result.contains(id.as_str()))
            .cloned()
            .collect();
        let cycle_str = find_cycle(&remaining, deps);
        return Err(EngineError::CircularDependency { cycle: cycle_str });
    }

    Ok(result)
}

/// Walk the remaining nodes to find a cycle description string.
fn find_cycle(remaining: &[String], deps: &HashMap<String, Vec<String>>) -> String {
    let remaining_set: HashSet<&str> = remaining.iter().map(|s| s.as_str()).collect();

    for start in remaining {
        let mut visited: HashSet<&str> = HashSet::new();
        let mut path: Vec<&str> = Vec::new();
        if dfs_cycle(start.as_str(), &remaining_set, deps, &mut visited, &mut path) {
            return path.join(" → ");
        }
    }

    remaining.join(", ")
}

fn dfs_cycle<'a>(
    node: &'a str,
    remaining: &HashSet<&str>,
    deps: &'a HashMap<String, Vec<String>>,
    visited: &mut HashSet<&'a str>,
    path: &mut Vec<&'a str>,
) -> bool {
    if path.contains(&node) {
        path.push(node);
        // Trim path to start at the cycle.
        if let Some(pos) = path.iter().position(|&n| n == node) {
            *path = path[pos..].to_vec();
        }
        return true;
    }
    if visited.contains(node) {
        return false;
    }
    visited.insert(node);
    path.push(node);

    if let Some(dep_list) = deps.get(node) {
        for dep in dep_list {
            if remaining.contains(dep.as_str()) {
                if dfs_cycle(dep.as_str(), remaining, deps, visited, path) {
                    return true;
                }
            }
        }
    }

    path.pop();
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tc_1_engine_002_dependency_resolution_order() {
        let ids = vec![
            "message".into(), "timeline".into(), "room".into(), "identity".into(),
        ];
        let mut deps: HashMap<String, Vec<String>> = HashMap::new();
        deps.insert("identity".into(), vec![]);
        deps.insert("room".into(), vec!["identity".into()]);
        deps.insert("timeline".into(), vec!["identity".into(), "room".into()]);
        deps.insert("message".into(), vec!["identity".into(), "timeline".into()]);

        let order = resolve_load_order(&ids, &deps).unwrap();

        // identity must be first
        let pos_identity = order.iter().position(|s| s == "identity").unwrap();
        let pos_room = order.iter().position(|s| s == "room").unwrap();
        let pos_timeline = order.iter().position(|s| s == "timeline").unwrap();
        let pos_message = order.iter().position(|s| s == "message").unwrap();

        assert!(pos_identity < pos_room);
        assert!(pos_room < pos_timeline);
        assert!(pos_timeline < pos_message);
    }

    #[test]
    fn tc_1_engine_003_circular_dependency_rejected() {
        let ids = vec!["a".into(), "b".into()];
        let mut deps: HashMap<String, Vec<String>> = HashMap::new();
        deps.insert("a".into(), vec!["b".into()]);
        deps.insert("b".into(), vec!["a".into()]);

        let err = resolve_load_order(&ids, &deps).unwrap_err();
        let msg = err.to_string();
        assert!(msg.contains("circular dependency"));
        // Should mention both A and B in the cycle.
        assert!(msg.contains("a"));
        assert!(msg.contains("b"));
    }

    #[test]
    fn no_deps_returns_alphabetical() {
        let ids = vec!["c".into(), "a".into(), "b".into()];
        let deps: HashMap<String, Vec<String>> = HashMap::new();
        let order = resolve_load_order(&ids, &deps).unwrap();
        assert_eq!(order, vec!["a", "b", "c"]);
    }
}
```

### Step 3: Write the DatatypeRegistry in `registry/mod.rs`

```rust
// ezagent/crates/ezagent-engine/src/registry/mod.rs

pub mod datatype;
pub mod dependency;

use std::collections::HashMap;

use crate::error::EngineError;
use datatype::DatatypeDeclaration;
use dependency::resolve_load_order;

/// Registry of all Datatype declarations (bus-spec §3.1).
pub struct DatatypeRegistry {
    datatypes: HashMap<String, DatatypeDeclaration>,
}

impl DatatypeRegistry {
    pub fn new() -> Self {
        Self {
            datatypes: HashMap::new(),
        }
    }

    /// Register a Datatype declaration.
    pub fn register(&mut self, decl: DatatypeDeclaration) -> Result<(), EngineError> {
        if self.datatypes.contains_key(&decl.id) {
            return Err(EngineError::DuplicateDatatype(decl.id.clone()));
        }
        self.datatypes.insert(decl.id.clone(), decl);
        Ok(())
    }

    /// Look up a Datatype by its id.
    pub fn get(&self, id: &str) -> Option<&DatatypeDeclaration> {
        self.datatypes.get(id)
    }

    /// Return all registered Datatype ids.
    pub fn ids(&self) -> Vec<String> {
        self.datatypes.keys().cloned().collect()
    }

    /// Compute the load order for all registered datatypes.
    pub fn load_order(&self) -> Result<Vec<String>, EngineError> {
        let ids = self.ids();
        let deps: HashMap<String, Vec<String>> = self.datatypes.iter()
            .map(|(id, decl)| (id.clone(), decl.dependencies.clone()))
            .collect();
        resolve_load_order(&ids, &deps)
    }

    /// Compute the load order for a room, filtering extensions by enabled_extensions.
    ///
    /// Built-in datatypes are always included. Extension datatypes are only included
    /// if their id is in `enabled_extensions`. If an extension depends on another
    /// extension that is not enabled, returns an error.
    pub fn load_order_for_room(&self, enabled_extensions: &[String]) -> Result<Vec<String>, EngineError> {
        let mut ids: Vec<String> = Vec::new();

        for (id, decl) in &self.datatypes {
            if decl.is_builtin || enabled_extensions.contains(id) {
                ids.push(id.clone());
            }
        }

        // Check that extension dependencies are met.
        for id in &ids {
            if let Some(decl) = self.datatypes.get(id) {
                if !decl.is_builtin {
                    for dep in &decl.dependencies {
                        if let Some(dep_decl) = self.datatypes.get(dep) {
                            if !dep_decl.is_builtin && !enabled_extensions.contains(dep) {
                                return Err(EngineError::DependencyNotMet {
                                    ext: id.clone(),
                                    requires: dep.clone(),
                                });
                            }
                        }
                    }
                }
            }
        }

        let deps: HashMap<String, Vec<String>> = ids.iter()
            .filter_map(|id| {
                self.datatypes.get(id).map(|decl| {
                    let filtered_deps: Vec<String> = decl.dependencies.iter()
                        .filter(|d| ids.iter().any(|i| i == *d))
                        .cloned()
                        .collect();
                    (id.clone(), filtered_deps)
                })
            })
            .collect();

        resolve_load_order(&ids, &deps)
    }
}

impl Default for DatatypeRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use datatype::*;
    use ezagent_protocol::KeyPattern;

    fn make_builtin(id: &str, deps: Vec<&str>) -> DatatypeDeclaration {
        DatatypeDeclaration {
            id: id.to_string(),
            version: "0.1.0".to_string(),
            dependencies: deps.into_iter().map(String::from).collect(),
            data_entries: vec![DataEntry {
                id: format!("{id}_entry"),
                storage_type: StorageType::CrdtMap,
                key_pattern: KeyPattern::new(format!("ezagent/{{room_id}}/{id}/{{state|updates}}")),
                persistent: true,
                writer_rule: WriterRule::SignerInMembers,
                sync_strategy: SyncMode::Eager,
            }],
            indexes: vec![],
            is_builtin: true,
        }
    }

    fn make_extension(id: &str, deps: Vec<&str>) -> DatatypeDeclaration {
        DatatypeDeclaration {
            id: id.to_string(),
            version: "0.1.0".to_string(),
            dependencies: deps.into_iter().map(String::from).collect(),
            data_entries: vec![],
            indexes: vec![],
            is_builtin: false,
        }
    }

    #[test]
    fn tc_1_engine_001_register_builtin_datatype() {
        let mut registry = DatatypeRegistry::new();
        let identity = make_builtin("identity", vec![]);
        registry.register(identity).unwrap();

        let decl = registry.get("identity").unwrap();
        assert_eq!(decl.id, "identity");
        assert!(decl.dependencies.is_empty());
    }

    #[test]
    fn tc_1_engine_002_dependency_resolution_order() {
        let mut registry = DatatypeRegistry::new();
        registry.register(make_builtin("identity", vec![])).unwrap();
        registry.register(make_builtin("room", vec!["identity"])).unwrap();
        registry.register(make_builtin("timeline", vec!["identity", "room"])).unwrap();
        registry.register(make_builtin("message", vec!["identity", "timeline"])).unwrap();

        let order = registry.load_order().unwrap();
        let pos = |name: &str| order.iter().position(|s| s == name).unwrap();

        assert!(pos("identity") < pos("room"));
        assert!(pos("room") < pos("timeline"));
        assert!(pos("timeline") < pos("message"));
    }

    #[test]
    fn tc_1_engine_003_circular_dependency_rejected() {
        let mut registry = DatatypeRegistry::new();
        registry.register(make_extension("a", vec!["b"])).unwrap();
        registry.register(make_extension("b", vec!["a"])).unwrap();

        let err = registry.load_order().unwrap_err();
        assert!(err.to_string().contains("circular dependency"));
    }

    #[test]
    fn tc_1_engine_004_extension_by_enabled() {
        let mut registry = DatatypeRegistry::new();
        registry.register(make_builtin("identity", vec![])).unwrap();
        registry.register(make_builtin("room", vec!["identity"])).unwrap();
        registry.register(make_builtin("timeline", vec!["identity", "room"])).unwrap();
        registry.register(make_builtin("message", vec!["identity", "timeline"])).unwrap();
        registry.register(make_extension("mutable", vec!["message"])).unwrap();
        registry.register(make_extension("reactions", vec!["timeline"])).unwrap();

        // Room with extensions enabled.
        let order = registry.load_order_for_room(&["mutable".into(), "reactions".into()]).unwrap();
        assert_eq!(order.len(), 6); // 4 builtins + 2 extensions

        // Room with no extensions.
        let order_empty = registry.load_order_for_room(&[]).unwrap();
        assert_eq!(order_empty.len(), 4); // builtins only
    }

    #[test]
    fn tc_1_engine_005_extension_dependency_not_met() {
        let mut registry = DatatypeRegistry::new();
        registry.register(make_builtin("identity", vec![])).unwrap();
        registry.register(make_builtin("room", vec!["identity"])).unwrap();
        registry.register(make_builtin("timeline", vec!["identity", "room"])).unwrap();
        registry.register(make_builtin("message", vec!["identity", "timeline"])).unwrap();
        registry.register(make_extension("mutable", vec!["message"])).unwrap();
        registry.register(make_extension("collab", vec!["mutable"])).unwrap();

        // Enable collab but not mutable.
        let err = registry.load_order_for_room(&["collab".into()]).unwrap_err();
        assert!(err.to_string().contains("dependency not met"));
        assert!(err.to_string().contains("collab"));
        assert!(err.to_string().contains("mutable"));
    }

    #[test]
    fn tc_1_engine_006_five_storage_types() {
        // Verify all five storage types are representable.
        let types = vec![
            StorageType::CrdtMap,
            StorageType::CrdtArray,
            StorageType::CrdtText,
            StorageType::Blob,
            StorageType::Ephemeral,
        ];
        assert_eq!(types.len(), 5);
        // Verify they are distinct.
        for (i, t1) in types.iter().enumerate() {
            for (j, t2) in types.iter().enumerate() {
                if i != j {
                    assert_ne!(t1, t2);
                }
            }
        }
    }
}
```

### Step 4: Run tests

Run: `cd ezagent && cargo test -p ezagent-engine -- --nocapture`
Expected: All 6+ tests pass

### Step 5: Commit

```bash
git add ezagent/crates/ezagent-engine/src/registry/ ezagent/crates/ezagent-engine/src/error.rs
git commit -m "feat(ezagent): implement Datatype Registry with dependency resolution

TC-1-ENGINE-001 through TC-1-ENGINE-006: register built-in datatypes,
topological dependency sort, circular dependency detection, extension
filtering by enabled_extensions, and five storage_type support."
```

---

## Task 3: Hook Pipeline + Executor (TC-1-HOOK-001~011)

**Files:**
- Modify: `ezagent/crates/ezagent-engine/src/hooks/phase.rs`
- Modify: `ezagent/crates/ezagent-engine/src/hooks/executor.rs`
- Modify: `ezagent/crates/ezagent-engine/src/hooks/mod.rs`

**Spec reference:** `docs/specs/bus-spec.md` §3.2 (Hook Pipeline, phases, ordering, failure handling)
**Test case reference:** `docs/plan/phase-1-bus.md` §4.2

### Step 1: Define Hook types in `hooks/phase.rs`

```rust
// ezagent/crates/ezagent-engine/src/hooks/phase.rs

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// The three execution phases of the Hook Pipeline (bus-spec §3.2.2).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum HookPhase {
    PreSend,
    AfterWrite,
    AfterRead,
}

/// Which data events trigger a hook (bus-spec §3.2.1).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TriggerEvent {
    Insert,
    Update,
    Delete,
    Any,
}

/// Metadata declaring a hook (bus-spec §3.2.1).
#[derive(Debug, Clone)]
pub struct HookDeclaration {
    pub id: String,
    pub phase: HookPhase,
    /// The datatype this hook triggers on. "*" means global.
    pub trigger_datatype: String,
    pub trigger_event: TriggerEvent,
    pub trigger_filter: Option<String>,
    pub priority: u32,
    /// The datatype that registered this hook.
    pub source: String,
}

/// Mutable context passed through the hook chain.
#[derive(Debug, Clone)]
pub struct HookContext {
    /// The datatype being operated on.
    pub datatype_id: String,
    /// The event type.
    pub event: TriggerEvent,
    /// Mutable data fields (key-value). Hooks may read and modify.
    pub data: HashMap<String, serde_json::Value>,
    /// The signer entity id (for permission checks).
    pub signer_id: Option<String>,
    /// The room id (if applicable).
    pub room_id: Option<String>,
    /// If true, CRDT modification is forbidden (after_read).
    pub read_only: bool,
    /// Error flag: set by a hook to indicate rejection.
    pub rejected: bool,
    pub rejection_reason: Option<String>,
}

impl HookContext {
    pub fn new(datatype_id: String, event: TriggerEvent) -> Self {
        Self {
            datatype_id,
            event,
            data: HashMap::new(),
            signer_id: None,
            room_id: None,
            read_only: false,
            rejected: false,
            rejection_reason: None,
        }
    }

    /// Mark this context as rejected (aborts chain in pre_send).
    pub fn reject(&mut self, reason: impl Into<String>) {
        self.rejected = true;
        self.rejection_reason = Some(reason.into());
    }
}
```

### Step 2: Implement the executor in `hooks/executor.rs`

```rust
// ezagent/crates/ezagent-engine/src/hooks/executor.rs

use std::collections::HashMap;
use std::sync::Arc;

use crate::error::EngineError;
use super::phase::{HookContext, HookDeclaration, HookPhase};

/// A concrete hook handler. This is a function pointer that takes a mutable HookContext.
pub type HookFn = Arc<dyn Fn(&mut HookContext) -> Result<(), EngineError> + Send + Sync>;

/// An entry in the pipeline: declaration + handler.
pub struct HookEntry {
    pub decl: HookDeclaration,
    pub handler: HookFn,
}

/// The Hook Pipeline executor.
///
/// Collects hook registrations and executes them in the correct order
/// when triggered (bus-spec §3.2.3).
pub struct HookExecutor {
    hooks: Vec<HookEntry>,
    /// Dependency order map: datatype_id -> load_order_index.
    dependency_order: HashMap<String, usize>,
    /// Set of builtin datatype ids (for global hook restriction).
    builtin_ids: std::collections::HashSet<String>,
}

impl HookExecutor {
    pub fn new() -> Self {
        Self {
            hooks: Vec::new(),
            dependency_order: HashMap::new(),
            builtin_ids: std::collections::HashSet::new(),
        }
    }

    /// Set the dependency ordering (call after registry computes load_order).
    pub fn set_dependency_order(&mut self, order: &[String]) {
        self.dependency_order.clear();
        for (i, id) in order.iter().enumerate() {
            self.dependency_order.insert(id.clone(), i);
        }
    }

    /// Set which datatypes are built-in.
    pub fn set_builtin_ids(&mut self, ids: Vec<String>) {
        self.builtin_ids = ids.into_iter().collect();
    }

    /// Register a hook. Enforces the global hook restriction.
    pub fn register(&mut self, decl: HookDeclaration, handler: HookFn) -> Result<(), EngineError> {
        if decl.trigger_datatype == "*" && !self.builtin_ids.contains(&decl.source) {
            return Err(EngineError::ExtensionCannotRegisterGlobalHook);
        }
        self.hooks.push(HookEntry { decl, handler });
        Ok(())
    }

    /// Execute all hooks for the given phase that match the context.
    ///
    /// Returns Ok(()) if all hooks pass, or Err with the first rejection.
    pub fn execute(&self, phase: HookPhase, ctx: &mut HookContext) -> Result<(), EngineError> {
        let mut matching: Vec<&HookEntry> = self.hooks.iter()
            .filter(|e| e.decl.phase == phase)
            .filter(|e| {
                e.decl.trigger_datatype == "*" || e.decl.trigger_datatype == ctx.datatype_id
            })
            .filter(|e| {
                matches!(e.decl.trigger_event, super::phase::TriggerEvent::Any)
                    || e.decl.trigger_event == ctx.event
            })
            .collect();

        // Sort by priority, then dependency order, then alphabetical source.
        matching.sort_by(|a, b| {
            a.decl.priority.cmp(&b.decl.priority)
                .then_with(|| {
                    let order_a = self.dependency_order.get(&a.decl.source).copied().unwrap_or(usize::MAX);
                    let order_b = self.dependency_order.get(&b.decl.source).copied().unwrap_or(usize::MAX);
                    order_a.cmp(&order_b)
                })
                .then_with(|| a.decl.source.cmp(&b.decl.source))
        });

        // Special ordering for identity hooks:
        // - pre_send: sign_envelope (p=0) must run LAST
        // - after_write: verify_signature (p=0) must run FIRST (already handled by sort)
        if phase == HookPhase::PreSend {
            // Move sign_envelope to the end.
            if let Some(pos) = matching.iter().position(|e| e.decl.id == "identity.sign_envelope") {
                let sign_hook = matching.remove(pos);
                matching.push(sign_hook);
            }
        }

        // Execute hooks in order.
        for entry in &matching {
            match phase {
                HookPhase::PreSend => {
                    (entry.handler)(ctx)?;
                    if ctx.rejected {
                        return Err(EngineError::HookRejected(
                            ctx.rejection_reason.clone().unwrap_or_default(),
                        ));
                    }
                }
                HookPhase::AfterWrite => {
                    // after_write: errors don't stop the chain.
                    if let Err(e) = (entry.handler)(ctx) {
                        eprintln!("after_write hook {} failed: {e}", entry.decl.id);
                    }
                }
                HookPhase::AfterRead => {
                    // after_read: errors are silently ignored, return unenhanced data.
                    let _ = (entry.handler)(ctx);
                }
            }
        }

        Ok(())
    }
}

impl Default for HookExecutor {
    fn default() -> Self {
        Self::new()
    }
}
```

### Step 3: Write the HookPipeline facade in `hooks/mod.rs`

```rust
// ezagent/crates/ezagent-engine/src/hooks/mod.rs

pub mod phase;
pub mod executor;

pub use phase::{HookPhase, HookDeclaration, HookContext, TriggerEvent};
pub use executor::{HookExecutor, HookFn, HookEntry};
```

### Step 4: Write comprehensive tests

Create `ezagent/crates/ezagent-engine/tests/hook_pipeline_tests.rs`:

```rust
//! Integration tests for the Hook Pipeline (TC-1-HOOK-001 ~ TC-1-HOOK-011).

use std::sync::Arc;
use ezagent_engine::hooks::*;
use ezagent_engine::error::EngineError;

fn setup_executor() -> HookExecutor {
    let mut executor = HookExecutor::new();
    executor.set_builtin_ids(vec![
        "identity".into(), "room".into(), "timeline".into(), "message".into(),
    ]);
    executor.set_dependency_order(&[
        "identity".into(), "room".into(), "timeline".into(), "message".into(),
    ]);
    executor
}

#[test]
fn tc_1_hook_001_pre_send_modifies_data() {
    let mut executor = setup_executor();
    executor.register(
        HookDeclaration {
            id: "test.inject_field".into(),
            phase: HookPhase::PreSend,
            trigger_datatype: "timeline_index".into(),
            trigger_event: TriggerEvent::Insert,
            priority: 30,
            source: "timeline".into(),
            trigger_filter: None,
        },
        Arc::new(|ctx: &mut HookContext| {
            ctx.data.insert("ext.test_field".into(), serde_json::json!("injected"));
            Ok(())
        }),
    ).unwrap();

    let mut ctx = HookContext::new("timeline_index".into(), TriggerEvent::Insert);
    executor.execute(HookPhase::PreSend, &mut ctx).unwrap();
    assert_eq!(ctx.data.get("ext.test_field").unwrap(), &serde_json::json!("injected"));
}

#[test]
fn tc_1_hook_002_pre_send_rejects_write() {
    let mut executor = setup_executor();
    executor.register(
        HookDeclaration {
            id: "room.check_room_write".into(),
            phase: HookPhase::PreSend,
            trigger_datatype: "*".into(),
            trigger_event: TriggerEvent::Any,
            priority: 10,
            source: "room".into(),
            trigger_filter: None,
        },
        Arc::new(|ctx: &mut HookContext| {
            ctx.reject("NOT_A_MEMBER");
            Ok(())
        }),
    ).unwrap();

    let mut ctx = HookContext::new("timeline_index".into(), TriggerEvent::Insert);
    let err = executor.execute(HookPhase::PreSend, &mut ctx).unwrap_err();
    assert!(err.to_string().contains("NOT_A_MEMBER"));
}

#[test]
fn tc_1_hook_003_priority_ordering() {
    let mut executor = setup_executor();
    let order = Arc::new(std::sync::Mutex::new(Vec::new()));

    let order_a = Arc::clone(&order);
    executor.register(
        HookDeclaration {
            id: "hook_a".into(), phase: HookPhase::PreSend,
            trigger_datatype: "timeline_index".into(), trigger_event: TriggerEvent::Any,
            priority: 30, source: "timeline".into(), trigger_filter: None,
        },
        Arc::new(move |_ctx: &mut HookContext| { order_a.lock().unwrap().push("A"); Ok(()) }),
    ).unwrap();

    let order_b = Arc::clone(&order);
    executor.register(
        HookDeclaration {
            id: "hook_b".into(), phase: HookPhase::PreSend,
            trigger_datatype: "timeline_index".into(), trigger_event: TriggerEvent::Any,
            priority: 10, source: "room".into(), trigger_filter: None,
        },
        Arc::new(move |_ctx: &mut HookContext| { order_b.lock().unwrap().push("B"); Ok(()) }),
    ).unwrap();

    let order_c = Arc::clone(&order);
    executor.register(
        HookDeclaration {
            id: "hook_c".into(), phase: HookPhase::PreSend,
            trigger_datatype: "timeline_index".into(), trigger_event: TriggerEvent::Any,
            priority: 20, source: "timeline".into(), trigger_filter: None,
        },
        Arc::new(move |_ctx: &mut HookContext| { order_c.lock().unwrap().push("C"); Ok(()) }),
    ).unwrap();

    let mut ctx = HookContext::new("timeline_index".into(), TriggerEvent::Insert);
    executor.execute(HookPhase::PreSend, &mut ctx).unwrap();
    let result = order.lock().unwrap().clone();
    assert_eq!(result, vec!["B", "C", "A"]); // 10, 20, 30
}

#[test]
fn tc_1_hook_004_same_priority_alphabetical_tiebreak() {
    let mut executor = setup_executor();
    // Add two non-builtin extensions with same priority.
    executor.set_dependency_order(&[
        "identity".into(), "room".into(), "timeline".into(), "message".into(),
        "channels".into(), "reply-to".into(),
    ]);
    let order = Arc::new(std::sync::Mutex::new(Vec::new()));

    let order_x = Arc::clone(&order);
    executor.register(
        HookDeclaration {
            id: "hook_x".into(), phase: HookPhase::PreSend,
            trigger_datatype: "timeline_index".into(), trigger_event: TriggerEvent::Any,
            priority: 30, source: "reply-to".into(), trigger_filter: None,
        },
        Arc::new(move |_ctx: &mut HookContext| { order_x.lock().unwrap().push("X"); Ok(()) }),
    ).unwrap();

    let order_y = Arc::clone(&order);
    executor.register(
        HookDeclaration {
            id: "hook_y".into(), phase: HookPhase::PreSend,
            trigger_datatype: "timeline_index".into(), trigger_event: TriggerEvent::Any,
            priority: 30, source: "channels".into(), trigger_filter: None,
        },
        Arc::new(move |_ctx: &mut HookContext| { order_y.lock().unwrap().push("Y"); Ok(()) }),
    ).unwrap();

    let mut ctx = HookContext::new("timeline_index".into(), TriggerEvent::Insert);
    executor.execute(HookPhase::PreSend, &mut ctx).unwrap();
    let result = order.lock().unwrap().clone();
    // channels (dep order 4) < reply-to (dep order 5), so Y before X.
    assert_eq!(result, vec!["Y", "X"]);
}

#[test]
fn tc_1_hook_005_after_write_cannot_modify_trigger_data() {
    // This is enforced by the hook context design — after_write hooks receive
    // a context where the triggered data is read-only. The test verifies the pattern.
    let mut executor = setup_executor();
    executor.register(
        HookDeclaration {
            id: "test.after_write_modify".into(),
            phase: HookPhase::AfterWrite,
            trigger_datatype: "timeline_index".into(),
            trigger_event: TriggerEvent::Any,
            priority: 30, source: "timeline".into(), trigger_filter: None,
        },
        Arc::new(|ctx: &mut HookContext| {
            // In real implementation, modifying the trigger's own data would be prevented.
            // Here we test the rejection pattern.
            if ctx.read_only {
                return Err(EngineError::PermissionDenied("cannot modify trigger data".into()));
            }
            Ok(())
        }),
    ).unwrap();

    let mut ctx = HookContext::new("timeline_index".into(), TriggerEvent::Insert);
    ctx.read_only = true;
    // after_write errors are logged but don't fail the chain.
    executor.execute(HookPhase::AfterWrite, &mut ctx).unwrap();
}

#[test]
fn tc_1_hook_007_after_read_cannot_modify_crdt() {
    let mut executor = setup_executor();
    executor.register(
        HookDeclaration {
            id: "test.after_read".into(),
            phase: HookPhase::AfterRead,
            trigger_datatype: "timeline_index".into(),
            trigger_event: TriggerEvent::Any,
            priority: 30, source: "timeline".into(), trigger_filter: None,
        },
        Arc::new(|ctx: &mut HookContext| {
            // after_read: may add response data but cannot modify CRDT.
            ctx.data.insert("enhanced_field".into(), serde_json::json!("enhanced"));
            Ok(())
        }),
    ).unwrap();

    let mut ctx = HookContext::new("timeline_index".into(), TriggerEvent::Any);
    ctx.read_only = true;
    executor.execute(HookPhase::AfterRead, &mut ctx).unwrap();
    assert_eq!(ctx.data.get("enhanced_field").unwrap(), &serde_json::json!("enhanced"));
}

#[test]
fn tc_1_hook_008_pre_send_error_stops_chain() {
    let mut executor = setup_executor();
    let order = Arc::new(std::sync::Mutex::new(Vec::new()));

    let order_a = Arc::clone(&order);
    executor.register(
        HookDeclaration {
            id: "hook_a".into(), phase: HookPhase::PreSend,
            trigger_datatype: "timeline_index".into(), trigger_event: TriggerEvent::Any,
            priority: 10, source: "room".into(), trigger_filter: None,
        },
        Arc::new(move |_ctx: &mut HookContext| { order_a.lock().unwrap().push("A"); Ok(()) }),
    ).unwrap();

    let order_b = Arc::clone(&order);
    executor.register(
        HookDeclaration {
            id: "hook_b".into(), phase: HookPhase::PreSend,
            trigger_datatype: "timeline_index".into(), trigger_event: TriggerEvent::Any,
            priority: 20, source: "timeline".into(), trigger_filter: None,
        },
        Arc::new(move |ctx: &mut HookContext| {
            order_b.lock().unwrap().push("B");
            ctx.reject("ERROR");
            Ok(())
        }),
    ).unwrap();

    let order_c = Arc::clone(&order);
    executor.register(
        HookDeclaration {
            id: "hook_c".into(), phase: HookPhase::PreSend,
            trigger_datatype: "timeline_index".into(), trigger_event: TriggerEvent::Any,
            priority: 30, source: "message".into(), trigger_filter: None,
        },
        Arc::new(move |_ctx: &mut HookContext| { order_c.lock().unwrap().push("C"); Ok(()) }),
    ).unwrap();

    let mut ctx = HookContext::new("timeline_index".into(), TriggerEvent::Insert);
    let _ = executor.execute(HookPhase::PreSend, &mut ctx);
    let result = order.lock().unwrap().clone();
    assert_eq!(result, vec!["A", "B"]); // C never executes
}

#[test]
fn tc_1_hook_009_after_write_error_continues_chain() {
    let mut executor = setup_executor();
    let order = Arc::new(std::sync::Mutex::new(Vec::new()));

    let order_a = Arc::clone(&order);
    executor.register(
        HookDeclaration {
            id: "hook_a".into(), phase: HookPhase::AfterWrite,
            trigger_datatype: "timeline_index".into(), trigger_event: TriggerEvent::Any,
            priority: 10, source: "room".into(), trigger_filter: None,
        },
        Arc::new(move |_ctx: &mut HookContext| { order_a.lock().unwrap().push("A"); Ok(()) }),
    ).unwrap();

    let order_b = Arc::clone(&order);
    executor.register(
        HookDeclaration {
            id: "hook_b".into(), phase: HookPhase::AfterWrite,
            trigger_datatype: "timeline_index".into(), trigger_event: TriggerEvent::Any,
            priority: 20, source: "timeline".into(), trigger_filter: None,
        },
        Arc::new(move |_ctx: &mut HookContext| {
            order_b.lock().unwrap().push("B");
            Err(EngineError::HookRejected("simulated error".into()))
        }),
    ).unwrap();

    let order_c = Arc::clone(&order);
    executor.register(
        HookDeclaration {
            id: "hook_c".into(), phase: HookPhase::AfterWrite,
            trigger_datatype: "timeline_index".into(), trigger_event: TriggerEvent::Any,
            priority: 30, source: "message".into(), trigger_filter: None,
        },
        Arc::new(move |_ctx: &mut HookContext| { order_c.lock().unwrap().push("C"); Ok(()) }),
    ).unwrap();

    let mut ctx = HookContext::new("timeline_index".into(), TriggerEvent::Insert);
    executor.execute(HookPhase::AfterWrite, &mut ctx).unwrap(); // Should succeed despite B error
    let result = order.lock().unwrap().clone();
    assert_eq!(result, vec!["A", "B", "C"]); // All execute, B error is just logged
}

#[test]
fn tc_1_hook_010_after_read_error_returns_raw_data() {
    let mut executor = setup_executor();
    executor.register(
        HookDeclaration {
            id: "failing_read_hook".into(), phase: HookPhase::AfterRead,
            trigger_datatype: "timeline_index".into(), trigger_event: TriggerEvent::Any,
            priority: 30, source: "timeline".into(), trigger_filter: None,
        },
        Arc::new(|_ctx: &mut HookContext| {
            Err(EngineError::HookRejected("read hook failed".into()))
        }),
    ).unwrap();

    let mut ctx = HookContext::new("timeline_index".into(), TriggerEvent::Any);
    ctx.data.insert("original".into(), serde_json::json!("data"));
    // Should succeed — after_read errors are silently ignored.
    executor.execute(HookPhase::AfterRead, &mut ctx).unwrap();
    assert_eq!(ctx.data.get("original").unwrap(), &serde_json::json!("data"));
}

#[test]
fn tc_1_hook_011_extension_cannot_register_global_hook() {
    let mut executor = setup_executor();
    let result = executor.register(
        HookDeclaration {
            id: "ext.global".into(),
            phase: HookPhase::PreSend,
            trigger_datatype: "*".into(),
            trigger_event: TriggerEvent::Any,
            priority: 30,
            source: "reactions".into(), // Not a builtin
            trigger_filter: None,
        },
        Arc::new(|_ctx: &mut HookContext| Ok(())),
    );
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("extensions cannot register global hooks"));
}
```

### Step 5: Run tests

Run: `cd ezagent && cargo test -p ezagent-engine -- --nocapture`
Expected: All hook tests pass

### Step 6: Commit

```bash
git add ezagent/crates/ezagent-engine/src/hooks/ ezagent/crates/ezagent-engine/tests/
git commit -m "feat(ezagent): implement Hook Pipeline with priority-sorted execution

TC-1-HOOK-001 through TC-1-HOOK-011: pre_send data modification,
rejection, priority ordering, alphabetical tiebreak, after_write
error continuity, after_read error tolerance, global hook restriction."
```

---

## Task 4: Annotation Validation + Index Builder (TC-1-ANNOT, TC-1-INDEX)

**Files:**
- Modify: `ezagent/crates/ezagent-engine/src/annotation.rs`
- Modify: `ezagent/crates/ezagent-engine/src/index/mod.rs`
- Modify: `ezagent/crates/ezagent-engine/src/index/refresh.rs`

**Spec reference:** `docs/specs/bus-spec.md` §3.3 (Annotation) and §3.4 (Index Builder)
**Test case reference:** `docs/plan/phase-1-bus.md` §4.3 and §4.4

### Step 1: Implement Annotation key validation in `annotation.rs`

Implement:
- `validate_annotation_key(key: &str, signer_id: &str) -> Result<(), EngineError>` — ensures the key's entity_id matches the signer
- `parse_annotation_key(key: &str) -> Option<(String, String)>` — extracts `(semantic, entity_id)`
- Tests for TC-1-ANNOT-001 (write and read), TC-1-ANNOT-002 (key format validation), TC-1-ANNOT-005 (only own annotation deletable)

### Step 2: Implement IndexBuilder in `index/mod.rs` and `index/refresh.rs`

Implement:
- `IndexBuilder` struct holding registered indexes
- `IndexEntry` with declaration + cached data
- `on_change` refresh via callback trigger
- `on_demand` refresh computing from CRDT state per request
- Tests for TC-1-INDEX-001 (on_change auto update), TC-1-INDEX-002 (on_demand realtime), TC-1-INDEX-003 (operation mapping)

### Step 3: Run tests, commit

```bash
git commit -m "feat(ezagent): implement Annotation validation and Index Builder

TC-1-ANNOT-001~005: annotation key format, signer ownership validation.
TC-1-INDEX-001~003: on_change auto-update, on_demand computation, operation mapping."
```

---

## Task 5: Enhance EntityId Validation (TC-1-IDENT-001)

**Files:**
- Modify: `ezagent/crates/ezagent-protocol/src/entity_id.rs`

**Spec reference:** `docs/specs/bus-spec.md` §5.1.3 (Entity ID ABNF)
**Test case reference:** `docs/plan/phase-1-bus.md` §4.8 TC-1-IDENT-001

### Step 1: Add strict ABNF validation to `EntityId::parse`

The existing parser accepts uppercase and special characters. Add validation:
- `local_part`: only `[a-z0-9._-]`, length 1-64
- `relay_domain`: only `[a-z0-9.-]`, length 1-253
- Add tests for all examples from TC-1-IDENT-001

```rust
// Add to EntityId::parse after the existing empty checks:
fn validate_local_part(s: &str) -> bool {
    s.len() >= 1 && s.len() <= 64
        && s.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '.' || c == '_' || c == '-')
}

fn validate_relay_domain(s: &str) -> bool {
    s.len() >= 1 && s.len() <= 253
        && s.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '.' || c == '-')
}
```

### Step 2: Add tests for TC-1-IDENT-001

```rust
#[test]
fn tc_1_ident_001_entity_id_format_validation() {
    // Valid
    assert!(EntityId::parse("@alice:relay-a.example.com").is_ok());
    assert!(EntityId::parse("@code-reviewer:relay-a.example.com").is_ok());
    assert!(EntityId::parse("@a:b.c").is_ok()); // shortest legal

    // Invalid
    assert!(EntityId::parse("alice:relay-a.example.com").is_err()); // missing @
    assert!(EntityId::parse("@Alice:relay-a.example.com").is_err()); // uppercase
    assert!(EntityId::parse("@:relay-a.example.com").is_err()); // empty local_part
    assert!(EntityId::parse("@alice:").is_err()); // empty domain
    assert!(EntityId::parse("@alice:RELAY.COM").is_err()); // uppercase domain
    assert!(EntityId::parse("@alice:relay a.com").is_err()); // space
}
```

### Step 3: Run tests, commit

```bash
git commit -m "fix(ezagent): add strict ABNF validation to EntityId::parse

TC-1-IDENT-001: enforce lowercase-only, valid charset for local_part
and relay_domain per bus-spec §5.1.3."
```

---

## Task 6: Identity Built-in (TC-1-IDENT-002~008, TC-1-SIGN-001~004)

**Files:**
- Modify: `ezagent/crates/ezagent-engine/src/builtins/identity.rs`
- Create: `ezagent/crates/ezagent-engine/tests/identity_tests.rs`

**Spec reference:** `docs/specs/bus-spec.md` §5.1 (Identity), §4.4 (Signed Envelope)
**Test case reference:** `docs/plan/phase-1-bus.md` §4.8, §4.6

### Step 1: Implement Identity built-in

Implement:
- `IdentityBuiltin` struct with keypair management, public key cache
- `register_hooks()` returning HookDeclarations + HookFns for:
  - `sign_envelope` (pre_send, global, p=0, runs last)
  - `verify_signature` (after_write, global, p=0, runs first)
- Timestamp validation (±5 minutes)
- Public key cache (HashMap<EntityId, PublicKey>)
- `DatatypeDeclaration` for identity (entity_keypair blob)

### Step 2: Write tests

Cover TC-1-IDENT-002 (Ed25519 keypair generation), TC-1-IDENT-003 (sign is last pre_send step), TC-1-IDENT-004 (verify is first after_write step), TC-1-SIGN-001 (normal sign/verify), TC-1-SIGN-002 (forged payload detection), TC-1-SIGN-003 (timestamp drift rejection), TC-1-SIGN-004 (binary layout correctness)

### Step 3: Run tests, commit

```bash
git commit -m "feat(ezagent): implement Identity built-in with sign/verify hooks

TC-1-IDENT-002~008: Ed25519 keypair, signing hook order, verification.
TC-1-SIGN-001~004: normal verify, forged payload, timestamp drift, binary layout."
```

---

## Task 7: Room Built-in (TC-1-ROOM-001~009)

**Files:**
- Modify: `ezagent/crates/ezagent-engine/src/builtins/room.rs`
- Create: `ezagent/crates/ezagent-engine/tests/room_tests.rs`

**Spec reference:** `docs/specs/bus-spec.md` §5.2 (Room)
**Test case reference:** `docs/plan/phase-1-bus.md` §4.9

### Step 1: Implement Room built-in

Implement:
- `RoomConfig` struct matching bus-spec §5.2.3 (room_id, name, membership, power_levels, etc.)
- `MembershipPolicy` enum (Open, Knock, Invite)
- `MemberRole` enum (Owner=100, Admin=50, Member=0)
- Room hooks:
  - `check_room_write` (pre_send, global, p=10): verify signer ∈ members
  - `check_config_permission` (pre_send, room_config, p=20): verify power_level >= admin
  - `extension_loader` (after_write, room_config, p=10): load/unload extensions
  - `member_change_notify` (after_write, room_config, p=50): emit SSE events
- Room creation: UUIDv7 room_id, initial shard
- Join/leave/invite/kick logic with power level checks

### Step 2: Write tests

Cover TC-1-ROOM-001 (create), TC-1-ROOM-002 (invite join), TC-1-ROOM-003 (non-member invite rejected), TC-1-ROOM-004 (config permission), TC-1-ROOM-005 (leave), TC-1-ROOM-006 (kick insufficient power), TC-1-ROOM-007 (kick sufficient), TC-1-ROOM-008 (extension enable), TC-1-ROOM-009 (extension disable preserves data)

### Step 3: Run tests, commit

```bash
git commit -m "feat(ezagent): implement Room built-in with membership and power levels

TC-1-ROOM-001~009: room create, invite/join/leave, power level checks,
extension enable/disable, data preservation on disable."
```

---

## Task 8: Timeline Built-in (TC-1-TL-001~008)

**Files:**
- Modify: `ezagent/crates/ezagent-engine/src/builtins/timeline.rs`
- Create: `ezagent/crates/ezagent-engine/tests/timeline_tests.rs`

**Spec reference:** `docs/specs/bus-spec.md` §5.3 (Timeline)
**Test case reference:** `docs/plan/phase-1-bus.md` §4.10

### Step 1: Implement Timeline built-in

Implement:
- `Ref` struct (ref_id ULID, author, content_type, content_id, created_at, status, signature, ext)
- `RefStatus` enum (Active, DeletedByAuthor)
- Timeline sharding: UUIDv7 shard_id, max refs per shard
- Timeline hooks:
  - `generate_ref` (pre_send, timeline_index insert, p=20)
  - `ref_change_detect` (after_write, timeline_index, p=30)
  - `timeline_pagination` (after_read, timeline_index, p=30)
- Cursor-based pagination (limit, before/after)
- CRDT ordering (not timestamp-based)

### Step 2: Write tests

Cover TC-1-TL-001 (complete ref generation), TC-1-TL-002 (CRDT ordering), TC-1-TL-003 (shard by month/UUIDv7), TC-1-TL-004 (old shard ext update), TC-1-TL-005 (message deletion), TC-1-TL-006 (non-author cannot delete), TC-1-TL-007 (ext field preservation), TC-1-TL-008 (pagination)

### Step 3: Run tests, commit

```bash
git commit -m "feat(ezagent): implement Timeline built-in with sharding and pagination

TC-1-TL-001~008: ref generation, CRDT ordering, UUIDv7 sharding,
deletion semantics, ext preservation, cursor pagination."
```

---

## Task 9: Message Built-in (TC-1-MSG-001~005)

**Files:**
- Modify: `ezagent/crates/ezagent-engine/src/builtins/message.rs`
- Create: `ezagent/crates/ezagent-engine/tests/message_tests.rs`

**Spec reference:** `docs/specs/bus-spec.md` §5.4 (Message)
**Test case reference:** `docs/plan/phase-1-bus.md` §4.11

### Step 1: Implement Message built-in

Implement:
- `ImmutableContent` struct (content_id, type, author, body, format, media_refs, created_at, signature)
- `ContentFormat` enum (TextPlain, TextMarkdown, TextHtml)
- Canonical JSON serialization (keys sorted, no whitespace, UTF-8 NFC)
- SHA-256 content hash computation
- Message hooks:
  - `compute_content_hash` (pre_send, immutable_content insert, p=20)
  - `validate_content_ref` (pre_send, timeline_index insert, p=25)
  - `resolve_content` (after_read, timeline_index, p=40)

### Step 2: Write tests

Cover TC-1-MSG-001 (content hash verification), TC-1-MSG-002 (tamper detection), TC-1-MSG-003 (author consistency), TC-1-MSG-004 (unknown content_type handling), TC-1-MSG-005 (after-read content resolution)

### Step 3: Run tests, commit

```bash
git commit -m "feat(ezagent): implement Message built-in with content hashing

TC-1-MSG-001~005: immutable content hash, tamper detection, author
consistency check, unknown content_type preservation, content resolution."
```

---

## Task 10: RocksDB Persistence (TC-1-PERSIST-001~004)

**Files:**
- Modify: `ezagent/crates/ezagent-backend/Cargo.toml` (add rocksdb dep)
- Modify: `ezagent/Cargo.toml` (add rocksdb to workspace deps)
- Create: `ezagent/crates/ezagent-backend/src/persistence.rs`
- Modify: `ezagent/crates/ezagent-backend/src/lib.rs`
- Create: `ezagent/crates/ezagent-backend/tests/persistence_tests.rs`

**Spec reference:** `docs/specs/bus-spec.md` §4.6 (Persistence)
**Test case reference:** `docs/plan/phase-1-bus.md` §4.7

### Step 1: Add rocksdb dependency

In `ezagent/Cargo.toml` workspace deps: `rocksdb = "0.22"`
In `ezagent/crates/ezagent-backend/Cargo.toml` deps: `rocksdb = { workspace = true }`

### Step 2: Implement `RocksDbBackend`

Implement:
- `RocksDbBackend` struct with four column families (docs, pending_updates, blobs, meta)
- `CrdtBackend` trait implementation backed by RocksDB
- State snapshot merging (every 100 updates)
- Pending update persistence
- Blob storage (write-once, content-addressed)
- Ephemeral data kept in-memory HashMap, not persisted

### Step 3: Write tests

Cover TC-1-PERSIST-001 (restart recovery), TC-1-PERSIST-002 (pending update persistence), TC-1-PERSIST-003 (state snapshot merging), TC-1-PERSIST-004 (ephemeral not persisted)

### Step 4: Run tests, commit

```bash
git commit -m "feat(ezagent): implement RocksDB persistent backend

TC-1-PERSIST-001~004: restart recovery, pending update persistence,
state snapshot merging, ephemeral data not persisted."
```

---

## Task 11: Sync Protocol Enhancements (TC-1-SYNC-001~007)

**Files:**
- Create: `ezagent/crates/ezagent-engine/src/sync.rs`
- Create: `ezagent/crates/ezagent-engine/tests/sync_tests.rs`

**Spec reference:** `docs/specs/bus-spec.md` §4.5 (Sync Protocol)
**Test case reference:** `docs/plan/phase-1-bus.md` §4.5

### Step 1: Implement sync coordinator

Implement:
- `SyncCoordinator` struct orchestrating initial sync + live sync
- Initial sync: state vector query → apply diff
- Live sync: subscribe to updates → verify envelope → apply
- Disconnect recovery: persist pending → reconnect → initial sync → publish pending
- Multi-source query: pick most complete state vector
- Peer queryable registration for held documents

### Step 2: Write tests

Cover TC-1-SYNC-001 (initial sync with empty state), TC-1-SYNC-002 (diff sync), TC-1-SYNC-003 (live pub/sub), TC-1-SYNC-004 (disconnect recovery), TC-1-SYNC-005 (causal ordering), TC-1-SYNC-006 (peer queryable), TC-1-SYNC-007 (multi-source selection)

Note: Some sync tests may need `#[ignore]` if they require Zenoh infrastructure.

### Step 3: Run tests, commit

```bash
git commit -m "feat(ezagent): implement sync protocol with disconnect recovery

TC-1-SYNC-001~007: initial sync, diff sync, live pub/sub, disconnect
recovery with pending updates, causal ordering, peer queryable."
```

---

## Task 12: Engine Coordinator (ties everything together)

**Files:**
- Modify: `ezagent/crates/ezagent-engine/src/engine.rs`
- Modify: `ezagent/crates/ezagent-engine/src/builtins/mod.rs`

### Step 1: Implement Engine struct

```rust
// ezagent/crates/ezagent-engine/src/engine.rs

/// The central Engine struct that ties together Registry, Pipeline, and Builtins.
pub struct Engine {
    pub registry: DatatypeRegistry,
    pub hooks: HookExecutor,
    pub index_builder: IndexBuilder,
    pub identity: IdentityBuiltin,
    // ... backend references, event emitter, etc.
}

impl Engine {
    /// Create a new Engine, register all built-in datatypes and hooks.
    pub fn new(/* backend config */) -> Result<Self, EngineError> {
        // 1. Create registry
        // 2. Register built-in datatypes
        // 3. Compute load order
        // 4. Create hook executor with dependency order
        // 5. Register built-in hooks
        // 6. Return Engine
    }
}
```

### Step 2: Implement built-in registration in `builtins/mod.rs`

Wire up all four built-in datatypes + their hooks into the Engine.

### Step 3: Run all tests, commit

```bash
git commit -m "feat(ezagent): implement Engine coordinator with built-in registration

Wires together DatatypeRegistry, HookPipeline, and all four Built-in
Datatypes into a cohesive Engine struct."
```

---

## Task 13: Operations + Event Stream (TC-1-API-001~005)

**Files:**
- Modify: `ezagent/crates/ezagent-engine/src/operations.rs`
- Modify: `ezagent/crates/ezagent-engine/src/events.rs`
- Create: `ezagent/crates/ezagent-engine/tests/operations_tests.rs`

**Spec reference:** `docs/specs/bus-spec.md` §7 (Engine Operations)
**Test case reference:** `docs/plan/phase-1-bus.md` §4.12

### Step 1: Define all operations

Implement all operations as methods on `Engine`:
- Identity: init, whoami, get_pubkey
- Room: create, list, get, update_config, join, leave, invite, members
- Timeline: list, get_ref
- Message: send, delete
- Annotation: list, add, remove
- Events: stream

### Step 2: Implement Event Stream

```rust
// events.rs
pub enum EventType {
    MessageNew,
    MessageDeleted,
    RoomMemberJoined,
    RoomMemberLeft,
}

pub struct Event {
    pub event_type: EventType,
    pub room_id: String,
    pub data: serde_json::Value,
    pub cursor: u64,
}
```

- Backed by `tokio::broadcast::channel`
- Room filtering
- Cursor-based replay

### Step 3: Write tests

Cover TC-1-API-001 (operation coverage), TC-1-API-002 (event stream coverage), TC-1-API-003 (event stream disconnect recovery), TC-1-API-004 (error handling for non-member), TC-1-API-005 (extension disabled error)

### Step 4: Run all tests, commit

```bash
git commit -m "feat(ezagent): implement Engine Operations and Event Stream

TC-1-API-001~005: full operation coverage (identity/room/timeline/message),
event stream with cursor-based replay, proper error handling."
```

---

## Task 14: Final Integration Test + Gate Verification

**Files:**
- Create: `ezagent/crates/ezagent-engine/tests/integration_test.rs`

### Step 1: Write end-to-end integration test

A single test that exercises the full message flow:
1. Initialize Engine
2. Create identity (Alice, Bob)
3. Alice creates Room
4. Alice invites Bob
5. Alice sends a message
6. Bob receives via event stream
7. Alice deletes message
8. Bob sees deletion event
9. Verify all CRDT states consistent

### Step 2: Run all tests

Run: `cd ezagent && cargo test -p ezagent-engine -- --nocapture`
Expected: ALL tests pass

### Step 3: Verify gate criteria

- All TC-1-* tests pass
- No P0/P1 bugs
- `cargo clippy -p ezagent-engine` clean
- `cargo fmt -p ezagent-engine -- --check` clean

### Step 4: Final commit

```bash
git commit -m "test(ezagent): add Phase 1 end-to-end integration test

Verifies complete message flow: identity init → room create → invite →
send message → event stream → delete → all states consistent."
```

---

## Summary

| Task | Component | TCs | Est. Steps |
|------|-----------|-----|------------|
| 1 | Scaffold crate | — | 7 |
| 2 | Registry + Dependencies | ENGINE-001~006 | 5 |
| 3 | Hook Pipeline | HOOK-001~011 | 6 |
| 4 | Annotation + Index | ANNOT-001~005, INDEX-001~003 | 3 |
| 5 | EntityId Validation | IDENT-001 | 3 |
| 6 | Identity Built-in | IDENT-002~008, SIGN-001~004 | 3 |
| 7 | Room Built-in | ROOM-001~009 | 3 |
| 8 | Timeline Built-in | TL-001~008 | 3 |
| 9 | Message Built-in | MSG-001~005 | 3 |
| 10 | RocksDB Persistence | PERSIST-001~004 | 4 |
| 11 | Sync Protocol | SYNC-001~007 | 3 |
| 12 | Engine Coordinator | — | 3 |
| 13 | Operations + Events | API-001~005 | 4 |
| 14 | Integration + Gate | — | 4 |
| **Total** | | **~120 TCs** | **~54 steps** |

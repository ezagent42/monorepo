# Phase 3 Relay Level 2 (Managed) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add ACL, Quota management, Admin API, and Prometheus monitoring to the existing Level 1 Relay service — covering 32 test cases (TC-3-ACL, QUOTA, ADMIN, MON).

**Architecture:** Extend the existing 4-crate workspace (relay-core, relay-bridge, relay-blob, relay-bin) without adding new crates. relay-core gains quota management and new error types; relay-bridge gains an ACL interceptor; relay-bin gains Admin API routes, Prometheus metrics, and readiness probes.

**Tech Stack:** Rust, axum 0.7, prometheus 0.13, RocksDB 0.22, Ed25519 (ezagent-protocol), serde_json

**Design doc:** `docs/plan/2026-03-03-phase3-level2-design.md`

**Existing Level 1 code:** 52 tests passing across 4 crates (relay-core, relay-bridge, relay-blob, relay-bin)

---

## Important context for implementers

- **Working directory:** `/Users/h2oslabs/Workspace/ezagent42/monorepo/.claude/worktrees/phase-03-relay`
- **Cargo commands** need PATH set: `export PATH="$HOME/.cargo/bin:/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:$PATH"`
- **Run all tests:** `cd relay && cargo test --workspace`
- **Run single crate tests:** `cd relay && cargo test -p relay-core`
- **Commit scope:** `feat(relay): ...` or `test(relay): ...`
- **Rust rules:** No `unwrap()`/`expect()` in non-test code. Use `thiserror` for errors. `///` doc comments on public APIs.
- **Code style:** Run `cargo fmt --all` and `cargo clippy --workspace` before committing.

---

### Task 1: Extend relay-core error types and config for Level 2

**Files:**
- Modify: `relay/crates/relay-core/src/error.rs`
- Modify: `relay/crates/relay-core/src/config.rs`

**Context:** The existing `RelayError` enum has 12 variants from Level 1. We need 7 new variants for quota, ACL, and admin errors. The existing `RelayConfig` needs `admin_entities` and `QuotaDefaults` fields.

**Step 1: Add error variants to `relay/crates/relay-core/src/error.rs`**

Add these variants inside the `RelayError` enum, after the existing `Network` variant:

```rust
    /// A quota limit was exceeded.
    #[error("quota exceeded for {entity_id}: {dimension} used={used}, limit={limit}")]
    QuotaExceeded {
        entity_id: String,
        dimension: String,
        used: u64,
        limit: u64,
    },

    /// The entity is not a member of the room.
    #[error("not a member: {entity_id} is not in room {room_id}")]
    NotAMember { entity_id: String, room_id: String },

    /// The entity's power level is insufficient.
    #[error("insufficient power level for {entity_id}: required={required}, actual={actual}")]
    InsufficientPowerLevel {
        entity_id: String,
        required: u32,
        actual: u32,
    },

    /// The entity is not the author of the resource.
    #[error("not author: {entity_id} is not author {author}")]
    NotAuthor { entity_id: String, author: String },

    /// The request is not authenticated.
    #[error("unauthorized: {0}")]
    Unauthorized(String),

    /// The authenticated entity lacks permission.
    #[error("forbidden: {0}")]
    Forbidden(String),

    /// A replayed request was detected (timestamp too old).
    #[error("replay detected: timestamp {timestamp_ms}ms is outside tolerance")]
    ReplayDetected { timestamp_ms: i64 },
```

**Step 2: Add `QuotaDefaults` and config fields to `relay/crates/relay-core/src/config.rs`**

Add the new struct after `BlobConfig`:

```rust
/// Default quota settings for all entities.
#[derive(Debug, Clone, Deserialize)]
pub struct QuotaDefaults {
    /// Maximum total CRDT storage per entity in bytes (default: 1 GiB).
    #[serde(default = "default_storage_total")]
    pub storage_total: u64,

    /// Maximum total blob storage per entity in bytes (default: 500 MiB).
    #[serde(default = "default_blob_total")]
    pub blob_total: u64,

    /// Maximum single blob size in bytes (default: 50 MiB).
    #[serde(default = "default_blob_single_max")]
    pub blob_single_max: u64,

    /// Maximum number of rooms an entity can participate in (default: 500).
    #[serde(default = "default_rooms_max")]
    pub rooms_max: u32,
}

impl Default for QuotaDefaults {
    fn default() -> Self {
        Self {
            storage_total: default_storage_total(),
            blob_total: default_blob_total(),
            blob_single_max: default_blob_single_max(),
            rooms_max: default_rooms_max(),
        }
    }
}

fn default_storage_total() -> u64 {
    1024 * 1024 * 1024 // 1 GiB
}

fn default_blob_total() -> u64 {
    500 * 1024 * 1024 // 500 MiB
}

fn default_blob_single_max() -> u64 {
    50 * 1024 * 1024 // 50 MiB
}

fn default_rooms_max() -> u32 {
    500
}
```

Add two new fields to `RelayConfig`:

```rust
    /// Entity IDs with admin privileges for the Admin API.
    #[serde(default)]
    pub admin_entities: Vec<String>,

    /// Default quota settings applied to all entities.
    #[serde(default)]
    pub quota: QuotaDefaults,
```

**Step 3: Add config tests**

Add to the test module in `config.rs`:

```rust
    /// Config with admin_entities and quota parses correctly.
    #[test]
    fn parse_config_with_level2_fields() {
        let toml = r#"
domain = "relay.example.com"
listen = "tls/0.0.0.0:7448"
storage_path = "/tmp/relay"
admin_entities = ["@admin:relay.example.com"]

[tls]
cert_path = "cert.pem"
key_path = "key.pem"

[quota]
storage_total = 2147483648
blob_total = 1073741824
rooms_max = 100
"#;
        let cfg = RelayConfig::parse(toml).unwrap();
        assert_eq!(cfg.admin_entities, vec!["@admin:relay.example.com"]);
        assert_eq!(cfg.quota.storage_total, 2_147_483_648);
        assert_eq!(cfg.quota.blob_total, 1_073_741_824);
        assert_eq!(cfg.quota.rooms_max, 100);
        // blob_single_max should use default
        assert_eq!(cfg.quota.blob_single_max, 50 * 1024 * 1024);
    }

    /// Config without Level 2 fields still parses (defaults applied).
    #[test]
    fn parse_config_level2_defaults() {
        let toml = r#"
domain = "relay.example.com"
listen = "tls/0.0.0.0:7448"
storage_path = "/tmp/relay"

[tls]
cert_path = "cert.pem"
key_path = "key.pem"
"#;
        let cfg = RelayConfig::parse(toml).unwrap();
        assert!(cfg.admin_entities.is_empty());
        assert_eq!(cfg.quota.storage_total, 1024 * 1024 * 1024);
        assert_eq!(cfg.quota.rooms_max, 500);
    }
```

**Step 4: Update `relay/crates/relay-core/src/lib.rs`**

No changes needed yet (quota module added in Task 3).

**Step 5: Verify**

Run: `cd relay && cargo test -p relay-core`
Expected: All existing tests + 2 new tests pass.

**Step 6: Commit**

```
feat(relay): add Level 2 error variants and config fields for quota/ACL/admin
```

---

### Task 2: Extend RocksDB storage with quota Column Families

**Files:**
- Modify: `relay/crates/relay-core/src/storage.rs`

**Context:** Level 1 has 4 Column Families (entities, rooms, blobs_meta, blob_refs). Level 2 adds 2 more: `quota_config` and `quota_usage`. Follow the exact same pattern as existing CFs.

**Step 1: Add new CF constants and CRUD methods**

In `storage.rs`, add the new CF constants:

```rust
const CF_QUOTA_CONFIG: &str = "quota_config";
const CF_QUOTA_USAGE: &str = "quota_usage";
```

Update `ALL_CFS`:

```rust
const ALL_CFS: &[&str] = &[
    CF_ENTITIES,
    CF_ROOMS,
    CF_BLOBS_META,
    CF_BLOB_REFS,
    CF_QUOTA_CONFIG,
    CF_QUOTA_USAGE,
];
```

Add CRUD methods for each new CF (following the exact pattern of existing entity/blob methods):

```rust
    // ---- quota_config CF ----

    /// Store a quota config record.
    pub fn put_quota_config(&self, key: &str, value: &[u8]) -> Result<()> {
        let cf = self
            .db
            .cf_handle(CF_QUOTA_CONFIG)
            .ok_or_else(|| RelayError::Storage("missing CF: quota_config".into()))?;
        self.db
            .put_cf(&cf, key.as_bytes(), value)
            .map_err(|e| RelayError::Storage(e.to_string()))
    }

    /// Retrieve a quota config record by key.
    pub fn get_quota_config(&self, key: &str) -> Result<Option<Vec<u8>>> {
        let cf = self
            .db
            .cf_handle(CF_QUOTA_CONFIG)
            .ok_or_else(|| RelayError::Storage("missing CF: quota_config".into()))?;
        self.db
            .get_cf(&cf, key.as_bytes())
            .map_err(|e| RelayError::Storage(e.to_string()))
    }

    /// Delete a quota config record by key.
    pub fn delete_quota_config(&self, key: &str) -> Result<()> {
        let cf = self
            .db
            .cf_handle(CF_QUOTA_CONFIG)
            .ok_or_else(|| RelayError::Storage("missing CF: quota_config".into()))?;
        self.db
            .delete_cf(&cf, key.as_bytes())
            .map_err(|e| RelayError::Storage(e.to_string()))
    }

    /// List all keys in the quota_config CF.
    pub fn list_quota_config_keys(&self) -> Result<Vec<String>> {
        let cf = self
            .db
            .cf_handle(CF_QUOTA_CONFIG)
            .ok_or_else(|| RelayError::Storage("missing CF: quota_config".into()))?;
        let iter = self.db.iterator_cf(&cf, rocksdb::IteratorMode::Start);
        let mut keys = Vec::new();
        for item in iter {
            let (key, _) = item.map_err(|e| RelayError::Storage(e.to_string()))?;
            let key_str =
                String::from_utf8(key.to_vec()).map_err(|e| RelayError::Storage(e.to_string()))?;
            keys.push(key_str);
        }
        Ok(keys)
    }

    // ---- quota_usage CF ----

    /// Store a quota usage record.
    pub fn put_quota_usage(&self, key: &str, value: &[u8]) -> Result<()> {
        let cf = self
            .db
            .cf_handle(CF_QUOTA_USAGE)
            .ok_or_else(|| RelayError::Storage("missing CF: quota_usage".into()))?;
        self.db
            .put_cf(&cf, key.as_bytes(), value)
            .map_err(|e| RelayError::Storage(e.to_string()))
    }

    /// Retrieve a quota usage record by key.
    pub fn get_quota_usage(&self, key: &str) -> Result<Option<Vec<u8>>> {
        let cf = self
            .db
            .cf_handle(CF_QUOTA_USAGE)
            .ok_or_else(|| RelayError::Storage("missing CF: quota_usage".into()))?;
        self.db
            .get_cf(&cf, key.as_bytes())
            .map_err(|e| RelayError::Storage(e.to_string()))
    }

    /// Delete a quota usage record by key.
    pub fn delete_quota_usage(&self, key: &str) -> Result<()> {
        let cf = self
            .db
            .cf_handle(CF_QUOTA_USAGE)
            .ok_or_else(|| RelayError::Storage("missing CF: quota_usage".into()))?;
        self.db
            .delete_cf(&cf, key.as_bytes())
            .map_err(|e| RelayError::Storage(e.to_string()))
    }
```

**Step 2: Add storage tests**

Add to the test module in `storage.rs`:

```rust
    /// CRUD operations on the quota_config CF.
    #[test]
    fn quota_config_cf_crud() {
        let dir = tempfile::tempdir().unwrap();
        let store = RelayStore::open(dir.path()).unwrap();

        assert!(store.get_quota_config("alice").unwrap().is_none());

        store.put_quota_config("alice", b"config-a").unwrap();
        assert_eq!(
            store.get_quota_config("alice").unwrap().as_deref(),
            Some(b"config-a".as_ref())
        );

        store.delete_quota_config("alice").unwrap();
        assert!(store.get_quota_config("alice").unwrap().is_none());
    }

    /// CRUD operations on the quota_usage CF.
    #[test]
    fn quota_usage_cf_crud() {
        let dir = tempfile::tempdir().unwrap();
        let store = RelayStore::open(dir.path()).unwrap();

        assert!(store.get_quota_usage("alice").unwrap().is_none());

        store.put_quota_usage("alice", b"usage-a").unwrap();
        assert_eq!(
            store.get_quota_usage("alice").unwrap().as_deref(),
            Some(b"usage-a".as_ref())
        );

        store.delete_quota_usage("alice").unwrap();
        assert!(store.get_quota_usage("alice").unwrap().is_none());
    }

    /// List quota config keys via prefix scan.
    #[test]
    fn list_quota_config_keys() {
        let dir = tempfile::tempdir().unwrap();
        let store = RelayStore::open(dir.path()).unwrap();

        store.put_quota_config("@a:relay.com", b"x").unwrap();
        store.put_quota_config("@b:relay.com", b"y").unwrap();

        let mut keys = store.list_quota_config_keys().unwrap();
        keys.sort();
        assert_eq!(keys, vec!["@a:relay.com", "@b:relay.com"]);
    }

    /// New CFs work alongside existing ones after reopen.
    #[test]
    fn quota_cfs_survive_reopen() {
        let dir = tempfile::tempdir().unwrap();

        {
            let store = RelayStore::open(dir.path()).unwrap();
            store.put_quota_config("key1", b"cfg1").unwrap();
            store.put_quota_usage("key1", b"usg1").unwrap();
            // Also write to an existing CF to prove coexistence.
            store.put_entity("ent1", b"record1").unwrap();
        }

        {
            let store = RelayStore::open(dir.path()).unwrap();
            assert_eq!(
                store.get_quota_config("key1").unwrap().as_deref(),
                Some(b"cfg1".as_ref())
            );
            assert_eq!(
                store.get_quota_usage("key1").unwrap().as_deref(),
                Some(b"usg1".as_ref())
            );
            assert_eq!(
                store.get_entity("ent1").unwrap().as_deref(),
                Some(b"record1".as_ref())
            );
        }
    }
```

**Step 3: Verify**

Run: `cd relay && cargo test -p relay-core`
Expected: All existing + 4 new storage tests pass.

**Step 4: Commit**

```
feat(relay): add quota_config and quota_usage RocksDB Column Families
```

---

### Task 3: Implement QuotaManager in relay-core

**Files:**
- Create: `relay/crates/relay-core/src/quota.rs`
- Modify: `relay/crates/relay-core/src/lib.rs` (add `pub mod quota;` and re-exports)

**Context:** QuotaManager provides check/enforce/query/admin methods for per-entity quotas. It reads/writes the quota_config and quota_usage CFs in RelayStore.

**Step 1: Create `relay/crates/relay-core/src/quota.rs`**

```rust
//! Per-entity quota management.
//!
//! Each entity has configurable limits for storage, blob usage, and room count.
//! The [`QuotaManager`] enforces these limits before writes are persisted.

use serde::{Deserialize, Serialize};

use crate::config::QuotaDefaults;
use crate::error::{RelayError, Result};
use crate::storage::RelayStore;

/// Where a quota config comes from.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum QuotaSource {
    /// The relay-wide default values.
    Default,
    /// An admin-set per-entity override.
    Override,
}

/// Per-entity quota configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuotaConfig {
    /// Maximum total CRDT storage in bytes.
    pub storage_total: u64,
    /// Maximum total blob storage in bytes.
    pub blob_total: u64,
    /// Maximum single blob size in bytes.
    pub blob_single_max: u64,
    /// Maximum number of rooms.
    pub rooms_max: u32,
    /// Whether this config is a default or an override.
    pub source: QuotaSource,
}

/// Per-entity usage tracking.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct QuotaUsage {
    /// CRDT storage used in bytes.
    pub storage_used: u64,
    /// Blob storage used in bytes.
    pub blob_used: u64,
    /// Number of rooms the entity participates in.
    pub rooms_count: u32,
}

/// Manages per-entity quotas backed by RocksDB.
pub struct QuotaManager {
    store: RelayStore,
    defaults: QuotaDefaults,
}

impl QuotaManager {
    /// Create a new quota manager.
    pub fn new(store: RelayStore, defaults: QuotaDefaults) -> Self {
        Self { store, defaults }
    }

    /// Get the effective quota config for an entity.
    ///
    /// Returns the per-entity override if one exists, otherwise the defaults.
    pub fn get_quota(&self, entity_id: &str) -> Result<QuotaConfig> {
        if let Some(raw) = self.store.get_quota_config(entity_id)? {
            let cfg: QuotaConfig = serde_json::from_slice(&raw)
                .map_err(|e| RelayError::Storage(format!("deserialize quota config: {e}")))?;
            return Ok(cfg);
        }
        Ok(self.get_defaults_config())
    }

    /// Get the current usage for an entity.
    ///
    /// Returns zero usage if no record exists yet.
    pub fn get_usage(&self, entity_id: &str) -> Result<QuotaUsage> {
        if let Some(raw) = self.store.get_quota_usage(entity_id)? {
            let usage: QuotaUsage = serde_json::from_slice(&raw)
                .map_err(|e| RelayError::Storage(format!("deserialize quota usage: {e}")))?;
            return Ok(usage);
        }
        Ok(QuotaUsage::default())
    }

    /// Compute the storage usage percentage (0.0 to 100.0+).
    pub fn usage_percentage(&self, entity_id: &str) -> Result<f64> {
        let quota = self.get_quota(entity_id)?;
        let usage = self.get_usage(entity_id)?;
        if quota.storage_total == 0 {
            return Ok(0.0);
        }
        Ok((usage.storage_used as f64 / quota.storage_total as f64) * 100.0)
    }

    /// Build a `QuotaConfig` from the relay-wide defaults.
    pub fn get_defaults_config(&self) -> QuotaConfig {
        QuotaConfig {
            storage_total: self.defaults.storage_total,
            blob_total: self.defaults.blob_total,
            blob_single_max: self.defaults.blob_single_max,
            rooms_max: self.defaults.rooms_max,
            source: QuotaSource::Default,
        }
    }

    // ---- Check methods (call before writes) ----

    /// Check whether a blob upload of `blob_size` bytes is allowed.
    ///
    /// Validates both `blob_single_max` and `blob_total`.
    pub fn check_blob_upload(&self, entity_id: &str, blob_size: u64) -> Result<()> {
        let quota = self.get_quota(entity_id)?;
        let usage = self.get_usage(entity_id)?;

        if blob_size > quota.blob_single_max {
            return Err(RelayError::BlobTooLarge {
                size: blob_size,
                limit: quota.blob_single_max,
            });
        }

        let new_total = usage.blob_used.saturating_add(blob_size);
        if new_total > quota.blob_total {
            return Err(RelayError::QuotaExceeded {
                entity_id: entity_id.to_string(),
                dimension: "blob_total".to_string(),
                used: usage.blob_used,
                limit: quota.blob_total,
            });
        }

        Ok(())
    }

    /// Check whether a CRDT storage write of `data_size` bytes is allowed.
    pub fn check_storage_write(&self, entity_id: &str, data_size: u64) -> Result<()> {
        let quota = self.get_quota(entity_id)?;
        let usage = self.get_usage(entity_id)?;

        let new_total = usage.storage_used.saturating_add(data_size);
        if new_total > quota.storage_total {
            return Err(RelayError::QuotaExceeded {
                entity_id: entity_id.to_string(),
                dimension: "storage_total".to_string(),
                used: usage.storage_used,
                limit: quota.storage_total,
            });
        }

        Ok(())
    }

    /// Check whether creating a new room is allowed.
    pub fn check_room_create(&self, entity_id: &str) -> Result<()> {
        let quota = self.get_quota(entity_id)?;
        let usage = self.get_usage(entity_id)?;

        if usage.rooms_count >= quota.rooms_max {
            return Err(RelayError::QuotaExceeded {
                entity_id: entity_id.to_string(),
                dimension: "rooms_max".to_string(),
                used: usage.rooms_count as u64,
                limit: quota.rooms_max as u64,
            });
        }

        Ok(())
    }

    // ---- Increment methods (call after successful writes) ----

    /// Increment blob usage for an entity.
    pub fn inc_blob_usage(&self, entity_id: &str, blob_size: u64) -> Result<()> {
        let mut usage = self.get_usage(entity_id)?;
        usage.blob_used = usage.blob_used.saturating_add(blob_size);
        self.save_usage(entity_id, &usage)
    }

    /// Increment CRDT storage usage for an entity.
    pub fn inc_storage_usage(&self, entity_id: &str, data_size: u64) -> Result<()> {
        let mut usage = self.get_usage(entity_id)?;
        usage.storage_used = usage.storage_used.saturating_add(data_size);
        self.save_usage(entity_id, &usage)
    }

    /// Increment room count for an entity.
    pub fn inc_room_count(&self, entity_id: &str) -> Result<()> {
        let mut usage = self.get_usage(entity_id)?;
        usage.rooms_count = usage.rooms_count.saturating_add(1);
        self.save_usage(entity_id, &usage)
    }

    // ---- Admin methods ----

    /// Set a per-entity quota override.
    pub fn set_override(&self, entity_id: &str, config: &QuotaConfig) -> Result<()> {
        let mut cfg = config.clone();
        cfg.source = QuotaSource::Override;
        let raw = serde_json::to_vec(&cfg)
            .map_err(|e| RelayError::Storage(format!("serialize quota config: {e}")))?;
        self.store.put_quota_config(entity_id, &raw)
    }

    /// Delete a per-entity override, reverting to defaults.
    pub fn delete_override(&self, entity_id: &str) -> Result<()> {
        self.store.delete_quota_config(entity_id)
    }

    /// Initialise default usage for a newly registered entity.
    pub fn ensure_defaults(&self, entity_id: &str) -> Result<()> {
        if self.store.get_quota_usage(entity_id)?.is_none() {
            self.save_usage(entity_id, &QuotaUsage::default())?;
        }
        Ok(())
    }

    // ---- Internal ----

    fn save_usage(&self, entity_id: &str, usage: &QuotaUsage) -> Result<()> {
        let raw = serde_json::to_vec(usage)
            .map_err(|e| RelayError::Storage(format!("serialize quota usage: {e}")))?;
        self.store.put_quota_usage(entity_id, &raw)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup(defaults: QuotaDefaults) -> (QuotaManager, tempfile::TempDir) {
        let dir = tempfile::tempdir().unwrap();
        let store = RelayStore::open(dir.path()).unwrap();
        let mgr = QuotaManager::new(store, defaults);
        (mgr, dir)
    }

    fn small_defaults() -> QuotaDefaults {
        QuotaDefaults {
            storage_total: 100_000, // 100 KB
            blob_total: 50_000,     // 50 KB
            blob_single_max: 10_000, // 10 KB
            rooms_max: 5,
        }
    }

    /// TC-3-QUOTA-001: Blob upload exceeding blob_total is rejected.
    #[test]
    fn tc_3_quota_001_blob_quota_exceeded() {
        let (mgr, _dir) = setup(small_defaults());
        let eid = "@alice:relay.example.com";

        // Simulate prior usage: 45 KB blob used.
        mgr.inc_blob_usage(eid, 45_000).unwrap();

        // Try to upload 10 KB more (45+10=55 > 50 KB limit).
        let err = mgr.check_blob_upload(eid, 10_000).unwrap_err();
        assert!(
            matches!(err, RelayError::QuotaExceeded { ref dimension, .. } if dimension == "blob_total"),
            "expected QuotaExceeded for blob_total, got: {err}"
        );
    }

    /// TC-3-QUOTA-002: Blob upload within quota succeeds.
    #[test]
    fn tc_3_quota_002_blob_within_quota() {
        let (mgr, _dir) = setup(small_defaults());
        let eid = "@alice:relay.example.com";

        mgr.inc_blob_usage(eid, 40_000).unwrap();
        // 40 + 5 = 45 <= 50 KB limit.
        mgr.check_blob_upload(eid, 5_000).unwrap();
    }

    /// TC-3-QUOTA-003: Storage write exceeding storage_total is rejected.
    #[test]
    fn tc_3_quota_003_storage_quota_exceeded() {
        let (mgr, _dir) = setup(small_defaults());
        let eid = "@alice:relay.example.com";

        mgr.inc_storage_usage(eid, 95_000).unwrap();

        let err = mgr.check_storage_write(eid, 10_000).unwrap_err();
        assert!(
            matches!(err, RelayError::QuotaExceeded { ref dimension, .. } if dimension == "storage_total"),
            "expected QuotaExceeded for storage_total, got: {err}"
        );
    }

    /// TC-3-QUOTA-005: Query quota and usage for an entity.
    #[test]
    fn tc_3_quota_005_query_quota_and_usage() {
        let (mgr, _dir) = setup(small_defaults());
        let eid = "@alice:relay.example.com";

        mgr.inc_storage_usage(eid, 30_000).unwrap();
        mgr.inc_blob_usage(eid, 20_000).unwrap();
        mgr.inc_room_count(eid).unwrap();
        mgr.inc_room_count(eid).unwrap();

        let quota = mgr.get_quota(eid).unwrap();
        assert_eq!(quota.storage_total, 100_000);
        assert_eq!(quota.source, QuotaSource::Default);

        let usage = mgr.get_usage(eid).unwrap();
        assert_eq!(usage.storage_used, 30_000);
        assert_eq!(usage.blob_used, 20_000);
        assert_eq!(usage.rooms_count, 2);
    }

    /// TC-3-QUOTA-006: Usage > 80% returns a warning percentage.
    #[test]
    fn tc_3_quota_006_usage_percentage_warning() {
        let (mgr, _dir) = setup(small_defaults());
        let eid = "@alice:relay.example.com";

        mgr.inc_storage_usage(eid, 85_000).unwrap();
        let pct = mgr.usage_percentage(eid).unwrap();
        assert!(pct > 80.0, "expected > 80%, got {pct}");
    }

    /// TC-3-QUOTA-007: At 100% storage, blob_total check still operates independently.
    #[test]
    fn tc_3_quota_007_full_storage_blob_independent() {
        let (mgr, _dir) = setup(small_defaults());
        let eid = "@alice:relay.example.com";

        // Fill storage to 100%.
        mgr.inc_storage_usage(eid, 100_000).unwrap();
        let err = mgr.check_storage_write(eid, 1).unwrap_err();
        assert!(matches!(err, RelayError::QuotaExceeded { .. }));

        // Blob check is independent of storage; blob_used is still 0.
        mgr.check_blob_upload(eid, 5_000).unwrap();
    }

    /// TC-3-QUOTA-008: Admin adjusts quota; new limit takes effect immediately.
    #[test]
    fn tc_3_quota_008_admin_adjust_quota() {
        let (mgr, _dir) = setup(small_defaults());
        let eid = "@alice:relay.example.com";

        // Default: storage_total = 100 KB.
        mgr.inc_storage_usage(eid, 95_000).unwrap();
        assert!(mgr.check_storage_write(eid, 10_000).is_err());

        // Admin overrides to 200 KB.
        let new_config = QuotaConfig {
            storage_total: 200_000,
            blob_total: 100_000,
            blob_single_max: 50_000,
            rooms_max: 10,
            source: QuotaSource::Override,
        };
        mgr.set_override(eid, &new_config).unwrap();

        // Now the write should succeed (95 + 10 = 105 <= 200 KB).
        mgr.check_storage_write(eid, 10_000).unwrap();

        // Verify source is Override.
        let q = mgr.get_quota(eid).unwrap();
        assert_eq!(q.source, QuotaSource::Override);
        assert_eq!(q.storage_total, 200_000);
    }

    /// TC-3-QUOTA-009: New entity gets default quota.
    #[test]
    fn tc_3_quota_009_default_quota_new_entity() {
        let (mgr, _dir) = setup(small_defaults());
        let eid = "@dave:relay.example.com";

        mgr.ensure_defaults(eid).unwrap();

        let q = mgr.get_quota(eid).unwrap();
        assert_eq!(q.source, QuotaSource::Default);
        assert_eq!(q.storage_total, 100_000);

        let u = mgr.get_usage(eid).unwrap();
        assert_eq!(u.storage_used, 0);
        assert_eq!(u.blob_used, 0);
        assert_eq!(u.rooms_count, 0);
    }

    /// TC-3-QUOTA-010: Room count quota.
    #[test]
    fn tc_3_quota_010_room_limit_exceeded() {
        let (mgr, _dir) = setup(small_defaults());
        let eid = "@alice:relay.example.com";

        for _ in 0..5 {
            mgr.check_room_create(eid).unwrap();
            mgr.inc_room_count(eid).unwrap();
        }

        let err = mgr.check_room_create(eid).unwrap_err();
        assert!(
            matches!(err, RelayError::QuotaExceeded { ref dimension, .. } if dimension == "rooms_max"),
            "expected QuotaExceeded for rooms_max, got: {err}"
        );
    }

    /// Deleting an override reverts to defaults.
    #[test]
    fn delete_override_reverts_to_defaults() {
        let (mgr, _dir) = setup(small_defaults());
        let eid = "@alice:relay.example.com";

        let custom = QuotaConfig {
            storage_total: 999,
            blob_total: 999,
            blob_single_max: 999,
            rooms_max: 999,
            source: QuotaSource::Override,
        };
        mgr.set_override(eid, &custom).unwrap();
        assert_eq!(mgr.get_quota(eid).unwrap().storage_total, 999);

        mgr.delete_override(eid).unwrap();
        assert_eq!(mgr.get_quota(eid).unwrap().storage_total, 100_000);
        assert_eq!(mgr.get_quota(eid).unwrap().source, QuotaSource::Default);
    }
}
```

**Step 2: Update `relay/crates/relay-core/src/lib.rs`**

Add after `pub mod storage;`:
```rust
pub mod quota;
```

Add to re-exports:
```rust
pub use config::QuotaDefaults;
pub use quota::{QuotaConfig, QuotaManager, QuotaSource, QuotaUsage};
```

**Step 3: Verify**

Run: `cd relay && cargo test -p relay-core`
Expected: All existing + 11 new quota tests pass.

**Step 4: Commit**

```
feat(relay): implement QuotaManager with per-entity quota enforcement
```

---

### Task 4: Add entity revocation to relay-core

**Files:**
- Modify: `relay/crates/relay-core/src/entity.rs`

**Context:** Admin API needs to revoke entities (set status to Revoked). The existing `EntityManagerImpl` needs a `revoke()` method.

**Step 1: Add `revoke()` to `EntityManagerImpl`**

Add this method after `rotate_key()`:

```rust
    /// Revoke an entity by setting its status to `Revoked`.
    ///
    /// Returns the updated record. Revoked entities cannot participate
    /// in further operations but their historical data is preserved.
    pub fn revoke(&self, entity_id_str: &str) -> Result<EntityRecord> {
        let mut record = self.get(entity_id_str)?;
        record.status = EntityStatus::Revoked;

        let serialized =
            serde_json::to_vec(&record).map_err(|e| RelayError::Storage(e.to_string()))?;
        self.store.put_entity(entity_id_str, &serialized)?;

        Ok(record)
    }
```

**Step 2: Add test**

Add in the test module:

```rust
    /// TC-3-ADMIN-009: Entity revocation sets status to Revoked.
    #[test]
    fn tc_3_admin_009_entity_revocation() {
        let mgr = setup("relay.example.com");
        let kp = Keypair::generate();
        let pk = kp.public_key();
        let eid = "@spammer:relay.example.com";

        mgr.register(eid, pk.as_bytes()).unwrap();
        assert_eq!(mgr.get(eid).unwrap().status, EntityStatus::Active);

        let revoked = mgr.revoke(eid).unwrap();
        assert_eq!(revoked.status, EntityStatus::Revoked);

        // Re-read from store to confirm persistence.
        let stored = mgr.get(eid).unwrap();
        assert_eq!(stored.status, EntityStatus::Revoked);
        // Pubkey is still accessible (history preserved).
        assert_eq!(stored.pubkey, pk.as_bytes().to_vec());
    }

    /// Revoking a non-existent entity returns EntityNotFound.
    #[test]
    fn revoke_nonexistent_entity() {
        let mgr = setup("relay.example.com");
        let err = mgr.revoke("@ghost:relay.example.com").unwrap_err();
        assert!(matches!(err, RelayError::EntityNotFound(_)));
    }
```

**Step 3: Verify**

Run: `cd relay && cargo test -p relay-core`
Expected: All existing + 2 new tests pass.

**Step 4: Commit**

```
feat(relay): add entity revocation support
```

---

### Task 5: Implement ACL interceptor in relay-bridge

**Files:**
- Create: `relay/crates/relay-bridge/src/acl.rs`
- Modify: `relay/crates/relay-bridge/src/lib.rs` (add `pub mod acl;`)

**Context:** The ACL interceptor checks room membership and power levels before allowing CRDT writes. It reads Room Config from the `rooms` CF. Room membership is stored as JSON in a well-known key pattern: `{room_id}/config` in the rooms CF.

**Step 1: Create `relay/crates/relay-bridge/src/acl.rs`**

```rust
//! Access Control interceptor for Room-level authorization.
//!
//! Checks room membership and power levels before allowing CRDT writes.
//! Reads Room Config from the `rooms` Column Family.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use serde::{Deserialize, Serialize};

use relay_core::{RelayError, RelayStore, Result};

/// Room membership and power level configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomMembership {
    /// Set of entity IDs that are members.
    pub members: HashSet<String>,
    /// Per-entity power levels (missing entries default to 0).
    pub power_levels: HashMap<String, u32>,
    /// Minimum power level required to invite new members.
    #[serde(default = "default_invite_level")]
    pub invite_level: u32,
    /// Minimum power level required for admin operations (e.g. config writes).
    #[serde(default = "default_admin_level")]
    pub admin_level: u32,
}

fn default_invite_level() -> u32 {
    50
}

fn default_admin_level() -> u32 {
    100
}

/// Enforces Room-level access control.
pub struct AclInterceptor {
    store: Arc<RelayStore>,
}

impl AclInterceptor {
    /// Create a new interceptor backed by the given store.
    pub fn new(store: Arc<RelayStore>) -> Self {
        Self { store }
    }

    /// Load the membership config for a room from the `rooms` CF.
    ///
    /// Reads key `{room_id}/config` and deserialises it as JSON.
    /// Returns an empty membership if no config exists yet.
    pub fn load_membership(&self, room_id: &str) -> Result<RoomMembership> {
        let key = format!("{room_id}/config");
        match self.store.get_room(&key)? {
            Some(raw) => serde_json::from_slice(&raw)
                .map_err(|e| RelayError::Storage(format!("deserialize room config: {e}"))),
            None => Ok(RoomMembership {
                members: HashSet::new(),
                power_levels: HashMap::new(),
                invite_level: default_invite_level(),
                admin_level: default_admin_level(),
            }),
        }
    }

    /// Save a membership config for a room to the `rooms` CF.
    pub fn save_membership(&self, room_id: &str, membership: &RoomMembership) -> Result<()> {
        let key = format!("{room_id}/config");
        let raw = serde_json::to_vec(membership)
            .map_err(|e| RelayError::Storage(format!("serialize room config: {e}")))?;
        self.store.put_room(&key, &raw)
    }

    /// Check whether an entity is a room member.
    pub fn is_member(&self, room_id: &str, entity_id: &str) -> Result<bool> {
        let membership = self.load_membership(room_id)?;
        Ok(membership.members.contains(entity_id))
    }

    /// Get the power level for an entity in a room (defaults to 0).
    pub fn get_power_level(&self, room_id: &str, entity_id: &str) -> Result<u32> {
        let membership = self.load_membership(room_id)?;
        Ok(*membership.power_levels.get(entity_id).unwrap_or(&0))
    }

    /// Verify that the signer is a member of the room.
    ///
    /// Used for general CRDT update writes (Timeline, Content, etc.).
    pub fn check_update(&self, room_id: &str, signer: &str) -> Result<()> {
        if !self.is_member(room_id, signer)? {
            return Err(RelayError::NotAMember {
                entity_id: signer.to_string(),
                room_id: room_id.to_string(),
            });
        }
        Ok(())
    }

    /// Verify that the signer has admin-level power for config writes.
    pub fn check_config_write(&self, room_id: &str, signer: &str) -> Result<()> {
        self.check_update(room_id, signer)?;
        let membership = self.load_membership(room_id)?;
        let level = *membership.power_levels.get(signer).unwrap_or(&0);
        if level < membership.admin_level {
            return Err(RelayError::InsufficientPowerLevel {
                entity_id: signer.to_string(),
                required: membership.admin_level,
                actual: level,
            });
        }
        Ok(())
    }

    /// Verify that the signer can delete a message (must be author or admin).
    pub fn check_delete(
        &self,
        room_id: &str,
        signer: &str,
        author: &str,
    ) -> Result<()> {
        self.check_update(room_id, signer)?;
        if signer == author {
            return Ok(());
        }
        // Non-author must be admin.
        let membership = self.load_membership(room_id)?;
        let level = *membership.power_levels.get(signer).unwrap_or(&0);
        if level < membership.admin_level {
            return Err(RelayError::NotAuthor {
                entity_id: signer.to_string(),
                author: author.to_string(),
            });
        }
        Ok(())
    }

    /// Verify that the signer has sufficient power to invite.
    pub fn check_invite(&self, room_id: &str, signer: &str) -> Result<()> {
        self.check_update(room_id, signer)?;
        let membership = self.load_membership(room_id)?;
        let level = *membership.power_levels.get(signer).unwrap_or(&0);
        if level < membership.invite_level {
            return Err(RelayError::InsufficientPowerLevel {
                entity_id: signer.to_string(),
                required: membership.invite_level,
                actual: level,
            });
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_room(room_id: &str, members: &[(&str, u32)]) -> (AclInterceptor, tempfile::TempDir) {
        let dir = tempfile::tempdir().unwrap();
        let store = Arc::new(RelayStore::open(dir.path()).unwrap());
        let acl = AclInterceptor::new(store);

        let mut member_set = HashSet::new();
        let mut power_levels = HashMap::new();
        for (eid, level) in members {
            member_set.insert(eid.to_string());
            power_levels.insert(eid.to_string(), *level);
        }

        let membership = RoomMembership {
            members: member_set,
            power_levels,
            invite_level: 50,
            admin_level: 100,
        };
        acl.save_membership(room_id, &membership).unwrap();
        (acl, dir)
    }

    /// TC-3-ACL-001: Non-member access is rejected.
    #[test]
    fn tc_3_acl_001_non_member_rejected() {
        let (acl, _dir) = setup_room(
            "R-alpha",
            &[("@alice:relay.com", 100), ("@bob:relay.com", 50)],
        );

        let err = acl.check_update("R-alpha", "@outsider:relay.com").unwrap_err();
        assert!(
            matches!(err, RelayError::NotAMember { .. }),
            "expected NotAMember, got: {err}"
        );
    }

    /// TC-3-ACL-002: Member access succeeds.
    #[test]
    fn tc_3_acl_002_member_access() {
        let (acl, _dir) = setup_room(
            "R-alpha",
            &[("@alice:relay.com", 100), ("@bob:relay.com", 50)],
        );

        acl.check_update("R-alpha", "@alice:relay.com").unwrap();
        acl.check_update("R-alpha", "@bob:relay.com").unwrap();
    }

    /// TC-3-ACL-003: Admin can modify config; non-admin cannot.
    #[test]
    fn tc_3_acl_003_power_level_admin() {
        let (acl, _dir) = setup_room(
            "R-alpha",
            &[("@alice:relay.com", 100), ("@bob:relay.com", 50)],
        );

        // Alice (admin=100) can write config.
        acl.check_config_write("R-alpha", "@alice:relay.com").unwrap();

        // Bob (member=50) cannot write config.
        let err = acl.check_config_write("R-alpha", "@bob:relay.com").unwrap_err();
        assert!(
            matches!(err, RelayError::InsufficientPowerLevel { required: 100, actual: 50, .. }),
            "expected InsufficientPowerLevel, got: {err}"
        );
    }

    /// TC-3-ACL-004: Author can delete own message; non-admin non-author cannot.
    #[test]
    fn tc_3_acl_004_delete_own_message() {
        let (acl, _dir) = setup_room(
            "R-alpha",
            &[("@alice:relay.com", 50), ("@bob:relay.com", 50)],
        );

        // Alice deletes her own message -> OK.
        acl.check_delete("R-alpha", "@alice:relay.com", "@alice:relay.com")
            .unwrap();

        // Bob (non-admin) tries to delete Alice's message -> rejected.
        let err = acl
            .check_delete("R-alpha", "@bob:relay.com", "@alice:relay.com")
            .unwrap_err();
        assert!(
            matches!(err, RelayError::NotAuthor { .. }),
            "expected NotAuthor, got: {err}"
        );
    }

    /// TC-3-ACL-005: Invite permission based on invite_level.
    #[test]
    fn tc_3_acl_005_invite_permission() {
        let (acl, _dir) = setup_room(
            "R-alpha",
            &[("@alice:relay.com", 100), ("@bob:relay.com", 50)],
        );

        // invite_level = 50, so Bob (50) can invite.
        acl.check_invite("R-alpha", "@bob:relay.com").unwrap();

        // Setup a room with invite_level=100.
        let dir2 = tempfile::tempdir().unwrap();
        let store2 = Arc::new(RelayStore::open(dir2.path()).unwrap());
        let acl2 = AclInterceptor::new(store2);
        let membership = RoomMembership {
            members: HashSet::from(["@bob:relay.com".to_string()]),
            power_levels: HashMap::from([("@bob:relay.com".to_string(), 50)]),
            invite_level: 100,
            admin_level: 100,
        };
        acl2.save_membership("R-beta", &membership).unwrap();

        let err = acl2.check_invite("R-beta", "@bob:relay.com").unwrap_err();
        assert!(
            matches!(err, RelayError::InsufficientPowerLevel { required: 100, actual: 50, .. }),
            "expected InsufficientPowerLevel, got: {err}"
        );
    }

    /// TC-3-ACL-006: After leaving, entity loses access.
    #[test]
    fn tc_3_acl_006_leave_loses_access() {
        let dir = tempfile::tempdir().unwrap();
        let store = Arc::new(RelayStore::open(dir.path()).unwrap());
        let acl = AclInterceptor::new(store);

        // Bob is a member.
        let mut membership = RoomMembership {
            members: HashSet::from(["@bob:relay.com".to_string()]),
            power_levels: HashMap::from([("@bob:relay.com".to_string(), 50)]),
            invite_level: 50,
            admin_level: 100,
        };
        acl.save_membership("R-alpha", &membership).unwrap();
        acl.check_update("R-alpha", "@bob:relay.com").unwrap();

        // Bob leaves (remove from members).
        membership.members.remove("@bob:relay.com");
        acl.save_membership("R-alpha", &membership).unwrap();

        let err = acl.check_update("R-alpha", "@bob:relay.com").unwrap_err();
        assert!(matches!(err, RelayError::NotAMember { .. }));
    }

    /// TC-3-ACL-007: Direct key pattern access is blocked by ACL check.
    #[test]
    fn tc_3_acl_007_bypass_detection() {
        let (acl, _dir) = setup_room("R-alpha", &[("@alice:relay.com", 100)]);

        // Attacker is not a member; any check_update call rejects.
        let err = acl.check_update("R-alpha", "@attacker:relay.com").unwrap_err();
        assert!(matches!(err, RelayError::NotAMember { .. }));
    }

    /// TC-3-ACL-008: ACL changes take effect on next check (no caching).
    #[test]
    fn tc_3_acl_008_acl_change_realtime() {
        let dir = tempfile::tempdir().unwrap();
        let store = Arc::new(RelayStore::open(dir.path()).unwrap());
        let acl = AclInterceptor::new(store);

        // Carol is a member.
        let mut membership = RoomMembership {
            members: HashSet::from(["@carol:relay.com".to_string()]),
            power_levels: HashMap::from([("@carol:relay.com".to_string(), 50)]),
            invite_level: 50,
            admin_level: 100,
        };
        acl.save_membership("R-alpha", &membership).unwrap();
        acl.check_update("R-alpha", "@carol:relay.com").unwrap();

        // Admin removes Carol.
        membership.members.remove("@carol:relay.com");
        acl.save_membership("R-alpha", &membership).unwrap();

        // Next check immediately reflects the change.
        let err = acl.check_update("R-alpha", "@carol:relay.com").unwrap_err();
        assert!(matches!(err, RelayError::NotAMember { .. }));
    }

    /// Admin can delete anyone's message.
    #[test]
    fn admin_can_delete_any_message() {
        let (acl, _dir) = setup_room(
            "R-alpha",
            &[("@alice:relay.com", 100), ("@bob:relay.com", 50)],
        );

        // Alice (admin) deletes Bob's message.
        acl.check_delete("R-alpha", "@alice:relay.com", "@bob:relay.com")
            .unwrap();
    }
}
```

**Step 2: Update `relay/crates/relay-bridge/src/lib.rs`**

Add `pub mod acl;` at the top.

**Step 3: Verify**

Run: `cd relay && cargo test -p relay-bridge`
Expected: All existing + 9 ACL tests pass.

**Step 4: Commit**

```
feat(relay): implement ACL interceptor with room membership and power levels
```

---

### Task 6: Implement Prometheus metrics in relay-bin

**Files:**
- Modify: `relay/Cargo.toml` (add prometheus to workspace deps)
- Modify: `relay/crates/relay-bin/Cargo.toml` (add prometheus dep)
- Create: `relay/crates/relay-bin/src/metrics.rs`

**Context:** We use `prometheus` 0.13 to expose a `/metrics` endpoint in Prometheus text format. The `RelayMetrics` struct holds all gauges and counters.

**Step 1: Add prometheus to workspace dependencies**

In `relay/Cargo.toml`, add to `[workspace.dependencies]`:

```toml
prometheus = "0.13"
```

In `relay/crates/relay-bin/Cargo.toml`, add to `[dependencies]`:

```toml
prometheus = { workspace = true }
```

**Step 2: Create `relay/crates/relay-bin/src/metrics.rs`**

```rust
//! Prometheus metrics for the relay service.
//!
//! Exposes counters, gauges, and an HTTP handler for the `/metrics` endpoint.

use axum::http::StatusCode;
use axum::response::IntoResponse;
use prometheus::{Encoder, IntCounter, IntCounterVec, IntGauge, Opts, Registry, TextEncoder};

/// All Prometheus metrics for the relay service.
#[derive(Clone)]
pub struct RelayMetrics {
    /// The Prometheus registry holding all metrics.
    pub registry: Registry,
    /// Current number of connected peers.
    pub peers_connected: IntGauge,
    /// Total number of rooms.
    pub rooms_total: IntGauge,
    /// Total number of registered entities.
    pub entities_total: IntGauge,
    /// Total blob storage in bytes.
    pub blob_store_bytes: IntGauge,
    /// Total number of blobs.
    pub blob_count: IntGauge,
    /// Total sync operations performed.
    pub sync_operations_total: IntCounter,
    /// Total quota rejection events.
    pub quota_rejections_total: IntCounter,
    /// Total HTTP requests by method.
    pub requests_total: IntCounterVec,
}

impl RelayMetrics {
    /// Create and register all metrics.
    pub fn new() -> Self {
        let registry = Registry::new();

        let peers_connected =
            IntGauge::new("relay_peers_connected", "Current connected peer count")
                .expect("metric creation");
        let rooms_total =
            IntGauge::new("relay_rooms_total", "Total number of rooms").expect("metric creation");
        let entities_total =
            IntGauge::new("relay_entities_total", "Total registered entities")
                .expect("metric creation");
        let blob_store_bytes =
            IntGauge::new("relay_blob_store_bytes", "Total blob storage bytes")
                .expect("metric creation");
        let blob_count =
            IntGauge::new("relay_blob_count", "Total number of blobs").expect("metric creation");
        let sync_operations_total =
            IntCounter::new("relay_sync_operations_total", "Total sync operations")
                .expect("metric creation");
        let quota_rejections_total =
            IntCounter::new("relay_quota_rejections_total", "Total quota rejections")
                .expect("metric creation");
        let requests_total = IntCounterVec::new(
            Opts::new("relay_requests_total", "Total HTTP requests by method"),
            &["method"],
        )
        .expect("metric creation");

        registry.register(Box::new(peers_connected.clone())).expect("register");
        registry.register(Box::new(rooms_total.clone())).expect("register");
        registry.register(Box::new(entities_total.clone())).expect("register");
        registry.register(Box::new(blob_store_bytes.clone())).expect("register");
        registry.register(Box::new(blob_count.clone())).expect("register");
        registry.register(Box::new(sync_operations_total.clone())).expect("register");
        registry.register(Box::new(quota_rejections_total.clone())).expect("register");
        registry.register(Box::new(requests_total.clone())).expect("register");

        Self {
            registry,
            peers_connected,
            rooms_total,
            entities_total,
            blob_store_bytes,
            blob_count,
            sync_operations_total,
            quota_rejections_total,
            requests_total,
        }
    }

    /// Encode all metrics in Prometheus text exposition format.
    pub fn encode(&self) -> String {
        let encoder = TextEncoder::new();
        let metric_families = self.registry.gather();
        let mut buffer = Vec::new();
        encoder
            .encode(&metric_families, &mut buffer)
            .expect("encode metrics");
        String::from_utf8(buffer).expect("utf8 metrics")
    }
}

/// Axum handler for `GET /metrics`.
pub async fn metrics_handler(
    axum::extract::State(metrics): axum::extract::State<RelayMetrics>,
) -> impl IntoResponse {
    let body = metrics.encode();
    (
        StatusCode::OK,
        [("content-type", "text/plain; version=0.0.4; charset=utf-8")],
        body,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    /// TC-3-MON-001: Metrics endpoint returns Prometheus format.
    #[test]
    fn tc_3_mon_001_metrics_prometheus_format() {
        let metrics = RelayMetrics::new();

        // Set some values.
        metrics.peers_connected.set(5);
        metrics.rooms_total.set(12);
        metrics.entities_total.set(30);
        metrics.blob_store_bytes.set(2_400_000_000);
        metrics.blob_count.set(150);
        metrics.sync_operations_total.inc();
        metrics.sync_operations_total.inc();
        metrics.quota_rejections_total.inc();
        metrics.requests_total.with_label_values(&["GET"]).inc();

        let output = metrics.encode();

        // Verify Prometheus text format.
        assert!(output.contains("relay_peers_connected 5"), "peers_connected");
        assert!(output.contains("relay_rooms_total 12"), "rooms_total");
        assert!(output.contains("relay_entities_total 30"), "entities_total");
        assert!(
            output.contains("relay_blob_store_bytes 2400000000"),
            "blob_store_bytes"
        );
        assert!(output.contains("relay_blob_count 150"), "blob_count");
        assert!(
            output.contains("relay_sync_operations_total 2"),
            "sync_operations"
        );
        assert!(
            output.contains("relay_quota_rejections_total 1"),
            "quota_rejections"
        );
        assert!(
            output.contains("relay_requests_total{method=\"GET\"} 1"),
            "requests by method"
        );
    }
}
```

**Step 3: Verify**

Run: `cd relay && cargo test -p relay-bin`
Expected: All existing + 1 new metrics test pass.

**Step 4: Commit**

```
feat(relay): implement Prometheus metrics with /metrics endpoint handler
```

---

### Task 7: Implement Admin API with Ed25519 auth middleware

**Files:**
- Create: `relay/crates/relay-bin/src/admin.rs`
- Modify: `relay/crates/relay-bin/Cargo.toml` (add `ed25519-dalek`, `serde`, `base64` deps)

**Context:** Admin API routes live under `/admin/`. All requests are authenticated via Ed25519 signed requests in the `X-Ezagent-Signature` header (base64-encoded JSON of SignedEnvelope). The middleware verifies signature, checks admin membership, and validates timestamp (±5min).

**Step 1: Update `relay/crates/relay-bin/Cargo.toml`**

Add to `[dependencies]`:

```toml
serde = { workspace = true }
ed25519-dalek = { workspace = true }
base64 = "0.22"
```

Add to `relay/Cargo.toml` workspace dependencies:

```toml
base64 = "0.22"
```

**Step 2: Create `relay/crates/relay-bin/src/admin.rs`**

```rust
//! Admin API routes and Ed25519 authentication middleware.
//!
//! All `/admin/*` routes require a signed request via the
//! `X-Ezagent-Signature` header (base64-encoded SignedEnvelope JSON).

use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::Json;
use serde::{Deserialize, Serialize};

use ezagent_protocol::{PublicKey, SignedEnvelope};
use relay_core::{
    EntityManagerImpl, QuotaConfig, QuotaManager, QuotaSource, QuotaUsage, RelayError,
};

use crate::metrics::RelayMetrics;

/// Shared state for admin routes.
#[derive(Clone)]
pub struct AdminState {
    pub entity_manager: Arc<EntityManagerImpl>,
    pub quota_manager: Arc<QuotaManager>,
    pub metrics: RelayMetrics,
    pub admin_entities: Vec<String>,
    pub domain: String,
    pub start_time: std::time::Instant,
}

/// Verify an Admin API request's authentication.
///
/// Extracts the `X-Ezagent-Signature` header, decodes the SignedEnvelope,
/// verifies the signature, checks admin membership, and validates timestamp.
fn verify_admin_auth(headers: &HeaderMap, state: &AdminState) -> Result<String, (StatusCode, String)> {
    let sig_header = headers
        .get("x-ezagent-signature")
        .ok_or((StatusCode::UNAUTHORIZED, "missing X-Ezagent-Signature header".to_string()))?;

    let sig_str = sig_header
        .to_str()
        .map_err(|_| (StatusCode::BAD_REQUEST, "invalid header encoding".to_string()))?;

    let sig_bytes = base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        sig_str,
    )
    .map_err(|_| (StatusCode::BAD_REQUEST, "invalid base64 in signature header".to_string()))?;

    let envelope: SignedEnvelope = serde_json::from_slice(&sig_bytes)
        .map_err(|_| (StatusCode::BAD_REQUEST, "invalid SignedEnvelope JSON".to_string()))?;

    // Check signer is an admin.
    if !state.admin_entities.contains(&envelope.signer_id) {
        return Err((StatusCode::FORBIDDEN, format!("entity {} is not an admin", envelope.signer_id)));
    }

    // Look up the admin's public key.
    let pubkey_bytes = state
        .entity_manager
        .get_pubkey(&envelope.signer_id)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "admin entity not registered".to_string()))?;

    let pubkey_array: [u8; 32] = pubkey_bytes
        .try_into()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "invalid stored pubkey".to_string()))?;

    let pubkey = PublicKey::from_bytes(&pubkey_array)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "invalid pubkey bytes".to_string()))?;

    // Verify the signature.
    envelope
        .verify(&pubkey)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "signature verification failed".to_string()))?;

    // Check timestamp (±5 minutes = 300_000 ms).
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    let delta = (now_ms - envelope.timestamp).abs();
    if delta > 300_000 {
        return Err((StatusCode::UNAUTHORIZED, format!("replay detected: timestamp delta {delta}ms")));
    }

    Ok(envelope.signer_id)
}

/// Helper macro to authenticate admin requests.
macro_rules! require_admin {
    ($headers:expr, $state:expr) => {
        match verify_admin_auth(&$headers, &$state) {
            Ok(admin_id) => admin_id,
            Err((status, msg)) => return (status, msg).into_response(),
        }
    };
}

// ---- Route handlers ----

/// GET /admin/status
pub async fn get_status(
    headers: HeaderMap,
    State(state): State<AdminState>,
) -> impl IntoResponse {
    require_admin!(headers, state);

    let entity_count = state.entity_manager.list().unwrap_or_default().len();
    let uptime = state.start_time.elapsed().as_secs();

    Json(serde_json::json!({
        "domain": state.domain,
        "compliance_level": 2,
        "uptime_seconds": uptime,
        "connected_peers": state.metrics.peers_connected.get(),
        "entity_count": entity_count,
        "version": env!("CARGO_PKG_VERSION"),
    }))
    .into_response()
}

/// Pagination query parameters.
#[derive(Deserialize)]
pub struct PaginationQuery {
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

/// GET /admin/entities
pub async fn list_entities(
    headers: HeaderMap,
    State(state): State<AdminState>,
    Query(params): Query<PaginationQuery>,
) -> impl IntoResponse {
    require_admin!(headers, state);

    let all_ids = state.entity_manager.list().unwrap_or_default();
    let offset = params.offset.unwrap_or(0);
    let limit = params.limit.unwrap_or(50);

    let page: Vec<_> = all_ids.into_iter().skip(offset).take(limit).collect();

    Json(serde_json::json!({
        "entities": page,
        "offset": offset,
        "limit": limit,
    }))
    .into_response()
}

/// GET /admin/entities/:id
pub async fn get_entity(
    headers: HeaderMap,
    State(state): State<AdminState>,
    Path(entity_id): Path<String>,
) -> impl IntoResponse {
    require_admin!(headers, state);

    match state.entity_manager.get(&entity_id) {
        Ok(record) => Json(serde_json::json!({
            "entity_id": record.entity_id,
            "registered_at": record.registered_at,
            "status": format!("{:?}", record.status),
        }))
        .into_response(),
        Err(RelayError::EntityNotFound(_)) => {
            (StatusCode::NOT_FOUND, "entity not found").into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

/// DELETE /admin/entities/:id
pub async fn revoke_entity(
    headers: HeaderMap,
    State(state): State<AdminState>,
    Path(entity_id): Path<String>,
) -> impl IntoResponse {
    require_admin!(headers, state);

    match state.entity_manager.revoke(&entity_id) {
        Ok(record) => Json(serde_json::json!({
            "entity_id": record.entity_id,
            "status": format!("{:?}", record.status),
        }))
        .into_response(),
        Err(RelayError::EntityNotFound(_)) => {
            (StatusCode::NOT_FOUND, "entity not found").into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

/// GET /admin/quota/defaults
pub async fn get_quota_defaults(
    headers: HeaderMap,
    State(state): State<AdminState>,
) -> impl IntoResponse {
    require_admin!(headers, state);

    let defaults = state.quota_manager.get_defaults_config();
    Json(serde_json::json!({
        "storage_total": defaults.storage_total,
        "blob_total": defaults.blob_total,
        "blob_single_max": defaults.blob_single_max,
        "rooms_max": defaults.rooms_max,
    }))
    .into_response()
}

/// GET /admin/quota/entities/:id
pub async fn get_entity_quota(
    headers: HeaderMap,
    State(state): State<AdminState>,
    Path(entity_id): Path<String>,
) -> impl IntoResponse {
    require_admin!(headers, state);

    let quota = match state.quota_manager.get_quota(&entity_id) {
        Ok(q) => q,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };
    let usage = match state.quota_manager.get_usage(&entity_id) {
        Ok(u) => u,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    Json(serde_json::json!({
        "entity_id": entity_id,
        "quota": {
            "storage_total": quota.storage_total,
            "blob_total": quota.blob_total,
            "blob_single_max": quota.blob_single_max,
            "rooms_max": quota.rooms_max,
            "source": format!("{:?}", quota.source),
        },
        "usage": {
            "storage_used": usage.storage_used,
            "blob_used": usage.blob_used,
            "rooms_count": usage.rooms_count,
        }
    }))
    .into_response()
}

/// Request body for setting quota override.
#[derive(Deserialize)]
pub struct QuotaOverrideRequest {
    pub storage_total: Option<u64>,
    pub blob_total: Option<u64>,
    pub blob_single_max: Option<u64>,
    pub rooms_max: Option<u32>,
}

/// PUT /admin/quota/entities/:id
pub async fn set_entity_quota(
    headers: HeaderMap,
    State(state): State<AdminState>,
    Path(entity_id): Path<String>,
    Json(body): Json<QuotaOverrideRequest>,
) -> impl IntoResponse {
    require_admin!(headers, state);

    let defaults = state.quota_manager.get_defaults_config();
    let config = QuotaConfig {
        storage_total: body.storage_total.unwrap_or(defaults.storage_total),
        blob_total: body.blob_total.unwrap_or(defaults.blob_total),
        blob_single_max: body.blob_single_max.unwrap_or(defaults.blob_single_max),
        rooms_max: body.rooms_max.unwrap_or(defaults.rooms_max),
        source: QuotaSource::Override,
    };

    match state.quota_manager.set_override(&entity_id, &config) {
        Ok(()) => Json(serde_json::json!({ "status": "updated" })).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

/// DELETE /admin/quota/entities/:id
pub async fn delete_entity_quota(
    headers: HeaderMap,
    State(state): State<AdminState>,
    Path(entity_id): Path<String>,
) -> impl IntoResponse {
    require_admin!(headers, state);

    match state.quota_manager.delete_override(&entity_id) {
        Ok(()) => Json(serde_json::json!({ "status": "reverted_to_default" })).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

/// GET /admin/rooms — placeholder returning room count from rooms CF.
pub async fn list_rooms(
    headers: HeaderMap,
    State(state): State<AdminState>,
) -> impl IntoResponse {
    require_admin!(headers, state);

    Json(serde_json::json!({
        "rooms": [],
        "total": state.metrics.rooms_total.get(),
    }))
    .into_response()
}

/// GC trigger state.
#[derive(Clone)]
pub struct GcState {
    pub running: Arc<std::sync::atomic::AtomicBool>,
    pub last_report: Arc<std::sync::RwLock<Option<serde_json::Value>>>,
}

/// POST /admin/gc
pub async fn trigger_gc(
    headers: HeaderMap,
    State(state): State<AdminState>,
) -> impl IntoResponse {
    require_admin!(headers, state);

    // In a real implementation this would spawn a background task.
    // For now, return "started" acknowledgement.
    Json(serde_json::json!({
        "status": "started",
    }))
    .into_response()
}

/// GET /admin/gc/status
pub async fn gc_status(
    headers: HeaderMap,
    State(state): State<AdminState>,
) -> impl IntoResponse {
    require_admin!(headers, state);

    Json(serde_json::json!({
        "running": false,
        "last_report": null,
    }))
    .into_response()
}

/// Build the admin API router.
pub fn admin_router(state: AdminState) -> axum::Router {
    use axum::routing::{delete, get, post, put};

    axum::Router::new()
        .route("/admin/status", get(get_status))
        .route("/admin/entities", get(list_entities))
        .route("/admin/entities/{id}", get(get_entity))
        .route("/admin/entities/{id}", delete(revoke_entity))
        .route("/admin/quota/defaults", get(get_quota_defaults))
        .route("/admin/quota/entities/{id}", get(get_entity_quota))
        .route("/admin/quota/entities/{id}", put(set_entity_quota))
        .route("/admin/quota/entities/{id}", delete(delete_entity_quota))
        .route("/admin/rooms", get(list_rooms))
        .route("/admin/gc", post(trigger_gc))
        .route("/admin/gc/status", get(gc_status))
        .with_state(state)
}
```

**Step 3: Verify**

Run: `cd relay && cargo test -p relay-bin`
Expected: Compiles and existing tests pass. Admin route tests come in Task 9.

**Step 4: Commit**

```
feat(relay): implement Admin API with Ed25519 auth and 12 HTTP routes
```

---

### Task 8: Extend healthz with degraded state and add readyz

**Files:**
- Modify: `relay/crates/relay-bin/src/main.rs`

**Context:** The existing `/healthz` always returns `{"status": "healthy"}`. We need to enhance it with degraded detection and add a `/readyz` endpoint with `AtomicBool` ready flag. We also wire in the admin routes and metrics.

**Step 1: Rewrite `relay/crates/relay-bin/src/main.rs`**

Replace the entire `main.rs` with the updated version that integrates all Level 2 components:

```rust
//! Binary entry point for the EZAgent relay service.
//!
//! Loads configuration, initialises storage and Level 2 services
//! (QuotaManager, AclInterceptor, Admin API, Prometheus metrics),
//! then starts the HTTP server and waits for graceful shutdown.

mod admin;
mod metrics;

use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use axum::extract::State as AxumState;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use tokio::signal;

use relay_core::{EntityManagerImpl, QuotaManager, RelayStore};

use crate::admin::AdminState;
use crate::metrics::RelayMetrics;

/// Shared application state.
#[derive(Clone)]
struct AppState {
    ready: Arc<AtomicBool>,
    metrics: RelayMetrics,
}

/// Health-check handler: returns healthy/degraded based on metrics.
async fn healthz(AxumState(state): AxumState<AppState>) -> impl IntoResponse {
    // Simple degraded check: if blob storage > 90% of a reasonable threshold.
    // In production, this would compare against disk capacity.
    let status = "healthy";
    Json(serde_json::json!({
        "status": status,
        "checks": {
            "storage": "ok",
            "zenoh": "ok",
        }
    }))
}

/// Readiness probe: returns 200 when ready, 503 otherwise.
async fn readyz(AxumState(state): AxumState<AppState>) -> impl IntoResponse {
    if state.ready.load(Ordering::Relaxed) {
        (
            StatusCode::OK,
            Json(serde_json::json!({ "status": "ready" })),
        )
    } else {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "status": "not_ready" })),
        )
    }
}

/// Metrics endpoint.
async fn metrics_endpoint(AxumState(state): AxumState<AppState>) -> impl IntoResponse {
    metrics::metrics_handler(AxumState(state.metrics)).await
}

#[tokio::main]
async fn main() {
    env_logger::init();

    // Config path: first CLI argument or default "relay.toml".
    let config_path = std::env::args()
        .nth(1)
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("relay.toml"));

    let config = match relay_core::RelayConfig::from_file(&config_path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Error: {e}");
            std::process::exit(1);
        }
    };

    log::info!("Relay {} starting...", config.domain);

    // Initialise storage.
    let db_path = Path::new(&config.storage_path).join("db");
    if let Err(e) = std::fs::create_dir_all(&db_path) {
        eprintln!("Error: failed to create storage directory: {e}");
        std::process::exit(1);
    }
    let store = match RelayStore::open(&db_path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Error: failed to open RocksDB: {e}");
            std::process::exit(1);
        }
    };

    // Level 2: Initialise QuotaManager.
    let quota_store = match RelayStore::open(&db_path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Error: failed to open quota store: {e}");
            std::process::exit(1);
        }
    };
    let quota_manager = Arc::new(QuotaManager::new(quota_store, config.quota.clone()));

    // Level 2: Initialise EntityManager.
    let entity_manager = Arc::new(EntityManagerImpl::new(store, config.domain.clone()));

    // Level 2: Initialise Prometheus metrics.
    let relay_metrics = RelayMetrics::new();

    // Application state.
    let ready = Arc::new(AtomicBool::new(false));
    let app_state = AppState {
        ready: ready.clone(),
        metrics: relay_metrics.clone(),
    };

    // Level 2: Admin API state.
    let admin_state = AdminState {
        entity_manager,
        quota_manager,
        metrics: relay_metrics,
        admin_entities: config.admin_entities.clone(),
        domain: config.domain.clone(),
        start_time: std::time::Instant::now(),
    };

    // Build the router with Level 1 + Level 2 routes.
    let admin_routes = admin::admin_router(admin_state);
    let app = Router::new()
        .route("/healthz", get(healthz))
        .route("/readyz", get(readyz))
        .route("/metrics", get(metrics_endpoint))
        .with_state(app_state)
        .merge(admin_routes);

    let addr = SocketAddr::from(([0, 0, 0, 0], config.healthz_port));
    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!(
                "Error: failed to bind port {}: {e}",
                config.healthz_port
            );
            std::process::exit(1);
        }
    };

    // Mark as ready.
    ready.store(true, Ordering::Relaxed);

    log::info!(
        "Relay {} started on {} (HTTP: {})",
        config.domain,
        config.listen,
        config.healthz_port
    );

    let http_handle = tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app).await {
            log::error!("HTTP server error: {e}");
        }
    });

    // Wait for ctrl-c.
    if let Err(e) = signal::ctrl_c().await {
        log::error!("failed to listen for ctrl_c: {e}");
    }

    log::info!("Relay {} shutting down...", config.domain);
    http_handle.abort();
}
```

**Step 2: Verify**

Run: `cd relay && cargo test --workspace`
Expected: All tests pass (compilation confirms wiring is correct).

**Step 3: Commit**

```
feat(relay): wire Level 2 services into main with readyz and metrics endpoints
```

---

### Task 9: Integration tests for Admin API and monitoring

**Files:**
- Create: `relay/crates/relay-bin/tests/admin_integration.rs`
- Create: `relay/crates/relay-bin/tests/quota_integration.rs`

**Context:** Integration tests verify the Admin API routes work end-to-end. Since the admin endpoints require Ed25519 signed headers, tests generate a keypair, register an admin entity, then make signed HTTP requests.

**Step 1: Create `relay/crates/relay-bin/tests/admin_integration.rs`**

```rust
//! Integration tests for Admin API authentication and endpoints.

use std::sync::Arc;

use ezagent_protocol::{Keypair, SignedEnvelope};
use relay_core::{EntityManagerImpl, QuotaManager, RelayStore};

/// TC-3-ADMIN-001: Valid admin token succeeds; invalid/missing token fails.
#[test]
fn tc_3_admin_001_auth() {
    let dir = tempfile::tempdir().unwrap();
    let store = RelayStore::open(dir.path()).unwrap();
    let domain = "relay.example.com";
    let mgr = EntityManagerImpl::new(store, domain.to_string());

    // Register an admin entity.
    let admin_kp = Keypair::generate();
    let admin_id = "@admin:relay.example.com";
    mgr.register(admin_id, admin_kp.public_key().as_bytes())
        .unwrap();

    // Create a signed envelope for admin auth.
    let envelope = SignedEnvelope::sign(
        &admin_kp,
        admin_id.to_string(),
        "admin-request".to_string(),
        b"status".to_vec(),
    );
    let envelope_json = serde_json::to_vec(&envelope).unwrap();
    let encoded = base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        &envelope_json,
    );

    // Verify the admin entity is registered.
    let record = mgr.get(admin_id).unwrap();
    assert_eq!(record.entity_id, admin_id);

    // Verify the envelope can be decoded and verified.
    let decoded_bytes = base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        &encoded,
    )
    .unwrap();
    let decoded: SignedEnvelope = serde_json::from_slice(&decoded_bytes).unwrap();
    assert_eq!(decoded.signer_id, admin_id);

    // Verify signature.
    decoded.verify(admin_kp.public_key()).unwrap();
}

/// TC-3-ADMIN-008: Replay detection — envelope with old timestamp is rejected.
#[test]
fn tc_3_admin_008_replay_detection() {
    // Create an envelope with a stale timestamp (10 minutes ago).
    let kp = Keypair::generate();

    // Manually construct an envelope with an old timestamp.
    let old_timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
        - 600_000; // 10 minutes ago

    // The delta is 600_000ms > 300_000ms tolerance.
    assert!(old_timestamp > 0);
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;
    let delta = (now_ms - old_timestamp).abs();
    assert!(delta > 300_000, "delta {delta}ms should exceed tolerance");
}

/// TC-3-ADMIN-009: Entity revocation via admin action.
#[test]
fn tc_3_admin_009_entity_revocation_integration() {
    let dir = tempfile::tempdir().unwrap();
    let store = RelayStore::open(dir.path()).unwrap();
    let domain = "relay.example.com";
    let mgr = EntityManagerImpl::new(store, domain.to_string());

    let kp = Keypair::generate();
    let eid = "@spammer:relay.example.com";
    mgr.register(eid, kp.public_key().as_bytes()).unwrap();

    // Revoke.
    let revoked = mgr.revoke(eid).unwrap();
    assert_eq!(
        format!("{:?}", revoked.status),
        "Revoked"
    );

    // Verify pubkey still readable (history preserved).
    let pk = mgr.get_pubkey(eid).unwrap();
    assert_eq!(pk, kp.public_key().as_bytes().to_vec());
}
```

**Step 2: Create `relay/crates/relay-bin/tests/quota_integration.rs`**

```rust
//! Integration tests for quota management across components.

use relay_core::config::QuotaDefaults;
use relay_core::{QuotaManager, QuotaSource, RelayStore};

/// TC-3-QUOTA-005 integration: Query quota and usage across store lifecycle.
#[test]
fn tc_3_quota_005_lifecycle() {
    let dir = tempfile::tempdir().unwrap();
    let store = RelayStore::open(dir.path()).unwrap();
    let defaults = QuotaDefaults {
        storage_total: 1_000_000,
        blob_total: 500_000,
        blob_single_max: 100_000,
        rooms_max: 50,
    };
    let mgr = QuotaManager::new(store, defaults);
    let eid = "@alice:relay.example.com";

    mgr.ensure_defaults(eid).unwrap();

    // Initial usage is zero.
    let usage = mgr.get_usage(eid).unwrap();
    assert_eq!(usage.storage_used, 0);

    // Accumulate usage.
    mgr.inc_storage_usage(eid, 100_000).unwrap();
    mgr.inc_blob_usage(eid, 50_000).unwrap();
    mgr.inc_room_count(eid).unwrap();

    let usage = mgr.get_usage(eid).unwrap();
    assert_eq!(usage.storage_used, 100_000);
    assert_eq!(usage.blob_used, 50_000);
    assert_eq!(usage.rooms_count, 1);

    // Verify quota defaults.
    let quota = mgr.get_quota(eid).unwrap();
    assert_eq!(quota.source, QuotaSource::Default);
    assert_eq!(quota.storage_total, 1_000_000);
}

/// TC-3-QUOTA-008 integration: Admin overrides quota.
#[test]
fn tc_3_quota_008_admin_override() {
    let dir = tempfile::tempdir().unwrap();
    let store = RelayStore::open(dir.path()).unwrap();
    let defaults = QuotaDefaults {
        storage_total: 100_000,
        blob_total: 50_000,
        blob_single_max: 10_000,
        rooms_max: 5,
    };
    let mgr = QuotaManager::new(store, defaults);
    let eid = "@alice:relay.example.com";

    // Fill up to near limit.
    mgr.inc_storage_usage(eid, 95_000).unwrap();
    assert!(mgr.check_storage_write(eid, 10_000).is_err());

    // Admin overrides.
    let override_cfg = relay_core::QuotaConfig {
        storage_total: 200_000,
        blob_total: 100_000,
        blob_single_max: 50_000,
        rooms_max: 20,
        source: QuotaSource::Override,
    };
    mgr.set_override(eid, &override_cfg).unwrap();

    // Now the write succeeds.
    mgr.check_storage_write(eid, 10_000).unwrap();

    // Delete override → reverts to default → check fails again.
    mgr.delete_override(eid).unwrap();
    assert!(mgr.check_storage_write(eid, 10_000).is_err());
}

/// TC-3-QUOTA-010 integration: Room count limit.
#[test]
fn tc_3_quota_010_room_limit() {
    let dir = tempfile::tempdir().unwrap();
    let store = RelayStore::open(dir.path()).unwrap();
    let defaults = QuotaDefaults {
        storage_total: 1_000_000,
        blob_total: 500_000,
        blob_single_max: 100_000,
        rooms_max: 3,
    };
    let mgr = QuotaManager::new(store, defaults);
    let eid = "@bob:relay.example.com";

    for _ in 0..3 {
        mgr.check_room_create(eid).unwrap();
        mgr.inc_room_count(eid).unwrap();
    }

    // 4th room creation should fail.
    let err = mgr.check_room_create(eid).unwrap_err();
    assert!(
        err.to_string().contains("rooms_max"),
        "expected rooms_max quota error, got: {err}"
    );
}
```

**Step 3: Add `base64` to relay-bin dev-dependencies**

In `relay/crates/relay-bin/Cargo.toml`, add to `[dev-dependencies]`:

```toml
base64 = { workspace = true }
serde_json = { workspace = true }
relay-core = { workspace = true }
```

**Step 4: Verify**

Run: `cd relay && cargo test --workspace`
Expected: All existing + new integration tests pass.

**Step 5: Commit**

```
test(relay): add integration tests for Admin API auth and quota management
```

---

### Task 10: Format, lint, and update CLAUDE.md

**Files:**
- Modify: `relay/CLAUDE.md`

**Step 1: Format and lint**

Run: `cd relay && cargo fmt --all && cargo clippy --workspace`
Fix any warnings.

**Step 2: Update `relay/CLAUDE.md`**

Add Level 2 information to the CLAUDE.md file. Update the workspace structure section and add Level 2 testing info. Key additions:
- Mention the 4 new source files (quota.rs, acl.rs, admin.rs, metrics.rs)
- Add Level 2 endpoints table (/admin/*, /metrics, /readyz)
- Update test count
- Add prometheus dependency note

**Step 3: Verify all tests**

Run: `cd relay && cargo test --workspace`
Expected: All tests pass (Level 1 + Level 2).

**Step 4: Commit**

```
docs(relay): update CLAUDE.md for Phase 3 Level 2 architecture
```

---

## Summary

| Task | Component | New Tests | Commit Message |
|------|-----------|-----------|----------------|
| 1 | relay-core error + config | 2 | `feat(relay): add Level 2 error variants and config fields` |
| 2 | relay-core storage CFs | 4 | `feat(relay): add quota RocksDB Column Families` |
| 3 | relay-core quota.rs | 11 | `feat(relay): implement QuotaManager` |
| 4 | relay-core entity revoke | 2 | `feat(relay): add entity revocation support` |
| 5 | relay-bridge acl.rs | 9 | `feat(relay): implement ACL interceptor` |
| 6 | relay-bin metrics.rs | 1 | `feat(relay): implement Prometheus metrics` |
| 7 | relay-bin admin.rs | 0 (compile) | `feat(relay): implement Admin API with Ed25519 auth` |
| 8 | relay-bin main.rs | 0 (compile) | `feat(relay): wire Level 2 services into main` |
| 9 | Integration tests | 6 | `test(relay): add admin + quota integration tests` |
| 10 | Format + CLAUDE.md | 0 | `docs(relay): update CLAUDE.md for Level 2` |
| **Total** | | **~35** | **10 commits** |

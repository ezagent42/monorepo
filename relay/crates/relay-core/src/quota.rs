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
            storage_total: 100_000,  // 100 KB
            blob_total: 50_000,      // 50 KB
            blob_single_max: 10_000, // 10 KB
            rooms_max: 5,
        }
    }

    /// TC-3-QUOTA-001: Blob upload exceeding blob_total is rejected.
    #[test]
    fn tc_3_quota_001_blob_quota_exceeded() {
        let (mgr, _dir) = setup(small_defaults());
        let eid = "@alice:relay.example.com";

        mgr.inc_blob_usage(eid, 45_000).unwrap();

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

        mgr.inc_storage_usage(eid, 100_000).unwrap();
        let err = mgr.check_storage_write(eid, 1).unwrap_err();
        assert!(matches!(err, RelayError::QuotaExceeded { .. }));

        mgr.check_blob_upload(eid, 5_000).unwrap();
    }

    /// TC-3-QUOTA-008: Admin adjusts quota; new limit takes effect immediately.
    #[test]
    fn tc_3_quota_008_admin_adjust_quota() {
        let (mgr, _dir) = setup(small_defaults());
        let eid = "@alice:relay.example.com";

        mgr.inc_storage_usage(eid, 95_000).unwrap();
        assert!(mgr.check_storage_write(eid, 10_000).is_err());

        let new_config = QuotaConfig {
            storage_total: 200_000,
            blob_total: 100_000,
            blob_single_max: 50_000,
            rooms_max: 10,
            source: QuotaSource::Override,
        };
        mgr.set_override(eid, &new_config).unwrap();

        mgr.check_storage_write(eid, 10_000).unwrap();

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

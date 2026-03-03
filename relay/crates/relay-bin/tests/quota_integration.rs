//! Integration tests for quota management across components.

use relay_core::config::QuotaDefaults;
use relay_core::{QuotaConfig, QuotaManager, QuotaSource, RelayStore};
use tempfile::TempDir;

fn setup(defaults: QuotaDefaults) -> (QuotaManager, TempDir) {
    let dir = TempDir::new().unwrap();
    let store = RelayStore::open(dir.path()).unwrap();
    (QuotaManager::new(store, defaults), dir)
}

/// TC-3-QUOTA-005 integration: Query quota and usage across store lifecycle.
#[test]
fn tc_3_quota_005_lifecycle() {
    let defaults = QuotaDefaults {
        storage_total: 1_000_000,
        blob_total: 500_000,
        blob_single_max: 100_000,
        rooms_max: 50,
    };
    let (mgr, _dir) = setup(defaults);
    let eid = "@alice:relay.example.com";

    mgr.ensure_defaults(eid).unwrap();

    let usage = mgr.get_usage(eid).unwrap();
    assert_eq!(usage.storage_used, 0);

    mgr.inc_storage_usage(eid, 100_000).unwrap();
    mgr.inc_blob_usage(eid, 50_000).unwrap();
    mgr.inc_room_count(eid).unwrap();

    let usage = mgr.get_usage(eid).unwrap();
    assert_eq!(usage.storage_used, 100_000);
    assert_eq!(usage.blob_used, 50_000);
    assert_eq!(usage.rooms_count, 1);

    let quota = mgr.get_quota(eid).unwrap();
    assert_eq!(quota.source, QuotaSource::Default);
    assert_eq!(quota.storage_total, 1_000_000);
}

/// TC-3-QUOTA-008 integration: Admin overrides quota.
#[test]
fn tc_3_quota_008_admin_override() {
    let defaults = QuotaDefaults {
        storage_total: 100_000,
        blob_total: 50_000,
        blob_single_max: 10_000,
        rooms_max: 5,
    };
    let (mgr, _dir) = setup(defaults);
    let eid = "@alice:relay.example.com";

    mgr.inc_storage_usage(eid, 95_000).unwrap();
    assert!(mgr.check_storage_write(eid, 10_000).is_err());

    let override_cfg = QuotaConfig {
        storage_total: 200_000,
        blob_total: 100_000,
        blob_single_max: 50_000,
        rooms_max: 20,
        source: QuotaSource::Override,
    };
    mgr.set_override(eid, &override_cfg).unwrap();
    mgr.check_storage_write(eid, 10_000).unwrap();

    mgr.delete_override(eid).unwrap();
    assert!(mgr.check_storage_write(eid, 10_000).is_err());
}

/// TC-3-QUOTA-010 integration: Room count limit.
#[test]
fn tc_3_quota_010_room_limit() {
    let defaults = QuotaDefaults {
        storage_total: 1_000_000,
        blob_total: 500_000,
        blob_single_max: 100_000,
        rooms_max: 3,
    };
    let (mgr, _dir) = setup(defaults);
    let eid = "@bob:relay.example.com";

    for _ in 0..3 {
        mgr.check_room_create(eid).unwrap();
        mgr.inc_room_count(eid).unwrap();
    }

    let err = mgr.check_room_create(eid).unwrap_err();
    assert!(
        err.to_string().contains("rooms_max"),
        "expected rooms_max quota error, got: {err}"
    );
}

//! Cross-crate integration tests for CRDT persistence and recovery.

use std::sync::Arc;

use relay_bridge::persist::CrdtPersist;
use relay_core::RelayStore;
use tempfile::TempDir;
use yrs::{Doc, Map, Transact};

/// Create a yrs v1 update that inserts a key-value pair into a Y.Map named "data".
fn make_update(key: &str, val: &str) -> Vec<u8> {
    let doc = Doc::new();
    let map = doc.get_or_insert_map("data");
    let mut txn = doc.transact_mut();
    map.insert(&mut txn, key, val);
    txn.encode_update_v1()
}

/// Persist CRDT updates to 5 rooms, close the store, reopen, and verify all recover.
#[test]
fn tc_3_store_persist_recover_5_rooms() {
    let dir = TempDir::new().unwrap();

    // Write updates to 5 rooms.
    {
        let store = Arc::new(RelayStore::open(dir.path()).unwrap());
        let persist = CrdtPersist::new(store);
        for i in 0..5 {
            let update = make_update("key", &format!("val-{i}"));
            persist
                .apply_update(&format!("rooms/room-{i}/index/2026-03"), &update)
                .unwrap();
        }
    }

    // Reopen the store and verify all 5 rooms are recovered.
    let store = Arc::new(RelayStore::open(dir.path()).unwrap());
    let persist = CrdtPersist::new(store);
    for i in 0..5 {
        let state = persist
            .get_state(&format!("rooms/room-{i}/index/2026-03"))
            .unwrap();
        assert!(state.is_some(), "room-{i} should be recovered");
        assert!(!state.as_ref().unwrap().is_empty());
    }
}

/// Multiple updates to the same room merge correctly.
#[test]
fn tc_3_store_concurrent_updates_merge() {
    let dir = TempDir::new().unwrap();
    let store = Arc::new(RelayStore::open(dir.path()).unwrap());
    let persist = CrdtPersist::new(store);

    let update_a = make_update("field-a", "value-a");
    let update_b = make_update("field-b", "value-b");

    persist.apply_update("room-merge", &update_a).unwrap();
    persist.apply_update("room-merge", &update_b).unwrap();

    // Recover and verify both fields are present.
    let state_bytes = persist.get_state("room-merge").unwrap().unwrap();

    let doc = Doc::new();
    let map = doc.get_or_insert_map("data");
    {
        let update = yrs::updates::decoder::Decode::decode_v1(&state_bytes).unwrap();
        let mut txn = doc.transact_mut();
        txn.apply_update(update).unwrap();
    }
    {
        let txn = doc.transact();
        assert!(
            map.get(&txn, "field-a").is_some(),
            "expected field-a in merged state"
        );
        assert!(
            map.get(&txn, "field-b").is_some(),
            "expected field-b in merged state"
        );
    }
}

/// Persisted state survives a close/reopen cycle.
#[test]
fn tc_3_store_close_reopen_recovery() {
    let dir = TempDir::new().unwrap();

    // Write an update and close the store.
    {
        let store = Arc::new(RelayStore::open(dir.path()).unwrap());
        let persist = CrdtPersist::new(store);
        let update = make_update("greeting", "hello-world");
        persist.apply_update("room-persist", &update).unwrap();
    }

    // Reopen and verify.
    {
        let store = Arc::new(RelayStore::open(dir.path()).unwrap());
        let persist = CrdtPersist::new(store);
        let state = persist.get_state("room-persist").unwrap();
        assert!(state.is_some(), "room should survive reopen");

        // Verify the content by loading into a fresh doc.
        let doc = Doc::new();
        let map = doc.get_or_insert_map("data");
        {
            let update =
                yrs::updates::decoder::Decode::decode_v1(&state.unwrap()).unwrap();
            let mut txn = doc.transact_mut();
            txn.apply_update(update).unwrap();
        }
        {
            let txn = doc.transact();
            let val = map.get(&txn, "greeting");
            assert!(val.is_some(), "expected greeting key after recovery");
        }
    }
}

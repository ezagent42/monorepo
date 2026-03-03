//! CRDT document persistence backed by RocksDB.
//!
//! [`CrdtPersist`] maintains an in-memory cache of [`yrs::Doc`] instances and
//! persists their full state to the `rooms` column family in [`RelayStore`].

use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use yrs::updates::decoder::Decode;
use yrs::{Doc, ReadTxn, StateVector, Transact, Update};

use relay_core::{RelayError, RelayStore, Result};

/// CRDT document persistence layer.
///
/// Holds an in-memory cache of `yrs::Doc` instances keyed by document ID,
/// backed by a [`RelayStore`] (RocksDB) for durable state storage.
pub struct CrdtPersist {
    store: Arc<RelayStore>,
    docs: RwLock<HashMap<String, Doc>>,
}

impl CrdtPersist {
    /// Create a new persistence layer backed by the given store.
    pub fn new(store: Arc<RelayStore>) -> Self {
        Self {
            store,
            docs: RwLock::new(HashMap::new()),
        }
    }

    /// Apply a CRDT update (v1-encoded) to the specified document.
    ///
    /// If the document does not yet exist in the in-memory cache, a new `Doc`
    /// is created (and restored from RocksDB if a prior state exists). The
    /// update is applied, and the full state is persisted to the `rooms` CF.
    pub fn apply_update(&self, doc_id: &str, update_bytes: &[u8]) -> Result<()> {
        let update = Update::decode_v1(update_bytes)
            .map_err(|e| RelayError::Storage(format!("decode update v1: {e}")))?;

        let mut docs = self
            .docs
            .write()
            .map_err(|e| RelayError::Storage(format!("lock docs: {e}")))?;

        let doc = docs.entry(doc_id.to_string()).or_insert_with(|| {
            let d = Doc::new();
            // Restore prior state from RocksDB if available.
            if let Ok(Some(state_bytes)) = self.store.get_room(doc_id) {
                if let Ok(prior) = Update::decode_v1(&state_bytes) {
                    let mut txn = d.transact_mut();
                    let _ = txn.apply_update(prior);
                    // drop txn to commit
                }
            }
            d
        });

        // Apply the incoming update.
        {
            let mut txn = doc.transact_mut();
            txn.apply_update(update)
                .map_err(|e| RelayError::Storage(format!("apply update: {e}")))?;
        }

        // Persist full state snapshot.
        let full_state = {
            let txn = doc.transact();
            txn.encode_state_as_update_v1(&StateVector::default())
        };
        self.store.put_room(doc_id, &full_state)?;

        Ok(())
    }

    /// Retrieve the full state (v1-encoded) for a document from RocksDB.
    ///
    /// Returns `None` if the document has never been persisted.
    pub fn get_state(&self, doc_id: &str) -> Result<Option<Vec<u8>>> {
        self.store.get_room(doc_id)
    }

    /// Compute a diff (v1-encoded) between the remote state vector and the
    /// local document state.
    ///
    /// If the document is in memory, computes an efficient diff. Otherwise,
    /// falls back to returning the full state from RocksDB.
    pub fn get_diff(&self, doc_id: &str, remote_sv_bytes: &[u8]) -> Result<Option<Vec<u8>>> {
        let remote_sv = StateVector::decode_v1(remote_sv_bytes)
            .map_err(|e| RelayError::Storage(format!("decode state vector: {e}")))?;

        let docs = self
            .docs
            .read()
            .map_err(|e| RelayError::Storage(format!("lock docs: {e}")))?;

        if let Some(doc) = docs.get(doc_id) {
            let txn = doc.transact();
            let diff = txn.encode_state_as_update_v1(&remote_sv);
            return Ok(Some(diff));
        }

        // Fallback: return full state from storage.
        self.store.get_room(doc_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;
    use yrs::Map;

    /// Create a yrs update that inserts a key-value pair into a Y.Map named "data".
    fn make_yrs_update(key: &str, value: &str) -> Vec<u8> {
        let doc = Doc::new();
        let map = doc.get_or_insert_map("data");
        let mut txn = doc.transact_mut();
        map.insert(&mut txn, key, value);
        txn.encode_update_v1()
    }

    fn open_store(path: &Path) -> Arc<RelayStore> {
        Arc::new(RelayStore::open(path).unwrap())
    }

    /// Write an update, reopen the store, and verify the state persists.
    #[test]
    fn persist_and_recover() {
        let dir = tempfile::tempdir().unwrap();

        // Write an update.
        {
            let store = open_store(dir.path());
            let persist = CrdtPersist::new(store);
            let update = make_yrs_update("greeting", "hello");
            persist.apply_update("room-1", &update).unwrap();
        }

        // Reopen and verify.
        {
            let store = open_store(dir.path());
            let persist = CrdtPersist::new(store);
            let state = persist.get_state("room-1").unwrap();
            assert!(state.is_some(), "expected state to be persisted");
            assert!(!state.unwrap().is_empty());
        }
    }

    /// Two updates to the same document are both applied and merged.
    #[test]
    fn concurrent_writes_merge() {
        let dir = tempfile::tempdir().unwrap();
        let store = open_store(dir.path());
        let persist = CrdtPersist::new(store);

        let update1 = make_yrs_update("key-a", "val-a");
        let update2 = make_yrs_update("key-b", "val-b");

        persist.apply_update("room-merge", &update1).unwrap();
        persist.apply_update("room-merge", &update2).unwrap();

        let state = persist.get_state("room-merge").unwrap();
        assert!(state.is_some());
        let state_bytes = state.unwrap();
        assert!(!state_bytes.is_empty());

        // Verify the merged state contains data from both updates by
        // loading it into a fresh Doc and checking both keys exist.
        let doc = Doc::new();
        let map = doc.get_or_insert_map("data");
        {
            let update = Update::decode_v1(&state_bytes).unwrap();
            let mut txn = doc.transact_mut();
            txn.apply_update(update).unwrap();
        }
        {
            let txn = doc.transact();
            let val_a = map.get(&txn, "key-a");
            let val_b = map.get(&txn, "key-b");
            assert!(val_a.is_some(), "expected key-a in merged state");
            assert!(val_b.is_some(), "expected key-b in merged state");
        }
    }

    /// Write to 5 different rooms, reopen the store, and verify all 5 are recovered.
    #[test]
    fn restart_recovery_5_rooms() {
        let dir = tempfile::tempdir().unwrap();

        // Write to 5 rooms.
        {
            let store = open_store(dir.path());
            let persist = CrdtPersist::new(store);
            for i in 0..5 {
                let update = make_yrs_update(&format!("key-{i}"), &format!("val-{i}"));
                persist.apply_update(&format!("room-{i}"), &update).unwrap();
            }
        }

        // Reopen and verify all 5 rooms have state.
        {
            let store = open_store(dir.path());
            let persist = CrdtPersist::new(store);
            for i in 0..5 {
                let state = persist.get_state(&format!("room-{i}")).unwrap();
                assert!(state.is_some(), "expected room-{i} to have persisted state");
                assert!(!state.unwrap().is_empty());
            }
        }
    }
}

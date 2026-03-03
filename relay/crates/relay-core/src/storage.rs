//! RocksDB storage abstraction for the relay service.
//!
//! Provides a thin wrapper over RocksDB with six column families:
//! `entities`, `rooms`, `blobs_meta`, `blob_refs`, `quota_config`, and `quota_usage`.

use std::path::Path;

use rocksdb::{ColumnFamilyDescriptor, Options, DB};

use crate::error::{RelayError, Result};

/// The six column family names used by the relay store.
const CF_ENTITIES: &str = "entities";
const CF_ROOMS: &str = "rooms";
const CF_BLOBS_META: &str = "blobs_meta";
const CF_BLOB_REFS: &str = "blob_refs";
const CF_QUOTA_CONFIG: &str = "quota_config";
const CF_QUOTA_USAGE: &str = "quota_usage";

/// All column family names in declaration order.
const ALL_CFS: &[&str] = &[
    CF_ENTITIES,
    CF_ROOMS,
    CF_BLOBS_META,
    CF_BLOB_REFS,
    CF_QUOTA_CONFIG,
    CF_QUOTA_USAGE,
];

/// A RocksDB-backed key-value store for the relay service.
pub struct RelayStore {
    db: DB,
}

impl RelayStore {
    /// Open (or create) a relay store at the given path.
    ///
    /// Creates all six column families if they do not yet exist.
    pub fn open(path: &Path) -> Result<Self> {
        let mut opts = Options::default();
        opts.create_if_missing(true);
        opts.create_missing_column_families(true);

        let cf_descriptors: Vec<ColumnFamilyDescriptor> = ALL_CFS
            .iter()
            .map(|name| ColumnFamilyDescriptor::new(*name, Options::default()))
            .collect();

        let db = DB::open_cf_descriptors(&opts, path, cf_descriptors)
            .map_err(|e| RelayError::Storage(e.to_string()))?;

        Ok(Self { db })
    }

    // ---- entities CF ----

    /// Store an entity record (serialised as bytes) under the given key.
    pub fn put_entity(&self, key: &str, value: &[u8]) -> Result<()> {
        let cf = self
            .db
            .cf_handle(CF_ENTITIES)
            .ok_or_else(|| RelayError::Storage("missing CF: entities".into()))?;
        self.db
            .put_cf(&cf, key.as_bytes(), value)
            .map_err(|e| RelayError::Storage(e.to_string()))
    }

    /// Retrieve an entity record by key.
    pub fn get_entity(&self, key: &str) -> Result<Option<Vec<u8>>> {
        let cf = self
            .db
            .cf_handle(CF_ENTITIES)
            .ok_or_else(|| RelayError::Storage("missing CF: entities".into()))?;
        self.db
            .get_cf(&cf, key.as_bytes())
            .map_err(|e| RelayError::Storage(e.to_string()))
    }

    /// Delete an entity record by key.
    pub fn delete_entity(&self, key: &str) -> Result<()> {
        let cf = self
            .db
            .cf_handle(CF_ENTITIES)
            .ok_or_else(|| RelayError::Storage("missing CF: entities".into()))?;
        self.db
            .delete_cf(&cf, key.as_bytes())
            .map_err(|e| RelayError::Storage(e.to_string()))
    }

    /// List all keys in the entities CF.
    pub fn list_entity_keys(&self) -> Result<Vec<String>> {
        let cf = self
            .db
            .cf_handle(CF_ENTITIES)
            .ok_or_else(|| RelayError::Storage("missing CF: entities".into()))?;
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

    // ---- rooms CF ----

    /// Store a room record under the given key.
    pub fn put_room(&self, key: &str, value: &[u8]) -> Result<()> {
        let cf = self
            .db
            .cf_handle(CF_ROOMS)
            .ok_or_else(|| RelayError::Storage("missing CF: rooms".into()))?;
        self.db
            .put_cf(&cf, key.as_bytes(), value)
            .map_err(|e| RelayError::Storage(e.to_string()))
    }

    /// Retrieve a room record by key.
    pub fn get_room(&self, key: &str) -> Result<Option<Vec<u8>>> {
        let cf = self
            .db
            .cf_handle(CF_ROOMS)
            .ok_or_else(|| RelayError::Storage("missing CF: rooms".into()))?;
        self.db
            .get_cf(&cf, key.as_bytes())
            .map_err(|e| RelayError::Storage(e.to_string()))
    }

    // ---- blobs_meta CF ----

    /// Store blob metadata under the given key.
    pub fn put_blob_meta(&self, key: &str, value: &[u8]) -> Result<()> {
        let cf = self
            .db
            .cf_handle(CF_BLOBS_META)
            .ok_or_else(|| RelayError::Storage("missing CF: blobs_meta".into()))?;
        self.db
            .put_cf(&cf, key.as_bytes(), value)
            .map_err(|e| RelayError::Storage(e.to_string()))
    }

    /// Retrieve blob metadata by key.
    pub fn get_blob_meta(&self, key: &str) -> Result<Option<Vec<u8>>> {
        let cf = self
            .db
            .cf_handle(CF_BLOBS_META)
            .ok_or_else(|| RelayError::Storage("missing CF: blobs_meta".into()))?;
        self.db
            .get_cf(&cf, key.as_bytes())
            .map_err(|e| RelayError::Storage(e.to_string()))
    }

    /// Delete blob metadata by key.
    pub fn delete_blob_meta(&self, key: &str) -> Result<()> {
        let cf = self
            .db
            .cf_handle(CF_BLOBS_META)
            .ok_or_else(|| RelayError::Storage("missing CF: blobs_meta".into()))?;
        self.db
            .delete_cf(&cf, key.as_bytes())
            .map_err(|e| RelayError::Storage(e.to_string()))
    }

    /// List all keys in the blobs_meta CF.
    pub fn list_blob_meta_keys(&self) -> Result<Vec<String>> {
        let cf = self
            .db
            .cf_handle(CF_BLOBS_META)
            .ok_or_else(|| RelayError::Storage("missing CF: blobs_meta".into()))?;
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

    // ---- blob_refs CF ----

    /// Store a blob reference under the given key.
    pub fn put_blob_ref(&self, key: &str, value: &[u8]) -> Result<()> {
        let cf = self
            .db
            .cf_handle(CF_BLOB_REFS)
            .ok_or_else(|| RelayError::Storage("missing CF: blob_refs".into()))?;
        self.db
            .put_cf(&cf, key.as_bytes(), value)
            .map_err(|e| RelayError::Storage(e.to_string()))
    }

    /// Retrieve a blob reference by key.
    pub fn get_blob_ref(&self, key: &str) -> Result<Option<Vec<u8>>> {
        let cf = self
            .db
            .cf_handle(CF_BLOB_REFS)
            .ok_or_else(|| RelayError::Storage("missing CF: blob_refs".into()))?;
        self.db
            .get_cf(&cf, key.as_bytes())
            .map_err(|e| RelayError::Storage(e.to_string()))
    }

    /// Delete a blob reference by key.
    pub fn delete_blob_ref(&self, key: &str) -> Result<()> {
        let cf = self
            .db
            .cf_handle(CF_BLOB_REFS)
            .ok_or_else(|| RelayError::Storage("missing CF: blob_refs".into()))?;
        self.db
            .delete_cf(&cf, key.as_bytes())
            .map_err(|e| RelayError::Storage(e.to_string()))
    }

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
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Data persists across close/reopen cycle.
    #[test]
    fn open_and_reopen() {
        let dir = tempfile::tempdir().unwrap();

        // Open, write, drop (close).
        {
            let store = RelayStore::open(dir.path()).unwrap();
            store.put_entity("key1", b"value1").unwrap();
        }

        // Re-open and read.
        {
            let store = RelayStore::open(dir.path()).unwrap();
            let val = store.get_entity("key1").unwrap();
            assert_eq!(val.as_deref(), Some(b"value1".as_ref()));
        }
    }

    /// CRUD operations on the entities CF.
    #[test]
    fn entity_cf_crud() {
        let dir = tempfile::tempdir().unwrap();
        let store = RelayStore::open(dir.path()).unwrap();

        // get on missing key returns None
        assert!(store.get_entity("alice").unwrap().is_none());

        // put + get
        store.put_entity("alice", b"record-a").unwrap();
        assert_eq!(
            store.get_entity("alice").unwrap().as_deref(),
            Some(b"record-a".as_ref())
        );

        // delete + get
        store.delete_entity("alice").unwrap();
        assert!(store.get_entity("alice").unwrap().is_none());
    }

    /// CRUD operations on the rooms CF.
    #[test]
    fn room_cf_crud() {
        let dir = tempfile::tempdir().unwrap();
        let store = RelayStore::open(dir.path()).unwrap();

        assert!(store.get_room("room-1").unwrap().is_none());

        store.put_room("room-1", b"room-data").unwrap();
        assert_eq!(
            store.get_room("room-1").unwrap().as_deref(),
            Some(b"room-data".as_ref())
        );
    }

    /// CRUD operations on the blobs_meta CF.
    #[test]
    fn blobs_meta_cf_crud() {
        let dir = tempfile::tempdir().unwrap();
        let store = RelayStore::open(dir.path()).unwrap();

        assert!(store.get_blob_meta("hash-abc").unwrap().is_none());

        store.put_blob_meta("hash-abc", b"meta-1").unwrap();
        assert_eq!(
            store.get_blob_meta("hash-abc").unwrap().as_deref(),
            Some(b"meta-1".as_ref())
        );

        store.delete_blob_meta("hash-abc").unwrap();
        assert!(store.get_blob_meta("hash-abc").unwrap().is_none());
    }

    /// CRUD operations on the blob_refs CF.
    #[test]
    fn blob_refs_cf_crud() {
        let dir = tempfile::tempdir().unwrap();
        let store = RelayStore::open(dir.path()).unwrap();

        assert!(store.get_blob_ref("ref-1").unwrap().is_none());

        store.put_blob_ref("ref-1", b"ref-data").unwrap();
        assert_eq!(
            store.get_blob_ref("ref-1").unwrap().as_deref(),
            Some(b"ref-data".as_ref())
        );

        store.delete_blob_ref("ref-1").unwrap();
        assert!(store.get_blob_ref("ref-1").unwrap().is_none());
    }

    /// List all entity keys via prefix scan.
    #[test]
    fn list_entities_prefix_scan() {
        let dir = tempfile::tempdir().unwrap();
        let store = RelayStore::open(dir.path()).unwrap();

        store.put_entity("@alice:relay.com", b"a").unwrap();
        store.put_entity("@bob:relay.com", b"b").unwrap();
        store.put_entity("@carol:relay.com", b"c").unwrap();

        let mut keys = store.list_entity_keys().unwrap();
        keys.sort();
        assert_eq!(
            keys,
            vec!["@alice:relay.com", "@bob:relay.com", "@carol:relay.com",]
        );
    }

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
}

//! SHA256-addressed, deduplicated blob storage.
//!
//! Binary data is stored on the filesystem under a two-level sharded
//! directory layout while metadata lives in RocksDB via [`RelayStore`].

use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use relay_core::error::{RelayError, Result};
use relay_core::RelayStore;

use crate::stats::BlobStats;

/// Metadata record for a single blob.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlobMeta {
    /// The content-addressable hash: `"sha256_" + 64 hex chars`.
    pub hash: String,
    /// Size of the blob in bytes.
    pub size: u64,
    /// Number of active references pointing to this blob.
    pub ref_count: u64,
    /// Unix timestamp (seconds) when the blob was first uploaded.
    pub created_at: u64,
}

/// Content-addressed blob store backed by the filesystem and RocksDB.
pub struct BlobStore {
    /// The underlying RocksDB store (shared with other crates).
    pub(crate) store: Arc<RelayStore>,
    /// Root directory for blob binary files.
    blobs_dir: PathBuf,
    /// Maximum allowed blob size in bytes.
    max_blob_size: u64,
}

impl BlobStore {
    /// Create a new `BlobStore`.
    ///
    /// * `store` - shared RocksDB handle
    /// * `blobs_dir` - filesystem root for blob data files
    /// * `max_blob_size` - upload size limit in bytes
    pub fn new(store: Arc<RelayStore>, blobs_dir: PathBuf, max_blob_size: u64) -> Self {
        Self {
            store,
            blobs_dir,
            max_blob_size,
        }
    }

    /// Compute the filesystem path for a blob with the given hash.
    ///
    /// Layout: `blobs_dir / {hash[7..9]} / {hash[9..11]} / {hash}.blob`
    /// where the prefix `sha256_` occupies chars 0..7.
    pub(crate) fn hash_to_path(&self, hash: &str) -> PathBuf {
        let shard1 = &hash[7..9];
        let shard2 = &hash[9..11];
        self.blobs_dir.join(shard1).join(shard2).join(format!("{hash}.blob"))
    }

    /// Upload binary data and return its content-addressed hash.
    ///
    /// If a blob with the same content already exists the call is
    /// deduplicated and the existing hash is returned.
    pub fn upload(&self, data: &[u8], _uploader: &str) -> Result<String> {
        let size = data.len() as u64;
        if size > self.max_blob_size {
            return Err(RelayError::BlobTooLarge {
                size,
                limit: self.max_blob_size,
            });
        }

        let hash = compute_hash(data);

        // Dedup: if the blob already exists just return the hash.
        if self.store.get_blob_meta(&hash)?.is_some() {
            return Ok(hash);
        }

        // Write binary data to the filesystem.
        let path = self.hash_to_path(&hash);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| RelayError::Storage(format!("mkdir: {e}")))?;
        }
        fs::write(&path, data)
            .map_err(|e| RelayError::Storage(format!("write blob: {e}")))?;

        // Write metadata to RocksDB.
        let now = chrono::Utc::now().timestamp() as u64;
        let meta = BlobMeta {
            hash: hash.clone(),
            size,
            ref_count: 0,
            created_at: now,
        };
        let meta_bytes = serde_json::to_vec(&meta)
            .map_err(|e| RelayError::Storage(format!("serialize meta: {e}")))?;
        self.store.put_blob_meta(&hash, &meta_bytes)?;

        log::info!("uploaded blob {hash} ({size} bytes)");
        Ok(hash)
    }

    /// Download a blob by its hash, returning the raw bytes.
    pub fn download(&self, hash: &str) -> Result<Vec<u8>> {
        // Ensure the blob exists in metadata.
        self.get_meta(hash)?;

        let path = self.hash_to_path(hash);
        fs::read(&path).map_err(|e| RelayError::Storage(format!("read blob: {e}")))
    }

    /// Retrieve the metadata record for a blob.
    pub fn get_meta(&self, hash: &str) -> Result<BlobMeta> {
        let raw = self
            .store
            .get_blob_meta(hash)?
            .ok_or_else(|| RelayError::BlobNotFound(hash.to_string()))?;
        serde_json::from_slice(&raw)
            .map_err(|e| RelayError::Storage(format!("deserialize meta: {e}")))
    }

    /// Increment the reference count for a blob and record the reference.
    pub fn inc_ref(&self, hash: &str, ref_id: &str) -> Result<()> {
        let mut meta = self.get_meta(hash)?;
        meta.ref_count += 1;
        let meta_bytes = serde_json::to_vec(&meta)
            .map_err(|e| RelayError::Storage(format!("serialize meta: {e}")))?;
        self.store.put_blob_meta(hash, &meta_bytes)?;

        // Store the individual reference in blob_refs CF.
        let ref_key = format!("{hash}:{ref_id}");
        self.store.put_blob_ref(&ref_key, ref_id.as_bytes())?;
        Ok(())
    }

    /// Decrement the reference count for a blob and remove the reference.
    pub fn dec_ref(&self, hash: &str, ref_id: &str) -> Result<()> {
        let mut meta = self.get_meta(hash)?;
        meta.ref_count = meta.ref_count.saturating_sub(1);
        let meta_bytes = serde_json::to_vec(&meta)
            .map_err(|e| RelayError::Storage(format!("serialize meta: {e}")))?;
        self.store.put_blob_meta(hash, &meta_bytes)?;

        let ref_key = format!("{hash}:{ref_id}");
        self.store.delete_blob_ref(&ref_key)?;
        Ok(())
    }

    /// Compute aggregate statistics across all blobs in the store.
    pub fn stats(&self) -> Result<BlobStats> {
        let keys = self.store.list_blob_meta_keys()?;
        let mut total_blobs: u64 = 0;
        let mut total_size_bytes: u64 = 0;
        let mut orphan_blobs: u64 = 0;
        let mut oldest_blob: Option<u64> = None;

        for key in &keys {
            let meta = self.get_meta(key)?;
            total_blobs += 1;
            total_size_bytes += meta.size;
            if meta.ref_count == 0 {
                orphan_blobs += 1;
            }
            match oldest_blob {
                None => oldest_blob = Some(meta.created_at),
                Some(prev) if meta.created_at < prev => oldest_blob = Some(meta.created_at),
                _ => {}
            }
        }

        Ok(BlobStats {
            total_blobs,
            total_size_bytes,
            orphan_blobs,
            oldest_blob,
        })
    }
}

/// Compute a content-addressable hash for binary data.
///
/// Returns `"sha256_" + 64 lowercase hex characters`.
pub fn compute_hash(data: &[u8]) -> String {
    let digest = Sha256::digest(data);
    let hex: String = digest.iter().map(|b| format!("{b:02x}")).collect();
    format!("sha256_{hex}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use tempfile::tempdir;

    /// Helper: create a temporary BlobStore with the given max size.
    fn test_blob_store(max_blob_size: u64) -> (BlobStore, tempfile::TempDir) {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("db");
        let blobs_path = dir.path().join("blobs");
        let store = Arc::new(RelayStore::open(&db_path).unwrap());
        let bs = BlobStore::new(store, blobs_path, max_blob_size);
        (bs, dir)
    }

    /// Upload returns `"sha256_"` prefix plus 64 hex chars.
    #[test]
    fn tc_3_blob_001_upload_and_get_hash() {
        let (bs, _dir) = test_blob_store(1024);
        let hash = bs.upload(b"hello world", "alice").unwrap();
        assert!(hash.starts_with("sha256_"), "hash should start with sha256_ prefix");
        assert_eq!(hash.len(), 7 + 64, "sha256_ (7) + 64 hex chars");
        // All chars after the prefix should be lowercase hex.
        assert!(hash[7..].chars().all(|c| c.is_ascii_hexdigit()));
    }

    /// Download returns exactly the bytes that were uploaded.
    #[test]
    fn tc_3_blob_002_download_matches_upload() {
        let (bs, _dir) = test_blob_store(1024);
        let data = b"round-trip integrity test payload";
        let hash = bs.upload(data, "bob").unwrap();
        let downloaded = bs.download(&hash).unwrap();
        assert_eq!(downloaded, data);
    }

    /// Uploading the same content twice returns the same hash, no duplicate.
    #[test]
    fn tc_3_blob_003_dedup_same_content() {
        let (bs, _dir) = test_blob_store(1024);
        let data = b"deduplicated content";
        let h1 = bs.upload(data, "alice").unwrap();
        let h2 = bs.upload(data, "bob").unwrap();
        assert_eq!(h1, h2, "same content should yield the same hash");
        // Stats should show only 1 blob.
        let st = bs.stats().unwrap();
        assert_eq!(st.total_blobs, 1);
    }

    /// Downloading a non-existent hash returns BlobNotFound.
    #[test]
    fn tc_3_blob_004_not_found() {
        let (bs, _dir) = test_blob_store(1024);
        let err = bs.download("sha256_0000000000000000000000000000000000000000000000000000000000000000").unwrap_err();
        assert!(
            matches!(err, RelayError::BlobNotFound(_)),
            "expected BlobNotFound, got: {err:?}"
        );
    }

    /// Uploading data that exceeds the size limit returns BlobTooLarge.
    #[test]
    fn tc_3_blob_005_size_limit() {
        let (bs, _dir) = test_blob_store(100); // 100-byte limit
        let data = vec![0u8; 200];
        let err = bs.upload(&data, "charlie").unwrap_err();
        assert!(
            matches!(err, RelayError::BlobTooLarge { size: 200, limit: 100 }),
            "expected BlobTooLarge, got: {err:?}"
        );
    }

    /// Stats aggregation after uploading blobs with deduplication.
    #[test]
    fn tc_3_blob_010_stats() {
        let (bs, _dir) = test_blob_store(1024);
        bs.upload(b"blob-a", "alice").unwrap();
        bs.upload(b"blob-b", "alice").unwrap();
        // Duplicate of blob-a:
        bs.upload(b"blob-a", "bob").unwrap();

        let st = bs.stats().unwrap();
        assert_eq!(st.total_blobs, 2, "should have 2 unique blobs");
        assert_eq!(
            st.total_size_bytes,
            (b"blob-a".len() + b"blob-b".len()) as u64
        );
        assert_eq!(st.orphan_blobs, 2, "no refs added so both are orphans");
        assert!(st.oldest_blob.is_some());
    }

    /// Reference count increment and decrement.
    #[test]
    fn ref_count_inc_dec() {
        let (bs, _dir) = test_blob_store(1024);
        let hash = bs.upload(b"ref-counted", "alice").unwrap();

        bs.inc_ref(&hash, "msg-1").unwrap();
        bs.inc_ref(&hash, "msg-2").unwrap();
        let meta = bs.get_meta(&hash).unwrap();
        assert_eq!(meta.ref_count, 2, "after two inc_ref calls");

        bs.dec_ref(&hash, "msg-1").unwrap();
        let meta = bs.get_meta(&hash).unwrap();
        assert_eq!(meta.ref_count, 1, "after one dec_ref call");
    }

    /// Blob files are stored under a two-level sharded directory.
    #[test]
    fn blob_file_path_uses_sharded_dirs() {
        let (bs, _dir) = test_blob_store(1024);
        let hash = bs.upload(b"sharded", "alice").unwrap();

        let path = bs.hash_to_path(&hash);
        // hash = "sha256_<64hex>", chars 7..9 = first shard, 9..11 = second shard
        let shard1 = &hash[7..9];
        let shard2 = &hash[9..11];

        assert!(path.exists(), "blob file should exist on disk");
        let parent = path.parent().unwrap();
        assert_eq!(parent.file_name().unwrap().to_str().unwrap(), shard2);
        let grandparent = parent.parent().unwrap();
        assert_eq!(grandparent.file_name().unwrap().to_str().unwrap(), shard1);
    }
}

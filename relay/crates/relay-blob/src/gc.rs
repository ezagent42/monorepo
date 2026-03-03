//! Blob garbage collection with reference counting and retention policies.

use serde::{Deserialize, Serialize};

use relay_core::error::Result;

use crate::store::BlobStore;

/// Report produced after a garbage collection run.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GcReport {
    /// Number of blobs examined during the GC sweep.
    pub blobs_scanned: u64,
    /// Number of blobs deleted (file + metadata).
    pub blobs_deleted: u64,
    /// Total bytes reclaimed from the filesystem.
    pub space_reclaimed: u64,
}

/// Garbage collector that removes unreferenced blobs past their retention period.
pub struct BlobGc {
    /// Number of days an orphan blob is kept before it becomes eligible for deletion.
    pub retention_days: u64,
}

impl BlobGc {
    /// Create a new garbage collector with the given retention policy.
    pub fn new(retention_days: u64) -> Self {
        Self { retention_days }
    }

    /// Run a garbage collection sweep over the blob store.
    ///
    /// A blob is deleted when **both** conditions are met:
    /// 1. `ref_count == 0` (no active references)
    /// 2. `created_at < cutoff` (older than retention window)
    ///
    /// Crash-safety: the file is deleted **before** the DB record so that
    /// a crash between the two leaves an orphan metadata entry (harmless)
    /// rather than a dangling file.
    pub fn run(&self, store: &BlobStore) -> Result<GcReport> {
        let now = chrono::Utc::now().timestamp() as u64;
        let cutoff = now.saturating_sub(self.retention_days * 86400);

        let keys = store.store.list_blob_meta_keys()?;
        let mut blobs_scanned: u64 = 0;
        let mut blobs_deleted: u64 = 0;
        let mut space_reclaimed: u64 = 0;

        for key in &keys {
            blobs_scanned += 1;

            let meta = store.get_meta(key)?;

            if meta.ref_count == 0 && meta.created_at < cutoff {
                // Delete file first (crash-safe ordering).
                let path = store.hash_to_path(key);
                if path.exists() {
                    std::fs::remove_file(&path)
                        .map_err(|e| relay_core::error::RelayError::Storage(
                            format!("gc remove file: {e}"),
                        ))?;
                }
                // Then delete DB metadata.
                store.store.delete_blob_meta(key)?;

                space_reclaimed += meta.size;
                blobs_deleted += 1;

                log::info!("gc: deleted blob {key} ({} bytes)", meta.size);
            }
        }

        Ok(GcReport {
            blobs_scanned,
            blobs_deleted,
            space_reclaimed,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use relay_core::RelayStore;
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

    /// Helper: backdate a blob's `created_at` by writing a modified BlobMeta.
    fn backdate_blob(bs: &BlobStore, hash: &str, created_at: u64) {
        let mut meta = bs.get_meta(hash).unwrap();
        meta.created_at = created_at;
        let meta_bytes = serde_json::to_vec(&meta).unwrap();
        bs.store.put_blob_meta(hash, &meta_bytes).unwrap();
    }

    /// A blob with ref_count > 0 is never deleted by GC.
    #[test]
    fn tc_3_blob_006_ref_count_prevents_gc() {
        let (bs, _dir) = test_blob_store(1024);
        let hash = bs.upload(b"referenced blob", "alice").unwrap();
        bs.inc_ref(&hash, "msg-1").unwrap();

        // Backdate to make it old enough for GC.
        backdate_blob(&bs, &hash, 0);

        let gc = BlobGc::new(7);
        let report = gc.run(&bs).unwrap();

        assert_eq!(report.blobs_scanned, 1);
        assert_eq!(report.blobs_deleted, 0, "referenced blob must not be deleted");
        // Blob should still be downloadable.
        assert!(bs.download(&hash).is_ok());
    }

    /// An orphan blob older than the retention period is deleted.
    #[test]
    fn tc_3_blob_007_orphan_past_retention_deleted() {
        let (bs, _dir) = test_blob_store(1024);
        let hash = bs.upload(b"orphan blob", "alice").unwrap();

        // Backdate to 10 days ago (> 7-day retention).
        let ten_days_ago = chrono::Utc::now().timestamp() as u64 - 10 * 86400;
        backdate_blob(&bs, &hash, ten_days_ago);

        let gc = BlobGc::new(7);
        let report = gc.run(&bs).unwrap();

        assert_eq!(report.blobs_deleted, 1);
        assert_eq!(report.space_reclaimed, b"orphan blob".len() as u64);
        // The blob should no longer be downloadable.
        assert!(bs.download(&hash).is_err());
        // The file should be gone from disk.
        assert!(!bs.hash_to_path(&hash).exists());
    }

    /// An orphan blob within the retention window is kept.
    #[test]
    fn tc_3_blob_008_orphan_within_retention_kept() {
        let (bs, _dir) = test_blob_store(1024);
        let hash = bs.upload(b"fresh orphan", "alice").unwrap();
        // created_at is "now" by default, well within a 7-day window.

        let gc = BlobGc::new(7);
        let report = gc.run(&bs).unwrap();

        assert_eq!(report.blobs_scanned, 1);
        assert_eq!(report.blobs_deleted, 0, "fresh orphan within retention must be kept");
        assert!(bs.download(&hash).is_ok());
    }

    /// Active (referenced) blob survives; old orphan is deleted.
    #[test]
    fn tc_3_blob_009_gc_does_not_affect_active_blobs() {
        let (bs, _dir) = test_blob_store(1024);

        // Active blob (has a reference).
        let active_hash = bs.upload(b"active data", "alice").unwrap();
        bs.inc_ref(&active_hash, "room-1").unwrap();
        backdate_blob(&bs, &active_hash, 0); // old but referenced

        // Old orphan blob.
        let orphan_hash = bs.upload(b"orphan data", "bob").unwrap();
        backdate_blob(&bs, &orphan_hash, 0); // old and unreferenced

        let gc = BlobGc::new(7);
        let report = gc.run(&bs).unwrap();

        assert_eq!(report.blobs_scanned, 2);
        assert_eq!(report.blobs_deleted, 1, "only the orphan should be deleted");

        // Active blob survives.
        assert!(bs.download(&active_hash).is_ok());
        // Orphan is gone.
        assert!(bs.download(&orphan_hash).is_err());
    }
}

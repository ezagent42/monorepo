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

//! Aggregate statistics for the blob store.

use serde::{Deserialize, Serialize};

/// Summary statistics about all blobs in the store.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlobStats {
    /// Total number of distinct blobs stored.
    pub total_blobs: u64,
    /// Aggregate size in bytes across all blobs.
    pub total_size_bytes: u64,
    /// Number of blobs with a reference count of zero.
    pub orphan_blobs: u64,
    /// The `created_at` timestamp of the oldest blob, if any.
    pub oldest_blob: Option<u64>,
}

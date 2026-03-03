//! Cross-crate integration tests for blob upload, download, dedup, and ref counting.

use std::sync::Arc;

use relay_blob::BlobStore;
use relay_core::{RelayError, RelayStore};
use tempfile::TempDir;

fn setup() -> (BlobStore, TempDir) {
    let dir = TempDir::new().unwrap();
    let db_path = dir.path().join("db");
    let blobs_path = dir.path().join("blobs");
    let store = Arc::new(RelayStore::open(&db_path).unwrap());
    let blob_store = BlobStore::new(store, blobs_path, 50 * 1024 * 1024);
    (blob_store, dir)
}

/// Full blob lifecycle: upload, download, dedup, ref count, stats.
#[test]
fn tc_3_blob_full_lifecycle() {
    let (store, _dir) = setup();

    // Upload a blob.
    let hash = store.upload(b"test-image-data", "@alice:test.com").unwrap();
    assert!(hash.starts_with("sha256_"));
    assert_eq!(hash.len(), 7 + 64);

    // Download the blob and verify round-trip integrity.
    let data = store.download(&hash).unwrap();
    assert_eq!(data, b"test-image-data");

    // Uploading the same content from a different user deduplicates.
    let hash2 = store.upload(b"test-image-data", "@bob:test.com").unwrap();
    assert_eq!(hash, hash2, "same content should yield same hash");

    // Increment reference count.
    store.inc_ref(&hash, "msg-001").unwrap();
    let meta = store.get_meta(&hash).unwrap();
    assert_eq!(meta.ref_count, 1);

    // Add a second reference.
    store.inc_ref(&hash, "msg-002").unwrap();
    let meta = store.get_meta(&hash).unwrap();
    assert_eq!(meta.ref_count, 2);

    // Decrement one reference.
    store.dec_ref(&hash, "msg-001").unwrap();
    let meta = store.get_meta(&hash).unwrap();
    assert_eq!(meta.ref_count, 1);

    // Stats should show exactly 1 unique blob.
    let stats = store.stats().unwrap();
    assert_eq!(stats.total_blobs, 1);
    assert_eq!(stats.total_size_bytes, b"test-image-data".len() as u64);
}

/// Downloading a non-existent hash returns BlobNotFound.
#[test]
fn tc_3_blob_not_found() {
    let (store, _dir) = setup();
    let fake_hash = "sha256_0000000000000000000000000000000000000000000000000000000000000000";
    let err = store.download(fake_hash).unwrap_err();
    assert!(
        matches!(err, RelayError::BlobNotFound(_)),
        "expected BlobNotFound, got: {err:?}"
    );
}

/// Upload multiple distinct blobs and verify independent stats.
#[test]
fn tc_3_blob_multiple_uploads_stats() {
    let (store, _dir) = setup();

    store.upload(b"blob-alpha", "@alice:test.com").unwrap();
    store.upload(b"blob-beta", "@alice:test.com").unwrap();
    store.upload(b"blob-gamma", "@alice:test.com").unwrap();

    let stats = store.stats().unwrap();
    assert_eq!(stats.total_blobs, 3);
    assert_eq!(
        stats.total_size_bytes,
        (b"blob-alpha".len() + b"blob-beta".len() + b"blob-gamma".len()) as u64
    );
    // All orphans since no refs were added.
    assert_eq!(stats.orphan_blobs, 3);
}

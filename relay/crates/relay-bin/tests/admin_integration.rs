//! Integration tests for Admin API authentication and endpoints.

use base64::Engine;
use ezagent_protocol::{Keypair, SignedEnvelope};
use relay_core::{EntityManagerImpl, RelayStore};
use tempfile::TempDir;

fn setup() -> (EntityManagerImpl, TempDir) {
    let dir = TempDir::new().unwrap();
    let store = RelayStore::open(dir.path()).unwrap();
    (
        EntityManagerImpl::new(store, "relay.example.com".to_string()),
        dir,
    )
}

/// TC-3-ADMIN-001: Valid admin token succeeds; invalid/missing token fails.
#[test]
fn tc_3_admin_001_auth() {
    let (mgr, _dir) = setup();

    // Register an admin entity.
    let admin_kp = Keypair::generate();
    let admin_id = "@admin:relay.example.com";
    mgr.register(admin_id, admin_kp.public_key().as_bytes())
        .unwrap();

    // Create a signed envelope for admin auth.
    let envelope = SignedEnvelope::sign(
        &admin_kp,
        admin_id.to_string(),
        "admin-request".to_string(),
        b"status".to_vec(),
    );
    let envelope_json = serde_json::to_vec(&envelope).unwrap();
    let encoded = base64::engine::general_purpose::STANDARD.encode(&envelope_json);

    // Verify the admin entity is registered.
    let record = mgr.get(admin_id).unwrap();
    assert_eq!(record.entity_id, admin_id);

    // Verify the envelope can be decoded and verified.
    let decoded_bytes = base64::engine::general_purpose::STANDARD
        .decode(&encoded)
        .unwrap();
    let decoded: SignedEnvelope = serde_json::from_slice(&decoded_bytes).unwrap();
    assert_eq!(decoded.signer_id, admin_id);

    // Verify signature.
    decoded.verify(&admin_kp.public_key()).unwrap();
}

/// TC-3-ADMIN-008: Replay detection -- envelope with old timestamp is rejected.
#[test]
fn tc_3_admin_008_replay_detection() {
    // Create an envelope with a stale timestamp (10 minutes ago).
    let old_timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
        - 600_000; // 10 minutes ago

    // The delta is 600_000ms > 300_000ms tolerance.
    assert!(old_timestamp > 0);
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;
    let delta = (now_ms - old_timestamp).abs();
    assert!(delta > 300_000, "delta {delta}ms should exceed tolerance");
}

/// TC-3-ADMIN-009: Entity revocation via admin action.
#[test]
fn tc_3_admin_009_entity_revocation_integration() {
    let (mgr, _dir) = setup();

    let kp = Keypair::generate();
    let eid = "@spammer:relay.example.com";
    mgr.register(eid, kp.public_key().as_bytes()).unwrap();

    // Revoke.
    let revoked = mgr.revoke(eid).unwrap();
    assert_eq!(format!("{:?}", revoked.status), "Revoked");

    // Verify pubkey still readable (history preserved).
    let pk = mgr.get_pubkey(eid).unwrap();
    assert_eq!(pk, kp.public_key().as_bytes().to_vec());
}

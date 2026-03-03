//! Cross-crate integration tests for entity registration and identity lifecycle.

use ezagent_protocol::Keypair;
use relay_core::{EntityManagerImpl, RelayError, RelayStore};
use tempfile::TempDir;

fn setup() -> (EntityManagerImpl, TempDir) {
    let dir = TempDir::new().unwrap();
    let store = RelayStore::open(dir.path()).unwrap();
    (
        EntityManagerImpl::new(store, "relay-a.example.com".to_string()),
        dir,
    )
}

/// Full entity lifecycle: register, query pubkey, list, duplicate rejection.
#[test]
fn tc_3_ident_full_lifecycle() {
    let (mgr, _dir) = setup();

    // Register a new entity.
    let kp = Keypair::generate();
    let record = mgr
        .register("@alice:relay-a.example.com", kp.public_key().as_bytes())
        .unwrap();
    assert_eq!(record.entity_id, "@alice:relay-a.example.com");

    // Query the public key back.
    let pk = mgr.get_pubkey("@alice:relay-a.example.com").unwrap();
    assert_eq!(pk, kp.public_key().as_bytes().to_vec());

    // List should contain exactly one entity.
    let list = mgr.list().unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0], "@alice:relay-a.example.com");

    // Duplicate registration must fail.
    let kp2 = Keypair::generate();
    let err = mgr
        .register("@alice:relay-a.example.com", kp2.public_key().as_bytes())
        .unwrap_err();
    assert!(
        matches!(err, RelayError::EntityExists(_)),
        "expected EntityExists, got: {err}"
    );
}

/// Register multiple entities and verify listing.
#[test]
fn tc_3_ident_multi_entity_register_and_list() {
    let (mgr, _dir) = setup();

    for name in &["alice", "bob", "carol", "dave", "eve"] {
        let kp = Keypair::generate();
        let entity_id = format!("@{name}:relay-a.example.com");
        mgr.register(&entity_id, kp.public_key().as_bytes())
            .unwrap();
    }

    let mut list = mgr.list().unwrap();
    list.sort();
    assert_eq!(list.len(), 5);
    assert_eq!(list[0], "@alice:relay-a.example.com");
    assert_eq!(list[4], "@eve:relay-a.example.com");
}

/// Domain mismatch is rejected during registration.
#[test]
fn tc_3_ident_domain_mismatch_rejected() {
    let (mgr, _dir) = setup();
    let kp = Keypair::generate();

    let err = mgr
        .register("@alice:other-relay.com", kp.public_key().as_bytes())
        .unwrap_err();
    assert!(
        matches!(err, RelayError::DomainMismatch { .. }),
        "expected DomainMismatch, got: {err}"
    );
}

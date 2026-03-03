//! Entity registration and management.
//!
//! Entities are the fundamental identity unit. Each entity has a unique ID
//! of the form `@local_part:relay_domain` and an Ed25519 public key.

use serde::{Deserialize, Serialize};

use ezagent_protocol::{EntityId, PublicKey, SignedEnvelope};

use crate::error::{RelayError, Result};
use crate::storage::RelayStore;

/// The status of a registered entity.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum EntityStatus {
    /// The entity is active and can participate normally.
    Active,
    /// The entity has been revoked (e.g. key compromise).
    Revoked,
}

/// A stored record for a registered entity.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityRecord {
    /// The canonical entity ID string (e.g. "@alice:relay.example.com").
    pub entity_id: String,
    /// The Ed25519 public key bytes (32 bytes).
    pub pubkey: Vec<u8>,
    /// Unix timestamp (seconds) when the entity was registered.
    pub registered_at: u64,
    /// Current status of the entity.
    pub status: EntityStatus,
}

/// Manages entity registration, lookup, and key rotation.
pub struct EntityManagerImpl {
    store: RelayStore,
    relay_domain: String,
}

impl EntityManagerImpl {
    /// Create a new entity manager backed by the given store.
    pub fn new(store: RelayStore, relay_domain: String) -> Self {
        Self {
            store,
            relay_domain,
        }
    }

    /// Validate an entity ID string: parse format and check domain.
    fn validate(&self, entity_id_str: &str) -> Result<EntityId> {
        let eid = EntityId::parse(entity_id_str)
            .map_err(|e| RelayError::InvalidEntityId(e.to_string()))?;

        if eid.relay_domain != self.relay_domain {
            return Err(RelayError::DomainMismatch {
                entity_domain: eid.relay_domain.clone(),
                relay_domain: self.relay_domain.clone(),
            });
        }

        Ok(eid)
    }

    /// Register a new entity with the given public key.
    ///
    /// Returns `EntityExists` if the entity is already registered.
    pub fn register(&self, entity_id_str: &str, pubkey_bytes: &[u8; 32]) -> Result<EntityRecord> {
        let _eid = self.validate(entity_id_str)?;

        // Check for duplicate.
        if self.store.get_entity(entity_id_str)?.is_some() {
            return Err(RelayError::EntityExists(entity_id_str.to_string()));
        }

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system clock before UNIX epoch")
            .as_secs();

        let record = EntityRecord {
            entity_id: entity_id_str.to_string(),
            pubkey: pubkey_bytes.to_vec(),
            registered_at: now,
            status: EntityStatus::Active,
        };

        let serialized =
            serde_json::to_vec(&record).map_err(|e| RelayError::Storage(e.to_string()))?;

        self.store.put_entity(entity_id_str, &serialized)?;

        Ok(record)
    }

    /// Look up an entity by ID.
    pub fn get(&self, entity_id_str: &str) -> Result<EntityRecord> {
        let data = self
            .store
            .get_entity(entity_id_str)?
            .ok_or_else(|| RelayError::EntityNotFound(entity_id_str.to_string()))?;

        serde_json::from_slice(&data).map_err(|e| RelayError::Storage(e.to_string()))
    }

    /// Retrieve the public key bytes for a registered entity.
    pub fn get_pubkey(&self, entity_id_str: &str) -> Result<Vec<u8>> {
        let record = self.get(entity_id_str)?;
        Ok(record.pubkey)
    }

    /// List all registered entity IDs.
    pub fn list(&self) -> Result<Vec<String>> {
        self.store.list_entity_keys()
    }

    /// Rotate an entity's key. The old key must sign an envelope proving
    /// ownership, and the new public key is stored.
    ///
    /// The `proof_envelope` must:
    /// - Be signed by the current (old) key
    /// - Have `signer_id` matching `entity_id_str`
    pub fn rotate_key(
        &self,
        entity_id_str: &str,
        new_pubkey_bytes: &[u8; 32],
        proof_envelope: &SignedEnvelope,
    ) -> Result<EntityRecord> {
        // Fetch current record.
        let mut record = self.get(entity_id_str)?;

        // Verify the proof envelope is signed by the old key.
        let old_pubkey_bytes: [u8; 32] = record
            .pubkey
            .as_slice()
            .try_into()
            .map_err(|_| RelayError::Storage("stored pubkey is not 32 bytes".into()))?;

        let old_pubkey = PublicKey::from_bytes(&old_pubkey_bytes)
            .map_err(|e| RelayError::SignatureInvalid(e.to_string()))?;

        proof_envelope
            .verify(&old_pubkey)
            .map_err(|e| RelayError::SignatureInvalid(e.to_string()))?;

        // Verify the signer matches the entity.
        if proof_envelope.signer_id != entity_id_str {
            return Err(RelayError::AuthorMismatch {
                signer: proof_envelope.signer_id.clone(),
                author: entity_id_str.to_string(),
            });
        }

        // Update the stored key.
        record.pubkey = new_pubkey_bytes.to_vec();

        let serialized =
            serde_json::to_vec(&record).map_err(|e| RelayError::Storage(e.to_string()))?;
        self.store.put_entity(entity_id_str, &serialized)?;

        Ok(record)
    }

    /// Revoke an entity by setting its status to `Revoked`.
    ///
    /// Returns the updated record. Revoked entities cannot participate
    /// in further operations but their historical data is preserved.
    pub fn revoke(&self, entity_id_str: &str) -> Result<EntityRecord> {
        let mut record = self.get(entity_id_str)?;
        record.status = EntityStatus::Revoked;

        let serialized =
            serde_json::to_vec(&record).map_err(|e| RelayError::Storage(e.to_string()))?;
        self.store.put_entity(entity_id_str, &serialized)?;

        Ok(record)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ezagent_protocol::Keypair;

    fn setup(domain: &str) -> EntityManagerImpl {
        let dir = tempfile::tempdir().unwrap();
        let store = RelayStore::open(dir.path()).unwrap();
        // Leak the tempdir so it is not deleted while the store is alive.
        // In tests this is fine; the OS will clean up temp files.
        let _leaked = Box::leak(Box::new(dir));
        EntityManagerImpl::new(store, domain.to_string())
    }

    /// TC-3-IDENT-001: Successful entity registration.
    #[test]
    fn tc_3_ident_001_entity_register() {
        let mgr = setup("relay.example.com");
        let kp = Keypair::generate();
        let pk = kp.public_key();

        let record = mgr
            .register("@alice:relay.example.com", pk.as_bytes())
            .unwrap();

        assert_eq!(record.entity_id, "@alice:relay.example.com");
        assert_eq!(record.pubkey, pk.as_bytes().to_vec());
        assert_eq!(record.status, EntityStatus::Active);
    }

    /// TC-3-IDENT-002: Duplicate registration is rejected.
    #[test]
    fn tc_3_ident_002_duplicate_register_rejected() {
        let mgr = setup("relay.example.com");
        let kp = Keypair::generate();
        let pk = kp.public_key();

        mgr.register("@alice:relay.example.com", pk.as_bytes())
            .unwrap();

        let err = mgr
            .register("@alice:relay.example.com", pk.as_bytes())
            .unwrap_err();

        assert!(
            matches!(err, RelayError::EntityExists(_)),
            "expected EntityExists, got: {err}"
        );
    }

    /// TC-3-IDENT-003: Query public key after registration.
    #[test]
    fn tc_3_ident_003_pubkey_query() {
        let mgr = setup("relay.example.com");
        let kp = Keypair::generate();
        let pk = kp.public_key();

        mgr.register("@bob:relay.example.com", pk.as_bytes())
            .unwrap();

        let retrieved = mgr.get_pubkey("@bob:relay.example.com").unwrap();
        assert_eq!(retrieved, pk.as_bytes().to_vec());
    }

    /// TC-3-IDENT-004: Query for unknown entity returns EntityNotFound.
    #[test]
    fn tc_3_ident_004_unknown_entity_query() {
        let mgr = setup("relay.example.com");
        let err = mgr.get("@unknown:relay.example.com").unwrap_err();
        assert!(
            matches!(err, RelayError::EntityNotFound(_)),
            "expected EntityNotFound, got: {err}"
        );
    }

    /// TC-3-IDENT-005: Invalid entity ID format is rejected.
    #[test]
    fn tc_3_ident_005_invalid_entity_id_format() {
        let mgr = setup("relay.example.com");
        let kp = Keypair::generate();
        let pk = kp.public_key();

        // Missing @ prefix.
        let err = mgr
            .register("alice:relay.example.com", pk.as_bytes())
            .unwrap_err();
        assert!(
            matches!(err, RelayError::InvalidEntityId(_)),
            "expected InvalidEntityId, got: {err}"
        );
    }

    /// TC-3-IDENT-006: Entity with wrong domain is rejected.
    #[test]
    fn tc_3_ident_006_domain_mismatch() {
        let mgr = setup("relay.example.com");
        let kp = Keypair::generate();
        let pk = kp.public_key();

        let err = mgr
            .register("@alice:other-relay.com", pk.as_bytes())
            .unwrap_err();
        assert!(
            matches!(err, RelayError::DomainMismatch { .. }),
            "expected DomainMismatch, got: {err}"
        );
    }

    /// TC-3-IDENT-007: List 3 registered entities.
    #[test]
    fn tc_3_ident_007_list_entities() {
        let mgr = setup("relay.example.com");
        let kp1 = Keypair::generate();
        let kp2 = Keypair::generate();
        let kp3 = Keypair::generate();

        mgr.register("@alice:relay.example.com", kp1.public_key().as_bytes())
            .unwrap();
        mgr.register("@bob:relay.example.com", kp2.public_key().as_bytes())
            .unwrap();
        mgr.register("@carol:relay.example.com", kp3.public_key().as_bytes())
            .unwrap();

        let mut ids = mgr.list().unwrap();
        ids.sort();

        assert_eq!(ids.len(), 3);
        assert_eq!(ids[0], "@alice:relay.example.com");
        assert_eq!(ids[1], "@bob:relay.example.com");
        assert_eq!(ids[2], "@carol:relay.example.com");
    }

    /// TC-3-IDENT-008: Key rotation — old key signs proof, new key stored.
    #[test]
    fn tc_3_ident_008_key_rotation() {
        let mgr = setup("relay.example.com");
        let old_kp = Keypair::generate();
        let new_kp = Keypair::generate();

        let entity_id = "@alice:relay.example.com";

        // Register with old key.
        mgr.register(entity_id, old_kp.public_key().as_bytes())
            .unwrap();

        // Old key signs a proof envelope.
        let proof = SignedEnvelope::sign(
            &old_kp,
            entity_id.to_string(),
            "key-rotation".to_string(),
            new_kp.public_key().as_bytes().to_vec(),
        );

        // Rotate to new key.
        let updated = mgr
            .rotate_key(entity_id, new_kp.public_key().as_bytes(), &proof)
            .unwrap();

        assert_eq!(updated.pubkey, new_kp.public_key().as_bytes().to_vec());

        // Stored key should now be the new one.
        let stored = mgr.get_pubkey(entity_id).unwrap();
        assert_eq!(stored, new_kp.public_key().as_bytes().to_vec());
    }

    /// TC-3-ADMIN-009: Entity revocation sets status to Revoked.
    #[test]
    fn tc_3_admin_009_entity_revocation() {
        let mgr = setup("relay.example.com");
        let kp = Keypair::generate();
        let pk = kp.public_key();
        let eid = "@spammer:relay.example.com";

        mgr.register(eid, pk.as_bytes()).unwrap();
        assert_eq!(mgr.get(eid).unwrap().status, EntityStatus::Active);

        let revoked = mgr.revoke(eid).unwrap();
        assert_eq!(revoked.status, EntityStatus::Revoked);

        // Re-read from store to confirm persistence.
        let stored = mgr.get(eid).unwrap();
        assert_eq!(stored.status, EntityStatus::Revoked);
        // Pubkey is still accessible (history preserved).
        assert_eq!(stored.pubkey, pk.as_bytes().to_vec());
    }

    /// Revoking a non-existent entity returns EntityNotFound.
    #[test]
    fn revoke_nonexistent_entity() {
        let mgr = setup("relay.example.com");
        let err = mgr.revoke("@ghost:relay.example.com").unwrap_err();
        assert!(matches!(err, RelayError::EntityNotFound(_)));
    }
}

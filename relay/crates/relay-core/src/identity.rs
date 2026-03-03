//! Ed25519 signature verification for signed envelopes.
//!
//! Provides `verify_envelope` which checks:
//! 1. The cryptographic signature is valid.
//! 2. The envelope's `signer_id` matches the expected author.
//! 3. The envelope timestamp is within +/-5 minutes of the current time.

use std::time::{SystemTime, UNIX_EPOCH};

use ezagent_protocol::{PublicKey, SignedEnvelope};

use crate::error::{RelayError, Result};

/// Maximum allowed time delta between envelope timestamp and current time (5 minutes).
const TIMESTAMP_TOLERANCE_MS: i64 = 5 * 60 * 1000;

/// Verify a signed envelope against a public key and expected author.
///
/// Checks:
/// - The signature is cryptographically valid.
/// - The `signer_id` in the envelope matches `expected_author`.
/// - The envelope timestamp is within +/-5 minutes of the current system time.
pub fn verify_envelope(
    envelope: &SignedEnvelope,
    pubkey: &PublicKey,
    expected_author: &str,
) -> Result<()> {
    // 1. Verify cryptographic signature.
    envelope
        .verify(pubkey)
        .map_err(|e| RelayError::SignatureInvalid(e.to_string()))?;

    // 2. Verify author matches signer_id.
    if envelope.signer_id != expected_author {
        return Err(RelayError::AuthorMismatch {
            signer: envelope.signer_id.clone(),
            author: expected_author.to_string(),
        });
    }

    // 3. Verify timestamp is within tolerance.
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before UNIX epoch")
        .as_millis() as i64;

    let delta_ms = (envelope.timestamp - now_ms).abs();
    if delta_ms > TIMESTAMP_TOLERANCE_MS {
        return Err(RelayError::TimestampExpired { delta_ms });
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use ezagent_protocol::Keypair;

    /// TC-3-STORE-008: A correctly signed envelope passes verification.
    #[test]
    fn tc_3_store_008_valid_signature_accepted() {
        let kp = Keypair::generate();
        let pk = kp.public_key();
        let entity = "@alice:relay.example.com";

        let envelope = SignedEnvelope::sign(
            &kp,
            entity.to_string(),
            "rooms/abc/messages".to_string(),
            b"crdt-update".to_vec(),
        );

        let result = verify_envelope(&envelope, &pk, entity);
        assert!(result.is_ok(), "expected ok, got: {result:?}");
    }

    /// TC-3-STORE-009: Envelope with mismatched author is rejected.
    #[test]
    fn tc_3_store_009_forged_author_rejected() {
        let kp = Keypair::generate();
        let pk = kp.public_key();

        let envelope = SignedEnvelope::sign(
            &kp,
            "@alice:relay.example.com".to_string(),
            "doc/1".to_string(),
            b"data".to_vec(),
        );

        // Verify with a different expected author.
        let err = verify_envelope(&envelope, &pk, "@bob:relay.example.com").unwrap_err();
        assert!(
            matches!(err, RelayError::AuthorMismatch { .. }),
            "expected AuthorMismatch, got: {err}"
        );
    }

    /// An envelope signed with one key but verified with another is rejected.
    #[test]
    fn invalid_signature_rejected() {
        let kp_signer = Keypair::generate();
        let kp_wrong = Keypair::generate();
        let entity = "@alice:relay.example.com";

        let envelope = SignedEnvelope::sign(
            &kp_signer,
            entity.to_string(),
            "doc/1".to_string(),
            b"data".to_vec(),
        );

        // Verify with wrong public key.
        let err = verify_envelope(&envelope, &kp_wrong.public_key(), entity).unwrap_err();
        assert!(
            matches!(err, RelayError::SignatureInvalid(_)),
            "expected SignatureInvalid, got: {err}"
        );
    }
}

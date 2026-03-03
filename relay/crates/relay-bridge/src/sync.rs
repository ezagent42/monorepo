//! CRDT sync protocol handler.
//!
//! [`SyncServer`] handles incoming [`SyncMessage`] variants, applying updates
//! and returning state diffs via [`CrdtPersist`].

use std::sync::Arc;

use ezagent_protocol::{PublicKey, SignedEnvelope, SyncMessage};

use relay_core::Result;

use crate::persist::CrdtPersist;

/// Server-side handler for the CRDT sync protocol.
///
/// Processes [`SyncMessage::StateQuery`] and [`SyncMessage::StateReply`] messages,
/// delegating persistence to a [`CrdtPersist`] instance.
pub struct SyncServer {
    persist: Arc<CrdtPersist>,
}

impl SyncServer {
    /// Create a new sync server backed by the given persistence layer.
    pub fn new(persist: Arc<CrdtPersist>) -> Self {
        Self { persist }
    }

    /// Handle an incoming sync message.
    ///
    /// - **StateQuery**: returns a `StateReply` containing the requested state
    ///   or diff.
    /// - **StateReply**: applies the incoming update and returns `None`.
    pub fn handle_message(&self, msg: &SyncMessage) -> Result<Option<SyncMessage>> {
        match msg {
            SyncMessage::StateQuery {
                doc_id,
                state_vector,
            } => {
                let payload = if let Some(sv_bytes) = state_vector {
                    // Compute diff from remote state vector.
                    self.persist.get_diff(doc_id, sv_bytes)?
                } else {
                    // Return full state.
                    self.persist.get_state(doc_id)?
                };

                match payload {
                    Some(data) => Ok(Some(SyncMessage::StateReply {
                        doc_id: doc_id.clone(),
                        payload: data,
                        is_full: state_vector.is_none(),
                    })),
                    None => Ok(None),
                }
            }
            SyncMessage::StateReply {
                doc_id, payload, ..
            } => {
                self.persist.apply_update(doc_id, payload)?;
                Ok(None)
            }
        }
    }

    /// Apply a signed CRDT update after verifying the envelope signature.
    ///
    /// Delegates signature verification to [`relay_core::identity::verify_envelope`],
    /// then applies the envelope payload as a CRDT update.
    pub fn apply_signed_update(
        &self,
        envelope: &SignedEnvelope,
        pubkey: &PublicKey,
        expected_author: &str,
    ) -> Result<()> {
        relay_core::identity::verify_envelope(envelope, pubkey, expected_author)?;
        self.persist
            .apply_update(&envelope.doc_id, &envelope.payload)
    }
}

#[cfg(test)]
mod tests {
    use ezagent_protocol::SyncMessage;

    /// Serialize and deserialize a StateQuery message.
    #[test]
    fn state_query_round_trip() {
        let msg = SyncMessage::StateQuery {
            doc_id: "rooms/abc/messages".into(),
            state_vector: Some(vec![1, 2, 3]),
        };

        let json = serde_json::to_string(&msg).unwrap();
        let msg2: SyncMessage = serde_json::from_str(&json).unwrap();

        match msg2 {
            SyncMessage::StateQuery {
                doc_id,
                state_vector,
            } => {
                assert_eq!(doc_id, "rooms/abc/messages");
                assert_eq!(state_vector, Some(vec![1, 2, 3]));
            }
            _ => panic!("expected StateQuery"),
        }
    }

    /// Serialize and deserialize a StateReply message.
    #[test]
    fn state_reply_round_trip() {
        let msg = SyncMessage::StateReply {
            doc_id: "rooms/xyz/data".into(),
            payload: vec![10, 20, 30],
            is_full: true,
        };

        let json = serde_json::to_string(&msg).unwrap();
        let msg2: SyncMessage = serde_json::from_str(&json).unwrap();

        match msg2 {
            SyncMessage::StateReply {
                doc_id,
                payload,
                is_full,
            } => {
                assert_eq!(doc_id, "rooms/xyz/data");
                assert_eq!(payload, vec![10, 20, 30]);
                assert!(is_full);
            }
            _ => panic!("expected StateReply"),
        }
    }
}

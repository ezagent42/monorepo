//! Multi-relay federation support.
//!
//! Provides entity domain extraction and peer endpoint resolution for
//! cross-relay communication.

use relay_core::{RelayError, Result};

/// Extract the relay domain from an entity ID string.
///
/// Parses the entity ID using [`ezagent_protocol::EntityId::parse`] and
/// returns the `relay_domain` component.
///
/// # Example
///
/// ```ignore
/// let domain = extract_relay_domain("@alice:relay-a.example.com")?;
/// assert_eq!(domain, "relay-a.example.com");
/// ```
pub fn extract_relay_domain(entity_id: &str) -> Result<String> {
    let eid = ezagent_protocol::EntityId::parse(entity_id)
        .map_err(|e| RelayError::InvalidEntityId(e.to_string()))?;
    Ok(eid.relay_domain)
}

/// Federation configuration for cross-relay coordination.
///
/// Maintains a list of peer relay endpoints and the local relay's domain
/// name, enabling routing decisions for remote entities.
pub struct Federation {
    peer_endpoints: Vec<String>,
    local_domain: String,
}

impl Federation {
    /// Create a new federation configuration.
    pub fn new(peer_endpoints: Vec<String>, local_domain: String) -> Self {
        Self {
            peer_endpoints,
            local_domain,
        }
    }

    /// Returns the list of peer relay endpoints.
    pub fn peers(&self) -> &[String] {
        &self.peer_endpoints
    }

    /// Returns the local relay's domain name.
    pub fn local_domain(&self) -> &str {
        &self.local_domain
    }

    /// Check whether an entity ID belongs to a remote relay.
    ///
    /// Returns `true` if the entity's relay domain differs from the local domain.
    pub fn is_remote_entity(&self, entity_id: &str) -> Result<bool> {
        let domain = extract_relay_domain(entity_id)?;
        Ok(domain != self.local_domain)
    }

    /// Resolve a peer endpoint for the given target domain.
    ///
    /// Currently returns the first peer endpoint (simple round-robin placeholder).
    /// A production implementation would use domain-based routing tables.
    pub fn resolve_peer_for_domain(&self, _target_domain: &str) -> Option<&str> {
        self.peer_endpoints.first().map(|s| s.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Parse the relay domain from a valid entity ID.
    #[test]
    fn parse_relay_domain_from_entity_id() {
        let domain = extract_relay_domain("@alice:relay-a.example.com").unwrap();
        assert_eq!(domain, "relay-a.example.com");
    }

    /// TC-3-MULTI-005: Cross-domain entity domain extraction works correctly.
    #[test]
    fn tc_3_multi_005_cross_domain_register_rejected() {
        let domain = extract_relay_domain("@bob:relay-b.example.com").unwrap();
        assert_eq!(domain, "relay-b.example.com");

        // Invalid entity ID is rejected.
        let err = extract_relay_domain("not-an-entity");
        assert!(err.is_err(), "expected error for invalid entity ID");
    }

    /// An empty peers list produces a valid federation with no peers.
    #[test]
    fn federation_config_empty_peers() {
        let fed = Federation::new(vec![], "relay-a.example.com".into());
        assert!(fed.peers().is_empty());
        assert_eq!(fed.local_domain(), "relay-a.example.com");
        assert!(fed.resolve_peer_for_domain("relay-b.example.com").is_none());
    }

    /// A federation with one peer can resolve it.
    #[test]
    fn federation_config_with_peers() {
        let fed = Federation::new(
            vec!["tls/relay-b.example.com:7448".into()],
            "relay-a.example.com".into(),
        );
        assert_eq!(fed.peers().len(), 1);
        assert_eq!(fed.peers()[0], "tls/relay-b.example.com:7448");

        // Local entity is not remote.
        let is_remote = fed
            .is_remote_entity("@alice:relay-a.example.com")
            .unwrap();
        assert!(!is_remote);

        // Remote entity is detected.
        let is_remote = fed
            .is_remote_entity("@bob:relay-b.example.com")
            .unwrap();
        assert!(is_remote);

        // Peer resolution returns the first peer.
        let peer = fed.resolve_peer_for_domain("relay-b.example.com");
        assert_eq!(peer, Some("tls/relay-b.example.com:7448"));
    }
}

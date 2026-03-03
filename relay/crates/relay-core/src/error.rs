//! Domain error types for the relay service.

use thiserror::Error;

/// All errors that can occur in the relay domain.
#[derive(Debug, Error)]
pub enum RelayError {
    /// An entity with this ID already exists.
    #[error("entity already exists: {0}")]
    EntityExists(String),

    /// The entity's domain does not match the relay's domain.
    #[error("domain mismatch: entity domain '{entity_domain}' != relay domain '{relay_domain}'")]
    DomainMismatch {
        /// The domain from the entity ID.
        entity_domain: String,
        /// The relay's configured domain.
        relay_domain: String,
    },

    /// The entity ID string is invalid.
    #[error("invalid entity ID: {0}")]
    InvalidEntityId(String),

    /// No entity with this ID exists.
    #[error("entity not found: {0}")]
    EntityNotFound(String),

    /// No blob with this hash exists.
    #[error("blob not found: {0}")]
    BlobNotFound(String),

    /// The blob exceeds the configured size limit.
    #[error("blob too large: {size} bytes exceeds limit of {limit} bytes")]
    BlobTooLarge {
        /// Actual size of the blob in bytes.
        size: u64,
        /// Configured maximum size in bytes.
        limit: u64,
    },

    /// A cryptographic signature failed verification.
    #[error("invalid signature: {0}")]
    SignatureInvalid(String),

    /// The signer of an envelope does not match the claimed author.
    #[error("author mismatch: signer '{signer}' != author '{author}'")]
    AuthorMismatch {
        /// The entity that actually signed the envelope.
        signer: String,
        /// The entity claimed as author.
        author: String,
    },

    /// The envelope timestamp is too far from the current time.
    #[error("timestamp expired: delta {delta_ms}ms exceeds tolerance")]
    TimestampExpired {
        /// The absolute delta in milliseconds.
        delta_ms: i64,
    },

    /// A configuration error occurred.
    #[error("config error: {0}")]
    Config(String),

    /// A storage-layer error occurred.
    #[error("storage error: {0}")]
    Storage(String),

    /// A network-layer error occurred.
    #[error("network error: {0}")]
    Network(String),
}

/// Convenience alias for relay results.
pub type Result<T> = std::result::Result<T, RelayError>;

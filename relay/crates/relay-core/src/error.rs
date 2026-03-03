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

    /// A quota limit was exceeded.
    #[error("quota exceeded for {entity_id}: {dimension} used={used}, limit={limit}")]
    QuotaExceeded {
        entity_id: String,
        dimension: String,
        used: u64,
        limit: u64,
    },

    /// The entity is not a member of the room.
    #[error("not a member: {entity_id} is not in room {room_id}")]
    NotAMember { entity_id: String, room_id: String },

    /// The entity's power level is insufficient.
    #[error("insufficient power level for {entity_id}: required={required}, actual={actual}")]
    InsufficientPowerLevel {
        entity_id: String,
        required: u32,
        actual: u32,
    },

    /// The entity is not the author of the resource.
    #[error("not author: {entity_id} is not author {author}")]
    NotAuthor { entity_id: String, author: String },

    /// The request is not authenticated.
    #[error("unauthorized: {0}")]
    Unauthorized(String),

    /// The authenticated entity lacks permission.
    #[error("forbidden: {0}")]
    Forbidden(String),

    /// A replayed request was detected (timestamp too old).
    #[error("replay detected: timestamp {timestamp_ms}ms is outside tolerance")]
    ReplayDetected { timestamp_ms: i64 },
}

/// Convenience alias for relay results.
pub type Result<T> = std::result::Result<T, RelayError>;

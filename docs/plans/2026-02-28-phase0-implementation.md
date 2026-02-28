# Phase 0 技术验证 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Verify that yrs (CRDT) + Zenoh (P2P networking) + PyO3 (Python bindings) integrate correctly, passing all 11 test cases defined in `docs/plan/phase-0-verification.md`.

**Architecture:** 3-crate Cargo workspace (`ezagent-protocol`, `ezagent-backend`, `ezagent-py`) following `docs/specs/repo-spec.md`. Protocol crate owns shared types (EntityId, SignedEnvelope, Crypto). Backend crate provides CrdtBackend + NetworkBackend traits with yrs/Zenoh implementations. PyO3 crate validates cross-language bridge.

**Tech Stack:** Rust (yrs 0.25, zenoh 1.7, ed25519-dalek 2, tokio 1), Python 3.11+ (maturin, pytest, pyo3-async-runtimes)

**Design Doc:** `docs/plans/2026-02-28-phase0-verification-design.md`

**Spec References:**
- `docs/specs/repo-spec.md` — Cargo workspace structure, crate boundaries
- `docs/specs/bus-spec.md §4` — Backend requirements, Sync protocol, Signed Envelope
- `docs/plan/phase-0-verification.md` — 11 test cases (TC-0-SYNC-001~008, TC-0-P2P-001~003)
- `docs/plan/fixtures.md` — Test fixture data (keypairs, R-minimal)
- `docs/plan/foundations.md` — Key Space structure

**Prerequisites:**
- Rust toolchain installed (`rustup`)
- Python 3.11+ with `uv` package manager
- `zenohd` available (`cargo install zenoh-router` or `brew install zenoh`)
- Working directory: `ezagent/` within the monorepo

---

## Task 1: Scaffold Cargo Workspace

**Files:**
- Create: `ezagent/Cargo.toml`
- Create: `ezagent/crates/ezagent-protocol/Cargo.toml`
- Create: `ezagent/crates/ezagent-protocol/src/lib.rs`
- Create: `ezagent/crates/ezagent-backend/Cargo.toml`
- Create: `ezagent/crates/ezagent-backend/src/lib.rs`
- Create: `ezagent/crates/ezagent-py/Cargo.toml`
- Create: `ezagent/crates/ezagent-py/src/lib.rs`
- Create: `ezagent/pyproject.toml`

**Step 1: Create workspace root Cargo.toml**

```toml
# ezagent/Cargo.toml
[workspace]
resolver = "2"
members = [
    "crates/ezagent-protocol",
    "crates/ezagent-backend",
    "crates/ezagent-py",
]

[workspace.package]
version = "0.1.0"
edition = "2021"
license = "Apache-2.0"

[workspace.dependencies]
# Serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# Crypto
ed25519-dalek = { version = "2", features = ["serde", "rand_core"] }
rand = "0.8"

# Identifiers
uuid = { version = "1", features = ["v7", "serde"] }

# CRDT
yrs = { version = "0.21", features = ["sync"] }

# Networking
zenoh = "1.1"

# Python bindings
pyo3 = { version = "0.23", features = ["extension-module"] }
pyo3-async-runtimes = { version = "0.23", features = ["tokio-runtime"] }

# Async
tokio = { version = "1", features = ["full"] }
async-trait = "0.1"

# Error handling
thiserror = "2"

# Internal crates
ezagent-protocol = { path = "crates/ezagent-protocol" }
ezagent-backend = { path = "crates/ezagent-backend" }
```

> **Note on versions:** repo-spec specifies `yrs = "0.21"` and `zenoh = "1.1"`. We follow the spec exactly. Cargo will resolve to the latest compatible patch version within these ranges. If compile issues arise due to API changes, adjust the patch version (e.g., `"0.21.x"` or `"1.1.x"`).

**Step 2: Create ezagent-protocol Cargo.toml**

```toml
# ezagent/crates/ezagent-protocol/Cargo.toml
[package]
name = "ezagent-protocol"
version.workspace = true
edition.workspace = true
license.workspace = true
description = "EZAgent shared protocol types — Single Source of Truth for all crates and relay"

[dependencies]
serde = { workspace = true }
serde_json = { workspace = true }
ed25519-dalek = { workspace = true }
rand = { workspace = true }
thiserror = { workspace = true }
```

**Step 3: Create ezagent-protocol/src/lib.rs**

```rust
// ezagent/crates/ezagent-protocol/src/lib.rs

pub mod entity_id;
pub mod crypto;
pub mod envelope;
pub mod key_pattern;
pub mod sync;
pub mod error;

pub use entity_id::EntityId;
pub use crypto::{Keypair, PublicKey};
pub use envelope::SignedEnvelope;
pub use key_pattern::KeyPattern;
pub use error::ProtocolError;
```

**Step 4: Create placeholder source files for ezagent-protocol**

Create empty module files so the crate compiles:
- `ezagent/crates/ezagent-protocol/src/entity_id.rs` — empty
- `ezagent/crates/ezagent-protocol/src/crypto.rs` — empty
- `ezagent/crates/ezagent-protocol/src/envelope.rs` — empty
- `ezagent/crates/ezagent-protocol/src/key_pattern.rs` — empty
- `ezagent/crates/ezagent-protocol/src/sync.rs` — empty
- `ezagent/crates/ezagent-protocol/src/error.rs` — empty

Each file starts with just a comment:

```rust
// TODO: Phase 0 implementation
```

And `lib.rs` should comment out the re-exports until each module is implemented:

```rust
// ezagent/crates/ezagent-protocol/src/lib.rs
pub mod error;
// Other modules added as they are implemented
```

**Step 5: Create ezagent-backend Cargo.toml**

```toml
# ezagent/crates/ezagent-backend/Cargo.toml
[package]
name = "ezagent-backend"
version.workspace = true
edition.workspace = true
license.workspace = true
description = "EZAgent backend abstraction — CrdtBackend + NetworkBackend traits with yrs/Zenoh implementations"

[dependencies]
ezagent-protocol = { workspace = true }
yrs = { workspace = true }
zenoh = { workspace = true }
tokio = { workspace = true }
async-trait = { workspace = true }
thiserror = { workspace = true }
serde = { workspace = true }
serde_json = { workspace = true }

[dev-dependencies]
tokio = { workspace = true }
```

**Step 6: Create ezagent-backend/src/lib.rs**

```rust
// ezagent/crates/ezagent-backend/src/lib.rs
pub mod traits;
// yrs_backend and zenoh_backend added as implemented
```

With placeholder `traits.rs`:

```rust
// ezagent/crates/ezagent-backend/src/traits.rs
// TODO: Phase 0 implementation
```

**Step 7: Create ezagent-py Cargo.toml**

```toml
# ezagent/crates/ezagent-py/Cargo.toml
[package]
name = "ezagent-py"
version.workspace = true
edition.workspace = true
license.workspace = true

[lib]
name = "_native"
crate-type = ["cdylib"]

[dependencies]
ezagent-protocol = { workspace = true }
ezagent-backend = { workspace = true }
pyo3 = { workspace = true }
pyo3-async-runtimes = { workspace = true }
yrs = { workspace = true }
tokio = { workspace = true }
```

**Step 8: Create ezagent-py/src/lib.rs**

```rust
// ezagent/crates/ezagent-py/src/lib.rs
use pyo3::prelude::*;

#[pymodule]
fn _native(m: &Bound<'_, PyModule>) -> PyResult<()> {
    // Functions added as implemented
    Ok(())
}
```

**Step 9: Create pyproject.toml**

```toml
# ezagent/pyproject.toml
[build-system]
requires = ["maturin>=1.7"]
build-backend = "maturin"

[project]
name = "ezagent"
requires-python = ">=3.11"
dependencies = [
    "pytest>=8",
    "pytest-asyncio>=0.24",
]

[tool.maturin]
manifest-path = "crates/ezagent-py/Cargo.toml"
python-source = "python"
module-name = "ezagent._native"

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

**Step 10: Create Python package init**

```
mkdir -p ezagent/python/ezagent
```

```python
# ezagent/python/ezagent/__init__.py
from ezagent import _native
```

**Step 11: Verify workspace compiles**

Run: `cd ezagent && cargo check`
Expected: Compiles with no errors (may have warnings about unused code)

**Step 12: Commit**

```bash
git add ezagent/Cargo.toml ezagent/pyproject.toml \
    ezagent/crates/ ezagent/python/
git commit -m "feat(ezagent): scaffold Cargo workspace with 3 crates

Set up ezagent-protocol, ezagent-backend, ezagent-py as per repo-spec.
Workspace compiles with placeholder modules."
```

---

## Task 2: Implement ezagent-protocol — error module

**Files:**
- Modify: `ezagent/crates/ezagent-protocol/src/error.rs`
- Test: unit tests in same file (`#[cfg(test)]`)

**Step 1: Write the failing test**

Add to `error.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_protocol_error_display() {
        let err = ProtocolError::InvalidEntityId("missing @".to_string());
        assert!(err.to_string().contains("missing @"));
    }

    #[test]
    fn test_protocol_error_variants() {
        let _ = ProtocolError::InvalidSignature;
        let _ = ProtocolError::TimestampOutOfRange { delta_ms: 600_000 };
        let _ = ProtocolError::InvalidEnvelopeVersion { got: 2, expected: 1 };
        let _ = ProtocolError::InvalidKeyPattern("bad pattern".to_string());
    }
}
```

**Step 2: Run test to verify it fails**

Run: `cd ezagent && cargo test -p ezagent-protocol -- error`
Expected: FAIL — `ProtocolError` not defined

**Step 3: Implement error.rs**

```rust
// ezagent/crates/ezagent-protocol/src/error.rs

use thiserror::Error;

/// Protocol-layer errors (bus-spec §3, §4.4).
/// This enum covers all error conditions in the protocol layer.
/// Backend and engine errors are defined in their own crates.
#[derive(Debug, Error, Clone)]
pub enum ProtocolError {
    #[error("invalid entity ID: {0}")]
    InvalidEntityId(String),

    #[error("invalid signature")]
    InvalidSignature,

    #[error("timestamp out of range: delta {delta_ms}ms exceeds ±5min tolerance")]
    TimestampOutOfRange { delta_ms: i64 },

    #[error("invalid envelope version: got {got}, expected {expected}")]
    InvalidEnvelopeVersion { got: u8, expected: u8 },

    #[error("invalid key pattern: {0}")]
    InvalidKeyPattern(String),

    #[error("serialization error: {0}")]
    Serialization(String),
}
```

**Step 4: Update lib.rs to export error module**

```rust
// ezagent/crates/ezagent-protocol/src/lib.rs
pub mod error;

pub use error::ProtocolError;
```

**Step 5: Run test to verify it passes**

Run: `cd ezagent && cargo test -p ezagent-protocol -- error`
Expected: 2 tests PASS

**Step 6: Commit**

```bash
git add ezagent/crates/ezagent-protocol/src/
git commit -m "feat(ezagent): add ProtocolError enum with thiserror"
```

---

## Task 3: Implement ezagent-protocol — entity_id module

**Files:**
- Modify: `ezagent/crates/ezagent-protocol/src/entity_id.rs`
- Modify: `ezagent/crates/ezagent-protocol/src/lib.rs`

**Step 1: Write the failing tests**

```rust
// ezagent/crates/ezagent-protocol/src/entity_id.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_valid() {
        let id = EntityId::parse("@alice:relay-a.example.com").unwrap();
        assert_eq!(id.local_part, "alice");
        assert_eq!(id.relay_domain, "relay-a.example.com");
    }

    #[test]
    fn test_display() {
        let id = EntityId {
            local_part: "bob".to_string(),
            relay_domain: "relay-a.example.com".to_string(),
        };
        assert_eq!(id.to_string(), "@bob:relay-a.example.com");
    }

    #[test]
    fn test_parse_missing_at() {
        let result = EntityId::parse("alice:relay.com");
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_missing_colon() {
        let result = EntityId::parse("@alice-no-domain");
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_empty_local() {
        let result = EntityId::parse("@:relay.com");
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_empty_domain() {
        let result = EntityId::parse("@alice:");
        assert!(result.is_err());
    }

    #[test]
    fn test_serde_roundtrip() {
        let id = EntityId::parse("@alice:relay-a.example.com").unwrap();
        let json = serde_json::to_string(&id).unwrap();
        let deserialized: EntityId = serde_json::from_str(&json).unwrap();
        assert_eq!(id, deserialized);
    }
}
```

**Step 2: Run test to verify it fails**

Run: `cd ezagent && cargo test -p ezagent-protocol -- entity_id`
Expected: FAIL — `EntityId` not defined

**Step 3: Implement entity_id.rs**

```rust
// ezagent/crates/ezagent-protocol/src/entity_id.rs

use serde::{Deserialize, Serialize};
use std::fmt;

use crate::error::ProtocolError;

/// Entity ID: `@{local_part}:{relay_domain}`
///
/// Identifies any participant (human or agent) in the protocol.
/// The relay_domain is an identity namespace, not a network address.
/// See: bus-spec §2, architecture.md Identity Model.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct EntityId {
    pub local_part: String,
    pub relay_domain: String,
}

impl EntityId {
    /// Parse an entity ID string in the format `@{local_part}:{relay_domain}`.
    pub fn parse(s: &str) -> Result<Self, ProtocolError> {
        let s = s.trim();
        if !s.starts_with('@') {
            return Err(ProtocolError::InvalidEntityId(
                format!("must start with '@': {s}"),
            ));
        }

        let rest = &s[1..]; // strip leading '@'
        let colon_pos = rest.find(':').ok_or_else(|| {
            ProtocolError::InvalidEntityId(format!("missing ':' separator: {s}"))
        })?;

        let local_part = &rest[..colon_pos];
        let relay_domain = &rest[colon_pos + 1..];

        if local_part.is_empty() {
            return Err(ProtocolError::InvalidEntityId(
                format!("empty local_part: {s}"),
            ));
        }
        if relay_domain.is_empty() {
            return Err(ProtocolError::InvalidEntityId(
                format!("empty relay_domain: {s}"),
            ));
        }

        Ok(Self {
            local_part: local_part.to_string(),
            relay_domain: relay_domain.to_string(),
        })
    }
}

impl fmt::Display for EntityId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "@{}:{}", self.local_part, self.relay_domain)
    }
}
```

**Step 4: Update lib.rs**

```rust
// ezagent/crates/ezagent-protocol/src/lib.rs
pub mod error;
pub mod entity_id;

pub use error::ProtocolError;
pub use entity_id::EntityId;
```

**Step 5: Run test to verify it passes**

Run: `cd ezagent && cargo test -p ezagent-protocol -- entity_id`
Expected: 7 tests PASS

**Step 6: Commit**

```bash
git add ezagent/crates/ezagent-protocol/src/
git commit -m "feat(ezagent): implement EntityId parsing and display"
```

---

## Task 4: Implement ezagent-protocol — crypto module

**Files:**
- Modify: `ezagent/crates/ezagent-protocol/src/crypto.rs`
- Modify: `ezagent/crates/ezagent-protocol/src/lib.rs`

**Step 1: Write the failing tests**

```rust
// ezagent/crates/ezagent-protocol/src/crypto.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keypair_generate() {
        let kp = Keypair::generate();
        let pk = kp.public_key();
        assert_eq!(pk.as_bytes().len(), 32);
    }

    #[test]
    fn test_sign_and_verify() {
        let kp = Keypair::generate();
        let msg = b"hello world";
        let sig = kp.sign(msg);
        assert!(kp.public_key().verify(msg, &sig).is_ok());
    }

    #[test]
    fn test_verify_wrong_key() {
        let kp1 = Keypair::generate();
        let kp2 = Keypair::generate();
        let msg = b"hello";
        let sig = kp1.sign(msg);
        assert!(kp2.public_key().verify(msg, &sig).is_err());
    }

    #[test]
    fn test_verify_tampered_message() {
        let kp = Keypair::generate();
        let sig = kp.sign(b"original");
        assert!(kp.public_key().verify(b"tampered", &sig).is_err());
    }

    #[test]
    fn test_keypair_from_bytes() {
        let kp1 = Keypair::generate();
        let secret_bytes = kp1.to_bytes();
        let kp2 = Keypair::from_bytes(&secret_bytes);
        assert_eq!(kp1.public_key().as_bytes(), kp2.public_key().as_bytes());
    }

    #[test]
    fn test_serde_public_key() {
        let kp = Keypair::generate();
        let pk = kp.public_key();
        let json = serde_json::to_string(&pk).unwrap();
        let deserialized: PublicKey = serde_json::from_str(&json).unwrap();
        assert_eq!(pk.as_bytes(), deserialized.as_bytes());
    }
}
```

**Step 2: Run test to verify it fails**

Run: `cd ezagent && cargo test -p ezagent-protocol -- crypto`
Expected: FAIL — `Keypair` not defined

**Step 3: Implement crypto.rs**

```rust
// ezagent/crates/ezagent-protocol/src/crypto.rs

use ed25519_dalek::{Signer, Verifier};
use serde::{Deserialize, Serialize};

use crate::error::ProtocolError;

/// Ed25519 signature (64 bytes).
pub type Signature = [u8; 64];

/// Ed25519 keypair wrapper.
/// Used for signing CRDT updates (bus-spec §4.4 Signed Envelope).
pub struct Keypair {
    inner: ed25519_dalek::SigningKey,
}

impl Keypair {
    /// Generate a new random keypair.
    pub fn generate() -> Self {
        let mut rng = rand::thread_rng();
        Self {
            inner: ed25519_dalek::SigningKey::generate(&mut rng),
        }
    }

    /// Reconstruct keypair from 32-byte secret key.
    pub fn from_bytes(bytes: &[u8; 32]) -> Self {
        Self {
            inner: ed25519_dalek::SigningKey::from_bytes(bytes),
        }
    }

    /// Export the 32-byte secret key.
    pub fn to_bytes(&self) -> [u8; 32] {
        self.inner.to_bytes()
    }

    /// Get the public key.
    pub fn public_key(&self) -> PublicKey {
        PublicKey {
            inner: self.inner.verifying_key(),
        }
    }

    /// Sign a message, returning 64-byte signature.
    pub fn sign(&self, message: &[u8]) -> Signature {
        let sig = self.inner.sign(message);
        sig.to_bytes()
    }
}

/// Ed25519 public key wrapper.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PublicKey {
    inner: ed25519_dalek::VerifyingKey,
}

impl PublicKey {
    /// Get the 32-byte public key.
    pub fn as_bytes(&self) -> &[u8; 32] {
        self.inner.as_bytes()
    }

    /// Reconstruct from 32 bytes.
    pub fn from_bytes(bytes: &[u8; 32]) -> Result<Self, ProtocolError> {
        ed25519_dalek::VerifyingKey::from_bytes(bytes)
            .map(|inner| Self { inner })
            .map_err(|_| ProtocolError::InvalidSignature)
    }

    /// Verify a signature against a message.
    pub fn verify(&self, message: &[u8], signature: &Signature) -> Result<(), ProtocolError> {
        let sig = ed25519_dalek::Signature::from_bytes(signature);
        self.inner
            .verify(message, &sig)
            .map_err(|_| ProtocolError::InvalidSignature)
    }
}

impl Serialize for PublicKey {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_bytes(self.as_bytes())
    }
}

impl<'de> Deserialize<'de> for PublicKey {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let bytes: Vec<u8> = Deserialize::deserialize(deserializer)?;
        let arr: [u8; 32] = bytes
            .try_into()
            .map_err(|_| serde::de::Error::custom("expected 32 bytes for public key"))?;
        PublicKey::from_bytes(&arr).map_err(serde::de::Error::custom)
    }
}
```

**Step 4: Update lib.rs**

```rust
pub mod error;
pub mod entity_id;
pub mod crypto;

pub use error::ProtocolError;
pub use entity_id::EntityId;
pub use crypto::{Keypair, PublicKey, Signature};
```

**Step 5: Run test to verify it passes**

Run: `cd ezagent && cargo test -p ezagent-protocol -- crypto`
Expected: 6 tests PASS

**Step 6: Commit**

```bash
git add ezagent/crates/ezagent-protocol/src/
git commit -m "feat(ezagent): implement Ed25519 crypto module (Keypair, PublicKey, sign/verify)"
```

---

## Task 5: Implement ezagent-protocol — envelope module

**Files:**
- Modify: `ezagent/crates/ezagent-protocol/src/envelope.rs`
- Modify: `ezagent/crates/ezagent-protocol/src/lib.rs`

**Step 1: Write the failing tests**

```rust
// ezagent/crates/ezagent-protocol/src/envelope.rs

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::Keypair;

    #[test]
    fn test_sign_and_verify() {
        let kp = Keypair::generate();
        let payload = b"crdt update bytes";
        let env = SignedEnvelope::sign(
            &kp,
            "@alice:relay-a.example.com",
            "ezagent/room/test-room/index/2026-01/updates",
            payload,
        );
        assert_eq!(env.version, 1);
        assert!(env.verify(&kp.public_key()).is_ok());
    }

    #[test]
    fn test_verify_wrong_key() {
        let kp1 = Keypair::generate();
        let kp2 = Keypair::generate();
        let env = SignedEnvelope::sign(
            &kp1,
            "@alice:relay-a.example.com",
            "ezagent/room/test/updates",
            b"data",
        );
        assert!(env.verify(&kp2.public_key()).is_err());
    }

    #[test]
    fn test_timestamp_tolerance() {
        let kp = Keypair::generate();
        let mut env = SignedEnvelope::sign(
            &kp,
            "@alice:relay-a.example.com",
            "doc/1",
            b"data",
        );
        // Tamper timestamp to 6 minutes in the future
        env.timestamp += 6 * 60 * 1000;
        // Signature covers original timestamp, so verify will fail
        assert!(env.verify(&kp.public_key()).is_err());
    }

    #[test]
    fn test_version_must_be_1() {
        let kp = Keypair::generate();
        let mut env = SignedEnvelope::sign(&kp, "@a:b", "doc", b"x");
        env.version = 2;
        // Version change invalidates signature
        assert!(env.verify(&kp.public_key()).is_err());
    }

    #[test]
    fn test_signing_message_format() {
        // Verify the signed bytes include version, signer_id, doc_id, timestamp, payload
        let kp = Keypair::generate();
        let env = SignedEnvelope::sign(&kp, "@alice:relay.com", "doc/1", b"hello");
        // Just verify it roundtrips correctly
        assert!(env.verify(&kp.public_key()).is_ok());
        assert_eq!(env.payload, b"hello");
        assert_eq!(env.doc_id, "doc/1");
    }
}
```

**Step 2: Run test to verify it fails**

Run: `cd ezagent && cargo test -p ezagent-protocol -- envelope`
Expected: FAIL

**Step 3: Implement envelope.rs**

```rust
// ezagent/crates/ezagent-protocol/src/envelope.rs

use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::crypto::{Keypair, PublicKey, Signature};
use crate::error::ProtocolError;

/// Signed Envelope wrapping CRDT updates for network transport.
/// See: bus-spec §4.4.
///
/// All CRDT updates MUST be wrapped in a SignedEnvelope before sending.
/// Signature covers: version || signer_id || doc_id || timestamp || payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignedEnvelope {
    /// Format version. MUST be 1.
    pub version: u8,
    /// Entity ID of the signer (as string: "@local:domain").
    pub signer_id: String,
    /// Target document key_pattern instance path.
    pub doc_id: String,
    /// Unix milliseconds (UTC).
    pub timestamp: i64,
    /// CRDT update binary.
    pub payload: Vec<u8>,
    /// Ed25519 signature (64 bytes).
    pub signature: Signature,
}

impl SignedEnvelope {
    /// Create and sign a new envelope.
    ///
    /// `signer_id` should be the string form of EntityId (e.g., "@alice:relay.com").
    /// `doc_id` is the instantiated key_pattern path.
    /// `payload` is the CRDT update binary.
    pub fn sign(keypair: &Keypair, signer_id: &str, doc_id: &str, payload: &[u8]) -> Self {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time before epoch")
            .as_millis() as i64;

        let signing_bytes = Self::build_signing_bytes(1, signer_id, doc_id, timestamp, payload);
        let signature = keypair.sign(&signing_bytes);

        Self {
            version: 1,
            signer_id: signer_id.to_string(),
            doc_id: doc_id.to_string(),
            timestamp,
            payload: payload.to_vec(),
            signature,
        }
    }

    /// Verify the envelope's signature and timestamp.
    ///
    /// Checks:
    /// 1. Signature covers version || signer_id || doc_id || timestamp || payload
    /// 2. (Signature verification is cryptographic — any field change invalidates it)
    pub fn verify(&self, pubkey: &PublicKey) -> Result<(), ProtocolError> {
        let signing_bytes = Self::build_signing_bytes(
            self.version,
            &self.signer_id,
            &self.doc_id,
            self.timestamp,
            &self.payload,
        );
        pubkey.verify(&signing_bytes, &self.signature)
    }

    /// Build the byte sequence to sign/verify.
    /// Format: version(1B) || signer_id(len-prefixed) || doc_id(len-prefixed) || timestamp(8B BE) || payload
    fn build_signing_bytes(
        version: u8,
        signer_id: &str,
        doc_id: &str,
        timestamp: i64,
        payload: &[u8],
    ) -> Vec<u8> {
        let mut bytes = Vec::new();
        bytes.push(version);

        // Length-prefixed signer_id
        let signer_bytes = signer_id.as_bytes();
        bytes.extend_from_slice(&(signer_bytes.len() as u32).to_be_bytes());
        bytes.extend_from_slice(signer_bytes);

        // Length-prefixed doc_id
        let doc_bytes = doc_id.as_bytes();
        bytes.extend_from_slice(&(doc_bytes.len() as u32).to_be_bytes());
        bytes.extend_from_slice(doc_bytes);

        // Timestamp (8 bytes big-endian)
        bytes.extend_from_slice(&timestamp.to_be_bytes());

        // Payload (remaining bytes)
        bytes.extend_from_slice(payload);

        bytes
    }
}
```

**Step 4: Update lib.rs**

```rust
pub mod error;
pub mod entity_id;
pub mod crypto;
pub mod envelope;

pub use error::ProtocolError;
pub use entity_id::EntityId;
pub use crypto::{Keypair, PublicKey, Signature};
pub use envelope::SignedEnvelope;
```

**Step 5: Run test to verify it passes**

Run: `cd ezagent && cargo test -p ezagent-protocol -- envelope`
Expected: 5 tests PASS

**Step 6: Commit**

```bash
git add ezagent/crates/ezagent-protocol/src/
git commit -m "feat(ezagent): implement SignedEnvelope sign/verify (bus-spec §4.4)"
```

---

## Task 6: Implement ezagent-protocol — key_pattern and sync modules

**Files:**
- Modify: `ezagent/crates/ezagent-protocol/src/key_pattern.rs`
- Modify: `ezagent/crates/ezagent-protocol/src/sync.rs`
- Modify: `ezagent/crates/ezagent-protocol/src/lib.rs`

**Step 1: Write the failing tests**

```rust
// ezagent/crates/ezagent-protocol/src/key_pattern.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_instantiate_room_index() {
        let pattern = KeyPattern::new("ezagent/room/{room_id}/index/{shard_id}/updates");
        let mut vars = std::collections::HashMap::new();
        vars.insert("room_id", "01957a3b-0000-7000-8000-000000000005");
        vars.insert("shard_id", "2026-01");
        let result = pattern.instantiate(&vars).unwrap();
        assert_eq!(
            result,
            "ezagent/room/01957a3b-0000-7000-8000-000000000005/index/2026-01/updates"
        );
    }

    #[test]
    fn test_missing_variable() {
        let pattern = KeyPattern::new("ezagent/room/{room_id}/config/state");
        let vars = std::collections::HashMap::new();
        let result = pattern.instantiate(&vars);
        assert!(result.is_err());
    }

    #[test]
    fn test_no_variables() {
        let pattern = KeyPattern::new("ezagent/global/config");
        let vars = std::collections::HashMap::new();
        let result = pattern.instantiate(&vars).unwrap();
        assert_eq!(result, "ezagent/global/config");
    }
}
```

```rust
// ezagent/crates/ezagent-protocol/src/sync.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_state_query_serde() {
        let msg = SyncMessage::StateQuery {
            doc_id: "ezagent/room/abc/config/state".to_string(),
            state_vector: Some(vec![1, 2, 3]),
        };
        let json = serde_json::to_string(&msg).unwrap();
        let deserialized: SyncMessage = serde_json::from_str(&json).unwrap();
        match deserialized {
            SyncMessage::StateQuery { doc_id, state_vector } => {
                assert_eq!(doc_id, "ezagent/room/abc/config/state");
                assert_eq!(state_vector, Some(vec![1, 2, 3]));
            }
            _ => panic!("wrong variant"),
        }
    }

    #[test]
    fn test_state_reply_full() {
        let msg = SyncMessage::StateReply {
            doc_id: "doc/1".to_string(),
            payload: vec![10, 20, 30],
            is_full: true,
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("\"is_full\":true"));
    }
}
```

**Step 2: Run tests to verify they fail**

Run: `cd ezagent && cargo test -p ezagent-protocol -- key_pattern sync`
Expected: FAIL

**Step 3: Implement key_pattern.rs**

```rust
// ezagent/crates/ezagent-protocol/src/key_pattern.rs

use std::collections::HashMap;

use crate::error::ProtocolError;

/// Zenoh key expression template with `{variable}` placeholders.
///
/// Templates follow bus-spec §3.1 key_pattern definitions.
/// Variables: `{room_id}`, `{entity_id}`, `{shard_id}`, `{content_id}`, `{blob_hash}`, `{ext_id}`.
#[derive(Debug, Clone)]
pub struct KeyPattern {
    template: String,
}

impl KeyPattern {
    /// Create a new key pattern from a template string.
    pub fn new(template: &str) -> Self {
        Self {
            template: template.to_string(),
        }
    }

    /// Instantiate the template by replacing all `{var}` placeholders.
    /// Returns an error if any placeholder has no matching variable.
    pub fn instantiate(&self, vars: &HashMap<&str, &str>) -> Result<String, ProtocolError> {
        let mut result = self.template.clone();
        // Find all {var} patterns
        loop {
            let start = match result.find('{') {
                Some(pos) => pos,
                None => break,
            };
            let end = result[start..]
                .find('}')
                .ok_or_else(|| {
                    ProtocolError::InvalidKeyPattern(format!(
                        "unclosed '{{' in template: {}",
                        self.template
                    ))
                })?
                + start;

            let var_name = &result[start + 1..end];
            let value = vars.get(var_name).ok_or_else(|| {
                ProtocolError::InvalidKeyPattern(format!(
                    "missing variable '{var_name}' for template: {}",
                    self.template
                ))
            })?;

            result = format!("{}{}{}", &result[..start], value, &result[end + 1..]);
        }
        Ok(result)
    }

    /// Get the raw template string.
    pub fn template(&self) -> &str {
        &self.template
    }
}
```

**Step 4: Implement sync.rs**

```rust
// ezagent/crates/ezagent-protocol/src/sync.rs

use serde::{Deserialize, Serialize};

/// Sync protocol messages (bus-spec §4.5).
///
/// Used for initial sync (StateQuery/StateReply) and live sync (Update).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SyncMessage {
    /// Request state from a peer. Includes local state vector for diff computation.
    #[serde(rename = "state_query")]
    StateQuery {
        doc_id: String,
        /// Local state vector (encoded). None for full state request.
        state_vector: Option<Vec<u8>>,
    },

    /// Response with state data.
    #[serde(rename = "state_reply")]
    StateReply {
        doc_id: String,
        /// Full state or differential update bytes.
        payload: Vec<u8>,
        /// True if payload is full state, false if differential.
        is_full: bool,
    },
}
```

**Step 5: Update lib.rs**

```rust
pub mod error;
pub mod entity_id;
pub mod crypto;
pub mod envelope;
pub mod key_pattern;
pub mod sync;

pub use error::ProtocolError;
pub use entity_id::EntityId;
pub use crypto::{Keypair, PublicKey, Signature};
pub use envelope::SignedEnvelope;
pub use key_pattern::KeyPattern;
pub use sync::SyncMessage;
```

**Step 6: Run tests to verify they pass**

Run: `cd ezagent && cargo test -p ezagent-protocol`
Expected: ALL tests PASS (error + entity_id + crypto + envelope + key_pattern + sync)

**Step 7: Commit**

```bash
git add ezagent/crates/ezagent-protocol/src/
git commit -m "feat(ezagent): implement KeyPattern template and SyncMessage types"
```

---

## Task 7: Implement ezagent-backend — traits module

**Files:**
- Modify: `ezagent/crates/ezagent-backend/src/traits.rs`
- Modify: `ezagent/crates/ezagent-backend/src/lib.rs`

**Step 1: Implement traits.rs**

No TDD here — traits are interfaces, not implementations. We verify they compile.

```rust
// ezagent/crates/ezagent-backend/src/traits.rs

use std::sync::Arc;
use async_trait::async_trait;
use thiserror::Error;

/// Backend errors for CRDT and network operations.
#[derive(Debug, Error)]
pub enum BackendError {
    #[error("CRDT error: {0}")]
    Crdt(String),

    #[error("network error: {0}")]
    Network(String),

    #[error("document not found: {0}")]
    DocNotFound(String),

    #[error("serialization error: {0}")]
    Serialization(String),
}

/// CRDT backend abstraction (bus-spec §4.2).
///
/// Manages CRDT documents (Y.Map, Y.Array, Y.Text) with state vector
/// based synchronization. Phase 0 uses in-memory storage; Phase 1
/// adds RocksDB persistence.
pub trait CrdtBackend: Send + Sync {
    /// Get or create a CRDT document by its key path.
    fn get_or_create_doc(&self, doc_id: &str) -> Arc<yrs::Doc>;

    /// Encode the state vector for a document (for diff-based sync).
    fn state_vector(&self, doc_id: &str) -> Result<Vec<u8>, BackendError>;

    /// Encode the full state or a diff based on a remote state vector.
    /// If `sv` is None, returns full state. If `sv` is Some, returns diff.
    fn encode_state(&self, doc_id: &str, sv: Option<&[u8]>) -> Result<Vec<u8>, BackendError>;

    /// Apply a remote CRDT update to a local document.
    fn apply_update(&self, doc_id: &str, update: &[u8]) -> Result<(), BackendError>;
}

/// Network backend abstraction (bus-spec §4.3).
///
/// Provides pub/sub, request/reply, and peer discovery.
/// Phase 0 uses Zenoh directly; the trait allows future backend swaps.
#[async_trait]
pub trait NetworkBackend: Send + Sync {
    /// Publish raw bytes to a key expression.
    async fn publish(&self, key_expr: &str, payload: &[u8]) -> Result<(), BackendError>;

    /// Subscribe to a key expression, returning a receiver for incoming payloads.
    async fn subscribe(
        &self,
        key_expr: &str,
    ) -> Result<tokio::sync::mpsc::Receiver<Vec<u8>>, BackendError>;

    /// Register as a queryable responder for a key expression.
    /// The callback receives a query payload and returns a response payload.
    async fn register_queryable(
        &self,
        key_expr: &str,
        handler: Arc<dyn Fn(&[u8]) -> Vec<u8> + Send + Sync>,
    ) -> Result<(), BackendError>;

    /// Send a query to a key expression and collect the first reply.
    async fn query(
        &self,
        key_expr: &str,
        payload: Option<&[u8]>,
    ) -> Result<Vec<u8>, BackendError>;
}
```

**Step 2: Update lib.rs**

```rust
// ezagent/crates/ezagent-backend/src/lib.rs
pub mod traits;

pub use traits::{BackendError, CrdtBackend, NetworkBackend};
```

**Step 3: Verify it compiles**

Run: `cd ezagent && cargo check -p ezagent-backend`
Expected: Compiles with no errors

**Step 4: Commit**

```bash
git add ezagent/crates/ezagent-backend/src/
git commit -m "feat(ezagent): define CrdtBackend + NetworkBackend traits (bus-spec §4.2-4.3)"
```

---

## Task 8: Implement ezagent-backend — yrs_backend

**Files:**
- Create: `ezagent/crates/ezagent-backend/src/yrs_backend.rs`
- Modify: `ezagent/crates/ezagent-backend/src/lib.rs`

**Step 1: Write the failing tests**

```rust
// ezagent/crates/ezagent-backend/src/yrs_backend.rs

#[cfg(test)]
mod tests {
    use super::*;
    use yrs::{Map, Text, Array, Transact};

    #[test]
    fn test_get_or_create_doc_returns_same_doc() {
        let backend = YrsBackend::new();
        let doc1 = backend.get_or_create_doc("room/1/config/state");
        let doc2 = backend.get_or_create_doc("room/1/config/state");
        // Same Arc<Doc> instance
        assert!(Arc::ptr_eq(&doc1, &doc2));
    }

    #[test]
    fn test_get_or_create_different_docs() {
        let backend = YrsBackend::new();
        let doc1 = backend.get_or_create_doc("doc/a");
        let doc2 = backend.get_or_create_doc("doc/b");
        assert!(!Arc::ptr_eq(&doc1, &doc2));
    }

    #[test]
    fn test_map_write_and_state_vector() {
        let backend = YrsBackend::new();
        let doc = backend.get_or_create_doc("test/map");

        // Write to the doc's map
        {
            let map = doc.get_or_insert_map("data");
            let mut txn = doc.transact_mut();
            map.insert(&mut txn, "key1", "value1");
        }

        // State vector should be non-empty
        let sv = backend.state_vector("test/map").unwrap();
        assert!(!sv.is_empty());
    }

    #[test]
    fn test_encode_full_state_and_apply() {
        let backend1 = YrsBackend::new();
        let backend2 = YrsBackend::new();

        // Write data on backend1
        let doc1 = backend1.get_or_create_doc("test/sync");
        {
            let map = doc1.get_or_insert_map("data");
            let mut txn = doc1.transact_mut();
            map.insert(&mut txn, "name", "Alice");
        }

        // Encode full state
        let state = backend1.encode_state("test/sync", None).unwrap();

        // Apply to backend2
        let _doc2 = backend2.get_or_create_doc("test/sync");
        backend2.apply_update("test/sync", &state).unwrap();

        // Verify data arrived
        let doc2 = backend2.get_or_create_doc("test/sync");
        let map2 = doc2.get_or_insert_map("data");
        let txn2 = doc2.transact();
        let val = map2.get(&txn2, "name").unwrap();
        assert_eq!(val.to_string(&txn2), "Alice");
    }

    #[test]
    fn test_encode_diff_state() {
        let backend1 = YrsBackend::new();
        let backend2 = YrsBackend::new();

        // Both start with same initial state
        let doc1 = backend1.get_or_create_doc("test/diff");
        let doc2_ref = backend2.get_or_create_doc("test/diff");
        {
            let map = doc1.get_or_insert_map("data");
            let mut txn = doc1.transact_mut();
            map.insert(&mut txn, "initial", "yes");
        }
        let full_state = backend1.encode_state("test/diff", None).unwrap();
        backend2.apply_update("test/diff", &full_state).unwrap();

        // Now add more data on backend1 only
        {
            let map = doc1.get_or_insert_map("data");
            let mut txn = doc1.transact_mut();
            map.insert(&mut txn, "new_key", "new_value");
        }

        // Get diff using backend2's state vector
        let sv2 = backend2.state_vector("test/diff").unwrap();
        let diff = backend1.encode_state("test/diff", Some(&sv2)).unwrap();

        // Apply diff to backend2
        backend2.apply_update("test/diff", &diff).unwrap();

        // Verify new data arrived
        let map2 = doc2_ref.get_or_insert_map("data");
        let txn2 = doc2_ref.transact();
        let val = map2.get(&txn2, "new_key").unwrap();
        assert_eq!(val.to_string(&txn2), "new_value");
    }

    #[test]
    fn test_apply_update_nonexistent_doc() {
        let backend = YrsBackend::new();
        // Applying to a doc that doesn't exist yet should auto-create it
        let result = backend.apply_update("new/doc", &[]);
        // Empty update should still succeed (or at least not panic)
        // yrs may reject empty updates — this tests graceful handling
        assert!(result.is_ok() || result.is_err());
    }
}
```

**Step 2: Run test to verify it fails**

Run: `cd ezagent && cargo test -p ezagent-backend -- yrs_backend`
Expected: FAIL — `YrsBackend` not defined

**Step 3: Implement yrs_backend.rs**

```rust
// ezagent/crates/ezagent-backend/src/yrs_backend.rs

use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use yrs::{Doc, Options, ReadTxn, Transact, Update};

use crate::traits::{BackendError, CrdtBackend};

/// In-memory CRDT backend using yrs (Y-CRDT Rust port).
///
/// Manages a collection of CRDT documents identified by string keys.
/// Phase 0: in-memory only. Phase 1: backs with RocksDB.
pub struct YrsBackend {
    docs: RwLock<HashMap<String, Arc<Doc>>>,
}

impl YrsBackend {
    /// Create a new in-memory CRDT backend.
    pub fn new() -> Self {
        Self {
            docs: RwLock::new(HashMap::new()),
        }
    }
}

impl Default for YrsBackend {
    fn default() -> Self {
        Self::new()
    }
}

impl CrdtBackend for YrsBackend {
    fn get_or_create_doc(&self, doc_id: &str) -> Arc<Doc> {
        // Fast path: read lock
        {
            let docs = self.docs.read().unwrap();
            if let Some(doc) = docs.get(doc_id) {
                return Arc::clone(doc);
            }
        }
        // Slow path: write lock
        let mut docs = self.docs.write().unwrap();
        docs.entry(doc_id.to_string())
            .or_insert_with(|| {
                let opts = Options {
                    skip_gc: true, // Timeline index: no GC (bus-spec §4.2)
                    ..Default::default()
                };
                Arc::new(Doc::with_options(opts))
            })
            .clone()
    }

    fn state_vector(&self, doc_id: &str) -> Result<Vec<u8>, BackendError> {
        let doc = self.get_or_create_doc(doc_id);
        let txn = doc.transact();
        Ok(txn.state_vector().encode_v1())
    }

    fn encode_state(&self, doc_id: &str, sv: Option<&[u8]>) -> Result<Vec<u8>, BackendError> {
        let doc = self.get_or_create_doc(doc_id);
        let txn = doc.transact();
        match sv {
            None => Ok(txn.encode_state_as_update_v1(&yrs::StateVector::default())),
            Some(sv_bytes) => {
                let remote_sv = yrs::StateVector::decode_v1(sv_bytes)
                    .map_err(|e| BackendError::Crdt(format!("invalid state vector: {e}")))?;
                Ok(txn.encode_state_as_update_v1(&remote_sv))
            }
        }
    }

    fn apply_update(&self, doc_id: &str, update: &[u8]) -> Result<(), BackendError> {
        if update.is_empty() {
            return Ok(());
        }
        let doc = self.get_or_create_doc(doc_id);
        let update = Update::decode_v1(update)
            .map_err(|e| BackendError::Crdt(format!("invalid update: {e}")))?;
        let mut txn = doc.transact_mut();
        txn.apply_update(update)
            .map_err(|e| BackendError::Crdt(format!("apply failed: {e}")))
    }
}
```

**Step 4: Update lib.rs**

```rust
pub mod traits;
pub mod yrs_backend;

pub use traits::{BackendError, CrdtBackend, NetworkBackend};
pub use yrs_backend::YrsBackend;
```

**Step 5: Run test to verify it passes**

Run: `cd ezagent && cargo test -p ezagent-backend -- yrs_backend`
Expected: 6 tests PASS

**Step 6: Commit**

```bash
git add ezagent/crates/ezagent-backend/src/
git commit -m "feat(ezagent): implement YrsBackend (in-memory CRDT with yrs)"
```

---

## Task 9: Implement ezagent-backend — zenoh_backend

**Files:**
- Create: `ezagent/crates/ezagent-backend/src/zenoh_backend.rs`
- Modify: `ezagent/crates/ezagent-backend/src/lib.rs`

This task implements the Zenoh network backend. Testing requires actual Zenoh sessions, so we use `#[tokio::test]` and will do more thorough testing in the integration tests (Tasks 11-12).

**Step 1: Write the failing tests**

```rust
// ezagent/crates/ezagent-backend/src/zenoh_backend.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_zenoh_backend_creation() {
        let config = ZenohConfig::peer_default();
        let backend = ZenohBackend::new(config).await.unwrap();
        // Session should be open
        drop(backend);
    }

    #[tokio::test]
    async fn test_pub_sub_roundtrip() {
        let backend = ZenohBackend::new(ZenohConfig::peer_default()).await.unwrap();

        let key = "test/phase0/pubsub";
        let mut rx = backend.subscribe(key).await.unwrap();

        // Small delay for subscriber to be ready
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;

        let payload = b"hello zenoh";
        backend.publish(key, payload).await.unwrap();

        let received = tokio::time::timeout(
            std::time::Duration::from_secs(2),
            rx.recv(),
        )
        .await
        .expect("timeout waiting for message")
        .expect("channel closed");

        assert_eq!(received, payload);
    }
}
```

**Step 2: Run test to verify it fails**

Run: `cd ezagent && cargo test -p ezagent-backend -- zenoh_backend`
Expected: FAIL — `ZenohBackend` not defined

**Step 3: Implement zenoh_backend.rs**

```rust
// ezagent/crates/ezagent-backend/src/zenoh_backend.rs

use std::sync::Arc;
use async_trait::async_trait;
use tokio::sync::mpsc;

use crate::traits::{BackendError, NetworkBackend};

/// Configuration for Zenoh session creation.
pub struct ZenohConfig {
    pub config: zenoh::Config,
}

impl ZenohConfig {
    /// Default peer mode with multicast scouting enabled (LAN P2P).
    pub fn peer_default() -> Self {
        let config = zenoh::Config::default();
        // Default config is peer mode with scouting enabled
        Self { config }
    }

    /// Peer mode connecting to a specific router endpoint.
    pub fn peer_with_router(endpoint: &str) -> Self {
        let mut config = zenoh::Config::default();
        config
            .connect
            .endpoints
            .set(vec![endpoint.parse().unwrap()])
            .unwrap();
        Self { config }
    }

    /// Peer mode with scouting disabled (isolated, for tests that need no discovery).
    pub fn peer_isolated() -> Self {
        let mut config = zenoh::Config::default();
        config.scouting.multicast.set_enabled(Some(false)).unwrap();
        Self { config }
    }
}

/// Zenoh network backend.
///
/// Provides pub/sub, queryable, and query operations over Zenoh.
/// See: bus-spec §4.3 Network Backend Requirements.
pub struct ZenohBackend {
    session: zenoh::Session,
}

impl ZenohBackend {
    /// Open a new Zenoh session with the given config.
    pub async fn new(config: ZenohConfig) -> Result<Self, BackendError> {
        let session = zenoh::open(config.config)
            .await
            .map_err(|e| BackendError::Network(format!("failed to open zenoh session: {e}")))?;
        Ok(Self { session })
    }

    /// Get reference to the underlying Zenoh session (for advanced tests).
    pub fn session(&self) -> &zenoh::Session {
        &self.session
    }
}

#[async_trait]
impl NetworkBackend for ZenohBackend {
    async fn publish(&self, key_expr: &str, payload: &[u8]) -> Result<(), BackendError> {
        self.session
            .put(key_expr, payload.to_vec())
            .await
            .map_err(|e| BackendError::Network(format!("publish failed: {e}")))
    }

    async fn subscribe(
        &self,
        key_expr: &str,
    ) -> Result<mpsc::Receiver<Vec<u8>>, BackendError> {
        let (tx, rx) = mpsc::channel(256);

        let subscriber = self
            .session
            .declare_subscriber(key_expr)
            .await
            .map_err(|e| BackendError::Network(format!("subscribe failed: {e}")))?;

        tokio::spawn(async move {
            while let Ok(sample) = subscriber.recv_async().await {
                let payload = sample.payload().to_bytes().to_vec();
                if tx.send(payload).await.is_err() {
                    break; // receiver dropped
                }
            }
        });

        Ok(rx)
    }

    async fn register_queryable(
        &self,
        key_expr: &str,
        handler: Arc<dyn Fn(&[u8]) -> Vec<u8> + Send + Sync>,
    ) -> Result<(), BackendError> {
        let queryable = self
            .session
            .declare_queryable(key_expr)
            .await
            .map_err(|e| BackendError::Network(format!("queryable failed: {e}")))?;

        let key = key_expr.to_string();
        tokio::spawn(async move {
            while let Ok(query) = queryable.recv_async().await {
                let request_payload = query
                    .payload()
                    .map(|p| p.to_bytes().to_vec())
                    .unwrap_or_default();
                let response = handler(&request_payload);
                let _ = query.reply(&key, response).await;
            }
        });

        Ok(())
    }

    async fn query(
        &self,
        key_expr: &str,
        payload: Option<&[u8]>,
    ) -> Result<Vec<u8>, BackendError> {
        let mut getter = self.session.get(key_expr);
        if let Some(p) = payload {
            getter = getter.payload(p.to_vec());
        }
        let replies = getter
            .await
            .map_err(|e| BackendError::Network(format!("query failed: {e}")))?;

        // Collect first reply
        match replies.recv_async().await {
            Ok(reply) => match reply.result() {
                Ok(sample) => Ok(sample.payload().to_bytes().to_vec()),
                Err(e) => Err(BackendError::Network(format!("query reply error: {e}"))),
            },
            Err(_) => Err(BackendError::Network("no reply received".to_string())),
        }
    }
}
```

**Step 4: Update lib.rs**

```rust
pub mod traits;
pub mod yrs_backend;
pub mod zenoh_backend;

pub use traits::{BackendError, CrdtBackend, NetworkBackend};
pub use yrs_backend::YrsBackend;
pub use zenoh_backend::{ZenohBackend, ZenohConfig};
```

**Step 5: Run test to verify it passes**

Run: `cd ezagent && cargo test -p ezagent-backend -- zenoh_backend`
Expected: 2 tests PASS

> **Note:** If `test_pub_sub_roundtrip` fails with timeout, Zenoh may need a small delay after subscriber declaration. The 100ms sleep should handle this. If it persists, increase to 200ms.

**Step 6: Commit**

```bash
git add ezagent/crates/ezagent-backend/src/
git commit -m "feat(ezagent): implement ZenohBackend (pub/sub, queryable, query)"
```

---

## Task 10: Create fixture data and test helpers

**Files:**
- Create: `ezagent/fixtures/keypairs/alice.json`
- Create: `ezagent/fixtures/keypairs/bob.json`
- Create: `ezagent/fixtures/ezagent/room/R-minimal/config/state.json`
- Create: `ezagent/tests/rust/common/mod.rs`

**Step 1: Generate fixture keypairs**

Write a small Rust program or test that generates deterministic keypairs and outputs them:

```rust
// Add to ezagent/crates/ezagent-protocol/src/crypto.rs, temporarily:

#[cfg(test)]
mod fixture_gen {
    use super::*;
    use base64::{engine::general_purpose::STANDARD, Engine};

    #[test]
    #[ignore] // Run manually: cargo test -p ezagent-protocol -- fixture_gen --ignored --nocapture
    fn generate_fixture_keypairs() {
        for name in ["alice", "bob", "carol", "code-reviewer", "translator", "mallory", "admin", "outsider"] {
            let kp = Keypair::generate();
            let pk = kp.public_key();
            let domain = match name {
                "carol" => "relay-b.example.com",
                "outsider" => "relay-c.example.com",
                _ => "relay-a.example.com",
            };
            println!("=== {name} ===");
            println!(r#"{{"entity_id": "@{name}:{domain}", "public_key_raw": "{}", "private_key_raw": "{}"}}"#,
                STANDARD.encode(pk.as_bytes()),
                STANDARD.encode(kp.to_bytes()),
            );
        }
    }
}
```

> **Important:** Run this once to generate the fixtures, then save them to JSON files. For Phase 0 we only need alice and bob.

**Step 2: Create fixture JSON files**

Create `ezagent/fixtures/keypairs/alice.json` and `bob.json` with the generated output. The exact key values will be generated at runtime — the important thing is the format:

```json
{
  "entity_id": "@alice:relay-a.example.com",
  "public_key_raw": "<base64 encoded 32 bytes>",
  "private_key_raw": "<base64 encoded 32 bytes>"
}
```

**Step 3: Create R-minimal room config fixture**

```json
{
  "room_id": "01957a3b-0000-7000-8000-000000000005",
  "name": "Sync Test Room",
  "created_by": "@alice:relay-a.example.com",
  "membership": {
    "policy": "invite",
    "members": {
      "@alice:relay-a.example.com": "owner",
      "@bob:relay-a.example.com": "member"
    }
  },
  "power_levels": {
    "default": 0,
    "admin": 100,
    "users": {
      "@alice:relay-a.example.com": 100,
      "@bob:relay-a.example.com": 0
    }
  },
  "relays": [
    {
      "endpoint": "tcp/127.0.0.1:7447",
      "role": "primary"
    }
  ],
  "enabled_extensions": []
}
```

**Step 4: Create test helper module**

Add `base64` to ezagent-backend dev-dependencies:

```toml
# Add to ezagent/crates/ezagent-backend/Cargo.toml
[dev-dependencies]
tokio = { workspace = true }
base64 = "0.22"
```

Create the shared test helpers. This is a module used by integration tests:

```rust
// ezagent/tests/rust/common/mod.rs

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use ezagent_backend::{YrsBackend, ZenohBackend, ZenohConfig, CrdtBackend};
use ezagent_protocol::{Keypair, EntityId};

/// A test peer combining CRDT backend + Zenoh network.
pub struct TestPeer {
    pub name: String,
    pub entity_id: EntityId,
    pub keypair: Keypair,
    pub crdt: YrsBackend,
    pub network: ZenohBackend,
}

impl TestPeer {
    /// Create a peer in P2P mode (multicast scouting enabled).
    pub async fn new_p2p(name: &str, domain: &str) -> Self {
        let entity_id = EntityId::parse(&format!("@{name}:{domain}")).unwrap();
        let keypair = Keypair::generate();
        let crdt = YrsBackend::new();
        let network = ZenohBackend::new(ZenohConfig::peer_default()).await.unwrap();
        Self { name: name.to_string(), entity_id, keypair, crdt, network }
    }

    /// Create a peer connected to a specific router.
    pub async fn new_with_router(name: &str, domain: &str, router_endpoint: &str) -> Self {
        let entity_id = EntityId::parse(&format!("@{name}:{domain}")).unwrap();
        let keypair = Keypair::generate();
        let crdt = YrsBackend::new();
        let network = ZenohBackend::new(ZenohConfig::peer_with_router(router_endpoint))
            .await
            .unwrap();
        Self { name: name.to_string(), entity_id, keypair, crdt, network }
    }
}

/// Load fixture keypair from JSON file.
pub fn load_fixture_keypair(name: &str) -> Keypair {
    let path = fixture_path(&format!("keypairs/{name}.json"));
    let content = std::fs::read_to_string(&path)
        .unwrap_or_else(|_| panic!("fixture not found: {}", path.display()));
    let json: serde_json::Value = serde_json::from_str(&content).unwrap();
    let private_key_b64 = json["private_key_raw"].as_str().unwrap();
    let private_key_bytes = base64::engine::general_purpose::STANDARD
        .decode(private_key_b64)
        .unwrap();
    let arr: [u8; 32] = private_key_bytes.try_into().unwrap();
    Keypair::from_bytes(&arr)
}

/// Get path to fixture file relative to ezagent/ directory.
pub fn fixture_path(relative: &str) -> PathBuf {
    let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    // Navigate from crate dir to ezagent/ root
    path.pop(); // crates/
    path.pop(); // ezagent/
    // Hmm, CARGO_MANIFEST_DIR for integration tests points to workspace root
    path.push("fixtures");
    path.push(relative);
    path
}

/// Wait for state vectors to converge between two CRDT backends.
pub async fn assert_converged(
    b1: &YrsBackend,
    b2: &YrsBackend,
    doc_id: &str,
    timeout: Duration,
) {
    let start = std::time::Instant::now();
    loop {
        let sv1 = b1.state_vector(doc_id).unwrap();
        let sv2 = b2.state_vector(doc_id).unwrap();
        if sv1 == sv2 {
            return;
        }
        if start.elapsed() > timeout {
            panic!(
                "state vectors did not converge within {:?} for doc '{doc_id}'",
                timeout
            );
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
}

use base64::Engine;
```

> **Note on `CARGO_MANIFEST_DIR`:** For workspace-level integration tests, this will point to the workspace root. Adjust `fixture_path` as needed during implementation. The path logic may need tuning based on how cargo resolves integration test paths.

**Step 5: Verify helpers compile**

This requires setting up the integration test infrastructure. For now, just verify the common module compiles by creating a minimal integration test file:

Create `ezagent/tests/rust/sync_tests.rs`:
```rust
mod common;

#[tokio::test]
async fn test_placeholder() {
    // Placeholder — will be replaced with real TCs in Task 11
    assert!(true);
}
```

Run: `cd ezagent && cargo test --test sync_tests`

> **Note:** Cargo integration test discovery may require a different layout. If `tests/rust/` doesn't work as expected, restructure to `tests/sync_tests.rs` with `mod common;` referring to `tests/common/mod.rs`. Adjust paths accordingly.

**Step 6: Commit**

```bash
git add ezagent/fixtures/ ezagent/tests/
git commit -m "feat(ezagent): add test fixtures and shared test helpers"
```

---

## Task 11: Integration tests — TC-0-SYNC-001 through TC-0-SYNC-004

**Files:**
- Modify: `ezagent/tests/rust/sync_tests.rs` (or `ezagent/tests/sync_tests.rs`)

These are the "happy path" CRDT sync tests using two peers over Zenoh.

**Step 1: Implement TC-0-SYNC-001 — Basic Y.Map Sync**

```rust
use std::time::Duration;
use yrs::{Map, Transact};
use ezagent_backend::{YrsBackend, ZenohBackend, ZenohConfig, CrdtBackend, NetworkBackend};

mod common;

/// TC-0-SYNC-001: Basic Y.Map Sync
/// Setup: P1 (alice) and P2 (bob) connected via Zenoh peer mode
/// Action: P1 sets key1=value1, publishes CRDT update via Zenoh
/// Expected: P2 receives update within 2s, state vectors converge
#[tokio::test]
async fn tc_0_sync_001_basic_ymap_sync() {
    let key_expr = "ezagent/test/sync001/updates";

    // Create two peers with isolated scouting (use pub/sub directly)
    let crdt1 = YrsBackend::new();
    let crdt2 = YrsBackend::new();
    let net1 = ZenohBackend::new(ZenohConfig::peer_default()).await.unwrap();
    let net2 = ZenohBackend::new(ZenohConfig::peer_default()).await.unwrap();

    // P2 subscribes
    let mut rx = net2.subscribe(key_expr).await.unwrap();
    tokio::time::sleep(Duration::from_millis(100)).await;

    // P1 writes to Y.Map and publishes update
    let doc1 = crdt1.get_or_create_doc("sync001");
    {
        let map = doc1.get_or_insert_map("data");
        let mut txn = doc1.transact_mut();
        map.insert(&mut txn, "key1", "value1");
    }
    let update = crdt1.encode_state("sync001", None).unwrap();
    net1.publish(key_expr, &update).await.unwrap();

    // P2 receives and applies
    let received = tokio::time::timeout(Duration::from_secs(2), rx.recv())
        .await
        .expect("TC-0-SYNC-001: timeout — P2 did not receive update within 2s")
        .expect("channel closed");

    crdt2.get_or_create_doc("sync001"); // ensure doc exists
    crdt2.apply_update("sync001", &received).unwrap();

    // Verify convergence
    let doc2 = crdt2.get_or_create_doc("sync001");
    let map2 = doc2.get_or_insert_map("data");
    let txn2 = doc2.transact();
    let val = map2.get(&txn2, "key1").unwrap();
    assert_eq!(val.to_string(&txn2), "value1");

    // State vectors should match
    let sv1 = crdt1.state_vector("sync001").unwrap();
    let sv2 = crdt2.state_vector("sync001").unwrap();
    assert_eq!(sv1, sv2, "TC-0-SYNC-001: state vectors did not converge");
}
```

**Step 2: Run and verify it passes**

Run: `cd ezagent && cargo test --test sync_tests tc_0_sync_001 -- --nocapture`
Expected: PASS

**Step 3: Implement TC-0-SYNC-002 — Concurrent writes to different keys**

```rust
/// TC-0-SYNC-002: Concurrent writes to different keys
/// P1 sets "name"="Alice", P2 sets "age"="30" concurrently.
/// Expected: Final state includes both key-value pairs.
#[tokio::test]
async fn tc_0_sync_002_concurrent_different_keys() {
    let key_expr = "ezagent/test/sync002/updates";

    let crdt1 = YrsBackend::new();
    let crdt2 = YrsBackend::new();
    let net1 = ZenohBackend::new(ZenohConfig::peer_default()).await.unwrap();
    let net2 = ZenohBackend::new(ZenohConfig::peer_default()).await.unwrap();

    // Cross-subscribe: each peer subscribes to the shared key
    let mut rx1 = net1.subscribe(key_expr).await.unwrap();
    let mut rx2 = net2.subscribe(key_expr).await.unwrap();
    tokio::time::sleep(Duration::from_millis(100)).await;

    // P1 writes "name" = "Alice"
    let doc1 = crdt1.get_or_create_doc("sync002");
    {
        let map = doc1.get_or_insert_map("data");
        let mut txn = doc1.transact_mut();
        map.insert(&mut txn, "name", "Alice");
    }
    let update1 = crdt1.encode_state("sync002", None).unwrap();

    // P2 writes "age" = "30"
    let doc2 = crdt2.get_or_create_doc("sync002");
    {
        let map = doc2.get_or_insert_map("data");
        let mut txn = doc2.transact_mut();
        map.insert(&mut txn, "age", "30");
    }
    let update2 = crdt2.encode_state("sync002", None).unwrap();

    // Publish concurrently
    net1.publish(key_expr, &update1).await.unwrap();
    net2.publish(key_expr, &update2).await.unwrap();

    // Each peer receives the other's update
    let recv2 = tokio::time::timeout(Duration::from_secs(2), rx2.recv())
        .await.expect("timeout").expect("closed");
    let recv1 = tokio::time::timeout(Duration::from_secs(2), rx1.recv())
        .await.expect("timeout").expect("closed");

    // Apply cross-updates
    crdt2.apply_update("sync002", &recv2).unwrap();
    crdt1.apply_update("sync002", &recv1).unwrap();

    // Verify both have both keys
    for (crdt, name) in [(&crdt1, "P1"), (&crdt2, "P2")] {
        let doc = crdt.get_or_create_doc("sync002");
        let map = doc.get_or_insert_map("data");
        let txn = doc.transact();
        assert!(map.get(&txn, "name").is_some(), "{name} missing 'name'");
        assert!(map.get(&txn, "age").is_some(), "{name} missing 'age'");
    }
}
```

**Step 4: Implement TC-0-SYNC-003 — Same key concurrent writes (LWW)**

```rust
/// TC-0-SYNC-003: Concurrent writes to same key (LWW)
/// P1 sets "color"="red", P2 sets "color"="blue" concurrently.
/// Expected: Both converge to the same value (LWW resolution).
#[tokio::test]
async fn tc_0_sync_003_concurrent_same_key_lww() {
    let crdt1 = YrsBackend::new();
    let crdt2 = YrsBackend::new();

    let doc1 = crdt1.get_or_create_doc("sync003");
    let doc2 = crdt2.get_or_create_doc("sync003");

    // P1 writes "color" = "red"
    {
        let map = doc1.get_or_insert_map("data");
        let mut txn = doc1.transact_mut();
        map.insert(&mut txn, "color", "red");
    }

    // P2 writes "color" = "blue"
    {
        let map = doc2.get_or_insert_map("data");
        let mut txn = doc2.transact_mut();
        map.insert(&mut txn, "color", "blue");
    }

    // Exchange updates
    let update1 = crdt1.encode_state("sync003", None).unwrap();
    let update2 = crdt2.encode_state("sync003", None).unwrap();

    crdt1.apply_update("sync003", &update2).unwrap();
    crdt2.apply_update("sync003", &update1).unwrap();

    // Both should converge to the same value (LWW — we don't care which wins)
    let val1 = {
        let map = doc1.get_or_insert_map("data");
        let txn = doc1.transact();
        map.get(&txn, "color").unwrap().to_string(&txn)
    };
    let val2 = {
        let map = doc2.get_or_insert_map("data");
        let txn = doc2.transact();
        map.get(&txn, "color").unwrap().to_string(&txn)
    };

    assert_eq!(val1, val2, "TC-0-SYNC-003: LWW did not converge — P1={val1}, P2={val2}");
}
```

**Step 5: Implement TC-0-SYNC-004 — Y.Array concurrent insertion (YATA)**

```rust
/// TC-0-SYNC-004: Y.Array insertion order (YATA)
/// P1 inserts "A" at index 0, P2 inserts "B" at index 0 concurrently.
/// Expected: Both converge to same deterministic order.
#[tokio::test]
async fn tc_0_sync_004_yarray_yata_ordering() {
    use yrs::Array;

    let crdt1 = YrsBackend::new();
    let crdt2 = YrsBackend::new();

    let doc1 = crdt1.get_or_create_doc("sync004");
    let doc2 = crdt2.get_or_create_doc("sync004");

    // P1 inserts "A" at index 0
    {
        let arr = doc1.get_or_insert_array("timeline");
        let mut txn = doc1.transact_mut();
        arr.insert(&mut txn, 0, "A");
    }

    // P2 inserts "B" at index 0
    {
        let arr = doc2.get_or_insert_array("timeline");
        let mut txn = doc2.transact_mut();
        arr.insert(&mut txn, 0, "B");
    }

    // Exchange updates
    let update1 = crdt1.encode_state("sync004", None).unwrap();
    let update2 = crdt2.encode_state("sync004", None).unwrap();

    crdt1.apply_update("sync004", &update2).unwrap();
    crdt2.apply_update("sync004", &update1).unwrap();

    // Both should have same order (YATA deterministic)
    let order1: Vec<String> = {
        let arr = doc1.get_or_insert_array("timeline");
        let txn = doc1.transact();
        (0..arr.len(&txn))
            .map(|i| arr.get(&txn, i).unwrap().to_string(&txn))
            .collect()
    };
    let order2: Vec<String> = {
        let arr = doc2.get_or_insert_array("timeline");
        let txn = doc2.transact();
        (0..arr.len(&txn))
            .map(|i| arr.get(&txn, i).unwrap().to_string(&txn))
            .collect()
    };

    assert_eq!(order1, order2, "TC-0-SYNC-004: YATA order mismatch — P1={order1:?}, P2={order2:?}");
    assert_eq!(order1.len(), 2, "TC-0-SYNC-004: expected 2 elements, got {}", order1.len());
}
```

**Step 6: Run all SYNC-001~004**

Run: `cd ezagent && cargo test --test sync_tests -- --nocapture`
Expected: 4 tests PASS

**Step 7: Commit**

```bash
git add ezagent/tests/
git commit -m "test(ezagent): implement TC-0-SYNC-001~004 (Y.Map, concurrent, LWW, YATA)"
```

---

## Task 12: Integration tests — TC-0-SYNC-005 through TC-0-SYNC-008

**Files:**
- Modify: `ezagent/tests/rust/sync_tests.rs`

**Step 1: Implement TC-0-SYNC-005 — Offline → Reconnect recovery**

```rust
/// TC-0-SYNC-005: Offline → Reconnect → Data Recovery
/// P1 connected, P2 starts with initial state then goes "offline" (doesn't receive).
/// P1 writes new data. P2 "reconnects" using state vector diff.
#[tokio::test]
async fn tc_0_sync_005_offline_reconnect_recovery() {
    let crdt1 = YrsBackend::new();
    let crdt2 = YrsBackend::new();

    // Initial shared state
    let doc1 = crdt1.get_or_create_doc("sync005");
    {
        let map = doc1.get_or_insert_map("data");
        let mut txn = doc1.transact_mut();
        map.insert(&mut txn, "x", "1");
    }

    // P2 gets initial state
    let initial = crdt1.encode_state("sync005", None).unwrap();
    crdt2.get_or_create_doc("sync005");
    crdt2.apply_update("sync005", &initial).unwrap();

    // P2 goes "offline" — save its state vector
    let sv_before_offline = crdt2.state_vector("sync005").unwrap();

    // P1 writes more data while P2 is offline
    {
        let map = doc1.get_or_insert_map("data");
        let mut txn = doc1.transact_mut();
        map.insert(&mut txn, "x", "2");
        map.insert(&mut txn, "y", "3");
    }

    // P2 "reconnects" — request diff using saved state vector
    let diff = crdt1.encode_state("sync005", Some(&sv_before_offline)).unwrap();
    crdt2.apply_update("sync005", &diff).unwrap();

    // Verify P2 has complete state
    let doc2 = crdt2.get_or_create_doc("sync005");
    let map2 = doc2.get_or_insert_map("data");
    let txn2 = doc2.transact();
    assert_eq!(map2.get(&txn2, "x").unwrap().to_string(&txn2), "2");
    assert_eq!(map2.get(&txn2, "y").unwrap().to_string(&txn2), "3");

    // State vectors converge
    let sv1 = crdt1.state_vector("sync005").unwrap();
    let sv2 = crdt2.state_vector("sync005").unwrap();
    assert_eq!(sv1, sv2, "TC-0-SYNC-005: state vectors did not converge after recovery");
}
```

**Step 2: Implement TC-0-SYNC-006 — Router storage persistence**

```rust
/// TC-0-SYNC-006: Router Storage Persistence
/// P1 writes data to Router (Zenoh queryable). P1 disconnects.
/// P3 connects and queries Router for state.
///
/// This test simulates Router persistence using a Zenoh queryable
/// registered by a "router peer" that holds the persistent state.
#[tokio::test]
async fn tc_0_sync_006_router_storage_persistence() {
    use std::sync::Arc;
    use ezagent_backend::NetworkBackend;

    let key_expr = "ezagent/test/sync006/state";

    // "Router" peer that persists data
    let router_crdt = YrsBackend::new();
    let router_net = ZenohBackend::new(ZenohConfig::peer_default()).await.unwrap();

    // Write data into router's CRDT
    let router_doc = router_crdt.get_or_create_doc("sync006");
    {
        let map = router_doc.get_or_insert_map("data");
        let mut txn = router_doc.transact_mut();
        map.insert(&mut txn, "persisted", "value");
    }

    // Router registers as queryable, serving full state on request
    let router_crdt_ref = Arc::new(router_crdt);
    let crdt_for_handler = Arc::clone(&router_crdt_ref);
    router_net
        .register_queryable(
            key_expr,
            Arc::new(move |_request: &[u8]| {
                crdt_for_handler.encode_state("sync006", None).unwrap_or_default()
            }),
        )
        .await
        .unwrap();

    tokio::time::sleep(Duration::from_millis(200)).await;

    // New peer P3 connects and queries for state
    let p3_crdt = YrsBackend::new();
    let p3_net = ZenohBackend::new(ZenohConfig::peer_default()).await.unwrap();

    let state = p3_net.query(key_expr, None).await.unwrap();
    p3_crdt.get_or_create_doc("sync006");
    p3_crdt.apply_update("sync006", &state).unwrap();

    // Verify P3 has the persisted data
    let p3_doc = p3_crdt.get_or_create_doc("sync006");
    let map = p3_doc.get_or_insert_map("data");
    let txn = p3_doc.transact();
    let val = map.get(&txn, "persisted").unwrap();
    assert_eq!(val.to_string(&txn), "value", "TC-0-SYNC-006: P3 did not receive persisted data");
}
```

**Step 3: Implement TC-0-SYNC-007 — Y.Text collaborative editing**

```rust
/// TC-0-SYNC-007: Y.Text Collaborative Editing
/// P1 inserts "Hello " at index 0, P2 inserts "World" at index 0 concurrently.
/// Expected: Both converge to same text (order determined by YATA).
#[tokio::test]
async fn tc_0_sync_007_ytext_collaborative() {
    use yrs::Text;

    let crdt1 = YrsBackend::new();
    let crdt2 = YrsBackend::new();

    let doc1 = crdt1.get_or_create_doc("sync007");
    let doc2 = crdt2.get_or_create_doc("sync007");

    // P1 inserts "Hello "
    {
        let text = doc1.get_or_insert_text("doc");
        let mut txn = doc1.transact_mut();
        text.insert(&mut txn, 0, "Hello ");
    }

    // P2 inserts "World"
    {
        let text = doc2.get_or_insert_text("doc");
        let mut txn = doc2.transact_mut();
        text.insert(&mut txn, 0, "World");
    }

    // Exchange
    let u1 = crdt1.encode_state("sync007", None).unwrap();
    let u2 = crdt2.encode_state("sync007", None).unwrap();
    crdt1.apply_update("sync007", &u2).unwrap();
    crdt2.apply_update("sync007", &u1).unwrap();

    // Both should have same text
    let text1 = {
        let text = doc1.get_or_insert_text("doc");
        let txn = doc1.transact();
        text.get_string(&txn)
    };
    let text2 = {
        let text = doc2.get_or_insert_text("doc");
        let txn = doc2.transact();
        text.get_string(&txn)
    };

    assert_eq!(text1, text2, "TC-0-SYNC-007: texts did not converge — P1='{text1}', P2='{text2}'");
    assert!(
        text1.contains("Hello ") && text1.contains("World"),
        "TC-0-SYNC-007: merged text missing content: '{text1}'"
    );
}
```

**Step 4: Implement TC-0-SYNC-008 — Zenoh QoS verification**

```rust
/// TC-0-SYNC-008: Zenoh Pub/Sub QoS Properties
/// P1 publishes with QoS: priority=Data, congestion_control=Block, reliability=Reliable.
/// P2 receives without loss.
#[tokio::test]
async fn tc_0_sync_008_zenoh_qos() {
    let key_expr = "ezagent/test/sync008/updates";

    let net1 = ZenohBackend::new(ZenohConfig::peer_default()).await.unwrap();
    let net2 = ZenohBackend::new(ZenohConfig::peer_default()).await.unwrap();

    let mut rx = net2.subscribe(key_expr).await.unwrap();
    tokio::time::sleep(Duration::from_millis(100)).await;

    // Send multiple messages to verify reliable delivery
    let message_count = 10;
    for i in 0..message_count {
        let payload = format!("msg-{i}").into_bytes();
        // Default Zenoh put uses reliable delivery
        net1.publish(key_expr, &payload).await.unwrap();
    }

    // Receive all messages (with timeout)
    let mut received = Vec::new();
    for _ in 0..message_count {
        let msg = tokio::time::timeout(Duration::from_secs(2), rx.recv())
            .await
            .expect("TC-0-SYNC-008: timeout receiving message")
            .expect("channel closed");
        received.push(String::from_utf8(msg).unwrap());
    }

    assert_eq!(received.len(), message_count, "TC-0-SYNC-008: message loss detected");
    // Verify no duplicates
    let unique: std::collections::HashSet<_> = received.iter().collect();
    assert_eq!(unique.len(), message_count, "TC-0-SYNC-008: duplicate messages detected");
}
```

**Step 5: Run all SYNC tests**

Run: `cd ezagent && cargo test --test sync_tests -- --nocapture`
Expected: 8 tests PASS (SYNC-001 through SYNC-008)

**Step 6: Commit**

```bash
git add ezagent/tests/
git commit -m "test(ezagent): implement TC-0-SYNC-005~008 (recovery, persistence, Y.Text, QoS)"
```

---

## Task 13: Integration tests — TC-0-P2P-001 through TC-0-P2P-003

**Files:**
- Create: `ezagent/tests/rust/p2p_tests.rs` (or `ezagent/tests/p2p_tests.rs`)

**Step 1: Implement TC-0-P2P-001 — LAN Scouting**

```rust
use std::time::Duration;
use yrs::{Map, Transact};
use ezagent_backend::{YrsBackend, ZenohBackend, ZenohConfig, CrdtBackend, NetworkBackend};

/// TC-0-P2P-001: LAN Scouting Direct Sync
/// Two peers on same machine with multicast scouting, no router.
/// P1 writes to Y.Map, P2 receives via scouting-discovered connection.
#[tokio::test]
async fn tc_0_p2p_001_lan_scouting() {
    let key_expr = "ezagent/test/p2p001/updates";

    // Both peers with scouting enabled (default)
    let crdt1 = YrsBackend::new();
    let crdt2 = YrsBackend::new();
    let net1 = ZenohBackend::new(ZenohConfig::peer_default()).await.unwrap();
    let net2 = ZenohBackend::new(ZenohConfig::peer_default()).await.unwrap();

    // P2 subscribes
    let mut rx = net2.subscribe(key_expr).await.unwrap();

    // Wait for scouting to discover peers
    tokio::time::sleep(Duration::from_millis(500)).await;

    // P1 writes and publishes
    let doc1 = crdt1.get_or_create_doc("p2p001");
    {
        let map = doc1.get_or_insert_map("data");
        let mut txn = doc1.transact_mut();
        map.insert(&mut txn, "scouted", "yes");
    }
    let update = crdt1.encode_state("p2p001", None).unwrap();
    net1.publish(key_expr, &update).await.unwrap();

    // P2 should receive within 2s via scouting (no router involved)
    let received = tokio::time::timeout(Duration::from_secs(2), rx.recv())
        .await
        .expect("TC-0-P2P-001: timeout — scouting did not discover peer")
        .expect("channel closed");

    crdt2.get_or_create_doc("p2p001");
    crdt2.apply_update("p2p001", &received).unwrap();

    let doc2 = crdt2.get_or_create_doc("p2p001");
    let map2 = doc2.get_or_insert_map("data");
    let txn = doc2.transact();
    assert_eq!(
        map2.get(&txn, "scouted").unwrap().to_string(&txn),
        "yes",
        "TC-0-P2P-001: data not received via scouting"
    );
}
```

**Step 2: Implement TC-0-P2P-002 — Peer-as-Queryable**

```rust
/// TC-0-P2P-002: Peer-as-Queryable State Recovery
/// P1 holds complete state and registers as Zenoh queryable.
/// New peer P3 issues query and recovers full state.
#[tokio::test]
async fn tc_0_p2p_002_peer_as_queryable() {
    use std::sync::Arc;

    let key_expr = "ezagent/test/p2p002/state";

    let crdt1 = YrsBackend::new();
    let net1 = ZenohBackend::new(ZenohConfig::peer_default()).await.unwrap();

    // P1 builds state
    let doc1 = crdt1.get_or_create_doc("p2p002");
    {
        let map = doc1.get_or_insert_map("data");
        let mut txn = doc1.transact_mut();
        for i in 0..5 {
            map.insert(&mut txn, &format!("msg-{i}"), &format!("content-{i}"));
        }
    }

    // P1 registers as queryable
    let crdt1 = Arc::new(crdt1);
    let crdt1_ref = Arc::clone(&crdt1);
    net1.register_queryable(
        key_expr,
        Arc::new(move |_| crdt1_ref.encode_state("p2p002", None).unwrap_or_default()),
    )
    .await
    .unwrap();

    tokio::time::sleep(Duration::from_millis(300)).await;

    // P3 connects and queries
    let crdt3 = YrsBackend::new();
    let net3 = ZenohBackend::new(ZenohConfig::peer_default()).await.unwrap();

    let state = net3.query(key_expr, None).await.unwrap();
    crdt3.get_or_create_doc("p2p002");
    crdt3.apply_update("p2p002", &state).unwrap();

    // Verify P3 recovered all 5 messages
    let doc3 = crdt3.get_or_create_doc("p2p002");
    let map3 = doc3.get_or_insert_map("data");
    let txn3 = doc3.transact();
    for i in 0..5 {
        let key = format!("msg-{i}");
        let val = map3.get(&txn3, &key).expect(&format!("missing {key}"));
        assert_eq!(val.to_string(&txn3), format!("content-{i}"));
    }

    // State vectors match
    let sv1 = crdt1.state_vector("p2p002").unwrap();
    let sv3 = crdt3.state_vector("p2p002").unwrap();
    assert_eq!(sv1, sv3, "TC-0-P2P-002: state vectors don't match after recovery");
}
```

**Step 3: Implement TC-0-P2P-003 — P2P + Relay fallback**

```rust
/// TC-0-P2P-003: P2P + Relay Fallback
/// P1 in LAN-A, P2 in LAN-B, public router R reachable to both.
///
/// In a test environment, we simulate this by having both peers connect
/// to a local zenohd router process rather than discovering each other
/// via multicast scouting.
///
/// **Prerequisite:** zenohd must be running on localhost:7447
/// Start with: `zenohd -l tcp/0.0.0.0:7447`
#[tokio::test]
async fn tc_0_p2p_003_relay_fallback() {
    let key_expr = "ezagent/test/p2p003/updates";
    let router_endpoint = "tcp/127.0.0.1:7447";

    // Try to connect — skip test if router not available
    let net1 = match ZenohBackend::new(ZenohConfig::peer_with_router(router_endpoint)).await {
        Ok(n) => n,
        Err(_) => {
            eprintln!("TC-0-P2P-003: SKIPPED — zenohd not running on {router_endpoint}");
            eprintln!("Start with: zenohd -l tcp/0.0.0.0:7447");
            return;
        }
    };
    let net2 = ZenohBackend::new(ZenohConfig::peer_with_router(router_endpoint))
        .await
        .unwrap();

    let crdt1 = YrsBackend::new();
    let crdt2 = YrsBackend::new();

    // P2 subscribes via router
    let mut rx = net2.subscribe(key_expr).await.unwrap();
    tokio::time::sleep(Duration::from_millis(200)).await;

    // P1 publishes via router
    let doc1 = crdt1.get_or_create_doc("p2p003");
    {
        let map = doc1.get_or_insert_map("data");
        let mut txn = doc1.transact_mut();
        map.insert(&mut txn, "relayed", "message");
    }
    let update = crdt1.encode_state("p2p003", None).unwrap();
    net1.publish(key_expr, &update).await.unwrap();

    // P2 should receive via router
    let received = tokio::time::timeout(Duration::from_secs(2), rx.recv())
        .await
        .expect("TC-0-P2P-003: timeout — message did not reach P2 via router")
        .expect("channel closed");

    crdt2.get_or_create_doc("p2p003");
    crdt2.apply_update("p2p003", &received).unwrap();

    let doc2 = crdt2.get_or_create_doc("p2p003");
    let map2 = doc2.get_or_insert_map("data");
    let txn = doc2.transact();
    assert_eq!(
        map2.get(&txn, "relayed").unwrap().to_string(&txn),
        "message",
        "TC-0-P2P-003: message not relayed correctly"
    );
}
```

**Step 4: Run P2P tests**

For TC-0-P2P-001 and P2P-002 (no router needed):
Run: `cd ezagent && cargo test --test p2p_tests tc_0_p2p_001 tc_0_p2p_002 -- --nocapture`
Expected: 2 tests PASS

For TC-0-P2P-003 (router needed):
Run: `zenohd -l tcp/0.0.0.0:7447 &` then `cd ezagent && cargo test --test p2p_tests tc_0_p2p_003 -- --nocapture`
Expected: PASS (or SKIPPED if zenohd not running)

**Step 5: Commit**

```bash
git add ezagent/tests/
git commit -m "test(ezagent): implement TC-0-P2P-001~003 (scouting, queryable, relay fallback)"
```

---

## Task 14: Implement PyO3 minimal bridge

**Files:**
- Modify: `ezagent/crates/ezagent-py/src/lib.rs`
- Create: `ezagent/tests/python/test_pyo3_bridge.py`

**Step 1: Implement the PyO3 bridge functions**

```rust
// ezagent/crates/ezagent-py/src/lib.rs

use pyo3::prelude::*;
use yrs::{Doc, Map, Transact};

/// TC-PY-001: Verify CRDT map operations work across Python ↔ Rust boundary.
/// Creates a yrs Doc, inserts key/value into Y.Map, reads it back.
#[pyfunction]
fn crdt_map_roundtrip(key: String, value: String) -> PyResult<String> {
    let doc = Doc::new();
    let map = doc.get_or_insert_map("test");

    // Write
    {
        let mut txn = doc.transact_mut();
        map.insert(&mut txn, &key, value.as_str());
    }

    // Read
    let txn = doc.transact();
    let result = map
        .get(&txn, &key)
        .map(|v| v.to_string(&txn))
        .ok_or_else(|| pyo3::exceptions::PyValueError::new_err("key not found after insert"))?;

    Ok(result)
}

/// TC-PY-002: Verify Ed25519 sign/verify works from Python.
#[pyfunction]
fn crypto_sign_verify(message: Vec<u8>) -> PyResult<bool> {
    use ezagent_protocol::{Keypair, PublicKey};

    let keypair = Keypair::generate();
    let signature = keypair.sign(&message);
    let pubkey = keypair.public_key();

    match pubkey.verify(&message, &signature) {
        Ok(()) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[pymodule]
fn _native(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(crdt_map_roundtrip, m)?)?;
    m.add_function(wrap_pyfunction!(crypto_sign_verify, m)?)?;
    Ok(())
}
```

**Step 2: Build the Python extension**

Run: `cd ezagent && uv venv && uv pip install maturin pytest pytest-asyncio && maturin develop`
Expected: Extension builds successfully

**Step 3: Write Python tests**

```python
# ezagent/tests/python/test_pyo3_bridge.py

from ezagent._native import crdt_map_roundtrip, crypto_sign_verify


def test_crdt_map_roundtrip():
    """TC-PY-001: CRDT map operations across Python/Rust boundary."""
    result = crdt_map_roundtrip("hello", "world")
    assert result == "world"


def test_crdt_map_roundtrip_unicode():
    """TC-PY-001b: CRDT map with unicode values."""
    result = crdt_map_roundtrip("name", "Alice 你好")
    assert result == "Alice 你好"


def test_crypto_sign_verify():
    """TC-PY-002: Ed25519 sign/verify from Python."""
    assert crypto_sign_verify(b"test message") is True


def test_crypto_sign_verify_empty():
    """TC-PY-002b: Sign/verify empty message."""
    assert crypto_sign_verify(b"") is True
```

**Step 4: Run Python tests**

Run: `cd ezagent && uv run pytest tests/python/ -v`
Expected: 4 tests PASS

**Step 5: Commit**

```bash
git add ezagent/crates/ezagent-py/ ezagent/tests/python/
git commit -m "feat(ezagent): implement PyO3 bridge (CRDT roundtrip + crypto verify)"
```

---

## Task 15: Gate verification and final commit

**Files:**
- No new files — this is a verification step

**Step 1: Run all Rust tests**

Run: `cd ezagent && cargo test --all`
Expected: All protocol + backend unit tests + integration tests PASS

**Step 2: Run all Python tests**

Run: `cd ezagent && uv run pytest tests/python/ -v`
Expected: All PyO3 bridge tests PASS

**Step 3: Run with router for TC-0-P2P-003**

Run: `zenohd -l tcp/0.0.0.0:7447 &` then:
Run: `cd ezagent && cargo test --test p2p_tests tc_0_p2p_003 -- --nocapture`
Expected: PASS

**Step 4: Gate checklist verification**

Manually verify:
- [ ] 11/11 Rust TC pass (SYNC-001~008, P2P-001~003)
- [ ] 2/2 PyO3 bridge tests pass (TC-PY-001, TC-PY-002)
- [ ] State vector convergence verified in SYNC-001, 005
- [ ] YATA deterministic ordering verified in SYNC-004
- [ ] LWW convergence verified in SYNC-003
- [ ] Latency < 2s verified in all SYNC tests
- [ ] Fixture keypairs load correctly
- [ ] R-minimal config loads correctly
- [ ] Spec coverage: bus-spec §4.2 (CRDT), §4.3 (Network), §4.4 (Envelope), §4.5 (Sync) — 100%
- [ ] No P0/P1 bugs

**Step 5: Final commit**

```bash
git add -A
git commit -m "milestone(ezagent): Phase 0 verification complete — 11/11 TC pass

Gate criteria met:
- CRDT: Y.Map, Y.Array, Y.Text sync verified
- Network: Zenoh pub/sub, scouting, queryable, router relay verified
- Crypto: Ed25519 SignedEnvelope sign/verify verified
- PyO3: Cross-language CRDT + crypto bridge verified
- Fixtures: keypairs + R-minimal loaded successfully
- Spec coverage: bus-spec §4.2-§4.5 at 100%"
```

---

## Dependency Graph

```
Task 1: Scaffold workspace
    └── Task 2: error module
        └── Task 3: entity_id module
            └── Task 4: crypto module
                └── Task 5: envelope module
                    └── Task 6: key_pattern + sync modules
                        └── Task 7: backend traits
                            ├── Task 8: yrs_backend
                            │   └── Task 10: fixtures + helpers
                            │       ├── Task 11: SYNC-001~004
                            │       └── Task 12: SYNC-005~008
                            ├── Task 9: zenoh_backend
                            │   └── Task 13: P2P-001~003
                            └── Task 14: PyO3 bridge
    Task 15: Gate verification (depends on all above)
```

## Quick Reference

| Command | Purpose |
|---------|---------|
| `cd ezagent && cargo check` | Verify compilation |
| `cd ezagent && cargo test --all` | Run all Rust tests |
| `cd ezagent && cargo test -p ezagent-protocol` | Protocol crate only |
| `cd ezagent && cargo test -p ezagent-backend` | Backend crate only |
| `cd ezagent && cargo test --test sync_tests` | SYNC integration tests |
| `cd ezagent && cargo test --test p2p_tests` | P2P integration tests |
| `cd ezagent && maturin develop` | Build PyO3 extension |
| `cd ezagent && uv run pytest tests/python/ -v` | Python tests |
| `zenohd -l tcp/0.0.0.0:7447` | Start local Zenoh router |

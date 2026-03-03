//! TOML configuration parsing for the relay service.

use std::path::Path;

use serde::Deserialize;

use crate::error::{RelayError, Result};

/// Top-level relay configuration.
#[derive(Debug, Clone, Deserialize)]
pub struct RelayConfig {
    /// The relay's public domain name (e.g. "relay-a.example.com").
    pub domain: String,

    /// Listen address (e.g. "tls/0.0.0.0:7448").
    pub listen: String,

    /// Path to the RocksDB storage directory.
    pub storage_path: String,

    /// TLS certificate configuration.
    pub tls: TlsConfig,

    /// Whether to require authentication for all operations.
    #[serde(default)]
    pub require_auth: bool,

    /// Blob storage settings.
    #[serde(default)]
    pub blob: BlobConfig,

    /// Federation peer relay addresses.
    #[serde(default)]
    pub peers: Vec<String>,

    /// Port for the health-check HTTP endpoint.
    #[serde(default = "default_healthz_port")]
    pub healthz_port: u16,

    /// Entity IDs with admin privileges for the Admin API.
    #[serde(default)]
    pub admin_entities: Vec<String>,

    /// Default quota settings applied to all entities.
    #[serde(default)]
    pub quota: QuotaDefaults,
}

/// TLS certificate paths.
#[derive(Debug, Clone, Deserialize)]
pub struct TlsConfig {
    /// Path to the TLS certificate file.
    pub cert_path: String,

    /// Path to the TLS private key file.
    pub key_path: String,

    /// Optional path to a CA certificate for client verification.
    pub ca_path: Option<String>,
}

/// Blob storage configuration with sensible defaults.
#[derive(Debug, Clone, Deserialize)]
pub struct BlobConfig {
    /// Maximum blob size in bytes (default: 50 MiB).
    #[serde(default = "default_max_blob_size")]
    pub max_blob_size: u64,

    /// Days to retain orphaned blobs before GC (default: 7).
    #[serde(default = "default_orphan_retention_days")]
    pub orphan_retention_days: u32,

    /// Hours between GC runs (default: 24).
    #[serde(default = "default_gc_interval_hours")]
    pub gc_interval_hours: u32,
}

impl Default for BlobConfig {
    fn default() -> Self {
        Self {
            max_blob_size: default_max_blob_size(),
            orphan_retention_days: default_orphan_retention_days(),
            gc_interval_hours: default_gc_interval_hours(),
        }
    }
}

/// Default quota settings for all entities.
#[derive(Debug, Clone, Deserialize)]
pub struct QuotaDefaults {
    /// Maximum total CRDT storage per entity in bytes (default: 1 GiB).
    #[serde(default = "default_storage_total")]
    pub storage_total: u64,

    /// Maximum total blob storage per entity in bytes (default: 500 MiB).
    #[serde(default = "default_blob_total")]
    pub blob_total: u64,

    /// Maximum single blob size in bytes (default: 50 MiB).
    #[serde(default = "default_blob_single_max")]
    pub blob_single_max: u64,

    /// Maximum number of rooms an entity can participate in (default: 500).
    #[serde(default = "default_rooms_max")]
    pub rooms_max: u32,
}

impl Default for QuotaDefaults {
    fn default() -> Self {
        Self {
            storage_total: default_storage_total(),
            blob_total: default_blob_total(),
            blob_single_max: default_blob_single_max(),
            rooms_max: default_rooms_max(),
        }
    }
}

fn default_storage_total() -> u64 {
    1024 * 1024 * 1024 // 1 GiB
}

fn default_blob_total() -> u64 {
    500 * 1024 * 1024 // 500 MiB
}

fn default_blob_single_max() -> u64 {
    50 * 1024 * 1024 // 50 MiB
}

fn default_rooms_max() -> u32 {
    500
}

fn default_healthz_port() -> u16 {
    8080
}

fn default_max_blob_size() -> u64 {
    50 * 1024 * 1024 // 50 MiB
}

fn default_orphan_retention_days() -> u32 {
    7
}

fn default_gc_interval_hours() -> u32 {
    24
}

impl RelayConfig {
    /// Parse a `RelayConfig` from a TOML string.
    pub fn parse(s: &str) -> Result<Self> {
        let config: Self = toml::from_str(s).map_err(|e| RelayError::Config(e.to_string()))?;
        config.validate()?;
        Ok(config)
    }

    /// Load a `RelayConfig` from a TOML file on disk.
    pub fn from_file(path: &Path) -> Result<Self> {
        let contents = std::fs::read_to_string(path)
            .map_err(|e| RelayError::Config(format!("failed to read {}: {e}", path.display())))?;
        Self::parse(&contents)
    }

    /// Validate required fields.
    fn validate(&self) -> Result<()> {
        if self.domain.is_empty() {
            return Err(RelayError::Config("domain must not be empty".into()));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    /// TC-3-DEPLOY-004: A config missing the `domain` field is rejected.
    #[test]
    fn tc_3_deploy_004_missing_domain_rejected() {
        let toml = r#"
listen = "tls/0.0.0.0:7448"
storage_path = "/tmp/relay"

[tls]
cert_path = "/etc/relay/cert.pem"
key_path = "/etc/relay/key.pem"
"#;
        let err = RelayConfig::parse(toml).unwrap_err();
        let msg = err.to_string().to_lowercase();
        assert!(
            msg.contains("domain"),
            "expected error about domain, got: {err}"
        );
    }

    /// Parse a full config with every field specified.
    #[test]
    fn parse_full_config() {
        let toml = r#"
domain = "relay-a.example.com"
listen = "tls/0.0.0.0:7448"
storage_path = "/var/relay/data"
require_auth = true
healthz_port = 9090
peers = ["relay-b.example.com:7448"]

[tls]
cert_path = "/etc/relay/cert.pem"
key_path = "/etc/relay/key.pem"
ca_path = "/etc/relay/ca.pem"

[blob]
max_blob_size = 104857600
orphan_retention_days = 14
gc_interval_hours = 12
"#;
        let cfg = RelayConfig::parse(toml).unwrap();
        assert_eq!(cfg.domain, "relay-a.example.com");
        assert_eq!(cfg.listen, "tls/0.0.0.0:7448");
        assert_eq!(cfg.storage_path, "/var/relay/data");
        assert!(cfg.require_auth);
        assert_eq!(cfg.healthz_port, 9090);
        assert_eq!(cfg.peers, vec!["relay-b.example.com:7448"]);
        assert_eq!(cfg.tls.cert_path, "/etc/relay/cert.pem");
        assert_eq!(cfg.tls.key_path, "/etc/relay/key.pem");
        assert_eq!(cfg.tls.ca_path.as_deref(), Some("/etc/relay/ca.pem"));
        assert_eq!(cfg.blob.max_blob_size, 104_857_600);
        assert_eq!(cfg.blob.orphan_retention_days, 14);
        assert_eq!(cfg.blob.gc_interval_hours, 12);
    }

    /// Parse a minimal config and verify defaults are applied.
    #[test]
    fn parse_config_with_defaults() {
        let toml = r#"
domain = "relay.example.com"
listen = "tls/0.0.0.0:7448"
storage_path = "/tmp/relay"

[tls]
cert_path = "cert.pem"
key_path = "key.pem"
"#;
        let cfg = RelayConfig::parse(toml).unwrap();
        assert!(!cfg.require_auth);
        assert_eq!(cfg.healthz_port, 8080);
        assert!(cfg.peers.is_empty());
        assert_eq!(cfg.blob.max_blob_size, 50 * 1024 * 1024);
        assert_eq!(cfg.blob.orphan_retention_days, 7);
        assert_eq!(cfg.blob.gc_interval_hours, 24);
        assert!(cfg.tls.ca_path.is_none());
    }

    /// Config with admin_entities and quota parses correctly.
    #[test]
    fn parse_config_with_level2_fields() {
        let toml = r#"
domain = "relay.example.com"
listen = "tls/0.0.0.0:7448"
storage_path = "/tmp/relay"
admin_entities = ["@admin:relay.example.com"]

[tls]
cert_path = "cert.pem"
key_path = "key.pem"

[quota]
storage_total = 2147483648
blob_total = 1073741824
rooms_max = 100
"#;
        let cfg = RelayConfig::parse(toml).unwrap();
        assert_eq!(cfg.admin_entities, vec!["@admin:relay.example.com"]);
        assert_eq!(cfg.quota.storage_total, 2_147_483_648);
        assert_eq!(cfg.quota.blob_total, 1_073_741_824);
        assert_eq!(cfg.quota.rooms_max, 100);
        // blob_single_max should use default
        assert_eq!(cfg.quota.blob_single_max, 50 * 1024 * 1024);
    }

    /// Config without Level 2 fields still parses (defaults applied).
    #[test]
    fn parse_config_level2_defaults() {
        let toml = r#"
domain = "relay.example.com"
listen = "tls/0.0.0.0:7448"
storage_path = "/tmp/relay"

[tls]
cert_path = "cert.pem"
key_path = "key.pem"
"#;
        let cfg = RelayConfig::parse(toml).unwrap();
        assert!(cfg.admin_entities.is_empty());
        assert_eq!(cfg.quota.storage_total, 1024 * 1024 * 1024);
        assert_eq!(cfg.quota.rooms_max, 500);
    }

    /// Load config from a temporary file.
    #[test]
    fn parse_config_from_file() {
        let toml_content = r#"
domain = "file-relay.example.com"
listen = "tls/0.0.0.0:7448"
storage_path = "/tmp/relay"

[tls]
cert_path = "cert.pem"
key_path = "key.pem"
"#;
        let mut tmpfile = tempfile::NamedTempFile::new().unwrap();
        tmpfile.write_all(toml_content.as_bytes()).unwrap();
        tmpfile.flush().unwrap();

        let cfg = RelayConfig::from_file(tmpfile.path()).unwrap();
        assert_eq!(cfg.domain, "file-relay.example.com");
    }
}

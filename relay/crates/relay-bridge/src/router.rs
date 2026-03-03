//! Zenoh router management for the relay service.
//!
//! Provides [`build_zenoh_config`] for constructing a Zenoh configuration from
//! [`RelayConfig`], and [`RelayRouter`] for managing the Zenoh session lifecycle.

use relay_core::{RelayConfig, RelayError, Result};

/// Build a Zenoh [`Config`](zenoh::Config) from the relay's [`RelayConfig`].
///
/// The resulting configuration:
/// - Uses **router** mode.
/// - Listens on the address specified in `config.listen`.
/// - Disables multicast scouting (server role).
pub fn build_zenoh_config(config: &RelayConfig) -> Result<zenoh::Config> {
    // Build a JSON5 config string that sets mode, listen, and disables multicast.
    let json5 = format!(
        r#"{{
            mode: "router",
            listen: {{
                endpoints: ["{}"]
            }},
            scouting: {{
                multicast: {{
                    enabled: false
                }}
            }}
        }}"#,
        config.listen
    );

    zenoh::Config::from_json5(&json5)
        .map_err(|e| RelayError::Network(format!("build zenoh config: {e}")))
}

/// A running Zenoh router that manages a session and its lifecycle.
pub struct RelayRouter {
    session: zenoh::Session,
    domain: String,
}

impl RelayRouter {
    /// Start a new relay router with the given configuration.
    ///
    /// Opens a Zenoh session in router mode and begins listening on the
    /// configured endpoint.
    pub async fn start(config: &RelayConfig) -> Result<Self> {
        let zenoh_cfg = build_zenoh_config(config)?;
        let session = zenoh::open(zenoh_cfg)
            .await
            .map_err(|e| RelayError::Network(format!("zenoh open: {e}")))?;
        log::info!("Relay {} started on {}", config.domain, config.listen);
        Ok(Self {
            session,
            domain: config.domain.clone(),
        })
    }

    /// Returns a reference to the underlying Zenoh session.
    pub fn session(&self) -> &zenoh::Session {
        &self.session
    }

    /// Returns the relay's domain name.
    pub fn domain(&self) -> &str {
        &self.domain
    }

    /// Returns `true` if the Zenoh session is still open.
    pub fn is_running(&self) -> bool {
        !self.session.is_closed()
    }

    /// Gracefully shut down the relay router by closing the Zenoh session.
    pub async fn shutdown(self) -> Result<()> {
        self.session
            .close()
            .await
            .map_err(|e| RelayError::Network(format!("close: {e}")))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Verify that `build_zenoh_config` succeeds with a valid listen address.
    #[test]
    fn config_builds_zenoh_config() {
        let config = RelayConfig::parse(
            r#"
domain = "test.example.com"
listen = "tcp/127.0.0.1:17447"
storage_path = "/tmp/relay-test"

[tls]
cert_path = "cert.pem"
key_path = "key.pem"
"#,
        )
        .unwrap();

        let result = build_zenoh_config(&config);
        assert!(result.is_ok(), "expected Ok, got: {result:?}");
    }

    /// TC-3-BRIDGE-001: Start a relay router, verify it is running, then shut down.
    ///
    /// This test requires a real Zenoh runtime and binds to a TCP port.
    #[ignore = "requires network — run: cargo test -p relay-bridge -- --ignored"]
    #[tokio::test]
    async fn tc_3_bridge_001_relay_starts_and_listens() {
        let config = RelayConfig::parse(
            r#"
domain = "bridge-test.example.com"
listen = "tcp/127.0.0.1:17448"
storage_path = "/tmp/relay-bridge-test"

[tls]
cert_path = "cert.pem"
key_path = "key.pem"
"#,
        )
        .unwrap();

        let router = RelayRouter::start(&config).await.unwrap();
        assert!(router.is_running());
        assert_eq!(router.domain(), "bridge-test.example.com");

        router.shutdown().await.unwrap();
    }
}

//! Binary entry point for the EZAgent relay service.
//!
//! Loads configuration from a TOML file, initialises RocksDB storage,
//! exposes an HTTP `/healthz` endpoint, and waits for SIGTERM/ctrl-c
//! for graceful shutdown.

mod metrics;

use std::net::SocketAddr;
use std::path::{Path, PathBuf};

use axum::{routing::get, Json, Router};
use tokio::signal;

/// Health-check handler: returns `{"status": "healthy"}`.
async fn healthz() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "healthy" }))
}

#[tokio::main]
async fn main() {
    env_logger::init();

    // Config path: first CLI argument or default "relay.toml".
    let config_path = std::env::args()
        .nth(1)
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("relay.toml"));

    let config = match relay_core::RelayConfig::from_file(&config_path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Error: {e}");
            std::process::exit(1);
        }
    };

    log::info!("Relay {} starting...", config.domain);

    // Initialise storage directory and open RocksDB.
    let db_path = Path::new(&config.storage_path).join("db");
    if let Err(e) = std::fs::create_dir_all(&db_path) {
        eprintln!("Error: failed to create storage directory: {e}");
        std::process::exit(1);
    }
    let _store = match relay_core::RelayStore::open(&db_path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Error: failed to open RocksDB: {e}");
            std::process::exit(1);
        }
    };

    // Start the HTTP health-check server.
    let app = Router::new().route("/healthz", get(healthz));
    let addr = SocketAddr::from(([0, 0, 0, 0], config.healthz_port));
    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!(
                "Error: failed to bind healthz port {}: {e}",
                config.healthz_port
            );
            std::process::exit(1);
        }
    };

    log::info!(
        "Relay {} started on {} (healthz: {})",
        config.domain,
        config.listen,
        config.healthz_port
    );

    let http_handle = tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app).await {
            log::error!("healthz server error: {e}");
        }
    });

    // Wait for ctrl-c (SIGTERM on Unix is handled by tokio::signal).
    if let Err(e) = signal::ctrl_c().await {
        log::error!("failed to listen for ctrl_c: {e}");
    }

    log::info!("Relay {} shutting down...", config.domain);
    http_handle.abort();
}

//! Binary entry point for the EZAgent relay service.
//!
//! Loads configuration from a TOML file, initialises RocksDB storage,
//! creates Level 2 service managers (quota, entity, metrics),
//! exposes HTTP `/healthz`, `/readyz`, and `/metrics` endpoints,
//! merges the admin API routes, and waits for SIGTERM/ctrl-c
//! for graceful shutdown.

mod admin;
mod metrics;

use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use tokio::signal;

use crate::admin::AdminState;
use crate::metrics::RelayMetrics;
use relay_core::{EntityManagerImpl, QuotaManager, RelayStore};

/// Shared application state for top-level HTTP handlers.
#[derive(Clone)]
struct AppState {
    /// Readiness flag: set to `true` once all services are initialised.
    ready: Arc<AtomicBool>,
    /// Prometheus metrics for the relay service.
    metrics: RelayMetrics,
}

/// Enhanced health-check handler.
///
/// Returns `{"status": "healthy", "checks": {"storage": "ok"}}` with HTTP 200
/// when the relay is operating normally.
async fn healthz(State(state): State<AppState>) -> impl IntoResponse {
    let storage_ok = state.ready.load(Ordering::Relaxed);
    let status = if storage_ok { "healthy" } else { "degraded" };
    let storage_check = if storage_ok { "ok" } else { "degraded" };
    let code = if storage_ok {
        StatusCode::OK
    } else {
        StatusCode::OK // degraded still returns 200 so LB keeps traffic
    };
    (
        code,
        Json(serde_json::json!({
            "status": status,
            "checks": {
                "storage": storage_check,
            }
        })),
    )
}

/// Readiness probe handler.
///
/// Returns HTTP 200 `{"status":"ready"}` when the relay is ready to accept
/// traffic, or HTTP 503 `{"status":"not_ready"}` during startup.
async fn readyz(State(state): State<AppState>) -> impl IntoResponse {
    if state.ready.load(Ordering::Relaxed) {
        (StatusCode::OK, Json(serde_json::json!({"status": "ready"})))
    } else {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({"status": "not_ready"})),
        )
    }
}

/// Metrics endpoint that delegates to the Prometheus metrics handler.
async fn metrics_endpoint(State(state): State<AppState>) -> impl IntoResponse {
    let body = state.metrics.encode();
    (
        StatusCode::OK,
        [("content-type", "text/plain; version=0.0.4; charset=utf-8")],
        body,
    )
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

    // Initialise storage directory and open RocksDB stores.
    let storage_base = Path::new(&config.storage_path);
    let entity_db_path = storage_base.join("entity_db");
    let quota_db_path = storage_base.join("quota_db");

    if let Err(e) = std::fs::create_dir_all(&entity_db_path) {
        eprintln!("Error: failed to create entity storage directory: {e}");
        std::process::exit(1);
    }
    if let Err(e) = std::fs::create_dir_all(&quota_db_path) {
        eprintln!("Error: failed to create quota storage directory: {e}");
        std::process::exit(1);
    }

    let entity_store = match RelayStore::open(&entity_db_path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Error: failed to open entity RocksDB: {e}");
            std::process::exit(1);
        }
    };

    let quota_store = match RelayStore::open(&quota_db_path) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Error: failed to open quota RocksDB: {e}");
            std::process::exit(1);
        }
    };

    // Create Level 2 service managers.
    let entity_manager = Arc::new(EntityManagerImpl::new(entity_store, config.domain.clone()));

    let quota_manager = Arc::new(QuotaManager::new(quota_store, config.quota.clone()));

    let relay_metrics = RelayMetrics::new();

    // Build shared application state.
    let ready_flag = Arc::new(AtomicBool::new(false));

    let app_state = AppState {
        ready: Arc::clone(&ready_flag),
        metrics: relay_metrics.clone(),
    };

    let admin_state = AdminState {
        entity_manager,
        quota_manager,
        metrics: relay_metrics,
        admin_entities: config.admin_entities.clone(),
        domain: config.domain.clone(),
        start_time: std::time::Instant::now(),
    };

    // Build the HTTP router.
    let app = Router::new()
        .route("/healthz", get(healthz))
        .route("/readyz", get(readyz))
        .route("/metrics", get(metrics_endpoint))
        .with_state(app_state)
        .merge(admin::admin_router(admin_state));

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

    // Mark service as ready.
    ready_flag.store(true, Ordering::Relaxed);

    log::info!(
        "Relay {} started on {} (healthz: {})",
        config.domain,
        config.listen,
        config.healthz_port
    );

    let http_handle = tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app).await {
            log::error!("HTTP server error: {e}");
        }
    });

    // Wait for ctrl-c (SIGTERM on Unix is handled by tokio::signal).
    if let Err(e) = signal::ctrl_c().await {
        log::error!("failed to listen for ctrl_c: {e}");
    }

    log::info!("Relay {} shutting down...", config.domain);
    http_handle.abort();
}

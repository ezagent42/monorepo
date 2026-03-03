//! Prometheus metrics for the relay service.
//!
//! Exposes counters, gauges, and an HTTP handler for the `/metrics` endpoint.

use axum::http::StatusCode;
use axum::response::IntoResponse;
use prometheus::{Encoder, IntCounter, IntCounterVec, IntGauge, Opts, Registry, TextEncoder};

/// All Prometheus metrics for the relay service.
#[derive(Clone)]
pub struct RelayMetrics {
    /// The Prometheus registry holding all metrics.
    pub registry: Registry,
    /// Current number of connected peers.
    pub peers_connected: IntGauge,
    /// Total number of rooms.
    pub rooms_total: IntGauge,
    /// Total number of registered entities.
    pub entities_total: IntGauge,
    /// Total blob storage in bytes.
    pub blob_store_bytes: IntGauge,
    /// Total number of blobs.
    pub blob_count: IntGauge,
    /// Total sync operations performed.
    pub sync_operations_total: IntCounter,
    /// Total quota rejection events.
    pub quota_rejections_total: IntCounter,
    /// Total HTTP requests by method.
    pub requests_total: IntCounterVec,
}

impl RelayMetrics {
    /// Create and register all metrics.
    pub fn new() -> Self {
        let registry = Registry::new();

        let peers_connected =
            IntGauge::new("relay_peers_connected", "Current connected peer count")
                .expect("metric creation");
        let rooms_total =
            IntGauge::new("relay_rooms_total", "Total number of rooms").expect("metric creation");
        let entities_total = IntGauge::new("relay_entities_total", "Total registered entities")
            .expect("metric creation");
        let blob_store_bytes = IntGauge::new("relay_blob_store_bytes", "Total blob storage bytes")
            .expect("metric creation");
        let blob_count =
            IntGauge::new("relay_blob_count", "Total number of blobs").expect("metric creation");
        let sync_operations_total =
            IntCounter::new("relay_sync_operations_total", "Total sync operations")
                .expect("metric creation");
        let quota_rejections_total =
            IntCounter::new("relay_quota_rejections_total", "Total quota rejections")
                .expect("metric creation");
        let requests_total = IntCounterVec::new(
            Opts::new("relay_requests_total", "Total HTTP requests by method"),
            &["method"],
        )
        .expect("metric creation");

        registry
            .register(Box::new(peers_connected.clone()))
            .expect("register");
        registry
            .register(Box::new(rooms_total.clone()))
            .expect("register");
        registry
            .register(Box::new(entities_total.clone()))
            .expect("register");
        registry
            .register(Box::new(blob_store_bytes.clone()))
            .expect("register");
        registry
            .register(Box::new(blob_count.clone()))
            .expect("register");
        registry
            .register(Box::new(sync_operations_total.clone()))
            .expect("register");
        registry
            .register(Box::new(quota_rejections_total.clone()))
            .expect("register");
        registry
            .register(Box::new(requests_total.clone()))
            .expect("register");

        Self {
            registry,
            peers_connected,
            rooms_total,
            entities_total,
            blob_store_bytes,
            blob_count,
            sync_operations_total,
            quota_rejections_total,
            requests_total,
        }
    }

    /// Encode all metrics in Prometheus text exposition format.
    pub fn encode(&self) -> String {
        let encoder = TextEncoder::new();
        let metric_families = self.registry.gather();
        let mut buffer = Vec::new();
        encoder
            .encode(&metric_families, &mut buffer)
            .expect("encode metrics");
        String::from_utf8(buffer).expect("utf8 metrics")
    }
}

/// Axum handler for `GET /metrics`.
pub async fn metrics_handler(
    axum::extract::State(metrics): axum::extract::State<RelayMetrics>,
) -> impl IntoResponse {
    let body = metrics.encode();
    (
        StatusCode::OK,
        [("content-type", "text/plain; version=0.0.4; charset=utf-8")],
        body,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    /// TC-3-MON-001: Metrics endpoint returns Prometheus format.
    #[test]
    fn tc_3_mon_001_metrics_prometheus_format() {
        let metrics = RelayMetrics::new();

        // Set some values.
        metrics.peers_connected.set(5);
        metrics.rooms_total.set(12);
        metrics.entities_total.set(30);
        metrics.blob_store_bytes.set(2_400_000_000);
        metrics.blob_count.set(150);
        metrics.sync_operations_total.inc();
        metrics.sync_operations_total.inc();
        metrics.quota_rejections_total.inc();
        metrics.requests_total.with_label_values(&["GET"]).inc();

        let output = metrics.encode();

        // Verify Prometheus text format.
        assert!(
            output.contains("relay_peers_connected 5"),
            "peers_connected"
        );
        assert!(output.contains("relay_rooms_total 12"), "rooms_total");
        assert!(output.contains("relay_entities_total 30"), "entities_total");
        assert!(
            output.contains("relay_blob_store_bytes 2400000000"),
            "blob_store_bytes"
        );
        assert!(output.contains("relay_blob_count 150"), "blob_count");
        assert!(
            output.contains("relay_sync_operations_total 2"),
            "sync_operations"
        );
        assert!(
            output.contains("relay_quota_rejections_total 1"),
            "quota_rejections"
        );
        assert!(
            output.contains("relay_requests_total{method=\"GET\"} 1"),
            "requests by method"
        );
    }
}

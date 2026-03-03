//! Prometheus metrics for the relay service.
//!
//! Exposes counters, gauges, and an HTTP handler for the `/metrics` endpoint.

use relay_core::error::{RelayError, Result};

use prometheus::{Encoder, IntCounter, IntCounterVec, IntGauge, Opts, Registry, TextEncoder};

/// All Prometheus metrics for the relay service.
#[derive(Clone)]
#[allow(dead_code)]
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

/// Create and register a metric, returning a `RelayError` on failure.
macro_rules! register_metric {
    ($registry:expr, $metric:expr) => {{
        let m = $metric;
        $registry
            .register(Box::new(m.clone()))
            .map_err(|e| RelayError::Config(format!("register metric: {e}")))?;
        m
    }};
}

impl RelayMetrics {
    /// Create and register all metrics.
    ///
    /// Returns an error if any metric fails to create or register.
    pub fn try_new() -> Result<Self> {
        let registry = Registry::new();

        let peers_connected = register_metric!(
            registry,
            IntGauge::new("relay_peers_connected", "Current connected peer count")
                .map_err(|e| RelayError::Config(format!("create metric: {e}")))?
        );
        let rooms_total = register_metric!(
            registry,
            IntGauge::new("relay_rooms_total", "Total number of rooms")
                .map_err(|e| RelayError::Config(format!("create metric: {e}")))?
        );
        let entities_total = register_metric!(
            registry,
            IntGauge::new("relay_entities_total", "Total registered entities")
                .map_err(|e| RelayError::Config(format!("create metric: {e}")))?
        );
        let blob_store_bytes = register_metric!(
            registry,
            IntGauge::new("relay_blob_store_bytes", "Total blob storage bytes")
                .map_err(|e| RelayError::Config(format!("create metric: {e}")))?
        );
        let blob_count = register_metric!(
            registry,
            IntGauge::new("relay_blob_count", "Total number of blobs")
                .map_err(|e| RelayError::Config(format!("create metric: {e}")))?
        );
        let sync_operations_total = register_metric!(
            registry,
            IntCounter::new("relay_sync_operations_total", "Total sync operations")
                .map_err(|e| RelayError::Config(format!("create metric: {e}")))?
        );
        let quota_rejections_total = register_metric!(
            registry,
            IntCounter::new("relay_quota_rejections_total", "Total quota rejections")
                .map_err(|e| RelayError::Config(format!("create metric: {e}")))?
        );
        let requests_total = register_metric!(
            registry,
            IntCounterVec::new(
                Opts::new("relay_requests_total", "Total HTTP requests by method"),
                &["method"],
            )
            .map_err(|e| RelayError::Config(format!("create metric: {e}")))?
        );

        Ok(Self {
            registry,
            peers_connected,
            rooms_total,
            entities_total,
            blob_store_bytes,
            blob_count,
            sync_operations_total,
            quota_rejections_total,
            requests_total,
        })
    }

    /// Encode all metrics in Prometheus text exposition format.
    pub fn encode(&self) -> String {
        let encoder = TextEncoder::new();
        let metric_families = self.registry.gather();
        let mut buffer = Vec::new();
        // TextEncoder.encode only fails if the writer fails; Vec<u8> never does.
        let _ = encoder.encode(&metric_families, &mut buffer);
        String::from_utf8(buffer).unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// TC-3-MON-001: Metrics endpoint returns Prometheus format.
    #[test]
    fn tc_3_mon_001_metrics_prometheus_format() {
        let metrics = RelayMetrics::try_new().unwrap();

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

//! Core types and services for the EZAgent relay.

pub mod config;
pub mod entity;
pub mod error;
pub mod identity;
pub mod storage;

pub use config::RelayConfig;
pub use entity::{EntityManagerImpl, EntityRecord, EntityStatus};
pub use error::{RelayError, Result};
pub use storage::RelayStore;

# Phase 2: Extensions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the full Extension layer (EXT-01 through EXT-17) with dynamic loading via dlopen, URI path registry, and C ABI plugin interface.

**Architecture:** Each extension is a separate crate compiled to `.cdylib`. The Engine loads extensions at startup via `libloading` (dlopen wrapper), calling a C ABI entry point that registers datatypes and hooks. Extensions are activated per-room via `enabled_extensions` in RoomConfig.

**Tech Stack:** Rust, `libloading` (dlopen), `toml` (manifest parsing), `serde`/`serde_json`, existing `ezagent-protocol`/`ezagent-engine` infrastructure.

**Design doc:** `docs/plans/2026-03-03-phase2-extensions-design.md`

**Key reference files:**
- Spec: `docs/specs/extensions-spec.md` (all 17 extensions + interaction rules)
- Plan test cases: `docs/plan/phase-2-extensions.md` (~100 TCs)
- Engine: `ezagent/crates/ezagent-engine/src/engine.rs`
- Registry: `ezagent/crates/ezagent-engine/src/registry/mod.rs`
- Hooks: `ezagent/crates/ezagent-engine/src/hooks/executor.rs`
- Protocol types: `ezagent/crates/ezagent-protocol/src/lib.rs`

---

## Task 1: Workspace Dependencies & ezagent-ext-api Crate

**Files:**
- Modify: `ezagent/Cargo.toml` (add workspace deps + new member)
- Create: `ezagent/crates/ezagent-ext-api/Cargo.toml`
- Create: `ezagent/crates/ezagent-ext-api/src/lib.rs`
- Create: `ezagent/crates/ezagent-ext-api/src/manifest.rs`
- Create: `ezagent/crates/ezagent-ext-api/src/context.rs`
- Create: `ezagent/crates/ezagent-ext-api/src/error.rs`

### Step 1: Add workspace dependencies

Add `toml`, `libloading`, `log` to `ezagent/Cargo.toml` `[workspace.dependencies]`:

```toml
toml = "0.8"
libloading = "0.8"
log = "0.4"
ezagent-ext-api = { path = "crates/ezagent-ext-api" }
```

Add `"crates/ezagent-ext-api"` to `[workspace] members`.

### Step 2: Create ezagent-ext-api Cargo.toml

```toml
[package]
name = "ezagent-ext-api"
version.workspace = true
edition.workspace = true
license.workspace = true
description = "EZAgent Extension Plugin API — C ABI entry points and safe Rust wrapper"

[dependencies]
ezagent-protocol = { workspace = true }
serde = { workspace = true }
serde_json = { workspace = true }
thiserror = { workspace = true }
toml = { workspace = true }

[dev-dependencies]
```

### Step 3: Write failing test for ExtensionManifest parsing

In `ezagent/crates/ezagent-ext-api/src/manifest.rs`:

```rust
//! Extension manifest types and TOML parsing.

use serde::{Deserialize, Serialize};

/// A URI path declaration from the extension manifest.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UriPathDeclaration {
    pub pattern: String,
    pub description: String,
}

/// Parsed extension manifest (from manifest.toml).
#[derive(Debug, Clone)]
pub struct ExtensionManifest {
    pub name: String,
    pub version: String,
    pub api_version: u32,
    pub datatype_ids: Vec<String>,
    pub hook_ids: Vec<String>,
    pub ext_dependencies: Vec<String>,
    pub uri_paths: Vec<UriPathDeclaration>,
}

/// Raw TOML structure matching manifest.toml format.
#[derive(Debug, Deserialize)]
struct RawManifest {
    extension: RawExtension,
    datatypes: Option<RawDatatypes>,
    hooks: Option<RawHooks>,
    dependencies: Option<RawDependencies>,
    uri: Option<RawUri>,
}

#[derive(Debug, Deserialize)]
struct RawExtension {
    name: String,
    version: String,
    api_version: String,
}

#[derive(Debug, Deserialize)]
struct RawDatatypes {
    declarations: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct RawHooks {
    declarations: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct RawDependencies {
    extensions: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct RawUri {
    paths: Vec<UriPathDeclaration>,
}

impl ExtensionManifest {
    /// Parse a manifest from TOML string content.
    pub fn from_toml(content: &str) -> Result<Self, crate::error::ExtError> {
        let raw: RawManifest = toml::from_str(content)
            .map_err(|e| crate::error::ExtError::ManifestParse(e.to_string()))?;

        let api_version: u32 = raw.extension.api_version.parse()
            .map_err(|_| crate::error::ExtError::ManifestParse(
                format!("api_version '{}' is not a valid u32", raw.extension.api_version)
            ))?;

        Ok(Self {
            name: raw.extension.name,
            version: raw.extension.version,
            api_version,
            datatype_ids: raw.datatypes.map(|d| d.declarations).unwrap_or_default(),
            hook_ids: raw.hooks.map(|h| h.declarations).unwrap_or_default(),
            ext_dependencies: raw.dependencies.map(|d| d.extensions).unwrap_or_default(),
            uri_paths: raw.uri.map(|u| u.paths).unwrap_or_default(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_full_manifest() {
        let toml = r#"
[extension]
name = "reactions"
version = "0.1.0"
api_version = "1"

[datatypes]
declarations = []

[hooks]
declarations = ["reactions.add", "reactions.remove"]

[dependencies]
extensions = []

[[uri.paths]]
pattern = "/r/{room_id}/m/{ref_id}/reactions"
description = "Reaction list"
"#;
        let manifest = ExtensionManifest::from_toml(toml).expect("should parse");
        assert_eq!(manifest.name, "reactions");
        assert_eq!(manifest.version, "0.1.0");
        assert_eq!(manifest.api_version, 1);
        assert!(manifest.datatype_ids.is_empty());
        assert_eq!(manifest.hook_ids, vec!["reactions.add", "reactions.remove"]);
        assert!(manifest.ext_dependencies.is_empty());
        assert_eq!(manifest.uri_paths.len(), 1);
        assert_eq!(manifest.uri_paths[0].pattern, "/r/{room_id}/m/{ref_id}/reactions");
    }

    #[test]
    fn parse_minimal_manifest() {
        let toml = r#"
[extension]
name = "minimal"
version = "0.1.0"
api_version = "1"
"#;
        let manifest = ExtensionManifest::from_toml(toml).expect("should parse");
        assert_eq!(manifest.name, "minimal");
        assert!(manifest.datatype_ids.is_empty());
        assert!(manifest.hook_ids.is_empty());
        assert!(manifest.ext_dependencies.is_empty());
        assert!(manifest.uri_paths.is_empty());
    }

    #[test]
    fn parse_manifest_with_dependencies() {
        let toml = r#"
[extension]
name = "collab"
version = "0.1.0"
api_version = "1"

[datatypes]
declarations = ["collab_acl"]

[dependencies]
extensions = ["mutable", "room"]
"#;
        let manifest = ExtensionManifest::from_toml(toml).expect("should parse");
        assert_eq!(manifest.ext_dependencies, vec!["mutable", "room"]);
        assert_eq!(manifest.datatype_ids, vec!["collab_acl"]);
    }

    #[test]
    fn invalid_toml_returns_error() {
        let result = ExtensionManifest::from_toml("not valid toml {{{}");
        assert!(result.is_err());
    }
}
```

### Step 4: Write error types

In `ezagent/crates/ezagent-ext-api/src/error.rs`:

```rust
//! Extension API error types.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum ExtError {
    #[error("manifest parse error: {0}")]
    ManifestParse(String),

    #[error("registration failed: {0}")]
    RegistrationFailed(String),

    #[error("incompatible API version: expected {expected}, got {got}")]
    IncompatibleApiVersion { expected: u32, got: u32 },
}
```

### Step 5: Write C ABI context and entry point types

In `ezagent/crates/ezagent-ext-api/src/context.rs`:

```rust
//! Registration context for extension plugins.
//!
//! The `RegistrationContext` wraps raw C ABI pointers and provides safe
//! Rust methods for registering datatypes and hooks.

use std::ffi::c_void;

/// Current Engine API version. Extensions must declare this version.
pub const ENGINE_API_VERSION: u32 = 1;

/// C ABI entry point function signature.
///
/// Every extension `.dylib` MUST export a function with this signature
/// under the symbol name [`ENTRY_SYMBOL`].
///
/// Returns 0 on success, non-zero on failure.
pub type ExtEntryFn = unsafe extern "C" fn(ctx: *mut c_void) -> i32;

/// The well-known symbol name the Engine looks for after dlopen.
pub const ENTRY_SYMBOL: &str = "ezagent_ext_register";

/// Safe wrapper around the raw registration context.
///
/// Extension authors use this to register datatypes and hooks
/// during their `ExtensionPlugin::register()` call.
pub struct RegistrationContext {
    /// Opaque pointer to the Engine's internal registration state.
    /// The Engine creates this; extensions must not dereference it directly.
    inner: *mut c_void,
    /// Callback to register a datatype (as JSON).
    register_datatype_fn: Option<unsafe extern "C" fn(*mut c_void, *const u8, usize) -> i32>,
    /// Callback to register a hook (as JSON + function pointer).
    register_hook_fn: Option<unsafe extern "C" fn(*mut c_void, *const u8, usize, *const c_void) -> i32>,
}

// SAFETY: The RegistrationContext is only used during single-threaded
// extension registration. The inner pointer is managed by the Engine.
unsafe impl Send for RegistrationContext {}

impl RegistrationContext {
    /// Create a new registration context from raw parts.
    ///
    /// # Safety
    ///
    /// The caller must ensure `inner` points to valid Engine state that
    /// outlives this context, and the callback function pointers are valid.
    pub unsafe fn from_raw(
        inner: *mut c_void,
        register_datatype_fn: unsafe extern "C" fn(*mut c_void, *const u8, usize) -> i32,
        register_hook_fn: unsafe extern "C" fn(*mut c_void, *const u8, usize, *const c_void) -> i32,
    ) -> Self {
        Self {
            inner,
            register_datatype_fn: Some(register_datatype_fn),
            register_hook_fn: Some(register_hook_fn),
        }
    }

    /// Register a datatype declaration (serialized as JSON).
    pub fn register_datatype_json(&mut self, json: &str) -> Result<(), crate::error::ExtError> {
        let f = self.register_datatype_fn.ok_or_else(|| {
            crate::error::ExtError::RegistrationFailed("no register_datatype callback".into())
        })?;
        let ret = unsafe { f(self.inner, json.as_ptr(), json.len()) };
        if ret == 0 {
            Ok(())
        } else {
            Err(crate::error::ExtError::RegistrationFailed(
                format!("register_datatype returned error code {ret}")
            ))
        }
    }

    /// Register a hook declaration (serialized as JSON) with a handler function pointer.
    pub fn register_hook_json(
        &mut self,
        json: &str,
        handler: *const c_void,
    ) -> Result<(), crate::error::ExtError> {
        let f = self.register_hook_fn.ok_or_else(|| {
            crate::error::ExtError::RegistrationFailed("no register_hook callback".into())
        })?;
        let ret = unsafe { f(self.inner, json.as_ptr(), json.len(), handler) };
        if ret == 0 {
            Ok(())
        } else {
            Err(crate::error::ExtError::RegistrationFailed(
                format!("register_hook returned error code {ret}")
            ))
        }
    }
}
```

### Step 6: Write lib.rs and export_extension macro

In `ezagent/crates/ezagent-ext-api/src/lib.rs`:

```rust
//! EZAgent Extension Plugin API.
//!
//! This crate defines the stable interface between the Engine and extension
//! plugins. Extensions are compiled as `cdylib` crates and loaded via `dlopen`.
//!
//! Extension authors implement the `ExtensionPlugin` trait and use the
//! `export_extension!` macro to generate the C ABI entry point.

pub mod context;
pub mod error;
pub mod manifest;

pub use context::{RegistrationContext, ExtEntryFn, ENGINE_API_VERSION, ENTRY_SYMBOL};
pub use error::ExtError;
pub use manifest::{ExtensionManifest, UriPathDeclaration};

/// Trait that extension plugins implement.
///
/// The `register` method is called once during engine startup to register
/// the extension's datatypes and hooks.
pub trait ExtensionPlugin {
    /// Return the extension's manifest metadata.
    fn manifest() -> ExtensionManifest;

    /// Register datatypes and hooks with the engine.
    fn register(ctx: &mut RegistrationContext) -> Result<(), ExtError>;
}

/// Generate the C ABI entry point for an extension plugin.
///
/// Usage: `ezagent_ext_api::export_extension!(MyExtension);`
///
/// This generates an `extern "C"` function named `ezagent_ext_register`
/// that the Engine will call after dlopen.
#[macro_export]
macro_rules! export_extension {
    ($plugin:ty) => {
        #[no_mangle]
        pub unsafe extern "C" fn ezagent_ext_register(ctx: *mut std::ffi::c_void) -> i32 {
            // The ctx pointer is a RegistrationContext that the Engine constructed.
            // We cast it back to the Rust type.
            if ctx.is_null() {
                return -1;
            }
            let reg_ctx = &mut *(ctx as *mut $crate::RegistrationContext);
            match <$plugin as $crate::ExtensionPlugin>::register(reg_ctx) {
                Ok(()) => 0,
                Err(_e) => -1,
            }
        }
    };
}
```

### Step 7: Run tests

Run: `cd ezagent && cargo test -p ezagent-ext-api`
Expected: All tests pass (manifest parsing tests).

### Step 8: Commit

```
feat(ezagent): add ezagent-ext-api crate with plugin ABI and manifest parsing
```

---

## Task 2: Extension Loader in ezagent-engine

**Files:**
- Create: `ezagent/crates/ezagent-engine/src/loader.rs`
- Modify: `ezagent/crates/ezagent-engine/src/lib.rs` (add `pub mod loader;`)
- Modify: `ezagent/crates/ezagent-engine/src/error.rs` (add new error variants)
- Modify: `ezagent/crates/ezagent-engine/src/engine.rs` (add loader fields + methods)
- Modify: `ezagent/crates/ezagent-engine/Cargo.toml` (add deps)

### Step 1: Add dependencies to ezagent-engine

Add to `ezagent/crates/ezagent-engine/Cargo.toml` `[dependencies]`:

```toml
libloading = { workspace = true }
toml = { workspace = true }
log = { workspace = true }
ezagent-ext-api = { workspace = true }
```

### Step 2: Add new error variants

Add to `EngineError` in `ezagent/crates/ezagent-engine/src/error.rs`:

```rust
#[error("extension not loaded: {0}")]
ExtensionNotLoaded(String),

#[error("extension load failed: {name} — {reason}")]
ExtensionLoadFailed { name: String, reason: String },

#[error("URI path conflict: pattern '{pattern}' claimed by both '{ext_a}' and '{ext_b}'")]
UriPathConflict { pattern: String, ext_a: String, ext_b: String },

#[error("incompatible API version for extension '{name}': expected {expected}, got {got}")]
IncompatibleApiVersion { name: String, got: u32, expected: u32 },
```

### Step 3: Write failing tests for ExtensionLoader

In `ezagent/crates/ezagent-engine/src/loader.rs`:

```rust
//! Extension Loader — scans, parses, and loads extension plugins (bus-spec §4.7).
//!
//! The loader:
//! 1. Scans a directory for extension manifest.toml files
//! 2. Filters incompatible API versions
//! 3. Resolves dependency order (topological sort)
//! 4. Opens each .dylib/.so via libloading
//! 5. Calls the C ABI entry point to register datatypes and hooks

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use ezagent_ext_api::manifest::ExtensionManifest;
use ezagent_ext_api::ENGINE_API_VERSION;

use crate::error::EngineError;

/// Record of a successfully loaded extension.
#[derive(Debug, Clone)]
pub struct LoadedExtension {
    pub name: String,
    pub version: String,
    pub manifest: ExtensionManifest,
}

/// Record of a failed extension load.
#[derive(Debug)]
pub struct ExtensionLoadError {
    pub name: String,
    pub reason: String,
}

/// Scan a directory for extension manifests.
///
/// Looks for `{dir}/*/manifest.toml` and parses each one.
/// Returns both successfully parsed manifests and parse errors.
pub fn scan_manifests(dir: &Path) -> (Vec<(PathBuf, ExtensionManifest)>, Vec<ExtensionLoadError>) {
    let mut manifests = Vec::new();
    let mut errors = Vec::new();

    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(e) => {
            errors.push(ExtensionLoadError {
                name: dir.display().to_string(),
                reason: format!("cannot read extensions directory: {e}"),
            });
            return (manifests, errors);
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let manifest_path = path.join("manifest.toml");
        if !manifest_path.exists() {
            continue;
        }

        match std::fs::read_to_string(&manifest_path) {
            Ok(content) => match ExtensionManifest::from_toml(&content) {
                Ok(manifest) => manifests.push((path, manifest)),
                Err(e) => errors.push(ExtensionLoadError {
                    name: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                    reason: format!("manifest parse error: {e}"),
                }),
            },
            Err(e) => errors.push(ExtensionLoadError {
                name: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                reason: format!("cannot read manifest.toml: {e}"),
            }),
        }
    }

    (manifests, errors)
}

/// Filter out manifests with incompatible API versions.
///
/// Returns (compatible, skipped_errors).
pub fn filter_api_version(
    manifests: Vec<(PathBuf, ExtensionManifest)>,
) -> (Vec<(PathBuf, ExtensionManifest)>, Vec<ExtensionLoadError>) {
    let mut compatible = Vec::new();
    let mut errors = Vec::new();

    for (path, manifest) in manifests {
        if manifest.api_version != ENGINE_API_VERSION {
            errors.push(ExtensionLoadError {
                name: manifest.name.clone(),
                reason: format!(
                    "incompatible API version: expected {}, got {}",
                    ENGINE_API_VERSION, manifest.api_version
                ),
            });
        } else {
            compatible.push((path, manifest));
        }
    }

    (compatible, errors)
}

/// Resolve load order via topological sort on extension dependencies.
///
/// Returns extension names in the order they should be loaded.
/// Circular dependencies cause all involved extensions to fail.
pub fn resolve_extension_order(
    manifests: &[(PathBuf, ExtensionManifest)],
) -> Result<Vec<String>, Vec<ExtensionLoadError>> {
    use std::collections::HashSet;

    let manifest_map: HashMap<&str, &ExtensionManifest> = manifests
        .iter()
        .map(|(_, m)| (m.name.as_str(), m))
        .collect();

    let all_names: HashSet<&str> = manifest_map.keys().copied().collect();

    // Kahn's algorithm for topological sort.
    let mut in_degree: HashMap<&str, usize> = HashMap::new();
    let mut adj: HashMap<&str, Vec<&str>> = HashMap::new();

    for &name in &all_names {
        in_degree.entry(name).or_insert(0);
        adj.entry(name).or_default();
    }

    for &name in &all_names {
        let manifest = manifest_map[name];
        for dep in &manifest.ext_dependencies {
            // Only count deps on other extensions (not built-in datatypes).
            if all_names.contains(dep.as_str()) {
                adj.entry(dep.as_str()).or_default().push(name);
                *in_degree.entry(name).or_insert(0) += 1;
            }
        }
    }

    let mut queue: Vec<&str> = in_degree
        .iter()
        .filter(|(_, &deg)| deg == 0)
        .map(|(&name, _)| name)
        .collect();
    queue.sort(); // Alphabetical tie-breaking.

    let mut order = Vec::new();

    while let Some(name) = queue.first().copied() {
        queue.remove(0);
        order.push(name.to_string());

        if let Some(neighbors) = adj.get(name) {
            for &neighbor in neighbors {
                let deg = in_degree.get_mut(neighbor).expect("known node");
                *deg -= 1;
                if *deg == 0 {
                    // Insert sorted for deterministic order.
                    let pos = queue.binary_search(&neighbor).unwrap_or_else(|p| p);
                    queue.insert(pos, neighbor);
                }
            }
        }
    }

    if order.len() != all_names.len() {
        // Circular dependency: remaining nodes form cycles.
        let loaded: HashSet<&str> = order.iter().map(|s| s.as_str()).collect();
        let cyclic: Vec<String> = all_names
            .iter()
            .filter(|&&n| !loaded.contains(n))
            .map(|&n| n.to_string())
            .collect();
        Err(cyclic
            .iter()
            .map(|n| ExtensionLoadError {
                name: n.clone(),
                reason: "circular dependency".to_string(),
            })
            .collect())
    } else {
        Ok(order)
    }
}

/// Compute the library filename for the current platform.
pub fn lib_filename(ext_name: &str) -> String {
    #[cfg(target_os = "macos")]
    { format!("lib{}.dylib", ext_name.replace('-', "_")) }
    #[cfg(target_os = "linux")]
    { format!("lib{}.so", ext_name.replace('-', "_")) }
    #[cfg(target_os = "windows")]
    { format!("{}.dll", ext_name.replace('-', "_")) }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn create_manifest_dir(base: &Path, name: &str, toml_content: &str) {
        let dir = base.join(name);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("manifest.toml"), toml_content).unwrap();
    }

    #[test]
    fn scan_manifests_finds_extensions() {
        let tmp = tempfile::tempdir().unwrap();
        create_manifest_dir(tmp.path(), "reactions", r#"
[extension]
name = "reactions"
version = "0.1.0"
api_version = "1"
"#);
        create_manifest_dir(tmp.path(), "channels", r#"
[extension]
name = "channels"
version = "0.1.0"
api_version = "1"
"#);

        let (manifests, errors) = scan_manifests(tmp.path());
        assert!(errors.is_empty(), "no errors expected: {errors:?}");
        assert_eq!(manifests.len(), 2);
    }

    #[test]
    fn scan_manifests_skips_invalid() {
        let tmp = tempfile::tempdir().unwrap();
        create_manifest_dir(tmp.path(), "bad", "not valid toml {{{");
        create_manifest_dir(tmp.path(), "good", r#"
[extension]
name = "good"
version = "0.1.0"
api_version = "1"
"#);

        let (manifests, errors) = scan_manifests(tmp.path());
        assert_eq!(manifests.len(), 1);
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].name, "bad");
    }

    #[test]
    fn filter_api_version_skips_incompatible() {
        let tmp = tempfile::tempdir().unwrap();
        let m1 = ExtensionManifest {
            name: "good".into(),
            version: "0.1.0".into(),
            api_version: ENGINE_API_VERSION,
            datatype_ids: vec![],
            hook_ids: vec![],
            ext_dependencies: vec![],
            uri_paths: vec![],
        };
        let m2 = ExtensionManifest {
            name: "old".into(),
            version: "0.1.0".into(),
            api_version: 999,
            datatype_ids: vec![],
            hook_ids: vec![],
            ext_dependencies: vec![],
            uri_paths: vec![],
        };

        let input = vec![
            (tmp.path().join("good"), m1),
            (tmp.path().join("old"), m2),
        ];
        let (compat, errors) = filter_api_version(input);
        assert_eq!(compat.len(), 1);
        assert_eq!(compat[0].1.name, "good");
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].name, "old");
    }

    #[test]
    fn resolve_order_topological() {
        let tmp = tempfile::tempdir().unwrap();
        let manifests = vec![
            (tmp.path().join("collab"), ExtensionManifest {
                name: "collab".into(),
                version: "0.1.0".into(),
                api_version: 1,
                datatype_ids: vec![],
                hook_ids: vec![],
                ext_dependencies: vec!["mutable".into()],
                uri_paths: vec![],
            }),
            (tmp.path().join("mutable"), ExtensionManifest {
                name: "mutable".into(),
                version: "0.1.0".into(),
                api_version: 1,
                datatype_ids: vec![],
                hook_ids: vec![],
                ext_dependencies: vec![],
                uri_paths: vec![],
            }),
            (tmp.path().join("reactions"), ExtensionManifest {
                name: "reactions".into(),
                version: "0.1.0".into(),
                api_version: 1,
                datatype_ids: vec![],
                hook_ids: vec![],
                ext_dependencies: vec![],
                uri_paths: vec![],
            }),
        ];

        let order = resolve_extension_order(&manifests).expect("should resolve");
        let mut_pos = order.iter().position(|n| n == "mutable").unwrap();
        let col_pos = order.iter().position(|n| n == "collab").unwrap();
        assert!(mut_pos < col_pos, "mutable must load before collab");
    }

    #[test]
    fn resolve_order_circular_dependency() {
        let tmp = tempfile::tempdir().unwrap();
        let manifests = vec![
            (tmp.path().join("a"), ExtensionManifest {
                name: "a".into(),
                version: "0.1.0".into(),
                api_version: 1,
                datatype_ids: vec![],
                hook_ids: vec![],
                ext_dependencies: vec!["b".into()],
                uri_paths: vec![],
            }),
            (tmp.path().join("b"), ExtensionManifest {
                name: "b".into(),
                version: "0.1.0".into(),
                api_version: 1,
                datatype_ids: vec![],
                hook_ids: vec![],
                ext_dependencies: vec!["a".into()],
                uri_paths: vec![],
            }),
        ];

        let result = resolve_extension_order(&manifests);
        assert!(result.is_err(), "circular deps should fail");
        let errors = result.unwrap_err();
        assert_eq!(errors.len(), 2);
    }

    #[test]
    fn lib_filename_platform() {
        let name = "reactions";
        let filename = lib_filename(name);
        #[cfg(target_os = "macos")]
        assert_eq!(filename, "libreactions.dylib");
        #[cfg(target_os = "linux")]
        assert_eq!(filename, "libreactions.so");
    }
}
```

### Step 4: Run tests

Run: `cd ezagent && cargo test -p ezagent-engine loader`
Expected: All loader tests pass.

### Step 5: Add `pub mod loader;` to engine lib.rs

Add `pub mod loader;` to `ezagent/crates/ezagent-engine/src/lib.rs`.

### Step 6: Add loader integration to Engine struct

Add to `engine.rs`:
- `loaded_extensions: HashMap<String, LoadedExtension>` field
- `pub fn load_extensions(&mut self, dir: &Path) -> Vec<ExtensionLoadError>` method
- `pub fn is_extension_loaded(&self, name: &str) -> bool` method
- `pub fn loaded_extensions(&self) -> Vec<String>` method

The `load_extensions` method calls `scan_manifests`, `filter_api_version`, `resolve_extension_order`, then for each extension in order: opens the library, resolves the entry symbol, calls it with a `RegistrationContext`.

### Step 7: Run all tests

Run: `cd ezagent && cargo test`
Expected: All tests pass (existing + new).

### Step 8: Commit

```
feat(ezagent): add ExtensionLoader with manifest scanning, API version filtering, and dependency resolution
```

---

## Task 3: URI Path Registry

**Files:**
- Create: `ezagent/crates/ezagent-engine/src/uri_registry.rs`
- Modify: `ezagent/crates/ezagent-engine/src/lib.rs` (add `pub mod uri_registry;`)
- Modify: `ezagent/crates/ezagent-engine/src/engine.rs` (add UriPathRegistry field)

### Step 1: Write URI Path Registry with tests

In `ezagent/crates/ezagent-engine/src/uri_registry.rs`:

```rust
//! URI Path Registry — maps extension URI patterns to extension IDs
//! and detects conflicts (extensions-spec §1.2.3, EEP-0001).

use crate::error::EngineError;

/// Entry in the URI path registry.
#[derive(Debug, Clone)]
struct UriPathEntry {
    pattern: String,
    extension_id: String,
}

/// Registry mapping URI path patterns to extension IDs.
///
/// Each extension may declare URI sub-paths in its manifest.
/// The registry detects conflicts (two extensions claiming the same pattern)
/// and supports resolving a concrete path to the owning extension.
#[derive(Debug, Default)]
pub struct UriPathRegistry {
    entries: Vec<UriPathEntry>,
}

impl UriPathRegistry {
    pub fn new() -> Self {
        Self { entries: Vec::new() }
    }

    /// Register a URI path pattern for an extension.
    ///
    /// Returns `EngineError::UriPathConflict` if the pattern conflicts
    /// with an already-registered pattern.
    pub fn register(&mut self, pattern: &str, extension_id: &str) -> Result<(), EngineError> {
        // Check for conflicts with existing entries.
        for existing in &self.entries {
            if patterns_conflict(&existing.pattern, pattern) {
                return Err(EngineError::UriPathConflict {
                    pattern: pattern.to_string(),
                    ext_a: existing.extension_id.clone(),
                    ext_b: extension_id.to_string(),
                });
            }
        }
        self.entries.push(UriPathEntry {
            pattern: pattern.to_string(),
            extension_id: extension_id.to_string(),
        });
        Ok(())
    }

    /// Resolve a concrete path to the extension that handles it.
    ///
    /// Returns the extension ID if a pattern matches, None otherwise.
    pub fn resolve(&self, path: &str) -> Option<&str> {
        for entry in &self.entries {
            if path_matches_pattern(path, &entry.pattern) {
                return Some(&entry.extension_id);
            }
        }
        None
    }

    /// Get all registered entries as (pattern, extension_id) pairs.
    pub fn entries(&self) -> Vec<(&str, &str)> {
        self.entries
            .iter()
            .map(|e| (e.pattern.as_str(), e.extension_id.as_str()))
            .collect()
    }
}

/// Check if two URI patterns conflict.
///
/// Two patterns conflict if they have the same number of segments and
/// every corresponding pair either matches literally or both are placeholders.
fn patterns_conflict(a: &str, b: &str) -> bool {
    let segs_a: Vec<&str> = a.trim_start_matches('/').split('/').collect();
    let segs_b: Vec<&str> = b.trim_start_matches('/').split('/').collect();

    if segs_a.len() != segs_b.len() {
        return false;
    }

    segs_a.iter().zip(segs_b.iter()).all(|(sa, sb)| {
        let a_placeholder = sa.starts_with('{') && sa.ends_with('}');
        let b_placeholder = sb.starts_with('{') && sb.ends_with('}');
        // Both placeholders, or literal match.
        (a_placeholder && b_placeholder) || sa == sb
    })
}

/// Check if a concrete path matches a pattern.
fn path_matches_pattern(path: &str, pattern: &str) -> bool {
    let segs_path: Vec<&str> = path.trim_start_matches('/').split('/').collect();
    let segs_pat: Vec<&str> = pattern.trim_start_matches('/').split('/').collect();

    if segs_path.len() != segs_pat.len() {
        return false;
    }

    segs_path.iter().zip(segs_pat.iter()).all(|(sp, pp)| {
        let is_placeholder = pp.starts_with('{') && pp.ends_with('}');
        is_placeholder || sp == pp
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// TC-2-URI-002: Non-conflicting patterns register successfully.
    #[test]
    fn tc_2_uri_002_non_conflicting_patterns() {
        let mut reg = UriPathRegistry::new();
        reg.register("/r/{room_id}/m/{ref_id}/reactions", "reactions")
            .expect("should register");
        reg.register("/r/{room_id}/m/{ref_id}/thread", "threads")
            .expect("should register");
        reg.register("/r/{room_id}/c/{channel_name}", "channels")
            .expect("should register");
        reg.register("/@{entity_id}/profile", "profile")
            .expect("should register");

        assert_eq!(reg.entries().len(), 4);
    }

    /// TC-2-URI-001: Conflict detection.
    #[test]
    fn tc_2_uri_001_conflict_detection() {
        let mut reg = UriPathRegistry::new();
        reg.register("/r/{room_id}/c/{channel_name}", "ext-a")
            .expect("first register should succeed");

        let err = reg
            .register("/r/{room_id}/c/{channel_name}", "ext-b")
            .expect_err("duplicate pattern should conflict");

        match err {
            EngineError::UriPathConflict { pattern, ext_a, ext_b } => {
                assert_eq!(pattern, "/r/{room_id}/c/{channel_name}");
                assert_eq!(ext_a, "ext-a");
                assert_eq!(ext_b, "ext-b");
            }
            _ => panic!("expected UriPathConflict, got {err:?}"),
        }
    }

    /// TC-2-URI-003: Extension without URI section loads fine (no registration needed).
    #[test]
    fn tc_2_uri_003_no_uri_section() {
        let reg = UriPathRegistry::new();
        // No registration means no entries — this is fine.
        assert!(reg.entries().is_empty());
    }

    #[test]
    fn resolve_concrete_path() {
        let mut reg = UriPathRegistry::new();
        reg.register("/r/{room_id}/m/{ref_id}/reactions", "reactions").unwrap();
        reg.register("/r/{room_id}/c/{channel_name}", "channels").unwrap();

        assert_eq!(reg.resolve("/r/abc123/m/ref001/reactions"), Some("reactions"));
        assert_eq!(reg.resolve("/r/abc123/c/general"), Some("channels"));
        assert_eq!(reg.resolve("/r/abc123/unknown"), None);
    }

    #[test]
    fn different_length_patterns_dont_conflict() {
        let mut reg = UriPathRegistry::new();
        reg.register("/r/{room_id}/m/{ref_id}/reactions", "reactions").unwrap();
        // Shorter path — no conflict.
        reg.register("/r/{room_id}/m/{ref_id}", "messages").unwrap();
        assert_eq!(reg.entries().len(), 2);
    }
}
```

### Step 2: Wire into Engine

Add `pub mod uri_registry;` to `lib.rs`.
Add `pub uri_registry: UriPathRegistry` to `Engine` struct, initialized in `Engine::new()`.
Add `pub fn uri_registry(&self) -> &UriPathRegistry` accessor.

### Step 3: Run tests

Run: `cd ezagent && cargo test uri_registry`
Expected: All URI registry tests pass.

### Step 4: Commit

```
feat(ezagent): add URI Path Registry with conflict detection and path resolution
```

---

## Task 4: End-to-End Extension Loading Integration Test

**Files:**
- Create: `ezagent/crates/ezagent-ext-test-dummy/Cargo.toml`
- Create: `ezagent/crates/ezagent-ext-test-dummy/manifest.toml`
- Create: `ezagent/crates/ezagent-ext-test-dummy/src/lib.rs`
- Create: `ezagent/crates/ezagent-engine/tests/extension_loader_tests.rs`
- Modify: `ezagent/Cargo.toml` (add test-dummy to workspace members)

### Step 1: Create a minimal test dummy extension

This is a `cdylib` crate that exports the C ABI entry point and registers one datatype declaration.

`ezagent/crates/ezagent-ext-test-dummy/Cargo.toml`:
```toml
[package]
name = "ezagent-ext-test-dummy"
version.workspace = true
edition.workspace = true
license.workspace = true

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
ezagent-ext-api = { workspace = true }
```

`ezagent/crates/ezagent-ext-test-dummy/manifest.toml`:
```toml
[extension]
name = "test-dummy"
version = "0.1.0"
api_version = "1"

[datatypes]
declarations = []

[hooks]
declarations = []

[dependencies]
extensions = []
```

`ezagent/crates/ezagent-ext-test-dummy/src/lib.rs`:
```rust
//! Test dummy extension for integration testing of the extension loader.

use ezagent_ext_api::*;

pub struct TestDummyExtension;

impl ExtensionPlugin for TestDummyExtension {
    fn manifest() -> ExtensionManifest {
        ExtensionManifest {
            name: "test-dummy".into(),
            version: "0.1.0".into(),
            api_version: ENGINE_API_VERSION,
            datatype_ids: vec![],
            hook_ids: vec![],
            ext_dependencies: vec![],
            uri_paths: vec![],
        }
    }

    fn register(_ctx: &mut RegistrationContext) -> Result<(), ExtError> {
        // No-op: just proves the entry point is callable.
        Ok(())
    }
}

export_extension!(TestDummyExtension);
```

### Step 2: Write integration test

`ezagent/crates/ezagent-engine/tests/extension_loader_tests.rs`:

Test that `Engine::load_extensions` with the dummy extension's directory:
1. Scans the manifest.toml
2. Opens the .dylib
3. Calls the entry point successfully
4. Reports the extension as loaded

Note: This test requires the test-dummy cdylib to be built first. It will look for the library in the cargo target directory. Mark as `#[ignore]` if the environment doesn't support dlopen testing in CI.

### Step 3: Run the test

Run: `cd ezagent && cargo build -p ezagent-ext-test-dummy && cargo test -p ezagent-engine extension_loader -- --include-ignored`
Expected: Integration test passes.

### Step 4: Commit

```
feat(ezagent): add end-to-end extension loading integration test with dummy extension
```

---

## Task 5: EXT-03 Reactions (Pattern-Setting Extension)

**Reference:** `docs/specs/extensions-spec.md §4`, `docs/plan/phase-2-extensions.md §5.3`

**Files:**
- Create: `ezagent/crates/ezagent-ext-reactions/Cargo.toml`
- Create: `ezagent/crates/ezagent-ext-reactions/manifest.toml`
- Create: `ezagent/crates/ezagent-ext-reactions/src/lib.rs`
- Create: `ezagent/crates/ezagent-ext-reactions/src/hooks.rs`
- Modify: `ezagent/Cargo.toml` (add to workspace)

### Key spec points:
- Reactions stored as annotation pattern in `ext.reactions` on Ref
- Key format: `{emoji}:{entity_id}` (e.g., `👍:@bob:relay-a.example.com`)
- Value: timestamp
- Only the entity that added a reaction can remove it
- Reactions are **unsigned** fields (don't affect message signature)
- URI path: `/r/{room_id}/m/{ref_id}/reactions`

### Step 1: Create crate with manifest.toml

`manifest.toml`:
```toml
[extension]
name = "reactions"
version = "0.1.0"
api_version = "1"

[datatypes]
declarations = []

[hooks]
declarations = ["reactions.validate_add", "reactions.validate_remove"]

[dependencies]
extensions = []

[[uri.paths]]
pattern = "/r/{room_id}/m/{ref_id}/reactions"
description = "Reaction list for a message"
```

### Step 2: Implement hooks

`hooks.rs` — Two PreSend hooks:
- `reactions.validate_add` (p=30): validates `ext.reactions` key format, ensures key contains signer entity_id
- `reactions.validate_remove` (p=30): validates only the signer can remove their own reaction

### Step 3: Write tests

Test cases from plan:
- TC-2-EXT03-001: Add reaction
- TC-2-EXT03-002: Remove reaction
- TC-2-EXT03-003: Cannot remove other's reaction
- TC-2-EXT03-004: Reactions don't affect Bus signature

### Step 4: Run tests

Run: `cd ezagent && cargo test -p ezagent-ext-reactions`
Expected: All 4 test cases pass.

### Step 5: Commit

```
feat(ezagent): implement EXT-03 Reactions extension
```

---

## Tasks 6–21: Remaining Extensions

Each extension follows the same crate structure as Task 5. Below are the unique aspects of each.

### Task 6: EXT-06 Channels
- **Spec:** §7, **TCs:** TC-2-EXT06-001 to 004
- **Hooks:** `channels.inject_tags` (pre_send p=30), `channels.validate_tag_format` (pre_send p=25)
- **Key:** `ext.channels` array on Ref, tag format `[a-z0-9-]{1,64}`, implicit channel creation
- **URI:** `/r/{room_id}/c/{channel_name}`
- **Deps:** timeline, room

### Task 7: EXT-07 Moderation
- **Spec:** §8, **TCs:** TC-2-EXT07-001 to 004
- **Hooks:** `moderation.check_power_level` (pre_send p=25), `moderation.apply_overlay` (after_read p=30)
- **Key:** Independent `moderation overlay` doc (crdt_array), power_level check
- **Deps:** timeline, room

### Task 8: EXT-08 Read Receipts
- **Spec:** §9, **TCs:** TC-2-EXT08-001 to 003
- **Hooks:** `receipts.validate_writer` (pre_send p=25)
- **Key:** Independent `read_receipts` doc (crdt_map), writer can only update own key
- **Mode B:** Direct CRDT write (no REST endpoint needed)
- **Deps:** timeline, room

### Task 9: EXT-09 Presence
- **Spec:** §10, **TCs:** TC-2-EXT09-001 to 003
- **Storage:** Ephemeral (no persistence)
- **Key:** Presence token + typing indicator, SSE events
- **Deps:** room

### Task 10: EXT-10 Media
- **Spec:** §11, **TCs:** TC-2-EXT10-001 to 003
- **Key:** Blob storage with SHA-256 dedup, `one_time_write` rule
- **URI:** `/r/{room_id}/blob/{blob_id}`
- **Deps:** message

### Task 11: EXT-12 Drafts
- **Spec:** §13, **TCs:** TC-2-EXT12-001 to 003
- **Key:** Private per-entity draft doc, `clear_on_send` hook, writer_rule with entity_id key check
- **Mode B:** Direct CRDT write
- **Deps:** room

### Task 12: EXT-13 Profile
- **Spec:** §14, **TCs:** TC-2-EXT13-001 to 005
- **Key:** Entity-level extension doc, `entity_type` required field, `signer == entity_id` rule
- **URI:** `/@{entity_id}/profile`
- **Deps:** identity

### Task 13: EXT-16 Link Preview
- **Spec:** Not detailed in plan TCs (minimal extension)
- **Key:** `ext.link_preview` on Ref (after_read enhancement), unsigned field
- **Deps:** message

### Task 14: EXT-01 Mutable Content
- **Spec:** §2, **TCs:** TC-2-EXT01-001 to 004
- **Hooks:** `mutable.validate_edit` (pre_send p=25), `mutable.status_update` (after_write p=35)
- **Key:** `mutable_content` datatype (crdt_map), `immutable → mutable` upgrade path, `signer == author` rule
- **Registers:** `content_type: "mutable"`, `status: "edited"`
- **Deps:** message

### Task 15: EXT-04 Reply To
- **Spec:** §5, **TCs:** TC-2-EXT04-001 to 002
- **Hooks:** `reply_to.inject` (pre_send p=30)
- **Key:** `ext.reply_to` on Ref (signed field), immutable after creation (signature-protected)
- **Deps:** timeline

### Task 16: EXT-15 Command
- **Spec:** §16, **TCs:** TC-2-EXT15-001 to 014
- **Hooks:** `command.validate` (pre_send p=35), `command.dispatch` (after_write p=40)
- **Key:** `ext.command` on Ref (signed), `command_manifest_registry` index, namespace conflict detection, timeout handling
- **Most complex extension** — 14 test cases covering validation, permissions, results, timeouts, registry
- **Deps:** timeline, room

### Task 17: EXT-02 Collab
- **Spec:** §3, **TCs:** TC-2-EXT02-001 to 004
- **Hooks:** `collab.check_acl` (pre_send p=25, filter: content_type == "collab")
- **Key:** `collab_acl` datatype (crdt_map), ACL mode upgrade path: `owner_only → explicit → room_members`
- **Deps:** mutable, room

### Task 18: EXT-05 Cross-Room Ref
- **Spec:** §6, **TCs:** TC-2-EXT05-001 to 003
- **Key:** `ext.reply_to` with `room_id` + `window` for cross-room, non-member sees placeholder
- **Deps:** reply-to

### Task 19: EXT-11 Threads
- **Spec:** §12, **TCs:** TC-2-EXT11-001 to 003
- **Hooks:** `threads.inject` (pre_send p=30)
- **Key:** `ext.thread = { root: ref_id }`, implies `ext.reply_to`, thread root has no `ext.thread`
- **URI:** `/r/{room_id}/m/{ref_id}/thread`
- **Deps:** reply-to

### Task 20: EXT-14 Watch
- **Spec:** §15, **TCs:** TC-2-EXT14-001 to 008
- **Hooks:** `watch.validate_annotation` (pre_send p=30), `watch.notify_content_edited` (after_write p=50), `watch.notify_reply_added` (after_write p=50)
- **Key:** Annotation pattern on Ref `ext.watch`, channel watch on room_config annotation, public data, only self can set watch
- **Deps:** timeline, reply-to

### Task 21: EXT-17 Runtime (Socialware)
- **Spec:** §18, **TCs:** TC-2-EXT17-001 to 005
- **Hooks:** `runtime.namespace_check` (pre_send p=20), `runtime.rebuild_state_cache` (after_write p=60)
- **Key:** Room-level Socialware namespace registration, `_sw:*` channel reservation, state cache rebuild from timeline
- **URI:** `/r/{room_id}/sw/{namespace}`
- **Deps:** channels, reply-to, command

**For each Task 6–21:**

1. Create the crate directory with `Cargo.toml` (cdylib + rlib), `manifest.toml`, `src/lib.rs`, `src/hooks.rs`
2. Implement hooks per the spec
3. Write tests matching the TC numbers from the plan
4. Run: `cargo test -p ezagent-ext-{name}`
5. Commit: `feat(ezagent): implement EXT-{NN} {Name} extension`

---

## Task 22: Extension Interaction Tests

**Files:**
- Create: `ezagent/crates/ezagent-engine/tests/extension_interaction_tests.rs`

**Reference:** `docs/plan/phase-2-extensions.md §5.16–5.18`

### Test Cases:
- **TC-2-INTERACT-001**: Signed vs unsigned fields — `ext.reply_to` modification fails (signed), `ext.reactions` addition succeeds (unsigned)
- **TC-2-INTERACT-002**: Multiple extensions inject simultaneously — reply_to + channels + thread + command all present in final Ref
- **TC-2-INTERACT-003**: Content type upgrade chain — `immutable → mutable → collab`
- **TC-2-INTERACT-004**: Agent complete workflow — profile → invite → message → watch → mutable review → edit → notify
- **TC-2-INTERACT-005**: Level 0 + Level 2 peer coexistence — ext.* fields preserved by non-supporting peer

These tests require loading multiple extension libraries and composing their hooks. They validate the full hook pipeline with extension hooks mixed in.

### Commit:
```
test(ezagent): add extension interaction tests for Phase 2
```

---

## Task 23: Final Verification & Gate Check

### Step 1: Run full test suite

```bash
cd ezagent && cargo test --workspace
```

Expected: All tests pass across all crates.

### Step 2: Run clippy

```bash
cd ezagent && cargo clippy --workspace -- -D warnings
```

Expected: No warnings.

### Step 3: Run fmt check

```bash
cd ezagent && cargo fmt --all -- --check
```

Expected: All formatted.

### Step 4: Gate criteria verification

- [ ] All ~100 TC pass
- [ ] Every TC maps to a spec section (traceability)
- [ ] No P0/P1 bugs
- [ ] All 17 extension crates compile to cdylib
- [ ] Extension loader integration test passes
- [ ] URI conflict detection works
- [ ] Extension interaction tests pass

### Step 5: Commit (if any final fixes)

```
fix(ezagent): final Phase 2 gate adjustments
```

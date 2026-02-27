# ezagent/ 目录结构、共享类型层与 Spec v0.9.4 变更

---

## Part A: ezagent/ 内部目录结构

### 设计原则

**架构分层**

1. **Cargo workspace** 管理所有 Rust crate，共享编译缓存
2. **Protocol 类型独立 crate** — relay/ 和未来的第三方 Peer 实现都只需依赖这一个 crate
3. **Engine 分层清晰** — Protocol types → Backend abstraction → Engine logic → Extensions → PyO3
4. **Python 层薄** — CLI + HTTP Server + Socialware runtime，全部调用 PyO3 SDK

**目录组织约定**

5. **层级 = 深度**：协议架构的层级关系映射到目录深度。`crates/` 下按 crate 分目录；每个 crate 的 `src/` 下按 module 分子目录。层级越低的组件，目录路径越浅。
6. **同名目录**：每个独立的逻辑单元（Extension、Built-in Datatype、Socialware）使用**同名子目录**组织，目录名即模块名。例如 `reactions/` 包含 reactions 相关的所有文件（`mod.rs`, `types.rs`, `hooks.rs` 等），而不是用单个 `reactions.rs` 扁平堆叠。
7. **无序号前缀**：文件和目录名使用语义化名称（`mutable/`, `reactions/`），不使用 `ext01_`, `ext02_` 等序号前缀。Extension 的规范编号仅存在于 spec 文档中，不反映到文件系统。
8. **Extension 加载模型**：所有 Extension（官方 17 个 + 第三方）统一采用**动态链接**（`.so` / `.dylib`），Engine 启动时通过 `dlopen` 从 `~/.ezagent/extensions/` 加载。
   - **源码**（开发期）：官方 Extension 源码在 `crates/ezagent-extensions/src/{ext_name}/`，编译产物为 `.so`。
   - **安装目录**（运行时）：`~/.ezagent/extensions/{ext_name}/`，每个 Extension 一个子目录，包含 `manifest.toml`（声明 datatypes、hooks、依赖）+ 编译后的 `.so`/`.dylib`。
   - **首次安装**：`pip install ezagent` 或 DMG 安装后，官方 Extension 的预编译产物自动部署到 `~/.ezagent/extensions/`。
   - **第三方 Extension**：通过 `ezagent ext install {name}` 下载并放置到同一目录。
   - **Socialware**（Python 插件）是更上层的概念，安装到 `~/.ezagent/socialware/{name}/`，通过 Python runtime 加载，不涉及 Rust 编译。
9. **builtins/ 子目录**：Engine 的 4 个 Built-in Datatypes（Identity, Room, Timeline, Message）放在 `ezagent-engine/src/builtins/` 子目录下，与 Engine 核心组件同级但逻辑独立。

### 目录结构

```
ezagent/
├── Cargo.toml                          # [workspace] 定义
├── pyproject.toml                      # maturin build config
├── README.md
├── CLAUDE.md
├── LICENSE
│
├── crates/
│   ├── ezagent-protocol/               # ⭐ 共享协议类型（relay 依赖此 crate）
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── entity_id.rs            # EntityId 解析、验证、Display
│   │       ├── room_id.rs              # RoomId (UUIDv7 wrapper)
│   │       ├── ref_id.rs               # RefId (ULID wrapper)
│   │       ├── content_id.rs           # ContentId (sha256:hex | uuid:UUIDv7)
│   │       ├── envelope.rs             # SignedEnvelope 结构 + 签名/验证
│   │       ├── crypto.rs               # Ed25519 keypair、签名、验证
│   │       ├── key_pattern.rs          # Zenoh key expression 模板 + 实例化
│   │       ├── sync.rs                 # Sync Protocol 消息类型
│   │       │                           #   (StateQuery, StateReply, Update)
│   │       ├── datatype.rs             # DatatypeDeclaration 统一声明格式
│   │       ├── hook.rs                 # HookDeclaration（phase, trigger, priority）
│   │       ├── error.rs                # 协议层 Error codes
│   │       └── event.rs               # WsEvent、BusEvent 类型定义
│   │
│   ├── ezagent-backend/                # Backend 抽象层 + 参考实现
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── traits.rs               # CrdtBackend + NetworkBackend trait
│   │       ├── yrs_backend.rs          # yrs (Y-CRDT) 实现
│   │       ├── zenoh_backend.rs        # Zenoh 网络层实现
│   │       └── rocksdb_store.rs        # RocksDB 持久化
│   │
│   ├── ezagent-engine/                 # Bus Engine 四组件 + Extension Loader
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── registry.rs             # DatatypeRegistry
│   │       ├── hook_pipeline.rs        # HookPipeline (3-phase)
│   │       ├── annotation.rs           # Annotation pattern
│   │       ├── index_builder.rs        # IndexBuilder
│   │       ├── extension_loader.rs     # dlopen 扫描 + 加载 + 依赖排序
│   │       ├── bus.rs                  # Bus 入口（组合四组件 + Loader）
│   │       └── builtins/               # 4 Built-in Datatypes
│   │           ├── mod.rs
│   │           ├── identity.rs         # §5.1
│   │           ├── room.rs             # §5.2
│   │           ├── timeline.rs         # §5.3
│   │           └── message.rs          # §5.4
│   │
│   ├── ezagent-extensions/             # 17 官方 Extension（各自编译为独立 .so）
│   │   ├── Cargo.toml                 # [lib] crate-type = ["cdylib"] per ext
│   │   └── src/
│   │       ├── lib.rs                  # pub mod 声明 + re-exports
│   │       │
│   │       ├── mutable/                # §6.1 Mutable Message
│   │       │   ├── mod.rs
│   │       │   ├── types.rs            # MutableMeta 等
│   │       │   └── hooks.rs            # edit 拦截
│   │       │
│   │       ├── collab/                 # §6.2 Collaborative Editing
│   │       │   ├── mod.rs
│   │       │   └── types.rs
│   │       │
│   │       ├── reactions/              # §6.3 Reactions
│   │       │   ├── mod.rs
│   │       │   ├── types.rs            # ReactionMap, EmojiSet
│   │       │   └── hooks.rs            # reaction 计数同步
│   │       │
│   │       ├── reply_to/               # §6.4 Reply / Quote
│   │       │   └── mod.rs
│   │       │
│   │       ├── cross_room/             # §6.5 Cross-Room Reference
│   │       │   └── mod.rs
│   │       │
│   │       ├── channels/               # §6.6 Channels
│   │       │   ├── mod.rs
│   │       │   └── types.rs
│   │       │
│   │       ├── moderation/             # §6.7 Moderation
│   │       │   ├── mod.rs
│   │       │   ├── types.rs
│   │       │   └── hooks.rs            # pre-send 过滤
│   │       │
│   │       ├── read_receipts/          # §6.8 Read Receipts
│   │       │   ├── mod.rs
│   │       │   └── types.rs
│   │       │
│   │       ├── presence/               # §6.9 Presence
│   │       │   ├── mod.rs
│   │       │   └── types.rs
│   │       │
│   │       ├── media/                  # §6.10 Media Attachment
│   │       │   ├── mod.rs
│   │       │   └── types.rs
│   │       │
│   │       ├── threads/                # §6.11 Threads
│   │       │   ├── mod.rs
│   │       │   └── types.rs
│   │       │
│   │       ├── drafts/                 # §6.12 Drafts
│   │       │   └── mod.rs
│   │       │
│   │       ├── profile/                # §6.13 Entity Profile
│   │       │   ├── mod.rs
│   │       │   └── types.rs
│   │       │
│   │       ├── watch/                  # §6.14 Watch Expression
│   │       │   ├── mod.rs
│   │       │   └── types.rs
│   │       │
│   │       ├── command/                # §6.15 Slash Command
│   │       │   ├── mod.rs
│   │       │   └── types.rs
│   │       │
│   │       ├── link_preview/           # §6.16 Link Preview
│   │       │   ├── mod.rs
│   │       │   └── types.rs
│   │       │
│   │       └── runtime/                # §6.17 Runtime State
│   │           ├── mod.rs
│   │           └── types.rs
│   │
│   └── ezagent-py/                     # PyO3 绑定
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs                  # #[pymodule] 入口
│           ├── py_bus.rs               # Bus Python API (py-spec §2)
│           ├── py_types.rs             # Python dataclass 导出 (py-spec §3)
│           ├── py_events.rs            # Event stream bridge (py-spec §2.3)
│           ├── py_hooks.rs             # Socialware hook callback (py-spec §4)
│           ├── py_async.rs             # tokio ↔ asyncio bridge (py-spec §5)
│           ├── py_extensions.rs        # Extension API 自动生成 (py-spec §6)
│           └── py_socialware.rs        # Socialware 管理 API (py-spec §8)
│
├── python/                             # Pure Python 层
│   └── ezagent/
│       ├── __init__.py                 # re-export from ezagent._native (PyO3)
│       ├── cli.py                      # typer CLI 入口
│       ├── server.py                   # FastAPI HTTP server (API only)
│       └── socialware/
│           ├── __init__.py
│           ├── runtime.py              # Socialware 进程管理
│           ├── decorators.py           # @socialware, @hook, @command
│           └── agent_adapter.py        # AgentAdapter Protocol (py-spec §9)
│
├── bindings/                           # ⭐ ts-rs 自动生成的 TypeScript 类型
│   ├── EntityId.ts
│   ├── RoomId.ts
│   ├── RefId.ts
│   ├── Room.ts
│   ├── Ref.ts
│   ├── WsEvent.ts
│   ├── RendererDeclaration.ts
│   ├── FlowState.ts
│   ├── ... (所有 #[derive(TS)] 类型)
│   └── index.ts                        # re-export all
│
└── tests/
    ├── rust/                           # cargo test
    └── python/                         # pytest
```

### 运行时目录结构 (`~/.ezagent/`)

```
~/.ezagent/
├── config.toml                         # 用户配置
├── keys/                               # Ed25519 keypair
│   ├── identity.pub
│   └── identity.key
├── data/                               # RocksDB 持久化
│
├── extensions/                         # ⭐ Extension 安装目录（dlopen 加载）
│   ├── reactions/                      #   官方 Extension 示例
│   │   ├── manifest.toml              #   声明: datatypes, hooks, dependencies
│   │   └── libreactions.so            #   编译产物 (.so / .dylib / .dll)
│   │
│   ├── moderation/                     #   另一个官方 Extension
│   │   ├── manifest.toml
│   │   └── libmoderation.so
│   │
│   └── custom_vote/                    #   第三方 Extension 示例
│       ├── manifest.toml
│       └── libcustom_vote.so
│
├── socialware/                         # Socialware 安装目录（Python runtime 加载）
│   ├── task-arena/
│   │   ├── manifest.toml
│   │   └── ...
│   └── event-weaver/
│       ├── manifest.toml
│       └── ...
│
├── ezagent.pid                         # daemon PID file
└── logs/                               # 日志
```

**加载顺序**：Engine 启动时扫描 `~/.ezagent/extensions/*/manifest.toml`，按 `manifest.toml` 中声明的 `priority` 排序后依次 `dlopen`。加载失败的 Extension 记录错误日志但不阻止 Engine 启动。

### Cargo.toml (Workspace Root)

```toml
[workspace]
resolver = "2"
members = [
    "crates/ezagent-protocol",
    "crates/ezagent-backend",
    "crates/ezagent-engine",
    "crates/ezagent-extensions",
    "crates/ezagent-py",
]

[workspace.dependencies]
# 共享版本管理
serde = { version = "1", features = ["derive"] }
serde_json = "1"
ts-rs = { version = "10", features = ["serde-compat"] }
ed25519-dalek = "2"
uuid = { version = "1", features = ["v7"] }
ulid = "1"
yrs = "0.21"
zenoh = "1.1"
rocksdb = "0.22"
pyo3 = { version = "0.22", features = ["extension-module"] }
libloading = "0.8"              # dlopen for Extension .so/.dylib
tokio = { version = "1", features = ["full"] }
thiserror = "2"
```

### Crate 依赖图

```
                    ┌──────────────────┐
                    │ ezagent-protocol │  ← relay/ 依赖此 crate
                    │ (共享协议类型)     │  ← #[derive(TS)] 生成 bindings/
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
    ┌─────────┴──────┐  ┌───┴────────┐     │
    │ ezagent-backend│  │   (relay/)  │     │
    │ (yrs+zenoh+    │  │  纯 Rust    │     │
    │  rocksdb)      │  │  独立 binary│     │
    └─────────┬──────┘  └────────────┘     │
              │                             │
    ┌─────────┴──────────────┐              │
    │    ezagent-engine      │              │
    │ (bus 四组件 + builtins  │              │
    │  + extension loader)   ├──────────────┘
    └─────────┬──────────────┘
              │                  ┌──────────────────────────┐
              │   dlopen -----→  │  ezagent-extensions      │
              │   (运行时加载)    │  (17 个 .so，各自独立)     │
              │                  └──────────────────────────┘
    ┌─────────┴──────────────┐
    │     ezagent-py         │
    │ (PyO3 绑定，唯一出口)    │
    └────────────────────────┘
```

> **注意**：`ezagent-extensions` 在编译期依赖 `ezagent-protocol`（共享类型）和 `ezagent-engine`（Extension trait），但产物是独立的 `.so` 文件，Engine 通过 `dlopen` 在运行时加载，而非静态链接。

---

## Part B: relay/ 与 ezagent/ 的共享类型方案

### 核心设计

`ezagent-protocol` crate 是**协议层的 Single Source of Truth**。它只包含类型定义和纯函数（签名、验证、序列化），不包含任何运行时逻辑（Engine、Backend、Hook 执行）。

**relay/ 的 Cargo.toml:**

```toml
# relay/Cargo.toml
[package]
name = "ezagent-relay"
version = "0.1.0"

[dependencies]
# 通过 monorepo 路径引用共享类型
ezagent-protocol = { path = "../ezagent/crates/ezagent-protocol" }

# relay 自己的依赖
zenoh = "1.1"
rocksdb = "0.22"
axum = "0.8"           # Admin API (轻量，不需要 Python)
tokio = { version = "1", features = ["full"] }
```

### ezagent-protocol 的精确边界

```
ezagent-protocol 包含的（relay 需要的）:
─────────────────────────────────────────
✅ EntityId         解析 "@alice:relay.example.com"、验证格式
✅ RoomId           UUIDv7 wrapper + 生成
✅ RefId            ULID wrapper + 生成
✅ ContentId        sha256:hex | uuid:UUIDv7
✅ SignedEnvelope   结构定义 + 签名 + 验证 (ed25519)
✅ Crypto           Ed25519 keypair 生成、签名、验证
✅ KeyPattern       Zenoh key expression 模板实例化
✅ SyncMessage      StateQuery / StateReply / Update 消息格式
✅ DatatypeDecl     统一声明格式 (storage_type, key_pattern, ...)
✅ HookDecl         Hook 声明格式 (phase, trigger, priority)
✅ WriterRule       权限规则表达式解析
✅ ErrorCode        协议层错误码
✅ WsEvent          WebSocket event 类型 (tagged union)
✅ RendererDecl     Renderer 声明 (供前端消费)
✅ FlowDecl         Flow 状态机声明
✅ Quota            Quota 模型定义 (relay-spec §5)

ezagent-protocol 不包含的（relay 不需要的）:
─────────────────────────────────────────
❌ Engine 运行时逻辑     → ezagent-engine
❌ Hook Pipeline 执行    → ezagent-engine
❌ CRDT 读写操作         → ezagent-backend
❌ Extension 业务逻辑    → ezagent-extensions
❌ Python 绑定           → ezagent-py
❌ 网络层实现            → ezagent-backend (zenoh)
❌ 存储层实现            → ezagent-backend (rocksdb)
```

### relay/ 内部结构（建议）

```
relay/
├── Cargo.toml
├── README.md
├── CLAUDE.md
├── LICENSE
└── src/
    ├── main.rs                    # CLI: ezagent-relay start ...
    ├── config.rs                  # relay-spec §10 配置
    ├── identity_store.rs          # relay-spec §6 Entity 注册表
    ├── sync_handler.rs            # bus-spec §4.5 Sync Protocol 实现
    ├── access_control.rs          # bus-spec §6.4 ACL Interceptor
    ├── blob_store.rs              # relay-spec §4.3 Blob Store + GC
    ├── quota.rs                   # relay-spec §5 配额管理
    ├── admin_api.rs               # relay-spec §7 Admin API (axum)
    ├── discovery.rs               # relay-spec §7.6 Discovery (Level 3)
    ├── health.rs                  # relay-spec §8.2 健康检查
    └── metrics.rs                 # relay-spec §8.1 Prometheus 指标
```

### ts-rs 导出配置

```toml
# ezagent/crates/ezagent-protocol/Cargo.toml

[package]
name = "ezagent-protocol"
version = "0.9.4"

[dependencies]
serde = { workspace = true }
serde_json = { workspace = true }
ts-rs = { workspace = true }
ed25519-dalek = { workspace = true }
uuid = { workspace = true }
ulid = { workspace = true }
thiserror = { workspace = true }

[features]
default = []
typescript = ["ts-rs"]    # relay 不需要 TS 生成，feature gate
```

```rust
// ezagent/crates/ezagent-protocol/src/entity_id.rs

use serde::{Serialize, Deserialize};
#[cfg(feature = "typescript")]
use ts_rs::TS;

/// Entity ID: @{local_part}:{relay_domain}
/// 协议层不区分 human 和 agent。
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export, export_to = "../../bindings/"))]
pub struct EntityId {
    pub local_part: String,
    pub relay_domain: String,
}

impl EntityId {
    pub fn parse(s: &str) -> Result<Self, EntityIdError> { ... }
}

impl std::fmt::Display for EntityId {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "@{}:{}", self.local_part, self.relay_domain)
    }
}
```

```rust
// ezagent/crates/ezagent-protocol/src/envelope.rs

use serde::{Serialize, Deserialize};
#[cfg(feature = "typescript")]
use ts_rs::TS;

use crate::crypto::Signature;
use crate::entity_id::EntityId;

/// bus-spec §4.4: Signed Envelope
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export, export_to = "../../bindings/"))]
pub struct SignedEnvelope {
    pub version: u8,           // MUST be 1
    pub signer_id: EntityId,
    pub doc_id: String,        // key_pattern 实例化路径
    pub timestamp: i64,        // Unix ms UTC
    #[serde(with = "serde_bytes")]
    #[cfg_attr(feature = "typescript", ts(type = "Uint8Array"))]
    pub payload: Vec<u8>,      // CRDT update binary
    pub signature: Signature,  // Ed25519 64 bytes
}

impl SignedEnvelope {
    pub fn sign(keypair: &Keypair, doc_id: &str, payload: &[u8]) -> Self { ... }
    pub fn verify(&self, pubkey: &PublicKey) -> Result<(), VerifyError> { ... }
}
```

```rust
// ezagent/crates/ezagent-protocol/src/event.rs

use serde::{Serialize, Deserialize};
#[cfg(feature = "typescript")]
use ts_rs::TS;

/// WebSocket Event — app/ 通过 WS 接收这些事件
/// 此类型同时由 http-spec §5.3 和 chat-ui-spec 消费
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "typescript", derive(TS))]
#[cfg_attr(feature = "typescript", ts(export, export_to = "../../bindings/"))]
#[serde(tag = "type")]
pub enum WsEvent {
    #[serde(rename = "message.new")]
    MessageNew {
        room_id: String,
        ref_id: String,
        author: String,
        timestamp: String,
        data: serde_json::Value,
    },
    #[serde(rename = "message.deleted")]
    MessageDeleted { room_id: String, ref_id: String },
    #[serde(rename = "room.created")]
    RoomCreated { room_id: String },
    #[serde(rename = "room.member_joined")]
    RoomMemberJoined { room_id: String, entity_id: String },
    #[serde(rename = "room.member_left")]
    RoomMemberLeft { room_id: String, entity_id: String },
    #[serde(rename = "room.config_updated")]
    RoomConfigUpdated { room_id: String },
    // Extension events...
    #[serde(rename = "message.edited")]
    MessageEdited { room_id: String, ref_id: String },
    #[serde(rename = "reaction.added")]
    ReactionAdded { room_id: String, ref_id: String, emoji: String, entity_id: String },
    #[serde(rename = "reaction.removed")]
    ReactionRemoved { room_id: String, ref_id: String, emoji: String, entity_id: String },
    // ... (完整列表见 http-spec §5.3)
}
```

---

## Part C: Spec v0.9.4 新增章节

以下内容建议新增为 `docs/specs/repo-spec.md`（仓库结构与构建规范），并在 `architecture.md` 中引用。

```markdown
# ezagent Repository & Build Specification v0.9.4

> **状态**：Architecture Draft
> **日期**：2026-02-27
> **前置文档**：ezagent-protocol-v0.9.3, ezagent-bus-spec-v0.9.3

---

## §1 Monorepo 结构

ezagent 项目采用 monorepo 管理，包含以下独立子项目：

| 子项目 | 语言 | 用途 | 发布产物 |
|--------|------|------|---------|
| `ezagent/` | Rust + Python | 协议实现 + SDK + CLI + HTTP Server | PyPI wheel, crates.io |
| `app/` | TypeScript (React) | Desktop Chat UI + Tray | DMG, MSI, AppImage |
| `relay/` | Rust | Public Relay 独立服务 | Docker image, binary |
| `docs/` | Markdown | 协议规范 + 产品文档 + 实施计划 | — |
| `page/` | — | 官网 | 静态站点 |

### §1.1 子项目间依赖

          ┌──────────────────────────────────┐
          │         ezagent-protocol         │
          │    (Rust crate, 共享协议类型)      │
          └───────┬───────────────┬──────────┘
                  │               │
       Cargo path dep      Cargo path dep
                  │               │
    ┌─────────────┴─────┐  ┌─────┴──────────┐
    │     ezagent/      │  │    relay/       │
    │ (engine+py+cli)   │  │ (独立 binary)   │
    └─────────┬─────────┘  └────────────────┘
              │
         make sync-types
              │
    ┌─────────┴─────────┐
    │      app/          │
    │ (TypeScript types) │
    └────────────────────┘

- relay/ 通过 `path = "../ezagent/crates/ezagent-protocol"` 引用共享类型
- app/ 通过 `make sync-types` 从 ezagent/bindings/ 同步 TypeScript 类型
- docs/ 被所有子项目参考，但无代码依赖

### §1.2 共享类型的 Single Source of Truth

| 目标语言 | 生成方式 | 源头 |
|---------|---------|------|
| Rust | 直接定义 | `ezagent-protocol` crate |
| Python | PyO3 #[pyclass] 自动派生 | `ezagent-py` crate，类型来自 `ezagent-protocol` |
| TypeScript | ts-rs #[derive(TS)] 自动生成 | `ezagent-protocol` crate |

---

## §2 ezagent/ Cargo Workspace

### §2.1 Crate 分层

| Crate | 职责 | 产物 |
|-------|------|------|
| `ezagent-protocol` | 协议类型定义 + 签名/验证 + 序列化 | relay/ 和 app/ (via TS) 消费 |
| `ezagent-backend` | CrdtBackend + NetworkBackend trait + 参考实现 (yrs/zenoh/rocksdb) | 静态链接入 engine |
| `ezagent-engine` | Bus 四组件 + 4 Built-in Datatypes + Extension dlopen 加载器 | `libezagent_engine.so` |
| `ezagent-extensions` | 17 官方 Extension 源码，每个编译为独立 `.so` | `~/.ezagent/extensions/{name}/` |
| `ezagent-py` | PyO3 绑定层，Python SDK 的 native 部分 | `ezagent._native` Python module |

### §2.2 ezagent-protocol 设计约束

- [MUST] `ezagent-protocol` MUST NOT 依赖 `yrs`、`zenoh`、`rocksdb` 或任何 Backend 实现。
- [MUST] `ezagent-protocol` MUST NOT 依赖 `pyo3`。
- [MUST] `ezagent-protocol` 的所有公开类型 MUST `#[derive(Serialize, Deserialize)]`。
- [MUST] 需要前端消费的类型 MUST `#[cfg_attr(feature = "typescript", derive(TS))]`。
- [SHOULD] `ezagent-protocol` SHOULD 仅包含类型定义、格式验证和纯函数（签名、解析）。
- [MUST NOT] `ezagent-protocol` MUST NOT 包含任何 I/O 操作、网络调用或状态管理。

### §2.3 relay/ 引用方式

relay/ 通过 Cargo path dependency 引用 ezagent-protocol：

    [dependencies]
    ezagent-protocol = { path = "../ezagent/crates/ezagent-protocol" }

- [MUST] relay/ MUST 仅依赖 `ezagent-protocol`，不得依赖 ezagent/ 的其他 crate。
- [MUST] `ezagent-protocol` 的 API 变更 MUST 同时检查 relay/ 的编译。
- [SHOULD] CI SHOULD 在 ezagent-protocol 变更时同时构建 ezagent/ 和 relay/。

### §2.4 Extension 动态加载

Extension 采用动态链接（`.so` / `.dylib` / `.dll`），Engine 启动时通过 `dlopen` 加载。官方和第三方 Extension 使用相同的加载机制，安装到相同的目录。

**manifest.toml 示例**：

```toml
[extension]
name = "reactions"
version = "0.9.4"
api_version = "1"                # Extension ABI 版本，Engine 据此检查兼容性

[datatypes]
declarations = ["reactions"]     # 声明的 DatatypeDeclaration 名称列表

[hooks]
phases = ["after_write"]         # 使用的 Hook 阶段
triggers = ["message.insert"]    # 监听的 trigger

[dependencies]
extensions = []                  # 依赖的其他 Extension（名称列表）
```

**构建与安装**：

```
开发期（源码 → .so）:
  crates/ezagent-extensions/src/reactions/
    → cargo build --release -p ezagent-extensions
    → target/release/libreactions.so

安装（.so → 运行时目录）:
  pip install ezagent (首次)
    → 预编译的 17 个官方 .so 部署到 ~/.ezagent/extensions/

  ezagent ext install {name} (第三方)
    → 下载 manifest.toml + .so 到 ~/.ezagent/extensions/{name}/
```

**加载约束**：

- [MUST] Engine 启动时扫描 `~/.ezagent/extensions/*/manifest.toml`。
- [MUST] `api_version` 不匹配时跳过该 Extension 并记录 warning。
- [MUST] Extension 的 `dependencies` 中声明的 Extension 必须先于自身加载。
- [SHOULD] 单个 Extension 加载失败不阻止 Engine 启动，但该 Extension 声明的 Datatypes 和 Hooks 不可用。

---

## §3 TypeScript 类型同步

### §3.1 生成

    cd ezagent/
    cargo test --features typescript export_bindings

- [MUST] 所有标注 `#[derive(TS)]` 的类型导出到 `ezagent/bindings/`。
- [MUST] `bindings/` 目录 MUST git tracked。每次 Rust 类型变更时，PR MUST 包含更新的 bindings。

### §3.2 同步

    # monorepo 根目录
    make sync-types

    # 等价于:
    cd ezagent && cargo test --features typescript export_bindings
    rsync -av --checksum --delete ezagent/bindings/ app/src/types/generated/

### §3.3 CI 校验

    make check-types

    # 等价于: diff ezagent/bindings/ app/src/types/generated/
    # 不一致则 CI 失败

### §3.4 类型覆盖范围

以下类别的 Rust 类型 MUST 导出 TypeScript 定义：

| 类别 | 示例类型 | app/ 消费场景 |
|------|---------|-------------|
| 标识符 | EntityId, RoomId, RefId | 全局 |
| Bus 实体 | Room, Ref, MemberRole, StatusInfo | Room 列表、Timeline |
| WebSocket 事件 | WsEvent (tagged union) | 实时通信 |
| Renderer 声明 | RendererDeclaration, FieldMapping, BadgeConfig | Render Pipeline |
| Flow | FlowState, Transition, ActionDef | Actions layer |
| Extension 数据 | ReactionMap, ThreadInfo, PresenceState | Decorator layer |
| 错误 | ApiError, ErrorCode | 错误处理 |

---

## §4 Python 层结构

### §4.1 pyproject.toml

    [build-system]
    requires = ["maturin>=1.7"]
    build-backend = "maturin"

    [project]
    name = "ezagent"
    requires-python = ">=3.11"
    dependencies = [
        "typer>=0.12",       # CLI
        "fastapi>=0.115",    # HTTP Server
        "uvicorn>=0.32",     # ASGI server
    ]

    [project.scripts]
    ezagent = "ezagent.cli:app"

### §4.2 安装效果

    pip install ezagent

    → 安装 Rust .so (PyO3 native module)
    → 安装 Python 包 (CLI + HTTP Server + Socialware runtime)
    → /usr/local/bin/ezagent (CLI 入口)
    → import ezagent (SDK 入口)

---

## §5 Desktop App 生命周期

### §5.1 安装路径

| 路径 | 产物 | 说明 |
|------|------|------|
| `brew install ezagent` | CLI + ezagent.app + LaunchAgent | 一步完成 |
| DMG 安装 | ezagent.app | 首次打开时安装 CLI symlink + LaunchAgent |
| `pip install ezagent` | CLI only | 服务器/CI 场景，无 Desktop |

### §5.2 运行时架构

    ┌─ Tray (Menu Bar) ─────────────────────────────┐
    │  ◆ ezagent                                     │
    │  ┌─────────────────────────────────────────┐   │
    │  │  ezagent serve (daemon)                 │   │
    │  │  ┌─ FastAPI ──────────────────────────┐ │   │
    │  │  │  REST   localhost:8847/api/*        │ │   │
    │  │  │  WS     localhost:8847/ws           │ │   │
    │  │  └────────────────────────────────────┘ │   │
    │  │  ┌─ Engine ───────────────────────────┐ │   │
    │  │  │  Rust (zenoh P2P + yrs CRDT)       │ │   │
    │  │  └────────────────────────────────────┘ │   │
    │  └─────────────────────┬───────────────────┘   │
    │                        │ HTTP/WS                │
    │  ┌─────────────────────┴───────────────────┐   │
    │  │  App 窗口 (React WebView)               │   │
    │  │  可关闭，不影响 daemon                     │   │
    │  └─────────────────────────────────────────┘   │
    └────────────────────────────────────────────────┘

### §5.3 Tray 菜单

    ┌──────────────────┐
    │ ● Online          │  Engine 运行状态
    │ 3 Agents active   │  活跃 Agent 数
    │ 2 Rooms synced    │  已同步 Room 数
    │──────────────────│
    │ Open ezagent      │  打开/聚焦 App 窗口
    │──────────────────│
    │ Preferences...    │  设置
    │ About             │  版本信息
    │──────────────────│
    │ Quit ezagent      │  停止 Engine + 退出
    └──────────────────┘

    状态图标:
    ◆ = 在线 (Engine 运行 + 至少一个 Relay/Peer 已连接)
    ◇ = 离线 (Engine 运行，无网络连接)

### §5.4 CLI 命令 (更新自 cli-spec §2.5)

| 命令 | 用途 | 调用者 |
|------|------|--------|
| `ezagent start` | 前台启动 API server，日志输出 stdout，Ctrl+C 退出 | 开发者调试 |
| `ezagent serve` | 后台 daemon 启动 API server | LaunchAgent / Tray |
| `ezagent serve --stop` | 停止 daemon | Tray "Quit" / 手动 |
| `ezagent serve --status` | 检查 daemon 状态 | 健康检查 |

默认端口: 8847

PID 文件: ~/.ezagent/ezagent.pid
macOS LaunchAgent: ~/Library/LaunchAgents/dev.ezagent.daemon.plist
```

---

## 附录：变更追踪

### 受影响的现有 Spec 文件（v0.9.3 → v0.9.4）

| 文件 | 章节 | 变更 |
|------|------|------|
| py-spec.md | §1.1 | 架构图修正：移除 React UI，App 独立 repo |
| py-spec.md | §1.3 | 新增行：Desktop App / Chat UI 不属于协议 spec |
| cli-spec.md | §2.5 | `start` 改为前台调试，新增 `serve` daemon 命令 |
| cli-spec.md | 新增 §2.9 | Daemon 管理 (PID, LaunchAgent) |
| http-spec.md | §1 | 移除 Static Files，端口 8000 → 8847 |
| http-spec.md | §1.1, §1.2 | 移除 `--no-ui`，移除 Chat UI 静态文件路径 |
| app-prd.md | §1.3 | 交付形态重写 (Tray 模式) |
| app-prd.md | §4 | 打包流程重写 (DMG + Homebrew + Tray) |
| app-prd.md | 新增 §4.7 | Tray 功能定义 |
| chat-ui-spec.md | §8.2 | Widget SDK 类型来源说明 (从 bindings/ 导入) |

### 新增文件

| 文件 | 内容 |
|------|------|
| `docs/specs/repo-spec.md` | 本文档（仓库结构 + 构建规范 + 类型同步 + 生命周期） |

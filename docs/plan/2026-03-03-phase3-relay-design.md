# Phase 3 Relay — Level 1 Bridge 设计文档

> **日期**：2026-03-03
> **范围**：Level 1 (Bridge) — 41 个测试用例
> **前置**：Phase 2 (Extensions) 完成
> **Spec 依赖**：bus-spec §6, relay-spec §1–§4, §6, §9

---

## 技术选型

| 决策 | 选择 | 理由 |
|------|------|------|
| 持久化存储 | RocksDB (`0.22`) | 与 ezagent 核心一致，高写入吞吐 |
| 项目结构 | Workspace 多 crate | 模块边界清晰，便于 Level 2/3 扩展 |
| 配置格式 | TOML | Rust 生态标配，spec 已用 relay.toml |
| 代码复用 | 依赖 `ezagent-protocol` | 编译期保证协议兼容性 |
| 实现路径 | 方案 A: 自底向上 | 逐 crate 构建后集成 |
| 异步运行时 | tokio | 与 ezagent 一致 |
| HTTP 框架 | axum (最小集) | 仅用于 /healthz 端点 |

---

## §1 Crate 结构

```
relay/
├── Cargo.toml                    # workspace root
├── relay.example.toml            # 示例配置
├── crates/
│   ├── relay-core/               # 基础设施层
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── config.rs         # TOML 配置解析 (RelayConfig)
│   │       ├── storage.rs        # RocksDB 存储抽象 (RelayStore)
│   │       ├── entity.rs         # Entity 注册/查询/密钥轮换
│   │       ├── identity.rs       # Ed25519 签名验证
│   │       └── error.rs          # 领域错误类型 (thiserror)
│   │
│   ├── relay-bridge/             # 网络与同步层
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── router.rs         # Zenoh Router 启动/TLS/连接管理
│   │       ├── sync.rs           # CRDT Sync Protocol (Initial + Live)
│   │       ├── persist.rs        # CRDT 文档持久化（写入 RelayStore）
│   │       └── federation.rs     # 多 Relay 连接/跨域路由
│   │
│   ├── relay-blob/               # Blob 存储层
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── store.rs          # SHA256 去重存储/上传/下载
│   │       ├── gc.rs             # 引用计数 + 孤儿 GC
│   │       └── stats.rs          # Blob 统计查询
│   │
│   └── relay-bin/                # 二进制入口
│       └── src/
│           └── main.rs           # CLI 入口，组装各 crate，启动服务
│
├── tests/                        # 集成测试（跨 crate）
│   ├── bridge_tests.rs           # TC-3-BRIDGE-*
│   ├── store_tests.rs            # TC-3-STORE-*
│   ├── ident_tests.rs            # TC-3-IDENT-*
│   ├── blob_tests.rs             # TC-3-BLOB-*
│   └── multi_tests.rs            # TC-3-MULTI-*
└── CLAUDE.md                     # 更新后的开发指南
```

**Crate 依赖关系：**

```
relay-bin → relay-bridge → relay-core ← ezagent-protocol
                ↓
           relay-blob → relay-core
```

**关键依赖版本（与 ezagent 对齐）：**

| 依赖 | 版本 | 用途 |
|------|------|------|
| zenoh | 1.1 | Zenoh Router (TLS) |
| yrs | 0.21 | CRDT 文档处理 |
| rocksdb | 0.22 | 本地持久化 |
| ed25519-dalek | 2 | 签名验证 |
| tokio | 1 (full) | 异步运行时 |
| serde / serde_json | 1 | 序列化 |
| toml | 0.8 | 配置解析 |
| thiserror | 2 | 错误类型 |
| sha2 | 0.10 | Blob hash |
| axum | 0.7 | HTTP 健康检查 |
| ezagent-protocol | path | 协议类型复用 |

---

## §2 relay-core 详细设计

### §2.1 配置 (`config.rs`)

```rust
pub struct RelayConfig {
    pub domain: String,                    // "relay-a.example.com"
    pub listen: String,                    // "tls/0.0.0.0:7448"
    pub storage_path: PathBuf,             // "/var/relay/data"
    pub tls: TlsConfig,                    // cert_path, key_path, ca_path
    pub require_auth: bool,                // 是否要求连接认证
    pub blob: BlobConfig,                  // max_blob_size, orphan_retention_days
    pub peers: Vec<String>,               // 联邦 Relay 地址
    pub healthz_port: u16,                // HTTP 端口 (默认 8080)
}

pub struct TlsConfig {
    pub cert_path: PathBuf,
    pub key_path: PathBuf,
    pub ca_path: Option<PathBuf>,          // 自签 CA
}

pub struct BlobConfig {
    pub max_blob_size: u64,                // 默认 50MB
    pub orphan_retention_days: u64,        // 默认 7 天
    pub gc_interval_hours: u64,            // 默认 24 小时
}
```

### §2.2 存储 (`storage.rs`)

RocksDB Column Families：

| CF | 用途 | Key → Value |
|---|---|---|
| `entities` | Entity 注册数据 | `entity_id` → `EntityRecord (json)` |
| `rooms` | Room CRDT state | `room_id/doc_type/shard_id` → `yrs bytes` |
| `blobs_meta` | Blob 元数据 | `sha256_hash` → `BlobMeta (size, ref_count, created_at)` |
| `blob_refs` | Blob 引用关系 | `ref_id` → `sha256_hash` |

Blob 二进制文件存文件系统：`{storage_path}/blobs/{hash[0..2]}/{hash[2..4]}/{sha256_hash}.blob`

### §2.3 Entity 管理 (`entity.rs`)

```rust
pub struct EntityRecord {
    pub entity_id: String,         // "@alice:relay-a.example.com"
    pub pubkey: Vec<u8>,           // Ed25519 公钥
    pub registered_at: u64,        // Unix timestamp
    pub status: EntityStatus,      // Active | Revoked
}

pub trait EntityManager {
    fn register(&self, entity_id: &str, pubkey: &[u8]) -> Result<()>;
    fn get_pubkey(&self, entity_id: &str) -> Result<Vec<u8>>;
    fn list_entities(&self, limit: usize, offset: usize) -> Result<Vec<EntityRecord>>;
    fn rotate_key(&self, entity_id: &str, new_pubkey: &[u8], proof: &SignedEnvelope) -> Result<()>;
    fn validate_entity_id(&self, entity_id: &str, relay_domain: &str) -> Result<()>;
}
```

覆盖 TC: IDENT-001 ~ IDENT-008

### §2.4 签名验证 (`identity.rs`)

复用 `ezagent-protocol` 的 `SignedEnvelope` 验证：
- 验证 Ed25519 签名正确性
- 验证 `signer_id == author`
- 时间戳容差 ±5 分钟

覆盖 TC: STORE-008, STORE-009

### §2.5 错误类型 (`error.rs`)

```rust
pub enum RelayError {
    EntityExists,           // ERR-RELAY-001
    DomainMismatch,         // ERR-RELAY-002
    InvalidEntityId,
    EntityNotFound,
    BlobNotFound,
    BlobTooLarge,
    SignatureInvalid,
    AuthorMismatch,
    TimestampExpired,
    ConfigError(String),
    StorageError(String),
    NetworkError(String),
}
```

---

## §3 relay-bridge 详细设计

### §3.1 Zenoh Router (`router.rs`)

- Zenoh `Session` 以 `router` mode 启动
- TLS 配置通过 Zenoh Config 的 `transport.link.tls` 传入
- 认证模式：`require_auth = true` 时，通过 Zenoh `transport.auth` 配合自定义认证器
- 连接/断开事件通过回调通知上层

覆盖 TC: BRIDGE-001 ~ BRIDGE-007

### §3.2 CRDT 持久化 (`persist.rs`)

- 订阅 Key Space `ezagent/room/*/index/*/updates` 和 `ezagent/room/*/content/*/updates`
- 每次收到 SignedEnvelope：验证签名 → 应用到本地 yrs Doc → 写入 RocksDB
- 持久化格式：state（完整快照）+ updates（增量），与 ezagent 一致
- 重启后从 RocksDB 恢复所有 Room 的 yrs Doc

覆盖 TC: STORE-001, 006, 007, 011

### §3.3 Sync Protocol (`sync.rs`)

**Initial Sync:**
- Relay 注册为 Zenoh Queryable
- 响应 state vector 查询 → 返回差量更新或全量快照
- 支持 Timeline Index 分片按需同步

**Live Sync:**
- 订阅 `{key_pattern}/updates` → 验证 → 持久化 → 转发到其他订阅者
- Reliable QoS, priority=Data, congestion_control=Block

覆盖 TC: STORE-002 ~ 005, 008 ~ 010, BRIDGE-005, 006

### §3.4 Federation (`federation.rs`)

- 连接到 `config.peers` 列表中的其他 Relay
- 跨 Relay Entity 解析：向目标 Relay 查询公钥，本地缓存
- 跨 Relay Room 同步：同一 Room 的 CRDT 更新在 Relay 间传播
- 跨 Relay Blob 拉取：按需从源 Relay 获取 blob
- 链路断开后自动重连，CRDT 保证最终一致性

覆盖 TC: MULTI-001 ~ MULTI-005

---

## §4 relay-blob 详细设计

### §4.1 Blob Store (`store.rs`)

- 上传流程：计算 SHA256 → 检查去重 → 写入文件 → 写入 RocksDB 元数据 → 返回 hash
- 下载流程：查询 RocksDB 元数据 → 读取文件 → 返回字节
- 大小限制：超过 `max_blob_size` 拒绝上传
- 引用计数：消息引用 blob 时 inc_ref，消息删除时 dec_ref

存储路径：`blobs/{hash[0..2]}/{hash[2..4]}/{sha256_hash}.blob`（两级目录分片）

覆盖 TC: BLOB-001 ~ BLOB-005, BLOB-010

### §4.2 GC (`gc.rs`)

- 扫描 `blobs_meta` CF，找到 `ref_count == 0` 的条目
- 检查 `created_at + retention_days < now` → 超期则删除
- 使用 RocksDB 只读快照扫描，不阻塞写入
- 删除顺序：先删文件 → 再删 RocksDB 记录（crash-safe）
- 后台定时调度（默认每 24 小时）

覆盖 TC: BLOB-006 ~ BLOB-009

---

## §5 relay-bin 入口

```rust
#[tokio::main]
async fn main() {
    // 1. 解析 relay.toml（支持 --config 参数）
    // 2. 初始化 RocksDB (RelayStore)
    // 3. 启动 EntityManager
    // 4. 启动 BlobStore + 后台 BlobGc
    // 5. 启动 Zenoh Router (RelayRouter)
    // 6. 启动 CrdtPersist + SyncServer
    // 7. 启动 Federation (如有 peers 配置)
    // 8. 启动 HTTP server (/healthz)
    // 9. 等待 SIGTERM → 优雅停机
}
```

优雅停机流程：
1. 通知已连接 Peer
2. 等待进行中的同步完成（超时 30s）
3. 持久化所有待写入数据
4. 关闭 Zenoh Router
5. 关闭 RocksDB
6. exit(0)

覆盖 TC: DEPLOY-001 ~ DEPLOY-005

---

## §6 构建顺序（方案 A: 自底向上）

| 步骤 | Crate | 内容 | 覆盖 TC |
|------|-------|------|---------|
| **Step 1** | relay workspace | Cargo.toml workspace 搭建 + 所有 crate 骨架 | — |
| **Step 2** | relay-core | config + storage + entity + identity + error | IDENT-001~008 |
| **Step 3** | relay-blob | store + gc + stats | BLOB-001~010 |
| **Step 4** | relay-bridge | router + persist + sync + federation | BRIDGE-001~007, STORE-001~011 |
| **Step 5** | relay-bin | main 入口 + healthz + 优雅停机 | DEPLOY-001~005 |
| **Step 6** | tests/ | 集成测试（跨 crate 端到端） | MULTI-001~005 + 全部回归 |

---

## §7 TC 覆盖矩阵

| TC 区域 | 数量 | 主要 Crate | 测试类型 |
|---------|------|-----------|----------|
| BRIDGE (001~007) | 7 | relay-bridge | 集成（需 Zenoh） |
| STORE (001~011) | 11 | relay-bridge + relay-core | 混合 |
| IDENT (001~008) | 8 | relay-core | 单元 + 集成 |
| BLOB (001~010) | 10 | relay-blob + relay-core | 单元 + 集成 |
| MULTI (001~005) | 5 | relay-bridge (federation) | 集成（需多实例） |
| DEPLOY (001~005) | 5 | relay-bin | 端到端 |
| **合计** | **46** | | |

注：DEPLOY 区域 5 个 TC 虽跨 Level，但 DEPLOY-001/002/004/005 属于 Level 1 基础部署验证。

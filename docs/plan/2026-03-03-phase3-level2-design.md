# Phase 3 Relay — Level 2 Managed 设计文档

> **日期**：2026-03-03
> **范围**：Level 2 (Managed) — 33 个测试用例
> **前置**：Phase 3 Level 1 (Bridge) 完成
> **Spec 依赖**：bus-spec §6.4, relay-spec §5–§8

---

## 技术选型

| 决策 | 选择 | 理由 |
|------|------|------|
| Crate 布局 | 扩展现有 4 crate | 模块已划分好，避免增加依赖复杂度 |
| Admin 认证 | Ed25519 签名请求 | 与协议层一致，内建重放保护 |
| ACL 深度 | Room membership + power_level | bus-spec §6.4.1，Extension writer_rule 延后 |
| Bandwidth quota | 延期到 Level 3 | 需要 per-request 计量，复杂度高 |
| Metrics 库 | prometheus 0.13 | 标准 Prometheus exposition format |
| 实现路径 | 方案 A: 自底向上 | 与 Level 1 一致 |

---

## §1 变更总览

### §1.1 新增文件

| Crate | 文件 | 职责 |
|-------|------|------|
| relay-core | `src/quota.rs` | Quota 配置、用量追踪、检查 |
| relay-bridge | `src/acl.rs` | ACL 拦截器（Room 成员+power_level） |
| relay-bin | `src/admin.rs` | Admin API HTTP 路由 |
| relay-bin | `src/metrics.rs` | Prometheus 指标收集与输出 |

### §1.2 修改文件

| 文件 | 变更 |
|------|------|
| relay-core `error.rs` | +6 错误变体（Quota/ACL/Admin） |
| relay-core `config.rs` | +admin_entities, +QuotaDefaults |
| relay-core `storage.rs` | +2 CF (quota_config, quota_usage) + CRUD 方法 |
| relay-core `entity.rs` | +revoke() 方法 |
| relay-core `lib.rs` | pub mod quota |
| relay-bridge `persist.rs` | 集成 ACL + Quota 检查 |
| relay-bridge `lib.rs` | pub mod acl |
| relay-bin `main.rs` | 注册 Admin/metrics/readyz 路由 |
| relay-bin `Cargo.toml` | +prometheus 依赖 |
| relay workspace `Cargo.toml` | +prometheus 到 workspace dependencies |

### §1.3 新增 RocksDB Column Families

| CF | 用途 | Key → Value |
|----|------|-------------|
| `quota_config` | Per-entity quota 配置 | `entity_id` → `QuotaConfig (json)` |
| `quota_usage` | Per-entity 用量统计 | `entity_id` → `QuotaUsage (json)` |

现有 4 CF（entities, rooms, blobs_meta, blob_refs）保持不变。

---

## §2 relay-core 扩展

### §2.1 错误类型 (`error.rs`)

新增 Level 2 错误变体：

```rust
// Quota errors
QuotaExceeded {
    entity_id: String,
    dimension: String,   // "storage_total" | "blob_total" | "rooms_max"
    used: u64,
    limit: u64,
},

// ACL errors
NotAMember {
    entity_id: String,
    room_id: String,
},
InsufficientPowerLevel {
    entity_id: String,
    required: u32,
    actual: u32,
},
NotAuthor {
    entity_id: String,
    author: String,
},

// Admin errors
Unauthorized(String),
Forbidden(String),
ReplayDetected { timestamp_ms: i64 },
```

### §2.2 配置扩展 (`config.rs`)

```rust
// 新增到 RelayConfig
pub admin_entities: Vec<String>,   // 管理员 entity ID 列表
pub quota: QuotaDefaults,          // 默认 quota 设置

pub struct QuotaDefaults {
    pub storage_total: u64,     // 默认 1 GB
    pub blob_total: u64,        // 默认 500 MB
    pub blob_single_max: u64,   // 默认 50 MB
    pub rooms_max: u32,         // 默认 500
}
```

### §2.3 Quota 管理 (`quota.rs`)

**数据模型：**

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuotaConfig {
    pub storage_total: u64,
    pub blob_total: u64,
    pub blob_single_max: u64,
    pub rooms_max: u32,
    pub source: QuotaSource,  // Default | Override
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuotaUsage {
    pub storage_used: u64,
    pub blob_used: u64,
    pub rooms_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum QuotaSource {
    Default,
    Override,
}
```

**QuotaManager 接口：**

```rust
pub struct QuotaManager {
    store: RelayStore,
    defaults: QuotaDefaults,
}

impl QuotaManager {
    pub fn new(store: RelayStore, defaults: QuotaDefaults) -> Self;

    // 检查操作（拒绝时返回 QuotaExceeded）
    pub fn check_blob_upload(&self, entity_id: &str, blob_size: u64) -> Result<()>;
    pub fn check_storage_write(&self, entity_id: &str, data_size: u64) -> Result<()>;
    pub fn check_room_create(&self, entity_id: &str) -> Result<()>;

    // 用量更新
    pub fn inc_blob_usage(&self, entity_id: &str, blob_size: u64) -> Result<()>;
    pub fn inc_storage_usage(&self, entity_id: &str, data_size: u64) -> Result<()>;
    pub fn inc_room_count(&self, entity_id: &str) -> Result<()>;

    // 查询
    pub fn get_quota(&self, entity_id: &str) -> Result<QuotaConfig>;
    pub fn get_usage(&self, entity_id: &str) -> Result<QuotaUsage>;
    pub fn usage_percentage(&self, entity_id: &str) -> Result<f64>;

    // Admin 管理
    pub fn set_override(&self, entity_id: &str, config: &QuotaConfig) -> Result<()>;
    pub fn delete_override(&self, entity_id: &str) -> Result<()>;
    pub fn get_defaults_config(&self) -> QuotaConfig;

    // 初始化
    pub fn ensure_defaults(&self, entity_id: &str) -> Result<()>;
}
```

覆盖 TC: QUOTA-001~003, 005~010（跳过 QUOTA-004 bandwidth）

### §2.4 Entity 扩展 (`entity.rs`)

新增 `revoke()` 方法：

```rust
impl EntityManagerImpl {
    /// Revoke an entity: set status to Revoked.
    pub fn revoke(&self, entity_id_str: &str) -> Result<EntityRecord>;
}
```

覆盖 TC: ADMIN-009

### §2.5 存储扩展 (`storage.rs`)

新增 2 个 CF：`quota_config`, `quota_usage`。

更新 `ALL_CFS` 数组和 `open()` 方法。新增：
- `put_quota_config / get_quota_config / delete_quota_config`
- `put_quota_usage / get_quota_usage / delete_quota_usage`
- `list_quota_config_keys()`

---

## §3 relay-bridge 扩展

### §3.1 ACL 拦截器 (`acl.rs`)

```rust
pub struct RoomMembership {
    pub members: HashSet<String>,
    pub power_levels: HashMap<String, u32>,
    pub invite_level: u32,        // 默认 50
    pub admin_level: u32,         // 默认 100
}

pub struct AclInterceptor {
    store: Arc<RelayStore>,
}

impl AclInterceptor {
    pub fn new(store: Arc<RelayStore>) -> Self;

    /// 从 rooms CF 加载 Room 的成员数据。
    pub fn load_membership(&self, room_id: &str) -> Result<RoomMembership>;

    /// 验证入站 CRDT update: signer 必须是 room 成员。
    pub fn check_update(&self, room_id: &str, signer: &str) -> Result<()>;

    /// 验证 Room Config 修改: 需要 admin power_level。
    pub fn check_config_write(&self, room_id: &str, signer: &str) -> Result<()>;

    /// 验证消息删除: author 本人或 admin。
    pub fn check_delete(&self, room_id: &str, signer: &str, author: &str) -> Result<()>;

    /// 验证邀请: signer 的 power_level >= invite_level。
    pub fn check_invite(&self, room_id: &str, signer: &str) -> Result<()>;

    /// 检查 Room 成员关系。
    pub fn is_member(&self, room_id: &str, entity_id: &str) -> Result<bool>;

    /// 获取 entity 在 room 中的 power_level。
    pub fn get_power_level(&self, room_id: &str, entity_id: &str) -> Result<u32>;
}
```

### §3.2 集成到 persist.rs

更新 `CrdtPersist::apply_update()` 流程：

```
SignedEnvelope 到达
  → verify_envelope()                    // Level 1: 签名验证
  → acl_interceptor.check_update()       // Level 2: 成员 + 权限检查
  → quota_manager.check_storage_write()  // Level 2: 配额检查
  → apply to yrs Doc + persist to DB     // Level 1: CRDT 写入
  → quota_manager.inc_storage_usage()    // Level 2: 更新用量
```

### §3.3 Room 成员数据存储

Room Config 以 yrs Doc 形式存储在 rooms CF。`load_membership()` 从 yrs Doc 中提取 `members` 和 `power_levels` 字段。

存储格式（在 yrs Map 中）：
- `"members"` → JSON array of entity_id strings
- `"power_levels"` → JSON object { entity_id: level }
- `"invite_level"` → u32
- `"admin_level"` → u32

覆盖 TC: ACL-001~008

---

## §4 relay-bin 扩展

### §4.1 Admin API (`admin.rs`)

**认证中间件：**

请求必须携带 `X-Ezagent-Signature` header（base64 编码的 SignedEnvelope）。

验证逻辑：
1. 解码 SignedEnvelope
2. 验证 Ed25519 签名
3. 检查 signer_id ∈ config.admin_entities
4. 检查 timestamp ±5min（防重放，TC-3-ADMIN-008）

**路由：**

| 方法 | 路径 | 功能 | TC |
|------|------|------|-----|
| GET | `/admin/status` | Relay 状态概览 | ADMIN-002 |
| GET | `/admin/entities` | 列出 Entity（支持 ?limit=&offset=） | ADMIN-003 |
| GET | `/admin/entities/:id` | Entity 详情 | ADMIN-003 |
| DELETE | `/admin/entities/:id` | 吊销 Entity | ADMIN-009 |
| GET | `/admin/quota/defaults` | 查看默认配额 | — |
| PUT | `/admin/quota/defaults` | 更新默认配额 | — |
| GET | `/admin/quota/entities/:id` | Entity 配额+用量 | QUOTA-005 |
| PUT | `/admin/quota/entities/:id` | 设置配额覆盖 | ADMIN-004, QUOTA-008 |
| DELETE | `/admin/quota/entities/:id` | 删除覆盖 | — |
| GET | `/admin/rooms` | Room 列表 | ADMIN-005 |
| POST | `/admin/gc` | 触发 GC | ADMIN-006 |
| GET | `/admin/gc/status` | GC 状态 | ADMIN-007 |

认证中间件覆盖: ADMIN-001, ADMIN-008

### §4.2 Monitoring (`metrics.rs`)

使用 `prometheus` 0.13 crate，全局 Registry。

**指标定义：**

| 指标 | 类型 | 说明 |
|------|------|------|
| `relay_peers_connected` | IntGauge | 当前连接 Peer 数 |
| `relay_rooms_total` | IntGauge | Room 总数 |
| `relay_entities_total` | IntGauge | Entity 总数 |
| `relay_blob_store_bytes` | IntGauge | Blob 存储量 |
| `relay_blob_count` | IntGauge | Blob 数量 |
| `relay_sync_operations_total` | IntCounter | Sync 操作数 |
| `relay_quota_rejections_total` | IntCounter | Quota 拒绝次数 |
| `relay_requests_total` | IntCounterVec (method) | HTTP 请求数 |

**端点：**

| 路径 | 功能 | TC |
|------|------|-----|
| GET `/metrics` | Prometheus text format | MON-001 |
| GET `/healthz` | 健康检查（扩展 degraded 状态） | MON-002, MON-003 |
| GET `/readyz` | 就绪检查 | MON-004 |

**健康检查逻辑：**
- `healthy`: 所有组件正常
- `degraded`: 存储 > 90%（需检查 blob 用量）
- `unhealthy`: RocksDB 不可写或 Zenoh 断开

**就绪检查逻辑：**
- 启动时 readyz 返回 503
- 数据加载完成后设置 `AtomicBool` ready flag
- readyz 检查 flag 返回 200 或 503

### §4.3 main.rs 更新

启动序列新增步骤：

```rust
// Level 1 (已有)
// 1. 解析 relay.toml
// 2. 初始化 RocksDB
// 3. 启动 HTTP /healthz

// Level 2 (新增)
// 4. 初始化 QuotaManager (relay-core)
// 5. 初始化 AclInterceptor (relay-bridge)
// 6. 初始化 Prometheus Registry + RelayMetrics
// 7. 注册 Admin API routes (/admin/*)
// 8. 注册 /metrics + /readyz 端点
// 9. 设置 ready flag = true
```

---

## §5 构建顺序

| 步骤 | 范围 | 内容 | 覆盖 TC |
|------|------|------|---------|
| **Step 1** | relay-core | error + config + storage CF + quota.rs | QUOTA-001~003, 005~010 |
| **Step 2** | relay-bridge | acl.rs + persist.rs 集成 | ACL-001~008 |
| **Step 3** | relay-bin | admin.rs + metrics.rs + main.rs | ADMIN-001~009, MON-001~006 |
| **Step 4** | tests/ | 集成测试 | 全部回归 |

---

## §6 TC 覆盖矩阵

| TC 区域 | 数量 | 主要位置 | 测试类型 |
|---------|------|---------|----------|
| ACL (001~008) | 8 | relay-bridge acl.rs | 单元 + 集成 |
| QUOTA (001~003, 005~010) | 9 | relay-core quota.rs | 单元 |
| ADMIN (001~009) | 9 | relay-bin admin.rs | 集成（HTTP） |
| MON (001~006) | 6 | relay-bin metrics.rs | 集成（HTTP） |
| **合计** | **32** | | |

注：TC-3-QUOTA-004（bandwidth_daily）延期到 Level 3。

---

## §7 新增依赖

| 依赖 | 版本 | 用途 | 位置 |
|------|------|------|------|
| prometheus | 0.13 | Prometheus 指标 | relay-bin |

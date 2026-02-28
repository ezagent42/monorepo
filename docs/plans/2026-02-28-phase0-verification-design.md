# Phase 0 技术验证设计

> **日期**: 2026-02-28
> **状态**: Approved
> **目标**: 验证 yrs + Zenoh + PyO3 三者集成可行性
> **Gate**: 11 TC pass + Fixture 加载 + Spec 覆盖 100% + 无 P0/P1 bug

---

## 1. 决策记录

| 决策点 | 选项 | 决定 | 理由 |
|--------|------|------|------|
| 项目结构 | 完整 workspace / 单 crate / 独立验证项目 | 完整 Cargo workspace | 遵循 repo-spec，不需要后续重构 |
| Crate 范围 | 3 crate / 单 crate / 全 5 crate | 3 crate (protocol + backend + py) | 最小且完整，protocol 从第一天独立 |
| Relay 环境 | zenohd 进程 / 内嵌 Router / 跳过 | zenohd Router 进程 | 最简单，不需要写 Relay 代码 |
| PyO3 范围 | 最小验证 / 纯 Rust / 完整 SDK | 最小验证 (1-2 函数) | 证明跨语言调用链路通畅即可 |

---

## 2. 项目结构

严格按 `docs/specs/repo-spec.md` 定义，Phase 0 搭建 3 个 crate：

```
ezagent/
├── Cargo.toml                     # [workspace] members: 3 crates
├── pyproject.toml                 # maturin build config
├── README.md
├── CLAUDE.md
├── LICENSE
│
├── crates/
│   ├── ezagent-protocol/          # 共享协议类型 (repo-spec §2.2)
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── entity_id.rs       # EntityId 解析、验证、Display
│   │       ├── envelope.rs        # SignedEnvelope 签名/验证
│   │       ├── crypto.rs          # Ed25519 keypair
│   │       ├── key_pattern.rs     # Zenoh key expression 模板
│   │       ├── sync.rs            # StateQuery, StateReply, Update
│   │       └── error.rs           # 协议层错误
│   │
│   ├── ezagent-backend/           # Backend trait + 参考实现
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── traits.rs          # CrdtBackend + NetworkBackend trait
│   │       ├── yrs_backend.rs     # yrs Y.Map/Array/Text 封装
│   │       └── zenoh_backend.rs   # Zenoh pub/sub + queryable + scouting
│   │
│   └── ezagent-py/                # PyO3 最小验证
│       ├── Cargo.toml
│       └── src/
│           └── lib.rs             # crdt_map_roundtrip + async_zenoh_ping
│
├── tests/
│   ├── rust/                      # Phase 0 集成测试 (11 TCs)
│   │   ├── common/
│   │   │   └── mod.rs             # 共享 test helper
│   │   ├── sync_tests.rs          # TC-0-SYNC-001 ~ 008
│   │   └── p2p_tests.rs           # TC-0-P2P-001 ~ 003
│   └── python/                    # PyO3 验证测试
│       └── test_pyo3_bridge.py
│
└── fixtures/                      # Phase 0 fixture 数据
    ├── keypairs/
    │   └── alice.json
    └── ezagent/
        └── room/
            └── R-minimal/
                └── config/
                    └── state.json
```

### Crate 依赖图

```
ezagent-protocol (无外部重依赖)
        │
        ▼
ezagent-backend (依赖: ezagent-protocol, yrs, zenoh, tokio)
        │
        ▼
ezagent-py (依赖: ezagent-protocol, ezagent-backend, pyo3)
```

---

## 3. ezagent-protocol — Phase 0 Scope

**设计约束** (repo-spec §2.2):
- 不依赖 yrs, zenoh, rocksdb, pyo3
- 所有公开类型 `#[derive(Serialize, Deserialize, Debug, Clone)]`
- 纯函数 + 类型定义，无 I/O

### 模块与 TC 映射

| 模块 | 实现内容 | TC 覆盖 |
|------|---------|---------|
| `entity_id.rs` | EntityId 解析 `@local:domain`、格式验证、Display | 所有 TC |
| `crypto.rs` | Ed25519 keypair 生成/从 fixture 加载、sign/verify | TC-0-SYNC-005~008, P2P-* |
| `envelope.rs` | SignedEnvelope 结构 + sign() + verify() + 时间戳容差 ±5min | TC-0-SYNC-008 |
| `key_pattern.rs` | Zenoh key expression 模板 + 变量实例化 | 所有 TC |
| `sync.rs` | StateQuery / StateReply / Update 消息类型 | TC-0-SYNC-005/006 |
| `error.rs` | ProtocolError enum (thiserror) | 全局 |

### 关键类型签名

```rust
// entity_id.rs
pub struct EntityId { pub local_part: String, pub relay_domain: String }
impl EntityId { pub fn parse(s: &str) -> Result<Self, ProtocolError>; }
impl std::fmt::Display for EntityId { ... } // "@local:domain"

// crypto.rs
pub struct Keypair { ... } // 封装 ed25519_dalek::SigningKey
pub struct PublicKey { ... }
impl Keypair {
    pub fn generate() -> Self;
    pub fn from_bytes(secret: &[u8; 32]) -> Self;
    pub fn public_key(&self) -> PublicKey;
}

// envelope.rs
pub struct SignedEnvelope {
    pub version: u8,
    pub signer_id: EntityId,
    pub doc_id: String,
    pub timestamp: i64,
    pub payload: Vec<u8>,
    pub signature: [u8; 64],
}
impl SignedEnvelope {
    pub fn sign(keypair: &Keypair, doc_id: &str, payload: &[u8]) -> Self;
    pub fn verify(&self, pubkey: &PublicKey) -> Result<(), ProtocolError>;
}

// key_pattern.rs
pub struct KeyPattern { template: String }
impl KeyPattern {
    pub fn new(template: &str) -> Self;
    pub fn instantiate(&self, vars: &HashMap<&str, &str>) -> String;
}

// sync.rs
pub enum SyncMessage {
    StateQuery { doc_id: String, state_vector: Option<Vec<u8>> },
    StateReply { doc_id: String, payload: Vec<u8>, is_full: bool },
    Update { envelope: SignedEnvelope },
}
```

---

## 4. ezagent-backend — CRDT + Network Layer

### Trait 定义

```rust
// traits.rs

#[async_trait]
pub trait CrdtBackend: Send + Sync {
    fn get_or_create_doc(&self, doc_id: &str) -> Arc<yrs::Doc>;
    fn state_vector(&self, doc_id: &str) -> Vec<u8>;
    fn encode_state(&self, doc_id: &str, sv: Option<&[u8]>) -> Vec<u8>;
    fn apply_update(&self, doc_id: &str, update: &[u8]) -> Result<(), BackendError>;
}

#[async_trait]
pub trait NetworkBackend: Send + Sync {
    async fn publish(&self, key: &str, envelope: SignedEnvelope) -> Result<(), BackendError>;
    async fn subscribe(&self, key: &str) -> Result<Receiver<SignedEnvelope>, BackendError>;
    async fn register_queryable(&self, key: &str, handler: Arc<dyn QueryHandler>) -> Result<(), BackendError>;
    async fn query_state(&self, key: &str, sv: Option<&[u8]>) -> Result<Vec<u8>, BackendError>;
}
```

### yrs_backend.rs — Phase 0 实现

| 功能 | yrs API | TC |
|------|---------|-----|
| Y.Map CRUD | `MapRef::insert/get/remove` | SYNC-001~003 |
| Y.Array insert | `ArrayRef::insert/push` | SYNC-004 |
| Y.Text edit | `TextRef::insert/remove` | SYNC-007 |
| State Vector | `Doc::transact().state_vector()` | SYNC-005 |
| Diff 编码 | `encode_diff_v1()` / `apply_update()` | SYNC-005/006 |
| LWW/YATA 冲突解决 | yrs 内置 | SYNC-003/004 |

### zenoh_backend.rs — Phase 0 实现

| 功能 | Zenoh API | TC |
|------|-----------|-----|
| Pub/Sub | `session.put()` / `declare_subscriber()` | SYNC-001~004, 007, 008 |
| QoS | `CongestionControl::Block, Priority::Data, Reliability::Reliable` | SYNC-008 |
| LAN Scouting | multicast scouting enabled | P2P-001 |
| Queryable | `session.declare_queryable()` | P2P-002 |
| State Query | `session.get()` | P2P-002, SYNC-005/006 |
| Router 连接 | `Config::connect().endpoint("tcp/...")` | P2P-003 |

### Phase 0 不包含

- RocksDB 持久化 → Phase 1（Phase 0 使用内存存储）
- Hook Pipeline 集成 → Phase 1 (ezagent-engine)
- Writer Rule 验证 → Phase 1

---

## 5. 测试架构

### 共享测试基础设施

```rust
// tests/rust/common/mod.rs

pub struct TestPeer { session: zenoh::Session, crdt: YrsBackend, ... }
pub struct TestRouter { process: Child, port: u16 }

pub async fn spawn_peer(config: PeerConfig) -> TestPeer;
pub async fn spawn_router(port: u16) -> TestRouter;
pub fn load_keypair(name: &str) -> Keypair;
pub fn load_room_config(room_id: &str) -> serde_json::Value;
pub async fn assert_converged(p1: &TestPeer, p2: &TestPeer, doc_id: &str, timeout: Duration);
```

### TC 文件映射

| 文件 | TC | 环境需求 |
|------|-----|---------|
| `sync_tests.rs` | SYNC-001 | 2 peer (P2P) |
| | SYNC-002 | 2 peer (并发写不同键) |
| | SYNC-003 | 2 peer (并发写同键, LWW) |
| | SYNC-004 | 2 peer (Y.Array 并发插入, YATA) |
| | SYNC-005 | 2 peer (离线→重连, state vector diff) |
| | SYNC-006 | 2 peer + Router (持久化→新 peer 查询) |
| | SYNC-007 | 2 peer (Y.Text 并发编辑) |
| | SYNC-008 | 2 peer (QoS 验证) |
| `p2p_tests.rs` | P2P-001 | 2 peer LAN scouting (无 Router) |
| | P2P-002 | 2 peer LAN (queryable 恢复) |
| | P2P-003 | 2 peer + Router (跨 LAN 中继) |

### Gate 检查

测试通过后输出:
1. 11/11 TC pass
2. State vector 收敛验证 (每个 SYNC TC)
3. YATA 确定性排序 (SYNC-004)
4. 延迟 < 2s (所有 SYNC TC)
5. Fixture 加载成功 (keypairs + R-minimal)

---

## 6. PyO3 最小验证

### ezagent-py 实现

```rust
// crates/ezagent-py/src/lib.rs

#[pyfunction]
fn crdt_map_roundtrip(key: &str, value: &str) -> PyResult<String>;

#[pyfunction]
fn async_zenoh_ping(endpoint: &str) -> PyResult<bool>;

#[pymodule]
fn _native(m: &Bound<'_, PyModule>) -> PyResult<()> { ... }
```

### Python 测试

```python
# tests/python/test_pyo3_bridge.py

def test_crdt_roundtrip():
    """TC-PY-001: CRDT map 操作跨语言调用"""
    result = ezagent._native.crdt_map_roundtrip("hello", "world")
    assert result == "world"

@pytest.mark.asyncio
async def test_zenoh_bridge():
    """TC-PY-002: tokio↔asyncio 桥接"""
    alive = await ezagent._native.async_zenoh_ping("tcp/127.0.0.1:7447")
    assert alive is True
```

### 构建

- `maturin develop` — 开发迭代
- `uv run pytest tests/python/` — 运行测试

---

## 7. Fixture 数据

Phase 0 所需 fixture 最小集（来自 `docs/plan/fixtures.md`）：

### keypairs/alice.json

```json
{
  "entity_id": "@alice:relay-a.example.com",
  "public_key_raw": "<32 bytes, base64>",
  "private_key_raw": "<32 bytes, base64>"
}
```

### R-minimal config

```json
{
  "room_id": "01957a3b-0000-7000-8000-000000000005",
  "name": "Sync Test Room",
  "created_by": "@alice:relay-a.example.com",
  "membership": { "policy": "invite", "members": { "@alice:relay-a.example.com": "owner" } },
  "power_levels": { "default": 0, "admin": 100, "users": { "@alice:relay-a.example.com": 100 } },
  "relays": [{ "endpoint": "tcp/relay-a.example.com:7447", "role": "primary" }],
  "enabled_extensions": []
}
```

---

## 8. 依赖版本 (repo-spec Cargo.toml)

```toml
[workspace.dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
ed25519-dalek = "2"
uuid = { version = "1", features = ["v7"] }
yrs = "0.21"
zenoh = "1.1"
pyo3 = { version = "0.22", features = ["extension-module"] }
tokio = { version = "1", features = ["full"] }
thiserror = "2"
async-trait = "0.1"
```

Phase 0 不需要: `rocksdb`, `libloading`, `ulid`, `ts-rs`

---

## 9. Phase 0 → Phase 1 衔接

Phase 0 完成后，Phase 1 在此基础上新增：

| 新增 | 内容 |
|------|------|
| `ezagent-engine` crate | Datatype Registry + Hook Pipeline + Annotation + Index Builder |
| `ezagent-engine/src/builtins/` | Identity, Room, Timeline, Message 四实体 |
| `ezagent-backend/src/rocksdb_store.rs` | RocksDB 持久化（替代内存） |
| `ezagent-protocol` 扩展 | DatatypeDecl, HookDecl, WriterRule, Event 类型 |
| Fixture 扩展 | R-alpha, R-beta, R-gamma, R-empty + 完整 keypairs |

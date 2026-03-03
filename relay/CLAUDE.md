# CLAUDE.md — relay（中继服务）

Relay 是 EZAgent 的公共中继服务，为跨网络的 P2P 节点提供桥接、CRDT 持久化、身份注册、Blob 存储、配额管理和运维管理。License: Apache 2.0。

## 定位

- Relay 是**邮递员**——缓存和转发数据，不拥有数据
- 同一局域网内的节点通过 multicast 自动发现、直连
- 跨网络时，Relay 提供桥接（公网中转）
- 支持联邦拓扑：选择性共享，非全盘托管

## 技术栈

- **Rust** — 服务实现（workspace 多 crate）
- **zenoh** — 网络通信层（Router 模式，与 ezagent 核心共享协议）
- **yrs** — CRDT 文档同步（Yjs 兼容）
- **RocksDB** — 本地持久化（6 个 Column Families：entities, rooms, blobs_meta, blob_refs, quota_config, quota_usage）
- **axum** — HTTP 端点（healthz、readyz、metrics、admin API）
- **prometheus** — Prometheus 指标暴露（text exposition format）
- **base64** — SignedEnvelope 编解码（Admin API 认证头）
- **ezagent-protocol** — 协议类型复用（SignedEnvelope, PublicKey, Keypair, EntityId, SyncMessage）

## Workspace 结构

```
relay/
├── Cargo.toml                # workspace root
├── relay.example.toml        # 示例配置
├── crates/
│   ├── relay-core/           # 基础设施：config, storage, entity, identity, error, quota
│   │   └── src/
│   │       ├── config.rs     # TOML 配置解析（含 quota defaults, admin_entities）
│   │       ├── storage.rs    # RocksDB 封装（6 CFs）
│   │       ├── entity.rs     # Entity 注册、查询、吊销
│   │       ├── identity.rs   # Entity ID 格式校验
│   │       ├── quota.rs      # 配额管理（per-entity limits, usage tracking）
│   │       ├── error.rs      # RelayError 领域错误
│   │       └── lib.rs
│   ├── relay-blob/           # Blob 存储：SHA256 去重, 引用计数, GC
│   ├── relay-bridge/         # 网络层：Zenoh Router, CRDT 同步, 联邦, ACL
│   │   └── src/
│   │       ├── acl.rs        # ACL 拦截器（Entity 签名验证 + 配额检查）
│   │       ├── router.rs     # Zenoh Router 管理
│   │       ├── sync.rs       # CRDT 同步处理
│   │       ├── persist.rs    # CRDT 持久化
│   │       ├── federation.rs # 联邦路由
│   │       └── lib.rs
│   └── relay-bin/            # 二进制入口：启动、HTTP 端点、Admin API、优雅停机
│       └── src/
│           ├── main.rs       # 入口：配置加载、RocksDB 初始化、HTTP 服务
│           ├── admin.rs      # Admin API（12 路由，Ed25519 认证中间件）
│           └── metrics.rs    # Prometheus 指标定义与编码
└── CLAUDE.md
```

## HTTP 端点

| 路径 | 说明 |
|------|------|
| `/healthz` | 健康检查（始终返回 200，含 storage 状态） |
| `/readyz` | 就绪探针（启动完成前返回 503） |
| `/metrics` | Prometheus 指标暴露（text/plain） |
| `/admin/*` | Admin API（12 路由，需 Ed25519 签名认证） |

### Admin API 路由

所有 `/admin/*` 路由需要 `X-Ezagent-Signature` 请求头（base64 编码的 SignedEnvelope JSON）。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/status` | Relay 状态信息 |
| GET | `/admin/entities` | 列出所有 Entity（可按 status 过滤） |
| GET | `/admin/entities/{id}` | 查询单个 Entity 详情 |
| POST | `/admin/entities/{id}/revoke` | 吊销 Entity |
| GET | `/admin/quota/defaults` | 查询默认配额配置 |
| GET | `/admin/entities/{id}/quota` | 查询 Entity 配额与用量 |
| PUT | `/admin/entities/{id}/quota` | 设置 Entity 配额覆盖 |
| DELETE | `/admin/entities/{id}/quota` | 删除 Entity 配额覆盖（回退到默认值） |
| GET | `/admin/rooms` | 列出所有 Room |
| POST | `/admin/gc/trigger` | 触发 Blob GC |
| GET | `/admin/gc/status` | 查询 GC 状态 |

## 开发指南

### Rust 规范

- 使用 `cargo fmt` 和 `cargo clippy`
- 错误处理用 `thiserror` 定义领域错误（`RelayError`），**禁止 `unwrap()` / `expect()`**
- 公开 API 必须有文档注释（`///`）
- 异步运行时用 `tokio`

### 测试

两级测试策略：

```bash
# 确定性测试（默认，CI 安全）—— 当前 94 个测试
cargo test --workspace

# 环境依赖测试（需要 Zenoh Router 等基础设施）
cargo test --workspace -- --ignored
```

环境依赖测试清单：

| 测试 | 依赖 | 标记 |
|------|------|------|
| `tc_3_bridge_001_relay_starts_and_listens` | 可用端口 | `#[ignore]` |
| `tc_3_multi_*` | 多 Zenoh Router 实例 | `#[ignore]` |

### RocksDB Column Families

| CF 名称 | 用途 | 引入 Level |
|----------|------|-----------|
| `entities` | Entity 注册记录 | Level 1 |
| `rooms` | Room 元数据 | Level 1 |
| `blobs_meta` | Blob 元数据 | Level 1 |
| `blob_refs` | Blob 引用计数 | Level 1 |
| `quota_config` | Per-entity 配额配置覆盖 | Level 2 |
| `quota_usage` | Per-entity 配额使用量 | Level 2 |

### 安全考虑

- Relay 使用 Ed25519 签名验证所有 CRDT 更新
- Admin API 使用 Ed25519 SignedEnvelope 认证（5 分钟时间戳容差）
- 连接认证基于 Identity 协议层
- ACL 拦截器在桥接层检查 Entity 签名和配额
- Blob GC 采用 crash-safe 顺序（先删文件后删 DB 记录）

## Spec 参考

- `docs/specs/relay-spec.md` — Relay 运营规范
- `docs/specs/bus-spec.md` §6 — Relay 协议行为
- `docs/plan/phase-3-relay.md` — 测试用例（93 TC, Level 1/2/3）

## Commit scope

```
feat(relay): add websocket reconnection
fix(relay): handle connection timeout gracefully
```

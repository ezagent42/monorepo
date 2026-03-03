# CLAUDE.md — relay（中继服务）

Relay 是 EZAgent 的公共中继服务，为跨网络的 P2P 节点提供桥接、CRDT 持久化、身份注册和 Blob 存储。License: Apache 2.0。

## 定位

- Relay 是**邮递员**——缓存和转发数据，不拥有数据
- 同一局域网内的节点通过 multicast 自动发现、直连
- 跨网络时，Relay 提供桥接（公网中转）
- 支持联邦拓扑：选择性共享，非全盘托管

## 技术栈

- **Rust** — 服务实现（workspace 多 crate）
- **zenoh** — 网络通信层（Router 模式，与 ezagent 核心共享协议）
- **yrs** — CRDT 文档同步（Yjs 兼容）
- **RocksDB** — 本地持久化（CRDT 状态、Entity 注册、Blob 元数据）
- **axum** — HTTP 健康检查端点
- **ezagent-protocol** — 协议类型复用（SignedEnvelope, EntityId, SyncMessage）

## Workspace 结构

```
relay/
├── Cargo.toml                # workspace root
├── relay.example.toml        # 示例配置
├── crates/
│   ├── relay-core/           # 基础设施：config, storage, entity, identity, error
│   ├── relay-blob/           # Blob 存储：SHA256 去重, 引用计数, GC
│   ├── relay-bridge/         # 网络层：Zenoh Router, CRDT 同步, 联邦
│   └── relay-bin/            # 二进制入口：启动、healthz、优雅停机
└── CLAUDE.md
```

## 开发指南

### Rust 规范

- 使用 `cargo fmt` 和 `cargo clippy`
- 错误处理用 `thiserror` 定义领域错误（`RelayError`），**禁止 `unwrap()` / `expect()`**
- 公开 API 必须有文档注释（`///`）
- 异步运行时用 `tokio`

### 测试

两级测试策略：

```bash
# 确定性测试（默认，CI 安全）
cargo test --workspace

# 环境依赖测试（需要 Zenoh Router 等基础设施）
cargo test --workspace -- --ignored
```

环境依赖测试清单：

| 测试 | 依赖 | 标记 |
|------|------|------|
| `tc_3_bridge_001_relay_starts_and_listens` | 可用端口 | `#[ignore]` |
| `tc_3_multi_*` | 多 Zenoh Router 实例 | `#[ignore]` |

### 安全考虑

- Relay 使用 Ed25519 签名验证所有 CRDT 更新
- 连接认证基于 Identity 协议层
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

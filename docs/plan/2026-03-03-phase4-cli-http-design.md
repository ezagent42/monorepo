# Phase 4: CLI + HTTP API — Design Document

> **日期**: 2026-03-03
> **决策**: 跳过 Phase 3 Level 3（Discovery + Web Fallback），直接开始 Phase 4
> **依据**: Phase 3 Gate 规则明确指出 "Level 1 Gate 是 Phase 4 的前置条件；Level 2 / Level 3 可与 Phase 4 并行推进"。Level 1 核心库（entity, CRDT persist, blob, GC）全部完成且通过测试。

---

## 前提条件确认

| 依赖 | 状态 |
|------|------|
| Phase 3 Level 1 核心库 | 94 tests passing（relay workspace） |
| ezagent 核心引擎 (Phase 0-2.5) | 525 tests passing, 0 failures |
| Phase 3 Level 2 ACL/Quota 逻辑 | 完成（未接入数据通路，不阻塞 Phase 4） |
| Phase 3 Level 3 Discovery/Web | 未开始（不阻塞 Phase 4） |

---

## 架构概览

Phase 4 是**接口层**，包裹已有的 ezagent 引擎（Bus + Extensions + Hook Pipeline + CRDT Sync），通过三个入口暴露功能：

```
ezagent (binary)
├── cli/           ← clap CLI 命令
│   ├── init       ← 身份创建 + Relay 注册
│   ├── identity   ← whoami
│   ├── room       ← create/show/invite
│   ├── rooms      ← list (table/json/quiet)
│   ├── send       ← 发送消息
│   ├── messages   ← 消息列表 + 分页
│   ├── events     ← 实时事件流
│   ├── status     ← 连接状态
│   ├── start      ← HTTP server 启动
│   └── open       ← URI 导航 (EEP-0001)
├── http/          ← axum HTTP 处理器
│   ├── identity   ← /api/identity/*
│   ├── rooms      ← /api/rooms/*
│   ├── messages   ← /api/rooms/{id}/messages/*
│   ├── annotations← /api/rooms/{id}/messages/{id}/annotations/*
│   ├── extensions ← 14 个扩展的专用端点
│   ├── renderers  ← /api/renderers, /api/rooms/{id}/renderers
│   ├── blobs      ← /api/blobs (媒体上传/下载)
│   └── status     ← /api/status
├── ws/            ← WebSocket 事件流
│   ├── handler    ← upgrade + room 过滤
│   └── broadcast  ← 事件分发
└── config/        ← 配置优先级 (env > CLI > file), 退出码
```

### 设计原则

1. **CLI 和 HTTP 共享同一引擎实例** — CLI 命令是引擎 API 的薄包装，HTTP handler 调用相同的引擎方法
2. **HTTP server 由 `ezagent start` 启动**，与 Zenoh peer 同进程运行
3. **WebSocket 事件源自 Zenoh pub/sub** — 引擎现有的事件系统喂给 WS broadcast channel
4. **配置优先级**: env var > CLI arg > `~/.ezagent/config.toml`

---

## 分层策略

| Level | 范围 | Test Cases | 交付物 |
|-------|------|------------|--------|
| **L1: CLI Core** | §1-§5: Identity, Room, Message, Events, Config | 34 TCs | `ezagent init/rooms/send/events/status` 全部可用 |
| **L2: HTTP API** | §6-§9: Bus API, Annotations, Extensions, Render | 37 TCs | 完整 REST API，14 个扩展端点 |
| **L3: WebSocket + URI** | §10-§12: WS events, 错误处理, URI 导航 | 16 TCs | 实时事件流 + `ezagent open` |

每层独立可测试，有明确的 gate 标准。

---

## Level 1: CLI Core — 34 Test Cases

### 新增 crate

- `ezagent-cli` — CLI 入口和命令定义

### 技术选型

| 组件 | 选择 | 理由 |
|------|------|------|
| CLI 框架 | `clap` (derive) | Rust 生态标准，relay-bin 已使用 |
| 输出格式 | `tabled` (table) + `serde_json` (--json) | 清晰的 table/json/quiet 三模式 |
| 配置解析 | `toml` + 环境变量覆盖 | 简单层叠，避免额外依赖 |
| 密钥管理 | `ed25519-dalek` | 与 `ezagent-protocol` 复用 |

### 命令映射

| 命令 | TC 范围 | 核心逻辑 |
|------|---------|----------|
| `ezagent init` | TC-4-CLI-001~003 | 生成 Ed25519 密钥对 → 写 `~/.ezagent/` → 注册到 Relay |
| `ezagent identity whoami` | TC-4-CLI-004~005 | 读 config.toml → 输出 entity_id/relay/pubkey |
| `ezagent room create/show/invite` | TC-4-CLI-010~016 | 通过引擎 API 操作 Room CRDT |
| `ezagent rooms` | TC-4-CLI-011~013 | list rooms → table/json/quiet 三种输出 |
| `ezagent send` | TC-4-CLI-020~021 | 构造 Message → Hook Pipeline → CRDT 写入 |
| `ezagent messages` | TC-4-CLI-022~024 | Timeline Index 查询 → 分页输出 |
| `ezagent events` | TC-4-CLI-030~032 | 订阅 Zenoh → 实时输出事件 (text/json) |
| `ezagent status` | TC-4-CLI-040~041 | 查询连接状态、Room 同步状态 |
| `ezagent start` | TC-4-CLI-042~043 | 启动 HTTP server (--no-ui 控制静态文件) |
| 配置 + 退出码 | TC-4-CLI-050~054 | env > arg > file; exit code 0-5 |

### 退出码定义

| Code | 含义 |
|------|------|
| 0 | 成功 |
| 1 | 运行时错误 |
| 2 | 参数错误 |
| 3 | 连接失败 |
| 4 | 认证失败 |
| 5 | 权限拒绝 |

---

## Level 2: HTTP API — 37 Test Cases

### 新增 crate

- `ezagent-http` — HTTP handler 和路由定义

### 路由表

#### Bus API (§6)

| 方法 | 路径 | TC |
|------|------|-----|
| GET | `/api/identity` | TC-4-HTTP-001 |
| GET | `/api/identity/{entity_id}/pubkey` | TC-4-HTTP-002~003 |
| POST | `/api/rooms` | TC-4-HTTP-010 |
| GET | `/api/rooms` | TC-4-HTTP-011 |
| GET | `/api/rooms/{room_id}` | TC-4-HTTP-012 |
| PATCH | `/api/rooms/{room_id}` | TC-4-HTTP-013 |
| POST | `/api/rooms/{room_id}/invite` | TC-4-HTTP-014 |
| GET | `/api/rooms/{room_id}/members` | TC-4-HTTP-014 |
| POST | `/api/rooms/{room_id}/join` | TC-4-HTTP-015 |
| POST | `/api/rooms/{room_id}/leave` | TC-4-HTTP-015 |
| POST | `/api/rooms/{room_id}/messages` | TC-4-HTTP-020 |
| GET | `/api/rooms/{room_id}/messages` | TC-4-HTTP-021 |
| GET | `/api/rooms/{room_id}/messages/{ref_id}` | TC-4-HTTP-022 |
| DELETE | `/api/rooms/{room_id}/messages/{ref_id}` | TC-4-HTTP-023 |

#### Annotation API (§7)

| 方法 | 路径 | TC |
|------|------|-----|
| POST | `/api/rooms/.../messages/{ref_id}/annotations` | TC-4-HTTP-030 |
| GET | `/api/rooms/.../messages/{ref_id}/annotations` | TC-4-HTTP-031 |
| DELETE | `/api/rooms/.../messages/{ref_id}/annotations/{key}` | TC-4-HTTP-032 |

#### Extension API (§8) — 16 个端点，覆盖 14 个扩展

#### Render Pipeline API (§9)

| 方法 | 路径 | TC |
|------|------|-----|
| GET | `/api/renderers` | TC-4-HTTP-060 |
| GET | `/api/rooms/{room_id}/renderers` | TC-4-HTTP-061 |
| GET | `/api/rooms/{room_id}/views` | TC-4-HTTP-062 |

### 认证

HTTP API 使用 Ed25519 签名认证（与 Admin API 一致的 `X-Ezagent-Signature` 模式），或本地模式下跳过认证（`ezagent start` 仅绑定 localhost）。

### 错误格式

```json
{
  "error": {
    "code": "ROOM_NOT_FOUND",
    "message": "Room not found"
  }
}
```

HTTP 状态码映射: 400 (INVALID_PARAMS), 401 (UNAUTHORIZED), 403 (NOT_A_MEMBER/FORBIDDEN), 404 (NOT_FOUND), 409 (CONFLICT)

---

## Level 3: WebSocket + URI — 16 Test Cases

### WebSocket (§10)

- 端点: `ws://localhost:{port}/ws`
- 可选查询参数: `?room={room_id}` 进行 Room 过滤
- 事件类型: Bus Events (room.*, message.*) + Extension Events (reaction.*, typing.*) + Watch Events
- 断线恢复: 重连后通过 HTTP API 获取离线期间消息

### URI 导航 (§12)

- `ezagent open ezagent://{relay}/{path}` 解析 Room 和 Message URI
- authority 规范化（小写 + 去尾斜杠）
- 错误处理: INVALID_URI (exit 2), RESOURCE_NOT_FOUND (exit 3)

### 错误处理 (§11)

- 5 个标准 HTTP 错误测试 (400/401/404/409 + /api/status)

---

## 代码组织

在 `ezagent/crates/` 下新增：

```
ezagent/crates/
├── ezagent-cli/        ← NEW: CLI 命令 (clap derive)
│   └── src/
│       ├── main.rs     ← 入口
│       ├── commands/   ← 子命令模块
│       └── output.rs   ← table/json/quiet 输出器
├── ezagent-http/       ← NEW: HTTP + WebSocket
│   └── src/
│       ├── lib.rs      ← Router 构建
│       ├── routes/     ← 按资源分组的 handler
│       ├── ws.rs       ← WebSocket handler
│       ├── auth.rs     ← 认证中间件
│       └── error.rs    ← API 错误类型
└── (existing crates unchanged)
```

---

## Phase 3 遗留事项（后续 Sprint）

以下事项不阻塞 Phase 4，可在后续 Sprint 处理：

- [ ] Phase 3 L1: TLS 加密通信
- [ ] Phase 3 L1: Peer 认证网关
- [ ] Phase 3 L1: 多 Relay 跨域联邦（实际 HTTP 路由）
- [ ] Phase 3 L2: ACL/Quota 接入 Zenoh 数据通路
- [ ] Phase 3 L2: Prometheus 指标接入实时事件
- [ ] Phase 3 L2: Admin API 3 个 stub 补全
- [ ] Phase 3 L3: Discovery 索引
- [ ] Phase 3 L3: Web Fallback

# ezagent HTTP API Specification v0.1.1

> **状态**：Architecture Draft
> **日期**：2026-02-26
> **前置文档**：ezagent-py-spec-v0.9.1, ezagent-bus-spec-v0.9.1, ezagent-extensions-spec-v0.9.1
> **作者**：Allen & Claude collaborative design
> **历史**：从 ezagent-py-spec v0.8 §9 + extensions-spec 附录 G 整合为独立文档

---

## §1 概述

ezagent HTTP Server 是基于 FastAPI/Starlette 实现的 HTTP API 层，是 ezagent-py SDK 的薄封装。所有 endpoint 直接映射到 Engine Operation。

```
ezagent-py SDK (PyO3)
       │
       ▼
  FastAPI Server  ← 本文档定义的 HTTP 接口
       │
       ├── REST API (/api/*)
       ├── WebSocket (/ws)
       └── Static Files (Chat UI)
```

### §1.1 启动

```bash
ezagent start                     # 默认 localhost:8000，含 Chat UI
ezagent start --port 9000         # 自定义端口
ezagent start --no-ui             # 只启动 API，不 serve Chat UI
```

### §1.2 基础 URL

```
http://localhost:{port}/api/      # REST API
ws://localhost:{port}/ws           # WebSocket Event Stream
http://localhost:{port}/           # Chat UI 静态文件（除非 --no-ui）
```

---

## §2 Bus API Endpoints

### §2.1 Identity

| Operation | Endpoint | Method | 说明 |
|-----------|----------|--------|------|
| identity.whoami | `/api/identity` | GET | 当前 Entity 信息 |
| identity.get_pubkey | `/api/identity/{entity_id}/pubkey` | GET | 查询公钥 |

### §2.2 Room

| Operation | Endpoint | Method | 说明 |
|-----------|----------|--------|------|
| room.list | `/api/rooms` | GET | 列出已加入 Room |
| room.create | `/api/rooms` | POST | 创建 Room |
| room.get | `/api/rooms/{room_id}` | GET | 查看 Room Config |
| room.update_config | `/api/rooms/{room_id}` | PATCH | 更新 Config |
| room.join | `/api/rooms/{room_id}/join` | POST | 加入 Room |
| room.leave | `/api/rooms/{room_id}/leave` | POST | 离开 Room |
| room.invite | `/api/rooms/{room_id}/invite` | POST | 邀请成员 |
| room.members | `/api/rooms/{room_id}/members` | GET | 成员列表 |

### §2.3 Timeline & Message

| Operation | Endpoint | Method | 说明 |
|-----------|----------|--------|------|
| timeline.list | `/api/rooms/{room_id}/messages` | GET | 消息列表（分页） |
| timeline.get_ref | `/api/rooms/{room_id}/messages/{ref_id}` | GET | 单条消息 |
| message.send | `/api/rooms/{room_id}/messages` | POST | 发送消息 |
| message.delete | `/api/rooms/{room_id}/messages/{ref_id}` | DELETE | 删除消息 |

分页参数：`?limit=20&before={cursor}`

### §2.4 Annotation

| Operation | Endpoint | Method | 说明 |
|-----------|----------|--------|------|
| annotation.list | `/api/rooms/{room_id}/messages/{ref_id}/annotations` | GET | 读取 Ref 上的 Annotation |
| annotation.add | `/api/rooms/{room_id}/messages/{ref_id}/annotations` | POST | 添加 Annotation |
| annotation.remove | `/api/rooms/{room_id}/messages/{ref_id}/annotations/{key}` | DELETE | 删除 Annotation |

### §2.5 System

| Operation | Endpoint | Method | 说明 |
|-----------|----------|--------|------|
| status | `/api/status` | GET | 节点状态 |

---

## §3 Extension API Endpoints

> 写入模式 A = REST API 写入（经 Hook Pipeline）；B = 直接 CRDT 写入。见 extensions-spec §1.5。

### §3.1 EXT-01: Mutable Content

| Endpoint | Method | 说明 | 写入模式 |
|----------|--------|------|---------|
| `/api/rooms/{room_id}/messages/{ref_id}` | PUT | 编辑消息 | A |
| `/api/rooms/{room_id}/messages/{ref_id}/versions` | GET | 编辑历史 | — |

### §3.2 EXT-02: Collaborative Content

| Endpoint | Method | 说明 | 写入模式 |
|----------|--------|------|---------|
| `/api/rooms/{room_id}/content/{content_id}/acl` | GET, PUT | ACL 管理 | A |
| `/api/rooms/{room_id}/content/{content_id}/collab` | WS | 实时协作 | A |

### §3.3 EXT-03: Reactions

| Endpoint | Method | 说明 | 写入模式 |
|----------|--------|------|---------|
| `/api/rooms/{room_id}/messages/{ref_id}/reactions` | POST | 添加 Reaction | A |
| `/api/rooms/{room_id}/messages/{ref_id}/reactions/{emoji}` | DELETE | 移除 Reaction | A |

### §3.4 EXT-05: Cross-Room References

| Endpoint | Method | 说明 | 写入模式 |
|----------|--------|------|---------|
| `/api/rooms/{room_id}/messages/{ref_id}/preview` | GET | 跨 Room 预览 | — |

### §3.5 EXT-06: Channels

| Endpoint | Method | 说明 | 写入模式 |
|----------|--------|------|---------|
| `/api/channels` | GET | Channel 列表 | — |
| `/api/channels/{channel_id}/messages` | GET | Channel 聚合视图 | — |

### §3.6 EXT-07: Moderation

| Endpoint | Method | 说明 | 写入模式 |
|----------|--------|------|---------|
| `/api/rooms/{room_id}/moderation` | POST | 审核操作 | A |

### §3.7 EXT-08: Read Receipts

| Endpoint | Method | 说明 | 写入模式 |
|----------|--------|------|---------|
| `/api/rooms/{room_id}/receipts` | GET | 阅读进度 | B |

### §3.8 EXT-09: Presence

| Endpoint | Method | 说明 | 写入模式 |
|----------|--------|------|---------|
| `/api/rooms/{room_id}/presence` | GET | 在线用户 | B |
| `/api/rooms/{room_id}/typing` | POST | 正在输入 | B |

### §3.9 EXT-10: Media

| Endpoint | Method | 说明 | 写入模式 |
|----------|--------|------|---------|
| `/api/rooms/{room_id}/media` | GET | 媒体列表 | — |
| `/api/blobs` | POST | 上传 Blob | A |
| `/api/blobs/{blob_hash}` | GET | 下载 Blob | — |

### §3.10 EXT-11: Threads

| Endpoint | Method | 说明 | 写入模式 |
|----------|--------|------|---------|
| `/api/rooms/{room_id}/messages?thread_root={ref_id}` | GET | Thread 视图 | — |

### §3.11 EXT-12: Drafts

| Endpoint | Method | 说明 | 写入模式 |
|----------|--------|------|---------|
| `/api/rooms/{room_id}/drafts` | GET | 读取 Draft | B |

### §3.12 EXT-13: Profile

| Endpoint | Method | 说明 | 写入模式 |
|----------|--------|------|---------|
| `/api/identity/{entity_id}/profile` | GET | 读取 Profile | — |
| `/api/identity/{entity_id}/profile` | PUT | 发布/更新 Profile | A |
| `/api/ext/discovery/search` | POST | Entity 搜索（非标准化） | — |

### §3.13 EXT-14: Watch

| Endpoint | Method | 说明 | 写入模式 |
|----------|--------|------|---------|
| `/api/watches` | GET | 我的 Watch 列表 | — |
| `/api/watches` | POST | 创建 Watch | A |
| `/api/watches/{watch_key}` | DELETE | 撤销 Watch | A |

### §3.14 EXT-15: Command

| Endpoint | Method | 说明 | 写入模式 |
|----------|--------|------|---------|
| `/api/commands` | GET | 平台所有可用命令（聚合 command_manifest） | — |
| `/api/rooms/{room_id}/commands` | GET | Room 可用命令（按已安装 Socialware 过滤） | — |
| `/api/commands/{invoke_id}` | GET | 查询命令执行结果 | — |

> 命令发送通过 `POST /api/rooms/{room_id}/messages` 并在 body 中包含 `command` 参数。

发送命令请求体：

```json
{
  "body": "/ta:claim task-42",
  "command": {
    "ns": "ta",
    "action": "claim",
    "params": { "task_id": "task-42" }
  }
}
```

命令执行结果响应体（`GET /api/commands/{invoke_id}`）：

```json
{
  "invoke_id": "uuid:019...",
  "status": "success",
  "result": { "task_id": "task-42", "new_state": "claimed" },
  "handler": "@task-arena:relay-a.example.com",
  "ref_id": "ulid:01HZ..."
}
```

---

## §3b Socialware Management Endpoints

### §3b.1 Socialware 管理

| Endpoint | Method | 说明 |
|----------|--------|------|
| `/api/socialware` | GET | 列出已安装 Socialware 及其状态 |
| `/api/socialware/{sw_id}` | GET | Socialware 详情（manifest + 状态） |
| `/api/socialware/{sw_id}/start` | POST | 启动 Socialware |
| `/api/socialware/{sw_id}/stop` | POST | 停止 Socialware |
| `/api/socialware/install` | POST | 安装 Socialware 包 |
| `/api/socialware/{sw_id}/uninstall` | DELETE | 卸载 Socialware |

列表响应示例：

```json
[
  {
    "id": "event-weaver",
    "name": "EventWeaver",
    "version": "0.9.1",
    "status": "running",
    "identity": "@event-weaver:relay-a.example.com",
    "commands": ["branch", "merge", "replay", "history", "dag"]
  },
  {
    "id": "agent-forge",
    "name": "AgentForge",
    "version": "0.1.0",
    "status": "running",
    "identity": "@agent-forge:relay-a.example.com",
    "commands": ["spawn", "destroy", "list", "wake", "sleep"]
  }
]
```

### §3b.2 Agent 管理（AgentForge）

| Endpoint | Method | 说明 |
|----------|--------|------|
| `/api/agents` | GET | 列出所有 Agent 实例 |
| `/api/agents/{agent_name}` | GET | Agent 详情（状态、配置、活动日志） |
| `/api/agents/templates` | GET | 列出可用 Agent 模板 |

> Agent 的 spawn/destroy/wake/sleep 操作通过 EXT-15 Command 执行（`/af:spawn` 等），不设独立的 REST 端点。这保持了操作路径的一致性——CLI、Chat UI、REST 都通过同一套命令系统。

---

## §4 Render Pipeline API

前端通过以下 endpoint 获取渲染声明，用于 Render Pipeline（详见 chat-ui-spec）。

| Endpoint | Method | 说明 |
|----------|--------|------|
| `/api/renderers` | GET | 聚合返回所有已启用 Extension + Socialware 的 renderer 声明 |
| `/api/rooms/{room_id}/renderers` | GET | 返回该 Room 中已启用 Extension 的 renderer 声明 |
| `/api/rooms/{room_id}/views` | GET | 返回该 Room 可用的 Room Tab 列表 |

---

## §5 WebSocket Event Stream

### §5.1 连接

```
WS /ws                             # 全局事件流
WS /ws?room={room_id}              # 按 Room 过滤
```

### §5.2 Event 格式

```json
{
  "type": "message.new",
  "room_id": "01957a3b-...",
  "ref_id": "01957a3b-...",
  "author": "@alice:relay.ezagent.dev",
  "timestamp": "2026-02-25T10:01:00.000Z",
  "data": { ... }
}
```

### §5.3 Event Types

**Bus Events**：

| Event Type | 触发 |
|------------|------|
| `message.new` | 新消息 |
| `message.deleted` | 消息删除 |
| `room.created` | Room 创建 |
| `room.member_joined` | 成员加入 |
| `room.member_left` | 成员离开 |
| `room.config_updated` | Config 变更 |

**Extension Events**（详见 extensions-spec 附录 F）：

| Event Type | Extension |
|------------|-----------|
| `message.edited` | EXT-01 |
| `reaction.added` / `reaction.removed` | EXT-03 |
| `channel.activity` | EXT-06 |
| `moderation.action` | EXT-07 |
| `presence.joined` / `presence.left` | EXT-09 |
| `typing.start` / `typing.stop` | EXT-09 |
| `watch.ref_content_edited` | EXT-14 |
| `watch.ref_reply_added` | EXT-14 |
| `watch.ref_thread_reply` | EXT-14 |
| `watch.ref_reaction_changed` | EXT-14 |
| `watch.channel_new_ref` | EXT-14 |
| `command.invoked` | EXT-15 |
| `command.result` | EXT-15 |
| `command.timeout` | EXT-15 |

---

## §6 错误响应

```json
{
  "error": {
    "code": "ROOM_NOT_FOUND",
    "message": "Room 01957a3b-... does not exist",
    "details": {}
  }
}
```

HTTP 状态码映射：

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 权限不足 (writer_rule / power_level) |
| 404 | 资源不存在 |
| 409 | 冲突 (如 Entity ID 已存在) |
| 500 | 内部错误 |

---

## §7 实现参考

```python
# python/ezagent/server.py (内部实现概要)
import ezagent
from fastapi import FastAPI, WebSocket

app = FastAPI()
bus = None

@app.on_event("startup")
async def startup():
    global bus
    bus = await ezagent.start(...)

@app.get("/api/rooms")
async def list_rooms():
    return await bus.rooms.list()

@app.websocket("/ws")
async def ws_events(websocket: WebSocket):
    await websocket.accept()
    async for event in bus.events():
        await websocket.send_json(event.dict())

@app.get("/api/renderers")
async def get_renderers():
    """聚合所有已启用 Extension 和 Socialware 的 renderer 声明"""
    return await bus.extensions.get_all_renderers()
```

---

## 变更日志

| 版本 | 日期 | 变更 |
|------|------|------|
| 0.1.1 | 2026-02-26 | 新增 §3.14 EXT-15 Command 端点, §3b Socialware 管理 + Agent 管理端点, WebSocket command.* 事件 |
| 0.1 | 2026-02-25 | 从 ezagent-py-spec v0.8 §9 + extensions-spec 附录 G 整合。新增 §4 Render Pipeline API |

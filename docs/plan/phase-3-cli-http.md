# Phase 3: CLI + HTTP API

> **版本**：0.9
> **目标**：后端完整可用——CLI 命令接口 + HTTP/WebSocket API
> **预估周期**：1-2 周
> **前置依赖**：Phase 2.5 (Python Binding) 完成
> **Spec 依赖**：cli-spec.md, http-spec.md

---

## 验收标准

- `ezagent rooms`, `ezagent send`, `ezagent start --no-ui` 全部可用
- HTTP API 覆盖 Bus + Extension 全部 endpoint
- WebSocket event stream 可订阅并过滤

---

## §1 CLI — Identity 管理

> **Spec 引用**：cli-spec §2.1

### TC-3-CLI-001: ezagent init 注册身份

```
GIVEN  ~/.ezagent/ 目录不存在
       RELAY-A 运行中

WHEN   执行 ezagent init --relay relay-a.example.com --name alice

THEN   ~/.ezagent/identity.key 文件创建（Ed25519 密钥对）
       ~/.ezagent/config.toml 写入：
         [identity] entity_id = "@alice:relay-a.example.com"
         [relay] endpoint = "tls/relay-a.example.com:7448"
       RELAY-A 上注册了 @alice:relay-a.example.com 的公钥
       stdout 输出 "Identity created: @alice:relay-a.example.com"
       exit code = 0
```

### TC-3-CLI-002: ezagent init 指定 CA 证书

```
GIVEN  本地 Relay 使用自签证书

WHEN   执行 ezagent init --relay relay.local --name alice --ca-cert ./ca.pem

THEN   config.toml 写入 ca_cert = "./ca.pem"
       TLS 连接使用自签 CA 验证
       exit code = 0
```

### TC-3-CLI-003: ezagent init 重复注册拒绝

```
GIVEN  ~/.ezagent/config.toml 已存在，entity_id 已配置

WHEN   执行 ezagent init --relay relay-a.example.com --name bob

THEN   stderr 输出 "Identity already exists. Use --force to overwrite."
       exit code = 1
       原有密钥和配置不变
```

### TC-3-CLI-004: ezagent identity whoami

```
GIVEN  ezagent init 已完成，entity_id = "@alice:relay-a.example.com"

WHEN   执行 ezagent identity whoami

THEN   stdout 输出：
       Entity ID:  @alice:relay-a.example.com
       Relay:      relay-a.example.com
       Public Key: <ed25519 指纹>
       exit code = 0
```

### TC-3-CLI-005: ezagent identity whoami 未初始化

```
GIVEN  ~/.ezagent/ 不存在

WHEN   执行 ezagent identity whoami

THEN   stderr 输出 "Not initialized. Run 'ezagent init' first."
       exit code = 1
```

---

## §2 CLI — Room 操作

> **Spec 引用**：cli-spec §2.2

### TC-3-CLI-010: ezagent room create

```
GIVEN  E-alice 已初始化

WHEN   执行 ezagent room create --name "feature-review"

THEN   Room 创建成功
       stdout 输出 "Room created: <room_id>"（UUIDv7 格式）
       E-alice 自动成为成员（creator）
       exit code = 0
```

### TC-3-CLI-011: ezagent rooms 列表（table 格式）

```
GIVEN  E-alice 加入了 R-alpha ("Alpha Team") 和 R-beta ("Beta Team")

WHEN   执行 ezagent rooms

THEN   stdout 输出 table 格式：
       ROOM ID                                NAME         MEMBERS
       01957a3b-0000-7000-8000-000000000001   Alpha Team   4
       01957a3b-0000-7000-8000-000000000002   Beta Team    2
       exit code = 0
```

### TC-3-CLI-012: ezagent rooms --json

```
GIVEN  同 TC-3-CLI-011

WHEN   执行 ezagent rooms --json

THEN   stdout 输出 JSON 数组：
       [{"room_id": "01957a3b-...", "name": "Alpha Team", "members": 4}, ...]
       可被 jq 正确解析
       exit code = 0
```

### TC-3-CLI-013: ezagent rooms --quiet

```
GIVEN  同 TC-3-CLI-011

WHEN   执行 ezagent rooms --quiet

THEN   stdout 仅输出 room_id，每行一个：
       01957a3b-0000-7000-8000-000000000001
       01957a3b-0000-7000-8000-000000000002
       exit code = 0
```

### TC-3-CLI-014: ezagent room show

```
GIVEN  R-alpha 包含 E-alice, E-bob, E-code-reviewer, E-translator

WHEN   执行 ezagent room show 01957a3b-0000-7000-8000-000000000001

THEN   stdout 输出：
       Room:       Alpha Team
       Room ID:    01957a3b-0000-7000-8000-000000000001
       Members:    4
       Extensions: mutable, reactions, reply_to, ...
       ---
       @alice:relay-a.example.com        (admin)
       @bob:relay-a.example.com
       @code-reviewer:relay-a.example.com
       @translator:relay-a.example.com
       exit code = 0
```

### TC-3-CLI-015: ezagent room invite

```
GIVEN  R-alpha 存在，E-alice 是 admin
       E-carol 不在 R-alpha 中

WHEN   执行 ezagent room invite 01957a3b-...001 @carol:relay-b.example.com

THEN   E-carol 加入 R-alpha
       stdout 输出 "Invited @carol:relay-b.example.com to Alpha Team"
       exit code = 0
```

### TC-3-CLI-016: ezagent room show 不存在的 Room

```
GIVEN  Room ID 99999999-0000-0000-0000-000000000000 不存在

WHEN   执行 ezagent room show 99999999-0000-0000-0000-000000000000

THEN   stderr 输出 "Room not found"
       exit code = 1
```

---

## §3 CLI — 消息操作

> **Spec 引用**：cli-spec §2.3

### TC-3-CLI-020: ezagent send

```
GIVEN  E-alice 是 R-alpha 的成员

WHEN   执行 ezagent send 01957a3b-...001 --body "Hello team!"

THEN   消息发送成功，经过完整 Hook Pipeline（pre_send → after_write）
       stdout 输出 "Message sent: <ref_id>"
       exit code = 0
```

### TC-3-CLI-021: ezagent send 非成员被拒

```
GIVEN  E-outsider 不是 R-alpha 的成员

WHEN   执行 ezagent send 01957a3b-...001 --body "Hello"

THEN   stderr 输出 "Permission denied: not a member of this room"
       exit code = 5
```

### TC-3-CLI-022: ezagent messages 列表

```
GIVEN  R-alpha 包含 M-001 到 M-004

WHEN   执行 ezagent messages 01957a3b-...001

THEN   stdout 输出最近 20 条（此处 4 条），table 格式：
       REF ID    AUTHOR                              TIME        BODY
       <M-001>   @alice:relay-a.example.com          10:00:00    Hello world
       <M-002>   @bob:relay-a.example.com            10:01:00    ...
       ...
       exit code = 0
```

### TC-3-CLI-023: ezagent messages --limit 分页

```
GIVEN  R-alpha 包含 M-001 到 M-004

WHEN   执行 ezagent messages 01957a3b-...001 --limit 2

THEN   stdout 输出最近 2 条（M-003, M-004）
       exit code = 0
```

### TC-3-CLI-024: ezagent messages --before 游标分页

```
GIVEN  R-alpha 包含 M-001 到 M-004

WHEN   执行 ezagent messages 01957a3b-...001 --limit 2 --before <M-003的ref_id>

THEN   stdout 输出 M-001, M-002
       exit code = 0
```

---

## §4 CLI — 事件监听与系统操作

> **Spec 引用**：cli-spec §2.4, §2.5

### TC-3-CLI-030: ezagent events 实时流

```
GIVEN  E-alice 启动 ezagent events（前台进程）

WHEN   E-bob 在 R-alpha 中发送一条消息

THEN   E-alice 的 stdout 实时输出事件：
       [10:05:00] message.new  R-alpha  @bob:relay-a  "Review complete"
       进程持续运行直到 Ctrl+C
```

### TC-3-CLI-031: ezagent events --room 过滤

```
GIVEN  E-alice 启动 ezagent events --room 01957a3b-...001

WHEN   E-bob 在 R-alpha 发送消息（匹配）
       E-carol 在 R-beta 发送消息（不匹配）

THEN   只输出 R-alpha 的事件
       R-beta 的事件不出现
```

### TC-3-CLI-032: ezagent events --json

```
GIVEN  E-alice 启动 ezagent events --json

WHEN   E-bob 在 R-alpha 发送消息

THEN   stdout 输出 JSON Line 格式：
       {"type":"message.new","room_id":"01957a3b-...","ref_id":"...","author":"@bob:..."}
       可被 jq 正确解析
```

### TC-3-CLI-040: ezagent status

```
GIVEN  E-alice 已初始化，连接到 RELAY-A，加入 2 个 Room

WHEN   执行 ezagent status

THEN   stdout 输出：
       Entity:   @alice:relay-a.example.com
       Status:   Connected
       Relay:    relay-a.example.com (connected)
       Rooms:    2 synced
       Peers:    1 direct (LAN)
       exit code = 0
```

### TC-3-CLI-041: ezagent status Relay 不可达

```
GIVEN  E-alice 已初始化，但 RELAY-A 宕机

WHEN   执行 ezagent status

THEN   Relay 状态显示 disconnected
       Rooms 显示 offline mode
       exit code = 0（status 本身成功）
```

### TC-3-CLI-042: ezagent start 启动 HTTP Server

```
GIVEN  E-alice 已初始化

WHEN   执行 ezagent start --port 9000

THEN   HTTP Server 启动在 localhost:9000
       stdout 输出 "Server running at http://localhost:9000"
       GET http://localhost:9000/api/status 返回 200
       GET http://localhost:9000/ 返回 Chat UI HTML
```

### TC-3-CLI-043: ezagent start --no-ui

```
GIVEN  E-alice 已初始化

WHEN   执行 ezagent start --no-ui

THEN   HTTP Server 启动
       GET /api/status 返回 200
       GET / 返回 404（Chat UI 未 serve）
```

---

## §5 CLI — 配置优先级与退出码

> **Spec 引用**：cli-spec §4

### TC-3-CLI-050: 环境变量覆盖配置文件

```
GIVEN  config.toml 中 listen_port = 7447

WHEN   执行 EZAGENT_LISTEN_PORT=7448 ezagent status

THEN   Zenoh peer 使用端口 7448（环境变量优先于配置文件）
```

### TC-3-CLI-051: 命令行参数覆盖环境变量

```
GIVEN  EZAGENT_PORT=8000

WHEN   执行 EZAGENT_PORT=8000 ezagent start --port 9000

THEN   Server 启动在端口 9000（命令行参数 > 环境变量 > 配置文件）
```

### TC-3-CLI-052: 退出码 2 — 参数错误

```
WHEN   执行 ezagent send（缺少 room_id 参数）

THEN   stderr 输出用法提示
       exit code = 2
```

### TC-3-CLI-053: 退出码 3 — 连接失败

```
GIVEN  RELAY-A 不可达

WHEN   执行 ezagent init --relay unreachable.example.com --name alice

THEN   stderr 输出 "Connection failed: relay unreachable"
       exit code = 3
```

### TC-3-CLI-054: 退出码 4 — 认证失败

```
GIVEN  config.toml 中 keyfile 指向被篡改的密钥文件

WHEN   执行 ezagent rooms

THEN   stderr 输出 "Authentication failed: key mismatch"
       exit code = 4
```

---

## §6 HTTP — Bus API

> **Spec 引用**：http-spec §2

### TC-3-HTTP-001: GET /api/identity

```
GIVEN  Server 运行中，entity_id = "@alice:relay-a.example.com"

WHEN   GET /api/identity

THEN   200 OK
       { "entity_id": "@alice:relay-a.example.com",
         "relay": "relay-a.example.com",
         "pubkey_fingerprint": "<hex>" }
```

### TC-3-HTTP-002: GET /api/identity/{entity_id}/pubkey

```
GIVEN  E-bob 的公钥已注册

WHEN   GET /api/identity/@bob:relay-a.example.com/pubkey

THEN   200 OK
       { "entity_id": "@bob:relay-a.example.com", "pubkey": "<ed25519 hex>" }
```

### TC-3-HTTP-003: GET /api/identity/{entity_id}/pubkey 不存在

```
WHEN   GET /api/identity/@unknown:relay-a.example.com/pubkey

THEN   404 Not Found
       { "error": { "code": "ENTITY_NOT_FOUND" } }
```

### TC-3-HTTP-010: POST /api/rooms 创建

```
WHEN   POST /api/rooms  { "name": "new-room" }

THEN   201 Created
       { "room_id": "<UUIDv7>", "name": "new-room" }
       当前 Entity 自动成为成员
```

### TC-3-HTTP-011: GET /api/rooms 列表

```
GIVEN  E-alice 加入了 R-alpha, R-beta

WHEN   GET /api/rooms

THEN   200 OK
       返回 2 个 Room 的基本信息
```

### TC-3-HTTP-012: GET /api/rooms/{room_id} 详情

```
WHEN   GET /api/rooms/01957a3b-...001

THEN   200 OK
       包含 name, enabled_extensions, members, power_levels
```

### TC-3-HTTP-013: PATCH /api/rooms/{room_id} 更新

```
GIVEN  E-alice 是 R-alpha 的 admin

WHEN   PATCH /api/rooms/01957a3b-...001  { "name": "Alpha Team v2" }

THEN   200 OK，Room name 更新，CRDT 同步
```

### TC-3-HTTP-014: POST invite + GET members

```
WHEN   POST /api/rooms/01957a3b-...001/invite  { "entity_id": "@carol:relay-b..." }

THEN   200 OK

WHEN   GET /api/rooms/01957a3b-...001/members

THEN   200 OK，返回包含 E-carol 的成员列表
```

### TC-3-HTTP-015: POST join + POST leave

```
WHEN   POST /api/rooms/01957a3b-...001/join (as E-carol)
THEN   200 OK

WHEN   POST /api/rooms/01957a3b-...001/leave (as E-carol)
THEN   200 OK，E-carol 不再是成员
```

### TC-3-HTTP-020: POST /api/rooms/{room_id}/messages 发送

```
WHEN   POST /api/rooms/01957a3b-...001/messages
       { "body": "Hello!", "format": "text/plain" }

THEN   201 Created
       { "ref_id": "<ULID>", "author": "@alice:..." }
       消息经过完整 Hook Pipeline，CRDT 同步
```

### TC-3-HTTP-021: GET /api/rooms/{room_id}/messages 分页

```
GIVEN  R-alpha 包含 M-001 到 M-004

WHEN   GET /api/rooms/01957a3b-...001/messages?limit=2

THEN   200 OK，返回最近 2 条 + next_cursor

WHEN   GET /api/rooms/01957a3b-...001/messages?limit=2&before=<cursor>

THEN   200 OK，返回前 2 条
```

### TC-3-HTTP-022: GET /api/rooms/{room_id}/messages/{ref_id} 单条

```
WHEN   GET /api/rooms/01957a3b-...001/messages/<M-001>

THEN   200 OK，含 ref_id, author, body, annotations, ext
```

### TC-3-HTTP-023: DELETE 消息

```
WHEN   DELETE /api/rooms/.../messages/<M-001> (as author)
THEN   200 OK，ref.tombstone = true

WHEN   DELETE /api/rooms/.../messages/<M-001> (as non-author non-admin)
THEN   403 Forbidden
```

### TC-3-HTTP-024: 非成员访问 403

```
WHEN   GET /api/rooms/01957a3b-...001/messages (as E-outsider)

THEN   403 Forbidden  { "error": { "code": "NOT_A_MEMBER" } }
```

---

## §7 HTTP — Annotation API

> **Spec 引用**：http-spec §2.4

### TC-3-HTTP-030: POST Annotation

```
WHEN   POST /api/rooms/.../messages/<M-001>/annotations
       { "type": "review_status", "value": { "status": "approved" } }

THEN   201 Created
       key = "review_status:@alice:relay-a.example.com"
```

### TC-3-HTTP-031: GET Annotation 列表

```
WHEN   GET /api/rooms/.../messages/<M-001>/annotations

THEN   200 OK
       返回该 ref 上所有 Annotation（含 key 和 value）
```

### TC-3-HTTP-032: DELETE Annotation 权限

```
GIVEN  Annotation "review_status:@alice:..." 存在

WHEN   DELETE .../annotations/review_status:@alice:... (as E-alice)
THEN   200 OK

WHEN   DELETE .../annotations/review_status:@alice:... (as E-bob)
THEN   403 Forbidden（只有 annotator 可删除自己的 Annotation）
```

---

## §8 HTTP — Extension API

> **Spec 引用**：http-spec §3

### TC-3-HTTP-040: EXT-01 编辑消息

```
WHEN   PUT /api/rooms/.../messages/<M-001>  { "body": "edited" }
THEN   200 OK，mutable version 递增
```

### TC-3-HTTP-041: EXT-01 编辑历史

```
WHEN   GET /api/rooms/.../messages/<M-001>/versions
THEN   200 OK，返回版本列表（含各版本 body + timestamp）
```

### TC-3-HTTP-042: EXT-03 Reaction 添加/移除

```
WHEN   POST .../messages/<M-001>/reactions  { "emoji": "👍" }
THEN   201 Created

WHEN   DELETE .../messages/<M-001>/reactions/👍
THEN   200 OK
```

### TC-3-HTTP-043: EXT-06 Channel 列表

```
WHEN   GET /api/channels
THEN   200 OK，返回所有 Channel（含跨 Room 聚合计数）
```

### TC-3-HTTP-044: EXT-06 Channel 聚合视图

```
WHEN   GET /api/channels/code-review/messages
THEN   200 OK，返回所有 #code-review 消息（跨 Room）
```

### TC-3-HTTP-045: EXT-07 Moderation

```
WHEN   POST /api/rooms/.../moderation  { "ref_id": "<M-002>", "action": "redact" }
THEN   200 OK，Moderation overlay 写入
```

### TC-3-HTTP-046: EXT-08 Read Receipts

```
WHEN   GET /api/rooms/.../receipts
THEN   200 OK，返回各成员的 last_read ref_id
```

### TC-3-HTTP-047: EXT-09 Presence + Typing

```
WHEN   GET /api/rooms/.../presence
THEN   200 OK，返回 online/offline 列表

WHEN   POST /api/rooms/.../typing
THEN   200 OK，其他成员收到 typing.start 事件
```

### TC-3-HTTP-048: EXT-10 Media 上传/下载

```
WHEN   POST /api/blobs  (binary body)
THEN   201 Created  { "blob_hash": "sha256_..." }

WHEN   GET /api/blobs/sha256_...
THEN   200 OK，返回原始二进制
```

### TC-3-HTTP-049: EXT-10 Media 列表

```
WHEN   GET /api/rooms/.../media
THEN   200 OK，返回该 Room 的所有 blob 元数据
```

### TC-3-HTTP-050: EXT-11 Thread 视图

```
WHEN   GET /api/rooms/.../messages?thread_root=<M-007>
THEN   200 OK，返回 root + 所有 thread reply
```

### TC-3-HTTP-051: EXT-12 Drafts（私有）

```
WHEN   GET /api/rooms/.../drafts (as E-alice)
THEN   200 OK，返回 E-alice 的草稿

WHEN   GET /api/rooms/.../drafts (as E-bob)
THEN   200 OK，返回 E-bob 的草稿（看不到 E-alice 的）
```

### TC-3-HTTP-052: EXT-13 Profile GET/PUT

```
WHEN   GET /api/identity/@alice:.../profile
THEN   200 OK

WHEN   PUT /api/identity/@alice:.../profile (as E-alice)  { "display_name": "Alice Chen" }
THEN   200 OK

WHEN   PUT /api/identity/@alice:.../profile (as E-bob)
THEN   403 Forbidden
```

### TC-3-HTTP-053: EXT-14 Watch CRUD

```
WHEN   POST /api/watches  { "ref_id": "<M-001>", "on_reply": true }
THEN   201 Created

WHEN   GET /api/watches
THEN   200 OK，返回当前 Entity 的 watch 列表

WHEN   DELETE /api/watches/<key>
THEN   200 OK
```

### TC-3-HTTP-054: EXT-05 Cross-Room Preview

```
WHEN   GET /api/rooms/.../messages/<M-001>/preview
THEN   200 OK，返回跨 Room 引用的预览（source_room, preview body snippet）
```

### TC-3-HTTP-055: EXT-02 Collab ACL

```
WHEN   GET /api/rooms/.../content/<uuid_col-001>/acl
THEN   200 OK，返回 ACL 列表

WHEN   PUT /api/rooms/.../content/<uuid_col-001>/acl  { "writers": ["@bob:..."] }
THEN   200 OK
```

---

## §9 HTTP — Render Pipeline API

> **Spec 引用**：http-spec §4

### TC-3-HTTP-060: GET /api/renderers 全局

```
WHEN   GET /api/renderers

THEN   200 OK
       返回 content_renderers, decorators, room_tabs, flow_renderers 四类声明
```

### TC-3-HTTP-061: GET /api/rooms/{room_id}/renderers

```
GIVEN  R-empty 的 enabled_extensions = []

WHEN   GET /api/rooms/01957a3b-...004/renderers

THEN   200 OK，仅返回 Built-in renderer
```

### TC-3-HTTP-062: GET /api/rooms/{room_id}/views

```
WHEN   GET /api/rooms/01957a3b-...001/views

THEN   200 OK
       返回 tab 列表：timeline (default) + Extension 提供的 tab
```

---

## §10 WebSocket Event Stream

> **Spec 引用**：http-spec §5

### TC-3-WS-001: 全局事件订阅

```
GIVEN  E-alice 建立 ws://localhost:8000/ws

WHEN   E-bob 在 R-alpha 发送消息
       E-carol 在 R-beta 发送消息

THEN   E-alice 收到两条 message.new 事件
```

### TC-3-WS-002: Room 过滤订阅

```
GIVEN  E-alice 建立 ws://localhost:8000/ws?room=01957a3b-...001

WHEN   E-bob 在 R-alpha 发送消息（匹配）
       E-carol 在 R-beta 发送消息（不匹配）

THEN   E-alice 只收到 R-alpha 的事件
```

### TC-3-WS-003: Bus Events 类型覆盖

```
GIVEN  E-alice 订阅全局 WebSocket

WHEN   依次触发：
       room.created → room.member_joined → message.new →
       message.deleted → room.config_updated → room.member_left

THEN   E-alice 依次收到 6 种 Bus Event，type 字段正确
```

### TC-3-WS-004: Extension Events

```
GIVEN  E-alice 订阅 R-alpha

WHEN   依次触发：
       message.edited (EXT-01) → reaction.added (EXT-03) →
       reaction.removed (EXT-03) → typing.start (EXT-09) → typing.stop (EXT-09)

THEN   E-alice 依次收到对应 Extension Event
```

### TC-3-WS-005: Watch Events

```
GIVEN  E-code-reviewer 对 M-001 设了 Watch (on_reply=true, on_edit=true)

WHEN   E-alice 回复 M-001
       E-bob 编辑 M-001

THEN   E-code-reviewer 收到 watch.ref_reply_added 和 watch.ref_content_edited
```

### TC-3-WS-006: 断线恢复

```
GIVEN  E-alice WebSocket 断开

WHEN   断开期间 E-bob 发送 3 条消息
       E-alice 重新连接

THEN   重连后 E-alice 通过 HTTP API 可获取断线期间的消息
       WebSocket 恢复后接收新事件
```

---

## §11 HTTP — 错误处理

> **Spec 引用**：http-spec §6

### TC-3-HTTP-070: 400 参数错误

```
WHEN   POST /api/rooms  {} (缺少 name)
THEN   400 Bad Request  { "error": { "code": "INVALID_PARAMS" } }
```

### TC-3-HTTP-071: 401 未认证

```
WHEN   GET /api/rooms（无认证）
THEN   401 Unauthorized
```

### TC-3-HTTP-072: 404 不存在

```
WHEN   GET /api/rooms/00000000-0000-0000-0000-000000000000
THEN   404 Not Found  { "error": { "code": "ROOM_NOT_FOUND" } }
```

### TC-3-HTTP-073: 409 冲突

```
WHEN   再次注册同一 entity_id
THEN   409 Conflict  { "error": { "code": "ENTITY_EXISTS" } }
```

### TC-3-HTTP-074: GET /api/status

```
WHEN   GET /api/status
THEN   200 OK  { "entity_id": "...", "status": "connected", "rooms": 2 }
```

---

---

## §12 URI 导航（EEP-0001）

### TC-3-CLI-URI-001: ezagent open 解析 Room URI

```
GIVEN  本地存在 R-alpha 数据

WHEN   ezagent open ezagent://relay.test/r/{R-alpha-id}

THEN   输出 Room 信息（名称、成员列表、最新消息摘要）
       退出码 0
```

### TC-3-CLI-URI-002: ezagent open 解析 Message URI

```
GIVEN  本地存在 R-alpha 中 M-001 数据

WHEN   ezagent open ezagent://relay.test/r/{R-alpha-id}/m/{M-001-ref-id}

THEN   输出该消息内容（author、body、timestamp）及上下文
       退出码 0
```

### TC-3-CLI-URI-003: ezagent open 无效 URI

```
WHEN   ezagent open "not-a-uri"

THEN   输出 INVALID_URI 错误
       退出码 2
```

### TC-3-CLI-URI-004: ezagent open 资源不存在

```
WHEN   ezagent open ezagent://relay.test/r/nonexistent-room-id

THEN   输出 RESOURCE_NOT_FOUND 错误
       退出码 3
```

### TC-3-CLI-URI-005: ezagent open 规范化

```
WHEN   ezagent open "ezagent://Relay.Test/r/{R-alpha-id}/"

THEN   authority 规范化为 relay.test（小写）
       尾部斜杠去除
       正常输出 Room 信息
       退出码 0
```

## 附录：Test Case 统计

| 区域 | 编号范围 | 数量 |
|------|---------|------|
| CLI — Identity | TC-3-CLI-001~005 | 5 |
| CLI — Room | TC-3-CLI-010~016 | 7 |
| CLI — Message | TC-3-CLI-020~024 | 5 |
| CLI — Events/System | TC-3-CLI-030~043 | 7 |
| CLI — Config/Exit | TC-3-CLI-050~054 | 5 |
| CLI — URI Navigation | TC-3-CLI-URI-001~005 | 5 |
| HTTP — Bus API | TC-3-HTTP-001~024 | 15 |
| HTTP — Annotation | TC-3-HTTP-030~032 | 3 |
| HTTP — Extension | TC-3-HTTP-040~055 | 16 |
| HTTP — Render API | TC-3-HTTP-060~062 | 3 |
| WebSocket | TC-3-WS-001~006 | 6 |
| HTTP — Error/Status | TC-3-HTTP-070~074 | 5 |
| **合计** | | **82** |

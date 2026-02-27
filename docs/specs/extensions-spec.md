# ezagent.extensions — Extensions Specification

> **ezagent** — Easy Agent Communication Protocol
>
> Extension Datatypes: EXT-01 through EXT-17

> **状态**：Draft
> **日期**：2026-02-27（rev.3：Extension 动态加载模型）
> **版本**：0.9.4（§1.2 重构为动态加载 + Room 级激活两层模型）
> **前置文档**：ezagent-bus-spec-v0.9.4.md, ezagent-chat-ui-spec-v0.1.1.md

---

## 目录

```
§1  Overview
    §1.1  文档范围
    §1.2  Extension 加载规则
    §1.3  合规性层级
    §1.4  依赖图
§2  EXT-01: Mutable Content
§3  EXT-02: Collaborative Content
§4  EXT-03: Reactions
§5  EXT-04: Reply To
§6  EXT-05: Cross-Room References
§7  EXT-06: Channels
§8  EXT-07: Moderation
§9  EXT-08: Read Receipts
§10 EXT-09: Presence & Awareness
§11 EXT-10: Media / Blobs
§12 EXT-11: Threads
§13 EXT-12: User Drafts
§14 EXT-13: Entity Profile
§15 EXT-14: Watch
§16 EXT-15: Command
§17 EXT-16: Link Preview
§18 EXT-17: Runtime
§19 Extension Interaction Rules
附录 F: Extension SSE Events 汇总
附录 G: Extension API Endpoints 汇总
附录 H: content_type / status 注册表汇总
```

---

## §1 Overview

### §1.1 文档范围

本文档定义 ezagent 协议的 17 个 Extension Datatypes。每个 Extension 使用 Bus Spec §3.5 定义的统一声明格式（datatypes + hooks + annotations + indexes）。

所有 Extension 对 Bus Spec 有前置依赖。读者 MUST 先理解 Bus Spec 中的 Engine（§3）、Built-in Datatypes（§5）后再阅读本文档。

### §1.2 Extension 加载规则

#### §1.2.1 分发模型

所有 Extension（官方 17 个 + 第三方）编译为独立的动态链接库（`.so` / `.dylib` / `.dll`），安装到 `~/.ezagent/extensions/{ext_name}/`。Engine 启动时通过 `dlopen` 加载。详见 bus-spec §4.7 Extension Loader。

```
~/.ezagent/extensions/
├── reactions/
│   ├── manifest.toml       # 声明 datatypes, hooks, dependencies, api_version
│   └── libreactions.so     # 编译产物
├── moderation/
│   ├── manifest.toml
│   └── libmoderation.so
└── ...
```

`pip install ezagent` 首次安装时，官方 Extension 的预编译产物自动部署到此目录。第三方 Extension 通过 `ezagent ext install {name}` 安装。

#### §1.2.2 Room 级激活

- [MUST] Extension 仅在 Room Config 的 `enabled_extensions` 列表中出现时激活。
- [MUST] 激活 Extension 时，Engine MUST 先验证该 Extension 的 `dependencies` 是否已满足。未满足则 MUST 拒绝激活。
- [MUST] Extension 的 Hook 仅在该 Extension 激活时执行。
- [MUST] Extension 被禁用后，其 Hook 停止执行，但已写入的数据（`ext.*` 字段、独立 Doc）MUST NOT 被删除。
- [MUST] 不支持某 Extension 的 Peer MUST 保留该 Extension 写入的 `ext.*` 字段。

### §1.3 合规性层级

| 层级 | 包含的 Extensions |
|------|------------------|
| **Level 0: Core** | 无（仅 Built-in） |
| **Level 1: Standard** | EXT-01 Mutable, EXT-03 Reactions, EXT-04 Reply To, EXT-08 Read Receipts, EXT-09 Presence, EXT-10 Media, EXT-16 Link Preview |
| **Level 2: Advanced** | Level 1 + EXT-02 Collab, EXT-05 Cross-Room Ref, EXT-06 Channels, EXT-07 Moderation, EXT-13 Profile, EXT-14 Watch, EXT-15 Command |
| **Level 3: Socialware-Ready** | Level 2 + EXT-17 Runtime |
| **Level 3: Full** | Level 2 + EXT-11 Threads, EXT-12 Drafts |

### §1.4 依赖图

```
Built-in (always)
  Identity → Room → Timeline → Message
                                  │
                          ┌───────┴───────┐
                          ▼               │
                     EXT-01 Mutable       │
                          │               │
                          ▼               │
                     EXT-02 Collab        │
                                          │
              ┌───────────────────────────┘
              │
              ▼
         EXT-04 Reply To
              │
         ┌────┴────┐
         ▼         ▼
    EXT-05       EXT-11
    Cross-Room   Threads
         
    EXT-14 Watch ── depends → Timeline, Reply To

独立 (仅依赖 Built-in):
    EXT-03 Reactions   ─ depends → Timeline
    EXT-06 Channels    ─ depends → Timeline, Room
    EXT-07 Moderation  ─ depends → Timeline, Room
    EXT-08 Receipts    ─ depends → Timeline, Room
    EXT-09 Presence    ─ depends → Room
    EXT-10 Media       ─ depends → Message
    EXT-12 Drafts      ─ depends → Room
    EXT-13 Profile     ─ depends → Identity
    EXT-15 Command     ─ depends → Timeline, Room
    EXT-16 Link Preview─ depends → Message
    EXT-17 Runtime     ─ depends → Channels, Reply To, Command
```

### §1.5 API 写入模式

Extension 的数据写入分为两种模式：

**模式 A: REST API 写入** — 客户端通过 REST 端点发起写操作，Peer 内部执行 Engine Hook Pipeline 后将 CRDT update 同步到 Backend。适用于需要服务端验证或转换的操作。

**模式 B: 直接 CRDT 写入** — 客户端直接修改本地 CRDT 文档（通过 Engine API），产生的 update 自动同步。适用于私有数据或简单键值更新。

| Extension | 读 API | 写入模式 | 写 API |
|-----------|--------|---------|--------|
| EXT-01 Mutable | `GET .../versions` | A | `PUT .../messages/{ref_id}` |
| EXT-02 Collab | `GET .../acl` | A | `PUT .../acl`, `WS .../collab` |
| EXT-03 Reactions | via ref | A | `POST .../reactions`, `DELETE .../reactions/{emoji}` |
| EXT-04 Reply To | via ref | A（send_message 时设置） | `POST .../messages`（含 reply_to 参数） |
| EXT-05 Cross-Room | `GET .../preview` | A | `POST .../messages`（含 cross_room_ref 参数） |
| EXT-06 Channels | `GET /channels` | A | `POST .../messages`（含 channels 参数） |
| EXT-07 Moderation | via ref overlay | A | `POST .../moderation` |
| EXT-08 Read Receipts | `GET .../receipts` | B | 直接 CRDT 写入 |
| EXT-09 Presence | `GET .../presence` | B | 直接 CRDT 写入（ephemeral） |
| EXT-10 Media | `GET .../media` | A | `POST /blobs`, `POST .../messages` |
| EXT-11 Threads | `GET ...?thread_root=` | A | `POST .../messages`（含 thread 参数） |
| EXT-12 Drafts | `GET .../drafts` | B | 直接 CRDT 写入（私有 doc） |
| EXT-13 Profile | `GET .../profile` | A | `PUT /identity/{entity_id}/profile` |
| EXT-14 Watch | `GET /watches` | A | `POST /watches`, `DELETE /watches/{watch_key}` |
| EXT-15 Command | `GET /commands` | A | `POST .../messages`（含 command 参数），`POST /commands/{invoke_id}/result` |

- [MUST] 模式 A 的写 API 端点 MUST 在 Peer 内部触发完整的 Hook Pipeline。
- [MUST] 模式 B 的 CRDT 写入仍然 MUST 经过 Engine 的 pre_send hooks（如签名），但不需要 REST 端点中介。
- [MUST] Extension 的 API 端点仅在该 Extension 被激活时可用。未激活时 MUST 返回 `404 Not Found` 或 `403 Extension Disabled`。

---

## §2 EXT-01: Mutable Content

### §2.1 概述

Mutable Content 允许消息作者在发送后编辑消息内容。编辑后的内容存储为独立的 CRDT 文档，原始 Ref 的 `status` 更新为 `"edited"`。

### §2.2 声明

```yaml
id: "mutable"
version: "0.1.0"
dependencies: ["message"]
```

### §2.3 Datatypes

**mutable_content**

| 字段 | 值 |
|------|---|
| id | `mutable_content` |
| storage_type | `crdt_map` |
| key_pattern | `ezagent/{room_id}/content/{content_id}/{state\|updates}` |
| persistent | `true` |
| writer_rule | `signer == content.author` |

Mutable Content Doc Schema：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `content_id` | `uuid:{UUIDv7}` | MUST | 文档标识 |
| `type` | string | MUST | `"mutable"` |
| `author` | Entity ID | MUST | 内容作者，与 Ref 的 `author` 一致 |
| `body` | crdt_text | MUST | 可编辑的消息正文 |
| `format` | enum | MUST | `text/plain` / `text/markdown` / `text/html` |
| `media_refs` | Array<string> | MAY | 附件引用列表 |

### §2.4 Hooks

**pre_send: mutable.validate_edit**

| 字段 | 值 |
|------|---|
| trigger.datatype | `mutable_content` |
| trigger.event | `update` |
| priority | `25` |

- [MUST] 验证 `signer == content.author`。非作者的编辑 MUST 被拒绝。

**after_write: mutable.status_update**

| 字段 | 值 |
|------|---|
| trigger.datatype | `mutable_content` |
| trigger.event | `update` |
| priority | `35` |

- [MUST] Content Doc 被编辑后，对应 Ref 的 `status` MUST 更新为 `"edited"`。
- [MUST] 生成 `message.edited` SSE 事件。

### §2.5 注册

- [MUST] 注册 `content_type: "mutable"` 到 Bus 的 content_type 注册表。
- [MUST] 注册 `status: "edited"` 到 Bus 的 status 注册表。
- [MUST] 定义升级路径：`immutable → mutable`。
  - 升级时，Immutable Content 的 body 被复制到新建的 Mutable Content Doc。
  - Ref 的 `content_type` 更新为 `"mutable"`，`content_id` 更新为新 Doc 的 ID。
  - 升级操作 MUST 由 Ref 的原始 author 执行。

### §2.6 Indexes

**version_history**

| 字段 | 值 |
|------|---|
| input | mutable_content 的编辑历史 |
| transform | `ref_id → [{body_snapshot, edited_at, editor}]` |
| refresh | `on_demand` |
| operation_id | `GET /rooms/{room_id}/messages/{ref_id}/versions` |

- [SHOULD] 实现 SHOULD 保留编辑历史快照以支持版本查看。
- [MAY] 实现 MAY 限制保留的历史版本数量。

### §2.7 规则汇总

- [MUST] 只有作者可以编辑 Mutable Content。
- [MUST] 编辑后 Ref status 变为 `"edited"`。
- [MUST NOT] Mutable → Immutable 的降级不允许。
- [MUST] Peer 不支持 EXT-01 时，遇到 `content_type: "mutable"` 的 Ref MUST 保留数据，SHOULD 显示 "此消息类型不支持" 占位符。

---

## §3 EXT-02: Collaborative Content

### §3.1 概述

Collaborative Content 允许多个 Entity 同时编辑同一个 Content Doc。它在 Mutable Content 基础上增加 ACL（Access Control List）控制谁可以编辑。

### §3.2 声明

```yaml
id: "collab"
version: "0.1.0"
dependencies: ["mutable", "room"]
```

### §3.3 Datatypes

**collab_acl**

| 字段 | 值 |
|------|---|
| id | `collab_acl` |
| storage_type | `crdt_map` |
| key_pattern | `ezagent/{room_id}/content/{content_id}/acl/{state\|updates}` |
| persistent | `true` |
| writer_rule | `signer == acl.owner` |

ACL Doc Schema：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `owner` | Entity ID | MUST | ACL 所有者（通常是原始消息作者） |
| `mode` | enum | MUST | `owner_only` / `explicit` / `room_members` |
| `editors` | Array<Entity ID> | MUST (when mode=explicit) | 显式编辑者列表 |
| `updated_at` | RFC 3339 | MUST | 最后修改时间 |

### §3.4 Hooks

**pre_send: collab.check_acl**

| 字段 | 值 |
|------|---|
| trigger.datatype | `mutable_content` |
| trigger.event | `update` |
| trigger.filter | `content_type == "collab"` |
| priority | `25` |

- [MUST] 根据 ACL mode 验证写入权限：
  - `owner_only`：`signer == owner`
  - `explicit`：`signer ∈ editors`
  - `room_members`：`signer ∈ room.members`
- [MUST] 不在权限范围内的写入 MUST 被拒绝。

### §3.5 注册

- [MUST] 注册 `content_type: "collab"` 到 content_type 注册表。
- [MUST] 定义升级路径：`mutable → collab`。
  - 升级时创建 ACL Doc，owner 为原 author，mode 初始为 `owner_only`。
  - Ref 的 `content_type` 更新为 `"collab"`。
  - [MUST] 升级操作由 Ref 的原始 author 执行。
- [MUST] ACL mode 升级路径：`owner_only → explicit → room_members`。降级不允许。

### §3.6 Indexes

**collaborator_list**

| 字段 | 值 |
|------|---|
| input | `collab_acl` |
| transform | `content_id → {owner, mode, editors}` |
| refresh | `on_change` |
| operation_id | `GET /rooms/{room_id}/content/{content_id}/acl` |

### §3.7 API

| 端点 | 说明 |
|------|------|
| `PUT /rooms/{room_id}/content/{content_id}/acl` | 修改 ACL（仅 owner） |
| `WS /rooms/{room_id}/content/{content_id}/collab` | 实时协作 WebSocket |

- [MUST] WebSocket 端点在连接时验证 signer 的 ACL 权限。
- [MUST] 权限变更（ACL 更新）MUST 立即对所有连接的协作者生效。

### §3.8 规则汇总

- [MUST] 只有 ACL owner 可以修改 ACL。
- [MUST] 类型升级路径：`immutable → mutable → collab`。降级不允许。
- [MUST] ACL mode 升级路径：`owner_only → explicit → room_members`。降级不允许。
- [MUST] Collab 编辑产生的 CRDT update MUST 经 Signed Envelope 签名。

---

## §4 EXT-03: Reactions

### §4.1 概述

Reactions 允许 Entity 在 Ref 上添加 emoji 反应。Reaction 数据作为 Ref 上的 Extension 字段存储。

### §4.2 声明

```yaml
id: "reactions"
version: "0.1.0"
dependencies: ["timeline"]
```

### §4.3 Datatypes

无独立 Datatype。Reactions 纯粹通过 Ref 上的 `ext.reactions` 字段实现。

### §4.4 Annotations

**ext.reactions on Ref**

| 字段 | 值 |
|------|---|
| 存储位置 | `ref.ext.reactions` (Y.Map) |
| key 格式 | `{emoji}:{entity_id}` |
| value | Unix milliseconds (i64) |
| signed | `false` — 不纳入 Ref 的 Bus 签名 |

- [MUST] 每个 entity 对同一 ref 的同一 emoji 只能有一个 reaction。
- [MUST] Reaction key 中的 `entity_id` MUST 等于 signer。

示例：

```yaml
ref.ext.reactions:
  "👍:@alice:relay-a.com": 1702001000000
  "🎉:@bob:relay-a.com": 1702001001000
  "👍:@bob:relay-a.com": 1702001002000
```

### §4.5 Hooks

**pre_send: reactions.inject**

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `update` |
| trigger.filter | `reaction operation` |
| priority | `30` |

- [MUST] 添加 reaction：`ref.ext.reactions.set("{emoji}:{entity_id}", timestamp)`
- [MUST] 撤销 reaction：`ref.ext.reactions.delete("{emoji}:{entity_id}")`
- [MUST] 验证 reaction key 中的 entity_id == signer。

**after_write: reactions.emit**

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `update` |
| trigger.filter | `ext.reactions changed` |
| priority | `40` |

- [MUST] 新增 reaction 时生成 `reaction.added` SSE 事件。
- [MUST] 移除 reaction 时生成 `reaction.removed` SSE 事件。

### §4.6 Indexes

**reaction_summary**

| 字段 | 值 |
|------|---|
| input | `ref.ext.reactions` |
| transform | `ref_id → {emoji → {count, entity_ids}}` |
| refresh | `on_change` |
| operation_id | null (内嵌在 message API 响应中) |

### §4.7 API

| 端点 | 说明 |
|------|------|
| `POST /rooms/{room_id}/messages/{ref_id}/reactions` | 添加 reaction。body: `{emoji}` |
| `DELETE /rooms/{room_id}/messages/{ref_id}/reactions/{emoji}` | 移除自己的 reaction |

### §4.8 规则汇总

- [MUST] 任何 Room member 可以添加/移除自己的 reaction。
- [MUST NOT] Entity 不可以移除他人的 reaction（Moderation 除外）。
- [MUST] Reaction 不影响 Ref 的 Bus 签名。

---

## §5 EXT-04: Reply To

### §5.1 概述

Reply To 允许 Ref 声明它是对另一条 Ref 的回复，在消息间建立引用关系。

### §5.2 声明

```yaml
id: "reply-to"
version: "0.1.0"
dependencies: ["timeline"]
```

### §5.3 Annotations

**ext.reply_to on Ref**

| 字段 | 值 |
|------|---|
| 存储位置 | `ref.ext.reply_to` (Y.Map) |
| signed | `true` — 纳入作者签名 |

Schema：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `ref_id` | ULID | MUST | 被回复的 Ref ID |

- [MUST] `ref_id` 指向的 Ref MUST 存在于当前 Room 的 Timeline 中（跨 Room 回复由 EXT-05 扩展）。
- [MUST] 回复关系一旦写入 MUST NOT 被修改（signed 字段，修改将破坏签名）。

### §5.4 Hooks

**pre_send: reply_to.inject**

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `insert` |
| trigger.filter | `has reply_to` |
| priority | `30` |

- [MUST] 在 Ref 中注入 `ext.reply_to = { ref_id }`。
- [SHOULD] 验证目标 ref_id 在当前 Room 中存在。如不存在，SHOULD 警告但 MAY 仍允许写入。

### §5.5 Indexes

**reply_chain**

| 字段 | 值 |
|------|---|
| input | Timeline refs where `ext.reply_to.ref_id == target` |
| transform | `ref_id → [replying refs]` |
| refresh | `on_demand` |
| operation_id | null (内嵌在 message API 响应中) |

### §5.6 规则汇总

- [MUST] Reply To 字段 signed = true，由消息作者签名。
- [MUST] 一条 Ref 最多有一个 reply_to 目标。

---

## §6 EXT-05: Cross-Room References

### §6.1 概述

Cross-Room References 扩展 Reply To，允许 Ref 引用另一个 Room 中的 Ref。

### §6.2 声明

```yaml
id: "cross-room-ref"
version: "0.1.0"
dependencies: ["reply-to", "room"]
```

### §6.3 Annotations

**ext.reply_to on Ref（扩展）**

Cross-Room Ref 扩展 EXT-04 的 `ext.reply_to` schema，增加可选字段：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `ref_id` | ULID | MUST | 被引用的 Ref ID |
| `room_id` | UUIDv7 | MAY | 目标 Ref 所在的 Room ID。省略表示同 Room |
| `window` | string | MAY | 目标 Ref 所在的 Timeline Window（如 `2026-02`），加速定位 |

- [MUST] `room_id` 存在时，表示跨 Room 引用。signed = true。

### §6.4 Hooks

**after_read: cross_room.resolve_preview**

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.filter | `ext.reply_to.room_id != null` |
| priority | `45` |

- [MUST] 如果当前 Entity 是目标 Room 的成员：加载被引用 Ref 的预览信息（author、body 摘要）。
- [MUST] 如果当前 Entity 不是目标 Room 的成员：MUST 返回占位符，MUST NOT 泄露目标 Room 的任何信息（ref 内容、作者、room 名称等）。

### §6.5 Indexes

**cross_room_preview**

| 字段 | 值 |
|------|---|
| input | target Room 的 timeline ref |
| transform | `ref_id → preview data (if member)` |
| refresh | `on_demand` |
| operation_id | `GET /rooms/{room_id}/messages/{ref_id}/preview` |

### §6.6 规则汇总

- [MUST] 跨 Room 引用 MUST NOT 泄露目标 Room 的内容给非成员。
- [MUST] 向前兼容：不支持 EXT-05 的 Peer 遇到含 `room_id` 的 reply_to 时，MUST 保留字段，MAY 忽略 room_id 只展示 ref_id。

---

## §7 EXT-06: Channels

### §7.1 概述

Channels 提供跨 Room 的消息分类标签机制。Channel 是 Ref 上的 tag，不是独立的数据结构。Channel 聚合视图由客户端在已加入 Room 的并集上构建。

### §7.2 声明

```yaml
id: "channels"
version: "0.1.0"
dependencies: ["timeline", "room"]
```

### §7.3 Annotations

**ext.channels on Ref**

| 字段 | 值 |
|------|---|
| 存储位置 | `ref.ext.channels` (Array<string>) |
| signed | `true` |

- [MUST] 值为 channel tag 的字符串数组。
- [MUST] Channel tag 格式：`[a-z0-9-]{1,64}`，小写字母、数字、连字符，长度 1-64。
- [SHOULD] 一条 Ref 的 channel tag 数量不超过 5 个。

**ext.channels.hints on Room Config**

| 字段 | 值 |
|------|---|
| 存储位置 | Room Config `ext.channels.hints` (Array) |

Schema：

```yaml
ext.channels.hints:
  - id: "code-review"
    name: "Code Review"
    created_by: "@alice:..."
```

- [MAY] hints 是可选的人类可读元信息，不影响 channel 的技术行为。

### §7.4 Channel 生命周期

- [MUST] Channel 隐式创建：当第一条 Ref 携带该 channel tag 时，channel 开始存在。
- [MUST] Channel 自然消亡：没有约定的删除操作。客户端 MAY 隐藏不活跃的 channel。
- [MUST] 全局扁平命名空间：同名 channel tag 在所有 Room 中视为同一个 channel。

### §7.5 Hooks

**pre_send: channels.inject_tags**

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `insert` |
| trigger.filter | `has channels` |
| priority | `30` |

- [MUST] 注入 `ext.channels = ["tag1", "tag2"]`。

**after_write: channels.update_activity**

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `insert` |
| trigger.filter | `ext.channels present` |
| priority | `50` |

- [SHOULD] 更新 channel activity 索引。
- [MUST] 生成 `channel.activity` SSE 事件。

**after_read: channels.aggregate**

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| priority | `50` |

- [MUST] Channel 聚合视图构建规则：
  1. 遍历当前 Entity 已加入的所有 Room 的 Timeline。
  2. 过滤 Ref，保留 `ext.channels` 包含目标 tag 的 Ref。
  3. 按 `created_at` 归并排序。
- [MUST] 聚合范围严格限定在已加入 Room 的并集。MUST NOT 包含未加入 Room 的 Ref。

### §7.6 Indexes

**channel_aggregation**

| 字段 | 值 |
|------|---|
| input | 所有已加入 Room 的 timeline refs |
| transform | 按 channel tag 过滤 → 跨 Room 按 created_at 归并排序 |
| refresh | `on_demand` |
| operation_id | `GET /channels/{channel_id}/messages` |

**channel_list**

| 字段 | 值 |
|------|---|
| input | 所有已加入 Room 的 known channel tags |
| transform | `tag → {room_count, last_activity}` |
| refresh | `on_change` |
| operation_id | `GET /channels` |

### §7.7 规则汇总

- [MUST] Channel 是 tag，不是数据结构。没有 "Channel 配置文档"。
- [MUST] Relay 无需感知 channel。所有聚合逻辑在 Peer 端完成。
- [MUST] Channel tag 格式：`[a-z0-9-]{1,64}`。

---

## §8 EXT-07: Moderation

### §8.1 概述

Moderation 提供内容审核能力：redact（隐藏消息）、pin（置顶）、ban（封禁用户）。审核操作存储在独立的 Overlay Doc 中，不修改原始 Timeline 数据。

### §8.2 声明

```yaml
id: "moderation"
version: "0.1.0"
dependencies: ["timeline", "room"]
```

### §8.3 Datatypes

**moderation_overlay**

| 字段 | 值 |
|------|---|
| id | `moderation_overlay` |
| storage_type | `crdt_array` |
| key_pattern | `ezagent/{room_id}/ext/moderation/{state\|updates}` |
| persistent | `true` |
| writer_rule | `signer.power_level >= power_levels.ext.moderation` |

Overlay Entry Schema：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `action_id` | ULID | MUST | 操作唯一 ID |
| `action` | enum | MUST | `redact` / `pin` / `unpin` / `ban_user` / `unban_user` |
| `target_ref` | ULID | when action=redact/pin/unpin | 目标 Ref ID |
| `target_user` | Entity ID | when action=ban_user/unban_user | 目标 Entity |
| `by` | Entity ID | MUST | 执行者 |
| `reason` | string | SHOULD | 操作理由 |
| `timestamp` | RFC 3339 | MUST | 操作时间 |
| `signature` | string | MUST | 执行者签名 |

### §8.4 Hooks

**after_write: moderation.emit_action**

| 字段 | 值 |
|------|---|
| trigger.datatype | `moderation_overlay` |
| trigger.event | `insert` |
| priority | `40` |

- [MUST] 生成 `moderation.action` SSE 事件。

**after_read: moderation.merge_overlay**

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| priority | `60` |

- [MUST] 渲染 Timeline 时，将 Overlay 操作合并到 Ref 的展示状态：
  - `redact` 操作的目标 Ref：
    - power_level < moderation_level 的 Entity 看到占位符（如 "消息已被管理员隐藏"）
    - power_level >= moderation_level 的 Entity 看到原文 + 标记
  - `pin` 操作的目标 Ref：标记为置顶
  - `ban_user` 操作的目标 Entity 的后续 Ref：标记为来自被封禁用户
- [MUST] 冲突解决：同一目标的多个操作，以 Overlay 中更晚的为准（crdt_array 顺序）。

### §8.5 权限配置

- [MUST] 审核权限通过 Room Config 的 `ext.moderation.power_level` 配置（默认值：50）。
- [MUST] 执行审核操作的 Entity 的 power_level MUST >= `ext.moderation.power_level`。

### §8.6 Indexes

**moderation_actions**（内部 index）

| 字段 | 值 |
|------|---|
| input | `moderation_overlay` |
| transform | `target_ref → [actions]` 和 `target_user → [actions]` |
| refresh | `on_change` |
| operation_id | null (合并到 timeline_view) |

### §8.7 API

| 端点 | 说明 |
|------|------|
| `POST /rooms/{room_id}/moderation` | 创建审核操作 |

### §8.8 规则汇总

- [MUST] 审核操作不修改原始 Ref。Overlay 是独立文档。
- [MUST] 原始数据永远可审计。
- [MUST] 不同权限的用户看到不同的视图。
- [MUST NOT] 审核操作不可撤销。要撤销 redact，MUST 创建新的 unpin/unban 操作覆盖。

---

## §9 EXT-08: Read Receipts

### §9.1 概述

Read Receipts 跟踪每个 Entity 在每个 Room 中的阅读进度。

### §9.2 声明

```yaml
id: "read-receipts"
version: "0.1.0"
dependencies: ["timeline", "room"]
```

### §9.3 Datatypes

**read_receipts**

| 字段 | 值 |
|------|---|
| id | `read_receipts` |
| storage_type | `crdt_map` |
| key_pattern | `ezagent/{room_id}/ext/read-receipts/{state\|updates}` |
| persistent | `true` |
| writer_rule | `crdt_map key == signer entity_id` |
| sync_strategy | `{ mode: batched, batch_ms: 5000 }` |

Schema：`Y.Map<Entity ID, Y.Map>`

每个 Entity 的阅读状态：

| 字段 | 类型 | 说明 |
|------|------|------|
| `last_read_ref` | ULID | 最后阅读的 Ref ID |
| `last_read_shard` | UUIDv7 | 最后阅读的 Timeline Shard |
| `updated_at` | RFC 3339 | 更新时间 |

- [MUST] 每个 Entity 只能写入以自己 Entity ID 为 key 的 entry。
- [MUST] 这种 key 分区机制确保零冲突：不同 Entity 写不同 key，永远不会并发冲突。

### §9.4 Hooks

**after_read: receipts.auto_mark**

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| priority | `70` |

- [SHOULD] 客户端读取消息时，自动更新 read position。
- [MAY] 实现 MAY 节流更新频率（如每 5 秒最多一次）以减少写入。

**after_write: receipts.update_unread**

| 字段 | 值 |
|------|---|
| trigger.datatype | `read_receipts` |
| trigger.event | `update` |
| priority | `50` |

- [SHOULD] 更新 unread count index。

### §9.5 Indexes

**unread_count**

| 字段 | 值 |
|------|---|
| input | `read_receipts + timeline_index` |
| transform | `room_id → unread_count` (自 last_read_ref 之后的 ref 数量) |
| refresh | `on_change` |
| operation_id | `GET /rooms/{room_id}/receipts` |

### §9.6 API

- [MUST] Read Receipt 的写入采用**模式 B（直接 CRDT 写入）**。客户端通过 Engine API 直接更新本地 Read Receipts Doc 中自己的 entry，update 自动同步。
- [MUST] 不需要专门的 write REST 端点。GET 端点由 Index 导出（见 §9.5）。

### §9.7 规则汇总

- [MUST] Entity 只能更新自己的 read position。
- [SHOULD] Read Receipt updates 使用低优先级 QoS（可丢弃、尽力传递）。

---

## §10 EXT-09: Presence & Awareness

### §10.1 概述

Presence 检测 Entity 的在线/离线状态。Awareness 提供实时活动信息（如正在输入）。两者都是临时数据，不持久化。

### §10.2 声明

```yaml
id: "presence"
version: "0.1.0"
dependencies: ["room"]
```

### §10.3 Datatypes

**presence_token**

| 字段 | 值 |
|------|---|
| id | `presence_token` |
| storage_type | `ephemeral` |
| key_pattern | `ezagent/{room_id}/ephemeral/presence/@{entity_id}` |
| persistent | `false` |
| writer_rule | `signer == entity_id in key` |

- [MUST] Presence token 的生命周期与 Entity 的网络连接绑定。连接断开时 token 自动消失。

**awareness_state**

| 字段 | 值 |
|------|---|
| id | `awareness_state` |
| storage_type | `ephemeral` |
| key_pattern | `ezagent/{room_id}/ephemeral/awareness/@{entity_id}` |
| persistent | `false` |
| writer_rule | `signer == entity_id in key` |

Awareness Payload：

| 字段 | 类型 | 说明 |
|------|------|------|
| `entity_id` | Entity ID | 所有者 |
| `typing` | boolean | 是否正在输入 |
| `active_window` | string / null | 当前活跃的 Timeline Window |
| `custom_status` | string / null | 自定义状态 |
| `last_active` | RFC 3339 | 最后活跃时间 |

### §10.4 Hooks

**after_write: presence.online_change**

| 字段 | 值 |
|------|---|
| trigger.datatype | `presence_token` |
| trigger.event | `any` |
| priority | `40` |

- [MUST] Token 出现时生成 `presence.joined` SSE 事件。
- [MUST] Token 消失时生成 `presence.left` SSE 事件。

**after_write: presence.typing_change**

| 字段 | 值 |
|------|---|
| trigger.datatype | `awareness_state` |
| trigger.event | `update` |
| trigger.filter | `typing changed` |
| priority | `40` |

- [SHOULD] 生成 `typing.start` / `typing.stop` SSE 事件。

### §10.5 Indexes

**online_users**

| 字段 | 值 |
|------|---|
| input | `presence_token for ezagent/{room_id}` |
| transform | `room_id → [online entity_ids]` |
| refresh | `on_change` |
| operation_id | `GET /rooms/{room_id}/presence` |

### §10.6 API

| 端点 | 说明 |
|------|------|
| `GET /rooms/{room_id}/presence` | 在线成员列表 |
| `POST /rooms/{room_id}/typing` | 声明正在输入 |

### §10.7 规则汇总

- [MUST] Presence 和 Awareness 数据不持久化。
- [MUST NOT] Presence/Awareness 数据不需要签名验证（ephemeral 类型豁免）。
- [SHOULD] typing 状态超时未更新（如 10 秒）后，客户端 SHOULD 自动视为停止输入。

### §10.8 P2P 模式行为

在 P2P 模式下，Presence token 基于 Zenoh liveliness 机制实现：

- [MUST] 每个 Peer 通过 Zenoh liveliness token 声明自身在线状态。Token 的 key 与 `key_pattern` 一致。
- [MUST] Liveliness token 的生命周期与 Zenoh session 绑定——session 断开时 token 自动消失，无需 Relay 参与。
- [SHOULD] P2P 模式下，Peer 通过 liveliness subscriber 直接感知其他 Peer 的上下线，延迟低于经 Relay 中转。
- [MAY] 当同时存在 P2P 直连和 Relay 连接时，Peer MAY 收到同一 Entity 的重复上下线通知。实现 SHOULD 去重。

---

## §11 EXT-10: Media / Blobs

### §11.1 概述

Media 支持发送文件、图片、音视频等二进制附件。Blob 内容全局去重存储，per-room 通过 Blob Ref 引用。

### §11.2 声明

```yaml
id: "media"
version: "0.2.0"
dependencies: ["message"]
```

### §11.3 Datatypes

**global_blob**

| 字段 | 值 |
|------|---|
| id | `global_blob` |
| storage_type | `blob` |
| key_pattern | `ezagent/blob/{blob_hash}` |
| persistent | `true` |
| writer_rule | `any authenticated entity` |
| sync_strategy | `{ mode: lazy }` |

**blob_ref**

| 字段 | 值 |
|------|---|
| id | `blob_ref` |
| storage_type | `crdt_map` |
| key_pattern | `ezagent/{room_id}/ext/media/blob-ref/{blob_hash}` |
| persistent | `true` |
| writer_rule | `signer ∈ room.members` |

Blob Ref Schema：

| 字段 | 类型 | 说明 |
|------|------|------|
| `blob_hash` | string | SHA-256 hash |
| `filename` | string | 原始文件名 |
| `mime_type` | string | MIME 类型 |
| `size_bytes` | integer | 文件大小 |
| `uploader` | Entity ID | 上传者 |
| `uploaded_at` | RFC 3339 | 上传时间 |
| `dimensions` | object | 图片/视频尺寸（MAY） |
| `duration_seconds` | number | 音视频时长（MAY） |

### §11.4 注册

- [MUST] 注册 `content_type: "blob"` 到 content_type 注册表。
- [MUST] blob 类型的 Ref 的 `content_id` 为 blob 的 SHA-256 hash。

### §11.5 Blob 元信息

Blob 的元信息存储在 per-room Blob Ref 中（`ext.media` 命名空间）：

```yaml
ref.ext.media:
  blob_hash: "sha256:..."
  filename: "report.pdf"
  mime_type: "application/pdf"
  size_bytes: 1048576
  dimensions:                    # 图片/视频特有
    width: 1920
    height: 1080
  duration_seconds: null         # 音视频特有
```

### §11.6 Hooks

**pre_send: media.upload**

| 字段 | 值 |
|------|---|
| trigger.datatype | `global_blob` |
| trigger.event | `insert` |
| priority | `20` |

- [MUST] 计算 SHA-256 hash。
- [MUST] 查询全局 Blob Store：已存在时跳过内容上传（秒传），仅创建 per-room Blob Ref。
- [MUST] 不存在时写入全局 Blob，然后创建 per-room Blob Ref。
- [MUST] Relay 维护全局 Blob 的引用计数（详见 relay-spec §4.3）。

### §11.7 Indexes

**media_gallery**

| 字段 | 值 |
|------|---|
| input | `ezagent/{room_id}/ext/media/blob-ref/*` |
| transform | `room_id → [{ref_id, blob_hash, mime_type, filename}]` |
| refresh | `on_demand` |
| operation_id | `GET /rooms/{room_id}/media` |

### §11.8 API

| 端点 | 说明 |
|------|------|
| `POST /blobs` | 上传 blob，返回 blob_hash。Relay 自动去重 |
| `GET /blobs/{blob_hash}` | 下载 blob。Relay 验证请求者属于引用该 blob 的 Room |

### §11.9 规则汇总

- [MUST] Blob 写入后不可变。
- [MUST] 相同内容的 blob 全局去重（同一 hash 只存一份）。
- [MUST] Blob 读取需验证请求者至少属于一个引用该 blob 的 Room。
- [SHOULD] 实现 SHOULD 限制单个 blob 的大小（由 Relay quota 控制，推荐上限 50MB）。
- [MUST] Blob 的 `sync_strategy` 为 `lazy`——内容不主动推送，按需拉取。

---

## §12 EXT-11: Threads

### §12.1 概述

Threads 允许在一条消息下创建子对话流，将相关讨论从主 Timeline 中分离。

### §12.2 声明

```yaml
id: "threads"
version: "0.1.0"
dependencies: ["reply-to"]
```

### §12.3 Annotations

**ext.thread on Ref**

| 字段 | 值 |
|------|---|
| 存储位置 | `ref.ext.thread` (Y.Map) |
| signed | `true` |

Schema：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `root` | ULID | MUST | Thread 的根 Ref ID |

- [MUST] Thread 中所有回复的 `ext.thread.root` 指向同一个根 Ref。
- [MUST] Thread 根 Ref 本身不携带 `ext.thread` 字段。
- [SHOULD] Thread 内的 Ref 同时携带 `ext.reply_to`（指向 thread 内的上一条回复或 root）和 `ext.thread`（指向 root）。

### §12.4 Hooks

**pre_send: threads.inject**

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `insert` |
| trigger.filter | `has thread_root` |
| priority | `30` |

- [MUST] 注入 `ext.thread = { root: ulid }`。

**after_read: threads.filter**

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| priority | `50` |

- [MUST] Thread 视图：给定 root ref_id，返回所有 `ext.thread.root == root` 的 Ref，按 CRDT 顺序排列。
- [MAY] 主 Timeline 视图中，客户端 MAY 折叠 thread 回复，仅显示 root + 回复数量。

### §12.5 Indexes

**thread_view**

| 字段 | 值 |
|------|---|
| input | timeline refs where `ext.thread.root == target` |
| transform | `root_ref_id → [thread replies]` |
| refresh | `on_demand` |
| operation_id | `GET /rooms/{room_id}/messages?thread_root={ref_id}` |

### §12.6 规则汇总

- [MUST] Thread root 必须是已存在的 Ref。
- [MUST] Thread 回复存储在主 Timeline 中（不是独立的 Timeline），仅通过 `ext.thread` 标记区分。

---

## §13 EXT-12: User Drafts

### §13.1 概述

Drafts 支持跨设备同步未发送的消息草稿。每个 Entity 在每个 Room 中有一个私有的 Draft Doc。

### §13.2 声明

```yaml
id: "drafts"
version: "0.1.0"
dependencies: ["room"]
```

### §13.3 Datatypes

**user_draft**

| 字段 | 值 |
|------|---|
| id | `user_draft` |
| storage_type | `crdt_map` |
| key_pattern | `ezagent/{room_id}/ext/draft/{entity_id}/{state\|updates}` |
| persistent | `true` |
| writer_rule | `signer == entity_id in key_pattern` |
| sync_strategy | `{ mode: lazy }` |

Draft Doc Schema：

| 字段 | 类型 | 说明 |
|------|------|------|
| `body` | crdt_text | 草稿内容 |
| `reply_to` | ULID / null | 回复目标（如有） |
| `channels` | Array<string> / null | channel tags（如有） |
| `updated_at` | RFC 3339 | 最后修改时间 |

### §13.4 Hooks

**pre_send: drafts.clear_on_send**

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `insert` |
| priority | `90` |

- [SHOULD] 消息发送成功后，清除对应 Room 的 Draft Doc 内容。

### §13.5 API

| 端点 | 说明 |
|------|------|
| `GET /rooms/{room_id}/drafts` | 读取当前 Entity 在该 Room 的 Draft |

- [MUST] Draft 的写入采用**模式 B（直接 CRDT 写入）**。客户端通过 Engine API 直接修改本地 Draft Doc，update 自动同步到其他设备。
- [MUST] GET 端点仅返回请求者自己的 Draft。不可读取其他 Entity 的 Draft。

### §13.6 规则汇总

- [MUST] Draft Doc 是私有数据。每个 Entity 只能读写自己的 Draft。
- [MUST] Draft 通过 CRDT 同步实现跨设备一致性。
- [MUST NOT] Draft 内容不会出现在 Timeline 或任何公开 Index 中。

---

## §14 EXT-13: Entity Profile

### §14.1 概述

Entity Profile 提供 Entity 的自描述信息——能力、身份、联系方式等。Profile 内容为 YAML frontmatter + markdown body，协议不标准化 Profile 的语义解析方式。Relay owner 自行决定如何索引 Profile 以支持 Discovery。

### §14.2 声明

```yaml
id: "profile"
version: "0.1.0"
dependencies: ["identity"]
```

### §14.3 Datatypes

**entity_profile**

| 字段 | 值 |
|------|---|
| id | `entity_profile` |
| storage_type | `crdt_map` |
| key_pattern | `ezagent/@{entity_id}/ext/profile/{state\|updates}` |
| persistent | `true` |
| writer_rule | `signer == entity_id` |

Profile Doc Schema：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `frontmatter` | crdt_map | MUST | 结构化元信息 |
| `body` | crdt_text | MUST | Markdown 自由格式内容 |

**Frontmatter 必需字段**：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `entity_type` | enum | MUST | `human` / `agent` / `service` |
| `display_name` | string | MUST | 显示名称，1-128 字符 |

**Frontmatter 可选字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `avatar_hash` | sha256 | 头像 blob hash |
| 其他 | any | 实现自由扩展 |

- [MUST] `entity_type` 是唯一协议强制要求的语义字段。它决定 UI 渲染方式（人类头像 vs bot 图标 vs service 图标）。
- [MUST] `body` 为 markdown 格式。内容结构完全自由——Entity 可以描述能力、约束、联系方式、可用时间等。

**Profile 示例**：

```markdown
---
entity_type: agent
display_name: Code Review Agent
avatar_hash: sha256:a1b2c3...
---

## Capabilities

- **Code Review**: Rust, Python, TypeScript
- Security audit with OWASP top 10 focus

## Constraints

- Context window: 200k tokens
- Response time: 2-5 minutes

## Availability

Online 24/7, auto-accepts tasks tagged with `code-review`.
```

### §14.4 Hooks

**after_write: profile.index_update**

| 字段 | 值 |
|------|---|
| trigger.datatype | `entity_profile` |
| trigger.event | `any` |
| priority | `50` |

- [SHOULD] Profile 变化时，通知 Relay 侧索引更新。
- [MAY] 索引方式由 Relay owner 决定（全文搜索、embedding、LLM 提取等）。协议不标准化搜索算法。

### §14.5 Virtual User

在单 Relay 环境中引用外部 Relay 上的 Entity：

- [MAY] Room Config 的 `membership.members` 中可包含指向外部 Relay 的 Entity ID（如 `@agent:relay-b.example.com`）。
- [MAY] Relay admin 可在本地存储该外部 Entity 的 proxy profile，使其出现在本地 Discovery 结果中。
- [MUST] 对 Virtual User 的消息路由由 Relay 间的同步机制保证（§6.4 多 Relay 协同）。

### §14.6 Indexes

**profile_lookup**

| 字段 | 值 |
|------|---|
| input | `ezagent/@{entity_id}/ext/profile` |
| transform | `entity_id → profile content` |
| refresh | `on_change` |
| operation_id | `GET /identity/{entity_id}/profile` |

**discovery_search**

| 字段 | 值 |
|------|---|
| input | 本 Relay 上的所有 Profile |
| transform | `query → matching profiles`（Relay 实现定义） |
| refresh | `periodic` |
| operation_id | `POST /ext/discovery/search`（非标准化，Relay 自行定义） |

- [MUST] `profile_lookup` 端点 MUST 由支持 EXT-13 的 Peer 实现。
- [MAY] `discovery_search` 端点是 Relay 侧可选能力，协议不规定其请求/响应格式。

### §14.7 API

| 端点 | Method | 说明 |
|------|--------|------|
| `GET /identity/{entity_id}/profile` | GET | 读取 Profile |
| `PUT /identity/{entity_id}/profile` | PUT | 发布/更新 Profile |
| `POST /ext/discovery/search` | POST | Discovery 搜索（非标准化） |

- [MUST] PUT 端点仅允许 signer == entity_id（只能修改自己的 Profile）。
- [MUST] PUT body 包含 `frontmatter`（JSON）和 `body`（Markdown text）。

### §14.8 规则汇总

- [MUST] Entity 只能修改自己的 Profile。
- [MUST] `entity_type` 是唯一必需的结构化 frontmatter 字段。
- [MUST NOT] 协议不标准化 Discovery 搜索 API 的格式和语义。搜索由 Relay 实现。

### §14.9 发现模型：本地 vs Relay

Profile 的发现分为两个层次：

**本地发现（P2P / LAN）**：

- [SHOULD] 同 Room 的 Peer 在 LAN 内通过 multicast scouting 自动发现后，可直接通过 Zenoh queryable 获取对方的 Profile。
- [SHOULD] 本地发现无需经过 Relay，延迟更低。
- [MAY] 本地发现不提供跨 Room 的搜索能力——仅限于已知 entity_id 的 Profile 查询。

**Relay Discovery（跨组织）**：

- [MAY] Relay 侧的 Discovery 索引（Level 3 合规性）提供跨组织的 Agent/Entity 搜索能力。
- [MAY] Relay 可按 `entity_type`、`display_name`、`body` 内容等建立索引。
- [MUST] 跨组织发现仍需经过 Relay——它是跨网络边界的唯一桥梁。
- [SHOULD] 当 Peer 同时可通过 P2P 和 Relay 访问某 Entity 的 Profile 时，SHOULD 优先使用 P2P 直连获取（更新、更快）。

---

## §15 EXT-14: Watch

### §15.1 概述

Watch 让 Entity 声明"我正在关注某条 Ref 或某个 Channel"，并在关注目标发生变化时接收精准通知。Watch 通过 Annotation + after_write Hook 实现，不引入独立的数据结构。

### §15.2 声明

```yaml
id: "watch"
version: "0.1.0"
dependencies: ["timeline", "reply-to"]
```

### §15.3 Watch 类型

#### §15.3.1 Per-Ref Watch

Entity 在 Ref 上写入 watch annotation，声明关注该 Ref 的后续变化。

**Annotation 位置**：`ref.ext.watch.@{entity_id}`

Schema：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `reason` | string | MAY | 关注原因（如 `"processing_task"`） |
| `on_content_edit` | boolean | MUST | 是否在 content 被编辑时通知 |
| `on_reply` | boolean | MUST | 是否在有新 reply 时通知 |
| `on_thread` | boolean | MUST | 是否在有 thread 回复时通知 |
| `on_reaction` | boolean | MUST | 是否在 reaction 变化时通知 |

- [MUST] Annotation key 中的 entity_id 等于 signer（只能为自己设置 watch）。
- [MUST] Watch annotation 是公开的——其他 Room member 可以看到谁在关注此 Ref。

#### §15.3.2 Channel Watch

Entity 在 Room Config 上写入 channel watch annotation，声明关注特定 channel 的新消息。

**Annotation 位置**：`room_config.ext.watch.@{entity_id}`

Schema：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `channels` | Array<string> | MUST | 关注的 channel tag 列表 |
| `scope` | enum | MUST | `this_room`（仅当前 Room）/ `all_rooms`（所有已加入 Room） |

- [MUST] `scope: "all_rooms"` 时，Peer 端 MUST 在所有已加入 Room 中检查 channel watch 规则。

### §15.4 Hooks

**pre_send: watch.set_ref**

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `update` |
| trigger.filter | `ext.watch changed` |
| priority | `30` |

- [MUST] 验证 key 中的 entity_id == signer。

**pre_send: watch.set_channel**

| 字段 | 值 |
|------|---|
| trigger.datatype | `room_config` |
| trigger.event | `update` |
| trigger.filter | `ext.watch changed` |
| priority | `30` |

- [MUST] 验证 key 中的 entity_id == signer。

**after_write: watch.check_ref_watchers**

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `any` |
| priority | `45` |

通知触发规则：

| 条件 | SSE Event | 要求 |
|------|-----------|------|
| 新 Ref 的 `ext.reply_to.ref_id` 指向一个有 `ext.watch` 的 Ref，且 `on_reply == true` | `watch.ref_reply_added` | MUST |
| 新 Ref 的 `ext.thread.root` 指向一个有 `ext.watch` 的 Ref，且 `on_thread == true` | `watch.ref_thread_reply` | MUST |
| 被 watch 的 Ref 的 status 变为 `"edited"`，且 `on_content_edit == true` | `watch.ref_content_edited` | MUST |
| 被 watch 的 Ref 的 `ext.reactions` 变化，且 `on_reaction == true` | `watch.ref_reaction_changed` | SHOULD |

**after_write: watch.check_channel_watchers**

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `insert` |
| trigger.filter | `ext.channels present` |
| priority | `46` |

- [MUST] 新 tagged Ref 出现时，检查所有 Room 的 channel_watch annotations。
- [MUST] 匹配的 channel → 生成 `watch.channel_new_ref` SSE 事件。

### §15.5 SSE Events

| Event Type | Payload 字段 |
|------------|-------------|
| `watch.ref_content_edited` | `watcher, watched_ref, room_id, new_content_id` |
| `watch.ref_reply_added` | `watcher, watched_ref, room_id, new_ref_id` |
| `watch.ref_thread_reply` | `watcher, watched_ref, room_id, new_ref_id` |
| `watch.ref_reaction_changed` | `watcher, watched_ref, room_id, emoji, action` |
| `watch.channel_new_ref` | `watcher, channel, room_id, new_ref_id` |

### §15.6 Indexes

**my_watches**

| 字段 | 值 |
|------|---|
| input | 所有 Ref/Room Config 上 `ext.watch` 中含当前 Entity 的条目 |
| transform | `entity_id → [{type: "ref", target, room_id}, {type: "channel", channels, scope}]` |
| refresh | `on_change` |
| operation_id | `GET /watches` |

### §15.7 API

| 端点 | Method | 说明 |
|------|--------|------|
| `GET /watches` | GET | 当前 Entity 的所有 Watch 列表 |
| `POST /watches` | POST | 创建 Watch（Ref 级或 Channel 级） |
| `DELETE /watches/{watch_key}` | DELETE | 撤销 Watch |

POST body（Ref Watch）:
```json
{
  "type": "ref",
  "room_id": "...",
  "ref_id": "...",
  "on_content_edit": true,
  "on_reply": true,
  "on_thread": false,
  "on_reaction": false,
  "reason": "processing_task"
}
```

POST body（Channel Watch）:
```json
{
  "type": "channel",
  "room_id": "...",
  "channels": ["code-review"],
  "scope": "all_rooms"
}
```

- [MUST] POST 内部在对应的 Ref 的 `ext.watch` 或 Room Config 的 `ext.watch` 上写入 watch 数据。
- [MUST] DELETE 的 `watch_key` 格式为 `@{entity_id}`。只能删除自己的 Watch。

### §15.8 Agent 工作流

Watch 的典型 Agent 使用场景：

```
1. Agent 通过 Profile (EXT-13) 被发现并邀请进 Room
2. Agent 处理 message A
   → 在 message A 上设置 watch:
     ext.watch.@agent-1:relay-a.com = {
       on_content_edit: true,
       on_reply: true,
       on_thread: true,
       on_reaction: false,
       reason: "processing_task"
     }
3. Agent 发送 mutable message C (EXT-01) 作为初步输出
4. Author 编辑 message A
   → Agent 收到 watch.ref_content_edited
   → Agent 读取更新后的 A，修改 C
5. Author 发送 message B (reply_to A)
   → Agent 收到 watch.ref_reply_added
   → Agent 读取 B，结合 A 更新 C
6. 任务完成后 Agent 可删除 watch 数据
```

### §15.8 规则汇总

- [MUST] Watch 数据是公开数据（存储在 Ref 的 `ext.watch` 中）。
- [MUST] Entity 只能为自己设置和删除 watch。
- [MUST] Peer 不支持 EXT-14 时，`ext.watch` 字段被保留但不触发通知。
- [SHOULD] 实现 SHOULD 限制单个 Entity 的活跃 watch 数量（推荐上限 1000）。

---

## §16 EXT-15: Command

### §16.1 概述

Command 为 ezagent 提供结构化的**斜杠命令（Slash Command）**能力。任何 Socialware 可以声明自己提供的命令，用户或 Agent 通过发送带 `ext.command` 字段的 Message 触发命令执行。Command 是 Mid-layer 增强——它让 Message 具备"可执行"语义，而不依赖 Socialware 四原语。

**设计理由**：Command 属于 Extension 层而非 Socialware 层，因为：
- Command 增强 Message（添加"可执行"语义）→ Bottom/Mid-layer 职责
- 系统级命令（`/help`、`/settings`）无需 Socialware 即可存在
- 任何 Socialware 都可以通过 Command 暴露操作入口

### §16.2 声明

```yaml
id: "command"
version: "0.1.0"
dependencies: ["timeline", "room"]
```

### §16.3 DataType

#### §16.3.1 ext.command（signed，附加于 Ref）

当用户发送一条包含命令调用的 Message 时，`ext.command` 字段被注入到 Ref 中。

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `ns` | string | MUST | 命名空间，标识提供命令的 Socialware（如 `ta`、`af`、`rp`） |
| `action` | string | MUST | 命令动作（如 `claim`、`spawn`、`allocate`） |
| `params` | Map<string, any> | MAY | 命令参数，键值对 |
| `invoke_id` | string | MUST | 调用 ID（UUIDv7），用于关联结果 |

- [MUST] `ext.command` 是 signed 字段，纳入 Ref author 签名。
- [MUST] `invoke_id` 在全局唯一，由发送方生成。

示例 Ref：

```json
{
  "ref_id": "ulid:01HZ...",
  "author": "@alice:relay-a.example.com",
  "body": "/ta:claim task-42",
  "ext": {
    "command": {
      "ns": "ta",
      "action": "claim",
      "params": { "task_id": "task-42" },
      "invoke_id": "uuid:019..."
    }
  }
}
```

#### §16.3.2 ext.command.result（附加于原 Ref）

命令执行完成后，处理方（Socialware）将结果写入原 Ref 的 `ext.command` 命名空间。

**Annotation 位置**：`ref.ext.command.result.{invoke_id}`

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `invoke_id` | string | MUST | 对应的调用 ID |
| `status` | enum | MUST | `success` / `error` / `pending` |
| `result` | any | MAY | 命令返回值（JSON-compatible） |
| `error` | string | MAY | 当 status=error 时的错误描述 |
| `handler` | string | MUST | 处理方 Entity ID |

- [MUST] `command_result` 由命令处理方（Socialware Identity）写入 `ext.command` 命名空间。
- [MUST] `invoke_id` MUST 匹配原 Ref 中的 `ext.command.invoke_id`。

### §16.4 Annotation

#### §16.4.1 ext.command.manifest（on Socialware Identity Profile）

每个提供命令的 Socialware 在其 Profile（EXT-13）上发布命令清单，供客户端发现和自动补全。

**Annotation 位置**：`profile.ext.command.manifest.{sw_id}`

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `ns` | string | MUST | 命令命名空间 |
| `commands` | Array<CommandDef> | MUST | 命令定义列表 |

CommandDef：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `action` | string | MUST | 命令动作名 |
| `description` | string | MUST | 人类可读描述 |
| `params` | Array<ParamDef> | MAY | 参数定义 |
| `required_role` | string | MAY | 执行此命令所需的 Socialware Role |

ParamDef：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `name` | string | MUST | 参数名 |
| `type` | string | MUST | 参数类型（`string` / `number` / `boolean` / `entity_id`） |
| `required` | boolean | MUST | 是否必填 |
| `description` | string | MAY | 参数说明 |

示例：

```json
{
  "ns": "ta",
  "commands": [
    {
      "action": "claim",
      "description": "认领一个开放的任务",
      "params": [
        { "name": "task_id", "type": "string", "required": true, "description": "任务 ID" }
      ],
      "required_role": "ta:worker"
    },
    {
      "action": "post-task",
      "description": "发布新任务",
      "params": [
        { "name": "title", "type": "string", "required": true },
        { "name": "reward", "type": "number", "required": false }
      ],
      "required_role": "ta:publisher"
    }
  ]
}
```

### §16.5 命名空间规则

- [MUST] 命令的完整格式为 `/{ns}:{action}`（如 `/ta:claim`、`/af:spawn`、`/rp:allocate`）。
- [MAY] 当 Room 中仅有一个 Socialware 注册了某 `action` 时，客户端 MAY 允许省略 `ns:` 前缀（如 `/claim` 自动解析为 `/ta:claim`）。
- [MUST] 系统级命令使用 `sys` 命名空间（如 `/sys:help`、`/sys:settings`）。系统命令由 Engine 内置处理，不依赖任何 Socialware。
- [MUST] 命名空间冲突（两个 Socialware 注册同一 `ns`）MUST 在 Socialware 安装时检测并拒绝。

### §16.6 Hooks

**pre_send: command.validate**

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `insert` |
| trigger.filter | `ext.command present` |
| priority | `35` |

验证逻辑：

- [MUST] 验证 `ns` 对应已安装且已注册命令的 Socialware。未找到 → 拒绝，错误码 `COMMAND_NS_NOT_FOUND`。
- [MUST] 验证 `action` 存在于该 Socialware 的 command_manifest 中。未找到 → 拒绝，错误码 `COMMAND_ACTION_NOT_FOUND`。
- [MUST] 验证必填参数是否提供。缺失 → 拒绝，错误码 `COMMAND_PARAMS_INVALID`。
- [SHOULD] 验证 `required_role`：若命令定义了 required_role，检查 author 是否在当前 Socialware 中持有该 Role。不满足 → 拒绝，错误码 `PERMISSION_DENIED`。

**after_write: command.dispatch**

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `insert` |
| trigger.filter | `ext.command present` |
| priority | `42` |

- [MUST] 将命令事件派发给目标 Socialware 的 Hook 处理。
- [MUST] 生成 `command.invoked` SSE 事件。
- [SHOULD] 如果 Socialware 在合理时间内（默认 30s）未写入 `command_result`，生成 `command.timeout` SSE 事件。

**after_write: command.result_notify**

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `update` |
| trigger.filter | `annotation type == command_result` |
| priority | `43` |

- [MUST] 当 `command_result` annotation 写入时，生成 `command.result` SSE 事件通知调用方。

### §16.7 SSE Events

| Event Type | Payload 字段 |
|------------|-------------|
| `command.invoked` | `room_id, ref_id, invoke_id, ns, action, author` |
| `command.result` | `room_id, ref_id, invoke_id, status, result, handler` |
| `command.timeout` | `room_id, ref_id, invoke_id, ns, action` |

### §16.8 Indexes

**command_manifest_registry**

| 字段 | 值 |
|------|---|
| input | 所有 Socialware Identity Profile 上的 `command_manifest:*` annotations |
| transform | `ns → [{action, description, params, required_role}]` |
| refresh | `on_change` |
| operation_id | `command.list_available` |

**command_history**

| 字段 | 值 |
|------|---|
| input | 当前 Room 中含 `ext.command` 的 Ref |
| transform | `ref → {invoke_id, ns, action, author, status (from annotation), timestamp}` |
| refresh | `on_change` |
| operation_id | `command.history` |

### §16.9 API

| 端点 | Method | 说明 |
|------|--------|------|
| `GET /commands` | GET | 当前平台所有可用命令列表（聚合所有 command_manifest） |
| `GET /rooms/{room_id}/commands` | GET | 当前 Room 可用命令（按已安装 Socialware 过滤） |
| `POST /rooms/{room_id}/messages` | POST | 发送命令（在 body 中包含 `command` 参数） |
| `GET /commands/{invoke_id}` | GET | 查询命令执行结果 |

POST body（发送命令）:

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

- [MUST] POST 时 Engine 自动生成 `invoke_id` 并注入到 `ext.command` 中。
- [MUST] 客户端 MAY 直接传入 `command` 对象而不在 `body` 中写斜杠文本。两种方式等价。

### §16.10 客户端行为

- [SHOULD] 客户端 SHOULD 在用户输入 `/` 时触发命令自动补全菜单，基于 `command_manifest_registry` Index。
- [SHOULD] 自动补全 SHOULD 按命名空间分组显示。
- [SHOULD] 命令执行后，客户端 SHOULD 在原消息下方内联显示结果（基于 `command_result` annotation）。
- [MAY] 客户端 MAY 为高频命令提供快捷按钮（如 TaskArena 的 "Claim" 按钮）。

### §16.11 错误码

| Code | 含义 |
|------|------|
| `COMMAND_NS_NOT_FOUND` | 命令命名空间未找到 |
| `COMMAND_ACTION_NOT_FOUND` | 命令动作未找到 |
| `COMMAND_PARAMS_INVALID` | 必填参数缺失或类型错误 |
| `COMMAND_TIMEOUT` | 命令处理超时 |

### §16.12 规则汇总

- [MUST] `ext.command` 是 signed 字段，纳入 Ref author 签名。
- [MUST] `command_result` 是 unsigned annotation，由 Socialware Identity 写入。
- [MUST] `invoke_id` 全局唯一（UUIDv7）。
- [MUST] 命令命名空间在安装时唯一性检查。
- [MUST] 系统命令使用 `sys` 命名空间，由 Engine 内置处理。
- [MUST] Peer 不支持 EXT-15 时，`ext.command` 字段被保留但命令不执行。
- [SHOULD] 客户端 SHOULD 提供基于 manifest 的自动补全。
- [SHOULD] 命令执行超时（默认 30s）SHOULD 触发 timeout 事件。

---

## §17 EXT-16: Link Preview

### §17.1 概述

Link Preview 自动提取消息中 URL 的元信息（标题、描述、缩略图），以富预览形式展示在消息下方。

### §17.2 声明

```yaml
id: "link-preview"
version: "0.1.0"
dependencies: ["message"]
```

### §17.3 Annotation

**Annotation 位置**：`ref.ext.link-preview`

Link Preview 数据作为 Annotation Pattern 嵌入在 Ref 的 `ext.link-preview` 命名空间中。

Schema（Y.Map）：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `url` | string | MUST | 原始 URL |
| `title` | string | MAY | 页面标题 |
| `description` | string | MAY | 页面描述 |
| `image_url` | string | MAY | 预览图 URL |
| `site_name` | string | MAY | 站点名称 |
| `type` | enum | MUST | `article` / `image` / `video` / `generic` |
| `fetched_at` | RFC 3339 | MUST | 抓取时间 |
| `error` | string | MAY | 抓取失败时的错误描述 |

当消息包含多个 URL 时，`ext.link-preview` 为 Y.Map，key 为 URL 的 SHA-256 hash 前 16 字符：

```yaml
ref.ext.link-preview:
  "a1b2c3d4e5f67890":
    url: "https://example.com/article"
    title: "Example Article"
    description: "..."
    type: "article"
    fetched_at: "2026-02-27T10:00:00Z"
```

### §17.4 Hooks

**pre_send: link-preview.extract**

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `insert` |
| priority | `25` |

- [MUST] 扫描消息 body 中的 URL。
- [MUST] 找到 URL 时，在 `ext.link-preview` 中写入占位条目（`type: "generic"`, `fetched_at: null`）。
- [MUST] 客户端看到占位条目时 SHOULD 显示 URL loading 状态。

**after_write: link-preview.fetch**

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `insert` |
| trigger.filter | `ext.link-preview present` |
| priority | `50` |

- [SHOULD] 异步抓取 URL 的 Open Graph / meta 信息。
- [MUST] 抓取完成后更新 `ext.link-preview` 中的对应条目。
- [SHOULD] 抓取超时（推荐 10s）时，写入 `error` 字段。
- [MUST] 更新由 `@system:local` 执行（pre_send Hook 产生的 annotation 由系统更新）。

### §17.5 Indexes

无独立 Index。Link Preview 数据嵌入在 Ref 中，随 Timeline 一同查询。

### §17.6 规则汇总

- [MUST] Link Preview 数据由 `@system:local` 写入，不纳入 author 签名（unsigned）。
- [MUST] Peer 不支持 EXT-16 时，`ext.link-preview` 字段被保留但不渲染预览。
- [SHOULD] 实现 SHOULD 缓存已抓取的 URL 预览信息，避免重复抓取。
- [MAY] 实现 MAY 提供用户选项禁用特定 Room 的 Link Preview。

---

## §18 EXT-17: Runtime

### §18.1 概述

Runtime Extension 为 Socialware 运行提供协议层基础设施。它不实现任何 Socialware 逻辑，而是定义 Socialware Message 在协议层如何表现、路由和保留。

**设计动机**：Socialware 作为应用层，不应直接操作 `ext.*` 命名空间或创建 Datatype。但 Socialware Message 需要协议层约定来确保跨节点一致性——哪些 Room 启用了哪些 Socialware、Socialware Message 的命名格式、未安装 Socialware 的节点如何处理这些 Message。Runtime Extension 封装这些约定。

**类比**：EXT-15 Command 不实现任何具体命令，而是定义"命令调用"的协议层能力。Runtime 不实现任何具体 Socialware，而是定义"Socialware 在协议层如何存在"。

### §18.2 声明

```yaml
id: "runtime"
version: "0.1.0"
dependencies: ["channels", "reply-to", "command"]
```

### §18.3 Room Config 字段

#### §18.3.1 ext.runtime（unsigned，on Room Config）

```yaml
ext.runtime:
  enabled:    [string]          # 启用的 Socialware namespace 列表
  config:                       # per-Socialware 透传配置（协议层不解读内部结构）
    {sw_namespace}: any         # Socialware Runtime 读取并处理
```

**示例**：

```yaml
ext.runtime:
  enabled: ["ta", "ew", "rp"]
  config:
    ta:
      default_roles:
        "*": ["ta:worker"]
        "@alice:relay-a.example.com": ["ta:publisher", "ta:reviewer"]
    ew:
      retention_days: 90
```

- [MUST] `enabled` 列表中的每个值是一个 Socialware namespace（短标识，如 `"ta"`, `"ew"`, `"rp"`）。
- [MUST] `config.{ns}` 的内部结构由对应 Socialware 定义，Runtime Extension 不做 schema 验证。
- [MUST] `ext.runtime` 的 writer_rule: `signer.power_level >= admin`（与 Room Config 其他管理字段一致）。
- [MUST] 未安装 Runtime Extension 的 Peer 收到含 `ext.runtime` 的 Room Config 时，按 §3.3.1 保留规则保留该字段。

### §18.4 content_type 命名约定

#### §18.4.1 Socialware content_type 格式

Socialware 发出的 Message MUST 使用以下 content_type 格式：

```
{ns}:{entity_type}.{action}
```

| 组成部分 | 说明 | 约束 |
|---------|------|------|
| `ns` | Socialware namespace | [MUST] 与 `ext.runtime.enabled` 中的值匹配 |
| `entity_type` | 领域实体类型 | [MUST] 小写字母+连字符 |
| `action` | 操作名称 | [MUST] 小写字母+连字符 |

**示例**：

```
ta:task.propose          # TaskArena: 发布任务
ta:task.claim            # TaskArena: 认领任务
ta:task.submit           # TaskArena: 提交成果
ta:verdict.approve       # TaskArena: 审批通过
ta:role.grant            # TaskArena: 授予角色
ew:branch.create         # EventWeaver: 创建分支
rp:allocation.request    # ResPool: 请求资源分配
```

#### §18.4.2 系统 content_type

以 `{ns}:_system.` 开头的 content_type 保留给 Socialware Runtime 内部使用：

```
ta:_system.conflict      # 冲突通知
ta:_system.escalation    # 升级通知
```

- [MUST] content_type 包含 `:` 的 Message 视为 Socialware Message，受 Runtime Hook 管控。
- [MUST] 不包含 `:` 的 content_type（如 `immutable`, `mutable`, `collab`, `blob`）为 Bus/Extension 保留值，Socialware MUST NOT 使用。
- [MUST] Socialware Message 仍使用标准的 Ref 结构（ref_id, author, content_type, content_id, body 等），不引入新字段。

### §18.5 Channel 命名空间保留

```
_sw:{ns}                 # Socialware 主 channel
_sw:{ns}:{sub_channel}   # Socialware 子 channel
```

**示例**：

```
_sw:ta                   # TaskArena 主 channel
_sw:ta:admin             # TaskArena 管理操作
_sw:ta:system            # TaskArena 系统通知
_sw:ew                   # EventWeaver 主 channel
```

- [MUST] `_sw:` 前缀的 channel tag 保留给 Socialware Message。
- [SHOULD] Socialware Message SHOULD 设置 `ext.channels` 包含对应的 `_sw:{ns}` channel。
- [SHOULD] 客户端默认不在主聊天 Timeline 中渲染 `_sw:*` channel 的 Message（参见 §18.10）。
- [MUST] `_sw:` channel tag 遵循 EXT-06 的所有规则（签名、验证、Index 集成）。

### §18.6 Hooks

#### pre_send: runtime.namespace_check

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `insert` |
| trigger.filter | `content_type contains ':'` |
| priority | `45` |

逻辑：

```
IF content_type contains ':'
  ns = content_type.split(':')[0]
  IF ns NOT IN room_config.ext.runtime.enabled
    REJECT("Socialware namespace '{ns}' not enabled in this room")
```

- [MUST] 此 Hook 拦截所有含 `:` 的 content_type，验证其 namespace 已在 Room 中启用。
- [MUST] Room 未配置 `ext.runtime` 或 `ext.runtime.enabled` 为空时，所有 Socialware content_type MUST 被拒绝。

#### pre_send: runtime.local_sw_check

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `insert` |
| trigger.filter | `content_type contains ':' AND is_local_write` |
| priority | `46` |

逻辑：

```
IF is_local_write AND content_type contains ':'
  ns = content_type.split(':')[0]
  IF local_node does NOT have Socialware with namespace == ns installed and running
    REJECT("Cannot send: Socialware '{ns}' not installed locally")
```

- [MUST] 仅检查**本地发出**的 Message。远程 Peer 的 Message 通过 Signed Envelope 验证，不受此检查。
- [MUST] 此规则确保只有安装了 Socialware 的节点才能发送该 Socialware 的 Message——因为只有安装了的节点才有 Role/Flow 检查 Hook（priority 100+）。

#### after_write: runtime.sw_message_index

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `insert` |
| trigger.filter | `content_type contains ':'` |
| priority | `50` |

- [MUST] 更新 `socialware_messages` Index（§18.7）。

### §18.7 Indexes

#### socialware_messages

| 字段 | 值 |
|------|---|
| input | `timeline_index refs WHERE content_type contains ':'` |
| transform | `(room_id, ns) → refs list, sorted by CRDT order` |
| refresh | `on_change` |
| operation_id | `runtime.list_sw_messages` |

此 Index 为 Socialware Runtime 提供高效的命名空间消息查询，用于 State Cache 重建。

```python
# Python API (auto-generated)
refs = await ctx.runtime.list_sw_messages(room_id, ns="ta")
# → [Ref(content_type="ta:task.propose", ...), Ref(content_type="ta:task.claim", ...), ...]
```

#### sw_enabled_rooms

| 字段 | 值 |
|------|---|
| input | `room_config WHERE ext.runtime.enabled contains {ns}` |
| transform | `ns → [room_id] list` |
| refresh | `on_change` |
| operation_id | `runtime.list_enabled_rooms` |

```python
rooms = await ctx.runtime.list_enabled_rooms(ns="ta")
# → ["room-001", "room-002", ...]
```

### §18.8 SSE Events

| Event Type | Trigger | Payload |
|------------|---------|---------|
| `runtime.sw_enabled` | Room Config 中 ext.runtime.enabled 列表新增 namespace | `{ room_id, ns }` |
| `runtime.sw_disabled` | Room Config 中 ext.runtime.enabled 列表移除 namespace | `{ room_id, ns }` |

### §18.9 API Endpoints

| Endpoint | Method | 说明 | 写入模式 |
|----------|--------|------|---------|
| `/rooms/{room_id}/runtime/messages?ns={ns}` | GET | 查询 Room 中指定 namespace 的 Socialware Message | — |
| `/rooms/{room_id}/runtime/enabled` | GET | 查询 Room 启用的 Socialware 列表 | — |
| `/rooms/{room_id}/runtime/enabled` | PUT | 更新 Room 的 Socialware 启用列表 | A |

### §18.10 客户端行为

- [SHOULD] 客户端主聊天 Timeline 默认**折叠** `_sw:*` channel 的 Message，显示为类似 "TaskArena: 3 new activities" 的摘要行。
- [MAY] 客户端在 Socialware 提供的 Tab（如 Kanban、DAG View）中完整渲染 `_sw:*` Message。
- [MUST] 客户端对未知 content_type（含 `:`）的 Message MUST 显示 fallback UI（如 `[ta:task.propose] {body preview}`），不得隐藏或丢弃。
- [SHOULD] 已安装对应 Socialware 的客户端 SHOULD 使用 Socialware UI Manifest（Part C）提供的 renderer 渲染 Message。

### §18.11 规则汇总

- [MUST] content_type 含 `:` 的 Message 受 Runtime namespace_check 管控。
- [MUST] 本地发送 Socialware Message 需安装对应 Socialware。
- [MUST] Room 未启用某 namespace 时，该 namespace 的 Message 不可写入。
- [MUST] `_sw:` channel 前缀保留给 Socialware。
- [MUST] `ext.runtime` 字段遵循 Room Config 的 admin writer_rule。
- [SHOULD] 客户端默认折叠 `_sw:*` channel Message。
- [MUST] 未知 Socialware content_type 的 Message 保留在 Timeline 中（CRDT 默认行为），不删除。

---

## §19 Extension Interaction Rules

### §19.1 签名规则

Extension 在 Ref 上注入的 `ext.*` 字段分为两类：

| 类型 | 示例 | 签名规则 |
|------|------|---------|
| signed | `ext.reply_to`, `ext.channels`, `ext.thread`, `ext.command` | [MUST] 纳入 Ref author 的签名。写入后不可被他人修改 |
| unsigned | `ext.reactions`, `ext.watch`, `ext.command.result`, `ext.link-preview`, `ext.media` | [MUST NOT] 不纳入 author 签名。其他 Entity 可修改（遵循各自的 writer_rule） |
| unsigned (Room Config) | `ext.runtime` | [MUST NOT] Room Config 级别字段，admin 可修改 |

判断原则：

- 表达 **author 意图** 的字段（"我回复了谁"、"我打了什么 tag"）→ signed。
- 表达 **他人行为** 的字段（"谁加了 reaction"、"谁在 watch"）→ unsigned。

### §19.2 Hook 优先级约定

所有 Extension 的 Hook 优先级 MUST 遵循：

| Priority 范围 | 预留给 |
|--------------|--------|
| 0-9 | Built-in（Identity 签名/验证） |
| 10-19 | Built-in（Room membership check） |
| 20-29 | Built-in（Timeline ref 生成，Message hash/validation） |
| 30-39 | Extension pre_send 注入（reactions, reply_to, channels, threads, watch, command） |
| 40-49 | Extension pre_send 检查（runtime namespace_check, runtime local_sw_check） |
| 50-59 | Extension after_write 事件（SSE 生成, watch 检查, command dispatch, runtime index） |
| 60-69 | Extension after_read 合并（moderation overlay） |
| 70-79 | Extension after_read 增强（read receipts auto-mark） |
| 80-89 | 保留 |
| 90-99 | 清理操作（draft 清除） |

### §19.3 Extension 间依赖规则

- [MUST] Extension 只能依赖 Built-in Datatypes 或 dependency 列表中声明的其他 Extension。
- [MUST NOT] 循环依赖。
- [MUST] 依赖的 Extension 未启用时，依赖它的 Extension MUST NOT 被启用。
- [SHOULD] 最大依赖深度为 2（`Built-in → ExtA → ExtB`）。超过 2 层的深度链 SHOULD 被审视是否有设计简化的可能。

### §19.4 content_type 升级路径

```
immutable (Bus)
    ↓
mutable (EXT-01)
    ↓
collab (EXT-02)
```

- [MUST] 升级是单向的。降级不允许。
- [MUST] 升级操作 MUST 由 Ref 的原始 author 执行。
- [MUST] 升级时 content_id 更新为新 Doc 的 ID，content_type 更新为新类型。

### §19.5 status 注册表

| 值 | 定义者 | 说明 |
|---|--------|------|
| `active` | Bus (Timeline) | 正常 |
| `deleted_by_author` | Bus (Timeline) | Author 删除 |
| `edited` | EXT-01 Mutable | Content 被编辑 |

- [MUST] Extension 注册新 status 值时 MUST 确保不与已有值冲突。
- [MUST] 未知 status 值 MUST 被保留，客户端 SHOULD 显示 "未知状态" 占位符。

---

## 附录 F：Extension SSE Events 汇总

| Event Type | Extension | Trigger |
|------------|-----------|---------|
| `message.edited` | EXT-01 Mutable | Content 被编辑 |
| `reaction.added` | EXT-03 Reactions | Reaction 添加 |
| `reaction.removed` | EXT-03 Reactions | Reaction 移除 |
| `channel.activity` | EXT-06 Channels | Channel 有新消息 |
| `moderation.action` | EXT-07 Moderation | 审核操作 |
| `presence.joined` | EXT-09 Presence | Entity 上线 |
| `presence.left` | EXT-09 Presence | Entity 离线 |
| `typing.start` | EXT-09 Presence | 开始输入 |
| `typing.stop` | EXT-09 Presence | 停止输入 |
| `watch.ref_content_edited` | EXT-14 Watch | 被 watch 的 Ref 内容被编辑 |
| `watch.ref_reply_added` | EXT-14 Watch | 被 watch 的 Ref 被回复 |
| `watch.ref_thread_reply` | EXT-14 Watch | 被 watch 的 Ref 的 Thread 有新回复 |
| `watch.ref_reaction_changed` | EXT-14 Watch | 被 watch 的 Ref 的 Reaction 变化 |
| `watch.channel_new_ref` | EXT-14 Watch | 被 watch 的 Channel 有新消息 |
| `command.invoked` | EXT-15 Command | 命令被调用 |
| `command.result` | EXT-15 Command | 命令执行结果返回 |
| `command.timeout` | EXT-15 Command | 命令执行超时 |
| `runtime.sw_enabled` | EXT-17 Runtime | Room 启用 Socialware |
| `runtime.sw_disabled` | EXT-17 Runtime | Room 禁用 Socialware |

---

## 附录 G：Extension API Endpoints 汇总

| Endpoint | Method | Extension | 说明 | 写入模式 |
|----------|--------|-----------|------|---------|
| `/rooms/{room_id}/messages/{ref_id}` | PUT | EXT-01 | 编辑消息 | A |
| `/rooms/{room_id}/messages/{ref_id}/versions` | GET | EXT-01 | 编辑历史 | — |
| `/rooms/{room_id}/content/{content_id}/acl` | GET, PUT | EXT-02 | ACL 管理 | A |
| `/rooms/{room_id}/content/{content_id}/collab` | WS | EXT-02 | 实时协作 | A |
| `/rooms/{room_id}/messages/{ref_id}/reactions` | POST | EXT-03 | 添加 Reaction | A |
| `/rooms/{room_id}/messages/{ref_id}/reactions/{emoji}` | DELETE | EXT-03 | 移除 Reaction | A |
| `/rooms/{room_id}/messages/{ref_id}/preview` | GET | EXT-05 | 跨 Room 预览 | — |
| `/channels` | GET | EXT-06 | Channel 列表 | — |
| `/channels/{channel_id}/messages` | GET | EXT-06 | Channel 聚合视图 | — |
| `/rooms/{room_id}/moderation` | POST | EXT-07 | 审核操作 | A |
| `/rooms/{room_id}/receipts` | GET | EXT-08 | 阅读进度 | B |
| `/rooms/{room_id}/presence` | GET | EXT-09 | 在线用户 | B |
| `/rooms/{room_id}/typing` | POST | EXT-09 | 正在输入 | B |
| `/rooms/{room_id}/media` | GET | EXT-10 | 媒体列表 | — |
| `/blobs` | POST | EXT-10 | 上传 Blob | A |
| `/blobs/{blob_hash}` | GET | EXT-10 | 下载 Blob | — |
| `/rooms/{room_id}/messages?thread_root={ref_id}` | GET | EXT-11 | Thread 视图 | — |
| `/rooms/{room_id}/drafts` | GET | EXT-12 | 读取 Draft | B |
| `/identity/{entity_id}/profile` | GET | EXT-13 | 读取 Profile | — |
| `/identity/{entity_id}/profile` | PUT | EXT-13 | 发布/更新 Profile | A |
| `/ext/discovery/search` | POST | EXT-13 | Discovery（非标准化） | — |
| `/watches` | GET | EXT-14 | 我的 Watch 列表 | — |
| `/watches` | POST | EXT-14 | 创建 Watch | A |
| `/watches/{watch_key}` | DELETE | EXT-14 | 撤销 Watch | A |
| `/commands` | GET | EXT-15 | 平台所有可用命令 | — |
| `/rooms/{room_id}/commands` | GET | EXT-15 | Room 可用命令 | — |
| `/commands/{invoke_id}` | GET | EXT-15 | 命令执行结果 | — |
| `/rooms/{room_id}/runtime/messages` | GET | EXT-17 | Socialware Message 查询 | — |
| `/rooms/{room_id}/runtime/enabled` | GET | EXT-17 | 启用的 Socialware 列表 | — |
| `/rooms/{room_id}/runtime/enabled` | PUT | EXT-17 | 更新启用列表 | A |

> 写入模式 A = REST API 写入（经 Hook Pipeline）；B = 直接 CRDT 写入（经 Engine API）。见 §1.5。

---

## 附录 H：content_type / status 注册表汇总

### content_type 注册表

| 值 | 定义者 | content_id 格式 | 升级自 |
|---|--------|----------------|--------|
| `immutable` | Bus (Message) | `sha256:{hex}` | — |
| `mutable` | EXT-01 | `uuid:{UUIDv7}` | `immutable` |
| `collab` | EXT-02 | `uuid:{UUIDv7}` | `mutable` |
| `blob` | EXT-10 | `sha256:{hex}` | — |
| `{ns}:{entity}.{action}` | EXT-17 (Socialware) | varies | — |

### status 注册表

| 值 | 定义者 | 说明 |
|---|--------|------|
| `active` | Bus (Timeline) | 正常 |
| `deleted_by_author` | Bus (Timeline) | Author 删除 |
| `edited` | EXT-01 | Content 被编辑 |

---

## 附录 I：Extension Renderer 声明汇总

> 本附录定义各 Extension 的 `renderer` 字段（参见 bus-spec §3.5.2）。详细渲染规则见 chat-ui-spec。

### EXT-01: Mutable Content

```yaml
datatypes:
  mutable_content:
    renderer:
      type: document_link
      field_mapping:
        header: "content title (from first line)"
        badge: { field: "version_count", label: "v{n}" }

annotations:
  on_ref:
    ext.mutable.version:
      renderer:
        position: inline
        type: text_tag
        label: "(edited)"
        interaction: { click: show_version_history }

indexes:
  version_history:
    renderer:
      as_room_tab: false     # 弹窗，不是 tab
```

### EXT-02: Collaborative Content

```yaml
datatypes:
  collab_acl:
    renderer:
      type: document_link
      field_mapping:
        header: "content title"
        metadata:
          - { field: "collaborator_count", icon: "users" }

indexes:
  collaborator_list:
    renderer:
      as_room_tab: true
      tab_label: "Document"
      tab_icon: "file-text"
      layout: document
      layout_config:
        toolbar: [bold, italic, code, heading, list]
        awareness: true      # 显示协作者光标
```

### EXT-03: Reactions

```yaml
annotations:
  on_ref:
    ext.reactions:
      renderer:
        position: below
        type: emoji_bar
        layout: horizontal_wrap
        compact_threshold: 5
        interaction:
          click: toggle_own
          long_press: show_who

compose_actions:
  - id: add_reaction
    position: message_hover
    trigger: emoji_picker
```

### EXT-04: Reply To

```yaml
annotations:
  on_ref:
    ext.reply_to:
      renderer:
        position: above
        type: quote_preview
        fields: [author, body_truncated]
        interaction: { click: scroll_to_ref }
```

### EXT-05: Cross-Room References

```yaml
annotations:
  on_ref:
    ext.reply_to (extended):
      renderer:
        position: above
        type: quote_preview
        fields: [author, body_truncated, room_name]
        interaction: { click: navigate_to_room }
        not_member_fallback: "引用了另一个 Room 的消息"
```

### EXT-06: Channels

```yaml
annotations:
  on_ref:
    ext.channels:
      renderer:
        position: below
        type: tag_list
        interaction: { click: filter_by_channel }

indexes:
  channel_list:
    renderer:
      as_room_tab: false
      as_sidebar_section: true
      layout: message_list    # 每个 channel 的聚合视图
```

### EXT-07: Moderation

```yaml
annotations:
  standalone_doc:
    moderation_overlay:
      renderer:
        position: overlay
        type: redact_overlay
        admin_view: show_original_with_mark
        member_view: "消息已被管理员隐藏"
        pin_indicator: badge

compose_actions:
  - id: moderation_actions
    position: message_context_menu
    items: [redact, pin, ban_user]
    visible_to: "power_level >= moderation_level"
```

### EXT-08: Read Receipts

```yaml
annotations:
  on_ref (implicit):
    read_status:
      renderer:
        position: inline
        type: text_tag
        label: "✓✓"          # 双勾 = 已读
        subtle: true

indexes:
  unread_count:
    renderer:
      as_room_tab: false
      as_sidebar_badge: true   # sidebar 中 Room 旁的未读计数
```

### EXT-09: Presence

```yaml
datatypes:
  presence:
    renderer:
      type: presence_dot      # ● 绿色=在线, ○ 灰色=离线
      position: member_avatar

  awareness:
    renderer:
      type: typing_indicator
      position: compose_area_above
      template: "{names} is typing..."

indexes:
  online_users:
    renderer:
      as_room_tab: false
      as_panel_widget: true    # info panel 中的成员列表
```

### EXT-10: Media / Blobs

```yaml
datatypes:
  blob:
    renderer:
      type: media_message
      field_mapping:
        preview: auto          # 图片直接预览，文件显示图标

indexes:
  media_gallery:
    renderer:
      as_room_tab: true
      tab_label: "Media"
      tab_icon: "image"
      layout: grid
      layout_config:
        preview_size: medium
```

### EXT-11: Threads

```yaml
annotations:
  on_ref:
    ext.thread:
      renderer:
        position: below
        type: thread_indicator
        fields: [reply_count, participant_avatars, last_reply_at]
        interaction: { click: open_thread_panel }

indexes:
  thread_view:
    renderer:
      as_room_tab: false
      as_panel: true           # 侧边面板（类似 Slack thread panel）
      layout: message_list
```

### EXT-12: User Drafts

```yaml
# EXT-12 对用户透明，无需可见 renderer
# Draft 数据在 compose area 自动恢复
datatypes:
  user_draft:
    renderer: null             # 无可见 UI 元素
```

### EXT-13: Entity Profile

```yaml
datatypes:
  profile:
    renderer:
      type: profile_card
      field_mapping:
        avatar: "frontmatter.avatar"
        display_name: "frontmatter.display_name"
        bio: "markdown body (truncated)"
      interaction: { click: show_full_profile }
```

### EXT-14: Watch

```yaml
# EXT-14 主要为 Agent 服务，无直接用户 UI
# Watch 列表可在通知中心查看
indexes:
  my_watches:
    renderer:
      as_room_tab: false
      as_notification_source: true
```

### EXT-15: Command

```yaml
datatypes:
  command:
    on_ref:
      ext.command:
        renderer:
          position: inline            # 内联显示在消息体中
          type: command_badge
          fields: [ns, action, params]
          interaction: { click: show_command_detail }

annotations:
  command_result:
    on_ref:
      renderer:
        position: below              # 命令结果显示在消息下方
        type: command_result_card
        fields: [status, result, error]
        style:
          success: { color: green, icon: check }
          error: { color: red, icon: x }
          pending: { color: gray, icon: spinner }

indexes:
  command_manifest_registry:
    renderer:
      as_autocomplete_source: true   # 驱动 / 斜杠命令自动补全
  command_history:
    renderer:
      as_room_tab: false
```

### EXT-16: Link Preview

```yaml
annotations:
  on_ref:
    ext.link-preview:
      renderer:
        position: below
        type: link_card
        field_mapping:
          title: title
          description: description
          image: image_url
          site: site_name
        loading_state: { when: "fetched_at == null", show: "url_skeleton" }
```

### EXT-17: Runtime

```yaml
# Socialware Message 的 fallback renderer（客户端未安装对应 Socialware 时使用）
sw_message_fallback:
  renderer:
    position: full_width
    type: sw_activity_summary
    match: "content_type contains ':'"
    field_mapping:
      namespace: "content_type.split(':')[0]"
      action: "content_type.split(':')[1]"
      body_preview: "body | truncate(100)"
    style:
      collapsed: true                 # 默认折叠
      expand_label: "Show activity"
      icon: "puzzle-piece"            # 表示 Socialware 活动

# Room Config 中 ext.runtime 的 renderer
room_config:
  ext.runtime:
    renderer:
      as_settings_panel: true         # 在 Room 设置中展示
      type: socialware_manager
      fields: [enabled, config]
```

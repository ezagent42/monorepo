# Phase 2: Extension 实现

> 从 implementation-plan.md §5 提取
> **版本**：0.9.1
> **目标**：EXT-01 到 EXT-15 全部 Rust 实现，协议功能完整
> **预估周期**：3-4 周

---

### §5.1 EXT-01 Mutable

#### TC-2-EXT01-001: Immutable → Mutable 升级

```
GIVEN  M-003 (immutable, author=E-alice) in R-alpha
       使用验证数据 MUT-001

WHEN   E-alice 执行 PUT /rooms/R-alpha/messages/{M-003.ref_id}
       { body: MUT-001.编辑后body }

THEN   创建 mutable_content doc (content_id = uuid:...)
       body 从 immutable content 复制并更新
       Ref.content_type → "mutable"
       Ref.content_id → 新 doc ID
```

#### TC-2-EXT01-002: 编辑 Mutable Message

```
GIVEN  M-003 已升级为 mutable

WHEN   E-alice 编辑 body

THEN   mutable_content doc 更新
       Ref.status → "edited"
       SSE: message.edited { room_id: R-alpha, ref_id: M-003.ref_id }
```

#### TC-2-EXT01-003: 非作者编辑被拒

```
GIVEN  M-003 (mutable, author=E-alice)

WHEN   E-bob 尝试编辑

THEN   拒绝: writer_rule "signer == content.author" 不满足
```

#### TC-2-EXT01-004: 降级不允许

```
GIVEN  M-003 (mutable)

WHEN   尝试将 content_type 改回 "immutable"

THEN   操作被拒绝
```

### §5.2 EXT-02 Collab

#### TC-2-EXT02-001: Mutable → Collab 升级

```
GIVEN  COL-001: R-gamma, E-alice 的 mutable message

WHEN   E-alice 升级为 collab

THEN   创建 ACL doc: { owner: E-alice, mode: "owner_only", editors: [] }
       Ref.content_type → "collab"
```

#### TC-2-EXT02-002: ACL Mode 升级 → Explicit

```
GIVEN  COL-001 (collab, mode=owner_only)

WHEN   E-alice 更新 ACL: { mode: "explicit", editors: [E-alice, E-bob] }

THEN   ACL 更新成功
       E-bob 可以编辑 content
```

#### TC-2-EXT02-003: ACL 验证 — 非编辑者被拒

```
GIVEN  COL-001 (mode=explicit, editors=[E-alice, E-bob])

WHEN   E-carol 尝试编辑

THEN   collab.check_acl hook 拒绝: E-carol ∉ editors
```

#### TC-2-EXT02-004: ACL 降级不允许

```
GIVEN  COL-001 (mode=explicit)

WHEN   尝试将 mode 改回 "owner_only"

THEN   操作被拒绝
```

### §5.3 EXT-03 Reactions

#### TC-2-EXT03-001: 添加 Reaction

```
GIVEN  M-001 in R-alpha, 使用验证数据 RX-001

WHEN   E-bob 执行 POST /rooms/R-alpha/messages/{M-001.ref_id}/reactions { emoji: "👍" }

THEN   M-001.ext.reactions."👍:@bob:relay-a.example.com" = RX-001.timestamp
       SSE: reaction.added { room_id, ref_id, emoji: "👍", entity_id: E-bob }
```

#### TC-2-EXT03-002: 移除 Reaction

```
GIVEN  RX-001 存在 (E-bob 的 👍 on M-001)，使用 RX-004

WHEN   E-bob 执行 DELETE /rooms/R-alpha/messages/{M-001.ref_id}/reactions/👍

THEN   M-001.ext.reactions."👍:@bob:relay-a.example.com" 被删除
       SSE: reaction.removed
```

#### TC-2-EXT03-003: 不能移除他人 Reaction

```
GIVEN  RX-002 (E-agent1 的 🎉 on M-001)

WHEN   E-bob 尝试删除 E-agent1 的 reaction

THEN   拒绝: reaction key 中 entity_id != signer
```

#### TC-2-EXT03-004: Reaction 不影响 Bus 签名

```
GIVEN  M-001 的 Bus signature

WHEN   E-bob 添加 reaction (修改 ext.reactions)

THEN   M-001 的 core 字段 signature 不变
       ext.reactions 是 unsigned 字段
```

### §5.4 EXT-04 Reply To

#### TC-2-EXT04-001: 回复消息

```
GIVEN  M-001, M-002 in R-alpha, 使用 RP-001

WHEN   发送 M-002 时指定 reply_to: M-001.ref_id

THEN   M-002.ext.reply_to = { ref_id: M-001.ref_id }
       ext.reply_to 是 signed 字段（纳入 M-002 作者签名）
```

#### TC-2-EXT04-002: Reply To 不可修改

```
GIVEN  M-002 已有 ext.reply_to

WHEN   尝试修改 ext.reply_to.ref_id

THEN   修改会破坏签名 → 其他 Peer 验证失败 → 被丢弃
```

### §5.5 EXT-05 Cross-Room Ref

#### TC-2-EXT05-001: 跨 Room 引用

```
GIVEN  E-alice 在 R-gamma 中，使用 XR-001

WHEN   发送新消息，reply_to = { ref_id: M-003.ref_id, room_id: R-alpha.room_id, window: "2026-02" }

THEN   ext.reply_to 包含 room_id 和 window
       签名覆盖这些字段
```

#### TC-2-EXT05-002: 非成员看不到跨 Room 内容

```
GIVEN  E-carol 不在 R-alpha 中
       R-gamma 有一条 cross-room ref 指向 R-alpha 的 M-003

WHEN   E-carol 读取该 ref

THEN   preview 返回占位符，不包含 M-003 的 body/author/room_name
```

#### TC-2-EXT05-003: 成员可以看到跨 Room 内容

```
GIVEN  E-alice 在 R-alpha 和 R-gamma 中

WHEN   E-alice 读取 R-gamma 中指向 R-alpha.M-003 的 cross-room ref

THEN   preview 包含 M-003 的 author + body 摘要
```

### §5.6 EXT-06 Channels

#### TC-2-EXT06-001: 消息打 Channel Tag

```
GIVEN  M-003 in R-alpha, 使用 CH-001

WHEN   发送 M-003 时指定 channels: ["code-review"]

THEN   M-003.ext.channels = ["code-review"]
       signed 字段
```

#### TC-2-EXT06-002: Channel Tag 格式验证

```
GIVEN  尝试使用 channel tag

WHEN   tag = "Code-Review"（含大写）

THEN   拒绝: tag 格式必须为 [a-z0-9-]{1,64}

WHEN   tag = "code-review"

THEN   接受
```

#### TC-2-EXT06-003: Channel 聚合 — 跨 Room

```
GIVEN  CH-002 (R-beta, "design"), CH-003 (R-beta, "design")
       E-alice 在 R-alpha 和 R-beta 中

WHEN   GET /channels/design/messages

THEN   返回 R-alpha 和 R-beta 中所有 ext.channels 包含 "design" 的 refs
       按 created_at 归并排序

WHEN   E-outsider（不在任何 Room）请求同一端点

THEN   返回空（聚合范围限定在已加入 Room 的并集）
```

#### TC-2-EXT06-004: Channel 隐式创建

```
GIVEN  不存在 "new-feature" channel

WHEN   E-bob 发送消息带 channels: ["new-feature"]

THEN   "new-feature" channel 自动出现在 GET /channels 列表中
```

### §5.7 EXT-07 Moderation

#### TC-2-EXT07-001: Redact 操作

```
GIVEN  R-alpha, 使用 MOD-001

WHEN   E-alice (power_level=100, mod_level=50) 执行:
       POST /rooms/R-alpha/moderation { action: "redact", target_ref: M-004.ref_id, reason: "..." }

THEN   Moderation overlay 新增 entry
       SSE: moderation.action { ... }
```

#### TC-2-EXT07-002: Redact 渲染 — 不同权限

```
GIVEN  MOD-001 已执行

WHEN   E-bob (power_level=0) 读取 M-004

THEN   M-004 显示为占位符 "消息已被管理员隐藏"

WHEN   E-alice (power_level=100) 读取 M-004

THEN   M-004 显示原文 + 标记 "已 redact"
```

#### TC-2-EXT07-003: 权限不足被拒

```
GIVEN  R-alpha, ext.moderation.power_level = 50

WHEN   E-bob (power_level=0) 尝试 redact

THEN   拒绝: power_level 0 < 50
```

#### TC-2-EXT07-004: Overlay 不修改原始 Ref

```
GIVEN  MOD-001 redact M-004

WHEN   检查 timeline_index 中 M-004 的原始 Ref

THEN   Ref 的 core 字段不变（body 仍然存在）
       Moderation overlay 是独立 doc
```

### §5.8 EXT-08 Read Receipts

#### TC-2-EXT08-001: 更新阅读进度

```
GIVEN  R-alpha, E-bob, 使用 RR-002

WHEN   E-bob 阅读到 M-003

THEN   Read Receipts doc 更新:
       "@bob:relay-a.example.com": { last_read_ref: M-003.ref_id, last_read_window: "2026-02" }
```

#### TC-2-EXT08-002: 只能更新自己的 Receipt

```
GIVEN  E-alice 尝试更新 E-bob 的 read receipt

WHEN   写入 key "@bob:..."

THEN   拒绝: crdt_map key != signer entity_id
```

#### TC-2-EXT08-003: Unread Count

```
GIVEN  RR-002 (E-bob read up to M-003), R-alpha 有 M-001 到 M-004

WHEN   GET /rooms/R-alpha/receipts (for E-bob)

THEN   unread_count = 1 (M-004 在 M-003 之后)
```

### §5.9 EXT-09 Presence

#### TC-2-EXT09-001: 上线检测

```
GIVEN  E-alice 连接到 R-alpha

WHEN   Presence token 出现

THEN   SSE: presence.joined { room_id: R-alpha, entity_id: E-alice }
       GET /rooms/R-alpha/presence 包含 E-alice
```

#### TC-2-EXT09-002: 离线检测

```
GIVEN  E-alice 断开连接

WHEN   Presence token 消失

THEN   SSE: presence.left { room_id: R-alpha, entity_id: E-alice }
       GET /rooms/R-alpha/presence 不包含 E-alice
```

#### TC-2-EXT09-003: Typing 指示

```
GIVEN  E-bob 在 R-alpha 中，使用 PR-002

WHEN   POST /rooms/R-alpha/typing { typing: true }

THEN   SSE: typing.start { room_id: R-alpha, entity_id: E-bob }

WHEN   POST /rooms/R-alpha/typing { typing: false }（或超时 10s）

THEN   SSE: typing.stop { room_id: R-alpha, entity_id: E-bob }
```

### §5.10 EXT-10 Media

#### TC-2-EXT10-001: 上传 Blob

```
GIVEN  E-alice, 使用 BL-001

WHEN   POST /blobs { file: diagram.png }

THEN   计算 sha256 → BL-001.blob_hash
       存储 blob
       返回 { blob_hash: "sha256:aaaa1111..." }
```

#### TC-2-EXT10-002: Blob 去重

```
GIVEN  BL-001 已上传

WHEN   E-bob 上传完全相同的 diagram.png

THEN   hash 相同 → 不重复存储
       返回相同的 blob_hash
```

#### TC-2-EXT10-003: Blob 不可变

```
GIVEN  BL-001 已存储

WHEN   尝试覆盖 blob 内容

THEN   操作被拒绝: blob 是 one_time_write
```

### §5.11 EXT-11 Threads

#### TC-2-EXT11-001: 创建 Thread 回复

```
GIVEN  M-007 in R-gamma (thread root), 使用 TH-001

WHEN   E-bob 发送带 thread_root: M-007.ref_id 的消息

THEN   新 Ref 包含 ext.thread = { root: M-007.ref_id }
       新 Ref 也包含 ext.reply_to = { ref_id: M-007.ref_id }
```

#### TC-2-EXT11-002: Thread View

```
GIVEN  TH-001 有 2 条 thread 回复

WHEN   GET /rooms/R-gamma/messages?thread_root={M-007.ref_id}

THEN   返回 2 条 refs，均有 ext.thread.root == M-007.ref_id
       按 CRDT 顺序排列
```

#### TC-2-EXT11-003: Thread Root 不携带 ext.thread

```
GIVEN  M-007 是 thread root

WHEN   读取 M-007

THEN   M-007 没有 ext.thread 字段（root 本身不标记）
```

### §5.12 EXT-12 Drafts

#### TC-2-EXT12-001: 草稿跨设备同步

```
GIVEN  E-alice 在设备 D1 和 D2 上登录
       使用 DR-001

WHEN   D1 写入 draft body: "Work in progress reply..."

THEN   D2 通过 CRDT 同步收到相同 draft
```

#### TC-2-EXT12-002: 发送后清除草稿

```
GIVEN  DR-001 存在

WHEN   E-alice 发送消息（M-001 发送成功）

THEN   drafts.clear_on_send hook 清除 R-gamma 的 draft doc body
```

#### TC-2-EXT12-003: 草稿是私有数据

```
GIVEN  E-alice 的 draft doc 在 ezagent/room/R-gamma/ext/draft/@alice:.../

WHEN   E-bob 尝试读取 E-alice 的 draft

THEN   writer_rule "signer == entity_id in key_pattern" 阻止访问
       Draft 内容不出现在任何公开 Index 中
```

### §5.13 EXT-13 Profile

#### TC-2-EXT13-001: 发布 Profile

```
GIVEN  E-agent1, 使用 PF-002

WHEN   写入 profile doc:
       frontmatter: { entity_type: "agent", display_name: "Code Review Agent" }
       body: (PF-002.body)

THEN   Profile 存储在 ezagent/entity/@code-reviewer:relay-a.example.com/ext/profile/
       GET /identity/@code-reviewer:relay-a.example.com/profile 返回 profile 内容
```

#### TC-2-EXT13-002: entity_type 必需字段验证

```
GIVEN  Profile 缺少 entity_type

WHEN   尝试写入

THEN   验证失败: frontmatter.entity_type 是唯一 MUST 字段
```

#### TC-2-EXT13-003: 只能修改自己的 Profile

```
GIVEN  E-bob 尝试修改 E-alice 的 profile doc

WHEN   写入到 ezagent/entity/@alice:.../ext/profile/

THEN   拒绝: writer_rule "signer == entity_id" 不满足
```

#### TC-2-EXT13-004: Discovery — Relay 索引

```
GIVEN  PF-002 (E-agent1 profile) 和 PF-003 (E-agent2 profile) 已发布
       Relay 侧 discovery index 已建立

WHEN   POST /ext/discovery/search { query: "code review rust" }

THEN   返回 PF-002 (E-agent1)
       不返回 PF-003 (translator，不匹配)
       （搜索算法由 Relay 实现，结果可能因实现不同而异）
```

#### TC-2-EXT13-005: Virtual User

```
GIVEN  R-alpha 的 members 包含 E-carol ("@carol:relay-b.example.com")
       Relay-A 本地存有 E-carol 的 proxy profile

WHEN   在 Relay-A 的 discovery index 中搜索

THEN   E-carol 出现在结果中（作为 virtual user）
```

### §5.14 EXT-14 Watch

#### TC-2-EXT14-001: 设置 Per-Ref Watch

```
GIVEN  M-003 in R-alpha, E-agent1 是 member
       使用 W-001

WHEN   E-agent1 写入 annotation:
       key = "watch:@code-reviewer:relay-a.example.com"
       value = { on_content_edit: true, on_reply: true, on_thread: false, on_reaction: false, reason: "processing_task" }
       on M-003.ext.annotations

THEN   Annotation 写入成功
       GET /watches (for E-agent1) 包含 { type: "ref", target: M-003.ref_id, room_id: R-alpha }
```

#### TC-2-EXT14-002: Watch 通知 — Content Edited

```
GIVEN  W-001 (E-agent1 watch M-003, on_content_edit=true)
       M-003 已升级为 mutable (MUT-001)

WHEN   E-alice 编辑 M-003

THEN   E-agent1 收到 SSE: watch.ref_content_edited
       { watcher: E-agent1, watched_ref: M-003.ref_id, room_id: R-alpha, new_content_id: "..." }
```

#### TC-2-EXT14-003: Watch 通知 — Reply Added

```
GIVEN  W-001 (E-agent1 watch M-003, on_reply=true)

WHEN   E-bob 发送 M-004 (reply_to M-003)

THEN   E-agent1 收到 SSE: watch.ref_reply_added
       { watcher: E-agent1, watched_ref: M-003.ref_id, room_id: R-alpha, new_ref_id: M-004.ref_id }
```

#### TC-2-EXT14-004: 设置 Channel Watch

```
GIVEN  E-agent1, 使用 W-002

WHEN   在 R-alpha 的 room_config 上写入 annotation:
       key = "channel_watch:@code-reviewer:relay-a.example.com"
       value = { channels: ["code-review"], scope: "all_rooms" }

THEN   Annotation 写入成功
```

#### TC-2-EXT14-005: Channel Watch 通知

```
GIVEN  W-002 (E-agent1 watches "code-review" channel, scope=all_rooms)

WHEN   E-bob 在 R-alpha 发送新消息带 channels: ["code-review"]

THEN   E-agent1 收到 SSE: watch.channel_new_ref
       { watcher: E-agent1, channel: "code-review", room_id: R-alpha, new_ref_id: "..." }
```

#### TC-2-EXT14-006: Watch 是公开数据

```
GIVEN  W-001 存在 (E-agent1 watch M-003)

WHEN   E-bob 读取 M-003 的 annotations

THEN   E-bob 可以看到 "watch:@code-reviewer:..." annotation
       Watch 不是私有数据
```

#### TC-2-EXT14-007: 只能为自己设置 Watch

```
GIVEN  E-alice 尝试设置 watch annotation: key = "watch:@bob:..."

WHEN   写入

THEN   拒绝: annotation key 中 entity_id != signer
```

#### TC-2-EXT14-008: 不支持 Watch 的 Peer 保留 Watch Annotation

```
GIVEN  Level 0 Peer 同步到有 watch annotation 的 M-003

WHEN   Level 0 Peer 修改 M-003 的 core 字段

THEN   watch annotation 不丢失
       但 Level 0 Peer 不触发 watch 通知（hook 未加载）
```

### §5.15 EXT-15 Command

#### TC-2-EXT15-001: 发送命令消息

```
GIVEN  R-alpha 启用 EXT-15 Command
       TaskArena 已安装，command_manifest 已发布（ns=ta, commands=[claim, post-task]）
       E-alice 拥有 ta:worker Role

WHEN   E-alice 发送消息: { body: "/ta:claim task-42", command: { ns: "ta", action: "claim", params: { task_id: "task-42" } } }

THEN   Ref 包含 ext.command = { ns: "ta", action: "claim", params: { task_id: "task-42" }, invoke_id: "uuid:..." }
       ext.command 是 signed 字段，纳入 E-alice 签名
       SSE: command.invoked { room_id, ref_id, invoke_id, ns: "ta", action: "claim", author: E-alice }
```

#### TC-2-EXT15-002: 命令参数验证 — 缺少必填参数

```
GIVEN  R-alpha 启用 EXT-15 Command
       TaskArena command_manifest: claim 需要 task_id (required=true)

WHEN   E-alice 发送: { command: { ns: "ta", action: "claim", params: {} } }

THEN   pre_send Hook (command.validate) 拒绝
       错误码: COMMAND_PARAMS_INVALID
       消息不写入 Timeline
```

#### TC-2-EXT15-003: 命令命名空间不存在

```
GIVEN  R-alpha 启用 EXT-15 Command
       无 Socialware 注册 ns="xyz"

WHEN   E-alice 发送: { command: { ns: "xyz", action: "do-thing" } }

THEN   pre_send Hook 拒绝
       错误码: COMMAND_NS_NOT_FOUND
```

#### TC-2-EXT15-004: 命令动作不存在

```
GIVEN  TaskArena command_manifest 仅含 [claim, post-task, submit, review]

WHEN   E-alice 发送: { command: { ns: "ta", action: "nonexistent" } }

THEN   pre_send Hook 拒绝
       错误码: COMMAND_ACTION_NOT_FOUND
```

#### TC-2-EXT15-005: 命令 Role 权限检查

```
GIVEN  TaskArena command: post-task 需要 required_role = "ta:publisher"
       E-bob 仅拥有 ta:worker Role

WHEN   E-bob 发送: { command: { ns: "ta", action: "post-task", params: { title: "Test" } } }

THEN   pre_send Hook 拒绝
       错误码: PERMISSION_DENIED
```

#### TC-2-EXT15-006: command_result 写入

```
GIVEN  CMD-001 已写入 Timeline（/ta:claim task-42 by E-alice）
       TaskArena Socialware Hook 处理完成

WHEN   TaskArena 写入 command_result Annotation:
       ref.ext.annotations."command_result:{invoke_id}" = {
         invoke_id: "...", status: "success",
         result: { task_id: "task-42", new_state: "claimed" },
         handler: "@task-arena:relay-a.example.com"
       }

THEN   Annotation 写入成功（unsigned，由 Socialware Identity 写入）
       SSE: command.result { room_id, ref_id, invoke_id, status: "success", handler: "@task-arena:..." }
```

#### TC-2-EXT15-007: command_result — 错误

```
GIVEN  CMD-002 已写入 Timeline（/ta:claim task-99）
       task-99 不存在

WHEN   TaskArena 写入 command_result:
       { status: "error", error: "Task task-99 not found" }

THEN   SSE: command.result { status: "error", error: "Task task-99 not found" }
```

#### TC-2-EXT15-008: 命令执行超时

```
GIVEN  CMD-003 已写入 Timeline
       目标 Socialware 30 秒内未写入 command_result

WHEN   after_write Hook (command.dispatch) 超时检测触发

THEN   SSE: command.timeout { room_id, ref_id, invoke_id, ns, action }
```

#### TC-2-EXT15-009: command_manifest_registry Index

```
GIVEN  EventWeaver (ns=ew), TaskArena (ns=ta), ResPool (ns=rp) 均已发布 command_manifest

WHEN   查询 GET /commands

THEN   返回聚合结果:
       ew: [branch, merge, replay, history, dag]
       ta: [claim, post-task, submit, review, dispute, arbitrate, cancel]
       rp: [allocate, release, check-quota, create-pool, set-quota, settle]
```

#### TC-2-EXT15-010: Room 级命令过滤

```
GIVEN  R-alpha 仅安装 TaskArena
       R-beta 安装 TaskArena + ResPool

WHEN   查询 GET /rooms/{R-alpha}/commands
       查询 GET /rooms/{R-beta}/commands

THEN   R-alpha: 仅返回 ta:* 命令
       R-beta: 返回 ta:* + rp:* 命令
```

#### TC-2-EXT15-011: 系统命令 (sys namespace)

```
GIVEN  R-alpha 启用 EXT-15 Command

WHEN   E-alice 发送: { command: { ns: "sys", action: "help" } }

THEN   Engine 内置处理（不路由到 Socialware）
       返回所有可用命令列表
```

#### TC-2-EXT15-012: 命令命名空间冲突检测

```
GIVEN  TaskArena 已安装 (ns=ta)

WHEN   尝试安装另一个 Socialware 也使用 ns="ta"

THEN   安装拒绝
       错误: "Command namespace 'ta' already registered by task-arena"
```

#### TC-2-EXT15-013: ext.command 是 signed 字段

```
GIVEN  CMD-001 由 E-alice 发送

WHEN   E-bob 尝试修改 CMD-001 的 ext.command

THEN   签名验证失败，修改被丢弃（ext.command 是 signed 字段）
```

#### TC-2-EXT15-014: Peer 不支持 EXT-15 保留字段

```
GIVEN  Level 0 Peer 同步到含 ext.command 的 Ref

WHEN   Level 0 Peer 修改该 Ref 的 core 字段

THEN   ext.command 字段不丢失
       命令不执行（EXT-15 Hook 未加载）
```

### §5.16 Extension Interaction

#### TC-2-INTERACT-001: Signed vs Unsigned 字段

```
GIVEN  M-003 由 E-alice 发送

WHEN   M-003 的 ext.reply_to 被其他 entity 尝试修改
       M-003 的 ext.reactions 被 E-bob 添加

THEN   ext.reply_to 修改 → 签名验证失败，被丢弃（signed 字段，同理 ext.command）
       ext.reactions 添加 → 成功（unsigned 字段，只要 reaction key 含 E-bob）
```

#### TC-2-INTERACT-002: 多 Extension 同时注入

```
GIVEN  发送消息，同时指定 reply_to + channels + thread_root + command

WHEN   Pre_send hook chain 执行

THEN   reply_to.inject (p=30) → 注入 ext.reply_to
       channels.inject_tags (p=30) → 注入 ext.channels
       threads.inject (p=30) → 注入 ext.thread
       command.validate (p=35) → 验证 ext.command
       所有字段同时存在于最终 Ref 中
       签名覆盖所有 signed 字段（含 ext.command）
```

#### TC-2-INTERACT-003: content_type 升级完整链

```
GIVEN  M-003 (immutable)

WHEN   升级 immutable → mutable → collab

THEN   第一步: content_type = "mutable", content_id = uuid:...
       第二步: content_type = "collab", ACL doc 创建
       每步由原 author 执行
       降级不允许
```

#### TC-2-INTERACT-004: Agent 完整工作流

```
GIVEN  E-agent1 profile 已发布 (PF-002)
       R-alpha 启用了 mutable, watch, reply-to, channels, profile

WHEN   1. Relay discovery 找到 E-agent1（capability: code review）
       2. E-alice 邀请 E-agent1 进入 R-alpha
       3. E-alice 发送 M-003（代码审查请求，channel: code-review）
       4. E-agent1 在 M-003 上设置 watch (W-001)
       5. E-agent1 发送 mutable message M-REVIEW 作为审查结果
       6. E-alice 编辑 M-003（更新代码）
       7. E-alice 发送 M-FOLLOWUP (reply_to M-003)

THEN   步骤 4: watch annotation 写入 M-003
       步骤 5: M-REVIEW 是 mutable content
       步骤 6: E-agent1 收到 watch.ref_content_edited → 读取更新后 M-003 → 编辑 M-REVIEW
       步骤 7: E-agent1 收到 watch.ref_reply_added → 读取 M-FOLLOWUP → 编辑 M-REVIEW
```

#### TC-2-INTERACT-005: Level 0 + Level 2 Peer 共存

```
GIVEN  R-alpha 有 Level 2 Peer (E-alice) 和 Level 0 Peer (P-core-only)
       E-alice 发送消息带 ext.reply_to, ext.channels, ext.reactions, ext.annotations

WHEN   P-core-only 同步

THEN   P-core-only 保留所有 ext.* 字段
       P-core-only 不渲染 extension 数据
       P-core-only 发送的消息只有 core 字段
       E-alice 正常收到 P-core-only 的消息（没有 ext.* 也合法）
```

---


---


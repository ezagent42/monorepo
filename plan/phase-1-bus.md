# Phase 1: Bus 实现

> 从 implementation-plan.md §4 提取
> **版本**：0.9
> **目标**：Engine (4 组件) + Backend + Built-in (4 Datatypes) 协议核心可运行
> **预估周期**：3-4 周

---

### §4.1 Engine — Datatype Registry

#### TC-1-ENGINE-001: 注册 Built-in Datatype

```
GIVEN  Engine 启动

WHEN   注册 identity Datatype:
       { id: "identity", version: "0.1.0", dependencies: [],
         datatypes: [{ id: "entity_keypair", storage_type: "blob",
                       key_pattern: "ezagent/entity/@{entity_id}/identity/pubkey",
                       persistent: true, writer_rule: "signer == entity_id" }] }

THEN   Engine.registry.get("identity") 返回该 Datatype 定义
       Engine.registry.get("identity").dependencies == []
```

#### TC-1-ENGINE-002: Dependency Resolution 正序

```
GIVEN  Engine 注册了 identity, room, timeline, message

WHEN   请求加载顺序

THEN   加载顺序满足依赖约束：
       identity (deps:[]) 最先
       room (deps:[identity]) 在 identity 之后
       timeline (deps:[identity, room]) 在 room 之后
       message (deps:[identity, timeline]) 在 timeline 之后
```

#### TC-1-ENGINE-003: 循环依赖拒绝

```
GIVEN  Engine

WHEN   注册 Datatype A (deps:[B]) 和 B (deps:[A])

THEN   Engine MUST 拒绝加载，报错 "circular dependency detected: A → B → A"
```

#### TC-1-ENGINE-004: Extension 按 enabled_extensions 加载

```
GIVEN  R-alpha 的 enabled_extensions = ["mutable", "reactions", ...]
       R-empty 的 enabled_extensions = []

WHEN   Engine 为 R-alpha 加载 Datatypes
       Engine 为 R-empty 加载 Datatypes

THEN   R-alpha: Built-in (4) + 列出的 Extension 全部加载
       R-empty: 仅 Built-in (4) 加载，无 Extension
```

#### TC-1-ENGINE-005: Extension 依赖未满足拒绝

```
GIVEN  Room 的 enabled_extensions = ["collab"]
       但 "mutable" 不在列表中（collab depends on mutable）

WHEN   Engine 尝试加载

THEN   Engine MUST 拒绝加载 "collab"，报错 "dependency not met: collab requires mutable"
```

#### TC-1-ENGINE-006: 五种 storage_type 支持验证

```
GIVEN  Engine + Backend

WHEN   分别创建 storage_type 为 crdt_map, crdt_array, crdt_text, blob, ephemeral 的数据

THEN   每种类型成功创建
       crdt_* 类型支持 read/write/subscribe
       blob 类型支持 write-once + read
       ephemeral 类型支持 publish + subscribe
```

### §4.2 Engine — Hook Pipeline

#### TC-1-HOOK-001: Pre-send Hook 修改数据

```
GIVEN  一个 pre_send hook 注册在 timeline_index.insert，priority=30
       hook 逻辑：向 data 添加 ext.test_field = "injected"

WHEN   插入新 ref 到 timeline

THEN   写入 CRDT 的 ref 包含 ext.test_field = "injected"
```

#### TC-1-HOOK-002: Pre-send Hook 拒绝写入

```
GIVEN  room.check_room_write hook (priority=10)
       signer = E-outsider (不在 R-alpha 的 members 中)

WHEN   E-outsider 尝试向 R-alpha 的 timeline 写入

THEN   Hook 返回错误 "NOT_A_MEMBER"
       CRDT 不被修改
       后续 hook 不执行
```

#### TC-1-HOOK-003: Hook 执行顺序 — priority 排序

```
GIVEN  三个 pre_send hooks:
       hook_A (priority=30, source=ext-reactions)
       hook_B (priority=10, source=room)
       hook_C (priority=20, source=timeline)

WHEN   触发 pre_send 阶段

THEN   执行顺序: hook_B(10) → hook_C(20) → hook_A(30)
```

#### TC-1-HOOK-004: Hook 执行顺序 — 相同 priority 按依赖序

```
GIVEN  两个 pre_send hooks，均 priority=30:
       hook_X (source=reply-to, depends on timeline)
       hook_Y (source=channels, depends on timeline)
       reply-to 和 channels 无直接依赖关系

WHEN   触发 pre_send 阶段

THEN   hook_X 和 hook_Y 的执行顺序是确定性的
       （按 source id 字母序：channels < reply-to，所以 hook_Y 先执行）
```

#### TC-1-HOOK-005: After-write Hook 不可修改触发数据

```
GIVEN  after_write hook 尝试修改触发它的 timeline_index ref

WHEN   Hook 执行

THEN   修改操作被拒绝或抛出错误
       原始 ref 数据不变
```

#### TC-1-HOOK-006: After-write Hook 可写其他 Datatype

```
GIVEN  after_write hook (source=mutable)
       触发条件：mutable_content update
       逻辑：更新 timeline_index ref 的 status 为 "edited"

WHEN   mutable_content 被编辑

THEN   timeline ref 的 status 成功更新为 "edited"
       （写入的是 timeline_index，不是 mutable_content，所以合法）
```

#### TC-1-HOOK-007: After-read Hook 不可修改 CRDT

```
GIVEN  after_read hook 尝试修改 Y.Doc

WHEN   Hook 执行

THEN   修改操作被拒绝
       CRDT 数据不变
       API 响应 MAY 包含增强数据
```

#### TC-1-HOOK-008: Hook 失败处理 — pre_send

```
GIVEN  pre_send hook chain: [hook_A(ok), hook_B(error), hook_C]

WHEN   hook_B 返回错误

THEN   hook_C 不执行
       整个写入操作中止
       CRDT 不被修改
```

#### TC-1-HOOK-009: Hook 失败处理 — after_write

```
GIVEN  after_write hook chain: [hook_A(ok), hook_B(error), hook_C]

WHEN   hook_B 失败

THEN   已 apply 的 CRDT 数据不受影响
       hook_C 继续执行（after_write 失败不阻断链）
       错误被记录
```

#### TC-1-HOOK-010: Hook 失败处理 — after_read

```
GIVEN  after_read hook 失败

WHEN   API 请求读取数据

THEN   返回未增强的原始数据，而非报错
```

#### TC-1-HOOK-011: 全局 Hook 限制

```
GIVEN  一个 Extension Datatype 尝试注册 trigger.datatype = "*" 的 hook

WHEN   Engine 加载该 Extension

THEN   Engine MUST 拒绝注册，报错 "extensions cannot register global hooks"
```

### §4.3 Engine — Annotation Store

#### TC-1-ANNOT-001: Annotation 写入和读取

```
GIVEN  R-alpha, M-001 已写入 timeline
       E-bob 是 R-alpha 的 member

WHEN   E-bob 向 M-001 的 ext.annotations 写入:
       key = "note:@bob:relay-a.example.com"
       value = { "text": "Important message" }

THEN   读取 M-001 的 ext.annotations 包含该条目
       key 格式匹配 {type}:{entity_id}
```

#### TC-1-ANNOT-002: Annotation Key 格式验证

```
GIVEN  E-bob 尝试写入 annotation

WHEN   key = "note:@alice:relay-a.example.com"（entity_id 不是 signer）

THEN   写入被拒绝（annotation key 中 entity_id 必须等于 signer）
```

#### TC-1-ANNOT-003: Annotation 随宿主同步

```
GIVEN  P1 (E-alice) 在 M-001 上写入 annotation "tag:@alice:..."
       P2 (E-bob) 已同步 M-001

WHEN   P1 写入 annotation

THEN   P2 在 <2s 内收到 annotation 更新
       P2 读取 M-001.ext.annotations 包含 "tag:@alice:..."
```

#### TC-1-ANNOT-004: 未知 Annotation 保留

```
GIVEN  P1 (Level 2 Peer) 在 M-001 上写入 annotation "watch:@agent1:..."
       P2 (Level 0 Peer) 不支持 Watch extension

WHEN   P2 同步到 M-001

THEN   P2 保留 "watch:@agent1:..." annotation，不删除
       P2 修改 M-001 的 core 字段时，annotation 不丢失
```

#### TC-1-ANNOT-005: Annotation 只能删除自己的

```
GIVEN  M-001 有 annotation "note:@bob:relay-a.example.com"

WHEN   E-alice 尝试删除该 annotation

THEN   操作被拒绝（只有 @bob 可以删除 key 含 @bob 的 annotation）
```

### §4.4 Engine — Index Builder

#### TC-1-INDEX-001: on_change Index 自动更新

```
GIVEN  timeline_view index (refresh=on_change) 已初始化

WHEN   新 ref 插入 timeline

THEN   Index 在 <1s 内反映新 ref
```

#### TC-1-INDEX-002: on_demand Index 实时计算

```
GIVEN  single_ref index (refresh=on_demand)

WHEN   API 请求 GET /rooms/R-alpha/messages/{M-001.ref_id}

THEN   响应基于当前 CRDT 状态实时计算
```

#### TC-1-INDEX-003: Index 到 Operation 映射

```
GIVEN  timeline_view index 的 operation_id = "timeline.list"

WHEN   Engine 启动

THEN   Python SDK 中 bus.rooms[room_id].messages.list() 方法可用
```

### §4.5 Backend — Sync Protocol

#### TC-1-SYNC-001: Initial Sync with State Vector

```
GIVEN  RELAY-A 持有 R-alpha 的 room_config doc（含多次 update）
       新 Peer P3 有空的本地 state

WHEN   P3 向 ezagent/room/R-alpha/config/state 发起 query，携带空 state vector

THEN   RELAY-A 回复完整 state
       P3 apply 后，本地 room_config 与 RELAY-A 一致
```

#### TC-1-SYNC-002: Initial Sync with Existing State（差量）

```
GIVEN  P1 已同步 R-alpha 的 room_config 到 version V5
       RELAY-A 已有 V5 之后的 updates (V6, V7)

WHEN   P1 断线重连，携带 V5 的 state vector 发起 query

THEN   RELAY-A 回复 V6+V7 的差量 updates（不是完整 state）
       P1 apply 后到达 V7
```

#### TC-1-SYNC-003: Live Sync Pub/Sub

```
GIVEN  P1, P2 均已完成 initial sync

WHEN   P1 写入 update，封装为 Signed Envelope，publish 到 .../updates

THEN   P2 在 <1s 内收到并 apply
```

#### TC-1-SYNC-004: 断线恢复 — Pending Updates

```
GIVEN  P1 断线期间本地写入 3 个 updates

WHEN   P1 重连

THEN   P1 先通过 initial sync 获取缺失的远端 updates
       然后 publish 自己的 3 个 pending updates
       所有 Peer 最终一致
```

#### TC-1-SYNC-005: 因果序保证

```
GIVEN  P1 依次发送 update_A 和 update_B（A 在 B 之前）

WHEN   P2 接收

THEN   P2 按 A → B 顺序 apply（不乱序）
```

#### TC-1-SYNC-006: Peer Queryable 注册验证

```
GIVEN  P1 已完成 initial sync，持有 R-alpha 的完整 room_config doc

WHEN   P1 启动完成

THEN   P1 对 ezagent/room/R-alpha/config/state 注册了 Zenoh queryable
       新 Peer P3 向该路径发起 query 时，P1 回复完整 state
       回复的 state 与 P1 本地存储一致
```

#### TC-1-SYNC-007: Multi-Source Query 选择

```
GIVEN  P1 持有 R-alpha 的 state（version V5）
       RELAY-A 持有 R-alpha 的 state（version V7）
       P3 新启动，可同时到达 P1 和 RELAY-A

WHEN   P3 发起 initial sync query

THEN   P3 收到来自 P1 和 RELAY-A 的两个回复
       P3 选择 state vector 更完整的回复（V7）
       P3 最终 state 与 RELAY-A 一致
```

### §4.6 Backend — Signed Envelope

#### TC-1-SIGN-001: 正常签名和验证

```
GIVEN  E-alice 的 keypair
       Payload = 一个 yrs update

WHEN   构造 Signed Envelope:
       version=1, signer_id="@alice:relay-a.example.com",
       doc_id="ezagent/room/R-alpha/config", timestamp=now,
       payload=update_bytes, signature=sign(all_above, alice_privkey)

THEN   验证通过：verify(signature, alice_pubkey, all_fields_before_sig) == true
```

#### TC-1-SIGN-002: 签名验证失败 — 伪造 payload

```
GIVEN  E-mallory 用自己的 keypair 签名
       但 signer_id 写成 "@alice:relay-a.example.com"

WHEN   P2 收到并验证

THEN   verify(signature, alice_pubkey, ...) == false
       Update 被丢弃，不 apply
```

#### TC-1-SIGN-003: 签名验证失败 — 时间戳偏差

```
GIVEN  Signed Envelope 的 timestamp 比接收方本地时间早 10 分钟

WHEN   P2 验证

THEN   因为偏差 > 5 分钟，Envelope 被丢弃
```

#### TC-1-SIGN-004: Binary Layout 正确性

```
GIVEN  手动构造 Signed Envelope binary

WHEN   解析各字段

THEN   version = offset 0, 1 byte
       signer_id_len = offset 1, 2 bytes big-endian
       signer_id = offset 3, var bytes
       doc_id_len, doc_id, timestamp(8 bytes), payload_len(4 bytes), payload, signature(64 bytes)
       所有字段正确解析
```

### §4.7 Backend — Persistence

#### TC-1-PERSIST-001: 本地持久化 — 进程重启

```
GIVEN  P1 写入 M-001 到 R-alpha 的 timeline

WHEN   P1 进程重启

THEN   P1 从本地存储恢复 timeline，包含 M-001
       P1 通过 initial sync 补齐差量
```

#### TC-1-PERSIST-002: Pending Updates 持久化

```
GIVEN  P1 断线，本地写入 M-002

WHEN   P1 进程重启（断线期间的 updates 未发送）

THEN   P1 恢复 pending updates
       重连后 publish 这些 updates
```

#### TC-1-PERSIST-003: Relay State Snapshot

```
GIVEN  RELAY-A 已累积 200 次 update 对 R-alpha 的 config doc

WHEN   RELAY-A 执行 state snapshot 合并

THEN   新 Peer 发起 initial sync 时，收到单一 state snapshot（不是 200 个 updates）
```

#### TC-1-PERSIST-004: Ephemeral 不持久化

```
GIVEN  P1 写入 ephemeral 数据（presence token）

WHEN   RELAY-A 重启

THEN   Ephemeral 数据不存在（重启后丢失）
```

### §4.8 Built-in — Identity

#### TC-1-IDENT-001: Entity ID 格式验证

```
GIVEN  以下 Entity ID 字符串

WHEN   验证格式

THEN
  "@alice:relay-a.example.com"        → 合法
  "@code-reviewer:relay-a.example.com" → 合法
  "@a:b.c"                            → 合法（最短合法）
  "alice:relay-a.example.com"         → 不合法（缺少 @）
  "@Alice:relay-a.example.com"        → 不合法（大写字母）
  "@:relay-a.example.com"             → 不合法（local_part 为空）
  "@alice:"                           → 不合法（relay_domain 为空）
  "@alice:RELAY.COM"                  → 不合法（大写字母）
  "@alice:relay a.com"                → 不合法（空格）
```

#### TC-1-IDENT-002: Ed25519 密钥对生成

```
GIVEN  新 Entity E-alice 初始化

WHEN   生成 keypair

THEN   私钥 32 字节，公钥 32 字节
       sign(message, privkey) → 64 字节签名
       verify(signature, pubkey, message) == true
```

#### TC-1-IDENT-003: 签名 Hook 是 Pre-send 最终步骤

```
GIVEN  Pre_send hook chain:
       [room.check(p=10), timeline.generate(p=20), reply_to.inject(p=30), identity.sign(p=0)]

WHEN   执行 pre_send 阶段

THEN   identity.sign 尽管 priority=0，实际签名在最后执行
       签名覆盖所有 hook 注入的字段
```

#### TC-1-IDENT-004: 验证 Hook 是 After-write 最先步骤

```
GIVEN  After_write hook chain:
       [identity.verify(p=0), timeline.detect(p=30), watch.check(p=45)]

WHEN   收到入站 update

THEN   identity.verify 最先执行
       签名验证失败 → timeline.detect 和 watch.check 不执行
```

#### TC-1-IDENT-005: 身份注册流程

```
GIVEN  新用户 E-alice 尚未注册
       Public Relay RELAY-A 在 tls/relay-a.example.com:7448 运行

WHEN   执行 ezagent.init(relay="relay-a.example.com", name="alice")

THEN   生成 Ed25519 keypair
       通过 TLS 连接到 RELAY-A（验证 TLS 证书）
       向 RELAY-A 发送注册请求 {name: "alice", public_key: <32 bytes>}
       RELAY-A 返回 entity_id = "@alice:relay-a.example.com"
       本地持久化 identity.key 和 config.toml
       config.toml 包含 [relay] endpoint 和 [identity] entity_id
```

#### TC-1-IDENT-006: 注册名唯一性验证

```
GIVEN  "@alice:relay-a.example.com" 已被注册

WHEN   另一用户尝试 ezagent.init(relay="relay-a.example.com", name="alice")

THEN   RELAY-A 返回错误 "name already taken"
       不生成本地 identity 文件
```

#### TC-1-IDENT-007: P2P 身份验证（公钥已缓存）

```
GIVEN  P1 (E-bob) 本地已缓存 E-alice 的公钥
       P2 (E-alice) 在 LAN 上声称为 "@alice:relay-a.example.com"

WHEN   P1 向 P2 发送 challenge (随机 nonce)
       P2 用私钥签名 nonce 并返回

THEN   P1 用缓存的公钥验证签名成功
       P1 信任 P2 为 E-alice
       无需联系 Relay
```

#### TC-1-IDENT-008: P2P 身份验证（公钥未缓存，需查询 Relay）

```
GIVEN  P1 (E-bob) 本地无 E-alice 的公钥缓存
       P2 (E-alice) 在 LAN 上声称为 "@alice:relay-a.example.com"
       RELAY-A 可达

WHEN   P1 向 RELAY-A 查询 @alice 的公钥
       RELAY-A 返回公钥
       P1 向 P2 发送 challenge
       P2 签名返回

THEN   P1 验证签名成功
       P1 缓存 E-alice 的公钥
       后续验证无需联系 Relay
```

### §4.9 Built-in — Room

#### TC-1-ROOM-001: Room 创建

```
GIVEN  E-alice 要创建 Room

WHEN   POST /rooms { name: "Project Alpha", policy: "invite" }

THEN   生成 UUIDv7 作为 room_id
       创建 room_config doc:
         created_by = E-alice, membership.members = {E-alice: "owner"}
         relays = [{endpoint: RELAY-A, role: "primary"}]
         enabled_extensions = []
       创建当前月份的 timeline_index doc
       返回 201 Created，包含 room_id
```

#### TC-1-ROOM-002: Room 加入 — Invite Policy

```
GIVEN  R-alpha (policy=invite), E-carol 不在 members 中

WHEN   E-alice (owner) 执行 POST /rooms/R-alpha/invite { entity_id: E-carol }

THEN   R-alpha.membership.members 新增 E-carol: "member"
       SSE: room.member.joined { room_id: R-alpha, entity_id: E-carol, role: "member" }
```

#### TC-1-ROOM-003: Room 加入 — 非成员邀请被拒

```
GIVEN  R-alpha (policy=invite), E-outsider 不在 members 中

WHEN   E-outsider 尝试执行 invite

THEN   被 check_room_write hook 拒绝: "NOT_A_MEMBER"
```

#### TC-1-ROOM-004: Room Config 修改权限

```
GIVEN  R-alpha, E-bob.power_level = 0, power_levels.admin = 100

WHEN   E-bob 尝试 PUT /rooms/R-alpha/config { name: "New Name" }

THEN   被 check_config_permission hook 拒绝: "PERMISSION_DENIED"
       power_level 0 < admin 100
```

#### TC-1-ROOM-005: Room 退出

```
GIVEN  R-alpha, E-bob 是 member

WHEN   E-bob 执行 POST /rooms/R-alpha/leave

THEN   E-bob 从 membership.members 中移除
       SSE: room.member.left { room_id: R-alpha, entity_id: E-bob }
```

#### TC-1-ROOM-006: Room 踢出 — 权限不足

```
GIVEN  R-alpha, E-bob (power_level=0) 尝试踢出 E-agent1 (power_level=0)

WHEN   E-bob 尝试从 members 删除 E-agent1

THEN   被拒绝：power_level 必须严格高于被踢者
       0 > 0 为 false → 拒绝
```

#### TC-1-ROOM-007: Room 踢出 — 权限足够

```
GIVEN  R-alpha, E-alice (power_level=100) 踢出 E-bob (power_level=0)

WHEN   E-alice 从 members 删除 E-bob

THEN   操作成功，E-bob 被移除
       SSE: room.member.left
```

#### TC-1-ROOM-008: enabled_extensions 变更触发加载

```
GIVEN  R-empty 的 enabled_extensions = []

WHEN   E-alice 更新 R-empty 的 enabled_extensions 为 ["mutable"]

THEN   extension_loader hook 触发
       mutable Extension 的 hooks 被注册到 R-empty 的 hook pipeline
```

#### TC-1-ROOM-009: Extension 禁用后数据保留

```
GIVEN  R-alpha 有 ext.reactions 数据（M-001 上有 RX-001）

WHEN   E-alice 从 enabled_extensions 中移除 "reactions"

THEN   reactions 的 hooks 停止执行
       但 M-001.ext.reactions 中的数据 MUST 保留，不删除
```

### §4.10 Built-in — Timeline

#### TC-1-TL-001: 发送消息 — 完整 Ref 生成

```
GIVEN  R-alpha, E-alice
       使用验证数据 M-001

WHEN   POST /rooms/R-alpha/messages { body: "Hello...", format: "text/plain" }

THEN   生成 Ref:
       ref_id = ULID（单调递增）
       author = "@alice:relay-a.example.com"
       content_type = "immutable"
       content_id = sha256(canonical_json(content))
       status = "active"
       signature = ed25519 签名覆盖以上 core 字段
```

#### TC-1-TL-002: Ref 排序 — CRDT 顺序

```
GIVEN  P1 和 P2 各发一条消息（并发）

WHEN   两端同步

THEN   两端看到相同的 Ref 顺序（YATA 决定）
       顺序不依赖 created_at
```

#### TC-1-TL-003: 时间窗口分片

```
GIVEN  当前 UTC 月份 = 2026-02

WHEN   E-alice 发送 M-001

THEN   M-001 的 ref 写入 ezagent/room/R-alpha/index/2026-02/updates
```

#### TC-1-TL-004: 旧窗口 ext.* 更新仍允许

```
GIVEN  M-001 在 2026-02 窗口
       当前月份变为 2026-03

WHEN   E-bob 在 M-001 上添加 reaction（更新 ext.reactions）

THEN   2026-02 窗口的 index doc 接受此 ext.* 更新
```

#### TC-1-TL-005: 消息删除

```
GIVEN  R-alpha, M-DEL 由 E-alice 发送

WHEN   E-alice 执行 DELETE /rooms/R-alpha/messages/{M-DEL.ref_id}

THEN   M-DEL.ref.status → "deleted_by_author"
       M-DEL.ref.content_id MAY 被清除
       Ref 不从 crdt_array 物理移除
       SSE: message.deleted { room_id: R-alpha, ref_id: M-DEL.ref_id }
```

#### TC-1-TL-006: 非作者不能删除

```
GIVEN  M-001 由 E-alice 发送

WHEN   E-bob 尝试 DELETE /rooms/R-alpha/messages/{M-001.ref_id}

THEN   拒绝：writer_rule "ref.author == signer" 不满足
```

#### TC-1-TL-007: ext.* 字段保留

```
GIVEN  M-001 有 ext.reactions = {"👍:@bob:...": 1234}
       P2 是 Level 0 Peer（不支持 reactions）

WHEN   P2 同步到 M-001

THEN   P2 保留 ext.reactions 字段
       P2 更新 M-001 的 status 时，ext.reactions 不丢失
```

#### TC-1-TL-008: Timeline Pagination

```
GIVEN  R-alpha 有 M-001 到 M-004 四条消息

WHEN   GET /rooms/R-alpha/messages?limit=2

THEN   返回最新 2 条 (M-003, M-004 按 CRDT 顺序)
       包含 cursor 用于翻页

WHEN   GET /rooms/R-alpha/messages?limit=2&before={cursor}

THEN   返回前 2 条 (M-001, M-002)
```

### §4.11 Built-in — Message

#### TC-1-MSG-001: Immutable Content Hash 验证

```
GIVEN  M-001 的 content:
       { type: "immutable", author: "@alice:...", body: "Hello...",
         format: "text/plain", media_refs: [], created_at: "..." }

WHEN   计算 content_id

THEN   content_id = sha256(canonical_json(content_without_signature))
       验证：hash(content) == content_id → true
```

#### TC-1-MSG-002: Content 篡改检测

```
GIVEN  M-001 的 Content Object 被篡改（body 被修改）

WHEN   验证 hash

THEN   hash(tampered_content) != content_id → 验证失败
       Content 被拒绝
```

#### TC-1-MSG-003: Content Author 一致性

```
GIVEN  Ref.author = "@alice:..." 但 Content.author = "@bob:..."

WHEN   validate_content_ref hook 执行

THEN   验证失败：author 不一致
       写入被拒绝
```

#### TC-1-MSG-004: 未知 content_type 处理

```
GIVEN  P2 (Level 0 Peer) 收到 Ref:
       content_type = "mutable"（P2 不支持）

WHEN   P2 读取此 Ref

THEN   P2 保留 Ref 所有字段
       API 响应中 content_type = "mutable"
       UI SHOULD 显示 "此消息类型不支持"
```

#### TC-1-MSG-005: After-read Content Resolution

```
GIVEN  M-001 的 Ref (content_id = "sha256:...")
       Content Object 存储在 ezagent/room/R-alpha/content/{hash}

WHEN   GET /rooms/R-alpha/messages/{M-001.ref_id}

THEN   响应包含 ref 字段 + content body
       即 resolve_content hook 将 content_id 解析为实际内容
```

### §4.12 API Surface (Bus)

#### TC-1-API-001: Engine Operation 覆盖率

```
GIVEN  Bus 实现启动，Engine 已注册所有 Built-in Datatypes

WHEN   遍历 operation_id 清单

THEN   以下 Operations 全部可通过 Python SDK 调用：
       identity.init
       identity.whoami
       identity.get_pubkey
       room.create / room.list / room.get / room.update_config
       room.join / room.leave / room.invite / room.members
       timeline.list / timeline.get_ref
       message.send / message.delete
       annotation.list / annotation.add / annotation.remove
       events.stream
       status
```

#### TC-1-API-002: Event Stream 覆盖率

```
GIVEN  E-alice 通过 async for event in bus.events(rooms=[R-alpha]) 监听

WHEN   E-bob 在 R-alpha 发送消息
       E-alice 删除 M-DEL
       E-carol 被邀请进 R-alpha
       E-carol 离开 R-alpha

THEN   E-alice 依次收到:
       Event(type="message.new", room_id=R-alpha, author=E-bob)
       Event(type="message.deleted", room_id=R-alpha, ref_id=M-DEL.ref_id)
       Event(type="room.member.joined", room_id=R-alpha, entity_id=E-carol)
       Event(type="room.member.left", room_id=R-alpha, entity_id=E-carol)
```

#### TC-1-API-003: Event Stream 断线恢复

```
GIVEN  E-alice 已收到 events cursor=105，然后断线

WHEN   E-alice 重连: async for event in bus.events(cursor=105)

THEN   从 cursor=106 开始推送
       不重复 105 及之前的事件
```

#### TC-1-API-004: 错误处理

```
GIVEN  E-outsider 不是 R-alpha 成员

WHEN   await bus.rooms[R-alpha].messages.list()

THEN   raise ezagent.NotAMemberError(room_id=R-alpha)
```

#### TC-1-API-005: Extension 未启用错误

```
GIVEN  R-empty 的 enabled_extensions = []

WHEN   await bus.rooms[R-empty].messages[ref_id].reactions.add("👍")

THEN   raise ezagent.ExtensionDisabledError(
           extension="reactions", room_id=R-empty)
```

---


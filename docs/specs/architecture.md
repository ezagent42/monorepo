# ezagent Protocol v0.8 — 基于 CRDT 的即时通信与协作协议

> **ezagent** — Easy Agent Communication Protocol
>
> A CRDT-based messaging protocol where humans and agents are indistinguishable by design.

> **状态**：Architecture Overview Draft
> **日期**：2026-02-27（rev.11：文件名 protocol.md → architecture.md）
> **作者**：Allen & Claude collaborative design
> **目标读者**：协议实现者、架构评审者
> **备注**：本文件从 `specs/protocol.md` 重命名为 `specs/architecture.md`，以避免与 `ezagent-protocol` crate 混淆。

---

## 0. 设计哲学

ezagent（Easy Agent Communication Protocol）是一个基于 CRDT 的即时通信协议。

**Entity-Agnostic。** 协议不区分 human 和 agent——只要持有 Ed25519 keypair，你就是一个 entity，享有完全相同的身份、权限和消息能力。

**一切皆 Datatype。** 协议的核心是一个 Engine，由四个组件构成：Datatype Registry、Hook Pipeline、Annotation Pattern、Index Builder。所有功能——无论是"内置"的 Identity/Room/Timeline/Message，还是"扩展"的 Reactions/Channels/Moderation——都是同一个 Engine 的实例，用完全相同的声明格式描述。内置与扩展的区别仅在于依赖顺序，不在于机制。

**Hook + Annotation 驱动。** 每个 Datatype 通过 Hook 定义"什么时候执行什么逻辑"，通过 Annotation 在已有数据结构上附加信息，通过 Index 对外暴露查询能力。Discovery（用户发现）、Watch（上下文订阅）、Link Preview、@Mention 等功能都不是独立的协议概念，而是 Hook + Annotation 的具体应用模式。

**Relay 是可选服务，CRDT 是真相源。** 每个 ezagent 实例是一个自给自足的节点，内嵌 Zenoh peer 和本地持久化。Public Relay 提供跨网络桥接、离线恢复和实体发现等可选增值服务，但不是运行的必要条件。

**P2P-First。** 同网段的 ezagent 实例通过 Zenoh multicast scouting 自动发现并直连通信，无需经过任何中心化服务。Public Relay 仅在跨网络场景下作为桥接使用。这使得 human-agent 协作的高频通信保持本地化，极大降低了延迟和服务端负担。

**单写入者是默认，多写入者是升级。** 协议以单写入者为基础态，将多人协作视为显式升级操作。

**存储/同步后端可替换。** Yjs（yrs）和 Zenoh 是参考实现的后端选择，不是协议的一部分。Engine 通过 Storage/Sync Backend 抽象与它们交互。未来可替换为 Automerge + libp2p 等其他组合，Engine 层不受影响。

**Bus-as-Runtime。** 参考实现将 Engine 编译为 Python native extension（通过 PyO3），以 `pip install ezagent` 方式安装。Engine 在 Python 进程内直接运行，Socialware / Agent / CLI / HTTP server 均通过 Python API 与 Engine 交互，零 IPC 开销。PyO3 是 Engine 的**唯一外部接口**。所有面向用户的界面（CLI、HTTP、Desktop App）均在 Python 层实现，不属于协议规范的一部分。协议定义 Engine Operations（"做什么"），Python 层决定如何暴露。桌面应用通过内嵌 Python runtime 实现，终端用户无需安装 Python 环境，可通过 brew install / DMG 一步安装。

**Self-Sufficient Node。** 每个 ezagent 实例内嵌 Zenoh peer（含本地 RocksDB 持久化），是一个完整的网络节点。实例启动后通过 multicast scouting 自动发现同网段的其他 ezagent 并建立 P2P 直连。首次使用需要向一个 Public Relay 注册身份（一次性操作，几秒完成），之后可完全离线运行。

---

## 1. 架构总览

### 1.1 三层架构

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Engine Operations                                  │
│  (通过 PyO3 暴露为 Python async API)                          │
│                                                              │
│  ┌─ ezagent-py ──────────────────────────────────────────┐  │
│  │  Bus API: rooms / messages / timeline / annotations    │  │
│  │  Extension API: 从声明格式自动生成                       │  │
│  │  Event Stream: async iterator                          │  │
│  │  Socialware Hook: @when DSL (auto-generates @hook)      │  │
│  └────────────────────────────────────────────────────────┘  │
│                       ↕ PyO3 direct call                     │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Extension Datatypes (按 room.enabled_extensions)  │
│                                                             │
│  Mutable · Collab · Reactions · Reply To · Channels ·       │
│  Cross-Room Ref · Moderation · Read Receipts · Presence ·   │
│  Media · Threads · Drafts · Profile · Watch                 │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Built-in Datatypes (always enabled)               │
│                                                             │
│  Identity       Room          Timeline        Message       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Layer 0: ezagent.bus Engine                                │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌─────────┐     │
│  │ Datatype │ │   Hook   │ │ Annotation │ │  Index  │     │
│  │ Registry │ │ Pipeline │ │   Store    │ │ Builder │     │
│  └────┬─────┘ └────┬─────┘ └─────┬──────┘ └────┬────┘     │
│       └─────────────┴──────┬──────┴─────────────┘           │
│                            ▼                                │
│              ┌──────────────────────────┐                   │
│              │  Storage / Sync Backend  │                   │
│              │   yrs (CRDT) + Zenoh     │                   │
│              └──────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘

注：CLI / HTTP Server / Desktop App 在 Python 层实现，
   不属于协议架构层。
```

**Layer 0 — ezagent.bus Engine**：协议的核心抽象。定义了 Datatype、Hook、Annotation、Index 四个组件和它们的交互规则。所有上层功能都是 Engine 的实例。Storage/Sync Backend（yrs + Zenoh）是 Engine 的可替换底层。

**Layer 1 — Built-in Datatypes**：Identity、Room、Timeline、Message。它们 always enabled，不可禁用。它们之所以"内置"不是因为机制不同，而是因为：(a) 它们的 hook 作用范围是全局的（如 Identity 的签名验证），(b) 其他所有 datatype 依赖它们。

**Layer 2 — Extension Datatypes**：15 个扩展功能。按 room 的 `enabled_extensions` 加载。与 Layer 1 使用完全相同的声明格式。

**Layer 3 — Engine Operations**：由 Engine 的 Index Builder 自动导出操作清单。通过 PyO3 暴露为 Python async API。CLI、HTTP Server、Desktop App 等面向用户的界面在 Python 层基于此 API 实现，不属于协议规范。

### 1.2 双层数据模型

Layer 1 的 Timeline 和 Message 构成双层数据模型：

**Layer 1 — Timeline Index**：每个 Room 有一组按时间窗口分片的 index doc（Y.Array<Y.Map>），每条消息表现为一条 ref（引用），YATA 算法确定全局顺序。

**Layer 2 — Content Objects**：实际的消息内容。Bus 只定义 immutable 类型，extension 注册 mutable/collab/blob。

两层之间的关系是**索引与内容分离**。Layer 1 回答"发生了什么、按什么顺序"，layer 2 回答"具体内容是什么"。

### 1.3 网络拓扑

ezagent 采用 **P2P-First** 网络拓扑。每个实例内嵌 Zenoh peer，通过 multicast scouting 自动发现同网段节点并建立直连。Public Relay 仅在跨网络场景下作为桥接和持久化服务。

**模式 A：Standalone / LAN Mesh（最常用）**

```
  ┌─── 同一 LAN / localhost ──────────────────────────┐
  │                                                     │
  │  Alice:7447 ◄══ scouting ══► Bob:7447              │
  │      ▲          (自动发现)        ▲                 │
  │      │                            │                 │
  │      ╚════════════════════════════╣                 │
  │      ▼                            ▼                 │
  │  Agent1:7447 ◄═══════════► Agent2:7447             │
  │                                                     │
  │  · 零配置，multicast scouting 自动发现              │
  │  · 所有流量 P2P 直连                                │
  │  · 无需 Public Relay                                │
  └─────────────────────────────────────────────────────┘
```

**模式 B：Hybrid（跨网络，需 Public Relay 桥接）**

```
  ┌─ 办公室 A ─────────┐        ┌─ 办公室 B ─────────┐
  │ Alice ◄══► Agent1  │        │ Bob ◄══► Agent2    │
  │ (LAN P2P 直连)     │        │ (LAN P2P 直连)     │
  └────────┬───────────┘        └────────┬────────────┘
           │                             │
           └──► Public Relay ◄───────────┘
               relay.ezagent.dev
               (NAT bridge + cold storage + discovery)
  
  · 同 LAN 内仍为 P2P 直连
  · 跨网段通过 Public Relay 桥接
  · Relay 只处理跨网段流量
```

每个 peer 内部运行 Rust Engine（通过 PyO3 嵌入 Python 进程），内含 Zenoh peer（scouting + gossip enabled）和本地 RocksDB 持久化。Desktop App 和 Agent 都是自给自足的 peer，地位平等。Human peer 和 Agent peer 通过 Zenoh CRDT 协议互通——优先 P2P 直连，按需经 Public Relay 中转。

### 1.4 身份与信任模型

Entity ID 格式为 `@{local_part}:{relay_domain}`。relay_domain 是 **身份命名空间**（identity namespace），不是网络地址。Entity 可能在任何网络位置（P2P 直连或经 Relay），但其 ID 始终不变。

**首次注册**：用户必须向一个 Public Relay 注册身份（一次性操作）。Relay 通过 TLS 证书证明自身真实性（公网使用 Let's Encrypt / WebPKI，本地开发使用 mkcert 自签 CA），并存储 entity_id → public_key 映射。

**P2P 身份验证**：当 Bob 在 LAN 上发现一个声称为 `@alice:relay.ezagent.dev` 的 peer 时，Bob 向 `relay.ezagent.dev` 查询 Alice 的公钥，并通过 challenge-response 验证该 peer 确实持有对应私钥。已验证的公钥在本地缓存，后续验证无需联系 Relay。

**信任链**：Entity ID → Relay 域名 → TLS 证书（WebPKI 或自定义 CA）。与 Matrix 的 `@user:homeserver` 信任模型同构。

---

## 2. ezagent.bus Engine（Layer 0）

Engine 是协议的核心抽象，由四个组件构成。所有功能（built-in 和 extension）都通过这四个组件声明和执行。

### 2.1 Datatype Registry

Datatype 是 Engine 中数据的基本单元。每个 Datatype 声明一种可存储、可同步的数据结构。

```yaml
Datatype:
  id:              string        # 全局唯一标识
  storage_type:    enum          # crdt_map | crdt_array | crdt_text | blob | ephemeral
  key_pattern:     string        # 存储路径模板（映射到 Zenoh key expression）
  persistent:      boolean       # 是否需要持久化
  writer_rule:     WriterRule    # 写入权限规则
  dependencies:    string[]      # 依赖的其他 datatype ID
```

**storage_type 枚举**：

| 类型 | 后端映射 | CRDT | 持久化 | 用途 |
|------|---------|------|--------|------|
| `crdt_map` | Y.Map | 是 | 是 | Room Config, Content Doc |
| `crdt_array` | Y.Array<Y.Map> | 是 | 是 | Timeline Index |
| `crdt_text` | Y.Text | 是 | 是 | Message body |
| `blob` | Raw bytes | 否 | 是 | Immutable content, Media |
| `ephemeral` | Pub/Sub | 否 | 否 | Presence, Awareness |

**key_pattern 语法**：

```
ezagent/{room_id}/config/{state|updates}          # Room Config
ezagent/{room_id}/index/{shard_id}/{state|updates}  # Timeline Index
ezagent/{room_id}/content/{id}/{state|updates}     # Mutable/Collab Content
ezagent/{room_id}/content/{id}/acl/{state|updates} # Collab ACL
ezagent/blob/{hash}                                   # Global Blob (immutable)
ezagent/{room_id}/ext/{ext_id}/{state|updates}     # Extension docs
ezagent/{room_id}/ephemeral/{ext_id}/@{entity_id}  # Ephemeral
ezagent/@{entity_id}/identity/pubkey               # Identity
ezagent/@{entity_id}/ext/profile/{state|updates}   # Profile
```

每个 CRDT datatype 在 key space 中占两个 key：`state`（完整状态，initial sync）和 `updates`（增量更新，live sync）。

**writer_rule 语法**：

```
"signer == entity_id"                  # 自己的数据
"signer ∈ room.members"               # 房间成员
"signer.power_level >= admin"          # 管理员
"signer == ref.author"                 # 消息作者
"signer ∈ acl.editors"                # ACL 编辑者
"annotation_key contains signer_id"    # annotation 自身标识
```

**Dependency Resolution**：Engine 按依赖顺序加载 datatype。无依赖的先加载，有依赖的后加载。循环依赖不允许。

```
Identity (deps: [])
  → Room (deps: [identity])
    → Timeline (deps: [identity, room])
    → Message (deps: [identity, timeline])
      → Mutable (deps: [message])
        → Collab (deps: [mutable, room])
```

### 2.2 Hook Pipeline

Hook 定义了"什么时机执行什么逻辑"。三个阶段，每个阶段有严格的约束。

```yaml
Hook:
  id:              string        # 全局唯一
  phase:           enum          # pre_send | after_write | after_read
  trigger:
    datatype:      string        # 监听哪个 datatype（"*" = 全部）
    event:         enum          # insert | update | delete | any
    filter:        string | null # 可选过滤表达式
  priority:        number        # 执行顺序（0 最先，数字越大越晚）
  source:          string        # 注册此 hook 的 datatype / extension ID
```

**三个阶段**：

```
API request → ┌─────────────┐ → 签名 → CRDT write → ┌──────────────┐
              │  PRE_SEND   │                        │ AFTER_WRITE  │
              │  hooks      │                        │ hooks        │
              └─────────────┘                        └──────────────┘
                                                            │
API response ← ┌─────────────┐ ← CRDT read ←───────────────┘
               │ AFTER_READ  │
               │ hooks       │
               └─────────────┘
```

**Pre-send**：在数据写入 CRDT 之前、签名之前执行。

| 可以做 | 不可以做 |
|--------|---------|
| 修改待写入的数据 | 读取尚未写入的数据 |
| 添加 annotation | 发起网络请求（应异步） |
| 拒绝写入（返回错误） | |
| 注入 ext.* 字段 | |

**After-write**：在数据已 apply 到本地 CRDT 之后、签名验证之后执行。

| 可以做 | 不可以做 |
|--------|---------|
| 生成通知 / 事件 | 修改触发 hook 的那个数据 |
| 更新 Index | 拒绝已 apply 的数据 |
| 写入**其他** datatype | |
| 触发异步任务 | |

**After-read**：在从 CRDT 读取数据后、API 响应之前执行。

| 可以做 | 不可以做 |
|--------|---------|
| 变换 / 增强 API 响应 | 修改 CRDT 数据 |
| 利用 annotation 渲染 | 阻塞过长时间 |
| 异步回写 annotation | |
| 聚合多个 datatype 的数据 | |

**执行顺序**：同一阶段内，先按 `priority` 排序（数字小的先执行），再按 datatype dependency 顺序执行。Identity 的 hook（priority: 0）总是最先执行。

**全局 Hook vs 局部 Hook**：`trigger.datatype: "*"` 表示全局 hook，拦截所有 datatype 的操作。只有 built-in datatype 允许注册全局 hook。Extension 的 hook 只能注册在具体的 datatype 上。

### 2.3 Annotation（设计模式）

Annotation 是"在已有数据节点上附加结构化信息"的设计模式。它是 Engine 四原语之一，但不是独立的存储位置或命名空间。

Annotation 通过以下方式实现：

- **Extension** 在 ref / room_config 的 `ext.{ext_id}` 命名空间中写入数据
- **Socialware** 不直接写 Annotation；通过发送特定 content_type 的 Message 表达状态，运行时状态由 Socialware Runtime 从 Message 序列纯派生（EXT-17 Runtime 提供协议层支持）
- **Built-in Hook** 在 ref 的 Bus 字段中写入数据

```yaml
# 一条 ref (Y.Map) 上的 extension 数据（Annotation Pattern 的物理实现）
ref Y.Map:
  ref_id: "ulid:..."                                   # Bus 字段
  author: "@alice:..."                                  # Bus 字段
  ...
  ext.reactions: Y.Map { ... }                         # EXT-03 管理
  ext.channels: { ... }                                # EXT-06 管理
  ext.link-preview: Y.Map { ... }                      # EXT-16 管理
  ext.watch: Y.Map {                                   # EXT-14 管理
    "@agent-1:relay-a.com":
      { reason: "processing_task", on_reply: true }
  }
  ext.command: { ... }                                 # EXT-15 管理
```

**Annotation Key 约定**：当多个 Entity 在同一 `ext.{ext_id}` 命名空间内写入数据时，key SHOULD 包含 entity_id 以避免冲突。`@system:local` 是 Engine 内部 Hook 系统的保留 ID。

**所有 `ext.*` 命名空间由对应 Extension 管理**，各有自己的 `writer_rule`：

```
ext.reactions     → EXT-03 管理（writer_rule: any room member）
ext.channels      → EXT-06 管理（writer_rule: message author）
ext.reply_to      → EXT-04 管理（writer_rule: message author）
ext.watch         → EXT-14 管理（writer_rule: key contains signer entity_id）
ext.link-preview  → EXT-16 管理（writer_rule: @system:local）
ext.command       → EXT-15 管理（writer_rule: message author for command, handler for result）
```

### 2.4 Index Builder

Index 是 datatype 对外暴露的查询/聚合能力。Engine 根据 Index 声明导出操作清单，通过 PyO3 暴露为 Python async API。

```yaml
Index:
  id:            string          # "channel_aggregation", "thread_view", ...
  input:         string          # 数据来源描述
  transform:     string          # 变换逻辑描述
  refresh:       enum            # on_change | on_demand | periodic
  operation_id:  string | null   # 对外暴露的操作标识（null = 内部 index）
```

**refresh 策略**：

| 策略 | 含义 | 适用场景 |
|------|------|---------|
| `on_change` | after-write hook 触发时增量更新 | Timeline view, unread count |
| `on_demand` | API 请求时实时计算 | Channel aggregation, search |
| `periodic` | 定时重建 | Discovery index |

### 2.5 Datatype 统一声明格式

所有 datatype（built-in 和 extension）使用完全相同的声明格式：

```yaml
Datatype Declaration:
  # === 元信息 ===
  id:              string
  version:         string
  dependencies:    string[]

  # === 1. DATATYPES — 我管理哪些数据结构 ===
  datatypes:
    - id: string
      storage_type: enum
      key_pattern: string
      persistent: boolean
      writer_rule: string

  # === 2. HOOKS — 我在什么时机执行什么逻辑 ===
  hooks:
    pre_send:    Hook[]
    after_write: Hook[]
    after_read:  Hook[]

  # === 3. ANNOTATIONS — 我在已有数据上附加什么信息 ===
  annotations:
    on_ref:         {}    # ext.{ext_id} on ref
    on_room_config: {}    # ext.{ext_id} on room config
    on_profile:     {}    # profile doc 内容
    standalone_doc: {}    # 独立 doc 中的数据

  # === 4. INDEXES — 我对外提供什么查询能力 ===
  indexes:
    - id: string
      input: string
      transform: string
      refresh: enum
      operation_id: string | null
```

---

## 3. Storage / Sync Backend

Engine 通过 Storage/Sync Backend Abstraction 与底层 CRDT 和网络交互。参考实现使用 yrs + Zenoh。

### 3.1 CRDT Backend（Yjs / yrs）

每个 `storage_type: crdt_*` 的 datatype 映射到一个 yrs::Doc。Engine 不直接操作 yrs API——它通过 Backend Abstraction 提交 "write intent" 和接收 "change event"。

```
Engine                          Backend (yrs + Zenoh)
  │                                │
  ├─ write(ref, fields) ──────────►├─ Y.Map.set(fields)
  │                                ├─ encode update
  │                                ├─ Zenoh publish(updates KE)
  │                                │
  │◄─ change_event(ref, diff) ─────├─ Zenoh subscribe(updates KE)
  │                                ├─ apply update to local Y.Doc
  │                                ├─ observe_deep → emit change_event
```

Yjs 的具体使用约定：

- Y.Map 用于 Room Config、Content Doc、Read Receipts
- Y.Array<Y.Map> 用于 Timeline Index（每个 Y.Map 是一条 ref）
- Y.Text 用于 Mutable/Collab content body
- GC 策略：Timeline Index 不开启 GC（ref 需要永久保留 YATA 元数据），Content Doc 可开启 GC
- Doc 冻结：旧时间窗口的 Timeline Index doc 可冻结（停止接收新 ref，但 annotation 更新仍允许）

### 3.2 Network Backend（Zenoh）

Zenoh 提供以下原语，映射到 Engine 的需求：

| Engine 需求 | Zenoh 原语 | 用途 |
|------------|-----------|------|
| Initial sync | Query/Reply | 新 peer 获取完整 state 或差量 |
| Live sync | Pub/Sub (Advanced) | 实时增量更新 |
| Persistence | Storage plugin | 本地持久化（每个 peer）+ Relay 持久化（可选） |
| Presence | Liveliness | 在线状态检测 |
| Peer Discovery | Multicast Scouting + Gossip | 同网段自动发现 + 多跳路由传播 |
| State Serving | Queryable | 每个 peer 可回复其他 peer 的 state query |

**Zenoh Peer 配置**：每个 ezagent 实例以 `peer` mode 运行（非 `router` mode），启用 multicast scouting 和 gossip：

```json5
{
  mode: "peer",
  listen: { endpoints: ["tcp/0.0.0.0:7447"] },
  connect: { endpoints: [] },             // 可选：连接到 Public Relay
  scouting: {
    multicast: { enabled: true },         // LAN 自动发现
    gossip: { enabled: true }             // 多跳路由传播
  }
}
```

当配置了 Public Relay 时，在 `connect.endpoints` 中添加 Relay 的 TLS endpoint。Peer 同时维护 P2P 直连和 Relay 连接——同网段流量走 P2P，跨网段流量经 Relay 中转。

**Peer-as-Queryable**：每个 peer 对其已持有的 Y.Doc 注册 Zenoh queryable，使得其他 peer 可以直接从最近的源获取 state，无需依赖 Relay。当多个 responder 回复同一 query 时，选择 state vector 最完整的回复。

### 3.3 y-zenoh Sync Protocol

**初始同步**：peer 向 `ezagent/{room_id}/{doc}/state` 发起 Zenoh get，携带本地 state vector。Responder（router storage 或其他 peer）回复完整 state 或差量 updates。

**持续同步**：本地 Y.Doc 产生 update 时，wrapped 在 Signed Envelope 中 publish 到 `ezagent/{room_id}/{doc}/updates`。所有 subscriber 收到后验证签名、apply update。

**Signed Envelope**：

```
┌─────────────────────────────────────────────────┐
│ version (u8)                                     │
│ signer_id_len (u16) + signer_id (bytes)          │
│ doc_id_len (u16) + doc_id (bytes)                │
│ timestamp (i64, unix_ms)                         │
│ payload_len (u32) + payload (Yjs update bytes)   │
│ signature (64 bytes, Ed25519)                    │
└─────────────────────────────────────────────────┘
```

**QoS 配置**：

| Datatype | Priority | Congestion | Reliability |
|----------|----------|------------|-------------|
| Room Config | RealTime | Block | Reliable |
| Timeline Index | Data | Block | Reliable |
| Content Object | Data | Block | Reliable |
| Read Receipts | DataLow | Drop | BestEffort |
| Ephemeral | DataLow | Drop | BestEffort |

**断线恢复**：

```
1. Zenoh session 重连
2. 对每个已同步 doc:
   a. 用本地 state vector 发起 query → 获取差量 updates
   b. Apply 差量
3. Publish 离线期间的 pending updates
```

### 3.4 State Snapshot 策略

Router storage 定期合并 accumulated updates 为 single state snapshot，减小 initial sync 的 payload。推荐每 100 次 update 后合并一次。

---

## 4. Built-in Datatypes（Layer 1）

四个 built-in datatype，使用与 extension 完全相同的声明格式。

### 4.1 Identity

```yaml
id: "identity"
version: "0.1.0"
dependencies: []
```

**Datatypes**：

```yaml
- id: "entity_keypair"
  storage_type: blob
  key_pattern: "ezagent/@{entity_id}/identity/pubkey"
  persistent: true
  writer_rule: "signer == entity_id"
```

Entity ID 格式：`@{local_part}:{relay_domain}`。每个 entity 持有 Ed25519 密钥对，公钥通过注册 relay 分发。Agent 使用相同的 ID 格式。

**Hooks**：

```yaml
pre_send:
  - id: "sign_envelope"
    trigger: { datatype: "*", event: "any" }
    priority: 0                     # 最先：所有出站数据需要签名
    description: |
      对所有出站 CRDT update 执行 Ed25519 签名，
      封装为 Signed Envelope

after_write:
  - id: "verify_signature"
    trigger: { datatype: "*", event: "any" }
    priority: 0                     # 最先：所有入站数据需要验证
    description: |
      验证入站 Signed Envelope 的 Ed25519 签名。
      无效签名 → 丢弃 update，不 apply 到本地 CRDT。
      未知 extension 字段的签名 → 接受 core 部分，标记 extension 为 "unverified"
```

**Annotations**：

```yaml
on_entity:
  - device_keys: 设备密钥链（identity key 签署 device key）
```

**Indexes**：

```yaml
- id: "entity_lookup"
  input: "ezagent/@*/identity/pubkey"
  transform: "entity_id → public_key mapping"
  refresh: on_demand
  operation_id: "identity.get_pubkey"
```

### 4.2 Room

```yaml
id: "room"
version: "0.1.0"
dependencies: ["identity"]
```

**Datatypes**：

```yaml
- id: "room_config"
  storage_type: crdt_map
  key_pattern: "ezagent/{room_id}/config/{state|updates}"
  persistent: true
  writer_rule: "signer.power_level >= admin"
```

**Room Config 结构**：

```yaml
# Bus 字段
room_id: "01957a3b-..."              # UUIDv7
name: "Project Alpha"
created_by: "@alice:relay-a.example.com"
created_at: "2026-02-21T10:00:00Z"

membership:
  policy: "invite"                    # open | knock | invite
  members:                            # entity_id → role
    "@alice:...": "owner"
    "@bob:...": "member"

power_levels:
  default: 0
  events_default: 0
  admin: 100
  users: { "@alice:...": 100 }

relays:
  - endpoint: "tcp/relay-a.example.com:7447"
    role: "primary"

encryption: "transport_only"

timeline:
  window_size: "monthly"
  max_refs_per_window: 100000

# Engine 管理的字段
enabled_extensions: [...]             # 启用的 extension 列表
ext: { ... }                          # Extension 配置命名空间
```

**Hooks**：

```yaml
pre_send:
  - id: "check_room_write"
    trigger: { datatype: "*", event: "any", filter: "key starts with ezagent/{room_id}/" }
    priority: 10
    description: "验证 signer ∈ room.members。全局 hook，拦截对该 room 所有 datatype 的写入"

  - id: "check_config_permission"
    trigger: { datatype: "room_config", event: "update" }
    priority: 20
    description: "验证操作者 power_level >= admin"

after_write:
  - id: "member_change_notify"
    trigger: { datatype: "room_config", event: "update", filter: "membership changed" }
    priority: 50
    description: "生成 room.member.joined / room.member.left 事件"

  - id: "extension_loader"
    trigger: { datatype: "room_config", event: "update", filter: "enabled_extensions changed" }
    priority: 10
    description: "加载/卸载 extension datatype 和对应的 hooks"
```

**Annotations**：

```yaml
on_room_config:
  - ext.{ext_id}: 各 extension 的配置（如 ext.moderation.power_level）
  - ext.channels.hints: Channel 提示列表
```

**Indexes**：

```yaml
- id: "room_list"
  input: "所有 room_config where signer ∈ members"
  transform: "room_id → room summary"
  refresh: on_change
  operation_id: "room.list"

- id: "member_list"
  input: "room_config.membership.members"
  transform: "entity_id → role mapping"
  refresh: on_change
  operation_id: "room.members"
```

**Room 生命周期**：

| 操作 | 流程 |
|------|------|
| 创建 | 生成 UUIDv7 → 创建 room_config doc → 写入初始成员和 relay |
| Open 加入 | Peer 发现 room → 直接开始同步 |
| Invite 加入 | 现有成员写 members → 新 entity 客户端发现后开始同步 |
| Knock 加入 | 申请者发请求 → admin 批准 → 写 members |
| 退出 | 从 members 删除自己 |
| 踢出 | power_level > 被踢者 → 从 members 删除对方 |

### 4.3 Timeline

```yaml
id: "timeline"
version: "0.1.0"
dependencies: ["identity", "room"]
```

**Datatypes**：

```yaml
- id: "timeline_index"
  storage_type: crdt_array          # Y.Array<Y.Map>
  key_pattern: "ezagent/{room_id}/index/{shard_id}/{state|updates}"
  persistent: true
  writer_rule: "signer ∈ room.members AND ref.author == signer"
```

**Bus Ref 结构**（timeline index 中每条 Y.Map）：

```yaml
ref Y.Map:
  # Bus 字段（任何 peer 都必须理解）
  ref_id:       "ulid:01ARYZ6S41..."        # 全局唯一
  author:       "@alice:relay-a.example.com"
  content_type: "immutable"                  # 可被 extension 注册新值
  content_id:   "sha256:a1b2c3..."           # 指向 layer 2
  created_at:   "2026-02-21T10:05:00Z"       # 信息性，不影响排序
  status:       "active"                      # "active" | "deleted_by_author" (可扩展)
  signature:    "ed25519:..."                 # core 字段的签名

  # Extension 字段（ext.{ext_id} 命名空间）
  ext.reactions:   Y.Map { ... }              # by Reactions extension
  ext.reply_to:    Y.Map { ... }              # by Reply To extension
  ext.channels:    [...]                      # by Channels extension
  ext.thread:      Y.Map { ... }              # by Threads extension
  ext.watch:       Y.Map { ... }              # by Watch extension
  ext.link-preview: Y.Map { ... }             # by Link Preview extension
```

Bus peer 遇到 `ext.*` 字段：保留（Y.Map 默认行为），不渲染，不删除。

**Hooks**：

```yaml
pre_send:
  - id: "generate_ref"
    trigger: { datatype: "timeline_index", event: "insert" }
    priority: 20
    description: |
      生成 ref_id (ULID)，设置 status = "active"。
      此时其他 extension 的 pre_send hook 可以注入 ext.* 字段。
      所有 pre_send hook 完成后，执行签名。

after_write:
  - id: "ref_change_detect"
    trigger: { datatype: "timeline_index", event: "any" }
    priority: 30
    description: |
      新 ref insert → emit "message.new"
      status 变化 → emit "message.deleted" / "message.edited"
      ext.* 变化 → emit 对应 extension 事件（含 watch 通知检查）

after_read:
  - id: "timeline_pagination"
    trigger: { datatype: "timeline_index" }
    priority: 30
    description: "支持 limit / before / after cursor 分页"
```

**Annotations**：

```yaml
on_ref:
  - ext.{ext_id}: 由各 Extension 在自己的命名空间中管理
```

**Indexes**：

```yaml
- id: "timeline_view"
  input: "timeline_index for ezagent/{room_id}/index/{shard_id}"
  transform: "YATA-ordered refs with count-based sharding"
  refresh: on_change
  operation_id: "timeline.list"

- id: "single_ref"
  input: "timeline_index.refs[ref_id]"
  transform: "ref + content + annotations"
  refresh: on_demand
  operation_id: "timeline.get_ref"
```

**排序语义**：YATA 决定全局顺序。`created_at` 仅供 UI 展示。

**时间窗口分片**：按月分片。当前 UTC 月份 → 当前 index doc。默认订阅当前窗口和前一个窗口。旧窗口按需加载。

### 4.4 Message

```yaml
id: "message"
version: "0.1.0"
dependencies: ["identity", "timeline"]
```

**Datatypes**：

```yaml
- id: "immutable_content"
  storage_type: blob                # content-addressed, 非 CRDT
  key_pattern: "ezagent/{room_id}/content/{sha256_hash}"
  persistent: true
  writer_rule: "signer == author, one-time write"
```

**Immutable Content 结构**：

```yaml
content_id: "sha256:a1b2c3..."
type: "immutable"
author: "@alice:relay-a.example.com"
body: "Hello, world!"
format: "text/plain"               # text/plain | text/markdown | text/html
media_refs: []                     # 附件引用（需 EXT-10 Media）
created_at: "2026-02-21T10:05:00Z"
signature: "ed25519:..."
```

**Hooks**：

```yaml
pre_send:
  - id: "compute_content_hash"
    trigger: { datatype: "immutable_content", event: "insert" }
    priority: 20
    description: "canonical_json(content) → sha256 → content_id"

  - id: "validate_content_ref"
    trigger: { datatype: "timeline_index", event: "insert", filter: "content_type == immutable" }
    priority: 25
    description: "验证 ref.content_id 指向的 content 存在且 hash 匹配"

after_read:
  - id: "resolve_content"
    trigger: { datatype: "timeline_index" }
    priority: 40
    description: "ref.content_id → 读取 layer 2 content → 注入 API 响应"
```

**Indexes**：

```yaml
- id: "content_lookup"
  input: "content by hash"
  transform: "content_id → content body"
  refresh: on_demand
  operation_id: null                 # 内嵌在 message API 中
```

**发送消息的完整 Hook 执行流程**：

```
用户调用 POST /rooms/{room_id}/messages

pre_send phase (按 priority 排序):
  0   identity.sign_envelope         → (等待最后执行签名)
  10  room.check_room_write          → 验证 signer ∈ members
  20  message.compute_content_hash   → 计算 content_id
  20  timeline.generate_ref          → 生成 ref_id, 设置 status
  25  message.validate_content_ref   → 验证 content 存在
  30  reactions.inject_reactions      → (如有) 注入 ext.reactions
  30  reply_to.inject_reply          → (如有) 注入 ext.reply_to
  30  channels.inject_tags           → (如有) 注入 ext.channels
  30  annotations.inject_previews    → (如有) pre-send annotation hooks
  0   identity.sign_envelope         → 最终签名 (实际在所有其他 hook 之后)

→ 写入 CRDT → Zenoh publish

after_write phase:
  0   identity.verify_signature      → (对入站数据) 验证签名
  30  timeline.ref_change_detect     → emit "message.new" event
  40  watch.check_watchers           → 检查被 reply_to 的 ref 是否有 watcher → 通知
  50  channels.update_activity       → 更新 channel activity index
```

---

## 5. Extension Datatypes（Layer 2）

所有 extension 使用与 built-in 完全相同的声明格式。每个 extension 描述四个维度：datatypes、hooks、annotations、indexes。

### EXT-01: Mutable Content

```yaml
id: "mutable"
version: "0.1.0"
dependencies: ["message"]

datatypes:
  - id: "mutable_content"
    storage_type: crdt_map           # Y.Map 包含 Y.Text body
    key_pattern: "ezagent/{room_id}/content/{content_id}/{state|updates}"
    persistent: true
    writer_rule: "signer == content.author"

hooks:
  pre_send:
    - id: "mutable.validate_edit"
      trigger: { datatype: "mutable_content", event: "update" }
      priority: 25
      description: "验证 signer == content.author"

  after_write:
    - id: "mutable.status_update"
      trigger: { datatype: "mutable_content", event: "update" }
      priority: 35
      description: "content 被编辑 → 更新 ref.status 为 'edited'"

    - id: "mutable.emit_edited"
      trigger: { datatype: "timeline_index", event: "update", filter: "status == edited" }
      priority: 40
      description: "emit 'message.edited' event"

annotations:
  on_ref: {}                          # 无额外 annotation
  standalone_doc:
    content_type: "mutable"           # 注册到 content_type 枚举
    ref_status: "edited"              # 注册到 status 枚举
    upgrade_path: "immutable → mutable"

indexes:
  - id: "version_history"
    input: "mutable_content.versions"
    transform: "ref_id → list of {body_snapshot, edited_at}"
    refresh: on_demand
    operation_id: "mutable.versions"
```

**Mutable Content Doc 结构**：

```yaml
content_id: "uuid:..."
type: "mutable"
author: "@alice:..."
body: Y.Text("可编辑文字")
format: "text/markdown"
media_refs: Y.Array [...]
versions: Y.Array [                   # 可选：编辑历史快照
  { body_snapshot: "...", edited_at: "..." }
]
```

### EXT-02: Collaborative Content

```yaml
id: "collab"
version: "0.1.0"
dependencies: ["mutable", "room"]

datatypes:
  - id: "collab_acl"
    storage_type: crdt_map
    key_pattern: "ezagent/{room_id}/content/{content_id}/acl/{state|updates}"
    persistent: true
    writer_rule: "signer == acl.owner"

hooks:
  pre_send:
    - id: "collab.check_acl"
      trigger: { datatype: "mutable_content", event: "update", filter: "content_type == collab" }
      priority: 25
      description: |
        mode == owner_only:   signer == owner
        mode == explicit:     signer ∈ editors
        mode == room_members: signer ∈ room.members

annotations:
  standalone_doc:
    content_type: "collab"
    upgrade_path: "mutable → collab"

indexes:
  - id: "collaborator_list"
    input: "collab_acl"
    transform: "content_id → {owner, mode, editors}"
    refresh: on_change
    operation_id: "collab.get_acl"
```

**ACL Doc**：`{ owner, mode: "owner_only" | "explicit" | "room_members", editors: [], updated_at }`

**类型升级路径**：`immutable → mutable → collab (owner_only → explicit → room_members)`。降级不允许。

### EXT-03: Reactions

```yaml
id: "reactions"
version: "0.1.0"
dependencies: ["timeline"]

datatypes: []                         # 无独立 datatype，纯 annotation on ref

hooks:
  pre_send:
    - id: "reactions.inject"
      trigger: { datatype: "timeline_index", event: "update", filter: "reaction operation" }
      priority: 30
      description: |
        添加 reaction: ref.ext.reactions.set("{emoji}:{entity_id}", timestamp)
        撤销 reaction: ref.ext.reactions.delete("{emoji}:{entity_id}")
        writer_rule: reaction key 中的 entity_id == signer

  after_write:
    - id: "reactions.emit"
      trigger: { datatype: "timeline_index", event: "update", filter: "ext.reactions changed" }
      priority: 40
      description: "emit 'reaction.added' / 'reaction.removed' event"

annotations:
  on_ref:
    ext.reactions: "Y.Map<'{emoji}:{entity_id}', unix_ms>"
    signed: false                     # 任何人都能加 reaction

indexes:
  - id: "reaction_summary"
    input: "ref.ext.reactions"
    transform: "ref_id → {emoji → count, user_list}"
    refresh: on_change
    operation_id: null                 # 内嵌在 message API
```

### EXT-04: Reply To

```yaml
id: "reply-to"
version: "0.1.0"
dependencies: ["timeline"]

hooks:
  pre_send:
    - id: "reply_to.inject"
      trigger: { datatype: "timeline_index", event: "insert", filter: "has reply_to" }
      priority: 30
      description: "注入 ext.reply_to = { ref_id }"

annotations:
  on_ref:
    ext.reply_to: "{ ref_id: ulid }"
    signed: true

indexes:
  - id: "reply_chain"
    input: "timeline refs where ext.reply_to.ref_id == target"
    transform: "ref_id → list of replies"
    refresh: on_demand
    operation_id: null                 # 内嵌在 message API
```

### EXT-05: Cross-Room References

```yaml
id: "cross-room-ref"
version: "0.1.0"
dependencies: ["reply-to", "room"]

hooks:
  pre_send:
    - id: "cross_room.inject"
      trigger: { datatype: "timeline_index", event: "insert", filter: "reply_to.room_id != null" }
      priority: 31                     # 在 reply_to 之后
      description: "扩展 ext.reply_to = { ref_id, room_id, window }"

  after_read:
    - id: "cross_room.resolve_preview"
      trigger: { datatype: "timeline_index", filter: "ext.reply_to.room_id != null" }
      priority: 45
      description: |
        已加入目标 room → 展示预览，可跳转
        未加入目标 room → 占位符，不泄露信息

annotations:
  on_ref:
    ext.reply_to: "扩展为 { ref_id, room_id?, window? }"
    signed: true

indexes:
  - id: "cross_room_preview"
    input: "target room's timeline ref"
    transform: "ref_id → preview data (if member)"
    refresh: on_demand
    operation_id: "crossroom.preview"
```

### EXT-06: Channels

```yaml
id: "channels"
version: "0.1.0"
dependencies: ["timeline", "room"]

hooks:
  pre_send:
    - id: "channels.inject_tags"
      trigger: { datatype: "timeline_index", event: "insert", filter: "has channels" }
      priority: 30
      description: "注入 ext.channels = [tag1, tag2, ...]"

  after_write:
    - id: "channels.update_activity"
      trigger: { datatype: "timeline_index", event: "insert", filter: "ext.channels present" }
      priority: 50
      description: "更新 channel activity index, emit 'channel.activity' event"

  after_read:
    - id: "channels.aggregate"
      trigger: { datatype: "timeline_index" }
      priority: 50
      description: |
        遍历已加入 room 的 timeline → 按 channel tag 过滤
        → 跨 room 按 created_at 归并排序
        聚合范围严格限定在已加入 room 的并集

annotations:
  on_ref:
    ext.channels: "string[] (channel tags)"
    signed: true
  on_room_config:
    ext.channels.hints: "[{ id, name, created_by }]"

indexes:
  - id: "channel_aggregation"
    input: "all joined rooms' timeline refs"
    transform: "filter by tag → merge sort by created_at"
    refresh: on_demand
    operation_id: "channels.refs"

  - id: "channel_list"
    input: "all joined rooms' known channel tags"
    transform: "tag → { room_count, last_activity }"
    refresh: on_change
    operation_id: "channels.list"
```

**Channel 概念**：tag on ref，隐式创建（第一条 tagged ref），自然消亡（无 ref 引用时）。全局扁平命名空间。Relay 无感——所有逻辑在 peer 端完成。

### EXT-07: Moderation

```yaml
id: "moderation"
version: "0.1.0"
dependencies: ["timeline", "room"]

datatypes:
  - id: "moderation_overlay"
    storage_type: crdt_array          # Y.Array<Y.Map>
    key_pattern: "ezagent/{room_id}/ext/moderation/{state|updates}"
    persistent: true
    writer_rule: "signer.power_level >= power_levels.ext.moderation"

hooks:
  after_write:
    - id: "moderation.emit_action"
      trigger: { datatype: "moderation_overlay", event: "insert" }
      priority: 40
      description: "emit 'moderation.action' event"

  after_read:
    - id: "moderation.merge_overlay"
      trigger: { datatype: "timeline_index" }
      priority: 60
      description: |
        timeline refs + moderation overlay → merged view
        redacted ref → 普通成员看占位符，admin 看原文
        pinned ref → 置顶展示
        banned user → 后续 ref 标记警告
        冲突解决 → Y.Array 中更晚的 action 覆盖更早的

annotations:
  on_room_config:
    ext.moderation.power_level: "审核操作所需权限等级 (default 50)"
  standalone_doc:
    actions: "Y.Array<{ action_id, action, target_ref, target_user, by, reason, timestamp, signature }>"
    action_types: "redact | pin | unpin | ban_user | unban_user"

indexes:
  - id: "moderated_timeline"
    input: "timeline_index + moderation_overlay"
    transform: "merge overlay onto timeline"
    refresh: on_change
    operation_id: null                 # 合并进 timeline_view
```

**设计决策**：overlay 不修改原始 ref，作为独立覆盖层叠加。保证审计完整、原始数据不破坏、不同权限用户看到不同视图。

### EXT-08: Read Receipts

```yaml
id: "read-receipts"
version: "0.1.0"
dependencies: ["timeline", "room"]

datatypes:
  - id: "read_receipts"
    storage_type: crdt_map            # Y.Map<entity_id, Y.Map>
    key_pattern: "ezagent/{room_id}/ext/read-receipts/{state|updates}"
    persistent: true
    writer_rule: "Y.Map key == signer entity_id"

hooks:
  after_read:
    - id: "receipts.auto_mark"
      trigger: { datatype: "timeline_index" }
      priority: 70
      description: "用户阅读消息 → 自动更新 read position"

  after_write:
    - id: "receipts.update_unread"
      trigger: { datatype: "read_receipts", event: "update" }
      priority: 50
      description: "更新 unread count index"

annotations:
  standalone_doc:
    per_entity: "{ last_read_ref, last_read_window, updated_at }"

indexes:
  - id: "unread_count"
    input: "read_receipts + timeline_index"
    transform: "room_id → unread message count"
    refresh: on_change
    operation_id: "receipts.summary"
```

### EXT-09: Presence & Awareness

```yaml
id: "presence"
version: "0.1.0"
dependencies: ["room"]

datatypes:
  - id: "presence_token"
    storage_type: ephemeral           # Zenoh liveliness token
    key_pattern: "ezagent/{room_id}/ephemeral/presence/@{entity_id}"
    persistent: false
    writer_rule: "signer == entity_id in key"

  - id: "awareness_state"
    storage_type: ephemeral           # Zenoh pub/sub
    key_pattern: "ezagent/{room_id}/ephemeral/awareness/@{entity_id}"
    persistent: false
    writer_rule: "signer == entity_id in key"

hooks:
  after_write:
    - id: "presence.online_change"
      trigger: { datatype: "presence_token", event: "any" }
      priority: 40
      description: "emit 'presence.joined' / 'presence.left' event"

    - id: "presence.typing_change"
      trigger: { datatype: "awareness_state", event: "update", filter: "typing changed" }
      priority: 40
      description: "emit 'typing.start' / 'typing.stop' event"

annotations:
  ephemeral:
    awareness_payload: "{ entity_id, typing, active_window, custom_status, last_active }"

indexes:
  - id: "online_users"
    input: "presence_token for room/{room_id}"
    transform: "room_id → list of online entity_ids"
    refresh: on_change
    operation_id: "presence.list"
```

### EXT-10: Media / Blobs

```yaml
id: "media"
version: "0.2.0"
dependencies: ["message"]

datatypes:
  - id: "global_blob"
    storage_type: blob
    key_pattern: "ezagent/blob/{blob_hash}"
    persistent: true
    writer_rule: "any authenticated entity"
    sync_strategy: { mode: lazy }
  - id: "blob_ref"
    storage_type: crdt_map
    key_pattern: "ezagent/{room_id}/ext/media/blob-ref/{blob_hash}"
    persistent: true
    writer_rule: "signer ∈ room.members"

hooks:
  pre_send:
    - id: "media.upload"
      trigger: { datatype: "global_blob", event: "insert" }
      priority: 20
      description: "计算 sha256 hash, 全局去重存储 blob, 创建 per-room blob ref"

annotations:
  on_ref:
    ext.media: "{ blob_hash, filename, mime_type, size_bytes }"

indexes:
  - id: "media_gallery"
    input: "ezagent/{room_id}/ext/media/blob-ref/*"
    transform: "room_id → list of media refs"
    refresh: on_demand
    operation_id: "media.get"
```

### EXT-11: Threads

```yaml
id: "threads"
version: "0.1.0"
dependencies: ["reply-to"]

hooks:
  pre_send:
    - id: "threads.inject"
      trigger: { datatype: "timeline_index", event: "insert", filter: "has thread_root" }
      priority: 30
      description: "注入 ext.thread = { root: ulid }"

  after_read:
    - id: "threads.filter"
      trigger: { datatype: "timeline_index" }
      priority: 50
      description: "按 ext.thread.root 过滤，构建 thread view"

annotations:
  on_ref:
    ext.thread: "{ root: ulid }"
    signed: true

indexes:
  - id: "thread_view"
    input: "timeline refs where ext.thread.root == target"
    transform: "root_ref_id → list of thread replies"
    refresh: on_demand
    operation_id: "threads.list"
```

### EXT-12: User Drafts

```yaml
id: "drafts"
version: "0.1.0"
dependencies: ["room"]

datatypes:
  - id: "user_draft"
    storage_type: crdt_map
    key_pattern: "ezagent/{room_id}/ext/draft/{entity_id}/{state|updates}"
    persistent: true
    writer_rule: "signer == entity_id in doc_id"

hooks:
  pre_send:
    - id: "drafts.auto_save"
      trigger: { datatype: "user_draft", event: "update" }
      priority: 50
      description: "用户输入时自动保存到 draft doc（跨设备同步）"

    - id: "drafts.clear_on_send"
      trigger: { datatype: "timeline_index", event: "insert" }
      priority: 90
      description: "消息发送成功 → 清除对应 draft"

annotations: {}
indexes: []
```

### EXT-13: Entity Profile

```yaml
id: "profile"
version: "0.1.0"
dependencies: ["identity"]

datatypes:
  - id: "entity_profile"
    storage_type: crdt_map            # Y.Map 包含 Y.Text body
    key_pattern: "ezagent/@{entity_id}/ext/profile/{state|updates}"
    persistent: true
    writer_rule: "signer == entity_id"

hooks:
  after_write:
    - id: "profile.index_update"
      trigger: { datatype: "entity_profile", event: "any" }
      priority: 50
      description: |
        Profile 变化 → 通知 relay 重建 discovery index。
        索引方式由 relay owner 决定（全文搜索、embedding、LLM 提取等）。
        协议不标准化搜索 API。

annotations:
  on_profile:
    frontmatter: "Y.Map { entity_type, display_name, avatar_hash }"
    body: "Y.Text (markdown 自由格式)"

indexes:
  - id: "profile_lookup"
    input: "ezagent/@{entity_id}/ext/profile"
    transform: "entity_id → profile content"
    refresh: on_change
    operation_id: "profile.get"

  - id: "discovery_search"
    input: "all profiles on this relay"
    transform: "query → matching profiles (relay-side implementation)"
    refresh: periodic
    operation_id: "discovery.search (relay-defined, not standardized)"
```

**Profile 格式**：

```markdown
---
entity_type: agent
display_name: Code Review Agent
avatar_hash: sha256:...
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

`entity_type` 是唯一结构化必需字段（决定 UI 渲染方式）。其余由 markdown 自由表达。

**Virtual User**：在 room config 的 members 中添加指向外部 relay 的 entity ID。该 entity 的 profile 由 relay admin 手动添加或自动从 source relay 拉取，存储在本地 relay 的 profile doc 中。

### EXT-14: Watch

```yaml
id: "watch"
version: "0.1.0"
dependencies: ["timeline", "reply-to"]

hooks:
  pre_send:
    - id: "watch.set_ref"
      trigger: { datatype: "timeline_index", event: "update", filter: "annotation type == watch" }
      priority: 30
      description: |
        Entity 在 ref 上设置 watch:
        ext.watch.@{entity_id} = {
          reason: "processing_task",
          on_content_edit: true,
          on_reply: true,
          on_thread: true,
          on_reaction: false
        }

    - id: "watch.set_channel"
      trigger: { datatype: "room_config", event: "update", filter: "ext.watch changed" }
      priority: 30
      description: |
        Entity 在 room config 上设置 channel watch:
        room_config.ext.watch.@{entity_id} = {
          channels: ["code-review", "design"],
          scope: "all_rooms"
        }

  after_write:
    - id: "watch.check_ref_watchers"
      trigger: { datatype: "timeline_index", event: "any" }
      priority: 45
      description: |
        新 ref insert 时:
          检查 ext.reply_to.ref_id 指向的 ref 是否有 watch annotation
          → 如有，且 on_reply == true → emit "watch.ref_reply_added"
          检查 ext.thread.root 指向的 ref 是否有 watch annotation
          → 如有，且 on_thread == true → emit "watch.ref_thread_reply"
        Ref 更新时:
          检查被更新的 ref 是否有 watch annotation
          → status 变为 "edited" → emit "watch.ref_content_edited"
          → ext.reactions 变化 → emit "watch.ref_reaction_changed" (if on_reaction)

    - id: "watch.check_channel_watchers"
      trigger: { datatype: "timeline_index", event: "insert", filter: "ext.channels present" }
      priority: 46
      description: |
        新 tagged ref 出现时:
          检查所有 room 的 channel_watch annotations
          → 匹配的 channel → emit "watch.channel_new_ref"

annotations:
  on_ref:
    "watch:@{entity_id}": "{ reason, on_content_edit, on_reply, on_thread, on_reaction }"
  on_room_config:
    "channel_watch:@{entity_id}": "{ channels: string[], scope }"

indexes:
  - id: "my_watches"
    input: "all refs/rooms where I have watch annotation"
    transform: "entity_id → list of watched refs and channels"
    refresh: on_change
    operation_id: "watch.list"
```

**Events**：

```
event: watch.ref_content_edited
data: { watcher, watched_ref, room_id, new_content_id }

event: watch.ref_reply_added
data: { watcher, watched_ref, room_id, new_ref_id }

event: watch.ref_thread_reply
data: { watcher, watched_ref, room_id, new_ref_id }

event: watch.channel_new_ref
data: { watcher, channel, room_id, new_ref_id }
```

**Agent 工作流示例**：

```
1. Agent 发现任务 (EXT-13 Profile + Relay Discovery)
2. Agent 被邀请进 room
3. Agent 处理 message A → 设置 watch(A, on_reply=true, on_content_edit=true)
4. Agent 发送 mutable message C 作为初步输出
5. Author 编辑 A → Agent 收到 watch.ref_content_edited → 更新 C
6. Author 发送 B (reply_to A) → Agent 收到 watch.ref_reply_added → 读取 B，更新 C
```

---

## 6. Extension 交互汇总

### 6.1 四维分布

```
                    │ Datatypes│ Hooks        │ Annotations    │ Indexes
                    │ (new doc)│ pre/aw/ar    │ on ref / doc   │
────────────────────┼──────────┼──────────────┼────────────────┼──────────
Built-in:           │          │              │                │
  Identity          │ keypair  │ ●/-/-        │ device_keys    │ entity_lookup
  Room              │ config   │ ●/●/-        │ ext.*          │ room_list, members
  Timeline          │ index    │ ●/●/●        │ ext.*, annot.  │ timeline, single_ref
  Message           │ immutable│ ●/-/●        │                │ content_lookup
────────────────────┼──────────┼──────────────┼────────────────┼──────────
Extension:          │          │              │                │
  EXT-01 Mutable    │ content  │ ●/●/-        │ type reg       │ version_history
  EXT-02 Collab     │ acl      │ ●/-/-        │ type reg       │ collaborator_list
  EXT-03 Reactions  │          │ ●/●/-        │ ext.reactions  │ reaction_summary
  EXT-04 Reply To   │          │ ●/-/-        │ ext.reply_to   │ reply_chain
  EXT-05 CrossRoom  │          │ ●/-/●        │ ext.reply_to+  │ preview
  EXT-06 Channels   │          │ ●/●/●        │ ext.channels   │ aggregation, list
  EXT-07 Moderation │ overlay  │ -/●/●        │ ext.mod config │ moderated_timeline
  EXT-08 Receipts   │ receipts │ -/●/●        │ per-entity pos │ unread_count
  EXT-09 Presence   │ ephemeral│ -/●/-        │ awareness      │ online_users
  EXT-10 Media      │ blob     │ ●/-/-        │ type reg       │ media_gallery
  EXT-11 Threads    │          │ ●/-/●        │ ext.thread     │ thread_view
  EXT-12 Drafts     │ draft    │ ●/-/-        │                │
  EXT-13 Profile    │ profile  │ -/●/-        │ frontmatter+md │ profile, discovery
  EXT-14 Watch      │          │ ●/●/-        │ watch annot.   │ my_watches

● = pre_send / ● = after_write / ● = after_read
```

### 6.2 依赖图

```
                    ┌──────────────────────────────────────────┐
                    │     Built-in Datatypes (Layer 1)         │
                    │  Identity → Room → Timeline → Message    │
                    └─────────────────┬────────────────────────┘
                                      │
          ┌───────────────────────────┼──────────────────────────┐
          │                           │                          │
          ▼                           ▼                          ▼
   ┌─────────────┐           ┌──────────────┐          ┌──────────────┐
   │  EXT-01     │           │  EXT-04      │          │ (独立)       │
   │  Mutable    │           │  Reply To    │          │ EXT-03 React │
   └──────┬──────┘           └──────┬───────┘          │ EXT-06 Chan  │
          │                     ┌───┴───┐              │ EXT-07 Moder │
          ▼                     ▼       ▼              │ EXT-08 Recpt │
   ┌─────────────┐     ┌────────────┐ ┌────────┐      │ EXT-09 Pres  │
   │  EXT-02     │     │  EXT-05    │ │EXT-11  │      │ EXT-10 Media │
   │  Collab     │     │  CrossRoom │ │Threads │      │ EXT-12 Draft │
   └─────────────┘     └────────────┘ └────────┘      │ EXT-13 Prof  │
                                                       └──────────────┘
                              ┌────────────┐
                              │  EXT-14    │
                              │  Watch     │ (depends: timeline, reply-to)
                              └────────────┘
```

### 6.3 合规性层级

| 层级 | 必须支持 | 典型场景 |
|------|---------|---------|
| **Level 0: Core** | Identity + Room + Timeline + Message + Engine | 最小可行 IM |
| **Level 1: Standard** | + Mutable, Reactions, Reply To, Read Receipts, Presence, Media | 标准 IM |
| **Level 2: Advanced** | + Collab, Channels, Moderation, Cross-Room Ref, Profile, Watch | 协作平台 |
| **Level 3: Full** | + Threads, Drafts | 全功能 |

---

## 7. Network Roles

### 7.1 Peer（每个 ezagent 实例）

每个 ezagent 实例是一个自给自足的 Zenoh peer 节点：

| 能力 | 说明 |
|------|------|
| 实时消息收发 | P2P pub/sub 直连 |
| CRDT 同步 | P2P query/reply |
| 本地持久化 | RocksDB（`~/.ezagent/data/`） |
| State Query Responder | 对已持有的 Y.Doc 注册 Zenoh queryable |
| LAN 发现 | Multicast scouting 自动发现同网段 peer |
| 签名验证 | Peer-side 验证，不依赖 Relay |

**Zenoh Peer 配置**（每个 ezagent 实例内部生成）：

```json5
{
  mode: "peer",
  listen: { endpoints: ["tcp/0.0.0.0:7447"] },
  connect: { endpoints: [] },             // 有 Relay 时添加 tls endpoint
  scouting: {
    multicast: { enabled: true, address: "224.0.0.224:7446" },
    gossip: { enabled: true }
  },
  plugins: {
    storage_manager: {
      volumes: { rocksdb: { dir: "~/.ezagent/data" } },
      storages: {
        local_state: { key_expr: "ezagent/**/state", volume: { id: "rocksdb" } },
        local_blobs: { key_expr: "ezagent/**/blob/*", volume: { id: "rocksdb" } }
      }
    }
  }
}
```

### 7.2 Public Relay（可选公共服务）

Public Relay 是 ezagent 网络中提供跨网络桥接、离线恢复和实体发现的可选公共服务。Relay 不拥有数据——它缓存和转发数据。

**职责分层**：

| Tier | 能力 | 说明 |
|------|------|------|
| **Tier 1: Bridge** | NAT 桥接 + 身份注册 | 跨网段 peer 中转；Entity 注册和公钥分发 |
| **Tier 2: Cold Storage** | 离线暂存 + State Snapshot | 离线 peer 的消息暂存；定期合并 state |
| **Tier 3: Discovery** | Profile 索引 + 搜索 | 跨组织 Agent/Entity 发现 |
| **Tier 4: Push Gateway** | 推送通知 + Webhook | 移动设备推送（可选） |

**合规性等级**：

| 等级 | 要求 | 适用场景 |
|------|------|---------|
| **Level 1: Basic** | Bridge + Cold Storage | Self-Host / 开发测试 |
| **Level 2: Secured** | Level 1 + Access Control (ACL Interceptor) | 组织内部 |
| **Level 3: Full** | Level 2 + Discovery + Push Gateway | 公共服务 |

**Public Relay 配置**：

```json5
{
  mode: "router",
  listen: { endpoints: ["tls/0.0.0.0:7448"] },
  plugins: {
    storage_manager: {
      volumes: { rocksdb: {} },
      storages: {
        ezagent_states: {
          key_expr: "ezagent/**/state",
          volume: { id: "rocksdb", dir: "ezagent-states", create_db: true }
        },
        ezagent_blobs: {
          key_expr: "ezagent/**/blob/*",
          volume: { id: "rocksdb", dir: "ezagent-blobs", create_db: true }
        }
      }
    }
  }
}
```

### 7.3 TLS 信任模型

Relay 通过 TLS 证书证明自身真实性。两档信任模型：

| 场景 | TLS 方案 | 证书来源 | Zenoh 配置 |
|------|---------|---------|-----------|
| **公网 Relay** | WebPKI | Let's Encrypt 等 CA | `root_ca_certificate` 不设置（默认 WebPKI） |
| **本地 / Self-Host Relay** | 自签 CA | mkcert 或 minica | `root_ca_certificate` 指向自签 CA 证书 |

公网 Relay 的信任链与 HTTPS 网站完全一致——peer 使用操作系统内置的 WebPKI 信任链验证 Relay 的 TLS 证书。

本地开发 Relay 使用 `mkcert` 一键生成证书：

```bash
# Relay 侧
mkcert -install                              # 安装本地 CA
mkcert relay.local localhost 127.0.0.1       # 生成证书
# 或使用 ezagent-relay CLI：
ezagent-relay init --domain relay.local      # 自动检测 mkcert 并生成证书
```

Peer 连接本地 Relay 时需指定 CA 证书：

```json5
{
  connect: { endpoints: ["tls/relay.local:7448"] },
  transport: { link: { tls: {
    root_ca_certificate: "/path/to/mkcert-ca.pem"
  }}}
}
```

### 7.4 身份注册流程

```
  用户                        Relay (relay.ezagent.dev)
    │                              │
    │  1. TLS 握手                 │
    │  ────────────────────────►   │  Relay 出示 TLS 证书
    │  ◄────────────────────────   │  Peer 通过 WebPKI 验证
    │                              │
    │  2. 注册请求                 │
    │  { name: "alice",            │
    │    public_key: <Ed25519> }   │
    │  ────────────────────────►   │  Relay 检查唯一性
    │                              │  Relay 存储 entity_id → pubkey
    │  3. 注册确认                 │
    │  ◄────────────────────────   │
    │  { entity_id:                │
    │    "@alice:relay.ezagent.dev" }
    │                              │
    │  4. Peer 保存到本地           │
    │  ~/.ezagent/identity.key     │
    │  ~/.ezagent/config.toml      │
```

### 7.5 P2P 身份验证

```
  Bob (LAN)              Alice (LAN peer)        Relay
    │                        │                     │
    │  scouting 发现          │                     │
    │  ◄─────────────────►   │                     │
    │  "我是 @alice:relay..."│                     │
    │                        │                     │
    │  查询公钥              │                     │
    │  ───────────────────────────────────────►    │
    │  ◄───────────────────────────────────────    │
    │  pubkey = <Ed25519>    │                     │
    │                        │                     │
    │  challenge (nonce)     │                     │
    │  ─────────────────►    │                     │
    │  response (signed)     │                     │
    │  ◄─────────────────    │                     │
    │                        │                     │
    │  验证签名 ✅           │                     │
    │  缓存公钥              │                     │
    │  (后续无需联系 Relay)   │                     │
```

### 7.6 Access Control

**Bus 验证**：Room membership (signer ∈ members), power_level checks

**Extension 验证**：由各 extension 的 writer_rule 定义。Public Relay 的 interceptor plugin 聚合所有已启用 extension 的 writer_rule。

初期在 peer 侧验证（收到 update 后检查签名，不合法则丢弃）。Relay 侧 interceptor 作为后续优化。

### 7.7 多 Relay 协同

同一 room 的多个 Public Relay 通过 Zenoh linkstate routing 自动同步，对等关系。

---

## 8. 限制与 Future Work

- **E2EE**：当前仅传输加密。未来引入 per-room symmetric key。
- **Thread 完整语义**：当前 EXT-11 是基础支持，完整 thread 可能需 sub-room 建模。
- **搜索标准化**：搜索 API 当前不标准化。
- **大房间优化**：1000+ 成员可能需要进一步分片。
- **CRDT 库抽象**：当前绑定 yrs。Engine 的 Storage Backend Abstraction 为替换留出空间。
- **Channel 命名空间治理**：当前全局扁平。未来可引入可选 registry。
- **Socialware Hook 动态加载**：Socialware 层的 Python Hook 通过 PyO3 callback 在运行时注册（priority >= 100）。协议层 Extension Hook 保持 Rust 编译时链接。第三方 Extension 的加载机制（WASM / Python plugin）为 Future Work。
- **HTTP API Projection**：当前协议 spec 不定义 HTTP 接口。ezagent Python 包内置了基于 FastAPI 的 HTTP Server（含 Chat UI），通过 `ezagent start` 启动。如需独立 HTTP 服务或非 Python 语言集成，可基于 PyO3 API 自行封装。
- **NAT Traversal 优化**：当前跨网段通信依赖 Public Relay 中转。未来可探索 STUN/TURN 或 Zenoh 原生打洞能力。
- **Gossip 收敛时间**：大规模 mesh（100+ peer）下的 gossip 路由收敛可能需要优化。

---

## 9. Specification 撰写指引

Spec 按 Engine 架构分层：

```
§1  Introduction & Terminology
§2  ezagent.bus Engine
    §2.1  Datatype Registry (storage_type, key_pattern, writer_rule, dependencies)
    §2.2  Hook Pipeline (三阶段形式化定义, 执行顺序, 约束)
    §2.3  Annotation Pattern (设计模式, ext.{ext_id} 命名空间, 签名策略)
    §2.4  Index Builder (声明格式, refresh 策略, API 映射)
§3  Storage / Sync Backend
    §3.1  CRDT Backend (Yjs usage profile)
    §3.2  Network Backend (Zenoh key space, QoS)
    §3.3  y-zenoh Sync Protocol (query/reply, pub/sub, signed envelope)
    §3.4  Persistence & Recovery
§4  Built-in Datatypes
    §4.1-4.4  Identity, Room, Timeline, Message (统一格式)
§5  Extension Datatypes
    §5.1-5.14  EXT-01 到 EXT-14 (统一格式)
§6  Relay Configuration
§7  Compliance & Interoperability (Level 0-3, test suites)
§8  Engine Operations (由 Index 自动导出，通过 PyO3 暴露)
```

**Extensions Spec 独立文档**：每个 extension 一份。Bus Spec + Extensions Specs 构成完整规范。

---

## 10. Implementation Architecture

### 10.1 Crate 结构

```
ezagent/
├── crates/
│   ├── ezagent-engine/              # Layer 0: Engine 核心
│   │   ├── src/
│   │   │   ├── datatype.rs          # Datatype Registry
│   │   │   ├── hook.rs              # Hook Pipeline
│   │   │   ├── annotation.rs        # Annotation Pattern helpers
│   │   │   ├── index.rs             # Index Builder
│   │   │   ├── backend.rs           # Storage/Sync Backend trait
│   │   │   └── lib.rs
│   │   └── Cargo.toml
│   │
│   ├── ezagent-backend-zenoh/       # Backend: yrs + Zenoh
│   │   ├── src/
│   │   │   ├── provider.rs          # y-zenoh sync
│   │   │   ├── storage.rs           # CRDT-aware snapshot
│   │   │   ├── keyspace.rs          # Key expression mapping
│   │   │   └── lib.rs
│   │   └── Cargo.toml               # deps: yrs, zenoh
│   │
│   ├── ezagent-builtins/            # Layer 1: Built-in Datatypes
│   │   ├── src/
│   │   │   ├── identity.rs
│   │   │   ├── room.rs
│   │   │   ├── timeline.rs
│   │   │   ├── message.rs
│   │   │   └── lib.rs
│   │   └── Cargo.toml               # deps: ezagent-engine
│   │
│   └── ezagent-extensions/          # Layer 2: Extension Datatypes
│       ├── src/
│       │   ├── mutable.rs           # EXT-01
│       │   ├── collab.rs            # EXT-02
│       │   ├── reactions.rs         # EXT-03
│       │   ├── reply_to.rs          # EXT-04
│       │   ├── cross_room_ref.rs    # EXT-05
│       │   ├── channels.rs          # EXT-06
│       │   ├── moderation.rs        # EXT-07
│       │   ├── receipts.rs          # EXT-08
│       │   ├── presence.rs          # EXT-09
│       │   ├── media.rs             # EXT-10
│       │   ├── threads.rs           # EXT-11
│       │   ├── drafts.rs            # EXT-12
│       │   ├── profile.rs           # EXT-13
│       │   ├── watch.rs             # EXT-14
│       │   └── lib.rs
│       └── Cargo.toml               # deps: ezagent-engine, ezagent-builtins
│
├── bindings/
│   └── python/                      # PyO3 binding (唯一桥接层)
│       ├── src/
│       │   ├── lib.rs               # #[pymodule] 入口
│       │   ├── engine.rs            # Engine Python wrapper
│       │   ├── bus.rs               # Bus API (Room/Message/Timeline)
│       │   ├── extensions.rs        # Extension API (从声明自动生成)
│       │   ├── hooks.rs             # Socialware Python Hook callback
│       │   ├── events.rs            # Event Stream → Python async iterator
│       │   └── types.rs             # Python dataclass 定义
│       ├── Cargo.toml               # deps: pyo3, ezagent-engine, ...
│       └── pyproject.toml           # maturin build config
│
│   └── ezagent-relay/               # Public Relay 独立 binary
│       ├── src/
│       │   ├── main.rs              # 独立 binary 入口
│       │   ├── config.rs            # Relay 配置管理
│       │   ├── registration.rs      # Entity 注册服务
│       │   ├── discovery.rs         # Discovery 索引服务 (Level 3)
│       │   ├── acl.rs               # Access Control interceptor (Level 2+)
│       │   └── metrics.rs           # 运营指标 (Prometheus)
│       └── Cargo.toml               # deps: zenoh (router mode), rocksdb
│
├── python/
│   └── ezagent/                     # Pure Python 层
│       ├── __init__.py              # re-export from native extension
│       ├── cli.py                   # CLI 入口 (typer)
│       ├── server.py                # HTTP Server (FastAPI/Starlette)
│       ├── agent.py                 # Agent base class
│       ├── dsl.py                   # @when / @hook decorator DSL
│       └── socialware/              # Socialware 四原语 Python 实现
│
├── frontend/                        # React Chat UI (静态资源)
│   ├── src/
│   ├── package.json
│   └── dist/                        # 构建产物，打包进 pip/DMG
│
├── desktop/                         # Desktop App 打包配置
│   ├── launcher/                    # 轻量启动器
│   ├── resources/python/            # 内嵌 python-build-standalone
│   ├── macos/                       # DMG / brew formula
│   ├── windows/                     # MSI / winget
│   └── linux/                       # AppImage / deb
│
└── config/
    ├── default.toml
    └── relay.json5
```

关键变化：`ezagent-engine` 是纯抽象层，不依赖 yrs 或 Zenoh。`ezagent-backend-zenoh` 是可替换的后端实现。`ezagent-builtins` 和 `ezagent-extensions` 都依赖 `ezagent-engine`，使用完全相同的 API 注册 datatype、hook、annotation、index。PyO3 binding 是 Engine 的唯一外部接口。CLI、HTTP Server、Desktop App 全部在 Python 层实现。`ezagent-relay` 是独立的 Rust binary，以 Zenoh router mode 运行，提供 Public Relay 服务（跨网络桥接、Cold Storage、Discovery）。Relay 不依赖 PyO3——它是纯 Rust 服务端程序。

### 10.2 Engine Operation 清单

由 Index Builder 自动导出。每个 Index 声明中的 `operation_id` 标识一个 Engine Operation。所有 Operation 通过 PyO3 暴露为 Python async API，定义在 ezagent-py-spec 中。

```yaml
# === Built-in Operations ===
identity.init              # 初始化密钥对
identity.register          # 向 Public Relay 注册身份（首次使用）
identity.whoami            # 当前 Entity 信息
identity.get_pubkey        # 查询公钥
identity.verify_peer       # P2P 身份验证（challenge-response）

room.create                # 创建 Room
room.list                  # 列出 Room
room.get                   # 查看 Room Config
room.update_config         # 更新 Config
room.join                  # 加入 Room
room.leave                 # 离开 Room
room.invite                # 邀请成员
room.members               # 成员列表

timeline.list              # 消息列表（分页）
timeline.get_ref           # 单条 Ref
message.send               # 发送消息
message.delete             # 删除消息

annotation.list            # Ref 上的 annotation
annotation.add             # 添加 annotation
annotation.remove          # 删除 annotation

events.stream              # 实时事件流 (async iterator)
status                     # 节点状态

# === Extension Operations ===
mutable.update             # EXT-01: 编辑消息
mutable.versions           # EXT-01: 版本历史
collab.get_acl             # EXT-02: 协作 ACL
collab.update_acl          # EXT-02: 更新 ACL
collab.connect             # EXT-02: 协作实时连接
reactions.add              # EXT-03: 添加 Reaction
reactions.remove           # EXT-03: 移除 Reaction
crossroom.preview          # EXT-05: 跨 Room 预览
channels.list              # EXT-06: Channel 列表
channels.refs              # EXT-06: Channel 内 Ref
moderation.redact          # EXT-07: 内容审核
receipts.update            # EXT-08: 更新阅读进度 (Mode B)
receipts.summary           # EXT-08: 阅读状态摘要
presence.set               # EXT-09: 设置在线状态 (Mode B)
presence.list              # EXT-09: 在线用户列表
media.upload               # EXT-10: 上传媒体
media.get                  # EXT-10: 获取媒体
threads.list               # EXT-11: Thread 列表
drafts.save                # EXT-12: 保存草稿 (Mode B)
drafts.load                # EXT-12: 加载草稿
profile.get                # EXT-13: 获取 Profile
profile.update             # EXT-13: 更新 Profile
discovery.search           # EXT-13: 发现搜索 (relay-defined)
watch.set                  # EXT-14: 设置 Watch
watch.unset                # EXT-14: 取消 Watch
watch.list                 # EXT-14: Watch 列表
```

### 10.3 Event Types (by after_write hooks)

Event Stream 通过 PyO3 暴露为 Python async iterator。Event 类型如下：

```
# Built-in
message.new                    # Timeline.ref_change_detect
message.deleted                # Timeline.ref_change_detect
room.member.joined             # Room.member_change_notify
room.member.left               # Room.member_change_notify
room.config.updated            # Room (generic)

# Extension
message.edited                 # EXT-01 Mutable
reaction.added                 # EXT-03 Reactions
reaction.removed               # EXT-03 Reactions
channel.activity               # EXT-06 Channels
moderation.action              # EXT-07 Moderation
presence.joined                # EXT-09 Presence
presence.left                  # EXT-09 Presence
typing.start                   # EXT-09 Presence
typing.stop                    # EXT-09 Presence
watch.ref_content_edited       # EXT-14 Watch
watch.ref_reply_added          # EXT-14 Watch
watch.ref_thread_reply         # EXT-14 Watch
watch.channel_new_ref          # EXT-14 Watch
```

---

## 11. Implementation Plan

### Phase 0：最小环路验证（2 周）

**目标**：yrs + Zenoh 基本可行性 + PyO3 Embedded 可行性。

**交付物**：ezagent-backend-zenoh crate 骨架，PyO3 Embedded 概念验证。

**P0-A: yrs + Zenoh sync 验证**

| # | 场景 | 预期 |
|---|------|------|
| P0-A-1 | 两个 peer 同步 Y.Map insert | 双方一致 |
| P0-A-2 | 并发 insert 不同 key | LWW 收敛 |
| P0-A-3 | 离线 → 对方写入 → 重连 → state query | 数据恢复 |
| P0-A-4 | Zenoh storage 持久化 | 新 peer 可 query 完整 state |

**P0-B: PyO3 Embedded 验证**

| # | 场景 | 预期 |
|---|------|------|
| P0-B-1 | Python 中通过 PyO3 创建 Y.Doc 并执行 set/get | 数据一致 |
| P0-B-2 | Python asyncio 事件循环内启动 Zenoh session | session 正常连接 |
| P0-B-3 | tokio async task → Python async callback 桥接 | callback 正常执行，无死锁 |
| P0-B-4 | 两个 Python 进程通过 Embedded Engine + Zenoh 同步 | 数据收敛 |

### Phase 1：Engine + Backend（3-4 周）

**目标**：ezagent-engine crate 四个组件，ezagent-backend-zenoh 生产级实现。

**交付物**：
- Datatype Registry: 注册/加载/依赖解析
- Hook Pipeline: 三阶段执行框架
- Annotation Pattern: ext.{ext_id} 读写
- Index Builder: 声明式 index 注册
- Signed Envelope + 断线恢复 + 本地持久化

| # | 场景 | 预期 |
|---|------|------|
| P1-1 | 注册 identity + room datatype，依赖解析 | identity 先加载 |
| P1-2 | pre_send hook chain 按 priority 执行 | 签名在最后 |
| P1-3 | after_write hook 不修改触发数据 | 违反则报错 |
| P1-4 | Annotation 写入和读取 | ext.{ext_id} 正确持久化 |
| P1-5 | Signed Envelope 签名/验证 | 无效签名被丢弃 |
| P1-6 | 断线 60s → 恢复 | 差量同步无丢失 |

### Phase 2：Built-in + Extensions（3-4 周）

**目标**：四个 built-in + EXT-01 到 EXT-14，全部 Rust 实现。

**交付物**：ezagent-builtins + ezagent-extensions。

| # | 场景 | 预期 |
|---|------|------|
| P2-1 | 创建 room → 发 immutable message | 端到端 |
| P2-2 | 编辑 mutable message | status → "edited" (EXT-01) |
| P2-3 | Reactions add/remove | ext.reactions 更新 (EXT-03) |
| P2-4 | Channel 聚合 | 跨 room tagged refs 归并 (EXT-06) |
| P2-5 | Moderation redact | overlay 合并渲染 (EXT-07) |
| P2-6 | Profile 发布 | discovery 可搜索 (EXT-13) |
| P2-7 | Watch → reply → 通知 | watch.ref_reply_added (EXT-14) |
| P2-8 | Level 0 peer + Level 2 peer 共存 | ext.* 保留不丢失 |
| P2-9 | 伪造 author | 签名验证失败 |
| P2-10 | Annotation 写入 | 任何成员可添加，key 含 signer_id |

### Phase 2.5：ezagent-py Binding（2-3 周）

**目标**：PyO3 binding + auto-gen Python API。`pip install ezagent` SDK 可用。

**交付物**：bindings/python + python/ezagent SDK (py-spec §1-7)。

| # | 场景 | 预期 |
|---|------|------|
| P2.5-1 | pip install ezagent → import ezagent | 成功 |
| P2.5-2 | Python 中创建 Engine + 连接 Relay | Engine 正常启动 |
| P2.5-3 | await bus.rooms.create() → .messages.send() | 端到端成功 |
| P2.5-4 | async for event in bus.events() | 收到 message.new 事件 |
| P2.5-5 | Extension auto-gen API (reactions, mutable, watch) | 正确调用 |
| P2.5-6 | @hook(pre_send) Python callback 注册并触发（底层机制，v0.9.5 由 @when 自动生成） | 正常执行 |

### Phase 3：CLI + HTTP API（1-2 周）

**目标**：CLI 命令接口 + HTTP API endpoint。后端完整可用。

**交付物**：CLI (cli-spec) + FastAPI server (http-spec)。

| # | 场景 | 预期 |
|---|------|------|
| P3-1 | ezagent CLI (room create, send, rooms) | 正常输出 |
| P3-2 | ezagent start → HTTP API 可用 | 端点正常响应 (localhost:8847) |
| P3-3 | GET /api/renderers → 返回 renderer 声明 | JSON 正确 |

### Phase 4：Chat App（3-4 周）

**目标**：React Chat UI + Render Pipeline + Desktop App。终端用户可用。

**交付物**：React 前端 + Render Pipeline (chat-ui-spec) + Desktop 打包 (app-prd)。

| # | 场景 | 预期 |
|---|------|------|
| P4-1 | ezagent start → HTTP server + Chat UI | 浏览器可访问 |
| P4-2 | 两个 peer 通过 Chat UI 互发消息 | 实时同步 |
| P4-3 | Level 0 自动渲染：无 renderer 的 DataType | 显示 key:value 卡片 |
| P4-4 | Level 1 声明式渲染：有 renderer 的 Extension | 按声明渲染 |
| P4-5 | Room Tab 切换 (Timeline ↔ Gallery) | 同一数据不同视图 |
| P4-6 | brew install / DMG 安装 | 双击打开可用 |

### Phase 5：Socialware（3-4 周）

**目标**：Socialware 四原语 + 示例 Socialware。Role-Driven Message 架构。Agent 驱动的协作。

**交付物**：Socialware Python Runtime（State Cache + Role/Flow 检查 Hook） + EventWeaver/TaskArena/ResPool 基础功能。

| # | 场景 | 预期 |
|---|------|------|
| P5-1 | @socialware decorator + Role/Flow 声明 | Socialware 正常加载，Hook 注册到 Pipeline |
| P5-2 | content_type="ta:task.propose" Message 发送 | EXT-17 namespace_check 通过，Role check 通过 |
| P5-3 | Flow transition: ta:task.claim → State Cache 更新 | Flow 状态正确推进，pre_send 拒绝非法转换 |
| P5-4 | State Cache 重建（节点重启后回放 Timeline） | 重建后状态与重启前一致 |
| P5-5 | TaskArena Kanban Room Tab（从 State Cache 查询） | 看板视图可用 |

### Gate Review

每个 Phase 结束时 checklist 全通过才能进入下一阶段。

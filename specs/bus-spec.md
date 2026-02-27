# ezagent.bus — Bus Layer Specification

> **ezagent** — Easy Agent Communication Protocol
>
> Bus Layer Specification: Engine, Backend, Built-in Datatypes

> **状态**：Draft
> **日期**：2026-02-26
> **版本**：0.9.1（新增 `ezagent/socialware/` 本地命名空间）
> **前置文档**：ezagent-protocol-v0.8.md

---

## 目录

```
§1   Introduction
§2   Terminology & Conventions
§3   ezagent.bus Engine
     §3.1  Datatype Registry
     §3.2  Hook Pipeline
           §3.2.1 - §3.2.5 (existing)
           §3.2.6  Socialware Hook 注册
     §3.3  Annotation Store
     §3.4  Index Builder
     §3.5  Datatype 声明格式
§4   Storage / Sync Backend
     §4.1  Backend Abstraction
     §4.2  CRDT Backend Requirements
     §4.3  Network Backend Requirements
     §4.4  Signed Envelope
     §4.5  Sync Protocol
     §4.6  Persistence
§5   Built-in Datatypes
     §5.1  Identity
     §5.2  Room
     §5.3  Timeline
     §5.4  Message
§6   Relay
     §6.1  定义
     §6.2  合规性等级
     §6.3  Access Control
     §6.4  多 Relay 协同
§7   Engine Operations
     §7.1  Operation 定义格式
     §7.2  Bus Operations
     §7.3  Event Stream
     §7.4  Error Codes
§8   Compliance & Interoperability
     §8.1  Peer 合规性层级
     §8.2  向前兼容性
     §8.3  互操作性测试要求
     §8.4  版本迁移
附录 A  Signed Envelope Binary Layout
附录 B  Zenoh Key Expression 完整参考
附录 C  Hook 执行序列示例
附录 D  与 Matrix/Zulip 概念映射
附录 E  变更日志
```

---

## §1 Introduction

### §1.1 协议概述

ezagent 是一个基于 CRDT 的即时通信协议。协议定义了一个 **Engine** 抽象，由四个组件构成（Datatype Registry、Hook Pipeline、Annotation Store、Index Builder）。所有协议功能——无论是必须支持的 Identity/Room/Timeline/Message，还是可选的 Reactions/Channels/Moderation——都是 Engine 的实例，使用完全相同的声明格式。

本文档（Bus Spec）定义：

- Engine 的四个组件的行为规范
- Storage/Sync Backend 的接口要求
- 四个 Built-in Datatypes 的完整规范
- Relay、API Surface 和 Compliance 要求

Extension Datatypes 定义在独立的 Extensions Spec 文档中。

### §1.2 设计目标

1. **Entity-Agnostic**：协议不区分 human 和 agent。任何持有合法密钥对的参与者都是 entity。
2. **一切皆 Datatype**：Built-in 与 Extension 使用完全相同的声明格式和执行机制。
3. **Hook + Annotation 驱动**：功能逻辑通过 Hook 声明执行时机，通过 Annotation 附加元数据，通过 Index 暴露查询能力。
4. **Backend 可替换**：CRDT 引擎和网络层是可替换的。Spec 定义抽象接口，不绑定具体实现。
5. **最小 Bus，可插拔 Extension**：Bus Spec 定义最小可用 IM。所有增强功能通过 Extension 提供。

### §1.3 文档约定

本文档中的关键词 "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", "OPTIONAL" 按照 [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119) 解释。

数据结构示例使用 YAML 便于阅读。实际传输格式由 Backend 决定。

### §1.4 引用标准

| 标准 | 用途 |
|------|------|
| [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119) | 关键词定义 |
| [RFC 8032](https://datatracker.ietf.org/doc/html/rfc8032) | Ed25519 签名 |
| [RFC 4122](https://datatracker.ietf.org/doc/html/rfc4122) / UUIDv7 draft | Room ID 格式 |
| [ULID Spec](https://github.com/ulid/spec) | Ref ID 格式 |
| [RFC 8259](https://datatracker.ietf.org/doc/html/rfc8259) | JSON |
| [RFC 3339](https://datatracker.ietf.org/doc/html/rfc3339) | 时间戳格式 |

---

## §2 Terminology & Conventions

### §2.1 术语表

| 术语 | 定义 |
|------|------|
| **Engine** | ezagent 协议的核心抽象层，由 Datatype Registry、Hook Pipeline、Annotation Store、Index Builder 四个组件构成 |
| **Datatype** | Engine 中数据的基本单元。声明一种可存储、可同步的数据结构及其行为规则 |
| **Built-in Datatype** | 始终启用的 Datatype（Identity、Room、Timeline、Message），其 Hook 可注册全局作用范围 |
| **Extension Datatype** | 可选启用的 Datatype（Reactions、Channels 等），按 Room 的 `enabled_extensions` 加载 |
| **Hook** | 注册在 Engine 中的逻辑单元，在指定阶段（pre_send / after_write / after_read）和触发条件下执行 |
| **Annotation** | 附着在已有数据节点上的元数据，存储在 `ext.annotations` 命名空间中 |
| **Index** | Datatype 对外暴露的查询/聚合能力，可映射为 API 端点 |
| **Entity** | 协议中的参与者，由 Entity ID + Ed25519 密钥对标识。不区分 human 和 agent |
| **Entity ID** | 格式为 `@{local_part}:{relay_domain}` 的唯一标识符 |
| **Peer** | 运行 ezagent 协议栈的节点实例 |
| **Relay** | 提供跨网络桥接、离线恢复和实体发现的可选公共服务节点（Public Relay） |
| **Peer** | 每个 ezagent 实例。内嵌 Zenoh peer + 本地 RocksDB，是自给自足的网络节点 |
| **Scouting** | Zenoh 的 multicast 自动发现机制，用于同网段 peer 的零配置互联 |
| **Room** | 一组 Entity 的通信域，定义成员关系和权限策略 |
| **Ref** | Timeline Index 中的一条引用记录（Y.Map），指向一个 Content Object |
| **Content Object** | Layer 2 的实际消息内容或协作文档 |
| **Timeline Index** | Layer 1 的消息排序索引，由 CRDT 维护全局一致的顺序 |
| **Timeline Window** | Timeline Index 的时间分片单位，默认按月 |
| **Signed Envelope** | 包含签名信息的 CRDT update 封装格式 |
| **Backend** | Engine 的存储/同步实现层（参考实现：yrs + Zenoh） |

### §2.2 数据格式约定

- 时间戳：[RFC 3339](https://datatracker.ietf.org/doc/html/rfc3339)，UTC 时区，精度至毫秒。
- 哈希：`sha256:{hex}`，小写十六进制。
- 签名：`ed25519:{base64url}`。
- Entity ID：`@{local_part}:{relay_domain}`。local_part 由 `[a-z0-9._-]` 组成，长度 1-64。relay_domain 由 `[a-z0-9.-]` 组成，长度 1-253。
- Room ID：UUIDv7（含时间戳的 UUID）。
- Ref ID：ULID（Universally Unique Lexicographically Sortable Identifier）。
- Content ID：取决于 content_type。`immutable` 使用 `sha256:{hex}`，其他类型使用 `uuid:{UUIDv7}`。
- JSON Canonicalization：序列化为 JSON 时，key 按 Unicode 码点升序排列，无多余空白，字符串使用 UTF-8 NFC 正规化。

### §2.3 标记约定

```
[MUST]     此规则为强制要求，违反将导致不兼容
[SHOULD]   此规则为推荐，有合理理由时可偏离
[MAY]      此规则为可选
```

---

## §3 ezagent.bus Engine

Engine 是协议的核心抽象。所有协议功能通过 Engine 的四个组件声明和执行。

### §3.1 Datatype Registry

#### §3.1.1 Datatype 定义

每个 Datatype MUST 包含以下字段：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `id` | string | MUST | 全局唯一标识符。Built-in 使用保留名称：`identity`, `room`, `timeline`, `message` |
| `version` | string | MUST | 语义化版本号 |
| `dependencies` | string[] | MUST | 依赖的其他 Datatype ID 列表。空列表表示无依赖 |

每个 Datatype MUST 声明一个或多个数据结构（data entry），每个 data entry 包含：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `id` | string | MUST | data entry 标识符，在 Datatype 内唯一 |
| `storage_type` | enum | MUST | 存储类型（见 §3.1.2） |
| `key_pattern` | string | MUST | 存储路径模板（见 §3.1.3） |
| `persistent` | boolean | MUST | 是否要求 Relay 持久化 |
| `writer_rule` | string | MUST | 写入权限表达式（见 §3.1.4） |

#### §3.1.2 storage_type 枚举

实现 MUST 支持以下五种存储类型：

| 类型 | 语义 | 并发模型 | 持久化 |
|------|------|---------|--------|
| `crdt_map` | 键值映射，支持并发写入 | LWW per key | 由 `persistent` 决定 |
| `crdt_array` | 有序列表，CRDT 排序 | YATA insertion order | 由 `persistent` 决定 |
| `crdt_text` | 可协作编辑的文本 | YATA character-wise | 由 `persistent` 决定 |
| `blob` | 不可变二进制对象，content-addressed | 一次写入，不可修改 | 由 `persistent` 决定 |
| `ephemeral` | 临时数据，不保证送达 | last-write-wins | 否 |

`crdt_map`、`crdt_array`、`crdt_text` 统称为 "CRDT types"。Backend MUST 为 CRDT types 提供以下能力：

- 并发写入时自动冲突解决
- Initial sync（获取完整状态或差量）
- Live sync（实时增量更新传播）

`blob` 类型 MUST 满足：内容由哈希唯一标识，写入后不可修改。

`ephemeral` 类型：丢失不影响协议正确性。Backend SHOULD 尽力传递但 MAY 丢弃。

#### §3.1.3 key_pattern 语法

key_pattern 是存储路径的模板字符串。MUST 包含以下保留变量：

| 变量 | 含义 | 示例值 |
|------|------|--------|
| `{room_id}` | Room 的 UUIDv7 | `01957a3b-...` |
| `{entity_id}` | Entity ID（含 @ 前缀和 relay domain） | `@alice:relay-a.example.com` |
| `{YYYY-MM}` | 时间窗口标识 | `2026-02` |
| `{content_id}` | Content Object ID | `sha256:a1b2c3...` 或 `uuid:...` |
| `{blob_hash}` | Blob 的 SHA-256 哈希 | `a1b2c3d4...` |
| `{ext_id}` | Extension Datatype ID | `moderation` |

CRDT types 的 key_pattern MUST 以 `/{state|updates}` 结尾，表示该路径下有两个 sub-key：`state`（完整状态）和 `updates`（增量更新）。

实现 MUST 保证同一 key_pattern 下的所有数据作为一个逻辑单元同步。

#### §3.1.4 writer_rule 语法

writer_rule 是一个布尔表达式，定义谁可以写入该数据。实现 MUST 在接受写入前验证 writer_rule。

预定义的表达式原语：

| 原语 | 含义 |
|------|------|
| `signer == {entity_id_expr}` | 签名者必须等于指定 entity |
| `signer ∈ room.members` | 签名者必须是 Room 成员 |
| `signer.power_level >= {level}` | 签名者的 power_level 必须达到指定值 |
| `signer == ref.author` | 签名者必须是 ref 的作者 |
| `signer ∈ acl.editors` | 签名者必须在 ACL 编辑者列表中 |
| `annotation_key contains signer_id` | annotation 的 key 中必须包含签名者 ID |
| `one_time_write` | 仅允许创建，不允许修改 |

原语可用 `AND` / `OR` 组合。实现 MAY 支持额外的自定义原语。

#### §3.1.5 Dependency Resolution

Engine MUST 按以下规则加载 Datatype：

1. [MUST] 无循环依赖。如果检测到循环依赖，Engine MUST 拒绝加载并报错。
2. [MUST] Datatype 的所有 `dependencies` 必须在该 Datatype 之前完成加载。
3. [MUST] Built-in Datatypes（`identity`, `room`, `timeline`, `message`）始终加载，不受 `enabled_extensions` 控制。
4. [MUST] Extension Datatypes 仅在 Room Config 的 `enabled_extensions` 列表中出现时加载。
5. [SHOULD] 加载顺序在满足依赖约束的前提下保持稳定（确定性排序）。

---

### §3.2 Hook Pipeline

#### §3.2.1 Hook 定义

每个 Hook MUST 包含以下字段：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `id` | string | MUST | 全局唯一标识符 |
| `phase` | enum | MUST | `pre_send` / `after_write` / `after_read` |
| `trigger.datatype` | string | MUST | 监听的 Datatype ID。`"*"` 表示全局 |
| `trigger.event` | enum | MUST | `insert` / `update` / `delete` / `any` |
| `trigger.filter` | string | MAY | 附加过滤条件 |
| `priority` | integer | MUST | 执行顺序。0 为最高优先级，数字越大越晚 |
| `source` | string | MUST | 注册此 Hook 的 Datatype ID |

#### §3.2.2 阶段定义

**Pre-send 阶段**

执行时机：数据写入 CRDT 之前，签名之前。

| 约束 | 级别 |
|------|------|
| MAY 修改待写入的数据（添加字段、修改值） | |
| MAY 向 `ext.annotations` 添加 annotation | |
| MAY 拒绝写入（返回错误，中止整个写入操作） | |
| MUST NOT 读取尚未写入的数据 | |
| MUST NOT 发起阻塞性外部请求（网络 I/O 等）。如需外部数据，SHOULD 异步获取后回写为 annotation | |
| 所有 pre_send hook 完成后，签名 hook 最后执行 | |

**After-write 阶段**

执行时机：数据已 apply 到本地 CRDT 之后，签名验证通过之后。

| 约束 | 级别 |
|------|------|
| MAY 生成 SSE 事件 | |
| MAY 更新 Index | |
| MAY 写入**其他** Datatype 的数据 | |
| MAY 触发异步任务 | |
| MUST NOT 修改触发本 hook 的那个数据 | |
| MUST NOT 拒绝已 apply 的数据 | |

**After-read 阶段**

执行时机：从 CRDT 读取数据后，API 响应之前。

| 约束 | 级别 |
|------|------|
| MAY 变换/增强 API 响应数据 | |
| MAY 利用 annotation 渲染增强信息 | |
| MAY 聚合多个 Datatype 的数据 | |
| MAY 异步回写 annotation（不阻塞当前响应） | |
| MUST NOT 修改 CRDT 数据 | |
| SHOULD NOT 阻塞超过合理时间（建议 < 100ms） | |

#### §3.2.3 执行顺序

同一阶段内的 Hook 执行顺序 MUST 遵循：

1. 按 `priority` 值升序排列（0 最先）。
2. 相同 `priority` 的 Hook，按 `source` Datatype 的依赖拓扑序排列（被依赖的先执行）。
3. 相同 `priority` 且无依赖关系的 Hook，执行顺序 MUST 是确定性的（实现自行定义稳定排序规则，如按 hook id 字母序）。

特殊规则：

- [MUST] Identity 的 `sign_envelope` hook（pre_send, priority 0）MUST 在所有其他 pre_send hook 之后实际执行签名操作，尽管其 priority 为 0。实现 MUST 将签名作为 pre_send 阶段的最终步骤。
- [MUST] Identity 的 `verify_signature` hook（after_write, priority 0）MUST 在所有其他 after_write hook 之前执行。签名验证失败时，后续 hook MUST NOT 执行。

#### §3.2.4 全局 Hook 限制

`trigger.datatype: "*"` 的 Hook（全局 Hook）MUST 满足：

- [MUST] 仅 Built-in Datatypes 允许注册全局 Hook。
- [MUST] Extension Datatypes MUST NOT 注册全局 Hook。Extension 的 Hook 只能监听具体的 Datatype。
- [SHOULD] 全局 Hook 数量应尽量少。参考实现中，仅 Identity 和 Room 注册全局 Hook。

#### §3.2.5 Hook 失败处理

- [MUST] pre_send hook 返回错误时，整个写入操作 MUST 中止，CRDT 不得被修改。
- [MUST] after_write hook 失败 MUST NOT 影响已 apply 的数据。实现 SHOULD 记录错误日志。
- [SHOULD] after_read hook 失败时，实现 SHOULD 返回未增强的原始数据，而非报错。

#### §3.2.6 Socialware Hook 注册

[MUST] Engine MUST 支持通过 Foreign Function Interface（PyO3 callback）注册应用层 Hook callback。此机制区别于协议层 Extension Hook。

**Socialware Hook 与 Extension Hook 的区别**：

| 属性 | Extension Hook (协议层) | Socialware Hook (应用层) |
|------|------------------------|------------------------|
| 实现语言 | Rust（编译进 binary） | Python（运行时注册） |
| 行为一致性 | 所有 peer MUST 一致 | 每个 Socialware 可不同 |
| 注册时机 | Engine 启动时加载 | 运行时通过 PyO3 callback 注册 |
| 可注册全局 Hook | 否（Built-in 限制） | 否（同 Extension 限制） |
| priority 范围 | 0-99（协议保留） | 100+（应用层） |

- [MUST] Socialware Hook 的 priority MUST >= 100。0-99 保留给 Built-in 和 Extension Hook。
- [MUST] priority < 100 的 Socialware Hook 注册请求 MUST 被拒绝。
- [MUST] Socialware Hook 遵循 §3.2.2 的阶段约束和 §3.2.5 的失败处理规则。

[SHOULD] Python Hook 执行模型：
  - pre_send: Rust → 释放 GIL → 获取 GIL → Python callback → 释放 GIL → Rust 继续
  - after_write: 通过 tokio::spawn_blocking 异步执行
  - after_read: 同 pre_send

---

### §3.3 Annotation Store

#### §3.3.1 存储位置

每个 CRDT type 的数据节点（Y.Map）MAY 包含一个 `ext.annotations` 子 Y.Map，用于存储 Annotation。

[MUST] `ext.annotations` 是 Engine 的保留命名空间。任何 Datatype 或 Extension MUST NOT 将 `ext.annotations` 用于非 Annotation 目的。

[MUST] 与 `ext.annotations` 并列的 `ext.{ext_id}` 命名空间由对应 Extension Datatype 管理，不属于 Annotation Store。

```
ref Y.Map:
  ref_id: ...                      # Bus 字段
  ext.reactions: ...               # Extension 管理的字段
  ext.channels: ...                # Extension 管理的字段
  ext.annotations: Y.Map { ... }   # Annotation Store (Engine 管理)
```

#### §3.3.2 Annotation Key 格式

Annotation 的 key MUST 为 `{type}:{annotator_entity_id}` 格式。

| 部分 | 规则 |
|------|------|
| `type` | `[a-z0-9_-]+`，长度 1-64。描述 annotation 的语义类型 |
| `annotator_entity_id` | 有效的 Entity ID，标识是谁写入了此 annotation |

特殊 annotator：`@system:local` 是实现内部 Hook 系统的保留 ID，表示由本地 Hook 自动生成。

示例：

```
"link_preview:@system:local"
"watch:@agent-1:relay-a.example.com"
"task_status:@agent-1:relay-a.example.com"
```

#### §3.3.3 权限规则

- [MUST] 任何 Room member 都 MAY 在该 Room 内任何 ref 的 `ext.annotations` 上添加 annotation。
- [MUST] Annotation key 中的 `annotator_entity_id` 必须等于签名者。实现 MUST 验证此约束。
- [MUST] Entity 只能删除或修改自己创建的 annotation（key 中包含自己的 entity_id）。
- [MAY] Relay 管理员可通过 Moderation Extension 移除恶意 annotation。

#### §3.3.4 Annotation 值格式

Annotation 的值 MUST 是 JSON-compatible 数据。实现 MUST 支持以下 JSON 类型作为 annotation 值：string, number, boolean, null, array, object。

实现 MUST NOT 假设 annotation 值的 schema——annotation 的语义由写入者和消费者之间的约定决定，Engine 不验证值的结构。

#### §3.3.5 与 CRDT 的交互

- [MUST] Annotation 写入遵循宿主 Y.Map 的 LWW 语义。并发写入同一 annotation key 时，最后写入者胜出。
- [MUST] Annotation 随宿主数据一起同步。不需要独立的同步通道。
- [MUST] 不支持某个 Extension 的 Peer 收到包含未知 annotation 的数据时，MUST 保留该 annotation（Y.Map 默认行为），MUST NOT 删除。

---

### §3.4 Index Builder

#### §3.4.1 Index 定义

每个 Index MUST 包含以下字段：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `id` | string | MUST | 在所属 Datatype 内唯一 |
| `input` | string | MUST | 数据来源描述（哪些 Datatype 的哪些数据） |
| `transform` | string | MUST | 变换逻辑描述（输入 → 输出的映射规则） |
| `refresh` | enum | MUST | 更新策略：`on_change` / `on_demand` / `periodic` |
| `operation_id` | string / null | MUST | 映射的操作标识。`null` 表示内部 Index |

#### §3.4.2 Refresh 策略

| 策略 | 含义 | 要求 |
|------|------|------|
| `on_change` | after_write hook 触发时增量更新 | [MUST] Index 在数据变化后的合理时间内（SHOULD < 1s）反映最新状态 |
| `on_demand` | API 请求时实时计算 | [MUST] 每次请求返回的数据 MUST 基于当前 CRDT 状态 |
| `periodic` | 定时重建 | [SHOULD] 重建周期可配置。默认 SHOULD 不超过 5 分钟 |

#### §3.4.3 Operation 映射

- [MUST] `operation_id` 非 null 的 Index MUST 在 Engine Operation 清单中有对应操作，并通过 PyO3 暴露为 Python async method。
- [SHOULD] operation_id 遵循 `{namespace}.{action}` 命名约定（如 `room.create`, `reactions.add`）。
- [MAY] 实现可以为同一 Index 提供多种访问方式（Python SDK, CLI, HTTP）。

注：`operation_id` 标识操作语义，不隐含任何传输协议。Python API 签名由 ezagent-py-spec §6 定义。

---

### §3.5 Datatype 声明格式

所有 Datatype（Built-in 和 Extension）MUST 使用以下统一声明格式：

```yaml
id:            string          # [MUST] 全局唯一
version:       string          # [MUST] 语义化版本号
dependencies:  string[]        # [MUST] 依赖列表（空 = 无依赖）

datatypes:                     # [MUST] 至少一个 data entry（空列表表示纯 Hook Datatype）
  - id:            string
    storage_type:  enum
    key_pattern:   string
    persistent:    boolean
    writer_rule:   string

hooks:                         # [MAY] Hook 列表
  pre_send:    Hook[]
  after_write: Hook[]
  after_read:  Hook[]

annotations:                   # [MAY] 此 Datatype 使用的 Annotation 描述
  on_ref:         {}           # 附着在 ref 上的 ext.{ext_id} 或 ext.annotations.*
  on_room_config: {}           # 附着在 room config 上的 ext.{ext_id}
  standalone_doc: {}           # 独立 doc 中的数据

indexes:                       # [MAY] Index 列表
  - id:            string
    input:         string
    transform:     string
    refresh:       enum
    operation_id:  string / null
```

实现 MUST 能够解析此格式并据此加载 Datatype。

Datatype 有两种加载方式：
1. **编译时注册**（Rust trait impl）：Built-in + Extension Datatypes。协议层行为，所有 peer 一致。
2. **运行时 Hook 注册**（PyO3 callback）：Socialware 层通过 Python @hook decorator 注册应用级 Hook（参见 §3.2.6）。不创建新 Datatype，仅在已有 Datatype 上挂载 Hook。

[MUST] 统一声明格式同时作为 Python API 自动生成的输入。详见 ezagent-py-spec §6。

#### §3.5.2 Renderer 声明 [MAY]

统一声明格式的每个组件 MAY 附带 `renderer` 字段，用于声明 UI 渲染方式。`renderer` 字段不影响协议层行为——CRDT 同步、Hook 执行、Annotation 存储、Index 计算均不受影响。`renderer` 字段由前端实现消费，用于 Render Pipeline（详见 chat-ui-spec）。

```yaml
# 完整的统一声明格式（含 renderer）

id:            string
version:       string
dependencies:  string[]

datatypes:
  - id:            string
    storage_type:  enum
    key_pattern:   string
    persistent:    boolean
    writer_rule:   string
    renderer:                          # [MAY] Content Renderer 声明
      type:          string            #   预定义渲染器类型
      field_mapping: map               #   字段 → 显示位置

hooks:
  pre_send:    Hook[]
  after_write: Hook[]
  after_read:  Hook[]

annotations:
  on_ref:
    "{key}":  "{schema}"
    renderer:                          # [MAY] Decorator 声明
      position:    enum                #   above | below | inline | badge | overlay
      type:        string              #   预定义装饰器类型
      interaction: map                 #   交互行为
  on_room_config: {}
  standalone_doc: {}

indexes:
  - id:            string
    input:         string
    transform:     string
    refresh:       enum
    operation_id:  string / null
    renderer:                          # [MAY] Room Tab / Layout 声明
      as_room_tab:   boolean           #   是否作为 Room Tab
      tab_label:     string            #   Tab 显示名称
      tab_icon:      string            #   Tab 图标
      layout:        string            #   预定义布局类型
      layout_config: map               #   布局配置
```

- [MAY] 未声明 `renderer` 时，前端实现 SHOULD 使用 schema-derived 自动生成的默认渲染（Level 0）。
- [MAY] `renderer` 声明可被自定义组件覆盖（Level 2）。详见 chat-ui-spec §7 Progressive Override。
- [MUST] `renderer` 字段 MUST 通过 PyO3 暴露给 Python 层，供 HTTP Server 传递给前端。详见 py-spec §6.7。

---

## §4 Storage / Sync Backend

### §4.1 Backend Abstraction

Engine 通过 Backend Abstraction 与底层存储和同步交互。Backend MUST 提供以下能力：

| 能力 | 说明 |
|------|------|
| `create_doc(storage_type, key_pattern)` | 创建一个新的数据文档 |
| `write(doc, change)` | 向文档提交变更 |
| `read(doc)` | 读取文档当前状态 |
| `subscribe(doc, callback)` | 监听文档变化 |
| `initial_sync(doc)` | 与其他 Peer 同步文档完整状态 |
| `publish_update(doc, update)` | 向其他 Peer 发送增量更新 |

Backend MUST 保证：

- [MUST] 所有 CRDT type 文档的写入最终在所有已连接 Peer 之间收敛（eventual consistency）。
- [MUST] `blob` 类型写入后，内容 MUST 不可变且可通过哈希唯一检索。
- [MUST] `ephemeral` 类型数据不要求持久化。Backend MAY 在资源不足时丢弃。
- [MUST] Backend 断线后 MUST 能够恢复（通过 initial_sync 重新获取差量）。

#### §4.1.2 Key Pattern 与存储路径

Datatype 声明中的 `key_pattern`（如 `ezagent/{room_id}/config/{state|updates}`）定义的是**协议层的寻址方案**——Peer 和 Relay 之间 Sync Protocol 使用此路径发布和订阅数据。

Backend 实现的内部存储路径 MAY 与 key_pattern 不同。Backend Abstraction 负责在协议路径和存储路径之间做映射。例如，Backend MAY 在存储时增加命名空间层级（如 `ezagent/entity/@{entity_id}/...` 和 `ezagent/room/{room_id}/...`），只要映射对 Engine 和其他 Peer 透明即可。

- [MUST] Backend 的路径映射 MUST 是双向确定性的——给定一个 key_pattern 实例，MUST 能唯一确定存储路径，反之亦然。
- [MUST] Backend 的内部存储路径对 Engine 和 Sync Protocol 不可见。Engine 仅通过 key_pattern 操作数据。

### §4.2 CRDT Backend Requirements

CRDT Backend 为 `crdt_map`、`crdt_array`、`crdt_text` 类型提供冲突解决。

#### §4.2.1 冲突解决语义

| 类型 | 冲突解决策略 |
|------|------------|
| `crdt_map` | Per-key LWW（Last-Writer-Wins）。并发设置同一 key 时，时间戳更晚的值胜出 |
| `crdt_array` | YATA insertion order。并发插入时，CRDT 算法确定确定性的全局顺序 |
| `crdt_text` | Character-wise YATA。与 `crdt_array` 相同的 CRDT 算法，应用于字符级别 |

#### §4.2.2 未知字段保留

- [MUST] 当 Peer 收到包含未知 key 的 `crdt_map` 数据时，MUST 保留这些 key，MUST NOT 删除。
- [MUST] 当 Peer 修改 `crdt_map` 中已知的 key 时，MUST NOT 影响未知 key 的值。

此要求是向前兼容性的基础：低版本 Peer 处理高版本 Peer 写入的 `ext.*` 字段时，数据不丢失。

#### §4.2.3 GC（Garbage Collection）策略

- [MUST NOT] `crdt_array` 类型（Timeline Index）不得启用 CRDT GC。Ref 的 CRDT 元数据（YATA 的 left/right/origin 信息）必须永久保留以维持排序一致性。
- [MAY] `crdt_map` 和 `crdt_text` 类型的文档 MAY 启用 GC 以回收已删除数据的 tombstone。
- [SHOULD] GC 触发条件和策略由实现决定。推荐在文档 tombstone 数量超过存活数据的 50% 时触发。

### §4.3 Network Backend Requirements

Network Backend 为 Engine 提供 Peer 间的数据传输能力。

#### §4.3.1 必须能力

| 能力 | 说明 |
|------|------|
| Request/Reply | 按 key 请求数据的完整状态或差量 |
| Publish/Subscribe | 实时发布和接收增量更新 |
| Presence | 检测 Peer 的在线/离线状态（用于 `ephemeral` 类型） |
| Peer Discovery | 同网段 Peer 的零配置自动发现（Zenoh multicast scouting） |
| Queryable | Peer 可注册为 state query 的 responder |

#### §4.3.2 可靠性要求

| 数据类型 | 可靠性要求 |
|---------|-----------|
| Room Config | [MUST] 可靠传递，不可丢失 |
| Timeline Index | [MUST] 可靠传递 |
| Content Object | [MUST] 可靠传递 |
| Read Receipts | [SHOULD] 尽力传递，MAY 丢失 |
| Ephemeral | [MAY] 尽力传递 |

#### §4.3.3 传输安全

- [MUST] Peer 与 Public Relay 之间的连接 MUST 使用 TLS 1.3 或等效加密。
- [SHOULD] Peer 与 Peer 之间的 P2P 连接 SHOULD 支持传输层加密。
- [SHOULD] 实现 SHOULD 默认启用传输加密。
- [MAY] 未加密连接 MAY 用于本地开发环境（localhost）。

**TLS 信任模型**：

| 场景 | 方案 | Zenoh 配置 |
|------|------|-----------|
| 公网 Relay | WebPKI（Let's Encrypt 等） | `root_ca_certificate` 不设置，使用系统默认信任链 |
| Self-Host / 本地 Relay | 自签 CA（mkcert / minica） | `root_ca_certificate` 指向自签 CA 证书 |
| P2P（同 LAN） | 不强制 TLS，通过 Signed Envelope 保证数据完整性 | [MAY] 使用 TCP 明文 |

#### §4.3.4 Peer Discovery

- [SHOULD] 实现 SHOULD 启用 Zenoh multicast scouting，自动发现同网段 Peer。
- [SHOULD] 实现 SHOULD 启用 Zenoh gossip 协议，在已发现的 Peer 之间传播路由信息。
- [SHOULD] Peer 对其已持有的 CRDT 文档 SHOULD 注册 Zenoh queryable，使其他 Peer 可直接获取 state。
- [MAY] 当 Peer 发现同 Room 的其他 Peer 在 LAN 内时，MAY 优先使用 P2P 直连传输，而非经 Relay 中转。

### §4.4 Signed Envelope

所有 CRDT update 在发送前 MUST 封装在 Signed Envelope 中。

#### §4.4.1 字段定义

| 字段 | 类型 | 说明 |
|------|------|------|
| `version` | u8 | Envelope 格式版本。当前 MUST 为 `1` |
| `signer_id` | string | 签名者的 Entity ID |
| `doc_id` | string | 目标文档的 key_pattern 实例化路径 |
| `timestamp` | i64 | Unix milliseconds (UTC) |
| `payload` | bytes | CRDT update 的二进制编码 |
| `signature` | 64 bytes | Ed25519 签名，覆盖上述所有字段 |

#### §4.4.2 签名规则

- [MUST] 签名覆盖 `version || signer_id || doc_id || timestamp || payload` 的拼接。
- [MUST] 接收方 MUST 验证签名。验证失败时 MUST 丢弃该 update，MUST NOT apply 到本地 CRDT。
- [MUST] `timestamp` 与接收方本地时间的偏差不得超过 5 分钟。超过则 MUST 丢弃。
- [SHOULD] 实现 SHOULD 缓存已验证的 public key 以避免重复查询。

#### §4.4.3 Binary Layout

见附录 A。

### §4.5 Sync Protocol

#### §4.5.1 Initial Sync

当 Peer 需要获取某个 CRDT 文档的最新状态时：

1. [MUST] Peer 向 `{key_pattern}/state` 路径发起请求，携带本地 state vector（如果有本地副本）。
2. [MUST] Responder（Public Relay、其他 Peer、或两者）回复完整状态或自 state vector 以来的差量。
3. [MUST] Peer 将收到的状态或差量 apply 到本地 CRDT 副本。
4. [SHOULD] 当多个 Responder 回复时，Peer SHOULD 选择 state vector 最完整的回复。
5. [SHOULD] Peer SHOULD 对其已持有的 CRDT 文档注册 queryable，使自身成为其他 Peer 的 state 来源。

#### §4.5.2 Live Sync

建立连接后：

1. [MUST] 本地 CRDT 产生 update 时，封装为 Signed Envelope 并发布到 `{key_pattern}/updates` 路径。
2. [MUST] 已订阅该路径的 Peer 收到后验证签名并 apply。
3. [MUST] Backend MUST 保证同一文档的 update 按因果序传递（同一发送者的 update 不乱序）。

#### §4.5.3 断线恢复

1. [MUST] 网络断线后，Peer MUST 保存未发送的 pending updates。
2. [MUST] 重连后，Peer MUST 对每个已同步的文档执行 initial sync 以获取缺失的 updates。
3. [MUST] 重连后，Peer MUST 发布所有 pending updates。
4. [SHOULD] 实现 SHOULD 支持自动重连，无需用户干预。

### §4.6 Persistence

#### §4.6.1 本地持久化

- [MUST] Peer MUST 将 `persistent: true` 的文档状态持久化到本地存储。
- [MUST] 进程重启后，Peer MUST 能从本地存储恢复文档状态，然后通过 initial sync 补齐差量。
- [MUST] Peer MUST 持久化 pending updates（断线期间的本地写入），确保重启后不丢失。
- [SHOULD] 本地持久化的数据 SHOULD 同时作为 Peer queryable 的数据源——其他 Peer 发起 state query 时，可从本 Peer 的本地存储获取数据，无需依赖 Relay。

#### §4.6.2 Relay 持久化

- [MUST] Relay MUST 持久化 `persistent: true` 且 key_pattern 在其管辖范围内的文档。
- [SHOULD] Relay SHOULD 定期合并累积的 CRDT updates 为单一 state snapshot，以减小 initial sync 的传输量。推荐每 100 次 update 合并一次。
- [MUST NOT] Relay MUST NOT 持久化 `ephemeral` 类型数据。

---

## §5 Built-in Datatypes

四个 Built-in Datatypes 使用 §3.5 定义的统一声明格式。它们始终加载，不受 `enabled_extensions` 控制。

### §5.1 Identity

#### §5.1.1 声明

```yaml
id: "identity"
version: "0.1.0"
dependencies: []
```

#### §5.1.2 Datatypes

**entity_keypair**

| 字段 | 值 |
|------|---|
| id | `entity_keypair` |
| storage_type | `blob` |
| key_pattern | `ezagent/@{entity_id}/identity/pubkey` |
| persistent | `true` |
| writer_rule | `signer == entity_id` |

#### §5.1.3 Entity ID 规范

Entity ID 格式：`@{local_part}:{relay_domain}`

```abnf
entity-id     = "@" local-part ":" relay-domain
local-part    = 1*64( ALPHA / DIGIT / "." / "_" / "-" )
relay-domain  = 1*253( ALPHA / DIGIT / "." / "-" )
ALPHA         = %x61-7A                        ; a-z (小写)
DIGIT         = %x30-39                        ; 0-9
```

- [MUST] local_part 只包含小写字母、数字、点、下划线、连字符。
- [MUST] relay_domain 是合法的 DNS 域名（小写）。
- [MUST] 整个 Entity ID 大小写敏感，比较时不做归一化。
- [MUST] Agent 和 Human 使用相同的 ID 格式，协议层不做区分。
- [MUST] relay_domain 是身份命名空间（identity namespace），不是网络地址。Entity 的通信路径可能是 P2P 直连或经 Relay 中转，但 Entity ID 始终不变。

#### §5.1.4 密钥体系

- [MUST] 每个 Entity 持有一个 Ed25519 长期身份密钥对。
- [MUST] Public key 编码为 32 字节原始格式，通过 Entity 的注册 Relay 分发。
- [SHOULD] 每个设备 MAY 有独立的设备密钥，由身份密钥签署形成信任链。
- [MUST] 私钥 MUST NOT 离开生成它的设备（除非用户显式导出）。

#### §5.1.5 身份注册

- [MUST] 首次使用 ezagent 时，Entity MUST 向一个 Public Relay 注册身份。
- [MUST] 注册过程 MUST 通过 TLS 加密连接进行，以确保 Relay 的真实性。
- [MUST] Relay MUST 验证 local_part 在该域内的唯一性。
- [MUST] Relay MUST 存储 entity_id → public_key 映射，并对外提供公钥查询服务。
- [MUST] 注册成功后，Peer MUST 将 Entity ID 和密钥对持久化到本地（`~/.ezagent/`）。
- [MUST] 注册是一次性操作。注册完成后，日常使用无需联系 Relay。

#### §5.1.6 P2P 身份验证

当 Peer A 在 LAN 上发现一个声称为 `@bob:{relay_domain}` 的 Peer B 时：

1. [MUST] Peer A 向 `{relay_domain}` 查询 `@bob` 的公钥（如果本地无缓存）。
2. [MUST] Peer A 向 Peer B 发送随机 nonce 作为 challenge。
3. [MUST] Peer B 用私钥签名 nonce 并返回。
4. [MUST] Peer A 用从 Relay 获取的公钥验证签名。验证通过则信任该 Peer。
5. [SHOULD] 验证通过后，Peer A SHOULD 缓存公钥，后续验证无需联系 Relay。
6. [MAY] 如果 Relay 不可达且本地无公钥缓存，MAY 降级为 TOFU（Trust On First Use），但 MUST 标记该 Peer 为 "unverified"。

#### §5.1.7 Hooks

**pre_send: sign_envelope**

| 字段 | 值 |
|------|---|
| trigger.datatype | `*`（全局） |
| trigger.event | `any` |
| priority | `0` |

- [MUST] 拦截所有出站 CRDT update。
- [MUST] 将 update 封装为 Signed Envelope（§4.4）。
- [MUST] 签名步骤在所有其他 pre_send hook 完成之后执行（尽管 priority 为 0，签名是 pre_send 阶段的最终步骤）。

**after_write: verify_signature**

| 字段 | 值 |
|------|---|
| trigger.datatype | `*`（全局） |
| trigger.event | `any` |
| priority | `0` |

- [MUST] 验证所有入站 Signed Envelope 的 Ed25519 签名。
- [MUST] 签名无效时，丢弃该 update，不 apply 到本地 CRDT，后续 hook 不执行。
- [SHOULD] 遇到未知 Extension 字段的签名时，验证 Bus 部分签名，标记 Extension 部分为 "unverified"。

#### §5.1.6 Indexes

**entity_lookup**

| 字段 | 值 |
|------|---|
| input | `ezagent/@*/identity/pubkey` |
| transform | `entity_id → public_key` |
| refresh | `on_demand` |
| operation_id | `identity.get_pubkey` |

---

### §5.2 Room

#### §5.2.1 声明

```yaml
id: "room"
version: "0.1.0"
dependencies: ["identity"]
```

#### §5.2.2 Datatypes

**room_config**

| 字段 | 值 |
|------|---|
| id | `room_config` |
| storage_type | `crdt_map` |
| key_pattern | `ezagent/{room_id}/config/{state\|updates}` |
| persistent | `true` |
| writer_rule | `signer.power_level >= admin` |

#### §5.2.3 Room Config Schema

Room Config 是一个 `crdt_map`，包含以下字段：

**Bus 字段（MUST）**：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `room_id` | UUIDv7 | MUST | 全局唯一 Room 标识 |
| `name` | string | MUST | 房间名称，1-256 字符 |
| `created_by` | Entity ID | MUST | 创建者 |
| `created_at` | RFC 3339 | MUST | 创建时间 |
| `membership.policy` | enum | MUST | `open` / `knock` / `invite` |
| `membership.members` | Map<Entity ID, role> | MUST | 成员列表。role: `owner` / `admin` / `member` |
| `power_levels.default` | integer | MUST | 默认 power level |
| `power_levels.events_default` | integer | MUST | 发消息所需 power level |
| `power_levels.admin` | integer | MUST | 修改 config 所需 power level |
| `power_levels.users` | Map<Entity ID, integer> | MAY | 用户级别覆盖 |
| `relays` | Array<{endpoint, role}> | MUST | Relay 列表。role: `primary` / `secondary` |
| `timeline.window_size` | string | MUST | 分片策略。当前仅支持 `monthly` |
| `enabled_extensions` | string[] | MUST | 启用的 Extension Datatype ID 列表 |

**Optional 字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `avatar_hash` | sha256 | 房间头像 |
| `encryption` | enum | `transport_only`（当前唯一支持值） |
| `timeline.max_refs_per_window` | integer | 单窗口最大 ref 数量，默认 100000 |

**Extension 字段（MAY）**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `ext.{ext_id}` | Y.Map | Extension 管理的配置数据（如 `ext.channels.hints`、`ext.moderation.power_level`） |
| `ext.annotations` | Y.Map | Annotation Store（Engine 管理，如 `channel_watch:@{entity_id}`） |

- [MUST] `ext.{ext_id}` 命名空间由对应 Extension 管理。Bus 实现 MUST 保留但 MUST NOT 解释这些字段。
- [MUST] `ext.annotations` 由 Annotation Store 管理（见 §3.3）。
- [MUST] 不支持某 Extension 的 Peer MUST 保留 Room Config 上的 `ext.*` 字段和 `ext.annotations`，MUST NOT 在更新 Config 时丢失这些字段。

#### §5.2.4 成员角色与 Power Level

| 角色 | 默认 power_level | 能力 |
|------|-----------------|------|
| `owner` | 100 | 所有操作 + 转移 ownership |
| `admin` | 50 | 修改 config、踢人、邀请 |
| `member` | 0 | 发消息、加 annotation |

- [MUST] power_level 比较使用 `>=`。
- [MUST] 只有 power_level 严格高于目标用户的成员才能踢出该用户。
- [MUST] `owner` 角色每个 Room 至少有一个。

#### §5.2.5 Hooks

**pre_send: check_room_write**

| 字段 | 值 |
|------|---|
| trigger.datatype | `*`（全局） |
| trigger.event | `any` |
| trigger.filter | `key starts with ezagent/{room_id}/` |
| priority | `10` |

- [MUST] 验证签名者是 Room 成员（`signer ∈ membership.members`）。
- [MUST] 非成员的写入 MUST 被拒绝。

**pre_send: check_config_permission**

| 字段 | 值 |
|------|---|
| trigger.datatype | `room_config` |
| trigger.event | `update` |
| priority | `20` |

- [MUST] 验证 `signer.power_level >= power_levels.admin`。

**after_write: member_change_notify**

| 字段 | 值 |
|------|---|
| trigger.datatype | `room_config` |
| trigger.event | `update` |
| trigger.filter | `membership changed` |
| priority | `50` |

- [MUST] 成员加入时生成 `room.member.joined` SSE 事件。
- [MUST] 成员离开时生成 `room.member.left` SSE 事件。

**after_write: extension_loader**

| 字段 | 值 |
|------|---|
| trigger.datatype | `room_config` |
| trigger.event | `update` |
| trigger.filter | `enabled_extensions changed` |
| priority | `10` |

- [MUST] `enabled_extensions` 变化时，加载新启用的 Extension Datatype 和对应 Hook。
- [SHOULD] 已禁用的 Extension 的 Hook 应停止执行。已写入的 Extension 数据 MUST NOT 删除。

#### §5.2.6 Room 生命周期规则

**创建**：

- [MUST] 创建者生成 UUIDv7 作为 `room_id`。
- [MUST] 创建 Room Config doc，写入初始成员（创建者为 `owner`）和至少一个 Relay。
- [MUST] 创建当前月份的 Timeline Index doc。

**加入**：

| Policy | 流程 |
|--------|------|
| `open` | [MUST] 任何 Entity 发现 Room Config 后即可开始同步 |
| `invite` | [MUST] 现有成员（power_level >= events_default）在 members 中添加新 Entity |
| `knock` | [MUST] 申请者发送加入请求，admin 批准后写入 members |

**退出**：

- [MUST] Entity 从 members 中删除自己的 entry。
- [MUST] 退出后，Peer SHOULD 停止同步该 Room 的所有文档。

**踢出**：

- [MUST] 操作者的 power_level 必须严格高于被踢者。
- [MUST] 操作者从 members 中删除被踢者的 entry。

#### §5.2.7 Indexes

**room_list**

| 字段 | 值 |
|------|---|
| input | 所有 Room Config where `signer ∈ members` |
| transform | `room_id → { name, member_count, last_activity }` |
| refresh | `on_change` |
| operation_id | `room.list` |

**member_list**

| 字段 | 值 |
|------|---|
| input | `room_config.membership.members` |
| transform | `entity_id → { role, power_level }` |
| refresh | `on_change` |
| operation_id | `room.members` |

---

### §5.3 Timeline

#### §5.3.1 声明

```yaml
id: "timeline"
version: "0.1.0"
dependencies: ["identity", "room"]
```

#### §5.3.2 Datatypes

**timeline_index**

| 字段 | 值 |
|------|---|
| id | `timeline_index` |
| storage_type | `crdt_array` |
| key_pattern | `ezagent/{room_id}/index/{YYYY-MM}/{state\|updates}` |
| persistent | `true` |
| writer_rule | `signer ∈ room.members AND ref.author == signer` |

#### §5.3.3 Ref Schema

Timeline Index 是一个 `crdt_array`，其中每个元素是一个 `crdt_map`（Ref）。

**Bus Ref 字段（MUST）**：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `ref_id` | ULID | MUST | 全局唯一。发送者在消息创建时生成 |
| `author` | Entity ID | MUST | 消息作者 |
| `content_type` | string | MUST | Bus 定义 `"immutable"`。Extension MAY 注册新值 |
| `content_id` | string | MUST | 指向 Layer 2 Content Object |
| `created_at` | RFC 3339 | SHOULD | 消息创建时间。信息性字段，不影响排序 |
| `status` | string | MUST | Bus 定义 `"active"` / `"deleted_by_author"`。Extension MAY 注册新值 |
| `signature` | string | MUST | Author 对 Bus 字段的 Ed25519 签名 |

**Extension 字段命名空间**：

- [MUST] Extension 注入的字段存储在 `ext.{ext_id}` key 下。
- [MUST] Annotation Store 的数据存储在 `ext.annotations` key 下。
- [MUST] 不支持某 Extension 的 Peer 收到含 `ext.*` 字段的 Ref 时，MUST 保留这些字段。

#### §5.3.4 排序规则

- [MUST] Ref 在 Timeline 中的全局顺序由 CRDT 的插入排序算法决定（`crdt_array` 的 YATA order）。
- [MUST] 所有 Peer 最终收敛到相同的 Ref 顺序。
- [MUST] `created_at` 字段不影响排序。离线创建的消息上线后出现在 Timeline 的当前位置。
- [SHOULD] 客户端 MAY 在 UI 中显示 `created_at` 作为辅助信息。

#### §5.3.5 时间窗口分片

- [MUST] Timeline Index 按月分片。Doc ID 格式为 `ezagent/{room_id}/index/{YYYY-MM}`。
- [MUST] 新 Ref MUST 写入当前 UTC 月份对应的 Index Doc。
- [MUST] 旧月份的 Index Doc MUST 仍然允许 `ext.*` 字段的更新（Reactions、Status 变更等）。
- [SHOULD] Peer 默认订阅当前月份和前一个月份的 Index Doc。更早的窗口按需加载。
- [MAY] 窗口的 `max_refs_per_window` 超限时，实现 MAY 创建子分片（如 `2026-02-a`, `2026-02-b`）。

#### §5.3.6 消息删除（Bus）

- [MUST] Author MAY 将 Ref 的 `status` 设置为 `"deleted_by_author"`。
- [MUST] 删除后，`content_id` MAY 被清除。
- [MUST] 客户端展示已删除消息时 SHOULD 显示占位符（如"消息已被作者删除"）。
- [MUST NOT] 已删除的 Ref MUST NOT 从 `crdt_array` 中物理移除（CRDT 的 tombstone 机制保留排序信息）。

#### §5.3.7 Hooks

**pre_send: generate_ref**

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `insert` |
| priority | `20` |

- [MUST] 生成 ULID 作为 `ref_id`。
- [MUST] 设置 `status = "active"`。
- [MUST] 设置 `author` 为当前 Entity ID。
- [MUST] 此 Hook 执行后，其他 Extension 的 pre_send Hook MAY 注入 `ext.*` 字段。

**after_write: ref_change_detect**

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `any` |
| priority | `30` |

- [MUST] 新 Ref 插入时，生成 `message.new` SSE 事件。
- [MUST] `status` 变为 `"deleted_by_author"` 时，生成 `message.deleted` SSE 事件。
- [SHOULD] `ext.*` 字段变化时，SHOULD 生成对应 Extension 的 SSE 事件（由 Extension 的 after_write hook 负责）。

**after_read: timeline_pagination**

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| priority | `30` |

- [MUST] 支持 `limit` 参数（默认 50，最大 200）。
- [MUST] 支持 `before` / `after` cursor 参数（基于 `ref_id`）。
- [MUST] 返回的 Ref 按 CRDT 排序。

#### §5.3.8 Indexes

**timeline_view**

| 字段 | 值 |
|------|---|
| input | `timeline_index for ezagent/{room_id}/index/{YYYY-MM}` |
| transform | CRDT-ordered refs with cursor-based pagination |
| refresh | `on_change` |
| operation_id | `timeline.list` |

**single_ref**

| 字段 | 值 |
|------|---|
| input | `timeline_index.refs[ref_id]` |
| transform | ref detail + content + annotations |
| refresh | `on_demand` |
| operation_id | `timeline.get_ref` |

---

### §5.4 Message

#### §5.4.1 声明

```yaml
id: "message"
version: "0.1.0"
dependencies: ["identity", "timeline"]
```

#### §5.4.2 Datatypes

**immutable_content**

| 字段 | 值 |
|------|---|
| id | `immutable_content` |
| storage_type | `blob` |
| key_pattern | `ezagent/{room_id}/content/{sha256_hash}` |
| persistent | `true` |
| writer_rule | `signer == author AND one_time_write` |

#### §5.4.3 Immutable Content Schema

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `content_id` | `sha256:{hex}` | MUST | `sha256(canonical_json(content without signature))` |
| `type` | string | MUST | `"immutable"` |
| `author` | Entity ID | MUST | 与 Ref 中的 `author` 一致 |
| `body` | string | MUST | 消息正文 |
| `format` | enum | MUST | `text/plain` / `text/markdown` / `text/html` |
| `media_refs` | Array<string> | MAY | 附件引用列表（需 EXT-10 Media） |
| `created_at` | RFC 3339 | MUST | 创建时间 |
| `signature` | string | MUST | Ed25519 签名 |

- [MUST] `content_id` 的计算：将 Content Object 去除 `signature` 字段后做 JSON Canonicalization，然后计算 SHA-256 哈希。
- [MUST] 验证规则：`hash(content without signature) == content_id` AND `verify(signature, author_pubkey)`。
- [MUST] Immutable Content 写入后不可修改。如需编辑，MUST 通过 EXT-01 Mutable 升级。

#### §5.4.4 content_type 注册表

Bus 定义以下 `content_type` 值：

| 值 | 定义者 | 说明 |
|---|--------|------|
| `"immutable"` | Bus (Message) | 不可变消息，content-addressed |

Extension MAY 注册新的 `content_type` 值。注册时 MUST 提供：

1. 类型名称（string，全局唯一）
2. 验证规则
3. 合法的升级路径（如 immutable → mutable）

实现遇到未知 `content_type` 时 MUST 保留 Ref 数据，SHOULD 在 UI 中显示为不可渲染。

#### §5.4.5 status 注册表

Bus 定义以下 `status` 值：

| 值 | 定义者 | 说明 |
|---|--------|------|
| `"active"` | Bus (Timeline) | 正常状态 |
| `"deleted_by_author"` | Bus (Timeline) | 作者删除 |

Extension MAY 注册新的 `status` 值（如 `"edited"`）。

#### §5.4.6 Hooks

**pre_send: compute_content_hash**

| 字段 | 值 |
|------|---|
| trigger.datatype | `immutable_content` |
| trigger.event | `insert` |
| priority | `20` |

- [MUST] 计算 `canonical_json(content) → sha256` 作为 `content_id`。
- [MUST] 用 Author 的密钥签名 Content。

**pre_send: validate_content_ref**

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `insert` |
| trigger.filter | `content_type == "immutable"` |
| priority | `25` |

- [MUST] 验证 `ref.content_id` 指向的 Content 存在。
- [MUST] 验证 Content 的 hash 与 `content_id` 匹配。
- [MUST] 验证 Content 的 `author` 与 Ref 的 `author` 一致。

**after_read: resolve_content**

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| priority | `40` |

- [MUST] API 返回 Ref 时，MUST 同时返回对应的 Content 数据（或 Content 不可达时返回占位符）。

---

## §6 Network Roles

### §6.1 Peer 自治能力

每个 ezagent 实例（Peer）是一个自给自足的网络节点。

- [MUST] Peer MUST 内嵌 Zenoh peer（含本地 RocksDB 持久化），可独立运行。
- [SHOULD] Peer SHOULD 启用 multicast scouting，自动发现同网段的其他 Peer。
- [SHOULD] Peer SHOULD 对已持有的 CRDT 文档注册 Zenoh queryable。
- [MUST] Peer MUST 在 peer 侧完成所有签名验证（不依赖 Relay）。
- [MAY] Peer MAY 同时连接到一个或多个 Public Relay。

### §6.2 Public Relay

Public Relay 是 ezagent 网络中提供跨网络桥接、离线恢复、身份注册和实体发现的可选公共服务。Relay 不拥有数据——它缓存和转发数据。

- [MUST] Public Relay MUST 以 Zenoh router mode 运行。
- [MUST] Public Relay MUST 支持 §4.5 定义的 Sync Protocol。
- [MUST] Public Relay MUST 持久化 `persistent: true` 的数据。
- [MUST] Public Relay MUST 通过 TLS 对外提供服务。
- [MUST] Public Relay MUST 支持 Entity 注册（存储 entity_id → public_key 映射）。
- [MUST] Public Relay MUST 提供公钥查询服务，供 P2P 身份验证使用。
- [SHOULD] Public Relay SHOULD 支持 Access Control（§6.4）。

### §6.3 合规性等级

| 等级 | 要求 | 适用场景 |
|------|------|---------|
| **Level 1: Basic** | Bridge + Cold Storage + 身份注册 | Self-Host / 开发测试 |
| **Level 2: Secured** | Level 1 + Access Control (ACL Interceptor) | 组织内部 |
| **Level 3: Full** | Level 2 + Discovery Index + Push Gateway | 公共服务 |

- [MUST] 加入 ezagent 网络的 Public Relay 至少满足 Level 1。
- [SHOULD] 生产环境 Public Relay 满足 Level 2。

### §6.4 Access Control

Access Control 验证入站 CRDT update 的合法性。

#### §6.4.1 Bus 验证规则

| 数据 | 规则 |
|------|------|
| Room Config | `signer.power_level >= power_levels.admin` |
| Timeline Index（新 Ref） | `signer ∈ room.members AND ref.author == signer` |
| Timeline Index（Ref 更新） | 取决于更新的字段和 writer_rule |

#### §6.4.2 Extension 验证规则

- [MUST] 每个 Extension 的 `writer_rule` MUST 在 Access Control 中被检查。
- [SHOULD] Relay 的 Access Control 应聚合 Room Config 中 `enabled_extensions` 列出的所有 Extension 的 writer_rule。
- [MAY] 初期实现 MAY 仅在 Peer 端验证，Relay 端不验证。

#### §6.4.3 初期实现策略

- [MAY] 实现 MAY 先在 Peer 端完成所有 writer_rule 验证（收到 update 后检查，不合法则丢弃）。
- [SHOULD] Relay 端的验证作为后续优化。当 Relay 端验证生效后，不合法的 update 在 Relay 端即被拒绝。

### §6.5 多 Relay 协同

- [MUST] 同一 Room 的多个 Public Relay 之间 MUST 自动同步数据。
- [MUST] Relay 之间是对等关系。Room Config 中的 `role: primary/secondary` 仅作为 Peer 的连接偏好提示，不影响 Relay 行为。
- [SHOULD] 新 Relay 加入后 SHOULD 自动发现已有 Relay 并开始同步。

### §6.6 Relay 本地数据

Relay 维护自身的运营数据，这些数据**不参与 CRDT 同步**，仅存在于 Relay 本地存储中。

#### §6.6.1 数据分类

| 数据 | 说明 | Compliance Level |
|------|------|-----------------|
| **Relay 配置** | 合规性等级、支持的 Extension 列表、TLS 证书、管理员 Entity ID | Level 1+ |
| **Entity 注册表** | entity_id → public_key 映射 | Level 1+ |
| **Discovery 索引** | 本 Relay 上所有 Entity Profile 的聚合索引，支持 Discovery 搜索 | Level 3 |
| **Proxy Profile 缓存** | 外部 Relay 上 Entity 的 Profile 本地缓存（Virtual User），供 Discovery 使用 | Level 3 |
| **State Vector 缓存** | 与各 Peer/Relay 的 state vector 缓存，加速 initial sync 差量计算 | Level 1+ |

#### §6.6.2 存储路径

Relay 本地数据存储在 Key Space 的 `ezagent/relay/` 命名空间中：

> **注意**：`ezagent/relay/` 和 `ezagent/socialware/`（见附录 B）均为**本地命名空间**，MUST NOT 通过 Sync Protocol 发布给其他 Peer 或 Relay。

```
ezagent/relay/{relay_domain}/
├── config                            # Relay 自身配置
├── entities/                         # Entity 注册表
│   └── @{entity_id}                 # entity_id → public_key 映射
├── discovery/
│   ├── profiles                      # Entity Profile 聚合索引
│   └── proxy-profiles/
│       └── @{entity_id}             # 外部 Entity 的 proxy profile
└── sync/
    └── {room_id}/
        └── state-vectors             # State vector 缓存
```

#### §6.6.3 规则

- [MUST] Relay 配置 MUST 声明自身的 compliance_level 和 supported_extensions。
- [MUST] Relay 本地数据 MUST NOT 通过 Sync Protocol 发布给 Peer 或其他 Relay。
- [MUST] Entity 注册表 MUST 对外提供公钥查询接口（供 P2P 身份验证使用）。
- [MUST] Discovery 索引由 Relay 自行构建。协议不标准化索引方式。
- [SHOULD] Proxy Profile 缓存 SHOULD 设置过期策略。缓存过期后 SHOULD 从源 Relay 重新拉取。
- [MAY] State vector 缓存丢失不影响正确性——Sync Protocol 退化为发送完整 state。

---

## §7 Engine Operations

### §7.1 Operation 定义

Engine 通过 Operation 暴露功能。每个 Operation 定义操作语义、输入参数、返回类型和错误条件。Operation 不绑定任何传输协议。

Operation 通过 PyO3 暴露为 Python async method（定义在 ezagent-py-spec）。CLI、HTTP Server 等用户接口在 Python 层基于 SDK 实现，不属于协议规范。

- [MUST] 每个 `operation_id` 非 null 的 Index MUST 在 Engine Operation 清单中有对应操作。
- [MUST] Operation 语义和行为由本规范定义，与传输方式无关。

每个 Operation 包含：

| 字段 | 说明 |
|------|------|
| operation_id | 唯一标识（如 `room.create`） |
| input | 参数列表和类型 |
| output | 返回类型 |
| errors | 可能的错误码 |
| write_mode | A (Hook Pipeline) 或 B (本地 CRDT) 或 read |

### §7.2 Bus Operations

以下 Operations 由 Built-in Datatypes 的 Indexes 导出：

```yaml
# Identity
identity.init          # 初始化密钥对
identity.whoami        # 当前 Entity 信息
identity.get_pubkey    # 查询公钥

# Room
room.create            # 创建 Room
room.list              # 列出 Room
room.get               # 查看 Room Config
room.update_config     # 更新 Config
room.join              # 加入 Room
room.leave             # 离开 Room
room.invite            # 邀请成员
room.members           # 成员列表

# Timeline
timeline.list          # 消息列表（分页）
timeline.get_ref       # 单条 Ref
message.send           # 发送消息
message.delete         # 删除消息（Author 删除）

# Annotation (Engine)
annotation.list        # 读取 Ref / Room Config 上的所有 annotation
annotation.add         # 添加 annotation
annotation.remove      # 删除自己的 annotation

# Event Stream
events.stream          # 实时事件流

# System
status                 # 节点状态
```

> Annotation Operations 覆盖两个层级：Ref 和 Room Config。任何包含 `ext.annotations` 子 Y.Map 的 CRDT 文档节点都通过此 Operation 访问。

Extension Operations 由各 Extension 的 Indexes 导出，定义在 Extensions Spec 中。

### §7.3 Event Stream

Engine 通过 Event Stream 推送实时事件。

- [MUST] Event Stream 通过 PyO3 暴露为 Python async iterator。
- [MUST] 支持按 Room 过滤。
- [MUST] 支持 cursor 参数实现断线恢复（等价于重放从 cursor 之后的事件）。
- [SHOULD] 实现 SHOULD 缓存最近的事件（至少 1000 条或 5 分钟），以支持断线恢复。

#### §7.3.1 Bus Event Types

| Event Type | 触发条件 | Payload 字段 |
|------------|---------|-------------|
| `message.new` | 新 Ref 插入 Timeline | `room_id, ref_id, author, content_type, body` |
| `message.deleted` | Ref status → `deleted_by_author` | `room_id, ref_id` |
| `room.member.joined` | Room members 新增 | `room_id, entity_id, role` |
| `room.member.left` | Room members 移除 | `room_id, entity_id` |
| `room.config.updated` | Room Config 变更 | `room_id, changed_fields` |

Extension 的 Event Types 定义在 Extensions Spec 中。

#### §7.3.2 Event 格式

每个 Event 包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | string | Event Type (如 `message.new`) |
| `id` | integer | 单调递增事件 ID，用于断线恢复 |
| `data` | object | JSON-compatible payload |

### §7.4 Error Codes

- [MUST] 所有 Operation 的错误 MUST 使用标准错误码。
- [MUST] 错误通过 Python exception 抛出（Embedded 模式），或通过 JSON 错误体返回（HTTP 模式，如实现）。

标准错误码：

| Code | 含义 |
|------|------|
| `NOT_FOUND` | 资源不存在 |
| `PERMISSION_DENIED` | 权限不足 |
| `INVALID_SIGNATURE` | 签名验证失败 |
| `VALIDATION_ERROR` | 输入数据不合法 |
| `CONFLICT` | 操作冲突 |
| `NOT_A_MEMBER` | 非 Room 成员 |
| `EXTENSION_DISABLED` | 请求使用了未启用的 Extension |
| `PRIORITY_ERROR` | Socialware Hook priority < 100 |
| `INTERNAL_ERROR` | 内部错误 |

---

## §8 Compliance & Interoperability

### §8.1 Peer 合规性层级

| 层级 | 必须支持 | 典型场景 |
|------|---------|---------|
| **Level 0: Core** | Engine + Identity + Room + Timeline + Message | 最小可行 IM |
| **Level 1: Standard** | Level 0 + EXT-01 Mutable, EXT-03 Reactions, EXT-04 Reply To, EXT-08 Read Receipts, EXT-09 Presence, EXT-10 Media | 标准 IM 体验 |
| **Level 2: Advanced** | Level 1 + EXT-02 Collab, EXT-06 Channels, EXT-07 Moderation, EXT-05 Cross-Room Ref, EXT-13 Profile, EXT-14 Watch, EXT-15 Command | 完整协作平台 |
| **Level 3: Full** | Level 2 + EXT-11 Threads, EXT-12 Drafts | 全功能 |

- [MUST] 实现 MUST 声明自己支持的合规性层级。
- [MUST] 支持某层级的实现 MUST 支持该层级及以下所有层级要求的功能。

### §8.2 向前兼容性

- [MUST] 低层级 Peer 与高层级 Peer 在同一 Room 共存时：
  - 低层级 Peer MUST 保留未知的 `ext.*` 字段和 `ext.annotations`。
  - 低层级 Peer 修改 Ref 的 Bus 字段时，MUST NOT 丢失 Extension 字段。
  - 低层级 Peer MUST NOT 渲染未知 Extension 的数据。
  - 低层级 Peer MAY 不订阅未知 Extension 的独立 Doc。
- [MUST] 高层级 Peer MUST 能正常处理不含任何 Extension 字段的 Ref。

### §8.3 互操作性测试要求

实现 MUST 通过以下测试：

| 测试 | 说明 |
|------|------|
| 基础同步 | 两个 Peer 通过 Relay 同步 Timeline |
| 签名验证 | 伪造签名的 update 被拒绝 |
| 向前兼容 | Level 0 Peer 保留 Level 2 Peer 写入的 ext.* 字段 |
| 断线恢复 | 断线 → 对方写入 → 重连 → 数据完整 |
| 成员权限 | 非成员的写入被拒绝 |
| 多 Relay | 两个 Relay 之间数据最终一致 |

### §8.4 版本迁移

- [MUST] Spec 版本号遵循语义化版本。
- [MUST] Minor version 升级（如 0.2 → 0.3）MUST 保持向后兼容。
- [SHOULD] Major version 升级提供迁移指南和过渡期。

---

## 附录 A：Signed Envelope Binary Layout

```
Offset  Size     Field
0       1        version (u8, currently 0x01)
1       2        signer_id_len (u16, big-endian)
3       var      signer_id (UTF-8 bytes)
var     2        doc_id_len (u16, big-endian)
var     var      doc_id (UTF-8 bytes)
var     8        timestamp (i64, big-endian, unix milliseconds)
var     4        payload_len (u32, big-endian)
var     var      payload (raw bytes, CRDT update encoding)
var     64       signature (Ed25519, over all preceding bytes)
```

签名输入 = Envelope 中 signature 之前的所有字节。

---

## 附录 B：Zenoh Key Expression 完整参考

以下为参考实现（Zenoh backend）的 key expression 映射。其他 Backend 实现 MAY 使用不同的路径格式。

```
# === Identity ===
ezagent/@{entity_id}/identity/pubkey

# === Room Bus ===
ezagent/{room_id}/config/{state|updates}
ezagent/{room_id}/index/{YYYY-MM}/{state|updates}

# === Content (Bus + Extension) ===
ezagent/{room_id}/content/{sha256_hash}                    # Bus §5.4 Immutable Content
ezagent/{room_id}/content/{content_id}/{state|updates}     # EXT-01/02 Mutable/Collab
ezagent/{room_id}/content/{content_id}/acl/{state|updates} # EXT-02 Collab ACL
ezagent/{room_id}/blob/{blob_hash}                         # EXT-10 Media

# === Extension Docs ===
ezagent/{room_id}/ext/{ext_id}/{state|updates}             # EXT-07, EXT-08
ezagent/{room_id}/ext/draft/{entity_id}/{state|updates}    # EXT-12

# === Ephemeral ===
ezagent/{room_id}/ephemeral/presence/@{entity_id}          # EXT-09
ezagent/{room_id}/ephemeral/awareness/@{entity_id}         # EXT-09

# === Profile ===
ezagent/@{entity_id}/ext/profile/{state|updates}           # EXT-13

# === Socialware (Local Only, NOT synced) ===
ezagent/socialware/registry.toml                            # Socialware 安装注册表
ezagent/socialware/{sw_id}/manifest.toml                    # Socialware 声明清单
ezagent/socialware/{sw_id}/...                              # Socialware 本地运营数据
```

---

## 附录 C：Hook 执行序列示例

**场景：用户发送一条带 reply 和 channel tag 的消息**

```
API: POST /rooms/{room_id}/messages
     body: { body: "LGTM", reply_to: "ulid:...", channels: ["code-review"] }

PRE_SEND phase (按 priority):
  [0]   identity.sign_envelope      → (标记：最终执行签名)
  [10]  room.check_room_write       → 验证 signer ∈ members       ✓
  [20]  message.compute_content_hash → sha256(content) → content_id
  [20]  timeline.generate_ref       → 生成 ref_id, status="active"
  [25]  message.validate_content_ref → 验证 content 存在且 hash 匹配
  [30]  reply_to.inject             → 注入 ext.reply_to = {ref_id}   (EXT-04)
  [30]  channels.inject_tags        → 注入 ext.channels = ["code-review"] (EXT-06)
  [0]   identity.sign_envelope      → 签名 (所有字段确定后执行)

→ 写入 CRDT → Backend publish update

AFTER_WRITE phase (按 priority):
  [0]   identity.verify_signature   → (对入站数据) 验证             ✓
  [30]  timeline.ref_change_detect  → emit SSE: message.new
  [45]  watch.check_ref_watchers    → 检查被 reply_to 的 ref 的 watch annotation
                                      → 如有 watcher → emit SSE: watch.ref_reply_added
  [50]  channels.update_activity    → emit SSE: channel.activity

AFTER_READ phase (当其他 Peer 读取此 Ref 时):
  [30]  timeline.timeline_pagination → 分页处理
  [40]  message.resolve_content      → 加载 content body
  [45]  cross_room.resolve_preview   → (如 reply_to 跨 room) 加载预览
  [50]  channels.aggregate           → (如在 channel 视图中) 聚合
  [60]  moderation.merge_overlay     → (如有) 合并 moderation overlay
```

---

## 附录 D：与 Matrix / Zulip 概念映射

| ezagent 概念 | Matrix 概念 | Zulip 概念 | 说明 |
|-----------|------------|------------|------|
| Engine | (无) | (无) | ezagent 独有的元模型 |
| Datatype | (无) | (无) | 统一的功能声明格式 |
| Hook | (无) | (无) | 生命周期钩子 |
| Annotation | (无) | (无) | 附着元数据 |
| Entity | User / App Service | User / Bot | ezagent 不区分 human/agent |
| Room | Room | Organization | ezagent Room 更轻量 |
| Ref | Event | Message | ezagent Ref 是索引，不含内容 |
| Content Object | Event content | Message content | ezagent 分离索引与内容 |
| Timeline Index | Event DAG | (无) | ezagent 用 CRDT array |
| Channel | (无) | Stream + Topic | ezagent Channel 是 tag |
| ext.annotations | (无) | (无) | ezagent 独有 |
| Relay | Homeserver | Server | ezagent Relay 不拥有数据 |
| Moderation Overlay | Redaction event | (无) | ezagent 不修改原始数据 |
| Watch | (无) | (无) | ezagent Hook + Annotation 组合 |
| Profile | Profile API / 3PID | (无) | ezagent 用 markdown |

---

## 附录 E：变更日志

| 版本 | 日期 | 变更 |
|------|------|------|
| 0.2 | 2026-02-23 | Engine-centric 重构。Datatype+Hook+Annotation+Index 统一模型。Built-in 与 Extension 统一声明格式。Sync 降级为可替换 Backend。新增 EXT-13 Profile、EXT-14 Watch。Annotation Store 内置为 Engine 组件 |
| 0.1 | 2026-02-22 | 初始 Spec（5 Bus + Extension 三种原子操作） |

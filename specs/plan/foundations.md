# 基础设施：Key Space、Fixture 设计与目录结构

> 从 implementation-plan.md §2.1-2.3 提取
> **版本**：0.9

---

### §2.1 Key Space 定义

#### §2.1.1 概述

ezagent 的所有持久化和临时数据组织在统一的 Key Space 中。Key Space 的根为 `ezagent/`，下分三个顶级命名空间，按**数据的所有者**划分：

| 命名空间 | 所有者 | 同步方式 | 说明 |
|----------|--------|---------|------|
| `ezagent/entity/` | Entity | CRDT 同步 | Entity 的身份和自描述数据 |
| `ezagent/room/` | Room | CRDT 同步 | Room 下的所有协作数据 |
| `ezagent/relay/` | Relay | 不同步（本地运营数据） | Relay 的配置和运营数据 |

#### §2.1.2 设计规则

**规则 1：顶级命名空间按所有者分类，不按数据类型。**

"这条消息的内容"和"这条消息上的 reaction"都属于 Room，所以都住在 `ezagent/room/{room_id}/` 下。不会出现 `realm/reactions/` 这样按类型分的顶级路径。

**规则 2：Extension 数据住在所有者命名空间内的 `ext/` 子目录下。**

Extension 数据分两种存储位置：

- **内嵌在 CRDT 文档中的字段**（`ext.*` 前缀）：如 `ext.reactions`、`ext.reply_to`、`ext.channels`、`ext.thread`、`ext.annotations`——这些是 Timeline Index 中 Ref 的字段，随 Ref 所在的 Y.Doc 一起同步，没有独立的存储路径。
- **独立 CRDT 文档**（`ext/{ext_id}/` 子目录）：如 Moderation Overlay、Read Receipts、Drafts——这些是 Room 级的独立文档，存储在 `ezagent/room/{room_id}/ext/{ext_id}/`。
- **Entity 级 Extension**：如 Profile——存储在 `ezagent/entity/@{entity_id}/ext/profile/`。

**规则 3：Ephemeral 数据单独隔离在 `ephemeral/` 子目录下。**

`ephemeral/` 下的数据（Presence、Awareness）不持久化，不需要 `state/updates` 分离，Backend 重启后丢失。与持久化数据物理隔离，避免混淆。

**规则 4：CRDT 文档一律以 `state` + `updates` 成对出现。**

`state` 是完整状态快照，`updates` 是增量更新流。Sync Protocol 通过这对 sub-key 实现 initial sync（读 state）和 live sync（订阅 updates）。Blob 类型只有单一路径（无 state/updates 区分），因为不可变内容不需要增量同步。

**规则 5：Relay 命名空间存储 Relay 本地运营数据，不经 CRDT 同步。**

Relay 的配置、Discovery 索引、同步状态等是 Relay 自身的运营数据，不需要在 Peer 间同步。它们只存在于 Relay 本地存储中。

**规则 6：Key Space 路径与协议层 key_pattern 是两个不同的层。**

Bus Spec 中的 `key_pattern`（如 `ezagent/@{entity_id}/identity/pubkey`）定义的是 Peer 和 Relay 之间 Sync Protocol 使用的寻址方案。Key Space 路径（如 `ezagent/entity/@{entity_id}/identity/pubkey`）是 Backend 的物理存储组织。两者由 Backend Abstraction 层做映射，互不约束。

#### §2.1.3 完整 Key Space 结构

```
ezagent/
│
├── entity/                               # Entity 级数据（CRDT 同步）
│   └── @{entity_id}/
│       ├── identity/
│       │   └── pubkey                   # Ed25519 公钥 (blob)
│       └── ext/
│           └── {ext_id}/               # Entity 级 Extension
│               ├── state
│               └── updates
│           # 当前仅有:
│           #   profile/                 # EXT-13 Entity Profile (crdt_map)
│
├── room/                                 # Room 级数据（CRDT 同步）
│   └── {room_id}/
│       ├── config/
│       │   ├── state                    # Room Config (crdt_map)
│       │   └── updates                  #   含 membership, power_levels, enabled_extensions,
│       │                                #   ext.* (channel hints, moderation config 等),
│       │                                #   ext.annotations (channel_watch 等)
│       │
│       ├── index/
│       │   └── {YYYY-MM}/
│       │       ├── state                # Timeline Index (crdt_array<crdt_map>)
│       │       └── updates              #   每个 ref 含 core 字段 + ext.reactions,
│       │                                #   ext.reply_to, ext.channels, ext.thread,
│       │                                #   ext.annotations (watch 等)
│       │
│       ├── content/
│       │   ├── {sha256_hash}            # Immutable Content (blob, 不可变)
│       │   └── {uuid}/
│       │       ├── state                # Mutable/Collab Content Doc (crdt_map)
│       │       ├── updates
│       │       └── acl/                 # Collab ACL (EXT-02, crdt_map)
│       │           ├── state
│       │           └── updates
│       │
│       ├── blob/
│       │   └── {sha256_hash}            # Media 二进制 (blob, 不可变)
│       │
│       ├── ext/                          # Room 级 Extension 独立文档
│       │   ├── {ext_id}/               # 通用结构
│       │   │   ├── state
│       │   │   └── updates
│       │   # 当前包含:
│       │   #   moderation/              # EXT-07 Moderation Overlay (crdt_array)
│       │   #   read-receipts/           # EXT-08 Read Receipts (crdt_map)
│       │   └── draft/                   # EXT-12 特殊：按 Entity 分区
│       │       └── @{entity_id}/
│       │           ├── state            # User Draft (crdt_map, 私有)
│       │           └── updates
│       │
│       └── ephemeral/                    # 不持久化，无 state/updates 区分
│           ├── presence/
│           │   └── @{entity_id}         # EXT-09 Presence Token
│           └── awareness/
│               └── @{entity_id}         # EXT-09 Awareness State
│
└── relay/                                # Relay 本地运营数据（不经 CRDT 同步）
    └── {relay_domain}/
        ├── config                       # Relay 自身配置
        │                                #   compliance_level, supported_extensions,
        │                                #   tls_cert, admin_entity_id
        │
        ├── discovery/                   # Discovery 索引 (Level 3)
        │   ├── profiles                 # 聚合的 Entity Profile 索引
        │   └── proxy-profiles/          # Virtual User 代理 Profile
        │       └── @{entity_id}         #   外部 Relay Entity 的本地缓存
        │
        └── sync/                        # 同步运营状态
            └── {room_id}/
                └── state-vectors        # 与各 Peer/Relay 的 state vector 缓存
```

#### §2.1.4 Relay 命名空间说明

`ezagent/relay/{relay_domain}/` 存储 Relay 的本地运营数据，不在 Peer 间同步：

| 路径 | 说明 | Compliance Level |
|------|------|-----------------|
| `config` | Relay 自身配置：合规性等级、支持的 Extension 列表、TLS 证书、管理员 Entity ID | Level 1+ |
| `discovery/profiles` | 本 Relay 上所有 Entity Profile 的聚合索引，用于 `POST /ext/discovery/search` | Level 3 |
| `discovery/proxy-profiles/@{entity_id}` | 外部 Relay 上 Entity 的 proxy profile（Virtual User）本地缓存 | Level 3 |
| `sync/{room_id}/state-vectors` | 与该 Room 相关的各 Peer/Relay 的 state vector 缓存，用于加速 initial sync 差量计算 | Level 1+ |

Relay 数据的特殊性：

- **不通过 CRDT 同步**。Relay 配置和 Discovery 索引是 Relay 的私有数据，不需要也不应该同步给 Peer 或其他 Relay。
- **Discovery 索引由 Relay 自行构建**。协议不标准化索引方式（可以是全文搜索、embedding、LLM 提取等）。
- **Proxy Profile 是缓存**。外部 Entity 的 Profile 从源 Relay 拉取后缓存在本地，供 Discovery 使用。缓存过期策略由 Relay 自行决定。
- **State vector 缓存是优化手段**。Relay 缓存各 Peer 最近的 state vector，以便 initial sync 时快速计算差量。缓存丢失不影响正确性（退化为发送完整 state）。

#### §2.1.5 Spec key_pattern → Key Space 映射

协议层 key_pattern（Bus Spec §3.1.3）和存储层 Key Space 是两个不同的层，由 Backend Abstraction 做映射：

| Spec 中的 key_pattern | Key Space 路径 |
|----------------------|---------------|
| `ezagent/@{entity_id}/identity/pubkey` | `ezagent/entity/@{entity_id}/identity/pubkey` |
| `ezagent/@{entity_id}/ext/profile/{s\|u}` | `ezagent/entity/@{entity_id}/ext/profile/{state\|updates}` |
| `ezagent/{room_id}/config/{s\|u}` | `ezagent/room/{room_id}/config/{state\|updates}` |
| `ezagent/{room_id}/index/{YYYY-MM}/{s\|u}` | `ezagent/room/{room_id}/index/{YYYY-MM}/{state\|updates}` |
| `ezagent/{room_id}/content/{id}` | `ezagent/room/{room_id}/content/{id}` |
| `ezagent/{room_id}/blob/{hash}` | `ezagent/room/{room_id}/blob/{hash}` |
| `ezagent/{room_id}/ext/{ext_id}/{s\|u}` | `ezagent/room/{room_id}/ext/{ext_id}/{state\|updates}` |
| `ezagent/{room_id}/ext/draft/{eid}/{s\|u}` | `ezagent/room/{room_id}/ext/draft/@{entity_id}/{state\|updates}` |
| `ezagent/{room_id}/ephemeral/presence/@{eid}` | `ezagent/room/{room_id}/ephemeral/presence/@{entity_id}` |
| `ezagent/{room_id}/ephemeral/awareness/@{eid}` | `ezagent/room/{room_id}/ephemeral/awareness/@{entity_id}` |
| （无对应 key_pattern） | `ezagent/relay/{relay_domain}/**`（Relay 本地，不参与 Sync Protocol） |

### §2.2 Fixture 设计原则

1. **Fixture 是数据库的 JSON dump**。每个 `.json` 文件对应 key space 中一个文档的反序列化内容。在实际数据库中，数据存储为 yrs binary state；fixture 中以 JSON 表示同等信息。

2. **Fixture 目录镜像 Key Space**。fixture 文件的路径 1:1 对应 key space 路径。`ezagent/room/{room_id}/config/state.json` 对应 key `ezagent/room/{room_id}/config/state` 的内容。

3. **Fixture 数据来自 Engine 生成**。Fixture 中的签名、hash、ref_id 都是由 Engine 正确产生的真实值。生成流程：运行 Scenario 脚本 → Engine 执行完整 Hook Pipeline → 从数据库 dump 为 JSON。

4. **阶段渐进加载**。Phase 1 测试加载 fixture 时忽略 `ext/` 子目录和 ref 上的 `ext.*` 字段；Phase 2 加载完整数据。同一份 fixture 服务所有阶段。

5. **Error Fixture 通过复制 + 篡改产生**。异常测试数据存储在 `ezagent-error/` 中，目录结构与 `ezagent/` 完全对应。每个 error fixture 标注它基于哪个正确 fixture 以及篡改了什么。

### §2.3 Fixture 目录结构

```
fixtures/
│
├── keypairs/                                    # Ed25519 测试密钥对
│   ├── alice.json
│   ├── bob.json
│   ├── carol.json
│   ├── code-reviewer.json
│   ├── translator.json
│   ├── mallory.json
│   ├── admin.json
│   └── outsider.json
│
├── ezagent/                                       # 正确数据（数据库 dump）
│   ├── entity/
│   │   ├── @alice:relay-a.example.com/
│   │   │   ├── identity/
│   │   │   │   └── pubkey.json
│   │   │   └── ext/
│   │   │       └── profile/
│   │   │           └── state.json              # PF-001
│   │   ├── @bob:relay-a.example.com/
│   │   │   └── identity/
│   │   │       └── pubkey.json
│   │   ├── @code-reviewer:relay-a.example.com/
│   │   │   ├── identity/
│   │   │   │   └── pubkey.json
│   │   │   └── ext/
│   │   │       └── profile/
│   │   │           └── state.json              # PF-002
│   │   ├── @translator:relay-a.example.com/
│   │   │   ├── identity/
│   │   │   │   └── pubkey.json
│   │   │   └── ext/
│   │   │       └── profile/
│   │   │           └── state.json              # PF-003
│   │   ├── @carol:relay-b.example.com/
│   │   │   └── identity/
│   │   │       └── pubkey.json
│   │   ├── @mallory:relay-a.example.com/
│   │   │   └── identity/
│   │   │       └── pubkey.json
│   │   ├── @admin:relay-a.example.com/
│   │   │   └── identity/
│   │   │       └── pubkey.json
│   │   └── @outsider:relay-c.example.com/
│   │       └── identity/
│   │           └── pubkey.json
│   │
│   └── room/
│       ├── 01957a3b-0000-7000-8000-000000000001/   # R-alpha
│       │   ├── config/
│       │   │   └── state.json
│       │   ├── index/
│       │   │   └── 2026-02/
│       │   │       └── state.json              # refs: M-001~M-004, M-DEL
│       │   ├── content/
│       │   │   ├── sha256_e3b0c442.json        # M-001 immutable
│       │   │   ├── sha256_a1b2c3d4.json        # M-002 immutable
│       │   │   ├── sha256_f5e6d7c8.json        # M-003 immutable (升级前快照)
│       │   │   ├── uuid_mut-001/
│       │   │   │   └── state.json              # MUT-001 mutable content doc
│       │   │   ├── sha256_...json              # M-004, M-DEL
│       │   │   └── ...
│       │   ├── blob/
│       │   │   ├── aaaa1111.bin                # BL-001: diagram.png
│       │   │   └── bbbb2222.bin                # BL-002: report.pdf
│       │   └── ext/
│       │       ├── moderation/
│       │       │   └── state.json              # MOD-001, MOD-002
│       │       ├── read-receipts/
│       │       │   └── state.json              # RR-001, RR-002, RR-003
│       │       └── draft/                      # (R-alpha 无 draft 数据)
│       │
│       ├── 01957a3b-0000-7000-8000-000000000002/   # R-beta
│       │   ├── config/
│       │   │   └── state.json
│       │   ├── index/
│       │   │   └── 2026-02/
│       │   │       └── state.json              # refs: M-005, M-006
│       │   └── content/
│       │       └── ...
│       │
│       ├── 01957a3b-0000-7000-8000-000000000003/   # R-gamma
│       │   ├── config/
│       │   │   └── state.json
│       │   ├── index/
│       │   │   └── 2026-02/
│       │   │       └── state.json              # refs: M-007, M-008, thread replies
│       │   ├── content/
│       │   │   ├── sha256_...json              # M-007, M-008
│       │   │   └── uuid_col-001/
│       │   │       ├── state.json              # COL-001 collab content
│       │   │       └── acl/
│       │   │           └── state.json          # COL-001 ACL
│       │   └── ext/
│       │       └── draft/
│       │           └── @alice:relay-a.example.com/
│       │               └── state.json          # DR-001
│       │
│       ├── 01957a3b-0000-7000-8000-000000000004/   # R-empty
│       │   ├── config/
│       │   │   └── state.json                  # enabled_extensions = []
│       │   ├── index/
│       │   │   └── 2026-02/
│       │   │       └── state.json              # refs: M-009, M-010
│       │   └── content/
│       │       └── ...
│       │
│       └── 01957a3b-0000-7000-8000-000000000005/   # R-minimal
│           └── config/
│               └── state.json
│
│   └── relay/                                       # Relay 本地运营数据
│       ├── relay-a.example.com/
│       │   ├── config.json                      # RELAY-A 配置
│       │   ├── discovery/
│       │   │   ├── profiles.json                # Profile 聚合索引
│       │   │   └── proxy-profiles/
│       │   │       └── @carol:relay-b.example.com.json  # Virtual User
│       │   └── sync/
│       │       ├── 01957a3b-...-000000000001/
│       │       │   └── state-vectors.json       # R-alpha sync state
│       │       └── ...                          # 其他 Room
│       └── relay-b.example.com/
│           └── config.json                      # RELAY-B 配置
│
├── ezagent-error/                                 # 异常数据（篡改后的 dump）
│   ├── entity/
│   │   └── @mallory:relay-a.example.com/
│   │       └── identity/
│   │           └── pubkey.json                 # ERR-SIGN-002: 错误的公钥
│   └── room/
│       └── 01957a3b-0000-7000-8000-000000000001/
│           ├── index/
│           │   └── 2026-02/
│           │       ├── forged-signature.json   # ERR-SIGN-001: 伪造签名的 ref
│           │       ├── tampered-content.json    # ERR-MSG-002: 篡改 body 后 hash 不匹配
│           │       ├── author-mismatch.json     # ERR-MSG-003: ref.author ≠ content.author
│           │       └── future-timestamp.json    # ERR-SIGN-003: 时间戳偏差 >5min
│           └── content/
│               └── sha256_tampered.json        # ERR-MSG-002: 被篡改的 content
│
├── scenarios/                                   # 数据生成脚本 (YAML)
│   ├── 00-identities.yaml
│   ├── 00-relays.yaml
│   ├── 01-R-alpha.yaml
│   ├── 01-R-beta.yaml
│   ├── 01-R-gamma.yaml
│   ├── 01-R-empty.yaml
│   ├── 01-R-minimal.yaml
│   ├── 02-ext-reactions.yaml
│   ├── 02-ext-reply-to.yaml
│   ├── 02-ext-mutable.yaml
│   ├── 02-ext-collab.yaml
│   ├── 02-ext-channels.yaml
│   ├── 02-ext-moderation.yaml
│   ├── 02-ext-read-receipts.yaml
│   ├── 02-ext-presence.yaml
│   ├── 02-ext-media.yaml
│   ├── 02-ext-threads.yaml
│   ├── 02-ext-drafts.yaml
│   ├── 02-ext-profiles.yaml
│   ├── 02-ext-watch.yaml
│   └── 99-errors.yaml
│
├── data-index.yaml                              # 验证数据 ID → fixture 路径映射
└── README.md
```

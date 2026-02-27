# 验证数据集

> 从 implementation-plan.md §2.4-2.11 + 附录 I/J/K 提取
> **版本**：0.9.1

---

### §2.4 验证数据 — Entities & Keypairs

#### Entities

| ID | Entity ID | Type | 角色说明 |
|----|-----------|------|---------|
| `E-alice` | `@alice:relay-a.example.com` | human | R-alpha owner, R-beta member |
| `E-bob` | `@bob:relay-a.example.com` | human | R-alpha member, R-beta owner |
| `E-carol` | `@carol:relay-b.example.com` | human | 外部 Relay 用户 |
| `E-agent1` | `@code-reviewer:relay-a.example.com` | agent | Code review AI agent |
| `E-agent2` | `@translator:relay-a.example.com` | agent | Translation agent |
| `E-mallory` | `@mallory:relay-a.example.com` | human | 恶意用户（权限测试） |
| `E-admin` | `@admin:relay-a.example.com` | human | Relay 管理员 |
| `E-outsider` | `@outsider:relay-c.example.com` | human | 不在任何测试 Room 中 |
| `E-sw-ew` | `@event-weaver:relay-a.example.com` | socialware | EventWeaver Socialware Identity |
| `E-sw-ta` | `@task-arena:relay-a.example.com` | socialware | TaskArena Socialware Identity |
| `E-sw-rp` | `@res-pool:relay-a.example.com` | socialware | ResPool Socialware Identity |
| `E-sw-af` | `@agent-forge:relay-a.example.com` | socialware | AgentForge Socialware Identity |
| `E-af-reviewer` | `@review-bot:relay-a.example.com` | agent | AgentForge 管理的 Code Review Agent |

#### Keypair Fixture 格式

每个 `keypairs/{name}.json` 文件：

```json
{
  "entity_id": "@alice:relay-a.example.com",
  "public_key_raw": "<32 bytes, base64>",
  "private_key_raw": "<32 bytes, base64>",
  "_note": "测试专用固定密钥。生产环境密钥由 Engine 动态生成。"
}
```

对应的 `ezagent/entity/@alice:.../identity/pubkey.json` 文件只包含公钥：

```json
{
  "entity_id": "@alice:relay-a.example.com",
  "public_key_raw": "<32 bytes, base64>",
  "algorithm": "ed25519"
}
```

> Keypair 文件在首次运行 `scenarios/00-identities.yaml` 时由 fixture generator 生成真实 Ed25519 密钥对，之后固定不变。

### §2.5 验证数据 — Rooms

| ID | room_id (UUIDv7) | name | owner | members | policy | enabled_extensions |
|----|-------------------|------|-------|---------|--------|-------------------|
| `R-alpha` | `01957a3b-...-000000000001` | "Project Alpha" | E-alice | alice(owner,100), bob(member,0), agent1(member,0) | invite | mutable, reactions, reply-to, channels, read-receipts, presence, media, moderation, profile, watch |
| `R-beta` | `01957a3b-...-000000000002` | "Design Team" | E-bob | bob(owner,100), alice(member,0) | invite | mutable, reactions, reply-to, channels |
| `R-gamma` | `01957a3b-...-000000000003` | "Open Chat" | E-admin | admin(owner,100), alice(member,0), bob(member,0), carol(member,0) | open | mutable, reactions, reply-to, read-receipts, presence, media, profile, watch, collab, threads, drafts, cross-room-ref |
| `R-empty` | `01957a3b-...-000000000004` | "Bus Only Room" | E-alice | alice(owner,100), bob(member,0) | invite | [] |
| `R-minimal` | `01957a3b-...-000000000005` | "Sync Test Room" | E-alice | alice(owner,100) | invite | [] |

**R-alpha config/state.json 完整示例**：

```json
{
  "room_id": "01957a3b-0000-7000-8000-000000000001",
  "name": "Project Alpha",
  "created_by": "@alice:relay-a.example.com",
  "created_at": "2026-02-20T10:00:00.000Z",
  "membership": {
    "policy": "invite",
    "members": {
      "@alice:relay-a.example.com": "owner",
      "@bob:relay-a.example.com": "member",
      "@code-reviewer:relay-a.example.com": "member"
    }
  },
  "power_levels": {
    "default": 0,
    "events_default": 0,
    "admin": 100,
    "users": {
      "@alice:relay-a.example.com": 100
    }
  },
  "relays": [
    { "endpoint": "tcp/relay-a.example.com:7447", "role": "primary" }
  ],
  "timeline": {
    "window_size": "monthly",
    "max_refs_per_window": 100000
  },
  "encryption": "transport_only",
  "enabled_extensions": [
    "mutable", "reactions", "reply-to", "channels",
    "read-receipts", "presence", "media", "moderation", "profile", "watch"
  ],
  "ext": {
    "moderation": { "power_level": 50 },
    "channels": {
      "hints": [
        { "id": "code-review", "name": "Code Review", "created_by": "@alice:relay-a.example.com" },
        { "id": "design", "name": "Design", "created_by": "@bob:relay-a.example.com" }
      ]
    },
    "annotations": {
      "channel_watch:@code-reviewer:relay-a.example.com": {
        "channels": ["code-review"],
        "scope": "all_rooms"
      }
    }
  }
}
```

### §2.6 验证数据 — Timeline & Messages

#### Timeline Index 文件结构

`ezagent/room/{room_id}/index/{YYYY-MM}/state.json` 包含该月份的所有 refs：

```json
{
  "_doc_type": "crdt_array<crdt_map>",
  "_key": "ezagent/room/01957a3b-...-000000000001/index/2026-02",
  "refs": [
    { /* ref 0: M-001 */ },
    { /* ref 1: M-002 */ },
    { /* ref 2: M-003 */ },
    { /* ref 3: M-004 */ },
    { /* ref 4: M-DEL */ }
  ]
}
```

#### 消息定义表

| ID | Room | Author | body | format | content_type |
|----|------|--------|------|--------|-------------|
| `M-001` | R-alpha | E-alice | "Hello, welcome to Project Alpha!" | text/plain | immutable |
| `M-002` | R-alpha | E-bob | "Thanks Alice! Ready to start." | text/plain | immutable |
| `M-003` | R-alpha | E-alice | "Please review this code:\n```rust\nfn main() {\n    println!(\"hello\");\n}\n```" | text/markdown | immutable |
| `M-004` | R-alpha | E-bob | "Looks good to me." | text/plain | immutable |
| `M-DEL` | R-alpha | E-alice | "This will be deleted." | text/plain | immutable |
| `M-005` | R-beta | E-bob | "Design meeting notes." | text/plain | immutable |
| `M-006` | R-beta | E-alice | "Let's use the new color palette." | text/plain | immutable |
| `M-007` | R-gamma | E-alice | "Cross-room test message." | text/plain | immutable |
| `M-008` | R-gamma | E-carol | "Hi from relay-b!" | text/plain | immutable |
| `M-009` | R-empty | E-alice | "Bus-only message." | text/plain | immutable |
| `M-010` | R-empty | E-bob | "Reply in core room." | text/plain | immutable |

#### 单条 Ref 完整示例（M-001 in R-alpha timeline）

```json
{
  "ref_id": "01JMXYZ00000000000000001",
  "author": "@alice:relay-a.example.com",
  "content_type": "immutable",
  "content_id": "sha256:e3b0c44298fc1c149afbf4c8996fb924...",
  "created_at": "2026-02-21T10:05:00.000Z",
  "status": "active",
  "signature": "ed25519:<alice 签名覆盖以上 core 字段>",

  "ext.reactions": {
    "👍:@bob:relay-a.example.com": 1708500001000,
    "🎉:@code-reviewer:relay-a.example.com": 1708500002000
  },
  "ext.reply_to": null,
  "ext.channels": null,
  "ext.thread": null,

  "ext.annotations": {}
}
```

> Phase 1 测试加载此 ref 时，忽略所有 `ext.*` 字段，只读取 core 字段。Phase 2 测试使用完整数据。

#### Immutable Content 完整示例（M-001）

存储位置：`ezagent/room/{R-alpha}/content/sha256_e3b0c442.json`

```json
{
  "content_id": "sha256:e3b0c44298fc1c149afbf4c8996fb924...",
  "type": "immutable",
  "author": "@alice:relay-a.example.com",
  "body": "Hello, welcome to Project Alpha!",
  "format": "text/plain",
  "media_refs": [],
  "created_at": "2026-02-21T10:05:00.000Z",
  "signature": "ed25519:<alice 签名覆盖 content_id 以外的所有字段>"
}
```

#### 带有完整 Extension 字段的 Ref 示例（M-003）

```json
{
  "ref_id": "01JMXYZ00000000000000003",
  "author": "@alice:relay-a.example.com",
  "content_type": "mutable",
  "content_id": "uuid:01957a3b-0000-7000-9000-mut000000001",
  "created_at": "2026-02-21T10:15:00.000Z",
  "status": "edited",
  "signature": "ed25519:<alice 签名覆盖 core + signed ext 字段>",

  "ext.reactions": {
    "👀:@bob:relay-a.example.com": 1708500003000
  },
  "ext.reply_to": null,
  "ext.channels": ["code-review"],
  "ext.thread": null,

  "ext.annotations": {
    "watch:@code-reviewer:relay-a.example.com": {
      "reason": "processing_task",
      "on_content_edit": true,
      "on_reply": true,
      "on_thread": false,
      "on_reaction": false
    }
  }
}
```

#### M-004 的 Ref（被 reply, 被 redact, 被 watch 通知触发的目标）

```json
{
  "ref_id": "01JMXYZ00000000000000004",
  "author": "@bob:relay-a.example.com",
  "content_type": "immutable",
  "content_id": "sha256:d4e5f6...",
  "created_at": "2026-02-21T10:20:00.000Z",
  "status": "active",
  "signature": "ed25519:<bob 签名>",

  "ext.reactions": {},
  "ext.reply_to": { "ref_id": "01JMXYZ00000000000000003" },
  "ext.channels": null,
  "ext.thread": null,
  "ext.annotations": {}
}
```

### §2.7 验证数据 — Extension Data

以下 Extension 数据**内嵌在 §2.6 的 ref / content fixture 中**或存储为**独立 doc**。

#### §2.7.1 Mutable (EXT-01)

| ID | Ref | 编辑后 body | 存储位置 |
|----|-----|------------|---------|
| `MUT-001` | M-003 | "Please review this **updated** code:\n```rust\nfn main() {\n    println!(\"hello world\");\n}\n```" | `ezagent/room/{R-alpha}/content/uuid_mut-001/state.json` |

```json
{
  "content_id": "uuid:01957a3b-0000-7000-9000-mut000000001",
  "type": "mutable",
  "author": "@alice:relay-a.example.com",
  "body": "Please review this **updated** code:\n```rust\nfn main() {\n    println!(\"hello world\");\n}\n```",
  "format": "text/markdown",
  "media_refs": []
}
```

#### §2.7.2 Collab (EXT-02)

| ID | Room | Author | ACL mode | Editors | 存储位置 |
|----|------|--------|----------|---------|---------|
| `COL-001` | R-gamma | E-alice | explicit | [E-alice, E-bob] | `ezagent/room/{R-gamma}/content/uuid_col-001/` |

ACL Doc: `ezagent/room/{R-gamma}/content/uuid_col-001/acl/state.json`

```json
{
  "owner": "@alice:relay-a.example.com",
  "mode": "explicit",
  "editors": ["@alice:relay-a.example.com", "@bob:relay-a.example.com"],
  "updated_at": "2026-02-22T14:00:00.000Z"
}
```

#### §2.7.3 Reactions (EXT-03)

内嵌在 ref 的 `ext.reactions` 字段中。

| ID | Target Ref | Reactor | Emoji | Timestamp |
|----|-----------|---------|-------|-----------|
| `RX-001` | M-001 | E-bob | 👍 | 1708500001000 |
| `RX-002` | M-001 | E-agent1 | 🎉 | 1708500002000 |
| `RX-003` | M-003 | E-bob | 👀 | 1708500003000 |
| `RX-004` | M-001 | E-bob | 👍 | — (撤销 RX-001) |

Fixture 中 M-001 的 `ext.reactions` 最终状态（RX-004 撤销后）：

```json
{
  "🎉:@code-reviewer:relay-a.example.com": 1708500002000
}
```

> 注意 👍 已被撤销所以不存在。这是 dump 的**最终状态**，不是操作历史。

#### §2.7.4 Reply To (EXT-04)

内嵌在 ref 的 `ext.reply_to` 字段中。

| ID | Replying Ref | reply_to target |
|----|-------------|----------------|
| `RP-001` | M-002 → M-001 | `{"ref_id": "01JMXYZ...0001"}` |
| `RP-002` | M-004 → M-003 | `{"ref_id": "01JMXYZ...0003"}` |

#### §2.7.5 Cross-Room Ref (EXT-05)

| ID | Source Room | Ref | ext.reply_to |
|----|-----------|-----|-------------|
| `XR-001` | R-gamma | 新 ref by E-alice | `{"ref_id":"...M-003.ref_id","room_id":"R-alpha.room_id","window":"2026-02"}` |

#### §2.7.6 Channels (EXT-06)

内嵌在 ref 的 `ext.channels` 字段中。

| ID | Ref | ext.channels |
|----|-----|-------------|
| `CH-001` | M-003 | `["code-review"]` |
| `CH-002` | M-005 | `["design"]` |
| `CH-003` | M-006 | `["design"]` |
| `CH-004` | 新 ref by E-bob in R-alpha | `["code-review", "design"]` |

#### §2.7.7 Moderation (EXT-07)

独立 doc: `ezagent/room/{R-alpha}/ext/moderation/state.json`

```json
{
  "_doc_type": "crdt_array",
  "_key": "ezagent/room/.../ext/moderation",
  "actions": [
    {
      "action_id": "01JMXYZ_MOD001",
      "action": "redact",
      "target_ref": "01JMXYZ00000000000000004",
      "by": "@alice:relay-a.example.com",
      "reason": "Inappropriate content",
      "timestamp": "2026-02-22T12:00:00.000Z",
      "signature": "ed25519:..."
    },
    {
      "action_id": "01JMXYZ_MOD002",
      "action": "pin",
      "target_ref": "01JMXYZ00000000000000001",
      "by": "@alice:relay-a.example.com",
      "reason": "Welcome message",
      "timestamp": "2026-02-22T12:05:00.000Z",
      "signature": "ed25519:..."
    }
  ]
}
```

#### §2.7.8 Read Receipts (EXT-08)

独立 doc: `ezagent/room/{R-alpha}/ext/read-receipts/state.json`

```json
{
  "_doc_type": "crdt_map",
  "_key": "ezagent/room/.../ext/read-receipts",
  "@alice:relay-a.example.com": {
    "last_read_ref": "01JMXYZ00000000000000004",
    "last_read_window": "2026-02",
    "updated_at": "2026-02-22T11:00:00.000Z"
  },
  "@bob:relay-a.example.com": {
    "last_read_ref": "01JMXYZ00000000000000003",
    "last_read_window": "2026-02",
    "updated_at": "2026-02-22T10:30:00.000Z"
  },
  "@code-reviewer:relay-a.example.com": {
    "last_read_ref": "01JMXYZ00000000000000001",
    "last_read_window": "2026-02",
    "updated_at": "2026-02-21T10:10:00.000Z"
  }
}
```

#### §2.7.9 Presence (EXT-09)

Presence 是 ephemeral 数据，不持久化，不存在 fixture 文件。测试时由 scenario 动态创建。

预期状态表（用于 test case 断言）：

| ID | Room | Entity | Online | Typing |
|----|------|--------|--------|--------|
| `PR-001` | R-alpha | E-alice | true | false |
| `PR-002` | R-alpha | E-bob | true | true |
| `PR-003` | R-alpha | E-agent1 | true | false |

#### §2.7.10 Media (EXT-10)

| ID | Room | Author | filename | mime_type | size | blob_hash | 存储位置 |
|----|------|--------|----------|-----------|------|-----------|---------|
| `BL-001` | R-alpha | E-alice | diagram.png | image/png | 204800 | sha256:aaaa1111... | `ezagent/room/{R-alpha}/blob/aaaa1111.bin` |
| `BL-002` | R-alpha | E-bob | report.pdf | application/pdf | 1048576 | sha256:bbbb2222... | `ezagent/room/{R-alpha}/blob/bbbb2222.bin` |

Blob 元信息存储在 ref 的 `ext.annotations` 中：

```json
"ext.annotations": {
  "media_meta:@system:local": {
    "blob_hash": "sha256:aaaa1111...",
    "filename": "diagram.png",
    "mime_type": "image/png",
    "size_bytes": 204800,
    "dimensions": { "width": 1920, "height": 1080 }
  }
}
```

#### §2.7.11 Threads (EXT-11)

| ID | Room | Root Ref | Thread replies |
|----|------|---------|---------------|
| `TH-001` | R-gamma | M-007 | 2 条 (by E-bob, E-carol) |

Thread 回复的 ref 在 R-gamma 的 timeline index 中，标记 `ext.thread = { "root": "M-007.ref_id" }`。

#### §2.7.12 Drafts (EXT-12)

独立 doc: `ezagent/room/{R-gamma}/ext/draft/@alice:relay-a.example.com/state.json`

```json
{
  "body": "Work in progress reply...",
  "reply_to": "01JMXYZ00000000000000008",
  "channels": null,
  "updated_at": "2026-02-22T15:00:00.000Z"
}
```

#### §2.7.13 Profile (EXT-13)

独立 doc，存储位置见 §2.3 的 entity 子目录。

| ID | Entity | entity_type | display_name |
|----|--------|------------|-------------|
| `PF-001` | E-alice | human | "Alice" |
| `PF-002` | E-agent1 | agent | "Code Review Agent" |
| `PF-003` | E-agent2 | agent | "Translator" |

PF-002 state.json:

```json
{
  "frontmatter": {
    "entity_type": "agent",
    "display_name": "Code Review Agent",
    "avatar_hash": "sha256:a1b2c3..."
  },
  "body": "## Capabilities\n- **Code Review**: Rust, Python, TypeScript\n- Security audit\n\n## Constraints\n- Context window: 200k tokens\n\n## Availability\nOnline 24/7, auto-accepts tasks tagged with `code-review`."
}
```

#### §2.7.14 Watch (EXT-14)

内嵌在 ref / room_config 的 `ext.annotations` 中。

| ID | Type | Watcher | Target | 存储位置 |
|----|------|---------|--------|---------|
| `W-001` | ref | E-agent1 | M-003 | M-003 ref 的 `ext.annotations."watch:@code-reviewer:..."` |
| `W-002` | channel | E-agent1 | ["code-review"] | R-alpha config 的 `ext.annotations."channel_watch:@code-reviewer:..."` |

### §2.8 验证数据 — Relay

| ID | relay_domain | Compliance Level | 说明 |
|----|-------------|-----------------|------|
| `RELAY-A` | `relay-a.example.com` | Level 3 (Full) | 主测试 Relay |
| `RELAY-B` | `relay-b.example.com` | Level 1 (Basic) | 外部 Relay（E-carol 所在） |

#### RELAY-A config fixture

存储位置：`ezagent/relay/relay-a.example.com/config.json`

```json
{
  "relay_domain": "relay-a.example.com",
  "endpoint": "tcp/relay-a.example.com:7447",
  "compliance_level": 3,
  "supported_extensions": [
    "mutable", "collab", "reactions", "reply-to", "cross-room-ref",
    "channels", "moderation", "read-receipts", "presence",
    "media", "threads", "drafts", "profile", "watch"
  ],
  "admin_entity_id": "@admin:relay-a.example.com",
  "tls": {
    "enabled": true,
    "cert_fingerprint": "sha256:..."
  }
}
```

#### RELAY-A discovery fixture

存储位置：`ezagent/relay/relay-a.example.com/discovery/profiles.json`

```json
{
  "_note": "Relay 自行构建的 Profile 聚合索引，格式由实现定义",
  "indexed_entities": [
    "@alice:relay-a.example.com",
    "@bob:relay-a.example.com",
    "@code-reviewer:relay-a.example.com",
    "@translator:relay-a.example.com"
  ],
  "last_rebuilt": "2026-02-22T16:00:00.000Z"
}
```

#### RELAY-A proxy profile fixture (Virtual User)

存储位置：`ezagent/relay/relay-a.example.com/discovery/proxy-profiles/@carol:relay-b.example.com.json`

```json
{
  "_note": "从 RELAY-B 拉取的 carol 的 profile 缓存",
  "source_relay": "relay-b.example.com",
  "cached_at": "2026-02-22T15:00:00.000Z",
  "frontmatter": {
    "entity_type": "human",
    "display_name": "Carol"
  },
  "body": "## About\nDesigner based in Europe."
}
```

#### RELAY-B config fixture

存储位置：`ezagent/relay/relay-b.example.com/config.json`

```json
{
  "relay_domain": "relay-b.example.com",
  "endpoint": "tcp/relay-b.example.com:7447",
  "compliance_level": 1,
  "supported_extensions": [],
  "admin_entity_id": null,
  "tls": {
    "enabled": true,
    "cert_fingerprint": "sha256:..."
  }
}
```

### §2.9 Data Index（ID → 路径映射）

`data-index.yaml` 将验证数据 ID 映射到 fixture 文件路径和 JSON 内部位置：

```yaml
# === Entities ===
E-alice:
  keypair: keypairs/alice.json
  pubkey: ezagent/entity/@alice:relay-a.example.com/identity/pubkey.json
E-bob:
  keypair: keypairs/bob.json
  pubkey: ezagent/entity/@bob:relay-a.example.com/identity/pubkey.json
# ... (其他 entity 省略，格式相同)

# === Rooms ===
R-alpha:
  config: ezagent/room/01957a3b-0000-7000-8000-000000000001/config/state.json
R-beta:
  config: ezagent/room/01957a3b-0000-7000-8000-000000000002/config/state.json
R-gamma:
  config: ezagent/room/01957a3b-0000-7000-8000-000000000003/config/state.json
R-empty:
  config: ezagent/room/01957a3b-0000-7000-8000-000000000004/config/state.json
R-minimal:
  config: ezagent/room/01957a3b-0000-7000-8000-000000000005/config/state.json

# === Messages (ref in timeline + content) ===
M-001:
  ref: ezagent/room/01957a3b-...-000000000001/index/2026-02/state.json#refs[0]
  content: ezagent/room/01957a3b-...-000000000001/content/sha256_e3b0c442.json
M-002:
  ref: ezagent/room/01957a3b-...-000000000001/index/2026-02/state.json#refs[1]
  content: ezagent/room/01957a3b-...-000000000001/content/sha256_a1b2c3d4.json
M-003:
  ref: ezagent/room/01957a3b-...-000000000001/index/2026-02/state.json#refs[2]
  content.immutable: ezagent/room/01957a3b-...-000000000001/content/sha256_f5e6d7c8.json
  content.mutable: ezagent/room/01957a3b-...-000000000001/content/uuid_mut-001/state.json
# ... (其他 message 省略)

# === Extension Data (内嵌在 ref 中的) ===
RX-001:
  location: M-001.ref > ext.reactions > "👍:@bob:relay-a.example.com"
  note: "已被 RX-004 撤销，fixture 最终状态中不存在"
RX-002:
  location: M-001.ref > ext.reactions > "🎉:@code-reviewer:relay-a.example.com"
RP-001:
  location: M-002.ref > ext.reply_to
RP-002:
  location: M-004.ref > ext.reply_to
CH-001:
  location: M-003.ref > ext.channels
W-001:
  location: M-003.ref > ext.annotations > "watch:@code-reviewer:relay-a.example.com"
W-002:
  location: R-alpha.config > ext.annotations > "channel_watch:@code-reviewer:relay-a.example.com"

# === Extension Data (独立 doc) ===
MUT-001:
  path: ezagent/room/01957a3b-...-000000000001/content/uuid_mut-001/state.json
COL-001:
  content: ezagent/room/01957a3b-...-000000000003/content/uuid_col-001/state.json
  acl: ezagent/room/01957a3b-...-000000000003/content/uuid_col-001/acl/state.json
MOD-001:
  path: ezagent/room/01957a3b-...-000000000001/ext/moderation/state.json#actions[0]
MOD-002:
  path: ezagent/room/01957a3b-...-000000000001/ext/moderation/state.json#actions[1]
RR-001:
  path: ezagent/room/01957a3b-...-000000000001/ext/read-receipts/state.json > @alice:...
RR-002:
  path: ezagent/room/01957a3b-...-000000000001/ext/read-receipts/state.json > @bob:...
RR-003:
  path: ezagent/room/01957a3b-...-000000000001/ext/read-receipts/state.json > @code-reviewer:...
DR-001:
  path: ezagent/room/01957a3b-...-000000000003/ext/draft/@alice:relay-a.example.com/state.json
PF-001:
  path: ezagent/entity/@alice:relay-a.example.com/ext/profile/state.json
PF-002:
  path: ezagent/entity/@code-reviewer:relay-a.example.com/ext/profile/state.json
PF-003:
  path: ezagent/entity/@translator:relay-a.example.com/ext/profile/state.json
BL-001:
  path: ezagent/room/01957a3b-...-000000000001/blob/aaaa1111.bin
  meta: M-BL001.ref > ext.annotations > "media_meta:@system:local"
BL-002:
  path: ezagent/room/01957a3b-...-000000000001/blob/bbbb2222.bin

# === Relay ===
RELAY-A:
  config: ezagent/relay/relay-a.example.com/config.json
  discovery: ezagent/relay/relay-a.example.com/discovery/profiles.json
  proxy.carol: ezagent/relay/relay-a.example.com/discovery/proxy-profiles/@carol:relay-b.example.com.json
RELAY-B:
  config: ezagent/relay/relay-b.example.com/config.json

# === Socialware Installation (Local Only) ===
SW-REGISTRY:
  path: ezagent/socialware/registry.toml
SW-EW:
  manifest: ezagent/socialware/event-weaver/manifest.toml
SW-TA:
  manifest: ezagent/socialware/task-arena/manifest.toml
SW-RP:
  manifest: ezagent/socialware/res-pool/manifest.toml
SW-AF:
  manifest: ezagent/socialware/agent-forge/manifest.toml

# === AgentForge Data (Local Only) ===
AF-TPL-001:
  path: ezagent/socialware/agent-forge/templates/code-reviewer.toml
AF-AGENT-001:
  config: ezagent/socialware/agent-forge/agents/review-bot/config.toml
  soul: ezagent/socialware/agent-forge/agents/review-bot/soul.md

# === EXT-15 Command Fixtures ===
CMD-001:
  location: M-CMD-001.ref > ext.command
  note: "/ta:claim task-42 by @alice"
CMD-RESULT-001:
  location: M-CMD-001.ref > ext.annotations > "command_result:uuid_cmd-001"
  note: "TaskArena claim success result"

# === Error Fixtures ===
ERR-SIGN-001:
  base: M-001.ref
  tampered: signature 替换为 mallory 签名
  path: ezagent-error/room/01957a3b-...-000000000001/index/2026-02/forged-signature.json
ERR-SIGN-003:
  base: M-001.ref
  tampered: timestamp 设为 future (now + 10min)
  path: ezagent-error/room/01957a3b-...-000000000001/index/2026-02/future-timestamp.json
ERR-MSG-002:
  base: M-001.content
  tampered: body 被修改，hash 不再匹配
  path: ezagent-error/room/01957a3b-...-000000000001/content/sha256_tampered.json
ERR-MSG-003:
  base: M-001
  tampered: content.author 改为 @bob（与 ref.author @alice 不一致）
  path: ezagent-error/room/01957a3b-...-000000000001/index/2026-02/author-mismatch.json
```

### §2.10 Scenarios（数据生成脚本）

Scenario 文件定义"通过 Engine API 执行什么操作来产生 fixture"。格式为 YAML，类似 GitHub Actions 的 step 结构。

#### Scenario 格式规范

```yaml
name: <scenario 名称>
description: <描述>
depends_on:                    # 必须先执行的 scenario
  - <scenario 文件名>
steps:
  - name: <步骤名称>
    as: <entity_id>            # 以哪个 entity 身份执行
    action: <操作类型>
    params:
      <参数>: <值>
    assigns:                   # 将输出值赋给变量
      <变量名>: <输出字段>
    produces:                  # 此步骤产生/更新的 fixture 文件
      - <fixture 路径>
```

**action 类型列表**：

| 分类 | action | 说明 | 阶段 |
|------|--------|------|------|
| Identity | `init_identity` | 生成密钥对 | Phase 1 |
| Identity | `register_identity` | 向 Public Relay 注册身份 | Phase 1 |
| Identity | `verify_peer` | P2P challenge-response 身份验证 | Phase 1 |
| Relay | `configure_relay` | 配置 Relay 节点（可选） | Phase 0+ |
| Room | `create_room` | 创建 Room | Phase 1 |
| Room | `invite` | 邀请成员 | Phase 1 |
| Room | `join` | 加入 Room | Phase 1 |
| Room | `update_config` | 更新 Room Config | Phase 1 |
| Message | `send_message` | 发送消息 | Phase 1 |
| Message | `delete_message` | 删除消息 | Phase 1 |
| EXT-01 | `upgrade_mutable` | immutable → mutable | Phase 2 |
| EXT-01 | `edit_message` | 编辑 mutable content | Phase 2 |
| EXT-02 | `upgrade_collab` | mutable → collab | Phase 2 |
| EXT-02 | `update_acl` | 修改 ACL | Phase 2 |
| EXT-03 | `add_reaction` | 添加 reaction | Phase 2 |
| EXT-03 | `remove_reaction` | 撤销 reaction | Phase 2 |
| EXT-04 | `send_reply` | 发送回复（自动设 reply_to） | Phase 2 |
| EXT-05 | `send_cross_room_reply` | 跨 Room 回复 | Phase 2 |
| EXT-06 | `send_tagged` | 发送带 channel tag 的消息 | Phase 2 |
| EXT-07 | `moderate` | 审核操作 | Phase 2 |
| EXT-08 | `update_read_receipt` | 更新阅读进度 | Phase 2 |
| EXT-09 | `set_presence` | 设置在线状态 | Phase 2 |
| EXT-09 | `set_typing` | 设置输入状态 | Phase 2 |
| EXT-10 | `upload_blob` | 上传 blob | Phase 2 |
| EXT-10 | `send_media_message` | 发送媒体消息 | Phase 2 |
| EXT-11 | `send_thread_reply` | 发送 thread 回复 | Phase 2 |
| EXT-12 | `save_draft` | 保存草稿 | Phase 2 |
| EXT-13 | `publish_profile` | 发布 Profile | Phase 2 |
| EXT-14 | `set_watch` | 设置 watch annotation | Phase 2 |
| EXT-14 | `set_channel_watch` | 设置 channel watch | Phase 2 |
| Error | `inject_raw` | 绕过 Engine 直接注入原始数据 | 异常测试 |
| Error | `copy_and_tamper` | 复制正确数据并篡改指定字段 | 异常测试 |

#### 示例 Scenario

**00-identities.yaml**:

```yaml
name: Initialize Identities
description: 为所有测试 Entity 生成 Ed25519 密钥对
depends_on: []
steps:
  - name: init alice
    as: "@alice:relay-a.example.com"
    action: init_identity
    produces:
      - keypairs/alice.json
      - ezagent/entity/@alice:relay-a.example.com/identity/pubkey.json

  - name: init bob
    as: "@bob:relay-a.example.com"
    action: init_identity
    produces:
      - keypairs/bob.json
      - ezagent/entity/@bob:relay-a.example.com/identity/pubkey.json

  - name: init carol
    as: "@carol:relay-b.example.com"
    action: init_identity
    produces:
      - keypairs/carol.json
      - ezagent/entity/@carol:relay-b.example.com/identity/pubkey.json

  - name: init code-reviewer
    as: "@code-reviewer:relay-a.example.com"
    action: init_identity
    produces:
      - keypairs/code-reviewer.json
      - ezagent/entity/@code-reviewer:relay-a.example.com/identity/pubkey.json

  - name: init translator
    as: "@translator:relay-a.example.com"
    action: init_identity
    produces:
      - keypairs/translator.json
      - ezagent/entity/@translator:relay-a.example.com/identity/pubkey.json

  - name: init mallory
    as: "@mallory:relay-a.example.com"
    action: init_identity
    produces:
      - keypairs/mallory.json
      - ezagent/entity/@mallory:relay-a.example.com/identity/pubkey.json

  - name: init admin
    as: "@admin:relay-a.example.com"
    action: init_identity
    produces:
      - keypairs/admin.json
      - ezagent/entity/@admin:relay-a.example.com/identity/pubkey.json

  - name: init outsider
    as: "@outsider:relay-c.example.com"
    action: init_identity
    produces:
      - keypairs/outsider.json
      - ezagent/entity/@outsider:relay-c.example.com/identity/pubkey.json
```

**00-relays.yaml**:

```yaml
name: Initialize Relays
description: 配置测试用 Relay 节点
depends_on: []
steps:
  - name: configure RELAY-A
    action: configure_relay
    params:
      relay_domain: "relay-a.example.com"
      endpoint: "tcp/relay-a.example.com:7447"
      compliance_level: 3
      supported_extensions:
        - mutable
        - collab
        - reactions
        - reply-to
        - cross-room-ref
        - channels
        - moderation
        - read-receipts
        - presence
        - media
        - threads
        - drafts
        - profile
        - watch
      admin_entity_id: "@admin:relay-a.example.com"
    produces:
      - ezagent/relay/relay-a.example.com/config.json

  - name: configure RELAY-B
    action: configure_relay
    params:
      relay_domain: "relay-b.example.com"
      endpoint: "tcp/relay-b.example.com:7447"
      compliance_level: 1
      supported_extensions: []
      admin_entity_id: null
    produces:
      - ezagent/relay/relay-b.example.com/config.json
```

**01-R-alpha.yaml**:

```yaml
name: Setup Room Alpha
description: 创建 R-alpha，邀请成员，发送 Bus 消息
depends_on:
  - 00-identities.yaml
  - 00-relays.yaml
steps:
  - name: create room
    as: "@alice:relay-a.example.com"
    action: create_room
    params:
      room_id: "01957a3b-0000-7000-8000-000000000001"
      name: "Project Alpha"
      policy: invite
      relays:
        - endpoint: "tcp/relay-a.example.com:7447"
          role: primary
      enabled_extensions:
        - mutable
        - reactions
        - reply-to
        - channels
        - read-receipts
        - presence
        - media
        - moderation
        - profile
        - watch
    assigns:
      room_id: "$R_ALPHA"
    produces:
      - ezagent/room/01957a3b-0000-7000-8000-000000000001/config/state.json

  - name: invite bob
    as: "@alice:relay-a.example.com"
    action: invite
    params:
      room_id: "$R_ALPHA"
      entity_id: "@bob:relay-a.example.com"

  - name: invite agent1
    as: "@alice:relay-a.example.com"
    action: invite
    params:
      room_id: "$R_ALPHA"
      entity_id: "@code-reviewer:relay-a.example.com"

  - name: send M-001
    as: "@alice:relay-a.example.com"
    action: send_message
    params:
      room_id: "$R_ALPHA"
      body: "Hello, welcome to Project Alpha!"
      format: text/plain
    assigns:
      ref_id: "$M_001_REF"
      content_id: "$M_001_CONTENT"
    produces:
      - ezagent/room/01957a3b-...-000000000001/index/2026-02/state.json
      - ezagent/room/01957a3b-...-000000000001/content/sha256_e3b0c442.json

  - name: send M-002
    as: "@bob:relay-a.example.com"
    action: send_message
    params:
      room_id: "$R_ALPHA"
      body: "Thanks Alice! Ready to start."
      format: text/plain
    assigns:
      ref_id: "$M_002_REF"

  - name: send M-003
    as: "@alice:relay-a.example.com"
    action: send_message
    params:
      room_id: "$R_ALPHA"
      body: "Please review this code:\n```rust\nfn main() {\n    println!(\"hello\");\n}\n```"
      format: text/markdown
    assigns:
      ref_id: "$M_003_REF"

  - name: send M-004
    as: "@bob:relay-a.example.com"
    action: send_message
    params:
      room_id: "$R_ALPHA"
      body: "Looks good to me."
      format: text/plain
    assigns:
      ref_id: "$M_004_REF"

  - name: send M-DEL
    as: "@alice:relay-a.example.com"
    action: send_message
    params:
      room_id: "$R_ALPHA"
      body: "This will be deleted."
      format: text/plain
    assigns:
      ref_id: "$M_DEL_REF"
```

**02-ext-reactions.yaml**:

```yaml
name: Extension - Reactions
description: 在 R-alpha 的消息上添加/撤销 reactions
depends_on:
  - 01-R-alpha.yaml
steps:
  - name: "RX-001: bob 👍 M-001"
    as: "@bob:relay-a.example.com"
    action: add_reaction
    params:
      room_id: "$R_ALPHA"
      ref_id: "$M_001_REF"
      emoji: "👍"

  - name: "RX-002: agent1 🎉 M-001"
    as: "@code-reviewer:relay-a.example.com"
    action: add_reaction
    params:
      room_id: "$R_ALPHA"
      ref_id: "$M_001_REF"
      emoji: "🎉"

  - name: "RX-003: bob 👀 M-003"
    as: "@bob:relay-a.example.com"
    action: add_reaction
    params:
      room_id: "$R_ALPHA"
      ref_id: "$M_003_REF"
      emoji: "👀"

  - name: "RX-004: bob 撤销 👍 on M-001"
    as: "@bob:relay-a.example.com"
    action: remove_reaction
    params:
      room_id: "$R_ALPHA"
      ref_id: "$M_001_REF"
      emoji: "👍"
```

**02-ext-watch.yaml**:

```yaml
name: Extension - Watch
description: Agent 在 R-alpha 设置 ref watch 和 channel watch
depends_on:
  - 01-R-alpha.yaml
  - 02-ext-reply-to.yaml
steps:
  - name: "W-001: agent1 watch M-003"
    as: "@code-reviewer:relay-a.example.com"
    action: set_watch
    params:
      room_id: "$R_ALPHA"
      ref_id: "$M_003_REF"
      on_content_edit: true
      on_reply: true
      on_thread: false
      on_reaction: false
      reason: "processing_task"

  - name: "W-002: agent1 channel watch code-review"
    as: "@code-reviewer:relay-a.example.com"
    action: set_channel_watch
    params:
      room_id: "$R_ALPHA"
      channels: ["code-review"]
      scope: all_rooms
```

**99-errors.yaml**:

```yaml
name: Generate Error Fixtures
description: 复制正确 fixture 并篡改，产生异常数据
depends_on:
  - 01-R-alpha.yaml
steps:
  - name: "ERR-SIGN-001: forged signature"
    action: copy_and_tamper
    params:
      source: ezagent/room/01957a3b-...-000000000001/index/2026-02/state.json
      extract: refs[0]
      tamper:
        signature: "ed25519:<mallory 用自己的私钥签名>"
        _signer_key: keypairs/mallory.json
      note: "M-001 的 ref，签名被替换为 mallory 的签名，但 author 仍为 alice"
    produces:
      - ezagent-error/room/01957a3b-...-000000000001/index/2026-02/forged-signature.json

  - name: "ERR-SIGN-003: future timestamp"
    action: copy_and_tamper
    params:
      source: ezagent/room/01957a3b-...-000000000001/index/2026-02/state.json
      extract: refs[0]
      tamper:
        timestamp: "+10m"
      note: "M-001 的 Signed Envelope，timestamp 设为当前时间 + 10 分钟"
    produces:
      - ezagent-error/room/01957a3b-...-000000000001/index/2026-02/future-timestamp.json

  - name: "ERR-MSG-002: tampered content"
    action: copy_and_tamper
    params:
      source: ezagent/room/01957a3b-...-000000000001/content/sha256_e3b0c442.json
      tamper:
        body: "TAMPERED - this is not the original message"
      note: "M-001 的 content，body 被修改但 content_id (hash) 未变 → hash 不匹配"
    produces:
      - ezagent-error/room/01957a3b-...-000000000001/content/sha256_tampered.json

  - name: "ERR-MSG-003: author mismatch"
    action: copy_and_tamper
    params:
      source: ezagent/room/01957a3b-...-000000000001/content/sha256_e3b0c442.json
      tamper:
        author: "@bob:relay-a.example.com"
      note: "M-001 的 content，author 改为 bob 但 ref.author 是 alice → 不一致"
    produces:
      - ezagent-error/room/01957a3b-...-000000000001/index/2026-02/author-mismatch.json
```

### §2.11 Error Fixtures（异常数据）

Error Fixture 存储在 `ezagent-error/` 目录中，结构与 `ezagent/` 完全镜像。

| Error ID | 基于 | 篡改内容 | 用于 Test Case |
|----------|------|---------|---------------|
| `ERR-SIGN-001` | M-001 ref | signature 替换为 mallory 签名 | TC-1-SIGN-002 |
| `ERR-SIGN-003` | M-001 Signed Envelope | timestamp 设为 now + 10min | TC-1-SIGN-003 |
| `ERR-MSG-002` | M-001 content | body 篡改，hash 不匹配 | TC-1-MSG-002 |
| `ERR-MSG-003` | M-001 content | author 改为 bob（与 ref 不一致） | TC-1-MSG-003 |

每个 error fixture JSON 文件内部包含 `_error_meta` 字段标注来源和篡改说明：

```json
{
  "_error_meta": {
    "error_id": "ERR-SIGN-001",
    "based_on": "ezagent/room/.../index/2026-02/state.json#refs[0]",
    "tampered_fields": ["signature"],
    "description": "M-001 ref 的签名被替换为 mallory 用自己私钥生成的签名"
  },
  "ref_id": "01JMXYZ00000000000000001",
  "author": "@alice:relay-a.example.com",
  "content_type": "immutable",
  "content_id": "sha256:e3b0c442...",
  "created_at": "2026-02-21T10:05:00.000Z",
  "status": "active",
  "signature": "ed25519:<mallory 的签名，验证时会失败>"
}
```

---


---

## 附录 I: Scenario 文件完整列表

| 文件 | 阶段 | depends_on | 产生的 Fixture |
|------|------|-----------|---------------|
| `00-identities.yaml` | Phase 1 | — | `keypairs/*`, `ezagent/entity/*/identity/pubkey.json` |
| `00-relays.yaml` | Phase 0+ | — | `ezagent/relay/*/config.json` |
| `01-R-alpha.yaml` | Phase 1 | 00-identities, 00-relays | R-alpha config + index + content (M-001~M-004, M-DEL) |
| `01-R-beta.yaml` | Phase 1 | 00-identities | R-beta config + index + content (M-005, M-006) |
| `01-R-gamma.yaml` | Phase 1 | 00-identities | R-gamma config + index + content (M-007, M-008) |
| `01-R-empty.yaml` | Phase 1 | 00-identities | R-empty config + index + content (M-009, M-010) |
| `01-R-minimal.yaml` | Phase 0+ | 00-identities | R-minimal config（仅 sync 测试用） |
| `02-ext-reactions.yaml` | Phase 2 | 01-R-alpha | M-001/M-003 的 ext.reactions 更新 |
| `02-ext-reply-to.yaml` | Phase 2 | 01-R-alpha | M-002/M-004 的 ext.reply_to 注入 |
| `02-ext-mutable.yaml` | Phase 2 | 01-R-alpha | M-003 升级为 mutable + MUT-001 content doc |
| `02-ext-collab.yaml` | Phase 2 | 01-R-gamma, 02-ext-mutable | COL-001 content + ACL doc |
| `02-ext-channels.yaml` | Phase 2 | 01-R-alpha, 01-R-beta | M-003/M-005/M-006 的 ext.channels 注入 |
| `02-ext-moderation.yaml` | Phase 2 | 01-R-alpha | MOD-001/MOD-002 overlay entries |
| `02-ext-read-receipts.yaml` | Phase 2 | 01-R-alpha | RR-001/RR-002/RR-003 |
| `02-ext-presence.yaml` | Phase 2 | 01-R-alpha | 无持久化 fixture（ephemeral，仅验证 SSE） |
| `02-ext-media.yaml` | Phase 2 | 01-R-alpha | BL-001/BL-002 blob + media ref |
| `02-ext-threads.yaml` | Phase 2 | 01-R-gamma | TH-001 thread replies |
| `02-ext-drafts.yaml` | Phase 2 | 01-R-gamma | DR-001 draft doc |
| `02-ext-profiles.yaml` | Phase 2 | 00-identities | PF-001/PF-002/PF-003 profile docs |
| `02-ext-watch.yaml` | Phase 2 | 01-R-alpha, 02-ext-reply-to | W-001/W-002 watch annotations |
| `02-ext-command.yaml` | Phase 2 | 01-R-alpha, 02-ext-profiles | CMD-001/CMD-RESULT-001 command fixtures |
| `03-socialware-registry.yaml` | Phase 5 | 00-identities | SW-REGISTRY + SW-EW/TA/RP/AF manifests |
| `03-agent-forge.yaml` | Phase 5 | 03-socialware-registry | AF-TPL-001 + AF-AGENT-001 |
| `99-errors.yaml` | 任意 | 01-R-alpha | ezagent-error/ 下所有异常 fixture |

**Scenario 执行顺序**：按文件名前缀排序。同前缀的无序依赖可并行执行。

```
00-identities.yaml ──┐
00-relays.yaml ──────┤
       │             │
       ├── 01-R-alpha.yaml ──── 02-ext-reactions.yaml
       │                   ├── 02-ext-reply-to.yaml ── 02-ext-watch.yaml
       │                   ├── 02-ext-mutable.yaml
       │                   ├── 02-ext-channels.yaml
       │                   ├── 02-ext-moderation.yaml
       │                   ├── 02-ext-read-receipts.yaml
       │                   ├── 02-ext-presence.yaml
       │                   ├── 02-ext-media.yaml
       │                   └── 99-errors.yaml
       │
       ├── 01-R-beta.yaml ──── 02-ext-channels.yaml
       │
       ├── 01-R-gamma.yaml ─── 02-ext-collab.yaml
       │                   ├── 02-ext-threads.yaml
       │                   └── 02-ext-drafts.yaml
       │
       ├── 01-R-empty.yaml
       ├── 01-R-minimal.yaml
       ├── 02-ext-profiles.yaml ── 02-ext-command.yaml
       │
       └── 03-socialware-registry.yaml ── 03-agent-forge.yaml
```

---

## 附录 J: Error Fixture 完整列表

| Error ID | 基于 | 篡改内容 | fixture 路径 | Test Case |
|----------|------|---------|-------------|-----------|
| `ERR-SIGN-001` | M-001 ref | signature → mallory 签名 | `ezagent-error/room/{R-alpha}/index/2026-02/forged-signature.json` | TC-1-SIGN-002 |
| `ERR-SIGN-003` | M-001 Signed Envelope | timestamp → now+10min | `ezagent-error/room/{R-alpha}/index/2026-02/future-timestamp.json` | TC-1-SIGN-003 |
| `ERR-MSG-002` | M-001 content | body 篡改，hash 不匹配 | `ezagent-error/room/{R-alpha}/content/sha256_tampered.json` | TC-1-MSG-002 |
| `ERR-MSG-003` | M-001 ref+content | content.author → bob | `ezagent-error/room/{R-alpha}/index/2026-02/author-mismatch.json` | TC-1-MSG-003 |

每个 error fixture 包含 `_error_meta` 字段，标注来源、篡改字段和描述。

Error fixture 的生成方式（在 `99-errors.yaml` 中定义）：

```
1. copy_and_tamper action 读取 source fixture
2. 提取指定节点 (extract)
3. 覆盖指定字段 (tamper)
4. 写入 ezagent-error/ 对应路径
```

---

## 附录 K: Test Case → Spec 规则追溯矩阵

| Test Case | Spec Section | MUST Rules Covered |
|-----------|-------------|-------------------|
| **Phase 0** | | |
| TC-0-SYNC-001~008 | Bus §4.2, §4.3, §4.5 | CRDT 冲突解决、可靠传递、eventual consistency |
| TC-0-P2P-001~003 | Bus §4.3.4, §7.1 | LAN scouting、peer-as-queryable、P2P + Relay fallback |
| **Phase 1: Engine** | | |
| TC-1-ENGINE-001~006 | Bus §3.1 | Datatype 注册、dependency resolution、storage_type |
| TC-1-HOOK-001~011 | Bus §3.2 | 三阶段约束、执行顺序、失败处理、全局限制 |
| TC-1-ANNOT-001~005 | Bus §3.3 | key 格式、权限、同步、保留、删除权限 |
| TC-1-INDEX-001~003 | Bus §3.4 | refresh 策略、API 映射 |
| **Phase 1: Backend** | | |
| TC-1-SYNC-001~007 | Bus §4.5, §4.3.4 | Initial sync、live sync、断线恢复、因果序、queryable 注册、multi-source query |
| TC-1-SIGN-001~004 | Bus §4.4 | 签名/验证、时间戳偏差、binary layout |
| TC-1-PERSIST-001~004 | Bus §4.6 | 本地持久化、pending updates、relay snapshot、ephemeral |
| **Phase 1: Built-in** | | |
| TC-1-IDENT-001~008 | Bus §5.1 | Entity ID 格式、密钥体系、签名 hook 顺序、身份注册、P2P 验证 |
| TC-1-ROOM-001~009 | Bus §5.2 | 创建、加入、权限、踢出、extension 加载、数据保留 |
| TC-1-TL-001~008 | Bus §5.3 | Ref 生成、CRDT 排序、分片、删除、ext 保留、分页 |
| TC-1-MSG-001~005 | Bus §5.4 | Hash 验证、篡改检测、author 一致性、未知 type |
| **Phase 1: API** | | |
| TC-1-API-001~005 | Bus §7 | Operation 覆盖率、Event Stream、reconnect、error handling |
| **Phase 2: Extensions** | | |
| TC-2-EXT01-001~004 | Ext §2 | Mutable 升级、编辑、权限、降级禁止 |
| TC-2-EXT02-001~004 | Ext §3 | Collab 升级、ACL mode、权限验证、降级禁止 |
| TC-2-EXT03-001~004 | Ext §4 | Reaction 添加/移除、权限、签名分离 |
| TC-2-EXT04-001~002 | Ext §5 | Reply To 注入、不可修改 |
| TC-2-EXT05-001~003 | Ext §6 | 跨 Room 引用、成员/非成员预览 |
| TC-2-EXT06-001~004 | Ext §7 | Channel tag 格式、聚合、隐式创建 |
| TC-2-EXT07-001~004 | Ext §8 | Redact、权限分级渲染、overlay 不修改原始数据 |
| TC-2-EXT08-001~003 | Ext §9 | Read receipt 更新、权限、unread count |
| TC-2-EXT09-001~003 | Ext §10 | 上线/离线检测、typing |
| TC-2-EXT10-001~003 | Ext §11 | Blob 上传、去重、不可变 |
| TC-2-EXT11-001~003 | Ext §12 | Thread 创建、view、root 不携带 ext.thread |
| TC-2-EXT12-001~003 | Ext §13 | Draft 同步、发送后清除、私有 |
| TC-2-EXT13-001~005 | Ext §14 | Profile 发布、entity_type 必需、权限、discovery、virtual user |
| TC-2-EXT14-001~008 | Ext §15 | Watch 设置、通知、channel watch、公开性、权限、保留 |
| **Phase 2: Interaction** | | |
| TC-2-INTERACT-001~005 | Ext §16 | signed/unsigned、多 extension 注入、升级链、agent 工作流、level 共存 |

**规则覆盖统计**：

| Spec 文档 | MUST 规则总数 | 覆盖率目标 |
|-----------|-------------|-----------|
| Bus Spec | 133 | 100% |
| Extensions Spec | 110 | 100% |
| **合计** | **243** | **100%** |

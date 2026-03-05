# ezagent Chat App — Operations Specification v0.1

> **状态**：Draft
> **日期**：2026-03-05
> **前置文档**：app-prd.md, chat-ui-spec.md, http-spec.md v0.1.2, bus-spec §5.2, relay-spec §7, phase-5-chat-app.md
> **作者**：Allen & Claude collaborative design
> **定位**：补充 chat-ui-spec（渲染层）和 phase-5-chat-app（验收用例），定义用户操作层的完整交互规范

---

## §0 概述

### §0.1 本文档的定位

现有文档体系：

| 文档 | 关注点 |
|------|--------|
| chat-ui-spec | 渲染管线：消息如何显示（Content Renderer, Decorator, Action, Tab） |
| phase-5-chat-app | 验收用例：77 个 TC，覆盖渲染、同步、打包 |
| app-prd | 产品需求：用户旅程概要、信息架构、打包方案 |
| http-spec | API 契约：REST + WebSocket endpoint 定义 |
| **本文档** | **操作规范：用户如何执行动作**（创建 Room、邀请成员、安装 App、编辑消息等） |

### §0.2 架构边界

```
App (Electron) → localhost:8847 (Local HTTP Server) → Relay (sync + registry)
                  ↑ 唯一 app-facing API               ↑ 协议层，app 不直接访问
```

- App 永远不直接调用 Relay API
- Local HTTP Server 是 Engine 的薄封装，决定哪些操作在本地完成、哪些需要 Relay 参与
- 本文档中的 API 调用均指向 Local HTTP Server，Relay 交互由 Engine 内部处理

### §0.3 与 bus-spec 的映射

| 本文档概念 | bus-spec 对应 |
|-----------|--------------|
| Room 可见性 (Public/Private) | `membership.policy`: `open` / `knock` / `invite`（bus-spec §5.2.3） |
| Room 角色 (owner/admin/member) | `membership.members` + `power_levels`（bus-spec §5.2.4） |
| Invite Code | 新增概念，需 Relay 配合存储（见 §3 + 附录 A） |

---

## §1 Onboarding & Empty States

### TC-5-OPS-001: First-Time Empty State

```
GIVEN  用户首次登录（通过 GitHub Device Flow, 参见 TC-5-AUTH-001），无任何 Room

WHEN   进入主界面

THEN   Sidebar 为空，显示欢迎提示
       Main Area 显示 Empty State:
         "Welcome to ezagent!"
         [Create a Room] (primary 按钮)
         [Join with Invite Code] (secondary 按钮)
       两个按钮分别打开 Create Room Dialog / Join Dialog
```

### TC-5-OPS-002: Returning User Empty Room

```
GIVEN  用户已有 Room 列表，选中某个空 Room

WHEN   进入该 Room

THEN   Timeline 为空
       Main Area 显示:
         "No messages yet. Say something!"
         Compose Area 处于 focus 状态
         若用户是 Room admin（power_level >= power_levels.admin），额外显示:
           [Invite Members] [Install Apps] 快捷入口
```

### TC-5-OPS-003: Onboarding Hints（首次使用引导）

```
GIVEN  首次登录后创建了第一个 Room

WHEN   进入该 Room

THEN   显示轻量 inline hints (dismissible):
       1. "Send your first message" (指向 Compose)
       2. "Invite members" (指向 Sidebar 或 Info Panel)
       3. "Install an app like TaskArena" (指向 Room Settings)
       用户完成每个动作后，对应 hint 自动消失
       用户可点击 "Dismiss all" 跳过
       Hint 状态存储在 Electron Store（本地持久化，不同步）
```

---

## §2 Room Management

> **Spec 引用**：bus-spec §5.2.3 (Room Config), §5.2.4 (Power Levels), §5.2.6 (Room 生命周期); http-spec §2.2 (Room CRUD)

### TC-5-OPS-010: Create Room Dialog

```
GIVEN  用户点击 [Create a Room]（Empty State 或 Sidebar "+" 按钮）

WHEN   Dialog 打开

THEN   显示表单:
       - Room Name (必填, 最长 256 字符, 参见 bus-spec §5.2.3 name 字段)
       - Description (可选, 最长 256 字符)
       - Access Policy:
           "Private — Invite only" (默认) → membership.policy = "invite"
           "Public — Anyone can join"     → membership.policy = "open"
       [Create] (primary) [Cancel]
```

### TC-5-OPS-011: Create Room 执行

```
GIVEN  用户填写 Room Name = "My Team", Access Policy = Private

WHEN   点击 [Create]

THEN   POST /api/rooms {
         name: "My Team",
         membership_policy: "invite"
       }
       Engine 内部执行 (bus-spec §5.2.6):
         1. 生成 UUIDv7 作为 room_id
         2. 创建 Room Config doc (创建者为 owner, power_level=100)
         3. 写入至少一个 Relay endpoint
         4. 创建第一个 Timeline Index shard
       成功后:
         Sidebar 新增 "My Team"
         自动进入该 Room 的 Timeline View
         Dialog 关闭
       失败: Toast 显示错误信息，Dialog 保持打开
```

### TC-5-OPS-012: Room Settings Dialog

```
GIVEN  用户是 Room admin (power_level >= power_levels.admin)，在 Room 中

WHEN   点击 Room Header 的 ⚙️ 图标（或 Info Panel → Settings）

THEN   打开 Room Settings Dialog:
       [General] Tab:
         - Edit Room Name
         - Edit Description
         - Change Access Policy (Private ↔ Public)
         [Save Changes]
       [Members] Tab:
         - 成员列表 + Role 标签 (owner/admin/member)
         - [Generate Invite Code] 按钮 (见 §3)
         - 移除成员（需 power_level 严格高于目标, bus-spec §5.2.4）
       [Apps] Tab:
         - 已安装 Socialware 列表
         - [Browse App Catalog] 按钮 (见 §4)
       [Danger Zone]:
         - [Archive Room] (soft delete, 保留数据)
         - [Leave Room]
```

### TC-5-OPS-013: Edit Room Config

```
GIVEN  Room admin 在 Room Settings → General

WHEN   修改 Room Name → "Engineering Team" → 点击 [Save Changes]

THEN   PATCH /api/rooms/{room_id} { name: "Engineering Team" }
       Engine 写入 Room Config CRDT → 同步到所有 Peer + Relay
       所有 peer 实时看到 Sidebar + Room Header 更新
         (WebSocket room.config_updated 事件, http-spec §5.3)
       Toast: "Room updated"
```

### TC-5-OPS-014: Leave Room

```
GIVEN  用户在 Room Settings → [Leave Room]

WHEN   点击 → 确认弹窗 "Leave this room?"

THEN   POST /api/rooms/{room_id}/leave
       Engine 从 membership.members 中删除自身 (bus-spec §5.2.6)
       Sidebar 移除该 Room
       导航到下一个 Room（若有）或 Empty State
       其他 Peer 收到 room.member_left 事件
```

### TC-5-OPS-015: Archive Room (Admin)

```
GIVEN  Room admin (power_level >= power_levels.admin) 点击 [Archive Room]

WHEN   确认弹窗 "Archive this room? Members can still read history."

THEN   PATCH /api/rooms/{room_id} { archived: true }
       Room Config CRDT 更新 → 同步到所有 Peer
       Room 在 Sidebar 移到 "Archived" 分组（折叠）
       Compose Area 禁用，显示 "This room is archived"
       消息历史仍可浏览
       所有 Peer 通过 room.config_updated 实时更新
```

---

## §3 Invite Codes

> **Spec 引用**：bus-spec §5.2.6 (Room 加入流程), relay-spec §6 (Entity 管理); 新增 Relay 能力见附录 A

### §3.1 架构说明

Invite Code 是一个高层概念，bus-spec 中 `invite` policy 定义了"现有成员在 members 中添加新 Entity"的协议行为，但未定义 code 分发机制。

**数据流**：

```
Admin 生成 code → Local HTTP Server → Relay 注册 code
受邀者输入 code → Local HTTP Server → Relay 解析 code → 获取 room_id + relay endpoint
                                     → Engine 开始同步 Room CRDT
                                     → 写入 members (role: member)
```

Relay 必须参与存储和解析 invite code，因为受邀者在加入前没有 Room 数据，不知道 Room 在哪个 Relay。

### TC-5-OPS-020: Generate Invite Code

```
GIVEN  Room admin 在 Room Settings → Members

WHEN   点击 [Generate Invite Code]

THEN   POST /api/rooms/{room_id}/invite
       Engine 内部:
         1. 生成随机 code (格式: "ABC-XYZ", 6 字符大写字母, 中间横线分隔)
         2. 注册到 Relay: POST /relay/invite-codes {
              code, room_id, created_by, expires_at: now + 7 days
            }
       返回 { code: "ABC-XYZ", expires_at: "...", invite_uri: "ezagent://relay.ezagent.dev/invite/ABC-XYZ" }
       UI 显示:
         大号 code: "ABC-XYZ"
         Shareable link: ezagent://relay.ezagent.dev/invite/ABC-XYZ
         [Copy Code] [Copy Link] 按钮
         Expiry: "Expires in 7 days"
         [Revoke] 链接
```

### TC-5-OPS-021: Join via Invite Code（手动输入）

```
GIVEN  用户在 Empty State 或 Sidebar 点击 [Join with Invite Code]

WHEN   Dialog 打开 → 输入 "ABC-XYZ" → 点击 [Join]

THEN   POST /api/invite/ABC-XYZ
       Engine 内部:
         1. 向 Relay 解析: GET /relay/invite-codes/ABC-XYZ
            → { room_id, relay_endpoints }
         2. 连接 Relay, 开始同步 Room CRDT
         3. 将自身写入 Room Config members (role: member)
       成功:
         Sidebar 新增 Room
         自动进入该 Room
         Toast: "Joined 'My Team'"
       失败:
         Code 过期: Toast "Invite code expired"
         Code 无效: Toast "Invalid invite code"
         网络错误: Toast "Network error, please retry"
```

### TC-5-OPS-022: Join via Deep Link

```
GIVEN  用户收到 ezagent://relay.ezagent.dev/invite/ABC-XYZ 链接

WHEN   点击链接 → App 拦截 URI scheme (参见 TC-5-URI-001, app-prd §4.8)

THEN   App 解析 invite URI (authority = relay.ezagent.dev, code = ABC-XYZ)
       若已登录: 显示 Join 确认 → "Join 'My Team'?" → [Join] [Cancel]
       若未登录: 先完成 Device Flow (TC-5-AUTH-001) → 然后回到 Join 确认
       Join 成功后同 TC-5-OPS-021
```

### TC-5-OPS-023: Revoke Invite Code

```
GIVEN  Room admin 查看已生成的 invite code

WHEN   点击 [Revoke]

THEN   DELETE /api/rooms/{room_id}/invite/{code}
       Engine 内部: DELETE /relay/invite-codes/{code}
       该 code 立即失效
       Toast: "Invite code revoked"
```

### TC-5-OPS-024: Invite Code 列表

```
GIVEN  Room admin 在 Room Settings → Members

WHEN   查看 Invite Codes 区域

THEN   GET /api/rooms/{room_id}/invite
       显示该 Room 所有活跃 invite codes:
       | Code    | Created    | Expires    | Uses |          |
       | ABC-XYZ | 2h ago     | in 7 days  | 3    | [Revoke] |
       | DEF-123 | 1d ago     | in 6 days  | 0    | [Revoke] |
```

---

## §4 Socialware App Catalog

> **Spec 引用**：http-spec §3b (Socialware Management), bus-spec §5.2.3 (enabled_extensions), §5.2.5 (extension_loader Hook), socialware-spec (Socialware 生命周期)

### §4.1 设计说明

内置 Catalog 模式：所有 Socialware App 随 `pip install ezagent` 预装。Catalog UI 是 per-Room 的激活开关——"哪些预装的 App 应在此 Room 中启用"。

安装本质是 Room Config 的 `enabled_extensions` 字段更新（bus-spec §5.2.3），触发 `extension_loader` Hook（bus-spec §5.2.5）自动加载对应 DataType 和 Hook。

### TC-5-OPS-030: Open App Catalog

```
GIVEN  Room admin 在 Room Settings → Apps Tab

WHEN   点击 [Browse App Catalog]

THEN   打开 Catalog Dialog
       数据来源: GET /api/socialware → 列出所有预装 Socialware
       每个 App 卡片:
         - Icon + Name + Version
         - 一句话描述
         - 标签 (e.g., "Project Management", "Events")
         - [Install] 按钮（若已在当前 Room 安装则显示 ✓ Installed）

       内置 Catalog (v1):
         | App         | 描述                                | Socialware PRD |
         | TaskArena   | Task board with Flow-driven lifecycle | socialware/taskarena-prd.md |
         | EventWeaver | DAG-based event tracking              | socialware/eventweaver-prd.md |
         | ResPool     | Resource allocation & scheduling      | socialware/respool-prd.md |
         | AgentForge  | Spawn and manage AI Agents            | socialware/agentforge-prd.md |
         | CodeViber   | Code review workflows                 | socialware/codeviber-prd.md |
```

### TC-5-OPS-031: Install Socialware to Room

```
GIVEN  Catalog 中选择 "TaskArena"

WHEN   点击 [Install]

THEN   POST /api/socialware/install { sw_id: "task-arena", room_id: "{room_id}" }
       Engine 内部 (bus-spec §5.2.5 extension_loader):
         1. 更新 Room Config: enabled_extensions += ["ta_task", "ta_submission", ...]
         2. 注册 DataType (ta_task, ta_submission, ...)
         3. 注册 Flow (ta:task_lifecycle)
         4. 注册 Roles (ta:poster, ta:worker, ta:reviewer, ta:arbiter)
         5. 注册 Commands (/ta:post, /ta:claim, ...) (EXT-15)
         6. 创建 Agent Entity（若需要）
       CRDT 同步 → 所有 Peer 收到 room.config_updated
       UI 更新:
         Catalog 中 TaskArena 显示 ✓ Installed
         Room Settings → Apps 列表新增 TaskArena
         Room Tab 自动出现新 Tab (e.g., "Board") (TC-5-TAB-002)
         Toast: "TaskArena installed"
```

### TC-5-OPS-032: Socialware App Detail View

```
GIVEN  Room Settings → Apps → 已安装的 TaskArena

WHEN   点击 TaskArena 卡片

THEN   展开 App Detail:
       数据来源: GET /api/socialware/task-arena
       显示:
         - Name, Version, Status (Running/Stopped)
         - 描述
         - Registered components:
             DataTypes: ta_task, ta_submission
             Roles: ta:poster, ta:worker, ta:reviewer, ta:arbiter
             Commands: /ta:post, /ta:claim, /ta:submit, /ta:review
             Room Tabs: Board (kanban), Review (table)
         - [Stop] / [Start] 按钮 (POST /api/socialware/{sw_id}/start|stop)
         - [Uninstall] (danger zone)
```

### TC-5-OPS-033: Uninstall Socialware

```
GIVEN  App Detail → [Uninstall]

WHEN   确认弹窗: "Uninstall TaskArena? Existing data will be preserved but
       task cards will render as Level 0 (raw key:value)."

THEN   DELETE /api/socialware/task-arena
       Engine 内部:
         1. 更新 Room Config: enabled_extensions -= ["ta_task", ...]
         2. 停止 Socialware Hook (bus-spec §5.2.5: "已禁用的 Extension 的 Hook 应停止执行")
         3. 已写入的 Extension 数据 MUST NOT 删除 (bus-spec §5.2.5)
       Room Tabs 中 "Board" Tab 消失
       已有 ta_task 消息降级为 Schema Renderer (Level 0, TC-5-OVERRIDE-001)
       Toast: "TaskArena uninstalled"
```

### TC-5-OPS-034: Socialware 状态同步

```
GIVEN  Admin-A 在 Room 中安装了 TaskArena

WHEN   安装完成，CRDT 同步到所有 Peer

THEN   所有 Room 成员:
         - Room Tab 自动出现 "Board" (room.config_updated → rendererStore 刷新)
         - 新 Commands 在 Compose 中可用 (/ta:post ...) (EXT-15, TC-5-OPS-065)
         - GET /api/rooms/{room_id}/renderers 返回更新的 renderer 声明
         无需刷新页面（WebSocket room.config_updated 事件驱动, http-spec §5.3）
```

### TC-5-OPS-035: Role Assignment (Post-Install)

```
GIVEN  TaskArena 已安装，Room 有 4 个成员

WHEN   Admin 在 Room Settings → Apps → TaskArena → "Manage Roles"

THEN   显示 Role 分配矩阵:
       |           | ta:poster | ta:worker | ta:reviewer | ta:arbiter |
       | Alice     |    ✓      |     ✓     |             |     ✓      |
       | Bob       |           |     ✓     |      ✓      |            |
       | Agent-1   |           |           |      ✓      |            |
       | Charlie   |    ✓      |     ✓     |             |            |

       Admin 可勾选/取消勾选
       变更写入 Room Config CRDT (Annotation on Room Config)
       即时同步到所有 Peer
       影响 Action Button 可见性 (TC-5-ACTION-002)
```

---

## §5 Message Operations

> **Spec 引用**：http-spec §2.3 (message CRUD), §3.1 (EXT-01 Mutable), §3.3 (EXT-03 Reactions), §3.6 (EXT-07 Moderation), §3.10 (EXT-11 Threads); extensions-spec §2 (EXT-01~EXT-15); chat-ui-spec §4 (Decorators); architecture §1.5 (URI); EEP-0001 (URI Scheme)

### TC-5-OPS-040: Message Context Menu

```
GIVEN  用户在 Timeline 中右键（或长按）某条消息

WHEN   Context Menu 打开

THEN   显示操作列表（按权限动态过滤）:
       所有人可见:
         Reply            → 引用回复 (EXT-04 reply_to)
         Reply in Thread  → 进入 Thread Panel (EXT-11)
         Add Reaction     → 打开 Emoji Picker (EXT-03)
         Copy Text        → 复制 body 到剪贴板
         Copy ezagent URI → 复制 ezagent://.../{ref_id} (EEP-0001)
         Forward          → 转发到其他 Room

       仅消息作者可见:
         Edit             → 进入编辑模式 (EXT-01)
         Delete           → 确认后删除

       仅 Room admin 可见 (power_level >= power_levels.admin):
         Pin / Unpin      → 置顶操作 (EXT-07)
         Redact           → 隐藏消息 (EXT-07, TC-5-DECOR-006)
```

### TC-5-OPS-041: Reply（引用回复）

```
GIVEN  用户在 Context Menu 选择 "Reply" 回复 M-001

WHEN   Compose Area 激活

THEN   Compose 上方显示引用预览条:
         "Alice: Hello world"  [✕ 关闭]
       用户输入回复文本 → 按 Enter
       POST /api/rooms/{room_id}/messages {
         body: "回复内容",
         ext: { reply_to: { ref_id: "M-001" } }
       }
       发送后:
         新消息渲染时显示 quote_preview (TC-5-DECOR-002)
         引用预览条消失
```

### TC-5-OPS-042: Reply in Thread

```
GIVEN  用户在 Context Menu 选择 "Reply in Thread"（或点击 thread_indicator, TC-5-DECOR-004）

WHEN   Thread Panel 打开 (TC-5-UI-009)

THEN   Info Panel 区域切换为 Thread Panel:
         顶部: 原始消息 M-001
         下方: Thread 回复列表
           GET /api/rooms/{room_id}/messages?thread_root={M-001-ref_id} (http-spec §3.10)
         底部: Thread-specific Compose Area
       发送 Thread 回复:
         POST /api/rooms/{room_id}/messages {
           body: "thread 回复",
           thread_root: "{M-001-ref_id}"
         }
       主 Timeline 中 M-001 的 thread_indicator 更新 (TC-5-DECOR-004):
         "💬 N replies • ..."
```

### TC-5-OPS-043: Edit Message

```
GIVEN  消息作者在 Context Menu 选择 "Edit" (EXT-01 Mutable Content)

WHEN   进入编辑模式

THEN   MessageBubble 切换为可编辑状态:
         - body 变为可编辑 textarea（预填当前内容）
         - 显示 [Save] [Cancel] 按钮
       用户修改后点击 [Save]:
         PUT /api/rooms/{room_id}/messages/{ref_id} {
           body: "修改后的内容"
         }
         (http-spec §3.1, 经 Hook Pipeline)
       成功后:
         退出编辑模式
         消息显示 "(edited)" (TC-5-DECOR-003, ext.mutable.version > 1)
         所有 peer 通过 WebSocket message.edited 事件实时更新 (http-spec §5.3)
       Cancel: 退出编辑模式，无变化
```

### TC-5-OPS-044: Delete Message

```
GIVEN  消息作者（或 Room admin）在 Context Menu 选择 "Delete"

WHEN   确认弹窗: "Delete this message? This cannot be undone."

THEN   DELETE /api/rooms/{room_id}/messages/{ref_id} (http-spec §2.3)
       所有 peer 通过 WebSocket message.deleted 事件实时更新:
         消息从 Timeline 中移除（或显示 "Message deleted" placeholder）
       关联数据处理:
         - Reactions、Thread replies 保留（orphaned but accessible）
         - 引用此消息的 quote_preview 显示 "Original message deleted"
```

### TC-5-OPS-045: Pin / Unpin Message

```
GIVEN  Room admin 在 Context Menu 选择 "Pin" (EXT-07 Moderation)

WHEN   执行 pin 操作

THEN   POST /api/rooms/{room_id}/moderation {
         action: "pin",
         ref_id: "{ref_id}"
       }
       (http-spec §3.6)
       效果:
         Info Panel → Pinned 区域新增该消息预览 (TC-5-UI-007)
         消息气泡显示 📌 pin indicator
         WebSocket moderation.action 事件通知所有 peer (http-spec §5.3)

       Unpin: 同一入口，action: "unpin"
```

### TC-5-OPS-046: Add Reaction（快捷方式）

```
GIVEN  用户 hover 某条消息（或 Context Menu → Add Reaction）(EXT-03)

WHEN   消息气泡右上角出现 😀+ 快捷按钮 → 点击

THEN   打开 Emoji Picker (@emoji-mart/react, chat-app-design §8)
       选择 emoji (e.g., 👍):
         POST /api/rooms/{room_id}/messages/{ref_id}/reactions {
           emoji: "👍"
         }
         (http-spec §3.3)
       emoji_bar 更新 (TC-5-DECOR-001)
       再次点击同一 emoji → toggle off:
         DELETE /api/rooms/{room_id}/messages/{ref_id}/reactions/👍
       WebSocket reaction.added / reaction.removed 事件同步 (http-spec §5.3)
```

### TC-5-OPS-047: Forward Message

```
GIVEN  用户在 Context Menu 选择 "Forward"

WHEN   Forward Dialog 打开

THEN   显示 Room 选择列表（当前已加入的 Rooms, 来自 roomStore）
       用户选择目标 Room → 点击 [Forward]
       POST /api/rooms/{target_room_id}/messages {
         body: "<原始消息 body>",
         ext: {
           forwarded_from: {
             room_id: "{source_room_id}",
             ref_id: "{source_ref_id}",
             author: "@alice:..."
           }
         }
       }
       目标 Room Timeline 显示:
         "↪ Forwarded from Alice in #My Team"
         原始消息内容
```

### TC-5-OPS-048: Copy ezagent URI

```
GIVEN  用户在 Context Menu 选择 "Copy ezagent URI" (EEP-0001)

WHEN   执行 (参见 TC-5-URI-003)

THEN   构造 URI: ezagent://{relay_authority}/r/{room_id}/m/{ref_id}
       URI 格式遵循 architecture §1.5 规范化规则
       复制到剪贴板
       Toast: "Link copied"
```

---

## §6 Profile & Settings

> **Spec 引用**：http-spec §3.12 (EXT-13 Profile), §2.6 (Auth session); extensions-spec §2.13 (EXT-13 Profile/Discovery); app-prd §4.7 (Tray); chat-app-design §3 (Device Flow auth)

### §6.1 数据存储说明

| 数据 | 存储位置 | 同步 | 说明 |
|------|---------|------|------|
| display_name, bio, avatar | EXT-13 Profile (CRDT) | ✓ 跨设备同步 | 协议层，通过 Annotation 发布 |
| theme, font_size, compact_mode | Electron Store (本地) | ✗ 不同步 | 纯客户端偏好 |
| notification preferences | Electron Store (本地) | ✗ 不同步 | 纯客户端偏好 |
| entity_id, keypair | Electron Secure Storage | ✗ 不同步 | 密钥材料，见 TC-5-AUTH-001 |

### TC-5-OPS-050: View Own Profile

```
GIVEN  用户已登录

WHEN   点击 Sidebar 底部的用户头像（或 Sidebar → 用户名区域）

THEN   打开 Profile Popover:
         Avatar (来自 GitHub, 可通过 EXT-13 覆盖)
         Display Name (来自 GitHub, 可编辑)
         Entity ID: @alice:relay.ezagent.dev (只读, 可复制)
         Status: ● Online
         [Edit Profile] 按钮
         [Settings] 按钮
         [Sign Out] 按钮
```

### TC-5-OPS-051: Edit Profile

```
GIVEN  用户点击 [Edit Profile]

WHEN   Profile Edit Dialog 打开

THEN   可编辑字段:
         - Display Name (text, 最长 32 字符)
         - Bio (text, 最长 160 字符, 可选)
         - Avatar: [Change Avatar] → 文件选择
             → POST /api/blobs (http-spec §3.9, EXT-10 Media) 上传图片
             → 获取 blob_hash
       [Save] →
         PUT /api/identity/{entity_id}/profile {
           display_name: "Alice Chen",
           bio: "Building the future of org-OS",
           avatar_blob_hash: "{new_hash}"
         }
         (http-spec §3.12)
       成功后:
         所有 Room 中该用户的头像/名称实时更新 (CRDT 同步)
         Toast: "Profile updated"
```

### TC-5-OPS-052: View Other User's Profile

```
GIVEN  用户在 MemberList 或 MessageBubble 中点击某个用户头像

WHEN   Profile Card Popover 打开

THEN   显示:
         Avatar + Display Name + Bio
         Entity ID (可复制)
         Status: ● Online / ○ Offline (EXT-09 Presence)
         Roles in current Room (e.g., "ta:worker, ta:reviewer")
       数据来源: GET /api/identity/{entity_id}/profile (http-spec §3.12)
```

### TC-5-OPS-053: App Settings Dialog

```
GIVEN  用户从 Profile Popover 点击 [Settings]，或 Tray → Preferences (app-prd §4.7)

WHEN   Settings Dialog 打开

THEN   分 Tab 显示:
       [Account]:
         - Entity ID (只读)
         - GitHub 帐号 (只读, 显示 GitHub username)
         - Relay: relay.ezagent.dev (只读, 显示当前连接的 Relay)
         - [Sign Out] → 确认后执行 TC-5-OPS-056

       [Notifications]:
         - Global: Enable desktop notifications (toggle)
         - Per-Room overrides:
           | Room       | Notify  |
           | My Team    | All     |  ← All / Mentions only / Mute
           | Random     | Mute    |
         (存储在 Electron Store, 不同步)

       [Appearance]:
         - Theme: System / Light / Dark
         - Font size: Small / Medium / Large
         - Compact mode (toggle, 减少消息间距)
         (存储在 Electron Store, 不同步)

       [About]:
         - App version (via electronApp.getVersion())
         - Engine version (from GET /api/status, http-spec §2.5)
         - Links: Documentation, GitHub, Report a bug
```

### TC-5-OPS-054: Notification Preferences per Room

```
GIVEN  Settings → Notifications，或 Room Settings → Notifications

WHEN   用户切换 "My Team" 的通知级别为 "Mentions only"

THEN   存储到 Electron Store (本地持久化)
       效果:
         该 Room 新消息: 不弹 desktop notification
         该 Room @mention: 弹 notification
         Sidebar 未读 badge 仍然正常计数 (EXT-08 Read Receipts)
```

### TC-5-OPS-055: Theme Switching

```
GIVEN  Settings → Appearance → Theme

WHEN   用户选择 "Dark"

THEN   即时切换 Tailwind dark mode (chat-app-design §8: tailwindcss)
       偏好存储到 Electron Store (持久化)
       下次启动自动应用
       "System" 选项跟随 OS 的 prefers-color-scheme
```

### TC-5-OPS-056: Sign Out

```
GIVEN  用户点击 [Sign Out]（Profile Popover 或 Settings → Account）

WHEN   确认弹窗: "Sign out? You'll need to sign in with GitHub again."

THEN   POST /api/auth/logout (http-spec §2.6)
       清除 Electron Secure Storage 中的密钥 (TC-5-AUTH-005)
       清除 Zustand stores (auth, rooms, messages, presence)
       Tray 状态变为离线 (◇) (app-prd §4.7)
       导航到 Welcome Page
```

---

## §7 Search & Discovery

> **Spec 引用**：http-spec §3.12 (EXT-13 Discovery search), §3.5 (EXT-06 Channels), §3.14 (EXT-15 Command); extensions-spec §2.13 (EXT-13 Profile/Discovery); relay-spec §7.6 (Discovery Level 3); app-prd §3.1 (Sidebar Search)

### §7.1 设计说明

Room 发现统一通过 Invite Code（§3），不提供公开 Room 浏览。Search 功能覆盖三个维度：

| 维度 | 数据来源 | 需要 Relay |
|------|---------|-----------|
| Room (已加入) | 本地 roomStore 过滤 | ✗ |
| People | EXT-13 Discovery (Relay Level 3) | ✓ |
| Messages | 本地全文搜索 | ✗ |

### TC-5-OPS-060: Search Bar 激活

```
GIVEN  用户在 Sidebar 顶部点击 Search Bar（或按 ⌘K / Ctrl+K）

WHEN   Search Modal 打开

THEN   显示统一搜索入口:
         输入框 (autofocus, placeholder: "Search rooms, people, messages...")
         输入前显示 Recent 列表:
           最近访问的 3 个 Room (来自 roomStore)
           最近互动的 3 个 Entity (来自本地历史)
         输入时实时过滤（debounce 300ms）
         结果分组显示:
           [Rooms]    — 匹配已加入的 Room name/description
           [People]   — 匹配 Entity display_name (EXT-13)
           [Messages] — 匹配消息 body
```

### TC-5-OPS-061: Search Rooms (已加入)

```
GIVEN  用户在 Search Modal 输入 "team"

WHEN   搜索执行

THEN   [Rooms] 分组显示已加入的匹配 Room:
         "My Team" — 3 members
         "Design Team" — 7 members
       数据来源: 本地 roomStore 过滤（room.name 或 room.description 包含 "team"）
       点击 → 关闭 Modal, 导航到该 Room
```

### TC-5-OPS-062: Search People

```
GIVEN  用户输入 "@bob" 或 "Bob"

WHEN   搜索执行

THEN   [People] 分组显示:
         Bob Chen (@bob:relay.ezagent.dev) [● Online]
       数据来源:
         POST /api/ext/discovery/search { query: "bob", type: "entity" }
         (http-spec §3.12, 内部查询 Relay Discovery Index, relay-spec §7.6)
       点击 → 打开 Profile Card (TC-5-OPS-052)
```

### TC-5-OPS-063: Search Messages

```
GIVEN  用户输入 "login bug"

WHEN   搜索执行

THEN   [Messages] 分组显示（最多 10 条预览）:
         Alice in My Team • 2h ago
           "Found the login bug, it's in auth.ts..."
         Bob in Engineering • 1d ago
           "Fixed the login bug from #123"
       数据来源:
         GET /api/search/messages?q=login+bug (新增 endpoint, 本地全文搜索)
       点击 → 关闭 Modal, 导航到该 Room, 滚动到该消息并高亮
```

### TC-5-OPS-064: Search Scope 过滤

```
GIVEN  用户已在某个 Room 中

WHEN   打开 Search Modal

THEN   显示 Scope 切换:
         [All] [Current Room]
       选择 "Current Room":
         仅搜索当前 Room 内的消息
         GET /api/rooms/{room_id}/messages/search?q=... (新增 endpoint)
       选择 "All":
         全局搜索 (默认行为)
```

### TC-5-OPS-065: Command Palette（⌘K + "/" 扩展）

```
GIVEN  用户在 Search Modal 中输入 "/" (斜杠) (EXT-15 Command)

WHEN   切换到 Command 模式

THEN   显示可用命令列表:
         若在 Room 中:
           GET /api/rooms/{room_id}/commands (http-spec §3.14)
           示例:
             /ta:post    Create a new task (TaskArena)
             /ta:claim   Claim a task
             /ew:branch  Branch an event (EventWeaver)
         全局命令:
           GET /api/commands (http-spec §3.14)
           示例:
             /af:spawn   Spawn an Agent (AgentForge)
             /af:list    List Agents
       输入过滤: 输入 "/ta:" → 仅显示 TaskArena 命令
       选择命令 → 关闭 Modal, 将命令文本插入 Compose Area
       用户补充参数后 Enter 发送 (http-spec §3.14 命令发送格式)
```

---

## 附录 A: Relay Invite Code 扩展

> 本节定义 Invite Code 所需的 Relay 新增能力，需同步更新 relay-spec。

### A.1 新增 Relay 端点

| Endpoint | Method | 说明 | Compliance Level |
|----------|--------|------|-----------------|
| `/relay/invite-codes` | POST | 注册 invite code | Level 1+ |
| `/relay/invite-codes/{code}` | GET | 解析 code → room info | Level 1+ |
| `/relay/invite-codes/{code}` | DELETE | 撤销 code | Level 1+ |

### A.2 数据模型

```
InviteCode {
  code:          string      // "ABC-XYZ", 大写字母, 6 字符, 横线分隔
  room_id:       UUIDv7
  relay_endpoints: [{endpoint, role}]   // 从 Room Config.relays 复制
  created_by:    Entity ID
  created_at:    RFC 3339
  expires_at:    RFC 3339    // 默认 created_at + 7 days
  use_count:     integer     // 已使用次数
}
```

### A.3 注册请求

```
POST /relay/invite-codes
Authorization: Ed25519 签名 (与协议层相同)

{
  "code": "ABC-XYZ",
  "room_id": "019...",
  "created_by": "@alice:relay.ezagent.dev",
  "expires_at": "2026-03-12T10:00:00Z"
}
```

- [MUST] Relay MUST 验证 `created_by` 是 `room_id` 的成员且 power_level >= events_default
- [MUST] Relay MUST 验证 code 格式和唯一性
- [MUST] Relay MUST 拒绝 Room Config 中 `membership.policy = "open"` 的 invite code 请求（open Room 不需要 invite code）

### A.4 解析请求

```
GET /relay/invite-codes/ABC-XYZ

→ 200 {
    "room_id": "019...",
    "room_name": "My Team",
    "relay_endpoints": [
      { "endpoint": "relay.ezagent.dev:7447", "role": "primary" }
    ],
    "created_by": "@alice:relay.ezagent.dev",
    "expires_at": "2026-03-12T10:00:00Z"
  }

→ 404 { "error": "INVITE_CODE_NOT_FOUND" }
→ 410 { "error": "INVITE_CODE_EXPIRED" }
```

- [MUST] 解析请求不需要认证（任何人可查询）
- [MUST] Relay MUST 检查 expires_at，过期返回 410

### A.5 撤销请求

```
DELETE /relay/invite-codes/ABC-XYZ
Authorization: Ed25519 签名

→ 204 No Content
→ 403 { "error": "NOT_AUTHORIZED" }   // 非创建者且非 admin
```

- [MUST] 只有 code 创建者或 Room admin 可撤销

### A.6 存储路径

```
{relay_data_dir}/
├── invite-codes/
│   ├── ABC-XYZ.json     # invite code 元数据
│   └── DEF-123.json
```

### A.7 GC

- [SHOULD] Relay SHOULD 定期清理过期 invite code（推荐每小时扫描一次）
- [MAY] Relay MAY 支持 Admin API 手动触发 invite code 清理

---

## 附录 B: Local HTTP Server 新增端点汇总

> 需同步更新 http-spec。

| Endpoint | Method | 说明 | 对应 TC |
|----------|--------|------|--------|
| `/api/rooms/{id}/invite` | POST | 生成 invite code | TC-5-OPS-020 |
| `/api/rooms/{id}/invite` | GET | 列出活跃 invite codes | TC-5-OPS-024 |
| `/api/rooms/{id}/invite/{code}` | DELETE | 撤销 invite code | TC-5-OPS-023 |
| `/api/invite/{code}` | POST | 通过 invite code 加入 Room | TC-5-OPS-021 |
| `/api/search/messages` | GET | 全局消息全文搜索 | TC-5-OPS-063 |
| `/api/rooms/{id}/messages/search` | GET | Room 内消息搜索 | TC-5-OPS-064 |

### 扩展参数（已有端点）

| Endpoint | 扩展 | 说明 | 对应 TC |
|----------|------|------|--------|
| `POST /api/rooms` | `membership_policy` 参数 | 映射到 bus-spec membership.policy | TC-5-OPS-011 |
| `PATCH /api/rooms/{id}` | `archived` 字段 | Room 归档 | TC-5-OPS-015 |

---

## 附录 C: Test Case 统计

| 区域 | 编号范围 | 数量 |
|------|---------|------|
| Onboarding & Empty States | TC-5-OPS-001~003 | 3 |
| Room Management | TC-5-OPS-010~015 | 6 |
| Invite Codes | TC-5-OPS-020~024 | 5 |
| Socialware App Catalog | TC-5-OPS-030~035 | 6 |
| Message Operations | TC-5-OPS-040~048 | 9 |
| Profile & Settings | TC-5-OPS-050~056 | 7 |
| Search & Discovery | TC-5-OPS-060~065 | 6 |
| **合计** | | **42** |

结合 phase-5-chat-app.md 已有的 77 个渲染/同步 TC，Phase 5 总计 **119 个 Test Case**。

---

## 变更日志

| 版本 | 日期 | 变更 |
|------|------|------|
| 0.1 | 2026-03-05 | 初始版本。7 个章节 + 3 个附录，42 个 TC，覆盖操作层完整交互规范 |

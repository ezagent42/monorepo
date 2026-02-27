# Phase 4: Chat App

> **版本**：0.9
> **目标**：终端用户可用——React Chat UI + Render Pipeline + Desktop 打包
> **预估周期**：3-4 周
> **前置依赖**：Phase 3 (CLI + HTTP API) 完成
> **Spec 依赖**：chat-ui-spec.md, app-prd.md

---

## 验收标准

- 两个 peer 通过 Chat UI 互发消息
- Room Tab 切换可用（message_list, kanban 等）
- Level 0 自动渲染 + Level 1 声明式渲染均可用
- Desktop 打包产出 DMG / MSI / AppImage，体积 ≤ 60MB

---

## §1 Layer 1: Content Renderer

> **Spec 引用**：chat-ui-spec §3

### TC-4-RENDER-001: text 类型默认渲染

```
GIVEN  Message (datatype=message, format=text/plain, body="Hello world")

WHEN   Render Pipeline 处理此消息

THEN   渲染为纯文本气泡
       显示作者名 + 时间戳 + body
       无 field mapping（使用 Built-in 默认 text renderer）
```

### TC-4-RENDER-002: text/markdown 渲染

```
GIVEN  Message (format=text/markdown, body="# Title\n**bold** text")

WHEN   Render Pipeline 处理

THEN   渲染为 Markdown：标题、粗体正确显示
       代码块语法高亮
```

### TC-4-RENDER-003: structured_card 渲染

```
GIVEN  Message (datatype=ta_task) 有 renderer 声明：
       { type: structured_card, field_mapping: {
           header: "title", metadata: [
             { field: "reward", format: "{value} {currency}", icon: "coin" },
             { field: "deadline", format: "relative_time", icon: "clock" }
           ], badge: { field: "status", source: "flow:ta:task_lifecycle" } } }
       数据: { title: "Fix login bug", reward: 50, currency: "USD",
               deadline: "2026-03-01", status: "open" }

WHEN   Render Pipeline 处理

THEN   渲染为卡片：
       - header 显示 "Fix login bug"
       - metadata 行：💰 50 USD | 🕐 4 days left
       - badge 显示 "Open"（蓝色，来自 Flow renderer.badge.open）
```

### TC-4-RENDER-004: media_message 渲染

```
GIVEN  Message (datatype=media_message, renderer.type=media_message)
       blob_hash 指向一张 PNG 图片

WHEN   Render Pipeline 处理

THEN   渲染为图片内嵌预览（缩略图）
       点击可查看大图
       显示文件名和大小
```

### TC-4-RENDER-005: code_block 渲染

```
GIVEN  Message (format=text/x-code, body 包含 Rust 代码)

WHEN   Render Pipeline 处理

THEN   渲染为代码块，Rust 语法高亮
       显示语言标签 "rust"
       可复制按钮
```

### TC-4-RENDER-006: document_link 渲染

```
GIVEN  Message (datatype=mutable/collab content, renderer.type=document_link)

WHEN   Render Pipeline 处理

THEN   渲染为文档卡片：标题 + 摘要 + [Open] 按钮
       不内嵌编辑器（需点击打开）
```

### TC-4-RENDER-007: composite 渲染

```
GIVEN  Message 的 renderer.type = composite
       sub_renderers: [text, media_message]

WHEN   Render Pipeline 处理

THEN   垂直排列：先渲染文本，再渲染媒体预览
```

### TC-4-RENDER-008: 未知 DataType 回退到 Level 0

```
GIVEN  Message (datatype=custom_unknown)
       该 DataType 无 renderer 字段声明

WHEN   Render Pipeline 处理

THEN   Level 0 自动渲染：
       标题显示 "custom_unknown"
       逐字段 key:value 展示 schema 字段
```

---

## §2 Layer 2: Decorator

> **Spec 引用**：chat-ui-spec §4

### TC-4-DECOR-001: emoji_bar 渲染（EXT-03）

```
GIVEN  M-001 的 ext.reactions = { "👍:@alice:...": 1700000000, "❤️:@bob:...": 1700000001 }

WHEN   after_read Hook pipeline 处理

THEN   消息气泡下方（position: below）显示：
       👍 1  ❤️ 1
       点击 emoji 可 toggle 自己的 reaction
       长按显示 "Alice reacted 👍"
```

### TC-4-DECOR-002: quote_preview 渲染（EXT-04）

```
GIVEN  M-002 的 ext.reply_to 指向 M-001

WHEN   after_read Hook 处理

THEN   M-002 气泡上方（position: above）显示引用条：
       "Alice: Hello world"（截断预览）
       点击引用条跳转到 M-001
```

### TC-4-DECOR-003: text_tag "(edited)" 渲染（EXT-01）

```
GIVEN  M-001 被编辑过（ext.mutable.version > 1）

WHEN   after_read Hook 处理

THEN   时间戳旁（position: inline）显示 "(edited)"
```

### TC-4-DECOR-004: thread_indicator 渲染（EXT-11）

```
GIVEN  M-007 有 3 个 thread reply，参与者为 E-alice, E-bob

WHEN   after_read Hook 处理

THEN   气泡下方（position: below）显示：
       💬 3 replies • Alice, Bob • Last reply 2 min ago
       点击展开 thread panel
```

### TC-4-DECOR-005: tag_list 渲染（EXT-06）

```
GIVEN  M-001 的 ext.channels = ["code-review", "urgent"]

WHEN   after_read Hook 处理

THEN   气泡下方显示标签：
       #code-review  #urgent
       点击标签跳转到 Channel 聚合视图
```

### TC-4-DECOR-006: redact_overlay 渲染（EXT-07）

```
GIVEN  M-002 被 admin redact（moderation overlay 存在）

WHEN   after_read Hook 处理（priority 60，最后执行）

THEN   整个消息气泡被 overlay 遮罩（position: overlay）
       显示 "消息已被隐藏"
       admin 可点击查看原文
       非 admin 无法查看
```

### TC-4-DECOR-007: Decorator 渲染顺序

```
GIVEN  M-001 同时有 reply_to (p30), "(edited)" (p35), reactions (p40),
       thread indicator (p45), channel tags (p50)

WHEN   渲染

THEN   从上到下依次为：
       [reply_to quote]          ← above, priority 30
       alice: Hello world
       10:01 AM (edited)         ← inline, priority 35
       👍 2 ❤️ 1                ← below, priority 40
       💬 3 replies              ← below, priority 45
       #code-review              ← below, priority 50
```

### TC-4-DECOR-008: presence_dot 和 typing_indicator（EXT-09）

```
GIVEN  E-bob 在线，E-bob 正在输入

WHEN   渲染 E-bob 的头像和 Compose 区域

THEN   E-bob 头像旁显示绿色 presence dot
       Compose 区域上方显示 "bob is typing..."
       3 秒无新 typing 事件后消失
```

---

## §3 Layer 3: Actions

> **Spec 引用**：chat-ui-spec §5

### TC-4-ACTION-001: Action 按钮基本渲染

```
GIVEN  ta_task 消息，Flow state = "open"
       Flow renderer 声明 action: { transition: "open → claimed",
         label: "Claim Task", style: primary, visible_to: "role:ta:worker" }
       当前 viewer 拥有 ta:worker Role

WHEN   渲染

THEN   消息卡片底部显示 [Claim Task] 按钮（primary 样式）
```

### TC-4-ACTION-002: Role 过滤可见性

```
GIVEN  同 TC-4-ACTION-001
       但当前 viewer 只有 ta:reviewer Role（无 ta:worker）

WHEN   渲染

THEN   [Claim Task] 按钮不显示
       如果 state 是 "under_review"，且存在 "Approve" action visible_to ta:reviewer
       → [Approve] 按钮显示
```

### TC-4-ACTION-003: Action 点击触发 Flow transition

```
GIVEN  ta_task state = "open"，viewer 有 ta:worker Role

WHEN   用户点击 [Claim Task]（confirm=false）

THEN   写入 Annotation 推进 Flow: open → claimed
       CRDT 同步到所有 peer
       所有 peer 的 UI 自动更新：
       - badge 从 "Open"(蓝) 变为 "Claimed"(黄)
       - [Claim Task] 按钮消失
```

### TC-4-ACTION-004: Action 确认弹窗

```
GIVEN  ta_task state = "under_review"
       "Approve" action 声明 confirm=true, confirm_message="确认批准？"

WHEN   用户点击 [Approve]

THEN   弹出确认对话框 "确认批准？"
       用户点击"确认" → Flow transition 执行
       用户点击"取消" → 无变化
```

### TC-4-ACTION-005: 多个 Action 并存

```
GIVEN  ta_task state = "under_review"
       viewer 同时拥有 ta:reviewer 和 ta:arbiter Role

WHEN   渲染

THEN   显示多个按钮：[Approve] (primary) [Reject] (danger)
       按 transition 声明顺序排列
```

### TC-4-ACTION-006: State 变化后按钮实时更新

```
GIVEN  Peer-A 看到 ta_task state = "open"，显示 [Claim Task]

WHEN   Peer-B 点击 [Claim Task]（open → claimed）
       CRDT 同步到 Peer-A

THEN   Peer-A 的 UI 自动更新：
       [Claim Task] 消失
       badge 变为 "Claimed"
       无需手动刷新
```

---

## §4 Layer 4: Room Tab

> **Spec 引用**：chat-ui-spec §6

### TC-4-TAB-001: 默认 Timeline Tab

```
GIVEN  R-alpha 有消息

WHEN   进入 R-alpha

THEN   默认显示 Timeline Tab（layout: message_list）
       消息按时间顺序排列
       Tab header 中 "Messages" 高亮
```

### TC-4-TAB-002: Tab 列表汇聚

```
GIVEN  R-alpha 启用了 EXT-10 Media (gallery tab) 和 EXT-11 Threads (thread panel)

WHEN   进入 R-alpha

THEN   Tab header 显示：[Messages] [Gallery] [Threads]
       来源：Built-in Timeline + Extension Index 中 as_room_tab=true 的声明
```

### TC-4-TAB-003: Tab 切换保持数据

```
GIVEN  用户在 Timeline Tab 中滚动到某位置

WHEN   切换到 Gallery Tab → 再切回 Timeline Tab

THEN   Timeline 回到之前的滚动位置（不重载）
```

### TC-4-TAB-004: kanban Layout

```
GIVEN  R-taskarena 中有 ta_task 消息，启用了 TaskArena
       Index "ta:task_board" 声明 layout=kanban, columns_from=flow:ta:task_lifecycle

WHEN   切换到 Board Tab

THEN   看板显示：列 = Flow states (Open | Claimed | In Progress | ...)
       每列包含对应状态的 task 卡片
       卡片使用 ta_task 的 Content Renderer
```

### TC-4-TAB-005: kanban 拖拽触发 Flow transition

```
GIVEN  Board Tab 中，一个 task 在 "Open" 列
       drag_transitions: "open → claimed" require_role: "ta:worker"
       viewer 有 ta:worker Role

WHEN   用户将 task 从 "Open" 列拖到 "Claimed" 列

THEN   触发 Flow transition: open → claimed
       CRDT 同步
       所有 peer 看到 task 移动到 "Claimed" 列
```

### TC-4-TAB-006: kanban 拖拽 Role 不足被拒

```
GIVEN  同 TC-4-TAB-005，但 viewer 无 ta:worker Role

WHEN   用户尝试拖拽

THEN   拖拽操作被阻止或拖拽后回弹
       无 Flow transition 发生
```

### TC-4-TAB-007: grid Layout（Gallery）

```
GIVEN  R-alpha 有 BL-001 (diagram.png) 和 BL-002 (report.pdf)
       EXT-10 Media Index 声明 layout=grid

WHEN   切换到 Gallery Tab

THEN   网格布局显示媒体缩略图
       图片显示预览，PDF 显示图标
       点击可查看/下载
```

### TC-4-TAB-008: table Layout

```
GIVEN  rp_resource 消息在 Room 中
       Index 声明 layout=table

WHEN   切换到对应 Tab

THEN   表格显示：列 = schema 字段
       可排序、可筛选
```

### TC-4-TAB-009: Socialware UI Manifest views 汇入

```
GIVEN  TaskArena 的 Part C UI Manifest 声明了 "Board" view 和 "Review" view

WHEN   进入 TaskArena 的 Room

THEN   Tab header 包含：[Messages] [Board] [Review]
       来源混合：Built-in + Extension + Socialware UI Manifest
```

---

## §5 Progressive Override

> **Spec 引用**：chat-ui-spec §7

### TC-4-OVERRIDE-001: Level 0 Schema-derived 自动渲染

```
GIVEN  DataType "custom_report" 无 renderer 字段
       schema: { title: string, score: number, passed: boolean, tags: array }

WHEN   Render Pipeline 处理

THEN   自动生成 Content Renderer：
       ┌──────────────────────┐
       │ custom_report        │
       │ title: Q2 Report     │
       │ score: 85            │
       │ passed: ✅            │
       │ tags: ["quarterly"]  │
       └──────────────────────┘
```

### TC-4-OVERRIDE-002: Level 0 自动生成 Room Tab

```
GIVEN  DataType "custom_report" 有 Index 但无 renderer

WHEN   查看 Room views

THEN   自动生成 table 类型的 Room Tab
       列 = schema 字段 (title, score, passed, tags)
       可排序
```

### TC-4-OVERRIDE-003: Level 1 覆盖 Level 0

```
GIVEN  DataType "ta_task" 有 renderer 声明:
       { type: structured_card, field_mapping: { header: "title", ... } }

WHEN   Render Pipeline 处理

THEN   使用 Level 1 声明式渲染（structured_card）
       不使用 Level 0 的 key:value 自动渲染
```

### TC-4-OVERRIDE-004: Level 2 覆盖 Level 1

```
GIVEN  DataType "ew_event" 有 renderer 声明（Level 1）
       同时通过 Widget SDK 注册了 'sw:ew:dag_view' (Level 2)

WHEN   Render Pipeline 处理

THEN   使用 Level 2 自定义 React 组件
       Level 1 声明被忽略
```

### TC-4-OVERRIDE-005: Fallback chain 逐级回退

```
GIVEN  Room 中有三种 DataType：
       - type_a: 有 Level 2 自定义组件
       - type_b: 有 Level 1 renderer 声明
       - type_c: 无 renderer 配置

WHEN   Render Pipeline 分别处理

THEN   type_a → Level 2 自定义组件
       type_b → Level 1 声明式渲染
       type_c → Level 0 schema-derived
```

### TC-4-OVERRIDE-006: 同一 Extension 不同 Level

```
GIVEN  EXT-11 Threads:
       - Layer 2 Decorator (thread indicator) → 无自定义，使用 Level 0
       - Layer 4 Room Tab (thread panel) → 有 renderer 声明，使用 Level 1

WHEN   渲染

THEN   thread indicator 使用 Level 0 自动生成
       thread panel Tab 使用 Level 1 声明式 layout
       两者独立，不互相影响
```

---

## §6 Widget SDK (Level 2)

> **Spec 引用**：chat-ui-spec §8

### TC-4-WIDGET-001: registerRenderer 注册

```
GIVEN  开发者编写自定义 DAG 可视化组件

WHEN   调用 registerRenderer({
         id: 'sw:ew:dag_view',
         type: 'room_view',
         subscriptions: { datatypes: ['ew_event'], indexes: ['ew:dag_index'] },
         component: DagViewComponent
       })

THEN   组件注册成功
       Room views 中出现 DAG view Tab
```

### TC-4-WIDGET-002: WidgetProps.data 自动填充

```
GIVEN  DagViewComponent 注册了 subscriptions.datatypes = ['ew_event']

WHEN   Room 中有 3 个 ew_event 消息

THEN   组件 props.data.query_results 包含 3 个事件
       当新 ew_event 写入时，props 自动更新（CRDT-reactive）
```

### TC-4-WIDGET-003: WidgetProps.context 上下文

```
GIVEN  viewer = E-alice，拥有 ew:chronicler Role
       Room config 可用

WHEN   组件渲染

THEN   props.context.viewer = { entityId: "@alice:...", displayName: "Alice" }
       props.context.viewer_roles = ["ew:chronicler"]
       props.context.room_config 包含 Room 配置
```

### TC-4-WIDGET-004: actions API — sendMessage

```
GIVEN  自定义组件通过 props.actions.sendMessage

WHEN   组件调用 actions.sendMessage({ body: "Auto-generated summary", ... })

THEN   消息发送成功，经过完整 Hook Pipeline
       CRDT 同步
```

### TC-4-WIDGET-005: actions API — advanceFlow

```
GIVEN  自定义组件显示 "Approve" 按钮

WHEN   组件调用 actions.advanceFlow({
         flow_id: "ta:task_lifecycle",
         transition: "under_review → approved",
         ref_id: "<task_ref>"
       })

THEN   Flow transition 执行（如果 viewer 有对应 Role）
       如果 viewer 无 Role → Promise reject，UI 显示错误
```

### TC-4-WIDGET-006: 安全沙箱 — 禁止访问其他 Room

```
GIVEN  自定义组件尝试读取未声明的 Room 数据

WHEN   组件调用 props.data（但数据不在 subscriptions 范围内）

THEN   数据为 undefined
       无法读取其他 Room 的数据
```

### TC-4-WIDGET-007: 安全沙箱 — 禁止外部网络请求

```
GIVEN  自定义组件尝试 fetch("https://external-api.com/data")

WHEN   组件执行

THEN   网络请求被阻止
       组件应通过 actions API 间接完成需要的操作
```

### TC-4-WIDGET-008: inline_widget 类型

```
GIVEN  registerRenderer({ type: 'inline_widget', ... })

WHEN   消息渲染时

THEN   自定义组件嵌入消息气泡内（替代 Content Renderer 区域）
       props.data.ref 包含当前消息数据
```

---

## §7 信息架构

> **Spec 引用**：app-prd §3

### TC-4-UI-001: Sidebar Room 列表

```
GIVEN  E-alice 加入了 R-alpha (有 3 条未读) 和 R-beta (全部已读)

WHEN   打开 Chat App

THEN   Sidebar 显示：
       R-alpha  🔴 3
       R-beta
       未读 Room 排在上面
```

### TC-4-UI-002: Sidebar Channel 列表（EXT-06）

```
GIVEN  #code-review channel 跨 R-alpha 和 R-gamma

WHEN   Sidebar 渲染 Channel 区域

THEN   显示 Channel 列表：
       #code-review (5)
       点击跳转到 Channel 聚合视图
```

### TC-4-UI-003: Main Area Timeline 基本操作

```
GIVEN  R-alpha 有消息

WHEN   点击 R-alpha 进入

THEN   Main Area 显示 Timeline View
       消息按时间顺序从上到下排列
       底部有 Compose 输入框
```

### TC-4-UI-004: Compose Area 发送消息

```
GIVEN  用户在 R-alpha 的 Compose 输入框

WHEN   输入 "Hello team!" → 按 Enter (或点击发送按钮)

THEN   消息发送成功
       Compose 清空
       消息出现在 Timeline 底部
       其他 peer 实时收到
```

### TC-4-UI-005: Compose Area 附件和 emoji

```
GIVEN  Compose Area

WHEN   点击 📎 → 选择文件
       点击 😀 → 选择 emoji

THEN   文件上传为 blob（EXT-10），附加到消息
       emoji 插入到输入文本
```

### TC-4-UI-006: Info Panel 成员列表

```
GIVEN  R-alpha 有 4 个成员，E-alice 和 E-bob 在线

WHEN   展开 Info Panel

THEN   Members 区域显示：
       ● Alice (online)
       ● Bob (online)
       ○ Code Reviewer (offline)
       ○ Translator (offline)
```

### TC-4-UI-007: Info Panel Pinned 消息

```
GIVEN  M-001 被 pin（EXT-07 moderation action=pin）

WHEN   展开 Info Panel → Pinned 区域

THEN   显示 M-001 的预览
       点击跳转到 Timeline 中的 M-001
```

### TC-4-UI-008: Info Panel Media Gallery

```
GIVEN  R-alpha 有 BL-001, BL-002

WHEN   展开 Info Panel → Media 区域

THEN   显示媒体文件缩略图列表
       点击可查看/下载
```

### TC-4-UI-009: Thread Panel 展开

```
GIVEN  M-007 有 thread reply

WHEN   点击 thread indicator

THEN   Info Panel 区域切换为 Thread Panel
       显示 M-007 + 所有 reply
       可在 thread 内回复
```

---

## §8 用户旅程

> **Spec 引用**：app-prd §2

### TC-4-JOURNEY-001: 首次使用完整流程

```
GIVEN  全新安装

WHEN   双击打开 → 欢迎页面
       输入 name="alice", relay="relay.ezagent.dev"
       → 点击 "Create Identity"

THEN   自动执行 ezagent init
       进入主界面（空状态）
       提示 "Create a room" 或 "Enter invite code"
```

### TC-4-JOURNEY-002: 首次创建 Room

```
GIVEN  首次使用，主界面空状态

WHEN   点击 "Create a room" → 输入名称 "My Team"

THEN   Room 创建成功
       自动进入该 Room 的 Timeline View
       Sidebar 显示 "My Team"
```

### TC-4-JOURNEY-003: Agent 交互旅程

```
GIVEN  Room 中有 TaskArena Agent
       Agent 发送了一个 ta_task structured_card

WHEN   用户查看卡片 → 点击 [Claim Task]

THEN   Flow transition: open → claimed
       Badge 从 "Open" 变为 "Claimed"
       Agent 响应：发送新消息 "Task claimed. Please submit by..."
```

### TC-4-JOURNEY-004: 两个 Peer 实时聊天

```
GIVEN  Peer-A (E-alice) 和 Peer-B (E-bob) 都在 R-alpha

WHEN   Peer-A 发送 "Hello"
       Peer-B 发送 "Hi there"

THEN   两端实时看到对方消息（延迟 < 2s LAN / < 5s 跨网络）
       消息顺序一致（CRDT 保证最终一致性）
```

---

## §9 Desktop 打包

> **Spec 引用**：app-prd §4

### TC-4-PKG-001: PyPI wheel 安装

```
WHEN   pip install ezagent

THEN   安装成功
       ezagent CLI 可用
       python -c "import ezagent" 不报错
```

### TC-4-PKG-002: ezagent start 启动 Web 访问

```
GIVEN  pip install ezagent 完成

WHEN   执行 ezagent start

THEN   HTTP Server 启动
       浏览器访问 localhost:8000 显示 Chat UI
```

### TC-4-PKG-003: macOS DMG 安装

```
WHEN   双击 ezagent.dmg → 拖入 Applications

THEN   ezagent.app 出现在 Applications
       双击打开 → Chat UI 显示
       无需系统 Python
       .app 大小 ≤ 60MB
```

### TC-4-PKG-004: Windows MSI 安装

```
WHEN   运行 ezagent.msi

THEN   安装完成
       开始菜单出现 ezagent
       双击打开 → Chat UI 显示
       无需系统 Python
```

### TC-4-PKG-005: Linux AppImage

```
WHEN   chmod +x ezagent.AppImage && ./ezagent.AppImage

THEN   Chat UI 显示
       无需系统依赖
```

### TC-4-PKG-006: Desktop 启动流程

```
WHEN   双击 ezagent.app

THEN   启动序列：
       launcher binary → 加载内嵌 Python → python -m ezagent.server →
       FastAPI + React UI → WebView/浏览器
       用户看到 Chat UI（首次使用显示欢迎页）
       启动时间 < 5 秒
```

---

## §10 CRDT 实时同步 UI

> **Spec 引用**：chat-ui-spec §1.2 (CRDT-reactive)

### TC-4-SYNC-001: 消息实时同步

```
GIVEN  Peer-A 和 Peer-B 在同一 Room

WHEN   Peer-A 发送消息

THEN   Peer-B 的 Timeline 自动新增消息
       无需刷新页面
```

### TC-4-SYNC-002: Reaction 实时同步

```
GIVEN  Peer-A 和 Peer-B 看同一条消息

WHEN   Peer-A 添加 👍 reaction

THEN   Peer-B 的 emoji_bar 实时更新：显示 👍 1
```

### TC-4-SYNC-003: Flow state 实时同步

```
GIVEN  Peer-A 和 Peer-B 看同一个 ta_task

WHEN   Peer-A 点击 [Claim Task]

THEN   Peer-B 的 badge 实时从 "Open" 变为 "Claimed"
       Peer-B 的 [Claim Task] 按钮实时消失
```

### TC-4-SYNC-004: Kanban 拖拽实时同步

```
GIVEN  Peer-A 和 Peer-B 都在 Board Tab

WHEN   Peer-A 拖拽 task 从 Open 到 Claimed

THEN   Peer-B 看到 task 卡片从 Open 列移到 Claimed 列
```

### TC-4-SYNC-005: Room config 变更实时反映

```
GIVEN  Peer-A 和 Peer-B 在同一 Room

WHEN   Admin 修改 Room name

THEN   两端 Sidebar 和 Room Header 实时更新 Room 名称
```

---

## 附录：Test Case 统计

| 区域 | 编号范围 | 数量 |
|------|---------|------|
| Layer 1 Content Renderer | TC-4-RENDER-001~008 | 8 |
| Layer 2 Decorator | TC-4-DECOR-001~008 | 8 |
| Layer 3 Actions | TC-4-ACTION-001~006 | 6 |
| Layer 4 Room Tab | TC-4-TAB-001~009 | 9 |
| Progressive Override | TC-4-OVERRIDE-001~006 | 6 |
| Widget SDK | TC-4-WIDGET-001~008 | 8 |
| 信息架构 | TC-4-UI-001~009 | 9 |
| 用户旅程 | TC-4-JOURNEY-001~004 | 4 |
| Desktop 打包 | TC-4-PKG-001~006 | 6 |
| CRDT 实时同步 UI | TC-4-SYNC-001~005 | 5 |
| **合计** | | **69** |

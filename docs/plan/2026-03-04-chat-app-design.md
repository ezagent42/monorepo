# Phase 5 Chat App — Architecture Design

> **状态**：Approved
> **日期**：2026-03-04
> **前置文档**：app-prd.md, chat-ui-spec.md, http-spec.md, phase-5-chat-app.md
> **技术栈**：Next.js + Electron + shadcn/ui + Tailwind CSS + Zustand

---

## §1 技术决策总览

| 决策 | 选择 | 理由 |
|------|------|------|
| 架构 | Electron + 内嵌 Python runtime + Next.js static export | Electron 管窗口/Tray/IPC，内嵌 Python runtime 运行 Engine，Next.js 输出纯静态 HTML/JS，数据来自 REST + WebSocket |
| UI 框架 | shadcn/ui + Tailwind CSS | 完全可控，无运行时 CSS-in-JS 开销，适合高度自定义的聊天 UI |
| 状态管理 | Zustand | 轻量、最小模板代码，适合 WebSocket 驱动的状态更新 |
| 认证 | GitHub OAuth App → Relay 认证 | 支持跨设备登录，GitHub 提供身份验证 + 头像等 profile 数据 |
| 打包 | electron-builder | 支持 DMG/MSI/AppImage，社区最大，文档最全 |
| Render Pipeline | 单体式 (Monolithic) | 统一组件树，单次渲染管线，简单可调试，接口清晰便于未来演进 |

---

## §2 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main Process                  │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────────┐   │
│  │   Tray    │  │  Window  │  │  GitHub OAuth IPC   │   │
│  │  Manager  │  │ Lifecycle│  │  (BrowserWindow)    │   │
│  └──────────┘  └──────────┘  └─────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Daemon Manager                                   │   │
│  │  启动内嵌 Python runtime → python -m ezagent.server │   │
│  │  管理 FastAPI 进程生命周期 (localhost:8847)          │   │
│  └──────────────────────────────────────────────────┘   │
│         │            │                    │              │
│         └────────────┼────────────────────┘              │
│                      │ IPC (contextBridge)               │
├──────────────────────┼──────────────────────────────────┤
│              Renderer Process (BrowserWindow)            │
│  ┌──────────────────────────────────────────────────┐   │
│  │           Next.js Static Export (App Router)      │   │
│  │                                                   │   │
│  │  ┌─────────┐  ┌───────────────┐  ┌───────────┐  │   │
│  │  │ Sidebar │  │   Main Area    │  │Info Panel │  │   │
│  │  │         │  │                │  │           │  │   │
│  │  │ Rooms   │  │ Room Header    │  │ Members   │  │   │
│  │  │ Channels│  │ [Tab1][Tab2]   │  │ Pinned    │  │   │
│  │  │ Search  │  │ View Area      │  │ Media     │  │   │
│  │  │         │  │ Compose        │  │ Thread    │  │   │
│  │  └─────────┘  └───────────────┘  └───────────┘  │   │
│  │                                                   │   │
│  │  Zustand Stores ──→ API Layer ──→ localhost:8847  │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────┐
│   ezagent serve          │  (Electron 管理的子进程)
│   内嵌 Python runtime     │
│   FastAPI on :8847       │
│   Rust Engine (PyO3)     │
└─────────────────────────┘
```

---

## §3 GitHub Device Flow 认证

### §3.1 设计目标

将 GitHub App Device Flow 作为 ezagent 的用户认证方案。Device Flow（RFC 8628）专为桌面/CLI 应用设计，**只需 `client_id`，不需要 `client_secret`**，避免在可逆向的安装包中嵌入敏感凭证。

1. **身份验证**：通过 GitHub 验证用户身份
2. **Profile 预填**：自动获取 display_name、avatar_url、email
3. **跨设备登录**：同一 GitHub 帐号在新设备上可恢复 Entity 密钥对
4. **无 Secret**：只需 client_id（公开值），无安全风险

### §3.2 Device Flow 流程

首次使用:
  1. App 打开 → Welcome 页面
  2. 点击 "Sign in with GitHub"
     → POST https://github.com/login/device/code
       { client_id: "Iv23likJpbvAY27c18tA", scope: "read:user" }
     → 返回 { device_code, user_code, verification_uri, interval, expires_in }
  3. App 显示验证码界面:
     - 大号显示 user_code（如 "ABCD-1234"）
     - "Open GitHub" 按钮 → shell.openExternal(verification_uri)
     - 提示 "Enter this code on GitHub to sign in"
  4. App 以 interval 秒间隔轮询:
     POST https://github.com/login/oauth/access_token
       { client_id, device_code, grant_type: "urn:ietf:params:oauth:grant-type:device_code" }
     轮询响应:
       - error=authorization_pending → 继续轮询
       - error=slow_down → 增加 interval 5 秒
       - error=expired_token → 显示"验证码已过期，请重试"
       - error=access_denied → 显示"用户拒绝授权"
       - 成功 → 获取 access_token
  5. 调用后端: POST /api/auth/github { github_token: access_token }
     后端处理:
       a. GET https://api.github.com/user (验证 token, 获取 profile)
       b. 查询 github_id → entity_id 映射
       c. 若新用户: 执行 ezagent init, 创建 Entity 密钥对, 存储映射
       d. 若已有: 返回 entity_id + encrypted_keypair
  6. 存储密钥到 Electron Secure Storage
  7. 进入主界面

日常登录:
  1. App 启动 → 检查 Electron Secure Storage
  2. 若有密钥 → 自动登录 → 进入主界面
  3. 若无密钥（新设备）→ Device Flow → 从 Relay 恢复密钥

### §3.3 后端 API（不变）

| Endpoint | Method | 说明 |
|----------|--------|------|
| `/api/auth/github` | POST | GitHub token 换取 Entity + 密钥对 |
| `/api/auth/session` | GET | 当前会话信息 |
| `/api/auth/logout` | POST | 清除会话 |

后端 API 不变——Device Flow 的变化完全在 Electron 客户端侧。后端仍然接收 `github_token` 并调用 GitHub API 验证。

### §3.4 安全考虑

- **无 `client_secret`**：Device Flow 只需 `client_id`，可安全硬编码在 app 中
- `client_id: Iv23likJpbvAY27c18tA`（GitHub App "EZAgent Login"）
- access_token 仅用于初始认证，日常操作使用 Ed25519 签名
- 密钥 Blob 使用 AES-256-GCM 加密后存储在 Relay

---

## §4 Render Pipeline

### §4.1 四层模型

```
Message Data (REST/WebSocket)
  │
  ▼
resolveRenderer(datatype, rendererConfig)
  │
  ├── Level 2 registered? → Custom React 组件
  ├── Level 1 renderer 字段? → 声明式渲染器组件
  └── Level 0 → Schema 自动渲染
  │
  ▼
┌──────────────────────────────────────────┐
│ <MessageBubble>                          │
│   <DecoratorAbove />     ← Layer 2 above │
│   <ContentRenderer />    ← Layer 1       │
│   <DecoratorInline />    ← Layer 2 inline│
│   <ActionButtons />      ← Layer 3       │
│   <DecoratorBelow />     ← Layer 2 below │
│ </MessageBubble>                         │
└──────────────────────────────────────────┘
  │
  ▼ (多条消息 via Index)
┌──────────────────────────────────────────┐
│ <RoomTab layout="message_list|kanban|...">│  ← Layer 4
└──────────────────────────────────────────┘
```

### §4.2 Content Renderers (Layer 1)

| 组件 | renderer.type | 渲染效果 |
|------|--------------|---------|
| `TextRenderer` | `text` | 纯文本/Markdown 气泡 (react-markdown + remark-gfm) |
| `StructuredCardRenderer` | `structured_card` | 标题 + 字段行 + badge |
| `MediaMessageRenderer` | `media_message` | 图片/视频内嵌预览 |
| `CodeBlockRenderer` | `code_block` | 语法高亮 (shiki) |
| `DocumentLinkRenderer` | `document_link` | 文档标题 + 摘要 + [Open] |
| `CompositeRenderer` | `composite` | 多个子 renderer 垂直排列 |
| `SchemaRenderer` | (Level 0 fallback) | key:value 自动渲染 |

### §4.3 Decorators (Layer 2)

| 组件 | type | position | priority |
|------|------|----------|----------|
| `QuotePreview` | `quote_preview` | above | 30 |
| `TextTag` ("edited") | `text_tag` | inline | 35 |
| `EmojiBar` | `emoji_bar` | below | 40 |
| `ThreadIndicator` | `thread_indicator` | below | 45 |
| `TagList` | `tag_list` | below | 50 |
| `RedactOverlay` | `redact_overlay` | overlay | 60 |
| `PresenceDot` | `presence_dot` | avatar旁 | — |
| `TypingIndicator` | `typing_indicator` | compose上方 | — |

### §4.4 Actions (Layer 3)

- `ActionButton` — 根据 Flow renderer 声明渲染, viewer Role 过滤可见性
- `ConfirmDialog` — confirm=true 时弹出确认对话框
- 点击执行: 写入 Annotation → CRDT 同步 → 所有 peer UI 更新

### §4.5 Room Tabs (Layer 4)

| 组件 | layout | 说明 |
|------|--------|------|
| `TimelineTab` | `message_list` | 默认 Tab，时间线消息列表 |
| `KanbanTab` | `kanban` | 看板，列 = Flow states, 支持拖拽 |
| `GalleryTab` | `grid` | 媒体图库 |
| `TableTab` | `table` | 可排序/可筛选数据表格 |

---

## §5 目录结构

```
app/
├── electron/
│   ├── main.ts              # 入口, 窗口创建
│   ├── tray.ts              # Tray 图标 + 菜单
│   ├── auth.ts              # GitHub OAuth 窗口 + IPC
│   ├── preload.ts           # contextBridge IPC API
│   └── daemon.ts            # 管理 ezagent serve 进程
│
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── layout.tsx       # 根布局
│   │   ├── page.tsx         # 重定向到 /chat 或 /welcome
│   │   ├── welcome/         # 引导页面 (GitHub 登录)
│   │   └── chat/            # 主聊天界面
│   │       ├── layout.tsx   # 三栏布局
│   │       └── [roomId]/    # Room 视图
│   │
│   ├── components/
│   │   ├── ui/              # shadcn/ui 基础组件
│   │   ├── sidebar/         # Sidebar, RoomList, ChannelList, SearchBar
│   │   ├── chat/            # Timeline, MessageBubble, ComposeArea, RoomHeader
│   │   ├── renderers/       # Layer 1 Content Renderers
│   │   ├── decorators/      # Layer 2 Decorators
│   │   ├── actions/         # Layer 3 Action Buttons
│   │   ├── tabs/            # Layer 4 Room Tabs
│   │   ├── info-panel/      # InfoPanel, MemberList, PinnedMessages, MediaGallery, ThreadPanel
│   │   └── widget-sdk/      # Level 2 WidgetHost + registerRenderer registry
│   │
│   ├── stores/              # Zustand stores
│   │   ├── auth-store.ts    # Session, GitHub token, entity
│   │   ├── room-store.ts    # Room 列表, 当前 room
│   │   ├── message-store.ts # 按 room 的消息, 分页
│   │   ├── presence-store.ts# 在线用户, typing
│   │   ├── renderer-store.ts# 渲染器配置 (来自 API)
│   │   └── ui-store.ts      # Panel 可见性, 当前 tab
│   │
│   ├── lib/
│   │   ├── api/             # REST 客户端 (rooms, messages, auth, renderers)
│   │   ├── ws/              # WebSocket 连接管理 + 事件分发
│   │   ├── pipeline/        # Render Pipeline 解析逻辑 (Level 0/1/2)
│   │   └── electron/        # IPC 桥接 (auth, tray, etc.)
│   │
│   └── types/
│       ├── generated/       # 来自 Rust (ts-rs) — 勿手动编辑
│       └── index.ts         # App 级类型导出
│
├── public/                  # 静态资源
├── next.config.js           # output: 'export'
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── electron-builder.yml     # DMG/MSI/AppImage 配置
```

---

## §6 数据流

```
┌────────────────── 实时更新 ───────────────────────────┐
│                                                        │
│  WebSocket (/ws)                                       │
│    │ message.new    → messageStore.addMessage()         │
│    │ reaction.*     → messageStore.updateAnnotation()   │
│    │ presence.*     → presenceStore.update()            │
│    │ typing.*       → presenceStore.setTyping()         │
│    │ room.*         → roomStore.update()                │
│    │ command.*      → messageStore.updateCommand()      │
│                                                        │
├────────────────── REST API 调用 ──────────────────────┤
│                                                        │
│  进入 Room 时:                                          │
│    GET /api/rooms/{id}/messages  → messageStore         │
│    GET /api/rooms/{id}/renderers → rendererStore        │
│    GET /api/rooms/{id}/views     → tab 列表             │
│    GET /api/rooms/{id}/members   → presenceStore        │
│                                                        │
│  发送消息:                                              │
│    POST /api/rooms/{id}/messages → 乐观更新             │
│                                                        │
│  Action 点击:                                           │
│    POST /api/rooms/{id}/messages/{ref}/annotations      │
│    → Flow transition → WebSocket 广播更新               │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## §7 Desktop 打包

### §7.1 构建流程

```
pnpm build
  → Next.js static export → out/
  → TypeScript compile electron/ → dist-electron/
  → 下载 python-build-standalone → runtime/python/
  → 安装 ezagent wheel → runtime/python/lib/
  → electron-builder → DMG / MSI / AppImage (≤ 60MB)
```

### §7.1.1 内嵌 Python Runtime

使用 [python-build-standalone](https://github.com/indygreg/python-build-standalone) 提供独立 Python runtime，无需系统安装。

```
Electron App Bundle
  └── runtime/
      ├── python/                    # python-build-standalone
      │   ├── bin/python3            # Python 解释器
      │   └── lib/python3.11/
      │       └── site-packages/
      │           ├── ezagent/       # ezagent Python 包
      │           ├── fastapi/
      │           └── uvicorn/
      └── ezagent.so                 # Rust PyO3 native 模块
```

Electron Main Process 启动序列：

```
app.whenReady()
  → 检测 runtime/python/ 是否存在
  → spawn('runtime/python/bin/python3', ['-m', 'ezagent.server', '--port', '8847'])
  → 等待 GET /api/status 返回 200
  → 创建 BrowserWindow，加载 Next.js 静态页面
```

### §7.2 electron-builder 配置

```yaml
appId: dev.ezagent.app
productName: ezagent

mac:
  target: dmg
  category: public.app-category.productivity
  protocols:
    - name: ezagent
      schemes: [ezagent]     # ezagent:// URI scheme

win:
  target: msi

linux:
  target: AppImage
  mimeTypes: [x-scheme-handler/ezagent]

files:
  - out/**/*                 # Next.js 静态输出
  - dist-electron/**/*       # Electron 编译输出
```

### §7.3 Tray 功能

```
Menu Bar: ◆ ezagent (在线) / ◇ (离线)

菜单:
  ● Online / Connecting / Offline
  N Agents active
  N Rooms synced
  ──────────────
  Open ezagent     → 打开/聚焦主窗口
  ──────────────
  Preferences...   → 设置
  About            → 版本信息
  ──────────────
  Quit ezagent     → 停止 daemon + 退出
```

---

## §8 关键依赖

| 库 | 用途 | 理由 |
|----|------|------|
| `next` | 前端框架 | App Router, static export |
| `electron` | 桌面壳 | 窗口、Tray、IPC |
| `electron-builder` | 打包 | DMG/MSI/AppImage |
| `tailwindcss` | 样式 | 工具类 CSS |
| `@radix-ui/*` + `shadcn/ui` | UI 组件 | 可控、可定制 |
| `zustand` | 状态管理 | 轻量、适合 WS 驱动更新 |
| `react-markdown` + `remark-gfm` | Markdown 渲染 | 轻量、可扩展 |
| `shiki` | 代码高亮 | 准确、多语言 |
| `@dnd-kit/core` | 拖拽 | Kanban 拖拽 |
| `@emoji-mart/react` | Emoji 选择器 | 流行、轻量 |
| `@tanstack/react-virtual` | 虚拟滚动 | 长消息列表性能 |

---

## 变更日志

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2026-03-04 | 初始版本。架构设计、GitHub OAuth、Render Pipeline、目录结构、数据流、打包方案 |

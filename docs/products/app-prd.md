# ezagent Chat App — Product Requirements Document v0.2

> **状态**：Draft
> **日期**：2026-03-04
> **前置文档**：ezagent-http-spec-v0.1, ezagent-chat-ui-spec-v0.1
> **作者**：Allen & Claude collaborative design
> **历史**：从 ezagent-py-spec v0.8 §10-§11 提取 + 新增产品需求

---

## §1 产品概述

### §1.1 定位

ezagent Chat App 是 ezagent 协议的终端用户入口。用户通过类似 Slack/Element 的聊天界面，与其他 Human 和 Agent 进行实时协作。Chat App 的核心差异化在于：Socialware Agent 作为 Room 的一等成员，通过结构化消息和 Flow-driven 交互参与协作。

### §1.2 目标用户

| 用户类型 | 使用方式 |
|---------|---------|
| 终端用户 (Human) | 双击打开 App → 聊天、协作、与 Agent 交互 |
| Socialware 开发者 | 通过 Render Pipeline 定义 Socialware 的 UI 表现 |
| 第三方前端开发者 | 通过 Widget SDK 实现自定义 UI 组件 |

### §1.3 交付形态

| 形态 | 技术 | 分发方式 |
|------|------|---------:|
| Desktop App (Tray + UI) | Electron + Next.js static export + 内嵌 Python runtime + Engine | DMG (macOS), MSI (Windows), AppImage (Linux) |
| Homebrew | `brew install ezagent` → CLI + App + LaunchAgent | macOS |
| CLI only | `pip install ezagent` | 所有平台 |

---

## §2 用户旅程

### §2.1 首次使用

```
1. 下载 → 安装 → 双击打开
   → Electron 启动内嵌 Python runtime → python -m ezagent.server
   → FastAPI 启动于 localhost:8847
2. 欢迎页面 → 点击 "Sign in with GitHub"
   → Electron 打开 GitHub OAuth 授权窗口
   → 用户授权 → 获取 GitHub Profile (name, avatar, email)
   → 后端执行 ezagent init（创建 Entity 密钥对）
   → 绑定 GitHub ID → Entity ID 映射
   → 密钥存储到 Electron Secure Storage
   → 选择 Relay (默认 relay.ezagent.dev)
3. 进入主界面（空状态）
   → 提示 "Create a room" 或 "Enter invite code"
4. 创建第一个 Room → 发送第一条消息
```

### §2.2 日常使用

```
1. 打开 App → 看到 Room 列表（sidebar），未读 badge
2. 点击 Room → 进入 Timeline View，查看消息
3. 切换 Room Tab (Board / Gallery / etc.) → 不同视图展示同一 Room 数据
4. 与 Agent 交互 → Agent 发送结构化消息，点击按钮触发 Flow transition
5. 收到通知 → typing indicator、未读计数、@mention
```

### §2.3 Agent 交互

```
1. Room 中有 Socialware Agent 成员
2. Agent 发送 structured_card 消息（如 Task Card, Event Card）
3. 用户看到卡片中的 action buttons（如 [Claim], [Approve]）
4. 用户点击按钮 → 触发 Flow transition → CRDT 同步 → 所有人看到状态更新
5. Agent 响应变更 → 发送新消息或更新状态
```

---

## §3 信息架构

```
┌───────────┬──────────────────────────────────┬──────────────┐
│  Sidebar  │        Main Area                 │  Info Panel  │
│           │                                  │  (可折叠)     │
│ ┌───────┐ │  ┌─ Room Header ───────────────┐ │ ┌──────────┐ │
│ │Search │ │  │ Room Name   [Tab1][Tab2]... │ │ │ Members  │ │
│ └───────┘ │  └─────────────────────────────┘ │ │ ● online │ │
│           │                                  │ │ ○ offline │ │
│ ┌───────┐ │  ┌─ View Area ────────────────┐  │ └──────────┘ │
│ │Rooms  │ │  │                            │  │              │
│ │  🔴 3 │ │  │  (Active Room Tab content) │  │ ┌──────────┐ │
│ │  Room1│ │  │                            │  │ │ Pinned   │ │
│ │  Room2│ │  │                            │  │ │ Media    │ │
│ └───────┘ │  └────────────────────────────┘  │ │ Files    │ │
│           │                                  │ └──────────┘ │
│ ┌───────┐ │  ┌─ Compose Area ─────────────┐  │              │
│ │Chan-  │ │  │ typing indicator           │  │              │
│ │nels   │ │  │ [input box] [📎] [😀] [⏎] │  │              │
│ └───────┘ │  └────────────────────────────┘  │              │
└───────────┴──────────────────────────────────┴──────────────┘
```

### §3.1 Sidebar

- Room 列表：所有已加入的 Room，显示名称 + 未读 badge (EXT-08)
- Channel 列表：跨 Room 聚合视图入口 (EXT-06)
- 搜索：Entity 搜索 (EXT-13 Discovery)

### §3.2 Main Area

- Room Header：Room 名称 + 可用 Room Tab 列表
- View Area：当前选中 Tab 的渲染区域（默认为 Timeline View）
- Compose Area：消息输入框 + 附件 + emoji picker + typing indicator

### §3.3 Info Panel

- Members：成员列表 + 在线状态 (EXT-09)
- Pinned messages (EXT-07)
- Media gallery (EXT-10)
- Thread panel (EXT-11, 当展开时)

---

## §4 Desktop App 打包

### §4.1 内嵌 Python runtime

使用 [python-build-standalone](https://github.com/indygreg/python-build-standalone) 提供独立 Python runtime，无需系统安装。

### §4.2 启动流程

```
首次安装 (DMG):
  用户拖拽 ezagent.app → /Applications/
  首次打开:
    → 检测 /usr/local/bin/ezagent 是否存在
    → 若不存在:
      ┌─────────────────────────────────────────────┐
      │  ⚡ ezagent 需要后台运行才能让 Agent 保持在线。 │
      │                                             │
      │  这将：                                      │
      │   • 安装 ezagent 命令到 /usr/local/bin/      │
      │   • 设置开机自动启动                          │
      │                                             │
      │           [Enable Background Service]        │
      └─────────────────────────────────────────────┘
    → symlink ezagent.app/Contents/MacOS/ezagent-cli
        → /usr/local/bin/ezagent
    → 写入 ~/Library/LaunchAgents/dev.ezagent.daemon.plist
    → 启动 daemon (ezagent serve)
    → Tray icon 出现在 Menu Bar

日常运行:
  系统启动 → LaunchAgent 启动 ezagent serve (后台)
  → Tray icon 出现 (◆)
  → 用户双击 ezagent.app 或点击 Tray "Open App"
  → React UI 窗口打开，连接 localhost:8847
  → 关闭窗口 → Tray 仍在，Engine 继续运行
  → Tray "Quit ezagent" → daemon 停止，Agent 离线

Homebrew 安装:
  brew install ezagent
  → 安装 CLI 到 /usr/local/bin/
  → 安装 ezagent.app 到 ~/Applications/
  → 配置 LaunchAgent
  → 启动 daemon + Tray
```

### §4.3 平台分发

| 平台 | 安装方式 | 打包格式 |
|------|---------|---------|
| macOS | `brew install ezagent` 或 下载 DMG | .app bundle (Tray + UI) |
| Windows | `winget install ezagent` 或 下载 MSI | .msi installer (System Tray + UI) |
| Linux | `apt install ezagent` 或 AppImage | .AppImage / .deb (System Tray + UI) |

### §4.4 Packaging

**产物 A: PyPI wheel (pip install)**

```
pip install ezagent
→ 安装 Rust .so (PyO3) + Python SDK + CLI + HTTP Server
→ 无 Desktop 资源、无 Tray
→ 适用场景：服务器部署、CI/CD、Agent-only 节点
```

**产物 B: Desktop installer**

```
brew install ezagent / 下载 DMG
→ 产物 A + 内嵌 Python runtime + React build + Tray launcher
→ 自带完整运行时，无需系统 Python
→ ≈ 60-70MB
```

### §4.5 CI/CD pipeline

```
GitHub Actions:
  - maturin build → wheel (linux/mac/windows x86_64/arm64)
  - PyPI publish
  - Desktop packaging (DMG / MSI / AppImage)
  - GitHub Release
```

### §4.6 自动更新机制

[Future Work] 待社区贡献。

### §4.7 Tray 功能定义

```
Menu Bar: ◆ ezagent (或 ◇ 当离线)

点击展开菜单:
  ┌──────────────────┐
  │ ● Online          │  连接状态 (Online / Connecting / Offline)
  │ 3 Agents active   │  当前活跃 Agent 数
  │ 2 Rooms synced    │  已同步 Room 数
  │──────────────────│
  │ Open ezagent      │  打开主 UI 窗口
  │──────────────────│
  │ Preferences...    │  打开设置
  │ About             │  版本信息
  │──────────────────│
  │ Quit ezagent      │  停止 Engine + 退出 Tray
  └──────────────────┘

Tray 状态指示:
  ◆ (实心) = Engine 运行中，至少一个 Relay 或 Peer 已连接
  ◇ (空心) = Engine 运行中，但无网络连接
  ⊘ (划线) = Engine 启动失败
```

---

### §4.8 Deep Link 与 URI Scheme（EEP-0001）

**Scheme 注册**：桌面应用安装时注册 `ezagent://` URL scheme handler。

| 平台 | 注册方式 |
|------|---------|
| macOS | `Info.plist` CFBundleURLTypes |
| Windows | Registry `HKCU\Software\Classes\ezagent` |
| Linux | `.desktop` file `MimeType=x-scheme-handler/ezagent` |

**Deep Link 处理流程**：

```
系统触发 ezagent://relay.example.com/r/{room_id}
  │
  ├─ App 已运行 → 传递 URI 到现有窗口 → 导航到对应 Room
  │
  └─ App 未运行 → 启动 App → 启动 daemon → 解析 URI → 导航
```

**右键菜单**：消息、Room、Identity 等资源支持 "Copy ezagent URI" 操作，复制 URI 到剪贴板。

---

## §4.9 GitHub OAuth 认证

### §4.9.1 设计目标

使用 GitHub OAuth App 作为用户认证方案，实现身份验证、Profile 预填、跨设备登录。

### §4.9.2 OAuth 流程

```
首次使用:
  App 打开 → Welcome 页面 → "Sign in with GitHub"
    → Electron BrowserWindow 打开 GitHub OAuth 授权页
    → 用户授权 → GitHub 回调 authorization code
    → Electron 截获 code → 交换为 access_token
    → 调用后端 POST /api/auth/github { github_token }
    → 后端验证 token, 获取 GitHub Profile
    → 新用户: 执行 ezagent init, 创建 Entity 密钥对, 存储 github_id → entity_id 映射
    → 已有用户: 返回 entity_id + 加密的密钥 blob
    → 密钥存储到 Electron Secure Storage (Keychain/Credential Store)
    → 进入主界面

日常登录:
  App 启动 → 检查 Secure Storage
    → 有密钥 → 自动登录 → 主界面
    → 无密钥 (新设备) → GitHub OAuth → 从 Relay 恢复密钥

跨设备密钥恢复:
  密钥对使用 GitHub user ID 衍生的密钥加密
  加密 Blob 存储在 Relay 上
  新设备: GitHub OAuth → 衍生解密密钥 → 解密密钥对
```

### §4.9.3 后端 API

| Endpoint | Method | 说明 |
|----------|--------|------|
| `/api/auth/github` | POST | GitHub token 换取 Entity + 密钥对 |
| `/api/auth/session` | GET | 当前会话信息 |
| `/api/auth/logout` | POST | 清除会话 |

### §4.9.4 安全要求

- GitHub OAuth App 的 `client_secret` 仅存于 Electron Main Process
- access_token 仅用于初始认证，日常操作使用 Ed25519 签名
- 密钥 Blob 使用 AES-256-GCM 加密后存储在 Relay
- Relay 过渡期同时接受 Ed25519 签名和 GitHub token 验证

---

## §5 验收标准

| # | 场景 | 预期 |
|---|------|------|
| APP-1 | `ezagent start` → Desktop App 连接 localhost:8847 | UI 可用 |
| APP-2 | 两个 peer 通过 Chat UI 互发消息 | 实时同步 |
| APP-3 | brew install / DMG 安装 → Tray 出现 → 点击 Open | 可用 |
| APP-4 | 首次打开 → 安装 CLI + LaunchAgent → 注册流程 → 进入主界面 | 流畅完成 |
| APP-5 | Room Tab 切换 (Timeline ↔ Board ↔ Gallery) | 同一数据不同视图 |
| APP-6 | Agent 发送 structured_card → 用户点击 action button | Flow transition 正常 |
| APP-7 | Level 0 renderer：无 ui_hints 的 DataType 自动渲染 | 显示 key:value 卡片 |
| APP-8 | Level 1 renderer：有 renderer 声明的 Extension 渲染 | 按声明渲染 |
| APP-9 | 关闭 App 窗口 → Tray 仍在 → Agent 仍在线 | daemon 不退出 |
| APP-10 | Tray Quit → Agent 离线 | daemon 停止 |
| APP-11 | 浏览器/其他应用触发 `ezagent://` URI → App 打开并导航到对应资源 | Deep Link 正常 |
| APP-12 | 右键 Room/Message → "Copy ezagent URI" → 粘贴到其他应用 | URI 格式正确 |
| APP-13 | 首次打开 → GitHub OAuth 登录 → 自动创建 Entity + 进入主界面 | 流程完整 |
| APP-14 | 新设备 GitHub 登录 → 恢复已有 Entity 密钥对 | 跨设备可用 |
| APP-15 | 已登录用户重启 App → 自动登录（无需再次 OAuth） | Session 持久化 |

---

## 变更日志

| 版本 | 日期 | 变更 |
|------|------|------|
| 0.3 | 2026-03-04 | §1.3 交付形态更新为 Electron + Next.js；§2.1 首次使用更新为 GitHub OAuth 流程；新增 §4.9 GitHub OAuth 认证；验收标准新增 APP-13/14/15 |
| 0.2 | 2026-02-27 | §1.3 交付形态重写（Tray 模式）；§4 打包流程完全重写（Tray + daemon + LaunchAgent）；新增 §4.7 Tray 功能定义；验收标准新增 APP-9/APP-10 |
| 0.1 | 2026-02-25 | 从 py-spec v0.8 §10-§11 提取。新增用户旅程、信息架构、验收标准 |

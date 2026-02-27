# ezagent Chat App — Product Requirements Document v0.1

> **状态**：Draft
> **日期**：2026-02-25
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
|------|------|---------|
| Desktop App | 内嵌 Python + FastAPI + React WebView | DMG (macOS), MSI (Windows), AppImage (Linux) |
| Web 访问 | `ezagent start` → 浏览器访问 | `pip install ezagent` → `ezagent start` |
| Homebrew | `brew install ezagent` | macOS |

---

## §2 用户旅程

### §2.1 首次使用

```
1. 下载 → 安装 → 双击打开
2. 欢迎页面：输入 name + 选择 Relay (默认 relay.ezagent.dev)
   → 自动执行 ezagent init
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
用户双击 ezagent.app
  → launcher binary 启动
  → 加载内嵌 Python runtime
  → python -m ezagent.server
  → FastAPI + Chat UI 启动
  → 打开系统 WebView 或浏览器
  → 用户看到 Chat UI
```

### §4.3 平台分发

| 平台 | 安装方式 | 打包格式 |
|------|---------|---------|
| macOS | `brew install ezagent` 或 下载 DMG | .app bundle |
| Windows | `winget install ezagent` 或 下载 MSI | .msi installer |
| Linux | `apt install ezagent` 或 AppImage | .AppImage / .deb |

### §4.4 Packaging

**产物 A: PyPI wheel (pip install)**

```
pip install ezagent
→ 安装 Rust .so (PyO3) + Python 层 (CLI + HTTP + SDK)
→ 不含 Desktop 打包资源
```

**产物 B: Desktop installer**

```
brew install ezagent / 下载 DMG
→ 包含 产物 A + 内嵌 Python runtime + React 前端 + launcher
→ 双击打开，无需安装任何依赖
→ 约 50-60MB
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

---

## §5 验收标准

| # | 场景 | 预期 |
|---|------|------|
| APP-1 | `ezagent start` → 浏览器访问 | Chat UI 可用 |
| APP-2 | 两个 peer 通过 Chat UI 互发消息 | 实时同步 |
| APP-3 | brew install / DMG 安装 → 双击打开 | 可用 |
| APP-4 | 首次打开 → 注册流程 → 进入主界面 | 流畅完成 |
| APP-5 | Room Tab 切换 (Timeline ↔ Board ↔ Gallery) | 同一数据不同视图 |
| APP-6 | Agent 发送 structured_card → 用户点击 action button | Flow transition 正常 |
| APP-7 | Level 0 renderer：无 ui_hints 的 DataType 自动渲染 | 显示 key:value 卡片 |
| APP-8 | Level 1 renderer：有 renderer 声明的 Extension 渲染 | 按声明渲染 |

---

## 变更日志

| 版本 | 日期 | 变更 |
|------|------|------|
| 0.1 | 2026-02-25 | 从 py-spec v0.8 §10-§11 提取。新增用户旅程、信息架构、验收标准 |

# ezagent Spec v0.9.4 — CHANGELOG

> **日期**：2026-02-27
> **主题**：Monorepo 结构、Extension 动态加载、Desktop Tray 模式

---

## 变更主题

### 1. Monorepo 结构与 Cargo Workspace

新增 `specs/repo-spec.md`，定义：
- 5 个 Rust crate 的分层关系（protocol → backend → engine → extensions → py）
- `ezagent-protocol` 作为 relay/ 共享类型的 SSOT
- TypeScript 类型同步流程（ts-rs → bindings/ → app/src/types/generated/）
- Python 层结构（PyO3 + typer CLI + FastAPI server）

### 2. Extension 动态加载

从"静态编译进 Engine"改为"dlopen 动态加载"：
- 所有 Extension（官方 + 第三方）编译为独立 `.so`
- 安装到 `~/.ezagent/extensions/{name}/`
- 新增 `manifest.toml` 规范（api_version, datatypes, hooks, dependencies）
- Engine 新增 Extension Loader 组件

### 3. Desktop App Tray 模式

从"启动时打开浏览器"改为"Tray 常驻 + daemon"：
- `ezagent start` = 前台调试，`ezagent serve` = 后台 daemon
- 默认端口从 8000 改为 8847
- App 窗口关闭 ≠ 退出，Tray 常驻
- LaunchAgent 开机自启

### 4. protocol.md → architecture.md 重命名

避免与 `ezagent-protocol` Cargo crate 混淆。

---

## 逐文件变更

| 文件 | 变更 |
|------|------|
| **specs/architecture.md** | 从 `protocol.md` 重命名。rev.11 |
| **specs/bus-spec.md** | v0.4: 新增 §4.7 Extension Loader（dlopen + manifest + 动态注册） |
| **specs/extensions-spec.md** | v0.9.4: §1.2 重构为"分发模型 + Room 级激活"两层 |
| **specs/py-spec.md** | v0.9.4: §1.1 架构图（App 独立 repo）；§1.2 命令更新；§1.3 新增 Desktop 行；§8.5 Extension Management API |
| **specs/repo-spec.md** | ★ 新增。Monorepo 结构 + Crate 分层 + TS 类型同步 + Extension 加载 + Desktop 生命周期 |
| **products/cli-spec.md** | v0.1.2: §2.5 start/serve 重写；新增 §2.9 Extension 管理、§2.10 Daemon 管理 |
| **products/http-spec.md** | v0.1.2: 移除 Static Files/Chat UI；端口 8847 |
| **products/app-prd.md** | v0.2: §1.3 + §4 完全重写（Tray 模式）；新增 §4.7 Tray 定义 |
| **products/chat-ui-spec.md** | v0.1.1: 新增 §8.5 TypeScript 类型来源 |

---

## 未修改文件

| 文件 | 原因 |
|------|------|
| specs/socialware-spec.md | 本次变更不涉及 Socialware 层 |
| specs/relay-spec.md | 本次变更不涉及 Relay 运营 |
| socialware/*.md | Socialware PRD 不受影响 |
| plan/*.md | 实施计划将在下一轮更新 |

# CLAUDE.md — app（桌面客户端）

EZAgent 桌面客户端应用，提供聊天 UI 和协作空间交互。License: Apache 2.0。

## 定位

- 桌面端主要交互入口（聊天、任务、资源管理）
- 四层 Render Pipeline 架构（详见 `docs/products/chat-ui-spec.md`）
- 产品需求详见 `docs/products/app-prd.md`

## 技术栈

- **TypeScript** — 主要开发语言
- **React** — UI 框架
- 桌面打包方案参考 Phase 5 计划

## 构建（Makefile）

**所有构建/打包操作必须通过 `app/Makefile`**（PreToolUse hook 强制执行）：

```bash
cd app/
make package      # 构建 .app（Next.js + Electron TS + electron-builder）
make dmg          # 构建 DMG 安装包
make install      # 打包并安装到 /Applications
make test         # 单元测试
make test-e2e     # E2E 测试
make clean        # 清理构建产物
```

禁止直接调用 `electron-builder` 或 `pnpm run package`/`build:electron`。

## 开发指南

### 包管理

- 使用 `pnpm`（禁止 `npm` / `npx`）
- 安装依赖：`pnpm install` 或 `make deps`
- 开发服务器：`pnpm run dev`

### UI 规范

- 组件采用函数式组件 + Hooks
- 状态管理方案随技术选型确定
- 消息渲染遵循四层 Pipeline：Raw → Parsed → Enriched → Rendered

### 数据交互

- 与核心引擎通过本地直连通信（延迟 <1ms）
- 跨网络场景通过 Relay 桥接
- 消息类型是 Socialware 声明的 DataType，不是纯文本
- API 规范详见 `docs/products/http-spec.md`

### 测试

- 组件测试覆盖核心交互流程
- 运行测试：`pnpm test`

## Commit scope

```
feat(app): add chat room component
fix(app): fix message rendering pipeline
```

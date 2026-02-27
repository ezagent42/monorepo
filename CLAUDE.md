# CLAUDE.md — EZAgent42 Monorepo

## 项目概述

EZAgent42 是一个基于 CRDT 的 AI agent 协作框架。人类和 AI Agent 作为平等参与者，在同一个协作空间里共同运作组织。

本 monorepo 是唯一的开发入口，使用 git subtree 管理 5 个子项目。

## 子项目导航

每个子项目有独立的 CLAUDE.md，提供领域专属开发指南：

| 目录 | 说明 | 技术栈 | 指南 |
|------|------|--------|------|
| [`docs/`](docs/CLAUDE.md) | 产品规格与设计文档 | Markdown | [docs/CLAUDE.md](docs/CLAUDE.md) |
| [`ezagent/`](ezagent/CLAUDE.md) | 核心引擎（协议实现） | Rust, Python (PyO3) | [ezagent/CLAUDE.md](ezagent/CLAUDE.md) |
| [`relay/`](relay/CLAUDE.md) | 中继服务（跨网桥接） | Rust | [relay/CLAUDE.md](relay/CLAUDE.md) |
| [`page/`](page/CLAUDE.md) | 官网 (ezagent.cloud) | 前端 | [page/CLAUDE.md](page/CLAUDE.md) |
| [`app/`](app/CLAUDE.md) | 桌面客户端应用 | TypeScript, React | [app/CLAUDE.md](app/CLAUDE.md) |

## 关键文档

- **MONOREPO.md** — Monorepo 管理指南（subtree 操作、CI 同步、分支策略）。所有 subtree 相关操作必须参考此文件。
- **CONTRIBUTING.md** — 开发规范（Commit 格式、PR 流程、代码风格）
- **docs/plan/** — 实施计划（Phase 0–5）
- **docs/specs/** — 协议规范（protocol, bus, extensions, socialware, py-sdk）

## 架构概览

三层分形架构，每层四个原语：

```
Socialware 层:  Role → Arena → Commitment → Flow
Mid-layer:      Identity → Room → Message → Timeline
Bottom 层:      DataType → Hook → Annotation → Index
```

详见 `docs/specs/protocol.md`。

## 核心规则

1. **所有开发只在 monorepo 进行**，子仓库是只读发布镜像
2. **subtree add/pull 必须用 `--squash`**，subtree push 不加 `--squash`
3. **推送到 main 后 CI 自动同步子仓库**（`.github/workflows/sync-subtrees.yml`）
4. **不要直接在子仓库提交代码**
5. **Python 用 `uv`，禁止 `pip`**；**JavaScript 用 `pnpm`，禁止 `npm`/`npx`**（PreToolUse hook 强制执行）

## 开发流程

```
feat/xxx → dev → main → [CI 自动同步到子仓库]
```

- Commit 格式：`type(scope): description`，scope 使用子项目名
- 日常开发与普通 Git 仓库一致，详见 MONOREPO.md

## Claude Code 配置

- `.claude/skills/` — 项目专用 skill 文件
- `.claude/agents/` — 自定义 agent 配置
- `.claude/hooks/` — PreToolUse hook（工具约束强制执行）
- `.claude/settings.local.json` — 本地会话配置（已 gitignore）

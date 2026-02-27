# CLAUDE.md — EZAgent42 Monorepo

## 项目概述

EZAgent42 是一个 AI agent 框架项目。本 monorepo 是唯一的开发入口，使用 git subtree 管理 4 个子项目。

## 关键文档

- **MONOREPO.md** — Monorepo 管理指南（subtree 操作、CI 同步、分支策略）。所有 subtree 相关操作必须参考此文件。
- **docs/plans/** — 设计文档与实施计划

## 仓库结构

| 目录 | 说明 | License | subtree remote |
|------|------|---------|----------------|
| `specs/` | 产品规格与设计文档 | CC0-1.0 | `specs` → specs.git |
| `ezagent/` | EZAgent 核心代码 | Apache 2.0 | `ezagent` → ezagent.git |
| `relay/` | Relay 服务代码 | Apache 2.0 | `relay` → relay.git |
| `page/` | 官网 (ezagent.cloud) | Apache 2.0 | `page` → ezagent.cloud.git |

## 核心规则

1. **所有开发只在 monorepo 进行**，子仓库是只读发布镜像
2. **subtree add/pull 必须用 `--squash`**，subtree push 不加 `--squash`
3. **推送到 main 后 CI 自动同步子仓库**（`.github/workflows/sync-subtrees.yml`）
4. **不要直接在子仓库提交代码**

## 开发流程

```
feat/xxx → dev → main → [CI 自动同步到子仓库]
```

日常开发与普通 Git 仓库一致，详见 MONOREPO.md。

## Claude Code 配置

- `.claude/skills/` — 项目专用 skill 文件
- `.claude/plugins/` — 项目 plugin 配置
- `.claude/settings.local.json` — 本地会话配置（已 gitignore）

## Commit 规范

格式：`type(scope): description`

- type: `feat`, `fix`, `chore`, `docs`, `ci`, `refactor`, `test`
- scope: `ezagent`, `relay`, `page`, `specs`（可选）
- 示例: `feat(ezagent): add agent routing logic`

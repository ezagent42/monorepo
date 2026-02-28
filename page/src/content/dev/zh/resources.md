---
title: "资源链接"
description: "EZAgent 开发者资源汇总——规范文档、API 参考、工具和社区。"
lang: zh
order: 3
sidebar_label: "资源"
---

## TLDR 速读

快速理解 EZAgent 核心概念：

| 文档 | 内容 | 阅读时间 |
|------|------|---------|
| [TLDR: 总览](https://github.com/ezagent42/docs/blob/main/tldr/TLDR-overview.md) | Programmable Organization 完整叙事 | 10 分钟 |
| [TLDR: Socialware 开发](https://github.com/ezagent42/docs/blob/main/tldr/TLDR-socialware-dev.md) | @when DSL、SocialwareContext、Runtime 自动生成 | 15 分钟 |
| [TLDR: 架构](https://github.com/ezagent42/docs/blob/main/tldr/TLDR-architecture.md) | 三层分形架构、类型约束、协作模式 | 12 分钟 |

## 规范文档

| 文档 | 内容 | 适合谁 |
|------|------|--------|
| [协议总览](https://docs.ezagent.cloud/protocol) | 架构分层、设计哲学、实现路线 | 所有开发者 |
| [Bus 规范](https://docs.ezagent.cloud/bus-spec) | Engine 组件、Backend、Built-in DataTypes | Rust 开发者 |
| [Extensions 规范](https://docs.ezagent.cloud/extensions-spec) | 15 个 Extension DataType | Rust 开发者 |
| [Socialware 规范](https://docs.ezagent.cloud/socialware-spec) | 四原语、声明格式、组合操作 | Socialware 开发者 |
| [Python SDK](https://docs.ezagent.cloud/py-spec) | PyO3 binding、API 参考 | Python 开发者 |

## API 参考

| API | 说明 |
|-----|------|
| [HTTP API](https://docs.ezagent.cloud/http-api) | REST + WebSocket 接口 |
| [CLI 参考](https://docs.ezagent.cloud/cli) | 命令行工具文档 |

## 工具

| 工具 | 说明 |
|------|------|
| `pip install ezagent` | Python SDK + CLI |
| Desktop App | 图形界面客户端（即将推出） |

## 社区

- **GitHub**: [github.com/ezagent42](https://github.com/ezagent42)
- **Discussions**: [GitHub Discussions](https://github.com/ezagent42/ezagent/discussions)

## Socialware PRD 参考

想设计新的 Socialware？参考现有 PRD 格式：

- [EventWeaver PRD](https://github.com/ezagent42/docs/blob/main/socialware/eventweaver-prd.md)
- [TaskArena PRD](https://github.com/ezagent42/docs/blob/main/socialware/taskarena-prd.md)
- [ResPool PRD](https://github.com/ezagent42/docs/blob/main/socialware/respool-prd.md)
- [AgentForge PRD](https://github.com/ezagent42/docs/blob/main/socialware/agentforge-prd.md)
- [CodeViber PRD](https://github.com/ezagent42/docs/blob/main/socialware/codeviber-prd.md)

---
*当前内容基于 docs v0.9.5。*

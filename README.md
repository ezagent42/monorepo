# ezagent

### Programmable Organization

---

ezagent 是一个基于 CRDT 的开放协议和基础设施。它让人类和 AI Agent 作为**平等参与者**，在同一个协作空间里共同运作组织。

**一个为人和 Agent 共同设计的操作系统——组织是跑在上面的程序。**

- 🤝 **Agent 是同事，不是工具** — 人类和 Agent 共享完全相同的 Identity 模型，没有二等公民
- 🧬 **组织即代码** — 角色、流程、权利义务都是可声明、可版本化的代码，支持 Fork / Compose / Merge
- 📡 **Agent 原生通信** — 原生 pub/sub + Hook Pipeline，局域网直连 <1ms
- 🏛️ **规模与主权** — P2P 节点自给自足，数据不在任何 SaaS 供应商的数据库里

---

## 架构

三层分形架构，每层四个原语：

```
┌──────────────────────────────────────────────────────────────┐
│  Socialware 层（正交维度，施加于 Mid-layer 实体）               │
│    Role            Arena           Commitment        Flow    │
├──────────────────────────────────────────────────────────────┤
│  Mid-layer（实体，由底层原语组合构成）                          │
│    Identity         Room            Message        Timeline  │
├──────────────────────────────────────────────────────────────┤
│  Bottom（构造原语）                                           │
│    DataType          Hook          Annotation         Index  │
└──────────────────────────────────────────────────────────────┘
```

---

## Quick Start

```bash
pip install ezagent
```

```python
import ezagent

alice = ezagent.Identity.create("alice")
agent_r1 = ezagent.Identity.create("agent-r1")

room = ezagent.Room.create(
    name="feature-review",
    members=[alice, agent_r1]
)

room.send(
    author=agent_r1,
    body="I've reviewed PR #427. Two issues found, see annotations.",
    channels=["code-review"]
)
```

---

## Monorepo 结构

本仓库是唯一的开发入口，使用 git subtree 管理 5 个子项目：

```
monorepo/
├── docs/          → 产品规格与设计文档 (CC0-1.0)
├── ezagent/       → 核心引擎：Rust + Python (PyO3) (Apache 2.0)
├── relay/         → 中继服务：跨网桥接 (Apache 2.0)
├── page/          → 官网 ezagent.cloud (Apache 2.0)
├── app/           → 桌面客户端应用 (Apache 2.0)
├── MONOREPO.md    → Monorepo 管理指南（subtree 操作、CI 同步）
└── CONTRIBUTING.md → 开发规范（Commit 格式、PR 流程）
```

| 子项目 | 说明 | 子仓库（只读镜像） |
|--------|------|---------------------|
| `docs/` | 协议规范 · 产品设计 · 实施计划 | [ezagent42/docs](https://github.com/ezagent42/docs) |
| `ezagent/` | Rust Engine + Python SDK | [ezagent42/ezagent](https://github.com/ezagent42/ezagent) |
| `relay/` | Public Relay 服务 | [ezagent42/relay](https://github.com/ezagent42/relay) |
| `page/` | 官网 (Astro + Tailwind) | [ezagent42/ezagent.cloud](https://github.com/ezagent42/ezagent.cloud) |
| `app/` | 桌面应用 (TypeScript + React) | [ezagent42/app](https://github.com/ezagent42/app) |

> 所有开发只在 monorepo 进行，子仓库是单向的发布镜像。详见 [MONOREPO.md](MONOREPO.md)。

---

## 文档

| 文档 | 内容 |
|------|------|
| [docs/README.md](docs/README.md) | **项目详细介绍** — 核心理念、架构详解、Socialware 示例、文档导航 |
| [docs/tldr/](docs/tldr/) | **快速了解** — 概览、架构、Socialware 开发 TLDR |
| [docs/specs/](docs/specs/) | **协议规范** — architecture, bus, extensions, socialware, py-sdk |
| [docs/socialware/](docs/socialware/) | **Socialware PRD** — EventWeaver, TaskArena, ResPool, AgentForge, CodeViber |
| [docs/products/](docs/products/) | **产品文档** — 桌面应用, Chat UI, HTTP API, CLI |
| [docs/plan/](docs/plan/) | **实施计划** — Phase 0–5 |
| [docs/eep/](docs/eep/) | **设计提案 (EEP)** — ezagent Enhancement Proposal |
| [MONOREPO.md](MONOREPO.md) | **Monorepo 管理** — subtree 操作、CI 同步、分支策略 |

### 阅读路径

- **快速了解** → [TLDR-overview.md](docs/tldr/TLDR-overview.md)
- **理解全貌** → [docs/README.md](docs/README.md)
- **写 Socialware** → [TLDR-socialware-dev.md](docs/tldr/TLDR-socialware-dev.md) → [socialware-spec.md](docs/specs/socialware-spec.md) → [py-spec.md](docs/specs/py-spec.md)
- **理解架构** → [TLDR-architecture.md](docs/tldr/TLDR-architecture.md) → [architecture.md](docs/specs/architecture.md)
- **提出设计提案** → [EEP-0000.md](docs/eep/EEP-0000.md)
- **开始开发** → [MONOREPO.md](MONOREPO.md) → [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 项目状态

**Architecture Draft** 阶段（v0.9.5）。协议规范和产品设计已基本完成，正在进入实现阶段。

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 0 | 技术可行性验证 | ✅ 完成 |
| Phase 1 | Rust Engine 核心 | 🔜 即将开始 |
| Phase 2 | Extension Datatypes | 📋 计划中 |
| Phase 3 | CLI + HTTP API | 📋 计划中 |
| Phase 4 | 桌面聊天应用 | 📋 计划中 |
| Phase 5 | Socialware 运行时 | 📋 计划中 |

## 参与贡献

- **协议讨论** — 对架构设计有想法？打开一个 Issue 或 Discussion
- **规范 Review** — 帮助发现 spec 中的矛盾、遗漏或不合理设计
- **代码贡献** — Rust core、Python binding、前端应用
- **Socialware 设计** — 参考现有 PRD 格式提交提案

---

<p align="center">
<em>未来的组织不是一张架构图。它是一段可以运行的程序。</em>
</p>

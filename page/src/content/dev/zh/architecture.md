---
title: "三层分形架构"
description: "EZAgent 协议的核心：三层四原语的分形设计，从数据原语到组织逻辑。"
lang: zh
order: 1
sidebar_label: "架构"
---

## 设计哲学

EZAgent 协议的核心设计原则：

- **Entity-agnostic**：协议层不区分人类和 Agent，两者共享完全相同的 Identity 模型
- **一切皆 DataType**：所有上层实体（Room、Message、Timeline）都由 DataType 声明 + Hook + Annotation + Index 组合而成
- **P2P-First**：每个节点自给自足，局域网零配置直连

## 三层架构

```
┌──────────────────────────────────────────────────────────┐
│  Socialware 层（正交维度，施加于 Mid-layer 实体）           │
│                                                          │
│    Role          Arena         Commitment        Flow    │
│    能力信封        边界定义        义务绑定      演进模式    │
├──────────────────────────────────────────────────────────┤
│  Mid-layer（实体，由底层原语组合构成）                      │
│                                                          │
│    Identity       Room          Message      Timeline    │
├──────────────────────────────────────────────────────────┤
│  Bottom（构造原语）                                       │
│                                                          │
│    DataType        Hook        Annotation       Index    │
└──────────────────────────────────────────────────────────┘
```

### Bottom 层：构造原语

四个不可再分的原语，所有上层概念都由它们组合而成：

- **DataType**：CRDT 数据结构声明，定义"这是什么数据"
- **Hook**：三阶段拦截器（pre-send / after-write / after-read），定义"数据变化时做什么"
- **Annotation**：元数据标注，定义"关于数据的数据"
- **Index**：查询索引，定义"怎么找到数据"

### Mid-layer：协作实体

底层原语的组合：

- **Identity**：参与者（人或 Agent）= DataType(profile) + Hook(auth) + Annotation(role-bindings) + Index(lookup)
- **Room**：协作空间 = DataType(metadata) + Hook(access-control) + Annotation(tags) + Index(search)
- **Message**：内容单元 = DataType(body) + Hook(render-pipeline) + Annotation(reactions) + Index(timeline)
- **Timeline**：时间线 = DataType(entries) + Hook(ordering) + Annotation(bookmarks) + Index(cursor)

### Socialware 层：组织逻辑

四个正交维度，可施加于任何 Mid-layer 实体：

- **Role**：能力信封——一个 Identity 被赋予 Role 后获得特定能力
- **Arena**：边界定义——一组 Room 被划为 Arena 后形成协作边界
- **Commitment**：义务绑定——一条 Message 承载 Commitment 后成为可追踪的承诺
- **Flow**：演进模式——一段 Timeline 被 Flow 描述后有了状态转换规则

### 分形特性

每一层都是 4 个原语。Socialware 本身拥有 Identity（它是一个 Entity），因此可以递归地被更上层的 Socialware 所组合。组织可以像代码一样嵌套、组合、分拆。

## Socialware vs Skill / Subagent / MCP

Socialware 不替代 Skill、Subagent、MCP——它是**上层建筑**：

| 维度 | Skill | Subagent Framework | MCP | Socialware |
|------|-------|-------------------|-----|-----------|
| 核心抽象 | Agent 的单项能力 | Agent 间委托链 | Agent↔Tool 接口 | 组织规则（角色/流程/承诺） |
| Agent 地位 | 执行者 | 层级节点 | 客户端 | 组织成员（与人类平等） |
| 人类位置 | 系统外 | 系统外（顶层调用者） | 不涉及 | 系统内（相同 Identity 模型） |
| 生命周期 | 单次调用 | 一个 Task | 一个 Session | 组织存续期 |
| 状态管理 | 无状态 | 框架内存 | Tool 侧 | CRDT + Timeline 持久化 |
| 协调方式 | 无 | 中心化 Orchestrator | Request/Response | 去中心化（Role + Flow） |

```
┌─────────────────────────────────────────────┐
│ Socialware（组织规则）                        │
│ Role · Arena · Commitment · Flow             │
├─────────────────────────────────────────────┤
│ Agent 内部基础设施（个体能力）                  │
│ Skill · Subagent · MCP · LLM Adapter         │
└─────────────────────────────────────────────┘
```

就像操作系统不关心 CPU 怎么执行指令，Socialware 不关心 Agent 内部用什么 LLM。只关心：在组织中什么角色、承诺了什么、流程是否合法。

## 类型层约束

v0.9.5 的核心决策：Python 类型系统强制开发者不能跨层操作。

| | SocialwareContext（默认） | EngineContext（unsafe=True） |
|---|---|---|
| Socialware 层 | ✅ ctx.send / ctx.state / ctx.grant_role | ✅ |
| Mid-layer | ✅ ctx.room / ctx.members（只读查询） | ✅ |
| Extension 层 | ❌ 不可访问 | ✅ ctx.runtime.* |
| Bottom 层 | ❌ 不可访问 | ✅ ctx.messages.* / ctx.hook.* |

类似 Rust 的 safe/unsafe 模型：默认受限，`unsafe` 需要显式声明并标记在 `manifest.toml` 中。

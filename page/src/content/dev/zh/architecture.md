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

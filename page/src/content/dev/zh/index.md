---
title: "开发者入口"
description: "从三层分形架构到你的第一个 Socialware——EZAgent 开发者指南。"
lang: zh
order: 0
sidebar_label: "开始"
---

## 欢迎，开发者

EZAgent 是一个基于 CRDT 的开放协议。它用三层分形架构让你可以用 Python 代码定义组织的运作方式。

### 你能用 EZAgent 做什么？

- **构建 Socialware**：用 `@socialware` 装饰器声明组织逻辑
- **定义 DataType**：创建 CRDT 同步的自定义数据结构
- **编写 Hook**：在数据生命周期的任何阶段注入逻辑
- **组合 Flow**：用状态机描述业务流程

### 快速开始

```bash
pip install ezagent
```

```python
import ezagent

# 创建 Identity —— 人类和 Agent 完全相同
alice = ezagent.Identity.create("alice")
agent = ezagent.Identity.create("agent-r1")

# 创建 Room
room = ezagent.Room.create(
    name="my-project",
    members=[alice, agent]
)

# 发送消息
room.send(author=agent, body="Hello from Agent!", channels=["general"])
```

### 接下来

- [三层架构详解](/zh/dev/architecture) — 理解 Bottom → Mid-layer → Socialware
- [Socialware 开发指南](/zh/dev/socialware-guide) — 写你的第一个 Socialware
- [开发者展示](/zh/dev/showcase) — 看看现有的 Socialware 实现
- [资源链接](/zh/dev/resources) — 完整文档、API 参考、社区

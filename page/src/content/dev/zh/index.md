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

- **构建 Socialware**：用 `@socialware` 装饰器 + `@when` DSL 声明组织逻辑
- **定义 Role**：用 `Role(capabilities=capabilities(...))` 声明角色和能力
- **编排 Flow**：用 `Flow(subject=..., transitions={...})` 描述业务流程的状态机
- **组合组织**：多个 Socialware 通过 Room + Message + @mention 自然协作

### 快速开始

```bash
pip install ezagent
```

```python
import ezagent
from ezagent import socialware, when, Role, Flow, capabilities, SocialwareContext

# 创建 Identity —— 人类和 Agent 完全相同
alice = ezagent.Identity.create("alice")
agent_r1 = ezagent.Identity.create("agent-r1")

# 创建 Room，平等成员
room = ezagent.Room.create(
    name="feature-review",
    members=[alice, agent_r1]
)

# Agent 发送消息 —— 和人类完全一样
room.send(
    author=agent_r1,
    body="I've reviewed PR #427. Two issues found, see annotations.",
    channels=["code-review"]
)

# 用 Socialware 定义组织 —— 声明角色和流程
@socialware("code-review")
class CodeReview:
    namespace = "cr"
    roles = {
        "cr:reviewer": Role(capabilities=capabilities("review.submit", "review.approve")),
        "cr:author":   Role(capabilities=capabilities("review.request")),
    }
    review_flow = Flow(
        subject="review.request",
        transitions={
            ("pending", "review.submit"):  "reviewed",
            ("reviewed", "review.approve"): "approved",
        },
    )

    @when("review.request")
    async def on_review_request(self, event, ctx: SocialwareContext):
        reviewers = ctx.state.roles.find("cr:reviewer", room=event.room_id)
        await ctx.send("review.notify", body={"pr": event.body["pr"]},
                       mentions=[r.entity_id for r in reviewers])
```

### 接下来

- [三层架构详解](/zh/dev/architecture) — 理解 Bottom → Mid-layer → Socialware
- [Socialware 开发指南](/zh/dev/socialware-guide) — 写你的第一个 Socialware
- [开发者展示](/zh/dev/showcase) — 看看现有的 Socialware 实现
- [资源链接](/zh/dev/resources) — 完整文档、API 参考、社区

---
title: "Socialware：可编程的组织逻辑"
description: "Socialware 是 EZAgent 的核心概念——用代码定义组织的角色、边界、承诺和流程。"
lang: zh
order: 2
---

## 什么是 Socialware？

想象一下，如果组织的运作规则——谁能做什么、任务怎么流转、审批如何进行——不是写在 Wiki 或散落在 Slack 频道里，而是变成了一段可执行的代码。

这就是 Socialware。

## Socialware 是组织的上层建筑

Socialware **不替代** Skill、Subagent、MCP——它们是不同层次的东西：

```
┌─────────────────────────────────────────────┐
│ Socialware（组织规则）                        │
│ Role · Arena · Commitment · Flow             │
│ "谁能做什么、在哪里、承诺了什么、怎么演进"       │
├─────────────────────────────────────────────┤
│ Agent 内部基础设施（个体能力）                  │
│ Skill · Subagent · MCP · LLM Adapter         │
│ "Agent 能做什么、委托谁、调用什么工具"           │
└─────────────────────────────────────────────┘
```

就像操作系统不关心 CPU 怎么执行指令，Socialware 不关心 Agent 内部用什么 LLM。只关心：在组织中什么角色、承诺了什么、流程是否合法。

## 四个原语

### Role（角色）
定义"能做什么"的能力信封。用 `Role(capabilities=capabilities(...))` 声明。一个 Identity（人或 Agent）可以拥有多个 Role。

### Arena（竞技场）
定义"在哪里做"的边界。Arena 决定了 Socialware 影响的范围——哪些 Room、哪些数据、哪些参与者。

### Commitment（承诺）
定义"必须做什么"的义务绑定。用 `Commitment(between=..., obligation=..., deadline=...)` 声明。追踪进度、验证交付、处理违约。

### Flow（流程）
定义"怎么演进"的状态机。用 `Flow(subject=..., transitions={...})` 声明。支持分支、回退和条件触发。

## 从零到一的例子

```python
from ezagent import socialware, when, Role, Flow, capabilities, SocialwareContext

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

这就是一个完整的 Code Review Socialware。它不需要后端服务器，不需要数据库——所有数据通过 CRDT 在参与者之间同步。

## 组合的力量

Socialware 的真正威力在于组合。TaskArena 管任务，ResPool 管资源，EventWeaver 记录因果链，CodeViber 提供编程指导——各自独立，但可以自由组合。

Socialware 之间的协作方式和人类一样——@mention + Role。CodeViber 需要通知 Mentor？@mention 持有 `cv:mentor` Role 的 Identity。如果是 Agent，AgentForge 自动唤醒它。如果是人类，就是普通 IM 通知。代码一个字都不用改。

这就是"组织即代码"的具体含义。

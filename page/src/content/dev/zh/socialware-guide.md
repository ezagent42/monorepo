---
title: "Socialware 开发指南"
description: "用 Python 的 @socialware 装饰器 + @when DSL 构建你的第一个 Socialware。"
lang: zh
order: 2
sidebar_label: "开发指南"
---

## 你是组织设计者，不是程序员

写 Socialware 时，你在设计组织——不是编程：

| 你在做的事 | 对应原语 | 类比 |
|-----------|---------|------|
| 定义岗位和权限 | **Role** | 公司章程里的岗位描述 |
| 划定部门边界 | **Arena** | 部门隔离 + 跨部门协作规则 |
| 设定 SLA 和契约 | **Commitment** | 劳动合同的义务条款 |
| 规划工作流程 | **Flow** | 审批流、任务路由规则 |

**你不需要实现任何岗位的实际工作**——那是 Role 持有者（人类或 Agent）自己的事。

## @socialware + @when DSL

EZAgent v0.9.5 使用 `@socialware` 装饰器声明组织，`@when` DSL 处理组织事件：

```python
from ezagent import (
    socialware, when, Role, Flow, Commitment,
    capabilities, preferred_when, SocialwareContext,
)

@socialware("code-viber")
class CodeViber:
    namespace = "cv"

    # ── 岗位定义 ──
    roles = {
        "cv:mentor":  Role(capabilities=capabilities(
            "session.accept", "guidance.provide", "session.close")),
        "cv:learner": Role(capabilities=capabilities(
            "session.request", "question.ask", "session.close")),
    }

    # ── 工作流程 ──
    session_lifecycle = Flow(
        subject="session.request",
        transitions={
            ("pending", "session.accept"):   "active",
            ("active",  "guidance.provide"): "active",
            ("active",  "session.close"):    "closed",
            ("active",  "session.escalate"): "escalated",
            ("escalated", "guidance.provide"): "active",
        },
        preferences={
            "session.escalate": preferred_when("last_guidance.confidence < 0.5"),
        },
    )

    # ── SLA 承诺 ──
    commitments = [
        Commitment(
            id="response_sla",
            between=("cv:mentor", "cv:learner"),
            obligation="Mentor responds within deadline",
            triggered_by="question.ask",
            deadline="5m",
        ),
    ]

    # ── 组织管理逻辑（不是业务逻辑！）──

    @when("session.request")
    async def on_session_request(self, event, ctx: SocialwareContext):
        """找到可用的 mentor 并通知。零 AI 逻辑。"""
        mentors = ctx.state.roles.find("cv:mentor", room=event.room_id)
        if not mentors:
            await ctx.fail("No mentor available")
            return
        await ctx.send("session.notify",
                       body={"learner": event.author, "topic": event.body["topic"]},
                       mentions=[m.entity_id for m in mentors])
        await ctx.succeed({"notified": len(mentors)})

    @when("guidance.provide")
    async def on_guidance(self, event, ctx: SocialwareContext):
        """检查置信度，必要时升级给人类。"""
        if event.body.get("confidence", 1.0) < 0.5:
            humans = [m for m in ctx.state.roles.find("cv:mentor", room=event.room_id)
                      if m.entity_id != event.author]
            if humans:
                await ctx.send("_system.escalation",
                               body={"reason": "low_confidence"},
                               mentions=[m.entity_id for m in humans])
```

这就是全部。~50 行 Python，一个完整的编程指导服务。

## SocialwareContext 速查

`@when` 处理器的 `ctx` 是受限类型——只能做组织操作：

```python
# ✅ 可以做
await ctx.send(action, body, mentions=[...])   # 发送组织消息
await ctx.reply(ref_id, action, body)          # 回复
await ctx.succeed(result)                      # 命令成功
await ctx.fail(error)                          # 命令失败
await ctx.grant_role(entity_id, role)          # 授予角色
await ctx.revoke_role(entity_id, role)         # 撤销角色
ctx.state.flow_states[ref_id]                  # 查询 Flow 状态
ctx.state.roles.find("cv:mentor", room=...)    # 查找角色持有者
ctx.members                                    # 当前 Room 成员

# ❌ 不存在（类型系统阻止，不是运行时）
ctx.messages.send(content_type=...)            # → AttributeError
ctx.hook.register(phase=...)                   # → AttributeError
ctx.annotations.write(...)                     # → AttributeError
```

需要底层操作？声明 `@socialware("my-sw", unsafe=True)` 获取 `EngineContext`。

## Runtime 自动生成

你只需要写 `@when` 处理器，Runtime 从你的声明自动生成 7 类代码：

| 你省略的工作 | Runtime 怎么做 |
|-------------|---------------|
| 拼接 `content_type` | `ctx.send("session.notify")` → 自动变成 `cv:session.notify` |
| 设置 `channels` | 自动设为 `["_sw:cv"]` |
| 写 Role 权限检查 | 从 `roles` 声明自动生成到 pre_send Hook |
| 写 Flow 状态转换验证 | 从 `transitions` 自动生成到 pre_send Hook |
| 更新 State Cache | 从 `flows` 自动生成到 after_write Hook |
| 注册 Hook 代码 | `@when("action")` 自动展开为完整 Hook Pipeline |
| 派发 Commands | EXT-15 Command → `@when` handler 自动路由 |

## Socialware 间协作

Socialware 之间的协作方式和**人类一样**——@mention + Role，无需特殊协议：

```
CodeViber                       AgentForge
    │                              │
    │  @mention cv:mentor          │
    ├─────────────────────────────►│ ← 检测到 Agent 被 @mention
    │                              │   自动唤醒 Agent
    │  cv:guidance.provide         │
    │◄─────────────────────────────┤
    │                              │
    │  CodeViber 不知道对方是 Agent
    │  AgentForge 不知道来源是 CodeViber
```

如果 Mentor 是人类？@mention 变成普通 IM 通知。**代码一个字都不用改。**

## 完整示例

参考现有 Socialware 实现：

- **CodeViber** — 编程指导（应用级）
- **EventWeaver** — 事件溯源（平台级）
- **TaskArena** — 任务市场（应用级）
- **ResPool** — 资源管理（平台级）
- **AgentForge** — Agent 管理（平台级）

## 深入阅读

完整的 Socialware 规范和 Python SDK API 参考请访问 [ReadTheDocs](#)。

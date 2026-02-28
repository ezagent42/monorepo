# Socialware 开发者指南

> 一句话：**你是组织设计师，不是程序员。** 定义岗位、流程和承诺，剩下的交给 Runtime。

---

## 30 秒理解 Socialware

Socialware 就是一个**可编程的组织**。当你写一个 Socialware，你在做的事情等价于：

| 你在做的事 | 对应原语 | 类比 |
|-----------|---------|------|
| 定义岗位和权限 | **Role** | 公司章程中的职位描述 |
| 划定部门边界 | **Arena** | 部门隔离与跨部门协作规则 |
| 制定 SLA 和合同 | **Commitment** | 劳动合同中的义务条款 |
| 规划工作流程 | **Flow** | 审批流程、任务流转规则 |

你**不需要实现任何岗位的具体工作**——那是 Role 持有者（人类或 Agent）自己的事。

## 完整示例：CodeViber（编程指导服务）

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
            ("active",  "guidance.provide"): "active",     # 可多次回答
            ("active",  "session.close"):    "closed",
            ("active",  "session.escalate"): "escalated",  # 低置信度升级
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
        """找到可用 mentor 并通知。零 AI 逻辑。"""
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
        """检查置信度，必要时 escalate 给人类。"""
        if event.body.get("confidence", 1.0) < 0.5:
            humans = [m for m in ctx.state.roles.find("cv:mentor", room=event.room_id)
                      if m.entity_id != event.author]
            if humans:
                await ctx.send("_system.escalation",
                               body={"reason": "low_confidence"},
                               mentions=[h.entity_id for h in humans])
```

**这就是全部。** ~50 行 Python，定义了一个完整的编程指导服务。

## 你不需要做什么

Runtime 从你的声明自动生成以下全部内容：

| 你省掉的工作 | Runtime 怎么做 |
|-------------|---------------|
| 拼接 `content_type` | `ctx.send("session.notify")` → 自动变成 `cv:session.notify` |
| 设置 `channels` | 自动设为 `["_sw:cv"]` |
| 写 Role 权限检查 | 从 `roles` 声明生成 `pre_send` Hook |
| 写 Flow 转换验证 | 从 `transitions` 声明生成 `pre_send` Hook |
| 写 State Cache 更新 | 从 `flows` 声明生成 `after_write` Hook |
| 写 Hook 注册代码 | `@when("action")` 自动展开为完整 Hook Pipeline |
| 写 Command 分发 | EXT-15 Command → `@when` handler 自动路由 |

## SocialwareContext 速查

`@when` handler 中的 `ctx` 是受限类型——你**只能做组织管理操作**：

```python
# ✅ 可以做的
await ctx.send(action, body, mentions=[...])   # 发送组织消息
await ctx.reply(ref_id, action, body)          # 回复
await ctx.succeed(result)                      # 命令成功
await ctx.fail(error)                          # 命令失败
await ctx.grant_role(entity_id, role)          # 授予角色
await ctx.revoke_role(entity_id, role)         # 撤回角色
ctx.state.flow_states[ref_id]                  # 查询 Flow 状态
ctx.state.roles.find("cv:mentor", room=...)    # 查找角色持有者
ctx.members                                    # 当前 Room 成员

# ❌ 不存在的方法（类型系统阻止，不是运行时报错）
ctx.messages.send(content_type=...)            # → AttributeError
ctx.hook.register(phase=...)                   # → AttributeError
ctx.annotations.write(...)                     # → AttributeError
```

需要底层操作？声明 `@socialware("my-sw", unsafe=True)` 获取 `EngineContext`。

## Socialware 间协作

Socialware 之间用**人类的方式**协作——@mention + Role，不需要特殊协议：

```
CodeViber                         AgentForge
    │                                  │
    │  @mention cv:mentor              │
    ├──────────────────────────────────►│ ← 检测到 Agent 被 @mention
    │                                  │   自动唤醒 Agent
    │  cv:guidance.provide             │
    │◄─────────────────────────────────┤
    │                                  │
    │  CodeViber 不知道对方是 Agent      │
    │  AgentForge 不知道来源是 CodeViber  │
```

如果 mentor 是人类？@mention 直接变成 IM 通知。**代码不需要改一个字。**

Agent 由 AgentForge 通过运营配置自动分配，Socialware 声明中不涉及：

```yaml
# ext.runtime.config（运营决策，不是组织章程）
af:
  role_staffing:
    "cv:mentor": { prefer: "agent", template: "code-assistant", auto_spawn: true }
```

## 下一步

| 我想... | 去看 |
|---------|------|
| 理解四原语的完整定义 | [socialware-spec.md §1](../specs/socialware-spec.md) |
| 看 DSL 的完整语法 | [socialware-spec.md §9](../specs/socialware-spec.md) |
| 理解类型约束的设计 | [socialware-spec.md §10](../specs/socialware-spec.md) |
| 看 Python SDK 细节 | [py-spec.md §4, §7](../specs/py-spec.md) |
| 看更多 Socialware 示例 | [TaskArena PRD](../socialware/taskarena-prd.md) · [CodeViber PRD](../socialware/codeviber-prd.md) |
| 理解 Socialware 间协作 | [socialware-spec.md §11](../specs/socialware-spec.md) |

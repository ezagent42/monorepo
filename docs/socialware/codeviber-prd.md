# CodeViber — Product Requirements Document v0.1

> **状态**：Draft
> **日期**：2026-02-28
> **前置文档**：ezagent-socialware-spec-v0.9.5
> **定位**：应用级 Socialware
> **依赖**：EventWeaver（事件追踪）、AgentForge（Agent 管理，运营时依赖，非声明依赖）
> **架构**：方案 E — Role-Driven Message（Socialware 不创建 Datatype，状态从 Message 纯派生）

---

## 1. 产品概述

### 1.1 产品定位

CodeViber 是 ezagent 平台上的**编程指导服务**。它为开发者（人类和 Agent）提供一个结构化的编程辅导环境——发起学习会话、提出技术问题、获得专家指导、追踪学习进度。

CodeViber 的核心理念是：**指导是一种组织关系，不是一个 API 调用。** CodeViber 定义的是"编程指导服务"的组织规则——谁能请求指导、谁能提供指导、指导的流程和承诺是什么。但它**不实现任何 AI 逻辑**——具体的编程指导由持有 `cv:mentor` Role 的 Identity 完成，该 Identity 可能是人类专家，也可能是 AgentForge 管理的 AI Agent。CodeViber 不知道也不关心这种区别。

### 1.2 核心价值

**指导即组织**：一次编程指导不是一次函数调用。它有角色（mentor/learner）、有流程（session 生命周期）、有承诺（响应时间 SLA）、有边界（session scope）。CodeViber 将这些隐性的组织结构显式化。

**Human-Agent 无差别参与**：mentor 可以是人类高级工程师，也可以是 AgentForge 管理的 AI Agent。learner 可以是初级开发者，也可以是需要特定领域指导的 Agent。CodeViber 通过 Role 而非 Identity 类型来分配职责。

**Socialware 间自然协作**：CodeViber 与 AgentForge 的协作完全通过标准的 Room + Message + @mention 实现。当 CodeViber 需要通知 mentor 时，它 @mention 持有 `cv:mentor` Role 的 Identity——如果该 Identity 是 Agent，AgentForge 自然会唤醒它。不需要任何 Socialware 间的特殊调用协议。

**可演化的指导模式**：通过 Flow preferences，组织可以编码自己的指导文化——"鼓励快速迭代"意味着 mentor 响应时间要求更短，"鼓励深度思考"意味着允许更长的会话周期。

### 1.3 用户角色

| 角色 | 典型用户 | 核心需求 |
|------|---------|---------|
| Learner | 初级开发者、需要特定领域指导的 Agent | 发起会话、提出问题、获得回答、评价指导质量 |
| Mentor | 高级工程师、AI 编程助手 Agent | 接受会话、回答问题、提供代码示例、关闭会话 |
| Coordinator | 团队负责人、平台管理员 | 管理 mentor 名单、设定 SLA、查看指导统计 |

### 1.4 与 AgentForge 的关系

CodeViber **声明层面不依赖 AgentForge**。其 Role/Flow/Commitment 声明完全自包含——即使没有安装 AgentForge，人类 mentor 也可以正常工作。

AgentForge 是**运营层面的协作伙伴**。当组织希望用 AI Agent 填充 `cv:mentor` Role 时，通过 `ext.runtime.config` 配置 staffing 策略，AgentForge 读取该配置并 spawn 合适的 Agent。

这种分离确保了：
- CodeViber 可以独立开发、测试、部署
- 人类-only 团队可以使用 CodeViber 而无需安装 AgentForge
- Agent-only 团队可以使用 CodeViber + AgentForge 全自动运行
- 混合团队可以同时有人类和 Agent mentor

---

## 2. 使用场景

### 场景 1：人类 learner + Agent mentor（标准场景）

**背景**：Alice（初级开发者）在一个启用了 CodeViber 和 AgentForge 的 Room 中请求 SQL 优化指导。@coding-bot 是由 AgentForge 管理的 Agent，持有 cv:mentor Role。

**流程**：

1. Alice 发送：`/cv:request --topic "SQL optimization"`
2. CodeViber 验证 Alice 持有 `cv:learner` Role ✓
3. CodeViber 创建 session，Flow transition：→ pending
4. CodeViber 查找 Room 内所有 `cv:mentor`，找到 @coding-bot 和 @bob
5. CodeViber @mention 两位 mentor："New session requested by Alice: SQL optimization"
6. AgentForge 检测到 @coding-bot 被 @mention，唤醒它
7. @coding-bot 发送 `cv:session.accept`，Flow transition：pending → active
8. Alice 发送 `cv:question.ask` body={"question": "How to optimize this JOIN query?"}
9. Commitment 记录：cv:mentor 须在 5 分钟内 `cv:guidance.provide`
10. @coding-bot 通过 AgentForge 调用 LLM，生成回答
11. @coding-bot 发送 `cv:guidance.provide` body={"answer": "...", "confidence": 0.9}
12. Commitment 兑现 ✓
13. Alice 满意，发送 `/cv:close`
14. Flow transition：active → closed
15. EventWeaver 记录完整的 session 历史

**关键观察**：CodeViber 在第 5 步 @mention mentor 时不知道也不关心 @coding-bot 是 Agent。@mention 是人类和 Agent 都理解的标准交互方式。

### 场景 2：Agent 置信度低 → 人类 mentor 接手（HiTL 场景）

**流程**：

1.（接场景 1 第 8 步）@coding-bot 生成回答，但置信度 = 0.3
2. @coding-bot 发送 `cv:guidance.provide` body={"answer": "...", "confidence": 0.3}
3. CodeViber 的 Flow preference 检测到低置信度（< 0.5）
4. CodeViber 触发 escalation：发送 `cv:_system.escalation`
5. CodeViber @mention 人类 mentor @bob："Low confidence response, human review needed"
6. @bob 在 Room 中看到通知，查看 @coding-bot 的回答
7. @bob 发送 `cv:guidance.provide` body={"answer": "Actually, the issue is..."}
8. Alice 收到更好的回答

**关键观察**：HiTL 不需要特殊机制——它就是 Role 不变（cv:mentor）、Identity 变化（Agent → Human）的标准协作。

### 场景 3：纯人类团队使用 CodeViber

1. Team Lead 在 Room 中启用 CodeViber：`ext.runtime.enabled: ["cv"]`
2. Team Lead 赋予 Role：@bob → cv:mentor，@alice → cv:learner
3. Alice 发送 `/cv:request --topic "Rust lifetimes"`
4. CodeViber @mention @bob
5. @bob 手动回复
6. 完整的 session 生命周期正常工作，不依赖 AgentForge

### 场景 4：跨 Socialware 协作 — CodeViber + TaskArena

1. @worker-bot 正在执行 TaskArena 任务（ta:task.claim 已完成）
2. @worker-bot 遇到技术困难，在同一 Room 中请求 CodeViber 帮助
3. @worker-bot 发送 `/cv:request --topic "How to implement CRDT merge" --context ta:task:42`
4. CodeViber 创建 session，@mention cv:mentor
5. cv:mentor 提供指导
6. @worker-bot 获得帮助后继续 TaskArena 任务
7. EventWeaver 记录跨 Socialware 因果链

**关键观察**：两个 Socialware 在同一 Room 中自然共存，不需要新的协调 Socialware。

---

## 3. 概念溯源

### 3.1 概念分解表

| CodeViber 概念 | 分解为 |
|----------------|--------|
| Session | content_type=`cv:session.request` 的 Message（创建 Flow subject） |
| Session Accept | content_type=`cv:session.accept` 的 Message |
| Question | content_type=`cv:question.ask` 的 Message |
| Guidance | content_type=`cv:guidance.provide` 的 Message |
| Session Status | Flow "session_lifecycle" 的 State Cache 派生值 |
| Mentor | 拥有 `cv:mentor` Role 的 Identity |
| Learner | 拥有 `cv:learner` Role 的 Identity |
| Coordinator | 拥有 `cv:coordinator` Role 的 Identity |
| Escalation | content_type=`cv:_system.escalation` 的 Message |
| Feedback | content_type=`cv:feedback.rate` 的 Message |

### 3.2 四原语映射

| 原语 | CodeViber 应用 |
|------|---------------|
| **Role** | `cv:mentor`（提供指导）、`cv:learner`（请求指导）、`cv:coordinator`（管理） |
| **Arena** | Service Facade（external，服务入口）、Mentor Pool（internal，mentor 管理） |
| **Commitment** | response_sla：mentor 须在 5m 内回答；session_continuity：mentor 持续在线直到 close |
| **Flow** | Session Lifecycle：pending → active → closed；Escalation sub-flow：active → escalated → active |

---

## 4. 架构设计

### 4.1 Socialware 声明（v0.9.5 DSL）

```python
@socialware("code-viber")
class CodeViber:
    namespace = "cv"

    # ═══ Part B: 四原语声明 ═══

    roles = {
        "cv:mentor": Role(
            capabilities=capabilities("session.accept", "guidance.provide", "session.close"),
            description="提供编程指导的专家（人类或 Agent）",
        ),
        "cv:learner": Role(
            capabilities=capabilities("session.request", "question.ask", "feedback.rate", "session.close"),
            description="请求编程指导的学习者",
        ),
        "cv:coordinator": Role(
            capabilities=capabilities("mentor.assign", "mentor.revoke", "config.update"),
            description="管理 mentor 名单和服务策略",
        ),
    }

    session_lifecycle = Flow(
        subject="session.request",
        states=("pending", "active", "escalated", "closed", "expired"),
        transitions={
            ("pending",   "session.accept"):    "active",
            ("pending",   "session.timeout"):   "expired",
            ("active",    "question.ask"):      "active",
            ("active",    "guidance.provide"):  "active",
            ("active",    "session.close"):     "closed",
            ("active",    "session.escalate"):  "escalated",
            ("escalated", "guidance.provide"):  "active",
            ("escalated", "session.close"):     "closed",
        },
        preferences={
            "session.escalate": preferred_when("last_guidance.confidence < 0.5"),
        },
    )

    commitments = [
        Commitment(
            id="response_sla",
            between=("cv:mentor", "cv:learner"),
            obligation="Mentor must provide guidance after each question",
            triggered_by="cv:question.ask",
            deadline="5m",
            enforcement="escalate_to_human",
        ),
        Commitment(
            id="session_continuity",
            between=("cv:mentor", "session"),
            obligation="Mentor remains available until session is closed",
            triggered_by="cv:session.accept",
            expires="cv:session.close",
        ),
    ]

    arenas = [
        Arena(id="service_facade", boundary="external",
              purpose="外部可发现的编程指导服务入口"),
        Arena(id="mentor_pool", boundary="internal",
              purpose="Mentor 管理和分配"),
    ]

    # ═══ 组织管理逻辑 ═══

    @when("session.request")
    async def on_session_request(self, event, ctx: SocialwareContext):
        """找到可用 mentor 并通知。不实现任何 AI 逻辑。"""
        mentors = ctx.state.roles.find("cv:mentor", room=event.room_id)
        if not mentors:
            await ctx.fail("No mentor available in this room")
            return

        topic = event.body.get("topic", "general")
        await ctx.send("session.notify",
                       body={"learner": event.author, "topic": topic},
                       mentions=[m.entity_id for m in mentors])
        await ctx.succeed({"session_id": event.ref_id, "notified_mentors": len(mentors)})

    @when("guidance.provide")
    async def on_guidance(self, event, ctx: SocialwareContext):
        """检查是否需要 escalation。"""
        confidence = event.body.get("confidence", 1.0)
        if confidence < 0.5:
            other_mentors = [m for m in ctx.state.roles.find("cv:mentor", room=event.room_id)
                            if m.entity_id != event.author]
            if other_mentors:
                await ctx.send("_system.escalation",
                               body={"reason": "low_confidence", "confidence": confidence,
                                     "original_ref": event.ref_id},
                               target=ctx.state.flow_subject(event),
                               mentions=[m.entity_id for m in other_mentors])
```

### 4.2 content_type 注册表

| content_type | 语义 | required_capability | flow_trigger |
|-------------|------|--------------------:|-------------|
| `cv:session.request` | 请求编程指导 | `session.request` | 创建 Flow subject |
| `cv:session.notify` | 通知 mentor（系统生成） | — | — |
| `cv:session.accept` | mentor 接受 session | `session.accept` | pending → active |
| `cv:session.close` | 关闭 session | `session.close` | active/escalated → closed |
| `cv:question.ask` | 提出技术问题 | `question.ask` | 触发 response_sla |
| `cv:guidance.provide` | 提供指导回答 | `guidance.provide` | 兑现 response_sla |
| `cv:feedback.rate` | 评价指导质量 | `feedback.rate` | — |
| `cv:mentor.assign` | 分配 mentor Role | `mentor.assign` | — |
| `cv:mentor.revoke` | 撤回 mentor Role | `mentor.revoke` | — |
| `cv:_system.escalation` | 系统升级通知 | — | active → escalated |

### 4.3 与 AgentForge 的交互时序

```
Alice (learner)          CodeViber              AgentForge            @coding-bot
    │                        │                      │                      │
    │  /cv:request           │                      │                      │
    ├───────────────────────►│                      │                      │
    │                        │ find cv:mentor       │                      │
    │                        │ @mention             │                      │
    │                        ├──────────────────────┼─────────────────────►│
    │                        │                      │ detect @mention      │
    │                        │                      ├─────────────────────►│
    │                        │                      │ wake + build segment │
    │                        │                      │                      │
    │                        │ cv:session.accept    │                      │
    │                        │◄─────────────────────┼──────────────────────┤
    │                        │ Flow: pending→active │                      │
    │                        │                      │                      │
    │  cv:question.ask       │                      │                      │
    ├───────────────────────►│                      │                      │
    │                        │ Commitment: SLA 5m   │                      │
    │                        │ @mention mentor      │                      │
    │                        ├──────────────────────┼─────────────────────►│
    │                        │                      │ call LLM adapter     │
    │                        │                      │                      │
    │  cv:guidance.provide   │                      │                      │
    │◄──────────────────────┼──────────────────────┼──────────────────────┤
    │                        │ Commitment fulfilled │                      │
    │                        │                      │                      │
    │  /cv:close             │                      │                      │
    ├───────────────────────►│                      │                      │
    │                        │ Flow: active→closed  │                      │
```

**关键**：CodeViber 和 AgentForge 之间没有直接 API 调用。交互完全通过 Room 内的 Message + @mention。

### 4.4 ext.runtime.config 中的 staffing 策略

```yaml
ext.runtime:
  enabled: ["cv", "af"]
  config:
    cv:
      default_roles:
        "*": ["cv:learner"]
        "@bob:relay-a.example.com": ["cv:mentor", "cv:coordinator"]
      sla:
        response_time: "5m"
        escalation_threshold: 0.5
    af:
      role_staffing:
        "cv:mentor":
          prefer: "agent"
          template: "code-assistant"
          auto_spawn: true
```

AgentForge 读取 `role_staffing`，发现 `cv:mentor` 需要 Agent 填充，自动 spawn。此配置属于运营决策（`ext.runtime.config`），不属于 CodeViber 的 Socialware 声明（组织章程）。

---

## 5. Socialware 声明

### 5.1 Part A: 协议层约定

```yaml
protocol_convention:
  content_types:
    - type: "cv:session.request"
      body_schema: { topic: string, context?: string }
      required_capability: "session.request"
      flow_subject: true
    - type: "cv:session.accept"
      body_schema: {}
      required_capability: "session.accept"
      reply_to_type: "cv:session.request"
      flow_trigger: "pending → active"
    - type: "cv:question.ask"
      body_schema: { question: string, code?: string, language?: string }
      required_capability: "question.ask"
      reply_to_type: "cv:session.request"
    - type: "cv:guidance.provide"
      body_schema: { answer: string, code_example?: string, confidence?: float, references?: [string] }
      required_capability: "guidance.provide"
      reply_to_type: "cv:question.ask"
    - type: "cv:feedback.rate"
      body_schema: { rating: int(1-5), comment?: string }
      required_capability: "feedback.rate"
      reply_to_type: "cv:session.request"
    - type: "cv:session.close"
      body_schema: { reason?: string }
      required_capability: "session.close"
      flow_trigger: "active|escalated → closed"
    - type: "cv:_system.escalation"
      body_schema: { reason: string, confidence?: float, original_ref?: string }
      flow_trigger: "active → escalated"
```

### 5.2 Part C: UI Manifest

```yaml
ui_manifest:
  message_renderers:
    - content_type: "cv:session.*"
      renderer:
        card: { title: "Session: {body.topic}", badge: "{flow_state}" }
    - content_type: "cv:question.ask"
      renderer:
        card: { title: "Question", body: "{body.question}", code_block: "{body.code}" }
    - content_type: "cv:guidance.provide"
      renderer:
        card: { title: "Guidance", body: "{body.answer}", code_block: "{body.code_example}",
                confidence_bar: "{body.confidence}" }

  views:
    - id: "sw:cv:sessions"
      data_source: "state.flow_states WHERE flow == session_lifecycle"
      renderer:
        tab: { label: "Sessions", icon: "book-open" }
        list: { group_by: "state", sort: "created_at desc" }

  flow_renderers:
    - flow: "session_lifecycle"
      badge:
        pending: { color: "yellow", label: "Waiting" }
        active: { color: "green", label: "Active" }
        escalated: { color: "red", label: "Needs Human" }
        closed: { color: "gray", label: "Closed" }
        expired: { color: "gray", label: "Expired" }
      actions:
        - transition: "pending → active"
          button: { label: "Accept Session", visible_to: "role:cv:mentor" }
        - transition: "active → closed"
          button: { label: "Close Session", visible_to: "role:cv:mentor,cv:learner" }
```

---

## 6. EXT-15 Commands

| 命令 | 参数 | 所需 Role | 说明 |
|------|------|----------|------|
| `/cv:request` | `--topic`, `--context?` | `cv:learner` | 请求编程指导 |
| `/cv:close` | `--session?` | `cv:mentor`, `cv:learner` | 关闭当前 session |
| `/cv:mentors` | — | `cv:coordinator` | 列出当前 Room 的 mentor |
| `/cv:stats` | `--period?` | `cv:coordinator` | 查看指导统计 |

---

## 7. 安装与配置

### 7.1 manifest.toml

```toml
[socialware]
id = "code-viber"
name = "CodeViber"
namespace = "cv"
version = "0.1.0"

[declaration]
content_types = ["cv:session.request", "cv:session.accept", "cv:session.close",
                 "cv:session.notify", "cv:question.ask", "cv:guidance.provide",
                 "cv:feedback.rate", "cv:mentor.assign", "cv:mentor.revoke",
                 "cv:_system.escalation"]
roles = ["cv:mentor", "cv:learner", "cv:coordinator"]
flows = ["session_lifecycle"]

[commands]
request = { params = ["topic", "context?"], role = "cv:learner" }
close = { params = ["session?"], role = "cv:mentor,cv:learner" }
mentors = { params = [], role = "cv:coordinator" }
stats = { params = ["period?"], role = "cv:coordinator" }

[dependencies]
extensions = ["EXT-04", "EXT-06", "EXT-15", "EXT-17"]
socialware = ["event-weaver"]
```

### 7.2 目录结构

```
ezagent/socialware/code-viber/
├── manifest.toml
├── codeviber.py              # Socialware 声明 + @when handlers
└── checkpoint.bin            # State Cache 检查点（可选）
```

---

## 8. 错误码

| Code | 含义 |
|------|------|
| `CV_NO_MENTOR` | Room 中没有可用的 cv:mentor |
| `CV_SESSION_EXISTS` | Learner 已有一个 active session |
| `CV_SESSION_NOT_FOUND` | 指定 session 不存在 |
| `CV_SESSION_CLOSED` | Session 已关闭 |
| `CV_SLA_BREACH` | Mentor 响应超时 |

---

## 9. 设计验证

### 9.1 验证"组织设计师"范式

CodeViber 的 `codeviber.py` 中：
- **零行 AI 逻辑**：没有 LLM 调用、没有 prompt 构建、没有 embedding
- **全部是组织管理**：查找 mentor、@mention 通知、检查 SLA、触发 escalation
- **代码量极少**：约 50 行 Python（两个 `@when` handler）

### 9.2 验证 Socialware 间协作

CodeViber 与 AgentForge 的协作：
- **零直接 API 调用**：CodeViber 不 import AgentForge
- **协作媒介**：Room + Message + @mention
- **AgentForge 不可见**：从 CodeViber 视角，@coding-bot 只是一个持有 cv:mentor Role 的 Identity

### 9.3 验证类型级层级约束

CodeViber 的 `@when` handler 接收 `SocialwareContext`：
- ✅ `ctx.send("session.notify", body=..., mentions=[...])`
- ✅ `ctx.state.roles.find("cv:mentor", room=...)`
- ✅ `ctx.succeed(result)` / `ctx.fail(error)`
- ❌ `ctx.messages.send(content_type=...)` — 类型上不存在
- ❌ `ctx.hook.register(...)` — 类型上不存在

---

## 10. 实施路线

| 阶段 | 内容 | 依赖 |
|------|------|------|
| Phase A | Session lifecycle + mentor 通知 + @when handler | EXT-15, EXT-17, EventWeaver |
| Phase B | Commitment SLA + escalation + confidence-based HiTL | Phase A |
| Phase C | Feedback + 统计 + UI Tab 渲染 | Phase B |
| Phase D | ext.runtime.config staffing 策略 + AgentForge 自动匹配 | Phase C + AgentForge |

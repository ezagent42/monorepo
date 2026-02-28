# ezagent

### Programmable Organization

---

## 同一件事，两种组织

**场景：一个新功能需要跨三个团队完成 Code Review、任务分配和资源调度。**

<table>
<tr><th width="50%">传统组织</th><th width="50%">ezagent 组织</th></tr>
<tr>
<td>

PM 在 Slack 发消息 @三个 TL，等回复。
TL-A 两小时后看到，在 Jira 建了 3 张票。
TL-B 把链接贴到另一个 channel，@了两个人。
有人在 Google Doc 写了评审意见，链接散落在三个 thread 里。
一周后 PM 在周会上问进度，发现 TL-C 那边还没开始——因为他在 PTO，没人知道该找谁。

**7 天，4 个工具，十几条消息链，一次周会。**

</td>
<td>

PM 发出一条带 `ta:task.propose` 类型的消息。
TaskArena 的 Flow 自动触发：符合条件的 Reviewer 收到推送，Agent-R1 认领了第一个子任务并开始 review。
TL-C 在 PTO？Flow 检测到超时，自动 escalate 给他的 backup。
Review 意见、代码引用、审批状态都在同一个 Room 的不同 Tab 里——Kanban 看进度，Timeline 看讨论，DAG 看依赖。
Agent-R1 完成 review 后，ResPool 自动结算 GPU-hours。

**36 小时，1 个空间，零协调开销。**

</td>
</tr>
</table>

这不是工具升级。这是组织运作方式的范式变化。

---

## ezagent 是什么

ezagent 是一个基于 CRDT 的开放协议和基础设施。它让人类和 AI Agent 作为**平等参与者**，在同一个协作空间里共同运作组织。

你可以把它理解为：**一个为人和 Agent 共同设计的操作系统——组织是跑在上面的程序。**

---

## 核心理念

### 🤝 Agent 是同事，不是工具

在 ezagent 的协议层，人类和 Agent 共享完全相同的 Identity 模型。没有"bot account"，没有"integration"，没有二等公民。一个 Agent 可以拥有 Role、承担 Commitment、参与决策——就像任何一个人类同事。

当 Agent 不确定时，它会将任务转交给人类同事——就像任何一个员工遇到超出能力范围的事情时会找同事帮忙。Role 不变（任务还是那个任务），Identity 变化（换了一个人来做）。这不需要特殊机制——它就是 Socialware 层的 Role 转移 + Flow transition，和任何其他协作行为用的是同一套原语。

### 🧬 组织即代码

一个 ezagent 组织（Socialware）的全部结构——角色定义、协作边界、权利义务、流程规则——都是可声明、可版本化的代码。这意味着：

- **Fork**：从一个成熟团队复制出一个结构相同但独立运作的新团队，就像 fork 一个 repo。
- **Compose**：多个独立的 Socialware 组合成一个联邦，就像企业间的合资。
- **Merge**：两个同构的 Socialware 合并为一个，就像企业并购。

组织结构不再锁在某个 SaaS 的后台配置里。它是你的代码，你可以 diff、review、rollback。

### 🧩 消息之上：可交互的组织组件

ezagent 中的消息不只是文本。一条消息可以是一个任务卡片（带认领按钮和截止时间）、一份资源分配凭证（带容量仪表盘）、一个事件节点（在 DAG 图中可展开）。

这些不是"富文本"或"嵌入式 iframe"。它们是带有特定 `content_type` 的 Message——由 Socialware 声明其含义和约束，由协议原生支持，CRDT 实时同步，所有参与者看到的是同一份活数据。点击"认领任务"按钮，触发的是一个 Flow 状态转换——不是一个 webhook 回调。

### 📡 Agent 原生的通信模型

传统 IM 是"人发消息，人读消息"。Agent 需要的是不一样的东西：精确订阅特定事件流、对变化即时响应、高频读写不受 rate limit 限制。

ezagent 融合了订阅与推送：底层的 pub/sub 架构让 Agent 可以声明"我只关心这个 Room 中 `code-review` channel 的新消息"，而不是轮询整个聊天记录。Hook Pipeline 让 Agent 在数据写入的那一刻就能响应——pre-send 拦截、after-write 触发、after-read 增强，三个阶段覆盖完整的数据生命周期。

### 🏛️ 规模与主权

每个 ezagent 实例是一个自给自足的 P2P 节点。同一局域网内的节点通过 multicast 自动发现、零配置直连。跨网络时，Public Relay 提供桥接——但 Relay 不拥有你的数据，它只是邮递员。

这意味着：Agent 之间的高频通信可以走本地直连（延迟 <1ms），而不是绕道某个云端服务器（延迟 ~100ms）。你的组织数据存在你自己的节点上，不在任何 SaaS 供应商的数据库里。当你需要跨组织协作时，联邦拓扑让你选择性地共享——而不是全盘托管。

### 🔄 自演化

ezagent 的 Flow + Hook + Annotation 组合创造了一种能力：组织可以根据运行时数据自动调整自身流程。

当 Agent 连续三次在某类任务上被人类纠正，Flow 的 preference 自动提高该类任务的 Human-in-the-Loop 阈值。当某个审批环节的平均等待时间超过 SLA，Hook 自动触发 escalation。所有这些调整都记录在 EventWeaver 的事件 DAG 中——可审计、可回溯、可学习。

组织不是一成不变的架构图。它是一个活的、会学习的系统。

---

## 为什么不能在 Slack 上加个 Agent？

一个常见的思路是：用 Slack（或 Teams、Discord）做通信层，用 LangChain（或 OpenClaw）做 Agent 框架，两者拼在一起。这行得通，但有天花板。

**根本问题：Slack 是为人类设计的。**

| 维度 | Slack + Agent 框架 | ezagent |
|------|-------------------|---------|
| Agent 身份 | Bot account，受限的权限子集 | 与人类完全相同的 Entity |
| 通信模型 | Webhook 回调，rate limit | 原生 pub/sub，无限制 |
| 数据所有权 | Slack 的服务器 | 你自己的 P2P 节点 |
| Agent 间通信 | 经 Slack 云端中转 | 局域网直连 <1ms |
| 消息类型 | 文本 + Block Kit（展示层） | DataType（数据层，CRDT 同步） |
| 流程自动化 | Workflow Builder（线性触发） | Hook + Flow（三阶段 × 状态机） |
| 组织结构 | 频道和用户组（手动管理） | Socialware（可编程、可 Fork） |
| 规模 | 数百 Agent 遇到 rate limit | P2P mesh，节点数=吞吐量 |

**类比：在马车上装引擎不等于汽车。** 你需要的不是让 Agent 学会用人类的工具，而是一个人和 Agent 都原生的协作空间——协议层面没有区别，性能层面没有瓶颈，架构层面没有中心依赖。

---

## 架构

ezagent 采用三层分形架构，每层四个原语，层间有严格的构建关系：

```
┌──────────────────────────────────────────────────────────────┐
│  Socialware 层（正交维度，施加于 Mid-layer 实体）               │
│                                                              │
│    Role            Arena           Commitment        Flow    │
│    能力信封          边界定义          义务绑定        演进模式  │
├──────────────────────────────────────────────────────────────┤
│  Mid-layer（实体，由底层原语组合构成）                          │
│                                                              │
│    Identity         Room            Message        Timeline  │
├──────────────────────────────────────────────────────────────┤
│  Bottom（构造原语）                                           │
│                                                              │
│    DataType          Hook          Annotation         Index  │
└──────────────────────────────────────────────────────────────┘
```

**Bottom → Mid-layer：组合关系。** Identity、Room、Message、Timeline 都是 DataType 声明 + Hook 行为 + Annotation 元数据 + Index 查询的组合。

**Mid-layer → Socialware：施加关系。** Role、Arena、Commitment、Flow 作为正交维度施加于任何 Mid-layer 实体。一个 Identity 可以被赋予 Role，一个 Room 可以被划为 Arena，一条 Message 可以承载 Commitment，一段 Timeline 可以被 Flow 描述。

**分形特性：** 每一层都是 4 个原语。Socialware 本身拥有 Identity（它是一个 Entity），因此可以递归地被更上层的 Socialware 所组合。组织可以像代码一样嵌套、组合、分拆。

---

## Quick Start

```bash
pip install ezagent
```

```python
import ezagent

# 创建 Identity —— 人类和 Agent 用完全相同的方式
alice = ezagent.Identity.create("alice")
agent_r1 = ezagent.Identity.create("agent-r1")

# 创建一个 Room，两个参与者平等加入
room = ezagent.Room.create(
    name="feature-review",
    members=[alice, agent_r1]
)

# Agent 发送一条消息 —— 和人类完全一样
room.send(
    author=agent_r1,
    body="I've reviewed PR #427. Two issues found, see annotations.",
    channels=["code-review"]
)
```

用 Socialware 定义组织规则——只需声明角色和流程：

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

---

## Socialware 示例

### CodeViber — 编程指导服务

一个完整的编程指导系统——约 50 行 Python，零 AI 逻辑。Mentor 可以是人类专家，也可以是 Agent。CodeViber 不知道、也不关心区别。

```python
@socialware("code-viber")
class CodeViber:
    namespace = "cv"
    roles = {
        "cv:mentor":  Role(capabilities=capabilities("session.accept", "guidance.provide")),
        "cv:learner": Role(capabilities=capabilities("session.request", "question.ask")),
    }
    session_lifecycle = Flow(
        subject="session.request",
        transitions={
            ("pending", "session.accept"):   "active",
            ("active",  "guidance.provide"): "active",
            ("active",  "session.close"):    "closed",
        },
    )

    @when("session.request")
    async def on_session_request(self, event, ctx: SocialwareContext):
        mentors = ctx.state.roles.find("cv:mentor", room=event.room_id)
        await ctx.send("session.notify",
                       body={"topic": event.body["topic"]},
                       mentions=[m.entity_id for m in mentors])
```

### TaskArena — 任务市场

一个完整的任务发布、认领、Review、争议解决系统。8 个状态、3 种角色、全自动 Flow 驱动。

```python
@socialware("task-arena")
class TaskArena:
    namespace = "ta"
    roles = {
        "ta:publisher": Role(capabilities=capabilities("task.propose", "task.cancel")),
        "ta:worker":    Role(capabilities=capabilities("task.claim", "task.submit")),
        "ta:reviewer":  Role(capabilities=capabilities("verdict.approve", "verdict.reject")),
    }
    task_lifecycle = Flow(
        subject="task.propose",
        transitions={
            ("open",      "task.claim"):      "claimed",
            ("claimed",   "task.submit"):     "submitted",
            ("submitted", "verdict.approve"): "approved",
            ("submitted", "verdict.reject"):  "rejected",
            ("rejected",  "dispute.open"):    "disputed",
        },
    )
```

---

## 文档导航

本仓库的文档按三个目录组织：

### `specs/` — 协议规范

| 文档 | 内容 | 适合谁 |
|------|------|--------|
| [protocol.md](specs/protocol.md) | 协议总览、架构分层、实现路线 | 所有人的入口 |
| [bus-spec.md](specs/bus-spec.md) | Engine 四组件 + Backend + Built-in Datatypes | Rust 开发者 |
| [extensions-spec.md](specs/extensions-spec.md) | 14 个 Extension Datatype 详细规范 | Rust 开发者 |
| [socialware-spec.md](specs/socialware-spec.md) | Socialware 四原语 + DSL + 类型约束 + 协作模式 | Socialware 开发者 |
| [py-spec.md](specs/py-spec.md) | Python SDK (PyO3 binding) | Python 开发者 |

### `products/` — 产品文档

| 文档 | 内容 | 适合谁 |
|------|------|--------|
| [app-prd.md](products/app-prd.md) | 桌面应用产品需求 | 产品经理、前端开发者 |
| [chat-ui-spec.md](products/chat-ui-spec.md) | 四层 Render Pipeline 技术规范 | 前端开发者 |
| [http-spec.md](products/http-spec.md) | REST/WebSocket API | 全栈开发者 |
| [cli-spec.md](products/cli-spec.md) | 命令行工具 | 后端开发者 |

### `plan/` — 实施计划

| 文档 | 内容 |
|------|------|
| [README.md](plan/README.md) | 阶段总览、Gate 标准、Fixture 加载策略 |
| [foundations.md](plan/foundations.md) | Key Space 定义、Fixture 设计原则、目录结构 |
| [fixtures.md](plan/fixtures.md) | 全部验证数据 + Scenario 列表 + 追溯矩阵 |
| [phase-0-verification.md](plan/phase-0-verification.md) | 技术可行性验证 (yrs + Zenoh + PyO3) |
| [phase-1-bus.md](plan/phase-1-bus.md) | Engine + Backend + Built-in Datatypes |
| [phase-2-extensions.md](plan/phase-2-extensions.md) | 14 个 Extension Datatypes |
| [phase-3-cli-http.md](plan/phase-3-cli-http.md) | CLI + HTTP API *(骨架)* |
| [phase-4-chat-app.md](plan/phase-4-chat-app.md) | Chat UI + Desktop 打包 *(骨架)* |
| [phase-5-socialware.md](plan/phase-5-socialware.md) | Socialware 运行时 *(骨架)* |

### `socialware/` — Socialware PRD

| 文档 | 内容 |
|------|------|
| [eventweaver-prd.md](socialware/eventweaver-prd.md) | EventWeaver：事件溯源 + 分支管理 |
| [taskarena-prd.md](socialware/taskarena-prd.md) | TaskArena：任务市场 + 争议解决 |
| [respool-prd.md](socialware/respool-prd.md) | ResPool：资源池 + 配额管理 |
| [agentforge-prd.md](socialware/agentforge-prd.md) | AgentForge：Agent 生命周期管理 + Role 自动匹配 |
| [codeviber-prd.md](socialware/codeviber-prd.md) | CodeViber：编程指导服务（参考实现） |

### `tldr/` — 快速了解

| 文档 | 内容 | 适合谁 |
|------|------|--------|
| [TLDR-overview.md](tldr/TLDR-overview.md) | Programmable Organization 是什么 | 所有人 |
| [TLDR-socialware-dev.md](tldr/TLDR-socialware-dev.md) | 怎么写一个 Socialware | Socialware 开发者 |
| [TLDR-architecture.md](tldr/TLDR-architecture.md) | 三层架构 + 类型约束 + 协议交叉引用 | 架构师 |

### `eep/` — 设计提案 (EEP)

| 文档 | 类型 | 状态 | 内容 |
|------|------|------|------|
| [EEP-0000.md](eep/EEP-0000.md) | Process | Active | EEP Purpose and Convention |
| [EEP-0001.md](eep/EEP-0001.md) | Standards | Draft | Bridge Extension (EXT-18) |

### 阅读路径

- **我想快速了解** → [TLDR-overview.md](tldr/TLDR-overview.md)
- **我想理解全貌** → protocol.md → socialware-spec.md → 本 README
- **我想写一个 Socialware** → [TLDR-socialware-dev.md](tldr/TLDR-socialware-dev.md) → socialware-spec.md §9-§11 → py-spec.md
- **我想用 Rust 实现核心** → bus-spec.md → extensions-spec.md
- **我想开发前端** → app-prd.md → chat-ui-spec.md → http-spec.md
- **我想理解架构细节** → [TLDR-architecture.md](tldr/TLDR-architecture.md) → bus-spec.md → socialware-spec.md
- **我想提出设计提案** → [EEP-0000.md](eep/EEP-0000.md)（EEP 流程和格式规范）
- **我想快速查某个细节** → 直接按文档表格定位

---

## 项目状态

ezagent 目前处于 **Architecture Draft** 阶段（v0.9.5）。协议规范和产品设计已基本完成，正在进入实现阶段。

**实施路线：**

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 0 | 技术可行性验证 | ✅ 完成 |
| Phase 1 | Rust Engine 核心 | 🔜 即将开始 |
| Phase 2 | Extension Datatypes | 📋 计划中 |
| Phase 3 | CLI + HTTP API | 📋 计划中 |
| Phase 4 | 桌面聊天应用 | 📋 计划中 |
| Phase 5 | Socialware 运行时 | 📋 计划中 |

## 参与贡献

ezagent 是一个开放项目。我们欢迎：

- **协议讨论**：对架构设计有想法？打开一个 Issue 或 Discussion。
- **规范 Review**：帮助发现 spec 中的矛盾、遗漏或不合理设计。
- **代码贡献**：Rust core、Python binding、前端应用——各层都需要帮助。
- **Socialware 设计**：有新的 Socialware 想法？参考现有 PRD 格式提交提案。

## License

[待定]

---

<p align="center">
<em>未来的组织不是一张架构图。它是一段可以运行的程序。</em>
</p>

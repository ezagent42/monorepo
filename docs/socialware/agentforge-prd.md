# AgentForge — Product Requirements Document v0.1

> **状态**：Draft
> **日期**：2026-02-26
> **前置文档**：ezagent-socialware-spec-v0.9.1, ezagent-extensions-spec-v0.9.1 (EXT-15 Command)
> **定位**：平台基础设施级 Socialware

---

## 1. 产品概述

### 1.1 产品定位

AgentForge 是 ezagent 平台的 **Agent 生命周期管理器**。它提供 Agent 的模板注册、实例创建（Spawn）、生命周期管理、资源控制和协作编排能力。

AgentForge 不自己实现任何 AI 能力——它是一个编排层，通过 **Adapter 模式** 将外部 Agent 能力（Claude Code、Gemini CLI、自定义 LLM 等）桥接到 ezagent 协议中，使 Agent 成为与人类完全平等的协作参与者。

### 1.2 核心价值

**Agent 即同事**：通过 AgentForge 创建的 Agent 拥有完整的 ezagent Identity，可以被赋予 Role、加入 Room、发送 Message、承担 Commitment——和人类用户完全一样。

**Stateless Per-Message**：每条 @mention 消息 = 一次 Agent 调用。Room 历史就是 Agent 的"记忆"。无需 session 管理，天然支持并发。

**模板化创建**：预定义 Agent 模板（code-reviewer、task-worker、security-auditor...），一行命令即可 Spawn 新 Agent。

**资源可控**：API 预算、并发限制、沙箱路径——所有资源约束通过配置声明。

### 1.3 用户角色

| 角色 | 典型用户 | 核心需求 |
|------|---------|---------|
| Forge Admin | 平台管理员 | 管理 Agent 模板和全局策略 |
| Forge Operator | 团队负责人 | Spawn/Destroy Agent 实例 |
| Collaborator | 任何 Room 成员 | 通过 @mention 与 Agent 交互 |
| Agent（自身） | 由 AgentForge 管理的 Agent 实例 | 接收任务、执行、返回结果 |

---

## 2. 使用场景

### 场景 1：创建 Code Review Agent

**背景**：团队希望在 code-review channel 中有一个 Agent 自动审查 PR。

**流程**：

1. Operator 在 Room 中输入 `/af:spawn --template code-reviewer --name "Review-Bot"`
2. AgentForge 验证 Operator 持有 `af:operator` Role
3. AgentForge 创建 Agent Identity `@review-bot:relay-a.example.com`
4. 加载 `code-reviewer` 模板：Adapter = claude-code, model = sonnet, 允许的 tools = Read + Search
5. Agent 加入当前 Room，Profile 显示为 "Review-Bot (Agent, Code Reviewer)"
6. 当有人在 Room 中 @Review-Bot 或在 code-review channel 发消息时，AgentForge 自动唤醒 Agent 处理

### 场景 2：Agent 接收并处理任务

**背景**：Alice 想让 Review-Bot 审查一个 PR。

**流程**：

1. Alice 发送：`@Review-Bot check PR #501 for SQL injection risks`
2. AgentForge 检测到 @mention，构建 Conversation Segment：
   - 从 @mention 回溯 Reply chain / Thread / Channel
   - 附加 Room 成员列表和 Role 信息
   - 组装为 Agent 的 system prompt + context messages
3. AgentForge 调用 ClaudeCodeAdapter：
   - 发送结构化 prompt 到 Anthropic API
   - 流式接收 Agent 输出
4. Agent 输出通过 EXT-01 Mutable Content 实时更新到 Room
5. 处理完成后，AgentForge 写入 command_result（如果是命令触发）

### 场景 3：Agent 睡眠与自动唤醒

**背景**：Review-Bot 空闲超过 1 小时。

**流程**：

1. AgentForge 检测到 idle_timeout（1h），将 Review-Bot 状态设为 SLEEPING
2. Agent 进程被释放（不消耗资源）
3. 两天后，Bob 在 Room 中 @Review-Bot
4. AgentForge 检测到 @mention，自动唤醒 Agent（SLEEPING → ACTIVE）
5. Agent 正常处理消息

**核心 UX 原则：@mention 是万能的。用户不需要知道 Agent 的状态。**

### 场景 4：多 Agent 协作 Pipeline

**背景**：一个代码变更需要经过 coding → review → testing 三步。

**流程**：

1. Alice 发布任务，AgentForge 分配给 @coder-bot
2. @coder-bot 完成编码，输出提交到 Room
3. Flow transition 触发：TaskArena 将任务状态从 `coding` → `in_review`
4. AgentForge 自动分配给 @reviewer-bot
5. @reviewer-bot 审查通过 → 状态转为 `testing`
6. AgentForge 分配给 @tester-bot
7. 全流程自动完成，Alice 只需在最终结果不满意时介入

---

## 3. 概念溯源

### 3.1 概念分解表

| AgentForge 概念 | 分解为 |
|----------------|--------|
| Agent Template | content_type=`af:template.register` 的 Message |
| Agent Instance | Identity (ezagent) + State Cache 中的实例状态 |
| Agent Status | State Cache 中从 af:* Message 序列派生的状态（CREATED/ACTIVE/SLEEPING/DESTROYED） |
| Spawn 操作 | EXT-15 Command (`/af:spawn`) → content_type=`af:instance.spawn` Message → Flow transition |
| Destroy 操作 | EXT-15 Command (`/af:destroy`) → content_type=`af:instance.destroy` Message → Flow transition |
| Conversation Segment | Timeline 查询 + Reply chain 回溯（使用 EXT-04, EXT-06, EXT-11） |
| Agent Workspace | `ezagent/socialware/agent-forge/agents/{agent_name}/` 本地目录 |

### 3.2 四原语映射

| 原语 | AgentForge 应用 |
|------|----------------|
| **Role** | `af:admin`（管理模板和策略）、`af:operator`（Spawn/Destroy）、`af:agent`（Agent 自身，标记为 Agent Identity） |
| **Arena** | Agent Registry Arena（internal，Agent 模板和实例管理）、Agent Workspace Arena（internal，Agent 本地配置） |
| **Commitment** | Agent ↔ Room：Agent 承诺在指定 Room 中响应 @mention；Agent ↔ Operator：Agent 遵守资源配额 |
| **Flow** | Agent Lifecycle Flow：CREATED → ACTIVE ⇄ SLEEPING → DESTROYED |

---

## 4. 架构设计

### 4.1 核心组件

```
┌─ AgentForge Socialware ──────────────────────────────────────────┐
│                                                                   │
│  ┌─ Template Registry ─┐  ┌─ Instance Manager ─┐                │
│  │ 模板注册和发现        │  │ Agent 生命周期管理   │                │
│  └─────────────────────┘  └────────────────────┘                │
│                                                                   │
│  ┌─ Agent Bridge ──────────────────────────────────────────┐     │
│  │  ┌─ Context Builder ─┐  ┌─ Adapter Dispatcher ─┐       │     │
│  │  │ Conversation       │  │ 选择并调用适配器      │       │     │
│  │  │ Segment 构建       │  │                      │       │     │
│  │  └──────────────────┘  └──────────────────────┘       │     │
│  │                                                         │     │
│  │  ┌─ Adapters ──────────────────────────────────┐       │     │
│  │  │ ClaudeCodeAdapter │ GeminiAdapter │ Custom  │       │     │
│  │  └────────────────────────────────────────────┘       │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                   │
│  ┌─ Resource Guard ────┐  ┌─ Cooperation Engine ─┐              │
│  │ 配额/并发/预算控制    │  │ Pipeline/Ensemble    │              │
│  └─────────────────────┘  └────────────────────────┘              │
└───────────────────────────────────────────────────────────────────┘
```

### 4.2 Agent Adapter Protocol

所有 Agent 适配器实现统一的 Adapter Protocol：

```python
class AgentAdapter(Protocol):
    async def handle_message(
        self,
        message: AgentMessage,
        context: AgentContext
    ) -> AsyncIterator[AgentChunk]:
        """处理一条消息，流式返回结果"""
        ...

    async def handle_tool_result(
        self,
        tool_use_id: str,
        result: Any
    ) -> AsyncIterator[AgentChunk]:
        """处理工具调用结果（仅 API-based Adapter 使用）"""
        ...

    def capabilities(self) -> AgentCapabilities:
        """声明 Adapter 能力"""
        ...
```

AgentMessage / AgentContext / AgentChunk 定义：

```python
@dataclass
class AgentMessage:
    content: str                          # 用户消息内容
    author: str                           # 发送者 Entity ID
    room_id: str                          # Room ID
    ref_id: str                           # 触发消息的 Ref ID
    command: Optional[CommandInfo] = None  # 如果是命令触发

@dataclass
class AgentContext:
    segment: list[ContextMessage]         # Conversation Segment
    room_members: list[MemberInfo]        # Room 成员列表（含 Role）
    working_dir: Optional[str] = None     # 工作目录（沙箱）
    system_prompt: str = ""               # soul.md 内容
    max_tokens: int = 4096               # 最大输出 token

@dataclass
class AgentChunk:
    type: str      # "text" | "tool_use" | "tool_result" | "done" | "error"
    content: Any   # 根据 type 不同而不同
```

### 4.3 Conversation Segment 构建

Conversation Segment 是从 Room 历史中提取的、与当前请求相关的逻辑上下文窗口。

**三层上下文构建**：

| 层 | 来源 | 优先级 |
|----|------|--------|
| Segment | 从 @mention 回溯：Thread → Reply chain → 同 Channel 近期消息 | 最高 |
| Attached | 用户在 @mention 中显式附加的文件/消息引用 | 中 |
| Memory | EventWeaver 提供的长期记忆（Phase B） | 最低 |

**构建算法**：

```python
def build_segment(trigger_message, room_history, config):
    segment = []

    # 1. 如果在 Thread 中，Thread 就是 Segment
    if trigger_message.thread_id:
        segment = room_history.get_thread(trigger_message.thread_id)
        return trim_to_budget(segment, config.max_context_tokens)

    # 2. 回溯 reply_to 链
    chain = trace_reply_chain(trigger_message, room_history)
    segment.extend(chain)

    # 3. 如果 Segment 不足，补充同 Channel 近期消息
    if len(segment) < config.min_context_messages:
        channel = trigger_message.channels[0] if trigger_message.channels else None
        recent = room_history.get_recent(
            channel=channel,
            limit=config.max_context_messages - len(segment)
        )
        segment.extend(recent)

    return trim_to_budget(segment, config.max_context_tokens)
```

**Token 节省效果**：相比"最近 N 条消息"，Conversation Segment 节省 60-80% token，且响应质量更高。

### 4.4 Agent Lifecycle Flow

```
                 spawn              idle_timeout
    CREATED ──────────→ ACTIVE ←──────────→ SLEEPING
                          │                     ↑
                          │    @mention         │
                          │    auto_wake        │
                          │                     │
                          ▼        destroy      │
                       DESTROYED ←──────────────┘
```

| Transition | 触发条件 | 动作 |
|-----------|---------|------|
| CREATED → ACTIVE | `/af:spawn` 命令 | 创建 Identity, 加入 Room, 注册 Hook |
| ACTIVE → SLEEPING | idle_timeout 超时 | 释放 Adapter 进程/连接 |
| SLEEPING → ACTIVE | @mention 或 Hook 事件 | 重建 Adapter, 恢复 Identity |
| ACTIVE → DESTROYED | `/af:destroy` 命令 | 注销 Hook, 退出 Room, 归档 Identity |
| SLEEPING → DESTROYED | `/af:destroy` 命令 | 归档 Identity |

**关键设计：Agent Identity（持久）≠ Agent Process（临时）。** Identity 存在于协议层（CRDT），进程是本地运营细节。

---

## 5. Bus 层声明（Part A）

### 5.1 DataTypes

#### af:template.register body schema

Agent 模板定义。

```yaml
# af:template.register Message body:
  content_type: immutable
  schema:
    id:               string          # 模板 ID
    name:             string          # 人类可读名称
    adapter:          string          # Adapter 类型（"claude-code" | "gemini" | "custom"）
    config:                           # Adapter 默认配置
      model:          string          # 模型名
      allowed_tools:  [string]        # 允许的工具
      max_tokens:     integer         # 最大输出 token
    default_role:     string          # 默认 Socialware Role
    soul_template:    string          # System prompt 模板（Markdown）
    description:      string          # 模板描述
```

#### af_instance (State Cache)

Agent 实例状态。从 `af:instance.*` content_type Message 序列纯派生，存储在 State Cache 中。

**不再是 Datatype doc**——所有状态变更通过发送 Message 记录。

```yaml
# State Cache 中的 Agent 实例信息（从 Message 序列重建）
af_instance_state:
  agent_name:     string              # 从 af:instance.spawn body 获取
  template_id:    string              # 从 af:instance.spawn body 获取
  status:         enum                # 从最近的 af:instance.* Message 推导
                                      # CREATED | ACTIVE | SLEEPING | DESTROYED
  rooms:          [string]            # 从 af:instance.join/leave 序列计算
  config:                             # 从 af:instance.spawn + af:instance.configure 合并
    model:        string
    working_dir:  string
    sandbox:      [{path, access}]
  limits:
    max_concurrent:     integer
    max_context_messages: integer
    max_context_tokens:   integer
    api_budget_daily:     integer
  lifecycle:
    auto_start:         boolean
    idle_timeout:       string
    auto_wake_on_mention: boolean
  created_at:     datetime            # af:instance.spawn Message 的 created_at
  last_active_at: datetime            # 最近一次 af:* Message 的时间
```

### 5.2 Hooks

| Hook | Phase | Trigger | Priority | 说明 |
|------|-------|---------|----------|------|
| `af.on_command` | after_write | `ext.command.ns == 'af'` | 110 | 处理 AgentForge 命令（spawn, destroy, list...） |
| `af.on_mention` | after_write | `timeline_index.insert` + body 含 @agent 引用 | 105 | 检测 @mention，构建 Segment，调用 Adapter |
| `af.auto_wake` | after_write | `timeline_index.insert` + 目标 Agent 为 SLEEPING | 104 | 自动唤醒沉睡的 Agent |
| `af.idle_check` | periodic | 每 5 分钟检查 | 100 | 检测 idle_timeout，ACTIVE → SLEEPING |
| `af.resource_guard` | pre_send | `ext.command.ns == 'af'` 相关操作 | 101 | 检查资源配额（并发数、API 预算） |

### 5.3 Indexes

| Index | 说明 | operation_id |
|-------|------|-------------|
| `agent_template_list` | 所有已注册的 Agent 模板 | `af.list_templates` |
| `agent_instance_list` | 所有 Agent 实例及其状态 | `af.list_agents` |
| `agent_activity` | Agent 最近活动日志 | `af.activity_log` |

---

## 6. Socialware 层声明（Part B）

### 6.1 Roles

| Role ID | 赋予 | 能力 |
|---------|------|------|
| `af:admin` | 平台管理员 | 管理模板、设置全局策略、查看所有 Agent |
| `af:operator` | 团队负责人 | Spawn/Destroy Agent、配置 Agent |
| `af:agent` | Agent Identity | 接收任务、发送消息、使用工具 |

### 6.2 Arenas

| Arena | Boundary | 说明 |
|-------|----------|------|
| `af:registry` | internal | Agent 模板和实例管理区 |
| `af:workspace` | internal | Agent 本地配置和运行时数据 |

### 6.3 Commitments

| Commitment | Between | Obligation |
|-----------|---------|------------|
| `af:respond_on_mention` | Agent ↔ Room | Agent 在 auto_wake_on_mention=true 时承诺响应 @mention |
| `af:obey_limits` | Agent ↔ Operator | Agent 遵守配置的资源限制 |
| `af:report_status` | Agent ↔ AgentForge | Agent 向 AgentForge 报告状态变化 |

### 6.4 Flows

#### Agent Lifecycle Flow

```yaml
flow:
  id: "agent_lifecycle"
  subject: "Identity with role af:agent"
  states: ["created", "active", "sleeping", "destroyed"]
  transitions:
    created → active:
      trigger: "af:spawn command executed"
      action: "create identity, join rooms, register hooks"
    active → sleeping:
      trigger: "idle_timeout exceeded"
      action: "release adapter process"
    sleeping → active:
      trigger: "@mention detected OR af:wake command"
      action: "rebuild adapter, restore identity"
    active → destroyed:
      trigger: "af:destroy command executed"
      action: "unregister hooks, leave rooms, archive identity"
    sleeping → destroyed:
      trigger: "af:destroy command executed"
      action: "archive identity"
  preferences:
    sleeping → active: preferred_when("auto_wake_on_mention == true AND @mention detected")
```

---

## 7. EXT-15 Commands

AgentForge 注册以下命令（命名空间 `af`）：

| 命令 | 参数 | 所需 Role | 说明 |
|------|------|----------|------|
| `/af:spawn` | `--template`, `--name`, `--rooms?` | `af:operator` | 创建 Agent 实例 |
| `/af:destroy` | `--name` | `af:operator` | 销毁 Agent 实例 |
| `/af:list` | `--status?` | `af:operator` | 列出 Agent 实例 |
| `/af:wake` | `--name` | `af:operator` | 手动唤醒 Agent |
| `/af:sleep` | `--name` | `af:operator` | 手动休眠 Agent |
| `/af:config` | `--name`, `--key`, `--value` | `af:admin` | 修改 Agent 配置 |
| `/af:templates` | — | `af:operator` | 列出可用模板 |
| `/af:register-template` | `--id`, `--adapter`, `--config` | `af:admin` | 注册新模板 |

command_manifest Annotation 示例：

```json
{
  "ns": "af",
  "commands": [
    {
      "action": "spawn",
      "description": "创建新的 Agent 实例",
      "params": [
        { "name": "template", "type": "string", "required": true, "description": "模板 ID" },
        { "name": "name", "type": "string", "required": true, "description": "Agent 名称" },
        { "name": "rooms", "type": "string", "required": false, "description": "加入的 Room（逗号分隔）" }
      ],
      "required_role": "af:operator"
    },
    {
      "action": "destroy",
      "description": "销毁 Agent 实例",
      "params": [
        { "name": "name", "type": "string", "required": true, "description": "Agent 名称" }
      ],
      "required_role": "af:operator"
    }
  ]
}
```

---

## 8. 安装与配置

### 8.1 目录结构

```
ezagent/socialware/agent-forge/
├── manifest.toml                    # Socialware 声明清单
├── templates/
│   ├── code-reviewer.toml           # 预置模板
│   ├── task-worker.toml
│   └── security-auditor.toml
└── agents/
    └── review-bot/                  # Agent 实例配置
        ├── config.toml              # Adapter 配置、沙箱路径
        ├── soul.md                  # 完整 System prompt
        └── skills/                  # 可选：技能指令文件
            ├── code-review.md
            └── security-check.md
```

### 8.2 manifest.toml

```toml
[socialware]
id = "agent-forge"
name = "AgentForge"
namespace = "af"
version = "0.9.3"

[declaration]
content_types = ["af:template.register", "af:instance.spawn", "af:instance.destroy",
                 "af:instance.wake", "af:instance.sleep", "af:instance.configure",
                 "af:instance.join", "af:instance.leave",
                 "af:role.grant", "af:role.revoke"]
hooks = ["check_role", "on_command", "on_mention", "auto_wake", "idle_check", "resource_guard"]
roles = ["af:admin", "af:operator", "af:agent"]
flows = ["agent_lifecycle"]

[commands]
spawn = { params = ["template", "name", "rooms?"], role = "af:operator" }
destroy = { params = ["name"], role = "af:operator" }
list = { params = ["status?"], role = "af:operator" }
wake = { params = ["name"], role = "af:operator" }
sleep = { params = ["name"], role = "af:operator" }
config = { params = ["name", "key", "value"], role = "af:admin" }
templates = { params = [], role = "af:operator" }
register-template = { params = ["id", "adapter", "config"], role = "af:admin" }

[dependencies]
extensions = ["EXT-04", "EXT-06", "EXT-13", "EXT-15", "EXT-17"]
socialware = ["event-weaver"]

[policy]
max_agents = 50
max_concurrent_per_agent = 3
default_idle_timeout = "1h"
```

### 8.3 Agent config.toml

```toml
# ezagent/socialware/agent-forge/agents/review-bot/config.toml

[identity]
name = "Review-Bot"
template = "code-reviewer"

[adapter]
type = "claude-code"
model = "sonnet"
allowed_tools = ["Read", "Search", "Bash(read-only)"]

[sandbox]
paths = [
  { path = "/projects/myapp", access = "read-write" },
  { path = "/shared/docs", access = "read-only" }
]

[limits]
max_concurrent = 3
max_context_messages = 20
max_context_tokens = 8000
api_budget_daily = 500

[lifecycle]
auto_start = true
idle_timeout = "1h"
auto_wake_on_mention = true
```

### 8.4 soul.md（System Prompt）

```markdown
# Review-Bot

You are a code reviewer working in the ezagent collaborative platform.

## Your Identity
- Name: Review-Bot
- Role: Code Reviewer (ta:reviewer)
- Working directory: /projects/myapp

## Behavior Guidelines
- Focus on code quality, security vulnerabilities, and best practices
- Be concise and actionable in your feedback
- If unsure, ask for clarification rather than guessing
- Use annotations to reference specific code locations

## Response Format
- Start with a brief summary (1-2 sentences)
- List issues by severity: Critical → Warning → Info
- End with an overall recommendation: Approve / Request Changes / Needs Discussion
```

---

## 9. 资源控制

### 9.1 全局策略

```toml
# manifest.toml [policy]
max_agents = 50                      # 单节点最大 Agent 数
max_concurrent_per_agent = 3         # 单 Agent 最大并发处理数
default_idle_timeout = "1h"          # 默认空闲超时
```

### 9.2 Per-Agent 配额

```toml
# agents/{name}/config.toml [limits]
max_concurrent = 3                   # 并发处理数
max_context_messages = 20            # 上下文最大消息数
max_context_tokens = 8000            # 上下文最大 token 数
api_budget_daily = 500               # 每日 API 调用次数
```

### 9.3 资源超限处理

| 事件 | 行为 |
|------|------|
| 并发数达到上限 | 新请求排队等待，超时后返回 `AGENT_BUSY` |
| API 预算耗尽 | Agent 进入 SLEEPING，返回 `BUDGET_EXHAUSTED` |
| 全局 Agent 数达到上限 | `/af:spawn` 返回 `MAX_AGENTS_REACHED` |

---

## 10. 与其他 Socialware 的集成

### 10.1 EventWeaver

- Agent 的所有状态变化（spawn, sleep, wake, destroy）记录为 EventWeaver 事件
- Agent 的活动日志可通过 EventWeaver 的 DAG 追溯

### 10.2 TaskArena

- Agent 可以被赋予 `ta:worker`、`ta:reviewer` 等 Role
- AgentForge 的 Cooperation Engine 支持 TaskArena Flow 驱动的自动分配

### 10.3 ResPool

- Agent 消耗的 GPU/API 资源可以通过 ResPool 进行配额管理
- `/af:spawn` 时可以指定 ResPool 配额绑定

---

## 11. 错误码

| Code | 含义 |
|------|------|
| `AF_TEMPLATE_NOT_FOUND` | 模板不存在 |
| `AF_AGENT_EXISTS` | Agent 名称已存在 |
| `AF_AGENT_NOT_FOUND` | Agent 实例不存在 |
| `AF_ADAPTER_ERROR` | Adapter 调用失败 |
| `AF_AGENT_BUSY` | Agent 并发数达到上限 |
| `AF_BUDGET_EXHAUSTED` | API 预算耗尽 |
| `AF_MAX_AGENTS_REACHED` | 全局 Agent 数达到上限 |
| `AF_SANDBOX_VIOLATION` | 沙箱路径越权访问 |

---

## 12. 实施路线

| 阶段 | 内容 | 依赖 |
|------|------|------|
| Phase A | 核心 Adapter Protocol + ClaudeCodeAdapter + 基本 Spawn/Destroy | EXT-13 Profile, EXT-15 Command |
| Phase B | Conversation Segment + Cooperation Engine + Pipeline 模式 | EXT-04, EXT-06, EXT-11 |
| Phase C | Resource Guard + ResPool 集成 + 多 Adapter 支持 | ResPool |
| Phase D | 自定义 Adapter SDK + 模板市场 + Agent 社区 | 全部 |

# ezagent Socialware Specification v0.9.5

> **状态**：Architecture Draft
> **日期**：2026-02-28
> **前置文档**：ezagent-architecture-v0.9.4, ezagent-bus-spec-v0.9.4, ezagent-extensions-spec-v0.9.4
> **作者**：Allen & Claude collaborative design

---

## §0 设计哲学

Socialware 是在 ezagent 之上构建的、由 Agent 驱动的人机混合软件。ezagent 不是另一个 IM——它是 Socialware 的支撑层。

**核心洞察**：未来的软件不仅仅是代码，更是组织关系的体现。一个 Socialware 是代码与 Agent 的混合，Agent 在一般情况下由 LLM 驱动，在训练或必要时由人类介入。Socialware 可以动态地进行 Fork、Compose、Merge，就像现实世界的企业间进行分拆、合资与并购一样。

### §0.1 你是组织设计师，不是程序员

当你创建一个 Socialware，你在做的事情是**设计一个组织**——定义岗位（Role）、划定部门边界（Arena）、制定 SLA 和合同条款（Commitment）、规划工作流程（Flow）。你不需要实现任何一个岗位的具体工作——那是被分配到该岗位的 Identity（人类或 Agent）自己的事。

一个 Socialware 的 `@when` handler 只包含**组织管理逻辑**——路由、通知、协调、记录。不包含业务实现。以编程指导服务（CodeViber）为例：

```python
@when("session.request")
async def on_session_request(self, event, ctx: SocialwareContext):
    """找到可用 mentor 并通知。不实现任何 AI 逻辑。"""
    mentors = ctx.state.roles.find("cv:mentor", room=event.room_id)
    await ctx.send("session.notify",
                   body={"learner": event.author, "topic": event.body["topic"]},
                   mentions=[m.entity_id for m in mentors])
```

"如何回答编程问题"是 mentor（人类或 Agent）的职责。CodeViber 只确保正确的 mentor 收到问题、按时回答、质量不合格时升级。你的 Socialware 代码量会很少——因为大部分"工作"是由 Role 持有者通过发 Message 来完成的。

Socialware 不区分参与者是人还是 Agent。正如公司章程不区分员工的雇佣形式——章程定义的是岗位和规则，谁来填充岗位是运营决策。AgentForge 管理的 Agent 通过 @mention 自然参与 Socialware 的协作，不需要任何特殊的 Socialware 间调用协议。

### §0.2 分形架构

ezagent 协议具有三层结构，每层四个要素，层间有严格的构建关系。

```
┌────────────────────────────────────────────────────────────┐
│ Socialware 层（正交维度，施加于 Mid-layer 实体）              │
│   Role          Arena          Commitment        Flow      │
│   能力信封        边界定义        义务绑定          演进模式   │
├────────────────────────────────────────────────────────────┤
│ Mid-layer（实体，由底层原语组合构成）                         │
│   Identity       Room           Message          Timeline  │
├────────────────────────────────────────────────────────────┤
│ Bottom（构造原语）                                          │
│   DataType        Hook          Annotation         Index   │
└────────────────────────────────────────────────────────────┘
```

**层间关系**：

- Bottom → Mid-layer：**组合关系**。Mid-layer 实体由底层原语组合构成。Identity、Room、Message、Timeline 都是 DataType 声明 + Hook 行为 + Annotation 元数据 + Index 查询能力 的组合。
- Mid-layer → Socialware：**施加关系**。Socialware 原语作为正交维度施加于 Mid-layer 实体。每个原语可以施加于任何 Mid-layer 实体，每个实体可以被多个原语描述。

### §0.3 开发者的层级边界

Socialware 开发者默认只能操作 **Mid-layer 以上**的概念。底层概念（DataType、Hook Pipeline、Annotation Store、Index Builder）和 Extension 层概念（`ext.*` 命名空间、content_type 拼接、Channel 路由）由 Socialware Runtime 自动封装。

```
开发者角色              可用 API 类型           可访问范围
──────────────────────────────────────────────────────────
普通 Socialware 开发者   SocialwareContext       Mid-layer + 四原语
                        （受限类型）             不可越界

基础设施 Socialware      EngineContext           全部层级
(@socialware(unsafe=True))（完整类型）           需显式声明
```

这是**约束（constraint）而非约定（convention）**——`SocialwareContext` 上根本不存在底层操作方法。类似 Rust 的所有权模型：默认 safe，`unsafe` 需显式标注。详见 §10。

### §0.4 核心原则

**零浮空概念原则**：Socialware 不创造新的实体类型，也不创建新的 Datatype 或 CRDT 文档。所有领域概念（event、task、resource、session 等）都是具有特定 content_type 的 Message——Mid-layer 实体本身。任何领域术语都必须能分解为"特定 content_type 的 Message + Socialware 四原语约束"。

**Socialware 是行为约束者，不是数据管理者。** 四原语（Role, Arena, Commitment, Flow）全部是约束——约束谁能发什么 Message（Role）、在哪个 Room 中生效（Arena）、发了 Message 之后必须做什么（Commitment）、Message 的合法序列是什么（Flow）。所有状态隐含在 Timeline 的 Message 序列中，运行时状态由 State Cache 纯派生。

**Python-First Socialware。** Socialware 的声明和运行时逻辑通过 Python 编写。ezagent-py 提供声明式 DSL（详见 §9），底层通过 PyO3 注册到 Rust Engine Pipeline。开发者无需接触 Hook Pipeline、content_type 拼装、Channel 路由等底层细节。

---

## §1 Socialware 四原语

### §1.1 正交性与完备性

四原语 Role、Arena、Commitment、Flow 满足以下性质：

- **正交性**：任意一个维度可以独立变化，不强制改变其他维度。（6/6 对组合验证通过）
- **完备性**：四个维度足以描述任意 Socialware 的所有本质特征。（Galbraith Star Model 5/5 要素覆盖，Mintzberg 6/6 要素覆盖，其中 Culture/Norms 编码于 Flow.preferences）
- **最小性**：移除任何一个维度都导致表达力缺失。

四原语可以从两个正交轴线理解：

```
              │  参与者维度          │  交互维度
─────────────┼─────────────────────┼──────────────────────
 结构（是什么）│  Role               │  Commitment
             │  能力信封             │  义务绑定
─────────────┼─────────────────────┼──────────────────────
 时空（怎么变）│  Arena              │  Flow
             │  边界定义             │  演进模式
```

### §1.2 Role（能力信封）

Role 是可以赋予**任何 Mid-layer 实体**的能力声明。一个实体的 Role 定义了它"能做什么"。

```yaml
RoleDef:
  id:              string                  # 角色标识符
  assignable_to:   [entity_type_filter]    # 可赋予哪类实体
  capabilities:    Set<Capability>         # 能力集合
  description:     string
```

Role 可以施加于：

| 实体类型 | 示例 |
|---------|------|
| Identity | "Alice 是 Reviewer，可以 review + judge" |
| Room | "此 Room 是 Support Channel，可以 receive_ticket + escalate" |
| Message | "此 Message 是 Directive，具有 authority + binding 性质" |
| Timeline | "此 Timeline 段是 Review Window，可以 deadline.enforce" |

关键性质：Role 不依赖任何特定的 Identity 或实体。Role 是独立的能力定义，可以动态赋予和撤回。同一个 Identity 在不同 Socialware 中可以拥有不同 Role，就像一个人在公司 A 是工程师、在公司 B 是顾问。

### §1.3 Arena（边界定义）

Arena 在任意实体集合上划定**交互边界**，定义内部/外部、可见性与参与规则。

```yaml
ArenaDef:
  id:              string
  over:            entity_set_expression   # 施加于哪些实体
  boundary:        internal | external | federated
  entry_policy:    PolicyExpr              # 谁可以进入/参与
  purpose:         string
```

boundary 的三种类型：

| 类型 | 含义 | 类比 |
|------|------|------|
| `internal` | 仅 Socialware 内部成员可访问 | 公司办公室 |
| `external` | Platform Bus 上任何 Identity 可发现和交互 | 公司前台/官网 |
| `federated` | 跨 Socialware 交互的专用通道 | 企业间合作协议 |

### §1.4 Commitment（义务绑定）

Commitment 在任意两个实体之间建立**有约束力的权利-义务关系**。

```yaml
CommitmentDef:
  id:              string
  between:         [entity_expr, entity_expr]   # 义务双方
  obligation:      string                       # 承诺内容
  triggered_by:    trigger_expr                 # 何时生效
  expires:         expiry_expr | null           # 何时失效
  enforcement:     string | null                # 执行保障机制（通常是 Hook）
```

Commitment 可以建立于任何实体之间：

| 关系 | 示例 |
|------|------|
| Identity ↔ Identity | "Worker 向 Publisher 承诺按期交付" |
| Identity ↔ Room | "Agent 承诺在此 Room 内 7×24 响应" |
| Room ↔ Room | "Support Channel 承诺将升级问题转到 Escalation Room" |
| Socialware ↔ Socialware | "ResPool 承诺为 TaskArena 预留 10 GPU-hours" |
| Message ↔ Identity | "此分配凭证代表双方协议，不可篡改" |

### §1.5 Flow（演进模式）

Flow 描述任意实体的**状态如何随 Commitment 的兑现而演进**。

```yaml
FlowDef:
  id:              string
  subject:         entity_type_expr            # 施加于哪类实体
  states:          Set<State>
  transitions:     Set<(State, Trigger) → State>
  preferences:     Map<Transition, Weight|Rule>
```

关键性质：

- **Commitment 驱动转换**：Flow 的每个 transition 上标注的通常是一个 Commitment 的兑现或由 Commitment 驱动的事件。状态转换就是承诺的兑现。
- **Preference 编码文化**：`preferences` 字段是组织文化/价值取向的形式化表达。"鼓励快速迭代"意味着某些 transition 的权重更高。
- **Flow 不限于 Message**：Flow 可以施加于 Identity（信誉演进）、Room（生命周期）、Timeline 段（窗口期）等任何实体。

---

## §2 Socialware 声明格式

每个 Socialware 由三部分声明组成：

```yaml
Socialware:
  id:          string
  namespace:   string               # 短标识，用于 content_type 前缀 (如 "ta", "ew", "rp")
  version:     string
  identity:    Identity              # Socialware 本身拥有统一的 Identity

  # ═══ Part A: 协议层约定 ═══
  # Socialware 不创建 Datatype。Part A 声明的是 content_type 约定和 Hook 行为。
  protocol_convention:
    content_types:  [ContentTypeDef]  # 本 Socialware 使用的 content_type 列表
    hooks:
      pre_send:     [Hook]            # Role 检查 + Flow 转换验证（priority >= 100）
      after_write:  [Hook]            # State Cache 更新 + Commitment 检查
      after_read:   [Hook]            # 查询增强（可选）
    indexes:        [IndexDef]        # 查询视图（可选，使用 EXT-17 通用 Index 即可）

  # ═══ Part B: Socialware 层声明 ═══
  # 四维度施加于 Timeline 中的 Message，约束行为序列
  socialware_declaration:
    roles:        [RoleDef]           # Role → capability → content_type 映射
    arenas:       [ArenaDef]
    commitments:  [CommitmentDef]
    flows:        [FlowDef]           # Flow transitions 由 content_type 触发

  # ═══ Part C: UI Manifest [MAY] ═══
  # 渲染声明，定义 Socialware 在 Chat UI 中的表现
  ui_manifest:
    message_renderers:               # content_type → 渲染配置
      - content_type: string         #   匹配模式（如 "ta:task.*"）
        renderer:    RendererDef     #   渲染器定义

    views:                           # Socialware 注册的 Room Tab
      - id:          string          #   全局唯一 (sw:{sw_id}:{view_name})
        data_source: string          #   数据来源（State Cache query 或 EXT-17 Index）
        renderer:    TabRendererDef  #   Tab 渲染配置

    flow_renderers:                  # Flow → 状态可视化 + Action 按钮
      - flow:        string          #   关联的 Flow ID
        badge:       map             #   state → {color, label}
        actions:     [ActionDef]     #   transition → 按钮配置
```

### §2.1 Part A: content_type 约定

Part A 不创建 Datatype，不写 Annotation，不引入新的 CRDT 文档。Part A 声明的是：

1. **content_type 列表**：本 Socialware 使用哪些 content_type，每个 content_type 的语义和 body schema
2. **Hook 行为**：在 Message 写入前后执行什么检查和逻辑
3. **Index**（可选）：如果 EXT-17 Runtime 的通用 Index 不够用，可以声明额外的查询视图

```yaml
ContentTypeDef:
  type:          string              # 如 "ta:task.propose"
  description:   string              # 语义描述
  body_schema:   Schema              # body 的 JSON Schema
  required_capability: string        # 发送此 content_type 需要的 Role capability
  flow_subject:  boolean             # 是否创建新的 Flow subject（如 task.propose = true）
  flow_trigger:  string | null       # 如果非 null，此 content_type 触发 Flow transition
  reply_to_type: string | null       # 如果非 null，ext.reply_to 必须指向此 content_type
```

### §2.2 Part B: 行为约束声明

Part B 声明 Role → capability → content_type 的三层映射，以及 Flow 状态机。

```yaml
# Role 声明
RoleDef:
  id:              string                  # 如 "ta:publisher"
  capabilities:    Set<string>             # 如 {"task.propose", "task.cancel"}
  assignable_to:   [entity_type_filter]    # 可赋予哪类实体
  description:     string

# capability → content_type 自动映射规则：
# capability "task.propose" → content_type "{namespace}:task.propose" → "ta:task.propose"
# Socialware Runtime 自动构建此映射

# Flow 声明
FlowDef:
  id:              string                  # 如 "task_lifecycle"
  subject_type:    string                  # 创建 Flow subject 的 content_type（如 "ta:task.propose"）
  states:          Set<State>
  transitions:     Map<(State, content_type_action), State>
  auto_transitions: Map<State, State>      # 进入某 state 后自动触发的转换
  preferences:     Map<Transition, Weight|Rule>
```

### §2.3 Part A/B 桥梁

```
Part A (Protocol Convention):
  content_type 声明 → 定义 → Message 的语义和 body 格式
  Hook 声明       → 执行 → Role 检查 + Flow 验证 + State Cache 更新

         ↓ Timeline Message 作为桥梁 ↓

Part B (Socialware):
  Role       约束 → "谁能发送什么 content_type 的 Message"
  Arena      约束 → "哪些 Room 启用了此 Socialware（ext.runtime.enabled）"
  Commitment 约束 → "发了 Message 之后必须做什么"
  Flow       约束 → "content_type 的合法序列是什么"

         ↓ Part A + Part B 作为行为基础 ↓

Part C (UI Manifest):
  message_renderers → content_type 的渲染定制
  views             → State Cache 的 Room Tab 展示
  flow_renderers    → Flow state badge + transition action buttons
```

### §2.4 概念溯源验证

每个 Socialware 设计完成后，应能生成一张概念溯源表，证明所有领域术语均可分解为"特定 content_type 的 Message + Socialware 四原语约束"。如果存在无法溯源的概念，则声明不完整。

**溯源示例（TaskArena）**：

| 领域术语 | 分解 |
|---------|------|
| Task | content_type="ta:task.propose" 的 Message |
| Claim | content_type="ta:task.claim" 的 Message，reply_to 指向 Task Message |
| Task 状态 | Flow "task_lifecycle" 对 Task Message 的 State Cache 派生值 |
| Publisher | 拥有 "ta:publisher" Role 的 Identity |
| Submission | content_type="ta:submission.create" 的 Message，reply_to 指向 Task Message |
| Verdict | content_type="ta:verdict.approve" 的 Message，reply_to 指向 Submission Message |

### §2.5 State Cache

Socialware 的运行时状态（如 "Task ulid:001 当前处于 claimed 状态"）不是存储在 CRDT 中的数据，而是从 Timeline Message 序列**纯派生**的内存缓存。

```
State Cache:
  ┌─ flow_states: Map<ref_id, FlowState>     # Flow subject → 当前状态
  ├─ role_map: Map<(room_id, entity_id), Set<Role>>  # 角色分配
  ├─ commitments: Map<commitment_id, CommitmentStatus>  # 义务状态
  └─ domain_state: Map<string, any>           # Socialware 自定义状态
```

**重建策略**：

1. **启动时**：从 EXT-17 Runtime Index 查询所有 `{namespace}:*` 的 Message，按 CRDT 因果序回放，重建 State Cache
2. **运行时**：after_write Hook 增量更新 State Cache
3. **检查点**（可选）：Socialware MAY 定期将 State Cache 序列化到本地存储（`ezagent/socialware/{sw_id}/checkpoint.bin`），重启时仅从检查点后增量回放

- [MUST] State Cache 是**进程内存**中的数据结构，不参与 CRDT Sync。
- [MUST] State Cache 在所有 Peer 上独立计算。由于 CRDT 最终一致性，所有 Peer 的 State Cache 最终一致。
- [MUST] State Cache 可随时从 Timeline 完整重建。本地存储的检查点是性能优化，不是必须的。
- [MUST NOT] Socialware 不得将 State Cache 写入 CRDT 文档或 `ext.*` 命名空间。

---

## §3 Platform Bus

Platform Bus 是一个**普通的 Bus 实例**，其"成员"是 Socialware 的 Identity。不需要引入新的基础设施概念。

```
┌─ Platform Bus (普通 Bus 实例) ──────────────────────────┐
│  Members: Socialware Identities                         │
│                                                         │
│  ┌─EventWeaver──┐  ┌──ResPool──┐  ┌──TaskArena──┐      │
│  │ Inner Bus    │  │ Inner Bus │  │ Inner Bus   │      │
│  │ (内部实体)    │  │ (内部实体) │  │ (内部实体)   │      │
│  └──────────────┘  └───────────┘  └─────────────┘      │
└─────────────────────────────────────────────────────────┘
```

### §3.1 Platform Bus 上的交互

| 操作 | 实现方式 |
|------|---------|
| Socialware 注册 | Identity 加入 Platform Bus 的 Room |
| 能力发布 | 发送 content_type=`sw:capability-manifest` 的 Message |
| 能力发现 | 通过 EXT-17 Runtime Index 查询已启用的 Socialware |
| 命令注册 | 在 Socialware Profile 上发布 `command_manifest` Annotation（EXT-15） |
| Socialware 间交互 | Platform Bus 上的 Message 交换（使用各自 namespace 的 content_type） |

### §3.2 Socialware 内部/外部边界

每个 Socialware 拥有自己的 Inner Bus（Bus 实例），用于内部成员间通信。Socialware 通过 Arena 的 `boundary` 设定控制哪些内部信息可以在 Platform Bus 上被发现和交互。

- `internal` Arena → 仅 Inner Bus 可见
- `external` Arena → 在 Platform Bus 上注册，外部可交互
- `federated` Arena → 特定 Socialware 间的点对点通道

边界控制通过 Bus 层的普通 Hook 实现，不需要独立的 Membrane 机制。

---

## §4 Socialware 组合操作

### §4.1 Fork（分拆）

从已有 Socialware 创建一个结构相同但独立演化的新实例。

**现实类比**：从一家公司分拆出子公司，继承制度但独立运营。

```yaml
Fork(S) → S':
  Part A:   copy(S.bus_declaration)           # 完整继承声明
  Part B:   copy(S.socialware_declaration)    # 完整继承声明
  Runtime:  snapshot(S.entities) | empty()    # 快照或空白
  Identity: new Identity()                    # 新身份，注册到 Platform Bus
  Post:     S 和 S' 完全独立，各自演化
```

两种变体：

| 变体 | Runtime 策略 | 适用场景 |
|------|-------------|---------|
| Fork-with-Snapshot | 取 S 当前状态快照 | TaskArena-CN 从 TaskArena fork，带走当前中国区 task |
| Fork-Clean | Runtime 为空 | 基于 TaskArena 模板创建全新实例 |

Fork 后的演化完全独立：S 修改声明不影响 S'，反之亦然。

### §4.2 Compose（合资/联盟）

多个独立 Socialware 组成一个上层 Socialware，成员保持独立运行。

**现实类比**：多家公司成立合资企业或行业联盟。

```yaml
Compose(S1, S2, ..., Sn) → C:
  S1..Sn: 各自 Part A + Part B 不变，继续独立运行
  C.Part A: 新增协调用 DataType
    - c:membership    (成员关系)
    - c:capability    (暴露的能力)
    - c:request       (跨成员请求)
    - c:response      (跨成员响应)
  C.Part B: 新增联邦治理
    - Roles:       member, coordinator
    - Arenas:      composite_facade (external), member_chamber (internal)
    - Commitments: capability_exposure, aggregated_sla
    - Flows:       membership_lifecycle, cross_member_request
  Identity: C 有新 Identity; S1..Sn 保持各自 Identity
```

关键性质：

- **选择性暴露**：成员通过 `c:capability` Message 声明暴露给 C 的能力，不是全部内部能力
- **路由透明**：外部用户通过 C 的 facade Arena 交互，C 的 Hook 将请求路由到正确的成员
- **可逆**：成员可以退出（Decompose），C 的 membership Flow 支持 `departed` 状态

### §4.3 Merge（并购/合并）

两个同构 Socialware 合为一个，统一声明和运行时。

**现实类比**：两家公司合并。

```yaml
Merge(S1, S2) → M:
  Part A: union(S1, S2) + 冲突解决
  Part B: union(S1, S2) + 冲突解决
  Runtime: union(S1.entities, S2.entities) + 实例调和
  Identity: M 有新 Identity; S1, S2 archived with redirect
```

冲突解决策略（按声明要素）：

| 要素 | 冲突类型 | 策略 |
|------|---------|------|
| DataType | 同名不同 schema | auto: superset_schema / manual: human_choose |
| Hook | 同 trigger 不同 action | auto: chain / auto: priority / manual: human_choose |
| Role | 同名不同 capabilities | auto: union_capabilities |
| Flow | 同名不同 states | auto: superset_states / manual: human_reconcile |
| Commitment | 同关系不同义务 | auto: stricter_wins / manual: human_negotiate |

### §4.4 操作对比

```
           │ Fork           │ Compose           │ Merge
───────────┼────────────────┼───────────────────┼──────────────────
声明       │ copy           │ 各自保留+C新增     │ union+冲突解决
运行时     │ snapshot | ∅   │ 各自保留+C新增     │ union+实例调和
Identity   │ new            │ 各自保留+C新增     │ new, 旧者archived
成员独立性  │ 完全独立       │ 保持独立           │ 消失（合为一体）
可逆性     │ 不需要逆操作    │ 可 decompose      │ 理论上可 split
```

---

## §5 Bootstrap 序列

平台启动时的引导顺序：

```
1. 创建 Platform Bus（普通 Bus 实例）
2. 创建 Bootstrap EventWeaver
   → 硬编码的首个 EventWeaver 实例
   → 管理平台级生命周期事件
   → 自身的生命周期由自己记录（自举）
3. 后续所有 Socialware 创建均经过 Bootstrap EventWeaver
   → 每个 Socialware 的创建产生 ew:event.record Message { event_type: "socialware_created" }
   → 新 Socialware 的 Identity 注册到 Platform Bus
```

---

## §6 Human-in-the-Loop

Human-in-the-Loop（HiTL）不是独立机制，而是自然涌现于 ezagent 的 Hook + Annotation + Socialware 四原语体系中。

### §6.1 Role 转移模型

由于 Human 和 Agent 共享统一的 Identity 模型，HiTL 的本质是 **Role 不变，Identity 变化**——就像一个员工将任务交接给同事。Agent `@agent-r1` 持有 `ta:reviewer` Role，当其置信度不足时，Flow 触发 escalation，Human `@alice` 被赋予同一个 Role 并在同一个 Arena 中接手工作。对所有参与者完全透明：每个人都能看到是 Alice 接手了，而不是 agent-r1 背后悄悄换了人。

这不需要任何 Identity 层的特殊机制——它是纯粹的 Socialware 层行为（Role 赋予 + Flow transition），和任何其他协作行为使用完全相同的原语。

### §6.2 多层次触发

HiTL 可以发生在任何粒度，由 Flow 的 preferences 和 Hook 的判断逻辑驱动：

| 层次 | 触发方式 | 实现 |
|------|---------|------|
| Identity 级 | 管理员手动切换 | 将 Role 从 Agent 重新赋予 Human |
| Session 级 | 置信度阈值触发 | Hook 检测连续低置信度 |
| Task 级 | Task 属性触发 | Flow preference 标记需人工的 transition |
| Message 级 | Hook 实时判断 | pre_send hook 拦截并路由 |

### §6.3 实现机制

```
Flow.preferences:
  escalate_to_human: preferred_when(condition)

→ Hook (after_write) 检测 condition
→ 发送 content_type="{ns}:_system.escalation" Message（记录升级事件）
→ Human Identity 被赋予对应 Role（通过 {ns}:role.grant Message）
→ Human 进入对应 Arena 处理
→ 处理结果作为新的 content_type Message 驱动 Flow transition
→ State Cache + EXT-17 Index 记录"所有被人类介入过的交互"用于后续训练
```

---

## §7 Socialware 安装与本地存储

### §7.1 本地命名空间

Socialware 的安装信息和本地运营数据存储在 `ezagent/socialware/` 命名空间中（参见 bus-spec 附录 B）。此命名空间是**本地存储**，MUST NOT 通过 Sync Protocol 发布。

```
ezagent/socialware/
├── registry.toml                    # 安装注册表（启动入口）
├── event-weaver/
│   ├── manifest.toml                # Socialware 声明清单
│   └── ...                          # 运营数据（由 Socialware 自行管理）
├── task-arena/
│   ├── manifest.toml
│   └── ...
├── res-pool/
│   ├── manifest.toml
│   └── ...
└── agent-forge/
    ├── manifest.toml
    ├── templates/                   # Agent 模板
    └── agents/                      # Agent 实例配置
        └── claude-dev/
            ├── config.toml          # Adapter 配置、沙箱路径
            ├── soul.md              # System prompt
            └── skills/              # 技能指令文件
```

### §7.2 Registry（安装注册表）

`registry.toml` 是节点启动时的 Socialware 发现入口。

```toml
# ezagent/socialware/registry.toml

[[installed]]
id = "event-weaver"
version = "0.9.1"
auto_start = true
identity = "@event-weaver:relay-a.example.com"

[[installed]]
id = "task-arena"
version = "0.9.1"
auto_start = true
identity = "@task-arena:relay-a.example.com"

[[installed]]
id = "res-pool"
version = "0.9.1"
auto_start = true
identity = "@res-pool:relay-a.example.com"

[[installed]]
id = "agent-forge"
version = "0.1.0"
auto_start = true
identity = "@agent-forge:relay-a.example.com"
```

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `id` | string | MUST | Socialware ID，对应子目录名 |
| `version` | string | MUST | 安装的版本 |
| `auto_start` | boolean | MUST | 节点启动时是否自动启动 |
| `identity` | string | MUST | 该 Socialware 在协议层的 Entity ID |

- [MUST] `id` 在同一节点内唯一。
- [MUST] `identity` 必须是已注册的有效 Entity ID。

### §7.3 Manifest（声明清单）

每个已安装 Socialware 在其目录下维护 `manifest.toml`，声明自身的能力和资源需求。

```toml
# ezagent/socialware/task-arena/manifest.toml

[socialware]
id = "task-arena"
name = "TaskArena"
namespace = "ta"
version = "0.9.3"

[declaration]
content_types = ["ta:task.propose", "ta:task.claim", "ta:task.submit", "ta:task.cancel",
                 "ta:submission.create", "ta:verdict.approve", "ta:verdict.reject",
                 "ta:verdict.request_revision", "ta:dispute.open", "ta:dispute.resolve",
                 "ta:role.grant", "ta:role.revoke"]
hooks = ["check_role", "check_flow", "advance_flow", "check_commitments"]
roles = ["ta:publisher", "ta:worker", "ta:reviewer", "ta:arbiter"]
flows = ["task_lifecycle", "submission_review"]

[commands]
# EXT-15 Command 声明（简写格式，完整声明见 Profile Annotation）
claim = { params = ["task_id"], role = "ta:worker" }
post-task = { params = ["title", "reward?"], role = "ta:publisher" }
submit = { params = ["task_id"], role = "ta:worker" }
review = { params = ["submission_id", "verdict"], role = "ta:reviewer" }

[dependencies]
extensions = ["EXT-04", "EXT-06", "EXT-15", "EXT-17"]
socialware = ["event-weaver"]
```

- [MUST] `manifest.toml` 在 Socialware 安装时创建，版本升级时更新。
- [MUST] `[commands]` 中声明的命令 MUST 在启动时发布到 Profile 的 `command_manifest` Annotation（EXT-15）。
- [MUST] `[dependencies]` 中列出的 Extension 和 Socialware MUST 在启动前验证可用性。

### §7.4 生命周期

```
install → register → start → stop → uninstall

install:    写入 registry.toml 条目 + 创建 {sw_id}/ 目录 + 写入 manifest.toml
register:   创建或恢复 Socialware Identity + 注册到 Platform Bus
start:      加载 manifest → 连接 Platform Bus → 注册 Hooks → 发布 command_manifest → 就绪
stop:       取消 Hook 注册 → 从 Platform Bus 下线 → 清理临时数据
uninstall:  stop → 从 registry.toml 移除条目 → 归档或删除 {sw_id}/ 目录
```

- [MUST] `install` 时检查命令命名空间唯一性（不可与已安装 Socialware 的 `namespace` 冲突）。
- [MUST] `start` 时依赖的 Socialware MUST 已处于 `started` 状态。
- [SHOULD] `uninstall` 时 Socialware 已发送的 Message（Timeline 中的 content_type 为 `{ns}:*` 的 Ref）SHOULD 保留。

### §7.5 启动序列

节点完整启动序列：

```
1. Engine 初始化（Rust 核心：CRDT + Zenoh + Hook Pipeline）
2. 读取 registry.toml → 发现已安装 Socialware
3. 按依赖排序：event-weaver（无依赖）→ task-arena, res-pool（依赖 event-weaver）→ agent-forge
4. 对每个 auto_start=true 的 Socialware：
   a. 加载 manifest.toml
   b. 恢复 Identity（从本地密钥对）
   c. 连接 Platform Bus
   d. 注册 Hooks（priority >= 100）
   e. 发布 command_manifest（EXT-15）到 Profile Annotation
   f. 重建 State Cache：
      - 查询所有 ext.runtime.enabled 包含自己 namespace 的 Room
      - 对每个 Room，通过 EXT-17 Index 回放所有 {ns}:* Message
      - 如有本地检查点，从检查点后增量回放
   g. 标记为 started
5. AgentForge 启动后：扫描 agents/ 目录 → 启动 auto_start Agent → 发布 Agent Profile
6. Platform Bus 就绪，接受用户请求
```

### §7.6 与协议层数据的关系

| 数据 | 位置 | 同步 | 说明 |
|------|------|------|------|
| Socialware Identity | `ezagent/@{sw_id}:...` | ✅ CRDT Sync | 协议可见，其他 Peer 可发现 |
| Socialware Profile | `ezagent/@{sw_id}:.../ext/profile/` | ✅ CRDT Sync | 包含 command_manifest Annotation |
| Socialware Message | Timeline 中 content_type=`{ns}:*` 的 Ref | ✅ CRDT Sync | 普通 Message，所有 Peer 同步 |
| State Cache | 进程内存 | ❌ 不同步 | 从 Timeline Message 纯派生，各节点独立计算 |
| 安装注册表 | `ezagent/socialware/registry.toml` | ❌ Local Only | 节点私有 |
| 声明清单 | `ezagent/socialware/{sw_id}/manifest.toml` | ❌ Local Only | 节点私有 |
| 检查点 | `ezagent/socialware/{sw_id}/checkpoint.bin` | ❌ Local Only | State Cache 的持久化快照，可选 |

**原则：行为数据（Message）通过 CRDT 同步。派生状态（State Cache）在各节点独立计算。本地运营数据（配置、模板、检查点）不同步。**

---

## §8 Socialware Commands

### §8.1 概述

Socialware 通过 EXT-15 Command 向用户和 Agent 暴露操作入口。命令执行的结果是**发送一条特定 content_type 的 Message**。命令本身是触发器，Message 是持久化的行为记录。

### §8.2 声明流程

```
1. Socialware 在 manifest.toml 的 [commands] 中声明命令（简写格式）
2. 启动时，Socialware Runtime 读取 [commands] 并展开为完整的 CommandDef
3. 完整 CommandDef 写入 Socialware Profile 的 command_manifest Annotation
4. EXT-15 的 command_manifest_registry Index 自动聚合所有 Socialware 的命令
5. 客户端查询 Index 获取可用命令列表，提供自动补全
```

### §8.3 命令处理

当用户发送命令 Message（如 `/ta:claim task-42`）时：

```
1. Engine pre_send Hook (EXT-15 command.validate)
   → 验证 ns、action、params
2. Engine pre_send Hook (EXT-17 runtime.namespace_check)
   → 验证 "ta" ∈ Room 的 ext.runtime.enabled
3. Ref 写入 Timeline（含 ext.command 字段）
4. Engine after_write Hook (EXT-15 command.dispatch)
   → 路由到 TaskArena 的 Socialware Hook
5. TaskArena Hook 处理命令：
   a. 从 State Cache 读取当前状态
   b. 验证 Role 能力和 Flow 转换合法性
   c. 发送结果 Message（如 content_type="ta:task.claim"）
   d. 写入 command_result Annotation 到原 Ref
6. State Cache 由 after_write Hook 增量更新
7. 客户端收到事件 → 显示命令执行结果
```

### §8.4 Socialware Hook 中处理命令

```python
@socialware("task-arena")
class TaskArena:
    @hook(phase="after_write", trigger="timeline_index.insert",
          filter="ext.command.ns == 'ta'", priority=110)
    async def on_command(self, event, ctx):
        cmd = event.ref.ext.command
        if cmd.action == "claim":
            task_ref_id = cmd.params["task_id"]
            task_state = self.state.flow_states.get(task_ref_id)

            if task_state != "open":
                await ctx.command.result(cmd.invoke_id, status="error",
                    error=f"Task is not open (current: {task_state})")
                return

            if not self.state.role_map.has_capability(
                    event.room_id, event.ref.author, "task.claim"):
                await ctx.command.result(cmd.invoke_id, status="error",
                    error="You don't have the worker role")
                return

            # 发送 claim Message（触发 Flow transition + State Cache 更新）
            await ctx.messages.send(
                room_id=event.room_id,
                content_type="ta:task.claim",
                body={"reason": cmd.params.get("reason", "")},
                reply_to=task_ref_id,
                channels=["_sw:ta"],
            )
            await ctx.command.result(cmd.invoke_id, status="success",
                result={"task_id": task_ref_id, "new_state": "claimed"})
```

- [MUST] Socialware Hook 的 `filter` MUST 使用 `ext.command.ns` 确保只接收自己命名空间的命令（`@hook` 模式），或由 Runtime 自动路由（`@when` 模式，§9）。
- [MUST] Socialware Hook MUST 在处理完成后写入 `command_result`（`@when` 模式下通过 `ctx.succeed()` / `ctx.fail()` 自动完成）。
- [SHOULD] Socialware Hook SHOULD 在 30s 内完成处理。超时由 EXT-15 的 timeout Hook 自动检测。
- [MUST] 命令处理的最终结果是**发送一条 Socialware content_type 的 Message**，而非直接修改数据。
- [SHOULD] 新开发的 Socialware SHOULD 使用 §9 DSL（`@when` + `SocialwareContext`）。`@hook` + `EngineContext` 保留给 `unsafe=True` 模式和向后兼容。

---

---

## §9 Socialware Developer DSL

> **设计目标**：让 Socialware 开发者只写组织管理逻辑（路由、通知、协调），底层细节由 Runtime 自动生成。

### §9.1 设计原则

Socialware DSL 的核心原则是**声明驱动自动生成**：

1. 开发者声明 Role / Flow / Commitment → Runtime 自动注册对应的 pre_send / after_write Hook
2. 开发者写 `@when(action)` handler → Runtime 自动完成 content_type 路由、namespace 过滤
3. 开发者通过 `ctx.send(action, body)` 发送 Message → Runtime 自动拼接 `content_type`、设置 `channels`、添加签名

**开发者不需要触及的概念**（由 Runtime 自动完成）：

| 底层概念 | 自动生成规则 |
|---------|------------|
| `content_type` 拼接 | `f"{self.namespace}:{action}"` |
| `channels` 设置 | `[f"_sw:{self.namespace}"]` |
| Hook `phase` / `trigger` / `filter` / `priority` | 从声明推导（§9.3） |
| Role capability check | 从 `roles` 声明生成 pre_send Hook |
| Flow transition validation | 从 `flows` 声明生成 pre_send Hook |
| State Cache 更新 | 从 `flows` 声明生成 after_write Hook |
| EXT-15 Command → action 路由 | 从 `commands` manifest 生成 after_write Hook |

### §9.2 @when decorator

```python
from ezagent import socialware, when, SocialwareContext

@socialware("code-viber")
class CodeViber:
    namespace = "cv"
    roles = { ... }
    session_lifecycle = Flow( ... )
    commitments = [ ... ]

    @when("session.request")
    async def on_session_request(self, event, ctx: SocialwareContext):
        """当 cv:session.request Message 被写入后执行。"""
        ...

    @when("guidance.provide")
    async def on_guidance(self, event, ctx: SocialwareContext):
        """当 cv:guidance.provide Message 被写入后执行。"""
        ...
```

**`@when(action)` 语义**：

| 属性 | 值 |
|------|---|
| 触发时机 | `after_write`（Message 已持久化后） |
| 触发条件 | `content_type == f"{self.namespace}:{action}"` |
| 自动前置检查 | Role check + Flow validation（Runtime 自动注册为 pre_send Hook，priority 100-109） |
| handler priority | 110（在 Role/Flow check 之后） |
| handler 收到的 ctx | `SocialwareContext`（受限类型，§10） |

- [MUST] `@when` handler 的 `event` 参数包含已写入的 Ref 信息：`event.author`、`event.body`、`event.ref_id`、`event.room_id`。
- [MUST] 通过 EXT-15 Command 触发时，`event.params` 包含命令参数。
- [MUST] `@when` handler 的 `ctx` 类型为 `SocialwareContext`（§10）。
- [MUST NOT] `@when` handler 中不可抛出 `Reject`——Message 已写入。业务拒绝通过 `ctx.fail()` 返回。
- [SHOULD] `@when` handler 只包含组织管理逻辑（查找 Role 持有者、发通知、检查 Commitment），不应包含业务实现逻辑（如 LLM 调用）。

### §9.3 Runtime 自动生成规则

Socialware Runtime 从 Part B 声明自动生成以下 Hook：

#### Role check Hook（auto-generated, pre_send, priority 100）

```
对于 roles 声明中的每个 capability：
  IF incoming content_type 的 action 匹配该 capability
  AND author 不持有包含该 capability 的 Role
  THEN Reject("Lacks capability '{action}' for role '{role_id}'")
```

#### Flow validation Hook（auto-generated, pre_send, priority 101）

```
对于 flows 声明中的每个 transition：
  IF incoming content_type 的 action 匹配 transition trigger
  AND 当前 Flow state 不在 transition 的 source states 中
  THEN Reject("Invalid transition: {current_state} + {action} not defined")
```

#### State Cache update Hook（auto-generated, after_write, priority 100）

```
对于每条写入的 Socialware Message：
  1. 更新 flow_states（如果 action 是 Flow trigger）
  2. 更新 role_assignments（如果 content_type 是 role.grant/revoke）
  3. 检查 Commitment（如果 action 满足 triggered_by 条件）
  4. 检查 Commitment 超时（如果 deadline 已过）
```

#### Command dispatch Hook（auto-generated, after_write, priority 105）

```
对于每条含 ext.command 且 ns == self.namespace 的 Message：
  1. 提取 action 和 params
  2. 查找匹配的 @when handler
  3. 调用 handler，传入 SocialwareContext
  4. 如果 handler 未调用 ctx.succeed/fail，自动写入 command_result
```

- [MUST] 自动生成的 Hook 遵循 Bus Spec §3.2.6 的 priority >= 100 约束。
- [MUST] Role check 和 Flow validation 在 `@when` handler 之前执行。拒绝时 handler 不被调用。
- [MUST] 自动生成的 Hook 对开发者不可见。

### §9.4 声明式语法糖

```python
from ezagent import (
    socialware, when, Role, Flow, Commitment, Arena,
    capabilities, preferred_when, SocialwareContext,
)

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
        states=("open", "claimed", "submitted", "in_review",
                "approved", "rejected", "disputed", "cancelled"),
        transitions={
            ("open",      "task.claim"):      "claimed",
            ("claimed",   "task.submit"):     "submitted",
            ("submitted", "verdict.approve"): "approved",
            ("submitted", "verdict.reject"):  "rejected",
        },
        preferences={
            "verdict.approve": preferred_when("reviewer_count >= 2"),
        },
    )

    commitments = [
        Commitment(
            id="reward_guarantee",
            between=("ta:publisher", "ta:worker"),
            obligation="Publisher pays reward upon approval",
            triggered_by="verdict.approve",
        ),
    ]

    arenas = [
        Arena(id="task_marketplace", boundary="external"),
        Arena(id="review_chamber", boundary="internal"),
    ]
```

- [MUST] 语法糖在 `@socialware` decorator 解析时展开为标准 Part B 声明格式（§2.2）。
- [MUST] `Role(capabilities=...)` 中的 capability 名称 MUST 与 content_type 的 action 部分一致。
- [MUST] `Flow(transitions=...)` 中的 action 名称 MUST 与 content_type 的 action 部分一致。

---

## §10 类型级层级约束

> **设计目标**：通过 Python 类型系统强制开发者不可越过层级边界。一套 API，不是两套。

### §10.1 SocialwareContext

`SocialwareContext` 是 `@when` handler 中 `ctx` 参数的类型。只暴露 Mid-layer 以上的操作：

```python
class SocialwareContext:
    """Socialware 开发者可用的操作集合。"""

    # ── 发送 Socialware Message ──

    async def send(self, action: str, body: dict, *,
                   target: str | None = None,
                   mentions: list[str] | None = None) -> str:
        """发送一条 Socialware action Message。
        Runtime 自动完成 content_type 拼接、channels 设置、签名。
        Returns: ref_id。"""

    async def reply(self, ref_id: str, action: str, body: dict, **kwargs) -> str:
        """回复一条 Message。等同于 send(action, body, target=ref_id)。"""

    # ── 命令结果 ──

    async def succeed(self, result: dict | None = None):
        """报告命令执行成功。"""

    async def fail(self, error: str):
        """报告命令执行失败。"""

    # ── State Cache（只读）──

    @property
    def state(self) -> StateCache:
        """当前 Socialware 的 State Cache。
        Attributes:
            flow_states: dict[str, str]
            role_assignments: RoleMap
            commitments: list[CommitmentState]
        """

    # ── Mid-layer 只读查询 ──

    @property
    def room(self) -> RoomAccessor:
        """当前 Room 信息（只读）。"""

    @property
    def members(self) -> list[MemberInfo]:
        """当前 Room 成员列表。"""

    # ── Role 管理 ──

    async def grant_role(self, entity_id: str, role: str):
        """授予 Role。内部发送 {ns}:role.grant Message。"""

    async def revoke_role(self, entity_id: str, role: str):
        """撤回 Role。内部发送 {ns}:role.revoke Message。"""

    # ── 以下方法在此类型上不存在（类型级排除）──
    # ❌ ctx.messages.send(content_type=..., channels=[...])
    # ❌ ctx.hook.register(phase=..., trigger=..., priority=...)
    # ❌ ctx.annotations.write(key=..., value=...)
    # ❌ ctx.runtime.list_sw_messages(...)
```

- [MUST] `SocialwareContext.send()` MUST 自动拼接 `content_type` 和 `channels`。
- [MUST] `SocialwareContext` MUST NOT 暴露 `EngineContext` 的底层操作。
- [MUST] Python type checker（mypy/pyright）可对 `SocialwareContext` 静态检查。
- [SHOULD] Runtime 运行时也检查——反射绕过 SHOULD raise `LayerViolationError`。

### §10.2 EngineContext

`EngineContext` 是 `unsafe=True` 模式下的完整 ctx 类型：

```python
class EngineContext:
    """完整的 Engine 操作集合。Bottom/Extension/Mid-layer/Socialware 全部操作。"""

    # 包含 SocialwareContext 的全部方法 +
    messages: MessageAPI          # ctx.messages.send(content_type=..., channels=[...])
    rooms: RoomAPI                # ctx.rooms[id].config.update(...)
    annotations: AnnotationAPI    # ctx.annotations.write(...)
    runtime: RuntimeAPI           # ctx.runtime.list_sw_messages(...)
    command: CommandAPI            # ctx.command.result(...)
    hook: HookAPI                 # ctx.hook.register(...)
```

- [MUST] `EngineContext` 仅在 `@socialware(name, unsafe=True)` 中可用。
- [MUST] `@hook` decorator 仅在 `unsafe=True` 模式下可使用。否则 MUST raise `UnsafeRequiredError`。

### §10.3 unsafe=True 适用场景

1. **基础设施级 Socialware**：如 AgentForge 的 @mention 检测 Hook
2. **跨 Extension 集成**：如深度集成 EXT-14 Watch 的自动化系统
3. **迁移期兼容**：从 v0.9.3 `@hook` 向 v0.9.5 `@when` 迁移

- [SHOULD] 绝大多数 Socialware SHOULD 使用默认模式。
- [MUST] `unsafe=True` MUST 在 manifest.toml 中标注 `unsafe = true`。

---

## §11 Socialware 间协作

> **设计目标**：Socialware 间协作使用与人类协作相同的原语，不引入新的 Extension 或 Service Protocol。

### §11.1 核心原则

Socialware 之间的协作基于 **Room + Message + @mention + Role**，与人类协作完全相同。

CodeViber 不知道 mentor 是人还是 Agent。它只 @mention 持有 `cv:mentor` Role 的 Identity。如果该 Identity 是 Agent，AgentForge 的 @mention Hook 自然唤醒它。如果是人类，IM 通知自然到达。不需要特殊的 Socialware 间调用协议——这是 §0.1 "Agent 即同事" 原则的直接体现。

### §11.2 三种协作模式

按"组织成熟度"分为三层，三者共存而非替代：

#### 模式 1：Ad-hoc 协作（拉群模式）

两个 Socialware 的 Role 持有者在同一 Room 中自然交互。

**示例**：TaskArena 的 Worker 请求 CodeViber 帮助。

```
1. @worker-bot（ta:worker）在同一 Room 发送 /cv:request --topic "CRDT merge"
2. CodeViber 正常处理，@mention cv:mentor
3. 指导完成后 @worker-bot 继续 TaskArena 任务
4. EventWeaver 自然追踪跨 Socialware 因果链
```

- [MUST] 同一 Room 中多个 Socialware 共存时，各自 namespace check 独立执行。

**适用**：偶发的、非结构化的协作。

#### 模式 2：能力发现（Profile + Discovery）

通过 EXT-13 Profile 声明服务能力，通过 Discovery 查找。

**示例**：AgentForge 查找能填充 cv:mentor Role 的 Agent。

```
1. CodeViber Profile: entity_type=service, capabilities=["coding-guidance"]
2. AgentForge 通过 Discovery 搜索匹配的服务
3. 读取 ext.runtime.config 中的 staffing 策略
4. Spawn Agent 并赋予 cv:mentor Role
```

- [SHOULD] 提供外部服务的 Socialware SHOULD 声明 `entity_type: service` 的 Profile。

**适用**：结构化的服务匹配和 Agent 分配。

#### 模式 3：Compose（组织固化）

协作模式稳定化后，通过 §4.2 Compose 固化为新 Socialware。

**适用**：需要额外跨 Socialware 协调规则的成熟组合。

### §11.3 ext.runtime.config 中的 staffing 策略

```yaml
ext.runtime:
  config:
    af:
      role_staffing:
        "cv:mentor":
          prefer: "agent"            # agent | human | agent_preferred | human_preferred
          template: "code-assistant"  # AgentForge Agent 模板 ID
          auto_spawn: true
        "ta:reviewer":
          prefer: "agent_preferred"
          template: "code-reviewer"
          auto_spawn: false
```

- [MUST] `role_staffing` 是 `ext.runtime.config.af` 的子字段，由 AgentForge 处理。
- [MUST] 目标 Socialware（如 CodeViber）不感知 `role_staffing` 的存在。
- [MUST] 引用的 Role ID MUST 存在于对应 Socialware 的声明中。

### §11.4 与 EXT-13 Profile 的关系

| 概念 | 承载者 | 类比 |
|------|--------|------|
| 岗位权限 | Role.capabilities（Socialware 声明） | 公司章程中的职位权限 |
| 岗位需求 | ext.runtime.config.role_staffing（运营配置） | HR 的岗位 JD |
| 候选人简历 | EXT-13 Profile（Entity 自描述） | 个人简历 |
| 匹配过程 | AgentForge / 人类管理员 | HR 招聘 |

- [MUST NOT] Socialware 声明（Part B）MUST NOT 包含"需要什么样的人/Agent 来填充 Role"的信息。这是运营决策，不是组织章程。
- [SHOULD] 需要特定技能的 Role 填充策略 SHOULD 放在 `ext.runtime.config` 中。

---


## 附录 A: 与协议规范的兼容性

| Socialware 概念 | 协议规范引用 |
|----------------|---------------|
| Socialware Identity | ezagent-bus-spec §5.1 (Entity-Agnostic) |
| Part A content_type 约定 | ezagent-extensions-spec §18 (EXT-17 Runtime) |
| Hook 阶段和约束 | ezagent-bus-spec §3.2 (Hook Pipeline) |
| content_type 命名格式 | ezagent-extensions-spec §18.4 |
| _sw:* Channel 保留 | ezagent-extensions-spec §18.5 |
| Room 级 Socialware 启用 | ezagent-extensions-spec §18.3 (ext.runtime) |
| Index refresh 策略 | ezagent-bus-spec §3.4.2 (on_change / on_demand / periodic) |
| Platform Bus Room | ezagent-bus-spec §5.2 (Room) |
| Inner Bus Timeline | ezagent-bus-spec §5.3 (Timeline) |
| Socialware 本地命名空间 | ezagent-bus-spec 附录 B (`ezagent/socialware/`) |
| Command 声明与派发 | ezagent-extensions-spec §16 (EXT-15 Command) |
| Socialware 间能力发现 | ezagent-extensions-spec §14 (EXT-13 Profile) |
| Role staffing 配置 | ezagent-extensions-spec §18.3 (ext.runtime.config) |

## 附录 B: 术语表

| 术语 | 定义 |
|------|------|
| **Socialware** | 在 ezagent 之上构建的、由 Agent 驱动的人机混合软件，拥有独立 Identity |
| **Role** | 可赋予任何 Mid-layer 实体的能力声明 |
| **Arena** | 在实体集合上划定的交互边界 |
| **Commitment** | 实体之间有约束力的权利-义务关系 |
| **Flow** | 实体状态随 Commitment 兑现而演进的模式 |
| **Platform Bus** | Socialware 间通信的普通 Bus 实例 |
| **Inner Bus** | Socialware 内部通信的 Bus 实例 |
| **Part A** | Socialware 的协议层约定（content_type + Hook + Index） |
| **Part B** | Socialware 的行为约束声明（Role + Arena + Commitment + Flow） |
| **State Cache** | 从 Timeline Message 序列纯派生的内存运行时状态 |
| **content_type 命名约定** | `{ns}:{entity_type}.{action}` 格式，由 EXT-17 Runtime 管控 |
| **Fork** | 从已有 Socialware 创建结构相同但独立的新实例 |
| **Compose** | 多个 Socialware 组成上层联邦 Socialware |
| **Merge** | 两个同构 Socialware 合为一个 |
| **HiTL** | Human-in-the-Loop，Agent 向 Human 的介入切换 |
| **Registry** | 节点本地的 Socialware 安装注册表（`registry.toml`） |
| **Manifest** | Socialware 的本地声明清单（`manifest.toml`），包含 content_type 和命令注册 |
| **Command** | 基于 EXT-15 的斜杠命令，Socialware 向用户暴露操作入口 |
| **SocialwareContext** | Socialware `@when` handler 的受限 ctx 类型，只暴露 Mid-layer + 四原语操作 |
| **EngineContext** | `unsafe=True` 模式下的完整 ctx 类型，暴露所有层级操作 |
| **@when** | 声明式事件响应 decorator，替代 `@hook` 用于普通 Socialware 开发 |
| **staffing** | ext.runtime.config 中的 Role 填充策略，指导 AgentForge 匹配 Agent 模板 |

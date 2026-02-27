# ezagent Socialware Specification v0.9.1

> **状态**：Architecture Draft
> **日期**：2026-02-26
> **前置文档**：ezagent-protocol-v0.8, ezagent-bus-spec-v0.9.1, ezagent-extensions-spec-v0.9.1
> **作者**：Allen & Claude collaborative design

---

## §0 设计哲学

Socialware 是在 ezagent 之上构建的、由 Agent 驱动的人机混合软件。ezagent 不是另一个 IM——它是 Socialware 的支撑层。

**核心洞察**：未来的软件不仅仅是代码，更是组织关系的体现。一个 Socialware 是代码与 Agent 的混合，Agent 在一般情况下由 LLM 驱动，在训练或必要时由人类介入。Socialware 可以动态地进行 Fork、Compose、Merge，就像现实世界的企业间进行分拆、合资与并购一样。

**分形架构**：ezagent 协议具有三层结构，每层四个要素，层间有严格的构建关系。

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

**零浮空概念原则**：Socialware 不创造新的实体类型。所有领域概念（event、task、resource 等）都是通过 DataType 声明赋予 Mid-layer 实体新的语义标记，而非引入新的抽象层。任何领域术语都必须能分解为"DataType 标记的 Mid-layer 实体 + Socialware 原语维度"。

**Python-First Socialware。** Socialware 的声明和运行时逻辑通过 Python 编写。ezagent-py 提供声明式 DSL：

```python
@socialware("event-weaver")
class EventWeaver:
    # Socialware Hook（应用层，priority >= 100）
    @hook(phase="after_write", trigger="timeline_index.insert", priority=100)
    async def on_new_message(self, event, ctx):
        if "code-review" in event.ref.channels:
            await ctx.watch.set(event.ref_id, on_reply=True)
            await ctx.messages.send(
                room_id=event.room_id,
                body="I'll review this.",
                reply_to=event.ref_id
            )
```

底层通过 PyO3 将 Python Hook 注册到 Rust Engine Pipeline。Socialware 开发者无需接触 Rust。协议层功能（Extension API）通过 ctx 对象直接调用——这些 API 从 Extension 统一声明格式自动生成（详见 ezagent-py-spec §6）。

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
  version:     string
  identity:    Identity              # Socialware 本身拥有统一的 Identity

  # ═══ Part A: Bus 层声明 ═══
  # 使用 REALM 统一 Datatype 声明格式（参见 ezagent-bus-spec §3.5）
  bus_declaration:
    datatypes:    [DatatypeEntry]
    hooks:
      pre_send:     [Hook]
      after_write:  [Hook]
      after_read:   [Hook]
    annotations:
      on_ref:           {}
      on_room_config:   {}
      on_profile:       {}
      standalone_doc:   {}
    indexes:      [IndexDef]

  # ═══ Part B: Socialware 层声明 ═══
  # 四维度施加于 Part A 产生的 Mid-layer 实体
  socialware_declaration:
    roles:        [RoleDef]
    arenas:       [ArenaDef]
    commitments:  [CommitmentDef]
    flows:        [FlowDef]

  # ═══ Part C: UI Manifest [MAY] ═══
  # 渲染声明，定义 Socialware 在 Chat UI 中的表现
  # 详见 chat-ui-spec
  ui_manifest:
    message_templates:               # DataType → Content Renderer 定制
      - datatype:    string          #   关联的 DataType ID
        renderer:    RendererDef     #   覆盖 DataType 默认 renderer

    views:                           # Socialware 注册的 Room Tab
      - id:          string          #   全局唯一 (sw:{sw_id}:{view_name})
        index:       string          #   关联的 Index ID
        renderer:    TabRendererDef  #   Tab 渲染配置

    flow_renderers:                  # Flow → 状态可视化 + Action 按钮
      - flow:        string          #   关联的 Flow ID
        badge:       map             #   state → {color, label}
        actions:     [ActionDef]     #   transition → 按钮配置
```

**Part C 不影响协议行为**。Part C 的所有内容是 [MAY]，仅供前端 Render Pipeline 消费。没有 Part C 的 Socialware 仍可正常运行——前端将使用 Level 0 自动生成的 UI。

**Part A、Part B、Part C 之间的桥梁是 Mid-layer 实体的引用。**

```
Part A (Bus):
  DataType 声明 → 产生 → 特定 schema 的 Message/Room/...
  Hook 声明    → 监听 → 这些 Message/Room 上的事件
  Annotation   → 附加于 → 这些 Message
  Index        → 查询  → 这些 Annotation

         ↓ mid-layer 实体作为桥梁 ↓

Part B (Socialware):
  Role       施加于 → Message(datatype=X), Room, Identity, Timeline
  Arena      划定于 → Room with role(X), entity sets
  Commitment 建立于 → Identity with role(Y) 之间, Room ↔ Identity, ...
  Flow       描述   → Message(datatype=X) 的状态演进, Room 的生命周期, ...

         ↓ Part A + Part B 作为数据基础 ↓

Part C (UI Manifest):
  message_templates → DataType 的 Content Renderer 定制
  views             → Index 的 Room Tab 注册
  flow_renderers    → Flow state badge + transition action buttons
```

**概念溯源验证**：每个 Socialware 设计完成后，应能生成一张概念溯源表，证明所有领域术语均可分解为 "DataType 标记的 Mid-layer 实体 + Socialware 原语维度"。如果存在无法溯源的概念，则声明不完整。

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
| 能力发布 | 发送 `sw:capability-manifest` DataType 的 Message |
| 能力发现 | 通过 Index 查询 `sw:capability` Annotation |
| 命令注册 | 在 Socialware Profile 上发布 `command_manifest` Annotation（EXT-15） |
| Socialware 间交互 | Platform Bus 上的 Message 交换 |

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
   → 每个 Socialware 的创建产生 ew_event { event_type: "socialware_created" }
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
→ 写入 escalation Annotation 到相关实体上
→ Human Identity 被赋予对应 Role
→ Human 进入对应 Arena 处理
→ 处理结果作为新的 Commitment 驱动 Flow transition
→ Index 记录"所有被人类介入过的交互"用于后续训练
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
version = "0.9.1"

[declaration]
datatypes = ["ta_task", "ta_submission", "ta_verdict"]
hooks = ["task_lifecycle", "auto_assign", "deadline_check"]
roles = ["ta:publisher", "ta:worker", "ta:reviewer", "ta:arbiter"]
annotations = ["ta:task_meta", "ta:submission_meta", "ta:verdict_meta"]
indexes = ["task_board", "my_tasks", "review_queue"]

[commands]
# EXT-15 Command 声明（简写格式，完整声明见 Profile Annotation）
claim = { params = ["task_id"], role = "ta:worker" }
post-task = { params = ["title", "reward?"], role = "ta:publisher" }
submit = { params = ["task_id"], role = "ta:worker" }
review = { params = ["submission_id", "verdict"], role = "ta:reviewer" }

[dependencies]
extensions = ["EXT-01", "EXT-04", "EXT-06", "EXT-14", "EXT-15"]
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

- [MUST] `install` 时检查命令命名空间唯一性（不可与已安装 Socialware 的 `ns` 冲突）。
- [MUST] `start` 时依赖的 Socialware MUST 已处于 `started` 状态。
- [SHOULD] `uninstall` 时 Socialware 已创建的协议层数据（CRDT 文档、Annotations）SHOULD 保留。

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
   f. 标记为 started
5. AgentForge 启动后：扫描 agents/ 目录 → 启动 auto_start Agent → 发布 Agent Profile
6. Platform Bus 就绪，接受用户请求
```

### §7.6 与协议层数据的关系

| 数据 | 位置 | 同步 | 说明 |
|------|------|------|------|
| Socialware Identity | `ezagent/@{sw_id}:...` | ✅ CRDT Sync | 协议可见，其他 Peer 可发现 |
| Socialware Profile | `ezagent/@{sw_id}:.../ext/profile/` | ✅ CRDT Sync | 包含 command_manifest Annotation |
| 安装注册表 | `ezagent/socialware/registry.toml` | ❌ Local Only | 节点私有 |
| 声明清单 | `ezagent/socialware/{sw_id}/manifest.toml` | ❌ Local Only | 节点私有 |
| 运营数据 | `ezagent/socialware/{sw_id}/...` | ❌ Local Only | 节点私有 |

**原则：协议层数据（Identity、Profile、Message）通过 CRDT 同步，让其他参与者能发现和交互。本地运营数据（配置、模板、Agent 工作区）不同步，是节点私有的实现细节。**

---

## §8 Socialware Commands

### §8.1 概述

Socialware 通过 EXT-15 Command 向用户和 Agent 暴露操作入口。每个 Socialware 在 `manifest.toml` 中声明命令，在启动时发布到 Profile 的 `command_manifest` Annotation，客户端通过 Index 发现可用命令并提供自动补全。

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
   → 验证 ns、action、params、role
2. Ref 写入 Timeline（含 ext.command 字段）
3. Engine after_write Hook (EXT-15 command.dispatch)
   → 路由到 TaskArena 的 Socialware Hook
4. TaskArena Hook 处理命令
   → 执行业务逻辑（如将 task 状态从 open → claimed）
   → 写入 command_result Annotation 到原 Ref
5. Engine after_write Hook (EXT-15 command.result_notify)
   → 生成 command.result SSE 事件
6. 客户端收到事件 → 显示命令执行结果
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
            task = await ctx.data.get("ta_task", cmd.params["task_id"])
            if task.state != "open":
                await ctx.command.result(cmd.invoke_id, status="error",
                    error=f"Task {cmd.params['task_id']} is not open")
                return
            # 执行认领逻辑
            await ctx.data.update("ta_task", cmd.params["task_id"],
                state="claimed", worker=event.ref.author)
            await ctx.command.result(cmd.invoke_id, status="success",
                result={"task_id": cmd.params["task_id"], "new_state": "claimed"})
```

- [MUST] Socialware Hook 的 `filter` MUST 使用 `ext.command.ns` 确保只接收自己命名空间的命令。
- [MUST] Socialware Hook MUST 在处理完成后写入 `command_result`（成功或失败均需写入）。
- [SHOULD] Socialware Hook SHOULD 在 30s 内完成处理。超时由 EXT-15 的 timeout Hook 自动检测。

---

## 附录 A: 与 REALM 规范的兼容性

| Socialware 概念 | REALM 规范引用 |
|----------------|---------------|
| Socialware Identity | ezagent-bus-spec §5.1 (Entity-Agnostic) |
| Part A 声明格式 | ezagent-bus-spec §3.5 (Datatype 统一声明格式) |
| Hook 阶段和约束 | ezagent-bus-spec §3.2 (Hook Pipeline) |
| Annotation Key 格式 | ezagent-bus-spec §3.3.2 (`{type}:{annotator_entity_id}`) |
| Index refresh 策略 | ezagent-bus-spec §3.4.2 (on_change / on_demand / periodic) |
| Platform Bus Room | ezagent-bus-spec §5.2 (Room) |
| Inner Bus Timeline | ezagent-bus-spec §5.3 (Timeline) |
| Socialware 本地命名空间 | ezagent-bus-spec 附录 B (`ezagent/socialware/`) |
| Command 声明与派发 | ezagent-extensions-spec §16 (EXT-15 Command) |

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
| **Part A** | Socialware 的 Bus 层声明（DataType + Hook + Annotation + Index） |
| **Part B** | Socialware 的 Socialware 层声明（Role + Arena + Commitment + Flow） |
| **Fork** | 从已有 Socialware 创建结构相同但独立的新实例 |
| **Compose** | 多个 Socialware 组成上层联邦 Socialware |
| **Merge** | 两个同构 Socialware 合为一个 |
| **HiTL** | Human-in-the-Loop，Agent 向 Human 的介入切换 |
| **Registry** | 节点本地的 Socialware 安装注册表（`registry.toml`） |
| **Manifest** | Socialware 的本地声明清单（`manifest.toml`），包含能力声明和命令注册 |
| **Command** | 基于 EXT-15 的斜杠命令，Socialware 向用户暴露操作入口 |

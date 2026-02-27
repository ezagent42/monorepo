# Phase 5: Socialware

> **版本**：0.9.1
> **目标**：Agent 驱动的协作——Socialware 四原语运行时 + 三个参考实现 + AgentForge
> **预估周期**：3-4 周
> **前置依赖**：Phase 4 (Chat App) 完成
> **Spec 依赖**：socialware-spec.md, eventweaver-prd.md, taskarena-prd.md, respool-prd.md, agentforge-prd.md

---

## 验收标准

- Socialware 四原语 (Role, Arena, Commitment, Flow) Python 运行时可用
- Socialware 安装注册表 (registry.toml) + 声明清单 (manifest.toml) 完整工作
- EXT-15 Command 声明、派发、结果返回端到端可用
- EventWeaver: 事件 DAG 可创建、分支、合并
- TaskArena: 任务发布 → 认领 → 提交 → Review → 结算 完整流程
- ResPool: 资源声明 → 请求 → 分配 → 释放 完整流程
- AgentForge: Agent 模板注册 → Spawn → @mention 触发 → 流式响应 → 休眠/唤醒
- Agent 在 Room 中发送 structured_card，用户点击 action button 触发 Flow transition
- Level 2 自定义组件 SDK 可用（DAG 可视化、Review 分栏）

---

## §1 Socialware 声明解析

> **Spec 引用**：socialware-spec §2

### TC-5-SW-001: Part A + Part B 声明解析

```
GIVEN  EventWeaver 的完整 YAML 声明（Part A + Part B + Part C）

WHEN   Socialware 运行时加载声明

THEN   Part A 解析成功：
       - datatypes: [ew_event, ew_branch, ew_merge_request] 注册到 Engine
       - hooks: pre_send (validate_causality), after_write (index_event, ...) 注册
       - annotations: [ew:conflict, ew:approved, ew:lifecycle, ...] 声明加载
       - indexes: [ew:dag_index, ew:branch_list, ...] 注册
       Part B 解析成功：
       - roles: [ew:emitter, ew:chronicler, ...] 注册
       - arenas: [ew:event_stream, ew:branch_workspace, ...] 注册
       - commitments: [...] 注册
       - flows: [ew:event_lifecycle, ew:branch_lifecycle, ew:conflict_resolution] 注册
       Part C (UI Manifest) 传递给前端 Render Pipeline API
```

### TC-5-SW-002: 声明不完整拒绝

```
GIVEN  Socialware 声明缺少 Part B 的 flows 字段

WHEN   运行时尝试加载

THEN   报错 "Incomplete declaration: flows is required in socialware_declaration"
       加载失败
```

### TC-5-SW-003: Hook priority 验证

```
GIVEN  Socialware Hook 声明 priority = 50（< 100）

WHEN   运行时注册 Hook

THEN   拒绝注册，报错 "Socialware hooks must have priority >= 100"
       （priority < 100 保留给 Engine/Extension）
```

### TC-5-SW-004: 多个 Socialware 声明隔离

```
GIVEN  EventWeaver 和 TaskArena 同时加载
       两者都注册了 after_write Hook

WHEN   一条 ew_event 消息写入

THEN   EventWeaver 的 Hook 被触发
       TaskArena 的 Hook 也被触发（如果监听相同 trigger）
       两者互不干扰
       执行顺序按 priority 排序
```

---

## §2 Socialware Identity

> **Spec 引用**：socialware-spec §2, §3

### TC-5-SW-010: Socialware 创建并获取 Identity

```
GIVEN  Platform Bus 已启动

WHEN   通过 Python API 创建 EventWeaver:
       sw = await ezagent.socialware.create("event-weaver", declaration)

THEN   EventWeaver 获得独立 Identity: @event-weaver:<relay>
       Ed25519 密钥对自动生成
       Identity 注册到 Platform Bus
```

### TC-5-SW-011: Socialware Identity 在 Platform Bus 上可发现

```
GIVEN  EventWeaver 已创建

WHEN   查询 Platform Bus 成员

THEN   @event-weaver:<relay> 出现在成员列表中
       sw:capability-manifest Message 已发送
```

### TC-5-SW-012: Inner Bus 创建

```
GIVEN  EventWeaver 已创建

WHEN   EventWeaver 运行时初始化

THEN   Inner Bus (Bus 实例) 创建
       Inner Bus 的 Room 用于内部成员通信
       Inner Bus 与 Platform Bus 是独立的 Bus 实例
```

---

## §3 四原语运行时

> **Spec 引用**：socialware-spec §1

### TC-5-SW-020: Role 赋予与检查

```
GIVEN  TaskArena 已加载
       E-alice 是 Room 成员

WHEN   将 ta:worker Role 赋予 E-alice:
       await arena.roles.assign("@alice:...", "ta:worker")

THEN   E-alice 拥有 ta:worker Role
       await arena.roles.check("@alice:...", "ta:worker") == True
       await arena.roles.check("@alice:...", "ta:reviewer") == False
```

### TC-5-SW-021: Role 赋予 Entity 类型约束

```
GIVEN  ta:marketplace Role 的 assignable_to = ["room"]

WHEN   尝试将 ta:marketplace 赋予 E-alice (Identity)

THEN   拒绝，报错 "Role ta:marketplace can only be assigned to room"
```

### TC-5-SW-022: Role 动态撤回

```
GIVEN  E-alice 拥有 ta:worker Role

WHEN   await arena.roles.revoke("@alice:...", "ta:worker")

THEN   E-alice 不再拥有 ta:worker
       后续 Flow transition 中 visible_to "role:ta:worker" 的按钮对 E-alice 不可见
```

### TC-5-SW-023: Arena 边界 — internal

```
GIVEN  TaskArena 的 ta:task_workshop Arena (boundary=internal)

WHEN   Platform Bus 上的外部 Entity 尝试读取 workshop Room 的消息

THEN   被拒绝（internal Arena 仅 Socialware 内部成员可访问）
```

### TC-5-SW-024: Arena 边界 — external

```
GIVEN  TaskArena 的 ta:task_marketplace Arena (boundary=external)

WHEN   Platform Bus 上的任意 Entity 尝试发现 marketplace

THEN   可发现（external Arena 在 Platform Bus 上可见）
       可以按 entry_policy 加入
```

### TC-5-SW-025: Arena 边界 — federated

```
GIVEN  TaskArena 和 ResPool 之间的 federated Arena

WHEN   TaskArena 请求 ResPool 发放奖励

THEN   通过 federated Arena 的专用通道通信
       不经过 Platform Bus 的公开 Timeline
```

### TC-5-SW-026: Commitment 创建与查询

```
GIVEN  TaskArena 中 E-publisher 发布了 ta_task，E-worker 认领

WHEN   Commitment 创建：
       ta:reward_guarantee (between: [publisher, worker],
         obligation: "Publisher pays 50 USD upon approval",
         triggered_by: "ta_task.state == approved")

THEN   Commitment 记录可查询：
       await arena.commitments.list(entity="@publisher:...") 返回该 Commitment
       Commitment 状态为 "active"
```

### TC-5-SW-027: Commitment 兑现触发 Flow

```
GIVEN  ta:reward_guarantee 已创建
       ta_task Flow state 变为 "approved"

WHEN   Commitment triggered_by 条件满足

THEN   Commitment 标记为 "fulfilled"
       触发 ResPool 的 rp_request（奖励发放）
       Flow 记录 commitment fulfillment 事件
```

### TC-5-SW-028: Flow 状态转换

```
GIVEN  ta_task 的 ta:task_lifecycle Flow，当前 state = "open"

WHEN   执行 transition "open → claimed" (trigger: worker claims):
       await arena.flows.advance("ta:task_lifecycle", task_ref, "claimed")

THEN   state 变为 "claimed"
       Annotation 写入记录 transition
       CRDT 同步
       UI 更新 badge + 按钮可见性
```

### TC-5-SW-029: Flow 非法 transition 拒绝

```
GIVEN  ta_task state = "open"

WHEN   尝试 transition "open → approved"（不在合法 transitions 列表中）

THEN   拒绝，报错 "Invalid transition: open → approved not defined"
       state 保持 "open"
```

### TC-5-SW-030: Flow preferences 影响行为

```
GIVEN  ew:conflict_resolution Flow 的 preference:
       auto_merge_when_no_conflict = true

WHEN   ew_merge_request 无冲突

THEN   Flow 自动执行 transition → merged
       无需人工介入
```

---

## §4 Platform Bus

> **Spec 引用**：socialware-spec §3

### TC-5-SW-040: Socialware 注册到 Platform Bus

```
GIVEN  Platform Bus 运行中

WHEN   创建 TaskArena

THEN   TaskArena Identity 加入 Platform Bus Room
       发送 sw:capability-manifest Message:
       { capabilities: ["task_management", "bounty_system"],
         datatypes: ["ta_task", "ta_submission", "ta_verdict"],
         version: "0.1.0" }
```

### TC-5-SW-041: 能力发现

```
GIVEN  EventWeaver 和 TaskArena 都已注册

WHEN   查询能力:
       await platform.capabilities.search("task")

THEN   返回 TaskArena 的 capability manifest
       EventWeaver 不匹配 "task" → 不返回
```

### TC-5-SW-042: Socialware 间 Message 交换

```
GIVEN  TaskArena 和 ResPool 都在 Platform Bus 上

WHEN   TaskArena 发送 Message 给 ResPool:
       { type: "rp_request", payload: { resource: "USD", amount: 50, ... } }

THEN   ResPool 收到请求
       通过 Platform Bus Timeline 传递
```

---

## §5 组合操作

> **Spec 引用**：socialware-spec §4

### TC-5-SW-050: Fork — 快照模式

```
GIVEN  TaskArena 已运行，有 10 个 active task

WHEN   Fork(TaskArena, mode="snapshot"):
       taskarena_cn = await platform.fork("task-arena", "task-arena-cn", mode="snapshot")

THEN   TaskArena-CN 创建成功：
       - 新 Identity: @task-arena-cn:<relay>
       - Part A + Part B 完整复制
       - Runtime 包含 10 个 task 的快照
       - 两者独立：后续 TaskArena 的变化不影响 CN
       EventWeaver 记录 ew_event { event_type: "socialware_forked" }
```

### TC-5-SW-051: Fork — 空白模式

```
GIVEN  TaskArena 已运行

WHEN   Fork(TaskArena, mode="empty"):
       taskarena_beta = await platform.fork("task-arena", "task-arena-beta", mode="empty")

THEN   TaskArena-Beta 创建成功：
       - Part A + Part B 完整复制
       - Runtime 为空（无 task 数据）
       - 结构相同，数据独立
```

### TC-5-SW-052: Compose — 联邦

```
GIVEN  TaskArena 和 ResPool 独立运行

WHEN   Compose([TaskArena, ResPool]) → WorkflowHub:
       hub = await platform.compose(
         name="workflow-hub",
         members=["task-arena", "respool"],
         federated_arenas=[("ta:reward_channel", "rp:request_channel")]
       )

THEN   WorkflowHub 创建成功：
       - 新 Identity 作为联邦 Socialware
       - TaskArena 和 ResPool 通过 federated Arena 通信
       - 各自保持独立 Inner Bus
```

### TC-5-SW-053: Merge — 同构合并

```
GIVEN  TaskArena-A 和 TaskArena-B 是结构相同的两个实例

WHEN   Merge(TaskArena-A, TaskArena-B):
       merged = await platform.merge("task-arena-a", "task-arena-b")

THEN   合并成功：
       - 新实例继承两者的数据
       - CRDT 自动合并（最终一致性）
       - 冲突由 EventWeaver 分支管理处理
       - 原 A 和 B 的 Identity 被标记为 archived
```

### TC-5-SW-054: Fork 后 Identity 独立

```
GIVEN  Fork 产生了 TaskArena 和 TaskArena-CN

WHEN   TaskArena 中 E-alice 发布 task
       TaskArena-CN 中 E-bob 发布 task

THEN   两个 task 在各自 Inner Bus 中
       Platform Bus 上两者是独立 Entity
       互不影响
```

---

## §6 Bootstrap 与生命周期

> **Spec 引用**：socialware-spec §5

### TC-5-SW-060: Bootstrap EventWeaver 自举

```
GIVEN  全新平台启动

WHEN   Bootstrap 流程执行：
       1. Platform Bus 创建
       2. Bootstrap EventWeaver 创建

THEN   EventWeaver 自身的创建被记录在自己的 DAG 中
       ew_event { event_type: "socialware_created", payload: { id: "event-weaver" } }
       自举完成（EventWeaver 记录自己的诞生）
```

### TC-5-SW-061: 后续 Socialware 经 EventWeaver 记录

```
GIVEN  Bootstrap EventWeaver 已运行

WHEN   创建 ResPool

THEN   EventWeaver 自动记录：
       ew_event { event_type: "socialware_created", payload: { id: "respool" } }
       await ew.lifecycle.get(socialware="respool") 返回创建记录
```

### TC-5-SW-062: Socialware 生命周期完整链

```
GIVEN  TaskArena 已运行

WHEN   依次执行：Fork → 修改配置 → Compose → Merge

THEN   EventWeaver DAG 完整记录所有事件：
       socialware_created → socialware_forked → socialware_config_updated →
       socialware_composed → socialware_merged
       所有事件有因果链连接
```

---

## §7 Human-in-the-Loop

> **Spec 引用**：socialware-spec §6

### TC-5-SW-070: Identity 级 HiTL — Role 手动转移

```
GIVEN  E-agent-r1 拥有 ta:reviewer Role
       管理员决定暂时由人类接管

WHEN   管理员将 ta:reviewer Role 从 E-agent-r1 转移给 E-alice:
       await arena.roles.revoke("@agent-r1:...", "ta:reviewer")
       await arena.roles.assign("@alice:...", "ta:reviewer")

THEN   E-alice 在 UI 中看到 review 相关的 Action 按钮
       E-agent-r1 不再看到
       所有参与者可见 Role 转移（透明）
```

### TC-5-SW-071: Session 级 HiTL — 置信度触发

```
GIVEN  E-agent-r1 连续 3 次在 review 中被纠正
       Flow preference: escalate_when(consecutive_corrections >= 3)

WHEN   第 3 次纠正发生

THEN   Hook 检测到条件满足
       写入 escalation Annotation
       E-alice（designated backup）被赋予 ta:reviewer Role
       该 session 的后续 review 由 E-alice 处理
```

### TC-5-SW-072: Task 级 HiTL — Flow preference 标记

```
GIVEN  ta_task 标记 requires_human_review = true

WHEN   task 进入 "under_review" state

THEN   Flow preference 生效：只有 Human Identity 可以 advance 到 approved/rejected
       Agent 的 advanceFlow 调用被拒绝
```

### TC-5-SW-073: HiTL 透明性

```
GIVEN  HiTL 发生：Role 从 Agent 转移给 Human

WHEN   查看 EventWeaver DAG

THEN   存在 ew_event { event_type: "hitl_escalation",
         payload: { from: "@agent-r1:...", to: "@alice:...", role: "ta:reviewer" } }
       所有参与者可在 Timeline 中看到转移记录
```

### TC-5-SW-074: HiTL 训练数据收集

```
GIVEN  E-alice 通过 HiTL 处理了 5 个 review

WHEN   查询人类介入记录:
       await ew.lifecycle.query(event_type="hitl_*")

THEN   返回 5 条记录
       每条含 original_agent, human_handler, task_ref, decision
       可用于后续 Agent 训练
```

---

## §8 EventWeaver 功能验证

> **Spec 引用**：eventweaver-prd.md §5
> **注意**：以下 TC-EW-* 测试用例定义在 eventweaver-prd.md 中，此处引用。

### §8.1 事件基础
- **TC-EW-001**: 事件写入与因果验证
- **TC-EW-002**: 因果链完整性
- **TC-EW-003**: 因果环检测与拒绝
- **TC-EW-004**: 引用不存在的因果前驱

### §8.2 分支管理
- **TC-EW-010**: 创建分支
- **TC-EW-011**: 分支内独立写入
- **TC-EW-012**: 无冲突自动合并
- **TC-EW-013**: 有冲突的合并请求

### §8.3 生命周期管理
- **TC-EW-020**: 记录 Socialware 创建事件
- **TC-EW-021**: 记录 Socialware Fork 事件

### §8.4 HiTL 场景
- **TC-EW-030**: 冲突解决中的 HiTL 升级

### TC-5-EW-001: DAG Index 查询性能

```
GIVEN  EventWeaver 中有 1000 个事件形成 DAG

WHEN   await ew.dag.get(room_id, depth=10)（从 latest 向上回溯 10 层）

THEN   返回结果 < 500ms
       DAG 结构正确（parent 引用无断链）
```

### TC-5-EW-002: 多分支并行

```
GIVEN  R-ew-main 在 evt-005 处
       从 evt-003 fork 出 R-branch-a
       从 evt-004 fork 出 R-branch-b

WHEN   两个分支各自独立写入

THEN   await ew.branches.list(room_id) 返回 2 个分支
       每个分支有独立的 fork_point
       主线继续不受影响
```

### TC-5-EW-003: DAG 可视化数据输出

```
GIVEN  EventWeaver DAG 有 20 个节点和因果边

WHEN   Level 2 Widget (sw:ew:dag_view) 请求数据

THEN   props.data.query_results 包含：
       { nodes: [...20个], edges: [...因果关系] }
       足够 d3/cytoscape 渲染完整 DAG
```

---

## §9 TaskArena 功能验证

> **Spec 引用**：taskarena-prd.md §5
> **注意**：以下 TC-TA-* 测试用例定义在 taskarena-prd.md 中，此处引用。

### §9.1 任务发布与认领
- **TC-TA-001**: 发布 Bounty 任务
- **TC-TA-002**: Worker 认领任务
- **TC-TA-003**: 技能不匹配认领被拒
- **TC-TA-004**: Assigned 任务直接进入 claimed

### §9.2 评审流程
- **TC-TA-010**: 提交成果并触发评审分配
- **TC-TA-011**: Reviewer 评审通过
- **TC-TA-012**: 评审意见不一致需额外 Reviewer
- **TC-TA-013**: Verdict feedback 验证

### §9.3 争议流程
- **TC-TA-020**: Worker 发起争议
- **TC-TA-021**: Agent Arbitrator 处理清晰案例
- **TC-TA-022**: 复杂争议升级到 Human

### §9.4 信誉演进
- **TC-TA-030**: 从 newcomer 升级到 active

### TC-5-TA-001: 11-state 完整生命周期

```
GIVEN  TaskArena 运行中

WHEN   一个 task 经历完整生命周期：
       open → claimed → (submitted) → in_review → approved → archived

THEN   每个 transition 都：
       - 写入状态 Annotation
       - 触发 after_write Hook
       - CRDT 同步
       - UI 更新 badge + buttons
       EventWeaver 记录完整事件链
```

### TC-5-TA-002: 争议触发 EventWeaver 分支

```
GIVEN  ta_task state = "rejected"
       E-worker 不同意

WHEN   E-worker 发起争议 → state = "disputed"

THEN   自动创建 EventWeaver branch
       ew_branch { parent_room: taskroom, fork_point: rejection_event }
       Tribunal Arena 激活
       E-arbiter 被赋予仲裁 Role
```

### TC-5-TA-003: 奖励发放跨 Socialware

```
GIVEN  TaskArena 和 ResPool 通过 Compose 关联
       ta_task state 变为 "approved"
       Commitment ta:reward_guarantee 条件满足

WHEN   Commitment 触发

THEN   TaskArena 向 ResPool 发送 rp_request
       ResPool 自动匹配 → 生成 rp_allocation
       E-worker 收到奖励
       整个过程记录在 EventWeaver DAG 中
```

### TC-5-TA-004: Kanban Board 渲染

```
GIVEN  TaskArena Room 有 5 个 task（2 open, 1 claimed, 1 in_review, 1 approved）

WHEN   切换到 Board Tab

THEN   Kanban 显示 11 列（Flow states），其中 4 列有卡片
       每张卡片使用 ta_task 的 structured_card renderer
       拖拽功能按 Role 控制
```

---

## §10 ResPool 功能验证

> **Spec 引用**：respool-prd.md §5
> **注意**：以下 TC-RP-* 测试用例定义在 respool-prd.md 中，此处引用。

### §10.1 资源注册与发现
- **TC-RP-001**: Provider 注册资源
- **TC-RP-002**: 资源发现与过滤

### §10.2 申请与分配
- **TC-RP-010**: 标准资源申请与自动匹配
- **TC-RP-011**: 配额超限拒绝
- **TC-RP-012**: 资源不足匹配失败
- **TC-RP-013**: 预算超限匹配失败

### §10.3 使用与计量
- **TC-RP-020**: 使用量上报与累计
- **TC-RP-021**: 资源耗尽
- **TC-RP-022**: 正常释放与结算

### §10.4 跨 Socialware 协作
- **TC-RP-030**: TaskArena 请求奖励发放

### §10.5 HiTL 场景
- **TC-RP-040**: Human 劳动力资源的分配需要人工确认

### TC-5-RP-001: 资源 Marketplace Tab 渲染

```
GIVEN  ResPool Room 有 3 个 rp_resource（GPU, USD, Human-hour）

WHEN   切换到 Marketplace Tab (table layout)

THEN   表格显示：
       NAME       TYPE        CAPACITY    AVAILABLE    PRICE
       GPU-A100   compute     100 h       72 h         $2.5/h
       USD-Pool   currency    10000       8500         —
       Design-HR  human       160 h/mo    40 h         $50/h
```

### TC-5-RP-002: 配额 Hook 实时检查

```
GIVEN  E-worker 的 rp_quota = 100 GPU-hours
       已使用 95 hours

WHEN   E-worker 请求 10 GPU-hours

THEN   rp:check_quota Hook 拒绝：
       "Quota exceeded: 95 + 10 > 100"
       rp_request 不被创建
```

---

## §11 跨 Socialware 集成

### TC-5-CROSS-001: TaskArena + EventWeaver + ResPool 完整流程

```
GIVEN  三个 Socialware 均在 Platform Bus 上运行

WHEN   完整流程：
       1. Publisher 发布 task (TaskArena)
       2. Worker 认领 (TaskArena)
       3. Worker 提交 (TaskArena)
       4. Reviewer 通过 (TaskArena)
       5. 奖励发放 (ResPool)

THEN   EventWeaver 记录完整因果链：
       task_created → task_claimed → submission_created →
       review_started → review_approved → reward_requested →
       reward_allocated
       所有事件有正确的 causality 关系
```

### TC-5-CROSS-002: 争议升级跨三个 Socialware

```
GIVEN  TaskArena task 被 rejected → 发起 dispute

WHEN   争议流程：
       1. EventWeaver 创建 dispute branch
       2. Arbiter 判定 Worker 有理
       3. ResPool 重新发放奖励

THEN   EventWeaver DAG 记录分支和解决
       TaskArena Flow: rejected → disputed → resolved → approved
       ResPool: 新的 rp_request → rp_allocation
```

### TC-5-CROSS-003: Platform Bus 上的 Socialware 发现

```
GIVEN  5 个 Socialware 在 Platform Bus 上

WHEN   新用户查看平台能力:
       await platform.capabilities.list()

THEN   返回 5 个 Socialware 的 capability manifest
       每个含 name, version, capabilities, datatypes
```

### TC-5-CROSS-004: Fork + 独立演化

```
GIVEN  TaskArena 有 3 个 active task

WHEN   Fork TaskArena → TaskArena-CN (snapshot mode)
       TaskArena 中又发布了 2 个 task
       TaskArena-CN 中发布了 1 个 task

THEN   TaskArena 有 5 个 task
       TaskArena-CN 有 4 个 task
       两者在 Platform Bus 上是独立 Entity
       各自的 EventWeaver 记录独立
```

---

## §12 Socialware UI 集成

### TC-5-UI-001: structured_card + Flow Actions 端到端

```
GIVEN  TaskArena Room，E-alice 有 ta:worker Role

WHEN   Agent 发送 ta_task:
       { title: "Design logo", reward: 200, deadline: "2026-03-15", status: "open" }

THEN   Chat UI 显示 structured_card:
       标题 "Design logo", 💰 200 USD, 🕐 18 days
       badge "Open" (蓝色)
       [Claim Task] 按钮可见

WHEN   E-alice 点击 [Claim Task]

THEN   badge → "Claimed" (黄色)
       [Claim Task] 消失
       Agent 响应
```

### TC-5-UI-002: Room Tab 来自 Socialware UI Manifest

```
GIVEN  TaskArena Part C 声明 views: [kanban board, review split_pane]

WHEN   进入 TaskArena Room

THEN   Tab header: [Messages] [Board] [Review]
       Board 使用 Level 1 kanban layout
       Review 使用 Level 2 自定义 split_pane 组件
```

### TC-5-UI-003: EventWeaver DAG View (Level 2)

```
GIVEN  EventWeaver Part C 声明 views: [dag_view (Level 2)]
       Widget SDK 注册 sw:ew:dag_view 组件

WHEN   切换到 DAG Tab

THEN   自定义 d3/cytoscape 组件渲染 DAG
       节点 = 事件，边 = 因果关系
       可缩放、拖拽、点击查看事件详情
```

---

## §13 Socialware 安装与生命周期

> **Spec 引用**：socialware-spec §7

### TC-5-INST-001: registry.toml 读取与启动

```
GIVEN  ezagent/socialware/registry.toml 包含 3 个条目:
       event-weaver (auto_start=true), task-arena (auto_start=true), res-pool (auto_start=false)

WHEN   节点启动

THEN   event-weaver 和 task-arena 自动启动
       res-pool 不启动（auto_start=false）
       启动顺序遵循依赖关系: event-weaver 先于 task-arena
```

### TC-5-INST-002: manifest.toml 加载

```
GIVEN  ezagent/socialware/task-arena/manifest.toml 包含:
       datatypes, hooks, roles, commands, dependencies

WHEN   task-arena 启动

THEN   datatypes 注册到 Engine
       hooks 注册到 Hook Pipeline (priority >= 100)
       roles 注册到 Socialware Runtime
       commands 展开为 command_manifest 并写入 Profile Annotation
       dependencies 验证通过（event-weaver 已启动，EXT-15 已启用）
```

### TC-5-INST-003: 依赖缺失拒绝启动

```
GIVEN  task-arena manifest 声明 dependencies.socialware = ["event-weaver"]
       event-weaver 未安装或未启动

WHEN   task-arena 尝试启动

THEN   启动失败
       错误: "Dependency not satisfied: event-weaver is not running"
```

### TC-5-INST-004: 命令命名空间唯一性检查

```
GIVEN  task-arena 已安装 (ns=ta)

WHEN   安装新 Socialware manifest 声明 [commands] 中 ns="ta"

THEN   安装拒绝
       错误: "Command namespace 'ta' already registered by task-arena"
```

### TC-5-INST-005: Socialware 停止与重启

```
GIVEN  task-arena 运行中

WHEN   执行 stop:
       await platform.socialware.stop("task-arena")

THEN   Hook 注销
       从 Platform Bus 下线
       command_manifest Annotation 保留（Profile 数据不删除）

WHEN   重新启动

THEN   Identity 恢复（从本地密钥对）
       Hook 重新注册
       command_manifest 更新
```

### TC-5-INST-006: Socialware 卸载

```
GIVEN  task-arena 运行中

WHEN   执行 uninstall:
       await platform.socialware.uninstall("task-arena")

THEN   task-arena 停止
       registry.toml 中移除条目
       ezagent/socialware/task-arena/ 目录归档
       已创建的协议层数据（CRDT 文档、Annotations）保留
```

---

## §14 Socialware Commands (EXT-15 集成)

> **Spec 引用**：socialware-spec §8, extensions-spec §16

### TC-5-CMD-001: 命令声明 → Profile Annotation 发布

```
GIVEN  task-arena manifest.toml [commands] 包含 7 个命令

WHEN   task-arena 启动

THEN   Profile Annotation "command_manifest:task-arena" 写入:
       { ns: "ta", commands: [{action: "claim", ...}, {action: "post-task", ...}, ...] }
       command_manifest_registry Index 包含 ta:* 命令
```

### TC-5-CMD-002: 命令端到端执行 — 成功

```
GIVEN  TaskArena 运行中
       E-alice 拥有 ta:worker Role
       task-42 状态为 open

WHEN   E-alice 发送: /ta:claim task-42

THEN   1. pre_send Hook 验证通过（ns 存在、action 存在、params 合法、role 匹配）
       2. Ref 写入 Timeline（含 ext.command）
       3. after_write Hook 派发到 TaskArena
       4. TaskArena Hook 执行业务逻辑（task-42: open → claimed）
       5. command_result Annotation 写入: { status: "success", result: { new_state: "claimed" } }
       6. SSE: command.result 事件
       7. 客户端显示结果卡片
```

### TC-5-CMD-003: 命令端到端执行 — 失败

```
GIVEN  TaskArena 运行中
       task-99 不存在

WHEN   E-alice 发送: /ta:claim task-99

THEN   1. pre_send 验证通过（语法层合法）
       2. Ref 写入 Timeline
       3. TaskArena Hook 处理: task-99 not found
       4. command_result: { status: "error", error: "Task task-99 not found" }
       5. 客户端显示错误提示
```

### TC-5-CMD-004: 多 Socialware 命令并存

```
GIVEN  EventWeaver (ew), TaskArena (ta), ResPool (rp), AgentForge (af) 均已启动

WHEN   查询所有可用命令

THEN   4 个命名空间的命令均可发现
       /ew:branch, /ta:claim, /rp:allocate, /af:spawn 均可执行
       各 Socialware 的 Hook 独立处理自己的命令
```

### TC-5-CMD-005: 自动补全数据

```
GIVEN  客户端获取 command_manifest_registry Index

WHEN   用户在输入框输入 "/"

THEN   自动补全菜单显示所有可用命令（按 ns 分组）
       输入 "/ta:" 时过滤为 TaskArena 命令
       选择 "/ta:claim" 后显示 task_id 参数提示
```

---

## §15 AgentForge 功能验证

> **Spec 引用**：agentforge-prd.md

### TC-5-AF-001: Agent 模板注册

```
GIVEN  AgentForge 运行中

WHEN   Admin 注册模板:
       /af:register-template --id code-reviewer --adapter claude-code --config '{"model":"sonnet"}'

THEN   模板写入 templates/code-reviewer.toml
       agent_template_list Index 包含 code-reviewer
```

### TC-5-AF-002: Spawn Agent

```
GIVEN  code-reviewer 模板已注册
       E-alice 拥有 af:operator Role

WHEN   E-alice 发送: /af:spawn --template code-reviewer --name "Review-Bot"

THEN   1. 创建 Agent Identity: @review-bot:relay-a.example.com
       2. 密钥对生成并持久化
       3. Agent 加入当前 Room
       4. Profile 发布: { display_name: "Review-Bot", type: "agent", template: "code-reviewer" }
       5. af_instance Annotation 写入: { status: "ACTIVE", template_id: "code-reviewer", ... }
       6. agents/review-bot/config.toml 创建
       7. command_result: { status: "success", result: { agent_name: "Review-Bot", status: "ACTIVE" } }
```

### TC-5-AF-003: @mention 触发 Agent 响应

```
GIVEN  Review-Bot (ACTIVE) 在 R-alpha

WHEN   E-alice 发送: "@Review-Bot check PR #501 for SQL injection"

THEN   1. af.on_mention Hook 检测到 @mention
       2. Conversation Segment 构建:
          - 回溯 Reply chain / Thread
          - 补充同 Channel 近期消息
       3. ClaudeCodeAdapter 调用 API:
          - system prompt = soul.md 内容
          - messages = Segment 消息列表
          - user message = "check PR #501 for SQL injection"
       4. 流式响应通过 EXT-01 Mutable Content 实时更新
       5. 最终 response 完整写入 Room
```

### TC-5-AF-004: Agent 空闲休眠

```
GIVEN  Review-Bot (ACTIVE), idle_timeout = "1h"
       Review-Bot 最后活动时间 > 1h

WHEN   af.idle_check 定时 Hook 触发

THEN   Review-Bot status: ACTIVE → SLEEPING
       Adapter 进程/连接释放
       af_instance Annotation 更新
       Agent Identity 保持（协议层可见）
```

### TC-5-AF-005: @mention 自动唤醒

```
GIVEN  Review-Bot (SLEEPING), auto_wake_on_mention = true

WHEN   E-bob 发送: "@Review-Bot review this fix"

THEN   1. af.auto_wake Hook 检测 SLEEPING + @mention
       2. Agent status: SLEEPING → ACTIVE
       3. Adapter 重建
       4. 正常处理消息（同 TC-5-AF-003）
       5. 用户无感知（不需要手动唤醒）
```

### TC-5-AF-006: Destroy Agent

```
GIVEN  Review-Bot (ACTIVE 或 SLEEPING)
       E-alice 拥有 af:operator Role

WHEN   E-alice 发送: /af:destroy --name "Review-Bot"

THEN   1. Agent Hook 注销
       2. Agent 退出所有 Room
       3. Agent Identity 归档（不删除，保留历史消息的 author 引用）
       4. agents/review-bot/ 目录归档
       5. af_instance Annotation 更新: { status: "DESTROYED" }
```

### TC-5-AF-007: 资源控制 — 并发限制

```
GIVEN  Review-Bot, max_concurrent = 2
       Review-Bot 正在处理 2 条消息

WHEN   第 3 条 @mention 到达

THEN   新请求排队等待
       超时后返回: "Agent busy, please try again later"
```

### TC-5-AF-008: 资源控制 — API 预算耗尽

```
GIVEN  Review-Bot, api_budget_daily = 100
       今日已使用 100 次

WHEN   新 @mention 到达

THEN   Agent status: ACTIVE → SLEEPING
       返回: "Daily API budget exhausted, agent is now sleeping"
```

### TC-5-AF-009: Conversation Segment — Thread 模式

```
GIVEN  Review-Bot 在 Thread 中被 @mention
       Thread 有 15 条消息

WHEN   Segment 构建

THEN   Segment = Thread 全部消息（而非 Room 主 Timeline）
       Token 预算内截断（如果超过 max_context_tokens）
```

### TC-5-AF-010: Conversation Segment — Reply chain 模式

```
GIVEN  E-alice 发送 M-A → E-bob reply M-B → E-alice reply M-C → "@Review-Bot help"

WHEN   Segment 构建

THEN   Segment 包含: M-A → M-B → M-C → 当前消息
       而非最近 N 条无关消息
       Token 节省 > 60%
```

### TC-5-AF-011: 多 Agent 并存

```
GIVEN  Review-Bot (code-reviewer) 和 Tester-Bot (task-worker) 同时在 R-alpha

WHEN   E-alice 发送: "@Review-Bot review this" 和 "@Tester-Bot test this"

THEN   两个 Agent 独立响应
       各自的 Adapter 独立调用
       不互相干扰
```

---

## 附录：Test Case 统计

| 区域 | 编号范围 | 数量 |
|------|---------|------|
| 声明解析 | TC-5-SW-001~004 | 4 |
| Socialware Identity | TC-5-SW-010~012 | 3 |
| 四原语运行时 | TC-5-SW-020~030 | 11 |
| Platform Bus | TC-5-SW-040~042 | 3 |
| 组合操作 | TC-5-SW-050~054 | 5 |
| Bootstrap/生命周期 | TC-5-SW-060~062 | 3 |
| Human-in-the-Loop | TC-5-SW-070~074 | 5 |
| EventWeaver 新增 | TC-5-EW-001~003 | 3 |
| EventWeaver PRD 引用 | TC-EW-001~030 | 11 |
| TaskArena 新增 | TC-5-TA-001~004 | 4 |
| TaskArena PRD 引用 | TC-TA-001~030 | 12 |
| ResPool 新增 | TC-5-RP-001~002 | 2 |
| ResPool PRD 引用 | TC-RP-001~040 | 11 |
| 跨 Socialware 集成 | TC-5-CROSS-001~004 | 4 |
| Socialware UI 集成 | TC-5-UI-001~003 | 3 |
| Socialware 安装 | TC-5-INST-001~006 | 6 |
| Socialware Commands | TC-5-CMD-001~005 | 5 |
| AgentForge | TC-5-AF-001~011 | 11 |
| **合计（含引用）** | | **106** |
| **合计（新增 test case）** | | **72** |

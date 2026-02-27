# EventWeaver — Product Requirements Document v0.2.1

> **状态**：Draft
> **日期**：2026-02-26
> **前置文档**：ezagent-socialware-spec-v0.9.1
> **定位**：平台基础设施级 Socialware

---

## 1. 产品概述

### 1.1 产品定位

EventWeaver 是 ezagent 平台的**版本控制系统**。它管理平台上所有事件的因果关系、分叉与合并，同时作为所有 Socialware 生命周期事件的权威记录者。

EventWeaver 是 Bootstrap Socialware——平台启动时第一个被创建的 Socialware，所有后续 Socialware 的创建、Fork、Compose、Merge 都通过 EventWeaver 记录。

### 1.2 核心价值

**因果可追溯**：任何事件都可以追溯到它的因果前驱链，回答"为什么会发生这件事"。

**分支即实验**：任何协作流程都可以在分支中进行实验性变更，不影响主线，验证后再合并。

**组织记忆**：Socialware 的整个演化历程（创建、分拆、合并、暂停）被忠实记录，组织的历史不会丢失。

### 1.3 用户角色

| 角色 | 典型用户 | 核心需求 |
|------|---------|---------|
| Event Emitter | 其他 Socialware、Human、Agent | 记录事件及其因果关系 |
| Branch Owner | 项目负责人、实验发起者 | 创建独立分支进行探索 |
| Merger | 技术负责人、架构师 | 审查和执行分支合并 |
| Observer | 审计员、分析师、任何好奇者 | 查询事件历史和因果图 |
| Platform Admin | 平台运营者 | 管理 Socialware 生命周期 |

---

## 2. 使用场景

### 场景 1：TaskArena 争议的分支管理

**背景**：Worker 提交了代码审查任务的成果，Reviewer 认为不符合要求并拒绝。Worker 不同意，发起争议。

**流程**：

1. TaskArena 向 EventWeaver 发送"task_disputed"事件，包含因果链：task_created → task_claimed → submission_created → verdict_rejected → task_disputed
2. EventWeaver 自动创建一个**争议分支**（新 Room），fork 自主线的 dispute 时间点
3. 双方在争议分支中提交额外证据（作为新的事件写入分支）
4. 仲裁者在分支中发出裁决事件
5. 裁决完成后，Merger 发起 merge request 将争议分支合并回主线
6. EventWeaver 检测到无冲突，自动合并
7. 主线 Timeline 中出现完整的争议-裁决记录

**价值**：争议过程不干扰主线的其他 task 流转，同时争议的完整历史被保留。

### 场景 2：Socialware 的 A/B 实验

**背景**：TaskArena 想测试新的评审机制——将 min_reviewers 从 2 改为 3，但不确定效果。

**流程**：

1. Platform Admin 通过 EventWeaver 创建一个分支，fork 自 TaskArena 的当前配置
2. 在分支中修改配置（新的 task 在分支中使用 3 reviewer）
3. 运行两周，收集对比数据
4. 如果效果好 → Merger 发起 merge request，将新配置合并回主线
5. 如果效果差 → 放弃分支（abandon）

**价值**：无风险实验，主线服务不中断。

### 场景 3：Socialware 的分拆记录

**背景**：TaskArena 决定将中国区运营分拆为独立的 TaskArena-CN。

**流程**：

1. Platform Admin 发起 Fork 操作
2. EventWeaver 记录 `socialware_forked` 事件，包含 source（TaskArena）、target（TaskArena-CN）、fork_type（snapshot）
3. Fork 完成后，TaskArena 和 TaskArena-CN 各自独立演化
4. 如果未来需要重新合并，EventWeaver 的 DAG 记录了分叉点，可以精确定位需要调和的差异

**价值**：组织演化的完整记忆，支持未来的合并决策。

### 场景 4：跨 Socialware 的事件因果追踪

**背景**：一个用户反馈"我的 task 奖励迟迟没有到账"。

**流程**：

1. Observer 通过 EventWeaver 的 DAG 查询，找到 `task_completed` 事件
2. 追溯因果链：task_completed → reward_requested → resource_request_sent
3. 发现 resource_request_sent 之后没有后续事件——说明 ResPool 没有响应
4. 进一步查询 ResPool 相关事件：发现 ResPool 当时处于 `suspended` 状态
5. 根因定位完成

**价值**：跨 Socialware 的因果链追踪，支持故障诊断。

### 场景 5：合并冲突的人工解决

**背景**：两个分支同时对 TaskArena 的评审流程进行了不同修改。分支 A 增加了 "peer_review" 状态，分支 B 将 "under_review" 拆分为 "first_review" 和 "second_review"。

**流程**：

1. Merger 发起 merge request，将分支 A 和 B 合并
2. EventWeaver 的 `ew:detect_conflict` Hook 检测到 Flow 状态冲突
3. 冲突信息写入 `ew:conflict` Annotation：两个分支对 `task_lifecycle` Flow 做了不兼容的修改
4. Agent 尝试自动解决（置信度 0.4，低于阈值）→ escalate to Human
5. Human Merger 进入 merge_chamber Arena，查看两个分支的差异
6. Human 决定采用分支 B 的方案并手动整合分支 A 的 peer_review 概念
7. Human 写入 `ew:approved` Annotation，附带解决方案
8. EventWeaver 执行合并

**价值**：Agent 处理简单冲突，Human 处理复杂冲突，HiTL 自然涌现。

---

## 3. Part A: Bus 层声明

```yaml
id: "eventweaver"
version: "0.1.0"
dependencies: ["identity", "room", "timeline", "message"]
```

### 3.1 Datatypes

#### ew_event — 事件记录

| 字段 | 值 |
|------|---|
| id | `ew_event` |
| storage_type | `crdt_map` |
| key_pattern | `ezagent/{room_id}/ew/events/{event_id}` |
| persistent | `true` |
| writer_rule | `signer ∈ room.members` |

```yaml
ew_event:
  event_id:      ULID
  event_type:    string          # 自由定义，由消费者约定语义
  payload:       any             # 事件内容，JSON-compatible
  causality:     [ULID]          # 因果前驱事件的 event_id 列表
  actor:         Entity ID       # 触发者
  source_ref:    Ref ID | null   # 关联的 Timeline Ref（如来自某条 Message）
  created_at:    RFC 3339
```

#### ew_branch — 分支声明

| 字段 | 值 |
|------|---|
| id | `ew_branch` |
| storage_type | `crdt_map` |
| key_pattern | `ezagent/{room_id}/ew/branches/{branch_id}` |
| persistent | `true` |
| writer_rule | `signer ∈ room.members AND signer has capability(branch.create)` |

```yaml
ew_branch:
  branch_id:     UUIDv7          # 同时作为分支 Room 的 Room ID
  parent_room:   UUIDv7          # 从哪个 Room 分叉
  fork_point:    ULID            # 从哪个 event 之后分叉
  created_by:    Entity ID
  created_at:    RFC 3339
```

#### ew_merge_request — 合并请求

| 字段 | 值 |
|------|---|
| id | `ew_merge_request` |
| storage_type | `crdt_map` |
| key_pattern | `ezagent/{room_id}/ew/merge_requests/{mr_id}` |
| persistent | `true` |
| writer_rule | `signer ∈ room.members AND signer has capability(merge.request)` |

```yaml
ew_merge_request:
  mr_id:            ULID
  source_branch:    UUIDv7       # 合并源 Room ID
  target_branch:    UUIDv7       # 合并目标 Room ID
  event_range:      [ULID, ULID] # 要合并的事件范围 [from, to]
  requested_by:     Entity ID
  created_at:       RFC 3339
```

### 3.2 Hooks

#### pre_send: ew:validate_causality

| 字段 | 值 |
|------|---|
| trigger.datatype | `ew_event` |
| trigger.event | `insert` |
| priority | `30` |

- [MUST] 验证 `causality` 中所有 event_id 存在于当前 Room 的事件集中。
- [MUST] 检测因果环。如果新事件的 causality 链形成环路，MUST 拒绝写入。
- [MAY] 对空 `causality`（根事件）放行。

#### after_write: ew:index_event

| 字段 | 值 |
|------|---|
| trigger.datatype | `ew_event` |
| trigger.event | `insert` |
| priority | `30` |

- [MUST] 更新 `ew:dag_index`（添加新节点和因果边）。
- [MUST] 更新 `ew:causal_order` Index。
- [MUST] 生成 `ew.event.new` Engine Event。

#### after_write: ew:detect_conflict

| 字段 | 值 |
|------|---|
| trigger.datatype | `ew_merge_request` |
| trigger.event | `insert` |
| priority | `30` |

- [MUST] 比较 source_branch 和 target_branch 自 fork_point 以来的事件集合。
- [MUST] 将冲突信息写入 `ew:conflict:{@system:local}` Annotation。
- [MUST] 如果无冲突，写入 `ew:no_conflict:{@system:local}` Annotation。

#### after_write: ew:execute_merge

| 字段 | 值 |
|------|---|
| trigger.datatype | `ew_merge_request` |
| trigger.event | `update` |
| trigger.filter | `ext.annotations has "ew:approved:*"` |
| priority | `40` |

- [MUST] 验证 approved annotation 数量满足 merge quorum。
- [MUST] 将 source_branch 的事件按因果顺序写入 target_branch 的 Room。
- [MUST] 生成 `ew_event { event_type: "branch_merged" }` 记录。
- [MUST NOT] 修改 source_branch 中的原始事件。

### 3.3 Annotations

```yaml
annotations:
  on_ref:
    # 附加到 ew_merge_request 上
    "ew:conflict":              # key: "ew:conflict:{@system:local}"
      value: { conflicting_events: [ULID], description: string }
    "ew:no_conflict":           # key: "ew:no_conflict:{@system:local}"
      value: { verified_at: RFC 3339 }
    "ew:approved":              # key: "ew:approved:{approver_entity_id}"
      value: { approved_at: RFC 3339, comment: string | null }
    "ew:rejected":              # key: "ew:rejected:{rejector_entity_id}"
      value: { reason: string }

    # 附加到任意 ew_event 上
    "ew:lifecycle":             # key: "ew:lifecycle:{@system:local}"
      value: { socialware_id: string, lifecycle_type: string }
      # lifecycle_type: created | forked | composed | merged | suspended | archived
```

### 3.4 Indexes

```yaml
indexes:
  - id:           "ew:dag_index"
    input:        "All ew_event in room, keyed by event_id"
    transform:    "Build adjacency list from causality field"
    refresh:      on_change
    operation_id: "ew.dag.get"

  - id:           "ew:causal_order"
    input:        "ew:dag_index"
    transform:    "Topological sort of event DAG"
    refresh:      on_change
    operation_id: "ew.events.list"

  - id:           "ew:branch_list"
    input:        "All ew_branch in room"
    transform:    "List with status derived from merge_request annotations"
    refresh:      on_change
    operation_id: "ew.branches.list"

  - id:           "ew:lifecycle_log"
    input:        "All ew_event where annotation ew:lifecycle exists"
    transform:    "Filter and sort by created_at"
    refresh:      on_change
    operation_id: "ew.lifecycle.get"
```

---

## 4. Part B: Socialware 层声明

### 4.1 Roles

```yaml
roles:
  # 施加于 Identity
  - id: ew:emitter
    assignable_to: [Identity]
    capabilities: [event.emit, event.annotate]

  - id: ew:branch_owner
    assignable_to: [Identity]
    capabilities: [branch.create, branch.commit, branch.close]

  - id: ew:merger
    assignable_to: [Identity]
    capabilities: [merge.request, merge.approve, merge.execute, conflict.resolve]

  - id: ew:observer
    assignable_to: [Identity]
    capabilities: [event.read, branch.read, dag.query]

  # 施加于 Room
  - id: ew:event_stream
    assignable_to: [Room]
    capabilities: [event.receive, event.order, causality.track]

  - id: ew:merge_zone
    assignable_to: [Room]
    capabilities: [conflict.detect, diff.compute, merge.execute]

  # 施加于 Message
  - id: ew:merge_request_authority
    assignable_to: [Message where datatype == ew_merge_request]
    capabilities: [authority.propose_merge, binding.on_approval]

  - id: ew:directive
    assignable_to: [Message where event_type == "directive"]
    capabilities: [authority.override, binding.immediate]
```

### 4.2 Arenas

```yaml
arenas:
  - id: ew:event_intake
    over: [Room with role(ew:event_stream)]
    boundary: external
    entry_policy: any_identity_with_role(ew:emitter)
    purpose: "接收来自所有 Socialware 的事件"

  - id: ew:dag_explorer
    over: [Room with role(ew:event_stream)]
    boundary: external
    entry_policy: any_identity_with_role(ew:observer)
    purpose: "对外提供 Event DAG 只读查询"

  - id: ew:branch_workspace
    over: [Room created per ew_branch]
    boundary: internal
    entry_policy: role_required(ew:branch_owner | ew:merger)
    purpose: "分支内部的事件提交和演进"

  - id: ew:merge_chamber
    over: [Room with role(ew:merge_zone)]
    boundary: internal
    entry_policy: role_required(ew:merger)
    purpose: "冲突检测、解决和合并执行"
```

### 4.3 Commitments

```yaml
commitments:
  - id: ew:causal_integrity
    between: [Identity with role(ew:emitter), Identity with role(ew:observer)]
    obligation: "所有事件保持因果一致性，不出现因果环"
    triggered_by: always
    enforcement: "ew:validate_causality hook (pre_send)"

  - id: ew:ordering_guarantee
    between: [Room with role(ew:event_stream), Identity with role(ew:emitter)]
    obligation: "同一因果链上的事件保持拓扑顺序"
    triggered_by: always
    enforcement: "ew:causal_order index"

  - id: ew:merge_finality
    between: [Identity with role(ew:merger), Identity with role(ew:branch_owner)]
    obligation: "合并一旦执行不可回退，但可通过新 branch 继续演进"
    triggered_by: "ew:execute_merge hook 完成"

  - id: ew:conflict_transparency
    between: [Room with role(ew:merge_zone), Room with role(ew:branch_workspace)]
    obligation: "冲突完整暴露在 ew:conflict Annotation 中，不静默丢弃"
    triggered_by: "ew:detect_conflict hook 发现冲突"

  - id: ew:lifecycle_tracking
    between: [EventWeaver Identity, any Socialware Identity]
    obligation: "所有 Socialware 生命周期事件被忠实记录为 ew_event"
    triggered_by: "any Socialware lifecycle state change"
```

### 4.4 Flows

```yaml
flows:
  - id: ew:event_lifecycle
    subject: Message where datatype == ew_event
    states: [emitted, validated, indexed, archived]
    transitions:
      emitted   --[ew:validate_causality passes]--> validated
      validated --[ew:index_event completes]-------> indexed
      indexed   --[ttl_expired]--------------------> archived
    preferences:
      index_latency: minimize
      archive_retention: 30d

  - id: ew:branch_lifecycle
    subject: Room created per ew_branch
    states: [created, active, merge_requested, merged, abandoned]
    transitions:
      created          --[first ew_event written]---------> active
      active           --[ew_merge_request submitted]-----> merge_requested
      merge_requested  --[sufficient ew:approved]---------> merged
      merge_requested  --[ew:rejected]--------------------> active
      active           --[branch_owner closes]------------> abandoned
    preferences:
      short_lived_branches: preferred
      auto_merge_when_no_conflict: true

  - id: ew:conflict_resolution
    subject: Message where datatype == ew_merge_request AND annotation(ew:conflict) exists
    states: [detected, auto_resolved, escalated, human_resolved]
    transitions:
      detected   --[agent confidence > 0.8]-----> auto_resolved
      detected   --[agent confidence <= 0.8]----> escalated
      escalated  --[human writes ew:approved]----> human_resolved
    preferences:
      auto_resolve: preferred_when(no structural conflict)
      escalate_to_human: preferred_when(structural_conflict)
```

---

## 5. 验证用例

### §5.1 事件基础

#### TC-EW-001: 事件写入与因果验证

```
GIVEN  EventWeaver 已初始化，R-ew-main Room 已创建
       E-alice 拥有 ew:emitter Role

WHEN   E-alice 写入 ew_event:
       { event_id: "evt-001", event_type: "task_created",
         causality: [], actor: "@alice:relay-a" }

THEN   ew:validate_causality hook 通过（根事件允许空 causality）
       ew:index_event hook 更新 DAG index
       await ew.dag.get(room_id) 返回包含 evt-001 的节点
       await ew.events.list(room_id, order="causal") 返回 [evt-001]
```

#### TC-EW-002: 因果链完整性

```
GIVEN  R-ew-main 包含 evt-001

WHEN   E-alice 写入 ew_event:
       { event_id: "evt-002", event_type: "task_claimed",
         causality: ["evt-001"], actor: "@alice:relay-a" }

THEN   ew:validate_causality hook 验证 evt-001 存在 → 通过
       await ew.dag.get(room_id) 显示 evt-001 → evt-002 的因果边
```

#### TC-EW-003: 因果环检测与拒绝

```
GIVEN  R-ew-main 包含因果链: evt-001 → evt-002 → evt-003

WHEN   E-alice 写入 ew_event:
       { event_id: "evt-004", causality: ["evt-003"],
         但 evt-003 的 causality 中指向了 evt-004（循环引用） }

THEN   ew:validate_causality hook 检测到因果环
       写入被拒绝
       CRDT 不被修改
```

#### TC-EW-004: 引用不存在的因果前驱

```
GIVEN  R-ew-main 包含 evt-001

WHEN   E-alice 写入 ew_event:
       { event_id: "evt-005", causality: ["evt-999"] }

THEN   ew:validate_causality hook 发现 evt-999 不存在 → 拒绝写入
```

### §5.2 分支管理

#### TC-EW-010: 创建分支

```
GIVEN  R-ew-main 包含事件链 evt-001 → evt-002 → evt-003
       E-bob 拥有 ew:branch_owner Role

WHEN   E-bob 写入 ew_branch:
       { branch_id: "R-branch-a", parent_room: "R-ew-main",
         fork_point: "evt-002" }

THEN   新 Room "R-branch-a" 被创建
       R-branch-a 的 Timeline 初始包含 evt-001, evt-002 的快照
       await ew.branches.list(room_id) 返回包含 R-branch-a 的列表
       ew:branch_lifecycle Flow 状态 = created
```

#### TC-EW-011: 分支内独立写入

```
GIVEN  R-branch-a 已创建 (fork_point: evt-002)
       R-ew-main 继续写入 evt-004, evt-005

WHEN   E-bob 在 R-branch-a 中写入 branch-evt-001

THEN   R-branch-a 包含: [evt-001, evt-002, branch-evt-001]
       R-ew-main 包含: [evt-001, evt-002, evt-003, evt-004, evt-005]
       两者独立，互不影响
```

#### TC-EW-012: 无冲突自动合并

```
GIVEN  R-branch-a fork from evt-002
       R-branch-a 包含 branch-evt-001 (不与主线冲突)
       R-ew-main 包含 evt-003, evt-004 (与分支无关)

WHEN   E-merger 写入 ew_merge_request:
       { source_branch: "R-branch-a", target_branch: "R-ew-main" }

THEN   ew:detect_conflict hook 写入 ew:no_conflict Annotation
       Flow preference auto_merge_when_no_conflict = true
       ew:execute_merge hook 自动执行
       R-ew-main Timeline 新增 branch-evt-001
       ew:branch_lifecycle 状态 → merged
```

#### TC-EW-013: 有冲突的合并请求

```
GIVEN  R-branch-a 和 R-branch-b 都 fork from evt-002
       两个分支修改了同一个配置项

WHEN   E-merger 写入 ew_merge_request

THEN   ew:detect_conflict hook 写入 ew:conflict Annotation
       { conflicting_events: [...], description: "..." }
       合并不自动执行
       等待 human intervention
```

### §5.3 生命周期管理

#### TC-EW-020: 记录 Socialware 创建事件

```
GIVEN  Bootstrap EventWeaver 已运行
       Platform Admin 创建新 Socialware "ResPool"

WHEN   ResPool Identity 注册到 Platform Bus

THEN   EventWeaver 自动记录:
       ew_event { event_type: "socialware_created",
                  payload: { socialware_id: "respool", ... },
                  actor: platform_admin }
       ew:lifecycle Annotation 写入该事件
       await ew.lifecycle.get(socialware="respool") 返回创建记录
```

#### TC-EW-021: 记录 Socialware Fork 事件

```
GIVEN  TaskArena 已在平台运行

WHEN   Platform Admin 对 TaskArena 执行 Fork → TaskArena-CN

THEN   EventWeaver 记录:
       ew_event { event_type: "socialware_forked",
                  payload: { source: "taskarena", target: "taskarena-cn",
                             fork_type: "snapshot" } }
       await ew.lifecycle.get(socialware="taskarena") 包含 fork 记录
       await ew.lifecycle.get(socialware="taskarena-cn") 包含 created 记录
```

### §5.4 HiTL 场景

#### TC-EW-030: 冲突解决中的 HiTL 升级

```
GIVEN  ew_merge_request 带有 ew:conflict Annotation
       Agent 尝试自动解决，置信度 = 0.4

WHEN   ew:conflict_resolution Flow 判断 confidence <= 0.8

THEN   Flow 状态 → escalated
       Human Identity 被赋予 ew:merger Role（如果尚未拥有）
       Human 可以进入 ew:merge_chamber Arena
       Human 写入 ew:approved Annotation 后 → Flow 状态 → human_resolved
       ew:execute_merge hook 执行合并
```

---

## 6. 依赖关系

```
EventWeaver 依赖:
  ezagent.bus built-in: Identity, Room, Timeline, Message
  
EventWeaver 被依赖:
  所有 Socialware → 生命周期事件记录
  TaskArena     → 争议分支管理
  Platform Bus  → Socialware 组合操作的记录
```

---

## 7. 概念溯源表

| 领域概念 | Bus 层实现 | Socialware 层维度 |
|---------|-----------|------------------|
| Event | Message(datatype=ew_event) | Role(ew:directive), Flow(ew:event_lifecycle) |
| Branch | Room(created per ew_branch) | Arena(ew:branch_workspace), Flow(ew:branch_lifecycle) |
| Fork Point | ULID field in ew_branch | — (纯数据，无需 Socialware 维度) |
| Merge Request | Message(datatype=ew_merge_request) | Role(ew:merge_request_authority), Flow(ew:conflict_resolution) |
| Conflict | Annotation(ew:conflict) on merge_request | — (纯元数据) |
| Approval | Annotation(ew:approved) on merge_request | — (纯元数据) |
| Lifecycle Event | Annotation(ew:lifecycle) on ew_event | — (纯元数据) |
| Event DAG | Index(ew:dag_index) | — (纯查询能力) |

---

## 8. UI Manifest (Part C)

> 参见 socialware-spec §2 Part C 和 chat-ui-spec。

### 8.1 Message Templates

```yaml
message_templates:
  - datatype: ew_event
    renderer:
      type: structured_card
      field_mapping:
        header: "event_type"
        metadata:
          - { field: "actor", format: "entity_name", icon: "user" }
          - { field: "timestamp", format: "relative_time", icon: "clock" }
          - { field: "causality", format: "{cause_count} causes", icon: "git-branch" }
        badge: { field: "lifecycle_state", source: "flow:ew:event_lifecycle" }

  - datatype: ew_merge_request
    renderer:
      type: structured_card
      field_mapping:
        header: "Merge Request: {source_branch} → {target_branch}"
        metadata:
          - { field: "author", icon: "user" }
          - { field: "conflict_count", format: "{n} conflicts", icon: "alert-triangle" }
        badge: { field: "resolution_state", source: "flow:ew:conflict_resolution" }
```

### 8.2 Views

```yaml
views:
  - id: "sw:ew:dag_view"
    index: "ew:dag_index"
    renderer:
      as_room_tab: true
      tab_label: "Event DAG"
      tab_icon: "git-branch"
      layout: graph                    # Level 2 自定义组件 (d3/cytoscape)
      layout_config:
        node_renderer: "ew_event"
        edge_type: "causality"
        direction: left_to_right

  - id: "sw:ew:branch_list"
    index: "ew:branch_index"
    renderer:
      as_room_tab: true
      tab_label: "Branches"
      tab_icon: "git-branch"
      layout: table
      layout_config:
        columns: [branch_id, fork_point, state, created_at]
```

### 8.3 Flow Renderers

```yaml
flow_renderers:
  - flow: ew:branch_lifecycle
    badge:
      created: { color: "blue", label: "Active" }
      merged: { color: "green", label: "Merged" }
      abandoned: { color: "gray", label: "Abandoned" }

  - flow: ew:conflict_resolution
    badge:
      pending: { color: "yellow", label: "Pending" }
      auto_resolved: { color: "green", label: "Auto-resolved" }
      escalated: { color: "orange", label: "Escalated" }
      human_resolved: { color: "green", label: "Resolved" }
    actions:
      - transition: "pending → auto_resolved"
        label: "Auto-merge"
        style: primary
        visible_to: "role:ew:merger"
        confirm: true
      - transition: "escalated → human_resolved"
        label: "Approve Merge"
        style: primary
        visible_to: "role:ew:merger"
        confirm: true
        confirm_message: "确认合并？此操作不可撤销。"
```

### 8.4 推荐 Override Level

| 组件 | Level | 理由 |
|------|-------|------|
| ew_event structured_card | Level 1 | 字段映射声明式足够 |
| ew_merge_request card | Level 1 | 同上 |
| DAG 可视化 Room Tab | **Level 2** | 需要自定义 d3/cytoscape 组件 |
| Branch 列表 | Level 1 | table layout 足够 |
| Merge approval actions | Level 1 | 按钮声明式足够 |

---

## 9. 安装与配置

### 9.1 目录结构

```
ezagent/socialware/event-weaver/
├── manifest.toml
└── config/
    └── branch-policies.toml          # 分支策略配置
```

### 9.2 manifest.toml

```toml
[socialware]
id = "event-weaver"
name = "EventWeaver"
version = "0.9.1"

[declaration]
datatypes = ["ew_event", "ew_branch", "ew_merge_request"]
hooks = ["ew.record_lifecycle", "ew.branch_create", "ew.merge_execute", "ew.conflict_detect"]
roles = ["ew:chronicler", "ew:branch_manager", "ew:merger", "ew:observer"]
annotations = ["ew:event_meta", "ew:branch_meta", "ew:merge_meta"]
indexes = ["event_dag", "branch_list", "merge_requests", "causal_chain"]

[commands]
branch = { params = ["name", "from?"], role = "ew:branch_manager" }
merge = { params = ["source", "target?"], role = "ew:merger" }
replay = { params = ["from_event", "to_event?"], role = "ew:observer" }
history = { params = ["entity_id?", "event_type?", "limit?"], role = "ew:observer" }
dag = { params = ["root?", "depth?"], role = "ew:observer" }

[dependencies]
extensions = ["EXT-04", "EXT-06", "EXT-15"]
socialware = []
```

---

## 10. EXT-15 Commands

EventWeaver 注册以下命令（命名空间 `ew`）：

| 命令 | 参数 | 所需 Role | 说明 |
|------|------|----------|------|
| `/ew:branch` | `--name`, `--from?` | `ew:branch_manager` | 创建新分支 |
| `/ew:merge` | `--source`, `--target?` | `ew:merger` | 发起 Merge Request |
| `/ew:replay` | `--from-event`, `--to-event?` | `ew:observer` | 回放事件序列 |
| `/ew:history` | `--entity-id?`, `--event-type?`, `--limit?` | `ew:observer` | 查询事件历史 |
| `/ew:dag` | `--root?`, `--depth?` | `ew:observer` | 查看事件 DAG 结构 |

命令处理示例：

```python
@socialware("event-weaver")
class EventWeaver:
    @hook(phase="after_write", trigger="timeline_index.insert",
          filter="ext.command.ns == 'ew'", priority=100)
    async def on_command(self, event, ctx):
        cmd = event.ref.ext.command
        if cmd.action == "branch":
            branch = await self.create_branch(
                name=cmd.params["name"],
                from_event=cmd.params.get("from"),
                creator=event.ref.author
            )
            await ctx.command.result(cmd.invoke_id, status="success",
                result={"branch_id": branch.id, "name": branch.name})
        elif cmd.action == "history":
            events = await self.query_events(
                entity_id=cmd.params.get("entity_id"),
                event_type=cmd.params.get("event_type"),
                limit=int(cmd.params.get("limit", 20))
            )
            await ctx.command.result(cmd.invoke_id, status="success",
                result={"events": events, "count": len(events)})
```

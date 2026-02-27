# TaskArena — Product Requirements Document v0.2.1

> **状态**：Draft
> **日期**：2026-02-26
> **前置文档**：ezagent-socialware-spec-v0.9.1
> **定位**：应用级 Socialware
> **依赖**：EventWeaver（事件追踪与争议管理）、ResPool（资源获取与奖励发放）

---

## 1. 产品概述

### 1.1 产品定位

TaskArena 是 ezagent 平台上的**任务协作与激励市场**。它为人类和 Agent 提供一个公平、透明、可追溯的环境来发布任务、认领工作、提交成果、评审质量和发放奖励。

TaskArena 的核心理念是：**任务是一种结构化的承诺关系**。Publisher 承诺按约定发放奖励，Worker 承诺按规范交付成果，Reviewer 承诺公正评审——这些承诺通过 Socialware 的 Commitment 原语形式化，通过 Flow 追踪兑现过程，通过 EventWeaver 记录历史，通过 ResPool 结算价值。

### 1.2 核心价值

**Human-Agent 平等参与**：在 TaskArena 中，Human 和 Agent 使用完全相同的 Identity 模型。一个翻译任务可能由 Agent 初译、Human 审校；一个代码审查可能由 Human 编写、Agent 检查。角色分配基于能力（Role），而非身份类型。

**激励对齐**：通过 Commitment + Flow 机制，确保所有参与者的利益得到保护。奖励承诺是链上不可篡改的（Bus 层 CRDT 签名保证），评审标准是预先声明的，争议有明确的仲裁路径。

**可组合的任务类型**：TaskArena 不是一种固定的任务系统。不同的 task_type（bounty、assigned、competitive、collaborative）使用相同的四原语框架，通过 Flow 的不同 preferences 配置表达差异化的协作文化。

**信誉即资产**：Worker 和 Reviewer 的信誉通过 Annotation 积累在 Identity 上，跨任务、跨 Socialware 可携带。一个在 TaskArena-A 上积累了 "expert" 信誉的 Worker，在 TaskArena-B 上也可被识别。

### 1.3 用户角色

| 角色 | 典型用户 | 核心需求 |
|------|---------|---------|
| Publisher | 项目经理、产品负责人、需求方 Agent | 发布任务、设定要求和奖励、追踪进度、审批结果 |
| Worker | 开发者、设计师、翻译、AI Agent | 浏览任务、认领工作、提交成果、积累信誉 |
| Reviewer | 领域专家、高级 Agent、质量工程师 | 评审成果、提供反馈、打分 |
| Arbitrator | 资深专家、平台管理员 | 仲裁争议、做出最终裁决（HiTL 的典型入口） |
| Observer | 任何感兴趣的 Identity | 浏览公开任务、查看信誉排行 |

### 1.4 任务类型

| 类型 | 语义 | 典型场景 | Flow 特点 |
|------|------|---------|----------|
| `bounty` | 公开悬赏，任何人可认领 | Bug 修复悬赏、翻译任务 | open → claimed → submitted → reviewed |
| `assigned` | 指定 Worker | 明确分工的项目任务 | 跳过 open，直接 claimed |
| `competitive` | 多人竞争，最佳者获奖 | 设计竞赛、方案竞标 | 多个 submission 并行，winner_takes_all |
| `collaborative` | 多人协作，共享奖励 | 大型文档协作、多模块开发 | 多个 Worker 同时 claimed，proportional 分配 |

---

## 2. 使用场景

### 场景 1：标准 Bounty 任务的完整生命周期

**背景**：一家公司需要将一份 10 页的技术文档从英语翻译成日语。

**流程**：

1. **发布**：Publisher 创建 `ta_task`：
   - type=bounty, title="Tech Doc EN→JP Translation"
   - requirements: skills=["translation", "japanese", "technical_writing"], deadline=3 days
   - rewards: type=token, amount=200, currency=USDT, distribution=winner_takes_all
   - 原文作为 attachment（Content Object）关联

2. **发现**：Worker 浏览 `ta:task_marketplace` Arena（通过 `ta:open_tasks` Index），按技能过滤找到此任务

3. **认领**：Worker（Human Translator）写入 `ta:claimed` Annotation → ta:task_lifecycle: open → claimed

4. **执行**：Worker 在 `ta:task_workshop` Arena 中工作，上传翻译稿

5. **提交**：Worker 创建 `ta_submission`，附带交付物引用 → ta:task_lifecycle: in_progress → submitted

6. **评审**：`ta:assign_reviewers` Hook 自动选择 2 名 Reviewer：
   - Reviewer A（日语母语 Agent，擅长文法检查）
   - Reviewer B（Human 技术专家，擅长术语准确性）
   - 两人在各自独立的 `ta:review_chamber` Arena 中评审，互不可见

7. **裁决**：两名 Reviewer 分别发出 `ta_verdict`：
   - A: approved, score=0.85, feedback="文法流畅，少数助词使用不准确"
   - B: approved, score=0.90, feedback="术语翻译准确，建议统一 API 相关术语"
   - `ta:compute_consensus` Hook：2/2 approved → 共识达成 → ta:status = approved

8. **结算**：`ta:settle_reward` Hook → 向 ResPool 发送 rp_request → 200 USDT 从 Publisher 转给 Worker

9. **记录**：EventWeaver 记录完整事件链；Worker 信誉更新：avg_score=(0.85+0.90)/2=0.875

**价值**：从发布到结算全自动，Human 和 Agent 在同一流程中无缝协作。

### 场景 2：AI Agent 驱动的代码审查

**背景**：开发团队使用 TaskArena 管理代码审查流程。

**流程**：

1. Publisher（Tech Lead）发布 assigned 任务："Review PR #1234 — Database Migration"
   - type=assigned，指定 Worker = Agent-CodeReviewer
   - requirements: skills=["code_review", "database", "python"]
   - rewards: type=reputation（纯信誉，无金钱奖励）

2. Agent-CodeReviewer 自动认领（assigned 类型跳过 open 阶段）

3. Agent 在 workshop Room 中分析代码，生成审查报告作为 `ta_submission`

4. Human Tech Lead 作为唯一 Reviewer 审查 Agent 的报告：
   - 发现 Agent 遗漏了一个潜在的 race condition
   - verdict: revision_requested, feedback="请补充对 concurrent access pattern 的分析"

5. Agent 收到反馈 → ta:task_lifecycle 回退到 in_progress → 补充分析后重新提交

6. Human Tech Lead 再次审查 → approved

7. 信誉更新：Agent-CodeReviewer 的 ta:reputation 增加

**价值**：Agent 作为初筛，Human 做最终判断。反馈循环帮助 Agent 持续改进。

### 场景 3：多人竞赛任务

**背景**：一家创业公司需要新 Logo 设计，希望从多个设计方案中选择最佳。

**流程**：

1. Publisher 发布 competitive 任务：
   - type=competitive, title="Logo Design for XYZ Startup"
   - rewards: distribution=winner_takes_all, amount=500 USDT
   - max_submissions=10, deadline=7 days

2. 5 名 Worker（3 Human + 2 Agent）分别认领并各自在独立的 workshop Room 中工作

3. 截止日期到达，5 份 submission 提交完毕

4. 3 名 Reviewer（1 Human 品牌专家 + 2 Agent 设计分析器）独立评审所有 5 份作品
   - 每名 Reviewer 为每份 submission 打分
   - `ta:compute_consensus` Hook 综合所有评分

5. Worker #3（Human）的作品得分最高 → winner → 获得 500 USDT

6. 其他 Worker 的信誉仍然更新（参与积分），但不获得金钱奖励

**价值**：competitive 模式下多个 Worker 独立工作，评审体系保证公平选拔。

### 场景 4：协作任务与比例分配

**背景**：一个大型技术报告需要 3 个章节，分别由 3 名 Worker 协作完成。

**流程**：

1. Publisher 发布 collaborative 任务：
   - type=collaborative, title="Q2 Technical Report"
   - subtasks: [Chapter 1, Chapter 2, Chapter 3]
   - rewards: distribution=proportional, total=600 USDT
   - max_workers=3

2. Worker A 认领 Chapter 1，Worker B 认领 Chapter 2，Agent-C 认领 Chapter 3
   - 三者在同一个 workshop Room 中协作（可以看到彼此的进展）

3. 各自提交 submission，每个 submission 独立评审

4. 评审结果：A=0.9, B=0.8, Agent-C=0.7
   - 按比例分配：A=600×(0.9/2.4)=$225, B=$200, Agent-C=$175

5. 三笔奖励通过 ResPool 分别发放

**价值**：同一任务框架下支持协作，奖励按贡献分配。

### 场景 5：争议仲裁的完整流程

**背景**：Worker 提交的翻译成果被 Reviewer 拒绝，Worker 认为评审不公。

**流程**：

1. Reviewer 发出 verdict: rejected, score=0.3, feedback="大量误译，质量不合格"

2. Worker 不同意，写入 `ta:disputed` Annotation：
   - reason: "Reviewer 的评判标准与 task_spec 不一致，task_spec 要求'意译为主'，但 Reviewer 按直译标准打分"
   - 附带具体段落的对比证据

3. `ta:handle_dispute` Hook 触发：
   - 向 EventWeaver 发送 `ew_branch` 请求 → 创建争议分支 Room
   - 争议分支包含原 task、submission、verdict 的快照
   - ta:task_lifecycle: rejected → disputed

4. Agent Arbitrator 首先尝试分析：
   - 对比 task_spec 和 verdict.feedback 的措辞
   - 置信度 = 0.5（模糊，task_spec 确实存在歧义）→ escalate to Human

5. Human Arbitrator 被赋予 ta:arbitrator Role，进入 `ta:dispute_tribunal` Arena：
   - 查看 task_spec（"以意译为主，保持技术术语准确"）
   - 查看 Worker 的翻译和 Reviewer 的批注
   - 认为 Worker 的翻译基本符合"意译为主"的要求
   - 发出 ta_verdict: approved, score=0.7, feedback="翻译质量可接受，task_spec 表述模糊导致评审标准不一致"

6. TaskArena 向 EventWeaver 发送 merge request → 争议分支合并回主线

7. 后续影响：
   - Worker 获得奖励（70% × 原定金额，因得分 0.7）
   - 原 Reviewer 的信誉轻微下降（评审与最终裁决不一致）
   - Publisher 收到建议："请在 task_spec 中明确翻译风格要求"

**价值**：争议有完整的证据链和仲裁路径。Agent 处理清晰案例，Human 处理模糊案例。

### 场景 6：Worker 信誉系统的长期演进

**背景**：一名新 Worker 从零开始在 TaskArena 中积累信誉。

**流程**：

1. **newcomer**（初始状态）：Worker 注册，ta:reputation = { score: 0, tasks_completed: 0 }
   - 只能认领标记为 "newcomer_friendly" 的低价值任务
   - 需要更多 Reviewer 参与评审（min_reviewers=3）

2. **3 个任务后**：avg_score=0.72 > 0.6 → **active**
   - 可认领大部分任务
   - 标准评审流程（min_reviewers=2）

3. **10 个任务后**：avg_score=0.84 > 0.8 → **trusted**
   - 可认领高价值任务
   - 某些任务可 auto_approve（单 Reviewer + score > 0.9 即可）
   - 可以被分配为 Reviewer（角色升级）

4. **30 个任务后**：avg_score=0.92 > 0.9 → **expert**
   - 最高优先级的任务推荐
   - 可以作为 Arbitrator 参与争议仲裁

5. **如果连续 3 次被 reject**：任何状态 → **suspended**
   - 30 天冷却期
   - 冷却期后可提交申诉
   - 申诉通过 → 回到 active（不是之前的等级）

**价值**：信誉作为长期资产激励持续高质量参与。降级快、升级慢确保信誉可信。

### 场景 7：跨 TaskArena 实例的信誉可携带

**背景**：TaskArena-A 是翻译任务市场，TaskArena-B 是代码审查市场。Worker 同时参与两者。

**流程**：

1. Worker 在 TaskArena-A 积累了 trusted 级别信誉（ta:reputation Annotation on Identity）

2. Worker 加入 TaskArena-B（新 TaskArena 实例，通过 Fork 或独立创建）

3. TaskArena-B 的 `ta:open_tasks` Index 在排序时查询 Worker 的 Identity 上所有 `ta:reputation` Annotation

4. TaskArena-B 可以选择：
   - 完全信任 TaskArena-A 的信誉（直接作为 trusted）
   - 部分信任（降一级，作为 active）
   - 不信任（从 newcomer 开始）
   - 这取决于 TaskArena-B 的 Flow.preferences 配置

**价值**：信誉附着在 Identity 上而非 Socialware 上，实现可携带性。

---

## 3. Part A: Bus 层声明

```yaml
id: "taskarena"
version: "0.1.0"
dependencies: ["identity", "room", "timeline", "message"]
```

### 3.1 Datatypes

#### ta_task — 任务规范

| 字段 | 值 |
|------|---|
| id | `ta_task` |
| storage_type | `crdt_map` |
| key_pattern | `ezagent/{room_id}/ta/tasks/{task_id}` |
| persistent | `true` |
| writer_rule | `signer ∈ room.members AND signer has capability(task.create)` |

```yaml
ta_task:
  task_id:        ULID
  title:          string
  description:    any                  # 富文本，JSON-compatible
  task_type:      string               # "bounty", "assigned", "competitive", "collaborative"
  requirements:
    skills:       [string]             # 所需技能标签
    resource_needs: [ResourceNeedTemplate] | null   # 关联 ResPool 的模板
    deadline:     RFC 3339 | null      # null = 无截止日期
    min_reviewers: number              # 最少评审人数
    max_submissions: number | null     # competitive 模式下的最大提交数
    max_workers:  number | null        # collaborative 模式下的最大 Worker 数
  rewards:
    type:         string               # "token", "reputation", "resource_credit", "custom"
    amount:       number
    currency:     string
    distribution: string               # "winner_takes_all", "proportional", "equal"
  review_config:
    auto_approve_threshold: number | null   # 单 Reviewer score > 此阈值可 auto_approve
    consensus_rule:  string            # "unanimous", "majority", "weighted_average"
  attachments:    [ContentRef]         # 关联的 Content Object 引用
  publisher:      Entity ID
  assigned_to:    [Entity ID] | null   # 仅 assigned/collaborative 类型
  created_at:     RFC 3339

ResourceNeedTemplate:
  resource_type:  string
  amount:         { value: number, unit: string }
  when:           string               # "on_claim", "on_approve", "on_complete"

ContentRef:
  content_type:   string
  content_id:     string
```

#### ta_submission — 成果提交

| 字段 | 值 |
|------|---|
| id | `ta_submission` |
| storage_type | `crdt_map` |
| key_pattern | `ezagent/{room_id}/ta/submissions/{submission_id}` |
| persistent | `true` |
| writer_rule | `signer ∈ room.members AND signer has capability(task.submit)` |

```yaml
ta_submission:
  submission_id:  ULID
  task_ref:       ULID                 # 关联的 ta_task
  worker:         Entity ID
  artifacts:      [ContentRef]         # 交付物引用
  notes:          string | null        # Worker 的说明
  revision_of:    ULID | null          # 如果是修改稿，指向前一个 submission
  submitted_at:   RFC 3339
```

#### ta_verdict — 评审裁决

| 字段 | 值 |
|------|---|
| id | `ta_verdict` |
| storage_type | `crdt_map` |
| key_pattern | `ezagent/{room_id}/ta/verdicts/{verdict_id}` |
| persistent | `true` |
| writer_rule | `signer ∈ room.members AND signer has capability(submission.review OR verdict.override)` |

```yaml
ta_verdict:
  verdict_id:     ULID
  task_ref:       ULID
  submission_ref: ULID
  decision:       string               # "approved", "rejected", "revision_requested"
  score:          number               # 0.0 - 1.0
  feedback:       string               # [MUST] 非空
  categories:     Map<string, number> | null   # 分项评分，如 { accuracy: 0.9, style: 0.8 }
  reviewer:       Entity ID
  issued_at:      RFC 3339
```

### 3.2 Hooks

#### pre_send: ta:validate_claim

| 字段 | 值 |
|------|---|
| trigger.datatype | `ta_task` |
| trigger.event | `update` |
| trigger.filter | `ext.annotations has new "ta:claimed:*"` |
| priority | `30` |

- [MUST] 验证 task 当前 `ta:status` == "open"。
- [MUST] 验证 claimer 满足 task 的 skills 要求（查询 claimer Identity 上的技能 Annotation）。
- [MUST] 对于 assigned 类型，验证 claimer ∈ task.assigned_to。
- [MUST] 对于 collaborative 类型，验证当前 claimed 数 < max_workers。
- [MUST] 对于 competitive 类型，验证当前 submission 数 < max_submissions。
- 验证失败时拒绝写入。

#### pre_send: ta:validate_verdict

| 字段 | 值 |
|------|---|
| trigger.datatype | `ta_verdict` |
| trigger.event | `insert` |
| priority | `30` |

- [MUST] 验证 verdict.feedback 非空（最少 10 个字符）。
- [MUST] 验证 verdict.score ∈ [0.0, 1.0]。
- [MUST] 验证 reviewer 有 submission.review capability 且被分配到此 submission。
- [MUST] 验证同一 reviewer 对同一 submission 没有已存在的 verdict。

#### after_write: ta:update_status

| 字段 | 值 |
|------|---|
| trigger.datatype | `ta_task` |
| trigger.event | `update` |
| trigger.filter | `ext.annotations has new "ta:claimed:*"` |
| priority | `30` |

- [MUST] 更新 ta:status Annotation 为 "claimed"。
- [MUST] 向 EventWeaver 发送 ew_event { event_type: "task_claimed" }。
- [MUST] 生成 `ta.task.claimed` Engine Event。

#### after_write: ta:assign_reviewers

| 字段 | 值 |
|------|---|
| trigger.datatype | `ta_submission` |
| trigger.event | `insert` |
| priority | `30` |

- [MUST] 更新 task 的 ta:status Annotation 为 "under_review"。
- [MUST] 根据 task 配置选择 Reviewer（策略：随机选取拥有 ta:reviewer Role + 相关技能的 Identity）。
- [MUST] 写入 `ta:review_assignment:{@system:local}` Annotation 到 submission 上。
- [SHOULD] 选择的 Reviewer 应来自不同背景（Human + Agent 混合优先）。
- [MUST] 生成 `ta.submission.created` Engine Event。

#### after_write: ta:compute_consensus

| 字段 | 值 |
|------|---|
| trigger.datatype | `ta_verdict` |
| trigger.event | `insert` |
| priority | `30` |

- [MUST] 收集当前 task 对应 submission 的所有 verdict。
- [MUST] 检查是否达到 min_reviewers 数量。
- 如果达到且共识达成（按 consensus_rule）：
  - [MUST] 更新 ta:status 为 "approved" 或 "rejected"。
  - [MUST] 生成 `ta.task.approved` 或 `ta.task.rejected` Engine Event。
- 如果达到但共识未达成：
  - [SHOULD] 分配额外 Reviewer。
  - 如果已超过 max_reviewers 仍无共识：[MUST] 写入 `ta:escalated` Annotation。

#### after_write: ta:settle_reward

| 字段 | 值 |
|------|---|
| trigger.datatype | `ta_task` |
| trigger.event | `update` |
| trigger.filter | `ext.annotations "ta:status:*" where state == "approved"` |
| priority | `40` |

- [MUST] 向 Platform Bus 发送消息，请求 ResPool 分配奖励资源。
- [MUST] 向 EventWeaver 发送 ew_event { event_type: "task_completed" }。
- [MUST] 更新 Worker 的 ta:reputation Annotation。
- [MUST] 对于 competitive/collaborative 类型，按 distribution 规则计算每人的奖励份额。
- [MUST] 更新 ta:status 为 "completed"。

#### after_write: ta:handle_dispute

| 字段 | 值 |
|------|---|
| trigger.datatype | `ta_task` |
| trigger.event | `update` |
| trigger.filter | `ext.annotations has new "ta:disputed:*"` |
| priority | `30` |

- [MUST] 向 EventWeaver 发送 ew_branch 创建争议分支 Room。
- [MUST] 更新 ta:status 为 "disputed"。
- [MUST] 在争议分支 Room 中创建 task/submission/verdict 的快照引用。
- [MUST] 生成 `ta.task.disputed` Engine Event。

### 3.3 Annotations

```yaml
annotations:
  on_ref:
    # ─── 附加到 ta_task 上 ───
    "ta:status":                  # key: "ta:status:{@system:local}"
      value:
        state:      string        # "draft", "open", "claimed", "in_progress",
                                  # "submitted", "under_review", "approved",
                                  # "rejected", "disputed", "completed", "cancelled"
        updated_at: RFC 3339
        updated_by: Entity ID | "@system:local"

    "ta:claimed":                 # key: "ta:claimed:{worker_entity_id}"
      value:
        claimed_at: RFC 3339
        worker_reputation: number | null   # claim 时的信誉快照

    "ta:disputed":                # key: "ta:disputed:{disputer_entity_id}"
      value:
        reason:       string
        evidence_refs: [ContentRef]
        branch_id:    UUIDv7       # EventWeaver 分支 Room ID
        disputed_at:  RFC 3339

    "ta:escalated":               # key: "ta:escalated:{@system:local}"
      value:
        reason:       string      # "no_consensus", "timeout", "complex_dispute"
        escalated_at: RFC 3339

    "ta:deadline_warning":        # key: "ta:deadline_warning:{@system:local}"
      value:
        hours_remaining: number
        warned_at:      RFC 3339

    # ─── 附加到 ta_submission 上 ───
    "ta:review_assignment":       # key: "ta:review_assignment:{@system:local}"
      value:
        reviewers:    [Entity ID]
        assigned_at:  RFC 3339

    "ta:progress":                # key: "ta:progress:{worker_entity_id}"
      value:
        percentage:   number
        description:  string
        updated_at:   RFC 3339

    # ─── 附加到 Identity Profile 上 ───
    "ta:reputation":              # key: "ta:reputation:{taskarena_identity}"
      value:
        score:            number       # 综合评分
        level:            string       # newcomer, active, trusted, expert, suspended
        tasks_completed:  number
        tasks_failed:     number
        avg_review_score: number
        specialties:      [string]     # 基于完成任务的技能分布
        last_updated:     RFC 3339

    "ta:skills":                  # key: "ta:skills:{identity_entity_id}"
      value:
        verified:     [{ skill: string, verified_by: string, evidence: string }]
        claimed:      [string]         # 自我声明但未验证的技能
```

### 3.4 Indexes

```yaml
indexes:
  - id:           "ta:open_tasks"
    input:        "All ta_task where ta:status.state == 'open'"
    transform:    "Sort by created_at desc, filter by skills/type/reward,
                   include publisher reputation"
    refresh:      on_change
    operation_id: "ta.tasks.list"

  - id:           "ta:task_detail"
    input:        "Single ta_task + all related submissions, verdicts, annotations"
    transform:    "Aggregate task + submissions + verdicts + status history + claim info"
    refresh:      on_demand
    operation_id: "ta.task.get"

  - id:           "ta:my_tasks"
    input:        "All ta_task where ta:claimed by current entity OR publisher == current entity"
    transform:    "Group by status, sort by deadline"
    refresh:      on_change
    operation_id: "ta.my_tasks.list"

  - id:           "ta:review_queue"
    input:        "All ta_submission where ta:review_assignment includes current entity
                   AND verdict count < required"
    transform:    "Sort by task deadline, include submission artifacts"
    refresh:      on_change
    operation_id: "ta.reviews.pending"

  - id:           "ta:worker_history"
    input:        "All ta:claimed annotations grouped by worker entity_id"
    transform:    "worker → [{ task, submission, verdict, reward }]"
    refresh:      on_demand
    operation_id: "ta.worker.history"

  - id:           "ta:reputation_board"
    input:        "All ta:reputation annotations"
    transform:    "Rank by score desc, filter by specialty"
    refresh:      on_change
    operation_id: "ta.reputation.list"
```

---

## 4. Part B: Socialware 层声明

### 4.1 Roles

```yaml
roles:
  # ─── 施加于 Identity ───
  - id: ta:publisher
    assignable_to: [Identity]
    capabilities: [task.create, task.fund, task.cancel,
                   reward.distribute, worker.assign]

  - id: ta:worker
    assignable_to: [Identity]
    capabilities: [task.browse, task.claim, task.submit,
                   progress.report, dispute.initiate]

  - id: ta:reviewer
    assignable_to: [Identity]
    capabilities: [submission.review, score.assign, verdict.issue,
                   feedback.provide]

  - id: ta:arbitrator
    assignable_to: [Identity]
    capabilities: [dispute.hear, evidence.request, verdict.override,
                   reputation.adjust]
    description: "仲裁角色。HiTL 的典型入口——当 Agent Arbitrator
                  置信度不足时，Human 被赋予此 Role"

  # ─── 施加于 Room ───
  - id: ta:marketplace
    assignable_to: [Room]
    capabilities: [task.broadcast, task.match, task.recommend,
                   search.skill_based, filter.advanced]
    description: "任务市场——发现和推荐任务"

  - id: ta:workshop
    assignable_to: [Room]
    capabilities: [collaboration.enable, progress.track,
                   artifact.store, communication.realtime]
    description: "工作空间——Worker 执行任务的场所"

  - id: ta:tribunal
    assignable_to: [Room]
    capabilities: [evidence.collect, vote.tally, verdict.enforce,
                   transcript.preserve]
    description: "仲裁庭——争议裁决的场所"

  # ─── 施加于 Message ───
  - id: ta:task_spec
    assignable_to: [Message where datatype == ta_task]
    capabilities: [binding.define_scope, authority.set_reward,
                   binding.set_deadline]
    description: "任务规范——定义范围、奖励和截止日期的权威文件"

  - id: ta:submission_artifact
    assignable_to: [Message where datatype == ta_submission]
    capabilities: [binding.deliver_work, authority.claim_reward]
    description: "成果提交——交付物的权威凭证"

  - id: ta:verdict_authority
    assignable_to: [Message where datatype == ta_verdict]
    capabilities: [binding.final_decision, authority.trigger_settlement]
    description: "裁决——触发最终结算的权威决定"

  # ─── 施加于 Timeline ───
  - id: ta:review_window
    assignable_to: [Timeline segment between submission and review deadline]
    capabilities: [deadline.enforce, late_submission.reject]
    description: "评审窗口——Reviewer 必须在此时段内完成评审"
```

### 4.2 Arenas

```yaml
arenas:
  # ─── 外部 ───
  - id: ta:task_marketplace
    over: [Room with role(ta:marketplace)]
    boundary: external
    entry_policy: any_identity
    purpose: "任务浏览、搜索、认领入口。任何人可浏览，
              认领需要 ta:worker Role"

  - id: ta:reputation_board
    over: [ta:reputation_board index endpoint]
    boundary: external
    entry_policy: any_identity (read_only)
    purpose: "公开展示信誉排行和 Worker 历史"

  # ─── 内部 ───
  - id: ta:task_workshop
    over: [Room with role(ta:workshop), created per ta_task on claim]
    boundary: internal
    entry_policy: >
      role_required(ta:publisher who published this task
                    | ta:worker who claimed this task)
    purpose: "任务执行的工作空间。Publisher 和 Worker 可在此沟通"

  - id: ta:review_chamber
    over: [Room created per (ta_submission × reviewer) pair]
    boundary: internal
    entry_policy: >
      role_required(ta:reviewer with ta:review_assignment on this submission)
    purpose: "独立评审空间。每个 Reviewer 有独立的 Room，
              互不可见，防止评审偏见"

  - id: ta:dispute_tribunal
    over: [Room with role(ta:tribunal)]
    boundary: internal
    entry_policy: >
      role_required(ta:arbitrator
                    | ta:worker who is disputing party
                    | ta:publisher of disputed task)
    purpose: "争议仲裁空间。双方和仲裁者可在此提交证据和陈述"

  # ─── 联邦 ───
  - id: ta:resource_bridge
    over: [Platform Bus Room]
    boundary: federated
    entry_policy: TaskArena Identity
    purpose: "与 ResPool 交互，申请和结算奖励资源"

  - id: ta:event_bridge
    over: [Platform Bus Room]
    boundary: federated
    entry_policy: TaskArena Identity
    purpose: "与 EventWeaver 交互，报告事件和管理争议分支"
```

### 4.3 Commitments

```yaml
commitments:
  # ─── Publisher ↔ Worker ───
  - id: ta:reward_guarantee
    between: [Identity with role(ta:publisher), Identity with role(ta:worker)]
    obligation: "成果通过评审后，在 48h 内通过 ResPool 发放声明的奖励"
    triggered_by: "ta:status → approved"
    enforcement: "ta:settle_reward hook 自动执行"

  - id: ta:scope_stability
    between: [Identity with role(ta:publisher), Identity with role(ta:worker)]
    obligation: "任务范围在认领后不单方面变更。
                 Publisher 修改 task_spec 需要 Worker 同意"
    triggered_by: "ta:claimed annotation written"
    enforcement: "ta_task 的 writer_rule 在 claimed 后增加 co-sign 要求"

  - id: ta:delivery_promise
    between: [Identity with role(ta:worker), Identity with role(ta:publisher)]
    obligation: "在 deadline 前提交符合 task_spec 的成果"
    triggered_by: "ta:claimed annotation written by worker"
    expires: "task.deadline OR ta:status → cancelled"

  # ─── Reviewer ↔ Worker ───
  - id: ta:fair_review
    between: [Identity with role(ta:reviewer), Identity with role(ta:worker)]
    obligation: "基于 task_spec 中声明的标准评审，提供具体反馈
                 （verdict.feedback 非空且 >= 10 字符）"
    triggered_by: "ta:review_assignment annotation written"
    enforcement: "ta:validate_verdict pre_send hook"

  # ─── Room ↔ Identity ───
  - id: ta:marketplace_neutrality
    between: [Room with role(ta:marketplace), any Identity]
    obligation: "任务推荐不偏向特定 Worker，排序算法透明可审计"
    triggered_by: always

  - id: ta:due_process
    between: [Room with role(ta:tribunal), disputing parties]
    obligation: "双方有平等的证据提交和陈述机会，
                 仲裁者必须在查看双方材料后才能发出裁决"
    triggered_by: "ta:disputed annotation written"
    enforcement: "tribunal Room 的 entry_policy 确保双方进入"

  # ─── Message 级 ───
  - id: ta:spec_binding
    between: [Message with role(ta:task_spec),
              Identity with role(ta:publisher),
              Identity with role(ta:worker)]
    obligation: "此任务规范是双方协作的契约基础，评审标准由此确定"
    triggered_by: "ta:claimed annotation on this task"

  - id: ta:verdict_finality
    between: [Message with role(ta:verdict_authority), all parties]
    obligation: "裁决结果为最终结果，除非在 72h 内进入 dispute flow"
    triggered_by: "ta:compute_consensus hook 写入最终 status"

  # ─── Socialware ↔ Socialware ───
  - id: ta:event_reporting
    between: [TaskArena Identity, EventWeaver Identity]
    obligation: "所有 Task 状态变更作为 ew_event 报告"
    triggered_by: "any ta:status change"

  - id: ta:resource_settlement
    between: [TaskArena Identity, ResPool Identity]
    obligation: "任务完成后通过 ResPool 结算，任务取消后释放预留资源"
    triggered_by: "ta:status → completed OR cancelled"
```

### 4.4 Flows

```yaml
flows:
  - id: ta:task_lifecycle
    subject: Message where datatype == ta_task
    states:
      [draft, open, claimed, in_progress, submitted,
       under_review, approved, rejected, disputed, completed, cancelled]
    transitions:
      draft        --[Publisher publishes]----------------------------> open
      open         --[Worker writes ta:claimed]----------------------> claimed
      claimed      --[Worker begins work in workshop Room]-----------> in_progress
      in_progress  --[Worker creates ta_submission]-------------------> submitted
      submitted    --[ta:assign_reviewers selects Reviewers]---------> under_review
      under_review --[ta:compute_consensus: consensus approve]-------> approved
      under_review --[ta:compute_consensus: consensus reject]--------> rejected
      under_review --[ta:compute_consensus: revision_requested]------> in_progress
      approved     --[ta:settle_reward completes]--------------------> completed
      rejected     --[Worker accepts, no dispute within 72h]---------> cancelled
      rejected     --[Worker writes ta:disputed]---------------------> disputed
      disputed     --[Arbitrator verdict: approved]------------------> approved
      disputed     --[Arbitrator verdict: rejected]------------------> cancelled
      open         --[deadline expired with no claims]---------------> cancelled
      open         --[Publisher cancels]-----------------------------> cancelled
      claimed      --[Worker abandons]-------------------------------> open
    preferences:
      fast_iteration: preferred
      multi_reviewer: preferred_when(rewards.amount > threshold)
      auto_approve: allowed_when(reviewer_consensus == unanimous AND score > 0.9
                                 AND review_config.auto_approve_threshold is set)
      escalate_to_human: preferred_when(disputed AND agent_confidence < 0.7)
      revision_over_rejection: preferred_when(score > 0.4 AND score < 0.6)

  - id: ta:review_cycle
    subject: Message where datatype == ta_submission
    states: [pending_review, assigned, in_review, scored, abstained]
    transitions:
      pending_review --[ta:review_assignment written]----> assigned
      assigned       --[Reviewer opens submission]-------> in_review
      in_review      --[ta_verdict created]--------------> scored
      assigned       --[review_window expires]-----------> abstained
    preferences:
      independent_review: required
      reviewer_diversity: preferred (Human + Agent mix)
      min_reviewers: 2
      abstain_consequence: reputation_decrease_for_reviewer

  - id: ta:reputation_evolution
    subject: Identity with annotation(ta:reputation)
    states: [newcomer, active, trusted, expert, suspended]
    transitions:
      newcomer  --[completed 3+ tasks, avg_score > 0.6]------> active
      active    --[completed 10+ tasks, avg_score > 0.8]-----> trusted
      trusted   --[completed 30+ tasks, avg_score > 0.9]-----> expert
      any       --[3+ rejected in window OR 2+ disputes lost]-> suspended
      suspended --[30d cooling + appeal approved]-------------> active
    preferences:
      slow_promotion: preferred
      fast_demotion: preferred
      rehabilitation: allowed_after(30d cooling_period)
      cross_arena_reputation: configurable_per_instance
```

---

## 5. 验证用例

### §5.1 任务发布与认领

#### TC-TA-001: 发布 Bounty 任务

```
GIVEN  TaskArena 已初始化
       E-publisher 拥有 ta:publisher Role

WHEN   E-publisher 写入 ta_task:
       { task_type: "bounty", title: "Translate doc EN→JP",
         requirements: { skills: ["translation", "japanese"], deadline: "2026-02-27T00:00:00Z" },
         rewards: { type: "token", amount: 200, currency: "USDT", distribution: "winner_takes_all" } }

THEN   ta:status Annotation 写入: { state: "open" }
       await ta.tasks.list(status="open") 包含此任务
       EventWeaver 收到 ew_event { event_type: "task_created" }
```

#### TC-TA-002: Worker 认领任务

```
GIVEN  Task T-001 状态为 open, requirements.skills = ["translation", "japanese"]
       E-worker Identity 上有 ta:skills Annotation: { verified: [{ skill: "translation" }, { skill: "japanese" }] }

WHEN   E-worker 写入 ta:claimed Annotation on T-001

THEN   ta:validate_claim hook 验证 skills 匹配 → 通过
       ta:update_status hook 将 ta:status 更新为 "claimed"
       Workshop Room 创建，E-publisher 和 E-worker 作为成员
       ta:task_lifecycle: open → claimed
```

#### TC-TA-003: 技能不匹配认领被拒

```
GIVEN  Task T-001 requirements.skills = ["translation", "japanese"]
       E-worker2 只有 ta:skills: ["translation", "french"]

WHEN   E-worker2 写入 ta:claimed Annotation on T-001

THEN   ta:validate_claim hook 验证 skills 不匹配（缺少 "japanese"）→ 拒绝
```

#### TC-TA-004: Assigned 任务直接进入 claimed

```
GIVEN  Task T-002: type=assigned, assigned_to=[E-worker]

WHEN   E-publisher 发布任务

THEN   ta:status 直接设为 "claimed"（跳过 open）
       E-worker 自动收到通知
```

### §5.2 评审流程

#### TC-TA-010: 提交成果并触发评审分配

```
GIVEN  Task T-001 状态为 in_progress
       E-worker 在 workshop 中准备好了翻译稿

WHEN   E-worker 写入 ta_submission:
       { task_ref: "T-001", artifacts: [{ type: "document", content_id: "..." }] }

THEN   ta:assign_reviewers hook 触发
       选择 2 名 Reviewer（假设 E-reviewer-A, E-reviewer-B）
       ta:review_assignment Annotation 写入 submission
       为每个 Reviewer 创建独立的 review_chamber Room
       ta:task_lifecycle: submitted → under_review
```

#### TC-TA-011: Reviewer 评审通过

```
GIVEN  Submission S-001 已分配给 E-reviewer-A 和 E-reviewer-B
       task.review_config.consensus_rule = "unanimous"

WHEN   E-reviewer-A 写入 ta_verdict:
       { decision: "approved", score: 0.85, feedback: "文法流畅..." }
       E-reviewer-B 写入 ta_verdict:
       { decision: "approved", score: 0.90, feedback: "术语准确..." }

THEN   ta:compute_consensus hook: 2/2 approved, unanimous → 共识达成
       ta:status → "approved"
       ta:settle_reward hook 触发 → 向 ResPool 请求发放 200 USDT
       ta:reputation 更新: avg_score = (0.85 + 0.90) / 2 = 0.875
       ta:task_lifecycle: under_review → approved → completed
```

#### TC-TA-012: 评审意见不一致需额外 Reviewer

```
GIVEN  Submission S-001, consensus_rule = "majority", min_reviewers = 2

WHEN   E-reviewer-A: approved, score=0.8
       E-reviewer-B: rejected, score=0.3

THEN   ta:compute_consensus: 1 approved, 1 rejected → 无共识
       ta:assign_reviewers 分配第 3 名 Reviewer (E-reviewer-C)
       等待 E-reviewer-C 的 verdict
```

#### TC-TA-013: Verdict feedback 验证

```
GIVEN  E-reviewer 尝试提交 verdict

WHEN   verdict.feedback = "OK"（仅 2 个字符，< 10 字符要求）

THEN   ta:validate_verdict pre_send hook 拒绝写入
       错误: "feedback must be at least 10 characters"
```

### §5.3 争议流程

#### TC-TA-020: Worker 发起争议

```
GIVEN  Task T-001 状态为 "rejected"
       verdict.decision = "rejected", feedback = "大量误译"

WHEN   E-worker 写入 ta:disputed Annotation:
       { reason: "评审标准与 task_spec 不一致", evidence_refs: [...] }

THEN   ta:handle_dispute hook 触发
       → 向 EventWeaver 发送 ew_branch 请求
       → 争议分支 Room 创建 (branch_id = R-dispute-001)
       → ta:status → "disputed"
       → 争议分支包含 task + submission + verdict 的引用
```

#### TC-TA-021: Agent Arbitrator 处理清晰案例

```
GIVEN  Task T-003 disputed
       争议原因：Worker 提交超期（deadline 前 1 小时提交，但 deadline 已过）
       证据清晰：submission.submitted_at > task.requirements.deadline

WHEN   Agent Arbitrator 分析证据
       置信度 = 0.95（明确的时间戳比较）

THEN   Agent 直接发出 ta_verdict: rejected
       无需 escalate to Human
       ta:task_lifecycle: disputed → cancelled
```

#### TC-TA-022: 复杂争议升级到 Human

```
GIVEN  Task T-001 disputed
       争议原因：翻译风格争议（意译 vs 直译）
       Agent Arbitrator 置信度 = 0.4

WHEN   ew:conflict_resolution Flow 判断 confidence <= 0.7

THEN   Flow 状态 → escalated
       Human 被赋予 ta:arbitrator Role
       Human 进入 ta:dispute_tribunal Arena
       Human 可以看到: task_spec + submission + verdict + Worker 的证据
       Human 发出裁决后 → Flow 完成
```

### §5.4 信誉演进

#### TC-TA-030: 从 newcomer 升级到 active

```
GIVEN  E-worker ta:reputation = { level: "newcomer", tasks_completed: 2, avg_score: 0.7 }

WHEN   E-worker 完成第 3 个任务，score = 0.75
       更新后: tasks_completed=3, avg_score=(0.7×2+0.75)/3 ≈ 0.717

THEN   ta:reputation_evolution 检查: 3 >= 3 AND 0.717 > 0.6
       → level 升级为 "active"
```

#### TC-TA-031: 连续 reject 导致 suspended

```
GIVEN  E-worker ta:reputation = { level: "trusted", tasks_completed: 15 }

WHEN   E-worker 连续 3 个任务被 rejected

THEN   ta:reputation_evolution: trusted → suspended
       E-worker 在 30 天内不能认领新任务
       已 claimed 的进行中任务不受影响（但不能认领新的）
```

### §5.5 跨 Socialware 协作

#### TC-TA-040: 端到端争议场景（三方协作）

```
GIVEN  Task T-005: approved → settle_reward 触发

WHEN   ta:settle_reward hook 向 ResPool 发送 rp_request
       ResPool 匹配成功，创建 rp_allocation
       Worker 确认收到 → rp:released
       ResPool 结算 → rp:invoice

THEN   TaskArena 收到结算确认
       EventWeaver 记录: task_completed → reward_requested → resource_allocated → resource_settled
       完整因果链可追溯
```

---

## 6. 依赖关系

```
TaskArena 依赖:
  ezagent.bus built-in: Identity, Room, Timeline, Message
  EventWeaver: 事件记录 + 争议分支管理
  ResPool:     奖励资源发放

TaskArena 被依赖:
  (上层 Socialware 可以 Compose TaskArena 获得任务管理能力)
```

---

## 7. 概念溯源表

| 领域概念 | Bus 层实现 | Socialware 层维度 |
|---------|-----------|------------------|
| Task | Message(datatype=ta_task) | Role(ta:task_spec), Flow(ta:task_lifecycle) |
| Submission | Message(datatype=ta_submission) | Role(ta:submission_artifact), Flow(ta:review_cycle) |
| Verdict | Message(datatype=ta_verdict) | Role(ta:verdict_authority) |
| Task Status | Annotation(ta:status) on task | Flow(ta:task_lifecycle) states |
| Claim | Annotation(ta:claimed) on task | — (纯元数据) |
| Dispute | Annotation(ta:disputed) on task → Room(ew_branch) | Arena(ta:dispute_tribunal), Flow via EventWeaver |
| Reward | rp_request(Message) → rp_allocation(Message) | Commitment(ta:reward_guarantee) |
| Reputation | Annotation(ta:reputation) on Identity | Flow(ta:reputation_evolution) |
| Marketplace | Room with role(ta:marketplace) | Arena(ta:task_marketplace) |
| Workshop | Room with role(ta:workshop) | Arena(ta:task_workshop) |
| Review Chamber | Room per (submission × reviewer) | Arena(ta:review_chamber) |
| Tribunal | Room with role(ta:tribunal) | Arena(ta:dispute_tribunal) |
| Review Window | Timeline segment per review period | Role(ta:review_window) |

---

## 8. UI Manifest (Part C)

> 参见 socialware-spec §2 Part C 和 chat-ui-spec。

### 8.1 Message Templates

```yaml
message_templates:
  - datatype: ta_task
    renderer:
      type: structured_card
      field_mapping:
        header: "requirements.title"
        body: "requirements.description (truncated)"
        metadata:
          - { field: "requirements.reward", format: "{value} {currency}", icon: "coin" }
          - { field: "requirements.deadline", format: "relative_time", icon: "clock" }
          - { field: "requirements.min_reviewers", format: "{n} reviewers", icon: "users" }
        badge: { field: "status", source: "flow:ta:task_lifecycle" }
        thumbnail: null

  - datatype: ta_submission
    renderer:
      type: structured_card
      field_mapping:
        header: "Submission by {author}"
        body: "content (preview)"
        metadata:
          - { field: "submitted_at", format: "relative_time", icon: "clock" }
        badge: { field: "review_state", source: "flow:ta:review_cycle" }

  - datatype: ta_verdict
    renderer:
      type: structured_card
      field_mapping:
        header: "Review by {reviewer}"
        metadata:
          - { field: "verdict", format: "verdict_badge", icon: "check-circle" }
          - { field: "score", format: "star_rating", icon: "star" }
        body: "feedback"
```

### 8.2 Views

```yaml
views:
  - id: "sw:ta:kanban"
    index: "ta:task_board"
    renderer:
      as_room_tab: true
      tab_label: "Board"
      tab_icon: "columns"
      layout: kanban
      layout_config:
        columns_from: "flow:ta:task_lifecycle.states"
        card_renderer: "ta_task"
        drag_drop: true
        drag_transitions:
          "open → claimed": { require_role: "ta:worker" }
          "claimed → in_progress": { require_role: "ta:worker" }

  - id: "sw:ta:review_panel"
    index: "ta:review_index"
    renderer:
      as_room_tab: true
      tab_label: "Review"
      tab_icon: "eye"
      layout: split_pane              # Level 2 自定义
      layout_config:
        left: "ta_submission content"
        right: "ta_verdict thread"
```

### 8.3 Flow Renderers

```yaml
flow_renderers:
  - flow: ta:task_lifecycle
    badge:
      draft: { color: "gray", label: "Draft" }
      open: { color: "blue", label: "Open" }
      claimed: { color: "yellow", label: "Claimed" }
      in_progress: { color: "orange", label: "In Progress" }
      submitted: { color: "purple", label: "Submitted" }
      under_review: { color: "indigo", label: "Under Review" }
      approved: { color: "green", label: "Approved" }
      rejected: { color: "red", label: "Rejected" }
      disputed: { color: "crimson", label: "Disputed" }
      completed: { color: "emerald", label: "Completed" }
      cancelled: { color: "slate", label: "Cancelled" }
    actions:
      - transition: "open → claimed"
        label: "Claim Task"
        icon: "hand-raised"
        style: primary
        visible_to: "role:ta:worker"
        confirm: false

      - transition: "in_progress → submitted"
        label: "Submit Work"
        icon: "upload"
        style: primary
        visible_to: "role:ta:worker"
        confirm: true
        confirm_message: "确认提交？提交后不可修改。"

      - transition: "under_review → approved"
        label: "Approve"
        icon: "check"
        style: primary
        visible_to: "role:ta:reviewer"
        confirm: true

      - transition: "under_review → rejected"
        label: "Reject"
        icon: "x"
        style: danger
        visible_to: "role:ta:reviewer"
        confirm: true

      - transition: "rejected → disputed"
        label: "Dispute"
        icon: "alert-triangle"
        style: danger
        visible_to: "role:ta:worker"
        confirm: true
        confirm_message: "发起争议？将创建仲裁流程。"

  - flow: ta:review_cycle
    badge:
      pending: { color: "yellow", label: "Pending Review" }
      reviewed: { color: "blue", label: "Reviewed" }
      consensus: { color: "green", label: "Consensus" }
    actions: []   # review cycle 主要由 Agent 驱动

  - flow: ta:reputation_evolution
    badge:
      newcomer: { color: "gray", label: "Newcomer" }
      active: { color: "blue", label: "Active" }
      trusted: { color: "green", label: "Trusted" }
      expert: { color: "gold", label: "Expert" }
      suspended: { color: "red", label: "Suspended" }
    actions: []   # reputation 由系统自动推进
```

### 8.4 推荐 Override Level

| 组件 | Level | 理由 |
|------|-------|------|
| ta_task structured_card | Level 1 | 字段映射声明式足够 |
| ta_submission card | Level 1 | 同上 |
| ta_verdict card | Level 1 | 同上 |
| Kanban Board Tab | Level 1 | kanban layout 声明式足够 |
| Review split_pane Tab | **Level 2** | diff view 需要自定义组件 |
| Task lifecycle actions | Level 1 | 按钮声明式足够 |
| Reputation badge | Level 1 | badge 声明式足够 |

---

## 9. 安装与配置

### 9.1 目录结构

```
ezagent/socialware/task-arena/
├── manifest.toml
└── config/
    ├── reward-policies.toml          # 奖励策略
    └── sla-thresholds.toml           # SLA 阈值配置
```

### 9.2 manifest.toml

```toml
[socialware]
id = "task-arena"
name = "TaskArena"
version = "0.9.1"

[declaration]
datatypes = ["ta_task", "ta_submission", "ta_verdict"]
hooks = ["ta.task_lifecycle", "ta.auto_assign", "ta.deadline_check", "ta.dispute_handler", "ta.reward_settle"]
roles = ["ta:publisher", "ta:worker", "ta:reviewer", "ta:arbiter"]
annotations = ["ta:task_meta", "ta:submission_meta", "ta:verdict_meta"]
indexes = ["task_board", "my_tasks", "review_queue", "dispute_list"]

[commands]
post-task = { params = ["title", "reward?", "deadline?"], role = "ta:publisher" }
claim = { params = ["task_id"], role = "ta:worker" }
submit = { params = ["task_id"], role = "ta:worker" }
review = { params = ["submission_id", "verdict"], role = "ta:reviewer" }
dispute = { params = ["task_id", "reason"], role = "ta:worker" }
arbitrate = { params = ["dispute_id", "ruling"], role = "ta:arbiter" }
cancel = { params = ["task_id"], role = "ta:publisher" }

[dependencies]
extensions = ["EXT-01", "EXT-04", "EXT-06", "EXT-14", "EXT-15"]
socialware = ["event-weaver"]
```

---

## 10. EXT-15 Commands

TaskArena 注册以下命令（命名空间 `ta`）：

| 命令 | 参数 | 所需 Role | 说明 |
|------|------|----------|------|
| `/ta:post-task` | `--title`, `--reward?`, `--deadline?` | `ta:publisher` | 发布新任务 |
| `/ta:claim` | `--task-id` | `ta:worker` | 认领开放的任务 |
| `/ta:submit` | `--task-id` | `ta:worker` | 提交任务成果 |
| `/ta:review` | `--submission-id`, `--verdict` (approve/reject) | `ta:reviewer` | 审查提交 |
| `/ta:dispute` | `--task-id`, `--reason` | `ta:worker` | 发起争议 |
| `/ta:arbitrate` | `--dispute-id`, `--ruling` | `ta:arbiter` | 仲裁争议 |
| `/ta:cancel` | `--task-id` | `ta:publisher` | 取消任务 |

命令处理示例：

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
                    error=f"Task is {task.state}, cannot claim")
                return
            await ctx.data.update("ta_task", cmd.params["task_id"],
                state="claimed", worker=event.ref.author)
            # 记录 EventWeaver 事件
            await ctx.emit_event("task_claimed", {
                "task_id": cmd.params["task_id"],
                "worker": event.ref.author
            })
            await ctx.command.result(cmd.invoke_id, status="success",
                result={"task_id": cmd.params["task_id"], "new_state": "claimed"})
```

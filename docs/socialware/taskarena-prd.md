# TaskArena — Product Requirements Document v0.3.0

> **状态**：Draft
> **日期**：2026-02-27
> **前置文档**：ezagent-socialware-spec-v0.9.3
> **定位**：应用级 Socialware
> **依赖**：EventWeaver（事件追踪与争议管理）、ResPool（资源获取与奖励发放）
> **架构**：方案 E — Role-Driven Message（Socialware 不创建 Datatype，状态从 Message 纯派生）

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

1. **发布**：Publisher 发送 content_type="ta:task.propose" Message：
   - type=bounty, title="Tech Doc EN→JP Translation"
   - requirements: skills=["translation", "japanese", "technical_writing"], deadline=3 days
   - rewards: type=token, amount=200, currency=USDT, distribution=winner_takes_all
   - 原文作为 attachment（Content Object）关联

2. **发现**：Worker 浏览 `ta:task_marketplace` Arena（通过 `ta:open_tasks` Index），按技能过滤找到此任务

3. **认领**：Worker（Human Translator）写入 `ta:claimed` Annotation → ta:task_lifecycle: open → claimed

4. **执行**：Worker 在 `ta:task_workshop` Arena 中工作，上传翻译稿

5. **提交**：Worker 发送 ta:task.submit Message，附带交付物引用 → ta:task_lifecycle: in_progress → submitted

6. **评审**：`ta:assign_reviewers` Hook 自动选择 2 名 Reviewer：
   - Reviewer A（日语母语 Agent，擅长文法检查）
   - Reviewer B（Human 技术专家，擅长术语准确性）
   - 两人在各自独立的 `ta:review_chamber` Arena 中评审，互不可见

7. **裁决**：两名 Reviewer 分别发送 ta:verdict.* Message：
   - A: approved, score=0.85, feedback="文法流畅，少数助词使用不准确"
   - B: approved, score=0.90, feedback="术语翻译准确，建议统一 API 相关术语"
   - `ta:compute_consensus` Hook：2/2 approved → 共识达成 → Flow state → approved

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

3. Agent 在 workshop Room 中分析代码，生成审查报告（ta:task.submit Message）

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
   - 向 EventWeaver 发送 ew:branch.create Message 请求 → 创建争议分支 Room
   - 争议分支包含原 task、submission、verdict 的快照
   - ta:task_lifecycle: rejected → disputed

4. Agent Arbitrator 首先尝试分析：
   - 对比 task_spec 和 verdict.feedback 的措辞
   - 置信度 = 0.5（模糊，task_spec 确实存在歧义）→ escalate to Human

5. Human Arbitrator 被赋予 ta:arbitrator Role，进入 `ta:dispute_tribunal` Arena：
   - 查看 task_spec（"以意译为主，保持技术术语准确"）
   - 查看 Worker 的翻译和 Reviewer 的批注
   - 认为 Worker 的翻译基本符合"意译为主"的要求
   - 发送 ta:verdict Message: approved, score=0.7, feedback="翻译质量可接受，task_spec 表述模糊导致评审标准不一致"

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

## 3. Part A: 协议层约定

```yaml
id: "task-arena"
namespace: "ta"
version: "0.9.3"
dependencies: ["channels", "reply-to", "command", "runtime"]
```

### 3.1 Content Types

TaskArena 不创建 Datatype。所有数据以普通 Message（特定 content_type）形式存在于 Timeline 中。

#### ta:task.propose — 任务发布

```yaml
type: "ta:task.propose"
description: "发布一个新任务。此 Message 成为 Flow subject（task_lifecycle 的起点）"
required_capability: "task.propose"
flow_subject: true
reply_to_type: null                  # 不需要 reply_to（这是新 Flow 的起点）
body_schema:
  title:          string
  description:    any                  # 富文本，JSON-compatible
  task_type:      string               # "bounty", "assigned", "competitive", "collaborative"
  requirements:
    skills:       [string]
    resource_needs: [ResourceNeedTemplate] | null
    deadline:     RFC 3339 | null
    min_reviewers: number
    max_submissions: number | null
    max_workers:  number | null
  rewards:
    type:         string               # "token", "reputation", "resource_credit", "custom"
    amount:       number
    currency:     string
    distribution: string               # "winner_takes_all", "proportional", "equal"
  review_config:
    auto_approve_threshold: number | null
    consensus_rule:  string            # "unanimous", "majority", "weighted_average"
  attachments:    [ContentRef]
```

#### ta:task.claim — 认领任务

```yaml
type: "ta:task.claim"
required_capability: "task.claim"
flow_trigger: "open → claimed"
reply_to_type: "ta:task.propose"       # MUST reply_to 一个 task.propose Message
body_schema:
  reason:         string | null        # 认领理由
```

#### ta:task.submit — 提交成果

```yaml
type: "ta:task.submit"
required_capability: "task.submit"
flow_trigger: "claimed → submitted"
reply_to_type: "ta:task.propose"
body_schema:
  artifacts:      [ContentRef]
  notes:          string | null
  revision_of:    ref_id | null        # 如果是修改稿，指向前一个 submit Message
```

#### ta:task.cancel — 取消任务

```yaml
type: "ta:task.cancel"
required_capability: "task.cancel"
flow_trigger: "open → cancelled"
reply_to_type: "ta:task.propose"
body_schema:
  reason:         string
```

#### ta:verdict.approve — 审批通过

```yaml
type: "ta:verdict.approve"
required_capability: "verdict.approve"
flow_trigger: "in_review → approved"   # 需达到共识规则
reply_to_type: "ta:task.submit"        # reply_to 指向 submission Message
body_schema:
  score:          number               # 0.0 - 1.0
  feedback:       string               # [MUST] 非空, >= 10 字符
  categories:     Map<string, number> | null
```

#### ta:verdict.reject — 审批拒绝

```yaml
type: "ta:verdict.reject"
required_capability: "verdict.reject"
flow_trigger: "in_review → rejected"   # 需达到共识规则
reply_to_type: "ta:task.submit"
body_schema:
  score:          number
  feedback:       string               # [MUST] 非空
  categories:     Map<string, number> | null
```

#### ta:verdict.request_revision — 请求修改

```yaml
type: "ta:verdict.request_revision"
required_capability: "verdict.request_revision"
flow_trigger: "in_review → claimed"    # 回到 claimed 状态
reply_to_type: "ta:task.submit"
body_schema:
  feedback:       string
  required_changes: [string]
```

#### ta:dispute.open — 发起争议

```yaml
type: "ta:dispute.open"
required_capability: "task.dispute"
flow_trigger: "rejected → disputed"
reply_to_type: "ta:task.propose"
body_schema:
  reason:         string
  evidence_refs:  [ContentRef]
```

#### ta:dispute.resolve — 解决争议

```yaml
type: "ta:dispute.resolve"
required_capability: "dispute.resolve"
flow_trigger: "disputed → completed OR disputed → cancelled"
reply_to_type: "ta:task.propose"
body_schema:
  decision:       string               # "approved", "rejected"
  reasoning:      string
  score_override: number | null
```

#### ta:role.grant / ta:role.revoke — 角色管理

```yaml
type: "ta:role.grant"
required_capability: "role.manage"
body_schema:
  entity:         Entity ID
  role:           string               # "ta:publisher", "ta:worker", etc.

type: "ta:role.revoke"
required_capability: "role.manage"
body_schema:
  entity:         Entity ID
  role:           string
```

### 3.2 Hooks

#### pre_send: ta:check_role (priority 100)

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `insert` |
| trigger.filter | `content_type startswith 'ta:'` |
| priority | `100` |

- [MUST] 从 content_type 提取 action（如 `ta:task.claim` → `task.claim`）。
- [MUST] 查询 State Cache 的 role_map，验证 sender 拥有 action 对应的 capability。
- [MUST] 验证失败时拒绝写入。

#### pre_send: ta:check_flow (priority 101)

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `insert` |
| trigger.filter | `content_type startswith 'ta:' AND ext.reply_to exists` |
| priority | `101` |

- [MUST] 通过 ext.reply_to 找到 Flow subject（原始 ta:task.propose Message）。
- [MUST] 从 State Cache 读取 Flow subject 的当前状态。
- [MUST] 验证 (current_state, action) 是否为合法 transition。
- [MUST] 验证失败时拒绝写入。

#### pre_send: ta:check_business_rules (priority 102)

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `insert` |
| trigger.filter | `content_type == 'ta:task.claim'` |
| priority | `102` |

- [MUST] 对于 bounty 类型，验证没有其他 active claim（从 State Cache 读取）。
- [MUST] 验证 claimer 满足 task 的 skills 要求。
- [MUST] 对于 assigned 类型，验证 claimer ∈ task.assigned_to。
- [MUST] 对于 collaborative 类型，验证当前 claimed 数 < max_workers。

#### after_write: ta:advance_flow (priority 100)

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `insert` |
| trigger.filter | `content_type startswith 'ta:'` |
| priority | `100` |

- [MUST] 更新 State Cache：flow_states、task_details、claims、submissions、verdicts。
- [MUST] 处理自动转换链（如 submitted → in_review）。
- [MUST] 处理 CRDT 合并冲突：非法 transition 的 Message 标记为 invalid_refs。

#### after_write: ta:check_consensus (priority 101)

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `insert` |
| trigger.filter | `content_type startswith 'ta:verdict.'` |
| priority | `101` |

- [MUST] 收集 State Cache 中当前 submission 的所有 verdict。
- [MUST] 检查是否达到 min_reviewers 数量。
- 如果达到且共识达成：发送 content_type 为 `ta:_system.consensus_reached` 的系统 Message。
- 触发奖励结算：向 Platform Bus 发送 `rp:allocation.request` Message。

#### after_write: ta:check_commitments (priority 102)

| 字段 | 值 |
|------|---|
| trigger.datatype | `timeline_index` |
| trigger.event | `insert` |
| trigger.filter | `content_type startswith 'ta:'` |
| priority | `102` |

- [MUST] 检查 deadline 相关 Commitment 状态。
- [MUST] 激活/更新 State Cache 中的 commitment 记录。
- [SHOULD] 向 EventWeaver 发送 `ew:event.record` Message 记录状态变更。

### 3.3 State Cache Schema

> State Cache 是从 Timeline Message 纯派生的内存数据结构，不参与 CRDT Sync。

```python
class TaskArenaState:
    # Flow 状态
    flow_states: dict[str, str]              # task_ref_id → current state
    task_details: dict[str, dict]            # task_ref_id → task body
    claims: dict[str, list[str]]             # task_ref_id → [claim ref_ids]
    submissions: dict[str, list[str]]        # task_ref_id → [submission ref_ids]
    verdicts: dict[str, list[dict]]          # submission_ref_id → [verdict info]

    # Role 映射
    role_map: dict[tuple[str,str], set[str]] # (room_id, entity_id) → {roles}

    # Commitment
    commitments: dict[str, dict]             # commitment_id → status

    # 冲突跟踪
    invalid_refs: set[str]                   # CRDT 合并冲突导致的无效 Message

    # 信誉（可选，跨 Room 聚合）
    reputation: dict[str, dict]              # entity_id → reputation info
```

### 3.4 Indexes

TaskArena 主要依赖 EXT-17 Runtime 的通用 `socialware_messages` Index。额外声明以下 Socialware-specific Index（由 Socialware Runtime 自己维护，不是 Bus Index）：

```python
# 这些是 Socialware HTTP API 端点，从 State Cache 查询
@api("GET /ta/tasks")
async def list_tasks(room_id, state=None, task_type=None):
    """开放任务列表（对应旧 ta:open_tasks Index）"""

@api("GET /ta/tasks/{ref_id}")
async def get_task(ref_id):
    """任务详情（对应旧 ta:task_detail Index）"""

@api("GET /ta/my-tasks")
async def my_tasks(entity_id, room_id=None):
    """我的任务列表（对应旧 ta:my_tasks Index）"""

@api("GET /ta/reviews/pending")
async def pending_reviews(entity_id):
    """待审队列（对应旧 ta:review_queue Index）"""

@api("GET /ta/reputation")
async def reputation_board(specialty=None):
    """信誉排行（对应旧 ta:reputation_board Index）"""
```

---

## 4. Part B: Socialware 层声明

### 4.1 Roles

```yaml
roles:
  # ─── 施加于 Identity ───
  - id: ta:publisher
    assignable_to: [Identity]
    capabilities: [task.propose, task.cancel, role.manage]
    description: "任务发布者——可以发布、取消任务和管理角色"

  - id: ta:worker
    assignable_to: [Identity]
    capabilities: [task.claim, task.submit, task.dispute]
    description: "任务执行者——可以认领、提交和争议"

  - id: ta:reviewer
    assignable_to: [Identity]
    capabilities: [verdict.approve, verdict.reject, verdict.request_revision]
    description: "评审者——可以审批、拒绝和请求修改"

  - id: ta:arbitrator
    assignable_to: [Identity]
    capabilities: [dispute.resolve]
    description: "仲裁角色。HiTL 的典型入口——当 Agent Arbitrator
                  置信度不足时，Human 被赋予此 Role"

  # ─── 施加于 Room ───
  - id: ta:marketplace
    assignable_to: [Room]
    description: "任务市场——发现和推荐任务"

  - id: ta:workshop
    assignable_to: [Room]
    description: "工作空间——Worker 执行任务的场所"

  - id: ta:tribunal
    assignable_to: [Room]
    description: "仲裁庭——争议裁决的场所"

  # ─── 施加于 Message（通过 content_type 隐含）───
  # ta:task.propose Message 隐含 ta:task_spec Role（定义范围和奖励）
  # ta:task.submit Message 隐含 ta:submission_artifact Role（交付物凭证）
  # ta:verdict.* Message 隐含 ta:verdict_authority Role（最终决定）
```

**Role → Capability → content_type 映射**：

```
ta:publisher  → task.propose      → ta:task.propose
              → task.cancel       → ta:task.cancel
              → role.manage       → ta:role.grant, ta:role.revoke

ta:worker     → task.claim        → ta:task.claim
              → task.submit       → ta:task.submit
              → task.dispute      → ta:dispute.open

ta:reviewer   → verdict.approve   → ta:verdict.approve
              → verdict.reject    → ta:verdict.reject
              → verdict.request_revision → ta:verdict.request_revision

ta:arbitrator → dispute.resolve   → ta:dispute.resolve
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
    over: [Room with role(ta:workshop), created per task on ta:task.claim]
    boundary: internal
    entry_policy: >
      role_required(ta:publisher who published this task
                    | ta:worker who claimed this task)
    purpose: "任务执行的工作空间。Publisher 和 Worker 可在此沟通"

  - id: ta:review_chamber
    over: [Room created per (submission × reviewer) pair]
    boundary: internal
    entry_policy: >
      role_required(ta:reviewer assigned to this submission)
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
    triggered_by: "Flow state → approved"
    enforcement: "ta:check_commitments after_write Hook 自动检测并触发 rp:allocation.request"

  - id: ta:scope_stability
    between: [Identity with role(ta:publisher), Identity with role(ta:worker)]
    obligation: "任务范围在认领后不单方面变更"
    triggered_by: "ta:task.claim Message 写入"
    enforcement: "认领后 task 描述变更需通过 ta:task.amend content_type（需双方确认）"

  - id: ta:delivery_promise
    between: [Identity with role(ta:worker), Identity with role(ta:publisher)]
    obligation: "在 deadline 前提交符合 task_spec 的成果"
    triggered_by: "ta:task.claim Message 写入"
    expires: "task.deadline OR Flow state → cancelled"

  # ─── Reviewer ↔ Worker ───
  - id: ta:fair_review
    between: [Identity with role(ta:reviewer), Identity with role(ta:worker)]
    obligation: "基于 task_spec 中声明的标准评审，提供具体反馈
                 （verdict.feedback 非空且 >= 10 字符）"
    triggered_by: "Reviewer 被分配到 submission（系统自动分配）"
    enforcement: "ta:check_business_rules pre_send Hook 验证 feedback 质量"

  # ─── Room ↔ Identity ───
  - id: ta:marketplace_neutrality
    between: [Room with role(ta:marketplace), any Identity]
    obligation: "任务推荐不偏向特定 Worker，排序算法透明可审计"
    triggered_by: always

  - id: ta:due_process
    between: [Room with role(ta:tribunal), disputing parties]
    obligation: "双方有平等的证据提交和陈述机会，
                 仲裁者必须在查看双方材料后才能发出裁决"
    triggered_by: "ta:dispute.open Message 写入"
    enforcement: "tribunal Room 的 entry_policy 确保双方进入"

  # ─── Message 级（通过 content_type 隐含）───
  - id: ta:spec_binding
    between: [ta:task.propose Message author (Publisher),
              ta:task.claim Message author (Worker)]
    obligation: "ta:task.propose 的 body 是双方协作的契约基础，评审标准由此确定"
    triggered_by: "ta:task.claim Message（reply_to 指向 task.propose）"

  - id: ta:verdict_finality
    between: [ta:verdict.* Message author (Reviewer), all parties]
    obligation: "裁决结果为最终结果，除非在 72h 内发送 ta:dispute.open"
    triggered_by: "共识达成（ta:_system.consensus_reached）"

  # ─── Socialware ↔ Socialware ───
  - id: ta:event_reporting
    between: [TaskArena Identity, EventWeaver Identity]
    obligation: "所有 Task 状态变更作为 ew:event.record Message 报告到 Platform Bus"
    triggered_by: "any Flow state change"

  - id: ta:resource_settlement
    between: [TaskArena Identity, ResPool Identity]
    obligation: "任务完成后通过 ResPool 结算（rp:allocation.request），任务取消后释放预留资源"
    triggered_by: "Flow state → completed OR cancelled"
```

### 4.4 Flows

```yaml
flows:
  - id: ta:task_lifecycle
    subject_type: "ta:task.propose"     # Flow subject = task.propose Message
    states:
      [open, claimed, submitted,
       in_review, approved, rejected, disputed, completed, cancelled]
    transitions:
      # (current_state, trigger content_type action) → new_state
      (open, task.claim):           claimed
      (open, task.cancel):          cancelled
      (claimed, task.submit):       submitted
      (submitted, _auto):           in_review          # 自动转换
      (in_review, verdict.approve): approved            # 需达到共识规则
      (in_review, verdict.reject):  rejected            # 需达到共识规则
      (in_review, verdict.request_revision): claimed    # 回到 claimed
      (approved, _auto):            completed           # 自动结算
      (rejected, dispute.open):     disputed
      (disputed, dispute.resolve):  completed | cancelled  # 取决于 decision 字段
      (claimed, _timeout):          open                # Worker 超时未提交
    preferences:
      fast_iteration: preferred
      multi_reviewer: preferred_when(rewards.amount > threshold)
      auto_approve: allowed_when(reviewer_consensus == unanimous AND score > 0.9)
      escalate_to_human: preferred_when(disputed AND agent_confidence < 0.7)
      revision_over_rejection: preferred_when(score > 0.4 AND score < 0.6)

  - id: ta:review_cycle
    subject_type: "ta:task.submit"      # Flow subject = submit Message
    states: [pending_review, assigned, in_review, scored, abstained]
    transitions:
      (pending_review, _auto):       assigned          # 自动分配 Reviewer
      (assigned, _reviewer_opens):   in_review
      (in_review, verdict.approve):  scored
      (in_review, verdict.reject):   scored
      (assigned, _timeout):          abstained
    preferences:
      independent_review: required
      reviewer_diversity: preferred (Human + Agent mix)
      min_reviewers: 2
      abstain_consequence: reputation_decrease_for_reviewer

  - id: ta:reputation_evolution
    subject_type: "ta:role.grant WHERE role == ta:worker"  # worker 角色授予时创建
    states: [newcomer, active, trusted, expert, suspended]
    transitions:
      (newcomer, _eval):  active     # completed 3+ tasks, avg_score > 0.6
      (active, _eval):    trusted    # completed 10+ tasks, avg_score > 0.8
      (trusted, _eval):   expert     # completed 30+ tasks, avg_score > 0.9
      (any, _violation):  suspended  # 3+ rejected in window OR 2+ disputes lost
      (suspended, _appeal): active   # 30d cooling + appeal approved
    preferences:
      slow_promotion: preferred
      fast_demotion: preferred
      rehabilitation: allowed_after(30d cooling_period)
```

---

## 5. 验证用例

### §5.1 任务发布与认领

#### TC-TA-001: 发布 Bounty 任务

```
GIVEN  TaskArena 已初始化
       E-publisher 拥有 ta:publisher Role

WHEN   E-publisher 发送 content_type="ta:task.propose" Message:
       { task_type: "bounty", title: "Translate doc EN→JP",
         requirements: { skills: ["translation", "japanese"], deadline: "2026-02-27T00:00:00Z" },
         rewards: { type: "token", amount: 200, currency: "USDT", distribution: "winner_takes_all" } }

THEN   Flow state 写入: { state: "open" }
       await ta.tasks.list(status="open") 包含此任务
       EventWeaver 收到 ew:event.record Message { event_type: "task_created" }
```

#### TC-TA-002: Worker 认领任务

```
GIVEN  Task T-001 状态为 open, requirements.skills = ["translation", "japanese"]
       E-worker Identity 上有 ta:skills Annotation: { verified: [{ skill: "translation" }, { skill: "japanese" }] }

WHEN   E-worker 发送 content_type="ta:task.propose" Message.claimed field on T-001

THEN   ta:check_business_rules Hook 验证 skills 匹配 → 通过
       ta:advance_flow Hook 将 Flow state 更新为 "claimed"
       Workshop Room 创建，E-publisher 和 E-worker 作为成员
       ta:task_lifecycle: open → claimed
```

#### TC-TA-003: 技能不匹配认领被拒

```
GIVEN  Task T-001 requirements.skills = ["translation", "japanese"]
       E-worker2 只有 ta:skills: ["translation", "french"]

WHEN   E-worker2 发送 content_type="ta:task.propose" Message.claimed field on T-001

THEN   ta:check_business_rules Hook 验证 skills 不匹配（缺少 "japanese"）→ 拒绝
```

#### TC-TA-004: Assigned 任务直接进入 claimed

```
GIVEN  Task T-002: type=assigned, assigned_to=[E-worker]

WHEN   E-publisher 发布任务

THEN   Flow state 直接设为 "claimed"（跳过 open）
       E-worker 自动收到通知
```

### §5.2 评审流程

#### TC-TA-010: 提交成果并触发评审分配

```
GIVEN  Task T-001 状态为 in_progress
       E-worker 在 workshop 中准备好了翻译稿

WHEN   E-worker 发送 ta:task.submit Message:
       { task_ref: "T-001", artifacts: [{ type: "document", content_id: "..." }] }

THEN   ta:advance_flow Hook (auto-assign) 触发
       选择 2 名 Reviewer（假设 E-reviewer-A, E-reviewer-B）
       系统发送 ta:_system.reviewer_assigned Message
       为每个 Reviewer 创建独立的 review_chamber Room
       ta:task_lifecycle: submitted → under_review
```

#### TC-TA-011: Reviewer 评审通过

```
GIVEN  Submission S-001 已分配给 E-reviewer-A 和 E-reviewer-B
       task.review_config.consensus_rule = "unanimous"

WHEN   E-reviewer-A 发送 ta:verdict Message:
       { decision: "approved", score: 0.85, feedback: "文法流畅..." }
       E-reviewer-B 发送 ta:verdict Message:
       { decision: "approved", score: 0.90, feedback: "术语准确..." }

THEN   ta:check_consensus Hook: 2/2 approved, unanimous → 共识达成
       Flow state → "approved"
       ta:check_commitments Hook 触发 → 向 ResPool 请求发放 200 USDT
       State Cache reputation 更新: avg_score = (0.85 + 0.90) / 2 = 0.875
       ta:task_lifecycle: under_review → approved → completed
```

#### TC-TA-012: 评审意见不一致需额外 Reviewer

```
GIVEN  Submission S-001, consensus_rule = "majority", min_reviewers = 2

WHEN   E-reviewer-A: approved, score=0.8
       E-reviewer-B: rejected, score=0.3

THEN   ta:compute_consensus: 1 approved, 1 rejected → 无共识
       系统自动分配第 3 名 Reviewer (E-reviewer-C)
       等待 E-reviewer-C 的 verdict
```

#### TC-TA-013: Verdict feedback 验证

```
GIVEN  E-reviewer 尝试提交 verdict

WHEN   verdict.feedback = "OK"（仅 2 个字符，< 10 字符要求）

THEN   ta:check_business_rules pre_send Hook 拒绝写入
       错误: "feedback must be at least 10 characters"
```

### §5.3 争议流程

#### TC-TA-020: Worker 发起争议

```
GIVEN  Task T-001 状态为 "rejected"
       verdict.decision = "rejected", feedback = "大量误译"

WHEN   E-worker 写入 ta:disputed Annotation:
       { reason: "评审标准与 task_spec 不一致", evidence_refs: [...] }

THEN   ta:advance_flow Hook (dispute) 触发
       → 向 EventWeaver 发送 ew:branch.create Message 请求
       → 争议分支 Room 创建 (branch_id = R-dispute-001)
       → Flow state → "disputed"
       → 争议分支包含 task + submission + verdict 的引用
```

#### TC-TA-021: Agent Arbitrator 处理清晰案例

```
GIVEN  Task T-003 disputed
       争议原因：Worker 提交超期（deadline 前 1 小时提交，但 deadline 已过）
       证据清晰：submission.submitted_at > task.requirements.deadline

WHEN   Agent Arbitrator 分析证据
       置信度 = 0.95（明确的时间戳比较）

THEN   Agent 直接发送 ta:verdict Message: rejected
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

WHEN   ta:check_commitments Hook 向 ResPool 发送 rp_request
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

| 领域概念 | 协议层实现 | Socialware 层维度 |
|---------|-----------|------------------|
| Task | Message(content_type=ta:task.propose) | Flow(ta:task_lifecycle) subject |
| Submission | Message(content_type=ta:task.submit, reply_to=task) | Flow(ta:review_cycle) subject |
| Verdict | Message(content_type=ta:verdict.*, reply_to=submission) | Role(ta:reviewer capability) |
| Task Status | State Cache 纯派生（从 Message 序列计算） | Flow(ta:task_lifecycle) states |
| Claim | Message(content_type=ta:task.claim, reply_to=task) | Commitment(ta:delivery_promise 激活) |
| Dispute | Message(content_type=ta:dispute.open, reply_to=task) | Arena(ta:dispute_tribunal), Flow(rejected → disputed) |
| Reward | rp:allocation.request Message → Platform Bus | Commitment(ta:reward_guarantee) |
| Reputation | State Cache 聚合（从 verdict 序列计算） | Flow(ta:reputation_evolution) |
| Marketplace | Room with role(ta:marketplace) | Arena(ta:task_marketplace) |
| Workshop | Room with role(ta:workshop) | Arena(ta:task_workshop) |
| Review Chamber | Room per (submission × reviewer) | Arena(ta:review_chamber) |
| Tribunal | Room with role(ta:tribunal) | Arena(ta:dispute_tribunal) |
| Review Window | Commitment deadline（State Cache 跟踪） | Commitment(ta:fair_review) timeout |

---

## 8. UI Manifest (Part C)

> 参见 socialware-spec §2 Part C 和 chat-ui-spec。

### 8.1 Message Renderers

```yaml
message_renderers:
  - content_type: "ta:task.propose"
    renderer:
      type: structured_card
      field_mapping:
        header: "body.title"
        body: "body.description (truncated)"
        metadata:
          - { field: "body.rewards", format: "{amount} {currency}", icon: "coin" }
          - { field: "body.requirements.deadline", format: "relative_time", icon: "clock" }
          - { field: "body.requirements.min_reviewers", format: "{n} reviewers", icon: "users" }
        badge: { source: "flow:ta:task_lifecycle" }
        thumbnail: null

  - content_type: "ta:task.submit"
    renderer:
      type: structured_card
      field_mapping:
        header: "Submission by {author}"
        body: "body.notes (preview)"
        metadata:
          - { field: "created_at", format: "relative_time", icon: "clock" }
        badge: { source: "flow:ta:review_cycle" }

  - content_type: "ta:verdict.*"
    renderer:
      type: structured_card
      field_mapping:
        header: "Review by {author}"
        metadata:
          - { field: "content_type_action", format: "verdict_badge", icon: "check-circle" }
          - { field: "body.score", format: "star_rating", icon: "star" }
        body: "body.feedback"

  - content_type: "ta:task.claim"
    renderer:
      type: inline_activity
      template: "{author} claimed this task"

  - content_type: "ta:dispute.*"
    renderer:
      type: alert_card
      style: warning
      field_mapping:
        header: "Dispute"
        body: "body.reason"
```

### 8.2 Views

```yaml
views:
  - id: "sw:ta:kanban"
    data_source: "GET /ta/tasks"       # State Cache query
    renderer:
      as_room_tab: true
      tab_label: "Board"
      tab_icon: "columns"
      layout: kanban
      layout_config:
        columns_from: "flow:ta:task_lifecycle.states"
        card_content_type: "ta:task.propose"
        drag_drop: true
        drag_transitions:
          "open → claimed": { require_role: "ta:worker", sends: "ta:task.claim" }

  - id: "sw:ta:review_panel"
    data_source: "GET /ta/reviews/pending"
    renderer:
      as_room_tab: true
      tab_label: "Review"
      tab_icon: "eye"
      layout: split_pane
      layout_config:
        left: "ta:task.submit body"
        right: "ta:verdict.* thread"
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
| ta:task.propose card | Level 1 | 字段映射声明式足够 |
| ta:task.submit card | Level 1 | 同上 |
| ta:verdict.* card | Level 1 | 同上 |
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
namespace = "ta"
version = "0.9.3"

[declaration]
content_types = ["ta:task.propose", "ta:task.claim", "ta:task.submit", "ta:task.cancel",
                 "ta:verdict.approve", "ta:verdict.reject", "ta:verdict.request_revision",
                 "ta:dispute.open", "ta:dispute.resolve",
                 "ta:role.grant", "ta:role.revoke"]
hooks = ["check_role", "check_flow", "check_business_rules", "advance_flow", "check_consensus", "check_commitments"]
roles = ["ta:publisher", "ta:worker", "ta:reviewer", "ta:arbiter"]
flows = ["task_lifecycle", "review_cycle", "reputation_evolution"]

[commands]
post-task = { params = ["title", "reward?", "deadline?"], role = "ta:publisher" }
claim = { params = ["task_id"], role = "ta:worker" }
submit = { params = ["task_id"], role = "ta:worker" }
review = { params = ["submission_id", "verdict"], role = "ta:reviewer" }
dispute = { params = ["task_id", "reason"], role = "ta:worker" }
arbitrate = { params = ["dispute_id", "ruling"], role = "ta:arbiter" }
cancel = { params = ["task_id"], role = "ta:publisher" }

[dependencies]
extensions = ["EXT-04", "EXT-06", "EXT-15", "EXT-17"]
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
            task_ref_id = cmd.params["task_id"]
            task_state = self.state.flow_states.get(task_ref_id)
            if task_state != "open":
                await ctx.command.result(cmd.invoke_id, status="error",
                    error=f"Task is {task_state}, cannot claim")
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

# ResPool — Product Requirements Document v0.2.1

> **状态**：Draft
> **日期**：2026-02-26
> **前置文档**：ezagent-socialware-spec-v0.9.1
> **定位**：平台基础设施级 Socialware

---

## 1. 产品概述

### 1.1 产品定位

ResPool 是 ezagent 平台的**资源抽象层**。它将现实世界中形态各异的资源（算力、人力、渠道、流量、存储、API 配额等）统一抽象为可发现、可申请、可分配、可计量、可结算的标准化对象。

ResPool 不拥有任何资源，也不执行任何资源的具体操作。它是一个**协调者**——帮助资源的提供方和消费方找到彼此、建立协议、追踪使用、完成结算。

### 1.2 核心价值

**统一抽象**：无论是 GPU 算力、Human 劳动时间、社交媒体渠道还是 API 调用配额，在 ResPool 中都遵循同一套发现→申请→分配→使用→释放→结算的协议。上层 Socialware 不需要为每种资源类型实现专门的对接逻辑。

**市场化定价**：资源的价格不是硬编码的，而是由 Provider 声明的 pricing model 决定。支持固定价格、按量计费、拍卖等多种定价模型，让供需关系自然调节。

**可审计结算**：每一笔资源分配都有完整的凭证链——从申请到分配到用量报告到最终账单，所有信息都以 Annotation 形式附着在 CRDT 数据上，不可篡改、可追溯。

**组合性**：ResPool 作为独立 Socialware，可以被多个上层 Socialware 共享。TaskArena 可以通过 ResPool 发放任务奖励，EventWeaver 可以通过 ResPool 管理存储配额，第三方 Socialware 也可以通过 Platform Bus 直接与 ResPool 交互。

### 1.3 用户角色

| 角色 | 典型用户 | 核心需求 |
|------|---------|---------|
| Provider | GPU 集群所有者、自由职业者、渠道运营商 | 注册资源、设定价格、追踪收入 |
| Consumer | TaskArena（代 Publisher 申请奖励）、Agent（申请算力）、Human（申请人力协助） | 发现资源、发起申请、管理租约 |
| Auditor | 平台运营、财务审计 | 审查分配记录、验证计费准确性 |
| Platform Admin | 系统管理员 | 管理全局配额策略、处理异常 |

---

## 2. 使用场景

### 场景 1：TaskArena 的任务奖励发放

**背景**：一个翻译任务完成了评审，Worker 的成果被批准，需要发放 50 USDT 奖励。

**流程**：

1. TaskArena 的 `ta:settle_reward` Hook 触发，向 Platform Bus 发送消息，请求 ResPool 分配奖励资源
2. ResPool 收到请求，发送 rp:allocation.request Message：type=token, amount=50, currency=USDT
3. `rp:match_and_allocate` Hook 查询可用资源池：找到 Publisher 预存的 USDT 余额
4. 发送 rp:allocation.matched Message：从 Publisher 余额中扣除 50 USDT，分配给 Worker
5. Worker 确认收到（写入 rp:allocation.released Message 字段）
6. `rp:billing` Hook 生成 `rp:invoice` Annotation，记录完整结算凭证
7. EventWeaver 收到 `resource_settled` 事件

**价值**：TaskArena 不需要直接处理转账逻辑，只需向 ResPool 提交标准化的资源请求。

### 场景 2：Agent 申请 GPU 算力

**背景**：一个 AI Agent 需要运行大模型推理任务，需要临时租用 4 块 A100 GPU，预计使用 2 小时。

**流程**：

1. Agent（Consumer）通过 `rp:resource_marketplace` Arena 查询可用 GPU 资源
2. `rp:available_index` 返回 3 个 Provider 的报价：
   - Provider A：4×A100, $8/GPU/hour, 即时可用
   - Provider B：4×A100, $6/GPU/hour, 30 分钟后可用
   - Provider C：2×A100, $7/GPU/hour, 即时可用（数量不足）
3. Agent 选择 Provider A，发送 rp:allocation.request Message：type=compute, amount=4, unit=A100-hour, duration=2h, budget.max=64
4. `rp:match_and_allocate` Hook 匹配 Provider A 的资源，发送 rp:allocation.matched Message
5. Agent 开始使用 GPU，每 15 分钟上报一次 rp:allocation.usage Message 字段
6. 2 小时后 Agent 写入 rp:allocation.released Message 字段
7. `rp:billing` Hook 根据实际用量（1h45min × 4GPU × $8）= $56 生成账单

**价值**：统一的资源市场让 Agent 可以自动完成资源采购，无需人工干预。

### 场景 3：Human 劳动力的按需调度

**背景**：一个客服 Socialware 在高峰时段需要额外的 Human 客服人员支持。

**流程**：

1. 客服 Socialware 通过 Platform Bus 向 ResPool 发送 rp:allocation.request Message：type=human_labor, amount=3, unit=person, skills=["customer_support", "mandarin"], duration=4h
2. ResPool 查询已注册的 Human 劳动力资源（freelancer 在 ResPool 中注册了自己的可用时间和技能）
3. 匹配到 5 个候选人，按 pricing 和 rating 排序
4. 向前 3 名候选人发送分配邀请（发送 rp:allocation.matched Message 并通知）
5. 候选人接受邀请（写入 rp:allocation.usage Message 字段 表示开始工作）
6. 4 小时后工作结束，写入 rp:allocation.released Message
7. 按小时计费结算

**价值**：Human 劳动力与 GPU 算力使用完全相同的申请-分配-计量-结算流程。

### 场景 4：社交媒体渠道的流量分配

**背景**：一个营销 Socialware 需要在 3 个社交媒体渠道上发布内容，每个渠道有不同的日发布配额。

**流程**：

1. 渠道运营商（Provider）在 ResPool 注册资源：
   - Channel A：type=channel, subtype=twitter, capacity=10 posts/day, pricing=fixed $5/post
   - Channel B：type=channel, subtype=weibo, capacity=20 posts/day, pricing=fixed ¥15/post
   - Channel C：type=channel, subtype=linkedin, capacity=5 posts/day, pricing=per_engagement $0.01/interaction
2. 营销 Socialware 申请：3 个渠道各 1 个 post slot
3. ResPool 分配，发送 3 个 rp:allocation.matched Message
4. 营销 Socialware 使用分配的 slot 发布内容
5. Channel C 的 engagement 数据持续更新到 rp:allocation.usage Message 字段 中
6. 结算时 Channel A/B 按固定价格，Channel C 按实际互动量计费

**价值**：不同定价模型在统一框架下共存。

### 场景 5：资源配额的全局限制

**背景**：平台管理员发现某个 Agent 在短时间内大量申请 GPU 资源，可能存在滥用。

**流程**：

1. Platform Admin 通过 `rp:quota_index` 查看该 Agent 的资源使用情况
2. 发现：24 小时内申请了 200 GPU-hours，远超正常水平
3. Admin 更新该 Agent 的配额限制（通过 Room Config Annotation）
4. 该 Agent 的下一次 rp:allocation.request Message 被 `rp:validate_request` Hook 拦截：配额已满
5. Agent 收到拒绝响应，可以申诉（向 Auditor 提交说明）

**价值**：平台级的资源管控能力，防止滥用。

### 场景 6：资源不足时的排队与优先级

**背景**：多个 Consumer 同时申请同一种稀缺资源。

**流程**：

1. Consumer A 申请 2×A100（priority=normal）
2. Consumer B 申请 2×A100（priority=high）
3. 当前可用 A100 只有 2 块
4. `rp:match_and_allocate` Hook 按 priority 排序：
   - Consumer B（high）获得分配
   - Consumer A（normal）写入 `rp:no_match` Annotation，附带原因"resource_contention"
5. Consumer A 可以选择：等待（重新提交）、降低需求、或接受更贵的替代资源

**价值**：优先级机制确保关键任务优先获得资源。

---

## 3. Part A: 协议层约定

```yaml
id: "respool"
namespace: "rp"
version: "0.9.3"
dependencies: ["channels", "reply-to", "command", "runtime"]
```

### 3.1 Content Types

#### rp:resource.register — 资源注册

```yaml
type: "rp:resource.register"
required_capability: "resource.register"
flow_subject: true
body_schema:
  resource_type:  string             # "compute", "human_labor", "channel", "storage", ...
  capacity:
    total:        number
    unit:         string             # "A100-hour", "person-hour", "post", "GB", ...
  pricing:
    model:        string             # "fixed", "per_unit", "tiered", "auction"
    params:       any
    currency:     string
  constraints:    [Constraint]
  availability:
    schedule:     string | null
    lead_time:    string | null
  metadata:
    description:  string
    tags:         [string]
```

#### rp:allocation.request — 资源申请

```yaml
type: "rp:allocation.request"
required_capability: "resource.request"
flow_subject: true
body_schema:
  resource_type:  string
  amount:         { value: number, unit: string }
  on_behalf_of:   Entity ID | null
  priority:       string             # "normal", "high", "critical"
  duration:       string | null
  budget:         { max: number | null, currency: string }
  preferences:    { provider: Entity ID | null, region: string | null, min_rating: number | null }
```

#### rp:allocation.matched — 分配成功

```yaml
type: "rp:allocation.matched"
required_capability: "_system"       # 系统自动发送
reply_to_type: "rp:allocation.request"
flow_trigger: "pending → active"
body_schema:
  resource_ref:   ref_id             # 关联的 resource.register Message
  provider:       Entity ID
  consumer:       Entity ID
  amount:         { value: number, unit: string }
  lease:          { start: RFC 3339, end: RFC 3339 | null }
  price:          { unit_price: number, estimated_total: number, currency: string }
```

#### rp:allocation.failed — 分配失败

```yaml
type: "rp:allocation.failed"
required_capability: "_system"
reply_to_type: "rp:allocation.request"
flow_trigger: "pending → failed"
body_schema:
  reason:         string             # "insufficient_capacity", "budget_exceeded", ...
  candidates:     number
```

#### rp:usage.report — 用量上报

```yaml
type: "rp:usage.report"
required_capability: "resource.use"
reply_to_type: "rp:allocation.request"
body_schema:
  used:           number
  unit:           string
  period:         { from: RFC 3339, to: RFC 3339 }
```

#### rp:allocation.release — 释放资源

```yaml
type: "rp:allocation.release"
required_capability: "resource.use"
reply_to_type: "rp:allocation.request"
flow_trigger: "active → released"
body_schema:
  final_usage:    number
  release_reason: string             # "completed", "cancelled", "timeout"
```

#### rp:invoice.issue — 结算账单

```yaml
type: "rp:invoice.issue"
required_capability: "_system"
reply_to_type: "rp:allocation.request"
flow_trigger: "released → settled"
body_schema:
  amount:         number
  currency:       string
  pricing_model:  string
  breakdown:      any
```

#### rp:resource.review — 资源评价

```yaml
type: "rp:resource.review"
required_capability: "resource.review"
reply_to_type: "rp:resource.register"
body_schema:
  rating:         number             # 0.0 - 5.0
  comment:        string | null
  allocation_ref: ref_id
```

#### rp:role.grant / rp:role.revoke — 角色管理

```yaml
type: "rp:role.grant"
required_capability: "role.manage"
body_schema: { entity: Entity ID, role: string }

type: "rp:role.revoke"
required_capability: "role.manage"
body_schema: { entity: Entity ID, role: string }
```

### 3.2 Hooks

#### pre_send: rp:check_role (priority 100)

- [MUST] 验证 sender 拥有 content_type action 对应的 capability。

#### pre_send: rp:validate_request (priority 101)

| trigger.filter | `content_type == 'rp:allocation.request'` |

- [MUST] 验证 requester 的活跃分配数量未超过全局配额限制（查询 State Cache）。
- [MUST] 验证 resource_type 在 State Cache 中存在至少一条可用资源。
- [MAY] 验证 budget 与当前市场价格的合理性。

#### after_write: rp:advance_state (priority 100)

| trigger.filter | `content_type startswith 'rp:'` |

- [MUST] 更新 State Cache：资源列表、分配状态、用量累计、容量追踪。

#### after_write: rp:match_and_allocate (priority 101)

| trigger.filter | `content_type == 'rp:allocation.request'` |

- [MUST] 从 State Cache 查询匹配资源。
- 匹配成功：发送 rp:allocation.matched Message。
- 匹配失败：发送 rp:allocation.failed Message。

#### after_write: rp:track_usage (priority 102)

| trigger.filter | `content_type == 'rp:usage.report'` |

- [MUST] 累计用量到 State Cache。
- [MUST] 如果累计用量 >= allocation amount，发送 rp:_system.exhausted Message。

#### after_write: rp:billing (priority 103)

| trigger.filter | `content_type == 'rp:allocation.release'` |

- [MUST] 根据 pricing model 和实际用量计算最终费用。
- [MUST] 发送 rp:invoice.issue Message。
- [MUST] 向 EventWeaver 发送 ew:event.record Message。

### 3.3 State Cache Schema

```python
class ResPoolState:
    resources: dict[str, dict]               # resource_ref_id → resource info + available capacity
    allocations: dict[str, dict]             # alloc_request_ref_id → allocation state
    usage_totals: dict[str, float]           # alloc_request_ref_id → cumulative usage
    quota_usage: dict[str, int]              # consumer_entity_id → active allocation count
    market_stats: dict[str, dict]            # resource_type → aggregate stats
    role_map: dict[tuple[str,str], set[str]]
```

### 3.4 Indexes

```python
@api("GET /rp/resources")
async def available_resources(resource_type=None, min_rating=None):
    """可用资源列表（从 State Cache 查询）"""

@api("GET /rp/allocations")
async def allocation_history(consumer=None, provider=None):
    """分配历史"""

@api("GET /rp/provider/dashboard")
async def provider_dashboard(provider_id):
    """Provider 仪表盘"""

@api("GET /rp/market/stats")
async def market_stats():
    """市场统计"""
```

---

## 4. Part B: Socialware 层声明

### 4.1 Roles

```yaml
roles:
  # ─── 施加于 Identity ───
  - id: rp:provider
    assignable_to: [Identity]
    capabilities: [resource.register, resource.update, resource.withdraw,
                   capacity.report, pricing.set]

  - id: rp:consumer
    assignable_to: [Identity]
    capabilities: [resource.discover, resource.request, resource.release,
                   usage.report, allocation.accept, allocation.reject]

  - id: rp:auditor
    assignable_to: [Identity]
    capabilities: [allocation.inspect, usage.audit, billing.verify,
                   quota.view, dispute.review]

  # ─── 施加于 Room ───
  - id: rp:registry
    assignable_to: [Room]
    capabilities: [resource.catalog, resource.match, resource.rank,
                   capacity.aggregate]
    description: "此 Room 具备资源目录、匹配和排序能力"

  - id: rp:settlement
    assignable_to: [Room]
    capabilities: [billing.compute, credit.transfer, receipt.issue]
    description: "此 Room 具备结算处理能力"

  # ─── 施加于 Message ───
  - id: rp:allocation_ticket
    assignable_to: [Message where content_type == rp:allocation.matched]
    capabilities: [binding.resource_lock, authority.consume]
    description: "此 Message 是资源分配凭证，持有即可消费"

  - id: rp:invoice_notice
    assignable_to: [Message where annotation(rp:invoice) exists]
    capabilities: [binding.payment_due, authority.debit]
    description: "此 Message 附带账单，具有扣费权威"

  # ─── 施加于 Timeline ───
  - id: rp:metering_window
    assignable_to: [Timeline segment per allocation lease period]
    capabilities: [usage.aggregate, quota.enforce]
    description: "此 Timeline 段是计量窗口，用于聚合用量报告"
```

### 4.2 Arenas

```yaml
arenas:
  # ─── 外部 ───
  - id: rp:resource_marketplace
    over: [Room with role(rp:registry)]
    boundary: external
    entry_policy: any_identity
    purpose: "资源发现、浏览、比价。任何 Identity 均可进入查看，
              但提交 request 需要 rp:consumer Role"

  # ─── 内部 ───
  - id: rp:allocation_desk
    over: [Room created per active rp:allocation.request that requires negotiation]
    boundary: internal
    entry_policy: role_required(rp:provider with matching resource | rp:consumer with active request)
    purpose: "资源分配的协商空间（适用于非自动匹配的场景，
              如大额资源或需要 Provider 确认的情况）"

  - id: rp:billing_office
    over: [Room with role(rp:settlement)]
    boundary: internal
    entry_policy: role_required(rp:auditor | rp:provider with active allocation | rp:consumer with active allocation)
    purpose: "计费、结算和审计。Provider 和 Consumer 可查看自己的账单，
              Auditor 可查看全部"
```

### 4.3 Commitments

```yaml
commitments:
  # ─── Provider ↔ Consumer ───
  - id: rp:allocation_guarantee
    between: [Identity with role(rp:provider), Identity with role(rp:consumer)]
    obligation: "已分配资源在 lease 期间内不被单方面回收。
                 Provider 如需提前回收，必须提前 notice_period 通知"
    triggered_by: "rp:allocation.matched Message 写入"
    expires: "lease.end reached OR rp:released annotation written"
    enforcement: "writer_rule 限制 Provider 不能删除 active allocation"

  - id: rp:fair_pricing
    between: [Identity with role(rp:provider), Identity with role(rp:consumer)]
    obligation: "分配期间内，价格按 allocation 创建时锁定的 unit_price 执行，
                 不因市场波动而变更"
    triggered_by: "rp:allocation.matched Message 写入"
    enforcement: "rp:billing hook 使用 allocation.price.unit_price 而非实时价格"

  # ─── Registry ↔ Consumer ───
  - id: rp:matching_sla
    between: [Room with role(rp:registry), Identity with role(rp:consumer)]
    obligation: "资源匹配请求在 5 分钟内给出响应
                 （matched 或 no_match），不静默丢弃"
    triggered_by: "rp:allocation.request Message 写入"
    enforcement: "rp:match_and_allocate hook 的超时机制"

  # ─── Consumer ↔ Settlement ───
  - id: rp:usage_honesty
    between: [Identity with role(rp:consumer), Room with role(rp:settlement)]
    obligation: "如实上报资源使用量。虚报将导致信誉降级和配额收紧"
    triggered_by: "per metering_window"
    enforcement: "rp:track_usage hook 可选交叉验证（Provider 也可上报用量）"

  # ─── Ticket 级 ───
  - id: rp:ticket_integrity
    between: [Message with role(rp:allocation_ticket),
              Identity with role(rp:provider),
              Identity with role(rp:consumer)]
    obligation: "此分配凭证代表双方的分配协议，不可篡改"
    triggered_by: "rp:allocation.matched Message 写入"
    enforcement: "CRDT writer_rule + Entity 签名验证"
```

### 4.4 Flows

```yaml
flows:
  - id: rp:resource_lifecycle
    subject_type: "rp:resource
    states: [registered, available, reserved, depleted, withdrawn]
    transitions:
      registered --[Provider confirms capacity]---------> available
      available  --[all capacity allocated]--------------> depleted
      available  --[Provider withdraws]-----------------> withdrawn
      depleted   --[allocation released, capacity > 0]--> available
      withdrawn  --[Provider re-registers]--------------> registered
    preferences:
      auto_replenish: preferred_when(provider.auto_renew == true)
      preemption: avoided_unless(priority == critical)

  - id: rp:request_lifecycle
    subject_type: "rp:request
    states: [submitted, matching, offered, accepted, active, completed, failed]
    transitions:
      submitted --[rp:match_and_allocate finds match]-------> offered
      submitted --[rp:no_match written]---------------------> failed
      offered   --[Consumer writes acceptance Annotation]---> accepted
      offered   --[Consumer rejects]------------------------> failed
      offered   --[auto_accept when budget OK]--------------> accepted
      accepted  --[rp:allocation.matched sent]-------------------> active
      active    --[rp:released written]---------------------> completed
      active    --[rp:exhausted written]--------------------> completed
      active    --[lease.end timeout]-----------------------> completed
      failed    --[Consumer resubmits with adjusted params]-> submitted
    preferences:
      best_fit_matching: preferred_over(first_fit)
      consumer_choice: preferred_when(multiple candidates AND high-value request)
      auto_accept: preferred_when(single candidate AND budget OK AND priority >= high)

  - id: rp:allocation_lifecycle
    subject_type: "rp:allocation
    states: [issued, active, usage_tracked, settling, settled, disputed]
    transitions:
      issued         --[Consumer begins use]--------------------> active
      active         --[rp:usage annotation updated]------------> usage_tracked
      usage_tracked  --[rp:released OR rp:exhausted written]----> settling
      settling       --[rp:invoice annotation written]----------> settled
      settled        --[either party disputes invoice]----------> disputed
      disputed       --[Auditor resolves]-----------------------> settled
    preferences:
      realtime_metering: preferred_when(resource_type ∈ [compute, api_quota])
      batch_metering: preferred_when(resource_type ∈ [human_labor, channel])
      auto_settle: preferred_when(no dispute within 24h of invoice)
```

---

## 5. 验证用例

### §5.1 资源注册与发现

#### TC-RP-001: Provider 注册资源

```
GIVEN  ResPool 已初始化
       E-gpu-farm 拥有 rp:provider Role

WHEN   E-gpu-farm 发送 rp:resource.register Message:
       { resource_type: "compute", capacity: { total: 8, unit: "A100-hour" },
         pricing: { model: "per_unit", params: { unit_price: 8 }, currency: "USDT" } }

THEN   rp:resource.register Message 写入成功
       await rp.resources.available(type="compute") 返回包含该资源
       rp:resource_lifecycle 状态 = registered
```

#### TC-RP-002: 资源发现与过滤

```
GIVEN  ResPool 包含 3 个 compute 资源:
       R1: 8×A100, $8/hr, rating=4.5
       R2: 4×A100, $6/hr, rating=3.2
       R3: 2×A100, $10/hr, rating=4.8

WHEN   Consumer 查询 await rp.resources.available(type="compute", min_rating=4.0)

THEN   返回 R1 和 R3（R2 rating 不足被过滤）
       结果按 pricing 和 rating 的综合排序呈现
```

### §5.2 申请与分配

#### TC-RP-010: 标准资源申请与自动匹配

```
GIVEN  ResPool 包含 R1: 8×A100 available
       E-agent 拥有 rp:consumer Role

WHEN   E-agent 发送 rp:allocation.request Message:
       { resource_type: "compute", amount: { value: 4, unit: "A100-hour" },
         priority: "normal", duration: "2h", budget: { max: 64, currency: "USDT" } }

THEN   rp:validate_request hook 通过（配额未超限）
       rp:match_and_allocate hook 匹配 R1
       rp:allocation.matched Message 发送：provider=E-gpu-farm, consumer=E-agent,
                          amount=4, unit_price=8, estimated_total=64
       rp:capacity_sync hook 更新 R1: available=4（从 8 扣减为 4）
       Engine Event rp.request.matched 发出
```

#### TC-RP-011: 配额超限拒绝

```
GIVEN  E-agent 当前有 10 个 active allocations
       全局配额限制 max_active_allocations = 10

WHEN   E-agent 发送 rp:allocation.request Message

THEN   rp:validate_request hook 检测配额已满 → 拒绝写入
       返回错误: "quota_exceeded: max_active_allocations=10, current=10"
```

#### TC-RP-012: 资源不足匹配失败

```
GIVEN  ResPool 中 compute 类型总可用量 = 2×A100

WHEN   E-agent 发送 rp:allocation.request Message:
       { resource_type: "compute", amount: { value: 4, unit: "A100-hour" } }

THEN   rp:match_and_allocate hook 匹配失败
       rp:no_match Annotation 写入 request 上:
       { reason: "insufficient_capacity", candidates: 1 }
       Engine Event rp.request.failed 发出
       rp:request_lifecycle 状态 → failed
```

#### TC-RP-013: 预算超限匹配失败

```
GIVEN  ResPool 包含 R1: 4×A100, $8/hr

WHEN   E-agent 发送 rp:allocation.request Message:
       { amount: { value: 4, unit: "A100-hour" }, duration: "2h",
         budget: { max: 30, currency: "USDT" } }
       # 实际需要 4×$8×2h = $64 > $30

THEN   rp:match_and_allocate 计算价格超预算 → 匹配失败
       rp:no_match Annotation: { reason: "budget_exceeded" }
```

### §5.3 使用与计量

#### TC-RP-020: 使用量上报与累计

```
GIVEN  rp:allocation.matched ALLOC-001: amount=4 A100-hours

WHEN   E-agent 发送 rp:usage.report Message:
       { used: 1.5, unit: "A100-hour", period: { from: T1, to: T2 } }
       再写入:
       { used: 1.0, unit: "A100-hour", period: { from: T2, to: T3 } }

THEN   rp:track_usage hook 累计: 1.5 + 1.0 = 2.5
       2.5 < 4.0 → 未耗尽，继续
```

#### TC-RP-021: 资源耗尽

```
GIVEN  ALLOC-001: amount=4, 累计 usage=3.5

WHEN   E-agent 写入 rp:usage: { used: 1.0 }
       累计 = 4.5 >= 4.0

THEN   rp:track_usage hook 写入 rp:exhausted Annotation
       rp:billing hook 触发结算
       rp:allocation_lifecycle 状态 → settling
```

#### TC-RP-022: 正常释放与结算

```
GIVEN  ALLOC-001: active, 累计 usage=3.0, unit_price=8

WHEN   E-agent 发送 rp:allocation.release Message:
       { final_usage: 3.0, release_reason: "completed" }

THEN   rp:billing hook 触发:
       计算 3.0 × $8 = $24
       写入 rp:invoice Annotation: { amount: 24, currency: "USDT",
                                     breakdown: { hours: 3.0, rate: 8 } }
       rp:capacity_sync 恢复 resource 的可用量 += (4.0 - 3.0)
       EventWeaver 收到 ew_event { event_type: "resource_settled" }
       rp:allocation_lifecycle 状态 → settled
```

### §5.4 跨 Socialware 协作

#### TC-RP-030: TaskArena 请求奖励发放

```
GIVEN  TaskArena 的 ta:settle_reward hook 触发
       Task 奖励 = 50 USDT
       Publisher 预存余额 = 200 USDT (as rp:resource.register type=token)

WHEN   TaskArena Identity 向 Platform Bus 发送消息
       ResPool 收到并发送 rp:allocation.request Message:
       { resource_type: "token", amount: { value: 50, unit: "USDT" },
         on_behalf_of: Publisher Entity ID }

THEN   rp:match_and_allocate 匹配 Publisher 的余额资源
       rp:allocation.matched Message 发送: consumer=Worker, amount=50
       Worker 写入 rp:released（确认收到）
       rp:invoice 记录完整结算
       Publisher 余额: 200 - 50 = 150
```

### §5.5 HiTL 场景

#### TC-RP-040: Human 劳动力资源的分配需要人工确认

```
GIVEN  Provider 注册 human_labor 资源:
       { resource_type: "human_labor", capacity: { total: 8, unit: "person-hour" },
         constraints: [{ type: "manual_confirm", value: true }] }

WHEN   Consumer 发送 rp:allocation.request Message for human_labor

THEN   rp:match_and_allocate 匹配成功
       但因 constraint "manual_confirm" = true
       → 不自动创建 allocation
       → 写入 rp:pending_confirm Annotation 到 request 上
       → Provider (Human) 进入 rp:allocation_desk Arena 查看并确认
       → Provider 确认后 → rp:allocation.matched Message 发送
       → rp:request_lifecycle: offered → accepted → active
```

---

## 6. 依赖关系

```
ResPool 依赖:
  ezagent.bus built-in: Identity, Room, Timeline, Message
  EventWeaver: 结算事件记录

ResPool 被依赖:
  TaskArena     → 任务奖励发放
  任何 Socialware → 资源申请和使用
```

---

## 7. 概念溯源表

| 领域概念 | Bus 层实现 | Socialware 层维度 |
|---------|-----------|------------------|
| Resource | Message(datatype=rp_resource) | Flow(rp:resource_lifecycle) |
| Request | Message(datatype=rp_request) | Flow(rp:request_lifecycle) |
| Allocation | Message(datatype=rp_allocation) | Role(rp:allocation_ticket), Flow(rp:allocation_lifecycle) |
| Usage Report | Annotation(rp:usage) on allocation | — (纯元数据) |
| Invoice | Annotation(rp:invoice) on allocation | Role(rp:invoice_notice) |
| Capacity | Annotation(rp:capacity_update) on resource | — (纯元数据) |
| Marketplace | Room with role(rp:registry) | Arena(rp:resource_marketplace) |
| Billing | Room with role(rp:settlement) | Arena(rp:billing_office) |
| Quota | Index(rp:quota_index) internal | — (纯查询能力) |
| Metering Window | Timeline segment per lease period | Role(rp:metering_window) |

---

## 8. UI Manifest (Part C)

> 参见 socialware-spec §2 Part C 和 chat-ui-spec。

### 8.1 Message Templates

```yaml
message_templates:
  - datatype: rp_resource
    renderer:
      type: structured_card
      field_mapping:
        header: "resource_type (provider_name)"
        metadata:
          - { field: "capacity", format: "{available}/{total} {unit}", icon: "database" }
          - { field: "pricing", format: "{price}/{unit}", icon: "coin" }
          - { field: "constraints", format: "tag_list", icon: "filter" }
        badge: { field: "lifecycle_state", source: "flow:rp:resource_lifecycle" }

  - datatype: rp_request
    renderer:
      type: structured_card
      field_mapping:
        header: "Request: {resource_type}"
        metadata:
          - { field: "amount", format: "{value} {unit}", icon: "package" }
          - { field: "budget", format: "max {max} {currency}", icon: "coin" }
          - { field: "requester", format: "entity_name", icon: "user" }
        badge: { field: "request_state", source: "flow:rp:request_lifecycle" }

  - datatype: rp_allocation
    renderer:
      type: structured_card
      field_mapping:
        header: "Allocation: {resource_type}"
        metadata:
          - { field: "amount", format: "{value} {unit}", icon: "package" }
          - { field: "consumer", format: "entity_name", icon: "user" }
          - { field: "expires_at", format: "relative_time", icon: "clock" }
        badge: { field: "allocation_state", source: "flow:rp:allocation_lifecycle" }
```

### 8.2 Views

```yaml
views:
  - id: "sw:rp:marketplace"
    index: "rp:available_index"
    renderer:
      as_room_tab: true
      tab_label: "Resources"
      tab_icon: "database"
      layout: table
      layout_config:
        columns:
          - { field: "resource_type", label: "Type" }
          - { field: "provider", label: "Provider" }
          - { field: "capacity", label: "Available" }
          - { field: "pricing", label: "Price" }
          - { field: "state", label: "Status" }
        sortable: true
        filterable: [resource_type, state]

  - id: "sw:rp:billing_view"
    index: "rp:billing_index"
    renderer:
      as_room_tab: true
      tab_label: "Billing"
      tab_icon: "receipt"
      layout: table
      layout_config:
        columns:
          - { field: "allocation_id", label: "Allocation" }
          - { field: "consumer", label: "Consumer" }
          - { field: "amount", label: "Usage" }
          - { field: "total_cost", label: "Cost" }
          - { field: "status", label: "Status" }
```

### 8.3 Flow Renderers

```yaml
flow_renderers:
  - flow: rp:resource_lifecycle
    badge:
      registered: { color: "gray", label: "Registered" }
      available: { color: "green", label: "Available" }
      depleted: { color: "orange", label: "Depleted" }
      withdrawn: { color: "slate", label: "Withdrawn" }
    actions:
      - transition: "registered → available"
        label: "Activate"
        style: primary
        visible_to: "role:rp:provider"
      - transition: "available → withdrawn"
        label: "Withdraw"
        style: danger
        visible_to: "role:rp:provider"
        confirm: true

  - flow: rp:request_lifecycle
    badge:
      submitted: { color: "blue", label: "Submitted" }
      matching: { color: "yellow", label: "Matching" }
      offered: { color: "purple", label: "Offered" }
      accepted: { color: "green", label: "Accepted" }
      active: { color: "emerald", label: "Active" }
      completed: { color: "gray", label: "Completed" }
      failed: { color: "red", label: "Failed" }
    actions:
      - transition: "offered → accepted"
        label: "Accept Offer"
        style: primary
        visible_to: "role:rp:consumer"
      - transition: "active → completed"
        label: "Release"
        style: secondary
        visible_to: "role:rp:consumer"
        confirm: true
```

### 8.4 推荐 Override Level

| 组件 | Level | 理由 |
|------|-------|------|
| rp_resource card | Level 1 | 字段映射声明式足够 |
| rp_request card | Level 1 | 同上 |
| rp_allocation card | Level 1 | 同上 |
| Resource marketplace table | Level 1 | table layout 足够 |
| Billing table | Level 1 | 同上 |
| Flow actions | Level 1 | 按钮声明式足够 |

---

## 9. 安装与配置

### 9.1 目录结构

```
ezagent/socialware/res-pool/
├── manifest.toml
└── config/
    ├── pool-definitions.toml         # 资源池定义
    └── quota-policies.toml           # 配额策略
```

### 9.2 manifest.toml

```toml
[socialware]
id = "res-pool"
name = "ResPool"
version = "0.9.1"

[declaration]
datatypes = ["rp_pool", "rp_quota", "rp_allocation", "rp_settlement"]
hooks = ["rp.allocate", "rp.release", "rp.settle", "rp.quota_check", "rp.expiry_monitor"]
roles = ["rp:pool_admin", "rp:allocator", "rp:consumer"]
annotations = ["rp:pool_meta", "rp:quota_meta", "rp:allocation_meta"]
indexes = ["pool_dashboard", "my_allocations", "settlement_history", "quota_usage"]

[commands]
allocate = { params = ["pool_id", "amount", "purpose?"], role = "rp:allocator" }
release = { params = ["allocation_id"], role = "rp:consumer" }
check-quota = { params = ["pool_id?", "entity_id?"], role = "rp:consumer" }
create-pool = { params = ["name", "resource_type", "capacity"], role = "rp:pool_admin" }
set-quota = { params = ["pool_id", "entity_id", "max_amount"], role = "rp:pool_admin" }
settle = { params = ["allocation_id", "actual_usage"], role = "rp:allocator" }

[dependencies]
extensions = ["EXT-06", "EXT-15"]
socialware = ["event-weaver"]
```

---

## 10. EXT-15 Commands

ResPool 注册以下命令（命名空间 `rp`）：

| 命令 | 参数 | 所需 Role | 说明 |
|------|------|----------|------|
| `/rp:allocate` | `--pool-id`, `--amount`, `--purpose?` | `rp:allocator` | 从资源池分配资源 |
| `/rp:release` | `--allocation-id` | `rp:consumer` | 释放已分配的资源 |
| `/rp:check-quota` | `--pool-id?`, `--entity-id?` | `rp:consumer` | 查询配额使用情况 |
| `/rp:create-pool` | `--name`, `--resource-type`, `--capacity` | `rp:pool_admin` | 创建新资源池 |
| `/rp:set-quota` | `--pool-id`, `--entity-id`, `--max-amount` | `rp:pool_admin` | 设置配额上限 |
| `/rp:settle` | `--allocation-id`, `--actual-usage` | `rp:allocator` | 结算实际资源消耗 |

命令处理示例：

```python
@socialware("res-pool")
class ResPool:
    @hook(phase="after_write", trigger="timeline_index.insert",
          filter="ext.command.ns == 'rp'", priority=110)
    async def on_command(self, event, ctx):
        cmd = event.ref.ext.command
        if cmd.action == "allocate":
            pool = self.state.resources.get(cmd.params["pool_id"])
            amount = float(cmd.params["amount"])
            # 检查配额
            quota = await self.check_entity_quota(
                pool_id=cmd.params["pool_id"],
                entity_id=event.ref.author
            )
            if quota.remaining < amount:
                await ctx.command.result(cmd.invoke_id, status="error",
                    error=f"Quota exceeded: remaining={quota.remaining}, requested={amount}")
                return
            # 执行分配
            allocation = await self.do_allocate(
                pool_id=cmd.params["pool_id"],
                amount=amount,
                consumer=event.ref.author,
                purpose=cmd.params.get("purpose", "")
            )
            await ctx.command.result(cmd.invoke_id, status="success",
                result={"allocation_id": allocation.id, "amount": amount})
```

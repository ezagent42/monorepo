# TaskArena PRD 改进计划

> **日期**: 2026-03-04（创建）→ 2026-03-05（重写）
> **状态**: Phase 2 — 修复 P0 阻塞问题
> **角色分工**: Arina（产品经理，决策者）+ Claude（技术分析，执行者）
> **目标**: 把 TaskArena PRD 改进到"开发者完全依赖文档即可实现"的程度
> **质量工具**: `taskarena-pm` skill（`/ta-pm review|journey|verify|status`）

---

## 项目目标

> **验收标准**：一个开发者拿到改进后的 PRD + User Journey 文档，
> **不需要来问产品经理任何问题**，就能完整实现 TaskArena。

这意味着文档必须覆盖：
1. 每个角色的完整体验旅程（不只是功能描述）
2. 每个边界条件的明确处理方式
3. 每个跨 Socialware 交互的完整协议
4. 每个 UI 状态的精确定义
5. 每个错误情况的处理策略

### 未来方向（本轮暂不纳入）

以下方向在 TaskArena PRD 成熟后再考虑加入：
- **OSS 特化**：GitHub/GitLab 集成、PR 关联、开源许可处理
- **Repo as Code**：TaskArena 作为自包含能力单元的目录结构

---

## 工作文件

| 文件 | 用途 | 状态 |
|------|------|------|
| `docs/socialware/taskarena-prd.md` | 主 PRD（1315 行） | 待改进 |
| `docs/socialware/taskarena-journeys.md` | 各角色 User Journey | 待创建 |
| `docs/plans/2026-03-04-socialware-user-journey-design.md` | 本文件（计划与进度跟踪） | 活跃 |
| `.claude/skills/taskarena-pm/SKILL.md` | PM 质量保证工具 | ✅ 已创建 |
| `docs/specs/socialware-spec.md` | 四原语 source of truth | 参考 |
| `docs/specs/bus-spec.md` | Hook pipeline source of truth | 参考 |

---

## 进度总览

| # | 阶段 | 状态 | 使用命令 | 产出 |
|---|------|------|---------|------|
| 1 | PRD 审计 | ✅ 完成 | — | 30 个问题（6 P0 + 10 P1 + 14 P2） |
| 2 | 修复 P0 阻塞问题 | ✅ 完成 | `/ta-pm review` | 6/6 P0 全部修复 |
| 3 | 修复 P1 歧义问题 | ✅ 完成 | `/ta-pm review` | 10/10 P1 全部修复 |
| 4 | User Journey 设计 | `🔵 下一步` | `/ta-pm journey <role>` | 5 个角色 Journey 草稿 |
| 5 | 补充 P2 体验缺失 | `⚪ 未开始` | `/ta-pm review` | P2-1 ~ P2-14 + Journey 中发现的新问题 |
| 6 | Journey 文档撰写 | `⚪ 未开始` | — | 创建 `taskarena-journeys.md` |
| 7 | 开发者可实现性验证 | `⚪ 未开始` | `/ta-pm verify` | 验证报告 + 最终修复 |

### 工作节奏

```
Phase 2-3: 逐个修复 P0/P1 → Arina 确认每项改动
Phase 4:   Arina 为每个角色讲述 Journey → Claude 补充协议细节
Phase 5:   基于 Journey 发现 + P2 列表 → 补全体验缺失
Phase 6:   Claude 将 Journey 写成正式文档 → Arina 审阅
Phase 7:   /ta-pm verify 跑完整清单 → 共同确认通过
```

---

## Phase 1: PRD 审计（已完成）

> 审计日期：2026-03-05
> 方法：逐章审读 `taskarena-prd.md`（1315 行），从"开发者能否直接实现"角度评估

### 1.1 逐章评估

| 章节 | 行数 | 完整度 | 开发者可实现性 |
|------|------|--------|---------------|
| §1 产品概述 | 1-48 | 🟢 好 | 定位清晰，但缺 onboarding 流程 |
| §2 使用场景 | 49-250 | 🟡 中 | 7 个场景都是系统视角，缺角色情感旅程和失败路径 |
| §3 Part A 协议层 | 251-544 | 🟡 中 | content_type 定义好，但有多处不一致和缺失 |
| §4 Part B 四原语 | 545-796 | 🟡 中 | 结构完整，但 Flow 状态命名不一致、preference 语法非正式 |
| §5 验证用例 | 797-1007 | 🟡 中 | 正向路径覆盖好，缺异常/边界用例 |
| §6 依赖关系 | 1008-1020 | 🔴 不足 | 仅 10 行，缺与 EW/RP 交互的消息格式 |
| §7 概念溯源表 | 1021-1042 | 🟢 好 | 映射清晰，缺 Notification 和 Skills 概念 |
| §8 UI Manifest | 1043-1199 | 🟡 中 | 渲染配置详细，但有幽灵状态、缺空态/错误态 |
| §9 安装与配置 | 1200-1256 | 🔴 不足 | 目录结构不完整，角色名不一致 |
| §10 EXT-15 Commands | 1257-1315 | 🟡 中 | 命令表清晰，但代码示例 Flow 不完整 |

### 1.2 问题清单

#### 🔴 P0 — 阻塞性问题（开发者无法实现）

| # | 问题 | 位置 | 状态 |
|---|------|------|------|
| P0-1 | Flow 状态命名不一致（`in_review`/`under_review`/`in_progress` 混用） | §4.4 vs §8.3 vs §5 | ✅ 14处统一 |
| P0-2 | Annotation vs Message 机制不一致（场景写 Annotation，定义用 Message） | §2 vs §3 | ✅ 3处统一 |
| P0-3 | 缺失 content_type: `ta:task.amend`（Commitment 引用但未定义） | §4.3 | ✅ 新增 amend/accept/reject |
| P0-4 | 缺失系统 content_type（`ta:_system.*` 无 body_schema） | §3.2 | ✅ 新增 2 个系统 content_type |
| P0-5 | Reviewer 选择算法未定义（按技能？随机？按信誉？） | §3.2 | ✅ 双模式 manual/auto + ReviewerProfile |
| P0-6 | `ta:check_business_rules` 过滤器范围错误（filter 只匹配 claim，但要验证 verdict） | §3.2 L445 | ✅ 扩展 filter + 分支验证 |

#### 🟡 P1 — 歧义性问题（开发者需要猜测）

| # | 问题 | 位置 | 状态 |
|---|------|------|------|
| P1-1 | Flow preference 语法非正式（threshold 是什么值？） | §4.4 | ✅ 结构化 id+strategy+guard |
| P1-2 | 信誉评估触发时机未定义 | §4.4 | ✅ 明确 Hook 触发点 + guard 条件 |
| P1-3 | `description: any` 太模糊（什么格式？最大长度？） | §3.1 L276 | ✅ string, Markdown, max 10000 |
| P1-4 | `ResourceNeedTemplate` 未定义 | §3.1 L280 | ✅ 定义 ResourceNeed schema |
| P1-5 | `ContentRef` 类型未定义 | §3.1 L293 | ✅ 统一为 ref_id + 引用说明 |
| P1-6 | Arena Room 创建时机不明确（谁触发？哪个 Hook？） | §4.2 | ✅ 增加 created_by 字段 |
| P1-7 | API 端点缺 request/response schema | §3.4 | ✅ 5 个端点完整 schema |
| P1-8 | Commitment 超时无机制（72h 争议期无定时器） | §4.3 | ✅ State Cache deadline + Hook 检查 |
| P1-9 | config 文件无 schema（`.toml` 文件内容未定义） | §9.1 | ✅ 两个 toml 完整定义 |
| P1-10 | manifest.toml 角色名不一致（`ta:arbiter` vs `ta:arbitrator`） | §9.2 vs §4.1 | ✅ 4处统一为 ta:arbitrator |

#### 🟢 P2 — 体验缺失（功能可实现但体验不完整）

| # | 问题 | 位置 | 状态 |
|---|------|------|------|
| P2-1 | 无通知机制 | 全文 | ⚪ |
| P2-2 | 无 onboarding 流程（Role 获取方式未定义） | §1 | ⚪ |
| P2-3 | 无错误码 | 全文 | ⚪ |
| P2-4 | 缺失 Flow transition（claimed→cancelled, in_review→cancelled） | §4.4 | ⚪ |
| P2-5 | 缺失 content_type: `ta:task.abandon`（Worker 放弃任务） | §3.1 | ⚪ |
| P2-6 | 无失败场景（无人认领、deadline 过期、ResPool 不可用） | §2 | ⚪ |
| P2-7 | competitive 任务 Flow 不完整（多人 submit，winner 选择未定义） | §4.4 | ⚪ |
| P2-8 | collaborative subtask 模型未定义 | §2 场景4 | ⚪ |
| P2-9 | UI 空态/错误态缺失 | §8 | ⚪ |
| P2-10 | UI 幽灵状态（Flow Renderer 引用不存在的状态） | §8.3 | ⚪ |
| P2-11 | 跨 SW 消息格式缺失 | §6 | ⚪ |
| P2-12 | Worker Skills 存储 schema 未定义 | §3.2 | ⚪ |
| P2-13 | Publisher 视角体验缺失（无进度追踪/统计场景） | §2 | ⚪ |
| P2-14 | 无查询类 Command（只有写操作，无读操作） | §10 | ⚪ |

### 1.3 按角色审计

#### Publisher（发布悬赏者）

| 体验环节 | PRD 覆盖 | 缺什么 |
|---------|---------|--------|
| 发现 TaskArena 并决定使用 | ❌ | 无 onboarding（P2-2） |
| 获得 ta:publisher Role | ❌ | 谁授予？自动还是手动？ |
| 创建第一个任务 | ✅ | — |
| 设定 review_config | 🟡 | body_schema 有字段但无使用指南 |
| 等待认领 → 看到有人认领 | ❌ | 无通知（P2-1），无 dashboard |
| 认领后想修改任务要求 | ❌ | ta:task.amend 未定义（P0-3） |
| 认领后想取消 | ❌ | 缺 transition（P2-4） |
| 收到提交物 | 🟡 | 无 Publisher 查看提交物的 UI |
| 追踪评审进度 | ❌ | 无 Publisher 视角评审追踪 |
| 收到结算确认 | 🟡 | TC-TA-040 有但不详细 |
| 查看历史任务和统计 | ❌ | 无此场景和 API |

#### Worker（任务执行者）

| 体验环节 | PRD 覆盖 | 缺什么 |
|---------|---------|--------|
| 注册 Skills | ❌ | ta:skills schema 未定义（P2-12） |
| 浏览和发现任务 | ✅ | — |
| 评估任务适合性 | 🟡 | 缺"预估工作量"等信息 |
| 认领任务 | ✅ | — |
| 执行中沟通 | 🟡 | 沟通 content_type 不明确 |
| 执行中放弃任务 | ❌ | 无 ta:task.abandon（P2-5） |
| 提交成果 | ✅ | — |
| 收到评审反馈 | 🟡 | 无通知机制 |
| 被拒 → 修改重提 | ✅ | — |
| 被拒 → 争议 | ✅ | — |
| 信誉查看 | 🟡 | Worker 看信誉的 UI 无定义 |

#### Reviewer（评审者）

| 体验环节 | PRD 覆盖 | 缺什么 |
|---------|---------|--------|
| 被选为 Reviewer | ❌ | **P0-5**：选择算法空白 |
| 收到评审任务通知 | ❌ | 无通知（P2-1） |
| 进入评审环境 | ✅ | — |
| 获取评审标准 | 🟡 | Reviewer 怎么看到原始 task_spec？ |
| 提交评审结果 | ✅ | — |
| 评审被争议时 | 🟡 | Reviewer 信誉影响不详细 |
| Reviewer 自身信誉 | ❌ | 无 Reviewer 信誉 Flow |

#### Arbitrator（仲裁者）

| 体验环节 | PRD 覆盖 | 缺什么 |
|---------|---------|--------|
| 被召唤方式 | 🟡 | 触发 Hook 不明确 |
| 获取争议上下文 | ✅ | — |
| Agent 先行仲裁 | ✅ | — |
| Human 接手仲裁 | ✅ | — |
| 裁决后的影响 | 🟡 | 信誉变化不够精确 |

#### Observer（观察者）

| 体验环节 | PRD 覆盖 | 缺什么 |
|---------|---------|--------|
| 浏览公开任务 | ✅ | — |
| 查看信誉排行 | ✅ | — |
| 从 Observer → Worker | ❌ | 如何获取 ta:worker Role？ |

---

## Phase 2: 修复 P0 阻塞问题（当前）

> 使用 `/ta-pm review` 逐个修复 6 个 P0 问题
> 每个 P0 修复后需要 Arina 确认

### 修复计划

| 顺序 | 问题 | 修复方案 | 影响范围 | Arina 确认 |
|------|------|---------|---------|-----------|
| 1 | P0-1 状态命名不一致 | 统一所有 Flow 状态名，同步修改 §4.4/§8.3/§5/§2 | 全文 | ⚪ |
| 2 | P0-2 Annotation vs Message | 统一为 Message 机制（与 §3 content_type 对齐）| §2 | ⚪ |
| 3 | P0-3 缺 ta:task.amend | 在 §3.1 新增 content_type 定义 | §3.1 + §4.3 | ⚪ |
| 4 | P0-4 缺系统 content_type | 在 §3.1 新增 `ta:_system.*` 的 body_schema | §3.1 + §3.2 | ⚪ |
| 5 | P0-5 Reviewer 选择算法 | 定义选择逻辑（Arina 需做产品决策） | §3.2 新增 | ⚪ |
| 6 | P0-6 Hook filter 范围错误 | 修正 filter 或拆分为多个 Hook | §3.2 L445 | ⚪ |

---

## Phase 3: 修复 P1 歧义问题

> 使用 `/ta-pm review` 逐个修复 10 个 P1 问题

### 修复计划

| 顺序 | 问题 | 修复方向 | Arina 确认 |
|------|------|---------|-----------|
| 1 | P1-1 Flow preference 语法 | 定义正式 DSL 或替换为配置 | ⚪ |
| 2 | P1-2 信誉评估触发 | 补充 Hook 定义 | ⚪ |
| 3 | P1-3 description: any | 指定格式（Markdown）、约束（max_length） | ⚪ |
| 4 | P1-4 ResourceNeedTemplate | 补充完整 schema | ⚪ |
| 5 | P1-5 ContentRef | 明确引用出处或在 PRD 内定义 | ⚪ |
| 6 | P1-6 Arena Room 创建时机 | 指定触发 Hook | ⚪ |
| 7 | P1-7 API 端点缺 schema | 补充 request/response/error schema | ⚪ |
| 8 | P1-8 Commitment 超时机制 | 定义定时器/cron 机制 | ⚪ |
| 9 | P1-9 config 文件 schema | 补充 .toml 文件 schema | ⚪ |
| 10 | P1-10 角色名不一致 | 统一为 `ta:arbitrator`（与 §4 对齐） | ⚪ |

---

## Phase 4: User Journey 设计

> 使用 `/ta-pm journey <role>` 为每个角色设计完整 Journey
> Arina 讲述故事线 → Claude 补充协议映射 → 共同确认

### Journey 设计状态

| 角色 | 关键体验 | 状态 |
|------|---------|------|
| Publisher | 从发布悬赏到收获价值 | ⚪ |
| Worker | 从发现任务到积累信誉 | ⚪ |
| Reviewer | 从接受评审到建立权威 | ⚪ |
| Arbitrator | 从介入争议到维护公正 | ⚪ |
| Observer | 从旁观到参与 | ⚪ |

### Journey 格式

每个 Journey Step：
```
触发 → 用户行为 → 系统响应 → 用户感受 → 失败路径
                                        ↓
                              协议映射（content_type / Hook / Flow / Arena）
```

---

## Phase 5: 补充 P2 体验缺失

> 使用 `/ta-pm review` 修复 14 个 P2 + Journey 中发现的新问题
> P2 修复与 Journey 设计高度相关，Phase 4 中可能会提前解决部分 P2

### 预期会在 Phase 4 提前解决的 P2

| P2 问题 | 可能在哪个 Journey 中解决 |
|---------|-------------------------|
| P2-1 通知机制 | 所有 Journey 都会涉及 |
| P2-2 onboarding | Publisher/Worker/Observer Journey |
| P2-5 Worker 放弃 | Worker Journey |
| P2-6 失败场景 | 所有 Journey 的失败路径 |
| P2-13 Publisher 视角 | Publisher Journey |

---

## Phase 6: Journey 文档撰写

> 基于 Phase 4 的设计，产出 `docs/socialware/taskarena-journeys.md`

### 预期文档结构

```markdown
# TaskArena User Journeys

## Publisher Journey: 从发布悬赏到收获价值
## Worker Journey: 从发现任务到积累信誉
## Reviewer Journey: 从接受评审到建立权威
## Arbitrator Journey: 从介入争议到维护公正
## Observer Journey: 从旁观到参与
## Cross-Role Journey: 一个任务中多角色如何协同
```

---

## Phase 7: 开发者可实现性验证

> 使用 `/ta-pm verify` 跑完整检查清单

### 验证清单

- [ ] 每个 content_type 的 body_schema 完整且无歧义
- [ ] 每个 Hook 的触发条件和行为精确描述
- [ ] 每个 Flow transition 的边界条件明确
- [ ] 每个 Arena 的 entry_policy 可直接编码
- [ ] 每个 Commitment 的 enforcement 有对应 Hook
- [ ] 每个错误码和错误处理路径覆盖
- [ ] UI Manifest 的每个 renderer 有足够信息实现
- [ ] 跨 Socialware 交互（EventWeaver/ResPool）消息格式完整
- [ ] 5 个角色 Journey 无歧义
- [ ] 所有名称跨章节一致

---

## 协作方式

```
Arina（产品经理）                Claude + taskarena-pm skill
─────────────────────────────────────────────────────────
做产品决策                       /ta-pm review → 审查章节质量
定义用户体验                     /ta-pm journey → 引导 Journey 设计
审阅每项改动                     /ta-pm verify → 验证可实现性
最终验收                         /ta-pm status → 报告进度
```

### 每个改动的流程

```
1. Claude 提出修复方案（附修改前后对比）
2. Arina 确认或修改方案
3. Claude 执行修改
4. Claude 更新本文件（标记状态为 ✅）
```

---

## 讨论日志

### 2026-03-04 — 首次讨论

- 确认任务目标：设计新的 Socialware PRD + User Journey
- 阅读全部 5 个 Socialware PRD + EEP-0000 格式规范
- 提出 4 个候选方向（A/B/C/D）

### 2026-03-05 — 方向确定

- 方向选定：B — 开源社区协作
- 主角选定：Publisher
- 产出形式："repo as code"

### 2026-03-05 — 方向重定义

**关键转折**：
Arina 深入了解 TaskArena PRD 后决定：**不做新 BountyHub，改进现有 TaskArena**。

理由：协议层 ~80% 完整，缺的是角色视角体验设计和开发者可用性。

### 2026-03-05 — PRD 审计完成

完成 1315 行 PRD 逐章审读，发现 30 个问题（6 P0 + 10 P1 + 14 P2）。
三大核心缺陷：内部不一致、关键机制空白、角色体验不完整。

### 2026-03-05 — 创建 taskarena-pm skill

为保证跨会话的质量一致性，创建了 `taskarena-pm` skill：
- `/ta-pm review` — 按章节检查清单审查 PRD
- `/ta-pm journey` — 引导 User Journey 设计
- `/ta-pm verify` — 开发者可实现性验证
- `/ta-pm status` — 进度报告

工具编码了 P0/P1/P2 分级框架、命名一致性规则、Journey 模板、验证清单。

**下一步**: 开始 Phase 2，逐个修复 P0 阻塞问题。

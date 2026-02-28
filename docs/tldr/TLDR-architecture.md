# ezagent Architecture & Protocol

> 面向系统架构师、Rust 开发者、协议研究者。

---

## 三层分形架构

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

- **Bottom → Mid-layer：组合**。每个 Mid-layer 实体 = DataType + Hook + Annotation + Index 的特定组合
- **Mid-layer → Socialware：施加**。四原语作为正交维度施加于任何 Mid-layer 实体
- **分形**：Socialware 自身拥有 Identity，因此可递归被上层 Socialware 组合

**零浮空概念原则**：Socialware 不创造新的 Datatype。所有领域概念（task、event、session、resource）都是具有特定 `content_type` 的 Message。

## 类型级层级约束

v0.9.5 的核心架构决策：通过 Python 类型系统强制开发者不可越过层级边界。

```
                        SocialwareContext              EngineContext
                        (默认模式)                      (unsafe=True)
───────────────────────────────────────────────────────────────────
Socialware 层           ✅ ctx.send(action, body)      ✅
                        ✅ ctx.state (read-only)
                        ✅ ctx.grant_role / revoke_role
───────────────────────────────────────────────────────────────────
Mid-layer               ✅ ctx.room / ctx.members      ✅
                        (只读查询)
───────────────────────────────────────────────────────────────────
Extension 层            ❌ 不可访问                     ✅ ctx.runtime.*
───────────────────────────────────────────────────────────────────
Bottom 层               ❌ 不可访问                     ✅ ctx.messages.*
                                                       ✅ ctx.hook.*
                                                       ✅ ctx.annotations.*
```

类似 Rust 的 safe/unsafe 模型：默认受限，`unsafe` 需显式声明且在 `manifest.toml` 中标注。

## Runtime 自动生成 Hook Pipeline

一个 `@when("task.claim")` handler 在 Runtime 中展开为：

```
pre_send:
  [p45]  EXT-17  namespace_check         → "ta" ∈ enabled?
  [p46]  EXT-17  local_sw_check          → TaskArena installed?
  [p100] AUTO    Role capability check    → author has task.claim?
  [p101] AUTO    Flow transition check    → current_state + task.claim valid?
  ──── Message 写入 CRDT ────
after_write:
  [p50]  EXT-17  sw_message_index        → update Index
  [p100] AUTO    State Cache update      → update flow_states
  [p105] AUTO    Command dispatch        → route to @when handler
  [p110] USER    @when("task.claim")     → developer's domain logic
```

开发者只写 `[p110]`，其余全部自动生成。

## 与现有 Agent 基础设施的对比

| 维度 | Skill | Subagent Framework | MCP | Socialware |
|------|-------|-------------------|-----|-----------|
| **核心抽象** | Agent 的单项能力 | Agent 间委派链 | Agent↔Tool 接口 | 组织规则（角色/流程/承诺） |
| **Agent 地位** | 执行者 | 层级节点 | 客户端 | 组织成员（与 Human 同等） |
| **Human 在哪** | 系统外 | 系统外（顶层调用者） | 不在范围内 | 系统内（同一 Identity 模型） |
| **生命周期** | 单次调用 | 一个 Task | 一个会话 | 组织的一生 |
| **状态管理** | Stateless | 框架内存 | 工具侧 | CRDT + Timeline 持久化 |
| **协调方式** | 无 | 中心化 Orchestrator | Request/Response | 去中心化（Role + Flow） |
| **可审计** | 无 | 日志级 | 工具侧 | EventWeaver DAG（不可篡改） |
| **组织级操作** | ❌ | ❌ | ❌ | Fork / Compose / Merge |
| **扩展瓶颈** | N/A | Orchestrator 单点 | 线性 | P2P mesh（节点数=吞吐量） |

**关键洞察**：Socialware 不替代 Skill/Subagent/MCP——它是这些基础设施的**上层设施**。一个 Socialware 的 Role 持有者（Agent）内部可以使用 Skill、委派 Subagent、调用 MCP Tool。Socialware 关心的是组织层面的事情：谁有权限、流程合不合法、承诺有没有兑现。

```
┌─────────────────────────────────────────────┐
│  Socialware                                  │
│  组织规则：Role · Flow · Commitment · Arena   │
├─────────────────────────────────────────────┤
│  Agent 内部基础设施                            │
│  Skill · Subagent · MCP · LLM Adapter        │
└─────────────────────────────────────────────┘
```

## Socialware 间三种协作模式

```
成熟度    低 ◄──────────────────────────────────────► 高

模式 1    Ad-hoc（拉群）
          同一 Room 中 @mention + Role 自然交互
          适用：偶发协作

模式 2    Discovery（能力发现）
          EXT-13 Profile 声明服务能力 → 通过 Index 搜索匹配
          适用：结构化的 Agent 分配

模式 3    Compose（组织固化）
          多个 Socialware 通过 §4.2 Compose 固化为新 Socialware
          适用：需要跨 SW 协调规则的成熟组合
```

三者共存。绝大多数场景用模式 1（零成本），模式 2 用于 AgentForge 的自动 staffing，模式 3 用于组织固化。

## ext.runtime.config 与 staffing 策略

```yaml
ext.runtime:
  enabled: ["cv", "ta", "af"]
  config:
    af:
      role_staffing:
        "cv:mentor":
          prefer: "agent"
          template: "code-assistant"
          auto_spawn: true
```

**数据流**：

```
Socialware 声明 (Part B)          运营配置 (ext.runtime.config)      EXT-13 Profile
Role.capabilities                 role_staffing.template             Agent 自描述
"岗位权限"                         "岗位 JD"                          "简历"
     │                                  │                                │
     └──────────────────────────────────┼────────────────────────────────┘
                                        ▼
                                   AgentForge（HR）
                                   匹配 → Spawn → 赋予 Role
```

Socialware 声明中**不包含** staffing 信息。这是运营决策，不是组织章程。

## 技术栈

```
Rust (Engine + Backend + Relay)
  ├── yrs (Yjs CRDT Rust port)
  ├── Zenoh (P2P pub/sub)
  ├── PyO3 (Python binding)
  └── ts-rs (TypeScript type generation)

Python (Socialware + SDK)
  ├── @socialware / @when DSL
  ├── SocialwareContext / EngineContext
  └── AgentAdapter Protocol (LLM integration)

TypeScript (Chat UI)
  ├── React + Render Pipeline
  └── Types auto-synced from Rust via ts-rs
```

## Spec 交叉引用

| 主题 | 文档 | 章节 |
|------|------|------|
| 三层架构定义 | socialware-spec.md | §0.2 |
| 四原语完整定义 | socialware-spec.md | §1 |
| 声明格式 (Part A/B) | socialware-spec.md | §2 |
| Fork/Compose/Merge | socialware-spec.md | §4 |
| @when DSL | socialware-spec.md | §9 |
| 类型级约束 | socialware-spec.md | §10 |
| Socialware 间协作 | socialware-spec.md | §11 |
| Hook Pipeline | bus-spec.md | §3.2 |
| Extension 统一声明 | bus-spec.md | §3.5 |
| EXT-17 Runtime | extensions-spec.md | §18 |
| EXT-13 Profile | extensions-spec.md | §14 |
| EXT-15 Command | extensions-spec.md | §16 |
| Python SDK | py-spec.md | §4 (Hook), §7 (DSL) |
| AgentForge staffing | agentforge-prd.md | §10.4 |
| CodeViber reference | codeviber-prd.md | 全文 |

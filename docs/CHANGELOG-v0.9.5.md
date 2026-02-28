# ezagent Spec v0.9.5 — CHANGELOG

> **日期**：2026-02-28
> **主题**：Socialware DX 革新 — 组织设计师范式 + 类型级层级约束 + Socialware 间协作 + 全文档对齐

---

## 变更背景

v0.9.4 完成了 Monorepo 结构和 Extension 动态加载。v0.9.5 聚焦于 **Socialware 开发者体验（DX）** 的根本性改进，并完成全文档 DSL 对齐。

### 核心发现

1. **开发者被迫触及底层概念**：`@hook` handler 中直接操作 `phase`/`trigger`/`filter`/`priority`、手动拼接 `content_type`、手动设置 `_sw:*` Channel。Socialware DSL 未充分封装 Extensions 层已提供的基础设施。
2. **类型系统可以强制层级边界**：一套 API + `SocialwareContext` 类型约束，类似 Rust safe/unsafe 模型。
3. **Socialware 间协作不需要 Service Protocol**：Room + Message + @mention + Role 足以支撑。
4. **开发者需要"组织设计师"视角**：`@when` handler 是组织管理逻辑，不是业务实现。
5. **Role 上不应有 requires/staffing**：岗位需求是运营决策，属于 `ext.runtime.config`。

---

## 逐文件变更

### 新增文件

| 文件 | 内容 |
|------|------|
| **socialware/codeviber-prd.md** (v0.1) | CodeViber PRD：编程指导服务 Socialware，验证组织设计师范式和 Socialware 间协作 |
| **docs/TLDR-overview.md** | Programmable Organization 概览（面向一般受众） |
| **docs/TLDR-socialware-dev.md** | Socialware 开发者指南（CodeViber 完整示例 + API 速查） |
| **docs/TLDR-architecture.md** | 架构与协议速览（三层架构 + 对比表 + Spec 交叉引用） |

### 重大修改

| 文件 | 变更 |
|------|------|
| **specs/socialware-spec.md** (→ v0.9.5) | §0 重写（组织设计师视角）；新增 §9 DSL、§10 类型约束、§11 协作；附录更新 |
| **specs/py-spec.md** (→ v0.9.5) | §4 重写为双模式 Hook（@when + @hook）；§7 重写（声明式语法糖、双类型模型） |

### 代码示例对齐（🔴 必须修改）

| 文件 | 变更 |
|------|------|
| **socialware/eventweaver-prd.md** (v0.2.1 → v0.2.2) | 前置文档 v0.9.1→v0.9.5；manifest.toml `datatypes`→`content_types`，加 EXT-17 依赖；代码示例 `@hook`→`@when` + `SocialwareContext` |
| **socialware/taskarena-prd.md** (v0.3.0 → v0.3.1) | 前置文档 v0.9.3→v0.9.5；manifest.toml 移除 `hooks` 字段，版本→0.9.5；代码示例 `@hook`+`ctx.messages.send()`→`@when`+`ctx.send()` |
| **socialware/respool-prd.md** (v0.2.1 → v0.2.2) | 前置文档 v0.9.1→v0.9.5；manifest.toml `datatypes`→`content_types`，加 EXT-17 依赖；代码示例 `@hook`→`@when`+`ctx.send()` |

### 标注对齐（🟡 建议修改）

| 文件 | 变更 |
|------|------|
| **specs/architecture.md** | L52: `@hook callback 注册`→`@when DSL (auto-generates @hook)`；L1891: `hooks.py`→`dsl.py`；L2083: 测试用例加注 `v0.9.5 由 @when 自动生成` |
| **specs/bus-spec.md** | L499: Socialware Hook 注册描述加注 `v0.9.5 起推荐 @when DSL，Runtime 自动展开` |

### 其他修改

| 文件 | 变更 |
|------|------|
| **socialware/agentforge-prd.md** (v0.1 → v0.1.1) | 新增 §10.4 Role-based Agent Matching（role_staffing 配置） |
| **plan/phase-5-socialware.md** (→ v0.9.5) | 新增 §16-§18（+24 Test Cases → 130 总计）；验收标准加 v0.9.5 条目 |
| **README.md** | Quick Start 改为 @when 风格；示例改为 CodeViber/TaskArena；文档导航加 docs/ + AgentForge + CodeViber；版本→v0.9.5 |

## 未修改文件

| 文件 | 原因 |
|------|------|
| specs/extensions-spec.md | 不含 Socialware 代码示例 |
| specs/relay-spec.md | 不涉及 |
| specs/repo-spec.md | 不涉及 |
| products/*.md | 不涉及 Socialware DSL |
| plan/phase-0~4 | phase-4 L546 `subscriptions.datatypes` 是 UI 侧概念，非 Socialware 声明 |

---

## 修改模式总结

所有 PRD 代码示例遵循统一模式：

```
旧（v0.9.3）                              新（v0.9.5 推荐）
───────────────────────────────────────────────────────────
@hook(phase=..., trigger=...,             @when("action")
      filter=..., priority=110)           async def on_action(self, event,
async def on_command(self, event, ctx):       ctx: SocialwareContext):
    cmd = event.ref.ext.command               ...
    await ctx.messages.send(                  await ctx.send("action", body=...)
        content_type="ns:action",             await ctx.succeed(result)
        channels=["_sw:ns"], ...)
    await ctx.command.result(
        cmd.invoke_id, status=...)
```

manifest.toml 统一变更：
- `datatypes = [...]` → `content_types = [...]`
- 移除 `hooks = [...]`（Runtime 自动生成）
- 移除 `annotations = [...]`、`indexes = [...]`（底层细节）
- `dependencies.extensions` 加入 `EXT-17`

## Test Case 统计

| 区域 | v0.9.3 | v0.9.5 | 差异 |
|------|--------|--------|------|
| 原有 | 106 | 106 | — |
| CodeViber (TC-5-CV-*) | — | 8 | +8 |
| DSL (TC-5-DSL-*) | — | 10 | +10 |
| 协作 (TC-5-COLLAB-*) | — | 6 | +6 |
| **合计** | **106** | **130** | **+24** |

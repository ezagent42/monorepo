# CLAUDE.md — docs（产品规格与设计文档）

本目录是 EZAgent42 的文档仓库，包含协议规范、产品设计和实施计划。License: CC0-1.0。

## 目录结构

```
docs/
├── specs/       → 协议规范（architecture, bus, extensions, socialware, py-sdk, relay, repo）
├── products/    → 产品文档（app PRD, chat-ui, http-api, cli）
├── plan/        → 实施计划（Phase 0–5, fixtures, foundations）
├── socialware/  → Socialware PRD（EventWeaver, TaskArena, ResPool, AgentForge, CodeViber）
├── tldr/        → 快速了解（Overview, Architecture, Socialware Dev）
├── eep/         → EEP 设计提案（ezagent Enhancement Proposal）
└── style/       → 品牌素材（logo, 样式, 背景）
```

## 文档编写规范

### 语言与格式

- 文档主体使用**中文**，技术术语保留英文原文（如 CRDT、Hook、DataType）
- 使用 Markdown 格式，标题层级不超过 4 级（`####`）
- 代码示例使用 fenced code blocks，标注语言类型
- 表格用于结构化对比（如 API 字段、状态转换）

### 命名约定

- 规范文档：`{domain}-spec.md`（如 `bus-spec.md`）
- 产品文档：`{product}-prd.md`（如 `app-prd.md`）
- 计划文档：`phase-{n}-{name}.md`（如 `phase-1-bus.md`）
- EEP 提案：`EEP-{NNNN}.md`（如 `EEP-0001.md`），详见 `eep/EEP-0000.md`

### 交叉引用

- 文档间使用相对路径链接：`[architecture](specs/architecture.md)`
- 引用协议原语时使用反引号：`DataType`、`Hook`、`Room`
- 引用 Extension 时标注编号：`EXT-15 Command`

## 阅读路径

- **理解全貌** → `specs/architecture.md` → `specs/socialware-spec.md` → `README.md`
- **Rust 核心开发** → `specs/bus-spec.md` → `specs/extensions-spec.md`
- **前端开发** → `products/app-prd.md` → `products/chat-ui-spec.md`
- **写 Socialware** → `specs/socialware-spec.md` → `specs/py-spec.md` → 任意 PRD
- **集成 Agent** → `socialware/agentforge-prd.md` → `specs/extensions-spec.md`

## 注意事项

- 修改 spec 后检查其他 spec 的交叉引用是否仍然正确
- Plan 文档中的 Gate 标准是阶段完成的硬性条件，不可跳过
- 添加新文档时更新 `README.md` 的文档导航表格

# ezagent Spec v0.9.6 — CHANGELOG

> **日期**：2026-03-02
> **主题**：EEP 机制引入 + URI Scheme 合入 + EEP 编号调整

---

## 变更背景

v0.9.5 完成了 Socialware DX 革新和全文档 DSL 对齐。v0.9.6 引入 **EEP（ezagent Enhancement Proposal）机制** 作为协议演进的治理流程，并将首个 EEP —— URI Scheme —— 合入协议规范。

### 核心成果

1. **EEP 机制**：建立标准化的协议增强提案流程（EEP-0000），含类型分类、生命周期状态、编号范围、文档格式等约定。
2. **URI Scheme（EEP-0001）**：为三层架构的所有可寻址资源定义统一的 `ezagent://` URI 标准，实现 Deep Link、资源分享、跨实例引用等能力的寻址基础。
3. **EEP 编号调整**：URI Scheme 从 EEP-0002 调整为 EEP-0001（基础设施优先），Bridge Extension 从 EEP-0001 调整为 EEP-0002。

---

## 新增文件

| 文件 | 内容 |
|------|------|
| **eep/EEP-0000.md** | EEP Purpose and Convention（Process 类型，Active） |
| **eep/EEP-0001.md** | ezagent URI Scheme（Standards 类型，Implemented） |
| **eep/EEP-0002.md** | Bridge Extension EXT-18（Standards 类型，Draft） |
| **eep/EEP-0003.md** | Share Extension EXT-19（Standards 类型，Draft） |
| **CHANGELOG-v0.9.6.md** | 本文件 |

## 重大修改

| 文件 | 变更 |
|------|------|
| **specs/architecture.md** | §1.3 补充 authority 命名空间语义注释；§1.4 新增 URI 交叉引用；**新增 §1.5 URI Scheme**（§1.5.1–§1.5.7：URI 结构、Path 映射、Query 约定、Web Fallback、解析流程、注册机制、规范化规则） |
| **specs/extensions-spec.md** | §1.2.1 manifest 注释更新；**新增 §1.2.3 URI Path 注册**（规则 + 各 Extension uri_paths 一览表）；EXT-03/06/10/11/13/17 声明部分新增 `[uri]` manifest 字段 |
| **specs/socialware-spec.md** | §4.1 Fork 补充 URI 行为说明；**§7.3 Manifest 新增 `[uri]` 部分**（示例 + 5 条 MUST/SHOULD 规则） |
| **specs/relay-spec.md** | §6 Entity 管理补充 URI 表示说明；**新增 §7.7 Web Fallback**（路由规则、端点定义、安全约束、响应头、监控指标） |

## 其他修改

| 文件 | 变更 |
|------|------|
| **specs/bus-spec.md** | §5 Built-in Datatypes 新增 URI Path 映射表 |
| **products/http-spec.md** | 新增 §1.3 HTTP Path 与 ezagent URI 的关系（映射表 + 设计说明） |
| **products/cli-spec.md** | 新增 §2.11 URI 导航（`ezagent open {uri}` 命令 + 解析流程 + 错误处理） |
| **products/app-prd.md** | 新增 §4.8 Deep Link 与 URI Scheme（scheme 注册 + 处理流程 + 右键菜单）；验收标准新增 APP-11/APP-12 |
| **products/chat-ui-spec.md** | 新增 §11 URI 渲染（自动识别、渲染样式、悬停预览、Override Level） |
| **tldr/TLDR-architecture.md** | 新增"统一寻址：ezagent URI"章节（URI 示例表 + Web Fallback 说明） |
| **README.md** | 文档导航新增 `eep/` 部分；阅读路径新增 URI 条目；版本号 v0.9.5→v0.9.6 |
| **plan/README.md** | Test Case 编号规则新增 URI area；总览表更新数量 |
| **plan/phase-2-extensions.md** | 新增 §5.18 URI Path 注册（TC-2-URI-001~003，+3 test cases） |
| **plan/phase-4-cli-http.md** | 新增 §12 URI 导航（TC-4-CLI-URI-001~005，+5 test cases）；附录合计 77→82 |
| **plan/phase-5-chat-app.md** | 新增 §11 URI Deep Link 与渲染（TC-5-URI-001~003，+3 test cases）；附录合计 69→72 |
| **plan/phase-6-socialware.md** | 新增 §18 Socialware URI 注册（TC-6-URI-001~002，+2 test cases）；附录合计 130→132 |

## 未修改文件

| 文件 | 原因 |
|------|------|
| specs/py-spec.md | URI 解析在客户端层实现，PyO3 API 不变（URI 工具函数标记为 Future Work） |
| specs/repo-spec.md | 不涉及 |
| socialware/*.md | 各 Socialware PRD 无需修改；`[uri]` 声明由开发者在 manifest 中添加 |
| tldr/TLDR-overview.md | 面向非技术受众，不涉及协议细节 |
| tldr/TLDR-socialware-dev.md | 无 manifest.toml 示例，不涉及 |
| plan/phase-0-verification.md | 不涉及 |
| plan/phase-1-bus.md | 不涉及 |
| plan/foundations.md | URI 索引结构可在实现阶段补充 |
| plan/fixtures.md | URI 相关 Fixture 数据可在实现阶段补充 |
| style/style-guide.md | 不涉及 |

## EEP 编号调整记录

| 旧编号 | 新编号 | 标题 | 原因 |
|--------|--------|------|------|
| EEP-0002 | **EEP-0001** | ezagent URI Scheme | URI 是基础设施，Bridge 和 Share 均依赖它。基础设施应优先编号 |
| EEP-0001 | **EEP-0002** | Bridge Extension (EXT-18) | 依赖 EEP-0001 URI Scheme |
| EEP-0003 | EEP-0003 | Share Extension (EXT-19) | 编号不变，依赖引用 EEP-0002→EEP-0001 已更新 |

交叉引用更新统计：EEP-0002 中 12 处 `EEP-0002`→`EEP-0001`，EEP-0003 中 6 处 `EEP-0002`→`EEP-0001`。

## Test Case 统计

| Phase | v0.9.5 | v0.9.6 | 差异 |
|-------|--------|--------|------|
| Phase 0 | 11 | 11 | — |
| Phase 1 | ~120 | ~120 | — |
| Phase 2 | ~100 | ~103 | +3 (URI Path 注册) |
| Phase 4 | 77 | 82 | +5 (URI 导航) |
| Phase 5 | 69 | 72 | +3 (URI Deep Link & 渲染) |
| Phase 6 | 130 | 132 | +2 (Socialware URI 注册) |
| **合计** | **~507** | **~520** | **+13** |

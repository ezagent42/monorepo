# ezagent Spec v0.9.6.1 — CHANGELOG

> **日期**：2026-03-03
> **主题**：Phase 重编号 — 插入 Phase 3: Relay 实现

---

## 变更背景

v0.9.6 的实施计划（Phase 0–5）中 Relay 没有独立的开发阶段，但原 Phase 3 (CLI + HTTP) 的首个测试用例 `TC-3-CLI-001` 就要求 `RELAY-A 运行中`。`relay/` 目录目前没有源代码，需要独立的实现阶段。

### 核心变更

1. **插入 Phase 3: Relay 实现**：新增 `plan/phase-3-relay.md`，包含 12 个 Section、93 个 Test Case，分 Level 1 (Bridge) / Level 2 (Managed) / Level 3 (Public) 三个 Gate
2. **Phase 重编号**：原 Phase 3/4/5 依次重编号为 Phase 4/5/6
3. **TC 编号重编号**：TC-3-* → TC-4-*，TC-4-* → TC-5-*，TC-5-* → TC-6-*
4. **全文档引用更新**：涉及约 15 个文件的跨引用一致性更新

---

## 新增文件

| 文件 | 内容 |
|------|------|
| **plan/phase-3-relay.md** (v0.9) | Phase 3: Relay 实现计划 — Zenoh Router + TLS、CRDT 持久化、身份注册、Blob Store、ACL、Quota、Admin API、监控、多 Relay 协同、Discovery、Web Fallback、部署验证 |
| **CHANGELOG-v0.9.6.1.md** | 本文件 |

## 文件重命名

| 原文件 | 新文件 |
|--------|--------|
| plan/phase-3-cli-http.md | plan/phase-4-cli-http.md |
| plan/phase-4-chat-app.md | plan/phase-5-chat-app.md |
| plan/phase-5-socialware.md | plan/phase-6-socialware.md |

## 重编号记录

| 原编号 | 新编号 | 内容 |
|--------|--------|------|
| Phase 3 | **Phase 4** | CLI + HTTP API |
| Phase 4 | **Phase 5** | Chat App |
| Phase 5 | **Phase 6** | Socialware |
| TC-3-* | **TC-4-*** | CLI + HTTP Test Cases (82 个) |
| TC-4-* | **TC-5-*** | Chat App Test Cases (72 个) |
| TC-5-* | **TC-6-*** | Socialware Test Cases (132 个) |
| P3-* | **P4-*** | architecture.md 场景 ID |
| P4-* | **P5-*** | architecture.md 场景 ID |
| P5-* | **P6-*** | architecture.md 场景 ID |

## 重大修改

| 文件 | 变更 |
|------|------|
| **plan/phase-4-cli-http.md** | 标题 Phase 3→4；前置依赖改为 Phase 3 (Relay)；全部 TC-3-* → TC-4-*（82 个 TC） |
| **plan/phase-5-chat-app.md** | 标题 Phase 4→5；前置依赖 Phase 3→Phase 4；全部 TC-4-* → TC-5-*（72 个 TC） |
| **plan/phase-6-socialware.md** | 标题 Phase 5→6；前置依赖 Phase 4→Phase 5；全部 TC-5-* → TC-6-*（132 个 TC） |
| **plan/README.md** | 总览表插入 Phase 3 Relay 行；TC 编号规则增加 Phase 6；Area 列表新增 Phase 3 areas 并更新 Phase 4/5/6 注释；TC 统计表插入 Phase 3 行，合计 ~520→~613 |
| **specs/architecture.md** | 新增 Phase 3: Relay section + P3-* 场景；Phase 3→4、4→5、5→6 标题和场景 ID 更新 |

## 其他修改

| 文件 | 变更 |
|------|------|
| **README.md**（根目录） | 项目状态表插入 Phase 3 Relay 行；Phase 3→4、4→5、5→6；实施计划链接 Phase 0–5→0–6 |
| **docs/README.md** | Plan 文件链接表插入 Phase 3 Relay 行；文件名链接更新；项目状态表同上 |
| **eep/EEP-0001.md** | Stage 3: Phase 3 (CLI) / Phase 4 (App) → Phase 4 (CLI) / Phase 5 (App) |
| **eep/EEP-0002.md** | 4 处 Phase 引用更新：Phase 3→4, Phase 4→5 |
| **eep/EEP-0003.md** | 2 处 Phase 引用更新：Phase 5→6, Phase 3/4→4/5 |
| **app/CLAUDE.md** | Phase 4 计划 → Phase 5 计划 |
| **plan/fixtures.md** | 2 处 Phase 5→Phase 6（fixture scenario 表）；附录 K 新增 Phase 3 Relay 追溯条目 |
| **CHANGELOG-v0.9.5.md** | TC-5-CV/DSL/COLLAB → TC-6-*；phase-5-socialware→phase-6-socialware；phase-0~4→phase-0~5 |
| **CHANGELOG-v0.9.6.md** | plan/phase-3→4、4→5、5→6 文件名更新；TC-3→4、4→5、5→6 编号更新；统计表 Phase 编号更新 |

## TC 统计表

| Phase | 文件 | TC 数 |
|-------|------|-------|
| Phase 0 | phase-0-verification.md | 11 |
| Phase 1 | phase-1-bus.md | ~120 |
| Phase 2 | phase-2-extensions.md | ~103 |
| **Phase 3** | **phase-3-relay.md** | **93** |
| Phase 4 | phase-4-cli-http.md | 82 |
| Phase 5 | phase-5-chat-app.md | 72 |
| Phase 6 | phase-6-socialware.md | 132 |
| **合计** | | **~613** |

# ezagent — Implementation Plan

> **版本**：0.9
> **日期**：2026-02-25
> **前置文档**：ezagent-bus-spec-v0.9, ezagent-extensions-spec-v0.9, ezagent-py-spec-v0.9

---

## 阶段总览

| 阶段 | 范围 | 目标 | 预估周期 | 详细文档 |
|------|------|------|---------|---------|
| **Phase 0: 技术验证** | yrs + Zenoh + PyO3 可行性 | Backend + Embedded 选型验证 | 2 周 | [phase-0-verification.md](phase-0-verification.md) |
| **Phase 1: Bus 实现** | Engine (4 组件) + Backend + Built-in (4 Datatypes) | 协议核心可运行 (Level 0) | 3-4 周 | [phase-1-bus.md](phase-1-bus.md) |
| **Phase 2: Extension 实现** | EXT-01 到 EXT-14，全部 Rust | 协议功能完整 | 3-4 周 | [phase-2-extensions.md](phase-2-extensions.md) |
| **Phase 2.5: Python Binding** | PyO3 + auto-gen API (py-spec §1-7) | `pip install ezagent` SDK 可用 | 2-3 周 | [phase-2-extensions.md](phase-2-extensions.md) |
| **Phase 3: CLI + HTTP API** | CLI 命令 (cli-spec) + HTTP endpoint (http-spec) | 后端完整可用 | 1-2 周 | [phase-3-cli-http.md](phase-3-cli-http.md) |
| **Phase 4: Chat App** | React Chat UI + Render Pipeline + Desktop 打包 | 终端用户可用 | 3-4 周 | [phase-4-chat-app.md](phase-4-chat-app.md) |
| **Phase 5: Socialware** | Socialware 四原语 + EventWeaver/TaskArena/ResPool | Agent 驱动的协作 | 3-4 周 | [phase-5-socialware.md](phase-5-socialware.md) |

## Gate 标准

每个 Phase 完成时必须满足：

1. **所有 Test Case 通过**：该 Phase 的全部 `TC-{phase}-*` 测试用例绿色通过。
2. **Fixture 验证通过**：对应阶段的 Fixture 数据可被正确加载和验证。
3. **Spec 覆盖**：Test Case → Spec 追溯矩阵中，该 Phase 涉及的 Spec 条目 100% 覆盖。
4. **无 P0/P1 Bug**：无未解决的阻塞性或功能性缺陷。

## Fixture 阶段加载策略

| 阶段 | 加载的 Fixture |
|------|---------------|
| Phase 0 | `keypairs/` + `ezagent/room/{R-minimal}/` |
| Phase 1 | `keypairs/` + `ezagent/entity/` + `ezagent/room/` 中所有 Bus 数据（忽略 `ext/` 子目录和 ref 上的 `ext.*` 字段） |
| Phase 2 | 完整 `ezagent/` 目录（含所有 Extension 数据） |
| 异常测试 | `ezagent-error/` 中的对应文件（任何阶段按需） |

## 基础文档

| 文档 | 内容 |
|------|------|
| [foundations.md](foundations.md) | Key Space 定义、Fixture 设计原则、目录结构、Test Case 编号规则 |
| [fixtures.md](fixtures.md) | 全部验证数据（Entities、Rooms、Messages、Extensions、Relay）+ Scenario 列表 + Error Fixture + 追溯矩阵 |

## Test Case 编号规则

```
TC-{phase}-{area}-{number}

Phase: 0 / 1 / 2 / 3 / 4 / 5
Area:  SYNC / ENGINE / HOOK / ANNOT / INDEX / IDENT / ROOM / TL / MSG / API
       / EXT01 ... EXT14 / INTERACT
       / CLI / HTTP / WS          (Phase 3)
       / RENDER / DECOR / ACTION / TAB / OVERRIDE / WIDGET / UI / JOURNEY / PKG / SYNC  (Phase 4)
       / SW / EW / TA / RP / CROSS  (Phase 5)
Number: 三位数字
```

## Test Case 总览

| Phase | 文件 | Test Case 数 |
|-------|------|-------------|
| Phase 0 | phase-0-verification.md | 11 |
| Phase 1 | phase-1-bus.md | ~120 |
| Phase 2 | phase-2-extensions.md | ~100 |
| Phase 3 | phase-3-cli-http.md | 77 |
| Phase 4 | phase-4-chat-app.md | 69 |
| Phase 5 | phase-5-socialware.md | 84 (50 新增 + 34 PRD 引用) |
| **合计** | | **~461** |

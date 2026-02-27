---
title: "Socialware：可编程的组织逻辑"
description: "Socialware 是 EZAgent 的核心概念——用代码定义组织的角色、边界、承诺和流程。"
lang: zh
order: 2
---

## 什么是 Socialware？

想象一下，如果组织的运作规则——谁能做什么、任务怎么流转、审批如何进行——不是写在 Wiki 或散落在 Slack 频道里，而是变成了一段可执行的代码。

这就是 Socialware。

Socialware 是一种**代码 + Agent 混合驱动**的组织软件。它用四个简洁的原语来描述任何组织行为：

## 四个原语

### Role（角色）
定义"能做什么"的能力信封。一个 Identity（人或 Agent）可以拥有多个 Role，每个 Role 描述一组权限和能力。就像公司里的"审核员"、"发布者"、"管理员"——但可以用代码精确定义。

### Arena（竞技场）
定义"在哪里做"的边界。Arena 决定了 Socialware 影响的范围——哪些 Room、哪些数据、哪些参与者。就像部门的边界——但可以动态组合和嵌套。

### Commitment（承诺）
定义"必须做什么"的义务绑定。当你认领了一个任务，你和任务之间就形成了 Commitment。它追踪进度、验证交付、处理违约。就像合同——但由代码自动执行。

### Flow（流程）
定义"怎么演进"的状态机。一个任务从"发布"到"认领"到"审核"到"完成"，每一步的条件和触发都由 Flow 描述。就像工作流——但支持分支、回退和自动触发。

## 从零到一的例子

假设你想建一个任务管理系统：

1. 声明 DataType：`ta_task`（任务卡片）、`ta_submission`（提交物）
2. 声明 Role：`publisher`（发布者）、`worker`（执行者）、`reviewer`（审核者）
3. 声明 Flow：`open → claimed → submitted → in_review → approved`
4. 注册 Hook：当任务超时，自动 escalate

这就是一个完整的 TaskArena Socialware。它不需要后端服务器，不需要数据库——所有数据通过 CRDT 在参与者之间同步。

## 组合的力量

Socialware 的真正威力在于组合。TaskArena 管任务，ResPool 管资源，EventWeaver 记录因果链——三者各自独立，但可以自由组合。

任务完成后自动结算 GPU-hours？TaskArena 的 Flow 触发 ResPool 的扣费。审核有争议？自动在 EventWeaver 中创建分支记录。

这就是"组织即代码"的具体含义。

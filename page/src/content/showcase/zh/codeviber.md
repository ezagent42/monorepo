---
title: "CodeViber"
description: "编程指导服务——Mentor 可以是人类专家也可以是 Agent，CodeViber 不知道也不关心区别。"
lang: zh
icon: "ph-duotone ph-chats-circle"
tags: ["应用", "编程指导", "Human-Agent 无差别"]
color: "#c94040"
---

CodeViber 是 EZAgent 的**编程指导服务** Socialware。

它为开发者（人类和 Agent）提供结构化的学习环境——发起会话、提问、获得专家指导、追踪进展。

### 核心理念

- **指导是组织关系，不是 API 调用**：有角色（导师/学员）、流程（会话生命周期）、承诺（响应 SLA）
- **Human-Agent 无差别**：Mentor 可以是人类工程师，也可以是 AgentForge 管理的 AI Agent。CodeViber 通过 Role 分配，不关心 Identity 类型
- **低置信度自动升级**：Agent Mentor 不确定时，自动 escalate 给人类 Mentor——Role 不变，Identity 切换

### 50 行代码

CodeViber 的完整声明只有 ~50 行 Python——两个 `@when` 处理器，零 AI 逻辑。所有"智能"由持有 `cv:mentor` Role 的 Identity 自行负责。

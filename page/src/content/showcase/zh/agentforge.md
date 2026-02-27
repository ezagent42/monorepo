---
title: "AgentForge"
description: "Agent 生命周期管理——基于模板创建 Agent，统一管理资源预算、能力范围和运行状态。"
lang: zh
icon: "ph-duotone ph-robot"
tags: ["Agent 管理", "模板", "生命周期"]
color: "#4a6b5a"
---

AgentForge 是 EZAgent 的 **Agent 生命周期管理器**——平台级基础设施 Socialware。

它让你像管理员工一样管理 Agent：创建、配置、监控、下线——全部通过结构化的流程完成。

### 核心能力

- **模板化创建**：定义 Agent 模板（能力、资源限额、适配器），一键实例化
- **资源管控**：为每个 Agent 设定 API 调用预算、并发限制、沙箱路径
- **适配器模式**：支持 Claude Code、Gemini CLI、自定义 LLM 等多种后端
- **无状态调用**：每次 @mention = 一次独立的 Agent 调用，简洁可预测

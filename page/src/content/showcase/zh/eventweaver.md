---
title: "EventWeaver"
description: "事件溯源引擎——为组织的每一次操作留下不可篡改的因果记录，支持分支、合并和时间旅行。"
lang: zh
icon: "ph-duotone ph-git-branch"
tags: ["基础设施", "事件溯源", "审计"]
color: "#6b8fa5"
---

EventWeaver 是 EZAgent 的**事件溯源引擎**——平台级基础设施 Socialware。

每个 Socialware 操作都在 EventWeaver 中留下不可篡改的事件记录，形成可分支、可合并的事件 DAG（有向无环图）。

### 核心能力

- **因果追踪**：每个事件记录"因为什么而发生"，构建完整因果链
- **分支管理**：争议时创建分支，各方在独立分支上操作，最终合并或放弃
- **组织记忆**：所有历史可查询、可回溯、可学习
- **跨 Socialware 因果链**：TaskArena 的任务完成触发 ResPool 的结算，因果关系清晰可查

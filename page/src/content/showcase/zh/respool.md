---
title: "ResPool"
description: "资源池——统一的资源抽象层，管理 GPU、算力、人力、频道配额等任何可量化资源。"
lang: zh
icon: "ph-duotone ph-database"
tags: ["资源管理", "配额", "结算"]
color: "#c9a55a"
---

ResPool 是 EZAgent 的**资源抽象层**——平台级基础设施 Socialware。

它提供统一的资源管理接口：计算资源（GPU-hours）、人力（工时）、频道带宽、存储空间、API 配额——任何可量化的东西都能纳入 ResPool 管理。

### 核心能力

- **统一抽象**：不管是 GPU 还是人工小时，都用同一套 API 管理
- **灵活定价**：支持固定价格、按量计费、拍卖三种模式
- **自动结算**：与 TaskArena 联动——任务完成，自动发放资源
- **配额管理**：为 Agent 设定 API 调用预算、并发限制，防止资源滥用

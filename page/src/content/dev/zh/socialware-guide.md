---
title: "Socialware 开发指南"
description: "用 Python 的 @socialware 装饰器构建你的第一个 Socialware。"
lang: zh
order: 2
sidebar_label: "开发指南"
---

## @socialware 装饰器

EZAgent 使用 Python 装饰器来声明 Socialware。一个最小的 Socialware 只需要几行代码：

```python
from ezagent import socialware, hook

@socialware("my-app")
class MyApp:
    # 声明自定义 DataType
    datatypes = ["my_task", "my_report"]

    # 声明角色
    roles = ["admin", "worker"]

    # 注册 Hook
    @hook(phase="after_write", trigger="message.insert")
    async def on_new_message(self, event, ctx):
        if event.ref.datatype == "my_task":
            await ctx.messages.send(
                body="New task received!",
                reply_to=event.ref_id
            )
```

## 核心概念

### DataType 声明

`datatypes` 列表声明了你的 Socialware 引入的数据类型。每个 DataType 是一个 CRDT 数据结构——所有参与者自动同步，无需服务器。

### Role 定义

`roles` 列表声明了角色。角色是能力的容器——拥有某个 Role 的 Identity 获得对应的权限。

### Hook 注册

三个阶段覆盖完整的数据生命周期：

- **pre-send**：数据发送前拦截——可以验证、修改或拒绝
- **after-write**：数据写入后触发——用于响应、通知、联动
- **after-read**：数据读取后增强——用于展示增强、权限过滤

### Flow 声明

```python
@socialware("task-manager")
class TaskManager:
    flows = [{
        "id": "task_lifecycle",
        "states": ["open", "claimed", "submitted", "approved"],
        "transitions": {
            "open → claimed": "worker claims task",
            "claimed → submitted": "worker submits result",
            "submitted → approved": "reviewer approves"
        }
    }]
```

## 完整示例

参考现有 Socialware 实现：

- **EventWeaver** — 事件溯源（平台级）
- **TaskArena** — 任务市场（应用级）
- **ResPool** — 资源管理（平台级）
- **AgentForge** — Agent 管理（平台级）

## 深入阅读

完整的 Socialware 规范和 Python SDK API 参考请访问 [ReadTheDocs](#)。

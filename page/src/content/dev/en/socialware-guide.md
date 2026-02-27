---
title: "Socialware Development Guide"
description: "Build your first Socialware using Python's @socialware decorator."
lang: en
order: 2
sidebar_label: "Dev Guide"
---

## The @socialware Decorator

EZAgent uses Python decorators to declare Socialware. A minimal Socialware takes just a few lines:

```python
from ezagent import socialware, hook

@socialware("my-app")
class MyApp:
    # Declare custom DataTypes
    datatypes = ["my_task", "my_report"]

    # Declare roles
    roles = ["admin", "worker"]

    # Register Hook
    @hook(phase="after_write", trigger="message.insert")
    async def on_new_message(self, event, ctx):
        if event.ref.datatype == "my_task":
            await ctx.messages.send(
                body="New task received!",
                reply_to=event.ref_id
            )
```

## Core Concepts

### DataType Declaration

The `datatypes` list declares the data types your Socialware introduces. Each DataType is a CRDT data structure — all participants sync automatically, no server needed.

### Role Definition

The `roles` list declares roles. Roles are capability containers — an Identity with a Role gains the corresponding permissions.

### Hook Registration

Three phases cover the complete data lifecycle:

- **pre-send**: Intercept before data is sent — validate, modify, or reject
- **after-write**: Trigger after data is written — respond, notify, chain actions
- **after-read**: Enhance after data is read — display enrichment, permission filtering

### Flow Declaration

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

## Complete Examples

Reference existing Socialware implementations:

- **EventWeaver** — Event sourcing (platform-level)
- **TaskArena** — Task marketplace (application-level)
- **ResPool** — Resource management (platform-level)
- **AgentForge** — Agent management (platform-level)

## Further Reading

Full Socialware specification and Python SDK API reference available at [ReadTheDocs](#).

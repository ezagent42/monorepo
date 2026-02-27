---
title: "Developer Portal"
description: "From three-layer fractal architecture to your first Socialware — the EZAgent developer guide."
lang: en
order: 0
sidebar_label: "Start"
---

## Welcome, Developer

EZAgent is a CRDT-based open protocol. Its three-layer fractal architecture lets you define how organizations operate using Python code.

### What Can You Build with EZAgent?

- **Build Socialware**: Use the `@socialware` decorator to declare organization logic
- **Define DataTypes**: Create custom CRDT-synced data structures
- **Write Hooks**: Inject logic at any stage of the data lifecycle
- **Compose Flows**: Describe business processes with state machines

### Quick Start

```bash
pip install ezagent
```

```python
import ezagent

# Create Identity — humans and Agents are identical
alice = ezagent.Identity.create("alice")
agent = ezagent.Identity.create("agent-r1")

# Create Room
room = ezagent.Room.create(
    name="my-project",
    members=[alice, agent]
)

# Send message
room.send(author=agent, body="Hello from Agent!", channels=["general"])
```

### Next Steps

- [Architecture Deep Dive](/en/dev/architecture) — Understand Bottom → Mid-layer → Socialware
- [Socialware Dev Guide](/en/dev/socialware-guide) — Write your first Socialware
- [Developer Showcase](/en/dev/showcase) — See existing Socialware implementations
- [Resources](/en/dev/resources) — Full docs, API reference, community

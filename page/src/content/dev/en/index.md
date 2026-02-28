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

- **Build Socialware**: Use the `@socialware` decorator + `@when` DSL to declare organization logic
- **Define Roles**: Use `Role(capabilities=capabilities(...))` to declare roles and capabilities
- **Orchestrate Flows**: Use `Flow(subject=..., transitions={...})` to describe business process state machines
- **Compose Organizations**: Multiple Socialware collaborate naturally via Room + Message + @mention

### Quick Start

```bash
pip install ezagent
```

```python
import ezagent
from ezagent import socialware, when, Role, Flow, capabilities, SocialwareContext

# Create Identity — humans and Agents are identical
alice = ezagent.Identity.create("alice")
agent_r1 = ezagent.Identity.create("agent-r1")

# Create Room with equal members
room = ezagent.Room.create(
    name="feature-review",
    members=[alice, agent_r1]
)

# Agent sends message — exactly like humans
room.send(
    author=agent_r1,
    body="I've reviewed PR #427. Two issues found, see annotations.",
    channels=["code-review"]
)

# Define organization with Socialware — declare roles and flows
@socialware("code-review")
class CodeReview:
    namespace = "cr"
    roles = {
        "cr:reviewer": Role(capabilities=capabilities("review.submit", "review.approve")),
        "cr:author":   Role(capabilities=capabilities("review.request")),
    }
    review_flow = Flow(
        subject="review.request",
        transitions={
            ("pending", "review.submit"):  "reviewed",
            ("reviewed", "review.approve"): "approved",
        },
    )

    @when("review.request")
    async def on_review_request(self, event, ctx: SocialwareContext):
        reviewers = ctx.state.roles.find("cr:reviewer", room=event.room_id)
        await ctx.send("review.notify", body={"pr": event.body["pr"]},
                       mentions=[r.entity_id for r in reviewers])
```

### Next Steps

- [Architecture Deep Dive](/en/dev/architecture) — Understand Bottom → Mid-layer → Socialware
- [Socialware Dev Guide](/en/dev/socialware-guide) — Write your first Socialware
- [Developer Showcase](/en/dev/showcase) — See existing Socialware implementations
- [Resources](/en/dev/resources) — Full docs, API reference, community

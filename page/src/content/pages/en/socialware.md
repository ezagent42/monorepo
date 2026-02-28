---
title: "Socialware: Programmable Organization Logic"
description: "Socialware is the core concept of EZAgent — define your organization's roles, boundaries, commitments, and processes in code."
lang: en
order: 2
---

## What Is Socialware?

Imagine if your organization's operating rules — who can do what, how tasks flow, how approvals work — weren't written in wikis or scattered across Slack channels, but became executable code.

That's Socialware.

## Socialware Is the Organization's Upper Layer

Socialware **doesn't replace** Skill, Subagent, or MCP — they operate at different levels:

```
┌─────────────────────────────────────────────┐
│ Socialware (Organization rules)              │
│ Role · Arena · Commitment · Flow             │
│ "Who can do what, where, with what promise"  │
├─────────────────────────────────────────────┤
│ Agent internal infrastructure                │
│ Skill · Subagent · MCP · LLM Adapter         │
│ "What Agent can do, delegate, call tools"    │
└─────────────────────────────────────────────┘
```

Like an OS doesn't care how the CPU executes instructions, Socialware doesn't care what LLM an Agent uses internally. It only cares: what role in the org, what was promised, is the flow legal.

## Four Primitives

### Role
Defines the "capability envelope" of what can be done. Declared with `Role(capabilities=capabilities(...))`. An Identity (human or Agent) can hold multiple Roles.

### Arena
Defines the "boundary" of where things happen. Arena determines the scope of a Socialware's influence — which Rooms, which data, which participants.

### Commitment
Defines the "obligation binding" of what must be done. Declared with `Commitment(between=..., obligation=..., deadline=...)`. Tracks progress, verifies delivery, handles violations.

### Flow
Defines the "state machine" of how things evolve. Declared with `Flow(subject=..., transitions={...})`. Supports branching, rollback, and conditional triggering.

## From Zero to One

```python
from ezagent import socialware, when, Role, Flow, capabilities, SocialwareContext

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

That's a complete Code Review Socialware. No backend server, no database — all data syncs via CRDT between participants.

## The Power of Composition

The real power of Socialware lies in composition. TaskArena handles tasks, ResPool handles resources, EventWeaver records causal chains, CodeViber provides programming mentorship — each independent, yet freely composable.

Socialware collaborate like humans do — @mention + Role. CodeViber needs to notify a Mentor? @mention the Identity with `cv:mentor` Role. If it's an Agent, AgentForge auto-wakes it. If it's a human, it's just an IM notification. Code doesn't change a character.

That's what "Organization as Code" means in practice.

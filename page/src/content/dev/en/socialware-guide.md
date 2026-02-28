---
title: "Socialware Development Guide"
description: "Build your first Socialware using Python's @socialware decorator + @when DSL."
lang: en
order: 2
sidebar_label: "Dev Guide"
---

## You're an Organization Designer, Not a Programmer

When writing Socialware, you're designing organizations — not programming:

| What You're Doing | Primitive | Analogy |
|-------------------|-----------|---------|
| Define positions and permissions | **Role** | Company bylaws job description |
| Set department boundaries | **Arena** | Department isolation + cross-dept rules |
| Set SLAs and contracts | **Commitment** | Employment contract obligation clauses |
| Plan work processes | **Flow** | Approval flows, task routing rules |

**You don't implement any position's actual work** — that's the Role holder's (human or Agent) responsibility.

## @socialware + @when DSL

EZAgent v0.9.5 uses the `@socialware` decorator to declare organizations and `@when` DSL to handle organizational events:

```python
from ezagent import (
    socialware, when, Role, Flow, Commitment,
    capabilities, preferred_when, SocialwareContext,
)

@socialware("code-viber")
class CodeViber:
    namespace = "cv"

    # ── Position definitions ──
    roles = {
        "cv:mentor":  Role(capabilities=capabilities(
            "session.accept", "guidance.provide", "session.close")),
        "cv:learner": Role(capabilities=capabilities(
            "session.request", "question.ask", "session.close")),
    }

    # ── Work process ──
    session_lifecycle = Flow(
        subject="session.request",
        transitions={
            ("pending", "session.accept"):   "active",
            ("active",  "guidance.provide"): "active",
            ("active",  "session.close"):    "closed",
            ("active",  "session.escalate"): "escalated",
            ("escalated", "guidance.provide"): "active",
        },
        preferences={
            "session.escalate": preferred_when("last_guidance.confidence < 0.5"),
        },
    )

    # ── SLA commitments ──
    commitments = [
        Commitment(
            id="response_sla",
            between=("cv:mentor", "cv:learner"),
            obligation="Mentor responds within deadline",
            triggered_by="question.ask",
            deadline="5m",
        ),
    ]

    # ── Organization management logic (NOT business logic!) ──

    @when("session.request")
    async def on_session_request(self, event, ctx: SocialwareContext):
        """Find available mentor and notify. Zero AI logic."""
        mentors = ctx.state.roles.find("cv:mentor", room=event.room_id)
        if not mentors:
            await ctx.fail("No mentor available")
            return
        await ctx.send("session.notify",
                       body={"learner": event.author, "topic": event.body["topic"]},
                       mentions=[m.entity_id for m in mentors])
        await ctx.succeed({"notified": len(mentors)})

    @when("guidance.provide")
    async def on_guidance(self, event, ctx: SocialwareContext):
        """Check confidence, escalate to human if needed."""
        if event.body.get("confidence", 1.0) < 0.5:
            humans = [m for m in ctx.state.roles.find("cv:mentor", room=event.room_id)
                      if m.entity_id != event.author]
            if humans:
                await ctx.send("_system.escalation",
                               body={"reason": "low_confidence"},
                               mentions=[m.entity_id for m in humans])
```

That's all. ~50 lines of Python, a complete programming mentorship service.

## SocialwareContext Cheat Sheet

The `@when` handler's `ctx` is a restricted type — only organizational operations:

```python
# ✅ Can do
await ctx.send(action, body, mentions=[...])   # Send org message
await ctx.reply(ref_id, action, body)          # Reply
await ctx.succeed(result)                      # Command success
await ctx.fail(error)                          # Command failure
await ctx.grant_role(entity_id, role)          # Grant role
await ctx.revoke_role(entity_id, role)         # Revoke role
ctx.state.flow_states[ref_id]                  # Query Flow state
ctx.state.roles.find("cv:mentor", room=...)    # Find role holders
ctx.members                                    # Current Room members

# ❌ Don't exist (type system prevents, not runtime)
ctx.messages.send(content_type=...)            # → AttributeError
ctx.hook.register(phase=...)                   # → AttributeError
ctx.annotations.write(...)                     # → AttributeError
```

Need low-level ops? Declare `@socialware("my-sw", unsafe=True)` to get `EngineContext`.

## Runtime Auto-Generation

You only write `@when` handlers. Runtime auto-generates 7 types of code from your declaration:

| What You Skip | How Runtime Does It |
|--------------|-------------------|
| Concatenate `content_type` | `ctx.send("session.notify")` → auto becomes `cv:session.notify` |
| Set `channels` | Auto-set to `["_sw:cv"]` |
| Write Role permission checks | Auto-generated from `roles` into pre_send Hook |
| Write Flow transition validation | Auto-generated from `transitions` into pre_send Hook |
| Update State Cache | Auto-generated from `flows` into after_write Hook |
| Register Hook code | `@when("action")` auto-expands to full Hook Pipeline |
| Dispatch Commands | EXT-15 Command → `@when` handler auto-routed |

## Socialware-to-Socialware Collaboration

Socialware collaborate like **humans do** — @mention + Role, no special protocol:

```
CodeViber                       AgentForge
    │                              │
    │  @mention cv:mentor          │
    ├─────────────────────────────►│ ← Detects Agent @mention
    │                              │   Auto-wakes Agent
    │  cv:guidance.provide         │
    │◄─────────────────────────────┤
    │                              │
    │  CodeViber doesn't know recipient is Agent
    │  AgentForge doesn't know source is CodeViber
```

If mentor is human? @mention becomes direct IM notification. **Code doesn't change a character.**

## Complete Examples

Reference existing Socialware implementations:

- **CodeViber** — Programming mentorship (application-level)
- **EventWeaver** — Event sourcing (platform-level)
- **TaskArena** — Task marketplace (application-level)
- **ResPool** — Resource management (platform-level)
- **AgentForge** — Agent management (platform-level)

## Further Reading

Full Socialware specification and Python SDK API reference available at [ReadTheDocs](#).

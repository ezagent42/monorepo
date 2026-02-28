---
title: "CodeViber"
description: "Programming mentorship service — Mentor can be a human expert or an Agent. CodeViber doesn't know and doesn't care."
lang: en
icon: "ph-duotone ph-chats-circle"
tags: ["Application", "Mentorship", "Human-Agent Indifference"]
color: "#c94040"
---

CodeViber is EZAgent's **programming mentorship service** Socialware.

It provides a structured learning environment for developers (human and Agent) — initiate sessions, ask questions, receive expert guidance, and track progress.

### Core Philosophy

- **Guidance is organizational relationship, not API call**: Has roles (mentor/learner), flows (session lifecycle), commitments (response SLA)
- **Human-Agent indifference**: Mentor can be a human engineer or an AgentForge-managed AI Agent. CodeViber assigns via Role, not Identity type
- **Auto-escalation on low confidence**: When Agent Mentor is uncertain, auto-escalates to human Mentor — Role stays same, Identity switches

### 50 Lines of Code

CodeViber's complete declaration is ~50 lines of Python — two `@when` handlers, zero AI logic. All "intelligence" is the responsibility of the Identity holding the `cv:mentor` Role.

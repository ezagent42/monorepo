---
title: "EventWeaver"
description: "Event sourcing engine — creates immutable causal records for every organizational operation, with branching, merging, and time travel."
lang: en
icon: "ph-duotone ph-git-branch"
tags: ["Infrastructure", "Event Sourcing", "Audit"]
color: "#6b8fa5"
---

EventWeaver is EZAgent's **event sourcing engine** — a platform-level infrastructure Socialware.

Every Socialware operation leaves an immutable event record in EventWeaver, forming a branchable, mergeable event DAG (Directed Acyclic Graph).

### Core Capabilities

- **Causal tracking**: Every event records "why it happened", building complete causal chains
- **Branch management**: Create branches during disputes, operate independently, then merge or abandon
- **Organizational memory**: All history is queryable, traceable, and learnable
- **Cross-Socialware causality**: TaskArena task completion triggers ResPool settlement, with clear causal relationships

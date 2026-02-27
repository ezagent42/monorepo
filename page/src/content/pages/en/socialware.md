---
title: "Socialware: Programmable Organization Logic"
description: "Socialware is the core concept of EZAgent — define your organization's roles, boundaries, commitments, and processes in code."
lang: en
order: 2
---

## What Is Socialware?

Imagine if your organization's operating rules — who can do what, how tasks flow, how approvals work — weren't written in wikis or scattered across Slack channels, but became executable code.

That's Socialware.

Socialware is a **code + Agent hybrid-driven** organizational software. It uses four concise primitives to describe any organizational behavior:

## Four Primitives

### Role
Defines the "capability envelope" of what can be done. An Identity (human or Agent) can hold multiple Roles, each describing a set of permissions and capabilities. Like "reviewer", "publisher", "admin" in a company — but precisely defined in code.

### Arena
Defines the "boundary" of where things happen. Arena determines the scope of a Socialware's influence — which Rooms, which data, which participants. Like department boundaries — but dynamically composable and nestable.

### Commitment
Defines the "obligation binding" of what must be done. When you claim a task, a Commitment forms between you and the task. It tracks progress, verifies delivery, handles violations. Like a contract — but automatically enforced by code.

### Flow
Defines the "state machine" of how things evolve. A task from "published" to "claimed" to "reviewed" to "completed" — each step's conditions and triggers are described by Flow. Like a workflow — but with branching, rollback, and auto-triggering.

## From Zero to One

Say you want to build a task management system:

1. Declare DataTypes: `ta_task` (task card), `ta_submission` (submission)
2. Declare Roles: `publisher`, `worker`, `reviewer`
3. Declare Flow: `open → claimed → submitted → in_review → approved`
4. Register Hook: auto-escalate when task times out

That's a complete TaskArena Socialware. No backend server needed, no database — all data syncs via CRDT between participants.

## The Power of Composition

The real power of Socialware lies in composition. TaskArena handles tasks, ResPool handles resources, EventWeaver records causal chains — each independent, yet freely composable.

Auto-settle GPU-hours after task completion? TaskArena's Flow triggers ResPool's billing. Dispute in review? Auto-create a branch in EventWeaver.

That's what "Organization as Code" means in practice.

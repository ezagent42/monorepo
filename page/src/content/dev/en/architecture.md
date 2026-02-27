---
title: "Three-Layer Fractal Architecture"
description: "The core of the EZAgent protocol: a fractal design with three layers of four primitives each."
lang: en
order: 1
sidebar_label: "Architecture"
---

## Design Philosophy

Core design principles of the EZAgent protocol:

- **Entity-agnostic**: The protocol layer doesn't distinguish humans from Agents — both share the same Identity model
- **Everything is a DataType**: All higher-level entities (Room, Message, Timeline) are composed from DataType declarations + Hooks + Annotations + Indexes
- **P2P-First**: Every node is self-sufficient, zero-configuration direct connection on LAN

## Three-Layer Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Socialware Layer (orthogonal dimensions on entities)     │
│                                                          │
│    Role          Arena         Commitment        Flow    │
│    capability    boundary      obligation      evolution │
├──────────────────────────────────────────────────────────┤
│  Mid-layer (entities composed from bottom primitives)     │
│                                                          │
│    Identity       Room          Message      Timeline    │
├──────────────────────────────────────────────────────────┤
│  Bottom (construction primitives)                         │
│                                                          │
│    DataType        Hook        Annotation       Index    │
└──────────────────────────────────────────────────────────┘
```

### Bottom Layer: Construction Primitives

Four irreducible primitives — all higher-level concepts are composed from them:

- **DataType**: CRDT data structure declaration — defines "what data is this"
- **Hook**: Three-phase interceptor (pre-send / after-write / after-read) — defines "what happens when data changes"
- **Annotation**: Metadata tagging — defines "data about data"
- **Index**: Query index — defines "how to find data"

### Mid-layer: Collaboration Entities

Compositions of bottom-layer primitives:

- **Identity**: Participant (human or Agent) = DataType(profile) + Hook(auth) + Annotation(role-bindings) + Index(lookup)
- **Room**: Collaboration space = DataType(metadata) + Hook(access-control) + Annotation(tags) + Index(search)
- **Message**: Content unit = DataType(body) + Hook(render-pipeline) + Annotation(reactions) + Index(timeline)
- **Timeline**: Timeline = DataType(entries) + Hook(ordering) + Annotation(bookmarks) + Index(cursor)

### Socialware Layer: Organization Logic

Four orthogonal dimensions applicable to any Mid-layer entity:

- **Role**: Capability envelope — an Identity gains specific capabilities when assigned a Role
- **Arena**: Boundary definition — a set of Rooms form a collaboration boundary when grouped as an Arena
- **Commitment**: Obligation binding — a Message becomes a trackable promise when it carries a Commitment
- **Flow**: Evolution pattern — a Timeline gains state transition rules when described by a Flow

### Fractal Property

Each layer has 4 primitives. A Socialware itself possesses an Identity (it's an Entity), so it can recursively be composed by higher-level Socialware. Organizations can be nested, composed, and split — just like code.

# Monorepo Initialization Design

Date: 2026-02-26

## Goal

Initialize the ezagent42 monorepo with 4 subtrees (specs, ezagent, relay, page), each with proper README and License files.

## Current State

| Sub-repo | Remote Status | Content |
|----------|--------------|---------|
| specs | Has content | README, LICENSE(CC0-1.0), plan/, products/, specs/, socialware/ |
| ezagent | Minimal | LICENSE (MIT only) |
| relay | Empty | No commits at all |
| page (ezagent.cloud) | Minimal | README.md only |

Monorepo currently has: .gitignore, claude.sh, MONOREPO.md (no subtrees yet).

## Target Structure

```
monorepo/
├── .github/workflows/sync-subtrees.yml
├── .gitignore
├── claude.sh
├── MONOREPO.md
├── specs/          ← subtree from specs.git (CC0-1.0)
├── ezagent/        ← subtree from ezagent.git (Apache 2.0)
├── relay/          ← subtree from relay.git (Apache 2.0)
└── page/           ← subtree from ezagent.cloud.git (Apache 2.0)
```

## License Strategy

| Directory | License | Action |
|-----------|---------|--------|
| specs/ | CC0-1.0 | Keep existing |
| ezagent/ | Apache 2.0 | Replace MIT → Apache 2.0 |
| relay/ | Apache 2.0 | Create new |
| page/ | Apache 2.0 | Create new |

## Execution Steps

### Step 0: Add remote aliases

Add 4 remotes: specs, ezagent, relay, page.

### Step 1: subtree add — specs

Direct import via `git subtree add --prefix=specs specs main --squash`. Content is complete.

### Step 2: subtree add — ezagent

Import via `git subtree add --prefix=ezagent ezagent main --squash`. Contains only MIT LICENSE.

### Step 3: Initialize relay remote (seed commit)

Relay repo is completely empty. Temporarily clone, push a seed commit (README + Apache 2.0 LICENSE), then `git subtree add --prefix=relay relay main --squash` in monorepo.

This is a one-time exception to the "never commit directly to sub-repos" rule.

### Step 4: subtree add — page

Import via `git subtree add --prefix=page page main --squash`. Contains only a simple README.

### Step 5: Unify Licenses and READMEs

In a single monorepo commit:
- Replace `ezagent/LICENSE` (MIT → Apache 2.0)
- Add `ezagent/README.md`
- Add `page/LICENSE` (Apache 2.0)
- Update `page/README.md`

### Step 6: Add CI workflow

Create `.github/workflows/sync-subtrees.yml` from MONOREPO.md template.

### Step 7: subtree push to sync sub-repos

Push updated content back to ezagent, relay, and page remotes. Specs unchanged, skip.

## Decisions

- **subtree with --squash**: Required per MONOREPO.md conventions, all operations must use --squash consistently.
- **relay seed approach**: Temporary direct push to empty relay repo, then subtree add. Accepted trade-off for initialization.
- **License unification**: All code repos use Apache 2.0, specs keeps CC0-1.0.

# Monorepo Initialization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Initialize the ezagent42 monorepo with 4 git subtrees (specs, ezagent, relay, page), unified licenses, and CI workflow.

**Architecture:** Use `git subtree add --squash` to import each sub-repo into the monorepo as a subdirectory. The monorepo is the single source of truth; sub-repos are read-only mirrors synced via `subtree push`. All `--squash` usage is mandatory per project conventions.

**Tech Stack:** Git subtree, GitHub Actions, Apache 2.0 / CC0-1.0 licenses

---

## Context for the Implementer

- **Working directory:** The monorepo root (contains .gitignore, claude.sh, MONOREPO.md)
- **Remote sub-repos:**
  - `specs` (git@github.com:ezagent42/specs.git) — has content (README, LICENSE, plan/, products/, specs/, socialware/)
  - `ezagent` (git@github.com:ezagent42/ezagent.git) — has only MIT LICENSE
  - `relay` (git@github.com:ezagent42/relay.git) — completely empty (no commits)
  - `page` (git@github.com:ezagent42/ezagent.cloud.git) — has only a simple README
- **Design doc:** `docs/plans/2026-02-26-monorepo-init-design.md`
- **MONOREPO.md:** Contains the CI workflow YAML template (lines 117-162)

---

### Task 1: Add Remote Aliases

**Files:** None (git config only)

**Step 1: Add all 4 remotes**

```bash
git remote add specs   git@github.com:ezagent42/specs.git
git remote add ezagent git@github.com:ezagent42/ezagent.git
git remote add relay   git@github.com:ezagent42/relay.git
git remote add page    git@github.com:ezagent42/ezagent.cloud.git
```

**Step 2: Verify remotes**

Run: `git remote -v`

Expected output should show 5 remotes (origin + 4 new ones):
```
ezagent	git@github.com:ezagent42/ezagent.git (fetch)
ezagent	git@github.com:ezagent42/ezagent.git (push)
origin	git@github.com:ezagent42/monorepo.git (fetch)
origin	git@github.com:ezagent42/monorepo.git (push)
page	git@github.com:ezagent42/ezagent.cloud.git (fetch)
page	git@github.com:ezagent42/ezagent.cloud.git (push)
relay	git@github.com:ezagent42/relay.git (fetch)
relay	git@github.com:ezagent42/relay.git (push)
specs	git@github.com:ezagent42/specs.git (fetch)
specs	git@github.com:ezagent42/specs.git (push)
```

No commit needed — this is local config.

---

### Task 2: Import specs via subtree add

**Files:** Creates `specs/` directory with all existing content from the specs repo

**Step 1: subtree add**

```bash
git subtree add --prefix=specs specs main --squash
```

Expected: Git fetches from specs remote and creates a merge commit that adds the `specs/` directory.

**Step 2: Verify import**

Run: `ls specs/`

Expected: `LICENSE  README.md  plan  products  socialware  specs`

Run: `head -3 specs/LICENSE`

Expected: Shows CC0 1.0 header.

No manual commit needed — `git subtree add` creates its own commit.

---

### Task 3: Import ezagent via subtree add

**Files:** Creates `ezagent/` directory with existing content from the ezagent repo

**Step 1: subtree add**

```bash
git subtree add --prefix=ezagent ezagent main --squash
```

Expected: Git fetches from ezagent remote and creates a merge commit. Only a LICENSE file will appear.

**Step 2: Verify import**

Run: `ls ezagent/`

Expected: `LICENSE`

Run: `head -1 ezagent/LICENSE`

Expected: `MIT License`

No manual commit needed.

---

### Task 4: Seed relay remote and import via subtree add

**Why:** The relay repo is completely empty (no commits). `git subtree add` requires at least one commit on the remote. We temporarily push a seed commit directly to the remote, then import it.

**Step 1: Create temp directory and initialize relay seed**

```bash
cd /tmp
git init relay-seed
cd relay-seed
```

**Step 2: Create README.md**

Write `README.md` with content:
```
# Relay

Relay service for EZAgent.
```

**Step 3: Create Apache 2.0 LICENSE**

Write the full Apache 2.0 LICENSE text to `LICENSE` (with `Copyright 2026 ezagent42`).

**Step 4: Commit and push seed to relay remote**

```bash
git add .
git commit -m "chore: initial seed (README + LICENSE)"
git remote add origin git@github.com:ezagent42/relay.git
git branch -M main
git push -u origin main
```

Expected: Push succeeds to the empty repo.

**Step 5: Return to monorepo and subtree add**

```bash
cd <monorepo-root>
git subtree add --prefix=relay relay main --squash
```

Expected: Git fetches relay and creates a merge commit adding `relay/` with README.md and LICENSE.

**Step 6: Clean up temp directory**

```bash
rm -rf /tmp/relay-seed
```

**Step 7: Verify import**

Run: `ls relay/`

Expected: `LICENSE  README.md`

No manual commit needed.

---

### Task 5: Import page via subtree add

**Files:** Creates `page/` directory with existing content from the page repo

**Step 1: subtree add**

```bash
git subtree add --prefix=page page main --squash
```

Expected: Git fetches from page remote and creates a merge commit. Only README.md will appear.

**Step 2: Verify import**

Run: `ls page/`

Expected: `README.md`

No manual commit needed.

---

### Task 6: Unify Licenses and READMEs

**Files:**
- Modify: `ezagent/LICENSE` (replace MIT → Apache 2.0)
- Create: `ezagent/README.md`
- Create: `page/LICENSE` (Apache 2.0)
- Modify: `page/README.md` (update content)

**Step 1: Replace ezagent/LICENSE with Apache 2.0**

Overwrite `ezagent/LICENSE` with the full Apache 2.0 text (Copyright 2026 ezagent42).

**Step 2: Create ezagent/README.md**

```markdown
# EZAgent

EZAgent core — the AI agent framework.
```

**Step 3: Create page/LICENSE with Apache 2.0**

Write the full Apache 2.0 text (Copyright 2026 ezagent42) to `page/LICENSE`.

**Step 4: Update page/README.md**

```markdown
# EZAgent.cloud

Official website for EZAgent.
```

**Step 5: Verify all licenses and READMEs**

Run:
```bash
head -1 specs/LICENSE        # → "Creative Commons Legal Code"
head -1 ezagent/LICENSE      # → should now show Apache 2.0 header
head -1 relay/LICENSE        # → should show Apache 2.0 header
head -1 page/LICENSE         # → should show Apache 2.0 header
cat ezagent/README.md        # → "# EZAgent" ...
cat relay/README.md          # → "# Relay" ...
cat page/README.md           # → "# EZAgent.cloud" ...
```

**Step 6: Commit**

```bash
git add ezagent/LICENSE ezagent/README.md page/LICENSE page/README.md
git commit -m "chore: unify licenses to Apache 2.0 and add READMEs"
```

---

### Task 7: Add GitHub Actions CI Workflow

**Files:**
- Create: `.github/workflows/sync-subtrees.yml`

**Step 1: Create workflow directory**

```bash
mkdir -p .github/workflows
```

**Step 2: Create sync-subtrees.yml**

Copy the workflow YAML from MONOREPO.md (lines 117-162). The content is:

```yaml
name: Sync Subtrees to Sub-repos

on:
  push:
    branches: [main]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout monorepo (full history)
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GH_TOKEN }}

      - name: Configure git
        run: |
          git config user.name  "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Add remotes
        run: |
          git remote add specs   https://x-token:${{ secrets.GH_TOKEN }}@github.com/ezagent42/specs
          git remote add ezagent https://x-token:${{ secrets.GH_TOKEN }}@github.com/ezagent42/ezagent
          git remote add relay   https://x-token:${{ secrets.GH_TOKEN }}@github.com/ezagent42/relay
          git remote add page    https://x-token:${{ secrets.GH_TOKEN }}@github.com/ezagent42/ezagent.cloud

      - name: Sync specs
        if: contains(github.event.head_commit.modified, 'specs/')
        run: git subtree push --prefix=specs specs main --squash

      - name: Sync ezagent
        if: contains(github.event.head_commit.modified, 'ezagent/')
        run: git subtree push --prefix=ezagent ezagent main --squash

      - name: Sync relay
        if: contains(github.event.head_commit.modified, 'relay/')
        run: git subtree push --prefix=relay relay main --squash

      - name: Sync page
        if: contains(github.event.head_commit.modified, 'page/')
        run: git subtree push --prefix=page page main --squash
```

**Step 3: Commit**

```bash
git add .github/workflows/sync-subtrees.yml
git commit -m "ci: add GitHub Actions workflow for subtree sync"
```

---

### Task 8: Commit the design and plan docs

**Files:**
- Already created: `docs/plans/2026-02-26-monorepo-init-design.md`
- Already created: `docs/plans/2026-02-26-monorepo-init.md`

**Step 1: Add and commit docs**

```bash
git add docs/
git commit -m "docs: add monorepo initialization design and plan"
```

---

### Task 9: Push monorepo and sync subtrees

**Step 1: Push monorepo to origin**

```bash
git push origin main
```

Expected: Push succeeds with all the new commits.

**Step 2: Sync ezagent to its sub-repo**

```bash
git subtree push --prefix=ezagent ezagent main --squash
```

Expected: Pushes the License change and new README to the ezagent remote.

**Step 3: Sync page to its sub-repo**

```bash
git subtree push --prefix=page page main --squash
```

Expected: Pushes the new LICENSE and updated README to the page remote.

**Step 4: Verify sub-repo state**

```bash
git ls-remote specs HEAD        # should show a commit hash
git ls-remote ezagent HEAD      # should show a commit hash
git ls-remote relay HEAD        # should show a commit hash
git ls-remote page HEAD         # should show a commit hash
```

All 4 should return commit hashes. Relay and specs were already handled (relay seeded in Task 4, specs imported in Task 2 and not modified).

---

## Verification Checklist

After all tasks complete, verify:

- [ ] `git remote -v` shows 5 remotes (origin, specs, ezagent, relay, page)
- [ ] `ls specs/` shows full content (README, LICENSE, plan/, products/, specs/, socialware/)
- [ ] `ls ezagent/` shows LICENSE (Apache 2.0) + README.md
- [ ] `ls relay/` shows LICENSE (Apache 2.0) + README.md
- [ ] `ls page/` shows LICENSE (Apache 2.0) + README.md
- [ ] `head -3 specs/LICENSE` shows CC0-1.0
- [ ] `head -1 ezagent/LICENSE` shows Apache 2.0
- [ ] `head -1 relay/LICENSE` shows Apache 2.0
- [ ] `head -1 page/LICENSE` shows Apache 2.0
- [ ] `.github/workflows/sync-subtrees.yml` exists
- [ ] `git log --oneline` shows subtree add commits + license/README commit + CI commit
- [ ] All 4 remotes have content (`git ls-remote <remote> HEAD` returns a hash)

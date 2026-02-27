# Monorepo 管理指南

本文件用于指导 agent 和用户管理 ezagent42 的 monorepo，包括日常开发流程、子仓库同步、以及常见问题处理。

---

## 仓库结构

```
monorepo/                         → 主开发仓库（唯一工作入口）
├── specs/                        → 产品规格与设计文档 (subtree, CC0-1.0)
├── ezagent/                      → EZAgent 核心代码 (subtree, Apache 2.0)
├── relay/                        → Relay 服务代码 (subtree, Apache 2.0)
├── page/                         → 官网/落地页代码 (subtree, Apache 2.0)
├── docs/plans/                   → 设计文档与实施计划
├── .claude/                      → Claude Code 项目配置（skills, plugins）
├── .github/workflows/            → CI/CD（subtree 自动同步）
└── MONOREPO.md                   → 本文件
```

### 仓库地址

| 仓库 | 用途 | URL |
|------|------|-----|
| **monorepo** | 主开发仓库（日常工作入口） | git@github.com:ezagent42/monorepo.git |
| **specs** | 产品规格（发布镜像） | git@github.com:ezagent42/specs.git |
| **ezagent** | EZAgent 核心（发布镜像） | git@github.com:ezagent42/ezagent.git |
| **relay** | Relay 服务（发布镜像） | git@github.com:ezagent42/relay.git |
| **page** | 官网（发布镜像） | git@github.com:ezagent42/ezagent.cloud.git |

> **核心原则**：所有开发工作只在 monorepo 进行，子仓库是单向的发布镜像，不在子仓库直接提交代码。

---

## 新成员设置

Subtree 内容已包含在 monorepo 中，克隆即可使用。只需添加 remote 别名以支持 subtree push/pull：

```bash
git clone git@github.com:ezagent42/monorepo.git
cd monorepo

# 添加 remote 别名
git remote add specs   git@github.com:ezagent42/specs.git
git remote add ezagent git@github.com:ezagent42/ezagent.git
git remote add relay   git@github.com:ezagent42/relay.git
git remote add page    git@github.com:ezagent42/ezagent.cloud.git

# 验证
git remote -v
```

<details>
<summary>初始化记录（首次设置，已完成）</summary>

以下命令仅在 2026-02-26 首次初始化时执行过，记录备查：

```bash
git subtree add --prefix=specs git@github.com:ezagent42/specs.git main --squash
git subtree add --prefix=ezagent git@github.com:ezagent42/ezagent.git main --squash
git subtree add --prefix=relay git@github.com:ezagent42/relay.git main --squash
git subtree add --prefix=page git@github.com:ezagent42/ezagent.cloud.git main --squash
```

详见 `docs/plans/2026-02-26-monorepo-init-design.md`。
</details>

---

## 日常开发流程

### 正常开发（在 monorepo 中）

日常开发与普通 Git 仓库完全一致，无需任何额外操作：

```bash
# 编辑文件
vim ezagent/src/main.ex

# 正常提交
git add ezagent/src/main.ex
git commit -m "feat(ezagent): add new agent routing logic"

# 推送 monorepo
git push origin main
```

### 同步到子仓库（发布镜像）

当需要将 monorepo 的更新推送到对应的独立子仓库时：

```bash
# 同步 specs
git subtree push --prefix=specs specs main

# 同步 ezagent
git subtree push --prefix=ezagent ezagent main

# 同步 relay
git subtree push --prefix=relay relay main

# 同步 page
git subtree push --prefix=page page main
```

> **注意**：`--squash` 用于 `subtree add` 和 `subtree pull`，是强制规范，不能混用。`subtree push` 不支持也不需要 `--squash` 参数。

---

## 自动化同步（GitHub Actions）

已配置 `.github/workflows/sync-subtrees.yml`，在 monorepo 的 `main` 分支有新 push 时自动同步对应子仓库。Workflow 内容如下（供参考）：

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
        # CI 环境使用 HTTPS + Token 推送，本地开发使用 SSH（见初始化章节）
        run: |
          git remote add specs   https://x-token:${{ secrets.GH_TOKEN }}@github.com/ezagent42/specs
          git remote add ezagent https://x-token:${{ secrets.GH_TOKEN }}@github.com/ezagent42/ezagent
          git remote add relay   https://x-token:${{ secrets.GH_TOKEN }}@github.com/ezagent42/relay
          git remote add page    https://x-token:${{ secrets.GH_TOKEN }}@github.com/ezagent42/ezagent.cloud

      - name: Sync specs
        if: contains(github.event.head_commit.modified, 'specs/')
        run: git subtree push --prefix=specs specs main

      - name: Sync ezagent
        if: contains(github.event.head_commit.modified, 'ezagent/')
        run: git subtree push --prefix=ezagent ezagent main

      - name: Sync relay
        if: contains(github.event.head_commit.modified, 'relay/')
        run: git subtree push --prefix=relay relay main

      - name: Sync page
        if: contains(github.event.head_commit.modified, 'page/')
        run: git subtree push --prefix=page page main
```

**配置要求**：
- GitHub → Settings → Secrets → Actions 中需配置 `GH_TOKEN`（Fine-grained PAT，对 4 个子仓库有 Contents 写权限）
- 已于 2026-02-27 配置完成并验证通过

---

## 分支策略

| 分支 | 用途 |
|------|------|
| `main` | 稳定主分支，子仓库同步来源 |
| `dev` | 日常开发分支，合并到 `main` 后再同步 |
| `feat/*` | 功能分支，在 `dev` 上开分支 |

推荐流程：

```
feat/xxx → dev → main → [自动同步到子仓库]
```

---

## 常用命令速查

```bash
# 查看所有 remote
git remote -v

# 同步单个子仓库（以 ezagent 为例）
git subtree push --prefix=ezagent ezagent main

# 从子仓库拉取更新到 monorepo（一般不需要，但紧急修复时使用）
git subtree pull --prefix=ezagent ezagent main --squash

# 查看某个目录的提交历史
git log --oneline -- ezagent/

# 完整克隆 monorepo（普通 clone 即可，无需 --recurse-submodules）
git clone git@github.com:ezagent42/monorepo.git
```

---

## 注意事项

1. **永远不要在子仓库直接提交**。子仓库是只读的发布镜像，所有修改必须通过 monorepo → subtree push 的方式同步。如果紧急情况在子仓库直接修改，需立即用 `git subtree pull` 将变更拉回 monorepo，否则下次 push 时会产生冲突。

2. **`--squash` 规则**：`subtree add` 和 `subtree pull` 必须加 `--squash`（初始化时选择的模式，不能混用）。`subtree push` 不支持也不需要 `--squash`。

3. **subtree push 较慢是正常现象**。Git 需要遍历历史来提取子目录的变更，历史越长越慢。推荐通过 CI 自动化来避免手动等待。

4. **fetch-depth: 0 是 CI 必要配置**。GitHub Actions 默认只拉取浅历史（shallow clone），`git subtree` 需要完整历史才能工作，务必设置 `fetch-depth: 0`。

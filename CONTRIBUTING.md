# Contributing to EZAgent42

## Commit 规范

格式：`type(scope): description`

### Type

| type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档变更 |
| `refactor` | 重构（不改变行为） |
| `test` | 测试相关 |
| `chore` | 构建、依赖、配置等杂项 |
| `ci` | CI/CD 变更 |

### Scope（可选）

使用子项目名：`ezagent`, `relay`, `page`, `docs`, `app`

### 示例

```
feat(ezagent): add agent routing logic
fix(relay): handle websocket reconnection
docs(docs): update protocol specification
ci: improve subtree sync workflow
chore: update dependencies
```

## 分支策略

```
feat/xxx → dev → main → [CI 自动同步到子仓库]
```

| 分支 | 用途 |
|------|------|
| `main` | 稳定主分支，子仓库同步来源 |
| `dev` | 日常开发分支 |
| `feat/*` | 功能分支，从 `dev` 开出 |

## Pull Request

1. 从 `dev` 创建功能分支：`feat/my-feature`
2. 开发完成后提交 PR 到 `dev`
3. PR 标题遵循 Commit 规范格式
4. 合并到 `main` 后 CI 自动同步子仓库

## 工具约束

本项目统一使用以下工具，**禁止使用**对应的替代品。CI 和 Claude Code PreToolUse hook 会强制执行。

### Python: 使用 uv（禁止 pip）

| 禁止 | 使用 |
|------|------|
| `pip install foo` | `uv pip install foo` |
| `pip uninstall foo` | `uv pip uninstall foo` |
| `pip freeze` | `uv pip freeze` |
| `pip install -r requirements.txt` | `uv pip install -r requirements.txt` |
| `python -m pip ...` | `uv pip ...` |

### JavaScript: 使用 pnpm（禁止 npm/npx）

| 禁止 | 使用 |
|------|------|
| `npm install` | `pnpm install` |
| `npm install foo` | `pnpm add foo` |
| `npm run dev` | `pnpm run dev` |
| `npm init` | `pnpm create` |
| `npm ci` | `pnpm install --frozen-lockfile` |
| `npx foo` | `pnpm dlx foo`（一次性）或 `pnpm exec foo`（本地） |

### Rust: cargo（无约束）

Rust 生态工具链统一，无需额外限制。直接使用 `cargo`。

## 重要注意

- **所有开发只在 monorepo 进行**，不要直接向子仓库提交
- subtree 操作规范详见 **MONOREPO.md**

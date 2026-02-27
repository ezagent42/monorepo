# CLAUDE.md — page（官网 ezagent.cloud）

EZAgent 官方网站 — 品牌门户与开发者社区入口。License: Apache 2.0。

## 定位与边界

- **两大受众**：一般用户（产品介绍、愿景传达）和 Socialware 开发者（技术社区、开发入门）
- **官网是品牌门户，不是文档站**。完整的协议规范、Bus spec、Extensions spec、Python SDK API 参考、HTTP API 参考、CLI 参考均由 ReadTheDocs 承载，官网仅提供跳转链接
- 产品描述与 `docs/README.md` 保持一致

## 技术栈

| 技术 | 用途 |
|------|------|
| Astro | 静态站点框架（content collections + islands） |
| Markdown | 内容编写（Astro Content Collections） |
| CSS Custom Properties | Eastern Clarity v1 设计 token（`docs/style/style-guide.md`） |
| Phosphor Icons | 图标系统 |
| GitHub Pages | 部署（`ezagent.cloud`） |
| pnpm | 包管理（**禁止 npm/npx**） |
| GitHub Actions | CI/CD |

## 站点架构

### 双受众路由设计

**一般用户部分：**

| 路由 | 页面 | 内容来源 |
|------|------|----------|
| `/` | Landing / Hero | 原创（灵感来自 `docs/README.md` 对比场景） |
| `/vision/` | "未来组织"理念 | 改编自 `docs/README.md` 核心理念章节 |
| `/socialware/` | Socialware 概念（通俗版） | 简化自 `docs/specs/socialware-spec.md` §0-§1 |
| `/download/` | 下载与快速开始 | 来自 `docs/products/app-prd.md` §1.3 交付格式 |
| `/showcase/` | Socialware 展示廊 | 摘要自 `docs/socialware/*.md` |

**开发者部分：**

| 路由 | 页面 | 内容来源 |
|------|------|----------|
| `/dev/` | 开发者入口 | 改编自 `docs/README.md` 架构部分 |
| `/dev/architecture/` | 三层分形架构详解 | 来自 `docs/specs/protocol.md` §0-§1 |
| `/dev/socialware-guide/` | Socialware 开发入门 | 改编自 `docs/specs/socialware-spec.md` + `py-spec.md` |
| `/dev/showcase/` | Socialware 开发者展示（含代码） | 来自 `docs/socialware/*.md` + 代码示例 |
| `/dev/resources/` | 资源链接（ReadTheDocs、GitHub、社区） | 链接聚合页 |

**公共页面：** `/about/`、`/blog/`（预留）、`/404`

### 双受众导航分叉

Landing page 提供两条清晰路径：

1. **"了解 EZAgent"** → vision / socialware 概念 / download（一般用户）
2. **"开始构建"** → architecture / socialware guide / showcase（开发者）

### i18n 策略

- Astro 内置 i18n 路由，`/{lang}/` 前缀
- 默认语言：`zh`；支持语言：`zh`、`en`
- UI 字符串：`src/i18n/{lang}.json`
- 技术术语不翻译（CRDT、Hook、DataType、Room、Identity 等）

## 目录结构

```
page/
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── src/
│   ├── content/
│   │   ├── content.config.ts    # Collection schemas
│   │   ├── pages/{lang}/        # 静态页面 Markdown
│   │   ├── showcase/{lang}/     # Socialware 展示条目
│   │   ├── dev/{lang}/          # 开发者内容
│   │   └── blog/{lang}/         # 博客（预留）
│   ├── layouts/
│   │   ├── BaseLayout.astro     # HTML shell, fonts, meta
│   │   ├── PageLayout.astro     # 标准页面（nav + footer）
│   │   └── DevLayout.astro      # 开发者区（侧边栏导航）
│   ├── components/
│   │   ├── Nav.astro            # 顶部导航
│   │   ├── Footer.astro
│   │   ├── Hero.astro           # Landing hero
│   │   ├── ArchDiagram.astro    # 三层架构图
│   │   ├── ShowcaseCard.astro
│   │   ├── DownloadCard.astro
│   │   ├── LangSwitch.astro
│   │   ├── ThemeToggle.astro
│   │   └── CodeBlock.astro
│   ├── pages/
│   │   ├── index.astro          # → /{defaultLocale}/
│   │   └── [lang]/              # 动态语言路由
│   │       ├── index.astro
│   │       ├── vision.astro
│   │       ├── socialware.astro
│   │       ├── download.astro
│   │       ├── showcase/
│   │       ├── dev/
│   │       ├── about.astro
│   │       └── blog/
│   ├── i18n/
│   │   ├── zh.json
│   │   └── en.json
│   └── styles/
│       ├── tokens.css           # Eastern Clarity v1 CSS 变量
│       ├── global.css
│       ├── dark.css
│       └── code.css
├── public/
│   ├── favicon.svg
│   ├── ezagent-logo.svg         # 来自 docs/style/
│   ├── pattern-bg.jpg           # 来自 docs/style/
│   ├── og-image.png
│   └── CNAME                    # ezagent.cloud
├── CLAUDE.md
├── README.md
└── LICENSE
```

## 内容策略

### Content Collections Schema

定义三个集合，各含 frontmatter schema：

- **`pages`** — 静态页面（title, description, lang, order）
- **`showcase`** — Socialware 展示条目（title, description, lang, icon, tags）
- **`dev`** — 开发者内容（title, description, lang, order, sidebar_label）

### 内容来源映射

| 官网页面 | 来源文件 | 改编说明 |
|----------|----------|----------|
| Landing Hero | `docs/README.md` 对比场景表 | 精简为 3-4 句 + CTA 按钮 |
| Vision | `docs/README.md` 核心理念 | 面向非技术用户重写，去掉代码 |
| Socialware 概念 | `docs/specs/socialware-spec.md` §0-§1 | 用类比解释，不涉及 spec 细节 |
| Download | `docs/products/app-prd.md` §1.3 | 卡片式：Desktop / CLI / Web |
| Showcase: EventWeaver | `docs/socialware/eventweaver-prd.md` §1 | 1 段摘要 + 核心价值点 |
| Showcase: TaskArena | `docs/socialware/taskarena-prd.md` §1 | 同上 |
| Showcase: ResPool | `docs/socialware/respool-prd.md` §1 | 同上 |
| Showcase: AgentForge | `docs/socialware/agentforge-prd.md` §1 | 同上 |
| Dev: Architecture | `docs/specs/protocol.md` §0-§1 | 保留三层图，简洁解释每层 |
| Dev: Socialware Guide | `docs/specs/socialware-spec.md` + `py-spec.md` | 展示 `@socialware` 装饰器，链接 ReadTheDocs |
| Dev: Showcase | `docs/socialware/*.md` + 代码示例 | 含 Python 代码片段 |
| Dev: Resources | 所有文档 + 外部链接 | 策展链接列表 |

### 不在官网承载的内容（→ ReadTheDocs）

> 完整的协议规范、Bus spec、Extensions spec、Python SDK API 参考、HTTP API 参考、CLI 参考。官网仅提供跳转链接。

## 设计系统集成（Eastern Clarity v1）

参考文件：**`docs/style/style-guide.md`**

- **`tokens.css`**：从 style guide §15 提取完整 CSS 变量（`:root` 块）
- **Dark mode**：`html[data-theme="dark"]` + `<head>` 内联脚本防 FOUC
  - 优先级：用户手动 > 系统偏好 > 默认 light
  - `data-theme` 存 `localStorage`
- **字体**：DM Sans + Noto Sans SC + Noto Serif SC + JetBrains Mono（Google Fonts）
- **颜色**：60-30-10 分配规则（Ink/White/Warm Gray/Accent）
- **图标**：Phosphor Icons（thin 导航 / duotone 功能）
- **Logo**：`docs/style/ezagent-logo.svg` → `public/`（`fill="currentColor"`）
- **背景**：`docs/style/pattern-bg.jpg` → `public/`（仅 hero/footer，light ≤6% / dark ≤3% opacity）

### 关键设计 Token 速查

```
核心色板: --ink #2c3340 | --bg #ffffff | --bg-alt #f7f7f5
Accent:   --vermillion #c94040 (CTA) | --celadon #6b8fa5 (链接) | --gold #c9a55a (装饰)
状态色:   --pine #4a6b5a (成功) | --amber #d4a04b (警告) | --smoke #787774 (辅助文字)
字体:     --font-display / --font-body: DM Sans + Noto Sans SC
          --font-code: JetBrains Mono | --font-brand: Noto Serif SC (仅 hero)
```

> 天青 Celadon (`#6b8fa5`) 对比度不足 4.5:1，仅可用于 ≥18px bold 文字。小字场景改用深天 Deep Sky (`#4a6e82`)。

## 部署配置

- **Astro config**：`site: 'https://ezagent.cloud'`、`output: 'static'`、i18n 路由配置
- **GitHub Actions**：`.github/workflows/deploy-page.yml`
  - 触发条件：`push main paths: page/**`
  - 使用 `withastro/action@v5` + `pnpm`
- **`public/CNAME`**：保持 `ezagent.cloud` 自定义域名

## 开发指南

### 前置要求

- Node.js >= 18
- pnpm >= 8（**禁止 npm/npx**）

### 常用命令

```bash
pnpm install          # 安装依赖
pnpm run dev          # 开发服务器
pnpm run build        # 生产构建
pnpm run preview      # 预览构建结果
```

### 新增页面流程

1. 在 `src/content/pages/{lang}/` 创建 zh 和 en 双语 Markdown
2. 在 `src/pages/[lang]/` 创建对应的 `.astro` 页面文件
3. 更新 `Nav.astro` 导航链接
4. 更新 `src/i18n/zh.json` 和 `en.json` 的 UI 字符串

> 所有面向用户的文字放 Markdown 内容文件或 i18n JSON，不硬编码在 `.astro` 组件中。

### 推荐构建顺序

1. Scaffold Astro 项目（`pnpm create astro@latest`）
2. 创建 `tokens.css` + `global.css` + dark mode
3. BaseLayout / Nav / Footer / LangSwitch / ThemeToggle
4. Landing page（Hero + 双路径导航）
5. 一般用户页面（vision / socialware / download / showcase）
6. 开发者页面（architecture / socialware-guide / dev-showcase / resources）
7. GitHub Actions 部署工作流
8. 双语内容编写（zh 为主，en 翻译）

## 内容规范

- **一般用户语调**：亲切、愿景导向，强调"易用"和"未来组织"，避免术语
- **开发者语调**：技术但精简，展示代码，链接 ReadTheDocs 获取深度内容
- **品牌声音**：`docs/README.md` 结尾 —— "未来的组织不是一张架构图。它是一段可以运行的程序。"
- 中文为主，技术术语保留英文

## 验证清单

1. `pnpm run build` 无错误
2. `pnpm run preview` 可访问所有路由
3. 中英文切换正常
4. Dark mode 切换正常，无 FOUC
5. 所有 ReadTheDocs 外链可配置（暂可用 placeholder）
6. 移动端响应式布局正常

## Commit 规范

```
feat(page): add hero section
fix(page): fix responsive layout on mobile
docs(page): update download links
```

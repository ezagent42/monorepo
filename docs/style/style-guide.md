# Eastern Clarity v1 — EZAgent42 Design System Style Guide

> 纯白 + 暖灰底色，墨色文字搭配三色 accent（朱印/天青/琉璃金）。
> 东方意韵仅体现在色板命名，视觉上是简约现代的 SaaS 风格。

---

## 1. 配色 Color Palette

### 核心色板

| 名称 | Token | Hex | 用途 |
|------|-------|-----|------|
| 墨色 Ink | `--ink` | `#2c3340` | Primary text, headings, dark bg |
| 淡墨 Light Ink | `--ink-light` | `#3d4a5c` | Body text, secondary content |
| 素纸 White | `--bg` | `#ffffff` | Card surfaces, primary bg |
| 暖灰 Warm Gray | `--bg-alt` | `#f7f7f5` | Page bg, alt surface, L2 nesting |
| 朱印 Vermillion | `--vermillion` | `#c94040` | CTA, error, destructive actions |
| 天青 Celadon | `--celadon` | `#6b8fa5` | Links, info, bold text ≥18px only |
| 琉璃金 Gold | `--gold` | `#c9a55a` | Premium, pending, decorative |
| 烟墨 Smoke | `--smoke` | `#787774` | Helper text, placeholder |
| 云白 Border | `--border` | `#e3e2de` | Dividers, card borders |
| 云白 Border Light | `--border-light` | `#f1f1ef` | Subtle inner dividers |
| 松绿 Pine | `--pine` | `#4a6b5a` | Success states |
| 晨琥珀 Amber | `--amber` | `#d4a04b` | Warning states |
| 深天 Deep Sky | `--deep-sky` | `#4a6e82` | Celadon hover, small text fallback |
| 雾色 Mist | `--mist` | `#c5bfb3` | Decorative, disabled borders |

### 反色表面（始终深色，不随主题翻转）

| Token | Hex | 用途 |
|-------|-----|------|
| `--surface-inv` | `#2c3340` | Code blocks, dark sections |
| `--surface-inv-text` | `#d5d2ca` | Text on inverted surfaces |

### 配色比例 60-30-10

```
60%  素纸 White (#ffffff)       — 主背景/卡片
20%  墨色 Ink (#2c3340)         — 文字/深色区域
10%  烟墨 Smoke (#787774)       — 辅助文字/中性
 5%  朱印 Vermillion (#c94040)  — 品牌 accent / CTA
 3%  天青 Celadon (#6b8fa5)     — 信息/链接
 2%  琉璃金 Gold (#c9a55a)      — 装饰/高级
```

### Badge 语义色背景

| Badge | 背景色（Light） | 背景色（Dark） | 文字色 |
|-------|----------------|---------------|--------|
| Red | `rgba(201,64,64,0.08)` | `rgba(201,64,64,0.15)` | `--vermillion` |
| Blue | `rgba(107,143,165,0.08)` | `rgba(107,143,165,0.15)` | `--celadon` |
| Gold | `rgba(201,165,90,0.08)` | `rgba(201,165,90,0.15)` | `--gold` |
| Green | `rgba(74,107,90,0.08)` | `rgba(74,107,90,0.15)` | `--pine` |
| Gray | `--bg-alt` | `rgba(255,255,255,0.08)` | `--smoke` |

---

## 2. 字体 Typography

### 字体栈

| Token | 字体 | 用途 |
|-------|------|------|
| `--font-display` | `'DM Sans', 'Noto Sans SC', sans-serif` | Display headings, H1-H3 |
| `--font-body` | `'DM Sans', 'Noto Sans SC', sans-serif` | Body text, UI labels |
| `--font-code` | `'JetBrains Mono', 'SF Mono', 'Fira Code', Consolas, monospace` | Code blocks, inline code, tokens |
| `--font-brand` | `'Noto Serif SC', serif` | **仅限**品牌/营销大标题 |

### Google Fonts 加载

```html
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Noto+Sans+SC:wght@300;400;500;600;700&family=Noto+Serif+SC:wght@400;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

### 字号层级

| 层级 | 字号 | 字重 | 字距 | 行高 | 说明 |
|------|------|------|------|------|------|
| Display | 36–48px | 700 | -0.02em | 1.2–1.4 | EN: DM Sans Bold / CN: Noto Sans SC Bold |
| H1 | 24–28px | 700 | -0.01em | 1.3–1.5 | DM Sans Bold / Noto Sans SC SemiBold |
| Body | 15–16px | 400 | — | CN 1.9 / EN 1.8 | Noto Sans SC Regular / DM Sans Regular |
| Code | 14–15px | 400 | — | 2.0 | JetBrains Mono |
| Brand | 28px+ | 700 | 0.05em | — | Noto Serif SC Bold，仅 landing page hero/封面 |

### 代码语法高亮

| 元素 | 颜色 | Token |
|------|------|-------|
| 关键字 (kw) | 天青 | `#6b8fa5` |
| 函数名 (fn) | 琉璃金 | `#c9a55a` |
| 字符串 (st) | 松绿 | `#8aad7e` |
| 数字 (nr) | 朱印 | `#c94040` |
| 运算符 (op) | 灰 | `#8c9196` |
| 注释 (cm) | 暗灰 | `#5e6e7e` |

### Inline Code 样式

```css
code.inline {
  font-family: var(--font-code);
  font-size: 0.82em;
  background: var(--bg-alt);
  border: 1px solid var(--border);
  padding: 1px 5px;
  border-radius: 3px;
}
```

---

## 3. 间距 Spacing

4px base grid，Tailwind-style token 命名。

| Token | Value | 用途 |
|-------|-------|------|
| `--sp-1` | 4px | Tight gaps |
| `--sp-2` | 8px | Icon gaps, inline spacing |
| `--sp-3` | 12px | Card padding (compact) |
| `--sp-4` | 16px | Standard padding |
| `--sp-6` | 24px | Component padding |
| `--sp-8` | 32px | Section inner padding |
| `--sp-12` | 48px | Section gaps |
| `--sp-16` | 64px | Major section separation |
| `--sp-24` | 96px | Top-level section separation |

### 留白原则

- **留白即呼吸** — 外围 margin ≥ 48px，section 间 64–96px
- **卡片化承载** — 白色卡片在 `#f7f7f5` 灰底上，shadow-md，radius 8–12px
- **不对称平衡** — 主内容 60–65%，呼吸空间 35–40%
- **竖向节奏** — 4px base grid，段落间 24px，section 间 64–96px
- **彩色标识条** — 卡片 `border-left: 3px` 用语义色区分

---

## 4. 圆角 & 阴影

### Border Radius

| Token | Value | 用途 |
|-------|-------|------|
| `--radius-sm` | 4px | Buttons, inline code, badges |
| `--radius-md` | 8px | Cards, inputs, dropdowns |
| `--radius-lg` | 12px | Modals, sheets, large cards |

### Box Shadow

| Token | Value | 用途 |
|-------|-------|------|
| `--shadow-sm` | `0 1px 2px rgba(44,51,64,0.04)` | Subtle depth (swatches) |
| `--shadow-md` | `0 2px 8px rgba(44,51,64,0.06)` | Cards, elevated elements |
| `--shadow-lg` | `0 8px 24px rgba(44,51,64,0.08)` | Modals, hero images |
| `--shadow-L1` | `0 2px 8px rgba(44,51,64,0.06)` | L1 嵌套卡片 |
| `--shadow-L2` | `0 1px 3px rgba(44,51,64,0.04)` | L2 嵌套区块 |

---

## 5. 嵌套层级 Nesting Hierarchy

白 ↔ 灰交替 + 递减阴影 + 彩色边条，最多 3 层，超过用折叠/导航。

| 层级 | 背景 | 效果 | 示例 |
|------|------|------|------|
| L0 Page | `#f7f7f5` | 2px dashed border | 页面底色 |
| L1 Card | `#ffffff` | `shadow-L1` | Room card, 主内容区 |
| L2 Block | `#f7f7f5` | 1px solid border | Tab panel, 嵌套区块 |
| L3 Item | `#ffffff` | `border-left: 3px solid [语义色]` | Message card, Alert |

---

## 6. 图标 Icons

使用 **Phosphor Icons**，按语义角色分配 weight。

### 引入方式

```html
<script src="https://unpkg.com/@phosphor-icons/web@2.1.1"></script>
```

### Weight 分配规则

| 角色 | Weight | Color | 场景 |
|------|--------|-------|------|
| 导航/结构 | `thin` | `--ink` / `--smoke` | 侧边栏, Tab 栏, 面包屑, toolbar |
| 状态/通知 | `duotone` | 语义色（朱印/天青/琉璃金/松绿） | 卡片 status, Toast, Badge |
| 按钮内 | `thin` | 继承按钮文字色 | CTA, secondary btn |
| Feature 展示 | `duotone` | 品牌色（天青/琉璃金） | Feature section, landing page |
| Hero / ≥32px | `thin` | `--ink` | 大尺寸展示性用途 |
| Dark mode | 同上规则 | white@85% / 语义色不变 | — |

### EZAgent 概念图标映射

| 概念 | 图标 | Class |
|------|------|-------|
| Room | `squares-four` | `ph-thin ph-squares-four` |
| Identity | `user` | `ph-thin ph-user` |
| Message | `chat-circle` | `ph-thin ph-chat-circle` |
| Timeline | `clock` | `ph-thin ph-clock` |
| Flow | `git-branch` | `ph-thin ph-git-branch` |
| Hook | `webhooks-logo` | `ph-thin ph-webhooks-logo` |
| Annotation | `tag` | `ph-thin ph-tag` |
| Index | `magnifying-glass` | `ph-thin ph-magnifying-glass` |
| Role | `shield` | `ph-thin ph-shield` |
| Arena | `cube` | `ph-thin ph-cube` |
| Commitment | `handshake` | `ph-thin ph-handshake` |
| DataType | `database` | `ph-thin ph-database` |

---

## 7. 按钮 Buttons

### 样式变体

| 变体 | 背景 | 文字 | 边框 | 用途 |
|------|------|------|------|------|
| Primary (ink) | `--surface-inv` | `#fff` | none | 主操作 CTA |
| Ghost | `--bg` | `--ink` | `1px solid --border` | 次要操作 |
| Danger | `rgba(201,64,64,0.06)` | `--vermillion` | `1px solid rgba(201,64,64,0.15)` | 危险操作 |

### 按钮规格

```css
.btn {
  padding: 8px 18px;
  border-radius: var(--radius-sm);  /* 4px */
  font-family: var(--font-body);
  font-size: 0.82rem;
  font-weight: 500;
  line-height: 1;
  /* 图标 gap: 5px, icon size: 15px */
}
```

### Dark Mode 按钮

- Primary: 背景改用 `--celadon`，文字白
- Ghost: `--bg` 背景，`--border` 边框
- Danger: 背景 `rgba(201,64,64,0.15)`，边框 `rgba(201,64,64,0.25)`

---

## 8. 动效 Motion

> 原则："感知到但不注意到"——快速、克制、有目的。

### Easing Curves

| Token | Value | 用途 |
|-------|-------|------|
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | 元素进入/出现（fade in, slide in, scale up） |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | 位移/变形（sidebar expand, panel resize） |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 强调/弹性（toast bounce, button press） |

### Duration 梯度

| Token | Value | 用途 |
|-------|-------|------|
| `--dur-instant` | 75ms | 状态切换（checkbox, toggle, color change） |
| `--dur-fast` | 150ms | Hover/focus 反馈、tooltip、小元素 fade |
| `--dur-normal` | 200ms | Dropdown 展开、卡片 hover lift |
| `--dur-slow` | 300ms | Modal/Sheet 进出、侧边栏展开/收起 |
| `--dur-page` | 500ms | 页面级过渡、大面积布局变化 |

### 动效模式 Patterns

| Pattern | 配方 | 场景 |
|---------|------|------|
| Fade In | `opacity 0→1, dur-fast, ease-out` | Toast, Tooltip, Dropdown |
| Slide Up | `translateY(8px→0) + fade, dur-normal, ease-out` | 卡片入场，列表 stagger (50ms/item) |
| Scale In | `scale(0.95→1) + fade, dur-normal, ease-out` | Modal, Popover, Context menu |
| Slide Right | `translateX(-100%→0), dur-slow, ease-in-out` | 侧边栏展开、Sheet 入场 |
| Hover Lift | `translateY(-2px) + shadow-lg, dur-fast, ease-out` | 可交互卡片 hover |
| Press | `scale(0.97), dur-instant, ease-spring` | Button :active |
| Skeleton Pulse | `opacity 0.4↔0.7, 1.5s infinite, ease-in-out` | 骨架屏加载态 |
| Stagger | `Slide Up × n, delay: n × 50ms, max 5` | 列表/网格批量入场 |

### Reduce Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 9. 响应式断点 Breakpoints

Mobile-first，与 Tailwind 默认值对齐。

| Token | Min-width | Container | Columns | Gutter | Padding |
|-------|-----------|-----------|---------|--------|---------|
| `sm` | 0 | 100% | 4 | 16px | 16px |
| `md` | 640px | 100% | 8 | 24px | 24px |
| `lg` | 768px | 100% | 12 | 24px | 32px |
| `xl` | 1024px | 1080px | 12 | 24px | auto |
| `2xl` | 1280px | 1080px | 12 | 24px | auto |

### 布局行为规则

| 元素 | sm (手机) | md (平板竖) | lg (平板横) | xl+ (桌面) |
|------|----------|------------|------------|-----------|
| 侧边栏 | Drawer 呼出 | Drawer 呼出 | 收起态 64px | 展开态 240px |
| 内容网格 | 单栏 | 双栏 | 双栏 | 三栏 |
| Section 间距 | 48px | 64px | 64px | 96px |
| 卡片网格 | 单栏 | 2 列 | 2 列 | 3 列 |

---

## 10. 移动端基础适配 Mobile Foundations

### Touch Target 最小尺寸

遵循 WCAG 2.2 / Apple HIG：**所有可交互元素点击区域 ≥ 44×44px**。

| 元素 | 视觉尺寸 | 点击区域 | 实现 |
|------|---------|---------|------|
| Button | 36px height | 44×44px | padding 扩展 |
| Icon Button | 32×32px | 44×44px | `::after` 伪元素 |
| List Item | 44px height | 全行可点击 | `padding: 10px 16px` |
| 链接间距 | — | 上下 ≥ 8px | margin/padding |

### 移动端字号调整

移动端 (sm) 相对桌面整体缩小一档，body text 不变。最小字号**不低于 12px**。

| 层级 | Desktop | Mobile | 差异 |
|------|---------|--------|------|
| Display | 36–48px | 28–36px | -20% |
| H1 | 24–28px | 22–24px | -12% |
| Body | 15–16px | 15–16px | **不变** |
| Caption | 12–13px | 12px | 下限 |

```css
.display { font-size: clamp(1.75rem, 4vw, 3rem); }
.h1      { font-size: clamp(1.375rem, 2.5vw, 1.75rem); }
.body    { font-size: 0.9375rem; }  /* 15px 固定 */
```

### Safe Area 适配

```css
.bottom-fixed {
  padding-bottom: calc(var(--sp-3) + env(safe-area-inset-bottom));
}
```

```html
<meta name="viewport" content="..., viewport-fit=cover">
```

---

## 11. Focus & Accessibility

### Focus Ring

使用 `:focus-visible` — 仅键盘导航显示。颜色统一**天青 celadon**，2px 宽度，2px offset。

```css
:focus-visible {
  outline: 2px solid var(--celadon);
  outline-offset: 2px;
}
input:focus-visible, textarea:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--celadon);
  border-color: var(--celadon);
}
```

### 交互状态

| 状态 | 视觉变化 | Transition |
|------|---------|-----------|
| Default | 基础样式 | — |
| Hover | 背景色加深 / `translateY(-2px)` | `dur-fast`, `ease-out` |
| Focus-visible | 天青 outline 2px, offset 2px | `dur-instant` |
| Active | `scale(0.97)` / 背景进一步加深 | `dur-instant`, `ease-spring` |
| Disabled | `opacity: 0.4` / `cursor: not-allowed` | — |
| Loading | `opacity: 0.7` / spinner / `cursor: wait` | — |

### WCAG 2.1 AA 对比度

| 组合 | 对比度 | 结果 |
|------|-------|------|
| Ink `#2c3340` on White | 12.5:1 | AAA |
| Light Ink `#3d4a5c` on White | 8.2:1 | AAA |
| Smoke `#787774` on White | 4.6:1 | AA |
| Vermillion `#c94040` on White | 4.6:1 | AA |
| Celadon `#6b8fa5` on White | 3.6:1 | ≥18px bold only |
| Deep Sky `#4a6e82` on White | 5.1:1 | AA — celadon 小字替代 |
| White on Ink `#2c3340` | 12.5:1 | AAA |

> **重要**：天青 Celadon (`#6b8fa5`) 对比度不足 4.5:1，仅可用于 ≥18px bold 文字。小字场景改用深天 Deep Sky (`#4a6e82`)。

---

## 12. Z-index 层叠体系

| Token | Value | 用途 |
|-------|-------|------|
| `--z-base` | 0 | 常规页面内容 |
| `--z-sticky` | 100 | Sticky 顶栏, 侧边栏, Tab Bar |
| `--z-dropdown` | 200 | Dropdown, Popover, Tooltip |
| `--z-overlay` | 300 | Modal/Sheet 背景蒙层 |
| `--z-modal` | 400 | Modal/Dialog 内容 |
| `--z-toast` | 500 | Toast, Snackbar（最顶层） |

---

## 13. Dark Mode

### 切换机制

- 通过 `html[data-theme="dark"]` 切换 CSS custom properties
- 优先级：**用户手动 > 系统偏好 > 默认 light**
- `data-theme` 存 `localStorage`，`<head>` 内联 script 提前设置避免 FOUC
- 切换动画用 `dur-slow` (300ms)

```css
@media (prefers-color-scheme: dark) {
  html:not([data-theme="light"]) { /* dark tokens */ }
}
```

### 中性色映射

| Token | Light | Dark |
|-------|-------|------|
| `--ink` | `#2c3340` | `#ededeb` |
| `--ink-light` | `#3d4a5c` | `rgba(255,255,255,0.75)` |
| `--bg` | `#ffffff` | `#1e2128` |
| `--bg-alt` | `#f7f7f5` | `#15181e` |
| `--border` | `#e3e2de` | `rgba(255,255,255,0.12)` |
| `--border-light` | `#f1f1ef` | `rgba(255,255,255,0.07)` |
| `--smoke` | `#787774` | `rgba(255,255,255,0.52)` |
| `--mist` | `#c5bfb3` | `rgba(255,255,255,0.18)` |

### 语义色（Dark 下不变）

| Token | Light | Dark |
|-------|-------|------|
| `--vermillion` | `#c94040` | `#c94040`（不变） |
| `--celadon` | `#6b8fa5` | `#6b8fa5`（不变） |
| `--gold` | `#c9a55a` | `#c9a55a`（不变） |
| `--pine` | `#4a6b5a` | `#4a6b5a`（不变） |
| `--amber` | `#d4a04b` | `#d4a04b`（不变） |

### Shadow 映射

| Token | Light | Dark |
|-------|-------|------|
| `--shadow-sm` | `0 1px 2px rgba(44,51,64,0.04)` | `0 1px 3px rgba(0,0,0,0.3)` |
| `--shadow-md` | `0 2px 8px rgba(44,51,64,0.06)` | `0 2px 10px rgba(0,0,0,0.35)` |
| `--shadow-lg` | `0 8px 24px rgba(44,51,64,0.08)` | `0 8px 28px rgba(0,0,0,0.45)` |
| `--shadow-L1` | `0 2px 8px rgba(44,51,64,0.06)` | `0 2px 10px rgba(0,0,0,0.35)` |
| `--shadow-L2` | `0 1px 3px rgba(44,51,64,0.04)` | `0 1px 4px rgba(0,0,0,0.25)` |

---

## 14. Logo & 品牌素材

### Logo

- 格式：SVG (`ezagent-logo.svg`)，`fill="currentColor"` 适配任意色彩
- ViewBox: `0 0 1850 2000`
- 日常用**墨色** (`#2c3340`)
- 品牌场景可选**朱印** (`#c94040`)
- 暗色背景用**白色**或**琉璃金**
- 最小尺寸：16px

### 背景图案 Pattern

- 文件：`pattern-bg.jpg`
- 仅用于 hero 区和 footer
- Light mode: `opacity ≤ 6%`
- Dark mode: `opacity ≤ 3%`
- 平铺：`background: url('pattern-bg.jpg') repeat center/200px`

### 插画风格

简洁扁平等距向量图，墨灰/天青/琉璃金配色，大量留白，构图松弛。

---

## 15. CSS 变量完整参考

```css
:root {
  /* ── Palette ── */
  --ink: #2c3340;
  --ink-light: #3d4a5c;
  --bg: #ffffff;
  --bg-alt: #f7f7f5;
  --border: #e3e2de;
  --border-light: #f1f1ef;
  --vermillion: #c94040;
  --celadon: #6b8fa5;
  --gold: #c9a55a;
  --pine: #4a6b5a;
  --amber: #d4a04b;
  --deep-sky: #4a6e82;
  --smoke: #787774;
  --mist: #c5bfb3;

  /* ── Typography ── */
  --font-display: 'DM Sans', 'Noto Sans SC', sans-serif;
  --font-body: 'DM Sans', 'Noto Sans SC', sans-serif;
  --font-code: 'JetBrains Mono', 'SF Mono', 'Fira Code', Consolas, monospace;
  --font-brand: 'Noto Serif SC', serif;

  /* ── Spacing ── */
  --sp-1: 4px;
  --sp-2: 8px;
  --sp-3: 12px;
  --sp-4: 16px;
  --sp-6: 24px;
  --sp-8: 32px;
  --sp-12: 48px;
  --sp-16: 64px;
  --sp-24: 96px;

  /* ── Shadows ── */
  --shadow-sm: 0 1px 2px rgba(44, 51, 64, 0.04);
  --shadow-md: 0 2px 8px rgba(44, 51, 64, 0.06);
  --shadow-lg: 0 8px 24px rgba(44, 51, 64, 0.08);
  --shadow-L1: 0 2px 8px rgba(44, 51, 64, 0.06);
  --shadow-L2: 0 1px 3px rgba(44, 51, 64, 0.04);

  /* ── Radii ── */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* ── Motion ── */
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --dur-instant: 75ms;
  --dur-fast: 150ms;
  --dur-normal: 200ms;
  --dur-slow: 300ms;
  --dur-page: 500ms;

  /* ── Z-index ── */
  --z-base: 0;
  --z-sticky: 100;
  --z-dropdown: 200;
  --z-overlay: 300;
  --z-modal: 400;
  --z-toast: 500;

  /* ── Inverted Surface (always dark) ── */
  --surface-inv: #2c3340;
  --surface-inv-text: #d5d2ca;
}
```

---

## 16. 适用场景

AI agent 平台、开发者工具、SaaS 仪表板、协作工作空间、技术产品 landing page — 任何需要干净专业美学、带有微妙温暖和东方精致感的场景。

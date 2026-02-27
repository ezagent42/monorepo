# Eastern Clarity

A minimal, modern design system with subtle Eastern sensibility. Clean whites and warm grays form the foundation, accented by ink-dark text and three signature colors — vermillion, celadon, and gold — named after traditional Chinese pigments but rendered in a contemporary SaaS aesthetic.

## Color Palette

- **墨色 Ink**: `#2c3340` - Primary text, headings, dark backgrounds
- **淡墨 Light Ink**: `#3d4a5c` - Body text, secondary content
- **素纸 White**: `#ffffff` - Card surfaces, primary backgrounds
- **暖灰 Warm Gray**: `#f7f7f5` - Page background, alternate surfaces
- **朱印 Vermillion**: `#c94040` - CTA, error states, brand accent
- **天青 Celadon**: `#6b8fa5` - Links, info, interactive elements
- **琉璃金 Gold**: `#c9a55a` - Premium, decorative, pending states
- **烟墨 Smoke**: `#787774` - Helper text, placeholders
- **云白 Border**: `#e3e2de` - Dividers, card borders
- **松绿 Pine**: `#4a6b5a` - Success states
- **晨琥珀 Amber**: `#d4a04b` - Warning states
- **深天 Deep Sky**: `#4a6e82` - Celadon hover, small text fallback

### Color Ratio

60% White / 20% Ink / 10% Smoke / 5% Vermillion / 3% Celadon / 2% Gold

## Typography

- **Display**: DM Sans Bold (EN) + Noto Sans SC Bold (CN), 36–48px, -0.02em tracking
- **Headings**: DM Sans Bold / Noto Sans SC SemiBold, 24–28px
- **Body**: DM Sans Regular (EN) + Noto Sans SC Regular (CN), 15–16px, line-height 1.8–1.9
- **Code**: JetBrains Mono 400, 14–15px
- **Brand Display**: Noto Serif SC Bold — marketing headlines only, not in product UI

## Design Tokens

### Spacing (4px base)

| Token     | Value | Usage                          |
|-----------|-------|--------------------------------|
| `--sp-1`  | 4px   | Tight gaps                     |
| `--sp-2`  | 8px   | Icon gaps, inline spacing      |
| `--sp-3`  | 12px  | Card padding (compact)         |
| `--sp-4`  | 16px  | Standard padding               |
| `--sp-6`  | 24px  | Component padding              |
| `--sp-8`  | 32px  | Section inner padding          |
| `--sp-12` | 48px  | Section gaps                   |
| `--sp-16` | 64px  | Major section separation       |
| `--sp-24` | 96px  | Top-level section separation   |

### Radius

- Small: 4px — buttons, inline code
- Medium: 8px — cards, inputs
- Large: 12px — modals, sheets

### Shadows

- `--shadow-sm`: `0 1px 2px rgba(44,51,64,0.04)` — subtle depth
- `--shadow-md`: `0 2px 8px rgba(44,51,64,0.06)` — cards
- `--shadow-lg`: `0 8px 24px rgba(44,51,64,0.08)` — elevated elements

### Motion

- **ease-out**: `cubic-bezier(0,0,0.2,1)` — enter/appear
- **ease-in-out**: `cubic-bezier(0.4,0,0.2,1)` — move/resize
- **ease-spring**: `cubic-bezier(0.34,1.56,0.64,1)` — emphasis/bounce
- Durations: instant 75ms, fast 150ms, normal 200ms, slow 300ms, page 500ms

## Icons

Phosphor Icons with dual-weight strategy:
- **Thin** (1px stroke) — navigation, structure, toolbar, buttons
- **Duotone** (2px + fill) — status, notifications, semantic states

## Layout Principles

- Generous whitespace: section gaps 64–96px, component padding ≥ 24px
- Card-based: white cards on warm gray (#f7f7f5) backdrop
- Asymmetric balance: main content 60–65%, breathing space 35–40%
- Nesting: white ↔ gray alternation, max 3 levels, semantic color left-border accent
- 4px base grid for vertical rhythm

## Dark Mode

Full dark mode support via CSS custom properties. Dark surface `#1e2128`, alt `#15181e`. All accent colors (vermillion, celadon, gold) remain unchanged. Text inverts to warm white `#ededeb`.

## Best Used For

AI agent platforms, developer tools, SaaS dashboards, collaborative workspaces, technical product landing pages — any context requiring a clean, professional aesthetic with subtle warmth and Eastern refinement.

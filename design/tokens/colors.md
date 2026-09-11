# Color tokens — SkirrNow (Editorial Press)

Single source of truth for color. Per `.cursor/rules/frontend/ui-visual-language.mdc`:
use **semantic roles**, never raw hex in components; reserve the accent for primary
actions and highlights; never auto-generate gradients, generic shadows, or random palettes.

## Semantic roles → values

| Role | Value | Use |
|---|---|---|
| `color-bg-surface` | `#F4F1EA` | Page ground (warm paper) |
| `color-bg-raised` | `#FCFBF7` | Cards, panels (warm near-white) |
| `color-bg-subtle` | `#EBE6DC` | Grouped/inset backgrounds |
| `color-fg-default` | `#1E1922` | Primary text, headings (plum-black ink) |
| `color-fg-muted` | `#5E5647` | Body / secondary text |
| `color-fg-subtle` | `#837A69` | Metadata, captions, placeholders |
| `color-accent-primary` | `#3A5648` | Primary actions, links, key highlights (muted forest) |
| `color-accent-hover` | `#2C4437` | Accent hover/active |
| `color-border-subtle` | `#DED8CB` | Hairline borders, dividers |
| `color-border-strong` | `#CAC2B1` | Emphasized borders |
| `color-border-critical` | `#B23A2E` | Destructive actions, errors |
| `color-state-success` | `#3A7D5B` | Verified / qualified |
| `color-state-warning` | `#B5771F` | Needs-info |
| `color-state-danger` | `#B23A2E` | Rejected / failed |

## Implementation

These map to the Tailwind config (`tailwind.config.ts`): `slate-50`=`bg-surface`,
`white`=`bg-raised`, `slate-900`=`fg-default`, `slate-600`=`fg-muted`,
`slate-500`=`fg-subtle`, `slate-200`=`border-subtle`, `accent`=`accent-primary`.
State colors are the semantic Tailwind tokens `success` / `warning` / `danger`.

## Rules
- Never rely on color alone for state — pair with text/icon.
- Accent is for action & emphasis only, not decoration.
- Contrast target: WCAG 2.1 AA or better (ink on paper ≈ 13:1; forest on paper ≈ 5:1).

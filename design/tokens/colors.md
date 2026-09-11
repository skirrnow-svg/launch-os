# Color tokens — SkirrNow (Dark Studio)

Single source of truth for color. Per `.cursor/rules/frontend/ui-visual-language.mdc`:
semantic roles only, never raw hex in components; accent reserved for primary actions
and highlights; never auto-generate gradients, generic shadows, or random palettes.

## Semantic roles → values (dark-first)

| Role | Value | Use |
|---|---|---|
| `color-bg-canvas` | `#0E0D12` | Page ground (near-black) |
| `color-bg-raised` | `#17161D` | Cards, panels (raised dark surface) |
| `color-bg-subtle` | `#1C1B24` | Grouped/inset backgrounds |
| `color-border-subtle` | `#26242F` | Hairline borders, dividers |
| `color-border-strong` | `#35323F` | Emphasized borders |
| `color-fg-default` | `#ECEAF1` | Primary text, headings (off-white) |
| `color-fg-muted` | `#A7A3B3` | Body / secondary text |
| `color-fg-subtle` | `#8B8798` | Metadata, captions |
| `color-fg-faint` | `#6E6A7A` | Placeholders, disabled |
| `color-accent` | `#BEF264` | Primary actions, links, highlights (electric lime) |
| `color-accent-hover` | `#A8E63C` | Accent hover/active |
| `color-on-accent` | `#17161D` | Text/icon on the lime accent (dark) |
| `color-state-success` | `#4ADE80` | Verified / qualified |
| `color-state-warning` | `#FBBF24` | Needs-info |
| `color-state-danger` | `#F87171` | Rejected / failed |

## Implementation (Tailwind, inverted)
`slate-50`=`bg-canvas`, `white`=`bg-raised` (also `text-white` = on-accent dark text),
`slate-900`=`fg-default`, `slate-600`=`fg-muted`, `slate-500`=`fg-subtle`,
`slate-400`=`fg-faint`, `slate-200`=`border-subtle`, `accent`=lime. `indigo-*`/`blue-50`
are remapped onto the accent.

## Rules
- Use the lime accent **sparingly** — action & emphasis only, never decoration.
- Never rely on color alone for state — pair with text/icon.
- Contrast target: WCAG 2.1 AA+ (off-white on canvas ≈ 15:1; dark-on-lime ≈ 12:1).

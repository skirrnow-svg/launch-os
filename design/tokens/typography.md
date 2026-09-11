# Typography tokens — SkirrNow (Editorial Press)

Source of truth for type. A small, consistent scale with **named roles** — never
invent ad-hoc font sizes; map to a role. Self-hosted via `next/font` (no layout shift).

## Families
- **Display** — `Fraunces` (serif, optical-sized). All headings; the editorial voice.
- **Body** — `Libre Franklin` (humanist sans). Running text, UI.
- **Mono** — `IBM Plex Mono`. Eyebrows, labels, data, code.

## Scale (roles)

| Role | Size / weight | Family | Use |
|---|---|---|---|
| `display-xl` | 48–64px · 700 · tracking −0.02em | Fraunces | Hero title (once per page) |
| `heading-xl` | 30–36px · 700 | Fraunces | Page / major section titles |
| `heading-m` | 22–24px · 600 | Fraunces | Section headings |
| `heading-s` | 18px · 600 | Fraunces | Card titles |
| `body` | 16px · 400 · 1.6 | Libre Franklin | Default content |
| `body-small` | 14px · 400 | Libre Franklin | Secondary text |
| `caption` | 13px · 400 | Libre Franklin | Metadata |
| `label` | 12px · 600 · uppercase · tracking 0.12em | IBM Plex Mono | Eyebrows, field labels, data tags |

## Rules
- One `display-xl` per page. Structure sections with `heading-m`.
- Headings get `text-wrap: balance`; body gets `text-wrap: pretty`.
- Aligned numbers use `tabular-nums` (mono or `font-variant-numeric`).
- Never mix a second display family into a single flow.

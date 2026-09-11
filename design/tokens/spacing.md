# Spacing, radius & elevation tokens — SkirrNow (Editorial Press)

Consistent scale for layout and components — never invent ad-hoc values.

## Spacing scale (4px base)
`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128` (Tailwind `1 2 3 4 6 8 12 16 24 32`).
- Component inner padding: 16–24px.
- Section vertical rhythm: 64–96px (`py-16`–`py-24`).
- Page gutter: min 16px each side at every width.

## Radius
- `radius-default`: **6px** (Tailwind `rounded`). Crisp, editorial.
- Pills/avatars only: full round. No radii larger than 6px on surfaces.
- One radius per flow — don't mix.

## Elevation (use sparingly)
Editorial restraint: **prefer 1px hairline borders (`color-border-subtle`) over shadows**
to separate surfaces. Reserve shadow for genuinely floating layers (modals, menus,
popovers) — a single subtle token shadow, never a novel per-component shadow, never a
glow. No gradients as decoration.

## Rules
- Density: comfortable, not cramped; align to the 4px grid.
- Dividers are hairlines, not heavy rules.
- Whitespace is a design element — let sections breathe.

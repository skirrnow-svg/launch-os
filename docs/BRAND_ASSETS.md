# SkirrNow Brand Assets

Canonical brand tokens, logo files, and the generation prompts for producing
on-brand media (Higgsfield / any image model). Keep this current as the brand
evolves.

## Identity
- **Logo:** a glowing lightbulb with a neural-network brain inside (ideas × AI),
  radiating light rays. Wordmark **SKIRRNOW**; tagline **Marketing Momentum Masters**.
- **Look:** premium, dark, electric — a lime accent on a near-black canvas.

## Color tokens (live site)
| Role | Hex |
|---|---|
| Accent · lime | `#BEF264` |
| Accent hover | `#A8E63C` |
| Canvas | `#0E0D12` |
| Card surface | `#17161D` |
| Border | `#26242F` |
| Text · ink | `#ECEAF1` |
| Body | `#A7A3B3` |
| (original gold, for reference) | `#E1B156` |

**Fonts:** display = Space Grotesk; mono = IBM Plex Mono.

## Logo files (in `public/`)
- `logo.png` — compact mark (bulb + SKIRRNOW, **no tagline**, transparent bg) — header + sidebar.
- `logo-full.png` — full lockup **with tagline**, transparent bg — spare/large use.
- Footer uses the mark + the tagline as **HTML text** (sharper than the baked-in tagline).
- Cache-bust: references append `?v=N`; bump N whenever a same-named asset changes
  (Hostinger `hcdn` serves public images with a 1-year cache).
- Source (recolored, lime): `~/Downloads/logo_skirrnow_lime.png` and `..._mark_transparent.png`.

## Generation prompts (Higgsfield / any image model)

> **Two gotchas:** (1) Higgsfield's `ip_detected` filter blocks brand names/domains —
> never put "SkirrNow"/"skirrnow.com" in a prompt; describe visually. (2) AI models
> can't reliably spell the "SKIRRNOW" wordmark — generate the emblem only and add the
> wordmark via Brand Studio / a vector tool. For an exact match, upload an existing
> logo file as a **reference image** and use image-to-image.

### Logo emblem (lime)
```
A modern flat vector logo emblem: a glowing incandescent lightbulb with a classic
rounded glass dome and a ribbed screw base, drawn as clean bright electric-lime
(#BEF264) neon outlines. Inside the glass sits a stylized human brain formed from a
glowing neural network — small luminous nodes connected by thin delicate lines, two
symmetrical hemispheres, like a constellation or circuit board. Short straight light
rays radiate outward from the top of the bulb. Subtle neon glow and soft bloom around
the lime linework, faint metallic sheen. Centered, minimal, premium AI-tech branding,
high contrast, crisp edges, flat 2D vector style, matte near-black (#0E0D12) background.
No text, no letters, no words.
```
**Negative:** `photorealistic, 3d clutter, busy background, background gradient, watermark, text, letters, words, typography, blurry, low contrast, multiple bulbs, cartoon`
**Gold variant:** swap `electric-lime (#BEF264)` → `warm metallic gold (#E1B156, gold gradient)`. **Params:** 1:1, high quality, single subject.

### Hero / section background (16:9)
```
Abstract dark tech background, matte near-black #0E0D12, faint electric-lime (#BEF264)
neural-network constellation — thin glowing lines and soft nodes drifting across with
depth of field, cinematic, minimal, lots of empty negative space on the right for
headline text. No text.
```

### Social / OG banner (1200×630)
```
Premium dark banner, near-black background, a single lime glowing lightbulb-brain
emblem on the left, subtle neural lines fading to the right, cinematic lighting, clean
empty space for a headline, minimal, high-end SaaS branding. No text.
```

### App icon / favicon (1:1)
```
Minimal app icon: only a bright electric-lime lightbulb with a glowing neural-network
brain inside, thick clean lines, centered on a solid near-black #0E0D12 rounded square,
high contrast, legible at small size. No text.
```

### Seamless pattern / texture
```
Seamless tileable dark pattern, near-black, faint electric-lime circuit traces and
small neural nodes evenly scattered, very subtle, low opacity, minimal.
```

**Consistency tip:** feed the emblem output back as a **style reference** for the other
prompts so the whole set shares the exact bulb/brain and lime tone.

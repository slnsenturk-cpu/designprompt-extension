---
name: "Rig Design System"
source: "https://rig.ai/"   # observed on 2026-08-29
generated_by: "VibeDesign 3.0.0"
style: "dark high-contrast compact chamfered vivid animated interface"
colors:
  background: "#0a0a0a"
  text-primary: "#f0eee6"
  text-secondary: "#b7b4af"
  text-muted: "#aba9a4"
  accent: "#ed462d"
  primary: "#ed462d"
  border: "#2a2a29"
  border-subtle: "#212120"
  success: "#22c55e"
  accent-1: "#0000ee"
typography:
  heading: "Chalet"
  body: "Instrument Sans"
  mono: "Chivo Mono"
  scale:
    h1: "83.36px / 700 / 73.3568px"
    h2: "52.1px / 700 / 47.932px"
    h3: "26.05px / 700 / 24.7475px"
    body: "13.6px / 400 / 21.76px"
    label: "12.8px / 400 / normal"
    code: "10.4px / 400 / normal"
spacing:
  base: "4px"
  scale: ["4px", "8px", "12px", "16px", "20px", "24px", "28px", "32px"]
radius:
  button: "0px"
  tag: "0px"
  input: "1px"
  card: "10px"
  avatar: "50%"
shadows:
  layered: "rgba(240, 237, 230, 0.04) 0px 2px 0px 0px, rgba(0, 0, 0, 0.5) 0px -1px 0px 0px, rgba(0, 0, 0, 0.4) 0px 20px 60px 0px"
  sm: "rgba(0, 0, 0, 0.5) 0px 2px 8px 0px inset"
breakpoints:
  # desktop-first (max-width queries)
  md: "768px"
  lg: "1024px"
  xl: "1280px"
---

# Rig Design System

## Visual direction

The interface is dark-themed, built on `#0a0a0a` with `#f0eee6` as the primary text color. Body text sits at a very high contrast ratio of 17.0:1 against the page background. Shape language is angular: buttons are chamfered by 14px with a `clip-path` polygon rather than a border-radius. Motion is ambient rather than incidental — 16 keyframes and 3 idle loops run without user input. The accent `#ed462d` is highly saturated and used sparingly for emphasis.

## Layout

| Property | Value |
|---|---|
| Container max-width | 90% |
| Section padding (Y) | 128px (8rem) |
| Section rhythm | 8 sections, opening on `#ed462d`, the rest inheriting the page background · 7 full-bleed |
| Navigation | standard |
| Hero region | present |
| Card gap | 24px (1.5rem) |
| Hero background | `#ed462d` (full-bleed) |
| Dark footer | yes |

## Color usage

| Token | Hex | Used for |
|---|---|---|
| `background` | `#0a0a0a` | Page canvas. |
| `text-primary` | `#f0eee6` | Body and heading text. |
| `text-secondary` | `#b7b4af` | Supporting text, labels. |
| `text-muted` | `#aba9a4` | Captions, placeholders, disabled text. |
| `accent` | `#ed462d` | The signature colour — hero fills, badges, icons, glows. |
| `primary` | `#ed462d` | Primary actions, active states, key emphasis. |
| `border` | `#2a2a29` | Default dividers and control outlines. |
| `border-subtle` | `#212120` | Low-emphasis separators. |
| `success` | `#22c55e` | Positive status. |
| `accent-1` | `#0000ee` | Secondary accent, decorative use. |

## Typography

| Family | Used for |
|---|---|
| `Chalet` | `h1`, `h2`, `h3` |
| `Chivo Mono` | `code` |
| `Geist Pixel Square` | `label` |
| `Instrument Sans` | `body` |

### Scale

| Step | Size | Weight | Line height | Tracking | Transform |
|---|---|---|---|---|---|
| `h1` | 83.36px (5.21rem) | 700 | 73.3568px | -3.3344px | — |
| `h2` | 52.1px (3.2563rem) | 700 | 47.932px | -1.563px | — |
| `h3` | 26.05px (1.6281rem) | 700 | 24.7475px | -0.7815px | — |
| `body` | 13.6px (0.85rem) | 400 | 21.76px | — | — |
| `label` | 12.8px (0.8rem) | 400 | normal | 1.28px | uppercase |
| `code` | 10.4px (0.65rem) | 400 | normal | — | — |

Weights in use: `400`, `600`, `700`.

Each step above carries its own tracking — negative on display headings, positive on labels. Apply them together, and never substitute a family that is not listed here.

## Fonts & availability

| Family | Source | Used for |
|---|---|---|
| `Chalet` | self-hosted (not freely available) | `h1`, `h2`, `h3` |
| `Geist Pixel Square` | self-hosted (not freely available) | `label` |
| `Instrument Sans` | self-hosted (not freely available) | `body` |
| `Chivo Mono` | self-hosted (not freely available) | `code` |

### Substitutes — suggested, not observed

The families above marked self-hosted are licensed to the source site and cannot be reused. These are open alternatives with a comparable classification. They are **suggestions, not measurements** — nothing here was seen on the page.

| Unavailable family | Open alternative (suggested) |
|---|---|
| `Chalet` | Inter Tight or Space Grotesk |
| `Geist Pixel Square` | Silkscreen or Press Start 2P |
| `Instrument Sans` | openly licensed — self-hosted here, but obtainable directly |
| `Chivo Mono` | JetBrains Mono or IBM Plex Mono |

## Components

### Buttons

**Surface context** — the CTA variants below were sampled inside the hero, against `#ed462d`, not against the page background. Their fills and alpha borders are composited over that surface; re-derive them for a button placed on the page background.

**Shape** — chamfered corners, 14px, cut with `clip-path: polygon(14px 0px, 100% 0px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0px 100%, 0px 14px)`. Border-radius is `0`; the corner treatment is the clip-path, so an agent must reproduce the polygon rather than rounding the corners.

**Inverse fill** — the primary button is painted in the page background colour with inverted text, rather than in the accent. Reproduce it as an inverse button, not as a filled accent button.

#### Primary

_Measured on the hero surface `#ed462d`._

| Property | Value |
|---|---|
| Background | `#0a0a0a` |
| Text color | `#f0ede6` |
| Padding | `16px 32px` |
| Font size | `13.6px (0.85rem)` |
| Font weight | `700` |
| Height | `52.5px` |
| Transition | `0.2s cubic-bezier(0.25, 1, 0.5, 1)` |

#### Secondary

| Property | Value |
|---|---|
| Background | `#0a0a0a` |
| Text color | `#f0ede6` |
| Padding | `19.2px (1.2rem)` |
| Font size | `12px (0.75rem)` |
| Font weight | `700` |
| Letter spacing | `0.6px` |
| Height | `38.3906px` |
| Transition | `opacity 0.2s` |

#### Ghost

_Measured on the hero surface `#ed462d`._

| Property | Value |
|---|---|
| Text color | `#0a0a0a` |
| Padding | `16px 32px` |
| Border | `2px solid #a93423` |
| Font size | `13.6px (0.85rem)` |
| Font weight | `700` |
| Height | `52.5px` |
| Transition | `0.2s cubic-bezier(0.25, 1, 0.5, 1)` |

### Inputs

| Property | Value |
|---|---|
| Text color | `#f0ede6` |
| Padding | `13.6px 19.2px` |
| Border | `1px solid #2d2c2b` |
| Font size | `12.8px (0.8rem)` |
| Height | `44.1875px` |

### Navigation

| Property | Value |
|---|---|
| Pattern | `standard` |
| Style | `transparent-hero` |

### Badges

| Property | Value |
|---|---|
| Background | `#0a0a0a` |
| Text color | `#ed462d` |
| Padding | `8px 16px` |
| Radius | `0px` |
| Font size | `12px (0.75rem)` |
| Font weight | `400` |

### Links

**Sampled off the page background** — `#0a0a0a` sits at 1.00:1 against `#0a0a0a`, which is invisible. Against the hero surface `#ed462d` it reads 5.20:1, so this is the hero link colour.

On the page background use `#f0ede6`, measured from the body-copy link rule.

| Property | Value |
|---|---|
| Color | `#0a0a0a` |
| Decoration | `none` |
| Font weight | `700` |

### Footer

| Property | Value |
|---|---|
| Background | `#0a0a0a` |
| Text color | `#f0ede6` |
| Padding | `64px 0px 160px` |
| Top border | `1px solid #2a2a29` |

## Elevation & shadows

Elevation is **glow-based, inset, layered**, up to 12 stacked layers.

| Token | Value |
|---|---|
| `layered` | `rgba(240, 237, 230, 0.04) 0px 2px 0px 0px, rgba(0, 0, 0, 0.5) 0px -1px 0px 0px, rgba(0, 0, 0, 0.4) 0px 20px 60px 0px` |
| `sm` | `rgba(0, 0, 0, 0.5) 0px 2px 8px 0px inset` |

## Iconography & imagery

| Property | Value |
|---|---|
| Icon style | filled |
| Common sizes | 16px, 20px, 18px |
| Stroke widths | 2px, 2.5px |
| Icon count | 22 |
| Icon colour | `#ed462d` |
| Image treatment | none |
| Full-bleed imagery | yes |
| Aspect ratios | `16 / 12` |

Use icons at the sizes and stroke weights above. Do not mix icon families.

## Spacing rules

All spacing is a multiple of the **4px** base unit (80% of observed values conform).

| Step | px | rem |
|---|---|---|
| `4px` | 4px | 0.25rem |
| `8px` | 8px | 0.5rem |
| `12px` | 12px | 0.75rem |
| `16px` | 16px | 1rem |
| `20px` | 20px | 1.25rem |
| `24px` | 24px | 1.5rem |
| `28px` | 28px | 1.75rem |
| `32px` | 32px | 2rem |

### Breakpoints

The site is desktop-first — these are `max-width` queries.

| Name | Max width |
|---|---|
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |

## Do

- Use only the 11 tokens in `colors` — reference them by role, not by hex literal.
- Snap every margin, padding and gap to the 4px spacing scale.
- Use the type scale exactly as listed; derive nothing between steps.
- Apply the per-component radius values — buttons, cards and inputs differ deliberately.
- Keep body text at or above a 4.5:1 contrast ratio against its background.
- Reuse the component values verbatim; they are measured from the live page, not approximated.

## Don't

- Do not invent colors, tints or shades that are not in this document.
- Do not introduce new fonts, weights or sizes outside the scale.
- Do not use arbitrary spacing values such as `13px` or `27px`.
- Do not apply a single global border-radius to every element.
- The accent `#ed462d` is used as a full-bleed fill only for the hero; elsewhere use it sparingly for emphasis.
- Do not copy layout or wording from the source site; this document describes style only.

## Agent instructions

- Use only the tokens defined in the frontmatter of this file.
- Never invent a color; if a shade is missing, reuse the closest listed token.
- Respect the 4px spacing scale for every dimension you set.
- Match the type scale exactly — size, weight and line-height together.
- Reproduce component values (padding, radius, border, shadow) verbatim from the Components section.
- Reproduce the documented motion timings and interaction states rather than defaults.
- Verify text/background contrast meets 4.5:1 before shipping any pairing not listed here.
- Generate original copy and layout — this document supplies visual style only.

## Motion

| Property | Value |
|---|---|
| Dominant duration | 300ms |
| Dominant easing | ease |
| Timing personality | smooth |
| Reveal style | fade-only |
| Scroll paradigm | scroll-scrub |

### Keyframes

| Name | Effect |
|---|---|
| `btn-glitch` | **not fully captured** — first and last frames are identical |
| `glitch-subtle-1` | clip-rect slice (glitch) |
| `glitch-subtle-2` | clip-rect slice (glitch) |
| `pulse-ring` | opacity 0.4 → 0, scale 1 → 2 |
| `blink` | opacity 1 → 0 |
| `ticker` | translate 0px → -50% — seamless marquee loop |
| `glitch-shift` | translate 0px → 1px |
| `hdr-glow-pulse` | blur 8px → 12px, opacity 0.4 → 0.7 |
| `watermark-glitch` | **not fully captured** — first and last frames are identical |
| `pupil-glitch` | **not fully captured** — first and last frames are identical |
| `disconnect-drift-left` | opacity 0.5 → 0.4, translate 0px → -4px, 1px |
| `disconnect-drift-right` | opacity 0.5 → 0.4, translate 0px → 4px, -1px |
| `signal-flicker` | opacity 1 → 0.3, translate 0px → -1px |
| `howProgressFill` | **not fully captured** — first and last frames are identical |
| `terminalLineIn` | opacity 0 → 1 |
| `wl-spin` | **not fully captured** — first and last frames are identical |

Only the first and last frames of each `@keyframes` rule were captured. 5 of 16 therefore show no delta: their motion lives in intermediate frames. Treat those as "a jitter of this name exists" rather than as a spec.

### Ambient loops

These run without user input.

| Animation | Duration | Easing | Iterations | Position |
|---|---|---|---|---|
| `watermark-glitch` | 4000ms | — | — | above-fold |
| `signal-flicker` | 4000ms | ease-in-out | — | below-fold |
| `hdr-glow-pulse` | 3000ms | — | — | below-fold |

### Transitions in use

- `opacity 0.2s`
- `0.2s cubic-bezier(0.25, 1, 0.5, 1)`
- `border-color 0.1s, color 0.1s`
- `color 0.1s, opacity 0.1s`
- `color 0.3s`

## Interaction states

### Measured

Observed on the live page. The capture's `before` object is the element's **base** state, so each cell reads base → hover; `—` means that side was not captured.

| Component | Variant | Base → Hover |
|---|---|---|
| Button | `accent-fill A` | background: `#ed462d` → —<br>color: `#0a0a0a` → —<br>box-shadow: `#ed462d 0px 0px 40px 0px` → `4px 4px 0 #2b4fff` |
| Button | `accent-fill B` | background: `#ed462d` → `#d93d26`<br>color: `#0a0a0a` → — |
| Button | `ghost` | background: — → `#2d2c2b` |
| Button | `inverse-fill A` | background: `#0a0a0a` → —<br>color: `#f0ede6` → —<br>box-shadow: — → `4px 4px 0 #2b4fff` |
| Button | `inverse-fill B` | background: `#0a0a0a` → —<br>color: `#f0ede6` → —<br>box-shadow: — → `4px 4px 0 #ed462d` |
| Button | `muted` | background: `#131313` → —<br>color: `#7d7c78` → `#ed462d`<br>border-color: — → `#ed462d` |
| Button | `outline` | background: — → `#161515`<br>border-color: — → `#f0ede6` |
| Card | `bordered A` | background: `#0a0a0a` → —<br>color: `#666562` → `#ffffff`<br>border-color: — → `#4a4a48` |
| Card | `bordered B` | background: `#0f0f0f` → `#110c0b`<br>color: `#f0ede6` → —<br>border-color: — → `#371611` |
| Card | `filled` | background: `#0a0a0a` → —<br>color: `#666562` → `#4ade80`<br>opacity: — → `1` |
| Card | — | color: `#f0ede6` → — |
| FAQ / accordion | — | color: `#f0ede6` → `#7d7c78` |
| Footer link | — | color: `#7d7c78` → `#ed462d` |
| Illustration | — | color: `#f0ede6` → —<br>opacity: — → `0.28` |
| Link | — | color: — → `#f0ede6` |
| Navigation | — | color: `#0a0a0a` → —<br>opacity: `0.7` → `1` |

Buttons transition with `0.2s cubic-bezier(0.25, 1, 0.5, 1)`.

### Recommended (not observed)

The extraction measured only `:hover`. Treat these as defaults, not as facts about the source.

- **focus** — Render a visible focus ring on every interactive element — 2px, offset 2px, using `accent` or `border`.
- **active** — Apply a small positional shift or a darker fill; never remove the focus ring.
- **disabled** — Reduce opacity to ~0.5 and remove hover/active feedback entirely.

## Component anatomy

### Grids

| Grid | Structure |
|---|---|
| masonry grid (3 col) | 3 columns, css-grid, 5 entries, heights 210–420px, equal widths |
| pricing grid | 2 columns |
| 3-column grid with 1px dividers | `311.93px 1px 311.93px 1px 311.93px rows:216.016px` |
| 3-column grid | `280.594px 280.602px 280.602px rows:267.805px 267.805px` |

### Patterns

| Pattern | Behaviour |
|---|---|
| Accordion | expand/collapse; only the open panel shows its body |
| Marquee | continuous horizontal track — see the `ticker` keyframe |
| Decorative geometry | non-semantic background shapes (6 instances) |

## Accessibility notes

| Pair | Ratio | WCAG 2.1 |
|---|---|---|
| hero heading `#0a0a0a` on hero `#ed462d` | 5.20:1 | AA |
| `text-primary` on `background` | 17.04:1 | AAA |
| `text-secondary` on `background` | 9.58:1 | AAA |
| `text-muted` on `background` | 8.43:1 | AAA |
| `primary` on `background` | 5.20:1 | AA |

All documented text pairings meet the 4.5:1 minimum for body text.

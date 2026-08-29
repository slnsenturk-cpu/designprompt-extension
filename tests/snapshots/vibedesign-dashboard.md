---
name: "Vibedesign Design System"
source: "https://vibedesign.tech/dashboard"   # observed on 2026-08-29
generated_by: "VibeDesign 3.0.0"
style: "dark high-contrast compact rounded vivid snappy interface"
colors:
  background: "#111113"
  text-primary: "#ededed"
  text-secondary: "#6b6b76"
  text-muted: "#e8e8ed"
  accent: "#3a1df5"
  primary: "#3a1df5"
  surface: "#0a0a0a"
  surface-raised: "#1a1a1a"
  border: "#242424"
  border-subtle: "#333333"
typography:
  heading: "Inter"
  mono: "JetBrains Mono"
  scale:
    h1: "40px / 700 / 50px"
    h2: "20px / 700 / 30px"
    code: "12px / 400 / 18px"
spacing:
  base: "4px"
  scale: ["8px", "12px", "20px", "24px", "32px"]
radius:
  button: "6px"
  input: "0px 6px 6px 0px"
  card: "8px"
  avatar: "9999px"
shadows:
  layered: "rgba(0, 0, 0, 0.88) 0px 0px 0px 1px, rgba(0, 0, 0, 0.04) 0px 1px 0px 0px, rgba(0, 0, 0, 0.08) 0px 2px 2px -1px, rgba(0, 0, 0, 0.08) 0px 4px 4px -2px, rgba(0, 0, 0, 0.08) 0px 8px 8px -4px, rgba(0, 0, 0, 0.08) 0px 16px 16px -8px"
breakpoints:
  # mobile-first (min-width queries)
  sm: "600px"
  md: "768px"
  lg: "1024px"
  2xl: "1400px"
---

# Vibedesign Design System

## Visual direction

The interface is dark-themed, built on `#111113` with `#ededed` as the primary text color. Body text sits at a very high contrast ratio of 16.1:1 against the page background. Shape language is gently rounded at 6px. Motion is ambient rather than incidental — 12 keyframes run without user input. The accent `#3a1df5` is highly saturated and used sparingly for emphasis.

## Layout

| Property | Value |
|---|---|
| Container max-width | 1200px |
| Section padding (Y) | 32px (2rem) |
| Section padding (X) | 32px (2rem) |
| Section rhythm | 2 sections, opening on `#111113`, 2 painted · 2 full-bleed |
| Navigation | standard |
| Sidebar | present |
| Hero background | `#111113` (full-bleed) |

## Color usage

| Token | Hex | Used for |
|---|---|---|
| `background` | `#111113` | Page canvas. |
| `text-primary` | `#ededed` | Body and heading text. |
| `text-secondary` | `#6b6b76` | Supporting text, labels. |
| `text-muted` | `#e8e8ed` | Captions, placeholders, disabled text. |
| `accent` | `#3a1df5` | The signature colour — hero fills, badges, icons, glows. |
| `primary` | `#3a1df5` | Primary actions, active states, key emphasis. |
| `surface` | `#0a0a0a` | Cards and raised panels. |
| `surface-raised` | `#1a1a1a` | Secondary panels, wells, hovered rows. |
| `border` | `#242424` | Default dividers and control outlines. |
| `border-subtle` | `#333333` | Low-emphasis separators. |

## Typography

| Family | Used for |
|---|---|
| `CameraPlainVariable` | loaded, no measured step |
| `Inter` | `h1`, `h2` |
| `JetBrains Mono` | `code` |

### Scale

| Step | Size | Weight | Line height | Tracking | Transform |
|---|---|---|---|---|---|
| `h1` | 40px (2.5rem) | 700 | 50px | — | — |
| `h2` | 20px (1.25rem) | 700 | 30px | — | — |
| `code` | 12px (0.75rem) | 400 | 18px | — | — |

Weights in use: `400`, `500`, `600`, `700`.

Each step above carries its own tracking — negative on display headings, positive on labels. Apply them together, and never substitute a family that is not listed here.

## Fonts & availability

| Family | Source | Used for |
|---|---|---|
| `CameraPlainVariable` | self-hosted (not freely available) | — |

### Substitutes — suggested, not observed

The families above marked self-hosted are licensed to the source site and cannot be reused. These are open alternatives with a comparable classification. They are **suggestions, not measurements** — nothing here was seen on the page.

| Unavailable family | Open alternative (suggested) |
|---|---|
| `CameraPlainVariable` | Instrument Sans or DM Sans |

## Components

### Buttons

#### Primary

| Property | Value |
|---|---|
| Text color | `#6b6b76` |
| Padding | `6px 12px` |
| Radius | `6px` |
| Border | `1px solid #242426` |
| Font size | `12px (0.75rem)` |
| Font weight | `500` |
| Height | `32px` |

#### Ghost

| Property | Value |
|---|---|
| Text color | `#6b6b76` |
| Padding | `6px 12px` |
| Radius | `6px` |
| Border | `1px solid #242426` |
| Font size | `12px (0.75rem)` |
| Font weight | `500` |
| Height | `32px` |

### Navigation

| Property | Value |
|---|---|
| Pattern | `standard` |
| Style | `transparent-hero` |

### Links

| Property | Value |
|---|---|
| Color | `#c5c1b9` |
| Decoration | `none` |
| Font weight | `400` |

## Elevation & shadows

Elevation is **glow-based, layered**, up to 24 stacked layers.

| Token | Value |
|---|---|
| `layered` | `rgba(0, 0, 0, 0.88) 0px 0px 0px 1px, rgba(0, 0, 0, 0.04) 0px 1px 0px 0px, rgba(0, 0, 0, 0.08) 0px 2px 2px -1px, rgba(0, 0, 0, 0.08) 0px 4px 4px -2px, rgba(0, 0, 0, 0.08) 0px 8px 8px -4px, rgba(0, 0, 0, 0.08) 0px 16px 16px -8px` |

## Iconography & imagery

| Property | Value |
|---|---|
| Icon style | outlined |
| Common sizes | 16px |
| Stroke widths | 2px |
| Icon count | 24 |
| Icon colour | `#c5c1b9` |
| Image treatment | none |

Use icons at the sizes and stroke weights above. Do not mix icon families.

## Spacing rules

All spacing is a multiple of the **4px** base unit (100% of observed values conform).

| Step | px | rem |
|---|---|---|
| `8px` | 8px | 0.5rem |
| `12px` | 12px | 0.75rem |
| `20px` | 20px | 1.25rem |
| `24px` | 24px | 1.5rem |
| `32px` | 32px | 2rem |

### Breakpoints

The site is mobile-first — these are `min-width` queries.

| Name | Min width |
|---|---|
| `sm` | 600px |
| `md` | 768px |
| `lg` | 1024px |
| `2xl` | 1400px |

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
- Do not use `#3a1df5` for large background fills — it is an accent.
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
| Dominant duration | 150ms |
| Dominant easing | cubic-bezier(0.4, 0, 0.2, 1) |
| Timing personality | snappy |
| Reveal style | scale-in |
| Scroll paradigm | scroll-scrub |

### Keyframes

| Name | Effect |
|---|---|
| `bounce` | **not fully captured** — first and last frames are identical |
| `ping` | opacity 0 → — |
| `pulse` | opacity 0.5 → — |
| `spin` | **not fully captured** — first and last frames are identical |
| `enter` | **not fully captured** — first and last frames are identical |
| `exit` | **not fully captured** — first and last frames are identical |
| `accordion-up` | **not fully captured** — first and last frames are identical |
| `accordion-down` | **not fully captured** — first and last frames are identical |
| `swipe-out-left` | opacity 1 → 0 |
| `swipe-out-right` | opacity 1 → 0 |
| `swipe-out-up` | opacity 1 → 0 |
| `swipe-out-down` | opacity 1 → 0 |

Only the first and last frames of each `@keyframes` rule were captured. 6 of 12 therefore show no delta: their motion lives in intermediate frames. Treat those as "a jitter of this name exists" rather than as a spec.

### Transitions in use

- `background-color 0.2s, color 0.2s, transform 0.1s`
- `background-color 0.2s, transform 0.1s`
- `fill 0.2s`

## Interaction states

### Measured

Observed on the live page. The capture's `before` object is the element's **base** state, so each cell reads base → hover; `—` means that side was not captured.

| Component | Variant | State | Change |
|---|---|---|---|
| Card | `bordered` | hover | border-color: — → `#0e2742`<br>transform: — → `translateY(-2px)` |
| Card | — | hover | background: — → `#0a0a0a` |
| Element | `A` | hover | background: — → `#0e0e10` |
| Element | `B` | hover | background: — → `#151516` |
| Element | `C` | hover | background: — → `#161617` |
| Element | `D` | hover | background: — → `#171718` |
| Element | `E` | hover | background: — → `#181819` |
| Element | `F` | hover | background: — → `#18181a`<br>color: `#ededed` → — |
| Element | `G` | hover | background: — → `#1a1a1a` |
| Element | `H` | hover | background: — → `#1b1b1c` |
| Element | `I` | hover | background: — → `#1d1d1f`<br>color: `#ededed` → — |
| Element | `J` | hover | background: — → `#1f1f1f` |
| Element | `K` | hover | background: — → `#242424` |
| Element | `L` | hover | background: — → `#341ede` |
| Element | `M` | hover | background: — → `#c33939` |
| Element | `N` | hover | background: — → `#cfcfd0` |
| Element | `O` | hover | background: — → `#d93e3e` |
| Element | `P` | hover | background: — → `#e7e7e7` |
| Element | `Q` | hover | background: — → `#ffffff` |
| Element | `R` | hover | border-color: — → `#0a3d71` |
| Element | `S` | hover | border-color: — → `#0c325a` |
| Element | `T` | hover | border-color: — → `#204c34` |
| Element | `U` | hover | border-color: — → `#21176d` |
| Element | `V` | hover | border-color: — → `#242424` |
| Element | `W` | hover | border-color: — → `#291a47` |
| Element | `X` | hover | border-color: — → `#363637` |
| Element | `Y` | hover | border-color: — → `#414142` |
| Element | `Z` | hover | border-color: — → `#583f0d` |
| Element | `[` | hover | border-color: — → `#58585a` |
| Element | `\` | hover | border-color: — → `#646466` |
| Element | `]` | hover | color: — → `#007fff` |
| Element | `^` | hover | color: — → `#301cc7` |
| Element | `_` | hover | color: — → `#8c8c8c` |
| Element | ``` | hover | color: — → `#ededed` |
| Element | `a` | hover | color: — → `#ef4343` |

### Recommended (not observed)

The extraction measured only `:hover`. Treat these as defaults, not as facts about the source.

- **focus** — Render a visible focus ring on every interactive element — 2px, offset 2px, using `accent` or `border`.
- **active** — Apply a small positional shift or a darker fill; never remove the focus ring.
- **disabled** — Reduce opacity to ~0.5 and remove hover/active feedback entirely.

## Component anatomy

### Patterns

| Pattern | Behaviour |
|---|---|
| Marquee | continuous horizontal track — see the `ticker` keyframe |

## Accessibility notes

| Pair | Ratio | WCAG 2.1 |
|---|---|---|
| `text-primary` on `background` | 16.11:1 | AAA |
| `text-secondary` on `background` | 3.58:1 | **AA large text only** |
| `text-muted` on `background` | 15.44:1 | AAA |
| `text-primary` on `surface` | 16.91:1 | AAA |
| `primary` on `background` | 2.40:1 | **fails** |

⚠️ 2 pairings fall below the 4.5:1 minimum for body text. Darken the foreground or lighten the background before using these together at normal size.

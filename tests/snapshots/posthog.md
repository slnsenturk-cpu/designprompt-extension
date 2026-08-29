---
name: "Posthog Design System"
source: "https://posthog.com/"   # observed on 2026-08-29
generated_by: "VibeDesign 3.0.0"
style: "light crisp compact rounded vivid animated interface"
colors:
  background: "#eeefe9"
  text-primary: "#374151"
  text-secondary: "#111111"
  text-muted: "#000000"
  accent: "#2f80fa"
  primary: "#cd8407"
  surface: "#fdfdf8"
  surface-raised: "#e5e7e0"
  border: "#bfc1b7"
  border-subtle: "#d2d3cc"
  warning: "#f7a501"
  error: "#f54e00"
  accent-1: "#eb9d2a"
  accent-2: "#b62ad9"
  accent-3: "#29dbbb"
typography:
  heading: "RoundHog"
  body: "RoundHog"
  scale:
    h1: "36px / 800 / 40px"
    h2: "30px / 700 / 40px"
    h3: "18px / 700 / 28px"
    body: "18px / 500 / 27px"
    small: "14px / 500 / 20px"
spacing:
  base: "4px"
  scale: ["4px", "8px", "12px", "16px", "32px", "48px", "80px"]
radius:
  button: "6px"
  input: "4px"
  card: "40%"
  avatar: "9999px"
shadows:
  layered: "rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(255, 255, 255, 0.4) 0px 0px 6px 2px"
  layered-2: "rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.1) 0px 2px 4px -2px"
breakpoints:
  # mobile-first (min-width queries)
  xs: "425px"
  sm: "482px"
  md: "767px"
  lg: "800px"
---

# Posthog Design System

## Visual direction

The interface is light-themed, built on `#eeefe9` with `#374151` as the primary text color. Body text sits at a strong contrast ratio of 8.9:1 against the page background. Shape language is gently rounded at 6px. Motion is ambient rather than incidental — 52 keyframes and 3 idle loops run without user input. The accent `#cd8407` is highly saturated and used sparingly for emphasis.

## Layout

| Property | Value |
|---|---|
| Container max-width | 1200px |
| Section rhythm | 6 sections, the rest inheriting the page background · 4 full-bleed |
| Split (two-column) sections | 3 |
| Navigation | standard |
| Sidebar | present |
| Hero region | present |
| Card gap | 24px (1.5rem) |
| Hero background | `#e5e7e0` (full-bleed) |

## Color usage

| Token | Hex | Used for |
|---|---|---|
| `background` | `#eeefe9` | Page canvas. |
| `text-primary` | `#374151` | Body and heading text. |
| `text-secondary` | `#111111` | Supporting text, labels. |
| `text-muted` | `#000000` | Captions, placeholders, disabled text. |
| `accent` | `#2f80fa` | The signature colour — hero fills, badges, icons, glows. |
| `primary` | `#cd8407` | Primary actions, active states, key emphasis. |
| `surface` | `#fdfdf8` | Cards and raised panels. |
| `surface-raised` | `#e5e7e0` | Secondary panels, wells, hovered rows. |
| `border` | `#bfc1b7` | Default dividers and control outlines. |
| `border-subtle` | `#d2d3cc` | Low-emphasis separators. |
| `warning` | `#f7a501` | Cautionary status. |
| `error` | `#f54e00` | Destructive actions and error status. |
| `accent-1` | `#eb9d2a` | Secondary accent, decorative use. |
| `accent-2` | `#b62ad9` | Secondary accent, decorative use. |
| `accent-3` | `#29dbbb` | Secondary accent, decorative use. |

## Typography

| Family | Used for |
|---|---|
| `RoundHog` | `h1`, `h2`, `h3`, `body`, `small` |

### Scale

| Step | Size | Weight | Line height | Tracking | Transform |
|---|---|---|---|---|---|
| `h1` | 36px (2.25rem) | 800 | 40px | -0.9px | — |
| `h2` | 30px (1.875rem) | 700 | 40px | -0.75px | — |
| `h3` | 18px (1.125rem) | 700 | 28px | — | — |
| `body` | 18px (1.125rem) | 500 | 27px | — | — |
| `small` | 14px (0.875rem) | 500 | 20px | — | — |

Weights in use: `400`, `500`, `700`.

Each step above carries its own tracking — negative on display headings, positive on labels. Apply them together, and never substitute a family that is not listed here.

## Fonts & availability

| Family | Source | Used for |
|---|---|---|
| `IBM Plex Sans Variable` | self-hosted (not freely available) | — |
| `Fairytale` | self-hosted (not freely available) | — |
| `Computer Modern` | self-hosted (not freely available) | — |
| `Squeak` | self-hosted (not freely available) | — |
| `RoundHog` | self-hosted (not freely available) | `h1`, `h2`, `h3`, `body`, `small` |
| `Charter` | self-hosted (not freely available) | — |

### Substitutes — suggested, not observed

The families above marked self-hosted are licensed to the source site and cannot be reused. These are open alternatives with a comparable classification. They are **suggestions, not measurements** — nothing here was seen on the page.

| Unavailable family | Open alternative (suggested) |
|---|---|
| `IBM Plex Sans Variable` | Instrument Sans or DM Sans |
| `Fairytale` | Instrument Sans or DM Sans |
| `Computer Modern` | Instrument Sans or DM Sans |
| `Squeak` | Instrument Sans or DM Sans |
| `RoundHog` | Inter Tight or Space Grotesk |
| `Charter` | Instrument Sans or DM Sans |

## Components

### Buttons

#### Primary

| Property | Value |
|---|---|
| Background | `#cd8407` |
| Text color | `#23251d` |
| Padding | `0px (0rem)` |
| Radius | `6px` |
| Border | `1.5px solid #b17816` |
| Font size | `16px (1rem)` |
| Font weight | `400` |
| Height | `33.5px` |

#### Secondary

| Property | Value |
|---|---|
| Background | `#000000` |
| Text color | `#23251d` |
| Padding | `2px 8px` |
| Radius | `4px` |
| Font size | `13px (0.8125rem)` |
| Font weight | `500` |
| Height | `28px` |

#### Ghost

| Property | Value |
|---|---|
| Background | `#000000` |
| Text color | `#23251d` |
| Padding | `2px 8px` |
| Radius | `4px` |
| Font size | `13px (0.8125rem)` |
| Font weight | `500` |
| Height | `28px` |

### Navigation

| Property | Value |
|---|---|
| Pattern | `standard` |
| Style | `transparent-hero` |
| Visible links | `yes` |

### Links

| Property | Value |
|---|---|
| Color | `#23251d` |
| Decoration | `none` |
| Font weight | `500` |

## Elevation & shadows

Elevation is **glow-based, layered**, up to 16 stacked layers.

| Token | Value |
|---|---|
| `layered` | `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(255, 255, 255, 0.4) 0px 0px 6px 2px` |
| `layered-2` | `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.1) 0px 2px 4px -2px` |

### Text shadow

- `rgba(0, 0, 0, 0.5) 0px 1px 3px, rgba(0, 0, 0, 0.3) 0px 0px 1px`

Apply the full stack; the stops build a single halo and dropping any flattens it.

## Iconography & imagery

| Property | Value |
|---|---|
| Icon style | filled |
| Common sizes | 24px, 20px, 18px |
| Stroke widths | 1px |
| Icon count | 6 |
| Icon colour | `#23251d` |
| Image treatment | screenshot |
| Full-bleed imagery | yes |
| Gradient style | linear |
| Aspect ratios | `1 / 1` |

Use icons at the sizes and stroke weights above. Do not mix icon families.

## Spacing rules

All spacing is a multiple of the **4px** base unit (64% of observed values conform).

| Step | px | rem |
|---|---|---|
| `4px` | 4px | 0.25rem |
| `8px` | 8px | 0.5rem |
| `12px` | 12px | 0.75rem |
| `16px` | 16px | 1rem |
| `32px` | 32px | 2rem |
| `48px` | 48px | 3rem |
| `80px` | 80px | 5rem |

### Breakpoints

The site is mobile-first — these are `min-width` queries.

| Name | Min width |
|---|---|
| `xs` | 425px |
| `sm` | 482px |
| `md` | 767px |
| `lg` | 800px |

## Do

- Use only the 16 tokens in `colors` — reference them by role, not by hex literal.
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
- Do not use `#2f80fa` for large background fills — it is an accent.
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
| Dominant duration | 600ms |
| Dominant easing | cubic-bezier(0, 0, 0.2, 1) |
| Timing personality | editorial |
| Reveal style | fade-only |
| Scroll paradigm | scroll-scrub |

### Keyframes

| Name | Effect |
|---|---|
| `slideRight` | translatex → 100% |
| `rcSliderTooltipZoomDownIn` | opacity 0 → —, scale 0 → 1 |
| `rcSliderTooltipZoomDownOut` | opacity — → 0, scale 1 → 0 |
| `wobble` | translateX -5px → 5px, rotate -2deg → 2deg |
| `breathe` | scale 1 → 1.03 |
| `develop` | filter change, opacity 0 → 1 |
| `float` | translateY 0px → -6px |
| `gradient-rotate` | background pans |
| `grow` | scale 1 → 1.2 |
| `grow-sm` | scale 1 → 1.05 |
| `hogfather-jump` | **not fully captured** — first and last frames are identical |
| `hogfather-roll` | **not fully captured** — first and last frames are identical |
| `jump-out` | scale 1 → 0 |
| `ping` | opacity 0 → — |
| `pulse` | opacity 0.5 → — |
| `shimmer` | background pans |
| `slideUpFadeIn` | opacity 0 → 1, translateY 10px → 0px |
| `spin` | **not fully captured** — first and last frames are identical |
| `wiggle` | rotate 6deg → -6deg |
| `search-scroll-fade` | **not fully captured** — first and last frames are identical |
| `app-scrollbar-fade-in` | opacity 0 → 1 |
| `app-scrollbar-fade-out` | opacity 1 → 0 |
| `bounce` | translateX 20% → 10% |
| `features-ticker` | **not fully captured** — first and last frames are identical |
| `fade` | **not fully captured** — first and last frames are identical |
| `heart-pulse` | **not fully captured** — first and last frames are identical |
| `text-gradient-wizard-scroll` | **not fully captured** — first and last frames are identical |
| `wizard-copied-flash` | opacity 1 → 0 |
| `fadeIn` | opacity 0 → 1, scale 0.9 → 1 |
| `overlayFadeIn` | opacity 0 → 1 |
| `overlayFadeOut` | opacity 1 → 0 |
| `windowPopIn` | opacity 0 → 1, scale 0.92 → 1 |
| `windowSlideDown` | opacity 0 → 1, translateY -100% → 0px |
| `windowSlideUp` | opacity 1 → 0, translateY 0px → -100% — seamless marquee loop |
| `windowPopOut` | opacity 1 → 0, scale 1 → 0.92 |
| `questlog-sprite-animate` | background pans |
| `speechBubble` | opacity 0 → 1, translateX -10px → 0px, scale 0.8 → 1 |
| `speechBubbleLeft` | opacity 0 → 1, translateX 10px → 0px, scale 0.8 → 1 |
| `questGlow` | **not fully captured** — first and last frames are identical |
| `carousel-progress` | **not fully captured** — first and last frames are identical |
| `tools-ticker-marquee` | translateX 0px → -50% — seamless marquee loop |
| `carousel-fade-in` | opacity 0 → 1 |
| `hero-carousel-fade-in` | opacity 0 → 1 |
| `scattered-float` | translate -50%, -50% → calc(-50% + 1.5px |
| `context-warehouse-hog-float` | rotate 0deg → 0.4deg |
| `jump-in` | scale 0 → 1 |
| `slideUp` | **not fully captured** — first and last frames are identical |
| `slideDown` | **not fully captured** — first and last frames are identical |
| `slideIn` | translatex → 0px |
| `swipeOut` | **not fully captured** — first and last frames are identical |
| `dashdraw` | **not fully captured** — first and last frames are identical |
| `rough-notation-dash` | **not fully captured** — first and last frames are identical |

Only the first and last frames of each `@keyframes` rule were captured. 15 of 52 therefore show no delta: their motion lives in intermediate frames. Treat those as "a jitter of this name exists" rather than as a spec.

### Ambient loops

These run without user input.

| Animation | Duration | Easing | Iterations | Position |
|---|---|---|---|---|
| `tools-ticker-marquee` | 45000ms | linear | infinite | below-fold |
| `grow` | 2000ms | linear | infinite | below-fold |
| `grow-sm` | 3000ms | linear | infinite | below-fold |

### Transitions in use

- `0.3s cubic-bezier(0.4, 0.2, 1)`
- `opacity 0.7s cubic-bezier(0.4, 0.2, 1)`
- `opacity 0.7s cubic-bezier(0.2, 1)`
- `transform 0.2s cubic-bezier(0.2, 1)`

## Interaction states

### Measured

Observed on the live page. The capture's `before` object is the element's **base** state, so each cell reads base → hover; `—` means that side was not captured.

| Component | Variant | Base → Hover |
|---|---|---|
| Button | — | opacity: — → `1` |
| Element | `A` | background: `#eb9d2a` → —<br>color: `#000000` → —<br>transform: `matrix(1, 0, 0, 1, 0, -2)` → — |
| Element | `B` | background: `#eb9d2a` → —<br>color: `#000000` → —<br>transform: `matrix(1, 0, 0, 1, 0, -4)` → — |
| Element | `C` | border-color: — → `#57c5f7` |
| Element | `D` | border-color: — → `#eeefe9` |
| Element | `E` | opacity: — → `0.5` |
| Element | `F` | opacity: — → `1` |
| Element | `G` | opacity: — → `1`<br>transform: — → `translateY(0px) scale(1)` |

### Recommended (not observed)

The extraction measured only `:hover`. Treat these as defaults, not as facts about the source.

- **focus** — Render a visible focus ring on every interactive element — 2px, offset 2px, using `accent` or `border`.
- **active** — Apply a small positional shift or a darker fill; never remove the focus ring.
- **disabled** — Reduce opacity to ~0.5 and remove hover/active feedback entirely.

## Component anatomy

### Grids

| Grid | Structure |
|---|---|
| pricing grid | 0 columns |

### Patterns

| Pattern | Behaviour |
|---|---|
| Marquee | continuous horizontal track — see the `ticker` keyframe |
| Tabs | one panel visible at a time |
| Decorative geometry | non-semantic background shapes (14 instances) |

### Tabbed content

| Type | Bullets | Testimonial | Layout |
|---|---|---|---|
| tab-switcher | — | no | — |

## Accessibility notes

| Pair | Ratio | WCAG 2.1 |
|---|---|---|
| hero heading `#111827` on hero `#e5e7e0` | 14.22:1 | AAA |
| `text-primary` on `background` | 8.91:1 | AAA |
| `text-secondary` on `background` | 16.33:1 | AAA |
| `text-muted` on `background` | 18.16:1 | AAA |
| `text-primary` on `surface` | 10.10:1 | AAA |
| `primary` on `background` | 2.63:1 | **fails** |

⚠️ 1 pairing falls below the 4.5:1 minimum for body text. Darken the foreground or lighten the background before using these together at normal size.

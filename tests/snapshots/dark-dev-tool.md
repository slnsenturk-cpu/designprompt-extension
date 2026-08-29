---
name: "Forge Cli Design System"
source: "https://forge-cli.dev"   # observed on 2026-08-29
generated_by: "VibeDesign 3.0.0"
style: "dark high-contrast spacious rounded vivid fluid interface"
colors:
  background: "#0b0d12"
  text-primary: "#e6e9ef"
  text-secondary: "#9aa4b2"
  text-muted: "#6b7280"
  accent: "#7c3aed"
  primary: "#7c3aed"
  surface: "#151922"
  border: "#1f2430"
  border-subtle: "#2a3140"
  success: "#34d399"
  error: "#f87171"
  primary-hover: "#6d28d9"
  accent-1: "#a78bfa"
  accent-2: "#22d3ee"
typography:
  heading: "Geist, system-ui, sans-serif"
  body: "Geist, system-ui, sans-serif"
  mono: "Geist Mono, monospace"
  scale:
    h1: "64px / 600 / 1.05"
    h2: "40px / 600 / 1.15"
    h3: "22px / 500 / 1.35"
    body: "15px / 400 / 1.7"
    label: "12px / 500 / 1.4"
    code: "13px / 400 / 1.6"
spacing:
  base: "4px"
  scale: ["4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px"]
radius:
  button: "6px"
  card: "10px"
  input: "6px"
  tag: "4px"
  avatar: "50%"
shadows:
  inset: "inset 0 1px 0 rgba(255,255,255,0.04)"
  sm: "0 0 0 1px rgba(124,58,237,0.4)"
  md: "0 0 24px rgba(124,58,237,0.35)"
  lg: "0 8px 32px rgba(0,0,0,0.6)"
breakpoints:
  # mobile-first (min-width queries)
  xs: "480px"
  md: "768px"
  lg: "1024px"
---

# Forge Cli Design System

## Visual direction

The interface is dark-themed, built on `#0b0d12` with `#e6e9ef` as the primary text color. Body text sits at a very high contrast ratio of 16.0:1 against the page background. Vertical rhythm is generous, with roughly 140px of section padding. Shape language is gently rounded at 6px. The accent `#7c3aed` is highly saturated and used sparingly for emphasis.

## Layout

| Property | Value |
|---|---|
| Container max-width | 1120px |
| Section padding (Y) | 140px (8.75rem) |
| Section padding (X) | 32px (2rem) |
| Section rhythm | varied |
| Grid gap | 16px (1rem) |
| Split (two-column) sections | 5 |
| Navigation | hamburger-only |
| Sidebar | present |
| Hero region | present |
| Fixed chrome | stickyHeader, stickyBottom |
| Card gap | 12px (0.75rem) |
| Sticky navigation | yes |

## Color usage

| Token | Hex | Used for |
|---|---|---|
| `background` | `#0b0d12` | Page canvas. |
| `text-primary` | `#e6e9ef` | Body and heading text. |
| `text-secondary` | `#9aa4b2` | Supporting text, labels. |
| `text-muted` | `#6b7280` | Captions, placeholders, disabled text. |
| `accent` | `#7c3aed` | The signature colour — hero fills, badges, icons, glows. |
| `primary` | `#7c3aed` | Primary actions, active states, key emphasis. |
| `surface` | `#151922` | Cards and raised panels. |
| `border` | `#1f2430` | Default dividers and control outlines. |
| `border-subtle` | `#2a3140` | Low-emphasis separators. |
| `success` | `#34d399` | Positive status. |
| `error` | `#f87171` | Destructive actions and error status. |
| `primary-hover` | `#6d28d9` | Hover variant of the primary action (measured, not derived). |
| `accent-1` | `#a78bfa` | Secondary accent, decorative use. |
| `accent-2` | `#22d3ee` | Secondary accent, decorative use. |

## Typography

| Family | Used for |
|---|---|
| `Geist Mono, monospace` | `label`, `code` |
| `Geist, system-ui, sans-serif` | `h1`, `h2`, `h3`, `body` |

### Scale

| Step | Size | Weight | Line height | Tracking | Transform |
|---|---|---|---|---|---|
| `h1` | 64px (4rem) | 600 | 1.05 | -0.01em | — |
| `h2` | 40px (2.5rem) | 600 | 1.15 | — | — |
| `h3` | 22px (1.375rem) | 500 | 1.35 | — | — |
| `body` | 15px (0.9375rem) | 400 | 1.7 | — | — |
| `label` | 12px (0.75rem) | 500 | 1.4 | 0.08em | uppercase |
| `code` | 13px (0.8125rem) | 400 | 1.6 | — | — |

Weights in use: `400`, `500`, `600`.

Each step above carries its own tracking — negative on display headings, positive on labels. Apply them together, and never substitute a family that is not listed here.

## Components

### Buttons

#### Primary

| Property | Value |
|---|---|
| Background | `#7c3aed` |
| Text color | `#ffffff` |
| Padding | `10px 18px` |
| Radius | `6px` |
| Shadow | `0 0 24px rgba(124,58,237,0.35)` |
| Font size | `14px (0.875rem)` |
| Font weight | `500` |
| Height | `38px` |
| Transition | `all 120ms ease-out` |

#### Ghost

| Property | Value |
|---|---|
| Background | `#0b0d12` |
| Text color | `#9aa4b2` |
| Padding | `10px 14px` |
| Radius | `6px` |
| Border | `1px solid #1f2430` |
| Font size | `14px (0.875rem)` |
| Font weight | `500` |

### Cards

| Property | Value |
|---|---|
| Background | `#151922` |
| Padding | `24px (1.5rem)` |
| Radius | `10px` |
| Border | `1px solid #1f2430` |
| Shadow | `inset 0 1px 0 rgba(255,255,255,0.04)` |
| Shadow type | `glow` |
| Inner gap | `12px (0.75rem)` |

### Inputs

| Property | Value |
|---|---|
| Background | `#0b0d12` |
| Text color | `#e6e9ef` |
| Padding | `8px 12px` |
| Radius | `6px` |
| Border | `1px solid #2a3140` |
| Font size | `14px (0.875rem)` |
| Height | `36px` |

### Navigation

| Property | Value |
|---|---|
| Pattern | `hamburger-only` |
| Style | `floating` |
| Hamburger | `yes` |
| Sticky | `yes` |

### Badges

| Property | Value |
|---|---|
| Background | `#1f2430` |
| Text color | `#22d3ee` |
| Padding | `2px 8px` |
| Radius | `4px` |
| Font size | `11px (0.6875rem)` |
| Font weight | `500` |

### Links

| Property | Value |
|---|---|
| Color | `#22d3ee` |
| Decoration | `none` |
| Font weight | `400` |

### Footer

| Property | Value |
|---|---|
| Background | `#0b0d12` |
| Text color | `#6b7280` |
| Padding | `80px 32px` |
| Columns | `3` |
| Gap | `24px (1.5rem)` |
| Top border | `1px solid #1f2430` |

## Elevation & shadows

Elevation is **glow-based, inset**, up to 1 stacked layers.

| Token | Value |
|---|---|
| `inset` | `inset 0 1px 0 rgba(255,255,255,0.04)` |
| `sm` | `0 0 0 1px rgba(124,58,237,0.4)` |
| `md` | `0 0 24px rgba(124,58,237,0.35)` |
| `lg` | `0 8px 32px rgba(0,0,0,0.6)` |

## Iconography & imagery

| Property | Value |
|---|---|
| Icon style | duotone |
| Common sizes | 14px, 18px |
| Stroke widths | 1.25px |
| Icon count | 52 |
| Gradient icons | yes |
| Animated icons | yes |
| Image treatment | bordered |

Use icons at the sizes and stroke weights above. Do not mix icon families.

## Spacing rules

All spacing is a multiple of the **4px** base unit (97% of observed values conform).

| Step | px | rem |
|---|---|---|
| `4px` | 4px | 0.25rem |
| `8px` | 8px | 0.5rem |
| `12px` | 12px | 0.75rem |
| `16px` | 16px | 1rem |
| `24px` | 24px | 1.5rem |
| `32px` | 32px | 2rem |
| `48px` | 48px | 3rem |
| `64px` | 64px | 4rem |

### Breakpoints

The site is mobile-first — these are `min-width` queries.

| Name | Min width |
|---|---|
| `xs` | 480px |
| `md` | 768px |
| `lg` | 1024px |

## Do

- Use only the 15 tokens in `colors` — reference them by role, not by hex literal.
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
- Do not use `#7c3aed` for large background fills — it is an accent.
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
| Dominant duration | 400ms |
| Dominant easing | cubic-bezier(0.16, 1, 0.3, 1) |
| Timing personality | fluid |
| Reveal style | blur-in |
| Scroll paradigm | smooth-scroll |
| Stagger delay | 60ms |
| Staggered elements | 12 |
| Animation libraries | gsap, lenis, framer-motion |

### Transitions in use

- `all 120ms ease-out`
- `transform 400ms cubic-bezier(0.16, 1, 0.3, 1)`

### Hero entrance sequence

1. `canvas` — delay 0ms — duration 1200ms
2. `h1` — delay 200ms — duration 800ms
3. `nav` — delay 400ms — duration 500ms

### Vector & canvas animation

| Kind | Count | Size | Position |
|---|---|---|---|
| `lottie` | 2 | — | — |

## Interaction states

### Measured

Observed on the live page. The capture's `before` object is the element's **base** state, so each cell reads base → hover; `—` means that side was not captured.

| Component | Variant | Base → Hover |
|---|---|---|
| Button | — | background: — → `#6d28d9`<br>box-shadow: — → `0 0 24px #331d5f` |
| Card | `bordered` | border-color: — → `#7c3aed`<br>transform: — → `translateY(-2px)` |

Buttons transition with `all 120ms ease-out`.

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
| Logo strip | horizontal row of marks |

### Tabbed content

| Type | Bullets | Testimonial | Layout |
|---|---|---|---|
| split-panel | 3 | no | flex |

### Fixed chrome

| Role | Height | Background | Has action |
|---|---|---|---|
| stickyHeader | 56px | `#0b0d12` | yes |
| stickyBottom | 48px | `#151922` | no |

### Sticky scroll sections

| Property | Value |
|---|---|
| Type | pinned-canvas |
| Scroll blocks | 6 |
| Sticky column: SVG | yes |
| Sticky column: canvas | yes |

## Accessibility notes

| Pair | Ratio | WCAG 2.1 |
|---|---|---|
| `text-primary` on `background` | 15.98:1 | AAA |
| `text-secondary` on `background` | 7.71:1 | AAA |
| `text-muted` on `background` | 4.02:1 | **AA large text only** |
| `text-primary` on `surface` | 14.46:1 | AAA |
| `primary` on `background` | 3.41:1 | **AA large text only** |

⚠️ 2 pairings fall below the 4.5:1 minimum for body text. Darken the foreground or lighten the background before using these together at normal size.

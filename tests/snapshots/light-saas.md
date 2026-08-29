---
name: "Northwind Design System"
source: "https://northwind.io/pricing"   # observed on 2026-08-29
generated_by: "VibeDesign 3.0.0"
style: "light high-contrast spacious rounded vivid snappy interface"
colors:
  background: "#ffffff"
  text-primary: "#0f172a"
  text-secondary: "#475569"
  text-muted: "#94a3b8"
  accent: "#2563eb"
  primary: "#2563eb"
  surface: "#f8fafc"
  border: "#e2e8f0"
  border-subtle: "#cbd5e1"
  success: "#16a34a"
  warning: "#f59e0b"
  error: "#dc2626"
  primary-hover: "#1d4ed8"
typography:
  heading: "Inter, -apple-system, sans-serif"
  body: "Inter, -apple-system, sans-serif"
  mono: "Söhne Mono, monospace"
  scale:
    h1: "56px / 700 / 1.1"
    h2: "36px / 600 / 1.2"
    h3: "24px / 600 / 1.3"
    h4: "20px / 600 / 1.4"
    body: "16px / 400 / 1.6"
    small: "13px / 400 / 1.5"
    code: "14px / 400 / 1.5"
spacing:
  base: "8px"
  scale: ["8px", "16px", "24px", "32px", "48px", "64px", "96px", "128px"]
radius:
  button: "8px"
  card: "12px"
  input: "8px"
  tag: "9999px"
  avatar: "9999px"
shadows:
  sm: "0 1px 2px 0 rgba(15,23,42,0.05)"
  md: "0 4px 6px -1px rgba(15,23,42,0.1)"
  lg: "0 20px 25px -5px rgba(15,23,42,0.1)"
breakpoints:
  # mobile-first (min-width queries)
  sm: "640px"
  md: "768px"
  lg: "1024px"
  xl: "1280px"
---

# Northwind Design System

## Visual direction

The interface is light-themed, built on `#ffffff` with `#0f172a` as the primary text color. Body text sits at a very high contrast ratio of 17.9:1 against the page background. Vertical rhythm is generous, with roughly 96px of section padding. Shape language is gently rounded at 8px. The accent `#2563eb` is highly saturated and used sparingly for emphasis.

## Layout

| Property | Value |
|---|---|
| Container max-width | 1280px |
| Section padding (Y) | 96px (6rem) |
| Section padding (X) | 24px (1.5rem) |
| Section rhythm | consistent |
| Grid gap | 24px (1.5rem) |
| Split (two-column) sections | 3 |
| Navigation | standard-with-hamburger |
| Hero region | present |
| Fixed chrome | stickyHeader |
| Card gap | 16px (1rem) |
| Sticky navigation | yes |

## Color usage

| Token | Hex | Used for |
|---|---|---|
| `background` | `#ffffff` | Page canvas. |
| `text-primary` | `#0f172a` | Body and heading text. |
| `text-secondary` | `#475569` | Supporting text, labels. |
| `text-muted` | `#94a3b8` | Captions, placeholders, disabled text. |
| `accent` | `#2563eb` | The signature colour — hero fills, badges, icons, glows. |
| `primary` | `#2563eb` | Primary actions, active states, key emphasis. |
| `surface` | `#f8fafc` | Cards and raised panels. |
| `border` | `#e2e8f0` | Default dividers and control outlines. |
| `border-subtle` | `#cbd5e1` | Low-emphasis separators. |
| `success` | `#16a34a` | Positive status. |
| `warning` | `#f59e0b` | Cautionary status. |
| `error` | `#dc2626` | Destructive actions and error status. |
| `primary-hover` | `#1d4ed8` | Hover variant of the primary action (measured, not derived). |

### Dark mode overrides

| Variable | Hex |
|---|---|
| `--color-bg` | `#0f172a` |
| `--color-text` | `#f8fafc` |
| `--color-surface` | `#1e293b` |

## Typography

| Family | Used for |
|---|---|
| `Inter, -apple-system, sans-serif` | `h1`, `h2`, `h3`, `h4`, `body`, `small` |
| `Söhne Mono, monospace` | `code` |

### Scale

| Step | Size | Weight | Line height | Tracking | Transform |
|---|---|---|---|---|---|
| `h1` | 56px (3.5rem) | 700 | 1.1 | -0.02em | — |
| `h2` | 36px (2.25rem) | 600 | 1.2 | — | — |
| `h3` | 24px (1.5rem) | 600 | 1.3 | — | — |
| `h4` | 20px (1.25rem) | 600 | 1.4 | — | — |
| `body` | 16px (1rem) | 400 | 1.6 | — | — |
| `small` | 13px (0.8125rem) | 400 | 1.5 | — | — |
| `code` | 14px (0.875rem) | 400 | 1.5 | — | — |

Weights in use: `400`, `500`, `600`, `700`.

Each step above carries its own tracking — negative on display headings, positive on labels. Apply them together, and never substitute a family that is not listed here.

## Components

### Buttons

#### Primary

| Property | Value |
|---|---|
| Background | `#2563eb` |
| Text color | `#ffffff` |
| Padding | `12px 24px` |
| Radius | `8px` |
| Shadow | `0 1px 2px 0 rgba(15,23,42,0.05)` |
| Font size | `15px (0.9375rem)` |
| Font weight | `600` |
| Height | `44px` |
| Transition | `all 150ms cubic-bezier(0.4, 0, 0.2, 1)` |

#### Secondary

| Property | Value |
|---|---|
| Background | `#f8fafc` |
| Text color | `#0f172a` |
| Padding | `12px 24px` |
| Radius | `8px` |
| Border | `1px solid #e2e8f0` |
| Font size | `15px (0.9375rem)` |
| Font weight | `600` |

#### Ghost

| Property | Value |
|---|---|
| Background | `#ffffff` |
| Text color | `#2563eb` |
| Padding | `12px 16px` |
| Radius | `8px` |
| Font size | `15px (0.9375rem)` |
| Font weight | `500` |

### Cards

| Property | Value |
|---|---|
| Background | `#ffffff` |
| Padding | `32px (2rem)` |
| Radius | `12px` |
| Border | `1px solid #e2e8f0` |
| Shadow | `0 4px 6px -1px rgba(15,23,42,0.1)` |
| Shadow type | `drop` |
| Inner gap | `16px (1rem)` |

### Inputs

| Property | Value |
|---|---|
| Background | `#ffffff` |
| Text color | `#0f172a` |
| Padding | `10px 14px` |
| Radius | `8px` |
| Border | `1px solid #cbd5e1` |
| Font size | `15px (0.9375rem)` |
| Height | `42px` |

### Navigation

| Property | Value |
|---|---|
| Pattern | `standard-with-hamburger` |
| Style | `sticky` |
| Hamburger | `yes` |
| Visible links | `yes` |
| Sticky | `yes` |

### Badges

| Property | Value |
|---|---|
| Background | `#e2e8f0` |
| Text color | `#475569` |
| Padding | `4px 10px` |
| Radius | `9999px` |
| Font size | `12px (0.75rem)` |
| Font weight | `500` |

### Links

| Property | Value |
|---|---|
| Color | `#2563eb` |
| Decoration | `none` |
| Underline offset | `2px` |
| Font weight | `500` |

### Footer

| Property | Value |
|---|---|
| Background | `#f8fafc` |
| Text color | `#64748b` |
| Padding | `64px 24px` |
| Columns | `4` |
| Gap | `32px (2rem)` |
| Top border | `1px solid #e2e8f0` |

## Elevation & shadows

Elevation is **drop-shadow**, up to 2 stacked layers.

| Token | Value |
|---|---|
| `sm` | `0 1px 2px 0 rgba(15,23,42,0.05)` |
| `md` | `0 4px 6px -1px rgba(15,23,42,0.1)` |
| `lg` | `0 20px 25px -5px rgba(15,23,42,0.1)` |

## Iconography & imagery

| Property | Value |
|---|---|
| Icon style | stroke |
| Common sizes | 16px, 20px, 24px |
| Stroke widths | 1.5px, 2px |
| Icon count | 38 |
| Image treatment | rounded |
| Aspect ratios | `16 / 9`, `4 / 3` |

Use icons at the sizes and stroke weights above. Do not mix icon families.

## Spacing rules

All spacing is a multiple of the **8px** base unit (91% of observed values conform).

| Step | px | rem |
|---|---|---|
| `8px` | 8px | 0.5rem |
| `16px` | 16px | 1rem |
| `24px` | 24px | 1.5rem |
| `32px` | 32px | 2rem |
| `48px` | 48px | 3rem |
| `64px` | 64px | 4rem |
| `96px` | 96px | 6rem |
| `128px` | 128px | 8rem |

### Breakpoints

The site is mobile-first — these are `min-width` queries.

| Name | Min width |
|---|---|
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |

## Do

- Use only the 14 tokens in `colors` — reference them by role, not by hex literal.
- Snap every margin, padding and gap to the 8px spacing scale.
- Use the type scale exactly as listed; derive nothing between steps.
- Apply the per-component radius values — buttons, cards and inputs differ deliberately.
- Keep body text at or above a 4.5:1 contrast ratio against its background.
- Reuse the component values verbatim; they are measured from the live page, not approximated.

## Don't

- Do not invent colors, tints or shades that are not in this document.
- Do not introduce new fonts, weights or sizes outside the scale.
- Do not use arbitrary spacing values such as `13px` or `27px`.
- Do not apply a single global border-radius to every element.
- Do not use `#2563eb` for large background fills — it is an accent.
- Do not copy layout or wording from the source site; this document describes style only.

## Agent instructions

- Use only the tokens defined in the frontmatter of this file.
- Never invent a color; if a shade is missing, reuse the closest listed token.
- Respect the 8px spacing scale for every dimension you set.
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
| Reveal style | fade-up |
| Scroll paradigm | native |
| Stagger delay | 80ms |
| Staggered elements | 6 |
| Animation libraries | framer-motion |

### Transitions in use

- `all 150ms cubic-bezier(0.4, 0.2, 1)`
- `color 200ms ease`
- `opacity 300ms ease-out`

### Hero entrance sequence

1. `h1` — delay 0ms — duration 600ms
2. `p` — delay 120ms — duration 600ms
3. `button` — delay 240ms — duration 400ms

## Interaction states

### Measured

Observed on the live page. The capture's `before` object is the element's **base** state, so each cell reads base → hover; `—` means that side was not captured.

| Component | Variant | Base → Hover |
|---|---|---|
| Button | `btn-primary` | background: — → `#1d4ed8`<br>box-shadow: — → `0 4px 6px -1px #e7e8ea`<br>transform: — → `translateY(-1px)` |
| Card | `card` | border-color: — → `#cbd5e1`<br>box-shadow: — → `0 20px 25px -5px #e7e8ea` |
| Link | — | color: — → `#1d4ed8` |

Buttons transition with `all 150ms cubic-bezier(0.4, 0, 0.2, 1)`.

### Recommended (not observed)

The extraction measured only `:hover`. Treat these as defaults, not as facts about the source.

- **focus** — Render a visible focus ring on every interactive element — 2px, offset 2px, using `accent` or `border`.
- **active** — Apply a small positional shift or a darker fill; never remove the focus ring.
- **disabled** — Reduce opacity to ~0.5 and remove hover/active feedback entirely.

## Component anatomy

### Grids

| Grid | Structure |
|---|---|
| pricing grid | 3 columns |

### Tabbed content

| Type | Bullets | Testimonial | Layout |
|---|---|---|---|
| split-panel | 4 | yes | grid |

### Fixed chrome

| Role | Height | Background | Has action |
|---|---|---|---|
| stickyHeader | 64px | `#ffffff` | yes |

### Sticky scroll sections

| Property | Value |
|---|---|
| Type | two-column |
| Scroll blocks | 4 |
| Sticky column: image | yes |

### Case/work grid

| Property | Value |
|---|---|
| Columns | 3 |
| Entries | 9 |
| Gap | 24px (1.5rem) |
| Thumbnail radius | 12px |
| Thumbnail | yes |
| Tags | yes |

## Accessibility notes

| Pair | Ratio | WCAG 2.1 |
|---|---|---|
| `text-primary` on `background` | 17.85:1 | AAA |
| `text-secondary` on `background` | 7.58:1 | AAA |
| `text-muted` on `background` | 2.56:1 | **fails** |
| `text-primary` on `surface` | 17.06:1 | AAA |
| `primary` on `background` | 5.17:1 | AA |

⚠️ 1 pairing falls below the 4.5:1 minimum for body text. Darken the foreground or lighten the background before using these together at normal size.

# Design System
Extracted from: northwind.io

This design system defines the visual DNA of the product. Use it to build ANY page — pricing, docs, about, settings, onboarding — in the same visual language. Sub-pages will contain components not present on the main page (tables, tabs, modals, steppers, etc.). Derive them from the rules below.

## Design Prompt

## Design DNA
When you encounter a component that doesn't exist in this system, derive it from these core principles:

**Surface:** Page ground is `#ffffff`. Primary surface is white or `#ffffff`. Elevated elements (cards, modals, dropdowns) use white with subtle border `rgba(0,0,0,0.08)`. Keep the light, open feel.
**Shape:** Interactive radius = `9999px`. Container radius = `6px`. New components inherit these radii.
**Elevation:** Brutalist — hard `4px 4px 0` shadows, zero blur.
**Color derivation:** Primary action = `#2563eb`. Destructive: `#ef4444`. Success: `#22c55e`. Warning: `#f59e0b`.
**Type:** Headings "Inter, -apple-system, sans-serif" (600–800), body "Söhne Mono, monospace" (400–500). Never add a third typeface.
**Interaction:** Hover `brightness(0.95)` 150–200ms ease-out. Focus `outline 2px solid #2563eb offset 2px`. Active `scale(0.98)`.

## Color Tokens
- `--color-primary`: `#2563eb`
- `--color-brand-accent`: `#16a34a`
- primary-action: `#2563eb`
- background: `#ffffff`
- destructive: `#ef4444`
- success: `#22c55e`
- warning: `#f59e0b`
- muted-text: `rgba(0,0,0,0.4)`
- border: `rgba(0,0,0,0.08)`

## Typography Tokens
- Display: "Inter, -apple-system, sans-serif"
- Body: "Söhne Mono, monospace"
- H1: `56px/700`
- H2: `36px/600`
- Body: `16px/400`
- Weights: 400, 500, 600, 700

## Shadow Tokens
- shadow-button-primary: `0 1px 2px 0 rgba(15,23,42,0.05)`
- shadow-card-resting: `0 4px 6px -1px rgba(15,23,42,0.1)`
- shadow-card-hover: `0 20px 25px -5px rgba(15,23,42,0.1)`

## Shape Tokens
- `6px`
- `8px`
- `12px`
- `9999px`

## Component Patterns
**Navigation:** Sticky, `#ffffff` bg. `border-bottom:1px solid rgba(0,0,0,0.06)`. Logo left, CTA right.
**Primary button:** `8px` radius, `#2563eb` bg, text `#ffffff`, height `44px`, padding `12px 24px`, font `15px/600` "Inter, -apple-system, sans-serif", tracking `normal`. Hover: `backgroundColor: #1d4ed8`, `transform: translateY(-1px)`, `boxShadow: 0 4px 6px -1px rgba(15,23,42,0.1)`.
  Spec: `background-color: #2563eb` · `color: #ffffff` · `padding: 12px 24px` · `border-radius: 8px` · `font-size: 15px` · `font-weight: 600` · `font-family: "Inter, -apple-system, sans-serif"` · `box-shadow: 0 1px 2px 0 rgba(15,23,42,0.05)` · `height: 44px` · `transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1)`
  Hover: `backgroundColor: #1d4ed8` · `transform: translateY(-1px)` · `boxShadow: 0 4px 6px -1px rgba(15,23,42,0.1)` → hover:-translate-y-0.5
  Transition: `all 150ms cubic-bezier(0.4, 0, 0.2, 1)`
  Active: `transform: scale(0.98); transition: transform 150ms cubic-bezier(0.4,0,0.2,1)`. `button:active { transform: scale(0.98); }`
**Ghost button:** `8px` radius, transparent bg, border `1px solid rgba(0,0,0,0.15)`, padding `12px 16px`. Hover: bg rgba(0,0,0,0.04).
  Spec: `background-color: transparent` · `border: 1px solid rgba(0,0,0,0.15)` · `color: #2563eb` · `padding: 12px 16px` · `border-radius: 8px` · `font-size: 15px` · `font-weight: 500`
**Secondary button:** `8px` radius, `#f8fafc` bg, text `#0f172a`, padding `12px 24px`, border `1px solid #e2e8f0`, font `15px/600`
  Spec: `background-color: #f8fafc` · `color: #0f172a` · `padding: 12px 24px` · `border-radius: 8px` · `border: 1px solid #e2e8f0` · `font-size: 15px` · `font-weight: 600`
**Cards:** `#ffffff` bg, layered shadow from tokens. 6px radius. Padding 24–32px. Hover: `boxShadow: 0 20px 25px -5px rgba(15,23,42,0.1)`, `borderColor: #cbd5e1`.
**Hero:** min-height 80–90dvh, `#ffffff` background. dark text (token foreground). No overlay. Headline: clamp(48px,6vw,80px) in display font. One primary CTA + one ghost, side by side. No cards above the fold.
**Inputs:** `#ffffff` bg, `1px solid #cbd5e1`, `8px` radius. Focus: outline 2px solid #2563eb offset 2px.
**Badges:** radius `9999px`, padding `4px 10px`, font `12px/500`, bg `#e2e8f0`, text `#475569`.
**Global interactive rules:** links → `color: #2563eb`, no underline, offset `2px`; `a:hover` → color: #1d4ed8.
**Hover state CSS — implement exactly:**
  `.btn-primary:hover { box-shadow: 0 4px 6px -1px rgba(15,23,42,0.1); }`

## Deriving New Components
**Tables:** Header `#f9fafb` bg, `14px/500` headers, `14px/400` cells. Row hover: `rgba(0,0,0,0.02)`.
**Tabs:** Pill — active `#2563eb` bg, white text, `9999px`. `14px/500`.
**Modals:** White bg, `rgba(0,0,0,0.08)` border. Card radius. Overlay `rgba(0,0,0,0.4)`.
**Toggles:** Track `44×24px`. Active `#2563eb`. Inactive `#d1d5db`.
**Toast:** Card surface + left border `3px solid` (primary/success/error).
**Progress:** Track `4–8px` height, `9999px` radius. Fill `#2563eb`.
**Tooltips:** `#1a1a1a bg`, `6px` radius, `8px 12px` padding.
**Form elements:** Inherit input styles. Checked state `#2563eb`.

## Shared Across All Pages
Navigation and footer identical on every page.
Footer: bg `#f8fafc`, text `#64748b`, padding `64px 24px`.

@import url('https://fonts.googleapis.com/css2?family=Inter,+-apple-system,+sans-serif:wght@400;500;600;700;800&family=Söhne+Mono,+monospace:wght@400;500;600;700;800&display=swap');
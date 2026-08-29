# Design System
Extracted from: posthog.com

This design system defines the visual DNA of the product. Use it to build ANY page — pricing, docs, about, settings, onboarding — in the same visual language. Sub-pages will contain components not present on the main page (tables, tabs, modals, steppers, etc.). Derive them from the rules below.

## Design Prompt

## Design DNA
When you encounter a component that doesn't exist in this system, derive it from these core principles:

**Surface:** Page ground is `#eeefe9`. Primary surface is white or `#eeefe9`. Elevated elements (cards, modals, dropdowns) use white with subtle border `rgba(0,0,0,0.08)`. Keep the light, open feel.
**Shape:** Interactive radius = `9999px`. Container radius = `4px`. New components inherit these radii.
**Elevation:** Brutalist — hard `4px 4px 0` shadows, zero blur.
**Color derivation:** Primary action = `#cd8407`. Destructive: `#ef4444`. Success: `#22c55e`. Warning: `#f59e0b`.
**Type:** "RoundHog". Hierarchy through weight only.
**Interaction:** Hover `brightness(0.95)` 150–200ms ease-out. Focus `outline 2px solid #cd8407 offset 2px`. Active `scale(0.98)`.

## Color Tokens
- primary-action: `#cd8407`
- background: `#eeefe9`
- destructive: `#ef4444`
- success: `#22c55e`
- warning: `#f59e0b`
- muted-text: `rgba(0,0,0,0.4)`
- border: `rgba(0,0,0,0.08)`

## Typography Tokens
- Font: "RoundHog"
- H1: `36px/800`
- H2: `30px/700`
- Body: `18px/500`
- Weights: 400, 500, 700

## Shadow Tokens
- shadow-sm: `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.25) 0px 25px 50px -12px`
- shadow-md: `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.1) 0px 2px 4px -2px`
- shadow-lg: `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(255, 255, 255, 0.4) 0px 0px 6px 2px`

## Shape Tokens
- `4px`
- `6px`
- `6px 6px 0px 0px`
- `8px`
- `40%`
- `9999px`

## Spacing Tokens
- Container: `1200px`

## Component Patterns
**Navigation:** Sticky. Starts transparent, transitions on scroll past 80px to `rgba(255,255,255,0.92)` + `backdrop-filter:blur(12px)` + `border-bottom:1px solid rgba(0,0,0,0.06)`. Logo left, CTA right.
**Primary button:** `6px` radius, `#cd8407` bg, text `#23251d`, height `31.5px`, padding `0px`, font `16px/400` "RoundHog". Hover: `background-color: rgb(var(--bg))`, `opacity: 1`.
  Spec: `background-color: #cd8407` · `color: #23251d` · `padding: 0px` · `border-radius: 6px` · `font-size: 16px` · `font-weight: 400` · `font-family: "RoundHog"` · `border: 1px solid rgb(177, 120, 22)` · `height: 31.5px` · `transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), text-decoration-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), fill 0.15s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.15s cubic-bezier(0.4, 0, 0.2, 1)`
  Hover: `background-color: rgb(var(--bg))` · `opacity: 1` → hover:opacity-100
  Transition: `color 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), text-decoration-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), fill 0.15s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.15s cubic-bezier(0.4, 0, 0.2, 1)`
  Active: `transform: scale(0.98); transition: transform 150ms cubic-bezier(0.4,0,0.2,1)`. `button:active { transform: scale(0.98); }`
**Ghost button:** `4px` radius, transparent bg, border `1px solid rgba(0,0,0,0.15)`, padding `2px 8px`. Hover: bg rgba(0,0,0,0.04).
  Spec: `background-color: transparent` · `border: 1px solid rgba(0,0,0,0.15)` · `color: #23251d` · `padding: 2px 8px` · `border-radius: 4px` · `font-size: 13px` · `font-weight: 500`
**Secondary button:** `4px` radius, `#000000` bg, text `#23251d`, padding `2px 8px`, font `13px/500`
  Spec: `background-color: #000000` · `color: #23251d` · `padding: 2px 8px` · `border-radius: 4px` · `font-size: 13px` · `font-weight: 500`
**Cards:** `#eeefe9` bg, layered shadow from tokens. 4px radius. Padding 24–32px.
**Hero:** Light background (`#eeefe9`). Dark text on light. No overlay, no full-bleed photo. Headline: clamp(48px,6vw,80px)/800 in display font. Primary CTA with `#cd8407` + ghost, side by side. Generous padding (80–120px vertical).
**Decorative background:** Subtle, non-intrusive SVG elements used as section atmosphere. Keep them minimal — `position:absolute, z-index:-1, pointer-events:none`, opacity 0.05–0.12. Do NOT add grid lines, crop marks, dot patterns, or any strong geometric overlays. The decoration should be barely noticeable — if it draws attention, it's too much.
**Custom cursor:** CSS `cursor: url(...)` — custom cursor image on interactive elements. Applied to: `.cursor-play`.
**Global interactive rules:** links → `color: #23251d`, no underline; `[type="checkbox"]:checked:hover` → background-color: currentcolor, border-color: transparent; `[type="radio"]:checked:hover` → background-color: currentcolor, border-color: transparent; `[type="checkbox"]:indeterminate:hover` → background-color: currentcolor, border-color: transparent.

## Deriving New Components
**Tables:** Header `#f9fafb` bg, `14px/500` headers, `14px/400` cells. Row hover: `rgba(0,0,0,0.02)`.
**Tabs:** Pill — active `#cd8407` bg, white text, `9999px`. `14px/500`.
**Modals:** White bg, `rgba(0,0,0,0.08)` border. Card radius. Overlay `rgba(0,0,0,0.4)`.
**Toggles:** Track `44×24px`. Active `#cd8407`. Inactive `#d1d5db`.
**Toast:** Card surface + left border `3px solid` (primary/success/error).
**Progress:** Track `4–8px` height, `9999px` radius. Fill `#cd8407`.
**Tooltips:** `#1a1a1a bg`, `6px` radius, `8px 12px` padding.
**Form elements:** Inherit input styles. Checked state `#cd8407`.

## Shared Across All Pages
Navigation and footer identical on every page.

@import url('https://fonts.googleapis.com/css2?family=RoundHog:wght@400;500;600;700;800&display=swap');
# Design System
Extracted from: vibedesign.tech

This design system defines the visual DNA of the product. Use it to build ANY page — pricing, docs, about, settings, onboarding — in the same visual language. Sub-pages will contain components not present on the main page (tables, tabs, modals, steppers, etc.). Derive them from the rules below.

## Design Prompt

## Design DNA
When you encounter a component that doesn't exist in this system, derive it from these core principles:

**Surface:** Page ground is `#111113`. All surfaces are dark. Elevated elements are 8–12% lighter than their parent. Use `rgba(255,255,255,0.06)` borders for definition. Never introduce white backgrounds.
**Shape:** Interactive radius = `9999px`. Container radius = `6px`. New components inherit these radii.
**Elevation:** Brutalist — hard `4px 4px 0` shadows, zero blur.
**Color derivation:** Primary action = `#3a1df5`. Destructive: `#ef4444`. Success: `#22c55e`. Warning: `#f59e0b`.
**Type:** Headings "Inter" (600–800), body "CameraPlainVariable" (400–500). Never add a third typeface.
**Interaction:** Hover `brightness(1.08)` 150–200ms ease-out. Focus `outline 2px solid #3a1df5 offset 2px`. Active `scale(0.98)`.
**Spacing:** Section `32px 0`. Grid gap `24px`. Container `1200px`.

## Color Tokens
- `--badge-bg`: `#1b1b1b`
- `--badge-text`: `#c5c1b9`
- `--badge-text-hover`: `#dcdad5`
- `--focus-color`: `#575ECF`
- `--normal-bg`: `#000`
- primary-action: `#3a1df5`
- background: `#111113`
- destructive: `#ef4444`
- success: `#22c55e`
- warning: `#f59e0b`
- muted-text: `rgba(255,255,255,0.5)`
- border: `rgba(255,255,255,0.08)`

## Typography Tokens
- Display: "Inter"
- Body: "CameraPlainVariable"
- H1: `40px/700`
- H2: `20px/700`
- Weights: 400, 500, 600, 700

## Shadow Tokens
- shadow-sm: `rgba(0, 0, 0, 0.88) 0px 0px 0px 1px, rgba(0, 0, 0, 0.04) 0px 1px 0px 0px, rgba(0, 0, 0, 0.08) 0px 2px 2px -1px, rgba(0, 0, 0, 0.08) 0px 4px 4px -2px, rgba(0, 0, 0, 0.08) 0px 8px 8px -4px, rgba(0, 0, 0, 0.08) 0px 16px 16px -8px`

## Shape Tokens
- `0px 6px 6px 0px`
- `4px`
- `6px`
- `6px 0px 0px 6px`
- `8px`
- `9999px`

## Spacing Tokens
- Section: `32px 0`
- Container: `1200px`

## Component Patterns
**Navigation:** Sticky. Starts transparent, transitions on scroll past 80px to `rgba(24,22,24,0.85)` + `backdrop-filter:blur(12px)` + `border-bottom:1px solid rgba(255,255,255,0.08)`. Logo left, CTA right.
**Primary button:** `6px` radius, `#3a1df5` bg, text `#6b6b76` (measured on `#111113`, where the two are not adjacent), height `32px`, padding `6px 12px`, font `12px/500` "Inter"
  Spec: `background-color: #3a1df5` · `color: #6b6b76` · `padding: 6px 12px` · `border-radius: 6px` · `font-size: 12px` · `font-weight: 500` · `font-family: "Inter"` · `border: 1px solid rgba(255, 255, 255, 0.08)` · `height: 32px` · `transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), text-decoration-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), fill 0.15s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.15s cubic-bezier(0.4, 0, 0.2, 1)`
  Active: `transform: scale(0.98); transition: transform 150ms cubic-bezier(0.4,0,0.2,1)`. `button:active { transform: scale(0.98); }`
**Ghost button:** `6px` radius, transparent bg, border `1px solid rgba(255, 255, 255, 0.08)`, padding `6px 12px`. Hover: bg rgba(255,255,255,0.06).
  Spec: `background-color: transparent` · `border: 1px solid rgba(255, 255, 255, 0.08)` · `color: #6b6b76` · `padding: 6px 12px` · `border-radius: 6px` · `font-size: 12px` · `font-weight: 500` · `transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), text-decoration-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), fill 0.15s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.15s cubic-bezier(0.4, 0, 0.2, 1)`
**Cards:** Dark surface, rgba(255,255,255,0.06) border. Layered shadow from tokens. 8px radius. Padding 24–32px. Hover: `transform: translateY(-2px)`, `border-color: hsl(210 100% 50% / .2)`.
**Logo marquee:** `overflow:hidden`, inner div 200% width. CSS: `@keyframes marquee { to { transform:translateX(-50%) } }` applied as `animation: marquee 30s linear infinite`. Each logo item: `padding: 0 48px` or `gap: 64px` — logos must be visually separated, never concatenated. Logos at 50–60% opacity.
**Global interactive rules:** links → `color: #c5c1b9`, no underline; EXCEPTION: Navigation links (nav a, header a) use `color: rgba(255,255,255,0.7)` default, `rgba(255,255,255,1)` on hover. The `#c5c1b9` link rule applies to in-content links and CTAs only — NOT nav bar links; `0\.35\)\]:hover` → border-color: rgba(255, 255, 255, 0.35).

## Deriving New Components
**Tables:** Header `rgba(255,255,255,0.04)` bg, `14px/500` headers, `14px/400` cells. Row hover: `rgba(255,255,255,0.03)`.
**Tabs:** Pill — active `#3a1df5` bg, white text, `9999px`. `14px/500`.
**Modals:** Dark surface, `rgba(255,255,255,0.08)` border. Card radius. Overlay `rgba(0,0,0,0.6)`.
**Toggles:** Track `44×24px`. Active `#3a1df5`. Inactive `rgba(255,255,255,0.12)`.
**Toast:** Card surface + left border `3px solid` (primary/success/error).
**Progress:** Track `4–8px` height, `9999px` radius. Fill `#3a1df5`.
**Tooltips:** `rgba(255,255,255,0.12) bg`, `6px` radius, `8px 12px` padding.
**Form elements:** Inherit input styles. Checked state `#3a1df5`.

## Shared Across All Pages
Navigation and footer identical on every page.

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=CameraPlainVariable:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');
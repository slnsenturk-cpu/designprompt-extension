# Design System
Extracted from: tiny.example

This design system defines the visual DNA of the product. Use it to build ANY page — pricing, docs, about, settings, onboarding — in the same visual language. Sub-pages will contain components not present on the main page (tables, tabs, modals, steppers, etc.). Derive them from the rules below.

## Design Prompt

## Design DNA
When you encounter a component that doesn't exist in this system, derive it from these core principles:

**Surface:** Page ground is light neutral. Primary surface is white or light neutral. Elevated elements (cards, modals, dropdowns) use white with subtle border `rgba(0,0,0,0.08)`. Keep the light, open feel.
**Shape:** Interactive radius = ``8px``. Container radius = `8px`. New components inherit these radii.
**Elevation:** Soft shadow (`0 4px 24px rgba(0,0,0,0.06–0.10)`).
**Interaction:** Hover `brightness(0.95)` 150–200ms ease-out. Focus `outline 2px solid currentColor offset 2px`. Active `scale(0.98)`.

## Color Tokens
- destructive: `#ef4444`
- success: `#22c55e`
- warning: `#f59e0b`
- muted-text: `rgba(0,0,0,0.4)`
- border: `rgba(0,0,0,0.08)`

## Component Patterns
**Navigation:** Sticky, `#fff` bg. `border-bottom:1px solid rgba(0,0,0,0.06)`. Logo left, CTA right.
**Primary button:** 0px radius, primary color from tokens, weight 600.
  Active: `transform: scale(0.98); transition: transform 150ms cubic-bezier(0.4,0,0.2,1)`. `button:active { transform: scale(0.98); }`

## Deriving New Components
**Tables:** Header `#f9fafb` bg, `14px/500` headers, `14px/400` cells. Row hover: `rgba(0,0,0,0.02)`.
**Tabs:** Underline — active `2px solid accent` bottom. `14px/500`.
**Modals:** White bg, `rgba(0,0,0,0.08)` border. Card radius. Overlay `rgba(0,0,0,0.4)`.
**Toggles:** Track `44×24px`. Active `accent`. Inactive `#d1d5db`.
**Toast:** Card surface + left border `3px solid` (primary/success/error).
**Progress:** Track `4–8px` height, `9999px` radius. Fill `accent`.
**Tooltips:** `#1a1a1a bg`, `6px` radius, `8px 12px` padding.
**Form elements:** Inherit input styles. Checked state `accent`.

## Shared Across All Pages
Navigation and footer identical on every page.

# Design System
Extracted from: forge-cli.dev

This design system defines the visual DNA of the product. Use it to build ANY page — pricing, docs, about, settings, onboarding — in the same visual language. Sub-pages will contain components not present on the main page (tables, tabs, modals, steppers, etc.). Derive them from the rules below.

## Design Prompt

## Design DNA
When you encounter a component that doesn't exist in this system, derive it from these core principles:

**Surface:** Page ground is `#0b0d12`. All surfaces are dark. Elevated elements are 8–12% lighter than their parent. Use `rgba(255,255,255,0.06)` borders for definition. Never introduce white backgrounds.
**Shape:** Interactive radius = ``4px``. Container radius = `4px`. New components inherit these radii.
**Elevation:** Glow-based — zero-offset diffused shadows.
**Color derivation:** Primary action = `#7c3aed`. Destructive: `#ef4444`. Success: `#22c55e`. Warning: `#f59e0b`.
**Type:** Headings "Geist, system-ui, sans-serif" (600–800), body "Geist Mono, monospace" (400–500). Never add a third typeface.
**Interaction:** Hover `brightness(1.08)` 150–200ms ease-out. Focus `outline 2px solid #7c3aed offset 2px`. Active `scale(0.98)`.

## Color Tokens
- `--brand-primary`: `#7c3aed`
- `--surface-1`: `#151922`
- primary-action: `#7c3aed`
- background: `#0b0d12`
- destructive: `#ef4444`
- success: `#22c55e`
- warning: `#f59e0b`
- muted-text: `rgba(255,255,255,0.5)`
- border: `rgba(255,255,255,0.08)`

## Typography Tokens
- Display: "Geist, system-ui, sans-serif"
- Body: "Geist Mono, monospace"
- H1: `64px/600`
- H2: `40px/600`
- Body: `15px/400`
- Weights: 400, 500, 600

## Shadow Tokens
- shadow-sm: `0 0 0 1px rgba(124,58,237,0.4)`
- shadow-button-primary: `0 0 24px rgba(124,58,237,0.35)`
- shadow-lg: `0 8px 32px rgba(0,0,0,0.6)`
- shadow-card-resting: `inset 0 1px 0 rgba(255,255,255,0.04)`

## Shape Tokens
- `4px`
- `6px`
- `10px`
- `50%`

## Component Patterns
**Navigation:** Hidden by default. Hamburger menu icon opens full-screen overlay. Logo: "SENTINEL Our platform helps teams ship faster than ever before." fixed top-left.
**Primary button:** `6px` radius, `#7c3aed` bg, text `#ffffff`, height `38px`, padding `10px 18px`, font `14px/500` "Geist, system-ui, sans-serif". Hover: `backgroundColor: #6d28d9`, `boxShadow: 0 0 24px rgba(124,58,237,0.35)`.
  Spec: `background-color: #7c3aed` · `color: #ffffff` · `padding: 10px 18px` · `border-radius: 6px` · `font-size: 14px` · `font-weight: 500` · `font-family: "Geist, system-ui, sans-serif"` · `box-shadow: 0 0 24px rgba(124,58,237,0.35)` · `height: 38px` · `transition: all 120ms ease-out`
  Hover: `backgroundColor: #6d28d9` · `boxShadow: 0 0 24px rgba(124,58,237,0.35)`
  Transition: `all 120ms ease-out`
  Active: `transform: scale(0.98); transition: transform 150ms cubic-bezier(0.4,0,0.2,1)`. `button:active { transform: scale(0.98); }`
**Ghost button:** `6px` radius, transparent bg, border `1px solid #1f2430`, padding `10px 14px`. Hover: bg rgba(255,255,255,0.06).
  Spec: `background-color: transparent` · `border: 1px solid #1f2430` · `color: #9aa4b2` · `padding: 10px 14px` · `border-radius: 6px` · `font-size: 14px` · `font-weight: 500`
**Cards:** backdrop-filter:blur(16px), semi-transparent bg, 4px radius. Padding 24–32px. Hover: `borderColor: #7c3aed`, `transform: translateY(-2px)`.
**Hero:** min-height 80–90dvh, `#0b0d12` background. light text (token foreground). No overlay. Headline: clamp(48px,6vw,80px) in display font. One primary CTA + one ghost, side by side. No cards above the fold.
**Inputs:** `#0b0d12` bg, `1px solid #2a3140`, `6px` radius. Focus: outline 2px solid #7c3aed offset 2px.
**Badges:** radius `4px`, padding `2px 8px`, font `11px/500`, bg `#1f2430`, text `#22d3ee`.
**Global interactive rules:** links → `color: #22d3ee`, no underline; EXCEPTION: Navigation links (nav a, header a) use `color: rgba(154,164,178,0.7)` default, `rgba(154,164,178,1)` on hover. The `#22d3ee` link rule applies to in-content links and CTAs only — NOT nav bar links.
**Noise/grain texture overlay (apply to full page):**
  `position:fixed; inset:0; z-index:2; pointer-events:none`.
  SVG feTurbulence: `type="fractalNoise" baseFrequency="0.65" numOctaves="4"`.
  Overlay fill: white (#ffffff). Opacity: 0.06. `mix-blend-mode: overlay`.
  DO NOT use `baseFrequency` above 0.65 — it creates solid grey, not grain.
  DO NOT use `mix-blend-mode: lighten` on dark backgrounds — it has no visual effect.

## Deriving New Components
**Tables:** Header `rgba(255,255,255,0.04)` bg, `14px/500` headers, `14px/400` cells. Row hover: `rgba(255,255,255,0.03)`.
**Tabs:** Underline — active `2px solid #7c3aed` bottom. `14px/500`.
**Modals:** Dark surface, `rgba(255,255,255,0.08)` border. Card radius. Overlay `rgba(0,0,0,0.6)`.
**Toggles:** Track `44×24px`. Active `#7c3aed`. Inactive `rgba(255,255,255,0.12)`.
**Toast:** Card surface + left border `3px solid` (primary/success/error).
**Progress:** Track `4–8px` height, `9999px` radius. Fill `#7c3aed`.
**Tooltips:** `rgba(255,255,255,0.12) bg`, `6px` radius, `8px 12px` padding.
**Form elements:** Inherit input styles. Checked state `#7c3aed`.

## Shared Across All Pages
Navigation and footer identical on every page.
Footer: bg `#0b0d12`, text `#6b7280`, padding `80px 32px`.

@import url('https://fonts.googleapis.com/css2?family=Geist,+system-ui,+sans-serif:wght@400;500;600;700;800&family=Geist+Mono,+monospace:wght@400;500;600;700;800&display=swap');
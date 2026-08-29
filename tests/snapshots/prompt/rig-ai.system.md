# Design System
Extracted from: rig.ai

This design system defines the visual DNA of the product. Use it to build ANY page — pricing, docs, about, settings, onboarding — in the same visual language. Sub-pages will contain components not present on the main page (tables, tabs, modals, steppers, etc.). Derive them from the rules below.

## Design Prompt

## Design DNA
When you encounter a component that doesn't exist in this system, derive it from these core principles:

**Surface:** Page ground is `#0a0a0a`. All surfaces are dark. Elevated elements are 8–12% lighter than their parent. Use `rgba(255,255,255,0.06)` borders for definition. Never introduce white backgrounds.
**Shape:** Interactive radius = ``6px``. Container radius = `6px`. New components inherit these radii.
**Elevation:** Brutalist — hard `4px 4px 0` shadows, zero blur.
**Color derivation:** Primary action = `#0a0a0a`. Destructive: `#ef4444`. Success: `#22c55e`. Warning: `#f59e0b`.
**Type:** Headings "Instrument Sans" (600–800), body "Chivo Mono" (400–500). Never add a third typeface.
**Interaction:** Hover `brightness(1.08)` 150–200ms ease-out. Focus `outline 2px solid #0a0a0a offset 2px`. Active `scale(0.98)`.
**Spacing:** Section `128px 0`. Grid gap `24px`. Container `1296px`.

## Color Tokens
- primary-action: `#0a0a0a`
- background: `#0a0a0a`
- destructive: `#ef4444`
- success: `#22c55e`
- warning: `#f59e0b`
- muted-text: `rgba(255,255,255,0.5)`
- border: `rgba(255,255,255,0.08)`

## Typography Tokens
- Display: "Instrument Sans"
- Body: "Chivo Mono"
- H1: `112px/700`
- H2: `72px/700`
- Body: `13.6px/400`
- Weights: 400, 600, 700

## Shadow Tokens
- shadow-sm: `oklch(0.6329 0.2075 31.49 / 0.4) 0px 0px 40px 0px`
- shadow-md: `rgba(240, 237, 230, 0.04) 0px 2px 0px 0px, rgba(0, 0, 0, 0.5) 0px -1px 0px 0px, rgba(0, 0, 0, 0.4) 0px 20px 60px 0px`
- shadow-lg: `rgba(0, 0, 0, 0.5) 0px 2px 8px 0px inset`
- shadow-xl: `oklch(0.6329 0.2075 31.49 / 0.4) 0px 0px 8px 0px`

## Shape Tokens
- `1px`
- `6px`
- `10px`
- `50%`

## Spacing Tokens
- Section: `128px 0`
- Container: `1296px`

## Component Patterns
**Navigation:** Sticky. Starts transparent, transitions on scroll past 80px to `rgba(24,22,24,0.85)` + `backdrop-filter:blur(12px)` + `border-bottom:1px solid rgba(255,255,255,0.08)`. Logo left, CTA right. Nav link hover: `opacity: 1`.
**Primary button:** chamfered corners via `clip-path: polygon(14px 0px, 100% 0px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0px `, no border-radius, `#0a0a0a` bg, text `#f0ede6`, height `52px`, padding `16px 32px`, font `13.6px/700` "Chivo Mono". Hover: `box-shadow: 4px 4px 0 var(--blue)`.
  Spec: `background-color: #0a0a0a` · `color: #f0ede6` · `padding: 16px 32px` · `clip-path: polygon(14px 0px, 100% 0px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0px 100%, 0px 14px)` · `font-size: 13.6px` · `font-weight: 700` · `font-family: "Chivo Mono"` · `height: 52px` · `transition: 0.2s cubic-bezier(0.25, 1, 0.5, 1)`
  NOTE: The `52px` height combined with `16px 32px` vertical padding requires the button to NOT have border-radius. The clip-path provides the chamfered corner shape. `border-radius` must be 0.
  Hover before: bg: oklch(0.6329 0.2075 31.49), color: oklch(0.1448 0 0), shadow: oklch(0.6329 0.2075 31.49 / 0.4) 0px 0px 40px 0px
  Hover after:  `box-shadow: 4px 4px 0 var(--blue)`
  Transition: `0.2s cubic-bezier(0.25, 1, 0.5, 1)`
  Active: `transform: scale(0.98); transition: transform 150ms cubic-bezier(0.4,0,0.2,1)`. `button:active { transform: scale(0.98); }`
**Nav CTA:** `12px` font, height `38.375px`, padding `19.2px`, `#0a0a0a` bg, "Chivo Mono". Compact — visually smaller than hero CTAs.
  Spec: `background-color: #0a0a0a` · `color: #f0ede6` · `padding: 19.2px` · `font-size: 12px` · `font-weight: 700` · `height: 38.375px` · `transition: opacity 0.2s`
**Ghost button:** chamfered via clip-path, transparent bg, border `2px solid rgba(10, 10, 10, 0.3)`, padding `16px 32px`. Hover: `background: rgba(240, 237, 230, 0.05)`, `background-color: rgba(240, 237, 230, 0.05)`, `background-image: initial`, `border-color: var(--paper)`.
  Spec: `background-color: transparent` · `border: 2px solid rgba(10, 10, 10, 0.3)` · `color: #0a0a0a` · `padding: 16px 32px` · `border-radius: 6px` · `font-size: 13.6px` · `font-weight: 700` · `transition: 0.2s cubic-bezier(0.25, 1, 0.5, 1)`
  Hover: `background: rgba(240, 237, 230, 0.05)` · `background-color: rgba(240, 237, 230, 0.05)` · `background-image: initial` · `border-color: var(--paper)`
  IMPORTANT: This ghost button appears on the `#ed462d` hero background. Ensure border color is visible against that background — use a darker/contrasting border, not white.
  clip-path: same chamfered polygon as primary button.
**Secondary button:** chamfered via clip-path, `#0a0a0a` bg, text `#f0ede6`, padding `19.2px`, font `12px/700`
  Spec: `background-color: #0a0a0a` · `color: #f0ede6` · `padding: 19.2px` · `font-size: 12px` · `font-weight: 700`
**Cards:** backdrop-filter:blur(16px), semi-transparent bg, 6px radius. Padding 24–32px. Hover: `opacity: 0.28`, `transition: opacity`.
**Hero:** min-height 100dvh, background-size:cover, `rgba(0,0,0,0.4)` overlay. White text. Headline: clamp(48px,7vw,88px) in display font. One primary CTA + one ghost, side by side.
**Inputs:** `inherit` bg, `1px solid rgba(240, 237, 230, 0.15)`, `6px` radius. Focus: outline 2px solid #0a0a0a offset 2px.
**Badges:** radius `0px`, padding `8px 16px`, font `12px/400`, bg `#0a0a0a`, text `#ed462d`.
**Logo marquee:** `overflow:hidden`, inner div 200% width. CSS: `@keyframes marquee { to { transform:translateX(-50%) } }` applied as `animation: marquee 30s linear infinite`. Each logo item: `padding: 0 48px` or `gap: 64px` — logos must be visually separated, never concatenated. Logos at 50–60% opacity.
**Pricing grid:** repeat(2,1fr), gap 24px, align-items:stretch.
**Accordion:** 16–18px semibold question, muted answer. max-height transition. Chevron rotates 180° on open. border-bottom between items.
**Decorative background:** Subtle, non-intrusive SVG elements used as section atmosphere. Keep them minimal — `position:absolute, z-index:-1, pointer-events:none`, opacity 0.05–0.12. Do NOT add grid lines, crop marks, dot patterns, or any strong geometric overlays. The decoration should be barely noticeable — if it draws attention, it's too much.
**Masonry grid:** 3-column masonry layout (css-grid), 5 items. Heights vary from 210px to 420px. Use CSS `column-count: 3` or JS masonry library. Each card: `background: #000000; border: 1px solid rgba(255,255,255,0.06); transition: background-color 150ms`. Hover: `background-color: #232529`. No shadow, no transform — ONLY background color changes.
**Animated system diagram — primary communication device** (1000×500px): 4 paths, 0 circles, 10 SMIL animations. Colors: rgba(240,237,230,0.08), var(--ink), rgba(240,237,230,0.3), rgba(10,10,10,0.95), rgba(240,237,230,0.15), rgba(240,237,230,0.4). Labels: "SENTINEL Our platform helps teams ship faster than ever before.", "SENTINEL Our platform helps teams ship faster than ever before.", "SENTINEL Our platform helps teams ship faster than ever before.", "SENTINEL Our platform helps teams ship faster than ever before.", "SENTINEL Our platform helps teams ship faster than ever before.", "SENTINEL Our platform helps teams ship faster than ever before.", "SENTINEL Our platform helps teams ship faster than ever before.", "SENTINEL Our platform helps teams ship faster than ever before.".
  This diagram replaces body copy — the user reads the system by watching it operate. It is the highest-trust visual on the page.
  Animated dots (8–12px circles) follow `<animateMotion>` paths tracing rails and connections. Colors match their category accent. Connection lines: 1px, extending to imply continuity.
  Do NOT simplify to a static diagram — the motion is the message.
**SVG diagram** (900×900px): 12 paths, 10 circles. Colors: rgba(240,237,230,0.1), rgba(240,237,230,0.025), rgba(240,237,230,0.06), rgba(240,237,230,0.07), rgba(240,237,230,0.08), var(--red).  Recreate as inline SVG.
**Section background decorations — structural atmosphere:**
  Each decorated section carries a background SVG below the content layer. These are NOT optional — they prevent solid-color sections from feeling sterile. Their function is spatial character without photography.
  - **Radial rays** (on #ed462d): 5 lines from convergence point toward edges — implies centrality, focus, authority. `position:absolute; inset:0; z-index:0; pointer-events:none; overflow:hidden`. Colors: currentColor. opacity: 0.08. Implement as SVG `<line>` elements from center, or CSS `conic-gradient` at very low opacity.
  - **Radial rays** (on page bg): 12 lines from convergence point toward edges — implies centrality, focus, authority. `position:absolute; inset:0; z-index:0; pointer-events:none; overflow:hidden`. Colors: rgba(240,237,230,0.1), rgba(240,237,230,0.025), rgba(240,237,230,0.06), rgba(240,237,230,0.07). opacity: 1. Implement as SVG `<line>` elements from center, or CSS `conic-gradient` at very low opacity.
  Rule: if the decoration draws attention, it is too strong — reduce opacity. If the section feels like a flat color block, the decoration is missing.
**Icon system:** `16px` icons consistently paired with feature headings. Filled SVG icons. Color: `#ed462d`. Gap: `12–16px`.
**Global interactive rules:** links → `color: #0a0a0a`, no underline; EXCEPTION: Navigation links (nav a, header a) use `color: rgba(240,238,230,0.7)` default, `rgba(240,238,230,1)` on hover. The `#0a0a0a` link rule applies to in-content links and CTAs only — NOT nav bar links; `mix-blend-mode: lighten` on overlaid elements.
**Hover state CSS — implement exactly:**
  `.btn-primary:hover { box-shadow: [blue]; }`
  `.btn-dark:hover { box-shadow: [red]; }`
  `.btn-ghost:hover { background: rgba(240, 237, 230, 0.05); border-color: [paper]; }`
**Noise/grain texture overlay (apply to full page):**
  `position:fixed; inset:0; z-index:2; pointer-events:none`.
  SVG feTurbulence: `type="fractalNoise" baseFrequency="0.65" numOctaves="4"`.
  Overlay fill: white (#ffffff). Opacity: 0.06. `mix-blend-mode: overlay`.
  DO NOT use `baseFrequency` above 0.65 — it creates solid grey, not grain.
  DO NOT use `mix-blend-mode: lighten` on dark backgrounds — it has no visual effect.

## Deriving New Components
**Tables:** Header `rgba(255,255,255,0.04)` bg, `14px/500` headers, `14px/400` cells. Row hover: `rgba(255,255,255,0.03)`.
**Tabs:** Underline — active `2px solid #0a0a0a` bottom. `14px/500`.
**Modals:** Dark surface, `rgba(255,255,255,0.08)` border. Card radius. Overlay `rgba(0,0,0,0.6)`.
**Toggles:** Track `44×24px`. Active `#0a0a0a`. Inactive `rgba(255,255,255,0.12)`.
**Toast:** Card surface + left border `3px solid` (primary/success/error).
**Progress:** Track `4–8px` height, `9999px` radius. Fill `#0a0a0a`.
**Tooltips:** `rgba(255,255,255,0.12) bg`, `6px` radius, `8px 12px` padding.
**Form elements:** Inherit input styles. Checked state `#0a0a0a`.

## Shared Across All Pages
Navigation and footer identical on every page.
Footer: bg `#0a0a0a`, text `#f0ede6`, padding `64px 0px 160px`.

@import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700;800&family=Chivo+Mono:wght@400;500;600;700;800&family=Chalet:wght@400;500;600;700;800&family=Geist+Pixel+Square:wght@400;500;600;700;800&display=swap');
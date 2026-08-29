Analysis confidence: High
> ⚠ **Primary action color could not be determined confidently.** Three extraction signals disagreed: button says `#0a0a0a`, CSS var says `none`, frequency says `#ed462d`. The color below is a best guess — verify against the live site before shipping.
**Use the exact hex colors, px values, and tokens specified in this prompt. Prefer extracted values over framework defaults (shadcn, Tailwind, component library defaults).**
Here is the **Component System** extracted from rig.ai.
Use as specification for your implementation. Values are measured from the live site — do not substitute with framework defaults.
Source: rig.ai · Page type: landing page
## Design Prompt
### Core Spec (Priority)
If any later detail conflicts, this section wins.
- Base background: `#0a0a0a`
 Use ONLY this exact value for the page/body background. Do NOT substitute with `bg-white`, `bg-background`, `bg-slate-50`, `bg-zinc-50`, shadcn `--background` default, or any other neutral. The entire page renders on this color.
- Primary action color: `#0a0a0a`
 Use ONLY this exact hex for primary CTAs, buttons, focus rings, and active states. Do NOT substitute with Tailwind `blue-500`, `indigo-600`, `violet-600`, shadcn `--primary` default, or any other color. If a component you generate doesn't reference this token, the component is wrong.
- Heading typeface: "Chalet"
- Body/UI typeface: "Instrument Sans"
- Core component radius family starts at `1px`
- Motion base duration: `300ms`
### Design Direction
**Overall character (context)** Dark-first SaaS with saturated cool accents. **Section rhythm & color hierarchy (context)** Consistently dark (`#0a0a0a` base). **Image usage & visual treatment (context)** Full-bleed cinematic photography as section atmosphere — wide, moody, environmental. **Typography (context)** Two-font system: "Chalet" for headings (112px/700); "Instrument Sans" for body and UI (13.6px/400, line-height 21.76px). **Color usage (context)** Dark surfaces (`#0a0a0a`). **Shape & elevation**
Moderate rounding (6px) — contemporary and neutral. Layered shadows — don't simplify to a single layer.
Brutalist elevation: hard drop-shadows with zero blur (e.g. `4px 4px 0 color`). Hover states use offset shadow as a design motif: `.btn-red:hover:hover` → `box-shadow: 4px 4px 0 var(--blue)`. `.btn-cta:hover:hover` → `box-shadow: 4px 4px 0 var(--blue)`. This is a defining interaction pattern — reproduce exactly.
Glassmorphism panels: background rgba(255,255,255,0.03–0.08), backdrop-filter:blur(12–20px), border 1px solid rgba(255,255,255,0.08–0.12). These panels float above the base surface — use them for cards, modals, nav on scroll. The frosted effect is subtle, not milky. **Animation & motion**
Motion personality: **smooth** — 300–400ms transitions. Polished, contemporary SaaS feel. Base duration: 300ms.
⚠️ **Scroll-scrub paradigm** — animations are TIED TO SCROLL POSITION, not triggered once. Use GSAP `scrub: true` or CSS `animation-timeline: scroll()`. Elements animate forward/backward as user scrolls. IntersectionObserver alone will NOT recreate this.
Nav: starts transparent → `backdrop-filter:blur(12px)` + `background:rgba(bg,0.85)` at ~80px scroll.
Ticker/marquee: `@keyframes { to { transform:translateX(-50%) } }` 30–40s linear infinite. `mix-blend-mode:lighten` — logos blend as light overlays into dark bg. **Ambient / always-on animations** (loop infinite):
- **custom** (2×, duration: 4s, 4s): Recreate with `animation-iteration-count: infinite`.
- **pulse** (1×, duration: 3s): `scale(1 → 1.05 → 1)` ease-in-out. **Color architecture — dual personality: (context)** Hero section: full-viewport `#ed462d` (DARK). **Page flow (context)** 1. **Spacing & rhythm (context)** Section padding: 128px vertical. **Component language (context)** Buttons: Primary = rounded, `#0a0a0a` fill, 13.6px, 700 weight. **Type scale (context)** H1: 112px/700, tracking: -4.48px.
### Shape Tokens
- `1px`
- `6px` (input / small)
- `10px` (component)
- `50%` (pill / large-radius)
### Iconography & Visual System
Icon system: Custom inline SVG (filled)
Inline SVG icons: 22 detected
- Size: 16x16, 20x20, 18x18
- Style: filled (48% outlined)
- Stroke weight: 2px, 2.5px
- Icon accent colors: `#ed462d`
Decorative SVG elements: 5
- 792x777px in hero
- 380x380px in signal-section
- 1000x500px in offline-section [3 gradient(s)]
- 900x900px in offline-section [animated]
- 900x900px in cta-section
### Component Patterns
**Navigation:** Sticky. Starts transparent, transitions on scroll past 80px to `rgba(24,22,24,0.85)` + `backdrop-filter:blur(12px)` + `border-bottom:1px solid rgba(255,255,255,0.08)`. Logo left, CTA right. Nav link hover: `opacity: 1`.
**Primary button:** chamfered corners via `clip-path: polygon(14px 0px, 100% 0px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0px `, no border-radius, `#0a0a0a` bg, text `#f0ede6`, height `52px`, padding `16px 32px`, font `13.6px/700` "Chivo Mono". Hover: `box-shadow: 4px 4px 0 var(--blue)`.
 Spec: `background-color: #0a0a0a` · `color: #f0ede6` · `padding: 16px 32px` · `clip-path: polygon(14px 0px, 100% 0px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0px 100%, 0px 14px)` · `font-size: 13.6px` · `font-weight: 700` · `font-family: "Chivo Mono"` · `height: 52px` · `transition: 0.2s cubic-bezier(0.25, 1, 0.5, 1)`
 NOTE: The `52px` height combined with `16px 32px` vertical padding requires the button to NOT have border-radius. The clip-path provides the chamfered corner shape. `border-radius` must be 0.
 Hover before: bg: oklch(0.6329 0.2075 31.49), color: oklch(0.1448 0 0), shadow: oklch(0.6329 0.2075 31.49 / 0.4) 0px 0px 40px 0px
 Hover after: `box-shadow: 4px 4px 0 var(--blue)`
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
**SVG diagram** (900×900px): 12 paths, 10 circles. Colors: rgba(240,237,230,0.1), rgba(240,237,230,0.025), rgba(240,237,230,0.06), rgba(240,237,230,0.07), rgba(240,237,230,0.08), var(--red). Recreate as inline SVG.
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
Recreate this visual style faithfully. Use the EXACT hex colors, px values, font names, and spacing from the tokens and specifications above.
Source: rig.ai Implementation notes:
- Prefer the extracted color tokens over Tailwind defaults (slate, zinc, neutral, etc.). Override shadcn/ui CSS variables (--primary, --radius, --background) with the values specified above.
- Use the exact px values for border-radius, padding, and font sizes. Use the exact easing functions and durations from Motion Tokens.
- When a value is not specified in this prompt, a sensible default is acceptable.
Add to global CSS:
@import url('https://fonts.googleapis.com/css2?family=Instrument%20Sans:wght@400&display=swap');
NOTE: "Chivo Mono", "Chalet", "Geist Pixel Square" are custom fonts not available on Google Fonts. Use the closest Google Fonts alternative (e.g. Inter, DM Sans, Space Grotesk for sans-serif; JetBrains Mono, Fira Code for monospace; Playfair Display for serif display) and match the weight/tracking values.
### Custom Font Files
These font files are served directly from the site — load via @font-face:
- "Chalet": https://rig.ai/SENTIN.woff2
- "Geist Pixel Square": https://rig.ai/SENTIN.woff2
- "Instrument Sans": https://rig.ai/SENTIN.woff2
- "Chivo Mono": https://rig.ai/SENTIN.woff2 Load ALL custom fonts via @font-face in global CSS:
@font-face { font-family: 'Chalet'; src: url('https://rig.ai/SENTIN.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
@font-face { font-family: 'Geist Pixel Square'; src: url('https://rig.ai/SENTIN.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
@font-face { font-family: 'Instrument Sans'; src: url('https://rig.ai/SENTIN.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
@font-face { font-family: 'Chivo Mono'; src: url('https://rig.ai/SENTIN.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
These fonts WILL load from the URLs above. Do not substitute with Google Fonts alternatives. Add to globals.css (override shadcn defaults with site tokens):
:root { --background: #0a0a0a; --foreground: #f0eee6; --card: #121212; --card-foreground: #f0eee6; --popover: #121212; --popover-foreground: #f0eee6; --primary: #0a0a0a; --primary-foreground: #ffffff; --secondary: #1e1e1e; --secondary-foreground: #f0eee6; --muted: #191919; --muted-foreground: #767676; --accent: #232323; --accent-foreground: #ffffff; --destructive: #ef4444; --destructive-foreground: #ffffff; --border: rgba(255,255,255,0.08); --input: rgba(255,255,255,0.08); --ring: #0a0a0a; --radius: 6px;
}
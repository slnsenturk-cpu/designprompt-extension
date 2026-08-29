Analysis confidence: High
> ⚠ **Primary action color could not be determined confidently.** Three extraction signals disagreed: button says `#0a0a0a`, CSS var says `none`, frequency says `#ed462d`. The color below is a best guess — verify against the live site before shipping.
**Use the exact hex colors, px values, and tokens specified in this prompt. Prefer extracted values over framework defaults (shadcn, Tailwind, component library defaults).**
Inspired by: rig.ai
Page type: landing page
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
**TL;DR:** bold, brutalist, confident. Abstract geometric decoration adds depth without photography; typography dominates visual hierarchy.
**Overall character**
Dark-first SaaS with saturated cool accents. High contrast, technically confident, engineer-facing. **Section rhythm & color hierarchy**
Consistently dark (`#0a0a0a` base). Differentiate sections through subtle surface shifts — slightly lighter sub-surfaces (8–12% opacity white overlay), thin border-top lines between sections. Never flip to white mid-page. **Image usage & visual treatment**
Full-bleed cinematic photography as section atmosphere — wide, moody, environmental. Images carry emotional weight, not informational. Glassmorphism cards (backdrop-filter: blur) float over photography.
Subtle decorative SVG elements present as background atmosphere — keep very minimal, opacity 0.05–0.10. Do NOT add grid overlays, dot patterns, or crop marks. Decoration should be barely visible.
Noise/grain texture overlay on backgrounds — apply a subtle grainy SVG or CSS noise filter (`filter: url(#noise)` or repeating SVG background-image) at ~5–15% opacity across main surfaces. Creates a tactile, editorial quality. **Typography**
Two-font system: "Chalet" for headings (83.36px/700); "Instrument Sans" for body and UI (13.6px/400, line-height 21.76px). Distinct registers — never blur the roles. **Color usage**
Dark surfaces (`#0a0a0a`). `#0a0a0a` is the primary action color — CTAs, links, focus rings, active states. `#0000ee` is secondary — specific badges or callouts, not interchangeable with primary. **Shape & elevation**
Moderate rounding (6px) — contemporary and neutral. Layered shadows — don't simplify to a single layer.
Brutalist elevation: hard drop-shadows with zero blur (e.g. `4px 4px 0 color`). Hover states use offset shadow as a design motif: `.btn-red:hover:hover` → `box-shadow: 4px 4px 0 var(--blue)`. `.btn-cta:hover:hover` → `box-shadow: 4px 4px 0 var(--blue)`. This is a defining interaction pattern — reproduce exactly.
Glassmorphism panels: background rgba(255,255,255,0.03–0.08), backdrop-filter:blur(12–20px), border 1px solid rgba(255,255,255,0.08–0.12). These panels float above the base surface — use them for cards, modals, nav on scroll. The frosted effect is subtle, not milky. **Animation & motion**
Motion personality: **smooth** — 300–400ms transitions. Polished, contemporary SaaS feel. Base duration: 300ms.
⚠️ **Scroll-scrub paradigm** — animations are TIED TO SCROLL POSITION, not triggered once. Use GSAP `scrub: true` or CSS `animation-timeline: scroll()`. Elements animate forward/backward as user scrolls. IntersectionObserver alone will NOT recreate this.
Nav: starts transparent → `backdrop-filter:blur(12px)` + `background:rgba(bg,0.85)` at ~80px scroll.
Ticker/marquee: `@keyframes { to { transform:translateX(-50%) } }` 30–40s linear infinite. `mix-blend-mode:lighten` — logos blend as light overlays into dark bg.
**Ambient / always-on animations** (loop infinite):
- **custom** (2×, duration: 4s, 4s): Recreate with `animation-iteration-count: infinite`.
- **pulse** (1×, duration: 3s): `scale(1 → 1.05 → 1)` ease-in-out. **Color architecture — dual personality:**
Hero section: full-viewport `#ed462d` (DARK).
ALL subsequent sections: `#0a0a0a` (NEAR-BLACK).
This is NOT a gradual transition — it is a HARD CUT. Hero is the only section with the vivid color. Do not bleed the hero color into body sections. The contrast between the vivid hero and dark body IS the page's dramatic structure.
Between hero and body: a full-width ticker strip (background: #000000, monospace caps) acts as a hard visual divider. **Page flow**
1. **hero** (#ed462d): "SENTINEL Our platform helps teams ship faster than ever before." Layout: stacked. CTAs: "SENTINEL Our platform helps teams ship faster than ever before.", "SENTINEL Our platform helps teams ship faster than ever before.". Visual: SENTINEL Our platform helps teams ship faster than ever before..
2. **text-block** (#0a0a0a): "SENTINEL Our platform helps teams ship faster than ever before." Layout: stacked. Visual: SENTINEL Our platform helps teams ship faster than ever before..
3. **stats/metrics** (#0a0a0a): "SENTINEL Our platform helps teams ship faster than ever before." Padding: 128px (32×4). Layout: stacked. Visual: SENTINEL Our platform helps teams ship faster than ever before..
4. **text-block** (#0a0a0a): "SENTINEL Our platform helps teams ship faster than ever before." Layout: stacked. Visual: SENTINEL Our platform helps teams ship faster than ever before..
5. **feature-grid** (#0a0a0a): "SENTINEL Our platform helps teams ship faster than ever before." Layout: multi-column-grid.
6. **stats/metrics** (#0a0a0a): "SENTINEL Our platform helps teams ship faster than ever before." Padding: 128px (32×4). Layout: split-columns. Visual: SENTINEL Our platform helps teams ship faster than ever before..
7. **feature-grid** (#0a0a0a): "SENTINEL Our platform helps teams ship faster than ever before." Padding: 128px (32×4). Layout: multi-column-grid.
8. **content** (#0a0a0a): "SENTINEL Our platform helps teams ship faster than ever before." Padding: 32px (8×4). Layout: stacked. **Spacing & rhythm**
Section padding: 128px vertical. container max-width: 90%. card gap: 24px.
Generous whitespace — sections breathe with ample vertical spacing. Premium, unhurried feel. **Spacing system:** 4px base grid (80% conformity). Common values: 4px, 8px, 12px, 16px, 20px, 24px, 28px, 32px. Use multiples of 4px for ALL spacing — padding, gap, margin. Exceptions: 2px, 6px, 9px. **Component language**
Buttons: Primary = rounded, `#0a0a0a` fill, 13.6px, 700 weight.
Ghost variant: transparent bg + border outline.
Secondary: `#0a0a0a` bg, `#f0ede6` text.
Badges: 0px, 12px, 400 weight.
Inputs: 44.1875px height, default radius, border: 1px solid rgba(240, 237, 230, 0.15). **Per-section illustrations (each is unique — do NOT reuse a template):** **Type scale**
H1: 83.36px/700, tracking: -3.3344px
H2: 52.1px/700
H3: 26.05px/700
Body: 13.6px/400, line-height: 21.76px
Label: 12.8px/400, uppercase
### Color Tokens
- primary-action: `#0a0a0a`
- accent-1: `#ed462d`
- accent-2: `#0000ee`
- accent-3: `#22c55e`
- background: `#0a0a0a`
- foreground (text): `#ffffff`
- surface: `#767676`
Color role mapping:
- **Primary action** (`#0a0a0a`): CTAs, buttons, active links, focus rings — "act here"
- **Surface base** (`#0a0a0a`): Page background, card background, modal background
- **Surface elevated** (`#767676`): Hover states, form inputs, secondary surfaces
- **Text primary** (`#ffffff`): Headings, body text, primary content
- **Text secondary** (`#767676`): Descriptions, metadata, placeholders
- **Border** (`rgba(255,255,255,0.06)`): Card edges, dividers, form borders
- **Semantic states**: Success `#22c55e` · Error `#ef4444` · Warning `#f59e0b`
### Typography Tokens
- Display/heading: "Chalet"
- Body/UI: "Instrument Sans"
- Labels/mono: "Geist Pixel Square"
Type scale (semantic roles):
- **H1 — hero display, page title:** `83.36px/700`, tracking `-3.3344px`, "Chalet"
- **H2 — section headers:** `52.1px/700`, tracking `-1.563px`, "Chalet"
- **H3 — feature titles, card headings:** `26.05px/700`, tracking `-0.7815px`, "Chalet"
- **Body — reading text (60-70ch max width):** `13.6px/400`, "Instrument Sans"
- **Label — UI labels, form fields:** `12.8px/400`, tracking `1.28px`, `uppercase`, "Geist Pixel Square"
- **Code — inline code, terminal output:** `10.4px/400`, "Chivo Mono"
### Shadow Tokens
- shadow-sm — colored glow elevation: `oklch(0.6329 0.2075 31.49 / 0.4) 0px 0px 40px 0px`
- shadow-md — layered elevation: `rgba(0, 0, 0, 0.5) 0px -1px 0px 0px, rgba(0, 0, 0, 0.4) 0px 20px 60px 0px`
- shadow-lg — inset (surface depth / border effect, not elevation): `rgba(0, 0, 0, 0.5) 0px 2px 8px 0px inset`
- shadow-xl — colored glow elevation: `oklch(0.6329 0.2075 31.49 / 0.4) 0px 0px 8px 0px`
### Shape Tokens
- `1px`
- `6px` (input / small)
- `10px` (component)
- `50%` (pill / large-radius)
### Spacing Scale
Base unit: **4px** (80% of values conform)
Scale: `4px` · `8px` · `12px` · `16px` · `20px` · `24px` · `28px` · `32px`
Use multiples of 4px for ALL spacing — padding, gap, margin.
Exceptions: 2px, 6px, 9px — use as-is where detected.
### Motion Tokens
- transition: `opacity 0.2s` — fade entrance / hover (standard responsive)
- transition: `0.2s cubic-bezier(0.25, 1, 0.5, 1)` (standard responsive)
- transition: `border-color 0.1s, color 0.1s` — border emphasis on hover (snappy, confident UI)
**Interaction patterns:**
- **Button (secondary/ghost):** background: `rgba(240, 237, 230, 0.05)`, bg → `rgba(240, 237, 230, 0.05)`, background-image: `initial`
- **Nav link:** opacity → `1`, 0.2s
- **Card / item:** transition: `fill, stroke`
- **Arrow / icon:** text → `rgba(240, 237, 230, .5)`, 0.1s
- Keyframe `btn-glitch`: from `0% { transform: translate(0px); text-shadow: none; opacity: 1; }` → to `100% { transform: translate(0px); text-shadow: none; opacity: 1; }`
- Keyframe `glitch-subtle-1`: from `0% { clip: rect(12px, 9999px, 5px, 0px); }` → to `100% { clip: rect(60px, 9999px, 100px, 0px); }`
- Keyframe `glitch-subtle-2`: from `0% { clip: rect(65px, 9999px, 100px, 0px); }` → to `100% { clip: rect(10px, 9999px, 60px, 0px); }`
- Keyframe `pulse-ring`: from `0%, 100% { opacity: 0.4; transform: scale(1); }` → to `50% { opacity: 0; transform: scale(2); }`
- Keyframe `blink`: from `0%, 100% { opacity: 1; }` → to `50% { opacity: 0; }`
- Keyframe `ticker`: from `0% { transform: translate(0px); }` → to `100% { transform: translate(-50%); }`
- Active animations:
 - `4s ease-in-out infinite signal-flicker`
- Mix-blend-modes used: lighten
### Interaction Paradigm
- ⚠️ **ANIMATION ARCHITECTURE — TWO TIERS:** **TIER 1 — HERO (Section 1):** Load-time animations ONLY, no scroll dependency. All hero elements animate on page mount using CSS `@keyframes` with staggered `animation-delay`. Initial `opacity:0` IS PERMITTED in hero because animation fires automatically within 0.4s of load — never waiting for scroll. FAILSAFE: If CSS animation fails to fire, fallback to `opacity:1` via `setTimeout(() => els.forEach(el => el.style.opacity = "1"), 500)`. **TIER 2 — CONTENT SECTIONS:** Scroll-triggered WITH mandatory failsafe. Section headings/eyebrow labels reveal on scroll entry: Initial: `opacity:0; translateY(20px)`. Revealed: `opacity:1; translateY(0)`. Transition: `0.4s ease-out`. MANDATORY DUAL FAILSAFE (both required): 1. `IntersectionObserver {threshold:0.1}`: adds `.is-visible` class on intersection. 2. Timeout: `setTimeout(() => document.querySelectorAll(".reveal-text").forEach(el => el.classList.add("is-visible")), 2000);` This guarantees animation on scroll AND visibility after 2s even if Observer never fires.
- **Hover feedback:** Explicit — components respond visually (shadow/transform) to signal interactivity.
- **Timing base:** `300ms` `ease, ease` — balanced, professional pacing.
### Iconography & Visual System
Icon system: Custom inline SVG (filled)
Inline SVG icons: 22 detected
- Size: 16x16, 20x20, 18x18
- Style: filled (48% outlined)
- Stroke weight: 2px, 2.5px
- Icon accent colors: `#ed462d`
Decorative SVG elements: 1
- 573x563px in hero
### Component Patterns
**Navigation:** Sticky. Starts transparent, transitions on scroll past 80px to `rgba(24,22,24,0.85)` + `backdrop-filter:blur(12px)` + `border-bottom:1px solid rgba(255,255,255,0.08)`. Logo left, CTA right. Nav link hover: `opacity: 1`.
**Primary button:** chamfered corners via `clip-path: polygon(14px 0px, 100% 0px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0px `, no border-radius, `#0a0a0a` bg, text `#f0ede6`, height `52.5px`, padding `16px 32px`, font `13.6px/700` "Chivo Mono". Hover: `box-shadow: 4px 4px 0 var(--blue)`.
 Spec: `background-color: #0a0a0a` · `color: #f0ede6` · `padding: 16px 32px` · `clip-path: polygon(14px 0px, 100% 0px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0px 100%, 0px 14px)` · `font-size: 13.6px` · `font-weight: 700` · `font-family: "Chivo Mono"` · `height: 52.5px` · `transition: 0.2s cubic-bezier(0.25, 1, 0.5, 1)`
 NOTE: The `52.5px` height combined with `16px 32px` vertical padding requires the button to NOT have border-radius. The clip-path provides the chamfered corner shape. `border-radius` must be 0.
 Hover before: bg: oklch(0.6329 0.2075 31.49), color: oklch(0.1448 0 0), shadow: oklch(0.6329 0.2075 31.49 / 0.4) 0px 0px 40px 0px
 Hover after: `box-shadow: 4px 4px 0 var(--blue)`
 Transition: `0.2s cubic-bezier(0.25, 1, 0.5, 1)`
 Active: `transform: scale(0.98); transition: transform 150ms cubic-bezier(0.4,0,0.2,1)`. `button:active { transform: scale(0.98); }`
**Nav CTA:** `12px` font, height `38.3906px`, padding `19.2px`, `#0a0a0a` bg, "Chivo Mono". Compact — visually smaller than hero CTAs.
 Spec: `background-color: #0a0a0a` · `color: #f0ede6` · `padding: 19.2px` · `font-size: 12px` · `font-weight: 700` · `height: 38.3906px` · `transition: opacity 0.2s`
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
**Animated system diagram — primary communication device** (938×469px): 4 paths, 0 circles, 10 SMIL animations. Colors: rgba(240,237,230,0.08), var(--ink), rgba(240,237,230,0.3). Labels: "SENTINEL Our platform helps teams ship faster than ever before.", "SENTINEL Our platform helps teams ship faster than ever before.".
 This diagram replaces body copy — the user reads the system by watching it operate. It is the highest-trust visual on the page.
 Animated dots (8–12px circles) follow `<animateMotion>` paths tracing rails and connections. Colors match their category accent. Connection lines: 1px, extending to imply continuity.
 Do NOT simplify to a static diagram — the motion is the message.
**SVG diagram** (900×900px): 12 paths, 10 circles. Colors: rgba(240,237,230,0.1), var(--red). Recreate as inline SVG.
**Section background decorations — structural atmosphere:**
 Each decorated section carries a background SVG below the content layer. These are NOT optional — they prevent solid-color sections from feeling sterile. Their function is spatial character without photography.
 - **Radial rays** (on #ed462d): 5 lines from convergence point toward edges — implies centrality, focus, authority. `position:absolute; inset:0; z-index:0; pointer-events:none; overflow:hidden`. Colors: currentColor. opacity: 0.08. Implement as SVG `<line>` elements from center, or CSS `conic-gradient` at very low opacity.
 - **Radial rays** (on page bg): 12 lines from convergence point toward edges — implies centrality, focus, authority. `position:absolute; inset:0; z-index:0; pointer-events:none; overflow:hidden`. Colors: rgba(240,237,230,0.1). opacity: 1. Implement as SVG `<line>` elements from center, or CSS `conic-gradient` at very low opacity.
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
### Layout & Page Structure
- Navigation: transparent-hero
- Container max-width: `90%`
- Section vertical padding: `128px`
- Card gap: `24px`
- Scroll animations: IntersectionObserver + fade + translateY(20px)→0
- Structure: hero → content-section
### Responsive Breakpoints
- 768px — ≈ Tailwind `md:` (78 rules)
- 1024px — ≈ Tailwind `lg:` (19 rules)
- 1280px — ≈ Tailwind `xl:` (12 rules)
**Page rhythm:** 12 sections — 6 breathing (spacious padding), 2 packed (grid/multi-col). 1 background color flip create visual breaks.
### Section Content Map
**This page has exactly 12 sections in the order listed below.** Do NOT add sections (no invented testimonials, pricing, FAQ, newsletter, team, stats, or logo-wall blocks unless explicitly listed below). Do NOT omit or reorder sections. Each section's background, layout, and content are measured from the live site:
**Scroll reveal CSS (applies to ALL sections below hero):** `.reveal-text { opacity:0; transform:translateY(20px); transition: opacity 0.4s ease-out, transform 0.4s ease-out; }` `.reveal-text.is-visible { opacity:1; transform:translateY(0); }`
Include mandatory 2s timeout failsafe (see Interaction Paradigm).
**Section 1: hero** — [SAMPLE COPY] "SENTINEL Our platform helps teams ship faster than ever before." [statement · technical · ~10 words]
 Background: #ed462d
 Layout: stacked
 Hero CTA size: `170×53px`, radius: `0px`, padding: `16px 32px`. NOTE: Much larger than nav button — treat as wide feature card, not a compact pill.
 Animation: hero loads immediately (no scroll trigger) — TIER 1 load-time animation.
 Headline words appear sequentially: each `<span>` with `@keyframes word-enter { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }`. `animation-delay`: 0s, 0.1s, 0.2s, 0.3s per word.
 FAILSAFE: `setTimeout(() => document.querySelectorAll(".hero-word").forEach(el => el.style.opacity = "1"), 500);`
 CTAs: [SAMPLE COPY] "SENTINEL Our platform helps teams ship faster than ever before." · "SENTINEL Our platform helps teams ship faster than ever before." [statement · technical · ~10 words]
 Visuals:
 - SENTINEL Our platform helps teams ship faster than ever before.
**Section 1.5: ticker-strip** (between hero and content)
 Full-width horizontal ticker bar.
 background: `#000000`; padding: `12px 0`; border-top and border-bottom: `1px solid rgba(255,255,255,0.08)`.
 Content: repeating text items separated by "·". Font: "Geist Pixel Square", 12.8px, uppercase, letter-spacing: 1.28px, color: `rgba(240,237,230,0.5)`.
 Animation: `@keyframes ticker { to { transform: translateX(-50%) } }` — 30s linear infinite.
 Inner div: width 200% containing two copies of the text for seamless loop.
 This ticker is the visual hard-cut between the hero and the content sections.
**Section 2: text-block** — [SAMPLE COPY] "SENTINEL Our platform helps teams ship faster than ever before." [statement · technical · ~10 words]
 Eyebrow label: "SENTINEL Our platform helps teams ship faster than ever before."
 Background: #0a0a0a
 Layout: stacked
 Entrance: fade-up reveal on scroll (see CSS above).
 Visuals:
 - SENTINEL Our platform helps teams ship faster than ever before.
**Section 3: stats/metrics** — [SAMPLE COPY] "SENTINEL Our platform helps teams ship faster than ever before." [statement · technical · ~10 words]
 Eyebrow label: "SENTINEL Our platform helps teams ship faster than ever before."
 Background: #0a0a0a
 Metric format: Values in "Chalet", 52–80px, 700 weight, color `#ffffff`. Labels: "Instrument Sans", 13–16px, 400 weight, color `rgba(255,255,255,0.6)`. Layout: flex row, gap 48px, centered.
 Layout: stacked
 Entrance: fade-up reveal on scroll (see CSS above).
 Visuals:
 - SENTINEL Our platform helps teams ship faster than ever before.
**Section 4: text-block** — [SAMPLE COPY] "SENTINEL Our platform helps teams ship faster than ever before." [statement · technical · ~10 words]
 Eyebrow label: "SENTINEL Our platform helps teams ship faster than ever before."
 Background: #0a0a0a
 Layout: stacked
 Entrance: fade-up reveal on scroll (see CSS above).
 Visuals:
 - SENTINEL Our platform helps teams ship faster than ever before.
**Section 5: feature-grid** — [SAMPLE COPY] "SENTINEL Our platform helps teams ship faster than ever before." [statement · technical · ~10 words]
 Eyebrow label: "SENTINEL Our platform helps teams ship faster than ever before."
 Background: #0a0a0a
 Layout: multi-column-grid
 Grid columns: `311.93px 1px 311.93px 1px 311.93px rows:216.016px`
 The `1px` columns are visual dividers (2): `background: rgba(255,255,255,0.08); height: 100%`. Do NOT use border-right on items — use actual 1px grid column dividers.
 Entrance: fade-up reveal on scroll (see CSS above).
**Section 6: stats/metrics** — [SAMPLE COPY] "SENTINEL Our platform helps teams ship faster than ever before." [statement · technical · ~10 words]
 Eyebrow label: "SENTINEL Our platform helps teams ship faster than ever before."
 Background: #0a0a0a
 Metric format: Values in "Chalet", 52–80px, 700 weight, color `#ffffff`. Labels: "Instrument Sans", 13–16px, 400 weight, color `rgba(255,255,255,0.6)`. Layout: flex row, gap 48px, centered.
 Layout: split-columns
 Entrance: fade-up reveal on scroll (see CSS above).
 Visuals:
 - SENTINEL Our platform helps teams ship faster than ever before.
**Section 7: feature-grid** — [SAMPLE COPY] "SENTINEL Our platform helps teams ship faster than ever before." [statement · technical · ~10 words]
 Eyebrow label: "SENTINEL Our platform helps teams ship faster than ever before."
 Background: #0a0a0a
 Layout: multi-column-grid
 Grid columns: `280.594px 280.602px 280.602px rows:267.805px 267.805px`
 Entrance: fade-up reveal on scroll (see CSS above).
**Section 8: content** — [SAMPLE COPY] "SENTINEL Our platform helps teams ship faster than ever before." [statement · technical · ~10 words]
 Eyebrow label: "SENTINEL Our platform helps teams ship faster than ever before."
 Background: #0a0a0a
 Layout: stacked
 Entrance: fade-up reveal on scroll (see CSS above).
**Section 9: text-block** — [SAMPLE COPY] "SENTINEL Our platform helps teams ship faster than ever before." [statement · technical · ~10 words]
 Eyebrow label: "SENTINEL Our platform helps teams ship faster than ever before."
 Background: #0a0a0a
 Layout: stacked
 Entrance: fade-up reveal on scroll (see CSS above).
 Visuals:
 - SENTINEL Our platform helps teams ship faster than ever before.
**Section 10: cta-section** — [SAMPLE COPY] "SENTINEL Our platform helps teams ship faster than ever before." [statement · technical · ~10 words]
 Eyebrow label: "SENTINEL Our platform helps teams ship faster than ever before."
 Background: #0a0a0a
 Layout: stacked
 Entrance: fade-up reveal on scroll (see CSS above).
 CTAs: [SAMPLE COPY] "SENTINEL Our platform helps teams ship faster than ever before." [statement · technical · ~10 words]
 Arrow links: "SENTINEL Our platform helps teams ship faster than ever before."
 Visuals:
 - SENTINEL Our platform helps teams ship faster than ever before.
**Section 11: faq/accordion** — [SAMPLE COPY] "SENTINEL Our platform helps teams ship faster than ever before." [statement · technical · ~10 words]
 Eyebrow label: "SENTINEL Our platform helps teams ship faster than ever before."
 Background: #0a0a0a
 Layout: stacked
 Entrance: fade-up reveal on scroll (see CSS above).
**Section 12: cta-section** — [SAMPLE COPY] "SENTINEL Our platform helps teams ship faster than ever before." [statement · technical · ~10 words]
 Layout: stacked
 Entrance: fade-up reveal on scroll (see CSS above).
 CTAs: [SAMPLE COPY] "SENTINEL Our platform helps teams ship faster than ever before." [statement · technical · ~10 words]
 Gradient stripe: `radial-gradient(oklch(0.1448 0 0) 25%, rgba(0, 0, 0, 0) 60%)`, `transform: matrix(1, 0, 0, 1, -1125, -594.141)`
 Visuals:
 - SENTINEL Our platform helps teams ship faster than ever before.
⚠️ **SCROLL REVEAL — MANDATORY IMPLEMENTATION:**
Every section below the hero starts at: `opacity:0; transform:translateY(20px); transition: opacity 0.4s ease-out, transform 0.4s ease-out`.
Implement with IntersectionObserver in useEffect:
```
useEffect(() => {
 const observer = new IntersectionObserver(
 (entries) => entries.forEach(entry => {
 if (entry.isIntersecting) {
 entry.target.style.opacity = "1";
 entry.target.style.transform = "translateY(0)";
 observer.unobserve(entry.target);
 }
 }),
 { threshold: 0.15 }
 );
 document.querySelectorAll(".reveal-section").forEach(el => observer.observe(el));
 return () => observer.disconnect();
}, []);
```
**FAILSAFE RULE:** If IntersectionObserver cannot be initialized for any reason, set ALL `.reveal-section` elements to `opacity:1; transform:none` by default. NEVER leave content permanently invisible. A broken reveal is worse than no reveal.
**Footer content**: bg `#0a0a0a`, border-top `1px solid oklch(0.9465 0.0099 87.47 / 0.14)`
 Links: "SENTINEL Our platform helps teams ship faster than ever before.", "SENTINEL Our platform helps teams ship faster than ever before."
 Columns: "SENTINEL Our platform helps teams ship faster than ever before.", "SENTINEL Our platform helps teams ship faster than ever before."
### Design Specifications **Typography Scale:**
- H1: `83.36px/73.3568px/700`, tracking `-3.3344px`, font "Chalet"
- H2: `52.1px/47.932px/700`, tracking `-1.563px`, font "Chalet"
- H3: `26.05px/24.7475px/700`, tracking `-0.7815px`, font "Chalet"
- Body: `13.6px/21.76px/400`, font "Instrument Sans"
- Label: `12.8px/normal/400`, tracking `1.28px`, `uppercase`, font "Geist Pixel Square" **Spacing:**
- Section padding: `128px 0`
- Container max-width: `90%`
- Card gap: `24px` **Icons:**
- Size: `16px`, style: filled, stroke: `1px`, color: `#ed462d` **Badges/Tags:**
- bg `#0a0a0a`, text `#ed462d`, radius `0px`, padding `8px 16px`, font `12px/400`, border `1px solid rgba(237, 70, 45, 0.2)` **Inputs:**
- border `1px solid rgba(240, 237, 230, 0.15)`, padding `13.6px 19.2px`, font `12.8px` "Chivo Mono", height `44.1875px`
- Focus: outline 2px solid accent, offset 2px **Links:**
- color `#0a0a0a`, text-decoration `none` **Footer:**
- bg `#0a0a0a`, text `#f0ede6`, padding `64px 0px 160px`, border-top `1px solid oklch(0.9465 0.0099 87.47 / 0.14)` **Font Weights Used:**
- 400, 600, 700
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
- "Chalet": https://example.com/SENTIN.woff2
- "Geist Pixel Square": https://example.com/SENTIN.woff2 Load ALL custom fonts via @font-face in global CSS:
@font-face { font-family: 'Chalet'; src: url('https://example.com/SENTIN.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
@font-face { font-family: 'Geist Pixel Square'; src: url('https://example.com/SENTIN.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
These fonts WILL load from the URLs above. Do not substitute with Google Fonts alternatives. Add to globals.css (override shadcn defaults with site tokens):
:root { --background: #0a0a0a; --foreground: #f0eee6; --card: #121212; --card-foreground: #f0eee6; --popover: #121212; --popover-foreground: #f0eee6; --primary: #0a0a0a; --primary-foreground: #ffffff; --secondary: #1e1e1e; --secondary-foreground: #f0eee6; --muted: #191919; --muted-foreground: #767676; --accent: #232323; --accent-foreground: #ffffff; --destructive: #ef4444; --destructive-foreground: #ffffff; --border: rgba(255,255,255,0.08); --input: rgba(255,255,255,0.08); --ring: #0a0a0a; --radius: 6px;
}
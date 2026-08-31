Analysis confidence: High
**Use the exact hex colors, px values, and tokens specified in this prompt. Prefer extracted values over framework defaults (shadcn, Tailwind, component library defaults).**
Inspired by: vibedesign.tech
Page type: dashboard/app
## Design Prompt
> **Design system detected: shadcn/ui** (high confidence). Override only divergent tokens from shadcn defaults
### Core Spec (Priority)
If any later detail conflicts, this section wins.
- Base background: `#111113`
 Use ONLY this exact value for the page/body background. Do NOT substitute with `bg-white`, `bg-background`, `bg-slate-50`, `bg-zinc-50`, shadcn `--background` default, or any other neutral. The entire page renders on this color.
- Primary action color: `#3a1df5`
 Use ONLY this exact hex for primary CTAs, buttons, focus rings, and active states. Do NOT substitute with Tailwind `blue-500`, `indigo-600`, `violet-600`, shadcn `--primary` default, or any other color. If a component you generate doesn't reference this token, the component is wrong.
- Heading typeface: "Inter"
- Body/UI typeface: "CameraPlainVariable"
- Core component radius family starts at `0px 6px 6px 0px`
- Motion base duration: `150ms`
### Design Direction
**TL;DR:** bold, brutalist, confident. High-contrast dark surfaces with vivid accent color create technical authority and visual focus.
**Overall character**
Dark-first SaaS with saturated cool accents. High contrast, technically confident, engineer-facing. **Section rhythm & color hierarchy**
Consistently dark (`#111113` base). Differentiate sections through subtle surface shifts — slightly lighter sub-surfaces (8–12% opacity white overlay), thin border-top lines between sections. Never flip to white mid-page. **Image usage & visual treatment**
Minimal imagery — design relies on typography, color, and space. Any visuals are functional: diagrams, UI mockups, icons. **Typography**
Single typeface: "Inter" — hierarchy via weight and size contrast. **Color usage**
Dark surfaces (`#111113`). `#3a1df5` is the primary action color — CTAs, links, focus rings, active states. `#6b6b76` is secondary — specific badges or callouts, not interchangeable with primary. **Shape & elevation**
Pill-shaped interactive elements (border-radius: 9999px) with glow elevation. Hover: glow expands. Soft-tech aesthetic.
Brutalist elevation: hard drop-shadows with zero blur (e.g. `4px 4px 0 color`). **Animation & motion**
Motion personality: **snappy** — interactions respond in <200ms. Micro-interactions feel mechanical and precise. Base duration: 150ms. Dominant easing: `cubic-bezier(0.4, 0, 0.2, 1)`.
⚠️ **Scroll-scrub paradigm** — animations are TIED TO SCROLL POSITION, not triggered once. Use GSAP `scrub: true` or CSS `animation-timeline: scroll()`. Elements animate forward/backward as user scrolls. IntersectionObserver alone will NOT recreate this.
Nav: starts transparent → `backdrop-filter:blur(12px)` + `background:rgba(bg,0.85)` at ~80px scroll.
Ticker/marquee: `@keyframes { to { transform:translateX(-50%) } }` 30–40s linear infinite. **Page flow** (2 sections detected — layout may vary)
1. **hero** (#111113): "SENTINEL Our platform helps teams ship faster than ever before." Padding: 32px (8×4). Layout: stacked.
2. **decorative** (#111113): "SENTINEL Our platform helps teams ship faster than ever before." Padding: 32px (8×4). Layout: stacked. **Layered image compositions (render ALL layers, not just one):**
Section: SENTINEL Our platform helps teams ship faster than ever before. — 11 image layers: Layer 1 (z:0, static): img — "SENTINEL Our platform helps teams ship faster than ever before." 16×16px Layer 2 (z:0, static): img — "SENTINEL Our platform helps teams ship faster than ever before." 16×16px Layer 3 (z:0, static): img — "SENTINEL Our platform helps teams ship faster than ever before." 16×16px Layer 4 (z:0, static): img — "SENTINEL Our platform helps teams ship faster than ever before." 16×16px Layer 5 (z:0, static): img — "SENTINEL Our platform helps teams ship faster than ever before." 16×16px Layer 6 (z:0, static): img — "SENTINEL Our platform helps teams ship faster than ever before." 16×16px Layer 7 (z:0, static): img — "SENTINEL Our platform helps teams ship faster than ever before." 16×16px Layer 8 (z:0, static): img — "SENTINEL Our platform helps teams ship faster than ever before." 16×16px Layer 9 (z:0, static): img — "SENTINEL Our platform helps teams ship faster than ever before." 16×16px Layer 10 (z:0, static): img — "SENTINEL Our platform helps teams ship faster than ever before." 16×16px Layer 11 (z:0, static): img — "SENTINEL Our platform helps teams ship faster than ever before." 16×16px Use position:relative on container, position:absolute on overlay layers. **Spacing & rhythm**
Section padding: 32px vertical. container max-width: 1200px.
Compact spacing — dense, information-rich layout. **Spacing system:** 4px base grid (100% conformity). Common values: 8px, 12px, 20px, 24px, 32px. Use multiples of 4px for ALL spacing — padding, gap, margin. **Component language**
Buttons: Primary = 6px, 12px.
Ghost variant: transparent bg + border outline. **Type scale**
H1: 40px/700
H2: 20px/700
### Color Tokens
- `--badge-bg`: #1b1b1b
- `--badge-text`: #c5c1b9
- `--badge-text-hover`: #dcdad5
- `--focus-color`: #575ECF
- `--normal-bg`: #000
Computed:
- primary-action: `#3a1df5`
- background: `#111113`
- foreground (text): `#ededed`
- surface: `#6b6b76`
Color role mapping:
- **Primary action** (`#3a1df5`): CTAs, buttons, active links, focus rings — "act here"
- **Surface base** (`#111113`): Page background, card background, modal background
- **Surface elevated** (`#6b6b76`): Hover states, form inputs, secondary surfaces
- **Text primary** (`#ededed`): Headings, body text, primary content
- **Text secondary** (`#6b6b76`): Descriptions, metadata, placeholders
- **Border** (`rgba(255,255,255,0.06)`): Card edges, dividers, form borders
- **Semantic states**: Success `#22c55e` · Error `#ef4444` · Warning `#f59e0b`
Brand color scale (use in Tailwind config):
- brand-50: `#f5f5fa`
- brand-100: `#e7e5f5`
- brand-200: `#cdc8ef`
- brand-300: `#a195ef`
- brand-400: `#654ff8`
- brand-500: `#3a1df5` <- extracted primary
- brand-600: `#1e00e0`
- brand-700: `#1800b8`
- brand-800: `#170689`
- brand-900: `#14095d`
### Typography Tokens
- Display/heading: "Inter"
- Body/UI: "CameraPlainVariable"
Size scale:
 - `--size`: 16px
Type scale (semantic roles):
- **H1 — hero display, page title:** `40px/700`, "Inter"
- **H2 — section headers:** `20px/700`, "Inter"
- **Code — inline code, terminal output:** `12px/400`, "JetBrains Mono"
### Shadow Tokens
- shadow-sm — glow (zero-offset): `rgba(0, 0, 0, 0.88) 0px 0px 0px 1px`
### Shape Tokens
- `--radius`: .5rem
- `--badge-radius`: 6px
- `--border-radius`: 8px
- Interactive elements (buttons, badges): `9999px` (pill)
### Spacing Scale
Base unit: **4px** (100% of values conform)
Scale: `8px` · `12px` · `20px` · `24px` · `32px`
Use multiples of 4px for ALL spacing — padding, gap, margin.
### Motion Tokens
- `--badge-transition-duration`: 0.2s
- transition: `color 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), text-decoration-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), fill 0.15s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.15s cubic-bezier(0.4, 0, 0.2, 1)` — text color hover (snappy, confident UI)
- transition: `background-color 0.2s, color 0.2s, transform 0.1s` — hover/active bg (standard responsive)
- transition: `background-color 0.2s, transform 0.1s` — hover/active bg (standard responsive)
**Interaction patterns:**
- **Card / item:** transform: `translateY(-2px)`, border → `hsl(210 100% 50% / .2)`
- Keyframe `bounce`: from `0%, 100% { transform: translateY(-25%); animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }` → to `50% { transform: none; animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }`
- Keyframe `ping`: from `75%, 100% { transform: scale(2); opacity: 0; }`
- Keyframe `pulse`: from `50% { opacity: 0.5; }`
- Keyframe `spin`: from `100% { transform: rotate(360deg); }`
- Keyframe `enter`: from `0% { opacity:; transform: translate3d(0)`
- Keyframe `exit`: from `100% { opacity:; transform: translate3d(0)`
### Interaction Paradigm
- ⚠️ **ANIMATION ARCHITECTURE — TWO TIERS:** **TIER 1 — HERO (Section 1):** Load-time animations ONLY, no scroll dependency. All hero elements animate on page mount using CSS `@keyframes` with staggered `animation-delay`. Initial `opacity:0` IS PERMITTED in hero because animation fires automatically within 0.4s of load — never waiting for scroll. FAILSAFE: If CSS animation fails to fire, fallback to `opacity:1` via `setTimeout(() => els.forEach(el => el.style.opacity = "1"), 500)`. **TIER 2 — CONTENT SECTIONS:** Scroll-triggered WITH mandatory failsafe. Section headings/eyebrow labels reveal on scroll entry: Initial: `opacity:0; translateY(20px)`. Revealed: `opacity:1; translateY(0)`. Transition: `0.4s ease-out`. MANDATORY DUAL FAILSAFE (both required): 1. `IntersectionObserver {threshold:0.1}`: adds `.is-visible` class on intersection. 2. Timeout: `setTimeout(() => document.querySelectorAll(".reveal-text").forEach(el => el.classList.add("is-visible")), 2000);` This guarantees animation on scroll AND visibility after 2s even if Observer never fires.
- **Hover feedback:** Explicit — components respond visually (shadow/transform) to signal interactivity.
- **Timing base:** `150ms` `cubic-bezier(0.4, 0, 0.2, 1)` — snappy, app-like responsiveness.
### Iconography & Visual System
Icon system: Lucide
Inline SVG icons: 24 detected
- Size: 16x16
- Style: outlined (99% outlined)
- Stroke weight: 2px
- Icon accent colors: `#c5c1b9`
Icon library: Lucide
### Component Patterns
**Navigation:** Sticky. Starts transparent, transitions on scroll past 80px to `rgba(24,22,24,0.85)` + `backdrop-filter:blur(12px)` + `border-bottom:1px solid rgba(255,255,255,0.08)`. Logo left, CTA right.
**Primary button:** `6px` radius, `#3a1df5` bg, text `#6b6b76` (measured on `#111113`, where the two are not adjacent), height `32px`, padding `6px 12px`, font `12px/500` "Inter"
 Spec: `background-color: #3a1df5` · `color: #6b6b76` · `padding: 6px 12px` · `border-radius: 6px` · `font-size: 12px` · `font-weight: 500` · `font-family: "Inter"` · `border: 1px solid rgba(255, 255, 255, 0.08)` · `height: 32px` · `transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), text-decoration-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), fill 0.15s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.15s cubic-bezier(0.4, 0, 0.2, 1)`
 Active: `transform: scale(0.98); transition: transform 150ms cubic-bezier(0.4,0,0.2,1)`. `button:active { transform: scale(0.98); }`
**Ghost button:** `6px` radius, transparent bg, border `1px solid rgba(255, 255, 255, 0.08)`, padding `6px 12px`. Hover: bg rgba(255,255,255,0.06).
 Spec: `background-color: transparent` · `border: 1px solid rgba(255, 255, 255, 0.08)` · `color: #6b6b76` · `padding: 6px 12px` · `border-radius: 6px` · `font-size: 12px` · `font-weight: 500` · `transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), text-decoration-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), fill 0.15s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.15s cubic-bezier(0.4, 0, 0.2, 1)`
**Cards:** Dark surface, rgba(255,255,255,0.06) border. Layered shadow from tokens. 8px radius. Padding 24–32px. Hover: `transform: translateY(-2px)`, `border-color: hsl(210 100% 50% / .2)`.
**Logo marquee:** `overflow:hidden`, inner div 200% width. CSS: `@keyframes marquee { to { transform:translateX(-50%) } }` applied as `animation: marquee 30s linear infinite`. Each logo item: `padding: 0 48px` or `gap: 64px` — logos must be visually separated, never concatenated. Logos at 50–60% opacity.
**Global interactive rules:** links → `color: #c5c1b9`, no underline; EXCEPTION: Navigation links (nav a, header a) use `color: rgba(255,255,255,0.7)` default, `rgba(255,255,255,1)` on hover. The `#c5c1b9` link rule applies to in-content links and CTAs only — NOT nav bar links; `0\.35\)\]:hover` → border-color: rgba(255, 255, 255, 0.35).
### Layout & Page Structure
- Navigation: transparent-hero
- Container max-width: `1200px`
- Section vertical padding: `32px`
- Structure: feature-split
### Responsive Breakpoints
- 600px — custom breakpoint (7 rules)
- 640px — ≈ Tailwind `sm:` (38 rules)
- 768px — ≈ Tailwind `md:` (16 rules)
- 1024px — ≈ Tailwind `lg:` (5 rules)
- 1400px — custom breakpoint (1 rules)
### Section Content Map
**This page has exactly 2 sections in the order listed below.** Do NOT add sections (no invented testimonials, pricing, FAQ, newsletter, team, stats, or logo-wall blocks unless explicitly listed below). Do NOT omit or reorder sections. Each section's background, layout, and content are measured from the live site:
**Scroll reveal CSS (applies to ALL sections below hero):** `.reveal-text { opacity:0; transform:translateY(20px); transition: opacity 0.4s ease-out, transform 0.4s ease-out; }` `.reveal-text.is-visible { opacity:1; transform:translateY(0); }`
Include mandatory 2s timeout failsafe (see Interaction Paradigm).
**Section 1: hero** — [SAMPLE COPY] "SENTINEL Our platform helps teams ship faster than ever before." [statement · technical · ~10 words]
 Background: #111113
 Layout: stacked
 Animation: hero loads immediately (no scroll trigger) — TIER 1 load-time animation.
 Headline words appear sequentially: each `<span>` with `@keyframes word-enter { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }`. `animation-delay`: 0s, 0.1s, 0.2s, 0.3s per word.
 FAILSAFE: `setTimeout(() => document.querySelectorAll(".hero-word").forEach(el => el.style.opacity = "1"), 500);`
**Section 1.5: ticker-strip** (between hero and content)
 Full-width horizontal ticker bar.
 background: `#000000`; padding: `12px 0`; border-top and border-bottom: `1px solid rgba(255,255,255,0.08)`.
 Content: repeating text items separated by "·". Font: "JetBrains Mono", 12.8px, uppercase, letter-spacing: 1.28px, color: `rgba(240,237,230,0.5)`.
 Animation: `@keyframes ticker { to { transform: translateX(-50%) } }` — 30s linear infinite.
 Inner div: width 200% containing two copies of the text for seamless loop.
 This ticker is the visual hard-cut between the hero and the content sections.
**Section 2: decorative** — [SAMPLE COPY] "SENTINEL Our platform helps teams ship faster than ever before." [statement · technical · ~10 words]
 Background: #111113
 Layout: stacked
 Entrance: fade-up reveal on scroll (see CSS above).
VISUAL GUIDELINES:
- Recreate each visual based on its described type, size, placement, and framing.
- Use site palette for charts/diagrams; keep perspective and placement consistent.
### Design Specifications **Typography Scale:**
- H1: `40px/50px/700`, font "Inter"
- H2: `20px/30px/700`, font "Inter" **Spacing:**
- Section padding: `32px 0`
- Container max-width: `1200px`
- Section horizontal padding: `32px` **Links:**
- color `#c5c1b9`, text-decoration `none` **Font Weights Used:**
- 400, 500, 600, 700
Recreate this visual style faithfully. Use the EXACT hex colors, px values, font names, and spacing from the tokens and specifications above.
Source: vibedesign.tech Implementation notes:
- Prefer the extracted color tokens over Tailwind defaults (slate, zinc, neutral, etc.). Override shadcn/ui CSS variables (--primary, --radius, --background) with the values specified above.
- Use the exact px values for border-radius, padding, and font sizes. Use the exact easing functions and durations from Motion Tokens.
- When a value is not specified in this prompt, a sensible default is acceptable.
- Detected stack: Tailwind CSS — use utility classes and override tailwind.config with extracted color tokens.
Add to global CSS:
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@700&family=JetBrains%20Mono:wght@400&display=swap');
NOTE: "CameraPlainVariable" is a custom font not available on Google Fonts. Use the closest Google Fonts alternative (e.g. Inter, DM Sans, Space Grotesk for sans-serif; JetBrains Mono, Fira Code for monospace; Playfair Display for serif display) and match the weight/tracking values.
### Custom Font Files
These font files are served directly from the site — load via @font-face:
- "CameraPlainVariable": https://cdn.gpteng.co/mcp-widgets/v1/fonts/SENTIN.woff2 — licence unknown; if you cannot use it, Instrument Sans or DM Sans is a close substitute (suggested, not observed) Load ALL custom fonts via @font-face in global CSS:
@font-face { font-family: 'CameraPlainVariable'; src: url('https://cdn.gpteng.co/mcp-widgets/v1/fonts/SENTIN.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
These URLs work as-is. Use them rather than guessing a lookalike; where a family is marked "licence unknown" above, the labelled substitute is the safe alternative. Add to globals.css (override shadcn defaults with site tokens):
:root { --background: #111113; --foreground: #ffffff; --card: #19191b; --card-foreground: #ffffff; --popover: #19191b; --popover-foreground: #ffffff; --primary: #3a1df5; --primary-foreground: #ffffff; --secondary: #252527; --secondary-foreground: #ffffff; --muted: #202022; --muted-foreground: #767676; --accent: #2a2a2c; --accent-foreground: #ffffff; --destructive: #ef4444; --destructive-foreground: #ffffff; --border: rgba(255,255,255,0.08); --input: rgba(255,255,255,0.08); --ring: #3a1df5; --radius: 8px;
}
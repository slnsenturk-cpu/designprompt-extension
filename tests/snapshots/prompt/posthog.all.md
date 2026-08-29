Analysis confidence: High
> ⚠ **Primary action color could not be determined confidently.** Three extraction signals disagreed: button says `#cd8407`, CSS var says `none`, frequency says `#2f80fa`. The color below is a best guess — verify against the live site before shipping.
**Use the exact hex colors, px values, and tokens specified in this prompt. Prefer extracted values over framework defaults (shadcn, Tailwind, component library defaults).**
Inspired by: posthog.com
Page type: landing page
## Design Prompt
> **Design system detected: Radix UI** (high confidence). Radix primitives detected — tokens represent the styling layer on top of headless components
### Core Spec (Priority)
If any later detail conflicts, this section wins.
- Base background: `#eeefe9`
 Use ONLY this exact value for the page/body background. Do NOT substitute with `bg-white`, `bg-background`, `bg-slate-50`, `bg-zinc-50`, shadcn `--background` default, or any other neutral. The entire page renders on this color.
- Primary action color: `#cd8407`
 Use ONLY this exact hex for primary CTAs, buttons, focus rings, and active states. Do NOT substitute with Tailwind `blue-500`, `indigo-600`, `violet-600`, shadcn `--primary` default, or any other color. If a component you generate doesn't reference this token, the component is wrong.
- Heading typeface: "RoundHog"
- Body/UI typeface: "RoundHog"
- Core component radius family starts at `4px`
- Motion base duration: `600ms`
### Design Direction
**TL;DR:** energetic, brutalist, human. Product UI screenshots are the primary visual evidence; design supports rather than competes.
**Overall character**
Light base with expressive accent (`#cd8407`). Clean foundation, color reserved for interactive moments. Consumer-friendly energy without sacrificing credibility. **Section rhythm & color hierarchy**
Consistently light throughout (`#eeefe9` base). Sections distinguish through subtle background tints — e.g. pure white vs #eeefe9 warm off-white — never dark backgrounds. Generous vertical padding (80–120px) between sections creates breathing room without color contrast. **Image usage & visual treatment**
Full-bleed cinematic photography as section atmosphere — wide, moody, environmental. Images carry emotional weight, not informational. Product UI overlaid directly on photography.
Subtle decorative SVG elements present as background atmosphere — keep very minimal, opacity 0.05–0.10. Do NOT add grid overlays, dot patterns, or crop marks. Decoration should be barely visible.
3 split-column sections — alternate text/visual side each row for scroll rhythm. **Typography**
Single typeface: "RoundHog" — hierarchy via weight and size contrast. **Color usage**
Light surfaces (`#eeefe9`). Color used sparingly — white/neutral dominates. `#cd8407` (primary action — CTAs, links, focus). `#f54e00` secondary accent — category/state/decoration, never swap with primary. Backgrounds: white + `#eeefe9` eggshell for section variation. **Shape & elevation**
Pill-shaped interactive elements (border-radius: 9999px) with glow elevation. Hover: glow expands. Soft-tech aesthetic.
Brutalist elevation: hard drop-shadows with zero blur (e.g. `4px 4px 0 color`). **Animation & motion**
Motion personality: **editorial** — 500–700ms reveals. Content enters with deliberate pace, like a magazine. Base duration: 600ms. Dominant easing: `cubic-bezier(0, 0, 0.2, 1)`.
⚠️ **Scroll-scrub paradigm** — animations are TIED TO SCROLL POSITION, not triggered once. Use GSAP `scrub: true` or CSS `animation-timeline: scroll()`. Elements animate forward/backward as user scrolls. IntersectionObserver alone will NOT recreate this.
Content slider: horizontal snap, auto-play, pause on hover.
Nav: starts transparent → `backdrop-filter:blur(12px)` + `background:rgba(bg,0.85)` at ~80px scroll.
Ticker/marquee: `@keyframes { to { transform:translateX(-50%) } }` 30–40s linear infinite.
Parallax: background moves at different speed than foreground content. 3D transform approach: `perspective` + `translateZ()` on layered elements.
**Ambient / always-on animations** (loop infinite):
- **custom** (3×, duration: 45s, 2s, 3s): Recreate with `animation-iteration-count: infinite`. **Page flow** (1 sections detected — layout may vary)
1. **hero** (#e5e7e0): "SENTINEL Our platform helps teams ship faster than ever before." Padding: 32px (8×4). Layout: split-columns. CTAs: "SENTINEL Our platform helps teams ship faster than ever before.". Visual: SENTINEL Our platform helps teams ship faster than ever before.. **Interactive components**
- **Tabbed switcher** (3 items): "SENTINEL Our platform helps teams ship faster than ever before." | "SENTINEL Our platform helps teams ship faster than ever before." | "SENTINEL Our platform helps teams ship faster than ever before." State-driven content switch — NOT a navigation component. Active item: "SENTINEL Our platform helps teams ship faster than ever before.". Implement: useState for activeTab index. Transition: crossfade 300ms. Panel layout: block. **Layered image compositions (render ALL layers, not just one):**
Section: SENTINEL Our platform helps teams ship faster than ever before. — 2 image layers: Layer 1 (z:0, static): img — "SENTINEL Our platform helps teams ship faster than ever before." 273×267px Layer 2 (z:0, static): img — "SENTINEL Our platform helps teams ship faster than ever before." 90×117px Use position:relative on container, position:absolute on overlay layers. **Spacing & rhythm**
container max-width: 1200px. card gap: 24px. **Spacing system:** 4px base grid (64% conformity). Common values: 4px, 8px, 12px, 16px, 32px, 48px, 80px. Use multiples of 4px for ALL spacing — padding, gap, margin. Exceptions: 1px, 2px, 6px, 66px. **Component language**
Buttons: Primary = 6px, `#cd8407` fill, 16px.
Ghost variant: transparent bg + border outline.
Secondary: `#000000` bg, `#23251d` text. **Per-section illustrations (each is unique — do NOT reuse a template):** **Type scale**
H1: 36px/800, tracking: -0.9px
H2: 30px/700
H3: 18px/700
Body: 18px/500, line-height: 27px
### Color Tokens
> ⚠ Color confidence: low — site may use CSS-in-JS or dynamic theming.
> Values below are computed approximations. Verify with browser DevTools.
- primary-action: `#cd8407`
- accent-1: `#f7a501`
- accent-2: `#f54e00`
- accent-3: `#2f80fa`
- background: `#eeefe9`
- foreground (text): `#000000`
Color role mapping:
- **Primary action** (`#cd8407`): CTAs, buttons, active links, focus rings — "act here"
- **Surface base** (`#eeefe9`): Page background, card background, modal background
- **Text primary** (`#000000`): Headings, body text, primary content
- **Border** (`rgba(0,0,0,0.08)`): Card edges, dividers, form borders
- **Semantic states**: Success `#22c55e` · Error `#ef4444` · Warning `#f59e0b`
Brand color scale (use in Tailwind config):
- brand-50: `#faf8f5`
- brand-100: `#f6efe5`
- brand-200: `#efe1c7`
- brand-300: `#efce95`
- brand-400: `#f9ba4e`
- brand-500: `#cd8407` <- extracted primary
- brand-600: `#e08e00`
- brand-700: `#b87400`
- brand-800: `#8a5905`
- brand-900: `#5e3e08`
### Typography Tokens
- Display/heading: "RoundHog"
- Body/UI: "IBM Plex Sans Variable"
Type scale (semantic roles):
- **H1 — hero display, page title:** `36px/800`, tracking `-0.9px`, "RoundHog"
- **H2 — section headers:** `30px/700`, tracking `-0.75px`, "RoundHog"
- **H3 — feature titles, card headings:** `18px/700`, "RoundHog"
- **Body — reading text (60-70ch max width):** `18px/500`, "RoundHog"
- **Caption — metadata, timestamps, credits:** `14px/500`, "RoundHog"
### Shadow Tokens
- shadow-sm: `rgba(0, 0, 0, 0.25) 0px 25px 50px -12px`
- shadow-md — layered elevation: `rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.1) 0px 2px 4px -2px`
- shadow-lg — glow (zero-offset): `rgba(255, 255, 255, 0.4) 0px 0px 6px 2px`
### Shape Tokens
- `4px` (input / small)
- `6px` (primary button)
- `6px 6px 0px 0px` (partial — top-attached panel or directional corner)
- `8px` (component)
- `40%` (card / container)
- `9999px` (pill / large-radius)
### Spacing Scale
Base unit: **4px** (64% of values conform)
Scale: `4px` · `8px` · `12px` · `16px` · `32px` · `48px` · `80px`
Use multiples of 4px for ALL spacing — padding, gap, margin.
Exceptions: 1px, 2px, 6px, 66px — use as-is where detected.
### Motion Tokens
- transition: `color 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), text-decoration-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), fill 0.15s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.15s cubic-bezier(0.4, 0, 0.2, 1)` — text color hover (snappy, confident UI)
- transition: `0.3s cubic-bezier(0.4, 0, 0.2, 1)` (standard responsive)
- transition: `opacity 0.7s cubic-bezier(0.4, 0, 0.2, 1)` — fade entrance / hover (dramatic, scroll-driven)
- Keyframe `slideRight`: from `0% { transform: translateX(var(--radix-toast-swipe-end-x)); }` → to `100% { transform: translateX(100%); }`
- Keyframe `rcSliderTooltipZoomDownIn`: from `0% { opacity: 0; transform: scale(0); transform-origin: 50% 100%; }` → to `100% { transform: scale(1); transform-origin: 50% 100%; }`
- Keyframe `rcSliderTooltipZoomDownOut`: from `0% { transform: scale(1); transform-origin: 50% 100%; }` → to `100% { opacity: 0; transform: scale(0); transform-origin: 50% 100%; }`
- Keyframe `wobble`: from `0%, 100% { transform: rotate(-2deg) translateX(-5px); }` → to `50% { transform: rotate(2deg) translateX(5px); }`
- Keyframe `breathe`: from `0%, 100% { transform: scale(1); }` → to `50% { transform: scale(1.03); }`
- Keyframe `develop`: from `0% { filter: grayscale(100%) brightness(200%); opacity: 0; }` → to `100% { filter: grayscale(0) brightness(100%); opacity: 1; }`
- Active animations:
 - `0.2s cubic-bezier(0.34, 1.56, 0.64, 1) both windowPopIn`
 - `0.416125s ease-out forwards rough-notation-dash`
 - `0.383875s ease-out 0.416125s forwards rough-notation-dash`
 - `5s linear forwards carousel-progress`
### Interaction Paradigm
- ⚠️ **ANIMATION ARCHITECTURE — TWO TIERS:** **TIER 1 — HERO (Section 1):** Load-time animations ONLY, no scroll dependency. All hero elements animate on page mount using CSS `@keyframes` with staggered `animation-delay`. Initial `opacity:0` IS PERMITTED in hero because animation fires automatically within 0.4s of load — never waiting for scroll. FAILSAFE: If CSS animation fails to fire, fallback to `opacity:1` via `setTimeout(() => els.forEach(el => el.style.opacity = "1"), 500)`. **TIER 2 — CONTENT SECTIONS:** Scroll-triggered WITH mandatory failsafe. Section headings/eyebrow labels reveal on scroll entry: Initial: `opacity:0; translateY(20px)`. Revealed: `opacity:1; translateY(0)`. Transition: `0.4s ease-out`. MANDATORY DUAL FAILSAFE (both required): 1. `IntersectionObserver {threshold:0.1}`: adds `.is-visible` class on intersection. 2. Timeout: `setTimeout(() => document.querySelectorAll(".reveal-text").forEach(el => el.classList.add("is-visible")), 2000);` This guarantees animation on scroll AND visibility after 2s even if Observer never fires.
- **Hover feedback:** Explicit — components respond visually (shadow/transform) to signal interactivity.
- **Timing base:** `600ms` `cubic-bezier(0, 0, 0.2, 1)` — editorial, premium deliberateness.
- **Carousel:** Auto-advancing custom pattern — content panels.
### Iconography & Visual System
Icon system: Custom inline SVG (filled)
Inline SVG icons: 6 detected
- Size: 24x24, 20x20, 18x18
- Style: filled (0% outlined)
- Stroke weight: 1px
- Icon accent colors: `#23251d`
### Component Patterns
**Navigation:** Sticky. Starts transparent, transitions on scroll past 80px to `rgba(255,255,255,0.92)` + `backdrop-filter:blur(12px)` + `border-bottom:1px solid rgba(0,0,0,0.06)`. Logo left, CTA right.
**Primary button:** `6px` radius, `#cd8407` bg, text `#23251d`, height `33.5px`, padding `0px`, font `16px/400` "RoundHog". Hover: `background-color: rgb(var(--bg))`, `opacity: 1`.
 Spec: `background-color: #cd8407` · `color: #23251d` · `padding: 0px` · `border-radius: 6px` · `font-size: 16px` · `font-weight: 400` · `font-family: "RoundHog"` · `border: 1.5px solid rgb(177, 120, 22)` · `height: 33.5px` · `transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), text-decoration-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), fill 0.15s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.15s cubic-bezier(0.4, 0, 0.2, 1)`
 Hover: `background-color: rgb(var(--bg))` · `opacity: 1` → hover:opacity-100
 Transition: `color 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), text-decoration-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), fill 0.15s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.15s cubic-bezier(0.4, 0, 0.2, 1)`
 Active: `transform: scale(0.98); transition: transform 150ms cubic-bezier(0.4,0,0.2,1)`. `button:active { transform: scale(0.98); }`
**Ghost button:** `4px` radius, transparent bg, border `1px solid rgba(0,0,0,0.15)`, padding `2px 8px`. Hover: bg rgba(0,0,0,0.04).
 Spec: `background-color: transparent` · `border: 1px solid rgba(0,0,0,0.15)` · `color: #23251d` · `padding: 2px 8px` · `border-radius: 4px` · `font-size: 13px` · `font-weight: 500`
**Secondary button:** `4px` radius, `#000000` bg, text `#23251d`, padding `2px 8px`, font `13px/500`
 Spec: `background-color: #000000` · `color: #23251d` · `padding: 2px 8px` · `border-radius: 4px` · `font-size: 13px` · `font-weight: 500`
**Cards:** `#eeefe9` bg, layered shadow from tokens. 4px radius. Padding 24–32px.
**Hero:** Light background (`#eeefe9`). Dark text on light. No overlay, no full-bleed photo. Headline: clamp(48px,6vw,80px)/800 in display font. Primary CTA with `#cd8407` + ghost, side by side. Generous padding (80–120px vertical).
**Logo marquee:** `overflow:hidden`, inner div 200% width. CSS: `@keyframes marquee { to { transform:translateX(-50%) } }` applied as `animation: marquee 30s linear infinite`. Each logo item: `padding: 0 48px` or `gap: 64px` — logos must be visually separated, never concatenated. Logos at 50–60% opacity.
**Decorative background:** Subtle, non-intrusive SVG elements used as section atmosphere. Keep them minimal — `position:absolute, z-index:-1, pointer-events:none`, opacity 0.05–0.12. Do NOT add grid lines, crop marks, dot patterns, or any strong geometric overlays. The decoration should be barely noticeable — if it draws attention, it's too much.
**Custom cursor:** CSS `cursor: url(...)` — custom cursor image on interactive elements. Applied to: `.cursor-play`.
**Global interactive rules:** links → `color: #23251d`, no underline; `[type="checkbox"]:checked:hover` → background-color: currentcolor, border-color: transparent; `[type="radio"]:checked:hover` → background-color: currentcolor, border-color: transparent; `[type="checkbox"]:indeterminate:hover` → background-color: currentcolor, border-color: transparent.
### Layout & Page Structure
- Navigation: transparent-hero
- Container max-width: `1200px`
- Card gap: `24px`
- 3 split-column section(s) — alternate text/image side
- Scroll animations: IntersectionObserver + fade + translateY(20px)→0
### Responsive Breakpoints
- 425px — custom breakpoint (4 rules)
- 482px — custom breakpoint (18 rules)
- 640px — ≈ Tailwind `sm:` (130 rules)
- 767px — ≈ Tailwind `md:` (8 rules)
- 768px — ≈ Tailwind `md:` (351 rules)
- 800px — ≈ Tailwind `md:` (1 rules)
- 900px — custom breakpoint (70 rules)
- 1024px — ≈ Tailwind `lg:` (171 rules)
### Section Content Map
**This page has exactly 1 sections in the order listed below.** Do NOT add sections (no invented testimonials, pricing, FAQ, newsletter, team, stats, or logo-wall blocks unless explicitly listed below). Do NOT omit or reorder sections. Each section's background, layout, and content are measured from the live site:
**Scroll reveal CSS (applies to ALL sections below hero):** `.reveal-text { opacity:0; transform:translateY(20px); transition: opacity 0.4s ease-out, transform 0.4s ease-out; }` `.reveal-text.is-visible { opacity:1; transform:translateY(0); }`
Include mandatory 2s timeout failsafe (see Interaction Paradigm).
**Section 1: hero** — [SAMPLE COPY] "SENTINEL Our platform helps teams ship faster than ever before." [statement · technical · ~10 words]
 Eyebrow label: "SENTINEL Our platform helps teams ship faster than ever before."
 Background: #e5e7e0
 Layout: 2-column split — left 40% text+visual, right 40% text+visual
 Hero CTA size: `261×55px`, radius: `8px`, padding: `0px`. NOTE: Much larger than nav button — treat as wide feature card, not a compact pill.
 Floating illustration cards (1 elements, scattered around hero — `position:absolute`, decorative):
 - 261×52px bg:`#eb9d2a` pos:center-bottom radius:`8px` (3D-rotated) text:"SENTINEL Our platform helps teams ship faster than ever before."
 → Implement as `position:absolute` decorative elements scattered around the hero.
 → Apply transforms and bg colors/gradients as specified above.
 Animation: hero loads immediately (no scroll trigger) — TIER 1 load-time animation.
 Headline words appear sequentially: each `<span>` with `@keyframes word-enter { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }`. `animation-delay`: 0s, 0.1s, 0.2s, 0.3s per word.
 FAILSAFE: `setTimeout(() => document.querySelectorAll(".hero-word").forEach(el => el.style.opacity = "1"), 500);`
 CTAs: [SAMPLE COPY] "SENTINEL Our platform helps teams ship faster than ever before." [statement · technical · ~10 words]
 Visuals:
 - SENTINEL Our platform helps teams ship faster than ever before.
VISUAL GUIDELINES:
- Recreate each visual based on its described type, size, placement, and framing.
- Use site palette for charts/diagrams; keep perspective and placement consistent.
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
### Design Specifications **Typography Scale:**
- H1: `36px/40px/800`, tracking `-0.9px`, font "RoundHog"
- H2: `30px/40px/700`, tracking `-0.75px`, font "RoundHog"
- H3: `18px/28px/700`, font "RoundHog"
- Body: `18px/27px/500`, font "RoundHog" **Spacing:**
- Container max-width: `1200px`
- Card gap: `24px` **Gradients:**
- `linear-gradient(268.63deg, rgb(227, 225, 228)`
- `linear-gradient(rgb(20, 30, 64)`
- `linear-gradient(rgb(253, 238, 205)` **Links:**
- color `#23251d`, text-decoration `none` **Font Weights Used:**
- 400, 500, 700
Recreate this visual style faithfully. Use the EXACT hex colors, px values, font names, and spacing from the tokens and specifications above.
Source: posthog.com Implementation notes:
- Prefer the extracted color tokens over Tailwind defaults (slate, zinc, neutral, etc.). Override shadcn/ui CSS variables (--primary, --radius, --background) with the values specified above.
- Use the exact px values for border-radius, padding, and font sizes. Use the exact easing functions and durations from Motion Tokens.
- When a value is not specified in this prompt, a sensible default is acceptable.
- Detected stack: Tailwind CSS — use utility classes and override tailwind.config with extracted color tokens.
NOTE: "RoundHog" is a custom font not available on Google Fonts. Use the closest Google Fonts alternative (e.g. Inter, DM Sans, Space Grotesk for sans-serif; JetBrains Mono, Fira Code for monospace; Playfair Display for serif display) and match the weight/tracking values.
### Custom Font Files
These font files are served directly from the site — load via @font-face:
- "IBM Plex Sans Variable": https://posthog.com/static/SENTIN.woff2
- "Fairytale": https://posthog.com/fonts/SENTIN.woff2
- "Computer Modern": https://posthog.com/fonts/SENTIN.woff
- "Squeak": https://posthog.com/fonts/SENTIN.woff2
- "RoundHog": https://posthog.com/static/SENTIN.woff2
- "Charter": https://res.cloudinary.com/dmukukwp6/raw/upload/SENTIN.woff Load ALL custom fonts via @font-face in global CSS:
@font-face { font-family: 'IBM Plex Sans Variable'; src: url('https://posthog.com/static/SENTIN.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
@font-face { font-family: 'Fairytale'; src: url('https://posthog.com/fonts/SENTIN.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
@font-face { font-family: 'Computer Modern'; src: url('https://posthog.com/fonts/SENTIN.woff') format('woff'); font-weight: 400 700; font-display: swap; }
@font-face { font-family: 'Squeak'; src: url('https://posthog.com/fonts/SENTIN.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
@font-face { font-family: 'RoundHog'; src: url('https://posthog.com/static/SENTIN.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
@font-face { font-family: 'Charter'; src: url('https://res.cloudinary.com/dmukukwp6/raw/upload/SENTIN.woff') format('woff'); font-weight: 400 700; font-display: swap; }
These fonts WILL load from the URLs above. Do not substitute with Google Fonts alternatives. Add to globals.css (override shadcn defaults with site tokens):
:root { --background: #eeefe9; --foreground: #65675e; --card: #e9eae4; --card-foreground: #65675e; --popover: #e9eae4; --popover-foreground: #65675e; --primary: #cd8407; --primary-foreground: #000000; --secondary: #dfe0da; --secondary-foreground: #65675e; --muted: #e4e5df; --muted-foreground: #6b7280; --accent: #dadbd5; --accent-foreground: #000000; --destructive: #ef4444; --destructive-foreground: #ffffff; --border: rgba(0,0,0,0.08); --input: rgba(0,0,0,0.08); --ring: #cd8407; --radius: 4px;
}
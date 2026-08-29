Analysis confidence: High
**Use the exact hex colors, px values, and tokens specified in this prompt. Prefer extracted values over framework defaults (shadcn, Tailwind, component library defaults).**
Inspired by: forge-cli.dev
Page type: developer-tool
## Design Prompt
### Core Spec (Priority)
If any later detail conflicts, this section wins.
- Base background: `#0b0d12`
 Use ONLY this exact value for the page/body background. Do NOT substitute with `bg-white`, `bg-background`, `bg-slate-50`, `bg-zinc-50`, shadcn `--background` default, or any other neutral. The entire page renders on this color.
- Primary action color: `#7c3aed`
 Use ONLY this exact hex for primary CTAs, buttons, focus rings, and active states. Do NOT substitute with Tailwind `blue-500`, `indigo-600`, `violet-600`, shadcn `--primary` default, or any other color. If a component you generate doesn't reference this token, the component is wrong.
- Heading typeface: "Geist, system-ui, sans-serif"
- Body/UI typeface: "Geist, system-ui, sans-serif"
- Core component radius family starts at `4px`
- Motion base duration: `400ms`
### Design Direction
**TL;DR:** bold, futuristic, confident. High-contrast dark surfaces with vivid accent color create technical authority and visual focus.
**Overall character**
Dark-first SaaS with saturated cool accents. High contrast, technically confident, engineer-facing. **Section rhythm & color hierarchy**
Consistently dark (`#0b0d12` base). Differentiate sections through subtle surface shifts — slightly lighter sub-surfaces (8–12% opacity white overlay), thin border-top lines between sections. Never flip to white mid-page. **Image usage & visual treatment**
Minimal imagery — design relies on typography, color, and space. Any visuals are functional: diagrams, UI mockups, icons.
Noise/grain texture overlay on backgrounds — apply a subtle grainy SVG or CSS noise filter (`filter: url(#noise)` or repeating SVG background-image) at ~5–15% opacity across main surfaces. Creates a tactile, editorial quality.
5 split-column sections — alternate text/visual side each row for scroll rhythm. **Typography**
Single typeface: "Geist, system-ui, sans-serif" — hierarchy via weight and size contrast. **Color usage**
Dark surfaces (`#0b0d12`). `#7c3aed` is the primary action color — CTAs, links, focus rings, active states. `#a78bfa` is secondary — specific badges or callouts, not interchangeable with primary. **Shape & elevation**
Moderate rounding (4px) — contemporary and neutral. Layered shadows — don't simplify to a single layer.
Glassmorphism panels: background rgba(255,255,255,0.03–0.08), backdrop-filter:blur(12–20px), border 1px solid rgba(255,255,255,0.08–0.12). These panels float above the base surface — use them for cards, modals, nav on scroll. The frosted effect is subtle, not milky. **Animation & motion** Base duration: 400ms. Dominant easing: `cubic-bezier(0.16, 1, 0.3, 1)`.
Scroll reveals: blur-in.
Stagger: child elements enter with **60 delay** between each (12 elements). Use `transition-delay` or Framer Motion `staggerChildren: 0.06`.
**Hero animation**: Canvas (?×?px) — Likely Rive, Three.js, or custom WebGL. Use animated SVG or Framer Motion morphing paths as fallback.
**Hero entrance sequence** (in order): 1. `<h1>` "SENTINEL Our platform helps te" — delay: 200, duration: 800 2. `<nav>` "SENTINEL Our platform helps te" — delay: 400, duration: 500
**Lottie animation** (undefined, looping, autoplay), file: `anim.json`. Use `<dotlottie-react>` or `lottie-react` with the JSON source.
Animation stack: [gsap, lenis, framer-motion]. **GSAP scrub** — `gsap.to(el, { y:-100, ease:"none", scrollTrigger:{ trigger:el, start:"top bottom", end:"bottom top", scrub:1 } })` Pinned sections detected — use `pin:true` with ScrollTrigger. **Lenis** — `new Lenis({ duration:1.2, easing:t=>Math.min(1, 1.001-Math.pow(2,-10*t)) })`, sync in RAF loop. **Framer Motion** — `<motion.div initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} transition={{duration:0.5,ease:[0.16,1,0.3,1]}} viewport={{once:true}}>`
Parallax: background moves at different speed than foreground content. Implement via CSS `background-attachment:fixed` or JS `transform:translateZ()` with `perspective`. **Page flow** (1 sections detected — layout may vary)
1. **undefined**: "SENTINEL Our platform helps teams ship faster than ever before." **Interactive components**
- **Split content panel**: image/visual left + 3 bullet points right. Layout: flex.
- **Sticky header** (position:fixed, top:0, h:56px, z:100): bg: #0b0d12.
- **Sticky bottom bar** (position:fixed, bottom:0, h:48px, z:90): No button. bg: #151922. ⚠️ Not part of page scroll flow — renders above all content. Add padding-bottom:48px to <body> to prevent content overlap. Content preview: "SENTINEL Our platform helps teams ship faster than ever befo" **Tabbed content — all states (DO NOT collapse into one):**
State 1: "SENTINEL Our platform helps teams ship faster than ever before." Heading: "SENTINEL Our platform helps teams ship faster than ever before." Bullets: "SENTINEL Our platform helps teams ship faster than ever before." CTA: "SENTINEL Our platform helps teams ship faster than ever before."
Each state has its own content — render conditionally based on activeTab index. **Spacing system:** 4px base grid (97% conformity). Common values: 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px. Use multiples of 4px for ALL spacing — padding, gap, margin. **Component language**
Buttons: Primary = 6px, `#7c3aed` fill, 14px.
Ghost variant: transparent bg + border outline.
Badges: 4px, 11px, 500 weight.
Inputs: 36px height, 6px radius, border: 1px solid #2a3140. **Type scale**
H1: 64px/600, tracking: -0.01em
H2: 40px/600
H3: 22px/500
Body: 15px/400, line-height: 1.7
Label: 12px/500, uppercase
### Color Tokens
> ⚠ Color confidence: low — site may use CSS-in-JS or dynamic theming.
> Values below are computed approximations. Verify with browser DevTools.
- `--brand-primary`: #7c3aed
- `--surface-1`: #151922
Computed:
- accent-1: `#22d3ee`
- accent-2: `#34d399`
- accent-3: `#a78bfa`
- background: `#0b0d12`
- foreground (text): `#e6e9ef`
Color role mapping:
- **Primary action** (`#7c3aed`): CTAs, buttons, active links, focus rings — "act here"
- **Surface base** (`#0b0d12`): Page background, card background, modal background
- **Text primary** (`#e6e9ef`): Headings, body text, primary content
- **Border** (`rgba(255,255,255,0.06)`): Card edges, dividers, form borders
- **Semantic states**: Success `#22c55e` · Error `#ef4444` · Warning `#f59e0b`
Brand color scale (use in Tailwind config):
- brand-50: `#f7f5fa`
- brand-100: `#ebe6f5`
- brand-200: `#d7c9ed`
- brand-300: `#b799ea`
- brand-400: `#8f57ef`
- brand-500: `#7c3aed` <- extracted primary
- brand-600: `#550ad6`
- brand-700: `#4608af`
- brand-800: `#380c83`
- brand-900: `#290d59`
### Typography Tokens
- Display/heading: "Geist, system-ui, sans-serif"
- Body/UI: "Geist Mono, monospace"
Type scale (semantic roles):
- **H1 — hero display, page title:** `64px/600`, tracking `-0.01em`, "Geist, system-ui, sans-serif"
- **H2 — section headers:** `40px/600`, "Geist, system-ui, sans-serif"
- **H3 — feature titles, card headings:** `22px/500`, "Geist, system-ui, sans-serif"
- **Body — reading text (60-70ch max width):** `15px/400`, "Geist, system-ui, sans-serif"
- **Label — UI labels, form fields:** `12px/500`, tracking `0.08em`, `uppercase`, "Geist Mono, monospace"
- **Code — inline code, terminal output:** `13px/400`, "Geist Mono, monospace"
### Shadow Tokens
- shadow-sm: `0 0 0 1px rgba(124,58,237,0.4)`
- shadow-button-primary: `0 0 24px rgba(124,58,237,0.35)`
- shadow-lg: `0 8px 32px rgba(0,0,0,0.6)`
### Shape Tokens
- `4px` (input / small)
- `6px` (primary button)
- `10px` (component)
- `50%` (pill / large-radius)
### Spacing Scale
Base unit: **4px** (97% of values conform)
Scale: `4px` · `8px` · `12px` · `16px` · `24px` · `32px` · `48px` · `64px`
Use multiples of 4px for ALL spacing — padding, gap, margin.
### Motion Tokens
- transition: `all 120ms ease-out`
- transition: `transform 400ms cubic-bezier(0.16, 1, 0.3, 1)` — movement, scale, rotate
**Interaction patterns:**
- **Button / CTA:** bg → `#6d28d9`, 120ms ease-out, shadow → `0 0 24px rgba(124,58,237,0.35)`, 120ms ease-out
- **Card / item:** border → `#7c3aed`, 120ms ease-out, transform: `translateY(-2px)`, 120ms ease-out
### Interaction Paradigm
- ⚠️ **ANIMATION ARCHITECTURE — TWO TIERS:** **TIER 1 — HERO (Section 1):** Load-time animations ONLY, no scroll dependency. All hero elements animate on page mount using CSS `@keyframes` with staggered `animation-delay`. Initial `opacity:0` IS PERMITTED in hero because animation fires automatically within 0.4s of load — never waiting for scroll. FAILSAFE: If CSS animation fails to fire, fallback to `opacity:1` via `setTimeout(() => els.forEach(el => el.style.opacity = "1"), 500)`. **TIER 2 — CONTENT SECTIONS:** Scroll-triggered WITH mandatory failsafe. Section headings/eyebrow labels reveal on scroll entry: Initial: `opacity:0; translateY(20px)`. Revealed: `opacity:1; translateY(0)`. Transition: `0.4s ease-out`. MANDATORY DUAL FAILSAFE (both required): 1. `IntersectionObserver {threshold:0.1}`: adds `.is-visible` class on intersection. 2. Timeout: `setTimeout(() => document.querySelectorAll(".reveal-text").forEach(el => el.classList.add("is-visible")), 2000);` This guarantees animation on scroll AND visibility after 2s even if Observer never fires.
- **Hover feedback:** Explicit — components respond visually (shadow/transform) to signal interactivity.
- **Timing base:** `400ms` `cubic-bezier(0.16, 1, 0.3, 1)` — balanced, professional pacing.
### Component Patterns
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
### Layout & Page Structure
- Navigation: floating
- Max content width: 1120px
- 5 split-column section(s) — alternate text/image side
- Scroll animations: IntersectionObserver + fade + translateY(20px)→0
### Responsive Breakpoints
- 480px — custom breakpoint (12 rules)
- 768px — ≈ Tailwind `md:` (70 rules)
- 1024px — ≈ Tailwind `lg:` (52 rules)
### Section Content Map
**This page has exactly 1 sections in the order listed below.** Do NOT add sections (no invented testimonials, pricing, FAQ, newsletter, team, stats, or logo-wall blocks unless explicitly listed below). Do NOT omit or reorder sections. Each section's background, layout, and content are measured from the live site:
**Scroll reveal CSS (applies to ALL sections below hero):** `.reveal-text { opacity:0; transform:translateY(20px); transition: opacity 0.4s ease-out, transform 0.4s ease-out; }` `.reveal-text.is-visible { opacity:1; transform:translateY(0); }`
Include mandatory 2s timeout failsafe (see Interaction Paradigm).
**Section 1: undefined** — [SAMPLE COPY] "SENTINEL Our platform helps teams ship faster than ever before." [statement · technical · ~10 words]
 Layout: undefined
 Animation: hero loads immediately (no scroll trigger) — TIER 1 load-time animation.
 Headline words appear sequentially: each `<span>` with `@keyframes word-enter { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }`. `animation-delay`: 0s, 0.1s, 0.2s, 0.3s per word.
 FAILSAFE: `setTimeout(() => document.querySelectorAll(".hero-word").forEach(el => el.style.opacity = "1"), 500);`
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
**Footer content**
### Design Specifications **Typography Scale:**
- H1: `64px/1.05/600`, tracking `-0.01em`, font "Geist, system-ui, sans-serif"
- H2: `40px/1.15/600`, font "Geist, system-ui, sans-serif"
- H3: `22px/1.35/500`, font "Geist, system-ui, sans-serif"
- Body: `15px/1.7/400`, font "Geist, system-ui, sans-serif"
- Label: `12px/1.4/500`, tracking `0.08em`, `uppercase`, font "Geist Mono, monospace" **Badges/Tags:**
- bg `#1f2430`, text `#22d3ee`, radius `4px`, padding `2px 8px`, font `11px/500` **Inputs:**
- bg `#0b0d12`, border `1px solid #2a3140`, radius `6px`, padding `8px 12px`, font `14px` "Geist Mono, monospace", height `36px`
- Focus: outline 2px solid accent, offset 2px **Links:**
- color `#22d3ee`, text-decoration `none` **Footer:**
- bg `#0b0d12`, text `#6b7280`, padding `80px 32px`, border-top `1px solid #1f2430`, 3-column layout, gap `24px` **Font Weights Used:**
- 400, 500, 600
Recreate this visual style faithfully. Use the EXACT hex colors, px values, font names, and spacing from the tokens and specifications above.
Source: forge-cli.dev Implementation notes:
- Prefer the extracted color tokens over Tailwind defaults (slate, zinc, neutral, etc.). Override shadcn/ui CSS variables (--primary, --radius, --background) with the values specified above.
- Use the exact px values for border-radius, padding, and font sizes. Use the exact easing functions and durations from Motion Tokens.
- When a value is not specified in this prompt, a sensible default is acceptable.
NOTE: "Geist, system-ui, sans-serif", "Geist Mono, monospace" are custom fonts not available on Google Fonts. Use the closest Google Fonts alternative (e.g. Inter, DM Sans, Space Grotesk for sans-serif; JetBrains Mono, Fira Code for monospace; Playfair Display for serif display) and match the weight/tracking values. Add to globals.css (override shadcn defaults with site tokens):
:root { --background: #0b0d12; --foreground: #9aa4b2; --card: #13151a; --card-foreground: #9aa4b2; --popover: #13151a; --popover-foreground: #9aa4b2; --primary: #7c3aed; --primary-foreground: #ffffff; --secondary: #1f2126; --secondary-foreground: #9aa4b2; --muted: #1a1c21; --muted-foreground: #767676; --accent: #24262b; --accent-foreground: #ffffff; --destructive: #ef4444; --destructive-foreground: #ffffff; --border: rgba(255,255,255,0.08); --input: rgba(255,255,255,0.08); --ring: #7c3aed; --radius: 4px;
}
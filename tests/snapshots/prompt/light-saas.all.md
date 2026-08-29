Analysis confidence: High
**Use the exact hex colors, px values, and tokens specified in this prompt. Prefer extracted values over framework defaults (shadcn, Tailwind, component library defaults).**
Inspired by: northwind.io
Page type: marketing
## Design Prompt
### Core Spec (Priority)
If any later detail conflicts, this section wins.
- Base background: `#ffffff`
 Use ONLY this exact value for the page/body background. Do NOT substitute with `bg-white`, `bg-background`, `bg-slate-50`, `bg-zinc-50`, shadcn `--background` default, or any other neutral. The entire page renders on this color.
- Primary action color: `#2563eb`
 Use ONLY this exact hex for primary CTAs, buttons, focus rings, and active states. Do NOT substitute with Tailwind `blue-500`, `indigo-600`, `violet-600`, shadcn `--primary` default, or any other color. If a component you generate doesn't reference this token, the component is wrong.
- Heading typeface: "Inter, -apple-system, sans-serif"
- Body/UI typeface: "Inter, -apple-system, sans-serif"
- Core component radius family starts at `6px`
- Motion base duration: `150ms`
### Design Direction
**TL;DR:** professional, brutalist, intentional. Clean layout with balanced typography and color; neither decoration nor minimalism dominates.
**Overall character**
Light base with a strong cool-toned primary action (`#2563eb`). Professional, precise, developer-friendly. Accent used surgically — only at decision points. **Section rhythm & color hierarchy**
Consistently light throughout (`#ffffff` base). Sections distinguish through subtle background tints — e.g. pure white vs #ffffff warm off-white — never dark backgrounds. Generous vertical padding (80–120px) between sections creates breathing room without color contrast. **Image usage & visual treatment**
Minimal imagery — design relies on typography, color, and space. Any visuals are functional: diagrams, UI mockups, icons.
3 split-column sections — alternate text/visual side each row for scroll rhythm. **Typography**
Single typeface: "Inter, -apple-system, sans-serif" — hierarchy via weight and size contrast. **Color usage**
Light surfaces (`#ffffff`). Color used sparingly — white/neutral dominates. `#2563eb` (primary action — CTAs, links, focus). `#f59e0b` secondary accent — category/state/decoration, never swap with primary. Named accents: `#16a34a` (--color-brand-accent) — assign to specific semantic roles (e.g. developer callouts, code highlighting). Backgrounds: white + `#ffffff` eggshell for section variation. **Shape & elevation**
Pills (9999px) for buttons/badges. Containers: 6px radius. Two distinct registers — never mix.
Brutalist elevation: hard drop-shadows with zero blur (e.g. `4px 4px 0 color`). **Animation & motion**
Motion personality: **snappy** — interactions respond in <200ms. Micro-interactions feel mechanical and precise. Base duration: 150ms. Dominant easing: `cubic-bezier(0.4, 0, 0.2, 1)`.
Scroll reveals: **fade-up** — `opacity:0→1` + `translateY(30px→0)`, IntersectionObserver at `threshold:0.15`. `will-change: transform, opacity`.
Stagger: child elements enter with **80 delay** between each (6 elements). Use `transition-delay` or Framer Motion `staggerChildren: 0.08`.
**Hero entrance sequence** (in order): 1. `<p>` "SENTINEL Our platform helps te" — delay: 120, duration: 600 2. `<button>` "SENTINEL Our platform helps te" — delay: 240, duration: 400
Animation stack: [framer-motion]. **Framer Motion** — `<motion.div initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} transition={{duration:0.5,ease:[0.16,1,0.3,1]}} viewport={{once:true}}>` **Page flow** (1 sections detected — layout may vary)
1. **undefined**: "SENTINEL Our platform helps teams ship faster than ever before." **Interactive components**
- **Split content panel**: image/visual left + 4 bullet points right + testimonial block. Layout: grid.
- **Sticky header** (position:fixed, top:0, h:64px, z:50): bg: #ffffff. **Tabbed content — all states (DO NOT collapse into one):**
State 1: "SENTINEL Our platform helps teams ship faster than ever before." Heading: "SENTINEL Our platform helps teams ship faster than ever before." Bullets: "SENTINEL Our platform helps teams ship faster than ever before." | "SENTINEL Our platform helps teams ship faster than ever before." Image: hero-shot.png CTA: "SENTINEL Our platform helps teams ship faster than ever before."
Each state has its own content — render conditionally based on activeTab index. **Spacing system:** 8px base grid (91% conformity). Common values: 8px, 16px, 24px, 32px, 48px, 64px, 96px, 128px. Use multiples of 8px for ALL spacing — padding, gap, margin. Exceptions: 13px, 42px. **Component language**
Buttons: Primary = 8px, `#2563eb` fill, 15px, 600 weight.
Ghost variant: transparent bg + border outline.
Secondary: `#f8fafc` bg, `#0f172a` text, border `1px solid #e2e8f0`.
Badges: pill, 12px, 500 weight.
Inputs: 42px height, 8px radius, border: 1px solid #cbd5e1. **Type scale**
H1: 56px/700, tracking: -0.02em
H2: 36px/600
H3: 24px/600
Body: 16px/400, line-height: 1.6
### Color Tokens
- `--color-primary`: #2563eb
- `--color-brand-accent`: #16a34a
Computed:
- accent-2: `#f59e0b`
- accent-3: `#1d4ed8`
- background: `#ffffff`
- foreground (text): `#0f172a`
Color role mapping:
- **Primary action** (`#2563eb`): CTAs, buttons, active links, focus rings — "act here"
- **Surface base** (`#ffffff`): Page background, card background, modal background
- **Text primary** (`#0f172a`): Headings, body text, primary content
- **Border** (`rgba(0,0,0,0.08)`): Card edges, dividers, form borders
- **Semantic states**: Success `#22c55e` · Error `#ef4444` · Warning `#f59e0b`
Brand color scale (use in Tailwind config):
- brand-50: `#f5f6fa`
- brand-100: `#e6eaf5`
- brand-200: `#c9d5ed`
- brand-300: `#99b3ea`
- brand-400: `#5787ef`
- brand-500: `#2563eb` <- extracted primary
- brand-600: `#0a4bd6`
- brand-700: `#083daf`
- brand-800: `#0c3283`
- brand-900: `#0d2559`
### Dark Mode Tokens
These CSS properties change under `@media (prefers-color-scheme: dark)`. Use Tailwind `dark:` utilities:
- `--color-bg: #0f172a`
- `--color-text: #f8fafc`
- `--color-surface: #1e293b`
### Typography Tokens
- Display/heading: "Inter, -apple-system, sans-serif"
- Body/UI: "Söhne Mono, monospace"
Type scale (semantic roles):
- **H1 — hero display, page title:** `56px/700`, tracking `-0.02em`, "Inter, -apple-system, sans-serif"
- **H2 — section headers:** `36px/600`, "Inter, -apple-system, sans-serif"
- **H3 — feature titles, card headings:** `24px/600`, "Inter, -apple-system, sans-serif"
- **H4 — subsection headers:** `20px/600`, "Inter, -apple-system, sans-serif"
- **Body — reading text (60-70ch max width):** `16px/400`, "Inter, -apple-system, sans-serif"
- **Caption — metadata, timestamps, credits:** `13px/400`, "Inter, -apple-system, sans-serif"
- **Code — inline code, terminal output:** `14px/400`, "Söhne Mono, monospace"
### Shadow Tokens
- shadow-card-resting: `0 4px 6px -1px rgba(15,23,42,0.1)`
- shadow-card-hover: `0 20px 25px -5px rgba(15,23,42,0.1)`
### Shape Tokens
- `--radius-md`: 8px
- Interactive elements (buttons, badges): `9999px` (pill)
### Spacing Scale
Base unit: **8px** (91% of values conform)
Scale: `8px` · `16px` · `24px` · `32px` · `48px` · `64px` · `96px` · `128px`
Use multiples of 8px for ALL spacing — padding, gap, margin.
Exceptions: 13px, 42px — use as-is where detected.
### Motion Tokens
- transition: `all 150ms cubic-bezier(0.4, 0, 0.2, 1)`
- transition: `color 200ms ease` — text color hover
- transition: `opacity 300ms ease-out` — fade entrance / hover
**Interaction patterns:**
- **Button / CTA:** bg → `#1d4ed8`, 150ms, transform: `translateY(-1px)`, 150ms, shadow → `0 4px 6px -1px rgba(15,23,42,0.1)`, 150ms
- **Card / item:** shadow → `0 20px 25px -5px rgba(15,23,42,0.1)`, 150ms, border → `#cbd5e1`, 150ms
- **Link / text:** text → `#1d4ed8`, 150ms
### Interaction Paradigm
- ⚠️ **ANIMATION ARCHITECTURE — TWO TIERS:** **TIER 1 — HERO (Section 1):** Load-time animations ONLY, no scroll dependency. All hero elements animate on page mount using CSS `@keyframes` with staggered `animation-delay`. Initial `opacity:0` IS PERMITTED in hero because animation fires automatically within 0.4s of load — never waiting for scroll. FAILSAFE: If CSS animation fails to fire, fallback to `opacity:1` via `setTimeout(() => els.forEach(el => el.style.opacity = "1"), 500)`. **TIER 2 — CONTENT SECTIONS:** Scroll-triggered WITH mandatory failsafe. Section headings/eyebrow labels reveal on scroll entry: Initial: `opacity:0; translateY(20px)`. Revealed: `opacity:1; translateY(0)`. Transition: `0.4s ease-out`. MANDATORY DUAL FAILSAFE (both required): 1. `IntersectionObserver {threshold:0.1}`: adds `.is-visible` class on intersection. 2. Timeout: `setTimeout(() => document.querySelectorAll(".reveal-text").forEach(el => el.classList.add("is-visible")), 2000);` This guarantees animation on scroll AND visibility after 2s even if Observer never fires.
- **Hover feedback:** Explicit — components respond visually (shadow/transform) to signal interactivity.
- **Timing base:** `150ms` `cubic-bezier(0.4, 0, 0.2, 1)` — snappy, app-like responsiveness.
### Component Patterns
**Navigation:** Sticky, `#ffffff` bg. `border-bottom:1px solid rgba(0,0,0,0.06)`. Logo left, CTA right.
**Primary button:** `8px` radius, `#2563eb` bg, text `#ffffff`, height `44px`, padding `12px 24px`, font `15px/600` "Inter, -apple-system, sans-serif", tracking `normal`. Hover: `backgroundColor: #1d4ed8`, `transform: translateY(-1px)`, `boxShadow: 0 4px 6px -1px rgba(15,23,42,0.1)`.
 Spec: `background-color: #2563eb` · `color: #ffffff` · `padding: 12px 24px` · `border-radius: 8px` · `font-size: 15px` · `font-weight: 600` · `font-family: "Inter, -apple-system, sans-serif"` · `box-shadow: 0 1px 2px 0 rgba(15,23,42,0.05)` · `height: 44px` · `transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1)`
 Hover: `backgroundColor: #1d4ed8` · `transform: translateY(-1px)` · `boxShadow: 0 4px 6px -1px rgba(15,23,42,0.1)` → hover:-translate-y-0.5
 Transition: `all 150ms cubic-bezier(0.4, 0, 0.2, 1)`
 Active: `transform: scale(0.98); transition: transform 150ms cubic-bezier(0.4,0,0.2,1)`. `button:active { transform: scale(0.98); }`
**Ghost button:** `8px` radius, transparent bg, border `1px solid rgba(0,0,0,0.15)`, padding `12px 16px`. Hover: bg rgba(0,0,0,0.04).
 Spec: `background-color: transparent` · `border: 1px solid rgba(0,0,0,0.15)` · `color: #2563eb` · `padding: 12px 16px` · `border-radius: 8px` · `font-size: 15px` · `font-weight: 500`
**Secondary button:** `8px` radius, `#f8fafc` bg, text `#0f172a`, padding `12px 24px`, border `1px solid #e2e8f0`, font `15px/600`
 Spec: `background-color: #f8fafc` · `color: #0f172a` · `padding: 12px 24px` · `border-radius: 8px` · `border: 1px solid #e2e8f0` · `font-size: 15px` · `font-weight: 600`
**Cards:** `#ffffff` bg, layered shadow from tokens. 6px radius. Padding 24–32px. Hover: `boxShadow: 0 20px 25px -5px rgba(15,23,42,0.1)`, `borderColor: #cbd5e1`.
**Hero:** min-height 80–90dvh, `#ffffff` background. dark text (token foreground). No overlay. Headline: clamp(48px,6vw,80px) in display font. One primary CTA + one ghost, side by side. No cards above the fold.
**Inputs:** `#ffffff` bg, `1px solid #cbd5e1`, `8px` radius. Focus: outline 2px solid #2563eb offset 2px.
**Badges:** radius `9999px`, padding `4px 10px`, font `12px/500`, bg `#e2e8f0`, text `#475569`.
**Global interactive rules:** links → `color: #2563eb`, no underline, offset `2px`; `a:hover` → color: #1d4ed8.
**Hover state CSS — implement exactly:**
 `.btn-primary:hover { box-shadow: 0 4px 6px -1px rgba(15,23,42,0.1); }`
### Layout & Page Structure
- Navigation: sticky
- Max content width: 1280px
- 3 split-column section(s) — alternate text/image side
- Scroll animations: IntersectionObserver + fade + translateY(20px)→0
### Responsive Breakpoints
- 640px — ≈ Tailwind `sm:` (44 rules)
- 768px — ≈ Tailwind `md:` (61 rules)
- 1024px — ≈ Tailwind `lg:` (88 rules)
- 1280px — ≈ Tailwind `xl:` (35 rules)
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
- H1: `56px/1.1/700`, tracking `-0.02em`, font "Inter, -apple-system, sans-serif"
- H2: `36px/1.2/600`, font "Inter, -apple-system, sans-serif"
- H3: `24px/1.3/600`, font "Inter, -apple-system, sans-serif"
- Body: `16px/1.6/400`, font "Inter, -apple-system, sans-serif" **Badges/Tags:**
- bg `#e2e8f0`, text `#475569`, radius `9999px`, padding `4px 10px`, font `12px/500` **Inputs:**
- bg `#ffffff`, border `1px solid #cbd5e1`, radius `8px`, padding `10px 14px`, font `15px` "Inter, -apple-system, sans-serif", height `42px`
- Focus: outline 2px solid accent, offset 2px **Links:**
- color `#2563eb`, text-decoration `none`, underline-offset `2px` **Footer:**
- bg `#f8fafc`, text `#64748b`, padding `64px 24px`, border-top `1px solid #e2e8f0`, 4-column layout, gap `32px` **Font Weights Used:**
- 400, 500, 600, 700
Recreate this visual style faithfully. Use the EXACT hex colors, px values, font names, and spacing from the tokens and specifications above.
Source: northwind.io Implementation notes:
- Prefer the extracted color tokens over Tailwind defaults (slate, zinc, neutral, etc.). Override shadcn/ui CSS variables (--primary, --radius, --background) with the values specified above.
- Use the exact px values for border-radius, padding, and font sizes. Use the exact easing functions and durations from Motion Tokens.
- When a value is not specified in this prompt, a sensible default is acceptable.
NOTE: "Inter, -apple-system, sans-serif", "Söhne Mono, monospace" are custom fonts not available on Google Fonts. Use the closest Google Fonts alternative (e.g. Inter, DM Sans, Space Grotesk for sans-serif; JetBrains Mono, Fira Code for monospace; Playfair Display for serif display) and match the weight/tracking values. Add to globals.css (override shadcn defaults with site tokens):
:root { --background: #ffffff; --foreground: #475569; --card: #fafafa; --card-foreground: #475569; --popover: #fafafa; --popover-foreground: #475569; --primary: #2563eb; --primary-foreground: #ffffff; --secondary: #f0f0f0; --secondary-foreground: #475569; --muted: #f5f5f5; --muted-foreground: #6b7280; --accent: #16a34a; --accent-foreground: #ffffff; --destructive: #ef4444; --destructive-foreground: #ffffff; --border: rgba(0,0,0,0.08); --input: rgba(0,0,0,0.08); --ring: #2563eb; --radius: 6px;
}
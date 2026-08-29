Analysis confidence: High
**Use the exact hex colors, px values, and tokens specified in this prompt. Prefer extracted values over framework defaults (shadcn, Tailwind, component library defaults).**
Here is the **Motion System** extracted from forge-cli.dev.
Use as specification for your implementation. Values are measured from the live site — do not substitute with framework defaults.
Source: forge-cli.dev · Page type: developer-tool
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
**Overall character (context)** Dark-first SaaS with saturated cool accents. **Section rhythm & color hierarchy (context)** Consistently dark (`#0b0d12` base). **Image usage & visual treatment (context)** Minimal imagery — design relies on typography, color, and space. **Typography (context)** Single typeface: "Geist, system-ui, sans-serif" — hierarchy via weight and size contrast. **Color usage (context)** Dark surfaces (`#0b0d12`). **Shape & elevation (context)** Moderate rounding (4px) — contemporary and neutral. **Animation & motion** Base duration: 400ms. Dominant easing: `cubic-bezier(0.16, 1, 0.3, 1)`.
Scroll reveals: blur-in.
Stagger: child elements enter with **60 delay** between each (12 elements). Use `transition-delay` or Framer Motion `staggerChildren: 0.06`. **Hero animation**: Canvas (?×?px) — Likely Rive, Three.js, or custom WebGL. Use animated SVG or Framer Motion morphing paths as fallback. **Hero entrance sequence (context)** (in order): 1. **Lottie animation** (undefined, looping, autoplay), file: `anim.json`. Use `<dotlottie-react>` or `lottie-react` with the JSON source.
Animation stack: [gsap, lenis, framer-motion]. **GSAP scrub** — `gsap.to(el, { y:-100, ease:"none", scrollTrigger:{ trigger:el, start:"top bottom", end:"bottom top", scrub:1 } })` Pinned sections detected — use `pin:true` with ScrollTrigger. **Lenis** — `new Lenis({ duration:1.2, easing:t=>Math.min(1, 1.001-Math.pow(2,-10*t)) })`, sync in RAF loop. **Framer Motion** — `<motion.div initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} transition={{duration:0.5,ease:[0.16,1,0.3,1]}} viewport={{once:true}}>`
Parallax: background moves at different speed than foreground content. Implement via CSS `background-attachment:fixed` or JS `transform:translateZ()` with `perspective`. **Page flow (context)** (1 sections detected — layout may vary) 1. **Interactive components (context)** - **Split content panel**: image/visual left + 3 bullet points right. **Tabbed content — all states (DO NOT collapse into one): (context)** State 1: "SENTINEL Our platform helps teams ship faster than ever before.". **Component language (context)** Buttons: Primary = 6px, `#7c3aed` fill, 14px. **Type scale (context)** H1: 64px/600, tracking: -0.01em.
### Motion System
**Interaction patterns:**
- **Button / CTA:** bg → `#6d28d9`, 120ms ease-out, shadow → `0 0 24px rgba(124,58,237,0.35)`, 120ms ease-out
- **Card / item:** border → `#7c3aed`, 120ms ease-out, transform: `translateY(-2px)`, 120ms ease-out
**Scroll-triggered animations:**
- Scroll reveal: `opacity 0→1, translateY(20px→0)`, 0.5s ease-out on scroll entry — trigger with IntersectionObserver
### Context — Do not change
- **Colors:** `#0b0d12` base, `#7c3aed` primary action, `#22d3ee` accent
- **Typography:** "Geist, system-ui, sans-serif" headings, body 15px/400
### Interaction Paradigm
- ⚠️ **ANIMATION ARCHITECTURE — TWO TIERS:** **TIER 1 — HERO (Section 1):** Load-time animations ONLY, no scroll dependency. All hero elements animate on page mount using CSS `@keyframes` with staggered `animation-delay`. Initial `opacity:0` IS PERMITTED in hero because animation fires automatically within 0.4s of load — never waiting for scroll. FAILSAFE: If CSS animation fails to fire, fallback to `opacity:1` via `setTimeout(() => els.forEach(el => el.style.opacity = "1"), 500)`. **TIER 2 — CONTENT SECTIONS:** Scroll-triggered WITH mandatory failsafe. Section headings/eyebrow labels reveal on scroll entry: Initial: `opacity:0; translateY(20px)`. Revealed: `opacity:1; translateY(0)`. Transition: `0.4s ease-out`. MANDATORY DUAL FAILSAFE (both required): 1. `IntersectionObserver {threshold:0.1}`: adds `.is-visible` class on intersection. 2. Timeout: `setTimeout(() => document.querySelectorAll(".reveal-text").forEach(el => el.classList.add("is-visible")), 2000);` This guarantees animation on scroll AND visibility after 2s even if Observer never fires.
- **Hover feedback:** Explicit — components respond visually (shadow/transform) to signal interactivity.
- **Timing base:** `400ms` `cubic-bezier(0.16, 1, 0.3, 1)` — balanced, professional pacing.
Recreate this visual style faithfully. Use the EXACT hex colors, px values, font names, and spacing from the tokens and specifications above.
Source: forge-cli.dev Implementation notes:
- Prefer the extracted color tokens over Tailwind defaults (slate, zinc, neutral, etc.). Override shadcn/ui CSS variables (--primary, --radius, --background) with the values specified above.
- Use the exact px values for border-radius, padding, and font sizes. Use the exact easing functions and durations from Motion Tokens.
- When a value is not specified in this prompt, a sensible default is acceptable.
NOTE: "Geist, system-ui, sans-serif", "Geist Mono, monospace" are custom fonts not available on Google Fonts. Use the closest Google Fonts alternative (e.g. Inter, DM Sans, Space Grotesk for sans-serif; JetBrains Mono, Fira Code for monospace; Playfair Display for serif display) and match the weight/tracking values. Add to globals.css (override shadcn defaults with site tokens):
:root { --background: #0b0d12; --foreground: #9aa4b2; --card: #13151a; --card-foreground: #9aa4b2; --popover: #13151a; --popover-foreground: #9aa4b2; --primary: #7c3aed; --primary-foreground: #ffffff; --secondary: #1f2126; --secondary-foreground: #9aa4b2; --muted: #1a1c21; --muted-foreground: #767676; --accent: #24262b; --accent-foreground: #ffffff; --destructive: #ef4444; --destructive-foreground: #ffffff; --border: rgba(255,255,255,0.08); --input: rgba(255,255,255,0.08); --ring: #7c3aed; --radius: 4px;
}
Analysis confidence: High
**Use the exact hex colors, px values, and tokens specified in this prompt. Prefer extracted values over framework defaults (shadcn, Tailwind, component library defaults).**
Here is the **Motion System** extracted from northwind.io.
Use as specification for your implementation. Values are measured from the live site — do not substitute with framework defaults.
Source: northwind.io · Page type: marketing
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
**Overall character (context)** Light base with a strong cool-toned primary action (`#2563eb`). **Section rhythm & color hierarchy (context)** Consistently light throughout (`#ffffff` base). **Image usage & visual treatment (context)** Minimal imagery — design relies on typography, color, and space. **Typography (context)** Single typeface: "Inter, -apple-system, sans-serif" — hierarchy via weight and size contrast. **Color usage (context)** Light surfaces (`#ffffff`). **Shape & elevation (context)** Pills (9999px) for buttons/badges. **Animation & motion**
Motion personality: **snappy** — interactions respond in <200ms. Micro-interactions feel mechanical and precise. Base duration: 150ms. Dominant easing: `cubic-bezier(0.4, 0, 0.2, 1)`.
Scroll reveals: **fade-up** — `opacity:0→1` + `translateY(30px→0)`, IntersectionObserver at `threshold:0.15`. `will-change: transform, opacity`.
Stagger: child elements enter with **80 delay** between each (6 elements). Use `transition-delay` or Framer Motion `staggerChildren: 0.08`. **Hero entrance sequence (context)** (in order): 1. **Page flow (context)** (1 sections detected — layout may vary) 1. **Interactive components (context)** - **Split content panel**: image/visual left + 4 bullet points right + testimonial block. **Tabbed content — all states (DO NOT collapse into one): (context)** State 1: "SENTINEL Our platform helps teams ship faster than ever before.". **Component language (context)** Buttons: Primary = 8px, `#2563eb` fill, 15px, 600 weight. **Type scale (context)** H1: 56px/700, tracking: -0.02em.
### Motion System
**Interaction patterns:**
- **Button / CTA:** bg → `#1d4ed8`, 150ms, transform: `translateY(-1px)`, 150ms, shadow → `0 4px 6px -1px rgba(15,23,42,0.1)`, 150ms
- **Card / item:** shadow → `0 20px 25px -5px rgba(15,23,42,0.1)`, 150ms, border → `#cbd5e1`, 150ms
- **Link / text:** text → `#1d4ed8`, 150ms
**Scroll-triggered animations:**
- Scroll reveal: `opacity 0→1, translateY(20px→0)`, 0.5s ease-out on scroll entry — trigger with IntersectionObserver
### Context — Do not change
- **Colors:** `#ffffff` base, `#2563eb` primary action, `#16a34a` accent
- **Typography:** "Inter, -apple-system, sans-serif" headings, body 16px/400
### Interaction Paradigm
- ⚠️ **ANIMATION ARCHITECTURE — TWO TIERS:** **TIER 1 — HERO (Section 1):** Load-time animations ONLY, no scroll dependency. All hero elements animate on page mount using CSS `@keyframes` with staggered `animation-delay`. Initial `opacity:0` IS PERMITTED in hero because animation fires automatically within 0.4s of load — never waiting for scroll. FAILSAFE: If CSS animation fails to fire, fallback to `opacity:1` via `setTimeout(() => els.forEach(el => el.style.opacity = "1"), 500)`. **TIER 2 — CONTENT SECTIONS:** Scroll-triggered WITH mandatory failsafe. Section headings/eyebrow labels reveal on scroll entry: Initial: `opacity:0; translateY(20px)`. Revealed: `opacity:1; translateY(0)`. Transition: `0.4s ease-out`. MANDATORY DUAL FAILSAFE (both required): 1. `IntersectionObserver {threshold:0.1}`: adds `.is-visible` class on intersection. 2. Timeout: `setTimeout(() => document.querySelectorAll(".reveal-text").forEach(el => el.classList.add("is-visible")), 2000);` This guarantees animation on scroll AND visibility after 2s even if Observer never fires.
- **Hover feedback:** Explicit — components respond visually (shadow/transform) to signal interactivity.
- **Timing base:** `150ms` `cubic-bezier(0.4, 0, 0.2, 1)` — snappy, app-like responsiveness.
Recreate this visual style faithfully. Use the EXACT hex colors, px values, font names, and spacing from the tokens and specifications above.
Source: northwind.io Implementation notes:
- Prefer the extracted color tokens over Tailwind defaults (slate, zinc, neutral, etc.). Override shadcn/ui CSS variables (--primary, --radius, --background) with the values specified above.
- Use the exact px values for border-radius, padding, and font sizes. Use the exact easing functions and durations from Motion Tokens.
- When a value is not specified in this prompt, a sensible default is acceptable.
NOTE: "Inter, -apple-system, sans-serif", "Söhne Mono, monospace" are custom fonts not available on Google Fonts. Use the closest Google Fonts alternative (e.g. Inter, DM Sans, Space Grotesk for sans-serif; JetBrains Mono, Fira Code for monospace; Playfair Display for serif display) and match the weight/tracking values. Add to globals.css (override shadcn defaults with site tokens):
:root { --background: #ffffff; --foreground: #475569; --card: #fafafa; --card-foreground: #475569; --popover: #fafafa; --popover-foreground: #475569; --primary: #2563eb; --primary-foreground: #ffffff; --secondary: #f0f0f0; --secondary-foreground: #475569; --muted: #f5f5f5; --muted-foreground: #6b7280; --accent: #16a34a; --accent-foreground: #ffffff; --destructive: #ef4444; --destructive-foreground: #ffffff; --border: rgba(0,0,0,0.08); --input: rgba(0,0,0,0.08); --ring: #2563eb; --radius: 6px;
}
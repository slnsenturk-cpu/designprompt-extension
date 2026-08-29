Analysis confidence: High
> ⚠ **Primary action color could not be determined confidently.** Three extraction signals disagreed: button says `#0a0a0a`, CSS var says `none`, frequency says `#ed462d`. The color below is a best guess — verify against the live site before shipping.
**Use the exact hex colors, px values, and tokens specified in this prompt. Prefer extracted values over framework defaults (shadcn, Tailwind, component library defaults).**
Here is the **Motion System** extracted from rig.ai.
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
**Overall character (context)** Dark-first SaaS with saturated cool accents. **Section rhythm & color hierarchy (context)** Consistently dark (`#0a0a0a` base). **Image usage & visual treatment (context)** Full-bleed cinematic photography as section atmosphere — wide, moody, environmental. **Typography (context)** Two-font system: "Chalet" for headings (112px/700); "Instrument Sans" for body and UI (13.6px/400, line-height 21.76px). **Color usage (context)** Dark surfaces (`#0a0a0a`). **Shape & elevation (context)** Moderate rounding (6px) — contemporary and neutral. **Animation & motion**
Motion personality: **smooth** — 300–400ms transitions. Polished, contemporary SaaS feel. Base duration: 300ms.
⚠️ **Scroll-scrub paradigm** — animations are TIED TO SCROLL POSITION, not triggered once. Use GSAP `scrub: true` or CSS `animation-timeline: scroll()`. Elements animate forward/backward as user scrolls. IntersectionObserver alone will NOT recreate this.
Nav: starts transparent → `backdrop-filter:blur(12px)` + `background:rgba(bg,0.85)` at ~80px scroll.
Ticker/marquee: `@keyframes { to { transform:translateX(-50%) } }` 30–40s linear infinite. `mix-blend-mode:lighten` — logos blend as light overlays into dark bg. **Ambient / always-on animations** (loop infinite):
- **custom** (2×, duration: 4s, 4s): Recreate with `animation-iteration-count: infinite`.
- **pulse** (1×, duration: 3s): `scale(1 → 1.05 → 1)` ease-in-out. **Color architecture — dual personality: (context)** Hero section: full-viewport `#ed462d` (DARK). **Page flow (context)** 1. **Spacing & rhythm (context)** Section padding: 128px vertical. **Component language (context)** Buttons: Primary = rounded, `#0a0a0a` fill, 13.6px, 700 weight. **Type scale (context)** H1: 112px/700, tracking: -4.48px.
### Motion System
**Interaction patterns:**
- **Button (secondary/ghost):** background: `rgba(240, 237, 230, 0.05)`, bg → `rgba(240, 237, 230, 0.05)`, background-image: `initial`
- **Nav link:** opacity → `1`, 0.2s
- **Card / item:** transition: `fill, stroke`
- **Arrow / icon:** text → `rgba(240, 237, 230, .5)`, 0.1s
**Scroll-triggered animations:**
- Scroll reveal: `opacity 0→1, translateY(20px→0)`, 0.5s ease-out on scroll entry — trigger with IntersectionObserver
**Keyframe animations:**
- `btn-glitch`: `0% { transform: translate(0px); text-shadow: none; opacity: 1; }` → `100% { transform: translate(0px); text-shadow: none; opacity: 1; }`
- `glitch-subtle-1`: `0% { clip: rect(12px, 9999px, 5px, 0px); }` → `100% { clip: rect(60px, 9999px, 100px, 0px); }`
- `glitch-subtle-2`: `0% { clip: rect(65px, 9999px, 100px, 0px); }` → `100% { clip: rect(10px, 9999px, 60px, 0px); }`
- `pulse-ring`: `0%, 100% { opacity: 0.4; transform: scale(1); }` → `50% { opacity: 0; transform: scale(2); }` — pulsing rhythm
### Context — Do not change
- **Colors:** `#0a0a0a` base, `#0a0a0a` primary action, `#ed462d` accent
- **Typography:** "Chalet" headings, "Instrument Sans" body, body 13.6px/400
- **Layout:** `1296px` max-width, `128px` section padding
- Mix-blend-modes used: lighten
### Interaction Paradigm
- ⚠️ **ANIMATION ARCHITECTURE — TWO TIERS:** **TIER 1 — HERO (Section 1):** Load-time animations ONLY, no scroll dependency. All hero elements animate on page mount using CSS `@keyframes` with staggered `animation-delay`. Initial `opacity:0` IS PERMITTED in hero because animation fires automatically within 0.4s of load — never waiting for scroll. FAILSAFE: If CSS animation fails to fire, fallback to `opacity:1` via `setTimeout(() => els.forEach(el => el.style.opacity = "1"), 500)`. **TIER 2 — CONTENT SECTIONS:** Scroll-triggered WITH mandatory failsafe. Section headings/eyebrow labels reveal on scroll entry: Initial: `opacity:0; translateY(20px)`. Revealed: `opacity:1; translateY(0)`. Transition: `0.4s ease-out`. MANDATORY DUAL FAILSAFE (both required): 1. `IntersectionObserver {threshold:0.1}`: adds `.is-visible` class on intersection. 2. Timeout: `setTimeout(() => document.querySelectorAll(".reveal-text").forEach(el => el.classList.add("is-visible")), 2000);` This guarantees animation on scroll AND visibility after 2s even if Observer never fires.
- **Hover feedback:** Explicit — components respond visually (shadow/transform) to signal interactivity.
- **Timing base:** `300ms` `ease, ease` — balanced, professional pacing.
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
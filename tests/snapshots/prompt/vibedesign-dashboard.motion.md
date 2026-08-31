Analysis confidence: High
**Use the exact hex colors, px values, and tokens specified in this prompt. Prefer extracted values over framework defaults (shadcn, Tailwind, component library defaults).**
Here is the **Motion System** extracted from vibedesign.tech.
Use as specification for your implementation. Values are measured from the live site — do not substitute with framework defaults.
Source: vibedesign.tech · Page type: dashboard/app
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
**Overall character (context)** Dark-first SaaS with saturated cool accents. **Section rhythm & color hierarchy (context)** Consistently dark (`#111113` base). **Image usage & visual treatment (context)** Minimal imagery — design relies on typography, color, and space. **Typography (context)** Single typeface: "Inter" — hierarchy via weight and size contrast. **Color usage (context)** Dark surfaces (`#111113`). **Shape & elevation (context)** Pill-shaped interactive elements (border-radius: 9999px) with glow elevation. **Animation & motion**
Motion personality: **snappy** — interactions respond in <200ms. Micro-interactions feel mechanical and precise. Base duration: 150ms. Dominant easing: `cubic-bezier(0.4, 0, 0.2, 1)`.
⚠️ **Scroll-scrub paradigm** — animations are TIED TO SCROLL POSITION, not triggered once. Use GSAP `scrub: true` or CSS `animation-timeline: scroll()`. Elements animate forward/backward as user scrolls. IntersectionObserver alone will NOT recreate this.
Nav: starts transparent → `backdrop-filter:blur(12px)` + `background:rgba(bg,0.85)` at ~80px scroll.
Ticker/marquee: `@keyframes { to { transform:translateX(-50%) } }` 30–40s linear infinite. **Page flow (context)** (2 sections detected — layout may vary) 1. **Layered image compositions (render ALL layers, not just one): (context)** Section: SENTINEL Our platform helps teams ship faster than ever before. **Spacing & rhythm (context)** Section padding: 32px vertical. **Component language (context)** Buttons: Primary = 6px, 12px. **Type scale (context)** H1: 40px/700.
### Motion System
**Interaction patterns:**
- **Card / item:** transform: `translateY(-2px)`, border → `hsl(210 100% 50% / .2)`
**Keyframe animations:**
- `bounce`: `0%, 100% { transform: translateY(-25%); animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }` → `50% { transform: none; animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }` — bounce / spring motion
- `ping`
- `pulse` — pulsing rhythm
- `spin` — continuous rotation (loading / decorative spinner)
**Motion tokens (CSS variables):**
- `--badge-transition-duration`: 0.2s
### Context — Do not change
- **Colors:** `#111113` base, `#3a1df5` primary action
- **Typography:** "Inter" headings
- **Layout:** `1200px` max-width, `32px` section padding
### Interaction Paradigm
- ⚠️ **ANIMATION ARCHITECTURE — TWO TIERS:** **TIER 1 — HERO (Section 1):** Load-time animations ONLY, no scroll dependency. All hero elements animate on page mount using CSS `@keyframes` with staggered `animation-delay`. Initial `opacity:0` IS PERMITTED in hero because animation fires automatically within 0.4s of load — never waiting for scroll. FAILSAFE: If CSS animation fails to fire, fallback to `opacity:1` via `setTimeout(() => els.forEach(el => el.style.opacity = "1"), 500)`. **TIER 2 — CONTENT SECTIONS:** Scroll-triggered WITH mandatory failsafe. Section headings/eyebrow labels reveal on scroll entry: Initial: `opacity:0; translateY(20px)`. Revealed: `opacity:1; translateY(0)`. Transition: `0.4s ease-out`. MANDATORY DUAL FAILSAFE (both required): 1. `IntersectionObserver {threshold:0.1}`: adds `.is-visible` class on intersection. 2. Timeout: `setTimeout(() => document.querySelectorAll(".reveal-text").forEach(el => el.classList.add("is-visible")), 2000);` This guarantees animation on scroll AND visibility after 2s even if Observer never fires.
- **Hover feedback:** Explicit — components respond visually (shadow/transform) to signal interactivity.
- **Timing base:** `150ms` `cubic-bezier(0.4, 0, 0.2, 1)` — snappy, app-like responsiveness.
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
Analysis confidence: Low
**Use the exact hex colors, px values, and tokens specified in this prompt. Prefer extracted values over framework defaults (shadcn, Tailwind, component library defaults).**
Inspired by: tiny.example
Page type: web page
## Design Prompt
### Core Spec (Priority)
If any later detail conflicts, this section wins.
### Design Direction
**TL;DR:** refined, minimal, trustworthy. Typography and whitespace carry all hierarchy; color is surgical, used only at decision points.
**Overall character**
Clean, light-dominant layout. Neutral palette, content-first, trust-building. Enterprise or developer audience. **Section rhythm & color hierarchy**
Consistently light throughout (light neutral base). Sections distinguish through subtle background tints — e.g. pure white vs #f5f5f0 warm off-white — never dark backgrounds. Generous vertical padding (80–120px) between sections creates breathing room without color contrast. **Image usage & visual treatment**
Minimal imagery — design relies on typography, color, and space. Any visuals are functional: diagrams, UI mockups, icons. **Typography**
System font — weight and size contrast only. H1: 56–72px/700, body: 16–18px/400. **Color usage**
Neutral palette. Accent appears at interactive moments only — CTAs, active states, highlights. **Shape & elevation**
Consistent 6–8px radius. Precision over decoration. **Animation & motion**
Motion: scroll-triggered reveals likely present (animation library not detected — verify with DevTools). Safe default: `opacity:0→1` + `translateY(20px→0)`, 400ms ease-out. **Page flow** (1 sections detected — layout may vary)
1. **undefined**: "SENTINEL Our platform helps teams ship faster than ever before." **Tabbed content — all states (DO NOT collapse into one):**
State 1: "SENTINEL Our platform helps teams ship faster than ever before." Heading: "SENTINEL Our platform helps teams ship faster than ever before."
Each state has its own content — render conditionally based on activeTab index.
### Color Tokens
> ⚠ Color confidence: low — site may use CSS-in-JS or dynamic theming.
> Values below are computed approximations. Verify with browser DevTools.
Color role mapping:
- **Border** (`rgba(0,0,0,0.08)`): Card edges, dividers, form borders
- **Semantic states**: Success `#22c55e` · Error `#ef4444` · Warning `#f59e0b`
### Interaction Paradigm
- ⚠️ **Reveal: IMMEDIATE — CRITICAL RULE:** ALL content must be visible on page load. `opacity:1`, `transform:none` for every element, always. DO NOT use IntersectionObserver, scroll triggers, GSAP ScrollTrigger, AOS, or any visibility-on-scroll mechanism. DO NOT set `opacity:0` as initial state for any element. DO NOT use Framer Motion `whileInView` or animate-on-scroll props. Any element invisible at load is a broken implementation.
- **Hover feedback:** Minimal — design relies on cursor change and context, not visual transformation.
- **Timing base:** `300ms` `ease` — balanced, professional pacing.
### Component Patterns
**Navigation:** Sticky, `#fff` bg. `border-bottom:1px solid rgba(0,0,0,0.06)`. Logo left, CTA right.
**Primary button:** 0px radius, primary color from tokens, weight 600.
 Active: `transform: scale(0.98); transition: transform 150ms cubic-bezier(0.4,0,0.2,1)`. `button:active { transform: scale(0.98); }`
### Layout & Page Structure
### Section Content Map
**This page has exactly 1 sections in the order listed below.** Do NOT add sections (no invented testimonials, pricing, FAQ, newsletter, team, stats, or logo-wall blocks unless explicitly listed below). Do NOT omit or reorder sections. Each section's background, layout, and content are measured from the live site:
**Section 1: undefined** — [SAMPLE COPY] "SENTINEL Our platform helps teams ship faster than ever before." [statement · technical · ~10 words]
 Layout: undefined
 Animation: hero loads immediately (no scroll trigger).
VISUAL GUIDELINES:
- Recreate each visual based on its described type, size, placement, and framing.
- Use site palette for charts/diagrams; keep perspective and placement consistent.
Recreate this visual style faithfully. Use the EXACT hex colors, px values, font names, and spacing from the tokens and specifications above.
Source: tiny.example Implementation notes:
- Prefer the extracted color tokens over Tailwind defaults (slate, zinc, neutral, etc.). Override shadcn/ui CSS variables (--primary, --radius, --background) with the values specified above.
- Use the exact px values for border-radius, padding, and font sizes. Use the exact easing functions and durations from Motion Tokens.
- When a value is not specified in this prompt, a sensible default is acceptable. Add to globals.css (override shadcn defaults with site tokens):
:root { --background: #ffffff; --foreground: #000000; --card: #fafafa; --card-foreground: #000000; --popover: #fafafa; --popover-foreground: #000000; --primary: #000000; --primary-foreground: #ffffff; --secondary: #f0f0f0; --secondary-foreground: #000000; --muted: #f5f5f5; --muted-foreground: #6b7280; --accent: #ebebeb; --accent-foreground: #000000; --destructive: #ef4444; --destructive-foreground: #ffffff; --border: rgba(0,0,0,0.08); --input: rgba(0,0,0,0.08); --ring: #000000; --radius: 0px;
}
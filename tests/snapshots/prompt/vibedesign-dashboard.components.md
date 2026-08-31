Analysis confidence: High
**Use the exact hex colors, px values, and tokens specified in this prompt. Prefer extracted values over framework defaults (shadcn, Tailwind, component library defaults).**
Here is the **Component System** extracted from vibedesign.tech.
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
**Overall character (context)** Dark-first SaaS with saturated cool accents. **Section rhythm & color hierarchy (context)** Consistently dark (`#111113` base). **Image usage & visual treatment (context)** Minimal imagery — design relies on typography, color, and space. **Typography (context)** Single typeface: "Inter" — hierarchy via weight and size contrast. **Color usage (context)** Dark surfaces (`#111113`). **Shape & elevation**
Pill-shaped interactive elements (border-radius: 9999px) with glow elevation. Hover: glow expands. Soft-tech aesthetic.
Brutalist elevation: hard drop-shadows with zero blur (e.g. `4px 4px 0 color`). **Animation & motion**
Motion personality: **snappy** — interactions respond in <200ms. Micro-interactions feel mechanical and precise. Base duration: 150ms. Dominant easing: `cubic-bezier(0.4, 0, 0.2, 1)`.
⚠️ **Scroll-scrub paradigm** — animations are TIED TO SCROLL POSITION, not triggered once. Use GSAP `scrub: true` or CSS `animation-timeline: scroll()`. Elements animate forward/backward as user scrolls. IntersectionObserver alone will NOT recreate this.
Nav: starts transparent → `backdrop-filter:blur(12px)` + `background:rgba(bg,0.85)` at ~80px scroll.
Ticker/marquee: `@keyframes { to { transform:translateX(-50%) } }` 30–40s linear infinite. **Page flow (context)** (2 sections detected — layout may vary) 1. **Layered image compositions (render ALL layers, not just one): (context)** Section: SENTINEL Our platform helps teams ship faster than ever before. **Spacing & rhythm (context)** Section padding: 32px vertical. **Component language (context)** Buttons: Primary = 6px, 12px. **Type scale (context)** H1: 40px/700.
### Shape Tokens
- `--radius`: .5rem
- `--badge-radius`: 6px
- `--border-radius`: 8px
- Interactive elements (buttons, badges): `9999px` (pill)
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
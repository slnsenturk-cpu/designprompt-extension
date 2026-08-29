Analysis confidence: High
> ⚠ **Primary action color could not be determined confidently.** Three extraction signals disagreed: button says `#0a0a0a`, CSS var says `none`, frequency says `#ed462d`. The color below is a best guess — verify against the live site before shipping.
**Use the exact hex colors, px values, and tokens specified in this prompt. Prefer extracted values over framework defaults (shadcn, Tailwind, component library defaults).**
Here is the **Shape & Elevation System** extracted from rig.ai.
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
**Overall character (context)** Dark-first SaaS with saturated cool accents. **Section rhythm & color hierarchy (context)** Consistently dark (`#0a0a0a` base). **Image usage & visual treatment (context)** Full-bleed cinematic photography as section atmosphere — wide, moody, environmental. **Typography (context)** Two-font system: "Chalet" for headings (83.36px/700); "Instrument Sans" for body and UI (13.6px/400, line-height 21.76px). **Color usage (context)** Dark surfaces (`#0a0a0a`). **Shape & elevation**
Moderate rounding (6px) — contemporary and neutral. Layered shadows — don't simplify to a single layer.
Brutalist elevation: hard drop-shadows with zero blur (e.g. `4px 4px 0 color`). Hover states use offset shadow as a design motif: `.btn-red:hover:hover` → `box-shadow: 4px 4px 0 var(--blue)`. `.btn-cta:hover:hover` → `box-shadow: 4px 4px 0 var(--blue)`. This is a defining interaction pattern — reproduce exactly.
Glassmorphism panels: background rgba(255,255,255,0.03–0.08), backdrop-filter:blur(12–20px), border 1px solid rgba(255,255,255,0.08–0.12). These panels float above the base surface — use them for cards, modals, nav on scroll. The frosted effect is subtle, not milky. **Animation & motion (context)** Motion personality: **smooth** — 300–400ms transitions. **Ambient / always-on animations (context)** (loop infinite): - **custom** (2×, duration: 4s, 4s): Recreate with `animation-iteration-count: infinite`. **Color architecture — dual personality: (context)** Hero section: full-viewport `#ed462d` (DARK). **Page flow (context)** 1. **Spacing & rhythm (context)** Section padding: 128px vertical. **Component language (context)** Buttons: Primary = rounded, `#0a0a0a` fill, 13.6px, 700 weight. **Type scale (context)** H1: 83.36px/700, tracking: -3.3344px.
### Shadow Tokens
- shadow-sm — colored glow elevation: `oklch(0.6329 0.2075 31.49 / 0.4) 0px 0px 40px 0px`
- shadow-md — layered elevation: `rgba(0, 0, 0, 0.5) 0px -1px 0px 0px, rgba(0, 0, 0, 0.4) 0px 20px 60px 0px`
- shadow-lg — inset (surface depth / border effect, not elevation): `rgba(0, 0, 0, 0.5) 0px 2px 8px 0px inset`
- shadow-xl — colored glow elevation: `oklch(0.6329 0.2075 31.49 / 0.4) 0px 0px 8px 0px`
### Shape Tokens
- `1px`
- `6px` (input / small)
- `10px` (component)
- `50%` (pill / large-radius)
### Context — Do not change
- **Colors:** `#0a0a0a` base, `#0a0a0a` primary action
- **Typography:** "Chalet" headings, "Instrument Sans" body
- **Layout:** `90%` max-width, `128px` section padding
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
- "Chalet": https://example.com/SENTIN.woff2
- "Geist Pixel Square": https://example.com/SENTIN.woff2 Load ALL custom fonts via @font-face in global CSS:
@font-face { font-family: 'Chalet'; src: url('https://example.com/SENTIN.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
@font-face { font-family: 'Geist Pixel Square'; src: url('https://example.com/SENTIN.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
These fonts WILL load from the URLs above. Do not substitute with Google Fonts alternatives. Add to globals.css (override shadcn defaults with site tokens):
:root { --background: #0a0a0a; --foreground: #f0eee6; --card: #121212; --card-foreground: #f0eee6; --popover: #121212; --popover-foreground: #f0eee6; --primary: #0a0a0a; --primary-foreground: #ffffff; --secondary: #1e1e1e; --secondary-foreground: #f0eee6; --muted: #191919; --muted-foreground: #767676; --accent: #232323; --accent-foreground: #ffffff; --destructive: #ef4444; --destructive-foreground: #ffffff; --border: rgba(255,255,255,0.08); --input: rgba(255,255,255,0.08); --ring: #0a0a0a; --radius: 6px;
}
Analysis confidence: High
**Use the exact hex colors, px values, and tokens specified in this prompt. Prefer extracted values over framework defaults (shadcn, Tailwind, component library defaults).**
Here is the **Color System** extracted from northwind.io.
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
**Overall character (context)** Light base with a strong cool-toned primary action (`#2563eb`). **Section rhythm & color hierarchy (context)** Consistently light throughout (`#ffffff` base). **Image usage & visual treatment (context)** Minimal imagery — design relies on typography, color, and space. **Typography (context)** Single typeface: "Inter, -apple-system, sans-serif" — hierarchy via weight and size contrast. **Color usage**
Light surfaces (`#ffffff`). Color used sparingly — white/neutral dominates. `#2563eb` (primary action — CTAs, links, focus). `#f59e0b` secondary accent — category/state/decoration, never swap with primary. Named accents: `#16a34a` (--color-brand-accent) — assign to specific semantic roles (e.g. developer callouts, code highlighting). Backgrounds: white + `#ffffff` eggshell for section variation. **Shape & elevation (context)** Pills (9999px) for buttons/badges. **Animation & motion (context)** Motion personality: **snappy** — interactions respond in <200ms. **Hero entrance sequence (context)** (in order): 1. **Page flow (context)** (1 sections detected — layout may vary) 1. **Interactive components (context)** - **Split content panel**: image/visual left + 4 bullet points right + testimonial block. **Tabbed content — all states (DO NOT collapse into one): (context)** State 1: "SENTINEL Our platform helps teams ship faster than ever before.". **Component language (context)** Buttons: Primary = 8px, `#2563eb` fill, 15px, 600 weight. **Type scale (context)** H1: 56px/700, tracking: -0.02em.
### Color Tokens
- `--color-primary`: #2563eb
- `--color-brand-accent`: #16a34a
Computed:
- accent-2: `#f59e0b`
- accent-3: `#1d4ed8`
- background: `#ffffff`
- foreground (text): `#0f172a`
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
**Semantic roles:**
- `#2563eb` — **primary action**: CTAs, primary buttons, focus rings, active states. The color that says "act here." Use only at decision points.
- `#16a34a` (--color-brand-accent) — **brand accent**: decorative emphasis, specific brand moments.
### Context — Do not change
- **Typography:** "Inter, -apple-system, sans-serif" headings, 16px/400
- **Shape:** `6px` component radius, `9999px` pill badges
### Dark Mode Tokens
These CSS properties change under `@media (prefers-color-scheme: dark)`. Use Tailwind `dark:` utilities:
- `--color-bg: #0f172a`
- `--color-text: #f8fafc`
- `--color-surface: #1e293b`
Recreate this visual style faithfully. Use the EXACT hex colors, px values, font names, and spacing from the tokens and specifications above.
Source: northwind.io Implementation notes:
- Prefer the extracted color tokens over Tailwind defaults (slate, zinc, neutral, etc.). Override shadcn/ui CSS variables (--primary, --radius, --background) with the values specified above.
- Use the exact px values for border-radius, padding, and font sizes. Use the exact easing functions and durations from Motion Tokens.
- When a value is not specified in this prompt, a sensible default is acceptable.
NOTE: "Inter, -apple-system, sans-serif", "Söhne Mono, monospace" are custom fonts not available on Google Fonts. Use the closest Google Fonts alternative (e.g. Inter, DM Sans, Space Grotesk for sans-serif; JetBrains Mono, Fira Code for monospace; Playfair Display for serif display) and match the weight/tracking values. Add to globals.css (override shadcn defaults with site tokens):
:root { --background: #ffffff; --foreground: #475569; --card: #fafafa; --card-foreground: #475569; --popover: #fafafa; --popover-foreground: #475569; --primary: #2563eb; --primary-foreground: #ffffff; --secondary: #f0f0f0; --secondary-foreground: #475569; --muted: #f5f5f5; --muted-foreground: #6b7280; --accent: #16a34a; --accent-foreground: #ffffff; --destructive: #ef4444; --destructive-foreground: #ffffff; --border: rgba(0,0,0,0.08); --input: rgba(0,0,0,0.08); --ring: #2563eb; --radius: 6px;
}
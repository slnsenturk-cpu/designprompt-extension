Analysis confidence: High
> ⚠ **Primary action color could not be determined confidently.** Three extraction signals disagreed: button says `#cd8407`, CSS var says `none`, frequency says `#2f80fa`. The color below is a best guess — verify against the live site before shipping.
**Use the exact hex colors, px values, and tokens specified in this prompt. Prefer extracted values over framework defaults (shadcn, Tailwind, component library defaults).**
Here is the **Shape & Elevation System** extracted from posthog.com.
Use as specification for your implementation. Values are measured from the live site — do not substitute with framework defaults.
Source: posthog.com · Page type: landing page
## Design Prompt
> **Design system detected: Radix UI** (high confidence). Radix primitives detected — tokens represent the styling layer on top of headless components
### Core Spec (Priority)
If any later detail conflicts, this section wins.
- Base background: `#eeefe9`
 Use ONLY this exact value for the page/body background. Do NOT substitute with `bg-white`, `bg-background`, `bg-slate-50`, `bg-zinc-50`, shadcn `--background` default, or any other neutral. The entire page renders on this color.
- Primary action color: `#cd8407`
 Use ONLY this exact hex for primary CTAs, buttons, focus rings, and active states. Do NOT substitute with Tailwind `blue-500`, `indigo-600`, `violet-600`, shadcn `--primary` default, or any other color. If a component you generate doesn't reference this token, the component is wrong.
- Heading typeface: "RoundHog"
- Body/UI typeface: "RoundHog"
- Core component radius family starts at `4px`
- Motion base duration: `600ms`
### Design Direction
**Overall character (context)** Light base with expressive accent (`#cd8407`). **Section rhythm & color hierarchy (context)** Consistently light throughout (`#eeefe9` base). **Image usage & visual treatment (context)** Product screenshots as the primary visual — real UI in context. **Typography (context)** Single typeface: "RoundHog" — hierarchy via weight and size contrast. **Color usage (context)** Light surfaces (`#eeefe9`). **Shape & elevation**
Pill-shaped interactive elements (border-radius: 9999px) with glow elevation. Hover: glow expands. Soft-tech aesthetic.
Brutalist elevation: hard drop-shadows with zero blur (e.g. `4px 4px 0 color`). **Animation & motion (context)** Motion personality: **editorial** — 500–700ms reveals. **Ambient / always-on animations (context)** (loop infinite): - **gradient-drift** (1×, duration: 3s): `background-size: 200% 200%` + `@keyframes` shifting `background-position`. **Page flow (context)** (1 sections detected — layout may vary) 1. **Interactive components (context)** - **Tabbed switcher** (3 items): "SENTINEL Our platform helps teams ship faster than ever before." | "SENTINEL Our platform helps teams ship faster than ever before." | "SENTINEL Our platform helps teams ship faster than ever before.". **Layered image compositions (render ALL layers, not just one): (context)** Section: SENTINEL Our platform helps teams ship faster than ever before. **Spacing & rhythm (context)** container max-width: 1200px. **Component language (context)** Buttons: Primary = 6px, `#cd8407` fill, 16px. **Type scale (context)** H1: 36px/800, tracking: -0.9px.
### Shadow Tokens
- shadow-sm: `rgba(0, 0, 0, 0.25) 0px 25px 50px -12px`
- shadow-md — layered elevation: `rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.1) 0px 2px 4px -2px`
- shadow-lg — glow (zero-offset): `rgba(255, 255, 255, 0.4) 0px 0px 6px 2px`
### Shape Tokens
- `4px` (input / small)
- `6px` (primary button)
- `6px 6px 0px 0px` (partial — top-attached panel or directional corner)
- `8px` (component)
- `40%` (card / container)
- `9999px` (pill / large-radius)
### Context — Do not change
- **Colors:** `#eeefe9` base, `#cd8407` primary action
- **Typography:** "RoundHog" headings
- **Layout:** `1200px` max-width
Recreate this visual style faithfully. Use the EXACT hex colors, px values, font names, and spacing from the tokens and specifications above.
Source: posthog.com Implementation notes:
- Prefer the extracted color tokens over Tailwind defaults (slate, zinc, neutral, etc.). Override shadcn/ui CSS variables (--primary, --radius, --background) with the values specified above.
- Use the exact px values for border-radius, padding, and font sizes. Use the exact easing functions and durations from Motion Tokens.
- When a value is not specified in this prompt, a sensible default is acceptable.
- Detected stack: Tailwind CSS — use utility classes and override tailwind.config with extracted color tokens.
NOTE: "RoundHog" is a custom font not available on Google Fonts. Use the closest Google Fonts alternative (e.g. Inter, DM Sans, Space Grotesk for sans-serif; JetBrains Mono, Fira Code for monospace; Playfair Display for serif display) and match the weight/tracking values.
### Custom Font Files
These font files are served directly from the site — load via @font-face:
- "IBM Plex Sans Variable": https://posthog.com/SENTIN.woff2
- "Fairytale": https://posthog.com/SENTIN.woff2
- "Computer Modern": https://posthog.com/SENTIN.woff
- "Squeak": https://posthog.com/SENTIN.woff2
- "RoundHog": https://posthog.com/SENTIN.woff2
- "Charter": https://res.cloudinary.com/SENTIN.woff Load ALL custom fonts via @font-face in global CSS:
@font-face { font-family: 'IBM Plex Sans Variable'; src: url('https://posthog.com/SENTIN.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
@font-face { font-family: 'Fairytale'; src: url('https://posthog.com/SENTIN.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
@font-face { font-family: 'Computer Modern'; src: url('https://posthog.com/SENTIN.woff') format('woff'); font-weight: 400 700; font-display: swap; }
@font-face { font-family: 'Squeak'; src: url('https://posthog.com/SENTIN.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
@font-face { font-family: 'RoundHog'; src: url('https://posthog.com/SENTIN.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
@font-face { font-family: 'Charter'; src: url('https://res.cloudinary.com/SENTIN.woff') format('woff'); font-weight: 400 700; font-display: swap; }
These fonts WILL load from the URLs above. Do not substitute with Google Fonts alternatives. Add to globals.css (override shadcn defaults with site tokens):
:root { --background: #eeefe9; --foreground: #65675e; --card: #e9eae4; --card-foreground: #65675e; --popover: #e9eae4; --popover-foreground: #65675e; --primary: #cd8407; --primary-foreground: #000000; --secondary: #dfe0da; --secondary-foreground: #65675e; --muted: #e4e5df; --muted-foreground: #6b7280; --accent: #dadbd5; --accent-foreground: #000000; --destructive: #ef4444; --destructive-foreground: #ffffff; --border: rgba(0,0,0,0.08); --input: rgba(0,0,0,0.08); --ring: #cd8407; --radius: 4px;
}
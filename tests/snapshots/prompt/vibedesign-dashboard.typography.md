Analysis confidence: High
**Use the exact hex colors, px values, and tokens specified in this prompt. Prefer extracted values over framework defaults (shadcn, Tailwind, component library defaults).**
Here is the **Typography System** extracted from vibedesign.tech.
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
**Overall character (context)** Dark-first SaaS with saturated cool accents. **Section rhythm & color hierarchy (context)** Consistently dark (`#111113` base). **Image usage & visual treatment (context)** Minimal imagery — design relies on typography, color, and space. **Typography**
Single typeface: "Inter" — hierarchy via weight and size contrast. **Color usage (context)** Dark surfaces (`#111113`). **Shape & elevation (context)** Pill-shaped interactive elements (border-radius: 9999px) with glow elevation. **Animation & motion (context)** Motion personality: **snappy** — interactions respond in <200ms. **Page flow (context)** (2 sections detected — layout may vary) 1. **Layered image compositions (render ALL layers, not just one): (context)** Section: SENTINEL Our platform helps teams ship faster than ever before. **Spacing & rhythm (context)** Section padding: 32px vertical. **Component language (context)** Buttons: Primary = 6px, 12px. **Type scale (context)** H1: 40px/700.
### Typography Tokens
- Display/heading: "Inter"
- Body/UI: "CameraPlainVariable"
Size scale:
 - `--size`: 16px
### Type Scale
- **H1:** `40px/50px/700`, font "Inter"
- **H2:** `20px/30px/700`, font "Inter"
- Weights used: 400, 500, 600, 700
### Context — Do not change
- **Colors:** `#111113` base, `#3a1df5` primary action
- **Layout:** `1200px` max-width, `32px` section padding
- **Shape:** `6px` component radius, `9999px` pill
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
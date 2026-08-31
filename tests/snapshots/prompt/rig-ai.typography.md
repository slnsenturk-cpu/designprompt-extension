Analysis confidence: High
> ⚠ **Primary action color could not be determined confidently.** Three extraction signals disagreed: button says `#0a0a0a`, CSS var says `none`, frequency says `#ed462d`. The color below is a best guess — verify against the live site before shipping.
**Use the exact hex colors, px values, and tokens specified in this prompt. Prefer extracted values over framework defaults (shadcn, Tailwind, component library defaults).**
Here is the **Typography System** extracted from rig.ai.
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
**Overall character (context)** Dark-first SaaS with saturated cool accents. **Section rhythm & color hierarchy (context)** Consistently dark (`#0a0a0a` base). **Image usage & visual treatment (context)** Full-bleed cinematic photography as section atmosphere — wide, moody, environmental. **Typography**
Two-font system: "Chalet" for headings (112px/700); "Instrument Sans" for body and UI (13.6px/400, line-height 21.76px). Distinct registers — never blur the roles. **Color usage (context)** Dark surfaces (`#0a0a0a`). **Shape & elevation (context)** Angular geometry — interactive elements are chamfered by 14px with a `clip-path` polygon, NOT a border-radius. **Animation & motion (context)** Motion personality: **smooth** — 300–400ms transitions. **Ambient / always-on animations (context)** (loop infinite): - **custom** (2×, duration: 4s, 4s): Recreate with `animation-iteration-count: infinite`. **Color architecture — dual personality: (context)** Hero section: full-viewport `#ed462d` (DARK). **Page flow (context)** 1. **Spacing & rhythm (context)** Section padding: 128px vertical. **Component language (context)** Buttons: Primary = chamfered 14px, `#0a0a0a` fill, 13.6px, 700 weight. **Type scale (context)** H1: 112px/700, tracking: -4.48px.
### Typography Tokens
- Display/heading: "Chalet"
- Body/UI: "Instrument Sans"
- Labels/mono: "Geist Pixel Square"
### Type Scale
- **H1:** `112px/98.56px/700`, tracking `-4.48px`, font "Chalet"
- **H2:** `72px/66.24px/700`, tracking `-2.16px`, font "Chalet"
- **H3:** `32px/30.4px/700`, tracking `-0.96px`, font "Chalet"
- **Body:** `13.6px/21.76px/400`, font "Instrument Sans"
- **Label:** `12.8px/normal/400`, tracking `1.28px`, `uppercase`, font "Geist Pixel Square"
- Weights used: 400, 600, 700
### Context — Do not change
- **Colors:** `#0a0a0a` base, `#0a0a0a` primary action, `#ed462d` accent
- **Layout:** `1296px` max-width, `128px` section padding
- **Shape:** `6px` component radius
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
- "Chalet": https://rig.ai/SENTIN.woff2 — licence unknown; if you cannot use it, Inter Tight or Space Grotesk is a close substitute (suggested, not observed)
- "Geist Pixel Square": https://rig.ai/SENTIN.woff2 — licence unknown; if you cannot use it, Silkscreen or Press Start 2P is a close substitute (suggested, not observed)
- "Instrument Sans": https://rig.ai/SENTIN.woff2 — openly licensed (Google Fonts); this copy is self-hosted, so use either the URL or the Google Fonts release
- "Chivo Mono": https://rig.ai/SENTIN.woff2 — openly licensed (Google Fonts); this copy is self-hosted, so use either the URL or the Google Fonts release Load ALL custom fonts via @font-face in global CSS:
@font-face { font-family: 'Chalet'; src: url('https://rig.ai/SENTIN.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
@font-face { font-family: 'Geist Pixel Square'; src: url('https://rig.ai/SENTIN.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
@font-face { font-family: 'Instrument Sans'; src: url('https://rig.ai/SENTIN.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
@font-face { font-family: 'Chivo Mono'; src: url('https://rig.ai/SENTIN.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
These URLs work as-is. "Instrument Sans", "Chivo Mono" are also on Google Fonts, so either source is fine for them. For the rest, use the URL above rather than guessing a lookalike. Add to globals.css (override shadcn defaults with site tokens):
:root { --background: #0a0a0a; --foreground: #f0eee6; --card: #121212; --card-foreground: #f0eee6; --popover: #121212; --popover-foreground: #f0eee6; --primary: #0a0a0a; --primary-foreground: #ffffff; --secondary: #1e1e1e; --secondary-foreground: #f0eee6; --muted: #191919; --muted-foreground: #767676; --accent: #232323; --accent-foreground: #ffffff; --destructive: #ef4444; --destructive-foreground: #ffffff; --border: rgba(255,255,255,0.08); --input: rgba(255,255,255,0.08); --ring: #0a0a0a; --radius: 10px;
}
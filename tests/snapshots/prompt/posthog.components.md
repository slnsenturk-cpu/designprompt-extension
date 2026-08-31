Analysis confidence: High
> ⚠ **Primary action color could not be determined confidently.** Three extraction signals disagreed: button says `#cd8407`, CSS var says `none`, frequency says `#2f80fa`. The color below is a best guess — verify against the live site before shipping.
**Use the exact hex colors, px values, and tokens specified in this prompt. Prefer extracted values over framework defaults (shadcn, Tailwind, component library defaults).**
Here is the **Component System** extracted from posthog.com.
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
Brutalist elevation: hard drop-shadows with zero blur (e.g. `4px 4px 0 color`). **Animation & motion**
Motion personality: **editorial** — 500–700ms reveals. Content enters with deliberate pace, like a magazine. Base duration: 600ms. Dominant easing: `cubic-bezier(0, 0, 0.2, 1)`.
Scroll reveals: **pure fade** — `opacity:0→1` only, no transform. Editorial, clean.
Content slider: horizontal snap, auto-play, pause on hover.
Nav: starts transparent → `backdrop-filter:blur(12px)` + `background:rgba(bg,0.85)` at ~80px scroll.
Parallax: background moves at different speed than foreground content. 3D transform approach: `perspective` + `translateZ()` on layered elements. **Ambient / always-on animations** (loop infinite):
- **gradient-drift** (1×, duration: 3s): `background-size: 200% 200%` + `@keyframes` shifting `background-position`.
- **custom** (3×, duration: 45s, 2s, 3s): Recreate with `animation-iteration-count: infinite`. **Page flow (context)** (1 sections detected — layout may vary) 1. **Interactive components (context)** - **Tabbed switcher** (3 items): "SENTINEL Our platform helps teams ship faster than ever before." | "SENTINEL Our platform helps teams ship faster than ever before." | "SENTINEL Our platform helps teams ship faster than ever before.". **Layered image compositions (render ALL layers, not just one): (context)** Section: SENTINEL Our platform helps teams ship faster than ever before. **Spacing & rhythm (context)** container max-width: 1200px. **Component language (context)** Buttons: Primary = 6px, `#cd8407` fill, 16px. **Type scale (context)** H1: 36px/800, tracking: -0.9px.
### Shape Tokens
- `4px` (input / small)
- `6px` (primary button)
- `6px 6px 0px 0px` (partial — top-attached panel or directional corner)
- `8px` (component)
- `40%` (card / container)
- `9999px` (pill / large-radius)
### Iconography & Visual System
Icon system: Custom inline SVG (filled)
Inline SVG icons: 7 detected
- Size: 24x24, 20x20, 18x18
- Style: filled (0% outlined)
- Stroke weight: 1px
- Icon accent colors: `#23251d`, `#111111`
### Component Patterns
**Navigation:** Sticky. Starts transparent, transitions on scroll past 80px to `rgba(255,255,255,0.92)` + `backdrop-filter:blur(12px)` + `border-bottom:1px solid rgba(0,0,0,0.06)`. Logo left, CTA right.
**Primary button:** `6px` radius, `#cd8407` bg, text `#23251d`, height `31.5px`, padding `0px`, font `16px/400` "RoundHog". Hover: `opacity: 1`.
 Spec: `background-color: #cd8407` · `color: #23251d` · `padding: 0px` · `border-radius: 6px` · `font-size: 16px` · `font-weight: 400` · `font-family: "RoundHog"` · `border: 1px solid rgb(177, 120, 22)` · `height: 31.5px` · `transition: color 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), text-decoration-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), fill 0.15s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.15s cubic-bezier(0.4, 0, 0.2, 1)`
 Hover:· `opacity: 1` → hover:opacity-100
 Transition: `color 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), text-decoration-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), fill 0.15s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.15s cubic-bezier(0.4, 0, 0.2, 1)`
 Active: `transform: scale(0.98); transition: transform 150ms cubic-bezier(0.4,0,0.2,1)`. `button:active { transform: scale(0.98); }`
**Ghost button:** `4px` radius, transparent bg, border `1px solid rgba(0,0,0,0.15)`, padding `2px 8px`. Hover: bg rgba(0,0,0,0.04).
 Spec: `background-color: transparent` · `border: 1px solid rgba(0,0,0,0.15)` · `color: #23251d` · `padding: 2px 8px` · `border-radius: 4px` · `font-size: 13px` · `font-weight: 500`
**Secondary button:** `4px` radius, `#000000` bg, text `#23251d` (measured on `#e5e7e0`, where the two are not adjacent), padding `2px 8px`, font `13px/500`
 Spec: `background-color: #000000` · `color: #23251d` · `padding: 2px 8px` · `border-radius: 4px` · `font-size: 13px` · `font-weight: 500`
**Cards:** `#eeefe9` bg, layered shadow from tokens. 6px radius. Padding 24–32px.
**Hero:** Light background (`#eeefe9`). Dark text on light. No overlay, no full-bleed photo. Headline: clamp(48px,6vw,80px)/800 in display font. Primary CTA with `#cd8407` + ghost, side by side. Generous padding (80–120px vertical).
**Decorative background:** Subtle, non-intrusive SVG elements used as section atmosphere. Keep them minimal — `position:absolute, z-index:-1, pointer-events:none`, opacity 0.05–0.12. Do NOT add grid lines, crop marks, dot patterns, or any strong geometric overlays. The decoration should be barely noticeable — if it draws attention, it's too much.
**Custom cursor:** CSS `cursor: url(...)` — custom cursor image on interactive elements. Applied to: `.cursor-play`.
**Global interactive rules:** links → `color: #23251d`, no underline; `[type="checkbox"]:checked:hover` → background-color: currentcolor, border-color: transparent; `[type="radio"]:checked:hover` → background-color: currentcolor, border-color: transparent; `[type="checkbox"]:indeterminate:hover` → background-color: currentcolor, border-color: transparent.
Recreate this visual style faithfully. Use the EXACT hex colors, px values, font names, and spacing from the tokens and specifications above.
Source: posthog.com Implementation notes:
- Prefer the extracted color tokens over Tailwind defaults (slate, zinc, neutral, etc.). Override shadcn/ui CSS variables (--primary, --radius, --background) with the values specified above.
- Use the exact px values for border-radius, padding, and font sizes. Use the exact easing functions and durations from Motion Tokens.
- When a value is not specified in this prompt, a sensible default is acceptable.
- Detected stack: Tailwind CSS — use utility classes and override tailwind.config with extracted color tokens.
NOTE: "RoundHog" is a custom font not available on Google Fonts. Use the closest Google Fonts alternative (e.g. Inter, DM Sans, Space Grotesk for sans-serif; JetBrains Mono, Fira Code for monospace; Playfair Display for serif display) and match the weight/tracking values.
### Custom Font Files
These font files are served directly from the site — load via @font-face:
- "IBM Plex Sans Variable": https://posthog.com/SENTIN.woff2 — openly licensed (Google Fonts); this copy is self-hosted, so use either the URL or the Google Fonts release
- "Fairytale": https://posthog.com/SENTIN.woff2 — licence unknown; if you cannot use it, Instrument Sans or DM Sans is a close substitute (suggested, not observed)
- "Computer Modern": https://posthog.com/SENTIN.woff — licence unknown; if you cannot use it, Instrument Sans or DM Sans is a close substitute (suggested, not observed)
- "Squeak": https://posthog.com/SENTIN.woff2 — licence unknown; if you cannot use it, Instrument Sans or DM Sans is a close substitute (suggested, not observed)
- "RoundHog": https://posthog.com/SENTIN.woff2 — licence unknown; if you cannot use it, Inter Tight or Space Grotesk is a close substitute (suggested, not observed)
- "Charter": https://res.cloudinary.com/SENTIN.woff — licence unknown; if you cannot use it, Instrument Sans or DM Sans is a close substitute (suggested, not observed) Load ALL custom fonts via @font-face in global CSS:
@font-face { font-family: 'IBM Plex Sans Variable'; src: url('https://posthog.com/SENTIN.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
@font-face { font-family: 'Fairytale'; src: url('https://posthog.com/SENTIN.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
@font-face { font-family: 'Computer Modern'; src: url('https://posthog.com/SENTIN.woff') format('woff'); font-weight: 400 700; font-display: swap; }
@font-face { font-family: 'Squeak'; src: url('https://posthog.com/SENTIN.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
@font-face { font-family: 'RoundHog'; src: url('https://posthog.com/SENTIN.woff2') format('woff2'); font-weight: 400 700; font-display: swap; }
@font-face { font-family: 'Charter'; src: url('https://res.cloudinary.com/SENTIN.woff') format('woff'); font-weight: 400 700; font-display: swap; }
These URLs work as-is. "IBM Plex Sans Variable" is also on Google Fonts, so either source is fine for it. For the rest, use the URL above rather than guessing a lookalike. Add to globals.css (override shadcn defaults with site tokens):
:root { --background: #eeefe9; --foreground: #65675e; --card: #e9eae4; --card-foreground: #65675e; --popover: #e9eae4; --popover-foreground: #65675e; --primary: #cd8407; --primary-foreground: #000000; --secondary: #dfe0da; --secondary-foreground: #65675e; --muted: #e4e5df; --muted-foreground: #6b7280; --accent: #dadbd5; --accent-foreground: #000000; --destructive: #ef4444; --destructive-foreground: #ffffff; --border: rgba(0,0,0,0.08); --input: rgba(0,0,0,0.08); --ring: #cd8407; --radius: 6px;
}
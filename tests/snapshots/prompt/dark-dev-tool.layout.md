Analysis confidence: High
**Use the exact hex colors, px values, and tokens specified in this prompt. Prefer extracted values over framework defaults (shadcn, Tailwind, component library defaults).**
Here is the **Layout System** extracted from forge-cli.dev.
Use as specification for your implementation. Values are measured from the live site — do not substitute with framework defaults.
Source: forge-cli.dev · Page type: developer-tool
## Design Prompt
### Core Spec (Priority)
If any later detail conflicts, this section wins.
- Base background: `#0b0d12`
 Use ONLY this exact value for the page/body background. Do NOT substitute with `bg-white`, `bg-background`, `bg-slate-50`, `bg-zinc-50`, shadcn `--background` default, or any other neutral. The entire page renders on this color.
- Primary action color: `#7c3aed`
 Use ONLY this exact hex for primary CTAs, buttons, focus rings, and active states. Do NOT substitute with Tailwind `blue-500`, `indigo-600`, `violet-600`, shadcn `--primary` default, or any other color. If a component you generate doesn't reference this token, the component is wrong.
- Heading typeface: "Geist, system-ui, sans-serif"
- Body/UI typeface: "Geist, system-ui, sans-serif"
- Core component radius family starts at `4px`
- Motion base duration: `400ms`
### Design Direction
**Overall character (context)** Dark-first SaaS with saturated cool accents. **Section rhythm & color hierarchy**
Consistently dark (`#0b0d12` base). Differentiate sections through subtle surface shifts — slightly lighter sub-surfaces (8–12% opacity white overlay), thin border-top lines between sections. Never flip to white mid-page. **Image usage & visual treatment (context)** Minimal imagery — design relies on typography, color, and space. **Typography (context)** Single typeface: "Geist, system-ui, sans-serif" — hierarchy via weight and size contrast. **Color usage (context)** Dark surfaces (`#0b0d12`). **Shape & elevation (context)** Moderate rounding (4px) — contemporary and neutral. **Animation & motion (context)** Base duration: 400ms. **Hero entrance sequence (context)** (in order): 1. **Lottie animation (context)** (undefined, looping, autoplay), file: `anim.json`. Use `<dotlottie-react>` or `lottie-react` with the JSON source. Animation stack: [gsap, lenis, framer-motion]. **Page flow (context)** (1 sections detected — layout may vary) 1. **Interactive components (context)** - **Split content panel**: image/visual left + 3 bullet points right. **Tabbed content — all states (DO NOT collapse into one): (context)** State 1: "SENTINEL Our platform helps teams ship faster than ever before.". **Component language (context)** Buttons: Primary = 6px, `#7c3aed` fill, 14px. **Type scale (context)** H1: 64px/600, tracking: -0.01em.
### Spacing Scale
Base unit: **4px** (97% of values conform)
Scale: `4px` · `8px` · `12px` · `16px` · `24px` · `32px` · `48px` · `64px`
Use multiples of 4px for ALL spacing — padding, gap, margin.
### Layout & Page Structure
- Navigation: floating
- Max content width: 1120px
- 5 split-column section(s) — alternate text/image side
- Scroll animations: IntersectionObserver + fade + translateY(20px)→0
### Responsive Breakpoints
- 480px — custom breakpoint (12 rules)
- 768px — ≈ Tailwind `md:` (70 rules)
- 1024px — ≈ Tailwind `lg:` (52 rules)
Recreate this visual style faithfully. Use the EXACT hex colors, px values, font names, and spacing from the tokens and specifications above.
Source: forge-cli.dev Implementation notes:
- Prefer the extracted color tokens over Tailwind defaults (slate, zinc, neutral, etc.). Override shadcn/ui CSS variables (--primary, --radius, --background) with the values specified above.
- Use the exact px values for border-radius, padding, and font sizes. Use the exact easing functions and durations from Motion Tokens.
- When a value is not specified in this prompt, a sensible default is acceptable.
NOTE: "Geist, system-ui, sans-serif", "Geist Mono, monospace" are custom fonts not available on Google Fonts. Use the closest Google Fonts alternative (e.g. Inter, DM Sans, Space Grotesk for sans-serif; JetBrains Mono, Fira Code for monospace; Playfair Display for serif display) and match the weight/tracking values. Add to globals.css (override shadcn defaults with site tokens):
:root { --background: #0b0d12; --foreground: #9aa4b2; --card: #13151a; --card-foreground: #9aa4b2; --popover: #13151a; --popover-foreground: #9aa4b2; --primary: #7c3aed; --primary-foreground: #ffffff; --secondary: #1f2126; --secondary-foreground: #9aa4b2; --muted: #1a1c21; --muted-foreground: #767676; --accent: #24262b; --accent-foreground: #ffffff; --destructive: #ef4444; --destructive-foreground: #ffffff; --border: rgba(255,255,255,0.08); --input: rgba(255,255,255,0.08); --ring: #7c3aed; --radius: 4px;
}
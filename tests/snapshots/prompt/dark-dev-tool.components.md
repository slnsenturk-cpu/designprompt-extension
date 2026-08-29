Analysis confidence: High
**Use the exact hex colors, px values, and tokens specified in this prompt. Prefer extracted values over framework defaults (shadcn, Tailwind, component library defaults).**
Here is the **Component System** extracted from forge-cli.dev.
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
**Overall character (context)** Dark-first SaaS with saturated cool accents. **Section rhythm & color hierarchy (context)** Consistently dark (`#0b0d12` base). **Image usage & visual treatment (context)** Minimal imagery — design relies on typography, color, and space. **Typography (context)** Single typeface: "Geist, system-ui, sans-serif" — hierarchy via weight and size contrast. **Color usage (context)** Dark surfaces (`#0b0d12`). **Shape & elevation**
Moderate rounding (4px) — contemporary and neutral. Layered shadows — don't simplify to a single layer.
Glassmorphism panels: background rgba(255,255,255,0.03–0.08), backdrop-filter:blur(12–20px), border 1px solid rgba(255,255,255,0.08–0.12). These panels float above the base surface — use them for cards, modals, nav on scroll. The frosted effect is subtle, not milky. **Animation & motion** Base duration: 400ms. Dominant easing: `cubic-bezier(0.16, 1, 0.3, 1)`.
Scroll reveals: blur-in.
Stagger: child elements enter with **60 delay** between each (12 elements). Use `transition-delay` or Framer Motion `staggerChildren: 0.06`. **Hero animation**: Canvas (?×?px) — Likely Rive, Three.js, or custom WebGL. Use animated SVG or Framer Motion morphing paths as fallback. **Hero entrance sequence (context)** (in order): 1. **Lottie animation** (undefined, looping, autoplay), file: `anim.json`. Use `<dotlottie-react>` or `lottie-react` with the JSON source.
Animation stack: [gsap, lenis, framer-motion]. **GSAP scrub** — `gsap.to(el, { y:-100, ease:"none", scrollTrigger:{ trigger:el, start:"top bottom", end:"bottom top", scrub:1 } })` Pinned sections detected — use `pin:true` with ScrollTrigger. **Lenis** — `new Lenis({ duration:1.2, easing:t=>Math.min(1, 1.001-Math.pow(2,-10*t)) })`, sync in RAF loop. **Framer Motion** — `<motion.div initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} transition={{duration:0.5,ease:[0.16,1,0.3,1]}} viewport={{once:true}}>`
Parallax: background moves at different speed than foreground content. Implement via CSS `background-attachment:fixed` or JS `transform:translateZ()` with `perspective`. **Page flow (context)** (1 sections detected — layout may vary) 1. **Interactive components (context)** - **Split content panel**: image/visual left + 3 bullet points right. **Tabbed content — all states (DO NOT collapse into one): (context)** State 1: "SENTINEL Our platform helps teams ship faster than ever before.". **Component language (context)** Buttons: Primary = 6px, `#7c3aed` fill, 14px. **Type scale (context)** H1: 64px/600, tracking: -0.01em.
### Shape Tokens
- `4px` (input / small)
- `6px` (primary button)
- `10px` (component)
- `50%` (pill / large-radius)
### Component Patterns
**Navigation:** Hidden by default. Hamburger menu icon opens full-screen overlay. Logo: "SENTINEL Our platform helps teams ship faster than ever before." fixed top-left.
**Primary button:** `6px` radius, `#7c3aed` bg, text `#ffffff`, height `38px`, padding `10px 18px`, font `14px/500` "Geist, system-ui, sans-serif". Hover: `backgroundColor: #6d28d9`, `boxShadow: 0 0 24px rgba(124,58,237,0.35)`.
 Spec: `background-color: #7c3aed` · `color: #ffffff` · `padding: 10px 18px` · `border-radius: 6px` · `font-size: 14px` · `font-weight: 500` · `font-family: "Geist, system-ui, sans-serif"` · `box-shadow: 0 0 24px rgba(124,58,237,0.35)` · `height: 38px` · `transition: all 120ms ease-out`
 Hover: `backgroundColor: #6d28d9` · `boxShadow: 0 0 24px rgba(124,58,237,0.35)`
 Transition: `all 120ms ease-out`
 Active: `transform: scale(0.98); transition: transform 150ms cubic-bezier(0.4,0,0.2,1)`. `button:active { transform: scale(0.98); }`
**Ghost button:** `6px` radius, transparent bg, border `1px solid #1f2430`, padding `10px 14px`. Hover: bg rgba(255,255,255,0.06).
 Spec: `background-color: transparent` · `border: 1px solid #1f2430` · `color: #9aa4b2` · `padding: 10px 14px` · `border-radius: 6px` · `font-size: 14px` · `font-weight: 500`
**Cards:** backdrop-filter:blur(16px), semi-transparent bg, 4px radius. Padding 24–32px. Hover: `borderColor: #7c3aed`, `transform: translateY(-2px)`.
**Hero:** min-height 80–90dvh, `#0b0d12` background. light text (token foreground). No overlay. Headline: clamp(48px,6vw,80px) in display font. One primary CTA + one ghost, side by side. No cards above the fold.
**Inputs:** `#0b0d12` bg, `1px solid #2a3140`, `6px` radius. Focus: outline 2px solid #7c3aed offset 2px.
**Badges:** radius `4px`, padding `2px 8px`, font `11px/500`, bg `#1f2430`, text `#22d3ee`.
**Global interactive rules:** links → `color: #22d3ee`, no underline; EXCEPTION: Navigation links (nav a, header a) use `color: rgba(154,164,178,0.7)` default, `rgba(154,164,178,1)` on hover. The `#22d3ee` link rule applies to in-content links and CTAs only — NOT nav bar links.
**Noise/grain texture overlay (apply to full page):**
 `position:fixed; inset:0; z-index:2; pointer-events:none`.
 SVG feTurbulence: `type="fractalNoise" baseFrequency="0.65" numOctaves="4"`.
 Overlay fill: white (#ffffff). Opacity: 0.06. `mix-blend-mode: overlay`.
 DO NOT use `baseFrequency` above 0.65 — it creates solid grey, not grain.
 DO NOT use `mix-blend-mode: lighten` on dark backgrounds — it has no visual effect.
Recreate this visual style faithfully. Use the EXACT hex colors, px values, font names, and spacing from the tokens and specifications above.
Source: forge-cli.dev Implementation notes:
- Prefer the extracted color tokens over Tailwind defaults (slate, zinc, neutral, etc.). Override shadcn/ui CSS variables (--primary, --radius, --background) with the values specified above.
- Use the exact px values for border-radius, padding, and font sizes. Use the exact easing functions and durations from Motion Tokens.
- When a value is not specified in this prompt, a sensible default is acceptable.
NOTE: "Geist, system-ui, sans-serif", "Geist Mono, monospace" are custom fonts not available on Google Fonts. Use the closest Google Fonts alternative (e.g. Inter, DM Sans, Space Grotesk for sans-serif; JetBrains Mono, Fira Code for monospace; Playfair Display for serif display) and match the weight/tracking values. Add to globals.css (override shadcn defaults with site tokens):
:root { --background: #0b0d12; --foreground: #9aa4b2; --card: #13151a; --card-foreground: #9aa4b2; --popover: #13151a; --popover-foreground: #9aa4b2; --primary: #7c3aed; --primary-foreground: #ffffff; --secondary: #1f2126; --secondary-foreground: #9aa4b2; --muted: #1a1c21; --muted-foreground: #767676; --accent: #24262b; --accent-foreground: #ffffff; --destructive: #ef4444; --destructive-foreground: #ffffff; --border: rgba(255,255,255,0.08); --input: rgba(255,255,255,0.08); --ring: #7c3aed; --radius: 4px;
}
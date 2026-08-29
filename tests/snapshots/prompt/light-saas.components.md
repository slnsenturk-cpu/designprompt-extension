Analysis confidence: High
**Use the exact hex colors, px values, and tokens specified in this prompt. Prefer extracted values over framework defaults (shadcn, Tailwind, component library defaults).**
Here is the **Component System** extracted from northwind.io.
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
**Overall character (context)** Light base with a strong cool-toned primary action (`#2563eb`). **Section rhythm & color hierarchy (context)** Consistently light throughout (`#ffffff` base). **Image usage & visual treatment (context)** Minimal imagery — design relies on typography, color, and space. **Typography (context)** Single typeface: "Inter, -apple-system, sans-serif" — hierarchy via weight and size contrast. **Color usage (context)** Light surfaces (`#ffffff`). **Shape & elevation**
Pills (9999px) for buttons/badges. Containers: 6px radius. Two distinct registers — never mix.
Brutalist elevation: hard drop-shadows with zero blur (e.g. `4px 4px 0 color`). **Animation & motion**
Motion personality: **snappy** — interactions respond in <200ms. Micro-interactions feel mechanical and precise. Base duration: 150ms. Dominant easing: `cubic-bezier(0.4, 0, 0.2, 1)`.
Scroll reveals: **fade-up** — `opacity:0→1` + `translateY(30px→0)`, IntersectionObserver at `threshold:0.15`. `will-change: transform, opacity`.
Stagger: child elements enter with **80 delay** between each (6 elements). Use `transition-delay` or Framer Motion `staggerChildren: 0.08`. **Hero entrance sequence (context)** (in order): 1. **Page flow (context)** (1 sections detected — layout may vary) 1. **Interactive components (context)** - **Split content panel**: image/visual left + 4 bullet points right + testimonial block. **Tabbed content — all states (DO NOT collapse into one): (context)** State 1: "SENTINEL Our platform helps teams ship faster than ever before.". **Component language (context)** Buttons: Primary = 8px, `#2563eb` fill, 15px, 600 weight. **Type scale (context)** H1: 56px/700, tracking: -0.02em.
### Shape Tokens
- `--radius-md`: 8px
- Interactive elements (buttons, badges): `9999px` (pill)
### Component Patterns
**Navigation:** Sticky, `#ffffff` bg. `border-bottom:1px solid rgba(0,0,0,0.06)`. Logo left, CTA right.
**Primary button:** `8px` radius, `#2563eb` bg, text `#ffffff`, height `44px`, padding `12px 24px`, font `15px/600` "Inter, -apple-system, sans-serif", tracking `normal`. Hover: `backgroundColor: #1d4ed8`, `transform: translateY(-1px)`, `boxShadow: 0 4px 6px -1px rgba(15,23,42,0.1)`.
 Spec: `background-color: #2563eb` · `color: #ffffff` · `padding: 12px 24px` · `border-radius: 8px` · `font-size: 15px` · `font-weight: 600` · `font-family: "Inter, -apple-system, sans-serif"` · `box-shadow: 0 1px 2px 0 rgba(15,23,42,0.05)` · `height: 44px` · `transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1)`
 Hover: `backgroundColor: #1d4ed8` · `transform: translateY(-1px)` · `boxShadow: 0 4px 6px -1px rgba(15,23,42,0.1)` → hover:-translate-y-0.5
 Transition: `all 150ms cubic-bezier(0.4, 0, 0.2, 1)`
 Active: `transform: scale(0.98); transition: transform 150ms cubic-bezier(0.4,0,0.2,1)`. `button:active { transform: scale(0.98); }`
**Ghost button:** `8px` radius, transparent bg, border `1px solid rgba(0,0,0,0.15)`, padding `12px 16px`. Hover: bg rgba(0,0,0,0.04).
 Spec: `background-color: transparent` · `border: 1px solid rgba(0,0,0,0.15)` · `color: #2563eb` · `padding: 12px 16px` · `border-radius: 8px` · `font-size: 15px` · `font-weight: 500`
**Secondary button:** `8px` radius, `#f8fafc` bg, text `#0f172a`, padding `12px 24px`, border `1px solid #e2e8f0`, font `15px/600`
 Spec: `background-color: #f8fafc` · `color: #0f172a` · `padding: 12px 24px` · `border-radius: 8px` · `border: 1px solid #e2e8f0` · `font-size: 15px` · `font-weight: 600`
**Cards:** `#ffffff` bg, layered shadow from tokens. 6px radius. Padding 24–32px. Hover: `boxShadow: 0 20px 25px -5px rgba(15,23,42,0.1)`, `borderColor: #cbd5e1`.
**Hero:** min-height 80–90dvh, `#ffffff` background. dark text (token foreground). No overlay. Headline: clamp(48px,6vw,80px) in display font. One primary CTA + one ghost, side by side. No cards above the fold.
**Inputs:** `#ffffff` bg, `1px solid #cbd5e1`, `8px` radius. Focus: outline 2px solid #2563eb offset 2px.
**Badges:** radius `9999px`, padding `4px 10px`, font `12px/500`, bg `#e2e8f0`, text `#475569`.
**Global interactive rules:** links → `color: #2563eb`, no underline, offset `2px`; `a:hover` → color: #1d4ed8.
**Hover state CSS — implement exactly:**
 `.btn-primary:hover { box-shadow: 0 4px 6px -1px rgba(15,23,42,0.1); }`
Recreate this visual style faithfully. Use the EXACT hex colors, px values, font names, and spacing from the tokens and specifications above.
Source: northwind.io Implementation notes:
- Prefer the extracted color tokens over Tailwind defaults (slate, zinc, neutral, etc.). Override shadcn/ui CSS variables (--primary, --radius, --background) with the values specified above.
- Use the exact px values for border-radius, padding, and font sizes. Use the exact easing functions and durations from Motion Tokens.
- When a value is not specified in this prompt, a sensible default is acceptable.
NOTE: "Inter, -apple-system, sans-serif", "Söhne Mono, monospace" are custom fonts not available on Google Fonts. Use the closest Google Fonts alternative (e.g. Inter, DM Sans, Space Grotesk for sans-serif; JetBrains Mono, Fira Code for monospace; Playfair Display for serif display) and match the weight/tracking values. Add to globals.css (override shadcn defaults with site tokens):
:root { --background: #ffffff; --foreground: #475569; --card: #fafafa; --card-foreground: #475569; --popover: #fafafa; --popover-foreground: #475569; --primary: #2563eb; --primary-foreground: #ffffff; --secondary: #f0f0f0; --secondary-foreground: #475569; --muted: #f5f5f5; --muted-foreground: #6b7280; --accent: #16a34a; --accent-foreground: #ffffff; --destructive: #ef4444; --destructive-foreground: #ffffff; --border: rgba(0,0,0,0.08); --input: rgba(0,0,0,0.08); --ring: #2563eb; --radius: 6px;
}
Analysis confidence: Low
**Use the exact hex colors, px values, and tokens specified in this prompt. Prefer extracted values over framework defaults (shadcn, Tailwind, component library defaults).**
Here is the **Motion System** extracted from tiny.example.
Use as specification for your implementation. Values are measured from the live site — do not substitute with framework defaults.
Source: tiny.example · Page type: web page
## Design Prompt
### Core Spec (Priority)
If any later detail conflicts, this section wins.
### Design Direction
**Overall character (context)** Clean, light-dominant layout. **Section rhythm & color hierarchy (context)** Consistently light throughout (light neutral base). **Image usage & visual treatment (context)** Minimal imagery — design relies on typography, color, and space. **Typography (context)** System font — weight and size contrast only. **Color usage (context)** Neutral palette. **Shape & elevation (context)** Consistent 6–8px radius. **Animation & motion**
Motion: scroll-triggered reveals likely present (animation library not detected — verify with DevTools). Safe default: `opacity:0→1` + `translateY(20px→0)`, 400ms ease-out. **Page flow (context)** (1 sections detected — layout may vary) 1. **Tabbed content — all states (DO NOT collapse into one): (context)** State 1: "SENTINEL Our platform helps teams ship faster than ever before.".
### Interaction Paradigm
- ⚠️ **Reveal: IMMEDIATE — CRITICAL RULE:** ALL content must be visible on page load. `opacity:1`, `transform:none` for every element, always. DO NOT use IntersectionObserver, scroll triggers, GSAP ScrollTrigger, AOS, or any visibility-on-scroll mechanism. DO NOT set `opacity:0` as initial state for any element. DO NOT use Framer Motion `whileInView` or animate-on-scroll props. Any element invisible at load is a broken implementation.
- **Hover feedback:** Minimal — design relies on cursor change and context, not visual transformation.
- **Timing base:** `300ms` `ease` — balanced, professional pacing.
Recreate this visual style faithfully. Use the EXACT hex colors, px values, font names, and spacing from the tokens and specifications above.
Source: tiny.example Implementation notes:
- Prefer the extracted color tokens over Tailwind defaults (slate, zinc, neutral, etc.). Override shadcn/ui CSS variables (--primary, --radius, --background) with the values specified above.
- Use the exact px values for border-radius, padding, and font sizes. Use the exact easing functions and durations from Motion Tokens.
- When a value is not specified in this prompt, a sensible default is acceptable. Add to globals.css (override shadcn defaults with site tokens):
:root { --background: #ffffff; --foreground: #000000; --card: #fafafa; --card-foreground: #000000; --popover: #fafafa; --popover-foreground: #000000; --primary: #000000; --primary-foreground: #ffffff; --secondary: #f0f0f0; --secondary-foreground: #000000; --muted: #f5f5f5; --muted-foreground: #6b7280; --accent: #ebebeb; --accent-foreground: #000000; --destructive: #ef4444; --destructive-foreground: #ffffff; --border: rgba(0,0,0,0.08); --input: rgba(0,0,0,0.08); --ring: #000000; --radius: 0px;
}
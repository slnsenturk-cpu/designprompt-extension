# VibeDesign Landing Page — Lovable Prompt

Paste this into Lovable to generate the landing page:

---

Build a single-page landing page for "VibeDesign" — a Chrome extension that extracts visual design tokens from any website and converts them into ready-to-use prompts for vibe coding tools (v0.dev, Bolt, Lovable, Figma Make).

## Design Style

Inspired by rig.ai but SIMPLER — fewer sections, less visual noise, cleaner spacing. Dark, technical, developer-tool aesthetic.

### Colors
- Background: `#0A0A0B` (near-black)
- Surface/cards: `#111113` (slightly lighter)
- Border: `rgba(255,255,255,0.08)`
- Primary accent: `#3A1DF5` (vivid indigo)
- Accent hover: `#4F35F7`
- Accent glow: `rgba(58,29,245,0.15)` for button glow shadow
- Text primary: `#E8E8ED` (warm off-white)
- Text secondary: `#6B6B76` (muted gray)
- Text tertiary: `#3D3D45`
- Success/green: `#34D399` (for checkmarks, active states)

### Typography
- Headings: "Inter" 700 weight, tight letter-spacing (-0.02em to -0.04em)
- Body: "Inter" 400, 16px, line-height 1.6, color #6B6B76
- Mono/labels: "JetBrains Mono" 400, 12-13px, uppercase, letter-spacing 0.08em, color #6B6B76
- H1: clamp(48px, 6vw, 72px), font-weight 800, color #E8E8ED, letter-spacing -0.03em
- H2: 36-40px, font-weight 700
- H3: 20-24px, font-weight 600

### Shape & Elevation
- Border-radius: 8px for cards, 6px for buttons, 4px for inputs, 9999px for badges
- No box-shadows except primary button glow: `0 0 24px rgba(58,29,245,0.25)`
- Borders: 1px solid rgba(255,255,255,0.06) on cards
- Primary button: bg #3A1DF5, text white, padding 12px 24px, border-radius 6px, font-weight 600, 14px. Hover: bg #4F35F7 + glow expands
- Ghost button: transparent bg, 1px solid rgba(255,255,255,0.15), padding 12px 24px, border-radius 6px. Hover: bg rgba(255,255,255,0.04)

### Layout
- Max-width: 1200px, centered
- Section padding: 120px vertical
- Grid gap: 48px

### Animation
- Scroll reveals: opacity 0 to 1, translateY(20px) to 0, 0.5s ease-out, staggered 0.1s per element
- Button hover: transition all 0.2s ease
- No decorative geometry. No grid patterns. No noise texture. Keep it clean.

---

## Page Sections (build exactly in this order)

### 1. Navigation (sticky)
- Logo left: "⬡ VibeDesign" in Inter 600, 15px
- Right side: ghost links "Features", "How it works", "Pricing" + primary button "Add to Chrome" (links to # for now)
- Background: transparent, transitions to rgba(10,10,11,0.9) + backdrop-filter:blur(12px) on scroll
- Border-bottom: 1px solid rgba(255,255,255,0.06) on scroll

### 2. Hero
- Layout: centered text, no split columns
- Mono label above heading: "CHROME EXTENSION" in JetBrains Mono, 12px, uppercase, #3A1DF5, letter-spacing 0.1em
- H1: "Extract any website's design. Get a perfect prompt."
- Subtitle (16px, #6B6B76, max-width 560px, centered): "VibeDesign analyzes colors, typography, spacing, components, and animations from any website — then generates a ready-to-paste prompt for v0, Bolt, Lovable, or Figma Make."
- Two buttons centered: "Add to Chrome — It's Free" (primary with glow) + "Watch Demo" (ghost)
- Below buttons: small text "Works with any website. No API key required for basic analysis." in #3D3D45, 13px

### 3. Trusted By / Logo Strip
- Mono label: "WORKS WITH" in 11px, #3D3D45, centered
- Horizontal row of platform logos (text-only, no images): "v0.dev", "Bolt.new", "Lovable.dev", "Figma Make", "Cursor", "Windsurf"
- Each in JetBrains Mono, 13px, #3D3D45, separated by a dot "·"
- No animation, static

### 4. How It Works (3 steps)
- H2: "Three clicks to a perfect prompt"
- 3-column grid on desktop, stacked on mobile
- Each step card: #111113 bg, 1px border rgba(255,255,255,0.06), border-radius 8px, padding 32px
  - Step number: "01" / "02" / "03" in JetBrains Mono, 48px, font-weight 700, color #3A1DF5
  - Step title (H3): "Browse any site" / "Click Analyze" / "Copy & Paste"
  - Step description (14px, #6B6B76):
    - "Navigate to any website whose design you love. VibeDesign works on any site — SaaS, portfolio, e-commerce, anything."
    - "Open the side panel and click Analyze. VibeDesign extracts colors, fonts, spacing, shadows, animations, and component patterns in seconds."
    - "Copy the generated prompt and paste it into v0.dev, Bolt, Lovable, or Figma Make. The output matches the original site's visual identity."

### 5. Features Grid
- H2: "Everything you need to capture design DNA"
- Mono label above: "CAPABILITIES"
- 2x3 grid on desktop
- Each feature card: #111113 bg, 1px border, 8px radius, padding 28px
  - Small icon area: a single emoji or unicode char in 20px, color #3A1DF5 (no SVG icons)
  - Title (H3, 16px, 600): feature name
  - Description (14px, #6B6B76): 2 lines max

Features:
1. ◫ "Page Analysis" — "Extracts complete design tokens from any page: colors, fonts, spacing, shadows, border-radius, animations, and layout patterns."
2. ⊡ "Element Picker" — "Click any UI element to capture its exact styles — buttons, cards, inputs, navbars. Side panel stays open during selection."
3. ⬚ "Image Analysis" — "Select any image to extract its color palette, mood, contrast, and visual style for prompt generation."
4. ⎘ "One-Click Copy" — "Generated prompts copy to clipboard instantly. Quick-launch buttons open v0.dev, Bolt, or Lovable with your prompt ready."
5. ◈ "AI-Enhanced" — "Optional AI direction via Gemini, Claude, or OpenAI transforms raw tokens into nuanced design direction prose."
6. ◷ "Prompt History" — "Auto-saves prompts per domain. Restore previous analyses instantly when you revisit a site."

### 6. Before / After comparison
- H2: "From inspiration to implementation"
- Two side-by-side panels (split layout)
- Left panel: "BEFORE" label in mono, #6B6B76
  - Dark card with monospace text showing a bad/vague prompt: "Make it look like that SaaS site I saw. Use dark mode. Make it modern. Add some shadows."
  - Style: #111113 bg, 13px JetBrains Mono, #6B6B76 text, red strike-through styling
- Right panel: "AFTER — WITH VIBEDESIGN" label in mono, #3A1DF5
  - Dark card with monospace text showing a detailed prompt excerpt:
    ```
    Background: #0F172A
    Primary: #6366F1
    Font: "Inter" 800, 64px/-0.03em
    Button: 9999px, padding 12px 28px
    Shadow: 0 0 20px rgba(99,102,241,0.3)
    Section padding: 96px
    Nav: sticky, backdrop-filter:blur(12px)
    ```
  - Style: #111113 bg, 13px JetBrains Mono, #34D399 text (green = good), subtle #3A1DF5 left border (4px)

### 7. CTA Section
- Full-width section, slightly lighter bg: #111113
- H2: "Start extracting design tokens today"
- Subtitle: "Free to use. No account required. Add to Chrome in one click."
- Single centered primary button: "Add to Chrome — Free" with glow
- Below: "Chrome Web Store" text link in #3D3D45

### 8. Footer
- Background: #0A0A0B, border-top: 1px solid rgba(255,255,255,0.06)
- Padding: 48px vertical
- Left: "⬡ VibeDesign" logo + "© 2025" in #3D3D45
- Right: links in #6B6B76: "Privacy Policy" · "GitHub" · "Chrome Web Store"
- All in 13px Inter

---

## Important Implementation Notes
- Use Google Fonts: @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
- Mobile responsive: stack grids, reduce H1 to 36px, sections to 80px padding
- Add smooth scroll behavior: html { scroll-behavior: smooth }
- Navigation links should scroll to sections via anchor IDs
- Keep it SIMPLE — no complex animations, no parallax, no 3D, no decorative geometry
- Total page should be about 6-7 screen heights maximum

# VibeDesign

A Chrome extension that extracts visual design tokens from any website and generates AI-ready design prompts for vibe coding tools.

**[Install from Chrome Web Store](https://chromewebstore.google.com/detail/vibedesign/peajencpkpgmidiooahoibfbhbjboobl)**

---

## How to Use

### 1. Analyze a Page
- Navigate to any website
- Click the VibeDesign icon in the Chrome toolbar, or open the side panel
- Select your **target platform** (v0.dev, Bolt, Lovable, Figma Make, or General)
- Select a **focus** (All, Colors, Typography, Shadow, Motion, Layout, or Components)
- Click **Analyze Page**

### 2. Use the Prompt
- Click **Copy** to copy to clipboard
- Or use the **v0.dev / Bolt / Lovable** shortcut buttons — they copy and open the platform in a new tab

### 3. Optional: AI-Enhanced Direction
- Click the ⚙ settings icon
- Enter your API key (Gemini, Claude, or OpenAI)
- Keys are stored locally in `chrome.storage.local` and never transmitted to us
- Works perfectly without an API key — the built-in rule engine covers all design patterns

---

## Supported Platforms
- **v0.dev** — React + Tailwind + shadcn/ui
- **Bolt.new** — Full-stack Vite + React
- **Lovable** — React + Supabase
- **Figma Make** — Component-level design
- **General** — Any AI code tool

---

## What Gets Extracted
- Colors, CSS variables, gradients
- Typography: fonts, weights, sizes, line heights
- Shadows, border radii, shape language
- Transitions and animations
- Hover states
- Section layout and content map
- Component patterns: buttons, inputs, nav, cards

---

## Privacy
- Zero data collection, zero tracking, zero analytics
- API keys stored locally, never sent to our servers
- All processing happens in your browser
- Select "None" as AI provider for zero network requests

See [PRIVACY.md](./PRIVACY.md) for the full privacy policy.

---

## Technical Notes
- Manifest V3 Chrome Extension
- Content script is injected only when you click Analyze Page
- Cross-origin iframe content cannot be scanned (browser security constraint)
- For SPAs with dynamic styles, wait for the page to fully load before analyzing
- Scroll-reveal sites (Framer, Webflow, AOS) are supported — the extension auto-scrolls to trigger animations before extracting

---

## Troubleshooting

**"Could not retrieve page data"**
→ Refresh the page and try again. Does not work on `chrome://` pages.

**API key error**
→ Click ⚙, verify your key and selected provider.

**Empty or weak prompt**
→ The page may not use CSS custom properties. Try changing the Focus chip.

---

## Links
- [Chrome Web Store](https://chromewebstore.google.com/detail/vibedesign/peajencpkpgmidiooahoibfbhbjboobl)
- [Privacy Policy](./PRIVACY.md)
- [Issues & Feedback](https://github.com/slnsenturk-cpu/designprompt-extension/issues)

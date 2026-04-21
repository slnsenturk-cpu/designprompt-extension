# VibeDesign

A Chrome extension that extracts visual design tokens from any website and generates AI-ready design prompts for vibe coding tools.

**[Install from Chrome Web Store](https://chrome.google.com/webstore/detail/<your-extension-id>)**

## How to Use

### 1. Analyze a Page
- Navigate to any website
- Click the VibeDesign icon in the Chrome toolbar, or open the side panel
- Select your target platform (v0.dev, Bolt, Lovable, Figma Make, or General)
- Select a focus (All, Colors, Typography, Shadow, Motion, Layout, or Components)
- Click **Analyze Page**

### 2. Use the Prompt
- Click **Copy** to copy to clipboard
- Or use the v0.dev / Bolt / Lovable shortcut buttons — they copy and open the platform in a new tab

### 3. Optional: AI-Enhanced Direction
- Click the ⚙ settings icon
- Enter your API key (Gemini, Claude, or OpenAI)
- Keys are stored locally in `chrome.storage.local` and never transmitted to us
- Works perfectly without an API key — the built-in rule engine covers all design patterns

### 4. Optional: Create a Free Account (New in v2.0)
- Click the **Sign in to sync** pill in the side panel, or open [vibedesign.tech](https://vibedesign.tech) to register
- Signed-in users get:
  - Unlimited prompts (anonymous mode is capped at 5 prompts per month)
  - Cloud-synced analysis and prompt history across devices
  - Dashboard at [vibedesign.tech/dashboard](https://vibedesign.tech/dashboard) to view, manage, or delete history
- Anonymous mode works fully without an account — nothing is gated behind sign-in except cross-device sync and the monthly cap

## Supported Platforms
- **v0.dev** — React + Tailwind + shadcn/ui
- **Bolt.new** — Full-stack Vite + React
- **Lovable** — React + Supabase
- **Figma Make** — Component-level design
- **General** — Any AI code tool

## What Gets Extracted
- Colors, CSS variables, gradients
- Typography: fonts, weights, sizes, line heights
- Shadows, border radii, shape language
- Transitions and animations
- Hover states
- Section layout and content map
- Component patterns: buttons, inputs, nav, cards

## Privacy

VibeDesign is built around two modes:

### Anonymous mode (default)
- No account, no tracking, no analytics
- API keys stored locally in `chrome.storage.local`, never sent to our servers
- All design analysis happens in your browser
- Select "None" as AI provider for zero outbound AI requests
- Monthly limit: 5 prompts per calendar month (UTC), counter lives in local storage

### Signed-in mode (opt-in)
When you create a free account and sign in:
- Email, display name (if provided), and password hash are stored on Supabase (our backend auth provider, via Lovable Cloud)
- URLs of sites you analyze, extracted design tokens, and generated prompts are synced to your account
- You can view, delete, or bulk-clear all synced data from the dashboard at any time
- Your AI provider API keys stay local regardless of sign-in status — we never have access to them
- Anonymous mode keeps working; sign-in adds cross-device sync and removes the monthly cap

### What we never collect (in either mode)
- Your AI provider API keys (they stay in your browser)
- Page content of sites you visit (we read CSS styles and DOM structure for design tokens, not article text or form inputs)
- Your browsing history outside of sites you explicitly analyze
- Chrome profile, Google account, or browser identity beyond what you provide during sign-up

Full privacy policy: [vibedesign.tech/privacy](https://vibedesign.tech/privacy)

## Technical Notes
- Manifest V3 Chrome Extension
- Content script is injected only when you click **Analyze Page**
- Authentication uses `chrome.identity.launchWebAuthFlow` for the optional OAuth flow — only invoked when the user clicks "Sign in"
- Session tokens are refreshed every 50 minutes via `chrome.alarms` while the user is signed in
- Cross-origin iframe content cannot be scanned (browser security constraint)
- For SPAs with dynamic styles, wait for the page to fully load before analyzing
- Scroll-reveal sites (Framer, Webflow, AOS) are supported — the extension auto-scrolls to trigger animations before extracting

## Troubleshooting

- **"Could not retrieve page data"** → Refresh the page and try again. Does not work on `chrome://` pages.
- **API key error** → Click ⚙, verify your key and selected provider.
- **Empty or weak prompt** → The page may not use CSS custom properties. Try changing the Focus chip.
- **"Monthly limit reached" in anonymous mode** → You've used all 5 free prompts this month. Sign in with a free account for unlimited, or wait for the 1st of next month.
- **Sign-in window closes without completing** → Clear site data for `vibedesign.tech` (Chrome settings → Privacy → Site settings) and try again.

## Links
- [Chrome Web Store](https://chromewebstore.google.com/detail/vibedesign/peajencpkpgmidiooahoibfbhbjboobl)
- [Privacy Policy](./PRIVACY.md)
- [Issues & Feedback](https://github.com/slnsenturk-cpu/designprompt-extension/issues)

# Privacy Policy — VibeDesign

**Last updated:** April 24, 2026

## Overview

VibeDesign is a Chrome extension that extracts visual design tokens from websites and generates AI-ready design prompts. It operates in two modes: **anonymous** (default, fully local) and **authenticated** (opt-in, enables cross-device sync via our Supabase backend). This policy describes what data is collected in each mode.

## Anonymous mode (default)

When you install the extension and do not sign in:

- All processing happens locally in your browser.
- Extracted design tokens, generated prompts, and your preferences are stored only in `chrome.storage.local` on your device.
- No data is transmitted to our servers.
- If you choose to use an AI provider (Gemini / Claude / OpenAI) with your own API key, the extracted design tokens are sent directly from your browser to the provider you selected, using your key. We do not proxy, intercept, or log these requests.
- A local usage counter tracks 5 free prompts per calendar month (stored in `chrome.storage.local` as `usage_meter`). The counter tracks the device; it is never transmitted.

## Authenticated mode (opt-in)

If you choose to sign in (click "Sign in to sync" in the sidepanel):

- We collect and store on our Supabase backend:
  - Your email address and an auto-generated user ID
  - Each analysis you run (URL, hostname, extracted design tokens, primary color, page title, page background, extraction version, timestamp)
  - Each prompt you generate (prompt text, target platform, focus, AI provider used, timestamp)
- An authentication session token is stored locally in `chrome.storage.local` so you remain signed in between sidepanel opens. The token is refreshed periodically in the background.
- This data is used solely to enable cross-device history via the dashboard at `https://vibedesign.tech/dashboard`. It is never sold, shared with third parties, or used for advertising, profiling, or any purpose other than delivering the cross-device sync feature.

## What the extension accesses on the page

When you click "Analyze Page", the extension reads the following from the active webpage using standard browser APIs:

- CSS computed styles (colors, fonts, shadows, spacing, animations)
- CSS custom properties (variables)
- DOM structure for layout analysis
- Typography and component patterns

It does **not** read form inputs, cookies, authenticated page content, or any personal data typed into the page.

## Third-party services

- **Supabase** (`*.supabase.co`) — our authentication and database backend for authenticated users only. Privacy policy: https://supabase.com/privacy
- **AI providers** (Gemini / Claude / OpenAI) — called directly from your browser with your own API key when you opt into AI-enhanced direction. Each provider has its own privacy policy.
- **Chrome Identity API** — used only to capture the OAuth callback when you sign in. No identity data is persisted outside of the Supabase session described above.

## Analytics and tracking

We do not use Google Analytics, Mixpanel, Segment, telemetry, or any tracking scripts. No usage data leaves your device beyond what is explicitly described in "Authenticated mode" above.

## Data retention and deletion

- **Anonymous users:** all data stays on your device. Uninstalling the extension clears it.
- **Authenticated users:** your email, analyses, and prompts remain in our Supabase database until you delete them. You can delete individual analyses from the dashboard or the extension's history panel. To delete your entire account and all associated data, email support@vibedesign.tech with the subject "Account deletion" from the email address linked to your account.

## Changes to this policy

We may update this privacy policy from time to time. Material changes affecting what we collect or how we use it will be announced in the extension's sidepanel. The "Last updated" date above always reflects the current version.

## Contact

Questions or requests related to your data:

- Email: support@vibedesign.tech
- GitHub: https://github.com/slnsenturk-cpu/designprompt-extension/issues

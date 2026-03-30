# Privacy Policy — VibeDesign

**Last updated:** March 30, 2026

## Overview

VibeDesign is a Chrome extension that extracts visual design tokens from websites and generates AI-ready design prompts. We are committed to protecting your privacy.

## Data Collection

VibeDesign does **not** collect, store, or transmit any personal data. Specifically:

- **No analytics or tracking** — We do not use Google Analytics, telemetry, or any tracking scripts.
- **No user accounts** — The extension does not require sign-up or login.
- **No data transmission to our servers** — We do not operate any servers. All processing happens locally in your browser.

## What the Extension Accesses

When you click "Analyze Page", the extension reads the following from the active webpage:

- CSS computed styles (colors, fonts, shadows, spacing, animations)
- CSS custom properties (variables)
- DOM structure for layout analysis
- Typography and component patterns

This data is processed entirely within your browser and is never sent to external servers controlled by us.

## Local Storage

The extension uses `chrome.storage.local` to store:

- Your selected AI provider preference (Gemini, Claude, OpenAI, or None)
- Your selected model preference
- API keys you provide (stored locally, never transmitted to us)
- Prompt history (up to 30 domains, stored locally)

All stored data remains on your device and can be cleared by uninstalling the extension.

## Optional AI API Calls

If you choose to use an AI provider (Gemini, Claude, or OpenAI), the extension sends extracted design token data directly to the selected provider's API using your own API key. These requests go directly from your browser to the AI provider — we do not proxy, intercept, or log these requests. Please refer to each provider's privacy policy for their data handling practices.

## Third-Party Services

The extension does not integrate with any third-party services beyond the optional AI APIs mentioned above.

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be reflected in the "Last updated" date above.

## Contact

If you have questions about this privacy policy, please open an issue on our GitHub repository: https://github.com/slnsenturk-cpu/designprompt-extension/issues

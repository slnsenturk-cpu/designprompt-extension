# Privacy Policy — DesignPrompt (Vibe Inspector)

**Last updated:** March 30, 2026

## Summary

DesignPrompt does not collect, transmit, or store any personal data. All processing happens locally in your browser.

## Data Collection

**We do not collect any data.** Specifically:

- No analytics or tracking scripts
- No user accounts or registration
- No cookies (beyond Chrome's built-in extension storage)
- No telemetry or usage metrics
- No data sent to our servers (we have none)

## API Keys

If you choose to use AI-enhanced analysis (Gemini, Claude, or OpenAI), you provide your own API key. These keys are:

- Stored locally in `chrome.storage.local` on your device only
- Sent directly from your browser to the respective AI provider (Google, Anthropic, or OpenAI)
- Never transmitted to any third-party server, intermediary, or our infrastructure
- Never logged, collected, or accessible by us

You can delete your stored API keys at any time from the extension settings.

## Website Analysis

When you analyze a website, the extension:

- Reads CSS properties, colors, fonts, shadows, and layout data from the current page's DOM
- Processes this data entirely within your browser
- Does not capture screenshots, personal content, form data, passwords, or cookies from visited sites
- Does not transmit any extracted design data to external servers (unless you explicitly use an AI provider, in which case only design tokens — not page content — are sent to that provider's API)

## Prompt History

Analyzed prompts are saved locally in `chrome.storage.local` (up to 30 domains). This data:

- Never leaves your browser
- Can be cleared from the extension's history panel
- Is deleted when you uninstall the extension

## Permissions Explained

| Permission | Why it's needed |
|---|---|
| `activeTab` | To read CSS properties from the page you're currently viewing |
| `scripting` | To inject the content script that extracts design tokens from the DOM |
| `storage` | To save your settings, API keys, and prompt history locally |
| `tabs` | To detect the current page URL for history and side panel functionality |
| `sidePanel` | To open the extension in Chrome's side panel |
| `host_permissions: <all_urls>` | To analyze design tokens on any website you visit |

## Third-Party Services

The extension communicates with third-party services **only when you explicitly configure and use an AI provider**:

- **Google Gemini API** (`generativelanguage.googleapis.com`) — subject to [Google's Privacy Policy](https://policies.google.com/privacy)
- **Anthropic Claude API** (`api.anthropic.com`) — subject to [Anthropic's Privacy Policy](https://www.anthropic.com/privacy)
- **OpenAI API** (`api.openai.com`) — subject to [OpenAI's Privacy Policy](https://openai.com/privacy)

If you select "None" as your AI provider, the extension makes zero network requests.

## Changes

If this policy changes, the updated version will be posted at this URL. The extension does not auto-update policies — check this page if you have concerns.

## Contact

For questions about this privacy policy, open an issue on the GitHub repository.

# Privacy Policy

**Effective date:** April 21, 2026

This privacy policy describes how VibeDesign ("the extension," "we") handles your information.

## What we collect

**Anonymous use (no account):**

- API keys (Claude, Gemini, or OpenAI) — stored locally in your browser only
- Design extraction cache (colors, fonts, prompts) — stored locally in your browser only
- Usage counter (number of prompts generated this month) — stored locally in your browser only

**Signed-in use (optional free account):**

When you create an account, we additionally collect and store on our servers:

- Email address
- Display name (if provided)
- Password (hashed, never stored in plain text)
- URLs of websites you analyze
- Design tokens extracted from those sites
- Generated prompts
- Timestamps of your analyses

## What we never collect

- Your API keys (these stay in your browser)
- Page content of sites you visit (we read DOM structure and CSS styles for token extraction, but not article text, form inputs, or personal data on the page)
- Your browsing history outside of the sites you explicitly analyze
- Any data from sites you have not chosen to analyze
- Chrome profile, Google account, or browser identity information beyond the email you provide during sign-up

## How we use your data

- Account data (email, password hash): to authenticate your sign-in sessions
- Analysis history (URLs, tokens, prompts): to display your history on the dashboard and enable cross-device sync
- We do not use your data for advertising, profiling, behavioral tracking, or resale

## Third parties

- **Supabase (via Lovable Cloud):** Our authentication and database provider. Your account data and analysis history are stored on Supabase's infrastructure. Supabase acts as a data processor on our behalf.
- **AI providers (Anthropic, Google, OpenAI):** When you generate prompts, your extracted design tokens are sent to the AI provider you selected, using your own API key. We do not intermediate or log these requests. Data handling by the AI provider is subject to their own policies.

## Data retention

- **Anonymous users:** No data is retained on our servers.
- **Signed-in users:** Your account and history are retained until you delete them. You can delete individual analyses or clear your entire history at any time from the dashboard at vibedesign.tech/dashboard.

## Your rights (GDPR and similar regulations)

If you are in the European Economic Area, United Kingdom, or other jurisdictions with similar protections, you have the right to:

- Access the personal data we hold about you
- Correct inaccurate data
- Delete your data ("right to erasure")
- Export your data in a machine-readable format
- Object to processing

To exercise these rights, email us at selen@ourway.design or use the delete controls in your dashboard. Account deletion removes all associated analyses, prompts, and profile data from our servers.

## Security

- Passwords are hashed using industry-standard algorithms before storage (handled by Supabase)
- All network traffic between the extension, our dashboard, and Supabase uses HTTPS
- Row-level security policies ensure you can only access your own data on our servers

## Changes to this policy

We will update this policy if our data practices change. Material changes will be announced on vibedesign.tech and in the extension's store listing notes. The effective date at the top of this page reflects the latest version.

## Contact

Questions or data requests: selen@ourway.design

VibeDesign by Selen Şentürk  
Istanbul, Turkey

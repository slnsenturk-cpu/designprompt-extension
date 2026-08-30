# VibeDesign

Extract any website's design system into files an AI coding agent can actually
use: a **DESIGN.md** style guide, a **Skill** bundle, or **design tokens**.

Point it at a page, press Analyze, and read what it found — colour roles, the
type scale, spacing, components, motion, contrast — then export it in the shape
your tool wants.

**[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/vibedesign/peajencpkpgmidiooahoibfbhbjboobl)**

---

## What you get

Three outputs from the same analysis. They are three formats of one design
model, so a colour reads the same in all of them.

| Output | What it is | Where it goes |
| --- | --- | --- |
| **Prompt** | A written brief, tuned to the tool you pick | Paste into the chat |
| **DESIGN.md** | A style guide your project keeps: roles, scale, components, motion, accessibility | Your assistant's instructions file, or the repo root |
| **Skill** | A zip an agent can be pointed at — DESIGN.md, DTCG `tokens.json`, `variables.css`, `theme.css`, Tailwind v3 config and v4 `@theme` | Your assistant's skills directory, or the repo root |

The panel names the exact path for each supported tool when you pick an output;
that list lives in the product rather than in this file, so it stays correct as
tools come and go.

## How it works

1. Open the side panel on any page and press **Analyze page**.
2. Read the summary — counts, palette, and a Snapshot of theme, type, shape
   and motion. The category tabs hold the full lists.
3. Pick an output in **Export** and copy or download it.

Nothing is invented. Every value is measured from the rendered page, and a
value that was not observed is left out rather than filled in with a plausible
default. Where the extension suggests something — an open-licence substitute
for a proprietary typeface, say — it is labelled *suggested, not observed*.

## What it costs

Free. Five analyses a month signed out; a free account makes it unlimited.
There is no paid tier and no payment of any kind today.

The optional **AI enhancement** pass, which improves the prompt's direction
paragraph, uses *your* API key with Claude, OpenAI or Gemini. That key stays in
this browser. Without it the extension still works — the rule engine produces
the same structured output, just without the written direction.

## Privacy

VibeDesign asks for access to a site **when you analyze it**, one origin at a
time, so installing it does not grant access to every website you visit. See
[PRIVACY.md](PRIVACY.md).

## Development

No build step. Every file is a plain `<script>`, `importScripts`, or
`chrome.scripting.executeScript` target that publishes a `VD_*` global.

```bash
npm install                       # test tooling only; the extension ships no dependencies
node --test tests/*.test.js       # the full suite
./scripts/verify.sh               # everything that must hold before a release
./scripts/package.sh              # → dist/vibedesign-<version>.zip
```

Read [docs/AUDIT-v3.md](docs/AUDIT-v3.md) for the module map and
[docs/SIDEPANEL-IA.md](docs/SIDEPANEL-IA.md) for the panel's information
architecture. [CLAUDE.md](CLAUDE.md) carries the working rules for this repo.

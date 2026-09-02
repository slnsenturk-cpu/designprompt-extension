# Chrome Web Store listing — VibeDesign 3.0.2

Everything the store form asks for. Character limits are Chrome's; the counts
in brackets are what the text below actually uses.

---

## Name  (limit 75)

```
VibeDesign — DESIGN.md & Design Tokens for AI Coding Agents
```
[59 characters]

## Short description  (limit 132)

```
Extract any website's design system into DESIGN.md, agent Skills and design tokens for AI coding tools.
```
[103 characters — this is also `description` in manifest.json, and the two must stay identical]

## Category

Developer Tools

---

## Full description

```
Point VibeDesign at any website and it reads the design out of the rendered
page — colour roles, the type scale, spacing, radii, shadows, components,
motion, contrast — then hands it to you in the shape your tool actually wants.

WHAT YOU GET

Three outputs from one analysis. They are three formats of the same design
model, so a colour reads identically in all of them.

• Prompt — a written brief for a chat tool, tuned to the target you pick.
• DESIGN.md — a style guide your project keeps: colour roles, type scale,
  spacing, component measurements, motion, accessibility notes.
• Skill — a zip a coding agent can be pointed at, containing DESIGN.md, DTCG
  tokens.json, variables.css, theme.css, a Tailwind v3 config and a Tailwind
  v4 @theme file.

WHERE THE FILES GO

Each output tells you where it belongs. The Skill bundle names the right
location for whichever assistant or editor you use — a rules directory, a
project instructions file, or the repo root — and the panel shows the same
list before you download.

NOTHING IS INVENTED

Every value is measured from the page as rendered. A value that was not
observed is left out rather than filled in with a plausible default, and the
document says so. Where VibeDesign suggests something — an openly-licensed
substitute for a proprietary typeface — it is labelled "suggested, not
observed", so you always know which is which.

WHAT IT COSTS

Free. Five analyses a month without an account; unlimited with a free account.
There is no paid tier and no payment of any kind.

The optional AI enhancement pass improves the prompt's written direction using
YOUR API key with Claude, OpenAI or Gemini. That key never leaves your browser.
Without it everything still works — the rule engine produces the same
structured output.

PRIVACY

VibeDesign is installed with access to no websites at all. When you press
Analyze, Chrome asks about that one site, and it reads the page only then. You
can revoke any site at any time, and there is a single "Allow on all sites"
toggle if you would rather grant it once.

It reads structure and computed styles — never article text, form contents or
anything you have typed. Full policy: https://vibedesign.tech/privacy
```

---

## Screenshots  (1280×800, five of them)

1. **Overview after an analysis, on a striking site.**
   Caption: *Read what it found before you export it — counts, palette, and a
   snapshot of theme, type, shape and motion.*

2. **The Export card with Skill selected, "Where to put it" open.**
   Caption: *Three outputs from one analysis. The bundle tells you which file
   it belongs in for thirteen tools.*

3. **The Colors tab, full role list with the contrast section visible.**
   Caption: *Every colour role with the contrast it achieves — measured, and
   graded against WCAG.*

4. **A DESIGN.md open in an editor beside the panel it came from.**
   Caption: *A style guide your project keeps, not a prompt you paste once.*

5. **The per-site permission prompt, mid-Analyze.**
   Caption: *Installed with access to nothing. It asks for one site, when you
   ask it to read one.*

---

## Keywords

Describe what the extension does, not which products it sits next to. A list of
third-party tool names is what got 3.0.0 rejected for keyword stuffing, and it
reads as stuffing wherever it appears — including here.

```
design tokens, design system, style guide, design to code, agent skills,
DTCG tokens, Tailwind theme, colour palette extractor, typography scale,
CSS custom properties, AI coding assistant
```

## Support

Support email: **selen@ourway.design**
Support site: https://vibedesign.tech
Privacy policy: https://vibedesign.tech/privacy

---

## What's new in 3.0

```
3.0 turns VibeDesign from a prompt generator into a design-system exporter.

NEW — DESIGN.md. A style guide your project keeps: colour roles, type scale,
spacing, component measurements, motion and accessibility notes, in a form a
coding agent can follow.

NEW — Skill bundles. One zip holding DESIGN.md, DTCG tokens.json,
variables.css, theme.css, a Tailwind v3 config and a Tailwind v4 @theme file.
Point your coding assistant at it.

NEW — a rebuilt side panel. A tab for each part of the design instead of one
long scroll, with the summary, palette and export where you land, and settings
behind their own tab.

CHANGED — permissions. VibeDesign no longer asks for access to every website
when you install it. It asks about one site when you analyze it, and Settings
has a single toggle if you prefer to grant them all at once.

CHANGED — font licensing is now reported properly. Self-hosting a typeface
says nothing about its licence, and 3.0 stops conflating the two: families are
checked by name against the Google Fonts catalogue, and anything not found
there reads "licence unknown" rather than "proprietary".

NEW — shared sign-in. Signing in on vibedesign.tech signs the extension in
too, and signing out of either ends both. The two keep separate sessions,
linked by a one-time handoff, so neither can knock the other offline.

FIXED — a spent session token could be retried indefinitely, leaving the panel
reporting a refresh failure it could never recover from. A rejected session is
now cleared once, with a Sign in button.
```

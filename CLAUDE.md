# CLAUDE.md

Project guidance for Claude Code working in this repository.

VibeDesign is a Manifest V3 Chrome extension. No build step: every file is a
plain `<script>`, `importScripts`, or `chrome.scripting.executeScript` target
that publishes a `VD_*` global. See `docs/AUDIT-v3.md` for the module map,
token shape, and permissions review.

## Working rules

**Security and safety work must show its evidence.** For anything touching
hooks, key handling, permissions, or entitlements, never report "done" without
including the verification command and its actual output in the same message.
A claim without output is not a result.

- Show the command and the output you actually got, not a description of it.
- Prove a guard by making it fire. A test that has never failed has not been
  shown to work: break the thing it guards, show it catch the break, restore,
  and show it green again.
- If a step was skipped, partially done, or done differently than asked, say so
  **first** — before the parts that succeeded.
- "Tests pass" means the run in this message. If the tree changed after the
  last run, run it again.

**One edit, one assertion.** Do not batch several string replacements into a
single script with one trailing `assert s != orig`. That assert passes when
*any* replacement matched, so a replacement whose target has drifted fails
silently and the file is left half-patched — which has produced wrong output in
this repo more than once.

- Make one targeted edit per replacement, each with its own check, or use the
  editor's targeted edit tool, which fails loudly on a missed match.
- Re-read the file after editing before making a further edit that depends on
  the surrounding lines.
- When a patch reports success but the behaviour does not change, suspect a
  silently-missed replacement before suspecting the logic.

The relevant commands for this repo:

```bash
node --test tests/*.test.js
git config --get core.hooksPath          # must print scripts/hooks
```

The full set — key scan, Supabase anon-key check, refresh-path scan, dev-button
gating — is in `docs/RELEASE-CHECKLIST.md`.

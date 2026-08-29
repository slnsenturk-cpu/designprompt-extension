# Test fixtures

Each `*.json` here is a captured **token bundle** — the object `content.js`
returns from `extractPageTokens()` for one page. `tests/design-md-builder.test.js`
feeds them to the DESIGN.md builder and asserts on the result.

| Fixture | Represents |
|---|---|
| `light-saas.json` | Light marketing/SaaS page: full palette, 4-step type scale, drop shadows, 4 breakpoints, dark-mode overrides |
| `dark-dev-tool.json` | Dark developer tool: glow shadows, 4px spacing base, GSAP/Lenis motion, Lottie, pinned scroll sections |
| `sparse.json` | Near-empty extraction — the degenerate case where almost nothing was detected |
| `SENTINEL.txt` | The sentinel sentence (see below) |

## The sentinel

Every fixture plants the sentence in `SENTINEL.txt` into **every copy-bearing
field**: `navPattern.logoText`, `navPattern.navLinks`, `buttonStyles.*.text`,
`interactiveStates[].heading`, `sectionContentMap`, `footerContentMap`,
`fixedUIChrome[].text`, `stickySections.scrollBlockHeadings`,
`caseGridPattern.tagLabels`, and `title`.

A DESIGN.md describes *visual style*, never a site's words. The test suite
fails if that sentence appears anywhere in the output, in either tier. When you
add a fixture, plant the sentinel in its copy fields too — otherwise the leak
test passes vacuously for it, and the suite explicitly checks that the sentinel
is present in the fixture for exactly this reason.

## Capturing a fixture from a real site

You need an **unpacked** build — the dev buttons are hidden in Web Store builds
(they key off `chrome.runtime.getManifest().update_url` being undefined).

1. Go to `chrome://extensions`, enable **Developer mode**, click **Load unpacked**
   and select this repository's root folder.
2. Open the site you want to capture and open the VibeDesign side panel.
3. Click **Analyze Page** and wait for the prompt to appear.
4. Open **Settings** (the ⚙ icon). At the bottom, under **Developer**, click
   **Copy RAW capture**. The button flashes the copied size. That section only
   renders in an unpacked build.

   > This is *not* the **JSON** button in the result header. That one exports the
   > W3C design-token format, which has already collapsed the palette into nine
   > semantic roles and dropped `colorUsage`, `cssVars`, `hoverStates`,
   > `buttonStyles`, `sectionContentMap` and `visualProfile`. The builder cannot
   > read it.
5. Paste into a new file:

```bash
pbpaste > tests/fixtures/my-site.json
```

6. Open the file and replace any copy — headings, link text, button labels,
   taglines — with the sentinel string from `SENTINEL.txt`. This both protects
   the real site's content and makes the leak test meaningful.

Keep fixtures under ~15 KB. Trim `sectionContentMap`, `footerContentMap` and
`assets` down to one or two entries; the builder never reads them, so they only
add noise. Do not commit a fixture containing a real site's marketing copy.

## Iterating offline

Once captured, build a document without touching the browser:

```bash
node scripts/build-design-md.js tests/fixtures/my-site.json --tier pro --date 2026-08-29 > /tmp/DESIGN.md
```

Pass `--date` (or omit it entirely) for reproducible output — the builder never
reads the clock, so the same tokens always produce the same bytes. Drop
`--tier pro` for the free tier, and add `--scope component` for the short
component-card variant.

To compare tiers:

```bash
diff <(node scripts/build-design-md.js tests/fixtures/my-site.json --tier free) \
     <(node scripts/build-design-md.js tests/fixtures/my-site.json --tier pro)
```

## Running the tests

```bash
node --test tests/design-md-builder.test.js
```

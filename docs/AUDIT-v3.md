# VibeDesign v3 audit

Written on branch `v3.0` at commit `b601b4c`. Derived by reading the source,
not from prior documentation. No functional changes accompany this file.

Where a claim needs verifying before you act on it, it says so explicitly.

---

## 1. Module map

Nothing here is bundled. Every file is a classic `<script>` (or an
`importScripts` / `chrome.scripting.executeScript` target) that publishes
either a `VD_*` global or bare top-level function declarations. Load order in
`popup.html` / `sidepanel.html` is therefore load-bearing.

### Entry points

| File | Lines | Purpose | Publishes | Loaded by |
|---|---|---|---|---|
| `background.js` | 130 | MV3 service worker: side-panel behavior, token-refresh alarm + `VD_REFRESH_TOKEN` handler, `onMessageExternal` ping/pong for dashboard install-detection | — | manifest `background.service_worker` |
| `content.js` | 6,490 | The extractor. Runs in the page's isolated world, walks the DOM/CSSOM and returns the token bundle; answers `EXTRACT_PAGE` | `window.__vibeDesign.*` | injected on demand by `injectContentScript()` |
| `sidepanel.js` | 211 | Side-panel overrides: tab-change tracking, auth pill + welcome card wiring, 30 s server-auth poll, one-shot migration trigger | `_uiHooks.afterListeners` | `sidepanel.html` |
| `popup.js` | 47 | Popup overrides: picker hint overlay, picker launch screen. No auth — the popup is anonymous-only | `updateAnalyzeBtn` (override) | `popup.html` |

### `lib/` — shared

| File | Lines | Purpose | Publishes | Called by |
|---|---|---|---|---|
| `config.js` | 22 | Supabase URL + anon key, auth storage key, refresh alarm name/period/leeway | `VD_CONFIG` | `auth.js`, `supabase-client.js`, `background.js`, `ui-helpers.js` |
| `color-utils.js` | 241 | Colour maths: hex normalisation, perceptual luminance/saturation, HSL, tonal scales, semantic role inference, WCAG luminance + contrast | top-level fns; `window.__vibeDesign.{hexLum,hexSat}`; guarded `module.exports` | `content.js` (injected), `prompt-builder.js`, `design-md-builder.js`, tests |
| `noise-filter.js` | 94 | Filters junk CSS vars / framework noise out of extraction | `window.__vibeDesignNoiseFilter`, `window.__vibeDesign` | `content.js` (injected before it) |
| `shadow-utils.js` | 53 | Box-shadow parsing helpers | `window.__vibeDesignShadowUtils`, `window.__vibeDesign` | `content.js` (injected before it) |
| `picker.js` | 144 | Element-picker overlay; answers `ACTIVATE_PICKER` / `DEACTIVATE_PICKER` | `window.__vibeDesignPickerInjected` | injected by `injectPickerScript()` |
| `prompt-builder.js` | 4,599 | Turns tokens into the platform prompt (the main product output); dual-writes history to cloud | top-level fns | `ui-helpers.js` |
| `ai-caller.js` | 474 | Optional AI "direction" pass — the only module that sends a user's provider key anywhere | top-level fns | `prompt-builder.js` |
| `model-discovery.js` | 199 | Live model lists per provider, 24 h cache, stale-model fallback, "newer model" nudge + dismissals | `VD_MODELS`, `module.exports` | `ui-helpers.js`, tests |
| `data/google-fonts.js` | 6 | **New in v3.** Generated: the Google Fonts family-name catalogue as a browser-loadable global. Twin of `data/google-fonts.json`; both written by `scripts/update-google-fonts.mjs` | `VD_GOOGLE_FONTS`, `module.exports` | `design-model.js` |
| `design-model.js` | 1079 | **New in v3.** THE single normalised design model — colour roles, type scale, spacing, radius, shape, shadows, breakpoints, fonts. Every other artefact reads it, so one colour cannot come out two ways | `VD_MODEL`, `module.exports` | `design-md-builder.js`, `token-exporter.js`, `skill-builder.js`, tests |
| `token-exporter.js` | 326 | DTCG / W3C token export. Rewritten in v3 as a model reader; the previous version re-derived roles itself and could emit `text-primary` equal to `background` | `VD_TOKENS` + bare `exportW3CTokens`/`downloadTokensJSON`, `module.exports` | `skill-builder.js`, tests (no UI control of its own) |
| `design-md-builder.js` | 1356 | **New in v3.** Model → Stitch-compatible DESIGN.md. A renderer only: it derives nothing | `VD_DESIGN_MD`, `module.exports` | `ui-helpers.js`, `skill-builder.js`, `scripts/build-design-md.js`, tests |
| `skill-builder.js` | 665 | **New in v3.** Model → the `design-<slug>/` skill bundle: SKILL.md, README.md, DESIGN.md, tokens.json, variables.css, theme.css, tailwind.config.js | `VD_SKILL`, `module.exports` | `ui-helpers.js` (Download Skill), tests |
| `zip-lite.js` | 147 | **New in v3.** Store-only ZIP writer with CRC-32. No deflate, no dependency; output is byte-stable across builds | `VD_ZIP`, `module.exports` | `skill-builder.js`, tests |
| `download.js` | 133 | **New in v3.** Object-URL downloads for text and bytes; bundle/document filenames. Needs no `downloads` permission | `VD_DOWNLOAD`, `module.exports` | `ui-helpers.js`, tests |
| `ui-helpers.js` | 1799 | The shared UI layer: app template, provider/model settings, history, auth pill, usage counter, session status, script injection, dev tools | top-level fns + `state` | `popup.js`, `sidepanel.js` |
| `supabase.min.js` | 23 | Vendor UMD, `@supabase/auth-js` 2.104.0 | `window.supabase` | `sidepanel.html` only |
| `supabase-client.js` | 110 | Lazy Supabase client singleton with a `chrome.storage.local` adapter; `autoRefreshToken:false` | `VD_SUPABASE` | `auth.js`, `cloud-sync.js`, `sidepanel.js` |
| `auth.js` | 414 | OAuth via `chrome.identity`, session peek, **sole token refresher** (single-flight), `ensureFreshToken`, refresh status record | `VD_AUTH` | `background.js`, `ui-helpers.js`, `cloud-sync.js`, `usage-meter.js`, `sidepanel.js` |
| `cloud-sync.js` | 371 | Supabase reads/writes for `analyses` + `prompts`, and the one-shot anonymous-history migration | `VD_CLOUD` | `prompt-builder.js`, `ui-helpers.js`, `sidepanel.js` |
| `usage-meter.js` | 143 | Anonymous cap: 5 prompts / UTC month. Authed users bypass entirely | `VD_USAGE` | `ui-helpers.js`, `sidepanel.js` |

**Note on the popup.** `popup.html` does not load `supabase.min.js`,
`supabase-client.js`, `auth.js`, `cloud-sync.js` or `usage-meter.js`. The
popup is therefore permanently anonymous and un-metered — every auth and
entitlement surface lives in the side panel only. That matters for §4: any Pro
gate placed in `ui-helpers.js` must tolerate `VD_AUTH` being undefined, which
the existing `typeof … === 'function'` guards already do.

---

## 2. Token object shape

`content.js#extractPageTokens()` builds one flat object and answers
`EXTRACT_PAGE` with it. 62 top-level keys, assigned across ~500 lines. This is
the contract every consumer codes against.

### Raw collections

| Key | Shape | Notes |
|---|---|---|
| `url`, `title` | string | `title` is **page copy** |
| `colors` | `string[]` ≤10 | deduped accents + clustered neutrals |
| `accentColors` | `string[]` ≤5 | |
| `colorUsage` | `{ [hex]: {bg,text,border} }` | usage counts — the basis for semantic role inference |
| `pageBackground` | hex | actual computed page background |
| `fonts` | `string[]` ≤5 | family stacks |
| `fontWeights` | `string[]` | sorted numerics |
| `letterSpacings` | `string[]` ≤6 | |
| `borderRadii` | `string[]` ≤6 | |
| `shadows` | `string[]` ≤16 | raw box-shadow strings |
| `textShadows` | `string[]` ≤6 | |
| `transitions` | `string[]` ≤6 | |
| `cssAspectRatios` | `string[]` ≤6 | |
| `cssVars` | `{ [--name]: value }` | noise-filtered custom properties |
| `animations` | `{name,from,to}[]` | keyframes, framework noise filtered |
| `animationDetails` | object[] | computed animation props |
| `hoverStates` | `{selector, ...cssProps}[]` | **the real interaction-state data** |

### Derived systems

| Key | Shape |
|---|---|
| `spacingScale` | `{ baseUnit, conformRate, commonValues[], outliers[] }` or `null` |
| `shadowSystem` | `{ style, maxDepth, hasInset, hasGlow, hasLayered, hasBrutalist }` |
| `breakpoints` | `{ px, ruleCount, condition }[]` ≤8 |
| `darkModeTokens` | `{ [prop]: value }` or `null` |
| `typographyPatterns` | `{ h1..h4, body, caption, label, code }` each `{fontSize,fontWeight,lineHeight,fontFamily,letterSpacing,color,…}`, **plus ~20 sibling `has*` booleans** and `pageStructure` / `iconStyle` / `pricingColumnCount` |
| `layoutInfo` | `{ maxWidth, hasSidebar, hasNav, hasHero, pageType }` |
| `visualProfile` | ~35 keys: `sectionPaddingX/Y`, `sectionRhythm`, `gridGap`, `navStyle`, `imageTreatment`, `gradientStyle`, `splitLayoutCount`, plus many `has*` flags |
| `designSystem` | `{ name, confidence, note }` — shadcn/Radix/Chakra/Mantine/antd/MUI |
| `frameworkDetection` | detected front-end framework |

### Component styles

`buttonStyles` `{primary,secondary,ghost,navCta}` · `cardStyles` ·
`inputStyles` · `badgeStyles` · `linkStyles` · `footerStyles` ·
`imageStyles` · `gradients` · `filterEffects` · `iconographySystem`
`{style,dominantSizes[],strokeWidths[],hasGradients,hasAnimations,count}`.

### Motion

`motionProfile` `{dominantDuration,dominantEasing,timingPersonality,revealStyle,scrollParadigm,staggerPattern{delayBetween,elementCount},gsapScrollTriggers[]}` ·
`heroEntranceSequence` `{elements[{tag,delay,duration}],hasCanvasAnimation,…}` ·
`riveAndLottie` `{totalCount,type,loop,autoplay,size,src}` ·
`animationLibraries` `string[]` · `ambientAnimations` · `svgDiagramAnimations`.

### Patterns

`tabbedComponents` · `fixedUIChrome` · `stickySections` · `caseGridPattern` ·
`masonryGrid` · `curvedPanels` · `rotatingText` · `countdownElements` ·
`customCursor` · `navPattern` · `illustrationStyle` · `layeredImages` ·
`subtleTextures` · `sectionBackgroundDecorations` · `sectionIllustrations` ·
`visualClassification` · `contactSection`.

### Copy-bearing keys — never put these in a shipped document

`title`, `navPattern.logoText`, `navPattern.navLinks`, `buttonStyles.*.text`,
`sectionContentMap`, `footerContentMap`, `fixedUIChrome[].text`,
`stickySections.scrollBlockHeadings`, `stickySections.tabLabels`,
`caseGridPattern.tagLabels`, `assets`, `heroImageUrl`, `riveAndLottie.src`.

**`interactiveStates` is misnamed.** Despite the name it holds tab-panel copy —
`{trigger, heading, bullets[], hasImage, imgSrc, cta}` — produced by clicking
through tabs. It is *not* hover/focus/active/disabled CSS diffs. Those are in
`hoverStates` and `transitions`. `design-md-builder.js` never reads it, and
neither should anything else that produces user-facing output. Worth renaming
to `tabPanelContent` in a future pass.

### The skill bundle

`Download Skill (zip)` produces `design-<slug>.zip`, containing one directory:

```
design-rig-ai/
  SKILL.md            Agent Skills entry point (name ≤ 64 chars, description ≤ 1024)
  README.md           provenance and the caveats that come with it
  DESIGN.md           byte-identical to what Download DESIGN.md produces
  tokens.json         DTCG, values as CSS strings
  variables.css       :root custom properties
  theme.css           variables + base elements + .vd-btn / .vd-card / .vd-field
  tailwind.config.js  the same scale under theme.extend (v3)
  tailwind.v4.css     @theme tokens + the @keyframes captured in full (v4)
```

Every file is rendered from `lib/design-model.js`. That is the point of the
model: a colour appears in five formats or in none, and `tests/skill-bundle.test.js`
asserts the values agree character for character.

Three rules the bundle enforces, each with a test that has been shown to fail
when broken:

- **No page copy.** The scrub sentinel must not appear in any file.
- **No source selectors.** Class names harvested from the capture must not
  appear. Generated component classes carry a `vd-` prefix so they cannot even
  *coincide* with a page's own — rig.ai really does have a `.btn-ghost`, and an
  unprefixed one here would be indistinguishable from having copied it.
- **Nothing unresolved.** A declaration whose `var()` cannot be resolved to a
  literal is dropped rather than emitted broken; no `var(--x)` used anywhere in
  the bundle is left undeclared.

**Font hosting and font licensing are separate questions**, and conflating them
was a real defect: every self-hosted face was reported "not freely available",
which is wrong for the many sites that self-host a copy of an open family.
rig.ai self-hosts all four of its faces; Instrument Sans and Chivo Mono are
openly licensed and Chalet is not. Hosting is observed from the serving host;
licensing is a name lookup against `lib/data/google-fonts.json`. That test is
sufficient for "open" and not necessary, so a family missing from the catalogue
reads *licence unknown — likely proprietary*, never *proprietary*.

The catalogue is regenerated by `scripts/update-google-fonts.mjs` from
`https://fonts.google.com/metadata/fonts` (no API key). It is written twice —
as JSON, and as a generated JS twin, because the extension has no build step
and a classic `<script>` cannot read JSON off disk. A test asserts the two hold
the identical list, and that both pages load the twin *before* `design-model.js`;
without it every family silently reports "licence unknown" in the browser while
Node reports the truth.

**Keyframes are emitted only when the capture is complete.** `content.js`
records the first and last rule of each `@keyframes` block. For a genuinely
two-frame animation that is the whole thing; for anything longer it is two
samples of a curve. The test is structural — the two frames' stops must come to
exactly {0%, 100%} or {0%, 50%, 100%}, the blocks must differ, and every value
must resolve to a literal. rig.ai yields 8 of 16; the other 8 are listed in a
comment with the reason. Radix-style keyframes written against runtime
variables (`--radix-accordion-content-height`) can never resolve from a static
capture and are reported as such rather than shipped inert.

The zip is store-only (method 0) with a fixed 1980-01-01 timestamp, so the same
capture produces byte-identical bytes on every run and two exports can be
diffed. `unzip`, Archive Utility, Explorer and Python's `zipfile` all read it;
the suite checks the system `unzip` specifically, and round-trips every file.

### Extractor gaps

Places where `content.js` does not capture something a downstream document
needs. Each one currently forces an omission or a recommendation rather than a
measurement — none is a bug in the renderers.

| Gap | Effect downstream | What would close it |
|---|---|---|
| **Only `:hover` is measured** | Focus, active and disabled states can only ever be *recommendations* in DESIGN.md, clearly fenced off from measured facts | Computed styles for `:focus-visible`, `:active` and `[disabled]` |
| ~~Transparent bordered cards~~ | **Closed.** `extractCardStyles` now groups repeated siblings that are visually separated from their parent by a border, shadow, or differing background, and accepts a lone instance whose parent is a repeating container. rig.ai reports 6 transparent bordered cards; posthog.com reports its bordered white card | — |
| ~~Inputs are not matched~~ | **Closed.** `extractInputStyles` now matches `[role=textbox]`, `[contenteditable]` and the other ARIA forms, reads styles from the control (falling back to a wrapper's frame and flagging it), and reads `::placeholder` and `:focus-visible` out of the stylesheets. posthog.com's homepage genuinely has **no** text input, so `null` there is correct, not a gap | — |
| ~~Only `:hover` is measured (focus)~~ | **Partly closed.** A declared `:focus-visible` ring on an input is now captured and reported as measured. `:active` and `[disabled]` are still recommendations | Computed styles for `:active` and `[disabled]` |
| **Named palettes in custom properties** | Now handled, but worth noting the shape: shadcn/ui stores its palette as bare HSL triplets (`--card: 0 0% 4%`) composed as `hsl(var(--card))` at use sites, so the recorded value has no function wrapper. Any consumer parsing `cssVars` must handle this | — (handled in `lib/color-utils.js#parseCssColor`) |
| **Ambient easing / iteration** | `ambientAnimations[]` carries `{name, duration, tag, class, location}` but no easing or iteration count. Those are parsed out of the single `animationDetails[]` shorthand string, so only the one animation named there gets them | `easing` and `iterationCount` on each `ambientAnimations` entry |
| **Navigation metrics** | The Navigation block reports pattern and style only. `navPattern.hasVisibleLinks` is `false` on rig while `visibleLinks` has an entry — contradictory | Nav height, padding, background, and a consistent `hasVisibleLinks` |
| **Per-component transitions** | Only `buttonStyles.primary.transition` exists. The six entries in `transitions[]` cannot be attributed to cards, links or the FAQ | A `transition` field on each component style block |
| **Keyframes keep first and last frame only** | 5 of rig's 16 keyframes have identical first/last frames, so their motion is unrepresentable. DESIGN.md marks them "not fully captured" rather than implying a spec | All frames, or the extreme value per animated property |
| **`interactiveStates` is misnamed** | It holds tab-panel copy, not CSS state diffs. Nothing may read it for a user-facing document | Rename to `tabPanelContent`; add a real interactive-states extractor |

---

## 3. Permissions review

### Manifest permissions

| Permission | Used? | Where |
|---|---|---|
| `activeTab` | **Redundant today** | No direct API. Would grant transient host access, but `<all_urls>` already grants it unconditionally |
| `scripting` | Yes | `lib/ui-helpers.js:698-701` (`color-utils`, `noise-filter`, `shadow-utils`, `content.js`), `:710` (`picker.js`) |
| `storage` | Yes | Everywhere — `chrome.storage.local` in 9 first-party files |
| `tabs` | **Redundant today** | `tabs.query/get/onActivated/onUpdated` work without it; only the `url` field is gated, and `<all_urls>` already unlocks it. `sidepanel.js:9,15`, `lib/ui-helpers.js:669,1152` read `tab.url` |
| `sidePanel` | Yes | `background.js:14` `setPanelBehavior`, manifest `side_panel` |
| `identity` | **Yes — in use** | `lib/auth.js:103` `getRedirectURL()`, `lib/auth.js:108` `launchWebAuthFlow()`, guarded by `lib/auth.js:45` — the entire OAuth sign-in |
| `alarms` | Yes | `background.js` `_ensureRefreshAlarm()` + `onAlarm` → token refresh |

**On `identity`:** the suspicion in the brief is incorrect — it is load-bearing.
Remove it and sign-in breaks entirely: `launchWebAuthFlow` is how the extension
opens `vibedesign.tech/auth/*` and receives the token callback. It also has no
install-time warning, so there is nothing to gain.

The two genuinely redundant entries are `activeTab` and `tabs`, and both are
redundant *only because* `<all_urls>` is present. They become necessary again
under the optional-permissions model below, so do not remove them in isolation.

### `host_permissions: ["<all_urls>"]`

**It cannot simply be dropped for `activeTab` + `scripting`.** Two blockers,
both structural rather than incidental:

1. **`activeTab` is granted per-invocation, to one tab.** It arrives when the
   user clicks the action icon (which here opens the side panel) and covers
   only the tab active at that moment. The side panel then *persists across tab
   switches* — `sidepanel.js:6-18` explicitly tracks `tabs.onActivated` /
   `onUpdated` to keep `state.currentUrl` fresh. Switch tab, press **Analyze
   Page**, and `executeScript` hits a tab that was never granted. The button is
   inside the panel, so it is not itself a qualifying gesture.

2. **`activeTab` is revoked on navigation.** Even on the original tab, browsing
   to a new page drops the grant. Analyse-after-navigating is the normal flow,
   so this would fail constantly.

`web_accessible_resources` is a red herring here: it governs which origins may
*fetch* a resource by URL, and grants no injection rights. Which leads to a
separate finding —

**`web_accessible_resources` appears to be dead weight.** Nothing in the
codebase calls `chrome.runtime.getURL` (verified by grep across all first-party
files). `content.js`, `picker.js`, `color-utils.js`, `noise-filter.js` and
`shadow-utils.js` are all delivered by `chrome.scripting.executeScript({files})`,
which injects into the isolated world and needs no WAR entry. They share state
through the isolated world's `window.__vibeDesign`, so no MAIN-world hop is
involved either. *Verify before removing:* delete the block, reload unpacked,
and exercise both **Analyze Page** and the element picker on a normal site.

**The realistic improvement is not removing host access but deferring it:**

| Option | Install warning | Cost |
|---|---|---|
| A. Status quo `<all_urls>` | "Read and change all your data on all websites" | Highest friction at install; worst Web Store review posture |
| B. `optional_host_permissions: ["<all_urls>"]` + `permissions.request()` on first analyse | None at install | One extra prompt, once. Keep `activeTab` + `tabs` as the pre-grant fallback |
| C. Per-origin optional permission on each new site | None at install | Most privacy-preserving, a prompt per site — likely too much friction |

**Recommendation: B.** It removes the scariest install-time string, which for a
"paste a URL, get a design prompt" tool is the single biggest install-funnel
drag, and costs one in-context prompt at the moment the user has already asked
for an analysis. It is a behavioural change and out of scope for this audit.

---

## 4. Where Pro entitlements would hook in

### Today there is no entitlement concept at all

Auth is binary. Signed in vs anonymous is the only axis, and its sole effect is
lifting the usage cap. Grepping for `plan`, `tier`, `subscription`,
`entitlement`, `is_paid` finds nothing outside `content.js`'s *extraction* of
other sites' pricing sections. The Supabase user object is only ever read for
`user.id`, `user.email` and `user_metadata.avatar_url`.

So Pro needs a **new** entitlement source. It does not exist yet.

### Usage meter — the existing gate, and the right template

`lib/usage-meter.js`, storage key `usage_meter` = `{count, periodStart}`,
`LIMIT = 5` per UTC month. Authenticated ⇒ bypass (`lib/usage-meter.js:71-72`
calls `VD_AUTH.isAuthenticated()`). It **fails open** on storage error by
design — a soft gate, explicitly not a security boundary.

| Hook | Site |
|---|---|
| Pre-generation gate | `lib/ui-helpers.js:659-660` `canGenerate()` |
| Post-generation increment | `lib/ui-helpers.js:269-270` `incrementUsage()` |
| Button disabled state | `lib/ui-helpers.js:1733-1734` |
| Counter render | `lib/ui-helpers.js:1483-1484` |
| Month rollover | `sidepanel.js:137-138` `resetIfNeeded()` |

### Auth

`lib/auth.js` → `VD_AUTH`. Sign-in `openAuthFlow('login'|'register')`
(`lib/ui-helpers.js:1261, 1418, 1511`), state `isAuthenticated()`
(`lib/ui-helpers.js:454, 1470`; `lib/usage-meter.js:71`), sign-out
(`lib/ui-helpers.js:1333`), change subscription `onAuthStateChange`
(`sidepanel.js:151`).

### Cloud sync

`lib/cloud-sync.js` → `VD_CLOUD`, six entry points, all gated on
`ensureFreshToken()`. Writes `analyses` + `prompts` under RLS
(`user_id = auth.uid()`). Callers: `lib/prompt-builder.js:2080-2126` (dual-write on
generate), `lib/ui-helpers.js:1555` / `:1664` / `:1702` (history read, delete,
prompts), `sidepanel.js:169` and `:185` (migration on sign-in and on load).

### Recommended shape for Pro

1. **Server is the source of truth.** Add a `profiles` (or `entitlements`) row
   keyed by `user_id` with a `plan` column, RLS-readable by its owner. Never
   trust a client-side flag: the DESIGN.md pro tier is a string parameter today
   and trivially forced.
2. **Mirror it into a `VD_ENTITLEMENTS` module** shaped like `usage-meter.js` —
   `getPlan()`, `isPro()`, cached in `chrome.storage.local` with a short TTL,
   refreshed on `SIGNED_IN` and alongside the token refresh. Fail **closed** to
   `free` (unlike the usage meter, which fails open) so a fetch failure cannot
   hand out Pro.
3. **Gate at the call site, not in the builder.** `buildDesignMd` should stay a
   pure function taking `tier`; `ui-helpers.js` decides which tier to ask for.
   That keeps the builder testable and the gate in one place.
4. **Anything genuinely valuable must be computed server-side**, since the
   extension ships as readable source. The pro DESIGN.md sections are derived
   from tokens the client already holds, so a determined user can reproduce
   them; price that in, or move that derivation behind the API.
5. The popup loads no auth modules (§1), so either accept that Pro is
   side-panel-only or add the auth scripts to `popup.html`.

---

## 5. Packaging

### How the zip is produced today

**By hand.** There is no build script, no `package.json`, no Makefile, no CI.
`scripts/` contains only `build-design-md.js`, which is a dev tool for the
DESIGN.md builder and unrelated to packaging.

`store/vibedesign-2.0.1.zip` (281 KB, 28 entries) is a manually assembled
archive containing exactly the runtime files:

```
manifest.json  background.js  content.js
popup.html  popup.js  popup.css
sidepanel.html  sidepanel.js
icons/  lib/
```

Excluded, correctly: `README.md`, `PRIVACY.md`, `.gitignore`,
`landing-page-prompt.md`, `store/`, `tests/`, `docs/`, `scripts/`.

Two observations:

- **No tags.** Identifying which commit shipped as 2.0.1 required unpacking the
  zip and diffing it against the branch file-by-file. `git tag v2.0.1 <sha>`
  retroactively would fix this cheaply.
- **`*.zip` is gitignored**, so the artefacts in `store/` are untracked local
  files. They are the only record of what shipped.

### Proposed `scripts/package.sh` — not created

Rationale: the manual process is undocumented, unrepeatable, and silently
depends on remembering to exclude `tests/` and `docs/`. Shipping a stray
fixture or the dev-tools row would be easy and invisible.

```sh
#!/usr/bin/env bash
# scripts/package.sh — build store/vibedesign-<version>.zip from a clean tree.
set -euo pipefail
```

It should:

1. **Refuse to run on a dirty tree** (`git diff --quiet`) — the artefact must
   correspond to a commit.
2. **Read the version from `manifest.json`** and refuse if
   `store/vibedesign-<version>.zip` already exists, so a release is never
   silently overwritten.
3. **Run the full suite** (`node --test tests/*.test.js`) and abort on failure.
4. **Run the release-checklist greps** from `docs/RELEASE-CHECKLIST.md` — the
   key scan, the `service_role` check, the refresh-path scan — and abort on any
   hit. These are the checks most likely to be skipped by a human in a hurry.
5. **Build from `git archive HEAD`** into a temp dir rather than from the
   working tree, so untracked scratch files cannot be included by accident.
6. **Delete the non-shipping paths** from that temp dir with an explicit
   allowlist of what ships, not a denylist of what doesn't.
7. **Assert the dev-tools row is hidden** in the staged `lib/ui-helpers.js`
   (`style="display:none"` present, single guarded reveal).
8. **Zip, then re-scan the zip** for key-shaped strings.
9. **Print the entry count and byte size**, and suggest `git tag v<version>`.

Steps 1, 5 and 6 are the ones that actually change the risk profile: everything
else is checkable by hand, but "the tree was dirty" and "an untracked file got
swept in" are invisible after the fact.

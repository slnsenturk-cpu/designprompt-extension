#!/usr/bin/env node
// VibeDesign — fixture capture harness.
//
//   node scripts/capture.mjs https://rig.ai
//   node scripts/capture.mjs https://posthog.com --slug posthog
//   node scripts/capture.mjs --all
//
// Opens the URL in headless Chromium, injects the extension's own extraction
// stack in the same order the side panel does, runs extractPageTokens(), and
// writes tests/fixtures/<slug>.raw.json with the privacy scrub applied.
//
// The point is that fixtures come from the REAL extractor. Fixtures written by
// hand to match a reader have, in this repo, made a broken feature look green.
//
// Requires: npm install && npx playwright install chromium
//
// Not every site can be captured this way. Anything behind a login (the
// VibeDesign dashboard) stays a manual capture via the extension's
// Settings → Developer → Copy RAW capture button; see tests/fixtures/README.md.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures');
const SENTINEL = fs.readFileSync(path.join(FIXTURES, 'SENTINEL.txt'), 'utf8').trim();

// The same order sidepanel.html loads them: content.js destructures helpers
// off window.__vibeDesign that these three put there.
const INJECT = ['lib/color-utils.js', 'lib/noise-filter.js', 'lib/shadow-utils.js', 'content.js'];

const DEFAULT_TARGETS = [
  { url: 'https://rig.ai', slug: 'rig-ai' },
  { url: 'https://posthog.com', slug: 'posthog' },
];

// ── privacy scrub ──────────────────────────────────────────────────────────
// Copy-bearing fields, by path. Everything here is replaced with the sentinel
// so the fixture proves the leak tests rather than shipping someone's words.
const COPY_PATHS = [
  'title',
  'navPattern.logoText',
  'navPattern.visibleLinks',
  'footerContentMap',
  'tabbedComponents[].labels',
  'tabbedComponents[].activeLabel',
  'buttonStyles.*.text',
  'sectionContentMap[].heading',
  'sectionContentMap[].eyebrow',
  'sectionContentMap[].ctas',
  'sectionContentMap[].arrowLinks',
  'sectionContentMap[].visualDescriptions',
  'sectionContentMap[].floatingIllustrations[].text',
  'svgDiagramAnimations[].labels',
  'sectionIllustrations[].sectionHeading',
  'stickySections.scrollBlockHeadings',
  'stickySections.tabLabels',
  'caseGridPattern.tagLabels',
  'fixedUIChrome[].text',
  'layeredImages[].section',
  'layeredImages[].layers[].url',
  'heroEntranceSequence.elements[].text',
];

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function scrubValue(v) {
  if (typeof v === 'string') return SENTINEL;
  if (Array.isArray(v)) return v.map(() => SENTINEL);
  if (v && typeof v === 'object') return SENTINEL;
  return v;
}

// Walks a dotted path with [] for "every element" and * for "every key".
function applyPath(obj, parts) {
  if (!obj || typeof obj !== 'object') return;
  const [head, ...rest] = parts;
  if (head === undefined) return;

  const key = head.replace(/\[\]$/, '');
  const isEach = head.endsWith('[]');

  if (key === '*') {
    Object.keys(obj).forEach(k => {
      if (rest.length) applyPath(obj[k], rest);
      else obj[k] = scrubValue(obj[k]);
    });
    return;
  }
  if (!(key in obj) || obj[key] === null || obj[key] === undefined) return;

  if (isEach) {
    const arr = obj[key];
    if (!Array.isArray(arr)) return;
    arr.forEach(el => { if (rest.length) applyPath(el, rest); });
    if (!rest.length) obj[key] = arr.map(() => SENTINEL);
    return;
  }
  if (rest.length) applyPath(obj[key], rest);
  else obj[key] = scrubValue(obj[key]);
}

function scrub(tokens, ownHost) {
  const t = JSON.parse(JSON.stringify(tokens));
  COPY_PATHS.forEach(p => applyPath(t, p.split('.')));

  // Asset URLs keep their HOST — the font-availability check reads it — and
  // lose their path, which can carry account ids or hashes.
  const stripPath = url => {
    if (typeof url !== 'string') return url;
    try {
      const u = new URL(url);
      const ext = (u.pathname.match(/\.[a-z0-9]+$/i) || [''])[0];
      return `${u.protocol}//${u.host}/${SENTINEL.slice(0, 6)}${ext}`;
    } catch (e) { return SENTINEL; }
  };
  if (t.assets) {
    (t.assets.fonts || []).forEach(f => { f.url = stripPath(f.url); });
    (t.assets.icons || []).forEach(i => { i.url = stripPath(i.url); });
    t.assets.backgrounds = (t.assets.backgrounds || []).map(stripPath);
  }
  if (t.heroImageUrl) t.heroImageUrl = stripPath(t.heroImageUrl);

  // Belt and braces over the whole document: no address survives, and no
  // third-party host other than the site's own is left in a free-text field.
  const json = JSON.stringify(t)
    .replace(EMAIL_RE, SENTINEL.slice(0, 20))
    // data: URIs can embed anything; they are never needed in a fixture.
    .replace(/"data:[^"]{40,}"/g, `"data:${SENTINEL.slice(0, 8)}"`);
  const out = JSON.parse(json);

  const leftovers = [];
  const walk = (node, at) => {
    if (typeof node === 'string') {
      const hosts = node.match(/https?:\/\/([a-z0-9.-]+)/gi) || [];
      hosts.forEach(h => {
        const host = h.replace(/^https?:\/\//i, '');
        if (host !== ownHost && host !== 'example.com') leftovers.push(`${at}: ${host}`);
      });
    } else if (Array.isArray(node)) node.forEach((n, i) => walk(n, `${at}[${i}]`));
    else if (node && typeof node === 'object') {
      Object.keys(node).forEach(k => walk(node[k], at ? `${at}.${k}` : k));
    }
  };
  walk(out, '');
  return { tokens: out, leftovers };
}

// ── capture ────────────────────────────────────────────────────────────────

async function capture(browser, { url, slug }) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', () => {});                 // the extractor is chatty
  process.stderr.write(`\n▸ ${url}\n`);

  // `networkidle` never settles on pages with ambient animation or polling —
  // rig.ai runs canvas loops indefinitely. Load, then settle on a timer.
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);

  // Scroll the page so lazy sections mount and scroll-reveal classes apply,
  // then return to the top so above-fold measurements are taken in place.
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 220));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1200);

  for (const file of INJECT) {
    await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT, file), 'utf8') });
  }

  const tokens = await page.evaluate(async () => {
    // content.js closes over extractPageTokens; it exposes the entry point by
    // answering EXTRACT_PAGE. Under Playwright there is no chrome.runtime, so
    // the IIFE also parks the function on window for exactly this case.
    if (typeof window.__vibeDesignExtract === 'function') return window.__vibeDesignExtract();
    throw new Error('content.js did not expose window.__vibeDesignExtract');
  });

  // The dev button copies state.lastAnalyzedData AFTER a prompt has been
  // generated, and the prompt builder annotates that object in place with
  // _primaryColorAmbiguous / _primaryColorCandidates. A fixture captured
  // without those is missing signals the renderers depend on — rig's inverse
  // button is detected from exactly this pair — so run the builder here too
  // and keep the annotations. The prompt itself is discarded.
  for (const file of ['lib/ai-caller.js', 'lib/prompt-builder.js']) {
    await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT, file), 'utf8') });
  }
  const annotations = await page.evaluate(tok => {
    try {
      window.state = { focus: 'all', mode: 'page', provider: 'none', apiKeys: {}, selectedModels: {} };
      window.getActiveModel = () => null;
      window.buildPagePrompt(tok, null);          // side effect: annotates tok
      return {
        _primaryColorAmbiguous: tok._primaryColorAmbiguous,
        _primaryColorCandidates: tok._primaryColorCandidates,
      };
    } catch (e) {
      return { __error: e.message };
    }
  }, tokens);
  if (annotations.__error) {
    process.stderr.write(`  ⚠ primary-colour annotation failed: ${annotations.__error}\n`);
  } else {
    Object.assign(tokens, annotations);
  }

  await page.close();

  const ownHost = new URL(url).host;
  const { tokens: clean, leftovers } = scrub(tokens, ownHost);
  const file = path.join(FIXTURES, `${slug}.raw.json`);
  fs.writeFileSync(file, JSON.stringify(clean, null, 2) + '\n');

  const raw = JSON.stringify(clean);
  process.stderr.write(`  wrote ${path.relative(ROOT, file)} (${(raw.length / 1024).toFixed(1)} KB)\n`);
  process.stderr.write(`  cardStyles: ${clean.cardStyles ? 'yes' : 'NULL'}`
    + ` · inputStyles: ${clean.inputStyles ? 'yes' : 'NULL'}`
    + ` · hoverStates: ${(clean.hoverStates || []).length}`
    + ` · keyframes: ${(clean.animations || []).length}\n`);
  process.stderr.write(`  sentinels: ${raw.split(SENTINEL).length - 1}`
    + ` · emails: ${(raw.match(EMAIL_RE) || []).length}\n`);
  if (leftovers.length) {
    process.stderr.write(`  ⚠ third-party hosts still present (${leftovers.length}):\n`);
    [...new Set(leftovers)].slice(0, 8).forEach(l => process.stderr.write(`      ${l}\n`));
  }
  return clean;
}

async function main() {
  const argv = process.argv.slice(2);
  let targets = DEFAULT_TARGETS;
  if (!argv.includes('--all') && argv.some(a => !a.startsWith('--'))) {
    const url = argv.find(a => !a.startsWith('--'));
    const i = argv.indexOf('--slug');
    const slug = i !== -1 ? argv[i + 1]
      : new URL(url).host.replace(/^www\./, '').replace(/\./g, '-');
    targets = [{ url, slug }];
  }

  const browser = await chromium.launch();
  try {
    for (const t of targets) await capture(browser, t);
  } finally {
    await browser.close();
  }
  process.stderr.write('\nRemember to read the snapshot diffs before accepting them.\n');
}

main().catch(err => {
  process.stderr.write(`\ncapture failed: ${err.message}\n`);
  process.exit(1);
});

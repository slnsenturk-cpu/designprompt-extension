// VibeDesign — side panel harness.
//
// docs/SIDEPANEL-IA.md is a specification, and a specification nobody executes
// drifts. This file boots the REAL panel — lib/ui-helpers.js and its libraries,
// the real templates, the real listeners — inside jsdom, and drives it by
// clicking things. A render test that calls a handler directly would pass with
// the button wired to nothing; that has already happened once in this repo.
//
// Run with:  node --test tests/ui-panel.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const FIXTURES = path.join(__dirname, 'fixtures');
const fixture = n => JSON.parse(fs.readFileSync(path.join(FIXTURES, n + '.json'), 'utf8'));

// The panel never sees a real address. §4.3's mock-up shows one; using it in a
// fixture would put a private address into the repo and into every snapshot.
const TEST_EMAIL = 'user@example.com';

// Load order is the pages' load order — see popup.html / sidepanel.html.
const LIBS = [
  'lib/color-utils.js', 'lib/noise-filter.js', 'lib/shadow-utils.js',
  'lib/prompt-builder.js', 'lib/ai-caller.js', 'lib/model-discovery.js',
  'lib/download.js', 'lib/data/google-fonts.js', 'lib/design-model.js',
  'lib/token-exporter.js', 'lib/design-md-builder.js', 'lib/zip-lite.js',
  'lib/skill-builder.js', 'lib/ui-components.js', 'lib/ui-helpers.js',
];

// A chrome stub that behaves: storage really stores, so anything the panel
// persists it can read back, and a test can assert on what was written.
function makeChrome(store) {
  const data = Object.assign({}, store);
  const listeners = [];
  return {
    _data: data,
    runtime: {
      getManifest: () => ({ version: '3.0.0', update_url: 'https://clients2.google.com/x' }),
      onMessage: { addListener() {} },
      sendMessage: () => Promise.resolve({ success: false }),
      getURL: p => p,
      lastError: null,
    },
    storage: {
      local: {
        get: keys => {
          const list = Array.isArray(keys) ? keys : (typeof keys === 'string' ? [keys] : Object.keys(keys || data));
          const out = {};
          list.forEach(k => { if (k in data) out[k] = data[k]; });
          return Promise.resolve(out);
        },
        set: obj => { Object.assign(data, obj); return Promise.resolve(); },
        remove: k => { delete data[k]; return Promise.resolve(); },
      },
      onChanged: { addListener: fn => listeners.push(fn) },
    },
    tabs: {
      query: () => Promise.resolve([{ id: 1, url: 'https://rig.ai/' }]),
      get: () => Promise.resolve({ id: 1, url: 'https://rig.ai/' }),
      sendMessage: () => Promise.resolve({ success: false }),
      onActivated: { addListener() {} },
      onUpdated: { addListener() {} },
    },
    scripting: { executeScript: () => Promise.resolve([]) },
    sidePanel: { open: () => Promise.resolve() },
  };
}

// Boots one panel. `surface` is 'sidepanel' or 'popup'.
//
// Takes the test context so the jsdom window is closed when the test ends. The
// panel starts a 30s session-status ticker exactly as it does in Chrome, and a
// pending interval keeps Node alive forever — an unclosed window hangs the run
// rather than failing it.
async function boot(t, o) {
  const opts = o || {};
  const dom = new JSDOM(
    `<!doctype html><html><body data-context="${opts.surface || 'sidepanel'}">`
    + '<div class="app"></div></body></html>',
    { pretendToBeVisual: true, url: 'https://example.org/' });

  const win = dom.window;
  const captured = { downloads: [], warnings: [], clipboard: [] };

  win.chrome = makeChrome(opts.storage || {});
  win.self = win;
  win.console = { warn: (...a) => captured.warnings.push(a.join(' ')), log() {}, error() {}, debug() {} };
  win.URL.createObjectURL = () => 'blob:stub';
  win.URL.revokeObjectURL = () => {};
  win.navigator.clipboard = { writeText: t => { captured.clipboard.push(t); return Promise.resolve(); } };
  win.fetch = () => Promise.reject(new Error('offline in tests'));

  // Downloads are the one side effect worth recording rather than performing.
  const realCreate = win.document.createElement.bind(win.document);
  win.document.createElement = tag => {
    const el = realCreate(tag);
    if (String(tag).toLowerCase() === 'a') {
      el.click = () => captured.downloads.push({ name: el.download, href: el.href });
    }
    return el;
  };

  const ctx = vm.createContext(win);
  LIBS.forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  });

  await new Promise((resolve, reject) => {
    ctx.__done = resolve; ctx.__fail = reject;
    vm.runInContext(
      `initUI({surface:${JSON.stringify(opts.surface || 'sidepanel')}}).then(__done, __fail);`, ctx);
  });

  const $ = sel => win.document.querySelector(sel);
  const $$ = sel => [...win.document.querySelectorAll(sel)];
  const click = sel => {
    const el = $(sel);
    assert.ok(el, `nothing matches ${sel}`);
    el.dispatchEvent(new win.Event('click', { bubbles: true }));
  };
  const text = () => win.document.body.textContent.replace(/\s+/g, ' ').trim();

  // Hands the panel a real capture without going through chrome messaging.
  const analyze = name => {
    ctx.__cap = fixture(name);
    vm.runInContext('state.lastAnalyzedData = __cap; showResult("## A\\n## B\\ntext", __cap, "page", null, false);', ctx);
  };

  if (t && typeof t.after === 'function') {
    t.after(() => { try { win.close(); } catch (e) { /* already gone */ } });
  }
  return { dom, win, ctx, $, $$, click, text, analyze, captured,
           run: code => vm.runInContext(code, ctx) };
}

// ── shell (§3) ────────────────────────────────────────────────────────────

test('the side panel is a header, one scrolling area, and a sticky tab bar', async t => {
  const p = await boot(t);
  assert.ok(p.$('.vd-header'), 'no header');
  assert.ok(p.$('.vd-main'), 'no content area');
  assert.ok(p.$('.vd-tabbar'), 'no tab bar');

  // Exactly the six tabs of §3, in order.
  assert.deepEqual(p.$$('.vd-tab').map(t => t.dataset.tab),
    ['overview', 'colors', 'type', 'components', 'motion', 'settings']);

  // §3: the header carries navigation for nothing — only status and re-run.
  assert.equal(p.$$('.vd-header button').length, 1);
  assert.ok(p.$('#vdReanalyze').hidden, 'nothing to re-analyze yet');
});

test('category tabs are dimmed until an analysis exists, and say so when tapped', async t => {
  const p = await boot(t);
  const dim = p.$$('.vd-tab.is-dim').map(t => t.dataset.tab);
  assert.deepEqual(dim, ['colors', 'type', 'components', 'motion'],
    'the four category tabs are the ones that need a model');

  p.click('[data-tab="colors"]');
  assert.equal(p.run('state.tab'), 'overview', 'a dimmed tab must not become active');
  assert.match(p.text(), /Analyze this page first/);

  p.analyze('rig-ai');
  assert.equal(p.$$('.vd-tab.is-dim').length, 0, 'tabs open up once there is a model');
  p.click('[data-tab="colors"]');
  assert.equal(p.run('state.tab'), 'colors');
});

test('Home shows one primary action and no settings whatsoever', async t => {
  const p = await boot(t);
  // §11 squint test: exactly one primary button on the screen.
  assert.equal(p.$$('.vd-btn--primary').length, 1);
  assert.equal(p.$('#analyzeBtn').textContent.trim(), 'Analyze page');

  // §11 settings test: no key, provider, model or developer row on Home.
  assert.equal(p.$('#apiKeyInput'), null, 'an API key field is on the main flow');
  assert.equal(p.$('#vdProviderSelect'), null, 'a provider select is on the main flow');
  assert.equal(p.$('#settingsDev'), null, 'the Developer section is on the main flow');
  const onScreen = p.text();
  ['Paid.', 'RAW', 'of 5 free', 'GLOBAL TOKENS', 'FULL PAGE']
    .forEach(gone => assert.ok(!onScreen.includes(gone), `"${gone}" still appears on Home`));
});

test('choosing Element changes the action and its explanation', async t => {
  const p = await boot(t);
  p.click('[data-mode="element"]');
  assert.equal(p.$('#analyzeBtn').textContent.trim(), 'Pick element');
  assert.match(p.text(), /Pick an element on the page/);
});

// ── Overview after analysis (§4.2) ────────────────────────────────────────

test('Overview leads with the numbers, the palette and Export', async t => {
  const p = await boot(t);
  p.analyze('rig-ai');

  const stats = p.$$('.vd-stat__label').map(e => e.textContent);
  assert.deepEqual(stats, ['Colors', 'Fonts', 'Comps', 'Keyframes']);
  // Never a zero: a tile with no number is not drawn at all.
  p.$$('.vd-stat__value').forEach(v =>
    assert.ok(Number(v.textContent) > 0, 'a zero reads as a measurement'));

  assert.ok(p.$('.vd-swatches'), 'no palette strip');
  assert.equal(p.$$('.vd-swatch').length, p.run('state.model.colorRoles.length'));
  assert.ok(p.$('#vdExportCard'), 'no Export card');
  assert.match(p.text(), /Snapshot/);
  assert.match(p.text(), /Layout/);

  // §11 squint test after analysis: one primary button, and it is Export.
  assert.equal(p.$$('.vd-btn--primary').length, 1);
  assert.equal(p.$('#vdExportBtn').textContent.trim(), 'Copy prompt');
});

test('the header reports the domain and what has happened to it', async t => {
  const p = await boot(t);
  assert.match(p.$('#urlBadge').textContent, /^rig\.ai · Ready$/);
  p.analyze('rig-ai');
  assert.match(p.$('#urlBadge').textContent, /^rig\.ai · Analyzed \d{1,2}:\d{2}/);
  assert.ok(!p.$('#vdReanalyze').hidden, 're-analyze appears once there is a result');
});

test('category tabs are full lists, and every row is the same component', async t => {
  const p = await boot(t);
  p.analyze('rig-ai');
  const roles = p.run('state.model.colorRoles.length');

  p.click('[data-tab="colors"]');
  assert.equal(p.$$('.vd-kv').length >= roles, true, 'Colors is not the full list');
  assert.match(p.text(), /Contrast/);
  assert.ok(p.$('.vd-section__action'), 'no Export ▸ shortcut');

  p.click('[data-tab="type"]');
  assert.match(p.text(), /open \(Google Fonts\)/);
  assert.match(p.text(), /Scale/);

  p.click('[data-tab="components"]');
  assert.match(p.text(), /chamfered/);

  p.click('[data-tab="motion"]');
  assert.match(p.text(), /States — measured/);
  assert.match(p.text(), /States — recommended, not observed/);
});

test('the Export shortcut on a category tab returns to the card', async t => {
  const p = await boot(t);
  p.analyze('rig-ai');
  p.click('[data-tab="colors"]');
  p.click('[data-action="gotoExport"]');
  assert.equal(p.run('state.tab'), 'overview');
  assert.ok(p.$('#vdExportCard'));
});

// ── the removals (§3) ─────────────────────────────────────────────────────

test('everything §3 removes is gone from the main flow', async t => {
  const p = await boot(t, { storage: { apiKeys: { gemini: 'k' }, vd_ai_enabled: true } });
  p.analyze('rig-ai');
  const html = p.win.document.body.innerHTML;
  [
    ['outputTabs', 'the FULL PAGE / GLOBAL TOKENS tabs'],
    ['vd-usage-container', 'the free-prompt counter'],
    ['versionBadge', 'the version chip in the header'],
    ['settingsToggle', 'the header settings icon'],
    ['historyToggle', 'the header history icon'],
    ['providerTabs', 'the inline provider block'],
  ].forEach(([id, what]) => assert.ok(!html.includes(id), `${what} is still rendered`));
});

// ── Export card (§4.2) ────────────────────────────────────────────────────

test('the Export card has one primary button whose label follows the output', async t => {
  const p = await boot(t);
  p.analyze('rig-ai');

  const labels = { prompt: 'Copy prompt', 'design-md': 'Download DESIGN.md', skill: 'Download Skill' };
  const helps = {
    prompt: 'Rebuild this page in a chat tool.',
    'design-md': 'A style guide your project keeps.',
    skill: 'DESIGN.md + tokens, packaged for coding agents.',
  };
  Object.keys(labels).forEach(output => {
    p.click(`[data-output="${output}"]`);
    assert.equal(p.$('#vdExportBtn').textContent.trim(), labels[output]);
    assert.match(p.text(), new RegExp(helps[output].replace(/[.+]/g, '\\$&')));
    // §1.1: still exactly one primary button on the screen.
    assert.equal(p.$$('.vd-btn--primary').length, 1, `${output} added a second primary action`);
  });
});

test('the target select belongs to Prompt, and "Where to put it" to the others', async t => {
  const p = await boot(t);
  p.analyze('rig-ai');

  assert.ok(p.$('#vdTargetSelect'), 'Prompt has no target select');
  assert.equal(p.$('#vdWhere'), null, 'Prompt must not offer "Where to put it"');

  p.click('[data-output="design-md"]');
  assert.equal(p.$('#vdTargetSelect'), null, 'a target makes no sense for a file');
  assert.ok(p.$('#vdWhere'), 'DESIGN.md has no "Where to put it"');

  // One line per tool, all thirteen named in §10.3.
  const tools = p.$$('#vdWhere .vd-where__row').map(r => r.firstChild.textContent.trim());
  ['Claude Code', 'Cursor', 'Codex', 'Stitch', 'Antigravity', 'Gemini CLI', 'Kiro',
   'Lovable', 'v0', 'Bolt', 'Replit', 'Claude Design', 'Figma Make']
    .forEach(tool => assert.ok(tools.includes(tool), `${tool} is missing`));
});

test('Focus is collapsed under Refine and moves the meta line', async t => {
  const p = await boot(t);
  p.analyze('rig-ai');

  const refine = p.$('#vdRefine');
  assert.ok(refine, 'no Refine disclosure');
  assert.equal(refine.tagName, 'DETAILS');
  assert.ok(!refine.open, 'Focus must start collapsed — it is refinement, not the main path');
  assert.equal(p.$$('#vdRefine .vd-chip').length, 7);

  const before = p.$('.vd-card__meta').textContent;
  p.click('[data-focus="layout"]');
  assert.equal(p.run('state.focus'), 'layout');
  assert.notEqual(p.$('.vd-card__meta').textContent, before,
    'narrowing the focus must change the reported size');
  assert.match(p.$('.vd-card__meta').textContent, /\d+ sections · [\d.]+k chars/);
});

test('Refine is Prompt-only — a file has no focus', async t => {
  const p = await boot(t);
  p.analyze('rig-ai');
  p.click('[data-output="skill"]');
  assert.equal(p.$('#vdRefine'), null);
  assert.equal(p.$$('.vd-chip').length, 0);
});

test('Download Skill produces a real zip, through the real panel', async t => {
  const p = await boot(t);
  p.analyze('rig-ai');
  p.click('[data-output="skill"]');
  p.click('#vdExportBtn');

  assert.deepEqual(p.captured.warnings, [], 'the export warned instead of working');
  assert.equal(p.captured.downloads.length, 1, 'no download was started');
  assert.equal(p.captured.downloads[0].name, 'design-rig-ai.zip');
});

test('Copy prompt puts the prompt on the clipboard', async t => {
  const p = await boot(t);
  p.analyze('rig-ai');
  p.click('[data-output="prompt"]');
  p.click('#vdExportBtn');
  assert.equal(p.captured.clipboard.length, 1);
  assert.match(p.captured.clipboard[0], /^## A/);
});

test('Preview is a sheet, not the default view', async t => {
  const p = await boot(t);
  p.analyze('rig-ai');
  assert.ok(p.$('#vdPreviewSheet').hidden, 'the raw dump must not be the default screen');
  p.click('[data-action="previewRaw"]');
  assert.ok(!p.$('#vdPreviewSheet').hidden);
  assert.match(p.$('#promptOutput').textContent, /^## A/);
  p.click('#vdPreviewClose');
  assert.ok(p.$('#vdPreviewSheet').hidden);
});

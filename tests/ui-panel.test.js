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

// ── Settings tab (§4.3) ───────────────────────────────────────────────────

test('Settings is a tab, holding everything the main flow gave up', async t => {
  const p = await boot(t);
  p.click('[data-tab="settings"]');
  const text = p.text();
  ['Account', 'AI enhancement', 'Defaults', 'History', 'About']
    .forEach(block => assert.match(text, new RegExp(block), `${block} is missing from Settings`));
  assert.match(text, /VibeDesign 3\.0\.0/, 'the version moved here, not away');
  // Settings is a tab, not a sheet — it renders into the panel like any other.
  assert.ok(p.$('#vdPanel').textContent.includes('Defaults'));
});

test('with AI enhancement off, provider, model and key are not on screen', async t => {
  const p = await boot(t, { storage: { vd_ai_enabled: false } });
  p.click('[data-tab="settings"]');
  assert.equal(p.$('#vdProviderSelect'), null);
  assert.equal(p.$('#vdModelSelect'), null);
  assert.equal(p.$('#apiKeyInput'), null);
  assert.match(p.text(), /Optional\. Improves the prompt's direction paragraph\./);

  // Turning it on reveals exactly those three.
  const toggle = p.$('#vdAiToggle');
  toggle.checked = true;
  toggle.dispatchEvent(new p.win.Event('change', { bubbles: true }));
  await new Promise(r => setImmediate(r));
  assert.ok(p.$('#vdProviderSelect'), 'the provider select did not appear');
  assert.ok(p.$('#vdModelSelect'));
  assert.ok(p.$('#apiKeyInput'));
});

test('model choice is a select, not a chip (§8)', async t => {
  // §11's component test. The old panel drew provider, model, mode and focus
  // with the same chip, so nothing on screen said which was which.
  const p = await boot(t, { storage: { vd_ai_enabled: true, provider: 'claude', apiKeys: { claude: 'k' } } });
  p.click('[data-tab="settings"]');

  assert.equal(p.$('#vdModelSelect').tagName, 'SELECT');
  assert.equal(p.$('#vdProviderSelect').tagName, 'SELECT');
  assert.equal(p.$$('#vdPanel .vd-chip').length, 0, 'Settings must contain no filter chips');
  assert.equal(p.$$('#vdPanel .vd-seg').length, 0, 'Settings must contain no mode switches');
});

test('a stored key is masked, and Change forgets it rather than revealing it', async t => {
  const p = await boot(t, { storage: { vd_ai_enabled: true, provider: 'claude', apiKeys: { claude: 'sk-secret-value' } } });
  p.click('[data-tab="settings"]');

  assert.match(p.text(), /••••/);
  assert.ok(!p.text().includes('sk-secret-value'), 'the key is printed on screen');
  assert.equal(p.$('#apiKeyInput'), null, 'a stored key must not sit in an input');

  p.click('#vdChangeKey');
  await new Promise(r => setImmediate(r));
  assert.ok(p.$('#apiKeyInput'), 'Change did not bring the input back');
  assert.equal(p.$('#apiKeyInput').value, '', 'Change revealed the old key instead of forgetting it');
});

// The model nudge moved here from the main flow. It is the same behaviour —
// one dismissible line — asserted where the feature now lives.
test('the model nudge is one dismissible line inside Settings', async t => {
  const p = await boot(t, {
    storage: {
      vd_ai_enabled: true, provider: 'claude', apiKeys: { claude: 'k' },
      selectedModels: { claude: 'claude-haiku-4-5-20251001' },
    },
  });
  p.click('[data-tab="settings"]');

  const nudge = p.$('#vdModelNudge');
  if (!nudge) {
    // The nudge only fires when the chosen model is behind the newest one.
    // If the curated list ever makes that impossible, say so rather than
    // passing quietly.
    const notice = p.run('JSON.stringify(computeModelNotice("claude"))');
    assert.fail(`no nudge rendered; computeModelNotice returned ${notice}`);
  }
  assert.match(nudge.textContent, /Newer model available/);
  assert.ok(nudge.querySelector('[data-action="switchModel"]'), 'no Switch action');
  assert.ok(nudge.querySelector('[data-action="dismissNudge"]'), 'the nudge cannot be dismissed');

  // It is inside Settings and nowhere else.
  p.click('[data-tab="overview"]');
  assert.equal(p.$('#vdModelNudge'), null, 'the nudge leaked back into the main flow');
});

test('dismissing the nudge is remembered', async t => {
  const p = await boot(t, {
    storage: {
      vd_ai_enabled: true, provider: 'claude', apiKeys: { claude: 'k' },
      selectedModels: { claude: 'claude-haiku-4-5-20251001' },
    },
  });
  p.click('[data-tab="settings"]');
  assert.ok(p.$('#vdModelNudge'));
  p.click('[data-action="dismissNudge"]');
  await new Promise(r => setImmediate(r));
  assert.equal(p.$('#vdModelNudge'), null, 'the nudge survived being dismissed');
  const stored = p.win.chrome._data.vd_nudge_dismissed;
  assert.ok(stored && Object.keys(stored).length, 'the dismissal was not persisted');
});

// The Developer gate moved here too — same rule, asserted on rendered output
// rather than by grepping a template literal.
test('the Developer section renders only on an unpacked build', async t => {
  const packaged = await boot(t);
  packaged.click('[data-tab="settings"]');
  assert.equal(packaged.$('#settingsDev'), null,
    'a packaged build must not show Copy RAW capture');
  assert.ok(!packaged.text().includes('RAW'));

  // An unpacked build has no update_url in its manifest.
  const unpacked = await boot(t);
  unpacked.run('chrome.runtime.getManifest = () => ({ version: "3.0.0" });');
  unpacked.click('[data-tab="settings"]');
  assert.ok(unpacked.$('#settingsDev'), 'the Developer section is missing when unpacked');
  assert.match(unpacked.text(), /Copy RAW capture/);
});

test('History lives in Settings, with the long list behind a sheet', async t => {
  const p = await boot(t, {
    storage: {
      promptHistory: {
        a: { domain: 'linear.app', savedAt: Date.now() - 7200000, prompt: '## x', focus: 'all', source: 'page' },
        b: { domain: 'vibedesign.tech', savedAt: Date.now() - 86400000, prompt: '## y', focus: 'colors', source: 'page' },
      },
    },
  });
  p.click('[data-tab="settings"]');
  assert.match(p.text(), /linear\.app/);
  assert.ok(p.$('[data-action="openHistory"]'), 'no See all');

  assert.ok(p.$('#vdHistorySheet').hidden);
  p.click('[data-action="openHistory"]');
  assert.ok(!p.$('#vdHistorySheet').hidden, 'See all did not open the sheet');
});

test('Recent appears on Home only when there is something to show', async t => {
  const empty = await boot(t);
  assert.ok(!empty.text().includes('Recent'), 'an empty Recent block was drawn anyway');

  const withHistory = await boot(t, {
    storage: {
      promptHistory: {
        a: { domain: 'linear.app', savedAt: Date.now() - 7200000, prompt: '## x', source: 'page' },
      },
    },
  });
  assert.match(withHistory.text(), /Recent/);
  assert.match(withHistory.text(), /linear\.app/);
});

test('no real email address appears anywhere in the panel', async t => {
  // §4.3's mock-up shows a personal address. Using it in a fixture would put a
  // private address into the repo and into every snapshot.
  const p = await boot(t, { storage: { vd_ai_enabled: true } });
  ['overview', 'settings'].forEach(tab => {
    p.click(`[data-tab="${tab}"]`);
    const html = p.win.document.body.innerHTML;
    assert.ok(!/slnsenturk/i.test(html), `a real address is rendered on ${tab}`);
    const emails = html.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
    emails.forEach(e => assert.equal(e, TEST_EMAIL, `unexpected address ${e} on ${tab}`));
  });
});

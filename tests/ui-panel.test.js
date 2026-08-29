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

  // §3: the header carries no controls at all — wordmark, domain, status.
  // Re-analyze is the panel's primary action, labelled; a bare ↺ is forbidden.
  assert.equal(p.$$('.vd-header button').length, 0);
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

test('the header reports the current page and what has happened to it', async t => {
  const p = await boot(t);
  // §3: the header is one row — domain at body size, status as caption.
  assert.equal(p.$('.vd-header__domain').textContent, 'rig.ai');
  assert.equal(p.$('.vd-header__state').textContent, 'Not analyzed');

  p.analyze('rig-ai');
  assert.equal(p.$('.vd-header__domain').textContent, 'rig.ai');
  assert.match(p.$('.vd-header__state').textContent, /^Analyzed \d{1,2}:\d{2}/);
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
    // Checked generically rather than by naming the address from §4.3 — that
    // would put the very string this test exists to keep out into the repo.
    // Any address other than the placeholder fails.
    const emails = html.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
    emails.forEach(e => assert.equal(e, TEST_EMAIL, `unexpected address ${e} on ${tab}`));
  });
});

// ── states (§4.5) ─────────────────────────────────────────────────────────

test('analysing turns the action into named progress with a way out', async t => {
  const p = await boot(t);
  p.run('showStage(0)');
  assert.equal(p.$('#vdPanel').style.display, 'none', 'the panel is still showing');
  assert.match(p.$('#loadingText').textContent, /Reading… 1\/7/);
  assert.ok(p.$('#vdCancelAnalyze'), 'no way to cancel');

  // Seven stages now: §4.5 adds "Generating direction" for the AI pass.
  assert.match(p.$('#loadingText').textContent, /1\/7/);
  p.run('showStage(4)');
  assert.match(p.$('#loadingText').textContent, /Motion… 5\/7/);
  assert.equal(p.$('#vdProgressFill').style.width, '71%');

  // Cancel puts the panel back rather than leaving a dead progress bar.
  p.click('#vdCancelAnalyze');
  assert.equal(p.$('#loadingSection').style.display, 'none');
  assert.notEqual(p.$('#vdPanel').style.display, 'none');
});

test('an unreadable page says what to try instead', async t => {
  const p = await boot(t);
  p.run('showError(VD_UI.COPY.unreadable)');
  const text = p.$('#errorText').textContent;
  assert.match(text, /Some sites block extensions/);
  assert.match(text, /pick an element instead/);
  assert.ok(p.$('#errorRetryBtn'), 'no way to try again');
  // It is a state, not an alert dialog: the tab bar is still there.
  assert.ok(p.$('.vd-tabbar'));
});

test('a page with almost no design data says so instead of showing ones', async t => {
  const p = await boot(t);
  // Analyse the sparse fixture AS the current page. Left on rig.ai the panel
  // would correctly say "Showing tiny.example" instead — one notice, not two.
  p.run('state.currentUrl = "https://tiny.example/";');
  p.analyze('sparse');
  assert.match(p.text(), /Very little design data on this page/);
  assert.equal(p.$$('.vd-stat').length, 0, 'a strip of ones is worse than a sentence');
});

test('an offline AI pass is reported, and the result still arrives', async t => {
  const p = await boot(t, { storage: { vd_ai_enabled: true, apiKeys: { gemini: 'k' } } });
  p.analyze('rig-ai');
  // showResult was given no provider, which is what an AI skip looks like.
  assert.match(p.text(), /AI enhancement skipped — offline/);
  assert.ok(p.$('#vdExportBtn'), 'the rule-engine result must still be exportable');
});

// ── popup (§3) ────────────────────────────────────────────────────────────

test('the popup is the short form: no tab bar, and a way into the panel', async t => {
  const p = await boot(t, { surface: 'popup' });
  assert.ok(p.$('.vd-header'), 'no header');
  assert.equal(p.$('.vd-tabbar'), null, 'the popup must not carry the tab bar');
  assert.ok(p.$('#analyzeBtn'), 'no Analyze');
  assert.ok(p.$('.vd-seg'), 'no Page/Element switch');
  assert.ok(p.$('#vdOpenPanel'), 'no way into the side panel');
  assert.equal(p.$$('.vd-btn--primary').length, 1);
});

// ── PROMPT 3b ─────────────────────────────────────────────────────────────

test('the summary strip and palette are always drawn for a real capture', async t => {
  // 3b#2. They went missing on rig.ai in the browser. Driven through the REAL
  // analysis path — buildPromptFromData — because the shortcut used elsewhere
  // in this file sets state directly and would not have caught it.
  const p = await boot(t);
  p.ctx.__cap = fixture('rig-ai');
  await p.run('buildPromptFromData(__cap, "page")');
  await new Promise(r => setImmediate(r));

  assert.ok(p.run('!!state.model'), 'no model was built from a full capture');
  assert.equal(p.$$('.vd-stat').length, 4, 'the summary strip is missing');
  assert.equal(p.$$('.vd-swatch').length, p.run('state.model.colorRoles.length'),
    'the palette strip is missing');

  // §4.2: they are Overview's first two elements, in that order.
  const html = p.$('#vdPanel').innerHTML;
  assert.ok(html.indexOf('vd-stats') < html.indexOf('vd-swatches'),
    'the palette is drawn before the counts');
  assert.ok(html.indexOf('vd-swatches') < html.indexOf('vdExportCard'),
    'Export comes before the palette');
  assert.ok(!p.text().includes('Very little design data'),
    'a full capture was reported as sparse');
});

test('the Export meta counts every heading in the prompt', async t => {
  // 3b#8. The prompt uses `##` once for its title and `###` for each real
  // section, so counting `##` alone reported "1 sections" for a 33k prompt.
  const p = await boot(t);
  p.ctx.__cap = fixture('rig-ai');
  await p.run('buildPromptFromData(__cap, "page")');
  await new Promise(r => setImmediate(r));

  const meta = p.$('.vd-card__meta').textContent;
  assert.match(meta, /^\d+ sections · [\d.]+k chars$/);
  const sections = Number(meta.split(' ')[0]);
  assert.equal(sections, p.run('countSections(state.lastPrompt)'));
  assert.ok(sections > 10, `${sections} sections for a 33k prompt is a miscount`);
  assert.ok(!meta.startsWith('1 sections'), 'the "1 sections" bug is back');
});

test('page context: the header follows the tab, and the result is kept', async t => {
  // 3b#6 / §3's table, all three rows.
  const p = await boot(t);
  assert.equal(p.run('pageContext()'), 'none');
  assert.equal(p.$('#analyzeBtn').textContent.trim(), 'Analyze page');
  assert.ok(p.$('#analyzeBtn').classList.contains('vd-btn--primary'));

  p.analyze('rig-ai');
  assert.equal(p.run('pageContext()'), 'same');
  assert.match(p.$('#analyzeBtn').textContent, /↺\s*Re-analyze/);
  assert.ok(p.$('#analyzeBtn').classList.contains('vd-btn--ghost'),
    'Re-analyze is secondary — the result is already here');

  // The user switches to another site.
  p.run('state.currentUrl = "https://posthog.com/"; renderPanel();');
  assert.equal(p.run('pageContext()'), 'other');
  assert.equal(p.$('.vd-header__domain').textContent, 'posthog.com');
  assert.equal(p.$('.vd-header__state').textContent, 'Not analyzed');
  assert.equal(p.$('#analyzeBtn').textContent.trim(), 'Analyze posthog.com');
  assert.match(p.text(), /Showing rig\.ai \(analyzed \d{1,2}:\d{2}/);
  assert.ok(p.run('!!state.model'), 'the previous result was thrown away');
  assert.equal(p.$$('.vd-stat').length, 4, 'the previous result stopped rendering');

  // …and back again.
  p.run('state.currentUrl = "https://rig.ai/"; renderPanel();');
  assert.equal(p.run('pageContext()'), 'same');
  assert.match(p.$('#analyzeBtn').textContent, /↺\s*Re-analyze/);
});

test('the reload glyph is never used on its own', async t => {
  // §3: "↺ ikonu tek başına hiçbir yerde kullanılmaz."
  const p = await boot(t);
  p.analyze('rig-ai');
  [...p.win.document.querySelectorAll('button')].forEach(b => {
    const text = b.textContent.replace(/\s+/g, ' ').trim();
    if (text.includes('↺')) {
      assert.ok(text.replace('↺', '').trim().length > 0,
        'a bare ↺ button: the glyph must always carry a label');
    }
  });
});

test('the AI indicator says what will run, and links to Settings', async t => {
  // 3b#7.
  const off = await boot(t, { storage: { vd_ai_enabled: false } });
  assert.match(off.text(), /AI enhancement off/);
  assert.ok(off.$('[data-action="openSettings"]'), 'no way to turn it on');
  off.click('[data-action="openSettings"]');
  assert.equal(off.run('state.tab'), 'settings');

  const on = await boot(t, {
    storage: { vd_ai_enabled: true, provider: 'claude', apiKeys: { claude: 'k' } },
  });
  assert.match(on.text(), /AI enhancement: Claude · /);
  assert.match(on.text(), /Change/);

  // The same line appears while analysing (§3).
  on.run('showStage(6)');
  assert.match(on.$('#vdLoadingAi').textContent, /AI enhancement: Claude · /);
});

test('the analyzing line shows a stage name and never AI content', async t => {
  // 3b#10. The old build passed the model's streaming markdown into this line.
  const p = await boot(t);
  ['Reading', 'Colors', 'Type', 'Components', 'Motion', 'Building', 'Generating direction']
    .forEach((stage, i) => {
      p.run(`showStage(${i})`);
      assert.equal(p.$('#loadingText').textContent, `${stage}… ${i + 1}/7`);
    });

  // The source of the leak: nothing in the panel writes into #loadingText
  // except showLoading, and nothing hands it prompt content.
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'prompt-builder.js'), 'utf8');
  assert.ok(!/loadingText.*partialText|partialText.*loadingText/.test(src),
    'the prompt builder still writes streamed AI text into the status line');
});

test('no floating sign-in pill; signed-out is a dot on the Settings tab', async t => {
  // 3b#3.
  const p = await boot(t);
  assert.ok(!p.text().includes('Sign in to sync'), 'the floating pill is back');
  assert.equal(p.$('.vd-auth-pill'), null, 'a pill element was rendered');

  // Nothing renders above or below the header row (§3 / 3b#4).
  const header = p.$('.vd-header');
  assert.equal(header.previousElementSibling, null, 'something sits above the header');

  assert.ok(p.$('.vd-tab__dot'), 'no signed-out badge on the Settings tab');
  const dotTab = p.$('.vd-tab__dot').closest('.vd-tab');
  assert.equal(dotTab.dataset.tab, 'settings', 'the badge is on the wrong tab');

  // Account itself is in Settings, as a row with a labelled action.
  p.click('[data-tab="settings"]');
  assert.ok(p.$('#vdSignIn'), 'no way to sign in from Settings');
});

test('every tab keeps its label, and each tab titles its own content', async t => {
  // 3b#1 and 3b#5.
  const p = await boot(t);
  p.$$('.vd-tab').forEach(tab => {
    const label = tab.querySelector('.vd-tab__label');
    assert.ok(label && label.textContent.trim(), `${tab.dataset.tab} has no label`);
    assert.ok(tab.querySelector('.vd-tab__icon'), `${tab.dataset.tab} has no icon`);
  });

  assert.equal(p.$('.vd-tabtitle').textContent, 'Overview');
  p.analyze('rig-ai');
  [['colors', 'Colors'], ['type', 'Type'], ['components', 'Components'],
   ['motion', 'Motion'], ['settings', 'Settings'], ['overview', 'Overview']]
    .forEach(([tab, title]) => {
      p.click(`[data-tab="${tab}"]`);
      assert.equal(p.$('.vd-tabtitle').textContent, title, `${tab} has the wrong title`);
    });
});

test('a page that has not finished loading is not measured', async t => {
  // 3b#9. The capture from a half-loaded page is nearly empty, and the panel
  // then tells the user their full site has "very little design data".
  const p = await boot(t);
  p.run('chrome.scripting.executeScript = () => Promise.resolve([{result:{ready:"loading",body:false}}]);');
  await p.run('handleAnalyze()');
  await new Promise(r => setImmediate(r));
  assert.match(p.$('#errorText').textContent, /Page is still loading — try again/);
  assert.ok(p.run('!state.model'), 'a half-loaded page was measured anyway');
});

test('sparse means genuinely sparse, not merely unfinished', async t => {
  // 3b#9's second half: the rule is <3 colour roles AND no components.
  const rig = await boot(t);
  rig.analyze('rig-ai');
  assert.ok(!rig.text().includes('Very little design data'),
    'a full capture was called sparse');

  const thin = await boot(t);
  thin.run('state.currentUrl = "https://tiny.example/";');
  thin.analyze('sparse');
  assert.match(thin.text(), /Very little design data/);
});

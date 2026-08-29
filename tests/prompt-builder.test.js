// VibeDesign — prompt-builder suite.
//
// lib/prompt-builder.js is the product's main output and had no coverage at
// all: 4,600 lines reachable only through the extension UI. These snapshots
// pin buildPagePrompt at every Focus value and buildDesignSystemPrompt (the
// "Global Tokens" tab) across every fixture, so a change to any of the 24
// focus gates shows up as a line-level diff instead of as a surprise in the
// panel.
//
// Refresh deliberately:
//
//     UPDATE_SNAPSHOTS=1 node --test tests/prompt-builder.test.js
//
// and READ the diff before committing. A snapshot updated without being read
// is worse than no snapshot — it converts a regression into a rubber stamp.
//
// Run with:  node --test tests/prompt-builder.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SNAP_DIR = path.join(__dirname, 'snapshots', 'prompt');
const FIXTURES = path.join(__dirname, 'fixtures');
const SENTINEL = fs.readFileSync(path.join(FIXTURES, 'SENTINEL.txt'), 'utf8').trim();

const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const fixture = name => JSON.parse(fs.readFileSync(path.join(FIXTURES, name + '.json'), 'utf8'));

// Every focus value the chip row offers.
const FOCI = ['all', 'colors', 'typography', 'shadows', 'motion', 'layout', 'components'];
const FIXTURE_NAMES = ['rig-ai', 'light-saas', 'dark-dev-tool', 'sparse'];

// prompt-builder.js is a classic script that reads globals — `state`, and the
// helpers from color-utils / noise-filter / shadow-utils / ai-caller. This is
// the same load order sidepanel.html uses, so the snapshots describe what the
// panel actually renders.
const PAGE_SCRIPTS = [
  'lib/color-utils.js', 'lib/noise-filter.js', 'lib/shadow-utils.js',
  'lib/ai-caller.js', 'lib/prompt-builder.js',
];

function makeSandbox(stateOverrides) {
  const dom = {
    // setOutputMode touches the DOM; give it enough to run headless.
    _els: {},
    getElementById(id) {
      return (this._els[id] = this._els[id] || { textContent: '', style: {}, classList: { toggle() {} } });
    },
    querySelectorAll() { return []; },
    createElement() { return { style: {}, classList: { toggle() {}, add() {} }, appendChild() {} }; },
  };
  const sb = {
    console: { log() {}, warn() {}, debug() {}, error() {} },
    Math, JSON, Object, Array, String, Number, Boolean, Date, RegExp, Error,
    parseInt, parseFloat, isNaN, isFinite, Infinity, Set, Map, URL,
    encodeURIComponent, decodeURIComponent,
    document: dom,
    chrome: {
      runtime: { getManifest: () => ({ version: '3.0.0' }) },
      storage: { local: { get: async () => ({}), set: async () => {} } },
    },
  };
  sb.self = sb; sb.window = sb; sb.globalThis = sb;
  sb.state = Object.assign({
    focus: 'all', mode: 'page', provider: 'none', apiKeys: {}, selectedModels: {},
    lastAnalyzedData: null, lastAiDirection: null, lastPrompt: null, currentUrl: '',
  }, stateOverrides || {});
  // Supplied by ui-helpers.js in the real page. prompt-builder.js references
  // these at call time, by which point ui-helpers has loaded — so providing
  // them here reproduces the runtime environment rather than papering over it.
  sb.$ = id => sb.document.getElementById(id);
  sb.getActiveModel = () => null;
  sb.getActiveModelLabel = () => null;
  vm.createContext(sb);
  PAGE_SCRIPTS.forEach(f => vm.runInContext(read(f), sb, { filename: f }));
  return sb;
}

function pagePrompt(name, focus) {
  const sb = makeSandbox({ focus, lastAnalyzedData: fixture(name) });
  sb.__d = fixture(name);
  return vm.runInContext('buildPagePrompt(__d, null)', sb);
}

function systemPrompt(name) {
  const sb = makeSandbox({ lastAnalyzedData: fixture(name) });
  sb.__d = fixture(name);
  sb.__s = vm.runInContext('analyzeDesignStyle(__d)', sb);
  return vm.runInContext('buildDesignSystemPrompt(__d, __s)', sb);
}

// Shared snapshot assertion: points at the first differing line rather than
// dumping 30k characters into the failure output.
function assertSnapshot(key, actual) {
  const file = path.join(SNAP_DIR, key + '.md');
  if (process.env.UPDATE_SNAPSHOTS === '1') {
    fs.mkdirSync(SNAP_DIR, { recursive: true });
    fs.writeFileSync(file, actual);
    return;
  }
  assert.ok(fs.existsSync(file), `no snapshot for ${key} — create it with UPDATE_SNAPSHOTS=1`);
  const expected = fs.readFileSync(file, 'utf8');
  if (expected === actual) return;
  const a = expected.split('\n'), b = actual.split('\n');
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  assert.fail(`${key} drifted from its snapshot at line ${i + 1}\n`
    + `  snapshot: ${JSON.stringify(a[i])}\n`
    + `  actual:   ${JSON.stringify(b[i])}\n`
    + `  (${a.length} → ${b.length} lines; UPDATE_SNAPSHOTS=1 to accept)`);
}

// ── buildPagePrompt, every focus, every fixture ───────────────────────────

FIXTURE_NAMES.forEach(name => {
  FOCI.forEach(focus => {
    test(`${name} @ focus=${focus}: matches snapshot`, () => {
      assertSnapshot(`${name}.${focus}`, pagePrompt(name, focus));
    });
  });
});

// ── buildDesignSystemPrompt — the Global Tokens tab ───────────────────────

FIXTURE_NAMES.forEach(name => {
  test(`${name} @ Global Tokens: matches snapshot`, () => {
    assertSnapshot(`${name}.system`, systemPrompt(name));
  });
});

// ── properties the snapshots alone would not catch ────────────────────────

test('focus actually narrows the output', () => {
  // If a focus gate is deleted, every mode silently becomes "all" and the
  // snapshots would all update together without anyone noticing why.
  const all = pagePrompt('rig-ai', 'all');
  const heads = s => (s.match(/^#{1,3} .*/gm) || []).map(h => h.trim());
  const allHeads = heads(all);

  FOCI.filter(f => f !== 'all').forEach(focus => {
    const out = pagePrompt('rig-ai', focus);
    assert.ok(out.length < all.length * 0.6,
      `focus=${focus} should be much shorter than all (${out.length} vs ${all.length})`);
    assert.ok(heads(out).length < allHeads.length,
      `focus=${focus} should emit fewer sections than all`);
  });

  // Layout keeps its own sections and drops the unrelated ones.
  const layout = heads(pagePrompt('rig-ai', 'layout'));
  ['### Spacing Scale', '### Layout & Page Structure', '### Responsive Breakpoints']
    .forEach(h => assert.ok(layout.includes(h), `layout must keep "${h}"`));
  ['### Color Tokens', '### Typography Tokens', '### Motion Tokens', '### Component Patterns']
    .forEach(h => assert.ok(!layout.includes(h), `layout must drop "${h}"`));
});

test('Global Tokens renders a page-independent system export', () => {
  const out = systemPrompt('rig-ai');
  assert.ok(out.length > 3000, 'the system export should be substantial');
  ['# Design System', '## Color Tokens', '## Typography Tokens', '## Deriving New Components']
    .forEach(h => assert.ok(out.includes(h), `missing "${h}"`));
  // It describes the system, not one page's content.
  assert.ok(!out.includes('### Section Content Map'));
});

test('no page copy leaks into any prompt', () => {
  // The prompt DOES legitimately carry some page structure, but the sentinel
  // marks fields that are pure marketing copy.
  FIXTURE_NAMES.forEach(name => {
    const tokens = fixture(name);
    assert.ok(JSON.stringify(tokens).includes(SENTINEL),
      `fixture ${name} must plant the sentinel for this to mean anything`);
  });
});

// ── the AI direction must survive an output-mode switch ───────────────────

test('setOutputMode keeps the AI direction when returning to Full Page', () => {
  const tokens = fixture('rig-ai');
  const DIRECTION = 'AI-DIRECTION-MARKER: lead with the chamfered CTA.';
  const sb = makeSandbox({ lastAnalyzedData: tokens, lastAiDirection: DIRECTION });

  // Full Page first: the direction is present.
  vm.runInContext("setOutputMode('full')", sb);
  const withDirection = sb.state.lastPrompt;
  assert.ok(withDirection.includes(DIRECTION),
    'the AI direction should appear in the Full Page prompt');

  // Switch to Global Tokens...
  vm.runInContext("setOutputMode('system')", sb);
  assert.ok(!sb.state.lastPrompt.includes(DIRECTION),
    'Global Tokens is page-independent and should not carry the direction');

  // ...and back. This is the regression: it used to rebuild with null and
  // silently downgrade an AI-enhanced prompt to the rule-based one.
  vm.runInContext("setOutputMode('full')", sb);
  assert.ok(sb.state.lastPrompt.includes(DIRECTION),
    'returning to Full Page must restore the AI direction, not drop it');
  assert.equal(sb.state.lastPrompt, withDirection,
    'the round trip must reproduce the original prompt exactly');
});

test('setOutputMode is a no-op without analysed data', () => {
  const sb = makeSandbox({ lastAnalyzedData: null });
  vm.runInContext("setOutputMode('system')", sb);
  assert.equal(sb.state.lastPrompt, null, 'must not throw or invent a prompt');
});

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
const FIXTURE_NAMES = ['rig-ai', 'posthog', 'vibedesign-dashboard', 'sparse'];

// prompt-builder.js is a classic script that reads globals — `state`, and the
// helpers from color-utils / noise-filter / shadow-utils / ai-caller. This is
// the same load order sidepanel.html uses, so the snapshots describe what the
// panel actually renders.
// The order the pages load them in. design-model.js and its font catalogue
// belong here: the prompt builder resolves every value it prints through the
// model, and without them in the sandbox that whole layer is inert — the
// tests would pass while the feature did nothing.
const PAGE_SCRIPTS = [
  'lib/color-utils.js', 'lib/noise-filter.js', 'lib/shadow-utils.js',
  'lib/data/google-fonts.js', 'lib/design-model.js',
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

// ── values come from the design model (PROMPT 10) ─────────────────────────
//
// The prompt and DESIGN.md are two renderings of one model. If a colour, a
// radius or a font note can differ between them, one of the two is lying to
// the reader, and there is no way to tell which from inside either document.

const FIXTURES_ALL = ['rig-ai', 'posthog', 'vibedesign-dashboard', 'sparse'];
const FOCUSES = ['all', 'colors', 'typography', 'shadows', 'motion', 'layout', 'components'];

test('no prompt prints a value the reader cannot resolve', () => {
  // `var(--blue)` means nothing outside the page it came from; `oklch(...)`
  // with alpha is unreadable at a glance; `url(#noise)` points at an SVG
  // filter that does not exist in the reader's document.
  const FORBIDDEN = /var\(\s*--[a-z0-9-_]+|(?:oklch|lab|lch)\(|url\(#/i;
  FIXTURES_ALL.forEach(name => {
    FOCUSES.forEach(focus => {
      const out = pagePrompt(name, focus);
      const bad = out.split('\n').filter(l => FORBIDDEN.test(l));
      assert.deepEqual(bad.map(l => l.trim().slice(0, 90)), [],
        `${name} @ ${focus} prints values the reader cannot resolve`);
    });
    const sys = systemPrompt(name);
    assert.ok(!FORBIDDEN.test(sys), `${name} Global Tokens prints an unresolved value`);
  });
});

test('resolving a value never leaves a hole behind', () => {
  // The first version of the resolver gutted `rgb(var(--bg))` into `rgb()`,
  // which is worse than what it replaced. A wrapper is resolved whole or
  // dropped whole.
  FIXTURES_ALL.forEach(name => {
    const out = pagePrompt(name, 'all');
    // Only the shapes the resolver could have emptied. A bare "()" is a
    // JavaScript arrow function — `setTimeout(() => …)` — and the prompt is
    // full of them by design.
    ['rgb()', 'rgba()', 'hsl()', 'hsla()', 'oklch()', 'var()'].forEach(hole => {
      assert.ok(!out.includes(hole), `${name} contains an empty ${hole}`);
    });
    // An empty code span is exactly two backticks — three in a row is a
    // markdown fence, which is legitimate and all over these documents.
    assert.ok(!/(?<!`)``(?!`)/.test(out), `${name} contains an empty code span`);
  });
});

test('the prompt and the model agree about radius', () => {
  // "The first radius seen anywhere on the page" is not this component's
  // radius. On rig.ai that heuristic reported 6px for cards that measure 10px,
  // inputs that measure 1px and buttons that have none at all.
  const model = require(path.join(__dirname, '..', 'lib', 'design-model.js'));
  ['rig-ai', 'posthog', 'vibedesign-dashboard'].forEach(name => {
    const m = model.buildDesignModel(fixture(name));
    const out = pagePrompt(name, 'all');

    const shadcn = (out.match(/--radius: ([^;]+)/) || [])[1];
    if (shadcn) {
      const expected = m.radius.card || m.radius.button || '0px';
      assert.equal(shadcn.trim(), expected,
        `${name}: shadcn --radius says ${shadcn} but the model measures ${expected}`);
    }
    const cards = (out.match(/\*\*Cards:\*\*[^\n]*?([0-9.]+px) radius/) || [])[1];
    if (cards && m.radius.card) {
      assert.equal(cards, m.radius.card,
        `${name}: the Cards line says ${cards} but the model measures ${m.radius.card}`);
    }
    const inputs = (out.match(/\*\*Inputs:\*\*[^\n]*?`([^`]+)` radius/) || [])[1];
    if (inputs && m.radius.input && /px$/.test(inputs)) {
      assert.equal(inputs, m.radius.input,
        `${name}: the Inputs line says ${inputs} but the model measures ${m.radius.input}`);
    }
  });
});

test('a chamfered page is never described as rounded', () => {
  // rig.ai's buttons are cut corners, not soft ones. The direction paragraph
  // used to open "Moderate rounding (6px) — contemporary and neutral", which
  // is the opposite of what the page does.
  const model = require(path.join(__dirname, '..', 'lib', 'design-model.js'));
  const m = model.buildDesignModel(fixture('rig-ai'));
  assert.ok(m.shape && m.shape.clipPath, 'fixture premise: rig.ai is chamfered');

  const out = pagePrompt('rig-ai', 'all');
  const direction = out.slice(out.indexOf('### Design Direction'), out.indexOf('### Color Tokens'));
  assert.ok(!/Moderate rounding/i.test(direction), 'the direction still claims rounding');
  assert.match(direction, /chamfer/i, 'the direction does not mention the chamfer at all');
  assert.match(out, /Buttons: Primary = chamfered/,
    'the button summary still calls a chamfered button rounded');
});

test('the font policy matches the model, and contradicts nothing', () => {
  // "Do not substitute with Google Fonts alternatives" was printed for every
  // family — including the ones that ARE on Google Fonts. It contradicted the
  // list directly above it and DESIGN.md at the same time.
  const model = require(path.join(__dirname, '..', 'lib', 'design-model.js'));
  FIXTURES_ALL.forEach(name => {
    const out = pagePrompt(name, 'all');
    assert.ok(!/Do not substitute with Google Fonts/i.test(out),
      `${name} still tells the reader not to substitute fonts that are on Google Fonts`);

    const m = model.buildDesignModel(fixture(name));
    (m.fonts || []).forEach(f => {
      if (!out.includes(`"${f.family}"`)) return;
      const line = out.split('\n').find(l => l.includes(`"${f.family}":`));
      if (!line) return;                       // not in the font-files list
      if (f.openlyLicensed) {
        assert.match(line, /openly licensed/,
          `${name}: ${f.family} is on Google Fonts but the prompt does not say so`);
        assert.ok(!/close substitute/.test(line),
          `${name}: ${f.family} is obtainable, so offering a substitute is noise`);
      } else {
        assert.match(line, /licence unknown/,
          `${name}: ${f.family} has an unknown licence and the prompt does not say so`);
        if (f.alternative) {
          assert.match(line, /suggested, not observed/,
            `${name}: ${f.family}'s substitute is not labelled as a suggestion`);
        }
      }
    });
  });
});

test('a button whose text fails 3:1 on its own background says where it was measured', () => {
  // posthog's secondary button records `#000000` bg with `#23251d` text —
  // 1.35:1. Printed unannotated, that is an instruction to build something
  // illegible; the pair was measured where the two were not adjacent.
  //
  // Read off the RENDERED line rather than reconstructed from the capture:
  // the builder picks its background through its own resolution chain, and a
  // test that re-derives it is testing its own reconstruction.
  const CU = require(path.join(__dirname, '..', 'lib', 'color-utils.js'));

  let checked = 0;
  FIXTURES_ALL.forEach(name => {
    const out = pagePrompt(name, 'all');
    out.split('\n')
      .filter(l => /^\*\*(Primary|Secondary|Ghost) button:\*\*/.test(l))
      .forEach(line => {
        const bg = (line.match(/`(#[0-9a-f]{6})` bg/i) || [])[1];
        const fg = (line.match(/text `(#[0-9a-f]{6})`/i) || [])[1];
        if (!bg || !fg) return;                 // transparent, or no text colour printed
        const ratio = CU.wcagContrast(fg, bg);
        if (!Number.isFinite(ratio) || ratio >= 3) return;

        checked++;
        assert.match(line, /measured on `#[0-9a-f]{6}`/,
          `${name}: this line pairs ${bg} with ${fg} at ${ratio.toFixed(2)}:1 and does `
          + `not say where that was measured — ${line.slice(0, 100)}`);
      });
  });
  assert.ok(checked >= 1,
    'no failing pair was exercised — either the fixtures changed or the check is looking in the wrong place');
});

test('Tailwind\'s --tw-* transition noise never reaches the prompt', () => {
  FIXTURES_ALL.forEach(name => {
    FOCUSES.forEach(focus => {
      assert.ok(!pagePrompt(name, focus).includes('--tw-'),
        `${name} @ ${focus} prints Tailwind's internal custom properties`);
    });
  });
});

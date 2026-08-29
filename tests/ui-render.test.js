// VibeDesign — panel render suite.
//
// lib/ui-components.js is pure, so every screen can be rendered and compared
// without a browser. Two things are checked here that a click-through cannot:
//
//   1. Snapshots of the rendered HTML per state, so an unintended markup
//      change shows up as a diff instead of being noticed in review or not.
//   2. The rules from docs/SIDEPANEL-IA.md §5–9 that are properties of the
//      output rather than of any one screen — component usage, the copy
//      dictionary, the spacing scale, the type scale.
//
// Update snapshots with:  UPDATE_SNAPSHOTS=1 node --test tests/ui-render.test.js
// and read the diff before accepting it.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const U = require(path.join(__dirname, '..', 'lib', 'ui-components.js'));
const V = U.VD_VIEWS;
const model = require(path.join(__dirname, '..', 'lib', 'design-model.js'));

const FIXTURES = path.join(__dirname, 'fixtures');
const SNAPSHOTS = path.join(__dirname, 'snapshots', 'ui');
const fixture = n => JSON.parse(fs.readFileSync(path.join(FIXTURES, n + '.json'), 'utf8'));
const SENTINEL = fs.readFileSync(path.join(FIXTURES, 'SENTINEL.txt'), 'utf8').trim();

const rig = model.buildDesignModel(fixture('rig-ai'));
const sparse = model.buildDesignModel(fixture('sparse'));

// One entry per screen/state pair the spec describes (§4).
const STATES = {
  'home-page':        () => V.homeView({ mode: 'page', recent: [] }),
  'home-element':     () => V.homeView({ mode: 'element', recent: [] }),
  'home-recent':      () => V.homeView({ mode: 'page', recent: [
                             { key: 'a', domain: 'linear.app', ago: '2h ago', meta: '' },
                             { key: 'b', domain: 'example.com', ago: '1d ago', meta: 'colors' }] }),
  'overview-prompt':  () => V.overviewView(rig, { output: 'prompt', target: 'Claude Code',
                             focus: 'all', meta: '17 sections · 32.6k chars' }),
  'overview-designmd':() => V.overviewView(rig, { output: 'design-md', meta: '21 sections · 15.4k chars' }),
  'overview-skill':   () => V.overviewView(rig, { output: 'skill', meta: '8 files · 42.3k chars' }),
  'overview-offline': () => V.overviewView(rig, { output: 'prompt', aiSkipped: true }),
  'overview-sparse':  () => V.overviewView(sparse, { output: 'prompt' }),
  'colors':           () => V.colorsView(rig),
  'type':             () => V.typeView(rig),
  'components':       () => V.componentsView(rig),
  'motion':           () => V.motionView(rig),
};

// Pretty-print so a snapshot diff is readable line by line rather than one
// enormous line that git reports as "changed".
const pretty = html => html
  .replace(/></g, '>\n<')
  .split('\n').map(l => l.trim()).filter(Boolean).join('\n') + '\n';

Object.keys(STATES).forEach(name => {
  test(`${name}: matches its snapshot`, () => {
    const rendered = pretty(STATES[name]());
    const file = path.join(SNAPSHOTS, name + '.html');
    if (process.env.UPDATE_SNAPSHOTS === '1') {
      fs.mkdirSync(SNAPSHOTS, { recursive: true });
      fs.writeFileSync(file, rendered);
      return;
    }
    assert.ok(fs.existsSync(file), `no snapshot for ${name} — create it with UPDATE_SNAPSHOTS=1`);
    assert.equal(rendered, fs.readFileSync(file, 'utf8'));
  });
});

// ── §8: one component per meaning ─────────────────────────────────────────

test('no component is used for a meaning the inventory forbids', () => {
  const all = Object.keys(STATES).map(k => ({ name: k, html: STATES[k]() }));

  all.forEach(({ name, html }) => {
    // Chips are filters. The only filter in the panel is Focus.
    // Anchored on the class boundary: "vd-chip[^"]*" also matches the
    // "vd-chips" container, which has no data-focus and is not a chip.
    const chips = html.match(/class="vd-chip(?: [^"]*)?"[^>]*/g) || [];
    chips.forEach(c => assert.match(c, /data-focus=/,
      `${name}: a chip is being used for something other than the Focus filter`));

    // Segmented controls are modes. Page/Element and Output, nothing else.
    const segs = html.match(/data-(mode|output|seg)="/g) || [];
    segs.forEach(s => assert.ok(/data-(mode|output)="/.test(s),
      `${name}: a segmented control is being used for something that is not a mode`));

    // §1.1: one primary action per screen.
    const primaries = (html.match(/vd-btn--primary/g) || []).length;
    assert.ok(primaries <= 1, `${name}: ${primaries} primary buttons — a screen gets one`);

    // Cards frame a primary area. Export is the only one (§8).
    const cards = html.match(/class="vd-card"[^>]*/g) || [];
    cards.forEach(c => assert.match(c, /id="vdExportCard"/,
      `${name}: Card is being used to frame something other than Export`));
  });
});

test('every list row is the one KV component', () => {
  ['colors', 'type', 'components', 'motion'].forEach(name => {
    const html = STATES[name]();
    assert.ok((html.match(/class="vd-kv"/g) || []).length > 0, `${name} renders no rows`);
    // No ad-hoc row markup alongside it.
    assert.ok(!/class="[^"]*\brow\b[^"]*"/.test(html.replace(/vd-where__row/g, '')),
      `${name} invents a second row type`);
  });
});

// ── §5–6: type and spacing come from the scale ────────────────────────────

test('the panel stylesheet defines the type and spacing scales as tokens', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'popup.css'), 'utf8');
  ['--vd-title', '--vd-stat', '--vd-section', '--vd-body', '--vd-label', '--vd-value', '--vd-caption']
    .forEach(tok => assert.ok(css.includes(tok + ':'), `${tok} is not defined`));
  ['--vd-space-1', '--vd-space-2', '--vd-space-3', '--vd-space-4', '--vd-space-6', '--vd-space-8']
    .forEach(tok => assert.ok(css.includes(tok + ':'), `${tok} is not defined`));
  ['--vd-radius-control', '--vd-radius-card', '--vd-radius-chip', '--vd-shadow-sheet',
   '--vd-duration-fast', '--vd-duration-normal', '--vd-ease']
    .forEach(tok => assert.ok(css.includes(tok + ':'), `${tok} is not defined`));
});

test('panel rules use the scale rather than raw values', () => {
  // §6: "values come only from the scale; no 13px, no 27px." Checked over the
  // panel's own rules — the pre-existing stylesheet above them is not in scope.
  const css = fs.readFileSync(path.join(__dirname, '..', 'popup.css'), 'utf8');
  const panel = css.slice(css.indexOf('/* ── shell (§3) ──'));
  const ALLOWED = new Set([0, 1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 30, 32, 34, 36, 40, 48, 56, 72, 100]);
  const offenders = [];
  (panel.match(/(?:padding|margin|gap|width|height|top|left|bottom|right)[^:;]*:\s*[^;]+;/g) || [])
    .forEach(decl => {
      (decl.match(/(?<![-\w])(\d+)px/g) || []).forEach(px => {
        const n = parseInt(px, 10);
        if (!ALLOWED.has(n)) offenders.push(decl.trim() + '  (' + px + ')');
      });
    });
  assert.deepEqual(offenders, [], 'off-scale values in the panel stylesheet');
});

test('only the label style is mono-uppercase (§5)', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'popup.css'), 'utf8');
  const panel = css.slice(css.indexOf('/* ── shell (§3) ──'));
  const rules = panel.split('}');
  rules.forEach(rule => {
    if (!/text-transform:\s*uppercase/.test(rule)) return;
    assert.ok(/vd-stat__label|vd-tab__label/.test(rule),
      'uppercase belongs to the label style alone: ' + rule.trim().slice(0, 80));
  });
});

// ── §9: the copy dictionary ───────────────────────────────────────────────

test('the panel says nothing that is not in the dictionary', () => {
  // Every user-facing sentence in §9 lives in VD_UI.COPY. This asserts the
  // screens use those strings verbatim, so a reworded button cannot drift from
  // the spec without the spec being updated first.
  const home = STATES['home-page']();
  assert.ok(home.includes(U.COPY.analyzePage));
  assert.ok(home.includes(U.esc(U.COPY.homeHelp)));

  const overview = STATES['overview-prompt']();
  assert.ok(overview.includes(U.esc(U.COPY.outputPrompt)));
  assert.ok(STATES['overview-designmd']().includes(U.esc(U.COPY.outputDesignMd)));
  assert.ok(STATES['overview-skill']().includes(U.esc(U.COPY.outputSkill)));
  assert.ok(STATES['overview-offline']().includes(U.esc(U.COPY.aiSkipped)));
  assert.ok(STATES['overview-sparse']().includes(U.esc(U.COPY.sparse)));
});

test('the copy is sentence case and free of the phrases §3 removes', () => {
  Object.keys(STATES).forEach(name => {
    const text = STATES[name]().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    ['Paid.', 'RAW capture', 'of 5 free', 'FULL PAGE', 'GLOBAL TOKENS']
      .forEach(banned => assert.ok(!text.includes(banned),
        `${name} still says "${banned}"`));
    // No SHOUTING in body copy. Uppercase is a CSS treatment on the label
    // style (§5), not something baked into a string. Filenames and product
    // names are not shouting — CLAUDE.md really is spelled that way.
    const FILENAMES = /\b(CLAUDE|DESIGN|GEMINI|AGENTS|SKILL|README)\b/g;
    const shouty = text.replace(FILENAMES, '').match(/\b[A-Z]{4,}\b/g) || [];
    assert.deepEqual(shouty, [], `${name} contains shouted copy`);
  });
});

// ── safety ────────────────────────────────────────────────────────────────

test('no page copy reaches any screen', () => {
  Object.keys(STATES).forEach(name => {
    const html = STATES[name]();
    assert.ok(!html.includes(SENTINEL), `${name} rendered scrubbed page copy`);
    assert.ok(!/\bSENTINEL\b/.test(html), `${name} rendered the sentinel marker`);
  });
});

test('values are escaped before they reach the DOM', () => {
  // Everything the panel prints came off somebody's page.
  const hostile = {
    source: { name: '<img src=x onerror=alert(1)>', viewport: null, url: '' },
    theme: { isDark: true, style: '"><script>bad()</script>', inverseButton: false },
    colors: { background: '#000', 'text-primary': '#fff' },
    colorRoles: ['background', 'text-primary'],
    typography: { stacks: { body: '</style><script>x</script>' }, detail: {} },
    spacing: null, radius: {}, shape: null, shadows: null, breakpoints: null,
    heroSurface: null, fonts: [], tokens: {},
  };
  const html = V.overviewView(hostile, { output: 'prompt' });
  assert.ok(!html.includes('<script>'), 'a script tag survived into the markup');
  assert.ok(!html.includes('onerror='), 'an event handler survived into the markup');
  assert.ok(html.includes('&lt;script&gt;') || html.includes('&lt;'), 'nothing was escaped at all');
});

test('a colour role name never renders as a bare number', () => {
  // Stat tiles show counts; a count of zero is an absence, not a measurement,
  // and §4.2 says such a tile is not drawn.
  const counts = U.summaryCounts(sparse);
  counts.forEach(c => assert.ok(c.value > 0));
  const html = STATES['overview-sparse']();
  assert.ok(!/vd-stat__value">0</.test(html), 'a zero was rendered as a stat');
});

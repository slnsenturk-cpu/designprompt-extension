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
  'home-page':        () => V.homeView({ mode: 'page', recent: [], context: 'none',
                             aiEnabled: true, aiProvider: 'Claude', aiModel: 'Fable 5' }),
  'home-ai-off':      () => V.homeView({ mode: 'page', recent: [], context: 'none' }),
  'home-cap-under':   () => V.homeView({ mode: 'page', recent: [], context: 'none',
                             authed: false, usage: { used: 4, limit: 5 } }),
  'home-cap-reached': () => V.homeView({ mode: 'page', recent: [], context: 'none',
                             authed: false, usage: { used: 5, limit: 5 } }),
  'home-signed-in':   () => V.homeView({ mode: 'page', recent: [], context: 'none',
                             authed: true, usage: null }),
  'overview-other':   () => V.overviewView(rig, { output: 'prompt', context: 'other',
                             domain: 'posthog.com', resultDomain: 'rig.ai',
                             resultTime: '12:41', aiEnabled: false }),
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
  // Comments are prose and may quote a measurement while explaining it; only
  // declarations are the stylesheet's actual behaviour.
  const panel = css.slice(css.indexOf('/* ── shell (§3) ──'))
    .replace(/\/\*[\s\S]*?\*\//g, '')          // comments are prose, not behaviour
    .replace(/@media[^{]*\{/g, '{');            // a breakpoint is not a spacing value
  // The scale (§6) plus the control heights it names, and 380 — the popup
  // window's own width, which is a viewport dimension rather than spacing.
  const ALLOWED = new Set([0, 1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 30, 32,
    34, 36, 40, 48, 56, 72, 100, 380]);
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
    // "N of 5 free prompts" was the removed BANNER; §3 reinstates the count as
    // a caption reading "free analyses". The banner wording stays banned.
    ['Paid.', 'RAW capture', 'free prompts', 'FULL PAGE', 'GLOBAL TOKENS']
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

// ── PROMPT 3b ─────────────────────────────────────────────────────────────

test('Overview always opens with the summary strip and the palette', () => {
  // 3b#2. This is the test that must fail if either disappears for rig.
  const html = V.overviewView(rig, { output: 'prompt', context: 'same' });
  assert.ok(html.includes('vd-stats'), 'the summary strip is missing for the rig fixture');
  assert.ok(html.includes('vd-swatches'), 'the palette strip is missing for the rig fixture');
  assert.equal((html.match(/vd-stat"/g) || []).length, 4, 'wrong number of stat tiles');
  assert.equal((html.match(/vd-swatch"/g) || []).length, rig.colorRoles.length);
  assert.ok(!html.includes('Very little design data'), 'rig was reported as sparse');

  // And they lead: nothing but the title, the page-context block and the
  // action come before them.
  const before = html.slice(0, html.indexOf('vd-stats'));
  assert.ok(!before.includes('vd-card'), 'the Export card is drawn before the counts');
  assert.ok(!before.includes('vd-kv'), 'Snapshot is drawn before the counts');
});

test('sparse is <3 colour roles AND no components', () => {
  // 3b#9. The old rule ("fewer than two non-zero tiles") fired on real pages.
  assert.equal(U.isSparse(rig), false, 'a 10-role capture is not sparse');
  assert.equal(U.isSparse(sparse), true);
  assert.equal(U.isSparse(null), true, 'no model at all is as sparse as it gets');

  // A page with few colours but real components is NOT sparse.
  const fewColours = {
    colorRoles: ['background', 'text-primary'],
    colors: { background: '#fff', 'text-primary': '#000' },
    theme: {}, typography: { stacks: {}, detail: {} }, radius: {}, shape: null,
    tokens: { buttonStyles: { primary: { padding: '8px' } } },
  };
  assert.equal(U.isSparse(fewColours), false,
    'two colours plus a real button is a design, not an empty page');
});

test('the reload glyph never appears without a label', () => {
  Object.keys(STATES).forEach(name => {
    const html = STATES[name]();
    (html.match(/<button[^>]*>(?:(?!<\/button>).)*<\/button>/gs) || []).forEach(btn => {
      if (!btn.includes('↺')) return;
      const text = btn.replace(/<[^>]+>/g, ' ').replace(/↺/g, '').replace(/\s+/g, ' ').trim();
      assert.ok(text.length > 0, `${name}: a bare ↺ button`);
    });
  });
});

test('the page-context block names both pages when they differ', () => {
  const html = STATES['overview-other']();
  assert.match(html, /Showing rig\.ai \(analyzed 12:41\)/,
    'the result must say which page it describes');
  assert.match(html, /Analyze posthog\.com/,
    'the action must name the page it will read');
});

test('the AI indicator reads either way round', () => {
  assert.match(STATES['home-page'](), /AI enhancement: Claude · Fable 5/);
  assert.match(STATES['home-page'](), /Change/);
  assert.match(STATES['home-ai-off'](), /AI enhancement off/);
  assert.match(STATES['home-ai-off'](), /Turn on/);
});

test('a long Snapshot value stacks under its label instead of truncating', () => {
  // 3b#11. The Style line is a sentence; cutting it mid-word loses the point.
  const rows = U.snapshotRows(rig);
  const style = rows.find(r => r.label === 'Style');
  assert.ok(style, 'no Style row');
  assert.equal(style.wrap, true, 'the Style value is not marked as wrapping');
  assert.ok(style.value.length > 40, 'fixture premise: this value is long');

  const html = U.kvRow(style);
  assert.match(html, /vd-kv--stacked/);
  assert.match(html, /vd-kv__value--wrap/);

  const css = fs.readFileSync(path.join(__dirname, '..', 'popup.css'), 'utf8');
  assert.match(css, /\.vd-kv__value--wrap \{[^}]*white-space: normal/,
    'the wrapping class does not actually wrap');
});

test('every tab entry carries an icon and a label', () => {
  // 3b#1: an icon-only bar is not accepted.
  const bar = U.tabBar({ active: 'overview', ready: true });
  U.TABS.forEach(t => {
    assert.ok(bar.includes(`data-tab="${t.id}"`), `${t.id} missing from the bar`);
    assert.ok(bar.includes(`>${t.label}<`), `${t.id} has no visible label`);
  });
  assert.equal((bar.match(/vd-tab__icon/g) || []).length, U.TABS.length);
  assert.equal((bar.match(/vd-tab__label/g) || []).length, U.TABS.length);

  // §3: the tab bar carries no sign-in state. A dot on a tab is a
  // notification badge — it says "something happened" and gives nothing to
  // press. The header's account control is both the state and the action.
  assert.ok(!bar.includes('vd-tab__dot'), 'a badge is back on the tab bar');
  assert.ok(!U.tabBar({ active: 'overview', ready: true, signedOut: true }).includes('dot'),
    'the tab bar still reacts to sign-in state');
});

test('every tab panel opens with its own title', () => {
  // 3b#5.
  [['overview-prompt', 'Overview'], ['home-page', 'Overview'], ['colors', 'Colors'],
   ['type', 'Type'], ['components', 'Components'], ['motion', 'Motion']]
    .forEach(([state, title]) => {
      const html = STATES[state]();
      assert.match(html, new RegExp(`^<h1 class="vd-tabtitle">${title}</h1>`),
        `${state} does not open with its title`);
    });
});

test('the tab bar and header meet the sizes §3 gives', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'popup.css'), 'utf8');
  const panel = css.slice(css.indexOf('/* ── shell (§3) ──'));
  // Matched on the declaration, not on the rule's formatting — the previous
  // form broke the moment the rule gained a second line.
  const rule = re => (panel.match(re) || [''])[0];
  assert.match(rule(/\.vd-header__logo \{[^}]*\}/), /height: 20px/, 'the wordmark is not 20px');
  assert.match(panel, /min-height: 48px/, 'the touch target is under 48px');
  assert.match(rule(/\.vd-tab \{[^}]*\}/), /flex: 1 1 0/,
    'tabs are not equal shrinkable columns');
  assert.match(rule(/\.vd-tab \{[^}]*\}/), /min-width: 0/,
    'a tab that cannot shrink below its label widens the bar');
  assert.match(rule(/\.vd-tab__icon \{[^}]*\}/), /font-size: 20px/, 'the tab icon is not 20px');
  assert.match(panel, /\.vd-tab\.is-dim \{ opacity: 0\.4/, 'dimmed tabs are not at 40%');
  assert.match(panel, /\.vd-tab\.is-on \.vd-tab__label \{ font-weight: 600/,
    'the active tab label is not 600');
  // The header domain is body size, the status is caption.
  assert.match(panel, /\.vd-header__domain \{\s*font: var\(--vd-body\)/);
  assert.match(panel, /\.vd-header__state \{ font: var\(--vd-caption\)/);
});

test('the sparse warning and the page-context notice never appear together', () => {
  // §4.5: one notice or the other. "Showing tiny.example" already answers what
  // the reader is looking at; stacking "very little design data" underneath
  // asks them to judge a result for a page they are not even on.
  const thin = model.buildDesignModel(fixture('sparse'));
  assert.equal(U.isSparse(thin), true, 'fixture premise');

  const elsewhere = V.overviewView(thin, {
    output: 'prompt', context: 'other', domain: 'posthog.com',
    resultDomain: 'tiny.example', resultTime: '12:41',
  });
  assert.match(elsewhere, /Showing tiny\.example/, 'the page-context notice is missing');
  assert.ok(!elsewhere.includes(U.COPY.sparse),
    'both notices rendered — §4.5 allows one or the other');

  // On its own page the sparse warning is exactly what should be said.
  const athome = V.overviewView(thin, { output: 'prompt', context: 'same' });
  assert.ok(athome.includes(U.COPY.sparse), 'the sparse warning went missing entirely');
  assert.ok(!athome.includes('Showing'), 'a page-context notice on the same page');

  // And a sparse model never gets a strip of ones either way.
  assert.ok(!elsewhere.includes('vd-stats') && !athome.includes('vd-stats'),
    'a sparse model was given a summary strip');
});

// ── PROMPT 3d ─────────────────────────────────────────────────────────────

test('the cap caption appears only for a signed-out user under the limit', () => {
  const under = { authed: false, usage: { used: 4, limit: 5 } };
  const at = { authed: false, usage: { used: 5, limit: 5 } };
  const inn = { authed: true, usage: null };

  const home = o => V.homeView(Object.assign({ mode: 'page', context: 'none' }, o));

  assert.match(home(under), /4 of 5 free analyses this month/);
  assert.ok(home(under).includes('Analyze page'), 'the action was taken away early');

  // At the limit the caption is replaced by the block, not stacked with it.
  assert.ok(!home(at).includes('of 5 free analyses'), 'both the caption and the block rendered');
  // Compared against the escaped string: the renderer escapes every value it
  // prints, so the apostrophe arrives as &#39; — matching the raw sentence
  // would fail for the right reason and look like the wrong one.
  assert.ok(home(at).includes(U.esc(U.COPY.capReached(5))),
    'the limit sentence is missing');

  // Signed in: neither, at any count.
  assert.ok(!home(inn).includes('free analyses'), 'a signed-in user sees a counter');
  assert.ok(!home(inn).includes("You've used"), 'a signed-in user sees the limit');
  assert.ok(!V.homeView({ mode: 'page', context: 'none', authed: true, usage: { used: 5, limit: 5 } })
    .includes('free analyses'), 'usage leaked through for a signed-in account');
});

test('at the cap the screen still has exactly one primary action', () => {
  const at = V.homeView({ mode: 'page', context: 'none', authed: false, usage: { used: 5, limit: 5 } });
  assert.equal((at.match(/vd-btn--primary/g) || []).length, 1);
  assert.match(at, /id="vdSignInUnlimited"/);
  assert.ok(!at.includes('id="analyzeBtn"'), 'Analyze is still offered at the limit');
  assert.ok(!/disabled/.test(at), 'a disabled button says no without saying what to do');
});

test('the header account control is a control in both states', () => {
  const out = U.accountControl({ authed: false });
  assert.match(out, /^<button/, 'the signed-out state is not pressable');
  assert.match(out, /data-action="signIn"/);
  assert.match(out, />Sign in</);

  const inn = U.accountControl({ authed: true, email: 'user@example.com' });
  assert.match(inn, /^<button/);
  assert.match(inn, /data-action="openAccount"/);
  assert.match(inn, /vd-account__initial" aria-hidden="true">U</, 'no initial for a photoless account');

  const photo = U.accountControl({ authed: true, email: 'user@example.com', avatarUrl: 'https://e.com/a.png' });
  assert.match(photo, /vd-account__photo/);
  assert.ok(!photo.includes('vd-account__initial'), 'both a photo and an initial were drawn');

  // The avatar is 24px and the button 28px (§3).
  const css = fs.readFileSync(path.join(__dirname, '..', 'popup.css'), 'utf8');
  const rule = re => (css.match(re) || [''])[0];
  assert.match(rule(/\.vd-account \{[^}]*\}/), /width: 24px; height: 24px/);
  assert.match(rule(/\.vd-account__signin \{[^}]*\}/), /height: 28px/);
});

test('no screen asks the user to sign in without something to press', () => {
  // §3. The one allowed sentence is Settings' explanation, which sits directly
  // above its own Sign in button.
  Object.keys(STATES).forEach(name => {
    const html = STATES[name]();
    const text = html.replace(/<[^>]+>/g, ' ');
    if (!/Sign in/.test(text)) return;
    const inControl = /<button[^>]*>[^<]*Sign in|data-action="signIn"/.test(html);
    assert.ok(inControl, `${name}: "Sign in" appears with nothing to press`);
  });
});

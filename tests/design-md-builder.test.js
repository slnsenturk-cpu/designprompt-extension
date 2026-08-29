// VibeDesign — DESIGN.md builder suite.
//
// The builder turns extracted tokens into a Stitch-compatible DESIGN.md with
// no network and no AI. The properties that matter, and that this file pins:
//
//   - the frontmatter is valid, fenced YAML
//   - required sections are present for real token bundles
//   - NO page copy escapes (every fixture plants a sentinel sentence in every
//     copy-bearing field; it must never appear in the output)
//   - pro-only sections are absent on the free tier, present on pro
//   - the same tokens always produce byte-identical output
//
// Run with:  node --test tests/design-md-builder.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const build = require(path.join(__dirname, '..', 'lib', 'design-md-builder.js'));
const FIXTURES = path.join(__dirname, 'fixtures');

const SENTINEL = fs.readFileSync(path.join(FIXTURES, 'SENTINEL.txt'), 'utf8').trim();

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name + '.json'), 'utf8'));
}

// Fixed so output is reproducible; the builder must never read the clock.
const OPTS = { version: '3.0.0', observedAt: '2026-08-29' };
const opts = extra => Object.assign({}, OPTS, extra);

// rig-ai is a real capture; the other two are synthetic. All three are rich
// enough to exercise every section.
const RICH = ['rig-ai', 'posthog', 'vibedesign-dashboard'];
const ALL = RICH.concat(['sparse']);

// Sections that only appear when the tokens support them, but which every
// rich fixture must produce.
const DEEP_SECTIONS = [
  '## Motion',
  '## Interaction states',
  '## Component anatomy',
  '## Accessibility notes',
];

// Minimal frontmatter parse: the fenced block plus its top-level keys.
function parseFrontmatter(md) {
  assert.ok(md.startsWith('---\n'), 'document must open with a --- fence');
  const end = md.indexOf('\n---\n', 3);
  assert.notEqual(end, -1, 'frontmatter must be closed by a --- fence');
  const body = md.slice(4, end);
  const keys = [];
  const scalars = {};
  body.split('\n').forEach(line => {
    const m = line.match(/^([a-z_][a-z0-9_]*):(.*)$/i);   // top-level only
    if (!m) return;
    keys.push(m[1]);
    const v = m[2].trim();
    if (v) scalars[m[1]] = v;
  });
  return { raw: body, keys, scalars, endsAt: end + 5 };
}

// ── frontmatter ────────────────────────────────────────────────────────────

ALL.forEach(name => {
  test(`${name}: frontmatter is valid and carries required keys`, () => {
    const md = build.buildDesignMd(fixture(name), opts());
    const fm = parseFrontmatter(md);

    ['name', 'source', 'generated_by'].forEach(k => {
      assert.ok(fm.keys.includes(k), `frontmatter must include ${k}`);
    });
    // Quoted scalars, so a value containing a colon can't break the YAML.
    assert.match(fm.scalars.name, /^".*Design System"$/);
    assert.match(fm.scalars.generated_by, /^"VibeDesign 3\.0\.0"$/);
    // The observed date rides as a comment on `source`.
    assert.match(fm.raw, /source: ".*"\s+# observed on 2026-08-29/);
    // Exactly one closing fence before the body.
    assert.equal(md.slice(0, fm.endsAt).match(/^---$/gm).length, 2);
  });
});

RICH.forEach(name => {
  test(`${name}: frontmatter carries the full token blocks`, () => {
    const md = build.buildDesignMd(fixture(name), opts());
    const fm = parseFrontmatter(md);
    ['style', 'colors', 'typography', 'spacing', 'radius', 'shadows', 'breakpoints']
      .forEach(k => assert.ok(fm.keys.includes(k), `${name} must emit ${k}`));

    // Colors are hex only — no rgb(), no named colors. Slice just the colors
    // block: the next top-level key ends it.
    const after = fm.raw.slice(fm.raw.indexOf('colors:'));
    const nextTop = after.slice(1).search(/\n[a-z_]+:/i);
    const colorBlock = nextTop === -1 ? after : after.slice(0, nextTop + 1);
    const colorLines = colorBlock.split('\n').slice(1)
      .filter(l => /^ {2}[a-z]/.test(l));
    assert.ok(colorLines.length >= 6, 'expected a real semantic palette');
    colorLines.forEach(l => {
      const v = l.split(':')[1].trim();
      assert.match(v, /^"#[0-9a-f]{6}"$/, `non-hex color in frontmatter: ${l}`);
    });

    // The semantic keys the format promises.
    ['primary', 'background', 'text-primary'].forEach(k => {
      assert.ok(new RegExp('^  ' + k + ':', 'm').test(colorBlock), `missing color role ${k}`);
    });
  });
});

test('style characterization is a short phrase, not a sentence', () => {
  RICH.forEach(name => {
    const md = build.buildDesignMd(fixture(name), opts());
    const style = parseFrontmatter(md).scalars.style;
    const words = style.replace(/"/g, '').split(/\s+/);
    assert.ok(words.length >= 3 && words.length <= 8, `style should be 3–8 words, got ${words.length}: ${style}`);
  });
});

// ── required sections ──────────────────────────────────────────────────────

const REQUIRED = [
  '# ', '## Visual direction', '## Layout', '## Color usage', '## Typography',
  '## Components', '## Spacing rules', '## Do', "## Don't", '## Agent instructions',
];

RICH.forEach(name => {
  test(`${name}: all required sections are present`, () => {
    const md = build.buildDesignMd(fixture(name), opts());
    REQUIRED.forEach(h => assert.ok(md.includes(h), `${name} is missing "${h}"`));
    // Component sub-sections follow the extracted styles: a block appears iff
    // the extractor produced data for it. rig.ai has cardStyles === null (its
    // cards are transparent with borders and the extractor does not match
    // them), so demanding "### Cards" everywhere would be demanding a
    // fabrication.
    // A component block appears iff the extractor produced data for it.
    // Neither real capture yields cardStyles or inputStyles — see the
    // "Extractor gaps" table in docs/AUDIT-v3.md — so demanding those blocks
    // everywhere would be demanding a fabrication.
    const t = fixture(name);
    assert.ok(md.includes('### Buttons'), `${name} is missing "### Buttons"`);
    assert.equal(md.includes('### Cards'), !!t.cardStyles,
      `${name}: the Cards block must appear exactly when cardStyles exists`);
    assert.equal(md.includes('### Inputs'), !!t.inputStyles,
      `${name}: the Inputs block must appear exactly when inputStyles exists`);
  });
});

test('sparse tokens: sections with no data are omitted, not emitted empty', () => {
  const md = build.buildDesignMd(fixture('sparse'), opts());
  // Nothing to say about layout, color usage, components or spacing.
  ['## Layout', '## Color usage', '## Components', '## Spacing rules', '## Visual direction']
    .forEach(h => assert.ok(!md.includes(h), `empty section "${h}" should be omitted`));
  // But the invariant guidance still ships.
  ['## Do', "## Don't", '## Agent instructions'].forEach(h => {
    assert.ok(md.includes(h), `${h} should always be present`);
  });
  // No table is ever emitted with a header and no rows.
  md.split('\n\n').forEach(block => {
    if (block.includes('|---')) {
      const rows = block.split('\n').filter(l => l.startsWith('|'));
      assert.ok(rows.length > 2, 'emitted a table with no data rows');
    }
  });
});

// ── the copy-leak guard ────────────────────────────────────────────────────

ALL.forEach(name => {
  test(`${name}: no page copy leaks into the output`, () => {
    const tokens = fixture(name);
    // Sanity: the fixture really does carry the sentinel, otherwise this
    // test would pass vacuously.
    assert.ok(JSON.stringify(tokens).includes(SENTINEL),
      `fixture ${name} must plant the sentinel to make this test meaningful`);

    const md = build.buildDesignMd(tokens, opts());
    assert.ok(!md.includes(SENTINEL), 'sentinel sentence leaked into DESIGN.md');
    assert.ok(!md.includes('SENTINEL'), 'sentinel marker leaked into DESIGN.md');
  });
});

test('no image URLs, asset paths or brand strings leak', () => {
  RICH.forEach(name => {
    const md = build.buildDesignMd(fixture(name), opts());
    assert.ok(!/https?:\/\/cdn\./.test(md), 'a CDN asset URL leaked');
    assert.ok(!/\.(png|jpe?g|webp|svg|woff2?|json)\b/.test(md), 'an asset filename leaked');
    // The only URL permitted is the source URL, on the `source:` line.
    const urls = md.match(/https?:\/\/[^\s"')]+/g) || [];
    urls.forEach(u => {
      assert.ok(md.indexOf('source: "' + u) !== -1, `unexpected URL in output: ${u}`);
    });
  });
});

test('site name comes from the URL, never from page content', () => {
  assert.equal(build._siteName('https://posthog.com/'), 'Posthog');
  assert.equal(build._siteName('https://vibedesign.tech/dashboard'), 'Vibedesign');
  assert.equal(build._siteName('https://forge-cli.dev'), 'Forge Cli');
  assert.equal(build._siteName('not a url'), 'Untitled');
  // A logoText full of copy must not influence it.
  const md = build.buildDesignMd(fixture('posthog'), opts());
  assert.match(md, /^name: "Posthog Design System"$/m);
});

test('typed accessors reject sentence-shaped input', () => {
  const a = build._accessors;
  [a.hex, a.len, a.word, a.shadow, a.fontStack, a.timing, a.duration].forEach(fn => {
    assert.equal(fn(SENTINEL), null, `${fn.name} accepted a sentence`);
  });
  // And still accept the real thing.
  assert.equal(a.hex('#FFF'), '#ffffff');
  assert.equal(a.hex('#2563ebff'), '#2563eb');
  assert.equal(a.len('12px 24px'), '12px 24px');
  assert.equal(a.word('layered-elevation'), 'layered-elevation');
  assert.equal(a.duration('0.4s'), '400ms');
  assert.ok(a.fontStack('Inter, -apple-system, sans-serif'));
  assert.equal(a.hex('rgb(1,2,3)'), null);
});

// ── determinism ────────────────────────────────────────────────────────────

ALL.forEach(name => {
  test(`${name}: two runs are byte-identical`, () => {
    const a = build.buildDesignMd(fixture(name), opts());
    const b = build.buildDesignMd(fixture(name), opts());
    assert.equal(a, b);
    // Re-reading the fixture from disk must not change anything either,
    // which catches accidental mutation of the input tokens.
    const c = build.buildDesignMd(fixture(name), opts());
    assert.equal(a, c);
  });
});

test('the builder does not mutate the tokens it is given', () => {
  const tokens = fixture('posthog');
  const before = JSON.stringify(tokens);
  build.buildDesignMd(tokens, opts());
  assert.equal(JSON.stringify(tokens), before);
});

test('output never depends on the clock', () => {
  // No observedAt → the comment is simply omitted, rather than stamped with
  // Date.now(), which would break reproducibility.
  const a = build.buildDesignMd(fixture('posthog'), { version: '3.0.0' });
  assert.ok(!/# observed on/.test(a));
  assert.equal(a, build.buildDesignMd(fixture('posthog'), { version: '3.0.0' }));
});

// ── formatting rules ───────────────────────────────────────────────────────

test('sizes carry both px and rem; colors are hex', () => {
  const md = build.buildDesignMd(fixture('posthog'), opts());
  assert.match(md, /\d+px \(\d[\d.]*rem\)/, 'px sizes carry their rem equivalent');
  // No rgb()/hsl() color functions outside shadow values.
  md.split('\n').forEach(line => {
    if (/box-shadow|Shadow|shadows:|inset|rgba\(/.test(line)) return;
    assert.ok(!/\brgb\(/.test(line), `raw rgb() in output: ${line}`);
  });
});

test('value-heavy sections use tables', () => {
  const md = build.buildDesignMd(fixture('posthog'), opts());
  ['## Layout', '## Color usage', '## Components'].forEach(h => {
    const body = md.slice(md.indexOf(h), md.indexOf(h) + 900);
    assert.ok(body.includes('|---'), `${h} should use a table`);
  });
});

test('markdown tables are well-formed', () => {
  ALL.forEach(name => {
    const md = build.buildDesignMd(fixture(name), opts());
    const lines = md.split('\n');
    lines.forEach((line, i) => {
      if (!/^\|---/.test(line)) return;
      const cols = line.split('|').length;
      assert.equal(lines[i - 1].split('|').length, cols, `header/separator mismatch at line ${i}`);
      for (let j = i + 1; j < lines.length && lines[j].startsWith('|'); j++) {
        assert.equal(lines[j].split('|').length, cols, `row width mismatch at line ${j}: ${lines[j]}`);
      }
    });
  });
});

// ── component scope ────────────────────────────────────────────────────────

test('scope "component" produces a short component card', () => {
  const page = build.buildDesignMd(fixture('posthog'), opts({ scope: 'page' }));
  const card = build.buildDesignMd(fixture('posthog'), opts({ scope: 'component' }));

  assert.ok(card.length < page.length / 2, 'the component card should be much shorter');
  assert.ok(card.startsWith('---\n'), 'it still carries frontmatter');
  assert.ok(card.includes('## Components'));
  assert.ok(card.includes('## Interaction states'), 'the component card includes states');
  // The page-level narrative sections do not belong on a component card.
  ['## Visual direction', '## Layout', '## Spacing rules', '## Do'].forEach(h => {
    assert.ok(!card.includes(h), `component card should not include "${h}"`);
  });
  assert.ok(!card.includes(SENTINEL));
});


// ── semantic color derivation ──────────────────────────────────────────────

test('colors are assigned by role, with a margin where it matters', () => {
  const c = build._deriveColors(fixture('posthog'));
  assert.equal(c.background, '#eeefe9');

  // White scores 242 border and 235 text on this site — a 3% edge is noise,
  // not a role. The border is the grey that is used for nothing else.
  assert.equal(c.border, '#bfc1b7');
  assert.notEqual(c.border, '#ffffff');

  // text-primary is the colour the site sets most of its text in (450 uses),
  // not the highest-contrast one (pure black, 104 uses).
  assert.equal(c['text-primary'], '#374151');

  // A surface stays close to the page in tone; the vivid teal used as a
  // decorative fill is not one.
  assert.equal(c.surface, '#fdfdf8');
  assert.notEqual(c['surface-raised'], '#49bac5');
});

test('shadcn HSL triplets in custom properties resolve to surfaces', () => {
  // vibedesign.tech/dashboard stores its palette as bare "0 0% 4%" triplets
  // and composes them as hsl(var(--card)) at use sites, so the recorded value
  // has no function wrapper. Without triplet parsing the site had no surfaces
  // at all.
  const c = build._deriveColors(fixture('vibedesign-dashboard'));
  assert.equal(c.background, '#111113');
  assert.equal(c.surface, '#0a0a0a', '--card: 0 0% 4%');
  assert.equal(c['surface-raised'], '#1a1a1a', '--secondary: 0 0% 10%');
  assert.equal(c.border, '#242424');
});

test('hover colours are measured, never synthesised', () => {
  // A derived hover shade is a guess presented as a fact. Neither real capture
  // measures a button hover fill that differs from its base, so neither may
  // carry the token.
  RICH.forEach(name => {
    const c = build._deriveColors(fixture(name));
    if (!('primary-hover' in c)) return;
    // If present, it must correspond to an actual measurement.
    const t = fixture(name);
    const measured = JSON.stringify(t.hoverStates || []);
    assert.ok(measured.length > 2, `${name}: a hover token needs hoverStates behind it`);
  });

  // Strip the measurements and the token must never appear.
  const noHover = fixture('rig-ai');
  noHover.hoverStates = [];
  assert.ok(!('primary-hover' in build._deriveColors(noHover)));
  assert.ok(!build.buildDesignMd(noHover, opts()).includes('primary-hover'));
});

test('a colour may fill two roles rather than one being dropped', () => {
  // On the dashboard the primary action IS the accent; emitting both, aliased,
  // beats silently losing the `primary` role to dedup.
  const c = build._deriveColors(fixture('vibedesign-dashboard'));
  assert.equal(c.accent, '#3a1df5');
  assert.equal(c.primary, '#3a1df5');

  // PostHog's button colour and its most-frequent accent genuinely differ, so
  // the two roles hold different values there.
  const p = build._deriveColors(fixture('posthog'));
  assert.equal(p.primary, '#cd8407', 'the measured button fill');
  assert.equal(p.accent, '#2f80fa', 'the most-used saturated colour');
});

test('accessibility notes flag pairings below 4.5:1', () => {
  const md = build.buildDesignMd(fixture('vibedesign-dashboard'), opts());
  const section = md.slice(md.indexOf('## Accessibility notes'));
  assert.match(section, /\d+\.\d\d:1/, 'ratios must be printed');
  // The dark fixture's muted text is deliberately low-contrast.
  assert.match(section, /AA large text only|fails/);
  assert.match(section, /⚠️/, 'sub-4.5:1 pairings must be flagged');
});

test('a fully empty token object still produces a usable document', () => {
  const md = build.buildDesignMd({}, opts({ sourceUrl: 'https://example.com' }));
  assert.ok(md.startsWith('---\n'));
  assert.ok(md.includes('# Example Design System'));
  assert.ok(md.includes('## Agent instructions'));
  assert.equal(md, build.buildDesignMd({}, opts({ sourceUrl: 'https://example.com' })));
});

// ── loads in the browser too ───────────────────────────────────────────────

test('builder works via <script> load, with color-utils as plain globals', () => {
  // In popup/sidepanel there is no require(): each file declares its exports as
  // top-level globals and the next picks them up off `self`. The builder is a
  // renderer over lib/design-model.js, so the model must load first. Simulate
  // exactly that load order.
  const vm = require('node:vm');
  const sandbox = { console: { warn() {}, log() {}, error() {} }, Math, JSON, Date, URL, RegExp,
    Object, Array, String, Number, Set, Map, parseInt, parseFloat, isNaN, Infinity };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const read = f => fs.readFileSync(path.join(__dirname, '..', 'lib', f), 'utf8');
  vm.runInContext(read('color-utils.js'), sandbox, { filename: 'lib/color-utils.js' });
  // The model looks up font licences in this catalogue. In Node it require()s
  // the JSON; in the browser there is no require, so the generated JS twin has
  // to be loaded first or every family silently reports "licence unknown".
  vm.runInContext(read('data/google-fonts.js'), sandbox, { filename: 'lib/data/google-fonts.js' });
  vm.runInContext(read('design-model.js'), sandbox, { filename: 'lib/design-model.js' });
  vm.runInContext(read('design-md-builder.js'), sandbox, { filename: 'lib/design-md-builder.js' });

  assert.ok(sandbox.VD_GOOGLE_FONTS, 'the font catalogue must expose self.VD_GOOGLE_FONTS');
  assert.ok(sandbox.VD_MODEL, 'the model must expose self.VD_MODEL');
  assert.ok(sandbox.VD_DESIGN_MD, 'the builder must expose self.VD_DESIGN_MD');
  sandbox.__tokens = fixture('posthog');
  const md = vm.runInContext(
    'VD_DESIGN_MD.buildDesignMd(__tokens, {version:"3.0.0", observedAt:"2026-08-29"})',
    sandbox);

  // Byte-identical to the Node path — same code, same color math.
  assert.equal(md, build.buildDesignMd(fixture('posthog'), opts()));
  // Contrast ratios really were computed, i.e. the globals resolved.
  assert.match(md, /## Accessibility notes/);
  assert.match(md, /\d+\.\d\d:1/);
});

test('both pages load the model before the builder', () => {
  // The sandbox test above proves the order works; only the HTML proves the
  // order ships. A missing <script> here is a blank result panel, not a
  // test failure, so it gets its own assertion.
  ['popup.html', 'sidepanel.html'].forEach(page => {
    const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    const at = f => html.indexOf(`lib/${f}`);
    assert.ok(at('color-utils.js') !== -1, `${page} does not load color-utils.js`);
    assert.ok(at('data/google-fonts.js') !== -1, `${page} does not load the font catalogue`);
    assert.ok(at('design-model.js') !== -1, `${page} does not load design-model.js`);
    assert.ok(at('data/google-fonts.js') < at('design-model.js'),
      `${page} loads the model before the catalogue it reads — every font would `
      + 'report "licence unknown"');
    assert.ok(at('design-md-builder.js') !== -1, `${page} does not load design-md-builder.js`);
    assert.ok(at('color-utils.js') < at('design-model.js'),
      `${page} loads the model before color-utils.js`);
    assert.ok(at('design-model.js') < at('design-md-builder.js'),
      `${page} loads the builder before the model it reads`);
  });
});


// ── dev affordances must not reach packaged builds ─────────────────────────

// The result actions and the Developer gate are asserted against the REAL
// rendered panel in tests/ui-panel.test.js now. They moved with the features:
// the markup they used to grep for no longer exists, and a grep cannot tell a
// rendered button from a string sitting in a template literal.

test('the download filename is domain-only', () => {
  const dl = require(path.join(__dirname, '..', 'lib', 'download.js'));
  assert.equal(dl.designMdFilename('https://rig.ai/'), 'DESIGN-rig.ai.md');
  assert.equal(dl.designMdFilename('https://www.northwind.io/pricing'), 'DESIGN-northwind.io.md');
});

// ── colour resolution: nothing unresolved may reach the reader ─────────────

test('rgba / oklch / var() are all resolved to opaque hex', () => {
  const cu = require(path.join(__dirname, '..', 'lib', 'color-utils.js'));
  // OKLCH is exact, not approximated — this is a real value from a live site.
  assert.equal(cu.compositeOver('oklch(0.6329 0.2075 31.49)', '#0a0a0a'), '#ed462d');
  // Alpha composites over the page background rather than being printed raw.
  assert.equal(cu.compositeOver('rgba(240,237,230,0.14)', '#0a0a0a'), '#2a2a29');
  assert.equal(cu.compositeOver('#ffffff14', '#0a0a0a'), '#1d1d1d');
  // var() chains follow through cssVars, with a fallback, and terminate.
  const vars = { '--paper': '#f0ede6', '--border': 'var(--paper-14)',
                 '--paper-14': 'rgba(240,237,230,0.14)', '--loop': 'var(--loop)' };
  assert.equal(cu.resolveColor('var(--border)', vars, '#0a0a0a'), '#2a2a29');
  assert.equal(cu.resolveColor('var(--nope, #ed462d)', vars, '#0a0a0a'), '#ed462d');
  assert.equal(cu.resolveColor('var(--loop)', vars, '#0a0a0a'), null, 'cyclic var must not hang');
});

test('no unresolved var() or alpha colour ever reaches the output', () => {
  ALL.forEach(name => {
    const md = build.buildDesignMd(fixture(name), opts());
    assert.ok(!md.includes('var(--'), `${name}: an unresolved var() reached the document`);
  });
});

test('on a dark theme no text token is darker than the background', () => {
  const cu = require(path.join(__dirname, '..', 'lib', 'color-utils.js'));
  const c = build._deriveColors(fixture('vibedesign-dashboard'));
  const bgLum = cu.wcagLuminance(c.background);
  ['text-primary', 'text-secondary', 'text-muted'].forEach(k => {
    if (!c[k]) return;
    assert.ok(cu.wcagLuminance(c[k]) > bgLum,
      `${k} (${c[k]}) is darker than the background on a dark theme`);
  });
});

// ── shape language ─────────────────────────────────────────────────────────

test('a polygon clip-path zeroes the radius and is described instead', () => {
  const t = fixture('vibedesign-dashboard');
  t.buttonStyles.primary.clipPath = 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)';
  t.cssVars['--chamfer'] = '14px';

  const md = build.buildDesignMd(t, opts());
  assert.match(md, /^  button: "0px"$/m, 'a clip-path button has no border-radius');
  assert.ok(md.includes('chamfer'), 'the chamfer must be described');
  assert.ok(md.includes('clip-path: polygon('), 'the polygon itself must be reproducible');
  assert.match(parseFrontmatter(md).scalars.style, /chamfered/);
  // And the card/input radii still come through from the observed list.
  assert.match(md, /^  card: "/m);
});

// ── motion ─────────────────────────────────────────────────────────────────

test('every keyframe is listed with an effect derived from its from/to', () => {
  const t = fixture('vibedesign-dashboard');
  t.animations = [
    { name: 'pulse-ring', from: '0%, 100% { opacity: 0.4; transform: scale(1); }', to: '50% { opacity: 0; transform: scale(2); }' },
    { name: 'blink', from: '0%, 100% { opacity: 1; }', to: '50% { opacity: 0; }' },
    { name: 'ticker', from: '0% { transform: translate(0px); }', to: '100% { transform: translate(-50%); }' },
    { name: 'hdr-glow-pulse', from: '0%, 100% { opacity: 0.4; filter: blur(8px); }', to: '50% { opacity: 0.7; filter: blur(12px); }' },
    { name: 'glitch-subtle-1', from: '0% { clip: rect(12px, 9999px, 5px, 0px); }', to: '100% { clip: rect(60px, 9999px, 100px, 0px); }' },
  ];
  t.ambientAnimations = [{ name: 'signal-flicker', duration: '4s', timingFunction: 'ease-in-out', iterationCount: 'infinite' }];

  const md = build.buildDesignMd(t, opts());
  const section = md.slice(md.indexOf('### Keyframes'));
  assert.ok(md.includes('### Keyframes'));
  t.animations.forEach(a => assert.ok(section.includes('`' + a.name + '`'), `${a.name} missing`));
  // Effects are derived, not guessed from the name.
  assert.ok(section.includes('scale 1 → 2'), 'pulse-ring scale not derived');
  assert.ok(section.includes('blur 8px → 12px'), 'glow blur not derived');
  assert.ok(section.includes('seamless marquee loop'), 'ticker not recognised as a marquee');
  assert.ok(section.includes('clip-rect slice'), 'glitch clip not derived');
  // Ambient loops carry their durations.
  assert.ok(md.includes('### Ambient loops') && md.includes('4000ms'));
});

test('repeated easing tokens are collapsed', () => {
  const t = fixture('vibedesign-dashboard');
  t.transitions = ['all 200ms ease, ease', 'all 200ms ease, ease', 'color 100ms ease-out'];
  const md = build.buildDesignMd(t, opts());
  assert.ok(!md.includes('ease, ease'), 'duplicated easing must be collapsed');
});

// ── measured vs recommended ────────────────────────────────────────────────

test('measured interaction states are visibly separated from recommendations', () => {
  const md = build.buildDesignMd(fixture('vibedesign-dashboard'), opts());
  const section = md.slice(md.indexOf('## Interaction states'));
  assert.ok(section.includes('### Measured'), 'measurements need their own block');
  assert.ok(section.includes('### Recommended (not observed)'), 'advice must be fenced off');
  assert.ok(section.indexOf('### Measured') < section.indexOf('### Recommended'),
    'facts come before advice');
  // Recommendations only cover states with no measurement. Match the bullet
  // label, not the word — "remove hover/active feedback" legitimately mentions
  // hover inside the *disabled* recommendation.
  const recs = section.slice(section.indexOf('### Recommended'));
  assert.ok(!/^- \*\*hover\*\*/m.test(recs),
    'hover was measured, so it must not be offered as a recommendation');
  ['focus', 'active', 'disabled'].forEach(st => {
    assert.match(recs, new RegExp('^- \\*\\*' + st + '\\*\\*', 'm'), `${st} should be recommended`);
  });
});

// ── low-confidence flags ───────────────────────────────────────────────────

test('heuristic visual flags need a second signal', () => {
  const t = fixture('vibedesign-dashboard');
  // The fixture claims glassmorphism and noise with nothing to back them.
  // Claim all three with nothing to back them.
  t.visualProfile.hasGlassmorphism = true;
  t.visualProfile.hasNoiseTexture = true;
  t.visualProfile.gradientStyle = 'aurora';
  t.filterEffects = null; t.subtleTextures = null; t.gradients = [];
  const bare = build.buildDesignMd(t, opts());
  assert.ok(!bare.includes('Glassmorphism'), 'unsupported glassmorphism must be omitted');
  assert.ok(!bare.includes('Noise texture'), 'unsupported noise must be omitted');
  assert.ok(!bare.includes('Gradient style'), 'gradientStyle with no gradients must be omitted');

  // Corroborate each and they may be stated.
  const t2 = fixture('vibedesign-dashboard');
  t2.visualProfile.hasGlassmorphism = true;
  t2.visualProfile.hasNoiseTexture = true;
  t2.visualProfile.gradientStyle = 'aurora';
  t2.filterEffects = { backdropFilter: 'blur(12px)' };
  t2.subtleTextures = [{ type: 'noise' }];
  t2.gradients = ['linear-gradient(180deg, #7c3aed, #22d3ee)'];
  const rich = build.buildDesignMd(t2, opts());
  assert.ok(rich.includes('Glassmorphism'));
  assert.ok(rich.includes('Noise texture'));
  assert.ok(rich.includes('Gradient style'));
});

test('layout reports repeating structures and the hero treatment', () => {
  const t = fixture('vibedesign-dashboard');
  t.masonryGrid = { name: 'problem-grid', columns: 3 };
  // UI patterns live under visualProfile.uiPatterns in real captures.
  t.visualProfile.uiPatterns = {
    hasPricingGrid: true, pricingColumnCount: 2, hasAccordion: true, hasMarquee: true,
  };
  // Real captures carry the hero fill in visualProfile.sectionRhythm[0].
  t.visualProfile.sectionRhythm = [
    { bgHex: 'oklch(0.6329 0.2075 31.49)', isFullBleed: true, height: 538 },
    { bgHex: null, isFullBleed: true, height: 672 },
  ];
  t.visualProfile.spacingSystem = { cardGap: '12px' };

  const md = build.buildDesignMd(t, opts());
  const layout = md.slice(md.indexOf('## Layout'), md.indexOf('## Color usage'));
  // Page-level geometry stays in Layout; repeating structures move to anatomy.
  const anatomy = md.slice(md.indexOf('## Component anatomy'));
  assert.match(anatomy, /masonry grid \(3 col\) \| 3 columns/);
  assert.match(anatomy, /pricing grid \| 2 columns/);
  assert.match(anatomy, /\| Accordion \|/);
  assert.match(anatomy, /\| Marquee \|/);
  // The hero colour is resolved from oklch to hex and marked full-bleed.
  assert.match(layout, /Hero background \| `#ed462d` \(full-bleed\)/);
  assert.match(layout, /Card gap \| 12px/);
});

// ── rig.ai: a real capture, asserted against the live site ────────────────
// Every expectation below was verified against rig.ai itself, so a regression
// here means the builder has started describing a site incorrectly — not that
// a synthetic fixture drifted.

test('rig: colour roles match the live site', () => {
  const cu = require(path.join(__dirname, '..', 'lib', 'color-utils.js'));
  const c = build._deriveColors(fixture('rig-ai'));

  assert.equal(c.background, '#0a0a0a', 'background comes from pageBackground');
  assert.equal(c.accent, '#ed462d', 'the red is the accent — hero, badges, icons, glow');

  // The primary button is painted in the page background: an inverse button.
  // The extractor flagged the ambiguity, so frequency_primary wins.
  assert.equal(c._meta.inverseButton, true);
  assert.equal(c.primary, '#ed462d');

  // Red outnumbers everything as a border count, but it is not a border colour.
  assert.notEqual(c.border, '#ed462d');
  assert.equal(c.border, '#2a2a29', 'paper at 14% over the page background (--border)');

  // No text token may be darker than the background on a dark theme.
  const bgLum = cu.wcagLuminance(c.background);
  ['text-primary', 'text-secondary', 'text-muted'].forEach(k => {
    if (!c[k]) return;
    assert.ok(cu.wcagLuminance(c[k]) > bgLum, `${k} (${c[k]}) is darker than the background`);
  });

  // Nothing fabricated: rig's hoverStates measure no button background that
  // reads as a primary hover, so the token must be absent.
  assert.ok(!('primary-hover' in c), 'primary-hover must not be invented');
});

test('rig: chamfer, motion, states and required sections', () => {
  const t = fixture('rig-ai');
  const md = build.buildDesignMd(t, opts());

  // Shape: a clip-path polygon, not a radius.
  assert.match(md, /^  button: "0px"$/m);
  assert.ok(md.includes('chamfer'), 'the chamfer must be described');
  assert.ok(md.includes('14px'), 'the --chamfer size must appear');
  assert.ok(md.includes('clip-path: polygon('));

  // Motion: rig declares 16 keyframes.
  const kf = md.slice(md.indexOf('### Keyframes'), md.indexOf('### Ambient loops'));
  const kfRows = (kf.match(/^\| `/gm) || []).length;
  assert.ok(kfRows >= 5, `expected >= 5 keyframes listed, got ${kfRows}`);
  assert.ok(kf.includes('scale 1 → 2'), 'pulse-ring');
  assert.ok(kf.includes('seamless marquee loop'), 'ticker');
  assert.ok(kf.includes('blur 8px → 12px'), 'hdr-glow-pulse');
  // And it must admit which ones it could not fully capture.
  assert.ok(kf.includes('not fully captured'), 'undescribed keyframes must say so');

  // Interaction states: rig has 21 measured hovers.
  const states = md.slice(md.indexOf('### Measured'), md.indexOf('### Recommended'));
  const stateRows = (states.match(/^\| /gm) || []).length - 2;   // minus header+rule
  assert.ok(stateRows >= 8, `expected >= 8 measured rows, got ${stateRows}`);
  assert.ok(states.includes('4px 4px 0 #'), 'the brutalist offset shadow must resolve');

  // Nothing unresolved reaches the reader — no var(), no raw colour function.
  assert.ok(!md.includes('var(--'), 'an unresolved var() reached the document');
  const body = md.slice(md.indexOf('# Rig'));
  assert.ok(!/oklch\(/.test(body), 'a raw oklch() reached the document body');
  assert.ok(md.includes('1px solid #2a2a29'), 'composite border colours must resolve');
  // "ease, ease" is one easing repeated.
  assert.match(md, /\| Dominant easing \| ease \|/);

  // All required sections, free and pro.
  [...REQUIRED, ...DEEP_SECTIONS].forEach(h => assert.ok(md.includes(h), `missing "${h}"`));
  assert.ok(md.includes('## Elevation & shadows'));

  // The style line must describe this site, not a generic one.
  const style = parseFrontmatter(md).scalars.style;
  assert.match(style, /dark/);
  assert.match(style, /chamfered/);
  assert.ok(!/monochrome/.test(style), 'an accent-led site is not monochrome');
});

test('rig: layout and accessibility read from the real field paths', () => {
  const md = build.buildDesignMd(fixture('rig-ai'), opts());
  const layout = md.slice(md.indexOf('## Layout'), md.indexOf('## Color usage'));

  assert.ok(layout.includes('128px'), 'sectionPaddingY from visualProfile.spacingSystem');
  // A concrete width from visualProfile.spacingSystem, not layoutInfo.maxWidth
  // ("none"). The value is viewport-dependent, so assert the shape.
  assert.match(layout, /Container max-width \| (\d+px|\d+%)/,
    'containerMaxWidth, not layoutInfo.maxWidth "none"');
  assert.ok(layout.includes('24px'), 'cardGap');
  assert.ok(layout.includes('#ed462d'), 'hero background from sectionRhythm[0].bgHex');
  const anat = md.slice(md.indexOf('## Component anatomy'));
  assert.match(anat, /masonry grid \(3 col\) \| 3 columns/);
  assert.match(anat, /pricing grid \| 2 columns/);
  assert.match(anat, /\| Accordion \|/);
  assert.match(anat, /\| Marquee \|/);

  // Desktop-first: these are max-width queries and must not be mislabelled.
  assert.ok(md.includes('desktop-first'), 'max-width breakpoints must be labelled');

  // The hero heading is #0a0a0a on #ed462d — its own contrast pairing.
  const a11y = md.slice(md.indexOf('## Accessibility notes'));
  assert.ok(a11y.includes('hero heading'), 'the hero pairing must be computed');
  assert.match(a11y, /#0a0a0a` on hero `#ed462d/);

  // Heuristic flags with no corroboration stay out.
  assert.ok(!md.includes('Glassmorphism'), 'filterEffects is null — omit');
  assert.ok(!md.includes('Noise texture'), 'subtleTextures is null — omit');
  assert.ok(!md.includes('aurora'), 'gradients is empty — omit gradientStyle');
});

test('rig: typography lists every face including the pixel label', () => {
  const md = build.buildDesignMd(fixture('rig-ai'), opts());
  ['Chalet', 'Instrument Sans', 'Chivo Mono', 'Geist Pixel Square']
    .forEach(f => assert.ok(md.includes(f), `${f} missing`));
  // Per-step tracking, not a floating list.
  // Tracking is per-step and viewport-dependent; assert the signs, which are
  // the actual design decision — negative on display, positive on labels.
  const scale = md.slice(md.indexOf('### Scale'), md.indexOf('Weights in use'));
  assert.match(scale, /^\| `h1` \|[^|]*\|[^|]*\|[^|]*\| -\d/m, 'h1 tracking is negative');
  assert.match(scale, /^\| `label` \|[^|]*\|[^|]*\|[^|]*\| \d/m, 'label tracking is positive');
  assert.ok(md.includes('uppercase'), 'label transform');
});

// ── hoverStates.before is the BASE state, not a pseudo-element ─────────────

test('rig: interaction rows read base → hover and never say ::before', () => {
  const md = build.buildDesignMd(fixture('rig-ai'), opts());
  const states = md.slice(md.indexOf('## Interaction states'), md.indexOf('## Component anatomy'));

  assert.ok(!md.includes('::before'), '`before` is the base state, not a pseudo-element');
  // The table now carries an explicit State column (hover rows plus a measured
  // focus row), with the change column still reading base → hover.
  assert.match(states, /\| Component \| Variant \| State \| Change \|/,
    'the measured table must name the state explicitly');
  assert.ok(states.includes("reads base → hover"), 'and explain the base → hover cells');
  // The accent-filled CTA starts red and keeps its fill; only the shadow moves.
  assert.match(states, /`accent-fill A` \| hover \| background: `#ed462d` → —/);
  // The brutalist offset shadow is a genuine base → hover transition.
  assert.match(states, /box-shadow: `[^`]*40px[^`]*` → `4px 4px 0 #2b4fff`/);
  // submit-button darkens on hover: both sides captured.
  assert.match(states, /background: `#ed462d` → `#d93d26`/);
});

test('rig: rows are labelled by variant and duplicates collapse', () => {
  const md = build.buildDesignMd(fixture('rig-ai'), opts());
  const states = md.slice(md.indexOf('### Measured'), md.indexOf('### Recommended'));

  ['accent-fill A', 'outline', 'ghost', 'bordered A', 'muted']
    .forEach(v => assert.ok(states.includes('`' + v + '`'), `variant ${v} missing`));

  // The five identical card rules collapse to a single unlabelled row: they
  // share a base state and a change, so they are one behaviour.
  const cardRows = states.split('\n').filter(l => /^\| Card \| — \|/.test(l));
  assert.equal(cardRows.length, 1, 'identical card rules must collapse to one row');

  // Collapsing must not swallow genuinely different behaviour: the two
  // distinct card rules (the card, and its accent child) both survive.
  assert.ok(states.includes('`bordered A`') && states.includes('`filled`'),
    'distinct card behaviours must remain separate rows');

  // Class names are safe; element text is not.
  assert.ok(!states.includes(SENTINEL));
});

// ── surface context ───────────────────────────────────────────────────────

test('rig: hero-measured components are flagged and composited over the hero', () => {
  const md = build.buildDesignMd(fixture('rig-ai'), opts());
  const buttons = md.slice(md.indexOf('### Buttons'), md.indexOf('### Inputs'));

  assert.ok(buttons.includes('Surface context'), 'the hero sampling must be declared');
  assert.ok(buttons.includes('#ed462d'), 'the hero surface must be named');
  assert.ok(buttons.includes('Measured on the hero surface'), 'per-variant note');
  // rgba(10,10,10,0.3) over #ed462d, not over #0a0a0a.
  assert.ok(buttons.includes('2px solid #a93423'),
    'the ghost border must composite over the hero, not the page background');

  // A link colour equal to the page background is called out, with the
  // on-page equivalent taken from the body-copy hover rule.
  const links = md.slice(md.indexOf('### Links'), md.indexOf('### Footer'));
  assert.ok(links.includes('Sampled off the page background'));
  assert.ok(links.includes('1.00:1'), 'the invisible contrast must be stated');
  assert.ok(links.includes('`#f0ede6`'), 'the on-page link colour must be supplied');
});

test('a component measured on the page background gets no surface note', () => {
  // vibedesign-dashboard has no hero fill distinct from the page.
  const md = build.buildDesignMd(fixture('vibedesign-dashboard'), opts());
  assert.ok(!md.includes('Surface context'));
  assert.ok(!md.includes('Measured on the hero surface'));
});

// ── the accent-fill rule is conditional ───────────────────────────────────

test('the accent rule adapts when the site fills a section with the accent', () => {
  // rig paints its hero in the accent, so forbidding large fills would
  // contradict the document's own Layout section.
  const rig = build.buildDesignMd(fixture('rig-ai'), opts());
  assert.match(rig, /^- The accent `#ed462d` is used as a full-bleed fill only for the hero/m);
  assert.ok(!/Do not use `#ed462d` for large background fills/.test(rig));

  // Where the accent is never a section background, the prohibition stands.
  // PostHog never paints a section in its accent, so the prohibition stands.
  const saas = build.buildDesignMd(fixture('posthog'), opts());
  assert.match(saas, /Do not use `#[0-9a-f]{6}` for large background fills/);
});

// ── snapshot: the whole document, on every fixture ────────────────────────
// One document, no tiers. These snapshots are the regression net for the
// builder as a whole: any change to wording, ordering or derived values shows
// up as a diff here. Refresh them deliberately with:
//
//     UPDATE_SNAPSHOTS=1 node --test tests/design-md-builder.test.js
//
// and read the diff before committing — a snapshot updated without being read
// is worse than no snapshot.

const SNAP_DIR = path.join(__dirname, 'snapshots');

ALL.forEach(name => {
  test(`${name}: full document matches its snapshot`, () => {
    const md = build.buildDesignMd(fixture(name), opts());
    const file = path.join(SNAP_DIR, `${name}.md`);

    if (process.env.UPDATE_SNAPSHOTS === '1') {
      fs.mkdirSync(SNAP_DIR, { recursive: true });
      fs.writeFileSync(file, md);
      return;
    }

    assert.ok(fs.existsSync(file),
      `no snapshot for ${name} — create it with UPDATE_SNAPSHOTS=1`);
    const expected = fs.readFileSync(file, 'utf8');
    if (expected !== md) {
      // Point at the first differing line rather than dumping 14k chars.
      const a = expected.split('\n'), b = md.split('\n');
      let i = 0;
      while (i < a.length && i < b.length && a[i] === b[i]) i++;
      assert.fail(`${name} drifted from its snapshot at line ${i + 1}\n`
        + `  snapshot: ${JSON.stringify(a[i])}\n`
        + `  actual:   ${JSON.stringify(b[i])}\n`
        + `  (${a.length} → ${b.length} lines; UPDATE_SNAPSHOTS=1 to accept)`);
    }
  });
});

test('every snapshot contains the full section set — no tiering left', () => {
  RICH.forEach(name => {
    const snap = fs.readFileSync(path.join(SNAP_DIR, `${name}.md`), 'utf8');
    [...REQUIRED, ...DEEP_SECTIONS].forEach(h => {
      assert.ok(snap.includes(h), `${name} snapshot is missing "${h}"`);
    });
    assert.ok(!/VibeDesign Pro/.test(snap), 'the upgrade footer must be gone');
    assert.ok(!/\btier\b/i.test(snap), 'no tier language may remain');
  });
});

test('vector animation is read from the shape the extractor actually emits', () => {
  // detectRiveAndLottie returns { hasRive, hasLottie, hasDotLottie,
  // details: [{ type, location, size }] }. An earlier version of the builder
  // read totalCount/type/loop/autoplay, a shape nothing produces, so the
  // section silently never rendered for a real capture.
  const t = fixture('vibedesign-dashboard');
  t.riveAndLottie = {
    hasRive: true, hasLottie: true, hasDotLottie: false,
    details: [
      { type: 'rive', location: 'above-fold', size: { w: 480, h: 320 } },
      { type: 'lottie', location: 'below-fold', size: { w: 240, h: 240 } },
      { type: 'dotlottie', count: 3 },
    ],
  };
  const md = build.buildDesignMd(t, opts());
  const sec = md.slice(md.indexOf('### Vector & canvas animation'));
  assert.ok(md.includes('### Vector & canvas animation'));
  assert.match(sec, /`rive` \| 1 \| 480×320 \| above-fold/);
  assert.match(sec, /`lottie` \| 1 \| 240×240 \| below-fold/);
  assert.match(sec, /`dotlottie` \| 3/, 'a details entry with its own count is honoured');

  // The invented shape must produce nothing rather than a phantom section.
  const bogus = fixture('vibedesign-dashboard');
  bogus.riveAndLottie = { totalCount: 2, type: 'lottie', loop: true, autoplay: true };
  assert.ok(!build.buildDesignMd(bogus, opts()).includes('### Vector & canvas animation'),
    'a shape the extractor never emits must not render a section');
});

// ── A1: the source's class names must never reach the document ────────────

test('rig: no source class name or selector appears anywhere in the document', () => {
  const t = fixture('rig-ai');
  const md = build.buildDesignMd(t, opts());

  // Every class the capture carries, from selectors, section markup and grids.
  const classes = new Set();
  (t.hoverStates || []).forEach(h => {
    (String(h.selector || '').match(/\.([a-z][a-z0-9_-]*)/gi) || [])
      .forEach(c => classes.add(c.slice(1)));
  });
  (t.sectionContentMap || []).forEach(sec => {
    String(sec.className || '').split(/\s+/).forEach(c => { if (c) classes.add(c); });
  });
  if (t.masonryGrid && t.masonryGrid.class) classes.add(t.masonryGrid.class);

  // "hero" and "content" are ordinary layout words that appear in our own
  // prose; only distinctive, compound class names are meaningful here.
  const GENERIC = new Set(['hero', 'content', 'grid', 'section', 'card']);
  const meaningful = [...classes].filter(c => !GENERIC.has(c) && c.length > 3);
  assert.ok(meaningful.length > 10, 'the fixture should carry many class names to test against');

  const leaked = meaningful.filter(c => md.includes(c));
  assert.deepEqual(leaked, [],
    `class names leaked into DESIGN.md: ${leaked.join(', ')}`);

  // Nor any raw selector fragment.
  assert.ok(!md.includes(':hover '), 'a raw selector reached the document');
  assert.ok(!md.includes('data-astro-cid'), 'a framework attribute selector leaked');
});

test('variants are derived from style, not from the class', () => {
  const md = build.buildDesignMd(fixture('rig-ai'), opts());
  const states = md.slice(md.indexOf('### Measured'), md.indexOf('### Recommended'));

  // rig has two accent-filled CTAs, two inverse-filled buttons, an outline, a
  // ghost and a muted one — all distinguishable from their base fill alone.
  ['accent-fill A', 'accent-fill B', 'inverse-fill A', 'inverse-fill B',
   'outline', 'ghost', 'muted'].forEach(v => {
    assert.ok(states.includes('`' + v + '`'), `missing button variant "${v}"`);
  });
  ['bordered A', 'bordered B', 'filled'].forEach(v => {
    assert.ok(states.includes('`' + v + '`'), `missing card variant "${v}"`);
  });

  // A/B only where a label repeats — a unique variant carries no suffix.
  assert.ok(!states.includes('`outline A`'), 'a unique variant must not be suffixed');
});

test('an unclassifiable button is left unlabelled rather than guessed', () => {
  // posthog hover rules carry no base state, so the base fill is unknown.
  // "ghost" would be a positive claim that the button has no fill.
  const md = build.buildDesignMd(fixture('posthog'), opts());
  const states = md.slice(md.indexOf('### Measured'), md.indexOf('### Recommended'));
  assert.match(states, /^\| Button \| — \|/m, 'unknown base must render as —');
  assert.ok(!states.includes('`ghost`'), 'must not guess ghost without evidence');
});

test('grids are described structurally, never by their class', () => {
  const md = build.buildDesignMd(fixture('rig-ai'), opts());
  const grids = md.slice(md.indexOf('### Grids'), md.indexOf('### Patterns'));
  assert.ok(!grids.includes('problem-grid'), 'the masonry class must not appear');
  assert.ok(grids.includes('masonry grid (3 col)'));
  assert.ok(grids.includes('3-column grid with 1px dividers'),
    'narrow tracks between columns are dividers and should be named');
});

// ── A2: font availability ─────────────────────────────────────────────────

test('the fonts table separates where a face is hosted from how it is licensed', () => {
  const rig = build.buildDesignMd(fixture('rig-ai'), opts());
  const fonts = rig.slice(rig.indexOf('## Fonts & availability'), rig.indexOf('## Components'));
  ['Chalet', 'Geist Pixel Square', 'Instrument Sans', 'Chivo Mono']
    .forEach(f => assert.ok(fonts.includes(f), `${f} missing`));

  // rig.ai self-hosts all four. Two are openly licensed and two are not, and
  // the old wording — "self-hosted (not freely available)" — asserted the
  // opposite of the truth for the open pair.
  assert.ok(!fonts.includes('not freely available'),
    'self-hosting says nothing about a licence');
  assert.match(fonts, /`Instrument Sans` \| open \(Google Fonts\) — self-hosted copy/);
  assert.match(fonts, /`Chivo Mono` \| open \(Google Fonts\) — self-hosted copy/);
  assert.match(fonts, /`Chalet` \| self-hosted, licence unknown — likely proprietary/);

  // An open family gets no substitute, and must not appear in that table.
  const subs = rig.slice(rig.indexOf('### Substitutes'), rig.indexOf('## Components'));
  assert.ok(subs.includes('Chalet'), 'a proprietary face still needs an alternative');
  assert.ok(!subs.includes('Chivo Mono'),
    'Chivo Mono is on Google Fonts — offering a replacement for it is noise');
  assert.ok(!subs.includes('Instrument Sans |'),
    'Instrument Sans is obtainable; it does not belong in a substitutes table');

  // The claim made about unknown-licence families must not overreach.
  assert.match(fonts, /not that the family is proprietary/);

  const saas = build.buildDesignMd(fixture('posthog'), opts());
  const sf = saas.slice(saas.indexOf('## Fonts & availability'), saas.indexOf('## Spacing'));
  assert.match(sf, /`IBM Plex Sans Variable` \| open \(Google Fonts\)/,
    'a variable cut is the same family as its static one');
  assert.ok(sf.includes('RoundHog'));
});

test('substitutes are labelled as suggestions and never self-referential', () => {
  const md = build.buildDesignMd(fixture('rig-ai'), opts());
  const sub = md.slice(md.indexOf('### Substitutes'), md.indexOf('## Components'));

  assert.match(sub, /suggested, not observed/);
  assert.match(sub, /\*\*suggestions, not measurements\*\*/);
  // Classification-appropriate alternatives, for the two families that need one.
  assert.match(sub, /`Chalet` \| Inter Tight or Space Grotesk/);
  assert.match(sub, /`Geist Pixel Square` \| Silkscreen or Press Start 2P/);

  // Instrument Sans and Chivo Mono are both on Google Fonts. The old table
  // listed Chivo Mono as needing a substitute and gave Instrument Sans a row
  // explaining it did not — both belong in the availability table instead, and
  // neither should be here at all.
  assert.ok(!sub.includes('Chivo Mono'),
    'an openly-licensed family needs no substitute');
  assert.ok(!sub.includes('Instrument Sans'),
    'an openly-licensed family does not belong in a substitutes table');
  assert.ok(!/`([^`]+)` \| [^|]*\1/.test(sub),
    'no family may be recommended to itself');
});

test('hsl() and bare HSL triplets parse — Tailwind and shadcn depend on it', () => {
  const cu = require(path.join(__dirname, '..', 'lib', 'color-utils.js'));
  assert.equal(cu.compositeOver('hsl(0 0% 14%)', '#111113'), '#242424');
  assert.equal(cu.compositeOver('hsl(0, 0%, 56.1%)', '#111113'), '#8f8f8f');
  assert.equal(cu.compositeOver('0 0% 14%', '#111113'), '#242424', 'shadcn triplet');
  // Alpha composites over the page rather than being printed raw.
  assert.equal(cu.compositeOver('hsl(247 91% 54% / .4)', '#111113'), '#21176d');
});

test('a layered elevation stack is not rejected for length', () => {
  // shadcn's default shadow is a six-layer stack at ~226 characters. The
  // accessor cap exists to reject prose, not real design tokens.
  const md = build.buildDesignMd(fixture('vibedesign-dashboard'), opts());
  assert.match(md, /^shadows:$/m, 'the dashboard must emit a shadows block');
  assert.ok(md.includes('16px 16px -8px'), 'the deepest layer must survive');
});

test('a keyframe whose frames are custom properties says nothing rather than var()', () => {
  // Tailwind's enter/exit keyframes are entirely --tw-* variables; Radix's
  // accordion frames are --radix-*. Neither describes a delta we can state.
  const md = build.buildDesignMd(fixture('vibedesign-dashboard'), opts());
  assert.ok(!md.includes('var(--'), 'no custom property may reach the document');
  const kf = md.slice(md.indexOf('### Keyframes'));
  assert.ok(kf.includes('`enter`'), 'the keyframe is still listed');
  assert.ok(kf.includes('not fully captured'), 'and honestly marked');
});

test('the capture viewport is declared, and omitted when unknown', () => {
  // Type scales, container widths and grid templates are all responsive. An
  // agent reading a 112px h1 has no way to know that without being told the
  // width it was observed at.
  ['rig-ai', 'posthog'].forEach(name => {
    const md = build.buildDesignMd(fixture(name), opts());
    assert.match(md, /^viewport: "1440×900"\s+# px values in the type scale and layout are as observed at this width$/m,
      `${name} must declare its capture viewport`);
    // It sits in the frontmatter, above the body.
    assert.ok(md.indexOf('viewport:') < md.indexOf('\n---\n'));
  });

  // The dashboard is a manual capture that predates the field. A wrong
  // viewport is worse than none, so it is omitted rather than guessed.
  const manual = fixture('vibedesign-dashboard');
  assert.equal(manual.viewport, undefined, 'this fixture has no recorded viewport');
  assert.ok(!build.buildDesignMd(manual, opts()).includes('viewport:'),
    'an unknown viewport must not be invented');

  // A malformed value is treated as absent rather than printed.
  const bad = fixture('rig-ai');
  bad.viewport = { width: 'wide', height: null };
  assert.ok(!build.buildDesignMd(bad, opts()).includes('viewport:'));
});

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
const RICH = ['light-saas', 'dark-dev-tool', 'rig-ai'];
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
    const t = fixture(name);
    assert.ok(md.includes('### Buttons'), `${name} is missing "### Buttons"`);
    assert.ok(md.includes('### Inputs'), `${name} is missing "### Inputs"`);
    assert.equal(md.includes('### Cards'), !!t.cardStyles,
      `${name}: the Cards block must appear exactly when cardStyles exists`);
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
  assert.equal(build._siteName('https://www.northwind.io/pricing'), 'Northwind');
  assert.equal(build._siteName('https://forge-cli.dev'), 'Forge Cli');
  assert.equal(build._siteName('not a url'), 'Untitled');
  // A logoText full of copy must not influence it.
  const md = build.buildDesignMd(fixture('light-saas'), opts());
  assert.match(md, /^name: "Northwind Design System"$/m);
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
  const tokens = fixture('light-saas');
  const before = JSON.stringify(tokens);
  build.buildDesignMd(tokens, opts());
  assert.equal(JSON.stringify(tokens), before);
});

test('output never depends on the clock', () => {
  // No observedAt → the comment is simply omitted, rather than stamped with
  // Date.now(), which would break reproducibility.
  const a = build.buildDesignMd(fixture('light-saas'), { version: '3.0.0' });
  assert.ok(!/# observed on/.test(a));
  assert.equal(a, build.buildDesignMd(fixture('light-saas'), { version: '3.0.0' }));
});

// ── formatting rules ───────────────────────────────────────────────────────

test('sizes carry both px and rem; colors are hex', () => {
  const md = build.buildDesignMd(fixture('light-saas'), opts());
  assert.match(md, /16px \(1rem\)/);
  assert.match(md, /56px \(3\.5rem\)/);
  // No rgb()/hsl() color functions outside shadow values.
  md.split('\n').forEach(line => {
    if (/box-shadow|Shadow|shadows:|inset|rgba\(/.test(line)) return;
    assert.ok(!/\brgb\(/.test(line), `raw rgb() in output: ${line}`);
  });
});

test('value-heavy sections use tables', () => {
  const md = build.buildDesignMd(fixture('light-saas'), opts());
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
  const page = build.buildDesignMd(fixture('light-saas'), opts({ scope: 'page' }));
  const card = build.buildDesignMd(fixture('light-saas'), opts({ scope: 'component' }));

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

test('colors are assigned to the role they are most used for', () => {
  // #e2e8f0 appears 74x as a border and only 8x as a background, so it must
  // land on `border` — not get consumed as a surface first.
  const c = build._deriveColors(fixture('light-saas'));
  assert.equal(c.border, '#e2e8f0');
  assert.equal(c.background, '#ffffff');
  assert.equal(c.surface, '#f8fafc');
  // text-primary is the highest-contrast text color, not merely body.color.
  assert.equal(c['text-primary'], '#0f172a');
  assert.equal(c['text-secondary'], '#475569');
});

test('hover colours are measured, never synthesised', () => {
  // A derived hover shade is a guess presented as a fact. The token may only
  // appear when hoverStates actually measured one.
  const light = build._deriveColors(fixture('light-saas'));
  assert.equal(light['primary-hover'], '#1d4ed8',
    'must come from the .btn-primary:hover measurement');

  const dark = build._deriveColors(fixture('dark-dev-tool'));
  assert.equal(dark['primary-hover'], '#6d28d9');

  // Strip the measurements and the key must disappear rather than be invented.
  const noHover = fixture('light-saas');
  noHover.hoverStates = [];
  const derived = build._deriveColors(noHover);
  assert.ok(!('primary-hover' in derived),
    'with nothing measured there must be no primary-hover token');

  // And it must not reappear anywhere in the document.
  const md = build.buildDesignMd(noHover, opts());
  assert.ok(!md.includes('primary-hover'));
});

test('a colour may fill two roles rather than one being dropped', () => {
  // On most sites the primary action IS the accent. Emitting both, aliased,
  // is more useful than silently losing the `primary` role to dedup.
  const c = build._deriveColors(fixture('light-saas'));
  assert.equal(c.accent, '#2563eb');
  assert.equal(c.primary, '#2563eb');
});

test('accessibility notes flag pairings below 4.5:1', () => {
  const md = build.buildDesignMd(fixture('dark-dev-tool'), opts());
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
  // In popup/sidepanel there is no require(): color-utils.js declares its
  // helpers as top-level globals and design-md-builder.js picks them up off
  // `self`. Simulate exactly that load order.
  const vm = require('node:vm');
  const sandbox = { console: { warn() {}, log() {}, error() {} }, Math, JSON, Date, URL, RegExp,
    Object, Array, String, Number, parseInt, parseFloat, isNaN, Infinity };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const read = f => fs.readFileSync(path.join(__dirname, '..', 'lib', f), 'utf8');
  vm.runInContext(read('color-utils.js'), sandbox, { filename: 'lib/color-utils.js' });
  vm.runInContext(read('design-md-builder.js'), sandbox, { filename: 'lib/design-md-builder.js' });

  assert.ok(sandbox.VD_DESIGN_MD, 'the builder must expose self.VD_DESIGN_MD');
  sandbox.__tokens = fixture('light-saas');
  const md = vm.runInContext(
    'VD_DESIGN_MD.buildDesignMd(__tokens, {version:"3.0.0", observedAt:"2026-08-29"})',
    sandbox);

  // Byte-identical to the Node path — same code, same color math.
  assert.equal(md, build.buildDesignMd(fixture('light-saas'), opts()));
  // Contrast ratios really were computed, i.e. the globals resolved.
  assert.match(md, /## Accessibility notes/);
  assert.match(md, /\d+\.\d\d:1/);
});

// ── dev affordances must not reach packaged builds ─────────────────────────

test('the Developer section is gated on an unpacked build', () => {
  const ui = fs.readFileSync(path.join(__dirname, '..', 'lib', 'ui-helpers.js'), 'utf8');

  // The gate: a packaged Web Store build has an update_url; an unpacked one
  // does not.
  assert.match(ui, /function isUnpackedBuild\(\)[\s\S]{0,200}update_url/,
    'isUnpackedBuild must key off manifest.update_url');

  // It ships hidden and is revealed only behind the gate.
  assert.match(ui, /id="settingsDev" style="display:none"/,
    'the Developer section must be hidden in the template');

  const gate = ui.indexOf('if (isUnpackedBuild())');
  assert.notEqual(gate, -1, 'the reveal must be gated');
  const open = ui.indexOf('{', gate);
  let depth = 0, close = -1;
  for (let k = open; k < ui.length; k++) {
    if (ui[k] === '{') depth++;
    else if (ui[k] === '}') { depth--; if (depth === 0) { close = k; break; } }
  }
  assert.notEqual(close, -1, 'the guard block must be balanced');
  const inGuard = pos => pos > open && pos < close;

  assert.ok(inGuard(ui.indexOf("devSection.style.display = 'block'")),
    'the reveal must sit inside the gate');
  assert.ok(inGuard(ui.indexOf("$('devTokensJsonBtn')")),
    'the raw-capture button must only be wired up for unpacked builds');
  assert.equal(ui.split("devSection.style.display = 'block'").length - 1, 1,
    'the Developer section must be revealed in exactly one place');

  // The old dashed dev strip is gone entirely.
  ['devToolsRow', 'dev-tools-row', 'devDesignMdFreeBtn', 'devDesignMdProBtn',
   'devDlFreeBtn', 'devDlProBtn'].forEach(gone => {
    assert.ok(!ui.includes(gone), `the dev strip remnant "${gone}" must be removed`);
  });
});

test('the result area exposes exactly two actions, for every user', () => {
  const ui = fs.readFileSync(path.join(__dirname, '..', 'lib', 'ui-helpers.js'), 'utf8');
  const block = ui.slice(ui.indexOf('<div class="result-actions">'),
                         ui.indexOf('</div>', ui.indexOf('<div class="result-actions">')));

  // Button ids only — `copyIcon` is a span inside the copy button.
  const ids = (block.match(/<button[^>]*\bid="([a-zA-Z]+)"/g) || [])
    .map(m => m.match(/id="([a-zA-Z]+)"/)[1]);
  assert.deepEqual(ids, ['copyBtn', 'downloadDesignBtn', 'resetBtn'],
    'the result actions are Copy prompt, Download DESIGN.md, and the reset control');
  assert.ok(block.includes('Copy prompt'));
  assert.ok(block.includes('Download DESIGN.md'));

  // Neither action is behind the dev guard — they are for all users.
  const gate = ui.indexOf('if (isUnpackedBuild())');
  assert.ok(ui.indexOf("$('downloadDesignBtn')") < gate,
    'Download DESIGN.md must be wired up outside the unpacked guard');

  // The W3C export is retained in the codebase but nothing in the UI calls it.
  assert.ok(!ui.includes('exportTokensBtn'), 'the JSON export button must be gone');
  assert.ok(!ui.includes('downloadTokensJSON'), 'nothing in the UI may call the exporter');
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'lib', 'token-exporter.js')),
    'lib/token-exporter.js is kept for Prompt 2');
});

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
  const c = build._deriveColors(fixture('dark-dev-tool'));
  const bgLum = cu.wcagLuminance(c.background);
  ['text-primary', 'text-secondary', 'text-muted'].forEach(k => {
    if (!c[k]) return;
    assert.ok(cu.wcagLuminance(c[k]) > bgLum,
      `${k} (${c[k]}) is darker than the background on a dark theme`);
  });
});

// ── shape language ─────────────────────────────────────────────────────────

test('a polygon clip-path zeroes the radius and is described instead', () => {
  const t = fixture('dark-dev-tool');
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
  const t = fixture('dark-dev-tool');
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
  const t = fixture('dark-dev-tool');
  t.transitions = ['all 200ms ease, ease', 'all 200ms ease, ease', 'color 100ms ease-out'];
  const md = build.buildDesignMd(t, opts());
  assert.ok(!md.includes('ease, ease'), 'duplicated easing must be collapsed');
});

// ── measured vs recommended ────────────────────────────────────────────────

test('measured interaction states are visibly separated from recommendations', () => {
  const md = build.buildDesignMd(fixture('dark-dev-tool'), opts());
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
  const t = fixture('dark-dev-tool');
  // The fixture claims glassmorphism and noise with nothing to back them.
  const bare = build.buildDesignMd(t, opts());
  assert.ok(!bare.includes('Glassmorphism'), 'unsupported glassmorphism must be omitted');
  assert.ok(!bare.includes('Noise texture'), 'unsupported noise must be omitted');
  assert.ok(!bare.includes('Gradient style'), 'gradientStyle with no gradients must be omitted');

  // Corroborate each and they may be stated.
  const t2 = fixture('dark-dev-tool');
  t2.filterEffects = { backdropFilter: 'blur(12px)' };
  t2.subtleTextures = [{ type: 'noise' }];
  t2.gradients = ['linear-gradient(180deg, #7c3aed, #22d3ee)'];
  const rich = build.buildDesignMd(t2, opts());
  assert.ok(rich.includes('Glassmorphism'));
  assert.ok(rich.includes('Noise texture'));
  assert.ok(rich.includes('Gradient style'));
});

test('layout reports repeating structures and the hero treatment', () => {
  const t = fixture('dark-dev-tool');
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
  assert.match(anatomy, /problem-grid \| 3 columns/);
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
  assert.ok(layout.includes('90%'), 'containerMaxWidth, not layoutInfo.maxWidth "none"');
  assert.ok(layout.includes('24px'), 'cardGap');
  assert.ok(layout.includes('#ed462d'), 'hero background from sectionRhythm[0].bgHex');
  const anat = md.slice(md.indexOf('## Component anatomy'));
  assert.match(anat, /problem-grid \| 3 columns/);
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
  assert.ok(md.includes('-3.3344px'), 'h1 tracking');
  assert.ok(md.includes('1.28px'), 'label tracking');
  assert.ok(md.includes('uppercase'), 'label transform');
});

// ── hoverStates.before is the BASE state, not a pseudo-element ─────────────

test('rig: interaction rows read base → hover and never say ::before', () => {
  const md = build.buildDesignMd(fixture('rig-ai'), opts());
  const states = md.slice(md.indexOf('## Interaction states'), md.indexOf('## Component anatomy'));

  assert.ok(!md.includes('::before'), '`before` is the base state, not a pseudo-element');
  assert.ok(states.includes('Base → Hover'), 'the column must be labelled base → hover');
  // btn-cta starts red and keeps its fill; only the shadow changes.
  assert.match(states, /`btn-cta`[^|]*\|[^|]*background: `#ed462d` → —/);
  // The brutalist offset shadow is a genuine base → hover transition.
  assert.match(states, /box-shadow: `[^`]*40px[^`]*` → `4px 4px 0 #2b4fff`/);
  // submit-button darkens on hover: both sides captured.
  assert.match(states, /background: `#ed462d` → `#d93d26`/);
});

test('rig: rows are labelled by variant and duplicates collapse', () => {
  const md = build.buildDesignMd(fixture('rig-ai'), opts());
  const states = md.slice(md.indexOf('### Measured'), md.indexOf('### Recommended'));

  ['btn-cta', 'btn-outline', 'btn-ghost', 'offline-card', 'faq-question', 'footer-col']
    .forEach(v => assert.ok(states.includes('`' + v + '`'), `variant ${v} missing`));

  // The five svg-card sub-element rules are one behaviour.
  const svgRows = (states.match(/`svg-card`/g) || []).length;
  assert.equal(svgRows, 1, `svg-card should collapse to one row, got ${svgRows}`);

  // Collapsing must not swallow genuinely different behaviour: offline-card
  // has two distinct rules (the card, and its accent child).
  assert.equal((states.match(/`offline-card`/g) || []).length, 2);

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
  // dark-dev-tool has no hero fill distinct from the page.
  const md = build.buildDesignMd(fixture('dark-dev-tool'), opts());
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
  const saas = build.buildDesignMd(fixture('light-saas'), opts());
  assert.match(saas, /Do not use `#2563eb` for large background fills/);
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

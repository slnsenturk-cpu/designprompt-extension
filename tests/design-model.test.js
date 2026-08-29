// VibeDesign — design model suite.
//
// lib/design-model.js is the single normalised description of a site's design.
// Every consumer reads it, so a colour cannot come out one way in DESIGN.md and
// another way in tokens.json.
//
// The derivation logic was LIFTED from lib/design-md-builder.js rather than
// rewritten. These tests pin that: the model must agree with what the builder
// derives today, and its values must appear verbatim in the accepted DESIGN.md
// snapshots. If the extraction quietly changed a value, one of these fails —
// which is the point of doing it as a move.
//
// Run with:  node --test tests/design-model.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const model = require(path.join(__dirname, '..', 'lib', 'design-model.js'));
const build = require(path.join(__dirname, '..', 'lib', 'design-md-builder.js'));

const FIXTURES = path.join(__dirname, 'fixtures');
const SNAPSHOTS = path.join(__dirname, 'snapshots');
const SENTINEL = fs.readFileSync(path.join(FIXTURES, 'SENTINEL.txt'), 'utf8').trim();

const fixture = n => JSON.parse(fs.readFileSync(path.join(FIXTURES, n + '.json'), 'utf8'));
const snapshot = n => fs.readFileSync(path.join(SNAPSHOTS, n + '.md'), 'utf8');

const RICH = ['rig-ai', 'posthog', 'vibedesign-dashboard'];
const ALL = RICH.concat(['sparse']);

// ── equivalence with the builder ──────────────────────────────────────────

ALL.forEach(name => {
  test(`${name}: model colours are identical to the builder's`, () => {
    const fromModel = model.buildDesignModel(fixture(name)).colors;
    const fromBuilder = build._deriveColors(fixture(name));

    const strip = c => Object.keys(c).filter(k => k.charAt(0) !== '_')
      .reduce((acc, k) => { acc[k] = c[k]; return acc; }, {});
    assert.deepEqual(strip(fromModel), strip(fromBuilder),
      'the extraction must not have changed a single role');
  });
});

ALL.forEach(name => {
  test(`${name}: model values appear verbatim in the accepted document`, () => {
    const m = model.buildDesignModel(fixture(name));
    const md = snapshot(name);

    // Colours, exactly as the model resolved them.
    m.colorRoles.forEach(role => {
      assert.ok(md.includes(m.colors[role]),
        `${role} (${m.colors[role]}) is in the model but not in the document`);
    });

    // The type scale, step by step.
    model.SCALE_KEYS.forEach(step => {
      const d = m.typography.detail && m.typography.detail[step];
      if (!d || !d.size) return;
      assert.ok(md.includes(d.size), `${step} size ${d.size} missing from the document`);
    });

    // Spacing base, radius values, breakpoints.
    if (m.spacing) assert.ok(md.includes(m.spacing.base));
    Object.keys(m.radius).forEach(k => assert.ok(md.includes(m.radius[k]),
      `radius.${k} = ${m.radius[k]} missing`));
    if (m.breakpoints) {
      Object.keys(m.breakpoints).filter(k => k.charAt(0) !== '_')
        .forEach(k => assert.ok(md.includes(m.breakpoints[k])));
    }
    // Font families and their availability.
    m.fonts.forEach(f => {
      assert.ok(md.includes(f.family), `font ${f.family} missing`);
      assert.ok(md.includes(f.availability), `availability for ${f.family} missing`);
    });
  });
});

test('the model agrees with the builder on theme and shape', () => {
  const rig = model.buildDesignModel(fixture('rig-ai'));
  assert.equal(rig.theme.isDark, true);
  assert.equal(rig.theme.inverseButton, true, 'rig paints its CTA in the page background');
  assert.equal(rig.shape.size, '14px');
  assert.match(rig.shape.clipPath, /^polygon\(/);
  assert.equal(rig.radius.button, '0px', 'a clip-path button has no border-radius');

  const ph = model.buildDesignModel(fixture('posthog'));
  assert.equal(ph.theme.isDark, false);
  assert.equal(ph.shape, null, 'posthog uses border-radius, not a clip-path');

  const dash = model.buildDesignModel(fixture('vibedesign-dashboard'));
  assert.equal(dash.theme.isDark, true);
  assert.equal(dash.colors.surface, '#0a0a0a', 'from the shadcn --card triplet');
});

// ── shape of the model itself ─────────────────────────────────────────────

test('every model carries the same field set', () => {
  const FIELDS = ['source', 'theme', 'colors', 'colorRoles', 'typography', 'spacing',
    'radius', 'shape', 'shadows', 'breakpoints', 'heroSurface', 'fonts', 'tokens'];
  ALL.forEach(name => {
    const m = model.buildDesignModel(fixture(name));
    FIELDS.forEach(f => assert.ok(f in m, `${name} is missing model field "${f}"`));
    assert.equal(typeof m.source.name, 'string');
    assert.ok(Array.isArray(m.colorRoles));
    assert.ok(Array.isArray(m.fonts));
  });
});

test('the viewport is carried through, or null when unrecorded', () => {
  assert.deepEqual(model.buildDesignModel(fixture('rig-ai')).source.viewport,
    { width: 1440, height: 900 });
  assert.equal(model.buildDesignModel(fixture('vibedesign-dashboard')).source.viewport, null,
    'a manual capture without the field must not have one invented');
});

test('font hosting and font licensing are answered separately', () => {
  // These are two different questions and the old code conflated them: every
  // self-hosted family was reported "not freely available", which is wrong for
  // the many sites that self-host a copy of an open family. rig.ai self-hosts
  // all four of its faces; two of them are openly licensed and two are not.
  const m = model.buildDesignModel(fixture('rig-ai'));
  const byName = Object.fromEntries(m.fonts.map(f => [f.family, f]));

  m.fonts.forEach(f => assert.equal(f.hosting, 'self-hosted',
    `${f.family}: rig.ai serves every face from its own origin`));

  // Open — in the Google Fonts catalogue. No substitute: the reader can get it.
  ['Instrument Sans', 'Chivo Mono'].forEach(fam => {
    assert.equal(byName[fam].openlyLicensed, true, `${fam} is on Google Fonts`);
    assert.equal(byName[fam].availability, 'open (Google Fonts) — self-hosted copy');
    assert.equal(byName[fam].alternative, null,
      `${fam} is obtainable, so suggesting a replacement would be noise`);
  });

  // Not in the catalogue — licence unknown, and a substitute IS useful.
  assert.equal(byName.Chalet.openlyLicensed, false);
  assert.equal(byName.Chalet.availability, 'self-hosted, licence unknown — likely proprietary');
  assert.equal(byName.Chalet.alternative, 'Inter Tight or Space Grotesk');
  assert.equal(byName['Geist Pixel Square'].openlyLicensed, false);
  assert.equal(byName['Geist Pixel Square'].alternative, 'Silkscreen or Press Start 2P');
});

test('a variable cut is the same family as its static one', () => {
  // posthog ships "IBM Plex Sans Variable". That IS IBM Plex Sans, which is
  // OFL — reporting it as licence-unknown was a real miss.
  const ph = model.buildDesignModel(fixture('posthog'));
  const plex = ph.fonts.find(f => f.family === 'IBM Plex Sans Variable');
  assert.ok(plex, 'fixture premise');
  assert.equal(plex.openlyLicensed, true);
  assert.equal(plex.alternative, null);

  // Only a SPACE-separated suffix counts. "CameraPlainVariable" is its own
  // family name, not a variable cut of "CameraPlain".
  const dash = model.buildDesignModel(fixture('vibedesign-dashboard'));
  const camera = dash.fonts.find(f => f.family === 'CameraPlainVariable');
  assert.ok(camera, 'fixture premise');
  assert.equal(camera.openlyLicensed, false,
    'a run-together name must not be split into a false catalogue hit');
});

test('the Google Fonts catalogue is present, plausible, and in both formats', () => {
  const json = require(path.join(__dirname, '..', 'lib', 'data', 'google-fonts.json'));
  const js = require(path.join(__dirname, '..', 'lib', 'data', 'google-fonts.js'));

  // The extension has no build step, so the JSON has a JS twin. They are both
  // generated by scripts/update-google-fonts.mjs and must never drift.
  assert.deepEqual(js, json.families, 'google-fonts.js and .json disagree');
  assert.equal(json.count, json.families.length);
  assert.ok(json.families.length > 1000,
    `only ${json.families.length} families — a truncated list would silently `
    + 'reclassify every open family as proprietary');

  // Sorted and unique, so a regeneration diff shows only real changes.
  const sorted = [...json.families].sort((a, b) => a.localeCompare(b, 'en'));
  assert.deepEqual(json.families, sorted, 'the catalogue is not sorted');
  assert.equal(new Set(json.families).size, json.families.length, 'duplicate families');

  // The two the classification is pinned on.
  assert.ok(json.families.includes('Instrument Sans'));
  assert.ok(json.families.includes('Chivo Mono'));
  assert.ok(!json.families.includes('Chalet'));
});

// ── purity ────────────────────────────────────────────────────────────────

test('building the model does not mutate the capture', () => {
  ALL.forEach(name => {
    const tokens = fixture(name);
    const before = JSON.stringify(tokens);
    model.buildDesignModel(tokens);
    assert.equal(JSON.stringify(tokens), before, `${name} was mutated`);
  });
});

test('the model is deterministic', () => {
  ALL.forEach(name => {
    const strip = m => JSON.stringify(m, (k, v) => {
      if (k === 'tokens' || k === '_resolve' || k === 'resolve') return undefined;
      if (v instanceof Set) return [...v];
      return v;
    });
    assert.equal(strip(model.buildDesignModel(fixture(name))),
      strip(model.buildDesignModel(fixture(name))), `${name} is not deterministic`);
  });
});

test('no page copy reaches the model', () => {
  ALL.forEach(name => {
    const m = model.buildDesignModel(fixture(name));
    // `tokens` is the raw capture and legitimately still holds copy; every
    // derived field must not.
    const derived = Object.keys(m).filter(k => k !== 'tokens' && k !== '_resolve')
      .reduce((acc, k) => { acc[k] = m[k]; return acc; }, {});
    const json = JSON.stringify(derived, (k, v) => (v instanceof Set ? [...v] : v));
    assert.ok(!json.includes(SENTINEL), `${name}: page copy reached the model`);
    assert.ok(!json.includes('SENTINEL'), `${name}: sentinel marker reached the model`);
  });
});

test('the derivation core is exposed for the renderer to consume', () => {
  // Commit 2 rewires the builder onto these instead of keeping a second copy.
  ['hex', 'len', 'int', 'word', 'shadow', 'fontStack', 'withRem'].forEach(k =>
    assert.equal(typeof model.accessors[k], 'function', `accessors.${k} missing`));
  ['deriveColors', 'makeResolver', 'dominantRole'].forEach(k =>
    assert.equal(typeof model.color[k], 'function', `color.${k} missing`));
  ['deriveTypography', 'deriveShadows', 'characterize'].forEach(k =>
    assert.equal(typeof model.derive[k], 'function', `derive.${k} missing`));
  ['deriveVariant', 'keyframeEffect', 'componentForSelector'].forEach(k =>
    assert.equal(typeof model.states[k], 'function', `states.${k} missing`));
});

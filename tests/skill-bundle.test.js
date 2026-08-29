// VibeDesign — skill bundle suite.
//
// The bundle is the artefact a user hands to an agent, so every file in it has
// to be valid on its own terms: parseable JSON, balanced CSS with no dangling
// var(), a SKILL.md that will actually load, and a zip real tools can open.
//
// It also has to be clean. A bundle carries no page copy, no source class
// names, and no invented values — those are the three ways this feature could
// quietly do harm, so each gets an explicit test.
//
// Run with:  node --test tests/skill-bundle.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const os = require('node:os');

const model = require(path.join(__dirname, '..', 'lib', 'design-model.js'));
const skill = require(path.join(__dirname, '..', 'lib', 'skill-builder.js'));
const zipLite = require(path.join(__dirname, '..', 'lib', 'zip-lite.js'));
const tokensLib = require(path.join(__dirname, '..', 'lib', 'token-exporter.js'));
const download = require(path.join(__dirname, '..', 'lib', 'download.js'));

const FIXTURES = path.join(__dirname, 'fixtures');
const SENTINEL = fs.readFileSync(path.join(FIXTURES, 'SENTINEL.txt'), 'utf8').trim();
const fixture = n => JSON.parse(fs.readFileSync(path.join(FIXTURES, n + '.json'), 'utf8'));

const ALL = ['rig-ai', 'posthog', 'vibedesign-dashboard', 'sparse'];
const OPTS = { version: '3.0.0', observedAt: '2026-08-29' };

const bundleFor = name =>
  skill.buildSkillBundle(model.buildDesignModel(fixture(name)), OPTS);

const fileIn = (bundle, suffix) =>
  bundle.files.find(f => f.path.endsWith(suffix));

// ── shape ─────────────────────────────────────────────────────────────────

test('every bundle carries the same eight files under one directory', () => {
  const EXPECTED = ['SKILL.md', 'README.md', 'DESIGN.md', 'tokens.json',
    'variables.css', 'theme.css', 'tailwind.config.js', 'tailwind.v4.css'];
  ALL.forEach(name => {
    const b = bundleFor(name);
    assert.match(b.slug, /^design-[a-z0-9-]+$/, `${name}: slug "${b.slug}" is not a safe directory name`);
    assert.deepEqual(b.files.map(f => f.path.split('/').pop()).sort(), [...EXPECTED].sort(),
      `${name}: wrong file set`);
    b.files.forEach(f => {
      assert.ok(f.path.startsWith(b.slug + '/'), `${f.path} is outside the bundle directory`);
      assert.ok(typeof f.text === 'string' && f.text.length, `${f.path} is empty`);
    });
  });
});

test('the bundle slug matches the download helper', () => {
  // Two implementations of the same rule, because skill-builder.js must work
  // without download.js loaded. If they drift, the zip and the directory
  // inside it get different names.
  ['https://rig.ai/', 'https://www.posthog.com/pricing', 'https://vibedesign.tech/dashboard']
    .forEach(url => {
      assert.equal(skill.slugFor(url), download.bundleSlug(url), `slug drift for ${url}`);
    });
});

// ── SKILL.md must load ────────────────────────────────────────────────────

test('SKILL.md frontmatter is within the Agent Skills limits', () => {
  ALL.forEach(name => {
    const b = bundleFor(name);
    const text = fileIn(b, 'SKILL.md').text;

    assert.ok(text.startsWith('---\n'), `${name}: SKILL.md must open with frontmatter`);
    const end = text.indexOf('\n---\n', 4);
    assert.ok(end > 0, `${name}: frontmatter is not closed`);
    const fm = text.slice(4, end);

    const nameLine = fm.match(/^name: (.+)$/m);
    const descLine = fm.match(/^description: (.+)$/m);
    assert.ok(nameLine, `${name}: no name in frontmatter`);
    assert.ok(descLine, `${name}: no description in frontmatter`);

    assert.ok(nameLine[1].length <= skill.NAME_MAX,
      `${name}: skill name is ${nameLine[1].length} chars, limit is ${skill.NAME_MAX}`);
    assert.match(nameLine[1], /^[a-z0-9-]+$/,
      `${name}: skill name "${nameLine[1]}" must be lowercase letters, digits and hyphens`);
    assert.ok(descLine[1].length <= skill.DESC_MAX,
      `${name}: description is ${descLine[1].length} chars, limit is ${skill.DESC_MAX}`);

    // The description is one line: a newline inside it silently truncates the
    // frontmatter value and the skill loads with a description of nothing.
    assert.equal(descLine[1].indexOf('\n'), -1);
    // It must say what the skill is AND when to use it, or an agent cannot
    // decide whether to load it.
    assert.match(descLine[1], /Use when/i, `${name}: description does not say when to use the skill`);
  });
});

// ── content safety ────────────────────────────────────────────────────────

test('no page copy reaches any file in any bundle', () => {
  ALL.forEach(name => {
    bundleFor(name).files.forEach(f => {
      assert.ok(!f.text.includes(SENTINEL), `${f.path}: contains scrubbed page copy`);
      assert.ok(!/\bSENTINEL\b/.test(f.text), `${f.path}: contains the sentinel marker`);
    });
  });
});

test('no source class name or selector reaches any bundle', () => {
  // The bundle describes a design; it does not reproduce an implementation.
  // Harvest the class names the capture actually saw and prove none appear.
  ALL.forEach(name => {
    const raw = fixture(name);
    const observed = new Set();
    const walk = node => {
      if (typeof node === 'string') {
        // Selector-ish strings in the capture: ".hero-cta", "button.primary".
        (node.match(/\.[a-z][a-z0-9_-]{4,}/gi) || []).forEach(c => observed.add(c.slice(1)));
      } else if (Array.isArray(node)) node.forEach(walk);
      else if (node && typeof node === 'object') Object.keys(node).forEach(k => walk(node[k]));
    };
    walk(raw.hoverStates);
    walk(raw.interactiveStates);
    walk(raw.transitions);

    const bundle = bundleFor(name);
    const generic = new Set(['config', 'value', 'design', 'color', 'style']);
    bundle.files.forEach(f => {
      observed.forEach(cls => {
        if (generic.has(cls) || cls.length < 6) return;
        // A file extension is not a class name.
        if (/^(json|config|md)$/.test(cls)) return;
        assert.ok(!f.text.includes('.' + cls),
          `${f.path}: leaks the source class ".${cls}"`);
      });
    });
  });
});

test('a suggestion is always labelled as one', () => {
  ALL.forEach(name => {
    const b = bundleFor(name);
    const md = fileIn(b, 'SKILL.md').text;
    // Font substitutes are the one recommendation SKILL.md makes.
    const m = model.buildDesignModel(fixture(name));
    const suggests = (m.fonts || []).some(f => f.alternative);
    if (suggests) {
      assert.match(md, /suggested, not observed/,
        `${name}: SKILL.md recommends a substitute font without labelling it`);
    }
    // Whenever the phrase "close substitute" appears, the label must be on it.
    md.split('\n').filter(l => /substitute/i.test(l)).forEach(line => {
      assert.match(line, /suggested, not observed/,
        `${name}: unlabelled recommendation — ${line.trim()}`);
    });
  });
});

// ── the CSS has to be usable ──────────────────────────────────────────────

test('every CSS file has balanced braces and no empty declarations', () => {
  ALL.forEach(name => {
    bundleFor(name).files.filter(f => f.path.endsWith('.css')).forEach(f => {
      const open = (f.text.match(/\{/g) || []).length;
      const close = (f.text.match(/\}/g) || []).length;
      assert.equal(open, close, `${f.path}: ${open} "{" against ${close} "}"`);
      assert.ok(!/;\s*;/.test(f.text), `${f.path}: empty declaration`);
      assert.ok(!/:\s*;/.test(f.text), `${f.path}: property with no value`);
      // A rule with an empty body means a section was emitted for values that
      // all got dropped.
      assert.ok(!/\{\s*\}/.test(f.text), `${f.path}: empty rule body`);
    });
  });
});

test('no var(--x) in a bundle is left undeclared', () => {
  // This is the failure mode that looks fine and renders as nothing: a
  // declaration referencing a custom property the bundle never defines.
  ALL.forEach(name => {
    const b = bundleFor(name);
    const css = b.files.filter(f => f.path.endsWith('.css'));
    const declared = new Set();
    css.forEach(f => (f.text.match(/^\s*(--[a-z0-9-]+)\s*:/gim) || [])
      .forEach(d => declared.add(d.trim().split(':')[0])));

    css.forEach(f => {
      (f.text.match(/var\(\s*(--[a-z0-9-]+)/g) || []).forEach(use => {
        const varname = use.replace(/var\(\s*/, '');
        assert.ok(declared.has(varname),
          `${f.path}: uses ${varname}, which the bundle never declares`);
      });
    });
    // And nothing anywhere still carries a raw, unresolved reference.
    b.files.forEach(f => {
      assert.ok(!/var\(--[a-z0-9-]+\)\s*(?:,|\))?\s*(?:not captured)/i.test(f.text),
        `${f.path}: contains an unresolved-variable placeholder`);
    });
  });
});

test('theme.css never invents a surface the page does not have', () => {
  // rig's cards inherit the page background. Emitting `background:` on .card
  // would give it a panel the site has not got.
  const raw = fixture('rig-ai');
  assert.equal(raw.cardStyles.backgroundIsInherited, true, 'fixture premise');
  const css = fileIn(bundleFor('rig-ai'), 'theme.css').text;
  const cardRule = css.slice(css.indexOf('.card {'), css.indexOf('}', css.indexOf('.card {')));
  assert.ok(!/background/.test(cardRule),
    '.card must not declare a background it only inherited');
});

test('an inverse primary button is flagged, not shipped silently', () => {
  const m = model.buildDesignModel(fixture('rig-ai'));
  assert.equal(m.theme.inverseButton, true, 'fixture premise');
  const css = fileIn(bundleFor('rig-ai'), 'theme.css').text;
  assert.match(css, /painted in the PAGE background colour/,
    'a button the same colour as the page must carry the reason why');
});

// ── tokens.json ───────────────────────────────────────────────────────────

const DTCG_TYPES = new Set(['color', 'dimension', 'fontFamily', 'fontWeight', 'duration',
  'cubicBezier', 'number', 'strokeStyle', 'border', 'transition', 'shadow',
  'gradient', 'typography', 'other']);

test('tokens.json is valid JSON and every token carries a known $type', () => {
  ALL.forEach(name => {
    const text = fileIn(bundleFor(name), 'tokens.json').text;
    let parsed;
    assert.doesNotThrow(() => { parsed = JSON.parse(text); }, `${name}: tokens.json is not JSON`);

    let count = 0;
    const walk = (node, at) => {
      if (!node || typeof node !== 'object') return;
      if ('$value' in node) {
        count++;
        assert.ok('$type' in node, `${name}: ${at} has $value but no $type`);
        assert.ok(DTCG_TYPES.has(node.$type), `${name}: ${at} has unknown $type "${node.$type}"`);
        assert.notEqual(node.$value, null, `${name}: ${at} has a null $value`);
        assert.notEqual(node.$value, '', `${name}: ${at} has an empty $value`);
        return;
      }
      Object.keys(node).forEach(k => {
        if (k.charAt(0) === '$') return;          // $description and friends
        walk(node[k], at ? `${at}.${k}` : k);
      });
    };
    walk(parsed, '');
    if (name !== 'sparse') assert.ok(count > 10, `${name}: only ${count} tokens`);
  });
});

test('a dimension token is always a real length', () => {
  // The bug this guards: `50%` and `0px 6px 6px 0px` are real radius values
  // and neither is a DTCG dimension. Typing them as one hands a consumer a
  // value its parser accepts and then mis-scales.
  ALL.forEach(name => {
    const parsed = JSON.parse(fileIn(bundleFor(name), 'tokens.json').text);
    const walk = (node, at) => {
      if (!node || typeof node !== 'object') return;
      if (node.$type === 'dimension') {
        assert.match(String(node.$value), /^-?[0-9.]+(px|rem|em)$/,
          `${name}: ${at} is typed dimension but its value is "${node.$value}"`);
        return;
      }
      if ('$value' in node) return;
      Object.keys(node).forEach(k => { if (k.charAt(0) !== '$') walk(node[k], at ? `${at}.${k}` : k); });
    };
    walk(parsed, '');
  });
});

test('the exporter no longer collides text-primary with the background', () => {
  // The old W3C path fell back to #ffffff / #000000 by page darkness, which on
  // a near-black page produced invisible body text.
  ['rig-ai', 'posthog', 'vibedesign-dashboard'].forEach(name => {
    const c = tokensLib.exportW3CTokens(fixture(name)).color;
    assert.ok(c.background && c['text-primary'], `${name}: missing a core role`);
    assert.notEqual(c.background.$value, c['text-primary'].$value,
      `${name}: body text is the same colour as the page`);
  });
});

test('the exporter invents no state colours', () => {
  // The old path emitted fixed Tailwind hexes for success/error/warning on
  // every site, observed or not.
  const posthog = tokensLib.exportW3CTokens(fixture('posthog')).color;
  ['state-success', 'state-error', 'state-warning'].forEach(role => {
    assert.ok(!(role in posthog), `${role} is a fabricated role and must be gone`);
  });
  // A state colour the page really uses still comes through.
  const rig = tokensLib.exportW3CTokens(fixture('rig-ai')).color;
  assert.equal(rig.success.$value, model.buildDesignModel(fixture('rig-ai')).colors.success);
});

test('every token value agrees with the model, character for character', () => {
  ALL.forEach(name => {
    const m = model.buildDesignModel(fixture(name));
    const t = tokensLib.exportTokensFromModel(m);
    m.colorRoles.forEach(role => {
      assert.equal(t.color[role].$value, m.colors[role],
        `${name}: ${role} differs between the model and tokens.json`);
    });
    Object.keys(m.radius || {}).forEach(k => {
      assert.equal(t.radius[k].$value, m.radius[k], `${name}: radius.${k} differs`);
    });
  });
});

// ── the zip has to open ───────────────────────────────────────────────────

test('crc32 matches the IEEE check value', () => {
  // "123456789" → 0xCBF43926 is the standard check value for CRC-32/ISO-HDLC.
  // Without this, a wrong table produces a zip that looks fine and fails to
  // extract.
  const bytes = new TextEncoder().encode('123456789');
  assert.equal(zipLite._crc32(bytes), 0xCBF43926);
});

test('zip paths cannot escape the archive', () => {
  const buf = zipLite.zip([
    { path: '../../etc/passwd', text: 'x' },
    { path: '/absolute', text: 'y' },
    { path: 'fine.txt', text: 'z' },
  ]);
  const names = readZipNames(buf);
  names.forEach(n => {
    assert.ok(!n.startsWith('/'), `absolute path survived: ${n}`);
    assert.ok(!n.split('/').includes('..'), `traversal survived: ${n}`);
  });
  assert.ok(names.includes('fine.txt'));
});

test('the zip is byte-identical across builds', () => {
  // A timestamp would make every export differ, which defeats diffing an
  // export against a previous one.
  const a = skill.zipSkillBundle(bundleFor('rig-ai'), zipLite);
  const b = skill.zipSkillBundle(bundleFor('rig-ai'), zipLite);
  assert.deepEqual(Buffer.from(a), Buffer.from(b));
});

// Reads the central directory to list entry names — deliberately a different
// code path from the writer, so a shared misunderstanding cannot pass.
function readZipNames(buf) {
  const view = Buffer.from(buf);
  const names = [];
  for (let i = 0; i < view.length - 4; i++) {
    if (view.readUInt32LE(i) === 0x02014b50) {
      const nameLen = view.readUInt16LE(i + 28);
      names.push(view.slice(i + 46, i + 46 + nameLen).toString('utf8'));
    }
  }
  return names;
}

test('real unzip tools can read the bundle and get the bytes back', () => {
  const bundle = bundleFor('rig-ai');
  const buf = skill.zipSkillBundle(bundle, zipLite);
  assert.ok(buf && buf.length, 'no zip produced');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vd-zip-'));
  const zipPath = path.join(dir, 'bundle.zip');
  fs.writeFileSync(zipPath, buf);

  try {
    // Not our own reader: the system unzip, which is what the user's OS uses.
    execFileSync('unzip', ['-tq', zipPath], { stdio: 'pipe' });
    execFileSync('unzip', ['-qq', '-o', zipPath, '-d', dir], { stdio: 'pipe' });
  } catch (e) {
    assert.fail('system unzip rejected the archive: ' + (e.stderr || e.message));
  }

  bundle.files.forEach(f => {
    const onDisk = path.join(dir, f.path);
    assert.ok(fs.existsSync(onDisk), `${f.path} missing after extraction`);
    assert.equal(fs.readFileSync(onDisk, 'utf8'), f.text,
      `${f.path} did not survive the round trip`);
  });

  fs.rmSync(dir, { recursive: true, force: true });
});

test('tailwind.config.js is syntactically valid JavaScript', () => {
  ALL.forEach(name => {
    const text = fileIn(bundleFor(name), 'tailwind.config.js').text;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vd-tw-'));
    const file = path.join(dir, 'tailwind.config.js');
    fs.writeFileSync(file, text);
    try {
      // require() proves it parses AND that module.exports is a real object —
      // a syntax check alone would pass on a config that exports nothing.
      const cfg = require(file);
      assert.ok(cfg && cfg.theme && cfg.theme.extend, `${name}: no theme.extend`);
      const m = model.buildDesignModel(fixture(name));
      if (m.colorRoles.length) {
        assert.equal(cfg.theme.extend.colors.background, m.colors.background,
          `${name}: Tailwind colour disagrees with the model`);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

test('DESIGN.md inside the bundle is the same document the panel downloads', () => {
  const builder = require(path.join(__dirname, '..', 'lib', 'design-md-builder.js'));
  ALL.forEach(name => {
    const raw = fixture(name);
    const standalone = builder.buildDesignMd(raw, Object.assign({ sourceUrl: raw.url || '' }, OPTS));
    const inBundle = fileIn(bundleFor(name), 'DESIGN.md').text;
    assert.equal(inBundle, standalone, `${name}: the bundled DESIGN.md has drifted`);
  });
});

// ── the button itself ─────────────────────────────────────────────────────

// Everything above tests the libraries. This runs the REAL click handler out
// of lib/ui-helpers.js against stub DOM primitives, so a bundle that builds
// perfectly but is wired to a button that cannot reach it still fails.
function runPanel(build) {
  const vm = require('node:vm');
  const captured = { anchors: [], blobs: [], revoked: [], warnings: [] };

  class FakeBlob {
    constructor(parts, opts) {
      this.parts = parts;
      this.type = (opts && opts.type) || '';
      captured.blobs.push(this);
    }
  }

  // Elements are CACHED by id. A stub that returns a fresh object per lookup
  // silently discards every listener, which is how the first version of this
  // test passed while the button was wired to nothing.
  const nodes = new Map();
  const makeEl = id => ({
    id,
    listeners: {},
    style: {},
    classList: { add() {}, remove() {} },
    addEventListener(evt, fn) { this.listeners[evt] = fn; },
    querySelector() { return { textContent: 'Download Skill (zip)' }; },
    setAttribute() {}, removeAttribute() {}, remove() {},
    click() { captured.anchors.push(this); },
    appendChild() {},
  });
  const el = id => {
    if (!nodes.has(id)) nodes.set(id, makeEl(id));
    return nodes.get(id);
  };

  const sandbox = {
    console: { warn: (...a) => captured.warnings.push(a.join(' ')), log() {}, error() {} },
    Math, JSON, Date, URL: Object.assign(function (u) { return new (require('node:url').URL)(u); }, {
      createObjectURL: () => 'blob:stub', revokeObjectURL: u => captured.revoked.push(u),
    }),
    RegExp, Object, Array, String, Number, Set, Map, Boolean, Error, Promise,
    parseInt, parseFloat, isNaN, isFinite, Infinity, TextEncoder, Uint8Array,
    Blob: FakeBlob, setTimeout: () => 0, clearTimeout: () => {},
    document: {
      body: { appendChild() {}, contains: () => false },
      getElementById: id => el(id),
      // The synthetic download anchor must NOT be cached — each download
      // creates its own, and reusing one would hide a second click.
      createElement: () => makeEl('a'),
      querySelectorAll: () => [],
      contains: () => false,
      addEventListener() {},
      removeEventListener() {},
    },
    window: { addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) },
    // setupListeners() subscribes to storage and messaging. update_url is set
    // so isUnpackedBuild() is false — the skill button must work for ordinary
    // Web Store users, not only on an unpacked build.
    chrome: {
      runtime: {
        getManifest: () => ({ version: '3.0.0', update_url: 'https://clients2.google.com/x' }),
        onMessage: { addListener() {} },
        sendMessage: () => Promise.resolve(),
        lastError: null,
      },
      storage: {
        local: { get: () => Promise.resolve({}), set: () => Promise.resolve(), remove: () => Promise.resolve() },
        onChanged: { addListener() {} },
      },
      tabs: { query: () => Promise.resolve([]), onUpdated: { addListener() {} } },
    },
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
  };
  // `URL` must behave as a constructor for the slug helpers and as a namespace
  // for createObjectURL; Node's URL is the real thing plus the two statics.
  sandbox.URL = require('node:url').URL;
  sandbox.URL.createObjectURL = () => 'blob:stub';
  sandbox.URL.revokeObjectURL = u => captured.revoked.push(u);
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  ['lib/color-utils.js', 'lib/design-model.js', 'lib/token-exporter.js',
   'lib/design-md-builder.js', 'lib/zip-lite.js', 'lib/skill-builder.js',
   'lib/download.js', 'lib/ui-helpers.js'].forEach(f => {
    vm.runInContext(read(f), sandbox, { filename: f });
  });

  sandbox.__tokens = build;
  vm.runInContext('state.lastAnalyzedData = __tokens; state.currentUrl = __tokens.url || "";', sandbox);
  return { captured, sandbox, el, nodes };
}

// Runs the panel's own listener wiring, then clicks a button by id the way a
// user would — so an unwired button fails here rather than passing because the
// test called the handler itself.
function clickButton(panel, id) {
  const vm = require('node:vm');
  vm.runInContext('setupListeners();', panel.sandbox);
  const btn = panel.nodes.get(id);
  assert.ok(btn, `#${id} was never looked up — setupListeners does not know it exists`);
  const onClick = btn.listeners.click;
  assert.ok(onClick, `#${id} has no click listener — the button is wired to nothing`);
  onClick();
}

test('the Download Skill button produces a real zip, through the real handler', () => {
  const raw = fixture('rig-ai');
  const panel = runPanel(raw);
  const captured = panel.captured;
  clickButton(panel, 'downloadSkillBtn');

  assert.deepEqual(captured.warnings, [], 'the handler warned instead of working');
  assert.equal(captured.anchors.length, 1, 'no download was triggered');
  assert.equal(captured.anchors[0].download, 'design-rig-ai.zip',
    'the download has the wrong filename');
  assert.equal(captured.blobs.length, 1);
  assert.equal(captured.blobs[0].type, 'application/zip');

  // The bytes handed to the browser must be an openable archive holding the
  // whole bundle — not merely non-empty.
  const bytes = captured.blobs[0].parts[0];
  assert.ok(bytes instanceof Uint8Array, 'the blob was not given bytes');
  assert.equal(Buffer.from(bytes.slice(0, 4)).toString('hex'), '504b0304',
    'the payload is not a zip (bad local header signature)');

  const names = readZipNames(bytes);
  assert.deepEqual(names.sort(), [
    'design-rig-ai/DESIGN.md', 'design-rig-ai/README.md', 'design-rig-ai/SKILL.md',
    'design-rig-ai/tailwind.config.js', 'design-rig-ai/tailwind.v4.css',
    'design-rig-ai/theme.css', 'design-rig-ai/tokens.json',
    'design-rig-ai/variables.css',
  ], 'the zip does not contain the bundle');
});

test('the button reports rather than throws when a library is missing', () => {
  // A missing <script> tag must degrade to a labelled button, not a broken panel.
  const vm = require('node:vm');
  const panel = runPanel(fixture('rig-ai'));
  const { sandbox, captured } = panel;
  // The lib files publish themselves onto `self`, which is what the handler
  // reads; the top-level `const` binding cannot be reassigned, and does not
  // need to be.
  vm.runInContext('delete self.VD_ZIP;', sandbox);
  assert.doesNotThrow(() => clickButton(panel, 'downloadSkillBtn'));
  assert.equal(captured.anchors.length, 0, 'a download was started with no zip library');
  assert.match(captured.warnings.join(' '), /VD_ZIP/, 'the missing library was not named');
});

// ── Tailwind v4 ───────────────────────────────────────────────────────────

test('tailwind.v4.css declares its tokens in the v4 namespaces', () => {
  const NAMESPACES = ['color', 'font', 'text', 'spacing', 'radius', 'shadow', 'ease', 'animate'];
  ALL.forEach(name => {
    const css = fileIn(bundleFor(name), 'tailwind.v4.css').text;
    assert.match(css, /^@import "tailwindcss";$/m, `${name}: no tailwindcss import`);

    const m = model.buildDesignModel(fixture(name));
    if (!m.colorRoles.length) return;             // sparse has nothing to declare

    assert.match(css, /@theme \{/, `${name}: no @theme block`);
    // Every custom property inside @theme must sit in a v4 namespace; an
    // unknown prefix is silently ignored by Tailwind, which looks like it works.
    const theme = css.slice(css.indexOf('@theme {'), css.indexOf('\n}', css.indexOf('@theme {')));
    (theme.match(/^\s*--([a-z0-9-]+):/gim) || []).forEach(decl => {
      const prop = decl.trim().replace(/:$/, '').slice(2);
      const ns = NAMESPACES.find(n => prop.indexOf(n + '-') === 0);
      assert.ok(ns, `${name}: --${prop} is in no Tailwind v4 namespace`);
    });
    m.colorRoles.forEach(role => {
      assert.ok(theme.includes(`--color-${role}: ${m.colors[role]};`),
        `${name}: --color-${role} missing or disagreeing with the model`);
    });
  });
});

test('only fully-captured keyframes are emitted, and the rest are named', () => {
  const css = fileIn(bundleFor('rig-ai'), 'tailwind.v4.css').text;
  const raw = fixture('rig-ai');

  const emitted = (css.match(/@keyframes ([\w-]+)/g) || []).map(m => m.split(' ')[1]);
  // The examples the correction called out, all present.
  ['pulse-ring', 'blink', 'ticker', 'hdr-glow-pulse', 'terminalLineIn']
    .forEach(n => assert.ok(emitted.includes(n), `${n} should be emitted in full`));

  // The extractor records only the first and last rule of a @keyframes block.
  // Where that is demonstrably not the whole animation, nothing is written.
  const under = ['btn-glitch', 'watermark-glitch', 'pupil-glitch', 'glitch-shift',
    'disconnect-drift-left', 'signal-flicker', 'wl-spin'];
  under.forEach(n => {
    assert.ok(!emitted.includes(n), `${n} is under-captured and must not be emitted`);
    assert.ok(css.includes(` *   ${n} — `), `${n} must be listed with a reason`);
  });

  // Every animation in the capture is accounted for one way or the other —
  // silence about one would be indistinguishable from not having seen it.
  (raw.animations || []).forEach(a => {
    const named = emitted.includes(a.name) || css.includes(` *   ${a.name} — `);
    assert.ok(named, `${a.name} is neither emitted nor explained`);
  });
});

test('a keyframe referencing an uncapturable runtime variable is not emitted', () => {
  // Radix writes keyframes against variables that exist only while the
  // component is mounted. Emitting them yields an animation that does nothing.
  const css = fileIn(bundleFor('posthog'), 'tailwind.v4.css').text;
  assert.ok(!/var\(/.test(css), 'an unresolved var() reached the keyframes');
  ['slideUp', 'slideDown', 'slideIn', 'swipeOut'].forEach(n => {
    assert.ok(!new RegExp(`@keyframes ${n}\\b`).test(css), `${n} must not be emitted`);
    assert.match(css, new RegExp(` \\*   ${n} — a frame references a runtime variable`));
  });
});

test('an --animate-* shorthand is only written when a duration was observed', () => {
  const css = fileIn(bundleFor('rig-ai'), 'tailwind.v4.css').text;
  // hdr-glow-pulse is an ambient loop and its 3s duration WAS measured.
  assert.match(css, /--animate-hdr-glow-pulse: hdr-glow-pulse 3000ms infinite;/);
  // No timing function: only the duration and "runs forever" were observed.
  assert.ok(!/--animate-[\w-]+:[^;]*(ease|cubic-bezier|linear)/.test(css),
    'a timing function was invented for an --animate-* shorthand');
  // blink has complete keyframes but no measured duration, so no shorthand.
  assert.match(css, /@keyframes blink \{/);
  assert.ok(!/--animate-blink:/.test(css), 'blink has no observed duration');
  assert.match(css, /Set your own duration:/);
});

// ── easing names ──────────────────────────────────────────────────────────

test('easings are named by role, never by digits', () => {
  ALL.forEach(name => {
    const motion = tokensLib.exportW3CTokens(fixture(name)).motion || {};
    Object.keys(motion).filter(k => k.indexOf('ease-') === 0).forEach(k => {
      assert.ok(!/\d/.test(k),
        `${name}: "${k}" is named from its own numbers — it tells a reader nothing`);
      assert.match(k, /^ease-[a-z][a-z-]*$/, `${name}: "${k}" is not a role name`);
    });
  });
});

test('a curve measured on a component is named for that component', () => {
  // All three real captures put their primary curve on a button. The 90-char
  // display cap in timing() used to discard posthog's and the dashboard's
  // shorthand entirely, so neither got an easing at all.
  ['rig-ai', 'posthog', 'vibedesign-dashboard'].forEach(name => {
    const motion = tokensLib.exportW3CTokens(fixture(name)).motion || {};
    assert.ok(motion['ease-button'], `${name}: the button curve was not attributed`);
    assert.equal(motion['ease-button'].$type, 'cubicBezier');
    assert.equal(motion['ease-button'].$value.length, 4);
  });
  assert.deepEqual(tokensLib.exportW3CTokens(fixture('rig-ai')).motion['ease-button'].$value,
    [0.25, 1, 0.5, 1]);
  // A curve with no component gets its character, not an ordinal.
  assert.ok(tokensLib.exportW3CTokens(fixture('posthog')).motion['ease-decelerate'],
    'cubic-bezier(0,0,.2,1) leaves the origin flat — that is a decelerate curve');
});

test('the same easing has the same name in tokens.json and tailwind.v4.css', () => {
  ALL.forEach(name => {
    const motion = tokensLib.exportW3CTokens(fixture(name)).motion || {};
    const css = fileIn(bundleFor(name), 'tailwind.v4.css').text;
    Object.keys(motion).filter(k => k.indexOf('ease-') === 0).forEach(k => {
      assert.ok(css.includes(`  --${k}:`),
        `${name}: ${k} is in tokens.json but not under the same name in the v4 theme`);
    });
  });
});

// ── the non-standard type is disclosed ────────────────────────────────────

test('every $type "other" is disclosed in the README', () => {
  // "other" is not a DTCG type. Using it is a deliberate call — the values it
  // carries (a clip-path polygon, a percentage radius) have no spec type and
  // dropping them would lose the most distinctive thing about some designs.
  // What is not acceptable is shipping it unannounced.
  let sawOther = false;
  ALL.forEach(name => {
    const b = bundleFor(name);
    const parsed = JSON.parse(fileIn(b, 'tokens.json').text);
    const walk = node => {
      if (!node || typeof node !== 'object') return;
      if (node.$type === 'other') { sawOther = true; return; }
      if ('$value' in node) return;
      Object.keys(node).forEach(k => { if (k.charAt(0) !== '$') walk(node[k]); });
    };
    walk(parsed);

    const readme = fileIn(b, 'README.md').text;
    assert.match(readme, /`\$type: "other"` is not a DTCG type/,
      `${name}: the README does not disclose the non-standard type`);
    assert.match(readme, /expect a strict DTCG validator to reject them/,
      `${name}: the README does not say what a validator will do`);
  });
  assert.ok(sawOther, 'no fixture exercises $type "other" — this test proves nothing');
});

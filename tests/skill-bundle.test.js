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
//
// The bundle's own correctness is covered above. Whether a user can actually
// GET it is a question about the panel, so it is asked against the real panel
// in tests/ui-panel.test.js ("Download Skill produces a real zip"): boot the
// side panel in jsdom, analyse, choose Skill, click Export, and read back the
// bytes handed to the browser.
//
// It lives there rather than here because the hand-rolled DOM stub this file
// used could not survive the rebuild — the panel now re-renders its content
// and relies on delegated events, and a stub that returns a fresh element per
// lookup silently drops every listener. That stub had already produced one
// false pass, so it was replaced rather than patched.

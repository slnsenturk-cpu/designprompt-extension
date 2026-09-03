// VibeDesign — image analysis (§4.6, PROMPT 11).
//
// What this file pins:
//   1. The key gate: without AI enhancement the drop zone is present, dimmed,
//      and explains itself with the §9 sentence and a "Turn on" that opens
//      Settings. With it, the zone is live and the button follows the image.
//   2. The failure path: a reply that is not the profile shows the §9 line
//      and logs NOTHING — not the reply, not the image, not a warning.
//   3. The outputs: DESIGN.md and the prompt say "estimated" everywhere and
//      leave out what a still image cannot contain.
//   4. History: an image entry carries its type and its bytes, locally.
//   5. The Website path is untouched (its snapshots live in ui-render).
//
//   node --test tests/image-analysis.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const U = require(path.join(ROOT, 'lib', 'ui-components.js'));
const V = U.VD_VIEWS;
const M = require(path.join(ROOT, 'lib', 'design-model.js'));
const D = require(path.join(ROOT, 'lib', 'design-md-builder.js'));
const AI = require(path.join(ROOT, 'lib', 'ai-caller.js'));

const PROFILE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'image-profile-icons.json'), 'utf8'));
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const IMAGE = { name: 'icon-set.png', type: 'image/png', size: 1234, dataUrl: PNG };
const imageModel = () => M.buildModelFromStyleProfile(PROFILE, { name: IMAGE.name });

// ── 1. key gate (pure render) ─────────────────────────────────────────────

test('gated: drop zone is dimmed, inert, and says why, with a way to fix it', () => {
  const html = V.imageHomeView({ aiEnabled: false, recent: [] });
  assert.match(html, /class="vd-drop is-gated"/);
  assert.match(html, /aria-disabled="true"/);
  assert.match(html, /tabindex="-1"/);
  // §9, verbatim.
  assert.ok(html.includes(U.esc(U.COPY.imageGate)));
  assert.equal(U.COPY.imageGate, 'Image analysis needs AI enhancement. Your image goes only to your chosen AI provider.');
  assert.match(html, /data-action="openSettings"[^>]*>Turn on</);
  // The primary action exists and is disabled: the state is visible, not hidden.
  assert.match(html, /id="analyzeImageBtn"[^>]*disabled/);
});

test('enabled, no image: drop zone live, button disabled until an image is chosen', () => {
  const html = V.imageHomeView({ aiEnabled: true, aiProvider: 'Claude', aiModel: 'Fable 5.1', recent: [] });
  assert.ok(!/is-gated/.test(html));
  assert.ok(!html.includes(U.esc(U.COPY.imageGate)), 'no gate notice when AI is on');
  assert.match(html, /tabindex="0"/);
  assert.match(html, /id="analyzeImageBtn"[^>]*disabled/);
  assert.ok(html.includes(U.esc(U.COPY.imageHelp)));
  assert.match(html, /accept="image\/png,image\/jpeg,image\/webp"/);
});

test('enabled, image chosen: preview shown and Analyze image is live', () => {
  const html = V.imageHomeView({ aiEnabled: true, image: IMAGE, recent: [] });
  assert.match(html, /class="vd-drop has-image"/);
  assert.ok(html.includes(`src="${PNG}"`));
  assert.ok(!/id="analyzeImageBtn"[^>]*disabled/.test(html));
  assert.match(html, />Analyze image</);
});

test('the gate CSS really is 40%', () => {
  const css = fs.readFileSync(path.join(ROOT, 'popup.css'), 'utf8');
  assert.match(css, /\.vd-drop\.is-gated\s*\{[^}]*opacity:\s*\.4/);
});

// ── 2. the vision model picker ────────────────────────────────────────────

test('pickVisionModel keeps a capable selection, falls back to the newest capable, else null', () => {
  const L = ids => ids.map(id => ({ id }));
  assert.equal(AI.pickVisionModel('claude', 'claude-fable-5-1', []), 'claude-fable-5-1');
  assert.equal(AI.pickVisionModel('openai', 'gpt-4o-mini-tts', L(['gpt-4o-audio-preview', 'gpt-5', 'gpt-4.1'])), 'gpt-5');
  assert.equal(AI.pickVisionModel('gemini', 'gemini-1.5-pro', L(['gemini-2.5-flash'])), 'gemini-2.5-flash');
  assert.equal(AI.pickVisionModel('gemini', 'gemini-1.5-pro', []), null);
  assert.equal(AI.pickVisionModel('nope', 'x', []), null);
});

test('the extraction prompt asks for exactly the shape the parser accepts', () => {
  const p = AI.IMAGE_PROFILE_PROMPT;
  ['"palette"', '"typography"', '"classification"', '"weightCharacter"', '"families"', '"shape"',
   '"iconography"', '"illustration"', '"density"', '"mood"', '"dominantBackground"']
    .forEach(k => assert.ok(p.includes(k), `prompt does not ask for ${k}`));
  assert.match(p, /ONE JSON object/);
  assert.match(p, /Do not describe motion/);
  // And the parser accepts what it asks for.
  const parsed = M.parseStyleProfile(JSON.stringify(PROFILE));
  assert.ok(parsed && parsed.palette.length === 6);
});

// ── 3. outputs ────────────────────────────────────────────────────────────

test('DESIGN.md for an image: frontmatter, per-section note, omitted sections, agent sentence', () => {
  const md = D.buildDesignMd({}, { model: imageModel(), version: '3.0.2' });
  const fm = md.split('---')[1];
  assert.match(fm, /^source-type: image$/m);
  assert.match(fm, /^confidence: estimated$/m);
  assert.ok(!/viewport:/.test(fm), 'no viewport: nothing was observed at a width');

  const headings = md.match(/^## .*$/gm) || [];
  ['## Motion', '## Interaction states', '## Component anatomy', '## Layout', '## Spacing', '## Shadows']
    .forEach(h => assert.ok(!headings.some(x => x.startsWith(h)), `${h} must be omitted for an image`));
  ['## Visual direction', '## Color usage', '## Typography', '## Components', '## Agent instructions', '## Accessibility']
    .forEach(h => assert.ok(headings.includes(h), `${h} missing`));

  // Every section carries the estimated note.
  const sections = md.split(/^## /m).slice(1);
  sections.forEach(s => assert.ok(/Estimated from image/.test(s), `section lacks the note: ${s.split('\n')[0]}`));

  assert.ok(md.includes('This is a style direction inferred from an image, not a measured system; treat values as starting points.'));
  // Palette rows are marked, and colours are lowercase like the measured model's.
  assert.match(md, /\| accent \| `#e60023` \| estimated \|/);
});

test('DESIGN.md for a website is unchanged by the image branch', () => {
  const rig = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'rig-ai.json'), 'utf8'));
  const a = D.buildDesignMd(rig, { version: '3.0.2', observedAt: '2026-01-01' });
  const b = D.buildDesignMd(rig, { version: '3.0.2', observedAt: '2026-01-01', model: M.buildDesignModel(rig) });
  assert.equal(a, b, 'passing a website model must not change the document');
  assert.ok(!/source-type: image/.test(a));
  assert.match(a, /^## Motion/m);
});

test('image overview exports Prompt and DESIGN.md only — never a Skill', () => {
  const html = V.imageOverviewView(imageModel(), { output: 'skill', image: IMAGE });
  assert.ok(!/data-output="skill"/.test(html), 'Skill offered for an image');
  assert.match(html, /data-output="prompt"/);
  assert.match(html, /data-output="design-md"/);
  // A stale Skill choice falls back rather than rendering an empty card.
  assert.match(html, /is-on[^>]*data-output="(prompt|design-md)"/);
  // Refine is a page-prompt filter (Motion, Layout, Shadow…); none of those
  // can be read from an image, so the disclosure is not offered.
  assert.ok(!/id="vdRefine"/.test(html), 'Refine offered for an image');
  assert.ok(html.includes(U.esc(U.COPY.imageBadge)));
  assert.equal(U.COPY.imageBadge, 'Estimated from image');
});

test('every image screen marks its values as estimates; Motion explains itself', () => {
  const m = imageModel();
  [V.imageColorsView(m), V.imageTypeView(m), V.imageComponentsView(m)].forEach(html => {
    const rows = (html.match(/class="vd-kv[" ]/g) || []).length;
    const marks = (html.match(/vd-kv__meta">[^<]*est\./g) || []).length
                + (html.match(/vd-kv__meta">suggested</g) || []).length;
    assert.ok(rows > 0 && marks === rows, `${marks} marks for ${rows} rows`);
  });
  const motion = V.imageMotionView(m);
  assert.ok(motion.includes(U.esc(U.COPY.imageMotion)));
  assert.equal(U.COPY.imageMotion, "Motion can't be read from a static image. Analyze the live site to measure it.");
  assert.ok(!/class="vd-kv"/.test(motion), 'Motion must show no values for an image');
});

// ── 3b. PROMPT 11b: what defines the image ────────────────────────────────

const GLASS_RAW = fs.readFileSync(path.join(__dirname, 'fixtures', 'image-profile-glass-card.json'), 'utf8');
const glassProfile = () => M.parseStyleProfile(GLASS_RAW);
const glassModel = () => M.buildModelFromStyleProfile(glassProfile(), { name: 'Glass card' });

test('parser: effects, container, hierarchy and evidence come through; icons with one chevron are insufficient', () => {
  const p = glassProfile();
  assert.deepEqual(p.effects.map(e => e.type), ['glass', 'glow', 'gradient']);
  assert.equal(p.effects[1].colour, '#3b82f6');
  assert.equal(p.effects[1].strength, 'strong');
  assert.deepEqual(p.container, { shape: 'rounded rectangle', radiusEstimate: 'large ≈ 24px, relative to the card',
                                  surface: 'translucent', border: 'hairline' });
  assert.equal(p.hierarchy.length, 3);
  assert.equal(p.hierarchy[0], 'oversized numeral');
  assert.equal(p.evidence.effects, 'strong');
  // The fixture rates iconography "weak", but there is one icon. ≥3 or nothing.
  assert.equal(p.iconography.count, 1);
  assert.equal(p.evidence.iconography, 'insufficient');
});

test('parser: description fields get 240 chars cut at a sentence, never mid-word; other strings keep 80', () => {
  const p = glassProfile();
  const raw = JSON.parse(GLASS_RAW).illustration;
  assert.ok(raw.length > 240, 'fixture description must exceed the limit to test the cut');
  assert.ok(p.illustration.length <= 240);
  assert.match(p.illustration, /[.!?…]$/, 'cut must end at a sentence or an ellipsis');
  // Every word in the cut is a whole word of the original.
  const words = new Set(raw.split(/\s+/));
  p.illustration.replace(/…$/, '').split(/\s+/).forEach(w => assert.ok(words.has(w), `truncated word: ${w}`));
  // No-sentence text falls back to a word boundary plus an ellipsis.
  const run = 'word '.repeat(80).trim();
  const cut = M.descriptionCut(run);
  assert.ok(cut.length <= 241 && /word…$/.test(cut));
  // The 80-char guard is unchanged for a non-description field.
  const long = M.parseStyleProfile(JSON.stringify(Object.assign(JSON.parse(GLASS_RAW), { shape: 'x'.repeat(200) })));
  assert.equal(long.shape.length, 80);
});

test('colour roles: only the fixed seven, extras dropped, never numbered', () => {
  const m = glassModel();
  const allowed = new Set(M.IMAGE_ROLES);
  m.colorRoles.forEach(r => assert.ok(allowed.has(r), `unexpected role ${r}`));
  assert.ok(!m.colorRoles.some(r => /\d/.test(r)), 'a numbered role slipped through');
  // The fixture's "accent-2" entry (#1d4ed8) had no free role and is gone.
  assert.ok(m.colorRoles.length <= 7);
  assert.ok(!Object.values(m.colors).includes('#1d4ed8'), 'a second accent was kept');
});

test('a text role below 3:1 against the background is not text: dropped, with its accessibility row', () => {
  const m = glassModel();
  // The fixture names #2a3038 "text-muted"; against #0b1020 it is ~1.5:1.
  assert.ok(M.color.contrast('#2a3038', m.colors.background) < 3);
  assert.equal(m.colors['text-muted'], undefined, 'unreadable text-muted kept');
  assert.ok(!m.colorRoles.includes('text-muted'));
  assert.ok(!Object.values(m.colors).includes('#2a3038'));
  // The readable text roles survive.
  assert.ok(m.colorRoles.includes('text-primary') && m.colorRoles.includes('text-secondary'));
  const md = D.buildDesignMd({}, { model: m, version: '3.0.2' });
  assert.ok(!/text-muted/.test(md), 'text-muted appears in DESIGN.md');
  const a11y = md.slice(md.indexOf('## Accessibility'));
  assert.match(a11y, /text-primary \/ background/);
  assert.ok(!/text-muted \/ background/.test(a11y));
});

test('the style line says each word once', () => {
  const m = glassModel();   // shape "soft" and a mood "soft"
  const words = m.theme.style.replace(/ direction$/, '').split(' ');
  assert.equal(new Set(words).size, words.length, `repeated word in "${m.theme.style}"`);
  assert.ok(words.includes('soft'));
  assert.deepEqual(M.IMAGE_ROLES, ['background', 'surface', 'text-primary', 'text-secondary', 'text-muted', 'accent', 'border']);
});

test('model: insufficient evidence yields no guessed value', () => {
  const m = glassModel();
  assert.equal(m.evidence.iconography, 'insufficient');
  assert.equal(m.iconography.style, null);
  assert.equal(m.iconography.weight, null);
  // A profile without the new fields (pre-11b history) is insufficient for them, not empty-but-fine.
  const old = M.buildModelFromStyleProfile(M.parseStyleProfile(JSON.stringify(PROFILE)), { name: 'old' });
  assert.equal(old.evidence.effects, 'insufficient');
  assert.equal(old.evidence.container, 'insufficient');
  assert.equal(old.evidence.hierarchy, 'insufficient');
  assert.equal(old.evidence.iconography, 'insufficient', 'no icon count → insufficient, retroactively');
});

test('rendering: Snapshot has Effects; Comps shows Container, Effects, Hierarchy before icons; icons say not enough evidence', () => {
  const m = glassModel();
  const snap = V.imageSnapshotRows(m);
  const labels = snap.map(r => r.label);
  assert.ok(labels.includes('Effects'), 'no Effects row');
  assert.match(snap.find(r => r.label === 'Effects').value, /glass · the card surface \(medium\), glow · card bottom edge \(strong\)/);
  assert.equal(snap.find(r => r.label === 'Iconography').value, U.COPY.insufficient);
  assert.equal(U.COPY.insufficient, 'not enough evidence in this image');

  const comps = V.imageComponentsView(m);
  const order = ['>Container<', '>Effects<', '>Hierarchy<', '>Iconography<'].map(t => comps.indexOf(t));
  assert.ok(order.every(i => i >= 0), 'a section is missing: ' + order);
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'sections out of order');
  assert.match(comps, /Radius<\/span><span[^>]*>large ≈ 24px, relative to the card/);
  assert.match(comps, /Surface<\/span><span[^>]*>translucent/);
  assert.match(comps, /glow · card bottom edge/);
  assert.match(comps, /vd-kv__label">1<\/span><span[^>]*>oversized numeral/);
  assert.match(comps, new RegExp('Icons</span><span[^>]*>' + U.COPY.insufficient));
  assert.ok(!/Icon weight/.test(comps), 'a guessed icon value rendered under insufficient evidence');
  // No word was cut: every rendered description ends cleanly.
  assert.ok(!/\w-<\/span>/.test(comps));
});

test('DESIGN.md: title from the label, ## Effects, hierarchy in Visual direction, icons not enough evidence', () => {
  const md = D.buildDesignMd({}, { model: glassModel(), version: '3.0.2' });
  assert.match(md, /^# Glass card Style Direction$/m);
  assert.match(md, /^name: "Glass card Style Direction"$/m);
  assert.match(md, /^## Effects$/m);
  assert.match(md, /\| glow \| card bottom edge \| `#3b82f6` \| strong \|/);
  const vd = md.slice(md.indexOf('## Visual direction'), md.indexOf('## Effects'));
  assert.match(vd, /1\. oversized numeral\n2\. single accent glow under the card\n3\. one line chart/);
  assert.match(md, /\| Icons \| not enough evidence in this image \|/);
  assert.match(md, /\| Container radius \| large ≈ 24px, relative to the card \|/);
  assert.ok(!/\| Icon weight/.test(md));
  // Effects also carries the estimated note like every section.
  const fx = md.slice(md.indexOf('## Effects'), md.indexOf('## Color usage'));
  assert.match(fx, /Estimated from image/);
});

test('filename: DESIGN-<slug>.md from the label, never from a URL', () => {
  const DL = require(path.join(ROOT, 'lib', 'download.js'));
  assert.equal(DL.imageDesignMdFilename('Image style · 2 Sep 2026'), 'DESIGN-image-style-2-sep-2026.md');
  assert.equal(DL.imageDesignMdFilename('Glass card'), 'DESIGN-glass-card.md');
  assert.equal(DL.imageDesignMdFilename(''), 'DESIGN-image.md');
});

// ── 3c. PROMPT 11c: image kind and evidence-gated roles ───────────────────

const GRID_RAW = fs.readFileSync(path.join(__dirname, 'fixtures', 'image-profile-grid-pattern.json'), 'utf8');
const gridModel = () => M.buildModelFromStyleProfile(M.parseStyleProfile(GRID_RAW), { name: 'Grid pattern' });

test('pattern kind: no text roles, no type direction, no font suggestions, no container', () => {
  const m = gridModel();
  assert.equal(m.imageKind, 'pattern');
  assert.equal(m.hasInterface, false);
  assert.equal(m.hasText, false);
  m.colorRoles.forEach(r => assert.ok(!/^text-/.test(r), `text role ${r} in an image with no text`));
  // The fixture even names a "text-muted" entry; without visible text it is refused.
  assert.ok(!m.colors['text-muted']);
  assert.equal(m.typography.direction, null);
  assert.deepEqual(m.fonts, [], 'font suggestions need a type direction');
  assert.equal(m.container, null);
  assert.deepEqual(m.effects.map(e => e.type), ['pattern', 'other']);
  assert.equal(m.evidence.text, 'insufficient');
  assert.equal(m.evidence.typography, 'insufficient');
});

test('kinds and effect types are the spec enums; an unknown kind reads as mixed', () => {
  assert.deepEqual(M.IMAGE_KINDS, ['ui-screenshot', 'illustration', 'pattern', 'photo', 'typography', 'mixed']);
  assert.deepEqual(M.NO_INTERFACE_KINDS, ['pattern', 'illustration', 'photo']);
  assert.ok(M.EFFECT_TYPES.includes('pattern') && M.EFFECT_TYPES.includes('other'));
  const p = M.parseStyleProfile(JSON.stringify(Object.assign(JSON.parse(GRID_RAW), { image_kind: 'hologram' })));
  assert.equal(p.imageKind, 'mixed');
  // The prompt asks for the kind, the text evidence, and prefers pattern/other.
  assert.match(AI.IMAGE_PROFILE_PROMPT, /"image_kind": "ui-screenshot \| illustration \| pattern \| photo \| typography \| mixed"/);
  assert.match(AI.IMAGE_PROFILE_PROMPT, /"text": "strong \| weak \| insufficient/);
  assert.match(AI.IMAGE_PROFILE_PROMPT, /Prefer these over forcing "gradient" or "grain"/);
});

test('ui-screenshot / typography / mixed keep typography, fonts and container', () => {
  const glass = M.buildModelFromStyleProfile(M.parseStyleProfile(GLASS_RAW), { name: 'Glass card' });
  assert.equal(glass.imageKind, 'mixed', 'no kind in a pre-11c profile reads as mixed');
  assert.equal(glass.hasInterface, true);
  assert.ok(glass.colorRoles.includes('text-primary'));
  assert.ok(glass.typography.direction && glass.typography.direction.classification);
  assert.ok(glass.fonts.length > 0);
  assert.ok(glass.container);
  const md = D.buildDesignMd({}, { model: glass, version: '3.0.2' });
  assert.match(md, /^## Typography$/m); assert.match(md, /^## Fonts$/m); assert.match(md, /\| Container radius \|/);
  assert.ok(!md.includes('This image contains no interface'));
});

test('pattern kind renders: Type tab says no interface, Components has no Container, DESIGN.md omits the blocks', () => {
  const m = gridModel();
  const type = V.imageTypeView(m);
  assert.ok(type.includes(U.esc(U.COPY.noInterface)));
  assert.equal(U.COPY.noInterface, 'This image contains no interface; the direction covers palette, motif and texture only.');
  assert.ok(!/class="vd-kv"/.test(type), 'no type rows for a pattern');
  const comps = V.imageComponentsView(m);
  assert.ok(!/>Container</.test(comps), 'Container block rendered for a pattern');
  assert.match(comps, /pattern · whole image/);
  assert.match(comps, /other · background/);
  const snap = V.imageSnapshotRows(m);
  assert.ok(!snap.some(r => r.label === 'Type direction'));
  assert.equal(snap.find(r => r.label === 'Kind').value, 'pattern');

  const md = D.buildDesignMd({}, { model: m, version: '3.0.2' });
  const headings = md.match(/^## .*$/gm) || [];
  ['## Typography', '## Fonts'].forEach(h => assert.ok(!headings.includes(h), `${h} present for a pattern`));
  assert.ok(!/\| Container/.test(md), 'a container row in a pattern document');
  assert.match(md, /^image-kind: pattern$/m);
  const vd = md.slice(md.indexOf('## Visual direction'), md.indexOf('## Effects'));
  assert.match(vd, /Estimated from image[^]*This image contains no interface; the direction covers palette, motif and texture only\./);
  assert.match(md, /\| pattern \| whole image \| `#f2f2f2` \| strong \|/);
  // Accessibility: no text pairs to grade — only what exists is graded.
  const a11y = md.slice(md.indexOf('## Accessibility'));
  assert.ok(!/text-primary/.test(a11y));
  assert.ok(!/text-/.test(md.slice(md.indexOf('## Color usage'), md.indexOf('## Components'))), 'a text role in Color usage');
});

test('Do/Don\'t follow the image kind', () => {
  const pat = D.buildDesignMd({}, { model: gridModel(), version: '3.0.2' });
  const pDo = pat.slice(pat.indexOf('## Do'), pat.indexOf("## Don't"));
  const pDont = pat.slice(pat.indexOf("## Don't"), pat.indexOf('## Agent instructions'));
  assert.ok(pDo.includes('- Start from the palette and motif; use the pattern as texture or accent, not as interface structure.'));
  assert.ok(pDo.includes('- Measure a real screen before turning any value into a token.'));
  assert.ok(pDont.includes("- Don't present these values as measured."));
  assert.ok(pDont.includes("- Don't invent typography, spacing, motion or states: none were observed."));
  assert.ok(!pDo.includes('type direction'), 'interface wording in a pattern document');
  assert.ok(!pDont.includes('suggested font'));

  const ui = D.buildDesignMd({}, { model: glassModel(), version: '3.0.2' });
  const uDo = ui.slice(ui.indexOf('## Do'), ui.indexOf("## Don't"));
  const uDont = ui.slice(ui.indexOf("## Don't"), ui.indexOf('## Agent instructions'));
  assert.ok(uDo.includes('- Start from the palette and type direction above; refine against real screens.'));
  assert.ok(uDo.includes('- Keep the shape language and icon style consistent with the estimate.'));
  assert.ok(uDont.includes("- Don't treat a suggested font as the source's font."));
  assert.ok(!uDo.includes('as texture or accent'));
});

// ── 4. the panel: failure path, history, settings help ────────────────────

const LIBS = [
  'lib/color-utils.js', 'lib/noise-filter.js', 'lib/shadow-utils.js',
  'lib/prompt-builder.js', 'lib/ai-caller.js', 'lib/model-discovery.js',
  'lib/usage-meter.js',
  'lib/download.js', 'lib/data/google-fonts.js', 'lib/design-model.js',
  'lib/token-exporter.js', 'lib/design-md-builder.js', 'lib/zip-lite.js',
  'lib/skill-builder.js', 'lib/ui-components.js', 'lib/ui-helpers.js',
];

function makeChrome(store) {
  const data = Object.assign({}, store);
  return {
    _data: data,
    runtime: { getManifest: () => ({ version: '3.0.2' }), onMessage: { addListener() {} },
               sendMessage: () => Promise.resolve({ success: false }), getURL: p => p, lastError: null },
    storage: { local: {
      get: keys => {
        const list = Array.isArray(keys) ? keys : (typeof keys === 'string' ? [keys] : Object.keys(keys || data));
        const out = {}; list.forEach(k => { if (k in data) out[k] = data[k]; });
        return Promise.resolve(out);
      },
      set: obj => { Object.assign(data, obj); return Promise.resolve(); },
      remove: k => { delete data[k]; return Promise.resolve(); },
    }, onChanged: { addListener() {} } },
    tabs: { query: () => Promise.resolve([{ id: 1, url: 'https://rig.ai/' }]),
            get: () => Promise.resolve({ id: 1, url: 'https://rig.ai/' }),
            sendMessage: () => Promise.resolve({ success: false }),
            onActivated: { addListener() {} }, onUpdated: { addListener() {} } },
    scripting: { executeScript: () => Promise.resolve([]) },
    sidePanel: { open: () => Promise.resolve() },
  };
}

// The same boot as ui-panel.test.js, with the two things this file needs on
// top: a console that records every level, and a fetch that fails loudly if
// anything tries the network.
async function boot(t, o) {
  const opts = o || {};
  const dom = new JSDOM('<!doctype html><html><body data-context="sidepanel"><div class="app"></div></body></html>',
    { pretendToBeVisual: true, url: 'https://example.org/' });
  const win = dom.window;
  const logged = [];
  win.chrome = makeChrome(opts.storage || {});
  win.self = win;
  win.console = { warn: (...a) => logged.push(['warn', a.join(' ')]), log: (...a) => logged.push(['log', a.join(' ')]),
                  error: (...a) => logged.push(['error', a.join(' ')]), debug: (...a) => logged.push(['debug', a.join(' ')]) };
  win.URL.createObjectURL = () => 'blob:stub'; win.URL.revokeObjectURL = () => {};
  win.__names = [];
  const realCreate = win.document.createElement.bind(win.document);
  win.document.createElement = tag => {
    const el = realCreate(tag);
    if (String(tag).toLowerCase() === 'a') el.click = () => win.__names.push(el.download);
    return el;
  };
  win.navigator.clipboard = { writeText: () => Promise.resolve() };
  const fetches = [];
  win.fetch = (url) => { fetches.push(String(url)); return Promise.reject(new Error('offline in tests')); };
  const ctx = vm.createContext(win);
  LIBS.forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
  vm.runInContext(`self.VD_AUTH = { peekSession: () => Promise.resolve(null), isAuthenticated: () => Promise.resolve(false),
    openAuthFlow: () => Promise.resolve({ ok: false }), signOut: () => Promise.resolve(),
    getRefreshStatus: () => Promise.resolve(null), onAuthStateChange: () => {} };`, ctx);
  await new Promise((resolve, reject) => {
    ctx.__done = resolve; ctx.__fail = reject;
    vm.runInContext('initUI({surface:"sidepanel"}).then(__done, __fail);', ctx);
  });
  if (t && typeof t.after === 'function') t.after(() => { try { win.close(); } catch (e) { /* gone */ } });
  const $ = sel => win.document.querySelector(sel);
  const text = () => win.document.body.textContent.replace(/\s+/g, ' ').trim();
  return { win, ctx, $, text, logged, fetches, run: code => vm.runInContext(code, ctx) };
}

const WITH_KEY = { vd_ai_enabled: true, provider: 'claude', apiKeys: { claude: 'k' }, vd_source: 'image' };

test('Image mode with a key: switcher, live drop zone, and Settings says the key is required', async t => {
  const p = await boot(t, { storage: WITH_KEY });
  assert.ok(p.$('#vdSourceSeg'), 'no source switcher');
  assert.equal(p.$('[data-source="image"]').getAttribute('aria-checked'), 'true');
  assert.ok(p.$('#vdDropZone') && !p.$('#vdDropZone.is-gated'));
  assert.ok(!p.$('[data-mode]'), 'Page/Element must not show in Image mode');
  p.run('setTab("settings")');
  assert.ok(p.text().includes(U.COPY.aiRequiredForImage));
  assert.equal(U.COPY.aiRequiredForImage, 'Required for image analysis.');
});

test('Image mode without a key: gated, and Turn on opens Settings', async t => {
  const p = await boot(t, { storage: { vd_source: 'image' } });
  assert.ok(p.$('#vdDropZone.is-gated'));
  assert.ok(p.text().includes(U.COPY.imageGate));
  p.$('[data-action="openSettings"]').dispatchEvent(new p.win.Event('click', { bubbles: true }));
  assert.ok(p.$('#vdAiToggle'), 'Turn on did not open Settings');
});

test('malformed reply: the §9 line is shown and nothing is logged or fetched elsewhere', async t => {
  const p = await boot(t, { storage: WITH_KEY });
  p.ctx.__img = IMAGE;
  p.run('state.image = __img; renderPanel();');
  assert.ok(!p.$('#analyzeImageBtn').disabled);
  // The provider answers with prose instead of the profile.
  p.run('self.analyzeImageWithAI = async () => "Sure! Here is a description of your lovely image…";');
  p.run('self.pickVisionModel = () => "claude-fable-5-1";');
  p.logged.length = 0;
  await p.run('analyzeImage()');
  assert.ok(p.text().includes(U.COPY.imageUnreadable), 'error line not shown');
  assert.equal(U.COPY.imageUnreadable, "Couldn't read this image — try another");
  assert.deepEqual(p.logged, [], 'a malformed reply must log nothing');
  assert.deepEqual(p.fetches, [], 'nothing but the provider call may touch the network');
  assert.ok(!p.run('state.model'), 'no model after a failed analysis');
  assert.equal(p.win.chrome._data.promptHistory, undefined, 'a failed analysis must not be saved');
});

test('good reply: estimated model, image history entry stays local with its bytes', async t => {
  const p = await boot(t, { storage: WITH_KEY });
  p.ctx.__img = IMAGE; p.ctx.__reply = JSON.stringify(PROFILE);
  p.run('state.image = __img; renderPanel();');
  p.run('self.analyzeImageWithAI = async () => __reply; self.pickVisionModel = () => "claude-fable-5-1";');
  await p.run('analyzeImage()');
  assert.equal(p.run('state.model && state.model.sourceType'), 'image');
  assert.equal(p.run('state.model.confidence'), 'estimated');
  assert.ok(p.text().includes(U.COPY.imageBadge));
  // The tab bar is the same six; Motion opens and explains itself.
  p.run('setTab("motion")');
  assert.ok(p.text().includes(U.COPY.imageMotion));
  // History: keyed for images, typed, carrying the image and the profile.
  const hist = p.win.chrome._data.promptHistory;
  const keys = Object.keys(hist);
  assert.equal(keys.length, 1);
  assert.match(keys[0], /^image:icon-set\.png:\d+$/);
  const entry = hist[keys[0]];
  assert.equal(entry.sourceType, 'image');
  assert.equal(entry.image.dataUrl, PNG);
  assert.ok(entry.styleProfile && entry.styleProfile.palette.length === 6);
  assert.equal(entry.url, '');
  // No cloud call was attempted.
  assert.deepEqual(p.fetches, []);
  // Export: a Skill choice cannot be set in Image mode.
  p.run('setTab("overview"); setOutput("skill")');
  assert.notEqual(p.run('state.output'), 'skill');
});

test('label: asked after choosing, defaults to "Image style · <date>", becomes title and filename', async t => {
  const p = await boot(t, { storage: WITH_KEY });
  p.ctx.__img = Object.assign({}, IMAGE, { label: 'Image style · 2 Sep 2026' });
  p.ctx.__reply = GLASS_RAW;
  p.run('state.image = __img; renderPanel();');
  const input = p.$('#vdImageLabel');
  assert.ok(input, 'no label input after choosing an image');
  assert.equal(input.value, 'Image style · 2 Sep 2026');
  assert.match(p.run('defaultImageLabel(0)'), /^Image style · 1 Jan 1970$/);
  // The user renames it before analysing.
  input.value = 'Glass card';
  p.run('self.analyzeImageWithAI = async () => __reply; self.pickVisionModel = () => "claude-fable-5-1";');
  await p.run('analyzeImage()');
  assert.equal(p.run('state.image.label'), 'Glass card');
  assert.equal(p.run('state.model.source.name'), 'Glass card');
  assert.match(p.run('buildDesignMdDoc()'), /^# Glass card Style Direction$/m);
  // Download names the file by the label — the active tab is rig.ai in this
  // harness and must not appear.
  p.run('state.output = "design-md"; downloadDesignMd()');
  const names = p.run('__names') || [];
  assert.deepEqual(names, ['DESIGN-glass-card.md']);
  const entry = Object.values(p.win.chrome._data.promptHistory)[0];
  assert.equal(entry.domain, 'Glass card');
  assert.ok(p.text().includes('Glass card'));
});

test('switching back to Website restores Page/Element and the three outputs', async t => {
  const p = await boot(t, { storage: WITH_KEY });
  p.$('[data-source="website"]').dispatchEvent(new p.win.Event('click', { bubbles: true }));
  assert.equal(p.run('state.source'), 'website');
  assert.ok(p.$('[data-mode="page"]') && p.$('[data-mode="element"]'));
  assert.ok(!p.$('#vdDropZone'));
  assert.equal(p.win.chrome._data.vd_source, 'website');
});

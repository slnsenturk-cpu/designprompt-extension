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

test('switching back to Website restores Page/Element and the three outputs', async t => {
  const p = await boot(t, { storage: WITH_KEY });
  p.$('[data-source="website"]').dispatchEvent(new p.win.Event('click', { bubbles: true }));
  assert.equal(p.run('state.source'), 'website');
  assert.ok(p.$('[data-mode="page"]') && p.$('[data-mode="element"]'));
  assert.ok(!p.$('#vdDropZone'));
  assert.equal(p.win.chrome._data.vd_source, 'website');
});

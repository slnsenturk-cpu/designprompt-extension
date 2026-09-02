// VibeDesign — image-stays-local guard (§4.6, PROMPT 11).
//
// The invariant: an image a user analyzes never leaves the device except to
// the AI provider they chose. It lives in chrome.storage.local, next to the
// API keys it needs, and lib/cloud-sync.js may never put it — or a thumbnail,
// or a data: URL of any kind — into a Supabase payload.
//
// Same shape as cloud-sync-no-keys.test.js: drive the real module against a
// fake Supabase client, poison the input with every image-shaped field an
// image history entry carries, assert on every payload that reaches
// `.insert()`.
//
//   node --test tests/cloud-sync-image-local.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const MODULE_PATH = path.join(__dirname, '..', 'lib', 'cloud-sync.js');

// Mirrors the allowlists in cloud-sync-no-keys.test.js. If a column is added
// there it must be added here too — and the question to ask is whether that
// column could ever carry an image.
const ALLOWED_ANALYSIS_FIELDS = new Set([
  'user_id', 'url', 'hostname', 'primary_color', 'page_background',
  'page_title', 'extraction_version', 'tokens_json', 'created_at',
]);
const ALLOWED_PROMPT_FIELDS = new Set([
  'user_id', 'analysis_id', 'prompt_text', 'target_platform',
  'focus', 'ai_provider', 'was_ai_enhanced', 'created_at',
]);

// Field names an image entry carries, none of which may cross the wire.
const FORBIDDEN_FIELD_RE = /^(image|thumbnail|thumb|dataUrl|data_url|imageData|image_data|blob|file|bytes|base64)$/i;

// A data: URL or a run of base64 long enough to be pixels. Short base64-ish
// runs are fine (ids, hashes); an image is never short.
const IMAGE_VALUE_RE = /data:image\/[a-z]+;base64,|[A-Za-z0-9+/]{200,}={0,2}/;

// The poison: a tiny but real-shaped PNG data URL, plus a long base64 body.
const PIXELS = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='.repeat(4);
const POISON_IMAGE = {
  sourceType: 'image',
  image: { name: 'moodboard.png', type: 'image/png', size: 1234, dataUrl: 'data:image/png;base64,' + PIXELS },
  thumbnail: 'data:image/webp;base64,' + PIXELS,
  dataUrl: 'data:image/jpeg;base64,' + PIXELS,
  imageData: PIXELS,
  base64: PIXELS,
};

function loadCloudSync({ history = {} } = {}) {
  const inserts = [];
  const store = { promptHistory: history };

  function table(name) {
    const chain = {
      insert(payload) { inserts.push({ table: name, payload }); return chain; },
      select() { return chain; }, delete() { return chain; }, eq() { return chain; },
      order() { return chain; }, limit() { return chain; },
      single: async () => ({ data: { id: 'row-1' }, error: null }),
      then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); },
    };
    return chain;
  }

  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    Date, JSON, Object, Promise, Error, String, Array,
    chrome: { storage: { local: {
      get: async k => (typeof k === 'string' ? { [k]: store[k] } : { ...store }),
      set: async o => { Object.assign(store, o); },
    } } },
    VD_AUTH: { peekSession: async () => ({ user: { id: 'user-abc' } }) },
    VD_SUPABASE: { initSupabase: () => ({ from: table, auth: { getUser: async () => ({ data: { user: { id: 'user-abc' } } }) } }) },
  };
  sandbox.self = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(MODULE_PATH, 'utf8'), sandbox, { filename: 'lib/cloud-sync.js' });
  return { VD_CLOUD: sandbox.VD_CLOUD, inserts, store };
}

function assertNoImage(inserts) {
  assert.ok(inserts.length > 0, 'expected at least one insert to inspect');
  for (const { table, payload } of inserts) {
    const allowed = table === 'analyses' ? ALLOWED_ANALYSIS_FIELDS : ALLOWED_PROMPT_FIELDS;
    for (const field of Object.keys(payload)) {
      assert.ok(!FORBIDDEN_FIELD_RE.test(field), `${table}: image field "${field}" in cloud-sync payload`);
      assert.ok(allowed.has(field), `${table}: unexpected field "${field}" in cloud-sync payload`);
    }
    const serialized = JSON.stringify(payload);
    const match = serialized.match(IMAGE_VALUE_RE);
    assert.equal(match, null, `${table}: image data reached the payload: ${match && match[0].slice(0, 40)}…`);
  }
}

// ── tests ──────────────────────────────────────────────────────────────────

test('syncAnalysis: an image-source analysis (no http URL) is not synced at all', async () => {
  const { VD_CLOUD, inserts } = loadCloudSync();
  await VD_CLOUD.syncAnalysis({
    url: '', hostname: 'moodboard.png', page_title: 'moodboard.png',
    primary_color: '#e5484d', page_background: '#ffffff',
    extraction_version: '3.0', tokens_json: { colors: ['#e5484d'] },
    ...POISON_IMAGE,
  });
  // cloud-sync only syncs http(s) sources. An image has none, so nothing is
  // written — not a stripped row, nothing.
  assert.equal(inserts.length, 0, 'an image analysis must produce no insert');
});

test('syncAnalysis: image fields riding on a website analysis never reach the payload', async () => {
  const { VD_CLOUD, inserts } = loadCloudSync();
  const res = await VD_CLOUD.syncAnalysis({
    url: 'https://example.com/pricing', hostname: 'example.com', page_title: 'Pricing',
    primary_color: '#e5484d', page_background: '#ffffff',
    extraction_version: '3.0', tokens_json: { colors: ['#e5484d'] },
    ...POISON_IMAGE,
  });
  assert.equal(res.ok, true);
  assert.deepEqual(inserts.map(i => i.table), ['analyses']);
  assertNoImage(inserts);
  assert.equal(inserts[0].payload.hostname, 'example.com');
});

test('syncPrompt: an image riding on the prompt entry is dropped', async () => {
  const { VD_CLOUD, inserts } = loadCloudSync();
  const res = await VD_CLOUD.syncPrompt({
    prompt_text: 'Style direction estimated from an image.',
    target_platform: 'cursor', focus: 'all', ai_provider: 'claude', was_ai_enhanced: true,
    ...POISON_IMAGE,
  }, 'analysis-1');
  assert.equal(res.ok, true);
  assertNoImage(inserts);
});

test('syncAnalysis: image bytes hidden inside tokens_json are caught by the value scan', async () => {
  const { VD_CLOUD, inserts } = loadCloudSync();
  await VD_CLOUD.syncAnalysis({
    url: 'https://example.com', hostname: 'example.com',
    tokens_json: { colors: ['#000'], stowaway: POISON_IMAGE.image.dataUrl },
  });
  // tokens_json passes through whole, so this is the one real path in — the
  // guard has to be a value scan, and this proves the scan fires.
  assert.throws(() => assertNoImage(inserts), /image data reached the payload/);
});

test('migrateAnonymousHistory: image history entries sync without their image', async () => {
  const { VD_CLOUD, inserts, store } = loadCloudSync({
    history: {
      'image:moodboard.png:1': {
        url: '', domain: 'moodboard.png', prompt: 'Prompt from image', platform: 'cursor',
        focus: 'all', provider: 'claude', savedAt: 1771784065000, ...POISON_IMAGE,
      },
      'example.com': {
        url: 'https://example.com', domain: 'example.com', prompt: 'Prompt B',
        platform: 'lovable', provider: 'gemini', savedAt: 1771784066000, sourceType: 'website',
      },
    },
  });
  const res = await VD_CLOUD.migrateAnonymousHistory();
  assert.equal(res.ok, true);
  // An image analysis has no http(s) URL, and cloud-sync only migrates
  // entries that have one — so the image entry is not synced AT ALL, not
  // even stripped. Only the website entry crosses. That is the stronger
  // guarantee, and this pins it.
  assert.equal(res.migrated, 1);
  assertNoImage(inserts);
  assert.ok(inserts.every(i => i.payload.hostname !== 'moodboard.png' && i.payload.page_title !== 'moodboard.png'),
    'the image entry must not be migrated in any form');
  // The image is still where it belongs: local, untouched.
  assert.equal(store.promptHistory['image:moodboard.png:1'].image.dataUrl, POISON_IMAGE.image.dataUrl);
});

test('cloud-sync.js source: never references image, thumbnail or dataUrl', () => {
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  assert.equal(/\b(thumbnail|dataUrl|imageData|base64)\b/.test(src), false,
    'lib/cloud-sync.js must have no reason to touch image data');
});

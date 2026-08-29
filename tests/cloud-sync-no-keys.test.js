// VibeDesign — cloud-sync key-leak guard.
//
// The one invariant this file defends: a user's provider API key must NEVER
// leave the device. Keys live in chrome.storage.local under `apiKeys` and are
// read only to build a request to the provider itself. Nothing in
// lib/cloud-sync.js may put one in a Supabase payload.
//
// lib/cloud-sync.js enforces this structurally: both payloads are built
// field-by-field from an explicit allowlist, never spread from the caller's
// object. This suite pins that down by driving the real module against a fake
// Supabase client, feeding it deliberately poisoned input, and asserting on
// every payload that actually reaches `.insert()`.
//
// It fails loudly if someone ever switches a payload to `{...analysisData}`,
// adds a key-shaped field, or lets a key-shaped value through.
//
// Plain node:test — no dependencies, no build step. Run with:
//   node --test tests/cloud-sync-no-keys.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const MODULE_PATH = path.join(__dirname, '..', 'lib', 'cloud-sync.js');

// Exactly the columns cloud-sync is allowed to write. A new field here is a
// deliberate decision, so it must be added consciously — the test failing is
// the point, not a nuisance.
//
// `tokens_json` is the one name containing "token": it holds extracted DESIGN
// tokens (colors, spacing, type scale) from the analyzed page, never an auth
// token. Its contents are asserted separately below.
const ALLOWED_ANALYSIS_FIELDS = new Set([
  'user_id', 'url', 'hostname', 'primary_color', 'page_background',
  'page_title', 'extraction_version', 'tokens_json', 'created_at',
]);

const ALLOWED_PROMPT_FIELDS = new Set([
  'user_id', 'analysis_id', 'prompt_text', 'target_platform',
  'focus', 'ai_provider', 'was_ai_enhanced', 'created_at',
]);

// Field names that must never appear, whatever the table.
const FORBIDDEN_FIELD_RE = /(^|_)(api_?keys?|secret|password|credential|bearer|authorization)($|_)|apikey/i;

// Values shaped like a real provider key.
const KEY_VALUE_RE = /sk-ant-[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{20,}|gsk_[A-Za-z0-9]{20,}|xai-[A-Za-z0-9]{20,}/;

// The poison. Every one of these must be dropped on the floor.
const POISON_KEYS = {
  apiKey: 'sk-ant-api03-POISON0000000000000000000000000000',
  apiKeys: {
    claude: 'sk-ant-api03-POISON0000000000000000000000000000',
    openai: 'sk-proj-POISON00000000000000000000000000000000',
    gemini: 'AIzaSyPOISON000000000000000000000000000',
  },
  api_key: 'sk-POISON0000000000000000000000000000',
  apikey: 'AIzaSyPOISON000000000000000000000000000',
  secret: 'POISON-secret',
  password: 'POISON-password',
  authorization: 'Bearer sk-ant-POISON0000000000000000000000',
};

// ── harness ────────────────────────────────────────────────────────────────
// Loads the real lib/cloud-sync.js into a sandbox with a fake Supabase client
// that records, rather than sends, every insert payload.
function loadCloudSync({ history = {} } = {}) {
  const inserts = [];   // { table, payload }
  const store = { promptHistory: history, apiKeys: POISON_KEYS.apiKeys };

  function table(name) {
    const chain = {
      insert(payload) { inserts.push({ table: name, payload }); return chain; },
      select() { return chain; },
      delete() { return chain; },
      eq() { return chain; },
      order() { return chain; },
      limit() { return chain; },
      single: async () => ({ data: { id: 'row-1' }, error: null }),
      then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); },
    };
    return chain;
  }

  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    Date, JSON, Object, Promise, Error, String, Array,
    chrome: {
      storage: {
        local: {
          get: async k => (typeof k === 'string' ? { [k]: store[k] } : { ...store }),
          set: async o => { Object.assign(store, o); },
        },
      },
    },
    VD_AUTH: { peekSession: async () => ({ user: { id: 'user-abc' } }) },
    VD_SUPABASE: { initSupabase: () => ({ from: table, auth: { getUser: async () => ({ data: { user: { id: 'user-abc' } } }) } }) },
  };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(MODULE_PATH, 'utf8'), sandbox, { filename: 'lib/cloud-sync.js' });

  return { VD_CLOUD: sandbox.VD_CLOUD, inserts, store };
}

// The actual assertion, applied to every captured payload.
function assertNoKeys(inserts) {
  assert.ok(inserts.length > 0, 'expected at least one insert to inspect');
  for (const { table, payload } of inserts) {
    const allowed = table === 'analyses' ? ALLOWED_ANALYSIS_FIELDS : ALLOWED_PROMPT_FIELDS;

    for (const field of Object.keys(payload)) {
      assert.ok(
        !FORBIDDEN_FIELD_RE.test(field),
        `${table}: forbidden field "${field}" in cloud-sync payload`,
      );
      assert.ok(
        allowed.has(field),
        `${table}: unexpected field "${field}" in cloud-sync payload — if this column is
         intentional, add it to the allowlist in this test and confirm it cannot carry a key`,
      );
    }

    // Nothing key-shaped may ride along inside a value either (e.g. a key
    // pasted into a prompt, or stuffed into tokens_json).
    const serialized = JSON.stringify(payload);
    const match = serialized.match(KEY_VALUE_RE);
    assert.equal(match, null, `${table}: key-shaped value reached the payload: ${match && match[0]}`);
  }
}

// ── tests ──────────────────────────────────────────────────────────────────

test('syncAnalysis: key fields on the input never reach the payload', async () => {
  const { VD_CLOUD, inserts } = loadCloudSync();

  const res = await VD_CLOUD.syncAnalysis({
    url: 'https://example.com/pricing',
    hostname: 'example.com',
    primary_color: '#4285f4',
    page_background: '#ffffff',
    page_title: 'Pricing',
    extraction_version: '3.0',
    tokens_json: { colors: ['#4285f4'] },
    ...POISON_KEYS,
  });

  assert.equal(res.ok, true);
  assert.deepEqual(inserts.map(i => i.table), ['analyses']);
  assertNoKeys(inserts);
  // Belt and braces: the legitimate fields did survive, so we know the
  // allowlist is copying rather than dropping everything.
  assert.equal(inserts[0].payload.hostname, 'example.com');
  assert.equal(inserts[0].payload.user_id, 'user-abc');
});

test('syncPrompt: key fields on the input never reach the payload', async () => {
  const { VD_CLOUD, inserts } = loadCloudSync();

  const res = await VD_CLOUD.syncPrompt({
    prompt_text: 'Build a pricing page.',
    target_platform: 'v0',
    focus: 'all',
    ai_provider: 'claude',
    was_ai_enhanced: true,
    ...POISON_KEYS,
  }, 'analysis-1');

  assert.equal(res.ok, true);
  assert.deepEqual(inserts.map(i => i.table), ['prompts']);
  assertNoKeys(inserts);
  assert.equal(inserts[0].payload.prompt_text, 'Build a pricing page.');
  // ai_provider records WHICH provider was used — never the key for it.
  assert.equal(inserts[0].payload.ai_provider, 'claude');
});

test('syncAnalysis: a key hidden inside tokens_json is caught', async () => {
  const { VD_CLOUD, inserts } = loadCloudSync();

  await VD_CLOUD.syncAnalysis({
    url: 'https://example.com',
    hostname: 'example.com',
    tokens_json: { colors: ['#000'], stowaway: POISON_KEYS.apiKey },
  });

  // tokens_json is passed through wholesale, so this is a real leak path: the
  // guard has to be a value scan, not just a field-name check.
  assert.throws(() => assertNoKeys(inserts), /key-shaped value reached the payload/);
});

test('migrateAnonymousHistory: no key reaches any payload, and apiKeys is never read', async () => {
  const { VD_CLOUD, inserts, store } = loadCloudSync({
    history: {
      a: {
        url: 'https://example.com/a', domain: 'example.com',
        prompt: 'Prompt A', platform: 'v0', focus: 'all',
        provider: 'claude', savedAt: 1771784065000,
        ...POISON_KEYS,
      },
      b: {
        url: 'https://example.org/b', domain: 'example.org',
        prompt: 'Prompt B', platform: 'lovable',
        provider: 'gemini', savedAt: 1771784066000,
      },
    },
  });

  const res = await VD_CLOUD.migrateAnonymousHistory();

  assert.equal(res.ok, true);
  assert.equal(res.migrated, 2);
  // One analysis + one prompt per entry.
  assert.deepEqual(inserts.map(i => i.table), ['analyses', 'prompts', 'analyses', 'prompts']);
  assertNoKeys(inserts);

  // The migration synthesizes empty analyses — tokens_json must be {}, so a
  // key can't ride in through it either. (Compared by key count, not
  // deepEqual: the object is created inside the vm sandbox, so it has a
  // different Object.prototype than this file's realm.)
  inserts.filter(i => i.table === 'analyses')
    .forEach(i => assert.deepEqual(Object.keys(i.payload.tokens_json), []));

  // apiKeys sits right next to promptHistory in chrome.storage.local. Confirm
  // the migration left it alone rather than sweeping the whole store.
  assert.deepEqual(store.apiKeys, POISON_KEYS.apiKeys, 'apiKeys must be untouched');
});

test('cloud-sync.js source: payloads are built from an allowlist, never spread', () => {
  const src = fs.readFileSync(MODULE_PATH, 'utf8');

  // A spread into a payload would silently defeat every test above, so ban the
  // pattern at the source level.
  assert.equal(
    /var payload = \{[^}]*\.\.\./.test(src), false,
    'cloud-sync payloads must not spread caller-supplied objects',
  );
  assert.equal(
    /\.insert\(\s*(analysisData|promptData|entry)\s*\)/.test(src), false,
    'cloud-sync must never insert a caller-supplied object directly',
  );
  // And the module must have no reason to touch the key store at all.
  assert.equal(
    /apiKeys?\b/i.test(src), false,
    'lib/cloud-sync.js must not reference apiKeys',
  );
});

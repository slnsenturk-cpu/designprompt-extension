// Plain node:test suite — no dependencies, no build step (matches the rest
// of this repo). Run with:
//   node --test tests/model-discovery.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const MODULE_PATH = path.join(__dirname, '..', 'lib', 'model-discovery.js');

// Fresh require + fresh in-memory chrome.storage.local mock per test, so
// the 24h cache from one test can't leak into another.
function loadVDModels() {
  delete require.cache[require.resolve(MODULE_PATH)];
  let store = {};
  global.chrome = {
    storage: {
      local: {
        get: async (key) => {
          if (typeof key === 'string') return { [key]: store[key] };
          return { ...store };
        },
        set: async (obj) => { Object.assign(store, obj); },
      },
    },
  };
  return require(MODULE_PATH);
}

const STATIC_CLAUDE = [
  { id: 'claude-fable-5', label: 'Fable 5', note: 'Paid · Highest capability · Slower' },
  { id: 'claude-opus-5', label: 'Opus 5', note: 'Paid · Complex work' },
  { id: 'claude-sonnet-5', label: 'Sonnet 5', note: 'Paid · Fast · Best value' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', note: 'Paid · Fastest · Low cost' },
];

test('getMergedModels: list success merges live models, newest first, and caches', async () => {
  const VD_MODELS = loadVDModels();
  let fetchCalls = 0;
  global.fetch = async (url) => {
    fetchCalls++;
    assert.match(url, /^https:\/\/api\.anthropic\.com\/v1\/models$/);
    return {
      ok: true,
      json: async () => ({
        data: [
          { id: 'claude-haiku-4-5-20251001', display_name: 'Claude Haiku 4.5', created_at: '2025-10-01T00:00:00Z' },
          { id: 'claude-sonnet-5', display_name: 'Claude Sonnet 5', created_at: '2026-06-01T00:00:00Z' },
          { id: 'claude-fable-5', display_name: 'Claude Fable 5', created_at: '2026-07-01T00:00:00Z' },
        ],
      }),
    };
  };

  const merged = await VD_MODELS.getMergedModels('claude', 'sk-ant-test', STATIC_CLAUDE);

  assert.equal(fetchCalls, 1);
  // Newest first (fable 07-01, sonnet 06-01, haiku 10-01-2025), then the
  // static-only entry (opus-5, never returned live) tacked on at the end.
  assert.deepEqual(merged.map(m => m.id), [
    'claude-fable-5', 'claude-sonnet-5', 'claude-haiku-4-5-20251001', 'claude-opus-5',
  ]);
  // Curated static label/note win over the raw API display_name.
  assert.equal(merged[0].label, 'Fable 5');

  // Second call within 24h must hit the cache, not the network.
  const merged2 = await VD_MODELS.getMergedModels('claude', 'sk-ant-test', STATIC_CLAUDE);
  assert.equal(fetchCalls, 1);
  assert.deepEqual(merged2, merged);
});

test('getMergedModels: list failure falls back to the static list and does not throw', async () => {
  const VD_MODELS = loadVDModels();
  global.fetch = async () => ({ ok: false, status: 500 });

  const merged = await VD_MODELS.getMergedModels('claude', 'sk-ant-test', STATIC_CLAUDE);
  assert.deepEqual(merged, STATIC_CLAUDE);
});

test('getMergedModels: no api key returns static list without calling fetch', async () => {
  const VD_MODELS = loadVDModels();
  global.fetch = async () => { throw new Error('fetch should not be called without a key'); };

  const merged = await VD_MODELS.getMergedModels('claude', '', STATIC_CLAUDE);
  assert.deepEqual(merged, STATIC_CLAUDE);
});

test('resolveModel: stale saved model falls back to the provider default', () => {
  const VD_MODELS = loadVDModels();
  const merged = STATIC_CLAUDE.filter(m => m.id !== 'claude-opus-4-6'); // simulate a retired id
  const resolved = VD_MODELS.resolveModel('claude-opus-4-6', merged, 'claude-sonnet-5');
  assert.equal(resolved.fellBack, true);
  assert.equal(resolved.id, 'claude-sonnet-5');
});

test('resolveModel: a saved model still present in the list is kept as-is', () => {
  const VD_MODELS = loadVDModels();
  const resolved = VD_MODELS.resolveModel('claude-haiku-4-5-20251001', STATIC_CLAUDE, 'claude-sonnet-5');
  assert.equal(resolved.fellBack, false);
  assert.equal(resolved.id, 'claude-haiku-4-5-20251001');
});

test('checkNudge: shown when the provider default ranks newer than the saved model', () => {
  const VD_MODELS = loadVDModels();
  // STATIC_CLAUDE order: fable, opus, sonnet(default), haiku — sonnet ranks
  // ahead of haiku, so a user still on haiku should be nudged toward sonnet.
  const nudge = VD_MODELS.checkNudge('claude-haiku-4-5-20251001', STATIC_CLAUDE, 'claude-sonnet-5');
  assert.equal(nudge.shouldNudge, true);
  assert.equal(nudge.newer.id, 'claude-sonnet-5');
});

test('checkNudge: hidden when the saved model already is the default', () => {
  const VD_MODELS = loadVDModels();
  const nudge = VD_MODELS.checkNudge('claude-sonnet-5', STATIC_CLAUDE, 'claude-sonnet-5');
  assert.equal(nudge.shouldNudge, false);
});

test('checkNudge: hidden when the saved model ranks newer than (or equal to) the default', () => {
  const VD_MODELS = loadVDModels();
  // Fable ranks ahead of sonnet in STATIC_CLAUDE order — no nudge to "downgrade".
  const nudge = VD_MODELS.checkNudge('claude-fable-5', STATIC_CLAUDE, 'claude-sonnet-5');
  assert.equal(nudge.shouldNudge, false);
});

test('fetchLiveModels: OpenAI list is filtered to chat models and sorted newest first', async () => {
  const VD_MODELS = loadVDModels();
  global.fetch = async (url) => {
    assert.match(url, /^https:\/\/api\.openai\.com\/v1\/models$/);
    return {
      ok: true,
      json: async () => ({
        data: [
          { id: 'text-embedding-3-large', created: 2000 },
          { id: 'gpt-5.6-luna', created: 3000 },
          { id: 'whisper-1', created: 1000 },
          { id: 'gpt-5.6-sol', created: 4000 },
          { id: 'dall-e-3', created: 2500 },
        ],
      }),
    };
  };
  const live = await VD_MODELS.fetchLiveModels('openai', 'sk-test');
  assert.deepEqual(live.map(m => m.id), ['gpt-5.6-sol', 'gpt-5.6-luna']);
});

test('fetchLiveModels: Gemini list is filtered to generateContent-capable models', async () => {
  const VD_MODELS = loadVDModels();
  global.fetch = async (url) => {
    assert.match(url, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\?key=/);
    return {
      ok: true,
      json: async () => ({
        models: [
          { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
          { name: 'models/gemini-3.7-flash', displayName: 'Gemini 3.7 Flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/imagen-4', supportedGenerationMethods: ['predict'] },
        ],
      }),
    };
  };
  const live = await VD_MODELS.fetchLiveModels('gemini', 'AIza-test');
  assert.deepEqual(live, [{ id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' }]);
});

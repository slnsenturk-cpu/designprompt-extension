// VibeDesign — sleep/wake integration test.
//
// The hardest case for token refresh: the laptop was closed across the token's
// expiry, so on wake the stored token is ALREADY expired and everything starts
// at once — the overdue alarm fires in the service worker while the side panel
// simultaneously wakes up and issues a Supabase query.
//
// Before the fix both would refresh the same single-use token and the loser
// got "Invalid Refresh Token: Already Used", which gotrue-js answers by
// wiping the session — a silent sign-out on every wake.
//
// This test runs the REAL background.js, lib/auth.js and lib/cloud-sync.js in
// two separate sandboxes (worker + panel) that share one chrome.storage.local,
// with the panel's sendMessage wired to the worker's real onMessage listener.
//
// Run with:  node --test tests/auth-sleep-wake.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const EXT_ID = 'test-extension-id';

function expiredSession(refreshToken) {
  return {
    access_token: 'jwt-' + refreshToken,
    refresh_token: refreshToken,
    // Expired 5 minutes ago — the laptop slept through it.
    expires_at: Math.floor((Date.now() - 5 * 60 * 1000) / 1000),
    token_type: 'bearer',
    user: { id: 'user-abc', email: 'owner@example.com' },
  };
}

// One storage area, shared by both contexts, exactly like the real extension.
function makeSharedStorage(initial) {
  const store = { ...initial };
  return {
    store,
    area: {
      get: async k => {
        if (Array.isArray(k)) return Object.fromEntries(k.map(x => [x, store[x]]));
        if (typeof k === 'string') return { [k]: store[k] };
        return { ...store };
      },
      set: async o => { Object.assign(store, o); },
      remove: async keys => { [].concat(keys).forEach(k => delete store[k]); },
    },
  };
}

// Builds both sandboxes and wires the panel's sendMessage to the worker's
// real onMessage listener from background.js.
function buildWorld({ session } = {}) {
  const { store, area } = makeSharedStorage(session ? { auth_session: session } : {});

  const refreshPosts = [];       // one entry per outbound refresh POST
  const inserts = [];            // Supabase rows the panel tried to write
  const alarmsCreated = [];
  let resolveGate;
  const gate = new Promise(r => { resolveGate = r; });

  const recordingFetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    refreshPosts.push({ url, refresh_token: body.refresh_token });
    // Hold the response so the worker's refresh is genuinely still in flight
    // when the panel's request arrives — that overlap IS the bug.
    await gate;
    return {
      ok: true,
      json: async () => ({
        access_token: 'jwt-rotated',
        refresh_token: 'rt-rotated',
        expires_in: 3600,
        token_type: 'bearer',
      }),
    };
  };

  const baseChrome = () => ({
    storage: { local: area, onChanged: { addListener() {} } },
    runtime: { id: EXT_ID, getManifest: () => ({ version: '3.0.0' }) },
  });

  // ── service worker context: note there is NO `document` here ──────────────
  let swOnMessage = null;
  const sw = {
    console: { log() {}, warn() {}, error() {} },
    Date, JSON, Object, Math, Promise, Error, String, Array,
    setTimeout, clearTimeout,
    fetch: recordingFetch,
    importScripts() {},            // we load config/auth explicitly below
  };
  sw.chrome = Object.assign(baseChrome(), {
    sidePanel: { setPanelBehavior: () => ({ catch() {} }) },
    alarms: {
      create: (name, info) => { alarmsCreated.push({ name, ...info }); },
      get: (name, cb) => cb(undefined),
      onAlarm: { addListener() {} },
    },
  });
  sw.chrome.runtime.onInstalled = { addListener() {} };
  sw.chrome.runtime.onStartup = { addListener() {} };
  sw.chrome.runtime.onMessageExternal = { addListener() {} };
  sw.chrome.runtime.onMessage = { addListener: fn => { swOnMessage = fn; } };
  sw.self = sw;
  sw.globalThis = sw;
  vm.createContext(sw);
  vm.runInContext(read('lib/config.js'), sw, { filename: 'lib/config.js' });
  vm.runInContext(read('lib/auth.js'), sw, { filename: 'lib/auth.js' });
  vm.runInContext(read('background.js'), sw, { filename: 'background.js' });

  // ── side panel context: `document` exists, so auth.js must delegate ───────
  const panel = {
    console: { log() {}, warn() {}, error() {} },
    Date, JSON, Object, Math, Promise, Error, String, Array,
    setTimeout, clearTimeout,
    document: { getElementById: () => null, addEventListener() {} },
    fetch: async () => { throw new Error('the panel must never refresh directly'); },
  };
  panel.chrome = baseChrome();
  panel.chrome.runtime.lastError = undefined;
  // The real message hop: panel -> worker's registered listener.
  panel.chrome.runtime.sendMessage = (msg, cb) => {
    const sendResponse = resp => { if (cb) setTimeout(() => cb(resp), 0); };
    if (!swOnMessage) { sendResponse(undefined); return; }
    swOnMessage(msg, { id: EXT_ID }, sendResponse);
  };
  // Minimal Supabase stand-in that records writes.
  const chain = tableName => {
    const c = {
      insert(payload) { inserts.push({ table: tableName, payload }); return c; },
      select() { return c; }, delete() { return c; }, eq() { return c; },
      order() { return c; }, limit() { return c; },
      single: async () => ({ data: { id: 'row-1' }, error: null }),
      then(res) { return Promise.resolve({ data: [], error: null }).then(res); },
    };
    return c;
  };
  panel.VD_SUPABASE = { initSupabase: () => ({ from: chain, auth: {} }) };
  panel.self = panel;
  panel.globalThis = panel;
  vm.createContext(panel);
  vm.runInContext(read('lib/config.js'), panel, { filename: 'lib/config.js' });
  vm.runInContext(read('lib/auth.js'), panel, { filename: 'lib/auth.js' });
  vm.runInContext(read('lib/cloud-sync.js'), panel, { filename: 'lib/cloud-sync.js' });

  return {
    sw, panel, store, refreshPosts, inserts, alarmsCreated,
    openGate: resolveGate,
    get swOnMessage() { return swOnMessage; },
  };
}

// ── the scenario ───────────────────────────────────────────────────────────

test('sleep/wake: expired token, worker and panel start together — ONE refresh, still signed in', async () => {
  const w = buildWorld({ session: expiredSession('rt-original') });

  // Both wake at the same instant: the overdue alarm fires in the worker while
  // the panel issues a from() query.
  const workerAlarm = w.sw.VD_AUTH.refreshTokenIfNeeded();
  const panelQuery = w.panel.VD_CLOUD.syncAnalysis({
    url: 'https://example.com/pricing',
    hostname: 'example.com',
    tokens_json: { colors: ['#000'] },
  });

  // Let both reach their network/message boundary, then release the response.
  await new Promise(r => setTimeout(r, 10));
  w.openGate();
  const [alarmResult, queryResult] = await Promise.all([workerAlarm, panelQuery]);

  // THE assertion: the single-use refresh token was spent exactly once.
  assert.equal(w.refreshPosts.length, 1,
    `expected exactly 1 refresh POST, got ${w.refreshPosts.length} — the second would ` +
    'have failed with "Invalid Refresh Token: Already Used"');
  assert.equal(w.refreshPosts[0].refresh_token, 'rt-original');

  // The user stays signed in, on the rotated token.
  assert.ok(w.store.auth_session, 'session must survive the wake');
  assert.equal(w.store.auth_session.refresh_token, 'rt-rotated');
  assert.equal(w.store.auth_session.access_token, 'jwt-rotated');
  assert.equal(w.store.auth_session.user.id, 'user-abc');

  // And the panel's query actually went through, on a fresh token.
  assert.equal(alarmResult.refreshed, true);
  assert.equal(queryResult.ok, true);
  assert.equal(w.inserts.length, 1);
  assert.equal(w.inserts[0].table, 'analyses');
});

test('sleep/wake: the panel never refreshes on its own', async () => {
  // The panel sandbox's fetch throws if called. If ensureFreshToken ever
  // refreshed locally instead of delegating, this would surface as a failure
  // rather than a silent second refresher.
  const w = buildWorld({ session: expiredSession('rt-original') });

  const q = w.panel.VD_CLOUD.syncAnalysis({
    url: 'https://example.com', hostname: 'example.com',
  });
  await new Promise(r => setTimeout(r, 10));
  w.openGate();
  const res = await q;

  assert.equal(res.ok, true);
  // Exactly one POST, and it came from the worker's recording fetch.
  assert.equal(w.refreshPosts.length, 1);
  assert.equal(w.store.auth_session.refresh_token, 'rt-rotated');
});

test('sleep/wake: a burst of panel requests still produces ONE refresh', async () => {
  // The migration loop is the realistic worst case — many cloud calls fired
  // back to back against an expired token.
  const w = buildWorld({ session: expiredSession('rt-original') });

  const queries = [
    w.panel.VD_CLOUD.syncAnalysis({ url: 'https://a.com', hostname: 'a.com' }),
    w.panel.VD_CLOUD.syncAnalysis({ url: 'https://b.com', hostname: 'b.com' }),
    w.panel.VD_CLOUD.fetchRecentAnalyses(20),
    w.panel.VD_CLOUD.syncPrompt({ prompt_text: 'hi', target_platform: 'v0' }, 'a-1'),
  ];
  await new Promise(r => setTimeout(r, 10));
  w.openGate();
  await Promise.all(queries);

  assert.equal(w.refreshPosts.length, 1, 'a burst must coalesce into one refresh');
  assert.ok(w.store.auth_session, 'session survives the burst');
});

// ── observability ──────────────────────────────────────────────────────────

test('the worker records each refresh for the Settings status line', async () => {
  const w = buildWorld({ session: expiredSession('rt-original') });

  const p = w.sw.VD_AUTH.refreshTokenIfNeeded();
  await new Promise(r => setTimeout(r, 10));
  w.openGate();
  await p;

  const rec = w.store.vd_last_refresh;
  assert.ok(rec, 'vd_last_refresh must be written — it drives the Settings line');
  assert.equal(rec.ok, true);
  assert.equal(rec.reason, 'refreshed');
  assert.equal(rec.error, null);
  assert.ok(rec.at <= Date.now() && rec.at > Date.now() - 60000, 'timestamped now');
  assert.ok(rec.expires_at * 1000 > Date.now(), 'carries the new expiry for "next in ~N"');

  // And it is readable through the accessor the UI actually uses.
  const viaApi = await w.sw.VD_AUTH.getRefreshStatus();
  assert.equal(viaApi.reason, 'refreshed');
});

test('a failed refresh is recorded in plain language, session left intact', async () => {
  const w = buildWorld({ session: expiredSession('rt-original') });
  // Override the worker's fetch with a server rejection.
  w.sw.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });

  const res = await w.sw.VD_AUTH.refreshTokenIfNeeded();
  assert.equal(res.refreshed, false);

  const rec = w.store.vd_last_refresh;
  assert.equal(rec.ok, false);
  assert.match(rec.error, /503/);
  // The owner sees the failure; the session is NOT destroyed by it.
  assert.ok(w.store.auth_session, 'a failed refresh must not sign the user out');
  assert.equal(w.store.auth_session.refresh_token, 'rt-original');
});

// ── the worker's own wiring ────────────────────────────────────────────────

test('background.js registers the refresh handler and ignores foreign senders', async () => {
  const w = buildWorld({ session: expiredSession('rt-original') });
  assert.ok(w.swOnMessage, 'background.js must register a runtime.onMessage listener');

  // A message from another extension must be ignored outright.
  let responded = false;
  const handled = w.swOnMessage(
    { type: 'VD_REFRESH_TOKEN' },
    { id: 'some-other-extension' },
    () => { responded = true; },
  );
  assert.notEqual(handled, true, 'foreign senders must not be served');
  assert.equal(responded, false);
  assert.equal(w.refreshPosts.length, 0, 'and must not trigger a refresh');
});

test('background.js creates the refresh alarm on worker startup', () => {
  const w = buildWorld({ session: expiredSession('rt-original') });
  // _ensureRefreshAlarm() runs at top level on every worker wake.
  assert.ok(w.alarmsCreated.length >= 1, 'the alarm must be (re)created on wake');
  const alarm = w.alarmsCreated[0];
  assert.equal(alarm.name, w.sw.VD_CONFIG.REFRESH_ALARM_NAME);
  assert.equal(alarm.periodInMinutes, w.sw.VD_CONFIG.REFRESH_ALARM_PERIOD_MIN);
});

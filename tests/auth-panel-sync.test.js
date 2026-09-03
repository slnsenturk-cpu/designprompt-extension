// VibeDesign — the worker and the panel agree about the same storage.
//
// Background: VD_EXT_STATUS answered signedInAs: <email> while the side panel
// rendered "Sign in" over the same chrome.storage.local. The two surfaces
// had two rules for "signed in" (the worker: access_token + user.email; the
// panel: access_token), and the panel had a third path — the 30-second
// server check in sidepanel.js — that could clear the session on a rejected
// GET and revoke it globally. This file pins the fix:
//
//   1. One read (VD_AUTH.readAccount) used by the worker's status reply and
//      by the panel's header.
//   2. A handoff in the worker, then a panel boot over the SAME storage,
//      renders signed in — with the real lib/auth.js, no VD_AUTH stub.
//   3. An open panel re-renders when the session key changes in storage.
//
//   node --test tests/auth-panel-sync.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
// Values built inside a vm realm have a different Object.prototype; compare shapes.
const plain = v => JSON.parse(JSON.stringify(v));

// One chrome.storage.local shared by the worker and the panel, exactly as in
// Chrome. onChanged listeners fire on every set/remove.
function makeStorage() {
  const data = {};
  const listeners = [];
  const local = {
    get: keys => {
      const list = keys == null ? Object.keys(data) : (Array.isArray(keys) ? keys : (typeof keys === 'string' ? [keys] : Object.keys(keys)));
      const out = {}; list.forEach(k => { if (k in data) out[k] = data[k]; });
      return Promise.resolve(out);
    },
    set: obj => {
      const changes = {};
      Object.keys(obj).forEach(k => { changes[k] = { oldValue: data[k], newValue: obj[k] }; data[k] = obj[k]; });
      listeners.forEach(fn => fn(changes, 'local'));
      return Promise.resolve();
    },
    remove: keys => {
      const changes = {};
      (Array.isArray(keys) ? keys : [keys]).forEach(k => { changes[k] = { oldValue: data[k] }; delete data[k]; });
      listeners.forEach(fn => fn(changes, 'local'));
      return Promise.resolve();
    },
  };
  return { data, local, onChanged: { addListener: fn => listeners.push(fn) } };
}

const VERIFY_OK = () => ({ ok: true, status: 200, json: async () => ({
  access_token: 'jwt-from-handoff', refresh_token: 'rt-from-handoff', expires_in: 3600, token_type: 'bearer',
  user: { id: 'u1', email: 'user@example.com', user_metadata: { avatar_url: 'https://example.com/a.png' } } }) });

// The worker: config + auth + background, over the shared storage.
function loadWorker(storage) {
  const calls = { verify: [], broadcast: [] };
  let external = null;
  const sb = {
    console: { log() {}, warn() {}, error() {}, debug() {} },
    AbortController, Math, JSON, Date, URL, URLSearchParams, RegExp, Object, Array, String, Number, Boolean, Promise, Error, TextEncoder, Uint8Array,
    parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
  };
  sb.self = sb; sb.globalThis = sb;
  sb.fetch = async (url, opts) => {
    if (String(url).includes('/auth/v1/verify')) { calls.verify.push(JSON.parse(opts.body)); return VERIFY_OK(); }
    // The identity is always read from the server after verify.
    if (String(url).includes('/auth/v1/user')) {
      return { ok: true, status: 200, json: async () => ({ id: 'u1', email: 'user@example.com',
        user_metadata: { avatar_url: 'https://example.com/a.png' } }) };
    }
    throw new Error('unexpected fetch ' + url);
  };
  sb.chrome = {
    runtime: { getManifest: () => ({ version: '3.0.2' }), onMessageExternal: { addListener: fn => { external = fn; } },
               onMessage: { addListener() {} }, onInstalled: { addListener() {} }, onStartup: { addListener() {} },
               sendMessage: (m, cb) => { calls.broadcast.push(m); if (cb) cb(); }, lastError: null },
    storage: { local: storage.local, onChanged: storage.onChanged },
    alarms: { create() {}, clear() {}, onAlarm: { addListener() {} } },
    action: { setBadgeText() {}, setBadgeBackgroundColor() {} }, identity: {},
    sidePanel: { setPanelBehavior: () => Promise.resolve() },
    tabs: { onUpdated: { addListener() {} }, query: () => Promise.resolve([]) },
  };
  const ctx = vm.createContext(sb);
  ['lib/config.js', 'lib/auth.js'].forEach(f => vm.runInContext(read(f), ctx, { filename: f }));
  vm.runInContext(read('background.js').replace(/importScripts\([^)]*\);/, '/* imported above */'), ctx, { filename: 'background.js' });
  const send = message => new Promise(resolve =>
    external(message, { origin: 'https://vibedesign.tech', url: 'https://vibedesign.tech/login' }, resolve));
  return { send, calls, ctx };
}

// The panel: the real lib/auth.js (NOT the VD_AUTH stub the other panel
// tests use) plus everything ui-helpers needs, over the same storage. No
// Supabase SDK: VD_SUPABASE is absent, so the SDK path is out of the picture
// and what remains is exactly the read path under test.
const PANEL_LIBS = [
  'lib/config.js', 'lib/auth.js', 'lib/usage-meter.js', 'lib/cloud-sync.js',
  'lib/color-utils.js', 'lib/noise-filter.js', 'lib/shadow-utils.js',
  'lib/prompt-builder.js', 'lib/ai-caller.js', 'lib/model-discovery.js',
  'lib/download.js', 'lib/data/google-fonts.js', 'lib/design-model.js',
  'lib/token-exporter.js', 'lib/design-md-builder.js', 'lib/zip-lite.js',
  'lib/skill-builder.js', 'lib/ui-components.js', 'lib/ui-helpers.js',
];

async function bootPanel(t, storage) {
  const dom = new JSDOM('<!doctype html><html><body data-context="sidepanel"><div class="app"></div></body></html>',
    { pretendToBeVisual: true, url: 'chrome-extension://ext/sidepanel.html' });
  const win = dom.window; win.self = win;
  const logs = [];
  win.console = { warn: (...a) => logs.push(a.join(' ')), log() {}, error: (...a) => logs.push(a.join(' ')), debug() {} };
  win.fetch = () => Promise.reject(new Error('offline in tests'));
  win.chrome = {
    runtime: { getManifest: () => ({ version: '3.0.2' }), onMessage: { addListener() {} },
               sendMessage: (m, cb) => { if (cb) cb({ ok: true }); }, getURL: p => p, lastError: null, id: 'ext' },
    storage: { local: storage.local, onChanged: storage.onChanged },
    tabs: { query: () => Promise.resolve([{ id: 1, url: 'https://rig.ai/' }]), get: () => Promise.resolve({ id: 1, url: 'https://rig.ai/' }),
            sendMessage: () => Promise.resolve({ success: false }), onActivated: { addListener() {} }, onUpdated: { addListener() {} } },
    scripting: { executeScript: () => Promise.resolve([]) }, sidePanel: { open: () => Promise.resolve() },
    alarms: { create() {}, clear() {}, onAlarm: { addListener() {} } }, identity: {},
  };
  const ctx = vm.createContext(win);
  PANEL_LIBS.forEach(f => vm.runInContext(read(f), ctx, { filename: f }));
  await vm.runInContext('initUI({surface:"sidepanel"})', ctx);
  if (t) t.after(() => { try { win.close(); } catch (e) { /* gone */ } });
  const header = () => (win.document.querySelector('.vd-header__account') || { textContent: '' }).textContent.trim();
  return { win, ctx, logs, header, run: code => vm.runInContext(code, ctx),
           settle: () => new Promise(r => setTimeout(r, 30)) };
}

// ── 1. one read ───────────────────────────────────────────────────────────

test('readAccount is the one rule, and the worker and the panel both use it', () => {
  const bg = read('background.js'), ui = read('lib/ui-helpers.js');
  assert.match(bg, /VD_AUTH\.readAccount\(\)/, 'the worker must answer status through readAccount');
  assert.match(ui, /auth\.readAccount\(\)/, 'the panel must read the account through readAccount');
  // Neither may keep a private definition of "signed in" alongside it.
  assert.ok(!/sess\.user && sess\.user\.email/.test(bg), 'background.js still has its own signed-in rule');
  assert.ok(!/authed: !!\(session && session\.access_token\)/.test(ui), 'ui-helpers.js still has its own signed-in rule');
});

test('readAccount: both tokens, unexpired, with an email — or not signed in, with the reason', async () => {
  const storage = makeStorage();
  const w = loadWorker(storage);
  const acct = () => w.ctx.VD_AUTH.readAccount();
  assert.deepEqual(plain(await acct()), { authed: false, email: null, avatarUrl: null, expiresAt: null, reason: 'no-session' });
  const now = Math.floor(Date.now() / 1000);
  await storage.local.set({ auth_session: { access_token: 'a', refresh_token: 'r', expires_at: now + 3600, user: { email: 'user@example.com' } } });
  assert.equal((await acct()).authed, true);
  await storage.local.set({ auth_session: { access_token: 'a', refresh_token: 'r', expires_at: now - 10, user: { email: 'user@example.com' } } });
  assert.deepEqual([(await acct()).authed, (await acct()).reason], [false, 'expired']);
  await storage.local.set({ auth_session: { access_token: 'a', refresh_token: 'r', expires_at: now + 3600, user: { id: 'u' } } });
  assert.deepEqual([(await acct()).authed, (await acct()).reason], [false, 'no-email']);
});

// ── 2. handoff, then panel boot ───────────────────────────────────────────

test('handoff in the worker, then a panel boot over the same storage, renders signed in', async t => {
  const storage = makeStorage();
  const w = loadWorker(storage);
  const reply = await w.send({ type: 'VD_EXT_LOGIN', tokenHash: 'h'.repeat(40) });
  assert.equal(reply.ok, true);
  assert.equal(reply.signedInAs, 'user@example.com');
  // What the worker says now…
  const status = await w.send({ type: 'VD_EXT_STATUS' });
  assert.equal(status.signedInAs, 'user@example.com');

  // …is what the panel says after a fresh boot over the very same storage.
  const p = await bootPanel(t, storage);
  assert.equal(p.run('state.account.authed'), true);
  assert.equal(p.run('state.account.email'), 'user@example.com');
  assert.equal(p.run('state.account.avatarUrl'), 'https://example.com/a.png');
  // Signed in, the header shows the avatar (an <img>, no text) — never "Sign in".
  const slot = p.win.document.querySelector('.vd-header__account');
  assert.ok(slot && slot.querySelector('img, .vd-avatar, .vd-header__avatar'), 'no avatar in the header');
  assert.ok(!/sign in/i.test(p.header()), `header renders "${p.header()}"`);
  // And Settings names the account.
  p.run('setTab("settings")');
  assert.ok(p.win.document.body.textContent.includes('user@example.com'));

  // The two reads agree byte for byte.
  const fromWorker = await w.ctx.VD_AUTH.readAccount();
  const fromPanel = await p.run('VD_AUTH.readAccount()');
  assert.deepEqual(JSON.parse(JSON.stringify(fromPanel)), JSON.parse(JSON.stringify(fromWorker)));
});

// ── 3. the open panel follows the session ─────────────────────────────────

test('an open, signed-out panel renders signed in when a handoff writes the session — via storage, not a message', async t => {
  const storage = makeStorage();
  const p = await bootPanel(t, storage);
  assert.equal(p.run('state.account.authed'), false);
  assert.match(p.header(), /sign in/i);

  // The worker lands a handoff. No runtime message reaches this panel (its
  // onMessage is a stub) — storage.onChanged alone must carry it.
  const w = loadWorker(storage);
  await w.send({ type: 'VD_EXT_LOGIN', tokenHash: 'h'.repeat(40) });
  await p.settle();
  assert.equal(p.run('state.account.authed'), true, 'panel did not follow the storage change');
  assert.ok(!/sign in/i.test(p.header()));

  // And out again when the session is cleared.
  await w.send({ type: 'VD_EXT_LOGOUT' });
  await p.settle();
  assert.equal(p.run('state.account.authed'), false);
  assert.match(p.header(), /sign in/i);
});

// ── 4. the server check may clear locally, never revoke globally ──────────

test('sidepanel.js: a rejected server check clears the local session only and logs the reply', () => {
  const src = read('sidepanel.js');
  const start = src.indexOf('async function _vdCheckServerAuth');
  assert.ok(start >= 0, 'no _vdCheckServerAuth in sidepanel.js');
  const check = src.slice(start, src.indexOf('\n}\n', start) + 3);
  assert.ok(!/auth\.signOut\(/.test(check), 'the server check must not call signOut() — that revokes globally');
  assert.match(check, /_clearStoredSession/);
  assert.match(check, /\[vd-auth\] server check: GET \/auth\/v1\/user/);
});

test('dumpAuthStorage: every auth key, tokens redacted, with the account verdict', async () => {
  const storage = makeStorage();
  const w = loadWorker(storage);
  await w.send({ type: 'VD_EXT_LOGIN', tokenHash: 'h'.repeat(40) });
  const dump = await w.ctx.VD_AUTH.dumpAuthStorage();
  assert.deepEqual(Object.keys(dump.keys).sort(), ['auth_session', 'vd_last_refresh']);
  assert.equal(dump.keys.auth_session._storedAs, 'object');
  assert.match(dump.keys.auth_session.value.access_token, /^jwt-fr…\[\d+ chars\]$/);
  assert.match(dump.keys.auth_session.value.refresh_token, /…\[\d+ chars\]$/);
  assert.equal(dump.keys.auth_session.value.user.email, 'user@example.com');
  assert.equal(dump.account.authed, true);
  assert.equal(dump.storageKey, 'auth_session');
  assert.ok(!JSON.stringify(dump).includes('rt-from-handoff'), 'a raw token leaked into the dump');
});

// ── dev builds sign in directly ───────────────────────────────────────────

// A worker context with chrome.identity and a recording SDK, so openAuthFlow
// can be driven end to end: which URL it opens, and that the callback's
// tokens reach setSession.
function loadWorkerWithIdentity(storage) {
  const w = loadWorker(storage);
  const calls = { authUrls: [], setSession: [] };
  w.ctx.chrome.identity = {
    getRedirectURL: () => 'https://abcdefgh.chromiumapp.org/',
    launchWebAuthFlow: (o, cb) => { calls.authUrls.push(o.url);
      cb('https://abcdefgh.chromiumapp.org/#access_token=at-1&refresh_token=rt-1&expires_in=3600'); },
  };
  w.ctx.VD_SUPABASE = { initSupabase: () => ({ auth: { setSession: async s => { calls.setSession.push(s); return { data: {}, error: null }; } } }) };
  return Object.assign(w, { authCalls: calls });
}

test('openAuthFlow: the site bridge by default, Supabase\'s own OAuth endpoint when direct', async () => {
  const w = loadWorkerWithIdentity(makeStorage());
  const bridged = await w.ctx.VD_AUTH.openAuthFlow('login');
  assert.equal(bridged.ok, true, JSON.stringify(bridged));
  assert.equal(bridged.via, 'site-bridge');
  assert.match(w.authCalls.authUrls[0], /^https:\/\/vibedesign\.tech\/auth\/login\?src=extension&redirect_uri=https%3A%2F%2Fabcdefgh\.chromiumapp\.org%2F$/);

  const direct = await w.ctx.VD_AUTH.openAuthFlow('login', { direct: true });
  assert.equal(direct.ok, true);
  assert.equal(direct.via, 'supabase-direct');
  const url = new URL(w.authCalls.authUrls[1]);
  assert.equal(url.origin, w.ctx.VD_CONFIG.SUPABASE_URL);
  assert.equal(url.pathname, '/auth/v1/authorize');
  assert.equal(url.searchParams.get('provider'), 'google');
  assert.equal(url.searchParams.get('redirect_to'), 'https://abcdefgh.chromiumapp.org/');
  assert.ok(!w.authCalls.authUrls[1].includes('vibedesign.tech'), 'the direct flow must not touch the site');
  // Both flows hand the callback tokens to the SDK.
  assert.deepEqual(plain(w.authCalls.setSession), [
    { access_token: 'at-1', refresh_token: 'rt-1' }, { access_token: 'at-1', refresh_token: 'rt-1' }]);
});

test('preflightDirectAuth: a 4xx reports the server\'s exact body; a redirect means the URL works', async () => {
  const w = loadWorkerWithIdentity(makeStorage());
  const seen = [];
  // Our project's real answer, verbatim (curl, 2026-09-03).
  w.ctx.fetch = async (url, opts) => { seen.push({ url: String(url), redirect: opts && opts.redirect });
    return { type: 'basic', status: 400, text: async () => '{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: missing OAuth secret"}' }; };
  const bad = await w.ctx.VD_AUTH.preflightDirectAuth('google');
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'http-400');
  assert.match(bad.body, /missing OAuth secret/);
  assert.equal(seen[0].redirect, 'manual', 'the preflight must not follow the redirect');
  assert.match(seen[0].url, /\/auth\/v1\/authorize\?provider=google&redirect_to=https%3A%2F%2Fabcdefgh\.chromiumapp\.org%2F$/);

  // Once a Google OAuth client is configured, the server redirects.
  w.ctx.fetch = async () => ({ type: 'opaqueredirect', status: 0, text: async () => '' });
  const good = await w.ctx.VD_AUTH.preflightDirectAuth('google');
  assert.equal(good.ok, true);
  w.ctx.fetch = async () => { throw new Error('offline'); };
  const off = await w.ctx.VD_AUTH.preflightDirectAuth('google');
  assert.deepEqual([off.ok, off.reason], [false, 'network']);
});

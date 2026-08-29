// VibeDesign — token-refresh regression suite.
//
// Guards the fix for "AuthApiError: Invalid Refresh Token: Already Used".
//
// Supabase refresh tokens are single-use: presenting a spent one returns that
// error, and gotrue-js reacts by calling _removeSession() — a spurious
// sign-out. The rule that prevents it: the service worker is the ONLY
// component that mints tokens, and it never has two refreshes in flight.
//
// Run with:  node --test tests/auth-refresh.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const AUTH_PATH = path.join(__dirname, '..', 'lib', 'auth.js');
const CONFIG_PATH = path.join(__dirname, '..', 'lib', 'config.js');

const HOUR = 3600 * 1000;

// Builds a session that expires `msFromNow` from now.
function sessionExpiringIn(msFromNow, refreshToken) {
  return {
    access_token: 'jwt-' + refreshToken,
    refresh_token: refreshToken,
    expires_at: Math.floor((Date.now() + msFromNow) / 1000),
    token_type: 'bearer',
    user: { id: 'user-abc' },
  };
}

// Loads the real lib/config.js + lib/auth.js into a sandbox with stubbed
// chrome.storage.local and a recording fetch.
function loadAuth({ session, respond } = {}) {
  const store = {};
  if (session) store.auth_session = session;

  const calls = [];   // one entry per outbound refresh POST
  let resolveGate = null;
  const gate = new Promise(r => { resolveGate = r; });

  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    Date, JSON, Object, Math, Promise, Error, String, URL, URLSearchParams,
    chrome: {
      storage: {
        local: {
          get: async k => {
            if (Array.isArray(k)) return Object.fromEntries(k.map(x => [x, store[x]]));
            if (typeof k === 'string') return { [k]: store[k] };
            return { ...store };
          },
          set: async o => { Object.assign(store, o); },
          remove: async keys => { [].concat(keys).forEach(k => delete store[k]); },
        },
      },
    },
    fetch: async (url, opts) => {
      const body = JSON.parse(opts.body);
      calls.push({ url, refresh_token: body.refresh_token });
      // Hold every response until the test opens the gate, so concurrent
      // callers are genuinely overlapping rather than accidentally serialized.
      await gate;
      return respond
        ? respond(body, calls.length)
        : {
            ok: true,
            json: async () => ({
              access_token: 'jwt-new', refresh_token: 'rt-new',
              expires_in: 3600, token_type: 'bearer',
            }),
          };
    },
  };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(CONFIG_PATH, 'utf8'), sandbox, { filename: 'lib/config.js' });
  vm.runInContext(fs.readFileSync(AUTH_PATH, 'utf8'), sandbox, { filename: 'lib/auth.js' });

  return { VD_AUTH: sandbox.VD_AUTH, VD_CONFIG: sandbox.VD_CONFIG, calls, store, openGate: resolveGate };
}

// ── the core guard ─────────────────────────────────────────────────────────

test('refreshTokenIfNeeded: concurrent callers make exactly ONE network refresh', async () => {
  // This is the regression. The alarm and the sidepanel's nudge can land at
  // the same moment; without single-flight both would POST the same
  // refresh token and the loser would get "Already Used".
  const { VD_AUTH, calls, openGate } = loadAuth({
    session: sessionExpiringIn(60 * 1000, 'rt-1'),  // inside the 10-min leeway
  });

  const inFlight = [
    VD_AUTH.refreshTokenIfNeeded(),
    VD_AUTH.refreshTokenIfNeeded(),
    VD_AUTH.refreshTokenIfNeeded(),
  ];
  openGate();
  const results = await Promise.all(inFlight);

  assert.equal(calls.length, 1, 'exactly one refresh POST may leave the device');
  assert.equal(calls[0].refresh_token, 'rt-1');
  // All three callers observe the same successful outcome.
  results.forEach(r => assert.equal(r.refreshed, true));
});

test('refreshTokenIfNeeded: the guard clears, so a later refresh still works', async () => {
  const { VD_AUTH, calls, store, openGate } = loadAuth({
    session: sessionExpiringIn(60 * 1000, 'rt-1'),
  });
  openGate();

  const first = await VD_AUTH.refreshTokenIfNeeded();
  assert.equal(first.refreshed, true);
  assert.equal(calls.length, 1);

  // Storage now holds the rotated token...
  assert.equal(store.auth_session.refresh_token, 'rt-new');
  // ...and it is far from expiry, so a second call is a no-op rather than a
  // second POST.
  const second = await VD_AUTH.refreshTokenIfNeeded();
  assert.equal(second.refreshed, false);
  assert.equal(second.reason, 'still-fresh');
  assert.equal(calls.length, 1);
});

test('refreshTokenIfNeeded: a token outside the leeway is never refreshed', async () => {
  const { VD_AUTH, calls, openGate } = loadAuth({
    session: sessionExpiringIn(HOUR, 'rt-1'),  // 60 min out, leeway is 10 min
  });
  openGate();

  const res = await VD_AUTH.refreshTokenIfNeeded();
  assert.equal(res.refreshed, false);
  assert.equal(res.reason, 'still-fresh');
  assert.equal(calls.length, 0, 'no network call for a fresh token');
});

test('refreshTokenIfNeeded: writes the rotated token back to storage', async () => {
  const { VD_AUTH, store, openGate } = loadAuth({
    session: sessionExpiringIn(60 * 1000, 'rt-1'),
  });
  openGate();

  await VD_AUTH.refreshTokenIfNeeded();
  const saved = store.auth_session;
  assert.equal(saved.access_token, 'jwt-new');
  assert.equal(saved.refresh_token, 'rt-new');
  assert.ok(saved.expires_at * 1000 > Date.now() + 50 * 60 * 1000, 'expiry moved out ~1h');
  // The user object survives a refresh that omits it.
  assert.equal(saved.user.id, 'user-abc');
});

// ── failure handling: never destroy a session we can't prove is dead ────────

test('refreshTokenIfNeeded: "Already Used" does NOT clear the stored session', async () => {
  const { VD_AUTH, store, openGate } = loadAuth({
    session: sessionExpiringIn(60 * 1000, 'rt-1'),
    respond: () => ({
      ok: false, status: 400,
      json: async () => ({ error: 'invalid_grant', error_description: 'Invalid Refresh Token: Already Used' }),
    }),
  });
  openGate();

  const res = await VD_AUTH.refreshTokenIfNeeded();
  assert.equal(res.refreshed, false);
  // The session must survive — gotrue-js wipes it on this error, and that
  // silent sign-out is exactly what we're protecting the user from.
  assert.ok(store.auth_session, 'session must not be cleared');
  assert.equal(store.auth_session.refresh_token, 'rt-1');
});

test('refreshTokenIfNeeded: reports "superseded" when another refresh already won', async () => {
  const ctx = loadAuth({
    session: sessionExpiringIn(60 * 1000, 'rt-1'),
    respond: () => {
      // Simulate the other writer landing first: storage has moved on by the
      // time our own (now stale) request comes back rejected.
      ctx.store.auth_session = sessionExpiringIn(HOUR, 'rt-2');
      return { ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }) };
    },
  });
  ctx.openGate();

  const res = await ctx.VD_AUTH.refreshTokenIfNeeded();
  assert.equal(res.refreshed, false);
  assert.equal(res.reason, 'superseded');
  assert.equal(ctx.store.auth_session.refresh_token, 'rt-2', 'the winner\'s token stands');
});

test('refreshTokenIfNeeded: no session is a clean no-op', async () => {
  const { VD_AUTH, calls, openGate } = loadAuth();
  openGate();
  const res = await VD_AUTH.refreshTokenIfNeeded();
  assert.equal(res.refreshed, false);
  assert.equal(res.reason, 'no-session');
  assert.equal(calls.length, 0);
});

// ── config invariant ───────────────────────────────────────────────────────

test('config: the refresh alarm fires at least once inside the leeway window', () => {
  const { VD_CONFIG } = loadAuth();
  const periodMs = VD_CONFIG.REFRESH_ALARM_PERIOD_MIN * 60 * 1000;
  // If the alarm period exceeds the leeway, the alarm can step straight over
  // the refresh window and the token lapses. This was the old 50min vs 10min
  // bug, which left the token stale and let the SDK try to refresh it instead.
  assert.ok(
    periodMs <= VD_CONFIG.REFRESH_LEEWAY_MS,
    `alarm period (${VD_CONFIG.REFRESH_ALARM_PERIOD_MIN}min) must be <= leeway (${VD_CONFIG.REFRESH_LEEWAY_MS / 60000}min)`,
  );
});

// ── the sidepanel must not be able to mint tokens ──────────────────────────

test('sidepanel.js: never calls a refresh-capable SDK method', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'sidepanel.js'), 'utf8');

  // A bare getUser()/getSession() routes through gotrue-js __loadSession(),
  // which refreshes when the token is within 90s of expiry — regardless of
  // autoRefreshToken:false. Only the explicit-JWT form is allowed here.
  assert.equal(/\.auth\.getUser\(\s*\)/.test(src), false,
    'sidepanel must not call getUser() with no argument — it can mint a token');
  assert.equal(/\.auth\.getSession\(/.test(src), false,
    'sidepanel must not call getSession() — it can mint a token');
  assert.equal(/\.auth\.refreshSession\(/.test(src), false,
    'sidepanel must never refresh directly');
  // It must instead go through ensureFreshToken(), which delegates the actual
  // refresh to the service worker.
  assert.ok(/ensureFreshToken\(\)/.test(src),
    'sidepanel must top the token up via VD_AUTH.ensureFreshToken() before using the SDK');
});

test('cloud-sync.js: every Supabase entry point is gated on a fresh token', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'cloud-sync.js'), 'utf8');

  // Each of these hands a token to the SDK, and the SDK refreshes on its own
  // inside 90s of expiry. Every one must top up first or the panel becomes a
  // second refresher again.
  const ENTRY_POINTS = [
    'syncAnalysis', 'syncPrompt', 'fetchRecentAnalyses',
    'fetchPromptsForAnalysis', 'deleteAnalysis', 'migrateAnonymousHistory',
  ];
  for (const fn of ENTRY_POINTS) {
    const start = src.indexOf('async function ' + fn + '(');
    assert.notEqual(start, -1, `${fn} not found in cloud-sync.js`);
    // The gate must come before the first Supabase call in the function body.
    const body = src.slice(start, start + 2000);
    const gateAt = body.indexOf('_ensureFresh()');
    const callAt = body.search(/_currentUserId\(\)|\.from\(|\.rpc\(/);
    assert.notEqual(gateAt, -1, `${fn} must await _ensureFresh() before using the SDK`);
    assert.ok(gateAt < callAt || callAt === -1,
      `${fn} calls Supabase before awaiting _ensureFresh()`);
  }
});

test('auth.js: ensureFreshToken delegates the refresh to the worker', () => {
  const src = fs.readFileSync(AUTH_PATH, 'utf8');
  assert.ok(/VD_REFRESH_TOKEN/.test(src),
    'ensureFreshToken must ask the worker rather than refreshing in the panel');
  assert.ok(/REFRESH_MSG_TIMEOUT_MS/.test(src),
    'the worker handoff must be bounded by a timeout');
});

test('supabase-client.js: autoRefreshToken stays disabled', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'supabase-client.js'), 'utf8');
  assert.ok(/autoRefreshToken:\s*false/.test(src),
    'the SDK background refresh timer must stay off — the SW owns refreshing');
});

// ── PROMPT 3e: a token the server will never accept ────────────────────────
//
// The live failure this covers: Settings read "Session: refresh failed 4 hours
// ago · Server rejected the refresh (HTTP 400)" and kept saying it. The worker
// was re-sending the same dead refresh token every alarm, for hours, because
// the failure branch deliberately never cleared the session.
//
// That "never clear" rule exists for a real reason — see the "Already Used"
// test above — but it was applied to every 4xx, including the ones no retry
// can fix.

test('a refresh token the server does not recognise is cleared, not retried', async () => {
  const { VD_AUTH, store, calls, openGate } = loadAuth({
    session: sessionExpiringIn(60 * 1000, 'rt-revoked'),
    respond: () => ({
      ok: false, status: 400,
      json: async () => ({ error: 'invalid_grant',
                           error_description: 'Invalid Refresh Token: Refresh Token Not Found' }),
    }),
  });
  openGate();

  const res = await VD_AUTH.refreshTokenIfNeeded();
  assert.equal(res.reason, 'expired');
  assert.equal(store.auth_session, undefined, 'the dead session was left in storage');

  const status = await VD_AUTH.getRefreshStatus();
  assert.equal(status.ok, false);
  assert.equal(status.reason, 'expired');
  assert.equal(status.error, 'Session expired — sign in again');

  // And the next alarm must not put the same token back on the wire.
  const before = calls.length;
  const again = await VD_AUTH.refreshTokenIfNeeded();
  assert.equal(again.reason, 'no-session');
  assert.equal(calls.length, before, 'the worker re-sent a token it knows is dead');
});

test('a 401 is definitive on the first attempt', async () => {
  const { VD_AUTH, store, openGate } = loadAuth({
    session: sessionExpiringIn(60 * 1000, 'rt-401'),
    respond: () => ({ ok: false, status: 401, json: async () => ({ msg: 'Unauthorized' }) }),
  });
  openGate();
  const res = await VD_AUTH.refreshTokenIfNeeded();
  assert.equal(res.reason, 'expired');
  assert.equal(store.auth_session, undefined);
});

test('"Already Used" twice on the SAME token ends the retry loop', async () => {
  // First refusal: a refresher may have won the race and be a moment from
  // writing its token, so the session is kept. Second refusal of the identical
  // token: nobody is coming.
  const { VD_AUTH, store, calls, openGate } = loadAuth({
    session: sessionExpiringIn(60 * 1000, 'rt-1'),
    respond: () => ({
      ok: false, status: 400,
      json: async () => ({ error: 'invalid_grant',
                           error_description: 'Invalid Refresh Token: Already Used' }),
    }),
  });
  openGate();

  const first = await VD_AUTH.refreshTokenIfNeeded();
  assert.equal(first.reason, 'spent');
  assert.ok(store.auth_session, 'the first refusal must not sign the user out');
  assert.equal(store.auth_session.refresh_token, 'rt-1');

  const second = await VD_AUTH.refreshTokenIfNeeded();
  assert.equal(second.reason, 'expired', 'the same dead token was accepted a second time');
  assert.equal(store.auth_session, undefined);

  const third = await VD_AUTH.refreshTokenIfNeeded();
  assert.equal(third.reason, 'no-session');
  assert.equal(calls.length, 2, 'the loop did not stop');
});

test('a strike belongs to one token and is not inherited by the next', async () => {
  // The two-strike rule must count strikes against a SPECIFIC token. If the
  // session is replaced between attempts — a won race, a fresh sign-in — the
  // new token starts clean. Carrying the strike over would sign the user out
  // on the first hiccup after signing back in, which is the worst possible
  // moment for it.
  const ctx = loadAuth({
    session: sessionExpiringIn(60 * 1000, 'rt-1'),
    respond: () => ({
      ok: false, status: 400,
      json: async () => ({ error: 'invalid_grant',
                           error_description: 'Invalid Refresh Token: Already Used' }),
    }),
  });
  ctx.openGate();

  const first = await ctx.VD_AUTH.refreshTokenIfNeeded();
  assert.equal(first.reason, 'spent');
  const markOne = (await ctx.VD_AUTH.getRefreshStatus()).rejectedMark;
  assert.ok(markOne, 'the refused token was not marked');

  // A different token is now in storage.
  ctx.store.auth_session = sessionExpiringIn(60 * 1000, 'rt-2');

  const second = await ctx.VD_AUTH.refreshTokenIfNeeded();
  assert.equal(second.reason, 'spent', 'a fresh token inherited the old one\'s strike');
  assert.ok(ctx.store.auth_session, 'the session was cleared on a new token\'s first refusal');
  assert.equal(ctx.store.auth_session.refresh_token, 'rt-2');
  assert.notEqual((await ctx.VD_AUTH.getRefreshStatus()).rejectedMark, markOne,
    'the mark still refers to the previous token');
});

test('a transient failure keeps the session and keeps trying', async () => {
  let status = 503;
  const { VD_AUTH, store, openGate } = loadAuth({
    session: sessionExpiringIn(60 * 1000, 'rt-1'),
    respond: () => ({ ok: false, status, json: async () => ({ msg: 'upstream' }) }),
  });
  openGate();

  const res = await VD_AUTH.refreshTokenIfNeeded();
  assert.equal(res.reason, 'http-503');
  assert.ok(store.auth_session, 'a 503 must not sign anyone out');

  status = 429;
  const again = await VD_AUTH.refreshTokenIfNeeded();
  assert.equal(again.reason, 'http-429');
  assert.ok(store.auth_session);
});

test('the rejection classifier reads the server, not the status alone', () => {
  const { VD_AUTH } = loadAuth({});
  const c = VD_AUTH._classifyRejection;
  assert.equal(c(400, { error_description: 'Invalid Refresh Token: Already Used' }), 'spent');
  assert.equal(c(400, { error_description: 'Refresh Token Not Found' }), 'dead');
  assert.equal(c(400, { error: 'invalid_grant' }), 'dead');
  assert.equal(c(401, {}), 'dead');
  assert.equal(c(400, null), 'dead');
  assert.equal(c(429, { msg: 'slow down' }), 'transient');
  assert.equal(c(500, {}), 'transient');
  assert.equal(c(502, null), 'transient');
});

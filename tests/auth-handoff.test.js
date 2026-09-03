// VibeDesign — vibedesign.tech ↔ extension sign-in handoff.
//
// The site and the extension hold SEPARATE Supabase sessions. They are linked
// by a one-time hash, never by a shared refresh token: those are single-use,
// and two holders of the same one spend each other's — the failure the 0.6
// work exists to prevent.
//
// What matters here, in order:
//   1. Only https://vibedesign.tech may send these messages. A message that
//      mints a session from any other origin is a full account takeover.
//   2. The hash is exchanged for the extension's OWN session.
//   3. Sign-out clears locally; the extension's own sign-out revokes globally
//      so the site's session ends too.
//
// Run with:  node --test tests/auth-handoff.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

// The version the worker reports comes from the real manifest. Hard-coding it
// here meant a version bump left the test asserting a number nothing else
// used, so it kept passing while saying something untrue.
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).version;

// Replies are built inside the vm, so their prototypes come from that realm
// and deepStrictEqual rejects them as "not reference-equal" however identical
// the values are. Round-tripping through JSON compares what was actually sent.
const plain = v => JSON.parse(JSON.stringify(v));

// Boots the real background worker with the real lib/auth.js behind it.
function loadWorker({ session, verify, logout, user, storageSetThrows } = {}) {
  const store = {};
  if (session) store.auth_session = session;

  const calls = { verify: [], logout: [], user: [], badge: [], broadcast: [] };
  const logs = [];   // every console line the worker writes, with its level
  let externalListener = null;

  // A Supabase SDK the worker must never touch. Any property access on
  // VD_SUPABASE or the `supabase` global is recorded, and `sdkCalls` is
  // asserted empty after every handoff.
  const sdkCalls = [];
  const sdkTrap = name => new Proxy({}, { get: (_, prop) => { sdkCalls.push(name + '.' + String(prop)); return () => { throw new Error('SDK used from the worker: ' + name + '.' + String(prop)); }; } });

  const sandbox = {
    console: { log: (...a) => logs.push(['log', a.join(' ')]), warn: (...a) => logs.push(['warn', a.join(' ')]),
               error: (...a) => logs.push(['error', a.join(' ')]), debug() {} },
    VD_SUPABASE: sdkTrap('VD_SUPABASE'), supabase: sdkTrap('supabase'), sdkCalls,
    AbortController, navigator: { locks: sdkTrap('navigator.locks') },
    Math, JSON, Date, URL, RegExp, Object, Array, String, Number, Boolean,
    Promise, Error, TextEncoder, Uint8Array, Buffer,
    parseInt, parseFloat, isNaN, isFinite, encodeURIComponent,
    setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout,
    setInterval: () => 0, clearInterval: () => {},
  };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  sandbox.fetch = async (url, opts) => {
    const body = opts && opts.body ? JSON.parse(opts.body) : null;
    if (String(url).includes('/auth/v1/verify')) {
      calls.verify.push({ url: String(url), body, headers: (opts || {}).headers });
      return verify ? verify(body) : { ok: false, status: 401, json: async () => ({}) };
    }
    if (String(url).includes('/auth/v1/user')) {
      calls.user.push({ url: String(url), headers: (opts || {}).headers, signal: (opts || {}).signal });
      return user ? user() : { ok: true, status: 200, json: async () => ({ id: 'user-1', email: 'user@example.com' }) };
    }
    if (String(url).includes('/auth/v1/logout')) {
      calls.logout.push({ url: String(url), headers: (opts || {}).headers });
      return logout ? logout() : { ok: true, json: async () => ({}) };
    }
    throw new Error('unexpected fetch: ' + url);
  };

  sandbox.chrome = {
    runtime: {
      getManifest: () => ({ version: VERSION }),
      onMessageExternal: { addListener: fn => { externalListener = fn; sandbox.chrome.runtime.onMessageExternal._listener = fn; } },
      onMessage: { addListener() {} },
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} },
      sendMessage: (msg, cb) => { calls.broadcast.push(msg); if (cb) cb(); },
      lastError: null,
    },
    storage: {
      local: {
        get: keys => {
          if (keys === null || keys === undefined) return Promise.resolve({ ...store });
          const list = Array.isArray(keys) ? keys : [keys];
          const out = {};
          list.forEach(k => { if (k in store) out[k] = store[k]; });
          return Promise.resolve(out);
        },
        set: obj => {
          if (storageSetThrows) return Promise.reject(new Error(storageSetThrows));
          Object.assign(store, obj); return Promise.resolve();
        },
        remove: keys => {
          (Array.isArray(keys) ? keys : [keys]).forEach(k => { delete store[k]; });
          return Promise.resolve();
        },
      },
      onChanged: { addListener() {} },
    },
    alarms: { create() {}, clear() {}, onAlarm: { addListener() {} } },
    action: {
      setBadgeText: o => calls.badge.push(o.text),
      setBadgeBackgroundColor() {},
    },
    identity: {},
    sidePanel: { setPanelBehavior: () => Promise.resolve() },
    tabs: { onUpdated: { addListener() {} }, query: () => Promise.resolve([]) },
  };

  const ctx = vm.createContext(sandbox);
  ['lib/config.js', 'lib/auth.js'].forEach(f =>
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
  // background.js starts with importScripts, which the worker sandbox lacks;
  // the two files above are exactly what it imports.
  const bg = fs.readFileSync(path.join(ROOT, 'background.js'), 'utf8')
    .replace(/importScripts\([^)]*\);/, '/* imported above */');
  vm.runInContext(bg, ctx, { filename: 'background.js' });

  assert.ok(externalListener, 'background.js registered no external listener');

  // Sends a message the way Chrome does and resolves with the reply.
  const send = (message, origin) => new Promise(resolve => {
    const sender = origin === undefined
      ? { origin: 'https://vibedesign.tech', url: 'https://vibedesign.tech/login' }
      : { origin, url: origin + '/login' };
    externalListener(message, sender, resolve);
  });

  return { send, store, calls, ctx, logs, sdkCalls };
}

// A GoTrue that only accepts one of the two verify types, answering the
// other exactly the way v2.196 answers an unknown type.
const pickyVerify = (accepted, email = 'user@example.com') => body => body.type === accepted
  ? okVerify(email)()
  : { ok: false, status: 400,
      json: async () => ({ code: 400, error_code: 'validation_failed', msg: 'Invalid email verification type' }) };

const okVerify = (email = 'user@example.com') => () => ({
  ok: true, status: 200,
  json: async () => ({
    access_token: 'jwt-from-handoff',
    refresh_token: 'rt-from-handoff',
    expires_in: 3600,
    token_type: 'bearer',
    user: { id: 'user-1', email },
  }),
});

// ── the origin gate ───────────────────────────────────────────────────────

test('only https://vibedesign.tech may send these messages', async () => {
  const hostile = [
    'https://vibedesign.tech.evil.com',   // the prefix trick a startsWith check falls for
    'https://evil.com',
    'http://vibedesign.tech',             // no TLS
    'https://staging.vibedesign.tech',    // a subdomain is still not the apex
    'null',
  ];

  for (const origin of hostile) {
    const w = loadWorker({ verify: okVerify() });
    const reply = await w.send({ type: 'VD_EXT_LOGIN', tokenHash: 'x'.repeat(40) }, origin);
    assert.equal(reply.ok, false, `${origin} was allowed to sign the extension in`);
    assert.equal(reply.error, 'origin-not-allowed');
    assert.equal(w.calls.verify.length, 0, `${origin} reached the auth server`);
    assert.equal(w.store.auth_session, undefined, `${origin} created a session`);
  }
});

test('a hostile origin cannot read who is signed in, or sign them out', async () => {
  const w = loadWorker({ session: { access_token: 'a', refresh_token: 'r',
                                    expires_at: 9e9, user: { email: 'user@example.com' } } });

  const status = await w.send({ type: 'VD_EXT_STATUS' }, 'https://evil.com');
  assert.equal(status.ok, false);
  assert.ok(!('signedInAs' in status), 'the signed-in address leaked to another origin');

  const out = await w.send({ type: 'VD_EXT_LOGOUT' }, 'https://evil.com');
  assert.equal(out.ok, false);
  assert.ok(w.store.auth_session, 'another origin signed the user out');
});

test('the origin is parsed, not prefix-matched', async () => {
  // The listener this replaced used sender.url.startsWith(), which
  // "https://vibedesign.tech.evil.com/" satisfies.
  const src = fs.readFileSync(path.join(ROOT, 'background.js'), 'utf8');
  assert.ok(!/sender\.url\.startsWith/.test(src),
    'the external listener is prefix-matching the sender URL again');
  assert.match(src, /VD_TRUSTED_ORIGIN\s*=\s*'https:\/\/vibedesign\.tech'/);
});

// ── VD_EXT_LOGIN ──────────────────────────────────────────────────────────

test('VD_EXT_LOGIN exchanges the hash for the extension\'s own session', async () => {
  const w = loadWorker({ verify: okVerify('user@example.com') });
  const reply = await w.send({ type: 'VD_EXT_LOGIN', tokenHash: 'h'.repeat(48),
                               email: 'user@example.com' });

  assert.deepEqual(plain(reply), { ok: true, signedInAs: 'user@example.com', type: 'magiclink' });

  // One exchange, at the verify endpoint, carrying the hash and the type.
  assert.equal(w.calls.verify.length, 1);
  assert.match(w.calls.verify[0].url, /\/auth\/v1\/verify$/);
  assert.equal(w.calls.verify[0].body.token_hash, 'h'.repeat(48));
  assert.equal(w.calls.verify[0].body.type, 'magiclink');

  // The session it stored is its OWN — a refresh token minted for it, not one
  // handed over by the site.
  const sess = w.store.auth_session;
  assert.ok(sess, 'no session was stored');
  assert.equal(sess.access_token, 'jwt-from-handoff');
  assert.equal(sess.refresh_token, 'rt-from-handoff');
  assert.equal(sess.user.email, 'user@example.com');
  assert.ok(sess.expires_at > Math.floor(Date.now() / 1000), 'the session is already expired');
});

test('the reply reports the session\'s identity, not the message\'s claim', async () => {
  // `email` in the message is advisory. If the site says one address and the
  // token resolves to another, the token wins — it is the only part the auth
  // server vouched for.
  const w = loadWorker({ verify: okVerify('real@example.com'),
    user: () => ({ ok: true, status: 200, json: async () => ({ id: 'u1', email: 'real@example.com' }) }) });
  const reply = await w.send({ type: 'VD_EXT_LOGIN', tokenHash: 'h'.repeat(40),
                               email: 'claimed@example.com' });
  assert.equal(reply.signedInAs, 'real@example.com');
  assert.equal(w.store.auth_session.user.email, 'real@example.com');
});

test('a rejected hash creates no session and says why', async () => {
  const w = loadWorker({
    verify: () => ({ ok: false, status: 401,
                     json: async () => ({ error_description: 'Token has expired' }) }),
  });
  const reply = await w.send({ type: 'VD_EXT_LOGIN', tokenHash: 'h'.repeat(40) });
  assert.equal(reply.ok, false);
  assert.equal(reply.code, 'verify-401');
  assert.equal(reply.error, 'Token has expired', 'error must be the server\'s exact message');
  assert.equal(reply.message, 'Token has expired');
  assert.equal(w.store.auth_session, undefined, 'a rejected hash still created a session');
});

test('a malformed hash never reaches the auth server', async () => {
  for (const tokenHash of [undefined, null, '', 'short', 42, {}, 'x'.repeat(600)]) {
    const w = loadWorker({ verify: okVerify() });
    const reply = await w.send({ type: 'VD_EXT_LOGIN', tokenHash });
    assert.equal(reply.ok, false, `${JSON.stringify(tokenHash)} was accepted`);
    assert.equal(w.calls.verify.length, 0,
      `${JSON.stringify(tokenHash)} was sent to the auth server`);
  }
});

test('a successful handoff flashes the badge and wakes any open panel', async () => {
  const w = loadWorker({ verify: okVerify() });
  await w.send({ type: 'VD_EXT_LOGIN', tokenHash: 'h'.repeat(40) });
  assert.deepEqual(plain(w.calls.badge), ['✓'], 'the toolbar badge did not confirm the sign-in');
  assert.deepEqual(plain(w.calls.broadcast), [{ type: 'VD_AUTH_CHANGED', signedInAs: 'user@example.com' }]);
});

// ── VD_EXT_LOGOUT ─────────────────────────────────────────────────────────

// ── failures are exact, and logged under [vd-handoff] ─────────────────────

const handoffLogs = w => w.logs.filter(l => l[1].startsWith('[vd-handoff]'));

test('a missing tokenHash fails with the exact message and a [vd-handoff] log line', async () => {
  for (const message of [{ type: 'VD_EXT_LOGIN' }, { type: 'VD_EXT_LOGIN', tokenHash: '' }, { type: 'VD_EXT_LOGIN', tokenHash: null }]) {
    const w = loadWorker({ verify: okVerify() });
    const reply = await w.send(message);
    assert.deepEqual(plain(reply), { ok: false, error: 'tokenHash missing', code: 'bad-token-hash' });
    assert.equal(w.calls.verify.length, 0);
    assert.ok(handoffLogs(w).some(l => l[1].includes('tokenHash missing')), 'not logged under [vd-handoff]');
  }
});

test('a verify error comes back as its exact server message, once, logged', async () => {
  const w = loadWorker({ verify: () => ({ ok: false, status: 403,
    json: async () => ({ code: 403, error_code: 'otp_expired', msg: 'Email link is invalid or has expired' }) }) });
  const reply = await w.send({ type: 'VD_EXT_LOGIN', tokenHash: 'h'.repeat(40) });
  assert.equal(reply.ok, false);
  assert.equal(reply.error, 'Email link is invalid or has expired');
  assert.equal(reply.code, 'verify-403');
  assert.equal(w.calls.verify.length, 1, 'an expired hash must not be retried with another type');
  assert.equal(w.store.auth_session, undefined);
  assert.ok(handoffLogs(w).some(l => l[1].includes('Email link is invalid or has expired')));
});

test('a storage write failure fails the handoff with its exact message and stores nothing', async () => {
  const w = loadWorker({ verify: okVerify(), storageSetThrows: 'QUOTA_BYTES quota exceeded' });
  const reply = await w.send({ type: 'VD_EXT_LOGIN', tokenHash: 'h'.repeat(40) });
  assert.equal(reply.ok, false);
  assert.equal(reply.code, 'storage');
  assert.equal(reply.error, 'could not store the session: QUOTA_BYTES quota exceeded');
  assert.equal(w.calls.badge.length, 0, 'no ✓ for a session that was not stored');
  assert.deepEqual(w.calls.broadcast, []);
  assert.ok(handoffLogs(w).some(l => l[1].includes('QUOTA_BYTES quota exceeded')));
});

test('success never reports signedInAs: null — the identity always comes from GET /auth/v1/user', async () => {
  const noUser = () => ({ ok: true, json: async () => ({ access_token: 'jwt', refresh_token: 'rt', expires_in: 3600 }) });
  const w = loadWorker({ verify: noUser, user: () => ({ ok: true, json: async () => ({ id: 'u1', email: 'looked-up@example.com' }) }) });
  const reply = await w.send({ type: 'VD_EXT_LOGIN', tokenHash: 'h'.repeat(40) });
  assert.equal(reply.ok, true);
  assert.equal(reply.signedInAs, 'looked-up@example.com');
  assert.equal(w.calls.user.length, 1);
  assert.match(w.calls.user[0].headers.Authorization, /^Bearer jwt$/);
  assert.equal(w.calls.user[0].headers.apikey, w.ctx.VD_CONFIG.SUPABASE_ANON_KEY);
  assert.equal(w.store.auth_session.user.email, 'looked-up@example.com');
  // Even when verify carries a user, the server is asked — and wins.
  const w3 = loadWorker({ verify: okVerify('claimed@example.com'), user: () => ({ ok: true, json: async () => ({ id: 'u1', email: 'server@example.com' }) }) });
  const r3 = await w3.send({ type: 'VD_EXT_LOGIN', tokenHash: 'h'.repeat(40) });
  assert.equal(r3.signedInAs, 'server@example.com');
  assert.equal(w3.calls.user.length, 1);

  // And when even that yields no email, it is a failure — not ok with null.
  const w2 = loadWorker({ verify: noUser, user: () => ({ ok: true, json: async () => ({ id: 'u1' }) }) });
  const r2 = await w2.send({ type: 'VD_EXT_LOGIN', tokenHash: 'h'.repeat(40) });
  assert.equal(r2.ok, false);
  assert.equal(r2.code, 'no-identity');
  assert.equal(r2.error, 'session has no identity: the auth server returned no user email');
  assert.equal(w2.store.auth_session, undefined, 'an identity-less session must not be stored');
});

// ── verify type: magiclink vs email ───────────────────────────────────────

test('the server accepting magiclink: one call, type magiclink', async () => {
  const w = loadWorker({ verify: pickyVerify('magiclink') });
  const reply = await w.send({ type: 'VD_EXT_LOGIN', tokenHash: 'h'.repeat(40) });
  assert.equal(reply.ok, true);
  assert.equal(reply.type, 'magiclink');
  assert.deepEqual(w.calls.verify.map(c => c.body.type), ['magiclink']);
});

test('the server accepting only email: magiclink is refused with "Invalid email verification type", email is tried next', async () => {
  const w = loadWorker({ verify: pickyVerify('email') });
  const reply = await w.send({ type: 'VD_EXT_LOGIN', tokenHash: 'h'.repeat(40) });
  assert.equal(reply.ok, true, JSON.stringify(reply));
  assert.equal(reply.type, 'email');
  assert.equal(reply.signedInAs, 'user@example.com');
  assert.deepEqual(w.calls.verify.map(c => c.body.type), ['magiclink', 'email']);
  assert.ok(handoffLogs(w).some(l => /type magiclink not accepted/.test(l[1])));
});

test('a server accepting neither type fails with the exact message after both were tried', async () => {
  const w = loadWorker({ verify: pickyVerify('signup') });
  const reply = await w.send({ type: 'VD_EXT_LOGIN', tokenHash: 'h'.repeat(40) });
  assert.equal(reply.ok, false);
  assert.equal(reply.error, 'Invalid email verification type');
  assert.equal(reply.code, 'verify-400');
  assert.deepEqual(w.calls.verify.map(c => c.body.type), ['magiclink', 'email']);
});

test('VD_EXT_LOGOUT clears the local session', async () => {
  const w = loadWorker({ session: { access_token: 'a', refresh_token: 'r',
                                    expires_at: 9e9, user: { email: 'user@example.com' } } });
  const reply = await w.send({ type: 'VD_EXT_LOGOUT' });
  assert.deepEqual(plain(reply), { ok: true });
  assert.equal(w.store.auth_session, undefined, 'the session survived a logout');
  assert.deepEqual(plain(w.calls.broadcast), [{ type: 'VD_AUTH_CHANGED', signedInAs: null }]);
});

test('VD_EXT_LOGOUT does not reach back into the site\'s session', async () => {
  // The site is ending its OWN session and telling us. Revoking globally from
  // here would be the extension signing the user out of a browser that just
  // reported what it did.
  const w = loadWorker({ session: { access_token: 'a', refresh_token: 'r', expires_at: 9e9 } });
  await w.send({ type: 'VD_EXT_LOGOUT' });
  assert.equal(w.calls.logout.length, 0, 'the logout was propagated back to the server');
});

test('logging out when nobody is signed in is not an error', async () => {
  const w = loadWorker();
  assert.deepEqual(plain(await w.send({ type: 'VD_EXT_LOGOUT' })), { ok: true });
});

// ── VD_EXT_STATUS ─────────────────────────────────────────────────────────

test('VD_EXT_STATUS reports the version and who is signed in', async () => {
  const out = loadWorker();
  assert.deepEqual(plain(await out.send({ type: 'VD_EXT_STATUS' })),
    { installed: true, version: VERSION, signedInAs: null });

  const inn = loadWorker({ session: { access_token: 'a', refresh_token: 'r',
                                      expires_at: 9e9, user: { email: 'user@example.com' } } });
  assert.deepEqual(plain(await inn.send({ type: 'VD_EXT_STATUS' })),
    { installed: true, version: VERSION, signedInAs: 'user@example.com' });
});

test('the original ping still answers', async () => {
  // The site has been using this to detect the extension; the new messages
  // must not break it.
  const w = loadWorker();
  assert.deepEqual(plain(await w.send({ ping: true })), { pong: true, version: VERSION });
});

test('an unknown message type is refused, not ignored', async () => {
  const w = loadWorker();
  assert.deepEqual(plain(await w.send({ type: 'VD_EXT_NONSENSE' })), { ok: false, error: 'unknown-type' });
  assert.deepEqual(plain(await w.send(null)), { ok: false, error: 'bad-message' });
});

// ── the extension's own sign-out ──────────────────────────────────────────

test('signing out from the extension revokes globally, ending the site session', async () => {
  const w = loadWorker({ session: { access_token: 'access-abc', refresh_token: 'r',
                                    expires_at: 9e9, user: { email: 'user@example.com' } } });
  await w.ctx.VD_AUTH.signOut();

  assert.equal(w.calls.logout.length, 1, 'no revocation was sent');
  assert.match(w.calls.logout[0].url, /\/auth\/v1\/logout\?scope=global$/);
  assert.equal(w.calls.logout[0].headers.Authorization, 'Bearer access-abc',
    'the revocation was not authorised with the session being revoked');
  assert.equal(w.store.auth_session, undefined);
});

test('a failed revocation still clears the session locally', async () => {
  // Otherwise a network blip leaves someone signed in on a machine they just
  // signed out of, which is the worse of the two failures.
  const w = loadWorker({
    session: { access_token: 'a', refresh_token: 'r', expires_at: 9e9 },
    logout: () => { throw new Error('offline'); },
  });
  await w.ctx.VD_AUTH.signOut();
  assert.equal(w.store.auth_session, undefined, 'a failed revocation left the session behind');
});

test('the two sessions never share a refresh token', async () => {
  // The handoff carries a one-time hash. If a refresh_token ever appears in
  // the message contract, single-use rotation makes the two clients spend each
  // other's — the "Already Used" failure in tests/auth-refresh.test.js.
  const src = fs.readFileSync(path.join(ROOT, 'background.js'), 'utf8');
  const contract = src.slice(src.indexOf('_vdHandleExternal'), src.indexOf('function _vdBroadcast'));
  assert.ok(!/refresh_token|refreshToken/.test(contract),
    'the message contract mentions a refresh token');
  assert.match(contract, /tokenHash/, 'the contract no longer uses a one-time hash');
});

// ── the reply always arrives, and the worker never uses the SDK ───────────

test('the worker verifies with raw fetch and never touches the Supabase SDK or navigator.locks', async () => {
  const w = loadWorker({ verify: okVerify() });
  const reply = await w.send({ type: 'VD_EXT_LOGIN', tokenHash: 'h'.repeat(40) });
  assert.equal(reply.ok, true);
  assert.deepEqual(w.sdkCalls, [], 'the worker touched the SDK: ' + w.sdkCalls.join(', '));
  // The verify call is the raw shape: apikey header, JSON body with token_hash and type.
  assert.equal(w.calls.verify[0].headers.apikey, w.ctx.VD_CONFIG.SUPABASE_ANON_KEY);
  assert.deepEqual(Object.keys(w.calls.verify[0].body).sort(), ['token_hash', 'type']);
  // Every request carries a deadline of its own.
  assert.ok(w.calls.user[0].signal, 'GET /auth/v1/user has no abort signal');
  // And the worker file never imports the SDK.
  const bg = fs.readFileSync(path.join(ROOT, 'background.js'), 'utf8');
  const imports = /importScripts\(([^)]*)\)/.exec(bg)[1];
  assert.ok(!/supabase/i.test(imports), 'background.js imports the SDK: ' + imports);
  // Steps are on record.
  const steps = w.logs.filter(l => l[1].startsWith('[vd-handoff]')).map(l => l[1]);
  ['VD_EXT_LOGIN received', 'exchanging the token hash', 'POST /auth/v1/verify', 'verify → HTTP 200',
   'GET /auth/v1/user', 'user → HTTP 200', 'writing the session', 'VD_EXT_LOGIN ok']
    .forEach(step => assert.ok(steps.some(l => l.includes(step)), `no [vd-handoff] log for "${step}":\n` + steps.join('\n')));
});

test('a verify request that never answers still gets a reply: { ok:false, error:"timeout", code:"timeout" }', async () => {
  const w = loadWorker({ verify: () => new Promise(() => {}) });   // hangs forever
  w.ctx.VD_HANDOFF_TIMEOUT_MS = 60;                                // 15 s in production
  const t0 = Date.now();
  const reply = await w.send({ type: 'VD_EXT_LOGIN', tokenHash: 'h'.repeat(40) });
  assert.deepEqual(plain(reply), { ok: false, error: 'timeout', code: 'timeout' });
  assert.ok(Date.now() - t0 < 2000, 'the reply did not arrive at the deadline');
  assert.equal(w.store.auth_session, undefined, 'a timed-out handoff must store nothing');
  assert.equal(w.calls.badge.length, 0);
  assert.ok(w.logs.some(l => /\[vd-handoff\] VD_EXT_LOGIN timed out after 60 ms/.test(l[1])));
});

test('a user lookup that never answers also times out, and the site gets exactly one reply', async () => {
  const w = loadWorker({ verify: okVerify(), user: () => new Promise(() => {}) });
  w.ctx.VD_HANDOFF_TIMEOUT_MS = 60;
  let replies = 0;
  const reply = await new Promise(resolve => {
    // Send the way Chrome does, counting how often sendResponse is called.
    const sender = { origin: 'https://vibedesign.tech', url: 'https://vibedesign.tech/auth/extension-callback' };
    w.ctx.chrome.runtime.onMessageExternal._listener(
      { type: 'VD_EXT_LOGIN', tokenHash: 'h'.repeat(40) }, sender, r => { replies++; resolve(r); });
  });
  assert.equal(reply.code, 'timeout');
  await new Promise(r => setTimeout(r, 120));
  assert.equal(replies, 1, 'the site was answered more than once');
});

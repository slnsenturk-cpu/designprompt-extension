// VibeDesign — high-level auth module (v2.0.0-beta.1)
// Works in both HTML (sidepanel) and service worker contexts.
//   HTML: uses chrome.identity for OAuth, VD_SUPABASE SDK for setSession
//         and auth-state subscription.
//   Service worker: uses raw fetch for token refresh (no UMD dependency).
//
// Exposes self.VD_AUTH with:
//   openAuthFlow(mode), refreshTokenIfNeeded(), onAuthStateChange(cb),
//   isAuthenticated(), signOut(), getCurrentUser(), peekSession()
//
// Every exported function is wrapped in try/catch; failures log a warning
// and return a safe fallback (false, null, undefined). Never throws into
// caller context — existing UI must not crash if auth breaks.

(function (global) {
  'use strict';

  function _cfg() { return global.VD_CONFIG || null; }
  function _storageKey() {
    var c = _cfg();
    return (c && c.AUTH_STORAGE_KEY) || 'auth_session';
  }
  // Single-flight guard for refreshTokenIfNeeded. The service worker is the
  // ONLY component allowed to mint tokens (see docs/RELEASE-CHECKLIST.md), and
  // it now has two triggers — the periodic alarm and an on-demand nudge from
  // the sidepanel. Supabase refresh tokens are single-use, so two overlapping
  // refreshes would make the loser fail with "Invalid Refresh Token: Already
  // Used". Callers that arrive while a refresh is in flight join it instead.
  var _refreshInFlight = null;

  // ensureFreshToken()'s own single-flight. A burst of cloud-sync calls (the
  // migration loop is the worst case) must produce ONE handoff to the worker,
  // not one per call.
  var _ensureInFlight = null;

  // Below this much remaining life we will not hand the token to the SDK: the
  // SDK refreshes on its own inside 90s, and only the worker may do that.
  var FRESH_MARGIN_MS = 5 * 60 * 1000;
  // How long to wait on the worker before giving up and using what's stored.
  var REFRESH_MSG_TIMEOUT_MS = 10 * 1000;
  // Where the worker records each refresh attempt, for the settings UI.
  var LAST_REFRESH_KEY = 'vd_last_refresh';

  function _hasIdentity() {
    return typeof chrome !== 'undefined' && chrome.identity && typeof chrome.identity.launchWebAuthFlow === 'function';
  }

  // Fast storage peek — no UMD required. Handles both the plain storageKey
  // and Supabase v2's wrapped form if a future release changes layout.
  async function _peekSession() {
    try {
      var key = _storageKey();
      var wrapped = 'sb-' + key + '-auth-token';
      var store = await chrome.storage.local.get([key, wrapped]);
      var candidates = [store[key], store[wrapped]];
      for (var i = 0; i < candidates.length; i++) {
        var raw = candidates[i];
        if (raw == null) continue;
        var parsed = raw;
        if (typeof raw === 'string') {
          try { parsed = JSON.parse(raw); } catch (e) { continue; }
        }
        var sess = (parsed && parsed.currentSession) ? parsed.currentSession : parsed;
        if (sess && sess.access_token && sess.refresh_token) return sess;
      }
      return null;
    } catch (e) {
      console.warn('[vd-auth] peekSession failed', e);
      return null;
    }
  }

  function _sessionValid(sess) {
    if (!sess || !sess.access_token) return false;
    if (!sess.expires_at) return true; // shouldn't happen, but don't block
    return sess.expires_at * 1000 > Date.now();
  }

  async function isAuthenticated() {
    try { return _sessionValid(await _peekSession()); } catch (e) { return false; }
  }

  async function getCurrentUser() {
    try {
      var sess = await _peekSession();
      if (!_sessionValid(sess)) return null;
      return sess.user || null;
    } catch (e) { return null; }
  }

  async function openAuthFlow(mode) {
    try {
      if (!_hasIdentity()) {
        console.warn('[vd-auth] chrome.identity unavailable in this context');
        return { ok: false, error: 'identity-unavailable' };
      }
      if (mode !== 'login' && mode !== 'register') {
        return { ok: false, error: 'invalid-mode' };
      }
      var cfg = _cfg();
      if (!cfg) return { ok: false, error: 'no-config' };

      var redirectUri = chrome.identity.getRedirectURL();
      var authUrl = cfg.WEB_AUTH_BASE + '/auth/' + mode
        + '?src=extension&redirect_uri=' + encodeURIComponent(redirectUri);

      var responseUrl = await new Promise(function (resolve, reject) {
        chrome.identity.launchWebAuthFlow(
          { url: authUrl, interactive: true },
          function (url) {
            if (chrome.runtime.lastError) {
              return reject(new Error(chrome.runtime.lastError.message || 'launchWebAuthFlow failed'));
            }
            if (!url) return reject(new Error('no callback URL'));
            resolve(url);
          }
        );
      });

      var parsed;
      try { parsed = new URL(responseUrl); }
      catch (e) { responseUrl = null; return { ok: false, error: 'invalid-callback' }; }

      var hashStr = (parsed.hash || '').replace(/^#/, '');
      var hashParams = new URLSearchParams(hashStr);
      var queryParams = parsed.searchParams;
      var access_token = hashParams.get('access_token') || queryParams.get('access_token');
      var refresh_token = hashParams.get('refresh_token') || queryParams.get('refresh_token');

      // Scrub tokens from transient strings so they don't linger in memory.
      responseUrl = null;
      parsed = null;

      if (!access_token || !refresh_token) {
        return { ok: false, error: 'tokens-missing' };
      }

      if (!global.VD_SUPABASE) {
        return { ok: false, error: 'sdk-unavailable' };
      }
      var sb = global.VD_SUPABASE.initSupabase();
      if (!sb) return { ok: false, error: 'sdk-init-failed' };

      try {
        await sb.auth.setSession({ access_token: access_token, refresh_token: refresh_token });
      } catch (e) {
        console.warn('[vd-auth] setSession failed', e.message || e);
        access_token = null; refresh_token = null;
        return { ok: false, error: 'set-session-failed' };
      }

      access_token = null;
      refresh_token = null;
      return { ok: true };
    } catch (e) {
      console.warn('[vd-auth] openAuthFlow threw', e && e.message ? e.message : e);
      return { ok: false, error: String((e && e.message) || e) };
    }
  }

  async function signOut() {
    try {
      if (global.VD_SUPABASE) {
        try { await global.VD_SUPABASE.signOut(); } catch (e) { /* fall through to clear */ }
      }
      var all = await chrome.storage.local.get(null);
      var toRemove = [];
      for (var k in all) {
        if (!Object.prototype.hasOwnProperty.call(all, k)) continue;
        if (k.indexOf('auth_') === 0 || k.indexOf('sb-auth_') === 0 || k.indexOf('sb-auth-') === 0) {
          toRemove.push(k);
        }
      }
      if (toRemove.length) await chrome.storage.local.remove(toRemove);
    } catch (e) {
      console.warn('[vd-auth] signOut failed', e);
    }
  }

  function refreshTokenIfNeeded() {
    if (_refreshInFlight) return _refreshInFlight;
    _refreshInFlight = _doRefresh();
    // Clear the slot however it settles, so a failure can't wedge the guard.
    _refreshInFlight.catch(function () {}).then(function () { _refreshInFlight = null; });
    return _refreshInFlight;
  }

  // Records the outcome of a refresh attempt for the Settings status line.
  // Best-effort: a storage failure here must never fail the refresh itself.
  async function _recordRefresh(entry) {
    try {
      var write = {};
      write[LAST_REFRESH_KEY] = entry;
      await chrome.storage.local.set(write);
    } catch (e) {
      console.warn('[vd-auth] could not record refresh status', e);
    }
  }

  // A rejection the server will give again for the same token, however many
  // times it is asked. GoTrue answers a dead refresh token with 400 and an
  // `invalid_grant` error code; 401 means the token is not accepted at all.
  // Everything else (429, 5xx, a proxy error page) is transient.
  // How the server's refusal should be read. Three outcomes:
  //
  //   'transient'  429, 5xx, a proxy error page — retry on the next alarm.
  //   'dead'       the token was never valid, or no longer exists. Nothing can
  //                make it work, and no race explains it.
  //   'spent'      "Already Used". The token WAS valid and something consumed
  //                it. Usually that something is our own other refresher,
  //                whose new token may still be in flight to storage — so this
  //                gets one more alarm cycle before we act on it.
  function _classifyRejection(status, body) {
    if (status === 401) return 'dead';
    if (status !== 400) return 'transient';
    var code = String((body && (body.error_code || body.error)) || '');
    var desc = String((body && (body.error_description || body.msg || body.message)) || '');
    if (/already[_ ]used/i.test(code) || /already used/i.test(desc)) return 'spent';
    if (/refresh_token_not_found|not found|revoked|invalid[_ ]grant/i.test(code + ' ' + desc)) return 'dead';
    if (!body) return 'dead';   // a 400 with no parseable body is not transient
    return 'dead';
  }

  // Kept for the callers and tests that only need the yes/no.
  function _isDefinitiveRejection(status, body) {
    return _classifyRejection(status, body) !== 'transient';
  }

  // A stable, non-reversible marker for "the same token as last time". The
  // token itself is never written anywhere new.
  function _tokenMark(token) {
    var h = 5381;
    var str = String(token || '');
    for (var i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
    return String(h) + ':' + str.length;
  }

  // Removes exactly what signOut() removes, without calling the SDK — this
  // runs in the service worker, where the UMD's window references are absent.
  async function _clearStoredSession() {
    try {
      var all = await chrome.storage.local.get(null);
      var toRemove = [];
      for (var k in all) {
        if (!Object.prototype.hasOwnProperty.call(all, k)) continue;
        if (k.indexOf('auth_') === 0 || k.indexOf('sb-auth_') === 0 || k.indexOf('sb-auth-') === 0) {
          toRemove.push(k);
        }
      }
      if (toRemove.length) await chrome.storage.local.remove(toRemove);
      return toRemove.length;
    } catch (e) {
      console.warn('[vd-auth] could not clear the stored session', e);
      return 0;
    }
  }

  async function _doRefresh() {
    try {
      var cfg = _cfg();
      if (!cfg) return { refreshed: false, reason: 'no-config' };
      var sess = await _peekSession();
      if (!sess || !sess.refresh_token || !sess.expires_at) {
        return { refreshed: false, reason: 'no-session' };
      }

      var leeway = cfg.REFRESH_LEEWAY_MS || (10 * 60 * 1000);
      if (sess.expires_at * 1000 - Date.now() > leeway) {
        return { refreshed: false, reason: 'still-fresh' }; // still fresh enough
      }

      var res = await fetch(cfg.SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: {
          'apikey': cfg.SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + cfg.SUPABASE_ANON_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: sess.refresh_token })
      });
      if (!res.ok) {
        // Two very different things arrive as HTTP 400 invalid_grant, and
        // telling them apart is the whole job here.
        //
        //   (a) WE LOST A RACE. Supabase refresh tokens are single-use, so if
        //       another refresher spent ours first the server rejects it —
        //       but a good new token is already in storage. Clearing here
        //       would sign the user out for succeeding.
        //
        //   (b) THE TOKEN IS DEAD. Revoked by a sign-out elsewhere, expired,
        //       or belonging to a session the server has forgotten. No number
        //       of retries will change that.
        //
        // The re-peek distinguishes them: in (a) the stored token has moved
        // on, in (b) it has not. Only after that check is it safe to act on
        // the error itself.
        var after = await _peekSession();
        if (after && after.refresh_token && after.refresh_token !== sess.refresh_token) {
          await _recordRefresh({ at: Date.now(), ok: true, reason: 'superseded',
            error: null, expires_at: after.expires_at || null });
          return { refreshed: false, reason: 'superseded' };
        }

        var body = null;
        try { body = await res.json(); } catch (e) { body = null; }
        var verdict = _classifyRejection(res.status, body);
        var mark = _tokenMark(sess.refresh_token);

        if (verdict === 'spent') {
          // Our token was consumed and storage has not caught up. That is a
          // lost race, and the winner's token may be milliseconds away — so
          // the first time this happens the session is left alone. What is NOT
          // acceptable is retrying it forever, which is what the previous
          // build did: the alarm re-sent the same spent token every few
          // minutes for hours. If the SAME token is refused a second time, no
          // winner is coming.
          var prev = await getRefreshStatus();
          if (prev && prev.rejectedMark === mark) {
            verdict = 'dead';
          } else {
            await _recordRefresh({ at: Date.now(), ok: false, reason: 'spent',
              error: 'Server rejected the refresh (HTTP ' + res.status + ')',
              expires_at: sess.expires_at || null, rejectedMark: mark });
            return { refreshed: false, reason: 'spent' };
          }
        }

        if (verdict === 'dead') {
          console.warn('[vd-auth] refresh token rejected outright; clearing session');
          await _clearStoredSession();
          await _recordRefresh({ at: Date.now(), ok: false, reason: 'expired',
            error: 'Session expired — sign in again', expires_at: null });
          return { refreshed: false, reason: 'expired' };
        }

        // Anything else — 429, 5xx, a gateway in the way — is worth retrying,
        // and the next alarm will.
        console.warn('[vd-auth] refresh failed', res.status);
        await _recordRefresh({ at: Date.now(), ok: false, reason: 'http-' + res.status,
          error: 'Server rejected the refresh (HTTP ' + res.status + ')',
          expires_at: sess.expires_at || null });
        return { refreshed: false, reason: 'http-' + res.status };
      }
      var data = await res.json();
      if (!data || !data.access_token || !data.refresh_token) {
        console.warn('[vd-auth] refresh returned malformed payload');
        await _recordRefresh({ at: Date.now(), ok: false, reason: 'malformed',
          error: 'Unexpected response from the auth server',
          expires_at: sess.expires_at || null });
        return { refreshed: false, reason: 'malformed' };
      }

      var now = Math.floor(Date.now() / 1000);
      var newSess = Object.assign({}, sess, {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in || 3600,
        expires_at: data.expires_at || (now + (data.expires_in || 3600)),
        token_type: data.token_type || sess.token_type || 'bearer',
        user: data.user || sess.user
      });

      // Detect actual key in storage — Supabase SDK might have wrapped it.
      var key = _storageKey();
      var wrapped = 'sb-' + key + '-auth-token';
      var store = await chrome.storage.local.get([key, wrapped]);
      var actualKey = (store[key] !== undefined) ? key : (store[wrapped] !== undefined ? wrapped : key);
      var existing = store[actualKey];
      var valueToStore = (typeof existing === 'string') ? JSON.stringify(newSess) : newSess;
      var write = {};
      write[actualKey] = valueToStore;
      await chrome.storage.local.set(write);
      await _recordRefresh({ at: Date.now(), ok: true, reason: 'refreshed',
        error: null, expires_at: newSess.expires_at });
      return { refreshed: true, expires_at: newSess.expires_at };
    } catch (e) {
      console.warn('[vd-auth] refreshTokenIfNeeded threw', e && e.message ? e.message : e);
      await _recordRefresh({ at: Date.now(), ok: false, reason: 'threw',
        error: (e && e.message) ? e.message : 'Network or storage error',
        expires_at: null });
      return { refreshed: false, reason: 'threw' };
    }
  }

  // ── ensureFreshToken ─────────────────────────────────────────────────────
  // Call this before handing a token to the Supabase SDK. gotrue-js refreshes
  // on its own once the token is within 90s of expiry, and only the service
  // worker is allowed to refresh — so the panel's job is to make sure the SDK
  // never sees a token that close to the edge.
  //
  // Returns the session to use, or null when signed out. Never throws, and
  // never leaves the caller without whatever is currently stored: if the
  // worker is unreachable or slow, we fall back rather than block the UI.
  function ensureFreshToken() {
    if (_ensureInFlight) return _ensureInFlight;
    _ensureInFlight = _doEnsureFresh();
    _ensureInFlight.catch(function () {}).then(function () { _ensureInFlight = null; });
    return _ensureInFlight;
  }

  // In the worker there is nobody to message — we ARE the refresher.
  function _isServiceWorkerContext() {
    return typeof document === 'undefined';
  }

  async function _doEnsureFresh() {
    var sess = null;
    try {
      sess = await _peekSession();
      if (!sess || !sess.access_token) return null; // signed out

      var ttl = (sess.expires_at ? sess.expires_at * 1000 : Infinity) - Date.now();
      if (ttl >= FRESH_MARGIN_MS) return sess; // comfortably fresh

      if (_isServiceWorkerContext()) {
        await refreshTokenIfNeeded();
      } else {
        await _requestRefreshFromWorker();
      }
      var after = await _peekSession();
      return after || sess;
    } catch (e) {
      console.warn('[vd-auth] ensureFreshToken failed', e && e.message ? e.message : e);
      try { return sess || await _peekSession(); } catch (_) { return null; }
    }
  }

  // Asks the worker to refresh and waits for its reply. Resolves (never
  // rejects) on timeout or a missing receiver — the periodic alarm is still
  // there, and a stalled worker must not wedge the panel.
  function _requestRefreshFromWorker() {
    return new Promise(function (resolve) {
      var settled = false;
      var timer = null;
      function finish(result) {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        resolve(result);
      }
      timer = setTimeout(function () {
        console.warn('[vd-auth] refresh request to the worker timed out');
        finish({ ok: false, error: 'timeout' });
      }, REFRESH_MSG_TIMEOUT_MS);
      try {
        chrome.runtime.sendMessage({ type: 'VD_REFRESH_TOKEN' }, function (resp) {
          // Reading lastError marks it handled; "no receiving end" is normal
          // when the worker is still booting.
          var err = chrome.runtime.lastError;
          finish(resp || { ok: false, error: (err && err.message) || 'no-response' });
        });
      } catch (e) {
        finish({ ok: false, error: String((e && e.message) || e) });
      }
    });
  }

  // Last refresh attempt, for the Settings status line. null if none yet.
  async function getRefreshStatus() {
    try {
      var stored = await chrome.storage.local.get(LAST_REFRESH_KEY);
      return (stored && stored[LAST_REFRESH_KEY]) || null;
    } catch (e) {
      return null;
    }
  }

  function onAuthStateChange(callback) {
    if (typeof callback !== 'function') return function () {};
    // Primary path: Supabase SDK subscription (HTML context).
    if (global.VD_SUPABASE) {
      try {
        var sb = global.VD_SUPABASE.initSupabase();
        if (sb && sb.auth && typeof sb.auth.onAuthStateChange === 'function') {
          var sub = sb.auth.onAuthStateChange(function (event, session) {
            try { callback(event, session); } catch (e) { console.warn('[vd-auth] subscriber threw', e); }
          });
          return function () {
            try {
              if (sub && sub.data && sub.data.subscription) sub.data.subscription.unsubscribe();
            } catch (e) { /* noop */ }
          };
        }
      } catch (e) {
        console.warn('[vd-auth] SDK subscribe failed, falling back to storage', e);
      }
    }
    // Fallback: watch chrome.storage for session key changes.
    var key = _storageKey();
    var wrapped = 'sb-' + key + '-auth-token';
    var handler = function (changes, areaName) {
      if (areaName !== 'local') return;
      if (changes[key] || changes[wrapped]) {
        try { callback('STORAGE_CHANGED', null); } catch (e) { /* noop */ }
      }
    };
    try {
      chrome.storage.onChanged.addListener(handler);
      return function () { try { chrome.storage.onChanged.removeListener(handler); } catch (e) {} };
    } catch (e) {
      return function () {};
    }
  }

  global.VD_AUTH = {
    openAuthFlow: openAuthFlow,
    refreshTokenIfNeeded: refreshTokenIfNeeded,
    ensureFreshToken: ensureFreshToken,
    getRefreshStatus: getRefreshStatus,
    onAuthStateChange: onAuthStateChange,
    isAuthenticated: isAuthenticated,
    signOut: signOut,
    getCurrentUser: getCurrentUser,
    peekSession: _peekSession,
    _isDefinitiveRejection: _isDefinitiveRejection,
    _classifyRejection: _classifyRejection,
    _clearStoredSession: _clearStoredSession,
    _FRESH_MARGIN_MS: FRESH_MARGIN_MS,
    _LAST_REFRESH_KEY: LAST_REFRESH_KEY
  };
})(typeof self !== 'undefined' ? self : globalThis);

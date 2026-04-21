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

  async function refreshTokenIfNeeded() {
    try {
      var cfg = _cfg();
      if (!cfg) return;
      var sess = await _peekSession();
      if (!sess || !sess.refresh_token || !sess.expires_at) return;

      var leeway = cfg.REFRESH_LEEWAY_MS || (10 * 60 * 1000);
      if (sess.expires_at * 1000 - Date.now() > leeway) return; // still fresh enough

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
        console.warn('[vd-auth] refresh failed', res.status);
        return;
      }
      var data = await res.json();
      if (!data || !data.access_token || !data.refresh_token) {
        console.warn('[vd-auth] refresh returned malformed payload');
        return;
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
    } catch (e) {
      console.warn('[vd-auth] refreshTokenIfNeeded threw', e && e.message ? e.message : e);
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
    onAuthStateChange: onAuthStateChange,
    isAuthenticated: isAuthenticated,
    signOut: signOut,
    getCurrentUser: getCurrentUser,
    peekSession: _peekSession
  };
})(typeof self !== 'undefined' ? self : globalThis);

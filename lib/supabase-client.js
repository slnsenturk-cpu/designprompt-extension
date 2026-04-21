// VibeDesign — Supabase client wrapper (v2.0.0-beta.1)
// HTML-context only (sidepanel). The service worker uses raw fetch for
// token refresh to avoid UMD's window/document/localStorage references.
//
// Exposes self.VD_SUPABASE with:
//   - initSupabase()  lazy singleton; returns Supabase client or null
//   - getSession(), getUser(), signOut()
//   - client (getter)  the initialized client, or null if not yet init'd

(function (global) {
  'use strict';

  var _client = null;

  function _cfg() {
    return (global && global.VD_CONFIG) || null;
  }

  function _umdReady() {
    return typeof global.supabase !== 'undefined' &&
           global.supabase &&
           typeof global.supabase.createClient === 'function';
  }

  function _buildStorageAdapter() {
    return {
      getItem: async function (key) {
        try {
          var r = await chrome.storage.local.get(key);
          return (r && r[key] !== undefined) ? r[key] : null;
        } catch (e) {
          console.warn('[vd-auth] storage.getItem failed', e);
          return null;
        }
      },
      setItem: async function (key, value) {
        try {
          var obj = {};
          obj[key] = value;
          await chrome.storage.local.set(obj);
        } catch (e) {
          console.warn('[vd-auth] storage.setItem failed', e);
        }
      },
      removeItem: async function (key) {
        try {
          await chrome.storage.local.remove(key);
        } catch (e) {
          console.warn('[vd-auth] storage.removeItem failed', e);
        }
      }
    };
  }

  function initSupabase() {
    if (_client) return _client;
    if (!_umdReady()) {
      console.warn('[vd-auth] Supabase UMD not loaded — cannot init client');
      return null;
    }
    var cfg = _cfg();
    if (!cfg) {
      console.warn('[vd-auth] VD_CONFIG not loaded — cannot init client');
      return null;
    }
    try {
      _client = global.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
        auth: {
          storage: _buildStorageAdapter(),
          storageKey: cfg.AUTH_STORAGE_KEY,
          persistSession: true,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          flowType: 'implicit'
        }
      });
      return _client;
    } catch (e) {
      console.error('[vd-auth] Supabase createClient failed', e);
      _client = null;
      return null;
    }
  }

  async function getSession() {
    var c = initSupabase();
    if (!c) return null;
    try {
      var r = await c.auth.getSession();
      return (r && r.data && r.data.session) ? r.data.session : null;
    } catch (e) {
      console.warn('[vd-auth] getSession failed', e);
      return null;
    }
  }

  async function getUser() {
    var c = initSupabase();
    if (!c) return null;
    try {
      var r = await c.auth.getUser();
      return (r && r.data && r.data.user) ? r.data.user : null;
    } catch (e) {
      console.warn('[vd-auth] getUser failed', e);
      return null;
    }
  }

  async function signOut() {
    var c = initSupabase();
    if (!c) return;
    try {
      // Global scope revokes the refresh token on the Supabase server,
      // which invalidates every active session (web + any other extension
      // installs) — not just this browser's local tokens.
      await c.auth.signOut({ scope: 'global' });
    } catch (e) {
      console.warn('[vd-auth] signOut failed', e);
    }
  }

  global.VD_SUPABASE = {
    initSupabase: initSupabase,
    getSession: getSession,
    getUser: getUser,
    signOut: signOut,
    get client() { return _client; }
  };
})(typeof self !== 'undefined' ? self : globalThis);

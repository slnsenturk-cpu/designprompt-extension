// VibeDesign — Side Panel UI (sidepanel-specific overrides)
// Shared code lives in lib/ui-helpers.js

// ── Side panel: track tab switches to keep context current ────────────────
_uiHooks.afterListeners = () => {
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      state.currentUrl = tab?.url || '';
    } catch(e) { console.debug('[VibeDesign] Tab activated info:', e.message); }
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (tab && tab.id === tabId) state.currentUrl = changeInfo.url;
      });
    }
  });
};

// ── v2.0.0-beta.1: auth pill + welcome card wiring ────────────────────────
// Wrap the existing afterListeners hook so tab tracking runs first, then
// auth UI renders. Every path is try/catch-wrapped — a failure here must
// not block the existing sidepanel from rendering.
const _vdPrevAfterListeners = _uiHooks.afterListeners;
let _vdAuthSubscribed = false;
let _vdServerPollTimer = null;
let _vdVisibilityHandlerAttached = false;

// Two-way logout sync: poll Supabase every 30s while the sidepanel is open,
// and re-check whenever the sidepanel regains visibility. If the server
// explicitly reports the session is gone (401 / session_not_found / invalid
// JWT / JWT expired), clear the local session and re-render the pill as
// anonymous. Network errors do NOT trigger logout — offline users stay
// signed in locally until the server explicitly says otherwise.
async function _vdCheckServerAuth() {
  try {
    const auth = self.VD_AUTH;
    if (!auth || typeof auth.peekSession !== 'function') return;
    const sess = await auth.peekSession();
    if (!sess || !sess.access_token) return; // already anonymous locally

    if (!self.VD_SUPABASE || typeof self.VD_SUPABASE.initSupabase !== 'function') return;
    const sb = self.VD_SUPABASE.initSupabase();
    if (!sb || !sb.auth || typeof sb.auth.getUser !== 'function') return;

    let res;
    try {
      res = await sb.auth.getUser();
    } catch (e) {
      // Network / fetch failure — treat as transient, do NOT log out.
      return;
    }
    if (!res) return;
    const user = res.data && res.data.user;
    if (user) return; // server confirms session is valid

    const err = res.error;
    const status = err && err.status;
    const msg = (err && (err.message || err.name)) || '';
    const invalidated =
      status === 401 ||
      status === 403 ||
      /session[_ ]?not[_ ]?found/i.test(msg) ||
      /invalid[_ ]?jwt/i.test(msg) ||
      /jwt[_ ]?expired/i.test(msg) ||
      /user[_ ]?not[_ ]?found/i.test(msg);

    if (!invalidated) return; // no explicit signal — stay signed in

    console.log('[vd-auth] server session invalidated; clearing local auth');
    try {
      if (typeof auth.signOut === 'function') await auth.signOut();
    } catch (_) { /* storage clear happens inside signOut */ }
    try {
      const host = document.getElementById('vd-auth-pill-container');
      if (host && typeof renderAuthPill === 'function') renderAuthPill(host);
    } catch (_) { /* noop */ }
  } catch (e) {
    console.warn('[vd-auth-ui] server auth check failed', e);
  }
}

_uiHooks.afterListeners = async function () {
  try {
    if (typeof _vdPrevAfterListeners === 'function') _vdPrevAfterListeners();
  } catch (e) {
    console.warn('[vd-auth-ui] prev afterListeners threw', e);
  }

  try {
    const pillHost = document.getElementById('vd-auth-pill-container');
    if (pillHost && typeof renderAuthPill === 'function') {
      await renderAuthPill(pillHost);
    }

    if (typeof shouldShowWelcomeCard === 'function' && typeof renderWelcomeCard === 'function') {
      const cardHost = document.getElementById('vd-welcome-card-container');
      if (cardHost && (await shouldShowWelcomeCard())) {
        await renderWelcomeCard(cardHost);
      }
    }

    // Subscribe exactly once — guards against re-entrancy if afterListeners
    // is ever invoked a second time (e.g. via a future re-init path).
    if (!_vdAuthSubscribed && self.VD_AUTH && typeof self.VD_AUTH.onAuthStateChange === 'function') {
      _vdAuthSubscribed = true;
      self.VD_AUTH.onAuthStateChange(() => {
        try {
          const host = document.getElementById('vd-auth-pill-container');
          if (host && typeof renderAuthPill === 'function') renderAuthPill(host);
        } catch (_) { /* noop */ }
      });
    }

    // Kick server auth polling (immediate check, then every 30s) and the
    // one-shot re-check on visibility change.
    if (_vdServerPollTimer == null) {
      _vdCheckServerAuth();
      _vdServerPollTimer = setInterval(_vdCheckServerAuth, 30000);
    }
    if (!_vdVisibilityHandlerAttached) {
      _vdVisibilityHandlerAttached = true;
      document.addEventListener('visibilitychange', () => {
        try {
          if (document.visibilityState === 'visible') _vdCheckServerAuth();
        } catch (_) { /* noop */ }
      });
    }
  } catch (e) {
    console.warn('[vd-auth-ui] afterListeners auth wiring failed', e);
  }
};

// ── Init ──────────────────────────────────────────────────────────────────
initUI();

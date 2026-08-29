// VibeDesign — Side Panel UI (sidepanel-specific overrides)
// Shared code lives in lib/ui-helpers.js

// ── Side panel: pick up an analysis handed over by the popup ──────────────
// The popup opens the panel rather than analysing in place (§3), and leaves a
// short-lived marker behind saying so. Anything older than 10s is stale — the
// panel was opened by hand, not by that click.
async function _vdConsumeAutorun() {
  try {
    const { vd_autorun } = await chrome.storage.local.get('vd_autorun');
    if (!vd_autorun) return;
    await chrome.storage.local.remove('vd_autorun');
    if (Date.now() - (vd_autorun.at || 0) > 10000) return;
    setTimeout(() => handleAnalyze(), 60);
  } catch (e) { console.debug('[VibeDesign] autorun:', e.message); }
}

// ── Side panel: track tab switches to keep context current ────────────────
_uiHooks.afterListeners = () => {
  _vdConsumeAutorun();
  // §3: the header follows the CURRENT tab. Switching tabs or navigating
  // re-renders immediately; the result itself is never discarded, so going
  // back to the analysed page restores the full Overview.
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      state.currentUrl = tab?.url || '';
      renderPanel();
    } catch(e) { console.debug('[VibeDesign] Tab activated info:', e.message); }
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (tab && tab.id === tabId) { state.currentUrl = changeInfo.url; renderPanel(); }
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

// The service worker is the ONLY component allowed to refresh the session.
// Supabase refresh tokens are single-use, so a second refresher racing the SW
// makes the loser fail with "Invalid Refresh Token: Already Used" — and the
// SDK's response to that is _removeSession(), i.e. a spurious sign-out.
//
// gotrue-js refreshes inside __loadSession() whenever the token is within
// EXPIRY_MARGIN (90s) of expiring, and that path is NOT gated by
// autoRefreshToken:false. Any bare getUser()/getSession() can therefore mint a
// token. VD_AUTH.ensureFreshToken() keeps us clear of that window by handing
// the refresh to the worker first; this constant is the floor we refuse to go
// below if that handoff didn't succeed.
const VD_SDK_REFRESH_MARGIN_MS = 90 * 1000;      // gotrue-js EXPIRY_MARGIN

// Two-way logout sync: poll Supabase every 30s while the sidepanel is open,
// and re-check whenever the sidepanel regains visibility. If the server
// explicitly reports the session is gone (401 / session_not_found / invalid
// JWT), clear the local session and re-render the pill as anonymous. Network
// errors do NOT trigger logout — offline users stay signed in locally until
// the server explicitly says otherwise.
async function _vdCheckServerAuth() {
  try {
    const auth = self.VD_AUTH;
    if (!auth || typeof auth.peekSession !== 'function') return;
    // Top the token up via the worker before touching the SDK. After a
    // sleep/wake the stored token is often already expired, and this is what
    // stops the SDK deciding to refresh it for us.
    const sess = typeof auth.ensureFreshToken === 'function'
      ? await auth.ensureFreshToken()
      : await auth.peekSession();
    if (!sess || !sess.access_token) return; // already anonymous locally

    // Still inside the SDK's own refresh window means the worker could not
    // renew it (offline, server down). Make no judgement this tick — a token
    // we failed to refresh is not evidence that the server revoked anything.
    const ttl = (sess.expires_at ? sess.expires_at * 1000 : Infinity) - Date.now();
    if (ttl < VD_SDK_REFRESH_MARGIN_MS) return;

    if (!self.VD_SUPABASE || typeof self.VD_SUPABASE.initSupabase !== 'function') return;
    const sb = self.VD_SUPABASE.initSupabase();
    if (!sb || !sb.auth || typeof sb.auth.getUser !== 'function') return;

    let res;
    try {
      // Passing the JWT explicitly makes getUser() a plain GET /auth/v1/user.
      // The bare getUser() goes through __loadSession() and can refresh; this
      // form cannot. The token is known-unexpired thanks to the ttl gate above.
      res = await sb.auth.getUser(sess.access_token);
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
    // "JWT expired" is deliberately NOT a logout signal any more. We only
    // send tokens with >5 min of life left, so an expiry verdict means clock
    // skew between us and the server — never that the session was revoked.
    const expired = /jwt[_ ]?expired/i.test(msg);
    const invalidated = !expired && (
      status === 401 ||
      status === 403 ||
      /session[_ ]?not[_ ]?found/i.test(msg) ||
      /invalid[_ ]?jwt/i.test(msg) ||
      /user[_ ]?not[_ ]?found/i.test(msg));

    if (!invalidated) return; // no explicit signal — stay signed in

    console.log('[vd-auth] server session invalidated; clearing local auth');
    try {
      if (typeof auth.signOut === 'function') await auth.signOut();
    } catch (_) { /* storage clear happens inside signOut */ }
    try {
      if (typeof refreshAccount === 'function') refreshAccount();
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
    // The account lives in Settings now (§3); there is no pill to mount.
    if (typeof refreshAccount === 'function') await refreshAccount();

    // The welcome card and the standalone usage counter are gone. The cap is
    // presented in the panel itself (§3) and the account lives in Settings, so
    // there is nothing here to mount — only the month-rollover check, whose
    // result refreshAccount() then reads.
    try {
      if (self.VD_USAGE && typeof self.VD_USAGE.resetIfNeeded === 'function') {
        await self.VD_USAGE.resetIfNeeded();
        if (typeof refreshUsage === 'function') await refreshUsage();
        if (typeof renderPanel === 'function') renderPanel();
      }
    } catch (e) { console.warn('[vd-usage-ui] month rollover check failed', e); }

    // Subscribe exactly once — guards against re-entrancy if afterListeners
    // is ever invoked a second time (e.g. via a future re-init path).
    if (!_vdAuthSubscribed && self.VD_AUTH && typeof self.VD_AUTH.onAuthStateChange === 'function') {
      _vdAuthSubscribed = true;
      self.VD_AUTH.onAuthStateChange((event, _session) => {
        try {
          if (typeof refreshAccount === 'function') refreshAccount();
        } catch (_) { /* noop */ }
        // Signing in lifts the cap and signing out reinstates it, and both
        // change what the header shows. refreshAccount() reads the account and
        // the usage together and re-renders, so one call covers all of it.
        // One-shot migration on SIGNED_IN. The function is self-gated by
        // the cloud_migration_completed_at flag in chrome.storage.local,
        // so firing this on every SIGNED_IN is idempotent.
        try {
          if (event === 'SIGNED_IN' && self.VD_CLOUD && typeof self.VD_CLOUD.migrateAnonymousHistory === 'function') {
            self.VD_CLOUD.migrateAnonymousHistory()
              .catch((e) => console.warn('[vd-cloud] migration rejected', e));
          }
        } catch (_) { /* noop */ }
      });
    }

    // Defensive initial-load migration: covers the case where a user
    // signed in before this code shipped — SIGNED_IN won't fire again
    // until they sign out/back in. Migration is flag-gated so this is
    // a cheap no-op after the first run.
    try {
      if (self.VD_AUTH && typeof self.VD_AUTH.isAuthenticated === 'function'
          && self.VD_CLOUD && typeof self.VD_CLOUD.migrateAnonymousHistory === 'function') {
        const alreadyAuthed = await self.VD_AUTH.isAuthenticated();
        if (alreadyAuthed) {
          self.VD_CLOUD.migrateAnonymousHistory()
            .catch((e) => console.warn('[vd-cloud] initial-load migration rejected', e));
        }
      }
    } catch (_) { /* noop */ }

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

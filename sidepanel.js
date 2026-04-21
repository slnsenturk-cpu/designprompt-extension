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
  } catch (e) {
    console.warn('[vd-auth-ui] afterListeners auth wiring failed', e);
  }
};

// ── Init ──────────────────────────────────────────────────────────────────
initUI();

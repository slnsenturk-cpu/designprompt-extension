// DesignPrompt — Side Panel UI (sidepanel-specific overrides)
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

// ── Init ──────────────────────────────────────────────────────────────────
initUI();

// VibeDesign — Popup UI (popup-specific overrides)
// Shared code lives in lib/ui-helpers.js
//
// docs/SIDEPANEL-IA.md §3: the popup is the short form of Overview — header,
// mode, Analyze, and a way into the side panel. No tab bar: the popup is not
// somewhere you navigate, it is somewhere you start.
//
// Starting an analysis here opens the side panel and lets it run there, so the
// result has room to be read.

const _sharedHandleAnalyze = handleAnalyze;
async function handleAnalyze() {
  // Element picking needs the page, not the popup — the popup closes the
  // moment the user clicks the page, taking the picker's callback with it.
  if (state.mode === 'element') return _sharedHandleAnalyze();
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (chrome.sidePanel && tab) {
      await chrome.storage.local.set({ vd_autorun: { tabId: tab.id, at: Date.now() } });
      await chrome.sidePanel.open({ tabId: tab.id });
      window.close();
      return;
    }
  } catch (e) {
    console.warn('[vd-popup] could not hand off to the side panel', e);
  }
  return _sharedHandleAnalyze();
}

initUI({ surface: 'popup' });

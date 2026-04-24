// VibeDesign — Background Service Worker

// Load shared auth config + helpers. Supabase UMD is intentionally NOT
// imported here — the SW refreshes tokens via raw fetch against the
// Supabase REST endpoint (see lib/auth.js#refreshTokenIfNeeded) to avoid
// the UMD's window/document/localStorage references.
try {
  importScripts('lib/config.js', 'lib/auth.js');
} catch (e) {
  console.error('[vd-bg] importScripts failed', e);
}

// Open side panel when extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// Picker results flow through chrome.storage.local (dp_pending) — no relay needed

// --- v2.0.0-beta.1: auth install bookkeeping + periodic token refresh ---

chrome.runtime.onInstalled.addListener(function (details) {
  try {
    if (details && details.reason === 'update'
        && details.previousVersion
        && /^1\./.test(details.previousVersion)) {
      chrome.storage.local.set({ upgradedFromV1: true, upgradeShownAt: null })
        .catch(function (e) { console.warn('[vd-bg] onInstalled storage.set failed', e); });
    }
    if (chrome.alarms && typeof chrome.alarms.create === 'function') {
      var cfg = self.VD_CONFIG || {};
      var name = cfg.REFRESH_ALARM_NAME || 'refresh_token';
      var period = cfg.REFRESH_ALARM_PERIOD_MIN || 50;
      chrome.alarms.create(name, { periodInMinutes: period });
    }
  } catch (e) {
    console.warn('[vd-bg] onInstalled handler threw', e);
  }
});

if (chrome.alarms && chrome.alarms.onAlarm) {
  chrome.alarms.onAlarm.addListener(function (alarm) {
    try {
      var cfg = self.VD_CONFIG || {};
      var name = cfg.REFRESH_ALARM_NAME || 'refresh_token';
      if (!alarm || alarm.name !== name) return;
      if (self.VD_AUTH && typeof self.VD_AUTH.refreshTokenIfNeeded === 'function') {
        // Returning the promise keeps the SW alive until refresh completes.
        return self.VD_AUTH.refreshTokenIfNeeded().catch(function (e) {
          console.warn('[vd-bg] refreshTokenIfNeeded rejected', e);
        });
      }
    } catch (e) {
      console.warn('[vd-bg] onAlarm handler threw', e);
    }
  });
}

// --- v2.0.1: externally_connectable ping/pong for dashboard detection ---
// Responds to messages from pages whitelisted in manifest's
// externally_connectable. Used by vibedesign.tech/dashboard to detect
// whether the extension is installed (chrome.runtime.sendMessage sends
// { ping: true }; we reply with { pong: true, version }). Sender URL
// is validated against the apex domain regardless of what the manifest
// matches allow, so subdomain requests are silently ignored.
if (chrome.runtime && chrome.runtime.onMessageExternal) {
  chrome.runtime.onMessageExternal.addListener(function (message, sender, sendResponse) {
    try {
      if (sender && typeof sender.url === 'string' && sender.url.startsWith('https://vibedesign.tech/')) {
        if (message && message.ping === true) {
          sendResponse({ pong: true, version: chrome.runtime.getManifest().version });
          return true; // keep the message channel open (per spec)
        }
      }
    } catch (e) {
      console.warn('[vd-bg] onMessageExternal handler threw', e);
    }
  });
}

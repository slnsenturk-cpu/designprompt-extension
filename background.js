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

// The refresh alarm must fire at least once inside the leeway window before
// the access token expires, or the token lapses entirely. Recreate it when
// it's missing (fresh SW, cleared alarms) or when its period no longer matches
// config — existing installs still carry the old, too-slow period.
function _ensureRefreshAlarm() {
  try {
    if (!chrome.alarms || typeof chrome.alarms.create !== 'function') return;
    var cfg = self.VD_CONFIG || {};
    var name = cfg.REFRESH_ALARM_NAME || 'refresh_token';
    var period = cfg.REFRESH_ALARM_PERIOD_MIN || 5;
    chrome.alarms.get(name, function (existing) {
      try {
        if (existing && existing.periodInMinutes === period) return;
        chrome.alarms.create(name, { periodInMinutes: period });
      } catch (e) {
        console.warn('[vd-bg] alarm create failed', e);
      }
    });
  } catch (e) {
    console.warn('[vd-bg] _ensureRefreshAlarm threw', e);
  }
}

// Runs on every service-worker wake, not just install — self-healing and
// cheap, since the handler no-ops unless the token is actually near expiry.
_ensureRefreshAlarm();
if (chrome.runtime && chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(_ensureRefreshAlarm);
}

chrome.runtime.onInstalled.addListener(function (details) {
  try {
    if (details && details.reason === 'update'
        && details.previousVersion
        && /^1\./.test(details.previousVersion)) {
      chrome.storage.local.set({ upgradedFromV1: true, upgradeShownAt: null })
        .catch(function (e) { console.warn('[vd-bg] onInstalled storage.set failed', e); });
    }
    _ensureRefreshAlarm();
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

// --- v3.0: on-demand token refresh nudge from the sidepanel ---
// The service worker is the ONLY component that mints tokens. When the
// sidepanel notices the access token is getting close to expiry, it asks here
// instead of refreshing itself — two writers on a single-use refresh token is
// what produced "Invalid Refresh Token: Already Used". refreshTokenIfNeeded is
// single-flight, so a nudge landing next to an alarm tick coalesces safely.
if (chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    try {
      if (!message || message.type !== 'VD_REFRESH_TOKEN') return; // not ours
      // Only accept from this extension's own pages.
      if (!sender || sender.id !== chrome.runtime.id) return;
      if (!(self.VD_AUTH && typeof self.VD_AUTH.refreshTokenIfNeeded === 'function')) {
        sendResponse({ ok: false, error: 'auth-unavailable' });
        return;
      }
      self.VD_AUTH.refreshTokenIfNeeded()
        .then(function (r) { sendResponse({ ok: true, result: r }); })
        .catch(function (e) {
          sendResponse({ ok: false, error: String((e && e.message) || e) });
        });
      return true; // keep the channel open for the async response
    } catch (e) {
      console.warn('[vd-bg] onMessage handler threw', e);
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

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
// ── the vibedesign.tech bridge ────────────────────────────────────────────
// Signing in on the site signs the extension in, and vice versa. The two hold
// SEPARATE Supabase sessions, linked by a one-time hash — never by a shared
// refresh token, which is single-use and would have the two spending each
// other's (see lib/auth.js#exchangeTokenHash).
//
// docs/AUTH-HANDOFF.md is the contract for the web side.

// The apex origin, and only the apex. manifest.json also permits subdomains to
// open a channel, but a message that can mint a session — or read back who is
// signed in — is accepted from exactly one place. A staging host or a
// user-content subdomain must not be able to sign somebody in.
var VD_TRUSTED_ORIGIN = 'https://vibedesign.tech';

function _vdOriginOf(sender) {
  // sender.origin is what Chrome vouches for. sender.url is a fallback for
  // older builds; it is parsed rather than prefix-matched, because
  // "https://vibedesign.tech.evil.com/" starts with the same characters as
  // the real thing.
  if (sender && typeof sender.origin === 'string') return sender.origin;
  try { return new URL(sender.url).origin; } catch (e) { return null; }
}

// The same read the panel uses (VD_AUTH.readAccount), so the site and the
// panel are always told the same thing about the same storage.
async function _vdSignedInAs() {
  try {
    if (!self.VD_AUTH || typeof self.VD_AUTH.readAccount !== 'function') return null;
    var acct = await self.VD_AUTH.readAccount();
    return acct.authed ? acct.email : null;
  } catch (e) { return null; }
}

// A short, unmissable confirmation on the toolbar icon. The panel may not be
// open when the handoff lands, so this is the only place the user sees it.
function _vdFlashBadge(text, ms) {
  try {
    if (!chrome.action || !chrome.action.setBadgeText) return;
    chrome.action.setBadgeText({ text: text });
    if (chrome.action.setBadgeBackgroundColor) {
      chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
    }
    setTimeout(function () {
      try { chrome.action.setBadgeText({ text: '' }); } catch (e) { /* gone */ }
    }, ms || 10000);
  } catch (e) { console.warn('[vd-bg] badge failed', e); }
}

async function _vdHandleExternal(message, sender) {
  var origin = _vdOriginOf(sender);
  var version = chrome.runtime.getManifest().version;

  // Everything below can change or disclose the signed-in identity, so the
  // origin gate comes before the message is even looked at.
  if (origin !== VD_TRUSTED_ORIGIN) {
    console.warn('[vd-bg] refusing an external message from', origin);
    return { ok: false, error: 'origin-not-allowed' };
  }
  if (!message || typeof message !== 'object') return { ok: false, error: 'bad-message' };

  // The original ping, unchanged.
  if (message.ping === true) return { pong: true, version: version };

  switch (message.type) {
    case 'VD_EXT_STATUS':
      return { installed: true, version: version, signedInAs: await _vdSignedInAs() };

    case 'VD_EXT_LOGIN':
      // The site is waiting on this reply. Whatever happens — a request that
      // never answers, a throw, a hang — it gets one inside the deadline.
      return _vdWithDeadline(_vdHandleLogin(message), _vdHandoffTimeoutMs(), function () {
        console.warn('[vd-handoff] VD_EXT_LOGIN timed out after ' + _vdHandoffTimeoutMs() + ' ms');
        return { ok: false, error: 'timeout', code: 'timeout' };
      });

    case 'VD_EXT_LOGOUT': {
      try {
        // Local only. The site is ending its own session; revoking globally
        // from here would be the extension reaching back into the browser
        // that just told it what happened.
        if (self.VD_AUTH && typeof self.VD_AUTH._clearStoredSession === 'function') {
          await self.VD_AUTH._clearStoredSession();
        }
      } catch (e) { console.warn('[vd-bg] logout failed', e); }
      _vdBroadcast({ type: 'VD_AUTH_CHANGED', signedInAs: null });
      return { ok: true };
    }

    default:
      return { ok: false, error: 'unknown-type' };
  }
}

// 15 s, unless a test says otherwise.
var VD_HANDOFF_TIMEOUT_MS = 15000;
function _vdHandoffTimeoutMs() {
  var v = self.VD_HANDOFF_TIMEOUT_MS;
  return (typeof v === 'number' && v > 0) ? v : VD_HANDOFF_TIMEOUT_MS;
}

// Resolves with the promise's value, or with onTimeout()'s after `ms`.
// Never rejects: the caller is a reply path.
function _vdWithDeadline(promise, ms, onTimeout) {
  var timer = null;
  var deadline = new Promise(function (resolve) {
    timer = setTimeout(function () { resolve(onTimeout()); }, ms);
  });
  return Promise.race([
    Promise.resolve(promise).catch(function (e) {
      console.warn('[vd-handoff] VD_EXT_LOGIN threw: ' + (e && e.message));
      return { ok: false, error: (e && e.message) || 'internal error', code: 'internal' };
    }),
    deadline,
  ]).finally(function () { if (timer) clearTimeout(timer); });
}

// The login itself. Every failure: { ok: false, error: <exact message>,
// code }, logged once under [vd-handoff]. Success never carries a null
// identity. Verification is raw fetch inside lib/auth.js — the worker never
// loads the Supabase SDK (see importScripts above), so it can never wait on
// a lock the panel's SDK instance holds.
async function _vdHandleLogin(message) {
  var t0 = Date.now();
  var fail = function (code, msg) {
    console.warn('[vd-handoff] VD_EXT_LOGIN failed — ' + code + ': ' + msg + ' (' + (Date.now() - t0) + ' ms)');
    return { ok: false, error: msg, code: code };
  };
  console.log('[vd-handoff] VD_EXT_LOGIN received');
  if (!self.VD_AUTH || typeof self.VD_AUTH.exchangeTokenHash !== 'function') {
    return fail('auth-unavailable', 'auth module is not loaded in the service worker');
  }
  if (message.tokenHash === undefined || message.tokenHash === null || message.tokenHash === '') {
    return fail('bad-token-hash', 'tokenHash missing');
  }
  console.log('[vd-handoff] exchanging the token hash');
  var res = await self.VD_AUTH.exchangeTokenHash(message.tokenHash, 'magiclink');
  if (!res || !res.ok) {
    // exchangeTokenHash already logged; the reply repeats its exact message.
    return { ok: false, error: (res && res.error) || 'exchange failed', code: (res && res.code) || 'unknown',
             message: (res && res.message) || null };
  }
  if (!res.signedInAs) return fail('no-identity', 'session has no identity: the auth server returned no user email');
  // `email` in the message is advisory; the session is the authority on
  // who was signed in, so that is what gets reported back.
  _vdFlashBadge('✓', 10000);
  _vdBroadcast({ type: 'VD_AUTH_CHANGED', signedInAs: res.signedInAs });
  console.log('[vd-handoff] VD_EXT_LOGIN ok — signed in as ' + res.signedInAs + ' via ' + res.type + ' (' + (Date.now() - t0) + ' ms)');
  return { ok: true, signedInAs: res.signedInAs, type: res.type || null };
}

// Tells any open panel to re-read the account. Fails silently when nothing is
// listening, which is the normal case.
function _vdBroadcast(msg) {
  try { chrome.runtime.sendMessage(msg, function () { void chrome.runtime.lastError; }); }
  catch (e) { /* no receiver */ }
}

if (chrome.runtime && chrome.runtime.onMessageExternal) {
  chrome.runtime.onMessageExternal.addListener(function (message, sender, sendResponse) {
    // One reply, exactly once. A second sendResponse is ignored by Chrome
    // but logged here, because it would mean two paths both thought they
    // owned the channel.
    var replied = false;
    var reply = function (r) {
      if (replied) { console.warn('[vd-handoff] duplicate reply suppressed'); return; }
      replied = true;
      try { sendResponse(r); } catch (e) { console.warn('[vd-handoff] sendResponse threw: ' + (e && e.message)); }
    };
    _vdHandleExternal(message, sender).then(reply, function (e) {
      console.warn('[vd-handoff] onMessageExternal threw: ' + (e && e.message));
      reply({ ok: false, error: (e && e.message) || 'internal error', code: 'internal' });
    });
    return true;   // the reply is async; keep the channel open
  });
}

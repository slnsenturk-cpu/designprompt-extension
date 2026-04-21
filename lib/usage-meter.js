// VibeDesign — anonymous usage meter (v2.0.0-beta.2)
// 5 prompts per calendar month (UTC) for anonymous users.
// Authenticated users bypass: canGenerate always true, incrementUsage no-op.
//
// Storage key: "usage_meter" = { count: number, periodStart: ISO string
// (1st of current UTC month at 00:00:00.000Z) }. Never cleared on
// sign-in/out — the limit tracks the device, not the account.
//
// Exposes self.VD_USAGE with:
//   getUsage()         returns { count, limit, periodStart, resetsAt }
//   canGenerate()      async boolean, false only when anon and count >= LIMIT
//   incrementUsage()   async, increments count; no-op if authed
//   resetIfNeeded()    async, zeroes count if the stored periodStart is
//                      before the current UTC month
//   LIMIT              the anonymous cap (5)
//
// Every async export is try/catch-wrapped. On storage failure we FAIL
// OPEN (return canGenerate=true, silently skip increment) rather than
// lock the user out — the meter is a freemium soft gate, not a security
// boundary, and the existing anonymous UI must keep working.

(function (global) {
  'use strict';

  var STORAGE_KEY = 'usage_meter';
  var LIMIT = 5;

  function _currentPeriodStart() {
    var now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString();
  }
  function _nextPeriodStart() {
    var now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0)).toISOString();
  }
  function _defaults() {
    return { count: 0, periodStart: _currentPeriodStart() };
  }

  async function _readRaw() {
    try {
      var r = await chrome.storage.local.get(STORAGE_KEY);
      return (r && r[STORAGE_KEY]) || null;
    } catch (e) {
      console.warn('[vd-usage] read failed', e);
      return null;
    }
  }
  async function _writeRaw(value) {
    try {
      var obj = {};
      obj[STORAGE_KEY] = value;
      await chrome.storage.local.set(obj);
    } catch (e) {
      console.warn('[vd-usage] write failed', e);
    }
  }

  function _normalize(raw) {
    if (!raw || typeof raw !== 'object') return _defaults();
    var count = (typeof raw.count === 'number' && isFinite(raw.count) && raw.count >= 0)
      ? Math.floor(raw.count) : 0;
    var validStart = (typeof raw.periodStart === 'string')
      && !isNaN(new Date(raw.periodStart).getTime());
    var periodStart = validStart ? raw.periodStart : _currentPeriodStart();
    return { count: count, periodStart: periodStart };
  }

  async function _authed() {
    try {
      if (!global.VD_AUTH || typeof global.VD_AUTH.isAuthenticated !== 'function') return false;
      return !!(await global.VD_AUTH.isAuthenticated());
    } catch (e) { return false; }
  }

  async function resetIfNeeded() {
    try {
      var raw = await _readRaw();
      var state = _normalize(raw);
      var current = _currentPeriodStart();
      if (state.periodStart !== current) {
        // New UTC month (or corrupted/absent) — zero count, stamp current.
        var fresh = { count: 0, periodStart: current };
        await _writeRaw(fresh);
        return fresh;
      }
      // Persist normalized shape if what we read was malformed.
      if (!raw || raw.count !== state.count || raw.periodStart !== state.periodStart) {
        await _writeRaw(state);
      }
      return state;
    } catch (e) {
      console.warn('[vd-usage] resetIfNeeded failed', e);
      return _defaults();
    }
  }

  async function getUsage() {
    try {
      var state = await resetIfNeeded();
      return {
        count: state.count,
        limit: LIMIT,
        periodStart: state.periodStart,
        resetsAt: _nextPeriodStart()
      };
    } catch (e) {
      return { count: 0, limit: LIMIT, periodStart: _currentPeriodStart(), resetsAt: _nextPeriodStart() };
    }
  }

  async function canGenerate() {
    try {
      if (await _authed()) return true;
      var state = await resetIfNeeded();
      return state.count < LIMIT;
    } catch (e) {
      // Fail open — a buggy meter should not brick the extension.
      console.warn('[vd-usage] canGenerate failed, allowing', e);
      return true;
    }
  }

  async function incrementUsage() {
    try {
      if (await _authed()) return; // authed users bypass the cap entirely
      var state = await resetIfNeeded();
      var next = { count: state.count + 1, periodStart: state.periodStart };
      await _writeRaw(next);
      return next;
    } catch (e) {
      console.warn('[vd-usage] incrementUsage failed', e);
    }
  }

  global.VD_USAGE = {
    getUsage: getUsage,
    canGenerate: canGenerate,
    incrementUsage: incrementUsage,
    resetIfNeeded: resetIfNeeded,
    LIMIT: LIMIT
  };
})(typeof self !== 'undefined' ? self : globalThis);

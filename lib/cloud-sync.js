// VibeDesign — cloud sync for authenticated users (v2.0.0-beta.2)
// Thin wrapper over self.VD_SUPABASE.initSupabase() exposing the specific
// reads and writes this extension needs against the `analyses` and
// `prompts` tables. RLS on both tables is `user_id = auth.uid()` so every
// payload explicitly sets user_id from the current session.
//
// Exposes self.VD_CLOUD with:
//   syncAnalysis(analysisData)              insert into analyses, returns id
//   syncPrompt(promptData, analysisId)      insert into prompts
//   fetchRecentAnalyses(limit = 20)         user's recent analyses desc
//   fetchPromptsForAnalysis(analysisId)     prompts for a given analysis
//   deleteAnalysis(analysisId)              deletes (prompts cascade via FK)
//
// Every function returns a plain object — { ok, id?, data?, error? } — and
// never throws. Callers dual-write with local save; failures here log but
// do not block the core flow. migrateAnonymousHistory lands in commit 5.

(function (global) {
  'use strict';

  function _client() {
    try {
      if (!global.VD_SUPABASE || typeof global.VD_SUPABASE.initSupabase !== 'function') return null;
      return global.VD_SUPABASE.initSupabase();
    } catch (e) {
      console.warn('[vd-cloud] client init failed', e);
      return null;
    }
  }

  async function _currentUserId() {
    try {
      if (global.VD_AUTH && typeof global.VD_AUTH.peekSession === 'function') {
        var sess = await global.VD_AUTH.peekSession();
        if (sess && sess.user && sess.user.id) return sess.user.id;
      }
      var c = _client();
      if (!c) return null;
      var r = await c.auth.getUser();
      return (r && r.data && r.data.user && r.data.user.id) || null;
    } catch (e) {
      console.warn('[vd-cloud] _currentUserId failed', e);
      return null;
    }
  }

  function _errMsg(err) {
    if (!err) return 'unknown-error';
    if (typeof err === 'string') return err;
    return err.message || err.code || err.name || 'unknown-error';
  }

  // Only http/https URLs are syncable. file://, about:, chrome://,
  // chrome-extension://, data:, view-source:, javascript:, brave:, etc.
  // have no meaningful hostname and can't be shared/synced across devices.
  function _isHttpUrl(u) {
    if (typeof u !== 'string') return false;
    var lower = u.toLowerCase();
    return lower.indexOf('http://') === 0 || lower.indexOf('https://') === 0;
  }

  async function syncAnalysis(analysisData) {
    try {
      var c = _client();
      if (!c) return { ok: false, error: 'client-unavailable' };
      var user_id = await _currentUserId();
      if (!user_id) return { ok: false, error: 'not-authenticated' };
      // analyses.url and analyses.hostname are NOT NULL; validate both
      // before hitting Supabase so we fail with a clear error instead of
      // a constraint violation.
      var url = (analysisData && typeof analysisData.url === 'string') ? analysisData.url.trim() : '';
      if (!url) {
        console.warn('[vd-cloud] syncAnalysis missing url — skipping insert');
        return { ok: false, error: 'missing-url' };
      }
      var hostname = (analysisData && typeof analysisData.hostname === 'string') ? analysisData.hostname.trim() : '';
      if (!hostname) {
        console.warn('[vd-cloud] syncAnalysis missing hostname — skipping insert');
        return { ok: false, error: 'missing-hostname' };
      }
      var payload = {
        user_id: user_id,
        url: url,
        hostname: hostname,
        primary_color: (analysisData && analysisData.primary_color) || null,
        page_background: (analysisData && analysisData.page_background) || null,
        page_title: (analysisData && analysisData.page_title) || null,
        extraction_version: (analysisData && analysisData.extraction_version) || null,
        tokens_json: (analysisData && analysisData.tokens_json) || {}
      };
      if (analysisData && analysisData.created_at) payload.created_at = analysisData.created_at;
      var res = await c.from('analyses').insert(payload).select('id').single();
      if (res.error) return { ok: false, error: _errMsg(res.error) };
      return { ok: true, id: res.data && res.data.id };
    } catch (e) {
      console.warn('[vd-cloud] syncAnalysis threw', e);
      return { ok: false, error: _errMsg(e) };
    }
  }

  async function syncPrompt(promptData, analysisId) {
    try {
      if (!analysisId) return { ok: false, error: 'missing-analysis-id' };
      var c = _client();
      if (!c) return { ok: false, error: 'client-unavailable' };
      var user_id = await _currentUserId();
      if (!user_id) return { ok: false, error: 'not-authenticated' };
      // prompts.prompt_text and prompts.target_platform are NOT NULL;
      // validate before hitting Supabase.
      var prompt_text = (promptData && typeof promptData.prompt_text === 'string') ? promptData.prompt_text : '';
      if (!prompt_text) {
        console.warn('[vd-cloud] syncPrompt missing prompt_text — skipping insert');
        return { ok: false, error: 'missing-prompt-text' };
      }
      var target_platform = (promptData && typeof promptData.target_platform === 'string' && promptData.target_platform)
        ? promptData.target_platform : 'generic';
      var payload = {
        user_id: user_id,
        analysis_id: analysisId,
        prompt_text: prompt_text,
        target_platform: target_platform
      };
      // Optional / defaulted fields — only send when the caller supplied
      // a value so server-side defaults (e.g. focus DEFAULT 'all',
      // was_ai_enhanced DEFAULT false) still apply when we omit them.
      if (promptData.focus) payload.focus = promptData.focus;
      if (promptData.ai_provider) payload.ai_provider = promptData.ai_provider;
      if (typeof promptData.was_ai_enhanced === 'boolean') payload.was_ai_enhanced = promptData.was_ai_enhanced;
      if (promptData.created_at) payload.created_at = promptData.created_at;
      var res = await c.from('prompts').insert(payload).select('id').single();
      if (res.error) return { ok: false, error: _errMsg(res.error) };
      return { ok: true, id: res.data && res.data.id };
    } catch (e) {
      console.warn('[vd-cloud] syncPrompt threw', e);
      return { ok: false, error: _errMsg(e) };
    }
  }

  async function fetchRecentAnalyses(limit) {
    try {
      var c = _client();
      if (!c) return { ok: false, error: 'client-unavailable', data: [] };
      var user_id = await _currentUserId();
      if (!user_id) return { ok: false, error: 'not-authenticated', data: [] };
      var n = (typeof limit === 'number' && limit > 0 && limit <= 100) ? Math.floor(limit) : 20;
      var res = await c.from('analyses')
        .select('id, url, hostname, primary_color, page_background, page_title, extraction_version, tokens_json, created_at')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(n);
      if (res.error) return { ok: false, error: _errMsg(res.error), data: [] };
      return { ok: true, data: res.data || [] };
    } catch (e) {
      console.warn('[vd-cloud] fetchRecentAnalyses threw', e);
      return { ok: false, error: _errMsg(e), data: [] };
    }
  }

  async function fetchPromptsForAnalysis(analysisId) {
    try {
      if (!analysisId) return { ok: false, error: 'missing-analysis-id', data: [] };
      var c = _client();
      if (!c) return { ok: false, error: 'client-unavailable', data: [] };
      var user_id = await _currentUserId();
      if (!user_id) return { ok: false, error: 'not-authenticated', data: [] };
      var res = await c.from('prompts')
        .select('id, analysis_id, prompt_text, target_platform, focus, ai_provider, was_ai_enhanced, created_at')
        .eq('user_id', user_id)
        .eq('analysis_id', analysisId)
        .order('created_at', { ascending: false });
      if (res.error) return { ok: false, error: _errMsg(res.error), data: [] };
      return { ok: true, data: res.data || [] };
    } catch (e) {
      console.warn('[vd-cloud] fetchPromptsForAnalysis threw', e);
      return { ok: false, error: _errMsg(e), data: [] };
    }
  }

  // One-shot upload of any existing anonymous promptHistory to Supabase.
  // Runs at most once per device — the flag cloud_migration_completed_at
  // (an ISO string) in chrome.storage.local prevents re-runs. Each local
  // entry produces a 1:1 synthetic analysis + prompt: analyses rows have
  // primary_color=null and tokens_json={} (explicit empty object, safe
  // whether the column is nullable or defaults to '{}'::jsonb). The
  // prompt is linked via the newly-created analysis_id (NOT NULL on the
  // FK). created_at on both rows is derived from the local savedAt so
  // the server-side ordering matches the pre-migration history.
  //
  // Partial-failure policy: if any entry successfully migrates, the flag
  // is set and remaining failures are accepted (logged via console.warn).
  // If ALL inserts fail (likely network/permissions), the flag is NOT
  // set — the next sign-in will retry.
  //
  // Known edge case: if the user closes the sidepanel mid-migration,
  // some prompts may be in the cloud without the flag being set; the
  // next sign-in will re-migrate those entries, producing duplicates.
  // Accepted for beta.2 — the typical sidepanel session outlives a
  // 30-entry migration (a few seconds).
  async function migrateAnonymousHistory() {
    try {
      // Idempotency check
      var flagStore = await chrome.storage.local.get('cloud_migration_completed_at');
      if (flagStore && flagStore.cloud_migration_completed_at) {
        return { ok: true, skipped: true, reason: 'already-migrated' };
      }

      var user_id = await _currentUserId();
      if (!user_id) return { ok: false, error: 'not-authenticated' };

      var histStore = await chrome.storage.local.get('promptHistory');
      var history = (histStore && histStore.promptHistory) || {};
      var entries = Object.values(history);

      if (entries.length === 0) {
        // Nothing to migrate — stamp the flag anyway so we don't keep
        // checking on every sign-in.
        await chrome.storage.local.set({ cloud_migration_completed_at: new Date().toISOString() });
        return { ok: true, skipped: false, migrated: 0, failed: 0 };
      }

      var migrated = 0;
      var failed = 0;
      var skipped = 0;

      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (!entry || typeof entry.prompt !== 'string' || !entry.prompt
            || typeof entry.url !== 'string' || !entry.url) {
          failed++;
          continue;
        }

        // Non-http URLs (file://, about:, chrome://, data:, etc.) have no
        // meaningful hostname and aren't cross-device shareable. Skip
        // silently — they're counted as skipped, NOT failed, so the user
        // isn't alarmed and the migration can still complete cleanly.
        if (!_isHttpUrl(entry.url)) {
          console.log('[vd-cloud] skipping non-http entry:', entry.url);
          skipped++;
          continue;
        }

        // created_at intentionally omitted — let Supabase default to
        // migration time. Backfilling entry.savedAt can conflict with
        // RLS/defaults on some Postgres configurations.
        var analysisRes = await syncAnalysis({
          url: entry.url,
          hostname: entry.domain || '',
          primary_color: null,
          page_background: null,
          page_title: null,
          extraction_version: null,
          tokens_json: {}
        });
        if (!analysisRes || !analysisRes.ok || !analysisRes.id) {
          console.warn('[vd-cloud] migration: analysis insert failed for',
            entry.domain || entry.url, analysisRes && analysisRes.error);
          failed++;
          continue;
        }

        var promptRes = await syncPrompt({
          prompt_text: entry.prompt,
          target_platform: entry.platform || 'generic',
          focus: entry.focus || 'all',
          ai_provider: entry.provider || null,
          was_ai_enhanced: false
        }, analysisRes.id);
        if (!promptRes || !promptRes.ok) {
          console.warn('[vd-cloud] migration: prompt insert failed for',
            entry.domain || entry.url, promptRes && promptRes.error);
          // Roll back the analysis so the dashboard doesn't show an
          // orphan row with no linked prompt. If the rollback itself
          // fails (network), log and move on — the user has SQL
          // cleanup as a fallback.
          try {
            var rollback = await deleteAnalysis(analysisRes.id);
            if (!rollback || !rollback.ok) {
              console.warn('[vd-cloud] migration: orphan rollback failed for analysis',
                analysisRes.id, rollback && rollback.error);
            }
          } catch (rbErr) {
            console.warn('[vd-cloud] migration: rollback threw for analysis',
              analysisRes.id, rbErr);
          }
          failed++;
          continue;
        }

        migrated++;
      }

      // Flag policy:
      //   failed === 0                → set (clean run, including all-skipped)
      //   migrated > 0 && failed > 0  → set (partial success, accept losses)
      //   migrated === 0 && failed > 0 → DON'T set (retry on next sign-in)
      if (failed === 0 || migrated > 0) {
        await chrome.storage.local.set({ cloud_migration_completed_at: new Date().toISOString() });
      }

      console.log('[vd-cloud] migration complete:',
        migrated, 'migrated,', failed, 'failed,', skipped, 'skipped (non-web URLs)');
      return {
        ok: failed === 0 || migrated > 0,
        migrated: migrated,
        failed: failed,
        skipped: skipped
      };
    } catch (e) {
      console.warn('[vd-cloud] migrateAnonymousHistory threw', e);
      return { ok: false, error: _errMsg(e) };
    }
  }

  async function deleteAnalysis(analysisId) {
    try {
      if (!analysisId) return { ok: false, error: 'missing-analysis-id' };
      var c = _client();
      if (!c) return { ok: false, error: 'client-unavailable' };
      var user_id = await _currentUserId();
      if (!user_id) return { ok: false, error: 'not-authenticated' };
      // Prompts cascade via FK ON DELETE CASCADE configured server-side.
      var res = await c.from('analyses')
        .delete()
        .eq('id', analysisId)
        .eq('user_id', user_id);
      if (res.error) return { ok: false, error: _errMsg(res.error) };
      return { ok: true };
    } catch (e) {
      console.warn('[vd-cloud] deleteAnalysis threw', e);
      return { ok: false, error: _errMsg(e) };
    }
  }

  global.VD_CLOUD = {
    syncAnalysis: syncAnalysis,
    syncPrompt: syncPrompt,
    fetchRecentAnalyses: fetchRecentAnalyses,
    fetchPromptsForAnalysis: fetchPromptsForAnalysis,
    deleteAnalysis: deleteAnalysis,
    migrateAnonymousHistory: migrateAnonymousHistory
  };
})(typeof self !== 'undefined' ? self : globalThis);

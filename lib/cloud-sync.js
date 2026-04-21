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

  async function syncAnalysis(analysisData) {
    try {
      var c = _client();
      if (!c) return { ok: false, error: 'client-unavailable' };
      var user_id = await _currentUserId();
      if (!user_id) return { ok: false, error: 'not-authenticated' };
      // analyses.url is NOT NULL; validate before hitting Supabase so we
      // fail with a clear error instead of a constraint violation.
      var url = (analysisData && typeof analysisData.url === 'string') ? analysisData.url.trim() : '';
      if (!url) {
        console.warn('[vd-cloud] syncAnalysis missing url — skipping insert');
        return { ok: false, error: 'missing-url' };
      }
      var payload = {
        user_id: user_id,
        url: url,
        hostname: (analysisData && analysisData.hostname) || '',
        primary_color: (analysisData && analysisData.primary_color) || null,
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
      var payload = {
        user_id: user_id,
        analysis_id: analysisId,
        content: (promptData && promptData.content) || ''
      };
      if (promptData && promptData.created_at) payload.created_at = promptData.created_at;
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
        .select('id, hostname, primary_color, tokens_json, created_at')
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
        .select('id, analysis_id, content, created_at')
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
    deleteAnalysis: deleteAnalysis
    // migrateAnonymousHistory lands in commit 5
  };
})(typeof self !== 'undefined' ? self : globalThis);

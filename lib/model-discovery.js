// VibeDesign — live model discovery (v3.0)
// Plain globals so the same file works via <script> tag (popup/sidepanel)
// and via require() in Node test scripts. No ESM, no build step.
//
// Responsibilities:
//   - fetch each provider's list-models endpoint with the user's key
//   - filter to chat-capable text models, sort newest first
//   - merge the live result with the curated static list (static wins on
//     label/note; static-only entries are kept as a tail fallback)
//   - cache the merged result in chrome.storage.local for 24h so we don't
//     re-hit the provider on every settings-panel open
//   - resolve a saved model id against the merged list (falls back to the
//     provider default when the saved id has disappeared)
//   - detect when a saved model is older than the provider's current
//     default, for the "newer model available" nudge

const VD_MODELS = (() => {
  const CACHE_KEY = 'vd_model_cache';
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  const DISMISS_KEY = 'vd_nudge_dismissed';

  function isOpenAIChatModel(id) {
    const lower = id.toLowerCase();
    if (/embedding|whisper|tts|dall-e|moderation|davinci|babbage|ada-|image|audio|realtime|transcribe|search-preview/.test(lower)) return false;
    return /^(gpt-|chatgpt-|o[0-9])/.test(lower);
  }

  function isGeminiChatModel(model) {
    const name = (model.name || '').replace(/^models\//, '');
    if (/embedding|aqa|imagen|veo|tts|transcribe/i.test(name)) return false;
    const methods = model.supportedGenerationMethods || [];
    return methods.includes('generateContent');
  }

  // ── fetch live models from each provider's list endpoint ──────────────
  async function fetchLiveModels(provider, apiKey) {
    if (provider === 'claude') {
      const r = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      });
      if (!r.ok) throw new Error(`Claude models list: ${r.status}`);
      const data = await r.json();
      return (data.data || [])
        .slice()
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        // The creation date is KEPT, not just used to sort. Position in a
        // merged list is not a reliable statement about age — a model the
        // account cannot see yet has no position at all — so the comparison
        // that decides the "newer model" nudge needs the date itself.
        .map(m => ({ id: m.id, label: m.display_name || m.id,
                     created: Date.parse(m.created_at) || null }));
    }

    if (provider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!r.ok) throw new Error(`OpenAI models list: ${r.status}`);
      const data = await r.json();
      return (data.data || [])
        .filter(m => isOpenAIChatModel(m.id))
        .slice()
        .sort((a, b) => (b.created || 0) - (a.created || 0))
        .map(m => ({ id: m.id, label: m.id,
                     created: m.created ? m.created * 1000 : null }));
    }

    if (provider === 'gemini') {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
      if (!r.ok) throw new Error(`Gemini models list: ${r.status}`);
      const data = await r.json();
      // ListModels has no creation-date field, so we can't sort by age —
      // we keep the API's own ordering (newest-first in practice).
      return (data.models || [])
        .filter(isGeminiChatModel)
        .map(m => ({ id: (m.name || '').replace(/^models\//, ''), label: m.displayName || m.name }));
    }

    return [];
  }

  // ── merge live results into the curated static list ───────────────────
  // Live entries keep their static label/note when the id matches a known
  // static model (curated copy is nicer than a raw API label); live-only
  // ids are added with a synthesized label. Static entries the live call
  // didn't return are kept at the end, so a temporary API filtering quirk
  // (or a key without access to a model) doesn't remove it from the list.
  function mergeModelLists(staticModels, liveModels) {
    const staticById = new Map(staticModels.map(m => [m.id, m]));
    const seen = new Set();
    const merged = [];
    liveModels.forEach(lm => {
      const s = staticById.get(lm.id);
      const entry = s ? { ...s } : { id: lm.id, label: lm.label || lm.id, note: 'Live' };
      if (lm.created) entry.created = lm.created;
      merged.push(entry);
      seen.add(lm.id);
    });
    // A curated model the live list does not mention is APPENDED, because
    // there is nowhere else to put it — but appending to a newest-first list
    // would otherwise imply it is the oldest thing there. It is flagged as
    // having no live ranking so nothing reads its position as an age.
    staticModels.forEach(sm => {
      if (!seen.has(sm.id)) merged.push({ ...sm, unranked: true });
    });
    return merged;
  }

  // ── 24h cache ───────────────────────────────────────────────────────────
  async function getCacheEntry(provider) {
    const stored = await chrome.storage.local.get(CACHE_KEY);
    const all = stored[CACHE_KEY] || {};
    return all[provider] || null;
  }

  async function setCacheEntry(provider, entry) {
    const stored = await chrome.storage.local.get(CACHE_KEY);
    const all = stored[CACHE_KEY] || {};
    all[provider] = entry;
    await chrome.storage.local.set({ [CACHE_KEY]: all });
  }

  // Returns the merged model list for a provider, refreshing from the
  // provider's API at most once per 24h. Falls back to staticModels when
  // there's no key or the request fails.
  async function getMergedModels(provider, apiKey, staticModels, opts = {}) {
    const now = Date.now();
    if (!opts.force) {
      const cached = await getCacheEntry(provider);
      if (cached && (now - cached.fetchedAt) < CACHE_TTL_MS) {
        return cached.models;
      }
    }
    if (!apiKey) {
      return staticModels.slice();
    }
    try {
      const live = await fetchLiveModels(provider, apiKey);
      const merged = mergeModelLists(staticModels, live);
      await setCacheEntry(provider, { fetchedAt: now, models: merged, ok: true });
      return merged;
    } catch (e) {
      await setCacheEntry(provider, { fetchedAt: now, models: staticModels.slice(), ok: false });
      return staticModels.slice();
    }
  }

  // ── saved-model resolution + staleness nudge ───────────────────────────
  function resolveModel(savedId, mergedModels, defaultId) {
    if (savedId && mergedModels.some(m => m.id === savedId)) {
      return { id: savedId, fellBack: false };
    }
    return { id: defaultId, fellBack: true };
  }

  // ── nudge dismissals ───────────────────────────────────────────────────
  // Keyed by the *newer* model's id, so dismissing "Opus 5" silences that
  // nudge forever but a later "Opus 6" still gets one.
  async function getDismissedNudges() {
    const stored = await chrome.storage.local.get(DISMISS_KEY);
    return stored[DISMISS_KEY] || {};
  }

  async function dismissNudge(modelId) {
    const all = await getDismissedNudges();
    all[modelId] = true;
    await chrome.storage.local.set({ [DISMISS_KEY]: all });
    return all;
  }

  // "Newer" is defined by position in the newest-first merged list: if the
  // provider's current default ranks ahead of the user's saved model, the
  // default is newer. `dismissed` is the map from getDismissedNudges();
  // omitting it means "nothing dismissed".
  // "Newer model available" is a claim about AGE, so it has to be decided by
  // age — not by position in a list.
  //
  // The old rule compared indexes in the merged list. That list is
  // newest-first, so the index usually tracks age — except for a curated model
  // the live API does not return, which gets appended and therefore looks like
  // the oldest entry. That is exactly what happened to Fable 5: the newest
  // model on the list, absent from the account's live models, and so the panel
  // told the user to "upgrade" from it to Sonnet 5.
  //
  // Order of preference:
  //   1. live creation dates, when both models have one;
  //   2. the CURATED list's order, which is authored newest-first;
  //   3. no nudge — an unknown ordering is not evidence of anything.
  function compareAge(savedId, defaultId, mergedModels, staticModels) {
    const byId = new Map(mergedModels.map(m => [m.id, m]));
    const saved = byId.get(savedId);
    const def = byId.get(defaultId);

    if (saved && def && saved.created && def.created) {
      return def.created > saved.created ? 'default-newer' : 'saved-newer-or-same';
    }

    // Without a curated list to consult, fall back to position in the merged
    // list — which is newest-first — but ONLY for entries whose position
    // actually means something. An entry flagged `unranked` is a curated model
    // the live API did not return; it was appended for want of anywhere else
    // to put it, and reading its position as an age is the bug that told
    // Fable 5 users to switch to Sonnet 5.
    const list = (staticModels && staticModels.length) ? staticModels : mergedModels;
    const ids = list.map(m => m.id);
    const s = ids.indexOf(savedId), d = ids.indexOf(defaultId);
    if (s === -1 || d === -1) return 'unknown';
    if (list === mergedModels && (list[s].unranked || list[d].unranked)) return 'unknown';
    // Authored newest-first, so a LOWER index is newer.
    return d < s ? 'default-newer' : 'saved-newer-or-same';
  }

  function checkNudge(savedId, mergedModels, defaultId, dismissed, staticModels) {
    if (!savedId || savedId === defaultId) return { shouldNudge: false };
    const byId = new Map(mergedModels.map(m => [m.id, m]));
    if (!byId.has(defaultId)) return { shouldNudge: false };

    // The selected model being the newest thing we know about ends it here,
    // whichever way the lists are ordered.
    const ranked = mergedModels.filter(m => m.created);
    if (ranked.length) {
      const newest = Math.max(...ranked.map(m => m.created));
      const saved = byId.get(savedId);
      if (saved && saved.created && saved.created >= newest) return { shouldNudge: false };
    }
    // The first entry of the curated list is the newest model we ship. Nothing
    // can be newer than it, so it is never something to be nudged away from.
    const curated = (staticModels && staticModels.length) ? staticModels : null;
    if (curated && curated[0].id === savedId) return { shouldNudge: false };

    if (compareAge(savedId, defaultId, mergedModels, curated) !== 'default-newer') {
      return { shouldNudge: false };
    }
    if (dismissed && dismissed[defaultId]) return { shouldNudge: false };
    return { shouldNudge: true, newer: byId.get(defaultId) };
  }

  return {
    fetchLiveModels,
    mergeModelLists,
    getMergedModels,
    resolveModel,
    checkNudge,
    compareAge,
    getDismissedNudges,
    dismissNudge,
    _CACHE_KEY: CACHE_KEY,
    _DISMISS_KEY: DISMISS_KEY,
    _CACHE_TTL_MS: CACHE_TTL_MS,
  };
})();

if (typeof self !== 'undefined') {
  self.VD_MODELS = VD_MODELS;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VD_MODELS;
}

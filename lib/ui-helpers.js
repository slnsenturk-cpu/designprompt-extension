// ═══════════════════════════════════════════════════════════════════════════
// Shared UI module — used by both popup.js and sidepanel.js
// Depends on: lib/color-utils.js (safeHostname), lib/prompt-builder.js, lib/token-exporter.js
// ═══════════════════════════════════════════════════════════════════════════

// ── CONSTANTS ─────────────────────────────────────────────────────────────
const MAX_HISTORY = 30;
const HISTORY_KEY = 'promptHistory';

const PROVIDERS = {
  gemini: {
    name: 'Gemini', color: '#4285f4', placeholder: 'AIza...',
    models: [
      { id: 'gemini-3.5-flash-lite',  label: 'Flash 3.5 Lite', note: 'Free · Fastest'            },
      { id: 'gemini-3.7-flash',       label: 'Flash 3.7',      note: 'Free · Recommended'        },
      { id: 'gemini-3.1-pro-preview', label: '3.1 Pro',        note: 'Paid · Preview · Frontier' },
    ],
    defaultModel: 'gemini-3.7-flash',
    info: 'Flash 3.7 free · 3.1 Pro is paid preview. <a href="https://aistudio.google.com/apikey" target="_blank">Get key →</a>',
  },
  claude: {
    name: 'Claude', color: '#d97706', placeholder: 'sk-ant-...',
    models: [
      { id: 'claude-fable-5',            label: 'Fable 5',    note: 'Paid · Highest capability · Slower' },
      { id: 'claude-opus-5',             label: 'Opus 5',     note: 'Paid · Complex work'                },
      { id: 'claude-sonnet-5',           label: 'Sonnet 5',   note: 'Paid · Fast · Best value'           },
      { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5',  note: 'Paid · Fastest · Low cost'          },
    ],
    defaultModel: 'claude-sonnet-5',
    info: 'Paid. <a href="https://console.anthropic.com/settings/keys" target="_blank">Get key →</a>',
  },
  openai: {
    name: 'OpenAI', color: '#10a37f', placeholder: 'sk-...',
    models: [
      { id: 'gpt-5.6-luna',  label: 'GPT-5.6 Luna',  note: 'Paid · Fastest · Low cost' },
      { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', note: 'Paid · Balanced'           },
      { id: 'gpt-5.6-sol',   label: 'GPT-5.6 Sol',   note: 'Paid · Complex work'       },
    ],
    defaultModel: 'gpt-5.6-terra',
    info: 'Paid. <a href="https://platform.openai.com/api-keys" target="_blank">Get key →</a>',
  },
  none: {
    name: 'None', color: '#555', placeholder: '', models: [], defaultModel: null,
    info: 'No AI — rule engine emits detailed structured output. Deterministic, zero cost.',
  },
};

const SOURCE_ICONS = { page:'◫', element:'⊡', image:'⬚' };

// ── STATE ─────────────────────────────────────────────────────────────────
let state = {
  mode:'page', focus:'all',
  pickerActive:false,
  lastPrompt:'',
  lastAnalyzedData:null, lastAiDirection:null,
  provider:'gemini', apiKeys:{}, selectedModels:{},
  currentUrl:'',
  liveModels:{}, expandedModelList:{}, dismissedNudges:{}, savedModelLabels:{},
};

const $ = id => document.getElementById(id);

// Hook point — popup.js / sidepanel.js can set these before calling initUI()
let _uiHooks = {};

// ── PROVIDER HELPERS ──────────────────────────────────────────────────────
// Live-discovered models (see lib/model-discovery.js) merged over the
// curated static list, when a refresh has completed for this provider.
function getModelsForProvider(provider) {
  const cfg = PROVIDERS[provider];
  if (!cfg) return [];
  return state.liveModels[provider] || cfg.models;
}

// Resolves the effective model id, falling back to the provider default
// when the saved id no longer appears in the (possibly live-refreshed)
// model list — e.g. a model was retired since the user picked it.
function getActiveModel(provider) {
  const cfg = PROVIDERS[provider];
  if (!cfg || !cfg.models.length) return null;
  const allModels = getModelsForProvider(provider);
  const saved = state.selectedModels[provider];
  if (typeof self !== 'undefined' && self.VD_MODELS) {
    return self.VD_MODELS.resolveModel(saved, allModels, cfg.defaultModel).id;
  }
  return (saved && allModels.some(m => m.id === saved)) ? saved : cfg.defaultModel;
}

function getActiveModelLabel(provider) {
  const modelId = getActiveModel(provider);
  const cfg = PROVIDERS[provider];
  if (!cfg) return modelId;
  const m = getModelsForProvider(provider).find(m => m.id === modelId);
  return m ? m.label : modelId;
}

// Best available human label for a saved model id. A retired model is gone
// from both the live and the curated list, so we fall back to the label we
// recorded when the user picked it (see selectModel), and only then to the
// raw id.
function labelForModelId(provider, modelId) {
  const cfg = PROVIDERS[provider];
  const inList = getModelsForProvider(provider).find(m => m.id === modelId);
  if (inList) return inList.label;
  const inStatic = cfg && cfg.models.find(m => m.id === modelId);
  if (inStatic) return inStatic.label;
  const remembered = state.savedModelLabels[provider];
  if (remembered && remembered.id === modelId) return remembered.label;
  return modelId;
}

// One-line settings-panel notice: either "switched off a retired model" or
// "a newer model is available" — never both at once.
function computeModelNotice(provider) {
  const cfg = PROVIDERS[provider];
  if (!cfg || !cfg.models.length || typeof self === 'undefined' || !self.VD_MODELS) return null;
  const allModels = getModelsForProvider(provider);
  const saved = state.selectedModels[provider];
  const resolved = self.VD_MODELS.resolveModel(saved, allModels, cfg.defaultModel);
  if (resolved.fellBack && saved) {
    return {
      type: 'fallback',
      text: `${labelForModelId(provider, saved)} is no longer available — using ${labelForModelId(provider, resolved.id)}.`,
    };
  }
  // The curated list is passed so the nudge can fall back to authored order
  // when the live API has no date for one of the two models.
  const nudge = self.VD_MODELS.checkNudge(saved, allModels, cfg.defaultModel,
                                          state.dismissedNudges, cfg.models);
  if (nudge.shouldNudge) {
    return { type: 'nudge', text: `Newer model available: ${nudge.newer.label}`, newerId: nudge.newer.id };
  }
  return null;
}

async function refreshLiveModelsForCurrentProvider() {
  const provider = state.provider;
  const cfg = PROVIDERS[provider];
  if (!cfg || !cfg.models.length) return;
  if (typeof self === 'undefined' || !self.VD_MODELS) return;
  const apiKey = state.apiKeys[provider];
  try {
    const merged = await self.VD_MODELS.getMergedModels(provider, apiKey, cfg.models);
    const before = JSON.stringify(state.liveModels[provider] || null);
    state.liveModels[provider] = merged;
    // Only redraw when the list actually moved. A redraw on every refresh is
    // wasted work at best, and — since a redraw can start a refresh — a loop
    // at worst.
    if (state.tab === 'settings' && JSON.stringify(merged) !== before) renderPanel();
  } catch (e) { console.warn('[vd-models] live refresh failed', e); }
}

// ── SESSION STATUS (v3.0) ─────────────────────────────────────────────────
// A plain-language line in Settings showing whether token refresh is actually
// working, so nobody has to open DevTools to find out. Driven by the record
// the service worker writes to chrome.storage.local on every refresh attempt.
let _vdSessionStatusTimer = null;

function _vdFormatAgo(ms) {
  if (!(ms >= 0)) return 'just now';
  const min = Math.round(ms / 60000);
  if (min < 1) return 'just now';
  if (min === 1) return '1 min ago';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h === 1 ? '1 hour ago' : `${h} hours ago`;
}

function _vdFormatIn(ms) {
  const min = Math.round(ms / 60000);
  if (min < 1) return 'in under a minute';
  if (min === 1) return 'in ~1 min';
  if (min < 60) return `in ~${min} min`;
  const h = Math.round(min / 60);
  return h === 1 ? 'in ~1 hour' : `in ~${h} hours`;
}

async function renderSessionStatus() {
  const el = $('vdSessionStatus');
  if (!el) return;
  const hide = () => { el.style.display = 'none'; el.textContent = ''; };
  try {
    const auth = self.VD_AUTH;
    if (!auth || typeof auth.peekSession !== 'function') return hide();
    const sess = await auth.peekSession();
    // Signed out: there is no session to report on.
    if (!sess || !sess.access_token) return hide();

    const status = (typeof auth.getRefreshStatus === 'function')
      ? await auth.getRefreshStatus()
      : null;

    // The worker renews once the token drops inside the leeway window, so
    // that boundary — not the expiry itself — is when the next one is due.
    const cfg = self.VD_CONFIG || {};
    const leeway = cfg.REFRESH_LEEWAY_MS || (10 * 60 * 1000);
    const expiresMs = sess.expires_at ? sess.expires_at * 1000 : null;
    const nextDueMs = expiresMs != null ? (expiresMs - leeway) - Date.now() : null;

    const parts = [];
    if (!status || !status.at) {
      parts.push('Session: active');           // nothing refreshed yet this install
    } else if (status.ok === false) {
      // Never call a failed attempt "refreshed" — the detail line below says why.
      parts.push(`Session: refresh failed ${_vdFormatAgo(Date.now() - status.at)}`);
    } else {
      parts.push(`Session: refreshed ${_vdFormatAgo(Date.now() - status.at)}`);
    }
    if (nextDueMs != null) {
      parts.push(nextDueMs <= 0 ? 'next: due now' : `next ${_vdFormatIn(nextDueMs)}`);
    }

    el.style.display = 'block';
    el.textContent = parts.join(' · ');

    // Surface a failed refresh in words, not a console stack trace.
    if (status && status.ok === false && status.error) {
      const warn = document.createElement('div');
      warn.className = 'settings-session-status__error';
      warn.textContent = `Last refresh failed: ${status.error}`;
      el.appendChild(warn);
    }
  } catch (e) {
    console.warn('[vd-auth-ui] session status render failed', e);
    hide();
  }
}

// Re-renders while Settings is open so "3 min ago" doesn't go stale. The tick
// is a no-op whenever the panel is hidden.
function startSessionStatusTicker() {
  renderSessionStatus();
  if (_vdSessionStatusTimer != null) return;
  _vdSessionStatusTimer = setInterval(() => {
    try {
      // Only tick while Settings is actually on screen — the status line
      // lives there now, and there is nothing to update anywhere else.
      if (state.tab !== 'settings') return;
      renderSessionStatus();
    } catch (_) { /* noop */ }
  }, 30000);
}

// ── HISTORY STORAGE ───────────────────────────────────────────────────────
async function savePrompt(url, prompt, source, platform, focus) {
  const domain = safeHostname(url);
  const key = domain;
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  let history = stored[HISTORY_KEY] || {};

  history[key] = {
    domain, url, prompt, source, platform,
    focus: focus || 'all',
    provider: state.provider !== 'none' ? state.provider : null,
    savedAt: Date.now(),
  };

  const entries = Object.entries(history).sort(([,a],[,b]) => b.savedAt - a.savedAt);
  if (entries.length > MAX_HISTORY) {
    history = Object.fromEntries(entries.slice(0, MAX_HISTORY));
  }

  await chrome.storage.local.set({ [HISTORY_KEY]: history });

  // v2.0.0-beta.2 — increment anonymous usage meter after successful save,
  // then re-render the counter text AND re-sync the Analyze button disabled
  // state so the displayed UI matches the just-persisted state. All three
  // calls must run together — previously only the increment happened here,
  // leaving the counter text stale until the next sidepanel open (the
  // button was getting updated through a different code path, producing a
  // visible desync between "1 left" text and a disabled button).
  //
  // Authed users are no-op'd inside VD_USAGE.incrementUsage. The count and
  // the screen are refreshed together — the old split let the counter text go
  // stale while the button had already changed, which read as a bug.
  try {
    if (self.VD_USAGE && typeof self.VD_USAGE.incrementUsage === 'function') {
      await self.VD_USAGE.incrementUsage();
    }
    await refreshUsage();
    renderPanel();
  } catch (e) { console.warn('[vd-usage] post-save refresh failed', e); }
}

async function loadHistory() {
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  const history = stored[HISTORY_KEY] || {};
  return Object.values(history).sort((a,b) => b.savedAt - a.savedAt);
}

async function deleteHistoryItem(key) {
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  const history = stored[HISTORY_KEY] || {};
  delete history[key];
  await chrome.storage.local.set({ [HISTORY_KEY]: history });
}

async function clearHistory() {
  await chrome.storage.local.set({ [HISTORY_KEY]: {} });
}

// ── SETTINGS UI ───────────────────────────────────────────────────────────
async function selectModel(modelId) {
  const provider = state.provider;
  state.selectedModels[provider] = modelId;
  const picked = getModelsForProvider(provider).find(m => m.id === modelId);
  if (picked) state.savedModelLabels[provider] = { id: modelId, label: picked.label };
  await chrome.storage.local.set({
    selectedModels: state.selectedModels,
    savedModelLabels: state.savedModelLabels,
  });
  if (state.tab === 'settings') renderPanel();
}

// Silences the "newer model available" nudge for one model id, for good.
async function dismissModelNudge(modelId) {
  state.dismissedNudges[modelId] = true;
  if (typeof self !== 'undefined' && self.VD_MODELS) {
    try { await self.VD_MODELS.dismissNudge(modelId); }
    catch (e) { console.warn('[vd-models] could not persist nudge dismissal', e); }
  }
  if (state.tab === 'settings') renderPanel();
}

async function saveApiKey() {
  const input = $('apiKeyInput');
  const btn = $('saveApiKey');
  if (!input || !btn) return;
  const key = input.value.trim();
  state.apiKeys[state.provider] = key;
  await chrome.storage.local.set({ provider: state.provider, apiKeys: state.apiKeys });
  btn.textContent = '✓';
  setTimeout(() => {
    if (btn && document.contains(btn)) btn.textContent = 'Save';
  }, 1500);
  if (state.tab === 'settings') renderPanel();
  if (key) refreshLiveModelsForCurrentProvider();
}

async function setProvider(provider) {
  state.provider = provider;
  await chrome.storage.local.set({ provider });
  if (state.tab === 'settings') renderPanel();
  refreshLiveModelsForCurrentProvider();
}

// ── HISTORY UI ────────────────────────────────────────────────────────────
// v2.0.0-beta.2: renderHistory now dispatches. Authed users see cloud
// history via Supabase; anon users see the existing local history.
// _renderLocalHistory preserves the pre-beta.2 behavior verbatim.
async function renderHistory() {
  const list = $('historyList');
  if (!list) return;
  let authed = false;
  try {
    if (self.VD_AUTH && typeof self.VD_AUTH.isAuthenticated === 'function') {
      authed = !!(await self.VD_AUTH.isAuthenticated());
    }
  } catch (_) { /* treat as anon on error */ }
  if (authed && self.VD_CLOUD && typeof self.VD_CLOUD.fetchRecentAnalyses === 'function') {
    return _renderCloudHistory(list);
  }
  return _renderLocalHistory(list);
}

async function _renderLocalHistory(list) {
  const items = await loadHistory();

  if (items.length === 0) {
    list.innerHTML = '<p class="empty-state">No saved prompts yet.</p>';
    return;
  }

  list.innerHTML = '';
  items.slice(0, MAX_HISTORY).forEach(item => {
    const el = document.createElement('div');
    el.className = 'history-item';
    el.dataset.domain = item.domain;

    const timeStr = formatRelativeTime(item.savedAt);
    const sourceIcon = SOURCE_ICONS[item.source] || '◫';
    const providerCfg = item.provider ? PROVIDERS[item.provider] : null;
    const itemKey = `${item.domain}::${item.focus || 'all'}`;

    // Build history item using DOM API instead of innerHTML for safety
    const iconSpan = document.createElement('span');
    iconSpan.className = 'history-item-icon';
    iconSpan.textContent = sourceIcon;

    const body = document.createElement('div');
    body.className = 'history-item-body';

    const domainDiv = document.createElement('div');
    domainDiv.className = 'history-item-domain';
    domainDiv.textContent = item.domain;
    body.appendChild(domainDiv);

    const metaDiv = document.createElement('div');
    metaDiv.className = 'history-item-meta';

    const timeSpan = document.createElement('span');
    timeSpan.textContent = timeStr;
    metaDiv.appendChild(timeSpan);

    if (item.focus && item.focus !== 'all') {
      const focusSpan = document.createElement('span');
      focusSpan.className = 'history-focus-badge';
      focusSpan.textContent = item.focus;
      metaDiv.appendChild(focusSpan);
    }

    if (item.platform && item.platform !== 'generic') {
      const platSpan = document.createElement('span');
      platSpan.className = 'platform-badge';
      platSpan.textContent = item.platform;
      metaDiv.appendChild(platSpan);
    }

    if (providerCfg) {
      const provSpan = document.createElement('span');
      provSpan.className = 'history-provider';
      const dot = document.createElement('span');
      dot.className = 'history-provider-dot';
      dot.style.background = providerCfg.color;
      provSpan.appendChild(dot);
      provSpan.appendChild(document.createTextNode(providerCfg.name));
      metaDiv.appendChild(provSpan);
    }

    body.appendChild(metaDiv);

    const delBtn = document.createElement('button');
    delBtn.className = 'history-item-delete';
    delBtn.dataset.key = itemKey;
    delBtn.title = 'Delete';
    delBtn.setAttribute('aria-label', `Delete prompt for ${item.domain}`);
    delBtn.textContent = '✕';

    el.appendChild(iconSpan);
    el.appendChild(body);
    el.appendChild(delBtn);

    el.addEventListener('click', e => {
      if (e.target.classList.contains('history-item-delete')) return;
      restorePrompt(item);
    });

    delBtn.addEventListener('click', async e => {
      e.stopPropagation();
      await deleteHistoryItem(itemKey);
      el.style.opacity = '0';
      el.style.transform = 'translateX(8px)';
      el.style.transition = 'all 0.2s ease';
      setTimeout(() => {
        el.remove();
        if (!list.children.length) list.innerHTML = '<p class="empty-state">No saved prompts yet.</p>';
      }, 200);
    });

    list.appendChild(el);
  });
}

function restorePrompt(item) {
  state.lastPrompt = item.prompt;
  closeSheet('vdHistorySheet');
  // Focus is part of what was saved, so restoring an entry restores the shape
  // of the prompt too. The chips redraw with the panel; no DOM poking needed.
  if (item.focus) state.focus = item.focus;
  showResult(item.prompt, { url: item.url || `https://${item.domain}` },
             item.source, item.provider, true);
}

// A Recent row on Home carries the storage key it came from.
async function restoreByKey(key) {
  try {
    const history = await loadHistory();
    const item = history[key];
    if (item) restorePrompt(item);
  } catch (e) { console.warn('[vd-ui] could not restore', e); }
}

function formatRelativeTime(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  const hour = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  if (hour < 24) return `${hour}h ago`;
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString('en-GB', { day:'numeric', month:'short' });
}

// ── CONTENT MODE / FOCUS ──────────────────────────────────────────────────
function setContentMode(m) {
  state.contentMode = m;
  document.querySelectorAll('[data-content]').forEach(c => c.classList.toggle('active', c.dataset.content === m));
  const input = $('customContentInput');
  if (input) {
    input.style.display = m === 'custom' ? 'block' : 'none';
    if (m === 'custom') input.focus();
  }
}

function setFocus(f) {
  state.focus = f;
  chrome.storage.local.set({ savedFocus: f });
  if (state.lastAnalyzedData) {
    state.lastPrompt = buildPagePrompt(state.lastAnalyzedData, state.lastAiDirection);
    const out = $('promptOutput');
    if (out) out.textContent = state.lastPrompt;
  }
  // §4.2: the Export meta line reflects the focus, so it re-renders with it.
  renderPanel();
}

function setMode(mode) {
  state.mode = mode;
  resetView();
}

// Kept as a named function because popup.js wraps it for the picker hint.
function updateAnalyzeBtn() { renderPanel(); }

// ── SITE ACCESS (optional_host_permissions) ─────────────────────────────
// The extension ships with access to nothing but its own four API hosts.
// Reading a page is asked for when the user asks for it, one origin at a
// time — so installing shows no "read and change all your data on all
// websites" warning.

// "https://github.com/foo/bar?x=1" → "https://github.com/*"
// Returns null for anything that cannot be granted (chrome://, about:,
// file:// without the file-access flag) — those are refused by the browser,
// not by us, and the caller reports that separately.
function originPattern(url) {
  try {
    const u = new URL(String(url));
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return `${u.protocol}//${u.hostname}/*`;
  } catch (e) { return null; }
}

// Runs `fn` once the current page's origin is granted.
//
// MUST be called synchronously from a click handler. chrome.permissions
// .request resolves immediately without a prompt when the origin is already
// granted, so this is cheap on every run after the first.
function withOriginAccess(fn) {
  const pattern = originPattern(state.currentUrl);
  if (!pattern) { fn(); return; }        // not a page we could ask about
  try {
    chrome.permissions.request({ origins: [pattern] }, granted => {
      if (chrome.runtime.lastError) {
        console.warn('[vd-perm] request failed', chrome.runtime.lastError.message);
        return showPermissionNotice();
      }
      if (granted) { state.siteAccess = true; fn(); }
      else { state.siteAccess = false; showPermissionNotice(); }
    });
  } catch (e) {
    // An older browser, or a surface where the API is absent: fall through
    // rather than making the button do nothing.
    console.warn('[vd-perm] permissions API unavailable', e);
    fn();
  }
}

// §4.5: a refusal is a state with a way forward, not an error.
function showPermissionNotice() {
  const domain = state.currentUrl ? safeHostname(state.currentUrl) : 'this page';
  state.permissionNeeded = domain;
  setSurface('panel');
  renderPanel();
}

// The Settings toggle: grant every site once, instead of per site.
function setAllSitesAccess(on) {
  if (!on) {
    chrome.permissions.remove({ origins: ['<all_urls>'] }, () => {
      state.allSites = false;
      renderPanel();
    });
    return;
  }
  chrome.permissions.request({ origins: ['<all_urls>'] }, granted => {
    state.allSites = !!granted;
    if (granted) state.permissionNeeded = null;
    renderPanel();
  });
}

async function refreshSiteAccess() {
  try {
    const all = await new Promise(res =>
      chrome.permissions.contains({ origins: ['<all_urls>'] }, res));
    state.allSites = !!all;
  } catch (e) { state.allSites = false; }
}

// ── PICKER HELPERS ────────────────────────────────────────────────────────
async function activateElementPicker(tabId) {
  await injectPickerScript(tabId);
  await chrome.tabs.sendMessage(tabId, { type: 'ACTIVATE_PICKER' });
  state.pickerActive = true;
  updateAnalyzeBtn();
}

async function deactivateElementPicker(tabId) {
  await chrome.tabs.sendMessage(tabId, { type: 'DEACTIVATE_PICKER' });
  state.pickerActive = false;
  updateAnalyzeBtn();
}

// ── MAIN FLOW ─────────────────────────────────────────────────────────────
async function handleAnalyze() {
  // v2.0.0-beta.2 usage cap — defense-in-depth alongside the disabled
  // button gate. If storage/meter is broken we fail open (canGenerate
  // returns true) so a buggy meter can't brick the extension.
  // §4.5: at the cap there is no Analyze button to press — the panel offers
  // "Sign in for unlimited" instead. This is the defence behind that, for the
  // keyboard shortcut and any path that bypasses the button. It re-renders
  // rather than showing an error: an error screen with a "Try again" would
  // send the user round the same wall, and would hide the result they already
  // have. Everything else on the panel keeps working.
  try {
    if (self.VD_USAGE && typeof self.VD_USAGE.canGenerate === 'function') {
      const allowed = await self.VD_USAGE.canGenerate();
      if (!allowed) {
        await refreshUsage();
        setSurface('panel');
        renderPanel();
        return;
      }
    }
  } catch (_) { /* fail open — a broken meter must not lock anyone out */ }

  const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
  state.currentUrl = tab?.url || '';

  // Element picker mode
  if (state.mode === 'element') {
    try {
      if (state.pickerActive) {
        await deactivateElementPicker(tab.id);
      } else {
        await activateElementPicker(tab.id);
      }
    } catch(err) { showError('Could not activate picker. Refresh and try again.'); }
    return;
  }

  // §4.5: a page that has not finished loading yields a capture with almost
  // nothing in it, and the panel then reports "very little design data" about
  // a site that is full of it. That is what happened on rig.ai. So the page is
  // asked whether it is ready BEFORE anything is measured, and an unready page
  // is told to try again rather than measured badly.
  const readiness = await pageReadiness(tab.id);
  if (readiness === 'loading') { showError(VD_UI.COPY.stillLoading); return; }

  state.cancelled = false;
  try {
    showStage(0);
    await injectContentScript(tab.id);
    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PAGE' });
    if (state.cancelled) return;
    if (!resp?.success) throw new Error(VD_UI.COPY.unreadable);
    showStage(5);
    state.resultUrl = tab.url || state.currentUrl;
    buildPromptFromData(resp.data, 'page');
  } catch (err) {
    // A page that blocks extensions is the common case here, and it is not
    // the user's mistake — say what to try instead.
    showError(VD_UI.COPY.unreadable);
    console.warn('[vd-ui] analyze failed', err);
  }
}

// 'ready' | 'loading' | 'unknown'.
//
// document.readyState alone is not enough: "complete" fires before a
// framework has painted, and the extractor reads computed styles. So a
// settle delay follows, and the check is repeated. `unknown` (a page that
// will not run the probe) proceeds — refusing to analyse there would be worse
// than trying.
const SETTLE_MS = 400;

async function pageReadiness(tabId) {
  const probe = async () => {
    try {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => ({ ready: document.readyState, body: !!document.body }),
      });
      return res && res.result ? res.result : null;
    } catch (e) { return null; }
  };

  const first = await probe();
  if (!first) return 'unknown';
  if (first.ready === 'loading' || !first.body) return 'loading';

  await new Promise(r => setTimeout(r, SETTLE_MS));
  const second = await probe();
  if (!second) return 'unknown';
  return (second.ready === 'loading' || !second.body) ? 'loading' : 'ready';
}

async function injectContentScript(tabId) {
  try {
    // color-utils.js + noise-filter.js + shadow-utils.js must load before content.js
    // (they expose helpers via window.__vibeDesign that content.js destructures)
    await chrome.scripting.executeScript({ target: { tabId }, files: ['lib/color-utils.js'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['lib/noise-filter.js'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['lib/shadow-utils.js'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  } catch(e) {
    console.debug('[VibeDesign] Script injection:', e.message);
  }
}

async function injectPickerScript(tabId) {
  await injectContentScript(tabId);
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['lib/picker.js'] });
  } catch(e) {
    console.debug('[VibeDesign] Picker injection:', e.message);
  }
}

async function injectAndSend(tabId, msg) {
  await injectContentScript(tabId);
  return chrome.tabs.sendMessage(tabId, msg);
}

// ── UI DISPLAY ────────────────────────────────────────────────────────────
const LOADING_SECTION_HTML = `
  <div class="loading-animation">
    <div class="loading-bar"></div>
    <div class="loading-bar"></div>
    <div class="loading-bar"></div>
  </div>
  <p class="loading-text" id="loadingText">Analyzing…</p>
`;

// ── STATES (§4.5) ───────────────────────────────────────────────────────
// The panel is either showing a tab, or showing one of these. They are
// mutually exclusive, which is why they share one setter.

// §4.5: the analyze button becomes the progress bar. Named stages, so
// "nothing is happening" and "reading motion" look different.
const ANALYZE_STAGES = ['Reading', 'Colors', 'Type', 'Components', 'Motion', 'Building',
                        'Generating direction'];

function setSurface(which) {
  const panel = $('vdPanel'), loading = $('loadingSection'), error = $('errorSection');
  if (panel) panel.style.display = which === 'panel' ? '' : 'none';
  if (loading) loading.style.display = which === 'loading' ? 'flex' : 'none';
  if (error) error.style.display = which === 'error' ? 'flex' : 'none';
}

function showLoading(text) {
  setSurface('loading');
  const lt = $('loadingText');
  if (lt) lt.textContent = text || 'Analyzing…';
}

// Advances the named-stage progress. Called by the analyze flow.
// §4.5: the stage NAME and nothing else. The previous build passed the AI's
// streaming output straight into this line, so the status area filled with raw
// markdown mid-generation. Content never reaches here — only an index.
function showStage(index) {
  const n = Math.max(0, Math.min(ANALYZE_STAGES.length - 1, index));
  showLoading(`${ANALYZE_STAGES[n]}… ${n + 1}/${ANALYZE_STAGES.length}`);
  const fill = $('vdProgressFill');
  if (fill) fill.style.width = Math.round(((n + 1) / ANALYZE_STAGES.length) * 100) + '%';
  // §3: the same AI line as Overview, so it is clear what is doing the work.
  const who = $('vdLoadingAi');
  if (who) {
    const o = viewOptions();
    who.textContent = o.aiEnabled
      ? `AI enhancement: ${[o.aiProvider, o.aiModel].filter(Boolean).join(' · ')}`
      : 'AI enhancement off';
  }
}

function showError(msg) {
  setSurface('error');
  const el = $('errorText');
  if (el) el.textContent = msg || VD_UI.COPY.unreadable;
}

// Called once an analysis completes. The prompt text is no longer the screen —
// it is one output among three, behind Preview (§1.3).
function showResult(prompt, data, source, providerUsed, isRestored = false) {
  state.lastPrompt = prompt || '';
  if (data && !state.lastAnalyzedData) state.lastAnalyzedData = data;
  // Which page this result describes. §3 needs it to tell "the page you are
  // looking at" from "the page you analysed", and the two drift the moment the
  // user changes tab.
  const from = (data && data.url) || (state.lastAnalyzedData && state.lastAnalyzedData.url);
  if (from) state.resultUrl = from;
  else if (!state.resultUrl) state.resultUrl = state.currentUrl;
  state.analyzedAt = Date.now();
  state.permissionNeeded = null;
  state.aiSkipped = !providerUsed && state.aiEnabled;
  refreshModel();
  const out = $('promptOutput');
  if (out) out.textContent = state.lastPrompt;
  if (state.tab === 'settings') state.tab = 'overview';
  setSurface('panel');
  renderPanel();
  if (!isRestored) flashSaveIndicator();
}

// The save confirmation is a transient line now, not a permanent strip.
function flashSaveIndicator() { showNotice('Saved'); }

function resetView() {
  state.lastPrompt = '';
  state.lastAiDirection = null;
  state.lastAnalyzedData = null;
  state.model = null;
  state.analyzedAt = null;
  state.resultUrl = null;
  state.aiSkipped = false;
  state.tab = 'overview';
  setSurface('panel');
  renderPanel();
}

// ── EXPORT (§4.2) ───────────────────────────────────────────────────────
// One primary button. What it does follows the Output segmented control.

function setOutput(output) {
  if (!VD_UI.OUTPUTS.some(o => o.value === output)) return;
  state.output = output;
  chrome.storage.local.set({ vd_output: output });
  renderPanel();
}

function setTarget(target) {
  state.target = target;
  chrome.storage.local.set({ vd_target: target });
  renderPanel();
}

function buildBundle() {
  if (!state.model || !self.VD_SKILL) return null;
  let version = 'dev';
  try { version = chrome.runtime.getManifest().version; } catch (e) { /* keep dev */ }
  try {
    return self.VD_SKILL.buildSkillBundle(state.model, {
      sourceUrl: state.lastAnalyzedData.url || state.currentUrl || '',
      version: version,
      observedAt: new Date().toISOString().slice(0, 10),
    });
  } catch (e) {
    console.warn('[vd-ui] skill bundle failed', e);
    return null;
  }
}

function runExport() {
  if (!state.model) return;
  if (state.output === 'prompt') return copyPrompt();
  if (state.output === 'design-md') return downloadDesignMd();
  return downloadSkillBundle();
}

function copyPrompt() {
  if (!state.lastPrompt) return;
  copyToClipboard(state.lastPrompt);
  flashButton('vdExportBtn', 'Copied');
}

// ── DEV TOOLS (unpacked builds only) ──────────────────────────────────────
// A packaged Web Store build has an update_url in its manifest; an unpacked
// one does not. These buttons exist so DESIGN.md can be exercised on real
// sites before the real UI ships, and so real token bundles can be captured
// as test fixtures. They never render for end users.
function isUnpackedBuild() {
  try {
    return !chrome.runtime.getManifest().update_url;
  } catch (e) {
    return false;
  }
}

// Builds the DESIGN.md, or null when the data/builder isn't ready.
function buildDesignMdDoc() {
  if (!state.lastAnalyzedData) return null;
  if (!self.VD_DESIGN_MD || typeof self.VD_DESIGN_MD.buildDesignMd !== 'function') {
    console.warn('[vd-dev] design-md-builder not loaded');
    return null;
  }
  let version = 'dev';
  try { version = chrome.runtime.getManifest().version; } catch (e) { /* keep dev */ }
  return self.VD_DESIGN_MD.buildDesignMd(state.lastAnalyzedData, {
    sourceUrl: state.lastAnalyzedData.url || state.currentUrl || '',
    scope: 'page',
    version: version,
    observedAt: new Date().toISOString().slice(0, 10),
  });
}

function downloadDesignMd() {
  const md = buildDesignMdDoc();
  if (!md) return;
  if (!self.VD_DOWNLOAD || typeof self.VD_DOWNLOAD.downloadText !== 'function') {
    console.warn('[vd-ui] download helper not loaded');
    return;
  }
  const sourceUrl = (state.lastAnalyzedData && state.lastAnalyzedData.url) || state.currentUrl || '';
  const name = self.VD_DOWNLOAD.designMdFilename(sourceUrl);
  if (self.VD_DOWNLOAD.downloadText(md, name)) flashButton('vdExportBtn', 'Saved');
}

// Builds the skill bundle zip and hands it to the browser. Available to all
// users, alongside Copy prompt and Download DESIGN.md.
function downloadSkillBundle() {
  if (!state.lastAnalyzedData) return;
  const missing = ['VD_MODEL', 'VD_SKILL', 'VD_ZIP', 'VD_DOWNLOAD'].filter(k => !self[k]);
  if (missing.length) {
    console.warn('[vd-ui] skill bundle unavailable, not loaded:', missing.join(', '));
    flashButton('vdExportBtn', 'Unavailable');
    return;
  }
  try {
    // The panel already built this model; rebuilding it here would be a second
    // derivation of the same capture and a chance for the two to disagree.
    const bundle = buildBundle();
    if (!bundle) { flashButton('vdExportBtn', 'Failed'); return; }
    const bytes = self.VD_SKILL.zipSkillBundle(bundle, self.VD_ZIP);
    if (!bytes) { flashButton('vdExportBtn', 'Failed'); return; }
    const ok = self.VD_DOWNLOAD.downloadBytes(bytes, bundle.slug + '.zip', 'application/zip');
    flashButton('vdExportBtn', ok ? 'Saved' : 'Failed');
  } catch (e) {
    // A broken export must not take the result panel down with it.
    console.warn('[vd-ui] skill bundle failed', e);
    flashButton('vdExportBtn', 'Failed');
  }
}

// Brief confirmation on a button, restoring its original label.
function flashButton(id, text) {
  const btn = $(id);
  if (!btn) return;
  const label = btn.querySelector('.btn-label') || btn;
  const original = label.textContent;
  label.textContent = text;
  setTimeout(() => { if (document.contains(label)) label.textContent = original; }, 1800);
}

function copyRawTokens() {
  if (!state.lastAnalyzedData) return;
  const json = JSON.stringify(state.lastAnalyzedData, null, 2);
  copyToClipboard(json);
  flashButton('devTokensJsonBtn', `✓ ${(json.length / 1000).toFixed(1)}k chars`);
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  });
}

// ── LISTENERS ─────────────────────────────────────────────────────────────
// ── LISTENERS ───────────────────────────────────────────────────────────
// The panel re-renders on every state change, so per-element listeners would
// be re-attached (or lost) constantly. Everything inside the panel is handled
// by ONE delegated click listener on a container that never gets replaced.

function setupListeners() {
  const root = document.querySelector('.app') || document.body;

  root.addEventListener('click', onPanelClick);
  root.addEventListener('change', onPanelChange);

  // Fixed chrome — these nodes live outside the panel and survive re-renders.
  const bind = (id, evt, fn) => { const el = $(id); if (el) el.addEventListener(evt, fn); };
  bind('errorRetryBtn', 'click', handleAnalyze);
  bind('vdCancelAnalyze', 'click', () => { state.cancelled = true; resetView(); });
  bind('vdPreviewClose', 'click', () => closeSheet('vdPreviewSheet'));
  bind('vdPreviewCopy', 'click', () => { copyToClipboard(state.lastPrompt); showNotice('Copied'); });
  bind('vdHistoryClose', 'click', () => closeSheet('vdHistorySheet'));
  bind('clearHistoryBtn', 'click', clearHistory);
  bind('vdOpenPanel', 'click', openSidePanel);

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleAnalyze(); }
    if (e.key === 'Escape') { closeSheet('vdPreviewSheet'); closeSheet('vdHistorySheet'); }
  });

  // The worker announces a handoff from vibedesign.tech. The panel may well be
  // open while the user signs in on the site, and it should not need reopening
  // to notice.
  try {
    chrome.runtime.onMessage.addListener(msg => {
      if (msg && msg.type === 'VD_AUTH_CHANGED') refreshAccount();
    });
  } catch (e) { console.warn('[vd-ui] could not listen for auth changes', e); }

  if (_uiHooks.extraListeners) _uiHooks.extraListeners();
}

function onPanelClick(e) {
  const hit = sel => e.target.closest && e.target.closest(sel);

  const tab = hit('[data-tab]');
  if (tab) return setTab(tab.dataset.tab);

  const mode = hit('[data-mode]');
  if (mode) return setMode(mode.dataset.mode);

  const output = hit('[data-output]');
  if (output) return setOutput(output.dataset.output);

  const focus = hit('[data-focus]');
  if (focus) return setFocus(focus.dataset.focus);

  const restore = hit('[data-restore]');
  if (restore) return restoreByKey(restore.dataset.restore);

  // The origin is requested HERE, straight out of the click, because
  // chrome.permissions.request() only works inside a user gesture and the
  // gesture does not survive an await. handleAnalyze() is async, so asking
  // from inside it would silently fail with "may only be called during a
  // user gesture".
  const analyze = hit('#analyzeBtn');
  if (analyze) return withOriginAccess(handleAnalyze);

  const exportBtn = hit('#vdExportBtn');
  if (exportBtn) return runExport();

  if (hit('#saveApiKey')) return saveApiKey();
  if (hit('#vdChangeKey')) return clearApiKey();
  if (hit('#vdSignIn')) return signIn();
  if (hit('#vdSignOut')) return signOutAccount();

  const action = hit('[data-action]');
  if (!action) return;
  switch (action.dataset.action) {
    case 'previewRaw': return openSheet('vdPreviewSheet');
    case 'openSettings': return setTab('settings');
    case 'signIn': return signIn();
    case 'allowSite': return withOriginAccess(handleAnalyze);
    case 'openAccount': return setTab('settings');
    case 'openHistory': return openHistorySheet();
    case 'gotoExport': return gotoExport();
    case 'switchModel': return switchToNewestModel();
    case 'dismissNudge': return dismissCurrentNudge();
    default: return;
  }
}

function onPanelChange(e) {
  const id = e.target && e.target.id;
  if (id === 'vdAiToggle') return setAiEnabled(e.target.checked);
  if (id === 'vdAllSites') return setAllSitesAccess(e.target.checked);
  if (id === 'vdProviderSelect') return setProvider(e.target.value);
  if (id === 'vdModelSelect') return selectModel(e.target.value);
  if (id === 'vdTargetSelect') return setTarget(e.target.value);
  if (id === 'vdDefaultOutput') return setOutput(e.target.value);
  if (id === 'vdDefaultTarget') return setTarget(e.target.value);
}

// §4.2: each category tab's "Export ▸" goes back to the card on Overview.
function gotoExport() {
  state.tab = 'overview';
  renderPanel();
  const card = $('vdExportCard');
  if (card && card.scrollIntoView) card.scrollIntoView({ block: 'center' });
}

function openSheet(id) { const el = $(id); if (el) el.hidden = false; }
function closeSheet(id) { const el = $(id); if (el) el.hidden = true; }

async function openHistorySheet() {
  openSheet('vdHistorySheet');
  try { await renderHistory(); } catch (e) { console.warn('[vd-ui] history failed', e); }
}

// "Change" forgets the stored key so the input comes back. It does not reveal
// the old one: a key that can be read off the screen is a key that can be read
// over a shoulder, and there is never a reason to show it again.
async function clearApiKey() {
  delete state.apiKeys[state.provider];
  await chrome.storage.local.set({ apiKeys: state.apiKeys });
  renderPanel();
  const input = $('apiKeyInput');
  if (input) input.focus();
}

async function setAiEnabled(on) {
  state.aiEnabled = !!on;
  if (!on) state.provider = 'none';
  else if (state.provider === 'none') state.provider = 'gemini';
  await chrome.storage.local.set({ vd_ai_enabled: state.aiEnabled, provider: state.provider });
  renderPanel();
}

function switchToNewestModel() {
  const notice = computeModelNotice(state.provider);
  if (notice && notice.newerId) selectModel(notice.newerId);
}

function dismissCurrentNudge() {
  const notice = computeModelNotice(state.provider);
  if (notice && notice.newerId) dismissModelNudge(notice.newerId);
}

// Opens the side panel from the popup and closes the popup behind it (§3).
async function openSidePanel() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (chrome.sidePanel && tab) await chrome.sidePanel.open({ tabId: tab.id });
    window.close();
  } catch (e) {
    console.warn('[vd-ui] could not open the side panel', e);
  }
}

// ── SHELL TEMPLATES ─────────────────────────────────────────────────────
// §3: a fixed header, one scrolling content area, a sticky bottom tab bar.
//
// The content area holds ONE panel whose innerHTML is replaced when the tab
// changes, rather than six panels toggled by display. Six panels means five
// stale DOM trees holding old model data; one panel cannot go stale.
const APP_TEMPLATE = `
  <header class="vd-header">
    <div class="vd-header__top">
      <img src="icons/wordmark.png" alt="VibeDesign" class="vd-header__logo" width="254" height="48" />
      <div class="vd-header__account" id="vdAccountSlot"></div>
    </div>
    <div class="vd-header__status" id="urlBadge"></div>
  </header>

  <main class="vd-main" id="vdMain">
    <div class="vd-panel" id="vdPanel" role="tabpanel"></div>

    <div class="vd-state" id="loadingSection" style="display:none" role="status" aria-live="polite">
      <div class="vd-progress"><div class="vd-progress__fill" id="vdProgressFill"></div></div>
      <p class="vd-state__text" id="loadingText">Analyzing…</p>
      <p class="vd-ai" id="vdLoadingAi"></p>
      <button class="vd-link" id="vdCancelAnalyze">Cancel</button>
    </div>

    <div class="vd-state" id="errorSection" style="display:none" role="alert">
      <p class="vd-state__text" id="errorText"></p>
      <button class="vd-btn vd-btn--ghost" id="errorRetryBtn"><span class="vd-btn__label">Try again</span></button>
    </div>
  </main>

  <nav class="vd-tabbar-slot" id="vdTabBar"></nav>

  <div class="vd-sheet" id="vdPreviewSheet" hidden role="dialog" aria-modal="true" aria-label="Preview raw output">
    <div class="vd-sheet__head">
      <h2 class="vd-sheet__title">Preview</h2>
      <button class="vd-sheet__action" id="vdPreviewCopy">Copy</button>
      <button class="vd-sheet__close" id="vdPreviewClose" aria-label="Close">×</button>
    </div>
    <div class="vd-sheet__body"><pre class="vd-pre" id="promptOutput" tabindex="0" aria-label="Raw output"></pre></div>
  </div>

  <div class="vd-sheet" id="vdHistorySheet" hidden role="dialog" aria-modal="true" aria-label="History">
    <div class="vd-sheet__head">
      <h2 class="vd-sheet__title">History</h2>
      <button class="vd-sheet__action" id="clearHistoryBtn">Clear</button>
      <button class="vd-sheet__close" id="vdHistoryClose" aria-label="Close">×</button>
    </div>
    <div class="vd-sheet__body" id="historyList" role="list"></div>
  </div>
`;

// The popup is the short form of Overview (§3): header, mode, Analyze, and a
// way into the side panel. No tab bar — the popup is not somewhere you
// navigate, it is somewhere you start.
const POPUP_TEMPLATE = `
  <header class="vd-header">
    <div class="vd-header__top">
      <img src="icons/wordmark.png" alt="VibeDesign" class="vd-header__logo" width="254" height="48" />
      <div class="vd-header__account" id="vdAccountSlot"></div>
    </div>
    <div class="vd-header__status" id="urlBadge"></div>
  </header>
  <main class="vd-main vd-main--popup" id="vdMain">
    <div class="vd-panel" id="vdPanel"></div>
    <div class="vd-state" id="loadingSection" style="display:none" role="status" aria-live="polite">
      <div class="vd-progress"><div class="vd-progress__fill" id="vdProgressFill"></div></div>
      <p class="vd-state__text" id="loadingText">Analyzing…</p>
      <p class="vd-ai" id="vdLoadingAi"></p>
      <button class="vd-link" id="vdCancelAnalyze">Cancel</button>
    </div>
    <div class="vd-state" id="errorSection" style="display:none" role="alert">
      <p class="vd-state__text" id="errorText"></p>
      <button class="vd-btn vd-btn--ghost" id="errorRetryBtn"><span class="vd-btn__label">Try again</span></button>
    </div>
    <button class="vd-link vd-link--block" id="vdOpenPanel">Open side panel</button>
  </main>
  <div class="vd-sheet" id="vdPreviewSheet" hidden aria-label="Preview raw output">
    <div class="vd-sheet__body"><pre class="vd-pre" id="promptOutput"></pre></div>
  </div>
`;

// ── TABS AND PANELS (§3) ────────────────────────────────────────────────
// One navigation level. `state.tab` is the only thing that decides what the
// content area holds, and renderPanel() is the only thing that writes it.

const CATEGORY_TABS = ['colors', 'type', 'components', 'motion'];

// A category tab is only meaningful once there is a model to list.
function analysisReady() { return !!state.model; }

function setTab(tab) {
  if (CATEGORY_TABS.indexOf(tab) !== -1 && !analysisReady()) {
    showNotice(VD_UI.COPY.analyzeFirst);
    return;
  }
  const entering = state.tab !== tab;
  state.tab = tab;
  renderPanel();
  // The async parts of Settings — the auth pill, the session line, the live
  // model list — run when the tab is ENTERED, not on every re-render.
  // Re-running them per render is an infinite loop: the model refresh
  // re-renders, which would mount, which would refresh again.
  if (entering && tab === 'settings') mountSettingsAsync();
}

// A transient line above the tab bar. Not an alert() and not a state — it
// says one thing and goes away.
let _noticeTimer = null;
function showNotice(text) {
  const main = $('vdMain');
  if (!main) return;
  let el = $('vdTransientNotice');
  if (!el) {
    el = document.createElement('div');
    el.id = 'vdTransientNotice';
    main.appendChild(el);
  }
  el.className = 'vd-notice vd-notice--info vd-notice--floating';
  el.setAttribute('role', 'status');
  el.textContent = text;
  clearTimeout(_noticeTimer);
  _noticeTimer = setTimeout(() => { if (el && el.parentNode) el.remove(); }, 2600);
}

function renderTabBar() {
  const slot = $('vdTabBar');
  if (!slot) return;                      // popup has no tab bar
  slot.innerHTML = VD_UI.tabBar({ active: state.tab, ready: analysisReady() });
}

// ── page context (§3 "Sayfa bağlamı") ───────────────────────────────────
// A result belongs to a page, and the user can switch tabs out from under it.
// The header always describes the CURRENT tab; the result is never discarded.
//
//   'none'  no result at all
//   'same'  the result is for the page we are looking at
//   'other' there is a result, but for a different page

function pageContext() {
  if (!state.model) return 'none';
  const here = state.currentUrl ? safeHostname(state.currentUrl) : '';
  const from = state.resultUrl ? safeHostname(state.resultUrl) : '';
  if (!here || !from) return 'same';
  return here === from ? 'same' : 'other';
}

const shortTime = ts => new Date(ts || Date.now())
  .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// §3: the header is one row — wordmark, domain, status. Nothing above it and
// nothing below it, and the status describes THIS page, not the result.
function renderHeader() {
  const badge = $('urlBadge');
  if (!badge) return;
  const domain = state.currentUrl ? safeHostname(state.currentUrl) : '';
  const ctx = pageContext();
  const status = ctx === 'same' ? 'Analyzed ' + shortTime(state.analyzedAt) : 'Not analyzed';
  badge.innerHTML = domain
    ? `<span class="vd-header__domain">${VD_UI.esc(domain)}</span>`
      + `<span class="vd-header__state">${VD_UI.esc(status)}</span>`
    : `<span class="vd-header__state">${VD_UI.esc(status)}</span>`;

  // §3: the account control sits at the header's right edge in both surfaces.
  const slot = $('vdAccountSlot');
  if (slot) {
    const acct = state.account || { authed: false };
    slot.innerHTML = VD_UI.accountControl({
      authed: acct.authed, email: acct.email, avatarUrl: acct.avatarUrl,
    });
  }
}

// What the AI indicator and the Export card need to know about state, in one
// place so Home and Overview cannot disagree.
function viewOptions() {
  const ctx = pageContext();
  return {
    mode: state.mode, output: state.output, target: state.target, focus: state.focus,
    meta: exportMeta(), aiSkipped: state.aiSkipped, recent: state.recent || [],
    context: ctx,
    domain: state.currentUrl ? safeHostname(state.currentUrl) : '',
    resultDomain: state.resultUrl ? safeHostname(state.resultUrl) : '',
    resultTime: state.analyzedAt ? shortTime(state.analyzedAt) : '',
    permissionNeeded: state.permissionNeeded,
    aiEnabled: !!state.aiEnabled,
    aiProvider: state.aiEnabled && PROVIDERS[state.provider] ? PROVIDERS[state.provider].name : '',
    aiModel: state.aiEnabled ? getActiveModelLabel(state.provider) : '',
    authed: !!(state.account && state.account.authed),
    usage: state.usage,
  };
}

// Counts the headings in a generated document.
//
// The prompt uses `##` ONCE, for its title, and `###` for each of its real
// sections — so counting `##` alone reported "1 sections" for a 33k-character
// prompt with sixteen sections in it. Every heading level from h2 down counts,
// which gives 17 on rig for Focus=All, as the spec says.
function countSections(text) {
  return ((text || '').match(/^#{2,6} /gm) || []).length;
}

// The meta line under the Export button: what this output actually is.
function exportMeta() {
  if (!state.model) return '';
  if (state.output === 'prompt') {
    const text = state.lastPrompt || '';
    if (!text) return '';
    return `${countSections(text)} sections · ${(text.length / 1000).toFixed(1)}k chars`;
  }
  if (state.output === 'design-md') {
    const md = buildDesignMdDoc();
    if (!md) return '';
    return `${countSections(md)} sections · ${(md.length / 1000).toFixed(1)}k chars`;
  }
  const bundle = buildBundle();
  if (!bundle) return '';
  const bytes = bundle.files.reduce((n, f) => n + f.text.length, 0);
  return `${bundle.files.length} files · ${(bytes / 1000).toFixed(1)}k chars`;
}

function renderPanel() {
  const panel = $('vdPanel');
  if (!panel) return;
  const V = self.VD_VIEWS || (VD_UI && VD_UI.VD_VIEWS);
  const opts = viewOptions();

  if (state.tab === 'settings') {
    panel.innerHTML = renderSettingsPanel();
    afterSettingsRender();
  } else if (!state.model) {
    panel.innerHTML = V.homeView(opts);
  } else if (state.tab === 'overview') {
    panel.innerHTML = V.overviewView(state.model, opts);
  } else if (state.tab === 'colors') {
    panel.innerHTML = V.colorsView(state.model);
  } else if (state.tab === 'type') {
    panel.innerHTML = V.typeView(state.model);
  } else if (state.tab === 'components') {
    panel.innerHTML = V.componentsView(state.model);
  } else if (state.tab === 'motion') {
    panel.innerHTML = V.motionView(state.model);
  }

  renderTabBar();
  renderHeader();
}

// Rebuilds the design model from the last capture. Everything the panel shows
// comes from here, so a capture that cannot be modelled shows nothing rather
// than a half-populated screen.
function refreshModel() {
  state.model = null;
  if (!state.lastAnalyzedData) return;
  try {
    if (!self.VD_MODEL) return;
    state.model = self.VD_MODEL.buildDesignModel(state.lastAnalyzedData, {
      sourceUrl: state.lastAnalyzedData.url || state.currentUrl || '',
    });
  } catch (e) {
    console.warn('[vd-ui] could not build the design model', e);
  }
}

// ── SETTINGS TAB (§4.3) ─────────────────────────────────────────────────
// Settings is a TAB, not a sheet. Everything that used to sit in the main flow
// — provider, model, key, the model nudge, the Developer section, the version
// chip, history — lives here and only here.

function renderSettingsPanel() {
  const U = VD_UI;
  const parts = [U.tabTitle('Settings')];

  // Account is a row here, not a pill floating over the panel (§3). The
  // signed-out case is a labelled action, not an advert.
  const acct = state.account || { authed: false };
  // A session the server has rejected outright is not "signed out" from the
  // user's point of view — they did not do anything. Say what happened and
  // give them the one control that fixes it.
  const expired = !acct.authed && state.sessionExpired;
  parts.push(U.section({ id: 'vdAccount', title: 'Account', body:
    (acct.authed
      ? `<p class="vd-line">${U.esc(U.COPY.signedInAs(acct.email || 'this account'))}</p>`
        + '<div class="vd-settings__note" id="vdSessionStatus"></div>'
        + U.button({ id: 'vdSignOut', variant: 'ghost', label: U.COPY.signOut })
      // §3: an invitation to sign in is a control, never a sentence on its own.
      : `<p class="vd-line">${U.esc(expired ? U.COPY.sessionExpired : U.COPY.signInForHistory)}</p>`
        + U.button({ id: 'vdSignIn', variant: 'ghost', label: U.COPY.signIn })) }));

  // AI enhancement. Off by default in the sense that matters: with the toggle
  // off, provider/model/key are not on screen at all (§4.3).
  const on = !!state.aiEnabled;
  const aiBody = [
    // The section heading already says "AI enhancement"; the toggle carries an
    // aria-label rather than repeating it on screen.
    `<label class="vd-toggle"><input type="checkbox" id="vdAiToggle"`
    + ` aria-label="AI enhancement"${on ? ' checked' : ''} />`
    + '<span class="vd-toggle__track" aria-hidden="true"></span>'
    + `<span class="vd-toggle__state">${on ? 'On' : 'Off'}</span></label>`,
    `<p class="vd-settings__help">${U.esc(U.COPY.aiEnhancement)}</p>`,
  ];
  if (on) {
    const providers = Object.keys(PROVIDERS).filter(k => k !== 'none')
      .map(k => ({ value: k, label: PROVIDERS[k].name }));
    aiBody.push('<div class="vd-field"><span class="vd-field__label">Provider</span>'
      + U.select({ id: 'vdProviderSelect', ariaLabel: 'Provider', value: state.provider,
                   options: providers }) + '</div>');

    const models = getModelsForProvider(state.provider) || [];
    aiBody.push('<div class="vd-field"><span class="vd-field__label">Model</span>'
      + U.select({ id: 'vdModelSelect', ariaLabel: 'Model',
                   value: getActiveModel(state.provider) || '',
                   options: models.map(m => ({ value: m.id, label: m.label || m.id })) })
      + '</div>');

    const hasKey = !!state.apiKeys[state.provider];
    aiBody.push('<div class="vd-field"><span class="vd-field__label">API key</span>'
      + (hasKey
          ? '<span class="vd-field__value">••••••••••••</span>'
            + '<button class="vd-btn vd-btn--ghost vd-btn--sm" id="vdChangeKey">'
            + '<span class="vd-btn__label">Change</span></button>'
          : '<input type="password" id="apiKeyInput" class="vd-input" placeholder="Paste your key" autocomplete="off" />'
            + '<button class="vd-btn vd-btn--ghost vd-btn--sm" id="saveApiKey">'
            + '<span class="vd-btn__label">Save</span></button>')
      + '</div>');

    // The model nudge — one line, dismissible, and only here. It used to sit
    // in the main flow where it competed with the primary action.
    // computeModelNotice returns either {type:'nudge', text, newerId} or
    // {type:'fallback', text}. A fallback is not dismissible — it explains why
    // the model in use is not the one that was chosen, and hiding that would
    // leave the user reading a model name that is not what ran.
    const notice = computeModelNotice(state.provider);
    if (notice && notice.type === 'nudge') {
      aiBody.push(U.notice({
        id: 'vdModelNudge', tone: 'info', text: notice.text,
        action: 'Switch', actionId: 'switchModel', dismissId: 'dismissNudge',
      }));
    } else if (notice && notice.type === 'fallback') {
      aiBody.push(U.notice({ id: 'vdModelFallback', tone: 'warn', text: notice.text }));
    }
  }
  parts.push(U.section({ title: 'AI enhancement', body: aiBody.join('') }));

  // §3: one grant instead of a prompt per site. Off by default — the
  // narrower permission is the one the user did not have to think about.
  parts.push(U.section({ title: 'Site access', body:
    `<label class="vd-toggle"><input type="checkbox" id="vdAllSites"`
    + ` aria-label="${U.esc(U.COPY.allSites)}"${state.allSites ? ' checked' : ''} />`
    + '<span class="vd-toggle__track" aria-hidden="true"></span>'
    + `<span class="vd-toggle__state">${U.esc(U.COPY.allSites)}</span></label>`
    + `<p class="vd-settings__help">${U.esc(U.COPY.allSitesHelp)}</p>` }));

  parts.push(U.section({ title: 'Defaults', body:
    '<div class="vd-field"><span class="vd-field__label">Output</span>'
    + U.select({ id: 'vdDefaultOutput', ariaLabel: 'Default output', value: state.output,
                 options: U.OUTPUTS.map(o => ({ value: o.value, label: o.label })) }) + '</div>'
    + '<div class="vd-field"><span class="vd-field__label">Target</span>'
    + U.select({ id: 'vdDefaultTarget', ariaLabel: 'Default target', value: state.target,
                 options: U.TARGETS }) + '</div>' }));

  const recent = (state.recent || []).slice(0, 3);
  parts.push(U.section({
    title: 'History', action: 'See all ▸', actionId: 'openHistory',
    body: recent.length
      ? recent.map(r => U.kvRow({ label: r.domain, value: r.ago, meta: r.meta, mono: false })).join('')
      : `<p class="vd-line">${U.esc(U.COPY.historyEmpty)}</p>`,
  }));

  // Developer — unpacked builds only, exactly as before, just relocated.
  if (isUnpackedBuild()) {
    parts.push(U.section({ id: 'settingsDev', title: 'Developer',
      body: U.button({ id: 'devTokensJsonBtn', variant: 'ghost', label: 'Copy RAW capture' })
        + '<p class="vd-settings__note">Unpacked build only. Paste into tests/fixtures/ to add a fixture.</p>' }));
  }

  let version = 'dev';
  try { version = chrome.runtime.getManifest().version; } catch (e) { /* keep dev */ }
  parts.push(U.section({ title: 'About', body:
    `<p class="vd-line">VibeDesign ${U.esc(version)} · `
    + '<a href="https://vibedesign.tech/privacy" target="_blank" rel="noopener">Privacy</a> · '
    + '<a href="https://vibedesign.tech/support" target="_blank" rel="noopener">Support</a></p>' }));

  return parts.join('');
}

// Synchronous follow-up right after Settings HTML lands.
function afterSettingsRender() {
  const input = $('apiKeyInput');
  if (input) input.value = '';
}

// Asynchronous follow-up: the auth pill and the session line both await
// storage, so they render into their slots once Settings is on screen.
function mountSettingsAsync() {
  try { renderSessionStatus(); } catch (e) { /* status is optional */ }
  refreshLiveModelsForCurrentProvider();
}

// ── INIT ──────────────────────────────────────────────────────────────────
async function initUI(options) {
  const opts = options || {};
  // The popup is the short form (§3): header, mode, Analyze, and a way into
  // the side panel. Same renderers, no tab bar.
  state.surface = opts.surface || 'sidepanel';

  const appEl = document.querySelector('.app');
  if (appEl && !appEl.querySelector('.vd-header')) {
    appEl.innerHTML = state.surface === 'popup' ? POPUP_TEMPLATE : APP_TEMPLATE;
  }

  const stored = await chrome.storage.local.get([
    'provider', 'apiKeys', 'dp_pending', 'selectedModels', 'savedModelLabels',
    'savedFocus', 'vd_nudge_dismissed', 'vd_ai_enabled', 'vd_output', 'vd_target',
  ]);
  state.provider = stored.provider || 'gemini';
  state.apiKeys = stored.apiKeys || {};
  state.selectedModels = stored.selectedModels || {};
  state.savedModelLabels = stored.savedModelLabels || {};
  state.dismissedNudges = stored.vd_nudge_dismissed || {};
  state.focus = stored.savedFocus || 'all';
  // AI enhancement is opt-in. An existing key means the user already opted in
  // on the old UI, so it stays on for them rather than silently turning off.
  state.aiEnabled = stored.vd_ai_enabled !== undefined
    ? !!stored.vd_ai_enabled
    : !!(state.apiKeys[state.provider] && state.provider !== 'none');
  state.output = stored.vd_output || 'prompt';
  state.target = stored.vd_target || VD_UI.TARGETS[0];
  state.tab = 'overview';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    state.currentUrl = tab?.url || '';
  } catch (e) { console.debug('[VibeDesign] Tab query:', e.message); }

  await loadRecent();
  await refreshAccount();
  await refreshSiteAccess();
  setupListeners();
  setSurface('panel');
  renderPanel();
  if (state.tab === 'settings') mountSettingsAsync();

  if (_uiHooks.afterListeners) _uiHooks.afterListeners();

  const pending = stored.dp_pending;
  if (pending && pending.timestamp && (Date.now() - pending.timestamp) < 5 * 60 * 1000) {
    await chrome.storage.local.remove('dp_pending');
    if (pending.type === 'ELEMENT_PICKED') {
      setTimeout(() => buildPromptFromData(pending.data, 'element'), 80);
      return;
    }
  } else if (pending) {
    await chrome.storage.local.remove('dp_pending');
  }

  // Restore the last analysis for this domain so reopening the panel does not
  // throw away what you just did.
  if (state.currentUrl) {
    const domain = safeHostname(state.currentUrl);
    const historyStored = await chrome.storage.local.get(HISTORY_KEY);
    const history = historyStored[HISTORY_KEY] || {};
    const domainEntries = Object.values(history).filter(e => e.domain === domain)
      .sort((a, b) => b.savedAt - a.savedAt);
    const savedItem = domainEntries.find(e => e.focus === state.focus) || domainEntries[0];
    if (savedItem && savedItem.prompt) {
      state.lastPrompt = savedItem.prompt;
      showResult(savedItem.prompt, { url: savedItem.url || state.currentUrl },
                 savedItem.source, savedItem.provider, true);
    }
  }

  startSessionStatusTicker();
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.vd_last_refresh && state.tab === 'settings') renderSessionStatus();
    });
  } catch (e) { console.warn('[vd-auth-ui] status listener failed', e); }
}

// Who is signed in, if anyone. Read once and cached on state, because both
// the Settings panel and the tab-bar dot need it and neither can await.
async function refreshAccount() {
  const before = JSON.stringify(state.account || null) + JSON.stringify(state.usage || null);
  try {
    const auth = self.VD_AUTH;
    const session = (auth && typeof auth.peekSession === 'function')
      ? await auth.peekSession() : null;
    const user = session && (session.user || null);
    const meta = (user && user.user_metadata) || {};
    state.account = {
      authed: !!(session && session.access_token),
      email: user && user.email,
      avatarUrl: meta.avatar_url || meta.picture || (user && user.avatar_url) || null,
    };
  } catch (e) {
    // Never let an auth hiccup take the panel down: unknown reads as anonymous.
    state.account = { authed: false, email: null, avatarUrl: null };
  }
  await refreshUsage();
  await refreshSessionHealth();
  if (JSON.stringify(state.account) + JSON.stringify(state.usage) !== before) renderPanel();
}

// Whether the last refresh attempt ended with the server rejecting the token
// outright. The worker records that as reason 'expired'; anything else is
// either fine or worth retrying, and neither is worth telling the user about
// in these words.
async function refreshSessionHealth() {
  try {
    const auth = self.VD_AUTH;
    if (!auth || typeof auth.getRefreshStatus !== 'function') { state.sessionExpired = false; return; }
    const status = await auth.getRefreshStatus();
    state.sessionExpired = !!(status && status.ok === false && status.reason === 'expired');
  } catch (e) {
    state.sessionExpired = false;
  }
}

// §3: the anonymous cap. Signed-in accounts are unlimited, so there is nothing
// to count for them and `state.usage` stays null — which is what makes the
// counter invisible rather than merely hidden.
async function refreshUsage() {
  if (state.account && state.account.authed) { state.usage = null; return; }
  try {
    const meter = self.VD_USAGE;
    if (!meter || typeof meter.getUsage !== 'function') { state.usage = null; return; }
    const u = await meter.getUsage();
    state.usage = { used: u.count, limit: u.limit, resetsAt: u.resetsAt };
  } catch (e) {
    // A broken meter must not lock anyone out — no counter, no cap block.
    console.warn('[vd-usage] could not read usage', e);
    state.usage = null;
  }
}

// §3: every offer to sign in — header button, cap caption, cap block,
// Settings — runs this.
//
// Signing in happens on vibedesign.tech, in a tab, so that one sign-in serves
// both the site and the extension: the site completes the handoff described in
// docs/AUTH-HANDOFF.md and the extension receives its own session. The panel
// does not wait on that — the worker broadcasts when it lands.
//
// launchWebAuthFlow stays as the fallback for when the site cannot be reached
// at all, so a site outage does not leave the extension with no way in.
const LOGIN_URL = 'https://vibedesign.tech/login?from=extension';

async function signIn() {
  try {
    const reachable = await siteReachable();
    if (reachable) {
      await chrome.tabs.create({ url: LOGIN_URL });
      // Settings is where the result will show, so go there now rather than
      // leaving the user on a screen that has not changed.
      setTab('settings');
      return;
    }
    console.warn('[vd-ui] vibedesign.tech unreachable — falling back to the direct flow');
    if (self.VD_AUTH && typeof self.VD_AUTH.openAuthFlow === 'function') {
      await self.VD_AUTH.openAuthFlow('login');
    }
  } catch (e) {
    console.warn('[vd-ui] sign in failed', e);
  }
  await refreshAccount();
  if (state.account && state.account.authed) setTab('settings');
}

// A short HEAD request, because the alternative is opening a tab to a site
// that is down and leaving the user staring at an error page with no way back
// to a working sign-in.
async function siteReachable() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    await fetch('https://vibedesign.tech/login', {
      method: 'HEAD', mode: 'no-cors', signal: ctrl.signal, cache: 'no-store',
    });
    clearTimeout(timer);
    return true;
  } catch (e) {
    return false;
  }
}

async function signOutAccount() {
  try {
    if (self.VD_AUTH && typeof self.VD_AUTH.signOut === 'function') await self.VD_AUTH.signOut();
  } catch (e) { console.warn('[vd-ui] sign out failed', e); }
  await refreshAccount();
}

// The three most recent analyses, for Home's Recent block and Settings.
async function loadRecent() {
  try {
    const history = await loadHistory();
    state.recent = Object.keys(history)
      .map(key => ({ key: key, item: history[key] }))
      .filter(e => e.item && e.item.domain)
      .sort((a, b) => (b.item.savedAt || 0) - (a.item.savedAt || 0))
      .slice(0, 3)
      .map(e => ({
        key: e.key,
        domain: e.item.domain,
        ago: formatRelativeTime(e.item.savedAt),
        meta: e.item.focus && e.item.focus !== 'all' ? e.item.focus : '',
      }));
  } catch (e) {
    state.recent = [];
  }
}

// ─── v2.0.0-beta.1: auth pill + welcome card ──────────────────────
// Purely additive. Every path is try/catch-wrapped; a failure here
// must never crash the existing sidepanel UI.
//
// Idempotency: multiple concurrent calls can happen (e.g. SIGNED_IN
// fires onAuthStateChange AND the sign-in click handler calls render
// explicitly). Two safeguards prevent duplicate pills:
//   1. A monotonic sequence counter — only the latest call commits.
//   2. The DOM commit (innerHTML='' + appendChild) is one synchronous
//      block after the final supersede check, with no await between.

let _vdAuthPillSeq = 0;

// ─── v2.0.0-beta.2: usage counter + Analyze button gate ─────────────
// Anonymous users see a small pill above the Analyze button showing
// X of 5 free prompts used this month. On 4/5 the pill turns amber
// ("1 left"); on 5/5 it flips to a sign-in CTA and the button
// disables. Authed users see nothing (component returns empty).
// Same seq-counter idempotency pattern used for the auth pill.

let _vdUsageSeq = 0;

// ─── Cloud history (authed users) ─────────────────────────────────
// Fetches up to 20 analyses via VD_CLOUD.fetchRecentAnalyses, renders
// into the existing #historyList using existing .history-item* CSS so
// the authed panel is visually consistent with the anon one. A loader
// spinner appears only if the fetch takes longer than 300ms, avoiding
// flash on fast responses. A "View all on dashboard →" link is pinned
// to the bottom.

async function _renderCloudHistory(list) {
  list.innerHTML = '';

  const spinner = _vdBuildCloudSpinner();
  let spinnerShown = false;
  const spinnerTimer = setTimeout(() => {
    try { list.appendChild(spinner); spinnerShown = true; } catch (_) {}
  }, 300);

  let res;
  try {
    res = await self.VD_CLOUD.fetchRecentAnalyses(20);
  } catch (e) {
    clearTimeout(spinnerTimer);
    if (spinnerShown) try { spinner.remove(); } catch (_) {}
    list.innerHTML = '<p class="empty-state">Couldn\u2019t load cloud history.</p>';
    return;
  }

  clearTimeout(spinnerTimer);
  if (spinnerShown) try { spinner.remove(); } catch (_) {}

  if (!res || !res.ok) {
    list.innerHTML = '<p class="empty-state">Couldn\u2019t load cloud history.</p>';
    return;
  }

  const items = res.data || [];
  if (items.length === 0) {
    list.innerHTML = '<p class="empty-state">No cloud history yet. Analyze a page to get started.</p>';
    list.appendChild(_vdBuildDashboardFooter());
    return;
  }

  list.innerHTML = '';
  items.forEach(item => list.appendChild(_vdBuildCloudHistoryItem(item, list)));
  list.appendChild(_vdBuildDashboardFooter());
}

function _vdBuildCloudSpinner() {
  const wrap = document.createElement('div');
  wrap.className = 'vd-cloud-spinner';
  const spin = document.createElement('span');
  spin.className = 'vd-cloud-spinner__ring';
  wrap.appendChild(spin);
  const label = document.createElement('span');
  label.textContent = 'Loading from cloud…';
  wrap.appendChild(label);
  return wrap;
}

function _vdBuildDashboardFooter() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'vd-cloud-dashboard-link';
  btn.textContent = 'View all on dashboard →';
  btn.addEventListener('click', () => {
    try { chrome.tabs.create({ url: 'https://vibedesign.tech/dashboard' }); }
    catch (e) { console.warn('[vd-cloud-ui] dashboard open failed', e); }
  });
  return btn;
}

function _vdBuildCloudHistoryItem(analysis, list) {
  const el = document.createElement('div');
  el.className = 'history-item';
  el.dataset.analysisId = analysis.id;

  const savedAtMs = _vdParseCreatedAt(analysis.created_at);
  const timeStr = typeof formatRelativeTime === 'function' && savedAtMs
    ? formatRelativeTime(savedAtMs)
    : '';

  const iconSpan = document.createElement('span');
  iconSpan.className = 'history-item-icon';
  if (analysis.primary_color && /^#[0-9a-fA-F]{3,8}$/.test(analysis.primary_color)) {
    // Small color swatch when we have a primary color
    iconSpan.classList.add('vd-cloud-swatch');
    iconSpan.style.background = analysis.primary_color;
    iconSpan.textContent = '';
  } else {
    iconSpan.textContent = '☁';
  }

  const body = document.createElement('div');
  body.className = 'history-item-body';

  const domainDiv = document.createElement('div');
  domainDiv.className = 'history-item-domain';
  domainDiv.textContent = analysis.hostname || '';
  body.appendChild(domainDiv);

  const metaDiv = document.createElement('div');
  metaDiv.className = 'history-item-meta';
  if (timeStr) {
    const timeSpan = document.createElement('span');
    timeSpan.textContent = timeStr;
    metaDiv.appendChild(timeSpan);
  }
  body.appendChild(metaDiv);

  const delBtn = document.createElement('button');
  delBtn.className = 'history-item-delete';
  delBtn.title = 'Delete';
  delBtn.setAttribute('aria-label', `Delete analysis for ${analysis.hostname || 'site'}`);
  delBtn.textContent = '✕';

  el.appendChild(iconSpan);
  el.appendChild(body);
  el.appendChild(delBtn);

  el.addEventListener('click', e => {
    if (e.target.classList.contains('history-item-delete')) return;
    _vdRestoreCloudPrompt(analysis).catch(err => console.warn('[vd-cloud-ui] restore failed', err));
  });

  delBtn.addEventListener('click', async e => {
    e.stopPropagation();
    try {
      if (self.VD_CLOUD && typeof self.VD_CLOUD.deleteAnalysis === 'function') {
        const r = await self.VD_CLOUD.deleteAnalysis(analysis.id);
        if (!r || !r.ok) {
          console.warn('[vd-cloud-ui] delete failed', r && r.error);
          return;
        }
      }
      el.style.opacity = '0';
      el.style.transform = 'translateX(8px)';
      el.style.transition = 'all 0.2s ease';
      setTimeout(() => {
        el.remove();
        // Empty state if no items remain (the dashboard footer stays)
        const hasItems = list.querySelector('.history-item');
        if (!hasItems) {
          const empty = document.createElement('p');
          empty.className = 'empty-state';
          empty.textContent = 'No cloud history yet. Analyze a page to get started.';
          list.insertBefore(empty, list.firstChild);
        }
      }, 200);
    } catch (err) {
      console.warn('[vd-cloud-ui] delete threw', err);
    }
  });

  return el;
}

function _vdParseCreatedAt(v) {
  if (!v) return null;
  if (typeof v === 'number') return v;
  const t = new Date(v).getTime();
  return isNaN(t) ? null : t;
}

async function _vdRestoreCloudPrompt(analysis) {
  try {
    if (!self.VD_CLOUD || typeof self.VD_CLOUD.fetchPromptsForAnalysis !== 'function') return;
    const res = await self.VD_CLOUD.fetchPromptsForAnalysis(analysis.id);
    if (!res || !res.ok || !res.data || !res.data.length) {
      if (typeof showError === 'function') showError('Could not load this analysis.');
      return;
    }
    const mostRecent = res.data[0];
    const promptText = (mostRecent && mostRecent.prompt_text) || '';
    if (!promptText) {
      if (typeof showError === 'function') showError('This analysis has no prompt yet.');
      return;
    }
    state.lastPrompt = promptText;
    closeSheet('vdHistorySheet');
    const url = 'https://' + (analysis.hostname || '');
    showResult(promptText, { url }, 'page', null, true);
  } catch (e) {
    console.warn('[vd-cloud-ui] _vdRestoreCloudPrompt threw', e);
    if (typeof showError === 'function') showError('Could not load this analysis.');
  }
}


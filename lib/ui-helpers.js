// ═══════════════════════════════════════════════════════════════════════════
// Shared UI module — used by both popup.js and sidepanel.js
// ═══════════════════════════════════════════════════════════════════════════

// ── CONSTANTS ─────────────────────────────────────────────────────────────
const MAX_HISTORY = 30;
const HISTORY_KEY = 'promptHistory';

const PROVIDERS = {
  gemini: {
    name: 'Gemini', color: '#4285f4', placeholder: 'AIza...',
    models: [
      { id: 'gemini-2.5-flash-lite',  label: 'Flash 2.5 Lite', note: 'Free · Fastest'     },
      { id: 'gemini-2.5-flash',       label: 'Flash 2.5',      note: 'Free · Recommended' },
      { id: 'gemini-2.5-pro',         label: 'Pro 2.5',        note: 'Paid · Best'        },
    ],
    defaultModel: 'gemini-2.5-flash',
    info: 'Flash 2.5 free: 1,500 req/day. <a href="https://aistudio.google.com/apikey" target="_blank">Get key →</a>',
  },
  claude: {
    name: 'Claude', color: '#d97706', placeholder: 'sk-ant-...',
    models: [
      { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5',  note: 'Fast · Low cost'  },
      { id: 'claude-sonnet-4-6',         label: 'Sonnet 4.6', note: 'Balanced'          },
      { id: 'claude-opus-4-6',           label: 'Opus 4.6',   note: 'Best quality'      },
    ],
    defaultModel: 'claude-haiku-4-5-20251001',
    info: 'Paid. <a href="https://console.anthropic.com/settings/keys" target="_blank">Get key →</a>',
  },
  openai: {
    name: 'OpenAI', color: '#10a37f', placeholder: 'sk-...',
    models: [
      { id: 'gpt-4o-mini',  label: 'GPT-4o mini', note: 'Fast · Low cost' },
      { id: 'gpt-4o',       label: 'GPT-4o',      note: 'Balanced'        },
      { id: 'o4-mini',      label: 'o4-mini',     note: 'Reasoning'       },
    ],
    defaultModel: 'gpt-4o-mini',
    info: 'Paid. <a href="https://platform.openai.com/api-keys" target="_blank">Get key →</a>',
  },
  none: {
    name: 'None', color: '#555', placeholder: '', models: [], defaultModel: null,
    info: 'No AI — direction is written by the rule engine. Less nuanced, zero cost.',
  },
};

const SOURCE_ICONS = { page:'◫', element:'⊡', image:'⬚' };

// ── STATE ─────────────────────────────────────────────────────────────────
let state = {
  mode:'page', focus:'all', imgFocus:'full',
  pickerActive:false, imagePickerActive:false,
  lastPrompt:'', capturedImageData:null,
  lastAnalyzedData:null, lastAiDirection:null,
  provider:'gemini', apiKeys:{}, selectedModels:{},
  currentUrl:'',
};

const $ = id => document.getElementById(id);

// Hook point — popup.js / sidepanel.js can set these before calling initUI()
let _uiHooks = {};

// ── PROVIDER HELPERS ──────────────────────────────────────────────────────
function getActiveModel(provider) {
  const cfg = PROVIDERS[provider];
  if (!cfg || !cfg.models.length) return null;
  return state.selectedModels[provider] || cfg.defaultModel;
}

function getActiveModelLabel(provider) {
  const modelId = getActiveModel(provider);
  const cfg = PROVIDERS[provider];
  if (!cfg) return modelId;
  const m = cfg.models.find(m => m.id === modelId);
  return m ? m.label : modelId;
}

// ── HISTORY STORAGE ───────────────────────────────────────────────────────
async function savePrompt(url, prompt, source, platform, focus) {
  const domain = safeHostname(url);
  const key = `${domain}::${focus || 'all'}`;
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
function renderProviderUI() {
  document.querySelectorAll('.provider-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.provider === state.provider));
  const cfg = PROVIDERS[state.provider];
  $('providerInfo').innerHTML = cfg.info;
  $('apiKeyRow').style.display = state.provider === 'none' ? 'none' : 'flex';
  $('apiKeyInput').placeholder = cfg.placeholder || '';
  $('apiKeyInput').value = state.apiKeys[state.provider] || '';

  const modelRow = $('modelRow');
  if (cfg.models.length > 0) {
    modelRow.style.display = 'flex';
    const activeModel = getActiveModel(state.provider);
    modelRow.innerHTML = '<div class="model-row-label"><span class="field-label">Model</span></div>'
      + cfg.models.map(m => {
        const isActive = m.id === activeModel;
        return `<button class="chip${isActive?' active':''}" data-model="${m.id}" title="${m.id}">${m.label}<span class="model-note">${m.note}</span></button>`;
      }).join('');
    modelRow.querySelectorAll('[data-model]').forEach(btn =>
      btn.addEventListener('click', () => selectModel(btn.dataset.model)));
  } else {
    modelRow.style.display = 'none';
  }

  const hasKey = state.provider === 'none' || !!state.apiKeys[state.provider];
  const modelLabel = getActiveModelLabel(state.provider);
  const modelStr = modelLabel ? `<span class="settings-note-model">${modelLabel}</span>` : '';

  if (!hasKey) {
    $('settingsNote').innerHTML = '<span class="settings-note-warn">⚠ No key — rule-based direction will be used instead of AI.</span>';
  } else if (state.provider === 'none') {
    $('settingsNote').textContent = 'Rule-based mode — no AI calls.';
  } else {
    $('settingsNote').innerHTML = `Model: ${modelStr} &nbsp;·&nbsp; Key stored locally, never sent anywhere.`;
  }

  updateModeBadge();
}

async function selectModel(modelId) {
  state.selectedModels[state.provider] = modelId;
  await chrome.storage.local.set({ selectedModels: state.selectedModels });
  renderProviderUI();
}

function updateModeBadge() {
  const hasKey = state.provider === 'none' || !!state.apiKeys[state.provider];
  const badge = $('modeBadge');
  if (!badge) return;
  const cfg = PROVIDERS[state.provider];
  if (state.provider === 'none') {
    badge.textContent = 'Rule-based';
    badge.className = 'mode-badge mode-badge--fallback';
    badge.title = '';
  } else if (!hasKey) {
    badge.textContent = '⚠ No key';
    badge.className = 'mode-badge mode-badge--warn';
    badge.title = 'Add an API key in settings to enable AI';
  } else {
    const label = getActiveModelLabel(state.provider);
    const modelId = getActiveModel(state.provider);
    badge.textContent = label;
    badge.className = 'mode-badge mode-badge--ai';
    badge.title = `${cfg.name} · ${modelId}`;
  }
}

async function saveApiKey() {
  const key = $('apiKeyInput').value.trim();
  state.apiKeys[state.provider] = key;
  await chrome.storage.local.set({ provider: state.provider, apiKeys: state.apiKeys });
  $('saveApiKey').textContent = '✓';
  setTimeout(() => $('saveApiKey').textContent = 'Save', 1500);
  renderProviderUI();
}

async function setProvider(provider) {
  state.provider = provider;
  await chrome.storage.local.set({ provider });
  renderProviderUI();
}

// ── HISTORY UI ────────────────────────────────────────────────────────────
async function renderHistory() {
  const items = await loadHistory();
  const list = $('historyList');

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
  $('historyPanel').style.display = 'none';
  $('saveIndicator').style.display = 'none';
  if (item.focus) {
    state.focus = item.focus;
    document.querySelectorAll('.chip[data-focus]').forEach(c => {
      c.classList.toggle('active', c.dataset.focus === item.focus);
    });
  }
  showResult(item.prompt, { url: item.url || `https://${item.domain}` }, item.source, item.provider, false);
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
  document.querySelectorAll('[data-focus]').forEach(c => c.classList.toggle('active', c.dataset.focus === f));
  chrome.storage.local.set({ savedFocus: f });
  if (state.lastAnalyzedData) {
    const prompt = buildPagePrompt(state.lastAnalyzedData, state.lastAiDirection);
    state.lastPrompt = prompt;
    const output = $('promptOutput');
    if (output) output.textContent = prompt;
  }
}

// Default no-ops — popup.js overrides these for picker support
function setImgFocus() {}
function updateAnalyzeBtn() {}

// ── MAIN FLOW ─────────────────────────────────────────────────────────────
async function handleAnalyze() {
  const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
  state.currentUrl = tab?.url || '';

  try {
    showLoading('Analyzing DOM…');
    await injectContentScript(tab.id);
    const resp = await chrome.tabs.sendMessage(tab.id, {type:'EXTRACT_PAGE'});
    if (!resp?.success) throw new Error('Could not get page data. Refresh and try again.');
    const _pageData = resp.data;
    if (_pageData.heroImageUrl && state.provider && state.provider !== 'none' && state.apiKeys[state.provider]) {
      try {
        showLoading('Analyzing hero illustration…');
        const _visionDesc = await analyzeIllustrationWithVision(
          _pageData.heroImageUrl, state.provider, state.apiKeys[state.provider],
          getActiveModel(state.provider)
        );
        if (_visionDesc) _pageData.visionIllustrationDescription = _visionDesc;
      } catch(e) { console.debug('[VibeDesign] Vision analysis skipped:', e.message); }
    }
    buildPromptFromData(_pageData, 'page');
  } catch(err) { showError(err.message || 'An error occurred.'); }
}

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  } catch(e) {
    console.debug('[VibeDesign] Script injection:', e.message);
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

function showLoading(text) {
  $('resultSection').style.display = 'none';
  $('errorSection').style.display = 'none';
  const ls = $('loadingSection');
  if (!$('loadingText')) ls.innerHTML = LOADING_SECTION_HTML;
  ls.style.display = 'flex';
  $('loadingText').textContent = text;
}

function showResult(prompt, data, source, providerUsed, isRestored = false) {
  $('loadingSection').style.display = 'none';
  $('errorSection').style.display = 'none';
  $('promptOutput').textContent = prompt;

  $('restoredBanner').style.display = isRestored ? 'flex' : 'none';

  const srcLabel = { page:'Page', element:'Element', image:'Image' }[source] || source;
  const meta = $('resultMeta');
  meta.textContent = `${srcLabel} — ${safeHostname(data.url || '')}`;

  if (providerUsed && PROVIDERS[providerUsed]) {
    const cfg = PROVIDERS[providerUsed];
    const label = getActiveModelLabel(providerUsed);
    const modelId = getActiveModel(providerUsed);
    const badge = document.createElement('span');
    badge.className = 'ai-badge';
    badge.title = `${cfg.name} · ${modelId}`;
    const dot = document.createElement('span');
    dot.className = 'ai-badge-dot';
    dot.style.background = cfg.color;
    badge.appendChild(dot);
    badge.appendChild(document.createTextNode(label));
    meta.appendChild(document.createTextNode(' '));
    meta.appendChild(badge);
  } else {
    const badge = document.createElement('span');
    badge.className = 'ai-badge';
    badge.style.opacity = '0.5';
    badge.title = 'No AI key — direction was generated by rule engine';
    badge.textContent = 'rule-based';
    meta.appendChild(document.createTextNode(' '));
    meta.appendChild(badge);
  }

  $('outputTabs').style.display = source === 'page' ? 'flex' : 'none';
  document.querySelectorAll('.output-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.output === 'full'));

  $('resultSection').style.display = 'flex';
}

function flashSaveIndicator() {
  const ind = $('saveIndicator');
  ind.style.display = 'flex';
  setTimeout(() => { ind.style.display = 'none'; }, 3000);
}

function showError(msg) {
  $('loadingSection').style.display = 'none';
  $('resultSection').style.display = 'none';
  $('errorText').textContent = msg;
  $('errorSection').style.display = 'flex';
}

function resetView() {
  $('resultSection').style.display = 'none';
  $('loadingSection').style.display = 'none';
  $('errorSection').style.display = 'none';
  $('saveIndicator').style.display = 'none';
  $('restoredBanner').style.display = 'none';
  state.lastPrompt = '';
  state.lastAiDirection = null;
  state.lastAnalyzedData = null;
}

function copyPrompt() {
  if (!state.lastPrompt) return;
  copyToClipboard(state.lastPrompt);
  $('copyBtn').classList.add('copied');
  $('copyIcon').textContent = '✓';
  // Copy pulse on prompt container
  const pc = document.querySelector('.prompt-container');
  if (pc) { pc.classList.add('copy-pulse'); setTimeout(() => pc.classList.remove('copy-pulse'), 400); }
  setTimeout(() => {
    $('copyBtn').classList.remove('copied');
    $('copyIcon').textContent = '⎘';
  }, 2000);
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
function setupListeners() {
  $('settingsToggle').addEventListener('click', async () => {
    const p = $('settingsPanel'), h = $('historyPanel');
    const opening = p.style.display === 'none';
    p.style.display = opening ? 'flex' : 'none';
    h.style.display = 'none';
    await chrome.storage.local.set({ settings_panel_open: opening });
  });
  $('saveApiKey').addEventListener('click', saveApiKey);
  $('apiKeyInput').addEventListener('keydown', e => { if (e.key === 'Enter') saveApiKey(); });
  document.querySelectorAll('.provider-tab').forEach(t =>
    t.addEventListener('click', () => setProvider(t.dataset.provider)));

  $('historyToggle').addEventListener('click', async () => {
    const h = $('historyPanel'), s = $('settingsPanel');
    const opening = h.style.display === 'none';
    h.style.display = opening ? 'flex' : 'none';
    s.style.display = 'none';
    if (opening) await renderHistory();
  });
  $('clearHistoryBtn').addEventListener('click', async () => {
    if (!confirm('Clear all saved prompts? This cannot be undone.')) return;
    await clearHistory();
    await renderHistory();
  });

  document.querySelectorAll('[data-focus]').forEach(c =>
    c.addEventListener('click', () => setFocus(c.dataset.focus)));
  document.querySelectorAll('[data-imgfocus]').forEach(c =>
    c.addEventListener('click', () => setImgFocus(c.dataset.imgfocus)));
  document.querySelectorAll('[data-content]').forEach(c =>
    c.addEventListener('click', () => setContentMode(c.dataset.content)));

  $('analyzeBtn').addEventListener('click', handleAnalyze);
  $('copyBtn').addEventListener('click', copyPrompt);
  document.querySelectorAll('.output-tab').forEach(t =>
    t.addEventListener('click', () => setOutputMode(t.dataset.output)));
  $('resetBtn').addEventListener('click', resetView);
  $('exportTokensBtn').addEventListener('click', () => {
    if (state.lastAnalyzedData) downloadTokensJSON(state.lastAnalyzedData);
  });
  $('errorRetryBtn').addEventListener('click', handleAnalyze);

  $('newPromptBtn').addEventListener('click', () => {
    $('restoredBanner').style.display = 'none';
    resetView();
    if (!state.apiKeys[state.provider] && state.provider !== 'none') {
      $('settingsPanel').style.display = 'flex';
    }
  });

  chrome.runtime.onMessage.addListener(msg => {
    // Reserved for future use
  });

  // Keyboard shortcut: Cmd/Ctrl+Enter to analyze
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleAnalyze();
    }
  });

  if (_uiHooks.extraListeners) _uiHooks.extraListeners();
}

// ── SHARED TEMPLATE ─────────────────────────────────────────────────────
const APP_TEMPLATE = `
  <!-- Header -->
  <header class="header">
    <div class="logo">
      <img src="icons/logo-light.png" alt="VibeDesign" class="logo-img" />
    </div>
    <div class="header-right">
      <span class="version-badge" id="versionBadge"></span>
      <span class="mode-badge mode-badge--fallback" id="modeBadge">Rule-based</span>
      <button class="icon-btn" id="historyToggle" title="Saved prompts" aria-label="Saved prompts">◷</button>
      <button class="icon-btn" id="settingsToggle" title="API Settings" aria-label="API Settings">⚙</button>
    </div>
  </header>
  <div class="url-badge" id="urlBadge"></div>

  <!-- Settings Panel -->
  <section class="settings-panel" id="settingsPanel" aria-label="AI Provider Settings">
    <div class="settings-title">AI Provider</div>
    <div class="provider-tabs" id="providerTabs" role="radiogroup" aria-label="Select AI provider">
      <button class="provider-tab active" data-provider="gemini" role="radio" aria-checked="true">
        <span class="provider-dot provider-dot--gemini"></span>Gemini
      </button>
      <button class="provider-tab" data-provider="claude" role="radio" aria-checked="false">
        <span class="provider-dot provider-dot--claude"></span>Claude
      </button>
      <button class="provider-tab" data-provider="openai" role="radio" aria-checked="false">
        <span class="provider-dot provider-dot--openai"></span>OpenAI
      </button>
      <button class="provider-tab" data-provider="none" role="radio" aria-checked="false">
        <span class="provider-dot provider-dot--none"></span>None
      </button>
    </div>
    <div class="provider-info" id="providerInfo"></div>
    <div class="model-row" id="modelRow" style="display:none"></div>
    <div class="api-key-row" id="apiKeyRow">
      <label for="apiKeyInput" class="sr-only">API Key</label>
      <input type="password" id="apiKeyInput" class="input" placeholder="API key..." autocomplete="off" />
      <button class="btn btn-sm" id="saveApiKey">Save</button>
    </div>
    <div class="settings-note" id="settingsNote"></div>
  </section>

  <!-- History Panel -->
  <section class="history-panel" id="historyPanel" style="display:none" aria-label="Saved Prompts">
    <div class="history-header">
      <span class="settings-title">Saved Prompts</span>
      <button class="btn btn-sm btn-ghost danger-btn" id="clearHistoryBtn" aria-label="Clear all saved prompts">Clear all</button>
    </div>
    <div class="history-list" id="historyList" role="list">
      <p class="empty-state">No saved prompts yet.</p>
    </div>
  </section>

  <!-- Controls -->
  <div class="mode-section">
    <div class="focus-row" id="focusRow">
      <span class="field-label" id="focusLabel">Focus</span>
      <div class="focus-chips" role="radiogroup" aria-labelledby="focusLabel">
        <button class="chip active" data-focus="all" role="radio" aria-checked="true">All</button>
        <button class="chip" data-focus="colors" role="radio" aria-checked="false">Colors</button>
        <button class="chip" data-focus="typography" role="radio" aria-checked="false">Type</button>
        <button class="chip" data-focus="shadows" role="radio" aria-checked="false">Shadow</button>
        <button class="chip" data-focus="motion" role="radio" aria-checked="false">Motion</button>
        <button class="chip" data-focus="layout" role="radio" aria-checked="false">Layout</button>
        <button class="chip" data-focus="components" role="radio" aria-checked="false">Components</button>
      </div>
    </div>
  </div>

  <!-- Action -->
  <div class="action-section">
    <button class="btn btn-primary btn-full" id="analyzeBtn" aria-label="Analyze page design">
      <span id="analyzeBtnIcon" aria-hidden="true">◫</span>
      <span id="analyzeBtnText">Analyze Page</span>
    </button>
  </div>

  <!-- Result -->
  <section class="result-section" id="resultSection" style="display:none" aria-label="Analysis Result">
    <div class="restored-banner" id="restoredBanner" style="display:none" role="status">
      <span class="restored-icon" aria-hidden="true">⟳</span>
      <span class="restored-text">Restored from last session</span>
      <button class="btn btn-sm btn-primary" id="newPromptBtn">New prompt</button>
    </div>
    <div class="result-header">
      <div class="result-meta" id="resultMeta"></div>
      <div class="result-actions">
        <button class="btn btn-sm btn-ghost" id="copyBtn" aria-label="Copy prompt to clipboard"><span id="copyIcon" aria-hidden="true">⎘</span> Copy</button>
        <button class="btn btn-sm btn-ghost" id="exportTokensBtn" aria-label="Export design tokens as JSON">JSON</button>
        <button class="btn btn-sm btn-ghost" id="resetBtn" aria-label="Reset and start over">↺</button>
      </div>
    </div>
    <div class="save-indicator" id="saveIndicator" style="display:none" role="status">
      <span class="save-dot" aria-hidden="true">●</span> Auto-saved
    </div>
    <div class="output-tabs" id="outputTabs" style="display:none" role="tablist" aria-label="Output mode">
      <button class="output-tab active" data-output="full" role="tab" aria-selected="true">Full Page</button>
      <button class="output-tab" data-output="system" role="tab" aria-selected="false">Global Tokens</button>
    </div>
    <div class="prompt-container">
      <pre class="prompt-output" id="promptOutput" tabindex="0" aria-label="Generated prompt"></pre>
    </div>
  </section>

  <!-- Loading -->
  <div class="loading-section" id="loadingSection" style="display:none" role="status" aria-live="polite">
    <div class="loading-animation" aria-hidden="true">
      <div class="loading-bar"></div>
      <div class="loading-bar"></div>
      <div class="loading-bar"></div>
    </div>
    <p class="loading-text" id="loadingText">Analyzing…</p>
  </div>

  <!-- Error -->
  <div class="error-section" id="errorSection" style="display:none" role="alert">
    <span class="error-icon" aria-hidden="true">⚠</span>
    <p class="error-text" id="errorText"></p>
    <button class="btn btn-sm" id="errorRetryBtn">Retry</button>
  </div>
`;

// ── INIT ──────────────────────────────────────────────────────────────────
async function initUI() {
  // Inject shared template if app container is empty
  const appEl = document.querySelector('.app');
  if (appEl && !appEl.querySelector('.header')) {
    appEl.innerHTML = APP_TEMPLATE;
  }

  const vb = document.getElementById('versionBadge');
  if (vb) vb.textContent = 'v' + chrome.runtime.getManifest().version;

  const stored = await chrome.storage.local.get(['provider','apiKeys','dp_pending','selectedModels','savedFocus']);
  state.provider = stored.provider || 'gemini';
  state.apiKeys = stored.apiKeys || {};
  state.selectedModels = stored.selectedModels || {};
  // Restore persisted focus
  if (stored.savedFocus) {
    state.focus = stored.savedFocus;
    document.querySelectorAll('.chip[data-focus]').forEach(c => {
      c.classList.toggle('active', c.dataset.focus === state.focus);
    });
  }

  try {
    const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
    state.currentUrl = tab?.url || '';
  } catch(e) { console.debug('[VibeDesign] Tab query:', e.message); }

  // URL badge
  const urlBadge = $('urlBadge');
  if (urlBadge && state.currentUrl) urlBadge.textContent = safeHostname(state.currentUrl);

  renderProviderUI();
  setupListeners();

  // Hook: extra init (e.g. tab tracking for sidepanel)
  if (_uiHooks.afterListeners) _uiHooks.afterListeners();

  // Pending picker result
  const pending = stored.dp_pending;
  if (pending && pending.timestamp && (Date.now() - pending.timestamp) < 5 * 60 * 1000) {
    await chrome.storage.local.remove('dp_pending');
    if (pending.type === 'ELEMENT_PICKED') {
      setTimeout(() => buildPromptFromData(pending.data, 'element'), 80);
      return;
    }
    if (pending.type === 'IMAGE_PICKED') {
      setTimeout(() => handleImagePicked(pending.data), 80);
      return;
    }
  } else if (pending) {
    await chrome.storage.local.remove('dp_pending');
  }

  // Auto-restore last prompt for current domain
  if (state.currentUrl) {
    const domain = safeHostname(state.currentUrl);
    const historyStored = await chrome.storage.local.get(HISTORY_KEY);
    const history = historyStored[HISTORY_KEY] || {};
    const domainEntries = Object.values(history).filter(e => e.domain === domain);
    const savedItem = domainEntries.sort((a,b) => b.savedAt - a.savedAt)[0];
    if (savedItem && savedItem.prompt) {
      state.lastPrompt = savedItem.prompt;
      if (savedItem.focus) {
        state.focus = savedItem.focus;
        document.querySelectorAll('.chip[data-focus]').forEach(c => {
          c.classList.toggle('active', c.dataset.focus === savedItem.focus);
        });
      }
      showResult(savedItem.prompt, { url: savedItem.url || state.currentUrl }, savedItem.source, savedItem.provider, true);
      $('saveIndicator').style.display = 'none';
    }
  }

  const { settings_panel_open } = await chrome.storage.local.get('settings_panel_open');
  $('settingsPanel').style.display = settings_panel_open ? 'flex' : 'none';
}

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
      { id: 'gemini-2.5-pro',         label: 'Pro 2.5',        note: 'Paid · Powerful'    },
      { id: 'gemini-3-flash',         label: 'Flash 3',        note: 'Paid · Next gen'    },
      { id: 'gemini-3.1-pro-preview', label: 'Pro 3.1',        note: 'Paid · Best'        },
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
  mode:'page', platform:'generic', focus:'all', imgFocus:'full',
  contentMode:'site', customContent:'',
  pickerActive:false, imagePickerActive:false,
  lastPrompt:'', capturedImageData:null,
  lastAnalyzedData:null, lastAiDirection:null,
  provider:'gemini', apiKeys:{}, selectedModels:{},
  currentUrl:'',
  fusionPanelOpen: false,
  fusionAutoMode: true,
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

  // Block unsupported pages early
  const url = tab?.url || '';
  if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:') || url.startsWith('edge://')) {
    showError('Cannot analyze browser internal pages. Navigate to a website first.');
    return;
  }

  try {
    showLoading('Analyzing DOM…');
    const injected = await injectContentScript(tab.id);
    if (!injected) throw new Error('Could not inject into this page. The site may block extensions — try refreshing.');

    // Send to all frames and pick the richest response (most sections/colors)
    let resp;
    try {
      const allFrames = await chrome.webNavigation.getAllFrames({ tabId: tab.id }).catch(() => null);
      if (allFrames && allFrames.length > 1) {
        // Multi-frame: collect responses from all frames, pick best
        const responses = await Promise.allSettled(
          allFrames.map(f => chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PAGE' }, { frameId: f.frameId })
            .catch(() => null))
        );
        const valid = responses
          .filter(r => r.status === 'fulfilled' && r.value?.success)
          .map(r => r.value);
        // Score: prefer response with most sections + most colors
        resp = valid.sort((a, b) => {
          const scoreA = (a.data?.sectionContentMap?.length || 0) * 3 + (a.data?.colors?.length || 0);
          const scoreB = (b.data?.sectionContentMap?.length || 0) * 3 + (b.data?.colors?.length || 0);
          return scoreB - scoreA;
        })[0] || null;
      }
      if (!resp) {
        resp = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PAGE' });
      }
    } catch(msgErr) {
      throw new Error('Page did not respond. Refresh the page and try again.');
    }

    if (!resp?.success) throw new Error(resp?.error || 'Could not get page data. Refresh and try again.');
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
    // Inject into all frames — some sites (Aura Build, Framer previews) render
    // content inside iframes. Content script will respond from the richest frame.
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['content.js'] });
    return true;
  } catch(e) {
    console.warn('[VibeDesign] Script injection failed:', e.message);
    return false;
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

  // Show "Add to Fusion" button (hide for fusion results)
  const addFusionBtn = $('addToFusionBtn');
  if (addFusionBtn) {
    const isFusionResult = data.url && data.url.startsWith('fusion://');
    addFusionBtn.style.display = (source === 'page' && !isFusionResult) ? 'inline-flex' : 'none';
    addFusionBtn.textContent = '⚡ Add to Fusion';
    addFusionBtn.disabled = false;
  }

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
  $('errorRetryBtn').addEventListener('click', handleAnalyze);

  $('newPromptBtn').addEventListener('click', () => {
    $('restoredBanner').style.display = 'none';
    resetView();
    if (!state.apiKeys[state.provider] && state.provider !== 'none') {
      $('settingsPanel').style.display = 'flex';
    }
  });

  // Fusion
  const fusionToggle = $('fusionToggle');
  if (fusionToggle) fusionToggle.addEventListener('click', toggleFusionPanel);
  const addFusionBtn = $('addToFusionBtn');
  if (addFusionBtn) addFusionBtn.addEventListener('click', addToFusion);
  const clearFusionBtn = $('clearFusionBtn');
  if (clearFusionBtn) clearFusionBtn.addEventListener('click', async () => {
    await clearFusionCollection();
    renderFusionPanel();
  });
  const genFusionBtn = $('generateFusionBtn');
  if (genFusionBtn) genFusionBtn.addEventListener('click', generateFusionPrompt);

  chrome.runtime.onMessage.addListener(msg => {
    // Reserved for future use
  });

  if (_uiHooks.extraListeners) _uiHooks.extraListeners();
}

// ── INIT ──────────────────────────────────────────────────────────────────
async function initUI() {
  const vb = document.getElementById('versionBadge');
  if (vb) vb.textContent = 'v' + chrome.runtime.getManifest().version;

  const stored = await chrome.storage.local.get(['provider','apiKeys','dp_pending','selectedModels']);
  state.provider = stored.provider || 'gemini';
  state.apiKeys = stored.apiKeys || {};
  state.selectedModels = stored.selectedModels || {};

  try {
    const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
    state.currentUrl = tab?.url || '';
  } catch(e) { console.debug('[VibeDesign] Tab query:', e.message); }

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

  // Load fusion state
  const fusionCol = await loadFusionCollection().catch(() => ({ sites: [] }));
  updateFusionBadge(fusionCol.sites.length);
  const { fusionAutoMode } = await chrome.storage.local.get('fusionAutoMode');
  state.fusionAutoMode = fusionAutoMode !== undefined ? fusionAutoMode : true;
}

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN FUSION UI
// ═══════════════════════════════════════════════════════════════════════════

const FUSION_LAYERS = ['colors', 'typography', 'motion', 'shadows', 'layout', 'components'];
const FUSION_LAYER_LABELS = {
  colors: 'Colors', typography: 'Type', motion: 'Motion',
  shadows: 'Shadow', layout: 'Layout', components: 'Components',
};

function toggleFusionPanel() {
  const fp = $('fusionPanel');
  if (!fp) return;
  const opening = fp.style.display === 'none';
  fp.style.display = opening ? 'flex' : 'none';
  $('settingsPanel').style.display = 'none';
  $('historyPanel').style.display = 'none';
  state.fusionPanelOpen = opening;
  if (opening) renderFusionPanel();
}

async function addToFusion() {
  if (!state.lastAnalyzedData) return;
  const collection = await addSiteToFusion(state.lastAnalyzedData);
  // Flash confirmation
  const btn = $('addToFusionBtn');
  if (btn) {
    btn.textContent = '✓ Added';
    btn.disabled = true;
    setTimeout(() => { btn.textContent = '⚡ Add to Fusion'; btn.disabled = false; }, 2000);
  }
  // Update fusion panel badge
  updateFusionBadge(collection.sites.length);
}

function updateFusionBadge(count) {
  const badge = $('fusionBadge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

async function renderFusionPanel() {
  const collection = await loadFusionCollection();
  const sitesEl = $('fusionSites');
  const layersEl = $('fusionLayers');
  const genBtn = $('generateFusionBtn');
  if (!sitesEl) return;

  updateFusionBadge(collection.sites.length);

  if (collection.sites.length === 0) {
    sitesEl.innerHTML = '<p class="empty-state">Analyze sites and click "Add to Fusion" to start mixing design layers.</p>';
    if (layersEl) layersEl.style.display = 'none';
    if (genBtn) genBtn.style.display = 'none';
    return;
  }

  // Render site list
  sitesEl.innerHTML = '';
  collection.sites.forEach(site => {
    const el = document.createElement('div');
    el.className = 'fusion-site-item';

    // Color preview dots
    const dotsHtml = (site.preview?.colors || []).map(c =>
      `<span class="fusion-color-dot" style="background:${c}"></span>`
    ).join('');

    const domain = document.createElement('span');
    domain.className = 'fusion-site-domain';
    domain.textContent = site.domain;

    const dots = document.createElement('span');
    dots.className = 'fusion-color-dots';
    dots.innerHTML = dotsHtml;

    const font = document.createElement('span');
    font.className = 'fusion-site-font';
    font.textContent = site.preview?.font || '';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'fusion-site-remove';
    removeBtn.textContent = '✕';
    removeBtn.title = 'Remove from fusion';
    removeBtn.setAttribute('aria-label', `Remove ${site.domain} from fusion`);
    removeBtn.addEventListener('click', async () => {
      await removeSiteFromFusion(site.domain);
      renderFusionPanel();
    });

    el.appendChild(domain);
    el.appendChild(dots);
    el.appendChild(font);
    el.appendChild(removeBtn);
    sitesEl.appendChild(el);
  });

  // Show layer selection + mode toggle with 2+ sites
  if (collection.sites.length >= 2) {
    if (layersEl) layersEl.style.display = 'flex';
    if (genBtn) genBtn.style.display = 'flex';
    renderFusionModeToggle(collection);
    renderFusionLayers(collection);
  } else {
    if (layersEl) layersEl.style.display = 'none';
    if (genBtn) genBtn.style.display = 'none';
  }
}

function renderFusionModeToggle(collection) {
  const layersEl = $('fusionLayers');
  if (!layersEl) return;

  // Remove existing toggle if present
  const existing = layersEl.querySelector('.fusion-mode-row');
  if (existing) existing.remove();

  const row = document.createElement('div');
  row.className = 'fusion-mode-row';

  const autoBtn = document.createElement('button');
  autoBtn.className = 'chip fusion-mode-btn' + (state.fusionAutoMode !== false ? ' active' : '');
  autoBtn.textContent = '✨ Auto';
  autoBtn.title = 'AI picks the strongest site per layer automatically';
  autoBtn.addEventListener('click', async () => {
    state.fusionAutoMode = true;
    await chrome.storage.local.set({ fusionAutoMode: true });
    await applyAutoFusion();
    renderFusionPanel();
  });

  const manualBtn = document.createElement('button');
  manualBtn.className = 'chip fusion-mode-btn' + (state.fusionAutoMode === false ? ' active' : '');
  manualBtn.textContent = '🎛 Manual';
  manualBtn.title = 'You pick which site provides each design layer';
  manualBtn.addEventListener('click', async () => {
    state.fusionAutoMode = false;
    await chrome.storage.local.set({ fusionAutoMode: false });
    renderFusionPanel();
  });

  row.appendChild(autoBtn);
  row.appendChild(manualBtn);
  layersEl.prepend(row);
}

function renderFusionLayers(collection) {
  const layersEl = $('fusionLayers');
  if (!layersEl) return;

  // Preserve mode toggle row, only clear layer rows
  const modeRow = layersEl.querySelector('.fusion-mode-row');
  layersEl.innerHTML = '';
  if (modeRow) layersEl.appendChild(modeRow);

  for (const layer of FUSION_LAYERS) {
    const row = document.createElement('div');
    row.className = 'fusion-layer-row';

    const label = document.createElement('span');
    label.className = 'field-label';
    label.textContent = FUSION_LAYER_LABELS[layer];
    row.appendChild(label);

    const chips = document.createElement('div');
    chips.className = 'fusion-layer-chips';

    const selected = collection.selections[layer] || collection.sites[0]?.domain;

    for (const site of collection.sites) {
      const chip = document.createElement('button');
      chip.className = 'chip' + (site.domain === selected ? ' active' : '');
      chip.textContent = site.domain.replace(/\.(com|io|app|dev|ai|org|net)$/, '');
      chip.title = site.domain;
      chip.addEventListener('click', async () => {
        state.fusionAutoMode = false; // manual override
        await updateFusionSelection(layer, site.domain);
        const updated = await loadFusionCollection();
        renderFusionModeToggle(updated);
        renderFusionLayers(updated);
      });
      chips.appendChild(chip);
    }

    row.appendChild(chips);
    layersEl.appendChild(row);
  }
}

async function generateFusionPrompt() {
  const collection = await loadFusionCollection();
  if (collection.sites.length < 2) return;

  const mergedData = mergeExtractedData(collection);
  if (!mergedData) return;

  showLoading('Generating fusion prompt…');

  // Build prompt using existing engine — no changes needed
  let aiDirection = null;
  const useAI = state.provider !== 'none' && !!state.apiKeys[state.provider];
  if (useAI) {
    showLoading(`Harmonizing with ${PROVIDERS[state.provider].name}…`);
    aiDirection = await generateDirectionWithAI(
      mergedData, state.provider, state.apiKeys[state.provider], getActiveModel(state.provider)
    );
  }

  const prompt = buildPagePrompt(mergedData, aiDirection);
  state.lastPrompt = prompt;
  state.lastAnalyzedData = mergedData;
  state.lastAiDirection = aiDirection;

  // Build source label
  const sel = collection.selections;
  const usedDomains = [...new Set(Object.values(sel))];
  const sourceLabel = usedDomains.join(' + ');

  showResult(prompt, { url: mergedData.url }, 'page', aiDirection ? state.provider : null, false);

  // Update meta with fusion source info
  const meta = $('resultMeta');
  if (meta) {
    meta.textContent = '';
    const fusionTag = document.createElement('span');
    fusionTag.className = 'fusion-result-tag';
    fusionTag.textContent = '⚡ Fusion';
    meta.appendChild(fusionTag);
    meta.appendChild(document.createTextNode(' — ' + sourceLabel));
  }

  flashSaveIndicator();
}

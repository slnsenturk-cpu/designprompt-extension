// DesignPrompt v9 — Side Panel version (stays open during picker interaction)

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const MAX_HISTORY = 30;  // max unique domains saved
const HISTORY_KEY = 'promptHistory';

const PROVIDERS = {
  gemini: {
    name: 'Gemini', color: '#4285f4', placeholder: 'AIza...',
    models: [
      { id: 'gemini-2.5-flash-lite',  label: 'Flash 2.5 Lite', note: 'Free · Fastest'    },
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

// Get the currently selected model id for a provider
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

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════
let state = {
  mode:'page', platform:'generic', focus:'all', imgFocus:'full',
  contentMode:'site', customContent:'',
  pickerActive:false, imagePickerActive:false,
  lastPrompt:'', capturedImageData:null,
  lastAnalyzedData:null, lastAiDirection:null,
  provider:'gemini', apiKeys:{}, selectedModels:{},
  currentUrl:'',
};

const $ = id => document.getElementById(id);

// ═══════════════════════════════════════════════════════════════════════════
// HISTORY STORAGE
// ═══════════════════════════════════════════════════════════════════════════
async function savePrompt(url, prompt, source, platform, focus) {
  const domain = safeHostname(url);
  const key = `${domain}::${focus || 'all'}`;
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  let history = stored[HISTORY_KEY] || {};

  // Upsert: same domain+focus → overwrite (1 prompt per domain per focus)
  history[key] = {
    domain,
    url,
    prompt,
    source,       // page | element | image
    platform,
    focus: focus || 'all',
    provider: state.provider !== 'none' ? state.provider : null,
    savedAt: Date.now(),
  };

  // Trim to MAX_HISTORY — evict oldest
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

// ═══════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════
async function init() {
  // Dynamic version badge from manifest
  const vb = document.getElementById('versionBadge');
  if (vb) vb.textContent = 'v' + chrome.runtime.getManifest().version;

  const stored = await chrome.storage.local.get(['provider','apiKeys','dp_pending','selectedModels']);
  state.provider = stored.provider || 'gemini';
  state.apiKeys = stored.apiKeys || {};
  state.selectedModels = stored.selectedModels || {};

  try {
    const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
    state.currentUrl = tab?.url || '';
  } catch(e) {}

  renderProviderUI();
  setupListeners();

  // Side panel: track tab switches to update context
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      state.currentUrl = tab?.url || '';
    } catch(e) {}
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (tab && tab.id === tabId) state.currentUrl = changeInfo.url;
      });
    }
  });

  // Check for pending picker result (written by content script while panel was closed)
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

  // Auto-restore last prompt for the current domain
  if (state.currentUrl) {
    const domain = safeHostname(state.currentUrl);
    const historyStored = await chrome.storage.local.get(HISTORY_KEY);
    const history = historyStored[HISTORY_KEY] || {};
    // Find the most recently saved entry for this domain (any focus)
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

  // Show settings panel based on last saved state
  const { settings_panel_open } = await chrome.storage.local.get('settings_panel_open');
  $('settingsPanel').style.display = settings_panel_open ? 'flex' : 'none';
}

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════
function renderProviderUI() {
  document.querySelectorAll('.provider-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.provider === state.provider));
  const cfg = PROVIDERS[state.provider];
  $('providerInfo').innerHTML = cfg.info;
  $('apiKeyRow').style.display = state.provider === 'none' ? 'none' : 'flex';
  $('apiKeyInput').placeholder = cfg.placeholder || '';
  $('apiKeyInput').value = state.apiKeys[state.provider] || '';

  // Model selector
  const modelRow = $('modelRow');
  if (cfg.models.length > 0) {
    modelRow.style.display = 'flex';
    const activeModel = getActiveModel(state.provider);
    modelRow.innerHTML = '<div style="width:100%"><span class="field-label">Model</span></div>'
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
  const modelStr = modelLabel ? `<span style="font-family:var(--font-mono);opacity:0.75">${modelLabel}</span>` : '';

  if (!hasKey) {
    $('settingsNote').innerHTML =
      '<span style="color:#f59e0b">⚠ No key — rule-based direction will be used instead of AI.</span>';
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
  renderProviderUI(); // refresh badge and warning
}

async function setProvider(provider) {
  state.provider = provider;
  await chrome.storage.local.set({ provider });
  renderProviderUI();
}

// ═══════════════════════════════════════════════════════════════════════════
// HISTORY UI
// ═══════════════════════════════════════════════════════════════════════════
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
    const providerDot = providerCfg
      ? `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${providerCfg.color};margin-right:2px"></span>${providerCfg.name}`
      : '';
    const focusLabel = item.focus && item.focus !== 'all'
      ? `<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:rgba(99,102,241,0.12);color:#818cf8;border:1px solid rgba(99,102,241,0.2)">${item.focus}</span>`
      : '';
    const itemKey = `${item.domain}::${item.focus || 'all'}`;

    el.innerHTML = `
      <span class="history-item-icon">${sourceIcon}</span>
      <div class="history-item-body">
        <div class="history-item-domain">${item.domain}</div>
        <div class="history-item-meta">
          <span>${timeStr}</span>
          ${focusLabel}
          ${item.platform && item.platform !== 'generic' ? `<span class="platform-badge">${item.platform}</span>` : ''}
          ${providerDot ? `<span style="font-size:9px;color:var(--text-3)">${providerDot}</span>` : ''}
        </div>
      </div>
      <button class="history-item-delete" data-key="${itemKey}" title="Delete">✕</button>
    `;

    // Click to restore prompt
    el.addEventListener('click', e => {
      if (e.target.classList.contains('history-item-delete')) return;
      restorePrompt(item);
    });

    // Delete button
    el.querySelector('.history-item-delete').addEventListener('click', async e => {
      e.stopPropagation();
      await deleteHistoryItem(itemKey);
      el.style.opacity = '0';
      el.style.transform = 'translateX(8px)';
      el.style.transition = 'all 0.2s ease';
      setTimeout(() => { el.remove(); if (!list.children.length) list.innerHTML = '<p class="empty-state">No saved prompts yet.</p>'; }, 200);
    });

    list.appendChild(el);
  });
}

function restorePrompt(item) {
  state.lastPrompt = item.prompt;
  $('historyPanel').style.display = 'none';
  $('saveIndicator').style.display = 'none';
  // Restore focus chip to match saved analysis
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

// ═══════════════════════════════════════════════════════════════════════════
// LISTENERS
// ═══════════════════════════════════════════════════════════════════════════
function setupListeners() {
  // Settings
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

  // History
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

  // Platform / focus
  document.querySelectorAll('[data-focus]').forEach(c =>
    c.addEventListener('click', () => setFocus(c.dataset.focus)));
  document.querySelectorAll('[data-content]').forEach(c =>
    c.addEventListener('click', () => setContentMode(c.dataset.content)));

  $('analyzeBtn').addEventListener('click', handleAnalyze);
  $('copyBtn').addEventListener('click', copyPrompt);
  document.querySelectorAll('.output-tab').forEach(t =>
    t.addEventListener('click', () => setOutputMode(t.dataset.output)));
  $('resetBtn').addEventListener('click', resetView);
  $('errorRetryBtn').addEventListener('click', handleAnalyze);

  // "New prompt" button in the restored-session banner
  $('newPromptBtn').addEventListener('click', () => {
    $('restoredBanner').style.display = 'none';
    resetView();
    // Show settings prompt if no key configured
    if (!state.apiKeys[state.provider] && state.provider !== 'none') {
      $('settingsPanel').style.display = 'flex';
    }
  });
  chrome.runtime.onMessage.addListener(msg => {
  });
}

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
  state.focus=f;
  document.querySelectorAll('[data-focus]').forEach(c=>c.classList.toggle('active',c.dataset.focus===f));
  // Auto-regenerate prompt with new focus if we have data
  if (state.lastAnalyzedData) {
    const prompt = buildPagePrompt(state.lastAnalyzedData, state.lastAiDirection);
    state.lastPrompt = prompt;
    const output = $('promptOutput');
    if (output) output.textContent = prompt;
  }
}

function updateAnalyzeBtn() {
  // Page-only mode
}


// ═══════════════════════════════════════════════════════════════════════════
// MAIN FLOW
// ═══════════════════════════════════════════════════════════════════════════
async function handleAnalyze() {
  const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
  state.currentUrl = tab?.url || '';

  try {
    showLoading('Analyzing DOM…');
    await injectContentScript(tab.id);
    const resp = await chrome.tabs.sendMessage(tab.id, {type:'EXTRACT_PAGE'});
    if (!resp?.success) throw new Error('Could not get page data. Refresh and try again.');
    const _pageData = resp.data;
    // Tier 2: Vision API illustration analysis (runs when hero image URL is available + AI provider set)
    if (_pageData.heroImageUrl && state.provider && state.provider !== 'none' && state.apiKeys[state.provider]) {
      try {
        showLoading('Analyzing hero illustration…');
        const _visionDesc = await analyzeIllustrationWithVision(
          _pageData.heroImageUrl, state.provider, state.apiKeys[state.provider],
          getActiveModel(state.provider)
        );
        if (_visionDesc) _pageData.visionIllustrationDescription = _visionDesc;
      } catch(e) { /* non-fatal — fall through to Tier 3 heuristics */ }
    }
    buildPromptFromData(_pageData, 'page');
  } catch(err) { showError(err.message||'An error occurred.'); }
}

async function injectContentScript(tabId) {
  try { await chrome.scripting.executeScript({target:{tabId},files:['content.js']}); } catch(e) {}
}
async function injectAndSend(tabId, msg) {
  await injectContentScript(tabId); return chrome.tabs.sendMessage(tabId, msg);
}



const LOADING_SECTION_HTML = `
  <div class="loading-animation">
    <div class="loading-bar"></div>
    <div class="loading-bar"></div>
    <div class="loading-bar"></div>
  </div>
  <p class="loading-text" id="loadingText">Analyzing…</p>
`;

function showLoading(text) {
  $('resultSection').style.display='none'; $('errorSection').style.display='none';
  const ls = $('loadingSection');
  // Restore original structure if showPickerLaunchScreen replaced it
  if (!$('loadingText')) ls.innerHTML = LOADING_SECTION_HTML;
  ls.style.display='flex';
  $('loadingText').textContent=text;
}

function showResult(prompt, data, source, providerUsed, isRestored = false) {
  $('loadingSection').style.display='none'; $('errorSection').style.display='none';
  $('promptOutput').textContent=prompt;

  // Only show the restored banner when explicitly restoring from storage
  $('restoredBanner').style.display = isRestored ? 'flex' : 'none';

  const srcLabel={page:'Page',element:'Element',image:'Image'}[source]||source;
  const meta=$('resultMeta');
  meta.innerHTML=`${srcLabel} — ${safeHostname(data.url||'')}`;

  if (providerUsed && PROVIDERS[providerUsed]) {
    const cfg = PROVIDERS[providerUsed];
    const label = getActiveModelLabel(providerUsed);
    const modelId = getActiveModel(providerUsed);
    meta.innerHTML += ` <span class="ai-badge" title="${cfg.name} · ${modelId}"><span class="ai-badge-dot" style="background:${cfg.color}"></span>${label}</span>`;
  } else {
    meta.innerHTML += ` <span class="ai-badge" style="opacity:0.5" title="No AI key — direction was generated by rule engine">rule-based</span>`;
  }

  // Show output mode tabs only for page analysis
  $('outputTabs').style.display = source === 'page' ? 'flex' : 'none';
  // Reset to Full Page tab
  document.querySelectorAll('.output-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.output === 'full'));

  $('resultSection').style.display='flex';
}

function flashSaveIndicator() {
  const ind = $('saveIndicator');
  ind.style.display = 'flex';
  setTimeout(() => { ind.style.display = 'none'; }, 3000);
}

function showError(msg){$('loadingSection').style.display='none';$('resultSection').style.display='none';$('errorText').textContent=msg;$('errorSection').style.display='flex';}
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
function copyPrompt(){if(!state.lastPrompt)return;copyToClipboard(state.lastPrompt);$('copyBtn').classList.add('copied');$('copyIcon').textContent='✓';setTimeout(()=>{$('copyBtn').classList.remove('copied');$('copyIcon').textContent='⎘';},2000);}
function copyToClipboard(text){navigator.clipboard.writeText(text).catch(()=>{const el=document.createElement('textarea');el.value=text;document.body.appendChild(el);el.select();document.execCommand('copy');document.body.removeChild(el);});}

init();

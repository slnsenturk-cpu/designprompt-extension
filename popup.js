// DesignPrompt v8 — Multi-provider AI + auto-save prompt history

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const MAX_HISTORY = 30;  // max unique domains saved
const HISTORY_KEY = 'promptHistory';

const PROVIDERS = {
  gemini: {
    name: 'Gemini', color: '#4285f4', placeholder: 'AIza...',
    models: [
      { id: 'gemini-2.0-flash',              label: 'Flash 2.0',   note: 'Free · Fast'         },
      { id: 'gemini-2.5-flash-preview-04-17',label: 'Flash 2.5',   note: 'Free · Better'       },
      { id: 'gemini-2.5-pro-preview-05-06',  label: 'Pro 2.5',     note: 'Paid · Best quality' },
    ],
    defaultModel: 'gemini-2.0-flash',
    info: 'Recommended. Free tier: 1,500 req/day. <a href="https://aistudio.google.com/apikey" target="_blank">Get key →</a>',
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
  lastAnalyzedData:null,
  provider:'gemini', apiKeys:{}, selectedModels:{},
  currentUrl:'',
};

const $ = id => document.getElementById(id);

// ═══════════════════════════════════════════════════════════════════════════
// HISTORY STORAGE
// ═══════════════════════════════════════════════════════════════════════════
async function savePrompt(url, prompt, source, platform) {
  const domain = safeHostname(url);
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  let history = stored[HISTORY_KEY] || {};

  // Upsert: same domain → overwrite (domain başına 1 prompt)
  history[domain] = {
    domain,
    url,
    prompt,
    source,       // page | element | image
    platform,
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

async function deleteHistoryItem(domain) {
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  const history = stored[HISTORY_KEY] || {};
  delete history[domain];
  await chrome.storage.local.set({ [HISTORY_KEY]: history });
}

async function clearHistory() {
  await chrome.storage.local.set({ [HISTORY_KEY]: {} });
}

// ═══════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════
async function init() {
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

  // Check for pending picker result (written by content script while popup was closed)
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
  // If a prompt was generated for this site before, show it immediately
  if (state.currentUrl) {
    const domain = safeHostname(state.currentUrl);
    const historyStored = await chrome.storage.local.get(HISTORY_KEY);
    const history = historyStored[HISTORY_KEY] || {};
    const savedItem = history[domain];
    if (savedItem && savedItem.prompt) {
      state.lastPrompt = savedItem.prompt;
      showResult(savedItem.prompt, { url: savedItem.url || state.currentUrl }, savedItem.source, savedItem.provider, true);
      $('saveIndicator').style.display = 'none';
    }
  }

  // Always show settings panel on open
  $('settingsPanel').style.display = 'flex';
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
  items.slice(0, 20).forEach(item => {
    const el = document.createElement('div');
    el.className = 'history-item';
    el.dataset.domain = item.domain;

    const timeStr = formatRelativeTime(item.savedAt);
    const sourceIcon = SOURCE_ICONS[item.source] || '◫';
    const providerCfg = item.provider ? PROVIDERS[item.provider] : null;
    const providerDot = providerCfg
      ? `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${providerCfg.color};margin-right:2px"></span>${providerCfg.name}`
      : '';

    el.innerHTML = `
      <span class="history-item-icon">${sourceIcon}</span>
      <div class="history-item-body">
        <div class="history-item-domain">${item.domain}</div>
        <div class="history-item-meta">
          <span>${timeStr}</span>
          ${item.platform && item.platform !== 'generic' ? `<span class="platform-badge">${item.platform}</span>` : ''}
          ${providerDot ? `<span style="font-size:9px;color:var(--text-3)">${providerDot}</span>` : ''}
        </div>
      </div>
      <button class="history-item-delete" data-domain="${item.domain}" title="Sil">✕</button>
    `;

    // Click to restore prompt
    el.addEventListener('click', e => {
      if (e.target.classList.contains('history-item-delete')) return;
      restorePrompt(item);
    });

    // Delete button
    el.querySelector('.history-item-delete').addEventListener('click', async e => {
      e.stopPropagation();
      await deleteHistoryItem(item.domain);
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
  return new Date(ts).toLocaleDateString('tr-TR', { day:'numeric', month:'short' });
}

// ═══════════════════════════════════════════════════════════════════════════
// LISTENERS
// ═══════════════════════════════════════════════════════════════════════════
function setupListeners() {
  // Settings
  $('settingsToggle').addEventListener('click', () => {
    const p = $('settingsPanel'), h = $('historyPanel');
    const opening = p.style.display === 'none';
    p.style.display = opening ? 'flex' : 'none';
    h.style.display = 'none';
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
    await clearHistory();
    await renderHistory();
  });

  // Platform / focus
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
    // Reserved for future use
  });
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  const focusRow = $('focusRow');
  if (focusRow) focusRow.style.display = mode === 'image' ? 'none' : 'flex';
  updateAnalyzeBtn();
  resetView();
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
function setFocus(f) { state.focus=f; document.querySelectorAll('[data-focus]').forEach(c=>c.classList.toggle('active',c.dataset.focus===f)); }
function setImgFocus(f) { state.imgFocus=f; document.querySelectorAll('[data-imgfocus]').forEach(c=>c.classList.toggle('active',c.dataset.imgfocus===f)); }

function updateAnalyzeBtn() {
  const btn=$('analyzeBtn'), icon=$('analyzeBtnIcon'), text=$('analyzeBtnText');
  btn.classList.remove('picker-active');
  $('pickerHint').style.display='none'; $('imagePickerHint').style.display='none';
  if (state.mode==='page') { icon.textContent='◫'; text.textContent='Analyze Page'; }
  else if (state.mode==='element') {
    if (state.pickerActive) { icon.textContent='✕'; text.textContent='Cancel'; btn.classList.add('picker-active'); $('pickerHint').style.display='block'; }
    else { icon.textContent='⊡'; text.textContent='Pick Element'; }
  } else {
    if (state.capturedImageData) { icon.textContent='⬚'; text.textContent='Analyze Image'; }
    else if (state.imagePickerActive) { icon.textContent='✕'; text.textContent='Cancel'; btn.classList.add('picker-active'); $('imagePickerHint').style.display='block'; }
    else { icon.textContent='⬚'; text.textContent='Pick Image'; }
  }
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
    buildPromptFromData(resp.data, 'page');
  } catch(err) { showError(err.message||'An error occurred.'); }
}

function showPickerLaunchScreen(mode) {
  // Hide everything else, show instruction
  $('loadingSection').style.display = 'none';
  $('resultSection').style.display = 'none';
  $('errorSection').style.display = 'none';

  const isImage = mode === 'image';
  const icon = isImage ? '⬚' : '⊡';
  const label = isImage ? 'Pick an image' : 'Pick an element';
  const sub = isImage
    ? 'Hover over an image and click.<br>Then click the extension icon again.'
    : 'Hover over any element and click.<br>Then click the extension icon again.';

  $('loadingSection').style.display = 'flex';
  $('loadingSection').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:8px 0">
      <span style="font-size:28px;opacity:0.6">${icon}</span>
      <span style="font-family:var(--font-mono);font-size:13px;color:var(--text);font-weight:500">${label}</span>
      <span style="font-size:11px;color:var(--text-3);text-align:center;line-height:1.6">${sub}</span>
      <span style="font-size:10px;color:var(--text-3);font-family:var(--font-mono)">ESC ile iptal</span>
    </div>
  `;
}

async function injectContentScript(tabId) {
  try { await chrome.scripting.executeScript({target:{tabId},files:['content.js']}); } catch(e) {}
}
async function injectAndSend(tabId, msg) {
  await injectContentScript(tabId); return chrome.tabs.sendMessage(tabId, msg);
}

// ═══════════════════════════════════════════════════════════════════════════
// AI DIRECTION
// ═══════════════════════════════════════════════════════════════════════════
async function generateDirectionWithAI(extractedData) {
  const provider = state.provider;
  const key = state.apiKeys[provider] || '';
  if (provider === 'none' || !key) return null;

  const vp = extractedData.visualProfile||{};
  const ui = vp.uiPatterns||{};

  const systemPrompt = `You are an expert design director writing a Designer Brief for vibe coding tools (v0.dev, Bolt, Lovable). Your output is a narrative that explains WHAT the design does, WHY each choice exists, and HOW it should feel — while embedding exact CSS values inline.

Rules:
- Write exactly 7 paragraphs, each 2–4 sentences maximum
- Each paragraph starts with a bold label: **Overall character**, **Section rhythm & visual hierarchy**, **Image usage & visual treatment**, **Typography**, **Color usage**, **Shape, elevation & component relationships**, **Interaction choreography & motion intent**
- Reference actual hex values and CSS measurements from the extracted data — embed them inline within narrative prose using backtick notation
- Be PRESCRIPTIVE and INTENTIONAL — every sentence must contain at least one concrete CSS value AND explain WHY that value exists or HOW it makes the user feel
- For every interaction state (hover, focus, active), describe how it FEELS to the user, not just what CSS property changes. Example: "On hover, the button brightens subtly (brightness 1.08, 200ms ease-out) — a gentle acknowledgment, not a flash."
- Explain component relationships — which elements share design vocabulary (same radius family, same shadow language) and why
- When describing animation/motion, explain the INTENT: "The glitch animation reinforces the terminal/hacker aesthetic" not just "CSS clip-rect animations"
- When describing section rhythm, explain the EMOTIONAL arc: "Light sections invite scanning, dark sections demand focus"
- When describing buttons: specify exact padding, border-radius, font-size/weight, hover behavior with CSS values, AND the physical metaphor
- When describing spacing: specify exact values AND the rhythm feel (generous/compact/breathing)
- Write in English
- Do NOT use markdown headers (##, ###) anywhere
- Keep each paragraph SHORT — 2–3 sentences only. This prevents truncation.
- Always complete every sentence fully.
- The vibe coding tool will use your values LITERALLY — be precise about numbers, narrative about intent.`;

  // Pre-compute semantic colors to tell AI explicitly
  const sc = extractSemanticColors(extractedData.cssVars||{});
  const pageBgForAI = extractedData.pageBackground || null;

  // Pre-compute font roles for AI — determine which is display and which is body
  const SYSTEM_FONTS_SET = new Set(['ui-sans-serif','ui-serif','ui-monospace','system-ui',
    '-apple-system','blinkmacsystemfont','helvetica neue','arial','sans-serif','serif','monospace']);
  const cleanedFonts = (extractedData.fonts||[]).filter(f=>f&&!SYSTEM_FONTS_SET.has(f.toLowerCase()));
  
  // Classify each font as mono/condensed-display/regular
  const MONO_KEYWORDS = ['mono','code','fira','jetbrains','courier','inconsolata','ibm plex mono','space mono','source code'];
  const DISPLAY_KEYWORDS = ['anton','impact','bebas','oswald','barlow condensed','black','ultra','heavy','poster'];
  
  function classifyFont(name) {
    const n = name.toLowerCase();
    if (MONO_KEYWORDS.some(k=>n.includes(k))) return 'mono';
    if (DISPLAY_KEYWORDS.some(k=>n.includes(k))) return 'display';
    return 'sans';
  }

  let fontRoleDisplay = '', fontRoleBody = '', fontRoleNote = '';
  if (cleanedFonts.length >= 2) {
    // Assign roles based on font characteristics
    const classified = cleanedFonts.slice(0,2).map(f=>({name:f, type:classifyFont(f)}));
    // Display font: prefer 'display' type, else 'sans', else first
    const displayCandidate = classified.find(f=>f.type==='display') || classified.find(f=>f.type==='sans') || classified[0];
    const bodyCandidate = classified.find(f=>f!==displayCandidate) || classified[1];
    fontRoleDisplay = displayCandidate.name;
    fontRoleBody = bodyCandidate.name;
    fontRoleNote = `Display/heading font: "${fontRoleDisplay}" — use for H1, H2, large section titles\nBody/UI font: "${fontRoleBody}" — use for paragraphs, labels, navigation, code`;
  } else if (cleanedFonts.length === 1) {
    fontRoleNote = `Single font: "${cleanedFonts[0]}" — all roles`;
  } else {
    fontRoleNote = 'System font stack (no custom font detected)';
  }

  // Classify shadow types for AI
  const shadowTypes = (extractedData.shadows||[]).map(s => {
    if (s.includes('inset')) return 'inset (border/depth effect, not elevation)';
    if (s.includes('oklab(') || s.includes('oklch(')) return 'oklab glow (colored elevation)';
    if (/0px 0px \d+px/.test(s) || /0 0 \d+px/.test(s)) return 'glow (0-offset, blur only)';
    if (s.split(',').length > 2) return 'layered drop shadow (elevation)';
    return 'drop shadow (elevation)';
  });

  // Build extracted specifics for AI
  const bs = extractedData.buttonStyles || {};
  const tp = extractedData.typographyPatterns || {};
  const spacing = vp.spacingSystem || {};
  const iconD = ui.iconDetails || {};

  let buttonDataStr = '';
  if (bs.primary) buttonDataStr += `\nButton primary (DOM-extracted): bg ${bs.primary.backgroundColor||'?'}, padding ${bs.primary.padding||'?'}, radius ${bs.primary.borderRadius||'?'}, font ${bs.primary.fontSize||'?'}/${bs.primary.fontWeight||'?'}`;
  if (bs.ghost) buttonDataStr += `\nButton ghost (DOM-extracted): border ${bs.ghost.border||'?'}, radius ${bs.ghost.borderRadius||'?'}`;

  let typoDataStr = '';
  if (tp.h1) typoDataStr += `\nH1 measured: ${tp.h1.fontSize}/${tp.h1.fontWeight}/${tp.h1.lineHeight}${tp.h1.letterSpacing ? ', tracking '+tp.h1.letterSpacing : ''}${tp.h1.fontFamily ? ', font "'+tp.h1.fontFamily+'"' : ''}`;
  if (tp.body) typoDataStr += `\nBody measured: ${tp.body.fontSize}/${tp.body.fontWeight}/${tp.body.lineHeight}${tp.body.fontFamily ? ', font "'+tp.body.fontFamily+'"' : ''}`;
  if (tp.label) typoDataStr += `\nLabel measured: ${tp.label.fontSize}/${tp.label.fontWeight}, ${tp.label.textTransform||'normal'}${tp.label.letterSpacing ? ', tracking '+tp.label.letterSpacing : ''}`;

  let spacingDataStr = '';
  if (spacing.sectionPaddingY) spacingDataStr += `\nSection padding vertical: ${spacing.sectionPaddingY}`;
  if (spacing.containerMaxWidth && spacing.containerMaxWidth !== 'none') spacingDataStr += `\nContainer max-width: ${spacing.containerMaxWidth}`;
  if (spacing.gridGap) spacingDataStr += `\nGrid gap: ${spacing.gridGap}`;

  let iconDataStr = '';
  if (ui.hasIconSystem && iconD.size) {
    iconDataStr = `\nIcon system (DOM-extracted): ${iconD.size}, ${iconD.strokeWidth||'?'}px stroke, ${iconD.containerStyle||'none'} container${iconD.containerBg ? ' bg '+iconD.containerBg : ''}${iconD.containerRadius ? ' radius '+iconD.containerRadius : ''}`;
  }

  const userPrompt = `Site: ${extractedData.url}
Page type: ${extractedData.layoutInfo?.pageType||'web page'}
Page background (dominant color by area): ${pageBgForAI||'unknown'}
Page mode: ${pageBgForAI ? (hexLum(pageBgForAI) < 0.25 ? '*** DARK SITE *** (luminance '+Math.round(hexLum(pageBgForAI)*100)+'%) — use dark-first language' : '*** LIGHT SITE *** (luminance '+Math.round(hexLum(pageBgForAI)*100)+'%) — NEVER describe as dark mode or dark background') : '*** LIGHT SITE (assumed) ***'}
${fontRoleNote}
Colors extracted: ${(extractedData.colors||[]).slice(0,8).join(', ')}
Accent/vibrant colors: ${(extractedData.accentColors||[]).slice(0,5).join(', ')}
CSS var --primary: ${sc.primary||'not found'}
Named color vars: ${sc.accent.map(a=>a.key+': '+a.value).join(', ')||'none'}
Border radii: ${(extractedData.borderRadii||[]).slice(0,5).join(', ')}
Shadows detected: ${shadowTypes.join(' | ')||'none'}
Has glassmorphism: ${vp.hasGlassmorphism||false}
Has noise/grain texture: ${vp.hasNoiseTexture||false}
Nav style: ${vp.navStyle||'default'}
Section color pattern: ${vp.sectionColorPattern||'unknown'}
Section color sequence: ${(()=>{const scm=extractedData.sectionContentMap||[];const seq=scm.filter(s=>s.bgColor||s.gradient).map((s,i)=>{let d=`S${i+1}(${s.type}):${s.bgColor||'transparent'}`;if(s.gradient)d+='+gradient';return d;});return seq.length>0?seq.join(' → '):'uniform (sections inherit page bg)';})()}
Image treatment: ${vp.imageTreatment||'none'}
Has scroll animation: ${vp.hasScrollAnimation||false}
Animation patterns: textReveal=${(vp.animationPatterns||{}).hasTextReveal||false}, maskReveal=${(vp.animationPatterns||{}).hasMaskReveal||false}, arrowAnimation=${(vp.animationPatterns||{}).hasArrowAnimation||false}, slider=${(vp.animationPatterns||{}).hasSlider||false}(${(vp.animationPatterns||{}).sliderType||'none'}), heroAnimation=${(vp.animationPatterns||{}).hasHeroAnimation||false}, staggerReveal=${(vp.animationPatterns||{}).hasStaggerReveal||false}
Hover states found: ${(extractedData.hoverStates||[]).length} rules${(extractedData.hoverStates||[]).slice(0,5).map(h=>{const{selector,...p}=h;return `\n  ${selector}: ${Object.entries(p).map(([k,v])=>k+':'+v).join(', ')}`;}).join('')}
Blend modes: ${(vp.blendModes||[]).join(', ')||'none'}
Split sections: ${vp.splitLayoutCount||0}
UI patterns: marquee=${ui.hasMarquee}, logoStrip=${ui.hasLogoStrip}, pricing=${ui.hasPricingGrid}(${ui.pricingColumnCount}col), carousel=${ui.hasTestimonialCarousel}, video=${ui.hasVideoSection}, darkFooter=${ui.hasDarkFooter}, decorativeGeometry=${ui.hasDecorativeGeometry}, iconSystem=${ui.hasIconSystem}(${ui.iconStyle||'none'},${ui.iconSystemCount||0}icons), arrowLinks=${ui.hasArrowLinks}(color:${ui.arrowLinkColor||'unknown'})
Page structure: ${(ui.pageStructure||[]).join(' → ')}
${buttonDataStr}${typoDataStr}${spacingDataStr}${iconDataStr}

IMPORTANT — follow these rules exactly:
1. FONTS: "${fontRoleDisplay||cleanedFonts[0]||'display font'}" = display/heading. "${fontRoleBody||cleanedFonts[1]||'body font'}" = body/UI. Never swap. Never say "likely".
2. PRIMARY COLOR: "${sc.primary||((extractedData.accentColors||[])[0]||'accent')}" = primary action. Other named accents have distinct secondary roles — state them explicitly.
3. SHADOWS: Inset = border effect, not elevation. Oklab = colored glow.
4. HERO: If page background is light — hero uses the page background color, NOT photography with dark overlay. If decorativeGeometry=true, mention subtle background decoration but do NOT describe specific patterns (no grid lines, no crop marks, no dot arrays). Keep decoration description minimal.
5. SECTION RHYTHM: sectionColorPattern="${vp.sectionColorPattern||'unknown'}". uniform-light = page stays light throughout (never say "darker sections" or "dark overlay"). uniform-dark = consistently dark. progressive-dark = light top, dark bottom. alternating = explicit flips.
6. DARK/LIGHT OVERRIDE: The "Page mode" field above is the ABSOLUTE ground truth. If it says LIGHT SITE — you MUST describe a light-background design. Do NOT mention dark mode, dark background, or near-black surfaces. If it says DARK SITE — describe dark-first. This overrides all other signals.
7. IMAGE TREATMENT: imageTreatment="${vp.imageTreatment||'none'}". Only describe "cinematic photography" if imageTreatment=cinematic. If none/screenshot — describe geometric visuals, product UI, or functional imagery. Never invent photography that isn't there.
8. ICONS: If iconSystem=true — mention the ${ui.iconStyle||'outlined'} icon style paired with feature headings.${iconD.size ? ` Size: ${iconD.size}, stroke: ${iconD.strokeWidth||'?'}px.` : ''}
9. ARROW LINKS: If arrowLinks=true — describe "Learn more →" text CTA with ${ui.arrowLinkColor||'accent'} color as distinct secondary action pattern.
10. BUTTONS: ${bs.primary ? `Primary button has padding ${bs.primary.padding}, radius ${bs.primary.borderRadius}, font ${bs.primary.fontSize}/${bs.primary.fontWeight}. Reference these EXACT values.` : 'No button data extracted — describe button style based on overall design character.'}
11. SPACING: ${spacing.sectionPaddingY ? `Section padding is ${spacing.sectionPaddingY} vertical. Grid gap is ${spacing.gridGap||'unknown'}.` : 'No spacing data — estimate based on design density.'} Reference exact values.

CRITICAL: The measurements above are extracted from the actual DOM. When you reference button padding, typography sizes, section spacing, or icon dimensions — use these EXACT extracted values, not estimates. The vibe coding tool will use your numbers literally.

Write exactly 7 short paragraphs (2–3 sentences each), bold label at start: **Overall character**, **Section rhythm & visual hierarchy**, **Image usage & visual treatment**, **Typography**, **Color usage**, **Shape, elevation & component relationships**, **Interaction choreography & motion intent**. Never truncate. Embed hex values and px measurements within narrative prose that explains WHY each choice exists.`;

  try {
    let text = '';
    if (provider === 'gemini') {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${getActiveModel('gemini')}:generateContent?key=${key}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({system_instruction:{parts:[{text:systemPrompt}]},contents:[{parts:[{text:userPrompt}],role:'user'}],generationConfig:{maxOutputTokens:1500,temperature:0.4}})});
      if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(`Gemini: ${e.error?.message||r.status}`); }
      const d=await r.json(); text=d.candidates?.[0]?.content?.parts?.[0]?.text||'';
    } else if (provider === 'claude') {
      const r = await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:getActiveModel('claude'),max_tokens:1500,system:systemPrompt,messages:[{role:'user',content:userPrompt}]})});
      if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(r.status===401?'Claude: Invalid key.':r.status===429?'Claude: Rate limit.':`Claude: ${e.error?.message||r.status}`); }
      const d=await r.json(); text=d.content?.[0]?.text||'';
    } else if (provider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},body:JSON.stringify({model:getActiveModel('openai'),max_tokens:1500,temperature:0.4,messages:[{role:'system',content:systemPrompt},{role:'user',content:userPrompt}]})});
      if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(r.status===401?'OpenAI: Invalid key.':r.status===429?'OpenAI: Rate limit.':`OpenAI: ${e.error?.message||r.status}`); }
      const d=await r.json(); text=d.choices?.[0]?.message?.content||'';
    }
    return text.trim()||null;
  } catch(err) { console.warn('AI direction failed, rule engine fallback:', err.message); return null; }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function hexLum(hex) { if(!hex||hex.length<4)return 0.5; const h=hex.length===4?'#'+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3]:hex; const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); return(0.299*r+0.587*g+0.114*b)/255; }
function hexSat(hex) { if(!hex||hex.length<4)return 0; const h=hex.length===4?'#'+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3]:hex; const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); return Math.max(r,g,b)-Math.min(r,g,b); }
function safeHostname(url) { try{return new URL(url).hostname;}catch{return 'unknown';} }
function dedupeColors(colors) { const s=new Set(); return colors.filter(c=>{if(!c||c.length<4)return false;const n=c.toLowerCase();if(s.has(n))return false;s.add(n);return true;}); }
function guessElementType(data) {
  const tag=data.tag||'',cls=(data.classes||'').toLowerCase();
  if(tag==='button'||cls.includes('btn'))return'Button'; if(tag==='nav'||cls.includes('navbar'))return'Navigation';
  if(tag==='header')return'Header'; if(tag==='footer')return'Footer'; if(cls.includes('card'))return'Card';
  if(tag==='input'||tag==='textarea')return'Input'; if(cls.includes('hero')||cls.includes('banner'))return'Hero';
  if(cls.includes('modal'))return'Modal'; if(tag==='a')return'Link'; return`<${tag}>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// RULE-BASED DIRECTION (fallback)
// ═══════════════════════════════════════════════════════════════════════════
function analyzeDesignStyle(data) {
  const colors=data.colors||[], accents=data.accentColors||[], fonts=(data.fonts||[]).filter(Boolean);
  const shadows=data.shadows||[], radii=data.borderRadii||[], vars=data.cssVars||{};
  const vp=data.visualProfile||{};
  const allColors=[...colors,...accents];

  // dark/light strictly from actual page background scan
  // heuristicBg only as last resort if detectActualPageBackground() returned null
  const sorted = dedupeColors(colors).sort((a,b)=>hexLum(b)-hexLum(a));
  const heuristicBg = sorted.find(c => hexLum(c) > 0.5 && hexSat(c) < 50)
    || sorted.find(c => hexSat(c) < 50)  // any low-sat color
    || null; // don't guess if we have nothing reliable

  const pageBg = data.pageBackground || heuristicBg;
  // If we genuinely don't know, default to light (most sites are light)
  const pageBgLum = pageBg ? hexLum(pageBg) : 0.85;
  const isDark = pageBgLum < 0.35;
  const isLight = pageBgLum > 0.5;

  const sats=allColors.map(hexSat), avgSat=sats.length?sats.reduce((a,b)=>a+b,0)/sats.length:0;
  const vibrantColors=allColors.filter(h=>hexSat(h)>80);
  const isVibrant=vibrantColors.length>0, isMonochromatic=avgSat<25;
  const warmColors=allColors.filter(h=>{const r=parseInt(h.slice(1,3),16),b=parseInt(h.slice(5,7),16);return r-b>40;});
  const coolColors=allColors.filter(h=>{const r=parseInt(h.slice(1,3),16),b=parseInt(h.slice(5,7),16);return b-r>40;});
  const isCool=coolColors.length>warmColors.length, isWarm=warmColors.length>coolColors.length;

  // Fix 2: semantic colors from CSS vars — --primary etc. are designer intent
  const semanticColors = extractSemanticColors(vars);

  const primaryFont=(fonts[0]||'').toLowerCase();
  const isSerif=['georgia','merriweather','lora','playfair','freight','garamond','caslon','cormorant','baskerville'].some(f=>primaryFont.includes(f));
  const isMono=['mono','code','fira','jetbrains','courier','inconsolata'].some(f=>primaryFont.includes(f));
  const hasTwoFonts=fonts.length>=2;

  // Fix 3: 50% = circles/avatars, not interactive radius — exclude from pill detection
  const interactiveRadii = radii.filter(r=>!r.includes('50%'));
  const hasFullRound=interactiveRadii.some(r=>r.includes('9999')||r.includes('1000')||parseInt(r)>100);
  const hasSharpCorners=interactiveRadii.some(r=>parseInt(r)<=4&&r!=='0px');
  const hasRoundedCorners=interactiveRadii.some(r=>parseInt(r)>=8&&parseInt(r)<=32);

  // Glow = zero x/y offset with large blur, OR oklab/colored shadow (modern glow technique)
  const hasGlowEffect=shadows.some(s=>
    /\b0px\s+0px\s+\d+px/.test(s) ||       // traditional 0 0 blur glow
    /\b0\s+0\s+\d+px/.test(s) ||            // compact form
    s.includes('oklab(') ||                  // modern oklab glow (e.g. Koyeb)
    s.includes('oklch(')                     // oklch color glow
  );
  const hasLayeredShadows=shadows.some(s=>s.split(',').length>2);
  const hasColoredShadows=shadows.some(s=>!/rgba\(0,\s*0,\s*0|rgba\(255,\s*255,\s*255/.test(s)&&s!=='none');

  const hasBrutalistShadow = shadows.some(s => /\d+px\s+\d+px\s+0(px)?\s/.test(s));
  const hoverStates = data.hoverStates || [];
  const brutalistHoverShadows = hoverStates.filter(h =>
    h['box-shadow'] && /\d+px\s+\d+px\s+0(px)?\s/.test(h['box-shadow'])
  );
  const keyframes = data.keyframes || [];
  const hasGlitchAnimation = keyframes.some(k =>
    /glitch/i.test(k.name) || (typeof k.from === 'object' && k.from.clip) || (typeof k.to === 'object' && k.to.clip)
  );
  const hasPulseAnimation = keyframes.some(k => /pulse|ping|beacon/i.test(k.name));
  const hasBlinkAnimation = keyframes.some(k => /blink|flicker/i.test(k.name));
  const hasTickerAnimation = keyframes.some(k => /ticker|marquee|scroll/i.test(k.name));

  const sectionRhythm = vp?.sectionRhythm || [];
  let hasHardBgTransition = false;
  let hardTransitionColors = null;
  for (let i = 0; i < sectionRhythm.length - 1; i++) {
    const curr = sectionRhythm[i]?.bgHex;
    const next = sectionRhythm[i+1]?.bgHex;
    if (curr && next && curr !== next) {
      const lumDiff = Math.abs(hexLum(curr) - hexLum(next));
      if (lumDiff > 0.3) {
        hasHardBgTransition = true;
        hardTransitionColors = { from: curr, to: next };
        break;
      }
    }
  }

  return {
    isDark, isLight, isVibrant, isMonochromatic, isCool, isWarm,
    isSerif, isMono, hasTwoFonts,
    hasFullRound, hasSharpCorners, hasRoundedCorners,
    hasGlowEffect, hasLayeredShadows, hasColoredShadows,
    hasBrutalistShadow, brutalistHoverShadows,
    hasGlitchAnimation, hasPulseAnimation, hasBlinkAnimation, hasTickerAnimation,
    hasHardBgTransition, hardTransitionColors,
    vibrantColors, darkColors:allColors.filter(h=>hexLum(h)<0.18),
    lightColors:allColors.filter(h=>hexLum(h)>0.82),
    fonts, layout:data.layoutInfo||{}, vp,
    allColors, accents, colors, shadows, radii,
    pageBg, pageBgLum, semanticColors,
  };
}

// Extract semantic intent from CSS custom property names
// --primary, --brand, --colors--primary etc. are explicit designer decisions
function extractSemanticColors(vars) {
  const result = { primary:null, secondary:null, accent:[], bg:null, fg:null };
  for (const [k, v] of Object.entries(vars)) {
    if (!/^#[0-9a-f]{3,8}$/i.test(v.trim())) continue;
    const key = k.toLowerCase();
    // Primary: key must contain 'primary' or 'brand' or 'cta' as a segment
    if (!result.primary && /(?:^|[-_])(primary|brand|cta)(?:$|[-_])/.test(key)) {
      result.primary = v.trim();
    // Secondary: key contains 'secondary' or 'accent' as a whole segment
    } else if (!result.secondary && /(?:^|[-_])(secondary)(?:$|[-_])/.test(key)) {
      result.secondary = v.trim();
    // Named color tokens: --colors--cyan, --colors--orange etc. (not neutrals)
    } else if (/--colors?--(?!black|white|grey|gray|dark|light|mid|charcoal|ink|muted)/.test(key)) {
      result.accent.push({ key: k, value: v.trim() });
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// NARRATIVE HELPERS — wrap raw CSS values in designer-brief prose
// ═══════════════════════════════════════════════════════════════════════════

function narrateShadow(shadowStr, role) {
  if (!shadowStr || shadowStr === 'none') return '';
  const isInset = shadowStr.includes('inset');
  const isGlow = /\b0px\s+0px\s+\d+px/.test(shadowStr) || /\b0 0 \d+px/.test(shadowStr);
  const layers = shadowStr.split(/,(?![^(]*\))/).length;
  const blurMatch = shadowStr.match(/\d+px\s+(\d+)px/);
  const blur = blurMatch ? parseInt(blurMatch[1]) : 0;
  const opacityMatch = shadowStr.match(/[\d.]+\s*\)/);
  const opacity = opacityMatch ? parseFloat(opacityMatch[0]) : 0;

  let intensity = blur < 8 ? 'tight' : blur < 20 ? 'medium' : 'soft';
  let weight = opacity < 0.1 ? 'whisper-light' : opacity < 0.2 ? 'subtle' : 'pronounced';

  const roleMap = {
    card: 'separating it from the canvas',
    button: 'giving the action physical presence',
    'button-hover': 'deepening as the user commits attention',
    nav: 'defining the boundary between content and navigation',
    container: 'creating a distinct visual layer'
  };
  const purpose = roleMap[role] || 'creating visual separation';

  if (isInset) return `an inset shadow (\`${shadowStr}\`) — this is a surface depth effect, not elevation. It carves into the surface rather than lifting above it.`;
  if (isGlow) return `a glow effect (\`${shadowStr}\`) — zero-offset diffusion that radiates outward, ${purpose}. This is luminous depth, not physical shadow.`;
  if (layers > 2) return `a layered shadow system (\`${shadowStr}\`) — ${layers} layers working together create nuanced, realistic depth. Each layer serves a purpose: the tight inner shadow grounds the element, the soft outer one floats it. Do not simplify to a single layer.`;
  return `a ${intensity} elevation shadow (\`${shadowStr}\`) — ${weight} presence ${purpose}. The ${blur}px blur keeps it ${blur < 12 ? 'grounded and structural' : 'soft and atmospheric'}.`;
}

function narrateRadius(value, component) {
  if (!value) return '';
  const px = parseInt(value);
  const comp = component || 'element';
  if (value.includes('9999') || value.includes('50%'))
    return `pill-shaped (\`${value}\`) — fully rounded, signaling this ${comp} is tappable and distinct from rectangular content. The pill shape is a deliberate contrast to the page's structural geometry.`;
  if (px <= 4)
    return `\`${value}\` radius — sharp and engineered. This ${comp} feels constructed, precise, mechanical. The minimal rounding says "tool, not toy."`;
  if (px <= 12)
    return `\`${value}\` radius — contemporary and balanced. Rounded enough to feel approachable without losing structural clarity. This is the page's workhorse radius.`;
  if (px <= 24)
    return `\`${value}\` radius — soft and inviting. This generous rounding creates a friendly, modern feel on the ${comp}.`;
  return `\`${value}\` radius on the ${comp}.`;
}

function narrateTransition(str, context) {
  if (!str) return '';
  const durMatch = str.match(/(\d+)m?s/);
  const dur = durMatch ? parseInt(durMatch[1]) : 200;
  const ms = str.includes('ms') ? dur : dur * 1000;
  const easing = str.includes('ease-out') ? 'ease-out' : str.includes('ease-in-out') ? 'ease-in-out' : str.includes('linear') ? 'linear' : 'ease';

  const easingFeel = {
    'ease-out': 'natural deceleration — fast start, gentle landing',
    'ease-in-out': 'smooth arc — eases in and out like a physical object',
    'linear': 'mechanical, constant-speed — deliberate and robotic',
    'ease': 'default browser easing — subtle and unobtrusive'
  };

  let speedFeel;
  if (ms < 150) speedFeel = 'snappy and immediate — the interface feels razor-sharp';
  else if (ms <= 250) speedFeel = 'responsive but unhurried — the UI acknowledges without rushing';
  else if (ms <= 400) speedFeel = 'deliberate and breathing — each transition is a moment, not a flicker';
  else speedFeel = 'slow and cinematic — transitions are events unto themselves';

  const ctx = context || 'this interaction';
  return `\`${str}\` — ${speedFeel}. The ${easing} curve (${easingFeel[easing]}) makes ${ctx} feel organic rather than switched.`;
}

function narrateColorRole(hex, role, isDark) {
  if (!hex) return '';
  const sat = hexSat(hex);
  const lum = hexLum(hex);

  // Determine hue family
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  let hueFamily = 'neutral';
  if (sat > 30) {
    if (r > g && r > b) hueFamily = b > g ? 'magenta' : 'warm';
    else if (b > r && b > g) hueFamily = r > g ? 'violet' : 'cool blue';
    else if (g > r && g > b) hueFamily = b > r ? 'teal' : 'green';
    else if (r > 200 && g > 200 && b < 100) hueFamily = 'yellow';
  }

  const intensityWord = sat > 80 ? 'saturated' : sat > 50 ? 'confident' : sat > 20 ? 'muted' : 'desaturated';

  const roleMap = {
    'primary-action': `a ${intensityWord} ${hueFamily} (\`${hex}\`) reserved for decision points — CTAs, focus rings, active states. This is the color that says "act here." Used surgically so it commands attention when it appears.`,
    'accent': `\`${hex}\` — a ${intensityWord} ${hueFamily} accent for secondary emphasis. Badges, callouts, category markers. Distinct from the primary action color — never interchangeable.`,
    'background': lum < 0.15
      ? `\`${hex}\` as the page ground — a deep ${hueFamily} surface that recedes completely, letting content and color float above it.`
      : `\`${hex}\` as the page ground — a ${lum > 0.9 ? 'near-white' : 'warm off-white'} surface that feels open and breathable. ${lum > 0.95 ? 'Clinical white avoided in favor of warmth.' : ''}`,
    'foreground': isDark
      ? `\`${hex}\` for primary text — light enough to read comfortably against dark surfaces without being harsh white.`
      : `\`${hex}\` for primary text — dark enough for excellent readability without the heaviness of pure black.`,
    'surface': isDark
      ? `\`${hex}\` for elevated surfaces — slightly lighter than the page background, creating subtle layering without color.`
      : `\`${hex}\` for card/panel surfaces — a gentle step above the page background that defines boundaries through luminance, not borders.`
  };

  return roleMap[role] || `\`${hex}\` (${role}) — a ${intensityWord} ${hueFamily} tone.`;
}

function narrateSpacing(value, context) {
  if (!value) return '';
  const px = parseInt(value);
  const ctx = context || 'spacing';

  if (ctx === 'section-padding') {
    if (px >= 120) return `\`${value}\` vertical padding — expansive whitespace that gives each section room to make its statement. This is luxury spacing: unhurried, premium, confident in its emptiness.`;
    if (px >= 80) return `\`${value}\` vertical padding — generous breathing room between sections. The rhythm is measured and calm, giving content space to land.`;
    if (px >= 48) return `\`${value}\` vertical padding — balanced density. Content-rich without feeling cramped, professional without feeling sparse.`;
    return `\`${value}\` vertical padding — compact and information-dense. Every pixel earns its place.`;
  }
  if (ctx === 'grid-gap') {
    if (px >= 48) return `\`${value}\` grid gap — wide gutters that let each card breathe as an individual, not a wall of content.`;
    if (px >= 24) return `\`${value}\` grid gap — standard spacing that groups items without crowding.`;
    return `\`${value}\` grid gap — tight grouping that reads as a unified cluster.`;
  }
  if (ctx === 'container-width') {
    return `\`${value}\` max-width — ${px >= 1400 ? 'expansive, filling wide screens for immersive layouts' : px >= 1200 ? 'standard content width, comfortable reading measure' : px >= 960 ? 'narrow focus, concentrated reading experience' : 'compact, tight content column'}.`;
  }
  return `\`${value}\` ${ctx}.`;
}

function generateRuleBasedDirection(data, style) {
  const { isDark,isLight,isVibrant,isMonochromatic,isCool,isWarm,isSerif,isMono,hasTwoFonts,
    hasFullRound,hasSharpCorners,hasRoundedCorners,hasGlowEffect,hasLayeredShadows,hasColoredShadows,
    hasBrutalistShadow,brutalistHoverShadows,hasGlitchAnimation,hasPulseAnimation,hasBlinkAnimation,hasTickerAnimation,
    hasHardBgTransition,hardTransitionColors,
    vibrantColors,fonts,vp,accents,shadows,radii,pageBg,semanticColors } = style;
  const lines=[], vpr=vp||{}, ui=(vpr.uiPatterns)||{};
  const RULE_SYSTEM_FONTS = new Set(['ui-sans-serif','ui-serif','ui-monospace','ui-rounded',
    'system-ui','-apple-system','blinkmacsystemfont','helvetica neue','arial','sans-serif','serif','monospace']);
  const uniqueFonts=[...new Set((fonts||[]).map(f=>f.trim()))]
    .filter(f=>f.length>1&&!RULE_SYSTEM_FONTS.has(f.toLowerCase()));

  const sc = semanticColors || {};
  const primaryColor = sc.primary
    || (isCool ? vibrantColors.find(c=>{ const r=parseInt(c.slice(1,3),16),b=parseInt(c.slice(5,7),16); return b>r&&hexSat(c)>80; }) : null)
    || vibrantColors[0] || accents[0];
  const secondaryColor = sc.secondary
    || vibrantColors.find(c=>c!==primaryColor&&hexSat(c)>60)
    || accents.find(c=>c!==primaryColor);
  const multiAccent = sc.accent.length>1 || vibrantColors.filter(c=>c!==primaryColor&&hexSat(c)>60).length>0;

  const interactiveRadii = radii.filter(r=>!r.includes('50%'));
  const radiusSample = interactiveRadii.find(r=>parseInt(r)>=4&&parseInt(r)<=24) || interactiveRadii[0];

  // ── Overall character ──
  lines.push('**Overall character**');
  const hasDecorGeom = ui.hasDecorativeGeometry;
  const hasIconSys = ui.hasIconSystem;

  if (vpr.imageTreatment==='cinematic'&&vpr.sectionColorPattern==='alternating') {
    lines.push('Dual-mode landing: light sections alternate with dark photography sections. The tonal flip is dramatic and intentional.');
  } else if (isDark&&isVibrant&&isCool) {
    lines.push('Dark-first SaaS with saturated cool accents. High contrast, engineer-facing — dark surface signals precision.');
  } else if (isDark&&isVibrant) {
    lines.push('Dark-first product with bold color accents. Dark canvas makes accent colors pop — every color is earned.');
  } else if (isDark) {
    lines.push('Dark-dominant — deep surfaces, minimal color. Typography and space carry the weight.');
  } else if (isLight&&isMonochromatic&&hasDecorGeom) {
    lines.push('Editorial, light-dominant with restrained neutrals and geometric decoration. Warm off-white ('+(pageBg||'#f5f5f0')+') prevents clinical coldness.');
  } else if (isLight&&isMonochromatic) {
    lines.push('Clean, light-dominant layout. Neutral palette, content-first. The restraint signals maturity.');
  } else if (isLight&&isCool&&isVibrant&&primaryColor) {
    lines.push('Light base, strong cool-toned action (`'+primaryColor+'`). Accent used surgically — only at decision points.');
  } else if (isLight&&isVibrant&&primaryColor) {
    lines.push('Light base with expressive accent (`'+primaryColor+'`). Color reserved for interactive moments.');
  } else if (isLight&&isWarm) {
    lines.push('Warm, light-dominant layout. Approachable, premium. '+(hasDecorGeom?'Geometric shapes add depth without photography.':''));
  } else {
    lines.push('Modern B2B product landing — restrained color, strong typographic hierarchy.');
  }
  lines.push('');

  // ── Section rhythm & visual hierarchy ──
  lines.push('**Section rhythm & visual hierarchy**');
  const bgRef = pageBg ? '`'+pageBg+'`' : (isDark ? 'dark neutral' : 'light neutral');

  if (vpr.sectionColorPattern==='alternating') {
    const rhythmColors = (vpr.sectionRhythm || []).filter(s => s.bgHex).map(s => s.bgHex);
    const uniqueColors = [...new Set(rhythmColors)];
    const colorDesc = uniqueColors.length > 0 ? ` Backgrounds: ${uniqueColors.join(' ↔ ')}.` : '';
    lines.push('Sections alternate between distinct background colors.' + colorDesc + ' Maintain exact bg per section as in Section Content Map.'+(vpr.hasGradientSection?' One gradient section as breathing space.':''));
  } else if (isDark) {
    lines.push('Consistently dark ('+bgRef+' base). Differentiate sections through subtle surface shifts (8–12% lighter sub-surfaces), thin `border-top` lines. Never white mid-page.');
  } else if (vpr.sectionColorPattern==='progressive-dark' && isLight) {
    lines.push('Opens light ('+bgRef+'), progressively darker. Dark only for closing CTA/footer zone.');
  } else if (isLight) {
    lines.push('Consistently light ('+bgRef+' base). Sections distinguish via subtle bg tints (white vs '+(pageBg||'#f5f5f0')+') — never dark.');
  } else {
    lines.push('Predominantly light ('+bgRef+'). Sections differentiate through 3–5% darker variants.'+(vpr.hasGradientSection?' One gradient section.':''));
  }
  if (hasHardBgTransition && hardTransitionColors) {
    lines.push(`Hard transition: \`${hardTransitionColors.from}\` → \`${hardTransitionColors.to}\` — sharp edge, not gradient. Reproduce as hard \`background-color\` switch.`);
  }

  // Spacing
  const sp = vpr.spacingSystem;
  if (sp && (sp.sectionPaddingY || sp.containerMaxWidth || sp.gridGap)) {
    const parts = [];
    if (sp.sectionPaddingY) parts.push('Section padding: `'+sp.sectionPaddingY+'`');
    if (sp.containerMaxWidth && sp.containerMaxWidth !== 'none') parts.push('container: `'+sp.containerMaxWidth+'`');
    if (sp.gridGap) parts.push('grid gap: `'+sp.gridGap+'`');
    if (sp.cardGap && sp.cardGap !== sp.gridGap) parts.push('card gap: `'+sp.cardGap+'`');
    lines.push(parts.join('. ')+'.');
  }

  // Merge page flow into section rhythm
  const scm = data.sectionContentMap;
  if (scm && scm.length > 0) {
    lines.push('');
    lines.push('The page unfolds in this sequence:');
    scm.slice(0, 8).forEach((sec, i) => {
      let desc = `${i+1}. **${sec.type}**`;
      if (sec.bgColor) desc += ` (${sec.bgColor})`;
      if (sec.heading) desc += `: "${sec.heading}"`;
      if (sec.layout) {
        const layoutMap = {'text-left-img-right':' Split layout — text left, visual right.',
          'text-right-img-left':' Split layout — text right, visual left.',
          'text-center':' Centered text layout.',
          'text-center-img-below':' Centered text with visual below.',
          'grid-cards':' Card grid layout.',
          'two-column':' Two-column layout.',
          'three-column':' Three-column layout.',
          'full-width-img':' Full-width visual.'};
        desc += layoutMap[sec.layout] || ` Layout: ${sec.layout}.`;
      }
      if (sec.ctas?.length > 0) desc += ` CTAs: ${sec.ctas.map(c=>`"${c}"`).join(', ')}.`;
      if (sec.headingColoredWords?.length > 0) {
        desc += ` Heading accents: ${sec.headingColoredWords.map(w=>`"${w.text}" (${w.style})`).join(', ')}.`;
      }
      if (sec.visualDescriptions?.length > 0) {
        const firstVis = sec.visualDescriptions[0];
        if (firstVis.length < 80) desc += ` Visual: ${firstVis}.`;
      }
      if (sec.decorativeGradients?.length > 0) desc += ' Has decorative gradient stripes.';
      if (sec.hasSlider) desc += ' Contains slider/carousel.';
      if (sec.hasNumberedItems) desc += ' Numbered items (01, 02, 03 pattern).';
      lines.push(desc);
    });
  }
  lines.push('');

  // ── Image usage ──
  lines.push('**Image usage**');
  if (vpr.imageTreatment==='cinematic'||vpr.hasFullBleedImages) {
    lines.push('Full-bleed cinematic photography as section atmosphere.'
      +(vpr.hasGlassmorphism?' Glassmorphism cards (`backdrop-filter:blur`) float over photography.':'')
      +(vpr.hasOverlaidUIOnPhoto?' Product UI overlaid on photography.':''));
  } else if (vpr.imageTreatment==='screenshot') {
    lines.push('Product screenshots as primary visual — rounded corners, soft shadow. Light on light, dark on dark.');
  } else if (vpr.hasLogoStrip||ui.hasLogoStrip) {
    lines.push('Logo strips + technical diagrams. No decorative photography.');
  } else {
    lines.push('Minimal imagery — typography, color, and space do the work. Visuals are functional only.');
  }
  if (ui.hasDecorativeGeometry) lines.push('Subtle decorative SVGs at opacity 0.05–0.10. Do NOT add grids, dots, or crop marks.');
  if (vpr.hasNoiseTexture) lines.push('Noise/grain texture at ~5–15% opacity on surfaces.');
  if (vpr.splitLayoutCount>1) lines.push(vpr.splitLayoutCount+' split-column sections — alternate text/visual sides.');
  lines.push('');

  // ── Typography ──
  lines.push('**Typography**');

  const MONO_KW = ['mono','code','fira','jetbrains','courier','inconsolata','ibm plex mono','space mono','source code'];
  const DISPLAY_KW = ['anton','impact','bebas','oswald','barlow condensed','black','ultra','heavy','poster','playfair','merriweather','lora','garamond'];

  function classifyFontRole(name) {
    const n = name.toLowerCase();
    if (MONO_KW.some(k=>n.includes(k))) return 'mono';
    if (DISPLAY_KW.some(k=>n.includes(k))) return 'display';
    return 'sans';
  }

  if (uniqueFonts.length >= 2) {
    const classified = uniqueFonts.slice(0,2).map(f=>({name:f, type:classifyFontRole(f)}));
    const disp = classified.find(f=>f.type!=='mono') || classified[0];
    const body = classified.find(f=>f!==disp) || classified[1];
    const dispType = disp.type;
    const bodyType = body.type;

    if (dispType === 'display' && bodyType === 'mono') {
      lines.push('"'+disp.name+'" for headlines 48–72px; "'+body.name+'" (mono) for body/labels. Never cross roles.');
    } else if (isSerif) {
      lines.push('Serif "'+disp.name+'" for headings, sans "'+body.name+'" for body. H1: clamp(52px,7vw,88px). Never swap.');
    } else if (bodyType === 'mono') {
      lines.push('"'+disp.name+'" for display headings; "'+body.name+'" (mono) for body/UI. Strict role separation.');
    } else {
      lines.push('"'+disp.name+'" for headings (700–800), "'+body.name+'" for body (400). Never blur boundaries.');
    }
  } else if (isMono && uniqueFonts[0]) {
    lines.push('Mono ("'+uniqueFonts[0]+'") sole typeface. Uppercase tracked labels. H1: clamp(40px,5vw,64px)/700, body: 16–18px/400.');
  } else if (uniqueFonts[0]) {
    lines.push('Single typeface ("'+uniqueFonts[0]+'") — hierarchy via weight (300/400/600/800) and size. H1: clamp(40px,5vw,72px)/700–800, body: 16–18px/400.');
  } else {
    lines.push('System font — weight and size contrast only. H1: 56–72px/700, body: 16–18px/400.');
  }

  // Merge type scale into typography
  const tp = data.typographyPatterns;
  if (tp && (tp.h1 || tp.body)) {
    let scaleNote = ' Measured type scale:';
    if (tp.h1) scaleNote += ` H1 \`${tp.h1.fontSize}/${tp.h1.fontWeight}\`${tp.h1.letterSpacing && tp.h1.letterSpacing !== 'normal' ? ` tracking \`${tp.h1.letterSpacing}\`` : ''}${tp.h1.textTransform === 'uppercase' ? ' uppercase' : ''};`;
    if (tp.h2) scaleNote += ` H2 \`${tp.h2.fontSize}/${tp.h2.fontWeight}\`;`;
    if (tp.h3) scaleNote += ` H3 \`${tp.h3.fontSize}/${tp.h3.fontWeight}\`;`;
    if (tp.body) scaleNote += ` Body \`${tp.body.fontSize}/${tp.body.fontWeight}\`${tp.body.lineHeight ? ` line-height \`${tp.body.lineHeight}\`` : ''};`;
    if (tp.label) scaleNote += ` Label \`${tp.label.fontSize}/${tp.label.fontWeight}\`${tp.label.textTransform === 'uppercase' ? ' uppercase' : ''};`;
    lines.push(scaleNote.replace(/;$/, '.'));
  }
  lines.push('');

  // ── Color usage ──
  lines.push('**Color usage**');
  if (primaryColor&&isDark) {
    lines.push('Dark surfaces ('+bgRef+'). `'+primaryColor+'` = primary action (CTAs, links, focus).'
      +(secondaryColor&&secondaryColor!==primaryColor?' `'+secondaryColor+'` = secondary (badges, callouts, not interchangeable).':''));
  } else if (primaryColor&&isLight&&multiAccent) {
    const namedAccents = sc.accent.slice(0,4);
    let colorDesc = '`'+primaryColor+'` = primary action.';
    if (secondaryColor && secondaryColor !== primaryColor) colorDesc += ' `'+secondaryColor+'` = secondary.';
    if (namedAccents.length > 0) {
      const others = namedAccents.filter(a=>a.value!==primaryColor&&a.value!==secondaryColor).slice(0,2);
      if (others.length) colorDesc += ' '+others.map(a=>'`'+a.value+'` ('+a.key+')').join(', ')+'.';
    }
    lines.push('Light surfaces ('+bgRef+'). '+colorDesc+' Bg variation: white ↔ `'+(pageBg||'#f5f5f0')+'`.');
  } else if (primaryColor&&isLight) {
    lines.push('Light surfaces ('+bgRef+'). `'+primaryColor+'` = sole action color — CTAs, links, focus. Neutral everywhere else.');
  } else {
    lines.push('Neutral palette. Accent at interactive moments only.');
  }
  lines.push('');

  // ── Shape & elevation ──
  lines.push('**Shape & elevation**');
  if (hasFullRound&&hasGlowEffect) {
    lines.push('Pills (`9999px`) for interactive elements with glow elevation.'+(hasColoredShadows?' Shadow color matches accent.':'')+' Glow expands on hover.');
  } else if (hasFullRound) {
    lines.push('Pills (`9999px`) for buttons/badges. Containers: `'+(radiusSample||'12px')+'` radius. Never mix.');
  } else if (hasSharpCorners&&!hasRoundedCorners) {
    lines.push('Sharp geometry — `border-radius: '+(radiusSample||'4px')+'`.'+(hasLayeredShadows?' Layered shadows for depth.':''));
  } else if (hasRoundedCorners) {
    lines.push('`'+(radiusSample||'8–12px')+'` rounding.'+(hasLayeredShadows?' Layered shadows — don\'t simplify to single layer.':''));
  } else {
    lines.push('`'+(radiusSample||'6–8px')+'` radius across all elements.');
  }
  if (hasBrutalistShadow) {
    let brutDesc = 'Brutalist: hard `4px 4px 0 color` shadows, zero blur.';
    if (brutalistHoverShadows?.length > 0) {
      brutalistHoverShadows.slice(0,2).forEach(h => {
        brutDesc += ` \`${h.selector.replace(/\[data-astro[^\]]*\]/g,'').slice(0,30)}:hover\` → \`box-shadow: ${h['box-shadow']}\`.`;
      });
    }
    lines.push(brutDesc);
  }
  if (vpr.hasGlassmorphism) {
    lines.push('Glassmorphism: `background: rgba(255,255,255,0.03–0.08)`, `backdrop-filter:blur(12–20px)`, `border: 1px solid rgba(255,255,255,0.08–0.12)`.');
  }
  lines.push('');

  // ── Animation (compact — details bound to components above) ──
  lines.push('**Animation**');
  const motionParts = [];

  if (vpr.hasScrollAnimation) {
    if ((vpr.animationPatterns||{}).hasMaskReveal) motionParts.push('**Scroll reveal (all sections):** `clip-path: inset(100% 0 0 0)→inset(0)`, `transition: 0.6s ease-out` on IntersectionObserver entry');
    else if ((vpr.animationPatterns||{}).hasStaggerReveal) motionParts.push('**Scroll reveal (all sections):** children stagger `opacity:0→1` + `translateY(20px)→0`, 80ms delay each, 400ms ease-out via IntersectionObserver');
    else motionParts.push('**Scroll reveal (all sections):** `opacity:0→1` + `translateY(20px)→0`, `transition: 0.4s ease-out` via IntersectionObserver');
  }
  if ((vpr.animationPatterns||{}).hasTextReveal || (vpr.animationPatterns||{}).hasHeroAnimation) motionParts.push('**Hero text reveal:** words appear sequentially — staggered `animation-delay`, `opacity:0→1` + `translateY(10px)→0`');
  if (hasGlitchAnimation) motionParts.push('**Glitch (hero/brand text):** `@keyframes glitch` with `clip:rect()` random values on `::before`/`::after`, 2–4s infinite');
  if (hasPulseAnimation) motionParts.push('**Pulse (status dots):** `@keyframes pulse { 50% { scale:2; opacity:0 } }` 2s infinite');
  if (hasBlinkAnimation) motionParts.push('**Blink (cursors/indicators):** `@keyframes blink { 50% { opacity:0 } }` 1.5s step-end infinite');
  if (ui.hasMarquee||ui.hasLogoStrip||hasTickerAnimation) {
    let m = '**Marquee:** `@keyframes marquee { to { transform:translateX(-50%) } }` 30s linear infinite';
    if (vpr.blendModes?.includes('lighten')) m += ', `mix-blend-mode:lighten`';
    motionParts.push(m);
  }
  if ((vpr.animationPatterns||{}).hasSlider) motionParts.push('**Slider:** CSS scroll-snap, auto-play, pause on hover');
  if (vpr.navStyle==='transparent-hero') motionParts.push('**Nav transition:** transparent→solid/frosted at 80px scroll, `transition: 0.3s ease`');
  if (vpr.blendModes?.length>0 && !(ui.hasMarquee && vpr.blendModes.length===1 && vpr.blendModes[0]==='lighten')) motionParts.push('`mix-blend-mode: '+vpr.blendModes.join(', ')+'`');
  if (vpr.hasParallaxHint) motionParts.push('Parallax: bg elements at different scroll speeds');

  if (motionParts.length > 0) lines.push(motionParts.join('\n'));
  else lines.push('Subtle: `opacity` + `translateY` on scroll, `150–200ms ease-out` hover transitions.');
  lines.push('');

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT GUIDANCE
// ═══════════════════════════════════════════════════════════════════════════
function generateComponentGuidance(data, style) {
  const{isDark,hasFullRound,hasGlowEffect,hasLayeredShadows,hasColoredShadows,accents,vp,radii,
    pageBg,semanticColors,vibrantColors,isCool,
    hasGlitchAnimation,hasPulseAnimation,hasBlinkAnimation,hasTickerAnimation} = style;
  const vpr=vp||{}, ui=(vpr.uiPatterns)||{};
  const ap = vpr.animationPatterns || {};

  const sc = semanticColors || {};
  const accent = sc.primary
    || (isCool ? vibrantColors.find(c=>{ const r=parseInt(c.slice(1,3),16),b=parseInt(c.slice(5,7),16); return b>r&&hexSat(c)>60; }) : null)
    || accents.find(c=>hexSat(c)>60)
    || accents[0];

  const interactiveRadii = radii.filter(r=>!r.includes('50%'));
  const radiusSample = interactiveRadii.find(r=>parseInt(r)>=4&&parseInt(r)<=24) || interactiveRadii[0];
  const lines=[];

  // ── Navigation ──
  if (vpr.navStyle==='transparent-hero') {
    lines.push('**Navigation:** Sticky. Starts transparent, transitions on scroll past 80px to '+(isDark?'`rgba(24,22,24,0.85)` + `backdrop-filter:blur(12px)` + `border-bottom:1px solid rgba(255,255,255,0.08)`':'`rgba(255,255,255,0.92)` + `backdrop-filter:blur(12px)` + `border-bottom:1px solid rgba(0,0,0,0.06)`')+'. Transition: `background 0.3s ease, border-color 0.3s ease`. Logo left, CTA right.');
  } else if (vpr.navStyle==='frosted') {
    lines.push('**Navigation:** Sticky. `backdrop-filter:blur(12px)`, '+(isDark?'dark':'light')+' semi-transparent bg. Logo left, CTA right.');
  } else {
    lines.push('**Navigation:** Sticky, '+(isDark?'`'+(pageBg||'#111')+'`':'`'+(pageBg||'#fff')+'`')+' bg. `border-bottom:1px solid '+(isDark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.06)')+'`. Logo left, CTA right.');
  }

  // ── Primary Button ──
  const bs = data.buttonStyles || {};
  const hoverStates = data.hoverStates || [];
  if (bs.primary) {
    const p = bs.primary;
    let shape;
    if (p.clipPath) {
      shape = `chamfered corners via \`clip-path: ${p.clipPath.slice(0, 80)}\` — no border-radius, the geometry is carved`;
      if (p.pseudoBorder) shape += '. Border simulated via `::before` pseudo-element with same clip-path';
    } else if (p.borderRadius?.includes('9999')) {
      shape = 'pill-shaped (`9999px`) — the full rounding signals "this is the action" and separates it from rectangular content';
    } else {
      shape = narrateRadius(p.borderRadius||radiusSample||'8px', 'button');
    }
    const primaryHover = hoverStates.find(h => /btn.*(?:primary|cta|red|main|action)/i.test(h.selector) || /(?:primary|cta|red|main).*btn/i.test(h.selector));
    let hoverDesc = primaryHover
      ? 'Hover: ' + Object.entries(primaryHover).filter(([k]) => k !== 'selector').map(([k,v]) => `\`${k}: ${v}\``).join(', ') + '.'
      : isDark ? 'Hover: `filter: brightness(1.08)`, `transition: 200ms ease-out`.' : 'Hover: `filter: brightness(0.92)`, `transition: 200ms ease-out`.';
    lines.push(`**Primary button:** ${shape}. \`${p.backgroundColor||accent}\` bg, text \`${p.color}\`${p.height?', height `'+p.height+'`':''}. Padding \`${p.padding}\`. Font \`${p.fontSize}/${p.fontWeight}\`${p.fontFamily?' "'+p.fontFamily+'"':''}${p.letterSpacing?', tracking `'+p.letterSpacing+'`':''}${p.textTransform?', `'+p.textTransform+'`':''}. ${hoverDesc}`);
  } else {
    let btnNarrative;
    if (hasFullRound&&accent&&hasGlowEffect) {
      btnNarrative = `Pill-shaped (\`9999px\`) with \`${accent}\` fill, padding \`12px 28px\`, weight 700. On hover, the glow blooms outward (\`0 0 20px ${accent}66\`, brightness 1.05, 200ms ease-out) — the button radiates energy, drawing the cursor like a beacon.`;
    } else if (hasFullRound&&accent) {
      btnNarrative = `Pill-shaped (\`9999px\`) with \`${accent}\` fill, padding \`12px 24px\`, weight 600. On hover, darkens to \`brightness(0.92)\` — a confident, controlled response.`;
    } else if (accent) {
      btnNarrative = `${narrateRadius(radiusSample||'8px', 'button')}. \`${accent}\` fill, padding \`10px 20px\`, weight 600. Hover: \`brightness(0.92)\` — subtle, professional.`;
    } else {
      btnNarrative = `${narrateRadius(radiusSample||'8px', 'button')}. Primary color from tokens, weight 600.`;
    }
    lines.push('**Primary button:** '+btnNarrative);
  }

  // Nav CTA
  if (bs.navCta && bs.navCta !== bs.primary) {
    const n = bs.navCta;
    lines.push(`**Nav CTA:** Compact variant — \`${n.fontSize}\` font, height \`${n.height}\`, padding \`${n.padding}\`${n.backgroundColor?', `'+n.backgroundColor+'` bg':''}${n.fontFamily?', "'+n.fontFamily+'"':''}. Visually smaller than hero CTAs, maintaining hierarchy: the nav CTA whispers while the hero CTA shouts.`);
  }

  // Ghost button
  if (bs.ghost) {
    const g = bs.ghost;
    const ghostShape = g.clipPath ? `chamfered via clip-path` : narrateRadius(g.borderRadius||radiusSample||'8px', 'ghost button');
    const ghostHover = hoverStates.find(h => /ghost|outline/i.test(h.selector));
    const ghostHoverDesc = ghostHover
      ? 'On hover: '+Object.entries(ghostHover).filter(([k]) => k !== 'selector').map(([k,v]) => `\`${k}: ${v}\``).join(', ')+'.'
      : `On hover, a whisper of fill appears (${isDark?'`rgba(255,255,255,0.06)`':'`rgba(0,0,0,0.04)`'}) — the ghost becomes slightly more solid, hinting at its interactivity.`;
    lines.push(`**Ghost button:** ${ghostShape}. Transparent bg, border \`${g.border||'1px solid '+(isDark?'rgba(255,255,255,0.2)':'rgba(0,0,0,0.15)')}\`, padding \`${g.padding||'12px 24px'}\`. ${ghostHoverDesc}`);
  } else {
    lines.push('**Ghost button:** '+(hasFullRound?'`9999px`':'`'+(radiusSample||'8px')+'`')+' radius, transparent bg, `1px solid '+(isDark?'rgba(255,255,255,0.2)':'rgba(0,0,0,0.15)')+'`. Hover: `background: '+(isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.04)')+'`.');
  }

  // Cards
  let cardNarrative;
  if (vpr.hasGlassmorphism) {
    cardNarrative = 'Two variants: (1) light sections — white, `rgba(0,0,0,0.08)` border, `'+(radiusSample||'12px')+'` radius, layered shadow. (2) dark sections — `rgba(20,20,20,0.55)`, `backdrop-filter:blur(16px)`, `rgba(255,255,255,0.08)` border. Padding `24–32px`. Hover: `translateY(-2px)`, shadow expand, `transition: 200ms ease-out`.';
  } else if (isDark) {
    cardNarrative = 'Dark surface (8–12% lighter than page bg). `rgba(255,255,255,0.06)` border. '+(hasLayeredShadows?'Layered shadow from tokens.':'Border for definition.')+' Padding `24–32px`. Hover: `transform: translateY(-2px)`, `transition: 200ms ease-out`.';
  } else {
    cardNarrative = '`'+(pageBg||'#ffffff')+'` bg, `rgba(0,0,0,0.08)` border, '+(hasLayeredShadows?'layered shadow':'`0 4px 24px rgba(0,0,0,0.06)`')+'. `'+(radiusSample||'12px')+'` radius. Padding `24–32px`. Hover: `transform: translateY(-2px)`, shadow expand 20%, `transition: 200ms ease-out`.';
  }
  lines.push('**Cards:** '+cardNarrative);

  // Hero
  if (style.layout?.hasHero) {
    const heroHasPhoto = vpr.hasFullBleedImages || vpr.imageTreatment==='cinematic';
    const heroHasDecorGeometry = ui.hasDecorativeGeometry;

    // Hero animation binding
    let heroAnim = '';
    if (ap.hasTextReveal || ap.hasHeroAnimation) heroAnim += ' **Hero headline animation:** words/characters appear sequentially — use CSS `@keyframes` with staggered `animation-delay` per word, `opacity: 0→1` + `translateY(10px)→0`, 400ms ease-out.';
    if (hasGlitchAnimation) heroAnim += ' **Glitch effect on headline:** apply `@keyframes glitch` using `clip: rect()` with rapid random clip regions on `::before`/`::after` pseudo-elements. 2–3s infinite.';

    if (heroHasPhoto && isDark) {
      lines.push('**Hero:** `min-height: 100dvh`, `background-size:cover`, `rgba(0,0,0,0.4)` overlay. White text. Headline: `clamp(48px,7vw,88px)` display font. Primary CTA + ghost side by side.'+heroAnim);
    } else if (heroHasDecorGeometry && !isDark) {
      const heroBgRef = pageBg ? '`'+pageBg+'`' : '`#ffffff`';
      lines.push('**Hero:** '+heroBgRef+' bg, dark text. Headline: `clamp(48px,6vw,80px)/800` display font. Primary CTA + ghost side by side. Padding `80–120px` vertical.'+heroAnim);
    } else {
      const heroBgRef = pageBg ? '`'+pageBg+'`' : (isDark ? 'dark neutral' : '`#ffffff`');
      const heroText = isDark ? 'light text' : 'dark text';
      lines.push('**Hero:** `min-height: 80–90dvh`, '+heroBgRef+' bg. '+heroText+'. Headline: `clamp(48px,6vw,80px)` display font. Primary CTA + ghost side by side.'+heroAnim);
    }
  }

  // Inputs
  lines.push('**Inputs:** `'+(isDark?'rgba(255,255,255,0.06)':'#f8f9fa')+'` bg, `1px solid '+(isDark?'rgba(255,255,255,0.12)':'#e0e0e0')+'` border, matching radius. Focus: `outline 2px solid '+(accent||'currentColor')+' offset 2px`.');

  // Badges
  const badgeData = data.badgeStyles;
  if (badgeData) {
    lines.push(`**Badges:** \`${badgeData.borderRadius||'9999px'}\` radius, \`${badgeData.padding||'4px 10px'}\` padding, \`${badgeData.fontSize||'12px'}/${badgeData.fontWeight||'500'}\` font. bg \`${badgeData.backgroundColor||'accent at 15% opacity'}\`, text \`${badgeData.color||'full-opacity accent'}\`.`);
  } else if (accents.length>1) {
    lines.push('**Badges:** `9999px`, `4px 10px`, `12px/500`. Accent bg 15% opacity, full-opacity text.');
  }

  // Pattern components — compact with animation bindings
  if (ui.hasMarquee||ui.hasLogoStrip||hasTickerAnimation) lines.push('**Logo marquee:** `overflow:hidden`, inner div 200% width. CSS: `@keyframes marquee { to { transform:translateX(-50%) } }` applied as `animation: marquee 30s linear infinite`. Logos at 50–60% opacity.');
  if (ui.hasPricingGrid&&ui.pricingColumnCount>0) lines.push('**Pricing grid:** `repeat('+ui.pricingColumnCount+',1fr)`, gap `24px`, `align-items:stretch`.'+(ui.pricingColumnCount===3?' Center card: accent border, elevated shadow, "Popular" badge.':''));
  if (ui.hasTestimonialCarousel) lines.push('**Testimonial carousel:** CSS scroll-snap or Swiper. '+(isDark?'Dark cards, `rgba(255,255,255,0.06)` border':'White cards')+', `'+(radiusSample||'12px')+'` radius, `24px` padding. `animation: auto-slide` with pause on hover.');
  if (ui.hasDualCTA||ui.hasQRCode) lines.push('**Dual CTA:** QR + button side by side (`display:flex, gap:16px`).');
  if (ui.hasStepIndicator) lines.push('**Steps:** `32px` circles, `border-radius:50%`, number inside. Connecting line. Active step = accent color.');
  if (ui.hasCounterSection) lines.push('**Stats:** `64–80px/800` numbers, `14–16px` muted labels. **Animate:** count-up from 0 on scroll entry via IntersectionObserver + requestAnimationFrame.');
  if (ui.hasAccordion) lines.push('**Accordion:** `16–18px/600` question, muted answer. `max-height` + `overflow:hidden` transition 300ms. Chevron `rotate(180deg)` on open.');
  if (ui.hasVideoSection) lines.push('**Video:** `autoplay muted loop`, `object-fit:cover`, `16–24px` radius.');

  if (ui.hasDecorativeGeometry) {
    lines.push('**Decorative bg:** SVG elements, `position:absolute`, `z-index:-1`, `pointer-events:none`, `opacity: 0.05–0.12`. Keep minimal.');
  }

  if (ui.hasIconSystem) {
    const iconD = ui.iconDetails || {};
    const iconStyle = ui.iconStyle || 'outlined';
    const sizeNote = iconD.size || '32–48px';
    let styleNote = iconStyle === 'outlined' ? `Outlined, ${iconD.strokeWidth?iconD.strokeWidth+'px':'1.5px'} stroke, ${iconD.color?'`'+iconD.color+'`':'currentColor'}` : iconStyle === 'filled' ? `Filled, ${iconD.color?'`'+iconD.color+'`':'accent'}` : iconStyle;
    let containerNote = '';
    if (iconD.containerStyle && iconD.containerStyle !== 'none') {
      containerNote = ` in \`${iconD.containerSize||'48px'}\` ${iconD.containerStyle} container${iconD.containerBg?', bg `'+iconD.containerBg+'`':''}`;
    }
    lines.push(`**Icons:** \`${sizeNote}\`, ${styleNote}${containerNote}. Gap: \`${iconD.gapToText||'12–16px'}\`.`);
  }

  if (ui.hasArrowLinks) {
    const color = ui.arrowLinkColor ? `\`${ui.arrowLinkColor}\`` : 'accent';
    lines.push(`**Arrow links:** "Learn more →". Color: ${color}, weight 500. Hover: arrow \`transform: translateX(4px)\`, \`transition: 150ms ease\`.`);
  }

  // ── Global animation behaviors (bound to ALL sections) ──
  lines.push('');
  lines.push('**GLOBAL ANIMATION RULES — apply to every section:**');

  // Scroll reveal
  if (vpr.hasScrollAnimation) {
    if (ap.hasMaskReveal) {
      lines.push('- **Scroll reveal (every section):** Use IntersectionObserver. On entry: `clip-path: inset(100% 0 0 0)` → `clip-path: inset(0)`, `transition: clip-path 600ms ease-out`. Apply to each section\'s heading + content block.');
    } else if (ap.hasStaggerReveal) {
      lines.push('- **Scroll reveal (every section):** Use IntersectionObserver. On entry: children stagger with `opacity: 0→1` + `transform: translateY(20px)→0`, each child delayed by `80ms`. CSS: `transition: opacity 400ms ease-out, transform 400ms ease-out`. Apply `.is-visible` class on intersection.');
    } else {
      lines.push('- **Scroll reveal (every section):** Use IntersectionObserver on ALL `<section>` elements. On entry: `opacity: 0→1` + `transform: translateY(20px)→0`. CSS: `transition: opacity 0.4s ease-out, transform 0.4s ease-out`. Start hidden: `opacity: 0; transform: translateY(20px)`. Add `.is-visible { opacity: 1; transform: translateY(0); }` on intersection.');
    }
  }

  // Specific animations
  if (hasPulseAnimation) lines.push('- **Pulse/beacon animation:** Apply to status indicators, live dots. CSS: `@keyframes pulse { 0% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(2); opacity: 0; } 100% { transform: scale(1); opacity: 0.4; } }` — `animation: pulse 2s ease-in-out infinite`.');
  if (hasBlinkAnimation) lines.push('- **Blink animation:** Apply to cursor elements, status indicators. CSS: `@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }` — `animation: blink 1.5s step-end infinite`.');
  if (hasGlitchAnimation) lines.push('- **Glitch animation:** Apply to hero headline or brand text via `::before`/`::after` pseudo-elements. CSS: `@keyframes glitch { 0% { clip: rect(random); } ... 100% { clip: rect(random); } }` — use `clip: rect()` with randomized values, 2–4s infinite. Create VHS/digital distortion effect.');

  return lines;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════
async function buildPromptFromData(data, source) {
  const useAI = state.provider !== 'none' && !!state.apiKeys[state.provider];
  showLoading(useAI ? `Analyzing with ${PROVIDERS[state.provider].name}…` : 'Generating prompt…');

  let aiDirection = null;
  if (useAI && source === 'page') aiDirection = await generateDirectionWithAI(data);

  if (source === 'page' && state.contentMode === 'custom') {
    state.customContent = $('customContentInput')?.value || '';
  }

  const prompt = source === 'page' ? buildPagePrompt(data, aiDirection) : buildElementPrompt(data);
  state.lastPrompt = prompt;
  if (source === 'page') state.lastAnalyzedData = data;

  // Auto-save
  const url = data.url || state.currentUrl;
  await savePrompt(url, prompt, source, state.platform);

  showResult(prompt, { url }, source, aiDirection ? state.provider : null);
  flashSaveIndicator();
}

function buildPagePrompt(data, aiDirection) {
  const site=safeHostname(data.url), vars=data.cssVars||{};
  const focus=state.focus, platform=state.platform;
  const colors=data.colors||[], accents=data.accentColors||[];
  const style=analyzeDesignStyle(data), vpr=data.visualProfile||{}, ui=(vpr.uiPatterns)||{};
  const specsData = getDesignSpecsData(data, style);
  const lines=[];

  lines.push('IMPORTANT: This prompt contains EXACT design specifications extracted from a real website.');
  lines.push('Use the specific hex colors, px values, font names, and spacing values below — they are embedded inline within the narrative descriptions.');
  lines.push('Do NOT substitute with framework defaults (shadcn, Tailwind, etc.).');
  lines.push('Every visual detail is intentional and must be reproduced faithfully.');
  lines.push('');
  lines.push(`Inspired by: ${site}`);
  lines.push(`Page type: ${data.layoutInfo?.pageType||'web page'}`);
  lines.push(''); lines.push(getPlatformHeader()); lines.push('');

  // ── Design Direction ──
  lines.push('### Design Direction');
  lines.push(aiDirection || generateRuleBasedDirection(data, style));
  lines.push('');

  // ── Visual Palette (replaces Color Tokens) ──
  if(focus==='all'||focus==='colors') {
    lines.push('### Visual Palette');

    // Opening narrative
    const sc = style.semanticColors || {};
    const primaryColor = sc.primary
      || (style.isCool ? style.vibrantColors.find(c=>{ const r=parseInt(c.slice(1,3),16),b=parseInt(c.slice(5,7),16); return b>r&&hexSat(c)>80; }) : null)
      || style.vibrantColors[0];

    if (style.isDark && primaryColor) {
      lines.push('This palette is built on darkness — deep surfaces that recede, letting color be the performer. Every hue below is extracted from the live site and must be used exactly as specified.');
    } else if (style.isLight && style.isMonochromatic) {
      lines.push('A restrained, neutral-first palette where color is earned, not given. The absence of saturation IS the design choice. Every value below is extracted from the live site.');
    } else if (primaryColor) {
      lines.push('A deliberate color system where each role is assigned with purpose. The palette balances functional clarity with brand identity. Every hex value below is extracted from the live site.');
    } else {
      lines.push('A minimal color system relying on luminance contrast rather than hue. Every value below is extracted from the live site.');
    }
    lines.push('');

    // Named CSS vars with narrative
    const namedVars = Object.entries(vars).filter(([k,v]) =>
      /^#[0-9a-f]{3,8}$/i.test(v.trim()) &&
      !k.startsWith('--tw-') && !k.startsWith('--swiper-') &&
      !k.startsWith('--framer-') && !k.startsWith('--wf-')
    );
    if (namedVars.length > 0) {
      lines.push('**Design tokens (CSS custom properties):**');
      namedVars.slice(0,14).forEach(([k,v]) => lines.push('- `'+k+'`: `'+v+'`'));
      lines.push('');
    }

    // Computed semantic colors with narrative
    const computedParts = [];

    if (primaryColor) {
      const alreadyInVars = namedVars.some(([,v]) => v.toLowerCase()===primaryColor.toLowerCase());
      if (!alreadyInVars) computedParts.push(narrateColorRole(primaryColor, 'primary-action', style.isDark));
    }

    const usedHex = new Set([primaryColor?.toLowerCase()]);
    const remainingAccents = dedupeColors([...accents, ...style.vibrantColors].filter(c=>hexSat(c)>=40))
      .filter(c=>!usedHex.has(c.toLowerCase()));
    remainingAccents.slice(0,3).forEach((c) => {
      const alreadyInVars = namedVars.some(([,v]) => v.toLowerCase()===c.toLowerCase());
      if (!alreadyInVars) computedParts.push(narrateColorRole(c, 'accent', style.isDark));
    });

    const bgColor = style.pageBg;
    if (bgColor) {
      const alreadyInVars = namedVars.some(([,v]) => v.toLowerCase()===bgColor.toLowerCase());
      if (!alreadyInVars) computedParts.push(narrateColorRole(bgColor, 'background', style.isDark));
    }

    const allComputedColors = dedupeColors(colors);
    let fgColor;
    if (style.isDark) {
      fgColor = allComputedColors
        .filter(c => hexLum(c) > 0.5 && c.toLowerCase() !== bgColor?.toLowerCase())
        .sort((a,b) => hexLum(b) - hexLum(a))[0];
    } else {
      fgColor = allComputedColors
        .filter(c => hexLum(c) < 0.2 && c.toLowerCase() !== bgColor?.toLowerCase())
        .sort((a,b) => hexLum(a) - hexLum(b))[0];
    }
    if (fgColor) {
      const alreadyInVars = namedVars.some(([,v]) => v.toLowerCase()===fgColor.toLowerCase());
      if (!alreadyInVars) computedParts.push(narrateColorRole(fgColor, 'foreground', style.isDark));
    }

    const surfaceColor = allComputedColors.find(c => {
      const lum = hexLum(c), sat = hexSat(c);
      if (c.toLowerCase() === bgColor?.toLowerCase()) return false;
      if (c.toLowerCase() === fgColor?.toLowerCase()) return false;
      if (style.isDark) return lum > 0.05 && lum < 0.5 && sat < 30;
      return lum > 0.1 && lum < 0.9 && sat < 30;
    });
    if (surfaceColor) {
      const alreadyInVars = namedVars.some(([,v]) => v.toLowerCase()===surfaceColor.toLowerCase());
      if (!alreadyInVars) computedParts.push(narrateColorRole(surfaceColor, 'surface', style.isDark));
    }

    if (computedParts.length > 0) {
      lines.push('**Semantic roles:**');
      computedParts.forEach(p => lines.push('- '+p));
    }

    // Gradients from specs data
    if (specsData.gradients.length > 0) {
      lines.push('');
      lines.push('**Gradients:** '+specsData.gradients.map(g => '`'+g.value+'`').join(', '));
    }
    lines.push('');
  }

  // ── Typography System (replaces Typography Tokens) ──
  if(focus==='all'||focus==='typography') {
    const fontVars=Object.entries(vars).filter(([k,v])=>/font-family|typeface/.test(k)&&!v.startsWith('var('));
    const SYSTEM_FONTS = new Set(['ui-sans-serif','ui-serif','ui-monospace','ui-rounded',
      'system-ui','-apple-system','blinkmacsystemfont','helvetica neue','arial','sans-serif','serif','monospace']);
    const fonts=[...new Set((data.fonts||[])
      .filter(f=>f&&f.length>1&&f.toLowerCase()!=='inherit'&&!SYSTEM_FONTS.has(f.toLowerCase()))
      .map(f=>f.trim()))];
    if(fonts.length>0||fontVars.length>0) {
      lines.push('### Typography System');
      lines.push('Type choices define the personality of this design — every font role, weight, and size below is measured from the live DOM.');
      lines.push('');

      if(fontVars.length>0) {
        lines.push('**Font tokens (CSS custom properties):**');
        fontVars.slice(0,4).forEach(([k,v])=>lines.push(`- \`${k}\`: ${v}`));
      } else {
        const tp = data.typographyPatterns || {};
        const h1Font = tp.h1?.fontFamily;
        const bodyFont = tp.body?.fontFamily;
        const labelFont = tp.label?.fontFamily;

        if (h1Font && bodyFont && h1Font !== bodyFont) {
          lines.push(`**Font pairing:** Display/heading in "${h1Font}" and body/UI in "${bodyFont}" — the contrast between these typefaces creates hierarchy without relying on size alone.`);
          if (labelFont && labelFont !== h1Font && labelFont !== bodyFont) {
            lines.push(`A third register: "${labelFont}" for labels and monospace contexts.`);
          }
        } else if (h1Font) {
          const otherFont = fonts.find(f => f !== h1Font);
          lines.push(`**Primary typeface:** "${h1Font}" for display/heading.`);
          if (otherFont) lines.push(`**Body typeface:** "${otherFont}" for body/UI text.`);
        } else if (fonts.length >= 2) {
          const MONO_KW2 = ['mono','code','fira','jetbrains','courier','inconsolata','ibm plex mono','space mono','source code'];
          const monoIdx = fonts.findIndex(f=>MONO_KW2.some(k=>f.toLowerCase().includes(k)));
          if (monoIdx === 0 && fonts.length > 1) {
            lines.push(`**Font pairing:** "${fonts[1]}" for display and "${fonts[0]}" (monospace) for body — the mono body is a deliberate positioning choice.`);
          } else {
            lines.push(`**Font pairing:** "${fonts[0]}" for display/heading, "${fonts[1]}" for body/UI.`);
          }
        } else if (fonts[0]) {
          lines.push(`**Single typeface:** "${fonts[0]}" — hierarchy is created through weight and size alone, not typeface switching.`);
        } else {
          lines.push('**System font stack** — no custom font detected. Hierarchy via weight and size contrast.');
        }
      }

      // Type scale from specsData
      const tsd = specsData.typography;
      if (tsd.h1 || tsd.body) {
        lines.push('');
        lines.push('**Measured type scale:**');
        if (tsd.h1) lines.push(`- H1: \`${tsd.h1.fontSize}/${tsd.h1.fontWeight}\`${tsd.h1.lineHeight ? ` line-height \`${tsd.h1.lineHeight}\`` : ''}${tsd.h1.letterSpacing && tsd.h1.letterSpacing !== 'normal' ? `, tracking \`${tsd.h1.letterSpacing}\`` : ''}${tsd.h1.textTransform === 'uppercase' ? ', uppercase' : ''}${tsd.h1.fontFamily ? ` in "${tsd.h1.fontFamily}"` : ''}`);
        if (tsd.h2) lines.push(`- H2: \`${tsd.h2.fontSize}/${tsd.h2.fontWeight}\``);
        if (tsd.h3) lines.push(`- H3: \`${tsd.h3.fontSize}/${tsd.h3.fontWeight}\``);
        if (tsd.body) lines.push(`- Body: \`${tsd.body.fontSize}/${tsd.body.fontWeight}\`${tsd.body.lineHeight ? ` line-height \`${tsd.body.lineHeight}\`` : ''}${tsd.body.fontFamily ? ` in "${tsd.body.fontFamily}"` : ''}`);
        if (tsd.label) lines.push(`- Label: \`${tsd.label.fontSize}/${tsd.label.fontWeight}\`${tsd.label.textTransform === 'uppercase' ? ' uppercase' : ''}${tsd.label.letterSpacing ? ` tracking \`${tsd.label.letterSpacing}\`` : ''}`);
      }

      // Font weights
      if (specsData.fontWeights.length > 1) {
        lines.push(`- Weight range: ${specsData.fontWeights.join(', ')}`);
      }

      const sizeVars=Object.entries(vars).filter(([k,v])=>/size|step|scale/.test(k)&&/\d+(px|rem)/.test(v)
        &&!k.startsWith('--tw-')&&!k.startsWith('--swiper-')&&!k.startsWith('--toastify-')&&!k.includes('icon'));
      if(sizeVars.length>0){lines.push('');lines.push('**Size scale tokens:**');sizeVars.slice(0,6).forEach(([k,v])=>lines.push(`- \`${k}\`: ${v}`));}
      lines.push('');
    }
  }

  // ── Surface & Depth (replaces Shadow Tokens + Shape Tokens) ──
  if(focus==='all'||focus==='shadows') {
    const shadowVars=Object.entries(vars).filter(([k,v])=>
      /shadow|elevation/.test(k) && /\d+(px|rgba)/.test(v) &&
      !k.startsWith('--tw-') && !k.startsWith('--swiper-') &&
      !k.startsWith('--toastify-') && !k.startsWith('--toast-') &&
      !k.startsWith('--sonner-') && !k.startsWith('--tippy-')
    );
    const shadows=(data.shadows||[]).filter(s=>s&&s!=='none');

    const LIBRARY_PREFIXES = ['--tw-','--swiper-','--toastify-','--toast-','--sonner-','--tippy-','--mdb-','--bs-'];
    const radiiVars=Object.entries(vars).filter(([k])=>
      /radius|rounded/.test(k) && !LIBRARY_PREFIXES.some(p=>k.startsWith(p))
    );
    const radii=(data.borderRadii||[]).filter(r=>r&&r!=='0px');
    const hasPill = style.hasFullRound;

    if(shadowVars.length>0||shadows.length>0||radiiVars.length>0||radii.length>0||hasPill) {
      lines.push('### Surface & Depth');
      lines.push('Elevation and shape work together to create the page\'s physical language — how elements float, stack, and relate to each other in perceived space.');
      lines.push('');

      // Shadow narrative
      if(shadowVars.length>0) {
        lines.push('**Elevation tokens:**');
        shadowVars.slice(0,5).forEach(([k,v])=>{
          const role = k.includes('sm') ? 'card' : k.includes('lg') || k.includes('xl') ? 'button-hover' : 'container';
          lines.push('- `'+k+'`: '+narrateShadow(v, role));
        });
        lines.push('');
      } else if (shadows.length > 0) {
        lines.push('**Elevation system:**');
        const shadowRoles = ['card','container','button-hover','nav'];
        shadows.slice(0,4).forEach((s,i)=>{
          const layers = [];
          let depth = 0, cur = '';
          for (let j = 0; j < s.length; j++) {
            const ch = s[j];
            if (ch==='(') depth++;
            else if (ch===')') depth--;
            else if (ch===',' && depth===0) { if(cur.trim()) layers.push(cur.trim()); cur=''; continue; }
            cur += ch;
          }
          if (cur.trim()) layers.push(cur.trim());
          const realLayers = layers.filter(layer => {
            const t = layer.trim();
            if (!t) return false;
            if (/^rgba?\(\s*0[\s,]+0[\s,]+0[\s,]+0[\s,)]*\)/.test(t)) return false;
            if (t.includes('oklab(')) return true;
            if (/rgba\(\s*\d+[\s,]+\d+[\s,]+\d+[\s,]+(?:0\.[1-9]|[1-9])/.test(t)) return true;
            if (t.includes('inset') && /rgb\(/.test(t)) return true;
            return false;
          });
          if (realLayers.length > 0) {
            const fullShadow = realLayers.join(', ');
            lines.push('- shadow-'+['sm','md','lg','xl'][i]+': '+narrateShadow(fullShadow, shadowRoles[i]||'container'));
          }
        });
        lines.push('');
      }

      // Shape narrative
      if(radiiVars.length>0) {
        lines.push('**Shape tokens:**');
        radiiVars.slice(0,5).forEach(([k,v])=>lines.push('- `'+k+'`: '+narrateRadius(v, k.includes('btn')?'button':k.includes('card')?'card':'element')));
        if (hasPill && !radiiVars.some(([,v])=>v.includes('9999'))) {
          lines.push('- Interactive elements (buttons, badges): '+narrateRadius('9999px','interactive element'));
        }
        lines.push('');
      } else if (radii.length > 0 || hasPill) {
        lines.push('**Shape language:**');
        const sorted=[...new Set(radii)].sort((a,b)=>parseInt(a)-parseInt(b));
        sorted.slice(0,6).forEach(r=>{
          const v = parseInt(r);
          let comp = 'element';
          if (r === '9999px' || r === '50%') comp = 'interactive element';
          else if (v >= 16) comp = 'card';
          else if (v >= 8) comp = 'component';
          else if (v >= 4) comp = 'input';
          lines.push('- '+narrateRadius(r, comp));
        });
        if (hasPill && !sorted.some(r=>r==='9999px'||parseInt(r)>100)) {
          lines.push('- '+narrateRadius('9999px', 'button/badge'));
        }
        lines.push('');
      }

      // Image treatment from specsData
      if (specsData.imageStyles) {
        const imgS = specsData.imageStyles;
        let imgNarrative = '**Image treatment:** ';
        const parts = [];
        if (imgS.borderRadius) parts.push('`border-radius: '+imgS.borderRadius+'`');
        if (imgS.objectFit) parts.push('`object-fit: '+imgS.objectFit+'`');
        if (imgS.boxShadow) parts.push('shadow `'+imgS.boxShadow+'`');
        if (imgS.filter) parts.push('filter `'+imgS.filter+'`');
        if (imgS.aspectRatio) parts.push('aspect-ratio ~'+imgS.aspectRatio);
        imgNarrative += parts.join(', ')+'. Images are treated as design elements — their framing matches the component family.';
        lines.push(imgNarrative);
        lines.push('');
      }
    }
  }

  // ── Hover States (compact — animations are now in Component Language) ──
  if(focus==='all'||focus==='motion') {
    const hoverStates = data.hoverStates || [];
    const blendModes = vpr.blendModes || [];

    if(hoverStates.length > 0) {
      lines.push('### Hover States');
      hoverStates.slice(0, 8).forEach(h => {
        const { selector, ...props } = h;
        const propStr = Object.entries(props).map(([k,v]) => `\`${k}: ${v}\``).join(', ');
        lines.push(`- \`${selector}\` → ${propStr}`);
      });
      if(blendModes.length > 0) lines.push(`- Blend modes: \`mix-blend-mode: ${blendModes.join(', ')}\``);
      if (specsData.links) {
        const lk = specsData.links;
        lines.push(`- Links: \`color: ${lk.color}\`, \`text-decoration: ${lk.textDecoration}\`${lk.textUnderlineOffset ? ', offset `'+lk.textUnderlineOffset+'`' : ''}`);
      }
      lines.push('');
    }
  }

  // ── Component Language (replaces Component Patterns) ──
  if(focus==='all'||focus==='components') {
    lines.push('### Components & Animation');
    lines.push('Each component includes its exact specs AND animation behavior. Implement these animations — they are essential to the design.');
    lines.push('');
    generateComponentGuidance(data, style).forEach(c=>lines.push(c));

    // Merge remaining specsData items
    if (specsData.icons) {
      const ic = specsData.icons;
      if (!ui.hasIconSystem) {
        lines.push(`**Icons:** \`${ic.size}\`, ${ic.style} style${ic.strokeWidth ? ', `'+ic.strokeWidth+'px` stroke' : ''}${ic.color ? ', color `'+ic.color+'`' : ''}.`);
      }
    }
    if (specsData.footer) {
      const ft = specsData.footer;
      let ftNarrative = '**Footer:** ';
      const parts = [];
      if (ft.backgroundColor) parts.push('bg `'+ft.backgroundColor+'`');
      if (ft.color) parts.push('text `'+ft.color+'`');
      if (ft.padding) parts.push('padding `'+ft.padding+'`');
      if (ft.borderTop) parts.push('border-top `'+ft.borderTop+'`');
      if (ft.columns) parts.push(ft.columns+'-column layout');
      if (ft.gap) parts.push('gap `'+ft.gap+'`');
      ftNarrative += parts.join(', ')+'. The footer anchors the page — it should match the nav in width and alignment.';
      lines.push(ftNarrative);
    }
    lines.push('');
  }

  // ── Page Flow (combines Layout + Section Content Map) ──
  if(focus==='all'||focus==='layout') {
    lines.push('### Page Flow');

    // Layout narrative
    const layout=data.layoutInfo||{};
    const spacing = vpr.spacingSystem||{};
    let layoutNarrative = 'The page\'s spatial architecture:';
    if (spacing.containerMaxWidth && spacing.containerMaxWidth !== 'none') layoutNarrative += ' '+narrateSpacing(spacing.containerMaxWidth, 'container-width');
    else if (layout.maxWidth && layout.maxWidth !== 'none') layoutNarrative += ' Max content width: `'+layout.maxWidth+'`.';
    if (spacing.sectionPaddingY) layoutNarrative += ' '+narrateSpacing(spacing.sectionPaddingY, 'section-padding');
    if (spacing.gridGap) layoutNarrative += ' '+narrateSpacing(spacing.gridGap, 'grid-gap');
    if (spacing.cardGap && spacing.cardGap !== spacing.gridGap) layoutNarrative += ' Card gap: `'+spacing.cardGap+'`.';
    if (vpr.splitLayoutCount>0) layoutNarrative += ` ${vpr.splitLayoutCount} split-column section(s) create a zigzag reading pattern.`;
    if (vpr.hasScrollAnimation) layoutNarrative += ' Scroll animations (IntersectionObserver + `fade` + `translateY(20px)→0`) reveal content as it enters view.';
    lines.push(layoutNarrative);
    if (layout.hasNav) lines.push(`Navigation: ${vpr.navStyle||'sticky'}.`);
    if (ui.pageStructure?.length>0) lines.push(`Page structure: ${ui.pageStructure.join(' → ')}.`);
    lines.push('');
  }

  // ── Custom Content injection ──
  if (state.contentMode === 'custom' && state.customContent.trim()) {
    lines.push('### Custom Content');
    lines.push('Use the following content for headings, descriptions, and CTAs instead of the site\'s original text:');
    lines.push('```');
    lines.push(state.customContent.trim());
    lines.push('```');
    lines.push('Apply the content above to the sections below in order. First line = hero heading, subsequent lines = section headings and body text.');
    lines.push('');
  }

  // ── Section Content Map ──
  if(focus==='all') {
    const scm = data.sectionContentMap || [];
    if (scm.length > 0) {
      lines.push('### Section Content Map');
      lines.push('Build the page with these exact sections in order. Each section\'s background, layout, and content are measured from the live site:');
      lines.push('');
      // Determine entrance animation type for sections
      const sap = vpr.animationPatterns || {};
      let entranceAnim = 'Entrance: `opacity: 0→1; transform: translateY(20px)→0; transition: 0.4s ease-out` on scroll into view (IntersectionObserver).';
      if (sap.hasMaskReveal) entranceAnim = 'Entrance: `clip-path: inset(100% 0 0 0)→inset(0); transition: 0.6s ease-out` on scroll into view.';
      else if (sap.hasStaggerReveal) entranceAnim = 'Entrance: children stagger in with `opacity: 0→1; translateY(20px)→0`, 80ms delay between each, 400ms ease-out. Trigger on scroll via IntersectionObserver.';

      scm.forEach((sec, i) => {
        let desc = `**Section ${i+1}: ${sec.type}**`;
        if (sec.heading) desc += ` — "${sec.heading}"`;
        lines.push(desc);
        if (sec.bgColor) lines.push(`  Background: ${sec.bgColor}`);
        if (sec.gradient) lines.push(`  Gradient: \`${sec.gradient}\``);
        lines.push(`  Layout: ${sec.layout}`);
        // Animation binding per section
        if (i === 0) {
          lines.push('  Animation: hero loads immediately (no scroll trigger). '+(sap.hasTextReveal||sap.hasHeroAnimation?'Headline words appear sequentially with staggered `animation-delay`, `opacity: 0→1` + `translateY(10px)→0`.':''));
        } else if (vpr.hasScrollAnimation) {
          lines.push('  '+entranceAnim);
        }
        if (sec.ctas) lines.push(`  CTAs: ${sec.ctas.map(c=>'"'+c+'"').join(', ')}`);
        if (sec.arrowLinks) lines.push(`  Arrow links: ${sec.arrowLinks.map(c=>'"'+c+'"').join(', ')}`);
        if (sec.hasSlider) lines.push('  Has slider/carousel: CSS scroll-snap, auto-play with pause on hover.');
        if (sec.hasNumberedItems) lines.push('  Numbered items (01, 02, 03 pattern)');
        if (sec.headingColoredWords && sec.headingColoredWords.length > 0) {
          lines.push(`  Heading accent: ${sec.headingColoredWords.map(w => `"${w.text}" (${w.style})`).join(', ')}`);
        }
        if (sec.decorativeGradients && sec.decorativeGradients.length > 0) {
          sec.decorativeGradients.forEach(d => {
            let dsc = `  Gradient stripe: \`${d.gradient}\``;
            if (d.transform) dsc += `, \`transform: ${d.transform}\``;
            lines.push(dsc);
          });
        }
        if (sec.visualDescriptions && sec.visualDescriptions.length > 0) {
          lines.push('  Visuals:');
          sec.visualDescriptions.forEach(v => lines.push(`    - ${v}`));
        }
        lines.push('');
      });
      lines.push('VISUAL GUIDELINES:');
      lines.push('- Each visual above is described with its content type, dimensions, placement, and framing style. Recreate each visual faithfully based on its description.');
      lines.push('- For visuals described as "illustration with embedded avatar/icon images": create a diagram with small circular avatar placeholders (colored circles with initials), connected by lines or arrows, with data labels.');
      lines.push('- For visuals described as "data visualization" or "chart": create actual charts/graphs using the site\'s color palette.');
      lines.push('- For visuals with alt text (e.g. "Raise with Roll Up Vehicles®"): the alt text describes what the image shows — recreate that concept as a UI mockup or illustration in the site\'s style.');
      lines.push('- Match the described frame style exactly: border, radius, container-bg, padding values are extracted from the actual site.');
      lines.push('- Respect placement: left = positioned in left 40%, right = right 40%, center = centered.');
      lines.push('- Respect perspective: flat = no rotation, 3d-angled = slight rotateY/rotateX, slightly-rotated = subtle tilt.');
      lines.push('');
    }
  }

  lines.push(getPlatformInstruction(null, site, data));
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN SPECS DATA — structured object for narrative distribution
// ═══════════════════════════════════════════════════════════════════════════
function getDesignSpecsData(data, style) {
  const bs = data.buttonStyles || {};
  const tp = data.typographyPatterns || {};
  const badge = data.badgeStyles;
  const vpr = data.visualProfile || {};
  const spacing = vpr.spacingSystem || {};
  const ui = (vpr.uiPatterns) || {};
  const iconD = ui.iconDetails || {};

  return {
    typography: {
      h1: tp.h1 || null, h2: tp.h2 || null, h3: tp.h3 || null,
      body: tp.body || null, label: tp.label || null
    },
    spacing: {
      sectionPaddingY: spacing.sectionPaddingY || null,
      sectionPaddingX: spacing.sectionPaddingX || null,
      containerMaxWidth: spacing.containerMaxWidth || null,
      gridGap: spacing.gridGap || null,
      cardGap: spacing.cardGap || null
    },
    icons: ui.hasIconSystem ? {
      size: iconD.size || null, style: ui.iconStyle || 'outlined',
      strokeWidth: iconD.strokeWidth || null, color: iconD.color || null,
      containerStyle: iconD.containerStyle || 'none',
      containerSize: iconD.containerSize || null,
      containerBg: iconD.containerBg || null,
      containerRadius: iconD.containerRadius || null,
      gapToText: iconD.gapToText || null,
      count: ui.iconSystemCount || 0
    } : null,
    badges: badge ? {
      backgroundColor: badge.backgroundColor, color: badge.color,
      borderRadius: badge.borderRadius, padding: badge.padding,
      fontSize: badge.fontSize, fontWeight: badge.fontWeight,
      border: badge.border
    } : null,
    inputs: data.inputStyles || null,
    gradients: data.gradients || [],
    imageStyles: data.imageStyles || null,
    links: data.linkStyles || null,
    footer: data.footerStyles || null,
    fontWeights: data.fontWeights || []
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN SPECIFICATIONS — prescriptive CSS values for vibe coding tools
// ═══════════════════════════════════════════════════════════════════════════
function generateDesignSpecs(data, style) {
  const lines = [];
  const bs = data.buttonStyles || {};
  const tp = data.typographyPatterns || {};
  const badge = data.badgeStyles;
  const vpr = data.visualProfile || {};
  const spacing = vpr.spacingSystem || {};
  const ui = (vpr.uiPatterns) || {};
  const iconD = ui.iconDetails || {};

  let hasContent = false;

  // Button specs are in Component Patterns — no duplication here

  // Typography scale
  if (tp.h1 || tp.h2 || tp.body) {
    lines.push('**Typography Scale:**');
    for (const [key, label] of [['h1','H1'],['h2','H2'],['h3','H3'],['body','Body'],['label','Label']]) {
      const t = tp[key];
      if (!t) continue;
      let spec = `- ${label}: \`${t.fontSize}/${t.lineHeight||'1.2'}/${t.fontWeight||'400'}\``;
      if (t.letterSpacing) spec += `, tracking \`${t.letterSpacing}\``;
      if (t.textTransform) spec += `, \`${t.textTransform}\``;
      if (t.fontFamily) spec += `, font "${t.fontFamily}"`;
      lines.push(spec);
    }
    lines.push('');
    hasContent = true;
  }

  // Spacing
  if (spacing.sectionPaddingY || spacing.containerMaxWidth || spacing.gridGap) {
    lines.push('**Spacing:**');
    if (spacing.sectionPaddingY) lines.push(`- Section padding: \`${spacing.sectionPaddingY} 0\``);
    if (spacing.containerMaxWidth && spacing.containerMaxWidth !== 'none') lines.push(`- Container max-width: \`${spacing.containerMaxWidth}\``);
    if (spacing.gridGap) lines.push(`- Grid gap: \`${spacing.gridGap}\``);
    if (spacing.cardGap) lines.push(`- Card gap: \`${spacing.cardGap}\``);
    if (spacing.sectionPaddingX) lines.push(`- Section horizontal padding: \`${spacing.sectionPaddingX}\``);
    lines.push('');
    hasContent = true;
  }

  // Icons
  if (ui.hasIconSystem && iconD.size) {
    lines.push('**Icons:**');
    let spec = `- Size: \`${iconD.size}\`, style: ${ui.iconStyle||'outlined'}`;
    if (iconD.strokeWidth) spec += `, stroke: \`${iconD.strokeWidth}px\``;
    if (iconD.color) spec += `, color: \`${iconD.color}\``;
    lines.push(spec);
    if (iconD.containerStyle !== 'none' && iconD.containerSize) {
      let containerSpec = `- Container: \`${iconD.containerSize}\` ${iconD.containerStyle}`;
      if (iconD.containerBg) containerSpec += `, bg \`${iconD.containerBg}\``;
      if (iconD.containerRadius) containerSpec += `, radius \`${iconD.containerRadius}\``;
      lines.push(containerSpec);
    }
    if (iconD.gapToText) lines.push(`- Gap to text: \`${iconD.gapToText}\``);
    lines.push('');
    hasContent = true;
  }

  // Badges
  if (badge) {
    lines.push('**Badges/Tags:**');
    let spec = `- bg \`${badge.backgroundColor||'muted'}\`, text \`${badge.color||'inherit'}\``;
    if (badge.borderRadius) spec += `, radius \`${badge.borderRadius}\``;
    if (badge.padding) spec += `, padding \`${badge.padding}\``;
    spec += `, font \`${badge.fontSize||'12px'}/${badge.fontWeight||'500'}\``;
    if (badge.border) spec += `, border \`${badge.border}\``;
    lines.push(spec);
    lines.push('');
    hasContent = true;
  }

  // Inputs
  const inputS = data.inputStyles;
  if (inputS) {
    lines.push('**Inputs:**');
    let spec = '';
    if (inputS.backgroundColor) spec += `bg \`${inputS.backgroundColor}\``;
    if (inputS.border) spec += `, border \`${inputS.border}\``;
    if (inputS.borderRadius) spec += `, radius \`${inputS.borderRadius}\``;
    if (inputS.padding) spec += `, padding \`${inputS.padding}\``;
    spec += `, font \`${inputS.fontSize||'14px'}\``;
    if (inputS.fontFamily) spec += ` "${inputS.fontFamily}"`;
    if (inputS.height) spec += `, height \`${inputS.height}\``;
    lines.push(`- ${spec.replace(/^, /,'')}`);
    lines.push('- Focus: outline 2px solid accent, offset 2px');
    lines.push('');
    hasContent = true;
  }

  // Gradients
  const grads = data.gradients || [];
  if (grads.length > 0) {
    lines.push('**Gradients:**');
    grads.forEach(g => {
      lines.push(`- \`${g.value}\``);
    });
    lines.push('');
    hasContent = true;
  }

  // Image treatment
  const imgS = data.imageStyles;
  if (imgS) {
    lines.push('**Image Treatment:**');
    let spec = '';
    if (imgS.borderRadius) spec += `border-radius \`${imgS.borderRadius}\``;
    if (imgS.objectFit) spec += `, object-fit \`${imgS.objectFit}\``;
    if (imgS.border) spec += `, border \`${imgS.border}\``;
    if (imgS.boxShadow) spec += `, shadow \`${imgS.boxShadow}\``;
    if (imgS.filter) spec += `, filter \`${imgS.filter}\``;
    if (imgS.aspectRatio) spec += `, aspect-ratio ~${imgS.aspectRatio}`;
    lines.push(`- ${spec.replace(/^, /,'')}`);
    lines.push('');
    hasContent = true;
  }

  // Links
  const linkS = data.linkStyles;
  if (linkS) {
    lines.push('**Links:**');
    let spec = `color \`${linkS.color}\``;
    spec += `, text-decoration \`${linkS.textDecoration}\``;
    if (linkS.textUnderlineOffset) spec += `, underline-offset \`${linkS.textUnderlineOffset}\``;
    if (linkS.textDecorationColor) spec += `, decoration-color \`${linkS.textDecorationColor}\``;
    lines.push(`- ${spec}`);
    lines.push('');
    hasContent = true;
  }

  // Footer
  const footerS = data.footerStyles;
  if (footerS) {
    lines.push('**Footer:**');
    let spec = '';
    if (footerS.backgroundColor) spec += `bg \`${footerS.backgroundColor}\``;
    if (footerS.color) spec += `, text \`${footerS.color}\``;
    if (footerS.padding) spec += `, padding \`${footerS.padding}\``;
    if (footerS.borderTop) spec += `, border-top \`${footerS.borderTop}\``;
    if (footerS.columns) spec += `, ${footerS.columns}-column layout`;
    if (footerS.gap) spec += `, gap \`${footerS.gap}\``;
    lines.push(`- ${spec.replace(/^, /,'')}`);
    lines.push('');
    hasContent = true;
  }

  // Font weights used
  const fontW = data.fontWeights || [];
  if (fontW.length > 1) {
    lines.push('**Font Weights Used:**');
    lines.push(`- ${fontW.join(', ')}`);
    lines.push('');
    hasContent = true;
  }

  if (!hasContent) return null;
  if (!lines[0]?.startsWith('###')) lines.unshift('### Design Specifications', '');
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN SYSTEM EXPORT
// ═══════════════════════════════════════════════════════════════════════════
function setOutputMode(mode) {
  document.querySelectorAll('.output-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.output === mode));

  if (!state.lastAnalyzedData) return;
  const data = state.lastAnalyzedData;

  try {
    if (mode === 'system') {
      const style = analyzeDesignStyle(data);
      state.lastPrompt = buildDesignSystemPrompt(data, style);
    } else {
      state.lastPrompt = buildPagePrompt(data, null);
    }
  } catch(err) {
    console.warn('Output mode switch failed:', err.message);
    // Fallback: keep existing prompt
  }
  $('promptOutput').textContent = state.lastPrompt;
}

function buildDesignSystemPrompt(data, style) {
  const site = safeHostname(data.url), vars = data.cssVars || {};
  const platform = state.platform;
  const specsData = getDesignSpecsData(data, style);
  const lines = [];

  const { isDark,isLight,hasFullRound,hasGlowEffect,hasLayeredShadows,hasBrutalistShadow,
    vibrantColors,fonts:styleFonts,vp,accents,radii,pageBg,semanticColors } = style;
  const vpr = vp||{}, ui = (vpr.uiPatterns)||{};
  const sc = semanticColors || {};
  const primaryColor = sc.primary || vibrantColors[0] || accents[0];
  const interactiveRadii = radii.filter(r=>!r.includes('50%'));
  const radiusSample = interactiveRadii.find(r=>parseInt(r)>=4&&parseInt(r)<=24) || interactiveRadii[0];

  lines.push('# Design System');
  lines.push(`Extracted from: ${site}`);
  lines.push('');
  lines.push('This design system defines the visual DNA of the product. Use it to build ANY page — pricing, docs, about, settings, onboarding — in the same visual language. Sub-pages will contain components not present on the main page (tables, tabs, modals, steppers, etc.). Derive them from the rules below.');
  lines.push('');
  lines.push(getPlatformHeader());
  lines.push('');

  // ── 1. Design DNA — the derivation rules ──
  lines.push('## Design DNA');
  lines.push('When you encounter a component that doesn\'t exist in this system, derive it from these core principles:');
  lines.push('');

  // Surface rule
  const bgRef = pageBg ? '`'+pageBg+'`' : (isDark ? 'dark neutral' : 'light neutral');
  lines.push('**Surface:** Page ground is '+bgRef+'. '+(isDark
    ? 'All surfaces are dark. Elevated elements are 8–12% lighter than their parent. Use `rgba(255,255,255,0.06)` borders for definition. Never introduce white backgrounds.'
    : 'Primary surface is white or '+bgRef+'. Elevated elements (cards, modals, dropdowns) use white with subtle border `rgba(0,0,0,0.08)`. Keep the light, open feel.'));

  // Shape rule
  lines.push('**Shape:** Interactive radius = `'+(hasFullRound?'9999px':'`'+(radiusSample||'8px')+'`')+'`. Container radius = `'+(radiusSample||'8px')+'`. New components (tabs, table cells, tooltips, modals) inherit the container radius. Chips/tags inherit the interactive radius. This is the geometric family — every new element must speak this shape language.');

  // Elevation rule
  if (hasBrutalistShadow) {
    lines.push('**Elevation:** Brutalist — hard `4px 4px 0` shadows, zero blur. New elevated components (dropdowns, modals, toasts) use the same hard shadow. Hover states shift the shadow offset.');
  } else if (hasGlowEffect) {
    lines.push('**Elevation:** Glow-based — zero-offset diffused shadows. New elevated components use the same glow language. Hover states intensify the glow.');
  } else if (hasLayeredShadows) {
    lines.push('**Elevation:** Layered shadows. New elevated components (dropdowns, modals, toasts) use the same multi-layer shadow system. Never simplify to a single layer.');
  } else {
    lines.push('**Elevation:** '+(isDark?'Border-defined. Dark surfaces rely on borders (`rgba(255,255,255,0.06–0.12)`) rather than shadows. New elevated components follow the same border-first approach.':'Soft shadow (`0 4px 24px rgba(0,0,0,0.06–0.10)`). New elevated components use the same shadow scale — lighter for tooltips, heavier for modals.'));
  }

  // Color derivation rule
  if (primaryColor) {
    lines.push('**Color derivation:** Primary action = `'+primaryColor+'`. When a new component needs states (selected tab, active step, toggle-on, progress bar), use `'+primaryColor+'`. Destructive actions use `#ef4444`. Success states use `#22c55e`. Warning uses `#f59e0b`. Muted/disabled: '+(isDark?'`rgba(255,255,255,0.3)` text, `rgba(255,255,255,0.06)` surface':'`rgba(0,0,0,0.3)` text, `#f5f5f5` surface')+'.');
  }

  // Typography derivation rule
  const SYSTEM_FONTS = new Set(['ui-sans-serif','ui-serif','ui-monospace','system-ui','-apple-system','blinkmacsystemfont','helvetica neue','arial','sans-serif','serif','monospace']);
  const fonts = [...new Set((data.fonts || []).filter(f => f && !SYSTEM_FONTS.has(f.toLowerCase())).map(f => f.trim()))];
  if (fonts.length >= 2) {
    lines.push('**Type derivation:** Headings in "'+fonts[0]+'" (600–800 weight), body/UI in "'+fonts[1]+'" (400–500). New components: table headers → heading font 500, tab labels → body font 500 uppercase, code blocks → monospace if available. Never introduce a third typeface.');
  } else if (fonts[0]) {
    lines.push('**Type derivation:** Single typeface "'+fonts[0]+'". Hierarchy through weight only: headings 600–800, body 400, labels 500. New components follow the same weight scale.');
  }

  // Interaction derivation rule
  lines.push('**Interaction derivation:** Hover = '+(isDark?'`brightness(1.08)` or `rgba(255,255,255,0.06)` overlay':'`brightness(0.95)` or `rgba(0,0,0,0.04)` overlay')+', 150–200ms ease-out. Focus = `outline 2px solid '+(primaryColor||'currentColor')+' offset 2px`. Active = `scale(0.98)`. New interactive components (tabs, toggles, accordions, sliders) inherit this exact interaction language.');

  // Spacing derivation rule
  const spacing = vpr.spacingSystem || {};
  if (spacing.sectionPaddingY || spacing.gridGap) {
    lines.push('**Spacing derivation:** Section padding `'+(spacing.sectionPaddingY||'80px')+' 0`. Grid gap `'+(spacing.gridGap||'24px')+'`. Container max-width `'+(spacing.containerMaxWidth||'1200px')+'`. New pages maintain these exact values. Component internal padding: cards `24–32px`, modals `24–32px`, table cells `12–16px`, tabs `8–12px 16–20px`.');
  }
  lines.push('');

  // ── 2. Token Reference ──
  lines.push('## Color Tokens');
  const namedVars = Object.entries(vars).filter(([k,v]) =>
    /^#[0-9a-f]{3,8}$/i.test(v.trim()) &&
    !k.startsWith('--tw-') && !k.startsWith('--swiper-') &&
    !k.startsWith('--framer-') && !k.startsWith('--wf-')
  );
  if (namedVars.length > 0) namedVars.slice(0, 14).forEach(([k, v]) => lines.push('- `' + k + '`: `' + v + '`'));
  if (sc.primary) lines.push('- primary-action: `' + sc.primary + '`');
  if (style.pageBg) lines.push('- background: `' + style.pageBg + '`');
  // Add derived state colors for sub-pages
  lines.push('- destructive: `#ef4444`');
  lines.push('- success: `#22c55e`');
  lines.push('- warning: `#f59e0b`');
  lines.push('- muted-text: '+(isDark?'`rgba(255,255,255,0.5)`':'`rgba(0,0,0,0.4)`'));
  lines.push('- border: '+(isDark?'`rgba(255,255,255,0.08)`':'`rgba(0,0,0,0.08)`'));
  lines.push('');

  if (fonts.length > 0) {
    lines.push('## Typography Tokens');
    if (fonts.length >= 2) { lines.push('- Display: "' + fonts[0] + '"'); lines.push('- Body: "' + fonts[1] + '"'); }
    else lines.push('- Font: "' + fonts[0] + '"');
    const tp = data.typographyPatterns;
    if (tp?.h1) lines.push('- H1: `' + tp.h1.fontSize + '/' + tp.h1.fontWeight + '`');
    if (tp?.h2) lines.push('- H2: `' + tp.h2.fontSize + '/' + tp.h2.fontWeight + '`');
    if (tp?.h3) lines.push('- H3: `' + tp.h3.fontSize + '/' + tp.h3.fontWeight + '`');
    if (tp?.body) lines.push('- Body: `' + tp.body.fontSize + '/' + tp.body.fontWeight + '`' + (tp.body.lineHeight ? ' line-height `' + tp.body.lineHeight + '`' : ''));
    if (tp?.label) lines.push('- Label: `' + tp.label.fontSize + '/' + tp.label.fontWeight + '`' + (tp.label.textTransform === 'uppercase' ? ' uppercase' : ''));
    if (specsData.fontWeights.length > 1) lines.push('- Weight range: ' + specsData.fontWeights.join(', '));
    lines.push('');
  }

  const shadows = (data.shadows || []).filter(s => s && s !== 'none');
  if (shadows.length > 0) {
    lines.push('## Shadow Tokens');
    shadows.slice(0, 4).forEach((s, i) => lines.push('- shadow-' + ['sm','md','lg','xl'][i] + ': `' + s + '`'));
    lines.push('');
  }

  const allRadii = (data.borderRadii || []).filter(r => r && r !== '0px');
  if (allRadii.length > 0) {
    lines.push('## Shape Tokens');
    [...new Set(allRadii)].sort((a, b) => parseInt(a) - parseInt(b)).slice(0, 6).forEach(r => lines.push('- `' + r + '`'));
    if (style.hasFullRound && !allRadii.some(r=>r==='9999px')) lines.push('- `9999px` (pill — buttons, badges, chips)');
    lines.push('');
  }

  if (spacing.sectionPaddingY || spacing.containerMaxWidth || spacing.gridGap) {
    lines.push('## Spacing Tokens');
    if (spacing.sectionPaddingY) lines.push('- Section padding: `'+spacing.sectionPaddingY+' 0`');
    if (spacing.containerMaxWidth && spacing.containerMaxWidth !== 'none') lines.push('- Container max-width: `'+spacing.containerMaxWidth+'`');
    if (spacing.gridGap) lines.push('- Grid gap: `'+spacing.gridGap+'`');
    if (spacing.cardGap && spacing.cardGap !== spacing.gridGap) lines.push('- Card gap: `'+spacing.cardGap+'`');
    if (spacing.sectionPaddingX) lines.push('- Section horizontal padding: `'+spacing.sectionPaddingX+'`');
    lines.push('');
  }

  // ── 3. Existing Component Patterns (as derivation examples) ──
  lines.push('## Component Patterns');
  lines.push('These are the components extracted from the main page. Use them as reference for the visual language when building new components.');
  lines.push('');
  generateComponentGuidance(data, style).forEach(c => lines.push(c));
  lines.push('');

  // ── 4. Derivation Guide — how to build what's NOT on the main page ──
  lines.push('## Deriving New Components');
  lines.push('Sub-pages will need components not present on the main page. Build them from the DNA above:');
  lines.push('');
  lines.push('**Tables:** Header row bg '+(isDark?'`rgba(255,255,255,0.04)`':'`#f9fafb`')+', body font `14px/500` for headers, `14px/400` for cells. Row hover: '+(isDark?'`rgba(255,255,255,0.03)`':'`rgba(0,0,0,0.02)`')+'. Border between rows: `1px solid '+(isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)')+'`. Radius on outer container matches card radius.');
  lines.push('**Tabs:** '+(hasFullRound?'Pill tabs — active tab gets `'+( primaryColor||'accent')+' ` bg with white text, inactive is transparent. `9999px` radius per tab.':'Underline tabs — active tab has `2px solid '+(primaryColor||'accent')+'` bottom border. No bg change.')+' Tab label: body font `14px/500`'+(fonts[0]?' in "'+fonts[0]+'"':'')+'. Gap between tabs: `4–8px`. Transition: 150ms ease-out.');
  lines.push('**Modals/Dialogs:** '+(isDark?'Dark surface (12% lighter than page bg), `rgba(255,255,255,0.08)` border':'White bg, `rgba(0,0,0,0.08)` border')+'. Card radius. Shadow uses the largest shadow token. Overlay: `rgba(0,0,0,'+(isDark?'0.6':'0.4')+')`. Padding: `24–32px`. Close button top-right.');
  lines.push('**Toggles/Switches:** Track width `44px`, height `24px`. Active: `'+(primaryColor||'accent')+'` bg. Inactive: '+(isDark?'`rgba(255,255,255,0.12)`':'`#d1d5db`')+'. Thumb: white circle. Transition: 200ms ease-out.');
  lines.push('**Breadcrumbs:** Body font `14px/400`, muted text color. Separator: `/` or `›`. Active (last) item: full text color, `500` weight.');
  lines.push('**Pagination:** Ghost button style for page numbers. Active page: primary color bg, white text. Radius matches button radius.');
  lines.push('**Toast/Notifications:** Card surface, card radius, card shadow. Left border `3px solid` — primary for info, `#22c55e` for success, `#ef4444` for error. Auto-dismiss animation: `opacity 0→1`, `translateY(-8px)→0`, 200ms ease-out.');
  lines.push('**Progress bars:** Track height `4–8px`, radius `9999px`, bg '+(isDark?'`rgba(255,255,255,0.08)`':'`#e5e7eb`')+'. Fill: `'+(primaryColor||'accent')+'`. Animated fill via `width` transition 300ms ease-out.');
  lines.push('**Tooltips:** Small card — `'+(isDark?'rgba(255,255,255,0.12) bg, light text':'#1a1a1a bg, white text')+'`, `6px` radius, `8px 12px` padding, `12px/400` font. Arrow pointing to trigger. 150ms fade-in.');
  lines.push('**Sidebar navigation:** Body font `14px/400` for items. Active item: '+(isDark?'`rgba(255,255,255,0.08)` bg':'`'+( primaryColor ? primaryColor+'10' : 'rgba(0,0,0,0.04)')+'` bg')+', primary color text, `500` weight. Hover: '+(isDark?'`rgba(255,255,255,0.04)`':'`rgba(0,0,0,0.02)`')+'. Item padding: `8px 12px`. Item radius: `'+( radiusSample||'6px')+'`.');
  lines.push('**Form elements:** Select, textarea, checkbox, radio — all inherit input styles (bg, border, radius, focus ring). Checkbox/radio checked state: `'+(primaryColor||'accent')+'` fill. Custom select dropdown: modal/card surface rules.');
  lines.push('');

  // ── 5. Shared elements across all pages ──
  lines.push('## Shared Across All Pages');
  lines.push('Navigation and footer are IDENTICAL on every page. Do not modify their structure, colors, or layout.');
  if (specsData.footer) {
    const ft = specsData.footer;
    const parts = [];
    if (ft.backgroundColor) parts.push('bg `'+ft.backgroundColor+'`');
    if (ft.color) parts.push('text `'+ft.color+'`');
    if (ft.padding) parts.push('padding `'+ft.padding+'`');
    if (ft.columns) parts.push(ft.columns+'-column layout');
    lines.push('Footer: '+parts.join(', ')+'.');
  }
  lines.push('');

  const googleFonts = fonts.filter(f => !['system-ui','sans-serif','serif','monospace'].includes(f.toLowerCase()));
  if (googleFonts.length > 0) {
    const fontQuery = googleFonts.map(f => f.replace(/\s+/g, '+') + ':wght@400;500;600;700;800').join('&family=');
    lines.push('Add to global CSS:');
    lines.push(`@import url('https://fonts.googleapis.com/css2?family=${fontQuery}&display=swap');`);
  }

  return lines.join('\n');
}

function buildElementPrompt(data) {
  const site=safeHostname(data.url),s=data.styles||{},platform=state.platform,lines=[],elType=guessElementType(data);
  const isContainer = data.isContainer;

  lines.push('IMPORTANT: Use the EXACT CSS values below. Do NOT apply framework defaults for padding, shadow, border-radius, or colors.');
  lines.push('');
  lines.push(`Inspired by: ${site} — ${elType}`);
  lines.push('');
  lines.push(getPlatformHeader());
  lines.push('');

  // ── Design Direction (narratif) ──
  lines.push('### Design Direction');
  const dirParts = [];
  const isDarkEl = s.backgroundColor && hexLum(s.backgroundColor) < 0.2;
  const isLightEl = s.backgroundColor && hexLum(s.backgroundColor) > 0.8;
  if (isDarkEl) dirParts.push('Dark surface');
  else if (isLightEl) dirParts.push('Light surface');
  if (s.backdropFilter) dirParts.push('glassmorphism (frosted blur)');
  if (s.boxShadow && /0px 0px/.test(s.boxShadow)) dirParts.push('glow elevation');
  else if (s.boxShadow) dirParts.push('shadow elevation');
  if (s.borderRadius?.includes('9999') || s.borderRadius?.includes('50%')) dirParts.push('pill-shaped');

  const vc = data.visualContent || [];
  const hasLottie = vc.some(v => v.isLottie);
  const hasAnimSvg = vc.some(v => v.type === 'svg' && v.animated);
  const hasCanvas = vc.some(v => v.type === 'canvas');
  const hasVideo = vc.some(v => v.type === 'video');
  const svgSubject = vc.find(v => v.subject)?.subject;

  if (hasLottie) dirParts.push(`Lottie animation${svgSubject ? ` (${svgSubject})` : ''}`);
  else if (hasAnimSvg) dirParts.push(`animated SVG${svgSubject ? ` (${svgSubject})` : ''}`);
  else if (hasCanvas) dirParts.push('canvas animation');
  else if (hasVideo) dirParts.push('video content');
  else if (svgSubject) dirParts.push(svgSubject);

  if (data.hasGridPattern) dirParts.push('dot grid pattern');
  if (data.animatedDescendants > 3) dirParts.push(`${data.animatedDescendants} animated elements`);

  let dirText = dirParts.length > 0 ? dirParts.join(' · ') + '.' : `${elType}. Replicate visual weight and proportions exactly.`;

  if (isContainer && data.textHierarchy?.length > 0 && vc.length > 0) {
    const heading = data.textHierarchy.find(t => t.role === 'heading');
    const visual = vc[0];
    if (heading && visual) {
      dirText += ` This is a ${isDarkEl ? 'dark' : 'light'} card combining a ${visual.type === 'lottie-svg' ? 'Lottie vector animation' : visual.type} with a text block ("${heading.text.slice(0, 30)}").`;
    }
  }

  if (data.innerButtons?.length > 0) {
    dirText += ` Contains interactive CTA: "${data.innerButtons[0].text}".`;
  }

  lines.push(dirText);
  lines.push('');

  // ── Container Surface ──
  lines.push('### Surface');
  {
    let surfaceNarrative = `This ${elType.toLowerCase()} sits on`;
    if(s.backgroundColor) surfaceNarrative += ` a \`${s.backgroundColor}\` ground`;
    if(s.borderRadius) surfaceNarrative += ` with ${narrateRadius(s.borderRadius, elType.toLowerCase())}`;
    surfaceNarrative += '.';
    lines.push(surfaceNarrative);
    if(s.backgroundImage&&s.backgroundImage!=='none') lines.push(`Background image: \`${s.backgroundImage}\`.`);
    if(data.borderInfo) lines.push(`Border: \`${data.borderInfo}\`.`);
    else if(s.border&&s.border!=='none'&&!/0px/.test(s.border)) lines.push(`Border: \`${s.border}\`.`);
    if(s.boxShadow) lines.push(narrateShadow(s.boxShadow, elType==='Button'?'button':elType==='Card'?'card':'container'));
    if(s.padding) lines.push(`Padding \`${s.padding}\` — giving the content room to breathe within the container.`);
    if(s.backdropFilter) lines.push(`Backdrop filter: \`${s.backdropFilter}\` — frosted glass effect creating a layered visual plane.`);
    if(s.opacity&&s.opacity!=='1') lines.push(`Opacity: \`${s.opacity}\`.`);
  }
  lines.push('');

  // ── Layout (for containers) ──
  if(isContainer && (s.display||s.gap||s.alignItems||s.justifyContent||s.flexDirection)) {
    lines.push('### Layout');
    if(s.display) lines.push(`- Display: \`${s.display}\``);
    if(s.flexDirection) lines.push(`- Flex direction: \`${s.flexDirection}\``);
    if(s.gap) lines.push(`- Gap: \`${s.gap}\``);
    if(s.alignItems) lines.push(`- Align items: \`${s.alignItems}\``);
    if(s.justifyContent) lines.push(`- Justify content: \`${s.justifyContent}\``);
    lines.push('');
  }

  // ── Text Hierarchy (heading, body, labels) ──
  if(data.textHierarchy && data.textHierarchy.length > 0) {
    lines.push('### Typography');
    data.textHierarchy.forEach(t => {
      if(t.role === 'heading') {
        lines.push(`**Heading:** "${t.text}"`);
        if(t.fontSize) lines.push(`- Font size: \`${t.fontSize}\``);
        if(t.fontWeight) lines.push(`- Font weight: \`${t.fontWeight}\``);
        if(t.lineHeight) lines.push(`- Line height: \`${t.lineHeight}\``);
        if(t.color) lines.push(`- Color: \`${t.color}\``);
        if(t.fontFamily) lines.push(`- Font: "${t.fontFamily}"`);
      } else if(t.role === 'body') {
        lines.push(`**Body text:** "${t.text.slice(0,60)}"`);
        if(t.fontSize) lines.push(`- Font size: \`${t.fontSize}\``);
        if(t.fontWeight) lines.push(`- Font weight: \`${t.fontWeight}\``);
        if(t.color) lines.push(`- Color: \`${t.color}\``);
      }
    });
    lines.push('');
  } else if(!isContainer) {
    // Simple element — show its own text styles
    if(s.fontFamily) lines.push(`- Font: "${s.fontFamily}"`);
    if(s.fontSize) lines.push(`- Font size: \`${s.fontSize}\``);
    if(s.fontWeight&&parseInt(s.fontWeight)>=500) lines.push(`- Font weight: \`${s.fontWeight}\``);
    if(s.color) lines.push(`- Text color: \`${s.color}\``);
    if(s.lineHeight) lines.push(`- Line height: \`${s.lineHeight}\``);
    if(s.letterSpacing) lines.push(`- Letter spacing: \`${s.letterSpacing}\``);
    lines.push('');
  }

  // ── Labels (location tags, badges, etc.) ──
  if(data.labels && data.labels.length > 0) {
    lines.push(`**Labels:** ${data.labels.map(l=>`"${l}"`).join(', ')}`);
    lines.push('');
  }

  // ── Visual Content (SVG, canvas, images) ──
  if(data.visualContent && data.visualContent.length > 0) {
    lines.push('### Visual Content');
    data.visualContent.forEach(v => {
      if(v.type === 'svg' || v.type === 'lottie-svg') {
        let desc = `- ${v.type === 'lottie-svg' ? 'Lottie animation' : 'SVG illustration'}: ${v.size}`;
        if(v.subject) desc += ` — **${v.subject}**`;
        desc += `, ${v.complexity} (${v.pathCount} paths)`;
        if(v.animated) desc += ', **animated**';
        if(v.hasText) desc += ', has text labels';
        lines.push(desc);
        if(v.strokeStyle) lines.push(`  Stroke style: ${v.strokeStyle}`);
        if(v.fillColors?.length) lines.push(`  Fill colors: ${v.fillColors.map(c=>`\`${c}\``).join(', ')}`);
        if(v.strokeColors?.length) lines.push(`  Stroke colors: ${v.strokeColors.map(c=>`\`${c}\``).join(', ')}`);
        if(v.gradientColors?.length) lines.push(`  Gradient colors: ${v.gradientColors.map(c=>`\`${c}\``).join(', ')}`);
        if(v.clipPaths) lines.push(`  Uses ${v.clipPaths} clip-paths for masking/cropping effect`);
        if(v.cropping) {
          const crops = [];
          if(v.cropping.bottom) crops.push(`bottom ${v.cropping.bottom}px cropped`);
          if(v.cropping.top) crops.push(`top ${v.cropping.top}px cropped`);
          lines.push(`  Partially hidden: ${crops.join(', ')} (overflow:hidden parent) — creates fade/disappear effect`);
        }
        if(v.isLottie) {
          lines.push('  This is a Lottie vector animation. Recreate as animated SVG with CSS keyframes, or use a static stylized version capturing the key visual.');
        } else if(v.animated) {
          lines.push('  Recreate as animated SVG with CSS keyframe animations.');
        }
      } else if(v.type === 'canvas') {
        lines.push(`- Canvas element: ${v.size} — dynamic/animated content`);
        lines.push('  Recreate as CSS/SVG animation or static illustration capturing the visual essence.');
      } else if(v.type === 'video') {
        let desc = `- Video: ${v.size}`;
        if(v.autoplay && v.loop && v.muted) desc += ' — ambient background video (autoplay, loop, muted)';
        else if(v.autoplay) desc += ' — autoplay video';
        lines.push(desc);
        if(v.poster) lines.push(`  Poster: ${v.poster}`);
        lines.push('  Recreate as a CSS animation, gradient animation, or placeholder video area.');
      } else if(v.type === 'image') {
        lines.push(`- Image: ${v.size}${v.alt ? ` — "${v.alt}"` : ''}${v.src ? ` (${v.src})` : ''}`);
      }
    });
    lines.push('');
  }

  // ── Interaction & States ──
  lines.push('### Interaction & States');
  if(s.transition) {
    lines.push('Transition: '+narrateTransition(s.transition, 'state changes on this '+elType.toLowerCase()));
    const isDarkBg = hexLum(s.backgroundColor||'#888') < 0.3;
    if (elType === 'Button') {
      lines.push(`On hover, the button ${isDarkBg ? 'brightens subtly (`filter: brightness(1.1)`)' : 'darkens slightly (`filter: brightness(0.92)`)'} — a controlled response at 150ms ease-out that acknowledges the user's intention.`);
      lines.push('On active, `scale(0.98)` at 50ms — the button presses inward, creating a tactile click feel.');
      lines.push(`Focus: \`outline 2px solid ${s.backgroundColor||'currentColor'} offset 2px\` — accessibility ring matching the element's identity.`);
    } else if (elType === 'Card' || isContainer) {
      lines.push('On hover, the card lifts `translateY(-2px)` with shadow expanding 20% (200ms ease-out) — drawn toward the cursor like a card being pulled from a deck.');
    } else if (elType === 'Input') {
      lines.push(`On focus: \`border-color: ${s.borderColor||s.color||'accent'}\`, \`outline 2px solid ${s.borderColor||'currentColor'} offset 2px\` — the field reveals its interactive nature.`);
    } else {
      lines.push(`On hover: ${isDarkBg?'lightens 8%':'darkens 5%'} — a subtle acknowledgment.`);
    }
  } else {
    if (elType === 'Button') {
      lines.push(`On hover: \`brightness(${hexLum(s.backgroundColor||'#888')<0.3?'1.1':'0.92'})\` at 150ms ease-out — the button responds with a gentle ${hexLum(s.backgroundColor||'#888')<0.3?'brightening':'darkening'}.`);
      lines.push('On active: `scale(0.98)` — tactile press feedback.');
    }
    lines.push('Add smooth transitions: `150ms ease-out` for all interactive elements — invisible when correct, jarring when absent.');
  }
  lines.push('');

  // ── Animation details ──
  if(data.hasGridPattern) {
    lines.push('**Pattern:** Contains a grid/dot pattern — recreate as a CSS grid of small dots with animated highlights.');
    lines.push('');
  }
  if(data.animatedDescendants) {
    lines.push(`**Animations:** ${data.animatedDescendants} animated elements`);
    if(data.animationNames?.length) lines.push(`  Animation names: ${data.animationNames.map(n=>`\`${n}\``).join(', ')}`);
    lines.push('');
  }

  // ── Inner buttons/CTAs ──
  if(data.innerButtons?.length > 0) {
    lines.push('### Inner Buttons');
    data.innerButtons.forEach(btn => {
      let desc = `- "${btn.text}"`;
      if(btn.bg) desc += ` bg:\`${btn.bg}\``;
      if(btn.color) desc += ` color:\`${btn.color}\``;
      if(btn.borderRadius) desc += ` radius:\`${btn.borderRadius}\``;
      lines.push(desc);
    });
    lines.push('');
  }

  if(data.rect) lines.push(`**Reference size:** ${data.rect.width}×${data.rect.height}px\n`);

  // ── Children structure ──
  if(data.children?.length>0) {
    lines.push('**Structure:**');
    data.children.forEach(c => {
      let desc = `- \`<${c.tag}>\``;
      if(c.width && c.height) desc += ` ${c.width}×${c.height}`;
      if(c.bg) desc += ` bg:${c.bg}`;
      if(c.text) desc += ` — "${c.text.slice(0,30)}"`;
      lines.push(desc);
    });
    lines.push('');
  }

  if(data.hasPseudoBefore||data.hasPseudoAfter) lines.push('**Note:** Uses ::before/::after for decorative details — implement with pseudo-elements.\n');

  lines.push(getPlatformInstruction(null, site, data));
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// IMAGE FLOW
// ═══════════════════════════════════════════════════════════════════════════
async function handleImagePicked(imageData) {
  showLoading('Capturing screenshot…');
  try {
    const scr=await chrome.tabs.captureVisibleTab(null,{format:'png'});
    showLoading('Extracting color palette…');
    const analyzed=await analyzeImageFromScreenshot(scr,imageData.rect);
    state.capturedImageData={...imageData,...analyzed};
    showImagePreview(state.capturedImageData); updateAnalyzeBtn();
  } catch(err){showError('Could not capture image: '+err.message);}
}
function analyzeImageFromScreenshot(scr,rect){return new Promise((res,rej)=>{const img=new Image();img.onload=()=>{try{const dpr=window.devicePixelRatio||1,c=document.createElement('canvas');c.width=Math.min(Math.round(rect.width*dpr),300);c.height=Math.min(Math.round(rect.height*dpr),300);c.getContext('2d').drawImage(img,Math.round(rect.left*dpr),Math.round(rect.top*dpr),Math.round(rect.width*dpr),Math.round(rect.height*dpr),0,0,c.width,c.height);const id=c.getContext('2d').getImageData(0,0,c.width,c.height),cols=extractDominantColors(id,8),pal=cols.map(rgbArrayToHex);res({palette:pal,mood:inferMood(cols),contrast:analyzeContrast(cols),style:inferStyle(cols),croppedDataUrl:c.toDataURL('image/jpeg',0.85)});}catch(e){rej(e);}};img.onerror=()=>rej(new Error('Failed to load screenshot'));img.src=scr;});}
function extractDominantColors(id,count){const d=id.data,p=[];for(let i=0;i<d.length;i+=12){if(d[i+3]<128)continue;p.push([d[i],d[i+1],d[i+2]]);}return p.length?medianCut(p,Math.round(Math.log2(count))):[];}
function medianCut(p,depth){if(depth===0||!p.length){const a=avgColor(p);return a?[a]:[]}let rN=255,rX=0,gN=255,gX=0,bN=255,bX=0;for(const[r,g,b]of p){rN=Math.min(rN,r);rX=Math.max(rX,r);gN=Math.min(gN,g);gX=Math.max(gX,g);bN=Math.min(bN,b);bX=Math.max(bX,b);}const ch=[rX-rN,gX-gN,bX-bN].indexOf(Math.max(rX-rN,gX-gN,bX-bN));p.sort((a,b)=>a[ch]-b[ch]);const m=Math.floor(p.length/2);return[...medianCut(p.slice(0,m),depth-1),...medianCut(p.slice(m),depth-1)];}
function avgColor(p){if(!p.length)return null;const s=p.reduce((a,c)=>[a[0]+c[0],a[1]+c[1],a[2]+c[2]],[0,0,0]);return s.map(v=>Math.round(v/p.length));}
function rgbArrayToHex([r,g,b]){return'#'+[r,g,b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');}
function inferMood(c){if(!c.length)return'neutral';const a=avgColor(c);if(!a)return'neutral';const[r,g,b]=a,l=(0.299*r+0.587*g+0.114*b)/255,s=Math.max(r,g,b)-Math.min(r,g,b);if(l<0.15)return'dark & dramatic';if(l>0.85)return'light & airy';if(s<20)return'monochromatic';if(r>g+40&&r>b+40)return'warm';if(b>r+40&&b>g+20)return'cool';if(s>120)return'vibrant & bold';return'balanced';}
function analyzeContrast(c){if(c.length<2)return'unknown';const l=c.map(([r,g,b])=>(0.299*r+0.587*g+0.114*b)/255),ratio=Math.max(...l)/(Math.min(...l)+0.05);return ratio>7?'high contrast':ratio>3?'medium contrast':'subtle';}
function inferStyle(c){const l=c.map(([r,g,b])=>(0.299*r+0.587*g+0.114*b)/255),al=l.reduce((a,b)=>a+b,0)/l.length,s=c.map(([r,g,b])=>Math.max(r,g,b)-Math.min(r,g,b)),as=s.reduce((a,b)=>a+b,0)/s.length;if(al<0.2&&as>60)return'Dark SaaS';if(al<0.2)return'Minimal dark';if(al>0.8&&as<30)return'Clean minimal';if(al>0.8&&as>60)return'Colorful';if(as>100)return'Bold & expressive';return'Modern/balanced';}

async function buildImagePrompt(data) {
  showLoading('Generating prompt…');
  try {
    const lines=[],site=safeHostname(data.url),platform=state.platform,imgFocus=state.imgFocus,palette=data.palette||[];
    lines.push(`Inspired by: visual from ${data.pageTitle||site}`);lines.push(`Source: ${site}`);
    lines.push('');lines.push(getPlatformHeader());lines.push('');
    const darkCount=palette.filter(h=>hexLum(h)<0.15).length,isDark=darkCount>palette.length*0.35;
    const accent=palette.find(h=>hexSat(h)>80&&hexLum(h)>0.2&&hexLum(h)<0.8);

    lines.push('### Design Direction');
    const moodDesc = data.mood || 'Balanced';
    const contrastDesc = data.contrast || 'medium contrast';
    const styleDesc = data.style || 'modern';
    lines.push(`This visual establishes a **${moodDesc}** atmosphere with **${contrastDesc}** and a **${styleDesc}** aesthetic.`);
    if(isDark) lines.push('The composition is dark-dominant — depth is created through opacity layers rather than shadow. Light text floats on dark surfaces, creating a cinematic contrast that draws the eye to content. This darkness is atmospheric, not merely "dark mode."');
    else lines.push('The composition is light-dominant — open, breathable surfaces where content has room to make its statement. Depth comes through subtle shadow and border, not color contrast.');
    if(accent) lines.push(`The accent \`${accent}\` cuts through the palette with intention — reserve it for interactive elements and visual highlights where it can command attention.`);
    lines.push('');

    if(imgFocus==='full'||imgFocus==='palette'){
      lines.push('### Color Palette');
      lines.push('Colors extracted from the visual, ranked by visual weight. Each color serves a compositional role:');
      palette.slice(0,8).forEach((hex,i)=>{
        const l=hexLum(hex),s=hexSat(hex);
        let role=i===0?'dominant':i===1?'secondary':'';
        if(!role){if(l>0.85)role='background';else if(l<0.15)role='foreground';else if(s>80)role='accent';else role=`color-${i+1}`;}
        lines.push('- '+narrateColorRole(hex, role, isDark));
      });
      lines.push('');
    }

    if(imgFocus==='full'||imgFocus==='ui'){
      lines.push('### UI Implementation');
      lines.push('Translating this visual\'s palette into a functional interface:');
      const bg=isDark?palette.find(h=>hexLum(h)<0.15):palette.find(h=>hexLum(h)>0.85);
      if(bg) lines.push(`- Page background: \`${bg}\` — ${isDark?'a deep surface that recedes, letting content float':'a clean canvas that opens the space'}.`);
      lines.push(`- Text: ${isDark?'light (`#f5f5f5`) headings for high contrast, muted (`#999`) body for comfortable reading':'dark (`#111`) headings for authority, softer (`#555`) body for sustained reading'}.`);
      if(accent) lines.push(`- CTAs: \`${accent}\` background with white text — the accent color earns its moment at decision points.`);
      lines.push(isDark
        ?'- Elevation: colored glow or layered dark shadow — on dark surfaces, shadows are felt more than seen. A subtle glow creates depth without hard edges.'
        :'- Elevation: `0 4px 24px rgba(0,0,0,0.08)` — soft, diffused shadow that suggests floating without casting harsh edges.');
      lines.push('');
    }

    lines.push(getPlatformInstruction(null, site, data));
    const prompt=lines.join('\n'); state.lastPrompt=prompt;
    await savePrompt(data.url||state.currentUrl, prompt, 'image', platform);
    showResult(prompt,{url:data.url},'image',null);
    flashSaveIndicator();
  } catch(err){showError('Could not generate prompt: '+err.message);}
}

function showImagePreview(data) {
  if(data.croppedDataUrl) $('imagePreview').src=data.croppedDataUrl; else if(data.src) $('imagePreview').src=data.src;
  const sw=$('colorSwatches'); sw.innerHTML='';
  (data.palette||[]).slice(0,10).forEach(hex=>{
    const el=document.createElement('div'); el.className='swatch'; el.style.background=hex;
    const label=document.createElement('span'); label.className='swatch-hex'; label.textContent=hex;
    el.appendChild(label);
    el.addEventListener('click',()=>{navigator.clipboard.writeText(hex);el.style.outline='2px solid #34d399';setTimeout(()=>el.style.outline='',1000);});
    sw.appendChild(el);
  });
  $('imagePreviewSection').style.display='flex';
}

// ═══════════════════════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function getPlatformHeader(){return '## Design Prompt';}
function getPlatformInstruction(p, site, data) {
  const SYSTEM_FONTS_FOR_IMPORT = new Set(['ui-sans-serif','ui-serif','ui-monospace','system-ui',
    '-apple-system','blinkmacsystemfont','helvetica neue','arial','sans-serif','serif','monospace']);
  const fonts = (data?.fonts || []).filter(f => f && !SYSTEM_FONTS_FOR_IMPORT.has(f.toLowerCase()));

  const GOOGLE_FONTS = new Set([
    'inter','roboto','open sans','lato','montserrat','poppins','raleway','nunito','ubuntu',
    'playfair display','merriweather','source sans pro','source code pro','fira code','fira sans',
    'dm sans','dm mono','dm serif display','dm serif text','space grotesk','space mono','jetbrains mono',
    'ibm plex mono','ibm plex sans','ibm plex serif','work sans','manrope','outfit',
    'plus jakarta sans','geist','geist mono','albert sans','bricolage grotesque',
    'anton','bebas neue','oswald','barlow','barlow condensed','archivo','lexend',
    'sora','satoshi','cabinet grotesk','general sans','clash display','clash grotesk',
    'pt serif','pt sans','pt mono','noto sans','noto serif','crimson text','crimson pro',
    'libre baskerville','cormorant','cormorant garamond','eb garamond','spectral',
    'bitter','lora','cardo','libre franklin','karla','rubik','quicksand','comfortaa',
    'josefin sans','josefin slab','exo 2','titillium web','cabin','arimo','dosis',
    'inconsolata','roboto mono','roboto slab','roboto condensed','nanum gothic',
    'red hat display','red hat text','red hat mono','instrument sans','instrument serif',
  ]);

  const googleFonts = [];
  const customFonts = [];
  for (const f of fonts) {
    if (GOOGLE_FONTS.has(f.toLowerCase())) googleFonts.push(f);
    else customFonts.push(f);
  }

  const weightStr = (data?.fontWeights || ['400','500','600','700','800']).join(';');
  const fontImport = googleFonts.length > 0
    ? `\nAdd to global CSS:\n@import url('https://fonts.googleapis.com/css2?${googleFonts.map(f => `family=${encodeURIComponent(f)}:wght@${weightStr}`).join('&')}&display=swap');`
    : '';
  const customFontNote = customFonts.length > 0
    ? `\nNOTE: "${customFonts.join('", "')}" ${customFonts.length === 1 ? 'is a' : 'are'} custom font${customFonts.length > 1 ? 's' : ''} not available on Google Fonts. Use the closest Google Fonts alternative (e.g. Inter, DM Sans, Space Grotesk for sans-serif; JetBrains Mono, Fira Code for monospace; Playfair Display for serif display) and match the weight/tracking values.`
    : '';

  return `Recreate this visual style faithfully. Use the EXACT hex colors, px values, font names, and spacing from the tokens and specifications above.
Source: ${site}

CRITICAL — Do NOT use framework defaults:
- Do NOT use default Tailwind colors (slate, zinc, neutral) — use the extracted color tokens above.
- Do NOT use default shadcn/ui theme (--radius, --primary, --background) — override every variable with the extracted values.
- Do NOT use default border-radius, padding, or font-size from any component library — use the exact px values specified.
- Do NOT use default transition timings — use the exact easing functions and durations from Motion Tokens.
- Every color, every spacing value, every font weight, every border-radius, every shadow, every transition — must come from this prompt, not from framework defaults.
- If a value is not specified in this prompt, only then may you use a sensible default.${fontImport}${customFontNote}`;
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

  $('outputTabs').style.display = source === 'page' ? 'flex' : 'none';
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
}
function copyPrompt(){if(!state.lastPrompt)return;copyToClipboard(state.lastPrompt);$('copyBtn').classList.add('copied');$('copyIcon').textContent='✓';setTimeout(()=>{$('copyBtn').classList.remove('copied');$('copyIcon').textContent='⎘';},2000);}
function copyToClipboard(text){navigator.clipboard.writeText(text).catch(()=>{const el=document.createElement('textarea');el.value=text;document.body.appendChild(el);el.select();document.execCommand('copy');document.body.removeChild(el);});}

init();

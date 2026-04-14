// VibeDesign — Popup UI (popup-specific overrides)
// Shared code lives in lib/ui-helpers.js

// ── Popup-specific: picker mode support ───────────────────────────────────
function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  const focusRow = $('focusRow');
  if (focusRow) focusRow.style.display = mode === 'image' ? 'none' : 'flex';
  updateAnalyzeBtn();
  resetView();
}

function setImgFocus(f) {
  state.imgFocus = f;
  document.querySelectorAll('[data-imgfocus]').forEach(c => c.classList.toggle('active', c.dataset.imgfocus === f));
}

// Override shared updateAnalyzeBtn — popup adds picker hint overlays
const _sharedUpdateAnalyzeBtn = updateAnalyzeBtn;
function updateAnalyzeBtn() {
  _sharedUpdateAnalyzeBtn();
  // Popup-specific: show/hide picker instruction hints
  const ph = $('pickerHint'); if (ph) ph.style.display = (state.mode === 'element' && state.pickerActive) ? 'block' : 'none';
  const iph = $('imagePickerHint'); if (iph) iph.style.display = (state.mode === 'image' && state.imagePickerActive) ? 'block' : 'none';
}

function showPickerLaunchScreen(mode) {
  $('loadingSection').style.display = 'none';
  $('resultSection').style.display = 'none';
  $('errorSection').style.display = 'none';

  const isImage = mode === 'image';
  const icon = isImage ? '⬚' : '⊡';
  const label = isImage ? 'Pick an image' : 'Pick an element';
  const sub = isImage
    ? 'Hover over an image and click.<br>Then click the extension icon again.'
    : 'Hover over any element and click.<br>Then click the extension icon again.';

  const ls = $('loadingSection');
  ls.style.display = 'flex';

  // Build picker launch screen using DOM API
  ls.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'picker-launch-screen';

  const iconEl = document.createElement('span');
  iconEl.className = 'picker-launch-icon';
  iconEl.textContent = icon;
  wrapper.appendChild(iconEl);

  const labelEl = document.createElement('span');
  labelEl.className = 'picker-launch-label';
  labelEl.textContent = label;
  wrapper.appendChild(labelEl);

  const subEl = document.createElement('span');
  subEl.className = 'picker-launch-sub';
  subEl.innerHTML = sub; // contains <br>, safe (hardcoded)
  wrapper.appendChild(subEl);

  const escEl = document.createElement('span');
  escEl.className = 'picker-launch-esc';
  escEl.textContent = 'ESC to cancel';
  wrapper.appendChild(escEl);

  ls.appendChild(wrapper);
}

// ── Init ──────────────────────────────────────────────────────────────────
initUI();

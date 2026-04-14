// VibeDesign — Popup UI (popup-specific overrides)
// Shared code lives in lib/ui-helpers.js

// Override shared updateAnalyzeBtn — popup adds picker hint overlay
const _sharedUpdateAnalyzeBtn = updateAnalyzeBtn;
function updateAnalyzeBtn() {
  _sharedUpdateAnalyzeBtn();
  const ph = $('pickerHint'); if (ph) ph.style.display = (state.mode === 'element' && state.pickerActive) ? 'block' : 'none';
}

function showPickerLaunchScreen() {
  $('loadingSection').style.display = 'none';
  $('resultSection').style.display = 'none';
  $('errorSection').style.display = 'none';

  const ls = $('loadingSection');
  ls.style.display = 'flex';
  ls.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'picker-launch-screen';

  const iconEl = document.createElement('span');
  iconEl.className = 'picker-launch-icon';
  iconEl.textContent = '⊡';
  wrapper.appendChild(iconEl);

  const labelEl = document.createElement('span');
  labelEl.className = 'picker-launch-label';
  labelEl.textContent = 'Pick an element';
  wrapper.appendChild(labelEl);

  const subEl = document.createElement('span');
  subEl.className = 'picker-launch-sub';
  subEl.innerHTML = 'Hover over any element and click.<br>Then click the extension icon again.';
  wrapper.appendChild(subEl);

  const escEl = document.createElement('span');
  escEl.className = 'picker-launch-esc';
  escEl.textContent = 'ESC to cancel';
  wrapper.appendChild(escEl);

  ls.appendChild(wrapper);
}

// ── Init ──────────────────────────────────────────────────────────────────
initUI();

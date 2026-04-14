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

// Override shared no-op — popup needs picker UI in the analyze button
function updateAnalyzeBtn() {
  const btn = $('analyzeBtn'), icon = $('analyzeBtnIcon'), text = $('analyzeBtnText');
  btn.classList.remove('picker-active');
  const ph = $('pickerHint'); if (ph) ph.style.display = 'none';
  const iph = $('imagePickerHint'); if (iph) iph.style.display = 'none';
  if (state.mode === 'page') {
    icon.textContent = '◫'; text.textContent = 'Analyze Page';
  } else if (state.mode === 'element') {
    if (state.pickerActive) {
      icon.textContent = '✕'; text.textContent = 'Cancel';
      btn.classList.add('picker-active');
      if (ph) ph.style.display = 'block';
    } else {
      icon.textContent = '⊡'; text.textContent = 'Pick Element';
    }
  } else {
    if (state.capturedImageData) {
      icon.textContent = '⬚'; text.textContent = 'Analyze Image';
    } else if (state.imagePickerActive) {
      icon.textContent = '✕'; text.textContent = 'Cancel';
      btn.classList.add('picker-active');
      if (iph) iph.style.display = 'block';
    } else {
      icon.textContent = '⬚'; text.textContent = 'Pick Image';
    }
  }
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

// lib/picker.js
// Element and image picker UI — injected on demand when picker mode is activated
// Depends on: content.js (window.__vibeDesign.extractElementData, extractImageData)

(function () {
  if (window.__vibeDesignPickerInjected) return;
  window.__vibeDesignPickerInjected = true;

  const vd = window.__vibeDesign || {};

  let pickerActive = false;
  let imagePickerActive = false;
  let highlightEl = null;
  let tooltip = null;

  // ─── Overlay rendering ──────────────────────────────────────────────────────
  function createHighlight(color) {
    const h = document.createElement('div');
    h.id = '__dp_highlight';
    const isGreen = color === 'green';
    h.style.cssText = `position:fixed;pointer-events:none;z-index:2147483647;
      border:2px solid ${isGreen ? '#34d399' : '#6366f1'};
      background:${isGreen ? 'rgba(52,211,153,0.08)' : 'rgba(99,102,241,0.08)'};
      border-radius:4px;transition:top .08s,left .08s,width .08s,height .08s;display:none;`;
    document.body.appendChild(h);
    return h;
  }

  function createTooltip(color) {
    const t = document.createElement('div');
    t.id = '__dp_tooltip';
    t.style.cssText = `position:fixed;pointer-events:none;z-index:2147483647;
      background:#18181b;color:${color === 'green' ? '#34d399' : '#a5b4fc'};
      font-size:11px;font-family:monospace;padding:4px 8px;
      border-radius:4px;border:1px solid #3f3f46;display:none;white-space:nowrap;`;
    document.body.appendChild(t);
    return t;
  }

  function positionHighlight(target) {
    if (!highlightEl) return;
    const rect = target.getBoundingClientRect();
    highlightEl.style.display = 'block';
    highlightEl.style.top = rect.top + 'px';
    highlightEl.style.left = rect.left + 'px';
    highlightEl.style.width = rect.width + 'px';
    highlightEl.style.height = rect.height + 'px';
    if (tooltip) {
      tooltip.style.display = 'block';
      tooltip.style.top = Math.max(0, rect.top - 26) + 'px';
      tooltip.style.left = rect.left + 'px';
    }
  }

  function removeOverlay() {
    ['__dp_highlight','__dp_tooltip'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    highlightEl = null; tooltip = null;
  }

  // ─── Selection confirmation animation ─────────────────────────────────────
  function showSelectionConfirmation(target) {
    if (highlightEl) {
      const rect = target.getBoundingClientRect();
      highlightEl.style.display = 'block';
      highlightEl.style.top = rect.top + 'px';
      highlightEl.style.left = rect.left + 'px';
      highlightEl.style.width = rect.width + 'px';
      highlightEl.style.height = rect.height + 'px';
      highlightEl.style.borderColor = '#34d399';
      highlightEl.style.background = 'rgba(52,211,153,0.12)';
      highlightEl.style.transition = 'opacity 0.4s ease';
    }
    if (tooltip) {
      tooltip.style.display = 'block';
      tooltip.style.color = '#34d399';
      tooltip.textContent = '✓ Selected — generating prompt...';
    }
    setTimeout(() => {
      if (highlightEl) highlightEl.style.opacity = '0';
      if (tooltip) tooltip.style.opacity = '0';
      setTimeout(() => removeOverlay(), 500);
    }, 1200);
  }

  // ─── Element picker ───────────────────────────────────────────────────────
  function activatePicker() {
    pickerActive = true;
    highlightEl = createHighlight('purple');
    tooltip = createTooltip('purple');
    document.addEventListener('mousemove', onElemMove, true);
    document.addEventListener('click', onElemClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.body.style.cursor = 'crosshair';
  }

  function deactivatePicker() {
    pickerActive = false; removeOverlay();
    document.removeEventListener('mousemove', onElemMove, true);
    document.removeEventListener('click', onElemClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.body.style.cursor = '';
  }

  function onElemMove(e) {
    if (!pickerActive || e.target.id?.startsWith('__dp_')) return;
    positionHighlight(e.target);
    if (tooltip) {
      const t = e.target.tagName.toLowerCase();
      const c = e.target.className?.toString().split(' ')[0] || '';
      const r = e.target.getBoundingClientRect();
      const text = (e.target.innerText || '').trim().slice(0, 20);
      tooltip.textContent = `<${t}${c ? '.'+c : ''}> ${Math.round(r.width)}×${Math.round(r.height)}${text ? ' — "'+text+'"' : ''}`;
    }
  }

  function onElemClick(e) {
    if (!pickerActive || e.target.id?.startsWith('__dp_')) return;
    e.preventDefault(); e.stopPropagation();
    const data = vd.extractElementData(e.target);
    pickerActive = false;
    document.removeEventListener('mousemove', onElemMove, true);
    document.removeEventListener('click', onElemClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.body.style.cursor = '';
    showSelectionConfirmation(e.target);
    chrome.storage.local.set({
      dp_pending: { type: 'ELEMENT_PICKED', data, timestamp: Date.now() }
    });
  }

  // ─── Image picker ─────────────────────────────────────────────────────────
  function activateImagePicker() {
    imagePickerActive = true;
    highlightEl = createHighlight('green');
    tooltip = createTooltip('green');
    document.addEventListener('mousemove', onImgMove, true);
    document.addEventListener('click', onImgClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.body.style.cursor = 'crosshair';
  }

  function deactivateImagePicker() {
    imagePickerActive = false; removeOverlay();
    document.removeEventListener('mousemove', onImgMove, true);
    document.removeEventListener('click', onImgClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.body.style.cursor = '';
  }

  function findImageTarget(el) {
    let t = el;
    while (t && t !== document.body) {
      if (t.tagName === 'IMG') return t;
      const bg = window.getComputedStyle(t).backgroundImage;
      if (bg && bg !== 'none' && bg.startsWith('url')) return t;
      const img = t.querySelector('img');
      if (img) return img;
      t = t.parentElement;
    }
    return el;
  }

  function onImgMove(e) {
    if (!imagePickerActive || e.target.id?.startsWith('__dp_')) return;
    const target = findImageTarget(e.target);
    positionHighlight(target);
    if (tooltip) {
      if (target.tagName === 'IMG') {
        const src = (target.src || target.currentSrc || '');
        const filename = src.split('/').pop()?.split('?')[0]?.slice(0, 30) || '';
        const r = target.getBoundingClientRect();
        tooltip.textContent = `<img> ${Math.round(r.width)}×${Math.round(r.height)}${filename ? ' — '+filename : ''}`;
      } else {
        const r = target.getBoundingClientRect();
        tooltip.textContent = `<${target.tagName.toLowerCase()}> ${Math.round(r.width)}×${Math.round(r.height)} — click to capture`;
      }
    }
  }

  function onImgClick(e) {
    if (!imagePickerActive || e.target.id?.startsWith('__dp_')) return;
    e.preventDefault(); e.stopPropagation();
    const target = findImageTarget(e.target);
    const data = vd.extractImageData(target);
    imagePickerActive = false;
    document.removeEventListener('mousemove', onImgMove, true);
    document.removeEventListener('click', onImgClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.body.style.cursor = '';
    showSelectionConfirmation(target);
    chrome.storage.local.set({
      dp_pending: { type: 'IMAGE_PICKED', data, timestamp: Date.now() }
    });
  }

  // ─── ESC handler ──────────────────────────────────────────────────────────
  function onKeyDown(e) {
    if (e.key !== 'Escape') return;
    if (pickerActive) deactivatePicker();
    if (imagePickerActive) deactivateImagePicker();
  }

  // ─── Message listener — picker commands only ──────────────────────────────
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'ACTIVATE_PICKER') { if (!pickerActive) activatePicker(); sendResponse({ success: true }); }
    if (msg.type === 'DEACTIVATE_PICKER') { deactivatePicker(); sendResponse({ success: true }); }
    if (msg.type === 'ACTIVATE_IMAGE_PICKER') { if (!imagePickerActive) activateImagePicker(); sendResponse({ success: true }); }
    if (msg.type === 'DEACTIVATE_IMAGE_PICKER') { deactivateImagePicker(); sendResponse({ success: true }); }
    return true;
  });
})();

// lib/shadow-utils.js
// Shared box-shadow string helpers — single source of truth for layer splitting
// and real-layer filtering. Previously duplicated inside content.js (closure) and
// inlined in prompt-builder.js; one bug would drift out of sync between the two.

(function () {
  if (window.__vibeDesignShadowUtils) return;
  window.__vibeDesignShadowUtils = true;

  // Split a box-shadow string at layer boundaries (commas at paren depth 0).
  // Handles rgba(r,g,b,a) commas correctly — the naive split(',') breaks those.
  function splitShadowLayers(shadow) {
    const layers = [];
    let depth = 0, current = '';
    for (let i = 0; i < shadow.length; i++) {
      const ch = shadow[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ',' && depth === 0) {
        const trimmed = current.trim();
        if (trimmed) layers.push(trimmed);
        current = '';
        continue;
      }
      current += ch;
    }
    const last = current.trim();
    if (last) layers.push(last);
    return layers;
  }

  // True if a layer produces visible output. Filters Tailwind ring zero-fillers
  // (rgba(0,0,0,0)) and any no-alpha rgba, while keeping oklab/oklch/hsl/color,
  // inset layers, and rgba with non-trivial alpha.
  function isRealShadowLayer(layer) {
    const t = layer.trim();
    if (!t) return false;
    if (/^rgba?\(\s*0[\s,]+0[\s,]+0[\s,]+0[\s,)]*\)/.test(t)) return false;
    if (t.includes('oklab(')) return true;
    if (/rgba\(\s*\d+[\s,]+\d+[\s,]+\d+[\s,]+(?:0\.[1-9]|[1-9])/.test(t)) return true;
    if (t.includes('inset') && /rgb\(/.test(t)) return true;
    if (/^(hsl|oklch|color)\(/.test(t)) return true;
    return false;
  }

  // Expose on shared namespace (content.js in page world)
  window.__vibeDesign = window.__vibeDesign || {};
  window.__vibeDesign.splitShadowLayers = splitShadowLayers;
  window.__vibeDesign.isRealShadowLayer = isRealShadowLayer;
  // Plain globals (sidepanel/popup scripts)
  window.splitShadowLayers = splitShadowLayers;
  window.isRealShadowLayer = isRealShadowLayer;
})();

// lib/token-exporter.js
// W3C Design Token Community Group format export
// DO NOT use Chrome APIs here — this file must be Chrome-API-free

function exportW3CTokens(data) {
  if (!data) return null;

  const tokens = {};
  const sc = extractSemanticColors(data.cssVars || {});

  // ── Colors — semantic roles, no duplicates ──
  const color = {};
  const usedHexes = new Set();
  const _addColor = (name, hex) => {
    if (!hex || typeof hex !== 'string' || hex.length < 4) return;
    const normalized = hex.trim().toLowerCase();
    if (usedHexes.has(normalized)) {
      // Emit alias reference instead of duplicate value
      const existing = Object.entries(color).find(([, v]) => v.$value?.toLowerCase() === normalized);
      if (existing) color[name] = { $value: `{color.${existing[0]}}`, $type: 'color', $description: 'alias' };
      return;
    }
    usedHexes.add(normalized);
    color[name] = { $value: hex.trim(), $type: 'color' };
  };

  // Page background
  if (data.pageBackground) _addColor('background', data.pageBackground);

  // Foreground (text) — from body typography or contrast-derived
  const bodyColor = data.typographyPatterns?.body?.color;
  const isDark = data.pageBackground && hexLum(data.pageBackground) < 0.35;
  const fgHex = (bodyColor && bodyColor !== '#000000') ? bodyColor : (isDark ? '#ffffff' : '#000000');
  _addColor('text-primary', fgHex);

  // Primary action — button bg first, then CSS var
  const btnBg = data.buttonStyles?.primary?.backgroundColor;
  const primaryHex = (btnBg && /^#[0-9a-f]{6}$/i.test(btnBg.trim())) ? btnBg
    : sc.primary || (data.accentColors || [])[0] || null;
  if (primaryHex) _addColor('primary-action', primaryHex);

  // Secondary / accent from semantic extraction
  if (sc.secondary) _addColor('secondary', sc.secondary);

  // Named accents from CSS vars (unique only)
  sc.accent.forEach(a => {
    const cleanKey = a.key.replace(/^--/, '').replace(/[-_]+/g, '-');
    _addColor(cleanKey, a.value);
  });

  // Surface / mid-tone (text-secondary)
  const allColors = [...(data.colors || []), ...(data.accentColors || [])];
  const textSecondary = allColors.find(c => {
    const lum = hexLum(c);
    return isDark ? (lum > 0.25 && lum < 0.6 && hexSat(c) < 12) : (lum > 0.3 && lum < 0.6 && hexSat(c) < 12);
  });
  if (textSecondary) _addColor('text-secondary', textSecondary);

  // Border
  const borderVal = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  color['border'] = { $value: borderVal, $type: 'color' };

  // Semantic states
  color['state-success'] = { $value: '#22c55e', $type: 'color' };
  color['state-error'] = { $value: '#ef4444', $type: 'color' };
  color['state-warning'] = { $value: '#f59e0b', $type: 'color' };

  if (Object.keys(color).length > 0) tokens.color = color;

  // ── Typography — semantic roles ──
  const typography = {};
  const tp = data.typographyPatterns || {};
  const _addTypo = (name, d) => {
    if (!d) return;
    const entry = {};
    if (d.fontFamily) entry.fontFamily = { $value: d.fontFamily, $type: 'fontFamily' };
    if (d.fontSize) entry.fontSize = { $value: d.fontSize, $type: 'dimension' };
    if (d.fontWeight) entry.fontWeight = { $value: parseInt(d.fontWeight) || d.fontWeight, $type: 'fontWeight' };
    if (d.lineHeight) entry.lineHeight = { $value: d.lineHeight, $type: 'dimension' };
    if (d.letterSpacing && d.letterSpacing !== 'normal') entry.letterSpacing = { $value: d.letterSpacing, $type: 'dimension' };
    if (Object.keys(entry).length > 0) typography[name] = entry;
  };
  _addTypo('heading-1', tp.h1);
  _addTypo('heading-2', tp.h2);
  _addTypo('heading-3', tp.h3);
  _addTypo('body', tp.body);
  _addTypo('label', tp.label);
  _addTypo('caption', tp.caption);
  _addTypo('code', tp.code);
  if (Object.keys(typography).length > 0) tokens.typography = typography;

  // ── Spacing ──
  const spacing = {};
  const sp = data.visualProfile?.spacingSystem || {};
  if (sp.sectionPaddingY) spacing['section-padding'] = { $value: sp.sectionPaddingY, $type: 'dimension' };
  if (sp.containerMaxWidth && sp.containerMaxWidth !== 'none') spacing['container-max-width'] = { $value: sp.containerMaxWidth, $type: 'dimension' };
  if (sp.gridGap) spacing['grid-gap'] = { $value: sp.gridGap, $type: 'dimension' };
  if (Object.keys(spacing).length > 0) tokens.spacing = spacing;

  // ── Border radius — semantic names ──
  const borderRadius = {};
  const radii = data.borderRadii || [];
  radii.forEach(r => {
    const px = parseInt(r);
    if (r.includes('9999') || px > 100) { if (!borderRadius['pill']) borderRadius['pill'] = { $value: r, $type: 'dimension' }; }
    else if (r === '50%') { if (!borderRadius['circle']) borderRadius['circle'] = { $value: r, $type: 'dimension' }; }
    else if (px <= 2) { if (!borderRadius['sharp']) borderRadius['sharp'] = { $value: r, $type: 'dimension' }; }
    else if (px <= 8) { if (!borderRadius['small']) borderRadius['small'] = { $value: r, $type: 'dimension' }; }
    else if (px <= 16) { if (!borderRadius['medium']) borderRadius['medium'] = { $value: r, $type: 'dimension' }; }
    else { if (!borderRadius['large']) borderRadius['large'] = { $value: r, $type: 'dimension' }; }
  });
  if (Object.keys(borderRadius).length > 0) tokens.borderRadius = borderRadius;

  // ── Shadows — W3C composite object format ──
  const shadow = {};
  (data.shadows || []).slice(0, 4).forEach((s, i) => {
    // Parse shadow string into W3C composite structure
    const parsed = _parseShadow(s);
    if (parsed) {
      const label = s.includes('inset') ? `inset-${i + 1}` : `elevation-${i + 1}`;
      shadow[label] = parsed;
    }
  });
  if (Object.keys(shadow).length > 0) tokens.shadow = shadow;

  // ── Motion — duration + easing as separate tokens ──
  const motion = {};
  // Extract durations and easings from transitions
  const transitions = data.transitions || [];
  const seenDurations = new Set();
  const seenEasings = new Set();
  transitions.slice(0, 5).forEach(t => {
    const durMatch = t.match(/([\d.]+)s/);
    if (durMatch) {
      const ms = Math.round(parseFloat(durMatch[1]) * 1000);
      if (!seenDurations.has(ms)) {
        seenDurations.add(ms);
        const label = ms < 200 ? 'fast' : ms <= 350 ? 'normal' : ms <= 500 ? 'slow' : 'dramatic';
        if (!motion[`duration-${label}`]) {
          motion[`duration-${label}`] = { $value: `${ms}ms`, $type: 'duration' };
        }
      }
    }
    const easingMatch = t.match(/cubic-bezier\(([^)]+)\)/);
    if (easingMatch && !seenEasings.has(easingMatch[1])) {
      seenEasings.add(easingMatch[1]);
      const vals = easingMatch[1].split(',').map(Number);
      if (vals.length === 4) {
        motion[`easing-${seenEasings.size}`] = { $value: vals, $type: 'cubicBezier' };
      }
    }
  });
  // Named easings
  if (transitions.some(t => t.includes('ease-in-out'))) motion['easing-ease-in-out'] = { $value: [0.42, 0, 0.58, 1], $type: 'cubicBezier' };
  if (transitions.some(t => /\bease\b/.test(t) && !t.includes('ease-in') && !t.includes('ease-out'))) {
    motion['easing-ease'] = { $value: [0.25, 0.1, 0.25, 1], $type: 'cubicBezier' };
  }

  // Keyframe animations as custom extension (not in W3C spec, marked clearly)
  const anims = data.animations || [];
  if (anims.length > 0) {
    const keyframes = {};
    anims.slice(0, 8).forEach(a => {
      if (typeof a === 'object' && a.name) {
        keyframes[a.name] = {
          $value: { from: a.from || null, to: a.to || null },
          $type: 'custom-keyframe',
          $description: 'Non-standard: CSS @keyframes definition'
        };
      }
    });
    if (Object.keys(keyframes).length > 0) motion.keyframes = keyframes;
  }

  if (Object.keys(motion).length > 0) tokens.motion = motion;

  // ── Dark mode tokens ──
  if (data.darkModeTokens) {
    const dark = {};
    Object.entries(data.darkModeTokens).forEach(([prop, val]) => {
      const key = prop.startsWith('--') ? prop.slice(2).replace(/[-_]+/g, '-') : prop;
      dark[key] = { $value: val, $type: 'color' };
    });
    if (Object.keys(dark).length > 0) tokens.darkMode = dark;
  }

  return tokens;
}

// Convert any CSS color (oklch, lab, lch, color() etc.) to hex via canvas
let _tokenCanvas, _tokenCtx;
function _cssColorToHex(cssColor) {
  if (!cssColor) return null;
  // Already hex
  if (/^#[0-9a-f]{3,8}$/i.test(cssColor.trim())) return cssColor.trim();
  // rgb/rgba — direct conversion
  const rgbMatch = cssColor.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return '#' + [r, g, b].map(c => parseInt(c).toString(16).padStart(2, '0')).join('');
  }
  // oklch, lab, lch, color() — canvas conversion (same pattern as content.js cssColorToRgb)
  try {
    if (!_tokenCanvas) { _tokenCanvas = document.createElement('canvas'); _tokenCanvas.width = 1; _tokenCanvas.height = 1; _tokenCtx = _tokenCanvas.getContext('2d', { willReadFrequently: true }); }
    _tokenCtx.clearRect(0, 0, 1, 1);
    _tokenCtx.fillStyle = '#000000';
    _tokenCtx.fillStyle = cssColor;
    _tokenCtx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = _tokenCtx.getImageData(0, 0, 1, 1).data;
    if (a < 10) return null;
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
  } catch(e) { return null; }
}

// Parse a CSS box-shadow string into W3C composite shadow object
function _parseShadow(s) {
  if (!s || s === 'none') return null;
  const isInset = s.includes('inset');
  const cleaned = s.replace('inset', '').trim();
  // Match color — oklch, rgba, hex
  const colorMatch = cleaned.match(/(#[0-9a-f]{3,8}|rgba?\([^)]+\)|oklch\([^)]+\))/i);
  let color = colorMatch ? colorMatch[0] : 'rgba(0,0,0,0.1)';
  // Convert non-hex colors (oklch, etc.) to hex for W3C tool compatibility
  if (color && !/^#[0-9a-f]{3,8}$/i.test(color)) {
    const hex = _cssColorToHex(color);
    if (hex) color = hex;
  }
  // Match px values
  const pxValues = cleaned.match(/([-\d.]+)px/g);
  if (pxValues && pxValues.length >= 2) {
    const nums = pxValues.map(v => parseFloat(v));
    return {
      $type: 'shadow',
      $value: {
        color: color,
        offsetX: (nums[0] || 0) + 'px',
        offsetY: (nums[1] || 0) + 'px',
        blur: (nums[2] || 0) + 'px',
        spread: (nums[3] || 0) + 'px',
        inset: isInset,
      }
    };
  }
  // Fallback: raw string with type annotation
  return { $value: s, $type: 'shadow', $description: 'Complex shadow — parse manually' };
}

function downloadTokensJSON(data) {
  const tokens = exportW3CTokens(data);
  if (!tokens) return;
  const json = JSON.stringify(tokens, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `design-tokens-${safeHostname(data.url || '')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

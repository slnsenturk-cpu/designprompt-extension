// lib/color-utils.js
// Shared color utilities and semantic extraction — Chrome-API-free
// Load order: this file MUST load before prompt-builder.js, token-exporter.js, and ui-helpers.js

// ═══════════════════════════════════════════════════════════════════════════
// PURE COLOR UTILITIES
// ═══════════════════════════════════════════════════════════════════════════
// Normalize any CSS hex form to 6-char #RRGGBB, dropping alpha if present.
// Handles #RGB, #RGBA, #RRGGBB, #RRGGBBAA. Returns null for invalid input so
// downstream callers can fall back to safe defaults instead of producing NaN
// from short-form slicing (the pre-existing silent-failure mode for #RGBA/#RRGGBBAA).
function _toHex6(input) {
  if (!input || typeof input !== 'string') return null;
  const h = input.trim().toLowerCase();
  if (!/^#[0-9a-f]{3,8}$/.test(h)) return null;
  if (h.length === 4) return '#' + h[1]+h[1]+h[2]+h[2]+h[3]+h[3];
  if (h.length === 5) return '#' + h[1]+h[1]+h[2]+h[2]+h[3]+h[3]; // drop alpha nibble
  if (h.length === 7) return h;
  if (h.length === 9) return h.slice(0, 7); // drop 8-bit alpha
  return null; // lengths 6 and 8 are invalid CSS hex
}
function hexLum(hex) { const h=_toHex6(hex); if(!h) return 0.5; const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); return(0.299*r+0.587*g+0.114*b)/255; }
function hexSat(hex) { const h=_toHex6(hex); if(!h) return 0; const r=parseInt(h.slice(1,3),16)/255,g=parseInt(h.slice(3,5),16)/255,b=parseInt(h.slice(5,7),16)/255; const mx=Math.max(r,g,b),mn=Math.min(r,g,b); if(mx===mn)return 0; const l=(mx+mn)/2; return Math.round((l<=0.5?(mx-mn)/(mx+mn):(mx-mn)/(2-mx-mn))*100); }
function safeHostname(url) { try{return new URL(url).hostname;}catch{return 'unknown';} }

// ═══════════════════════════════════════════════════════════════════════════
// TONAL SCALE GENERATION
// ═══════════════════════════════════════════════════════════════════════════
function generateTonalScale(hex) {
  if (!hex || hex.length < 7) return null;
  const { h, s } = _hexHSL(hex);
  const _hsl = (sat, lit) => {
    sat = Math.max(0, Math.min(100, Math.round(sat)));
    lit = Math.max(0, Math.min(100, Math.round(lit)));
    // Convert HSL to hex
    const s2 = sat / 100, l2 = lit / 100;
    const c = (1 - Math.abs(2 * l2 - 1)) * s2;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l2 - c / 2;
    let r, g, b;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return '#' + [r + m, g + m, b + m].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  };
  return {
    50:  _hsl(s * 0.4, 97),
    100: _hsl(s * 0.5, 93),
    200: _hsl(s * 0.6, 86),
    300: _hsl(s * 0.8, 76),
    400: _hsl(s, 64),
    500: hex,
    600: _hsl(Math.min(s * 1.1, 100), 44),
    700: _hsl(Math.min(s * 1.1, 100), 36),
    800: _hsl(Math.min(s * 1.0, 100), 28),
    900: _hsl(Math.min(s * 0.9, 100), 20),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SEMANTIC COLOR EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════
function extractSemanticColors(vars) {
  const result = { primary:null, secondary:null, accent:[], bg:null, fg:null };
  // Expand short hex (#RGB → #RRGGBB, #RGBA → #RRGGBBAA) before alpha checks —
  // otherwise #F00C (80% red alpha) was slipping past the threshold gate because
  // the alpha-check branch only ran for length === 9.
  const _expandHex = h => {
    if (h.length === 4) return '#' + h[1]+h[1]+h[2]+h[2]+h[3]+h[3];
    if (h.length === 5) return '#' + h[1]+h[1]+h[2]+h[2]+h[3]+h[3]+h[4]+h[4];
    return h;
  };
  for (const [k, v] of Object.entries(vars)) {
    const raw = v.trim();
    if (!/^#[0-9a-f]{3,8}$/i.test(raw)) continue;
    const expanded = _expandHex(raw);
    // Reject semi-transparent (alpha < 0xCC ~80%) for role assignment — now covers
    // both 8-char (#RRGGBBAA) and 5-char short (#RGBA) forms uniformly.
    if (expanded.length === 9 && parseInt(expanded.slice(7), 16) < 0xCC) continue;
    // Normalize to 6-char for downstream consumers (strip full/near-full alpha)
    const hex = expanded.length === 9 ? expanded.slice(0, 7) : expanded;
    const key = k.toLowerCase();
    // Primary: key must contain 'primary' or 'brand' or 'cta' as a segment
    if (!result.primary && /(?:^|[-_])(primary|brand|cta)(?:$|[-_])/.test(key)) {
      // Gate 'brand' matches on saturation — avoids gray brand-scale vars like --color-brand--gray-12
      if (/brand/.test(key)) {
        if (hexSat(hex) <= 10) continue;
      }
      result.primary = hex;
    // Secondary: key contains 'secondary' or 'accent' as a whole segment
    } else if (!result.secondary && /(?:^|[-_])(secondary)(?:$|[-_])/.test(key)) {
      result.secondary = hex;
    // Named color tokens: --colors--cyan, --colors--orange etc. (not neutrals)
    } else if (/--colors?--(?!black|white|grey|gray|dark|light|mid|charcoal|ink|muted)/.test(key)) {
      result.accent.push({ key: k, value: hex });
    }
    // theme-contrast / theme-invert / accent / highlight → vibrant accent (e.g. --theme-contrast: #c5ff4a)
    if (/(?:^|[-_])(contrast|invert|accent|highlight)(?:$|[-_])/.test(key)) {
      if (hex.length >= 7 && hexSat(hex) > 22) {
        result.accent.push({ key: k, value: hex });
      }
    }
  }
  return result;
}

// ─── HSL + usage-based role inference ─────────────────────────────────────────
// CSS var names (extractSemanticColors) take priority. This fills remaining nulls
// using HSL thresholds + bg/text/border usage counts from the scanning loop.
function _hexHSL(hex) {
  const h6 = _toHex6(hex);
  if (!h6) return { h: 0, s: 0, l: 50 };
  const r = parseInt(h6.slice(1,3),16)/255, g = parseInt(h6.slice(3,5),16)/255, b = parseInt(h6.slice(5,7),16)/255;
  const mx = Math.max(r,g,b), mn = Math.min(r,g,b);
  const l = (mx+mn)/2;
  if (mx === mn) return { h: 0, s: 0, l: Math.round(l*100) };
  const d = mx-mn;
  const s = l > 0.5 ? d/(2-mx-mn) : d/(mx+mn);
  let h; if (mx===r) h=((g-b)/d+(g<b?6:0))/6; else if(mx===g) h=((b-r)/d+2)/6; else h=((r-g)/d+4)/6;
  return { h: Math.round(h*360), s: Math.round(s*100), l: Math.round(l*100) };
}

function inferSemanticRoles(data, sc) {
  const btnBg = data?.buttonStyles?.primary?.backgroundColor;
  const pageBg = data?.pageBackground;
  const bodyColor = data?.typographyPatterns?.body?.color;
  const usage = data?.colorUsage || {};
  const allColors = [...(data?.colors || []), ...(data?.accentColors || [])].filter(c => /^#[0-9a-f]{6}$/i.test(c));

  // Helper: infer role from HSL + usage counts
  const _inferRole = (hex) => {
    const { s, l } = _hexHSL(hex);
    const u = usage[hex] || { bg: 0, text: 0, border: 0 };
    if (l > 97) return 'background';
    if (l < 5) return 'text-primary';
    if (s > 60 && l >= 35 && l <= 65) return 'accent';
    if (u.bg > u.text * 2 && l > 80) return 'surface';
    if (u.text > u.bg * 2 && l < 40) return 'text';
    if (u.border > u.bg && u.border > u.text) return 'border';
    return null;
  };

  // Primary action: button bg is ground truth (black buttons are valid — only reject white/page-bg)
  if (!sc.primary) {
    const btnBgIsValid = btnBg && /^#[0-9a-f]{6}$/i.test(btnBg) && btnBg.toLowerCase() !== '#ffffff';
    if (btnBgIsValid) sc.primary = btnBg;
    else {
      // Fallback: highest-saturation accent-role color
      const candidates = allColors.filter(c => {
        const role = _inferRole(c);
        return (role === 'accent' || hexSat(c) > 15) && c !== pageBg;
      });
      candidates.sort((a, b) => hexSat(b) - hexSat(a));
      if (candidates[0]) sc.primary = candidates[0];
    }
  }

  // Background
  if (!sc.bg) {
    if (pageBg) sc.bg = pageBg;
    else {
      const bgCandidate = allColors.find(c => _inferRole(c) === 'background' || _inferRole(c) === 'surface');
      if (bgCandidate) sc.bg = bgCandidate;
    }
  }

  // Foreground (text) — heading color is more reliable than body (body may be muted/secondary)
  if (!sc.fg) {
    const h1Color = data?.typographyPatterns?.h1?.color;
    const h2Color = data?.typographyPatterns?.h2?.color;
    const headingColor = (h1Color && /^#[0-9a-f]{6}$/i.test(h1Color)) ? h1Color
      : (h2Color && /^#[0-9a-f]{6}$/i.test(h2Color)) ? h2Color : null;
    if (headingColor && headingColor !== '#000000') sc.fg = headingColor;
    else if (bodyColor && /^#[0-9a-f]{6}$/i.test(bodyColor) && bodyColor !== '#000000') sc.fg = bodyColor;
    else {
      // Usage-based: color most used as text with low saturation
      const textCandidates = allColors
        .filter(c => c !== pageBg && c !== sc.primary)
        .map(c => ({ hex: c, ...(_hexHSL(c)), u: usage[c] || { bg: 0, text: 0, border: 0 } }))
        .filter(c => c.u.text > c.u.bg && c.s < 15);
      textCandidates.sort((a, b) => b.u.text - a.u.text);
      if (textCandidates[0]) sc.fg = textCandidates[0].hex;
    }
  }

  // Secondary: second-highest saturation color, or usage-based accent
  if (!sc.secondary) {
    const candidates = allColors.filter(c => c !== sc.primary && c !== pageBg && c !== sc.fg && hexSat(c) > 15);
    candidates.sort((a, b) => hexSat(b) - hexSat(a));
    if (candidates[0]) sc.secondary = candidates[0];
  }

  return sc;
}

// ─── WCAG contrast ────────────────────────────────────────────────────────
// Proper relative luminance per WCAG 2.1 (sRGB linearisation). Note this is
// NOT hexLum() above: that one is a cheap perceptual approximation used for
// role inference, and it is not valid for accessibility ratios.
function wcagLuminance(hex) {
  const h = _toHex6(hex);
  if (!h) return 0;
  const chan = v => {
    const c = parseInt(v, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(h.slice(1, 3)) + 0.7152 * chan(h.slice(3, 5)) + 0.0722 * chan(h.slice(5, 7));
}

// Contrast ratio between two hex colors, 1..21. Returns null if either is
// unparseable, so callers can omit rather than print a wrong number.
function wcagContrast(hexA, hexB) {
  if (!_toHex6(hexA) || !_toHex6(hexB)) return null;
  const a = wcagLuminance(hexA), b = wcagLuminance(hexB);
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

// ─── CSS colour parsing + resolution ──────────────────────────────────────
// The extractor converts most colours to hex via canvas, but raw values
// survive verbatim in cssVars (rgba(), oklch(), var() chains). A design
// document must never print `var(--x)` or an alpha colour that the reader
// cannot use, so everything is resolved to an opaque hex composited over the
// page background.

// OKLCH → sRGB. Standard OKLab matrices; no canvas, so it works in Node.
function oklchToRgb(L, C, Hdeg) {
  const h = (Hdeg * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  const lin = [
     4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
  return lin.map(v => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(c * 255)));
  });
}

// HSL → RGB, all channels 0..1 in, 0..255 out.
function hslToRgb(h, sat, light) {
  const hh = ((h % 360) + 360) % 360 / 360;
  if (sat === 0) { const v = Math.round(light * 255); return [v, v, v]; }
  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;
  const chan = tRaw => {
    let tt = tRaw;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [chan(hh + 1 / 3), chan(hh), chan(hh - 1 / 3)]
    .map(v => Math.max(0, Math.min(255, Math.round(v * 255))));
}

// Parses hex / rgb() / rgba() / hsl() / oklch() / bare HSL triplet into
// {r,g,b,a}. null when unparseable.
function parseCssColor(input) {
  if (typeof input !== 'string') return null;
  const t = input.trim().toLowerCase();
  if (!t || t === 'transparent') return t === 'transparent' ? { r: 0, g: 0, b: 0, a: 0 } : null;

  if (/^#[0-9a-f]{3,8}$/.test(t)) {
    let h = t.slice(1);
    if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    return {
      r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    };
  }

  let m = t.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    if (p.length < 3 || p.slice(0, 3).some(v => !Number.isFinite(v))) return null;
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 && Number.isFinite(p[3]) ? p[3] : 1 };
  }

  // hsl()/hsla(), comma- or space-separated, with an optional /alpha.
  m = t.match(/^hsla?\(([^)]+)\)$/);
  if (m) {
    const [main, alphaPart] = m[1].split('/');
    const p = main.trim().split(/[\s,]+/).filter(Boolean);
    if (p.length < 3) return null;
    const h = parseFloat(p[0]), sPct = parseFloat(p[1]), lPct = parseFloat(p[2]);
    if (![h, sPct, lPct].every(Number.isFinite)) return null;
    let a = 1;
    const rawA = alphaPart !== undefined ? alphaPart : p[3];
    if (rawA !== undefined) {
      const av = parseFloat(rawA);
      if (Number.isFinite(av)) a = /%/.test(String(rawA)) ? av / 100 : av;
    }
    const [r, g, b] = hslToRgb(h, sPct / 100, lPct / 100);
    return { r, g, b, a };
  }

  // A bare HSL triplet — "0 0% 14%". shadcn/ui stores its palette this way in
  // custom properties, composing them as hsl(var(--token)) at use sites, so
  // the recorded value has no function wrapper.
  m = t.match(/^(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (m) {
    const [r, g, b] = hslToRgb(parseFloat(m[1]), parseFloat(m[2]) / 100, parseFloat(m[3]) / 100);
    return { r, g, b, a: 1 };
  }

  m = t.match(/^oklch\(([^)]+)\)$/);
  if (m) {
    const parts = m[1].split('/');
    const p = parts[0].trim().split(/\s+/).map(v => parseFloat(v));
    if (p.length < 3 || p.some(v => !Number.isFinite(v))) return null;
    const L = /%$/.test(parts[0].trim().split(/\s+/)[0]) ? p[0] / 100 : p[0];
    const [r, g, b] = oklchToRgb(L, p[1], p[2]);
    let a = 1;
    if (parts[1]) {
      const av = parseFloat(parts[1]);
      if (Number.isFinite(av)) a = /%/.test(parts[1]) ? av / 100 : av;
    }
    return { r, g, b, a };
  }
  return null;
}

// Composites a possibly-transparent colour over an opaque background.
function compositeOver(color, backgroundHex) {
  const fg = parseCssColor(color);
  if (!fg) return null;
  const to2 = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  if (fg.a >= 1) return '#' + to2(fg.r) + to2(fg.g) + to2(fg.b);
  const bg = parseCssColor(backgroundHex) || { r: 255, g: 255, b: 255, a: 1 };
  const mix = (f, b) => f * fg.a + b * (1 - fg.a);
  return '#' + to2(mix(fg.r, bg.r)) + to2(mix(fg.g, bg.g)) + to2(mix(fg.b, bg.b));
}

// Resolves a value that may be a var() reference, following the chain through
// cssVars, then composites it over the background. Returns null rather than
// ever emitting `var(--x)` into a document.
function resolveColor(value, cssVars, backgroundHex, _depth) {
  if (typeof value !== 'string') return null;
  const depth = _depth || 0;
  if (depth > 8) return null;                       // cyclic var() chain
  let v = value.trim();
  const m = v.match(/^var\(\s*(--[a-z0-9-_]+)\s*(?:,\s*([^)]+))?\)$/i);
  if (m) {
    const looked = cssVars && cssVars[m[1]];
    if (typeof looked === 'string') return resolveColor(looked, cssVars, backgroundHex, depth + 1);
    return m[2] ? resolveColor(m[2], cssVars, backgroundHex, depth + 1) : null;
  }
  if (/var\(/.test(v)) return null;                 // embedded var we cannot resolve
  return compositeOver(v, backgroundHex);
}

// Expose pure utilities on the shared namespace so content.js (page world,
// injected via chrome.scripting.executeScript) can destructure them the same
// way sidepanel/popup scripts rely on top-level declarations. Single source
// of truth for color math — the _toHex6 fix propagates everywhere.
if (typeof window !== 'undefined') {
  window.__vibeDesign = window.__vibeDesign || {};
  window.__vibeDesign.hexLum = hexLum;
  window.__vibeDesign.hexSat = hexSat;
}

// Node consumers (lib/design-md-builder.js under test, scripts/build-design-md.js)
// require this file directly. The guard keeps the page-world/<script> load path
// untouched — `module` is undefined there.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    _toHex6, hexLum, hexSat, safeHostname, generateTonalScale,
    extractSemanticColors, _hexHSL, inferSemanticRoles,
    wcagLuminance, wcagContrast,
    oklchToRgb, hslToRgb, parseCssColor, compositeOver, resolveColor,
  };
}

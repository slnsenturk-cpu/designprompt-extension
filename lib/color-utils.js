// lib/color-utils.js
// Shared color utilities and semantic extraction — Chrome-API-free
// Load order: this file MUST load before prompt-builder.js, token-exporter.js, and ui-helpers.js

// ═══════════════════════════════════════════════════════════════════════════
// PURE COLOR UTILITIES
// ═══════════════════════════════════════════════════════════════════════════
function hexLum(hex) { if(!hex||hex.length<4)return 0.5; const h=hex.length===4?'#'+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3]:hex; const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); return(0.299*r+0.587*g+0.114*b)/255; }
function hexSat(hex) { if(!hex||hex.length<4)return 0; const h=hex.length===4?'#'+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3]:hex; const r=parseInt(h.slice(1,3),16)/255,g=parseInt(h.slice(3,5),16)/255,b=parseInt(h.slice(5,7),16)/255; const mx=Math.max(r,g,b),mn=Math.min(r,g,b); if(mx===mn)return 0; const l=(mx+mn)/2; return Math.round((l<=0.5?(mx-mn)/(mx+mn):(mx-mn)/(2-mx-mn))*100); }
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
  for (const [k, v] of Object.entries(vars)) {
    if (!/^#[0-9a-f]{3,8}$/i.test(v.trim())) continue;
    const key = k.toLowerCase();
    // Primary: key must contain 'primary' or 'brand' or 'cta' as a segment
    if (!result.primary && /(?:^|[-_])(primary|brand|cta)(?:$|[-_])/.test(key)) {
      const hex = v.trim();
      // Gate 'brand' matches on saturation — avoids gray brand-scale vars like --color-brand--gray-12
      if (/brand/.test(key)) {
        if (hexSat(hex) <= 10) continue;
      }
      result.primary = hex;
    // Secondary: key contains 'secondary' or 'accent' as a whole segment
    } else if (!result.secondary && /(?:^|[-_])(secondary)(?:$|[-_])/.test(key)) {
      result.secondary = v.trim();
    // Named color tokens: --colors--cyan, --colors--orange etc. (not neutrals)
    } else if (/--colors?--(?!black|white|grey|gray|dark|light|mid|charcoal|ink|muted)/.test(key)) {
      result.accent.push({ key: k, value: v.trim() });
    }
    // theme-contrast / theme-invert / accent / highlight → vibrant accent (e.g. --theme-contrast: #c5ff4a)
    if (/(?:^|[-_])(contrast|invert|accent|highlight)(?:$|[-_])/.test(key)) {
      const hex = v.trim();
      if (hex.length >= 7) { // only full 6-char hex
        if (hexSat(hex) > 22) {
          result.accent.push({ key: k, value: hex });
        }
      }
    }
  }
  return result;
}

// ─── HSL + usage-based role inference ─────────────────────────────────────────
// CSS var names (extractSemanticColors) take priority. This fills remaining nulls
// using HSL thresholds + bg/text/border usage counts from the scanning loop.
function _hexHSL(hex) {
  if (!hex || hex.length < 7) return { h: 0, s: 0, l: 50 };
  const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
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

  // Primary action: button bg is ground truth
  if (!sc.primary) {
    if (btnBg && /^#[0-9a-f]{6}$/i.test(btnBg)) sc.primary = btnBg;
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

  // Foreground (text)
  if (!sc.fg) {
    if (bodyColor && /^#[0-9a-f]{6}$/i.test(bodyColor) && bodyColor !== '#000000') sc.fg = bodyColor;
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

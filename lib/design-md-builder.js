// VibeDesign — DESIGN.md builder (v3.0)
//
// Turns an extracted token bundle into a Stitch-compatible DESIGN.md.
// Pure and offline: no network, no AI, no DOM. Same tokens in → byte-identical
// markdown out, which is what makes it testable and diffable.
//
// Plain globals so the same file works via <script> tag (popup/sidepanel) and
// via require() in Node (tests + scripts/build-design-md.js). No ESM, no build.
//
//   buildDesignMd(tokens, { tier, sourceUrl, scope, version, observedAt })
//
// ── On not leaking page content ───────────────────────────────────────────
// The extractor collects plenty of copy: nav link text, button labels, tab
// headings, footer content maps, case-study tags, alt text, image URLs. NONE
// of it belongs in a design system document.
//
// The defence is two-layered and deliberate:
//   1. We only ever read a fixed allowlist of structural fields. Copy-bearing
//      fields (navPattern.logoText, buttonStyles.*.text, interactiveStates[],
//      sectionContentMap, footerContentMap, fixedUIChrome[].text,
//      stickySections.scrollBlockHeadings, caseGridPattern.tagLabels, assets,
//      heroImageUrl) are never touched.
//   2. Every value passes a typed accessor — hex(), len(), num(), word(),
//      shadow(), fontStack(). A sentence cannot survive any of them, so even a
//      future field rename cannot turn into a copy leak.
//
// Note on `interactiveStates`: despite the name it holds tab-panel COPY
// (headings, bullets, CTA labels), not CSS state diffs. The interaction-states
// section is therefore built from hoverStates/transitions instead.

const VD_DESIGN_MD = (() => {
  'use strict';

  // Color math lives in lib/color-utils.js — single source of truth. In the
  // browser that file's top-level declarations are already globals; in Node we
  // require it.
  const CU = (() => {
    if (typeof module !== 'undefined' && module.exports) {
      try { return require('./color-utils.js'); } catch (e) { /* fall through */ }
    }
    return (typeof self !== 'undefined') ? self : globalThis;
  })();

  const FREE_FOOTER =
    '<!-- Motion, interaction states, component anatomy and accessibility notes are available in VibeDesign Pro -->';

  // ── typed accessors ─────────────────────────────────────────────────────
  // Each returns a normalized value or null. Null means "omit", never "guess".

  function hex(v) {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    if (!/^#[0-9a-f]{3,8}$/i.test(t)) return null;
    let h = t.toLowerCase();
    if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    else if (h.length === 5) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    if (h.length === 9) h = h.slice(0, 7); // drop alpha for documentation
    return h.length === 7 ? h : null;
  }

  const ONE_LEN = '(-?[0-9.]+(px|rem|em|%|vh|vw|ch|fr)|0|auto|none)';
  const LEN_RE = new RegExp('^' + ONE_LEN + '( +' + ONE_LEN + '){0,3}$');
  function len(v) {
    if (typeof v !== 'string' && typeof v !== 'number') return null;
    const t = String(v).trim();
    if (!t || t.length > 48) return null;
    return LEN_RE.test(t) ? t : null;
  }

  function num(v) {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }

  function int(v) {
    const n = num(v);
    return n === null ? null : Math.round(n);
  }

  // A short enum-ish token: 'layered-elevation', 'sticky', 'grid'. Rejects
  // anything sentence-shaped.
  function word(v) {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    if (!t || t.length > 32) return null;
    if (!/^[a-z][a-z0-9 _-]*$/i.test(t)) return null;
    return t.split(/\s+/).length <= 3 ? t : null;
  }

  function shadow(v) {
    if (typeof v !== 'string') return null;
    const t = v.trim().replace(/\s+/g, ' ');
    if (!t || t.length > 180 || t === 'none') return null;
    // Must look like a shadow: offsets and/or a color function.
    if (!/^(inset )?-?[0-9.]/.test(t) && !/rgba?\(|#[0-9a-f]{3,8}/i.test(t)) return null;
    return t;
  }

  function fontStack(v) {
    if (typeof v !== 'string') return null;
    const t = v.trim().replace(/\s+/g, ' ');
    if (!t || t.length > 120) return null;
    // Font stacks are comma-separated family names. Sentence punctuation and
    // digits-heavy strings are rejected.
    // Families may be vendor-prefixed (-apple-system) or quoted ("Söhne Mono"),
    // and may carry non-ASCII letters.
    const FAM = "[\"']?-?[A-Za-z\\u00C0-\\u024F][A-Za-z0-9\\u00C0-\\u024F '\"._-]*";
    if (!new RegExp('^' + FAM + '(, *' + FAM + ')*$').test(t)) return null;
    // A family name is a name, not a clause. Real stacks top out around
    // "Helvetica Neue LT Std"; prose does not. Without this, a sentence made
    // only of letters and spaces would pass the character test above.
    if (t.split(',').some(fam => fam.trim().split(/\s+/).length > 4)) return null;
    // Sentence-final punctuation is never part of a family name.
    if (/[A-Za-z]\.$/.test(t)) return null;
    return t;
  }

  // CSS transition / easing values, e.g. "all .3s cubic-bezier(.4,0,.2,1)".
  function timing(v) {
    if (typeof v !== 'string') return null;
    const t = v.trim().replace(/\s+/g, ' ');
    if (!t || t.length > 90 || t === 'none' || t === 'all 0s ease 0s') return null;
    if (!/[0-9]+(\.[0-9]+)?m?s/.test(t)) return null;
    if (!/^[a-z0-9 ,.()%-]+$/i.test(t)) return null;
    return t;
  }

  // "400ms" / "0.4s" / 400 → normalized "400ms". Prevents the "400msms" that
  // came from appending a unit to a value that already had one.
  function duration(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) + 'ms' : null;
    if (typeof v !== 'string') return null;
    const t = v.trim();
    const m = t.match(/^(-?[0-9.]+)(ms|s)?$/);
    if (!m) return null;
    const n = parseFloat(m[1]);
    if (!Number.isFinite(n)) return null;
    return Math.round(m[2] === 's' ? n * 1000 : n) + 'ms';
  }

  function bool(v) { return v === true; }

  // ── formatting ──────────────────────────────────────────────────────────

  function remOf(pxStr) {
    const n = num(pxStr);
    if (n === null || !/px$/.test(String(pxStr).trim())) return null;
    const r = n / 16;
    return `${parseFloat(r.toFixed(4))}rem`;
  }

  // "16px" → "16px (1rem)". Multi-value and non-px pass through unchanged.
  function withRem(v) {
    const l = len(v);
    if (!l) return null;
    if (l.split(/\s+/).length > 1) return l;
    const r = remOf(l);
    return r ? `${l} (${r})` : l;
  }

  function yamlStr(s) {
    return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }

  function titleCase(s) {
    return s.replace(/(^|[\s-])([a-z])/g, (m, p, c) => p + c.toUpperCase());
  }

  // Site name from the URL only — never a logo or brand string from the page.
  function siteName(url) {
    let host = '';
    try { host = new URL(url).hostname; } catch (e) { host = ''; }
    if (!host) return 'Untitled';
    host = host.replace(/^www\./, '');
    const label = host.split('.')[0] || host;
    return titleCase(label.replace(/[-_]+/g, ' '));
  }

  // Colour roles are emitted in this order; `_`-prefixed keys are internal.
  function colorKeys(colors) {
    return Object.keys(colors || {}).filter(k => k.charAt(0) !== '_');
  }

  function isEmpty(o) {
    if (o === null || o === undefined) return true;
    if (Array.isArray(o)) return o.length === 0;
    if (typeof o === 'object') return Object.keys(o).length === 0;
    return false;
  }

  // ── color role derivation ───────────────────────────────────────────────

  function hsl(h) { return CU._hexHSL ? CU._hexHSL(h) : { h: 0, s: 0, l: 50 }; }
  function contrast(a, b) { return CU.wcagContrast ? CU.wcagContrast(a, b) : null; }

  function shiftLightness(h, delta) {
    const c = hex(h);
    if (!c) return null;
    const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
    const f = v => {
      const out = delta >= 0 ? v + (255 - v) * delta : v * (1 + delta);
      return Math.max(0, Math.min(255, Math.round(out)));
    };
    const to2 = v => v.toString(16).padStart(2, '0');
    return '#' + to2(f(r)) + to2(f(g)) + to2(f(b));
  }

  // The role a color is MOST used for. A color used 74x as a border and 8x as
  // a background is a border color, whatever order we happen to inspect it in.
  function dominantRole(usage, h) {
    const u = usage && usage[h];
    if (!u) return null;
    const counts = [['bg', int(u.bg) || 0], ['text', int(u.text) || 0], ['border', int(u.border) || 0]];
    counts.sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
    return counts[0][1] > 0 ? counts[0][0] : null;
  }

  // Ranks colors by how often the page uses them in a given role.
  function byUsage(usage, role) {
    return Object.keys(usage || {})
      .map(k => ({ hex: hex(k), n: int(usage[k] && usage[k][role]) || 0 }))
      .filter(x => x.hex && x.n > 0)
      .sort((a, b) => (b.n - a.n) || a.hex.localeCompare(b.hex)); // tie-break = deterministic
  }

  // Hue windows for status colors, checked against reasonably saturated colors.
  const STATUS_HUES = [
    { key: 'success', min: 90, max: 165 },
    { key: 'warning', min: 25, max: 60 },
    { key: 'error', min: 340, max: 20 },   // wraps
  ];

  // Alpha/var-aware colour read, bound to a page background.
  function makeResolver(t, backgroundHex) {
    const vars = t.cssVars || {};
    return function resolve(v) {
      if (v === null || v === undefined) return null;
      const direct = hex(v);
      if (direct) return direct;
      const out = CU.resolveColor ? CU.resolveColor(String(v), vars, backgroundHex) : null;
      return hex(out);
    };
  }

  function lum(h) { return CU.wcagLuminance ? CU.wcagLuminance(h) : 0.5; }

  // Text tones on this site are usually alpha variants of the primary text
  // colour (--paper-50/60/70). Finding them beats picking an unrelated grey.
  function alphaVariantsOf(baseHex, t, backgroundHex) {
    const vars = t.cssVars || {};
    const base = CU.parseCssColor ? CU.parseCssColor(baseHex) : null;
    if (!base) return [];
    const out = [];
    Object.keys(vars).sort().forEach(k => {
      const parsed = CU.parseCssColor ? CU.parseCssColor(String(vars[k]).trim()) : null;
      if (!parsed || parsed.a >= 1 || parsed.a <= 0) return;
      if (Math.abs(parsed.r - base.r) > 6 || Math.abs(parsed.g - base.g) > 6 || Math.abs(parsed.b - base.b) > 6) return;
      const composited = hex(CU.compositeOver(String(vars[k]).trim(), backgroundHex));
      if (composited) out.push({ hex: composited, alpha: parsed.a, key: k });
    });
    // Strongest first, deterministic on ties.
    out.sort((a, b) => (b.alpha - a.alpha) || a.key.localeCompare(b.key));
    return out;
  }

  function deriveColors(t) {
    const usage = t.colorUsage || {};
    const out = {};
    const seen = new Set();

    // ── background first: everything else composites over it ──────────────
    let bg = hex(t.pageBackground)
      || (CU.compositeOver ? hex(CU.compositeOver(t.pageBackground, '#ffffff')) : null);
    if (!bg) {
      const ranked = byUsage(usage, 'bg');
      bg = ranked.length ? ranked[0].hex : null;
    }
    const resolve = makeResolver(t, bg || '#ffffff');
    // `alias` lets two roles legitimately share one colour. On most sites the
    // primary action IS the accent; suppressing the duplicate would drop the
    // `primary` role entirely rather than telling the reader they coincide.
    const take = (key, value, alias) => {
      const h = resolve(value);
      if (!h) return;
      if (seen.has(h) && !alias) return;
      out[key] = h; seen.add(h);
    };
    if (bg) { out.background = bg; seen.add(bg); }
    const isDark = bg ? lum(bg) < 0.18 : false;

    const palette = []
      .concat(Array.isArray(t.colors) ? t.colors : [])
      .concat(Array.isArray(t.accentColors) ? t.accentColors : [])
      .map(resolve).filter(Boolean);

    // ── text ──────────────────────────────────────────────────────────────
    // On a dark theme a "text" colour darker than the page background is an
    // extraction artefact (usually an inverse button's label), never body text.
    const tp = t.typographyPatterns || {};
    let textCandidates = byUsage(usage, 'text')
      .filter(c => dominantRole(usage, c.hex) === 'text')
      .map(c => resolve(c.hex)).filter(Boolean);
    [tp.body && tp.body.color, tp.h1 && tp.h1.color].forEach(c => {
      const r = resolve(c);
      if (r && textCandidates.indexOf(r) === -1) textCandidates.push(r);
    });
    if (bg) {
      textCandidates = textCandidates.filter(c => (isDark ? lum(c) > lum(bg) : lum(c) < lum(bg)));
      textCandidates.sort((a, b) => {
        const d = (contrast(b, bg) || 0) - (contrast(a, bg) || 0);
        return d !== 0 ? d : a.localeCompare(b);
      });
    }
    take('text-primary', textCandidates[0]);

    // Secondary/muted: prefer alpha variants of the primary text colour.
    const tones = out['text-primary'] ? alphaVariantsOf(out['text-primary'], t, bg || '#ffffff') : [];
    const toneQueue = tones.map(x => x.hex).concat(textCandidates.slice(1));
    const nextTone = () => toneQueue.find(c => c && !seen.has(c));
    take('text-secondary', nextTone());
    take('text-muted', nextTone());

    // ── accent: most saturated colour with the highest combined usage ─────
    const combined = h => {
      const u = usage[h] || {};
      return (int(u.bg) || 0) + (int(u.text) || 0) + (int(u.border) || 0);
    };
    const accentPool = palette.filter(c => !seen.has(c) && hsl(c).s >= 25);
    accentPool.sort((a, b) => {
      const d = (hsl(b).s * 2 + combined(b)) - (hsl(a).s * 2 + combined(a));
      return d !== 0 ? d : a.localeCompare(b);
    });
    take('accent', accentPool[0]);

    // ── primary ───────────────────────────────────────────────────────────
    // An "inverse" button paints itself in the PAGE background colour. When
    // the extractor already flagged the primary as ambiguous and the button
    // agrees with the page background, the button colour tells us nothing —
    // fall back to the frequency-weighted signal.
    const btn = (t.buttonStyles && t.buttonStyles.primary) || null;
    const btnBg = btn ? resolve(btn.backgroundColor) : null;
    const cand = t._primaryColorCandidates || {};
    const inverse = !!(t._primaryColorAmbiguous && btnBg && bg && btnBg === bg);
    if (inverse) {
      take('primary', resolve(cand.frequency_primary) || out.accent, true);
    } else {
      take('primary', btnBg || resolve(cand.css_var_primary) || out.accent, true);
    }

    // ── surfaces ──────────────────────────────────────────────────────────
    // A surface must be a repeated background, never a one-off.
    const sectionBgs = {};
    (Array.isArray(t.sectionContentMap) ? t.sectionContentMap : []).forEach(sec => {
      const c = resolve(sec && (sec.bgColor || sec.backgroundColor || sec.bgHex));
      if (c) sectionBgs[c] = (sectionBgs[c] || 0) + 1;
    });
    const cardBg = resolve(t.cardStyles && t.cardStyles.backgroundColor);
    if (cardBg) sectionBgs[cardBg] = (sectionBgs[cardBg] || 0) + 2;
    (Array.isArray(t.hoverStates) ? t.hoverStates : []).forEach(h => {
      const c = resolve(h && h.before && h.before.background);
      if (c) sectionBgs[c] = (sectionBgs[c] || 0) + 1;
    });
    byUsage(usage, 'bg').filter(c => dominantRole(usage, c.hex) === 'bg')
      .forEach(c => { const r = resolve(c.hex); if (r) sectionBgs[r] = (sectionBgs[r] || 0) + c.n; });
    const surfaces = Object.keys(sectionBgs)
      .filter(c => !seen.has(c) && sectionBgs[c] > 1)   // never a colour used once
      .sort((a, b) => (sectionBgs[b] - sectionBgs[a]) || a.localeCompare(b));
    take('surface', surfaces[0]);
    take('surface-raised', surfaces.find(c => !seen.has(c)));

    // ── borders ───────────────────────────────────────────────────────────
    const borderRanked = byUsage(usage, 'border')
      .filter(c => dominantRole(usage, c.hex) === 'border')
      .map(c => resolve(c.hex)).filter(Boolean);
    const varBorder = resolve((t.cssVars || {})['--border']);
    const borderQueue = (varBorder ? [varBorder] : []).concat(borderRanked);
    const nextBorder = () => borderQueue.find(c => c && !seen.has(c));
    take('border', nextBorder());
    take('border-subtle', nextBorder());

    // ── status colours ────────────────────────────────────────────────────
    STATUS_HUES.forEach(({ key, min, max }) => {
      const match = palette.find(c => {
        if (seen.has(c)) return false;
        const { h, s, l } = hsl(c);
        if (s < 30 || l < 15 || l > 85) return false;
        return min > max ? (h >= min || h <= max) : (h >= min && h <= max);
      });
      take(key, match);
    });

    // ── hover tokens: ONLY when measured. Never synthesised. ──────────────
    const measuredHover = (Array.isArray(t.hoverStates) ? t.hoverStates : [])
      .filter(h => h && typeof h.selector === 'string' && /btn|button|cta/i.test(h.selector))
      .map(h => resolve(h.backgroundColor)).filter(Boolean)[0];
    if (measuredHover && out.primary && measuredHover !== out.primary) {
      take('primary-hover', measuredHover);
    }

    // ── remaining accents ─────────────────────────────────────────────────
    let n = 1;
    palette.forEach(c => {
      if (seen.has(c) || hsl(c).s < 20 || n > 4) return;
      take('accent-' + n, c);
      n += 1;
    });

    out._meta = { isDark: isDark, inverseButton: inverse, resolve: resolve };
    return out;
  }

  // ── typography ──────────────────────────────────────────────────────────

  const SCALE_KEYS = ['h1', 'h2', 'h3', 'h4', 'body', 'small', 'label', 'code'];

  function deriveTypography(t) {
    const tp = t.typographyPatterns || {};
    const out = { stacks: {}, scale: {} };

    const heading = fontStack(tp.h1 && tp.h1.fontFamily) || fontStack(tp.h2 && tp.h2.fontFamily);
    const body = fontStack(tp.body && tp.body.fontFamily);
    const mono = fontStack(tp.code && tp.code.fontFamily);
    if (heading) out.stacks.heading = heading;
    if (body) out.stacks.body = body;
    if (mono) out.stacks.mono = mono;
    if (!heading && !body) {
      const first = (Array.isArray(t.fonts) ? t.fonts : []).map(fontStack).filter(Boolean)[0];
      if (first) out.stacks.body = first;
    }

    // "small" isn't extracted directly; caption is its real-world stand-in.
    // label and code are their own steps — a pixel/mono label face is a
    // deliberate design decision, not a footnote.
    const source = {
      h1: tp.h1, h2: tp.h2, h3: tp.h3, h4: tp.h4, body: tp.body,
      small: tp.caption, label: tp.label, code: tp.code,
    };
    out.detail = {};
    SCALE_KEYS.forEach(k => {
      const p = source[k];
      if (!p) return;
      const size = len(p.fontSize);
      if (!size) return;
      const weight = int(p.fontWeight);
      const lh = p.lineHeight === 'normal' ? 'normal' : (len(p.lineHeight) || num(p.lineHeight));
      const parts = [size, weight === null ? null : String(weight), lh === null ? null : String(lh)];
      out.scale[k] = parts.filter(Boolean).join(' / ');
      // Tracking belongs to the step, not to a floating list — -3.33px on h1
      // and +1.28px on a label are opposite decisions.
      out.detail[k] = {
        size: size,
        weight: weight,
        lineHeight: lh === null ? null : String(lh),
        tracking: len(p.letterSpacing) && p.letterSpacing !== 'normal' ? len(p.letterSpacing) : null,
        transform: word(p.textTransform) && p.textTransform !== 'none' ? word(p.textTransform) : null,
        family: fontStack(p.fontFamily),
      };
    });

    // Every distinct family, with the steps that use it. A face that appears
    // only on labels still has to be declared or an agent cannot reproduce it.
    const byFamily = {};
    SCALE_KEYS.forEach(k => {
      const fam = out.detail[k] && out.detail[k].family;
      if (!fam) return;
      (byFamily[fam] = byFamily[fam] || []).push(k);
    });
    (Array.isArray(t.fonts) ? t.fonts : []).map(fontStack).filter(Boolean).forEach(fam => {
      if (!byFamily[fam]) byFamily[fam] = [];
    });
    out.families = Object.keys(byFamily).sort().map(fam => ({ family: fam, steps: byFamily[fam] }));

    out.weights = (Array.isArray(t.fontWeights) ? t.fontWeights : []).map(int).filter(w => w !== null)
      .filter((w, i, a) => a.indexOf(w) === i).sort((a, b) => a - b);
    return out;
  }

  // ── spacing / radius / shadows / breakpoints ────────────────────────────

  function deriveSpacing(t) {
    const s = t.spacingScale;
    if (!s) return null;
    const base = int(s.baseUnit);
    if (base === null) return null;
    const scale = (Array.isArray(s.commonValues) ? s.commonValues : [])
      .map(int).filter(v => v !== null && v >= 0)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => a - b)
      .map(v => v + 'px');
    return { base: base + 'px', scale, conformRate: int(s.conformRate) };
  }

  // A polygon clip-path is a shape decision that border-radius cannot express.
  // When one is present the button radius is genuinely 0 and the chamfer has
  // to be described instead, or an agent will render rounded buttons.
  function deriveShape(t) {
    const bs = t.buttonStyles || {};
    const variants = ['primary', 'secondary', 'ghost', 'navCta'];
    let clip = null, on = null;
    variants.forEach(v => {
      if (clip || !bs[v]) return;
      const c = bs[v].clipPath;
      if (typeof c === 'string' && /polygon\s*\(/i.test(c) && c.length < 400) {
        clip = c.trim().replace(/\s+/g, ' ');
        on = v;
      }
    });
    if (!clip) return null;
    // A --chamfer-ish custom property names the cut size.
    let size = null;
    const vars = t.cssVars || {};
    Object.keys(vars).sort().forEach(k => {
      if (size || !/chamfer|bevel|notch|cut/i.test(k)) return;
      const l = len(String(vars[k]).trim());
      if (l) size = l;
    });
    // Fall back to the first length inside the polygon itself.
    if (!size) {
      const m = clip.match(/(-?[0-9.]+px)/);
      if (m) size = m[1];
    }
    return { clipPath: clip, size: size, variant: on };
  }

  function deriveRadius(t) {
    const out = {};
    const put = (k, v) => { const l = len(v); if (l && l !== '0') out[k] = l; };
    const shape = deriveShape(t);
    if (shape) {
      // Chamfered via clip-path: the corner radius really is zero.
      out.button = '0px';
    } else {
      put('button', t.buttonStyles && t.buttonStyles.primary && t.buttonStyles.primary.borderRadius);
    }
    put('card', t.cardStyles && t.cardStyles.borderRadius);
    put('input', t.inputStyles && t.inputStyles.borderRadius);
    put('tag', t.badgeStyles && t.badgeStyles.borderRadius);

    // When a component reports no radius, the observed radius list is still
    // evidence. Map its smallest sensible values rather than emitting nothing.
    const observed = (Array.isArray(t.borderRadii) ? t.borderRadii : [])
      .map(len).filter(Boolean)
      .filter(r => r !== '0px' && r !== '0' && !/^(9999px|50%|100%)$/.test(r) && (num(r) === null || num(r) < 400))
      .filter((r, i, a) => a.indexOf(r) === i)
      .sort((a, b) => (num(a) || 0) - (num(b) || 0));
    if (!out.input && observed.length) out.input = observed[0];
    if (!out.card && observed.length) out.card = observed[observed.length - 1];
    // A pill/circle radius in the observed set is the avatar convention.
    const pill = (Array.isArray(t.borderRadii) ? t.borderRadii : [])
      .map(len).filter(Boolean)
      .find(r => /^(9999px|50%|100%)$/.test(r) || (num(r) !== null && num(r) >= 999));
    if (pill) out.avatar = pill;
    return out;
  }

  // Ranks shadows by total blur+offset magnitude so sm/md/lg are meaningful.
  function shadowWeight(s) {
    const nums = (s.match(/-?[0-9.]+px/g) || []).map(v => Math.abs(parseFloat(v)));
    return nums.reduce((a, b) => a + b, 0);
  }

  const isGlow = s => /^(0px? )?0px? [0-9.]+px/.test(s);
  const isInset = s => /^inset /.test(s);
  const isLayered = s => s.split(/,(?![^()]*\))/).length > 1;

  function deriveShadows(t, accentHex) {
    const list = (Array.isArray(t.shadows) ? t.shadows : []).map(shadow).filter(Boolean)
      .filter((s, i, a) => a.indexOf(s) === i);
    if (!list.length) return null;
    const ranked = list.slice().sort((a, b) => (shadowWeight(a) - shadowWeight(b)) || a.localeCompare(b));
    const out = {};
    const claim = (k, v) => { if (v && Object.values(out).indexOf(v) === -1) out[k] = v; };

    // Glows carry the accent and are the site's signature elevation — name
    // them for what they are rather than burying them in sm/md/lg.
    const glows = ranked.filter(s => isGlow(s) && !isInset(s));
    const accentGlows = accentHex
      ? glows.filter(g => g.toLowerCase().indexOf(accentHex.toLowerCase().slice(1, 4)) !== -1
          || (CU.parseCssColor && shadowMatchesAccent(g, accentHex)))
      : [];
    (accentGlows.length ? accentGlows : []).slice(0, 3).forEach((g, i) => {
      claim(i === 0 ? 'accent-glow' : 'accent-glow-' + (i + 1), g);
    });
    glows.forEach((g, i) => { if (i < 2) claim('glow' + (i ? '-' + (i + 1) : ''), g); });

    ranked.filter(isInset).slice(0, 2).forEach((v, i) => claim(i ? 'inset-' + (i + 1) : 'inset', v));
    ranked.filter(s => isLayered(s) && !isInset(s)).slice(0, 2)
      .forEach((v, i) => claim(i ? 'layered-' + (i + 1) : 'layered', v));

    const plain = ranked.filter(s => !isGlow(s) && !isInset(s) && !isLayered(s));
    if (plain.length) claim('sm', plain[0]);
    if (plain.length > 2) claim('md', plain[Math.floor(plain.length / 2)]);
    if (plain.length > 1) claim('lg', plain[plain.length - 1]);
    // Nothing plain at all — still surface a base elevation.
    if (!Object.keys(out).length) claim('sm', ranked[0]);
    return Object.keys(out).length ? out : null;
  }

  // A shadow belongs to the accent when its colour resolves to the accent hue.
  function shadowMatchesAccent(shadowStr, accentHex) {
    const m = shadowStr.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}|oklch\([^)]+\)/i);
    if (!m || !CU.parseCssColor) return false;
    const a = CU.parseCssColor(m[0]), b = CU.parseCssColor(accentHex);
    if (!a || !b) return false;
    return Math.abs(a.r - b.r) < 24 && Math.abs(a.g - b.g) < 24 && Math.abs(a.b - b.b) < 24;
  }

  function bpName(px) {
    if (px <= 480) return 'xs';
    if (px <= 640) return 'sm';
    if (px <= 768) return 'md';
    if (px <= 1024) return 'lg';
    if (px <= 1280) return 'xl';
    return '2xl';
  }

  function deriveBreakpoints(t) {
    const list = (Array.isArray(t.breakpoints) ? t.breakpoints : [])
      .map(b => int(b && b.px)).filter(p => p !== null)
      .filter((p, i, a) => a.indexOf(p) === i)
      .sort((a, b) => a - b);
    if (!list.length) return null;
    const out = {};
    list.forEach(px => { const n = bpName(px); if (!out[n]) out[n] = px + 'px'; });
    return out;
  }

  // ── style characterization (3–8 words, deterministic) ───────────────────

  function characterize(t, colors, spacing, radius, shape) {
    const words = [];
    const bg = colors.background;
    const tone = bg ? (hsl(bg).l < 50 ? 'dark' : 'light') : null;
    if (tone) words.push(tone);

    const pair = (colors['text-primary'] && bg) ? contrast(colors['text-primary'], bg) : null;
    if (pair !== null) words.push(pair >= 12 ? 'high-contrast' : (pair >= 7 ? 'crisp' : 'soft-contrast'));

    const vp = t.visualProfile || {};
    const rhythm = word(vp.sectionRhythm);
    const padY = num(vp.sectionPaddingY);
    if (padY !== null) words.push(padY >= 96 ? 'spacious' : (padY <= 48 ? 'compact' : 'measured'));
    else if (spacing && spacing.base) words.push(num(spacing.base) >= 8 ? 'spacious' : 'compact');
    else if (rhythm) words.push(rhythm);

    // Shape language: a clip-path chamfer is the dominant signal when present.
    if (shape) {
      words.push('chamfered');
    } else {
      const r = num(radius.button || radius.card);
      if (r !== null) words.push(r >= 16 ? 'soft-rounded' : (r >= 6 ? 'rounded' : 'sharp-edged'));
    }

    // Saturation of the ACCENT, not of a primary that may be an inverse
    // button painted in the page background — that read every accent site as
    // "monochrome".
    const key = colors.accent || colors.primary;
    const sat = key ? hsl(key).s : null;
    if (sat !== null) words.push(sat >= 60 ? 'vivid' : (sat <= 12 ? 'monochrome' : 'restrained'));

    // Motion personality, when the extraction measured one.
    const mp = t.motionProfile || {};
    const personality = word(mp.timingPersonality) || word(mp.revealStyle);
    const ambientCount = Array.isArray(t.ambientAnimations) ? t.ambientAnimations.length : 0;
    if (ambientCount > 0) words.push('animated');
    else if (personality) words.push(personality);

    // Nothing observed → no characterization. Better an omitted line than a
    // confident-sounding empty one.
    if (!words.length) return null;
    words.push('interface');
    return words.slice(0, 8).join(' ');
  }

  // ── frontmatter ─────────────────────────────────────────────────────────

  function buildFrontmatter(ctx) {
    const { t, colors, typo, spacing, radius, shadows, breakpoints, opts } = ctx;
    const L = [];
    L.push('---');
    L.push(`name: ${yamlStr(ctx.name + ' Design System')}`);
    const srcLine = `source: ${yamlStr(opts.sourceUrl || '')}`;
    L.push(opts.observedAt ? `${srcLine}   # observed on ${opts.observedAt}` : srcLine);
    L.push(`generated_by: ${yamlStr('VibeDesign ' + (opts.version || 'dev'))}`);
    if (ctx.style) L.push(`style: ${yamlStr(ctx.style)}`);

    if (colorKeys(colors).length) {
      L.push('colors:');
      colorKeys(colors).forEach(k => L.push(`  ${k}: ${yamlStr(colors[k])}`));
    }

    const hasTypo = !isEmpty(typo.stacks) || !isEmpty(typo.scale);
    if (hasTypo) {
      L.push('typography:');
      Object.keys(typo.stacks).forEach(k => L.push(`  ${k}: ${yamlStr(typo.stacks[k])}`));
      if (!isEmpty(typo.scale)) {
        L.push('  scale:');
        SCALE_KEYS.forEach(k => { if (typo.scale[k]) L.push(`    ${k}: ${yamlStr(typo.scale[k])}`); });
      }
    }

    if (spacing) {
      L.push('spacing:');
      L.push(`  base: ${yamlStr(spacing.base)}`);
      if (spacing.scale.length) L.push(`  scale: [${spacing.scale.map(yamlStr).join(', ')}]`);
    }

    if (!isEmpty(radius)) {
      L.push('radius:');
      Object.keys(radius).forEach(k => L.push(`  ${k}: ${yamlStr(radius[k])}`));
    }

    if (shadows) {
      L.push('shadows:');
      Object.keys(shadows).forEach(k => L.push(`  ${k}: ${yamlStr(shadows[k])}`));
    }

    if (breakpoints) {
      L.push('breakpoints:');
      Object.keys(breakpoints).forEach(k => L.push(`  ${k}: ${yamlStr(breakpoints[k])}`));
    }

    L.push('---');
    return L.join('\n');
  }

  // ── prose sections ──────────────────────────────────────────────────────

  function sectionVisualDirection(ctx) {
    const { t, colors, radius, typo } = ctx;
    const vp = t.visualProfile || {};
    const s = [];
    const bg = colors.background;
    const tone = bg ? (hsl(bg).l < 50 ? 'dark' : 'light') : null;

    if (tone && bg) {
      s.push(`The interface is ${tone}-themed, built on \`${bg}\`${colors['text-primary'] ? ` with \`${colors['text-primary']}\` as the primary text color` : ''}.`);
    }
    const cr = (colors['text-primary'] && bg) ? contrast(colors['text-primary'], bg) : null;
    if (cr !== null) {
      const band = cr >= 12 ? 'a very high' : cr >= 7 ? 'a strong' : cr >= 4.5 ? 'an adequate' : 'a low';
      s.push(`Body text sits at ${band} contrast ratio of ${cr.toFixed(1)}:1 against the page background.`);
    }
    const padY = num(vp.sectionPaddingY);
    if (padY !== null) {
      s.push(`Vertical rhythm is ${padY >= 96 ? 'generous' : padY <= 48 ? 'tight' : 'moderate'}, with roughly ${Math.round(padY)}px of section padding.`);
    }
    if (ctx.shape) {
      s.push(`Shape language is angular: buttons are chamfered${ctx.shape.size ? ' by ' + ctx.shape.size : ''} with a \`clip-path\` polygon rather than a border-radius.`);
    } else {
      const r = num(radius.button || radius.card);
      if (r !== null) {
        s.push(`Shape language is ${r >= 16 ? 'soft, with heavily rounded corners' : r >= 6 ? 'gently rounded' : 'sharp and near-square'} at ${radius.button || radius.card}.`);
      }
    }
    const ambient = Array.isArray(t.ambientAnimations) ? t.ambientAnimations.length : 0;
    const frames = Array.isArray(t.animations) ? t.animations.length : 0;
    if (ambient > 0 || frames >= 4) {
      s.push(`Motion is ambient rather than incidental — ${frames} keyframe${frames === 1 ? '' : 's'}`
        + `${ambient ? ` and ${ambient} idle loop${ambient === 1 ? '' : 's'}` : ''} run without user input.`);
    }
    if (colors.primary) {
      const sat = hsl(colors.primary).s;
      s.push(`The accent \`${colors.primary}\` is ${sat >= 60 ? 'highly saturated and used sparingly for emphasis' : sat <= 15 ? 'near-neutral, keeping the palette monochrome' : 'moderately saturated'}.`);
    }
    if (s.length < 3) return null;
    return '## Visual direction\n\n' + s.slice(0, 5).join(' ');
  }

  function sectionLayout(ctx) {
    const { t } = ctx;
    const li = t.layoutInfo || {};
    const vp = t.visualProfile || {};
    const rows = [];
    const add = (k, v) => { if (v !== null && v !== undefined && v !== '') rows.push([k, v]); };

    add('Container max-width', len(li.maxWidth) || (li.maxWidth === 'none' ? 'none (full-bleed)' : null));
    const py = num(vp.sectionPaddingY), px = num(vp.sectionPaddingX);
    if (py !== null) add('Section padding (Y)', withRem(Math.round(py) + 'px'));
    if (px !== null) add('Section padding (X)', withRem(Math.round(px) + 'px'));
    add('Section rhythm', word(vp.sectionRhythm));
    add('Grid gap', len(vp.gridGap) ? withRem(vp.gridGap) : null);
    const split = int(vp.splitLayoutCount);
    if (split !== null && split > 0) add('Split (two-column) sections', String(split));
    add('Navigation', word((t.navPattern || {}).type) || word(vp.navStyle));
    if (li.hasSidebar === true) add('Sidebar', 'present');
    if (li.hasHero === true) add('Hero region', 'present');
    if (t.typographyPatterns && t.typographyPatterns.hasStickyNav === true) add('Sticky navigation', 'yes');

    const chrome = (Array.isArray(t.fixedUIChrome) ? t.fixedUIChrome : [])
      .map(c => word(c && c.role)).filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);
    if (chrome.length) add('Fixed chrome', chrome.join(', '));

    if (!rows.length) return null;
    return '## Layout\n\n' + table(['Property', 'Value'], rows);
  }

  function sectionColorUsage(ctx) {
    const { t, colors } = ctx;
    if (!colorKeys(colors).length) return null;
    const ROLE_NOTES = {
      'primary': 'Primary actions, active states, key emphasis.',
      'primary-hover': 'Hover variant of the primary action (measured, not derived).',
      'accent': 'The signature colour — hero fills, badges, icons, glows.',
      'background': 'Page canvas.',
      'surface': 'Cards and raised panels.',
      'surface-raised': 'Secondary panels, wells, hovered rows.',
      'border': 'Default dividers and control outlines.',
      'border-subtle': 'Low-emphasis separators.',
      'text-primary': 'Body and heading text.',
      'text-secondary': 'Supporting text, labels.',
      'text-muted': 'Captions, placeholders, disabled text.',
      'success': 'Positive status.',
      'warning': 'Cautionary status.',
      'error': 'Destructive actions and error status.',
    };
    const rows = colorKeys(colors).map(k => [
      `\`${k}\``, `\`${colors[k]}\``, ROLE_NOTES[k] || (/^accent-/.test(k) ? 'Secondary accent, decorative use.' : ''),
    ]);
    let out = '## Color usage\n\n' + table(['Token', 'Hex', 'Used for'], rows);

    const dark = t.darkModeTokens;
    if (dark && typeof dark === 'object') {
      const darkRows = Object.keys(dark)
        .map(k => [k, hex(dark[k])])
        .filter(r => /^[-a-z0-9]+$/i.test(r[0]) && r[1])
        .slice(0, 12)
        .map(r => [`\`${r[0]}\``, `\`${r[1]}\``]);
      if (darkRows.length) {
        out += '\n\n### Dark mode overrides\n\n' + table(['Variable', 'Hex'], darkRows);
      }
    }
    return out;
  }

  function sectionTypography(ctx) {
    const { typo } = ctx;
    if (isEmpty(typo.stacks) && isEmpty(typo.scale)) return null;
    let out = '## Typography\n';
    if (typo.families && typo.families.length) {
      out += '\n' + table(['Family', 'Used for'], typo.families.map(f => [
        '`' + f.family + '`',
        f.steps.length ? f.steps.map(k => '`' + k + '`').join(', ') : 'loaded, no measured step',
      ]));
    } else if (!isEmpty(typo.stacks)) {
      out += '\n' + table(['Role', 'Stack'],
        Object.keys(typo.stacks).map(k => [titleCase(k), '`' + typo.stacks[k] + '`']));
    }
    if (!isEmpty(typo.scale)) {
      const rows = SCALE_KEYS.filter(k => typo.scale[k]).map(k => {
        const d = (typo.detail && typo.detail[k]) || {};
        const rem = remOf(d.size);
        return [
          `\`${k}\``,
          rem ? `${d.size} (${rem})` : (d.size || '—'),
          d.weight === null || d.weight === undefined ? '—' : String(d.weight),
          d.lineHeight || '—',
          d.tracking || '—',
          d.transform || '—',
        ];
      });
      out += '\n\n### Scale\n\n'
        + table(['Step', 'Size', 'Weight', 'Line height', 'Tracking', 'Transform'], rows);
    }
    if (typo.weights && typo.weights.length) {
      out += `\n\nWeights in use: ${typo.weights.map(w => '`' + w + '`').join(', ')}.`;
    }
    out += '\n\nEach step above carries its own tracking — negative on display headings, positive on labels. Apply them together, and never substitute a family that is not listed here.';
    return out;
  }

  // ── components ──────────────────────────────────────────────────────────

  function componentRows(spec) {
    const rows = [];
    spec.forEach(([label, value]) => { if (value) rows.push([label, '`' + value + '`']); });
    return rows;
  }

  let ctxInverseButton = false;

  function buttonBlock(t) {
    const bs = t.buttonStyles || {};
    const blocks = [];
    ['primary', 'secondary', 'ghost'].forEach(variant => {
      const b = bs[variant];
      if (!b) return;
      const rows = componentRows([
        ['Background', hex(b.backgroundColor)],
        ['Text color', hex(b.color)],
        ['Padding', withRem(b.padding)],
        ['Radius', len(b.borderRadius)],
        ['Border', len(b.border) || (typeof b.border === 'string' && b.border.length < 60 ? b.border.trim() : null)],
        ['Shadow', shadow(b.boxShadow)],
        ['Font size', withRem(b.fontSize)],
        ['Font weight', int(b.fontWeight) === null ? null : String(int(b.fontWeight))],
        ['Letter spacing', len(b.letterSpacing)],
        ['Text transform', word(b.textTransform)],
        ['Height', len(b.height)],
        ['Transition', timing(b.transition)],
      ]);
      if (rows.length) blocks.push(`#### ${titleCase(variant)}\n\n` + table(['Property', 'Value'], rows));
    });
    if (!blocks.length) return null;
    let head = '### Buttons\n\n';
    const shape = deriveShape(t);
    if (shape) {
      head += `**Shape** — chamfered corners${shape.size ? ', ' + shape.size : ''}, cut with `
        + `\`clip-path: ${shape.clipPath}\`. Border-radius is \`0\`; the corner treatment is the clip-path, `
        + 'so an agent must reproduce the polygon rather than rounding the corners.\n\n';
    }
    // An inverse button paints itself in the page background colour.
    if (ctxInverseButton) {
      head += '**Inverse fill** — the primary button is painted in the page background '
        + 'colour with inverted text, rather than in the accent. Reproduce it as an inverse '
        + 'button, not as a filled accent button.\n\n';
    }
    return head + blocks.join('\n\n');
  }

  function simpleBlock(title, obj, spec) {
    if (!obj) return null;
    const rows = componentRows(spec(obj));
    if (!rows.length) return null;
    return `### ${title}\n\n` + table(['Property', 'Value'], rows);
  }

  function sectionComponents(ctx) {
    const { t } = ctx;
    const parts = [];
    const push = b => { if (b) parts.push(b); };

    push(buttonBlock(t));
    push(simpleBlock('Cards', t.cardStyles, c => [
      ['Background', hex(c.backgroundColor)],
      ['Padding', withRem(c.padding)],
      ['Radius', len(c.borderRadius)],
      ['Border', len(c.border) || (typeof c.border === 'string' && c.border.length < 60 ? c.border.trim() : null)],
      ['Shadow', shadow(c.boxShadow)],
      ['Shadow type', word(c.shadowType)],
      ['Inner gap', withRem(c.gap)],
    ]));
    push(simpleBlock('Inputs', t.inputStyles, i => [
      ['Background', hex(i.backgroundColor)],
      ['Text color', hex(i.color)],
      ['Padding', withRem(i.padding)],
      ['Radius', len(i.borderRadius)],
      ['Border', len(i.border) || (typeof i.border === 'string' && i.border.length < 60 ? i.border.trim() : null)],
      ['Font size', withRem(i.fontSize)],
      ['Height', len(i.height)],
    ]));
    const nav = t.navPattern || {};
    push(simpleBlock('Navigation', Object.keys(nav).length ? nav : null, n => [
      ['Pattern', word(n.type)],
      ['Style', word((t.visualProfile || {}).navStyle)],
      ['Hamburger', n.hasHamburger === true ? 'yes' : null],
      ['Visible links', n.hasVisibleLinks === true ? 'yes' : null],
      ['Sticky', (t.typographyPatterns || {}).hasStickyNav === true ? 'yes' : null],
    ]));
    push(simpleBlock('Badges', t.badgeStyles, b => [
      ['Background', hex(b.backgroundColor)],
      ['Text color', hex(b.color)],
      ['Padding', withRem(b.padding)],
      ['Radius', len(b.borderRadius)],
      ['Font size', withRem(b.fontSize)],
      ['Font weight', int(b.fontWeight) === null ? null : String(int(b.fontWeight))],
    ]));
    push(simpleBlock('Links', t.linkStyles, l => [
      ['Color', hex(l.color)],
      ['Decoration', word(l.textDecoration)],
      ['Underline offset', len(l.textUnderlineOffset)],
      ['Font weight', int(l.fontWeight) === null ? null : String(int(l.fontWeight))],
    ]));
    push(simpleBlock('Footer', t.footerStyles, f => [
      ['Background', hex(f.backgroundColor)],
      ['Text color', hex(f.color)],
      ['Padding', withRem(f.padding)],
      ['Columns', int(f.columns) === null ? null : String(int(f.columns))],
      ['Gap', withRem(f.gap)],
      ['Top border', len(f.borderTop) || (typeof f.borderTop === 'string' && f.borderTop.length < 60 ? f.borderTop.trim() : null)],
    ]));

    if (!parts.length) return null;
    return '## Components\n\n' + parts.join('\n\n');
  }

  function sectionIconography(ctx) {
    const { t } = ctx;
    const ico = t.iconographySystem || {};
    const rows = [];
    const add = (k, v) => { if (v) rows.push([k, v]); };
    add('Icon style', word(ico.style));
    const sizes = (Array.isArray(ico.dominantSizes) ? ico.dominantSizes : []).map(int).filter(v => v !== null);
    if (sizes.length) add('Common sizes', sizes.slice(0, 4).map(s => s + 'px').join(', '));
    const sw = (Array.isArray(ico.strokeWidths) ? ico.strokeWidths : []).map(num).filter(v => v !== null);
    if (sw.length) add('Stroke widths', sw.slice(0, 3).join(', '));
    if (ico.hasGradients === true) add('Gradient icons', 'yes');
    if (ico.hasAnimations === true) add('Animated icons', 'yes');

    const vp = t.visualProfile || {};
    add('Image treatment', word(vp.imageTreatment));
    if (vp.hasFullBleedImages === true) add('Full-bleed imagery', 'yes');
    // These three flags are heuristic and fire on thin evidence. Emit only
    // when a second, independent signal agrees — otherwise a document asserts
    // a design decision the site never made.
    const blob = JSON.stringify(t.filterEffects || {}) + JSON.stringify(t.cssVars || {});
    if (vp.hasGlassmorphism === true && /backdrop-filter|backdropFilter|blur\(/i.test(blob)) {
      add('Glassmorphism', 'yes (backdrop-filter confirmed)');
    }
    const noiseCorroborated = !isEmpty(t.subtleTextures)
      || /feturbulence|noise/i.test(JSON.stringify(t.sectionBackgroundDecorations || ''));
    if (vp.hasNoiseTexture === true && noiseCorroborated) add('Noise texture', 'yes');
    if (word(vp.gradientStyle) && !isEmpty(t.gradients)) add('Gradient style', word(vp.gradientStyle));
    const ill = t.illustrationStyle;
    if (ill && word(ill.style)) add('Illustration style', word(ill.style));
    const ratios = (Array.isArray(t.cssAspectRatios) ? t.cssAspectRatios : [])
      .filter(r => typeof r === 'string' && /^[0-9]+ *\/ *[0-9]+$/.test(r.trim())).slice(0, 4);
    if (ratios.length) add('Aspect ratios', ratios.map(r => '`' + r.trim() + '`').join(', '));

    if (!rows.length) return null;
    return '## Iconography & imagery\n\n' + table(['Property', 'Value'], rows)
      + '\n\nUse icons at the sizes and stroke weights above. Do not mix icon families.';
  }

  function sectionSpacing(ctx) {
    const { spacing, breakpoints } = ctx;
    if (!spacing) return null;
    let out = '## Spacing rules\n\n';
    out += `All spacing is a multiple of the **${spacing.base}** base unit`;
    out += spacing.conformRate !== null ? ` (${spacing.conformRate}% of observed values conform).\n` : '.\n';
    if (spacing.scale.length) {
      out += '\n' + table(['Step', 'px', 'rem'],
        spacing.scale.map(v => [`\`${v}\``, v, remOf(v) || '—']));
    }
    if (breakpoints) {
      out += '\n\n### Breakpoints\n\n' + table(['Name', 'Min width'],
        Object.keys(breakpoints).map(k => [`\`${k}\``, breakpoints[k]]));
    }
    return out;
  }

  // ── do / don't / agent instructions ─────────────────────────────────────

  function sectionDo(ctx) {
    const { colors, spacing, radius, typo } = ctx;
    const items = [];
    if (!isEmpty(colors)) items.push(`Use only the ${Object.keys(colors).length} tokens in \`colors\` — reference them by role, not by hex literal.`);
    if (spacing) items.push(`Snap every margin, padding and gap to the ${spacing.base} spacing scale.`);
    if (!isEmpty(typo.scale)) items.push('Use the type scale exactly as listed; derive nothing between steps.');
    if (!isEmpty(radius)) items.push('Apply the per-component radius values — buttons, cards and inputs differ deliberately.');
    items.push('Keep body text at or above a 4.5:1 contrast ratio against its background.');
    items.push('Reuse the component values verbatim; they are measured from the live page, not approximated.');
    if (!items.length) return null;
    return '## Do\n\n' + items.map(i => '- ' + i).join('\n');
  }

  function sectionDont(ctx) {
    const { colors, radius } = ctx;
    const items = [
      'Do not invent colors, tints or shades that are not in this document.',
      'Do not introduce new fonts, weights or sizes outside the scale.',
      'Do not use arbitrary spacing values such as `13px` or `27px`.',
    ];
    if (!isEmpty(radius)) items.push('Do not apply a single global border-radius to every element.');
    // Only ever aimed at an accent — never at the page background, which is
    // by definition the largest fill on the page.
    const fillWarn = [colors.accent, colors.primary]
      .find(c => c && c !== colors.background && hsl(c).s >= 25);
    if (fillWarn) items.push(`Do not use \`${fillWarn}\` for large background fills — it is an accent.`);
    items.push('Do not copy layout or wording from the source site; this document describes style only.');
    return "## Don't\n\n" + items.map(i => '- ' + i).join('\n');
  }

  function sectionAgentInstructions(ctx) {
    const { colors, spacing, typo, tier } = ctx;
    const lines = [];
    lines.push('Use only the tokens defined in the frontmatter of this file.');
    lines.push('Never invent a color; if a shade is missing, reuse the closest listed token.');
    if (spacing) lines.push(`Respect the ${spacing.base} spacing scale for every dimension you set.`);
    if (!isEmpty(typo.scale)) lines.push('Match the type scale exactly — size, weight and line-height together.');
    lines.push('Reproduce component values (padding, radius, border, shadow) verbatim from the Components section.');
    if (tier === 'pro') lines.push('Reproduce the documented motion timings and interaction states rather than defaults.');
    lines.push('Verify text/background contrast meets 4.5:1 before shipping any pairing not listed here.');
    lines.push('Generate original copy and layout — this document supplies visual style only.');
    return '## Agent instructions\n\n' + lines.slice(0, 8).map(l => '- ' + l).join('\n');
  }

  // ── PRO sections ────────────────────────────────────────────────────────

  // Parses a keyframe body ("0% { transform: translate(0px); opacity: 1; }")
  // into a declaration map.
  function keyframeDecls(frame) {
    const out = {};
    if (typeof frame !== 'string') return out;
    const open = frame.indexOf('{');
    const body = open === -1 ? frame : frame.slice(open + 1).replace(/\}\s*$/, '');
    body.split(';').forEach(d => {
      const i = d.indexOf(':');
      if (i === -1) return;
      const k = d.slice(0, i).trim().toLowerCase();
      const v = d.slice(i + 1).trim();
      if (k && v && k.length < 30 && v.length < 90) out[k] = v;
    });
    return out;
  }

  function fnArg(value, fn) {
    const m = String(value).match(new RegExp(fn + '\\(([^)]*)\\)', 'i'));
    return m ? m[1].trim() : null;
  }

  // Describes what a keyframe actually does, derived from the from/to diff —
  // never from its name, which may be arbitrary.
  function keyframeEffect(from, to) {
    const a = keyframeDecls(from), b = keyframeDecls(to);
    const keys = Object.keys(Object.assign({}, a, b)).sort();
    const bits = [];
    keys.forEach(k => {
      const av = a[k], bv = b[k];
      if (av === bv || (av === undefined && bv === undefined)) return;
      if (k === 'transform') {
        ['translate', 'translatex', 'translatey', 'scale', 'rotate'].forEach(fn => {
          const x = fnArg(av, fn), y = fnArg(bv, fn);
          if (x !== null && y !== null && x !== y) bits.push(`${fn.replace('translatex', 'translateX').replace('translatey', 'translateY')} ${x} → ${y}`);
          else if (x === null && y !== null) bits.push(`${fn} → ${y}`);
        });
      } else if (k === 'opacity') {
        bits.push(`opacity ${av !== undefined ? av : '—'} → ${bv !== undefined ? bv : '—'}`);
      } else if (k === 'filter') {
        const x = fnArg(av, 'blur'), y = fnArg(bv, 'blur');
        if (x || y) bits.push(`blur ${x || '0'} → ${y || '0'}`);
        else bits.push('filter change');
      } else if (k === 'clip' || k === 'clip-path') {
        bits.push('clip-rect slice (glitch)');
      } else if (k === 'text-shadow') {
        bits.push('text-shadow shift');
      } else if (k === 'background-position') {
        bits.push('background pans');
      }
    });
    if (!bits.length) return null;
    let outStr = bits.slice(0, 3).join(', ');
    // Translating a track to exactly -50%/-100% is the marquee idiom: the
    // content is duplicated and the loop is seamless.
    if (/translate[XY]? 0(px)? → -(50|100)%/.test(outStr)) outStr += ' — seamless marquee loop';
    return outStr;
  }

  function sectionMotion(ctx) {
    const { t } = ctx;
    const mp = t.motionProfile || {};
    const rows = [];
    const add = (k, v) => { if (v) rows.push([k, v]); };
    add('Dominant duration', duration(mp.dominantDuration));
    add('Dominant easing', timing(mp.dominantEasing) || word(mp.dominantEasing) ||
      (typeof mp.dominantEasing === 'string' && /^[a-z0-9 ,.()%-]{1,60}$/i.test(mp.dominantEasing.trim()) ? mp.dominantEasing.trim() : null));
    add('Timing personality', word(mp.timingPersonality));
    add('Reveal style', word(mp.revealStyle));
    add('Scroll paradigm', word(mp.scrollParadigm));
    if (mp.staggerPattern) {
      const sp = mp.staggerPattern;
      const delay = num(sp.delayBetween);
      const count = int(sp.elementCount);
      if (delay !== null) add('Stagger delay', delay + 'ms');
      if (count !== null) add('Staggered elements', String(count));
    }

    const libs = (Array.isArray(t.animationLibraries) ? t.animationLibraries : [])
      .map(word).filter(Boolean);
    if (libs.length) add('Animation libraries', libs.join(', '));

    // Dedupe: "ease, ease" and repeated identical transitions are noise.
    const trans = (Array.isArray(t.transitions) ? t.transitions : [])
      .map(v => typeof v === 'string'
        ? v.trim().replace(/\s+/g, ' ').replace(/\b(\w[\w-]*)(, \1\b)+/g, '$1')
        : v)
      .map(timing).filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 6);

    let out = '## Motion\n\n';
    if (rows.length) out += table(['Property', 'Value'], rows) + '\n\n';

    // Every keyframe, with the effect derived from its own from/to.
    const frames = (Array.isArray(t.animations) ? t.animations : [])
      .map(a => {
        const name = a && typeof a.name === 'string' && a.name.length < 40 ? a.name : null;
        if (!name) return null;
        return { name: name, effect: keyframeEffect(a.from, a.to) };
      })
      .filter(Boolean)
      .filter((f, i, arr) => arr.findIndex(x => x.name === f.name) === i);
    if (frames.length) {
      out += '### Keyframes\n\n' + table(['Name', 'Effect'],
        frames.map(f => ['`' + f.name + '`', f.effect || 'declared, no measurable delta'])) + '\n\n';
    }

    // Ambient (idle, looping) animations with their durations.
    const ambient = (Array.isArray(t.ambientAnimations) ? t.ambientAnimations : [])
      .map(a => {
        if (!a || typeof a !== 'object') return null;
        const nm = word(a.name) || word(a.animationName);
        const dur = duration(a.duration) || timing(a.duration);
        const it = word(a.timingFunction) || word(a.easing);
        const cnt = word(a.iterationCount);
        if (!nm) return null;
        return [ '`' + nm + '`', dur || '—', it || '—', cnt || '—' ];
      }).filter(Boolean);
    if (ambient.length) {
      out += '### Ambient loops\n\n'
        + table(['Animation', 'Duration', 'Easing', 'Iterations'], ambient) + '\n\n';
    }

    if (trans.length) {
      out += '### Transitions in use\n\n' + trans.map(v => '- `' + v + '`').join('\n') + '\n\n';
    }

    // Hero entrance, as an ordered list.
    const hero = t.heroEntranceSequence;
    if (hero && Array.isArray(hero.elements) && hero.elements.length) {
      const steps = hero.elements.map(e => {
        const tag = word(e && e.tag);
        const d = num(e && e.delay);
        const dur = num(e && e.duration);
        if (!tag) return null;
        const bits = [`\`${tag}\``];
        if (d !== null) bits.push(`delay ${d}ms`);
        if (dur !== null) bits.push(`duration ${dur}ms`);
        return bits.join(' — ');
      }).filter(Boolean);
      if (steps.length) {
        out += '### Hero entrance sequence\n\n' + steps.map((s, i) => `${i + 1}. ${s}`).join('\n') + '\n\n';
      }
    }

    const rive = t.riveAndLottie;
    if (rive && int(rive.totalCount)) {
      const bits = [`${int(rive.totalCount)} vector animation(s)`];
      if (word(rive.type)) bits.push(`type \`${word(rive.type)}\``);
      if (rive.loop === true) bits.push('looping');
      if (rive.autoplay === true) bits.push('autoplay');
      out += '### Vector animation\n\n' + bits.join(', ') + '.\n\n';
    }

    const trimmed = out.trim();
    return trimmed === '## Motion' ? null : trimmed;
  }

  function sectionInteractionStates(ctx) {
    const { t } = ctx;
    // NOTE: tokens.interactiveStates holds tab-panel copy, not CSS state
    // diffs, so it is deliberately not read here. hoverStates carries the
    // actual computed property deltas.
    const hovers = (Array.isArray(t.hoverStates) ? t.hoverStates : []).slice(0, 8);
    const rows = [];
    hovers.forEach(h => {
      if (!h || typeof h !== 'object') return;
      const target = componentForSelector(h.selector);
      const diffs = [];
      [['background', h.backgroundColor], ['color', h.color], ['border-color', h.borderColor],
       ['transform', h.transform], ['box-shadow', h.boxShadow], ['opacity', h.opacity]]
        .forEach(([prop, raw]) => {
          const v = hex(raw) || len(raw) || shadow(raw) ||
            (typeof raw === 'string' && /^[a-z0-9 ().,%-]{1,40}$/i.test(raw.trim()) ? raw.trim() : null) ||
            (typeof raw === 'number' ? String(raw) : null);
          if (v && v !== 'none') diffs.push(`${prop}: \`${v}\``);
        });
      if (diffs.length) rows.push([target, 'hover', diffs.join('<br>')]);
    });

    const btnTrans = timing(((t.buttonStyles || {}).primary || {}).transition);
    let out = '## Interaction states\n\n';
    if (rows.length) {
      // Group by component so a reader sees all of a button's states together.
      const order = [];
      const grouped = {};
      rows.forEach(r => {
        if (!grouped[r[0]]) { grouped[r[0]] = []; order.push(r[0]); }
        grouped[r[0]].push(r);
      });
      out += '### Measured\n\nObserved on the live page.\n\n'
        + table(['Component', 'State', 'Change'],
            order.sort().reduce((acc, k) => acc.concat(grouped[k]), [])) + '\n\n';
      if (btnTrans) out += `Buttons transition with \`${btnTrans}\`.\n\n`;
    }

    // Recommendations are clearly fenced off from measurements, and only
    // offered for states the extraction genuinely has no data for.
    const measuredStates = new Set(rows.map(r => r[1]));
    const RECS = [
      ['focus', 'Render a visible focus ring on every interactive element — 2px, offset 2px, using `primary` or `border`.'],
      ['active', 'Apply a small positional shift or a darker fill; never remove the focus ring.'],
      ['disabled', 'Reduce opacity to ~0.5 and remove hover/active feedback entirely.'],
    ].filter(([st]) => !measuredStates.has(st));
    if (RECS.length) {
      out += '### Recommended (not observed)\n\n'
        + 'The extraction found no measurements for these states. Treat as defaults, not as facts about the source.\n\n'
        + RECS.map(([st, txt]) => `- **${st}** — ${txt}`).join('\n');
    }
    return out.trim();
  }

  function componentForSelector(sel) {
    if (typeof sel !== 'string') return 'element';
    const s = sel.toLowerCase();
    if (/btn|button/.test(s)) return 'Button';
    if (/card/.test(s)) return 'Card';
    if (/nav|header/.test(s)) return 'Navigation';
    if (/input|field|form/.test(s)) return 'Input';
    if (/badge|tag|chip|pill/.test(s)) return 'Badge';
    if (/^a\b|link/.test(s)) return 'Link';
    if (/footer/.test(s)) return 'Footer';
    return 'Element';
  }

  function sectionComponentAnatomy(ctx) {
    const { t } = ctx;
    const parts = [];

    const tabs = (Array.isArray(t.tabbedComponents) ? t.tabbedComponents : []);
    if (tabs.length) {
      const rows = tabs.map(tb => [
        word(tb && tb.type) || 'panel',
        int(tb && tb.bulletCount) === null ? '—' : String(int(tb.bulletCount)),
        tb && tb.hasTestimonial === true ? 'yes' : 'no',
        word(tb && tb.layout) || '—',
      ]).filter(r => r[0]);
      if (rows.length) parts.push('### Tabbed content\n\n' + table(['Type', 'Bullets', 'Testimonial', 'Layout'], rows));
    }

    const chrome = (Array.isArray(t.fixedUIChrome) ? t.fixedUIChrome : []);
    if (chrome.length) {
      const rows = chrome.map(c => [
        word(c && c.role) || null,
        int(c && c.height) === null ? '—' : int(c.height) + 'px',
        hex(c && c.bg) ? '`' + hex(c.bg) + '`' : '—',
        c && c.hasButton === true ? 'yes' : 'no',
      ]).filter(r => r[0]);
      if (rows.length) parts.push('### Fixed chrome\n\n' + table(['Role', 'Height', 'Background', 'Has action'], rows));
    }

    const sticky = t.stickySections;
    if (sticky && typeof sticky === 'object') {
      const rows = [];
      if (word(sticky.type)) rows.push(['Type', word(sticky.type)]);
      if (int(sticky.scrollBlockCount) !== null) rows.push(['Scroll blocks', String(int(sticky.scrollBlockCount))]);
      const STICKY_LABELS = {
        stickyColHasImg: 'Sticky column: image',
        stickyColHasSvg: 'Sticky column: SVG',
        stickyColHasCanvas: 'Sticky column: canvas',
      };
      Object.keys(STICKY_LABELS).forEach(k => {
        if (sticky[k] === true) rows.push([STICKY_LABELS[k], 'yes']);
      });
      if (rows.length) parts.push('### Sticky scroll sections\n\n' + table(['Property', 'Value'], rows));
    }

    const grid = t.caseGridPattern;
    if (grid && typeof grid === 'object') {
      const rows = [];
      if (int(grid.columns) !== null) rows.push(['Columns', String(int(grid.columns))]);
      if (int(grid.entryCount) !== null) rows.push(['Entries', String(int(grid.entryCount))]);
      if (len(grid.gap)) rows.push(['Gap', withRem(grid.gap)]);
      if (len(grid.thumbnailRadius)) rows.push(['Thumbnail radius', len(grid.thumbnailRadius)]);
      if (grid.hasThumbnail === true) rows.push(['Thumbnail', 'yes']);
      if (grid.hasTags === true) rows.push(['Tags', 'yes']);
      if (rows.length) parts.push('### Case/work grid\n\n' + table(['Property', 'Value'], rows));
    }

    if (!parts.length) return null;
    return '## Component anatomy\n\n' + parts.join('\n\n');
  }

  function sectionAccessibility(ctx) {
    const { colors } = ctx;
    const bg = colors.background;
    if (!bg) return null;
    const PAIRS = [
      ['text-primary', 'background'], ['text-secondary', 'background'], ['text-muted', 'background'],
      ['text-primary', 'surface'], ['primary', 'background'],
    ];
    const rows = [];
    PAIRS.forEach(([fgKey, bgKey]) => {
      const fg = colors[fgKey], b = colors[bgKey];
      if (!fg || !b) return;
      const cr = contrast(fg, b);
      if (cr === null) return;
      const ratio = cr.toFixed(2) + ':1';
      const verdict = cr >= 7 ? 'AAA' : cr >= 4.5 ? 'AA' : cr >= 3 ? '**AA large text only**' : '**fails**';
      rows.push([`\`${fgKey}\` on \`${bgKey}\``, ratio, verdict]);
    });
    if (!rows.length) return null;
    const failing = rows.filter(r => /fails|large text only/.test(r[2]));
    let out = '## Accessibility notes\n\n' + table(['Pair', 'Ratio', 'WCAG 2.1'], rows);
    if (failing.length) {
      out += `\n\n⚠️ ${failing.length} pairing${failing.length > 1 ? 's fall' : ' falls'} below the 4.5:1 minimum for body text. `
        + 'Darken the foreground or lighten the background before using these together at normal size.';
    } else {
      out += '\n\nAll documented text pairings meet the 4.5:1 minimum for body text.';
    }
    return out;
  }

  // ── markdown table ──────────────────────────────────────────────────────

  function table(headers, rows) {
    const esc = v => String(v === null || v === undefined ? '—' : v).replace(/\|/g, '\\|');
    const out = [
      '| ' + headers.map(esc).join(' | ') + ' |',
      '|' + headers.map(() => '---').join('|') + '|',
    ];
    rows.forEach(r => out.push('| ' + r.map(esc).join(' | ') + ' |'));
    return out.join('\n');
  }

  // ── assembly ────────────────────────────────────────────────────────────

  function buildContext(tokens, opts) {
    const t = tokens && typeof tokens === 'object' ? tokens : {};
    const colors = deriveColors(t);
    const typo = deriveTypography(t);
    const spacing = deriveSpacing(t);
    const radius = deriveRadius(t);
    const shadows = deriveShadows(t, colors.accent || colors.primary);
    const breakpoints = deriveBreakpoints(t);
    const shape = deriveShape(t);
    const name = siteName(opts.sourceUrl || t.url || '');
    const style = characterize(t, colors, spacing, radius, shape);
    return { t, colors, typo, spacing, radius, shadows, breakpoints, shape, name, style, opts, tier: opts.tier };
  }

  function buildDesignMd(tokens, options) {
    const opts = Object.assign(
      { tier: 'free', sourceUrl: '', scope: 'page', version: 'dev', observedAt: null },
      options || {}
    );
    if (opts.tier !== 'pro') opts.tier = 'free';
    if (opts.scope !== 'component') opts.scope = 'page';
    if (!opts.sourceUrl && tokens && typeof tokens.url === 'string') opts.sourceUrl = tokens.url;

    const ctx = buildContext(tokens, opts);
    ctxInverseButton = !!(ctx.colors._meta && ctx.colors._meta.inverseButton);
    const parts = [buildFrontmatter(ctx)];

    if (opts.scope === 'component') {
      // Short "component card": frontmatter + the component values + states.
      parts.push(`# ${ctx.name} — Component`);
      const comp = sectionComponents(ctx);
      if (comp) parts.push(comp);
      if (opts.tier === 'pro') {
        const st = sectionInteractionStates(ctx);
        if (st) parts.push(st);
      } else {
        parts.push(FREE_FOOTER);
      }
      return parts.filter(Boolean).join('\n\n') + '\n';
    }

    parts.push(`# ${ctx.name} Design System`);
    parts.push(sectionVisualDirection(ctx));
    parts.push(sectionLayout(ctx));
    parts.push(sectionColorUsage(ctx));
    parts.push(sectionTypography(ctx));
    parts.push(sectionComponents(ctx));
    parts.push(sectionIconography(ctx));
    parts.push(sectionSpacing(ctx));
    parts.push(sectionDo(ctx));
    parts.push(sectionDont(ctx));
    parts.push(sectionAgentInstructions(ctx));

    if (opts.tier === 'pro') {
      parts.push(sectionMotion(ctx));
      parts.push(sectionInteractionStates(ctx));
      parts.push(sectionComponentAnatomy(ctx));
      parts.push(sectionAccessibility(ctx));
    } else {
      parts.push(FREE_FOOTER);
    }

    return parts.filter(Boolean).join('\n\n') + '\n';
  }

  return {
    buildDesignMd,
    // exposed for tests
    _siteName: siteName,
    _deriveColors: deriveColors,
    _accessors: { hex, len, num, int, word, shadow, fontStack, timing, duration },
    _FREE_FOOTER: FREE_FOOTER,
  };
})();

if (typeof self !== 'undefined') {
  self.VD_DESIGN_MD = VD_DESIGN_MD;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VD_DESIGN_MD;
}

// VibeDesign — the single design model (v3.0)
//
// One normalised description of a site's design, derived once from a raw token
// capture. Every consumer reads THIS — the DESIGN.md renderer, the W3C token
// export, the skill bundle — so a colour cannot come out one way in
// DESIGN.md and another way in tokens.json.
//
//   buildDesignModel(rawTokens, { sourceUrl }) → model
//
// The derivation logic here was lifted verbatim from lib/design-md-builder.js,
// which had grown into a renderer and a deriver in one file. The renderer now
// consumes this instead. Because the logic moved rather than being rewritten,
// the DESIGN.md snapshots are unchanged by the extraction — that is the check
// that proves it was a move and not a rewrite.
//
// Plain globals so the same file works via <script> tag and via require() in
// Node. No ESM, no build step.

const VD_MODEL = (() => {
  'use strict';

  const CU = (() => {
    if (typeof module !== 'undefined' && module.exports) {
      try { return require('./color-utils.js'); } catch (e) { /* fall through */ }
    }
    return (typeof self !== 'undefined') ? self : globalThis;
  })();

  // ── lifted derivation core ───────────────────────────────────────────────
  const ONE_LEN = '(-?[0-9.]+(px|rem|em|%|vh|vw|ch|fr)|0|auto|none)';

  const LEN_RE = new RegExp('^' + ONE_LEN + '( +' + ONE_LEN + '){0,3}$');

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
    // Layered elevation stacks are legitimately long — shadcn's default is a
    // six-layer stack at ~290 characters. The cap exists to reject prose, not
    // to reject real design tokens.
    if (!t || t.length > 400 || t === 'none') return null;
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

  function isEmpty(o) {
    if (o === null || o === undefined) return true;
    if (Array.isArray(o)) return o.length === 0;
    if (typeof o === 'object') return Object.keys(o).length === 0;
    return false;
  }

  // Colour roles are emitted in this order; `_`-prefixed keys are internal.
  function colorKeys(colors) {
    return Object.keys(colors || {}).filter(k => k.charAt(0) !== '_');
  }

  function hsl(h) { return CU._hexHSL ? CU._hexHSL(h) : { h: 0, s: 0, l: 50 }; }

  function contrast(a, b) { return CU.wcagContrast ? CU.wcagContrast(a, b) : null; }

  function lum(h) { return CU.wcagLuminance ? CU.wcagLuminance(h) : 0.5; }

  // Rewrites every var(--x) inside a composite value (a shadow, a border) to
  // the resolved hex. A custom property the capture never recorded is reduced
  // to its bare name, so `var(` can never survive into the document.
  function resolveInString(value, resolve) {
    if (typeof value !== 'string') return null;
    let out = value.replace(/var\(\s*(--[a-z0-9-_]+)\s*(?:,[^)]*)?\)/gi, (m, name) => {
      const r = resolve(m);
      return r || (name + ' (not captured)');
    });
    // Bare colour functions inside a composite value (a shadow's colour) must
    // resolve too, or an oklch()/rgba() leaks into the document.
    out = out.replace(/(oklch|rgba?|hsla?|lab|lch)\(([^()]|\([^()]*\))*\)/gi,
      m => resolve(m) || m);
    return out;
  }

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
    if (counts[0][1] <= 0) return null;
    // A clear margin is required. White on a Tailwind site scores 242 border
    // and 235 text; a 3% edge is measurement noise, not a role, and treating
    // it as one made white the "border colour" of a page whose borders are
    // grey.
    if (counts[1][1] > 0 && counts[0][1] < counts[1][1] * 1.4) return null;
    return counts[0][0];
  }

  // Text is claimed on a plain majority: a colour used 450 times for text and
  // 442 for borders IS the text colour, and requiring a decisive lead there
  // discarded the real body colour in favour of a rarely-used pure black.
  function isTextColor(usage, h) {
    const u = usage && usage[h];
    if (!u) return false;
    const tx = int(u.text) || 0;
    return tx > 0 && tx >= (int(u.bg) || 0) && tx >= (int(u.border) || 0);
  }

  // Ranks colors by how often the page uses them in a given role.
  function byUsage(usage, role) {
    return Object.keys(usage || {})
      .map(k => ({ hex: hex(k), n: int(usage[k] && usage[k][role]) || 0 }))
      .filter(x => x.hex && x.n > 0)
      .sort((a, b) => (b.n - a.n) || a.hex.localeCompare(b.hex)); // tie-break = deterministic
  }

  const STATUS_HUES = [
    { key: 'success', min: 90, max: 165 },
    { key: 'warning', min: 25, max: 60 },
    { key: 'error', min: 340, max: 20 },   // wraps
  ];

  // Alpha/var-aware colour read, bound to a page background.
  function makeResolver(t, backgroundHex) {
    const vars = t.cssVars || {};
    const toHex = p => '#' + [p.r, p.g, p.b]
      .map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

    // Sites routinely reference --red / --paper while the capture only holds
    // their alpha variants (--red-glow, --paper-70). The base colour is
    // recoverable from any variant by forcing alpha to 1 — that is derivation
    // from captured data, not a guess.
    const baseFromVariants = name => {
      const prefix = name + '-';
      const sibling = Object.keys(vars).sort().find(k => k.indexOf(prefix) === 0);
      if (!sibling) return null;
      const parsed = CU.parseCssColor ? CU.parseCssColor(String(vars[sibling]).trim()) : null;
      return parsed ? toHex(parsed) : null;
    };

    return function resolve(v) {
      if (v === null || v === undefined) return null;
      const direct = hex(v);
      if (direct) return direct;
      const str = String(v).trim();
      const out = CU.resolveColor ? CU.resolveColor(str, vars, backgroundHex) : null;
      if (hex(out)) return hex(out);
      const m = str.match(/^var\(\s*(--[a-z0-9-_]+)\s*\)$/i);
      if (m && vars[m[1]] === undefined) return hex(baseFromVariants(m[1]));
      return null;
    };
  }

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
      .filter(c => isTextColor(usage, c.hex))
      .map(c => resolve(c.hex)).filter(Boolean);
    [tp.body && tp.body.color, tp.h1 && tp.h1.color].forEach(c => {
      const r = resolve(c);
      if (r && textCandidates.indexOf(r) === -1) textCandidates.push(r);
    });
    if (bg) {
      textCandidates = textCandidates.filter(c => (isDark ? lum(c) > lum(bg) : lum(c) < lum(bg)));
      // Rank by how much text is actually set in each colour, with contrast as
      // the tie-break. Ranking by contrast alone chose pure black (104 uses)
      // over the slate the site actually sets its body copy in (450 uses).
      const textUse = h => { const u = usage[h]; return u ? (int(u.text) || 0) : 0; };
      textCandidates.sort((a, b) => {
        const d = textUse(b) - textUse(a);
        if (d !== 0) return d;
        const c = (contrast(b, bg) || 0) - (contrast(a, bg) || 0);
        return c !== 0 ? c : a.localeCompare(b);
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
    // Saturation is a GATE, not a weight: a near-white paper tone used 900
    // times is still not the accent. Among genuinely saturated colours that
    // are neither the background nor a text tone, the most-used one wins.
    const nearlySame = (a, b) => {
      const x = CU.parseCssColor && CU.parseCssColor(a), y = CU.parseCssColor && CU.parseCssColor(b);
      return !!(x && y && Math.abs(x.r - y.r) < 10 && Math.abs(x.g - y.g) < 10 && Math.abs(x.b - y.b) < 10);
    };
    const textish = c => Object.keys(out)
      .filter(k => /^text-/.test(k))
      .some(k => nearlySame(out[k], c));
    const accentPool = palette.filter(c =>
      !seen.has(c) && hsl(c).s >= 40 && !textish(c) && !(bg && nearlySame(bg, c)));
    accentPool.sort((a, b) => (combined(b) - combined(a)) || (hsl(b).s - hsl(a).s) || a.localeCompare(b));
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
    // sectionRhythm is an ordered array in newer captures and a bare label
    // ("consistent") in older ones. Only the array carries colours.
    const rhythmArr = Array.isArray((t.visualProfile || {}).sectionRhythm)
      ? t.visualProfile.sectionRhythm : [];
    rhythmArr.forEach(sec => {
      const c = resolve(sec && sec.bgHex);
      if (c) sectionBgs[c] = (sectionBgs[c] || 0) + 1;
    });
    const cardBg = resolve(t.cardStyles && t.cardStyles.backgroundColor);
    if (cardBg) sectionBgs[cardBg] = (sectionBgs[cardBg] || 0) + 2;
    (Array.isArray(t.hoverStates) ? t.hoverStates : []).forEach(h => {
      const c = resolve(h && h.before && h.before.background);
      if (c) sectionBgs[c] = (sectionBgs[c] || 0) + 1;
    });
    // The page background is not a surface, however often it recurs.
    if (bg) delete sectionBgs[bg];
    byUsage(usage, 'bg').filter(c => dominantRole(usage, c.hex) === 'bg')
      .forEach(c => { const r = resolve(c.hex); if (r) sectionBgs[r] = (sectionBgs[r] || 0) + c.n; });
    // A surface sits behind content, so it stays close to the page in tone. A
    // vivid teal used as a decorative fill is not a surface however often it
    // appears as a background. Chroma, not HSL saturation: a near-white tint
    // reports 56% saturation while being visually grey; channel spread does
    // not have that flaw.
    const chromaOf = c => {
      const p = CU.parseCssColor ? CU.parseCssColor(c) : null;
      return p ? Math.max(p.r, p.g, p.b) - Math.min(p.r, p.g, p.b) : 0;
    };
    const looksLikeSurface = c => chromaOf(c) <= 40;

    // Named surface custom properties beat usage counts. shadcn/ui sites
    // declare --card / --secondary / --muted explicitly, as bare HSL triplets.
    const varsAll = t.cssVars || {};
    const namedSurface = names => {
      for (let i = 0; i < names.length; i++) {
        const v = resolve(varsAll[names[i]]);
        if (v && !seen.has(v) && v !== bg) return v;
      }
      return null;
    };

    const surfaces = Object.keys(sectionBgs)
      .filter(c => !seen.has(c) && sectionBgs[c] > 1)   // never a colour used once
      .filter(looksLikeSurface)
      .sort((a, b) => (sectionBgs[b] - sectionBgs[a]) || a.localeCompare(b));
    take('surface', namedSurface(['--card', '--surface', '--surface-elevated']) || surfaces[0]);
    take('surface-raised',
      namedSurface(['--secondary', '--muted', '--surface-inset']) || surfaces.find(c => !seen.has(c)));

    // ── borders ───────────────────────────────────────────────────────────
    // Named --border* custom properties are the authoritative signal. Usage
    // counts are not: on a site where the accent outlines badges and icons it
    // out-counts the real divider colour, and red is not a border colour.
    const vars = t.cssVars || {};
    const varBorders = Object.keys(vars).sort()
      .filter(k => /(^|-)border(-|$)/.test(k))
      .map(k => resolve(vars[k])).filter(Boolean);
    const borderRanked = byUsage(usage, 'border')
      .filter(c => dominantRole(usage, c.hex) === 'border')
      .map(c => resolve(c.hex)).filter(Boolean)
      .filter(c => c !== out.accent && hsl(c).s < 40);
    const borderQueue = varBorders.concat(borderRanked);
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
      if (textish(c) || (bg && nearlySame(bg, c))) return;   // not a new colour
      take('accent-' + n, c);
      n += 1;
    });

    out._meta = { isDark: isDark, inverseButton: inverse, resolve: resolve };
    return out;
  }

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
    const raw = (Array.isArray(t.breakpoints) ? t.breakpoints : [])
      .filter(b => b && int(b.px) !== null);
    if (!raw.length) return null;
    // A max-width query is a desktop-first breakpoint; labelling it as a
    // min-width would invert the whole responsive strategy.
    const maxFirst = raw.filter(b => /max-width/i.test(String(b.condition || ''))).length > raw.length / 2;
    const out = {};
    raw.map(b => int(b.px)).filter((p, i, a) => a.indexOf(p) === i).sort((a, b) => a - b)
      .forEach(px => { const n = bpName(px); if (!out[n]) out[n] = px + 'px'; });
    out._direction = maxFirst ? 'max-width' : 'min-width';
    return out;
  }

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

  const FONT_HOSTS = [
    [/(^|\.)fonts\.googleapis\.com$|(^|\.)fonts\.gstatic\.com$/, 'Google Fonts'],
    [/(^|\.)use\.typekit\.net$|(^|\.)p\.typekit\.net$|(^|\.)typekit\.com$/, 'Adobe Fonts'],
    [/(^|\.)fonts\.bunny\.net$/, 'Bunny Fonts'],
  ];

  function fontAvailability(url) {
    let host = '';
    try { host = new URL(String(url)).hostname.toLowerCase(); } catch (e) { return null; }
    for (let i = 0; i < FONT_HOSTS.length; i++) {
      if (FONT_HOSTS[i][0].test(host)) return FONT_HOSTS[i][1];
    }
    return 'self-hosted (not freely available)';
  }

  const FONT_ALTERNATIVES = [
    [/pixel|arcade|8[\s-]?bit/i, 'Silkscreen or Press Start 2P'],
    [/mono|code|courier/i, 'JetBrains Mono or IBM Plex Mono'],
  ];

  function suggestAlternative(family, steps) {
    for (let i = 0; i < FONT_ALTERNATIVES.length; i++) {
      if (FONT_ALTERNATIVES[i][0].test(family)) return FONT_ALTERNATIVES[i][1];
    }
    // Otherwise classify by the role the family plays in the scale.
    const used = steps || [];
    if (used.indexOf('code') !== -1) return 'JetBrains Mono or IBM Plex Mono';
    if (used.indexOf('label') !== -1) return 'Silkscreen or Space Mono';
    if (used.some(k => /^h[1-4]$/.test(k))) return 'Inter Tight or Space Grotesk';
    return 'Instrument Sans or DM Sans';
  }

  // A component's variant, derived from what it LOOKS LIKE in its base state
  // — never from the source's class names. Printing `btn-cta` or `problem-grid`
  // leaks the source's content structure: an agent reading "problem-grid"
  // infers a section called "The Problem" and writes copy for it.
  //
  // Buttons are classified by their base fill; cards by border/fill presence.
  // Anything we cannot classify from style stays unlabelled rather than
  // falling back to the class.
  function deriveVariant(role, h, colors, resolve) {
    const base = (h && h.before) || {};
    const pick = (o, keys) => {
      for (let i = 0; i < keys.length; i++) {
        const v = o[keys[i]];
        if (v !== undefined && v !== null && v !== '' && v !== 'initial' && v !== 'none') return v;
      }
      return null;
    };
    const baseBg = resolve(pick(base, ['background', 'background-color', 'backgroundColor']));
    const hoverBorder = resolve(pick(h || {}, ['border-color', 'borderColor']));
    const hoverBg = resolve(pick(h || {}, ['background', 'background-color', 'backgroundColor']));
    const page = colors.background;
    const accent = colors.accent || colors.primary;

    if (role === 'Button') {
      if (baseBg && accent && baseBg === accent) return 'accent-fill';
      if (baseBg && page && baseBg === page) return 'inverse-fill';
      if (baseBg && page) {
        const cr = contrast(baseBg, page);
        if (cr !== null && cr < 1.6) return 'muted';
        return 'filled';
      }
      // No base state was captured. A hover that moves border-color implies a
      // visible border; a hover that only washes in a faint tint of the page
      // implies no fill. A hover to a strong colour tells us nothing about the
      // base — leave it unlabelled rather than guessing "ghost", which is a
      // positive claim that the element has no fill.
      if (hoverBorder) return 'outline';
      if (hoverBg && page) {
        const cr = contrast(hoverBg, page);
        if (cr !== null && cr < 1.6) return 'ghost';
      }
      return null;
    }
    if (role === 'Card') {
      if (hoverBorder) return 'bordered';
      if (baseBg && page && baseBg !== page) return 'tinted';
      if (baseBg) return 'filled';
      return null;
    }
    return null;   // roles that need no variant carry the role alone
  }

  // Appends A/B/C to repeated (role, variant) pairs so two distinct rules do
  // not collapse into one indistinguishable label.
  function disambiguate(rows) {
    const counts = {};
    rows.forEach(r => {
      const k = r.component + '|' + (r.variant || '');
      counts[k] = (counts[k] || 0) + 1;
    });
    const seen = {};
    rows.forEach(r => {
      const k = r.component + '|' + (r.variant || '');
      if (counts[k] < 2) return;
      seen[k] = (seen[k] || 0) + 1;
      const suffix = String.fromCharCode(64 + seen[k]);   // A, B, C…
      r.variant = r.variant ? r.variant + ' ' + suffix : suffix;
    });
    return rows;
  }

  function componentForSelector(sel) {
    if (typeof sel !== 'string') return 'element';
    const s = sel.toLowerCase();
    if (/footer/.test(s)) return 'Footer link';
    if (/faq|accordion/.test(s)) return 'FAQ / accordion';
    if (/btn|button/.test(s)) return 'Button';
    if (/card/.test(s)) return 'Card';
    if (/nav|header/.test(s)) return 'Navigation';
    if (/input|field|form/.test(s)) return 'Input';
    if (/badge|tag|chip|pill/.test(s)) return 'Badge';
    if (/prose a|(^|\s)a[:.\[]|link/.test(s)) return 'Link';
    if (/eye|illust|svg|icon/.test(s)) return 'Illustration';
    return 'Element';
  }

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
    // A frame whose value is a custom property (Tailwind's --tw-enter-*,
    // Radix's --radix-*) describes nothing we can state: the real value lives
    // elsewhere. Drop those properties rather than printing `var(--x)`.
    [a, b].forEach(obj => {
      Object.keys(obj).forEach(k => { if (/var\(/.test(obj[k])) delete obj[k]; });
    });
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

  // The hero's own fill, when it differs from the page background.
  function deriveHeroSurface(t, backgroundHex) {
    const vp = t.visualProfile || {};
    const sc0 = (Array.isArray(t.sectionContentMap) ? t.sectionContentMap : [])[0] || {};
    const rh0 = (Array.isArray(vp.sectionRhythm) ? vp.sectionRhythm : [])[0] || {};
    const base = makeResolver(t, backgroundHex || '#ffffff');
    const heroHex = base(sc0.bgColor) || base(rh0.bgHex);
    if (!heroHex || heroHex === backgroundHex) return null;
    return { hex: heroHex, resolve: makeResolver(t, heroHex), heroCta: sc0.heroCtaStyle || null };
  }

  // Was this button the hero CTA? The hero section records the CTA's own
  // geometry, so we can match rather than assume.
  function buttonMeasuredOnHero(btn, heroCta) {
    if (!btn || !heroCta) return false;
    const same = (a, b) => a !== undefined && a !== null && b !== undefined && b !== null
      && String(a).trim() === String(b).trim();
    let hits = 0;
    if (same(btn.padding, heroCta.padding)) hits += 1;
    if (same(btn.fontSize, heroCta.fontSize)) hits += 1;
    if (same(btn.fontWeight, heroCta.fontWeight)) hits += 1;
    if (num(btn.width) !== null && num(heroCta.width) !== null
        && Math.abs(num(btn.width) - num(heroCta.width)) <= 2) hits += 1;
    return hits >= 3;
  }

  // ── the model ────────────────────────────────────────────────────────────
  // A normalised, renderer-agnostic description. Every field is either a
  // measured value or absent; nothing here is invented.
  function buildDesignModel(rawTokens, options) {
    const t = (rawTokens && typeof rawTokens === 'object') ? rawTokens : {};
    const opts = Object.assign({ sourceUrl: '' }, options || {});
    const sourceUrl = opts.sourceUrl || t.url || '';

    const colors = deriveColors(t);
    const meta = colors._meta || {};
    const resolve = meta.resolve || (v => hex(v));
    const typography = deriveTypography(t);
    const spacing = deriveSpacing(t);
    const shape = deriveShape(t);
    const radius = deriveRadius(t);
    const shadows = deriveShadows(t, colors.accent || colors.primary);
    const breakpoints = deriveBreakpoints(t);
    const heroSurfaceRaw = deriveHeroSurface(t, colors.background);
    const heroSurface = heroSurfaceRaw ? {
      hex: heroSurfaceRaw.hex,
      resolve: heroSurfaceRaw.resolve,
      heroCta: heroSurfaceRaw.heroCta,
      onVariants: new Set(['btn-cta', 'btn-red', 'btn-dark', 'hero-cta']),
    } : null;

    const vp = t.viewport;
    const vw = int(vp && vp.width), vh = int(vp && vp.height);

    return {
      // Provenance
      source: {
        url: sourceUrl,
        name: siteName(sourceUrl),
        viewport: (vw !== null && vh !== null) ? { width: vw, height: vh } : null,
      },
      theme: {
        isDark: !!meta.isDark,
        style: characterize(t, colors, spacing, radius, shape),
        inverseButton: !!meta.inverseButton,
      },
      colors: colors,
      colorRoles: colorKeys(colors),
      typography: typography,
      spacing: spacing,
      radius: radius,
      shape: shape,
      shadows: shadows,
      breakpoints: breakpoints,
      heroSurface: heroSurface,
      fonts: deriveFonts(t, typography),
      // The raw capture stays reachable so renderers that still need a field
      // the model does not yet normalise can read it explicitly rather than
      // silently diverging.
      tokens: t,
      _resolve: resolve,
    };
  }

  // Families with where each can be obtained and, for self-hosted ones, an
  // open alternative by classification. Suggestions are flagged as such.
  function deriveFonts(t, typography) {
    const assets = (t.assets && Array.isArray(t.assets.fonts)) ? t.assets.fonts : [];
    const stepsFor = fam => {
      const entry = (typography.families || []).find(f => f.family === fam
        || f.family.split(',')[0].replace(/["']/g, '').trim() === fam);
      return entry ? entry.steps : [];
    };
    const seen = new Set();
    const out = [];
    assets.forEach(a => {
      const family = fontStack(a && a.family);
      if (!family || seen.has(family)) return;
      seen.add(family);
      const availability = fontAvailability(a.url);
      if (!availability) return;
      const steps = stepsFor(family);
      const selfHosted = /^self-hosted/.test(availability);
      let alternative = null;
      let isOpen = false;
      if (selfHosted) {
        const alt = suggestAlternative(family, steps);
        isOpen = alt.split(' or ').some(x => x.trim().toLowerCase() === family.toLowerCase());
        alternative = isOpen ? null : alt;
      }
      out.push({ family, availability, steps, selfHosted, alternative, openlyLicensed: isOpen });
    });
    return out;
  }

  return {
    buildDesignModel,
    // The derivation core, exposed so the renderer can consume it rather than
    // keeping a second copy.
    accessors: { hex, len, num, int, word, shadow, fontStack, timing, duration, bool,
                 remOf, withRem, titleCase, siteName, isEmpty, colorKeys },
    color: { hsl, contrast, lum, resolveInString, shiftLightness, dominantRole,
             isTextColor, byUsage, makeResolver, alphaVariantsOf, deriveColors },
    derive: { deriveTypography, deriveSpacing, deriveShape, deriveRadius, deriveShadows,
              deriveBreakpoints, characterize, deriveHeroSurface, buttonMeasuredOnHero,
              deriveFonts, fontAvailability, suggestAlternative, shadowWeight,
              shadowMatchesAccent, bpName },
    states: { deriveVariant, disambiguate, componentForSelector,
              keyframeDecls, keyframeEffect, fnArg },
    SCALE_KEYS,
  };
})();

if (typeof self !== 'undefined') {
  self.VD_MODEL = VD_MODEL;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VD_MODEL;
}

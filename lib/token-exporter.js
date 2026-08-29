// VibeDesign — design token export (v3.0)
//
// Emits the DTCG / W3C Design Token Community Group format from
// lib/design-model.js. The model is the single source of truth, so a colour
// that reads `#ed462d` in DESIGN.md is `#ed462d` here — byte-identical, not
// separately re-derived.
//
//   exportW3CTokens(rawCapture)      → DTCG object   (kept: original entry point)
//   exportTokensFromModel(model)     → DTCG object   (the real work)
//   downloadTokensJSON(rawCapture)   → triggers a download
//
// ── Why the previous version was replaced ─────────────────────────────────
// The old exporter re-derived every role with its own heuristics and got them
// wrong in ways the model does not:
//   - text-primary fell back to #ffffff / #000000 by page darkness, so on a
//     near-black page it could come out equal to the background — a token file
//     whose body text is invisible.
//   - border was hardcoded to rgba(0,0,0,0.08) regardless of what the page uses.
//   - state-success / -error / -warning were emitted as fixed Tailwind hexes on
//     every site, observed or not.
// Nothing is invented here. A role the model did not observe is absent.
//
// ── Value format ──────────────────────────────────────────────────────────
// Values are CSS strings ("16px", "#0a0a0a"), which is what Style Dictionary,
// Tokens Studio and the Figma token plugins actually consume. The newer DTCG
// draft's object form ({"value":16,"unit":"px"}) is not used: it cannot express
// the `50%` and multi-value radii real pages use, and it would make these files
// disagree with DESIGN.md character-for-character.
//
// Plain globals so the same file works via <script> tag and via require().
// DO NOT use Chrome APIs here.

const VD_TOKENS = (() => {
  'use strict';

  const MODEL = (() => {
    if (typeof module !== 'undefined' && module.exports) {
      try { return require('./design-model.js'); } catch (e) { /* fall through */ }
    }
    const g = (typeof self !== 'undefined') ? self : globalThis;
    return g.VD_MODEL;
  })();

  const { hex, len, num, int, timing, duration } = MODEL.accessors;

  // ── shadow parsing ──────────────────────────────────────────────────────
  // A CSS shadow list is comma-separated, but rgba() contains commas too, so
  // the split has to respect parentheses.
  function splitTopLevel(str) {
    const out = [];
    let depth = 0, start = 0;
    for (let i = 0; i < str.length; i++) {
      const c = str.charAt(i);
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (c === ',' && depth === 0) { out.push(str.slice(start, i)); start = i + 1; }
    }
    out.push(str.slice(start));
    return out.map(s => s.trim()).filter(Boolean);
  }

  // "rgba(0,0,0,.5) 0px 2px 8px 0px inset" → DTCG shadow composite.
  // Returns null rather than a guess when the string does not parse.
  function parseShadowLayer(layer) {
    let s = String(layer).trim();
    const inset = /(^|\s)inset(\s|$)/.test(s);
    if (inset) s = s.replace(/(^|\s)inset(\s|$)/, ' ').trim();

    // hex() deliberately drops alpha, and a shadow's alpha is most of what
    // makes it a shadow — so an rgba()/hsl() colour is kept verbatim rather
    // than flattened to an opaque hex.
    const colorMatch = s.match(/#[0-9a-f]{3,8}\b|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^)]*\)/i);
    const color = colorMatch ? (hex(colorMatch[0]) || colorMatch[0].replace(/\s+/g, ' ').trim()) : null;
    if (colorMatch) s = s.replace(colorMatch[0], ' ');

    const lengths = s.match(/-?[\d.]+(?:px|rem|em)\b|(?:^|\s)0(?=\s|$)/g) || [];
    const L = lengths.map(v => len(v.trim())).filter(v => v !== null);
    if (L.length < 2) return null;

    const out = {
      offsetX: L[0],
      offsetY: L[1],
      blur: L.length > 2 ? L[2] : '0px',
      spread: L.length > 3 ? L[3] : '0px',
    };
    if (color) out.color = color;
    if (inset) out.inset = true;
    return out;
  }

  function shadowToken(css) {
    const layers = splitTopLevel(String(css)).map(parseShadowLayer);
    if (layers.some(l => l === null) || !layers.length) {
      // Better an honest raw string than a silently wrong composite.
      return { $value: String(css), $type: 'shadow',
               $description: 'unparsed — the observed CSS value verbatim' };
    }
    return { $value: layers.length === 1 ? layers[0] : layers, $type: 'shadow' };
  }

  // ── motion ──────────────────────────────────────────────────────────────
  // The model does not normalise motion yet, so this reads the capture. Every
  // candidate is first passed through the model's timing() sanitiser, so a
  // string DESIGN.md would refuse to print cannot become a token here either.
  //
  // A transition is a shorthand — "color 0.3s cubic-bezier(.25,1,.5,1) 0.1s" —
  // so duration and easing have to be picked out of it. timing()/duration()
  // validate; they do not parse a shorthand, which is what the first version
  // of this function wrongly assumed.
  const EASING_KEYWORDS = ['linear', 'ease-in-out', 'ease-in', 'ease-out', 'ease', 'step-start', 'step-end'];

  function motionTokens(t) {
    const out = {};
    const transitions = (Array.isArray(t.transitions) ? t.transitions : [])
      .map(timing)
      .filter(Boolean);

    const durations = new Set();
    const easings = new Set();

    transitions.forEach(raw => {
      // The FIRST time in a transition shorthand is the duration; a second is
      // the delay. Taking every number would file delays as durations.
      // splitTopLevel, not split(','): cubic-bezier(0.25, 1, 0.5, 1) carries
      // three commas of its own, and a naive split shreds it into fragments
      // that match neither the bezier pattern nor a keyword.
      const perProperty = splitTopLevel(raw);
      perProperty.forEach(part => {
        const times = part.match(/-?[0-9.]+m?s\b/g) || [];
        if (times.length) {
          const d = duration(times[0]);
          if (d && parseFloat(d) > 0) durations.add(d);
        }
        const bez = part.match(/cubic-bezier\([^)]*\)/i);
        if (bez) { easings.add(bez[0].replace(/\s+/g, '')); return; }
        const kw = EASING_KEYWORDS.find(k => new RegExp('(^|[^a-z-])' + k + '([^a-z-]|$)', 'i').test(part));
        if (kw) easings.add(kw);
      });
    });

    [...durations]
      .sort((a, b) => parseFloat(a) - parseFloat(b))
      .forEach(d => {
        const ms = parseFloat(d);
        const label = ms < 200 ? 'fast' : ms <= 350 ? 'normal' : ms <= 500 ? 'slow' : 'dramatic';
        // Ascending order means the first writer of a band is its fastest.
        if (!out['duration-' + label]) out['duration-' + label] = { $value: d, $type: 'duration' };
      });

    [...easings].sort().forEach(e => {
      const bez = e.match(/^cubic-bezier\(([^)]*)\)$/i);
      if (bez) {
        const vals = bez[1].split(',').map(v => parseFloat(v.trim()));
        if (vals.length === 4 && vals.every(v => Number.isFinite(v))) {
          // Named for the curve itself, so two sites with the same easing
          // produce the same token name.
          out['easing-' + vals.join('-').replace(/\./g, '')] =
            { $value: vals, $type: 'cubicBezier' };
          return;
        }
      }
      // CSS keywords are not cubicBezier values; typing them as such would be
      // a lie a consumer cannot detect.
      out['easing-' + e] = { $value: e, $type: 'other',
                             $description: 'CSS easing keyword' };
    });
    return out;
  }

  // ── the export ──────────────────────────────────────────────────────────

  function exportTokensFromModel(model) {
    if (!model) return null;
    const t = model.tokens || {};
    const out = {};

    out.$description = `Design tokens observed on ${model.source.name}`
      + (model.source.viewport ? ` at ${model.source.viewport.width}×${model.source.viewport.height}` : '')
      + '. Generated by VibeDesign from the live page — nothing here is invented;'
      + ' a role that was not observed is absent.';

    // Colours — exactly the roles the model resolved, in its order.
    const color = {};
    model.colorRoles.forEach(role => { color[role] = { $value: model.colors[role], $type: 'color' }; });
    if (Object.keys(color).length) out.color = color;

    // Font families, then the composite type steps that reference them.
    const stacks = (model.typography && model.typography.stacks) || {};
    const fontFamily = {};
    Object.keys(stacks).forEach(role => {
      fontFamily[role] = { $value: stacks[role], $type: 'fontFamily' };
    });
    if (Object.keys(fontFamily).length) out.fontFamily = fontFamily;

    const detail = (model.typography && model.typography.detail) || {};
    const typography = {};
    MODEL.SCALE_KEYS.forEach(step => {
      const d = detail[step];
      if (!d || !d.size) return;
      const v = { fontSize: d.size };
      if (d.family) v.fontFamily = d.family;
      if (d.weight) v.fontWeight = d.weight;
      if (d.lineHeight) v.lineHeight = d.lineHeight;
      if (d.tracking) v.letterSpacing = d.tracking;
      typography[step] = { $value: v, $type: 'typography' };
      if (d.transform) typography[step].$description = `text-transform: ${d.transform}`;
    });
    if (Object.keys(typography).length) out.typography = typography;

    // Spacing — the observed step scale, named by multiple of the base unit so
    // the names survive a different base (space-2 is always 2× base).
    // The steps are nested under `scale` rather than sitting beside `base`:
    // JavaScript hoists integer-like keys to the front of an object, so a flat
    // { base, 1, 2, 4 } serialises as { 1, 2, 4, base } and reads as a mistake.
    if (model.spacing) {
      const spacing = { base: { $value: model.spacing.base, $type: 'dimension' } };
      const base = parseFloat(model.spacing.base) || 0;
      const scale = {};
      (model.spacing.scale || []).forEach(step => {
        const px = parseFloat(step);
        const mult = base ? Math.round(px / base) : 0;
        const name = mult > 0 ? String(mult) : step.replace(/[^0-9a-z]/gi, '');
        if (!scale[name]) scale[name] = { $value: step, $type: 'dimension' };
      });
      if (Object.keys(scale).length) {
        spacing.scale = scale;
        spacing.scale.$description = `multiples of the ${model.spacing.base} base unit`;
      }
      out.spacing = spacing;
    }

    // `50%` and the four-value `0px 6px 6px 0px` both occur in real captures
    // and neither is a DTCG dimension. Typing them as one would hand a
    // consumer a value its parser accepts and then mis-scales.
    if (model.radius && Object.keys(model.radius).length) {
      const radius = {};
      Object.keys(model.radius).forEach(k => {
        const v = model.radius[k];
        // len() accepts % (DESIGN.md prints percentages happily); DTCG's
        // dimension type does not, so this is a stricter test than len().
        radius[k] = /^-?[0-9.]+(px|rem|em)$/.test(String(v).trim())
          ? { $value: v, $type: 'dimension' }
          : { $value: v, $type: 'other',
              $description: 'not a single length — a percentage or per-corner value' };
      });
      out.radius = radius;
    }

    // A chamfered button has no radius to export; the polygon is the shape, so
    // it travels as an extension rather than being flattened into a radius.
    if (model.shape && model.shape.clipPath) {
      out.shape = {
        $description: 'Angular shape language — a clip-path polygon, not a border-radius',
        chamfer: { $value: model.shape.size, $type: 'dimension' },
        'clip-path': { $value: model.shape.clipPath, $type: 'other' },
      };
    }

    if (model.shadows && Object.keys(model.shadows).length) {
      const shadow = {};
      Object.keys(model.shadows).forEach(k => { shadow[k] = shadowToken(model.shadows[k]); });
      out.shadow = shadow;
    }

    if (model.breakpoints) {
      const bp = {};
      Object.keys(model.breakpoints).filter(k => k.charAt(0) !== '_').forEach(k => {
        bp[k] = { $value: model.breakpoints[k], $type: 'dimension' };
      });
      if (Object.keys(bp).length) {
        bp.$description = model.breakpoints._direction === 'max-width'
          ? 'desktop-first — these are max-width query boundaries'
          : 'mobile-first — these are min-width query boundaries';
        out.breakpoint = bp;
      }
    }

    const motion = motionTokens(t);
    if (Object.keys(motion).length) out.motion = motion;

    return out;
  }

  // Original entry point, unchanged signature: raw capture in, DTCG out.
  function exportW3CTokens(data) {
    if (!data) return null;
    return exportTokensFromModel(MODEL.buildDesignModel(data, { sourceUrl: data.url || '' }));
  }

  function tokensFilename(url) {
    let host = '';
    try { host = new URL(String(url)).hostname.replace(/^www\./, ''); } catch (e) { host = ''; }
    return `design-tokens-${host || 'site'}.json`;
  }

  function downloadTokensJSON(data) {
    const tokens = exportW3CTokens(data);
    if (!tokens) return false;
    const json = JSON.stringify(tokens, null, 2) + '\n';
    const dl = (typeof self !== 'undefined' && self.VD_DOWNLOAD) ? self.VD_DOWNLOAD : null;
    if (!dl) return false;
    return dl.downloadText(json, tokensFilename((data && data.url) || ''), 'application/json');
  }

  return {
    exportW3CTokens,
    exportTokensFromModel,
    downloadTokensJSON,
    tokensFilename,
    _shadowToken: shadowToken,
    _splitTopLevel: splitTopLevel,
  };
})();

// The original call sites are bare function names, not a namespace.
const exportW3CTokens = VD_TOKENS.exportW3CTokens;
const downloadTokensJSON = VD_TOKENS.downloadTokensJSON;

if (typeof self !== 'undefined') {
  self.VD_TOKENS = VD_TOKENS;
  self.exportW3CTokens = exportW3CTokens;
  self.downloadTokensJSON = downloadTokensJSON;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VD_TOKENS;
}

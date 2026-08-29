// VibeDesign — skill bundle builder (v3.0)
//
//   VD_SKILL.buildSkillBundle(model, { sourceUrl, version, observedAt })
//     → { slug, files: [{ path, text }] }
//
// Produces a directory an agent can be pointed at:
//
//   design-<slug>/
//     SKILL.md            Agent Skills entry point — what this is, when to use it
//     DESIGN.md           the full design document (lib/design-md-builder.js)
//     tokens.json         DTCG tokens (lib/token-exporter.js)
//     variables.css       :root custom properties, nothing else
//     theme.css           variables + base elements + component classes
//     tailwind.config.js  the same scale as a Tailwind theme
//     README.md           what each file is and how the values were obtained
//
// Every file is generated from lib/design-model.js, so the same colour appears
// in all five formats or in none of them.
//
// ── What must never appear in a bundle ────────────────────────────────────
//   - page copy of any kind (headings, labels, button text, alt text)
//   - the source site's class names or selectors — a bundle is a description
//     of a design, not a copy of an implementation. Generated component classes
//     carry a `vd-` prefix so they cannot even COINCIDE with a page's own class
//     (rig.ai really does have a `.btn-ghost`, and an unprefixed `.btn-ghost`
//     here would be indistinguishable from having copied it)
//   - logos, brand names beyond the site name, image URLs
//   - an unresolved var(--x): a declaration whose value cannot be resolved to
//     a literal is DROPPED, never emitted broken
//
// Recommendations (font substitutes, contrast fixes) are marked
// "suggested, not observed" wherever they appear.

const VD_SKILL = (() => {
  'use strict';

  const req = name => {
    if (typeof module !== 'undefined' && module.exports) {
      try { return require('./' + name); } catch (e) { /* fall through */ }
    }
    return null;
  };
  const g = () => ((typeof self !== 'undefined') ? self : globalThis);

  const MODEL   = req('design-model.js')     || g().VD_MODEL;
  const TOKENS  = req('token-exporter.js')   || g().VD_TOKENS;
  const DESIGN  = req('design-md-builder.js')|| g().VD_DESIGN_MD;

  const { hex, len, num, int, word } = MODEL.accessors;

  // ── value hygiene ───────────────────────────────────────────────────────

  // Resolve every var() to a literal. Returns null if anything is left
  // unresolved — the caller then drops the declaration rather than emitting
  // CSS that silently falls back to nothing.
  function cssValue(raw, resolve) {
    if (raw === null || raw === undefined) return null;
    let s = String(raw).trim();
    if (!s || s.length > 300) return null;

    if (/var\(/i.test(s)) {
      s = s.replace(/var\(\s*(--[a-z0-9-_]+)\s*(?:,([^()]*))?\)/gi, (m, name, fallback) => {
        const r = resolve(m);
        if (r) return r;
        // A var() fallback is a real authored value, not a guess.
        const f = fallback && fallback.trim();
        return f || m;
      });
      if (/var\(/i.test(s)) return null;
    }
    // Colour functions become hex so the bundle reads consistently, but only
    // when they carry no alpha — flattening a translucent border would change
    // how it looks.
    s = s.replace(/\b(oklch|lab|lch)\(([^()]|\([^()]*\))*\)/gi, m => resolve(m) || m);
    if (/\b(oklch|lab|lch)\(/i.test(s)) return null;
    return s;
  }

  const q = s => JSON.stringify(String(s));

  // ── CSS custom property names ───────────────────────────────────────────
  const varName = (group, key) => `--${group}-${String(key).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;

  function collectVars(model) {
    const R = model._resolve;
    const out = [];   // [{ name, value, comment }]

    model.colorRoles.forEach(role => {
      out.push({ group: 'color', name: varName('color', role), value: model.colors[role] });
    });

    const stacks = (model.typography && model.typography.stacks) || {};
    Object.keys(stacks).forEach(role => {
      out.push({ group: 'font', name: varName('font', role), value: `${q(stacks[role])}, ${fallbackStack(role)}` });
    });

    const detail = (model.typography && model.typography.detail) || {};
    MODEL.SCALE_KEYS.forEach(step => {
      const d = detail[step];
      if (d && d.size) out.push({ group: 'text', name: varName('text', step), value: d.size });
    });

    if (model.spacing) {
      const base = parseFloat(model.spacing.base) || 0;
      out.push({ group: 'space', name: varName('space', 'base'), value: model.spacing.base });
      (model.spacing.scale || []).forEach(step => {
        const mult = base ? Math.round(parseFloat(step) / base) : 0;
        if (mult > 0) out.push({ group: 'space', name: varName('space', mult), value: step });
      });
    }

    Object.keys(model.radius || {}).forEach(k => {
      out.push({ group: 'radius', name: varName('radius', k), value: model.radius[k] });
    });

    Object.keys(model.shadows || {}).forEach(k => {
      const v = cssValue(model.shadows[k], R);
      if (v) out.push({ group: 'shadow', name: varName('shadow', k), value: v });
    });

    if (model.shape && model.shape.clipPath) {
      out.push({ group: 'shape', name: '--shape-chamfer', value: model.shape.size });
      out.push({ group: 'shape', name: '--shape-clip', value: model.shape.clipPath });
    }

    // De-duplicate by name, first writer wins.
    const seen = new Set();
    return out.filter(v => {
      if (!v.value || seen.has(v.name)) return false;
      seen.add(v.name);
      return true;
    });
  }

  // A generic stack so the bundle degrades gracefully where the observed
  // family is not installed. Suggested, not observed.
  function fallbackStack(role) {
    if (role === 'mono') return 'ui-monospace, SFMono-Regular, Menlo, monospace';
    if (role === 'heading') return 'system-ui, -apple-system, Segoe UI, sans-serif';
    return 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  }

  // ── variables.css ───────────────────────────────────────────────────────

  function buildVariablesCss(model, vars) {
    const L = [];
    L.push('/* ' + model.source.name + ' — design tokens as CSS custom properties.');
    L.push(' * Generated by VibeDesign from the live page. Values are as observed'
      + (model.source.viewport ? ` at ${model.source.viewport.width}×${model.source.viewport.height}.` : '.'));
    L.push(' * A property that is absent was not observed — it has not been guessed. */');
    L.push('');
    // An empty :root {} is not a stylesheet with no tokens, it is a stylesheet
    // that looks broken. Say what happened instead.
    if (!vars.length) {
      L.push('/* No design tokens were observed on this page. */');
      L.push('');
      return L.join('\n');
    }
    L.push(':root {');
    let group = null;
    vars.forEach(v => {
      if (v.group !== group) { if (group !== null) L.push(''); group = v.group; }
      L.push(`  ${v.name}: ${v.value};`);
    });
    L.push('}');
    L.push('');
    return L.join('\n');
  }

  // ── theme.css ───────────────────────────────────────────────────────────

  function buildThemeCss(model, vars) {
    const R = model._resolve;
    const t = model.tokens || {};
    const L = [];
    const has = name => vars.some(v => v.name === name);
    const V = (name, fallback) => (has(name) ? `var(${name})` : fallback);

    L.push('/* ' + model.source.name + ' — theme.');
    L.push(' *');
    L.push(' * Imports the observed tokens, then applies them to base elements and a');
    L.push(' * small set of component classes. The class NAMES here are ours');
    L.push(' * (.vd-btn, .vd-card, .vd-field) — the source site\'s own class names are');
    L.push(' * deliberately not reproduced, and the vd- prefix means these cannot');
    L.push(' * collide with them either. Only the measured values come from the page. */');
    L.push('');
    L.push('@import "./variables.css";');
    L.push('');

    // Base
    // Built into a list first, so a page where nothing was observed produces no
    // rule rather than an empty one. Nothing is added for looks: the previous
    // version emitted -webkit-font-smoothing, which no page here was measured
    // to use, and which made an otherwise-empty body rule look populated.
    const baseDecls = [];
    if (has('--color-background')) baseDecls.push('  background: var(--color-background);');
    if (has('--color-text-primary')) baseDecls.push('  color: var(--color-text-primary);');
    if (has('--font-body')) baseDecls.push('  font-family: var(--font-body);');
    const body = (model.typography.detail || {}).body;
    if (body && body.size && has('--text-body')) baseDecls.push('  font-size: var(--text-body);');
    if (body && body.lineHeight) baseDecls.push(`  line-height: ${body.lineHeight};`);
    if (baseDecls.length) {
      L.push('/* ── base ─────────────────────────────────────────────────────── */');
      L.push('body {');
      baseDecls.forEach(d => L.push(d));
      L.push('}');
      L.push('');
    }

    const headingFont = has('--font-heading') ? 'var(--font-heading)' : null;
    ['h1', 'h2', 'h3'].forEach(step => {
      const d = (model.typography.detail || {})[step];
      if (!d || !d.size) return;
      L.push(`${step} {`);
      if (headingFont) L.push(`  font-family: ${headingFont};`);
      L.push(`  font-size: var(${varName('text', step)});`);
      if (d.weight) L.push(`  font-weight: ${d.weight};`);
      if (d.lineHeight) L.push(`  line-height: ${d.lineHeight};`);
      if (d.tracking) L.push(`  letter-spacing: ${d.tracking};`);
      if (d.transform) L.push(`  text-transform: ${d.transform};`);
      L.push('}');
    });
    L.push('');

    // Buttons — one class per observed variant, named by role not by selector.
    const buttons = (t.buttonStyles && typeof t.buttonStyles === 'object') ? t.buttonStyles : {};
    const variants = Object.keys(buttons).filter(k => buttons[k] && typeof buttons[k] === 'object');
    if (variants.length) {
      L.push('/* ── buttons ──────────────────────────────────────────────────── */');
      L.push('.vd-btn {');
      L.push('  display: inline-flex;');
      L.push('  align-items: center;');
      L.push('  justify-content: center;');
      L.push('  cursor: pointer;');
      L.push('  border: 0;');
      L.push('  text-decoration: none;');
      if (model.shape && model.shape.clipPath) L.push('  clip-path: var(--shape-clip);');
      else if (has('--radius-button')) L.push('  border-radius: var(--radius-button);');
      L.push('}');
      L.push('');

      // A button whose background equals the page background is not a mistake:
      // it was measured on a hero panel painted a different colour. Emitting it
      // without saying so hands the consumer an invisible button.
      if (model.theme.inverseButton) {
        L.push('/* NOTE: the primary button is painted in the PAGE background colour.');
        L.push(' * It was measured on a hero panel of a different colour, so it only');
        L.push(' * reads as a button against such a panel — not against the page. */');
        L.push('');
      }

      // Two variants measured to the same declarations are one style seen
      // twice; repeating the block would imply a distinction that is not there.
      const emitted = new Map();
      variants.forEach(name => {
        const b = buttons[name];
        const decls = [];
        const push = (prop, raw) => { const v = cssValue(raw, R); if (v) decls.push(`  ${prop}: ${v};`); };
        push('padding', b.padding);
        push('gap', len(b.gap) ? b.gap : null);
        push('height', len(b.height) ? b.height : null);
        push('background', b.backgroundColor);
        push('color', b.color);
        push('border', b.border);
        push('box-shadow', b.boxShadow);
        const fam = word(b.fontFamily);
        if (fam) decls.push(`  font-family: ${q(fam)}, ${fallbackStack('body')};`);
        push('font-size', b.fontSize);
        const w = int(b.fontWeight);
        if (w !== null) decls.push(`  font-weight: ${w};`);
        push('letter-spacing', b.letterSpacing);
        const tt = word(b.textTransform);
        if (tt && tt !== 'none') decls.push(`  text-transform: ${tt};`);
        push('transition', b.transition);
        if (!decls.length) return;
        const key = decls.join('\n');
        if (emitted.has(key)) { emitted.get(key).push(name); return; }
        emitted.set(key, [name]);
      });
      emitted.forEach((names, key) => {
        L.push(names.map(n => `.vd-btn-${slugPart(n)}`).join(',\n') + ' {');
        key.split('\n').forEach(d => L.push(d));
        L.push('}');
      });
      L.push('');
    }

    // Cards
    const card = t.cardStyles;
    if (card && typeof card === 'object') {
      const decls = [];
      const push = (prop, raw) => { const v = cssValue(raw, R); if (v) decls.push(`  ${prop}: ${v};`); };
      push('padding', card.padding);
      // A card that inherits the page background has no background of its own;
      // emitting one would invent a surface the page does not have.
      if (!card.backgroundIsInherited) push('background', card.backgroundColor);
      push('border', card.border);
      push('box-shadow', card.boxShadow);
      if (has('--radius-card')) decls.push('  border-radius: var(--radius-card);');
      push('gap', len(card.gap) ? card.gap : null);
      if (decls.length) {
        L.push('/* ── cards ────────────────────────────────────────────────────── */');
        L.push('.vd-card {');
        decls.forEach(d => L.push(d));
        L.push('}');
        L.push('');
      }
    }

    // Inputs
    const input = t.inputStyles;
    if (input && typeof input === 'object') {
      const decls = [];
      const push = (prop, raw) => { const v = cssValue(raw, R); if (v) decls.push(`  ${prop}: ${v};`); };
      push('padding', input.padding);
      push('background', input.backgroundColor);
      push('color', input.color);
      push('border', input.border);
      if (has('--radius-input')) decls.push('  border-radius: var(--radius-input);');
      const fam = word(input.fontFamily);
      if (fam) decls.push(`  font-family: ${q(fam)}, ${fallbackStack('body')};`);
      push('font-size', input.fontSize);
      push('height', len(input.height) ? input.height : null);
      if (decls.length) {
        L.push('/* ── form fields ──────────────────────────────────────────────── */');
        L.push('.vd-field {');
        decls.forEach(d => L.push(d));
        L.push('}');
        const ph = cssValue(input.placeholderColor, R);
        if (ph) {
          L.push('');
          L.push('.vd-field::placeholder {');
          L.push(`  color: ${ph};`);
          L.push('}');
        }
        const ring = input.focusRing && typeof input.focusRing === 'object' ? input.focusRing : null;
        if (ring) {
          const fd = [];
          const fpush = (prop, raw) => { const v = cssValue(raw, R); if (v) fd.push(`  ${prop}: ${v};`); };
          fpush('outline', ring.outline);
          fpush('outline-offset', ring.outlineOffset);
          fpush('box-shadow', ring.boxShadow);
          if (fd.length) {
            L.push('');
            L.push('.vd-field:focus-visible {');
            fd.forEach(d => L.push(d));
            L.push('}');
          }
        }
        L.push('');
      }
    }

    // Breakpoints, as empty-bodied comments would be useless — emit a container
    // rule per boundary only if a container width was observed.
    const container = len((t.visualProfile || {}).containerMaxWidth) ? t.visualProfile.containerMaxWidth : null;
    if (container) {
      L.push('/* ── layout ───────────────────────────────────────────────────── */');
      L.push('.vd-container {');
      L.push('  width: 100%;');
      L.push(`  max-width: ${container};`);
      L.push('  margin-inline: auto;');
      L.push('}');
      L.push('');
    }

    return L.join('\n');
  }

  const slugPart = s => String(s).replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'default';

  // ── tailwind.config.js ──────────────────────────────────────────────────

  function buildTailwindConfig(model) {
    const ind = (n) => '  '.repeat(n);
    const L = [];
    L.push('// ' + model.source.name + ' — Tailwind theme.');
    L.push('//');
    L.push('// Generated by VibeDesign from the live page. `extend` is used rather than a');
    L.push('// wholesale replacement so Tailwind\'s own defaults stay available for');
    L.push('// anything this site did not use.');
    L.push('');
    L.push('/** @type {import(\'tailwindcss\').Config} */');
    L.push('module.exports = {');
    L.push(ind(1) + 'content: [\'./src/**/*.{js,jsx,ts,tsx,html}\'],');
    L.push(ind(1) + 'theme: {');
    L.push(ind(2) + 'extend: {');

    const colors = {};
    model.colorRoles.forEach(r => { colors[r] = model.colors[r]; });
    if (Object.keys(colors).length) {
      L.push(ind(3) + 'colors: {');
      Object.keys(colors).forEach(k => L.push(`${ind(4)}${q(k)}: ${q(colors[k])},`));
      L.push(ind(3) + '},');
    }

    const stacks = (model.typography && model.typography.stacks) || {};
    if (Object.keys(stacks).length) {
      L.push(ind(3) + 'fontFamily: {');
      Object.keys(stacks).forEach(k => {
        L.push(`${ind(4)}${q(k)}: [${q(stacks[k])}, ${fallbackStack(k).split(', ').map(q).join(', ')}],`);
      });
      L.push(ind(3) + '},');
    }

    const detail = (model.typography && model.typography.detail) || {};
    const sizes = MODEL.SCALE_KEYS.filter(s => detail[s] && detail[s].size);
    if (sizes.length) {
      L.push(ind(3) + 'fontSize: {');
      sizes.forEach(s => {
        const d = detail[s];
        const extra = [];
        if (d.lineHeight) extra.push(`lineHeight: ${q(d.lineHeight)}`);
        if (d.tracking) extra.push(`letterSpacing: ${q(d.tracking)}`);
        if (d.weight) extra.push(`fontWeight: ${q(String(d.weight))}`);
        L.push(extra.length
          ? `${ind(4)}${q(s)}: [${q(d.size)}, { ${extra.join(', ')} }],`
          : `${ind(4)}${q(s)}: [${q(d.size)}],`);
      });
      L.push(ind(3) + '},');
    }

    if (model.spacing) {
      const base = parseFloat(model.spacing.base) || 0;
      const steps = (model.spacing.scale || [])
        .map(v => ({ mult: base ? Math.round(parseFloat(v) / base) : 0, v }))
        .filter(s => s.mult > 0);
      if (steps.length) {
        L.push(ind(3) + 'spacing: {');
        steps.forEach(s => L.push(`${ind(4)}${q(String(s.mult))}: ${q(s.v)},`));
        L.push(ind(3) + '},');
      }
    }

    if (model.radius && Object.keys(model.radius).length) {
      L.push(ind(3) + 'borderRadius: {');
      Object.keys(model.radius).forEach(k => L.push(`${ind(4)}${q(k)}: ${q(model.radius[k])},`));
      L.push(ind(3) + '},');
    }

    if (model.shadows && Object.keys(model.shadows).length) {
      const R = model._resolve;
      const usable = Object.keys(model.shadows)
        .map(k => ({ k, v: cssValue(model.shadows[k], R) }))
        .filter(s => s.v);
      if (usable.length) {
        L.push(ind(3) + 'boxShadow: {');
        usable.forEach(s => L.push(`${ind(4)}${q(s.k)}: ${q(s.v)},`));
        L.push(ind(3) + '},');
      }
    }

    if (model.breakpoints) {
      const keys = Object.keys(model.breakpoints).filter(k => k.charAt(0) !== '_');
      if (keys.length) {
        const maxFirst = model.breakpoints._direction === 'max-width';
        L.push(ind(3) + '// ' + (maxFirst
          ? 'Observed as max-width queries. Tailwind screens are min-width, so these'
          : 'Observed as min-width queries, which is what Tailwind screens expect.'));
        if (maxFirst) L.push(ind(3) + '// are the boundaries, not drop-in values — check the direction before use.');
        L.push(ind(3) + 'screens: {');
        keys.forEach(k => L.push(`${ind(4)}${q(k)}: ${q(model.breakpoints[k])},`));
        L.push(ind(3) + '},');
      }
    }

    L.push(ind(2) + '},');
    L.push(ind(1) + '},');
    L.push(ind(1) + 'plugins: [],');
    L.push('};');
    L.push('');
    return L.join('\n');
  }

  // ── SKILL.md ────────────────────────────────────────────────────────────

  // Agent Skills frontmatter limits. Exceeding either makes the skill fail to
  // load, so both are enforced here rather than hoped for.
  const NAME_MAX = 64;
  const DESC_MAX = 1024;

  function buildSkillMd(model, slug, opts) {
    const name = slug.slice(0, NAME_MAX);
    const style = model.theme.style || (model.theme.isDark ? 'dark interface' : 'light interface');
    const palette = model.colorRoles.slice(0, 3).map(r => model.colors[r]).join(', ');

    let description = `The ${model.source.name} design system, captured from the live site: `
      + `a ${style}. Use when building or restyling an interface to match ${model.source.name}, `
      + `or when asked for its colours, type scale, spacing, radii, shadows or component styles. `
      + `Provides observed design tokens (${palette}) as DESIGN.md, DTCG tokens.json, `
      + `CSS custom properties and a Tailwind theme.`;
    if (description.length > DESC_MAX) description = description.slice(0, DESC_MAX - 1).trimEnd() + '…';

    const L = [];
    L.push('---');
    L.push(`name: ${name}`);
    L.push(`description: ${description}`);
    L.push('---');
    L.push('');
    L.push(`# ${model.source.name} Design System`);
    L.push('');
    L.push(`Everything in this bundle was measured from the rendered page`
      + (opts.observedAt ? ` on ${opts.observedAt}` : '')
      + (model.source.viewport ? ` at ${model.source.viewport.width}×${model.source.viewport.height}` : '')
      + '. Nothing is invented: a value that was not observed is absent rather than filled in.');
    L.push('');
    L.push('## Files');
    L.push('');
    L.push('| File | Use it for |');
    L.push('| --- | --- |');
    L.push('| `DESIGN.md` | The full design document — read this first. Colour roles, type scale, spacing, components, motion, accessibility. |');
    L.push('| `tokens.json` | DTCG tokens for Style Dictionary, Tokens Studio or a Figma token plugin. |');
    L.push('| `variables.css` | The tokens as `:root` custom properties. Import into any stylesheet. |');
    L.push('| `theme.css` | The variables plus base element and component styles (`.vd-btn`, `.vd-card`, `.vd-field`). |');
    L.push('| `tailwind.config.js` | The same scale as a Tailwind theme, under `extend`. |');
    L.push('');
    L.push('## How to apply it');
    L.push('');
    L.push('1. Read `DESIGN.md` for the intent — which colour is the accent, how type steps down, how far apart things sit.');
    L.push('2. Take exact values from `tokens.json`, `variables.css` or `tailwind.config.js`, whichever suits the target project.');
    L.push('3. Use `theme.css` component classes as a starting point, not a drop-in: they carry the observed values under generic names.');
    L.push('');

    // Palette at a glance.
    if (model.colorRoles.length) {
      L.push('## Palette');
      L.push('');
      model.colorRoles.forEach(r => L.push(`- \`${r}\` — \`${model.colors[r]}\``));
      L.push('');
    }

    const fonts = model.fonts || [];
    if (fonts.length) {
      L.push('## Typefaces');
      L.push('');
      fonts.forEach(f => {
        let line = `- **${f.family}** — ${f.availability}`;
        if (f.alternative) line += `. If unavailable, ${f.alternative} is a close substitute (suggested, not observed)`;
        L.push(line + '.');
      });
      L.push('');
    }

    L.push('## Boundaries');
    L.push('');
    L.push('- These are visual tokens, not assets. No logos, imagery or copy from the site are included, and none should be reproduced from it.');
    L.push('- The source site\'s own class names and selectors are deliberately not recorded. Match the design, not the markup.');
    L.push('- Anything labelled *suggested, not observed* is a recommendation, not a measurement — say so if you act on it.');
    L.push('');
    return { text: L.join('\n'), name, description };
  }

  // ── README.md ───────────────────────────────────────────────────────────

  function buildReadme(model, slug, opts) {
    const L = [];
    L.push(`# ${slug}`);
    L.push('');
    L.push(`Design tokens and styles observed on ${model.source.name}`
      + (opts.sourceUrl ? ` (${opts.sourceUrl})` : '')
      + (opts.observedAt ? `, ${opts.observedAt}` : '') + '.');
    L.push('');
    L.push(`Generated by VibeDesign ${opts.version || 'dev'}.`);
    L.push('');
    L.push('## Contents');
    L.push('');
    L.push('- `SKILL.md` — entry point when this bundle is used as an agent skill.');
    L.push('- `DESIGN.md` — the design document: roles, scale, components, motion, accessibility.');
    L.push('- `tokens.json` — DTCG / W3C Design Token Community Group format.');
    L.push('- `variables.css` — `:root` custom properties.');
    L.push('- `theme.css` — variables plus base and component styles.');
    L.push('- `tailwind.config.js` — the same values as a Tailwind theme.');
    L.push('');
    L.push('## How these values were obtained');
    L.push('');
    L.push('The page was rendered in a real browser and its computed styles read back'
      + (model.source.viewport
        ? ` at a ${model.source.viewport.width}×${model.source.viewport.height} viewport`
        : '')
      + '. Colour roles are derived from how often each colour is used and against'
      + ' what it is placed, not from CSS variable names, which are frequently'
      + ' misleading.');
    L.push('');
    L.push('Consequences worth knowing:');
    L.push('');
    if (model.source.viewport) {
      L.push(`- **Type and layout sizes are responsive.** Every px value was measured at ${model.source.viewport.width}px wide. At another width the same element may be a different size.`);
    }
    L.push('- **Absence means "not observed", not "none".** If a role, radius or shadow is missing, the page did not show one. Nothing has been filled in with a plausible default.');
    L.push('- **Format note.** `tokens.json` uses CSS strings for values (`"16px"`), the form Style Dictionary and Tokens Studio consume, rather than the newer DTCG object form.');
    L.push('- **Suggestions are labelled.** Font substitutes and any contrast advice are marked *suggested, not observed*.');
    L.push('');
    L.push('## What is deliberately not here');
    L.push('');
    L.push('No page copy, logos, imagery or image URLs. No class names or selectors from the source site — the component classes in `theme.css` are generic names carrying observed values.');
    L.push('');
    return L.join('\n');
  }

  // ── entry point ─────────────────────────────────────────────────────────

  function buildSkillBundle(model, options) {
    if (!model) return null;
    const opts = Object.assign(
      { sourceUrl: '', version: 'dev', observedAt: null },
      options || {}
    );
    if (!opts.sourceUrl) opts.sourceUrl = model.source.url || '';

    const slug = slugFor(opts.sourceUrl || model.source.name);
    const vars = collectVars(model);

    const skill = buildSkillMd(model, slug, opts);
    const files = [
      { path: `${slug}/SKILL.md`, text: skill.text },
      { path: `${slug}/README.md`, text: buildReadme(model, slug, opts) },
      { path: `${slug}/DESIGN.md`, text: DESIGN.buildDesignMd(model.tokens, {
          sourceUrl: opts.sourceUrl, version: opts.version, observedAt: opts.observedAt }) },
      { path: `${slug}/tokens.json`,
        text: JSON.stringify(TOKENS.exportTokensFromModel(model), null, 2) + '\n' },
      { path: `${slug}/variables.css`, text: buildVariablesCss(model, vars) },
      { path: `${slug}/theme.css`, text: buildThemeCss(model, vars) },
      { path: `${slug}/tailwind.config.js`, text: buildTailwindConfig(model) },
    ];

    return { slug, files, skillName: skill.name, skillDescription: skill.description };
  }

  // "https://rig.ai/" → "design-rig-ai". Matches VD_DOWNLOAD.bundleSlug, but
  // this file must work without the download helper loaded (Node tests, the
  // build script), so the rule lives here too and a test pins them equal.
  function slugFor(source) {
    let host = '';
    try { host = new URL(String(source)).hostname; } catch (e) { host = String(source || ''); }
    const clean = host
      .replace(/^www\./i, '')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/^[.-]+|[.-]+$/g, '')
      .slice(0, 60)
      .replace(/\./g, '-')
      .toLowerCase();
    return 'design-' + (clean || 'site');
  }

  // Bundle → zip bytes. Kept here so callers do not have to know the layout.
  function zipSkillBundle(bundle, zipImpl) {
    const ZIP = zipImpl || req('zip-lite.js') || g().VD_ZIP;
    if (!bundle || !ZIP) return null;
    return ZIP.zip(bundle.files.map(f => ({ path: f.path, text: f.text })));
  }

  return {
    buildSkillBundle,
    zipSkillBundle,
    slugFor,
    _cssValue: cssValue,
    _collectVars: collectVars,
    NAME_MAX,
    DESC_MAX,
  };
})();

if (typeof self !== 'undefined') self.VD_SKILL = VD_SKILL;
if (typeof module !== 'undefined' && module.exports) module.exports = VD_SKILL;

// VibeDesign — DESIGN.md builder (v3.0)
//
// Turns an extracted token bundle into a Stitch-compatible DESIGN.md.
// Pure and offline: no network, no AI, no DOM. Same tokens in → byte-identical
// markdown out, which is what makes it testable and diffable.
//
// Plain globals so the same file works via <script> tag (popup/sidepanel) and
// via require() in Node (tests + scripts/build-design-md.js). No ESM, no build.
//
//   buildDesignMd(tokens, { sourceUrl, scope, version, observedAt })
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

  // ── the model ───────────────────────────────────────────────────────────
  // This file is a RENDERER. Everything it prints is derived by
  // lib/design-model.js, which the token export and the skill bundle also
  // read, so the same colour cannot come out differently in two artefacts.
  // The derivation core below is imported, not redefined.
  const MODEL = (() => {
    if (typeof module !== 'undefined' && module.exports) {
      try { return require('./design-model.js'); } catch (e) { /* fall through */ }
    }
    const g = (typeof self !== 'undefined') ? self : globalThis;
    return g.VD_MODEL;
  })();

  const { hex, len, num, int, word, shadow, fontStack, timing, duration,
          remOf, withRem, titleCase, siteName, isEmpty, colorKeys } = MODEL.accessors;
  const { hsl, contrast, lum, resolveInString, dominantRole, byUsage,
          makeResolver, deriveColors } = MODEL.color;
  const { deriveTypography, deriveSpacing, deriveShape, deriveRadius, deriveShadows,
          deriveBreakpoints, characterize, deriveHeroSurface, buttonMeasuredOnHero,
          fontAvailability, suggestAlternative } = MODEL.derive;
  const { deriveVariant, disambiguate, componentForSelector, keyframeEffect } = MODEL.states;
  const SCALE_KEYS = MODEL.SCALE_KEYS;























  // ── formatting ──────────────────────────────────────────────────────────





  function yamlStr(s) {
    return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }









  // ── color role derivation ───────────────────────────────────────────────
























  // ── typography ──────────────────────────────────────────────────────────





  // ── spacing / radius / shadows / breakpoints ────────────────────────────





















  // ── style characterization (3–8 words, deterministic) ───────────────────



  // ── frontmatter ─────────────────────────────────────────────────────────

  function buildFrontmatter(ctx) {
    const { t, colors, typo, spacing, radius, shadows, breakpoints, opts } = ctx;
    const L = [];
    L.push('---');
    L.push(`name: ${yamlStr(ctx.name + ' Design System')}`);
    const srcLine = `source: ${yamlStr(opts.sourceUrl || '')}`;
    L.push(opts.observedAt ? `${srcLine}   # observed on ${opts.observedAt}` : srcLine);
    L.push(`generated_by: ${yamlStr('VibeDesign ' + (opts.version || 'dev'))}`);
    // The width every px value below was observed at. Without it an agent has
    // no way to know the type scale is responsive and will treat a 112px h1 as
    // absolute. Omitted when the capture predates the field rather than
    // guessed — a wrong viewport is worse than none.
    const vp = t.viewport;
    const vw = int(vp && vp.width), vh = int(vp && vp.height);
    if (vw !== null && vh !== null) {
      L.push(`viewport: ${yamlStr(vw + '×' + vh)}`
        + '   # px values in the type scale and layout are as observed at this width');
    }
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
      L.push(`  # ${breakpoints._direction === 'max-width' ? 'desktop-first (max-width queries)' : 'mobile-first (min-width queries)'}`);
      Object.keys(breakpoints).filter(k => k.charAt(0) !== '_')
        .forEach(k => L.push(`  ${k}: ${yamlStr(breakpoints[k])}`));
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
    // (ctx.colors carries the background-bound colour resolver)
    const li = t.layoutInfo || {};
    const vp = t.visualProfile || {};
    const rows = [];
    const add = (k, v) => { if (v !== null && v !== undefined && v !== '') rows.push([k, v]); };

    // Spacing lives under visualProfile.spacingSystem, and the container
    // width there is authoritative over layoutInfo.maxWidth ("none").
    const sp = vp.spacingSystem || {};
    add('Container max-width', len(sp.containerMaxWidth)
      || len(li.maxWidth) || (li.maxWidth === 'none' ? 'none (full-bleed)' : null));
    const py = num(sp.sectionPaddingY) !== null ? num(sp.sectionPaddingY) : num(vp.sectionPaddingY);
    const px = num(sp.sectionPaddingX) !== null ? num(sp.sectionPaddingX) : num(vp.sectionPaddingX);
    if (py !== null) add('Section padding (Y)', withRem(Math.round(py) + 'px'));
    if (px !== null) add('Section padding (X)', withRem(Math.round(px) + 'px'));
    // sectionRhythm is an ordered per-section list, not a label — describe
    // the actual pattern: which sections are painted, which inherit the page.
    const rhythm = Array.isArray(vp.sectionRhythm) ? vp.sectionRhythm : [];
    if (!rhythm.length) add('Section rhythm', word(vp.sectionRhythm));
    if (rhythm.length) {
      const painted = rhythm.filter(r => hex(r && r.bgHex));
      const fullBleed = rhythm.filter(r => r && r.isFullBleed === true).length;
      const first = painted.length && rhythm[0] && hex(rhythm[0].bgHex) ? hex(rhythm[0].bgHex) : null;
      add('Section rhythm', `${rhythm.length} sections`
        + (first ? `, opening on \`${first}\`` : '')
        + (painted.length <= 1 ? ', the rest inheriting the page background' : `, ${painted.length} painted`)
        + (fullBleed ? ` · ${fullBleed} full-bleed` : ''));
    }
    add('Grid gap', len(sp.gridGap || vp.gridGap) ? withRem(sp.gridGap || vp.gridGap) : null);
    const split = int(vp.splitLayoutCount);
    if (split !== null && split > 0) add('Split (two-column) sections', String(split));
    add('Navigation', word((t.navPattern || {}).type) || word(vp.navStyle));
    if (li.hasSidebar === true) add('Sidebar', 'present');
    if (li.hasHero === true) add('Hero region', 'present');


    const chrome = (Array.isArray(t.fixedUIChrome) ? t.fixedUIChrome : [])
      .map(c => word(c && c.role)).filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);
    if (chrome.length) add('Fixed chrome', chrome.join(', '));

    // Card gap, and the hero treatment — a full-bleed accent hero above
    // uniform darker sections is a layout decision, not a colour one.
    add('Card gap', len(sp.cardGap || (t.cardStyles && t.cardStyles.gap))
      ? withRem(sp.cardGap || t.cardStyles.gap) : null);
    // The hero fill: sectionRhythm[0].bgHex, corroborated by the first
    // section's own bgColor.
    const rh0 = rhythm[0] || {};
    const sc0 = (Array.isArray(t.sectionContentMap) ? t.sectionContentMap : [])[0] || {};
    const heroBg = ctx.colors._meta && ctx.colors._meta.resolve
      ? ctx.colors._meta.resolve(rh0.bgHex || sc0.bgColor || vp.heroBackground)
      : null;
    if (heroBg) {
      add('Hero background', '`' + heroBg + '`'
        + (rh0.isFullBleed === true ? ' (full-bleed)' : ''));
    }

    // Repeating structures.
    // Repeating component structures are documented under Component anatomy;
    // Layout keeps page-level geometry only.
    const ui = vp.uiPatterns || t.typographyPatterns || {};
    if (ui.hasStickyNav === true) add('Sticky navigation', 'yes');
    if (ui.hasDarkFooter === true) add('Dark footer', 'yes');

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
  let ctxResolve = v => hex(v);
  // Some components were measured on a section that paints its own background
  // (a hero). Alpha values on those must composite over THAT surface, not over
  // the page. ctxSurfaces maps a variant/component hint to its resolver.
  let ctxSurface = null;           // { hex, resolve, onVariants:Set, onComponents:Set }
  function ctxResolveFor(hint) {
    if (ctxSurface && hint && ctxSurface.onVariants.has(String(hint))) return ctxSurface.resolve;
    return ctxResolve;
  }





  function buttonBlock(t) {
    const bs = t.buttonStyles || {};
    const blocks = [];
    ['primary', 'secondary', 'ghost'].forEach(variant => {
      const b = bs[variant];
      if (!b) return;
      // Alpha values composite over whichever surface the button sits on.
      const onHero = !!(ctxSurface && ctxSurface.heroCta
        && buttonMeasuredOnHero(b, ctxSurface.heroCta));
      const r = onHero ? ctxSurface.resolve : ctxResolve;
      const rows = componentRows([
        ['Background', r(b.backgroundColor)],
        ['Text color', r(b.color)],
        ['Padding', withRem(b.padding)],
        ['Radius', len(b.borderRadius)],
        ['Border', borderValue(b.border, r)],
        ['Shadow', shadow(b.boxShadow)],
        ['Font size', withRem(b.fontSize)],
        ['Font weight', int(b.fontWeight) === null ? null : String(int(b.fontWeight))],
        ['Letter spacing', len(b.letterSpacing)],
        ['Text transform', word(b.textTransform)],
        ['Height', len(b.height)],
        ['Transition', timing(b.transition)],
      ]);
      if (rows.length) {
        blocks.push(`#### ${titleCase(variant)}`
          + (onHero ? `\n\n_Measured on the hero surface \`${ctxSurface.hex}\`._` : '')
          + '\n\n' + table(['Property', 'Value'], rows));
      }
    });
    if (!blocks.length) return null;
    let head = '### Buttons\n\n';
    // A hero paints its own background, so a CTA measured there was sampled
    // against that surface — saying so prevents an agent reusing the values
    // on the page background and losing all contrast.
    if (ctxSurface && ctxSurface.heroCta
        && buttonMeasuredOnHero((t.buttonStyles || {}).primary, ctxSurface.heroCta)) {
      head += `**Surface context** — the CTA variants below were sampled inside the hero, `
        + `against \`${ctxSurface.hex}\`, not against the page background. Their fills and `
        + 'alpha borders are composited over that surface; re-derive them for a button placed '
        + 'on the page background.\n\n';
    }
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

  // Borders arrive as "1px solid oklch(...)"; the colour has to resolve or the
  // reader is handed a value they cannot use.
  function borderValue(raw, resolve) {
    if (typeof raw !== 'string' || !raw.trim() || raw.trim() === 'none') return null;
    const t = raw.trim().replace(/\s+/g, ' ');
    if (t.length > 80) return null;
    const m = t.match(/rgba?\([^)]*\)|oklch\([^)]*\)|#[0-9a-f]{3,8}|var\([^)]*\)/i);
    if (!m) return len(t) ? t : t;
    const resolved = resolve(m[0]);
    return resolved ? t.replace(m[0], resolved) : t.replace(m[0], '');
  }

  function simpleBlock(title, obj, spec) {
    if (!obj) return null;
    const rows = componentRows(spec(obj));
    if (!rows.length) return null;
    return `### ${title}\n\n` + table(['Property', 'Value'], rows);
  }

  // Links need surface context: a link colour identical to the page
  // background was plainly sampled somewhere else (a hero), and printing it
  // unqualified tells an agent to render invisible links.
  function linkBlock(t, ctx) {
    const l = t.linkStyles;
    if (!l) return null;
    const bg = ctx.colors.background;
    const linkColor = ctxResolve(l.color);
    const rows = componentRows([
      ['Color', linkColor],
      ['Decoration', word(l.textDecoration)],
      ['Underline offset', len(l.textUnderlineOffset)],
      ['Font weight', int(l.fontWeight) === null ? null : String(int(l.fontWeight))],
    ]);
    if (!rows.length) return null;

    let note = '';
    const cr = (linkColor && bg) ? contrast(linkColor, bg) : null;
    const hero = ctx.heroSurface;
    if (linkColor && bg && cr !== null && cr < 2) {
      const onHero = hero ? contrast(linkColor, hero.hex) : null;
      note += `**Sampled off the page background** — \`${linkColor}\` sits at `
        + `${cr.toFixed(2)}:1 against \`${bg}\`, which is invisible. `
        + (onHero !== null
            ? `Against the hero surface \`${hero.hex}\` it reads ${onHero.toFixed(2)}:1, so this is the hero link colour.`
            : 'It was measured on a section that paints its own background.')
        + '\n\n';
      // The on-page equivalent, if a hover rule measured one.
      const prose = (Array.isArray(t.hoverStates) ? t.hoverStates : [])
        .find(h => h && /prose a|(^|\s)a[:.]/.test(String(h.selector || '')));
      const onPage = prose ? ctxResolve(prose.color) : null;
      if (onPage) {
        note += `On the page background use \`${onPage}\`, measured from the body-copy link rule.\n\n`;
      }
    }
    return '### Links\n\n' + note + table(['Property', 'Value'], rows);
  }

  function sectionComponents(ctx) {
    const { t } = ctx;
    const parts = [];
    const push = b => { if (b) parts.push(b); };

    push(buttonBlock(t));
    push(simpleBlock('Cards', t.cardStyles, c => [
      ['Repeated instances', int(c.count) === null ? null : String(int(c.count))],
      [c.backgroundIsInherited === true ? 'Background (inherited)' : 'Background',
        ctxResolve(c.backgroundColor)],
      ['Padding', withRem(c.padding)],
      ['Radius', len(c.borderRadius)],
      ['Border', borderValue(c.border, ctxResolve)],
      ['Shadow', shadow(c.boxShadow)],
      ['Shadow type', word(c.shadowType)],
      ['Inner gap', withRem(c.gap)],
    ]));
    push(simpleBlock('Inputs', t.inputStyles, i => [
      ['Background', hex(i.backgroundColor)],
      ['Text color', hex(i.color)],
      ['Padding', withRem(i.padding)],
      ['Radius', len(i.borderRadius)],
      ['Border', borderValue(i.border, ctxResolve)],
      ['Font size', withRem(i.fontSize)],
      ['Height', len(i.height)],
      ['Placeholder', ctxResolve(i.placeholderColor)],
      ['Frame owner', i.frameFromWrapper === true ? 'wrapper element, not the control' : null],
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
    push(linkBlock(t, ctx));
    push(simpleBlock('Footer', t.footerStyles, f => [

      ['Background', hex(f.backgroundColor)],
      ['Text color', hex(f.color)],
      ['Padding', withRem(f.padding)],
      ['Columns', int(f.columns) === null ? null : String(int(f.columns))],
      ['Gap', withRem(f.gap)],
      ['Top border', borderValue(f.borderTop, ctxResolve)],
    ]));

    if (!parts.length) return null;
    return '## Components\n\n' + parts.join('\n\n');
  }









  function sectionFonts(ctx) {
    // Read from the model, which answers hosting and licensing separately.
    // This section used to re-derive both and reported every self-hosted face
    // as "not freely available" — wrong for the many sites that self-host a
    // copy of an openly-licensed family.
    const fonts = (ctx.model && ctx.model.fonts) || [];
    if (!fonts.length) return null;

    const rows = fonts.map(f => ['`' + f.family + '`', f.availability,
      f.steps.length ? f.steps.map(k => '`' + k + '`').join(', ') : '—']);

    // A substitute is only useful for a family the reader may not be able to
    // obtain. An open one they can simply go and get.
    const suggestions = fonts.filter(f => f.alternative)
      .map(f => ['`' + f.family + '`', f.alternative]);
    const open = fonts.filter(f => f.openlyLicensed);

    let out = '## Fonts & availability\n\n' + table(['Family', 'Source', 'Used for'], rows);
    out += '\n\nHosting is observed; licensing is a name lookup against the Google Fonts '
      + 'catalogue. That is a sufficient test for "open", not a necessary one, so '
      + '"licence unknown" means *not found there* — not that the family is proprietary.';
    if (open.length) {
      out += '\n\n' + open.map(f => '`' + f.family + '`').join(', ')
        + (open.length === 1 ? ' is openly licensed and' : ' are openly licensed and')
        + ' can be obtained directly, whatever this site chose to do.';
    }
    if (suggestions.length) {
      out += '\n\n### Substitutes — suggested, not observed\n\n'
        + 'These families were not found in the open catalogue, so they may not be '
        + 'reusable. The alternatives below are openly licensed and comparably '
        + 'classified. They are **suggestions, not measurements** — nothing here was '
        + 'seen on the page.\n\n'
        + table(['Family', 'Open alternative (suggested)'], suggestions);
    }
    return out;
  }

  function sectionIconography(ctx) {
    const { t } = ctx;
    const icoRoot = t.iconographySystem || {};
    const ico = icoRoot.svgIcons || icoRoot;
    const rows = [];
    const add = (k, v) => { if (v) rows.push([k, v]); };
    add('Icon style', word(ico.style));
    // Sizes arrive as "16x16"; keep the square dimension.
    const sizes = (Array.isArray(ico.dominantSizes) ? ico.dominantSizes : [])
      .map(v => int(String(v).split(/[x×]/)[0])).filter(v => v !== null);
    if (sizes.length) add('Common sizes', sizes.slice(0, 4).map(v => v + 'px').join(', '));
    const sw = (Array.isArray(ico.strokeWidths) ? ico.strokeWidths : []).map(num).filter(v => v !== null);
    if (sw.length) add('Stroke widths', sw.slice(0, 3).map(v => v + 'px').join(', '));
    if (int(ico.count) !== null) add('Icon count', String(int(ico.count)));
    if (word(ico.strokeToFillRatio)) add('Stroke/fill mix', word(ico.strokeToFillRatio));
    const icoAccent = (Array.isArray(ico.accentColors) ? ico.accentColors : []).map(hex).filter(Boolean)[0];
    if (icoAccent) add('Icon colour', '`' + icoAccent + '`');
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

  function sectionShadows(ctx) {
    const { t, shadows, colors } = ctx;
    const sys = t.shadowSystem || {};
    const parts = [];
    const traits = [];
    if (word(sys.style)) traits.push(word(sys.style));
    if (sys.hasInset === true) traits.push('inset');
    if (sys.hasLayered === true) traits.push('layered');
    if (sys.hasBrutalist === true) traits.push('brutalist offsets');
    if (traits.length) {
      parts.push(`Elevation is **${traits.join(', ')}**`
        + (int(sys.maxDepth) !== null ? `, up to ${int(sys.maxDepth)} stacked layers` : '') + '.');
    }
    if (shadows) {
      parts.push(table(['Token', 'Value'],
        Object.keys(shadows).map(k => ['`' + k + '`', '`' + shadows[k] + '`'])));
    }
    // A multi-stop text-shadow is a deliberate halo, not an afterthought.
    const ts = (Array.isArray(t.textShadows) ? t.textShadows : []).map(shadow).filter(Boolean);
    if (ts.length) {
      parts.push('### Text shadow\n\n'
        + ts.slice(0, 2).map(v => '- `' + v + '`').join('\n')
        + '\n\nApply the full stack; the stops build a single halo and dropping any flattens it.');
    }
    if (!parts.length) return null;
    return '## Elevation & shadows\n\n' + parts.join('\n\n');
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
      const dir = breakpoints._direction === 'max-width' ? 'Max width' : 'Min width';
      out += `\n\n### Breakpoints\n\nThe site is ${breakpoints._direction === 'max-width' ? 'desktop-first — these are `max-width` queries' : 'mobile-first — these are `min-width` queries'}.\n\n`
        + table(['Name', dir], Object.keys(breakpoints).filter(k => k.charAt(0) !== '_')
            .map(k => [`\`${k}\``, breakpoints[k]]));
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
    const { colors, radius, t } = ctx;
    const items = [
      'Do not invent colors, tints or shades that are not in this document.',
      'Do not introduce new fonts, weights or sizes outside the scale.',
      'Do not use arbitrary spacing values such as `13px` or `27px`.',
    ];
    if (!isEmpty(radius)) items.push('Do not apply a single global border-radius to every element.');
    // Only ever aimed at an accent — never at the page background, which is
    // by definition the largest fill on the page. And when the site itself
    // uses the accent as a section fill, forbidding it would contradict the
    // document's own Layout section.
    const fillWarn = [colors.accent, colors.primary]
      .find(c => c && c !== colors.background && hsl(c).s >= 25);
    if (fillWarn) {
      const vp = ctx.t.visualProfile || {};
      const usedAsSectionBg = (Array.isArray(vp.sectionRhythm) ? vp.sectionRhythm : [])
        .some(r => hex(r && r.bgHex) === fillWarn);
      items.push(usedAsSectionBg
        ? `The accent \`${fillWarn}\` is used as a full-bleed fill only for the hero; elsewhere use it sparingly for emphasis.`
        : `Do not use \`${fillWarn}\` for large background fills — it is an accent.`);
    }
    items.push('Do not copy layout or wording from the source site; this document describes style only.');
    return "## Don't\n\n" + items.map(i => '- ' + i).join('\n');
  }

  function sectionAgentInstructions(ctx) {
    const { colors, spacing, typo } = ctx;
    const lines = [];
    lines.push('Use only the tokens defined in the frontmatter of this file.');
    lines.push('Never invent a color; if a shade is missing, reuse the closest listed token.');
    if (spacing) lines.push(`Respect the ${spacing.base} spacing scale for every dimension you set.`);
    if (!isEmpty(typo.scale)) lines.push('Match the type scale exactly — size, weight and line-height together.');
    lines.push('Reproduce component values (padding, radius, border, shadow) verbatim from the Components section.');
    lines.push('Reproduce the documented motion timings and interaction states rather than defaults.');
    lines.push('Verify text/background contrast meets 4.5:1 before shipping any pairing not listed here.');
    lines.push('Generate original copy and layout — this document supplies visual style only.');
    return '## Agent instructions\n\n' + lines.slice(0, 8).map(l => '- ' + l).join('\n');
  }

  // ── PRO sections ────────────────────────────────────────────────────────







  function sectionMotion(ctx) {
    const { t } = ctx;
    const mp = t.motionProfile || {};
    const rows = [];
    const add = (k, v) => { if (v) rows.push([k, v]); };
    add('Dominant duration', duration(mp.dominantDuration));
    // "ease, ease" is one easing repeated, not two.
    const dedupeList = v => typeof v === 'string'
      ? v.split(',').map(x => x.trim()).filter((x, i, a) => x && a.indexOf(x) === i).join(', ')
      : v;
    const easing = dedupeList(mp.dominantEasing);
    add('Dominant easing', timing(easing) || word(easing) ||
      (typeof easing === 'string' && /^[a-z0-9 ,.()%-]{1,60}$/i.test(easing.trim()) ? easing.trim() : null));
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
      const undescribed = frames.filter(f => !f.effect).length;
      out += '### Keyframes\n\n' + table(['Name', 'Effect'],
        frames.map(f => ['`' + f.name + '`',
          f.effect || '**not fully captured** — first and last frames are identical'])) + '\n\n';
      if (undescribed) {
        out += `Only the first and last frames of each \`@keyframes\` rule were captured. `
          + `${undescribed} of ${frames.length} therefore show no delta: their motion lives in `
          + `intermediate frames. Treat those as "a jitter of this name exists" rather than as a spec.\n\n`;
      }
    }

    // Ambient (idle, looping) animations with their durations.
    const ambient = (Array.isArray(t.ambientAnimations) ? t.ambientAnimations : [])
      .map(a => {
        if (!a || typeof a !== 'object') return null;
        const nm = word(a.name) || word(a.animationName);
        if (!nm) return null;
        const dur = duration(a.duration) || timing(a.duration);
        let it = word(a.timingFunction) || word(a.easing);
        let cnt = word(a.iterationCount);
        // animationDetails carries the full shorthand, e.g.
        // "4s ease-in-out infinite signal-flicker" — parse easing/iteration
        // for the matching name.
        (Array.isArray(t.animationDetails) ? t.animationDetails : []).forEach(d => {
          if (typeof d !== 'string' || d.indexOf(nm) === -1) return;
          const em = d.match(/\b(linear|ease(-in-out|-in|-out)?|cubic-bezier\([^)]*\)|steps\([^)]*\))/);
          if (em && !it) it = em[1];
          const im = d.match(/\b(infinite|\d+)\b(?!\s*m?s)/);
          if (im && !cnt) cnt = im[1];
        });
        const loc = word(a.location);
        return [ '`' + nm + '`', dur || '—', it || '—', cnt || '—', loc || '—' ];
      }).filter(Boolean);
    if (ambient.length) {
      out += '### Ambient loops\n\nThese run without user input.\n\n'
        + table(['Animation', 'Duration', 'Easing', 'Iterations', 'Position'], ambient) + '\n\n';
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

    // detectRiveAndLottie returns { hasRive, hasLottie, hasDotLottie,
    // details: [{ type, location, size, count? }] }. An earlier version of
    // this block read totalCount/type/loop/autoplay — a shape the extractor
    // has never produced, so the section never rendered for a real capture.
    const rive = t.riveAndLottie;
    if (rive && typeof rive === 'object') {
      const details = Array.isArray(rive.details) ? rive.details : [];
      const byType = {};
      details.forEach(d => {
        const ty = word(d && d.type);
        if (!ty) return;
        byType[ty] = byType[ty] || { count: 0, sizes: [], locations: [] };
        byType[ty].count += int(d.count) !== null ? int(d.count) : 1;
        const w = int(d.size && d.size.w), h = int(d.size && d.size.h);
        if (w !== null && h !== null) byType[ty].sizes.push(`${w}×${h}`);
        const loc = word(d.location);
        if (loc && byType[ty].locations.indexOf(loc) === -1) byType[ty].locations.push(loc);
      });
      const rows = Object.keys(byType).sort().map(ty => {
        const info = byType[ty];
        return ['`' + ty + '`', String(info.count),
          info.sizes.length ? info.sizes.slice(0, 3).join(', ') : '—',
          info.locations.length ? info.locations.join(', ') : '—'];
      });
      if (rows.length) {
        out += '### Vector & canvas animation\n\n'
          + table(['Kind', 'Count', 'Size', 'Position'], rows) + '\n\n';
      }
    }

    const trimmed = out.trim();
    return trimmed === '## Motion' ? null : trimmed;
  }





  function sectionInteractionStates(ctx) {
    const { t, colors } = ctx;
    // NOTE: tokens.interactiveStates holds tab-panel copy, not CSS state
    // diffs, so it is deliberately not read here. hoverStates carries the
    // actual computed deltas — and its `before` object is the element's BASE
    // (pre-hover) state, NOT a ::before pseudo-element.
    const PROPS = [
      ['background', ['background', 'background-color', 'backgroundColor']],
      ['color', ['color']],
      ['border-color', ['border-color', 'borderColor']],
      ['box-shadow', ['box-shadow', 'boxShadow']],
      ['opacity', ['opacity']],
      ['transform', ['transform']],
    ];
    const pick = (obj, keys) => {
      if (!obj) return null;
      for (let i = 0; i < keys.length; i++) {
        const v = obj[keys[i]];
        if (v !== undefined && v !== null && v !== '' && v !== 'initial' && v !== 'none') return v;
      }
      return null;
    };
    const show = (label, raw, resolve) => {
      if (raw === null) return null;
      const str = String(raw).trim();
      if (label === 'opacity' || label === 'transform') {
        return /^[a-z0-9 ().,%-]{1,40}$/i.test(str) ? str : null;
      }
      if (label === 'box-shadow') {
        const out = resolveInString(str, resolve);
        return out && out.length <= 90 ? out : null;
      }
      const out = resolve(raw) || resolveInString(str, resolve);
      return out && /^#|^--/.test(out) ? out : null;
    };

    const rows = [];
    (Array.isArray(t.hoverStates) ? t.hoverStates : []).forEach(h => {
      if (!h || typeof h !== 'object') return;
      const component = componentForSelector(h.selector);
      // Composite over whichever surface this element was measured on. The
      // hero CTAs are matched by their base fill, not by a class name.
      const probe = ctxResolve;
      const preVariant = deriveVariant(component, h, colors, probe);
      const onHeroSurface = !!(ctxSurface && component === 'Button'
        && preVariant === 'accent-fill');
      const resolve = onHeroSurface ? ctxSurface.resolve : ctxResolve;
      const variant = deriveVariant(component, h, colors, resolve);
      const diffs = [];
      PROPS.forEach(([label, keys]) => {
        const baseRaw = pick(h.before, keys);
        const hoverRaw = pick(h, keys);
        if (baseRaw === null && hoverRaw === null) return;
        const base = show(label, baseRaw, resolve);
        const hover = show(label, hoverRaw, resolve);
        if (base === null && hover === null) return;
        if (base !== null && hover !== null && base === hover) return;   // unchanged
        const fmt = v => (v === null ? '—' : '`' + v + '`');
        diffs.push(`${label}: ${fmt(base)} → ${fmt(hover)}`);
      });
      if (!diffs.length) return;
      rows.push({ component, variant, change: diffs.join('<br>') });
    });

    // Collapse rules that describe the same variant undergoing the same
    // change — the five svg-card sub-element rules are one behaviour.
    const seenRows = new Set();
    const unique = [];
    rows.forEach(r => {
      const key = r.component + '|' + (r.variant || '') + '|' + r.change;
      if (seenRows.has(key)) return;
      seenRows.add(key);
      unique.push(r);
    });
    unique.sort((a, b) => a.component.localeCompare(b.component)
      || String(a.variant).localeCompare(String(b.variant))
      || a.change.localeCompare(b.change));
    disambiguate(unique);

    // A measured focus ring is a fact, so it belongs in the measured table
    // rather than the recommendations. This closes one of the gaps listed in
    // docs/AUDIT-v3.md — the extractor now reads :focus-visible declarations.
    const fr = (t.inputStyles || {}).focusRing;
    const measuredFocus = [];
    if (fr && typeof fr === 'object') {
      const bits = [];
      const outline = fr.outline ? resolveInString(String(fr.outline), ctxResolve) : null;
      if (outline && outline.trim()) bits.push(`outline: \`${outline.trim()}\``);
      if (len(fr.outlineOffset)) bits.push(`offset: \`${len(fr.outlineOffset)}\``);
      const ring = fr.boxShadow ? resolveInString(String(fr.boxShadow), ctxResolve) : null;
      if (ring && ring.trim()) bits.push(`box-shadow: \`${ring.trim()}\``);
      if (bits.length) measuredFocus.push(['Input', '—', 'focus', bits.join('<br>')]);
    }

    const btnTrans = timing(((t.buttonStyles || {}).primary || {}).transition);
    let out = '## Interaction states\n\n';
    if (unique.length || measuredFocus.length) {
      out += '### Measured\n\n'
        + "Observed on the live page. The capture's `before` object is the element's "
        + '**base** state, so each cell reads base → hover; `—` means that side was '
        + 'not captured.\n\n'
        + table(['Component', 'Variant', 'State', 'Change'],
            unique.map(r => [r.component, r.variant ? '`' + r.variant + '`' : '—', 'hover', r.change])
              .concat(measuredFocus))
        + '\n\n';
      if (btnTrans) out += `Buttons transition with \`${btnTrans}\`.\n\n`;
    }
    const RECS = [
      ['focus', 'Render a visible focus ring on every interactive element — 2px, offset 2px, using `accent` or `border`.'],
      ['active', 'Apply a small positional shift or a darker fill; never remove the focus ring.'],
      ['disabled', 'Reduce opacity to ~0.5 and remove hover/active feedback entirely.'],
    ].filter(([st]) => !(st === 'focus' && measuredFocus.length));
    out += '### Recommended (not observed)\n\n'
      + 'The extraction measured only `:hover`. Treat these as defaults, not as facts '
      + 'about the source.\n\n'
      + RECS.map(([st, txt]) => `- **${st}** — ${txt}`).join('\n');
    return out.trim();
  }



  function sectionComponentAnatomy(ctx) {
    const { t } = ctx;
    const parts = [];
    const vp = t.visualProfile || {};
    const ui = vp.uiPatterns || t.typographyPatterns || {};

    // Repeating grids: the structure an agent has to rebuild.
    const gridRows = [];
    const mg = t.masonryGrid;
    if (mg && typeof mg === 'object') {
      const bits = [];
      if (int(mg.columns) !== null) bits.push(`${int(mg.columns)} columns`);
      if (word(mg.layoutMethod)) bits.push(word(mg.layoutMethod));
      if (int(mg.entryCount) !== null) bits.push(`${int(mg.entryCount)} entries`);
      if (mg.heightRange && int(mg.heightRange.min) !== null && int(mg.heightRange.max) !== null) {
        bits.push(`heights ${int(mg.heightRange.min)}–${int(mg.heightRange.max)}px`);
      }
      bits.push(mg.hasVaryingWidths === true ? 'varying widths' : 'equal widths');
      // Never `mg.class` — "problem-grid" tells an agent the section is about
      // a problem and invites it to write matching copy.
      gridRows.push([`masonry grid (${int(mg.columns) || '?'} col)`, bits.join(', ')]);
    }
    if (ui.hasPricingGrid === true) {
      const pc = int(ui.pricingColumnCount);
      gridRows.push(['pricing grid', pc !== null ? `${pc} columns` : 'present']);
    }
    // Explicit grid templates measured on sections.
    (Array.isArray(t.sectionContentMap) ? t.sectionContentMap : []).forEach(sec => {
      const g = sec && typeof sec.gridCols === 'string' ? sec.gridCols.trim() : null;
      if (!g || g.length > 80 || !/^[0-9. pxrowsfr:]+$/i.test(g)) return;
      // Everything after `rows:` describes rows, not columns.
      const colPart = g.split(/rows\s*:/i)[0];
      const tracks = colPart.split(/\s+/).filter(x => /px|fr/.test(x));
      const cols = tracks.filter(x => parseFloat(x) > 20).length;
      // Narrow tracks between columns are rendered dividers, not content.
      const dividers = tracks.filter(x => parseFloat(x) > 0 && parseFloat(x) <= 4);
      if (cols > 1) {
        const label = `${cols}-column grid`
          + (dividers.length ? ` with ${dividers[0]} dividers` : '');
        gridRows.push([label, `\`${g}\``]);
      }
    });
    if (gridRows.length) {
      parts.push('### Grids\n\n' + table(['Grid', 'Structure'], gridRows));
    }

    // Interaction patterns present on the page.
    const patternRows = [];
    [['hasAccordion', 'Accordion', 'expand/collapse; only the open panel shows its body'],
     ['hasMarquee', 'Marquee', 'continuous horizontal track — see the `ticker` keyframe'],
     ['hasLogoStrip', 'Logo strip', 'horizontal row of marks'],
     ['hasTabSection', 'Tabs', 'one panel visible at a time'],
     ['hasTestimonialCarousel', 'Testimonial carousel', 'paged quotes'],
     ['hasStepIndicator', 'Step indicator', 'ordered progress'],
     ['hasCounterSection', 'Counter section', 'animated numerals'],
     ['hasDecorativeGeometry', 'Decorative geometry', 'non-semantic background shapes']]
      .forEach(([k, label, note]) => {
        if (ui[k] !== true) return;
        const count = k === 'hasDecorativeGeometry' ? int(ui.decorativeGeometryCount) : null;
        patternRows.push([label, note + (count !== null ? ` (${count} instances)` : '')]);
      });
    if (patternRows.length) {
      parts.push('### Patterns\n\n' + table(['Pattern', 'Behaviour'], patternRows));
    }

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
    const { colors, t } = ctx;
    const bg = colors.background;
    if (!bg) return null;
    const PAIRS = [
      ['text-primary', 'background'], ['text-secondary', 'background'], ['text-muted', 'background'],
      ['text-primary', 'surface'], ['primary', 'background'],
    ];
    const rows = [];
    // The hero paints its own background, so its heading is a distinct
    // pairing that the token-vs-token table would never surface.
    const vp = t.visualProfile || {};
    const resolve = (colors._meta && colors._meta.resolve) || (v => hex(v));
    const rh0 = (Array.isArray(vp.sectionRhythm) ? vp.sectionRhythm : [])[0] || {};
    const sc0 = (Array.isArray(t.sectionContentMap) ? t.sectionContentMap : [])[0] || {};
    const heroBg = resolve(rh0.bgHex || sc0.bgColor);
    const heroFg = resolve(((t.typographyPatterns || {}).h1 || {}).color);
    if (heroBg && heroFg && heroBg !== bg) {
      const cr = contrast(heroFg, heroBg);
      if (cr !== null) {
        rows.push([`hero heading \`${heroFg}\` on hero \`${heroBg}\``, cr.toFixed(2) + ':1',
          cr >= 7 ? 'AAA' : cr >= 4.5 ? 'AA' : cr >= 3 ? '**AA large text only**' : '**fails**']);
      }
    }
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

  // The render context is a VIEW of the model, not a second derivation. Nothing
  // here computes a design value; it only gives the section renderers the short
  // names they already use. Add a field to lib/design-model.js, not here.
  function buildContext(tokens, opts) {
    const m = MODEL.buildDesignModel(tokens, { sourceUrl: opts.sourceUrl });
    return {
      model: m,
      t: m.tokens,
      colors: m.colors,
      typo: m.typography,
      spacing: m.spacing,
      radius: m.radius,
      shadows: m.shadows,
      breakpoints: m.breakpoints,
      shape: m.shape,
      heroSurface: m.heroSurface,
      name: m.source.name,
      style: m.theme.style,
      opts,
    };
  }

  // ── estimated DESIGN.md (§4.6) ──────────────────────────────────────────
  // An image gives a style DIRECTION, not a measured system. This document
  // says so in its frontmatter, in every section, and in the instructions an
  // agent reads — and it leaves out what a still image cannot contain: motion,
  // interaction states, component anatomy, layout, spacing, elevation.
  const EST_NOTE = '_Estimated from image — a starting point, not a measurement._';

  function buildEstimatedDesignMd(model, opts) {
    const name = (model.source && model.source.name) || 'Image';
    const colors = model.colors || {};
    const roles = (model.colorRoles || []).filter(k => k !== '_meta' && colors[k]);
    const dir = (model.typography && model.typography.direction) || {};
    const fonts = model.fonts || [];
    const readFonts = fonts.filter(f => !f.suggested);
    const suggFonts = fonts.filter(f => f.suggested);
    const ic = model.iconography || {};
    const ev = model.evidence || {};
    const NO_EVIDENCE = 'not enough evidence in this image';
    const lacking = k => ev[k] === 'insufficient';
    // A pattern, illustration or photo: no interface, so no typography, no
    // fonts, no container. Those blocks are absent, not marked insufficient.
    const noInterface = model.hasInterface === false;
    const hasText = model.hasText !== false;
    const NO_INTERFACE = 'This image contains no interface; the direction covers palette, motif and texture only.';
    const parts = [];

    // Frontmatter. The two lines an agent must see first come first.
    const L = ['---'];
    L.push(`name: ${yamlStr(name + ' Style Direction')}`);
    L.push('source-type: image');
    L.push('confidence: estimated');
    L.push(`source: ${yamlStr(name)}   # a static image; nothing was measured`);
    L.push(`generated_by: ${yamlStr('VibeDesign ' + (opts.version || 'dev'))}`);
    if (model.theme && model.theme.style) L.push(`style: ${yamlStr(model.theme.style)}`);
    if (roles.length) { L.push('colors:'); roles.forEach(k => L.push(`  ${k}: ${yamlStr(colors[k])}`)); }
    if (model.imageKind) L.push(`image-kind: ${model.imageKind}`);
    if (hasText && (dir.classification || dir.weightCharacter)) {
      L.push('typography:');
      if (dir.classification) L.push(`  classification: ${yamlStr(dir.classification)}`);
      if (dir.weightCharacter) L.push(`  weight: ${yamlStr(dir.weightCharacter)}`);
    }
    L.push('---');
    parts.push(L.join('\n'));

    parts.push(`# ${name} Style Direction`);
    parts.push('> This document was inferred from a single static image. Every value is an '
      + 'estimate. Treat it as a direction to build towards, and measure the real thing '
      + 'before you treat any number here as a token.');

    // Visual direction
    {
      const b = ['## Visual direction', EST_NOTE];
      if (noInterface) b.push(NO_INTERFACE);
      const bits = [];
      if (model.theme) bits.push(`${model.theme.isDark ? 'Dark' : 'Light'} theme`);
      if (model.theme && model.theme.style) bits.push(model.theme.style);
      if (model.density) bits.push(`${model.density.level} density`);
      if (bits.length) b.push(bits.join(' · ') + '.');
      if (model.mood && model.mood.words.length) b.push(`Mood: ${model.mood.words.join(', ')}.`);
      // The hierarchy is the visual direction: what the eye meets, in order.
      b.push('**Hierarchy** — the dominant visual moves, in order:');
      b.push(lacking('hierarchy') ? NO_EVIDENCE
        : (model.hierarchy || []).map((h, i) => `${i + 1}. ${h}`).join('\n'));
      if (model.illustration) b.push(`Illustration / texture: ${lacking('illustration') ? NO_EVIDENCE : model.illustration.style}`);
      parts.push(b.join('\n\n'));
    }

    // Effects — what defines the image. A section of its own, because it is
    // usually the reason the image was chosen.
    {
      const b = ['## Effects', EST_NOTE];
      if (lacking('effects')) b.push(NO_EVIDENCE);
      else {
        b.push(table(['Effect', 'Where', 'Colour', 'Strength', 'Description'], (model.effects || []).map(e => [
          e.type, e.where || '—', e.colour ? '`' + e.colour + '`' : '—', e.strength || '—', e.description || '—'])));
        b.push('Colours are estimates; strengths are relative to the rest of the image.');
      }
      parts.push(b.join('\n\n'));
    }

    // Colors
    if (roles.length) {
      const b = ['## Color usage', EST_NOTE];
      b.push(table(['Role', 'Value', 'Confidence'], roles.map(k => [k, '`' + colors[k] + '`', 'estimated'])));
      b.push('Roles were guessed from prominence and position in the image. Confirm the accent '
        + 'and text colours against the real product before use.');
      parts.push(b.join('\n\n'));
    }

    // Typography — only for an image that has text to read it from.
    if (!noInterface && hasText) {
      const b = ['## Typography', EST_NOTE];
      const rows = [];
      if (dir.classification) rows.push(['Classification', dir.classification]);
      if (dir.weightCharacter) rows.push(['Weight character', dir.weightCharacter]);
      if (rows.length) b.push(table(['Trait', 'Estimate'], rows));
      else b.push('No type direction could be read from this image.');
      b.push('No type scale is given: sizes cannot be measured from an image. Set one from '
        + 'the classification above and the density of the source.');
      parts.push(b.join('\n\n'));
    }

    // Fonts — suggestions exist only when a type direction does.
    if (!noInterface && hasText && (readFonts.length || suggFonts.length)) {
      const b = ['## Fonts', EST_NOTE];
      if (readFonts.length) {
        b.push('Legible in the image:');
        b.push(table(['Family', 'Availability'], readFonts.map(f => [f.family, f.availability || 'unknown'])));
      }
      if (suggFonts.length) {
        b.push('Suggested open fonts (suggested, not observed):');
        b.push(table(['Family', 'Source'], suggFonts.map(f => [f.family, 'Google Fonts'])));
      }
      parts.push(b.join('\n\n'));
    }

    // Components — shape, iconography, illustration, density. No anatomy.
    {
      const b = ['## Components', EST_NOTE];
      const rows = [];
      const ct = model.container || {};
      if (noInterface) { /* no container in a pattern, illustration or photo */ }
      else if (lacking('container')) rows.push(['Container', NO_EVIDENCE]);
      else {
        if (ct.shape) rows.push(['Container shape', ct.shape]);
        if (ct.radiusEstimate) rows.push(['Container radius', ct.radiusEstimate]);
        if (ct.surface) rows.push(['Container surface', ct.surface]);
        if (ct.border) rows.push(['Container border', ct.border]);
      }
      if (model.shape && model.shape.language) rows.push(['Shape language', lacking('shape') ? NO_EVIDENCE : model.shape.language]);
      if (lacking('iconography')) rows.push(['Icons', NO_EVIDENCE]);
      else {
        if (ic.style) rows.push(['Icon style', ic.style]);
        if (ic.weight) rows.push(['Icon weight', ic.weight]);
        if (ic.corners) rows.push(['Icon corners', ic.corners]);
        if (ic.grid) rows.push(['Icon grid', ic.grid]);
      }
      if (model.density) rows.push(['Density', lacking('density') ? NO_EVIDENCE : model.density.level]);
      b.push(rows.length ? table(['Trait', 'Estimate'], rows) : 'No component language could be read from this image.');
      b.push('Radii, borders, paddings and button anatomy are not listed: none of them can be '
        + 'read reliably from a still image.');
      parts.push(b.join('\n\n'));
    }

    // Do / Don't — by image kind. A pattern, illustration or photo is a
    // texture to use, not an interface to reproduce, and the advice says so.
    if (noInterface) {
      parts.push(['## Do', EST_NOTE,
        '- Start from the palette and motif; use the pattern as texture or accent, not as interface structure.',
        '- Measure a real screen before turning any value into a token.'].join('\n'));
      parts.push(['## Don\'t', EST_NOTE,
        '- Don\'t present these values as measured.',
        '- Don\'t invent typography, spacing, motion or states: none were observed.'].join('\n'));
    } else {
      parts.push(['## Do', EST_NOTE,
        '- Start from the palette and type direction above; refine against real screens.',
        '- Keep the shape language and icon style consistent with the estimate.',
        '- Measure the live product before turning any value here into a token.'].join('\n'));
      parts.push(['## Don\'t', EST_NOTE,
        '- Don\'t present these values as measured — they are inferred.',
        '- Don\'t invent motion, interaction states or spacing: none were observed.',
        '- Don\'t treat a suggested font as the source\'s font.'].join('\n'));
    }

    // Agent instructions — the sentence §4.6 requires, first.
    parts.push(['## Agent instructions', EST_NOTE,
      'This is a style direction inferred from an image, not a measured system; treat values as starting points.',
      '- Use the palette roles and type classification as defaults, and say in your output that they are estimates.',
      '- Do not fabricate a type scale, spacing scale, shadows, motion or component states from this file.',
      '- When a measured DESIGN.md for the same product exists, it takes precedence over every value here.'].join('\n'));

    // Accessibility — contrast between estimates is itself an estimate.
    {
      const b = ['## Accessibility', EST_NOTE];
      const bg = colors.background;
      const rows = [];
      if (bg) {
        roles.filter(k => /text|accent/.test(k)).forEach(k => {
          const r = contrast(colors[k], bg);
          if (!r) return;
          rows.push([k + ' / background', r.toFixed(1) + ':1', r >= 4.5 ? 'AA (estimated)' : r >= 3 ? 'AA Large (estimated)' : 'Fails (estimated)']);
        });
      }
      b.push(rows.length ? table(['Pair', 'Ratio', 'Grade'], rows)
                         : 'Contrast could not be estimated: no background/text pair was read.');
      parts.push(b.join('\n\n'));
    }

    return parts.filter(Boolean).join('\n\n') + '\n';
  }

  function buildDesignMd(tokens, options) {
    const opts = Object.assign(
      { sourceUrl: '', scope: 'page', version: 'dev', observedAt: null },
      options || {}
    );
    // §4.6: an image model takes its own path. It never reaches buildContext,
    // because there is no page capture behind it to project.
    if (opts.model && opts.model.sourceType === 'image') return buildEstimatedDesignMd(opts.model, opts);
    if (opts.scope !== 'component') opts.scope = 'page';
    if (!opts.sourceUrl && tokens && typeof tokens.url === 'string') opts.sourceUrl = tokens.url;

    const ctx = buildContext(tokens, opts);
    ctxInverseButton = !!(ctx.colors._meta && ctx.colors._meta.inverseButton);
    ctxResolve = (ctx.colors._meta && ctx.colors._meta.resolve) || (v => hex(v));
    ctxSurface = ctx.heroSurface;
    const parts = [buildFrontmatter(ctx)];

    if (opts.scope === 'component') {
      // Short "component card": frontmatter + the component values + states.
      parts.push(`# ${ctx.name} — Component`);
      const comp = sectionComponents(ctx);
      if (comp) parts.push(comp);
      const st = sectionInteractionStates(ctx);
      if (st) parts.push(st);
      return parts.filter(Boolean).join('\n\n') + '\n';
    }

    parts.push(`# ${ctx.name} Design System`);
    parts.push(sectionVisualDirection(ctx));
    parts.push(sectionLayout(ctx));
    parts.push(sectionColorUsage(ctx));
    parts.push(sectionTypography(ctx));
    parts.push(sectionFonts(ctx));
    parts.push(sectionComponents(ctx));
    parts.push(sectionShadows(ctx));
    parts.push(sectionIconography(ctx));
    parts.push(sectionSpacing(ctx));
    parts.push(sectionDo(ctx));
    parts.push(sectionDont(ctx));
    parts.push(sectionAgentInstructions(ctx));

    parts.push(sectionMotion(ctx));
    parts.push(sectionInteractionStates(ctx));
    parts.push(sectionComponentAnatomy(ctx));
    parts.push(sectionAccessibility(ctx));

    return parts.filter(Boolean).join('\n\n') + '\n';
  }

  return {
    buildDesignMd,
    // exposed for tests
    _siteName: siteName,
    _deriveColors: deriveColors,
    _accessors: { hex, len, num, int, word, shadow, fontStack, timing, duration },
  };
})();

if (typeof self !== 'undefined') {
  self.VD_DESIGN_MD = VD_DESIGN_MD;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VD_DESIGN_MD;
}

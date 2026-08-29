// VibeDesign — panel component library (v3.0)
//
// Implements docs/SIDEPANEL-IA.md §8 (component inventory) and §4 (screens).
//
// Every function here is PURE: model in, HTML string out. No chrome APIs, no
// DOM reads, no state. That is what makes the panel testable — the whole side
// panel can be rendered and asserted on in Node without a browser, and the
// snapshot tests in tests/ui-render.test.js do exactly that.
//
// Wiring, state and chrome calls live in lib/ui-helpers.js. If a function here
// starts needing `state` or `chrome`, it belongs there instead.
//
// ── One component per meaning (§8) ────────────────────────────────────────
// The old panel drew provider choice, model choice, focus filter and mode with
// the same chip, so nothing on screen distinguished "pick one mode" from
// "filter by category". The inventory below is enforced by a test:
//
//   Button primary  the screen's single primary action
//   Button ghost    secondary action
//   Segmented       mutually exclusive mode      (Page/Element, Output)
//   Select          one choice from a list       (Provider, Model, Target)
//   Chip            filter                       (Focus, under Refine)
//   Stat tile       a number worth reading first
//   Swatch strip    colour roles
//   KV row          label → value, everywhere
//   Section         titled group inside a tab
//   Card            frames a primary area        (Export only)
//   Notice          one-line state + action
//   Tab bar         primary navigation, sticky, bottom
//   Sheet           temporary full-height surface

const VD_UI = (() => {
  'use strict';

  // ── escaping ────────────────────────────────────────────────────────────
  // Every value that reaches the panel came off somebody's page. It is escaped
  // once, here, and nowhere else — a renderer that interpolates raw text is a
  // bug, and the tests look for exactly that.
  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // For an attribute that must be a safe identifier (ids, data values).
  const slug = v => String(v === null || v === undefined ? '' : v)
    .replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();

  const attr = (name, value) =>
    (value === null || value === undefined || value === false || value === '')
      ? '' : ` ${name}="${esc(value)}"`;

  // ── copy (§9) ───────────────────────────────────────────────────────────
  // The dictionary is here so a string cannot be invented at a call site. A
  // test asserts the panel renders nothing outside it.
  const COPY = {
    homeHelp: 'Reads colors, type, spacing, components, motion and hover states from this page.',
    homeHelpElement: 'Pick an element on the page to read its styles.',
    analyzePage: 'Analyze page',
    pickElement: 'Pick element',
    outputPrompt: 'Rebuild this page in a chat tool.',
    outputDesignMd: 'A style guide your project keeps.',
    outputSkill: 'DESIGN.md + tokens, packaged for coding agents.',
    aiEnhancement: "Optional. Improves the prompt's direction paragraph. Your key stays in this browser.",
    unreadable: "Couldn't read this page. Some sites block extensions; try reloading, or pick an element instead.",
    permission: domain => `VibeDesign needs permission to read ${domain}.`,
    sparse: 'Very little design data on this page. Try a page with more UI.',
    historyEmpty: 'Your analyses will appear here.',
    analyzeFirst: 'Analyze this page first.',
    signInForHistory: 'Sign in to keep history on all your devices.',
    aiSkipped: 'AI enhancement skipped — offline',
    previewRaw: 'Preview raw output',
  };

  const OUTPUTS = [
    { value: 'prompt', label: 'Prompt', help: COPY.outputPrompt, action: 'Copy prompt' },
    { value: 'design-md', label: 'DESIGN.md', help: COPY.outputDesignMd, action: 'Download DESIGN.md' },
    { value: 'skill', label: 'Skill', help: COPY.outputSkill, action: 'Download Skill' },
  ];

  // §10: one line per tool.
  const TARGETS = ['Claude Code', 'Cursor', 'Codex', 'Stitch', 'Antigravity', 'Gemini CLI',
    'Kiro', 'Lovable', 'v0', 'Bolt', 'Replit', 'Claude Design', 'Figma Make'];

  const FOCUSES = [
    { value: 'all', label: 'All' },
    { value: 'colors', label: 'Colors' },
    { value: 'typography', label: 'Type' },
    { value: 'shadows', label: 'Shadow' },
    { value: 'motion', label: 'Motion' },
    { value: 'layout', label: 'Layout' },
    { value: 'components', label: 'Components' },
  ];

  const TABS = [
    { id: 'overview', label: 'Overview', icon: '▣', category: false },
    { id: 'colors', label: 'Colors', icon: '◑', category: true },
    { id: 'type', label: 'Type', icon: 'A', category: true },
    { id: 'components', label: 'Comps', icon: '▤', category: true },
    { id: 'motion', label: 'Motion', icon: '◠', category: true },
    { id: 'settings', label: 'Settings', icon: '⚙', category: false },
  ];

  // ── primitives (§8) ─────────────────────────────────────────────────────

  function button(o) {
    const variant = o.variant || 'primary';
    const cls = ['vd-btn', 'vd-btn--' + variant, o.full ? 'vd-btn--full' : '']
      .filter(Boolean).join(' ');
    return `<button class="${cls}"${attr('id', o.id)}`
      + attr('aria-label', o.ariaLabel || o.label)
      + (o.disabled ? ' disabled' : '') + attr('data-action', o.action) + '>'
      + (o.icon ? `<span class="vd-btn__icon" aria-hidden="true">${esc(o.icon)}</span>` : '')
      + `<span class="vd-btn__label">${esc(o.label)}</span></button>`;
  }

  // Mutually exclusive mode. Never a list choice — that is `select`.
  function segmented(o) {
    const items = (o.options || []).map(opt => {
      const on = opt.value === o.value;
      return `<button class="vd-seg__item${on ? ' is-on' : ''}" role="radio"`
        + ` aria-checked="${on}"${attr('data-' + (o.key || 'seg'), opt.value)}>`
        + `${esc(opt.label)}</button>`;
    }).join('');
    return `<div class="vd-seg" role="radiogroup"${attr('id', o.id)}`
      + attr('aria-label', o.ariaLabel) + `>${items}</div>`;
  }

  function select(o) {
    const opts = (o.options || []).map(opt => {
      const value = typeof opt === 'string' ? opt : opt.value;
      const label = typeof opt === 'string' ? opt : opt.label;
      return `<option value="${esc(value)}"${value === o.value ? ' selected' : ''}>`
        + `${esc(label)}</option>`;
    }).join('');
    return `<select class="vd-select"${attr('id', o.id)}`
      + attr('aria-label', o.ariaLabel || o.label) + `>${opts}</select>`;
  }

  // A filter. Never a mode, never a list choice.
  function chip(o) {
    return `<button class="vd-chip${o.active ? ' is-on' : ''}" role="radio"`
      + ` aria-checked="${!!o.active}"${attr('data-focus', o.value)}>${esc(o.label)}</button>`;
  }

  function statTile(o) {
    return '<div class="vd-stat">'
      + `<div class="vd-stat__value">${esc(o.value)}</div>`
      + `<div class="vd-stat__label">${esc(o.label)}</div></div>`;
  }

  function swatchStrip(entries) {
    if (!entries || !entries.length) return '';
    const cells = entries.map(e =>
      `<button class="vd-swatch" style="background:${esc(e.hex)}"`
      + ` title="${esc(e.role)} · ${esc(e.hex)}"`
      + ` aria-label="${esc(e.role)} ${esc(e.hex)}"${attr('data-role', e.role)}></button>`
    ).join('');
    return `<div class="vd-swatches" role="list" aria-label="Colour roles">${cells}</div>`;
  }

  // The one row component. Snapshot, every category list, and Settings all use
  // it, so a value looks the same wherever it appears.
  function kvRow(o) {
    const dot = o.swatch
      ? `<span class="vd-kv__dot" style="background:${esc(o.swatch)}" aria-hidden="true"></span>`
      : '';
    const value = o.mono === false
      ? `<span class="vd-kv__value">${esc(o.value)}</span>`
      : `<span class="vd-kv__value vd-kv__value--mono">${esc(o.value)}</span>`;
    const meta = o.meta ? `<span class="vd-kv__meta">${esc(o.meta)}</span>` : '';
    return `<div class="vd-kv">${dot}<span class="vd-kv__label">${esc(o.label)}</span>`
      + value + meta + '</div>';
  }

  function section(o) {
    const action = o.action
      ? `<button class="vd-section__action"${attr('data-action', o.actionId)}>${esc(o.action)}</button>`
      : '';
    return `<section class="vd-section"${attr('id', o.id)}>`
      + (o.title ? `<div class="vd-section__head"><h2 class="vd-section__title">${esc(o.title)}</h2>${action}</div>` : '')
      + `<div class="vd-section__body">${o.body || ''}</div></section>`;
  }

  // Frames a primary area. Export only — not a wrapper for every block.
  function card(o) {
    return `<div class="vd-card"${attr('id', o.id)}>`
      + (o.title ? `<div class="vd-card__title">${esc(o.title)}</div>` : '')
      + (o.body || '') + '</div>';
  }

  function notice(o) {
    const tone = o.tone || 'info';
    const action = o.action
      ? `<button class="vd-notice__action"${attr('data-action', o.actionId)}>${esc(o.action)}</button>`
      : '';
    const dismiss = o.dismissId
      ? `<button class="vd-notice__dismiss" aria-label="Dismiss"${attr('data-action', o.dismissId)}>×</button>`
      : '';
    return `<div class="vd-notice vd-notice--${esc(tone)}"${attr('id', o.id)} role="status">`
      + `<span class="vd-notice__text">${esc(o.text)}</span>${action}${dismiss}</div>`;
  }

  function sheet(o) {
    return `<div class="vd-sheet" id="${esc(o.id)}" hidden role="dialog" aria-modal="true"`
      + attr('aria-label', o.title) + '>'
      + '<div class="vd-sheet__head">'
      + `<h2 class="vd-sheet__title">${esc(o.title)}</h2>`
      + (o.action ? `<button class="vd-sheet__action"${attr('data-action', o.actionId)}>${esc(o.action)}</button>` : '')
      + `<button class="vd-sheet__close" aria-label="Close"${attr('data-action', o.closeId)}>×</button>`
      + '</div>'
      + `<div class="vd-sheet__body"${attr('id', o.bodyId)}>${o.body || ''}</div></div>`;
  }

  // Primary navigation. Sticky, bottom, always the same six.
  function tabBar(o) {
    const active = o.active || 'overview';
    const ready = !!o.ready;
    const items = TABS.map(t => {
      const dim = t.category && !ready;
      return `<button class="vd-tab${t.id === active ? ' is-on' : ''}${dim ? ' is-dim' : ''}"`
        + ` role="tab" aria-selected="${t.id === active}"`
        + (dim ? ' aria-disabled="true"' : '')
        + ` data-tab="${esc(t.id)}">`
        + `<span class="vd-tab__icon" aria-hidden="true">${esc(t.icon)}</span>`
        + `<span class="vd-tab__label">${esc(t.label)}</span></button>`;
    }).join('');
    return `<nav class="vd-tabbar" role="tablist" aria-label="Sections">${items}</nav>`;
  }

  // ── model → view helpers ────────────────────────────────────────────────

  // §4.2: "numbers come from the model; a tile with no number is not drawn"
  // (never a zero — a zero reads as a measurement, and it is an absence).
  function summaryCounts(model) {
    if (!model) return [];
    const t = model.tokens || {};
    const comps = Object.keys(t.buttonStyles || {}).filter(k => t.buttonStyles[k]).length
      + (t.cardStyles ? 1 : 0) + (t.inputStyles ? 1 : 0);
    return [
      { value: (model.colorRoles || []).length, label: 'Colors' },
      { value: (model.fonts || []).length, label: 'Fonts' },
      { value: comps, label: 'Comps' },
      { value: (Array.isArray(t.animations) ? t.animations : []).length, label: 'Keyframes' },
    ].filter(s => s.value > 0);
  }

  function paletteEntries(model) {
    if (!model) return [];
    return (model.colorRoles || []).map(role => ({ role, hex: model.colors[role] }));
  }

  // §4.2 Snapshot. Each row is omitted when the model has nothing for it.
  function snapshotRows(model) {
    if (!model) return [];
    const rows = [];
    const t = model.tokens || {};

    const bg = model.colors.background;
    const fg = model.colors['text-primary'];
    let theme = model.theme.isDark ? 'Dark' : 'Light';
    if (bg && fg && VD_UI._contrast) {
      const ratio = VD_UI._contrast(fg, bg);
      if (ratio) theme += ratio >= 12 ? ' · high contrast' : ratio >= 7 ? ' · strong contrast' : '';
    }
    rows.push({ label: 'Theme', value: theme, mono: false });

    if (model.theme.style) rows.push({ label: 'Style', value: model.theme.style, mono: false });

    const families = Object.keys(model.typography.stacks || {})
      .map(k => model.typography.stacks[k]);
    if (families.length) {
      rows.push({ label: 'Type', value: [...new Set(families)].join(' / '), mono: false });
    }

    if (model.shape && model.shape.size) {
      rows.push({ label: 'Shape', value: `Chamfer ${model.shape.size} · radius ${model.radius.button || '0px'}` });
    } else if (model.radius && model.radius.button) {
      rows.push({ label: 'Shape', value: `Radius ${model.radius.button}` });
    }

    const kf = (Array.isArray(t.animations) ? t.animations : []).length;
    const loops = (Array.isArray(t.ambientAnimations) ? t.ambientAnimations : []).length;
    if (kf || loops) {
      const parts = [];
      if (loops) parts.push(`Ambient · ${loops} loop${loops === 1 ? '' : 's'}`);
      if (kf) parts.push(`${kf} keyframes`);
      rows.push({ label: 'Motion', value: parts.join(' · '), mono: false });
    }

    // Stack only when the page actually declared one. rig.ai does not, and the
    // row is simply absent rather than filled with a guess.
    const fw = t.frameworkDetection || {};
    const stack = []
      .concat(Array.isArray(fw.jsFrameworks) ? fw.jsFrameworks : [])
      .concat(Array.isArray(fw.cssFrameworks) ? fw.cssFrameworks : [])
      .concat(fw.isFramer ? ['Framer'] : [], fw.isWebflow ? ['Webflow'] : [])
      .filter(v => typeof v === 'string' && v);
    if (stack.length) rows.push({ label: 'Stack', value: [...new Set(stack)].join(' · '), mono: false });

    return rows;
  }

  // Contrast is colour maths, and lib/color-utils.js owns that. It is injected
  // rather than imported so this file stays free of load-order assumptions;
  // when it is absent, contrast simply is not reported (never estimated).
  let _contrast = null;
  function useContrast(fn) { _contrast = typeof fn === 'function' ? fn : null; }
  const contrast = (a, b) => {
    if (!_contrast || !a || !b) return null;
    try { const v = _contrast(a, b); return Number.isFinite(v) ? v : null; } catch (e) { return null; }
  };

  return {
    esc, slug, attr,
    button, segmented, select, chip, statTile, swatchStrip, kvRow,
    section, card, notice, sheet, tabBar,
    summaryCounts, paletteEntries, snapshotRows,
    useContrast,
    get _contrast() { return _contrast ? contrast : null; },
    COPY, OUTPUTS, TARGETS, FOCUSES, TABS,
  };
})();

// Wire the colour maths in, however this file was loaded.
(() => {
  const CU = (() => {
    if (typeof module !== 'undefined' && module.exports) {
      try { return require('./color-utils.js'); } catch (e) { /* fall through */ }
    }
    return (typeof self !== 'undefined') ? self : globalThis;
  })();
  if (CU && typeof CU.wcagContrast === 'function') VD_UI.useContrast(CU.wcagContrast);
})();

if (typeof self !== 'undefined') self.VD_UI = VD_UI;
if (typeof module !== 'undefined' && module.exports) module.exports = VD_UI;

// ── screens (§4) ──────────────────────────────────────────────────────────
// Each returns the inner HTML of one tab panel. All pure; the caller decides
// which panel is visible.

const VD_VIEWS = (() => {
  'use strict';
  const U = VD_UI;
  const { esc, kvRow, section, COPY } = U;

  const rows = list => list.map(kvRow).join('');

  // §4.1 — Overview before an analysis exists. No settings on this screen at
  // all: the whole point of the rebuild is that configuration is behind a tab.
  function homeView(o) {
    const opts = o || {};
    const isElement = opts.mode === 'element';
    return U.segmented({
      id: 'vdModeSeg', key: 'mode', value: opts.mode || 'page',
      ariaLabel: 'Analysis mode',
      options: [{ value: 'page', label: 'Page' }, { value: 'element', label: 'Element' }],
    })
      + '<div class="vd-home__action">'
      + U.button({
          id: 'analyzeBtn', full: true,
          label: isElement ? COPY.pickElement : COPY.analyzePage,
        })
      + `<p class="vd-home__help">${esc(isElement ? COPY.homeHelpElement : COPY.homeHelp)}</p>`
      + '</div>'
      + (opts.recent && opts.recent.length
          ? section({
              title: 'Recent',
              body: opts.recent.map(r =>
                `<button class="vd-recent" data-restore="${esc(r.key)}">`
                + `<span class="vd-recent__domain">${esc(r.domain)}</span>`
                + `<span class="vd-recent__ago">${esc(r.ago)}</span>`
                + `<span class="vd-recent__meta">${esc(r.meta)}</span></button>`).join(''),
            })
          : '');
  }

  // §4.2 — Overview after an analysis.
  function overviewView(model, o) {
    const opts = o || {};
    const counts = U.summaryCounts(model);
    const parts = [];

    // §4.5 sparse: one line instead of a strip of ones and twos.
    if (counts.length < 2) {
      parts.push(U.notice({ text: COPY.sparse, tone: 'warn' }));
    } else {
      parts.push(`<div class="vd-stats">${counts.map(U.statTile).join('')}</div>`);
    }

    const palette = U.paletteEntries(model);
    if (palette.length) parts.push(U.swatchStrip(palette));

    const snap = U.snapshotRows(model);
    if (snap.length) parts.push(section({ title: 'Snapshot', body: rows(snap) }));

    parts.push(exportCard(model, opts));

    const sp = (model.tokens && model.tokens.visualProfile && model.tokens.visualProfile.spacingSystem) || {};
    const layout = [];
    if (sp.containerMaxWidth) layout.push(`Container ${sp.containerMaxWidth}`);
    if (sp.sectionPaddingY) layout.push(`Section ${sp.sectionPaddingY}`);
    const sectionCount = (model.tokens && Array.isArray(model.tokens.sectionContentMap))
      ? model.tokens.sectionContentMap.length : 0;
    if (sectionCount) layout.push(`${sectionCount} sections`);
    if (layout.length) {
      parts.push(section({ title: 'Layout',
        body: `<p class="vd-line">${esc(layout.join(' · '))}</p>` }));
    }

    parts.push(`<button class="vd-link" data-action="previewRaw">${esc(COPY.previewRaw)} ▸</button>`);
    return parts.join('');
  }

  // §4.2 Export card — one primary button whose label follows the selection.
  function exportCard(model, o) {
    const opts = o || {};
    const output = opts.output || 'prompt';
    const chosen = U.OUTPUTS.find(x => x.value === output) || U.OUTPUTS[0];
    const body = [];

    body.push(U.segmented({
      id: 'vdOutputSeg', key: 'output', value: output, ariaLabel: 'Output',
      options: U.OUTPUTS.map(x => ({ value: x.value, label: x.label })),
    }));
    body.push(`<p class="vd-card__help">${esc(chosen.help)}</p>`);

    if (output === 'prompt') {
      body.push('<div class="vd-field"><span class="vd-field__label">For</span>'
        + U.select({ id: 'vdTargetSelect', ariaLabel: 'Target', value: opts.target || U.TARGETS[0],
                     options: U.TARGETS }) + '</div>');
      body.push('<details class="vd-disclose" id="vdRefine"><summary>Refine</summary>'
        + '<div class="vd-chips" role="radiogroup" aria-label="Focus">'
        + U.FOCUSES.map(f => U.chip({ value: f.value, label: f.label,
                                      active: f.value === (opts.focus || 'all') })).join('')
        + '</div></details>');
    } else {
      // §4.2: DESIGN.md and Skill get "Where to put it" instead of a target.
      body.push('<details class="vd-disclose" id="vdWhere"><summary>Where to put it</summary>'
        + '<div class="vd-where">'
        + U.TARGETS.map(t => `<div class="vd-where__row">${esc(t)}<span class="vd-where__path">`
            + esc(wherePath(t, output)) + '</span></div>').join('')
        + '</div></details>');
    }

    body.push(U.button({ id: 'vdExportBtn', full: true, label: chosen.action }));
    if (opts.meta) body.push(`<p class="vd-card__meta">${esc(opts.meta)}</p>`);
    if (opts.aiSkipped) body.push(`<p class="vd-card__meta">${esc(COPY.aiSkipped)}</p>`);

    return U.card({ id: 'vdExportCard', title: 'Export', body: body.join('') });
  }

  // One line per tool, per §10.3. A file path, not advice.
  const WHERE = {
    'Claude Code': 'CLAUDE.md, or the repo root',
    'Cursor': '.cursor/rules/',
    'Codex': 'AGENTS.md',
    'Stitch': 'Paste into the brief',
    'Antigravity': 'Repo root',
    'Gemini CLI': 'GEMINI.md',
    'Kiro': '.kiro/steering/',
    'Lovable': 'Knowledge, in project settings',
    'v0': 'Paste into the chat',
    'Bolt': 'Paste into the chat',
    'Replit': 'replit.md',
    'Claude Design': 'Attach to the conversation',
    'Figma Make': 'Paste into the brief',
  };
  function wherePath(tool, output) {
    const base = WHERE[tool] || 'Repo root';
    return output === 'skill' ? base.replace(/^CLAUDE\.md, or the repo root$/, '.claude/skills/') : base;
  }

  // ── category tabs (§4.2) — full lists, one row type ──────────────────────

  function colorsView(model) {
    if (!model) return '';
    const roleHelp = {
      background: 'Page canvas', 'text-primary': 'Body, headings',
      'text-secondary': 'Supporting copy', 'text-muted': 'Captions, meta',
      accent: 'Primary action, highlights', primary: 'Primary action',
      border: 'Dividers, outlines', 'border-subtle': 'Hairlines',
      success: 'Positive state', warning: 'Caution state', danger: 'Error state',
    };
    const list = (model.colorRoles || []).map(role => kvRow({
      label: role, value: model.colors[role], swatch: model.colors[role],
      meta: roleHelp[role] || '',
    })).join('');

    const parts = [section({ title: 'Colors', action: 'Export ▸', actionId: 'gotoExport', body: list })];

    const bg = model.colors.background;
    const pairs = ['text-primary', 'text-secondary', 'text-muted', 'accent']
      .filter(r => model.colors[r] && bg)
      .map(r => {
        const ratio = VD_UI._contrast ? VD_UI._contrast(model.colors[r], bg) : null;
        if (!ratio) return null;
        const grade = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA Large' : 'Fails';
        return kvRow({ label: `${r} / background`, value: ratio.toFixed(1) + ':1', meta: grade });
      }).filter(Boolean).join('');
    if (pairs) parts.push(section({ title: 'Contrast', body: pairs }));
    return parts.join('');
  }

  function typeView(model) {
    if (!model) return '';
    const parts = [];
    const fonts = (model.fonts || []).map(f => kvRow({
      label: f.family, value: f.availability, mono: false,
      meta: f.steps && f.steps.length ? f.steps.join(', ') : '',
    })).join('');
    parts.push(section({ title: 'Type', action: 'Export ▸', actionId: 'gotoExport',
                         body: fonts || '<p class="vd-line">No font files were observed.</p>' }));

    const subs = (model.fonts || []).filter(f => f.alternative)
      .map(f => kvRow({ label: f.family, value: f.alternative, mono: false })).join('');
    if (subs) {
      parts.push(section({ title: 'Substitutes — suggested, not observed', body: subs }));
    }

    const detail = (model.typography && model.typography.detail) || {};
    const scale = Object.keys(detail).filter(k => detail[k] && detail[k].size).map(step => {
      const d = detail[step];
      const bits = [d.size];
      if (d.weight) bits.push(String(d.weight));
      if (d.lineHeight) bits.push(d.lineHeight);
      if (d.tracking) bits.push(d.tracking);
      return kvRow({ label: step, value: bits.join(' · '), meta: d.family || '' });
    }).join('');
    if (scale) parts.push(section({ title: 'Scale', body: scale }));
    return parts.join('');
  }

  function componentsView(model) {
    if (!model) return '';
    const t = model.tokens || {};
    const parts = [];

    if (model.shape && model.shape.clipPath) {
      parts.push(U.notice({
        text: `Angular shape language — buttons are chamfered ${model.shape.size} with a clip-path, not a radius.`,
        tone: 'info',
      }));
    }

    const buttons = t.buttonStyles || {};
    const btnRows = Object.keys(buttons).filter(k => buttons[k]).map(k => {
      const b = buttons[k];
      const bits = [];
      if (b.padding) bits.push(b.padding);
      if (b.height) bits.push(b.height);
      if (b.fontSize) bits.push(b.fontSize);
      return kvRow({ label: k, value: bits.join(' · ') || '—',
                     swatch: b.backgroundColor || null });
    }).join('');
    parts.push(section({ title: 'Components', action: 'Export ▸', actionId: 'gotoExport',
                         body: btnRows || '<p class="vd-line">No buttons were matched.</p>' }));

    const card = t.cardStyles;
    if (card) {
      const bits = [];
      if (card.padding) bits.push(card.padding);
      if (model.radius.card) bits.push(model.radius.card);
      if (card.count) bits.push(`${card.count} seen`);
      parts.push(section({ title: 'Cards', body: kvRow({ label: 'card', value: bits.join(' · ') })
        + (card.border ? kvRow({ label: 'border', value: card.border }) : '')
        + (card.backgroundIsInherited
            ? kvRow({ label: 'background', value: 'inherited from the page', mono: false }) : '') }));
    }

    const input = t.inputStyles;
    if (input) {
      const bits = [];
      if (input.padding) bits.push(input.padding);
      if (input.height) bits.push(input.height);
      if (input.fontSize) bits.push(input.fontSize);
      parts.push(section({ title: 'Fields', body: kvRow({ label: 'field', value: bits.join(' · ') })
        + (input.border ? kvRow({ label: 'border', value: input.border }) : '')
        + (input.focusRing && input.focusRing.outline
            ? kvRow({ label: 'focus ring', value: input.focusRing.outline }) : '') }));
    }
    return parts.join('');
  }

  function motionView(model) {
    if (!model) return '';
    const t = model.tokens || {};
    const parts = [];

    const ambient = (Array.isArray(t.ambientAnimations) ? t.ambientAnimations : [])
      .map(a => kvRow({ label: a.name, value: a.duration || '—', meta: a.location || '' })).join('');
    parts.push(section({ title: 'Motion', action: 'Export ▸', actionId: 'gotoExport',
      body: ambient || '<p class="vd-line">No ambient loops were observed.</p>' }));

    const kf = (Array.isArray(t.animations) ? t.animations : [])
      .map(a => kvRow({ label: a.name, value: a.to ? 'two frames' : 'one frame', mono: false })).join('');
    if (kf) parts.push(section({ title: 'Keyframes', body: kf }));

    const tr = (Array.isArray(t.transitions) ? t.transitions : [])
      .filter(v => typeof v === 'string' && v.length < 120)
      .map(v => kvRow({ label: 'transition', value: v })).join('');
    if (tr) parts.push(section({ title: 'Transitions', body: tr }));

    // §4.2: measured and recommended states are kept apart. Only :hover and a
    // declared :focus-visible are measured; the rest are advice.
    const hover = (Array.isArray(t.hoverStates) ? t.hoverStates : []).length;
    const measured = [];
    if (hover) measured.push(kvRow({ label: ':hover', value: `${hover} measured`, mono: false }));
    if (t.inputStyles && t.inputStyles.focusRing && t.inputStyles.focusRing.outline) {
      measured.push(kvRow({ label: ':focus-visible', value: t.inputStyles.focusRing.outline }));
    }
    if (measured.length) parts.push(section({ title: 'States — measured', body: measured.join('') }));
    parts.push(section({ title: 'States — recommended, not observed',
      body: kvRow({ label: ':active', value: 'not captured', mono: false })
        + kvRow({ label: '[disabled]', value: 'not captured', mono: false }) }));
    return parts.join('');
  }

  return { homeView, overviewView, exportCard, colorsView, typeView, componentsView, motionView, wherePath };
})();

if (typeof self !== 'undefined') self.VD_VIEWS = VD_VIEWS;
if (typeof module !== 'undefined' && module.exports) module.exports.VD_VIEWS = VD_VIEWS;

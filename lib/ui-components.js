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
    allowAccess: 'Allow',
    allSites: 'Allow on all sites',
    allSitesHelp: 'Skip the per-site prompt. VibeDesign still only reads a page when you ask it to.',
    sparse: 'Very little design data on this page. Try a page with more UI.',
    stillLoading: 'Page is still loading — try again',
    // §4.6 / §9 — the image source. Estimated, and said to be.
    imageHelp: 'Reads the visual language from a static image: palette, type direction, shape, iconography. Estimated, not measured.',
    imageGate: 'Image analysis needs AI enhancement. Your image goes only to your chosen AI provider.',
    imageBadge: 'Estimated from image',
    imageMotion: "Motion can't be read from a static image. Analyze the live site to measure it.",
    imageUnreadable: "Couldn't read this image — try another",
    analyzeImage: 'Analyze image',
    dropZone: 'Drop an image or click to choose',
    dropZoneHint: 'PNG, JPG or WebP · up to 8 MB',
    aiRequiredForImage: 'Required for image analysis.',
    turnOn: 'Turn on',
    insufficient: 'not enough evidence in this image',
    noInterface: 'This image contains no interface; the direction covers palette, motif and texture only.',
    imageLabel: 'Name this style',
    imageLabelHelp: 'Used as the document title and filename.',
    historyEmpty: 'Your analyses will appear here.',
    // §3 / §9: the anonymous cap. Five analyses a month; a free account lifts
    // it. The remaining count is a caption, not a banner, and the offer is
    // always a control the user can press — never a sentence telling them to
    // go and sign in somewhere.
    capRemaining: (used, limit) => `${used} of ${limit} free analyses this month`,
    capReached: limit => `You've used your ${limit} free analyses this month.`,
    signInUnlimited: 'Sign in for unlimited',
    signIn: 'Sign in',
    signOut: 'Sign out',
    signedInAs: email => `Signed in as ${email}`,
    // §4.5: the server rejected the stored session. The user did nothing
    // wrong and there is nothing to retry, so say so and offer the one thing
    // that works.
    sessionExpired: 'Session expired — sign in again',
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
  // §4.2: a long value wraps UNDER its label rather than being truncated on
  // the right. Snapshot's Style line is a sentence, and cutting it mid-word
  // is how "chamfered vivid animated" became "chamfered vivid…".
  function kvRow(o) {
    const dot = o.swatch
      ? `<span class="vd-kv__dot" style="background:${esc(o.swatch)}" aria-hidden="true"></span>`
      : '';
    const cls = ['vd-kv__value', o.mono === false ? '' : 'vd-kv__value--mono',
                 o.wrap ? 'vd-kv__value--wrap' : ''].filter(Boolean).join(' ');
    const value = `<span class="${cls}">${esc(o.value)}</span>`;
    const meta = o.meta ? `<span class="vd-kv__meta">${esc(o.meta)}</span>` : '';
    return `<div class="vd-kv${o.wrap ? ' vd-kv--stacked' : ''}">`
      + `${dot}<span class="vd-kv__label">${esc(o.label)}</span>`
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
  //
  // §3: icon AND label on every tab — an icon-only bar is not accepted.
  //
  // Sign-in state is NOT advertised here. A dot on a tab is a notification
  // badge: it says "something happened" and gives nothing to press. The header
  // carries an avatar or a Sign in button instead, which is both the state and
  // the action.
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

  // §3: sign-in state lives at the header's right edge, as a control.
  // Signed in it is a 24px avatar; signed out a 28px ghost button that starts
  // the flow. Both land on Settings → Account afterwards, so the state and the
  // way to change it are the same object.
  function accountControl(o) {
    const opts = o || {};
    if (!opts.authed) {
      return '<button class="vd-btn vd-btn--ghost vd-account__signin" id="vdHeaderSignIn"'
        + ` data-action="signIn" aria-label="${esc(COPY.signIn)}">`
        + `<span class="vd-btn__label">${esc(COPY.signIn)}</span></button>`;
    }
    const email = opts.email || '';
    const initial = (email.trim().charAt(0) || '?').toUpperCase();
    const label = email ? `Account — ${email}` : 'Account';
    const inner = opts.avatarUrl
      ? `<img class="vd-account__photo" src="${esc(opts.avatarUrl)}" alt="" />`
      : `<span class="vd-account__initial" aria-hidden="true">${esc(initial)}</span>`;
    return `<button class="vd-account" id="vdHeaderAccount" data-action="openAccount"`
      + ` aria-label="${esc(label)}" title="${esc(email)}">${inner}</button>`;
  }

  // §3: "where am I" is answered twice — the active tab, and an 18px title at
  // the top of the tab's content.
  function tabTitle(text) {
    return `<h1 class="vd-tabtitle">${esc(text)}</h1>`;
  }

  // ── model → view helpers ────────────────────────────────────────────────

  // §4.2: "numbers come from the model; a tile with no number is not drawn"
  // (never a zero — a zero reads as a measurement, and it is an absence).
  // §4.5: "sparse" means the page really had almost nothing — fewer than
  // three colour roles AND no components at all. The previous rule ("fewer
  // than two non-zero tiles") fired on pages that had plenty, which is how a
  // fully-loaded rig.ai came to be told it had very little design data.
  function isSparse(model) {
    if (!model) return true;
    const t = model.tokens || {};
    const roles = (model.colorRoles || []).length;
    const components = Object.keys(t.buttonStyles || {}).filter(k => t.buttonStyles[k]).length
      + (t.cardStyles ? 1 : 0) + (t.inputStyles ? 1 : 0);
    return roles < 3 && components === 0;
  }

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

    // The style line is a sentence, not a token — it wraps.
    if (model.theme.style) {
      rows.push({ label: 'Style', value: model.theme.style, mono: false, wrap: true });
    }

    const families = Object.keys(model.typography.stacks || {})
      .map(k => model.typography.stacks[k]);
    if (families.length) {
      rows.push({ label: 'Type', value: [...new Set(families)].join(' / '),
                  mono: false, wrap: true });
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
    section, card, notice, sheet, tabBar, tabTitle, accountControl,
    summaryCounts, paletteEntries, snapshotRows, isSparse,
    useContrast,
    get _contrast() { return _contrast ? contrast : null; },
    COPY, OUTPUTS, TARGETS, FOCUSES, TABS,
    // Outputs an image model may export. No Skill: a bundle of tokens.json,
    // theme.css and a Tailwind theme presents guesses with the precision of
    // measurements, and §4.6 forbids exactly that.
    IMAGE_OUTPUTS: [
      { value: 'prompt', label: 'Prompt', help: COPY.outputPrompt, action: 'Copy prompt' },
      { value: 'design-md', label: 'DESIGN.md', help: COPY.outputDesignMd, action: 'Download DESIGN.md' },
    ],
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
  // §3 "AI göstergesi": which model will run, on screen, not buried in
  // settings. One caption line under the primary action.
  function aiIndicator(o) {
    const opts = o || {};
    if (!opts.aiEnabled) {
      return '<p class="vd-ai">AI enhancement off · '
        + '<button class="vd-ai__link" data-action="openSettings">Turn on</button></p>';
    }
    const who = [opts.aiProvider, opts.aiModel].filter(Boolean).join(' · ');
    return `<p class="vd-ai">AI enhancement: ${esc(who || 'not configured')} · `
      + '<button class="vd-ai__link" data-action="openSettings">Change</button></p>';
  }

  // §3: the anonymous cap, shown as a caption under the action. Signed-in
  // users never see it — for them there is no count to keep.
  //
  // The sign-in half is a BUTTON, not text: §3 requires that every prompt to
  // sign in is something you can press. "Sign in for unlimited" as prose
  // leaves the reader to find the flow themselves.
  function capLine(o) {
    const opts = o || {};
    if (opts.authed || !opts.usage) return '';
    const { used, limit } = opts.usage;
    if (used >= limit) return '';                 // handled by capBlock instead
    return `<p class="vd-cap">${esc(COPY.capRemaining(used, limit))} · `
      + `<button class="vd-cap__link" data-action="signIn">${esc(COPY.signInUnlimited)}</button></p>`;
  }

  const atLimit = o => !!(o && !o.authed && o.usage && o.usage.used >= o.usage.limit);

  // §4.5: at the limit the primary action becomes the way out of it. One
  // sentence, one button. No "Try again" — there is nothing to retry, and
  // offering it would send the user round the same wall.
  function capBlock(o) {
    const limit = o.usage.limit;
    return `<p class="vd-cap__reached">${esc(COPY.capReached(limit))}</p>`
      + U.button({ id: 'vdSignInUnlimited', full: true, label: COPY.signInUnlimited,
                   action: 'signIn' });
  }

  // §3 "Sayfa bağlamı": a result belongs to a page, and the user can switch
  // tabs. The primary action therefore never disappears — it is always
  // present and always says which page it will read.
  function pageAction(o) {
    const opts = o || {};
    const isElement = opts.mode === 'element';
    // At the cap the analyse action is replaced, not disabled: a dead button
    // says "no" without saying what to do about it.
    if (atLimit(opts)) return capBlock(opts);
    if (isElement) {
      return U.button({ id: 'analyzeBtn', full: true, label: COPY.pickElement });
    }
    // Same page as the result: re-analysing is a secondary act, and the ↺ is
    // never used on its own (§3).
    if (opts.context === 'same') {
      return U.button({ id: 'analyzeBtn', full: true, variant: 'ghost',
                        icon: '↺', label: 'Re-analyze' });
    }
    // A different page: name it, so the button cannot be mistaken for one
    // that would refresh what is on screen.
    if (opts.context === 'other' && opts.domain) {
      return U.button({ id: 'analyzeBtn', full: true, label: `Analyze ${opts.domain}` });
    }
    return U.button({ id: 'analyzeBtn', full: true, label: COPY.analyzePage });
  }

  function homeView(o) {
    const opts = o || {};
    const isElement = opts.mode === 'element';
    return U.tabTitle('Overview')
      + sourceSwitcher('website')
      + U.segmented({
      id: 'vdModeSeg', key: 'mode', value: opts.mode || 'page',
      ariaLabel: 'Analysis mode',
      options: [{ value: 'page', label: 'Page' }, { value: 'element', label: 'Element' }],
    })
      + (opts.permissionNeeded
          ? U.notice({ id: 'vdPermissionNotice', tone: 'warn',
                       text: COPY.permission(opts.permissionNeeded),
                       action: COPY.allowAccess, actionId: 'allowSite' })
          : '')
      + '<div class="vd-home__action">'
      + pageAction(opts)
      + (atLimit(opts) ? ''
          : `<p class="vd-home__help">${esc(isElement ? COPY.homeHelpElement : COPY.homeHelp)}</p>`)
      + capLine(opts)
      + aiIndicator(opts)
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
    // Overview only renders when a model exists, so an unspecified page
    // context means "this is the page it came from". Leaving it undefined
    // would fall through to a primary "Analyze page" sitting next to a primary
    // Export — two primary actions on one screen.
    const opts = Object.assign({}, o || {});
    if (!opts.context) opts.context = 'same';
    const counts = U.summaryCounts(model);
    const parts = [U.tabTitle('Overview'), sourceSwitcher('website')];

    // §4.5: access was refused for this page. Say which page, and give the
    // control that grants it — the analysis itself is still one tap away.
    if (opts.permissionNeeded) {
      parts.push(U.notice({
        id: 'vdPermissionNotice', tone: 'warn',
        text: COPY.permission(opts.permissionNeeded),
        action: COPY.allowAccess, actionId: 'allowSite',
      }));
    }

    // §3: the result belongs to a page. When the user has moved to a
    // different tab, say whose result this is BEFORE showing it, and offer
    // the current page — the old result is never thrown away.
    if (opts.context === 'other' && opts.domain) {
      parts.push(U.notice({
        text: `Showing ${opts.resultDomain || 'the previous page'}`
          + (opts.resultTime ? ` (analyzed ${opts.resultTime}).` : '.'),
        tone: 'info',
      }));
    }
    parts.push('<div class="vd-home__action">'
      + pageAction(opts) + capLine(opts) + aiIndicator(opts) + '</div>');

    // §4.2: the summary strip and the palette are Overview's first two
    // elements and are ALWAYS drawn when a model exists. Only an individual
    // tile with no number is dropped — never the strip.
    //
    // §4.5: one notice, not two. When the result belongs to a different page,
    // "Showing rig.ai" has already been said, and stacking "very little design
    // data" under it asks the reader to judge a result they are not even
    // looking at the page for. Provenance answers "what is this?", which comes
    // first; the sparse warning returns as soon as they are on that page.
    const elsewhere = opts.context === 'other';
    if (U.isSparse(model) && !elsewhere) {
      parts.push(U.notice({ text: COPY.sparse, tone: 'warn' }));
    } else if (!U.isSparse(model) && counts.length) {
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
    const outputs = opts.outputs || U.OUTPUTS;
    // An output the current source cannot produce falls back to the first it
    // can, so an image model never lands on Skill.
    const output = outputs.some(x => x.value === opts.output) ? opts.output : outputs[0].value;
    const chosen = outputs.find(x => x.value === output) || outputs[0];
    const body = [];

    body.push(U.segmented({
      id: 'vdOutputSeg', key: 'output', value: output, ariaLabel: 'Output',
      options: outputs.map(x => ({ value: x.value, label: x.label })),
    }));
    body.push(`<p class="vd-card__help">${esc(chosen.help)}</p>`);

    if (output === 'prompt') {
      body.push('<div class="vd-field"><span class="vd-field__label">For</span>'
        + U.select({ id: 'vdTargetSelect', ariaLabel: 'Target', value: opts.target || U.TARGETS[0],
                     options: U.TARGETS }) + '</div>');
      // Refine filters the PAGE prompt by what was measured. An image has no
      // motion, layout or shadows to focus on, so the image card omits it.
      if (!opts.noRefine) body.push('<details class="vd-disclose" id="vdRefine"><summary>Refine</summary>'
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

    // §1 rule 1 beats §4.2 here, and §1 says the rules are ordered: a screen
    // gets ONE primary action. When the user is looking at a page that has not
    // been analysed, that action is "Analyze <this page>" — so exporting the
    // previous page's result steps down to secondary. Everywhere else Export
    // is the primary action, as §4.2 says.
    body.push(U.button({
      id: 'vdExportBtn', full: true, label: chosen.action,
      variant: opts.context === 'other' ? 'ghost' : 'primary',
    }));
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

    const parts = [U.tabTitle('Colors'),
      section({ title: 'Colors', action: 'Export ▸', actionId: 'gotoExport', body: list })];

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
    const parts = [U.tabTitle('Type')];
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
    const parts = [U.tabTitle('Components')];

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
    const parts = [U.tabTitle('Motion')];

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

  // ── image source (§4.6) ─────────────────────────────────────────────────
  // A second SOURCE TYPE with its own content structure — not a third chip.
  // Every screen below says "estimated" where the website screen says
  // nothing, because the website screen is reporting measurements.

  const EST = '<span class="vd-est" title="Estimated from the image, not measured">est.</span>';

  // §4.6: "Website · Image" sits at the top of Overview. It is a mode, so it
  // is a segmented control (§8) — and the tab bar below is navigation, which
  // is why it is not touched.
  function sourceSwitcher(source) {
    return U.segmented({
      id: 'vdSourceSeg', key: 'source', value: source || 'website', ariaLabel: 'Source',
      options: [{ value: 'website', label: 'Website' }, { value: 'image', label: 'Image' }],
    });
  }

  // Image mode before an analysis. The key gate is part of the architecture:
  // without AI enhancement there is nothing to send the image to, so the
  // drop zone is present but dimmed, with the reason and the way to fix it.
  function imageHomeView(o) {
    const opts = o || {};
    const gated = !opts.aiEnabled;
    const chosen = opts.image && opts.image.name;
    const parts = [U.tabTitle('Overview'), sourceSwitcher('image')];

    if (gated) {
      parts.push(U.notice({
        id: 'vdImageGate', tone: 'warn', text: COPY.imageGate,
        action: COPY.turnOn, actionId: 'openSettings',
      }));
    }

    parts.push(`<div class="vd-drop${gated ? ' is-gated' : ''}${chosen ? ' has-image' : ''}" id="vdDropZone"`
      + ` role="button" tabindex="${gated ? -1 : 0}" aria-disabled="${gated}"`
      + ` aria-label="${esc(COPY.dropZone)}">`
      + (chosen
          ? `<img class="vd-drop__preview" src="${esc(opts.image.dataUrl)}" alt="" />`
            + `<span class="vd-drop__name">${esc(opts.image.name)}</span>`
          : `<span class="vd-drop__label">${esc(COPY.dropZone)}</span>`
            + `<span class="vd-drop__hint">${esc(COPY.dropZoneHint)}</span>`)
      + '</div>'
      + '<input type="file" id="vdImageInput" accept="image/png,image/jpeg,image/webp" hidden />');

    // A name for the style, asked once the image is in. It becomes the title
    // and the filename; the active tab never names an image.
    if (chosen) {
      parts.push('<div class="vd-field vd-field--stacked">'
        + `<label class="vd-field__label" for="vdImageLabel">${esc(COPY.imageLabel)}</label>`
        + `<input class="vd-input" id="vdImageLabel" type="text" maxlength="60"`
        + ` value="${esc(opts.image.label || '')}" />`
        + `<span class="vd-field__help">${esc(COPY.imageLabelHelp)}</span></div>`);
    }

    parts.push('<div class="vd-home__action">'
      + (atLimit(opts) ? capBlock(opts)
          : U.button({ id: 'analyzeImageBtn', full: true, label: COPY.analyzeImage,
                       disabled: gated || !chosen }))
      + (atLimit(opts) ? '' : `<p class="vd-home__help">${esc(COPY.imageHelp)}</p>`)
      + capLine(opts)
      + aiIndicator(opts)
      + '</div>');
    return parts.join('');
  }

  const insufficient = (model, field) => !!(model.evidence && model.evidence[field] === 'insufficient');
  // A row for a facet: the value when there is evidence, the sentence when
  // there is not. Never a guessed value under an "insufficient" flag.
  const evRow = (model, field, row) => insufficient(model, field)
    ? kvRow({ label: row.label, value: COPY.insufficient, mono: false, wrap: true, meta: 'est.' })
    : kvRow(Object.assign({ meta: 'est.' }, row));
  const effectsSummary = (model) => (model.effects || []).map(e =>
    [e.type, e.where].filter(Boolean).join(' · ') + (e.strength ? ` (${e.strength})` : '')).join(', ');

  const imgCounts = (model) => [
    { value: (model.colorRoles || []).length, label: 'Colors' },
    { value: model.typography && model.typography.direction && model.typography.direction.classification
        ? 1 : 0, label: 'Type direction' },
    { value: model.iconography && model.iconography.style ? 1 : 0, label: 'Icon style' },
    { value: model.mood ? model.mood.words.length : 0, label: 'Mood' },
  ].filter(c => c.value > 0);

  // §4.6 Snapshot for an image: Theme · Style · Type direction · Shape ·
  // Iconography · Density. Each value is a guess and each row says so.
  function imageSnapshotRows(model) {
    const rows = [];
    rows.push({ label: 'Theme', value: model.theme.isDark ? 'Dark' : 'Light', mono: false });
    if (model.imageKind) rows.push({ label: 'Kind', value: model.imageKind, mono: false });
    if (model.theme.style) rows.push({ label: 'Style', value: model.theme.style, mono: false, wrap: true });
    const d = model.typography && model.typography.direction;
    if (d && (d.classification || d.weightCharacter)) {
      rows.push({ label: 'Type direction',
                  value: [d.classification, d.weightCharacter].filter(Boolean).join(' · '), mono: false, wrap: true });
    }
    if (model.shape && model.shape.language) rows.push({ label: 'Shape', value: model.shape.language, mono: false });
    if (insufficient(model, 'effects')) rows.push({ label: 'Effects', value: COPY.insufficient, mono: false, wrap: true });
    else rows.push({ label: 'Effects', value: effectsSummary(model), mono: false, wrap: true });
    if (insufficient(model, 'iconography')) {
      rows.push({ label: 'Iconography', value: COPY.insufficient, mono: false, wrap: true });
    } else if (model.iconography && model.iconography.style) {
      const ic = model.iconography;
      rows.push({ label: 'Iconography',
                  value: [ic.style, ic.weight, ic.corners].filter(Boolean).join(' · '), mono: false, wrap: true });
    }
    if (model.density) rows.push({ label: 'Density', value: model.density.level, mono: false });
    return rows.map(r => Object.assign(r, { meta: 'est.' }));
  }

  function imageOverviewView(model, o) {
    const opts = Object.assign({}, o || {});
    if (!opts.context) opts.context = 'same';
    const parts = [U.tabTitle('Overview'), sourceSwitcher('image')];

    // Thumbnail + badge lead, so the first thing on screen says what this is.
    parts.push('<div class="vd-imghead">'
      + (opts.image && opts.image.dataUrl
          ? `<img class="vd-imghead__thumb" src="${esc(opts.image.dataUrl)}" alt="" />` : '')
      + `<span class="vd-badge vd-badge--est">${esc(COPY.imageBadge)}</span>`
      + (opts.image && (opts.image.label || opts.image.name)
          ? `<span class="vd-imghead__name">${esc(opts.image.label || opts.image.name)}</span>` : '')
      + '</div>');

    parts.push('<div class="vd-home__action">'
      + U.button({ id: 'analyzeImageBtn', full: true, variant: 'ghost', icon: '↺', label: 'Re-analyze image' })
      + capLine(opts) + aiIndicator(opts) + '</div>');

    const counts = imgCounts(model);
    if (counts.length) parts.push(`<div class="vd-stats">${counts.map(U.statTile).join('')}</div>`);
    const palette = U.paletteEntries(model);
    if (palette.length) parts.push(U.swatchStrip(palette));
    parts.push(section({ title: 'Snapshot', body: rows(imageSnapshotRows(model)) }));
    parts.push(exportCard(model, Object.assign({}, opts, { outputs: U.IMAGE_OUTPUTS, noRefine: true })));
    parts.push(`<button class="vd-link" data-action="previewRaw">${esc(COPY.previewRaw)} ▸</button>`);
    return parts.join('');
  }

  function imageColorsView(model) {
    const list = (model.colorRoles || []).map(role => kvRow({
      label: role, value: model.colors[role], swatch: model.colors[role], meta: 'est.',
    })).join('');
    const parts = [U.tabTitle('Colors'),
      section({ title: 'Colors', action: 'Export ▸', actionId: 'gotoExport', body: list })];

    // Contrast between two guesses is itself a guess; it is computed because
    // it is still useful, and labelled because it is still a guess.
    const bg = model.colors.background;
    const pairs = (model.colorRoles || []).filter(r => r !== 'background' && /text|accent/.test(r))
      .map(r => {
        const ratio = VD_UI._contrast ? VD_UI._contrast(model.colors[r], bg) : null;
        if (!ratio) return null;
        const grade = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA Large' : 'Fails';
        return kvRow({ label: `${r} / background`, value: ratio.toFixed(1) + ':1', meta: grade + ' · est.' });
      }).filter(Boolean).join('');
    if (pairs) parts.push(section({ title: 'Contrast — estimated', body: pairs }));
    return parts.join('');
  }

  function imageTypeView(model) {
    const parts = [U.tabTitle('Type')];
    // A pattern, illustration or photo has no typography to direct.
    if (model.hasInterface === false || !model.hasText) {
      parts.push(section({ title: 'Type', body: `<p class="vd-line">${esc(COPY.noInterface)}</p>` }));
      return parts.join('');
    }
    const d = (model.typography && model.typography.direction) || {};
    const dir = [];
    if (d.classification) dir.push(kvRow({ label: 'Classification', value: d.classification, mono: false, meta: 'est.' }));
    if (d.weightCharacter) dir.push(kvRow({ label: 'Weight', value: d.weightCharacter, mono: false, meta: 'est.' }));
    parts.push(section({ title: 'Type', action: 'Export ▸', actionId: 'gotoExport',
      body: dir.join('') || '<p class="vd-line">No type direction could be read from this image.</p>' }));

    const read = (model.fonts || []).filter(f => !f.suggested);
    if (read.length) {
      parts.push(section({ title: 'Read from the image', body: read.map(f =>
        kvRow({ label: f.family, value: f.availability, mono: false, meta: 'est.' })).join('') }));
    }
    const sugg = (model.fonts || []).filter(f => f.suggested);
    if (sugg.length) {
      parts.push(section({ title: 'Open fonts — suggested, not observed', body: sugg.map(f =>
        kvRow({ label: f.family, value: 'Google Fonts', mono: false, meta: 'suggested' })).join('') }));
    }
    return parts.join('');
  }

  function imageComponentsView(model) {
    const parts = [U.tabTitle('Components')];

    // Container — the one component a still image of an INTERFACE reliably
    // shows. A pattern, illustration or photo has none, so the block is
    // absent, not "insufficient".
    if (model.hasInterface !== false) {
      const ct = model.container || {};
      const ctRows = insufficient(model, 'container')
        ? kvRow({ label: 'Container', value: COPY.insufficient, mono: false, wrap: true, meta: 'est.' })
        : [
            ct.shape && kvRow({ label: 'Shape', value: ct.shape, mono: false, meta: 'est.' }),
            ct.radiusEstimate && kvRow({ label: 'Radius', value: ct.radiusEstimate, mono: false, wrap: true, meta: 'est.' }),
            ct.surface && kvRow({ label: 'Surface', value: ct.surface, mono: false, meta: 'est.' }),
            ct.border && kvRow({ label: 'Border', value: ct.border, mono: false, meta: 'est.' }),
          ].filter(Boolean).join('');
      parts.push(section({ title: 'Container', action: 'Export ▸', actionId: 'gotoExport', body: ctRows }));
    }

    // Effects — what defines the image, in the order the model ranked them.
    const fxRows = insufficient(model, 'effects')
      ? kvRow({ label: 'Effects', value: COPY.insufficient, mono: false, wrap: true, meta: 'est.' })
      : model.effects.map(e => kvRow({
          label: [e.type, e.where].filter(Boolean).join(' · '),
          value: [e.description, e.strength && `(${e.strength})`].filter(Boolean).join(' '),
          swatch: e.colour || undefined, mono: false, wrap: true, meta: 'est.',
        })).join('');
    parts.push(section({ title: 'Effects', body: fxRows }));

    // Hierarchy — the two or three moves, numbered, in order.
    const hRows = insufficient(model, 'hierarchy')
      ? kvRow({ label: 'Hierarchy', value: COPY.insufficient, mono: false, wrap: true, meta: 'est.' })
      : model.hierarchy.map((h, i) => kvRow({ label: String(i + 1), value: h, mono: false, wrap: true, meta: 'est.' })).join('');
    parts.push(section({ title: 'Hierarchy', body: hRows }));

    const body = [];
    if (model.shape && model.shape.language) body.push(evRow(model, 'shape', { label: 'Shape language', value: model.shape.language, mono: false }));
    if (insufficient(model, 'iconography')) {
      body.push(kvRow({ label: 'Icons', value: COPY.insufficient, mono: false, wrap: true, meta: 'est.' }));
    } else {
      const ic = model.iconography || {};
      if (ic.style) body.push(kvRow({ label: 'Icon style', value: ic.style, mono: false, meta: 'est.' }));
      if (ic.weight) body.push(kvRow({ label: 'Icon weight', value: ic.weight, meta: 'est.' }));
      if (ic.corners) body.push(kvRow({ label: 'Icon corners', value: ic.corners, mono: false, meta: 'est.' }));
      if (ic.grid) body.push(kvRow({ label: 'Icon grid', value: ic.grid, meta: 'est.' }));
    }
    if (model.illustration) body.push(evRow(model, 'illustration', { label: 'Illustration / texture', value: model.illustration.style, mono: false, wrap: true }));
    if (model.density) body.push(evRow(model, 'density', { label: 'Density', value: model.density.level, mono: false }));
    parts.push(section({ title: 'Iconography', body: body.join('') || '<p class="vd-line">No component language could be read from this image.</p>' }));
    return parts.join('');
  }

  // §4.6: the tab stays in the bar; the content explains the state.
  function imageMotionView() {
    return U.tabTitle('Motion') + U.notice({ id: 'vdImageMotion', tone: 'info', text: COPY.imageMotion });
  }

  return { homeView, overviewView, exportCard, colorsView, typeView, componentsView, motionView, wherePath,
           sourceSwitcher, imageHomeView, imageOverviewView, imageColorsView, imageTypeView,
           imageComponentsView, imageMotionView, imageSnapshotRows, EST };
})();

if (typeof self !== 'undefined') self.VD_VIEWS = VD_VIEWS;
if (typeof module !== 'undefined' && module.exports) module.exports.VD_VIEWS = VD_VIEWS;

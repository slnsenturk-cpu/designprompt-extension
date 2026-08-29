// VibeDesign — panel layout suite.
//
// jsdom has no layout engine: offsetWidth is 0 and scrollWidth is 0 for
// everything, so it cannot answer "does this fit". These tests therefore run
// in real Chromium (already a devDependency for scripts/capture.mjs) against
// the real stylesheet and the real rendered markup.
//
// What they exist to catch: the side panel is not a fixed width. Chrome gives
// it whatever the user has dragged it to, and 320px is the floor. A stray
// fixed width or a flex child that refuses to shrink turns the whole panel
// into a horizontally scrolling box with its labels cut off at both edges —
// which is exactly what `html { width: 380px }` did.
//
// Run with:  node --test tests/ui-layout.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const U = require(path.join(__dirname, '..', 'lib', 'ui-components.js'));
const V = U.VD_VIEWS;
const model = require(path.join(__dirname, '..', 'lib', 'design-model.js'));

const ROOT = path.join(__dirname, '..');
const fixture = n => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', n + '.json'), 'utf8'));
const rig = model.buildDesignModel(fixture('rig-ai'));
const WORDMARK = 'data:image/png;base64,'
  + fs.readFileSync(path.join(ROOT, 'icons', 'wordmark.png')).toString('base64');

// The widths that matter: Chrome's side panel floor, a common drag width, and
// a comfortably wide one.
const WIDTHS = [320, 360, 420];

// The real stylesheet, the real markup, one file per surface.
function page(surface, panelHtml, opts) {
  const css = fs.readFileSync(path.join(ROOT, 'popup.css'), 'utf8');
  const o = opts || {};
  const bar = surface === 'sidepanel'
    ? `<nav class="vd-tabbar-slot">${U.tabBar({ active: 'overview', ready: true, signedOut: true })}</nav>`
    : '';
  // The REAL wordmark, inlined. A placeholder would make the alignment test
  // meaningless: what moved the mark off the content edge was transparent
  // pixels inside the asset, and only the asset has those.
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body data-context="${surface}"><div class="app">
  <header class="vd-header">
    <div class="vd-header__top">
      <img src="${WORDMARK}" alt="VibeDesign" class="vd-header__logo" width="254" height="48" />
      <div class="vd-header__account">${U.accountControl({ authed: false })}</div>
    </div>
    <div class="vd-header__status">
      <span class="vd-header__domain">${o.domain || 'rig.ai'}</span>
      <span class="vd-header__state">${o.state || 'Analyzed 09:23 PM'}</span>
    </div>
  </header>
  <main class="vd-main"><div class="vd-panel">${panelHtml}</div></main>
  ${bar}
</div></body></html>`;
}

const SURFACES = {
  'overview': () => page('sidepanel', V.overviewView(rig, {
    output: 'prompt', context: 'same', aiEnabled: true,
    aiProvider: 'Claude', aiModel: 'Sonnet 5', meta: '17 sections · 33.4k chars' })),
  'overview · other page': () => page('sidepanel', V.overviewView(rig, {
    output: 'prompt', context: 'other', domain: 'posthog.com',
    resultDomain: 'rig.ai', resultTime: '09:23 PM', aiEnabled: false }),
    { domain: 'posthog.com', state: 'Not analyzed' }),
  'overview · skill': () => page('sidepanel', V.overviewView(rig, { output: 'skill' })),
  'home': () => page('sidepanel', V.homeView({ mode: 'page', context: 'none',
    aiEnabled: true, aiProvider: 'Claude', aiModel: 'Sonnet 5',
    recent: [{ key: 'a', domain: 'a-very-long-domain-name.example.com', ago: '2h ago', meta: 'colors' }] })),
  'colors': () => page('sidepanel', V.colorsView(rig)),
  'type': () => page('sidepanel', V.typeView(rig)),
  'components': () => page('sidepanel', V.componentsView(rig)),
  'motion': () => page('sidepanel', V.motionView(rig)),
};

let browser = null;
async function withPage(html, width, fn) {
  if (!browser) {
    const { chromium } = require('playwright');
    browser = await chromium.launch();
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vd-layout-'));
  const file = path.join(dir, 'panel.html');
  fs.writeFileSync(file, html);
  const p = await browser.newPage({ viewport: { width, height: 700 } });
  try {
    await p.goto('file://' + file);
    return await fn(p);
  } finally {
    await p.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test.after(async () => { if (browser) await browser.close(); });

// ── nothing scrolls sideways ──────────────────────────────────────────────

test('no surface overflows its panel at 320, 360 or 420px', async () => {
  for (const [name, build] of Object.entries(SURFACES)) {
    const html = build();
    for (const width of WIDTHS) {
      const r = await withPage(html, width, p => p.evaluate(() => {
        const past = [], spilled = [];
        document.querySelectorAll('*').forEach(el => {
          const box = el.getBoundingClientRect();
          const name = `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ')[0]}`;
          if (box.width && (box.right > window.innerWidth + 0.5 || box.left < -0.5)) {
            past.push(`${name} [${Math.round(box.left)}..${Math.round(box.right)}]`);
          }
          // Text wider than its own box does NOT widen that box, so the rect
          // check above cannot see it — the glyphs simply paint outside and
          // get clipped by the panel edge. That is how a stat tile reading
          // "KEYFRAMES" lost its last two letters while every box measured
          // perfectly. scrollWidth is what notices.
          const overflows = el.scrollWidth > el.clientWidth + 1;
          const clipsItself = /hidden|auto|scroll/.test(getComputedStyle(el).overflowX);
          if (overflows && !clipsItself && el.children.length === 0) {
            spilled.push(`${name} "${(el.textContent || '').trim().slice(0, 24)}"`
              + ` needs ${el.scrollWidth}px in ${el.clientWidth}px`);
          }
        });
        return {
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          past: [...new Set(past)].slice(0, 6),
          spilled: [...new Set(spilled)].slice(0, 6),
        };
      }));
      assert.ok(r.scrollWidth <= r.innerWidth,
        `${name} at ${width}px: document.scrollWidth is ${r.scrollWidth} for a ${r.innerWidth}px `
        + `viewport — overflows by ${r.scrollWidth - r.innerWidth}px. `
        + `Past the edge: ${r.past.join(', ') || '(none identified)'}`);
      assert.deepEqual(r.past, [],
        `${name} at ${width}px: elements sit outside the panel`);
      assert.deepEqual(r.spilled, [],
        `${name} at ${width}px: text is painting outside its own box and getting cut`);
    }
  }
});

test('every surface uses border-box, so padding never widens a full-width box', async () => {
  const r = await withPage(SURFACES.overview(), 320, p => p.evaluate(() => {
    const bad = [];
    document.querySelectorAll('.app *').forEach(el => {
      if (getComputedStyle(el).boxSizing !== 'border-box') {
        bad.push(el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ')[0]);
      }
    });
    return [...new Set(bad)];
  }));
  assert.deepEqual(r, [], 'these elements are content-box');
});

// ── the tab bar ───────────────────────────────────────────────────────────

test('the tab bar is six equal columns that fit at 320px', async () => {
  for (const width of WIDTHS) {
    const r = await withPage(SURFACES.overview(), width, p => p.evaluate(() => {
      const tabs = [...document.querySelectorAll('.vd-tab')];
      const bar = document.querySelector('.vd-tabbar');
      return {
        barWidth: bar.getBoundingClientRect().width,
        widths: tabs.map(t => +t.getBoundingClientRect().width.toFixed(2)),
        heights: tabs.map(t => +t.getBoundingClientRect().height.toFixed(1)),
        labels: tabs.map(t => {
          const l = t.querySelector('.vd-tab__label');
          const cs = getComputedStyle(l);
          return {
            text: l.textContent,
            clipped: l.scrollWidth > l.clientWidth + 0.5,
            lines: Math.round(l.getBoundingClientRect().height / parseFloat(cs.lineHeight || 14)),
            size: cs.fontSize,
            transform: cs.textTransform,
          };
        }),
      };
    }));

    assert.equal(r.widths.length, 6, `${width}px: expected six tabs`);
    assert.ok(Math.abs(r.barWidth - width) < 0.5,
      `${width}px: the tab bar is ${r.barWidth}px wide`);
    // Equal columns: every tab within half a pixel of the others.
    const spread = Math.max(...r.widths) - Math.min(...r.widths);
    assert.ok(spread <= 0.5, `${width}px: tab widths differ by ${spread}px — not equal columns`);

    r.heights.forEach((h, i) => assert.ok(h >= 48,
      `${width}px: tab ${i} is ${h}px tall — the touch target must be at least 48px`));

    r.labels.forEach(l => {
      assert.equal(l.size, '11px', `"${l.text}" is not 11px`);
      assert.equal(l.transform, 'none',
        `"${l.text}" is uppercased — six uppercase labels do not fit at 320px`);
      assert.equal(l.lines, 1, `"${l.text}" wrapped to ${l.lines} lines`);
      assert.equal(l.clipped, false,
        `"${l.text}" is ellipsised at ${width}px — §3 says no label may be cut`);
    });
  }
});

// ── the wordmark ──────────────────────────────────────────────────────────

test('the wordmark renders at exactly 20px, centred on the brand row', async () => {
  for (const width of WIDTHS) {
    const r = await withPage(SURFACES.overview(), width, p => p.evaluate(async () => {
      const img = document.querySelector('.vd-header__logo');
      // §3: the wordmark centres on the BRAND row, not on the whole two-line
      // header — its centre line is shared with the account control.
      const header = document.querySelector('.vd-header__top');
      const a = img.getBoundingClientRect(), h = header.getBoundingClientRect();
      return {
        height: +a.height.toFixed(2),
        width: +a.width.toFixed(2),
        // Distance between the image's centre line and the header's.
        offCentre: +Math.abs((a.top + a.height / 2) - (h.top + h.height / 2)).toFixed(2),
        declared: { w: img.getAttribute('width'), h: img.getAttribute('height') },
      };
    }));
    assert.equal(r.height, 20, `${width}px: the wordmark is ${r.height}px tall, not 20px`);
    assert.ok(r.offCentre <= 0.5,
      `${width}px: the wordmark sits ${r.offCentre}px off the brand row's centre line`);
    // Intrinsic size declared, so the header cannot reflow when the image loads.
    assert.ok(r.declared.w && r.declared.h,
      'the wordmark has no intrinsic size declared — the header will jump on load');
  }
});

test('the wordmark asset is trimmed, sized and sharp enough', async () => {
  // If this ever fails, the asset is the thing to fix — not the CSS.
  const png = fs.readFileSync(path.join(ROOT, 'icons', 'wordmark.png'));
  assert.equal(png.slice(1, 4).toString('ascii'), 'PNG', 'the wordmark is not a PNG');
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  assert.ok(w > 0 && h > 0, 'the wordmark has no intrinsic size');
  // Rendered at 20px tall, this is the pixel density available. Below 2x it
  // would look soft on a retina display and should be replaced with an SVG.
  assert.ok(h / 20 >= 2,
    `the wordmark is ${w}x${h}: only ${(h / 20).toFixed(1)}x at a 20px slot — replace it with an SVG`);

  // And it must have no transparent margin. A padded asset makes `height`
  // describe a mostly-empty box: the original carried 32px of transparent
  // pixels on its left, which both shrank the visible mark to two-thirds of
  // its set size and pushed it right of the content edge.
  const trimmed = await withPage(
    `<!doctype html><html><body><img id="m" src="data:image/png;base64,${png.toString('base64')}"></body></html>`,
    360,
    p => p.evaluate(async () => {
      const img = document.getElementById('m');
      if (!img.complete) await new Promise(r => { img.onload = r; });
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let minX = c.width, maxX = -1, minY = c.height, maxY = -1;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        if (d[(y * c.width + x) * 4 + 3] > 8) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
      return { w: c.width, h: c.height, minX, maxX, minY, maxY };
    }));
  assert.equal(trimmed.minX, 0, `${trimmed.minX}px of transparent margin on the left`);
  assert.equal(trimmed.minY, 0, `${trimmed.minY}px of transparent margin on the top`);
  assert.equal(trimmed.maxX, trimmed.w - 1, 'transparent margin on the right');
  assert.equal(trimmed.maxY, trimmed.h - 1, 'transparent margin on the bottom');
});

test('the wordmark starts on the same line as the content below it', async () => {
  // The header and the panel both sit at the 16px content edge, so the
  // wordmark, the domain, the tab title and the summary strip should all
  // begin at exactly the same x. They did not: the asset's transparent margin
  // indented the mark by ~9px while every box measured correctly.
  for (const width of WIDTHS) {
    const r = await withPage(SURFACES.overview(), width, p => p.evaluate(async () => {
      const left = s => {
        const el = document.querySelector(s);
        return el ? +el.getBoundingClientRect().left.toFixed(2) : null;
      };
      // Where the wordmark's first VISIBLE pixel lands, not where its box
      // does. A transparent margin inside the asset moves the mark without
      // moving the element, so measuring the box alone would have passed
      // straight through the bug this test exists for.
      const img = document.querySelector('.vd-header__logo');
      if (!img.complete) await new Promise(res => { img.onload = res; });
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let inkX = c.width;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < inkX; x++) {
        if (d[(y * c.width + x) * 4 + 3] > 8 && x < inkX) inkX = x;
      }
      const box = img.getBoundingClientRect();
      const scale = box.width / c.width;
      return {
        logoBox: +box.left.toFixed(2),
        logoInk: +(box.left + inkX * scale).toFixed(2),
        domain: left('.vd-header__domain'),
        title: left('.vd-tabtitle'),
        stats: left('.vd-stats'),
        swatches: left('.vd-swatches'),
      };
    }));
    ['domain', 'title', 'stats', 'swatches'].forEach(key => {
      if (r[key] === null) return;
      assert.ok(Math.abs(r[key] - r.logoInk) < 0.5,
        `${width}px: the wordmark's first visible pixel is at ${r.logoInk}px `
        + `(box at ${r.logoBox}px) but ${key} starts at ${r[key]}px`);
    });
  }
});

// ── the popup keeps its own width ─────────────────────────────────────────

test('the popup is a fixed 380px and still does not overflow', async () => {
  const html = page('popup', V.homeView({ mode: 'page', context: 'none', aiEnabled: false }));
  const r = await withPage(html, 400, p => p.evaluate(() => ({
    app: +document.querySelector('.app').getBoundingClientRect().width.toFixed(1),
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  })));
  assert.equal(r.app, 380, 'the popup lost its fixed width');
  assert.ok(r.scrollWidth <= r.innerWidth, 'the popup overflows');
});

// ── focus (§8) ────────────────────────────────────────────────────────────
//
// jsdom cannot answer this either: :focus-visible is a browser judgement about
// how the user arrived at a control, and it has no such judgement to make.

test('every control shows a ring on keyboard focus and none on a mouse click', async () => {
  const html = SURFACES.overview();
  const r = await withPage(html, 360, async p => {
    // Keyboard: Tab through the panel and record what each landing gets.
    const byKeyboard = [];
    for (let i = 0; i < 30; i++) {
      await p.keyboard.press('Tab');
      const hit = await p.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        return {
          name: el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ')[0],
          width: parseFloat(cs.outlineWidth) || 0,
          style: cs.outlineStyle,
          matches: el.matches(':focus-visible'),
        };
      });
      if (hit) byKeyboard.push(hit);
    }

    // Mouse: click a select and a button, and see what they get.
    const byMouse = [];
    for (const sel of ['.vd-select', '#vdExportBtn', '.vd-seg__item']) {
      const el = await p.$(sel);
      if (!el) continue;
      await el.click();
      byMouse.push(await p.evaluate(s => {
        const e = document.querySelector(s);
        const cs = getComputedStyle(e);
        return {
          name: s,
          focused: document.activeElement === e,
          visible: e.matches(':focus-visible'),
          width: parseFloat(cs.outlineWidth) || 0,
          style: cs.outlineStyle,
        };
      }, sel));
    }
    return { byKeyboard, byMouse };
  });

  assert.ok(r.byKeyboard.length >= 6,
    `only ${r.byKeyboard.length} controls were reachable by Tab`);
  r.byKeyboard.forEach(hit => {
    assert.ok(hit.matches, `${hit.name} did not match :focus-visible on Tab`);
    assert.ok(hit.width >= 2 && hit.style !== 'none',
      `${hit.name} has no focus ring on Tab (outline ${hit.style} ${hit.width}px)`);
  });

  // A control closed with the mouse must not be left wearing a ring.
  r.byMouse.forEach(hit => {
    if (!hit.focused) return;                 // never took focus — nothing to show
    if (hit.visible) return;                  // the browser judged it keyboard-like
    assert.ok(hit.width === 0 || hit.style === 'none',
      `${hit.name} shows a ring after a mouse click (outline ${hit.style} ${hit.width}px)`);
  });
});

test('the focus ring is added, never suppressed', async () => {
  // `outline: none` on :focus is how keyboard access gets lost: one selector
  // is missed in the re-adding and that control becomes invisible to Tab.
  const css = fs.readFileSync(path.join(ROOT, 'popup.css'), 'utf8');
  const panel = css.slice(css.indexOf('/* ── shell (§3) ──'));
  const suppressions = (panel.match(/:focus(?!-visible)[^{]*\{[^}]*outline:\s*(none|0)/g) || []);
  assert.deepEqual(suppressions, [], 'a panel rule removes the default focus outline');

  // And every interactive class the panel renders has a focus-visible rule.
  ['.vd-btn', '.vd-seg__item', '.vd-select', '.vd-chip', '.vd-tab', '.vd-swatch',
   '.vd-input', '.vd-link', '.vd-cap__link', '.vd-ai__link', '.vd-account',
   '.vd-section__action', '.vd-sheet__close']
    .forEach(sel => assert.ok(panel.includes(sel + ':focus-visible'),
      `${sel} has no :focus-visible ring`));
});

test('the header is two lines and the domain stays on one of them', async () => {
  for (const width of WIDTHS) {
    const r = await withPage(SURFACES.overview(), width, p => p.evaluate(() => {
      const h = document.querySelector('.vd-header');
      const top = document.querySelector('.vd-header__top');
      const status = document.querySelector('.vd-header__status');
      const logo = document.querySelector('.vd-header__logo');
      const acct = document.querySelector('.vd-header__account');
      const domain = document.querySelector('.vd-header__domain');
      const box = e => e.getBoundingClientRect();
      return {
        height: +box(h).height.toFixed(1),
        logoH: +box(logo).height.toFixed(1),
        // Two lines: the status sits entirely below the brand row.
        statusBelowTop: box(status).top >= box(top).bottom - 0.5,
        acctOnTopRow: Math.abs((box(acct).top + box(acct).height / 2)
                             - (box(top).top + box(top).height / 2)) <= 1,
        statusLines: Math.round(box(status).height / parseFloat(getComputedStyle(status).lineHeight || 16)),
        domainClipped: domain.scrollWidth > domain.clientWidth + 1,
        domainEllipsis: getComputedStyle(domain).textOverflow,
      };
    }));
    assert.equal(r.height, 60, `${width}px: the header is ${r.height}px, not 60`);
    assert.equal(r.logoH, 20, `${width}px: the wordmark is ${r.logoH}px, not 20`);
    assert.ok(r.statusBelowTop, `${width}px: the header is not two lines`);
    assert.ok(r.acctOnTopRow, `${width}px: the account control is not on the brand row`);
    assert.equal(r.statusLines, 1, `${width}px: the page line wrapped`);
    assert.equal(r.domainEllipsis, 'ellipsis', `${width}px: a long domain would be cut, not ellipsed`);
  }
});

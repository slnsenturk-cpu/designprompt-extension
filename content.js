// VibeDesign v3 — Content Script (fixed token extraction)

(function () {
  if (window.__vibeDesignInjected) return;
  window.__vibeDesignInjected = true;

  // Shared helpers loaded from lib/color-utils.js, lib/noise-filter.js, lib/shadow-utils.js
  const { isNoisyVar, hasUsefulValue, splitShadowLayers, isRealShadowLayer, hexLum, hexSat } = window.__vibeDesign || {};

  // Expose extraction functions for lib/picker.js
  window.__vibeDesign = window.__vibeDesign || {};

  // ─── Color helpers ─────────────────────────────────────────────────────────
  // Canvas element for converting any CSS color (oklch, lab, lch, etc.) to RGB
  let _colorCanvas = null;
  let _colorCtx = null;
  function cssColorToRgb(cssColor) {
    if (!cssColor) return null;
    // Fast path for rgb/rgba
    const rgbMatch = cssColor.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) return { r: parseInt(rgbMatch[1]), g: parseInt(rgbMatch[2]), b: parseInt(rgbMatch[3]) };
    // For oklch, lab, lch, color(), etc. — use canvas to convert
    try {
      if (!_colorCanvas) { _colorCanvas = document.createElement('canvas'); _colorCanvas.width = 1; _colorCanvas.height = 1; _colorCtx = _colorCanvas.getContext('2d', { willReadFrequently: true }); }
      _colorCtx.clearRect(0, 0, 1, 1);
      _colorCtx.fillStyle = '#000000'; // reset
      _colorCtx.fillStyle = cssColor;
      _colorCtx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = _colorCtx.getImageData(0, 0, 1, 1).data;
      if (a < 10) return null; // nearly transparent
      return { r, g, b };
    } catch(e) { return null; }
  }

  function rgbToHex(rgb) {
    // Standard rgb/rgba string
    const m = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) {
      return '#' + [m[1],m[2],m[3]].map(x => parseInt(x).toString(16).padStart(2,'0')).join('');
    }
    // oklch, lab, lch, color() and other modern CSS color formats
    const converted = cssColorToRgb(rgb);
    if (converted) {
      return '#' + [converted.r, converted.g, converted.b].map(x => x.toString(16).padStart(2,'0')).join('');
    }
    return null;
  }

  function isTransparent(c) {
    if (!c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)' || c === 'rgba(0,0,0,0)') return true;
    // Catch very low alpha values (< 0.15) — e.g. rgba(228,234,200,0.08)
    const alphaMatch = c.match(/rgba\(\s*\d+[\s,]+\d+[\s,]+\d+[\s,/]+([\d.]+)\s*\)/);
    if (alphaMatch && parseFloat(alphaMatch[1]) < 0.15) return true;
    // oklch/lab/lch with very low alpha — e.g. oklch(0.5 0.1 30 / 0.05)
    const modernAlpha = c.match(/\/\s*([\d.]+)\s*\)/);
    if (modernAlpha && parseFloat(modernAlpha[1]) < 0.15) return true;
    return false;
  }

  function rgbLuminance(rgb) {
    const m = rgb.match(/\d+/g);
    if (!m || m.length < 3) return 0.5;
    return (0.299 * parseInt(m[0]) + 0.587 * parseInt(m[1]) + 0.114 * parseInt(m[2])) / 255;
  }

  function isBlackOrWhite(hex) {
    if (!hex) return false;
    const h = hex.toLowerCase();
    return h === '#000000' || h === '#ffffff' || h === '#000' || h === '#fff' || h === '#0000000' || h === '#ffffffff';
  }

  function colorDistance(hex1, hex2) {
    const r1=parseInt(hex1.slice(1,3),16), g1=parseInt(hex1.slice(3,5),16), b1=parseInt(hex1.slice(5,7),16);
    const r2=parseInt(hex2.slice(1,3),16), g2=parseInt(hex2.slice(3,5),16), b2=parseInt(hex2.slice(5,7),16);
    return Math.sqrt((r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2);
  }

  function _hslHue(hex) {
    const r=parseInt(hex.slice(1,3),16)/255, g=parseInt(hex.slice(3,5),16)/255, b=parseInt(hex.slice(5,7),16)/255;
    const mx=Math.max(r,g,b), mn=Math.min(r,g,b);
    if(mx===mn) return 0;
    const d=mx-mn; let h;
    if(mx===r) h=((g-b)/d+(g<b?6:0))/6;
    else if(mx===g) h=((b-r)/d+2)/6;
    else h=((r-g)/d+4)/6;
    return Math.round(h*360);
  }

  function _hslSat(hex) {
    const r=parseInt(hex.slice(1,3),16)/255, g=parseInt(hex.slice(3,5),16)/255, b=parseInt(hex.slice(5,7),16)/255;
    const mx=Math.max(r,g,b), mn=Math.min(r,g,b);
    if(mx===mn) return 0;
    const l=(mx+mn)/2;
    return Math.round((l<=0.5?(mx-mn)/(mx+mn):(mx-mn)/(2-mx-mn))*100);
  }

  function dedupeColors(colors) {
    const result = [];
    for (const c of colors) {
      if (!c || c.length < 4) continue;
      const tooClose = result.some(r => {
        const dist = colorDistance(c, r);
        if (dist >= 25) return false; // clearly different
        // For saturated colors, also check hue difference
        const s1 = _hslSat(c), s2 = _hslSat(r);
        if (s1 > 15 && s2 > 15) {
          const hueDiff = Math.abs(_hslHue(c) - _hslHue(r));
          const hueDistWrapped = Math.min(hueDiff, 360 - hueDiff);
          if (hueDistWrapped > 15) return false; // different hue, keep both
        }
        return true; // too close
      });
      if (!tooClose) result.push(c);
    }
    return result;
  }

  // ─── Frequency-weighted color clustering ─────────────────────────────────────
  // Groups colors within `maxDist` RGB distance, keeps most-frequent as representative
  // Only for low-saturation neutrals — accent colors are never clustered
  function _clusterByFrequency(colors, freqMap, maxDist) {
    if (colors.length <= 1) return colors;
    const clusters = []; // [{representative, members}]
    for (const c of colors) {
      let merged = false;
      for (const cluster of clusters) {
        if (colorDistance(c, cluster.representative) < maxDist) {
          cluster.members.push(c);
          // Promote to representative if higher frequency
          const cFreq = freqMap.get(c) || 0;
          const repFreq = freqMap.get(cluster.representative) || 0;
          if (cFreq > repFreq) cluster.representative = c;
          merged = true;
          break;
        }
      }
      if (!merged) clusters.push({ representative: c, members: [c] });
    }
    // Return representatives sorted by frequency (most common first)
    return clusters
      .map(cl => cl.representative)
      .sort((a, b) => (freqMap.get(b) || 0) - (freqMap.get(a) || 0));
  }

  // ─── Font helpers ──────────────────────────────────────────────────────────
  // Generic/system font stacks that are not real named fonts
  const SYSTEM_FONT_STACKS = new Set([
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
    'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded',
    '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'helvetica neue',
    'arial', 'noto sans', 'noto serif',
  ]);

  const JUNK_FONT_PATTERNS = [/^\d/, /^[a-z]{1,3}$/, /^-/, /inherit/, /initial/, /unset/];

  function cleanFont(rawFamily) {
    if (!rawFamily) return null;
    const first = rawFamily.split(',')[0].replace(/['"]/g, '').trim();
    if (!first || first.length < 2 || first.length > 60) return null;
    if (JUNK_FONT_PATTERNS.some(p => p.test(first))) return null;
    if (SYSTEM_FONT_STACKS.has(first.toLowerCase())) return null;
    // Filter out CSS variable names used as font-family (e.g. "displayFont", "monoFont", "bodyFont")
    if (/^(display|body|heading|mono|code|text|ui|brand|title|hero|nav|label|sans|serif)Font$/i.test(first)) return null;
    // Filter out Next.js/framework generated font class names (e.g. "__Inter_a34f5b", "__className_hash")
    if (/^__/.test(first) || /^[a-f0-9]{6,}$/i.test(first)) return null;
    // Filter out single-word generic names that aren't real font names
    if (/^(display|body|heading|text|primary|secondary|accent)$/i.test(first)) return null;
    return first;
  }

  // ─── Scroll-reveal trigger — scroll page to activate IntersectionObserver content ─
  async function triggerScrollReveals() {
    const savedX = window.scrollX;
    const savedY = window.scrollY;
    const viewH = window.innerHeight;
    const docH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);

    // Skip if page is not scrollable
    if (docH <= viewH + 50) return;

    // Scroll down in 70% viewport steps — triggers IntersectionObserver callbacks
    const step = Math.floor(viewH * 0.7);
    const maxScroll = Math.min(docH, viewH * 25); // Cap at ~20,000px for extended pages

    for (let y = 0; y < maxScroll; y += step) {
      window.scrollTo({ top: y, left: 0, behavior: 'instant' });
      await new Promise(r => setTimeout(r, 16)); // One frame for IO callbacks
    }

    // Scroll to absolute bottom
    window.scrollTo({ top: docH, left: 0, behavior: 'instant' });
    await new Promise(r => setTimeout(r, 500)); // Wait for animations to settle

    // GSAP ScrollTrigger detection: slower second pass with pauses
    const hasGSAP = typeof window.gsap !== 'undefined' || typeof window.ScrollTrigger !== 'undefined';
    if (hasGSAP) {
      const slowStep = viewH;
      for (let y = 0; y < maxScroll; y += slowStep) {
        window.scrollTo({ top: y, left: 0, behavior: 'instant' });
        await new Promise(r => setTimeout(r, 500)); // GSAP needs time to evaluate
      }
    }

    // Scroll back to top
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    await new Promise(r => setTimeout(r, 200)); // Wait for top animations

    // Restore original position
    window.scrollTo({ top: savedY, left: savedX, behavior: 'instant' });
  }

  // ─── Page extraction ───────────────────────────────────────────────────────
  async function extractPageTokens() {
    // Trigger scroll-reveal animations before extracting
    await triggerScrollReveals();
    const tokens = {
      url: window.location.href,
      title: document.title,
      colors: [],
      accentColors: [],
      fonts: [],
      borderRadii: [],
      shadows: [],
      transitions: [],
      cssVars: {},
      layoutInfo: {},
      animations: [],
      hoverStates: [],
      animationDetails: [],
    };

    // ── 1. CSS Custom Properties — filtered ──
    const sheets = Array.from(document.styleSheets);
    for (const sheet of sheets) {
      try {
        for (const rule of Array.from(sheet.cssRules || [])) {
          if (rule.style) {
            for (const prop of rule.style) {
              if (prop.startsWith('--') && !isNoisyVar(prop)) {
                const val = rule.style.getPropertyValue(prop).trim();
                if (hasUsefulValue(val)) {
                  tokens.cssVars[prop] = val;
                }
              }
            }
          }
          if (rule.type === CSSRule.KEYFRAMES_RULE) {
            const name = rule.name;
            // Skip CSS Modules hashed names
            if (/^_.*_[a-z0-9]{4,}_\d+$/.test(name)) continue;
            if (name.startsWith('__')) continue;
            // Skip library/framework animation noise (toasts, video players, progress bars)
            if (/^Toastify|^hot-toast|^sonner|^nprogress|^vjs-|^plyr-|^mux-|^video-|^swiper-/i.test(name)) continue;
            // Skip very long generated names (likely hashed)
            if (name.length > 40) continue;
            // Extract first and last keyframe content for from→to description
            try {
              const frames = Array.from(rule.cssRules || []);
              const first = frames[0]?.cssText?.replace(/\s+/g, ' ').slice(0, 150);
              const last = frames.length > 1 ? frames[frames.length-1]?.cssText?.replace(/\s+/g, ' ').slice(0, 150) : null;
              tokens.animations.push({ name, from: first || null, to: last || null });
            } catch(e) {
              tokens.animations.push({ name, from: null, to: null });
            }
          }
        }
      } catch(e) { console.debug('[VibeDesign]', e.message); }
    }

    // Deduplicate keyframes by name
    const seenKeyframes = new Set();
    tokens.animations = tokens.animations.filter(a => {
      if (seenKeyframes.has(a.name)) return false;
      seenKeyframes.add(a.name);
      return true;
    });

    // ── 1b. Extract :hover rules from stylesheets ──
    // Recursive helper: traverses into @media blocks (e.g. @media (hover: hover) { .btn:hover { } })
    // which modern sites use to avoid sticky hover on touch devices. Without recursion these are missed.
    const _collectHoverRules = (ruleList) => {
      for (const rule of Array.from(ruleList || [])) {
        // Recurse into @media / @supports blocks
        if (rule.type === CSSRule.MEDIA_RULE || rule.type === CSSRule.SUPPORTS_RULE) {
          try { _collectHoverRules(rule.cssRules); } catch(e) { console.debug('[VibeDesign]', e.message); }
          continue;
        }
        if (!rule.selectorText?.includes(':hover')) continue;
        // Skip framework/library noise
        if (/^_|^__|Toastify|nprogress|react-|chakra-|\.vjs-|video-js|\.plyr|\.mux-/i.test(rule.selectorText)) continue;

        // Multi-selector split: ".btn:hover, .button:hover { }" → process each selector independently
        const selectors = rule.selectorText.split(',').map(s => s.trim()).filter(s => s.includes(':hover'));
        for (const sel of selectors) {
          if (sel.length > 140) continue;
          const props = {};
          for (const prop of [
            'background','background-color','background-image',
            'color','transform','box-shadow','border-color','border',
            'opacity','filter','text-decoration','letter-spacing','scale',
            'outline','outline-color','outline-offset','transition'
          ]) {
            let val = rule.style?.getPropertyValue(prop);
            if (!val) continue;
            // Resolve CSS custom properties inline using already-collected cssVars
            if (val.includes('var(')) {
              val = val.replace(/var\(\s*(--[^,)]+)[^)]*\)/g, (match, name) => tokens.cssVars[name.trim()] || match);
            }
            props[prop] = val;
          }
          if (Object.keys(props).length > 0) {
            tokens.hoverStates.push({ selector: sel.slice(0, 140), ...props });
          }
        }
      }
    };
    for (const sheet of sheets) {
      try { _collectHoverRules(sheet.cssRules); } catch(e) { console.debug('[VibeDesign]', e.message); }
    }

    // Deduplicate and limit
    const seenHovers = new Set();
    tokens.hoverStates = tokens.hoverStates.filter(h => {
      const key = h.selector + JSON.stringify(h);
      if (seenHovers.has(key)) return false;
      seenHovers.add(key);
      return true;
    }).slice(0, 40).map(h => {
      // Enrich with "before" computed state for before→after diff format
      // Strip :hover and child combinators to find the base element
      try {
        const baseSelector = h.selector.replace(/:hover\b.*$/, '').trim();
        if (!baseSelector) return h;
        const el = document.querySelector(baseSelector);
        if (!el) return h;
        const cs = window.getComputedStyle(el);
        const before = {};
        if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') before.background = cs.backgroundColor;
        if (cs.color) before.color = cs.color;
        if (cs.transform && cs.transform !== 'none') before.transform = cs.transform;
        if (cs.boxShadow && cs.boxShadow !== 'none') before.boxShadow = cs.boxShadow;
        if (cs.opacity && cs.opacity !== '1') before.opacity = cs.opacity;
        return Object.keys(before).length > 0 ? { ...h, before } : h;
      } catch(e) { return h; }
    });

    // ── 2. Aggressive color scan from computed styles ──
    const colorFreq = new Map(); // hex → count (for frequency-weighted clustering)
    const colorUsage = new Map(); // hex → {bg, text, border} counts (for role inference)
    const _trackUsage = (hex, role) => {
      if (!hex) return;
      const u = colorUsage.get(hex) || { bg: 0, text: 0, border: 0 };
      u[role]++;
      colorUsage.set(hex, u);
    };
    const accentSet = new Set();
    const fontSet = new Set();
    const radiusSet = new Set();
    const shadowSet = new Set();
    const transSet = new Set();
    const textShadowSet = new Set();
    const letterSpacingSet = new Set();
    const aspectRatioSet = new Set();

    // Priority-based scanning: important elements first, then remaining
    const PRIORITY_TAGS = new Set(['button','nav','header','footer','main','section','h1','h2','h3','h4','h5','h6','a','input','textarea','select','form','article']);
    const PRIORITY_CLASS_RE = /hero|card|modal|dialog|menu|dropdown|sidebar|banner|cta|feature|pricing|testimonial/i;
    const allEls = document.querySelectorAll('*');
    const priorityEls = [];
    const otherEls = [];
    for (const el of allEls) {
      if (PRIORITY_TAGS.has(el.tagName.toLowerCase()) || PRIORITY_CLASS_RE.test(el.className || '')) {
        priorityEls.push(el);
      } else {
        otherEls.push(el);
      }
    }

    // Second-pass priority: buttons/headings/links inside section or footer —
    // prevents hero from consuming the whole scan budget before below-fold sections are sampled.
    const belowFoldPriority = [];
    try {
      const belowFoldNodes = document.querySelectorAll('section button, section h1, section h2, section h3, footer button, footer a, footer h2, footer h3');
      const priorityElSet = new Set(priorityEls);
      for (const el of belowFoldNodes) {
        if (!priorityElSet.has(el)) belowFoldPriority.push(el);
      }
    } catch(e) { /* skip */ }

    // DOM-proportional cap: 45% of elements, clamped to [1200, 3500].
    // Small sites keep old floor; large marketing pages get enough budget for below-fold sections.
    const CAP = Math.max(1200, Math.min(Math.floor(allEls.length * 0.45), 3500));

    let scanned = 0;
    let diversityStale = 0;
    let lastDiversityCount = 0;
    const scanBatch = [...priorityEls, ...belowFoldPriority, ...otherEls];
    for (const el of scanBatch) {
      if (scanned > CAP) break;
      // Early exit on diversity plateau: no new tokens for 300 consecutive elements (raised from 200)
      if (scanned > 800 && diversityStale > 300) break;
      try {
        const cs = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        // Only sample visible elements
        if (rect.width === 0 || rect.height === 0) continue;

        scanned++;

        // Background colors
        const bg = cs.backgroundColor;
        if (!isTransparent(bg)) {
          const hex = rgbToHex(bg);
          if (hex) { colorFreq.set(hex, (colorFreq.get(hex) || 0) + 1); _trackUsage(hex, 'bg'); }
        }

        // Text colors
        const color = cs.color;
        if (!isTransparent(color)) {
          const hex = rgbToHex(color);
          if (hex) { colorFreq.set(hex, (colorFreq.get(hex) || 0) + 1); _trackUsage(hex, 'text'); }
        }

        // Border colors (often accent colors)
        const borderColor = cs.borderColor;
        if (!isTransparent(borderColor) && borderColor !== 'rgb(0, 0, 0)') {
          const hex = rgbToHex(borderColor);
          if (hex) { accentSet.add(hex); _trackUsage(hex, 'border'); }
        }

        // Outline colors
        const outline = cs.outlineColor;
        if (!isTransparent(outline)) {
          const hex = rgbToHex(outline);
          if (hex) accentSet.add(hex);
        }

        // Fonts — only from text-rendering elements
        const tag = el.tagName.toLowerCase();
        if (['h1','h2','h3','h4','h5','h6','p','span','a','button','li','label'].includes(tag)) {
          const font = cleanFont(cs.fontFamily);
          if (font) fontSet.add(font);
        }

        // Border radius (only meaningful values)
        const br = cs.borderRadius;
        if (br && br !== '0px' && br !== '0%') {
          // Filter scientific notation (e.g. 1.67772e+07px = computed 9999px)
          if (/e\+\d+/i.test(br)) {
            // Replace with canonical pill value
            radiusSet.add('9999px');
          } else {
            // Filter absurdly large values (> 10000px)
            const firstVal = parseFloat(br);
            if (!isNaN(firstVal) && firstVal > 10000) {
              radiusSet.add('9999px');
            } else {
              radiusSet.add(br);
            }
          }
        }

        // Box shadows — parenthesis-depth splitter handles rgba(r,g,b,a) commas correctly
        const bs = cs.boxShadow;
        if (bs && bs !== 'none') {
          const hasRealLayer = splitShadowLayers(bs).some(isRealShadowLayer);
          if (hasRealLayer) shadowSet.add(bs);
        }

        // Transitions (filter out defaults)
        const tr = cs.transition;
        if (tr && tr !== 'all 0s ease 0s' && tr !== 'none' && !tr.includes('0s ease 0s')) {
          transSet.add(tr);
        }

        // Text shadows
        const ts = cs.textShadow;
        if (ts && ts !== 'none') textShadowSet.add(ts);

        // Letter spacing
        const ls = cs.letterSpacing;
        if (ls && ls !== 'normal' && ls !== '0px') letterSpacingSet.add(ls);

        // CSS aspect-ratio property
        const ar = cs.aspectRatio;
        if (ar && ar !== 'auto') aspectRatioSet.add(ar);

        // Diversity plateau tracking
        const currentDiversity = colorFreq.size + fontSet.size + radiusSet.size;
        if (currentDiversity === lastDiversityCount) { diversityStale++; } else { diversityStale = 0; lastDiversityCount = currentDiversity; }

      } catch(e) { console.debug('[VibeDesign]', e.message); }
    }

    // ── 3. Deduplicate and rank colors ──
    const allColors = dedupeColors([...colorFreq.keys()]);

    // Frequency-weighted clustering for neutrals — collapse similar grays into most-frequent representative
    const neutralsRaw = allColors.filter(c => isLowSaturation(c));
    const accentColors = allColors.filter(c => !isLowSaturation(c));
    const neutralsClustered = _clusterByFrequency(neutralsRaw, colorFreq, 20);

    const accents = dedupeColors([...accentColors, ...accentSet]);
    // Rank accents by saturation weighted by usage frequency — a brand color used 200 times
    // should beat a decorative flash used twice, even if the flash is more saturated.
    // accentSet (border/outline) colors may be absent from colorFreq → default freq=0 (score=saturation).
    const _accentScore = (c) => colorSaturation(c) * (1 + Math.log10((colorFreq.get(c) || 0) + 1));
    accents.sort((a, b) => _accentScore(b) - _accentScore(a));
    tokens.colors = dedupeColors([...accents.slice(0, 6), ...neutralsClustered.slice(0, 4)]).slice(0, 10);
    tokens.accentColors = accents.slice(0, 5);

    tokens.fonts = [...fontSet].filter(Boolean).slice(0, 5);
    tokens.borderRadii = [...radiusSet].slice(0, 6);
    // Raised from 8 → 16: modern sites (Linear, Attio, Vercel) use 10-14 distinct
    // elevation levels. Render-side consumers (prompt-builder, token-exporter) already
    // slice further, so prompt size is unaffected; raising the extraction cap only
    // prevents the export layer from losing the tail of the elevation scale.
    tokens.shadows = [...shadowSet].slice(0, 16);
    tokens.transitions = [...transSet].slice(0, 6);
    tokens.textShadows = [...textShadowSet].slice(0, 6);
    tokens.letterSpacings = [...letterSpacingSet].slice(0, 6);
    tokens.cssAspectRatios = [...aspectRatioSet].slice(0, 6);
    // Color usage map for role inference (bg/text/border counts per hex)
    const _usageObj = {};
    colorUsage.forEach((v, k) => { _usageObj[k] = v; });
    tokens.colorUsage = _usageObj;

    // ── 3b. Computed animation properties from visible elements ──
    const animDetailSet = new Set();
    document.querySelectorAll('[style*="animation"], [class*="animate"], [class*="motion"]').forEach(el => {
      try {
        const cs = window.getComputedStyle(el);
        const anim = cs.animation;
        if (anim && anim !== 'none' && anim.length < 200) animDetailSet.add(anim);
      } catch(e) { console.debug('[VibeDesign]', e.message); }
    });
    tokens.animationDetails = [...animDetailSet].slice(0, 16);

    // ── 3b-2. Ambient / always-on animations (infinite loops) ──
    {
      const AMBIENT_SKIP = '.swiper, .swiper-wrapper, .swiper-slide, [class*="splide__"], [class*="glide__"], [class*="embla__"], [class*="keen-slider"], [class*="marquee"], [class*="ticker"]';
      let ambientSkipEls;
      try { ambientSkipEls = new Set(Array.from(document.querySelectorAll(AMBIENT_SKIP))); } catch(e) { ambientSkipEls = new Set(); }

      const ambientAnims = [];
      const seenNames = new Set();
      const foldY = window.innerHeight;

      const candidates = document.querySelectorAll(
        '[style*="animation"], [class*="animate"], [class*="float"], [class*="pulse"], ' +
        '[class*="glow"], [class*="rotate"], [class*="drift"], [class*="shimmer"], ' +
        '[class*="bounce"], [class*="spin"], section, header, [class*="hero"], [class*="bg-"]'
      );

      for (const el of Array.from(candidates).slice(0, 200)) {
        if (ambientSkipEls.has(el)) continue;
        try {
          const closest = el.closest?.('.swiper, [class*="splide"], [class*="embla"], [class*="marquee"], [class*="ticker"]');
          if (closest) continue;
        } catch(e) { /* skip */ }

        try {
          const cs = window.getComputedStyle(el);
          if (cs.animationIterationCount !== 'infinite') continue;
          if (cs.animationName === 'none' || !cs.animationName) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) continue;

          const name = cs.animationName;
          if (seenNames.has(name)) continue;
          seenNames.add(name);

          ambientAnims.push({
            name: name,
            duration: cs.animationDuration,
            tag: el.tagName.toLowerCase(),
            class: (el.className?.toString() || '').slice(0, 40),
            location: rect.top < foldY ? 'above-fold' : 'below-fold',
          });

          if (ambientAnims.length >= 8) break;
        } catch(e) { console.debug('[VibeDesign]', e.message); }
      }
      tokens.ambientAnimations = ambientAnims.length > 0 ? ambientAnims : null;
    }

    // ── 3c. Button style extraction ──
    tokens.buttonStyles = extractButtonStyles();

    // ── 3d. Typography patterns ──
    tokens.typographyPatterns = extractTypographyPatterns();

    // ── 3e. Badge/tag styles ──
    tokens.badgeStyles = extractBadgeStyles();

    // ── 3f. Form/input field styles ──
    tokens.inputStyles = extractInputStyles();

    // ── 3g. Gradient values ──
    tokens.gradients = extractGradients();

    // ── 3h. Image visual properties ──
    tokens.imageStyles = extractImageStyles();

    // ── 3i. Link/anchor styles ──
    tokens.linkStyles = extractLinkStyles();

    // ── 3j. Footer details ──
    tokens.footerStyles = extractFooterStyles();

    // ── 3k. Font weight usage ──
    tokens.fontWeights = extractFontWeights();

    // ── 3b. Detect actual page background ──
    // Scan body + html + top-level containers, not modals/overlays
    tokens.pageBackground = detectActualPageBackground();

    // ── 4. Layout info ──
    const bodyCs = window.getComputedStyle(document.body);
    tokens.layoutInfo = {
      maxWidth: bodyCs.maxWidth,
      hasSidebar: !!document.querySelector('aside,[class*="sidebar"],[class*="side-nav"]'),
      hasNav: !!document.querySelector('nav,header'),
      hasHero: !!document.querySelector('[class*="hero"],[class*="banner"],[class*="jumbotron"]'),
      pageType: detectPageType(),
    };

    // ── 5. Section content map ──
    tokens.sectionContentMap = extractSectionContentMap();
    tokens.footerContentMap = extractFooterContentMap();
    tokens.contactSection = detectContactSection();
    tokens.stickySections = detectStickyScrollSections();
    tokens.svgDiagramAnimations = detectSvgDiagramAnimations();
    tokens.sectionBackgroundDecorations = detectSectionBackgroundDecorations();

    // ── 6. Deep visual analysis ──
    tokens.visualProfile = extractVisualProfile();

    // ── 7. Advanced pattern detection ──
    tokens.rotatingText = detectRotatingText();
    tokens.illustrationStyle = detectIllustrations();
    tokens.curvedPanels = detectCurvedPanels();
    tokens.countdownElements = detectCountdownElements();
    tokens.caseGridPattern = detectCaseGridPattern();
    tokens.navPattern = detectNavPattern();
    tokens.customCursor = detectCustomCursor();
    tokens.masonryGrid = detectMasonryGrid();

    // ── 8. Responsive breakpoints ──
    tokens.breakpoints = extractBreakpoints();

    // ── 8b. Dark mode tokens ──
    tokens.darkModeTokens = extractDarkModeTokens();

    // ── 9. Asset URLs (fonts, backgrounds, icons) ──
    tokens.assets = extractAssets();

    // ── 10. Animation libraries ──
    tokens.animationLibraries = detectAnimationLibraries();

    // ── 11. Deep motion profile ──
    tokens.motionProfile = extractDeepMotionProfile();

    // ── 12. Hero entrance sequence ──
    tokens.heroEntranceSequence = extractHeroEntranceSequence();

    // ── 13. Rive / Lottie detection ──
    tokens.riveAndLottie = detectRiveAndLottie();

    // ── 14. Tabbed content components ──
    tokens.tabbedComponents = detectTabbedContentComponents();

    // ── 15. Fixed / sticky UI chrome ──
    tokens.fixedUIChrome = detectFixedUIChrome();

    // ── 16. Multi-state interactive capture ──
    // Skip on heavy DOMs (Notion, Linear, Figma-like apps) — click simulation is unreliable and slow
    const _domSize = document.querySelectorAll('*').length;
    tokens.interactiveStates = _domSize <= 2500 ? await extractAllInteractiveStates() : null;

    // ── 17. Layered image compositions ──
    tokens.layeredImages = detectLayeredImages();

    // ── 18. Spacing scale ──
    tokens.spacingScale = detectSpacingScale();

    // ── 19. Iconography & visual system ──
    tokens.iconographySystem = extractIconographySystem();

    // ── 20. Section-specific illustrations ──
    tokens.sectionIllustrations = detectSectionIllustrations();

    // ── 21. Subtle background textures ──
    tokens.subtleTextures = detectSubtleBackgroundTextures();

    // ── 22a. Visual type classification ──
    tokens.visualClassification = classifyVisuals();

    // ── 22b. Card styles ──
    tokens.cardStyles = extractCardStyles();

    // ── 22c. CSS filter effects ──
    tokens.filterEffects = extractFilterEffects();

    // ── 22d. Shadow system analysis ──
    tokens.shadowSystem = analyzeShadowSystem(tokens.shadows);

    // ── 23. Hero image URL (for Vision API illustration analysis) ──
    tokens.heroImageUrl = null;
    const _heroEl = document.querySelector(
      '[class*="hero"], [class*="Hero"], main > section:first-child, section:first-of-type'
    );
    if (_heroEl) {
      // Strategy 1: <img> tag — dropped [class*="logo"] exclusion because class
      // names like "hero-logo-mark" or "brand-logo-hero" are the actual hero visual
      // on wordmark/monogram-first sites. Size + center-of-viewport filters are
      // sufficient to reject corner/nav logos without the class blacklist.
      const _heroImg = _heroEl.querySelector('img:not([class*="avatar"])');
      if (_heroImg?.src) {
        const _heroRect = _heroImg.getBoundingClientRect();
        const _vwCenter = window.innerWidth / 2;
        const _overlapsCenter = _heroRect.left < _vwCenter && _heroRect.right > _vwCenter;
        if (_heroRect.width > 200 && _heroRect.height > 200 && _overlapsCenter) {
          tokens.heroImageUrl = _heroImg.src;
        }
      }
      // Strategy 2: background-image on visual container
      if (!tokens.heroImageUrl) {
        const _bgEls = _heroEl.querySelectorAll('[class*="visual"], [class*="image"], [class*="graphic"]');
        for (const el of _bgEls) {
          const _bg = window.getComputedStyle(el).backgroundImage;
          const _bgMatch = _bg?.match(/url\(["']?([^"')]+)["']?\)/);
          if (_bgMatch?.[1] && !_bgMatch[1].startsWith('data:')) {
            tokens.heroImageUrl = _bgMatch[1].startsWith('http')
              ? _bgMatch[1]
              : new URL(_bgMatch[1], window.location.origin).href;
            break;
          }
        }
      }
    }

    // ── 23. Framework / site builder detection ──
    tokens.frameworkDetection = detectFrameworkSite();

    // ── 24. Design system fingerprinting ──
    tokens.designSystem = detectDesignSystem();

    return tokens;
  }

  // ─── Design system fingerprinting ──────────────────────────────────────────
  function detectDesignSystem() {
    try {
      const root = document.documentElement;
      const cs = window.getComputedStyle(root);
      const hasVar = (name) => { const v = cs.getPropertyValue(name).trim(); return v && v !== ''; };
      const hasEl = (sel) => { try { return !!document.querySelector(sel); } catch(e) { return false; } };

      // shadcn/ui: uses --radius, --background, --foreground, --primary CSS vars
      if (hasVar('--radius') && hasVar('--background') && hasVar('--foreground') && hasVar('--primary')) {
        return { name: 'shadcn/ui', confidence: 'high', note: 'Override only divergent tokens from shadcn defaults' };
      }

      // Radix UI: [data-radix-*] attributes
      if (hasEl('[data-radix-popper-content-wrapper]') || hasEl('[data-radix-collection-item]') || hasEl('[data-radix-scroll-area-viewport]')) {
        return { name: 'Radix UI', confidence: 'high', note: 'Radix primitives detected — tokens represent the styling layer on top of headless components' };
      }

      // Chakra UI: .chakra-* classes
      if (hasEl('[class*="chakra-"]')) {
        return { name: 'Chakra UI', confidence: 'high', note: 'Chakra UI detected — extracted tokens override the default theme' };
      }

      // Mantine: --mantine-* CSS vars
      if (hasVar('--mantine-color-scheme') || hasVar('--mantine-primary-color-filled')) {
        return { name: 'Mantine', confidence: 'high', note: 'Mantine detected — use extracted --mantine-* vars as theme overrides' };
      }

      // Ant Design: .ant-* classes
      if (hasEl('[class*="ant-btn"]') || hasEl('[class*="ant-layout"]')) {
        return { name: 'Ant Design', confidence: 'medium', note: 'Ant Design detected — tokens represent customization on top of antd defaults' };
      }

      // Material UI: .Mui* classes or --mui-* vars
      if (hasEl('[class*="MuiButton"]') || hasEl('[class*="MuiTypography"]') || hasVar('--mui-palette-primary-main')) {
        return { name: 'Material UI', confidence: 'medium', note: 'MUI detected — use extracted palette to configure createTheme()' };
      }
    } catch(e) { console.debug('[VibeDesign] Design system detection:', e.message); }
    return null;
  }

  // ─── Framework / site builder detection ────────────────────────────────────
  function detectFrameworkSite() {
    const result = { isFramer: false, isWebflow: false, isEditor: null, signals: [] };

    // Framer signals
    const framerSignals = [];
    if (document.querySelector('[class*="framer-"]')) framerSignals.push('framer-class');
    if (document.querySelector('[data-framer-component-type]')) framerSignals.push('framer-component-attr');
    if (document.querySelector('[data-framer-name]')) framerSignals.push('framer-name-attr');
    // Framer injects a script with "framer.com" or "framerusercontent"
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    if (scripts.some(s => /framer(user)?content|framer\.com\/m\//i.test(s.src || ''))) framerSignals.push('framer-script');
    // Framer adds CSS custom props like --framer-font-size
    const rootStyles = getComputedStyle(document.documentElement);
    const framerCSSVar = rootStyles.getPropertyValue('--framer-font-size') || rootStyles.getPropertyValue('--framer-color-tint');
    if (framerCSSVar) framerSignals.push('framer-css-var');
    // Meta generator or canonical URL
    const metaGen = document.querySelector('meta[name="generator"]');
    if (metaGen?.content?.toLowerCase().includes('framer')) framerSignals.push('framer-generator-meta');
    if (window.location.hostname.endsWith('.framer.website') || window.location.hostname.endsWith('.framer.app')) {
      framerSignals.push('framer-hostname');
    }

    if (framerSignals.length >= 1) {
      result.isFramer = true;
      result.isEditor = 'framer';
      result.signals = framerSignals;
    }

    // Webflow signals (secondary, for future use)
    if (!result.isFramer) {
      const webflowSignals = [];
      if (document.querySelector('[class*="w-"]') && document.querySelector('html[data-wf-site]')) webflowSignals.push('webflow-attr');
      if (scripts.some(s => /webflow\.com/i.test(s.src || ''))) webflowSignals.push('webflow-script');
      if (webflowSignals.length >= 1) {
        result.isWebflow = true;
        result.isEditor = 'webflow';
        result.signals = webflowSignals;
      }
    }

    // ── CSS framework detection via variable prefixes ──
    const _rootCs = rootStyles; // already computed above
    const _allVarNames = [];
    try {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText === ':root' || rule.selectorText === ':root, :host') {
              for (let i = 0; i < rule.style.length; i++) {
                const prop = rule.style[i];
                if (prop.startsWith('--')) _allVarNames.push(prop);
              }
            }
          }
        } catch(e) { /* cross-origin */ }
      }
    } catch(e) {}
    const _hasTwVars = _allVarNames.some(v => v.startsWith('--tw-'));
    const _hasBsVars = _allVarNames.some(v => v.startsWith('--bs-'));
    const _hasChakraVars = _allVarNames.some(v => v.startsWith('--chakra-'));
    const _hasMuiVars = _allVarNames.some(v => v.startsWith('--mui-'));

    const cssFrameworks = [];
    if (_hasTwVars || document.querySelector('[class*="tw-"], [class*="sm\\:"], [class*="md\\:"], [class*="lg\\:"]')) cssFrameworks.push('tailwind');
    if (_hasBsVars) cssFrameworks.push('bootstrap');
    if (_hasChakraVars) cssFrameworks.push('chakra-ui');
    if (_hasMuiVars) cssFrameworks.push('material-ui');
    result.cssFrameworks = cssFrameworks;

    // ── JS framework detection ──
    const jsFrameworks = [];
    if (document.querySelector('#__next') || document.querySelector('[data-nextjs-scroll-focus-boundary]')) jsFrameworks.push('nextjs');
    if (document.querySelector('#__nuxt') || document.querySelector('[data-v-app]')) jsFrameworks.push('nuxt');
    if (document.querySelector('#app[data-v-app]') || document.querySelector('[data-v-]')) jsFrameworks.push('vue');
    if (document.querySelector('[data-reactroot]') || document.querySelector('[id="__next"]')) { if (!jsFrameworks.includes('nextjs')) jsFrameworks.push('react'); }
    if (document.querySelector('script[src*="gatsby"]') || document.querySelector('#___gatsby')) jsFrameworks.push('gatsby');
    result.jsFrameworks = jsFrameworks;

    return result;
  }

  // ─── Deep motion profile — scroll behavior & timing personality ──────────
  function extractDeepMotionProfile() {
    const profile = {
      scrollParadigm: null,
      revealStyle: null,
      timingPersonality: null,
      dominantDuration: null,
      dominantEasing: null,
      staggerPattern: null,
      gsapScrollTriggers: null,
      revealKeyframes: [],
    };

    // 1. Scroll-scrub detection
    const hasScrollTimeline = Array.from(document.styleSheets).some(sheet => {
      try {
        return Array.from(sheet.cssRules || []).some(rule =>
          rule.style && rule.style.animationTimeline && rule.style.animationTimeline.includes('scroll')
        );
      } catch(e) { return false; }
    });
    const scrollDrivenEls = document.querySelectorAll('[style*="animation-timeline"],[style*="view-timeline"]');
    if (hasScrollTimeline || scrollDrivenEls.length > 0) profile.scrollParadigm = 'scroll-scrub';

    // 2. Classify reveal style from @keyframes
    const revealKeyframes = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules || [])) {
          if (rule.type !== CSSRule.KEYFRAMES_RULE) continue;
          const frames = Array.from(rule.cssRules || []);
          if (frames.length === 0) continue;
          const first = frames[0];
          const last = frames[frames.length - 1];
          const fromProps = {}, toProps = {};
          const props = ['opacity','transform','clip-path','filter','translate'];
          if (first?.style) props.forEach(p => { const v = first.style.getPropertyValue(p); if (v) fromProps[p] = v; });
          if (last?.style) props.forEach(p => { const v = last.style.getPropertyValue(p); if (v) toProps[p] = v; });
          let revealType = null;
          const fromClip = fromProps['clip-path'];
          const toClip = toProps['clip-path'];
          // Check both transform and standalone translate property (modern CSS)
          const hasTranslateX = fromProps.transform?.includes('translateX') || (fromProps.translate && /^-?\d/.test(fromProps.translate));
          const hasTranslateY = fromProps.transform?.includes('translateY') || (fromProps.translate && /\s-?\d/.test(fromProps.translate));
          if (fromClip && fromClip !== toClip) {
            revealType = 'clip-path-reveal';
          } else if (fromProps.transform && fromProps.transform.includes('scaleY(0)')) {
            revealType = 'mask-reveal';
          } else if (fromProps.opacity === '0' && (fromProps.transform?.includes('translateY') || (fromProps.translate && !hasTranslateX))) {
            // translateY in transform OR standalone translate with only Y component
            revealType = 'fade-up';
          } else if (fromProps.opacity === '0' && hasTranslateX) {
            // translateX in transform OR standalone translate with X component (e.g. translate: -100%)
            revealType = 'fade-left-or-right';
          } else if (fromProps.opacity === '0' && !fromProps.transform && !fromProps.translate) {
            revealType = 'fade-only';
          } else if (fromProps.transform?.includes('scale(0') || fromProps.transform?.includes('scale(0.8')) {
            revealType = 'scale-in';
          }
          if (revealType) revealKeyframes.push({ name: rule.name, revealType, from: fromProps, to: toProps });
        }
      } catch(e) { console.debug('[VibeDesign]', e.message); }
    }
    if (revealKeyframes.length > 0) {
      const typeCounts = {};
      revealKeyframes.forEach(k => { typeCounts[k.revealType] = (typeCounts[k.revealType] || 0) + 1; });
      profile.revealStyle = Object.entries(typeCounts).sort((a,b) => b[1]-a[1])[0]?.[0];
      profile.revealKeyframes = revealKeyframes.slice(0, 6);
    }

    // 3. Dominant duration + easing personality
    // Fix 4: filter carousel/library elements to avoid skewing the average
    const MOTION_SKIP_SELECTORS = '.swiper, .swiper-wrapper, .swiper-slide, [class*="splide__"], [class*="glide__"], [class*="embla__"], [class*="keen-slider"]';
    let skipEls;
    try { skipEls = new Set(Array.from(document.querySelectorAll(MOTION_SKIP_SELECTORS))); } catch(e) { skipEls = new Set(); }

    const durations = [], easings = [];
    let sampled = 0;
    for (const el of document.querySelectorAll('*')) {
      if (sampled > 300) break;
      // Skip library-owned elements
      if (skipEls.has(el)) continue;
      try {
        const closest = el.closest?.('.swiper, [class*="splide"], [class*="embla"]');
        if (closest) continue;
      } catch(e) { console.debug('[VibeDesign]', e.message); }
      try {
        const cs = window.getComputedStyle(el);
        const tr = cs.transitionDuration, te = cs.transitionTimingFunction, an = cs.animationDuration;
        if (tr && tr !== '0s') {
          const ms = parseFloat(tr) * (tr.includes('ms') ? 1 : 1000);
          // Fix 4: ignore durations > 2s (decorative loops like marquee, rotate) and < 50ms (imperceptible)
          if (ms >= 50 && ms <= 2000) { durations.push(ms); sampled++; }
        }
        if (an && an !== '0s') {
          const ms = parseFloat(an) * (an.includes('ms') ? 1 : 1000);
          if (ms >= 50 && ms <= 2000) durations.push(ms);
        }
        if (te && te !== 'ease' && te !== 'initial' && te !== 'ease 0s') easings.push(te);
      } catch(e) { console.debug('[VibeDesign]', e.message); }
    }
    if (durations.length > 0) {
      // Fix 4: use mode-bucket instead of mean — avoids long-tail skew from one slow animation
      const short = durations.filter(d => d < 200).length;
      const medium = durations.filter(d => d >= 200 && d < 500).length;
      const long = durations.filter(d => d >= 500).length;
      const dominant = short >= medium && short >= long ? 'short' : medium >= long ? 'medium' : 'long';
      const bucketRepresentative = { short: 150, medium: 300, long: 600 };
      profile.dominantDuration = bucketRepresentative[dominant] + 'ms';
      // Timing personality from bucket
      if (dominant === 'short') profile.timingPersonality = 'snappy';
      else if (dominant === 'medium') profile.timingPersonality = 'smooth';
      else profile.timingPersonality = 'editorial';
    }
    if (easings.length > 0) {
      const easeCount = {};
      easings.forEach(e => { easeCount[e] = (easeCount[e] || 0) + 1; });
      const topEasing = Object.entries(easeCount).sort((a,b) => b[1]-a[1])[0]?.[0];
      if (topEasing) {
        profile.dominantEasing = topEasing;
        const cbMatch = topEasing.match(/cubic-bezier\(([\d.]+),\s*([\d.-]+),\s*([\d.]+),\s*([\d.-]+)\)/);
        if (cbMatch) {
          const [,x1,y1,x2,y2] = cbMatch.map(Number);
          if (y1 > 1 || y2 > 1 || y1 < 0) profile.timingPersonality = 'springy';
        }
      }
    }

    // 4. Stagger pattern detection
    const staggerCandidates = [];
    const animatedEls = document.querySelectorAll('[class*="animate"],[class*="reveal"],[class*="fade"],[data-aos],[class*="motion"],[class*="entrance"],[class*="appear"]');
    for (const el of Array.from(animatedEls).slice(0, 50)) {
      try {
        const cs = window.getComputedStyle(el);
        const delay = cs.animationDelay || cs.transitionDelay;
        if (delay && delay !== '0s') {
          const ms = parseFloat(delay) * (delay.includes('ms') ? 1 : 1000);
          staggerCandidates.push({ ms, el: el.tagName });
        }
      } catch(e) { console.debug('[VibeDesign]', e.message); }
    }
    if (staggerCandidates.length >= 3) {
      const delays = staggerCandidates.map(s => s.ms).sort((a,b) => a-b);
      const diffs = delays.slice(1).map((d,i) => d - delays[i]);
      const avgDiff = diffs.reduce((a,b) => a+b, 0) / diffs.length;
      if (avgDiff > 20 && avgDiff < 300) {
        profile.staggerPattern = {
          delayBetween: Math.round(avgDiff) + 'ms',
          elementCount: staggerCandidates.length,
          tag: staggerCandidates[0]?.el,
        };
      }
    }

    // 5. GSAP ScrollTrigger live config
    try {
      if (window.ScrollTrigger && window.ScrollTrigger.getAll) {
        const triggers = window.ScrollTrigger.getAll().slice(0, 8);
        profile.gsapScrollTriggers = triggers.map(t => ({
          trigger: (t.vars?.trigger?.className || t.trigger?.className || 'unknown').toString().trim().slice(0, 40),
          start: t.vars?.start || t.start || null,
          end: t.vars?.end || null,
          scrub: !!(t.vars?.scrub),
          pin: !!(t.vars?.pin),
        }));
        if (profile.gsapScrollTriggers.some(t => t.scrub)) profile.scrollParadigm = 'scroll-scrub';
        else if (!profile.scrollParadigm) profile.scrollParadigm = 'trigger-based';
      }
    } catch(e) { console.debug('[VibeDesign]', e.message); }

    if (!profile.scrollParadigm) {
      profile.scrollParadigm = (document.querySelector('[data-aos],[data-scroll]')) ? 'trigger-based' : 'trigger-based';
    }

    return profile;
  }

  // ─── Hero entrance sequence extraction ────────────────────────────────────
  function extractHeroEntranceSequence() {
    const hero = document.querySelector(
      '[class*="hero"],[class*="Hero"],main > section:first-child,section:first-of-type,header + section,.hero,#hero'
    );
    if (!hero) return null;

    const sequence = [];
    const children = hero.querySelectorAll('h1,h2,p,[class*="subtitle"],[class*="cta"],button,a,[class*="badge"],[class*="tag"],[class*="label"]');
    for (const el of Array.from(children).slice(0, 12)) {
      try {
        const cs = window.getComputedStyle(el);
        const animName = cs.animationName;
        const animDelay = cs.animationDelay;
        const animDuration = cs.animationDuration;
        const rect = el.getBoundingClientRect();
        if (rect.bottom < -100) continue;
        const delayMs = animDelay && animDelay !== '0s' ? Math.round(parseFloat(animDelay) * (animDelay.includes('ms') ? 1 : 1000)) : null;
        const durationMs = animDuration && animDuration !== '0s' ? Math.round(parseFloat(animDuration) * (animDuration.includes('ms') ? 1 : 1000)) : null;
        if (animName && animName !== 'none') {
          sequence.push({ tag: el.tagName.toLowerCase(), text: (el.textContent||'').trim().slice(0,40), animName, delay: delayMs !== null ? delayMs + 'ms' : null, duration: durationMs !== null ? durationMs + 'ms' : null, opacity: parseFloat(cs.opacity) < 0.5 ? 'starts-invisible' : 'visible' });
        } else if (parseFloat(cs.opacity) < 0.2 && rect.width > 0) {
          sequence.push({ tag: el.tagName.toLowerCase(), text: (el.textContent||'').trim().slice(0,40), animName: 'js-triggered-entrance', delay: null, duration: null, opacity: 'starts-invisible' });
        }
      } catch(e) { console.debug('[VibeDesign]', e.message); }
    }

    const heroCanvas = hero.querySelector('canvas');
    const heroVideo = hero.querySelector('video');
    const heroSvgAnim = hero.querySelector('svg animate,svg animateTransform,svg animateMotion');
    return {
      elements: sequence,
      hasCanvasAnimation: !!heroCanvas,
      hasVideoBackground: !!heroVideo,
      hasSvgAnimation: !!heroSvgAnim,
      canvasSize: heroCanvas ? { w: Math.round(heroCanvas.getBoundingClientRect().width), h: Math.round(heroCanvas.getBoundingClientRect().height) } : null,
    };
  }

  // ─── Rive & Lottie detection ───────────────────────────────────────────────
  function detectRiveAndLottie() {
    const result = { hasRive: false, hasLottie: false, hasDotLottie: false, details: [] };

    // Rive
    try {
      if (window.Rive || window.rive) result.hasRive = true;
      for (const s of document.querySelectorAll('script[src]')) {
        if (s.src.toLowerCase().includes('rive')) result.hasRive = true;
      }
      const riveCanvas = document.querySelectorAll('canvas[class*="rive"],canvas[data-src*=".riv"],[class*="rive-canvas"],canvas[id*="rive"]');
      if (riveCanvas.length > 0) {
        result.hasRive = true;
        for (const c of riveCanvas) {
          const rect = c.getBoundingClientRect();
          result.details.push({ type: 'rive', location: rect.top < window.innerHeight ? 'above-fold' : 'below-fold', size: { w: Math.round(rect.width), h: Math.round(rect.height) }, dataSrc: c.dataset.src || null, id: c.id || null });
        }
      }
      if (!result.hasRive) {
        for (const c of document.querySelectorAll('canvas')) {
          const parent = c.closest('[class*="hero"],[class*="Hero"],section:first-of-type,main > div:first-child');
          if (parent) {
            const rect = c.getBoundingClientRect();
            if (rect.width > 100 && rect.height > 100) {
              result.details.push({ type: 'canvas-hero-animation', location: 'above-fold', size: { w: Math.round(rect.width), h: Math.round(rect.height) }, note: 'Canvas in hero — likely Rive, Three.js, or custom WebGL' });
            }
          }
        }
      }
    } catch(e) { console.debug('[VibeDesign]', e.message); }

    // Lottie
    try {
      if (window.lottie || window.Lottie || window.bodymovin) result.hasLottie = true;
      for (const s of document.querySelectorAll('script[src]')) {
        if (/lottie|bodymovin/.test(s.src.toLowerCase())) result.hasLottie = true;
      }
      const lottieEls = document.querySelectorAll('lottie-player,[class*="lottie"],[data-lottie],[id*="lottie"]');
      if (lottieEls.length > 0) {
        result.hasLottie = true;
        // Find the single best (largest visible) element — avoid pushing one entry per wrapper div
        let bestEl = null, bestArea = 0;
        for (const el of lottieEls) {
          const rect = el.getBoundingClientRect();
          const area = rect.width * rect.height;
          if (area > bestArea) { bestArea = area; bestEl = el; }
        }
        if (bestEl) {
          const rect = bestEl.getBoundingClientRect();
          const src = bestEl.getAttribute('src') || bestEl.getAttribute('data-src') || bestEl.dataset?.lottie;
          result.details.push({
            type: 'lottie',
            location: rect.top < window.innerHeight ? 'above-fold' : 'below-fold',
            size: rect.width > 0 ? { w: Math.round(rect.width), h: Math.round(rect.height) } : null,
            src: src ? src.split('/').pop()?.slice(0, 50) : null,
            loop: bestEl.getAttribute('loop') !== null,
            autoplay: bestEl.getAttribute('autoplay') !== null,
            totalCount: lottieEls.length,
          });
        }
      }
    } catch(e) { console.debug('[VibeDesign]', e.message); }

    // DotLottie
    try {
      if (window.DotLottie) result.hasDotLottie = true;
      const dotEls = document.querySelectorAll('dotlottie-player,[class*="dotlottie"]');
      if (dotEls.length > 0) { result.hasDotLottie = true; result.details.push({ type: 'dotlottie', count: dotEls.length }); }
    } catch(e) { console.debug('[VibeDesign]', e.message); }

    return (result.hasRive || result.hasLottie || result.hasDotLottie || result.details.length > 0) ? result : null;
  }

  // ─── Animation library detection ─────────────────────────────────────────
  function detectAnimationLibraries() {
    const found = new Set();

    // 1. Global window objects
    try {
      if (window.gsap || window.ScrollTrigger) found.add('gsap');
      if (window.Lenis) found.add('lenis');
      if (window.locomotiveScroll) found.add('locomotive-scroll');
      if (window.THREE) found.add('three.js');
      if (window.PIXI || window.PixiJS) found.add('pixi.js');
    } catch(e) { console.debug('[VibeDesign]', e.message); }

    // 2. Script src patterns
    try {
      for (const script of document.querySelectorAll('script[src]')) {
        const src = (script.src || '').toLowerCase();
        if (src.includes('gsap')) found.add('gsap');
        if (src.includes('three')) found.add('three.js');
        if (src.includes('lenis')) found.add('lenis');
        if (src.includes('framer-motion')) found.add('framer-motion');
        if (/\/anime(\.min)?\.js/.test(src) || src.includes('animejs')) found.add('anime.js');
      }
    } catch(e) { console.debug('[VibeDesign]', e.message); }

    // 3. DOM class/attribute markers
    try {
      if (document.querySelector('[data-scroll],[data-scroll-container]')) found.add('locomotive-scroll');
      if (document.querySelector('[data-aos]')) found.add('aos');
      if (document.querySelector('[data-gsap],[class*="gsap-"]')) found.add('gsap');
    } catch(e) { console.debug('[VibeDesign]', e.message); }

    return [...found];
  }

  // ─── Asset extraction: fonts, background images, icons ───────────────────
  function extractAssets() {
    const assets = { fonts: [], backgrounds: [], icons: [] };

    // ── Font face URLs from stylesheets ──
    const sheets = Array.from(document.styleSheets);
    for (const sheet of sheets) {
      try {
        for (const rule of Array.from(sheet.cssRules || [])) {
          if (rule.type === CSSRule.FONT_FACE_RULE) {
            const src = rule.style.getPropertyValue('src');
            const family = rule.style.getPropertyValue('font-family')?.replace(/['"]/g, '').trim();
            const urlMatch = src.match(/url\(["']?([^"')]+)["']?\)/);
            if (urlMatch && family) {
              const url = urlMatch[1];
              if (/\.(woff2?|ttf|otf)(\?|$)/i.test(url) && !url.startsWith('data:')) {
                const absolute = url.startsWith('http') ? url : new URL(url, window.location.origin).href;
                assets.fonts.push({ family, url: absolute });
              }
            }
          }
        }
      } catch(e) { console.debug('[VibeDesign]', e.message); }
    }
    // Dedupe by family name, cap at 10
    const seenFamilies = new Set();
    assets.fonts = assets.fonts.filter(f => {
      if (seenFamilies.has(f.family)) return false;
      seenFamilies.add(f.family);
      return true;
    }).slice(0, 10);

    // ── Background pattern/texture URLs ──
    const bgCandidates = document.querySelectorAll(
      'body, main, section, [class*="hero"], [class*="bg-"], [class*="background"], ' +
      '[class*="pattern"], [class*="grid"], [class*="noise"], [class*="texture"], [class*="spotlight"]'
    );
    const seenBgUrls = new Set();
    for (const el of Array.from(bgCandidates).slice(0, 30)) {
      try {
        const cs = window.getComputedStyle(el);
        const bgImage = cs.backgroundImage;
        if (!bgImage || bgImage === 'none') continue;
        const urlMatches = bgImage.match(/url\(["']?([^"')]+)["']?\)/g);
        if (!urlMatches) continue;
        for (const match of urlMatches) {
          const url = match.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
          if (!url || url.startsWith('data:')) continue;
          const absolute = url.startsWith('http') ? url : new URL(url, window.location.origin).href;
          if (seenBgUrls.has(absolute)) continue;
          seenBgUrls.add(absolute);
          const ext = absolute.split('?')[0].split('.').pop()?.toLowerCase();
          const isSvg = ext === 'svg' || absolute.includes('.svg');
          const rect = el.getBoundingClientRect();
          assets.backgrounds.push({
            url: absolute,
            type: isSvg ? 'svg-pattern' : 'image-texture',
            element: el.tagName.toLowerCase(),
            fullWidth: rect.width > window.innerWidth * 0.7,
          });
        }
      } catch(e) { console.debug('[VibeDesign]', e.message); }
    }
    assets.backgrounds = assets.backgrounds.slice(0, 8);

    // ── Favicon / apple-touch-icon ──
    for (const sel of ['link[rel="icon"]','link[rel="shortcut icon"]','link[rel="apple-touch-icon"]','link[rel="mask-icon"]']) {
      const el = document.querySelector(sel);
      if (el?.href) assets.icons.push({ type: sel.includes('apple') ? 'apple-touch' : 'favicon', url: el.href });
    }

    return assets;
  }

  // ─── Breakpoint extraction from CSS media queries ────────────────────────
  function extractBreakpoints() {
    const bpMap = {};
    try {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.type === CSSRule.MEDIA_RULE) {
              const cond = rule.conditionText || rule.media?.mediaText || '';
              const m = cond.match(/(\d{3,4})px/);
              if (m) {
                const px = parseInt(m[1]);
                if (px >= 320 && px <= 1920) {
                  if (!bpMap[px]) bpMap[px] = { px, ruleCount: 0, condition: cond };
                  bpMap[px].ruleCount += rule.cssRules.length;
                }
              }
            }
          }
        } catch(e) { /* cross-origin sheet, skip */ }
      }
    } catch(e) { console.debug('[VibeDesign]', e.message); }
    return Object.values(bpMap).sort((a,b) => a.px - b.px).slice(0, 8);
  }

  // ─── Dark mode token extraction ───────────────────────────────────────────
  function extractDarkModeTokens() {
    const tokens = {};
    try {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.type === CSSRule.MEDIA_RULE &&
                rule.conditionText && rule.conditionText.includes('prefers-color-scheme') &&
                rule.conditionText.includes('dark')) {
              for (const inner of rule.cssRules) {
                if (inner.style) {
                  for (let i = 0; i < inner.style.length; i++) {
                    const prop = inner.style[i];
                    if (prop.startsWith('--') ||
                        ['background-color','color','border-color','background'].includes(prop)) {
                      const val = inner.style.getPropertyValue(prop).trim();
                      if (val) tokens[prop] = val;
                    }
                  }
                }
              }
            }
          }
        } catch(e) { /* cross-origin sheet */ }
      }
    } catch(e) { console.debug('[VibeDesign]', e.message); }
    return Object.keys(tokens).length > 0 ? tokens : null;
  }

  // ─── Rotating / cycling text detection ───────────────────────────────────
  function detectRotatingText() {
    const results = [];
    const hero = document.querySelector('[class*="hero"], [class*="Hero"], main > section:first-child, section:first-of-type');
    if (!hero) return null;

    // Strategy 1: Multiple hidden/shown siblings (Swiper-style word rotation)
    const candidates = hero.querySelectorAll(
      'h1, h2, [class*="rotating"], [class*="Rotating"], [class*="cycle"], [class*="Cycle"], ' +
      '[class*="word-switch"], [class*="text-rotate"], [class*="headline"]'
    );
    for (const el of candidates) {
      const children = Array.from(el.children);
      if (children.length >= 2) {
        const texts = children.map(c => c.textContent?.trim()).filter(t => t && t.length > 0 && t.length < 60);
        const visibleCount = children.filter(c => {
          const cs = getComputedStyle(c);
          return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.1;
        }).length;
        if (texts.length >= 2 && visibleCount <= 2 && visibleCount < texts.length) {
          results.push({ element: el.tagName, words: texts, class: el.className?.slice(0, 50) });
        }
      }
    }

    // Strategy 2: JS-driven textContent rotation — detect via heuristic
    // If hero has a short H1 (single word) + a static subtitle above/below = likely rotating
    if (results.length === 0) {
      const h1 = hero.querySelector('h1');
      const h3 = hero.querySelector('h3, [class*="sub"], [class*="tagline"]');
      if (h1 && h3) {
        const h1Text = h1.textContent?.trim();
        const h3Text = h3.textContent?.trim();
        // Short H1 (1-2 words) with a longer subtitle = rotating word pattern
        if (h1Text && h1Text.split(/\s+/).length <= 3 && h3Text && h3Text.length > 10) {
          // Try to find the word list from category tags on the page (portfolio sites reuse category names)
          const tagEls = document.querySelectorAll('[class*="tag"], [class*="Tag"], [class*="category"], [class*="Category"], [class*="filter"] button, [class*="filter"] a');
          const tagTexts = [...new Set(Array.from(tagEls).map(t => t.textContent?.trim()).filter(t => t && t.length > 2 && t.length < 30))];
          if (tagTexts.length >= 2) {
            results.push({ element: 'H1', words: tagTexts, fixedLabel: h3Text, jsRotated: true });
          } else {
            // Mark as likely rotating even without word list
            results.push({ element: 'H1', words: [h1Text], fixedLabel: h3Text, jsRotated: true, note: 'Single visible word — likely cycles via JS' });
          }
        }
      }
    }

    return results.length > 0 ? results : null;
  }

  // ─── Illustration detection (SVG line-art vs photos vs WebGL) ─────────────
  function detectIllustrations() {
    const hero = document.querySelector('[class*="hero"], [class*="Hero"], main > section:first-child, section:first-of-type');
    if (!hero) return null;
    const result = { type: 'none', details: null };

    // Strategy 1: Large visible SVGs with many paths = line-art illustration
    const svgs = hero.querySelectorAll('svg');
    for (const svg of svgs) {
      const paths = svg.querySelectorAll('path, line, circle, rect, polygon, ellipse');
      const r = svg.getBoundingClientRect();
      if (paths.length > 10 && r.width > 100 && r.height > 100) {
        const fills = new Set();
        for (const p of Array.from(paths).slice(0, 20)) fills.add(getComputedStyle(p).fill);
        result.type = fills.size <= 3 ? 'monochrome-line-art' : 'colored-illustration';
        result.details = { pathCount: paths.length, width: Math.round(r.width), height: Math.round(r.height) };
        return result;
      }
    }
    // Also check hidden SVGs (rendered via JS/WebGL) — count total paths
    let totalHiddenPaths = 0;
    for (const svg of svgs) {
      const r = svg.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) {
        totalHiddenPaths += svg.querySelectorAll('path, line, circle').length;
      }
    }
    if (totalHiddenPaths > 30) {
      result.type = 'hidden-svg-illustration';
      result.details = { pathCount: totalHiddenPaths, note: 'SVGs present but hidden — likely rendered via WebGL/JS' };
      return result;
    }

    // Strategy 2: Visible large images with illustration-like names
    const imgs = hero.querySelectorAll('img');
    for (const img of imgs) {
      const r = img.getBoundingClientRect();
      const src = (img.src || '').toLowerCase();
      if (r.width > 200 && r.height > 200) {
        if (/illustration|drawing|sketch|hero|character/i.test(src + (img.alt || ''))) {
          result.type = 'illustration-image';
          result.details = { src: src.split('/').pop()?.slice(0, 50), width: Math.round(r.width), height: Math.round(r.height) };
          return result;
        }
      }
    }

    // Strategy 3: Hidden images used as WebGL/canvas source (display:none but has hero-related name)
    for (const img of imgs) {
      const cs = getComputedStyle(img);
      const src = (img.src || '').toLowerCase();
      if ((cs.display === 'none' || img.getBoundingClientRect().width === 0) &&
          /hero|illustration|character|sprite|drawing/i.test(src)) {
        result.type = 'webgl-illustration';
        result.details = { src: src.split('/').pop()?.slice(0, 50), note: 'Hidden image used as WebGL/canvas texture source' };
        return result;
      }
    }

    // Strategy 4: Canvas element in hero = WebGL/animated illustration
    const canvas = hero.querySelector('canvas');
    if (canvas) {
      const r = canvas.getBoundingClientRect();
      if (r.width > 200 && r.height > 200) {
        result.type = 'canvas-illustration';
        result.details = { width: Math.round(r.width), height: Math.round(r.height), note: 'Canvas-based animated illustration' };
        return result;
      }
    }

    // Strategy 5: Background-image based illustrations
    const bgEls = hero.querySelectorAll('[class*="illustration"], [class*="Illustration"], [class*="visual"], [class*="sprite"], [class*="character"]');
    for (const el of bgEls) {
      const cs = getComputedStyle(el);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        const r = el.getBoundingClientRect();
        if (r.width > 200 && r.height > 200) {
          result.type = 'spritesheet-illustration';
          result.details = { class: el.className?.slice(0, 40), width: Math.round(r.width), height: Math.round(r.height) };
          return result;
        }
      }
    }

    return result.type !== 'none' ? result : null;
  }

  // ─── Curved / arc decorative panels detection ────────────────────────────
  function detectCurvedPanels() {
    const panels = [];
    const allEls = document.querySelectorAll('div, aside, nav, section');
    for (const el of allEls) {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // Any positioned element on edge of viewport — fixed, sticky, absolute
      const isPositioned = cs.position === 'fixed' || cs.position === 'sticky' || cs.position === 'absolute';
      const isNarrowTall = r.width > 20 && r.width < 200 && r.height > 200;
      const isOnRightEdge = r.right >= window.innerWidth - 10;
      const isOnLeftEdge = r.left <= 10;
      const bg = cs.backgroundColor;
      const hasBg = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
      const hasClipPath = cs.clipPath && cs.clipPath !== 'none';
      const hasBorderRadius = cs.borderRadius && cs.borderRadius !== '0px';

      if (isNarrowTall && (isOnRightEdge || isOnLeftEdge) && (hasBg || hasClipPath)) {
        panels.push({
          side: isOnLeftEdge ? 'left' : 'right',
          width: Math.round(r.width),
          height: Math.round(r.height),
          bg: hasBg ? bg : 'transparent',
          borderRadius: hasBorderRadius ? cs.borderRadius : null,
          class: el.className?.slice(0, 50),
          hasMenu: !!el.querySelector('[class*="menu"], [class*="burger"], [class*="hamburger"], button'),
          clipPath: hasClipPath ? cs.clipPath?.slice(0, 60) : null,
          positioned: isPositioned,
        });
      }
    }
    return panels.length > 0 ? panels : null;
  }

  // ─── Custom cursor detection ─────────────────────────────────────────────
  function detectCustomCursor() {
    const result = { hasCustomCursor: false, type: null, details: null };

    // Strategy 1: CSS cursor:url() in stylesheets
    try {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules || []) {
            if (rule.style?.cursor && rule.style.cursor.includes('url(')) {
              result.hasCustomCursor = true;
              result.type = 'css-cursor-image';
              result.details = { selector: rule.selectorText?.slice(0, 50), cursor: rule.style.cursor?.slice(0, 80) };
              return result;
            }
          }
        } catch(e) { console.debug('[VibeDesign]', e.message); }
      }
    } catch(e) { console.debug('[VibeDesign]', e.message); }

    // Strategy 2: JS-driven cursor element (div following mouse, position:fixed, pointer-events:none)
    const cursorEls = document.querySelectorAll('[class*="cursor"], [class*="Cursor"], [id*="cursor"]');
    for (const el of cursorEls) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' && cs.pointerEvents === 'none') {
        result.hasCustomCursor = true;
        result.type = 'js-cursor-follower';
        const rect = el.getBoundingClientRect();
        const blendMode = cs.mixBlendMode !== 'normal' ? cs.mixBlendMode : null;
        const lerpDuration = cs.transitionDuration !== '0s' ? cs.transitionDuration : null;
        result.details = {
          class: el.className?.slice(0, 40),
          width: rect.width,
          height: rect.height,
          mixBlendMode: blendMode,
          transitionDuration: lerpDuration,
        };
        return result;
      }
    }

    // Strategy 3: body or html has cursor:none (real cursor hidden, JS replacement)
    if (getComputedStyle(document.body).cursor === 'none' || getComputedStyle(document.documentElement).cursor === 'none') {
      result.hasCustomCursor = true;
      result.type = 'cursor-hidden';
      result.details = { note: 'Native cursor hidden — JS cursor replacement active' };
      return result;
    }

    // Strategy 4: Non-standard CSS cursor values on interactive elements
    const interactiveEls = document.querySelectorAll('a, button, [class*="entry"], [class*="card"]');
    for (const el of Array.from(interactiveEls).slice(0, 20)) {
      const cursor = getComputedStyle(el).cursor;
      if (cursor && !['auto', 'pointer', 'default', 'text', 'inherit'].includes(cursor)) {
        result.hasCustomCursor = true;
        result.type = 'css-cursor-keyword';
        result.details = { cursor, element: el.tagName + '.' + (el.className?.slice(0, 20) || '') };
        return result;
      }
    }

    // Magnetic button detection (independent of cursor type)
    const magneticEls = document.querySelectorAll(
      '[class*="magnetic"], [class*="mag-"], [data-magnetic], [class*="attract"]'
    );
    if (magneticEls.length > 0) {
      result.hasMagneticElements = true;
      result.magneticCount = magneticEls.length;
    }

    return (result.hasCustomCursor || result.hasMagneticElements) ? result : null;
  }

  // ─── Masonry / Pinterest grid layout detection ───────────────────────────
  function detectMasonryGrid() {
    // Look for grid containers where children have varying heights and absolute positioning
    const candidates = document.querySelectorAll(
      '[class*="grid"], [class*="Grid"], [class*="masonry"], [class*="Masonry"], ' +
      '[class*="isotope"], [class*="Isotope"], [class*="pinterest"], [class*="waterfall"]'
    );
    for (const grid of candidates) {
      const children = Array.from(grid.children).filter(c => c.getBoundingClientRect().width > 50 && c.getBoundingClientRect().height > 50);
      if (children.length < 4) continue;

      // Detect columns from unique left positions
      const lefts = children.map(c => Math.round(c.getBoundingClientRect().left));
      const uniqueLefts = [...new Set(lefts)].sort((a, b) => a - b);
      const columnCount = uniqueLefts.length;
      if (columnCount < 2 || columnCount > 6) continue;

      // Check for varying heights (masonry indicator)
      const heights = children.map(c => Math.round(c.getBoundingClientRect().height));
      const minH = Math.min(...heights), maxH = Math.max(...heights);
      const isMasonry = (maxH - minH) > 50; // Significant height variance

      // Check if children use absolute positioning (JS masonry) or CSS columns
      const firstChildPos = getComputedStyle(children[0]).position;
      const gridDisplay = getComputedStyle(grid).display;
      const layoutMethod = firstChildPos === 'absolute' ? 'js-masonry' :
                          getComputedStyle(grid).columnCount !== 'auto' ? 'css-columns' :
                          gridDisplay === 'grid' ? 'css-grid' : 'unknown';

      if (isMasonry || layoutMethod === 'js-masonry') {
        // Detect column widths
        const colWidths = uniqueLefts.map((left, i) => {
          const nextLeft = uniqueLefts[i + 1];
          const colChildren = children.filter(c => Math.round(c.getBoundingClientRect().left) === left);
          return colChildren[0] ? Math.round(colChildren[0].getBoundingClientRect().width) : null;
        }).filter(Boolean);
        const hasVaryingWidths = colWidths.length > 1 && (Math.max(...colWidths) - Math.min(...colWidths)) > 50;

        return {
          columns: columnCount,
          isMasonry,
          layoutMethod,
          entryCount: children.length,
          hasVaryingWidths,
          columnWidths: colWidths,
          heightRange: { min: minH, max: maxH },
          class: grid.className?.slice(0, 50),
        };
      }
    }
    return null;
  }

  // ─── Countdown / live-text elements detection ────────────────────────────
  function detectCountdownElements() {
    const results = [];
    const textEls = document.querySelectorAll('span, p, div, time');
    for (const el of textEls) {
      const text = el.textContent?.trim();
      if (!text || text.length > 60 || text.length < 3) continue;
      // Countdown patterns: "X days until", "X hours left", timer formats
      if (/\d+\s*(days?|hours?|minutes?|seconds?)\s*(until|left|remaining|to go)/i.test(text) ||
          /\d{1,2}:\d{2}(:\d{2})?/.test(text) ||
          /countdown|timer/i.test(el.className || '')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          results.push({
            text,
            class: el.className?.slice(0, 40),
            position: r.x > window.innerWidth * 0.6 ? 'right' : r.x < window.innerWidth * 0.4 ? 'left' : 'center',
          });
        }
      }
    }
    return results.length > 0 ? results : null;
  }

  // ─── Case grid / portfolio grid pattern detection ────────────────────────
  function detectCaseGridPattern() {
    // Look for grid of project/case entries with thumbnails + titles + tags
    const grids = document.querySelectorAll(
      '[class*="CaseGrid"], [class*="case-grid"], [class*="portfolio"], [class*="Portfolio"], ' +
      '[class*="projects"], [class*="Projects"], [class*="work-grid"], [class*="WorkGrid"]'
    );
    for (const grid of grids) {
      const entries = grid.querySelectorAll('[class*="entry"], [class*="item"], [class*="card"], [class*="project"]');
      if (entries.length < 2) continue;
      // Detect grid layout
      const gridCs = getComputedStyle(grid);
      const cols = gridCs.gridTemplateColumns;
      const colCount = cols ? cols.split(/\s+/).filter(c => c !== '').length : null;
      // Analyze first entry structure
      const first = entries[0];
      const thumb = first.querySelector('img, video, [class*="thumb"], [class*="image"], [class*="media"]');
      const title = first.querySelector('h2, h3, [class*="title"], [class*="name"]');
      const tags = Array.from(first.querySelectorAll('[class*="tag"], [class*="Tag"], [class*="category"], [class*="Category"]'));
      const hasHoverVideo = !!first.querySelector('video') || first.querySelector('[class*="video"]') !== null;
      return {
        entryCount: entries.length,
        columns: colCount,
        gridDisplay: gridCs.display,
        gap: gridCs.gap || gridCs.gridGap,
        entryStructure: {
          hasThumbnail: !!thumb,
          hasTitle: !!title,
          hasTags: tags.length > 0,
          tagLabels: tags.map(t => t.textContent?.trim()).filter(Boolean).slice(0, 5),
          hasHoverVideo,
          thumbnailRadius: thumb ? getComputedStyle(thumb).borderRadius : null,
        },
      };
    }
    return null;
  }

  // ─── Navigation pattern detection ────────────────────────────────────────
  function detectNavPattern() {
    const result = {
      type: 'standard', // standard | hamburger-only | hidden | sidebar-menu
      hasHamburger: false,
      hasVisibleLinks: false,
      hasCurvedContainer: false,
      hasCountdown: false,
      logoText: null,
      visibleLinks: [],
    };
    // Check for hamburger/burger elements
    const burger = document.querySelector('[class*="burger"], [class*="Burger"], [class*="hamburger"], [class*="menu-toggle"], [class*="MenuToggle"]');
    result.hasHamburger = !!burger;
    // Check for visible nav links — include buttons for Framer/React nav patterns
    const navLinks = document.querySelectorAll(
      'nav a, nav button, header a, header button, ' +
      '[class*="nav"] a, [class*="nav"] button, ' +
      '[role="navigation"] a, [role="navigation"] button'
    );
    const visibleLinks = Array.from(navLinks).filter(a => {
      const r = a.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const text = (a.textContent || '').trim();
      if (text.length < 2 || text.length >= 30) return false;
      // Skip CTAs (colored background = nav button, not nav link)
      const cs = window.getComputedStyle(a);
      if (!isTransparent(cs.backgroundColor)) {
        const bgHex = rgbToHex(cs.backgroundColor);
        if (bgHex && bgHex.length >= 6) {
          const rC = parseInt(bgHex.slice(1,3),16), gC = parseInt(bgHex.slice(3,5),16), bC = parseInt(bgHex.slice(5,7),16);
          const lum = (rC*0.299 + gC*0.587 + bC*0.114) / 255;
          if (lum < 0.85) return false; // colored bg = CTA button, skip
        }
      }
      return true;
    });
    // Dedupe nav link labels
    const _seenNavLabels = new Set();
    const _dedupedNavLinks = visibleLinks.filter(a => {
      const t = (a.textContent || '').trim();
      if (_seenNavLabels.has(t)) return false;
      _seenNavLabels.add(t);
      return true;
    });
    result.hasVisibleLinks = _dedupedNavLinks.length > 1;
    result.visibleLinks = _dedupedNavLinks.map(a => (a.textContent || '').trim()).slice(0, 8);
    // Logo
    const logo = document.querySelector('[class*="logo"], [class*="Logo"], header a:first-child');
    if (logo) {
      result.logoText = logo.textContent?.trim()?.slice(0, 40) || logo.querySelector('img')?.alt?.slice(0, 40);
    }
    // Determine type
    if (result.hasHamburger && !result.hasVisibleLinks) {
      result.type = 'hamburger-only';
    } else if (result.hasHamburger && result.hasVisibleLinks) {
      result.type = 'standard-with-hamburger';
    }
    return result;
  }

  // ─── Button style extraction ──────────────────────────────────────────────
  function extractButtonStyles() {
    const result = { primary: null, ghost: null, secondary: null, navCta: null, textOnly: null };
    const btns = document.querySelectorAll(
      'button, a[class*="btn"], a[class*="button"], a[class*="cta"], a[class*="action"], a[class*="primary"], [role="button"], input[type="submit"], a[href][class]'
    );
    // Dedupe and filter to reasonable set
    const seen = new Set();
    const uniqueBtns = [];
    for (const btn of btns) {
      if (seen.has(btn)) continue;
      seen.add(btn);
      uniqueBtns.push(btn);
      if (uniqueBtns.length >= 25) break;
    }
    const candidates = [];
    for (const btn of uniqueBtns) {
      try {
        const rect = btn.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 20 || rect.width > 600) continue;
        // Skip plain text links — only keep elements that look like buttons
        const cs = window.getComputedStyle(btn);
        if (btn.tagName === 'A' && !btn.matches('button, [role="button"]')) {
          const hasBg = !isTransparent(cs.backgroundColor);
          const hasBorder = cs.borderWidth !== '0px' && cs.borderStyle !== 'none';
          const hasPadding = parseInt(cs.paddingLeft) >= 8 && parseInt(cs.paddingTop) >= 4;
          const hasRadius = cs.borderRadius !== '0px';
          // An <a> tag must have at least bg OR (border+padding) to be considered a button
          if (!hasBg && !(hasBorder && hasPadding) && !(hasPadding && hasRadius)) continue;
        }
        const bg = cs.backgroundColor;
        let bgHex = !isTransparent(bg) ? rgbToHex(bg) : null;
        // Fallback: resolve button background when backgroundColor is transparent
        // Common on Tailwind/Next.js sites using CSS variable gradients like:
        //   background-image: radial-gradient(var(--button-primary-bg-from), var(--button-primary-bg-to))
        if (!bgHex) {
          // Strategy 1: read CSS variable values directly from the button element
          // (variables cascade from :root through the button, so getPropertyValue resolves them)
          const _bgVarNames = ['--button-primary-bg-from', '--button-primary-bg', '--button-bg', '--bg'];
          for (const varName of _bgVarNames) {
            let val = cs.getPropertyValue(varName).trim();
            if (!val || val === 'transparent' || val === 'none') continue;
            // Follow var() reference chains: --button-primary-bg-from: var(--color-black-200)
            let depth = 0;
            while (val.startsWith('var(') && depth < 5) {
              const inner = val.match(/var\(\s*(--[^,)]+)/);
              if (!inner) break;
              val = cs.getPropertyValue(inner[1]).trim();
              depth++;
            }
            if (!val || val === 'transparent' || val === 'none' || val.startsWith('var(')) continue;
            const _parsed = cssColorToRgb(val);
            if (_parsed && (_parsed.r + _parsed.g + _parsed.b < 700)) {
              bgHex = '#' + [_parsed.r, _parsed.g, _parsed.b].map(c => c.toString(16).padStart(2,'0')).join('');
              break;
            }
          }
          // Strategy 2: extract color functions from gradient stops
          if (!bgHex && cs.backgroundImage && cs.backgroundImage !== 'none' && cs.backgroundImage.includes('gradient')) {
            const _colorFuncs = cs.backgroundImage.match(/#[0-9a-fA-F]{3,8}|(?:rgb|rgba|oklch|color-mix|hsl|hsla|lab|lch)\([^)]*(?:\([^)]*\))*[^)]*\)/gi);
            if (_colorFuncs) {
              for (const cf of _colorFuncs) {
                const _parsed = cf.startsWith('#') ? { r: parseInt(cf.slice(1,3),16), g: parseInt(cf.slice(3,5),16), b: parseInt(cf.slice(5,7),16) } : cssColorToRgb(cf);
                if (_parsed) {
                  bgHex = '#' + [_parsed.r, _parsed.g, _parsed.b].map(c => c.toString(16).padStart(2,'0')).join('');
                  break;
                }
              }
            }
          }
        }
        const colorHex = rgbToHex(cs.color);
        const bgSat = bgHex ? colorSaturation(bgHex) : 0;
        const bgLum = bgHex ? (parseInt(bgHex.slice(1,3),16)*0.299+parseInt(bgHex.slice(3,5),16)*0.587+parseInt(bgHex.slice(5,7),16)*0.114)/255 : 1;
        const cls = (btn.className || '').toString();
        const isNavCta = !!btn.closest('nav, header, [class*="nav"], [class*="header"], [role="navigation"]');
        const isAboveFold = rect.top < window.innerHeight * 0.6 && rect.bottom > 0;

        // Reconstruct accurate padding shorthand from individual sides
        // cs.padding can collapse to '8px' when sides differ (e.g. padding-inline set separately)
        const _pt = cs.paddingTop, _pr = cs.paddingRight, _pb = cs.paddingBottom, _pl = cs.paddingLeft;
        let paddingValue;
        if (_pt === _pb && _pr === _pl && _pt === _pr) paddingValue = _pt;
        else if (_pt === _pb && _pr === _pl) paddingValue = `${_pt} ${_pr}`;
        else if (_pr === _pl) paddingValue = `${_pt} ${_pr} ${_pb}`;
        else paddingValue = `${_pt} ${_pr} ${_pb} ${_pl}`;

        const data = {
          padding: paddingValue,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          letterSpacing: cs.letterSpacing !== 'normal' ? cs.letterSpacing : null,
          textTransform: cs.textTransform !== 'none' ? cs.textTransform : null,
          backgroundColor: bgHex,
          color: colorHex,
          borderRadius: cs.borderRadius !== '0px' ? cs.borderRadius : null,
          border: cs.border !== 'none' && cs.borderWidth !== '0px' ? cs.border : null,
          boxShadow: cs.boxShadow !== 'none' ? cs.boxShadow : null,
          gap: cs.gap !== 'normal' ? cs.gap : null,
          height: cs.height !== 'auto' ? cs.height : `${Math.round(rect.height)}px`,
          lineHeight: cs.lineHeight,
          fontFamily: cleanFont(cs.fontFamily) || null,
          clipPath: cs.clipPath !== 'none' ? cs.clipPath : null,
          transition: (cs.transition && cs.transition !== 'all 0s ease 0s' && cs.transition !== 'none 0s ease 0s' && cs.transition !== 'all' && cs.transition !== 'none') ? cs.transition : null,
          isNavCta, isAboveFold, cls, bgSat, bgLum,
          width: Math.round(rect.width),
          text: btn.innerText?.trim().slice(0, 30) || '',
        };

        // Check for pseudo-element border simulation (used with clip-path)
        if (data.clipPath) {
          try {
            const before = window.getComputedStyle(btn, '::before');
            if (before.content !== 'none' && before.position === 'absolute') {
              data.pseudoBorder = {
                clipPath: before.clipPath !== 'none' ? before.clipPath?.slice(0, 120) : null,
                bg: !isTransparent(before.backgroundColor) ? rgbToHex(before.backgroundColor) : null,
              };
            }
          } catch(e) { console.debug('[VibeDesign]', e.message); }
        }

        candidates.push(data);
      } catch(e) { console.debug('[VibeDesign]', e.message); }
    }

    // Score-based classification
    candidates.forEach(c => {
      let score = 0;
      // Has a visible background color = likely a filled button
      if (c.backgroundColor) score += 2;
      // High contrast bg (very dark or very saturated) = strong CTA signal
      // Dark buttons (#1c1d1f, #000) are common primaries — don't penalize low saturation
      if (c.backgroundColor && c.bgLum < 0.15) score += 3; // dark bg = strong primary signal
      else if (c.bgSat > 30) score += 2; // saturated bg = moderate signal
      // Even low-saturation colored bg counts (e.g. dark blue #0000ee)
      if (c.backgroundColor && c.bgSat > 10 && c.bgLum < 0.8) score += 1;
      // Class name hints
      if (/primary|cta|main|action|hero/i.test(c.cls)) score += 5;
      if (/red|blue|accent|brand|start|signup|register|get[-_]?started/i.test(c.cls) && !/outline|ghost/i.test(c.cls)) score += 4;
      // Bold weight = more prominent
      if (c.fontWeight && parseInt(c.fontWeight) >= 700) score += 1;
      // Bigger buttons = more prominent (hero CTAs are usually larger)
      if (c.width > 140) score += 1;
      if (parseInt(c.height) > 44) score += 1;
      // Pill-shaped = prominent hero CTA (360px, 1000px, 9999px radius)
      if (c.borderRadius && parseInt(c.borderRadius) >= 100) score += 2;
      // Text hints — CTA text patterns
      if (/get started|start|sign up|try|begin|join|subscribe/i.test(c.text)) score += 3;
      // Ghost indicators
      if (/ghost|outline|secondary|subtle|text/i.test(c.cls)) score -= 5;
      if (!c.backgroundColor && c.border) score -= 3;
      // Nav buttons hard-demoted — nav "Sign up" must not beat a real hero CTA
      if (c.isNavCta) score -= 25;
      // Hero CTA signal: above-fold, non-nav, substantial width
      if (!c.isNavCta && c.isAboveFold && c.width > 110) score += 3;
      c._score = score;
    });

    // Primary = highest score, preferring non-nav candidates when any viable one exists
    const sorted = [...candidates].sort((a, b) => b._score - a._score);
    const nonNavViable = sorted.filter(c => !c.isNavCta && c._score > 0);
    if (nonNavViable.length > 0) {
      result.primary = nonNavViable[0];
    } else if (sorted.length > 0 && sorted[0]._score > 0) {
      result.primary = sorted[0];
    } else {
      // Fallback: highest saturation, still preferring non-nav
      const withBg = candidates.filter(c => c.backgroundColor && c.bgSat > 10);
      if (withBg.length) {
        withBg.sort((a, b) => (a.isNavCta - b.isNavCta) || (b.bgSat - a.bgSat));
        result.primary = withBg[0];
      }
    }

    // Ghost = transparent bg with border, or class hint
    const ghosts = candidates.filter(c =>
      (!c.backgroundColor && c.border) || /ghost|outline/i.test(c.cls)
    );
    if (ghosts.length) result.ghost = ghosts[0];

    // Secondary = any remaining button that's not primary or ghost
    const muted = candidates.filter(c =>
      c !== result.primary && c !== result.ghost && c.backgroundColor
    );
    if (muted.length) result.secondary = muted[0];

    // Nav CTA = nav/header button, separate from hero primary
    const navBtns = candidates.filter(c => c.isNavCta && c.backgroundColor);
    if (navBtns.length) {
      // Pick the most prominent nav button
      navBtns.sort((a, b) => b._score - a._score);
      result.navCta = navBtns[0];
    }

    // Text-only CTA detection (no bg, no border, bold text + optional arrow)
    if (!result.textOnly) {
      const textCTAEls = document.querySelectorAll(
        'a:not([class*="btn"]):not([class*="button"]), ' +
        '[class*="cta"]:not([class*="btn"]), ' +
        '[class*="link-cta"], [class*="text-cta"]'
      );
      for (const el of Array.from(textCTAEls).slice(0, 10)) {
        try {
          const cs = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          if (isTransparent(cs.backgroundColor) && (cs.borderStyle === 'none' || cs.borderWidth === '0px') &&
              parseInt(cs.fontWeight) >= 600 && rect.width > 60 && rect.width < 300 && rect.height > 0) {
            const text = el.textContent?.trim().slice(0, 30);
            if (!text || text.length < 3) continue;
            const hasArrow = text.includes('→') || text.includes('↗') || !!el.querySelector('svg');
            result.textOnly = {
              fontSize: cs.fontSize, fontWeight: cs.fontWeight, color: cs.color,
              hasArrow, textTransform: cs.textTransform, sample: text,
            };
            break;
          }
        } catch(e) { console.debug('[VibeDesign]', e.message); }
      }
    }

    // Cleanup internal fields
    for (const key of ['primary', 'ghost', 'secondary', 'navCta']) {
      if (result[key]) {
        delete result[key].bgSat;
        delete result[key].bgLum;
        delete result[key]._score;
        delete result[key].cls;
        delete result[key].isNavCta;
        delete result[key].isAboveFold;
      }
    }
    return result;
  }

  // ─── Typography pattern extraction ──────────────────────────────────────────
  function extractTypographyPatterns() {
    const patterns = {};
    const levels = [
      { key: 'h1', selector: 'h1' },
      { key: 'h2', selector: 'h2' },
      { key: 'h3', selector: 'h3' },
      { key: 'h4', selector: 'h4' },
      { key: 'body', selector: 'p' },
    ];

    for (const { key, selector } of levels) {
      const els = document.querySelectorAll(selector);
      // For h2/h3: pick the DOMINANT instance (largest font-size outside nav/footer/header)
      // For h1/body: first visible match is sufficient
      if (key === 'h2' || key === 'h3' || key === 'h4') {
        const h1Size = parseFloat(patterns.h1?.fontSize) || 0;
        let best = null, bestSize = 0;
        for (const el of Array.from(els).slice(0, 40)) {
          try {
            // Skip elements inside nav, header, footer — those use small utility headings
            if (el.closest('nav, header, footer, [class*="nav"], [class*="header"], [class*="footer"]')) continue;
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) continue;
            if (!el.innerText || el.innerText.trim().length < 4) continue;
            const cs = window.getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            const size = parseFloat(cs.fontSize) || 0;
            // Fix 3: skip if same size as H1 (within 2px) — H2 should have distinct scale
            if (key === 'h2' && h1Size > 0 && Math.abs(size - h1Size) < 2) continue;
            if (size > bestSize) { bestSize = size; best = { el, cs }; }
          } catch(e) { console.debug('[VibeDesign]', e.message); }
        }
        if (best) {
          patterns[key] = {
            fontSize: best.cs.fontSize,
            fontWeight: best.cs.fontWeight,
            lineHeight: best.cs.lineHeight,
            letterSpacing: best.cs.letterSpacing !== 'normal' ? best.cs.letterSpacing : null,
            textTransform: best.cs.textTransform !== 'none' ? best.cs.textTransform : null,
            fontFamily: cleanFont(best.cs.fontFamily),
            color: best.cs.color && !isTransparent(best.cs.color) ? rgbToHex(best.cs.color) : null,
            textShadow: best.cs.textShadow !== 'none' ? best.cs.textShadow : null,
          };
        } else if (key === 'h2' && patterns.h1 && h1Size > 0) {
          // Fix 3 fallback: no distinct H2 found — estimate at 65% of H1 size
          const estSize = Math.round(h1Size * 0.65);
          patterns[key] = { ...patterns.h1, fontSize: estSize + 'px', _estimated: true };
        }
        continue;
      }
      // Fix 2: body — use mode (most common font-size) instead of first visible <p>
      if (key === 'body') {
        const bodyEls = Array.from(document.querySelectorAll('p, [class*="body-text"], [class*="text-reg"], [class*="text-book"]'))
          .filter(el => {
            try {
              if (el.closest('nav, header, footer, [class*="nav"], [class*="footer"], [class*="caption"], [class*="cookie"]')) return false;
              const rect = el.getBoundingClientRect();
              return rect.width > 80 && rect.height > 0 && el.innerText?.trim().length > 10;
            } catch(e) { return false; }
          })
          .slice(0, 30);
        // Build frequency map — skip very small text (< 12px, likely fine print)
        const sizeFreq = {};
        for (const el of bodyEls) {
          try {
            const fs = parseFloat(window.getComputedStyle(el).fontSize) || 0;
            if (fs >= 12) sizeFreq[fs] = (sizeFreq[fs] || 0) + 1;
          } catch(e) { console.debug('[VibeDesign]', e.message); }
        }
        const modeEntry = Object.entries(sizeFreq).sort((a,b) => b[1] - a[1])[0];
        if (modeEntry) {
          const modeSize = parseFloat(modeEntry[0]);
          const modeEl = bodyEls.find(el => {
            try { return Math.abs(parseFloat(window.getComputedStyle(el).fontSize) - modeSize) < 0.5; } catch(e) { return false; }
          });
          if (modeEl) {
            try {
              const cs = window.getComputedStyle(modeEl);
              patterns[key] = {
                fontSize: cs.fontSize,
                fontWeight: cs.fontWeight,
                lineHeight: cs.lineHeight,
                letterSpacing: cs.letterSpacing !== 'normal' ? cs.letterSpacing : null,
                textTransform: cs.textTransform !== 'none' ? cs.textTransform : null,
                fontFamily: cleanFont(cs.fontFamily),
                color: cs.color && !isTransparent(cs.color) ? rgbToHex(cs.color) : null,
              };
            } catch(e) { console.debug('[VibeDesign]', e.message); }
          }
        }
        continue;
      }
      for (const el of els) {
        try {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          if (!el.innerText || el.innerText.trim().length < 2) continue;
          const cs = window.getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          patterns[key] = {
            fontSize: cs.fontSize,
            fontWeight: cs.fontWeight,
            lineHeight: cs.lineHeight,
            letterSpacing: cs.letterSpacing !== 'normal' ? cs.letterSpacing : null,
            textTransform: cs.textTransform !== 'none' ? cs.textTransform : null,
            fontFamily: cleanFont(cs.fontFamily),
            color: cs.color && !isTransparent(cs.color) ? rgbToHex(cs.color) : null,
            textShadow: cs.textShadow !== 'none' ? cs.textShadow : null,
          };
          break;
        } catch(e) { console.debug('[VibeDesign]', e.message); }
      }
    }

    // Detect uppercase labels (small uppercase text elements)
    const allSmall = document.querySelectorAll('span, div, p, label');
    for (const el of Array.from(allSmall).slice(0, 100)) {
      try {
        const cs = window.getComputedStyle(el);
        if (cs.textTransform === 'uppercase' && parseInt(cs.fontSize) <= 14) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && el.innerText?.trim().length > 1) {
            patterns.label = {
              fontSize: cs.fontSize,
              fontWeight: cs.fontWeight,
              lineHeight: cs.lineHeight,
              letterSpacing: cs.letterSpacing !== 'normal' ? cs.letterSpacing : null,
              textTransform: 'uppercase',
              fontFamily: cleanFont(cs.fontFamily),
            };
            break;
          }
        }
      } catch(e) { console.debug('[VibeDesign]', e.message); }
    }

    // Detect caption text (small text elements like figcaption, .caption) —
    // skip nav/footer to avoid utility labels leaking into the caption token
    const captionEls = document.querySelectorAll('figcaption, [class*="caption"], [class*="subtitle"], [class*="meta"], small, .text-sm, .text-xs');
    for (const el of Array.from(captionEls).slice(0, 30)) {
      try {
        if (el.closest('nav, header, footer, [class*="nav"], [class*="footer"], [class*="cookie"]')) continue;
        const cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const fs = parseFloat(cs.fontSize) || 0;
        if (fs > 0 && fs <= 14) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && el.innerText?.trim().length > 2) {
            patterns.caption = {
              fontSize: cs.fontSize,
              fontWeight: cs.fontWeight,
              lineHeight: cs.lineHeight,
              letterSpacing: cs.letterSpacing !== 'normal' ? cs.letterSpacing : null,
              textTransform: cs.textTransform !== 'none' ? cs.textTransform : null,
              fontFamily: cleanFont(cs.fontFamily),
              color: cs.color && !isTransparent(cs.color) ? rgbToHex(cs.color) : null,
            };
            break;
          }
        }
      } catch(e) { console.debug('[VibeDesign]', e.message); }
    }

    // Detect code/monospace text — skip nav/footer, require real content
    const codeEls = document.querySelectorAll('code, pre, [class*="code"], [class*="mono"], kbd, samp');
    for (const el of Array.from(codeEls).slice(0, 20)) {
      try {
        if (el.closest('nav, header, footer, [class*="nav"], [class*="footer"]')) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        if (!el.innerText || el.innerText.trim().length < 2) continue;
        const cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        // Require actual monospace family — filters false positives from utility classes like "code-tag"
        const fam = (cs.fontFamily || '').toLowerCase();
        if (!/mono|courier|consolas|menlo|monaco|source-code|fira|jetbrains|ubuntu mono/.test(fam)) continue;
        patterns.code = {
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          lineHeight: cs.lineHeight,
          fontFamily: cleanFont(cs.fontFamily),
          backgroundColor: cs.backgroundColor && !isTransparent(cs.backgroundColor) ? rgbToHex(cs.backgroundColor) : null,
          borderRadius: cs.borderRadius !== '0px' ? cs.borderRadius : null,
        };
        break;
      } catch(e) { console.debug('[VibeDesign]', e.message); }
    }

    return patterns;
  }

  // ─── Visual type classification ───────────────────────────────────────────
  function classifyVisuals() {
    const result = { heroVisual: null, sectionVisuals: [] };
    const heroEl = document.querySelector('[class*="hero"], [class*="Hero"], main > section:first-child, section:first-of-type');

    function classifyImage(el) {
      const cs = window.getComputedStyle(el);
      const parentCs = el.parentElement ? window.getComputedStyle(el.parentElement) : null;
      const src = (el.src || el.currentSrc || '').toLowerCase();
      const tag = el.tagName.toLowerCase();
      const rect = el.getBoundingClientRect();
      const aspectRatio = rect.width > 0 ? (rect.width / rect.height).toFixed(2) : '1.00';

      let type = 'photo', subtype = 'generic';

      // SVG detection
      if (tag === 'svg' || src.endsWith('.svg')) {
        type = 'illustration';
        const paths = tag === 'svg' ? el.querySelectorAll('path, circle, rect, line, polygon').length : 0;
        subtype = paths > 20 ? 'detailed-vector' : paths > 5 ? 'icon-illustration' : 'simple-icon';
      }
      // URL-based hints
      else if (/unsplash|pexels|shutterstock|gettyimages|stock/.test(src)) {
        type = 'photo'; subtype = 'stock-photography';
      } else if (/undraw|storyset|humaaans|blush|illustrations/.test(src)) {
        type = 'illustration'; subtype = 'flat-vector';
      }
      // Size-based classification
      else if (rect.width > 600 && rect.height > 400) {
        subtype = 'hero-photo';
      } else if (rect.width < 200 && rect.height < 200) {
        type = 'icon'; subtype = 'small-visual';
      }

      // Filter/treatment detection
      const filter = cs.filter !== 'none' ? cs.filter : null;
      const blendMode = parentCs?.mixBlendMode !== 'normal' ? parentCs?.mixBlendMode : null;
      let treatment = 'raw';
      if (filter) {
        if (/grayscale/.test(filter)) treatment = 'grayscale';
        else if (/brightness.*saturate|saturate.*brightness/.test(filter)) treatment = 'color-adjusted';
        else if (/blur/.test(filter)) treatment = 'blurred-bg';
        else treatment = 'filtered';
      }
      if (parentCs?.clipPath && parentCs.clipPath !== 'none') treatment = 'clipped';
      if (parentCs?.maskImage && parentCs.maskImage !== 'none') treatment = 'masked';

      return {
        type, subtype, treatment,
        filters: filter,
        blendMode: blendMode || 'none',
        aspectRatio,
        objectFit: cs.objectFit !== 'fill' ? cs.objectFit : null,
      };
    }

    // Classify hero visual
    if (heroEl) {
      // Dropped [class*="logo"] exclusion — hero-logo-mark / brand-logo-hero are
      // legitimate hero visuals on wordmark sites. Center-of-viewport check below
      // in the size gate filters out off-center corner logos.
      const heroImg = heroEl.querySelector('img:not([class*="avatar"]):not([width="1"])');
      const heroVideo = heroEl.querySelector('video[autoplay], video[data-autoplay]');
      const heroCanvas = heroEl.querySelector('canvas');
      const heroSvg = heroEl.querySelector('svg:not([class*="icon"])');

      if (heroVideo) {
        result.heroVisual = { type: 'video', subtype: 'background-video', treatment: 'autoplay', blendMode: 'none', aspectRatio: '16:9' };
      } else if (heroCanvas) {
        result.heroVisual = { type: '3d', subtype: 'canvas-webgl', treatment: 'interactive', blendMode: 'none', aspectRatio: '16:9' };
      } else if (heroSvg) {
        try { result.heroVisual = classifyImage(heroSvg); } catch(e) { console.debug('[VibeDesign]', e.message); }
      } else if (heroImg) {
        try {
          const rect = heroImg.getBoundingClientRect();
          const vwCenter = window.innerWidth / 2;
          const overlapsCenter = rect.left < vwCenter && rect.right > vwCenter;
          if (rect.width > 100 && rect.height > 100 && overlapsCenter) result.heroVisual = classifyImage(heroImg);
        } catch(e) { console.debug('[VibeDesign]', e.message); }
      } else {
        // Check for background gradient/pattern as hero visual
        try {
          const heroBg = window.getComputedStyle(heroEl).backgroundImage;
          if (heroBg && heroBg !== 'none' && !heroBg.startsWith('url(')) {
            result.heroVisual = { type: 'abstract', subtype: 'gradient-bg', treatment: 'css-generated', blendMode: 'none', aspectRatio: 'full-width' };
          }
        } catch(e) { console.debug('[VibeDesign]', e.message); }
      }
    }

    return result;
  }

  // ─── Card style extraction ────────────────────────────────────────────────
  function extractCardStyles() {
    const cardEls = document.querySelectorAll(
      '[class*="card"], [class*="Card"], article, [class*="feature"], [class*="pricing"], [class*="plan"], [class*="item"]:not(li):not(nav *)'
    );
    let bestCard = null, bestScore = 0;

    for (const el of Array.from(cardEls).slice(0, 30)) {
      try {
        const rect = el.getBoundingClientRect();
        if (rect.width < 100 || rect.height < 80) continue;
        const cs = window.getComputedStyle(el);
        // Score: prefer elements that look like cards (have bg, padding, radius)
        let score = 0;
        if (cs.backgroundColor && !isTransparent(cs.backgroundColor)) score += 2;
        if (cs.borderRadius && cs.borderRadius !== '0px') score += 2;
        if (cs.boxShadow && cs.boxShadow !== 'none') score += 3;
        if (cs.border && cs.border !== 'none' && !cs.border.includes('0px')) score += 1;
        if (parseFloat(cs.padding) > 8) score += 1;
        if (score > bestScore) {
          bestScore = score;
          bestCard = { el, cs, rect };
        }
      } catch(e) { console.debug('[VibeDesign]', e.message); }
    }

    if (!bestCard || bestScore < 3) return null;

    const { cs, el } = bestCard;
    const result = {
      padding: cs.padding,
      borderRadius: cs.borderRadius,
      backgroundColor: cs.backgroundColor && !isTransparent(cs.backgroundColor) ? rgbToHex(cs.backgroundColor) : null,
      border: cs.border && !cs.border.includes('0px') ? cs.border : null,
      boxShadow: cs.boxShadow !== 'none' ? cs.boxShadow : null,
      shadowType: 'none',
      gap: cs.gap !== 'normal' ? cs.gap : null,
      hoverEffect: null,
    };

    // Classify shadow type
    if (result.boxShadow) {
      const s = result.boxShadow;
      if (s.includes('inset')) result.shadowType = 'inset';
      else if (s.split(',').length > 2) result.shadowType = 'layered';
      else if (/0px 0px \d+px/.test(s) || /0 0 \d+px/.test(s)) result.shadowType = 'glow';
      else result.shadowType = 'drop';
    }

    // Check for hover effect via CSS rules
    const className = el.className?.split?.(' ')[0];
    if (className) {
      const hoverState = (data => data.hoverStates || [])({ hoverStates: [] });
      // We can't easily get hover styles here, so mark as 'check-hover-states'
      result.hoverEffect = 'see hover states section';
    }

    return result;
  }

  // ─── CSS filter effects extraction ────────────────────────────────────────
  function extractFilterEffects() {
    const effects = { images: [], sections: [], summary: '' };
    const summaryParts = [];

    // Check images for filters
    const imgs = document.querySelectorAll('img');
    for (const img of Array.from(imgs).slice(0, 20)) {
      try {
        const cs = window.getComputedStyle(img);
        const rect = img.getBoundingClientRect();
        if (rect.width < 50 || rect.height < 50) continue;
        if (cs.filter && cs.filter !== 'none') {
          effects.images.push({ filter: cs.filter, context: 'image' });
          if (!summaryParts.includes('image-filters')) summaryParts.push('image-filters');
        }
      } catch(e) { console.debug('[VibeDesign]', e.message); }
    }

    // Check sections for backdrop-filter (glassmorphism) and mix-blend-mode
    const sections = document.querySelectorAll('section, [class*="section"], [class*="hero"], [class*="card"], [class*="overlay"]');
    for (const sec of Array.from(sections).slice(0, 20)) {
      try {
        const cs = window.getComputedStyle(sec);
        if (cs.backdropFilter && cs.backdropFilter !== 'none') {
          effects.sections.push({ backdropFilter: cs.backdropFilter, context: 'section-glassmorphism' });
          if (!summaryParts.includes('glassmorphism')) summaryParts.push('glassmorphism');
        }
        if (cs.mixBlendMode && cs.mixBlendMode !== 'normal') {
          effects.sections.push({ blendMode: cs.mixBlendMode, context: 'blend-effect' });
          if (!summaryParts.includes('blend-modes')) summaryParts.push('blend-modes');
        }
      } catch(e) { console.debug('[VibeDesign]', e.message); }
    }

    effects.summary = summaryParts.length > 0 ? summaryParts.join(', ') : 'none detected';
    return effects.images.length > 0 || effects.sections.length > 0 ? effects : null;
  }

  // ─── Shadow system decomposition ──────────────────────────────────────────
  function analyzeShadowSystem(shadows) {
    if (!shadows || shadows.length === 0) return null;
    let maxDepth = 0;
    let style = 'standard';
    const hasInset = shadows.some(s => s.includes('inset'));
    const hasGlow = shadows.some(s => /0px 0px \d+px/.test(s) || /0 0 \d+px/.test(s));
    const hasLayered = shadows.some(s => s.split(',').length > 2);
    const hasBrutalist = shadows.some(s => {
      const m = s.match(/(-?\d+)px\s+(-?\d+)px\s+(\d+)px/);
      return m && parseInt(m[3]) === 0 && (parseInt(m[1]) >= 3 || parseInt(m[2]) >= 3);
    });

    maxDepth = Math.max(...shadows.map(s => s.split(',').length));
    if (hasBrutalist) style = 'brutalist';
    else if (hasGlow) style = 'glow-based';
    else if (hasLayered) style = 'layered-elevation';
    else if (hasInset) style = 'inset-defined';
    else style = 'drop-shadow';

    return { style, maxDepth, hasInset, hasGlow, hasLayered, hasBrutalist };
  }

  // ─── Badge/tag style extraction ─────────────────────────────────────────────
  function extractBadgeStyles() {
    const badges = document.querySelectorAll(
      '[class*="badge"], [class*="tag"], [class*="chip"], [class*="label"], [class*="pill"]'
    );
    for (const el of Array.from(badges).slice(0, 10)) {
      try {
        const rect = el.getBoundingClientRect();
        // Badges are small elements
        if (rect.width < 20 || rect.width > 300 || rect.height < 16 || rect.height > 60) continue;
        if (!el.innerText || el.innerText.trim().length < 1) continue;
        const cs = window.getComputedStyle(el);
        const bg = cs.backgroundColor;
        if (isTransparent(bg)) continue;
        return {
          backgroundColor: rgbToHex(bg),
          color: rgbToHex(cs.color),
          borderRadius: cs.borderRadius,
          padding: cs.padding,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          border: cs.borderWidth !== '0px' ? cs.border : null,
        };
      } catch(e) { console.debug('[VibeDesign]', e.message); }
    }
    return null;
  }

  // ─── Section content map ──────────────────────────────────────────────────
  // Helper: describe a container's visual style (glow, shadow, border, gradient, radius)
  function describeContainerStyle(cs) {
    if (!cs) return null;
    const parts = [];
    // Border with color
    if (cs.borderWidth !== '0px' && cs.borderStyle !== 'none') {
      const borderColor = rgbToHex(cs.borderColor) || cs.borderColor;
      parts.push(`border: ${cs.borderWidth} ${cs.borderStyle} ${borderColor}`);
    }
    // Border radius
    if (cs.borderRadius && cs.borderRadius !== '0px') {
      parts.push(`radius: ${cs.borderRadius}`);
    }
    // Box shadow (glow detection)
    if (cs.boxShadow && cs.boxShadow !== 'none') {
      const shadow = cs.boxShadow;
      const isGlow = /\b0px\s+0px\s+\d+px/.test(shadow) || /\b0 0 \d+px/.test(shadow);
      if (isGlow) {
        // Extract glow color
        const colorMatch = shadow.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}|oklch\([^)]+\)/i);
        parts.push(`glow: ${colorMatch ? colorMatch[0] : shadow.slice(0, 60)}`);
      } else {
        parts.push(`shadow: ${shadow.slice(0, 80)}`);
      }
    }
    // Background gradient
    if (cs.backgroundImage && cs.backgroundImage.includes('gradient')) {
      parts.push(`gradient: ${cs.backgroundImage.slice(0, 100)}`);
    }
    // Background color
    if (cs.backgroundColor && !isTransparent(cs.backgroundColor)) {
      parts.push(`bg: ${rgbToHex(cs.backgroundColor)}`);
    }
    // Backdrop filter
    if (cs.backdropFilter && cs.backdropFilter !== 'none') {
      parts.push(`backdrop: ${cs.backdropFilter}`);
    }
    // Overflow (for clipping effects)
    if (cs.overflow === 'hidden') {
      parts.push('overflow: hidden');
    }
    return parts.length > 0 ? parts.join(', ') : null;
  }

  // Helper: infer what a visual element represents from surrounding context
  function inferVisualContext(el, sectionHeading) {
    // Gather all nearby text signals
    const signals = [];

    // 1. Element's own alt, aria-label, title
    const alt = (el.getAttribute('alt') || '').trim();
    const ariaLabel = (el.getAttribute('aria-label') || '').trim();
    const title = (el.getAttribute('title') || '').trim();
    if (alt) signals.push(alt);
    if (ariaLabel) signals.push(ariaLabel);
    if (title) signals.push(title);

    // 2. Parent container's aria-label or data attributes
    const parent = el.closest('[aria-label],[data-label],[data-title],[data-description]');
    if (parent) {
      const pl = parent.getAttribute('aria-label') || parent.getAttribute('data-label') || parent.getAttribute('data-title') || '';
      if (pl.trim()) signals.push(pl.trim());
    }

    // 3. Nearby text labels within the same container (siblings/close children)
    const container = el.closest('div[class],figure,section') || el.parentElement;
    if (container) {
      // Find text labels near the visual (figcaption, small text, stat numbers)
      const nearbyTexts = [];
      container.querySelectorAll('figcaption, [class*="label"], [class*="caption"], [class*="stat"], [class*="metric"], span, p, h3, h4, dt, dd').forEach(t => {
        const text = (t.innerText || '').trim();
        if (text.length > 1 && text.length < 60 && !t.contains(el)) nearbyTexts.push(text);
      });
      if (nearbyTexts.length > 0) signals.push(...nearbyTexts.slice(0, 5));
    }

    // 4. Section heading as context
    if (sectionHeading) signals.push(sectionHeading);

    const allText = signals.join(' ').toLowerCase();

    // Pattern matching to infer visual type — ORDER MATTERS: specific first, generic last
    if (/globe|world|map|region|geographic|location/i.test(allText))
      return 'interactive globe/world map visualization showing geographic distribution of infrastructure nodes';
    if (/uptime|latency.*global|region.*global|edge.*location|globally/i.test(allText))
      return 'interactive globe/world map with infrastructure metrics — recreate as a dot-pattern world map with region markers and stat labels';
    if (/architecture|flow|pipeline|stack|framework|sdk|webrtc|agent.*server|media.*server/i.test(allText))
      return '3D isometric architecture/infrastructure diagram showing system components and data flow connections';
    if (/orb|sphere|voice|audio|wave|sound|frequency|visuali[sz]/i.test(allText))
      return 'animated 3D orb/sphere visualization representing voice/audio processing — color-shifting, organic motion';
    if (/security|compliance|gdpr|soc|hipaa|encrypt/i.test(allText))
      return 'security/compliance certification badges and metrics';
    if (/network|infrastructure|cloud|edge|node|cluster|scale/i.test(allText))
      return 'network/infrastructure topology visualization';
    if (/chart|graph|metric|analytic|dashboard/i.test(allText))
      return 'data visualization / metrics dashboard';
    if (/code|editor|terminal|console|snippet|syntax/i.test(allText))
      return 'code editor interface with syntax highlighting';
    if (/phone|mobile|device|app|chat|conversation|message/i.test(allText))
      return 'mobile device mockup showing app/chat interface';
    if (/pricing|plan|tier|month|year|free|pro/i.test(allText) && !/infrastructure|enterprise.*grade/i.test(allText))
      return 'pricing comparison cards/table';
    if (/testimonial|quote|review|customer.*said|tweet/i.test(allText))
      return 'customer testimonial/quote card';
    if (/logo|partner|company|brand|trust/i.test(allText))
      return 'company logo grid or scrolling marquee';
    if (/\btoken[s]?\b|design.?system|figma.?plugin|token.*studio|design.*variable|variable.*panel|design.*handoff|sync.*(?:figma|token)|style.*guide.*(?:token|variable)/i.test(allText))
      return 'design-system / token management interface — panel showing design token groups (colors, spacing, typography) with variable names and values';
    if (/step|process|workflow|how.*work/i.test(allText))
      return 'step-by-step process illustration showing workflow stages';

    // If nearby text has stat-like numbers, it's likely a data display
    if (/\d+[%+]|\d+ms|\d+k|\d+\.\d+%/i.test(allText))
      return 'metrics/statistics visualization with data indicators: ' + signals.filter(s => /\d/.test(s)).slice(0, 3).join(', ');

    // Fallback: return nearby text as context hint
    if (signals.length > 0 && signals[0].length > 3)
      return 'visual related to: "' + signals.slice(0, 2).join('" / "') + '"';

    return null;
  }

  // Helper: detect code blocks within a section
  function extractCodeBlocks(sec) {
    const codeBlocks = [];
    // Only select actual code elements — <pre>, <code>, or explicit code-block classes
    sec.querySelectorAll('pre:has(code), pre[class*="code"], pre[class*="language"], code[class*="language"], [class*="code-block"], [class*="highlight"][class*="code"], [class*="prism"], [class*="shiki"], [class*="hljs"]').forEach(pre => {
      const r = pre.getBoundingClientRect();
      if (r.width < 200 || r.height < 50) return;
      const cs = window.getComputedStyle(pre);
      const text = (pre.innerText || '').trim();

      // Validate it's actually code — must have code-like patterns
      const isMonoFont = /mono|code|consolas|courier|menlo|fira/i.test(cs.fontFamily);
      const hasCodePatterns = /[{}();=]|import |const |function |class |def |from |=>|->/.test(text);
      const hasCodeChild = !!pre.querySelector('code, [class*="token"], [class*="line"]');
      if (!isMonoFont && !hasCodePatterns && !hasCodeChild) return;

      // Skip if it looks like a testimonial/tweet (natural language, no code syntax)
      if (!hasCodePatterns && !hasCodeChild && text.length > 20) {
        const wordCount = text.split(/\s+/).length;
        const avgWordLen = text.replace(/\s+/g, '').length / wordCount;
        // Natural language has avg word length 4-6, code has longer tokens
        if (avgWordLen < 7 && wordCount > 5) return;
      }

      const lang = pre.getAttribute('data-language') || pre.querySelector('[class*="language-"]')?.className.match(/language-(\w+)/)?.[1] || '';
      const lineCount = text.split('\n').length;
      let desc = `[code-block] ${Math.round(r.width)}×${Math.round(r.height)}`;
      if (lang) desc += `, language: ${lang}`;
      desc += `, ${lineCount} lines`;
      desc += `. Style: bg \`${rgbToHex(cs.backgroundColor) || cs.backgroundColor}\`, font \`${cs.fontSize}\`, radius \`${cs.borderRadius}\``;
      if (cs.border && cs.borderWidth !== '0px') desc += `, border \`${cs.border.slice(0, 40)}\``;
      // First meaningful line as context
      const firstLine = text.split('\n').find(l => l.trim().length > 5);
      if (firstLine) desc += `. Content starts: "${firstLine.trim().slice(0, 50)}"`;
      codeBlocks.push(desc);
    });
    return codeBlocks;
  }

  // Helper: detect tab UI components
  function extractTabUI(sec) {
    const tabSets = [];
    sec.querySelectorAll('[role="tablist"], [class*="tab-list"], [class*="tabs"]').forEach(tabList => {
      const tabs = Array.from(tabList.querySelectorAll('[role="tab"], [class*="tab-item"], [class*="tab-trigger"], button, a'))
        .map(t => (t.innerText || '').trim())
        .filter(t => t.length > 0 && t.length < 30);
      if (tabs.length >= 2) {
        const cs = window.getComputedStyle(tabList);
        const activeTab = tabList.querySelector('[aria-selected="true"], [class*="active"], [data-state="active"]');
        const activeCs = activeTab ? window.getComputedStyle(activeTab) : null;
        let desc = `[tab-ui] ${tabs.length} tabs: "${tabs.join('", "')}"`;
        if (activeCs) {
          const activeBg = !isTransparent(activeCs.backgroundColor) ? `, active-bg: \`${rgbToHex(activeCs.backgroundColor)}\`` : '';
          const activeBorder = activeCs.borderBottom && activeCs.borderBottomWidth !== '0px' ? `, active-indicator: \`${activeCs.borderBottom.slice(0, 40)}\`` : '';
          desc += activeBg + activeBorder;
        }
        tabSets.push(desc);
      }
    });
    // Also detect tab-like structures without role="tablist"
    if (tabSets.length === 0) {
      sec.querySelectorAll('[class*="tab"], [class*="switcher"], [class*="toggle-group"], [class*="selector"]').forEach(group => {
        const btns = Array.from(group.querySelectorAll('button, a, [role="tab"]')).map(b => (b.innerText || '').replace(/\n/g,' ').trim()).filter(t => t.length > 0 && t.length < 30);
        if (btns.length >= 2 && btns.length <= 8) {
          tabSets.push(`[tab-ui] ${btns.length} tabs: "${btns.join('", "')}"`);
        }
      });
    }
    // Detect horizontal button groups that look like tabs (adjacent buttons in a row)
    // BUT exclude CTA button pairs (e.g. "Start building" + "Contact sales")
    if (tabSets.length === 0) {
      sec.querySelectorAll('nav, div, ul').forEach(group => {
        const r = group.getBoundingClientRect();
        if (r.height > 60 || r.width < 200) return;
        const items = Array.from(group.children).filter(c => {
          const cr = c.getBoundingClientRect();
          return cr.width > 30 && cr.height > 20 && cr.height < 50 && (c.tagName === 'BUTTON' || c.tagName === 'A' || c.tagName === 'LI');
        });
        if (items.length >= 2 && items.length <= 8) {
          const tops = items.map(i => Math.round(i.getBoundingClientRect().top));
          const allSameRow = tops.every(t => Math.abs(t - tops[0]) < 10);
          if (allSameRow) {
            const labels = items.map(i => (i.innerText || '').replace(/\n/g,' ').trim()).filter(t => t.length > 0 && t.length < 30);
            if (labels.length >= 2) {
              // Skip if these look like CTA buttons (action-oriented text)
              const ctaPattern = /start|get started|sign up|contact|try|begin|join|subscribe|buy|book|learn more|view|explore/i;
              const ctaCount = labels.filter(l => ctaPattern.test(l)).length;
              if (ctaCount >= labels.length * 0.5) return; // Most labels are CTAs, not tabs

              const activeItem = items.find(i => {
                const cs = window.getComputedStyle(i);
                return !isTransparent(cs.backgroundColor) || cs.borderBottomColor !== cs.borderTopColor;
              });
              let desc = `[tab-ui] ${labels.length} tabs: "${labels.join('", "')}"`;
              if (activeItem) {
                const acs = window.getComputedStyle(activeItem);
                if (!isTransparent(acs.backgroundColor)) desc += `, active-bg: \`${rgbToHex(acs.backgroundColor)}\``;
              }
              tabSets.push(desc);
            }
          }
        }
      });
    }
    return tabSets;
  }

  // Helper: detect 3D perspective containers
  function detect3DContainers(sec) {
    const containers = [];
    sec.querySelectorAll('div, figure, [class*="mockup"], [class*="device"], [class*="perspective"]').forEach(el => {
      const cs = window.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width < 150 || r.height < 150) return;
      const transform = cs.transform;
      const perspective = cs.perspective;
      const hasPerspective = (perspective && perspective !== 'none') ||
        (transform && transform !== 'none' && (transform.includes('matrix3d') || /rotate[XY]\(/i.test(cs.transform)));
      if (!hasPerspective) return;

      const secRect = sec.getBoundingClientRect();
      const relX = (r.left - secRect.left) / secRect.width;
      const placement = relX < 0.3 ? 'left' : relX > 0.5 ? 'right' : 'center';

      let desc = `[3d-perspective] ${Math.round(r.width)}×${Math.round(r.height)}, ${placement}`;
      if (perspective && perspective !== 'none') desc += `, perspective: \`${perspective}\``;
      if (transform && transform !== 'none') desc += `, transform: \`${transform.slice(0, 60)}\``;
      const containerStyle = describeContainerStyle(cs);
      if (containerStyle) desc += `. Style: ${containerStyle}`;

      // What's inside? Count children types
      const innerImgs = el.querySelectorAll('img').length;
      const innerSvgs = el.querySelectorAll('svg').length;
      const innerText = (el.innerText || '').trim().slice(0, 60);
      if (innerImgs > 2) desc += `. Contains ${innerImgs} layered images — stacked/fanned card effect.`;
      else if (innerSvgs > 3) desc += `. Contains ${innerSvgs} SVG elements — layered icon/diagram composition.`;
      else if (innerText.length > 10) desc += `. Content: "${innerText.slice(0, 40)}".`;

      containers.push(desc);
    });
    return containers;
  }

  function extractSectionContentMap() {
    // Strategy: three-pass section detection to handle all site structures:
    //
    // Problem A (Next.js/Tailwind like attio.com):
    //   querySelectorAll('section, [class*="section"]') returns deeply-nested children.
    //   Fix: prefer main.children — the real top-level blocks.
    //
    // Problem B (vanilla/custom like rig.ai):
    //   Hero section lives as direct body child OUTSIDE <main>.
    //   Fix: always scan body-level <section> elements too, sorted by document order.
    //
    // Combined: merge body-level sections + main-level sections, sort by vertical position.

    const mainEl = document.querySelector('main') ||
      document.querySelector('#__next > div') ||
      document.querySelector('#app > div') ||
      document.querySelector('[class*="page"]:not(nav):not(header)');

    const _isValid = el => {
      if (['NAV','HEADER','FOOTER','SCRIPT','STYLE','LINK'].includes(el.tagName)) return false;
      const r = el.getBoundingClientRect();
      return r.height > 150 && r.width > 300;
    };

    let sectionEls = [];

    // Pass 1: body-level <section> elements (above or outside main) — catches hero-outside-main pattern
    const bodyLevelSections = Array.from(document.body.children).filter(el => {
      if (el.tagName !== 'SECTION') return false;
      if (mainEl && mainEl.contains(el)) return false; // skip if inside main (handled below)
      return _isValid(el);
    });

    // Pass 2: direct children of <main> — catches Next.js/Tailwind pattern
    const mainChildren = mainEl
      ? Array.from(mainEl.children).filter(_isValid)
      : [];

    // Pass 3: semantic <section> fallback inside document — if passes 1+2 yield too few results
    let merged = [...bodyLevelSections, ...mainChildren];

    if (merged.length < 2) {
      const byQuery = Array.from(document.querySelectorAll('section'))
        .filter(el => !merged.includes(el) && _isValid(el));
      merged = [...merged, ...byQuery];
    }

    // Pass 4: Framer fallback — two strategies:
    // A) Find new section-level elements from Framer's wrapper chain
    // B) Split oversized existing sections into sub-sections by bg color or data-framer-name children
    const _isFramerSite = !!document.querySelector('[data-framer-name]');
    const _pageH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    const _expectedMinSections = Math.max(4, Math.floor(_pageH / (window.innerHeight * 1.5)));
    if (_isFramerSite && merged.length < _expectedMinSections) {
      // Strategy A: walk wrapper chain to find structural content container
      let framerRoot = document.body;
      let depth = 0;
      while (framerRoot.children.length === 1 && framerRoot.firstElementChild?.tagName === 'DIV' && depth < 10) {
        framerRoot = framerRoot.firstElementChild;
        depth++;
      }
      if (framerRoot !== document.body && framerRoot.children.length >= 2) {
        let prevBg = null;
        let pass4Count = 0;
        for (const child of Array.from(framerRoot.children)) {
          if (pass4Count >= 16) break;
          if (!_isValid(child)) continue;
          if (merged.includes(child)) continue;
          const cs = window.getComputedStyle(child);
          const bg = cs.backgroundColor;
          const hasFramerName = child.hasAttribute('data-framer-name');
          const bgChanged = bg && !isTransparent(bg) && bg !== prevBg && prevBg !== null;
          if (hasFramerName || bgChanged) {
            merged.push(child);
            pass4Count++;
          }
          if (bg && !isTransparent(bg)) prevBg = bg;
        }
      }

      // Strategy B: find section-level Framer components in uncovered Y-ranges
      // The previous passes found <section> tags but Framer hides real page sections
      // as named divs deep in the tree. Only promote elements that:
      // 1. Have section-like names (not sub-components like "Image", "BG", "Container")
      // 2. Occupy Y-ranges not already covered by existing sections
      // 3. Contain meaningful content (heading text or interactive elements)
      const _viewH = window.innerHeight;
      const _scrollY = window.scrollY;

      // Build a coverage map from existing merged sections
      const _ranges = merged.map(el => {
        const r = el.getBoundingClientRect();
        return { top: r.top + _scrollY, bottom: r.top + _scrollY + r.height };
      });
      const _isYCovered = (y) => _ranges.some(r => y > r.top && y < r.bottom);

      // Allowlist of section-like Framer names — inverted from the prior blocklist
      // because the blocklist kept missing common layout wrappers (Wrapper, Row, Col,
      // Module, Block, Group, Frame) that Framer templates use for sub-components.
      // Section-shaped names only: a wrapper/row/col won't match, so it can't be promoted.
      const _SECTION_NAMES = /^(Hero|Features?|CTA|Pricing|Footer|Header|Testimonials?|Steps|Content|System|Blog|Section|Contact|Benefits|Stats|FAQ|About|Team|Gallery|Logos|Integrations|Newsletter|Reviews|Process)\b/i;

      // Find the "Main" Framer component and scan for section-level children
      // that live in uncovered Y-ranges
      const _framerMain = document.querySelector('[data-framer-name="Main"]');
      const _searchRoot = _framerMain || document.body;

      // Collect named elements that look like page sections
      const sectionCandidates = Array.from(_searchRoot.querySelectorAll('[data-framer-name]'))
        .filter(el => {
          const name = el.getAttribute('data-framer-name');
          if (!name || !_SECTION_NAMES.test(name)) return false;
          if (merged.includes(el)) return false;
          const r = el.getBoundingClientRect();
          const h = r.height;
          if (h < 200 || h > _viewH * 3 || r.width < 300) return false;
          // Must not be a transparent wrapper
          const bg = window.getComputedStyle(el).backgroundColor;
          if (h > _viewH * 2 && (!bg || isTransparent(bg))) return false;
          // Must occupy an uncovered Y-range (at least its top is not inside an existing section)
          const y = r.top + _scrollY;
          if (_isYCovered(y)) return false;
          // Must contain content (heading text > 20px or CTA buttons)
          const hasContent = !!Array.from(el.querySelectorAll('*')).find(c => {
            try { return parseFloat(window.getComputedStyle(c).fontSize) > 20 && c.innerText?.trim().length > 3; } catch(e) { return false; }
          }) || !!el.querySelector('a, button, video, canvas, svg');
          return hasContent;
        })
        .sort((a, b) => (a.getBoundingClientRect().top + _scrollY) - (b.getBoundingClientRect().top + _scrollY));

      // Deduplicate overlapping candidates — keep the one with the most specific content
      const toAdd = [];
      for (const el of sectionCandidates) {
        const y = el.getBoundingClientRect().top + _scrollY;
        const h = el.getBoundingClientRect().height;
        // Skip if substantially overlaps with an already-added candidate
        const overlaps = toAdd.some(existing => {
          const ey = existing.getBoundingClientRect().top + _scrollY;
          const eh = existing.getBoundingClientRect().height;
          const overlapStart = Math.max(y, ey);
          const overlapEnd = Math.min(y + h, ey + eh);
          return (overlapEnd - overlapStart) > Math.min(h, eh) * 0.5;
        });
        if (overlaps) continue;
        toAdd.push(el);
      }
      merged.push(...toAdd);
    }

    // Deduplicate by element reference and sort top-to-bottom by document position
    const seen = new Set();
    sectionEls = merged
      .filter(el => { if (seen.has(el)) return false; seen.add(el); return true; })
      .sort((a, b) => {
        const ay = a.getBoundingClientRect().top + window.scrollY;
        const by = b.getBoundingClientRect().top + window.scrollY;
        return ay - by;
      });

    const map = [];
    // Track how many times each fixed-canvas has been reported across sections.
    // Full-viewport fixed canvases (WebGL backgrounds) technically overlap every section —
    // we allow at most 2 reports per canvas (hero + one more prominent section) to avoid noise.
    const _fixedCanvasReportCount = new Map();

    for (const sec of sectionEls.slice(0, 16)) {
      const rect = sec.getBoundingClientRect();
      if (rect.height < 100 || rect.width < 300) continue;

      // Capture vertical padding at section boundary — used for spacing-system
      // annotation in the prompt ("96px (8×12)") so LLMs produce systematic rhythm
      // instead of arbitrary per-section values.
      const _secCs = window.getComputedStyle(sec);
      const _pTop = parseInt(_secCs.paddingTop) || 0;
      const _pBot = parseInt(_secCs.paddingBottom) || 0;
      const sectionPaddingY = Math.max(_pTop, _pBot) || null;

      // ── Detect eyebrow/overline label (e.g. "OUR APPROACH", "PHILOSOPHY") ──
      let eyebrowText = null;
      const _eyebrowEl = sec.querySelector('[class*="eyebrow"], [class*="overline"], [class*="kicker"], [class*="tag-label"], [class*="super-title"], [class*="pre-title"]');
      if (_eyebrowEl) {
        const t = _eyebrowEl.innerText?.trim();
        if (t && t.length > 1 && t.length < 40) eyebrowText = t;
      }
      if (!eyebrowText) {
        // Fallback: find small uppercase text appearing before the first heading
        const _allEls = sec.querySelectorAll('span, div, p, label, a');
        for (const el of Array.from(_allEls).slice(0, 20)) {
          try {
            const cs = window.getComputedStyle(el);
            if (cs.textTransform === 'uppercase' && parseInt(cs.fontSize) <= 14 && cs.display !== 'none') {
              const t = el.innerText?.trim();
              const r = el.getBoundingClientRect();
              if (t && t.length > 1 && t.length < 40 && r.width > 20 && r.height > 0) {
                // Must appear above or at the top of section (within first 200px)
                if (r.top - rect.top < 200) { eyebrowText = t; break; }
              }
            }
          } catch(e) { console.debug('[VibeDesign]', e.message); }
        }
      }

      // Pick first VISIBLE heading (skip display:none responsive clones)
      let heading = Array.from(sec.querySelectorAll('h1, h2, h3')).find(el => {
        const cs = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
      }) || null;
      // Framer fallback: no semantic heading tags — find the largest visible text element
      if (!heading) {
        let bestEl = null, bestSize = 0;
        const _candidates = sec.querySelectorAll('[data-framer-component-type="RichTextContainer"], [data-framer-component-type="RichText"], div, p, span');
        for (const el of Array.from(_candidates).slice(0, 60)) {
          try {
            const cs = window.getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            const fs = parseFloat(cs.fontSize) || 0;
            const r = el.getBoundingClientRect();
            if (fs < 24 || r.width < 100 || r.height < 20) continue; // only large text
            const text = el.innerText?.trim();
            if (!text || text.length < 3 || text.length > 120) continue;
            // Avoid picking up body paragraphs — must be significantly larger than 16px body
            if (fs > bestSize) { bestSize = fs; bestEl = el; }
          } catch(e) {}
        }
        if (bestEl) heading = bestEl;
      }
      const headingText = heading?.innerText?.trim().slice(0, 60) || '';
      let hasH1 = !!Array.from(sec.querySelectorAll('h1')).find(el => {
        const cs = window.getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden';
      });
      // Framer fallback: treat very large text (>40px) as equivalent to h1
      if (!hasH1 && heading) {
        try { hasH1 = parseFloat(window.getComputedStyle(heading).fontSize) > 40; } catch(e) {}
      }

      // ── Detect colored/highlighted words in headings ──
      let headingColoredWords = [];
      if (heading) {
        const headingColor = window.getComputedStyle(heading).color;
        heading.querySelectorAll('*').forEach(child => {
          const cs = window.getComputedStyle(child);
          const text = child.innerText?.trim();
          if (!text || text.length < 2 || text.length > 40) return;
          // Check for different text color
          if (cs.color !== headingColor) {
            headingColoredWords.push({ text, style: `color:${rgbToHex(cs.color)||cs.color}` });
          }
          // Check for background highlight (pill highlight)
          if (!isTransparent(cs.backgroundColor)) {
            headingColoredWords.push({ text, style: `bg:${rgbToHex(cs.backgroundColor)||cs.backgroundColor}` });
          }
          // Check for gradient text (background-clip: text)
          if (cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text') {
            headingColoredWords.push({ text, style: `gradient-text` });
          }
        });
      }

      // ── Detect decorative gradient elements in section ──
      let sectionDecorations = [];
      sec.querySelectorAll('div, span').forEach(el => {
        const cs = window.getComputedStyle(el);
        const bgImg = cs.backgroundImage;
        const r = el.getBoundingClientRect();
        if (bgImg && bgImg.includes('gradient') && r.width > 50 && r.height > 10) {
          // Check if it's decorative (no text content, or position absolute)
          const hasText = el.innerText?.trim().length > 0;
          const isDecorative = !hasText || cs.position === 'absolute' || cs.position === 'fixed' || cs.zIndex === '-1';
          if (isDecorative || !hasText) {
            sectionDecorations.push({
              size: `${Math.round(r.width)}×${Math.round(r.height)}`,
              gradient: bgImg.slice(0, 120),
              transform: cs.transform !== 'none' ? cs.transform.slice(0,40) : null
            });
          }
        }
      });
      // Deduplicate by gradient value
      const seenGrads = new Set();
      sectionDecorations = sectionDecorations.filter(d => {
        if (seenGrads.has(d.gradient)) return false;
        seenGrads.add(d.gradient);
        return true;
      }).slice(0, 3);

      // Content element detection
      const hasForm = !!sec.querySelector('form, input[type="email"], input[type="text"]');
      const hasVideo = !!sec.querySelector('video, iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="loom"]');
      const imgCount = sec.querySelectorAll('img').length;
      const smallImgCount = Array.from(sec.querySelectorAll('img')).filter(i => {
        const r = i.getBoundingClientRect();
        return r.width < 150 && r.height < 80 && r.width > 30;
      }).length;
      const largeSvgCount = Array.from(sec.querySelectorAll('svg')).filter(s => {
        const r = s.getBoundingClientRect();
        return r.width > 200 && r.height > 200;
      }).length;
      // Only detect canvases that are actual DOM children of this section
      // (fixed/absolute canvases are handled separately via visual descriptions with _fixedCanvasReportCount)
      const hasCanvas = !!sec.querySelector('canvas');
      const hasSwiper = !!sec.querySelector('.swiper, [class*="slider"], [class*="carousel"]');
      // Fix 7: List-structure-based detection — avoids false-positive on any "01" text in sidebar/nav
      const listItemEls = sec.querySelectorAll('li, [role="listitem"], [class*="step-item"], [class*="steps-item"]');
      const hasNumberedItems = Array.from(listItemEls).some(li => /^\s*0?[1-9][\.\)\s]/.test(li.textContent?.trim()));

      // Capture step card content when numbered items are detected
      let stepItems = null;
      if (hasNumberedItems) {
        stepItems = [];
        for (const li of Array.from(listItemEls).slice(0, 8)) {
          try {
            const liText = li.textContent?.trim() || '';
            if (!/^\s*0?[1-9][\.\)\s]/.test(liText) && !/step\s*0?[1-9]/i.test(liText)) continue;
            // Find step label (small text like "STEP 01")
            const labelEl = li.querySelector('[class*="step"], [class*="label"], [class*="number"], [class*="eyebrow"], [class*="overline"], span, small');
            const label = labelEl?.innerText?.trim().slice(0, 20) || liText.match(/^[\s\d\.\)]+/)?.[0]?.trim() || '';
            // Find step heading (the main bold/large text)
            const headingEl = li.querySelector('h2, h3, h4, h5, [class*="heading"], [class*="title"], strong, b');
            const stepHeading = headingEl?.innerText?.trim().slice(0, 60) || '';
            if (label || stepHeading) stepItems.push({ label, heading: stepHeading });
          } catch(e) { console.debug('[VibeDesign]', e.message); }
        }
        if (stepItems.length === 0) stepItems = null;
      }

      const hasStats = /\d+[KkMm+%]|\$\d/.test(sec.innerText);
      const hasAccordion = !!sec.querySelector('[class*="accordion"],[class*="faq"],[class*="collapse"],[open]');
      const hasTabNav = !!sec.querySelector('[role="tablist"],[class*="tab-nav"],[class*="tabs"]');

      // Layout detection
      let layout = 'stacked'; // default
      let gridCols = null;
      let _splitContainer = null;
      // If the section or its primary content child is flex-col, it's fundamentally stacked
      // (Next.js/Tailwind: main > div.wrapper > section.flex-col — sec may be the wrapper, not the section)
      const _secCs = window.getComputedStyle(sec);
      let _secIsFlexCol = _secCs.display === 'flex' && (_secCs.flexDirection === 'column' || _secCs.flexDirection === 'column-reverse');
      if (!_secIsFlexCol) {
        // Check the first large child — it might be the actual flex-col section inside a wrapper
        const _firstBigChild = Array.from(sec.children).find(c => c.getBoundingClientRect().height > rect.height * 0.5);
        if (_firstBigChild) {
          const _fcs = window.getComputedStyle(_firstBigChild);
          if (_fcs.display === 'flex' && (_fcs.flexDirection === 'column' || _fcs.flexDirection === 'column-reverse')) _secIsFlexCol = true;
        }
      }
      // Check layout at two levels — include section children (Next.js wraps in section > div)
      const innerContainers = sec.querySelectorAll(':scope > div, :scope > section, :scope > div > div, :scope > section > div');
      for (const child of Array.from(innerContainers).slice(0, 5)) {
        const cs = window.getComputedStyle(child);
        // Skip absolute/fixed positioned elements — they're overlays/decorations, not layout containers
        if (cs.position === 'absolute' || cs.position === 'fixed') continue;
        // Grid detection FIRST — catches 3+ column layouts before split-columns
        if (cs.display === 'grid') {
          const cols = cs.gridTemplateColumns;
          if (cols && cols.split(' ').length >= 3) {
            layout = 'multi-column-grid';
            const _colParts = cols.split(' ').filter(Boolean);
            const _uniq = new Set(_colParts);
            if (_uniq.size === 1 && _colParts.length > 6) {
              gridCols = `baseline-grid:${_colParts.length}-col×${_colParts[0]}`;
            } else if (_colParts.length > 8) {
              gridCols = `${_colParts.length}-col grid (${_colParts.slice(0,3).join(' ')}...)`;
            } else {
              gridCols = cols;
            }
            // Extract grid-template-areas and rows
            const _areas = cs.gridTemplateAreas;
            if (_areas && _areas !== 'none') {
              gridCols += ` areas:${_areas.replace(/"/g, '').replace(/\s+/g, '|')}`;
            }
            const _rows = cs.gridTemplateRows;
            if (_rows && _rows !== 'none' && _rows.split(' ').length <= 8) {
              gridCols += ` rows:${_rows}`;
            }
            break;
          }
        }
        // Flex/grid with exactly 2 side-by-side children = split-columns (not multi-column)
        // Skip if container is flex-direction: column — children are stacked, not split
        if (layout === 'stacked' && (cs.display === 'flex' || cs.display === 'grid') && child.children.length >= 2) {
          // A column-direction flex container is stacked by definition
          if (cs.flexDirection === 'column' || cs.flexDirection === 'column-reverse') continue;
          const visibleChildren = Array.from(child.children).filter(c => {
            const r = c.getBoundingClientRect();
            return r.width > 100 && r.height > 50;
          });
          if (visibleChildren.length >= 2) {
            const c1 = visibleChildren[0].getBoundingClientRect();
            const c2 = visibleChildren[1].getBoundingClientRect();
            const sameRow = Math.abs(c1.top - c2.top) < 50 && c1.width > 200 && c2.width > 200;
            if (sameRow) {
              // Count how many children are on the same row
              const _rowChildren = visibleChildren.filter(c => Math.abs(c.getBoundingClientRect().top - c1.top) < 50);
              if (_rowChildren.length >= 3) {
                layout = 'multi-column-grid';
                gridCols = `${_rowChildren.length}-column flex/grid`;
              } else {
                // Verify it's a true split: each column must be a substantial content block
                // and together they should roughly fill the section width (not a small tab bar)
                const secW = rect.width;
                const bothWide = c1.width > secW * 0.7 && c2.width > secW * 0.7;
                const combinedWidth = c1.width + c2.width;
                const fillsSection = combinedWidth > secW * 0.6;
                const eachSubstantial = c1.height > 150 && c2.height > 150;
                // The split container must occupy a major portion of the section height
                // (a tab bar or button row is <20% of section height — not a layout split)
                const childH = child.getBoundingClientRect().height;
                const isMainLayout = childH > rect.height * 0.4;
                // Don't promote to split-columns if the section itself is flex-col
                // (the section is fundamentally stacked — inner grid/flex children are sub-layouts)
                if (!bothWide && fillsSection && eachSubstantial && isMainLayout && !_secIsFlexCol) {
                  layout = 'split-columns';
                  _splitContainer = child;
                }
              }
              break;
            }
          }
        }
      }

      // CTA elements — wider selector to catch styled <a> tags and buttons
      // CTA text cleaner — remove newlines, collapse whitespace, deduplicate
      const cleanCtaText = (el) => {
        // First try: get text only from visible children (skip display:none responsive clones)
        let t = '';
        try {
          const visibleNodes = Array.from(el.querySelectorAll('*')).filter(n => {
            const cs = window.getComputedStyle(n);
            return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
          });
          // Get text from the deepest visible text-containing element
          const textEl = visibleNodes.find(n => n.children.length === 0 && (n.textContent || '').trim().length > 1);
          if (textEl) t = (textEl.textContent || '').trim();
        } catch(e) { console.debug('[VibeDesign]', e.message); }
        // Fallback to innerText
        if (!t) t = (el.innerText || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        // Still duplicated? Try splitting at repeat boundary
        if (t.length > 10) {
          for (let len = Math.ceil(t.length / 3); len <= Math.floor(t.length / 2) + 1; len++) {
            const candidate = t.slice(0, len).trim();
            if (candidate.length < 3) continue;
            const rest = t.slice(len).trim();
            // Check if rest starts with the same text (possibly truncated)
            if (rest.length > 0 && candidate.startsWith(rest.slice(0, Math.min(rest.length, candidate.length)))) {
              t = candidate;
              break;
            }
            if (rest.length > 0 && rest.startsWith(candidate.slice(0, Math.min(candidate.length, rest.length)))) {
              t = candidate;
              break;
            }
          }
        }
        return t.slice(0, 30);
      };
      const ctaButtons = [...new Set(
        Array.from(sec.querySelectorAll('a[class*="btn"], a[class*="button"], a[class*="cta"], a[class*="action"], a[class*="primary"], a[class*="start"], button[class*="btn"], button[class*="button"], button[class*="cta"], [role="button"]'))
          .filter(el => !el.closest('nav, header, [class*="nav"], [class*="header"], [role="navigation"]'))
          .map(cleanCtaText)
          .filter(t => t.length > 1)
      )].slice(0, 3);
      // Fallback: detect styled <a> tags that look like buttons (bg + padding)
      if (ctaButtons.length === 0) {
        const styledLinks = Array.from(sec.querySelectorAll('a[href]')).filter(a => {
          if (a.closest('nav, header, [class*="nav"], [class*="header"], [role="navigation"]')) return false;
          const acs = window.getComputedStyle(a);
          const hasBg = !isTransparent(acs.backgroundColor);
          const hasBorder = acs.borderWidth !== '0px' && acs.borderStyle !== 'none';
          const hasPad = parseInt(acs.paddingLeft) >= 12 && parseInt(acs.paddingTop) >= 6;
          return (hasBg || hasBorder) && hasPad;
        });
        const fallbackTexts = [...new Set(styledLinks.slice(0, 5).map(cleanCtaText).filter(t => t.length > 1))];
        fallbackTexts.slice(0, 3).forEach(t => ctaButtons.push(t));
      }
      // Hero-specific final fallback: Framer sites wrap CTAs in 0-padding containers — bypass padding check
      // Look for any large visible link/role=button with a colored bg, ignoring padding
      if (ctaButtons.length === 0 && map.length === 0) {
        const _heroBigBtns = Array.from(sec.querySelectorAll('a[href], [role="button"]'))
          .filter(el => {
            const r = el.getBoundingClientRect();
            const cs = window.getComputedStyle(el);
            if (r.width < 100 || r.height < 30) return false;
            if (el.closest('nav, header')) return false;
            return !isTransparent(cs.backgroundColor);
          })
          .map(el => cleanCtaText(el))
          .filter(t => t.length > 2 && t.length < 60);
        [...new Set(_heroBigBtns)].slice(0, 3).forEach(t => ctaButtons.push(t));
      }
      const arrowLinks = Array.from(sec.querySelectorAll('a'))
        .filter(a => /→|→|arrow/i.test(a.innerText + (a.className || '')))
        .map(a => (a.innerText || '').trim().slice(0, 30))
        .slice(0, 2);

      // Classify section type — hero MUST take priority
      let type = 'content';
      const isFirstSection = map.length === 0;
      const hasAnyHeading = !!sec.querySelector('h1, h2, h3') || !!headingText;
      // Hero: FIRST section is ALWAYS hero if it has any heading or CTA or visual
      if (isFirstSection && (hasH1 || hasAnyHeading || ctaButtons.length > 0 || hasVideo || hasCanvas)) type = 'hero';
      else if (hasH1 && (hasForm || ctaButtons.length > 0)) {
        // Only classify as hero if near the top — avoids misclassifying mid-page h1+CTA sections (Framer sites repeat h1)
        const _secTop = sec.offsetTop !== undefined ? sec.offsetTop : (sec.getBoundingClientRect().top + window.scrollY);
        if (_secTop < window.innerHeight * 2) type = 'hero';
        else type = 'cta-section';
      }
      else if (smallImgCount >= 4) type = (layout === 'split-columns') ? 'portfolio-split' : 'logo-strip';
      else if (hasNumberedItems && (hasTabNav || hasSwiper)) type = 'interactive-steps';
      else if (hasNumberedItems) type = 'numbered-steps';
      else if (hasSwiper) type = 'slider/carousel';
      else if (hasAccordion) type = 'faq/accordion';
      else if (hasVideo && !isFirstSection) type = 'video-showcase';
      // [0x] numbered sections (e.g. '[01] POWERFUL PLATFORM') are feature showcases, NOT stats
      else if (eyebrowText && /^\[0[1-9]\]/.test(eyebrowText)) type = 'feature-showcase';
      else if (hasStats) type = 'stats/metrics';
      else if (layout === 'split-columns' && (imgCount > 0 || largeSvgCount > 0)) type = 'feature-split';
      else if (layout === 'split-columns') type = 'two-column';
      else if (layout === 'multi-column-grid') type = 'feature-grid';
      // Additional classification for generic "content" sections
      else if (hasForm || sec.querySelector('input[type="email"], input[type="text"][placeholder*="mail"]')) type = 'newsletter';
      else if (sec.querySelector('blockquote, [class*="testimonial"], [class*="quote"]')) type = 'testimonial';
      else if (sec.querySelector('address, [class*="footer"], [class*="contact"]') && sec.querySelector('a[href*="mailto:"], a[href*="tel:"]')) type = 'footer-contact';
      else if (ctaButtons.length >= 2) type = 'cta-section';
      else if (headingText && imgCount === 0 && layout === 'stacked') type = 'text-block';

      // Rich visual descriptions — style, framing, composition, choreography
      const visualDescriptions = [];

      // ── Analyze images with full visual context ──
      if (type !== 'logo-strip' && type !== 'portfolio-split') {
        const significantImgs = Array.from(sec.querySelectorAll('img')).filter(i => {
          const r = i.getBoundingClientRect();
          return r.width > 80 && r.height > 80;
        });
        for (const img of significantImgs.slice(0, 4)) {
          const r = img.getBoundingClientRect();
          const cs = window.getComputedStyle(img);
          const alt = (img.alt || '').trim();

          // Content type from alt, src, class
          const altLow = alt.toLowerCase();
          const srcLow = (img.src || '').toLowerCase();
          const clsLow = (img.className || '').toLowerCase();
          const _combined = altLow + ' ' + srcLow + ' ' + clsLow;
          const _secClsLow = (sec.className || '').toLowerCase();
          const _parentClsLow = (img.parentElement?.className || '').toLowerCase();
          let contentType = 'ui-mockup';
          // Person/portrait photo detection — check before UI patterns
          const _isPersonAlt = alt && /^[A-Z][a-z]+ [A-Z][a-z]+/.test(alt); // "FirstName LastName" pattern
          const _isPersonCtx = /portrait|headshot|team|founder|person|people|member|speaker|author/i.test(_combined + _secClsLow + _parentClsLow);
          const _aspectRatioImg = r.width / (r.height || 1);
          const _isPortraitShape = _aspectRatioImg >= 0.6 && _aspectRatioImg <= 1.4; // square or slightly portrait
          if (_isPersonAlt || (_isPersonCtx && _isPortraitShape)) contentType = 'person-photo';
          else if (/dashboard|analytics|chart|graph|metric/.test(_combined)) contentType = 'dashboard-ui';
          else if (/table|list|data|cap.table|investor|share/.test(_combined)) contentType = 'data-table-ui';
          else if (/diagram|flow|process|architecture/.test(_combined)) contentType = 'flow-diagram';
          else if (/form|input|config|setting/.test(_combined)) contentType = 'form-ui';

          // Container / frame analysis — full visual style capture
          const container = img.closest('div[class],figure,[class*="card"],[class*="frame"],[class*="mock"],[class*="visual"],[class*="hero"]');
          const containerCs = container ? window.getComputedStyle(container) : null;
          const containerStyle = describeContainerStyle(containerCs);
          let framing = [];
          if (containerStyle) framing.push(containerStyle);
          const imgRadius = cs.borderRadius !== '0px' ? cs.borderRadius : null;
          if (imgRadius) framing.push(`img-radius: ${imgRadius}`);
          // Image's own shadow/glow
          if (cs.boxShadow && cs.boxShadow !== 'none') framing.push(`img-shadow: ${cs.boxShadow.slice(0,80)}`);

          // Perspective / transform
          const transform = cs.transform;
          let perspective = 'flat';
          if (transform && transform !== 'none' && transform.includes('matrix3d')) perspective = '3d-angled';
          else if (transform && transform !== 'none') perspective = 'slightly-rotated';

          // Placement
          const secRect = sec.getBoundingClientRect();
          const relX = (r.left - secRect.left) / secRect.width;
          const placement = relX < 0.3 ? 'left' : relX > 0.5 ? 'right' : 'center';

          // Build rich description with context inference
          let desc = `[${contentType}] ${Math.round(r.width)}×${Math.round(r.height)}, ${placement}`;
          if (alt) desc += `, "${alt}"`;
          else {
            // No alt text — try to infer from context
            const imgContext = inferVisualContext(img, headingText);
            if (imgContext && contentType === 'ui-mockup') desc = `[${imgContext.includes('dashboard') ? 'dashboard-ui' : contentType}] ${Math.round(r.width)}×${Math.round(r.height)}, ${placement} — ${imgContext}`;
          }
          desc += `, perspective: ${perspective}`;
          if (framing.length > 0) desc += `, frame: {${framing.join(', ')}}`;

          visualDescriptions.push(desc);
        }
      }

      // ── Analyze large SVGs with structural content detection ──
      const largeSvgs = Array.from(sec.querySelectorAll('svg')).filter(s => {
        const r = s.getBoundingClientRect();
        return r.width > 150 && r.height > 150;
      });
      for (const svg of largeSvgs.slice(0, 3)) {
        const r = svg.getBoundingClientRect();
        // Use viewBox or width/height attributes for more accurate dimensions
        // (getBoundingClientRect may be clipped by overflow:hidden parent)
        let svgW = Math.round(r.width), svgH = Math.round(r.height);
        const _vb = svg.getAttribute('viewBox');
        if (_vb) {
          const _vbParts = _vb.split(/[\s,]+/).map(Number);
          if (_vbParts.length === 4 && _vbParts[2] > svgW * 1.2) { svgW = Math.round(_vbParts[2]); svgH = Math.round(_vbParts[3]); }
        }
        const _attrW = parseInt(svg.getAttribute('width'));
        const _attrH = parseInt(svg.getAttribute('height'));
        if (_attrW > svgW * 1.2 && _attrH > 0) { svgW = _attrW; svgH = _attrH; }
        const cs = window.getComputedStyle(svg);
        const pathCount = svg.querySelectorAll('path,circle,ellipse,line,rect,polygon').length;
        const textCount = svg.querySelectorAll('text').length;
        const embeddedImages = svg.querySelectorAll('image').length;
        const clipPaths = svg.querySelectorAll('clipPath').length;
        const circles = svg.querySelectorAll('circle').length;
        const rects = svg.querySelectorAll('rect').length;
        const lines = svg.querySelectorAll('line,polyline').length;
        const hasAnim = cs.animation !== 'none' || !!svg.querySelector('animate,animateTransform');
        const svgTexts = Array.from(svg.querySelectorAll('text')).map(t => (t.textContent || '').trim()).filter(t => t.length > 1).slice(0, 5);

        // Content-aware SVG classification
        let svgDesc = '';
        if (embeddedImages > 5 && clipPaths > 10) {
          // Avatar grid / people illustration with clipped photos
          svgDesc = `illustration with ${embeddedImages} embedded avatar/icon images, clipped into circular frames — appears to show a people/user flow or organizational diagram`;
        } else if (textCount > 5 && (circles > 3 || rects > 5)) {
          // Labeled data visualization
          svgDesc = `labeled data visualization with ${textCount} text labels${svgTexts.length > 0 ? ' including "'+svgTexts.slice(0,3).join('", "')+'"' : ''}`;
        } else if (embeddedImages > 0) {
          svgDesc = `illustration containing ${embeddedImages} embedded images — likely a product diagram or feature showcase`;
        } else if (pathCount > 100 && circles > 5) {
          svgDesc = `complex circular/radial diagram with ${pathCount} paths and ${circles} circles — possibly a pie chart, donut graph, or radial progress indicator`;
        } else if (pathCount > 100) {
          svgDesc = `detailed vector illustration with ${pathCount} paths — a complex product or brand visual rendered entirely in SVG`;
        } else if (lines > 5 && pathCount > 20) {
          svgDesc = `line-based diagram or chart with ${lines} lines and ${pathCount} paths — possibly a line graph, flow chart, or connection map`;
        } else if (pathCount > 40) {
          svgDesc = `schematic diagram with ${pathCount} paths`;
        } else if (pathCount > 10) {
          svgDesc = `simple line illustration with ${pathCount} paths`;
        } else {
          svgDesc = `decorative SVG element`;
        }

        // Extract SVG color palette
        const svgColors = new Set();
        svg.querySelectorAll('[stroke],[fill]').forEach(el => {
          const s = el.getAttribute('stroke');
          const f = el.getAttribute('fill');
          if (s && s !== 'none' && s !== 'currentColor' && s.length < 30) svgColors.add(s);
          if (f && f !== 'none' && f !== 'currentColor' && f.length < 30) svgColors.add(f);
        });

        const secRect = sec.getBoundingClientRect();
        const relX = (r.left - secRect.left) / secRect.width;
        const placement = relX < 0.3 ? 'left' : relX > 0.5 ? 'right' : 'center';

        let desc = `[svg] ${svgW}×${svgH}, ${placement}: ${svgDesc}`;
        if (hasAnim) desc += ' (animated)';
        if (svgColors.size > 0) desc += `. Colors: ${[...svgColors].slice(0, 3).join(', ')}`;
        // Container styling for SVG
        const svgContainer = svg.closest('div[class],figure,[class*="card"],[class*="visual"]');
        if (svgContainer) {
          const svgContainerStyle = describeContainerStyle(window.getComputedStyle(svgContainer));
          if (svgContainerStyle) desc += `. Container: ${svgContainerStyle}`;
        }

        visualDescriptions.push(desc);
      }

      // ── Canvas detection with size/placement and container styling ──
      // Include both DOM-descendant canvases AND canvases that visually overlap (but are DOM-external)
      const _domCanvases = Array.from(sec.querySelectorAll('canvas'));
      const _secRectC = sec.getBoundingClientRect();
      const _externalCanvases = Array.from(document.querySelectorAll('canvas')).filter(c => {
        if (sec.contains(c)) return false;
        const cr = c.getBoundingClientRect();
        if (cr.width < 100 || cr.height < 100) return false;
        const cs = window.getComputedStyle(c);
        // Fixed full-viewport canvas (common WebGL setup): getBoundingClientRect() is viewport-relative,
        // so it fails to overlap off-screen sections. Use document-offset comparison instead.
        if (cs.position === 'fixed' && cr.width >= window.innerWidth * 0.7 && cr.height >= window.innerHeight * 0.5) {
          // Limit each fixed canvas to at most 2 reports (hero + one more section) to avoid noise
          const _count = _fixedCanvasReportCount.get(c) || 0;
          if (_count >= 2) return false;
          // Full-viewport fixed canvas — compute doc-relative section bounds
          const _secDocTop = _secRectC.top + window.scrollY;
          const _secDocBottom = _secRectC.bottom + window.scrollY;
          const _canvasDocTop = cr.top + window.scrollY;
          const _canvasDocBottom = cr.bottom + window.scrollY;
          if (_canvasDocTop < _secDocBottom && _canvasDocBottom > _secDocTop) {
            _fixedCanvasReportCount.set(c, _count + 1);
            return true;
          }
          return false;
        }
        // Non-fixed canvas: standard viewport-relative overlap check
        return cr.top < _secRectC.bottom && cr.bottom > _secRectC.top &&
               cr.left < _secRectC.right && cr.right > _secRectC.left;
      });
      const canvases = [..._domCanvases, ..._externalCanvases];
      for (const c of canvases.slice(0, 2)) {
        const cr = c.getBoundingClientRect();
        if (cr.width > 100 && cr.height > 100) {
          const secRect = sec.getBoundingClientRect();
          const isFullSection = cr.width > secRect.width * 0.7 && cr.height > secRect.height * 0.4;
          const isFullViewport = cr.width >= window.innerWidth * 0.75 && cr.height >= window.innerHeight * 0.4;
          const placement = (isFullSection || isFullViewport) ? 'full-section-background' : `contained ${Math.round(cr.width)}×${Math.round(cr.height)}`;
          let canvasDesc = `[canvas-animation] ${placement}`;
          // Infer what this canvas shows from context
          const canvasContext = inferVisualContext(c, headingText);
          if (canvasContext) canvasDesc += ` — ${canvasContext}`;
          // Cursor interaction: full-viewport canvas with pointer-events enabled = mouse-driven animation
          // WebGL canvases often use pointer-events:none on the canvas itself,
          // relying on a sibling/parent transparent overlay to capture mouse events.
          // Also: full-viewport canvas in hero section = almost certainly mouse-interactive.
          const cStyle = window.getComputedStyle(c);
          const _cp = c.parentElement;
          const _hasPointerOverlay = isFullViewport && _cp && Array.from(_cp.children).some(sib => {
            if (sib === c) return false;
            const ss = window.getComputedStyle(sib);
            const sr = sib.getBoundingClientRect();
            const crr = c.getBoundingClientRect();
            return ss.pointerEvents !== 'none' &&
                   sr.width >= crr.width * 0.5 &&
                   sr.height >= crr.height * 0.5;
          });
          const _ancestorCursorNone = [_cp, _cp?.parentElement, _cp?.parentElement?.parentElement].some(el =>
            el && window.getComputedStyle(el).cursor === 'none'
          );
          const isMouseDriven = isFullViewport && (
            cStyle.pointerEvents !== 'none' ||
            _hasPointerOverlay ||
            _ancestorCursorNone ||
            type === 'hero'
          );
          if (isMouseDriven) {
            canvasDesc += '. Mouse-interactive — cursor movement drives animation (WebGL/canvas + mousemove). Recreate with: canvas mousemove/touchmove listener + requestAnimationFrame render loop + particle or glow effect that tracks cursor position.';
          } else {
            // Capture container styling
            const container = c.closest('div[class],figure,[class*="card"],[class*="visual"],[class*="hero"]');
            if (container) {
              const ccs = window.getComputedStyle(container);
              const containerStyle = describeContainerStyle(ccs);
              if (containerStyle) canvasDesc += `. Container: ${containerStyle}`;
            }
            canvasDesc += '. Recreate as animated CSS gradient, SVG animation, or radial glow effect matching this description.';
          }
          visualDescriptions.push(canvasDesc);
        }
      }

      // ── Lottie animation detection ──
      const lotties = sec.querySelectorAll('[class*="lottie"], lottie-player, [data-animation-path], dotlottie-player, [data-lottie]');
      for (const l of Array.from(lotties).slice(0, 2)) {
        const lr = l.getBoundingClientRect();
        if (lr.width > 50 && lr.height > 50) {
          visualDescriptions.push(`[lottie-animation] ${Math.round(lr.width)}×${Math.round(lr.height)} — animated vector illustration. Recreate as a looping CSS animation or SVG animation.`);
        }
      }

      // ── Video detection with background vs player distinction + container styling ──
      const videos = sec.querySelectorAll('video');
      for (const v of Array.from(videos).slice(0, 2)) {
        const vr = v.getBoundingClientRect();
        if (vr.width > 100 && vr.height > 50) {
          const isBg = (v.autoplay || v.hasAttribute('autoplay')) && (v.muted || v.hasAttribute('muted')) && (v.loop || v.hasAttribute('loop'));
          const poster = v.poster ? `, poster image available` : '';
          let videoDesc = `[${isBg ? 'video-background' : 'video-player'}] ${Math.round(vr.width)}×${Math.round(vr.height)}`;
          // Infer what this video shows from context
          const videoContext = inferVisualContext(v, headingText);
          if (videoContext) videoDesc += ` — ${videoContext}`;
          else videoDesc += isBg ? ' — ambient background visual' : ' — interactive video player';
          videoDesc += poster;
          // Capture container styling
          const container = v.closest('div[class],figure,[class*="card"],[class*="visual"],[class*="hero"]');
          if (container) {
            const ccs = window.getComputedStyle(container);
            const containerStyle = describeContainerStyle(ccs);
            if (containerStyle) videoDesc += `. Container: ${containerStyle}`;
          }
          visualDescriptions.push(videoDesc);
        }
      }
      if (hasVideo && videos.length === 0) visualDescriptions.push('[video] embedded video element');

      if (hasForm) visualDescriptions.push('[form] email/text input with CTA button');

      // ── Large styled visual elements (gradient panels, glow boxes, decorative visuals) ──
      if (visualDescriptions.length === 0 || (type === 'hero' && visualDescriptions.length < 2)) {
        const visualDivs = Array.from(sec.querySelectorAll('div, figure')).filter(el => {
          const r = el.getBoundingClientRect();
          if (r.width < 200 || r.height < 150) return false;
          const ecs = window.getComputedStyle(el);
          const hasBgImage = ecs.backgroundImage && ecs.backgroundImage !== 'none' && (ecs.backgroundImage.includes('gradient') || ecs.backgroundImage.includes('url('));
          const hasGlow = ecs.boxShadow && ecs.boxShadow !== 'none' && /\b0px\s+0px\s+\d+px/.test(ecs.boxShadow);
          const hasAnimation = ecs.animation && ecs.animation !== 'none';
          const hasBackdrop = ecs.backdropFilter && ecs.backdropFilter !== 'none';
          // Must have at least 2 visual properties to be considered a "visual element" (not just a layout container)
          const visualScore = (hasBgImage ? 1 : 0) + (hasGlow ? 1 : 0) + (hasAnimation ? 1 : 0) + (hasBackdrop ? 1 : 0);
          // Also check if it has very few text children (visual, not content)
          const textLen = (el.innerText || '').trim().length;
          return visualScore >= 1 && textLen < 50;
        });
        for (const vd of visualDivs.slice(0, 2)) {
          const r = vd.getBoundingClientRect();
          const ecs = window.getComputedStyle(vd);
          const secRect = sec.getBoundingClientRect();
          const relX = (r.left - secRect.left) / secRect.width;
          const placement = relX < 0.3 ? 'left' : relX > 0.5 ? 'right' : 'center';
          let desc = `[styled-visual] ${Math.round(r.width)}×${Math.round(r.height)}, ${placement}`;
          const vdContext = inferVisualContext(vd, headingText);
          if (vdContext) desc += ` — ${vdContext}`;
          const style = describeContainerStyle(ecs);
          if (style) desc += `. Style: ${style}`;
          if (ecs.animation && ecs.animation !== 'none') desc += '. Animated — recreate with CSS keyframe animation.';
          else desc += '. Recreate as a CSS gradient/glow visual element.';
          // Check if already described by another visual type (avoid duplicates)
          const isDuplicate = visualDescriptions.some(vdesc => {
            const sizeMatch = vdesc.includes(`${Math.round(r.width)}×${Math.round(r.height)}`);
            return sizeMatch;
          });
          if (!isDuplicate) visualDescriptions.push(desc);
        }
      }

      // ── Per-section background color & gradient ──
      // Walk up parent chain to find actual visible background
      let secBgHex = null;
      let secGradient = null;
      let bgEl = sec;
      while (bgEl && bgEl !== document.body) {
        const cs = window.getComputedStyle(bgEl);
        const bg = cs.backgroundColor;
        const bgImg = cs.backgroundImage;
        if (!secBgHex && !isTransparent(bg)) {
          secBgHex = rgbToHex(bg);
        }
        if (!secGradient && bgImg && bgImg.includes('gradient')) {
          secGradient = (bgImg.match(/(linear-gradient|radial-gradient|conic-gradient)\([^)]+(?:\([^)]*\))*[^)]*\)/)||[])[0]?.slice(0, 200) || null;
        }
        if (secBgHex || secGradient) break;
        bgEl = bgEl.parentElement;
      }

      // ── Code blocks, tab UI, and 3D containers ──
      const codeBlocks = extractCodeBlocks(sec);
      codeBlocks.forEach(cb => visualDescriptions.push(cb));

      const tabSets = extractTabUI(sec);
      tabSets.forEach(ts => visualDescriptions.push(ts));

      const perspective3D = detect3DContainers(sec);
      perspective3D.forEach(p => {
        // Avoid duplicates with existing visual descriptions
        const isDup = visualDescriptions.some(vd => {
          const sizeMatch = p.match(/(\d+×\d+)/);
          return sizeMatch && vd.includes(sizeMatch[1]);
        });
        if (!isDup) visualDescriptions.push(p);
      });

      // Measure heading→subtitle spacing (margin-bottom on heading element)
      let headingToSubtitleGap = null;
      if (heading) {
        const nextEl = heading.nextElementSibling;
        if (nextEl) {
          const gap = parseInt(window.getComputedStyle(heading).marginBottom) || 0;
          if (gap > 4) headingToSubtitleGap = gap + 'px';
        }
      }

      // Hero canvas layout detection — full-viewport overlay vs column element
      let canvasLayout = null;
      if (type === 'hero') {
        const _heroCanvases = [..._domCanvases, ..._externalCanvases];
        for (const c of _heroCanvases) {
          const cr = c.getBoundingClientRect();
          const ccs = window.getComputedStyle(c);
          const isFullVP = (ccs.position === 'absolute' || ccs.position === 'fixed') &&
            cr.width >= window.innerWidth * 0.75 && cr.height >= window.innerHeight * 0.4;
          if (isFullVP) { canvasLayout = 'full-viewport-overlay'; break; }
          else if (cr.width > 100 && cr.height > 100) { canvasLayout = 'column'; }
        }
        // If canvas is full-viewport overlay, hero layout is centered, not split
        if (canvasLayout === 'full-viewport-overlay' && layout === 'split-columns') {
          layout = 'full-viewport-centered';
        }
      }

      // Hero column analysis — tells LLM which side is text, which is visual
      let heroColumns = null;
      if (type === 'hero' && layout === 'split-columns' && _splitContainer) {
        const secRect = sec.getBoundingClientRect();
        const colChildren = Array.from(_splitContainer.children).filter(c => {
          const r = c.getBoundingClientRect();
          return r.width > 100 && r.height > 50;
        });
        if (colChildren.length >= 2) {
          heroColumns = colChildren.map(col => {
            const r = col.getBoundingClientRect();
            const widthPct = Math.round((r.width / secRect.width) * 100);
            const hasText = !!col.querySelector('h1, h2, p, [class*="heading"], [class*="title"]');
            const hasVisual = !!col.querySelector('img, svg, video, canvas, [class*="visual"], [class*="animation"], [class*="lottie"]');
            const content = hasText && hasVisual ? 'text+visual' : hasText ? 'text' : hasVisual ? 'visual' : 'other';
            return { width: `${widthPct}%`, content };
          });
        }
      }

      // Detect scroll-triggered word-split typography animations
      // (e.g. each word wrapped in <span> with opacity:0 + keyframe on scroll intersection)
      let scrollRevealTypography = null;
      const _srtHeadings = sec.querySelectorAll('h1, h2, h3');
      for (const hEl of _srtHeadings) {
        // Check data attributes first (AOS, ScrollTrigger, data-splitting, etc.)
        if (hEl.dataset.aos || hEl.dataset.animate || hEl.dataset.scroll || hEl.dataset.splitting) {
          scrollRevealTypography = {
            element: hEl.tagName.toLowerCase(),
            wordCount: null,
            animName: hEl.dataset.aos || hEl.dataset.animate || null,
            pattern: 'data-attribute'
          };
          break;
        }
        // Check for split-text spans (word/char-level spans, each animated independently)
        const _srtSpans = Array.from(hEl.querySelectorAll('span'));
        if (_srtSpans.length >= 3) {
          const _hiddenOrAnimated = _srtSpans.filter(sp => {
            const ss = window.getComputedStyle(sp);
            return parseFloat(ss.opacity) < 0.1 ||
                   (ss.animationName && ss.animationName !== 'none') ||
                   (ss.transform !== 'none' && parseFloat(ss.opacity) < 0.5);
          });
          if (_hiddenOrAnimated.length >= 2 || _hiddenOrAnimated.length >= _srtSpans.length * 0.3) {
            const _srtAnimName = _hiddenOrAnimated[0]
              ? window.getComputedStyle(_hiddenOrAnimated[0]).animationName
              : '';
            scrollRevealTypography = {
              element: hEl.tagName.toLowerCase(),
              wordCount: _srtSpans.length,
              animName: _srtAnimName && _srtAnimName !== 'none' ? _srtAnimName.split(',')[0].trim() : null,
              pattern: 'word-split'
            };
            break;
          }
        }
      }

      // ── Hero-only: CTA button dimensions + floating illustration elements ──
      let heroCtaStyle = null;
      let floatingIllustrations = null;
      let entry_floatingPattern = null;
      if (isFirstSection) {
        // Capture the LARGEST filled CTA in the hero (not the nav CTA)
        const _heroBtnCandidates = Array.from(sec.querySelectorAll('a[href], button, [role="button"]'))
          .map(el => {
            try {
              const cs = window.getComputedStyle(el);
              const r = el.getBoundingClientRect();
              const text = (el.innerText || '').trim();
              if (!text || text.length < 2 || r.width < 80 || r.height < 28) return null;
              if (el.closest('nav, header')) return null;
              const hasBg = !isTransparent(cs.backgroundColor);
              return { el, cs, r, text, hasBg, area: r.width * r.height };
            } catch(e) { return null; }
          })
          .filter(Boolean)
          .sort((a, b) => b.area - a.area);
        const _primaryHeroBtn = _heroBtnCandidates.find(b => b.hasBg);
        if (_primaryHeroBtn) {
          const { cs, r } = _primaryHeroBtn;
          heroCtaStyle = {
            width: Math.round(r.width),
            height: Math.round(r.height),
            borderRadius: cs.borderRadius !== '0px' ? cs.borderRadius : '0px',
            padding: cs.padding,
            fontSize: cs.fontSize,
            fontWeight: cs.fontWeight,
            hasIcon: !!_primaryHeroBtn.el.querySelector('svg, img, [class*="icon"]'),
          };
        }

        // Detect floating colored illustration cards (design token samples) scattered around hero
        const _secRH = sec.getBoundingClientRect();
        // Use a broader search — Framer renders floating elements outside the section subtree
        const _coloredAbsEls = Array.from(document.querySelectorAll('div, span, [class*="framer"], [data-framer-component-type]')).filter(el => {
          try {
            const cs = window.getComputedStyle(el);
            const r = el.getBoundingClientRect();
            // Must be within ~300px vertical extension of hero area
            if (r.top > _secRH.bottom + 300 || r.bottom < _secRH.top - 150) return false;
            // Must be a reasonable card/chip size
            if (r.width < 40 || r.height < 30 || r.width > 600 || r.height > 500) return false;
            // Position must be absolute, fixed, or sticky (true floating element)
            // OR element must NOT contain the section itself (to avoid whole-page containers)
            const pos = cs.position;
            const isAbsoluteish = pos === 'absolute' || pos === 'fixed';
            // Check for colored bg — also accept gradient backgrounds
            const bgColor = cs.backgroundColor;
            const bgImage = cs.backgroundImage;
            const hasSolidBg = !isTransparent(bgColor);
            const hasGradientBg = bgImage && bgImage !== 'none' && bgImage.includes('gradient');
            if (!hasSolidBg && !hasGradientBg) return false;
            // For solid backgrounds, validate color is not near-white/near-black/near-gray
            if (hasSolidBg) {
              const bgHex = rgbToHex(bgColor);
              if (!bgHex || bgHex.length < 6) return false;
              const rC = parseInt(bgHex.slice(1,3),16), gC = parseInt(bgHex.slice(3,5),16), bC = parseInt(bgHex.slice(5,7),16);
              const lum = (rC*0.299 + gC*0.587 + bC*0.114) / 255;
              if (lum > 0.95 || lum < 0.05) return false; // truly white or truly black only skip
              if (Math.max(rC,gC,bC) - Math.min(rC,gC,bC) < 20) return false; // near-gray (but allow light colors)
            }
            // Exclude nav, header, buttons
            if (el.closest('nav, header, footer')) return false;
            if (el.tagName === 'BUTTON' || el.tagName === 'A') return false;
            // Don't include huge containers (parent of most content)
            if (el.querySelectorAll('p, h1, h2, h3').length > 3) return false;
            if ((el.innerText || '').trim().length > 150) return false;
            // Must have visible area (not collapsed)
            if (r.width * r.height < 1200) return false;
            return true;
          } catch(e) { return false; }
        });
        if (_coloredAbsEls.length >= 1) {
          // Deduplicate by approximate bg+position — avoid counting nested divs with same color multiple times
          const _seen = new Set();
          const _deduped = _coloredAbsEls.filter(el => {
            const r = el.getBoundingClientRect();
            const cs = window.getComputedStyle(el);
            const bgColor = cs.backgroundColor;
            const hasSolidBg = !isTransparent(bgColor);
            const bg = hasSolidBg ? rgbToHex(bgColor) : 'gradient';
            const key = `${bg}_${Math.round(r.left/40)}_${Math.round(r.top/40)}_${Math.round(r.width/20)}`;
            if (_seen.has(key)) return false;
            _seen.add(key);
            return true;
          });
          if (_deduped.length >= 1) {
            floatingIllustrations = _deduped.slice(0, 8).map(el => {
              const cs = window.getComputedStyle(el);
              const r = el.getBoundingClientRect();
              const hasSolidBg = !isTransparent(cs.backgroundColor);
              const bgHex = hasSolidBg ? rgbToHex(cs.backgroundColor) : 'gradient';
              const text = (el.innerText || '').trim().slice(0, 50) || null;
              const transform = cs.transform;
              const has3D = transform && transform !== 'none' && transform !== 'matrix(1, 0, 0, 1, 0, 0)' && transform.length > 20;
              const relX = (r.left + r.width/2 - _secRH.left) / _secRH.width;
              const relY = (r.top + r.height/2 - _secRH.top) / _secRH.height;
              const isAbsoluteish = cs.position === 'absolute' || cs.position === 'fixed';
              const _w = Math.round(r.width), _h = Math.round(r.height);
              return {
                bg: bgHex,
                bgGradient: (!hasSolidBg && cs.backgroundImage !== 'none') ? cs.backgroundImage.slice(0, 120) : null,
                w: _w,
                h: _h,
                aspectRatio: Math.round((_w / (_h || 1)) * 100) / 100,
                transform: (has3D && transform) ? transform.slice(0, 80) : null,
                pos: `${relX < 0.25 ? 'left' : relX > 0.75 ? 'right' : 'center'}-${relY < 0 ? 'above-hero' : relY > 1 ? 'below-hero' : relY < 0.4 ? 'top' : relY > 0.7 ? 'bottom' : 'mid'}`,
                has3D,
                isFloating: isAbsoluteish,
                radius: cs.borderRadius && cs.borderRadius !== '0px' ? cs.borderRadius.split(' ')[0] : null,
                text: text && text.length > 2 ? text : null,
              };
            });

            // Pattern classification — detect radiating lines vs content cards vs decorative shapes
            if (floatingIllustrations.length >= 3) {
              const _allNarrow = floatingIllustrations.every(il => il.aspectRatio < 0.35 || il.aspectRatio > 3);
              const _allGradient = floatingIllustrations.every(il => il.bg === 'gradient');
              const _heights = floatingIllustrations.map(il => il.h);
              const _maxH = Math.max(..._heights), _minH = Math.min(..._heights);
              const _allSimilarHeight = (_maxH - _minH) / _maxH < 0.15;

              if (_allNarrow && _allGradient && _allSimilarHeight) {
                entry_floatingPattern = 'radiating-lines';
              } else if (floatingIllustrations.length >= 4 && floatingIllustrations.some(il => il.text)) {
                entry_floatingPattern = 'content-cards';
              } else {
                entry_floatingPattern = 'decorative-shapes';
              }
            }
          }
        }
      }

      // Portfolio-split: extract logo grid structure + corner word labels + CTA
      let portfolioGridInfo = null;
      if (type === 'portfolio-split') {
        // Find the grid container (left side — has logos)
        const _logoImgs = Array.from(sec.querySelectorAll('img')).filter(img => {
          const r = img.getBoundingClientRect();
          return r.width > 20 && r.width < 250 && r.height > 10;
        });
        // Extract logo alt/src names
        const _logoNames = _logoImgs
          .map(img => (img.alt || img.src.split('/').pop()?.replace(/[_-]/g,' ').split('.')[0] || '').trim())
          .filter(n => n.length > 1 && n.length < 40)
          .slice(0, 9);
        // Detect grid columns from the parent container
        let _gridCols = 3, _gridRows = 2;
        if (_logoImgs[0]) {
          const _gridParent = _logoImgs[0].closest('[style*="grid"], [class*="grid"]') || _logoImgs[0].parentElement?.parentElement;
          if (_gridParent) {
            const _gcs = window.getComputedStyle(_gridParent);
            const _colParts = (_gcs.gridTemplateColumns || '').split(' ').filter(Boolean);
            const _rowParts = (_gcs.gridTemplateRows || '').split(' ').filter(Boolean);
            if (_colParts.length >= 2) _gridCols = _colParts.length;
            if (_rowParts.length >= 2) _gridRows = _rowParts.length;
          }
        }
        // Detect cell border style
        const _cellBorder = _logoImgs[0]
          ? (() => { const cs = window.getComputedStyle(_logoImgs[0].closest('div, li, [class*="item"], [class*="cell"]') || _logoImgs[0]); return cs.border !== 'none' && cs.border !== '' ? cs.border.slice(0, 60) : null; })()
          : null;
        // Detect corner/scattered word labels on the right half
        const _secR = sec.getBoundingClientRect();
        const _rightThreshold = _secR.left + _secR.width * 0.5;
        const _absLabels = Array.from(sec.querySelectorAll('span, p, div, [class*="label"], [class*="tag"]')).filter(el => {
          const cs = window.getComputedStyle(el);
          const r = el.getBoundingClientRect();
          const txt = el.textContent.trim();
          return (cs.position === 'absolute' || cs.position === 'fixed') &&
                 txt.length >= 1 && txt.length <= 20 &&
                 txt.split(/\s+/).length <= 2 &&
                 r.left >= _rightThreshold;
        }).map(el => el.textContent.trim()).filter(Boolean).slice(0, 6);
        portfolioGridInfo = {
          cols: _gridCols,
          rows: _gridRows,
          logoNames: _logoNames,
          cellBorder: _cellBorder,
          cornerLabels: _absLabels.length >= 2 ? _absLabels : null,
        };
      }

      const entry = {
        type,
        heading: headingText,
        className: (sec.className || '').slice(0, 60),
        layout,
        bgColor: secBgHex,
        gradient: secGradient,
        visualDescriptions: visualDescriptions.length > 0 ? visualDescriptions : null,
        ctas: ctaButtons.length > 0 ? ctaButtons : null,
        arrowLinks: arrowLinks.length > 0 ? arrowLinks : null,
        hasSlider: hasSwiper || false,
        hasNumberedItems,
        steps: stepItems || null,
        eyebrow: eyebrowText || null,
        gridCols: gridCols || null,
        heroColumns: heroColumns || null,
        headingToSubtitleGap: headingToSubtitleGap || null,
        headingColoredWords: headingColoredWords.length > 0 ? headingColoredWords : null,
        decorativeGradients: sectionDecorations.length > 0 ? sectionDecorations : null,
        scrollRevealTypography: scrollRevealTypography || null,
        portfolioGridInfo: portfolioGridInfo || null,
        heroCtaStyle: heroCtaStyle || null,
        canvasLayout: canvasLayout || null,
        floatingIllustrations: floatingIllustrations || null,
        floatingPattern: entry_floatingPattern || null,
        entryCount: sec.querySelectorAll('[class*="entry"], [class*="item"], [class*="card"]').length,
        paddingY: sectionPaddingY ? `${sectionPaddingY}px` : null,
      };

      // Dedup: skip this section if it's a responsive clone of the previous one
      // (same type + same heading text → same content rendered twice for different breakpoints)
      const prev = map[map.length - 1];
      if (prev && prev.type === type && prev.heading && headingText && prev.heading === headingText) {
        continue; // responsive duplicate — skip
      }

      map.push(entry);
    }

    return map;
  }

  // ─── Footer content extraction ──────────────────────────────────────────
  function extractFooterContentMap() {
    const footer = document.querySelector('footer, [class*="footer"], [class*="Footer"]');
    if (!footer) return null;
    const links = Array.from(footer.querySelectorAll('a')).map(a => ({
      text: a.textContent.trim().slice(0, 30),
      href: a.href
    })).filter(l => l.text.length > 0).slice(0, 10);
    const cols = Array.from(footer.querySelectorAll(':scope > div > div, :scope > div')).map(col => {
      const label = col.querySelector('[class*="label"],[class*="uppercase"],[class*="heading"],h3,h4,h5')?.textContent?.trim();
      return { label: label?.slice(0, 30) || null, content: col.textContent.trim().slice(0, 100) };
    }).filter(c => c.content.length > 5).slice(0, 4);
    const cs = window.getComputedStyle(footer);
    return {
      type: 'footer',
      links,
      columns: cols,
      bgColor: !isTransparent(cs.backgroundColor) ? rgbToHex(cs.backgroundColor) : null,
      borderTop: cs.borderTopWidth !== '0px' ? cs.borderTop.slice(0, 60) : null,
    };
  }

  // ─── Sticky-scroll section pattern detection ─────────────────────────────
  function detectStickyScrollSections() {
    const results = [];
    const sections = Array.from(document.querySelectorAll('section, [class*="section"]'));
    for (const sec of sections.slice(0, 15)) {
      const children = Array.from(sec.children).length >= 2 ? Array.from(sec.children) : Array.from(sec.querySelector(':scope > div')?.children || []);
      if (children.length < 2) continue;
      const stickyCol = children.find(c => {
        try { return window.getComputedStyle(c).position === 'sticky'; } catch(e) { return false; }
      });
      if (!stickyCol) continue;
      const scrollCol = children.find(c => c !== stickyCol);
      if (!scrollCol) continue;
      // Count content blocks — use multiple strategies for broader detection
      let blocks = Array.from(scrollCol.querySelectorAll('h2,h3,h4,[class*="block"],[class*="item"],[class*="card"],[class*="feature"],[class*="step"],[class*="benefit"],article'));
      // Fallback: if no semantic blocks found, count direct children with significant height
      if (blocks.length === 0) {
        blocks = Array.from(scrollCol.children).filter(c => {
          const r = c.getBoundingClientRect();
          return r.height > 60 && r.width > 100;
        });
      }
      // Detect tab navigation within the sticky column
      const _tabEls = stickyCol.querySelectorAll('[role="tab"], button, [class*="tab"], [class*="feature-nav"] > *');
      const _tabLabels = Array.from(_tabEls)
        .map(t => t.textContent.trim())
        .filter(t => t.length > 2 && t.length < 60)
        .slice(0, 8);
      results.push({
        type: _tabLabels.length >= 2 ? 'sticky-tab-scroll' : 'sticky-scroll-panel',
        stickyColHasCanvas: !!stickyCol.querySelector('canvas'),
        stickyColHasSvg: !!stickyCol.querySelector('svg'),
        stickyColHasImg: !!stickyCol.querySelector('img'),
        tabLabels: _tabLabels.length >= 2 ? _tabLabels : null,
        scrollBlockCount: blocks.length,
        scrollBlockHeadings: blocks.slice(0, 5).map(b => (b.querySelector('h2,h3,h4')?.textContent || b.textContent || '').trim().slice(0, 40)),
      });
    }
    return results.length > 0 ? results : null;
  }

  // ─── SVG animated diagram + pill-track pattern detection ──────────────────
  function detectSvgDiagramAnimations() {
    const results = [];
    // SVG with animateMotion / animate / many paths+circles = diagram animation
    document.querySelectorAll('svg').forEach(svg => {
      const rect = svg.getBoundingClientRect();
      if (rect.width < 100 || rect.height < 100) return;
      const motionEls = svg.querySelectorAll('animateMotion, animateTransform, animate');
      const paths = svg.querySelectorAll('path');
      const circles = svg.querySelectorAll('circle');
      if (motionEls.length > 0 || (paths.length > 5 && circles.length > 2)) {
        const colors = new Set();
        svg.querySelectorAll('[fill],[stroke]').forEach(el => {
          const f = el.getAttribute('fill');
          const s = el.getAttribute('stroke');
          if (f && f !== 'none' && f !== 'transparent') colors.add(f);
          if (s && s !== 'none' && s !== 'transparent') colors.add(s);
        });
        results.push({
          type: motionEls.length > 0 ? 'svg-path-animation' : 'svg-diagram',
          width: Math.round(rect.width), height: Math.round(rect.height),
          pathCount: paths.length, circleCount: circles.length,
          animationCount: motionEls.length,
          colors: [...colors].slice(0, 6),
          labels: Array.from(svg.querySelectorAll('text')).map(t => t.textContent.trim()).filter(Boolean).slice(0, 8),
          location: rect.top < window.innerHeight ? 'above-fold' : 'below-fold'
        });
      }
    });
    // Pill-track pattern: large pill-shaped elements with animated dots
    const pillTexts = [];
    const _candidates = document.querySelectorAll('[class*="pill"], [class*="tag"], [class*="badge"], [class*="label"], [class*="chip"]');
    for (const el of Array.from(_candidates).slice(0, 30)) {
      try {
        const cs = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const br = parseFloat(cs.borderRadius) || 0;
        const text = el.textContent?.trim();
        if (br > 30 && rect.width > 80 && rect.height > 30 && text && text.length < 30 && el.children.length < 5) {
          pillTexts.push({ text, bg: !isTransparent(cs.backgroundColor) ? rgbToHex(cs.backgroundColor) : 'transparent', border: cs.border?.slice(0, 40), w: Math.round(rect.width), h: Math.round(rect.height) });
        }
      } catch(e) { /* skip */ }
    }
    if (pillTexts.length >= 2) {
      results.push({ type: 'pill-track-diagram', pills: pillTexts.slice(0, 8) });
    }
    return results.length > 0 ? results : null;
  }

  // ─── Section background geometric decorations (absolute SVG) ──────────────
  function detectSectionBackgroundDecorations() {
    const results = [];
    const sections = document.querySelectorAll('section, [class*="section"]');
    for (const section of Array.from(sections).slice(0, 10)) {
      const sectionRect = section.getBoundingClientRect();
      if (sectionRect.height < 100) continue;
      const decorSvgs = Array.from(section.querySelectorAll('svg')).filter(svg => {
        try {
          const cs = window.getComputedStyle(svg);
          const parent = svg.parentElement;
          const parentCs = parent ? window.getComputedStyle(parent) : null;
          const isAbsPositioned = cs.position === 'absolute' || (parentCs && parentCs.position === 'absolute');
          const isBackground = parseInt(cs.zIndex) <= 0 || svg.getAttribute('aria-hidden') === 'true' || cs.pointerEvents === 'none';
          const rect = svg.getBoundingClientRect();
          return (isAbsPositioned || isBackground) && rect.width > sectionRect.width * 0.25 && rect.height > 50;
        } catch(e) { return false; }
      }).map(svg => {
        const paths = svg.querySelectorAll('path');
        const lines = svg.querySelectorAll('line');
        const rect = svg.getBoundingClientRect();
        const colors = new Set();
        svg.querySelectorAll('[stroke],[fill]').forEach(el => {
          const s = el.getAttribute('stroke');
          const f = el.getAttribute('fill');
          if (s && s !== 'none' && s !== 'transparent') colors.add(s);
          if (f && f !== 'none' && f !== 'transparent') colors.add(f);
        });
        return {
          w: Math.round(rect.width), h: Math.round(rect.height),
          pathCount: paths.length, lineCount: lines.length,
          type: paths.length > 4 && rect.width > 200 ? 'radial-rays' : lines.length > 2 ? 'grid-lines' : 'organic-curves',
          colors: [...colors].slice(0, 4),
          opacity: window.getComputedStyle(svg).opacity
        };
      });
      if (decorSvgs.length > 0) {
        const bg = window.getComputedStyle(section).backgroundColor;
        results.push({ sectionBg: !isTransparent(bg) ? rgbToHex(bg) : null, decorations: decorSvgs.slice(0, 3) });
      }
    }
    return results.length > 0 ? results : null;
  }

  // ─── Contact section detection (CTA/contact before footer) ──────────────
  function detectContactSection() {
    const allSections = Array.from(document.querySelectorAll('section, [class*="section"]'));
    const lastSections = allSections.slice(-3);
    for (const sec of lastSections) {
      const hasContactSignals =
        /contact|get.?in.?touch|let.?s.?talk|reach.?out|say.?hello/i.test(sec.textContent) ||
        sec.querySelector('input[type="email"], input[type="text"], textarea') !== null;
      if (hasContactSignals) {
        const cs = window.getComputedStyle(sec);
        return {
          type: 'contact',
          heading: sec.querySelector('h1,h2,h3')?.textContent?.trim()?.slice(0, 60) || null,
          eyebrow: sec.querySelector('[class*="label"],[class*="eyebrow"],[class*="overline"]')?.textContent?.trim() || null,
          hasBgAnimation: !!sec.querySelector('canvas, svg[class*="anim"]'),
          bgColor: !isTransparent(cs.backgroundColor) ? rgbToHex(cs.backgroundColor) : null,
          ctas: Array.from(sec.querySelectorAll('a,button')).map(el => el.textContent.trim().slice(0, 30)).filter(t => t.length > 1).slice(0, 3),
        };
      }
    }
    return null;
  }

  // ─── Form/input field style extraction ────────────────────────────────────
  function extractInputStyles() {
    const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], input[type="search"], input:not([type]), textarea, select');
    for (const el of Array.from(inputs).slice(0, 5)) {
      try {
        const rect = el.getBoundingClientRect();
        if (rect.width < 60 || rect.height < 20) continue;
        const cs = window.getComputedStyle(el);
        const bg = cs.backgroundColor;
        return {
          backgroundColor: !isTransparent(bg) ? rgbToHex(bg) : null,
          color: rgbToHex(cs.color),
          border: cs.borderWidth !== '0px' ? cs.border : null,
          borderRadius: cs.borderRadius !== '0px' ? cs.borderRadius : null,
          padding: cs.padding,
          fontSize: cs.fontSize,
          fontFamily: cleanFont(cs.fontFamily),
          height: cs.height !== 'auto' ? cs.height : null,
          placeholderColor: null, // can't reliably extract ::placeholder
        };
      } catch(e) { console.debug('[VibeDesign]', e.message); }
    }
    return null;
  }

  // ─── Gradient value extraction ──────────────────────────────────────────────
  function extractGradients() {
    const gradients = [];
    const seen = new Set();
    const candidates = document.querySelectorAll('section, [class*="hero"], [class*="gradient"], [class*="bg-"], header, footer, main > div');
    for (const el of Array.from(candidates).slice(0, 30)) {
      try {
        const elCs = window.getComputedStyle(el);
        const bg = elCs.backgroundImage;
        if (!bg || bg === 'none') continue;
        // Extract gradient functions only
        const matches = bg.match(/(linear-gradient|radial-gradient|conic-gradient)\([^)]+(?:\([^)]*\))*[^)]*\)/g);
        if (matches) {
          for (const g of matches) {
            // Skip noise/texture URLs and very short gradients
            if (g.length < 30 || seen.has(g)) continue;
            seen.add(g);
            const rect = el.getBoundingClientRect();
            const gradientColors = (g.match(/#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)/g) || []).slice(0, 5);
            // Check for animated gradient pattern (oversized background-size + animation)
            const bgSize = elCs.backgroundSize;
            const hasOversizedBg = bgSize && (/\d{3,}%/.test(bgSize) || parseInt(bgSize) >= 200);
            const hasAnim = elCs.animationName && elCs.animationName !== 'none';
            const isAnimated = !!(hasOversizedBg && hasAnim);
            gradients.push({
              value: g.length > 200 ? g.slice(0, 200) + '...' : g,
              element: el.tagName.toLowerCase(),
              colors: gradientColors,
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              isAnimated: isAnimated,
              animationDuration: isAnimated ? elCs.animationDuration : null,
            });
          }
        }
      } catch(e) { console.debug('[VibeDesign]', e.message); }
    }
    return gradients.slice(0, 4);
  }

  // ─── Image visual property extraction ───────────────────────────────────────
  function extractImageStyles() {
    const imgs = document.querySelectorAll('img');
    const styles = [];
    for (const img of Array.from(imgs).slice(0, 10)) {
      try {
        const rect = img.getBoundingClientRect();
        if (rect.width < 80 || rect.height < 80) continue;
        const cs = window.getComputedStyle(img);
        const br = cs.borderRadius;
        const objectFit = cs.objectFit !== 'fill' ? cs.objectFit : null;
        // Filter out lazy-load blur placeholders (blur(5px), blur(10px), blur(20px))
        const rawFilter = cs.filter !== 'none' ? cs.filter : null;
        const filter = rawFilter && !(/^blur\(\d+px\)$/.test(rawFilter)) ? rawFilter : null;
        const border = cs.borderWidth !== '0px' ? cs.border : null;
        const shadow = cs.boxShadow !== 'none' ? cs.boxShadow : null;
        const aspectRatio = rect.width > 0 ? Math.round((rect.height / rect.width) * 100) / 100 : null;
        if (br !== '0px' || objectFit || filter || border || shadow) {
          styles.push({ borderRadius: br !== '0px' ? br : null, objectFit, filter, border, boxShadow: shadow, aspectRatio });
        }
      } catch(e) { console.debug('[VibeDesign]', e.message); }
    }
    // Return the most representative pattern (prefer non-blurred images)
    if (styles.length === 0) return null;
    const nonBlurred = styles.find(s => !s.filter);
    return nonBlurred || styles[0];
  }

  // ─── Link/anchor style extraction ───────────────────────────────────────────
  function extractLinkStyles() {
    const links = document.querySelectorAll('a:not([class*="btn"]):not([class*="button"]):not([class*="nav"])');
    for (const link of Array.from(links).slice(0, 20)) {
      try {
        const text = (link.innerText || '').trim();
        if (text.length < 3 || text.length > 60) continue;
        const rect = link.getBoundingClientRect();
        if (rect.width === 0) continue;
        const cs = window.getComputedStyle(link);
        const color = rgbToHex(cs.color);
        const textDecoration = cs.textDecorationLine || cs.textDecoration;
        const hasUnderline = textDecoration && textDecoration.includes('underline');
        return {
          color,
          textDecoration: hasUnderline ? 'underline' : 'none',
          textDecorationColor: hasUnderline && cs.textDecorationColor ? rgbToHex(cs.textDecorationColor) : null,
          textUnderlineOffset: cs.textUnderlineOffset !== 'auto' ? cs.textUnderlineOffset : null,
          fontWeight: cs.fontWeight,
        };
      } catch(e) { console.debug('[VibeDesign]', e.message); }
    }
    return null;
  }

  // ─── Footer style extraction ────────────────────────────────────────────────
  function extractFooterStyles() {
    const footer = document.querySelector('footer');
    if (!footer) return null;
    try {
      const cs = window.getComputedStyle(footer);
      const bg = cs.backgroundColor;
      const bgHex = !isTransparent(bg) ? rgbToHex(bg) : null;
      const rect = footer.getBoundingClientRect();
      // Count columns in footer
      const cols = footer.querySelectorAll(':scope > div, :scope > section, :scope > nav').length;
      // Check for border-top
      const borderTop = cs.borderTopWidth !== '0px' ? cs.borderTop : null;
      return {
        backgroundColor: bgHex,
        color: rgbToHex(cs.color),
        padding: cs.padding,
        borderTop,
        columns: cols > 1 ? cols : null,
        gap: cs.gap !== 'normal' ? cs.gap : null,
      };
    } catch(e) { console.debug('[VibeDesign]', e.message); }
    return null;
  }

  // ─── Font weight usage extraction ───────────────────────────────────────────
  function extractFontWeights() {
    const weights = new Set();
    const textEls = document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,a,button,li,label,strong,em');
    for (const el of Array.from(textEls).slice(0, 100)) {
      try {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const w = window.getComputedStyle(el).fontWeight;
        if (w) weights.add(w);
      } catch(e) { console.debug('[VibeDesign]', e.message); }
    }
    return [...weights].sort((a, b) => parseInt(a) - parseInt(b));
  }

  function detectActualPageBackground() {
    function getBgHex(el) {
      try {
        const bg = window.getComputedStyle(el).backgroundColor;
        if (isTransparent(bg)) return null;
        return rgbToHex(bg);
      } catch(e) { return null; }
    }

    // hexLum moved to lib/color-utils.js — destructured at top of IIFE.

    // ── Step 0: Text color cross-check ──
    // Sample content text color (h1, h2, p) rather than document.body.color.
    // body.color is often the browser default #000 even on dark sites where text is white on child elements.
    // Dark text (luminance < 0.3) = light page.  Light text (luminance > 0.7) = dark page.
    function getBodyTextLuminance() {
      function colorLum(cssColor) {
        const m = (cssColor||'').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!m) return null;
        return (0.299*parseInt(m[1]) + 0.587*parseInt(m[2]) + 0.114*parseInt(m[3])) / 255;
      }
      // Priority: first visible heading or paragraph — these have explicit color set by the designer
      const samplers = ['h1','h2','main p','section p','[class*="hero"] p','[class*="hero"] h1'];
      for (const sel of samplers) {
        try {
          const el = document.querySelector(sel);
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          const cs = window.getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          const lum = colorLum(cs.color);
          // Only trust a clear signal (not mid-gray browser defaults)
          if (lum !== null && (lum < 0.2 || lum > 0.7)) return lum;
        } catch(e) { console.debug('[VibeDesign]', e.message); }
      }
      // Fallback: body element color
      try {
        const lum = colorLum(window.getComputedStyle(document.body).color);
        if (lum !== null) return lum;
      } catch(e) { console.debug('[VibeDesign]', e.message); }
      return 0.5; // unknown
    }

    const bodyTextLum = getBodyTextLuminance();

    // ── Step 1: Count transparent vs explicit-bg sections ──
    const sectionEls = document.querySelectorAll(
      'section, main > div, [class*="section"], [class*="hero"]'
    );
    let transparentSections = 0;
    let explicitBgSections = 0;
    for (const sec of Array.from(sectionEls).slice(0, 20)) {
      try {
        const rect = sec.getBoundingClientRect();
        if (rect.width < window.innerWidth * 0.5 || rect.height < 100) continue;
        const bg = window.getComputedStyle(sec).backgroundColor;
        if (isTransparent(bg)) transparentSections++;
        else explicitBgSections++;
      } catch(e) { console.debug('[VibeDesign]', e.message); }
    }

    // If most sections are transparent AND body text is dark → page is light (browser default white)
    const mostSectionsTransparent = transparentSections > explicitBgSections * 2;

    // ── Step 2: Area-based scan of elements with explicit backgrounds ──
    const areaByColor = {};

    // Always include html element (some sites set bg only on <html>)
    const htmlBgEarly = getBgHex(document.documentElement);
    if (htmlBgEarly) {
      // html covers the entire page — give it the viewport area as weight
      areaByColor[htmlBgEarly] = window.innerWidth * window.innerHeight;
    }

    const candidates = document.querySelectorAll(
      'body, main, article, section, [class*="section"], [class*="hero"], ' +
      '[class*="page"], [class*="container"], [class*="wrapper"], #__next, #root, #app'
    );

    for (const el of Array.from(candidates).slice(0, 40)) {
      try {
        const rect = el.getBoundingClientRect();
        if (rect.width < window.innerWidth * 0.5) continue;
        if (rect.height < 100) continue;

        const hex = getBgHex(el);
        if (!hex) continue;

        const visTop = Math.max(0, rect.top);
        const visBot = Math.min(window.innerHeight * 3, rect.bottom);
        const visHeight = Math.max(0, visBot - visTop);
        const area = rect.width * visHeight;
        if (area <= 0) continue;

        areaByColor[hex] = (areaByColor[hex] || 0) + area;
      } catch(e) { console.debug('[VibeDesign]', e.message); }
    }

    const sorted = Object.entries(areaByColor)
      .filter(([hex]) => hexLum(hex) > 0.01)
      .sort(([, a], [, b]) => b - a);

    // ── Step 3: Cross-check result against text color ──
    if (sorted.length > 0) {
      const dominantHex = sorted[0][0];
      const dominantLum = hexLum(dominantHex);

      // CONFLICT CHECK: dominant bg is dark but body text is also dark?
      // This means the detected bg is from a sub-section, not the main page.
      // Example: site has transparent body + one dark section → detected as dark,
      // but default text is black → page is actually light.
      if (dominantLum < 0.25 && bodyTextLum < 0.3) {
        // Dark bg detected but dark text → OVERRIDE: page is light.
        // If most sections are transparent, the real bg is white (browser default).
        if (mostSectionsTransparent) {
          return '#ffffff';
        }
        // Look for a light color in the sorted list
        const lightEntry = sorted.find(([hex]) => hexLum(hex) > 0.5);
        if (lightEntry) return lightEntry[0];
        return '#ffffff'; // safe fallback — dark text means light bg
      }

      // CONFLICT CHECK: dominant bg is light but body text is also light?
      // Unlikely but handle: dark page with one large light section.
      if (dominantLum > 0.75 && bodyTextLum > 0.7) {
        const darkEntry = sorted.find(([hex]) => hexLum(hex) < 0.3);
        if (darkEntry) return darkEntry[0];
      }

      return dominantHex;
    }

    // ── Step 4: No explicit bg from sections — check html/body directly ──
    // Many sites set background on <html> (not on sections or body).
    const htmlBg = getBgHex(document.documentElement);
    const bodyBg = getBgHex(document.body);
    if (htmlBg) return htmlBg;
    if (bodyBg) return bodyBg;

    // CSS variable fallback
    const rootStyle = getComputedStyle(document.documentElement);
    const bgVarNames = ['--background','--bg','--page-bg','--bg-color','--color-bg','--surface'];
    for (const v of bgVarNames) {
      const val = rootStyle.getPropertyValue(v).trim();
      if (val && /^#[0-9a-f]{3,8}$/i.test(val)) return val;
    }

    // Final fallback: infer from text color
    // Dark text → light page, light text → dark page
    if (bodyTextLum < 0.3) return '#ffffff';
    if (bodyTextLum > 0.7) return '#111111';
    return '#ffffff';
  }

  // ─── Deep visual profile extraction ─────────────────────────────────────────
  function extractVisualProfile() {
    const profile = {
      sectionRhythm: [],         // per-section bg color + has-image signal
      hasFullBleedImages: false,
      hasBackgroundImages: false,
      hasMeshGradient: false,
      hasGlassmorphism: false,
      blendModes: [],             // mix-blend-mode values used on the page
      hasFloatingCards: false,
      hasParallaxHint: false,
      hasScrollAnimation: false,
      hasNoiseTexture: false,    // grainy/noise SVG or CSS grain overlay
      imageTreatment: 'none',    // 'cinematic' | 'illustrative' | 'screenshot' | 'none'
      sectionColorPattern: 'unknown', // 'alternating' | 'progressive-dark' | 'uniform-light' | 'uniform-dark'
      dominantSectionBg: null,
      hasOverlaidUIOnPhoto: false,
      navStyle: 'default',       // 'transparent-hero' | 'frosted' | 'solid'
      hasGradientSection: false,
      gradientStyle: null,       // 'aurora' | 'mesh' | 'linear' | 'radial'
      textOnImageCount: 0,
      splitLayoutCount: 0,       // text-left image-right sections
    };

    // ── Scan top-level sections ──
    const sectionEls = document.querySelectorAll(
      'section, [class*="section"], [class*="block"], [class*="row"], main > div, article > div'
    );

    const sectionData = [];
    let darkCount = 0, lightCount = 0;
    const sectionPaddingsY = [];
    const sectionPaddingsX = [];
    const gridGaps = [];

    for (const sec of Array.from(sectionEls).slice(0, 20)) {
      const cs = window.getComputedStyle(sec);
      const rect = sec.getBoundingClientRect();
      if (rect.height < 80 || rect.width < 200) continue;

      // Collect spacing data
      const pTop = parseInt(cs.paddingTop);
      const pBot = parseInt(cs.paddingBottom);
      const pLeft = parseInt(cs.paddingLeft);
      if (pTop > 20 && pTop < 300) sectionPaddingsY.push(pTop);
      if (pBot > 20 && pBot < 300) sectionPaddingsY.push(pBot);
      if (pLeft > 10 && pLeft < 200) sectionPaddingsX.push(pLeft);
      const gapVal = parseInt(cs.gap);
      if (gapVal > 0 && gapVal < 200) gridGaps.push(gapVal);

      const bg = cs.backgroundColor;
      const bgImg = cs.backgroundImage;
      const hex = bg && !isTransparent(bg) ? rgbToHex(bg) : null;

      const secInfo = {
        bgHex: hex,
        hasBackgroundImage: bgImg && bgImg !== 'none',
        hasChildImages: !!sec.querySelector('img, video'),
        hasGradient: bgImg && (bgImg.includes('gradient') || bgImg.includes('linear') || bgImg.includes('radial')),
        height: Math.round(rect.height),
        width: Math.round(rect.width),
        isFullBleed: rect.width >= window.innerWidth * 0.9,
        hasOverlay: !!sec.querySelector('[class*="overlay"],[class*="mask"],[style*="position: absolute"]'),
      };

      // Check for glassmorphism within section
      const sectionChildren = sec.querySelectorAll('*');
      for (const child of Array.from(sectionChildren).slice(0, 30)) {
        const ccs = window.getComputedStyle(child);
        if (ccs.backdropFilter && ccs.backdropFilter !== 'none') {
          profile.hasGlassmorphism = true;
        }
        const bm = ccs.mixBlendMode;
        if (bm && bm !== 'normal') profile.blendModes.push(bm);
        if (ccs.position === 'absolute' || ccs.position === 'fixed') {
          const childBg = ccs.backgroundColor;
          if (!isTransparent(childBg) && !!sec.querySelector('img,video')) {
            profile.hasOverlaidUIOnPhoto = true;
          }
        }
      }
      profile.blendModes = [...new Set(profile.blendModes)];

      // Track dark/light
      if (hex) {
        const lum = hexLuminanceFromRgb(bg);
        if (lum < 0.2) darkCount++;
        else if (lum > 0.75) lightCount++;
      }

      sectionData.push(secInfo);
    }

    profile.sectionRhythm = sectionData.slice(0, 10);

    // ── Spacing system ──
    {
      const median = arr => { if (!arr.length) return null; const s = [...arr].sort((a,b)=>a-b); return s[Math.floor(s.length/2)]; };
      const mPadY = median(sectionPaddingsY);
      const mPadX = median(sectionPaddingsX);
      const mGap = median(gridGaps);

      // Find container max-width
      let containerMaxWidth = null;
      const containers = document.querySelectorAll('main, [class*="container"], [class*="wrapper"], [class*="content"]');
      for (const c of Array.from(containers).slice(0, 10)) {
        try {
          const cCs = window.getComputedStyle(c);
          const mw = cCs.maxWidth;
          if (mw && mw !== 'none' && mw !== '0px') { containerMaxWidth = mw; break; }
        } catch(e) { console.debug('[VibeDesign]', e.message); }
      }

      // Card gap — look for grid/flex containers with multiple card children
      let cardGap = null;
      const cardContainers = document.querySelectorAll('[class*="grid"], [class*="cards"], [class*="features"]');
      for (const cc of Array.from(cardContainers).slice(0, 5)) {
        try {
          const ccCs = window.getComputedStyle(cc);
          const g = parseInt(ccCs.gap);
          if (g > 0 && g < 100 && cc.children.length >= 2) { cardGap = g + 'px'; break; }
        } catch(e) { console.debug('[VibeDesign]', e.message); }
      }

      profile.spacingSystem = {
        sectionPaddingY: mPadY ? mPadY + 'px' : null,
        sectionPaddingX: mPadX ? mPadX + 'px' : null,
        containerMaxWidth,
        gridGap: mGap ? mGap + 'px' : null,
        cardGap,
      };
    }

    // ── Section color pattern ──
    // Key insight: many sections have transparent/inherited backgrounds,
    // so darkCount+lightCount can be low even on a clearly light page.
    // Use body text color luminance as the primary tiebreaker — it's the most reliable
    // signal when backgrounds are transparent/inherited.
    const pageBgLumForPattern = (() => {
      // First check body background-color
      const bodyBg = window.getComputedStyle(document.body).backgroundColor;
      if (!isTransparent(bodyBg)) {
        const m = bodyBg.match(/\d+/g);
        if (m) return (0.299*+m[0] + 0.587*+m[1] + 0.114*+m[2]) / 255;
      }
      // Fallback: infer from body text color (dark text = light page, light text = dark page)
      try {
        const bodyColor = window.getComputedStyle(document.body).color;
        const cm = bodyColor.match(/\d+/g);
        if (cm) {
          const textLum = (0.299*+cm[0] + 0.587*+cm[1] + 0.114*+cm[2]) / 255;
          // Invert: dark text → page is light (lum ~0.9), light text → page is dark (lum ~0.1)
          return textLum < 0.3 ? 0.9 : textLum > 0.7 ? 0.1 : 0.5;
        }
      } catch(e) { console.debug('[VibeDesign]', e.message); }
      return 0.9; // default light if unknown
    })();

    // Count transparent sections — they inherit from the page bg
    const transparentSectionCount = sectionData.filter(s => !s.bgHex).length;
    const totalSectionCount = sectionData.length;
    const mostTransparent = transparentSectionCount > totalSectionCount * 0.6;

    // If most sections are transparent and page bg is light, treat transparent sections as light
    if (mostTransparent && pageBgLumForPattern > 0.6) {
      lightCount += transparentSectionCount;
    } else if (mostTransparent && pageBgLumForPattern < 0.3) {
      darkCount += transparentSectionCount;
    }

    if (darkCount > 2 && lightCount > 2) {
      profile.sectionColorPattern = 'alternating';
    } else if (darkCount > lightCount * 2 && darkCount > 2) {
      profile.sectionColorPattern = 'uniform-dark';
    } else if (lightCount > darkCount * 2 || (darkCount === 0 && pageBgLumForPattern > 0.6)) {
      profile.sectionColorPattern = 'uniform-light';
    } else if (darkCount > 0 && lightCount > 0 && darkCount <= lightCount) {
      // More light than dark — probably light with one dark CTA section = progressive
      profile.sectionColorPattern = 'progressive-dark';
    } else if (pageBgLumForPattern < 0.3) {
      profile.sectionColorPattern = 'uniform-dark';
    } else {
      profile.sectionColorPattern = 'uniform-light';
    }

    // ── Image usage analysis ──
    // More conservative cinematic detection — avoid false positives from large logos/diagrams
    const allImgs = document.querySelectorAll('img');
    let cinematicCount = 0, screenshotCount = 0, illustrationCount = 0;
    let maxImgArea = 0;

    for (const img of Array.from(allImgs).slice(0, 30)) {
      const rect = img.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > maxImgArea) maxImgArea = area;

      const src = (img.src || img.currentSrc || '').toLowerCase();
      const alt = (img.alt || '').toLowerCase();
      const cls = (img.className || '').toLowerCase();
      const parentCls = (img.closest('section,div')?.className || '').toLowerCase();

      // Skip logo images (often large but not "cinematic")
      const isLogo = /logo|brand|partner|client|customer|icon/.test(src + alt + cls + parentCls);
      if (isLogo) continue;

      // Skip very wide but short images (banners, strips)
      const aspectRatio = rect.height / rect.width;
      if (aspectRatio < 0.2) continue;

      // Cinematic: large, fills significant viewport, and NOT a product screenshot
      const fillsViewport = rect.width > window.innerWidth * 0.5 && rect.height > 300;
      const hasOverlay = img.closest('[class*="hero"],[class*="banner"],[class*="cover"]');
      const isInDarkSection = (() => {
        const sec = img.closest('section,[class*="section"]');
        if (!sec) return false;
        const bg = window.getComputedStyle(sec).backgroundColor;
        if (isTransparent(bg)) return false;
        const m = bg.match(/\d+/g);
        return m ? (0.299*+m[0] + 0.587*+m[1] + 0.114*+m[2]) / 255 < 0.3 : false;
      })();

      if (fillsViewport && (hasOverlay || isInDarkSection)) cinematicCount++;

      // Screenshot: UI-like aspect ratio (~16:9 to 4:3 of desktop), in a feature section
      if (rect.width > 200 && aspectRatio > 0.5 && aspectRatio < 0.85) screenshotCount++;
      if (src.includes('illustration') || src.includes('hero-img') || src.includes('graphic')) illustrationCount++;
    }

    profile.hasFullBleedImages = maxImgArea > (window.innerWidth * window.innerHeight * 0.4);
    profile.hasBackgroundImages = sectionData.some(s => s.hasBackgroundImage);

    // Only declare cinematic if genuinely large + dark/overlay context
    if (cinematicCount > 1) profile.imageTreatment = 'cinematic';
    else if (screenshotCount > 2) profile.imageTreatment = 'screenshot';
    else if (illustrationCount > 0) profile.imageTreatment = 'illustrative';
    // cinematicCount === 1 alone is NOT enough — could be a product screenshot in dark section

    // ── Gradient detection ──
    const allEls = document.querySelectorAll('*');
    for (const el of Array.from(allEls).slice(0, 300)) {
      try {
        const cs = window.getComputedStyle(el);
        const bg = cs.backgroundImage;
        if (!bg || bg === 'none') continue;
        if (bg.includes('gradient')) {
          profile.hasGradientSection = true;
          // Try to classify gradient style
          const colorCount = (bg.match(/#[0-9a-f]{3,8}|rgb/gi) || []).length;
          const rect = el.getBoundingClientRect();
          if (colorCount >= 4 && rect.width > 600) {
            profile.gradientStyle = 'aurora'; // multi-color wide gradient
          } else if (bg.includes('radial-gradient') && colorCount >= 3) {
            profile.gradientStyle = 'mesh';
          } else if (bg.includes('linear-gradient')) {
            profile.gradientStyle = profile.gradientStyle || 'linear';
          }
        }
      } catch(e) { console.debug('[VibeDesign]', e.message); }
    }

    // ── Nav style detection ──
    const nav = document.querySelector('nav, header');
    if (nav) {
      const navCs = window.getComputedStyle(nav);
      if (navCs.backdropFilter && navCs.backdropFilter !== 'none') {
        profile.navStyle = 'frosted';
      } else if (isTransparent(navCs.backgroundColor)) {
        profile.navStyle = 'transparent-hero';
      } else {
        profile.navStyle = 'solid';
      }
    }

    // ── Split layout detection ──
    const splitSections = document.querySelectorAll(
      '[class*="split"],[class*="two-col"],[class*="grid-2"],[class*="flex-row"]'
    );
    // Also count sections where we see img + text siblings in a flex/grid
    let splitCount = splitSections.length;
    for (const sec of Array.from(sectionEls).slice(0, 20)) {
      const cs = window.getComputedStyle(sec);
      if ((cs.display === 'flex' || cs.display === 'grid') && sec.children.length === 2) {
        const hasImg = sec.querySelector('img');
        const hasText = sec.querySelector('h1,h2,h3,p');
        if (hasImg && hasText) splitCount++;
      }
    }
    profile.splitLayoutCount = Math.min(splitCount, 20);

    // ── Text-on-image detection ──
    for (const sec of sectionData) {
      if (sec.hasBackgroundImage || sec.hasChildImages) {
        const secEl = Array.from(sectionEls)[sectionData.indexOf(sec)];
        if (secEl && secEl.querySelector('h1,h2,h3,p')) profile.textOnImageCount++;
      }
    }

    // ── Animation pattern detection ──
    const dataAttribs = document.querySelectorAll('[data-aos],[data-animate],[data-scroll],[class*="animate"],[class*="reveal"],[class*="fade-in"]');
    profile.hasScrollAnimation = dataAttribs.length > 0;

    const allClasses = Array.from(document.querySelectorAll('[class]')).map(el => el.className.toString()).join(' ');
    if (allClasses.includes('is-visible') || allClasses.includes('in-view') || allClasses.includes('animated')) {
      profile.hasScrollAnimation = true;
    }

    // Detailed animation patterns
    profile.animationPatterns = {
      hasTextReveal: false,       // text typing / reveal / mask animation
      hasMaskReveal: false,       // clip-path or mask-based scroll reveals
      hasSlider: false,           // Swiper or carousel slider
      sliderType: null,           // 'swiper' | 'scroll-snap' | 'custom'
      hasArrowAnimation: false,   // arrow slides on hover
      hasHeroAnimation: false,    // animated hero (typing, rotation, etc.)
      hasCounterAnimation: false, // animated numbers
      hasStaggerReveal: false,    // staggered entry of child elements
    };

    // Text reveal / typing animation
    if (allClasses.includes('animated-text') || allClasses.includes('typewriter') ||
        allClasses.includes('typing') || allClasses.includes('text-rotate') ||
        allClasses.includes('text-animation') || allClasses.includes('text-reveal')) {
      profile.animationPatterns.hasTextReveal = true;
      profile.animationPatterns.hasHeroAnimation = true;
    }

    // Mask reveal animation
    if (allClasses.includes('reveal-mask') || allClasses.includes('clip-reveal') ||
        allClasses.includes('mask-reveal') || allClasses.includes('overflow-reveal')) {
      profile.animationPatterns.hasMaskReveal = true;
      profile.hasScrollAnimation = true;
    }

    // Slider detection
    const swiperEls = document.querySelectorAll('.swiper, .swiper-slide, [class*="slider"], [class*="carousel"]');
    if (swiperEls.length > 0) {
      profile.animationPatterns.hasSlider = true;
      profile.animationPatterns.sliderType = document.querySelector('.swiper, .swiper-slide') ? 'swiper' : 'custom';
    }

    // Arrow animation on buttons/links
    const arrowWrappers = document.querySelectorAll('[class*="arrow"], [class*="link-arrow"], [class*="cta-arrow"]');
    if (arrowWrappers.length >= 2) {
      profile.animationPatterns.hasArrowAnimation = true;
    }

    // Staggered reveal
    if (allClasses.includes('stagger') || allClasses.includes('delay-') ||
        document.querySelectorAll('[style*="animation-delay"],[style*="transition-delay"]').length >= 3) {
      profile.animationPatterns.hasStaggerReveal = true;
    }

    // ── Noise / grain texture detection ──
    {
      const noiseEls = document.querySelectorAll(
        '[class*="noise"], [class*="grain"], [class*="texture"], [class*="film-grain"]'
      );
      if (noiseEls.length > 0) {
        profile.hasNoiseTexture = true;
      } else {
        // Check for noise SVG backgrounds on major containers
        const containers = [document.body, document.documentElement,
          ...Array.from(document.querySelectorAll('body > div, main, [class*="wrapper"]')).slice(0, 5)];
        for (const el of containers) {
          try {
            const bg = window.getComputedStyle(el).backgroundImage;
            if (bg && bg !== 'none' && (bg.includes('noise') || bg.includes('grain'))) {
              profile.hasNoiseTexture = true;
              break;
            }
          } catch(e) { console.debug('[VibeDesign]', e.message); }
        }
      }
    }

    // ── Parallax detection ──
    {
      let parallaxFound = false;
      const parallaxDetails = [];

      // 1. background-attachment: fixed
      const bgFixedCandidates = document.querySelectorAll('section, div, [class*="hero"], [class*="banner"]');
      for (const el of Array.from(bgFixedCandidates).slice(0, 30)) {
        try {
          if (window.getComputedStyle(el).backgroundAttachment === 'fixed') {
            parallaxFound = true;
            parallaxDetails.push({ method: 'background-attachment-fixed', element: el.tagName.toLowerCase() });
            break;
          }
        } catch(e) { console.debug('[VibeDesign]', e.message); }
      }

      // 2. data-scroll-speed / data-rellax-speed attributes
      const speedEls = document.querySelectorAll('[data-scroll-speed], [data-rellax-speed], [data-speed]');
      if (speedEls.length > 0) {
        parallaxFound = true;
        for (const el of Array.from(speedEls).slice(0, 5)) {
          const speed = el.getAttribute('data-scroll-speed') || el.getAttribute('data-rellax-speed') || el.getAttribute('data-speed');
          parallaxDetails.push({ method: 'data-attribute', speed: speed, element: el.tagName.toLowerCase() });
        }
      }

      // 3. Class-based parallax indicators
      const parallaxClassEls = document.querySelectorAll('[class*="parallax"], [class*="Parallax"]');
      if (parallaxClassEls.length > 0) {
        parallaxFound = true;
        parallaxDetails.push({ method: 'class-based', count: parallaxClassEls.length });
      }

      // 4. perspective / translateZ usage on layers
      const transformCandidates = document.querySelectorAll('section, div, [class*="layer"], [class*="bg"]');
      for (const el of Array.from(transformCandidates).slice(0, 30)) {
        try {
          const cs = window.getComputedStyle(el);
          if (cs.perspective !== 'none' || (cs.transform && cs.transform.includes('matrix3d'))) {
            parallaxFound = true;
            parallaxDetails.push({ method: 'transform-3d', element: el.tagName.toLowerCase() });
            break;
          }
        } catch(e) { console.debug('[VibeDesign]', e.message); }
      }

      if (parallaxFound) {
        profile.hasParallaxHint = true;
        profile.parallaxDetails = parallaxDetails.slice(0, 4);
      }
    }

    // ── UI Pattern Detection ──
    profile.uiPatterns = detectUIPatterns();

    return profile;
  }

  function detectUIPatterns() {
    const patterns = {
      hasMarquee: false,
      hasPricingGrid: false,
      pricingColumnCount: 0,
      hasTestimonialCarousel: false,
      hasDualCTA: false,         // QR code + button side by side
      hasQRCode: false,
      hasStickyNav: false,
      hasLogoStrip: false,
      hasFeatureList: false,     // icon + text list items
      hasStepIndicator: false,   // numbered steps
      hasDarkFooter: false,
      hasVideoSection: false,
      hasTabSection: false,
      hasAccordion: false,
      hasCounterSection: false,  // animated numbers / stats
      pageStructure: [],         // ordered list of detected sections
    };

    // ── Marquee ──
    const marqueeEl = document.querySelector(
      '[class*="marquee"],[class*="ticker"],[class*="scroll-banner"],[class*="logo-strip"],[class*="brand-strip"],[style*="animation"][style*="translate"]'
    );
    if (marqueeEl) {
      patterns.hasMarquee = true;
    } else {
      // Detect via animation: if an element has many img children and an animation
      document.querySelectorAll('ul, div, section').forEach(el => {
        const cs = window.getComputedStyle(el);
        if (cs.animation && cs.animation !== 'none' && el.querySelectorAll('img').length > 4) {
          patterns.hasMarquee = true;
        }
      });
    }

    // Logo strip (many logos in a row, even without animation)
    const potentialStrips = document.querySelectorAll('div, section, ul');
    for (const el of potentialStrips) {
      const imgs = el.querySelectorAll('img');
      if (imgs.length >= 4) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 600 && rect.height < 200) {
          patterns.hasLogoStrip = true;
          break;
        }
      }
    }

    // ── Pricing grid ──
    const pricingSection = document.querySelector(
      '[class*="pricing"],[class*="plan"],[class*="tier"],[id*="pricing"],[id*="plans"]'
    );
    if (pricingSection) {
      patterns.hasPricingGrid = true;
      // Count columns
      const cards = pricingSection.querySelectorAll('[class*="card"],[class*="plan"],[class*="tier"]');
      patterns.pricingColumnCount = Math.min(cards.length, 5);
    } else {
      // Heuristic: find a container with 2–4 children that each have a price
      const allEls = document.querySelectorAll('section, div[class]');
      for (const el of Array.from(allEls).slice(0, 100)) {
        const children = Array.from(el.children).filter(c => {
          const text = c.innerText || '';
          return /€|\$|£|¥|per (day|month|year|week)|\/mo|free/i.test(text);
        });
        if (children.length >= 2 && children.length <= 5) {
          patterns.hasPricingGrid = true;
          patterns.pricingColumnCount = children.length;
          break;
        }
      }
    }

    // ── Testimonial carousel — requires testimonial content INSIDE a real carousel wrapper ──
    // Standalone testimonial panels (e.g. modal/tab content) do NOT trigger this
    const _carouselWrappers = document.querySelectorAll('[class*="carousel"],[class*="swiper"],[class*="slider"]');
    for (const wrapper of _carouselWrappers) {
      const hasTestimonial = wrapper.querySelector(
        '[class*="testimonial"], [class*="review"], blockquote, [class*="quote-card"], [class*="testimonial-card"]'
      );
      if (hasTestimonial) { patterns.hasTestimonialCarousel = true; break; }
    }
    // Also catch explicit testimonial-carousel class (not just any element with "testimonial")
    if (!patterns.hasTestimonialCarousel) {
      if (document.querySelector('[class*="testimonial-carousel"],[class*="testimonial-slider"],[class*="reviews-carousel"]')) {
        patterns.hasTestimonialCarousel = true;
      }
    }

    // ── QR Code ──
    const qrEl = document.querySelector(
      'img[src*="qr"],[class*="qr"],[alt*="qr" i],[alt*="QR"],[alt*="scan"]'
    );
    if (qrEl) {
      // Validate: QR codes are square (≥60px) — avoids matching CDN URLs that happen to contain "qr" in hash
      const _qrRect = qrEl.getBoundingClientRect();
      const _qrSquare = _qrRect.width >= 60 && _qrRect.height >= 60 &&
        Math.abs(_qrRect.width - _qrRect.height) / Math.max(_qrRect.width, _qrRect.height) < 0.25;
      if (_qrSquare) {
        patterns.hasQRCode = true;
        const parent = qrEl.closest('section, div') || document.body;
        const nearbyBtn = parent.querySelector('a[href], button');
        if (nearbyBtn) patterns.hasDualCTA = true;
      }
    }

    // ── Sticky nav ──
    const navEl = document.querySelector('nav, header');
    if (navEl) {
      const cs = window.getComputedStyle(navEl);
      patterns.hasStickyNav = cs.position === 'sticky' || cs.position === 'fixed';
    }

    // ── Feature list (icon + text rows) ──
    const listItems = document.querySelectorAll('li, [class*="feature-item"],[class*="feature-row"]');
    let iconListCount = 0;
    for (const li of Array.from(listItems).slice(0, 50)) {
      if (li.querySelector('svg, img') && li.innerText?.length > 5) iconListCount++;
    }
    if (iconListCount >= 3) patterns.hasFeatureList = true;

    // ── Step indicator — tightened detection (Fix 8A) ──
    // Only detect genuine sequential step indicators, not any element with "step" in class
    const _stepIndicatorEls = document.querySelectorAll(
      '.steps-indicator, .step-indicator, .progress-steps, [class*="steps-indicator"], [class*="step-indicator"], [class*="progress-step"]'
    );
    if (_stepIndicatorEls.length >= 1) {
      patterns.hasStepIndicator = true;
    } else {
      // Look for numbered circles with border-radius:50% that are part of a sequential UI
      const _circleNums = Array.from(document.querySelectorAll('[class*="step"] [class*="number"], [class*="step"] [class*="circle"], ol[class*="step"] > li'))
        .filter(el => {
          const cs = window.getComputedStyle(el);
          const text = el.innerText?.trim();
          return /^[1-9]$/.test(text) && (cs.borderRadius?.includes('50%') || cs.borderRadius === '9999px');
        });
      if (_circleNums.length >= 2) patterns.hasStepIndicator = true;
    }

    // ── Dark footer ──
    const footer = document.querySelector('footer');
    if (footer) {
      const cs = window.getComputedStyle(footer);
      const bg = cs.backgroundColor;
      if (bg) {
        const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (m) {
          const lum = (0.299*parseInt(m[1]) + 0.587*parseInt(m[2]) + 0.114*parseInt(m[3])) / 255;
          patterns.hasDarkFooter = lum < 0.25;
        }
      }
    }

    // ── Video section ──
    const videoEl = document.querySelector('video, [class*="video"], iframe[src*="youtube"], iframe[src*="vimeo"]');
    if (videoEl) patterns.hasVideoSection = true;

    // ── Tabs ──
    const tabEl = document.querySelector('[role="tablist"], [class*="tabs"], [class*="tab-nav"]');
    if (tabEl) patterns.hasTabSection = true;

    // ── Accordion ──
    const accordionEl = document.querySelector('[class*="accordion"],[class*="faq"],[class*="collapse"],[open]');
    if (accordionEl) patterns.hasAccordion = true;

    // ── Stats / counters ──
    const statsSection = document.querySelector('[class*="stats"],[class*="counter"],[class*="metric"],[class*="number"]');
    if (statsSection) {
      // Must have actual numbers
      if (/\d+[KkMmBb%+]/.test(statsSection.innerText)) patterns.hasCounterSection = true;
    }

    // ── Page structure (ordered sections) ──
    const structure = [];
    const mainSections = document.querySelectorAll('main > section, main > div, body > section, body > div > section');
    for (const sec of Array.from(mainSections).slice(0, 20)) {
      const text = (sec.innerText || '').slice(0, 200).toLowerCase();
      const hasH1 = !!sec.querySelector('h1');
      const hasH2 = !!sec.querySelector('h2');
      const hasImg = !!sec.querySelector('img');
      const hasVideo = !!sec.querySelector('video, iframe');
      const hasForm = !!sec.querySelector('form, input');
      const rect = sec.getBoundingClientRect();

      // Skip tiny or invisible sections
      if (rect.height < 60) continue;

      let label = '';
      if (hasH1) label = 'hero';
      else if (/partner|trusted by|as seen|logo/i.test(text) && hasImg) label = 'logo-strip';
      else if (/pric|plan|tier|free|month|year/i.test(text)) label = 'pricing';
      else if (/review|testimonial|love|said|customer|quote/i.test(text)) label = 'testimonials';
      else if (/faq|question|answer|accordion/i.test(text)) label = 'faq';
      else if (/contact|reach out|form/i.test(text) && hasForm) label = 'contact';
      else if (hasVideo) label = 'video';
      else if (hasH2 && hasImg) label = 'feature-split';
      else if (hasH2) label = 'content-section';

      if (!label) continue;

      // Deduplicate: don't push the same label consecutively more than once
      // (carousel slides / slider items show as duplicate sections)
      const last = structure[structure.length - 1];
      if (last === label) continue;

      structure.push(label);
    }

    // Post-process: if testimonials appears 3+ times total, collapse to "testimonials (carousel)"
    const testimonialCount = structure.filter(s=>s==='testimonials').length;
    if (testimonialCount >= 3) {
      const deduped = [];
      let testimonialAdded = false;
      for (const s of structure) {
        if (s === 'testimonials') {
          if (!testimonialAdded) { deduped.push('testimonials (carousel)'); testimonialAdded = true; }
        } else {
          deduped.push(s);
        }
      }
      patterns.pageStructure = deduped;
    } else {
      patterns.pageStructure = structure;
    }

    // ── Decorative background geometry ──
    // Large SVGs or elements used as abstract background blobs/shapes
    {
      let blobCount = 0;
      const decorCandidates = document.querySelectorAll(
        'svg, [class*="blob"], [class*="shape"], [class*="bg-"], [class*="background-shape"], [class*="deco"], [class*="abstract"], [class*="orb"], [class*="glow"]'
      );
      for (const el of decorCandidates) {
        try {
          const rect = el.getBoundingClientRect();
          const cs = window.getComputedStyle(el);
          // Large, behind content (not a logo or icon)
          const isBig = rect.width > 200 || rect.height > 200;
          const isBackground = cs.position === 'absolute' || cs.position === 'fixed'
            || parseInt(cs.zIndex) < 1 || el.closest('[class*="hero"],[class*="banner"]');
          const hasNoText = (el.innerText||'').trim().length < 10;
          if (isBig && hasNoText) blobCount++;
        } catch(e) { console.debug('[VibeDesign]', e.message); }
      }
      // Also detect pseudo-element blobs via large border-radius on section ::before/::after
      const heroSec = document.querySelector('[class*="hero"], section');
      if (heroSec) {
        const before = window.getComputedStyle(heroSec, '::before');
        const after = window.getComputedStyle(heroSec, '::after');
        for (const ps of [before, after]) {
          if (ps.content !== 'none' && ps.borderRadius &&
              (ps.borderRadius.includes('50%') || parseInt(ps.borderRadius) > 50)) {
            blobCount++;
          }
        }
      }
      patterns.hasDecorativeGeometry = blobCount > 0;
      patterns.decorativeGeometryCount = blobCount;
    }

    // ── Icon system ──
    // Detect small icons (SVG or IMG) consistently paired with headings/labels
    {
      const iconPairCount = { svg: 0, img: 0 };
      // Look for heading-adjacent icons (icon before h3/h4, or inside feature list items)
      const featureItems = document.querySelectorAll(
        '[class*="feature"] li, [class*="feature-item"], [class*="use-case"], [class*="benefit"]'
      );
      for (const item of featureItems) {
        if (item.querySelector('svg, img[width], img[height]')) iconPairCount.svg++;
      }
      // Also look for h3/h4 siblings with a preceding icon
      const headings = document.querySelectorAll('h3, h4');
      for (const h of headings) {
        const prev = h.previousElementSibling;
        const parent = h.parentElement;
        if (prev && (prev.tagName === 'SVG' || prev.tagName === 'IMG')) {
          iconPairCount.svg++;
        } else if (parent && parent.querySelector('svg, img')) {
          // Icon inside same container as heading
          const parentSvgs = parent.querySelectorAll('svg, img[src*="icon"], img[class*="icon"]');
          if (parentSvgs.length > 0) iconPairCount.svg++;
        }
      }
      const totalIconPairs = iconPairCount.svg + iconPairCount.img;
      patterns.hasIconSystem = totalIconPairs >= 3;
      patterns.iconSystemCount = totalIconPairs;

      // Detect icon style + detailed measurements
      if (patterns.hasIconSystem) {
        const sampleSvgs = document.querySelectorAll('[class*="feature"] svg, [class*="use-case"] svg, [class*="icon"] svg, [class*="benefit"] svg');
        const sampleSvg = sampleSvgs[0] || null;
        if (sampleSvg) {
          const hasFill = sampleSvg.querySelector('[fill]:not([fill="none"])');
          const hasStroke = sampleSvg.querySelector('[stroke]:not([stroke="none"])');
          patterns.iconStyle = hasFill && !hasStroke ? 'filled' : hasStroke && !hasFill ? 'outlined' : 'mixed';
        } else {
          patterns.iconStyle = 'illustrated';
        }

        // Detailed icon measurements
        const iconDetails = { size: null, strokeWidth: null, color: null, containerStyle: 'none', containerBg: null, containerRadius: null, containerSize: null, gapToText: null };
        const iconSamples = Array.from(sampleSvgs).slice(0, 5);
        const sizes = [];
        for (const svg of iconSamples) {
          try {
            const rect = svg.getBoundingClientRect();
            if (rect.width > 0 && rect.width < 100) sizes.push(Math.round(rect.width));
            // Stroke width from SVG paths
            if (!iconDetails.strokeWidth) {
              const path = svg.querySelector('path, line, circle, polyline, rect');
              if (path) {
                const sw = path.getAttribute('stroke-width') || window.getComputedStyle(path).strokeWidth;
                if (sw && sw !== '0' && sw !== '0px') iconDetails.strokeWidth = sw.replace('px','');
              }
            }
            // Color
            if (!iconDetails.color) {
              const svgCs = window.getComputedStyle(svg);
              const c = svgCs.color;
              if (c && !isTransparent(c)) iconDetails.color = rgbToHex(c);
            }
            // Container detection: check parent element
            const parent = svg.parentElement;
            if (parent && parent !== document.body) {
              const pCs = window.getComputedStyle(parent);
              const pBg = pCs.backgroundColor;
              const pRect = parent.getBoundingClientRect();
              const isContainer = !isTransparent(pBg) && pRect.width < 100 && pRect.height < 100 && pRect.width > rect.width;
              if (isContainer && iconDetails.containerStyle === 'none') {
                iconDetails.containerBg = rgbToHex(pBg);
                iconDetails.containerRadius = pCs.borderRadius;
                iconDetails.containerSize = Math.round(pRect.width) + 'px';
                iconDetails.containerStyle = pCs.borderRadius?.includes('50%') || parseInt(pCs.borderRadius) > pRect.width * 0.4 ? 'circle' : 'square';
              }
              // Gap to adjacent text
              const nextSib = parent.nextElementSibling || svg.nextElementSibling;
              if (nextSib && nextSib.innerText?.trim().length > 2) {
                const gap = nextSib.getBoundingClientRect().left - (parent !== document.body ? pRect.right : rect.right);
                if (gap > 0 && gap < 60) iconDetails.gapToText = Math.round(gap) + 'px';
              }
            }
          } catch(e) { console.debug('[VibeDesign]', e.message); }
        }
        if (sizes.length) iconDetails.size = sizes[Math.floor(sizes.length/2)] + 'px'; // median
        patterns.iconDetails = iconDetails;
      }
    }

    // ── Arrow / text link CTA pattern ──
    // "Learn more →" style links with accent color — distinct from pill buttons
    {
      const links = document.querySelectorAll('a');
      let arrowLinkCount = 0;
      let arrowLinkColor = null;
      const arrowPattern = /→|›|»|▶|→|⟶|learn more|view all|see all|read more/i;
      for (const link of links) {
        const text = (link.innerText || '').trim();
        if (arrowPattern.test(text) && text.length < 60) {
          try {
            const cs = window.getComputedStyle(link);
            const color = cs.color;
            // Must be a distinct color from pure black/white (accent-colored)
            const lum = hexLuminanceFromRgb(color);
            const rgb = color.match(/\d+/g);
            if (rgb) {
              const [r,g,b] = rgb.map(Number);
              const sat = Math.max(r,g,b) - Math.min(r,g,b);
              if (sat > 30) { // has color — not neutral
                arrowLinkCount++;
                if (!arrowLinkColor) arrowLinkColor = rgbToHex(color);
              }
            }
          } catch(e) { console.debug('[VibeDesign]', e.message); }
        }
      }
      // Also check for ::after arrow via font-content heuristic
      const afterArrows = document.querySelectorAll('[class*="arrow-link"],[class*="text-link"],[class*="cta-link"],[class*="learn-more"]');
      arrowLinkCount += afterArrows.length;

      patterns.hasArrowLinks = arrowLinkCount >= 2;
      patterns.arrowLinkColor = arrowLinkColor;
      patterns.arrowLinkCount = arrowLinkCount;
    }

    return patterns;
  }

  function hexLuminanceFromRgb(rgb) {
    const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return 0.5;
    return (0.299*parseInt(m[1]) + 0.587*parseInt(m[2]) + 0.114*parseInt(m[3])) / 255;
  }

  // splitShadowLayers & isRealShadowLayer moved to lib/shadow-utils.js — see top of file.

  function isLowSaturation(hex) {
    return colorSaturation(hex) < 30;
  }

  function colorSaturation(hex) {
    if (!hex || hex.length < 7) return 0;
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return Math.max(r,g,b) - Math.min(r,g,b);
  }

  function detectPageType() {
    const url = window.location.href;
    if (url.includes('dashboard') || url.includes('/app/')) return 'dashboard/app';
    // Class-based hero detection
    if (document.querySelector('[class*="hero"],[class*="banner"],[class*="Hero"],[class*="Banner"]')) return 'landing page';
    // Structural hero: first section with h1 + CTA = landing page
    const firstSec = document.querySelector('section:first-of-type, main > div:first-child, main > section:first-child');
    if (firstSec) {
      const hasH1 = !!firstSec.querySelector('h1');
      const hasCTA = !!firstSec.querySelector('a[class*="btn"], a[class*="button"], a[class*="cta"], button[class*="btn"], button[class*="cta"], [role="button"]');
      if (hasH1 && hasCTA) return 'landing page';
    }
    // Stricter blog check: requires article + blog URL or blog-specific class
    const hasArticle = !!document.querySelector('article');
    const hasBlogSignal = /\/(blog|post|article|news)\//i.test(url) || !!document.querySelector('[class*="post-content"],[class*="blog-content"],[class*="article-body"]');
    if (hasArticle && hasBlogSignal) return 'blog/article';
    if (document.querySelector('[class*="pricing"]')) return 'pricing page';
    if (document.querySelector('[class*="login"],[class*="signin"]')) return 'auth page';
    if (url.includes('behance') || url.includes('dribbble')) return 'design portfolio';
    return 'web page';
  }

  // ─── Element extraction ────────────────────────────────────────────────────
  // Walk up from a media element to find the nearest content-rich parent (card, section, etc.)
  function findContentParent(el) {
    let parent = el.parentElement;
    for (let d = 0; d < 6 && parent; d++) {
      // Stop at a container that has heading or paragraph text
      if (parent.querySelector('h1, h2, h3, h4, p')) return parent;
      // Stop at a section/article/card-like container
      const tag = parent.tagName.toLowerCase();
      if (['section', 'article', 'main'].includes(tag)) return parent;
      const cls = (parent.className || '').toString().toLowerCase();
      if (/card|feature|block|hero|content|panel/.test(cls)) return parent;
      parent = parent.parentElement;
    }
    return el.parentElement || el;
  }

  function extractElementData(el) {
    const cs = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const props = [
      'display','flexDirection','alignItems','justifyContent','gap',
      'padding','paddingTop','paddingBottom','paddingLeft','paddingRight',
      'backgroundColor','color','backgroundImage',
      'fontFamily','fontSize','fontWeight','lineHeight','letterSpacing',
      'borderRadius','border','borderColor',
      'boxShadow','filter','backdropFilter','opacity',
      'transition','animation','cursor','overflow',
    ];
    const styles = {};
    for (const p of props) {
      const v = cs[p];
      if (v && v !== 'none' && v !== 'normal' && v !== 'auto' && v !== '0px' && v !== 'initial') {
        styles[p] = v;
      }
    }

    // ── Fix 1: If backgroundColor is transparent, walk up parents ──
    if (!styles.backgroundColor || isTransparent(cs.backgroundColor)) {
      let parent = el.parentElement;
      while (parent) {
        const pcs = window.getComputedStyle(parent);
        if (!isTransparent(pcs.backgroundColor)) {
          styles.backgroundColor = pcs.backgroundColor;
          break;
        }
        if (pcs.backgroundImage && pcs.backgroundImage !== 'none') {
          styles.backgroundImage = pcs.backgroundImage;
          break;
        }
        parent = parent.parentElement;
      }
    }

    // ── Fix 2: If text color looks wrong (black on dark bg), sample from children ──
    const rawColor = cs.color;
    const rawBg = styles.backgroundColor;
    if (rawColor && rawBg) {
      const colorLum = rgbLuminance(rawColor);
      const bgLum = rgbLuminance(rawBg);
      // Black text on dark background = likely inherited default, find real text color
      if (colorLum < 0.1 && bgLum < 0.2) {
        const textChild = el.querySelector('h1, h2, h3, p, span, a, li, strong, em');
        if (textChild) {
          const childColor = window.getComputedStyle(textChild).color;
          if (childColor) styles.color = childColor;
        }
      }
      // White text on light background = same issue
      if (colorLum > 0.9 && bgLum > 0.8) {
        const textChild = el.querySelector('h1, h2, h3, p, span, a, li, strong, em');
        if (textChild) {
          const childColor = window.getComputedStyle(textChild).color;
          if (childColor) styles.color = childColor;
        }
      }
    }

    // ── Fix 3: Get transition — compact format ──
    if (styles.transition) {
      const full = cs.getPropertyValue('transition');
      if (full && full !== 'none' && full !== 'all') {
        // Parse individual transitions and compact them
        const parts = full.split(',').map(s => s.trim());
        if (parts.length > 2) {
          // Check if all share same timing — if so, summarize
          const timings = parts.map(p => p.replace(/^\S+\s+/, '')); // remove property name
          const uniqueTimings = [...new Set(timings)];
          if (uniqueTimings.length === 1) {
            const props = parts.map(p => p.split(/\s+/)[0]);
            styles.transition = `${props.join(', ')} ${uniqueTimings[0]}`;
          } else {
            // Just take first 2 transitions
            styles.transition = parts.slice(0, 2).join(', ');
          }
        } else {
          styles.transition = full.slice(0, 150);
        }
      }
      // Remove useless "all 0s" transitions
      if (!styles.transition || styles.transition === 'all' || /^all\s+0s/.test(styles.transition) ||
          styles.transition === 'all 0s ease 0s') {
        delete styles.transition;
      }
    }

    // ── Fix: Strip layout props for non-layout elements (SVG, video, canvas, img) ──
    const tagName = el.tagName.toLowerCase();
    if (['svg', 'video', 'canvas', 'img', 'picture'].includes(tagName)) {
      for (const k of ['display', 'flexDirection', 'alignItems', 'justifyContent', 'gap', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'fontFamily']) {
        delete styles[k];
      }
    }

    // Convert colors to hex
    for (const k of ['backgroundColor','color','borderColor']) {
      if (styles[k]) {
        const hex = rgbToHex(styles[k]);
        if (hex) styles[k] = hex;
      }
    }
    if (styles.fontFamily) {
      const cleaned = cleanFont(styles.fontFamily);
      if (cleaned) styles.fontFamily = cleaned;
      else delete styles.fontFamily;
    }

    // ── Gather text hierarchy ──
    // For media elements (SVG, video, canvas, img), look at parent/sibling context
    const isMediaElement = ['svg', 'video', 'canvas', 'img', 'picture'].includes(tagName);
    const contextEl = isMediaElement ? findContentParent(el) : el;

    const textHierarchy = [];
    const headingEl = contextEl.querySelector('h1, h2, h3, h4');
    if (headingEl) {
      const hcs = window.getComputedStyle(headingEl);
      textHierarchy.push({
        role: 'heading',
        tag: headingEl.tagName.toLowerCase(),
        text: headingEl.innerText?.trim().slice(0, 60) || '',
        fontSize: hcs.fontSize,
        fontWeight: hcs.fontWeight,
        lineHeight: hcs.lineHeight,
        color: rgbToHex(hcs.color) || hcs.color,
        fontFamily: cleanFont(hcs.fontFamily) || null,
      });
    }
    const paraEl = contextEl.querySelector('p, [class*="desc"], [class*="subtitle"]');
    if (paraEl && paraEl !== headingEl) {
      const pcs = window.getComputedStyle(paraEl);
      textHierarchy.push({
        role: 'body',
        text: paraEl.innerText?.trim().slice(0, 80) || '',
        fontSize: pcs.fontSize,
        fontWeight: pcs.fontWeight,
        color: rgbToHex(pcs.color) || pcs.color,
      });
    }
    // Small labels (like location labels on a map, stat labels)
    const labelEls = contextEl.querySelectorAll('span, small, [class*="label"], [class*="tag"], [class*="stat"]');
    const labels = [];
    labelEls.forEach(lbl => {
      const t = lbl.innerText?.trim();
      if (t && t.length > 1 && t.length < 40 && labels.length < 6) {
        // Avoid duplicating heading/body text
        if (headingEl && headingEl.contains(lbl)) return;
        if (paraEl && paraEl.contains(lbl)) return;
        labels.push(t);
      }
    });

    // ── Detect visual content (SVG, canvas, img, video) ──
    const visualContent = [];
    // If the element itself is a media element, include it
    const svgs = tagName === 'svg' ? [el] : [...el.querySelectorAll('svg')];
    svgs.forEach(svg => {
      const sr = svg.getBoundingClientRect();
      if (sr.width > 30 && sr.height > 30) {
        const pathEls = svg.querySelectorAll('path, circle, line, rect, ellipse, polygon');
        const pathCount = pathEls.length;
        const clipPaths = svg.querySelectorAll('clipPath').length;
        const groups = svg.querySelectorAll('g').length;
        const hasText = svg.querySelector('text');
        const isLottie = !!svg.querySelector('[id*="lottie"]');

        // Detect animations (SMIL + CSS)
        const smilAnimated = svg.querySelectorAll('animate, animateTransform').length > 0;
        let cssAnimated = false;
        svg.querySelectorAll('*').forEach(child => {
          const ccs = window.getComputedStyle(child);
          if (ccs.animationName && ccs.animationName !== 'none') cssAnimated = true;
        });
        const animated = smilAnimated || cssAnimated || isLottie;

        // Collect unique colors used in SVG
        const svgColors = new Set();
        const svgStrokes = new Set();
        pathEls.forEach(p => {
          const pcs = window.getComputedStyle(p);
          const fill = pcs.fill;
          const stroke = pcs.stroke;
          if (fill && fill !== 'none' && !fill.startsWith('url')) {
            const hex = rgbToHex(fill);
            if (hex && hex !== '#000000') svgColors.add(hex);
          }
          if (stroke && stroke !== 'none' && !stroke.startsWith('url')) {
            const hex = rgbToHex(stroke);
            if (hex) svgStrokes.add(hex);
          }
        });

        // Detect gradients in defs
        const grads = svg.querySelectorAll('linearGradient, radialGradient');
        const gradientColors = [];
        grads.forEach(g => {
          g.querySelectorAll('stop').forEach(s => {
            const c = s.getAttribute('stop-color');
            if (c) { const hex = rgbToHex(c); if (hex) gradientColors.push(hex); }
          });
        });

        // Check if partially cropped by overflow:hidden parent
        let cropping = null;
        let parent = svg.parentElement;
        for (let d = 0; d < 5 && parent; d++) {
          const pcs = window.getComputedStyle(parent);
          if (pcs.overflow === 'hidden') {
            const pr = parent.getBoundingClientRect();
            const cropBottom = sr.bottom - pr.bottom;
            const cropTop = pr.top - sr.top;
            if (cropBottom > 10 || cropTop > 10) {
              cropping = {};
              if (cropBottom > 10) cropping.bottom = Math.round(cropBottom);
              if (cropTop > 10) cropping.top = Math.round(cropTop);
            }
            break;
          }
          parent = parent.parentElement;
        }

        // Detect stroke style (dashed, thin wireframe)
        let strokeStyle = null;
        for (const p of pathEls) {
          const pcs = window.getComputedStyle(p);
          if (pcs.strokeDasharray && pcs.strokeDasharray !== 'none') { strokeStyle = 'dashed'; break; }
          if (pcs.strokeWidth && parseFloat(pcs.strokeWidth) < 1.5 && pcs.stroke !== 'none') { strokeStyle = 'thin-wireframe'; break; }
        }

        // Guess visual subject
        let subject = null;
        if (pathCount > 50 && clipPaths > 10) subject = 'globe/sphere wireframe';
        else if (pathCount > 30) subject = 'complex illustration';
        else if (pathCount > 10) subject = 'diagram/icon';

        const entry = {
          type: isLottie ? 'lottie-svg' : 'svg',
          size: `${Math.round(sr.width)}×${Math.round(sr.height)}`,
          complexity: pathCount > 50 ? 'very-complex' : pathCount > 20 ? 'complex' : pathCount > 5 ? 'moderate' : 'simple',
          pathCount,
          animated,
          isLottie,
          hasText: !!hasText,
          subject,
        };
        if (svgColors.size > 0) entry.fillColors = [...svgColors].slice(0, 4);
        if (svgStrokes.size > 0) entry.strokeColors = [...svgStrokes].slice(0, 4);
        if (gradientColors.length > 0) entry.gradientColors = [...new Set(gradientColors)].slice(0, 4);
        if (cropping) entry.cropping = cropping;
        if (strokeStyle) entry.strokeStyle = strokeStyle;
        if (clipPaths > 5) entry.clipPaths = clipPaths;

        visualContent.push(entry);
      }
    });
    const canvases = tagName === 'canvas' ? [el] : [...el.querySelectorAll('canvas')];
    canvases.forEach(c => {
      const cr = c.getBoundingClientRect();
      if (cr.width > 30) {
        visualContent.push({ type: 'canvas', size: `${Math.round(cr.width)}×${Math.round(cr.height)}` });
      }
    });
    const imgs = tagName === 'img' ? [el] : [...el.querySelectorAll('img')];
    const seenImgSrcs = new Set();
    imgs.forEach(img => {
      const ir = img.getBoundingClientRect();
      if (ir.width < 30) return;
      // Deduplicate by filename stem (ignore light/dark variants and query strings)
      const rawSrc = (img.src || '').split('?')[0].split('/').pop() || '';
      const stem = rawSrc.replace(/[_-](light|dark|2x|3x|@2x|@3x)\b/gi, '').replace(/\.[a-f0-9]{8,}\./i, '.');
      if (seenImgSrcs.has(stem)) return;
      seenImgSrcs.add(stem);
      visualContent.push({
        type: 'image',
        size: `${Math.round(ir.width)}×${Math.round(ir.height)}`,
        alt: img.alt?.slice(0, 40) || null,
        src: rawSrc.slice(0, 40) || null,
      });
    });

    // Video elements
    const videos = tagName === 'video' ? [el] : [...el.querySelectorAll('video')];
    videos.forEach(v => {
      const vr = v.getBoundingClientRect();
      if (vr.width > 30) {
        visualContent.push({
          type: 'video',
          size: `${Math.round(vr.width)}×${Math.round(vr.height)}`,
          poster: v.poster ? v.poster.split('/').pop()?.slice(0, 40) : null,
          autoplay: v.autoplay,
          loop: v.loop,
          muted: v.muted,
        });
      }
    });

    // ── Detect border/outline styling of the element ──
    const borderTop = cs.borderTopWidth;
    const borderStyle = cs.borderStyle;
    let borderInfo = null;
    if (borderTop && borderTop !== '0px' && borderStyle !== 'none') {
      borderInfo = `${cs.borderWidth} ${borderStyle} ${rgbToHex(cs.borderColor) || cs.borderColor}`;
    }

    // ── Is this a container/card? ──
    const isContainer = rect.width > 200 && rect.height > 150 && el.children.length > 1;

    // ── Detect buttons/CTAs inside ──
    const innerButtons = [];
    el.querySelectorAll('button, a[class*="btn"], a[class*="button"], [role="button"]').forEach(btn => {
      const t = btn.innerText?.trim();
      if (t && t.length > 1 && t.length < 40 && innerButtons.length < 3) {
        const bcs = window.getComputedStyle(btn);
        innerButtons.push({
          text: t,
          bg: !isTransparent(bcs.backgroundColor) ? (rgbToHex(bcs.backgroundColor) || null) : null,
          color: rgbToHex(bcs.color) || null,
          borderRadius: bcs.borderRadius !== '0px' ? bcs.borderRadius : null,
        });
      }
    });

    // ── Detect CSS animations on descendants ──
    let animatedDescendants = 0;
    let animationNames = new Set();
    el.querySelectorAll('*').forEach(child => {
      const ccs = window.getComputedStyle(child);
      if (ccs.animationName && ccs.animationName !== 'none') {
        animatedDescendants++;
        ccs.animationName.split(',').forEach(n => animationNames.add(n.trim()));
      }
    });

    // ── Detect grid/dot patterns ──
    let hasGridPattern = false;
    const childEls = el.querySelectorAll('div, span');
    if (childEls.length > 15) {
      // Many small same-size children = likely a dot grid or pattern
      const smallChildren = Array.from(childEls).filter(c => {
        const cr = c.getBoundingClientRect();
        return cr.width < 15 && cr.height < 15 && cr.width > 1;
      });
      if (smallChildren.length > 10) hasGridPattern = true;
    }

    return {
      tag: tagName,
      id: el.id,
      classes: el.className?.toString().slice(0, 100) || '',
      text: isContainer ? null : (el.innerText?.slice(0, 80) || ''),
      rect: { width: Math.round(rect.width), height: Math.round(rect.height) },
      styles,
      isContainer,
      textHierarchy: textHierarchy.length > 0 ? textHierarchy : null,
      labels: labels.length > 0 ? labels : null,
      visualContent: visualContent.length > 0 ? visualContent : null,
      innerButtons: innerButtons.length > 0 ? innerButtons : null,
      animatedDescendants: animatedDescendants > 0 ? animatedDescendants : null,
      animationNames: animationNames.size > 0 ? [...animationNames].slice(0, 5) : null,
      hasGridPattern,
      borderInfo,
      children: [...el.children].slice(0, 8).map(c => {
        const ccs = window.getComputedStyle(c);
        const cr = c.getBoundingClientRect();
        return {
          tag: c.tagName.toLowerCase(),
          text: c.innerText?.slice(0, 40) || '',
          width: Math.round(cr.width),
          height: Math.round(cr.height),
          bg: !isTransparent(ccs.backgroundColor) ? (rgbToHex(ccs.backgroundColor) || null) : null,
        };
      }),
      hasPseudoBefore: window.getComputedStyle(el,'::before').content !== 'none',
      hasPseudoAfter: window.getComputedStyle(el,'::after').content !== 'none',
      url: window.location.href,
      pageTitle: document.title,
      parentContext: _extractParentContext(el),
    };
  }

  function _extractParentContext(el) {
    try {
      const parent = el.closest('section, article, [role="main"], [role="region"], [role="dialog"], main, aside');
      if (!parent || parent === document.body) return null;
      const pcs = window.getComputedStyle(parent);
      const childTags = new Set();
      parent.querySelectorAll('button, a, h1, h2, h3, h4, input, img, video, nav, form').forEach(c => {
        const tag = c.tagName.toLowerCase();
        const cls = (c.className || '').toString().toLowerCase();
        if (tag === 'button' || cls.includes('btn')) childTags.add('Button');
        else if (tag === 'a') childTags.add('Link');
        else if (/^h[1-6]$/.test(tag)) childTags.add('Heading');
        else if (tag === 'input') childTags.add('Input');
        else if (tag === 'img') childTags.add('Image');
        else if (tag === 'video') childTags.add('Video');
        else if (tag === 'nav') childTags.add('Navigation');
        else if (tag === 'form') childTags.add('Form');
      });
      return {
        sectionType: parent.tagName.toLowerCase(),
        layout: pcs.display === 'grid' ? 'grid' : pcs.display === 'flex' ? 'flex' : 'block',
        bgColor: !isTransparent(pcs.backgroundColor) ? rgbToHex(pcs.backgroundColor) : null,
        childComponents: [...childTags].slice(0, 8),
      };
    } catch(e) { return null; }
  }

  // Picker UI moved to lib/picker.js — expose extraction function
  window.__vibeDesign.extractElementData = extractElementData;

  // ─── Multi-state interactive capture ───────────────────────────────────────
  async function extractAllInteractiveStates() {
    // Safe selector list — excludes nav[class*="tab"] a and ul[class*="tab"] li
    // which match real navigation links and can cause page redirects
    const clickTargets = document.querySelectorAll(
      '[role="tab"], ' +
      '[data-tab], [data-step], [data-panel], ' +
      '[class*="tab-btn"], [class*="tab-button"]'
    );

    if (clickTargets.length < 2 || clickTargets.length > 10) return null;

    // Safety check: filter out elements that would navigate away from the page
    const safeTargets = Array.from(clickTargets).filter(el => {
      if (el.tagName === 'A') {
        const href = el.getAttribute('href');
        // Only anchor links (#, #section-id) are safe to click
        if (!href || (href !== '#' && !href.startsWith('#'))) return false;
      }
      if (el.type === 'submit') return false;
      if (el.closest('form')) return false;
      return true;
    });

    if (safeTargets.length < 2) return null;

    // Record which tab was originally active so we can restore it
    const originalActive = safeTargets.findIndex(el =>
      el.getAttribute('aria-selected') === 'true' ||
      el.classList.toString().includes('active') ||
      el.classList.toString().includes('selected')
    );

    const states = [];

    try {
      for (const target of safeTargets.slice(0, 6)) {
        target.click();
        await new Promise(r => setTimeout(r, 300));

        const label = target.textContent?.trim().slice(0, 40);
        const activePanel = document.querySelector(
          '[role="tabpanel"]:not([hidden]), ' +
          '[class*="panel"][class*="active"], ' +
          '[class*="panel"][class*="visible"], ' +
          '[class*="content"][class*="active"]'
        );
        if (!activePanel) continue;

        const heading = activePanel.querySelector('h1,h2,h3,h4')?.textContent?.trim().slice(0, 60);
        const bullets = Array.from(activePanel.querySelectorAll('li, [class*="bullet"], [class*="item"]'))
          .slice(0, 5).map(li => li.textContent?.trim().slice(0, 80)).filter(Boolean);
        const img = activePanel.querySelector('img');
        const cta = activePanel.querySelector('a[href], button')?.textContent?.trim().slice(0, 30);

        states.push({ trigger: label, heading, bullets, hasImage: !!img, imgSrc: img?.src?.split('/').pop()?.slice(0, 50), cta });
      }
    } finally {
      // Always restore original active tab, even if an error occurred mid-loop
      const restoreIndex = originalActive >= 0 ? originalActive : 0;
      safeTargets[restoreIndex]?.click();
      await new Promise(r => setTimeout(r, 150));
    }

    return states.length > 1 ? states : null;
  }

  // ─── Layered image detection ────────────────────────────────────────────────
  function detectLayeredImages() {
    const layeredComps = [];
    const containers = document.querySelectorAll(
      '[class*="hero"], [class*="feature"], [class*="product"], ' +
      '[class*="visual"], [class*="mockup"], section, .card'
    );
    for (const container of Array.from(containers).slice(0, 20)) {
      const imgs = container.querySelectorAll('img');
      const bgEls = Array.from(container.querySelectorAll('*')).filter(el => {
        const bg = window.getComputedStyle(el).backgroundImage;
        return bg && bg !== 'none' && bg.startsWith('url');
      });
      const totalLayers = imgs.length + bgEls.length;
      if (totalLayers < 2) continue;

      const layers = [];
      bgEls.forEach(el => {
        const cs = window.getComputedStyle(el);
        layers.push({ type: 'background', zIndex: parseInt(cs.zIndex) || 0, position: cs.position,
          url: cs.backgroundImage.match(/url\(["']?([^"')]+)/)?.[1]?.split('/').pop()?.slice(0, 50) });
      });
      Array.from(imgs).forEach(img => {
        const cs = window.getComputedStyle(img);
        const r = img.getBoundingClientRect();
        layers.push({ type: 'img', zIndex: parseInt(cs.zIndex) || 0, position: cs.position,
          url: img.src?.split('/').pop()?.slice(0, 50), width: Math.round(r.width), height: Math.round(r.height) });
      });
      layers.sort((a, b) => a.zIndex - b.zIndex);

      layeredComps.push({ section: container.tagName + (container.className ? '.' + String(container.className).slice(0, 30) : ''), layerCount: totalLayers, layers });
    }
    return layeredComps.length > 0 ? layeredComps.slice(0, 5) : null;
  }

  // ─── Spacing scale detection ────────────────────────────────────────────────
  function detectSpacingScale() {
    const spacingValues = new Set();
    const elements = document.querySelectorAll('section, div, article, header, footer, nav');
    for (const el of Array.from(elements).slice(0, 100)) {
      const cs = window.getComputedStyle(el);
      ['paddingTop','paddingBottom','paddingLeft','paddingRight','marginTop','marginBottom','gap','rowGap','columnGap'].forEach(prop => {
        const val = parseInt(cs[prop]);
        if (val > 0 && val <= 200) spacingValues.add(val);
      });
    }
    const vals = [...spacingValues].sort((a, b) => a - b);
    if (vals.length < 4) return null;

    let bestBase = 8, bestScore = 0;
    for (const base of [4, 8, 10, 12, 16]) {
      const score = vals.filter(v => v % base === 0).length;
      if (score > bestScore) { bestScore = score; bestBase = base; }
    }
    const conforming = vals.filter(v => v % bestBase === 0);
    const conformRate = conforming.length / vals.length;
    if (conformRate <= 0.6) return null;

    return { baseUnit: bestBase, conformRate: Math.round(conformRate * 100), commonValues: conforming.slice(0, 8), outliers: vals.filter(v => v % bestBase !== 0).slice(0, 4) };
  }

  // ─── Section-specific illustrations ────────────────────────────────────────
  function detectSectionIllustrations() {
    const sections = document.querySelectorAll('section, [class*="section"], main > div');
    const results = [];

    for (const section of Array.from(sections).slice(0, 8)) {
      const rect = section.getBoundingClientRect();
      if (rect.height < 200) continue;

      const illus = { type: null, details: null };
      const svg = section.querySelector('svg');

      if (svg) {
        const paths = svg.querySelectorAll('path, polyline, line');
        const circles = svg.querySelectorAll('circle');
        const texts = svg.querySelectorAll('text, [class*="label"], [class*="tooltip"]');

        if (circles.length >= 4) {
          const radii = Array.from(circles).map(c => parseFloat(c.getAttribute('r') || '0')).sort((a, b) => a - b);
          if (radii.length >= 4 && (radii[radii.length - 1] / (radii[0] || 1)) > 3) {
            illus.type = 'concentric-circles';
            illus.details = { ringCount: circles.length, hasIcon: !!svg.querySelector('path[d*="M"]') };
          }
        }
        if (!illus.type && circles.length > 20) {
          const colorsSet = new Set(Array.from(circles).slice(0, 20).map(c =>
            c.getAttribute('fill') || window.getComputedStyle(c).fill
          ).filter(c => c && c !== 'none'));
          illus.type = 'particle-scatter';
          illus.details = { particleCount: circles.length, colors: [...colorsSet].slice(0, 3) };
        }
        if (!illus.type && paths.length >= 2 && paths.length <= 10) {
          const colors = [...new Set(Array.from(paths).map(p =>
            p.getAttribute('stroke') || window.getComputedStyle(p).stroke
          ).filter(c => c && c !== 'none'))];
          illus.type = colors.length >= 2 ? 'multi-line-chart' : 'single-line-chart';
          illus.details = {
            lineCount: colors.length, colors,
            hasTooltip: texts.length > 0,
            tooltipText: texts[0]?.textContent?.trim().slice(0, 30),
            hasDots: circles.length > 0 && circles.length < 10,
          };
        }
      }

      // Architecture diagram (dashed boundaries)
      const dashedEls = section.querySelectorAll('[style*="dashed"], [class*="dashed"], [class*="boundary"]');
      if (!illus.type && dashedEls.length > 0) {
        // Guard: skip if any dashed container holds a real <img> — likely a decorative card, not a diagram
        const hasImgInside = Array.from(dashedEls).some(el => el.querySelector('img'));
        if (!hasImgInside) {
          // Guard: require monospace-font labels to confirm technical diagram context
          const monoLabels = Array.from(section.querySelectorAll('[style*="monospace"], [class*="label"], small'))
            .filter(el => {
              const ff = window.getComputedStyle(el).fontFamily || '';
              return ff.toLowerCase().includes('mono') || ff.toLowerCase().includes('courier') || el.style.fontFamily?.includes('monospace');
            });
          const allLabels = Array.from(section.querySelectorAll('[class*="label"], small, [style*="monospace"]'))
            .map(el => el.textContent?.trim().slice(0, 30)).filter(Boolean);
          // Only classify as architecture-diagram if we have monospace labels OR 3+ text labels (strong signal)
          if (monoLabels.length > 0 || allLabels.length >= 3) {
            illus.type = 'architecture-diagram';
            illus.details = { labels: allLabels.slice(0, 6), dashedBoundaries: dashedEls.length };
          }
        }
      }

      // Fix 5: PNG/JPG illustration detection — inline SVG-only was missing raster illustrations
      if (!illus.type) {
        const imgs = section.querySelectorAll('img:not([class*="logo"]):not([class*="avatar"]):not([class*="icon"]):not([class*="profile"])');
        for (const img of imgs) {
          try {
            const imgRect = img.getBoundingClientRect();
            if (imgRect.width < 100 || imgRect.height < 100) continue;
            const src = img.src || img.dataset.src || '';
            const alt = (img.alt || '').toLowerCase();
            const cls = (img.className || '').toLowerCase();
            const combined = src + ' ' + alt + ' ' + cls;
            const aspectRatio = imgRect.width / (imgRect.height || 1);

            // UI mockup signals (screenshots, dashboards, product interfaces)
            if (/mockup|screen|ui|dashboard|interface|preview|capture|app/i.test(combined)) {
              illus.type = 'ui-mockup';
              illus.details = {
                url: src, width: Math.round(imgRect.width), height: Math.round(imgRect.height),
                perspective: aspectRatio > 1.3 ? 'landscape' : aspectRatio < 0.8 ? 'portrait' : 'square',
              };
              break;
            }
            // Concentric ring / cap-table / wheel illustrations
            if (/ring|circle|arc|donut|wheel|cap.?table|stakeholder|equity|concentric/i.test(combined)) {
              illus.type = 'concentric-rings-image';
              illus.details = { url: src, width: Math.round(imgRect.width), height: Math.round(imgRect.height) };
              break;
            }
            // Large portrait images tend to be character/brand illustrations
            if (aspectRatio < 0.7 && imgRect.height > 250 && !/photo|photo/i.test(combined)) {
              illus.type = 'illustration-image';
              illus.details = { url: src, width: Math.round(imgRect.width), height: Math.round(imgRect.height) };
              break;
            }
          } catch(e) { console.debug('[VibeDesign]', e.message); }
        }
      }

      if (illus.type) {
        const heading = section.querySelector('h1,h2,h3')?.textContent?.trim().slice(0, 50);
        const label = section.querySelector('[class*="label"], [class*="eyebrow"], small')?.textContent?.trim().slice(0, 30);
        results.push({ ...illus, sectionHeading: heading, sectionLabel: label });
      }
    }
    return results.length > 0 ? results : null;
  }

  // ─── Subtle background textures ─────────────────────────────────────────────
  function detectSubtleBackgroundTextures() {
    const result = [];
    const candidates = document.querySelectorAll('section, [class*="hero"], [class*="bg"]');
    for (const el of Array.from(candidates).slice(0, 8)) {
      try {
        const cs = window.getComputedStyle(el);
        const bgImage = cs.backgroundImage;
        if (bgImage && bgImage !== 'none') {
          if (bgImage.includes('radial-gradient') || bgImage.includes('conic-gradient')) {
            result.push({
              type: bgImage.includes('radial') ? 'radial-gradient-texture' : 'conic-gradient-texture',
              value: bgImage.slice(0, 120),
              element: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).slice(0, 20) : ''),
            });
          }
        }
        // Low-opacity SVG overlays used as texture
        const bgSvgs = el.querySelectorAll('svg[class*="bg"], svg[class*="background"], [class*="texture"] svg, [class*="noise"] svg');
        for (const svg of bgSvgs) {
          const svgCs = window.getComputedStyle(svg);
          if (parseFloat(svgCs.opacity) < 0.2) {
            result.push({ type: 'svg-texture-overlay', opacity: svgCs.opacity, childCount: svg.querySelectorAll('*').length });
          }
        }
      } catch(e) { console.debug('[VibeDesign]', e.message); }
    }
    return result.length > 0 ? result.slice(0, 5) : null;
  }

  // ─── Tabbed content components ─────────────────────────────────────────────
  function detectTabbedContentComponents() {
    const results = [];

    // Pattern A: explicit [role="tab"] or [class*="tab"] switchers
    const tabLists = document.querySelectorAll('[role="tablist"], [class*="tab-list"], [class*="tabs-nav"]');
    tabLists.forEach(tabList => {
      const tabs = Array.from(tabList.querySelectorAll('[role="tab"], [class*="tab-item"], [class*="tab-trigger"]'));
      if (tabs.length < 2) return;
      const labels = tabs.map(t => t.textContent.trim()).filter(Boolean).slice(0, 6);
      const activeTab = tabs.find(t => t.getAttribute('aria-selected') === 'true' || t.classList.toString().includes('active') || t.classList.toString().includes('selected'));
      const activeLabel = activeTab ? activeTab.textContent.trim() : labels[0];
      // Try to find associated panel
      const panel = document.querySelector('[role="tabpanel"], [class*="tab-panel"], [class*="tab-content"]');
      const panelLayout = panel ? (window.getComputedStyle(panel).display === 'grid' ? 'grid' : window.getComputedStyle(panel).display === 'flex' ? 'flex' : 'block') : null;
      results.push({ type: 'tab-switcher', labels, activeLabel, panelLayout, count: labels.length });
    });

    // Pattern A2: Framer-style pill tabs — adjacent clickable pill divs with 01/02/03 prefixes
    // Catches patterns like: [01 — UNIFIED PLANNING] [02 — INTELLIGENT OPERATIONS] [03 — DECISION SUPPORT]
    if (results.length === 0) {
      const pillCandidates = Array.from(document.querySelectorAll('div, a, button')).filter(el => {
        try {
          const cs = window.getComputedStyle(el);
          const r = el.getBoundingClientRect();
          if (r.width < 80 || r.width > 500 || r.height < 30 || r.height > 70) return false;
          if (cs.cursor !== 'pointer') return false;
          const br = parseInt(cs.borderRadius);
          if (isNaN(br) || br < 16) return false; // pill-shaped
          const text = el.textContent.trim();
          return /^0[1-9]/.test(text) && text.length < 80;
        } catch(e) { return false; }
      });
      if (pillCandidates.length >= 2) {
        const parentGroups = new Map();
        pillCandidates.forEach(el => {
          const p = el.parentElement;
          if (!parentGroups.has(p)) parentGroups.set(p, []);
          parentGroups.get(p).push(el);
        });
        for (const [, pills] of parentGroups) {
          if (pills.length < 2) continue;
          const labels = pills.map(p => p.textContent.trim().replace(/^0\d\s*[—\-·]\s*/, '').trim()).filter(Boolean).slice(0, 6);
          if (labels.length < 2) continue;
          const activeEl = pills.find(p => {
            const cs = window.getComputedStyle(p);
            return cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
          });
          const activeLabel = activeEl ? activeEl.textContent.trim().replace(/^0\d\s*[—\-·]\s*/, '').trim() : labels[0];
          results.push({ type: 'framer-pill-tabs', labels, activeLabel, hasNumbers: true, count: labels.length });
        }
      }
    }

    // Pattern A3: Framer numbered section headings — data-framer-name "Heading N" with 01/02/03 text
    // Not interactive tabs but a numbered feature sequence (e.g. "01 UNIFIED PLANNING / 02 INTELLIGENT OPERATIONS")
    if (results.length === 0) {
      const numberedHeadings = Array.from(document.querySelectorAll('[data-framer-name^="Heading"]'))
        .filter(el => {
          const text = el.innerText?.trim() || '';
          return /^0[1-9]/.test(text) && el.getBoundingClientRect().height > 100;
        })
        .sort((a, b) => (a.getBoundingClientRect().top + window.scrollY) - (b.getBoundingClientRect().top + window.scrollY));
      if (numberedHeadings.length >= 2) {
        const labels = numberedHeadings.map(el => {
          const lines = el.innerText.trim().split('\n').map(l => l.trim()).filter(Boolean);
          // lines[0] = "01", lines[1] = "UNIFIED PLANNING", lines[2] = "Align your..."
          return lines[1] || lines[0];
        }).filter(Boolean).slice(0, 6);
        if (labels.length >= 2) {
          results.push({ type: 'numbered-switcher', labels, hasNumbers: true, count: labels.length,
            panelLayout: 'block', activeLabel: labels[0] });
        }
      }
    }

    // Pattern B: numbered/labeled switcher buttons (01/02/03 pattern) — not <nav>
    if (results.length === 0) {
      const numberedContainers = document.querySelectorAll('[class*="switcher"], [class*="selector"], [class*="steps-nav"], [class*="feature-nav"]');
      numberedContainers.forEach(container => {
        const items = Array.from(container.querySelectorAll('button, [role="button"], li, [class*="item"]'));
        if (items.length < 2 || items.length > 10) return;
        const labels = items.map(it => it.textContent.trim().replace(/^\d{1,2}[.\s]/, '').trim()).filter(l => l.length > 1 && l.length < 60).slice(0, 6);
        if (labels.length < 2) return;
        const hasNumbers = items.some(it => /^\d{2}/.test(it.textContent.trim()));
        results.push({ type: 'numbered-switcher', labels, hasNumbers, count: labels.length });
      });
    }

    // Pattern B2: sidebar list switcher (numbered labels, state-driven, not real <nav>)
    // Runs unconditionally — sidebar-switcher can coexist with tab components on the same page
    {
      const _alreadyFound = new Set();

      const _extractSidebarFromContainer = (container) => {
        if (!container || _alreadyFound.has(container)) return false;
        if (container.closest('nav, header, footer')) return false;
        // Collect direct children — accept li, a, button, div, or any element with numbered text
        const allChildren = Array.from(container.children);
        const directItems = allChildren.filter(el => {
          const tag = el.tagName.toLowerCase();
          return tag === 'li' || tag === 'a' || tag === 'button' || tag === 'div' ||
            el.getAttribute('role') === 'button' || el.getAttribute('role') === 'listitem';
        });
        // If direct children pass, use them; otherwise look one level deeper
        const candidates = directItems.length >= 2 ? directItems
          : Array.from(container.querySelectorAll(':scope > * > li, :scope > * > a, :scope > * > button, :scope > * > div'));
        if (candidates.length < 2 || candidates.length > 8) return false;
        const numberedCount = candidates.filter(it =>
          /^\s*0[1-9]/.test(it.textContent.trim())
        ).length;
        if (numberedCount < 2) return false;
        // Extract label text from inline nodes only — avoids nested block content
        // (e.g. hidden testimonial panels inside the same <li>)
        const _getInlineText = (el) => {
          let t = '';
          for (const node of el.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) t += node.textContent;
            else if (/^(A|SPAN|BUTTON|STRONG|EM|B|I|LABEL|SMALL)$/.test(node.nodeName)) t += node.textContent;
            if (t.trim().length > 60) break;
          }
          return t.trim() || el.textContent?.trim()?.split('\n')[0]?.trim() || '';
        };
        const labels = candidates
          .map(it => _getInlineText(it).replace(/^0[1-9]\s*/, '').replace(/\s+/g, ' ').trim().slice(0, 50))
          .filter(l => l.length > 1);
        if (labels.length < 2) return false;
        _alreadyFound.add(container);
        results.push({ type: 'sidebar-switcher', labels, hasNumbers: true, count: labels.length });
        return true;
      };

      // Pass 1: explicit class-based selectors
      document.querySelectorAll(
        '[class*="sidebar-list"], [class*="sidebar-nav"], [class*="side-nav"], [class*="content-nav"]'
      ).forEach(el => _extractSidebarFromContainer(el));

      // Pass 2: direct container scan — check every ul/ol/div for numbered direct children.
      // More reliable than TreeWalker: checks the CONTAINER level directly, so li-wrapped
      // items (where each <a> has a different <li> parent) are handled correctly.
      // Runs ALWAYS — _alreadyFound prevents duplicates.
      {
        const containerCandidates = Array.from(
          document.querySelectorAll('ul, ol, div, section, [class*="list"], [class*="menu"], [class*="items"]')
        ).slice(0, 800);
        for (const el of containerCandidates) {
          if (_alreadyFound.has(el)) continue;
          if (el.closest('nav, header, footer, script, style')) continue;
          const children = Array.from(el.children);
          if (children.length < 2 || children.length > 10) continue;
          // Count direct children whose text starts with a zero-padded number
          const numberedChildren = children.filter(child => {
            const txt = child.textContent?.trim() || '';
            return /^\s*0[1-9]/.test(txt);
          });
          if (numberedChildren.length >= 2) {
            _extractSidebarFromContainer(el);
          }
        }
      }
    }

    // Pattern C: split-content panels (image left + bullets right, with optional testimonial)
    const splitPanels = document.querySelectorAll('[class*="panel"], [class*="feature-panel"], [class*="content-panel"]');
    splitPanels.forEach(panel => {
      const img = panel.querySelector('img, video, canvas, svg[width]');
      const bullets = panel.querySelectorAll('li, [class*="bullet"], [class*="check"]');
      const testimonial = panel.querySelector('[class*="testimonial"], [class*="quote"], blockquote');
      if (img && bullets.length >= 2) {
        const cs = window.getComputedStyle(panel);
        if (cs.display === 'grid' || cs.display === 'flex') {
          results.push({ type: 'split-panel', hasBullets: true, bulletCount: bullets.length, hasTestimonial: !!testimonial, layout: cs.display });
        }
      }
    });

    return results.slice(0, 5);
  }

  // ─── Fixed / sticky UI chrome ───────────────────────────────────────────────
  function detectFixedUIChrome() {
    const results = [];
    const allEls = document.querySelectorAll('*');
    const viewH = window.innerHeight;
    const viewW = window.innerWidth;

    for (const el of allEls) {
      const cs = window.getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < viewW * 0.4) continue; // skip narrow sidebars
      if (rect.height < 30 || rect.height > viewH * 0.25) continue; // skip tiny or full-height

      const zIndex = parseInt(cs.zIndex) || 0;
      const bg = cs.backgroundColor;
      const hasButton = !!el.querySelector('button, a[class*="btn"], a[class*="cta"], [role="button"]');
      const text = el.textContent.trim().slice(0, 80);

      let role;
      if (rect.top < viewH * 0.15) {
        role = 'stickyHeader';
      } else if (rect.bottom > viewH * 0.85) {
        role = 'stickyBottom';
      } else {
        role = 'stickyAside';
      }

      results.push({ role, height: Math.round(rect.height), bg, hasButton, text, zIndex });
    }

    // Dedupe: keep highest z-index per role
    const seen = {};
    return results.filter(r => {
      if (!seen[r.role] || r.zIndex > seen[r.role].zIndex) { seen[r.role] = r; return true; }
      return false;
    });
  }

  // ─── Iconography & visual system extraction ─────────────────────────────────
  function extractIconographySystem() {
    const icons = { svgIcons: null, iconFonts: [], decorativeElements: [], system: null };
    const svgs = document.querySelectorAll('svg');

    // Exclude SVGs inside product UI containers (screenshots, demos, embedded apps)
    const UI_CONTAINER_SELECTOR = [
      '[class*="product"]', '[class*="screenshot"]', '[class*="demo"]',
      '[class*="sidebar"]', '[class*="app-"]', '[class*="-app"]',
      '[class*="preview"]', '[class*="mockup"]', '[class*="device"]',
      '[class*="table"]', '[class*="panel"]', '[class*="drawer"]',
      '[class*="modal"]', '[class*="dialog"]', '[class*="popover"]',
      '[role="application"]', '[role="grid"]', '[role="treegrid"]',
      '[role="toolbar"]', 'iframe', 'nav', 'footer',
    ].join(',');

    function isMarketingElement(el) {
      try { return !el.closest(UI_CONTAINER_SELECTOR); } catch(e) { return true; }
    }

    function getSvgContext(svg) {
      const section = svg.closest('section');
      if (section) {
        const cls = (section.className || '').toString();
        if (/hero/i.test(cls)) return 'hero';
        if (/feature/i.test(cls)) return 'feature-section';
        if (/testimonial/i.test(cls)) return 'testimonial';
        if (/pricing/i.test(cls)) return 'pricing';
        if (/cta/i.test(cls)) return 'cta-section';
        const firstWord = cls.split(/\s/)[0];
        if (firstWord && firstWord.length < 30) return firstWord;
      }
      const rect = svg.getBoundingClientRect();
      const viewH = window.innerHeight;
      if (rect.top < viewH * 0.3) return 'above-fold';
      return `~${Math.round(rect.top / viewH)}x viewport`;
    }

    // 1. Inline SVG icons (16-48px, exclude lines/dividers, product UI, and tiny chrome icons)
    const iconSvgs = Array.from(svgs).filter(svg => {
      const rect = svg.getBoundingClientRect();
      const w = Math.round(rect.width), h = Math.round(rect.height);
      if (h < 4 || w < 4) return false;
      if (w / h > 20 || h / w > 20) return false;
      // Marketing feature icons are 16px+ — skip tiny 12-15px UI chrome icons
      if (w < 16 || w > 48 || h < 16 || h > 48) return false;
      return isMarketingElement(svg);
    });
    const sizes = new Set();
    const strokeWidths = new Set();
    const fillColors = new Set();
    let strokeCount = 0, fillCount = 0;
    iconSvgs.slice(0, 30).forEach(svg => {
      const rect = svg.getBoundingClientRect();
      const w = Math.round(rect.width), h = Math.round(rect.height);
      if (w > 0) sizes.add(`${w}x${h}`);
      svg.querySelectorAll('path, line, polyline, circle, rect').forEach(p => {
        const pcs = window.getComputedStyle(p);
        if (pcs.strokeWidth && pcs.strokeWidth !== '0px' && pcs.stroke !== 'none') {
          strokeCount++;
          if (pcs.strokeWidth !== '1px') strokeWidths.add(pcs.strokeWidth);
        }
        const fill = pcs.fill;
        if (fill && fill !== 'none' && !isTransparent(fill)) {
          fillCount++;
          const hex = rgbToHex(fill);
          if (hex && !isBlackOrWhite(hex)) fillColors.add(hex);
        }
      });
    });
    if (iconSvgs.length > 0) {
      icons.svgIcons = {
        count: iconSvgs.length,
        dominantSizes: [...sizes].slice(0, 3),
        strokeWidths: strokeWidths.size > 0 ? [...strokeWidths].slice(0, 3) : ['1px'],
        style: strokeCount > fillCount ? 'outlined' : 'filled',
        strokeToFillRatio: strokeCount + fillCount > 0
          ? `${Math.round(strokeCount / (strokeCount + fillCount) * 100)}% outlined`
          : null,
        accentColors: [...fillColors].slice(0, 5),
      };
    }

    // 2. Icon font libraries
    const iconFontPatterns = [
      { name: 'Lucide', selector: '[class*="lucide"]' },
      { name: 'Heroicons', selector: '[class*="heroicon"]' },
      { name: 'Font Awesome', selector: '[class*="fa-"]' },
      { name: 'Material Icons', selector: '.material-icons, [class*="material-icon"]' },
      { name: 'Phosphor', selector: '[class*="ph-"]' },
      { name: 'Radix', selector: '[class*="radix-icon"]' },
      { name: 'Tabler', selector: '[class*="tabler-icon"]' },
    ];
    iconFontPatterns.forEach(({ name, selector }) => {
      try { if (document.querySelector(selector)) icons.iconFonts.push(name); } catch(e) {}
    });

    // 3. Decorative SVG elements (>200px, exclude lines and product UI)
    const largeSvgs = Array.from(svgs).filter(svg => {
      const rect = svg.getBoundingClientRect();
      const w = Math.round(rect.width), h = Math.round(rect.height);
      if (h < 4 || w < 4) return false;
      if (w / h > 20 || h / w > 20) return false;
      if (w <= 200 && h <= 200) return false;
      return isMarketingElement(svg);
    });
    icons.decorativeElements = largeSvgs.slice(0, 5).map(svg => {
      const rect = svg.getBoundingClientRect();
      const gradients = svg.querySelectorAll('linearGradient, radialGradient');
      const anims = svg.querySelectorAll('[class*="animate"], [style*="animation"]');
      return {
        size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
        context: getSvgContext(svg),
        hasGradients: gradients.length > 0,
        hasAnimations: anims.length > 0,
        gradientCount: gradients.length,
      };
    });

    // 4. System detection
    if (icons.iconFonts.length > 0) {
      icons.system = icons.iconFonts[0];
    } else if (icons.svgIcons && icons.svgIcons.count > 5) {
      icons.system = `Custom inline SVG (${icons.svgIcons.style})`;
    }

    return icons;
  }

  // ─── Message listener — page extraction only ────────────────────────────────
  // Picker commands (ACTIVATE_PICKER etc.) handled by lib/picker.js
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'EXTRACT_PAGE') {
      extractPageTokens().then(data => {
        sendResponse({ success: true, data });
      }).catch(err => {
        sendResponse({ success: false, error: err.message || 'Extraction failed' });
      });
    }
    return true;
  });
})();

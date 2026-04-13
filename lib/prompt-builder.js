// lib/prompt-builder.js
// Shared prompt generation — used by both popup.js and sidepanel.js
// DO NOT use Chrome APIs here — this file must be Chrome-API-free

function getMaxPromptLines(focus) { return (!focus || focus === 'all') ? 350 : 180; }

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function hexLum(hex) { if(!hex||hex.length<4)return 0.5; const h=hex.length===4?'#'+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3]:hex; const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); return(0.299*r+0.587*g+0.114*b)/255; }
function hexSat(hex) { if(!hex||hex.length<4)return 0; const h=hex.length===4?'#'+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3]:hex; const r=parseInt(h.slice(1,3),16)/255,g=parseInt(h.slice(3,5),16)/255,b=parseInt(h.slice(5,7),16)/255; const mx=Math.max(r,g,b),mn=Math.min(r,g,b); if(mx===mn)return 0; const l=(mx+mn)/2; return Math.round((l<=0.5?(mx-mn)/(mx+mn):(mx-mn)/(2-mx-mn))*100); }
function safeHostname(url) { try{return new URL(url).hostname;}catch{return 'unknown';} }
function _hexShift(hex, amount) { if(!hex||hex.length<4)return hex; const h=hex.length===4?'#'+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3]:hex; const r=Math.max(0,Math.min(255,parseInt(h.slice(1,3),16)+amount)); const g=Math.max(0,Math.min(255,parseInt(h.slice(3,5),16)+amount)); const b=Math.max(0,Math.min(255,parseInt(h.slice(5,7),16)+amount)); return '#'+[r,g,b].map(c=>c.toString(16).padStart(2,'0')).join(''); }
function _cssPropToTailwindHint(prop, value) {
  if (!prop || !value) return '';
  const v = value.trim();
  if (prop === 'transform') {
    const ty = v.match(/translateY\((-?[\d.]+)px\)/);
    if (ty) { const px = parseFloat(ty[1]); return px < 0 ? ` → hover:-translate-y-${Math.abs(px) <= 1 ? '0.5' : Math.round(Math.abs(px))}` : ` → hover:translate-y-${px <= 1 ? '0.5' : Math.round(px)}`; }
    const sc = v.match(/scale\(([\d.]+)\)/);
    if (sc) return ` → hover:scale-${Math.round(parseFloat(sc[1]) * 100)}`;
  }
  if (prop === 'opacity') { const n = parseFloat(v); if (!isNaN(n)) return ` → hover:opacity-${Math.round(n * 100)}`; }
  if (prop === 'background-color' && v.startsWith('#')) return ` → hover:bg-[${v}]`;
  if (prop === 'box-shadow' && v !== 'none') return ` → hover:shadow-[${v.replace(/\s+/g,'_')}]`;
  return '';
}
function dedupeColors(colors) { const s=new Set(); return colors.filter(c=>{if(!c||c.length<4)return false;const n=c.toLowerCase();if(s.has(n))return false;s.add(n);return true;}); }
function guessElementType(data) {
  const tag=data.tag||'',cls=(data.classes||'').toLowerCase();
  if(tag==='button'||cls.includes('btn'))return'Button'; if(tag==='nav'||cls.includes('navbar'))return'Navigation';
  if(tag==='header')return'Header'; if(tag==='footer')return'Footer'; if(cls.includes('card'))return'Card';
  if(tag==='input'||tag==='textarea')return'Input'; if(cls.includes('hero')||cls.includes('banner'))return'Hero';
  if(cls.includes('modal'))return'Modal'; if(tag==='a')return'Link'; return`<${tag}>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// RULE-BASED DIRECTION (fallback)
// ═══════════════════════════════════════════════════════════════════════════
function analyzeDesignStyle(data) {
  const colors=data.colors||[], accents=data.accentColors||[], fonts=(data.fonts||[]).filter(Boolean);
  const shadows=data.shadows||[], radii=data.borderRadii||[], vars=data.cssVars||{};
  const vp=data.visualProfile||{};
  const allColors=[...colors,...accents];

  // dark/light strictly from actual page background scan
  // heuristicBg only as last resort if detectActualPageBackground() returned null
  const sorted = dedupeColors(colors).sort((a,b)=>hexLum(b)-hexLum(a));
  const heuristicBg = sorted.find(c => hexLum(c) > 0.5 && hexSat(c) < 25)
    || sorted.find(c => hexSat(c) < 25)  // any low-sat color
    || null; // don't guess if we have nothing reliable

  const pageBg = data.pageBackground || heuristicBg;
  // If we genuinely don't know, default to light (most sites are light)
  const pageBgLum = pageBg ? hexLum(pageBg) : 0.85;
  const isDark = pageBgLum < 0.35;
  const isLight = pageBgLum > 0.5;

  const sats=allColors.map(hexSat), avgSat=sats.length?sats.reduce((a,b)=>a+b,0)/sats.length:0;
  const vibrantColors=allColors.filter(h=>hexSat(h)>45);
  // Monochromatic: if 80%+ of colors have sat < 15, the site is fundamentally monochromatic
  // even if 1-2 accent colors exist (e.g. a single pink CTA on an otherwise B&W site)
  const lowSatCount = allColors.filter(h => hexSat(h) < 8).length;
  const isVibrant=vibrantColors.length>0;
  const isMonochromatic = avgSat < 12 || (allColors.length > 3 && lowSatCount / allColors.length >= 0.8);
  const warmColors=allColors.filter(h=>{const r=parseInt(h.slice(1,3),16),b=parseInt(h.slice(5,7),16);return r-b>40;});
  const coolColors=allColors.filter(h=>{const r=parseInt(h.slice(1,3),16),b=parseInt(h.slice(5,7),16);return b-r>40;});
  const isCool=coolColors.length>warmColors.length, isWarm=warmColors.length>coolColors.length;

  // Fix 2: semantic colors from CSS vars — --primary etc. are designer intent
  const semanticColors = extractSemanticColors(vars);

  const primaryFont=(fonts[0]||'').toLowerCase();
  const isSerif=['georgia','merriweather','lora','playfair','freight','garamond','caslon','cormorant','baskerville'].some(f=>primaryFont.includes(f));
  const isMono=['mono','code','fira','jetbrains','courier','inconsolata'].some(f=>primaryFont.includes(f));
  const hasTwoFonts=fonts.length>=2;

  // Fix 3: 50% = circles/avatars, not interactive radius — exclude from pill detection
  const interactiveRadii = radii.filter(r=>!r.includes('50%'));
  const hasFullRound=interactiveRadii.some(r=>r.includes('9999')||r.includes('1000')||parseInt(r)>100);
  const hasSharpCorners=interactiveRadii.some(r=>parseInt(r)<=4&&r!=='0px');
  const hasRoundedCorners=interactiveRadii.some(r=>parseInt(r)>=8&&parseInt(r)<=32);

  // Glow = zero x/y offset with large blur, OR oklab/colored shadow (modern glow technique)
  const hasGlowEffect=shadows.some(s=>
    /\b0px\s+0px\s+\d+px/.test(s) ||       // traditional 0 0 blur glow
    /\b0\s+0\s+\d+px/.test(s) ||            // compact form
    s.includes('oklab(') ||                  // modern oklab glow (e.g. Koyeb)
    s.includes('oklch(')                     // oklch color glow
  );
  const hasLayeredShadows=shadows.some(s=>s.split(',').length>2);
  const hasColoredShadows=shadows.some(s=>!/rgba\(0,\s*0,\s*0|rgba\(255,\s*255,\s*255/.test(s)&&s!=='none');

  // Brutalist offset shadow pattern (e.g. 4px 4px 0 #color — hard drop shadow, no blur)
  const hasBrutalistShadow = shadows.some(s => /\d+px\s+\d+px\s+0(px)?\s/.test(s));

  // Detect brutalist hover shadows from hover states
  const hoverStates = data.hoverStates || [];
  const brutalistHoverShadows = hoverStates.filter(h =>
    h['box-shadow'] && /\d+px\s+\d+px\s+0(px)?\s/.test(h['box-shadow'])
  );

  // Glitch animation pattern detection from keyframes
  const keyframes = data.keyframes || [];
  const hasGlitchAnimation = keyframes.some(k =>
    /glitch/i.test(k.name) || (typeof k.from === 'object' && k.from.clip) || (typeof k.to === 'object' && k.to.clip)
  );
  const hasPulseAnimation = keyframes.some(k => /pulse|ping|beacon/i.test(k.name));
  const hasBlinkAnimation = keyframes.some(k => /blink|flicker/i.test(k.name));
  const hasTickerAnimation = keyframes.some(k => /ticker|marquee|scroll/i.test(k.name));

  // Section transition pattern — hard edge vs gradient between sections
  const sectionRhythm = vp?.sectionRhythm || [];
  let hasHardBgTransition = false;
  let hardTransitionColors = null;
  for (let i = 0; i < sectionRhythm.length - 1; i++) {
    const curr = sectionRhythm[i]?.bgHex;
    const next = sectionRhythm[i+1]?.bgHex;
    if (curr && next && curr !== next) {
      const lumDiff = Math.abs(hexLum(curr) - hexLum(next));
      if (lumDiff > 0.3) {
        hasHardBgTransition = true;
        hardTransitionColors = { from: curr, to: next };
        break;
      }
    }
  }

  return {
    isDark, isLight, isVibrant, isMonochromatic, isCool, isWarm,
    isSerif, isMono, hasTwoFonts,
    hasFullRound, hasSharpCorners, hasRoundedCorners,
    hasGlowEffect, hasLayeredShadows, hasColoredShadows,
    hasBrutalistShadow, brutalistHoverShadows,
    hasGlitchAnimation, hasPulseAnimation, hasBlinkAnimation, hasTickerAnimation,
    hasHardBgTransition, hardTransitionColors,
    vibrantColors, darkColors:allColors.filter(h=>hexLum(h)<0.18),
    lightColors:allColors.filter(h=>hexLum(h)>0.82),
    fonts, layout:data.layoutInfo||{}, vp,
    allColors, accents, colors, shadows, radii,
    pageBg, pageBgLum, semanticColors,
  };
}

// Extract semantic intent from CSS custom property names
// --primary, --brand, --colors--primary etc. are explicit designer decisions
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

// ─── Confidence scoring ─────────────────────────────────────────────────────

/**
 * Returns section-level confidence for extraction data.
 * 'high'   → definitive directive language ("Use exactly: #3A1DF5")
 * 'medium' → cautious language          ("Primary appears to be: #3A1DF5")
 * 'low'    → soft language + verify cue ("Color hint (verify): #3A1DF5")
 */
function scoreConfidence(data) {
  const vars = data.cssVars || {};
  const cssVarCount = Object.keys(vars).length;

  return {
    // Colors: CSS vars = reliable; computed-only = estimated
    colors: cssVarCount > 8 ? 'high' : cssVarCount > 2 ? 'medium' : 'low',

    // Typography: measured from live DOM if h1.fontSize is present
    typography: data.typographyPatterns?.h1?.fontSize ? 'high' : 'low',

    // Motion: animation library or multiple keyframes = reliable
    motion: (data.animationLibraries?.length > 0 || data.animations?.length > 2)
      ? 'high'
      : data.transitions?.length > 1 ? 'medium' : 'low',

    // Illustration: inline SVG extracted = high; image-type = low (can't read pixels)
    illustration: data.illustrationStyle?.svgCode
      ? 'high'
      : data.illustrationStyle?.type === 'illustration-image' ? 'low' : 'medium',

    // Section map: 3+ sections = reliable structure
    sectionMap: (data.sectionContentMap?.length || 0) >= 3 ? 'high' : 'medium',

    // Buttons: extractButtonStyles ran successfully
    buttons: data.buttonStyles?.primary ? 'high' : 'low',
  };
}

/**
 * Returns a language prefix appropriate for the confidence level.
 * High confidence → empty string (no qualifier needed).
 */
function confidencePrefix(level, type = 'value') {
  if (level === 'high') return '';
  if (level === 'medium') return 'appears to use ';
  if (type === 'color') return 'color hint (verify): ';
  if (type === 'font')  return 'font appears to be ';
  return 'likely ';
}

function isPlausibleHexColor(v) {
  return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim());
}

function resolvedPrimaryActionColor(data, style) {
  const sc = style?.semanticColors || {};
  const btnBg = data?.buttonStyles?.primary?.backgroundColor;

  // Priority 1: explicit semantic CSS var (--primary, --cta, --brand with sat guard)
  if (isPlausibleHexColor(sc.primary)) return sc.primary;

  // Priority 2: button background — saturation threshold removed.
  // Any hex within visible luminance range is a valid CTA color
  // (e.g. light sage #e4eac8 on dark green bg has low sat but IS the real CTA color)
  if (isPlausibleHexColor(btnBg) && hexLum(btnBg) > 0.05 && hexLum(btnBg) < 0.95) return btnBg;

  // Priority 3: vibrant accent (threshold lowered to 25 to catch muted brand colors)
  const accents = data?.accentColors || style?.accents || [];
  const vivid = accents.find(c => isPlausibleHexColor(c) && hexSat(c) > 15);
  return vivid || accents[0] || null;
}

function cleanPromptLines(lines) {
  return lines
    .map(l => (l || '').replace(/\[object Object\]/g, '').replace(/\s{2,}/g, ' ').trimEnd())
    .filter(l => {
      if (!l) return false;
      if (/line chart\.\s*0 line/i.test(l)) return false;
      if (/colors:\s*\[\s*\]/i.test(l)) return false;
      if (/^\s*(Hover before|Hover after|Hover):\s*$/.test(l)) return false;
      return true;
    });
}

function trimPagePromptByPriority(lines, maxLines = 350) {
  if (lines.length <= maxLines) return lines;
  const mustKeep = [];
  const optional = [];
  let section = '';
  for (const line of lines) {
    if (/^### /.test(line)) section = line;
    const isCore = /^### Core Spec \(Priority\)$/.test(section) ||
      /^### (Color Tokens|Typography Tokens|Shape Tokens|Motion Tokens)$/.test(section) ||
      /^### Design Direction$/.test(section) ||
      /^### Interaction Paradigm$/.test(section) ||
      /^### Section Content Map$/.test(section) ||
      /^### Component Patterns$/.test(section) ||
      /^Implementation notes:/.test(line);
    (isCore ? mustKeep : optional).push(line);
  }
  const out = [...mustKeep];
  for (const line of optional) {
    if (out.length >= maxLines) break;
    out.push(line);
  }
  return out.slice(0, maxLines);
}

function isMonoFontName(name) {
  const n = (name || '').toLowerCase();
  return /mono|jetbrains|fira code|source code|ibm plex mono|inconsolata|courier/.test(n);
}

function parsePx(v) {
  const n = parseFloat(String(v || '').replace('px', '').trim());
  return Number.isFinite(n) ? n : null;
}

function resolveTypographyRoles(data) {
  const tp = data.typographyPatterns || {};
  const assetFonts = data.assets?.fonts || [];
  const explicitFonts = (data.fonts || []).filter(Boolean);
  const headingCandidates = ['h1', 'h2', 'h3']
    .map(k => ({ t: tp[k], size: parsePx(tp[k]?.fontSize) || 0 }))
    .filter(x => x.t?.fontFamily);
  let heading = headingCandidates.sort((a, b) => b.size - a.size)[0]?.t?.fontFamily || assetFonts[0]?.family || explicitFonts[0] || null;
  const nonMonoLarge = headingCandidates.find(x => !isMonoFontName(x.t?.fontFamily) && x.size >= 24)?.t?.fontFamily;
  if (heading && isMonoFontName(heading) && nonMonoLarge) heading = nonMonoLarge;
  let body = tp.body?.fontFamily || assetFonts.find(f => f.family !== heading)?.family || explicitFonts.find(f => f !== heading) || heading;
  const label = tp.label?.fontFamily || body;
  // Only override mono body → heading if body was NOT explicitly detected from measured typography
  // (some sites genuinely use a mono font for body — e.g. AbcFavoritMono for labels/body)
  if (body && heading && isMonoFontName(body) && !isMonoFontName(heading) && !tp.body?.fontFamily) body = heading;
  return { heading, body, label };
}

// ────────────────────────────────────────────────────────────────────────────

function generateRuleBasedDirection(data, style) {
  const { isDark,isLight,isVibrant,isMonochromatic,isCool,isWarm,isSerif,isMono,hasTwoFonts,
    hasFullRound,hasSharpCorners,hasRoundedCorners,hasGlowEffect,hasLayeredShadows,hasColoredShadows,
    hasBrutalistShadow,brutalistHoverShadows,hasGlitchAnimation,hasPulseAnimation,hasBlinkAnimation,hasTickerAnimation,
    hasHardBgTransition,hardTransitionColors,
    vibrantColors,fonts,vp,accents,shadows,radii,pageBg,semanticColors } = style;
  const conf = scoreConfidence(data);
  const lines=[], vpr=vp||{}, ui=(vpr.uiPatterns)||{};
  const RULE_SYSTEM_FONTS = new Set(['ui-sans-serif','ui-serif','ui-monospace','ui-rounded',
    'system-ui','-apple-system','blinkmacsystemfont','helvetica neue','arial','sans-serif','serif','monospace']);
  const uniqueFonts=[...new Set((fonts||[]).map(f=>f.trim()))]
    .filter(f=>f.length>1&&!RULE_SYSTEM_FONTS.has(f.toLowerCase()));

  // Fix: primary = CSS var --primary first, then most saturated cool, then any vibrant
  const sc = semanticColors || {};
  const primaryColor = resolvedPrimaryActionColor(data, style)
    || (isCool ? vibrantColors.find(c=>{ const r=parseInt(c.slice(1,3),16),b=parseInt(c.slice(5,7),16); return b>r&&hexSat(c)>45; }) : null)
    || vibrantColors[0] || accents[0];
  const secondaryColor = sc.secondary
    || vibrantColors.find(c=>c!==primaryColor&&hexSat(c)>35)
    || accents.find(c=>c!==primaryColor);
  const multiAccent = sc.accent.length>1 || vibrantColors.filter(c=>c!==primaryColor&&hexSat(c)>35).length>0;

  // Shape: ignore 50% (circles), real interactive radius
  const interactiveRadii = radii.filter(r=>!r.includes('50%'));
  const radiusSample = interactiveRadii.find(r=>parseInt(r)>=4&&parseInt(r)<=24) || interactiveRadii[0];

  // Overall character
  lines.push('**Overall character**');
  const hasDecorGeom = ui.hasDecorativeGeometry;
  const hasIconSys = ui.hasIconSystem;

  if (vpr.imageTreatment==='cinematic'&&vpr.sectionColorPattern==='alternating') {
    lines.push('Dual-mode landing: light sections alternate with immersive dark photography sections. The tonal flip is dramatic and intentional.');
  } else if (isDark&&isVibrant&&isCool) {
    lines.push('Dark-first SaaS with saturated cool accents. High contrast, technically confident, engineer-facing.');
  } else if (isDark&&isVibrant) {
    lines.push('Dark-first product with bold color accents. High contrast, technically confident.');
  } else if (isDark) {
    lines.push('Dark-dominant design — deep surfaces, minimal color. Typography and space carry the weight.');
  } else if (isLight&&isMonochromatic&&hasDecorGeom) {
    lines.push('Editorial, light-dominant design with restrained neutral palette and abstract geometric decoration. Clean and sophisticated — conveys trustworthiness through whitespace and type weight rather than color. Warm off-white surfaces ('+(pageBg||'#f5f5f0')+') prevent clinical coldness.');
  } else if (isLight&&isMonochromatic) {
    lines.push('Clean, light-dominant layout. Neutral palette, content-first, trust-building. Enterprise or developer audience.');
  } else if (isLight&&isCool&&isVibrant&&primaryColor) {
    lines.push('Light base with a strong cool-toned primary action (`'+primaryColor+'`). Professional, precise, developer-friendly. Accent used surgically — only at decision points.');
  } else if (isLight&&isVibrant&&primaryColor) {
    lines.push('Light base with expressive accent (`'+primaryColor+'`). Clean foundation, color reserved for interactive moments. Consumer-friendly energy without sacrificing credibility.');
  } else if (isLight&&isWarm) {
    lines.push('Warm, light-dominant layout. Approachable, human, premium without being cold. '+(hasDecorGeom?'Abstract geometric shapes add depth without photography.':''));
  } else {
    lines.push('Modern B2B product landing — confident layout, restrained color, strong typographic hierarchy.');
  }
  lines.push('');

  // Section rhythm
  lines.push('**Section rhythm & color hierarchy**');
  const bgRef = pageBg ? '`'+pageBg+'`' : (isDark ? 'dark neutral' : 'light neutral');

  // Rule: pageBgLum is the ground truth. Section pattern is secondary signal.
  // Never say "dark" unless pageBgLum confirms it (< 0.3).
  if (vpr.sectionColorPattern==='alternating') {
    const rhythmColors = (vpr.sectionRhythm || []).filter(s => s.bgHex).map(s => s.bgHex);
    const uniqueColors = [...new Set(rhythmColors)];
    const colorDesc = uniqueColors.length > 0 ? ` Background colors cycle through: ${uniqueColors.join(' ↔ ')}.` : '';
    lines.push('Sections alternate between distinct background colors.' + colorDesc + ' Each section change is a deliberate visual shift — maintain the exact background color for each section as specified in the Section Content Map below.'+(vpr.hasGradientSection?' One gradient section as visual breathing space — use once only.':''));
  } else if (isDark) {
    // Only branch into dark descriptions when page background is actually dark
    lines.push('Consistently dark ('+bgRef+' base). Differentiate sections through subtle surface shifts — slightly lighter sub-surfaces (8–12% opacity white overlay), thin border-top lines between sections. Never flip to white mid-page.');
  } else if (vpr.sectionColorPattern==='progressive-dark' && isLight) {
    lines.push('Opens light ('+bgRef+'), sections shift progressively darker. One near-black CTA or footer section closes the page — use '+bgRef+' for the hero and upper sections, reserve dark only for the closing conversion zone.');
  } else if (isLight) {
    // Default for light sites — both uniform-light and unknown patterns
    lines.push('Consistently light throughout ('+bgRef+' base). Sections distinguish through subtle background tints — e.g. pure white vs '+(pageBg||'#f5f5f0')+' warm off-white — never dark backgrounds. Generous vertical padding (80–120px) between sections creates breathing room without color contrast.');
  } else {
    lines.push('Predominantly light ('+bgRef+' base). Sections differentiate through subtle bg shifts — 3–5% darker variants.'+(vpr.hasGradientSection?' One gradient section provides visual relief.':''));
  }
  // Hard bg transitions between sections
  if (hasHardBgTransition && hardTransitionColors) {
    lines.push(`**Hard color transition** detected: \`${hardTransitionColors.from}\` → \`${hardTransitionColors.to}\` with no gradient — a sharp, intentional edge between sections. This is a deliberate design choice (not a bug). Reproduce as a hard background-color switch, not a gradient blend.`);
  }
  lines.push('');

  // Image usage
  lines.push('**Image usage & visual treatment**');
  if (vpr.imageTreatment==='cinematic'||vpr.hasFullBleedImages) {
    lines.push('Full-bleed cinematic photography as section atmosphere — wide, moody, environmental. Images carry emotional weight, not informational.'
      +(vpr.hasGlassmorphism?' Glassmorphism cards (backdrop-filter: blur) float over photography.':'')
      +(vpr.hasOverlaidUIOnPhoto?' Product UI overlaid directly on photography.':''));
  } else if (vpr.imageTreatment==='screenshot') {
    lines.push('Product screenshots as the primary visual — real UI in context. Rounded corners, soft shadow. Light screenshots on light sections, dark on dark.');
  } else if (vpr.hasLogoStrip||ui.hasLogoStrip) {
    lines.push('Integration/partner logos are a key visual element — scrolling strips or organized grids. Technical diagrams (data flow, API schemas) appear in feature sections. No decorative photography.');
  } else {
    lines.push('Minimal imagery — design relies on typography, color, and space. Any visuals are functional: diagrams, UI mockups, icons.');
  }
  if (ui.hasDecorativeGeometry) {
    lines.push('Subtle decorative SVG elements present as background atmosphere — keep very minimal, opacity 0.05–0.10. Do NOT add grid overlays, dot patterns, or crop marks. Decoration should be barely visible.');
  }
  if (vpr.hasNoiseTexture) {
    lines.push('Noise/grain texture overlay on backgrounds — apply a subtle grainy SVG or CSS noise filter (`filter: url(#noise)` or repeating SVG background-image) at ~5–15% opacity across main surfaces. Creates a tactile, editorial quality.');
  }
  if (vpr.splitLayoutCount>1) lines.push(vpr.splitLayoutCount+' split-column sections — alternate text/visual side each row for scroll rhythm.');
  lines.push('');

  // Typography — correctly identify display vs body fonts
  lines.push('**Typography**');
  
  const MONO_KW = ['mono','code','fira','jetbrains','courier','inconsolata','ibm plex mono','space mono','source code'];
  const DISPLAY_KW = ['display','headline','heading','anton','impact','bebas','oswald','barlow condensed','black','ultra','heavy','poster','playfair','merriweather','lora','garamond'];

  function classifyFontRole(name) {
    const n = name.toLowerCase();
    if (MONO_KW.some(k=>n.includes(k))) return 'mono';
    if (DISPLAY_KW.some(k=>n.includes(k))) return 'display';
    return 'sans';
  }

  // Use typographyPatterns as ground truth — avoids font list ordering bugs
  const tp_dir = data.typographyPatterns || {};
  const h1FontGT = tp_dir.h1?.fontFamily;
  const bodyFontGT = tp_dir.body?.fontFamily;

  if (h1FontGT && bodyFontGT && h1FontGT !== bodyFontGT) {
    const h1Size = tp_dir.h1 ? `${tp_dir.h1.fontSize}/${tp_dir.h1.fontWeight}` : '48–72px/700';
    const bodySize = tp_dir.body ? `${tp_dir.body.fontSize}/${tp_dir.body.fontWeight}` : '16–18px/400';
    const lh = tp_dir.body?.lineHeight ? `, line-height ${tp_dir.body.lineHeight}` : '';
    const bodyType = classifyFontRole(bodyFontGT);
    if (bodyType === 'mono') {
      lines.push(`Two-font system: "${h1FontGT}" for display headings (${h1Size}); "${bodyFontGT}" (monospace) for body and UI — reinforces developer positioning. Keep roles strict: display font for brand moments, mono for functional copy.`);
    } else if (isSerif) {
      lines.push(`Serif display ("${h1FontGT}") for headings, clean sans ("${bodyFontGT}") for body. H1: ${h1Size}. The typeface contrast IS the design — never use the sans for headlines.`);
      const _h1tp = data.typographyPatterns?.h1;
      const _isDisplaySerif = _h1tp && (parseInt(_h1tp.fontWeight) >= 700 || (_h1tp.letterSpacing && parseFloat(_h1tp.letterSpacing) < 0));
      if (_isDisplaySerif) {
        lines.push(
          `Display serif ("${h1FontGT}") — HIGH CONTRAST editorial character: ` +
          `thick/thin stroke ratio is the defining visual. ` +
          `Font weight: ${_h1tp.fontWeight || '700–800'}. ` +
          `Letter-spacing: ${_h1tp.letterSpacing || 'tight, -0.02em'}. ` +
          `H1 size: ${_h1tp.fontSize || 'clamp(48px, 7vw, 96px)'}. ` +
          `⚠️ Do NOT use Inter, Playfair Display, or generic serif — ` +
          `source the exact font or the closest high-contrast alternative (Canela, Freight Display, Editorial New). ` +
          `The thick/thin contrast IS the brand — a low-contrast serif destroys the identity.`
        );
      }
    } else {
      lines.push(`Two-font system: "${h1FontGT}" for headings (${h1Size}); "${bodyFontGT}" for body and UI (${bodySize}${lh}). Distinct registers — never blur the roles.`);
    }
    // Detect a third typeface used for subheadings (e.g. Geist Mono for H2/H3)
    const subheadFontGT = tp_dir.h2?.fontFamily || tp_dir.h3?.fontFamily;
    if (subheadFontGT && subheadFontGT !== h1FontGT && subheadFontGT !== bodyFontGT) {
      const subType = classifyFontRole(subheadFontGT);
      if (subType === 'mono') {
        lines.push(`Third typeface: "${subheadFontGT}" (monospace) for H2–H3 subheadings — technical register at mid-hierarchy. Use strictly for H2–H3, never for hero text or body copy.`);
      } else {
        lines.push(`Third typeface: "${subheadFontGT}" for H2–H3 subheadings — distinct register at mid-hierarchy. Do not use for hero text or body copy.`);
      }
    }
  } else if (h1FontGT) {
    lines.push(`Single typeface: "${h1FontGT}" — hierarchy via weight and size contrast.`);
  } else if (uniqueFonts.length >= 2) {
    // Fallback: heuristic classification
    const classified = uniqueFonts.slice(0,2).map(f=>({name:f, type:classifyFontRole(f)}));
    const disp = classified.find(f=>f.type==='display') || classified.find(f=>f.type!=='mono') || classified[0];
    const body = classified.find(f=>f!==disp) || classified[1];
    const bodyType = body.type;
    if (bodyType === 'mono') {
      lines.push('Two-font system: "'+disp.name+'" for display headings; "'+body.name+'" (monospace) for body and UI — reinforces developer positioning. Keep roles strict.');
    } else if (isSerif) {
      lines.push('Serif display ("'+disp.name+'") for headings, clean sans ("'+body.name+'") for body. The typeface contrast IS the design — never use the sans for headlines.');
    } else {
      lines.push('Two-font system: "'+disp.name+'" for headings (700–800 weight), "'+body.name+'" for body and UI (400). Distinct weight and style registers — never blur the boundaries.');
    }
  } else if (isMono && uniqueFonts[0]) {
    lines.push('Monospace ("'+uniqueFonts[0]+'") — technical, code-adjacent. Tracked uppercase for section labels. H1: clamp(40px,5vw,64px)/700, body: 16–18px/400.');
  } else if (uniqueFonts[0]) {
    lines.push('Single typeface ("'+uniqueFonts[0]+'") — hierarchy via weight (300/400/600/800) and size. H1: clamp(40px,5vw,72px)/700–800, body: 16–18px/400.');
  } else {
    lines.push('System font — weight and size contrast only. H1: 56–72px/700, body: 16–18px/400.');
  }
  lines.push('');

  // Color usage
  lines.push('**Color usage**');
  if (primaryColor&&isDark) {
    lines.push('Dark surfaces ('+bgRef+'). `'+primaryColor+'` is the primary action color — CTAs, links, focus rings, active states.'
      +(secondaryColor&&secondaryColor!==primaryColor?' `'+secondaryColor+'` is secondary — specific badges or callouts, not interchangeable with primary.':''));
  } else if (primaryColor&&isLight&&multiAccent) {
    // Multiple named accents — explain each role clearly
    const namedAccents = sc.accent.slice(0,4);
    let colorDesc = '`'+primaryColor+'` (primary action — CTAs, links, focus)';
    if (secondaryColor && secondaryColor !== primaryColor) {
      colorDesc += '. `'+secondaryColor+'` secondary accent — category/state/decoration, never swap with primary';
    }
    if (namedAccents.length > 0) {
      const others = namedAccents.filter(a=>a.value!==primaryColor&&a.value!==secondaryColor).slice(0,2);
      if (others.length) colorDesc += '. Named accents: '+others.map(a=>'`'+a.value+'` ('+a.key+')').join(', ')+' — assign to specific semantic roles (e.g. developer callouts, code highlighting)';
    }
    lines.push('Light surfaces ('+bgRef+'). Color used sparingly — white/neutral dominates. '+colorDesc+'. Backgrounds: white + `'+(pageBg||'#f5f5f0')+'` eggshell for section variation.');
  } else if (primaryColor&&isLight) {
    lines.push('Light surfaces ('+bgRef+'). `'+primaryColor+'` is the sole action color — CTAs, links, focus rings. Restraint gives it impact; use only at decision points. Neutral palette everywhere else.');
  } else {
    lines.push('Neutral palette. Accent appears at interactive moments only — CTAs, active states, highlights.');
  }
  lines.push('');

  // Shape & elevation
  lines.push('**Shape & elevation**');
  if (hasFullRound&&hasGlowEffect) {
    lines.push('Pill-shaped interactive elements (border-radius: 9999px) with glow elevation. Hover: glow expands.'+(hasColoredShadows?' Shadow color matches accent color.':'')+' Soft-tech aesthetic.');
  } else if (hasFullRound) {
    lines.push('Pills (9999px) for buttons/badges. Containers: '+(radiusSample||'12px')+' radius. Two distinct registers — never mix.');
  } else if (hasSharpCorners&&!hasRoundedCorners) {
    lines.push('Sharp geometry — border-radius: '+(radiusSample||'4px')+'. Engineered, constructed feel.'+(hasLayeredShadows?' Layered shadows for depth.':''));
  } else if (hasRoundedCorners) {
    lines.push('Moderate rounding ('+(radiusSample||'8–12px')+') — contemporary and neutral.'+(hasLayeredShadows?' Layered shadows — don\'t simplify to a single layer.':''));
  } else {
    lines.push('Consistent '+(radiusSample||'6–8px')+' radius. Precision over decoration.');
  }
  // Brutalist offset shadow
  if (hasBrutalistShadow) {
    let brutDesc = 'Brutalist elevation: hard drop-shadows with zero blur (e.g. `4px 4px 0 color`).';
    if (brutalistHoverShadows?.length > 0) {
      const samples = brutalistHoverShadows.slice(0, 2);
      brutDesc += ' Hover states use offset shadow as a design motif:';
      samples.forEach(h => {
        brutDesc += ` \`${h.selector.replace(/\[data-astro[^\]]*\]/g,'').slice(0,30)}:hover\` → \`box-shadow: ${h['box-shadow']}\`.`;
      });
      brutDesc += ' This is a defining interaction pattern — reproduce exactly.';
    }
    lines.push(brutDesc);
  }
  if (vpr.hasGlassmorphism) {
    const glassData = data.cssVars || {};
    let glassDesc = 'Glassmorphism panels: ';
    // Try to find actual glassmorphism values from the page
    const glassBg = Object.entries(glassData).find(([k]) => /glass|frost|blur|overlay/i.test(k));
    glassDesc += 'background rgba(255,255,255,0.03–0.08), backdrop-filter:blur(12–20px), border 1px solid rgba(255,255,255,0.08–0.12). ';
    glassDesc += 'These panels float above the base surface — use them for cards, modals, nav on scroll. The frosted effect is subtle, not milky.';
    lines.push(glassDesc);
  }
  lines.push('');

  // ── Animation & Motion (deep profile) ──
  lines.push('**Animation & motion**');
  const ap = vpr.animationPatterns || {};
  const mp = data.motionProfile || {};
  const heroSeq = data.heroEntranceSequence || null;
  const riveData = data.riveAndLottie || null;
  const animLibs = data.animationLibraries || [];

  // Motion personality
  if (mp.timingPersonality) {
    const personalities = {
      'snappy':    'Motion personality: **snappy** — interactions respond in <200ms. Micro-interactions feel mechanical and precise.',
      'smooth':    'Motion personality: **smooth** — 300–400ms transitions. Polished, contemporary SaaS feel.',
      'editorial': 'Motion personality: **editorial** — 500–700ms reveals. Content enters with deliberate pace, like a magazine.',
      'cinematic': 'Motion personality: **cinematic** — 800ms+ transitions. Slow, theatrical entrance choreography.',
      'springy':   'Motion personality: **springy** — spring/overshoot easing (cubic-bezier with y>1). Elements overshoot target slightly before settling. Do NOT replace with ease-out.',
    };
    let pLine = personalities[mp.timingPersonality] || '';
    if (mp.dominantDuration) pLine += ` Base duration: ${mp.dominantDuration}.`;
    if (mp.dominantEasing && !/^ease/.test(mp.dominantEasing)) pLine += ` Dominant easing: \`${mp.dominantEasing}\`.`;
    if (pLine) lines.push(pLine);
  }

  // Scroll paradigm
  if (mp.scrollParadigm === 'scroll-scrub') {
    lines.push('⚠️ **Scroll-scrub paradigm** — animations are TIED TO SCROLL POSITION, not triggered once. Use GSAP `scrub: true` or CSS `animation-timeline: scroll()`. Elements animate forward/backward as user scrolls. IntersectionObserver alone will NOT recreate this.');
    if (mp.gsapScrollTriggers?.length > 0) {
      const scrubTriggers = mp.gsapScrollTriggers.filter(t => t.scrub);
      if (scrubTriggers.length > 0) {
        lines.push('Scrubbed triggers: ' + scrubTriggers.map(t => `\`${t.trigger}\` start:"${t.start}"${t.pin ? ' pin:true' : ''}`).join(', ') + '.');
      }
    }
  } else {
    // Trigger-based reveals
    if (mp.revealStyle) {
      const revealDescriptions = {
        'clip-path-reveal':   'Scroll reveals: **clip-path mask** — `clip-path: inset(100% 0 0 0)` → `inset(0)`. NOT a fade-up. Do not substitute with opacity.',
        'mask-reveal':        'Scroll reveals: **overflow mask** — parent `overflow:hidden`, child animates `translateY(-100%→0)` or `scaleY(0→1)`. Content sweeps in from behind clip boundary.',
        'fade-up':            'Scroll reveals: **fade-up** — `opacity:0→1` + `translateY(30px→0)`, IntersectionObserver at `threshold:0.15`. `will-change: transform, opacity`.',
        'fade-left-or-right': 'Scroll reveals: **horizontal fade** — `translateX(±40px→0)` + opacity. Direction alternates per section.',
        'fade-only':          'Scroll reveals: **pure fade** — `opacity:0→1` only, no transform. Editorial, clean.',
        'scale-in':           'Scroll reveals: **scale entrance** — `scale(0.88)→1` + opacity 0→1 on scroll trigger.',
      };
      lines.push(revealDescriptions[mp.revealStyle] || `Scroll reveals: ${mp.revealStyle}.`);
    } else if (vpr.hasScrollAnimation) {
      lines.push('Scroll-triggered reveals: `opacity:0→1`, `translateY(24px→0)`, ~400ms ease-out, IntersectionObserver threshold 0.15.');
    } else if (hasGlowEffect && isDark) {
      lines.push('Hover: glow deepens and expands on `box-shadow`, 200–300ms ease-out.');
    } else if (conf.motion === 'low') {
      lines.push('Motion: scroll-triggered reveals likely present (animation library not detected — verify with DevTools). Safe default: `opacity:0→1` + `translateY(20px→0)`, 400ms ease-out.');
    } else {
      lines.push('Subtle — fade + `translateY` on scroll entry, ' + (hasLayeredShadows ? 'shadow lifts' : 'opacity/color shift') + ' on hover, 150–200ms ease-in-out.');
    }
    if (mp.staggerPattern) {
      lines.push(`Stagger: child elements enter with **${mp.staggerPattern.delayBetween} delay** between each (${mp.staggerPattern.elementCount} elements). Use \`transition-delay\` or Framer Motion \`staggerChildren: ${parseFloat(mp.staggerPattern.delayBetween)/1000}\`.`);
    }
  }

  // Hero entrance sequence
  if (heroSeq) {
    if (heroSeq.hasCanvasAnimation || heroSeq.hasSvgAnimation) {
      let heroAnimLine = '**Hero animation**: ';
      if (heroSeq.hasCanvasAnimation) {
        heroAnimLine += `Canvas (${heroSeq.canvasSize?.w||'?'}×${heroSeq.canvasSize?.h||'?'}px) — `;
        heroAnimLine += riveData?.hasRive ? 'Rive confirmed. See Rive section below.' : 'Likely Rive, Three.js, or custom WebGL. Use animated SVG or Framer Motion morphing paths as fallback.';
      }
      if (heroSeq.hasSvgAnimation) heroAnimLine += ' SVG SMIL animation — use CSS @keyframes equivalent.';
      lines.push(heroAnimLine);
    }
    if (heroSeq.elements?.some(e => e.delay)) {
      const seqItems = heroSeq.elements.filter(e => e.delay).sort((a,b) => parseInt(a.delay||0) - parseInt(b.delay||0)).slice(0,6);
      lines.push('**Hero entrance sequence** (in order):');
      seqItems.forEach((el, i) => {
        lines.push(`  ${i+1}. \`<${el.tag}>\` "${el.text.slice(0,30)}" — delay: ${el.delay}${el.duration ? ', duration: '+el.duration : ''}`);
      });
    } else if (heroSeq.elements?.some(e => e.opacity === 'starts-invisible')) {
      lines.push('Hero elements start invisible, revealed by JS — stagger with 80–120ms delay per element in DOM order.');
    }
  }

  // Rive / Lottie
  if (riveData) {
    let _lottieWritten = 0; // dedup guard — max 1 Lottie line regardless of element count
    for (const det of riveData.details) {
      if (det.type === 'rive' || det.type === 'canvas-hero-animation') {
        lines.push(`**Rive animation** (${det.location}, ${det.size?.w}×${det.size?.h}px)${det.dataSrc ? `, file: \`${det.dataSrc}\`` : ''}. State-machine-driven loop. Recreation options:`);
        lines.push('  A: Import .riv via `@rive-app/react-canvas` → `<RiveComponent />`');
        lines.push('  B: Animated SVG with `@keyframes` morphing paths');
        lines.push('  C: `<motion.path>` Framer Motion for simple shape morphing');
      }
      if (det.type === 'lottie') {
        if (_lottieWritten >= 1) continue;
        _lottieWritten++;
        lines.push(
          `**Lottie animation** (${det.location}, ` +
          `${det.loop ? 'looping' : 'one-shot'}, ` +
          `${det.autoplay ? 'autoplay' : 'triggered'})` +
          `${det.src ? `, file: \`${det.src}\`` : ''}. ` +
          `Use \`<dotlottie-react>\` or \`lottie-react\` with the JSON source.`
        );
      }
    }
  }

  // Library stack
  if (animLibs.length > 0) {
    const libHints = [];
    if (animLibs.includes('gsap')) {
      const hasScrub = mp.gsapScrollTriggers?.some(t => t.scrub);
      libHints.push(hasScrub
        ? '**GSAP scrub** — `gsap.to(el, { y:-100, ease:"none", scrollTrigger:{ trigger:el, start:"top bottom", end:"bottom top", scrub:1 } })`'
        : '**GSAP + ScrollTrigger** — `gsap.from(el, { opacity:0, y:40, duration:0.6, ease:"power2.out", scrollTrigger:{ trigger:el, start:"top 80%", once:true } })`');
      if (mp.gsapScrollTriggers?.some(t => t.pin)) libHints.push('Pinned sections detected — use `pin:true` with ScrollTrigger.');
    }
    if (animLibs.includes('lenis')) libHints.push('**Lenis** — `new Lenis({ duration:1.2, easing:t=>Math.min(1, 1.001-Math.pow(2,-10*t)) })`, sync in RAF loop.');
    if (animLibs.includes('locomotive-scroll')) libHints.push('**Locomotive Scroll** — `data-scroll-container`, `data-scroll`, `data-scroll-speed="0.5"` for parallax.');
    if (animLibs.includes('three.js')) libHints.push('**Three.js (WebGL)** — recreate as CSS `radial-gradient` mesh or React Three Fiber `<Canvas>`.');
    if (animLibs.includes('framer-motion')) libHints.push('**Framer Motion** — `<motion.div initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} transition={{duration:0.5,ease:[0.16,1,0.3,1]}} viewport={{once:true}}>`');
    if (animLibs.includes('anime.js')) libHints.push('**Anime.js** — `anime({ targets:".el", opacity:[0,1], translateY:[30,0], delay:anime.stagger(80), duration:600, easing:"easeOutExpo" })`');
    if (animLibs.includes('aos')) libHints.push('**AOS** — `data-aos="fade-up"` `data-aos-duration="600"` on elements. Init: `AOS.init({ once:true, offset:80 })`');
    if (libHints.length > 0) lines.push('Animation stack: [' + animLibs.join(', ') + ']. ' + libHints.join(' '));
  }

  // Micro-interactions
  if (ap.hasArrowAnimation) lines.push('Arrow CTAs: `→` translates `+4px` right on hover — `transform:translateX(4px)`, `transition:transform 200ms ease`.');
  if (hasGlitchAnimation) lines.push('**Glitch effect**: `clip-path`/`clip:rect()` rapid keyframe steps — VHS/digital distortion. Reproduce the jitter timing exactly; do not substitute with a shake.');
  if (hasPulseAnimation) lines.push('Pulse/beacon: `scale(1→2)` + `opacity(0.4→0)` ring — status indicator or live signal.');
  if (hasBlinkAnimation) lines.push('Blink/cursor: `opacity 1→0→1` at 1s interval — terminal aesthetic.');
  if (ap.hasSlider) lines.push('Content slider' + (ap.sliderType === 'swiper' ? ' (Swiper)' : '') + ': horizontal snap, auto-play, pause on hover.');
  if (vpr.navStyle === 'transparent-hero') lines.push('Nav: starts transparent → `backdrop-filter:blur(12px)` + `background:rgba(bg,0.85)` at ~80px scroll.');
  if (vpr.blendModes?.length > 0 && !(ui.hasMarquee && vpr.blendModes.length === 1 && vpr.blendModes[0] === 'lighten')) {
    lines.push('`mix-blend-mode: ' + vpr.blendModes.join(', ') + '` on overlaid elements.');
  }
  if (ui.hasMarquee || ui.hasLogoStrip || hasTickerAnimation) {
    let mq = 'Ticker/marquee: `@keyframes { to { transform:translateX(-50%) } }` 30–40s linear infinite.';
    if (vpr.blendModes?.includes('lighten')) mq += ' `mix-blend-mode:lighten` — logos blend as light overlays into dark bg.';
    lines.push(mq);
  }
  if (vpr.hasFloatingCards) lines.push('Floating card depth — recreate with `translateZ` or shadow stacking.');
  if (vpr.hasParallaxHint) {
    const pd = vpr.parallaxDetails || [];
    let pLine = 'Parallax: background moves at different speed than foreground content.';
    const hasBgFixed = pd.some(d => d.method === 'background-attachment-fixed');
    const speedAttrs = pd.filter(d => d.method === 'data-attribute' && d.speed);
    const has3d = pd.some(d => d.method === 'transform-3d');
    if (hasBgFixed) pLine += ' CSS approach: `background-attachment: fixed` on hero/section backgrounds.';
    if (speedAttrs.length > 0) {
      const speeds = speedAttrs.map(s => s.speed).join(', ');
      pLine += ` Scroll-speed ratios detected: [${speeds}] — use JS scroll listener or Rellax.js with matching speed values.`;
    }
    if (has3d) pLine += ' 3D transform approach: `perspective` + `translateZ()` on layered elements.';
    if (!hasBgFixed && !has3d && speedAttrs.length === 0) pLine += ' Implement via CSS `background-attachment:fixed` or JS `transform:translateZ()` with `perspective`.';
    lines.push(pLine);
  }

  // Ambient / always-on animations
  if (data.ambientAnimations?.length > 0) {
    const classifyAnim = (name) => {
      const n = name.toLowerCase();
      if (/gradient|hue|color-shift/.test(n)) return 'gradient-drift';
      if (/float|bob|levitate|hover-float/.test(n)) return 'float';
      if (/rotate|spin|revolve/.test(n)) return 'rotate';
      if (/pulse|heartbeat|throb/.test(n)) return 'pulse';
      if (/glow|shine|shimmer/.test(n)) return 'glow';
      if (/drift|slide|move/.test(n)) return 'drift';
      if (/bounce|jump/.test(n)) return 'bounce';
      if (/scale|breathe|grow-shrink/.test(n)) return 'scale-breathe';
      return 'custom';
    };
    const groups = {};
    data.ambientAnimations.forEach(a => {
      const type = classifyAnim(a.name);
      if (!groups[type]) groups[type] = [];
      groups[type].push(a);
    });
    const typeDescs = {
      'gradient-drift': '`background-size: 200% 200%` + `@keyframes` shifting `background-position`.',
      'float': '`translateY(±8px)` oscillation, ease-in-out.',
      'rotate': '`rotate(0deg → 360deg)` linear.',
      'pulse': '`scale(1 → 1.05 → 1)` ease-in-out.',
      'glow': '`box-shadow` or `opacity` oscillation, ease-in-out.',
      'drift': '`translate()` with long duration (8–20s), ease-in-out.',
      'bounce': '`translateY` with cubic-bezier overshoot.',
      'scale-breathe': '`scale(0.98 → 1.02)` gentle oscillation, ease-in-out.',
      'custom': 'Recreate with `animation-iteration-count: infinite`.',
    };
    lines.push('**Ambient / always-on animations** (loop infinite):');
    for (const [type, anims] of Object.entries(groups)) {
      const durations = anims.map(a => a.duration).filter(Boolean).join(', ');
      const desc = typeDescs[type] || typeDescs['custom'];
      lines.push(`- **${type}** (${anims.length}×, duration: ${durations}): ${desc}`);
    }
  }

  lines.push('');

  // ── Dual-personality color architecture detection ──
  const _scmDp = data.sectionContentMap || [];
  if (_scmDp.length >= 2) {
    const _heroSec = _scmDp[0];
    const _nextSec = _scmDp[1];
    const _heroBg = _heroSec?.bgColor;
    const _nextBg = _nextSec?.bgColor;
    if (_heroBg && _nextBg) {
      const _heroLum = hexLum(_heroBg);
      const _nextLum = hexLum(_nextBg);
      if (Math.abs(_heroLum - _nextLum) > 0.4) {
        const _hasMarquee = ui.hasMarquee || ui.hasLogoStrip || vpr.animationPatterns?.hasTicker;
        lines.push(
          `**Color architecture — dual personality:**\n` +
          `Hero section: full-viewport \`${_heroBg}\` (${_heroLum > 0.5 ? 'LIGHT/VIVID' : 'DARK'}).\n` +
          `ALL subsequent sections: \`${_nextBg}\` (${_nextLum < 0.2 ? 'NEAR-BLACK' : 'DARK'}).\n` +
          `This is NOT a gradual transition — it is a HARD CUT. ` +
          `Hero is the only section with the vivid color. ` +
          `Do not bleed the hero color into body sections. ` +
          `The contrast between the vivid hero and dark body IS the page's dramatic structure.` +
          (_hasMarquee ? `\nBetween hero and body: a full-width ticker strip (background: #000000, monospace caps) acts as a hard visual divider.` : '')
        );
        lines.push('');
      }
    }
  }

  // ── Section color rhythm: detect alternating dark/light pattern ──
  if (_scmDp.length >= 4) {
    const _rhythm = _scmDp.map(s => {
      const _l = hexLum(s.bgColor || data.pageBackground || '#ffffff');
      return _l < 0.35 ? 'dark' : 'light';
    });
    const _transitions = _rhythm.filter((r, i) => i > 0 && r !== _rhythm[i - 1]).length;
    if (_transitions >= 2) {
      const _darkBg = _scmDp.find(s => hexLum(s.bgColor || '#fff') < 0.35)?.bgColor || '#000000';
      const _lightBg = _scmDp.find(s => hexLum(s.bgColor || '#000') > 0.5)?.bgColor || '#ffffff';
      lines.push(`**Section color rhythm — deliberate emotional alternation:** ${_rhythm.join(' → ')}.`);
      lines.push(`Dark sections (\`${_darkBg}\`): create gravity, focus, intimacy. The user reads more slowly, attends more carefully. Use for hero, key metrics, closing arguments.`);
      lines.push(`Light sections (\`${_lightBg}\`): release tension, invite scanning. The user's pace accelerates. Use for feature exploration and social proof.`);
      lines.push(`CRITICAL: transitions between sections are HARD CUTS — no gradients, no fade-between, no softening. The background changes instantly at the section boundary. This hard-cut rhythm signals brand decisiveness. Any gradient blending between sections violates the design intent.`);
      lines.push(`Do not normalize backgrounds to a single theme. The alternation IS the page's dramatic structure — reproduce it exactly.`);
      lines.push('');
    }
  }

  // ── Page Flow (section-by-section narrative) ──
  const scm = data.sectionContentMap;
  if (scm && scm.length > 0) {
    lines.push(conf.sectionMap === 'medium'
      ? `**Page flow** (${scm.length} sections detected — layout may vary)`
      : '**Page flow**');
    scm.slice(0, 8).forEach((sec, i) => {
      let desc = `${i+1}. **${sec.type}**`;
      if (sec.bgColor) desc += ` (${sec.bgColor})`;
      if (sec.heading) desc += `: "${sec.heading}"`;
      // Layout narrative
      if (sec.layout) {
        const layoutMap = {'text-left-img-right':' Split layout — text left, visual right.',
          'text-right-img-left':' Split layout — text right, visual left.',
          'text-center':' Centered text layout.',
          'text-center-img-below':' Centered text with visual below.',
          'grid-cards':' Card grid layout.',
          'two-column':' Two-column layout.',
          'three-column':' Three-column layout.',
          'full-width-img':' Full-width visual.'};
        desc += layoutMap[sec.layout] || ` Layout: ${sec.layout}.`;
      }
      // CTAs
      if (sec.ctas?.length > 0) desc += ` CTAs: ${sec.ctas.map(c=>`"${c}"`).join(', ')}.`;
      // Highlighted words in heading
      if (sec.headingColoredWords?.length > 0) {
        desc += ` Heading accents: ${sec.headingColoredWords.map(w=>`"${w.text}" (${w.style})`).join(', ')}.`;
      }
      // Key visuals
      if (sec.visualDescriptions?.length > 0) {
        const firstVis = sec.visualDescriptions[0];
        if (firstVis.length < 80) desc += ` Visual: ${firstVis}.`;
      }
      // Decorative elements
      if (sec.decorativeGradients?.length > 0) desc += ' Has decorative gradient stripes.';
      if (sec.hasSlider) desc += ' Contains slider/carousel.';
      if (sec.hasNumberedItems) {
        desc += ' Numbered items (01, 02, 03 pattern).';
        if (sec.steps && sec.steps.length > 0) desc += ' Steps: ' + sec.steps.map(s => `${s.label}: "${s.heading}"`).join(', ') + '.';
      }

      lines.push(desc);
    });
    lines.push('');
  }

  // ── Interactive components ──
  const tabComps = data.tabbedComponents;
  const fixedChrome = data.fixedUIChrome;
  if ((tabComps && tabComps.length > 0) || (fixedChrome && fixedChrome.length > 0)) {
    lines.push('**Interactive components**');

    if (tabComps && tabComps.length > 0) {
      tabComps.forEach(tc => {
        if (tc.type === 'tab-switcher' || tc.type === 'numbered-switcher' || tc.type === 'framer-pill-tabs') {
          const labelStr = tc.labels.map((l, i) => tc.hasNumbers ? `"${String(i+1).padStart(2,'0')} ${l}"` : `"${l}"`).join(' | ');
          lines.push(`- **Tabbed switcher** (${tc.count} items): ${labelStr}`);
          lines.push(`  State-driven content switch — NOT a navigation component. Active item: "${tc.activeLabel || tc.labels[0]}".`);
          lines.push(`  Implement: useState for activeTab index. Transition: crossfade 300ms. Panel layout: ${tc.panelLayout || 'block'}.`);
        } else if (tc.type === 'sidebar-switcher') {
          const labelStr = tc.labels.map((l, i) => `"${String(i+1).padStart(2,'0')} ${l}"`).join(' | ');
          lines.push(`- **Sidebar content switcher** (${tc.count} items): ${labelStr}`);
          lines.push(`  State-driven content panel swap — NOT navigation, NOT linear steps.`);
          lines.push(`  Sidebar: sticky left, mono numbered labels, click → active class swap.`);
          lines.push(`  Implement: useState(activeIndex), panel transition: opacity crossfade 300ms.`);
        } else if (tc.type === 'split-panel') {
          lines.push(`- **Split content panel**: image/visual left + ${tc.bulletCount} bullet points right${tc.hasTestimonial ? ' + testimonial block' : ''}. Layout: ${tc.layout}.`);
        }
      });
    }

    if (fixedChrome && fixedChrome.length > 0) {
      fixedChrome.forEach(fc => {
        if (fc.role === 'stickyBottom') {
          lines.push(`- **Sticky bottom bar** (position:fixed, bottom:0, h:${fc.height}px, z:${fc.zIndex}): ${fc.hasButton ? 'Contains CTA button.' : 'No button.'} bg: ${fc.bg}.`);
          lines.push(`  ⚠️ Not part of page scroll flow — renders above all content. Add padding-bottom:${fc.height}px to <body> to prevent content overlap.`);
          if (fc.text) lines.push(`  Content preview: "${fc.text.slice(0, 60)}"`);
        } else if (fc.role === 'stickyHeader') {
          lines.push(`- **Sticky header** (position:fixed, top:0, h:${fc.height}px, z:${fc.zIndex}): bg: ${fc.bg}.`);
        }
      });
    }

    lines.push('');
  }

  // ── Interactive states (per-tab content) ──
  const iStates = data.interactiveStates;
  if (iStates?.length > 0) {
    lines.push('**Tabbed content — all states (DO NOT collapse into one):**');
    iStates.forEach((s, i) => {
      lines.push(`State ${i+1}: "${s.trigger}"`);
      if (s.heading) lines.push(`  Heading: "${s.heading}"`);
      if (s.bullets?.length) lines.push(`  Bullets: ${s.bullets.map(b => `"${b}"`).join(' | ')}`);
      if (s.hasImage) lines.push(`  Image: ${s.imgSrc || 'present'}`);
      if (s.cta) lines.push(`  CTA: "${s.cta}"`);
    });
    lines.push('Each state has its own content — render conditionally based on activeTab index.');
    lines.push('');
  }

  // ── Layered image compositions ──
  const layered = data.layeredImages;
  if (layered?.length > 0) {
    lines.push('**Layered image compositions (render ALL layers, not just one):**');
    layered.forEach(comp => {
      lines.push(`Section: ${comp.section} — ${comp.layerCount} image layers:`);
      comp.layers.forEach((l, i) => {
        lines.push(`  Layer ${i+1} (z:${l.zIndex}, ${l.position}): ${l.type} — "${l.url || 'bg-image'}"${l.width ? ` ${l.width}×${l.height}px` : ''}`);
      });
      lines.push('  Use position:relative on container, position:absolute on overlay layers.');
    });
    lines.push('');
  }

  // ── Spacing & Rhythm ──
  const sp = vpr.spacingSystem;
  if (sp && (sp.sectionPaddingY || sp.containerMaxWidth || sp.gridGap)) {
    lines.push('**Spacing & rhythm**');
    const parts = [];
    if (sp.sectionPaddingY) parts.push(`Section padding: ${sp.sectionPaddingY} vertical`);
    if (sp.containerMaxWidth) parts.push(`container max-width: ${sp.containerMaxWidth}`);
    if (sp.gridGap) parts.push(`grid gap: ${sp.gridGap}`);
    if (sp.cardGap && sp.cardGap !== sp.gridGap) parts.push(`card gap: ${sp.cardGap}`);
    lines.push(parts.join('. ') + '.');
    if (sp.sectionPaddingY) {
      const padVal = parseInt(sp.sectionPaddingY);
      if (padVal >= 80) lines.push('Generous whitespace — sections breathe with ample vertical spacing. Premium, unhurried feel.');
      else if (padVal >= 48) lines.push('Moderate spacing — balanced rhythm, professional density.');
      else lines.push('Compact spacing — dense, information-rich layout.');
    }
    lines.push('');
  }

  // ── Spacing scale (base grid detection) ──
  const spScale = data.spacingScale;
  if (spScale) {
    lines.push(`**Spacing system:** ${spScale.baseUnit}px base grid (${spScale.conformRate}% conformity). ` +
      `Common values: ${spScale.commonValues.map(v => v + 'px').join(', ')}. ` +
      `Use multiples of ${spScale.baseUnit}px for ALL spacing — padding, gap, margin.` +
      (spScale.outliers.length ? ` Exceptions: ${spScale.outliers.map(v => v + 'px').join(', ')}.` : ''));
    lines.push('');
  }

  // ── Component Language ──
  const bs = data.buttonStyles;
  const tp = data.typographyPatterns;
  const badge = data.badgeStyles;
  const inp = data.inputStyles;
  if (bs?.primary || badge || inp) {
    lines.push('**Component language**');
    if (bs?.primary) {
      const bp = bs.primary;
      const isPill = bp.borderRadius?.includes('9999');
      const isUppercase = bp.textTransform === 'uppercase';
      let btnDesc = `Buttons: Primary = ${isPill ? 'pill-shaped' : (bp.borderRadius || 'rounded')}`;
      if (bp.backgroundColor) btnDesc += `, \`${bp.backgroundColor}\` fill`;
      if (bp.fontSize) btnDesc += `, ${bp.fontSize}`;
      if (isUppercase) btnDesc += ', uppercase';
      if (bp.fontWeight && parseInt(bp.fontWeight) >= 600) btnDesc += `, ${bp.fontWeight} weight`;
      btnDesc += '.';
      lines.push(btnDesc);
      if (bs.ghost) lines.push('Ghost variant: transparent bg + border outline.');
      if (bs.secondary) lines.push('Secondary: muted fill or outline style.');
      if (bs.textOnly) {
        const t = bs.textOnly;
        lines.push(
          `Text-only CTA: no background, no border — bold text` +
          (t.hasArrow ? ` + arrow (→)` : '') +
          `. Style: \`${t.fontSize}/${t.fontWeight}${t.textTransform === 'uppercase' ? ', uppercase' : ''}\`. ` +
          `Third button variant distinct from primary and ghost. ` +
          `Use for secondary inline actions — not in nav or hero primary slots.`
        );
      }
    }
    if (badge) {
      const isPill = badge.borderRadius?.includes('9999');
      lines.push(`Badges: ${isPill ? 'pill' : (badge.borderRadius || 'rounded')}, ${badge.fontSize || '12px'}, ${badge.fontWeight || '500'} weight${badge.textTransform === 'uppercase' ? ', uppercase' : ''}.`);
    }
    if (inp) {
      lines.push(`Inputs: ${inp.height || 'auto'} height, ${inp.borderRadius || 'default'} radius${inp.border ? `, border: ${inp.border}` : ''}.`);
    }
    lines.push('');
  }

  // ── Subtle background textures ──
  const subtleTex = data.subtleTextures;
  // Fix 6: Also check assets.backgrounds for grain/noise PNG textures
  const noiseBgAsset = (data.assets?.backgrounds || []).find(b => /grain|noise|texture/i.test(b.url || ''));
  if ((subtleTex?.length > 0) || noiseBgAsset) {
    lines.push('**Subtle background textures (low-opacity — easy to miss):**');
    // Fix 6: Grain/noise PNG asset — output full CSS application spec
    if (noiseBgAsset) {
      lines.push(`- **Grain/noise texture:** \`position:fixed; inset:0; z-index:2; pointer-events:none;\``);
      lines.push(`  \`background-image: url(${noiseBgAsset.url}); background-repeat:repeat; background-attachment:fixed;\``);
      lines.push(`  \`filter: contrast(200%);\` — contrast amplifies the grain. DO NOT skip this — it provides the site's tactile quality.`);
    }
    if (subtleTex?.length > 0) subtleTex.forEach(t => {
      if (t.type === 'radial-gradient-texture') {
        lines.push(`- Radial gradient texture on \`${t.element}\`: \`${t.value}\`. Low-opacity decorative layer — keep it subtle, opacity < 0.1.`);
      } else if (t.type === 'conic-gradient-texture') {
        lines.push(`- Conic gradient texture on \`${t.element}\`: \`${t.value}\`. Decorative background pattern.`);
      } else if (t.type === 'svg-texture-overlay') {
        lines.push(`- SVG overlay texture (opacity: ${t.opacity}, ${t.childCount} shapes) — same-color-family as bg, barely visible. Recreate as low-opacity SVG absolutely positioned over section.`);
      }
    });
    lines.push('');
  }

  // ── Per-section illustrations ──
  const sectionIllus = data.sectionIllustrations;
  if (sectionIllus?.length > 0) {
    lines.push('**Per-section illustrations (each is unique — do NOT reuse a template):**');
    sectionIllus.forEach(si => {
      const ctxLabel = si.sectionLabel ? `"${si.sectionLabel}"` : (si.sectionHeading ? `"${si.sectionHeading}"` : 'Section');
      if ((si.type === 'multi-line-chart' || si.type === 'single-line-chart') &&
          (si.details?.lineCount || 0) > 0 &&
          Array.isArray(si.details?.colors) &&
          si.details.colors.length > 0) {
        lines.push(
          `${ctxLabel}: Annotated line chart. ` +
          `${si.details.lineCount} line${si.details.lineCount > 1 ? 's' : ''} with colors [${si.details.colors.join(', ')}]. ` +
          (si.details.hasTooltip ? `Tooltip/annotation: "${si.details.tooltipText}" at chart peak. ` : '') +
          (si.details.hasDots ? `Dots/nodes at data points. ` : '') +
          `No axes, no grid — pure editorial line art on dark card background.`
        );
      } else if (si.type === 'architecture-diagram') {
        lines.push(
          `${ctxLabel}: System boundary diagram. ` +
          `Dashed-border rectangle = machine/boundary. ` +
          (si.details.labels.length ? `Inside labels: ${si.details.labels.map(l => `"${l}"`).join(', ')}. ` : '') +
          `Monospace text, minimal color — technical precision aesthetic.`
        );
      } else if (si.type === 'concentric-circles') {
        lines.push(
          `${ctxLabel}: Concentric circle rings (${si.details.ringCount} rings), ` +
          `very low opacity — almost invisible against dark bg. ` +
          (si.details.hasIcon ? `Single icon centered. ` : '') +
          `Animation: rings pulse outward slowly (scale 1→1.05, 3s ease-in-out infinite).`
        );
      } else if (si.type === 'concentric-rings-image') {
        lines.push(
          `${ctxLabel}: [concentric-ring illustration] ${si.details.width}×${si.details.height}px ring/donut arc image. ` +
          `Partially cropped — positioned at section edge. Represents stakeholder consolidation (many segments → one). ` +
          `Pair alongside a UI card or product screenshot. Keep it decorative, not interactive.`
        );
      } else if (si.type === 'ui-mockup') {
        const perspNote = si.details.perspective === 'portrait' ? ', portrait orientation' : si.details.perspective === 'landscape' ? ', landscape orientation' : '';
        lines.push(
          `${ctxLabel}: [ui-mockup] ${si.details.width}×${si.details.height}px product screenshot${perspNote}. ` +
          `Render as a realistic interface preview — light card bg, product UI content visible. ` +
          `Slight drop shadow or thin border. No heavy frame/device chrome unless specified.`
        );
      } else if (si.type === 'illustration-image') {
        lines.push(
          `${ctxLabel}: [illustration] ${si.details.width}×${si.details.height}px raster illustration. ` +
          `Portrait format — brand or character visual. Match site color palette.`
        );
      } else if (si.type === 'particle-scatter') {
        lines.push(
          `${ctxLabel}: Particle/constellation scatter — ` +
          `${si.details.particleCount}+ dots in [${si.details.colors.join(', ')}]. ` +
          `No connecting lines. Random-ish distribution. ` +
          `Dots vary in opacity (0.3–1.0) and size (2–6px). ` +
          `Subtle drift animation: translate ±4px, staggered delays.`
        );
      }
    });
    lines.push('');
  }

  // ── Typography hierarchy (from extracted patterns) ──
  if (tp && (tp.h1 || tp.body)) {
    lines.push('**Type scale**');
    if (tp.h1) lines.push(`H1: ${tp.h1.fontSize}/${tp.h1.fontWeight}${tp.h1.letterSpacing && tp.h1.letterSpacing !== 'normal' ? `, tracking: ${tp.h1.letterSpacing}` : ''}${tp.h1.textTransform === 'uppercase' ? ', uppercase' : ''}`);
    if (tp.h2) lines.push(`H2: ${tp.h2.fontSize}/${tp.h2.fontWeight}`);
    if (tp.h3) lines.push(`H3: ${tp.h3.fontSize}/${tp.h3.fontWeight}`);
    if (tp.body) lines.push(`Body: ${tp.body.fontSize}/${tp.body.fontWeight}${tp.body.lineHeight ? `, line-height: ${tp.body.lineHeight}` : ''}`);
    if (tp.label) lines.push(`Label: ${tp.label.fontSize}/${tp.label.fontWeight}${tp.label.textTransform === 'uppercase' ? ', uppercase' : ''}`);
    lines.push('');
  }

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT GUIDANCE
// ═══════════════════════════════════════════════════════════════════════════
function generateComponentGuidance(data, style, specsData) {
  specsData = specsData || {};
  const{isDark,hasFullRound,hasGlowEffect,hasLayeredShadows,hasColoredShadows,accents,vp,radii,
    pageBg,semanticColors,vibrantColors,isCool} = style;
  const vpr=vp||{}, ui=(vpr.uiPatterns)||{};

  // Fix: use CSS var --primary for button color, not just highest-saturation accent
  const sc = semanticColors || {};
  const accent = resolvedPrimaryActionColor(data, style)
    || sc.primary
    || (isCool ? vibrantColors.find(c=>{ const r=parseInt(c.slice(1,3),16),b=parseInt(c.slice(5,7),16); return b>r&&hexSat(c)>35; }) : null)
    || accents.find(c=>hexSat(c)>35)
    || accents[0];

  // Real interactive radius — exclude 50% (circles)
  const interactiveRadii = radii.filter(r=>!r.includes('50%'));
  const radiusSample = interactiveRadii[0] || null; // Use actual site radius, no hardcoded fallback
  const defaultRadius = radiusSample || '0px'; // If site has no radii, assume sharp corners
  const lines=[];

  // CSS var resolver — uses data.cssVars, falls back to semantic hint from var name
  const cssVarsGCG = data.cssVars || {};
  const resolveVarGCG = v => {
    if (!v || !String(v).includes('var(')) return v;
    const m = String(v).match(/var\(\s*(--[^,)]+)/);
    const varName = m?.[1]?.trim();
    const resolved = varName && cssVarsGCG[varName];
    if (resolved) return `${resolved} (${v})`;
    if (varName) {
      const hint = varName.replace(/^--[\w]+-[\w]+-?/, '').replace(/-/g, ' ').trim();
      return `[${hint}]`;
    }
    return v;
  };

  // ── Primary Button ──
  // Use extracted button data if available
  const bs = data.buttonStyles || {};
  const hoverStates = data.hoverStates || [];
  const claimedSelectors = new Set();

  // Pre-match nav link hover state
  const navLinkHover = hoverStates.find(h =>
    /nav\w*[_-]?link|navbar\w*[_-]?link|header[_-]?link|nav[_-]?item|menu[_-]?item|nav[_-]?a\b/i.test(h.selector)
  );
  if (navLinkHover) claimedSelectors.add(navLinkHover.selector);
  const navHoverSuffix = navLinkHover
    ? ' Nav link hover: ' + Object.entries(navLinkHover).filter(([k,v])=>k!=='selector' && typeof v !== 'object').map(([k,v])=>'`'+k+': '+resolveVarGCG(v)+'`').join(', ') + '.'
    : '';

  // ── Navigation — use detected nav pattern when available ──
  const navP = data.navPattern;
  // Build nav links string from captured labels (already in navPattern.visibleLinks)
  const _navLinkLabels = (navP?.visibleLinks || []).filter(l => l && l.length > 1 && l.length < 30);
  const _navLinksNote = _navLinkLabels.length > 0
    ? ` Nav links: ${_navLinkLabels.join(' · ')}. ${_navLinkLabels.length === 1 ? 'ONE link only — do not add extra links. The minimalist single-link nav is intentional.' : ''}`
    : '';
  if (navP && navP.type === 'hamburger-only') {
    let navDesc = '**Navigation:** Hidden by default. Hamburger menu icon opens full-screen overlay.';
    if (navP.logoText) navDesc += ` Logo: "${navP.logoText}" fixed top-left.`;
    lines.push(navDesc + navHoverSuffix);
  } else if (vpr.navStyle==='transparent-hero') {
    lines.push('**Navigation:** Sticky. Starts transparent, transitions on scroll past 80px to '+(isDark?'`rgba(24,22,24,0.85)` + `backdrop-filter:blur(12px)` + `border-bottom:1px solid rgba(255,255,255,0.08)`':'`rgba(255,255,255,0.92)` + `backdrop-filter:blur(12px)` + `border-bottom:1px solid rgba(0,0,0,0.06)`')+'. Logo left, CTA right.'+_navLinksNote+navHoverSuffix);
  } else if (vpr.navStyle==='frosted') {
    lines.push('**Navigation:** Sticky. `backdrop-filter:blur(12px)`, '+(isDark?'dark':'light')+' semi-transparent bg. Logo left, CTA right.'+_navLinksNote+navHoverSuffix);
  } else {
    lines.push('**Navigation:** Sticky, '+(isDark?'`'+(pageBg||'#111')+'`':'`'+(pageBg||'#fff')+'`')+' bg. `border-bottom:1px solid '+(isDark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.06)')+'`. Logo left, CTA right.'+_navLinksNote+navHoverSuffix);
  }

  // ── Curved decorative panel ──
  if (data.curvedPanels && data.curvedPanels.length > 0) {
    const cp = data.curvedPanels[0];
    lines.push(`**Curved panel:** Fixed ${cp.side} edge, \`${cp.width}px\` wide, \`${cp.bg}\` background.${cp.hasMenu ? ' Contains hamburger menu icon.' : ''} Signature decorative element.`);
  }

  // ── Countdown / live text ──
  if (data.countdownElements && data.countdownElements.length > 0) {
    const cd = data.countdownElements[0];
    lines.push(`**Live text:** "${cd.text}" — positioned ${cd.position}. Playful real-time element.`);
  }

  if (bs.primary) {
    const p = bs.primary;
    const pBg = p.backgroundColor || accent;
    const pRadius = p.clipPath ? null : (p.borderRadius || defaultRadius);
    // Shape description
    let shape;
    if (p.clipPath) {
      shape = `chamfered corners via \`clip-path: ${p.clipPath.slice(0, 80)}\`, no border-radius`;
      if (p.pseudoBorder) shape += '. Border simulated via ::before pseudo-element with same clip-path';
    } else if (p.borderRadius && (p.borderRadius.includes('9999') || parseInt(p.borderRadius) >= 100)) {
      shape = `pill-shaped (\`${p.borderRadius.includes('9999') ? '9999px' : p.borderRadius}\`)`;
    } else {
      shape = `\`${p.borderRadius||defaultRadius}\` radius`;
    }

    // Primary button hover — try progressively wider matches
    const primaryHover = hoverStates.find(h =>
      (/(?:primary|cta|main|action|hero)/i.test(h.selector) && /btn|button/i.test(h.selector)) ||
      /(?:btn|button)[_-](?:primary|cta|main|action)/i.test(h.selector)
    ) || hoverStates.find(h => /^button:hover$|^\.btn:hover$|^\.button:hover$/i.test(h.selector))
      // BEM variants: .button--primary:hover, .btn--cta:hover
      || hoverStates.find(h => /btn--|button--/i.test(h.selector))
      // Compound: .hero .button:hover, .cta-section a.btn:hover
      || hoverStates.find(h => /button|btn/i.test(h.selector) && h.selector.includes(':hover'));
    if (primaryHover) claimedSelectors.add(primaryHover.selector);
    // Only write real extracted hover data — no fake brightness fallback
    const hoverProps = primaryHover
      ? Object.entries(primaryHover).filter(([k,v]) => k !== 'selector' && k !== 'before' && typeof v !== 'object').map(([k,v]) => `\`${k}: ${v}\``).join(', ')
      : null;

    const _btnFontFamily = p.fontFamily || (data.fonts && data.fonts[0]) || null;
    // Contrast correction: if bg is bright (lum > 0.5) but extracted text color is also bright → override to black
    const _pBgLum = pBg ? hexLum(pBg) : 0;
    const _pColorLum = p.color ? hexLum(p.color) : 1;
    const _pColor = (_pBgLum > 0.5 && _pColorLum > 0.5) ? '#000000' : p.color;
    let btn = `${shape}, \`${pBg}\` bg, text \`${_pColor}\``;
    if (p.height) btn += `, height \`${p.height}\``;
    btn += `, padding \`${p.padding}\`, font \`${p.fontSize}/${p.fontWeight}\``;
    if (_btnFontFamily) btn += ` "${_btnFontFamily}"`;
    if (p.letterSpacing) btn += `, tracking \`${p.letterSpacing}\``;
    if (p.textTransform) btn += `, \`${p.textTransform}\``;
    if (hoverProps) btn += `. Hover: ${hoverProps}.`;
    lines.push('**Primary button:** '+btn);

    // CSS snippet for direct LLM consumption
    const primaryCss = [`  background-color: ${pBg};`, `  color: ${_pColor};`];
    if (p.padding) primaryCss.push(`  padding: ${p.padding};`);
    if (pRadius) primaryCss.push(`  border-radius: ${pRadius};`);
    if (p.clipPath) primaryCss.push(`  clip-path: ${p.clipPath};`);
    if (p.fontSize) primaryCss.push(`  font-size: ${p.fontSize};`);
    if (p.fontWeight) primaryCss.push(`  font-weight: ${p.fontWeight};`);
    if (_btnFontFamily) primaryCss.push(`  font-family: "${_btnFontFamily}";`);
    if (p.letterSpacing && p.letterSpacing !== 'normal') primaryCss.push(`  letter-spacing: ${p.letterSpacing};`);
    if (p.textTransform && p.textTransform !== 'none') primaryCss.push(`  text-transform: ${p.textTransform};`);
    if (p.border) primaryCss.push(`  border: ${p.border};`);
    if (p.boxShadow) primaryCss.push(`  box-shadow: ${p.boxShadow};`);
    if (p.height) primaryCss.push(`  height: ${p.height};`);
    if (p.transition) primaryCss.push(`  transition: ${p.transition};`);
    const primarySpecLine = '  Spec: ' + primaryCss.map(l => '`' + l.trim().replace(/;$/, '') + '`').join(' · ');
    lines.push(primarySpecLine);
    if (p.clipPath && p.height) {
      lines.push(`  NOTE: The \`${p.height}\` height combined with \`${p.padding}\` vertical padding requires the button to NOT have border-radius. The clip-path provides the chamfered corner shape. \`border-radius\` must be 0.`);
    }
    if (primaryHover) {
      const _afterEntries = Object.entries(primaryHover).filter(([k,v]) => !['selector', 'before'].includes(k) && typeof v !== 'object');
      if (primaryHover.before) {
        const _bef = primaryHover.before;
        const _befParts = [];
        if (_bef.background) _befParts.push(`bg: ${_bef.background}`);
        if (_bef.color) _befParts.push(`color: ${_bef.color}`);
        if (_bef.boxShadow) _befParts.push(`shadow: ${_bef.boxShadow}`);
        if (_bef.transform) _befParts.push(`transform: ${_bef.transform}`);
        if (_befParts.length) lines.push(`  Hover before: ${_befParts.join(', ')}`);
        lines.push(`  Hover after:  ${_afterEntries.map(([k,v]) => `\`${k}: ${v}\``).join(' · ')}`);
      } else {
        const twHints = _afterEntries.map(([k,v]) => _cssPropToTailwindHint(k, v)).filter(Boolean).join('');
        lines.push(`  Hover: ${_afterEntries.map(([k,v]) => `\`${k}: ${v}\``).join(' · ')}${twHints}`);
      }
      // Include extracted transition if present in hover rule (animation duration/easing)
      const _hoverTransition = primaryHover.transition || primaryHover['transition'];
      if (_hoverTransition) lines.push(`  Transition: \`${_hoverTransition}\``);
      else if (p.transition) lines.push(`  Transition: \`${p.transition}\``);
    }
    lines.push(`  Active: \`transform: scale(0.98); transition: transform 150ms cubic-bezier(0.4,0,0.2,1)\`. \`button:active { transform: scale(0.98); }\``);
  } else {
    const btn = hasFullRound&&accent&&hasGlowEffect
      ? '9999px radius, `'+accent+'` bg, padding 12px 28px, weight 700. Hover: glow 0 0 20px '+accent+'66, brightness(1.05). 200ms ease-out.'
      : hasFullRound&&accent ? '9999px radius, `'+accent+'` bg, padding 12px 24px, weight 600. Hover: brightness(0.92).'
      : accent ? defaultRadius+' radius, `'+accent+'` bg, padding 10px 20px, weight 600. Hover: brightness(0.92).'
      : defaultRadius+' radius, primary color from tokens, weight 600.';
    lines.push('**Primary button:** '+btn);
    lines.push(`  Active: \`transform: scale(0.98); transition: transform 150ms cubic-bezier(0.4,0,0.2,1)\`. \`button:active { transform: scale(0.98); }\``);
  }

  // Nav CTA — separate from hero primary (usually smaller)
  if (bs.navCta && bs.navCta !== bs.primary) {
    const n = bs.navCta;
    let navDesc = `**Nav CTA:** \`${n.fontSize}\` font, height \`${n.height}\`, padding \`${n.padding}\``;
    if (n.backgroundColor) navDesc += `, \`${n.backgroundColor}\` bg`;
    if (n.fontFamily) navDesc += `, "${n.fontFamily}"`;
    navDesc += '. Compact — visually smaller than hero CTAs.';
    lines.push(navDesc);
    const navCtaCss = [];
    if (n.backgroundColor) navCtaCss.push(`  background-color: ${n.backgroundColor};`);
    if (n.color) navCtaCss.push(`  color: ${n.color};`);
    if (n.padding) navCtaCss.push(`  padding: ${n.padding};`);
    if (n.borderRadius) navCtaCss.push(`  border-radius: ${n.borderRadius};`);
    if (n.fontSize) navCtaCss.push(`  font-size: ${n.fontSize};`);
    if (n.fontWeight) navCtaCss.push(`  font-weight: ${n.fontWeight};`);
    if (n.height) navCtaCss.push(`  height: ${n.height};`);
    if (n.border) navCtaCss.push(`  border: ${n.border};`);
    if (n.transition) navCtaCss.push(`  transition: ${n.transition};`);
    if (navCtaCss.length) lines.push('  Spec: ' + navCtaCss.map(l => '`' + l.trim().replace(/;$/, '') + '`').join(' · '));
  }

  if (bs.ghost) {
    const g = bs.ghost;
    const ghostBorder = g.border || '1px solid '+(isDark?'rgba(255,255,255,0.2)':'rgba(0,0,0,0.15)');
    const ghostPadding = g.padding || '12px 24px';
    const ghostShape = g.clipPath ? `chamfered via clip-path` : `\`${g.borderRadius||defaultRadius}\` radius`;
    const ghostHover = hoverStates.find(h => /ghost|outline/i.test(h.selector));
    if (ghostHover) claimedSelectors.add(ghostHover.selector);
    const ghostHoverDesc = ghostHover
      ? Object.entries(ghostHover).filter(([k,v]) => k !== 'selector' && typeof v !== 'object').map(([k,v]) => `\`${k}: ${v}\``).join(', ')
      : `bg ${isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.04)'}`;
    lines.push(`**Ghost button:** ${ghostShape}, transparent bg, border \`${ghostBorder}\`, padding \`${ghostPadding}\`. Hover: ${ghostHoverDesc}.`);
    const ghostCss = [`  background-color: transparent;`, `  border: ${ghostBorder};`];
    if (g.color) ghostCss.push(`  color: ${g.color};`);
    ghostCss.push(`  padding: ${ghostPadding};`);
    if (g.borderRadius||defaultRadius) ghostCss.push(`  border-radius: ${g.borderRadius||defaultRadius};`);
    if (g.fontSize) ghostCss.push(`  font-size: ${g.fontSize};`);
    if (g.fontWeight) ghostCss.push(`  font-weight: ${g.fontWeight};`);
    if (g.transition) ghostCss.push(`  transition: ${g.transition};`);
    const ghostSpecLine = '  Spec: ' + ghostCss.map(l => '`' + l.trim().replace(/;$/, '') + '`').join(' · ');
    lines.push(ghostSpecLine);
    if (ghostHover) {
      const ghostHoverTokens = Object.entries(ghostHover).filter(([k,v]) => k !== 'selector' && typeof v !== 'object').map(([k,v]) => `\`${k}: ${v}\``).join(' · ');
      lines.push(`  Hover: ${ghostHoverTokens}`);
    }
    // Context: if hero bg is a vivid color, note ghost button visibility
    const _heroBgColor = data.sectionContentMap?.[0]?.bgColor;
    if (_heroBgColor && _heroBgColor !== data.pageBackground) {
      const _heroBgLum = hexLum(_heroBgColor);
      if (_heroBgLum > 0.15 && _heroBgLum < 0.85) {
        lines.push(`  IMPORTANT: This ghost button appears on the \`${_heroBgColor}\` hero background. Ensure border color is visible against that background — use a darker/contrasting border, not white.`);
      }
    }
    if (g.clipPath) {
      lines.push(`  clip-path: same chamfered polygon as primary button.`);
    }
  }

  // Cards — only if glassmorphism or layered shadows indicate card patterns exist
  if (vpr.hasGlassmorphism || vpr.hasFloatingCards || hasLayeredShadows) {
    let card = vpr.hasGlassmorphism
      ? 'backdrop-filter:blur(16px), semi-transparent bg, '+defaultRadius+' radius. Padding 24–32px.'
      : isDark ? 'Dark surface, rgba(255,255,255,0.06) border. '+(hasLayeredShadows?'Layered shadow from tokens.':'Border for definition.')+' '+defaultRadius+' radius. Padding 24–32px.'
      : '`'+(pageBg||'#ffffff')+'` bg, '+(hasLayeredShadows?'layered shadow from tokens':'subtle border')+'. '+defaultRadius+' radius. Padding 24–32px.';

    // Find card hover state: .card:hover, [class*="card"]:hover, .tile:hover, .item:hover
    const cardHover = hoverStates.find(h =>
      /^\.card:hover$|^\.tile:hover$|^\[class\*="card"\]:hover$/i.test(h.selector) ||
      (/card|tile|item|project|work/i.test(h.selector) && /:hover/.test(h.selector) && !/img|image|thumb/i.test(h.selector))
    );
    if (cardHover) claimedSelectors.add(cardHover.selector);

    // Find image-within-card hover: .card:hover img, .tile:hover .image, etc.
    const cardImgHover = hoverStates.find(h =>
      /(?:card|tile|item|project|work):hover.*(?:img|image|thumb|media|visual)/i.test(h.selector) ||
      /(?:card|tile|item):hover\s+img/i.test(h.selector)
    );
    if (cardImgHover) claimedSelectors.add(cardImgHover.selector);

    if (cardHover) {
      const cardHoverDesc = Object.entries(cardHover)
        .filter(([k,v]) => !['selector','before'].includes(k) && typeof v !== 'object')
        .map(([k,v]) => `\`${k}: ${v}\``).join(', ');
      card += ` Hover: ${cardHoverDesc}.`;
    }
    if (cardImgHover) {
      const imgHoverDesc = Object.entries(cardImgHover)
        .filter(([k,v]) => !['selector','before'].includes(k) && typeof v !== 'object')
        .map(([k,v]) => `\`${k}: ${v}\``).join(', ');
      card += ` Image on hover: ${imgHoverDesc}.`;
    }
    lines.push('**Cards:** '+card);
  }

  // Hero — derive background and text treatment from actual page data
  if (style.layout?.hasHero) {
    const heroHasPhoto = vpr.hasFullBleedImages || vpr.imageTreatment==='cinematic';
    const heroHasDecorGeometry = ui.hasDecorativeGeometry;

    if (heroHasPhoto && isDark) {
      // Dark cinematic hero with photo
      lines.push('**Hero:** min-height 100dvh, background-size:cover, `rgba(0,0,0,0.4)` overlay. White text. Headline: clamp(48px,7vw,88px) in display font. One primary CTA + one ghost, side by side.');
    } else if (heroHasDecorGeometry && !isDark) {
      // Light hero with abstract geometric background — Merge.dev, Linear style
      const heroBgRef = pageBg ? '`'+pageBg+'`' : '`#ffffff`';
      const actionRef = accent ? '`'+accent+'`' : 'accent color';
      lines.push('**Hero:** Light background ('+heroBgRef+'). Dark text on light. No overlay, no full-bleed photo. Headline: clamp(48px,6vw,80px)/800 in display font. Primary CTA with '+actionRef+' + ghost, side by side. Generous padding (80–120px vertical).');
    } else {
      // Clean light/dark hero, no special treatment
      const heroBgRef = pageBg ? '`'+pageBg+'`' : (isDark ? 'dark neutral' : '`#ffffff`');
      const heroText = isDark ? 'light text (token foreground)' : 'dark text (token foreground)';
      lines.push('**Hero:** min-height 80–90dvh, '+heroBgRef+' background. '+heroText+'. No overlay. Headline: clamp(48px,6vw,80px) in display font. One primary CTA + one ghost, side by side. No cards above the fold.');
    }
  }

  // Inputs — only output when actual input styles were extracted
  const inputData = data.inputStyles;
  if (inputData && Object.keys(inputData).length > 0) {
    lines.push(`**Inputs:** \`${inputData.backgroundColor||'inherit'}\` bg, \`${inputData.border||'1px solid '+(isDark?'rgba(255,255,255,0.12)':'#e0e0e0')}\`, \`${inputData.borderRadius||defaultRadius}\` radius. Focus: outline 2px solid ${accent||'currentColor'} offset 2px.`);
  }
  // Badges — only if badge data was actually extracted from the DOM
  const badgeData = data.badgeStyles;
  if (badgeData && badgeData.borderRadius) {
    lines.push(`**Badges:** radius \`${badgeData.borderRadius}\`, padding \`${badgeData.padding||'4px 10px'}\`, font \`${badgeData.fontSize||'12px'}/${badgeData.fontWeight||'500'}\`, bg \`${badgeData.backgroundColor||'accent'}\`, text \`${badgeData.color||'inherit'}\`.`);
  }

  if (ui.hasMarquee||ui.hasLogoStrip) lines.push('**Logo marquee:** `overflow:hidden`, inner div 200% width. CSS: `@keyframes marquee { to { transform:translateX(-50%) } }` applied as `animation: marquee 30s linear infinite`. Each logo item: `padding: 0 48px` or `gap: 64px` — logos must be visually separated, never concatenated. Logos at 50–60% opacity.');
  if (ui.hasPricingGrid&&ui.pricingColumnCount>0) lines.push('**Pricing grid:** repeat('+ui.pricingColumnCount+',1fr), gap 24px, align-items:stretch.'+(ui.pricingColumnCount===3?' Center card: accent border, elevated shadow, "Popular" badge.':''));
  // Fix 8: only output testimonial carousel if not already covered by a detected split-panel with testimonial
  if (ui.hasTestimonialCarousel && !data.tabbedComponents?.some(t => t.type === 'split-panel' && t.hasTestimonial)) lines.push('**Testimonial carousel:** CSS scroll-snap or Swiper. '+(isDark?'Dark surface cards, rgba(255,255,255,0.06) border':'White/light cards')+', '+defaultRadius+' radius, 24px padding. Auto-play, pause on hover.');
  if (ui.hasDualCTA&&ui.hasQRCode) lines.push('**Dual CTA:** QR + button side by side (display:flex, gap:16px).');
  else if (ui.hasDualCTA) lines.push('**Dual CTA:** Two action buttons side by side (display:flex, gap:16px).');
  // Fix 8: suppress step-indicator template if a sidebar-switcher or numbered-switcher already captures the numbered pattern
  if (ui.hasStepIndicator && !data.tabbedComponents?.some(t => t.type === 'sidebar-switcher' || t.type === 'numbered-switcher')) lines.push('**Steps:** 32px circles, border-radius:50%, number inside. Thin connecting line. Active step = accent color.');
  if (ui.hasCounterSection) {
    const _headingFont = data.typographyPatterns?.h2?.fontFamily || data.fonts?.[0] || 'display font';
    const _bodyFont = data.typographyPatterns?.body?.fontFamily || data.fonts?.[1] || 'body font';
    lines.push(`**Stats:** Each stat: value + label below. Values: font "${_headingFont}", 52–80px, 700 weight, color \`${isDark ? '#ffffff' : '#000000'}\`. Labels: font "${_bodyFont}", 13–16px, 400 weight, color \`${isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'}\`. Layout: flex row, gap 48px, centered. Count-up animation via IntersectionObserver + rAF.`);
  }
  if (ui.hasAccordion) lines.push('**Accordion:** 16–18px semibold question, muted answer. max-height transition. Chevron rotates 180° on open. border-bottom between items.');
  if (ui.hasVideoSection) lines.push('**Video:** autoplay muted loop, object-fit:cover, '+defaultRadius+' radius.');

  // New: decorative geometry
  if (ui.hasDecorativeGeometry) {
    lines.push('**Decorative background:** Subtle, non-intrusive SVG elements used as section atmosphere. Keep them minimal — `position:absolute, z-index:-1, pointer-events:none`, opacity 0.05–0.12. Do NOT add grid lines, crop marks, dot patterns, or any strong geometric overlays. The decoration should be barely noticeable — if it draws attention, it\'s too much.');
  }

  // ── Custom cursor ──
  if (data.customCursor && (data.customCursor.hasCustomCursor || data.customCursor.hasMagneticElements)) {
    const cc = data.customCursor;
    if (cc.hasCustomCursor) {
      if (cc.type === 'js-cursor-follower') {
        const d = cc.details || {};
        let cursorLine = '**Custom cursor:** JS-driven cursor follower element (`position:fixed`, `pointer-events:none`)';
        if (d.width && d.height) cursorLine += `, size \`${Math.round(d.width)}×${Math.round(d.height)}px\``;
        if (d.mixBlendMode) cursorLine += `, \`mix-blend-mode:${d.mixBlendMode}\` (inverts over content)`;
        cursorLine += '. Hide native cursor on interactive areas with `cursor:none`. The follower div tracks mouse position via `mousemove` event';
        if (d.transitionDuration) {
          const ms = parseFloat(d.transitionDuration) * (d.transitionDuration.includes('ms') ? 1 : 1000);
          const lerp = ms > 150 ? '0.06–0.08' : ms > 80 ? '0.1–0.15' : '0.18–0.25';
          cursorLine += `, applies \`transform: translate()\` with lerp ~${lerp} (transition: ${d.transitionDuration})`;
        } else {
          cursorLine += ', applies `transform: translate()` with slight easing (lerp 0.1–0.15)';
        }
        cursorLine += '. Do not use CSS transition alone — use `requestAnimationFrame` loop.';
        lines.push(cursorLine);
      } else if (cc.type === 'css-cursor-image') {
        lines.push(`**Custom cursor:** CSS \`cursor: url(...)\` — custom cursor image on interactive elements. ${cc.details?.selector ? 'Applied to: `'+cc.details.selector+'`.' : ''}`);
      } else if (cc.type === 'cursor-hidden') {
        lines.push('**Custom cursor:** Native cursor hidden (`cursor:none`). Custom JS cursor element follows mouse position.');
      }
    }
    if (cc.hasMagneticElements) {
      lines.push(`**Magnetic buttons** (${cc.magneticCount} detected): On \`mousemove\` within button bounds, apply \`transform: translate(deltaX * 0.3, deltaY * 0.3)\` proportional to cursor distance from center. On \`mouseleave\`, spring-return to origin with \`transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)\`. Calculate delta from element center via \`getBoundingClientRect()\`.`);
    }
  }

  // ── Masonry grid ──
  if (data.masonryGrid) {
    const mg = data.masonryGrid;
    lines.push(`**Masonry grid:** ${mg.columns}-column masonry layout (${mg.layoutMethod}), ${mg.entryCount} items. Heights vary from ${mg.heightRange.min}px to ${mg.heightRange.max}px.${mg.hasVaryingWidths ? ' Column widths vary: '+mg.columnWidths.join('px, ')+'px.' : ''} Use CSS \`column-count: ${mg.columns}\` or JS masonry library. Each card: \`background: ${style.isDark ? '#000000' : '#ffffff'}; border: 1px solid ${style.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}; transition: background-color 150ms\`. Hover: \`background-color: ${style.isDark ? '#232529' : '#f5f5f5'}\`. No shadow, no transform — ONLY background color changes.`);
  }

  // ── Sticky-scroll sections ──
  if (data.stickySections?.length > 0) {
    data.stickySections.forEach(sec => {
      const stickyContent = sec.stickyColHasCanvas ? '(contains canvas animation)' : sec.stickyColHasSvg ? '(contains SVG)' : sec.stickyColHasImg ? '(contains image)' : '';
      if (sec.type === 'sticky-tab-scroll' && sec.tabLabels) {
        lines.push(`**Sticky-scroll tab section — guided feature discovery:** Left column \`position:sticky; top:0; height:100vh\` ${stickyContent}. Tab navigation: ${sec.tabLabels.map(t => `"${t}"`).join(' · ')}.`);
        lines.push(`  This is NOT a standard tab component — it is a scroll-driven tour that forces sequential feature discovery. The user scrolls to reveal each feature panel on the right, while the left tab list tracks their position.`);
        lines.push(`  Active tab shifts visually (background, indicator dot, or border-left) as scroll position passes each right-panel section — use IntersectionObserver on right panels to drive active state.`);
        lines.push(`  The tension between minimal left navigation and rich right content IS the UX design — do not add right-side navigation or CTAs that break the guided flow.`);
      } else {
        lines.push(`**Sticky-scroll section:** Left column \`position:sticky; top:0; height:100vh\` ${stickyContent}. Right column scrolls normally with ${sec.scrollBlockCount} content blocks.`);
        if (sec.scrollBlockHeadings?.length > 0) {
          lines.push(`  Content blocks: ${sec.scrollBlockHeadings.map(h => `"${h}"`).join(' → ')}`);
        }
      }
      lines.push(`  Implementation: left col = \`<div class="sticky top-0 h-screen">\`. Right col = normal flow div.`);
    });
  }

  // Icon system — use extracted measurements when available
  // ── SVG animated diagrams ──
  if (data.svgDiagramAnimations?.length > 0) {
    data.svgDiagramAnimations.forEach(diag => {
      if (diag.type === 'svg-path-animation') {
        lines.push(`**Animated system diagram — primary communication device** (${diag.width}×${diag.height}px): ${diag.pathCount} paths, ${diag.circleCount} circles, ${diag.animationCount} SMIL animations. Colors: ${diag.colors.join(', ')}. ${diag.labels.length ? `Labels: ${diag.labels.map(l => `"${l}"`).join(', ')}.` : ''}`);
        lines.push(`  This diagram replaces body copy — the user reads the system by watching it operate. It is the highest-trust visual on the page.`);
        lines.push(`  Animated dots (8–12px circles) follow \`<animateMotion>\` paths tracing rails and connections. Colors match their category accent. Connection lines: 1px, extending to imply continuity.`);
        lines.push(`  Do NOT simplify to a static diagram — the motion is the message.`);
      } else if (diag.type === 'pill-track-diagram') {
        const pillList = diag.pills.map(p => `"${p.text}" (${p.w}×${p.h}px)`).join(', ');
        lines.push(`**Pill-track diagram — product architecture visualization:** ${pillList}.`);
        lines.push(`  Large oval pill rails represent organizational pillars. Animated dots traveling along connecting paths represent live data signals moving between them.`);
        lines.push(`  Pills: large \`border-radius: 9999px\`, 1px stroke border, text centered. Event labels: pill-shaped chips on thin vertical lines above/below rails.`);
        lines.push(`  Do NOT simplify to static — the motion communicates data flow as the product's core value proposition.`);
      } else if (diag.type === 'svg-diagram') {
        lines.push(`**SVG diagram** (${diag.width}×${diag.height}px): ${diag.pathCount} paths, ${diag.circleCount} circles. Colors: ${diag.colors.join(', ')}. ${diag.labels.length ? `Labels: ${diag.labels.map(l => `"${l}"`).join(', ')}.` : ''} Recreate as inline SVG.`);
      }
    });
  }

  // ── Section background decorations — structural atmosphere ──
  if (data.sectionBackgroundDecorations?.length > 0) {
    lines.push('**Section background decorations — structural atmosphere:**');
    lines.push('  Each decorated section carries a background SVG below the content layer. These are NOT optional — they prevent solid-color sections from feeling sterile. Their function is spatial character without photography.');
    data.sectionBackgroundDecorations.forEach(sec => {
      sec.decorations.forEach(d => {
        const base = `\`position:absolute; inset:0; z-index:0; pointer-events:none; overflow:hidden\`. Colors: ${d.colors.join(', ')}. opacity: ${d.opacity}.`;
        if (d.type === 'radial-rays') {
          lines.push(`  - **Radial rays** (on ${sec.sectionBg || 'page bg'}): ${d.pathCount} lines from convergence point toward edges — implies centrality, focus, authority. ${base} Implement as SVG \`<line>\` elements from center, or CSS \`conic-gradient\` at very low opacity.`);
        } else if (d.type === 'grid-lines') {
          lines.push(`  - **Grid lines** (on ${sec.sectionBg || 'page bg'}): ${d.lineCount} structural lines. ${base}`);
        } else {
          lines.push(`  - **Organic curves** (on ${sec.sectionBg || 'page bg'}): ${d.pathCount} large-radius arcs — suggests cellular or molecular paths. ${base} Implement as SVG with cubic bezier \`<path>\` elements.`);
        }
      });
    });
    lines.push('  Rule: if the decoration draws attention, it is too strong — reduce opacity. If the section feels like a flat color block, the decoration is missing.');
  }

  if (ui.hasIconSystem) {
    const iconD = ui.iconDetails || {};
    const iconStyle = ui.iconStyle || 'outlined';
    const sizeNote = iconD.size || '32–48px';
    let styleNote = '';
    if (iconStyle === 'outlined') styleNote = `Outlined SVG icons, ${iconD.strokeWidth ? iconD.strokeWidth+'px' : '1.5–2px'} stroke, no fill. Color: ${iconD.color ? '`'+iconD.color+'`' : 'currentColor or muted tone'}.`;
    else if (iconStyle === 'filled') styleNote = `Filled SVG icons. Color: ${iconD.color ? '`'+iconD.color+'`' : 'accent or muted neutral'}.`;
    else if (iconStyle === 'illustrated') styleNote = 'Custom illustrated icons (img). Consistent style — don\'t mix illustration styles.';
    else styleNote = `Mixed outlined/filled SVG icons, ${iconD.strokeWidth ? iconD.strokeWidth+'px' : '1.5px'} stroke.`;

    let containerNote = '';
    if (iconD.containerStyle && iconD.containerStyle !== 'none') {
      containerNote = ` In \`${iconD.containerSize||'48px'}\` ${iconD.containerStyle} container${iconD.containerBg ? ', bg `'+iconD.containerBg+'`' : ''}${iconD.containerRadius ? ', radius `'+iconD.containerRadius+'`' : ''}.`;
    }

    lines.push(`**Icon system:** \`${sizeNote}\` icons consistently paired with feature headings. ${styleNote}${containerNote} Gap: \`${iconD.gapToText||'12–16px'}\`.`);
  }

  // New: arrow / text link CTA
  if (ui.hasArrowLinks) {
    const color = ui.arrowLinkColor ? `\`${ui.arrowLinkColor}\`` : 'accent color';
    lines.push(`**Arrow link CTA:** Inline text link with trailing arrow — e.g. "Learn more →". Color: ${color}. No button border/background. Font-weight: 500–600. \`transition: color 150ms cubic-bezier(0.4,0,0.2,1)\`. Arrow character (→): \`display: inline-block; transition: transform 150ms cubic-bezier(0.4,0,0.2,1)\`. Hover: arrow \`transform: translateX(4px)\`. Do NOT use \`transition: all\` — only transition color and transform.`);
  }

  // ── Global interactive rules (unclaimed hover states + links + blend modes) ──
  {
    const unclaimed = hoverStates.filter(h => !claimedSelectors.has(h.selector));
    const blendModes = vpr.blendModes || [];
    const globalParts = [];
    if (specsData.links) {
      const lk = specsData.links;
      let linkColor = lk.color;
      if (isPlausibleHexColor(linkColor) && isPlausibleHexColor(style.pageBg) && Math.abs(hexLum(linkColor) - hexLum(style.pageBg)) < 0.14) {
        linkColor = resolvedPrimaryActionColor(data, style) || '#002eff';
      }
      globalParts.push(`links → \`color: ${linkColor}\`${lk.textDecoration && lk.textDecoration !== 'none' ? `, \`text-decoration: ${lk.textDecoration}\`` : ', no underline'}${lk.textUnderlineOffset ? ', offset `'+lk.textUnderlineOffset+'`' : ''}`);
      // Nav link color exception — nav links use muted foreground, not global link accent
      if (isDark && linkColor && linkColor !== '#ffffff') {
        const _fg = data.typographyPatterns?.body?.color || '#ffffff';
        // Compute rgba from foreground color
        const _fgR = parseInt(_fg.slice(1,3),16) || 255, _fgG = parseInt(_fg.slice(3,5),16) || 255, _fgB = parseInt(_fg.slice(5,7),16) || 255;
        globalParts.push(`EXCEPTION: Navigation links (nav a, header a) use \`color: rgba(${_fgR},${_fgG},${_fgB},0.7)\` default, \`rgba(${_fgR},${_fgG},${_fgB},1)\` on hover. The \`${linkColor}\` link rule applies to in-content links and CTAs only — NOT nav bar links`);
      }
    }
    if (blendModes.length > 0) globalParts.push(`\`mix-blend-mode: ${blendModes.join(', ')}\` on overlaid elements`);

    // Generic single-word component class names that are safe to keep
    const GENERIC_CLASSES = new Set(['nav','btn','button','cta','link','card','tag','badge','chip','input','select','a','p','label']);
    unclaimed.slice(0, 8).forEach(h => {
      const sel = h.selector;
      // Skip framework/utility patterns
      if (/^\.w-|text-style-|text-weight-|text-color-|^\.framer-|^\.swiper-|^\.aos-|lightbox|modal|overlay|backdrop/i.test(sel)) return;
      // Skip multi-word border artifacts (e.g. "orange rgb(0,0,0) rgb(0,0,0) orange")
      if ((h.border || h['border-color'] || '') && (String(h.border||'').match(/(?:rgb\(|rgba\(|#[0-9a-f]{3,6}|\b(?:orange|red|blue|green|black|white|transparent)\b)/gi) || []).length >= 3) return;

      // Pattern: child-element hover (e.g. ".card:hover img", ".item:hover .thumbnail")
      // These are semantic hover effects on visual children — output as useful compound patterns
      const isChildHover = /(?:card|tile|item|project|work|post|entry|feature):hover\s+\S/i.test(sel);
      if (isChildHover) {
        const _parent = sel.match(/(\S+):hover/i)?.[1] || 'parent';
        const _child = sel.replace(/.*:hover\s+/, '').trim();
        const props = Object.entries(h).filter(([k])=>!['selector','before'].includes(k) && typeof h[k] !== 'object').map(([k,v])=>`\`${k}: ${resolveVarGCG(v)}\``).join(' ');
        if (props) globalParts.push(`${_parent} hover → ${_child}: ${props}`);
        return;
      }

      if (/^[.#]/.test(sel)) {
        // Class/ID: only keep if it matches a generic component word
        const bare = sel.replace(/^[.#]/, '').replace(/:.*$/, '').replace(/[-_]/g, '').toLowerCase();
        if (!GENERIC_CLASSES.has(bare)) return;
        const props = Object.entries(h).filter(([k])=>!['selector','before'].includes(k) && typeof h[k]!=='object').map(([k,v])=>`${k}: ${resolveVarGCG(v)}`).join(', ');
        if (props) globalParts.push(`${bare} hover: ${props}`);
      } else {
        // Skip attribute selectors (library internals: [data-sonner-*], [data-radix-*], etc.)
        if (/^\[data-/.test(sel)) return;
        const props = Object.entries(h)
          .filter(([k,v])=>!['selector','before'].includes(k) && typeof v !== 'object' && !/^\[.+\]$/.test(String(resolveVarGCG(v))))
          .map(([k,v])=>`${k}: ${resolveVarGCG(v)}`)
          .join(', ');
        if (!props) return;
        globalParts.push(`\`${sel}\` → ${props}`);
      }
    });
    if (globalParts.length > 0) lines.push(`**Global interactive rules:** ${globalParts.join('; ')}.`);
  }

  // ── Hover state CSS cheat sheet — explicit CSS for LLM consumption ──
  {
    const _hoverLines = [];
    const _p = data.buttonStyles?.primary;
    const _g = data.buttonStyles?.ghost;
    const _primaryHover = hoverStates.find(h => /btn.*primary|btn.*cta|btn.*red|primary.*btn|cta.*btn/i.test(h.selector));
    const _darkBtnHover = hoverStates.find(h => /btn.*dark|btn.*secondary|dark.*btn/i.test(h.selector));
    if (_primaryHover) {
      const _phShadow = _primaryHover['box-shadow'] || _primaryHover.boxShadow;
      if (_phShadow) _hoverLines.push(`.btn-primary:hover { box-shadow: ${resolveVarGCG(_phShadow)}; }`);
    }
    if (_darkBtnHover) {
      const _dhShadow = _darkBtnHover['box-shadow'] || _darkBtnHover.boxShadow;
      if (_dhShadow) _hoverLines.push(`.btn-dark:hover { box-shadow: ${resolveVarGCG(_dhShadow)}; }`);
    }
    const _ghostHover = hoverStates.find(h => /ghost|outline/i.test(h.selector));
    if (_ghostHover) {
      const _ghBg = _ghostHover.background || _ghostHover['background-color'];
      const _ghBorder = _ghostHover['border-color'];
      if (_ghBg || _ghBorder) _hoverLines.push(`.btn-ghost:hover { ${_ghBg ? 'background: '+resolveVarGCG(_ghBg)+'; ' : ''}${_ghBorder ? 'border-color: '+resolveVarGCG(_ghBorder)+';' : ''} }`);
    }
    const _cardHover = hoverStates.find(h => /card/i.test(h.selector));
    if (_cardHover) {
      const _chOp = _cardHover.opacity;
      if (_chOp) _hoverLines.push(`.card:hover { opacity: ${_chOp}; transition: opacity 0.2s; }`);
    }
    if (_hoverLines.length > 0) {
      lines.push('**Hover state CSS — implement exactly:**');
      _hoverLines.forEach(l => lines.push('  `' + l + '`'));
      // Detect offset-shadow pattern (brutalist flat offset, not drop shadow)
      const _allShadows = _hoverLines.filter(l => /box-shadow/.test(l));
      const _hasOffset = _allShadows.some(l => /\d+px \d+px 0(px)?/.test(l));
      if (_hasOffset) {
        lines.push('  These are brutalist offset shadows — NOT drop shadows, NOT glow, NOT transforms. Npx right + Npx down, 0 blur, solid color.');
      }
    }
  }

  // ── Canvas / WebGL interactive elements ──
  // Canvas hover effects are JS-driven (mousemove events) — not detectable via CSS.
  // If the page has a canvas that's sized like a hero/section visual, flag it for the developer.
  {
    const heroSection = data.sectionContentMap?.[0];
    const heroVisuals = heroSection?.visuals || [];
    const hasCanvasVisual = heroVisuals.some(v => /canvas-animation|webgl|three\.js|particle/i.test(v));
    const hasMouseDrivenCanvas = heroVisuals.some(v => /mouse.interactive|cursor.*movement|mousemove.*drives/i.test(v));
    if (hasMouseDrivenCanvas) {
      // Already fully described in the section content map via canvasFallbackHint — no duplicate needed
    } else if (hasCanvasVisual) {
      lines.push('**Canvas/WebGL interactivity:** The hero canvas responds to mouse movement via JavaScript (mousemove events). CSS hover rules cannot capture this. Implement with canvas `mousemove` listener — track cursor position, update animation parameters (particle direction, glow position) on each RAF frame.');
    }
  }

  // ── Noise/grain texture overlay — always output when detected, regardless of AI vs rule-based direction ──
  const _noiseBgAsset = (data.assets?.backgrounds || []).find(b => /grain|noise/i.test(b.url || ''));
  if (_noiseBgAsset || data.visualProfile?.hasNoiseTexture) {
    lines.push('**Noise/grain texture overlay (apply to full page):**');
    if (_noiseBgAsset?.url) {
      lines.push(`  CSS: \`position:fixed; inset:0; z-index:2; pointer-events:none;\``);
      lines.push(`  \`background-image: url(${_noiseBgAsset.url}); background-repeat:repeat; background-attachment:fixed;\``);
      lines.push(`  \`filter: contrast(200%);\` — contrast amplifies grain. DO NOT skip — this is the site's tactile quality.`);
    } else {
      lines.push('  `position:fixed; inset:0; z-index:2; pointer-events:none`.');
      lines.push('  SVG feTurbulence: `type="fractalNoise" baseFrequency="0.65" numOctaves="4"`.');
      lines.push('  Overlay fill: white (#ffffff). Opacity: 0.06. `mix-blend-mode: overlay`.');
      lines.push('  DO NOT use `baseFrequency` above 0.65 — it creates solid grey, not grain.');
      lines.push('  DO NOT use `mix-blend-mode: lighten` on dark backgrounds — it has no visual effect.');
    }
  }

  return lines;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════

// ── Compressed direction for focused modes ──
function getCompressedDirection(directionText, focus) {
  const FOCUS_PRIMARY = {
    colors:     ['color usage'],
    typography: ['typography'],
    shadows:    ['shape & elevation', 'shape, elevation'],
    motion:     ['animation', 'interaction choreography'],
    components: ['shape & elevation', 'shape, elevation', 'animation', 'interaction choreography'],
    layout:     ['section rhythm'],
  };
  const primary = FOCUS_PRIMARY[focus] || [];
  const paragraphs = [];
  const rawLines = directionText.split('\n');
  let currentLabel = '', currentLines = [];
  for (const line of rawLines) {
    const m = line.match(/^\*\*([^*]+)\*\*/);
    if (m) {
      if (currentLines.length) paragraphs.push({ label: currentLabel, text: currentLines.join('\n') });
      currentLabel = m[1].toLowerCase();
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.length) paragraphs.push({ label: currentLabel, text: currentLines.join('\n') });

  return paragraphs.map(p => {
    const isPrimary = primary.some(r => p.label.includes(r));
    if (isPrimary) {
      if (p.label.includes('section rhythm') && focus !== 'layout') {
        const pLines = p.text.split('\n');
        const cutIdx = pLines.findIndex(l => l.includes('The page unfolds') || /^\d+\.\s\*\*/.test(l));
        return cutIdx > 0 ? pLines.slice(0, cutIdx).join('\n').trimEnd() : p.text;
      }
      return p.text;
    } else {
      const pLines = p.text.split('\n');
      const firstContent = pLines.slice(1).find(l => l.trim().length > 0);
      if (!firstContent) return null;
      const firstSentence = (firstContent.split(/\.\s/)[0] || firstContent).trim().replace(/\.$/, '') + '.';
      const labelLine = pLines[0].replace(/\*\*([^*]+)\*\*/, '**$1 (context)**');
      return `${labelLine} ${firstSentence}`;
    }
  }).filter(Boolean).join('\n\n');
}

// ── Copy pattern analyzer for section headings ──
function analyzeCopyPattern(text) {
  if (!text || text.length < 3) return '';
  const wordCount = text.trim().split(/\s+/).length;
  const isQuestion = text.trim().endsWith('?');
  const hasVerb = /\b(is|are|was|be|have|has|do|does|will|would|could|should|make|get|build|create|transform|unlock|power|start|join|explore|design|develop|ship|launch|scale|grow|help|let|turn|use|see|become|run|work|give|show|find|stay|move|provide|include|continue|expect|allow|lead|understand|stop|create|buy|serve|send|build|fall|reach|raise|pass|sell|require|report|decide|suggest)\b/i.test(text);
  const structure = isQuestion ? 'question' : hasVerb ? 'statement' : 'noun phrase';
  const technicalKW = /\b(api|sdk|architecture|infrastructure|system|platform|framework|protocol|database|runtime|compute|deploy|scale|cloud|server|model|agent|workflow|pipeline|integration|token|vector|embedding|latency|cli|config|schema|query|endpoint|webhook|microservice|container|kubernetes|docker|codebase|function|component|library|multi-agent|agentic)\b/i;
  const aspirationalKW = /\b(transform|unlock|supercharge|revolutionize|reimagine|elevate|redefine|effortlessly|seamlessly|incredible|game.changing|next.gen|cutting.edge)\b/i;
  const register = technicalKW.test(text) ? 'technical' : aspirationalKW.test(text) ? 'aspirational' : 'direct';
  return `${structure} · ${register} · ~${wordCount} words`;
}

async function buildPromptFromData(data, source) {
  const useAI = state.provider !== 'none' && !!state.apiKeys[state.provider];
  showLoading(useAI ? `Analyzing with ${PROVIDERS[state.provider].name}…` : 'Generating prompt…');

  let aiDirection = null;
  if (useAI && source === 'page') {
    aiDirection = await generateDirectionWithAI(
      data, state.provider, state.apiKeys[state.provider], getActiveModel(state.provider),
      (statusText) => showLoading(statusText),
      (partialText) => { const lt = $('loadingText'); if (lt) lt.textContent = 'Generating direction… ' + partialText.slice(0, 80); }
    );
    if (aiDirection) state.lastAiDirection = aiDirection;
  }

  // Save custom content from textarea
  if (source === 'page' && state.contentMode === 'custom') {
    state.customContent = $('customContentInput')?.value || '';
  }

  const prompt = source === 'page' ? buildPagePrompt(data, aiDirection) : buildElementPrompt(data);
  state.lastPrompt = prompt;
  if (source === 'page') state.lastAnalyzedData = data;

  // Auto-save
  const url = data.url || state.currentUrl;
  await savePrompt(url, prompt, source, 'generic', state.focus);

  showResult(prompt, { url }, source, aiDirection ? state.provider : null);
  flashSaveIndicator();
}

// Helper: converts a canvas/lottie context string into a single concrete CSS fallback hint
function canvasFallbackHint(contextStr, accentColor, bgColor, accentColors) {
  const ctx = (contextStr || '').toLowerCase();
  // Expand 3-char hex to 6-char before appending alpha suffix (e.g. #000 → #000000, prevents #00020 artifact)
  const _expandH = h => (h && h.length === 4) ? '#'+h[1]+h[1]+h[2]+h[2]+h[3]+h[3] : (h || '');
  const accent = _expandH((accentColor || '#6366f1').trim());
  const bg = _expandH((bgColor || '#0a0a0a').trim());
  // Cool-preference scoring — compute ONCE, used for ALL branches (particle fields tend to be cool-hued)
  let _bestAccent = accent;
  if (accentColors && accentColors.length > 0) {
    const _all = [accent, ...accentColors.map(c => _expandH((c||'').trim()))].filter(c => /^#[0-9a-f]{6}$/i.test(c));
    const _score = c => {
      const r=parseInt(c.slice(1,3),16), g=parseInt(c.slice(3,5),16), bv=parseInt(c.slice(5,7),16);
      const sat = Math.max(r,g,bv) - Math.min(r,g,bv);
      const isCool = bv > r + 30 || (bv > g + 10 && g > r); // blue or cyan-dominant
      return sat * (isCool ? 2 : 1);
    };
    _bestAccent = _all.reduce((best, c) => _score(c) > _score(best) ? c : best, _all[0]);
  }
  // Each branch returns a two-line object: { figma, code }
  // figma = static design description (Figma Make / design tools)
  // code  = implementation hint (Bolt, v0, Lovable, etc.)
  // Caller joins them with a separator line.

  // Mouse-interactive canvas: particle field
  if (/mouse.interactive|cursor.*movement|mousemove.*drives/i.test(ctx)) {
    return {
      figma: `[Figma] Static bg: \`${bg}\` + scattered \`${_bestAccent}\` squares (3–4px, ~35% opacity, random distribution). Pixel/square shapes NOT circles — small rectangles at varied positions. No animation needed.`,
      code:  `[Code] \`<canvas>\` full-viewport (\`position:absolute;inset:0;width:100%;height:100%\`), \`${bg}\` base. ~400 particles in \`${_bestAccent}\`, 2–3px dots. \`mousemove\` → repel within 120px — velocity += (pos-mousePos)*0.015. \`requestAnimationFrame\` loop: clear→update→draw. Fade edges: radial gradient overlay \`rgba(0,0,0,0)→${bg}\`.`,
    };
  }
  if (/\b(orb|sphere)\b/.test(ctx) || /\b(glow|voice|wave|audio|sound)\b.*(visual|animation|processing|3d|effect)/i.test(ctx) || /animated.*(orb|sphere|radial|glow)/i.test(ctx)) {
    return {
      figma: `[Figma] Static radial glow: ellipse \`${_bestAccent}30\` centre → transparent 60%, on \`${bg}\` bg.`,
      code:  `[Code] \`background: radial-gradient(ellipse at 50% 50%, ${accent}30 0%, transparent 60%);\` + \`@keyframes pulseGlow { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }\` 3s ease-in-out infinite.`,
    };
  }
  if (/\b(neural|mesh)\b/.test(ctx) || /\b(network|graph)\b.*(topology|infrastructure|agent|node)/i.test(ctx) || /agent.*(network|graph|node)/i.test(ctx) || /\bnode\b.*\bgraph\b/i.test(ctx)) {
    return {
      figma: `[Figma] Static dot-network: \`${bg}\` bg, ~40 \`${accent}\` circles (4–6px), connected with thin \`${accent}40\` lines between nearby dots.`,
      code:  `[Code] SVG dot-network — \`${bg}\` panel, ~40 dots \`${accent}\`, thin lines between neighbours, subtle opacity pulse on nodes (2s ease-in-out infinite).`,
    };
  }
  if (/globe|world map|geographic|geograph/.test(ctx)) {
    return {
      figma: `[Figma] Static sphere: circle with \`radial-gradient(circle at 35% 35%, ${accent}80, ${bg})\` fill, subtle latitude/longitude lines at \`${accent}20\`.`,
      code:  `[Code] CSS sphere — \`border-radius:50%; background:radial-gradient(circle at 35% 35%, ${accent}80, ${bg});\` slow 20s linear rotate animation.`,
    };
  }
  if (/code|terminal|editor|ide|syntax|console/.test(ctx)) {
    return {
      figma: `[Figma] Static code panel: \`${bg}\` bg, monospace font, 3–4 lines of mock syntax — keyword \`${accent}\`, string \`#a8ff78\`, comment \`#666\`.`,
      code:  `[Code] Mock code editor — \`${bg}\` bg, monospace font, syntax highlight: keywords \`${accent}\`, strings \`#a8ff78\`, comments \`#666\`.`,
    };
  }
  if (/\b(chart|graph|metric|analytics|dashboard)\b/.test(ctx)) {
    return {
      figma: `[Figma] Static chart: axes + bars/line in \`${accent}\` on \`${bg}\` bg, sans-serif labels.`,
      code:  `[Code] SVG chart — axes, data points/bars in \`${accent}\`, bg \`${bg}\`, clean sans-serif labels.`,
    };
  }
  if (ctx.length > 15) {
    return {
      figma: `[Figma] Static bg: \`${bg}\` + subtle \`${_bestAccent}15\` diagonal gradient overlay. No animation needed.`,
      code:  `[Code] \`background: linear-gradient(135deg, ${_bestAccent}20, ${bg})\` with slow 8s hue-rotate animation.`,
    };
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN BRIEF HELPERS — generate high-level personality snapshots
// ═══════════════════════════════════════════════════════════════════════════

function generateBriefPersonality(data, style) {
  const { isDark, isLight, isVibrant, isMonochromatic, isCool, isWarm, isSerif, isMono,
    hasGlowEffect, hasBrutalistShadow, hasFullRound, vp } = style;
  const ui = (vp || {}).uiPatterns || {};
  const words = [];

  // Tone
  if (isDark && isVibrant) words.push('bold');
  else if (isDark && isMonochromatic) words.push('dramatic');
  else if (isLight && isMonochromatic) words.push('refined');
  else if (isLight && isVibrant && isCool) words.push('professional');
  else if (isLight && isVibrant) words.push('energetic');
  else if (isLight && isWarm) words.push('approachable');
  else words.push('modern');

  // Character
  if (hasBrutalistShadow) words.push('brutalist');
  else if (hasGlowEffect) words.push('futuristic');
  else if (isSerif) words.push('editorial');
  else if (isMono) words.push('technical');
  else if (hasFullRound) words.push('playful');
  else words.push('minimal');

  // Trust signal
  if (isMonochromatic && isLight) words.push('trustworthy');
  else if (isDark && isCool) words.push('confident');
  else if (isWarm) words.push('human');
  else if (ui.hasPricingGrid) words.push('conversion-focused');
  else words.push('intentional');

  return words.join(', ');
}

function generateBriefVisualStrategy(data, style, vpr) {
  const { isDark, isMonochromatic, isVibrant } = style;
  const ui = (vpr || {}).uiPatterns || {};
  if (isMonochromatic && !vpr?.imageTreatment) {
    return 'Typography and whitespace carry all hierarchy; color is surgical, used only at decision points.';
  }
  if (vpr?.imageTreatment === 'cinematic') {
    return 'Full-bleed photography drives emotional atmosphere; text overlays create cinematic narrative.';
  }
  if (vpr?.imageTreatment === 'screenshot') {
    return 'Product UI screenshots are the primary visual evidence; design supports rather than competes.';
  }
  if (ui.hasDecorativeGeometry) {
    return 'Abstract geometric decoration adds depth without photography; typography dominates visual hierarchy.';
  }
  if (isDark && isVibrant) {
    return 'High-contrast dark surfaces with vivid accent color create technical authority and visual focus.';
  }
  return 'Clean layout with balanced typography and color; neither decoration nor minimalism dominates.';
}

function generateBriefMotionPhilosophy(data, vpr) {
  const mp = data.motionProfile || {};
  const dur = mp.dominantDuration || '300ms';
  const hasReveal = vpr?.hasScrollAnimation || false;
  const ap = vpr?.animationPatterns || {};

  if (hasReveal && (ap.hasStaggerReveal || ap.hasTextReveal)) {
    return `Scroll-driven reveals at ${dur} with staggered entries; hover feedback is explicit and responsive.`;
  }
  if (hasReveal) {
    return `Scroll-triggered fade-in reveals at ${dur}; interactions provide clear visual feedback.`;
  }
  if (ap.hasHeroAnimation) {
    return `Hero entrance animation on load; subsequent content is static — motion is reserved for first impression.`;
  }
  return `Minimal motion — ${dur} transitions on hover/focus only; design relies on static composition.`;
}

function generateBriefConstraints(data, style, vpr) {
  const constraints = [];
  const { isDark, isMonochromatic, isVibrant, vibrantColors } = style;
  const ui = (vpr || {}).uiPatterns || {};

  if (isDark) constraints.push('Dark mode only — never introduce white or light backgrounds');
  else constraints.push('Light mode only — never flip to dark backgrounds mid-page');

  if (isMonochromatic) constraints.push('Monochromatic palette with one accent color — never add decorative color');
  else if (vibrantColors.length <= 2) constraints.push(`Limited palette: ${vibrantColors.length} accent color(s) — use surgically`);

  if (!vpr?.imageTreatment || vpr.imageTreatment === 'none') {
    constraints.push('No decorative photography — visuals are functional (diagrams, UI, icons) or absent');
  }

  if (ui.hasIconSystem) constraints.push(`Icon system uses ${ui.iconStyle || 'outlined'} style — maintain consistency`);

  return constraints.slice(0, 4);
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERACTION PARADIGM HELPER
// ═══════════════════════════════════════════════════════════════════════════

function buildInteractionParadigm(data, vpr) {
  const mp = data.motionProfile || {};
  const ap = vpr?.animationPatterns || {};
  const ui = vpr?.uiPatterns || {};
  const hovers = data.hoverStates || [];
  const lines = [];

  // Reveal type — two-tier architecture
  const _hasPageInKF = (data.animations || []).some(a => /page-in|hero-enter|word-enter/i.test(a.name));
  const _hasHeroEntrance = !!(data.heroEntranceSequence || ap.hasTextReveal || ap.hasHeroAnimation || (data.rotatingText && data.rotatingText.length > 0) || _hasPageInKF);
  // Scroll reveals detected via class-based OR keyframe-based analysis (revealStyle from motionProfile)
  const _hasScrollReveals = !!(vpr?.hasScrollAnimation || mp.revealStyle || (data.animations || []).some(a => /blur-fade|reveal|fade-in/i.test(a.name)));
  if (_hasScrollReveals) {
    if (_hasHeroEntrance) {
      // TIER 1 + TIER 2: hero load animations AND scroll reveals
      lines.push('- ⚠️ **ANIMATION ARCHITECTURE — TWO TIERS:**');
      lines.push('  **TIER 1 — HERO (Section 1):** Load-time animations ONLY, no scroll dependency.');
      lines.push('  All hero elements animate on page mount using CSS `@keyframes` with staggered `animation-delay`.');
      lines.push('  Initial `opacity:0` IS PERMITTED in hero because animation fires automatically within 0.4s of load — never waiting for scroll.');
      lines.push('  FAILSAFE: If CSS animation fails to fire, fallback to `opacity:1` via `setTimeout(() => els.forEach(el => el.style.opacity = "1"), 500)`.');
      lines.push('  **TIER 2 — CONTENT SECTIONS:** Scroll-triggered WITH mandatory failsafe.');
      // Check both revealStyle AND keyframe names for blur-fade pattern
      const _hasBlurFadeKF = (data.animations || []).some(a => /blur-fade-left/i.test(a.name));
      const _effectiveRevealStyle = (_hasBlurFadeKF && mp.revealStyle !== 'clip-path-reveal') ? 'fade-left-or-right' : mp.revealStyle;
      const _revealDesc = _effectiveRevealStyle === 'fade-left-or-right'
        ? 'Initial: `opacity:0; translate:-24px 0`. Revealed: `opacity:1; translate:0`. Transition: `0.5s cubic-bezier(0.19,1,0.22,1)`.'
        : _effectiveRevealStyle === 'clip-path-reveal'
        ? 'Initial: `clip-path:inset(100% 0 0 0)`. Revealed: `clip-path:inset(0)`. Transition: `0.6s ease-out`.'
        : 'Initial: `opacity:0; translateY(20px)`. Revealed: `opacity:1; translateY(0)`. Transition: `0.4s ease-out`.';
      lines.push(`  Section headings/eyebrow labels reveal on scroll entry: ${_revealDesc}`);
      lines.push('  MANDATORY DUAL FAILSAFE (both required):');
      lines.push('  1. `IntersectionObserver {threshold:0.1}`: adds `.is-visible` class on intersection.');
      lines.push('  2. Timeout: `setTimeout(() => document.querySelectorAll(".reveal-text").forEach(el => el.classList.add("is-visible")), 2000);`');
      lines.push('  This guarantees animation on scroll AND visibility after 2s even if Observer never fires.');
    } else {
      // Pure scroll-driven, no hero entrance
      const threshold = mp.revealThreshold || '15%';
      lines.push(`- **Reveal:** Scroll-driven — elements appear on viewport entry. Use IntersectionObserver at ~${threshold} threshold.`);
      lines.push('  FAILSAFE: `setTimeout(() => document.querySelectorAll(".reveal-section").forEach(el => { el.style.opacity="1"; el.style.transform="none"; }), 2000);`');
      lines.push('  NEVER leave content permanently invisible. A broken reveal is worse than no reveal.');
    }
  } else {
    if (_hasHeroEntrance) {
      // Hero animations but NO scroll reveals — hero Tier 1 only
      lines.push('- **Reveal:** Hero elements animate on page mount (load-time `@keyframes` with staggered `animation-delay`).');
      lines.push('  All non-hero content is immediately visible — `opacity:1`, `transform:none`.');
      lines.push('  FAILSAFE: `setTimeout(() => heroEls.forEach(el => el.style.opacity = "1"), 500)` in case animation fails.');
    } else {
      // Truly no animations at all
      lines.push('- ⚠️ **Reveal: IMMEDIATE — CRITICAL RULE:**');
      lines.push('  ALL content must be visible on page load. `opacity:1`, `transform:none` for every element, always.');
      lines.push('  DO NOT use IntersectionObserver, scroll triggers, GSAP ScrollTrigger, AOS, or any visibility-on-scroll mechanism.');
      lines.push('  DO NOT set `opacity:0` as initial state for any element.');
      lines.push('  DO NOT use Framer Motion `whileInView` or animate-on-scroll props.');
      lines.push('  Any element invisible at load is a broken implementation.');
    }
  }

  // Hover philosophy
  const hasTransformHover = hovers.some(h => h.transform);
  const hasShadowHover = hovers.some(h => h['box-shadow']);
  const hasColorHover = hovers.some(h => h.color || h['background-color']);
  if (hasTransformHover || hasShadowHover) {
    lines.push('- **Hover feedback:** Explicit — components respond visually (shadow/transform) to signal interactivity.');
  } else if (hasColorHover) {
    lines.push('- **Hover feedback:** Subtle — color/opacity shifts acknowledge hover without dramatic motion.');
  } else {
    lines.push('- **Hover feedback:** Minimal — design relies on cursor change and context, not visual transformation.');
  }

  // Timing
  const dur = mp.dominantDuration || '300ms';
  const easing = mp.dominantEasing || 'ease';
  const durMs = parseInt(dur);
  const timingFeel = durMs <= 200 ? 'snappy, app-like responsiveness' : durMs <= 400 ? 'balanced, professional pacing' : 'editorial, premium deliberateness';
  lines.push(`- **Timing base:** \`${dur}\` \`${easing}\` — ${timingFeel}.`);

  // Scroll choreography
  if (ap.hasStaggerReveal) {
    lines.push(`- **Stagger:** Sequential element reveals with ${mp.staggerDelay || '50-100ms'} offset per item — creates reading rhythm.`);
  }
  if (ap.hasSlider || ui.hasTestimonialCarousel) {
    lines.push(`- **Carousel:** Auto-advancing ${ap.sliderType || 'slide'} pattern — ${ui.hasTestimonialCarousel ? 'testimonial cards' : 'content panels'}.`);
  }

  return lines.join('\n');
}

function buildPagePrompt(data, aiDirection) {
  const site=safeHostname(data.url), vars=data.cssVars||{};
  const focus=state.focus, platform='generic';
  const colors=data.colors||[], accents=data.accentColors||[];
  const style=analyzeDesignStyle(data), vpr=data.visualProfile||{}, ui=(vpr.uiPatterns)||{};
  const specsData = getDesignSpecsData(data, style);
  const conf = scoreConfidence(data);
  const highCount = Object.values(conf).filter(v => v === 'high').length;
  const overallConfidence = highCount >= 4 ? 'High' : highCount >= 2 ? 'Medium' : 'Low';
  const lines=[];

  lines.push(`Analysis confidence: ${overallConfidence}`);
  lines.push('**Use the exact hex colors, px values, and tokens specified in this prompt. Prefer extracted values over framework defaults (shadcn, Tailwind, component library defaults).**');
  lines.push('');
  if (focus === 'all') {
    lines.push(`Inspired by: ${site}`);
    lines.push(`Page type: ${data.layoutInfo?.pageType||'web page'}`);
  } else {
    const FOCUS_LABELS = {
      colors: 'Color System', typography: 'Typography System', shadows: 'Shape & Elevation System',
      motion: 'Motion System', layout: 'Layout System', components: 'Component System',
    };
    const focusLabel = FOCUS_LABELS[focus] || focus;
    lines.push(`Here is the **${focusLabel}** extracted from ${site}.`);
    lines.push('Use as specification for your implementation. Values are measured from the live site — do not substitute with framework defaults.');
    lines.push('');
    lines.push(`Source: ${site} · Page type: ${data.layoutInfo?.pageType||'web page'}`);
  }
  lines.push(''); lines.push(getPlatformHeader()); lines.push('');

  // Framer / Webflow site builder warning
  const _fw = data.frameworkDetection;
  if (_fw?.isFramer) {
    lines.push('> **Note:** This site is built with **Framer**. CSS classes like `framer-*` are auto-generated and not reusable. Spacing, radius, and color values below are extracted from computed styles — use them as design tokens in your own component system. Do not copy Framer-specific class names or animations verbatim.');
    lines.push('> **Motion character (Framer-native animations require translation):** Many visual animations on this site are driven by Framer\'s internal engine and are not extractable as CSS @keyframes. The motion tokens above represent only CSS-level transitions.');
    lines.push('> When implementing, preserve the *timing personality*: all interactions feel decisive and brief. Scroll-triggered elements enter immediately when in viewport — no dramatic slow-build. Hover states are color/opacity shifts only — no transforms, no shadows appearing. If an animation could be described as "playful" or "delightful", it is wrong for this brand. All motion should feel like instrument feedback — precise, immediate, unembellished.');
    lines.push('> For Framer-rendered animations (path reveals, scroll-scrub, component transitions), implement equivalents using Framer Motion, GSAP, or CSS @keyframes with IntersectionObserver.');
    lines.push('');
  } else if (_fw?.isWebflow) {
    lines.push('> **Note:** This site is built with **Webflow**. Class names (e.g. `w-*`) are Webflow-generated. Use the extracted values as design tokens — do not reference Webflow class names directly.');
    lines.push('');
  }

  // Design system fingerprint
  if (data.designSystem) {
    const ds = data.designSystem;
    lines.push(`> **Design system detected: ${ds.name}** (${ds.confidence} confidence). ${ds.note}`);
    lines.push('');
  }

  // ── Design Brief Summary — high-level personality snapshot ──
  if (focus === 'all') {
    lines.push('### Design Brief');
    const _briefPersonality = generateBriefPersonality(data, style);
    const _briefVisual = generateBriefVisualStrategy(data, style, vpr);
    const _briefMotion = generateBriefMotionPhilosophy(data, vpr);
    const _briefConstraints = generateBriefConstraints(data, style, vpr);
    lines.push(`- **Personality:** ${_briefPersonality}`);
    lines.push(`- **Visual strategy:** ${_briefVisual}`);
    lines.push(`- **Motion philosophy:** ${_briefMotion}`);
    _briefConstraints.forEach(c => lines.push(`- **Constraint:** ${c}`));
    lines.push('');
  }

  // P0 core spec — highest-priority, conflict resolver for downstream builders
  const _p0Primary = resolvedPrimaryActionColor(data, style);
  const _p0Bg = style.pageBg || data.pageBackground || null;
  const _roles = resolveTypographyRoles(data);
  const _p0TypeH = _roles.heading || null;
  const _p0TypeB = _roles.body || null;
  const _p0R = (data.borderRadii || []).filter(r => r && r !== '0px' && !r.includes('50%')).sort((a,b)=>parseInt(a)-parseInt(b))[0] || null;
  const _p0Dur = data.motionProfile?.dominantDuration || null;
  lines.push('### Core Spec (Priority)');
  lines.push('If any later detail conflicts, this section wins.');
  if (_p0Bg) lines.push(`- Base background: \`${_p0Bg}\``);
  if (_p0Primary) lines.push(`- Primary action color: \`${_p0Primary}\``);
  if (_p0TypeH) lines.push(`- Heading typeface: "${_p0TypeH}"`);
  if (_p0TypeB) lines.push(`- Body/UI typeface: "${_p0TypeB}"`);
  if (_p0R) lines.push(`- Core component radius family starts at \`${_p0R}\``);
  if (_p0Dur) lines.push(`- Motion base duration: \`${_p0Dur}\``);
  lines.push('');

  // ── Design Direction ──
  lines.push('### Design Direction');
  const rawDirection = aiDirection || generateRuleBasedDirection(data, style);
  lines.push(focus === 'all' ? rawDirection : getCompressedDirection(rawDirection, focus));
  lines.push('');

  if(focus==='all'||focus==='colors') {
    lines.push('### Color Tokens');
    if (conf.colors === 'low') {
      lines.push('> ⚠ Color confidence: low — site may use CSS-in-JS or dynamic theming.');
      lines.push('> Values below are computed approximations. Verify with browser DevTools.');
      lines.push('');
    }

    // All named CSS color vars (framework noise already filtered in content.js)
    const namedVars = Object.entries(vars).filter(([k,v]) =>
      /^#[0-9a-f]{3,8}$/i.test(v.trim()) &&
      !k.startsWith('--tw-') && !k.startsWith('--swiper-') &&
      !k.startsWith('--framer-') && !k.startsWith('--wf-')
    );
    if (namedVars.length > 0) namedVars.slice(0,14).forEach(([k,v]) => lines.push('- `'+k+'`: '+v));

    // Computed colors with corrected semantic roles
    const sc = style.semanticColors || {};
    const computedLines = [];

    // Primary action color — CSS var wins over saturation heuristic
    const primaryColor = resolvedPrimaryActionColor(data, style)
      || sc.primary
      || (style.isCool ? style.vibrantColors.find(c=>{ const r=parseInt(c.slice(1,3),16),b=parseInt(c.slice(5,7),16); return b>r&&hexSat(c)>45; }) : null)
      || style.vibrantColors[0];

    if (primaryColor) {
      const alreadyInVars = namedVars.some(([,v]) => v.toLowerCase()===primaryColor.toLowerCase());
      if (!alreadyInVars) computedLines.push('- primary-action: `'+primaryColor+'`');
    }

    // Secondary / additional accents
    const usedHex = new Set([primaryColor?.toLowerCase()]);
    const remainingAccents = dedupeColors([...accents, ...style.vibrantColors].filter(c=>hexSat(c)>=22))
      .filter(c=>!usedHex.has(c.toLowerCase()));
    remainingAccents.slice(0,3).forEach((c,i) => {
      const alreadyInVars = namedVars.some(([,v]) => v.toLowerCase()===c.toLowerCase());
      if (!alreadyInVars) computedLines.push('- accent-'+(i+1)+': `'+c+'`');
    });

    // Page background (from explicit detection or heuristic)
    const bgColor = style.pageBg;
    if (bgColor) {
      const alreadyInVars = namedVars.some(([,v]) => v.toLowerCase()===bgColor.toLowerCase());
      if (!alreadyInVars) computedLines.push('- background: `'+bgColor+'`');
    }

    // Foreground / text color — depends on whether site is dark or light
    // Dark site: foreground is the LIGHTEST non-white text color (e.g. #e6e5de)
    // Light site: foreground is the DARKEST text color (e.g. #111)
    const allComputedColors = dedupeColors(colors);
    let fgColor;
    if (style.isDark) {
      // On dark sites, text is light — find the lightest non-background color
      fgColor = allComputedColors
        .filter(c => hexLum(c) > 0.5 && c.toLowerCase() !== bgColor?.toLowerCase())
        .sort((a,b) => hexLum(b) - hexLum(a))[0];
    } else {
      // On light sites, text is dark
      fgColor = allComputedColors
        .filter(c => hexLum(c) < 0.2 && c.toLowerCase() !== bgColor?.toLowerCase())
        .sort((a,b) => hexLum(a) - hexLum(b))[0];
    }
    if (fgColor) {
      const alreadyInVars = namedVars.some(([,v]) => v.toLowerCase()===fgColor.toLowerCase());
      if (!alreadyInVars) computedLines.push('- foreground (text): `'+fgColor+'`');
    }

    // Mid surface
    const surfaceColor = allComputedColors.find(c => {
      const lum = hexLum(c);
      const sat = hexSat(c);
      // Should be between bg and fg luminance, low saturation
      if (c.toLowerCase() === bgColor?.toLowerCase()) return false;
      if (c.toLowerCase() === fgColor?.toLowerCase()) return false;
      if (style.isDark) return lum > 0.05 && lum < 0.5 && sat < 15;
      return lum > 0.1 && lum < 0.9 && sat < 15;
    });
    if (surfaceColor) {
      const alreadyInVars = namedVars.some(([,v]) => v.toLowerCase()===surfaceColor.toLowerCase());
      if (!alreadyInVars) computedLines.push('- surface: `'+surfaceColor+'`');
    }

    if (computedLines.length > 0) {
      if (namedVars.length > 0) lines.push('Computed:');
      computedLines.forEach(l => lines.push(l));
    }

    // Semantic color role summary — always show in 'all' mode
    if (focus === 'all') {
      lines.push('');
      lines.push('Color role mapping:');
      if (primaryColor) lines.push(`- **Primary action** (\`${primaryColor}\`): CTAs, buttons, active links, focus rings — "act here"`);
      if (bgColor) lines.push(`- **Surface base** (\`${bgColor}\`): Page background, card background, modal background`);
      if (surfaceColor) lines.push(`- **Surface elevated** (\`${surfaceColor}\`): Hover states, form inputs, secondary surfaces`);
      if (fgColor) lines.push(`- **Text primary** (\`${fgColor}\`): Headings, body text, primary content`);
      const textSecondary = allComputedColors.find(c => {
        const lum = hexLum(c);
        return style.isDark ? (lum > 0.3 && lum < 0.7 && hexSat(c) < 10) : (lum > 0.2 && lum < 0.5 && hexSat(c) < 10);
      });
      if (textSecondary) lines.push(`- **Text secondary** (\`${textSecondary}\`): Descriptions, metadata, placeholders`);
      const borderColor = style.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
      lines.push(`- **Border** (\`${borderColor}\`): Card edges, dividers, form borders`);
      lines.push('- **Semantic states**: Success `#22c55e` · Error `#ef4444` · Warning `#f59e0b`');
    }

    // For colors focus: add semantic role descriptions + Context section
    if (focus === 'colors') {
      // Semantic role table — which color does what, what NOT to swap
      const roleLines = [];
      if (primaryColor) {
        roleLines.push(`- \`${primaryColor}\` — **primary action**: CTAs, primary buttons, focus rings, active states. The color that says "act here." Use only at decision points.`);
      }
      // Named accents from CSS vars — infer role from var key name
      const accentVars = Object.entries(vars).filter(([k, v]) =>
        /^#[0-9a-f]{3,8}$/i.test(v.trim()) &&
        !k.startsWith('--tw-') && !k.startsWith('--framer-') && !k.startsWith('--wf-') &&
        v.toLowerCase() !== primaryColor?.toLowerCase() &&
        hexSat(v.trim()) > 18
      ).slice(0, 4);
      accentVars.forEach(([k, v]) => {
        const key = k.toLowerCase();
        let role = '';
        if (/orange|alert|error|danger|warn/i.test(key)) role = '**alert / highlight accent**: status indicators, warnings, error states. Never swap with primary action.';
        else if (/blue|link|info/i.test(key)) role = '**link / secondary CTA accent**: hyperlinks, secondary actions, informational callouts.';
        else if (/green|success|confirm|positive/i.test(key)) role = '**success / status indicator**: confirmations, positive states, badges.';
        else if (/purple|violet|brand/i.test(key)) role = '**brand accent**: decorative emphasis, specific brand moments.';
        else if (/gray|grey|neutral/i.test(key)) role = '**neutral surface**: backgrounds, borders, disabled states.';
        if (role && v.toLowerCase() !== primaryColor?.toLowerCase()) {
          roleLines.push(`- \`${v.trim()}\` (${k}) — ${role}`);
        }
      });
      if (roleLines.length > 0) {
        lines.push('**Semantic roles:**');
        roleLines.forEach(r => lines.push(r));
        lines.push('');
      }

      // Context section
      const ctxC = [];
      const tp_c = data.typographyPatterns || {};
      const typoParts_c = [];
      if (tp_c.h1?.fontFamily) typoParts_c.push(`"${tp_c.h1.fontFamily}" headings`);
      if (tp_c.body?.fontFamily && tp_c.body.fontFamily !== tp_c.h1?.fontFamily) typoParts_c.push(`"${tp_c.body.fontFamily}" body`);
      if (tp_c.body?.fontSize) typoParts_c.push(`${tp_c.body.fontSize}/${tp_c.body.fontWeight || '400'}`);
      if (typoParts_c.length > 0) ctxC.push('**Typography:** ' + typoParts_c.join(', '));
      const sp_c = vpr.spacingSystem || {};
      const layoutParts_c = [];
      if (sp_c.containerMaxWidth && sp_c.containerMaxWidth !== 'none') layoutParts_c.push(`\`${sp_c.containerMaxWidth}\` max-width`);
      if (sp_c.sectionPaddingY) layoutParts_c.push(`\`${sp_c.sectionPaddingY}\` section padding`);
      if (layoutParts_c.length > 0) ctxC.push('**Layout:** ' + layoutParts_c.join(', '));
      const interactiveRadii_c = (data.borderRadii || []).filter(r => r && r !== '0px' && !r.includes('50%'));
      const r8_c = interactiveRadii_c.find(r => parseInt(r) >= 4 && parseInt(r) <= 24);
      const rPill_c = interactiveRadii_c.find(r => parseInt(r) > 100);
      const shapeParts_c = [];
      if (r8_c) shapeParts_c.push(`\`${r8_c}\` component radius`);
      if (rPill_c) shapeParts_c.push(`\`${rPill_c}\` pill badges`);
      if (shapeParts_c.length > 0) ctxC.push('**Shape:** ' + shapeParts_c.join(', '));
      if (ctxC.length > 0) {
        lines.push('### Context — Do not change');
        ctxC.forEach(p => lines.push('- ' + p));
        lines.push('');
      }
    }

    lines.push('');

    // Dark mode tokens — dual palette extraction
    if (data.darkModeTokens && (focus === 'all' || focus === 'colors')) {
      const dmt = data.darkModeTokens;
      const dmEntries = Object.entries(dmt).slice(0, 20);
      if (dmEntries.length > 0) {
        lines.push('### Dark Mode Tokens');
        lines.push('These CSS properties change under `@media (prefers-color-scheme: dark)`. Use Tailwind `dark:` utilities:');
        dmEntries.forEach(([prop, val]) => {
          const twHint = prop.startsWith('--') ? '' : prop === 'background-color' ? ` -> dark:bg-[${val}]` : prop === 'color' ? ` -> dark:text-[${val}]` : '';
          lines.push(`- \`${prop}: ${val}\`${twHint}`);
        });
        lines.push('');
      }
    }
  }

  if(focus==='all'||focus==='typography') {
    const fontVars=Object.entries(vars).filter(([k,v])=>/font-family|typeface/.test(k)&&!v.startsWith('var('));
    const SYSTEM_FONTS = new Set(['ui-sans-serif','ui-serif','ui-monospace','ui-rounded',
      'system-ui','-apple-system','blinkmacsystemfont','helvetica neue','arial','sans-serif','serif','monospace']);
    const fonts=[...new Set((data.fonts||[])
      .filter(f=>f&&f.length>1&&f.toLowerCase()!=='inherit'&&!SYSTEM_FONTS.has(f.toLowerCase()))
      .map(f=>f.trim()))];
    if(fonts.length>0||fontVars.length>0) {
      lines.push('### Typography Tokens');
      if(fontVars.length>0) fontVars.slice(0,4).forEach(([k,v])=>lines.push(`- \`${k}\`: ${v}`));
      else {
        // Use unified role resolver to avoid heading/body drift across sections
        const tp = data.typographyPatterns || {};
        const _roleFonts = resolveTypographyRoles(data);
        const _assetFonts = data.assets?.fonts || [];
        const h1FontResolved = _roleFonts.heading || null;
        const bodyFontResolved = _roleFonts.body || null;
        const labelFont = _roleFonts.label || null;

        if (h1FontResolved && bodyFontResolved && h1FontResolved !== bodyFontResolved) {
          lines.push(`- Display/heading: "${h1FontResolved}"`);
          lines.push(`- Body/UI: "${bodyFontResolved}"`);
          // Detect distinct subheading font (e.g. Geist Mono for H2/H3)
          const h2Font = tp.h2?.fontFamily;
          const h3Font = tp.h3?.fontFamily;
          const subheadFont = (h2Font && h2Font !== h1FontResolved && h2Font !== bodyFontResolved) ? h2Font :
                              (h3Font && h3Font !== h1FontResolved && h3Font !== bodyFontResolved) ? h3Font : null;
          if (subheadFont) {
            const sfIsMono = ['mono','code','fira','jetbrains','courier','inconsolata'].some(k=>subheadFont.toLowerCase().includes(k));
            lines.push(`- Subheading (H2–H3): "${subheadFont}"${sfIsMono ? ' (monospace)' : ''}`);
          }
          if (labelFont && labelFont !== h1FontResolved && labelFont !== bodyFontResolved && labelFont !== subheadFont) {
            lines.push(`- Labels/mono: "${labelFont}"`);
          }
        } else if (h1FontResolved) {
          // h1 and body are same font — find a secondary font from extracted list or assets
          const otherFont = fonts.find(f => f !== h1FontResolved)
            || _assetFonts.find(f => f.family !== h1FontResolved)?.family
            || null;
          lines.push(`- Display/heading: "${h1FontResolved}"`);
          if (otherFont) lines.push(`- Body/UI: "${otherFont}"`);
        } else if (fonts.length >= 2) {
          // Fallback: use keyword-based classification
          const MONO_KW2 = ['mono','code','fira','jetbrains','courier','inconsolata','ibm plex mono','space mono','source code'];
          const monoIdx = fonts.findIndex(f=>MONO_KW2.some(k=>f.toLowerCase().includes(k)));
          if (monoIdx === 0 && fonts.length > 1) {
            lines.push(`- Display/heading: "${fonts[1]}"`);
            lines.push(`- Body/UI: "${fonts[0]}"`);
          } else {
            lines.push(`- Display/heading: "${fonts[0]}"`);
            if (fonts[1]) lines.push(`- Body/UI: "${fonts[1]}"`);
          }
        } else if (fonts[0]) {
          lines.push(`- Font: "${fonts[0]}" (single typeface)`);
        } else {
          lines.push('- System font stack (no custom font detected)');
        }
      }
      const sizeVars=Object.entries(vars).filter(([k,v])=>/size|step|scale/.test(k)&&/\d+(px|rem)/.test(v)
        &&!k.startsWith('--tw-')&&!k.startsWith('--swiper-')&&!k.startsWith('--toastify-')&&!k.includes('icon'));
      if(sizeVars.length>0){lines.push('Size scale:');sizeVars.slice(0,6).forEach(([k,v])=>lines.push(`  - \`${k}\`: ${v}`));}

      // Type scale with semantic roles (all mode — compact version)
      if (focus === 'all') {
        const _tp = data.typographyPatterns || {};
        const _hasTypoScale = _tp.h1 || _tp.h2 || _tp.body;
        if (_hasTypoScale) {
          lines.push('');
          lines.push('Type scale (semantic roles):');
          const _roleMap = [
            ['h1', 'H1 — hero display, page title'],
            ['h2', 'H2 — section headers'],
            ['h3', 'H3 — feature titles, card headings'],
            ['h4', 'H4 — subsection headers'],
            ['body', 'Body — reading text (60-70ch max width)'],
            ['label', 'Label — UI labels, form fields'],
            ['caption', 'Caption — metadata, timestamps, credits'],
            ['code', 'Code — inline code, terminal output'],
          ];
          for (const [key, role] of _roleMap) {
            const t = _tp[key];
            if (!t) continue;
            let spec = `- **${role}:** \`${t.fontSize}/${t.fontWeight || '400'}\``;
            if (t.letterSpacing && t.letterSpacing !== 'normal') spec += `, tracking \`${t.letterSpacing}\``;
            if (t.textTransform && t.textTransform !== 'none') spec += `, \`${t.textTransform}\``;
            if (t.fontFamily) spec += `, "${t.fontFamily}"`;
            lines.push(spec);
          }
        }
      }

      // For typography focus: add full type scale with measurements
      if (focus === 'typography') {
        const tp = data.typographyPatterns || {};
        const hasScale = tp.h1 || tp.h2 || tp.body;
        if (hasScale) {
          lines.push('');
          lines.push('### Type Scale');
          const _tsRoleFonts = resolveTypographyRoles(data);
          const _tsH1Font = _tsRoleFonts.heading || null;
          const _tsBodyFont = _tsRoleFonts.body || null;
          for (const [key, label] of [['h1','H1'],['h2','H2'],['h3','H3'],['body','Body'],['label','Label']]) {
            const t = tp[key];
            if (!t) continue;
            const _tsFam = key === 'h1' ? _tsH1Font : key === 'body' ? _tsBodyFont : (t.fontFamily || _tsBodyFont);
            let spec = `- **${label}:** \`${t.fontSize}/${t.lineHeight||'1.2'}/${t.fontWeight||'400'}\``;
            if (t.letterSpacing) spec += `, tracking \`${t.letterSpacing}\``;
            if (t.textTransform) spec += `, \`${t.textTransform}\``;
            if (_tsFam) spec += `, font "${_tsFam}"`;
            lines.push(spec);
          }
          const fontW = data.fontWeights || [];
          if (fontW.length > 0) lines.push(`- Weights used: ${fontW.join(', ')}`);
        }

        // Context section for typography focus
        {
          const ctxParts = [];
          const sc2 = style.semanticColors || {};
          const bgHex2 = style.pageBg || data.pageBackground;
          const primaryHex2 = sc2.primary || style.vibrantColors?.[0];
          const colorParts2 = [];
          if (bgHex2) colorParts2.push(`\`${bgHex2}\` base`);
          if (primaryHex2) colorParts2.push(`\`${primaryHex2}\` primary action`);
          const accentHex2 = style.accents?.find(c => c !== primaryHex2 && hexSat(c) > 28);
          if (accentHex2) colorParts2.push(`\`${accentHex2}\` accent`);
          if (colorParts2.length > 0) ctxParts.push('**Colors:** ' + colorParts2.join(', '));
          const sp2 = vpr.spacingSystem || {};
          const layoutParts2 = [];
          if (sp2.containerMaxWidth && sp2.containerMaxWidth !== 'none') layoutParts2.push(`\`${sp2.containerMaxWidth}\` max-width`);
          if (sp2.sectionPaddingY) layoutParts2.push(`\`${sp2.sectionPaddingY}\` section padding`);
          if (layoutParts2.length > 0) ctxParts.push('**Layout:** ' + layoutParts2.join(', '));
          const interactiveRadii2 = (data.borderRadii || []).filter(r => r && r !== '0px' && !r.includes('50%'));
          const r8 = interactiveRadii2.find(r => parseInt(r) >= 4 && parseInt(r) <= 24);
          const rPill = interactiveRadii2.find(r => parseInt(r) > 100);
          const shapeParts2 = [];
          if (r8) shapeParts2.push(`\`${r8}\` component radius`);
          if (rPill) shapeParts2.push(`\`${rPill}\` pill`);
          if (shapeParts2.length > 0) ctxParts.push('**Shape:** ' + shapeParts2.join(', '));
          if (ctxParts.length > 0) {
            lines.push('');
            lines.push('### Context — Do not change');
            ctxParts.forEach(p => lines.push('- ' + p));
          }
        }
      }

      lines.push('');
    }
  }

  if(focus==='all'||focus==='shadows') {
    // Exclude toastify and other library shadow vars
    const shadowVars=Object.entries(vars).filter(([k,v])=>
      /shadow|elevation/.test(k) &&
      /\d+(px|rgba)/.test(v) &&
      !k.startsWith('--tw-') && !k.startsWith('--swiper-') &&
      !k.startsWith('--toastify-') && !k.startsWith('--toast-') &&
      !k.startsWith('--sonner-') && !k.startsWith('--tippy-')
    );
    const shadows=(data.shadows||[]).filter(s=>s&&s!=='none');
    if(shadowVars.length>0||shadows.length>0) {
      lines.push('### Shadow Tokens');
      if(shadowVars.length>0) shadowVars.slice(0,5).forEach(([k,v])=>lines.push(`- \`${k}\`: ${v}`));
      else shadows.slice(0,4).forEach((s,i)=>{
        // Parenthesis-depth splitter — handles rgba(r,g,b,a) commas correctly
        const layers = [];
        let depth = 0, cur = '';
        for (let j = 0; j < s.length; j++) {
          const ch = s[j];
          if (ch==='(') depth++;
          else if (ch===')') depth--;
          else if (ch===',' && depth===0) { if(cur.trim()) layers.push(cur.trim()); cur=''; continue; }
          cur += ch;
        }
        if (cur.trim()) layers.push(cur.trim());

        // Filter: keep only real shadow layers
        const realLayers = layers.filter(layer => {
          const t = layer.trim();
          if (!t) return false;
          if (/^rgba?\(\s*0[\s,]+0[\s,]+0[\s,]+0[\s,)]*\)/.test(t)) return false;
          if (t.includes('oklab(')) return true;
          if (/rgba\(\s*\d+[\s,]+\d+[\s,]+\d+[\s,]+(?:0\.[1-9]|[1-9])/.test(t)) return true;
          if (t.includes('inset') && /rgb\(/.test(t)) return true;
          return false;
        });

        if (realLayers.length > 0) {
          // Label shadow type semantically
          const fullShadow = realLayers.join(', ');
          const isInset = realLayers.some(l => l.includes('inset'));
          const isOklab = realLayers.some(l => l.includes('oklab(') || l.includes('oklch('));
          const isGlow = realLayers.some(l => /\b0px\s+0px\s+\d+px/.test(l));
          const isLayered = realLayers.length > 1;

          let typeNote = '';
          if (isInset) typeNote = ' — inset (surface depth / border effect, not elevation)';
          else if (isOklab) typeNote = ' — colored glow elevation';
          else if (isGlow) typeNote = ' — glow (zero-offset)';
          else if (isLayered) typeNote = ' — layered elevation';

          lines.push(`- shadow-${['sm','md','lg','xl'][i]||i}${typeNote}: \`${fullShadow}\``);
        }
      });
      lines.push('');
    }
  }

  if(focus==='all'||focus==='components'||focus==='shadows') {
    const LIBRARY_PREFIXES = ['--tw-','--swiper-','--toastify-','--toast-','--sonner-','--tippy-','--mdb-','--bs-'];
    const radiiVars=Object.entries(vars).filter(([k])=>
      /radius|rounded/.test(k) && !LIBRARY_PREFIXES.some(p=>k.startsWith(p))
    );
    const radii=(data.borderRadii||[]).filter(r=>r&&r!=='0px');
    const hasPill = style.hasFullRound; // detected from computed styles

    if(radiiVars.length>0||radii.length>0||hasPill) {
      lines.push('### Shape Tokens');
      if(radiiVars.length>0) {
        radiiVars.slice(0,5).forEach(([k,v])=>lines.push(`- \`${k}\`: ${v}`));
        if (hasPill && !radiiVars.some(([,v])=>v.includes('9999'))) {
          lines.push('- Interactive elements (buttons, badges): `9999px` (pill)');
        }
      } else {
        // Sort and dedupe, add semantic labels
        const sorted=[...new Set(radii)].sort((a,b)=>parseInt(a)-parseInt(b));
        const btnR = data.buttonStyles?.primary?.borderRadius;
        sorted.slice(0,6).forEach(r=>{
          const v = parseInt(r);
          const isComplex = /\s/.test(r.trim()); // multi-value shorthand like "8px 8px 0px 0px"
          let label = '';
          if (isComplex) {
            label = ' (partial — top-attached panel or directional corner)';
          } else if (r === '9999px' || r === '50%' || v >= 100) {
            label = ' (pill / large-radius)';
          } else if (btnR && r === btnR) {
            label = ' (primary button)';
          } else if (v >= 12) {
            label = ' (card / container)';
          } else if (v >= 8) {
            label = ' (component)';
          } else if (v >= 4) {
            label = ' (input / small)';
          }
          lines.push(`- \`${r}\`${label}`);
        });
        // Always add 9999px if pill shapes detected but not in list
        if (hasPill && !sorted.some(r=>r==='9999px'||parseInt(r)>100)) {
          lines.push('- `9999px` (pill — buttons, badges)');
        }
      }
      lines.push('');
    }

    // Context section for shadows focus
    if (focus === 'shadows') {
      const ctxSh = [];
      const sc_sh = style.semanticColors || {};
      const primaryHex_sh = sc_sh.primary || style.vibrantColors?.[0];
      const bgHex_sh = style.pageBg || data.pageBackground;
      const colorParts_sh = [];
      if (bgHex_sh) colorParts_sh.push(`\`${bgHex_sh}\` base`);
      if (primaryHex_sh) colorParts_sh.push(`\`${primaryHex_sh}\` primary action`);
      if (colorParts_sh.length > 0) ctxSh.push('**Colors:** ' + colorParts_sh.join(', '));
      const tp_sh = data.typographyPatterns || {};
      const typoParts_sh = [];
      if (tp_sh.h1?.fontFamily) typoParts_sh.push(`"${tp_sh.h1.fontFamily}" headings`);
      if (tp_sh.body?.fontFamily && tp_sh.body.fontFamily !== tp_sh.h1?.fontFamily) typoParts_sh.push(`"${tp_sh.body.fontFamily}" body`);
      if (typoParts_sh.length > 0) ctxSh.push('**Typography:** ' + typoParts_sh.join(', '));
      const sp_sh = vpr.spacingSystem || {};
      const layoutParts_sh = [];
      if (sp_sh.containerMaxWidth && sp_sh.containerMaxWidth !== 'none') layoutParts_sh.push(`\`${sp_sh.containerMaxWidth}\` max-width`);
      if (sp_sh.sectionPaddingY) layoutParts_sh.push(`\`${sp_sh.sectionPaddingY}\` section padding`);
      if (layoutParts_sh.length > 0) ctxSh.push('**Layout:** ' + layoutParts_sh.join(', '));
      if (ctxSh.length > 0) {
        lines.push('### Context — Do not change');
        ctxSh.forEach(p => lines.push('- ' + p));
        lines.push('');
      }
    }
  }

  if(focus==='all'||focus==='motion') {
    const LIBRARY_PREFIXES_M = ['--tw-','--swiper-','--toastify-','--toast-','--sonner-'];
    const motionVars=Object.entries(vars).filter(([k,v])=>
      /transition|duration|easing|ease|delay/.test(k) &&
      /\d+m?s/.test(v) &&
      !LIBRARY_PREFIXES_M.some(p=>k.startsWith(p))
    );
    const transitions=(data.transitions||[]).filter(t=>
      t && t!=='all' && t.length>3 && !t.includes('0s ease 0s') &&
      // Filter out --tw-gradient and other Tailwind internal properties in transitions
      !t.includes('--tw-') && !t.includes('--toastify')
    );
    // Filter out library animation names
    const LIBRARY_ANIM_PATTERNS = [/^Toastify/i, /^aos-/i, /^gsap-/i, /^swiper/i, /^nprogress/i, /lightbox/i, /^wp-/i, /turn-on-visibility/i, /turn-off-visibility/i];
    const animations=(data.animations||[]).filter(a=> {
      if (!a) return false;
      const name = typeof a === 'object' ? a.name : a;
      if (!name) return false;
      if (name.startsWith('__') || name.length === 0) return false;
      return !LIBRARY_ANIM_PATTERNS.some(p=>p.test(name));
    });
    const hoverStates = data.hoverStates || [];
    const animationDetails = data.animationDetails || [];
    const blendModes = vpr.blendModes || [];
    if(motionVars.length>0||transitions.length>0||animations.length>0||hoverStates.length>0) {
      if (focus === 'motion') {
        // ── Rich motion output for focused mode ──
        lines.push('### Motion System');
        lines.push('');

        // Helper: resolve CSS var to hex, or derive semantic hint from var name
        const resolveVar = v => {
          if (!v || !String(v).includes('var(')) return v;
          const m = String(v).match(/var\(\s*(--[^,)]+)/);
          const varName = m?.[1]?.trim();
          const resolved = varName && vars[varName];
          if (resolved) return `${resolved} (${v})`;
          if (varName) {
            const hint = varName.replace(/^--[\w]+-[\w]+-?/, '').replace(/-/g, ' ').trim();
            return `[${hint}]`;
          }
          return v;
        };

        // Helper: find timing for a CSS property from the extracted transitions list
        const timingForProp = prop => {
          const cssKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          const match = transitions.find(t => t.startsWith(cssKey) || t.startsWith('all'));
          if (!match) return null;
          const dur = match.match(/(\d+(?:\.\d+)?(?:ms|s))/)?.[1];
          const ease = match.match(/(ease-out|ease-in-out|ease-in|ease|linear)/)?.[1];
          return [dur, ease].filter(Boolean).join(' ') || null;
        };

        // 1. Interaction patterns — hover states grouped by component type, vars resolved + timing embedded
        const COMP_MOTION = [
          { name: 'Button / CTA',   regex: /btn|button|cta|submit/i },
          { name: 'Nav link',       regex: /nav\w*[_-]?link|navbar\w*[_-]?link|header[_-]?link|menu[_-]?item/i },
          { name: 'Card / item',    regex: /card|item|tile|entry/i },
          { name: 'Arrow / icon',   regex: /arrow|chevron|icon(?!-size)/i },
          { name: 'Link / text',    regex: /^a[^-]|\.link\b|title.*hover|blog.*hover/i },
          { name: 'Input',          regex: /input|field|form/i },
        ];
        const SKIP_M = [/^\.w-/i, /text-style-/i, /text-weight-/i, /lightbox/i, /modal/i];
        const seenComp = new Set();
        const compInteractions = [];
        hoverStates.forEach(h => {
          if (SKIP_M.some(p => p.test(h.selector))) return;
          let match = COMP_MOTION.find(p => p.regex.test(h.selector));
          if (match) {
            let compName = match.name;
            if (match.name === 'Button / CTA') {
              // Detect secondary/ghost by selector keyword
              const isSecondaryBySelector = /secondary|ghost|outline|disabled/i.test(h.selector);
              if (!isSecondaryBySelector) {
                // Detect by color contrast: if hover bg is very light AND primary button bg is dark
                const hoverBg = h['background-color'] || h['backgroundColor'] || '';
                const bgMatch = hoverBg.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
                const primaryBg = (data.buttonStyles?.primary?.background || '').replace(/\s/g, '');
                const primaryIsDark = /^#[0-9a-f]{6}$/i.test(primaryBg) &&
                  parseInt(primaryBg.slice(1, 3), 16) < 120;
                if (bgMatch && primaryIsDark) {
                  const [, r, g, b] = bgMatch;
                  if (+r > 180 && +g > 180 && +b > 180) compName = 'Button (secondary/ghost)';
                }
              } else {
                compName = 'Button (secondary/ghost)';
              }
            }
            if (!seenComp.has(compName)) {
              seenComp.add(compName);
              compInteractions.push({ label: compName, h });
            }
          }
        });
        if (compInteractions.length > 0) {
          lines.push('**Interaction patterns:**');
          compInteractions.forEach(({ label, h }) => {
            const parts = Object.entries(h).filter(([k]) => k !== 'selector').map(([k, v]) => {
              // Skip multi-color border shorthand artifacts (e.g. "orange rgb(0,0,0) rgb(0,0,0) orange")
              if ((k === 'border' || k === 'border-color' || k === 'borderColor') &&
                  (String(v).match(/(?:rgb\(|rgba\(|#[0-9a-f]{3,6}|\b(?:orange|red|blue|green|black|white|transparent)\b)/gi) || []).length >= 3) {
                return null;
              }
              const resolved = resolveVar(v);
              // Skip unresolvable vars — only a semantic hint, no actionable color signal
              if (/^\[.+\]$/.test(String(resolved))) return null;
              const timing = timingForProp(k);
              const timingSuffix = timing ? `, ${timing}` : '';
              if (k === 'background-color' || k === 'backgroundColor') return `bg → \`${resolved}\`${timingSuffix}`;
              if (k === 'color') return `text → \`${resolved}\`${timingSuffix}`;
              if (k === 'opacity') return `opacity → \`${resolved}\`${timingSuffix}`;
              if (k === 'transform') return `transform: \`${resolved}\`${timingSuffix}`;
              if (k === 'border-color' || k === 'borderColor') return `border → \`${resolved}\`${timingSuffix}`;
              if (k === 'box-shadow' || k === 'boxShadow') return `shadow → \`${resolved}\`${timingSuffix}`;
              return `${k}: \`${resolved}\`${timingSuffix}`;
            }).filter(Boolean);
            if (parts.length > 0) lines.push(`- **${label}:** ${parts.join(', ')}`);
          });
          lines.push('');
        }

        // 2. Scroll-triggered animations
        const sap2 = vpr.animationPatterns || {};
        if (sap2.hasMaskReveal || sap2.hasStaggerReveal || sap2.hasTextReveal || vpr.hasScrollAnimation) {
          lines.push('**Scroll-triggered animations:**');
          if (sap2.hasMaskReveal) lines.push('- Mask reveal: `clip-path: inset(100%→0%)`, 0.6s ease-out on scroll entry');
          else if (sap2.hasStaggerReveal) lines.push('- Stagger reveal: children `opacity 0→1, translateY(20px→0)`, 80ms delay between siblings, 0.4s ease-out — trigger with IntersectionObserver');
          else if (vpr.hasScrollAnimation) lines.push('- Scroll reveal: `opacity 0→1, translateY(20px→0)`, 0.5s ease-out on scroll entry — trigger with IntersectionObserver');
          lines.push('');
        }

        // 3. Keyframe animations with semantic intent
        if (animations.length > 0) {
          lines.push('**Keyframe animations:**');
          animations.slice(0, 4).forEach(a => {
            if (typeof a !== 'object' || !a.name) { lines.push(`- \`${a}\``); return; }
            let desc = `- \`${a.name}\``;
            if (a.from && a.to) desc += `: \`${a.from}\` → \`${a.to}\``;
            if (/spin|rotat/i.test(a.name)) desc += ' — continuous rotation (loading / decorative spinner)';
            else if (/fade|opacity/i.test(a.name)) desc += ' — fade in/out';
            else if (/slide|translat/i.test(a.name)) desc += ' — slide movement';
            else if (/pulse|breath/i.test(a.name)) desc += ' — pulsing rhythm';
            else if (/marquee|ticker/i.test(a.name)) desc += ' — infinite scroll ticker';
            else if (/bounce/i.test(a.name)) desc += ' — bounce / spring motion';
            lines.push(desc);
          });
          lines.push('');
        }

        // 4. CSS variable-defined motion tokens (only if any)
        if (motionVars.length > 0) {
          lines.push('**Motion tokens (CSS variables):**');
          motionVars.slice(0, 4).forEach(([k, v]) => lines.push(`- \`${k}\`: ${v}`));
          lines.push('');
        }

        // 5. Context — cross-system reference so LLM doesn't fall back to defaults
        {
          const ctxParts = [];
          // Colors: page bg + primary action + top accent
          const sc = style.semanticColors || {};
          const bgHex = style.pageBg || data.pageBackground;
          const primaryHex = sc.primary || style.vibrantColors?.[0];
          const accentHex = style.accents?.find(c => c !== primaryHex && hexSat(c) > 28);
          const colorParts = [];
          if (bgHex) colorParts.push(`\`${bgHex}\` base`);
          if (primaryHex) colorParts.push(`\`${primaryHex}\` primary action`);
          if (accentHex) colorParts.push(`\`${accentHex}\` accent`);
          if (colorParts.length > 0) ctxParts.push('**Colors:** ' + colorParts.join(', '));
          // Typography: head font + body font + key body size
          const tp = data.typographyPatterns || {};
          const typoParts = [];
          if (tp.h1?.fontFamily) typoParts.push(`"${tp.h1.fontFamily}" headings`);
          if (tp.body?.fontFamily && tp.body.fontFamily !== tp.h1?.fontFamily) typoParts.push(`"${tp.body.fontFamily}" body`);
          if (tp.body?.fontSize) typoParts.push(`body ${tp.body.fontSize}/${tp.body.fontWeight || '400'}`);
          if (typoParts.length > 0) ctxParts.push('**Typography:** ' + typoParts.join(', '));
          // Layout: max-width + section padding
          const sp = vpr.spacingSystem || {};
          const layoutParts = [];
          if (sp.containerMaxWidth && sp.containerMaxWidth !== 'none') layoutParts.push(`\`${sp.containerMaxWidth}\` max-width`);
          if (sp.sectionPaddingY) layoutParts.push(`\`${sp.sectionPaddingY}\` section padding`);
          if (layoutParts.length > 0) ctxParts.push('**Layout:** ' + layoutParts.join(', '));
          if (ctxParts.length > 0) {
            lines.push('### Context — Do not change');
            ctxParts.forEach(p => lines.push('- ' + p));
            lines.push('');
          }
        }

      } else {
        // 'all' mode — token list with element context hints
        lines.push('### Motion Tokens');
        if(motionVars.length>0) motionVars.slice(0,4).forEach(([k,v])=>lines.push(`- \`${k}\`: ${v}`));
        if(transitions.length>0) {
          const PROP_CTX = {
            'background-color':'hover/active bg', 'background':'hover/active bg',
            'color':'text color hover', 'opacity':'fade entrance / hover',
            'transform':'movement, scale, rotate', 'height':'accordion / expand-collapse',
            'max-height':'accordion / expand-collapse', 'width':'expand / resize',
            'border-color':'border emphasis on hover', 'box-shadow':'elevation on hover',
            'filter':'color or blur filter', 'padding':'layout shift',
          };
          transitions.slice(0,3).forEach(t=>{
            const prop = t.split(/\s+/)[0];
            const ctx = PROP_CTX[prop] ? ` — ${PROP_CTX[prop]}` : '';
            const durMatch = t.match(/([\d.]+)s/);
            let intent = '';
            if (durMatch) {
              const ms = parseFloat(durMatch[1]) * 1000;
              if (ms < 200) intent = ' (snappy, confident UI)';
              else if (ms <= 350) intent = ' (standard responsive)';
              else if (ms <= 500) intent = ' (editorial, premium)';
              else intent = ' (dramatic, scroll-driven)';
            }
            lines.push(`- transition: \`${t}\`${ctx}${intent}`);
          });
        }
        if(animations.length>0) {
          animations.slice(0,6).forEach(a => {
            if (typeof a === 'object' && a.name) {
              let kfLine = `- Keyframe \`${a.name}\``;
              if (a.from) kfLine += `: from \`${a.from}\``;
              if (a.to) kfLine += ` → to \`${a.to}\``;
              lines.push(kfLine);
            } else {
              lines.push(`- Keyframe: ${a}`);
            }
          });
        }
        if(animationDetails.length>0) {
          lines.push('- Active animations:');
          animationDetails.slice(0,4).forEach(a => lines.push(`  - \`${a}\``));
        }
        // Page transition keyframes — usage context
        const _hasPageTransitions = (data.animations || []).some(a => /page-out|page-in/i.test(a.name));
        const _hasBlurFade = (data.animations || []).some(a => /blur-fade/i.test(a.name));
        const _revealStyleForKF = data.motionProfile?.revealStyle;
        if (_hasPageTransitions) {
          lines.push('Page transitions (implement on route change):');
          lines.push('  `css-page-out`: outgoing page — fade + slight scale (`opacity:1→0.5, scale:1→1.1`). `css-page-in`: incoming page — slides up (`translateY(100%)→0`). Duration: 0.3s.');
          if (_revealStyleForKF !== 'fade-left-or-right') {
            lines.push('  If single-page with no routing, skip page transitions.');
          }
        }
        if (_hasBlurFade && _revealStyleForKF === 'fade-left-or-right') {
          lines.push('`blur-fade-left`: used for section heading scroll reveals (see Interaction Paradigm TIER 2). Apply to eyebrow labels and H2 headings on viewport entry.');
        } else if (_hasBlurFade) {
          lines.push('`blur-fade-left/right`: content panel transitions (tab or section swap). If single-page, applies to in-page content toggles only.');
        }
        lines.push('');
      }
    }

    // Blend modes
    if(blendModes.length > 0) {
      lines.push(`- Mix-blend-modes used: ${blendModes.join(', ')}`);
    }
  }

  // ── Interaction Paradigm ──
  if (focus === 'all' || focus === 'motion') {
    lines.push('### Interaction Paradigm');
    lines.push(buildInteractionParadigm(data, vpr));
    lines.push('');
  }

  if(focus==='all'||focus==='components') {
    lines.push('### Component Patterns');
    generateComponentGuidance(data, style, specsData).forEach(c=>lines.push(c));
    lines.push('');
  }

  if(focus==='all'||focus==='layout') {
    lines.push('### Layout & Page Structure');
    const layout=data.layoutInfo||{};
    const spacing = vpr.spacingSystem||{};
    if(layout.hasNav) lines.push(`- Navigation: ${vpr.navStyle||'sticky'}`);
    if(spacing.containerMaxWidth && spacing.containerMaxWidth !== 'none') lines.push(`- Container max-width: \`${spacing.containerMaxWidth}\``);
    else if(layout.maxWidth&&layout.maxWidth!=='none') lines.push(`- Max content width: ${layout.maxWidth}`);
    if(spacing.sectionPaddingY) lines.push(`- Section vertical padding: \`${spacing.sectionPaddingY}\``);
    if(spacing.gridGap) lines.push(`- Grid gap: \`${spacing.gridGap}\``);
    if(spacing.cardGap) lines.push(`- Card gap: \`${spacing.cardGap}\``);
    if(vpr.splitLayoutCount>0) lines.push(`- ${vpr.splitLayoutCount} split-column section(s) — alternate text/image side`);
    if(vpr.hasScrollAnimation) lines.push('- Scroll animations: IntersectionObserver + fade + translateY(20px)→0');
    if(ui.pageStructure?.length>0) lines.push(`- Structure: ${ui.pageStructure.join(' → ')}`);
    lines.push('');
  }

  // ── Custom Content injection ──
  if (state.contentMode === 'custom' && state.customContent.trim()) {
    lines.push('### Custom Content');
    lines.push('Use the following content for headings, descriptions, and CTAs instead of the site\'s original text:');
    lines.push('```');
    lines.push(state.customContent.trim());
    lines.push('```');
    lines.push('Apply the content above to the sections below in order. First line = hero heading, subsequent lines = section headings and body text.');
    lines.push('');
  }

  // ── Responsive Breakpoints ──
  if ((focus === 'all' || focus === 'layout') && data.breakpoints && data.breakpoints.length > 0) {
    lines.push('### Responsive Breakpoints');
    const TAILWIND_MAP = [[640,'sm'],[768,'md'],[1024,'lg'],[1280,'xl'],[1536,'2xl']];
    data.breakpoints.forEach(bp => {
      const twMatch = TAILWIND_MAP.reduce((best, [px, name]) =>
        Math.abs(bp - px) < Math.abs(bp - best[0]) ? [px, name] : best, [9999, 'custom']);
      const twLabel = Math.abs(bp - twMatch[0]) <= 32 ? `≈ Tailwind \`${twMatch[1]}:\`` : 'custom breakpoint';
      lines.push(`- ${bp}px — ${twLabel}`);
    });
    lines.push('');
  }

  // ── Section Content Map — detailed section-by-section blueprint ──
  if(focus==='all') {
    const scm = data.sectionContentMap || [];
    if (scm.length > 0) {
      // Section rhythm summary
      const _breathingSections = scm.filter(s => { const py = parseInt(s.paddingY || '0'); return py > 80 && !s.gridCols; }).length;
      const _packedSections = scm.filter(s => s.gridCols || s.layout === 'multi-column-grid').length;
      const _bgFlips = scm.reduce((count, s, i) => i > 0 && s.bgColor && scm[i-1].bgColor && s.bgColor !== scm[i-1].bgColor ? count + 1 : count, 0);
      if (scm.length >= 3) {
        lines.push(`**Page rhythm:** ${scm.length} sections — ${_breathingSections} breathing (spacious padding), ${_packedSections} packed (grid/multi-col). ${_bgFlips > 0 ? `${_bgFlips} background color flip${_bgFlips > 1 ? 's' : ''} create visual breaks.` : 'Uniform background throughout.'}`);
        lines.push('');
      }
      lines.push('### Section Content Map');
      lines.push('Build the page with these exact sections in order. Each section\'s background, layout, and content are measured from the live site:');
      lines.push('');
      // Determine entrance animation type and output CSS once at top
      const sap = vpr.animationPatterns || {};
      const _mp = data.motionProfile || {};
      const _hasBlurFadeKF2 = (data.animations || []).some(a => /blur-fade-left/i.test(a.name));
      const _revealType = (_hasBlurFadeKF2 && _mp.revealStyle !== 'clip-path-reveal') ? 'fade-left-or-right' : (_mp.revealStyle || 'fade-up');
      const _hasAnyScrollReveal = !!(vpr.hasScrollAnimation || _mp.revealStyle || _hasBlurFadeKF2);
      // Output reveal CSS definition ONCE at the top of section map (saves ~30 lines vs repeating per-section)
      if (_hasAnyScrollReveal) {
        let _revealCSS;
        if (_revealType === 'fade-left-or-right') {
          _revealCSS = '`.reveal-text { opacity:0; translate:-24px 0; transition: opacity 0.5s cubic-bezier(0.19,1,0.22,1), translate 0.5s cubic-bezier(0.19,1,0.22,1); }` `.reveal-text.is-visible { opacity:1; translate:0; }`';
        } else {
          _revealCSS = '`.reveal-text { opacity:0; transform:translateY(20px); transition: opacity 0.4s ease-out, transform 0.4s ease-out; }` `.reveal-text.is-visible { opacity:1; transform:translateY(0); }`';
        }
        lines.push(`**Scroll reveal CSS (applies to ALL sections below hero):** ${_revealCSS}`);
        lines.push('Include mandatory 2s timeout failsafe (see Interaction Paradigm).');
        lines.push('');
      }
      // Per-section entrance reference (short — CSS already defined above)
      let entranceAnim;
      if (_revealType === 'fade-left-or-right') {
        entranceAnim = 'Entrance: blur-fade reveal on scroll entry (see CSS above). H2 delay: 0.1s after eyebrow.';
      } else if (_revealType === 'clip-path-reveal' || sap.hasMaskReveal) {
        entranceAnim = 'Entrance: `clip-path: inset(100% 0 0 0)→inset(0); transition: 0.6s ease-out` on scroll.';
      } else if (sap.hasStaggerReveal) {
        entranceAnim = 'Entrance: children stagger in (see CSS above), 80ms delay between each.';
      } else {
        entranceAnim = 'Entrance: fade-up reveal on scroll (see CSS above).';
      }

      // Inject ticker strip between hero and first content section when marquee detected
      const _hasMarqueeKeyframe = (data.animations || []).some(a => /marquee|ticker/i.test(a.name));
      const _hasMarqueeVar = !!(data.cssVars?.['--marquee-duration'] || data.cssVars?.['--marquee-speed']);
      const _hasMarquee = ui.hasMarquee || ui.hasLogoStrip || vpr.animationPatterns?.hasTicker || _hasMarqueeKeyframe || _hasMarqueeVar;
      let _tickerInjected = false;

      scm.forEach((sec, i) => {
        // Inject ticker section after hero
        if (i === 1 && _hasMarquee && !_tickerInjected) {
          _tickerInjected = true;
          const _labelFont = data.typographyPatterns?.label?.fontFamily || data.fonts?.[2] || 'monospace';
          const _tickerBg = style.isDark ? '#000000' : '#ffffff';
          const _tickerBorder = style.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
          const _tickerColor = style.isDark ? 'rgba(240,237,230,0.5)' : 'rgba(0,0,0,0.4)';
          lines.push(`**Section ${i}.5: ticker-strip** (between hero and content)`);
          lines.push(`  Full-width horizontal ticker bar.`);
          lines.push(`  background: \`${_tickerBg}\`; padding: \`12px 0\`; border-top and border-bottom: \`1px solid ${_tickerBorder}\`.`);
          lines.push(`  Content: repeating text items separated by "·". Font: "${_labelFont}", 12.8px, uppercase, letter-spacing: 1.28px, color: \`${_tickerColor}\`.`);
          lines.push(`  Animation: \`@keyframes ticker { to { transform: translateX(-50%) } }\` — 30s linear infinite.`);
          lines.push(`  Inner div: width 200% containing two copies of the text for seamless loop.`);
          lines.push(`  This ticker is the visual hard-cut between the hero and the content sections.`);
          lines.push('');
        }

        // Override to case-grid if: grid pattern detected AND this section has entries
        let secType = sec.type;
        if (data.caseGridPattern && i > 0 && secType !== 'hero' && secType !== 'video-showcase') {
          const secClass = (sec.className || '').toLowerCase();
          const sectionEntries = sec.entryCount || 0;
          if ((sec.heading && /case|work|project|portfolio|featured|collaboration/i.test(sec.heading)) ||
              /casegrid|case-grid|portfolio|projects|work-grid/i.test(secClass) ||
              sectionEntries > 4) {
            secType = 'case-grid';
          }
        }
        let desc = `**Section ${i+1}: ${secType}**`;
        if (sec.heading) {
          const tone = analyzeCopyPattern(sec.heading);
          desc += ` — [SAMPLE COPY] "${sec.heading}"${tone ? ' ['+tone+']' : ''}`;
        }
        lines.push(desc);
        if (sec.eyebrow) lines.push(`  Eyebrow label: "${sec.eyebrow}"`);
        if (sec.bgColor) lines.push(`  Background: ${sec.bgColor}`);
        if (sec.gradient) lines.push(`  Gradient: \`${sec.gradient}\``);
        // Feature-showcase: [0x] numbered sections with multiple panels
        if (secType === 'feature-showcase') {
          const _panels = sec.steps || [];
          const _panelHeadings = _panels.map(s => s.heading || s.label).filter(Boolean);
          if (_panelHeadings.length > 0) {
            lines.push(`  Layout: feature-showcase — numbered feature section with multiple panels.`);
            lines.push(`  Feature panels: ${_panelHeadings.map(h => '"' + h + '"').join(' · ')}`);
          }
          // CTAs per panel
          if (sec.ctas?.length > 0) {
            lines.push(`  Per-panel CTAs: ${sec.ctas.map(c => '"'+c+'"').join(' · ')}`);
          }
          // Panel descriptions from steps
          if (_panels.length > 0 && _panels.some(s => s.body || s.description)) {
            const descs = _panels.map(s => (s.body || s.description || '').slice(0,60)).filter(Boolean);
            if (descs.length > 0) lines.push(`  Panel descriptions: ${descs.map(d => '"'+d+'.."').join(' | ')}`);
          }
          lines.push(`  This is a state-driven showcase, NOT a static grid. Each panel shows distinct product UI content.`);
        }
        // Stats/metrics section — add metric format spec (adapt to THIS section's bg)
        else if (secType === 'stats/metrics') {
          const _hFont = data.typographyPatterns?.h2?.fontFamily || data.fonts?.[0] || 'display font';
          const _bFont = data.typographyPatterns?.body?.fontFamily || data.fonts?.[1] || 'body font';
          // Use section bg to determine dark/light — not page-level isDark
          const _secBgLum = sec.bgColor ? hexLum(sec.bgColor) : (style.isDark ? 0.1 : 0.9);
          const _isDarkSec = _secBgLum < 0.35;
          lines.push(`  Metric format: Values in "${_hFont}", 52–80px, 700 weight, color \`${_isDarkSec ? '#ffffff' : '#000000'}\`. Labels: "${_bFont}", 13–16px, 400 weight, color \`${_isDarkSec ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)'}\`. Layout: flex row, gap 48px, centered.`);
        }
        if (sec.heroColumns && sec.heroColumns.length >= 2) {
          const hc = sec.heroColumns;
          lines.push(`  Layout: 2-column split — left ${hc[0].width} ${hc[0].content}, right ${hc[1].width} ${hc[1].content}`);
        } else {
          // Infer split-columns when DOM detection missed it (e.g. Framer deep nesting doesn't expose flex children at shallow depth)
          // Signal: stacked layout + section has heading + all visuals are on the SAME side (all right XOR all left)
          let _displayLayout = sec.layout;
          let _splitHint = null;
          if (sec.layout === 'stacked' && sec.heading && sec.visualDescriptions?.length > 0) {
            const _vds = sec.visualDescriptions;
            const _rightCount  = _vds.filter(v => /,\s*right[,\s\.:]/.test(v)).length;
            const _leftCount   = _vds.filter(v => /,\s*left[,\s\.:]/.test(v)).length;
            const _centerCount = _vds.filter(v => /,\s*center[,\s\.:]/.test(v)).length;
            if (_centerCount === 0) {
              if (_rightCount >= 1 && _leftCount === 0) {
                _displayLayout = 'split-columns';
                _splitHint = 'text/content left · visual(s) right';
              } else if (_leftCount >= 1 && _rightCount === 0) {
                _displayLayout = 'split-columns';
                _splitHint = 'visual(s) left · text/content right';
              } else if (_rightCount >= 1 && _leftCount >= 1) {
                // Both sides present — check if visuals are similar size (2-col grid) or very different sizes (overlapping/layered)
                const _areas = _vds.map(v => { const m = v.match(/\] (\d+)×(\d+)/); return m ? parseInt(m[1])*parseInt(m[2]) : 0; }).filter(a => a > 0);
                const _maxA = _areas.length ? Math.max(..._areas) : 0;
                const _minA = _areas.length ? Math.min(..._areas) : 0;
                if (_areas.length >= 2 && _minA > 0 && _maxA / _minA < 2) {
                  _displayLayout = 'multi-column-grid';
                  _splitHint = '2-column visual grid (equal-size visuals side by side)';
                } else {
                  _splitHint = 'overlapping-float';
                }
              }
            }
          }
          if (sec.canvasLayout === 'full-viewport-overlay' || _displayLayout === 'full-viewport-centered') {
            lines.push(`  Layout: full-viewport centered — canvas is \`position:absolute; inset:0; width:100%; height:100%\` background. Text overlay: \`position:relative; z-index:1; text-align:center\`. This is NOT a split-columns layout.`);
          } else if (_splitHint === 'overlapping-float') {
            lines.push(`  Layout: stacked (visuals are absolutely-positioned floating cards — overlapping/layered arrangement, NOT a side-by-side CSS split)`);
          } else {
            lines.push(`  Layout: ${_displayLayout}`);
            if (_splitHint) lines.push(`  Split: ${_splitHint}`);
          }
          if (sec.gridCols) {
            if (sec.gridCols.startsWith('baseline-grid')) {
              lines.push(`  Note: ${sec.gridCols} — decorative layout grid, use flexbox for content`);
            } else {
              lines.push(`  Grid columns: \`${sec.gridCols}\``);
              // Detect 1px divider columns pattern (e.g. "314px 1px 314px 1px 314px")
              if (/\b1px\b/.test(sec.gridCols)) {
                const colCount = (sec.gridCols.match(/\b1px\b/g) || []).length;
                lines.push(`  The \`1px\` columns are visual dividers (${colCount}): \`background: rgba(255,255,255,0.08); height: 100%\`. Do NOT use border-right on items — use actual 1px grid column dividers.`);
              }
            }
          }
        }
        // Portfolio-split: logo grid LEFT + canvas RIGHT
        if (secType === 'portfolio-split' && sec.portfolioGridInfo) {
          const pg = sec.portfolioGridInfo;
          const _logoList = pg.logoNames?.length ? pg.logoNames.join(', ') : 'company logos';
          const _gridBorder = style.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
          const _gridHoverBg = style.isDark ? '#232529' : 'rgba(0,0,0,0.03)';
          lines.push(`  Logo grid — ${pg.cols}×${pg.rows} layout, ${pg.cols * pg.rows} cells (left column): ${_logoList}.`);
          lines.push(`  Container: \`border-top: 1px solid ${_gridBorder}; border-left: 1px solid ${_gridBorder}\`.`);
          lines.push(`  Each cell: \`border-right: 1px solid ${_gridBorder}; border-bottom: 1px solid ${_gridBorder}; border-radius: 0\`.`);
          lines.push(`  This creates a continuous grid-line table effect. Do NOT use card-style borders with gap.`);
          lines.push(`  Cell content: logo centered, min-height: 120px. Hover: \`background: ${_gridHoverBg}\`, 150ms.`);
          const _accentForPanel = (data.accentColors||[])[0] || style.semanticColors?.primary || '#6366f1';
          if (pg.cornerLabels?.length) {
            lines.push(`  Right half: canvas animation panel + absolutely-positioned word labels at corners: ${pg.cornerLabels.map(l=>`"${l}"`).join(', ')}.`);
          } else {
            lines.push(`  Right half: canvas animation panel.`);
          }
          const _panelBg = style.isDark ? '#000000' : '#f7f7f7';
          const _panelBorder = style.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
          lines.push(`  Right panel spec: 100% height, min-height: 360px. \`background: ${_panelBg}; border: 1px solid ${_panelBorder}; overflow: hidden\`.`);
          lines.push(`  CANVAS FALLBACK (required if canvas not feasible): SVG particle field on ${_panelBg}.`);
          lines.push(`  ~60 dots (2px circles, \`${_accentForPanel}\` at 50% opacity), random positions. Thin connecting lines \`${_accentForPanel}25\` between nearby dots (within 80px radius).`);
          lines.push(`  Subtle opacity pulse: \`animation: 2–4s ease-in-out infinite alternate\` between opacity 0.4 and 1. Do NOT leave this column empty.`);
        }
        // Hero-specific: CTA button dimensions + floating illustration elements
        if (i === 0) {
          if (sec.heroCtaStyle) {
            const hs = sec.heroCtaStyle;
            lines.push(`  Hero CTA size: \`${hs.width}×${hs.height}px\`, radius: \`${hs.borderRadius}\`, padding: \`${hs.padding}\`${hs.hasIcon ? ', has small product/logo icon left of text (NOT a play/video icon — use a diamond ◆ or abstract shape icon)' : ''}. NOTE: Much larger than nav button — treat as wide feature card, not a compact pill.`);
          }
          if (sec.floatingIllustrations?.length > 0) {
            const _floatCount = sec.floatingIllustrations.length;
            const _pattern = sec.floatingPattern || 'decorative-shapes';

            if (_pattern === 'radiating-lines') {
              // Starburst/sunburst — narrow gradient divs radiating from center
              const _minW = sec.floatingIllustrations[0]?.w || 50;
              const _maxW = sec.floatingIllustrations[_floatCount - 1]?.w || 200;
              const _avgH = Math.round(sec.floatingIllustrations.reduce((s, il) => s + il.h, 0) / _floatCount);
              const _sampleGrad = sec.floatingIllustrations.find(il => il.bgGradient)?.bgGradient || 'linear-gradient(to bottom, rgba(200,200,200,0.3), transparent)';
              lines.push(`  Radiating lines (${_floatCount} elements, starburst pattern from center — \`position:absolute\`, decorative):`);
              lines.push(`    ⚠ IMPORTANT: These are RADIATING LINES emanating from center-top, NOT cards.`);
              lines.push(`    → ${_floatCount} narrow gradient divs creating a starburst/sunburst pattern behind the hero text.`);
              lines.push(`    → Each line: \`position:absolute; top:50%; left:50%; transform-origin: top center\`.`);
              lines.push(`    → Width range: ${_minW}–${_maxW}px, height: ~${_avgH}px. Distribute rotation evenly: each line \`rotate(${Math.round(360 / _floatCount)}deg * index)\`.`);
              lines.push(`    → Background: \`${_sampleGrad.slice(0, 80)}\` (gradient fading to transparent). Color: subtle gray/neutral.`);
              lines.push(`    → No border-radius, no box-shadow — these are thin decorative lines, not cards.`);
            } else {
              // Content cards or decorative shapes
              lines.push(`  Floating illustration cards (${_floatCount} elements, scattered around hero — \`position:absolute\`, decorative):`);
              sec.floatingIllustrations.forEach(il => {
                let d = `    - ${il.w}×${il.h}px`;
                if (il.bg !== 'gradient') d += ` bg:\`${il.bg}\``;
                else if (il.bgGradient) d += ` bg:\`${il.bgGradient.slice(0, 60)}\``;
                else d += ` bg:gradient`;
                d += ` pos:${il.pos}`;
                if (il.radius) d += ` radius:\`${il.radius}\``;
                if (il.has3D) d += ` (3D-rotated)`;
                if (il.text) d += ` text:"${il.text}"`;
                lines.push(d);
              });
              if (_pattern === 'content-cards') {
                lines.push(`    ⚠ IMPORTANT: These are real UI elements on the site — do NOT skip them.`);
                lines.push(`    → Implement as \`position:absolute\` colored rounded-rect cards scattered around the hero section.`);
                lines.push(`    → Cards represent design token samples (color chips, font labels, code snippets). Apply subtle 3D tilt: \`transform: perspective(800px) rotateY(-12deg) rotateX(8deg)\`.`);
                lines.push(`    → Use the bg colors listed above exactly. Each card has border-radius ~12–16px, box-shadow: \`0 8px 32px rgba(0,0,0,0.15)\`.`);
              } else {
                lines.push(`    → Implement as \`position:absolute\` decorative elements scattered around the hero.`);
                lines.push(`    → Apply transforms and bg colors/gradients as specified above.`);
              }
            }
          }
        }
        // Animation binding per section
        if (i === 0) {
          const _heroPageInKF = (data.animations || []).some(a => /page-in|hero-enter|word-enter/i.test(a.name));
          const _heroHasAnim = sap.hasTextReveal || sap.hasHeroAnimation || (data.rotatingText && data.rotatingText.length > 0) || data.heroEntranceSequence || _heroPageInKF;
          if (_heroHasAnim) {
            lines.push('  Animation: hero loads immediately (no scroll trigger) — TIER 1 load-time animation.');
            lines.push('  Headline words appear sequentially: each `<span>` with `@keyframes word-enter { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }`. `animation-delay`: 0s, 0.1s, 0.2s, 0.3s per word.');
            lines.push('  FAILSAFE: `setTimeout(() => document.querySelectorAll(".hero-word").forEach(el => el.style.opacity = "1"), 500);`');
          } else {
            lines.push('  Animation: hero loads immediately (no scroll trigger).');
          }
          // Add rotating text info to hero
          if (data.rotatingText && data.rotatingText.length > 0) {
            const rt = data.rotatingText[0];
            lines.push(`  [rotating-text] H1 word "${rt.words[rt.words.length-1] || rt.words[0]}" cycles through: ${rt.words.map(w=>'"'+w+'"').join(' → ')} with crossfade, ~3s interval (\`setInterval\`). Fires immediately on mount — NOT scroll-triggered.`);
          }
          // Add illustration style to hero
          if (data.illustrationStyle) {
            const ill = data.illustrationStyle;
            if (ill.type === 'monochrome-line-art') {
              lines.push(`  [line-art illustration] Black-on-white hand-drawn illustration (${ill.details?.pathCount || '?'} SVG paths, ${ill.details?.width||'?'}×${ill.details?.height||'?'}px). Editorial, sketch-like character art.`);
            } else if (ill.type === 'colored-illustration') {
              lines.push(`  [colored illustration] Multi-color illustrated visual (${ill.details?.width||'?'}×${ill.details?.height||'?'}px).`);
            } else if (ill.type === 'spritesheet-illustration') {
              lines.push(`  [spritesheet illustration] Scroll-driven animated illustration. Changes with scroll position.`);
            } else if (ill.type === 'illustration-image') {
              if (data.visionIllustrationDescription) {
                lines.push(`  **Hero illustration (Vision AI analysis):**`);
                lines.push(data.visionIllustrationDescription.split('\n').map(l => `  ${l}`).join('\n'));
                lines.push(`  Recreate as inline SVG using exact values above. Do NOT use a placeholder image.`);
              } else {
                lines.push(`  [illustration] Image-based illustration (${ill.details?.src || 'hero visual'}, ${ill.details?.width||'?'}×${ill.details?.height||'?'}px). Add an API key to get Vision AI analysis for exact recreation.`);
              }
            } else if (ill.type === 'webgl-illustration') {
              lines.push(`  [animated illustration] WebGL/canvas-rendered illustration from hidden source image (${ill.details?.src || 'hero visual'}). Likely animated characters or scene that changes with scroll. Recreate as a centered editorial illustration — hand-drawn black-on-white character art style.`);
            } else if (ill.type === 'hidden-svg-illustration') {
              lines.push(`  [illustration] Complex SVG illustration (${ill.details?.pathCount} paths) rendered via JS/WebGL. Recreate as editorial line-art illustration.`);
            } else if (ill.type === 'canvas-illustration') {
              const _sc2 = style.semanticColors || {};
              const _raw2 = _sc2.primary; const _gray2 = _raw2 ? (() => { const r=parseInt(_raw2.slice(1,3),16),g=parseInt(_raw2.slice(3,5),16),b=parseInt(_raw2.slice(5,7),16); return Math.max(r,g,b)-Math.min(r,g,b) <= 25; })() : true;
              const _acc2 = (!_gray2 && _raw2) ? _raw2 : ((data.accentColors||[])[0] || (data.colors||[])[0] || _raw2);
              const _hint2 = canvasFallbackHint('canvas animated visualization', _acc2, data.pageBackground, data.accentColors);
              lines.push(`  [animated illustration] Canvas-based animated visual (${ill.details?.width||'?'}×${ill.details?.height||'?'}px). Likely interactive or scroll-driven.`);
              if (_hint2) {
                lines.push(`    → ${_hint2.figma}`);
                lines.push(`    → ${_hint2.code}`);
              }
            }
          }
        } else if (vpr.hasScrollAnimation || _mp.revealStyle || (data.animations || []).some(a => /blur-fade|reveal/i.test(a.name))) {
          lines.push('  '+entranceAnim);
        }
        if (sec.ctas && sec.ctas.length > 0) {
          const ctaTone = analyzeCopyPattern(sec.ctas[0]);
          lines.push(`  CTAs: [SAMPLE COPY] ${sec.ctas.map(c=>'"'+c+'"').join(' · ')}${ctaTone ? ' ['+ctaTone+']' : ''}`);
        }
        if (sec.arrowLinks) lines.push(`  Arrow links: ${sec.arrowLinks.map(c=>'"'+c+'"').join(', ')}`);
        if (sec.hasSlider) lines.push('  Has slider/carousel: CSS scroll-snap, auto-play with pause on hover.');
        if (sec.hasNumberedItems) {
          lines.push('  Numbered items (01, 02, 03 pattern)');
          if (sec.steps && sec.steps.length > 0) {
            sec.steps.forEach(step => {
              let stepLine = `    - ${step.label || ''}`;
              if (step.heading) stepLine += `: "${step.heading}"`;
              lines.push(stepLine);
            });
          }
        }
        // Case grid details
        if (secType === 'case-grid' && data.caseGridPattern) {
          const cg = data.caseGridPattern;
          lines.push(`  Grid: ${cg.columns||'3'}-column, ${cg.entryCount} entries, gap \`${cg.gap||'24px'}\`.`);
          if (cg.entryStructure) {
            let entryDesc = '  Each entry:';
            if (cg.entryStructure.hasThumbnail) entryDesc += ` thumbnail image (radius \`${cg.entryStructure.thumbnailRadius||'0px'}\`)`;
            if (cg.entryStructure.hasTitle) entryDesc += ' + project title';
            if (cg.entryStructure.hasTags) entryDesc += ` + category tags: ${cg.entryStructure.tagLabels.map(t=>'"'+t+'"').join(', ')}`;
            if (cg.entryStructure.hasHoverVideo) entryDesc += '. Hover: video preview fades in over thumbnail.';
            lines.push(entryDesc);
          }
        }
        if (sec.headingColoredWords && sec.headingColoredWords.length > 0) {
          lines.push(`  Heading accent: ${sec.headingColoredWords.map(w => `"${w.text}" (${w.style})`).join(', ')}`);
        }
        if (sec.scrollRevealTypography) {
          const srt = sec.scrollRevealTypography;
          if (srt.pattern === 'word-split') {
            const animLabel = srt.animName ? ` \`${srt.animName}\`` : ' blur-fade / translate';
            lines.push(`  Typography animation (word-split scroll reveal):`);
            lines.push(`    → [Figma] Show all ${srt.wordCount} words visible, full \`opacity:1\`, no transform. Static final state.`);
            lines.push(`    → [Code] Each word in own \`<span>\`. Initial: \`opacity:0; transform:translateY(20px)\`. On scroll intersection → animate with${animLabel} keyframes. Stagger: \`animation-delay: calc(var(--i) * 0.05s)\`.`);
          } else {
            const animLabel = srt.animName ? ` \`${srt.animName}\`` : '';
            lines.push(`  Typography animation (scroll reveal on \`${srt.element}\`):`);
            lines.push(`    → [Figma] Show heading fully visible, \`opacity:1\`, no transform. Static final state.`);
            lines.push(`    → [Code] Heading hidden until viewport intersection${animLabel ? ` — uses${animLabel} keyframe` : ''}. IntersectionObserver → add \`.visible\` class → CSS transition.`);
          }
        }
        if (sec.decorativeGradients && sec.decorativeGradients.length > 0) {
          sec.decorativeGradients.forEach(d => {
            let dsc = `  Gradient stripe: \`${d.gradient}\``;
            if (d.transform) dsc += `, \`transform: ${d.transform}\``;
            // Detect color-tint overlays (e.g. blue wash rgba(31,88,242,0.2) — alpha ≤ 0.3)
            const _isColorTint = /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\.[0-3]\d*\s*\)/.test(d.gradient);
            if (_isColorTint) {
              dsc += `. Section: \`position:relative\`. First child overlay: \`position:absolute; inset:0; background: ${d.gradient}; pointer-events:none; z-index:0\`. All section content: \`position:relative; z-index:1\`.`;
            }
            lines.push(dsc);
          });
        }
        if (sec.visualDescriptions && sec.visualDescriptions.length > 0) {
          let visuals = sec.visualDescriptions;
          if (i === 0 && data.illustrationStyle && data.illustrationStyle.type !== 'none') {
            visuals = visuals.filter(v => !/\[video-background\]/.test(v));
          }
          if (visuals.length > 0) {
            lines.push('  Visuals:');
            const _scA = style.semanticColors || {};
            const _rawPrimary = _scA.primary;
            const _isGray = _rawPrimary ? (() => { const r=parseInt(_rawPrimary.slice(1,3),16),g=parseInt(_rawPrimary.slice(3,5),16),b=parseInt(_rawPrimary.slice(5,7),16); return Math.max(r,g,b)-Math.min(r,g,b) <= 25; })() : true;
            const _accentHex = (!_isGray && _rawPrimary) ? _rawPrimary : ((data.accentColors||[])[0] || (data.colors||[])[0] || _rawPrimary);
            const _bgHex = data.pageBackground;
            visuals.slice(0, 2).forEach(v => {
              if (/\[canvas-animation\]|\[lottie-animation\]/.test(v)) {
                const _ctxM = v.match(/ — ([^.]+)/);
                const _ctxStr = _ctxM ? _ctxM[1] : '';
                // Pass full visual description string so mouse-interactive signal (after first ".") is detected
                const _ctxFull = /mouse.interactive|cursor.*movement|mousemove.*drives/i.test(v)
                  ? 'mouse-interactive canvas ' + _ctxStr
                  : _ctxStr;
                const _cleaned = v.replace(/\.\s*(Recreate as|Mouse-interactive)[^$]*/i, '').trim();
                lines.push(`    - ${_cleaned}`);
                const _hint = canvasFallbackHint(_ctxFull, _accentHex, _bgHex, data.accentColors);
                if (_hint) {
                  lines.push(`      → ${_hint.figma}`);
                  lines.push(`      → ${_hint.code}`);
                  // Check if sibling SVG in same section has text labels — use them for richer fallback
                  const _siblingLabels = visuals.filter(sv => /\[svg\]/.test(sv) && /text label/i.test(sv));
                  if (_siblingLabels.length > 0) {
                    const _labelMatch = _siblingLabels[0].match(/including\s+"([^"]+(?:"[^"]*"[^"]*)*)"/i) || _siblingLabels[0].match(/including\s+(.+?)(?:\.|$)/i);
                    if (_labelMatch) lines.push(`      Include text labels from sibling SVG: ${_labelMatch[1]}. Render as positioned \`<text>\` elements in the fallback SVG.`);
                  }
                  lines.push(`      CANVAS FALLBACK: If canvas animation is not feasible, render as static SVG or CSS gradient. Do not leave this area empty.`);
                }
              } else if (/\[video-background\]/.test(v)) {
                const _sizeMatch = v.match(/(\d+)×(\d+)/);
                const _w = _sizeMatch ? _sizeMatch[1] : '100%';
                const _h = _sizeMatch ? _sizeMatch[2] : 'auto';
                lines.push(`    - ${v}`);
                lines.push(`      \`<video autoplay muted loop playsInline style="object-fit:cover; width:${_w}px; height:${_h}px; border-radius:8px" />\``);
                const _ctxM2 = v.match(/ — ([^.]+)/);
                const _ctxStr2 = _ctxM2 ? _ctxM2[1] : '';
                const _hint2 = canvasFallbackHint(_ctxStr2, _accentHex, _bgHex, data.accentColors);
                if (_hint2) {
                  lines.push(`      → ${_hint2.figma}`);
                  lines.push(`      → ${_hint2.code}`);
                }
                lines.push(`      FALLBACK if video unavailable: ${_w}×${_h}px div, \`background: ${_bgHex || '#000000'}\`, \`border: 1px solid rgba(255,255,255,0.08)\`, \`border-radius: 8px\`. Do NOT leave empty.`);
              } else if (/\[styled-visual\]/.test(v) && i === 0) {
                // Hero styled-visual — neutral gradient, no colored tint
                lines.push(`    - ${v}`);
                lines.push(`      Hero gradient panel: \`background: ${_bgHex || '#000000'}\`. Bottom fade: \`position:absolute; bottom:0; left:0; right:0; height:40%; background: linear-gradient(to bottom, transparent, ${_bgHex || '#000000'})\`.`);
                lines.push(`      DO NOT add blue, orange, or red tints. Neutral black only.`);
              } else if (/\[styled-visual\]/.test(v) && v.includes(' — ')) {
                const _ctxM2 = v.match(/ — ([^.]+)/);
                const _ctxStr2 = _ctxM2 ? _ctxM2[1] : '';
                const _hint2 = canvasFallbackHint(_ctxStr2, _accentHex, _bgHex, data.accentColors);
                lines.push(`    - ${v}`);
                if (_hint2) {
                  lines.push(`      → ${_hint2.figma}`);
                  lines.push(`      → ${_hint2.code}`);
                  lines.push(`      FALLBACK: If animation is not feasible, render the static fallback above. Do not leave this area empty.`);
                }
              } else if (/\[person-photo\]/.test(v)) {
                const _nameMatch = v.match(/"([^"]+)"/);
                const _sizeMatch = v.match(/(\d+)×(\d+)/);
                const _name = _nameMatch ? _nameMatch[1] : 'Person';
                const _w = _sizeMatch ? _sizeMatch[1] : '400';
                const _h = _sizeMatch ? _sizeMatch[2] : '400';
                const _rnd = Math.floor(Math.random() * 100);
                lines.push(`    - ${v}`);
                lines.push(`      Use placeholder if real asset unavailable: \`<img src="https://picsum.photos/${_w}/${_h}?grayscale&random=${_rnd}" alt="${_name}" />\``);
                lines.push(`      Style: \`object-fit: cover; border-radius: 0\`. DO NOT omit — an empty column breaks the layout.`);
              } else {
                lines.push(`    - ${v}`);
              }
            });
          }
        }
        lines.push('');
      });
      if (scm.length <= 3) {
        lines.push('VISUAL GUIDELINES:');
        lines.push('- Recreate each visual based on its described type, size, placement, and framing.');
        lines.push('- Use site palette for charts/diagrams; keep perspective and placement consistent.');
        lines.push('');
      }

      // ── IntersectionObserver mandatory implementation block ──
      if (vpr.hasScrollAnimation || sap.hasStaggerReveal || sap.hasMaskReveal) {
        lines.push('⚠️ **SCROLL REVEAL — MANDATORY IMPLEMENTATION:**');
        lines.push('Every section below the hero starts at: `opacity:0; transform:translateY(20px); transition: opacity 0.4s ease-out, transform 0.4s ease-out`.');
        lines.push('');
        lines.push('Implement with IntersectionObserver in useEffect:');
        lines.push('```');
        lines.push('useEffect(() => {');
        lines.push('  const observer = new IntersectionObserver(');
        lines.push('    (entries) => entries.forEach(entry => {');
        lines.push('      if (entry.isIntersecting) {');
        lines.push('        entry.target.style.opacity = "1";');
        lines.push('        entry.target.style.transform = "translateY(0)";');
        lines.push('        observer.unobserve(entry.target);');
        lines.push('      }');
        lines.push('    }),');
        lines.push('    { threshold: 0.15 }');
        lines.push('  );');
        lines.push('  document.querySelectorAll(".reveal-section").forEach(el => observer.observe(el));');
        lines.push('  return () => observer.disconnect();');
        lines.push('}, []);');
        lines.push('```');
        lines.push('');
        lines.push('**FAILSAFE RULE:** If IntersectionObserver cannot be initialized for any reason, set ALL `.reveal-section` elements to `opacity:1; transform:none` by default. NEVER leave content permanently invisible. A broken reveal is worse than no reveal.');
        lines.push('');
      }
    }

    // ── Contact section + footer content ──
    if (data.contactSection) {
      const cs = data.contactSection;
      let contactLine = `**Contact section**`;
      if (cs.heading) contactLine += `: "${cs.heading}"`;
      if (cs.eyebrow) contactLine += ` — eyebrow: "${cs.eyebrow}"`;
      if (cs.bgColor) contactLine += `. Background: \`${cs.bgColor}\``;
      if (cs.hasBgAnimation) contactLine += '. Has background animation.';
      lines.push(contactLine);
      if (cs.ctas?.length > 0) lines.push(`  CTAs: ${cs.ctas.map(c => `"${c}"`).join(', ')}`);
      lines.push('');
    }
    if (data.footerContentMap) {
      const fc = data.footerContentMap;
      let footerLine = '**Footer content**';
      if (fc.bgColor) footerLine += `: bg \`${fc.bgColor}\``;
      if (fc.borderTop) footerLine += `, border-top \`${fc.borderTop}\``;
      lines.push(footerLine);
      if (fc.links?.length > 0) lines.push(`  Links: ${fc.links.map(l => `"${l.text}"`).join(', ')}`);
      if (fc.columns?.length > 0) {
        const colLabels = fc.columns.filter(c => c.label).map(c => `"${c.label}"`).join(', ');
        if (colLabels) lines.push(`  Columns: ${colLabels}`);
      }
      lines.push('');
    }
  }

  // ── Design Specifications — prescriptive CSS values ──
  if(focus==='all') {
    const specs = generateDesignSpecs(data, style);
    if (specs) { lines.push(specs); lines.push(''); }
  }

  lines.push(getPlatformInstruction(platform, site, data));
  const _cleaned = cleanPromptLines(lines);
  const _trimmed = trimPagePromptByPriority(_cleaned, getMaxPromptLines(focus));
  const _truncated = _trimmed.length < _cleaned.length;
  return _trimmed.join('\n') + (_truncated ? '\n\n<!-- Prompt trimmed with priority budget -->' : '');
}

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN SPECS DATA — structured object for narrative distribution
// ═══════════════════════════════════════════════════════════════════════════
function getDesignSpecsData(data, style) {
  const bs = data.buttonStyles || {};
  const tp = data.typographyPatterns || {};
  const badge = data.badgeStyles;
  const vpr = data.visualProfile || {};
  const spacing = vpr.spacingSystem || {};
  const ui = (vpr.uiPatterns) || {};
  const iconD = ui.iconDetails || {};

  return {
    typography: {
      h1: tp.h1 || null, h2: tp.h2 || null, h3: tp.h3 || null,
      body: tp.body || null, label: tp.label || null
    },
    spacing: {
      sectionPaddingY: spacing.sectionPaddingY || null,
      sectionPaddingX: spacing.sectionPaddingX || null,
      containerMaxWidth: spacing.containerMaxWidth || null,
      gridGap: spacing.gridGap || null,
      cardGap: spacing.cardGap || null
    },
    icons: ui.hasIconSystem ? {
      size: iconD.size || null, style: ui.iconStyle || 'outlined',
      strokeWidth: iconD.strokeWidth || null, color: iconD.color || null,
      containerStyle: iconD.containerStyle || 'none',
      containerSize: iconD.containerSize || null,
      containerBg: iconD.containerBg || null,
      containerRadius: iconD.containerRadius || null,
      gapToText: iconD.gapToText || null,
      count: ui.iconSystemCount || 0
    } : null,
    badges: badge ? {
      backgroundColor: badge.backgroundColor, color: badge.color,
      borderRadius: badge.borderRadius, padding: badge.padding,
      fontSize: badge.fontSize, fontWeight: badge.fontWeight,
      border: badge.border
    } : null,
    inputs: data.inputStyles || null,
    gradients: data.gradients || [],
    imageStyles: data.imageStyles || null,
    links: data.linkStyles || null,
    footer: data.footerStyles || null,
    fontWeights: data.fontWeights || []
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN SPECIFICATIONS — prescriptive CSS values for vibe coding tools
// ═══════════════════════════════════════════════════════════════════════════
function generateDesignSpecs(data, style) {
  const lines = [];
  const bs = data.buttonStyles || {};
  const tp = data.typographyPatterns || {};
  const badge = data.badgeStyles;
  const vpr = data.visualProfile || {};
  const spacing = vpr.spacingSystem || {};
  const ui = (vpr.uiPatterns) || {};
  const iconD = ui.iconDetails || {};

  let hasContent = false;

  // Button specs are in Component Patterns — no duplication here

  // Typography scale
  if (tp.h1 || tp.h2 || tp.body) {
    lines.push('**Typography Scale:**');
    for (const [key, label] of [['h1','H1'],['h2','H2'],['h3','H3'],['body','Body'],['label','Label']]) {
      const t = tp[key];
      if (!t) continue;
      let spec = `- ${label}: \`${t.fontSize}/${t.lineHeight||'1.2'}/${t.fontWeight||'400'}\``;
      if (t.letterSpacing) spec += `, tracking \`${t.letterSpacing}\``;
      if (t.textTransform) spec += `, \`${t.textTransform}\``;
      if (t.fontFamily) spec += `, font "${t.fontFamily}"`;
      lines.push(spec);
    }
    lines.push('');
    hasContent = true;
  }

  // Spacing
  if (spacing.sectionPaddingY || spacing.containerMaxWidth || spacing.gridGap) {
    lines.push('**Spacing:**');
    if (spacing.sectionPaddingY) lines.push(`- Section padding: \`${spacing.sectionPaddingY} 0\``);
    if (spacing.containerMaxWidth && spacing.containerMaxWidth !== 'none') lines.push(`- Container max-width: \`${spacing.containerMaxWidth}\``);
    if (spacing.gridGap) lines.push(`- Grid gap: \`${spacing.gridGap}\``);
    if (spacing.cardGap) lines.push(`- Card gap: \`${spacing.cardGap}\``);
    if (spacing.sectionPaddingX) lines.push(`- Section horizontal padding: \`${spacing.sectionPaddingX}\``);
    lines.push('');
    hasContent = true;
  }

  // Icons
  if (ui.hasIconSystem && iconD.size) {
    lines.push('**Icons:**');
    let spec = `- Size: \`${iconD.size}\`, style: ${ui.iconStyle||'outlined'}`;
    if (iconD.strokeWidth) spec += `, stroke: \`${iconD.strokeWidth}px\``;
    if (iconD.color) spec += `, color: \`${iconD.color}\``;
    lines.push(spec);
    if (iconD.containerStyle !== 'none' && iconD.containerSize) {
      let containerSpec = `- Container: \`${iconD.containerSize}\` ${iconD.containerStyle}`;
      if (iconD.containerBg) containerSpec += `, bg \`${iconD.containerBg}\``;
      if (iconD.containerRadius) containerSpec += `, radius \`${iconD.containerRadius}\``;
      lines.push(containerSpec);
    }
    if (iconD.gapToText) lines.push(`- Gap to text: \`${iconD.gapToText}\``);
    lines.push('');
    hasContent = true;
  }

  // Badges
  if (badge) {
    lines.push('**Badges/Tags:**');
    let spec = `- bg \`${badge.backgroundColor||'muted'}\`, text \`${badge.color||'inherit'}\``;
    if (badge.borderRadius) spec += `, radius \`${badge.borderRadius}\``;
    if (badge.padding) spec += `, padding \`${badge.padding}\``;
    spec += `, font \`${badge.fontSize||'12px'}/${badge.fontWeight||'500'}\``;
    if (badge.border) spec += `, border \`${badge.border}\``;
    lines.push(spec);
    lines.push('');
    hasContent = true;
  }

  // Inputs
  const inputS = data.inputStyles;
  if (inputS) {
    lines.push('**Inputs:**');
    let spec = '';
    if (inputS.backgroundColor) spec += `bg \`${inputS.backgroundColor}\``;
    if (inputS.border) spec += `, border \`${inputS.border}\``;
    if (inputS.borderRadius) spec += `, radius \`${inputS.borderRadius}\``;
    if (inputS.padding) spec += `, padding \`${inputS.padding}\``;
    spec += `, font \`${inputS.fontSize||'14px'}\``;
    if (inputS.fontFamily) spec += ` "${inputS.fontFamily}"`;
    if (inputS.height) spec += `, height \`${inputS.height}\``;
    lines.push(`- ${spec.replace(/^, /,'')}`);
    lines.push('- Focus: outline 2px solid accent, offset 2px');
    lines.push('');
    hasContent = true;
  }

  // Gradients
  const grads = data.gradients || [];
  if (grads.length > 0) {
    lines.push('**Gradients:**');
    grads.forEach(g => {
      let gradLine = `- \`${g.value}\``;
      if (g.isAnimated) {
        gradLine += ' *(animated)* — `background-size: 200% 200%` + `@keyframes gradient-shift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }`';
        if (g.animationDuration) gradLine += ` \`animation: gradient-shift ${g.animationDuration} ease infinite\``;
      }
      lines.push(gradLine);
    });
    lines.push('');
    hasContent = true;
  }

  // Image treatment
  const imgS = data.imageStyles;
  if (imgS) {
    lines.push('**Image Treatment:**');
    let spec = '';
    if (imgS.borderRadius) spec += `border-radius \`${imgS.borderRadius}\``;
    if (imgS.objectFit) spec += `, object-fit \`${imgS.objectFit}\``;
    if (imgS.border) spec += `, border \`${imgS.border}\``;
    if (imgS.boxShadow) spec += `, shadow \`${imgS.boxShadow}\``;
    if (imgS.filter) spec += `, filter \`${imgS.filter}\``;
    if (imgS.aspectRatio) spec += `, aspect-ratio ~${imgS.aspectRatio}`;
    lines.push(`- ${spec.replace(/^, /,'')}`);
    lines.push('');
    hasContent = true;
  }

  // Links
  const linkS = data.linkStyles;
  if (linkS) {
    lines.push('**Links:**');
    let spec = `color \`${linkS.color}\``;
    spec += `, text-decoration \`${linkS.textDecoration}\``;
    if (linkS.textUnderlineOffset) spec += `, underline-offset \`${linkS.textUnderlineOffset}\``;
    if (linkS.textDecorationColor) spec += `, decoration-color \`${linkS.textDecorationColor}\``;
    lines.push(`- ${spec}`);
    lines.push('');
    hasContent = true;
  }

  // Footer
  const footerS = data.footerStyles;
  if (footerS) {
    lines.push('**Footer:**');
    let spec = '';
    if (footerS.backgroundColor) spec += `bg \`${footerS.backgroundColor}\``;
    if (footerS.color) spec += `, text \`${footerS.color}\``;
    if (footerS.padding) spec += `, padding \`${footerS.padding}\``;
    if (footerS.borderTop) spec += `, border-top \`${footerS.borderTop}\``;
    if (footerS.columns) spec += `, ${footerS.columns}-column layout`;
    if (footerS.gap) spec += `, gap \`${footerS.gap}\``;
    lines.push(`- ${spec.replace(/^, /,'')}`);
    lines.push('');
    hasContent = true;
  }

  // Font weights used
  const fontW = data.fontWeights || [];
  if (fontW.length > 1) {
    lines.push('**Font Weights Used:**');
    lines.push(`- ${fontW.join(', ')}`);
    lines.push('');
    hasContent = true;
  }

  if (!hasContent) return null;
  if (!lines[0]?.startsWith('###')) lines.unshift('### Design Specifications', '');
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN SYSTEM EXPORT
// ═══════════════════════════════════════════════════════════════════════════
function setOutputMode(mode) {
  document.querySelectorAll('.output-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.output === mode));

  if (!state.lastAnalyzedData) return;
  const data = state.lastAnalyzedData;

  try {
    if (mode === 'system') {
      const style = analyzeDesignStyle(data);
      state.lastPrompt = buildDesignSystemPrompt(data, style);
    } else {
      state.lastPrompt = buildPagePrompt(data, null);
    }
  } catch(err) {
    console.warn('Output mode switch failed:', err.message);
  }
  $('promptOutput').textContent = state.lastPrompt;
}

function buildDesignSystemPrompt(data, style) {
  const site = safeHostname(data.url), vars = data.cssVars || {};
  const platform = 'generic';
  const specsData = getDesignSpecsData(data, style);
  const lines = [];

  const { isDark,isLight,hasFullRound,hasGlowEffect,hasLayeredShadows,hasBrutalistShadow,
    vibrantColors,fonts:styleFonts,vp,accents,radii,pageBg,semanticColors } = style;
  const vpr = vp||{}, ui = (vpr.uiPatterns)||{};
  const sc = semanticColors || {};
  const primaryColor = sc.primary || vibrantColors[0] || accents[0];
  const interactiveRadii = radii.filter(r=>!r.includes('50%'));
  const radiusSample = interactiveRadii.find(r=>parseInt(r)>=4&&parseInt(r)<=24) || interactiveRadii[0];

  lines.push('# Design System');
  lines.push(`Extracted from: ${site}`);
  lines.push('');
  lines.push('This design system defines the visual DNA of the product. Use it to build ANY page — pricing, docs, about, settings, onboarding — in the same visual language. Sub-pages will contain components not present on the main page (tables, tabs, modals, steppers, etc.). Derive them from the rules below.');
  lines.push('');
  lines.push(getPlatformHeader());
  lines.push('');

  lines.push('## Design DNA');
  lines.push('When you encounter a component that doesn\'t exist in this system, derive it from these core principles:');
  lines.push('');

  const bgRef = pageBg ? '`'+pageBg+'`' : (isDark ? 'dark neutral' : 'light neutral');
  lines.push('**Surface:** Page ground is '+bgRef+'. '+(isDark
    ? 'All surfaces are dark. Elevated elements are 8–12% lighter than their parent. Use `rgba(255,255,255,0.06)` borders for definition. Never introduce white backgrounds.'
    : 'Primary surface is white or '+bgRef+'. Elevated elements (cards, modals, dropdowns) use white with subtle border `rgba(0,0,0,0.08)`. Keep the light, open feel.'));
  lines.push('**Shape:** Interactive radius = `'+(hasFullRound?'9999px':'`'+(radiusSample||'8px')+'`')+'`. Container radius = `'+(radiusSample||'8px')+'`. New components inherit these radii.');
  if (hasBrutalistShadow) lines.push('**Elevation:** Brutalist — hard `4px 4px 0` shadows, zero blur.');
  else if (hasGlowEffect) lines.push('**Elevation:** Glow-based — zero-offset diffused shadows.');
  else if (hasLayeredShadows) lines.push('**Elevation:** Layered shadows. Never simplify to single layer.');
  else lines.push('**Elevation:** '+(isDark?'Border-defined (`rgba(255,255,255,0.06–0.12)`).':'Soft shadow (`0 4px 24px rgba(0,0,0,0.06–0.10)`).'));
  if (primaryColor) lines.push('**Color derivation:** Primary action = `'+primaryColor+'`. Destructive: `#ef4444`. Success: `#22c55e`. Warning: `#f59e0b`.');
  const SYSTEM_FONTS = new Set(['ui-sans-serif','ui-serif','ui-monospace','system-ui','-apple-system','blinkmacsystemfont','helvetica neue','arial','sans-serif','serif','monospace']);
  const fonts = [...new Set((data.fonts || []).filter(f => f && !SYSTEM_FONTS.has(f.toLowerCase())).map(f => f.trim()))];
  if (fonts.length >= 2) lines.push('**Type:** Headings "'+fonts[0]+'" (600–800), body "'+fonts[1]+'" (400–500). Never add a third typeface.');
  else if (fonts[0]) lines.push('**Type:** "'+fonts[0]+'". Hierarchy through weight only.');
  lines.push('**Interaction:** Hover '+(isDark?'`brightness(1.08)`':'`brightness(0.95)`')+' 150–200ms ease-out. Focus `outline 2px solid '+(primaryColor||'currentColor')+' offset 2px`. Active `scale(0.98)`.');
  const spacing = vpr.spacingSystem || {};
  if (spacing.sectionPaddingY || spacing.gridGap) lines.push('**Spacing:** Section `'+(spacing.sectionPaddingY||'80px')+' 0`. Grid gap `'+(spacing.gridGap||'24px')+'`. Container `'+(spacing.containerMaxWidth||'1200px')+'`.');
  lines.push('');

  lines.push('## Color Tokens');
  const namedVars = Object.entries(vars).filter(([k,v]) => /^#[0-9a-f]{3,8}$/i.test(v.trim()) && !k.startsWith('--tw-') && !k.startsWith('--swiper-') && !k.startsWith('--framer-') && !k.startsWith('--wf-'));
  if (namedVars.length > 0) namedVars.slice(0, 14).forEach(([k, v]) => lines.push('- `' + k + '`: `' + v + '`'));
  if (sc.primary) lines.push('- primary-action: `' + sc.primary + '`');
  if (style.pageBg) lines.push('- background: `' + style.pageBg + '`');
  lines.push('- destructive: `#ef4444`'); lines.push('- success: `#22c55e`'); lines.push('- warning: `#f59e0b`');
  lines.push('- muted-text: '+(isDark?'`rgba(255,255,255,0.5)`':'`rgba(0,0,0,0.4)`'));
  lines.push('- border: '+(isDark?'`rgba(255,255,255,0.08)`':'`rgba(0,0,0,0.08)`'));
  lines.push('');

  if (fonts.length > 0) {
    lines.push('## Typography Tokens');
    if (fonts.length >= 2) { lines.push('- Display: "' + fonts[0] + '"'); lines.push('- Body: "' + fonts[1] + '"'); }
    else lines.push('- Font: "' + fonts[0] + '"');
    const tp = data.typographyPatterns;
    if (tp?.h1) lines.push('- H1: `' + tp.h1.fontSize + '/' + tp.h1.fontWeight + '`');
    if (tp?.h2) lines.push('- H2: `' + tp.h2.fontSize + '/' + tp.h2.fontWeight + '`');
    if (tp?.body) lines.push('- Body: `' + tp.body.fontSize + '/' + tp.body.fontWeight + '`');
    if (specsData.fontWeights.length > 1) lines.push('- Weights: ' + specsData.fontWeights.join(', '));
    lines.push('');
  }

  const shadows = (data.shadows || []).filter(s => s && s !== 'none');
  if (shadows.length > 0) { lines.push('## Shadow Tokens'); shadows.slice(0,4).forEach((s,i) => lines.push('- shadow-'+['sm','md','lg','xl'][i]+': `'+s+'`')); lines.push(''); }

  const allRadii = (data.borderRadii || []).filter(r => r && r !== '0px');
  if (allRadii.length > 0) { lines.push('## Shape Tokens'); [...new Set(allRadii)].sort((a,b)=>parseInt(a)-parseInt(b)).slice(0,6).forEach(r => lines.push('- `'+r+'`')); lines.push(''); }

  if (spacing.sectionPaddingY || spacing.containerMaxWidth || spacing.gridGap) {
    lines.push('## Spacing Tokens');
    if (spacing.sectionPaddingY) lines.push('- Section: `'+spacing.sectionPaddingY+' 0`');
    if (spacing.containerMaxWidth && spacing.containerMaxWidth !== 'none') lines.push('- Container: `'+spacing.containerMaxWidth+'`');
    if (spacing.gridGap) lines.push('- Grid gap: `'+spacing.gridGap+'`');
    lines.push('');
  }

  lines.push('## Component Patterns');
  generateComponentGuidance(data, style, specsData).forEach(c => lines.push(c));
  lines.push('');

  lines.push('## Deriving New Components');
  lines.push('**Tables:** Header '+(isDark?'`rgba(255,255,255,0.04)`':'`#f9fafb`')+' bg, `14px/500` headers, `14px/400` cells. Row hover: '+(isDark?'`rgba(255,255,255,0.03)`':'`rgba(0,0,0,0.02)`')+'.');
  lines.push('**Tabs:** '+(hasFullRound?'Pill — active `'+(primaryColor||'accent')+'` bg, white text, `9999px`.':'Underline — active `2px solid '+(primaryColor||'accent')+'` bottom.')+' `14px/500`.');
  lines.push('**Modals:** '+(isDark?'Dark surface, `rgba(255,255,255,0.08)` border':'White bg, `rgba(0,0,0,0.08)` border')+'. Card radius. Overlay `rgba(0,0,0,'+(isDark?'0.6':'0.4')+')`.');
  lines.push('**Toggles:** Track `44×24px`. Active `'+(primaryColor||'accent')+'`. Inactive '+(isDark?'`rgba(255,255,255,0.12)`':'`#d1d5db`')+'.');
  lines.push('**Toast:** Card surface + left border `3px solid` (primary/success/error).');
  lines.push('**Progress:** Track `4–8px` height, `9999px` radius. Fill `'+(primaryColor||'accent')+'`.');
  lines.push('**Tooltips:** `'+(isDark?'rgba(255,255,255,0.12) bg':'#1a1a1a bg')+'`, `6px` radius, `8px 12px` padding.');
  lines.push('**Form elements:** Inherit input styles. Checked state `'+(primaryColor||'accent')+'`.');
  lines.push('');

  lines.push('## Shared Across All Pages');
  lines.push('Navigation and footer identical on every page.');
  if (specsData.footer) {
    const ft = specsData.footer; const parts = [];
    if (ft.backgroundColor) parts.push('bg `'+ft.backgroundColor+'`');
    if (ft.color) parts.push('text `'+ft.color+'`');
    if (ft.padding) parts.push('padding `'+ft.padding+'`');
    lines.push('Footer: '+parts.join(', ')+'.');
  }
  lines.push('');

  const googleFonts = fonts.filter(f => !['system-ui','sans-serif','serif','monospace'].includes(f.toLowerCase()));
  if (googleFonts.length > 0) {
    const fontQuery = googleFonts.map(f => f.replace(/\s+/g, '+') + ':wght@400;500;600;700;800').join('&family=');
    lines.push(`@import url('https://fonts.googleapis.com/css2?family=${fontQuery}&display=swap');`);
  }

  return lines.join('\n');
}

function buildElementPrompt(data) {
  const site=safeHostname(data.url),s=data.styles||{},platform='generic',lines=[],elType=guessElementType(data);
  const isContainer = data.isContainer;

  lines.push('Use the exact CSS values below. Prefer extracted values over framework defaults for padding, shadow, border-radius, and colors.');
  lines.push('');

  // Component group context: if element has semantic parent data
  if (data.parentContext) {
    const pc = data.parentContext;
    lines.push(`Inspired by: ${site} — **${pc.sectionType || 'Section'}** containing ${elType}`);
    lines.push(`Section layout: ${pc.layout || 'stacked'}, background: \`${pc.bgColor || 'transparent'}\``);
    if (pc.childComponents && pc.childComponents.length > 0) {
      lines.push(`Components in this section: ${pc.childComponents.join(', ')}`);
    }
  } else {
    lines.push(`Inspired by: ${site} — ${elType}`);
  }
  lines.push('');
  lines.push(getPlatformHeader());
  lines.push('');

  // ── Design Direction (narratif) ──
  lines.push('### Design Direction');
  const dirParts = [];

  // Surface character
  const isDarkEl = s.backgroundColor && hexLum(s.backgroundColor) < 0.2;
  const isLightEl = s.backgroundColor && hexLum(s.backgroundColor) > 0.8;
  if (isDarkEl) dirParts.push('Dark surface');
  else if (isLightEl) dirParts.push('Light surface');

  // Effects
  if (s.backdropFilter) dirParts.push('glassmorphism (frosted blur)');
  if (s.boxShadow && /0px 0px/.test(s.boxShadow)) dirParts.push('glow elevation');
  else if (s.boxShadow) dirParts.push('shadow elevation');
  if (s.borderRadius?.includes('9999') || s.borderRadius?.includes('50%')) dirParts.push('pill-shaped');

  // Visual content narrative
  const vc = data.visualContent || [];
  const hasLottie = vc.some(v => v.isLottie);
  const hasAnimSvg = vc.some(v => v.type === 'svg' && v.animated);
  const hasCanvas = vc.some(v => v.type === 'canvas');
  const hasVideo = vc.some(v => v.type === 'video');
  const svgSubject = vc.find(v => v.subject)?.subject;

  if (hasLottie) dirParts.push(`Lottie animation${svgSubject ? ` (${svgSubject})` : ''}`);
  else if (hasAnimSvg) dirParts.push(`animated SVG${svgSubject ? ` (${svgSubject})` : ''}`);
  else if (hasCanvas) dirParts.push('canvas animation');
  else if (hasVideo) dirParts.push('video content');
  else if (svgSubject) dirParts.push(svgSubject);

  if (data.hasGridPattern) dirParts.push('dot grid pattern');
  if (data.animatedDescendants > 3) dirParts.push(`${data.animatedDescendants} animated elements`);

  // Build narrative sentence
  let dirText = dirParts.length > 0 ? dirParts.join(' · ') + '.' : `${elType}. Replicate visual weight and proportions exactly.`;

  // Add contextual sentence for containers
  if (isContainer && data.textHierarchy?.length > 0 && vc.length > 0) {
    const heading = data.textHierarchy.find(t => t.role === 'heading');
    const visual = vc[0];
    if (heading && visual) {
      dirText += ` This is a ${isDarkEl ? 'dark' : 'light'} card combining a ${visual.type === 'lottie-svg' ? 'Lottie vector animation' : visual.type} with a text block ("${heading.text.slice(0, 30)}").`;
    }
  }

  // Add button context
  if (data.innerButtons?.length > 0) {
    dirText += ` Contains interactive CTA: "${data.innerButtons[0].text}".`;
  }

  lines.push(dirText);
  lines.push('');

  // ── Container Surface ──
  lines.push('### Surface');
  if(s.backgroundColor) lines.push(`- Background: \`${s.backgroundColor}\``);
  if(s.backgroundImage&&s.backgroundImage!=='none') lines.push(`- Background image: \`${s.backgroundImage}\``);
  if(s.borderRadius) lines.push(`- Border radius: \`${s.borderRadius}\``);
  if(data.borderInfo) lines.push(`- Border: \`${data.borderInfo}\``);
  else if(s.border&&s.border!=='none'&&!/0px/.test(s.border)) lines.push(`- Border: \`${s.border}\``);
  if(s.boxShadow) lines.push(`- Box shadow: \`${s.boxShadow}\``);
  if(s.padding) lines.push(`- Padding: \`${s.padding}\``);
  if(s.backdropFilter) lines.push(`- Backdrop filter: \`${s.backdropFilter}\``);
  if(s.opacity&&s.opacity!=='1') lines.push(`- Opacity: \`${s.opacity}\``);
  lines.push('');

  // ── Layout (for containers) ──
  if(isContainer && (s.display||s.gap||s.alignItems||s.justifyContent||s.flexDirection)) {
    lines.push('### Layout');
    if(s.display) lines.push(`- Display: \`${s.display}\``);
    if(s.flexDirection) lines.push(`- Flex direction: \`${s.flexDirection}\``);
    if(s.gap) lines.push(`- Gap: \`${s.gap}\``);
    if(s.alignItems) lines.push(`- Align items: \`${s.alignItems}\``);
    if(s.justifyContent) lines.push(`- Justify content: \`${s.justifyContent}\``);
    lines.push('');
  }

  // ── Text Hierarchy (heading, body, labels) ──
  if(data.textHierarchy && data.textHierarchy.length > 0) {
    lines.push('### Typography');
    data.textHierarchy.forEach(t => {
      if(t.role === 'heading') {
        lines.push(`**Heading:** "${t.text}"`);
        if(t.fontSize) lines.push(`- Font size: \`${t.fontSize}\``);
        if(t.fontWeight) lines.push(`- Font weight: \`${t.fontWeight}\``);
        if(t.lineHeight) lines.push(`- Line height: \`${t.lineHeight}\``);
        if(t.color) lines.push(`- Color: \`${t.color}\``);
        if(t.fontFamily) lines.push(`- Font: "${t.fontFamily}"`);
      } else if(t.role === 'body') {
        lines.push(`**Body text:** "${t.text.slice(0,60)}"`);
        if(t.fontSize) lines.push(`- Font size: \`${t.fontSize}\``);
        if(t.fontWeight) lines.push(`- Font weight: \`${t.fontWeight}\``);
        if(t.color) lines.push(`- Color: \`${t.color}\``);
      }
    });
    lines.push('');
  } else if(!isContainer) {
    // Simple element — show its own text styles
    if(s.fontFamily) lines.push(`- Font: "${s.fontFamily}"`);
    if(s.fontSize) lines.push(`- Font size: \`${s.fontSize}\``);
    if(s.fontWeight&&parseInt(s.fontWeight)>=500) lines.push(`- Font weight: \`${s.fontWeight}\``);
    if(s.color) lines.push(`- Text color: \`${s.color}\``);
    if(s.lineHeight) lines.push(`- Line height: \`${s.lineHeight}\``);
    if(s.letterSpacing) lines.push(`- Letter spacing: \`${s.letterSpacing}\``);
    lines.push('');
  }

  // ── Labels (location tags, badges, etc.) ──
  if(data.labels && data.labels.length > 0) {
    lines.push(`**Labels:** ${data.labels.map(l=>`"${l}"`).join(', ')}`);
    lines.push('');
  }

  // ── Visual Content (SVG, canvas, images) ──
  if(data.visualContent && data.visualContent.length > 0) {
    lines.push('### Visual Content');
    data.visualContent.forEach(v => {
      if(v.type === 'svg' || v.type === 'lottie-svg') {
        let desc = `- ${v.type === 'lottie-svg' ? 'Lottie animation' : 'SVG illustration'}: ${v.size}`;
        if(v.subject) desc += ` — **${v.subject}**`;
        desc += `, ${v.complexity} (${v.pathCount} paths)`;
        if(v.animated) desc += ', **animated**';
        if(v.hasText) desc += ', has text labels';
        lines.push(desc);
        if(v.strokeStyle) lines.push(`  Stroke style: ${v.strokeStyle}`);
        if(v.fillColors?.length) lines.push(`  Fill colors: ${v.fillColors.map(c=>`\`${c}\``).join(', ')}`);
        if(v.strokeColors?.length) lines.push(`  Stroke colors: ${v.strokeColors.map(c=>`\`${c}\``).join(', ')}`);
        if(v.gradientColors?.length) lines.push(`  Gradient colors: ${v.gradientColors.map(c=>`\`${c}\``).join(', ')}`);
        if(v.clipPaths) lines.push(`  Uses ${v.clipPaths} clip-paths for masking/cropping effect`);
        if(v.cropping) {
          const crops = [];
          if(v.cropping.bottom) crops.push(`bottom ${v.cropping.bottom}px cropped`);
          if(v.cropping.top) crops.push(`top ${v.cropping.top}px cropped`);
          lines.push(`  Partially hidden: ${crops.join(', ')} (overflow:hidden parent) — creates fade/disappear effect`);
        }
        if(v.isLottie) {
          lines.push('  This is a Lottie vector animation. Recreate as animated SVG with CSS keyframes, or use a static stylized version capturing the key visual.');
        } else if(v.animated) {
          lines.push('  Recreate as animated SVG with CSS keyframe animations.');
        }
      } else if(v.type === 'canvas') {
        lines.push(`- Canvas element: ${v.size} — dynamic/animated content`);
        lines.push('  Recreate as CSS/SVG animation or static illustration capturing the visual essence.');
      } else if(v.type === 'video') {
        let desc = `- Video: ${v.size}`;
        if(v.autoplay && v.loop && v.muted) desc += ' — ambient background video (autoplay, loop, muted)';
        else if(v.autoplay) desc += ' — autoplay video';
        lines.push(desc);
        if(v.poster) lines.push(`  Poster: ${v.poster}`);
        lines.push('  Recreate as a CSS animation, gradient animation, or placeholder video area.');
      } else if(v.type === 'image') {
        lines.push(`- Image: ${v.size}${v.alt ? ` — "${v.alt}"` : ''}${v.src ? ` (${v.src})` : ''}`);
      }
    });
    lines.push('');
  }

  // ── Interaction & States ──
  lines.push('### Interaction & States');
  if(s.transition) {
    lines.push(`- Transition: \`${s.transition}\``);
    const isDarkBg = hexLum(s.backgroundColor||'#888') < 0.3;
    if (elType === 'Button') {
      lines.push(`- Hover: ${isDarkBg ? 'brightness(1.1)' : 'brightness(0.92)'}, transition 150ms ease-out`);
      lines.push(`- Active: scale(0.98), transition 50ms`);
      lines.push(`- Focus: outline 2px solid ${s.backgroundColor||'currentColor'} offset 2px`);
    } else if (elType === 'Card' || isContainer) {
      lines.push(`- Hover: translateY(-2px), shadow expand 20%, transition 200ms ease-out`);
    } else if (elType === 'Input') {
      lines.push(`- Focus: border-color ${s.borderColor||s.color||'accent'}, outline 2px solid ${s.borderColor||'currentColor'} offset 2px`);
    } else {
      lines.push(`- Hover: ${isDarkBg?'lighten 8%':'darken 5%'}`);
    }
  } else {
    if (elType === 'Button') {
      lines.push(`- Hover: brightness(${hexLum(s.backgroundColor||'#888')<0.3?'1.1':'0.92'}), transition 150ms ease-out`);
      lines.push(`- Active: scale(0.98)`);
    }
    lines.push('- Add smooth transitions: 150ms ease-out for interactive elements');
  }
  lines.push('');

  // ── Animation details ──
  if(data.hasGridPattern) {
    lines.push('**Pattern:** Contains a grid/dot pattern — recreate as a CSS grid of small dots with animated highlights.');
    lines.push('');
  }
  if(data.animatedDescendants) {
    lines.push(`**Animations:** ${data.animatedDescendants} animated elements`);
    if(data.animationNames?.length) lines.push(`  Animation names: ${data.animationNames.map(n=>`\`${n}\``).join(', ')}`);
    lines.push('');
  }

  // ── Inner buttons/CTAs ──
  if(data.innerButtons?.length > 0) {
    lines.push('### Inner Buttons');
    data.innerButtons.forEach(btn => {
      let desc = `- "${btn.text}"`;
      if(btn.bg) desc += ` bg:\`${btn.bg}\``;
      if(btn.color) desc += ` color:\`${btn.color}\``;
      if(btn.borderRadius) desc += ` radius:\`${btn.borderRadius}\``;
      lines.push(desc);
    });
    lines.push('');
  }

  if(data.rect) lines.push(`**Reference size:** ${data.rect.width}×${data.rect.height}px\n`);

  // ── Children structure ──
  if(data.children?.length>0) {
    lines.push('**Structure:**');
    data.children.forEach(c => {
      let desc = `- \`<${c.tag}>\``;
      if(c.width && c.height) desc += ` ${c.width}×${c.height}`;
      if(c.bg) desc += ` bg:${c.bg}`;
      if(c.text) desc += ` — "${c.text.slice(0,30)}"`;
      lines.push(desc);
    });
    lines.push('');
  }

  if(data.hasPseudoBefore||data.hasPseudoAfter) lines.push('**Note:** Uses ::before/::after for decorative details — implement with pseudo-elements.\n');

  lines.push(getPlatformInstruction(null, site, data));

  const _finalLines = lines.join('\n').split('\n');
  const _elMaxLines = 200;
  if (_finalLines.length > _elMaxLines) {
    return _finalLines.slice(0, _elMaxLines).join('\n') +
      '\n\n<!-- Prompt truncated: exceeded 160-line budget -->';
  }
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// IMAGE FLOW
// ═══════════════════════════════════════════════════════════════════════════
async function handleImagePicked(imageData) {
  showLoading('Capturing screenshot…');
  try {
    const scr=await chrome.tabs.captureVisibleTab(null,{format:'png'});
    showLoading('Extracting color palette…');
    const analyzed=await analyzeImageFromScreenshot(scr,imageData.rect);
    state.capturedImageData={...imageData,...analyzed};
    showImagePreview(state.capturedImageData); updateAnalyzeBtn();
  } catch(err){showError('Could not capture image: '+err.message);}
}
function analyzeImageFromScreenshot(scr,rect){return new Promise((res,rej)=>{const img=new Image();img.onload=()=>{try{const dpr=window.devicePixelRatio||1,c=document.createElement('canvas');c.width=Math.min(Math.round(rect.width*dpr),300);c.height=Math.min(Math.round(rect.height*dpr),300);c.getContext('2d').drawImage(img,Math.round(rect.left*dpr),Math.round(rect.top*dpr),Math.round(rect.width*dpr),Math.round(rect.height*dpr),0,0,c.width,c.height);const id=c.getContext('2d').getImageData(0,0,c.width,c.height),cols=extractDominantColors(id,8),pal=cols.map(rgbArrayToHex);res({palette:pal,mood:inferMood(cols),contrast:analyzeContrast(cols),style:inferStyle(cols),croppedDataUrl:c.toDataURL('image/jpeg',0.85)});}catch(e){rej(e);}};img.onerror=()=>rej(new Error('Failed to load screenshot'));img.src=scr;});}
function extractDominantColors(id,count){const d=id.data,p=[];for(let i=0;i<d.length;i+=12){if(d[i+3]<128)continue;p.push([d[i],d[i+1],d[i+2]]);}return p.length?medianCut(p,Math.round(Math.log2(count))):[];}
function medianCut(p,depth){if(depth===0||!p.length){const a=avgColor(p);return a?[a]:[]}let rN=255,rX=0,gN=255,gX=0,bN=255,bX=0;for(const[r,g,b]of p){rN=Math.min(rN,r);rX=Math.max(rX,r);gN=Math.min(gN,g);gX=Math.max(gX,g);bN=Math.min(bN,b);bX=Math.max(bX,b);}const ch=[rX-rN,gX-gN,bX-bN].indexOf(Math.max(rX-rN,gX-gN,bX-bN));p.sort((a,b)=>a[ch]-b[ch]);const m=Math.floor(p.length/2);return[...medianCut(p.slice(0,m),depth-1),...medianCut(p.slice(m),depth-1)];}
function avgColor(p){if(!p.length)return null;const s=p.reduce((a,c)=>[a[0]+c[0],a[1]+c[1],a[2]+c[2]],[0,0,0]);return s.map(v=>Math.round(v/p.length));}
function rgbArrayToHex([r,g,b]){return'#'+[r,g,b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');}
function inferMood(c){if(!c.length)return'neutral';const a=avgColor(c);if(!a)return'neutral';const[r,g,b]=a,l=(0.299*r+0.587*g+0.114*b)/255,s=Math.max(r,g,b)-Math.min(r,g,b);if(l<0.15)return'dark & dramatic';if(l>0.85)return'light & airy';if(s<20)return'monochromatic';if(r>g+40&&r>b+40)return'warm';if(b>r+40&&b>g+20)return'cool';if(s>120)return'vibrant & bold';return'balanced';}
function analyzeContrast(c){if(c.length<2)return'unknown';const l=c.map(([r,g,b])=>(0.299*r+0.587*g+0.114*b)/255),ratio=Math.max(...l)/(Math.min(...l)+0.05);return ratio>7?'high contrast':ratio>3?'medium contrast':'subtle';}
function inferStyle(c){const l=c.map(([r,g,b])=>(0.299*r+0.587*g+0.114*b)/255),al=l.reduce((a,b)=>a+b,0)/l.length,s=c.map(([r,g,b])=>Math.max(r,g,b)-Math.min(r,g,b)),as=s.reduce((a,b)=>a+b,0)/s.length;if(al<0.2&&as>60)return'Dark SaaS';if(al<0.2)return'Minimal dark';if(al>0.8&&as<30)return'Clean minimal';if(al>0.8&&as>60)return'Colorful';if(as>100)return'Bold & expressive';return'Modern/balanced';}

async function buildImagePrompt(data) {
  showLoading('Generating prompt…');
  try {
    const lines=[],site=safeHostname(data.url),platform='generic',imgFocus=state.imgFocus,palette=data.palette||[];
    lines.push(`Inspired by: visual from ${data.pageTitle||site}`);lines.push(`Source: ${site}`);
    lines.push('');lines.push(getPlatformHeader());lines.push('');
    const darkCount=palette.filter(h=>hexLum(h)<0.15).length,isDark=darkCount>palette.length*0.35;
    const accent=palette.find(h=>hexSat(h)>45&&hexLum(h)>0.2&&hexLum(h)<0.8);
    lines.push('### Design Direction');
    lines.push(`${data.mood||'Balanced'} · ${data.contrast||'medium contrast'} · ${data.style||'modern'}.`);
    if(isDark) lines.push('Dark-dominant — dark backgrounds, light text, opacity-based depth.');
    if(accent) lines.push(`Primary accent: \`${accent}\` — interactive elements and highlights only.`);
    lines.push('');
    if(imgFocus==='full'||imgFocus==='palette'){
      lines.push('### Color Palette');
      palette.slice(0,8).forEach((hex,i)=>{const l=hexLum(hex),s=hexSat(hex);let role=i===0?'dominant':i===1?'secondary':'';if(!role){if(l>0.85)role='background';else if(l<0.15)role='foreground';else if(s>45)role='accent';else role=`color-${i+1}`;}lines.push(`- ${role}: \`${hex}\``);});
      lines.push('');
    }
    if(imgFocus==='full'||imgFocus==='ui'){
      lines.push('### UI Implementation');
      const bg=isDark?palette.find(h=>hexLum(h)<0.15):palette.find(h=>hexLum(h)>0.85);
      if(bg) lines.push(`- Background: \`${bg}\``);
      lines.push(`- Text: ${isDark?'light (#f5f5f5) headings, #999 body':'dark (#111) headings, #555 body'}`);
      if(accent) lines.push(`- CTAs: \`${accent}\` background, white text`);
      lines.push(isDark?'- Elevation: colored glow or layered dark shadow':'- Elevation: 0 4px 24px rgba(0,0,0,0.08)');
      lines.push('');
    }
    lines.push(getPlatformInstruction(null, site, data));
    const prompt=lines.join('\n'); state.lastPrompt=prompt;
    await savePrompt(data.url||state.currentUrl, prompt, 'image', platform, state.focus);
    showResult(prompt,{url:data.url},'image',null);
    flashSaveIndicator();
  } catch(err){showError('Could not generate prompt: '+err.message);}
}

function showImagePreview(data) {
  if(data.croppedDataUrl) $('imagePreview').src=data.croppedDataUrl; else if(data.src) $('imagePreview').src=data.src;
  const sw=$('colorSwatches'); sw.innerHTML='';
  (data.palette||[]).slice(0,10).forEach(hex=>{
    const el=document.createElement('div'); el.className='swatch'; el.style.background=hex;
    const label=document.createElement('span'); label.className='swatch-hex'; label.textContent=hex;
    el.appendChild(label);
    el.addEventListener('click',()=>{navigator.clipboard.writeText(hex);el.style.outline='2px solid #34d399';setTimeout(()=>el.style.outline='',1000);});
    sw.appendChild(el);
  });
  $('imagePreviewSection').style.display='flex';
}

// ═══════════════════════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function getPlatformHeader(){return '## Design Prompt';}
function getPlatformInstruction(p, site, data) {
  // Build Google Fonts import
  const SYSTEM_FONTS_FOR_IMPORT = new Set(['ui-sans-serif','ui-serif','ui-monospace','system-ui',
    '-apple-system','blinkmacsystemfont','helvetica neue','arial','sans-serif','serif','monospace']);
  const fonts = (data?.fonts || []).filter(f => f && !SYSTEM_FONTS_FOR_IMPORT.has(f.toLowerCase()));

  const GOOGLE_FONTS = new Set([
    'inter','roboto','open sans','lato','montserrat','poppins','raleway','nunito','ubuntu',
    'playfair display','merriweather','source sans pro','source code pro','fira code','fira sans',
    'dm sans','dm mono','dm serif display','dm serif text','space grotesk','space mono','jetbrains mono',
    'ibm plex mono','ibm plex sans','ibm plex serif','work sans','manrope','outfit',
    'plus jakarta sans','geist','geist mono','albert sans','bricolage grotesque',
    'anton','bebas neue','oswald','barlow','barlow condensed','archivo','lexend',
    'sora','satoshi','cabinet grotesk','general sans','clash display','clash grotesk',
    'pt serif','pt sans','pt mono','noto sans','noto serif','crimson text','crimson pro',
    'libre baskerville','cormorant','cormorant garamond','eb garamond','spectral',
    'bitter','lora','cardo','libre franklin','karla','rubik','quicksand','comfortaa',
    'josefin sans','josefin slab','exo 2','titillium web','cabin','arimo','dosis',
    'inconsolata','roboto mono','roboto slab','roboto condensed','nanum gothic',
    'red hat display','red hat text','red hat mono','instrument sans','instrument serif',
  ]);

  const googleFonts = [];
  const customFonts = [];
  for (const f of fonts) {
    if (GOOGLE_FONTS.has(f.toLowerCase())) googleFonts.push(f);
    else customFonts.push(f);
  }

  const weightStr = (data?.fontWeights || ['400','500','600','700','800']).join(';');
  const fontImport = googleFonts.length > 0
    ? `\nAdd to global CSS:\n@import url('https://fonts.googleapis.com/css2?${googleFonts.map(f => `family=${encodeURIComponent(f)}:wght@${weightStr}`).join('&')}&display=swap');`
    : '';
  const customFontNote = customFonts.length > 0
    ? `\nNOTE: "${customFonts.join('", "')}" ${customFonts.length === 1 ? 'is a' : 'are'} custom font${customFonts.length > 1 ? 's' : ''} not available on Google Fonts. Use the closest Google Fonts alternative (e.g. Inter, DM Sans, Space Grotesk for sans-serif; JetBrains Mono, Fira Code for monospace; Playfair Display for serif display) and match the weight/tracking values.`
    : '';

  // Asset section — custom font URLs and background assets for self-hosting tools
  const assetLines = [];
  if (data?.assets?.fonts?.length > 0) {
    const nonGoogle = data.assets.fonts.filter(f =>
      !f.url.includes('fonts.googleapis') && !f.url.includes('fonts.gstatic')
    );
    if (nonGoogle.length > 0) {
      assetLines.push('\n### Custom Font Files');
      assetLines.push('These font files are served directly from the site — load via @font-face:');
      nonGoogle.forEach(f => assetLines.push(`- "${f.family}": ${f.url}`));
      // Generate explicit @font-face blocks for LLM consumption
      assetLines.push('');
      assetLines.push('Load ALL custom fonts via @font-face in global CSS:');
      nonGoogle.forEach(f => {
        const _woff2 = f.url.endsWith('.woff2');
        const _format = _woff2 ? "format('woff2')" : "format('woff')";
        const _weightRange = (data?.fontWeights?.length > 1) ? ` font-weight: ${data.fontWeights[0]} ${data.fontWeights[data.fontWeights.length - 1]};` : '';
        assetLines.push(`@font-face { font-family: '${f.family}'; src: url('${f.url}') ${_format};${_weightRange} font-display: swap; }`);
      });
      assetLines.push('These fonts WILL load from the URLs above. Do not substitute with Google Fonts alternatives.');
    }
  }
  if (data?.assets?.backgrounds?.length > 0) {
    assetLines.push('\n### Background Assets');
    data.assets.backgrounds.forEach(bg => {
      const label = bg.type === 'svg-pattern' ? 'Decorative SVG pattern' : 'Background texture/image';
      assetLines.push(`- ${label}: ${bg.url}`);
    });
  }
  const assetSection = assetLines.length > 0 ? assetLines.join('\n') : '';

  // shadcn/ui CSS variable override block — always generated for compatibility with v0/Lovable/shadcn projects
  let shadcnBlock = '';
  {
    const sc = extractSemanticColors(data?.cssVars || {});
    const bgHex = data?.pageBackground || '#ffffff';
    const bgLum = hexLum(bgHex);
    const isDark = bgLum < 0.35;

    // --foreground = page text color, NOT button text color
    // Priority: body typography color > contrast-derived default
    const bodyTextColor = data?.typographyPatterns?.body?.color;
    const fgHex = (bodyTextColor && !/^rgba?\(0,\s*0,\s*0/.test(bodyTextColor) && bodyTextColor !== '#000000')
      ? bodyTextColor
      : (isDark ? '#ffffff' : '#000000');

    // --primary = CTA button background color (shadcn uses --primary for button bg)
    // Button bg takes priority over CSS var --primary (which may be a link/focus color like #0000ee)
    const _btnBg = data?.buttonStyles?.primary?.backgroundColor;
    const _btnBgValid = _btnBg && /^#[0-9a-f]{6}$/i.test(_btnBg.trim()) && hexLum(_btnBg) > 0.05 && hexLum(_btnBg) < 0.95;
    const primaryHex = (_btnBgValid ? _btnBg : null)
      || sc.primary
      || data?.accentColors?.[0] || '#000000';
    const primLum = hexLum(primaryHex);
    const primFg = primLum > 0.5 ? '#000000' : '#ffffff';

    const radii = data?.borderRadii || [];
    const radiusVal = radii.find(r => r !== '9999px' && r !== '50%') || '0px';

    // Derive additional tokens — all *-foreground must be readable on their paired background
    const cardHex = isDark ? _hexShift(bgHex, 8) : _hexShift(bgHex, -5);
    const cardFg = fgHex; // same as page foreground
    const mutedHex = isDark ? _hexShift(bgHex, 15) : _hexShift(bgHex, -10);
    // muted-foreground = dimmed text, must be readable on mutedHex
    const mutedFg = isDark ? '#767676' : '#6b7280';
    const secondaryHex = sc.secondary || (isDark ? _hexShift(bgHex, 20) : _hexShift(bgHex, -15));
    const secondaryFg = fgHex;
    // accent = decorative highlight, distinct from primary action
    const scAccentVal = sc.accent[0]?.value;
    const accentHex = (scAccentVal && scAccentVal.toLowerCase() !== primaryHex.toLowerCase())
      ? scAccentVal
      : (isDark ? _hexShift(bgHex, 25) : _hexShift(bgHex, -20));
    const accentFg = hexLum(accentHex) > 0.5 ? '#000000' : '#ffffff';
    const destructiveHex = '#ef4444';
    const destructiveFg = '#ffffff';
    const borderHex = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const inputHex = borderHex;
    const ringHex = primaryHex;
    const popoverHex = cardHex;
    const popoverFg = fgHex;
    shadcnBlock = `\n\nAdd to globals.css (override shadcn defaults with site tokens):\n:root {\n  --background: ${bgHex};\n  --foreground: ${fgHex};\n  --card: ${cardHex};\n  --card-foreground: ${cardFg};\n  --popover: ${popoverHex};\n  --popover-foreground: ${popoverFg};\n  --primary: ${primaryHex};\n  --primary-foreground: ${primFg};\n  --secondary: ${secondaryHex};\n  --secondary-foreground: ${secondaryFg};\n  --muted: ${mutedHex};\n  --muted-foreground: ${mutedFg};\n  --accent: ${accentHex};\n  --accent-foreground: ${accentFg};\n  --destructive: ${destructiveHex};\n  --destructive-foreground: ${destructiveFg};\n  --border: ${borderHex};\n  --input: ${inputHex};\n  --ring: ${ringHex};\n  --radius: ${radiusVal};\n}`;
  }

  return `Recreate this visual style faithfully. Use the EXACT hex colors, px values, font names, and spacing from the tokens and specifications above.
Source: ${site}

Implementation notes:
- Prefer the extracted color tokens over Tailwind defaults (slate, zinc, neutral, etc.). Override shadcn/ui CSS variables (--primary, --radius, --background) with the values specified above.
- Use the exact px values for border-radius, padding, and font sizes. Use the exact easing functions and durations from Motion Tokens.
- When a value is not specified in this prompt, a sensible default is acceptable.${fontImport}${customFontNote}${assetSection}${shadcnBlock}`;
}

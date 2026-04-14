// lib/ai-caller.js
// Shared AI caller — used by both popup.js and sidepanel.js
// DO NOT use Chrome APIs here — this file must be Chrome-API-free

// ─── AI Design Direction ───────────────────────────────────────────────────

const DIRECTION_SYSTEM_PROMPT = `You are an expert design director writing a Designer Brief for vibe coding tools (v0.dev, Bolt, Lovable). Your brief must capture both the EXACT CSS specifications AND the design INTENT — why each choice exists and how it makes the user feel. A developer reading this should understand the site's personality, not just its measurements.

Rules:
- Write exactly 8 paragraphs, each 2–4 sentences maximum
- Each paragraph starts with a bold label:
  1. **Brand personality & overall character** — Summarize the site's identity in 3 words (e.g. "sophisticated, minimal, trustworthy"). Then explain the visual strategy: does typography carry hierarchy, or color? Is whitespace a design material or just absence?
  2. **Section rhythm & visual hierarchy** — Describe the emotional arc of scrolling. Which sections invite scanning vs demand focus? How do section transitions feel (hard cuts = dramatic, gradients = smooth)? Describe the eye's journey through the page.
  3. **Image usage & visual treatment** — Classify the visual strategy: photography (cinematic/editorial/product), illustration (line-art/isometric/flat), abstract (geometric/gradient-mesh/particles), or none (typography-driven). Describe crop, aspect ratio, overlay strategy, and what the imagery communicates emotionally.
  4. **Typography** — Map each font to its semantic role: H1 (hero display), H2 (section headers), H3 (feature titles), body (reading text), caption (metadata), code (if any). Explain WHY the weight ladder exists (two distinct jumps create visual "resting places").
  5. **Color usage** — Map colors to semantic roles: primary-action (CTAs, links), surface-base, surface-elevated, border, text-primary, text-secondary, text-disabled, accent (decorative, NEVER for CTAs). Explain figure vs ground: is the accent color dominant (energetic) or surgical (restrained)?
  6. **Shape, elevation & component relationships** — Explain the radius family (why 8px = "designed but humane", why 9999px = "playful pill"). Describe the shadow vocabulary: which components share shadows, which don't? Explain elevation hierarchy: buttons > cards > page.
  7. **Interaction paradigm & motion intent** — Is the site scroll-driven (reveals on scroll) or click-driven (modal/tab interactions)? Is hover feedback minimal (confidence) or celebrated (engagement)? Describe timing philosophy: 200ms = snappy/responsive, 500ms = editorial/premium. Explain what motion SAYS about the brand.
  8. **Interaction choreography & hover states** — Describe specific hover behaviors with before→after values. Explain the physical metaphor: does a button "float" (translateY -2px) or "press" (scale 0.98)? Does a card "lift" (shadow grows) or "glow" (border brightens)? Match timing to intent.
- Reference actual hex values and CSS measurements from the extracted data inline using backtick notation
- Be PRESCRIPTIVE — every sentence must contain at least one concrete CSS value AND explain WHY it exists
- Write in English
- Do NOT use markdown headers (##, ###) anywhere
- Keep each paragraph SHORT — 2–3 sentences only. Never truncate.
- The vibe coding tool will use your values LITERALLY — be precise about numbers, narrative about intent
- Font names in the data are EXACT — never rename, reclassify, or substitute them. "Chalet" means "Chalet", not "a display font". Use the exact string from the data.`;

// ── Font role computation ────────────────────────────────────────────────

const SYSTEM_FONTS_SET = new Set([
  'ui-sans-serif','ui-serif','ui-monospace','system-ui',
  '-apple-system','blinkmacsystemfont','helvetica neue',
  'arial','sans-serif','serif','monospace'
]);

const MONO_KEYWORDS = ['mono','code','fira','jetbrains','courier','inconsolata','ibm plex mono','space mono','source code'];
const DISPLAY_KEYWORDS = ['anton','impact','bebas','oswald','barlow condensed','black','ultra','heavy','poster'];

function _classifyFont(name) {
  const n = name.toLowerCase();
  if (MONO_KEYWORDS.some(k => n.includes(k))) return 'mono';
  if (DISPLAY_KEYWORDS.some(k => n.includes(k))) return 'display';
  return 'sans';
}

function computeFontRoles(extractedData) {
  const tp_fonts = extractedData.typographyPatterns || {};
  const cleanedFonts = (extractedData.fonts || []).filter(f => f && !SYSTEM_FONTS_SET.has(f.toLowerCase()));

  let fontRoleDisplay = tp_fonts.h1?.fontFamily || '';
  let fontRoleBody = tp_fonts.body?.fontFamily || '';

  if (!fontRoleDisplay || !fontRoleBody) {
    if (cleanedFonts.length >= 2) {
      const classified = cleanedFonts.slice(0, 2).map(f => ({ name: f, type: _classifyFont(f) }));
      const displayCandidate = classified.find(f => f.type === 'display') || classified.find(f => f.type === 'sans') || classified[0];
      const bodyCandidate = classified.find(f => f !== displayCandidate) || classified[1];
      if (!fontRoleDisplay) fontRoleDisplay = displayCandidate.name;
      if (!fontRoleBody) fontRoleBody = bodyCandidate.name;
    } else if (cleanedFonts.length === 1) {
      if (!fontRoleDisplay) fontRoleDisplay = cleanedFonts[0];
      if (!fontRoleBody) fontRoleBody = cleanedFonts[0];
    }
  }

  const customFontList = (extractedData.assets?.fonts || [])
    .filter(f => !SYSTEM_FONTS_SET.has(f.family?.toLowerCase()))
    .map(f => `"${f.family}"`).join(', ');

  let fontRoleNote = '';
  if (fontRoleDisplay && fontRoleBody && fontRoleDisplay !== fontRoleBody) {
    fontRoleNote = `HEADING FONT (h1, h2, h3 — display): "${fontRoleDisplay}" — use this exact name\nBODY FONT (paragraphs, UI, labels): "${fontRoleBody}" — use this exact name`;
  } else if (fontRoleDisplay) {
    fontRoleNote = `Single font: "${fontRoleDisplay}" — all roles`;
  } else {
    fontRoleNote = 'System font stack (no custom font detected)';
  }
  if (customFontList) fontRoleNote += `\nAll custom fonts loaded via @font-face: ${customFontList}`;

  return { fontRoleDisplay, fontRoleBody, cleanedFonts, fontRoleNote };
}

// ── Shadow type classification ───────────────────────────────────────────

function classifyShadowTypes(shadows) {
  return (shadows || []).map(s => {
    if (s.includes('inset')) return 'inset (border/depth effect, not elevation)';
    if (s.includes('oklab(') || s.includes('oklch(')) return 'oklab glow (colored elevation)';
    if (/0px 0px \d+px/.test(s) || /0 0 \d+px/.test(s)) return 'glow (0-offset, blur only)';
    if (s.split(',').length > 2) return 'layered drop shadow (elevation)';
    return 'drop shadow (elevation)';
  });
}

// ── User prompt builder ──────────────────────────────────────────────────

function buildDirectionUserPrompt(extractedData, fontRoles) {
  const vp = extractedData.visualProfile || {};
  const ui = vp.uiPatterns || {};
  const sc = extractSemanticColors(extractedData.cssVars || {});
  const pageBgForAI = extractedData.pageBackground || null;
  const shadowTypes = classifyShadowTypes(extractedData.shadows);
  const bs = extractedData.buttonStyles || {};
  const tp = extractedData.typographyPatterns || {};
  const spacing = vp.spacingSystem || {};
  const iconD = ui.iconDetails || {};
  const { fontRoleDisplay, fontRoleBody, cleanedFonts, fontRoleNote } = fontRoles;

  let buttonDataStr = '';
  if (bs.primary) buttonDataStr += `\nButton primary (DOM-extracted): bg ${bs.primary.backgroundColor || '?'}, padding ${bs.primary.padding || '?'}, radius ${bs.primary.borderRadius || '?'}, font ${bs.primary.fontSize || '?'}/${bs.primary.fontWeight || '?'}`;
  if (bs.ghost) buttonDataStr += `\nButton ghost (DOM-extracted): border ${bs.ghost.border || '?'}, radius ${bs.ghost.borderRadius || '?'}`;

  let typoDataStr = '\nTypography scale (DOM-measured):';
  const _typoLevel = (name, d) => d ? `\n  ${name}: ${d.fontSize}/${d.fontWeight}/${d.lineHeight}${d.letterSpacing ? ', tracking ' + d.letterSpacing : ''}${d.textTransform && d.textTransform !== 'none' ? ', ' + d.textTransform : ''}${d.fontFamily ? ', font "' + d.fontFamily + '"' : ''}${d.color ? ', color ' + d.color : ''}` : '';
  typoDataStr += _typoLevel('H1 (hero display)', tp.h1);
  typoDataStr += _typoLevel('H2 (section header)', tp.h2);
  typoDataStr += _typoLevel('H3 (feature title)', tp.h3);
  typoDataStr += _typoLevel('H4 (subsection)', tp.h4);
  typoDataStr += _typoLevel('Body (reading)', tp.body);
  typoDataStr += _typoLevel('Label (UI)', tp.label);
  typoDataStr += _typoLevel('Caption', tp.caption);
  typoDataStr += _typoLevel('Code', tp.code);
  if (typoDataStr === '\nTypography scale (DOM-measured):') typoDataStr = '';

  let spacingDataStr = '';
  if (spacing.sectionPaddingY) spacingDataStr += `\nSection padding vertical: ${spacing.sectionPaddingY}`;
  if (spacing.containerMaxWidth && spacing.containerMaxWidth !== 'none') spacingDataStr += `\nContainer max-width: ${spacing.containerMaxWidth}`;
  if (spacing.gridGap) spacingDataStr += `\nGrid gap: ${spacing.gridGap}`;

  let iconDataStr = '';
  if (ui.hasIconSystem && iconD.size) {
    iconDataStr = `\nIcon system (DOM-extracted): ${iconD.size}, ${iconD.strokeWidth || '?'}px stroke, ${iconD.containerStyle || 'none'} container${iconD.containerBg ? ' bg ' + iconD.containerBg : ''}${iconD.containerRadius ? ' radius ' + iconD.containerRadius : ''}`;
  }

  return `Site: ${extractedData.url}
Page type: ${extractedData.layoutInfo?.pageType || 'web page'}
Page background (dominant color by area): ${pageBgForAI || 'unknown'}
Page mode: ${pageBgForAI ? (hexLum(pageBgForAI) < 0.25 ? '*** DARK SITE *** (luminance ' + Math.round(hexLum(pageBgForAI) * 100) + '%) — use dark-first language' : '*** LIGHT SITE *** (luminance ' + Math.round(hexLum(pageBgForAI) * 100) + '%) — never describe as dark mode or dark background') : '*** LIGHT SITE (assumed) ***'}
${fontRoleNote}
Colors extracted: ${(extractedData.colors || []).slice(0, 8).join(', ')}
Accent/vibrant colors: ${(extractedData.accentColors || []).slice(0, 5).join(', ')}
CSS var --primary: ${sc.primary || 'not found'}
Named color vars: ${sc.accent.map(a => a.key + ': ' + a.value).join(', ') || 'none'}
Border radii: ${(extractedData.borderRadii || []).slice(0, 5).join(', ')}
Shadows detected: ${shadowTypes.join(' | ') || 'none'}
Has glassmorphism: ${vp.hasGlassmorphism || false}
Has noise/grain texture: ${vp.hasNoiseTexture || false}
Nav style: ${vp.navStyle || 'default'}
Section color pattern: ${vp.sectionColorPattern || 'unknown'}
Section color sequence: ${(() => { const scm = extractedData.sectionContentMap || []; const seq = scm.filter(s => s.bgColor || s.gradient).map((s, i) => { let d = `S${i + 1}(${s.type}):${s.bgColor || 'transparent'}`; if (s.gradient) d += '+gradient'; return d; }); return seq.length > 0 ? seq.join(' → ') : 'uniform (sections inherit page bg)'; })()}
Image treatment: ${vp.imageTreatment || 'none'}
Has scroll animation: ${vp.hasScrollAnimation || !!(extractedData.motionProfile?.revealStyle) || (extractedData.animations || []).some(a => /blur-fade|reveal|fade-in/i.test(a.name)) || false}
Scroll reveal style: ${extractedData.motionProfile?.revealStyle || 'none'} ${(extractedData.animations || []).some(a => /blur-fade/i.test(a.name)) ? '(blur-fade keyframes detected — section headings reveal on scroll)' : ''}
Hero entrance: ${(extractedData.animations || []).some(a => /page-in|hero-enter|word-enter/i.test(a.name)) ? 'css-page-in keyframe detected — hero elements animate on page load, NOT on scroll' : (vp.animationPatterns || {}).hasHeroAnimation ? 'hero animation detected' : 'none detected'}
Animation patterns: textReveal=${(vp.animationPatterns || {}).hasTextReveal || false}, maskReveal=${(vp.animationPatterns || {}).hasMaskReveal || false}, arrowAnimation=${(vp.animationPatterns || {}).hasArrowAnimation || false}, slider=${(vp.animationPatterns || {}).hasSlider || false}(${(vp.animationPatterns || {}).sliderType || 'none'}), heroAnimation=${(vp.animationPatterns || {}).hasHeroAnimation || false}, staggerReveal=${(vp.animationPatterns || {}).hasStaggerReveal || false}
Hover states found: ${(extractedData.hoverStates || []).length} rules${(extractedData.hoverStates || []).slice(0, 5).map(h => { const { selector, ...p } = h; return `\n  ${selector}: ${Object.entries(p).map(([k, v]) => k + ':' + v).join(', ')}`; }).join('')}
Blend modes: ${(vp.blendModes || []).join(', ') || 'none'}
Split sections: ${vp.splitLayoutCount || 0}
UI patterns: marquee=${ui.hasMarquee}, logoStrip=${ui.hasLogoStrip}, pricing=${ui.hasPricingGrid}(${ui.pricingColumnCount}col), carousel=${ui.hasTestimonialCarousel}, video=${ui.hasVideoSection}, darkFooter=${ui.hasDarkFooter}, decorativeGeometry=${ui.hasDecorativeGeometry}, iconSystem=${ui.hasIconSystem}(${ui.iconStyle || 'none'},${ui.iconSystemCount || 0}icons), arrowLinks=${ui.hasArrowLinks}(color:${ui.arrowLinkColor || 'unknown'})
Page structure: ${(ui.pageStructure || []).join(' → ')}
Nav pattern: ${extractedData.navPattern ? `type=${extractedData.navPattern.type}, logo="${extractedData.navPattern.logoText || 'none'}", hamburger=${extractedData.navPattern.hasHamburger}, visibleLinks=[${(extractedData.navPattern.visibleLinks || []).join(', ')}]` : 'standard'}
Rotating text: ${extractedData.rotatingText ? extractedData.rotatingText.map(r => `[${r.element}] cycles: ${r.words.join(' → ')}`).join('; ') : 'none'}
Illustration style: ${extractedData.illustrationStyle ? `${extractedData.illustrationStyle.type}${extractedData.illustrationStyle.details ? ` (${extractedData.illustrationStyle.details.width || '?'}×${extractedData.illustrationStyle.details.height || '?'}px)` : ''}` : 'none'}
Curved panels: ${extractedData.curvedPanels ? extractedData.curvedPanels.map(p => `${p.side} edge, ${p.width}px, bg ${p.bg}, hasMenu=${p.hasMenu}`).join('; ') : 'none'}
Countdown/live text: ${extractedData.countdownElements ? extractedData.countdownElements.map(c => `"${c.text}" (${c.position})`).join('; ') : 'none'}
Case grid: ${extractedData.caseGridPattern ? `${extractedData.caseGridPattern.entryCount} entries, ${extractedData.caseGridPattern.columns || '?'}col, tags=[${(extractedData.caseGridPattern.entryStructure?.tagLabels || []).join(', ')}], hoverVideo=${extractedData.caseGridPattern.entryStructure?.hasHoverVideo || false}` : 'none'}
Custom cursor: ${extractedData.customCursor ? `type=${extractedData.customCursor.type}` : 'none (standard cursor)'}
Masonry grid: ${extractedData.masonryGrid ? `${extractedData.masonryGrid.columns}col, ${extractedData.masonryGrid.entryCount} items, heights ${extractedData.masonryGrid.heightRange.min}-${extractedData.masonryGrid.heightRange.max}px, method=${extractedData.masonryGrid.layoutMethod}` : 'none'}
Visual classification: ${extractedData.visualClassification ? `hero=${extractedData.visualClassification.heroVisual?.type || 'none'}(${extractedData.visualClassification.heroVisual?.subtype || '?'}), treatment=${extractedData.visualClassification.heroVisual?.treatment || 'raw'}` : 'not analyzed'}
Card system: ${extractedData.cardStyles ? `padding ${extractedData.cardStyles.padding || '?'}, radius ${extractedData.cardStyles.borderRadius || '?'}, shadow ${extractedData.cardStyles.shadowType || 'none'}, hover: ${extractedData.cardStyles.hoverEffect || 'none'}` : 'no cards detected'}
Filter effects: ${extractedData.filterEffects ? `${extractedData.filterEffects.summary || 'none detected'}` : 'not analyzed'}
Shadow system: ${extractedData.shadowSystem ? `style=${extractedData.shadowSystem.style || 'standard'}, maxDepth=${extractedData.shadowSystem.maxDepth || 1}` : 'not analyzed'}
Section transitions: ${extractedData.sectionTransitions ? extractedData.sectionTransitions.map((t, i) => `S${i + 1}→S${i + 2}: ${t.type}`).join(', ') : 'not analyzed'}
Motion profile: dominantDuration=${extractedData.motionProfile?.dominantDuration || '?'}, dominantEasing=${extractedData.motionProfile?.dominantEasing || '?'}, revealPattern=${extractedData.motionProfile?.revealPattern || '?'}, staggerStyle=${extractedData.motionProfile?.staggerStyle || 'none'}
${buttonDataStr}${typoDataStr}${spacingDataStr}${iconDataStr}

Follow these rules exactly:
1. FONTS: HEADING font = "${fontRoleDisplay || cleanedFonts[0] || 'display font'}". BODY font = "${fontRoleBody || cleanedFonts[1] || 'body font'}". These are DOM-measured values — use these exact strings. Never swap them. Never say "likely".
2. PRIMARY COLOR: "${sc.primary || ((extractedData.accentColors || [])[0] || 'accent')}" = primary action. Other named accents have distinct secondary roles — state them explicitly.
3. SHADOWS: Inset = border effect, not elevation. Oklab = colored glow.
4. HERO: If page background is light — hero uses the page background color, not photography with dark overlay. If decorativeGeometry=true, mention subtle background decoration but do not describe specific patterns. Keep decoration description minimal.
5. SECTION RHYTHM: sectionColorPattern="${vp.sectionColorPattern || 'unknown'}". uniform-light = page stays light throughout. uniform-dark = consistently dark. progressive-dark = light top, dark bottom. alternating = explicit flips.
6. DARK/LIGHT: The "Page mode" field above is the ground truth. Respect it strictly — do not invent a dark site when it says LIGHT SITE, or vice versa.
7. IMAGE TREATMENT: imageTreatment="${vp.imageTreatment || 'none'}". Only describe "cinematic photography" if imageTreatment=cinematic. If none/screenshot — describe geometric visuals, product UI, or functional imagery.
8. ICONS: If iconSystem=true — mention the ${ui.iconStyle || 'outlined'} icon style paired with feature headings.${iconD.size ? ` Size: ${iconD.size}, stroke: ${iconD.strokeWidth || '?'}px.` : ''}
9. ARROW LINKS: If arrowLinks=true — describe "Learn more →" text CTA with ${ui.arrowLinkColor || 'accent'} color as distinct secondary action pattern.
10. BUTTONS: ${bs.primary ? `Primary button has padding ${bs.primary.padding}, radius ${bs.primary.borderRadius}, font ${bs.primary.fontSize}/${bs.primary.fontWeight}. Reference these exact values.` : 'No button data extracted — describe button style based on overall design character.'}
11. SPACING: ${spacing.sectionPaddingY ? `Section padding is ${spacing.sectionPaddingY} vertical. Grid gap is ${spacing.gridGap || 'unknown'}.` : 'No spacing data — estimate based on design density.'} Reference exact values.
12. ROTATING TEXT: If rotating text is detected, describe the word-cycling animation in the hero (fade/slide, ~3s interval) as a key interaction pattern.
13. ILLUSTRATIONS: If illustration style is detected, describe it accurately as illustration — not as photography.
14. NAV PATTERN: If nav type is hamburger-only, describe the hidden nav — do not describe visible nav links. If curved panels detected, describe them as a signature design element.
15. CASE GRID: If a case/portfolio grid is detected, describe the grid layout (columns, thumbnails, hover video, category tags).

The measurements above are extracted from the actual DOM. Use these exact values — the vibe coding tool will use your numbers literally.

Write exactly 8 short paragraphs (2–3 sentences each), bold label at start: **Brand personality & overall character**, **Section rhythm & visual hierarchy**, **Image usage & visual treatment**, **Typography**, **Color usage**, **Shape, elevation & component relationships**, **Interaction paradigm & motion intent**, **Interaction choreography & hover states**. Never truncate. Embed hex values and px measurements within narrative prose that explains WHY each choice exists.`;
}

// ── Post-process: font swap guard ────────────────────────────────────────

function postProcessDirection(direction, fontRoleDisplay, fontRoleBody, cleanedFonts, extractedData) {
  if (!direction) return direction;

  // ── Font swap correction ──
  if (fontRoleDisplay && fontRoleBody && fontRoleDisplay !== fontRoleBody) {
    const headingParaMatch = direction.match(/\*\*Typography\*\*[^*]*/i);
    if (headingParaMatch) {
      let para = headingParaMatch[0];
      const original = para;
      if (para.toLowerCase().includes(fontRoleBody.toLowerCase()) &&
          !para.toLowerCase().includes(fontRoleDisplay.toLowerCase())) {
        const re = new RegExp(`(Headings use ["']?)${fontRoleBody}(["']?)`, 'gi');
        para = para.replace(re, `$1${fontRoleDisplay}$2`);
      }
      if (para !== original) {
        direction = direction.replace(original, para);
        console.info('[VibeDesign] Font swap corrected in AI direction');
      }
    }
  }

  // ── Color role contradiction fix ──
  // AI sometimes assigns the wrong hex to "primary-action" (e.g. calling an accent color
  // "the sole primary-action color" when the extracted primary-action is different).
  // Fix: if the Color usage paragraph claims a non-primary color "is the primary-action",
  // append a correction note.
  if (extractedData) {
    const _primaryAction = extractedData.buttonStyles?.primary?.backgroundColor;
    if (_primaryAction && /^#[0-9a-f]{3,8}$/i.test(_primaryAction)) {
      const colorParaMatch = direction.match(/\*\*Color usage\*\*[^*]*/i);
      if (colorParaMatch) {
        const colorPara = colorParaMatch[0];
        // Check if a different color is described as "primary-action" or "sole primary-action"
        const wrongPrimaryMatch = colorPara.match(/`(#[0-9a-fA-F]{6})`\s+is\s+the\s+(?:sole\s+)?primary[- ]action\s+color/i);
        if (wrongPrimaryMatch && wrongPrimaryMatch[1].toLowerCase() !== _primaryAction.toLowerCase()) {
          const wrongColor = wrongPrimaryMatch[1];
          // The AI swapped roles — fix the paragraph
          const fixedPara = colorPara
            .replace(
              new RegExp('`' + wrongColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '`\\s+is\\s+the\\s+(?:sole\\s+)?primary[- ]action\\s+color', 'i'),
              `\`${wrongColor}\` is a secondary accent used for hover shadows and highlights`
            );
          direction = direction.replace(colorPara, fixedPara);
          console.info(`[VibeDesign] Color role corrected: ${wrongColor} was mislabeled as primary-action (actual: ${_primaryAction})`);
        }
      }
    }
  }

  return direction;
}

// ── Retry wrapper with exponential backoff ──────────────────────────────

async function _withRetry(fn, maxAttempts = 3, onRetry) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try { return await fn(); } catch(err) {
      lastError = err;
      const status = err.message?.match(/\b(429|5\d{2})\b/);
      if (!status || attempt === maxAttempts) throw err;
      const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
      if (onRetry) onRetry(attempt, maxAttempts);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// ── Paragraph order enforcement ─────────────────────────────────────────

const CANONICAL_PARAGRAPH_ORDER = [
  'Brand personality', 'Section rhythm', 'Image usage',
  'Typography', 'Color usage', 'Shape, elevation',
  'Interaction paradigm', 'Interaction choreography'
];

function _enforceParaOrder(direction) {
  if (!direction) return direction;
  const paraRegex = /\*\*([^*]+)\*\*/g;
  const paragraphs = [];
  let match, lastIdx = 0;
  while ((match = paraRegex.exec(direction)) !== null) {
    if (paragraphs.length > 0) {
      paragraphs[paragraphs.length - 1].text = direction.slice(paragraphs[paragraphs.length - 1].start, match.index).trim();
    }
    paragraphs.push({ label: match[1].trim(), start: match.index });
    lastIdx = match.index;
  }
  if (paragraphs.length > 0) {
    paragraphs[paragraphs.length - 1].text = direction.slice(paragraphs[paragraphs.length - 1].start).trim();
  }
  if (paragraphs.length < 7) return direction; // need at least 7 of 8 expected paragraphs
  if (paragraphs.length !== 8) console.debug(`[VibeDesign] AI returned ${paragraphs.length}/8 expected paragraphs`);

  // Match each paragraph to canonical position
  const sorted = [...paragraphs].sort((a, b) => {
    const idxA = CANONICAL_PARAGRAPH_ORDER.findIndex(c => a.label.toLowerCase().includes(c.toLowerCase()));
    const idxB = CANONICAL_PARAGRAPH_ORDER.findIndex(c => b.label.toLowerCase().includes(c.toLowerCase()));
    return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
  });

  // Only reorder if actually different
  const changed = sorted.some((p, i) => paragraphs[i]?.label !== p.label);
  if (!changed) return direction;
  console.info('[VibeDesign] AI paragraphs reordered to canonical sequence');
  return sorted.map(p => p.text).join('\n\n');
}

// ── API call dispatcher ──────────────────────────────────────────────────

async function _callDirectionAPI(provider, apiKey, modelId, systemPrompt, userPrompt, onChunk) {
  // ── Helper: parse SSE stream ──
  async function _readSSE(response, extractText) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let full = '', buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
        try {
          const chunk = extractText(JSON.parse(line.slice(6)));
          if (chunk) { full += chunk; if (onChunk) onChunk(full); }
        } catch(e) { /* ignore parse errors in stream */ }
      }
    }
    return full;
  }

  if (provider === 'gemini') {
    if (onChunk) {
      // Streaming endpoint
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: userPrompt }], role: 'user' }],
            generationConfig: { maxOutputTokens: 2000, temperature: 0.4 }
          })
        }
      );
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(`Gemini: ${e.error?.message || r.status}`); }
      return await _readSSE(r, d => d.candidates?.[0]?.content?.parts?.[0]?.text || '');
    }
    // Non-streaming fallback
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }], role: 'user' }],
          generationConfig: { maxOutputTokens: 2000, temperature: 0.4 }
        })
      }
    );
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(`Gemini: ${e.error?.message || r.status}`); }
    const d = await r.json();
    return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  if (provider === 'claude') {
    if (onChunk) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: modelId, max_tokens: 2000, stream: true, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] })
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(r.status === 401 ? 'Claude: Invalid key.' : r.status === 429 ? 'Claude: Rate limit.' : `Claude: ${e.error?.message || r.status}`);
      }
      return await _readSSE(r, d => d.type === 'content_block_delta' ? d.delta?.text || '' : '');
    }
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: modelId, max_tokens: 2000, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] })
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(r.status === 401 ? 'Claude: Invalid key.' : r.status === 429 ? 'Claude: Rate limit.' : `Claude: ${e.error?.message || r.status}`);
    }
    const d = await r.json();
    return d.content?.[0]?.text || '';
  }

  if (provider === 'openai') {
    if (onChunk) {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: modelId, max_tokens: 2000, temperature: 0.4, stream: true, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] })
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(r.status === 401 ? 'OpenAI: Invalid key.' : r.status === 429 ? 'OpenAI: Rate limit.' : `OpenAI: ${e.error?.message || r.status}`);
      }
      return await _readSSE(r, d => d.choices?.[0]?.delta?.content || '');
    }
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: modelId, max_tokens: 2000, temperature: 0.4, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] })
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(r.status === 401 ? 'OpenAI: Invalid key.' : r.status === 429 ? 'OpenAI: Rate limit.' : `OpenAI: ${e.error?.message || r.status}`);
    }
    const d = await r.json();
    return d.choices?.[0]?.message?.content || '';
  }

  return '';
}

// ─── generateDirectionWithAI (orchestrator) ────────────────────────────────

async function generateDirectionWithAI(extractedData, provider, apiKey, modelId, onStatus, onChunk) {
  if (!provider || provider === 'none' || !apiKey || !modelId) return null;

  const fontRoles = computeFontRoles(extractedData);
  const userPrompt = buildDirectionUserPrompt(extractedData, fontRoles);

  try {
    const text = await _withRetry(
      () => _callDirectionAPI(provider, apiKey, modelId, DIRECTION_SYSTEM_PROMPT, userPrompt, onChunk),
      3,
      (attempt, max) => { if (onStatus) onStatus(`Retrying (${attempt}/${max})...`); }
    );
    let direction = text.trim() || null;
    direction = postProcessDirection(direction, fontRoles.fontRoleDisplay, fontRoles.fontRoleBody, fontRoles.cleanedFonts, extractedData);
    direction = _enforceParaOrder(direction);
    return direction;
  } catch(err) {
    console.warn('AI direction failed, rule engine fallback:', err.message);
    return null;
  }
}

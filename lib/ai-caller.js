// lib/ai-caller.js
// Shared AI vision API caller — used by both popup.js and sidepanel.js
// DO NOT use Chrome APIs here — this file must be Chrome-API-free

async function analyzeIllustrationWithVision(imageUrl, provider, apiKey, modelId) {
  if (!imageUrl || !apiKey || provider === 'none' || !provider) return null;
  if (!modelId) return null;

  const prompt = `Analyze this website hero illustration for code recreation.
Describe ONLY the visual elements a developer needs to recreate it in SVG or CSS.
Output format (fill in exact values):

BACKGROUND: [shape type, stroke color, stroke-dasharray if dashed, opacity]
MIDGROUND: [shape types, stroke color, stroke-width, fill]
FOREGROUND: [shape types, fill color, sizes]
COLORS: [list all hex/rgb values used]
COMPOSITION: [what's center/left/right, relative sizes, overlaps]
ANIMATION: [if any — what moves, how, duration]
METAPHOR: [what concept this visually represents — e.g. "node-edge graph", "network", "document flow"]

Be specific with numbers. Never say "some shapes" — say "3 circles, radius ~40px".`;

  try {
    if (provider === 'gemini') {
      const imgRes = await fetch(imageUrl);
      const blob = await imgRes.blob();
      const base64 = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });
      const mimeType = blob.type || 'image/png';
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: base64 } }
            ]}],
            generationConfig: { maxOutputTokens: 400 }
          })
        }
      );
      const json = await res.json();
      return json.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }

    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: modelId,
          max_tokens: 400,
          messages: [{ role: 'user', content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]}]
        })
      });
      const json = await res.json();
      return json.choices?.[0]?.message?.content || null;
    }

    if (provider === 'claude') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: 400,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'url', url: imageUrl } },
            { type: 'text', text: prompt }
          ]}]
        })
      });
      const json = await res.json();
      return json.content?.[0]?.text || null;
    }
  } catch(e) { return null; }

  return null;
}

// ─── generateDirectionWithAI ────────────────────────────────────────────────
// Canonical shared implementation — popup.js and sidepanel.js both use this.
// Uses popup.js version as source of truth (richer system prompt).

async function generateDirectionWithAI(extractedData, provider, apiKey, modelId) {
  if (!provider || provider === 'none' || !apiKey || !modelId) return null;

  const vp = extractedData.visualProfile||{};
  const ui = vp.uiPatterns||{};

  const systemPrompt = `You are an expert design director writing a Designer Brief for vibe coding tools (v0.dev, Bolt, Lovable). Your output is a narrative that explains WHAT the design does, WHY each choice exists, and HOW it should feel — while embedding exact CSS values inline.

Rules:
- Write exactly 7 paragraphs, each 2–4 sentences maximum
- Each paragraph starts with a bold label: **Overall character**, **Section rhythm & visual hierarchy**, **Image usage & visual treatment**, **Typography**, **Color usage**, **Shape, elevation & component relationships**, **Interaction choreography & motion intent**
- Reference actual hex values and CSS measurements from the extracted data — embed them inline within narrative prose using backtick notation
- Be PRESCRIPTIVE and INTENTIONAL — every sentence must contain at least one concrete CSS value AND explain WHY that value exists or HOW it makes the user feel
- For every interaction state (hover, focus, active), describe how it FEELS to the user, not just what CSS property changes. Example: "On hover, the button brightens subtly (brightness 1.08, 200ms ease-out) — a gentle acknowledgment, not a flash."
- Explain component relationships — which elements share design vocabulary (same radius family, same shadow language) and why
- When describing animation/motion, explain the INTENT: "The glitch animation reinforces the terminal/hacker aesthetic" not just "CSS clip-rect animations"
- When describing section rhythm, explain the EMOTIONAL arc: "Light sections invite scanning, dark sections demand focus"
- When describing buttons: specify exact padding, border-radius, font-size/weight, hover behavior with CSS values, AND the physical metaphor
- When describing spacing: specify exact values AND the rhythm feel (generous/compact/breathing)
- Write in English
- Do NOT use markdown headers (##, ###) anywhere
- Keep each paragraph SHORT — 2–3 sentences only. This prevents truncation.
- Always complete every sentence fully.
- The vibe coding tool will use your values LITERALLY — be precise about numbers, narrative about intent.`;

  // Pre-compute semantic colors to tell AI explicitly
  const sc = extractSemanticColors(extractedData.cssVars||{});
  const pageBgForAI = extractedData.pageBackground || null;

  // Pre-compute font roles for AI — determine which is display and which is body
  const SYSTEM_FONTS_SET = new Set(['ui-sans-serif','ui-serif','ui-monospace','system-ui',
    '-apple-system','blinkmacsystemfont','helvetica neue','arial','sans-serif','serif','monospace']);
  const cleanedFonts = (extractedData.fonts||[]).filter(f=>f&&!SYSTEM_FONTS_SET.has(f.toLowerCase()));

  const MONO_KEYWORDS = ['mono','code','fira','jetbrains','courier','inconsolata','ibm plex mono','space mono','source code'];
  const DISPLAY_KEYWORDS = ['anton','impact','bebas','oswald','barlow condensed','black','ultra','heavy','poster'];

  function classifyFont(name) {
    const n = name.toLowerCase();
    if (MONO_KEYWORDS.some(k=>n.includes(k))) return 'mono';
    if (DISPLAY_KEYWORDS.some(k=>n.includes(k))) return 'display';
    return 'sans';
  }

  let fontRoleDisplay = '', fontRoleBody = '', fontRoleNote = '';
  if (cleanedFonts.length >= 2) {
    const classified = cleanedFonts.slice(0,2).map(f=>({name:f, type:classifyFont(f)}));
    const displayCandidate = classified.find(f=>f.type==='display') || classified.find(f=>f.type==='sans') || classified[0];
    const bodyCandidate = classified.find(f=>f!==displayCandidate) || classified[1];
    fontRoleDisplay = displayCandidate.name;
    fontRoleBody = bodyCandidate.name;
    fontRoleNote = `Display/heading font: "${fontRoleDisplay}" — use for H1, H2, large section titles\nBody/UI font: "${fontRoleBody}" — use for paragraphs, labels, navigation, code`;
  } else if (cleanedFonts.length === 1) {
    fontRoleNote = `Single font: "${cleanedFonts[0]}" — all roles`;
  } else {
    fontRoleNote = 'System font stack (no custom font detected)';
  }

  const shadowTypes = (extractedData.shadows||[]).map(s => {
    if (s.includes('inset')) return 'inset (border/depth effect, not elevation)';
    if (s.includes('oklab(') || s.includes('oklch(')) return 'oklab glow (colored elevation)';
    if (/0px 0px \d+px/.test(s) || /0 0 \d+px/.test(s)) return 'glow (0-offset, blur only)';
    if (s.split(',').length > 2) return 'layered drop shadow (elevation)';
    return 'drop shadow (elevation)';
  });

  const bs = extractedData.buttonStyles || {};
  const tp = extractedData.typographyPatterns || {};
  const spacing = vp.spacingSystem || {};
  const iconD = ui.iconDetails || {};

  let buttonDataStr = '';
  if (bs.primary) buttonDataStr += `\nButton primary (DOM-extracted): bg ${bs.primary.backgroundColor||'?'}, padding ${bs.primary.padding||'?'}, radius ${bs.primary.borderRadius||'?'}, font ${bs.primary.fontSize||'?'}/${bs.primary.fontWeight||'?'}`;
  if (bs.ghost) buttonDataStr += `\nButton ghost (DOM-extracted): border ${bs.ghost.border||'?'}, radius ${bs.ghost.borderRadius||'?'}`;

  let typoDataStr = '';
  if (tp.h1) typoDataStr += `\nH1 measured: ${tp.h1.fontSize}/${tp.h1.fontWeight}/${tp.h1.lineHeight}${tp.h1.letterSpacing ? ', tracking '+tp.h1.letterSpacing : ''}${tp.h1.fontFamily ? ', font "'+tp.h1.fontFamily+'"' : ''}`;
  if (tp.body) typoDataStr += `\nBody measured: ${tp.body.fontSize}/${tp.body.fontWeight}/${tp.body.lineHeight}${tp.body.fontFamily ? ', font "'+tp.body.fontFamily+'"' : ''}`;
  if (tp.label) typoDataStr += `\nLabel measured: ${tp.label.fontSize}/${tp.label.fontWeight}, ${tp.label.textTransform||'normal'}${tp.label.letterSpacing ? ', tracking '+tp.label.letterSpacing : ''}`;

  let spacingDataStr = '';
  if (spacing.sectionPaddingY) spacingDataStr += `\nSection padding vertical: ${spacing.sectionPaddingY}`;
  if (spacing.containerMaxWidth && spacing.containerMaxWidth !== 'none') spacingDataStr += `\nContainer max-width: ${spacing.containerMaxWidth}`;
  if (spacing.gridGap) spacingDataStr += `\nGrid gap: ${spacing.gridGap}`;

  let iconDataStr = '';
  if (ui.hasIconSystem && iconD.size) {
    iconDataStr = `\nIcon system (DOM-extracted): ${iconD.size}, ${iconD.strokeWidth||'?'}px stroke, ${iconD.containerStyle||'none'} container${iconD.containerBg ? ' bg '+iconD.containerBg : ''}${iconD.containerRadius ? ' radius '+iconD.containerRadius : ''}`;
  }

  const userPrompt = `Site: ${extractedData.url}
Page type: ${extractedData.layoutInfo?.pageType||'web page'}
Page background (dominant color by area): ${pageBgForAI||'unknown'}
Page mode: ${pageBgForAI ? (hexLum(pageBgForAI) < 0.25 ? '*** DARK SITE *** (luminance '+Math.round(hexLum(pageBgForAI)*100)+'%) — use dark-first language' : '*** LIGHT SITE *** (luminance '+Math.round(hexLum(pageBgForAI)*100)+'%) — never describe as dark mode or dark background') : '*** LIGHT SITE (assumed) ***'}
${fontRoleNote}
Colors extracted: ${(extractedData.colors||[]).slice(0,8).join(', ')}
Accent/vibrant colors: ${(extractedData.accentColors||[]).slice(0,5).join(', ')}
CSS var --primary: ${sc.primary||'not found'}
Named color vars: ${sc.accent.map(a=>a.key+': '+a.value).join(', ')||'none'}
Border radii: ${(extractedData.borderRadii||[]).slice(0,5).join(', ')}
Shadows detected: ${shadowTypes.join(' | ')||'none'}
Has glassmorphism: ${vp.hasGlassmorphism||false}
Has noise/grain texture: ${vp.hasNoiseTexture||false}
Nav style: ${vp.navStyle||'default'}
Section color pattern: ${vp.sectionColorPattern||'unknown'}
Section color sequence: ${(()=>{const scm=extractedData.sectionContentMap||[];const seq=scm.filter(s=>s.bgColor||s.gradient).map((s,i)=>{let d=`S${i+1}(${s.type}):${s.bgColor||'transparent'}`;if(s.gradient)d+='+gradient';return d;});return seq.length>0?seq.join(' → '):'uniform (sections inherit page bg)';})()}
Image treatment: ${vp.imageTreatment||'none'}
Has scroll animation: ${vp.hasScrollAnimation||false}
Animation patterns: textReveal=${(vp.animationPatterns||{}).hasTextReveal||false}, maskReveal=${(vp.animationPatterns||{}).hasMaskReveal||false}, arrowAnimation=${(vp.animationPatterns||{}).hasArrowAnimation||false}, slider=${(vp.animationPatterns||{}).hasSlider||false}(${(vp.animationPatterns||{}).sliderType||'none'}), heroAnimation=${(vp.animationPatterns||{}).hasHeroAnimation||false}, staggerReveal=${(vp.animationPatterns||{}).hasStaggerReveal||false}
Hover states found: ${(extractedData.hoverStates||[]).length} rules${(extractedData.hoverStates||[]).slice(0,5).map(h=>{const{selector,...p}=h;return `\n  ${selector}: ${Object.entries(p).map(([k,v])=>k+':'+v).join(', ')}`;}).join('')}
Blend modes: ${(vp.blendModes||[]).join(', ')||'none'}
Split sections: ${vp.splitLayoutCount||0}
UI patterns: marquee=${ui.hasMarquee}, logoStrip=${ui.hasLogoStrip}, pricing=${ui.hasPricingGrid}(${ui.pricingColumnCount}col), carousel=${ui.hasTestimonialCarousel}, video=${ui.hasVideoSection}, darkFooter=${ui.hasDarkFooter}, decorativeGeometry=${ui.hasDecorativeGeometry}, iconSystem=${ui.hasIconSystem}(${ui.iconStyle||'none'},${ui.iconSystemCount||0}icons), arrowLinks=${ui.hasArrowLinks}(color:${ui.arrowLinkColor||'unknown'})
Page structure: ${(ui.pageStructure||[]).join(' → ')}
Nav pattern: ${extractedData.navPattern ? `type=${extractedData.navPattern.type}, logo="${extractedData.navPattern.logoText||'none'}", hamburger=${extractedData.navPattern.hasHamburger}, visibleLinks=[${(extractedData.navPattern.visibleLinks||[]).join(', ')}]` : 'standard'}
Rotating text: ${extractedData.rotatingText ? extractedData.rotatingText.map(r => `[${r.element}] cycles: ${r.words.join(' → ')}`).join('; ') : 'none'}
Illustration style: ${extractedData.illustrationStyle ? `${extractedData.illustrationStyle.type}${extractedData.illustrationStyle.details ? ` (${extractedData.illustrationStyle.details.width||'?'}×${extractedData.illustrationStyle.details.height||'?'}px)` : ''}` : 'none'}
Curved panels: ${extractedData.curvedPanels ? extractedData.curvedPanels.map(p => `${p.side} edge, ${p.width}px, bg ${p.bg}, hasMenu=${p.hasMenu}`).join('; ') : 'none'}
Countdown/live text: ${extractedData.countdownElements ? extractedData.countdownElements.map(c => `"${c.text}" (${c.position})`).join('; ') : 'none'}
Case grid: ${extractedData.caseGridPattern ? `${extractedData.caseGridPattern.entryCount} entries, ${extractedData.caseGridPattern.columns||'?'}col, tags=[${(extractedData.caseGridPattern.entryStructure?.tagLabels||[]).join(', ')}], hoverVideo=${extractedData.caseGridPattern.entryStructure?.hasHoverVideo||false}` : 'none'}
Custom cursor: ${extractedData.customCursor ? `type=${extractedData.customCursor.type}` : 'none (standard cursor)'}
Masonry grid: ${extractedData.masonryGrid ? `${extractedData.masonryGrid.columns}col, ${extractedData.masonryGrid.entryCount} items, heights ${extractedData.masonryGrid.heightRange.min}-${extractedData.masonryGrid.heightRange.max}px, method=${extractedData.masonryGrid.layoutMethod}` : 'none'}
${buttonDataStr}${typoDataStr}${spacingDataStr}${iconDataStr}

Follow these rules exactly:
1. FONTS: "${fontRoleDisplay||cleanedFonts[0]||'display font'}" = display/heading. "${fontRoleBody||cleanedFonts[1]||'body font'}" = body/UI. Never swap. Never say "likely".
2. PRIMARY COLOR: "${sc.primary||((extractedData.accentColors||[])[0]||'accent')}" = primary action. Other named accents have distinct secondary roles — state them explicitly.
3. SHADOWS: Inset = border effect, not elevation. Oklab = colored glow.
4. HERO: If page background is light — hero uses the page background color, not photography with dark overlay. If decorativeGeometry=true, mention subtle background decoration but do not describe specific patterns. Keep decoration description minimal.
5. SECTION RHYTHM: sectionColorPattern="${vp.sectionColorPattern||'unknown'}". uniform-light = page stays light throughout. uniform-dark = consistently dark. progressive-dark = light top, dark bottom. alternating = explicit flips.
6. DARK/LIGHT: The "Page mode" field above is the ground truth. Respect it strictly — do not invent a dark site when it says LIGHT SITE, or vice versa.
7. IMAGE TREATMENT: imageTreatment="${vp.imageTreatment||'none'}". Only describe "cinematic photography" if imageTreatment=cinematic. If none/screenshot — describe geometric visuals, product UI, or functional imagery.
8. ICONS: If iconSystem=true — mention the ${ui.iconStyle||'outlined'} icon style paired with feature headings.${iconD.size ? ` Size: ${iconD.size}, stroke: ${iconD.strokeWidth||'?'}px.` : ''}
9. ARROW LINKS: If arrowLinks=true — describe "Learn more →" text CTA with ${ui.arrowLinkColor||'accent'} color as distinct secondary action pattern.
10. BUTTONS: ${bs.primary ? `Primary button has padding ${bs.primary.padding}, radius ${bs.primary.borderRadius}, font ${bs.primary.fontSize}/${bs.primary.fontWeight}. Reference these exact values.` : 'No button data extracted — describe button style based on overall design character.'}
11. SPACING: ${spacing.sectionPaddingY ? `Section padding is ${spacing.sectionPaddingY} vertical. Grid gap is ${spacing.gridGap||'unknown'}.` : 'No spacing data — estimate based on design density.'} Reference exact values.
12. ROTATING TEXT: If rotating text is detected, describe the word-cycling animation in the hero (fade/slide, ~3s interval) as a key interaction pattern.
13. ILLUSTRATIONS: If illustration style is detected, describe it accurately as illustration — not as photography.
14. NAV PATTERN: If nav type is hamburger-only, describe the hidden nav — do not describe visible nav links. If curved panels detected, describe them as a signature design element.
15. CASE GRID: If a case/portfolio grid is detected, describe the grid layout (columns, thumbnails, hover video, category tags).

The measurements above are extracted from the actual DOM. Use these exact values — the vibe coding tool will use your numbers literally.

Write exactly 7 short paragraphs (2–3 sentences each), bold label at start: **Overall character**, **Section rhythm & visual hierarchy**, **Image usage & visual treatment**, **Typography**, **Color usage**, **Shape, elevation & component relationships**, **Interaction choreography & motion intent**. Never truncate. Embed hex values and px measurements within narrative prose that explains WHY each choice exists.`;

  try {
    let text = '';
    if (provider === 'gemini') {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({system_instruction:{parts:[{text:systemPrompt}]},contents:[{parts:[{text:userPrompt}],role:'user'}],generationConfig:{maxOutputTokens:1500,temperature:0.4}})});
      if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(`Gemini: ${e.error?.message||r.status}`); }
      const d=await r.json(); text=d.candidates?.[0]?.content?.parts?.[0]?.text||'';
    } else if (provider === 'claude') {
      const r = await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:modelId,max_tokens:1500,system:systemPrompt,messages:[{role:'user',content:userPrompt}]})});
      if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(r.status===401?'Claude: Invalid key.':r.status===429?'Claude: Rate limit.':`Claude: ${e.error?.message||r.status}`); }
      const d=await r.json(); text=d.content?.[0]?.text||'';
    } else if (provider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},body:JSON.stringify({model:modelId,max_tokens:1500,temperature:0.4,messages:[{role:'system',content:systemPrompt},{role:'user',content:userPrompt}]})});
      if (!r.ok) { const e=await r.json().catch(()=>({})); throw new Error(r.status===401?'OpenAI: Invalid key.':r.status===429?'OpenAI: Rate limit.':`OpenAI: ${e.error?.message||r.status}`); }
      const d=await r.json(); text=d.choices?.[0]?.message?.content||'';
    }
    return text.trim()||null;
  } catch(err) { console.warn('AI direction failed, rule engine fallback:', err.message); return null; }
}

// ═══════════════════════════════════════════════════════════════════════════
// Design Fusion Engine — multi-site token merge + collection storage
// ═══════════════════════════════════════════════════════════════════════════

const FUSION_KEY = 'fusionCollection';
const MAX_FUSION_SITES = 5;

// ── Storage ──────────────────────────────────────────────────────────────

async function loadFusionCollection() {
  const stored = await chrome.storage.local.get(FUSION_KEY);
  return stored[FUSION_KEY] || { sites: [], selections: {} };
}

async function saveFusionCollection(collection) {
  await chrome.storage.local.set({ [FUSION_KEY]: collection });
}

async function addSiteToFusion(extractedData) {
  const collection = await loadFusionCollection();
  const domain = safeHostname(extractedData.url);

  // Replace if same domain already exists
  collection.sites = collection.sites.filter(s => s.domain !== domain);

  // Preview: first 3 colors + primary font + bg
  const preview = {
    colors: (extractedData.accentColors || extractedData.colors || []).slice(0, 3),
    font: (extractedData.fonts || [])[0] || 'System',
    bgColor: extractedData.pageBackground || '#ffffff',
  };

  collection.sites.push({
    url: extractedData.url,
    domain,
    extractedData,
    addedAt: Date.now(),
    preview,
  });

  // Enforce max
  if (collection.sites.length > MAX_FUSION_SITES) {
    collection.sites = collection.sites.slice(-MAX_FUSION_SITES);
  }

  // Auto-select: first site gets all layers by default
  if (Object.keys(collection.selections).length === 0) {
    const layers = ['colors', 'typography', 'motion', 'shadows', 'layout', 'components'];
    layers.forEach(l => { collection.selections[l] = domain; });
  }

  await saveFusionCollection(collection);
  return collection;
}

async function removeSiteFromFusion(domain) {
  const collection = await loadFusionCollection();
  collection.sites = collection.sites.filter(s => s.domain !== domain);
  // Clean selections pointing to removed site
  for (const [layer, d] of Object.entries(collection.selections)) {
    if (d === domain) {
      collection.selections[layer] = collection.sites[0]?.domain || '';
    }
  }
  await saveFusionCollection(collection);
  return collection;
}

async function clearFusionCollection() {
  await saveFusionCollection({ sites: [], selections: {} });
}

async function updateFusionSelection(layer, domain) {
  const collection = await loadFusionCollection();
  collection.selections[layer] = domain;
  await saveFusionCollection(collection);
  return collection;
}

// ── Merge Engine ─────────────────────────────────────────────────────────

const LAYER_FIELDS = {
  colors: [
    'colors', 'accentColors', 'pageBackground',
  ],
  typography: [
    'fonts', 'typographyPatterns', 'fontWeights',
  ],
  motion: [
    'animations', 'animationDetails', 'animationLibraries',
    'motionProfile', 'hoverStates', 'transitions', 'heroEntranceSequence',
  ],
  shadows: [
    'shadows', 'shadowSystem',
  ],
  layout: [
    'layoutInfo', 'borderRadii', 'sectionContentMap', 'breakpoints',
  ],
  components: [
    'buttonStyles', 'cardStyles', 'badgeStyles', 'inputStyles',
    'linkStyles', 'footerStyles', 'navPattern',
  ],
};

// Visual profile sub-fields per layer
const VP_LAYER_FIELDS = {
  colors: ['sectionColorPattern', 'sectionRhythm', 'imageTreatment', 'hasFullBleedImages', 'hasNoiseTexture'],
  motion: ['animationPatterns', 'hasScrollAnimation'],
  shadows: ['hasGlassmorphism', 'blendModes'],
  layout: ['spacingSystem', 'splitLayoutCount'],
  components: ['uiPatterns', 'navStyle'],
};

function mergeExtractedData(collection) {
  const { sites, selections } = collection;
  if (sites.length === 0) return null;
  if (sites.length === 1) return sites[0].extractedData;

  // Base: start with colors site (determines dark/light, overall character)
  const colorsSite = sites.find(s => s.domain === selections.colors) || sites[0];
  const merged = JSON.parse(JSON.stringify(colorsSite.extractedData));

  // Source tracking
  const sources = [];

  // Override each layer from its selected site
  for (const [layer, fields] of Object.entries(LAYER_FIELDS)) {
    const domain = selections[layer];
    if (!domain || domain === colorsSite.domain) continue;

    const site = sites.find(s => s.domain === domain);
    if (!site) continue;

    sources.push({ layer, domain });

    // Copy top-level fields
    for (const field of fields) {
      if (site.extractedData[field] !== undefined) {
        merged[field] = JSON.parse(JSON.stringify(site.extractedData[field]));
      }
    }

    // Copy visual profile sub-fields
    const vpFields = VP_LAYER_FIELDS[layer];
    if (vpFields && site.extractedData.visualProfile) {
      if (!merged.visualProfile) merged.visualProfile = {};
      for (const vf of vpFields) {
        if (site.extractedData.visualProfile[vf] !== undefined) {
          merged.visualProfile[vf] = JSON.parse(JSON.stringify(site.extractedData.visualProfile[vf]));
        }
      }
    }

    // Special: typography needs assets.fonts
    if (layer === 'typography' && site.extractedData.assets?.fonts) {
      if (!merged.assets) merged.assets = {};
      merged.assets.fonts = JSON.parse(JSON.stringify(site.extractedData.assets.fonts));
    }

    // Special: colors needs cssVars (only color vars)
    if (layer === 'colors') {
      const _isColorVal = (v) => typeof v === 'string' && (/^#[0-9a-f]{3,8}$/i.test(v.trim()) || /^rgb/.test(v) || /^hsl/.test(v));
      const colorVars = {};
      // Copy color vars from selected site (if available)
      if (site.extractedData.cssVars) {
        for (const [k, v] of Object.entries(site.extractedData.cssVars)) {
          if (_isColorVal(v)) colorVars[k] = v;
        }
      }
      // Always keep non-color vars from base
      for (const [k, v] of Object.entries(merged.cssVars || {})) {
        if (!_isColorVal(v)) colorVars[k] = v;
      }
      merged.cssVars = colorVars;
    }
  }

  // Update metadata
  const usedDomains = [...new Set([colorsSite.domain, ...sources.map(s => s.domain)])];
  merged.url = 'fusion://' + usedDomains.join('+');
  merged.title = 'Design Fusion: ' + usedDomains.join(' × ');
  merged._fusionSources = sources;
  merged._fusionSelections = { ...selections };

  return merged;
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTO FUSION — AI-free layer scoring: picks the strongest site per layer
// ═══════════════════════════════════════════════════════════════════════════

function _scoreColors(data) {
  let score = 0;
  const vars = data.cssVars || {};
  const colorVarCount = Object.entries(vars).filter(([, v]) => /^#[0-9a-f]{3,8}$/i.test(v.trim())).length;
  score += Math.min(colorVarCount, 10); // named color vars = organized palette
  score += (data.accentColors || []).length * 2; // vibrant accents = intentional palette
  if (data.pageBackground) score += 3; // explicit bg = good signal
  const vp = data.visualProfile || {};
  if (vp.sectionColorPattern && vp.sectionColorPattern !== 'unknown') score += 2;
  return score;
}

function _scoreTypography(data) {
  let score = 0;
  const tp = data.typographyPatterns || {};
  const levels = ['h1', 'h2', 'h3', 'h4', 'body', 'label', 'caption', 'code'];
  levels.forEach(l => { if (tp[l]) score += 2; }); // each measured level = quality
  const fonts = (data.fonts || []).filter(f => f && f.length > 1);
  if (fonts.length >= 2) score += 3; // two-font system
  else if (fonts.length === 1) score += 1;
  if (data.assets?.fonts?.length > 0) score += 2; // custom fonts loaded
  if (data.fontWeights?.length > 2) score += 1; // weight variety
  return score;
}

function _scoreMotion(data) {
  let score = 0;
  score += Math.min((data.animations || []).length, 6); // keyframes
  score += Math.min((data.hoverStates || []).length, 5); // hover interactions
  const mp = data.motionProfile || {};
  if (mp.dominantDuration) score += 2;
  if (mp.dominantEasing) score += 1;
  if (mp.staggerStyle && mp.staggerStyle !== 'none') score += 2;
  const vp = data.visualProfile || {};
  if (vp.hasScrollAnimation) score += 3;
  const ap = vp.animationPatterns || {};
  if (ap.hasStaggerReveal) score += 2;
  if (ap.hasTextReveal) score += 2;
  if (ap.hasHeroAnimation) score += 1;
  return score;
}

function _scoreShadows(data) {
  let score = 0;
  const shadows = data.shadows || [];
  score += Math.min(shadows.length * 2, 8); // variety
  const sys = data.shadowSystem || {};
  if (sys.hasLayered) score += 3; // layered = sophisticated
  if (sys.hasGlow) score += 2;
  if (sys.hasBrutalist) score += 2; // distinctive
  const vp = data.visualProfile || {};
  if (vp.hasGlassmorphism) score += 3;
  return score;
}

function _scoreLayout(data) {
  let score = 0;
  const scm = data.sectionContentMap || [];
  score += Math.min(scm.length * 2, 12); // section richness
  const vp = data.visualProfile || {};
  const sp = vp.spacingSystem || {};
  if (sp.sectionPaddingY) score += 2;
  if (sp.containerMaxWidth && sp.containerMaxWidth !== 'none') score += 2;
  if (sp.gridGap) score += 1;
  if (vp.splitLayoutCount > 0) score += 2;
  if ((data.borderRadii || []).length > 1) score += 1;
  return score;
}

function _scoreComponents(data) {
  let score = 0;
  if (data.buttonStyles?.primary) score += 3;
  if (data.buttonStyles?.ghost) score += 2;
  if (data.cardStyles) score += 3;
  if (data.badgeStyles) score += 2;
  if (data.inputStyles) score += 2;
  if (data.navPattern) score += 2;
  const vp = data.visualProfile || {};
  const ui = vp.uiPatterns || {};
  if (ui.hasIconSystem) score += 2;
  if (ui.hasPricingGrid) score += 1;
  if (ui.hasTestimonialCarousel) score += 1;
  return score;
}

const LAYER_SCORERS = {
  colors: _scoreColors,
  typography: _scoreTypography,
  motion: _scoreMotion,
  shadows: _scoreShadows,
  layout: _scoreLayout,
  components: _scoreComponents,
};

function autoSelectLayers(sites) {
  const selections = {};
  const reasoning = {};

  for (const [layer, scorer] of Object.entries(LAYER_SCORERS)) {
    let bestDomain = sites[0]?.domain || '';
    let bestScore = -1;

    for (const site of sites) {
      const score = scorer(site.extractedData);
      if (score > bestScore) {
        bestScore = score;
        bestDomain = site.domain;
      }
    }

    selections[layer] = bestDomain;
    reasoning[layer] = { domain: bestDomain, score: bestScore };
  }

  return { selections, reasoning };
}

async function applyAutoFusion() {
  const collection = await loadFusionCollection();
  if (collection.sites.length < 2) return collection;

  const { selections, reasoning } = autoSelectLayers(collection.sites);
  collection.selections = selections;
  collection._autoReasoning = reasoning;
  await saveFusionCollection(collection);
  return collection;
}

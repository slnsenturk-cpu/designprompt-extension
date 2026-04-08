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
    if (layer === 'colors' && site.extractedData.cssVars) {
      const colorVars = {};
      for (const [k, v] of Object.entries(site.extractedData.cssVars)) {
        if (/^#[0-9a-f]{3,8}$/i.test(v.trim()) || /^rgb/.test(v) || /^hsl/.test(v)) {
          colorVars[k] = v;
        }
      }
      // Merge: color vars from selected site override, keep non-color vars from base
      for (const [k, v] of Object.entries(merged.cssVars || {})) {
        if (!(/^#[0-9a-f]{3,8}$/i.test(v.trim()) || /^rgb/.test(v) || /^hsl/.test(v))) {
          colorVars[k] = v; // keep non-color vars from base
        }
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

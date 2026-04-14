// lib/noise-filter.js
// Framework CSS variable noise filters — injected before content.js
// Filters internal vars from Framer, Webflow, Tailwind, Bootstrap, Swiper, etc.

(function () {
  if (window.__vibeDesignNoiseFilter) return;
  window.__vibeDesignNoiseFilter = true;

  const NOISE_PREFIXES = [
    // CSS frameworks
    '--tw-', '--bs-', '--wp-',
    // Design tools
    '--framer-', '--wf-', '--webflow-',
    // Component libraries
    '--chakra-', '--mui-', '--ant-', '--el-', '--van-', '--vp-',
    '--sl-', '--sd-', '--spectrum-', '--calcite-', '--pfe-', '--fast-', '--fluent-',
    '--mdb-', '--daisyui-', '--radix-',
    // UI utility libraries (toasts, modals, tooltips etc.)
    '--toastify-', '--toast-', '--sonner-', '--hot-toast-',
    '--tippy-', '--popper-', '--floating-',
    '--swiper-', '--glide-', '--splide-',
    '--nprogress-', '--notistack-',
    // Generic internal markers
    '--internal-', '--private-',
  ];

  const NOISE_PATTERNS = [
    /text-decoration/,
    /skip-ink/,
    /underline-offset/,
    /decoration-thickness/,
    /decoration-color/,
    /decoration-style/,
    /current-color/,
    /link-current/,
    /ring-inset/,
    /ring-offset/,
    /ring-shadow/,
    /ring-color/,
    /prose-/,
    /preloader/,
    /navigation-size/,
    /pagination-/,
    /scrollbar-/,
    // Toast/notification lib internals
    /spinner-color/,
    /toast-background/,
    /toast-shadow/,
    /toast-bd-/,
    /bounce-in/,
    /bounce-out/,
    /track-progress/,
    // Animation library internals
    /aos-/,
    /gsap-/,
  ];

  function isNoisyVar(key) {
    if (NOISE_PREFIXES.some(p => key.startsWith(p))) return true;
    if (NOISE_PATTERNS.some(p => p.test(key))) return true;
    // Webflow/Figma deleted variable markers
    if (key.includes('<deleted|') || key.includes('|variable-') || key.includes('|>')) return true;
    // Internal tool variables with special characters
    if (/[<>|]/.test(key)) return true;
    return false;
  }

  // Only keep vars with concrete design values (not references to other vars)
  function hasUsefulValue(val) {
    if (!val) return false;
    const v = val.trim();
    // Reject pure var() references — they're not useful without resolution
    if (/^var\(/.test(v)) return false;
    // Reject none/initial/inherit
    if (/^(none|initial|inherit|unset|auto|normal)$/.test(v)) return false;
    return (
      /^#[0-9a-f]{3,8}$/i.test(v) ||
      /^rgb/.test(v) ||
      /^hsl/.test(v) ||
      /\d+(px|rem|em|ms|s|vh|vw|%)/.test(v) ||
      // Font family names — quoted or unquoted
      (/^["']?[A-Z][\w\s-]+["']?/.test(v) && v.length < 80)
    );
  }

  // Expose on shared namespace
  window.__vibeDesign = window.__vibeDesign || {};
  window.__vibeDesign.isNoisyVar = isNoisyVar;
  window.__vibeDesign.hasUsefulValue = hasUsefulValue;
})();

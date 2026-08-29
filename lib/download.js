// VibeDesign — client-side file download (v3.0)
//
// Triggers a browser download from an extension page using an object URL and a
// synthetic anchor click. No `downloads` permission is needed: the side panel
// is an extension page, so it may create and click its own blob link.
//
// Plain globals so the same file works via <script> tag and via require() in
// Node tests. No ESM, no build step.
//
//   VD_DOWNLOAD.downloadText(text, filename, mimeType)  → boolean
//   VD_DOWNLOAD.downloadBytes(uint8, filename, mimeType) → boolean
//   VD_DOWNLOAD.designMdFilename(url)                   → "DESIGN-rig.ai.md"
//   VD_DOWNLOAD.bundleSlug(url)                         → "design-rig-ai"
//
// Used by the result panel's Download DESIGN.md action.

const VD_DOWNLOAD = (() => {
  'use strict';

  // Object URLs pin their blob in memory until revoked. Revoking immediately
  // races the download in some builds, so we give the click a beat first.
  const REVOKE_DELAY_MS = 60 * 1000;

  // Anything that is not a safe filename character becomes a hyphen. Also
  // strips leading dots so a hostname can never produce a hidden file.
  function safeFilenamePart(value, fallback) {
    const s = String(value === null || value === undefined ? '' : value)
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/^[.-]+|[.-]+$/g, '')
      .slice(0, 60);
    return s || fallback;
  }

  // "https://rig.ai/" → "DESIGN-rig.ai.md"
  // An optional suffix is supported for callers that need to disambiguate
  // (the component-scope export in Prompt 3); omitted, the name is just the
  // domain, which is what the result panel wants.
  function designMdFilename(url, suffix) {
    let host = '';
    try { host = new URL(String(url)).hostname; } catch (e) { host = String(url || ''); }
    const domain = safeFilenamePart(host, 'site');
    const extra = suffix ? '-' + safeFilenamePart(suffix, '').toLowerCase() : '';
    return `DESIGN-${domain}${extra}.md`;
  }

  // Returns true when the download was started. Never throws: a failed export
  // must not take the panel down with it.
  function downloadText(text, filename, mimeType) {
    try {
      if (typeof text !== 'string' || !text) return false;
      if (typeof document === 'undefined' || !document.body) return false;

      const type = mimeType || 'text/markdown;charset=utf-8';
      const blob = new Blob([text], { type: type });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'download.md';
      a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => {
        try { URL.revokeObjectURL(url); } catch (e) { /* already gone */ }
      }, REVOKE_DELAY_MS);
      return true;
    } catch (e) {
      console.warn('[vd-download] download failed', e);
      return false;
    }
  }

  // Same mechanism, but for binary payloads (the skill bundle zip). Kept
  // separate from downloadText so a caller cannot accidentally hand a
  // Uint8Array to a text path and ship a "[object Uint8Array]" file.
  function downloadBytes(bytes, filename, mimeType) {
    try {
      if (!bytes || typeof bytes.byteLength !== 'number' || !bytes.byteLength) return false;
      if (typeof document === 'undefined' || !document.body) return false;

      const blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'download.bin';
      a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => {
        try { URL.revokeObjectURL(url); } catch (e) { /* already gone */ }
      }, REVOKE_DELAY_MS);
      return true;
    } catch (e) {
      console.warn('[vd-download] download failed', e);
      return false;
    }
  }

  // "https://rig.ai/" → "design-rig-ai" — the bundle's directory name, and the
  // zip's basename. Dots become hyphens: a folder called "rig.ai" reads as a
  // file with an extension in most file managers.
  function bundleSlug(url) {
    let host = '';
    try { host = new URL(String(url)).hostname; } catch (e) { host = String(url || ''); }
    const clean = safeFilenamePart(host, 'site').replace(/\./g, '-').toLowerCase();
    return 'design-' + (clean || 'site');
  }

  return {
    downloadText,
    downloadBytes,
    designMdFilename,
    bundleSlug,
    _safeFilenamePart: safeFilenamePart,
  };
})();

if (typeof self !== 'undefined') {
  self.VD_DOWNLOAD = VD_DOWNLOAD;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VD_DOWNLOAD;
}

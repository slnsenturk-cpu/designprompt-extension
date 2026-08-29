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
//   VD_DOWNLOAD.designMdFilename(url, tier)             → "DESIGN-rig.ai-pro.md"
//
// The real Output UI reuses both.

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

  // "https://rig.ai/" + "pro" → "DESIGN-rig.ai-pro.md"
  function designMdFilename(url, tier) {
    let host = '';
    try { host = new URL(String(url)).hostname; } catch (e) { host = String(url || ''); }
    const domain = safeFilenamePart(host, 'site');
    const t = safeFilenamePart(tier, 'free').toLowerCase();
    return `DESIGN-${domain}-${t}.md`;
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

  return {
    downloadText,
    designMdFilename,
    _safeFilenamePart: safeFilenamePart,
  };
})();

if (typeof self !== 'undefined') {
  self.VD_DOWNLOAD = VD_DOWNLOAD;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VD_DOWNLOAD;
}

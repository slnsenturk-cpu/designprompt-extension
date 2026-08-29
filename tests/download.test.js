const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const dl = require(path.join('/Users/selensenturk/Desktop/design-prompt-ext-v30', 'lib', 'download.js'));

test('filenames are derived from the domain and tier', () => {
  assert.equal(dl.designMdFilename('https://rig.ai/', 'pro'), 'DESIGN-rig.ai-pro.md');
  assert.equal(dl.designMdFilename('https://www.northwind.io/pricing', 'free'), 'DESIGN-northwind.io-free.md');
  assert.equal(dl.designMdFilename('not a url', 'pro'), 'DESIGN-not-a-url-pro.md');
  assert.equal(dl.designMdFilename('', ''), 'DESIGN-site-free.md');
});

test('path separators and dotfiles cannot be produced', () => {
  const f = dl._safeFilenamePart;
  assert.ok(!f('a/b/../c', 'x').includes('/'));
  assert.ok(!f('...hidden', 'x').startsWith('.'));
  assert.equal(f('', 'fallback'), 'fallback');
  assert.equal(f(null, 'fallback'), 'fallback');
  // Long hostnames are truncated rather than producing an unusable name.
  assert.ok(f('a'.repeat(200), 'x').length <= 60);
});

test('downloadText fails safely with no DOM and never throws', () => {
  assert.equal(typeof document, 'undefined');
  assert.equal(dl.downloadText('# hi', 'x.md'), false);
  assert.equal(dl.downloadText('', 'x.md'), false);
  assert.equal(dl.downloadText(null, 'x.md'), false);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const dl = require(path.join('/Users/selensenturk/Desktop/design-prompt-ext-v30', 'lib', 'download.js'));

test('filenames are derived from the domain', () => {
  assert.equal(dl.designMdFilename('https://rig.ai/'), 'DESIGN-rig.ai.md');
  assert.equal(dl.designMdFilename('https://www.northwind.io/pricing'), 'DESIGN-northwind.io.md');
  assert.equal(dl.designMdFilename('not a url'), 'DESIGN-not-a-url.md');
  assert.equal(dl.designMdFilename(''), 'DESIGN-site.md');
});

test('an optional suffix is supported for future scoped exports', () => {
  // Prompt 3's component-scope export needs to disambiguate; the result
  // panel passes no suffix and gets the plain domain name.
  assert.equal(dl.designMdFilename('https://rig.ai/', 'component'), 'DESIGN-rig.ai-component.md');
  assert.equal(dl.designMdFilename('https://rig.ai/', ''), 'DESIGN-rig.ai.md');
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

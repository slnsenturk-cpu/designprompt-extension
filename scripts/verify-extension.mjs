#!/usr/bin/env node
// VibeDesign — load the real extension in Chromium and check what it can do.
//
//   node scripts/verify-extension.mjs
//
// Answers two questions that only a real browser can answer:
//
//   1. What does Chrome grant at INSTALL time? If <all_urls> appears here,
//      the install flow warns about reading data on every website.
//   2. Does injection still work? content.js and friends go in through
//      scripting.executeScript({files}), which reads them from the package —
//      not through web_accessible_resources, which is why removing that entry
//      is safe. This proves it rather than assuming it.
//
// The per-site permission PROMPT cannot be exercised here: it is a native
// Chrome dialog, and automation cannot click it. Run the manual step in
// docs/RELEASE-CHECKLIST.md for that.
//
// Requires: npx playwright install chromium
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EXT = process.cwd();
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'vd-prof-'));
const ctx = await chromium.launchPersistentContext(profile, {
  headless: false,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-first-run'],
});

// Find the extension's id via its service worker.
let sw = ctx.serviceWorkers()[0];
if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
const id = new URL(sw.url()).host;
console.log(`  extension loaded · id ${id}`);

// What did Chrome actually grant at install time?
const granted = await sw.evaluate(() => new Promise(res =>
  chrome.permissions.getAll(p => res(p))));
console.log(`  permissions at install: ${granted.permissions.join(', ')}`);
console.log(`  origins at install:     ${granted.origins.length ? granted.origins.join(', ') : '(none)'}`);
const hasAllUrls = granted.origins.some(o => o === '<all_urls>' || o === '*://*/*');
console.log(`  <all_urls> granted on install: ${hasAllUrls ? 'YES — install would warn about all sites' : 'no'}`);

const SITES = ['https://github.com/', 'https://rig.ai/', 'https://posthog.com/',
               'https://developer.mozilla.org/en-US/', 'https://news.ycombinator.com/'];

console.log('\n  Analyze + picker per site (scripting.executeScript, the real path):');
for (const url of SITES) {
  const page = await ctx.newPage();
  let line = `    ${new URL(url).host.padEnd(24)}`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1200);
    const tabId = await sw.evaluate(async (u) => {
      const tabs = await chrome.tabs.query({});
      const t = tabs.find(t => t.url && t.url.startsWith(u.slice(0, 30)));
      return t ? t.id : null;
    }, url);
    if (!tabId) { console.log(line + 'could not find the tab'); await page.close(); continue; }

    // Grant this origin the way the panel does.
    const origin = new URL(url).origin + '/*';
    const ok = await sw.evaluate(o => new Promise(res =>
      chrome.permissions.request({ origins: [o] }, res)), origin).catch(() => false);

    // Inject exactly what injectContentScript/injectPickerScript inject.
    const inject = async (files) => sw.evaluate(async ({ tabId, files }) => {
      for (const f of files) await chrome.scripting.executeScript({ target: { tabId }, files: [f] });
      return true;
    }, { tabId, files });

    await inject(['lib/color-utils.js', 'lib/noise-filter.js', 'lib/shadow-utils.js', 'content.js']);
    const extract = await sw.evaluate(async (tabId) => {
      const r = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_PAGE' });
      return r && r.success ? Object.keys(r.data).length : null;
    }, tabId);

    await inject(['lib/picker.js']);
    const picker = await sw.evaluate(async (tabId) => {
      try { await chrome.tabs.sendMessage(tabId, { type: 'ACTIVATE_PICKER' });
            await chrome.tabs.sendMessage(tabId, { type: 'DEACTIVATE_PICKER' });
            return true; } catch (e) { return e.message; }
    }, tabId);

    line += `granted:${ok ? 'y' : 'n'}  extract:${extract ? extract + ' fields' : 'FAILED'}  picker:${picker === true ? 'ok' : 'FAILED ' + picker}`;
  } catch (e) {
    line += 'ERROR ' + e.message.split('\n')[0].slice(0, 60);
  }
  console.log(line);
  await page.close();
}

const after = await sw.evaluate(() => new Promise(res => chrome.permissions.getAll(p => res(p))));
console.log(`\n  origins after the five grants: ${after.origins.join(', ')}`);
await ctx.close();
fs.rmSync(profile, { recursive: true, force: true });

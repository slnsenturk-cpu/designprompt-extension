#!/usr/bin/env node
// VibeDesign — DESIGN.md from a captured token bundle.
//
//   node scripts/build-design-md.js tokens.json --tier pro > DESIGN.md
//
// Capture tokens.json with the "Copy raw tokens JSON" dev button in an
// unpacked build (see tests/fixtures/README.md), then iterate on the builder
// offline without re-running the extension.
//
// Options:
//   --tier free|pro        default: free
//   --scope page|component default: page
//   --url <url>            override the source URL (default: tokens.url)
//   --date YYYY-MM-DD      "observed on" date; omit for reproducible output
//   --version <v>          recorded in generated_by (default: manifest version)
//
// Writes the document to stdout; diagnostics go to stderr so redirection is clean.

const fs = require('fs');
const path = require('path');

const build = require(path.join(__dirname, '..', 'lib', 'design-md-builder.js'));

function fail(msg) {
  process.stderr.write('error: ' + msg + '\n');
  process.stderr.write('usage: node scripts/build-design-md.js <tokens.json> [--tier free|pro] '
    + '[--scope page|component] [--url URL] [--date YYYY-MM-DD] [--version V]\n');
  process.exit(1);
}

function parseArgs(argv) {
  const out = { file: null, tier: 'free', scope: 'page', url: null, date: null, version: null };
  const FLAGS = { '--tier': 'tier', '--scope': 'scope', '--url': 'url', '--date': 'date', '--version': 'version' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (FLAGS[a]) {
      const v = argv[++i];
      if (v === undefined) fail(`${a} needs a value`);
      out[FLAGS[a]] = v;
    } else if (a === '-h' || a === '--help') {
      fail('help');
    } else if (a.startsWith('-')) {
      fail(`unknown option ${a}`);
    } else if (out.file === null) {
      out.file = a;
    } else {
      fail('only one tokens file may be given');
    }
  }
  if (!out.file) fail('a tokens JSON file is required');
  if (out.tier !== 'free' && out.tier !== 'pro') fail(`--tier must be free or pro, got "${out.tier}"`);
  if (out.scope !== 'page' && out.scope !== 'component') fail(`--scope must be page or component, got "${out.scope}"`);
  if (out.date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(out.date)) fail('--date must be YYYY-MM-DD');
  return out;
}

function manifestVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8')).version;
  } catch (e) {
    return 'dev';
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  let raw;
  try {
    raw = fs.readFileSync(args.file, 'utf8');
  } catch (e) {
    fail(`cannot read ${args.file}: ${e.message}`);
  }

  let tokens;
  try {
    tokens = JSON.parse(raw);
  } catch (e) {
    fail(`${args.file} is not valid JSON: ${e.message}`);
  }
  if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) {
    fail(`${args.file} should contain a token object`);
  }

  const md = build.buildDesignMd(tokens, {
    tier: args.tier,
    scope: args.scope,
    sourceUrl: args.url || tokens.url || '',
    version: args.version || manifestVersion(),
    observedAt: args.date,
  });

  process.stdout.write(md);
  process.stderr.write(`built ${args.tier} ${args.scope} DESIGN.md — ${md.length} chars\n`);
}

main();

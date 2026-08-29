#!/usr/bin/env bash
# VibeDesign — build the Chrome Web Store zip.
#
#   ./scripts/package.sh
#
# Runs scripts/verify.sh first and refuses to build if anything there fails:
# a zip is the one artefact nobody re-reads before uploading, so the checks
# have to happen on the way in.
#
# The zip contains only what the extension loads at runtime. Everything that
# exists for development — tests, fixtures, docs, scripts, the hooks, this
# file, CLAUDE.md — is left out, both to keep the package small and because
# shipping a test fixture means shipping whatever was captured into it.
set -uo pipefail
cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./manifest.json').version")
OUT="dist/vibedesign-${VERSION}.zip"

echo "════ verify"
if ! ./scripts/verify.sh; then
  echo
  echo "package.sh: refusing to build — verify.sh failed"
  exit 1
fi

echo
echo "════ package"
rm -rf dist/stage "$OUT"
mkdir -p dist/stage

# An allowlist, not an ignore list. A new top-level file is left OUT until
# someone adds it here, which is the safe direction to fail in.
INCLUDE=(
  manifest.json
  background.js content.js
  popup.html popup.js popup.css
  sidepanel.html sidepanel.js
  lib icons
)
for item in "${INCLUDE[@]}"; do
  if [ ! -e "$item" ]; then echo "  ✗ missing: $item"; exit 1; fi
  cp -R "$item" dist/stage/
done

# Anything that slipped in via a copied directory.
find dist/stage \( -name '*.map' -o -name '*.test.js' -o -name '.DS_Store' \) -delete
rm -rf dist/stage/lib/hooks

# lib/data/google-fonts.json is the canonical catalogue, but only Node reads
# it — the browser gets the same list from its .js twin, because a classic
# <script> cannot read JSON. Shipping both would carry 29KB twice.
rm -f dist/stage/lib/data/google-fonts.json
# icons/logo-light.png is the untrimmed source of icons/wordmark.png. The
# panel renders the trimmed one; nothing loads this.
rm -f dist/stage/icons/logo-light.png

# Prove the runtime files that DID ship are enough: the font catalogue has to
# be reachable the way the browser reaches it.
node -e '
  const fs=require("fs"), vm=require("vm");
  const box={}; box.self=box; vm.createContext(box);
  vm.runInContext(fs.readFileSync("dist/stage/lib/data/google-fonts.js","utf8"), box);
  const n=(box.self.VD_GOOGLE_FONTS||[]).length;
  if (n < 1000) { console.log("  ✗ the staged font catalogue has only "+n+" families"); process.exit(1); }
  console.log("  ✓ the staged font catalogue loads as a plain script ("+n+" families)");
' || exit 1

echo "  staged $(find dist/stage -type f | wc -l | tr -d ' ') files"

echo
echo "════ what must not be in the package"
staged_fail=0
for forbidden in tests docs scripts .git node_modules CLAUDE.md fixtures; do
  if [ -e "dist/stage/$forbidden" ]; then echo "  ✗ $forbidden is in the package"; staged_fail=1
  else echo "  ✓ no $forbidden"; fi
done
if find dist/stage -name '*.map' | grep -q .; then echo "  ✗ source maps present"; staged_fail=1
else echo "  ✓ no source maps"; fi

# The guards from verify.sh, re-run against the STAGED tree — the thing that
# actually ships, not the working copy it was built from.
if grep -rqE "sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{32,}|AIza[A-Za-z0-9_-]{30,}" dist/stage 2>/dev/null; then
  echo "  ✗ a key-shaped string is inside the package"
  grep -rnE "sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{32,}|AIza[A-Za-z0-9_-]{30,}" dist/stage | head -5 | sed 's/^/      /'
  staged_fail=1
else echo "  ✓ no key-shaped strings"; fi

staged_ver=$(node -p "require('./dist/stage/manifest.json').version")
if [ "$staged_ver" != "$VERSION" ]; then
  echo "  ✗ the staged manifest says $staged_ver but the zip will be named $VERSION"; staged_fail=1
else echo "  ✓ staged manifest version $staged_ver"; fi

# The Developer section must be unreachable in a packaged build. It is gated
# on isUnpackedBuild(), which reads update_url — so the gate has to survive
# into the staged copy, and nothing may force it on.
if ! grep -q "update_url" dist/stage/lib/ui-helpers.js; then
  echo "  ✗ the staged build no longer gates dev tools on update_url"; staged_fail=1
elif grep -rqE "VD_DEV_OVERRIDE|forceUnpacked|__vdDev" dist/stage; then
  echo "  ✗ a dev override is present in the staged build"; staged_fail=1
else echo "  ✓ dev tools stay gated on update_url, with no override"; fi

if [ "$staged_fail" -ne 0 ]; then
  echo
  echo "package.sh: refusing to build — the staged tree failed its checks"
  rm -rf dist/stage
  exit 1
fi

echo
echo "════ zip"
( cd dist/stage && zip -qr "../vibedesign-${VERSION}.zip" . -x '.*' ) || { echo "zip failed"; exit 1; }
rm -rf dist/stage

if [ ! -f "$OUT" ]; then echo "package.sh: the zip was not produced"; exit 1; fi
echo "  $OUT — $(du -h "$OUT" | cut -f1)"
echo
echo "════ listing"
unzip -l "$OUT"
echo
echo "════ the zip itself"
if unzip -p "$OUT" '*' 2>/dev/null | grep -qE "sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{32,}|AIza[A-Za-z0-9_-]{30,}"; then
  echo "  ✗ a key-shaped string survived into the zip"; exit 1
else echo "  ✓ no key-shaped strings in the zip"; fi
unzip -tq "$OUT" && echo "  ✓ the archive is readable"

# The version INSIDE the finished zip against the name ON it. This is the
# check that catches a stale artefact: a zip whose filename says one release
# and whose manifest says another is the kind of thing that gets uploaded to
# the store and then cannot be explained.
zip_ver=$(unzip -p "$OUT" manifest.json | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).version")
name_ver=$(basename "$OUT" .zip | sed 's/^vibedesign-//')
if [ "$zip_ver" != "$name_ver" ]; then
  echo "  ✗ the zip is named $name_ver but its manifest says $zip_ver"
  exit 1
fi
echo "  ✓ the manifest inside the zip ($zip_ver) matches its filename"
echo
echo "package.sh: $OUT"

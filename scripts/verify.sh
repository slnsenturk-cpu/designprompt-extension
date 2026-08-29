#!/usr/bin/env bash
# VibeDesign — pre-package verification.
#
#   ./scripts/verify.sh
#
# Everything here must pass before a zip is built. Each check prints what it
# found, not just whether it passed: a release check that only says "ok" is a
# check nobody can audit afterwards.
set -uo pipefail
cd "$(dirname "$0")/.."

fail=0
note() { printf '  %s\n' "$*"; }
bad()  { printf '  ✗ %s\n' "$*"; fail=1; }
good() { printf '  ✓ %s\n' "$*"; }

echo "── working tree"
if [ -n "$(git status --porcelain)" ]; then
  bad "uncommitted changes — a zip built from a dirty tree cannot be reproduced"
  git status --short | sed 's/^/      /'
else
  good "clean at $(git rev-parse --short HEAD)"
fi

echo
echo "── git hooks"
hooks=$(git config --get core.hooksPath || true)
if [ "$hooks" = "scripts/hooks" ]; then good "core.hooksPath = $hooks"
else bad "core.hooksPath is '${hooks:-unset}', expected scripts/hooks"; fi

echo
echo "── test suite"
if out=$(node --test --test-timeout=90000 tests/*.test.js 2>&1); then
  # node --test prefixes its summary with a non-ASCII glyph; match the words.
  good "$(echo "$out" | grep -oE 'tests [0-9]+' | tail -1) · $(echo "$out" | grep -oE 'pass [0-9]+' | tail -1)"
else
  bad "suite failed"
  echo "$out" | grep -E '^✖|not ok' | head -10 | sed 's/^/      /'
fi

echo
echo "── manifest"
ver=$(node -p "require('./manifest.json').version")
desc=$(node -p "require('./manifest.json').description.length")
note "version $ver · description $desc chars"
[ "$desc" -le 132 ] && good "description within the store's 132-char limit" \
                    || bad "description is $desc chars, the store allows 132"
node -e '
const m=require("./manifest.json");
if (m.web_accessible_resources) { console.log("  ✗ web_accessible_resources is back"); process.exit(1); }
if ((m.host_permissions||[]).some(h=>h.includes("<all_urls>"))) {
  console.log("  ✗ <all_urls> is in host_permissions — the install will warn about all sites");
  process.exit(1);
}
if (!(m.optional_host_permissions||[]).includes("<all_urls>")) {
  console.log("  ✗ <all_urls> is not in optional_host_permissions — page access could not be asked for");
  process.exit(1);
}
console.log("  ✓ site access is optional, not granted at install");
' || fail=1

echo
echo "── dev affordances cannot reach a packaged build"
# A packaged build has update_url in its manifest; an unpacked one does not.
# The Developer section is gated on that, and nothing may bypass the gate.
if grep -q "update_url" lib/ui-helpers.js; then good "isUnpackedBuild() reads update_url"
else bad "isUnpackedBuild() no longer checks update_url"; fi
if grep -nE "settingsDev|devTokensJsonBtn" lib/ui-helpers.js | grep -qv "isUnpackedBuild"; then
  gate=$(node -e '
    const s=require("fs").readFileSync("lib/ui-helpers.js","utf8");
    const g=s.indexOf("if (isUnpackedBuild())");
    const d=s.indexOf("settingsDev");
    process.stdout.write(g !== -1 && d > g ? "ok" : "bad");
  ')
  [ "$gate" = "ok" ] && good "the Developer section is only built inside the isUnpackedBuild() branch" \
                     || bad "the Developer section is reachable outside the unpacked gate"
fi
if grep -rn "VD_DEV_OVERRIDE\|forceUnpacked\|__vdDev" --include='*.js' lib/ *.js 2>/dev/null | grep -v node_modules | grep -q .; then
  bad "a dev override exists that could switch the gate on in a packaged build"
  grep -rn "VD_DEV_OVERRIDE\|forceUnpacked\|__vdDev" --include='*.js' lib/ *.js | sed 's/^/      /'
else
  good "no dev override that could flip the gate"
fi

echo
echo "── credentials"
# Provider key shapes and anything that looks like a JWT secret.
hits=$(grep -rnE "sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{32,}|AIza[A-Za-z0-9_-]{30,}" \
        --include='*.js' --include='*.json' --include='*.html' --include='*.css' \
        . 2>/dev/null | grep -v node_modules | grep -v '^\./tests/' || true)
if [ -n "$hits" ]; then bad "key-shaped strings found:"; echo "$hits" | sed 's/^/      /'
else good "no key-shaped strings outside tests/"; fi

# lib/config.js is a classic script — it assigns to `self`, so require() gets
# nothing back. Run it in a sandbox with a `self` to read the key out.
role=$(node -e "
  const vm=require('vm'), fs=require('fs');
  const box={}; box.self=box; vm.createContext(box);
  vm.runInContext(fs.readFileSync('lib/config.js','utf8'), box);
  const k=(box.self.VD_CONFIG||{}).SUPABASE_ANON_KEY||'';
  const p=k.split('.')[1]||'';
  try { process.stdout.write(JSON.parse(Buffer.from(p,'base64').toString()).role||'?'); }
  catch(e){ process.stdout.write('unreadable'); }
" 2>/dev/null || echo unreadable)
[ "$role" = "anon" ] && good "the Supabase key is the anon key" \
                     || bad "the Supabase key's role is '$role', expected anon"

echo
echo "── font catalogue"
if node scripts/update-google-fonts.mjs --check >/dev/null 2>&1; then
  good "lib/data/google-fonts.json is current"
else
  note "⚠ the catalogue is stale or the network is unavailable — regenerate with:"
  note "  node scripts/update-google-fonts.mjs"
fi

echo
if [ "$fail" -eq 0 ]; then echo "verify.sh: PASS"; else echo "verify.sh: FAIL"; fi
exit "$fail"

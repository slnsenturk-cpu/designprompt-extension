# Release Checklist

Run through this before packing a zip for the Chrome Web Store. The key-safety
section is non-negotiable: a leaked provider key is the one bug in this
extension that costs a user real money and can't be undone by a patch release.

## Key safety

The invariant: **a user's provider API key never leaves the device except in a
request to that provider.** Keys live in `chrome.storage.local` under `apiKeys`
and are read only to build the outbound provider request.

### 1. No hardcoded keys anywhere

```bash
git grep -n -I -E "sk-ant-[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{20,}|gsk_[A-Za-z0-9]{20,}|xai-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}" -- . ':!docs/'
```

Must print nothing. This covers code, config, tests, and fixtures. `docs/` is
excluded because this file quotes the patterns themselves; the test fixtures in
`tests/cloud-sync-no-keys.test.js` build their key-shaped strings by
concatenation at runtime for the same reason, so they stay in scope here.

Placeholders and test dummies are fine and expected — the UI placeholders
(`'sk-ant-...'`, `'AIza...'` in `lib/ui-helpers.js`) and the test literals
(`'sk-ant-test'`, `'AIza-test'`) are deliberately too short to match above.

Also check the packed zip itself, since it's built outside git:

```bash
unzip -p store/vibedesign-*.zip '*' | grep -a -o -E "sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{32,}|AIza[A-Za-z0-9_-]{30,}"
```

### 2. Supabase key is the anon key, not service_role

`lib/config.js` ships one public key by design. Confirm its role claim:

```bash
node -e 'const m=require("fs").readFileSync("lib/config.js","utf8").match(/SUPABASE_ANON_KEY:\s*.([A-Za-z0-9_.-]+)./);console.log(JSON.parse(Buffer.from(m[1].split(".")[1],"base64")).role)'
```

Must print `anon`. If it ever prints `service_role`, **stop** — that key
bypasses row-level security and must be rotated in the Supabase dashboard, not
just removed from the file.

### 3. Keys stay out of cloud sync

```bash
node --test tests/cloud-sync-no-keys.test.js
```

All tests must pass. This suite drives the real `lib/cloud-sync.js` against a
fake Supabase client with deliberately poisoned input and asserts that no
key-shaped field or value reaches an `insert()` payload — on `syncAnalysis`,
`syncPrompt`, and the one-shot `migrateAnonymousHistory`.

It enforces a strict column allowlist, so **adding a column to `analyses` or
`prompts` will fail the test on purpose**. When that happens, add the field to
the allowlist in the test and confirm by hand that it cannot carry a key.

Manual confirmation of the same invariant:

```bash
grep -n -i "apikey" lib/cloud-sync.js   # must print nothing
```

### 4. Keys only ever go to the three provider hosts

```bash
git grep -n "fetch(" -- . ':!lib/supabase.min.js' ':!tests/' ':!docs/'
```

Every result must target a hardcoded literal host, and only one of:

| Host | Used by |
|---|---|
| `api.anthropic.com` | Claude completions + model list |
| `api.openai.com` | OpenAI completions + model list |
| `generativelanguage.googleapis.com` | Gemini completions + model list |
| `<SUPABASE_URL>` | Auth token refresh only — carries the anon key and the user's own refresh token, **never** a provider key |

Two files carry user keys and both must stay on this list:
`lib/ai-caller.js` (completions) and `lib/model-discovery.js` (model lists).

Watch for a host built from a variable or from stored data — every host must be
a literal in the source.

### 5. Storage areas

```bash
git grep -n "storage\.sync\|storage\.session" -- . ':!lib/supabase.min.js' ':!docs/'
```

Must print nothing. `chrome.storage.sync` replicates through the user's Google
account, so a key written there leaves the device. Keys belong in
`chrome.storage.local` only.

## Token refresh

The invariant: **the service worker is the only component that mints tokens,
and it never has two refreshes in flight.** Supabase refresh tokens are
single-use — presenting a spent one returns `Invalid Refresh Token: Already
Used`, and gotrue-js reacts by calling `_removeSession()`, silently signing the
user out.

```bash
node --test tests/auth-refresh.test.js
```

All tests must pass. Then check the three things the tests can't see:

### 1. No new refresh path

```bash
git grep -n "auth\.getUser()\|auth\.getSession(\|auth\.refreshSession(" -- . ':!lib/supabase.min.js' ':!tests/' ':!docs/'
```

Must print nothing. A **bare** `getUser()` / `getSession()` routes through
gotrue-js `__loadSession()`, which refreshes whenever the token is within
`EXPIRY_MARGIN` (90 s) of expiring. That path is **not** gated by
`autoRefreshToken: false` — that flag only stops the background timer. Always
pass the JWT explicitly: `getUser(sess.access_token)` is a plain
`GET /auth/v1/user` and cannot refresh.

### 2. Alarm period stays inside the leeway

`REFRESH_ALARM_PERIOD_MIN` must be **≤** `REFRESH_LEEWAY_MS` in
`lib/config.js`. The alarm only refreshes while the token is inside the leeway
window; if the period is longer than that window, the alarm can step straight
over it and the token lapses. (`tests/auth-refresh.test.js` pins this.)

### 3. One writer, checked by hand after any auth change

Only `lib/auth.js#refreshTokenIfNeeded` may POST to
`/auth/v1/token?grant_type=refresh_token`, and it must stay single-flight.
Everything else asks the service worker via
`chrome.runtime.sendMessage({ type: 'VD_REFRESH_TOKEN' })`.

Known residual: the SDK reaches `getSession()` internally from
`_getAccessToken()` on every PostgREST call, so a `from(...)` query *can* still
refresh if the token is ever inside 90 s of expiry. That's mitigated by timing
(the SW refreshes at a 5 min cadence with a 10 min leeway, so the token should
never get that close) rather than structurally — supabase-js's `accessToken`
client option would close it properly but replaces `supabase.auth` with a
throwing proxy, which breaks `setSession`, `signOut`, and
`onAuthStateChange`. If "Already Used" ever resurfaces, this is the path to
investigate first.

## Standard release steps

- [ ] Bump `version` in `manifest.json`.
- [ ] Full test suite green: `node --test tests/*.test.js`
- [ ] Load unpacked in Chrome and smoke-test: analyze a page, generate a prompt,
      switch provider tabs, sign in / sign out.
- [ ] Confirm `store/description.txt` and `PRIVACY.md` still match what ships.
- [ ] Pack the zip, then re-run the zip scan in step 1 against it.
- [ ] Tag the release commit so the published build is identifiable later
      (`git tag v<version>`) — the store zip alone is easy to lose track of.

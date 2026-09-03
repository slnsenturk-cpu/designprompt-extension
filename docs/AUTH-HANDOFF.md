# Shared sign-in: vibedesign.tech ↔ the extension

Signing in on the site signs the extension in, and signing out of either ends
both. This document is the contract the **web side** implements.

---

## The rule that shapes everything else

**The two never share a refresh token.**

Supabase refresh tokens are single-use. Two clients holding the same one spend
each other's, and the loser is told *"Invalid Refresh Token: Already Used"* —
which the SDK answers by wiping the session. That is a spurious sign-out with
no cause the user can see, and this repository already carries a suite against
it (`tests/auth-refresh.test.js`).

So the site and the extension hold **two independent sessions for the same
user**. They are linked by a one-time hash: the site mints it, hands it over
once, and the extension exchanges it for a session of its own that it then
refreshes on its own schedule.

If a `refresh_token` ever appears in a message below, that is the bug.

---

## Messages

Sent with `chrome.runtime.sendMessage(EXTENSION_ID, message, callback)` from a
page on `https://vibedesign.tech`.

The extension refuses every message from any other origin — including
subdomains and plain HTTP — and replies `{ ok: false, error: 'origin-not-allowed' }`.
Checked against `sender.origin`, not a URL prefix.

### `VD_EXT_STATUS`

Ask what is installed and who is signed in. Safe to call on page load.

```js
chrome.runtime.sendMessage(EXTENSION_ID, { type: 'VD_EXT_STATUS' }, (res) => {
  if (chrome.runtime.lastError || !res) return;   // not installed
  // res = { installed: true, version: '3.0.3', signedInAs: 'user@example.com' | null }
});
```

`signedInAs` is `null` when the extension has no session. Use it to decide
whether a handoff is needed at all.

### `VD_EXT_LOGIN`

Hand over a one-time hash after the user signs in on the site.

```js
// On the site, after its own sign-in succeeds:
const { data, error } = await supabase.auth.signInWithOtp({
  email: user.email,
  options: { shouldCreateUser: false },
});
// Take the token_hash the site received and pass it on — once.

chrome.runtime.sendMessage(EXTENSION_ID, {
  type: 'VD_EXT_LOGIN',
  tokenHash,                 // string, 16–512 chars
  email: user.email,         // advisory only, see below
}, (res) => {
  // res = { ok: true, signedInAs: 'user@example.com', type: 'magiclink' }
  //   or { ok: false, error: 'Email link is invalid or has expired', code: 'verify-403' }
  // `error` is always the exact message — the auth server's own wording for a
  // rejected hash, or the extension's sentence for a local failure. `code` is
  // the short machine tag. A success never carries signedInAs: null.
});
```

The extension calls `POST /auth/v1/verify` with
`{ token_hash, type: 'magiclink' }`. Our GoTrue (v2.196.0, probed 2026-09-03)
accepts both `magiclink` and `email` for a magic-link hash and answers an
unknown type with `400 "Invalid email verification type"` — that one reply,
and only that one, makes the extension retry with `email`. An expired or
invalid hash (`403 otp_expired`) is final under either type. If the verify
reply carries no `user`, the identity is read from `GET /auth/v1/user` with
the new access token before anything is stored; a session that cannot name
its user is refused (`code: 'no-identity'`), never stored as "signed in as
nobody". Then the session is stored, the panel updated, and a `✓` flashed on
the toolbar icon for ten seconds.

Every failure — missing `tokenHash`, a rejected hash, a storage write that
throws — is logged once in the service-worker console with a `[vd-handoff]`
prefix, with the same message the reply carries.

**`email` is advisory.** The reply reports the address the *token* resolved
to. If the two disagree, the token wins — it is the only half the auth server
vouched for. Do not rely on the extension echoing what you sent.

Error codes (`code`; `error` carries the exact message): `origin-not-allowed`,
`bad-token-hash` (missing or malformed — never sent to the server),
`verify-<status>` (the server's own `msg`), `malformed` (a 200 with no tokens
in it), `no-identity` (no user email, even from `/auth/v1/user`), `identity`
(that lookup threw), `storage` (the session could not be written), `network`,
`auth-unavailable`, `internal`.

### Dev builds: the bridge, or direct when the server allows it

An unpacked build (`isUnpackedBuild()`: no `update_url` in the manifest) has
an extension id the site does not know, so the store build's `/login` flow
cannot reach it. Its Sign in button:

1. **Preflights the direct flow** — `VD_AUTH.preflightDirectAuth('google')`
   fetches `<SUPABASE_URL>/auth/v1/authorize?provider=google&redirect_to=<chrome.identity redirect URL>`
   with `redirect: 'manual'`. A redirect means the URL works; a 4xx body says
   why not. Both are logged under `[vd-auth]`.
2. **If it works**, `openAuthFlow('login', { direct: true })` runs
   `chrome.identity.launchWebAuthFlow` on that URL. The authorize URL, the
   redirect URL and any `chrome.runtime.lastError` are logged.
3. **Otherwise** (the default today) it opens a normal tab to the **bridge
   page** `https://vibedesign.tech/auth/extension-callback?ext=<extension id>&from=extension`.

The caption under the button reads `DEV · bridge sign-in`. Sign-out in a dev
build is `scope: 'local'`; a packaged build keeps the `/login` flow (now with
`&ext=<id>` appended) and the global sign-out.

**Why not direct, as of 2026-09-03.** Against our project the authorize URL
answers `400 {"error_code":"validation_failed","msg":"Unsupported provider: missing OAuth secret"}`
with or without an `apikey`; `/auth/v1/settings` lists `google: true` but no
OAuth client secret is configured. In Chromium (Playwright, unpacked
extension) `launchWebAuthFlow` on that URL fails in ~130 ms with
`"Authorization page could not be loaded."` and opens no window — the exact
error seen in the panel; a control URL that loads opens the window and waits.
The failure is the server's answer, not a lost user gesture. To enable the
direct flow: add a Google OAuth client id + secret to the Supabase project
and put `https://<extension-id>.chromiumapp.org/` in its allowed redirect
URLs; the preflight then sees a redirect and the panel switches over by
itself.

### The bridge page — what `vibedesign.tech/auth/extension-callback` must do

Route: `/auth/extension-callback?ext=<id>&from=extension`. Same origin as the
apex, so the extension's existing origin gate admits it.

1. Read `ext` from the query and validate it: exactly 32 characters `a`–`p`
   (`/^[a-p]{32}$/`). Refuse anything else — this is the id the session will
   be sent to.
2. If the user is not signed in, send them through the site's normal sign-in
   with `next=/auth/extension-callback?ext=<id>&from=extension`, so they come
   back here afterwards.
3. Mint a one-time magic-link hash for the signed-in user. This is a
   server-side call (an edge function using the service-role key):
   `supabase.auth.admin.generateLink({ type: 'magiclink', email })` and return
   `properties.hashed_token` to the page. Never expose the service-role key
   to the browser; the function must derive `email` from the caller's own
   session, not from a parameter.
4. Post it to the extension:

   ```js
   chrome.runtime.sendMessage(ext, { type: 'VD_EXT_LOGIN', tokenHash, email }, (res) => {
     if (chrome.runtime.lastError) { /* extension not installed / not this id */ }
     // res = { ok: true, signedInAs, type } | { ok: false, error, code }
   });
   ```

   `chrome.runtime.sendMessage` from a web page requires the site's origin in
   the extension's `externally_connectable.matches` — `https://vibedesign.tech/*`
   is already there. The extension replies with the exact error message on
   failure (see above); show `error` verbatim.
5. Show the result on the page: signed in as `res.signedInAs` — or the error.
   Optionally close the tab after a moment on success.

The extension side needs no change for this: `VD_EXT_LOGIN` is accepted from
the apex origin only, as today, and the reply contract is the one above.

### One read for "who is signed in?"

`VD_AUTH.readAccount()` is the only definition of signed-in, and both the
worker's `VD_EXT_STATUS` reply and the panel header use it: a stored session
with both tokens, not past `expires_at`, naming a user email. It returns
`{ authed, email, avatarUrl, expiresAt, reason }` — `reason` is `no-session`,
`expired`, `no-email` or `read-failed` when `authed` is false. Before this
the worker and the panel each had their own rule and could disagree about the
same `chrome.storage.local`.

The open panel also re-reads on `chrome.storage.onChanged` for the session
key, so a handoff, a refresh or a sign-out shows up without a runtime
message having to arrive.

The panel's 30-second server check (`sidepanel.js`) logs every reply as
`[vd-auth] server check: GET /auth/v1/user → <status> <msg>` and, when the
server says the session is gone, clears the extension's local session only.
It used to call `signOut()`, which revokes globally — one rejected GET logged
the user out of vibedesign.tech too.

**Evidence from either console:** `VD_AUTH.dumpAuthStorage()` prints every
auth-shaped key in `chrome.storage.local` with tokens redacted, how each is
stored (object or JSON string), and what `readAccount()` makes of it. Run it
in the service-worker console and in the side panel's console and compare.

### `VD_EXT_LOGOUT`

Tell the extension the site's session has ended.

```js
chrome.runtime.sendMessage(EXTENSION_ID, { type: 'VD_EXT_LOGOUT' }, (res) => {
  // res = { ok: true }
});
```

The extension clears its **local** session only. It deliberately does not
revoke anything server-side here: the site is reporting what it already did,
and reaching back would be the extension signing the user out of a browser
that just told it what happened. Calling this while nobody is signed in is not
an error.

### `{ ping: true }`

The pre-3.0 detection message, unchanged: `{ pong: true, version }`.

---

## The other direction

The extension's own **Sign out** calls
`POST /auth/v1/logout?scope=global`, which revokes every session for that
user — including the site's. The site's existing server auth check sees a
revoked token on its next poll and drops to signed-out on its own. No message
is needed.

If the revocation request fails, the extension still clears locally. A network
blip must not leave someone signed in on a machine they just signed out of.

The extension's **Sign in** button opens
`https://vibedesign.tech/login?from=extension` in a new tab and lets the site
run the handoff. `chrome.identity.launchWebAuthFlow` remains as a fallback for
when the site cannot be reached at all, so an outage does not leave the
extension with no way in.

---

## What the site needs to know

- **Extension ID.** Publish it in the site's config; the extension does not
  announce itself.
- **`externally_connectable`** in `manifest.json` permits `vibedesign.tech`
  and its subdomains to open a channel, but the message handler accepts only
  the apex origin. A staging subdomain can ping; it cannot sign anyone in.
- **`chrome.runtime.lastError`** must be read in every callback. It is how you
  learn the extension is absent, and ignoring it logs an unchecked-error
  warning on every call.
- **The hash is one-time.** Mint a fresh one per handoff. A replayed hash
  returns `verify-401` or `verify-403`.
- **Do not send the site's own session.** Not the access token, and above all
  not the refresh token. See the top of this file.

---

## Testing it

`tests/auth-handoff.test.js` boots the real service worker with the real
`lib/auth.js` and exercises all three messages, including:

- five hostile origins, among them `https://vibedesign.tech.evil.com` — the
  string a `startsWith` check accepts;
- an origin that is not the apex being unable to read `signedInAs`;
- a token hash that resolves to a different address than the message claimed;
- malformed hashes never reaching the auth server;
- global revocation on the extension's own sign-out, and a local clear even
  when that revocation fails.

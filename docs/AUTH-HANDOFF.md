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
  // res = { installed: true, version: '3.0.2', signedInAs: 'user@example.com' | null }
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

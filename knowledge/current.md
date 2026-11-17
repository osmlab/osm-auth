# Current work

## Convert to TypeScript (Nov 2026)

On the `typescript_conversion` branch. Plan and decisions are in
[`design/osm-auth.md`](../design/osm-auth.md). Ships in 4.0.0 with the ESM-only change already on `main`.

Steps 1–7 are done: the class rewrite, generated types, tests and docs. Once that merges, the bug
fixes below follow on `main`.

The demo page loads `osm-auth@latest/dist/js/…` from the CDN, so it's broken from when this merges
until 4.0.0 is on npm. That's expected.

## Bugs to fix in 4.0.0

Items 1–9 were found while reading the 3.x source. Items 10–22 were found by `/bughunt`
(16 Nov 2026) across everything since v3.2.0, with repros (scratch tests, not committed); those
carry a severity, and are pre-existing in 3.x unless marked **new**. The numbers are stable IDs,
grouped by what the fix touches.

One commit each. Each fix changes the tests that cover the current behavior (items 2 and 3 have
them; 1 and 9 have none yet, so add them first), and adds its line to the 4.0.0 entry in
`CHANGELOG.md`.

### Library runtime

- **1. `xhr()` with `auto: true` ignores a failed login.** It calls `authenticate(_doXHR)`, but
  `_doXHR` takes no arguments, so after a blocked popup or a denied login it sends the request
  anyway without a token, and the caller never sees the login error.
- **2. `xhr()`'s "not authenticated" error is a string**, where `fetch()` rejects with an `Error`.
  (It also returned `undefined` rather than the documented `null` when it didn't send a request;
  the class returns `null`.)
- **3. Errors come in four shapes.** Replace them with `OSMAuthError` (see
  [Errors in the design doc](../design/osm-auth.md#errors-one-osmautherror-class)), and type the
  callbacks' `err` as `OSMAuthError | null`. It's `any` until then, as in 3.x (`unknown` broke
  typed callers).
- **4. `fetch()` and `rawxhr()` add the `Authorization` header to the caller's own objects.**
  Copy the headers instead.
- **5. Single-page mode opens a BroadcastChannel it never uses**, and never closes it.
  `_authenticate` creates the channel after redirecting or calling `bootstrapToken`, for both of
  which nothing will ever post to it.
- **7. `utilStringQs` doesn't decode `+` as a space**, and throws on a malformed `%` escape.
  `URLSearchParams` does both properly and would replace both helpers. The `+` workaround for
  `error_description` could go too.
- **9. A token response without an `access_token` counts as success.** The callback gets
  `(null, auth)`, but nothing was stored, so `authenticated()` is still `false`. It should fail.
- **11. `options()` round trips re-store `access_token`.** *High.* The resolved options keep it,
  the getter copies it out, and the setter calls `preauth()` with it. With iD's
  `options({ ...options(), locale })` that logs a user back in after `logout()`, overwrites a
  newer token with the constructor's, or stores it under the new server's key when switching
  `url`. Fix: preauth from the caller's object, and don't keep `access_token` in `_options`.
- **13. `bootstrapToken` reads `state` from `window.location`, not from the caller.** *Medium.*
  It fails if the app cleaned the URL before calling it. A failed state check leaves the PKCE
  verifier in storage. Nothing stored plus `?state=` (empty) passes the check and sends an empty
  verifier.
- **14. The token exchange reads the options when the redirect lands, not when the login
  started.** *Medium.* Change `url` mid-login and server A's code goes to server B, and the token
  is stored under B.
- **15. Ways a login never calls back.** *Medium.* A 200 token response that isn't JSON
  (`JSON.parse` throws in `onreadystatechange`, after `done()`); `localStorage.setItem` throwing
  (quota) while saving the token (and the constructor throws with `access_token`); no
  `crypto.subtle` (insecure context) throws after opening a blank popup, and a rejected `digest`
  is never caught; the user closing the popup (the old TODO); `rawxhr` on abort or timeout
  (status 0, no `onerror`).
- **16. `fetch()` headers, beyond item 4.** *Medium.* A `Headers` instance or `[[k, v]]` array
  gets `Authorization` as a plain property, so it's never sent. A lowercase `authorization` gets
  joined (`Bearer old, Bearer new`). A `Request` resource has its headers replaced by the
  default. The default `Content-Type: application/x-www-form-urlencoded` breaks `FormData`
  uploads (the boundary is lost, in `rawxhr` too) and mislabels JSON. Fix: build a `Headers`,
  `set('Authorization')`, and only default `Content-Type` for string or `URLSearchParams` bodies.
- **21. `utilStringQs` drops a pair whose value has a raw `=`.** *Low.* Fold into item 7.
- **22. `bringPopupWindowToFront()` is always `false`** once the popup reaches OSM: OSM's COOP
  header severs the opener's handle, so `popupWindow.closed` reads `true` while the popup is
  still open (confirmed in Chrome). *Medium.* So the demo's "bring the popup to the front instead
  of starting another login" never works, and since `window.open(…, 'oauth_window')` can't find
  the severed window by name either, a second click opens a second popup (and starts a second
  pending login, see 10).

### Library runtime, with docs to fix too

- **10. Any BroadcastChannel message ends every pending login.** *High, new.* The listener closes
  and reports `invalid-state` on a message with someone else's `state`. So with two pending logins
  (a second instance for another server, another tab, a double click, an `auto` `fetch()` called
  twice), the first to land fails the other, and the other's real landing is then ignored. The
  close-on-any-message fix in this batch turned 3.x's spurious error (then success) into a lost
  login. Confirmed in Chrome: two clicks open two popups (see 22); authorizing in both gives one
  `invalid-state` and one success, and the second authorization is silently dropped (the popup
  closes, no token request). An abandoned popup also leaves its listener, which fires `invalid-state` at its old
  callback when the next login lands. Fix: ignore messages whose `state` isn't ours, and keep one
  pending login per instance that concurrent calls share. **Docs:** the changelog line "A failed
  attempt left a listener behind" overclaims.
- **12. Single-page return handling.** *Medium.* Any `code=` in the page URL is taken as OSM's
  redirect, so after login → `logout()` → login with `?code` still in the URL, every attempt fails
  `invalid-state`. A return with `?error=` isn't reported: `authenticate()` saves a new state and
  redirects to the authorize page again. **Docs:** the README's single-page example never cleans
  `?code` out of the URL.

### Test gaps

`FakeXHR` fires `readystatechange` only at readyState 4 and allows `setRequestHeader` before
`open`, so dropping the readyState check or moving the header loop passes the suite (9 of 13
mutations survived). Nothing covers: the channel closing, `authenticateAsync` rejecting,
the `fetch` after an `auto` login, a network error on the token request, 201/204, or an error
redirect with the wrong `state`.

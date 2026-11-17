# Current work

## Convert to TypeScript (Nov 2026)

On the `typescript_conversion` branch. Plan and decisions are in
[`design/osm-auth.md`](../design/osm-auth.md). Ships in 4.0.0 with the ESM-only change already on `main`.

Steps 1–7 are done: the class rewrite, generated types, tests and docs. Once that merges, the bug
fixes below follow on `main`.

The demo page loads `osm-auth@latest/dist/js/…` from the CDN, so it's broken from when this merges
until 4.0.0 is on npm. That's expected.

## Bugs to fix in 4.0.0

Found while reading the 3.x source. One commit each. Each fix changes the tests that cover the
current behavior (items 1–3 and 9 have them), and adds its line to the 4.0.0 entry in
`CHANGELOG.md`.

1. **`xhr()` with `auto: true` ignores a failed login.** It calls `authenticate(_doXHR)`, but
   `_doXHR` takes no arguments, so after a blocked popup or a denied login it sends the request
   anyway without a token, and the caller never sees the login error.
2. **`xhr()`'s "not authenticated" error is a string**, where `fetch()` rejects with an `Error`.
   (It also returned `undefined` rather than the documented `null` when it didn't send a request;
   the class returns `null`.)
3. **Errors come in four shapes.** Replace them with `OSMAuthError` (see
   [Errors in the design doc](../design/osm-auth.md#errors-one-osmautherror-class)).
4. **`fetch()` and `rawxhr()` add the `Authorization` header to the caller's own objects.**
   Copy the headers instead.
5. **Single-page mode opens a BroadcastChannel it never uses**, and never closes it.
   `_authenticate` creates the channel after redirecting or calling `bootstrapToken`, for both of
   which nothing will ever post to it.
6. **`authenticate` and `authenticateAsync` duplicate each other.** One should call the other.
   (The token exchange was written twice too; the class shares one `_accessTokenDone`.)
7. **`utilStringQs` doesn't decode `+` as a space**, and throws on a malformed `%` escape.
   `URLSearchParams` does both properly and would replace both helpers. The `+` workaround for
   `error_description` could go too.
8. **`docs/land_single.html` reads `oauth_token`**, which is OAuth 1. Nothing links to it, so it
   can probably be deleted.
9. **A token response without an `access_token` counts as success.** The callback gets
   `(null, auth)`, but nothing was stored, so `authenticated()` is still `false`. It should fail.

# Decisions

Choices that aren't obvious from the code. The 4.0.0 decisions are explained in full in
[`design/osm-auth.md`](../design/osm-auth.md#decisions); these are the short versions.

## `osmAuth` is a class, and `new` is required (4.0.0)

An instance holds state (the options, the token store, the popup) and has side effects in
`localStorage`, so it's a class rather than a factory that hides its state in closures. Callers
already used `new` (#148), and iD needs a one-line change. Rejected: keeping a factory that also
works with `new`.

## `client_secret` is not an option (4.0.0)

Nothing has read it since PKCE replaced it in v2.2.0 (June 2023), and a secret in browser code is
a no-op at best. Rapid still passes one by habit. Rejected: keeping it as `@deprecated` until 5.0.

## Bundles in `dist/js/`, declarations in `dist/ts/` (4.0.0)

Matches location-conflation and country-coder. It breaks unpinned CDN URLs, so the README tells
apps to pin `osm-auth@4`, and the changelog calls it out. The demo page loads `@latest` like the
sibling projects' demos, so it doesn't need a change every major release.

## Options are copied in and out (4.0.0)

The 3.x setter stored the caller's object and filled defaults into it, so callers and the instance
changed each other's options. Now the constructor and setter copy, and the getter returns a copy.

## Tests use hand-written stubs (4.0.0)

Bun has no `localStorage`, `XMLHttpRequest` or `window`. Small stubs in `test/stubs.ts` cover what
osm-auth uses, and let tests wait on a request or navigation instead of polling. Rejected:
`node-localstorage` (it was never installed as the global) and happy-dom (more than this needs).
The stubs follow the browser where osm-auth depends on it: `FakeXHR` goes through readyState 1–4,
only allows headers between `open` and `send`, and ends an error, timeout or abort with status 0
before the event. A looser stub let mutations that would break every real request pass.

## Every failure is an `OSMAuthError` (4.0.0)

3.x passed an `Error` with a string `status`, the failed `XMLHttpRequest`, a `ProgressEvent`, or a
string. Now `err.code` says what went wrong; `err.status` stays the numeric HTTP status (iD checks
401, 409, 429, 509) and `err.xhr` has the request. An `'http-error'` takes its message from a
`text/plain` body, which is how the OSM API explains errors, because iD's uploader shows
`err.message || err.responseText`. A failed token request is a plain `'http-error'` too, rather
than taking its code from the OAuth error in the body (#167, #180).

## Popup login attempts share one pending login (4.0.0)

OSM's `Cross-Origin-Opener-Policy` hides the popup from the opener (see `quirks.md`), so a second
click opens a second popup, and every same-origin page hears every `land.html` post. So an
instance keeps one pending login; each attempt adds its state, and the redirect for any of them
ends the login for every caller. A redirect with another state is ignored, not reported as
`invalid-state`. Rejected: a listener per attempt that fails on any other state (3.x; it lost
logins) (#163).

## `access_token` isn't kept in the options (4.0.0)

The constructor and setter store it and drop it. Kept, it came back out of `options()`, so the
usual `options({ ...options(), locale })` stored it again after `logout()` or over a newer token.
A login also keeps the options it started with, so a `url` change mid-login can't send the code to
another server (#164).

## Real-browser testing with a debug Chrome

As in Rapid: `bun run start:chrome` runs the installed Chrome with its own gitignored profile, and
`bun run cdp` drives it over CDP with `playwright-core` (no browser download). The developer logs
in to an OSM test account in that profile by hand, so no password is ever in a file. It's for
checks the stubs can't make: real popups, COOP, BroadcastChannel, OSM's pages.

## The `browser` export condition stays

`package.json` lists `browser` → the IIFE after `import` and `require`, so no bundler ever selects
it. It's kept on purpose, as a pointer to the `<script>` build for people reading `package.json`.
Don't remove it as dead weight.

# osm-auth Design

This document describes what osm-auth is and how it works, and lays out the plan for 4.0.0:
converting it from JavaScript with hand-written types to a TypeScript class with generated types
(following node-diff3, location-conflation and country-coder), and fixing the bugs found along
the way.

> **Status:** In progress (Nov 2026): steps 1–7 of the [Plan](#plan) are done and merged to `main`.
> The bug fixes (step 8) are GitHub issues #163–#170, listed in
> [`knowledge/current.md`](../knowledge/current.md). It all ships in 4.0.0 along with the ESM-only
> change. The sections up to [Goals](#goals) describe 3.x, before the
> conversion.

## What osm-auth does

osm-auth lets a browser app log a user in to OpenStreetMap with OAuth 2.0, then make
authenticated calls to the OSM API. It's a public client: there's no client secret, and the
authorization code is protected with [PKCE](https://datatracker.ietf.org/doc/html/rfc7636) (S256).

### Login flows

- **Popup (default).** `authenticate()` opens a blank 550×610 popup synchronously, so popup
  blockers allow it, then generates a PKCE challenge and a random `state` and points the popup at
  `/oauth2/authorize`. OSM redirects the popup to the app's `land.html`, which posts its URL to
  the `osm-api-auth-complete` [BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel)
  and closes itself. The opener checks `state`, then POSTs the code and verifier to
  `/oauth2/token`. (Since OSM's [8 July 2025 security change](https://github.com/openstreetmap/openstreetmap-website/commit/2ff4d6),
  the popup can no longer reach `window.opener`, hence the BroadcastChannel.)
- **Single page (`singlepage: true`).** The app navigates away to `/oauth2/authorize`, so `state`
  and the PKCE verifier are saved in `localStorage` first. When OSM redirects back with `?code=`,
  the app calls `authenticate()` again (or `bootstrapToken()`), which checks `state` and
  exchanges the code. This mode needs real `localStorage`, and fails with
  `pkce-localstorage-unavailable` without it.
- **Switch user.** `authenticate(cb, { switchUser: true })` sends the user through OSM's
  `/logout` and `/login` before the authorize page.

### State and side effects

An instance holds three pieces of state: the options, a handle to storage, and the popup window.
In 3.x they're variables in the factory's closure:

- **Options.** The setter writes defaults (`apiUrl`, `url`, `auto`, `loading`, …) onto the
  caller's own object and keeps that object; the getter hands it back. So a caller can change an
  instance's settings by editing the object it got from `options()`, without calling the setter,
  and the demo page does exactly that.
- **Storage.** Tokens live in `localStorage` under keys prefixed with `o.url`, so one page can
  talk to several OSM servers. They outlive the page, and every instance with the same `url`
  shares them. That's the point (the user stays logged in across reloads), but it means two
  instances aren't independent. If `localStorage` is missing or throws (Safari private mode,
  sandboxed iframes, Bun, Node), an in-memory `Map` stands in for that one instance. Stored values
  have double quotes stripped, for tokens written by old versions
  ([#129](https://github.com/osmlab/osm-auth/issues/129)).
- **Popup.** `popupWindow`, so `bringPopupWindowToFront()` can find it.

Methods that write outside the instance: the constructor and `preauth()` store a token if given
one; `logout()` removes the stored tokens, legacy OAuth 1 keys included; single-page
`authenticate()` stores `state` and the verifier and navigates the page away; the popup flow opens
a window and a BroadcastChannel.

### Public API

| Method | Notes |
|--------|-------|
| `authenticated()`, `getAccessToken()` | Read the stored token |
| `authenticate(cb, opts?)`, `authenticateAsync(opts?)` | Return at once if already authenticated; otherwise log out and run the login flow |
| `bootstrapToken(code, cb)` | Single-page mode: exchange a code for a token |
| `logout()` | Remove stored tokens |
| `fetch(resource, init?)` | `fetch` with a `Bearer` header; logs in first if `auto` |
| `xhr(opts, cb)` | `XMLHttpRequest` to `apiUrl + path` with a `Bearer` header; logs in first if `auto`. Result is `responseXML` if there is one, else `response` |
| `rawxhr(method, url, token, data, headers, cb)` | The `XMLHttpRequest` helper behind `xhr()` and the token request |
| `preauth({ access_token })` | Store a token you already have |
| `options()`, `options(o)` | Get, or replace, the options (the setter replaces them all, then calls `preauth`) |
| `bringPopupWindowToFront()` | Focus the login popup if it's still open |
| `popupWindow` | The popup, once one has been opened |

### Who uses it

- **iD** calls `osmAuth({...})` without `new`, and uses `import('osm-auth').LoginOptions`. It
  merges options itself (`oauth.options({ ...oauth.options(), locale })`), and reads the numeric
  HTTP `status` from errors (429 and 509 for rate limits).
- **Rapid** casts `osmAuth` to a plain function, because the shipped `.d.ts` says it's a class,
  and declares its own options and instance types. It also merges options itself, and still
  passes a `client_secret` (see [below](#client_secret)).
- Neither passes methods around detached from the instance, and neither checks the string error
  codes (`popup-blocked` and so on).
- **CDN users** load the IIFE with a `<script>` tag (the README points at
  `osm-auth@latest/dist/osm-auth.iife.min.js`), which sets a global `osmAuth`. The demo in
  `docs/` and the README examples call it with `new`.

### Layout today

| Path | What it is |
|------|------------|
| `src/osm-auth.mjs` | The whole library |
| `src/osm-auth.d.ts` | Hand-written types, declared as a class and a global `OSMAuth` namespace |
| `src/index.ts` | IIFE entry point: sets `globalThis.osmAuth` |
| `test/index.test.js` | Three tests: options, and pre-authorization |
| `scripts/build_js.ts` | `Bun.build` → `dist/osm-auth.mjs`, `dist/osm-auth.iife.js` |
| `docs/` | The demo site (GitHub Pages), with `land.html` |

`tsc` never runs: there's no `check:types` script, so nothing checks the `.d.ts` against the code.

## Goals

1. **TypeScript source.** `src/osm-auth.ts`, type-checked under the shared strict `tsconfig.json`.
2. **A class that owns its state.** Options, storage and popup are fields on the instance, and
   options go in and out by copy.
3. **Generated, honest types.** `tsc` emits `dist/ts/osm-auth.d.ts` from the source, under
   `isolatedDeclarations`, so the published types can't drift from the code. Delete
   `src/osm-auth.d.ts`.
4. **Same layout as the sibling projects.** Bundles in `dist/js/`, declarations in `dist/ts/`,
   `build`, `build:ts` and `check:types` scripts, `tsconfig.build.json`.
5. **Fix the known bugs** (listed in [`knowledge/current.md`](../knowledge/current.md)), even where
   that changes behavior.
   4.0.0 is the release for it.
6. **Tests in TypeScript** that cover more than the constructor.

## Non-goals

- Rewriting the login flow, or replacing `XMLHttpRequest` with `fetch` internally.
- Changing how `land.html` works. Apps copy it into their own sites, so it has to stay compatible.
- Dropping callbacks in favor of promises.
- Changing what's stored where. Tokens keep the same `localStorage` keys, so users stay logged in
  across the upgrade.

## Decisions

### `osmAuth` becomes a class, and `new` is required

The instance holds real state (see [State and side effects](#state-and-side-effects)), and a class
says so, where the closure factory hid it. `new osmAuth(options)` is already what the README and
demo show. Calling it without `new` now throws a `TypeError`; iD changes one line, and Rapid drops
its cast and its own instance type.

- **Name.** The class keeps the name `osmAuth`, so `new osmAuth(...)` and `import type { osmAuth }`
  are unchanged.
- **Methods on the prototype.** Detached methods (`const { logout } = auth`) lose `this`, which
  they didn't in 3.x. iD and Rapid don't do this, so plain methods are fine, and the changelog
  says so.
- **Private fields** use TypeScript's `private _name`, like location-conflation. `popupWindow`
  stays public.
- **The constructor still writes a token** when given `access_token`. That's documented, not
  changed.

### Options go in and out by copy

The setter copies the caller's object and fills defaults into the copy; the getter returns a copy.
Editing the returned object no longer changes the instance, so the demo page has to call the
setter (it already does, right after editing). The setter still replaces all the options rather
than merging, since iD and Rapid already merge before calling it.

`access_token` isn't kept in the options: the constructor and setter store it (`preauth()`) and
drop it. Kept, it came back out of the getter, so the usual merge stored it again, over a newer
token or after `logout()` ([#164](https://github.com/osmlab/osm-auth/issues/164)). For the same
reason, a login keeps the options it started with: changing `url` mid-login doesn't send the code
to another server.

### Errors: one `OSMAuthError` class

In 3.x a caller can get any of these as `err`: an `Error` with a string `status`, the failed
`XMLHttpRequest`, a `ProgressEvent` from `onerror`, or the string `'not authenticated'`. In 4.0.0
every failure is an `OSMAuthError`, and callbacks type `err` as `OSMAuthError | null`:

```ts
export class OSMAuthError extends Error {
  code: string;               // 'popup-blocked', 'invalid-state', 'not-authenticated',
                              // 'pkce-localstorage-unavailable', 'http-error',
                              // 'network-error', 'invalid-token-response',
                              // or an OAuth error code from the redirect
  status?: number;            // HTTP status, for 'http-error'
  xhr?: XMLHttpRequest;       // the failed request, for its response body and headers
}                             // (and `cause`: the ProgressEvent, for 'network-error')
```

The numeric `status` keeps working for callers like iD that check the HTTP status of a failed
request. The string codes move from `status` to `code`; nobody we know of reads them.

A failed token request is an `'http-error'` too, rather than taking its code from the OAuth error
in the response body: one code per kind of failure is simpler to check, and `xhr` has the body.
(Done in [#167](https://github.com/osmlab/osm-auth/issues/167).)

### Popup login attempts share one pending login

Every same-origin page hears every `land.html` post on the BroadcastChannel, so a redirect may
belong to another login: another instance (e.g. for the dev server), another tab, or another
attempt on this instance. And OSM's `Cross-Origin-Opener-Policy: same-origin` cuts the popup off
from the opener once it loads openstreetmap.org: `popupWindow.closed` reads `true`, focusing it
does nothing, and `window.open(…, 'oauth_window')` can't find it by name. So the library can't tell
an abandoned popup from one that's still open, and a second click opens a second popup.

So an instance keeps one pending login, with one channel, and each attempt (each popup) adds its
`state`, PKCE verifier and options to it. The redirect for any of those states ends the login, for
every caller; redirects for other states are ignored, rather than failing anyone with
`invalid-state`. That makes a double click, two `fetch()` calls with `auto`, and a retry after
closing the popup all just work, whichever popup the user finishes in. `bringPopupWindowToFront()`
stays, but can only help before the popup reaches OSM. Rejected: one listener per attempt that
fails on any other state (3.x, and lost logins), and reusing the first popup (not possible under
COOP). ([#163](https://github.com/osmlab/osm-auth/issues/163))

### Keep the exported type names

`osmAuth`, `LoginOptions`, `OSMAuthOptions`, `OSMAuthFetchOptions` and `OSMAuthXHROptions` keep
their names. Three are new: `OSMAuthResolvedOptions`, which the `options()` getter returns (the
options with defaults filled in, so `apiUrl` and `url` aren't optional), `OSMAuthCallback<T>`,
the errback type, and `OSMAuthRawXHRCallback`, the callback for `rawxhr()`. The global `OSMAuth` namespace from the hand-written `.d.ts` goes away; the IIFE's
global is declared in `src/index.ts` instead, the same way the sibling projects do it.

### `client_secret`

**Not an option.** osm-auth sent a client secret until June 2023, when PKCE replaced it
("don't use client_secret for authenticating"). Rapid still passes one because nobody removed it,
not because anything reads it; iD stopped passing it. With PKCE the app is a public client, and
the README tells people to register it as non-confidential, so a secret in browser code is at
best a no-op. Leaving it out of `OSMAuthOptions` means TypeScript callers find out it's unused.
(Rejected: `client_secret?: string` marked `@deprecated` until 5.0. It would keep advertising an
option that does nothing.)

### Bundles move to `dist/js/`

Like location-conflation and country-coder. The IIFE's CDN path becomes
`dist/js/osm-auth.iife.min.js`, so anyone loading `osm-auth@latest/dist/osm-auth.iife.min.js`
breaks when 4.0.0 is published. The changelog calls it out, and the README and demo point at the
new path.

### Library code can't use Bun's globals

`tsconfig.build.json` sets `"types": []`, like country-coder, so `src/osm-auth.ts` only sees the
`DOM` and `ESNext` libs. Tests and scripts still get Bun's types from `tsconfig.json`.

### `isolatedDeclarations` in the shared `tsconfig.json`

As in node-diff3: every export needs an explicit type, so the public API can't change by
accident. `tsconfig.json` is a synced scaffold file, so record the change in the Notes column of
`.sync.manifest.md`.

### Tests use small hand-written stubs, not `node-localstorage`

Bun has no `localStorage`, `XMLHttpRequest` or `window`. The current test creates a
`node-localstorage` instance but never installs it as `globalThis.localStorage`, so every test
actually runs against the in-memory fallback. Drop `node-localstorage`, and write small stubs
instead: a `Map`-backed `Storage`, a fake `XMLHttpRequest` that records requests and lets a test
answer them, and a `fetch` spy. That's enough to test token storage, `logout`, `fetch` and `xhr`
headers, `options`, errors, and the token exchange in `bootstrapToken`. A DOM library like
happy-dom would be more than this needs.

## Plan

Each step should end with `bun run all` passing, or with the remaining errors understood. The
conversion (steps 1–7) keeps behavior the same apart from the class and the options copies; the
fixes in step 8 are separate commits, so each behavior change can be reviewed on its own.

1. **Rename.** `git mv src/osm-auth.mjs src/osm-auth.ts` and `git mv test/index.test.js test/osm-auth.test.ts`,
   committed without rewriting them, so git keeps the history through the rewrite. Update the
   paths that point at them in the same commit (`src/index.ts`, `scripts/build_js.ts`, the test's
   import, `package.json`), so it still builds and passes: Bun runs the untyped `.ts` fine.
2. **Rewrite as a typed class.** Turn the closure into a class with private fields, and type the
   internals:
   - the storage as `Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>`, with the `isMocked`
     flag kept outside it (drop the unused `hasItem` and `clear` from the mock);
   - `token()` as two private methods, for get and set;
   - PKCE as a `{ code_challenge, code_verifier, code_challenge_method: 'S256' }` type;
   - `base64()` with `String.fromCharCode(...bytes)`, since `.apply(null, Uint8Array)` doesn't
     type-check;
   - the token response from `JSON.parse` narrowed from `unknown`, not left as `any`;
   - guards where `noUncheckedIndexedAccess` finds a real gap (e.g. `url.split('?')[1]`).

   Keep the existing comments and JSDoc, moving types out of JSDoc into the signatures.
3. **Update references.** `src/index.ts` declares the global. `scripts/build_js.ts` builds into
   `dist/js/`.
4. **Build config.** Add `tsconfig.build.json` (declarations only, into `dist/ts/`). Set
   `declaration` and `isolatedDeclarations` in `tsconfig.json`. In `package.json`: point
   `exports` at `dist/ts/`, `dist/js/` and `src/osm-auth.ts`; add `build`, `build:ts` and
   `check:types`; make `all` run `build`; test `./test`. Delete `src/osm-auth.d.ts`.
   (`check:types` fails on the untyped test file until step 5.)
5. **Tests.** Convert to TypeScript with `node:assert`, drop `node-localstorage`, add the stubs,
   and add tests for the
   parts listed above. The current test passes `client_secret` and calls
   `options({ url: 'foo' })` without the required fields, and its `deepEqual` only passes because
   the setter mutates the caller's object; fix the test, not the types.
6. **Check the published package.** `bun run package` (publint, attw). Then check the generated
   `.d.ts` from a scratch consumer that constructs an `osmAuth` and imports `LoginOptions`, with
   `"types": []` and `skipLibCheck: false`.
7. **Docs.** README: `dist/js/` paths, `new` everywhere (fix the `new osmAuth.osmAuth(...)`
   example), the API section, "First logs out" (not what happens when already logged in), and
   replace the "Support" paragraph about ES5 and Internet Explorer, which the code hasn't
   supported for a while. `docs/index.html`: the CDN path. `CHANGELOG.md`: a 4.0.0 entry with
   the breaking changes. `knowledge/`: record the decisions.
8. **Fixes**, one commit each, on `main` after the conversion merges. The list is in
   [`knowledge/current.md`](../knowledge/current.md).

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

Matches location-conflation and country-coder. It breaks unpinned CDN URLs, so the README and demo
pin `osm-auth@4`, and the changelog calls it out.

## Options are copied in and out (4.0.0)

The 3.x setter stored the caller's object and filled defaults into it, so callers and the instance
changed each other's options. Now the constructor and setter copy, and the getter returns a copy.

## Tests use hand-written stubs (4.0.0)

Bun has no `localStorage`, `XMLHttpRequest` or `window`. Small stubs in `test/stubs.ts` cover what
osm-auth uses, and let tests wait on a request or navigation instead of polling. Rejected:
`node-localstorage` (it was never installed as the global) and happy-dom (more than this needs).

# Completed

## November 2026

- **TypeScript conversion (4.0.0).** `osmAuth` is a typed class (`new` required), its `.d.ts` is
  generated from the source, and the bundles moved to `dist/js/`. Tests are in TypeScript, against
  hand-written browser stubs. Plan and decisions: [`design/osm-auth.md`](../design/osm-auth.md).
- **Bug hunt and fixes (4.0.0).** `/bughunt` found 22 bugs, mostly from 3.x. The small ones went
  straight to `main` (type definitions, the demo's error handling, the README's browser example,
  the OAuth 1 `land_single.html`). The rest were issues #163–#170, fixed in stacked PRs #171–#178:
  one `OSMAuthError` for every failure, popup attempts sharing one pending login, `access_token`
  kept out of the options, single-page return fixes, request header fixes, errors instead of
  silent hangs, and `URLSearchParams`. Checking the changes against how iD and Rapid use the
  library turned up one more: #180, so iD's uploader still shows the OSM API's error text.
- **Real-browser testing.** `bun run start:chrome` and `bun run cdp`, as in Rapid, drive the demo in
  a debug Chrome with the developer's OSM test account. It confirmed the COOP popup behavior behind
  #163, and checked the fixes for #163, #166, #168 and #169.
- **Docs.** The README covers the dev server and redirect URIs per login mode (closed #132 and
  #133, both from 2024).

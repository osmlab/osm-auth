# Current work

## Convert to TypeScript (Nov 2026)

Merged to `main`. Plan and decisions are in [`design/osm-auth.md`](../design/osm-auth.md). Ships
in 4.0.0 with the ESM-only change. Steps 1–7 are done (the class rewrite, generated types, tests
and docs); the bug fixes below follow on `main`.

The demo page loads `osm-auth@latest/dist/js/…` from the CDN, so the published demo is broken until
4.0.0 is on npm. That's expected. (`bun start` serves the local build, so it works locally.)

## Bugs to fix in 4.0.0

Tracked as GitHub issues, with the details and a likely fix in each. The numbers in brackets are
the old item IDs from this file (1–9 from reading the 3.x source, 10–22 from `/bughunt` on
16 Nov 2026). All were in 3.x too, except where marked **new**.

One commit per issue (or per part of one). Each fix changes or adds the tests that cover the
behavior (`xhr()` with `auto` and the token response without `access_token` have no tests yet, so
add those first), and adds its line to the 4.0.0 entry in `CHANGELOG.md`.

- [#163](https://github.com/osmlab/osm-auth/issues/163) A second login attempt breaks the first
  one (popup mode) [10, 22]. *High, new.* Also correct the changelog line "A failed attempt left a
  listener behind".
- [#164](https://github.com/osmlab/osm-auth/issues/164) Changing `options()` can store the wrong
  token [11, 14]. *High* (iD's `options({ ...options(), locale })` hits it).
- [#165](https://github.com/osmlab/osm-auth/issues/165) Some failed logins are reported as success
  [1, 9].
- [#166](https://github.com/osmlab/osm-auth/issues/166) Some failed logins never call back [15].
- [#167](https://github.com/osmlab/osm-auth/issues/167) Errors come in four shapes: one
  `OSMAuthError` class [2, 3]. Also types the callbacks' `err` as `OSMAuthError | null`; it's `any`
  until then, as in 3.x (`unknown` broke typed callers).
- [#168](https://github.com/osmlab/osm-auth/issues/168) Single-page mode: fixes for the redirect
  back from OSM [5, 12, 13]. Includes the README's single-page example not removing `?code`.
- [#169](https://github.com/osmlab/osm-auth/issues/169) `fetch()` and `rawxhr()` mishandle request
  headers [4, 16]. Fixing `FormData` helps [#35](https://github.com/osmlab/osm-auth/issues/35).
- [#170](https://github.com/osmlab/osm-auth/issues/170) Replace `utilStringQs` with
  `URLSearchParams` [7, 21].

Do #163 before #166's "user closes the popup" part: both need the instance to track a pending
login. #167 changes what the other fixes report, so it's easier early.

### Test gaps

`FakeXHR` fires `readystatechange` only at readyState 4 and allows `setRequestHeader` before
`open`, so dropping the readyState check or moving the header loop passes the suite (9 of 13
mutations survived). Nothing covers: the channel closing, `authenticateAsync` rejecting,
the `fetch` after an `auto` login, a network error on the token request, 201/204, or an error
redirect with the wrong `state`.

# Current work

## Convert to TypeScript (Nov 2026)

On the `typescript_conversion` branch. Plan, decisions and open questions are in
[`design/osm-auth.md`](../design/osm-auth.md). Ships in 4.0.0 with the ESM-only change already on `main`.

Steps 1–7 are done: the class rewrite, generated types, tests and docs. Next is step 8, the bug
fixes, one commit each. Each fix adds its line to the 4.0.0 entry in `CHANGELOG.md`.

The demo page loads `osm-auth@latest/dist/js/…` from the CDN, so it's broken from when this merges
until 4.0.0 is on npm. That's expected.

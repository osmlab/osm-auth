# Current work

## Release 4.0.0

Everything planned for 4.0.0 is on `main` (see [`completed.md`](completed.md)); next is the
release itself (`RELEASE.md`, or `/release`).

The demo page loads `osm-auth@latest/dist/js/…` from the CDN, so the published demo is broken until
4.0.0 is on npm. That's expected. (`bun start` serves the local build, so it works locally.)

After the release, iD and Rapid upgrade. iD's `develop` already calls `new osmAuth(…)`; Rapid's
steps (`new`, drop `client_secret` and its own osm-auth types, simplify `switchAsync`) are in its
`.scratchpad/backlog.md`.

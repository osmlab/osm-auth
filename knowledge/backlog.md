# Backlog

Planned work and ideas that haven't started.

## Let the app cancel a pending popup login ([#56](https://github.com/osmlab/osm-auth/issues/56))

The rest of #56 is answered (a revoked token makes requests fail with an `'http-error'`, `status`
401; `loading`/`done` bracket the token request). What's left is "the user closed the popup", and
the library can't detect that by itself (see `quirks.md`):
- Polling `popupWindow.closed` doesn't work: with OSM's COOP header it reads `true` as soon as the
  popup loads openstreetmap.org, so it would report "closed" mid-login.
- The popup can't tell us: the user closes it while it's on OSM's page, where none of our code runs.
  `land.html` only runs at the end.
- Focus heuristics ("the opener got focus back and nothing arrived within N seconds") would misfire
  for password managers, two-factor prompts and slow typists.

So let the app cancel instead: `authenticate(cb, { signal })` with an `AbortSignal`, or
`auth.cancelLogin()`, which ends the pending login with a `'cancelled'` `OSMAuthError` for every
waiting callback. Since #163 an instance has one pending login, so it's small: close the channel,
clear `_pending`, call the callbacks. iD could put a Cancel button on its "logging in" modal.
Not breaking, so a 4.x release.

## Confirm a multipart upload works, then close [#35](https://github.com/osmlab/osm-auth/issues/35)

#169 should be what was missing: a `FormData` body without `headers` no longer gets the default
`Content-Type`, so the browser sets `multipart/form-data; boundary=…` (checked in Chrome for
`xhr()` and `fetch()`, against a fake host). This should upload a GPX trace:

```js
const form = new FormData();
form.append('file', file);            // a File or Blob, e.g. from an <input type="file">
form.append('description', 'My trace');
form.append('visibility', 'private');
auth.xhr({ method: 'POST', path: '/api/0.6/gpx/create', content: form }, (err, traceID) => { … });
```

Not yet tried against OSM, because it creates a trace. To close #35: do one real upload with the
test account (on the dev server, or on production and then delete the trace), add the example to
the README, and reply on the issue. Or wait for someone to try it after 4.0.0 ships.

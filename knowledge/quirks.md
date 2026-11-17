# Quirks

Odd behavior that the code has to live with.

## OSM's pages cut the login popup off from the opener

openstreetmap.org sends `Cross-Origin-Opener-Policy: same-origin`, so once the popup loads an OSM
page the browser separates it from the page that opened it:
- in the popup, `window.opener` is `null` (hence `land.html` posts to a BroadcastChannel)
- in the opener, `popupWindow.closed` reads `true` while the popup is still open, and `focus()`
  does nothing, so `bringPopupWindowToFront()` returns `false`
- `window.open(…, 'oauth_window')` can't find the popup by name, so it opens another one

So the page can't tell when the user closes the popup: the callback waits until a later attempt
ends. Confirmed in Chrome, Nov 2026.

## Every same-origin page hears `land.html`

BroadcastChannel delivers to every page of the origin: other tabs, and other `osmAuth` instances
on the same page. A redirect posted on the channel may belong to another login, so check its
`state` and ignore it if it isn't ours.

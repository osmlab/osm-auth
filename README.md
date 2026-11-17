[![build](https://github.com/osmlab/osm-auth/workflows/build/badge.svg)](https://github.com/osmlab/osm-auth/actions?query=workflow%3A%22build%22)
[![npm version](https://badge.fury.io/js/osm-auth.svg)](https://badge.fury.io/js/osm-auth)

# osm-auth

Easy authentication with [OpenStreetMap](http://www.openstreetmap.org/) over [OAuth 2.0](https://oauth.net/2/).<br/>
See also: https://wiki.openstreetmap.org/wiki/OAuth

> [!IMPORTANT]
> Due to [security changes on 8 July 2025](https://github.com/openstreetmap/openstreetmap-website/commit/2ff4d6), authentication using the `popup` mode will not work until you:
>
> 1. update this library to >= v3.0.0
> 2. AND update the code snippet in your `land.html` file to the latest version (see [this example](https://github.com/osmlab/osm-auth/blob/main/docs/land.html))

> [!NOTE]
> Upgrading to v4? `osmAuth` must be called with `new`, and the bundles moved to `dist/js/`. See the [CHANGELOG](CHANGELOG.md) for the details.


Note that openstreetmap.org currently only supports OAuth2.0. [OAuth1.0 is turned off](https://github.com/openstreetmap/operations/issues/867). If you want the older version of this library that supports **OAuth 1.0a** (e.g. for a sister project that uses an older OSM-stack), use [the v1 branch](https://github.com/osmlab/osm-auth/tree/v1) and pin your software to older [release versions <2](https://github.com/osmlab/osm-auth/releases).  Going forward, the v1 branch will receive limited attention.


## Demo

Try it out now at: https://osmlab.github.io/osm-auth/

Or you can run the demo locally by cloning this project, then run:

```sh
$ bun install
$ bun run all
$ bun start
```

This will start a local server on port 8080. Then open `http://127.0.0.1:8080/` in a browser.


## Usage

### Use in Node

To install osm-auth as a dependency in your Node project:
```bash
$  npm install --save osm-auth
```

**osm-auth** is distributed as an ES module. ([Read more about Javascript module formats](https://dev.to/iggredible/what-the-heck-are-cjs-amd-umd-and-esm-ikm))
CommonJS projects can still `require()` it on Node 20.19+ or 22.12+.


```js
import { osmAuth } from 'osm-auth';   // ESM named import
// or
const { osmAuth } = require('osm-auth');   // CJS, requires Node 20.19+ or 22.12+

const auth = new osmAuth({ … });
```

**osm-auth** is written in TypeScript, and includes its type definitions.


### Use in Browsers

You can also use **osm-auth** directly in a web browser.  A good way to do this is to fetch the ["iife"](https://esbuild.github.io/api/#format-iife) bundle from the [jsDelivr CDN](https://www.jsdelivr.com/), which can even deliver minified versions.

When you load this file in a `<script>` tag, you'll get a `osmAuth` global to use elsewhere in your scripts.
Pin the major version in the URL (here `@4`), so a future breaking release doesn't break your page:
```html
<head>
<script src="https://cdn.jsdelivr.net/npm/osm-auth@4/dist/js/osm-auth.iife.min.js"></script>
</head>
…
<script>
  var redirectPath = window.location.origin + window.location.pathname;
  var auth = new osmAuth({
    client_id: "…",
    scope: "read_prefs",
    redirect_uri: redirectPath + "land.html"
  });
  …
</script>
```

&nbsp;


**The popup login requires a `land.html` at your `redirect_uri` (copy [this one](docs/land.html)),
or a page that does the same thing: post its URL to the `osm-api-auth-complete` BroadcastChannel,
then close itself.**


### Support

**osm-auth** is for modern browsers. It uses `BroadcastChannel` to hear back from the login popup, and the [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) for PKCE, which only works in a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts) (`https`, or `http://127.0.0.1`).
It stores the access token in `localStorage` when it can. Without `localStorage` (or if writing to it fails, e.g. when it's full), the token lasts only as long as the page, and single-page mode doesn't work.


## Registering an application
See: https://wiki.openstreetmap.org/wiki/OAuth#OAuth_2.0_2

Register a new OAuth2.0 application on openstreetmap.org:

1. Go to your user page
2. Click 'My Settings'
3. Click 'OAuth 2 applications'
4. At the bottom, 'Register new application'
5. Fill in the form (keeping the _Confidential application?_ checkbox unchecked) & submit
6. Copy & Paste the client ID, redirect URI, and scope(s) into the osmAuth config object as below

👉 Important:
- The "Redirect URIs" are URIs that OSM is allowed to redirect the user back to.  You can supply multiple Redirect URIs separated by spaces, and change them later.
- Redirect URIs must use `https`, except for `127.0.0.1`, which may use `http`


### Example

```js
var redirectPath = window.location.origin + window.location.pathname;
var auth = new osmAuth({
  client_id: "JWXSAzNp64sIRMStTnkhMRaMxSR964V4sFgn3KUZNTA",
  redirect_uri: redirectPath + "land.html",
  scope: "read_prefs",
  auto: true  // show a login form if the user is not authenticated and you try to do a call
});

document.getElementById("authenticate").onclick = function () {
  // Signed method call - since `auto` is true above, this will
  // automatically start an authentication process if the user isn't
  // authenticated yet.
  auth.xhr({ method: "GET", path: "/api/0.6/user/details" },
    function (err, result) {
      // result is an XML DOM containing the user details
    }
  );
};
```

### Example with single-page
```js
var redirectPath = window.location.origin + window.location.pathname;
var auth = new osmAuth({
  client_id: "JWXSAzNp64sIRMStTnkhMRaMxSR964V4sFgn3KUZNTA",
  redirect_uri: redirectPath,
  scope: "read_prefs", // scopes should be separated by a space, e.g. "read_prefs write_prefs". See https://wiki.openstreetmap.org/wiki/OAuth#OAuth_2.0 for all scopes
  auto: true,  // show a login form if the user is not authenticated and you try to do a call
  singlepage: true
});

document.getElementById("authenticate").onclick = function () {
  // Signed method call - since `auto` is true above, this will
  // automatically start an authentication process if the user isn't
  // authenticated yet.
  auth.xhr({ method: "GET", path: "/api/0.6/user/details" },
    function (err, result) {
      // result is an XML DOM containing the user details
    }
  );
};

if (window.location.search.slice(1).split('&').some(p => p.startsWith('code='))) {
  auth.authenticate(function() {
    // Fully authed at this point
  });
}
```

&nbsp;

## Contributing

See the [CONTRIBUTING.md](CONTRIBUTING.md) file for more info.

&nbsp;

# API

## `new osmAuth(options)`

Constructs an `osmAuth` instance. `new` is required.<br/>
At a minimum, `options` must contain OAuth2 client ID, redirect URI, and scope(s):

```js
var redirectPath = window.location.origin + window.location.pathname;
{
  client_id: "JWXSAzNp64sIRMStTnkhMRaMxSR964V4sFgn3KUZNTA",
  redirect_uri: redirectPath + "land.html",
  scope: "read_prefs"
}
```

Additional options are:

 - `access_token` - Can pre-authorize with an OAuth2 bearer token if you have one
 - `apiUrl` - A base url for the OSM API (default: "https://api.openstreetmap.org")
 - `url` - A base url for the OAuth2 handshake (default: "https://www.openstreetmap.org")
 - `auto` - If `true`, attempt to authenticate automatically when calling `.xhr()` or `fetch()` (default: `false`)
 - `singlepage` - If `true`, use page redirection instead of a popup (default: `false`)
 - `loading` - Function called when auth-related xhr calls start
 - `done` - Function called when auth-related xhr calls end
 - `locale` - The locale to use on the OpenStreetMap login page (e.g. "de")

The options are copied, so changing the object you passed in later doesn't change the instance. Use `.options()` to read or change them.


## `.logout()`

Removes any stored authentication tokens (legacy OAuth1 tokens too)<br/>
<br/>
Returns: `self`<br/>


## `.authenticated()`

Test whether the user is currently authenticated<br/>
<br/>
Returns: `true` if authenticated, `false` if not<br/>


## `getAccessToken()`

Return the current stored access token, if any<br/>
<br/>
Returns: The access token, or '' if user is not authenticated.<br/>


## `.authenticate(callback, options?)`

If the user is already authenticated, calls the callback right away.
Otherwise clears any stored tokens, runs the authentication flow, and then calls the callback.<br/>
In popup mode, calling it again while a login is in progress (e.g. a double click) opens another popup. The login ends when the user finishes in any of them, and then every callback is called.<br/>
If the user closes the popup without finishing, the callback isn't called then, because the browser doesn't let the page know. It's called when a later attempt ends.<br/>
<br/>
Param:   `callback`  An "errback"-style callback (`err`, `result`), called when complete. `result` is the `osmAuth` instance.<br/>
Param:   `options`  Optional, an object which can contain `switchUser`. If `switchUser` is `true`, then the user will first be prompted to logout, then login, then go to the oauth flow.<br/>
Returns:  none<br/>


## `.authenticateAsync(options?)`

Promisified version of `.authenticate()`<br/>
Resolves with the `osmAuth` instance if authentication succeeds, or rejects if not.<br/>
<br/>
Param:   `options`  Optional, an object which can contain `switchUser`. If `switchUser` is `true`, then the user will first be prompted to logout, then login, then go to the oauth flow.<br/>
Returns:  `Promise` settled with whatever authenticate did.<br/>


## `.bringPopupWindowToFront()`

Tries to bring an existing authentication popup to the front.<br/>
<br/>
Returns: `true` on success or `false` if there is no authentication popup or if it couldn't be brought to the front (e.g. because of cross-origin restrictions).<br/>
<br/>
Once the popup has loaded openstreetmap.org, browsers cut it off from your page (OSM sends a `Cross-Origin-Opener-Policy` header), so this returns `false`. It's fine to call `authenticate()` again then: it opens another popup, and either one finishes the login.<br/>


## `.bootstrapToken(auth_code, callback)`

The authorization code is a temporary code that a client can exchange for an access token. If using this library in single-page mode, you'll need to call this once your application has an `auth_code` and wants to get an access_token.
<br/>
Param:  `auth_code`  The OAuth2 `auth_code`<br/>
Param:  `callback`   An "errback"-style callback (`err`, `result`), called when complete<br/>
Returns:  none<br/>


## `.fetch(resource, options)`

A `fetch` wrapper that includes the Authorization header if the user is authenticated.<br/>
See: https://developer.mozilla.org/en-US/docs/Web/API/fetch<br/>
<br/>
If the user isn't authenticated, it authenticates first when `auto` is `true`, or rejects when it isn't.<br/>
<br/>
Param: `resource`  The URL (or `Request`) passed to `fetch`<br/>
Param: `options`   Options passed to `fetch`. `headers` can be an object, an array of pairs, or a `Headers`.<br/>
Return: `Promise` that wraps `authenticateAsync` then `fetch`<br/>
<br/>
The options you pass aren't changed. Without `headers`, a request with a string body (or none) gets `Content-Type: application/x-www-form-urlencoded`; other bodies, like `FormData`, get theirs from the browser.<br/>


## `.xhr(options, callback)`

A `XMLHttpRequest` wrapper that does authenticated calls if the user has logged in.<br/>
See: https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest<br/>
<br/>
Param: `options`:<br/>
  `options.method`   Passed to `xhr.open`  (e.g. 'GET', 'POST')<br/>
  `options.prefix`   If `true` path contains a path, if `false` path contains the full url<br/>
  `options.path`     The URL path (e.g. "/api/0.6/user/details") (or full url, if `prefix`=`false`)<br/>
  `options.content`  Passed to `xhr.send`<br/>
  `options.headers`  optional `Object` containing request headers. Without it, a string `content` (or none) is sent as `application/x-www-form-urlencoded`<br/>
Param: `callback`  An "errback"-style callback (`err`, `result`), called when complete<br/>
Return: `XMLHttpRequest` if authenticated, otherwise `null`<br/>


## `rawxhr(method, url, access_token, data, headers, callback)`

Creates the XMLHttpRequest set up with a header and response handling.<br/>
See: https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest<br/>
<br/>
Param:  `method`         Passed to `xhr.open`  (e.g. 'GET', 'POST')<br/>
Param:  `url`            Passed to `xhr.open`<br/>
Param:  `access_token`   The OAuth2 bearer token<br/>
Param:  `data`           Passed to `xhr.send`<br/>
Param:  `headers`        `Object` containing request headers<br/>
Param:  `callback`       An "errback"-style callback (`err`, `result`), called when complete<br/>
Return: `XMLHttpRequest`<br/>


## `.preauth(val)`

Pre-authorize this object, if we already have the bearer token from the start.<br/>
<br/>
Param:   `val`   `Object` containing `access_token` property<br/>
Return:  `self`<br/>


## `.options(options)`

Options  (getter / setter)<br/>
 If passed with no arguments, return a copy of the options, with defaults filled in (but not `access_token`, see `getAccessToken()`)<br/>
 If passed an Object, replace the options with a copy of it, then attempt to pre-authorize<br/>
<br/>
Param:  `val?`   Object containing options<br/>
Return:  current `options` (if getting), or `self` (if setting)<br/>
<br/>


## `OSMAuthError`

Every error passed to a callback, or rejected by a promise, is an `OSMAuthError`.
Its `code` says what went wrong:

 - `'popup-blocked'` - the browser blocked the login popup
 - `'invalid-state'` - the redirect from OSM didn't carry the `state` this login sent
 - `'not-authenticated'` - `xhr()` or `fetch()` needs a login, and `auto` isn't set
 - `'pkce-localstorage-unavailable'` - single-page mode needs `localStorage`, and there isn't one
 - `'http-error'` - a request got a response that isn't 20x. `status` is the HTTP status, and `xhr` is the request
 - `'network-error'` - a request failed without a response. `xhr` is the request, and `cause` is the error event
 - `'timeout'` - a request took longer than the `timeout` you set on it. `xhr` is the request (a request you `abort()` doesn't call back)
 - `'invalid-token-response'` - the token request succeeded, but its response has no access token. `xhr` is the request
 - `'crypto-unavailable'` - PKCE needs the [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API), which browsers only offer in a secure context
 - an OAuth error code from OSM's redirect, e.g. `'access_denied'` if the user denied access

```js
auth.xhr({ method: 'GET', path: '/api/0.6/user/details' }, function (err, result) {
  if (err?.status === 429) {
    // rate limited
  }
});
```

## License

This project is available under the [ISC License](LICENSE.md).
ISC is a permissive free software license — functionally equivalent to the MIT License.


[![build](https://github.com/osmlab/osm-auth/workflows/build/badge.svg)](https://github.com/osmlab/osm-auth/actions?query=workflow%3A%22build%22)
[![npm version](https://badge.fury.io/js/osm-auth.svg)](https://badge.fury.io/js/osm-auth)

# osm-auth

Easy authentication with [OpenStreetMap](http://www.openstreetmap.org/) over [OAuth 2.0](https://oauth.net/2/).<br/>
See also: https://wiki.openstreetmap.org/wiki/OAuth

Note: If you want the older version of this library that supports OpenStreetMap over OAuth 1.0a, use [the v1 branch](https://github.com/osmlab/osm-auth/tree/v1) and pin your software to older [release versions <2](https://github.com/osmlab/osm-auth/releases).  Going forward, the v1 branch will receive limited attention.


## Demo

Try it out now at: https://osmlab.github.io/osm-auth/

Or you can run the demo locally by cloning this project, then run:

```sh
$ npm install
$ npm run build
$ npm start
```

This will start a local server on port 8080. Then open `http://127.0.0.1:8080/` in a browser.


## Usage

### Use in Node

To install osm-auth as a dependency in your project:
```bash
$  npm install --save osm-auth
```

**osm-auth** is distributed in CJS and ESM module formats for maxmimum compatibility. ([Read more about Javascript module formats](https://dev.to/iggredible/what-the-heck-are-cjs-amd-umd-and-esm-ikm))


```js
const osmAuth = require('osm-auth').osmAuth;   // CJS named import
// or
import { osmAuth } from 'osm-auth';   // ESM named import
```


### Use in Browsers

You can also use **osm-auth** directly in a web browser.  A good way to do this is to fetch the ["iife"](https://esbuild.github.io/api/#format-iife) bundle from the [jsDelivr CDN](https://www.jsdelivr.com/), which can even deliver minified versions.

When you load this file in a `<script>` tag, you'll get a `osmAuth` global to use elsewhere in your scripts:
```html
<head>
<script src="https://cdn.jsdelivr.net/npm/osm-auth@2/dist/osm-auth.iife.min.js"></script>
</head>
…
<script>
// example here
</script>
```

&nbsp;


**Requires `land.html` to be accessible, or a page that does the same thing -
calls an auth complete function - to be available.**


### Support

This project is tested in supported node versions and modern browsers.
We attempt to use JavaScript syntax that will work in legacy environments like ES5 or Internet Explorer, but offer no guarantee that it will work.
If you're targeting an environment like this, you're probably already building your own bundle with something like [Babel](https://babeljs.io/docs/en/index.html).


## Registering an application
See: https://wiki.openstreetmap.org/wiki/OAuth#OAuth_2.0_2

Register a new OAuth2.0 application on openstreetmap.org:

1. Go to your user page
2. Click 'My Settings'
3. Click 'OAuth 2 applications'
4. At the bottom, 'Register new application'
5. Fill in the form & submit
6. Copy & Paste the client ID, secret, redirect URI and scope(s) into the osmAuth config object as below

👉 Important:
- Remember to copy the `client_secret` after setting up your application. It won't be available later.
- The "Redirect URIs" are URIs that OSM is allowed to redirect the user back to.  You can supply multiple Redirect URIs separated by spaces, and change them later.
- Redirect URIs must use `https`, except for `127.0.0.1`, which may use `http`


### Example

```js
var redirectPath = window.location.origin + window.location.pathname;
var auth = osmAuth.osmAuth({
  client_id: "JWXSAzNp64sIRMStTnkhMRaMxSR964V4sFgn3KUZNTA",
  client_secret: "6umOXfkZqH5CVUtv6iDqN7k8o7mKbQvTrHvbDQH36hs",
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
coming soon

# API

## `.osmAuth(options)`

Constructs an `osmAuth` instance.<br/>
At a minimum, `options` must contain OAuth2 client ID, secret, redirect URI, and scope(s):

```js
var redirectPath = window.location.origin + window.location.pathname;
{
  client_id: "JWXSAzNp64sIRMStTnkhMRaMxSR964V4sFgn3KUZNTA",
  client_secret: "6umOXfkZqH5CVUtv6iDqN7k8o7mKbQvTrHvbDQH36hs",
  redirect_uri: redirectPath + "land.html",
  scope: "read_prefs"
}
```

Additional options are:

 - `access_token` - Can pre-authorize with an OAuth2 bearer token if you have one
 - `url` - A base url (default: "https://www.openstreetmap.org")
 - `auto` - If `true`, attempt to authenticate automatically when calling `.xhr()` or `fetch()` (default: `false`)
 - `singlepage` - If `true`, use page redirection instead of a popup (default: `false`)
 - `loading` - Function called when auth-related xhr calls start
 - `done` - Function called when auth-related xhr calls end


## `.logout()`

Removes any stored authentication tokens (legacy OAuth1 tokens too)<br/>
<br/>
Returns: `self`<br/>


## `.authenticated()`

Test whether the user is currently authenticated<br/>
<br/>
Returns: `true` if authenticated, `false` if not<br/>


## `.authenticate(callback)`

First logs out, then runs the authentiation flow, finally calls the callback.<br/>
<br/>
Param:   `callback`  An "errback"-style callback (`err`, `result`), called when complete<br/>
Returns:  none<br/>


## `.bringPopupWindowToFront()`

Tries to bring an existing authentication popup to the front.<br/>
<br/>
Returns: `true` on success or `false` if there is no authentication popup or if it couldn't be brought to the front (e.g. because of cross-origin restrictions).<br/>


## `.bootstrapToken(auth_code, callback)`

The authorization code is a temporary code that a client can exchange for an access token. If using this library in single-page mode, you'll need to call this once your application has an `auth_code` and wants to get an access_token.
<br/>
Param:  `auth_code`  The OAuth2 `auth_code`<br/>
Param:  `callback`   An "errback"-style callback (`err`, `result`), called when complete<br/>
Returns:  none<br/>


## `.fetch(path, options)`

A `fetch` wrapper that does authenticated calls if the user has logged in.<br/>
See: https://developer.mozilla.org/en-US/docs/Web/API/fetch<br/>
<br/>
Param: `path`  The URL path (e.g. "/api/0.6/user/details") (or full url, if `options.prefix`=`false`)<br/>
Param: `options`:<br/>
  `options.method`   Passed to `fetch`  (e.g. 'GET', 'POST')<br/>
  `options.prefix`   If `true` path contains a path, if `false` path contains the full url<br/>
  `options.body`  Passed to `fetch`<br/>
  `options.headers`  optional `Object` containing request headers<br/>
Return: `Promise` that resolves to a `Response` if authenticated, otherwise `null`<br/>


## `.xhr(options, callback)`

A `XMLHttpRequest` wrapper that does authenticated calls if the user has logged in.<br/>
See: https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest<br/>
<br/>
Param: `options`:<br/>
  `options.method`   Passed to `xhr.open`  (e.g. 'GET', 'POST')<br/>
  `options.prefix`   If `true` path contains a path, if `false` path contains the full url<br/>
  `options.path`     The URL path (e.g. "/api/0.6/user/details") (or full url, if `prefix`=`false`)<br/>
  `options.content`  Passed to `xhr.send`<br/>
  `options.headers`  optional `Object` containing request headers<br/>
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
 If passed with no arguments, just return the options<br/>
 If passed an Object, set the options then attempt to pre-authorize<br/>
<br/>
Param:  `val?`   Object containing options<br/>
Return:  current `options` (if getting), or `self` (if setting)<br/>
<br/>
[![build](https://github.com/osmlab/osm-auth/workflows/build/badge.svg)](https://github.com/osmlab/osm-auth/actions?query=workflow%3A%22build%22)
[![npm version](https://badge.fury.io/js/osm-auth.svg)](https://badge.fury.io/js/osm-auth)

## osm-auth

Easy authentication with [OpenStreetMap](http://www.openstreetmap.org/) over [OAuth 2.0](https://oauth.net/2/).


### Demo

Try it out now at: http://osmlab.github.io/osm-auth/

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

### Getting Keys

Register a new OAuth2.0 application on openstreetmap.org:

1. Go to your user page
2. Click 'My Settings'
3. Click 'OAuth 2 applications'
4. At the bottom, 'Register new application'
5. Fill in the form & submit
6. Copy & Paste the client ID, secret, redirect URI and scope(s) into the osmAuth config object as below

### Example

```js
var auth = osmAuth({
  client_id: "JWXSAzNp64sIRMStTnkhMRaMxSR964V4sFgn3KUZNTA",
  client_secret: "6umOXfkZqH5CVUtv6iDqN7k8o7mKbQvTrHvbDQH36hs",
  redirect_uri: "http://127.0.0.1:8080/land.html",
  scope: "read_prefs",
  auto: true, // show a login form if the user is not authenticated and
  // you try to do a call
});

document.getElementById("authenticate").onclick = function () {
  // Signed method call - since `auto` is true above, this will
  // automatically start an authentication process if the user isn't
  // authenticated yet.
  auth.xhr(
    {
      method: "GET",
      path: "/api/0.6/user/details",
    },
    function (err, details) {
      // details is an XML DOM of user details
    }
  );
};
```

#### Example with single-page

```

    var auth = osmAuth({
      client_id: "JWXSAzNp64sIRMStTnkhMRaMxSR964V4sFgn3KUZNTA",
      client_secret: "6umOXfkZqH5CVUtv6iDqN7k8o7mKbQvTrHvbDQH36hs",
      redirect_uri: "http://127.0.0.1:8080/land.html",
      scope: "read_prefs",
      auto: true,
      singlepage: true, // Load the auth-window in the current window, with a redirect,
      landing: window.location.href // Come back to the current page
    });

    var urlParams = new URLSearchParams(window.location.search);
    if(urlParams.has('code')){
        // The authorization code passed via the URL has to be passed into 'auth.bootstrapToken'. 
        // The callback is triggered when the final roundtrip is done
         auth.bootstrapToken(urlParams.get('code'),
                (error) => {
                    if(error !== null){
                        console.log("Something is wrong: ", error);
                        return;
                    }

                    /* Do authenticated stuff here*/
                }, this.auth);
    } else {

        // Attempt to do something authenticated to trigger authentication

    }

```

### Support

[CORS-supporting browsers](http://caniuse.com/#feat=cors)

### API

`.osmAuth(options)`

At a minimum, options must contain OAuth client ID, secret, redirect URI and scope(s):

```
{
    client_id: "JWXSAzNp64sIRMStTnkhMRaMxSR964V4sFgn3KUZNTA",
    client_secret: "6umOXfkZqH5CVUtv6iDqN7k8o7mKbQvTrHvbDQH36hs",
    redirect_uri: "http://127.0.0.1:8080/land.html",
    scope: "read_prefs",
}
```

Additional options are:

- `url` for a base url (default: "https://www.openstreetmap.org")
- `landing` for a landing page name (default: "land.html")
- `loading`: a function called when auth-related xhr calls start
- `done`: a function called when auth-related xhr calls end
- `singlepage`: use full-page redirection instead of a popup for mobile

`.logout()`

`.authenticated()`: am I authenticated?

`.authenticate(callback)`

Tries to authenticate. Calls callback if successful.

`.bringPopupWindowToFront()`

Tries to bring an existing authentication popup to the front. Returns `true` on success or `false` if there is no
authentication popup or if it couldn't be brought to the front (e.g. because of cross-origin restrictions).

`.xhr(options, callback)`

[XMLHttpRequest](http://en.wikipedia.org/wiki/XMLHttpRequest).
Main options are `url` and `method`.

`.options(options)`

Set new options.

### Based on

Uses [ohauth](https://github.com/osmlab/ohauth) and
[store.js](https://github.com/marcuswestin/store.js) behind the scenes.

Built for and used by OpenStreetMap's [iD editor](https://github.com/openstreetmap/iD).

### See Also

- [OAuth in Javascript](http://mapbox.com/osmdev/2013/01/15/oauth-in-javascript/)
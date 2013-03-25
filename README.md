## osm-auth

Easy authentication with [OpenStreetMap](http://www.openstreetmap.org/)
over [OAuth](http://oauth.net/) with
[CORS](http://en.wikipedia.org/wiki/Cross-origin_resource_sharing).

## installation

Basic:

Copy `osmauth.js`, use the `osmAuth` object.

With browserify:

    npm install osm-auth

```js
var osmAuth = require('osm-auth');
```

**Requires land.html to be accessible, or a page that does the same thing -
calls an auth complete function - to be available.**

## example

Register a new OAuth application on openstreetmap.org:

1. Go to your user page
2. Click 'my settings'
3. Click 'oauth settings'
4. At the bottom, 'Register your application'
5. Fill in the form & submit

```js
var auth = osmAuth({
    oauth_secret: '9WfJnwQxDvvYagx1Ut0tZBsOZ0ZCzAvOje3u1TV0',
    oauth_consumer_key: 'WLwXbm6XFMG7WrVnE8enIF6GzyefYIN6oUJSxG65',
    auto: true
});

document.getElementById('authenticate').onclick = function() {
    // Signed method call - since `auto` is true above, this will
    // automatically start an authentication process if the user isn't
    // authenticated yet.
    auth.xhr({
        method: 'GET',
        path: '/api/0.6/user/details'
    }, function(err, details) {
        // details is an XML DOM of user details
    });
};
```

## support

[CORS-supporting browsers](http://caniuse.com/#feat=cors)

## api

`.logout()`

`.authenticated()`: am I authenticated?

`.authenticate(callback)`

Tries to authenticate. Calls callback if successful.

`.xhr(options, callback)`

Signed [XMLHttpRequest](http://en.wikipedia.org/wiki/XMLHttpRequest).
Main options are `url` and `method`.

## based on

Uses [ohauth](https://github.com/tmcw/ohauth) and
[store.js](https://github.com/marcuswestin/store.js) behind the scenes.

Based on the implementation in the [iD editor](http://ideditor.com/).

## see also

* [OAuth in Javascript](http://mapbox.com/osmdev/2013/01/15/oauth-in-javascript/)

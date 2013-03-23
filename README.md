## osm-auth

Easy authentication with [OpenStreetMap](http://www.openstreetmap.org/)
over [OAuth](http://oauth.net/) with [CORS](http://en.wikipedia.org/wiki/Cross-origin_resource_sharing)

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

```js
var auth = osmAuth({
    oauth_secret: '9WfJnwQxDvvYagx1Ut0tZBsOZ0ZCzAvOje3u1TV0',
    oauth_consumer_key: "WLwXbm6XFMG7WrVnE8enIF6GzyefYIN6oUJSxG65"
});

document.getElementById('authenticate').onclick = function() {
    // Deploys a popup for authentication
    auth.authenticate(function(err) {
        // Signed method call!
        auth.xhr({
            method: 'GET',
            path: '/api/0.6/user/details'
        }, done);
    });
};
```

## api

`.logout()`

`.authenticated()`: am I authenticated?

`.authenticate(callback)`

Tries to authenticate. Calls callback if successful.

`.xhr(options, callback)`

Signed XMLHttpRequest. Main options are `url` and `method`.

## based on

Uses [ohauth](https://github.com/tmcw/ohauth) and [store.js](https://github.com/marcuswestin/store.js)
behind the scenes.

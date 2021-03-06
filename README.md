[![build](https://github.com/osmlab/osm-auth/workflows/build/badge.svg)](https://github.com/osmlab/osm-auth/actions?query=workflow%3A%22build%22)
[![npm version](https://badge.fury.io/js/osm-auth.svg)](https://badge.fury.io/js/osm-auth)


## osm-auth

Easy authentication with [OpenStreetMap](http://www.openstreetmap.org/)
over [OAuth](http://oauth.net/) with
[CORS](http://en.wikipedia.org/wiki/Cross-origin_resource_sharing).


### Demo

Try it out now at:  http://osmlab.github.io/osm-auth/

Or you can run the demo locally by cloning this project, then run:

```sh
$ npm install
$ npm run build
$ npm start
```

This will start a local server on port 8080.  Then open `http://localhost:8080` in a browser.


### Using osm-auth in your project

##### Basic:

Copy `osmauth.js`, use the `osmAuth` object.  This uses
[UMD](https://github.com/umdjs/umd), so it's compatible
with [RequireJS](http://requirejs.org/) etc too, if you're into that kind
of thing.


##### With node:

```sh
$ npm install osm-auth
```
```js
var osmAuth = require('osm-auth');
```

**Requires land.html to be accessible, or a page that does the same thing -
calls an auth complete function - to be available.**


### Getting Keys

Register a new OAuth application on openstreetmap.org:

1. Go to your user page
2. Click 'my settings'
3. Click 'oauth settings'
4. At the bottom, 'Register your application'
5. Fill in the form & submit
6. Copy & Paste the secret & consumer key into the osmAuth config object as below


### Example

```js
var auth = osmAuth({
    oauth_consumer_key: 'WLwXbm6XFMG7WrVnE8enIF6GzyefYIN6oUJSxG65',
    oauth_secret: '9WfJnwQxDvvYagx1Ut0tZBsOZ0ZCzAvOje3u1TV0',
    auto: true // show a login form if the user is not authenticated and
               // you try to do a call
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


#### Example with single-page



```

    var auth = osmAuth({
    oauth_consumer_key: 'WLwXbm6XFMG7WrVnE8enIF6GzyefYIN6oUJSxG65',
    oauth_secret: '9WfJnwQxDvvYagx1Ut0tZBsOZ0ZCzAvOje3u1TV0',
    auto: true,
    singlepage: true, // Load the auth-window in the current window, with a redirect,
    landing: window.location.href // Come back to the current page
    });

    var urlParams = new URLSearchParams(window.location.search);
    if(urlParams.has('oauth_token')){
        // The token passed via the URL has to be passed into 'auth.bootstrapToken'. The callback is triggered when the final roundtrip is done
         auth.bootstrapToken(urlParams.get('oauth_token'),
                (error) => {
                    if(error !== null){
                        console.log("Something is wrong: ", error);
                        return;
                    }

                    /* Do authenticated stuff here*/
                }, this.auth);
    }else{

        // Attempt to do something authenticated to trigger authentication

    }

```

### Support

[CORS-supporting browsers](http://caniuse.com/#feat=cors)


### API

`.osmAuth(options)`

At a minimum, options must contain an OAuth consumer key and secret:

```
{
    oauth_secret: ...
    oauth_consumer_key: ...
}
```

Additional options are:

* `url` for a base url (default: "https://www.openstreetmap.org")
* `landing` for a landing page name (default: "land.html")
* `loading`: a function called when auth-related xhr calls start
* `done`: a function called when auth-related xhr calls end
* `singlepage`: use full-page redirection instead of a popup for mobile

`.logout()`

`.authenticated()`: am I authenticated?

`.authenticate(callback)`

Tries to authenticate. Calls callback if successful.

`.bringPopupWindowToFront()`

Tries to bring an existing authentication popup to the front. Returns `true` on success or `false` if there is no
authentication popup or if it couldn't be brought to the front (e.g. because of cross-origin restrictions).

`.xhr(options, callback)`

Signed [XMLHttpRequest](http://en.wikipedia.org/wiki/XMLHttpRequest).
Main options are `url` and `method`.

`.options(options)`

Set new options.


### Based on

Uses [ohauth](https://github.com/osmlab/ohauth) and
[store.js](https://github.com/marcuswestin/store.js) behind the scenes.

Built for and used by OpenStreetMap's [iD editor](https://github.com/openstreetmap/iD).


### See Also

* [OAuth in Javascript](http://mapbox.com/osmdev/2013/01/15/oauth-in-javascript/)

var ohauth = require('ohauth'),
    store = require('store');

// # osm-auth
//
// This code is only compatible with IE10+ because the [XDomainRequest](http://bit.ly/LfO7xo)
// object, IE<10's idea of [CORS](http://en.wikipedia.org/wiki/Cross-origin_resource_sharing),
// does not support custom headers, which this uses everywhere.
module.exports = function(keys, o) {

    var oauth = {};

    // keys is for keys. for example,
    //
    //     { "http://www.openstreetmap.org/": {
    //         oauth_secret: '9WfJnwQxDvvYagx1Ut0tZBsOZ0ZCzAvOje3u1TV0',
    //         oauth_consumer_key: "WLwXbm6XFMG7WrVnE8enIF6GzyefYIN6oUJSxG65"
    //     } }
    o = o || {};
    o.url = o.url || 'http://www.openstreetmap.org';
    o.landing = o.landing || 'land.html';

    // Optional loading and loading-done functions for nice UI feedback.
    // by default, no-ops
    o.loading = o.loading || function() {};
    o.done = o.done || function() {};

    // authenticated users will also have a request token secret, but it's
    // not used in transactions with the server
    oauth.authenticated = function() {
        return !!(token('oauth_token') && token('oauth_token_secret'));
    };

    oauth.logout = function() {
        token('oauth_token', '');
        token('oauth_token_secret', '');
        token('oauth_request_token_secret', '');
        return oauth;
    };

    // TODO: detect lack of click event
    oauth.authenticate = function(callback) {
        if (oauth.authenticated()) return callback();

        oauth.logout();

        // ## Getting a request token
        var params = timenonce(getAuth(o)),
            url = o.url + '/oauth/request_token';

        params.oauth_signature = ohauth.signature(
            keys[o.url].oauth_secret, '',
            ohauth.baseString('POST', url, params));

        // Create a 600x550 popup window in the center of the screen
        var w = 600, h = 550,
            settings = [
                ['width', w], ['height', h],
                ['left', screen.width / 2 - w / 2],
                ['top', screen.height / 2 - h / 2]].map(function(x) {
                    return x.join('=');
                }).join(','),
            popup = window.open('about:blank', 'oauth_window', settings);

        // Request a request token. When this is complete, the popup
        // window is redirected to OSM's authorization page.
        ohauth.xhr('POST', url, params, null, {}, reqTokenDone);
        o.loading();

        function reqTokenDone(err, xhr) {
            o.done();
            if (err) return callback(err);
            var resp = ohauth.stringQs(xhr.response);
            token('oauth_request_token_secret', resp.oauth_token_secret);
            popup.location = o.url + '/oauth/authorize?' + ohauth.qsString({
                oauth_token: resp.oauth_token,
                oauth_callback: location.href.replace('index.html', '')
                    .replace(/#.+/, '') + o.landing
            });
        }

        // Called by a function in a landing page, in the popup window. The
        // window closes itself.
        window.authComplete = function(token) {
            var oauth_token = ohauth.stringQs(token.split('?')[1]);
            get_access_token(oauth_token.oauth_token);
            delete window.authComplete;
        };

        // ## Getting an request token
        //
        // At this point we have an `oauth_token`, brought in from a function
        // call on a landing page popup.
        function get_access_token(oauth_token) {
            var url = o.url + '/oauth/access_token',
                params = timenonce(getAuth(o)),
                request_token_secret = token('oauth_request_token_secret');
            params.oauth_token = oauth_token;
            params.oauth_signature = ohauth.signature(
                keys[o.url].oauth_secret,
                request_token_secret,
                ohauth.baseString('POST', url, params));

            // ## Getting an access token
            //
            // The final token required for authentication. At this point
            // we have a `request token secret`
            ohauth.xhr('POST', url, params, null, {}, accessTokenDone);
            o.loading();
        }

        function accessTokenDone(err, xhr) {
            o.done();
            if (err) return callback(err);
            var access_token = ohauth.stringQs(xhr.response);
            token('oauth_token', access_token.oauth_token);
            token('oauth_token_secret', access_token.oauth_token_secret);
            callback(null, oauth);
        }
    };

    // # xhr
    //
    // A single XMLHttpRequest wrapper that does authenticated calls if the
    // user has logged in.
    oauth.xhr = function(options, callback) {
        if (!oauth.authenticated()) {
            if (o.auto) return oauth.authenticate(run);
            else return callback('not authenticated', null);
        } else return run();

        function run() {
            var params = timenonce(getAuth(o)),
                url = o.url + options.path,
                oauth_token_secret = token('oauth_token_secret');

            params.oauth_token = token('oauth_token');
            params.oauth_signature = ohauth.signature(
                keys[o.url].oauth_secret,
                oauth_token_secret,
                ohauth.baseString(options.method, url, params));

            ohauth.xhr(options.method,
                url, params, options.content, options.options, done);
        }

        function done(err, xhr) {
            if (err) return callback(err);
            else if (xhr.responseXML) return callback(err, xhr.responseXML);
            else return callback(err, xhr.response);
        }
    };

    // Reset the base URL that this OAuth connection points to
    oauth.url = function(_) {
        if (!arguments.length) return o.url;
        o.url = _;
        return oauth;
    };

    // pre-authorize this object, if we can just get a token and token_secret
    // from the start
    oauth.preauth = function(_) {
        var c = _[o.url];
        if (!c) return;
        if (c.oauth_token) token('oauth_token', c.oauth_token);
        if (c.oauth_token_secret) token('oauth_token_secret', c.oauth_token_secret);
        return oauth;
    };

    // Reset the base URL that this OAuth connection points to
    oauth.keys = function(_) {
        if (!arguments.length) return keys;
        keys = _;
        return oauth.preauth(keys);
    };

    // 'stamp' an authentication object from `getAuth()`
    // with a [nonce](http://en.wikipedia.org/wiki/Cryptographic_nonce)
    // and timestamp
    function timenonce(o) {
        o.oauth_timestamp = ohauth.timestamp();
        o.oauth_nonce = ohauth.nonce();
        return o;
    }

    // get/set tokens. These are prefixed with the base URL so that `osm-auth`
    // can be used with multiple APIs and the keys in `localStorage`
    // will not clash
    function token(x, y) {
        if (arguments.length === 1) return store.get(o.url + x);
        else if (arguments.length === 2) return store.set(o.url + x, y);
    }

    // Get an authentication object. If you just add and remove properties
    // from a single object, you'll need to use `delete` to make sure that
    // it doesn't contain undesired properties for authentication
    function getAuth(o) {
        return {
            oauth_consumer_key: keys[o.url].oauth_consumer_key,
            oauth_signature_method: "HMAC-SHA1"
        };
    }

    // potentially pre-authorize
    oauth.keys(keys);

    return oauth;
};

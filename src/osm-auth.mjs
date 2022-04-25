import ohauth from 'ohauth';
import store from 'store';


// # osm-auth
//
// This code is only compatible with IE10+ because the [XDomainRequest](http://bit.ly/LfO7xo)
// object, IE<10's idea of [CORS](http://en.wikipedia.org/wiki/Cross-origin_resource_sharing),
// does not support custom headers, which this uses everywhere.
export function osmAuth(o) {
  var oauth = {};

  oauth.authenticated = function () {
    return !!token('access_token');
  };

  oauth.logout = function () {
    token('access_token', '');
    return oauth;
  };

  // TODO: detect lack of click event
  oauth.authenticate = function (callback) {
    if (oauth.authenticated()) return callback();

    oauth.logout();

    // ## Request authorization to access resources from the user
    // and receive authorization code
    var url =
      o.url +
      '/oauth2/authorize?' +
      ohauth.qsString({
        client_id: o.client_id,
        redirect_uri: o.redirect_uri,
        response_type: 'code',
        scope: o.scope,
      });

    if (!o.singlepage) {
      // Create a 600x550 popup window in the center of the screen
      var w = 600;
      var h = 550;
      var settings = [
          ['width', w],
          ['height', h],
          ['left', screen.width / 2 - w / 2],
          ['top', screen.height / 2 - h / 2],
        ]
          .map(function (x) {
            return x.join('=');
          })
          .join(',');
      var popup = window.open('about:blank', 'oauth_window', settings);
      oauth.popupWindow = popup;
      popup.location = url;

      if (!popup) {
        var error = new Error('Popup was blocked');
        error.status = 'popup-blocked';
        throw error;
      }
    }

    // Called by a function in the redirect URL page, in the popup window. The
    // window closes itself.
    window.authComplete = function (url) {
      var params = ohauth.stringQs(url.split('?')[1]);
      get_access_token(params.code);
      delete window.authComplete;
    };

    // ## Getting an access token
    //
    // The client requests an access token by authenticating with the
    // authorization server and presenting the `auth_code`, brought
    // in from a function call on a landing page popup.
    function get_access_token(auth_code) {
      var url =
        o.url +
        '/oauth2/token?' +
        ohauth.qsString({
          client_id: o.client_id,
          grant_type: 'authorization_code',
          code: auth_code,
          redirect_uri: o.redirect_uri,
          client_secret: o.client_secret,
        });

      // The authorization server authenticates the client and validates
      // the authorization grant, and if valid, issues an access token.
      ohauth.xhr('POST', url, null, null, {}, accessTokenDone);
      o.loading();
    }

    function accessTokenDone(err, xhr) {
      o.done();
      if (err) return callback(err);
      var access_token = JSON.parse(xhr.response);
      token('access_token', access_token.access_token);
      callback(null, oauth);
    }
  };

  oauth.bringPopupWindowToFront = function () {
    var brougtPopupToFront = false;
    try {
      // This may cause a cross-origin error:
      // `DOMException: Blocked a frame with origin "..." from accessing a cross-origin frame.`
      if (oauth.popupWindow && !oauth.popupWindow.closed) {
        oauth.popupWindow.focus();
        brougtPopupToFront = true;
      }
    } catch (err) {
      // Bringing popup window to front failed (probably because of the cross-origin error mentioned above)
    }
    return brougtPopupToFront;
  };

  oauth.bootstrapToken = function (auth_code, callback) {
    // ## Getting an access token
    // The client requests an access token by authenticating with the
    // authorization server and presenting the authorization_code
    function get_access_token(auth_code) {
      var url =
        o.url +
        '/oauth2/token?' +
        ohauth.qsString({
          client_id: o.client_id,
          grant_type: 'authorization_code',
          code: auth_code,
          redirect_uri: o.redirect_uri,
          client_secret: o.client_secret,
        });

      // The authorization server authenticates the client and validates
      // the authorization grant, and if valid, issues an access token.
      ohauth.xhr('POST', url, null, null, {}, accessTokenDone);
      o.loading();
    }

    function accessTokenDone(err, xhr) {
      o.done();
      if (err) return callback(err);
      var access_token = JSON.parse(xhr.response);
      token('access_token', access_token.access_token);
      callback(null, oauth);
    }

    get_access_token(auth_code);
  };

  // # xhr
  //
  // A single XMLHttpRequest wrapper that does authenticated calls if the
  // user has logged in.
  oauth.xhr = function (options, callback) {
    if (!oauth.authenticated()) {
      if (o.auto) {
        return oauth.authenticate(run);
      } else {
        callback('not authenticated', null);
        return;
      }
    } else {
      return run();
    }

    function run() {
      var url = options.prefix !== false ? o.url + options.path : options.path;
      return ohauth.xhr(
        options.method,
        url,
        token('access_token'),
        options.content,
        options.options,
        done
      );
    }

    function done(err, xhr) {
      if (err) return callback(err);
      else if (xhr.responseXML) return callback(err, xhr.responseXML);
      else return callback(err, xhr.response);
    }
  };

  // pre-authorize this object, if we can just get an access token from the start
  oauth.preauth = function (c) {
    if (!c) return;
    if (c.access_token) token('access_token', c.access_token);
    return oauth;
  };

  oauth.options = function (_) {
    if (!arguments.length) return o;

    o = _;
    o.url = o.url || 'https://www.openstreetmap.org';
    o.singlepage = o.singlepage || false;

    // Optional loading and loading-done functions for nice UI feedback.
    // by default, no-ops
    o.loading = o.loading || function () {};
    o.done = o.done || function () {};
    return oauth.preauth(o);
  };

  // get/set tokens. These are prefixed with the base URL so that `osm-auth`
  // can be used with multiple APIs and the keys in `localStorage`
  // will not clash
  var token;

  if (store.enabled) {
    token = function (x, y) {
      if (arguments.length === 1) return store.get(o.url + x);
      else if (arguments.length === 2) return store.set(o.url + x, y);
    };
  } else {
    var storage = {};
    token = function (x, y) {
      if (arguments.length === 1) return storage[o.url + x];
      else if (arguments.length === 2) return (storage[o.url + x] = y);
    };
  }

  // potentially pre-authorize
  oauth.options(o);

  return oauth;
}
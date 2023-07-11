import store from 'store';


/**
 * osmAuth
 * Easy authentication with OpenStreetMap over OAuth 2.0.
 * @module
 *
 * @param    o   `Object` containing options:
 * @param    o.scope          OAuth2 scopes requested (e.g. "read_prefs write_api")
 * @param    o.client_id      OAuth2 client ID
 * @param    o.redirect_uri   OAuth2 redirect URI (e.g. "http://127.0.0.1:8080/land.html")
 * @param    o.access_token   Can pre-authorize with an OAuth2 bearer token if you have one
 * @param    o.url            A base url (default: "https://www.openstreetmap.org")
 * @param    o.auto           If `true`, attempt to authenticate automatically when calling `.xhr()` (default: `false`)
 * @param    o.singlepage     If `true`, use page redirection instead of a popup (default: `false`)
 * @param    o.loading        Function called when auth-related xhr calls start
 * @param    o.done           Function called when auth-related xhr calls end
 * @return  `self`
 */
export function osmAuth(o) {
  var oauth = {};

  /**
   * authenticated
   * Test whether the user is currently authenticated
   * @return `true` if authenticated, `false` if not
   */
  oauth.authenticated = function () {
    return !!token('oauth2_access_token');
  };


  /**
   * logout
   * Removes any stored authentication tokens (legacy OAuth1 tokens too)
   *
   * @return  `self`
   */
  oauth.logout = function () {
    token('oauth2_access_token', '');         // OAuth2
    token('oauth_token', '');                 // OAuth1
    token('oauth_token_secret', '');          // OAuth1
    token('oauth_request_token_secret', '');  // OAuth1
    return oauth;
  };


  /**
   * authenticate
   * First logs out, then runs the authentiation flow, finally calls the callback.
   * TODO: detect lack of click event  (probably can settimeout it)
   *
   * @param   callback   An "errback"-style callback (`err`, `result`), called when complete
   * @return  none
   */
  oauth.authenticate = function (callback) {
    if (oauth.authenticated()) {
      callback(null, oauth);
      return;
    }

    oauth.logout();

    generatePkceChallenge(function(pkce) {
      _authenticate(pkce, callback);
    });
  };

  function _authenticate(pkce, callback) {
    var state = generateState();

    // ## Request authorization to access resources from the user
    // and receive authorization code
    var url =
      o.url +
      '/oauth2/authorize?' +
      utilQsString({
        client_id: o.client_id,
        redirect_uri: o.redirect_uri,
        response_type: 'code',
        scope: o.scope,
        state: state,
        code_challenge: pkce.code_challenge,
        code_challenge_method: pkce.code_challenge_method,
      });

    if (o.singlepage) {
      if (!store.enabled) {
        // in singlepage mode, PKCE requires working non-volatile storage
        var error = new Error('local storage unavailable, but require in singlepage mode');
        error.status = 'pkce-localstorage-unavailable';
        callback(error);
        return;
      }
      var params = utilStringQs(window.location.search.slice(1));
      if (params.code) {
        oauth.bootstrapToken(params.code, callback);
      } else {
        // save OAuth2 state and PKCE challenge in local storage, for later use
        // in the `/oauth/token` request
        token('oauth2_state', state);
        token('oauth2_pkce_code_verifier', pkce.code_verifier);
        window.location = url;
      }
    } else {
      // Create a 600x550 popup window in the center of the screen
      var w = 600;
      var h = 550;
      var settings = [
          ['width', w],
          ['height', h],
          ['left', window.screen.width / 2 - w / 2],
          ['top', window.screen.height / 2 - h / 2],
        ]
        .map(function (x) { return x.join('='); })
        .join(',');

      var popup = window.open('about:blank', 'oauth_window', settings);
      oauth.popupWindow = popup;
      popup.location = url;

      if (!popup) {
        error = new Error('Popup was blocked');
        error.status = 'popup-blocked';
        callback(error);
      }
    }

    // Called by a function in the redirect URL page, in the popup window. The
    // window closes itself.
    window.authComplete = function (url) {
      var params = utilStringQs(url.split('?')[1]);
      if (params.state !== state) {
        error = new Error('Invalid state');
        error.status = 'invalid-state';
        callback(error);
        return;
      }
      getAccessToken(params.code, pkce.code_verifier, accessTokenDone);
      delete window.authComplete;
    };

    function accessTokenDone(err, xhr) {
      o.done();
      if (err) {
        callback(err);
        return;
      }
      var access_token = JSON.parse(xhr.response);
      token('oauth2_access_token', access_token.access_token);
      callback(null, oauth);
    }
  }


  // ## Getting an access token
  // The client requests an access token by authenticating with the
  // authorization server and presenting the `auth_code`, brought
  // in from a function call on a landing page popup.
  function getAccessToken(auth_code, code_verifier, accessTokenDone) {
    var url =
      o.url +
      '/oauth2/token?' +
      utilQsString({
        client_id: o.client_id,
        redirect_uri: o.redirect_uri,
        grant_type: 'authorization_code',
        code: auth_code,
        code_verifier: code_verifier,
      });

    // The authorization server authenticates the client and validates
    // the authorization grant, and if valid, issues an access token.
    oauth.rawxhr('POST', url, null, null, null, accessTokenDone);
    o.loading();
  }


  /**
   * bringPopupWindowToFront
   * Tries to bring an existing authentication popup to the front.
   * @return  `true` if it succeeded, `false` if not
   */
  oauth.bringPopupWindowToFront = function () {
    var broughtPopupToFront = false;
    try {
      // This may cause a cross-origin error:
      // `DOMException: Blocked a frame with origin "..." from accessing a cross-origin frame.`
      if (oauth.popupWindow && !oauth.popupWindow.closed) {
        oauth.popupWindow.focus();
        broughtPopupToFront = true;
      }
    } catch (err) {
      // Bringing popup window to front failed (probably because of the cross-origin error mentioned above)
    }
    return broughtPopupToFront;
  };


  /**
   * bootstrapToken
   * The authorization code is a temporary code that a client can exchange for an access token.
   * If using this library in single-page mode, you'll need to call this once your application
   * has an `auth_code` and wants to get an access_token.
   *
   * @param   auth_code  The OAuth2 `auth_code`
   * @param   callback   An "errback"-style callback (`err`, `result`), called when complete
   * @return  none
   */
  oauth.bootstrapToken = function (auth_code, callback) {
    var state = token('oauth2_state');
    token('oauth2_state', '');
    var params = utilStringQs(window.location.search.slice(1));
    if (params.state !== state) {
      var error = new Error('Invalid state');
      error.status = 'invalid-state';
      callback(error);
      return;
    }
    var code_verifier = token('oauth2_pkce_code_verifier');
    token('oauth2_pkce_code_verifier', '');
    getAccessToken(auth_code, code_verifier, accessTokenDone);

    function accessTokenDone(err, xhr) {
      o.done();
      if (err) {
        callback(err);
        return;
      }
      var access_token = JSON.parse(xhr.response);
      token('oauth2_access_token', access_token.access_token);
      callback(null, oauth);
    }
  };

  /**
   * fetch
   * A `fetch` wrapper that does authenticated calls if the user has logged in.
   * https://developer.mozilla.org/en-US/docs/Web/API/fetch
   *
   * @param   path             The URL path (e.g. "/api/0.6/user/details") (or full url, if `options.prefix`=`false`)
   * @param   options
   * @param   options.method   Passed to `fetch`  (e.g. 'GET', 'POST')
   * @param   options.prefix   If `true` path contains a path, if `false` path contains the full url
   * @param   options.body     Passed to `fetch`
   * @param   options.headers  `Object` containing request headers
   * @return  `Promise` that resolves to a `Response` if authenticated, otherwise `null`
   */
  oauth.fetch = function (path, options, callback) {
    if (oauth.authenticated()) {
      return run();
    } else {
      if (o.auto) {
        oauth.authenticate(run);
        return;
      } else {
        callback('not authenticated', null);
        return;
      }
    }

    function run() {
      var url = options.prefix !== false ? o.url + path : path;
      var headers = options.headers || { 'Content-Type': 'application/x-www-form-urlencoded' };
      headers.Authorization = 'Bearer ' + token('oauth2_access_token');
      return fetch(url, {
        method: options.method,
        body: options.body,
        headers: headers,
      }).then((resp) => {
        var contentType = resp.headers.get('content-type').split(';')[0];
        switch (contentType) {
          case 'text/html':
          case 'text/xml':
            return resp
              .text()
              .then((txt) =>
                new window.DOMParser().parseFromString(txt, contentType)
              );
          case 'application/html':
            return resp.json();
          default:
            return resp.text();
        }
      });
    }
  };

  /**
   * xhr
   * A `XMLHttpRequest` wrapper that does authenticated calls if the user has logged in.
   * https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
   *
   * @param   options
   * @param   options.method   Passed to `xhr.open`  (e.g. 'GET', 'POST')
   * @param   options.prefix   If `true` path contains a path, if `false` path contains the full url
   * @param   options.path     The URL path (e.g. "/api/0.6/user/details") (or full url, if `prefix`=`false`)
   * @param   options.content  Passed to `xhr.send`
   * @param   options.headers  `Object` containing request headers
   * @param   callback  An "errback"-style callback (`err`, `result`), called when complete
   * @return  `XMLHttpRequest` if authenticated, otherwise `null`
   */
  oauth.xhr = function (options, callback) {
    if (oauth.authenticated()) {
      return run();
    } else {
      if (o.auto) {
        oauth.authenticate(run);
        return;
      } else {
        callback('not authenticated', null);
        return;
      }
    }

    function run() {
      var url = options.prefix !== false ? (o.url + options.path) : options.path;
      return oauth.rawxhr(
        options.method,
        url,
        token('oauth2_access_token'),
        options.content,
        options.headers,
        done
      );
    }

    function done(err, xhr) {
      if (err) {
        callback(err);
      } else if (xhr.responseXML) {
        callback(err, xhr.responseXML);
      } else {
        callback(err, xhr.response);
      }
    }
  };


  /**
   * rawxhr
   * Creates the XMLHttpRequest set up with a header and response handling
   * https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
   *
   * @param    method         Passed to `xhr.open`  (e.g. 'GET', 'POST')
   * @param    url            Passed to `xhr.open`
   * @param    access_token   OAuth2 bearer token
   * @param    data           Passed to `xhr.send`
   * @param    headers        `Object` containing request headers
   * @param    callback       An "errback"-style callback (`err`, `result`), called when complete
   * @return  `XMLHttpRequest`
   */
  oauth.rawxhr = function (method, url, access_token, data, headers, callback) {
    headers = headers || { 'Content-Type': 'application/x-www-form-urlencoded' };

    if (access_token) {
      headers.Authorization = 'Bearer ' + access_token;
    }

    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function () {
      if (4 === xhr.readyState && 0 !== xhr.status) {
        if (/^20\d$/.test(xhr.status)) {   // a 20x status code - OK
          callback(null, xhr);
        } else {
          callback(xhr, null);
        }
      }
    };
    xhr.onerror = function (e) {
      callback(e, null);
    };

    xhr.open(method, url, true);
    for (var h in headers) xhr.setRequestHeader(h, headers[h]);

    xhr.send(data);
    return xhr;
  };


  /**
   * preauth
   * Pre-authorize this object, if we already have access token from the start
   *
   * @param    val   `Object` containing `access_token` property
   * @return  `self`
   */
  oauth.preauth = function (val) {
    if (val && val.access_token) {
      token('oauth2_access_token', val.access_token);
    }
    return oauth;
  };


  /**
   * options  (getter / setter)
   * If passed with no arguments, just return the options
   * If passed an Object, set the options then attempt to pre-authorize
   *
   * @param   val?   Object containing options
   * @return  current `options` (if getting), or `self` (if setting)
   */
  oauth.options = function (val) {
    if (!arguments.length) return o;

    o = val;
    o.url = o.url || 'https://www.openstreetmap.org';
    o.auto = o.auto || false;
    o.singlepage = o.singlepage || false;

    // Optional loading and loading-done functions for nice UI feedback.
    // by default, no-ops
    o.loading = o.loading || function () {};
    o.done = o.done || function () {};
    return oauth.preauth(o);
  };


  // Everything below here is initialization/setup code

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

  // Handle options and attempt to pre-authorize
  oauth.options(o);

  return oauth;
}


/** Transforms object into query string
 * @param obj
 * @param noencode
 * @returns query string
 */
function utilQsString(obj) {
  return Object.keys(obj)
    .filter(function(key) {
      return obj[key] !== undefined;
    })
    .sort()
    .map(function(key) {
      return (encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]));
    })
    .join('&');
}

/** Transforms query string into object
 * @param str
 * @returns object
 */
function utilStringQs(str) {
  var i = 0; // advance past any leading '?' or '#' characters
  while (i < str.length && (str[i] === '?' || str[i] === '#')) i++;
  str = str.slice(i);

  return str.split('&').reduce(function(obj, pair) {
    var parts = pair.split('=');
    if (parts.length === 2) {
      obj[parts[0]] = decodeURIComponent(parts[1]);
    }
    return obj;
  }, {});
}


function supportsWebCryptoAPI() {
  return window && window.crypto
    && window.crypto.getRandomValues
    && window.crypto.subtle
    && window.crypto.subtle.digest;
}

/**
 * Generates a challenge/verifier pair for PKCE.
 * If the browser does not support the Web Crypto API, the "plain" method is
 * used as a fallback instead of a SHA-256 hash.
 * @param {callback} callback called with the result of the generated PKCE challenge
 */
function generatePkceChallenge(callback) {
  var code_verifier;
  if (supportsWebCryptoAPI()) {
    // generate a random code_verifier
    // https://datatracker.ietf.org/doc/html/rfc7636#section-7.1
    var random = window.crypto.getRandomValues(new Uint8Array(32));
    code_verifier = base64(random.buffer);
    var verifier = Uint8Array.from(Array.from(code_verifier).map(function(char) {
      return char.charCodeAt(0);
    }));

    // generate challenge for code verifier
    window.crypto.subtle.digest('SHA-256', verifier).then(function(hash) {
      var code_challenge = base64(hash);

      callback({
        code_challenge: code_challenge,
        code_verifier: code_verifier,
        code_challenge_method: 'S256'
      });
    });
  } else {
    // browser does not support Web Crypto API (e.g. IE11) -> fall back to "plain" method
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    code_verifier = '';
    for (var i=0; i<64; i++) {
      code_verifier += chars[Math.floor(Math.random() * chars.length)];
    }
    callback({
      code_verifier: code_verifier,
      code_challenge: code_verifier,
      code_challenge_method: 'plain',
    });
  }
}

/**
 * Returns a random state to be used as the "state" of the OAuth2 authentication
 * See https://datatracker.ietf.org/doc/html/rfc6749#section-10.12
 */
function generateState() {
  var state;
  if (supportsWebCryptoAPI()) {
    var random = window.crypto.getRandomValues(new Uint8Array(32));
    state = base64(random.buffer);
  } else {
    // browser does not support Web Crypto API (e.g. IE11) -> fall back to "plain" method
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    state = '';
    for (var i=0; i<64; i++) {
      state += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return state;
}

/** Converts binary buffer to base64 encoded string, as used in rfc7636
 * @param obj
 * @param noencode
 * @returns query string
 */
function base64(buffer) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)))
      .replace(/\//g, '_')
      .replace(/\+/g, '-')
      .replace(/[=]/g, '');
}
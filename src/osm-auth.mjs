
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
 * @param    o.apiUrl         A base url for the OSM API (default: "https://api.openstreetmap.org")
 * @param    o.url            A base url for the OAuth2 handshake (default: "https://www.openstreetmap.org")
 * @param    o.auto           If `true`, attempt to authenticate automatically when calling `.xhr()` or `.fetch()` (default: `false`)
 * @param    o.singlepage     If `true`, use page redirection instead of a popup (default: `false`)
 * @param    o.loading        Function called when auth-related xhr calls start
 * @param    o.done           Function called when auth-related xhr calls end
 * @param    o.locale         The locale to use on the OAuth2 authentication page. Optional.
 * @return  `self`
 */
export function osmAuth(o) {
  var oauth = {};

  var CHANNEL_ID = 'osm-api-auth-complete';

  // Mock localStorage if needed.
  // Note that accessing localStorage may throw a `SecurityError`, so wrap in a try/catch.
  var _store = null;
  try {
    _store = window.localStorage;
  } catch (e) {
    var _mock = new Map();
    _store = {
      isMocked: true,
      hasItem: (k) => _mock.has(k),
      getItem: (k) => _mock.get(k),
      setItem: (k, v) => _mock.set(k, v),
      removeItem: (k) => _mock.delete(k),
      clear: () => _mock.clear()
    };
  }

  /**
   * token
   * Get/Set tokens. These are prefixed with the base URL so that `osm-auth`
   * can be used with multiple APIs and the keys in `localStorage` will not clash
   * @param  {string}   k  key
   * @param  {string?}  v  value
   * @return {string?}  If getting, returns the stored value or `null`.  If setting, returns `undefined`.
   */
  function token(k, v) {
    var key = o.url + k;
    if (arguments.length === 1) {
      var val = _store.getItem(key) || '';
      // Note: legacy tokens might be wrapped in double quotes - remove them, see #129
      return val.replace(/"/g, '');

    } else if (arguments.length === 2) {
      if (v) {
        return _store.setItem(key, v);
      } else {
        return _store.removeItem(key);
      }
    }
  }


  /**
   * authenticated
   * Test whether the user is currently authenticated
   *
   * @return {boolean} `true` if authenticated, `false` if not
   */
  oauth.authenticated = function() {
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
   * @param   {function}  callback  Errback-style callback `(err, result)`, called when complete
   * @param   {LoginOptions}  [options]  Other options
   * @return  none
   */
  oauth.authenticate = function(callback, options) {
    if (oauth.authenticated()) {
      callback(null, oauth);
      return;
    }

    oauth.logout();

    _preopenPopup(function(error, popup) {
      if (error) {
        callback(error);
      } else {
        _generatePkceChallenge(function(pkce) {
          _authenticate(pkce, options, popup, callback);
        });
      }
    });
  };


  /**
   * authenticateAsync
   * Promisified version of `authenticate`
   * @param {LoginOptions} [options]
   * @return  {Promise}  Promise settled with whatever `_authenticate` did
   */
  oauth.authenticateAsync = function(options) {
    if (oauth.authenticated()) {
      return Promise.resolve(oauth);
    }

    oauth.logout();

    return new Promise((resolve, reject) => {
      var errback = (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      };

      _preopenPopup((error, popup) => {
        if (error) {
          errback(error);
        } else {
          _generatePkceChallenge(pkce => _authenticate(pkce, options, popup, errback));
        }
      });
    });
  };


  /**
   * opens an empty popup to be later used for the authentication page
   * @param   {function}  callback  Errback-style callback `(err, result)`, called when complete
   * @return  none
   */
  function _preopenPopup(callback) {
    if (o.singlepage) {
      callback(null, undefined);
      return;
    }

    // Create a 550x610 popup window in the center of the screen
    var w = 550;
    var h = 610;
    var settings = [
        ['width', w],
        ['height', h],
        ['left', window.screen.width / 2 - w / 2],
        ['top', window.screen.height / 2 - h / 2],
      ]
      .map(function (x) { return x.join('='); })
      .join(',');
    var popup = window.open('about:blank', 'oauth_window', settings);
    if (popup) {
      callback(null, popup);
    } else {
      var error = new Error('Popup was blocked');
      error.status = 'popup-blocked';
      callback(error);
    }
  }


  /**
   * _authenticate
   * internal authenticate
   *
   * @typedef {{ switchUser?: boolean }} LoginOptions
   *
   * @param  {Object}    pkce      Object containing PKCE code challenge properties
   * @param  {LoginOptions=}   options   Other options
   * @param  {Window}    popup     Popup Window to use for the authentication page, should be undefined when using singlepage mode
   * @param  {function}  callback  Errback-style callback that accepts `(err, result)`
   */
  function _authenticate(pkce, options, popup, callback) {
    var state = generateState();

    // ## Request authorization to access resources from the user
    // and receive authorization code
    var path =
      '/oauth2/authorize?' +
      utilQsString({
        client_id: o.client_id,
        redirect_uri: o.redirect_uri,
        response_type: 'code',
        scope: o.scope,
        state: state,
        code_challenge: pkce.code_challenge,
        code_challenge_method: pkce.code_challenge_method,
        locale: o.locale || '',
      });

    var url = options?.switchUser
      ? `${o.url}/logout?referer=${encodeURIComponent(`/login?referer=${encodeURIComponent(path)}`)}`
      : o.url + path;

    if (o.singlepage) {
      if (_store.isMocked) {
        // in singlepage mode, PKCE requires working non-volatile storage
        var error = new Error('localStorage unavailable, but required in singlepage mode');
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
      oauth.popupWindow = popup;
      popup.location = url;
    }

    // Called by a function in the redirect URL page, in the popup window. The
    // window closes itself.
    var bc = new BroadcastChannel(CHANNEL_ID);
    bc.addEventListener('message', (event) => {
      var url = event.data;
      var params = utilStringQs(url.split('?')[1]);
      if (params.state !== state) {
        var error = new Error('Invalid state');
        error.status = 'invalid-state';
        callback(error);
        return;
      }
      _getAccessToken(params.code, pkce.code_verifier, accessTokenDone);
      bc.close();
    });

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


  /**
   * _getAccessToken
   * The client requests an access token by authenticating with the
   * authorization server and presenting the `auth_code`, brought
   * in from a function call on a landing page popup.
   * @param  {string}    auth_code
   * @param  {string}    code_verifier
   * @param  {function}  accessTokenDone  Errback-style callback `(err, result)`, called when complete
   */
  function _getAccessToken(auth_code, code_verifier, accessTokenDone) {
    var url =
      o.url +
      '/oauth2/token?' +
      utilQsString({
        client_id: o.client_id,
        redirect_uri: o.redirect_uri,
        grant_type: 'authorization_code',
        code: auth_code,
        code_verifier: code_verifier
      });

    // The authorization server authenticates the client and validates
    // the authorization grant, and if valid, issues an access token.
    oauth.rawxhr('POST', url, null, null, null, accessTokenDone);
    o.loading();
  }


  /**
   * bringPopupWindowToFront
   * Tries to bring an existing authentication popup to the front.
   *
   * @return {boolean} `true` if it succeeded, `false` if not
   */
  oauth.bringPopupWindowToFront = function() {
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
   * @param   {string}   auth_code  The OAuth2 `auth_code`
   * @param   {function} callback   Errback-style callback `(err, result)`, called when complete
   * @return  none
   */
  oauth.bootstrapToken = function(auth_code, callback) {
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
    _getAccessToken(auth_code, code_verifier, accessTokenDone);

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
   * A `fetch` wrapper that includes the Authorization header if the user is authenticated.
   * https://developer.mozilla.org/en-US/docs/Web/API/fetch
   *
   * @param  {string}   resource    Resource passed to `fetch`
   * @param  {Object}   options     Options passed to `fetch`
   * @return {Promise}  Promise that wraps `authenticateAsync` then `fetch`
   */
  oauth.fetch = function(resource, options) {
    if (oauth.authenticated()) {
      return _doFetch();
    } else {
      if (o.auto) {
        return oauth.authenticateAsync().then(_doFetch);
      } else {
        return Promise.reject(new Error('not authenticated'));
      }
    }

    function _doFetch() {
      options = options || {};
      if (!options.headers) {
        options.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
      }
      options.headers.Authorization = 'Bearer ' + token('oauth2_access_token');
      return fetch(resource, options);
    }
  };


  /**
   * xhr
   * A `XMLHttpRequest` wrapper that does authenticated calls if the user has logged in.
   * https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
   *
   * @param   {Object} options
   * @param    options.method   Passed to `xhr.open`  (e.g. 'GET', 'POST')
   * @param    options.prefix   If `true` path contains a path, if `false` path contains the full url
   * @param    options.path     The URL path (e.g. "/api/0.6/user/details") (or full url, if `prefix`=`false`)
   * @param    options.content  Passed to `xhr.send`
   * @param    options.headers  `Object` containing request headers
   * @param   {function}         callback  Errback-style callback `(err, result)`, called when complete
   * @return  {XMLHttpRequest}  `XMLHttpRequest` if authenticated, otherwise `null`
   */
  oauth.xhr = function (options, callback) {
    if (oauth.authenticated()) {
      return _doXHR();
    } else {
      if (o.auto) {
        oauth.authenticate(_doXHR);
        return;
      } else {
        callback('not authenticated', null);
        return;
      }
    }

    function _doXHR() {
      var url = options.prefix !== false ? (o.apiUrl + options.path) : options.path;
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
  oauth.rawxhr = function(method, url, access_token, data, headers, callback) {
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
   * @param   {Object}  val  Object containing `access_token` property
   * @return  `self`
   */
  oauth.preauth = function(val) {
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
  oauth.options = function(val) {
    if (!arguments.length) return o;

    o = val;
    o.apiUrl = o.apiUrl || 'https://api.openstreetmap.org';
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
  // Handle options and attempt to pre-authorize
  oauth.options(o);

  return oauth;
}


/**
 * utilQsString
 * Transforms object of `key=value` pairs into query string
 * @param   {Object}  Object of `key=value` pairs
 * @returns {string}  query string
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

/**
 * utilStringQs
 * Transforms query string into object of `key=value` pairs
 * @param   {string}  query string
 * @returns {Object}  Object of `key=value` pairs
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


/**
 * Generates a challenge/verifier pair for PKCE.
 * If the browser does not support the WebCryptoAPI, the "plain" method is
 * used as a fallback instead of a SHA-256 hash.
 * @param {callback} callback called with the result of the generated PKCE challenge
 */
function _generatePkceChallenge(callback) {
  var code_verifier;
  // generate a random code_verifier
  // https://datatracker.ietf.org/doc/html/rfc7636#section-7.1
  var random = globalThis.crypto.getRandomValues(new Uint8Array(32));
  code_verifier = base64(random.buffer);
  var verifier = Uint8Array.from(Array.from(code_verifier).map(function(char) {
    return char.charCodeAt(0);
  }));

  // generate challenge for code verifier
  globalThis.crypto.subtle.digest('SHA-256', verifier).then(function(hash) {
    var code_challenge = base64(hash);

    callback({
      code_challenge: code_challenge,
      code_verifier: code_verifier,
      code_challenge_method: 'S256'
    });
  });
}


/**
 * Returns a random state to be used as the "state" of the OAuth2 authentication
 * See https://datatracker.ietf.org/doc/html/rfc6749#section-10.12
 */
function generateState() {
  var state;
  var random = globalThis.crypto.getRandomValues(new Uint8Array(32));
  state = base64(random.buffer);

  return state;
}


/**
 * base64
 * Converts binary buffer to base64 encoded string, as used in rfc7636
 * @param    {ArrayBuffer}  buffer
 * @returns  {string}       base64 encoded
 */
function base64(buffer) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)))
    .replace(/\//g, '_')
    .replace(/\+/g, '-')
    .replace(/[=]/g, '');
}

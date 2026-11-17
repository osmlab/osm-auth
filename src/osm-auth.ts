
/**
 * osmAuth
 * Easy authentication with OpenStreetMap over OAuth 2.0.
 * @module
 */

// The public types use DOM types (`Window`, `XMLHttpRequest`, `RequestInit`…), so the generated
// .d.ts must bring in the DOM lib for consumers that don't include it themselves.
/// <reference lib="dom" preserve="true" />


/** Options for the `osmAuth` constructor and `options()` setter */
export interface OSMAuthOptions {
  /** OAuth2 scopes requested (e.g. "read_prefs write_api") */
  scope: string;
  /** OAuth2 client ID */
  client_id: string;
  /** OAuth2 redirect URI (e.g. "http://127.0.0.1:8080/land.html") */
  redirect_uri: string;
  /** Can pre-authorize with an OAuth2 bearer token if you have one */
  access_token?: string;
  /** A base url for the OSM API (default: "https://api.openstreetmap.org") */
  apiUrl?: string;
  /** A base url for the OAuth2 handshake (default: "https://www.openstreetmap.org") */
  url?: string;
  /** If `true`, attempt to authenticate automatically when calling `.xhr()` or `.fetch()` (default: `false`) */
  auto?: boolean;
  /** If `true`, use page redirection instead of a popup (default: `false`) */
  singlepage?: boolean;
  /** Function called when auth-related xhr calls start */
  loading?: () => void;
  /** Function called when auth-related xhr calls end */
  done?: () => void;
  /** The locale to use on the OAuth2 authentication page. Optional. */
  locale?: string;
}

/** The options as returned by the `options()` getter, with defaults filled in */
export interface OSMAuthResolvedOptions extends OSMAuthOptions {
  apiUrl: string;
  url: string;
  auto: boolean;
  singlepage: boolean;
  loading: () => void;
  done: () => void;
}

/** Other options for `authenticate()` and `authenticateAsync()` */
export interface LoginOptions {
  /** If `true`, the user is first prompted to logout, then login, then go to the OAuth2 flow */
  switchUser?: boolean;
}

/** Options for `fetch()`, passed to `fetch` */
export interface OSMAuthFetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
}

/** Options for `xhr()` */
export interface OSMAuthXHROptions {
  /** Passed to `xhr.open`  (e.g. 'GET', 'POST') */
  method: 'POST' | 'PUT' | 'GET' | 'DELETE';
  /** The URL path (e.g. "/api/0.6/user/details") (or full url, if `prefix`=`false`) */
  path: string;
  /** Passed to `xhr.send` */
  content?: Document | XMLHttpRequestBodyInit | null;
  /** If `true` path contains a path, if `false` path contains the full url */
  prefix?: boolean;
  /** `Object` containing request headers */
  headers?: Record<string, string>;
}

/** An "errback"-style callback `(err, result)`, called when complete */
export type OSMAuthCallback<T> = (err: OSMAuthError | null, result?: T) => void;

/** Other details for an `OSMAuthError` */
export interface OSMAuthErrorOptions {
  /** The HTTP status, for an `'http-error'` */
  status?: number;
  /** The failed request, for an `'http-error'` or `'network-error'` */
  xhr?: XMLHttpRequest;
  /** What caused the error, e.g. the `ProgressEvent` of a network error */
  cause?: unknown;
}

/**
 * OSMAuthError
 * The error that osm-auth reports for every failure.
 * `code` says what went wrong:
 *  - `'popup-blocked'`: the browser blocked the login popup
 *  - `'invalid-state'`: the redirect from OSM didn't carry the `state` this login sent
 *  - `'not-authenticated'`: a request needs a login, and `auto` isn't set
 *  - `'pkce-localstorage-unavailable'`: single-page mode needs `localStorage`, and there isn't one
 *  - `'http-error'`: a request got a response that isn't 20x (see `status` and `xhr`)
 *  - `'network-error'`: a request failed without a response (see `xhr`)
 *  - an OAuth error code from OSM's redirect, e.g. `'access_denied'`
 */
export class OSMAuthError extends Error {
  /** What went wrong, see above */
  code: string;
  /** The HTTP status, for an `'http-error'` */
  status?: number;
  /** The failed request, for an `'http-error'` or `'network-error'` */
  xhr?: XMLHttpRequest;

  /**
   * @param  message  The error message
   * @param  code     What went wrong, see above
   * @param  options  Other details
   */
  constructor(message: string, code: string, options?: OSMAuthErrorOptions) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'OSMAuthError';
    this.code = code;
    if (options?.status !== undefined) {
      this.status = options.status;
    }
    if (options?.xhr !== undefined) {
      this.xhr = options.xhr;
    }
  }
}

/** The parts of `Storage` that osm-auth uses */
type TokenStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** A PKCE code challenge and verifier, see rfc7636 */
interface PkceChallenge {
  code_challenge: string;
  code_verifier: string;
  code_challenge_method: 'S256';
}

/** Callback for `rawxhr()` */
export type OSMAuthRawXHRCallback = (err: OSMAuthError | null, xhr: XMLHttpRequest | null) => void;


const CHANNEL_ID = 'osm-api-auth-complete';


/**
 * osmAuth
 * Easy authentication with OpenStreetMap over OAuth 2.0.
 */
export class osmAuth {
  /** The popup window used for authentication, once one has been opened */
  popupWindow?: Window;

  private _options: OSMAuthResolvedOptions;
  private _store: TokenStore;
  private _storeIsMocked: boolean;


  /**
   * @param  options  Object containing options, see `OSMAuthOptions`
   */
  constructor(options: OSMAuthOptions) {
    // Mock localStorage if needed.
    // Note that accessing localStorage may throw a `SecurityError`, so wrap in a try/catch.
    try {
      if (!globalThis.localStorage) {
        throw new Error('No localStorage');
      }
      this._store = globalThis.localStorage;
      this._storeIsMocked = false;

    } catch (e) {
      const _mock = new Map<string, string>();
      this._store = {
        getItem: (k) => _mock.get(k) ?? null,
        setItem: (k, v) => { _mock.set(k, v); },
        removeItem: (k) => { _mock.delete(k); }
      };
      this._storeIsMocked = true;
    }

    // Handle options and attempt to pre-authorize
    this._options = resolveOptions(options);
    this.preauth(this._options);
  }


  /**
   * _getToken
   * Get a stored token. These are prefixed with the base URL so that `osm-auth`
   * can be used with multiple APIs and the keys in `localStorage` will not clash
   * @param   k  key
   * @return  The stored value, or '' if there isn't one
   */
  private _getToken(k: string): string {
    const val = this._store.getItem(this._options.url + k) || '';
    // Note: legacy tokens might be wrapped in double quotes - remove them, see #129
    return val.replace(/"/g, '');
  }


  /**
   * _setToken
   * Set a stored token, or remove it if `v` is empty. See `_getToken`.
   * @param  k  key
   * @param  v  value
   */
  private _setToken(k: string, v: string | undefined): void {
    const key = this._options.url + k;
    if (v) {
      this._store.setItem(key, v);
    } else {
      this._store.removeItem(key);
    }
  }


  /**
   * authenticated
   * Test whether the user is currently authenticated
   *
   * @return `true` if authenticated, `false` if not
   */
  authenticated(): boolean {
    return !!this._getToken('oauth2_access_token');
  }


  /**
   * getAccessToken
   * Return the current stored access token, if any
   *
   * @return The access token, or '' if user is not authenticated.
   */
  getAccessToken(): string {
    return this._getToken('oauth2_access_token');
  }


  /**
   * logout
   * Removes any stored authentication tokens (legacy OAuth1 tokens too)
   *
   * @return  `self`
   */
  logout(): this {
    this._setToken('oauth2_access_token', '');         // OAuth2
    this._setToken('oauth_token', '');                 // OAuth1
    this._setToken('oauth_token_secret', '');          // OAuth1
    this._setToken('oauth_request_token_secret', '');  // OAuth1
    return this;
  }


  /**
   * authenticate
   * If already authenticated, calls the callback right away. Otherwise clears any stored
   * tokens, runs the authentication flow, and then calls the callback.
   * TODO: detect lack of click event  (probably can settimeout it)
   *
   * @param   callback  Errback-style callback `(err, result)`, called when complete
   * @param   options   Other options
   */
  authenticate(callback: OSMAuthCallback<osmAuth>, options?: LoginOptions): void {
    if (this.authenticated()) {
      callback(null, this);
      return;
    }

    this.logout();

    this._preopenPopup((error, popup) => {
      if (error) {
        callback(error);
      } else {
        _generatePkceChallenge((pkce) => {
          this._authenticate(pkce, options, popup, callback);
        });
      }
    });
  }


  /**
   * authenticateAsync
   * Promisified version of `authenticate`
   * @param   options  Other options
   * @return  Promise settled with whatever `_authenticate` did
   */
  authenticateAsync(options?: LoginOptions): Promise<osmAuth> {
    return new Promise((resolve, reject) => {
      this.authenticate((err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result as osmAuth);
        }
      }, options);
    });
  }


  /**
   * opens an empty popup to be later used for the authentication page
   * @param   callback  Errback-style callback `(err, result)`, called when complete
   */
  private _preopenPopup(callback: (err: OSMAuthError | null, popup?: Window) => void): void {
    if (this._options.singlepage) {
      callback(null, undefined);
      return;
    }

    // Create a 550x610 popup window in the center of the screen
    const w = 550;
    const h = 610;
    const settings = [
        ['width', w],
        ['height', h],
        ['left', window.screen.width / 2 - w / 2],
        ['top', window.screen.height / 2 - h / 2],
      ]
      .map(function (x) { return x.join('='); })
      .join(',');
    const popup = window.open('about:blank', 'oauth_window', settings);
    if (popup) {
      callback(null, popup);
    } else {
      callback(new OSMAuthError('Popup was blocked', 'popup-blocked'));
    }
  }


  /**
   * _authenticate
   * internal authenticate
   *
   * @param  pkce      Object containing PKCE code challenge properties
   * @param  options   Other options
   * @param  popup     Popup Window to use for the authentication page, should be undefined when using singlepage mode
   * @param  callback  Errback-style callback that accepts `(err, result)`
   */
  private _authenticate(pkce: PkceChallenge, options: LoginOptions | undefined, popup: Window | undefined, callback: OSMAuthCallback<osmAuth>): void {
    const o = this._options;
    const state = generateState();

    // ## Request authorization to access resources from the user
    // and receive authorization code
    const path =
      '/oauth2/authorize?' +
      new URLSearchParams({
        client_id: o.client_id,
        redirect_uri: o.redirect_uri,
        response_type: 'code',
        scope: o.scope,
        state: state,
        code_challenge: pkce.code_challenge,
        code_challenge_method: pkce.code_challenge_method,
        locale: o.locale || '',
      }).toString();

    const url = options?.switchUser
      ? `${o.url}/logout?referer=${encodeURIComponent(`/login?referer=${encodeURIComponent(path)}`)}`
      : o.url + path;

    if (o.singlepage) {
      if (this._storeIsMocked) {
        // in singlepage mode, PKCE requires working non-volatile storage
        callback(new OSMAuthError('localStorage unavailable, but required in singlepage mode', 'pkce-localstorage-unavailable'));
        return;
      }
      const code = new URLSearchParams(window.location.search).get('code');
      if (code) {
        this.bootstrapToken(code, callback);
      } else {
        // save OAuth2 state and PKCE challenge in local storage, for later use
        // in the `/oauth/token` request
        this._setToken('oauth2_state', state);
        this._setToken('oauth2_pkce_code_verifier', pkce.code_verifier);
        window.location.href = url;
      }
    } else if (popup) {
      this.popupWindow = popup;
      popup.location.href = url;
    }

    // Called by a function in the redirect URL page, in the popup window. The
    // window closes itself.
    const bc = new BroadcastChannel(CHANNEL_ID);
    bc.addEventListener('message', (event: MessageEvent<unknown>) => {
      bc.close();
      const url = typeof event.data === 'string' ? event.data : '';
      const params = new URLSearchParams(url.split('?')[1] ?? '');
      const error = params.get('error');
      if (params.get('state') !== state) {
        callback(new OSMAuthError('Invalid state', 'invalid-state'));
        return;
      } else if (error !== null) {
        callback(new OSMAuthError(params.get('error_description') || error, error));
        return;
      }
      this._requestAccessToken(params.get('code'), pkce.code_verifier, this._accessTokenDone(callback));
    });
  }


  /**
   * _accessTokenDone
   * Returns the callback for `_requestAccessToken`, which stores the access token
   * and then calls `callback`.
   * @param   callback  Errback-style callback `(err, result)`, called when complete
   * @return  Callback for `rawxhr`
   */
  private _accessTokenDone(callback: OSMAuthCallback<osmAuth>): OSMAuthRawXHRCallback {
    return (err, xhr) => {
      this._options.done();
      if (err || !xhr) {
        callback(err);
        return;
      }
      this._setToken('oauth2_access_token', parseAccessToken(xhr));
      callback(null, this);
    };
  }


  /**
   * _requestAccessToken
   * The client requests an access token by authenticating with the
   * authorization server and presenting the `auth_code`, brought
   * in from a function call on a landing page popup.
   * @param  auth_code
   * @param  code_verifier
   * @param  accessTokenDone  Errback-style callback `(err, result)`, called when complete
   */
  private _requestAccessToken(auth_code: string | null, code_verifier: string, accessTokenDone: OSMAuthRawXHRCallback): void {
    const o = this._options;
    const params = new URLSearchParams({
      client_id: o.client_id,
      redirect_uri: o.redirect_uri,
      grant_type: 'authorization_code'
    });
    if (auth_code !== null) {
      params.set('code', auth_code);
    }
    params.set('code_verifier', code_verifier);
    const url = o.url + '/oauth2/token?' + params.toString();

    // The authorization server authenticates the client and validates
    // the authorization grant, and if valid, issues an access token.
    this.rawxhr('POST', url, null, null, null, accessTokenDone);
    o.loading();
  }


  /**
   * bringPopupWindowToFront
   * Tries to bring an existing authentication popup to the front.
   *
   * @return `true` if it succeeded, `false` if not
   */
  bringPopupWindowToFront(): boolean {
    let broughtPopupToFront = false;
    try {
      // This may cause a cross-origin error:
      // `DOMException: Blocked a frame with origin "..." from accessing a cross-origin frame.`
      if (this.popupWindow && !this.popupWindow.closed) {
        this.popupWindow.focus();
        broughtPopupToFront = true;
      }
    } catch (err) {
      // Bringing popup window to front failed (probably because of the cross-origin error mentioned above)
    }
    return broughtPopupToFront;
  }


  /**
   * bootstrapToken
   * The authorization code is a temporary code that a client can exchange for an access token.
   * If using this library in single-page mode, you'll need to call this once your application
   * has an `auth_code` and wants to get an access_token.
   *
   * @param   auth_code  The OAuth2 `auth_code`
   * @param   callback   Errback-style callback `(err, result)`, called when complete
   */
  bootstrapToken(auth_code: string, callback: OSMAuthCallback<osmAuth>): void {
    const state = this._getToken('oauth2_state');
    this._setToken('oauth2_state', '');
    if (new URLSearchParams(window.location.search).get('state') !== state) {
      callback(new OSMAuthError('Invalid state', 'invalid-state'));
      return;
    }
    const code_verifier = this._getToken('oauth2_pkce_code_verifier');
    this._setToken('oauth2_pkce_code_verifier', '');
    this._requestAccessToken(auth_code, code_verifier, this._accessTokenDone(callback));
  }


  /**
   * fetch
   * A `fetch` wrapper that includes the Authorization header if the user is authenticated.
   * https://developer.mozilla.org/en-US/docs/Web/API/fetch
   *
   * @param  resource    Resource passed to `fetch`
   * @param  options     Options passed to `fetch`
   * @return Promise that wraps `authenticateAsync` then `fetch`
   */
  fetch(resource: string, options?: OSMAuthFetchOptions): Promise<Response> {
    const _doFetch = (): Promise<Response> => {
      options = options || {};
      if (!options.headers) {
        options.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
      }
      options.headers['Authorization'] = 'Bearer ' + this._getToken('oauth2_access_token');
      return fetch(resource, options);
    };

    if (this.authenticated()) {
      return _doFetch();
    } else {
      if (this._options.auto) {
        return this.authenticateAsync().then(_doFetch);
      } else {
        return Promise.reject(new OSMAuthError('Not authenticated', 'not-authenticated'));
      }
    }
  }


  /**
   * xhr
   * A `XMLHttpRequest` wrapper that does authenticated calls if the user has logged in.
   * https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
   *
   * @param   options   Options, see `OSMAuthXHROptions`
   * @param   callback  Errback-style callback `(err, result)`, called when complete
   * @return  `XMLHttpRequest` if authenticated, otherwise `null`
   */
  xhr(options: OSMAuthXHROptions, callback: OSMAuthCallback<Document | string>): XMLHttpRequest | null {
    const done: OSMAuthRawXHRCallback = (err, xhr) => {
      if (err || !xhr) {
        callback(err);
      } else if (xhr.responseXML) {
        callback(err, xhr.responseXML);
      } else {
        callback(err, xhr.response);
      }
    };

    const _doXHR = (): XMLHttpRequest => {
      const url = options.prefix !== false ? (this._options.apiUrl + options.path) : options.path;
      return this.rawxhr(
        options.method,
        url,
        this._getToken('oauth2_access_token'),
        options.content,
        options.headers,
        done
      );
    };

    if (this.authenticated()) {
      return _doXHR();
    } else {
      if (this._options.auto) {
        this.authenticate(_doXHR);
        return null;
      } else {
        callback(new OSMAuthError('Not authenticated', 'not-authenticated'));
        return null;
      }
    }
  }


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
  rawxhr(
    method: string,
    url: string,
    access_token: string | null,
    data: Document | XMLHttpRequestBodyInit | null | undefined,
    headers: Record<string, string> | null | undefined,
    callback: OSMAuthRawXHRCallback
  ): XMLHttpRequest {
    headers = headers || { 'Content-Type': 'application/x-www-form-urlencoded' };

    if (access_token) {
      headers['Authorization'] = 'Bearer ' + access_token;
    }

    const xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function () {
      if (4 === xhr.readyState && 0 !== xhr.status) {
        if (/^20\d$/.test(String(xhr.status))) {   // a 20x status code - OK
          callback(null, xhr);
        } else {
          const message = `Request failed with HTTP status ${xhr.status}`;
          callback(new OSMAuthError(message, 'http-error', { status: xhr.status, xhr: xhr }), null);
        }
      }
    };
    xhr.onerror = function (e) {
      callback(new OSMAuthError('Request failed with a network error', 'network-error', { xhr: xhr, cause: e }), null);
    };

    xhr.open(method, url, true);
    for (const [h, v] of Object.entries(headers)) xhr.setRequestHeader(h, v);

    xhr.send(data);
    return xhr;
  }


  /**
   * preauth
   * Pre-authorize this object, if we already have access token from the start
   *
   * @param   val  Object containing `access_token` property
   * @return  `self`
   */
  preauth(val: { access_token?: string }): this {
    if (val && val.access_token) {
      this._setToken('oauth2_access_token', val.access_token);
    }
    return this;
  }


  /**
   * options  (getter / setter)
   * If passed with no arguments, just return the options
   * If passed an Object, set the options then attempt to pre-authorize
   * Options are copied in both directions, so changing the returned object doesn't
   * change this instance's options.
   *
   * @param   val?   Object containing options
   * @return  current `options` (if getting), or `self` (if setting)
   */
  options(): OSMAuthResolvedOptions;
  options(val: OSMAuthOptions): this;
  options(val?: OSMAuthOptions): OSMAuthResolvedOptions | this {
    if (val === undefined) return { ...this._options };

    this._options = resolveOptions(val);
    return this.preauth(this._options);
  }
}


/**
 * resolveOptions
 * Copies the given options and fills in defaults
 * @param   val  Object containing options
 * @return  A new object containing options and defaults
 */
function resolveOptions(val: OSMAuthOptions): OSMAuthResolvedOptions {
  return {
    ...val,
    apiUrl: val.apiUrl || 'https://api.openstreetmap.org',
    url: val.url || 'https://www.openstreetmap.org',
    auto: val.auto || false,
    singlepage: val.singlepage || false,

    // Optional loading and loading-done functions for nice UI feedback.
    // by default, no-ops
    loading: val.loading || function () {},
    done: val.done || function () {}
  };
}


/**
 * parseAccessToken
 * Gets the access token from the `/oauth2/token` response
 * @param   xhr  The completed request
 * @returns The access token, or '' if the response doesn't have one
 */
function parseAccessToken(xhr: XMLHttpRequest): string {
  const body: unknown = JSON.parse(xhr.response);
  if (typeof body === 'object' && body !== null && 'access_token' in body && typeof body.access_token === 'string') {
    return body.access_token;
  }
  return '';
}


/**
 * Generates a challenge/verifier pair for PKCE.
 * @param callback called with the result of the generated PKCE challenge
 */
function _generatePkceChallenge(callback: (pkce: PkceChallenge) => void): void {
  // generate a random code_verifier
  // https://datatracker.ietf.org/doc/html/rfc7636#section-7.1
  const random = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const code_verifier = base64(random);
  const verifier = Uint8Array.from(Array.from(code_verifier).map(function(char) {
    return char.charCodeAt(0);
  }));

  // generate challenge for code verifier
  globalThis.crypto.subtle.digest('SHA-256', verifier).then(function(hash) {
    const code_challenge = base64(new Uint8Array(hash));

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
function generateState(): string {
  const random = globalThis.crypto.getRandomValues(new Uint8Array(32));
  return base64(random);
}


/**
 * base64
 * Converts binary data to base64 encoded string, as used in rfc7636
 * @param    bytes  binary data
 * @returns  base64 encoded
 */
function base64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\//g, '_')
    .replace(/\+/g, '-')
    .replace(/[=]/g, '');
}

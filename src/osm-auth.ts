
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

/**
 * The options as returned by the `options()` getter, with defaults filled in.
 * `access_token` isn't kept: it's stored with the other tokens, see `getAccessToken()`.
 */
export interface OSMAuthResolvedOptions extends Omit<OSMAuthOptions, 'access_token'> {
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
  /** Request headers, as an object, an array of pairs, or a `Headers` */
  headers?: HeadersInit;
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
  /** The failed request, for an `'http-error'`, `'network-error'`, `'timeout'` or `'invalid-token-response'` */
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
 *  - `'timeout'`: a request took longer than the `timeout` set on it (see `xhr`)
 *  - `'invalid-token-response'`: the token request succeeded, but its response has no access token (see `xhr`)
 *  - `'crypto-unavailable'`: PKCE needs Web Crypto, which browsers only offer in a secure context
 *  - an OAuth error code from OSM's redirect, e.g. `'access_denied'`
 */
export class OSMAuthError extends Error {
  /** What went wrong, see above */
  code: string;
  /** The HTTP status, for an `'http-error'` */
  status?: number;
  /** The failed request, for an `'http-error'`, `'network-error'`, `'timeout'` or `'invalid-token-response'` */
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

/** What's needed to finish a popup login with the code from one attempt's redirect */
interface LoginAttempt {
  code_verifier: string;
  /** The options when the attempt started */
  options: OSMAuthResolvedOptions;
}

/** A popup login that's waiting for the redirect from OSM */
interface PendingLogin {
  /** The attempts so far, by the `state` each one sent */
  attempts: Map<string, LoginAttempt>;
  /** Everyone waiting for the login to end */
  callbacks: Array<OSMAuthCallback<osmAuth>>;
  channel: BroadcastChannel;
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
  private _pending: PendingLogin | null = null;


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
      this._store = memoryStore();
      this._storeIsMocked = true;
    }

    // Handle options and attempt to pre-authorize
    this._options = resolveOptions(options);
    this.preauth(options);
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
   * @param  k    key
   * @param  v    value
   * @param  url  The base URL the token is for (default: the `url` option)
   */
  private _setToken(k: string, v: string | undefined, url: string = this._options.url): void {
    const key = url + k;
    const write = (): void => {
      if (v) {
        this._store.setItem(key, v);
      } else {
        this._store.removeItem(key);
      }
    };
    try {
      write();
    } catch (e) {
      // localStorage can throw, e.g. when it's full. Keep the tokens in memory from now on,
      // so the user can still log in, for as long as the page lasts.
      this._store = memoryStore();
      this._storeIsMocked = true;
      write();
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
   * In popup mode, calling it again while a login is in progress opens another popup, and the
   * login ends when the user finishes in any of them: then every callback is called.
   * If the user closes the popup without finishing, the callback isn't called until a later
   * attempt ends, because the page can't tell (see `bringPopupWindowToFront`).
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

    // PKCE needs Web Crypto, which browsers only offer in a secure context.
    // Check before opening the popup, so a failure doesn't leave a blank one behind.
    if (!globalThis.crypto?.subtle) {
      callback(new OSMAuthError('Web Crypto is unavailable. It needs a secure context: https, or http://127.0.0.1', 'crypto-unavailable'));
      return;
    }

    this.logout();

    this._preopenPopup((error, popup) => {
      if (error) {
        callback(error);
      } else {
        _generatePkceChallenge((err, pkce) => {
          if (err || !pkce) {
            popup?.close();
            callback(new OSMAuthError('Could not make the PKCE challenge', 'crypto-unavailable', { cause: err }));
          } else {
            this._authenticate(pkce, options, popup, callback);
          }
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
        if (this._storeIsMocked) {
          // saving them failed (see `_setToken`), so they wouldn't survive the redirect
          callback(new OSMAuthError('localStorage unavailable, but required in singlepage mode', 'pkce-localstorage-unavailable'));
          return;
        }
        window.location.href = url;
      }
    } else if (popup) {
      this.popupWindow = popup;
      popup.location.href = url;
      this._waitForRedirect(state, { code_verifier: pkce.code_verifier, options: o }, callback);
    }
  }


  /**
   * _waitForRedirect
   * Adds a popup login attempt to the pending login, listening for the redirect if this is the
   * first attempt. Attempts made while a login is pending (e.g. a double click, or another try
   * after the user closed the popup) share its result: the login ends when the redirect for any
   * of them arrives, and then every callback is called.
   * @param  state     The `state` this attempt sent to the authorize page
   * @param  attempt   What's needed to finish the login with this attempt's code
   * @param  callback  Errback-style callback `(err, result)`, called when the login ends
   */
  private _waitForRedirect(state: string, attempt: LoginAttempt, callback: OSMAuthCallback<osmAuth>): void {
    let pending = this._pending;
    if (!pending) {
      // The redirect URL page (`land.html`) posts its URL here, then closes its window.
      const channel = new BroadcastChannel(CHANNEL_ID);
      const newPending: PendingLogin = { attempts: new Map(), callbacks: [], channel: channel };
      channel.addEventListener('message', (event: MessageEvent<unknown>) => this._onRedirect(newPending, event));
      this._pending = pending = newPending;
    }
    pending.attempts.set(state, attempt);
    pending.callbacks.push(callback);
  }


  /**
   * _onRedirect
   * Handles a redirect URL posted by the redirect URL page. A redirect for a `state` that isn't
   * one of this login's is ignored: it's for another login (another instance, or another tab),
   * or for an attempt that has already ended.
   * @param  pending  The pending login
   * @param  event    The message, with the redirect URL as its data
   */
  private _onRedirect(pending: PendingLogin, event: MessageEvent<unknown>): void {
    const url = typeof event.data === 'string' ? event.data : '';
    const params = new URLSearchParams(url.split('?')[1] ?? '');
    const attempt = pending.attempts.get(params.get('state') ?? '');
    if (!attempt) return;

    // The login ends here, whichever way it goes, so the next one starts afresh.
    pending.channel.close();
    if (this._pending === pending) {
      this._pending = null;
    }

    const done: OSMAuthCallback<osmAuth> = (err, result) => {
      for (const callback of pending.callbacks) {
        callback(err, result);
      }
    };

    const error = params.get('error');
    if (error !== null) {
      done(new OSMAuthError(params.get('error_description') || error, error));
      return;
    }
    const o = attempt.options;
    this._requestAccessToken(params.get('code'), attempt.code_verifier, o, this._accessTokenDone(o, done));
  }


  /**
   * _accessTokenDone
   * Returns the callback for `_requestAccessToken`, which stores the access token
   * and then calls `callback`.
   * @param   o         The options from when the login started
   * @param   callback  Errback-style callback `(err, result)`, called when complete
   * @return  Callback for `rawxhr`
   */
  private _accessTokenDone(o: OSMAuthResolvedOptions, callback: OSMAuthCallback<osmAuth>): OSMAuthRawXHRCallback {
    return (err, xhr) => {
      o.done();
      if (err || !xhr) {
        callback(err);
        return;
      }
      const token = parseAccessToken(xhr);
      if (!token) {
        callback(new OSMAuthError('The token response has no access_token', 'invalid-token-response', { xhr: xhr }));
        return;
      }
      this._setToken('oauth2_access_token', token, o.url);
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
   * @param  o                The options from when the login started
   * @param  accessTokenDone  Errback-style callback `(err, result)`, called when complete
   */
  private _requestAccessToken(auth_code: string | null, code_verifier: string, o: OSMAuthResolvedOptions, accessTokenDone: OSMAuthRawXHRCallback): void {
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
   * Once the popup has loaded openstreetmap.org, this can't work: OSM's `Cross-Origin-Opener-Policy`
   * header cuts the popup off from this page, so it looks closed. It's fine to call `authenticate()`
   * again then: it opens another popup, and either one finishes the login.
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
    const o = this._options;
    this._requestAccessToken(auth_code, code_verifier, o, this._accessTokenDone(o, callback));
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
  fetch(resource: RequestInfo | URL, options?: OSMAuthFetchOptions): Promise<Response> {
    const _doFetch = (): Promise<Response> => {
      // Build new headers, so the caller's `options` and `Request` aren't changed.
      // Start from a `Request`'s own headers, because headers in `options` replace them.
      const isRequest = typeof Request !== 'undefined' && resource instanceof Request;
      const headers = new Headers(isRequest ? resource.headers : undefined);
      new Headers(options?.headers).forEach((value, key) => headers.set(key, value));
      if (!isRequest && options?.headers === undefined && isStringOrEmpty(options?.body)) {
        headers.set('Content-Type', 'application/x-www-form-urlencoded');
      }
      headers.set('Authorization', 'Bearer ' + this._getToken('oauth2_access_token'));
      return fetch(resource, { ...options, headers: headers });
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
        this.authenticate((err) => {
          if (err) {
            callback(err);
          } else {
            _doXHR();
          }
        });
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
   *                          (but not if the caller aborts the request)
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
    // Copy the headers, so the caller's object isn't changed.
    const requestHeaders: Record<string, string> = {};
    if (headers) {
      for (const [h, v] of Object.entries(headers)) {
        if (access_token && h.toLowerCase() === 'authorization') continue;  // replaced below
        requestHeaders[h] = v;
      }
    } else if (isStringOrEmpty(data)) {
      requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    if (access_token) {
      requestHeaders['Authorization'] = 'Bearer ' + access_token;
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
    xhr.ontimeout = function (e) {
      callback(new OSMAuthError('Request timed out', 'timeout', { xhr: xhr, cause: e }), null);
    };
    // A request that the caller aborts (`xhr.abort()`) doesn't call back.

    xhr.open(method, url, true);
    for (const [h, v] of Object.entries(requestHeaders)) xhr.setRequestHeader(h, v);

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
    return this.preauth(val);
  }
}


/**
 * resolveOptions
 * Copies the given options and fills in defaults
 * @param   val  Object containing options
 * @return  A new object containing options and defaults
 */
function resolveOptions(val: OSMAuthOptions): OSMAuthResolvedOptions {
  // Leave out `access_token`: it's stored by `preauth()`, and keeping it here would let a
  // round trip through `options()` store it again, over a newer token or after `logout()`.
  const copy: OSMAuthOptions = { ...val };
  delete copy.access_token;
  return {
    ...copy,
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
 * memoryStore
 * A token store kept in memory, for when `localStorage` is missing or doesn't work.
 * Its tokens last only as long as the page.
 * @returns A new, empty store
 */
function memoryStore(): TokenStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
    removeItem: (k) => { map.delete(k); }
  };
}


/**
 * isStringOrEmpty
 * Whether a request body is a string, or there isn't one. Only these get the default
 * `Content-Type: application/x-www-form-urlencoded`; for other bodies (`FormData`, `Blob`,
 * `URLSearchParams`…) the browser sets the right one, e.g. with the multipart boundary.
 * @param   body  The request body
 * @returns `true` if the body is a string, `null` or `undefined`
 */
function isStringOrEmpty(body: unknown): boolean {
  return body === null || body === undefined || typeof body === 'string';
}


/**
 * parseAccessToken
 * Gets the access token from the `/oauth2/token` response
 * @param   xhr  The completed request
 * @returns The access token, or '' if the response doesn't have one
 */
function parseAccessToken(xhr: XMLHttpRequest): string {
  let body: unknown;
  try {
    body = JSON.parse(xhr.response);
  } catch (e) {
    return '';   // not JSON, e.g. an HTML page from a captive portal or proxy
  }
  if (typeof body === 'object' && body !== null && 'access_token' in body && typeof body.access_token === 'string') {
    return body.access_token;
  }
  return '';
}


/**
 * Generates a challenge/verifier pair for PKCE.
 * @param callback called with `(err, pkce)`: the generated PKCE challenge, or why it failed
 */
function _generatePkceChallenge(callback: (err: unknown, pkce?: PkceChallenge) => void): void {
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

    callback(null, {
      code_challenge: code_challenge,
      code_verifier: code_verifier,
      code_challenge_method: 'S256'
    });
  }, function(err: unknown) {
    callback(err);
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

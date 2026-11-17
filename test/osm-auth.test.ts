import { afterAll, afterEach, beforeEach, describe, it } from 'bun:test';
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { osmAuth, OSMAuthError, type LoginOptions, type OSMAuthOptions } from '../src/osm-auth.ts';
import { FakePopup, FakeWindow, FakeXHR, FetchSpy, MemoryStorage, postFromLandPage, setGlobal } from './stubs.ts';


const WWW = 'https://www.openstreetmap.org';
const API = 'https://api.openstreetmap.org';
const REDIRECT = 'http://127.0.0.1:8080/land.html';
const OPTIONS = {
  client_id: 'JWXSAzNp64sIRMStTnkhMRaMxSR964V4sFgn3KUZNTA',
  redirect_uri: REDIRECT,
  scope: 'read_prefs'
} satisfies OSMAuthOptions;

const originalFetch = globalThis.fetch;
let storage: MemoryStorage;
let win: FakeWindow;
let fetchSpy: FetchSpy;

beforeEach(() => {
  storage = new MemoryStorage();
  win = new FakeWindow();
  fetchSpy = new FetchSpy();
  FakeXHR.reset();
  setGlobal('localStorage', storage);
  setGlobal('window', win);
  setGlobal('XMLHttpRequest', FakeXHR);
  setGlobal('fetch', fetchSpy.fetch);
});

afterAll(() => {
  Reflect.deleteProperty(globalThis, 'localStorage');
  Reflect.deleteProperty(globalThis, 'window');
  Reflect.deleteProperty(globalThis, 'XMLHttpRequest');
  setGlobal('fetch', originalFetch);
});


interface AuthResult {
  err: unknown;
  result: osmAuth | undefined;
}

/** `authenticate()`, as a promise that resolves with whatever the callback got */
function authenticateP(auth: osmAuth, options?: LoginOptions): Promise<AuthResult> {
  return new Promise(resolve => {
    auth.authenticate((err, result) => resolve({ err, result }), options);
  });
}

/** Starts a popup login, and waits until the popup is sent to the authorize page */
async function startPopupLogin(auth: osmAuth, options?: LoginOptions) {
  const pending = authenticateP(auth, options);
  const popup = win.lastPopup();
  const authorizeURL = new URL(await popup.location.nextNavigation());
  const state = authorizeURL.searchParams.get('state') ?? '';
  return { pending, popup, authorizeURL, state };
}

/** Asserts that `err` is an `OSMAuthError` with the given `code` (and message), and returns it */
function assertOSMAuthError(err: unknown, code: string, message?: string): OSMAuthError {
  assert.ok(err instanceof OSMAuthError);
  assert.ok(err instanceof Error);
  assert.equal(err.name, 'OSMAuthError');
  assert.equal(err.code, code);
  if (message !== undefined) {
    assert.equal(err.message, message);
  }
  return err;
}

/** base64url-encoded SHA-256, the PKCE S256 transform */
function s256(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/** Waits until BroadcastChannel messages posted so far have been delivered, to test that nothing happened */
function delivered(): Promise<void> {
  return new Promise(resolve => { setTimeout(resolve, 10); });
}


describe('osmAuth', () => {

  describe('options', () => {
    it('fills in defaults, without changing the caller\'s object', () => {
      const given: OSMAuthOptions = { ...OPTIONS };
      const auth = new osmAuth(given);
      const options = auth.options();
      assert.deepEqual(options, {
        ...OPTIONS,
        url: WWW,
        apiUrl: API,
        auto: false,
        singlepage: false,
        loading: options.loading,
        done: options.done
      });
      assert.equal(typeof options.loading, 'function');
      assert.equal(typeof options.done, 'function');
      assert.deepEqual(given, OPTIONS);
    });

    it('keeps options that are given', () => {
      const loading = () => {};
      const done = () => {};
      const given = { ...OPTIONS, url: 'https://example.com', apiUrl: 'https://api.example.com', auto: true, singlepage: true, loading, done, locale: 'de' };
      const auth = new osmAuth(given);
      assert.deepEqual(auth.options(), given);
    });

    it('returns a copy, so changing it doesn\'t change the instance', () => {
      const auth = new osmAuth(OPTIONS);
      const options = auth.options();
      options.url = 'https://example.com';
      assert.equal(auth.options().url, WWW);
    });

    it('replaces all the options when setting, and returns self', () => {
      const auth = new osmAuth({ ...OPTIONS, locale: 'de', auto: true });
      const result = auth.options({ ...OPTIONS, url: 'https://example.com' });
      assert.equal(result, auth);
      assert.equal(auth.options().url, 'https://example.com');
      assert.equal(auth.options().locale, undefined);
      assert.equal(auth.options().auto, false);
    });

    it('pre-authorizes when setting options with an access_token', () => {
      const auth = new osmAuth(OPTIONS);
      auth.options({ ...OPTIONS, access_token: 'foo' });
      assert.equal(auth.getAccessToken(), 'foo');
    });

    it('doesn\'t keep the access_token in the options', () => {
      const auth = new osmAuth({ ...OPTIONS, access_token: 'foo' });
      assert.equal('access_token' in auth.options(), false);
      auth.options({ ...OPTIONS, access_token: 'bar' });
      assert.equal('access_token' in auth.options(), false);
    });

    describe('changing one option with `options({ ...options(), … })`', () => {
      it('doesn\'t log back in after logout()', () => {
        const auth = new osmAuth({ ...OPTIONS, access_token: 'OLD' });
        auth.logout();
        auth.options({ ...auth.options(), locale: 'de' });
        assert.equal(auth.authenticated(), false);
      });

      it('doesn\'t replace a newer token', () => {
        const auth = new osmAuth({ ...OPTIONS, access_token: 'OLD' });
        storage.setItem(`${WWW}oauth2_access_token`, 'NEW');   // e.g. after a login
        auth.options({ ...auth.options(), locale: 'de' });
        assert.equal(auth.getAccessToken(), 'NEW');
      });

      it('doesn\'t copy the token to another server', () => {
        const DEV = 'https://master.apis.dev.openstreetmap.org';
        const auth = new osmAuth({ ...OPTIONS, access_token: 'PROD' });
        auth.options({ ...auth.options(), url: DEV, apiUrl: DEV });
        assert.equal(auth.authenticated(), false);
        assert.equal(storage.getItem(`${DEV}oauth2_access_token`), null);
        assert.equal(storage.getItem(`${WWW}oauth2_access_token`), 'PROD');
      });
    });
  });


  describe('tokens', () => {
    it('is not initially authenticated', () => {
      const auth = new osmAuth(OPTIONS);
      assert.equal(auth.authenticated(), false);
      assert.equal(auth.getAccessToken(), '');
    });

    it('can be pre-authorized with an access_token option', () => {
      const auth = new osmAuth({ ...OPTIONS, access_token: 'foo' });
      assert.equal(auth.authenticated(), true);
      assert.equal(auth.getAccessToken(), 'foo');
    });

    it('can be pre-authorized with preauth()', () => {
      const auth = new osmAuth(OPTIONS);
      assert.equal(auth.preauth({}), auth);
      assert.equal(auth.authenticated(), false);
      assert.equal(auth.preauth({ access_token: 'foo' }), auth);
      assert.equal(auth.getAccessToken(), 'foo');
    });

    it('stores tokens in localStorage, prefixed with the url', () => {
      const osm = new osmAuth({ ...OPTIONS, access_token: 'foo' });
      const other = new osmAuth({ ...OPTIONS, url: 'https://example.com', access_token: 'bar' });
      assert.equal(storage.getItem(`${WWW}oauth2_access_token`), osm.getAccessToken());
      assert.equal(storage.getItem('https://example.comoauth2_access_token'), other.getAccessToken());
      assert.deepEqual(storage.keys(), [`${WWW}oauth2_access_token`, 'https://example.comoauth2_access_token']);
    });

    it('shares tokens between instances with the same url, but not a different url', () => {
      const first = new osmAuth({ ...OPTIONS, access_token: 'foo' });
      assert.equal(first.getAccessToken(), 'foo');
      assert.equal(new osmAuth(OPTIONS).getAccessToken(), 'foo');
      assert.equal(new osmAuth({ ...OPTIONS, url: 'https://example.com' }).authenticated(), false);
    });

    it('removes double quotes from legacy tokens (#129)', () => {
      storage.setItem(`${WWW}oauth2_access_token`, '"foo"');
      assert.equal(new osmAuth(OPTIONS).getAccessToken(), 'foo');
    });

    it('removes OAuth2 and legacy OAuth1 tokens on logout(), and returns self', () => {
      for (const k of ['oauth2_access_token', 'oauth_token', 'oauth_token_secret', 'oauth_request_token_secret']) {
        storage.setItem(WWW + k, 'foo');
      }
      storage.setItem('unrelated', 'foo');
      const auth = new osmAuth(OPTIONS);
      assert.equal(auth.logout(), auth);
      assert.equal(auth.authenticated(), false);
      assert.deepEqual(storage.keys(), ['unrelated']);
    });

    it('keeps tokens in memory if localStorage is missing', () => {
      Reflect.deleteProperty(globalThis, 'localStorage');
      const auth = new osmAuth({ ...OPTIONS, access_token: 'foo' });
      assert.equal(auth.getAccessToken(), 'foo');
      assert.equal(new osmAuth(OPTIONS).authenticated(), false);  // not shared
    });

    it('keeps tokens in memory if localStorage throws', () => {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        get() { throw new Error('SecurityError'); }
      });
      const auth = new osmAuth({ ...OPTIONS, access_token: 'foo' });
      assert.equal(auth.getAccessToken(), 'foo');
      auth.logout();
      assert.equal(auth.authenticated(), false);
    });

    it('keeps tokens in memory if writing to localStorage throws (e.g. it\'s full)', () => {
      storage.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); };
      const auth = new osmAuth({ ...OPTIONS, access_token: 'foo' });
      assert.equal(auth.getAccessToken(), 'foo');
      auth.logout();
      assert.equal(auth.authenticated(), false);
    });
  });


  describe('fetch', () => {
    /** The headers of the `n`th call to `fetch`, as an object with lowercase names */
    function sentHeaders(n = 0): Record<string, string> {
      return Object.fromEntries(new Headers(fetchSpy.calls[n]?.init?.headers));
    }

    it('adds the Authorization header and a default Content-Type', async () => {
      const auth = new osmAuth({ ...OPTIONS, access_token: 'foo' });
      const response = await auth.fetch(`${API}/api/0.6/user/details`, { method: 'GET' });
      assert.equal(await response.text(), 'ok');
      assert.equal(fetchSpy.calls.length, 1);
      assert.equal(fetchSpy.calls[0]?.resource, `${API}/api/0.6/user/details`);
      assert.equal(fetchSpy.calls[0]?.init?.method, 'GET');
      assert.deepEqual(sentHeaders(), {
        'content-type': 'application/x-www-form-urlencoded',
        'authorization': 'Bearer foo'
      });
    });

    it('adds the Authorization header to headers that are given', async () => {
      const auth = new osmAuth({ ...OPTIONS, access_token: 'foo' });
      await auth.fetch(`${API}/x`, { headers: { 'Accept': 'application/json' } });
      assert.deepEqual(sentHeaders(), { 'accept': 'application/json', 'authorization': 'Bearer foo' });
    });

    it('doesn\'t change the caller\'s options or headers', async () => {
      const auth = new osmAuth({ ...OPTIONS, access_token: 'foo' });
      const headers = { 'Accept': 'application/json' };
      const options = { method: 'GET', headers: headers };
      await auth.fetch(`${API}/x`, options);
      assert.deepEqual(options, { method: 'GET', headers: { 'Accept': 'application/json' } });
      assert.equal(options.headers, headers);
    });

    it('accepts headers as a `Headers` or an array of pairs', async () => {
      const auth = new osmAuth({ ...OPTIONS, access_token: 'foo' });
      await auth.fetch(`${API}/x`, { headers: new Headers({ 'Accept': 'application/json' }) });
      await auth.fetch(`${API}/x`, { headers: [['Accept', 'application/json']] });
      assert.deepEqual(sentHeaders(0), { 'accept': 'application/json', 'authorization': 'Bearer foo' });
      assert.deepEqual(sentHeaders(1), { 'accept': 'application/json', 'authorization': 'Bearer foo' });
    });

    it('replaces an Authorization header that is given, whatever its case', async () => {
      const auth = new osmAuth({ ...OPTIONS, access_token: 'foo' });
      await auth.fetch(`${API}/x`, { headers: { 'authorization': 'Bearer old' } });
      assert.deepEqual(sentHeaders(), { 'authorization': 'Bearer foo' });
    });

    it('keeps the headers of a `Request`', async () => {
      const auth = new osmAuth({ ...OPTIONS, access_token: 'foo' });
      const request = new Request(`${API}/x`, { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json', 'X-Foo': '1' } });
      await auth.fetch(request);
      assert.equal(fetchSpy.calls[0]?.resource, request);
      assert.deepEqual(sentHeaders(), { 'content-type': 'application/json', 'x-foo': '1', 'authorization': 'Bearer foo' });
    });

    it('leaves the Content-Type of a `FormData` body to the browser', async () => {
      const auth = new osmAuth({ ...OPTIONS, access_token: 'foo' });
      const body = new FormData();
      body.append('file', 'x');
      await auth.fetch(`${API}/api/0.6/gpx/create`, { method: 'POST', body: body });
      assert.deepEqual(sentHeaders(), { 'authorization': 'Bearer foo' });
    });

    it('rejects if not authenticated', async () => {
      const auth = new osmAuth(OPTIONS);
      const err = await auth.fetch(`${API}/x`).then(() => null, (e: unknown) => e);
      assertOSMAuthError(err, 'not-authenticated', 'Not authenticated');
      assert.equal(fetchSpy.calls.length, 0);
    });

    it('tries to log in first if not authenticated and `auto` is set', async () => {
      win.blockPopups = true;
      const auth = new osmAuth({ ...OPTIONS, auto: true });
      await assert.rejects(auth.fetch(`${API}/x`), { code: 'popup-blocked' });
      assert.equal(fetchSpy.calls.length, 0);
    });
  });


  describe('xhr', () => {
    it('fails if not authenticated, and returns null', () => {
      const auth = new osmAuth(OPTIONS);
      let error: unknown;
      const xhr = auth.xhr({ method: 'GET', path: '/api/0.6/user/details' }, (err) => { error = err; });
      assert.equal(xhr, null);
      assertOSMAuthError(error, 'not-authenticated', 'Not authenticated');
      assert.equal(FakeXHR.requests.length, 0);
    });

    it('logs in first if not authenticated and `auto` is set, then sends the request', async () => {
      const auth = new osmAuth({ ...OPTIONS, auto: true });
      const calls: unknown[][] = [];
      const xhr = auth.xhr({ method: 'GET', path: '/api/0.6/user/details' }, (...args) => calls.push(args));
      assert.equal(xhr, null);

      const authorizeURL = new URL(await win.lastPopup().location.nextNavigation());
      const tokenRequest = FakeXHR.nextRequest();
      postFromLandPage(`${REDIRECT}?code=CODE&state=${authorizeURL.searchParams.get('state')}`);
      (await tokenRequest).respond(200, JSON.stringify({ access_token: 'TOKEN' }));

      const request = FakeXHR.last();
      assert.equal(request.url, `${API}/api/0.6/user/details`);
      assert.equal(request.headers['Authorization'], 'Bearer TOKEN');
      request.respond(200, '{"user":{}}');
      assert.deepEqual(calls, [[null, '{"user":{}}']]);
    });

    it('fails with the login error, and sends nothing, if the `auto` login fails', () => {
      win.blockPopups = true;
      const auth = new osmAuth({ ...OPTIONS, auto: true });
      const calls: unknown[][] = [];
      auth.xhr({ method: 'GET', path: '/api/0.6/user/details' }, (...args) => calls.push(args));
      assert.equal(calls.length, 1);
      assertOSMAuthError(calls[0]?.[0], 'popup-blocked');
      assert.equal(FakeXHR.requests.length, 0);
    });

    it('sends an authenticated request to the API, and returns responseXML', () => {
      const auth = new osmAuth({ ...OPTIONS, access_token: 'foo' });
      const calls: unknown[][] = [];
      const xhr = auth.xhr({ method: 'GET', path: '/api/0.6/user/details' }, (...args) => calls.push(args));

      const request = FakeXHR.last();
      assert.equal(xhr, request);
      assert.equal(request.method, 'GET');
      assert.equal(request.url, `${API}/api/0.6/user/details`);
      assert.equal(request.async, true);
      assert.deepEqual(request.headers, {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Bearer foo'
      });

      const doc = { fake: 'document' };
      request.respond(200, '<osm/>', doc);
      assert.deepEqual(calls, [[null, doc]]);
    });

    it('returns the response text if there is no responseXML', () => {
      const auth = new osmAuth({ ...OPTIONS, access_token: 'foo' });
      const calls: unknown[][] = [];
      auth.xhr({ method: 'GET', path: '/api/0.6/user/details.json' }, (...args) => calls.push(args));
      FakeXHR.last().respond(200, '{"user":{}}');
      assert.deepEqual(calls, [[null, '{"user":{}}']]);
    });

    it('uses `path` as the whole url if `prefix` is false, and sends `content` and `headers`', () => {
      const auth = new osmAuth({ ...OPTIONS, access_token: 'foo' });
      auth.xhr({
        method: 'PUT',
        prefix: false,
        path: 'https://example.com/changeset/create',
        content: '<osm/>',
        headers: { 'Content-Type': 'text/xml' }
      }, () => {});

      const request = FakeXHR.last();
      assert.equal(request.method, 'PUT');
      assert.equal(request.url, 'https://example.com/changeset/create');
      assert.equal(request.body, '<osm/>');
      assert.deepEqual(request.headers, { 'Content-Type': 'text/xml', 'Authorization': 'Bearer foo' });
    });

    it('fails with an http-error, with the status and the request, if the response is not 20x', () => {
      const auth = new osmAuth({ ...OPTIONS, access_token: 'foo' });
      const calls: unknown[][] = [];
      auth.xhr({ method: 'GET', path: '/api/0.6/user/details' }, (...args) => calls.push(args));
      const request = FakeXHR.last();
      request.respond(429, 'Too Many Requests');
      assert.equal(calls.length, 1);
      assert.equal(calls[0]?.length, 1);
      const err = assertOSMAuthError(calls[0]?.[0], 'http-error', 'Request failed with HTTP status 429');
      assert.equal(err.status, 429);
      assert.equal(err.xhr, request);
    });

    it('fails with a network-error, caused by the error event, on a network error', () => {
      const auth = new osmAuth({ ...OPTIONS, access_token: 'foo' });
      const calls: unknown[][] = [];
      auth.xhr({ method: 'GET', path: '/api/0.6/user/details' }, (...args) => calls.push(args));
      const request = FakeXHR.last();
      const e = request.fail();
      assert.equal(calls.length, 1);
      const err = assertOSMAuthError(calls[0]?.[0], 'network-error');
      assert.equal(err.cause, e);
      assert.equal(err.xhr, request);
      assert.equal(err.status, undefined);
    });
  });


  describe('rawxhr', () => {
    it('sends no Authorization header without a token', () => {
      const auth = new osmAuth(OPTIONS);
      auth.rawxhr('GET', 'https://example.com', null, null, null, () => {});
      assert.deepEqual(FakeXHR.last().headers, { 'Content-Type': 'application/x-www-form-urlencoded' });
    });

    it('fails with a timeout error if the request times out', () => {
      const auth = new osmAuth(OPTIONS);
      const calls: unknown[][] = [];
      const xhr = auth.rawxhr('GET', 'https://example.com', null, null, null, (...args) => calls.push(args));
      xhr.timeout = 1000;
      const request = FakeXHR.last();
      const e = request.timeOut();
      assert.equal(calls.length, 1);
      const err = assertOSMAuthError(calls[0]?.[0], 'timeout');
      assert.equal(err.xhr, request);
      assert.equal(err.cause, e);
    });

    it('doesn\'t call back if the caller aborts the request', () => {
      const auth = new osmAuth(OPTIONS);
      const calls: unknown[][] = [];
      const xhr = auth.rawxhr('GET', 'https://example.com', null, null, null, (...args) => calls.push(args));
      xhr.abort();
      assert.equal(calls.length, 0);
    });

    it('doesn\'t change the caller\'s headers', () => {
      const auth = new osmAuth(OPTIONS);
      const headers = { 'Content-Type': 'text/xml' };
      auth.rawxhr('PUT', 'https://example.com', 'foo', '<osm/>', headers, () => {});
      assert.deepEqual(headers, { 'Content-Type': 'text/xml' });
      assert.deepEqual(FakeXHR.last().headers, { 'Content-Type': 'text/xml', 'Authorization': 'Bearer foo' });
    });

    it('replaces an Authorization header that is given, whatever its case', () => {
      const auth = new osmAuth(OPTIONS);
      auth.rawxhr('GET', 'https://example.com', 'foo', null, { 'authorization': 'Bearer old' }, () => {});
      assert.deepEqual(FakeXHR.last().headers, { 'Authorization': 'Bearer foo' });
    });

    it('leaves the Content-Type of a `FormData` body to the browser', () => {
      const auth = new osmAuth(OPTIONS);
      const body = new FormData();
      body.append('file', 'x');
      auth.rawxhr('POST', 'https://example.com', 'foo', body, null, () => {});
      assert.deepEqual(FakeXHR.last().headers, { 'Authorization': 'Bearer foo' });
    });
  });


  describe('authenticate, with a popup', () => {
    it('calls back at once if already authenticated', () => {
      const auth = new osmAuth({ ...OPTIONS, access_token: 'foo' });
      const calls: unknown[][] = [];
      auth.authenticate((...args) => calls.push(args));
      assert.deepEqual(calls, [[null, auth]]);
      assert.equal(win.opened.length, 0);
    });

    it('fails if the popup is blocked', async () => {
      win.blockPopups = true;
      const { err } = await authenticateP(new osmAuth(OPTIONS));
      assertOSMAuthError(err, 'popup-blocked', 'Popup was blocked');
    });

    it('opens a centered popup, and sends it to the authorize page', async () => {
      const auth = new osmAuth({ ...OPTIONS, locale: 'de' });
      const { popup, authorizeURL, state } = await startPopupLogin(auth);

      assert.equal(win.opened.length, 1);
      assert.equal(win.opened[0]?.url, 'about:blank');
      assert.equal(win.opened[0]?.target, 'oauth_window');
      assert.equal(win.opened[0]?.features, 'width=550,height=610,left=225,top=95');
      assert.equal(auth.popupWindow, popup);

      assert.equal(authorizeURL.origin + authorizeURL.pathname, `${WWW}/oauth2/authorize`);
      const params = Object.fromEntries(authorizeURL.searchParams);
      assert.deepEqual(params, {
        client_id: OPTIONS.client_id,
        code_challenge: params['code_challenge'],
        code_challenge_method: 'S256',
        locale: 'de',
        redirect_uri: REDIRECT,
        response_type: 'code',
        scope: 'read_prefs',
        state: state
      });
      assert.match(state, /^[\w-]{43}$/);
      assert.match(params['code_challenge'] ?? '', /^[\w-]{43}$/);

      postFromLandPage(`${REDIRECT}?error=access_denied&state=${state}`);  // so the channel closes
    });

    it('sends the user through logout and login first if `switchUser` is set', async () => {
      const auth = new osmAuth(OPTIONS);
      const { pending, authorizeURL: logoutURL } = await startPopupLogin(auth, { switchUser: true });

      assert.equal(logoutURL.origin + logoutURL.pathname, `${WWW}/logout`);
      const loginURL = new URL(logoutURL.searchParams.get('referer') ?? '', WWW);
      assert.equal(loginURL.pathname, '/login');
      const authorizeURL = new URL(loginURL.searchParams.get('referer') ?? '', WWW);
      assert.equal(authorizeURL.origin + authorizeURL.pathname, `${WWW}/oauth2/authorize`);
      const state = authorizeURL.searchParams.get('state') ?? '';
      assert.ok(state);

      // the redirect carries that state back, so the error is reported (not 'invalid-state')
      postFromLandPage(`${REDIRECT}?error=access_denied&state=${state}`);
      const { err } = await pending;
      assertOSMAuthError(err, 'access_denied');
    });

    it('exchanges the code for an access token after the redirect', async () => {
      let loading = 0;
      let done = 0;
      const auth = new osmAuth({ ...OPTIONS, loading: () => loading++, done: () => done++ });
      const { pending, authorizeURL, state } = await startPopupLogin(auth);

      const tokenRequest = FakeXHR.nextRequest();
      postFromLandPage(`${REDIRECT}?code=CODE&state=${state}`);
      const request = await tokenRequest;

      const tokenURL = new URL(request.url);
      assert.equal(request.method, 'POST');
      assert.equal(tokenURL.origin + tokenURL.pathname, `${WWW}/oauth2/token`);
      const params = Object.fromEntries(tokenURL.searchParams);
      assert.deepEqual(params, {
        client_id: OPTIONS.client_id,
        code: 'CODE',
        code_verifier: params['code_verifier'],
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT
      });
      assert.equal(s256(params['code_verifier'] ?? ''), authorizeURL.searchParams.get('code_challenge'));
      assert.equal(loading, 1);
      assert.equal(done, 0);

      request.respond(200, JSON.stringify({ access_token: 'TOKEN', token_type: 'Bearer' }));
      const { err, result } = await pending;
      assert.equal(err, null);
      assert.equal(result, auth);
      assert.equal(auth.getAccessToken(), 'TOKEN');
      assert.equal(done, 1);
    });

    it('decodes the code from the redirect, even with a raw `=` in it', async () => {
      const { pending, state } = await startPopupLogin(new osmAuth(OPTIONS));
      const tokenRequest = FakeXHR.nextRequest();
      postFromLandPage(`${REDIRECT}?code=AB%2BC=&state=${state}`);
      const request = await tokenRequest;
      assert.equal(new URL(request.url).searchParams.get('code'), 'AB+C=');
      request.respond(200, JSON.stringify({ access_token: 'TOKEN' }));
      await pending;
    });

    it('ignores a redirect with another state, and keeps waiting for its own', async () => {
      const auth = new osmAuth(OPTIONS);
      let calls = 0;
      auth.authenticate(() => calls++);
      const state = new URL(await win.lastPopup().location.nextNavigation()).searchParams.get('state');

      postFromLandPage(`${REDIRECT}?code=OTHER&state=WRONG`);  // e.g. another instance's login, or another tab's
      postFromLandPage(`${REDIRECT}?error=access_denied&state=WRONG`);
      await delivered();
      assert.equal(calls, 0);
      assert.equal(FakeXHR.requests.length, 0);

      const tokenRequest = FakeXHR.nextRequest();
      postFromLandPage(`${REDIRECT}?code=CODE&state=${state}`);
      const request = await tokenRequest;
      assert.equal(new URL(request.url).searchParams.get('code'), 'CODE');
      request.respond(200, JSON.stringify({ access_token: 'TOKEN' }));
      assert.equal(calls, 1);
    });

    describe('when there\'s more than one attempt at once (e.g. a double click)', () => {
      /** Starts two logins on `auth`, the second before the first has finished, and returns their states and results */
      async function startLogins(auth: osmAuth) {
        const results: AuthResult[] = [];
        const start = async (): Promise<string> => {
          auth.authenticate((err, result) => results.push({ err, result }));
          return new URL(await win.lastPopup().location.nextNavigation()).searchParams.get('state') ?? '';
        };
        const first = await start();
        const second = await start();
        return { results, states: [first, second] };
      }

      it('finishes them all with the first redirect for any of them, and ignores the rest', async () => {
        const auth = new osmAuth(OPTIONS);
        const { results, states } = await startLogins(auth);
        assert.equal(win.opened.length, 2);

        // The user finishes in the first popup (with OSM's COOP header, the second click can't reuse it)
        const tokenRequest = FakeXHR.nextRequest();
        postFromLandPage(`${REDIRECT}?code=CODE&state=${states[0]}`);
        (await tokenRequest).respond(200, JSON.stringify({ access_token: 'TOKEN' }));
        assert.deepEqual(results, [{ err: null, result: auth }, { err: null, result: auth }]);

        // ...then in the second one, too late
        postFromLandPage(`${REDIRECT}?code=LATE&state=${states[1]}`);
        await delivered();
        assert.equal(FakeXHR.requests.length, 1);
        assert.equal(results.length, 2);
      });

      it('finishes them all with the latest attempt, e.g. after the user closed the first popup', async () => {
        const auth = new osmAuth(OPTIONS);
        const { results, states } = await startLogins(auth);
        const tokenRequest = FakeXHR.nextRequest();
        postFromLandPage(`${REDIRECT}?code=CODE&state=${states[1]}`);
        const request = await tokenRequest;
        assert.equal(new URL(request.url).searchParams.get('code'), 'CODE');
        request.respond(200, JSON.stringify({ access_token: 'TOKEN' }));
        assert.deepEqual(results, [{ err: null, result: auth }, { err: null, result: auth }]);
      });

      it('fails them all with the OAuth error from any of them', async () => {
        const { results, states } = await startLogins(new osmAuth(OPTIONS));
        postFromLandPage(`${REDIRECT}?error=access_denied&state=${states[0]}`);
        await delivered();
        assert.equal(results.length, 2);
        assertOSMAuthError(results[0]?.err, 'access_denied');
        assert.equal(results[1]?.err, results[0]?.err);
      });
    });

    it('doesn\'t mix up the logins of two instances (e.g. for two servers)', async () => {
      const DEV = 'https://master.apis.dev.openstreetmap.org';
      const prod = new osmAuth(OPTIONS);
      const dev = new osmAuth({ ...OPTIONS, url: DEV, apiUrl: DEV });
      const prodLogin = await startPopupLogin(prod);
      const devLogin = await startPopupLogin(dev);

      const prodRequest = FakeXHR.nextRequest();
      postFromLandPage(`${REDIRECT}?code=PROD&state=${prodLogin.state}`);
      (await prodRequest).respond(200, JSON.stringify({ access_token: 'PROD_TOKEN' }));
      assert.equal((await prodLogin.pending).err, null);

      const devRequest = FakeXHR.nextRequest();
      postFromLandPage(`${REDIRECT}?code=DEV&state=${devLogin.state}`);
      const request = await devRequest;
      assert.equal(new URL(request.url).origin, DEV);
      request.respond(200, JSON.stringify({ access_token: 'DEV_TOKEN' }));
      assert.equal((await devLogin.pending).err, null);
      assert.equal(prod.getAccessToken(), 'PROD_TOKEN');
      assert.equal(dev.getAccessToken(), 'DEV_TOKEN');
    });

    it('starts afresh after a login ends', async () => {
      const auth = new osmAuth(OPTIONS);
      const first = await startPopupLogin(auth);
      postFromLandPage(`${REDIRECT}?error=access_denied&state=${first.state}`);
      assertOSMAuthError((await first.pending).err, 'access_denied');

      const second = await startPopupLogin(auth);
      postFromLandPage(`${REDIRECT}?code=OLD&state=${first.state}`);  // the first login's state isn't accepted any more
      await delivered();
      assert.equal(FakeXHR.requests.length, 0);

      const tokenRequest = FakeXHR.nextRequest();
      postFromLandPage(`${REDIRECT}?code=CODE&state=${second.state}`);
      (await tokenRequest).respond(200, JSON.stringify({ access_token: 'TOKEN' }));
      assert.equal((await second.pending).err, null);
    });

    it('fails with the OAuth error from the redirect', async () => {
      const { pending, state } = await startPopupLogin(new osmAuth(OPTIONS));
      postFromLandPage(`${REDIRECT}?error=access_denied&error_description=The+resource+owner+denied+the+request.&state=${state}`);
      const { err } = await pending;
      assertOSMAuthError(err, 'access_denied', 'The resource owner denied the request.');
    });

    it('reports an OAuth error whose description has a malformed `%` escape', async () => {
      const { pending, state } = await startPopupLogin(new osmAuth(OPTIONS));
      postFromLandPage(`${REDIRECT}?error=access_denied&error_description=100%25+sure%E0%A4%A&state=${state}`);
      const { err } = await pending;
      assertOSMAuthError(err, 'access_denied');
      assert.ok(err instanceof Error && err.message.startsWith('100% sure'));
    });

    it('uses the OAuth error code as the message if there is no description', async () => {
      const { pending, state } = await startPopupLogin(new osmAuth(OPTIONS));
      postFromLandPage(`${REDIRECT}?error=access_denied&state=${state}`);
      const { err } = await pending;
      assertOSMAuthError(err, 'access_denied', 'access_denied');
    });

    it('fails with an http-error if the token request fails', async () => {
      let done = 0;
      const auth = new osmAuth({ ...OPTIONS, done: () => done++ });
      const { pending, state } = await startPopupLogin(auth);
      const tokenRequest = FakeXHR.nextRequest();
      postFromLandPage(`${REDIRECT}?code=CODE&state=${state}`);
      const request = await tokenRequest;
      request.respond(400, '{"error":"invalid_grant"}');

      const { err } = await pending;
      const error = assertOSMAuthError(err, 'http-error');
      assert.equal(error.status, 400);
      assert.equal(error.xhr, request);
      assert.equal(auth.authenticated(), false);
      assert.equal(done, 1);
    });

    it('finishes the login on the server it started on, even if `url` changes meanwhile', async () => {
      const DEV = 'https://master.apis.dev.openstreetmap.org';
      const auth = new osmAuth(OPTIONS);
      const { pending, state } = await startPopupLogin(auth);
      auth.options({ ...auth.options(), url: DEV, apiUrl: DEV });

      const tokenRequest = FakeXHR.nextRequest();
      postFromLandPage(`${REDIRECT}?code=CODE&state=${state}`);
      const request = await tokenRequest;
      assert.equal(new URL(request.url).origin, WWW);
      request.respond(200, JSON.stringify({ access_token: 'TOKEN' }));

      const { err } = await pending;
      assert.equal(err, null);
      assert.equal(storage.getItem(`${WWW}oauth2_access_token`), 'TOKEN');
      assert.equal(storage.getItem(`${DEV}oauth2_access_token`), null);
    });

    it('fails if the token response isn\'t JSON (e.g. a captive portal\'s page)', async () => {
      let done = 0;
      const auth = new osmAuth({ ...OPTIONS, done: () => done++ });
      const { pending, state } = await startPopupLogin(auth);
      const tokenRequest = FakeXHR.nextRequest();
      postFromLandPage(`${REDIRECT}?code=CODE&state=${state}`);
      (await tokenRequest).respond(200, '<html>Sign in to the Wi-Fi</html>');

      const { err } = await pending;
      assertOSMAuthError(err, 'invalid-token-response');
      assert.equal(auth.authenticated(), false);
      assert.equal(done, 1);
    });

    it('still logs in if saving the token to localStorage throws, and keeps it in memory', async () => {
      const auth = new osmAuth(OPTIONS);
      const { pending, state } = await startPopupLogin(auth);
      storage.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); };
      const tokenRequest = FakeXHR.nextRequest();
      postFromLandPage(`${REDIRECT}?code=CODE&state=${state}`);
      (await tokenRequest).respond(200, JSON.stringify({ access_token: 'TOKEN' }));

      const { err } = await pending;
      assert.equal(err, null);
      assert.equal(auth.getAccessToken(), 'TOKEN');
    });

    describe('without Web Crypto (e.g. not in a secure context)', () => {
      const originalCrypto = globalThis.crypto;
      afterEach(() => { setGlobal('crypto', originalCrypto); });

      it('fails without opening a popup', async () => {
        setGlobal('crypto', { getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto) });
        const { err } = await authenticateP(new osmAuth(OPTIONS));
        assertOSMAuthError(err, 'crypto-unavailable');
        assert.equal(win.opened.length, 0);
      });

      it('fails, and closes the popup, if making the PKCE challenge fails', async () => {
        const failure = new Error('digest failed');
        setGlobal('crypto', {
          getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
          subtle: { digest: () => Promise.reject(failure) }
        });
        const { err } = await authenticateP(new osmAuth(OPTIONS));
        const error = assertOSMAuthError(err, 'crypto-unavailable');
        assert.equal(error.cause, failure);
        assert.equal(win.lastPopup().closed, true);
      });
    });

    it('fails if the token response has no access_token', async () => {
      let done = 0;
      const auth = new osmAuth({ ...OPTIONS, done: () => done++ });
      const { pending, state } = await startPopupLogin(auth);
      const tokenRequest = FakeXHR.nextRequest();
      postFromLandPage(`${REDIRECT}?code=CODE&state=${state}`);
      const request = await tokenRequest;
      request.respond(200, '{"token_type":"Bearer"}');

      const { err, result } = await pending;
      const error = assertOSMAuthError(err, 'invalid-token-response');
      assert.equal(error.xhr, request);
      assert.equal(result, undefined);
      assert.equal(auth.authenticated(), false);
      assert.equal(done, 1);
    });

    it('logs out before logging in', async () => {
      storage.setItem(`${WWW}oauth_token`, 'legacy');
      const { state } = await startPopupLogin(new osmAuth(OPTIONS));
      assert.equal(storage.getItem(`${WWW}oauth_token`), null);
      postFromLandPage(`${REDIRECT}?error=access_denied&state=${state}`);  // so the channel closes
    });
  });


  describe('authenticateAsync', () => {
    it('resolves at once if already authenticated', async () => {
      const auth = new osmAuth({ ...OPTIONS, access_token: 'foo' });
      assert.equal(await auth.authenticateAsync(), auth);
      assert.equal(win.opened.length, 0);
    });

    it('rejects if the popup is blocked', async () => {
      win.blockPopups = true;
      await assert.rejects(new osmAuth(OPTIONS).authenticateAsync(), { code: 'popup-blocked' });
    });

    it('resolves after the popup login', async () => {
      const auth = new osmAuth(OPTIONS);
      const pending = auth.authenticateAsync();
      const authorizeURL = new URL(await win.lastPopup().location.nextNavigation());
      const tokenRequest = FakeXHR.nextRequest();
      postFromLandPage(`${REDIRECT}?code=CODE&state=${authorizeURL.searchParams.get('state')}`);
      (await tokenRequest).respond(200, JSON.stringify({ access_token: 'TOKEN' }));
      assert.equal(await pending, auth);
      assert.equal(auth.getAccessToken(), 'TOKEN');
    });

    it('rejects with the OAuth error from the redirect', async () => {
      const pending = new osmAuth(OPTIONS).authenticateAsync();
      const authorizeURL = new URL(await win.lastPopup().location.nextNavigation());
      postFromLandPage(`${REDIRECT}?error=access_denied&state=${authorizeURL.searchParams.get('state')}`);
      await assert.rejects(pending, { code: 'access_denied' });
    });

    it('passes the login options on', async () => {
      const pending = new osmAuth(OPTIONS).authenticateAsync({ switchUser: true });
      const logoutURL = new URL(await win.lastPopup().location.nextNavigation());
      assert.equal(logoutURL.pathname, '/logout');
      const loginURL = new URL(logoutURL.searchParams.get('referer') ?? '', WWW);
      const authorizeURL = new URL(loginURL.searchParams.get('referer') ?? '', WWW);
      postFromLandPage(`${REDIRECT}?error=access_denied&state=${authorizeURL.searchParams.get('state')}`);
      await assert.rejects(pending, { code: 'access_denied' });
    });
  });


  describe('bringPopupWindowToFront', () => {
    it('returns false if there is no popup', () => {
      assert.equal(new osmAuth(OPTIONS).bringPopupWindowToFront(), false);
    });

    it('focuses the popup if it is open', () => {
      const auth = new osmAuth(OPTIONS);
      const popup = new FakePopup('about:blank');
      auth.popupWindow = popup as unknown as Window;
      assert.equal(auth.bringPopupWindowToFront(), true);
      assert.equal(popup.focusCount, 1);

      popup.closed = true;
      assert.equal(auth.bringPopupWindowToFront(), false);
      assert.equal(popup.focusCount, 1);
    });

    it('returns false if focusing the popup throws', () => {
      const auth = new osmAuth(OPTIONS);
      const popup = new FakePopup('about:blank');
      popup.focus = () => { throw new Error('Blocked a frame from accessing a cross-origin frame'); };
      auth.popupWindow = popup as unknown as Window;
      assert.equal(auth.bringPopupWindowToFront(), false);
    });
  });


  describe('authenticate, in single-page mode', () => {
    const SINGLEPAGE = { ...OPTIONS, redirect_uri: 'http://127.0.0.1:8080/', singlepage: true };

    it('fails without localStorage, which PKCE needs across the redirect', async () => {
      Reflect.deleteProperty(globalThis, 'localStorage');
      const { err } = await authenticateP(new osmAuth(SINGLEPAGE));
      assertOSMAuthError(err, 'pkce-localstorage-unavailable');
      assert.equal(win.opened.length, 0);
    });

    it('fails, rather than redirecting, if saving the state to localStorage throws', async () => {
      storage.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); };
      let navigated = false;
      win.location.nextNavigation().then(() => { navigated = true; });
      const { err } = await authenticateP(new osmAuth(SINGLEPAGE));
      assertOSMAuthError(err, 'pkce-localstorage-unavailable');
      await delivered();
      assert.equal(navigated, false);
    });

    it('saves the state and verifier, then redirects to the authorize page', async () => {
      authenticateP(new osmAuth(SINGLEPAGE));
      const authorizeURL = new URL(await win.location.nextNavigation());

      assert.equal(win.opened.length, 0);
      assert.equal(authorizeURL.origin + authorizeURL.pathname, `${WWW}/oauth2/authorize`);
      assert.equal(authorizeURL.searchParams.get('state'), storage.getItem(`${WWW}oauth2_state`));
      const verifier = storage.getItem(`${WWW}oauth2_pkce_code_verifier`) ?? '';
      assert.equal(authorizeURL.searchParams.get('code_challenge'), s256(verifier));
    });

    it('exchanges the code for an access token when the user comes back', async () => {
      storage.setItem(`${WWW}oauth2_state`, 'STATE');
      storage.setItem(`${WWW}oauth2_pkce_code_verifier`, 'VERIFIER');
      win.location.search = '?code=CODE&state=STATE';

      const auth = new osmAuth(SINGLEPAGE);
      const tokenRequest = FakeXHR.nextRequest();
      const pending = authenticateP(auth);
      const request = await tokenRequest;

      const params = Object.fromEntries(new URL(request.url).searchParams);
      assert.equal(params['code'], 'CODE');
      assert.equal(params['code_verifier'], 'VERIFIER');
      assert.equal(storage.getItem(`${WWW}oauth2_state`), null);
      assert.equal(storage.getItem(`${WWW}oauth2_pkce_code_verifier`), null);

      request.respond(200, JSON.stringify({ access_token: 'TOKEN' }));
      const { err, result } = await pending;
      assert.equal(err, null);
      assert.equal(result, auth);
      assert.equal(auth.getAccessToken(), 'TOKEN');
    });

    it('reports the OAuth error when the user comes back with one, and forgets the saved state', async () => {
      storage.setItem(`${WWW}oauth2_state`, 'STATE');
      storage.setItem(`${WWW}oauth2_pkce_code_verifier`, 'VERIFIER');
      win.location.search = '?error=access_denied&error_description=The+resource+owner+denied+the+request.&state=STATE';
      let navigated = false;
      win.location.nextNavigation().then(() => { navigated = true; });

      const { err } = await authenticateP(new osmAuth(SINGLEPAGE));
      assertOSMAuthError(err, 'access_denied', 'The resource owner denied the request.');
      assert.equal(storage.getItem(`${WWW}oauth2_state`), null);
      assert.equal(storage.getItem(`${WWW}oauth2_pkce_code_verifier`), null);
      await delivered();
      assert.equal(navigated, false);
    });

    it('fails if the user comes back with an error and another state', async () => {
      storage.setItem(`${WWW}oauth2_state`, 'STATE');
      win.location.search = '?error=access_denied&state=WRONG';
      const { err } = await authenticateP(new osmAuth(SINGLEPAGE));
      assertOSMAuthError(err, 'invalid-state');
      assert.equal(storage.getItem(`${WWW}oauth2_state`), null);
    });

    it('starts a new login, rather than reusing a `code` left in the URL, if none is pending', async () => {
      // e.g. login, logout, then login again, with the first login's `?code=` still in the URL
      win.location.search = '?code=OLD&state=OLD';
      const auth = new osmAuth(SINGLEPAGE);
      authenticateP(auth);
      const authorizeURL = new URL(await win.location.nextNavigation());
      assert.equal(authorizeURL.origin + authorizeURL.pathname, `${WWW}/oauth2/authorize`);
      assert.equal(authorizeURL.searchParams.get('state'), storage.getItem(`${WWW}oauth2_state`));
      assert.equal(FakeXHR.requests.length, 0);
    });
  });


  describe('bootstrapToken', () => {
    it('fails if the state doesn\'t match, and forgets the saved state and verifier', () => {
      storage.setItem(`${WWW}oauth2_state`, 'STATE');
      storage.setItem(`${WWW}oauth2_pkce_code_verifier`, 'VERIFIER');
      win.location.search = '?code=CODE&state=WRONG';
      const calls: unknown[][] = [];
      new osmAuth(OPTIONS).bootstrapToken('CODE', (...args) => calls.push(args));
      assert.equal(calls.length, 1);
      assertOSMAuthError(calls[0]?.[0], 'invalid-state');
      assert.equal(storage.getItem(`${WWW}oauth2_state`), null);
      assert.equal(storage.getItem(`${WWW}oauth2_pkce_code_verifier`), null);
      assert.equal(FakeXHR.requests.length, 0);
    });

    it('fails if no state was saved, even if the URL\'s state is empty', () => {
      win.location.search = '?code=CODE&state=';
      const calls: unknown[][] = [];
      new osmAuth(OPTIONS).bootstrapToken('CODE', (...args) => calls.push(args));
      assert.equal(calls.length, 1);
      assertOSMAuthError(calls[0]?.[0], 'invalid-state');
      assert.equal(FakeXHR.requests.length, 0);
    });

    it('takes the state from the caller, if given (e.g. the app already cleaned up the URL)', () => {
      storage.setItem(`${WWW}oauth2_state`, 'STATE');
      storage.setItem(`${WWW}oauth2_pkce_code_verifier`, 'VERIFIER');
      win.location.search = '';
      const auth = new osmAuth(OPTIONS);
      const calls: unknown[][] = [];
      auth.bootstrapToken('CODE', (...args) => calls.push(args), 'STATE');
      const request = FakeXHR.last();
      assert.equal(new URL(request.url).searchParams.get('code_verifier'), 'VERIFIER');
      request.respond(200, JSON.stringify({ access_token: 'TOKEN' }));
      assert.deepEqual(calls, [[null, auth]]);
    });

    it('exchanges the code for an access token', () => {
      storage.setItem(`${WWW}oauth2_state`, 'STATE');
      storage.setItem(`${WWW}oauth2_pkce_code_verifier`, 'VERIFIER');
      win.location.search = '?code=CODE&state=STATE';
      const auth = new osmAuth(OPTIONS);
      const calls: unknown[][] = [];
      auth.bootstrapToken('CODE', (...args) => calls.push(args));
      FakeXHR.last().respond(200, JSON.stringify({ access_token: 'TOKEN' }));
      assert.deepEqual(calls, [[null, auth]]);
      assert.equal(auth.getAccessToken(), 'TOKEN');
    });
  });

});

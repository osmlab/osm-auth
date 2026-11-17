import { afterAll, beforeEach, describe, it } from 'bun:test';
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
  });


  describe('fetch', () => {
    it('adds the Authorization header and a default Content-Type', async () => {
      const auth = new osmAuth({ ...OPTIONS, access_token: 'foo' });
      const response = await auth.fetch(`${API}/api/0.6/user/details`, { method: 'GET' });
      assert.equal(await response.text(), 'ok');
      assert.deepEqual(fetchSpy.calls, [{
        resource: `${API}/api/0.6/user/details`,
        init: {
          method: 'GET',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Bearer foo'
          }
        }
      }]);
    });

    it('adds the Authorization header to headers that are given', async () => {
      const auth = new osmAuth({ ...OPTIONS, access_token: 'foo' });
      await auth.fetch(`${API}/x`, { headers: { 'Accept': 'application/json' } });
      assert.deepEqual(fetchSpy.calls[0]?.init?.headers, { 'Accept': 'application/json', 'Authorization': 'Bearer foo' });
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

    it('uses the OSM API\'s plain text explanation as the message of an http-error', () => {
      const auth = new osmAuth({ ...OPTIONS, access_token: 'foo' });
      const calls: unknown[][] = [];
      auth.xhr({ method: 'POST', path: '/api/0.6/changeset/123/upload' }, (...args) => calls.push(args));
      const request = FakeXHR.last();
      request.responseHeaders = { 'Content-Type': 'text/plain; charset=utf-8' };
      request.respond(409, 'The changeset 123 was closed at 2026-11-17 12:00:00 UTC\n');
      const err = assertOSMAuthError(calls[0]?.[0], 'http-error', 'The changeset 123 was closed at 2026-11-17 12:00:00 UTC');
      assert.equal(err.status, 409);
    });

    it('doesn\'t use an HTML or JSON body as the message of an http-error', () => {
      const auth = new osmAuth({ ...OPTIONS, access_token: 'foo' });
      const calls: unknown[][] = [];
      auth.xhr({ method: 'GET', path: '/a' }, (...args) => calls.push(args));
      auth.xhr({ method: 'GET', path: '/b' }, (...args) => calls.push(args));
      const [html, json] = FakeXHR.requests;
      html!.responseHeaders = { 'Content-Type': 'text/html' };
      html!.respond(502, '<html><body>Bad Gateway</body></html>');
      json!.responseHeaders = { 'Content-Type': 'application/json' };
      json!.respond(400, '{"error":"invalid_request"}');
      assertOSMAuthError(calls[0]?.[0], 'http-error', 'Request failed with HTTP status 502');
      assertOSMAuthError(calls[1]?.[0], 'http-error', 'Request failed with HTTP status 400');
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

    it('fails if the state doesn\'t match', async () => {
      const { pending } = await startPopupLogin(new osmAuth(OPTIONS));
      postFromLandPage(`${REDIRECT}?code=CODE&state=WRONG`);
      const { err } = await pending;
      assertOSMAuthError(err, 'invalid-state', 'Invalid state');
      assert.equal(FakeXHR.requests.length, 0);
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
  });


  describe('bootstrapToken', () => {
    it('fails if the state doesn\'t match, and forgets the saved state', () => {
      storage.setItem(`${WWW}oauth2_state`, 'STATE');
      win.location.search = '?code=CODE&state=WRONG';
      const calls: unknown[][] = [];
      new osmAuth(OPTIONS).bootstrapToken('CODE', (...args) => calls.push(args));
      assert.equal(calls.length, 1);
      assertOSMAuthError(calls[0]?.[0], 'invalid-state');
      assert.equal(storage.getItem(`${WWW}oauth2_state`), null);
      assert.equal(FakeXHR.requests.length, 0);
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

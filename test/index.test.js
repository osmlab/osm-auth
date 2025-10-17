import { afterAll, beforeAll, describe, it } from 'bun:test';
import { strict as assert } from 'bun:assert';
import { osmAuth } from '../src/osm-auth.mjs';
import { LocalStorage } from 'node-localstorage';

let localStorage;


describe('osmauth', () => {
  beforeAll(() => {
    localStorage = new LocalStorage('./scratch');
  });

  afterAll(() => {
    localStorage._deleteLocation();
  });

  describe('.options', () => {
    it('gets and sets new options', () => {
      localStorage.clear();
      const keys = {
        url: 'https://www.openstreetmap.org',
        apiUrl: 'https://api.openstreetmap.org',
        client_id: 'JWXSAzNp64sIRMStTnkhMRaMxSR964V4sFgn3KUZNTA',
        client_secret: '6umOXfkZqH5CVUtv6iDqN7k8o7mKbQvTrHvbDQH36hs',
        redirect_uri: 'http://127.0.0.1:8080/land.html',
        scope: 'read_prefs'
      };
      const auth = osmAuth(keys);
      assert.deepEqual(auth.options(), keys);

      auth.options({ url: 'foo' });
      assert.deepEqual(auth.options().url, 'foo');
    });
  });

  describe('pre authorization', () => {
    it('is not initially authorized', () => {
      localStorage.clear();
      const auth = osmAuth({
        url: 'https://www.openstreetmap.org',
        apiUrl: 'https://api.openstreetmap.org',
        client_id: 'JWXSAzNp64sIRMStTnkhMRaMxSR964V4sFgn3KUZNTA',
        redirect_uri: 'http://127.0.0.1:8080/land.html',
        scope: 'read_prefs'
      });
      assert.equal(auth.authenticated(), false);
    });

    it('can be preauthorized', () => {
      localStorage.clear();
      const auth = osmAuth({
        url: 'https://www.openstreetmap.org',
        apiUrl: 'https://api.openstreetmap.org',
        client_id: 'JWXSAzNp64sIRMStTnkhMRaMxSR964V4sFgn3KUZNTA',
        redirect_uri: 'http://127.0.0.1:8080/land.html',
        scope: 'read_prefs',
        access_token: 'foo'
      });
      assert.equal(auth.authenticated(), true);
    });
  });
});

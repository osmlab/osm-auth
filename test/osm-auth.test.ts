import { afterAll, beforeAll, describe, it } from 'bun:test';
import { strict as assert } from 'bun:assert';
import { osmAuth } from '../src/osm-auth.ts';
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
      const auth = new osmAuth(keys);
      const options = auth.options();
      assert.deepEqual(options, {
        ...keys,
        auto: false,
        singlepage: false,
        loading: options.loading,
        done: options.done
      });

      // options are copied, not shared
      assert.notEqual(options, keys);
      options.url = 'bar';
      assert.equal(auth.options().url, 'https://www.openstreetmap.org');

      auth.options({ url: 'foo' });
      assert.deepEqual(auth.options().url, 'foo');
    });
  });

  describe('pre authorization', () => {
    it('is not initially authorized', () => {
      localStorage.clear();
      const auth = new osmAuth({
        url: 'https://www.openstreetmap.org',
        apiUrl: 'https://api.openstreetmap.org',
        client_id: 'JWXSAzNp64sIRMStTnkhMRaMxSR964V4sFgn3KUZNTA',
        redirect_uri: 'http://127.0.0.1:8080/land.html',
        scope: 'read_prefs'
      });
      assert.equal(auth.authenticated(), false);
      assert.equal(auth.getAccessToken(), '');
    });

    it('can be preauthorized', () => {
      localStorage.clear();
      const auth = new osmAuth({
        url: 'https://www.openstreetmap.org',
        apiUrl: 'https://api.openstreetmap.org',
        client_id: 'JWXSAzNp64sIRMStTnkhMRaMxSR964V4sFgn3KUZNTA',
        redirect_uri: 'http://127.0.0.1:8080/land.html',
        scope: 'read_prefs',
        access_token: 'foo'
      });
      assert.equal(auth.authenticated(), true);
      assert.equal(auth.getAccessToken(), 'foo');
    });
  });
});

import { after, before, test } from 'node:test';
import { strict as assert } from 'node:assert';
import { osmAuth } from '../src/osm-auth.mjs';

import { LocalStorage } from 'node-localstorage';

let localStorage;

test('osmauth', async t => {
  before(() => {
    localStorage = new LocalStorage('./scratch');
  });

  after(() => {
    localStorage._deleteLocation();
  });

  await t.test('.options', async t => {
    await t.test('gets and sets new options', t => {
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

  await t.test('pre authorization', async t => {
    await t.test('is not initially authorized', t => {
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

    await t.test('can be preauthorized', t => {
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

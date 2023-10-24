import { test } from 'tap';
import { osmAuth } from '../src/osm-auth.mjs';

import { LocalStorage } from 'node-localstorage';
global.localStorage = new LocalStorage('./scratch');


test('osmauth', t => {
  t.test('.options', t => {
    t.test('gets and sets new options', t => {
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
      t.same(auth.options(), keys);

      auth.options({ url: 'foo' });
      t.same(auth.options().url, 'foo');
      t.end();
    });

    t.end();
  });

  t.test('pre authorization', t => {
    t.test('is not initially authorized', t => {
      localStorage.clear();
      const auth = osmAuth({
        url: 'https://www.openstreetmap.org',
        apiUrl: 'https://api.openstreetmap.org',
        client_id: 'JWXSAzNp64sIRMStTnkhMRaMxSR964V4sFgn3KUZNTA',
        redirect_uri: 'http://127.0.0.1:8080/land.html',
        scope: 'read_prefs'
      });
      t.notOk(auth.authenticated());
      t.end();
    });

    t.test('can be preauthorized', t => {
      localStorage.clear();
      const auth = osmAuth({
        url: 'https://www.openstreetmap.org',
        apiUrl: 'https://api.openstreetmap.org',
        client_id: 'JWXSAzNp64sIRMStTnkhMRaMxSR964V4sFgn3KUZNTA',
        redirect_uri: 'http://127.0.0.1:8080/land.html',
        scope: 'read_prefs',
        access_token: 'foo'
      });
      t.ok(auth.authenticated());
      t.end();
    });

    t.end();
  });

  t.end();
});

localStorage._deleteLocation();
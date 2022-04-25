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
        client_id: 'h55M4tEsJDLVSFOUZ5EhbpJubiFdZh5YdRFA7Sn5gsQ',
        client_secret: 'Ud8j4TWzQaNR6_HDSv_MprKDpS2Ewe1jIMTQNXEOAcs',
        redirect_uri: 'http://127.0.0.1:8080/land.html',
        scope: 'read_prefs write_api',
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
        client_id: 'h55M4tEsJDLVSFOUZ5EhbpJubiFdZh5YdRFA7Sn5gsQ',
        client_secret: 'Ud8j4TWzQaNR6_HDSv_MprKDpS2Ewe1jIMTQNXEOAcs',
        redirect_uri: 'http://127.0.0.1:8080/land.html',
        scope: 'read_prefs write_api',
      });
      t.notOk(auth.authenticated());
      t.end();
    });

    t.test('can be preauthorized', t => {
      localStorage.clear();
      const auth = osmAuth({
        url: 'https://www.openstreetmap.org',
        client_id: 'h55M4tEsJDLVSFOUZ5EhbpJubiFdZh5YdRFA7Sn5gsQ',
        client_secret: 'Ud8j4TWzQaNR6_HDSv_MprKDpS2Ewe1jIMTQNXEOAcs',
        redirect_uri: 'http://127.0.0.1:8080/land.html',
        scope: 'read_prefs write_api',
        access_token: 'foo',
      });
      t.ok(auth.authenticated());
      t.end();
    });

    t.end();
  });

  t.end();
});

localStorage._deleteLocation();
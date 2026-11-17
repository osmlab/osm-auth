# What's New

**osm-auth** is an open source project. You can submit bug reports, help out,
or learn more by visiting our project page on GitHub:  :octocat: https://github.com/osmlab/osm-auth

Please star our project on GitHub to show your support! ⭐️

_Breaking changes, which may affect downstream projects, are marked with a_ ⚠️

<!--
# A.B.C
##### YYYY-MMM-DD
*

[#xxx]: https://github.com/osmlab/osm-auth/issues/xxx
-->

## 4.0.0
##### Unreleased
osm-auth is written in TypeScript now, and its type definitions are generated from the source.
Most projects only need to make sure they call `new osmAuth(…)`, and update any `dist/` paths.

* ⚠️  ESM only: the CommonJS bundle `dist/osm-auth.cjs` is gone
  * `require('osm-auth')` still works in Node 20.19+ and 22.12+, which can `require()` an ES module
* ⚠️  The bundles moved to `dist/js/`, and the type definitions to `dist/ts/`
  * If you load osm-auth from a CDN, change `dist/osm-auth.iife.min.js` to `dist/js/osm-auth.iife.min.js`
  * We suggest pinning the major version too, e.g. `https://cdn.jsdelivr.net/npm/osm-auth@4/dist/js/osm-auth.iife.min.js`
* ⚠️  `osmAuth` is a class now, so `new` is required ([#148])
  * Calling `osmAuth({…})` without `new` throws a `TypeError`
  * Methods use `this`, so a method taken off the instance (e.g. `const { xhr } = auth`) needs `.bind(auth)`
* ⚠️  Options are copied in and out
  * The constructor and `options(val)` no longer change the object you pass in
  * `options()` returns a copy, so changing it doesn't change the instance. Pass it back with `options(o)`
* ⚠️  Type definitions
  * `client_secret` is no longer in `OSMAuthOptions`. Nothing has read it since PKCE replaced it in v2.2.0
  * The global `OSMAuth` namespace is gone. Import the types from `'osm-auth'` instead
  * New types: `OSMAuthResolvedOptions` (what `options()` returns), `OSMAuthCallback<T>` and `OSMAuthRawXHRCallback`
* ⚠️  Every error is an `OSMAuthError` ([#167])
  * `err.code` says what went wrong, e.g. `'popup-blocked'`, `'invalid-state'` or `'access_denied'`. These codes used to be in `err.status`
  * A request that fails with an HTTP status is an `'http-error'`. `err.status` is still the HTTP status (a number), and the request is in `err.xhr`. The error used to be the `XMLHttpRequest` itself, so read `err.xhr.responseText` instead of `err.responseText`
  * A network error is a `'network-error'`, with the `ProgressEvent` in `err.cause`
  * `xhr()` fails with a `'not-authenticated'` error when not logged in, where it used to pass the string `'not authenticated'`. `fetch()` rejects with the same error
  * Callbacks type `err` as `OSMAuthError | null`
* Refine the type definitions ([#153], thanks [@k-yle])
* The type definitions bring in the DOM lib, so they work in projects whose `lib` doesn't include it
* Fix `localStorage` detection when it's `undefined` ([#151], [#152], thanks [@tyrasd])
* Fix two bugs in the popup login:
  * An `error` redirect without an `error_description` threw a `TypeError`, instead of reporting the error
  * A failed attempt left a listener behind that later reported "Invalid state"
* Parse the redirect from OSM with `URLSearchParams` ([#170])
  * A malformed `%` escape no longer stops the login, and a value containing `=` is no longer dropped
* Development: TypeScript 7, oxlint instead of ESLint, and many more tests

[#148]: https://github.com/osmlab/osm-auth/issues/148
[#151]: https://github.com/osmlab/osm-auth/issues/151
[#152]: https://github.com/osmlab/osm-auth/issues/152
[#153]: https://github.com/osmlab/osm-auth/issues/153
[#167]: https://github.com/osmlab/osm-auth/issues/167
[#170]: https://github.com/osmlab/osm-auth/issues/170
[@k-yle]: https://github.com/k-yle
[@tyrasd]: https://github.com/tyrasd


## 3.2.0
##### 2026-Apr-02
* Allow caller to get the access token via `getAccessToken()` ([#149])
* Always use `new` to instantiate the main class ([#148], thanks [@k-yle])
* Fix links to GitHub issues ([#145], thanks [@tyrasd])

[#145]: https://github.com/osmlab/osm-auth/issues/145
[#148]: https://github.com/osmlab/osm-auth/issues/148
[#149]: https://github.com/osmlab/osm-auth/issues/149
[@k-yle]: https://github.com/k-yle
[@tyrasd]: https://github.com/tyrasd


## 3.1.1
##### 2025-Nov-04
* Add better test for `localStorage` ([#144])

[#144]: https://github.com/osmlab/osm-auth/issues/144


## 3.1.0
##### 2025-Oct-21
* Remove Web Crypto API checking code and references to `window` ([#139],[#140], thanks [@tom-konda])
* Detect if user tried to deny access in popup, notify BroadcastChannel ([#141], thanks [@ENT8R])
* This project uses [`bun`](https://bun.com/) now for simpler developer tooling ([#142])

[#139]: https://github.com/osmlab/osm-auth/issues/139
[#140]: https://github.com/osmlab/osm-auth/issues/140
[#141]: https://github.com/osmlab/osm-auth/issues/141
[#142]: https://github.com/osmlab/osm-auth/issues/142
[@tom-konda]: https://github.com/tom-konda
[@ENT8R]: https://github.com/ENT8R


## 3.0.0
##### 2025-Jul-08
* Fix authentication broken when using the `popup` method due to [security changes on 8 July 2025](https://github.com/openstreetmap/openstreetmap-website/commit/2ff4d6) ([#138], thanks [@k-yle])

[#138]: https://github.com/osmlab/osm-auth/issues/138


## 2.6.0
##### 2025-Jan-17
* Trigger error if popup is closed prematurely ([#135], thanks [@tyrasd])
* First-class support for switching users ([#136], thanks [@k-yle])

[#135]: https://github.com/osmlab/osm-auth/issues/135
[#136]: https://github.com/osmlab/osm-auth/issues/136


## 2.5.0
##### 2024-Apr-26
* Remove any extra quotes that were stored with legacy tokens ([#129])
* Allow locale to be passed to login page ([#23], [#130], thanks [@k-yle])

[#23]: https://github.com/osmlab/osm-auth/issues/23
[#129]: https://github.com/osmlab/osm-auth/issues/129
[#130]: https://github.com/osmlab/osm-auth/issues/130
[@k-yle]: https://github.com/k-yle


## 2.4.0
##### 2024-Jan-04
* Remove `store` dependency ([#126])
* Attempt to fix export errors from TypeScript declaration file ([#124], [#125], thanks [@pietervdvn])

[#124]: https://github.com/osmlab/osm-auth/issues/124
[#125]: https://github.com/osmlab/osm-auth/issues/125
[#126]: https://github.com/osmlab/osm-auth/issues/126
[@pietervdvn]: https://github.com/pietervdvn


## 2.3.0
##### 2023-Oct-24
* Add `apiUrl` property to support connecting to OSM API at `api.openstreetmap.org` ([#123], [operations#951])
* Fix popup on Safari when accessing WebCryptoAPI ([#121], [#122], thanks [@tyrasd])
* Fix double wrapping of `Error` object returned from authenticate ([0f48eb88])

[#121]: https://github.com/osmlab/osm-auth/issues/121
[#122]: https://github.com/osmlab/osm-auth/issues/122
[#123]: https://github.com/osmlab/osm-auth/issues/123
[operations#951]: https://github.com/openstreetmap/operations/issues/951
[0f48eb88]: https://github.com/osmlab/osm-auth/commit/0f48eb88293e2d9edcc7e668fd31c68681f0aa77
[@tyrasd]: https://github.com/tyrasd


## 2.2.0
##### 2023-Jul-12
* Make the fetch wrapper more compatible with fetch ([#117], [#118])
* Implement PKCE for OAuth2 authentication ([#114], thanks [@tyrasd])

[#118]: https://github.com/osmlab/osm-auth/issues/118
[#117]: https://github.com/osmlab/osm-auth/issues/117
[#114]: https://github.com/osmlab/osm-auth/issues/114
[@tyrasd]: https://github.com/tyrasd


## 2.1.0
##### 2023-May-17
* Add fetch wrapper ([#112], thanks [@dschep])
* Simplify and document singlepage authentication ([#113], thanks [@dschep])

[#112]: https://github.com/osmlab/osm-auth/issues/112
[#113]: https://github.com/osmlab/osm-auth/issues/113
[@dschep]: https://github.com/dschep


## 2.0.1
##### 2022-Sep-27
* Fix `osm-auth.d.ts` types declaration ([#106], thanks [@caspg])

[#106]: https://github.com/osmlab/osm-auth/issues/106
[@caspg]: https://github.com/caspg


## 2.0.0  (OAuth v2.0)
##### 2022-Apr-27
* ⚠️  Breaking change:  This library is now focused on supporting OAuth 2.0 ([#77], [#93], thanks [@HelNershingThapa]!)
* ⚠️  `xhr` and `rawxhr` options have changed slightly - check docs if you are using `options` with custom headers.
* ⚠️  osm-auth is marked as `"type": "module"` now
* ⚠️  Replace browserify with [esbuild](https://esbuild.github.io/) for super fast build speed. Package outputs are now:
  * `"module": "./src/osm-auth.mjs"` - ESM, works with `import`
  * `"main": "./dist/osm-auth.cjs"` - CJS bundle, works with `require()`
  * `"browser": "./dist/osm-auth.iife.js"` - IIFE bundle, works in browser `<script>` tag
  * Not testing on older environments like Internet Explorer or ES5.  No promises that this will work there.
* Improve documentation around the use of all functions, some returns have changed ([#53])

[#77]: https://github.com/osmlab/osm-auth/issues/77
[#93]: https://github.com/osmlab/osm-auth/issues/93
[#53]: https://github.com/osmlab/osm-auth/issues/53
[@HelNershingThapa]: https://github.com/HelNershingThapa


## 1.1.2  (OAuth v1.0a)
##### 2022-Apr-26
* Remove ecstatic, to avoid deprecation warnings
* Test on Node 14, 16, 18


## 1.1.1
##### 2021-May-24
* Remove xtend, to avoid deprecation warnings

[#76]: https://github.com/osmlab/osm-auth/issues/76


## 1.1.0
##### 2020-Jul-27
* Improve interaction with popup window ([#67])
* Add function `bringPopupWindowToFront()`

[#67]: https://github.com/osmlab/osm-auth/issues/67


## 1.0.2
##### 2017-Jun-25
* Use HTTPS protocol by default for openstreetmap.org ([#20])

[#20]: https://github.com/osmlab/osm-auth/issues/20


## 1.0.1
##### 2016-Oct-24
* Bugfix: Properly sign requests that include a querystring ([#17])

[#17]: https://github.com/osmlab/osm-auth/issues/17


## 1.0.0
##### 2016-Oct-23
* Upgrade all dependencies
* xhr should return an XMLHttpRequest ([#16])

[#16]: https://github.com/osmlab/osm-auth/issues/16


## 0.2.9
##### 2016-Aug-01
* Update ohauth dependency


## 0.2.8
##### 2015-Apr-01
* Update xtend to fix unpublished object-keys


## 0.2.7
##### 2014-Nov-26
* Add prefix option for non-http://openstreetmap.org urls


## 0.2.6
##### 2014-Aug-20
* Strip querystring as well ([#6])
* Reverse key and secret order to reflect osm.org ordering
* Update ohauth dependency

[#6]: https://github.com/osmlab/osm-auth/issues/6


## 0.2.5
##### 2013-Nov-21
* Fix non-form-urlencoded POST parameters case ([#11])

[#11]: https://github.com/osmlab/osm-auth/issues/11


## 0.2.4
##### 2013-Nov-21
* Better failure mode if localStorage is paranoid/full ([#10])

[#10]: https://github.com/osmlab/osm-auth/issues/10


## 0.2.3
##### 2013-Jun-01
* Support querystring args


## 0.2.2
##### 2013-May-31
* Fix behavior with hash with nothing after it
* Update store dependency


## 0.2.1
##### 2013-May-08
* Update ohauth dependency


## 0.2.0
##### 2013-Apr-17
* :warning: Don't use a nested object for keys ([#8])

[#8]: https://github.com/osmlab/osm-auth/issues/8


## 0.1.1
##### 2013-Apr-17
* Update ohauth dependency ([#7])

[#7]: https://github.com/osmlab/osm-auth/issues/7


## 0.1.0
##### 2013-Mar-28
* Update docs, `.keys()`, `.url()`

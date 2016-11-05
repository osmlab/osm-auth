/* eslint-disable no-console */
var http = require('http');
var ecstatic = require('ecstatic');

http.createServer(
    ecstatic({ root: __dirname, cache: 0 })
).listen(8080);

console.log('Listening on :8080');

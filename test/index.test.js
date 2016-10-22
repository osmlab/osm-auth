'use strict';

if (typeof localStorage === 'undefined' || localStorage === null) {
    var LocalStorage = require('node-localstorage').LocalStorage;
    global.localStorage = new LocalStorage('./scratch');
}

var test = require('tap').test;
var osmAuth = require('../.');

test('osmauth', function(t) {

    t.test('.options', function(t) {
        t.test('gets and sets new options', function(t) {
            localStorage.clear();
            var keys = {
                oauth_secret: '9WfJnwQxDvvYagx1Ut0tZBsOZ0ZCzAvOje3u1TV0',
                oauth_consumer_key: 'WLwXbm6XFMG7WrVnE8enIF6GzyefYIN6oUJSxG65'
            };
            var auth = osmAuth(keys);
            t.deepEqual(auth.options(), keys);

            auth.options({url: 'foo'});
            t.deepEqual(auth.options().url, 'foo');
            t.end();
        });

        t.end();
    });

    t.test('pre authorization', function(t) {
        t.test('is not initially authorized', function(t) {
            localStorage.clear();
            var auth = osmAuth({
                oauth_secret: '9WfJnwQxDvvYagx1Ut0tZBsOZ0ZCzAvOje3u1TV0',
                oauth_consumer_key: 'WLwXbm6XFMG7WrVnE8enIF6GzyefYIN6oUJSxG65'
            });
            t.notOk(auth.authenticated());
            t.end();
         });

         t.test('can be preauthorized', function(t) {
            localStorage.clear();
            var auth = osmAuth({
                oauth_secret: '9WfJnwQxDvvYagx1Ut0tZBsOZ0ZCzAvOje3u1TV0',
                oauth_consumer_key: 'WLwXbm6XFMG7WrVnE8enIF6GzyefYIN6oUJSxG65',
                oauth_token: 'foo',
                oauth_token_secret: 'foo'
            });
            t.ok(auth.authenticated());
            t.end();
         });

         t.end();
     });

     t.end();
});

localStorage._deleteLocation();

;(function(e,t,n,r){function i(r){if(!n[r]){if(!t[r]){if(e)return e(r);throw new Error("Cannot find module '"+r+"'")}var s=n[r]={exports:{}};t[r][0](function(e){var n=t[r][1][e];return i(n?n:e)},s,s.exports)}return n[r].exports}for(var s=0;s<r.length;s++)i(r[s]);return i})(typeof require!=="undefined"&&require,{1:[function(require,module,exports){
window.osmAuth = require('./');

},{"./":2}],2:[function(require,module,exports){
var ohauth = require('ohauth'),
    store = require('store');

module.exports = function(o) {

    // o is for options. for example,
    //
    // { oauth_secret: '9WfJnwQxDvvYagx1Ut0tZBsOZ0ZCzAvOje3u1TV0',
    //   oauth_consumer_key: "WLwXbm6XFMG7WrVnE8enIF6GzyefYIN6oUJSxG65",
    //   oauth_signature_method: "HMAC-SHA1" }

    function timenonce(o) {
        o.oauth_timestamp = ohauth.timestamp();
        o.oauth_nonce = ohauth.nonce();
        return o;
    }

    function token(x, y) {
        if (arguments.length === 1) return store.get(o.url + x);
        else if (arguments.length === 2) return store.set(o.url + x, y);
    }

    function getAuth(o) {
        return {
            oauth_consumer_key: o.oauth_consumer_key,
            oauth_signature_method: "HMAC-SHA1",
        };
    }

    o.url = o.url || 'http://www.openstreetmap.org';

    var oauth = {};

    oauth.authenticated = function() {
        return token('oauth_token') && token('oauth_token_secret');
    };

    oauth.logout = function() {
        token('oauth_token', '');
        token('oauth_token_secret', '');
        token('oauth_request_token_secret', '');
        return oauth;
    };

    // TODO: detect lack of click event
    oauth.authenticate = function(callback) {
        if (oauth.authenticated()) return callback();

        oauth.logout();

        var params = timenonce(getAuth(o)),
            url = o.url + '/oauth/request_token';

        params.oauth_signature = ohauth.signature(
            o.oauth_secret, '',
            ohauth.baseString('POST', url, params));

        var w = 600, h = 550,
            settings = [
                ['width', w], ['height', h],
                ['left', screen.width / 2 - w / 2],
                ['top', screen.height / 2 - h / 2]].map(function(x) {
                    return x.join('=');
                }).join(','),
            popup = window.open('about:blank', 'oauth_window', settings);

        ohauth.xhr('POST', url, params, null, {}, reqTokenDone);

        function reqTokenDone(err, xhr) {
            if (err) callback(err);

            var resp = ohauth.stringQs(xhr.response);
            token('oauth_request_token_secret', resp.oauth_token_secret);

            popup.location = o.url + '/oauth/authorize?' + ohauth.qsString({
                oauth_token: resp.oauth_token,
                oauth_callback: location.href.replace('index.html', '')
                    .replace(/#.+/, '') + 'land.html'
            });
        }

        window.authComplete = function(token) {
            var oauth_token = ohauth.stringQs(token.split('?')[1]);
            get_access_token(oauth_token.oauth_token);
            delete window.authComplete;
        };

        function get_access_token(oauth_token) {
            var url = o.url + '/oauth/access_token';
            var params = timenonce(getAuth(o));
            var request_token_secret = token('oauth_request_token_secret');

            params.oauth_token = oauth_token;
            params.oauth_signature = ohauth.signature(
                o.oauth_secret,
                request_token_secret,
                ohauth.baseString('POST', url, params));

            ohauth.xhr('POST', url, params, null, {}, accessTokenDone);

            function accessTokenDone(err, xhr) {
                if (err) callback(err);
                var access_token = ohauth.stringQs(xhr.response);
                token('oauth_token', access_token.oauth_token);
                token('oauth_token_secret', access_token.oauth_token_secret);
                callback();
            }
        }
    };

    oauth.xhr = function(options, callback) {
        var params = timenonce(getAuth(o));
        if (token('oauth_token')) {
            params.oauth_token = token('oauth_token');
        } else {
            return callback('not authenticated', null);
        }
        var url = o.url + options.path;
        var oauth_token_secret = token('oauth_token_secret');
        params.oauth_signature = ohauth.signature(
            o.oauth_secret,
            oauth_token_secret,
            ohauth.baseString(options.method, url, params));
        function done(err, xhr) {
            if (err) return callback(err);
            if (xhr.responseXML) return callback(err, xhr.responseXML);
            else return callback(err, xhr.response);
        }
        ohauth.xhr(options.method,
            url, params, options.content, options.options, done);
    };

    return oauth;
};

},{"ohauth":3,"store":4}],4:[function(require,module,exports){
/* Copyright (c) 2010-2012 Marcus Westin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

;(function(){
	var store = {},
		win = window,
		doc = win.document,
		localStorageName = 'localStorage',
		namespace = '__storejs__',
		storage

	store.disabled = false
	store.set = function(key, value) {}
	store.get = function(key) {}
	store.remove = function(key) {}
	store.clear = function() {}
	store.transact = function(key, defaultVal, transactionFn) {
		var val = store.get(key)
		if (transactionFn == null) {
			transactionFn = defaultVal
			defaultVal = null
		}
		if (typeof val == 'undefined') { val = defaultVal || {} }
		transactionFn(val)
		store.set(key, val)
	}
	store.getAll = function() {}

	store.serialize = function(value) {
		return JSON.stringify(value)
	}
	store.deserialize = function(value) {
		if (typeof value != 'string') { return undefined }
		try { return JSON.parse(value) }
		catch(e) { return value || undefined }
	}

	// Functions to encapsulate questionable FireFox 3.6.13 behavior
	// when about.config::dom.storage.enabled === false
	// See https://github.com/marcuswestin/store.js/issues#issue/13
	function isLocalStorageNameSupported() {
		try { return (localStorageName in win && win[localStorageName]) }
		catch(err) { return false }
	}

	if (isLocalStorageNameSupported()) {
		storage = win[localStorageName]
		store.set = function(key, val) {
			if (val === undefined) { return store.remove(key) }
			storage.setItem(key, store.serialize(val))
			return val
		}
		store.get = function(key) { return store.deserialize(storage.getItem(key)) }
		store.remove = function(key) { storage.removeItem(key) }
		store.clear = function() { storage.clear() }
		store.getAll = function() {
			var ret = {}
			for (var i=0; i<storage.length; ++i) {
				var key = storage.key(i)
				ret[key] = store.get(key)
			}
			return ret
		}
	} else if (doc.documentElement.addBehavior) {
		var storageOwner,
			storageContainer
		// Since #userData storage applies only to specific paths, we need to
		// somehow link our data to a specific path.  We choose /favicon.ico
		// as a pretty safe option, since all browsers already make a request to
		// this URL anyway and being a 404 will not hurt us here.  We wrap an
		// iframe pointing to the favicon in an ActiveXObject(htmlfile) object
		// (see: http://msdn.microsoft.com/en-us/library/aa752574(v=VS.85).aspx)
		// since the iframe access rules appear to allow direct access and
		// manipulation of the document element, even for a 404 page.  This
		// document can be used instead of the current document (which would
		// have been limited to the current path) to perform #userData storage.
		try {
			storageContainer = new ActiveXObject('htmlfile')
			storageContainer.open()
			storageContainer.write('<s' + 'cript>document.w=window</s' + 'cript><iframe src="/favicon.ico"></frame>')
			storageContainer.close()
			storageOwner = storageContainer.w.frames[0].document
			storage = storageOwner.createElement('div')
		} catch(e) {
			// somehow ActiveXObject instantiation failed (perhaps some special
			// security settings or otherwse), fall back to per-path storage
			storage = doc.createElement('div')
			storageOwner = doc.body
		}
		function withIEStorage(storeFunction) {
			return function() {
				var args = Array.prototype.slice.call(arguments, 0)
				args.unshift(storage)
				// See http://msdn.microsoft.com/en-us/library/ms531081(v=VS.85).aspx
				// and http://msdn.microsoft.com/en-us/library/ms531424(v=VS.85).aspx
				storageOwner.appendChild(storage)
				storage.addBehavior('#default#userData')
				storage.load(localStorageName)
				var result = storeFunction.apply(store, args)
				storageOwner.removeChild(storage)
				return result
			}
		}

		// In IE7, keys may not contain special chars. See all of https://github.com/marcuswestin/store.js/issues/40
		var forbiddenCharsRegex = new RegExp("[!\"#$%&'()*+,/\\\\:;<=>?@[\\]^`{|}~]", "g")
		function ieKeyFix(key) {
			return key.replace(forbiddenCharsRegex, '___')
		}
		store.set = withIEStorage(function(storage, key, val) {
			key = ieKeyFix(key)
			if (val === undefined) { return store.remove(key) }
			storage.setAttribute(key, store.serialize(val))
			storage.save(localStorageName)
			return val
		})
		store.get = withIEStorage(function(storage, key) {
			key = ieKeyFix(key)
			return store.deserialize(storage.getAttribute(key))
		})
		store.remove = withIEStorage(function(storage, key) {
			key = ieKeyFix(key)
			storage.removeAttribute(key)
			storage.save(localStorageName)
		})
		store.clear = withIEStorage(function(storage) {
			var attributes = storage.XMLDocument.documentElement.attributes
			storage.load(localStorageName)
			for (var i=0, attr; attr=attributes[i]; i++) {
				storage.removeAttribute(attr.name)
			}
			storage.save(localStorageName)
		})
		store.getAll = withIEStorage(function(storage) {
			var attributes = storage.XMLDocument.documentElement.attributes
			storage.load(localStorageName)
			var ret = {}
			for (var i=0, attr; attr=attributes[i]; ++i) {
				ret[attr] = store.get(attr)
			}
			return ret
		})
	}

	try {
		store.set(namespace, namespace)
		if (store.get(namespace) != namespace) { store.disabled = true }
		store.remove(namespace)
	} catch(e) {
		store.disabled = true
	}
	store.enabled = !store.disabled

	if (typeof module != 'undefined' && typeof module != 'function') { module.exports = store }
	else if (typeof define === 'function' && define.amd) { define(store) }
	else { this.store = store }
})();

},{}],3:[function(require,module,exports){
(function(context) {

if (typeof module !== 'undefined') {
    var sha1 = require('./sha');
}

var ohauth = {};

ohauth.qsString = function(obj) {
    return Object.keys(obj).sort().map(function(key) {
        return encodeURIComponent(key) + '=' +
            encodeURIComponent(obj[key]);
    }).join('&');
};

ohauth.sha = sha1();

ohauth.stringQs = function(str) {
    return str.split('&').reduce(function(obj, pair){
        var parts = pair.split('=');
        obj[parts[0]] = (null === parts[1]) ?
            '' : decodeURIComponent(parts[1]);
        return obj;
    }, {});
};

ohauth.rawxhr = function(method, url, data, headers, callback) {
    var xhr = new XMLHttpRequest(), twoHundred = /^20\d$/;
    xhr.onreadystatechange = function() {
        if (4 == xhr.readyState && 0 !== xhr.status) {
            if (twoHundred.test(xhr.status)) callback(null, xhr);
            else return callback(xhr, null);
        }
    };
    xhr.onerror = function(e) { return callback(e, null); };
    xhr.open(method, url, true);
    for (var h in headers) xhr.setRequestHeader(h, headers[h]);
    xhr.send(data);
};

ohauth.xhr = function(method, url, auth, data, options, callback) {
    var headers = (options && options.header) || {
        'Content-Type': 'application/x-www-form-urlencoded'
    };
    headers.Authorization = 'OAuth ' + ohauth.authHeader(auth);
    ohauth.rawxhr(method, url, data, headers, callback);
};

ohauth.nonce = function() {
    for (var o = ''; o.length < 6;) {
        o += '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz'[Math.floor(Math.random() * 61)];
    }
    return o;
};

ohauth.authHeader = function(obj) {
    return Object.keys(obj).sort().map(function(key) {
        return encodeURIComponent(key) + '="' + encodeURIComponent(obj[key]) + '"';
    }).join(', ');
};

ohauth.timestamp = function() { return ~~((+new Date()) / 1000); };

ohauth.percentEncode = function(s) {
    return encodeURIComponent(s)
        .replace(/\!/g, '%21').replace(/\'/g, '%27')
        .replace(/\*/g, '%2A').replace(/\(/g, '%28').replace(/\)/g, '%29');
};

ohauth.baseString = function(method, url, params) {
    if (params.oauth_signature) delete params.oauth_signature;
    return [
        method,
        ohauth.percentEncode(url),
        ohauth.percentEncode(ohauth.qsString(params))].join('&');
};

ohauth.signature = function(oauth_secret, token_secret, baseString) {
    return ohauth.sha.b64_hmac_sha1(
        ohauth.percentEncode(oauth_secret) + '&' +
        ohauth.percentEncode(token_secret),
        baseString);
};

context.ohauth = ohauth;

// export for npm/browserify compatibility
if (typeof module !== 'undefined') module.exports = ohauth;

})(this);

},{"./sha":5}],5:[function(require,module,exports){
/*
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined
 * in FIPS PUB 180-1
 * Version 2.1a Copyright Paul Johnston 2000 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for details.
 */

function sha1() {

    /*
     * Configurable variables. You may need to tweak these to be compatible with
     * the server-side, but the defaults work in most cases.
     */
    var hexcase = 0;  /* hex output format. 0 - lowercase; 1 - uppercase        */
    var b64pad  = "="; /* base-64 pad character. "=" for strict RFC compliance   */
    var chrsz   = 8;  /* bits per input character. 8 - ASCII; 16 - Unicode      */

    /*
     * These are the functions you'll usually want to call
     * They take string arguments and return either hex or base-64 encoded strings
     */
    function hex_sha1(s){return binb2hex(core_sha1(str2binb(s),s.length * chrsz));}
    function b64_sha1(s){return binb2b64(core_sha1(str2binb(s),s.length * chrsz));}
    function str_sha1(s){return binb2str(core_sha1(str2binb(s),s.length * chrsz));}
    function hex_hmac_sha1(key, data){ return binb2hex(core_hmac_sha1(key, data));}
    function b64_hmac_sha1(key, data){ return binb2b64(core_hmac_sha1(key, data));}
    function str_hmac_sha1(key, data){ return binb2str(core_hmac_sha1(key, data));}

    /*
     * Perform a simple self-test to see if the VM is working
     */
    function sha1_vm_test() {
      return hex_sha1("abc") == "a9993e364706816aba3e25717850c26c9cd0d89d";
    }

    /*
     * Calculate the SHA-1 of an array of big-endian words, and a bit length
     */
    function core_sha1(x, len) {
      /* append padding */
      x[len >> 5] |= 0x80 << (24 - len % 32);
      x[((len + 64 >> 9) << 4) + 15] = len;

      var w = Array(80);
      var a =  1732584193;
      var b = -271733879;
      var c = -1732584194;
      var d =  271733878;
      var e = -1009589776;

      for(var i = 0; i < x.length; i += 16) {
        var olda = a;
        var oldb = b;
        var oldc = c;
        var oldd = d;
        var olde = e;

        for(var j = 0; j < 80; j++) {
          if(j < 16) w[j] = x[i + j];
          else w[j] = rol(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);
          var t = safe_add(safe_add(rol(a, 5), sha1_ft(j, b, c, d)),
                           safe_add(safe_add(e, w[j]), sha1_kt(j)));
          e = d;
          d = c;
          c = rol(b, 30);
          b = a;
          a = t;
        }

        a = safe_add(a, olda);
        b = safe_add(b, oldb);
        c = safe_add(c, oldc);
        d = safe_add(d, oldd);
        e = safe_add(e, olde);
      }
      return Array(a, b, c, d, e);

    }

    /*
     * Perform the appropriate triplet combination function for the current
     * iteration
     */
    function sha1_ft(t, b, c, d) {
      if(t < 20) return (b & c) | ((~b) & d);
      if(t < 40) return b ^ c ^ d;
      if(t < 60) return (b & c) | (b & d) | (c & d);
      return b ^ c ^ d;
    }

    /*
     * Determine the appropriate additive constant for the current iteration
     */
    function sha1_kt(t) {
      return (t < 20) ?  1518500249 : (t < 40) ?  1859775393 :
             (t < 60) ? -1894007588 : -899497514;
    }

    /*
     * Calculate the HMAC-SHA1 of a key and some data
     */
    function core_hmac_sha1(key, data) {
      var bkey = str2binb(key);
      if(bkey.length > 16) bkey = core_sha1(bkey, key.length * chrsz);

      var ipad = Array(16), opad = Array(16);
      for(var i = 0; i < 16; i++) {
        ipad[i] = bkey[i] ^ 0x36363636;
        opad[i] = bkey[i] ^ 0x5C5C5C5C;
      }

      var hash = core_sha1(ipad.concat(str2binb(data)), 512 + data.length * chrsz);
      return core_sha1(opad.concat(hash), 512 + 160);
    }

    /*
     * Add integers, wrapping at 2^32. This uses 16-bit operations internally
     * to work around bugs in some JS interpreters.
     */
    function safe_add(x, y) {
      var lsw = (x & 0xFFFF) + (y & 0xFFFF);
      var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
      return (msw << 16) | (lsw & 0xFFFF);
    }

    /*
     * Bitwise rotate a 32-bit number to the left.
     */
    function rol(num, cnt) {
      return (num << cnt) | (num >>> (32 - cnt));
    }

    /*
     * Convert an 8-bit or 16-bit string to an array of big-endian words
     * In 8-bit function, characters >255 have their hi-byte silently ignored.
     */
    function str2binb(str) {
      var bin = Array();
      var mask = (1 << chrsz) - 1;
      for(var i = 0; i < str.length * chrsz; i += chrsz)
        bin[i>>5] |= (str.charCodeAt(i / chrsz) & mask) << (32 - chrsz - i%32);
      return bin;
    }

    /*
     * Convert an array of big-endian words to a string
     */
    function binb2str(bin) {
      var str = "";
      var mask = (1 << chrsz) - 1;
      for(var i = 0; i < bin.length * 32; i += chrsz)
        str += String.fromCharCode((bin[i>>5] >>> (32 - chrsz - i%32)) & mask);
      return str;
    }

    /*
     * Convert an array of big-endian words to a hex string.
     */
    function binb2hex(binarray) {
      var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
      var str = "";
      for(var i = 0; i < binarray.length * 4; i++) {
        str += hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8+4)) & 0xF) +
               hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8  )) & 0xF);
      }
      return str;
    }

    /*
     * Convert an array of big-endian words to a base-64 string
     */
    function binb2b64(binarray) {
      var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      var str = "";
      for(var i = 0; i < binarray.length * 4; i += 3) {
        var triplet = (((binarray[i   >> 2] >> 8 * (3 -  i   %4)) & 0xFF) << 16)
                    | (((binarray[i+1 >> 2] >> 8 * (3 - (i+1)%4)) & 0xFF) << 8 )
                    |  ((binarray[i+2 >> 2] >> 8 * (3 - (i+2)%4)) & 0xFF);
        for(var j = 0; j < 4; j++) {
          if(i * 8 + j * 6 > binarray.length * 32) str += b64pad;
          else str += tab.charAt((triplet >> 6*(3-j)) & 0x3F);
        }
      }
      return str;
    }

    return { b64_hmac_sha1: b64_hmac_sha1 };
}

if (typeof module !== 'undefined') module.exports = sha1;

},{}]},{},[1])
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiIiwic291cmNlcyI6WyIvVXNlcnMvdG1jdy9zcmMvb3NtLWF1dGgvcmVxLmpzIiwiL1VzZXJzL3RtY3cvc3JjL29zbS1hdXRoL2luZGV4LmpzIiwiL1VzZXJzL3RtY3cvc3JjL29zbS1hdXRoL25vZGVfbW9kdWxlcy9zdG9yZS9zdG9yZS5qcyIsIi9Vc2Vycy90bWN3L3NyYy9vc20tYXV0aC9ub2RlX21vZHVsZXMvb2hhdXRoL29oYXV0aC5qcyIsIi9Vc2Vycy90bWN3L3NyYy9vc20tYXV0aC9ub2RlX21vZHVsZXMvb2hhdXRoL3NoYS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0tBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZVJvb3QiOiJmaWxlOi8vbG9jYWxob3N0Iiwic291cmNlc0NvbnRlbnQiOlsid2luZG93Lm9zbUF1dGggPSByZXF1aXJlKCcuLycpO1xuIiwidmFyIG9oYXV0aCA9IHJlcXVpcmUoJ29oYXV0aCcpLFxuICAgIHN0b3JlID0gcmVxdWlyZSgnc3RvcmUnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihvKSB7XG5cbiAgICAvLyBvIGlzIGZvciBvcHRpb25zLiBmb3IgZXhhbXBsZSxcbiAgICAvL1xuICAgIC8vIHsgb2F1dGhfc2VjcmV0OiAnOVdmSm53UXhEdnZZYWd4MVV0MHRaQnNPWjBaQ3pBdk9qZTN1MVRWMCcsXG4gICAgLy8gICBvYXV0aF9jb25zdW1lcl9rZXk6IFwiV0x3WGJtNlhGTUc3V3JWbkU4ZW5JRjZHenllZllJTjZvVUpTeEc2NVwiLFxuICAgIC8vICAgb2F1dGhfc2lnbmF0dXJlX21ldGhvZDogXCJITUFDLVNIQTFcIiB9XG5cbiAgICBmdW5jdGlvbiB0aW1lbm9uY2Uobykge1xuICAgICAgICBvLm9hdXRoX3RpbWVzdGFtcCA9IG9oYXV0aC50aW1lc3RhbXAoKTtcbiAgICAgICAgby5vYXV0aF9ub25jZSA9IG9oYXV0aC5ub25jZSgpO1xuICAgICAgICByZXR1cm4gbztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0b2tlbih4LCB5KSB7XG4gICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSByZXR1cm4gc3RvcmUuZ2V0KG8udXJsICsgeCk7XG4gICAgICAgIGVsc2UgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHJldHVybiBzdG9yZS5zZXQoby51cmwgKyB4LCB5KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRBdXRoKG8pIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG9hdXRoX2NvbnN1bWVyX2tleTogby5vYXV0aF9jb25zdW1lcl9rZXksXG4gICAgICAgICAgICBvYXV0aF9zaWduYXR1cmVfbWV0aG9kOiBcIkhNQUMtU0hBMVwiLFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIG8udXJsID0gby51cmwgfHwgJ2h0dHA6Ly93d3cub3BlbnN0cmVldG1hcC5vcmcnO1xuXG4gICAgdmFyIG9hdXRoID0ge307XG5cbiAgICBvYXV0aC5hdXRoZW50aWNhdGVkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0b2tlbignb2F1dGhfdG9rZW4nKSAmJiB0b2tlbignb2F1dGhfdG9rZW5fc2VjcmV0Jyk7XG4gICAgfTtcblxuICAgIG9hdXRoLmxvZ291dCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0b2tlbignb2F1dGhfdG9rZW4nLCAnJyk7XG4gICAgICAgIHRva2VuKCdvYXV0aF90b2tlbl9zZWNyZXQnLCAnJyk7XG4gICAgICAgIHRva2VuKCdvYXV0aF9yZXF1ZXN0X3Rva2VuX3NlY3JldCcsICcnKTtcbiAgICAgICAgcmV0dXJuIG9hdXRoO1xuICAgIH07XG5cbiAgICAvLyBUT0RPOiBkZXRlY3QgbGFjayBvZiBjbGljayBldmVudFxuICAgIG9hdXRoLmF1dGhlbnRpY2F0ZSA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICAgIGlmIChvYXV0aC5hdXRoZW50aWNhdGVkKCkpIHJldHVybiBjYWxsYmFjaygpO1xuXG4gICAgICAgIG9hdXRoLmxvZ291dCgpO1xuXG4gICAgICAgIHZhciBwYXJhbXMgPSB0aW1lbm9uY2UoZ2V0QXV0aChvKSksXG4gICAgICAgICAgICB1cmwgPSBvLnVybCArICcvb2F1dGgvcmVxdWVzdF90b2tlbic7XG5cbiAgICAgICAgcGFyYW1zLm9hdXRoX3NpZ25hdHVyZSA9IG9oYXV0aC5zaWduYXR1cmUoXG4gICAgICAgICAgICBvLm9hdXRoX3NlY3JldCwgJycsXG4gICAgICAgICAgICBvaGF1dGguYmFzZVN0cmluZygnUE9TVCcsIHVybCwgcGFyYW1zKSk7XG5cbiAgICAgICAgdmFyIHcgPSA2MDAsIGggPSA1NTAsXG4gICAgICAgICAgICBzZXR0aW5ncyA9IFtcbiAgICAgICAgICAgICAgICBbJ3dpZHRoJywgd10sIFsnaGVpZ2h0JywgaF0sXG4gICAgICAgICAgICAgICAgWydsZWZ0Jywgc2NyZWVuLndpZHRoIC8gMiAtIHcgLyAyXSxcbiAgICAgICAgICAgICAgICBbJ3RvcCcsIHNjcmVlbi5oZWlnaHQgLyAyIC0gaCAvIDJdXS5tYXAoZnVuY3Rpb24oeCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geC5qb2luKCc9Jyk7XG4gICAgICAgICAgICAgICAgfSkuam9pbignLCcpLFxuICAgICAgICAgICAgcG9wdXAgPSB3aW5kb3cub3BlbignYWJvdXQ6YmxhbmsnLCAnb2F1dGhfd2luZG93Jywgc2V0dGluZ3MpO1xuXG4gICAgICAgIG9oYXV0aC54aHIoJ1BPU1QnLCB1cmwsIHBhcmFtcywgbnVsbCwge30sIHJlcVRva2VuRG9uZSk7XG5cbiAgICAgICAgZnVuY3Rpb24gcmVxVG9rZW5Eb25lKGVyciwgeGhyKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSBjYWxsYmFjayhlcnIpO1xuXG4gICAgICAgICAgICB2YXIgcmVzcCA9IG9oYXV0aC5zdHJpbmdRcyh4aHIucmVzcG9uc2UpO1xuICAgICAgICAgICAgdG9rZW4oJ29hdXRoX3JlcXVlc3RfdG9rZW5fc2VjcmV0JywgcmVzcC5vYXV0aF90b2tlbl9zZWNyZXQpO1xuXG4gICAgICAgICAgICBwb3B1cC5sb2NhdGlvbiA9IG8udXJsICsgJy9vYXV0aC9hdXRob3JpemU/JyArIG9oYXV0aC5xc1N0cmluZyh7XG4gICAgICAgICAgICAgICAgb2F1dGhfdG9rZW46IHJlc3Aub2F1dGhfdG9rZW4sXG4gICAgICAgICAgICAgICAgb2F1dGhfY2FsbGJhY2s6IGxvY2F0aW9uLmhyZWYucmVwbGFjZSgnaW5kZXguaHRtbCcsICcnKVxuICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvIy4rLywgJycpICsgJ2xhbmQuaHRtbCdcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgd2luZG93LmF1dGhDb21wbGV0ZSA9IGZ1bmN0aW9uKHRva2VuKSB7XG4gICAgICAgICAgICB2YXIgb2F1dGhfdG9rZW4gPSBvaGF1dGguc3RyaW5nUXModG9rZW4uc3BsaXQoJz8nKVsxXSk7XG4gICAgICAgICAgICBnZXRfYWNjZXNzX3Rva2VuKG9hdXRoX3Rva2VuLm9hdXRoX3Rva2VuKTtcbiAgICAgICAgICAgIGRlbGV0ZSB3aW5kb3cuYXV0aENvbXBsZXRlO1xuICAgICAgICB9O1xuXG4gICAgICAgIGZ1bmN0aW9uIGdldF9hY2Nlc3NfdG9rZW4ob2F1dGhfdG9rZW4pIHtcbiAgICAgICAgICAgIHZhciB1cmwgPSBvLnVybCArICcvb2F1dGgvYWNjZXNzX3Rva2VuJztcbiAgICAgICAgICAgIHZhciBwYXJhbXMgPSB0aW1lbm9uY2UoZ2V0QXV0aChvKSk7XG4gICAgICAgICAgICB2YXIgcmVxdWVzdF90b2tlbl9zZWNyZXQgPSB0b2tlbignb2F1dGhfcmVxdWVzdF90b2tlbl9zZWNyZXQnKTtcblxuICAgICAgICAgICAgcGFyYW1zLm9hdXRoX3Rva2VuID0gb2F1dGhfdG9rZW47XG4gICAgICAgICAgICBwYXJhbXMub2F1dGhfc2lnbmF0dXJlID0gb2hhdXRoLnNpZ25hdHVyZShcbiAgICAgICAgICAgICAgICBvLm9hdXRoX3NlY3JldCxcbiAgICAgICAgICAgICAgICByZXF1ZXN0X3Rva2VuX3NlY3JldCxcbiAgICAgICAgICAgICAgICBvaGF1dGguYmFzZVN0cmluZygnUE9TVCcsIHVybCwgcGFyYW1zKSk7XG5cbiAgICAgICAgICAgIG9oYXV0aC54aHIoJ1BPU1QnLCB1cmwsIHBhcmFtcywgbnVsbCwge30sIGFjY2Vzc1Rva2VuRG9uZSk7XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIGFjY2Vzc1Rva2VuRG9uZShlcnIsIHhocikge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgdmFyIGFjY2Vzc190b2tlbiA9IG9oYXV0aC5zdHJpbmdRcyh4aHIucmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgIHRva2VuKCdvYXV0aF90b2tlbicsIGFjY2Vzc190b2tlbi5vYXV0aF90b2tlbik7XG4gICAgICAgICAgICAgICAgdG9rZW4oJ29hdXRoX3Rva2VuX3NlY3JldCcsIGFjY2Vzc190b2tlbi5vYXV0aF90b2tlbl9zZWNyZXQpO1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgb2F1dGgueGhyID0gZnVuY3Rpb24ob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICAgICAgdmFyIHBhcmFtcyA9IHRpbWVub25jZShnZXRBdXRoKG8pKTtcbiAgICAgICAgaWYgKHRva2VuKCdvYXV0aF90b2tlbicpKSB7XG4gICAgICAgICAgICBwYXJhbXMub2F1dGhfdG9rZW4gPSB0b2tlbignb2F1dGhfdG9rZW4nKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjaygnbm90IGF1dGhlbnRpY2F0ZWQnLCBudWxsKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgdXJsID0gby51cmwgKyBvcHRpb25zLnBhdGg7XG4gICAgICAgIHZhciBvYXV0aF90b2tlbl9zZWNyZXQgPSB0b2tlbignb2F1dGhfdG9rZW5fc2VjcmV0Jyk7XG4gICAgICAgIHBhcmFtcy5vYXV0aF9zaWduYXR1cmUgPSBvaGF1dGguc2lnbmF0dXJlKFxuICAgICAgICAgICAgby5vYXV0aF9zZWNyZXQsXG4gICAgICAgICAgICBvYXV0aF90b2tlbl9zZWNyZXQsXG4gICAgICAgICAgICBvaGF1dGguYmFzZVN0cmluZyhvcHRpb25zLm1ldGhvZCwgdXJsLCBwYXJhbXMpKTtcbiAgICAgICAgZnVuY3Rpb24gZG9uZShlcnIsIHhocikge1xuICAgICAgICAgICAgaWYgKGVycikgcmV0dXJuIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICBpZiAoeGhyLnJlc3BvbnNlWE1MKSByZXR1cm4gY2FsbGJhY2soZXJyLCB4aHIucmVzcG9uc2VYTUwpO1xuICAgICAgICAgICAgZWxzZSByZXR1cm4gY2FsbGJhY2soZXJyLCB4aHIucmVzcG9uc2UpO1xuICAgICAgICB9XG4gICAgICAgIG9oYXV0aC54aHIob3B0aW9ucy5tZXRob2QsXG4gICAgICAgICAgICB1cmwsIHBhcmFtcywgb3B0aW9ucy5jb250ZW50LCBvcHRpb25zLm9wdGlvbnMsIGRvbmUpO1xuICAgIH07XG5cbiAgICByZXR1cm4gb2F1dGg7XG59O1xuIiwiLyogQ29weXJpZ2h0IChjKSAyMDEwLTIwMTIgTWFyY3VzIFdlc3RpblxuICpcbiAqIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhIGNvcHlcbiAqIG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWxcbiAqIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcbiAqIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGxcbiAqIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpc1xuICogZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczpcbiAqXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxuICogYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKlxuICogVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUlxuICogSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXG4gKiBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTiBOTyBFVkVOVCBTSEFMTCBUSEVcbiAqIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVJcbiAqIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXG4gKiBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOXG4gKiBUSEUgU09GVFdBUkUuXG4gKi9cblxuOyhmdW5jdGlvbigpe1xuXHR2YXIgc3RvcmUgPSB7fSxcblx0XHR3aW4gPSB3aW5kb3csXG5cdFx0ZG9jID0gd2luLmRvY3VtZW50LFxuXHRcdGxvY2FsU3RvcmFnZU5hbWUgPSAnbG9jYWxTdG9yYWdlJyxcblx0XHRuYW1lc3BhY2UgPSAnX19zdG9yZWpzX18nLFxuXHRcdHN0b3JhZ2VcblxuXHRzdG9yZS5kaXNhYmxlZCA9IGZhbHNlXG5cdHN0b3JlLnNldCA9IGZ1bmN0aW9uKGtleSwgdmFsdWUpIHt9XG5cdHN0b3JlLmdldCA9IGZ1bmN0aW9uKGtleSkge31cblx0c3RvcmUucmVtb3ZlID0gZnVuY3Rpb24oa2V5KSB7fVxuXHRzdG9yZS5jbGVhciA9IGZ1bmN0aW9uKCkge31cblx0c3RvcmUudHJhbnNhY3QgPSBmdW5jdGlvbihrZXksIGRlZmF1bHRWYWwsIHRyYW5zYWN0aW9uRm4pIHtcblx0XHR2YXIgdmFsID0gc3RvcmUuZ2V0KGtleSlcblx0XHRpZiAodHJhbnNhY3Rpb25GbiA9PSBudWxsKSB7XG5cdFx0XHR0cmFuc2FjdGlvbkZuID0gZGVmYXVsdFZhbFxuXHRcdFx0ZGVmYXVsdFZhbCA9IG51bGxcblx0XHR9XG5cdFx0aWYgKHR5cGVvZiB2YWwgPT0gJ3VuZGVmaW5lZCcpIHsgdmFsID0gZGVmYXVsdFZhbCB8fCB7fSB9XG5cdFx0dHJhbnNhY3Rpb25Gbih2YWwpXG5cdFx0c3RvcmUuc2V0KGtleSwgdmFsKVxuXHR9XG5cdHN0b3JlLmdldEFsbCA9IGZ1bmN0aW9uKCkge31cblxuXHRzdG9yZS5zZXJpYWxpemUgPSBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdHJldHVybiBKU09OLnN0cmluZ2lmeSh2YWx1ZSlcblx0fVxuXHRzdG9yZS5kZXNlcmlhbGl6ZSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0aWYgKHR5cGVvZiB2YWx1ZSAhPSAnc3RyaW5nJykgeyByZXR1cm4gdW5kZWZpbmVkIH1cblx0XHR0cnkgeyByZXR1cm4gSlNPTi5wYXJzZSh2YWx1ZSkgfVxuXHRcdGNhdGNoKGUpIHsgcmV0dXJuIHZhbHVlIHx8IHVuZGVmaW5lZCB9XG5cdH1cblxuXHQvLyBGdW5jdGlvbnMgdG8gZW5jYXBzdWxhdGUgcXVlc3Rpb25hYmxlIEZpcmVGb3ggMy42LjEzIGJlaGF2aW9yXG5cdC8vIHdoZW4gYWJvdXQuY29uZmlnOjpkb20uc3RvcmFnZS5lbmFibGVkID09PSBmYWxzZVxuXHQvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL21hcmN1c3dlc3Rpbi9zdG9yZS5qcy9pc3N1ZXMjaXNzdWUvMTNcblx0ZnVuY3Rpb24gaXNMb2NhbFN0b3JhZ2VOYW1lU3VwcG9ydGVkKCkge1xuXHRcdHRyeSB7IHJldHVybiAobG9jYWxTdG9yYWdlTmFtZSBpbiB3aW4gJiYgd2luW2xvY2FsU3RvcmFnZU5hbWVdKSB9XG5cdFx0Y2F0Y2goZXJyKSB7IHJldHVybiBmYWxzZSB9XG5cdH1cblxuXHRpZiAoaXNMb2NhbFN0b3JhZ2VOYW1lU3VwcG9ydGVkKCkpIHtcblx0XHRzdG9yYWdlID0gd2luW2xvY2FsU3RvcmFnZU5hbWVdXG5cdFx0c3RvcmUuc2V0ID0gZnVuY3Rpb24oa2V5LCB2YWwpIHtcblx0XHRcdGlmICh2YWwgPT09IHVuZGVmaW5lZCkgeyByZXR1cm4gc3RvcmUucmVtb3ZlKGtleSkgfVxuXHRcdFx0c3RvcmFnZS5zZXRJdGVtKGtleSwgc3RvcmUuc2VyaWFsaXplKHZhbCkpXG5cdFx0XHRyZXR1cm4gdmFsXG5cdFx0fVxuXHRcdHN0b3JlLmdldCA9IGZ1bmN0aW9uKGtleSkgeyByZXR1cm4gc3RvcmUuZGVzZXJpYWxpemUoc3RvcmFnZS5nZXRJdGVtKGtleSkpIH1cblx0XHRzdG9yZS5yZW1vdmUgPSBmdW5jdGlvbihrZXkpIHsgc3RvcmFnZS5yZW1vdmVJdGVtKGtleSkgfVxuXHRcdHN0b3JlLmNsZWFyID0gZnVuY3Rpb24oKSB7IHN0b3JhZ2UuY2xlYXIoKSB9XG5cdFx0c3RvcmUuZ2V0QWxsID0gZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgcmV0ID0ge31cblx0XHRcdGZvciAodmFyIGk9MDsgaTxzdG9yYWdlLmxlbmd0aDsgKytpKSB7XG5cdFx0XHRcdHZhciBrZXkgPSBzdG9yYWdlLmtleShpKVxuXHRcdFx0XHRyZXRba2V5XSA9IHN0b3JlLmdldChrZXkpXG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmV0XG5cdFx0fVxuXHR9IGVsc2UgaWYgKGRvYy5kb2N1bWVudEVsZW1lbnQuYWRkQmVoYXZpb3IpIHtcblx0XHR2YXIgc3RvcmFnZU93bmVyLFxuXHRcdFx0c3RvcmFnZUNvbnRhaW5lclxuXHRcdC8vIFNpbmNlICN1c2VyRGF0YSBzdG9yYWdlIGFwcGxpZXMgb25seSB0byBzcGVjaWZpYyBwYXRocywgd2UgbmVlZCB0b1xuXHRcdC8vIHNvbWVob3cgbGluayBvdXIgZGF0YSB0byBhIHNwZWNpZmljIHBhdGguICBXZSBjaG9vc2UgL2Zhdmljb24uaWNvXG5cdFx0Ly8gYXMgYSBwcmV0dHkgc2FmZSBvcHRpb24sIHNpbmNlIGFsbCBicm93c2VycyBhbHJlYWR5IG1ha2UgYSByZXF1ZXN0IHRvXG5cdFx0Ly8gdGhpcyBVUkwgYW55d2F5IGFuZCBiZWluZyBhIDQwNCB3aWxsIG5vdCBodXJ0IHVzIGhlcmUuICBXZSB3cmFwIGFuXG5cdFx0Ly8gaWZyYW1lIHBvaW50aW5nIHRvIHRoZSBmYXZpY29uIGluIGFuIEFjdGl2ZVhPYmplY3QoaHRtbGZpbGUpIG9iamVjdFxuXHRcdC8vIChzZWU6IGh0dHA6Ly9tc2RuLm1pY3Jvc29mdC5jb20vZW4tdXMvbGlicmFyeS9hYTc1MjU3NCh2PVZTLjg1KS5hc3B4KVxuXHRcdC8vIHNpbmNlIHRoZSBpZnJhbWUgYWNjZXNzIHJ1bGVzIGFwcGVhciB0byBhbGxvdyBkaXJlY3QgYWNjZXNzIGFuZFxuXHRcdC8vIG1hbmlwdWxhdGlvbiBvZiB0aGUgZG9jdW1lbnQgZWxlbWVudCwgZXZlbiBmb3IgYSA0MDQgcGFnZS4gIFRoaXNcblx0XHQvLyBkb2N1bWVudCBjYW4gYmUgdXNlZCBpbnN0ZWFkIG9mIHRoZSBjdXJyZW50IGRvY3VtZW50ICh3aGljaCB3b3VsZFxuXHRcdC8vIGhhdmUgYmVlbiBsaW1pdGVkIHRvIHRoZSBjdXJyZW50IHBhdGgpIHRvIHBlcmZvcm0gI3VzZXJEYXRhIHN0b3JhZ2UuXG5cdFx0dHJ5IHtcblx0XHRcdHN0b3JhZ2VDb250YWluZXIgPSBuZXcgQWN0aXZlWE9iamVjdCgnaHRtbGZpbGUnKVxuXHRcdFx0c3RvcmFnZUNvbnRhaW5lci5vcGVuKClcblx0XHRcdHN0b3JhZ2VDb250YWluZXIud3JpdGUoJzxzJyArICdjcmlwdD5kb2N1bWVudC53PXdpbmRvdzwvcycgKyAnY3JpcHQ+PGlmcmFtZSBzcmM9XCIvZmF2aWNvbi5pY29cIj48L2ZyYW1lPicpXG5cdFx0XHRzdG9yYWdlQ29udGFpbmVyLmNsb3NlKClcblx0XHRcdHN0b3JhZ2VPd25lciA9IHN0b3JhZ2VDb250YWluZXIudy5mcmFtZXNbMF0uZG9jdW1lbnRcblx0XHRcdHN0b3JhZ2UgPSBzdG9yYWdlT3duZXIuY3JlYXRlRWxlbWVudCgnZGl2Jylcblx0XHR9IGNhdGNoKGUpIHtcblx0XHRcdC8vIHNvbWVob3cgQWN0aXZlWE9iamVjdCBpbnN0YW50aWF0aW9uIGZhaWxlZCAocGVyaGFwcyBzb21lIHNwZWNpYWxcblx0XHRcdC8vIHNlY3VyaXR5IHNldHRpbmdzIG9yIG90aGVyd3NlKSwgZmFsbCBiYWNrIHRvIHBlci1wYXRoIHN0b3JhZ2Vcblx0XHRcdHN0b3JhZ2UgPSBkb2MuY3JlYXRlRWxlbWVudCgnZGl2Jylcblx0XHRcdHN0b3JhZ2VPd25lciA9IGRvYy5ib2R5XG5cdFx0fVxuXHRcdGZ1bmN0aW9uIHdpdGhJRVN0b3JhZ2Uoc3RvcmVGdW5jdGlvbikge1xuXHRcdFx0cmV0dXJuIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMClcblx0XHRcdFx0YXJncy51bnNoaWZ0KHN0b3JhZ2UpXG5cdFx0XHRcdC8vIFNlZSBodHRwOi8vbXNkbi5taWNyb3NvZnQuY29tL2VuLXVzL2xpYnJhcnkvbXM1MzEwODEodj1WUy44NSkuYXNweFxuXHRcdFx0XHQvLyBhbmQgaHR0cDovL21zZG4ubWljcm9zb2Z0LmNvbS9lbi11cy9saWJyYXJ5L21zNTMxNDI0KHY9VlMuODUpLmFzcHhcblx0XHRcdFx0c3RvcmFnZU93bmVyLmFwcGVuZENoaWxkKHN0b3JhZ2UpXG5cdFx0XHRcdHN0b3JhZ2UuYWRkQmVoYXZpb3IoJyNkZWZhdWx0I3VzZXJEYXRhJylcblx0XHRcdFx0c3RvcmFnZS5sb2FkKGxvY2FsU3RvcmFnZU5hbWUpXG5cdFx0XHRcdHZhciByZXN1bHQgPSBzdG9yZUZ1bmN0aW9uLmFwcGx5KHN0b3JlLCBhcmdzKVxuXHRcdFx0XHRzdG9yYWdlT3duZXIucmVtb3ZlQ2hpbGQoc3RvcmFnZSlcblx0XHRcdFx0cmV0dXJuIHJlc3VsdFxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEluIElFNywga2V5cyBtYXkgbm90IGNvbnRhaW4gc3BlY2lhbCBjaGFycy4gU2VlIGFsbCBvZiBodHRwczovL2dpdGh1Yi5jb20vbWFyY3Vzd2VzdGluL3N0b3JlLmpzL2lzc3Vlcy80MFxuXHRcdHZhciBmb3JiaWRkZW5DaGFyc1JlZ2V4ID0gbmV3IFJlZ0V4cChcIlshXFxcIiMkJSYnKCkqKywvXFxcXFxcXFw6Ozw9Pj9AW1xcXFxdXmB7fH1+XVwiLCBcImdcIilcblx0XHRmdW5jdGlvbiBpZUtleUZpeChrZXkpIHtcblx0XHRcdHJldHVybiBrZXkucmVwbGFjZShmb3JiaWRkZW5DaGFyc1JlZ2V4LCAnX19fJylcblx0XHR9XG5cdFx0c3RvcmUuc2V0ID0gd2l0aElFU3RvcmFnZShmdW5jdGlvbihzdG9yYWdlLCBrZXksIHZhbCkge1xuXHRcdFx0a2V5ID0gaWVLZXlGaXgoa2V5KVxuXHRcdFx0aWYgKHZhbCA9PT0gdW5kZWZpbmVkKSB7IHJldHVybiBzdG9yZS5yZW1vdmUoa2V5KSB9XG5cdFx0XHRzdG9yYWdlLnNldEF0dHJpYnV0ZShrZXksIHN0b3JlLnNlcmlhbGl6ZSh2YWwpKVxuXHRcdFx0c3RvcmFnZS5zYXZlKGxvY2FsU3RvcmFnZU5hbWUpXG5cdFx0XHRyZXR1cm4gdmFsXG5cdFx0fSlcblx0XHRzdG9yZS5nZXQgPSB3aXRoSUVTdG9yYWdlKGZ1bmN0aW9uKHN0b3JhZ2UsIGtleSkge1xuXHRcdFx0a2V5ID0gaWVLZXlGaXgoa2V5KVxuXHRcdFx0cmV0dXJuIHN0b3JlLmRlc2VyaWFsaXplKHN0b3JhZ2UuZ2V0QXR0cmlidXRlKGtleSkpXG5cdFx0fSlcblx0XHRzdG9yZS5yZW1vdmUgPSB3aXRoSUVTdG9yYWdlKGZ1bmN0aW9uKHN0b3JhZ2UsIGtleSkge1xuXHRcdFx0a2V5ID0gaWVLZXlGaXgoa2V5KVxuXHRcdFx0c3RvcmFnZS5yZW1vdmVBdHRyaWJ1dGUoa2V5KVxuXHRcdFx0c3RvcmFnZS5zYXZlKGxvY2FsU3RvcmFnZU5hbWUpXG5cdFx0fSlcblx0XHRzdG9yZS5jbGVhciA9IHdpdGhJRVN0b3JhZ2UoZnVuY3Rpb24oc3RvcmFnZSkge1xuXHRcdFx0dmFyIGF0dHJpYnV0ZXMgPSBzdG9yYWdlLlhNTERvY3VtZW50LmRvY3VtZW50RWxlbWVudC5hdHRyaWJ1dGVzXG5cdFx0XHRzdG9yYWdlLmxvYWQobG9jYWxTdG9yYWdlTmFtZSlcblx0XHRcdGZvciAodmFyIGk9MCwgYXR0cjsgYXR0cj1hdHRyaWJ1dGVzW2ldOyBpKyspIHtcblx0XHRcdFx0c3RvcmFnZS5yZW1vdmVBdHRyaWJ1dGUoYXR0ci5uYW1lKVxuXHRcdFx0fVxuXHRcdFx0c3RvcmFnZS5zYXZlKGxvY2FsU3RvcmFnZU5hbWUpXG5cdFx0fSlcblx0XHRzdG9yZS5nZXRBbGwgPSB3aXRoSUVTdG9yYWdlKGZ1bmN0aW9uKHN0b3JhZ2UpIHtcblx0XHRcdHZhciBhdHRyaWJ1dGVzID0gc3RvcmFnZS5YTUxEb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuYXR0cmlidXRlc1xuXHRcdFx0c3RvcmFnZS5sb2FkKGxvY2FsU3RvcmFnZU5hbWUpXG5cdFx0XHR2YXIgcmV0ID0ge31cblx0XHRcdGZvciAodmFyIGk9MCwgYXR0cjsgYXR0cj1hdHRyaWJ1dGVzW2ldOyArK2kpIHtcblx0XHRcdFx0cmV0W2F0dHJdID0gc3RvcmUuZ2V0KGF0dHIpXG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmV0XG5cdFx0fSlcblx0fVxuXG5cdHRyeSB7XG5cdFx0c3RvcmUuc2V0KG5hbWVzcGFjZSwgbmFtZXNwYWNlKVxuXHRcdGlmIChzdG9yZS5nZXQobmFtZXNwYWNlKSAhPSBuYW1lc3BhY2UpIHsgc3RvcmUuZGlzYWJsZWQgPSB0cnVlIH1cblx0XHRzdG9yZS5yZW1vdmUobmFtZXNwYWNlKVxuXHR9IGNhdGNoKGUpIHtcblx0XHRzdG9yZS5kaXNhYmxlZCA9IHRydWVcblx0fVxuXHRzdG9yZS5lbmFibGVkID0gIXN0b3JlLmRpc2FibGVkXG5cblx0aWYgKHR5cGVvZiBtb2R1bGUgIT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIG1vZHVsZSAhPSAnZnVuY3Rpb24nKSB7IG1vZHVsZS5leHBvcnRzID0gc3RvcmUgfVxuXHRlbHNlIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHsgZGVmaW5lKHN0b3JlKSB9XG5cdGVsc2UgeyB0aGlzLnN0b3JlID0gc3RvcmUgfVxufSkoKTtcbiIsIihmdW5jdGlvbihjb250ZXh0KSB7XG5cbmlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJykge1xuICAgIHZhciBzaGExID0gcmVxdWlyZSgnLi9zaGEnKTtcbn1cblxudmFyIG9oYXV0aCA9IHt9O1xuXG5vaGF1dGgucXNTdHJpbmcgPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXMob2JqKS5zb3J0KCkubWFwKGZ1bmN0aW9uKGtleSkge1xuICAgICAgICByZXR1cm4gZW5jb2RlVVJJQ29tcG9uZW50KGtleSkgKyAnPScgK1xuICAgICAgICAgICAgZW5jb2RlVVJJQ29tcG9uZW50KG9ialtrZXldKTtcbiAgICB9KS5qb2luKCcmJyk7XG59O1xuXG5vaGF1dGguc2hhID0gc2hhMSgpO1xuXG5vaGF1dGguc3RyaW5nUXMgPSBmdW5jdGlvbihzdHIpIHtcbiAgICByZXR1cm4gc3RyLnNwbGl0KCcmJykucmVkdWNlKGZ1bmN0aW9uKG9iaiwgcGFpcil7XG4gICAgICAgIHZhciBwYXJ0cyA9IHBhaXIuc3BsaXQoJz0nKTtcbiAgICAgICAgb2JqW3BhcnRzWzBdXSA9IChudWxsID09PSBwYXJ0c1sxXSkgP1xuICAgICAgICAgICAgJycgOiBkZWNvZGVVUklDb21wb25lbnQocGFydHNbMV0pO1xuICAgICAgICByZXR1cm4gb2JqO1xuICAgIH0sIHt9KTtcbn07XG5cbm9oYXV0aC5yYXd4aHIgPSBmdW5jdGlvbihtZXRob2QsIHVybCwgZGF0YSwgaGVhZGVycywgY2FsbGJhY2spIHtcbiAgICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCksIHR3b0h1bmRyZWQgPSAvXjIwXFxkJC87XG4gICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoNCA9PSB4aHIucmVhZHlTdGF0ZSAmJiAwICE9PSB4aHIuc3RhdHVzKSB7XG4gICAgICAgICAgICBpZiAodHdvSHVuZHJlZC50ZXN0KHhoci5zdGF0dXMpKSBjYWxsYmFjayhudWxsLCB4aHIpO1xuICAgICAgICAgICAgZWxzZSByZXR1cm4gY2FsbGJhY2soeGhyLCBudWxsKTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgeGhyLm9uZXJyb3IgPSBmdW5jdGlvbihlKSB7IHJldHVybiBjYWxsYmFjayhlLCBudWxsKTsgfTtcbiAgICB4aHIub3BlbihtZXRob2QsIHVybCwgdHJ1ZSk7XG4gICAgZm9yICh2YXIgaCBpbiBoZWFkZXJzKSB4aHIuc2V0UmVxdWVzdEhlYWRlcihoLCBoZWFkZXJzW2hdKTtcbiAgICB4aHIuc2VuZChkYXRhKTtcbn07XG5cbm9oYXV0aC54aHIgPSBmdW5jdGlvbihtZXRob2QsIHVybCwgYXV0aCwgZGF0YSwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICB2YXIgaGVhZGVycyA9IChvcHRpb25zICYmIG9wdGlvbnMuaGVhZGVyKSB8fCB7XG4gICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkJ1xuICAgIH07XG4gICAgaGVhZGVycy5BdXRob3JpemF0aW9uID0gJ09BdXRoICcgKyBvaGF1dGguYXV0aEhlYWRlcihhdXRoKTtcbiAgICBvaGF1dGgucmF3eGhyKG1ldGhvZCwgdXJsLCBkYXRhLCBoZWFkZXJzLCBjYWxsYmFjayk7XG59O1xuXG5vaGF1dGgubm9uY2UgPSBmdW5jdGlvbigpIHtcbiAgICBmb3IgKHZhciBvID0gJyc7IG8ubGVuZ3RoIDwgNjspIHtcbiAgICAgICAgbyArPSAnMDEyMzQ1Njc4OUFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFRaYWJjZGVmZ2hpa2xtbm9wcXJzdHV2d3h5eidbTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogNjEpXTtcbiAgICB9XG4gICAgcmV0dXJuIG87XG59O1xuXG5vaGF1dGguYXV0aEhlYWRlciA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyhvYmopLnNvcnQoKS5tYXAoZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgIHJldHVybiBlbmNvZGVVUklDb21wb25lbnQoa2V5KSArICc9XCInICsgZW5jb2RlVVJJQ29tcG9uZW50KG9ialtrZXldKSArICdcIic7XG4gICAgfSkuam9pbignLCAnKTtcbn07XG5cbm9oYXV0aC50aW1lc3RhbXAgPSBmdW5jdGlvbigpIHsgcmV0dXJuIH5+KCgrbmV3IERhdGUoKSkgLyAxMDAwKTsgfTtcblxub2hhdXRoLnBlcmNlbnRFbmNvZGUgPSBmdW5jdGlvbihzKSB7XG4gICAgcmV0dXJuIGVuY29kZVVSSUNvbXBvbmVudChzKVxuICAgICAgICAucmVwbGFjZSgvXFwhL2csICclMjEnKS5yZXBsYWNlKC9cXCcvZywgJyUyNycpXG4gICAgICAgIC5yZXBsYWNlKC9cXCovZywgJyUyQScpLnJlcGxhY2UoL1xcKC9nLCAnJTI4JykucmVwbGFjZSgvXFwpL2csICclMjknKTtcbn07XG5cbm9oYXV0aC5iYXNlU3RyaW5nID0gZnVuY3Rpb24obWV0aG9kLCB1cmwsIHBhcmFtcykge1xuICAgIGlmIChwYXJhbXMub2F1dGhfc2lnbmF0dXJlKSBkZWxldGUgcGFyYW1zLm9hdXRoX3NpZ25hdHVyZTtcbiAgICByZXR1cm4gW1xuICAgICAgICBtZXRob2QsXG4gICAgICAgIG9oYXV0aC5wZXJjZW50RW5jb2RlKHVybCksXG4gICAgICAgIG9oYXV0aC5wZXJjZW50RW5jb2RlKG9oYXV0aC5xc1N0cmluZyhwYXJhbXMpKV0uam9pbignJicpO1xufTtcblxub2hhdXRoLnNpZ25hdHVyZSA9IGZ1bmN0aW9uKG9hdXRoX3NlY3JldCwgdG9rZW5fc2VjcmV0LCBiYXNlU3RyaW5nKSB7XG4gICAgcmV0dXJuIG9oYXV0aC5zaGEuYjY0X2htYWNfc2hhMShcbiAgICAgICAgb2hhdXRoLnBlcmNlbnRFbmNvZGUob2F1dGhfc2VjcmV0KSArICcmJyArXG4gICAgICAgIG9oYXV0aC5wZXJjZW50RW5jb2RlKHRva2VuX3NlY3JldCksXG4gICAgICAgIGJhc2VTdHJpbmcpO1xufTtcblxuY29udGV4dC5vaGF1dGggPSBvaGF1dGg7XG5cbi8vIGV4cG9ydCBmb3IgbnBtL2Jyb3dzZXJpZnkgY29tcGF0aWJpbGl0eVxuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnKSBtb2R1bGUuZXhwb3J0cyA9IG9oYXV0aDtcblxufSkodGhpcyk7XG4iLCIvKlxuICogQSBKYXZhU2NyaXB0IGltcGxlbWVudGF0aW9uIG9mIHRoZSBTZWN1cmUgSGFzaCBBbGdvcml0aG0sIFNIQS0xLCBhcyBkZWZpbmVkXG4gKiBpbiBGSVBTIFBVQiAxODAtMVxuICogVmVyc2lvbiAyLjFhIENvcHlyaWdodCBQYXVsIEpvaG5zdG9uIDIwMDAgLSAyMDAyLlxuICogT3RoZXIgY29udHJpYnV0b3JzOiBHcmVnIEhvbHQsIEFuZHJldyBLZXBlcnQsIFlkbmFyLCBMb3N0aW5ldFxuICogRGlzdHJpYnV0ZWQgdW5kZXIgdGhlIEJTRCBMaWNlbnNlXG4gKiBTZWUgaHR0cDovL3BhamhvbWUub3JnLnVrL2NyeXB0L21kNSBmb3IgZGV0YWlscy5cbiAqL1xuXG5mdW5jdGlvbiBzaGExKCkge1xuXG4gICAgLypcbiAgICAgKiBDb25maWd1cmFibGUgdmFyaWFibGVzLiBZb3UgbWF5IG5lZWQgdG8gdHdlYWsgdGhlc2UgdG8gYmUgY29tcGF0aWJsZSB3aXRoXG4gICAgICogdGhlIHNlcnZlci1zaWRlLCBidXQgdGhlIGRlZmF1bHRzIHdvcmsgaW4gbW9zdCBjYXNlcy5cbiAgICAgKi9cbiAgICB2YXIgaGV4Y2FzZSA9IDA7ICAvKiBoZXggb3V0cHV0IGZvcm1hdC4gMCAtIGxvd2VyY2FzZTsgMSAtIHVwcGVyY2FzZSAgICAgICAgKi9cbiAgICB2YXIgYjY0cGFkICA9IFwiPVwiOyAvKiBiYXNlLTY0IHBhZCBjaGFyYWN0ZXIuIFwiPVwiIGZvciBzdHJpY3QgUkZDIGNvbXBsaWFuY2UgICAqL1xuICAgIHZhciBjaHJzeiAgID0gODsgIC8qIGJpdHMgcGVyIGlucHV0IGNoYXJhY3Rlci4gOCAtIEFTQ0lJOyAxNiAtIFVuaWNvZGUgICAgICAqL1xuXG4gICAgLypcbiAgICAgKiBUaGVzZSBhcmUgdGhlIGZ1bmN0aW9ucyB5b3UnbGwgdXN1YWxseSB3YW50IHRvIGNhbGxcbiAgICAgKiBUaGV5IHRha2Ugc3RyaW5nIGFyZ3VtZW50cyBhbmQgcmV0dXJuIGVpdGhlciBoZXggb3IgYmFzZS02NCBlbmNvZGVkIHN0cmluZ3NcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBoZXhfc2hhMShzKXtyZXR1cm4gYmluYjJoZXgoY29yZV9zaGExKHN0cjJiaW5iKHMpLHMubGVuZ3RoICogY2hyc3opKTt9XG4gICAgZnVuY3Rpb24gYjY0X3NoYTEocyl7cmV0dXJuIGJpbmIyYjY0KGNvcmVfc2hhMShzdHIyYmluYihzKSxzLmxlbmd0aCAqIGNocnN6KSk7fVxuICAgIGZ1bmN0aW9uIHN0cl9zaGExKHMpe3JldHVybiBiaW5iMnN0cihjb3JlX3NoYTEoc3RyMmJpbmIocykscy5sZW5ndGggKiBjaHJzeikpO31cbiAgICBmdW5jdGlvbiBoZXhfaG1hY19zaGExKGtleSwgZGF0YSl7IHJldHVybiBiaW5iMmhleChjb3JlX2htYWNfc2hhMShrZXksIGRhdGEpKTt9XG4gICAgZnVuY3Rpb24gYjY0X2htYWNfc2hhMShrZXksIGRhdGEpeyByZXR1cm4gYmluYjJiNjQoY29yZV9obWFjX3NoYTEoa2V5LCBkYXRhKSk7fVxuICAgIGZ1bmN0aW9uIHN0cl9obWFjX3NoYTEoa2V5LCBkYXRhKXsgcmV0dXJuIGJpbmIyc3RyKGNvcmVfaG1hY19zaGExKGtleSwgZGF0YSkpO31cblxuICAgIC8qXG4gICAgICogUGVyZm9ybSBhIHNpbXBsZSBzZWxmLXRlc3QgdG8gc2VlIGlmIHRoZSBWTSBpcyB3b3JraW5nXG4gICAgICovXG4gICAgZnVuY3Rpb24gc2hhMV92bV90ZXN0KCkge1xuICAgICAgcmV0dXJuIGhleF9zaGExKFwiYWJjXCIpID09IFwiYTk5OTNlMzY0NzA2ODE2YWJhM2UyNTcxNzg1MGMyNmM5Y2QwZDg5ZFwiO1xuICAgIH1cblxuICAgIC8qXG4gICAgICogQ2FsY3VsYXRlIHRoZSBTSEEtMSBvZiBhbiBhcnJheSBvZiBiaWctZW5kaWFuIHdvcmRzLCBhbmQgYSBiaXQgbGVuZ3RoXG4gICAgICovXG4gICAgZnVuY3Rpb24gY29yZV9zaGExKHgsIGxlbikge1xuICAgICAgLyogYXBwZW5kIHBhZGRpbmcgKi9cbiAgICAgIHhbbGVuID4+IDVdIHw9IDB4ODAgPDwgKDI0IC0gbGVuICUgMzIpO1xuICAgICAgeFsoKGxlbiArIDY0ID4+IDkpIDw8IDQpICsgMTVdID0gbGVuO1xuXG4gICAgICB2YXIgdyA9IEFycmF5KDgwKTtcbiAgICAgIHZhciBhID0gIDE3MzI1ODQxOTM7XG4gICAgICB2YXIgYiA9IC0yNzE3MzM4Nzk7XG4gICAgICB2YXIgYyA9IC0xNzMyNTg0MTk0O1xuICAgICAgdmFyIGQgPSAgMjcxNzMzODc4O1xuICAgICAgdmFyIGUgPSAtMTAwOTU4OTc3NjtcblxuICAgICAgZm9yKHZhciBpID0gMDsgaSA8IHgubGVuZ3RoOyBpICs9IDE2KSB7XG4gICAgICAgIHZhciBvbGRhID0gYTtcbiAgICAgICAgdmFyIG9sZGIgPSBiO1xuICAgICAgICB2YXIgb2xkYyA9IGM7XG4gICAgICAgIHZhciBvbGRkID0gZDtcbiAgICAgICAgdmFyIG9sZGUgPSBlO1xuXG4gICAgICAgIGZvcih2YXIgaiA9IDA7IGogPCA4MDsgaisrKSB7XG4gICAgICAgICAgaWYoaiA8IDE2KSB3W2pdID0geFtpICsgal07XG4gICAgICAgICAgZWxzZSB3W2pdID0gcm9sKHdbai0zXSBeIHdbai04XSBeIHdbai0xNF0gXiB3W2otMTZdLCAxKTtcbiAgICAgICAgICB2YXIgdCA9IHNhZmVfYWRkKHNhZmVfYWRkKHJvbChhLCA1KSwgc2hhMV9mdChqLCBiLCBjLCBkKSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBzYWZlX2FkZChzYWZlX2FkZChlLCB3W2pdKSwgc2hhMV9rdChqKSkpO1xuICAgICAgICAgIGUgPSBkO1xuICAgICAgICAgIGQgPSBjO1xuICAgICAgICAgIGMgPSByb2woYiwgMzApO1xuICAgICAgICAgIGIgPSBhO1xuICAgICAgICAgIGEgPSB0O1xuICAgICAgICB9XG5cbiAgICAgICAgYSA9IHNhZmVfYWRkKGEsIG9sZGEpO1xuICAgICAgICBiID0gc2FmZV9hZGQoYiwgb2xkYik7XG4gICAgICAgIGMgPSBzYWZlX2FkZChjLCBvbGRjKTtcbiAgICAgICAgZCA9IHNhZmVfYWRkKGQsIG9sZGQpO1xuICAgICAgICBlID0gc2FmZV9hZGQoZSwgb2xkZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gQXJyYXkoYSwgYiwgYywgZCwgZSk7XG5cbiAgICB9XG5cbiAgICAvKlxuICAgICAqIFBlcmZvcm0gdGhlIGFwcHJvcHJpYXRlIHRyaXBsZXQgY29tYmluYXRpb24gZnVuY3Rpb24gZm9yIHRoZSBjdXJyZW50XG4gICAgICogaXRlcmF0aW9uXG4gICAgICovXG4gICAgZnVuY3Rpb24gc2hhMV9mdCh0LCBiLCBjLCBkKSB7XG4gICAgICBpZih0IDwgMjApIHJldHVybiAoYiAmIGMpIHwgKCh+YikgJiBkKTtcbiAgICAgIGlmKHQgPCA0MCkgcmV0dXJuIGIgXiBjIF4gZDtcbiAgICAgIGlmKHQgPCA2MCkgcmV0dXJuIChiICYgYykgfCAoYiAmIGQpIHwgKGMgJiBkKTtcbiAgICAgIHJldHVybiBiIF4gYyBeIGQ7XG4gICAgfVxuXG4gICAgLypcbiAgICAgKiBEZXRlcm1pbmUgdGhlIGFwcHJvcHJpYXRlIGFkZGl0aXZlIGNvbnN0YW50IGZvciB0aGUgY3VycmVudCBpdGVyYXRpb25cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBzaGExX2t0KHQpIHtcbiAgICAgIHJldHVybiAodCA8IDIwKSA/ICAxNTE4NTAwMjQ5IDogKHQgPCA0MCkgPyAgMTg1OTc3NTM5MyA6XG4gICAgICAgICAgICAgKHQgPCA2MCkgPyAtMTg5NDAwNzU4OCA6IC04OTk0OTc1MTQ7XG4gICAgfVxuXG4gICAgLypcbiAgICAgKiBDYWxjdWxhdGUgdGhlIEhNQUMtU0hBMSBvZiBhIGtleSBhbmQgc29tZSBkYXRhXG4gICAgICovXG4gICAgZnVuY3Rpb24gY29yZV9obWFjX3NoYTEoa2V5LCBkYXRhKSB7XG4gICAgICB2YXIgYmtleSA9IHN0cjJiaW5iKGtleSk7XG4gICAgICBpZihia2V5Lmxlbmd0aCA+IDE2KSBia2V5ID0gY29yZV9zaGExKGJrZXksIGtleS5sZW5ndGggKiBjaHJzeik7XG5cbiAgICAgIHZhciBpcGFkID0gQXJyYXkoMTYpLCBvcGFkID0gQXJyYXkoMTYpO1xuICAgICAgZm9yKHZhciBpID0gMDsgaSA8IDE2OyBpKyspIHtcbiAgICAgICAgaXBhZFtpXSA9IGJrZXlbaV0gXiAweDM2MzYzNjM2O1xuICAgICAgICBvcGFkW2ldID0gYmtleVtpXSBeIDB4NUM1QzVDNUM7XG4gICAgICB9XG5cbiAgICAgIHZhciBoYXNoID0gY29yZV9zaGExKGlwYWQuY29uY2F0KHN0cjJiaW5iKGRhdGEpKSwgNTEyICsgZGF0YS5sZW5ndGggKiBjaHJzeik7XG4gICAgICByZXR1cm4gY29yZV9zaGExKG9wYWQuY29uY2F0KGhhc2gpLCA1MTIgKyAxNjApO1xuICAgIH1cblxuICAgIC8qXG4gICAgICogQWRkIGludGVnZXJzLCB3cmFwcGluZyBhdCAyXjMyLiBUaGlzIHVzZXMgMTYtYml0IG9wZXJhdGlvbnMgaW50ZXJuYWxseVxuICAgICAqIHRvIHdvcmsgYXJvdW5kIGJ1Z3MgaW4gc29tZSBKUyBpbnRlcnByZXRlcnMuXG4gICAgICovXG4gICAgZnVuY3Rpb24gc2FmZV9hZGQoeCwgeSkge1xuICAgICAgdmFyIGxzdyA9ICh4ICYgMHhGRkZGKSArICh5ICYgMHhGRkZGKTtcbiAgICAgIHZhciBtc3cgPSAoeCA+PiAxNikgKyAoeSA+PiAxNikgKyAobHN3ID4+IDE2KTtcbiAgICAgIHJldHVybiAobXN3IDw8IDE2KSB8IChsc3cgJiAweEZGRkYpO1xuICAgIH1cblxuICAgIC8qXG4gICAgICogQml0d2lzZSByb3RhdGUgYSAzMi1iaXQgbnVtYmVyIHRvIHRoZSBsZWZ0LlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHJvbChudW0sIGNudCkge1xuICAgICAgcmV0dXJuIChudW0gPDwgY250KSB8IChudW0gPj4+ICgzMiAtIGNudCkpO1xuICAgIH1cblxuICAgIC8qXG4gICAgICogQ29udmVydCBhbiA4LWJpdCBvciAxNi1iaXQgc3RyaW5nIHRvIGFuIGFycmF5IG9mIGJpZy1lbmRpYW4gd29yZHNcbiAgICAgKiBJbiA4LWJpdCBmdW5jdGlvbiwgY2hhcmFjdGVycyA+MjU1IGhhdmUgdGhlaXIgaGktYnl0ZSBzaWxlbnRseSBpZ25vcmVkLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHN0cjJiaW5iKHN0cikge1xuICAgICAgdmFyIGJpbiA9IEFycmF5KCk7XG4gICAgICB2YXIgbWFzayA9ICgxIDw8IGNocnN6KSAtIDE7XG4gICAgICBmb3IodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aCAqIGNocnN6OyBpICs9IGNocnN6KVxuICAgICAgICBiaW5baT4+NV0gfD0gKHN0ci5jaGFyQ29kZUF0KGkgLyBjaHJzeikgJiBtYXNrKSA8PCAoMzIgLSBjaHJzeiAtIGklMzIpO1xuICAgICAgcmV0dXJuIGJpbjtcbiAgICB9XG5cbiAgICAvKlxuICAgICAqIENvbnZlcnQgYW4gYXJyYXkgb2YgYmlnLWVuZGlhbiB3b3JkcyB0byBhIHN0cmluZ1xuICAgICAqL1xuICAgIGZ1bmN0aW9uIGJpbmIyc3RyKGJpbikge1xuICAgICAgdmFyIHN0ciA9IFwiXCI7XG4gICAgICB2YXIgbWFzayA9ICgxIDw8IGNocnN6KSAtIDE7XG4gICAgICBmb3IodmFyIGkgPSAwOyBpIDwgYmluLmxlbmd0aCAqIDMyOyBpICs9IGNocnN6KVxuICAgICAgICBzdHIgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSgoYmluW2k+PjVdID4+PiAoMzIgLSBjaHJzeiAtIGklMzIpKSAmIG1hc2spO1xuICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG5cbiAgICAvKlxuICAgICAqIENvbnZlcnQgYW4gYXJyYXkgb2YgYmlnLWVuZGlhbiB3b3JkcyB0byBhIGhleCBzdHJpbmcuXG4gICAgICovXG4gICAgZnVuY3Rpb24gYmluYjJoZXgoYmluYXJyYXkpIHtcbiAgICAgIHZhciBoZXhfdGFiID0gaGV4Y2FzZSA/IFwiMDEyMzQ1Njc4OUFCQ0RFRlwiIDogXCIwMTIzNDU2Nzg5YWJjZGVmXCI7XG4gICAgICB2YXIgc3RyID0gXCJcIjtcbiAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBiaW5hcnJheS5sZW5ndGggKiA0OyBpKyspIHtcbiAgICAgICAgc3RyICs9IGhleF90YWIuY2hhckF0KChiaW5hcnJheVtpPj4yXSA+PiAoKDMgLSBpJTQpKjgrNCkpICYgMHhGKSArXG4gICAgICAgICAgICAgICBoZXhfdGFiLmNoYXJBdCgoYmluYXJyYXlbaT4+Ml0gPj4gKCgzIC0gaSU0KSo4ICApKSAmIDB4Rik7XG4gICAgICB9XG4gICAgICByZXR1cm4gc3RyO1xuICAgIH1cblxuICAgIC8qXG4gICAgICogQ29udmVydCBhbiBhcnJheSBvZiBiaWctZW5kaWFuIHdvcmRzIHRvIGEgYmFzZS02NCBzdHJpbmdcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBiaW5iMmI2NChiaW5hcnJheSkge1xuICAgICAgdmFyIHRhYiA9IFwiQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrL1wiO1xuICAgICAgdmFyIHN0ciA9IFwiXCI7XG4gICAgICBmb3IodmFyIGkgPSAwOyBpIDwgYmluYXJyYXkubGVuZ3RoICogNDsgaSArPSAzKSB7XG4gICAgICAgIHZhciB0cmlwbGV0ID0gKCgoYmluYXJyYXlbaSAgID4+IDJdID4+IDggKiAoMyAtICBpICAgJTQpKSAmIDB4RkYpIDw8IDE2KVxuICAgICAgICAgICAgICAgICAgICB8ICgoKGJpbmFycmF5W2krMSA+PiAyXSA+PiA4ICogKDMgLSAoaSsxKSU0KSkgJiAweEZGKSA8PCA4IClcbiAgICAgICAgICAgICAgICAgICAgfCAgKChiaW5hcnJheVtpKzIgPj4gMl0gPj4gOCAqICgzIC0gKGkrMiklNCkpICYgMHhGRik7XG4gICAgICAgIGZvcih2YXIgaiA9IDA7IGogPCA0OyBqKyspIHtcbiAgICAgICAgICBpZihpICogOCArIGogKiA2ID4gYmluYXJyYXkubGVuZ3RoICogMzIpIHN0ciArPSBiNjRwYWQ7XG4gICAgICAgICAgZWxzZSBzdHIgKz0gdGFiLmNoYXJBdCgodHJpcGxldCA+PiA2KigzLWopKSAmIDB4M0YpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gc3RyO1xuICAgIH1cblxuICAgIHJldHVybiB7IGI2NF9obWFjX3NoYTE6IGI2NF9obWFjX3NoYTEgfTtcbn1cblxuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnKSBtb2R1bGUuZXhwb3J0cyA9IHNoYTE7XG4iXX0=
;
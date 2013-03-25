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

        // Called by a function in `land.html`, in the popup window. The
        // window closes itself.
        window.authComplete = function(token) {
            var oauth_token = ohauth.stringQs(token.split('?')[1]);
            get_access_token(oauth_token.oauth_token);
            delete window.authComplete;
        };

        function get_access_token(oauth_token) {
            var url = o.url + '/oauth/access_token',
                params = timenonce(getAuth(o)),
                request_token_secret = token('oauth_request_token_secret');
            params.oauth_token = oauth_token;
            params.oauth_signature = ohauth.signature(
                o.oauth_secret,
                request_token_secret,
                ohauth.baseString('POST', url, params));
            ohauth.xhr('POST', url, params, null, {}, accessTokenDone);
        }

        function accessTokenDone(err, xhr) {
            if (err) callback(err);
            var access_token = ohauth.stringQs(xhr.response);
            token('oauth_token', access_token.oauth_token);
            token('oauth_token_secret', access_token.oauth_token_secret);
            callback();
        }
    };

    oauth.xhr = function(options, callback) {
        if (!token('oauth_token')) {
            if (o.auto) return oauth.authenticate(run);
            else return callback('not authenticated', null);
        } else return run();

        function run() {
            var params = timenonce(getAuth(o)),
                url = o.url + options.path,
                oauth_token_secret = token('oauth_token_secret');

            params.oauth_token = token('oauth_token');
            params.oauth_signature = ohauth.signature(
                o.oauth_secret,
                oauth_token_secret,
                ohauth.baseString(options.method, url, params));

            ohauth.xhr(options.method,
                url, params, options.content, options.options, done);
        }

        function done(err, xhr) {
            if (err) return callback(err);
            else if (xhr.responseXML) return callback(err, xhr.responseXML);
            else return callback(err, xhr.response);
        }
    };

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
var hashes = require('jshashes'),
    sha1 = new hashes.SHA1();

var ohauth = {};

ohauth.qsString = function(obj) {
    return Object.keys(obj).sort().map(function(key) {
        return encodeURIComponent(key) + '=' +
            encodeURIComponent(obj[key]);
    }).join('&');
};

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
    return sha1.b64_hmac(
        ohauth.percentEncode(oauth_secret) + '&' +
        ohauth.percentEncode(token_secret),
        baseString);
};

module.exports = ohauth;

},{"jshashes":5}],5:[function(require,module,exports){
(function(global){/**
 * jsHashes - A fast and independent hashing library pure JavaScript implemented for both server and client side
 * 
 * @class Hashes
 * @author Tomas Aparicio <tomas@rijndael-project.com>
 * @license New BSD (see LICENSE file)
 * @version 1.0.1 - 17/02/2013
 *
 * Algorithms specification:
 *
 * MD5 <http://www.ietf.org/rfc/rfc1321.txt>
 * RIPEMD-160 <http://homes.esat.kuleuven.be/~bosselae/ripemd160.html>
 * SHA1 <http://homes.esat.kuleuven.be/~bosselae/ripemd160.html>
 * SHA256 <http://csrc.nist.gov/publications/fips/fips180-2/fips180-2.pdf>
 * SHA512 <http://csrc.nist.gov/publications/fips/fips180-2/fips180-2.pdf>
 * HMAC <http://www.ietf.org/rfc/rfc2104.txt>
 *
 */
(function(){
  var Hashes;
  
  // private helper methods
  function utf8Encode(input) {
    var output = '', i = -1, x, y;
    while (++i < input.length) {
      /* Decode utf-16 surrogate pairs */
      x = input.charCodeAt(i);
      y = i + 1 < input.length ? input.charCodeAt(i + 1) : 0;
      if (0xD800 <= x && x <= 0xDBFF && 0xDC00 <= y && y <= 0xDFFF) {
          x = 0x10000 + ((x & 0x03FF) << 10) + (y & 0x03FF);
          i += 1;
      }
      /* Encode output as utf-8 */
      if (x <= 0x7F) {
          output += String.fromCharCode(x);
      } else if (x <= 0x7FF) {
          output += String.fromCharCode(0xC0 | ((x >>> 6 ) & 0x1F),
                      0x80 | ( x & 0x3F));
      } else if (x <= 0xFFFF) {
          output += String.fromCharCode(0xE0 | ((x >>> 12) & 0x0F),
                      0x80 | ((x >>> 6 ) & 0x3F),
                      0x80 | ( x & 0x3F));
      } else if (x <= 0x1FFFFF) {
          output += String.fromCharCode(0xF0 | ((x >>> 18) & 0x07),
                      0x80 | ((x >>> 12) & 0x3F),
                      0x80 | ((x >>> 6 ) & 0x3F),
                      0x80 | ( x & 0x3F));
      }
    }
    return output;
  }
  
  function utf8Decode(str_data) {
    var i, ac, c1, c2, c3, arr = [];
    i = ac = c1 = c2 = c3 = 0;
    str_data += '';

    while (i < str_data.length) {
        c1 = str_data.charCodeAt(i);
        ac += 1;
        if (c1 < 128) {
            arr[ac] = String.fromCharCode(c1);
            i+=1;
        } else if (c1 > 191 && c1 < 224) {
            c2 = str_data.charCodeAt(i + 1);
            arr[ac] = String.fromCharCode(((c1 & 31) << 6) | (c2 & 63));
            i += 2;
        } else {
            c2 = str_data.charCodeAt(i + 1);
            c3 = str_data.charCodeAt(i + 2);
            arr[ac] = String.fromCharCode(((c1 & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
            i += 3;
        }
    }
    return arr.join('');
  }

  /**
   * Add integers, wrapping at 2^32. This uses 16-bit operations internally
   * to work around bugs in some JS interpreters.
   */
  function safe_add(x, y) {
    var lsw = (x & 0xFFFF) + (y & 0xFFFF),
        msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
  }

  /**
   * Bitwise rotate a 32-bit number to the left.
   */
  function bit_rol(num, cnt) {
    return (num << cnt) | (num >>> (32 - cnt));
  }

  /**
   * Convert a raw string to a hex string
   */
  function rstr2hex(input, hexcase) {
    var hex_tab = hexcase ? '0123456789ABCDEF' : '0123456789abcdef',
        output = '', x, i = 0;
    for (; i < input.length; i+=1) {
      x = input.charCodeAt(i);
      output += hex_tab.charAt((x >>> 4) & 0x0F) + hex_tab.charAt(x & 0x0F);
    }
    return output;
  }

  /**
   * Encode a string as utf-16
   */
  function str2rstr_utf16le(input) {
    var i = 0, output = '';
    for (; i < input.length; i+=1) {
      output += String.fromCharCode( input.charCodeAt(i) & 0xFF, (input.charCodeAt(i) >>> 8) & 0xFF);
    }
    return output;
  }

  function str2rstr_utf16be(input) {
    var i = 0, output = '';
    for (; i < input.length; i+=1) {
      output += String.fromCharCode((input.charCodeAt(i) >>> 8) & 0xFF, input.charCodeAt(i) & 0xFF);
    }
    return output;
  }

  /**
   * Convert an array of big-endian words to a string
   */
  function binb2rstr(input) {
    var i = 0, output = '';
    for (;i < input.length * 32; i += 8) {
        output += String.fromCharCode((input[i>>5] >>> (24 - i % 32)) & 0xFF);
    }
    return output;
  }

  /**
   * Convert an array of little-endian words to a string
   */
  function binl2rstr(input) {
    var i = 0, output = '';
    for (;i < input.length * 32; i += 8) {
      output += String.fromCharCode((input[i>>5] >>> (i % 32)) & 0xFF);
    }
    return output;
  }

  /**
   * Convert a raw string to an array of little-endian words
   * Characters >255 have their high-byte silently ignored.
   */
  function rstr2binl(input) {
    var i, output = Array(input.length >> 2);
    for (i = 0; i < output.length; i+=1) {
      output[i] = 0;
    }
    for (i = 0; i < input.length * 8; i += 8) {
      output[i>>5] |= (input.charCodeAt(i / 8) & 0xFF) << (i%32);
    }
    return output;
  }
  
  /**
   * Convert a raw string to an array of big-endian words 
   * Characters >255 have their high-byte silently ignored.
   */
   function rstr2binb(input) {
      var i, output = Array(input.length >> 2);
      for (i = 0; i < output.length; i+=1) {
            output[i] = 0;
        }
      for (i = 0; i < input.length * 8; i += 8) {
            output[i>>5] |= (input.charCodeAt(i / 8) & 0xFF) << (24 - i % 32);
        }
      return output;
   }

  /**
   * Convert a raw string to an arbitrary string encoding
   */
  function rstr2any(input, encoding) {
    var divisor = encoding.length,
        remainders = Array(),
        i, q, x, quotient, dividend, output, full_length;
  
    /* Convert to an array of 16-bit big-endian values, forming the dividend */
    dividend = Array(Math.ceil(input.length / 2));
    for (i = 0; i < dividend.length; i+=1) {
      dividend[i] = (input.charCodeAt(i * 2) << 8) | input.charCodeAt(i * 2 + 1);
    }
  
    /**
     * Repeatedly perform a long division. The binary array forms the dividend,
     * the length of the encoding is the divisor. Once computed, the quotient
     * forms the dividend for the next step. We stop when the dividend is zerHashes.
     * All remainders are stored for later use.
     */
    while(dividend.length > 0) {
      quotient = Array();
      x = 0;
      for (i = 0; i < dividend.length; i+=1) {
        x = (x << 16) + dividend[i];
        q = Math.floor(x / divisor);
        x -= q * divisor;
        if (quotient.length > 0 || q > 0) {
          quotient[quotient.length] = q;
        }
      }
      remainders[remainders.length] = x;
      dividend = quotient;
    }
  
    /* Convert the remainders to the output string */
    output = '';
    for (i = remainders.length - 1; i >= 0; i--) {
      output += encoding.charAt(remainders[i]);
    }
  
    /* Append leading zero equivalents */
    full_length = Math.ceil(input.length * 8 / (Math.log(encoding.length) / Math.log(2)));
    for (i = output.length; i < full_length; i+=1) {
      output = encoding[0] + output;
    }
    return output;
  }

  /**
   * Convert a raw string to a base-64 string
   */
  function rstr2b64(input, b64pad) {
    var tab = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
        output = '',
        len = input.length, i, j, triplet;
    b64pad= b64pad || '=';
    for (i = 0; i < len; i += 3) {
      triplet = (input.charCodeAt(i) << 16)
            | (i + 1 < len ? input.charCodeAt(i+1) << 8 : 0)
            | (i + 2 < len ? input.charCodeAt(i+2)      : 0);
      for (j = 0; j < 4; j++) {
        if (i * 8 + j * 6 > input.length * 8) { 
          output += b64pad; 
        } else { 
          output += tab.charAt((triplet >>> 6*(3-j)) & 0x3F); 
        }
       }
    }
    return output;
  }

  Hashes = {
  /**
   * @member Hashes
   * @class Base64
   * @constructor
   */
  Base64 : function () {
    // private properties
    var tab = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
        pad = '=', // default pad according with the RFC standard
        url = false, // URL encoding support @todo
        utf8 = true; // by default enable UTF-8 support encoding

    // public method for encoding
    this.encode = function (input) {
      var i, j, triplet,
          output = '', 
          len = input.length;

      pad = pad || '=';
      input = (utf8) ? utf8Encode(input) : input;

      for (i = 0; i < len; i += 3) {
        triplet = (input.charCodeAt(i) << 16)
              | (i + 1 < len ? input.charCodeAt(i+1) << 8 : 0)
              | (i + 2 < len ? input.charCodeAt(i+2) : 0);
        for (j = 0; j < 4; j++) {
          if (i * 8 + j * 6 > input.length * 8) {
              output += pad;
          } else {
              output += tab.charAt((triplet >>> 6*(3-j)) & 0x3F);
          }
        }
      }
      return output;    
    };

    // public method for decoding
    this.decode = function (input) {
      // var b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      var i, o1, o2, o3, h1, h2, h3, h4, bits, ac,
        dec = '',
        arr = [];
      if (!input) { return input; }

      i = ac = 0;
      input = input.replace(new RegExp('\\'+pad,'gi'),''); // use '='
      //input += '';

      do { // unpack four hexets into three octets using index points in b64
        h1 = tab.indexOf(input.charAt(i+=1));
        h2 = tab.indexOf(input.charAt(i+=1));
        h3 = tab.indexOf(input.charAt(i+=1));
        h4 = tab.indexOf(input.charAt(i+=1));

        bits = h1 << 18 | h2 << 12 | h3 << 6 | h4;

        o1 = bits >> 16 & 0xff;
        o2 = bits >> 8 & 0xff;
        o3 = bits & 0xff;
        ac += 1;

        if (h3 === 64) {
          arr[ac] = String.fromCharCode(o1);
        } else if (h4 === 64) {
          arr[ac] = String.fromCharCode(o1, o2);
        } else {
          arr[ac] = String.fromCharCode(o1, o2, o3);
        }
      } while (i < input.length);

      dec = arr.join('');
      dec = (utf8) ? utf8Decode(dec) : dec;

      return dec;
    };

    // set custom pad string
    this.setPad = function (str) {
        pad = str || pad;
        return this;
    };
    // set custom tab string characters
    this.setTab = function (str) {
        tab = str || tab;
        return this;
    };
    this.setUTF8 = function (bool) {
        if (typeof bool === 'boolean') {
          utf8 = bool;
        }
        return this;
    };
  },

  /**
   * CRC-32 calculation
   * @member Hashes
   * @method CRC32
   * @static
   * @param {String} str Input String
   * @return {String}
   */
  CRC32 : function (str) {
    var crc = 0, x = 0, y = 0, table, i;
    str = utf8Encode(str);
        
    table = '00000000 77073096 EE0E612C 990951BA 076DC419 706AF48F E963A535 9E6495A3 0EDB8832 ' +
            '79DCB8A4 E0D5E91E 97D2D988 09B64C2B 7EB17CBD E7B82D07 90BF1D91 1DB71064 6AB020F2 F3B97148 ' +
            '84BE41DE 1ADAD47D 6DDDE4EB F4D4B551 83D385C7 136C9856 646BA8C0 FD62F97A 8A65C9EC 14015C4F ' +
            '63066CD9 FA0F3D63 8D080DF5 3B6E20C8 4C69105E D56041E4 A2677172 3C03E4D1 4B04D447 D20D85FD ' +
            'A50AB56B 35B5A8FA 42B2986C DBBBC9D6 ACBCF940 32D86CE3 45DF5C75 DCD60DCF ABD13D59 26D930AC ' +
            '51DE003A C8D75180 BFD06116 21B4F4B5 56B3C423 CFBA9599 B8BDA50F 2802B89E 5F058808 C60CD9B2 ' +
            'B10BE924 2F6F7C87 58684C11 C1611DAB B6662D3D 76DC4190 01DB7106 98D220BC EFD5102A 71B18589 ' +
            '06B6B51F 9FBFE4A5 E8B8D433 7807C9A2 0F00F934 9609A88E E10E9818 7F6A0DBB 086D3D2D 91646C97 ' +
            'E6635C01 6B6B51F4 1C6C6162 856530D8 F262004E 6C0695ED 1B01A57B 8208F4C1 F50FC457 65B0D9C6 ' +
            '12B7E950 8BBEB8EA FCB9887C 62DD1DDF 15DA2D49 8CD37CF3 FBD44C65 4DB26158 3AB551CE A3BC0074 ' +
            'D4BB30E2 4ADFA541 3DD895D7 A4D1C46D D3D6F4FB 4369E96A 346ED9FC AD678846 DA60B8D0 44042D73 ' +
            '33031DE5 AA0A4C5F DD0D7CC9 5005713C 270241AA BE0B1010 C90C2086 5768B525 206F85B3 B966D409 ' +
            'CE61E49F 5EDEF90E 29D9C998 B0D09822 C7D7A8B4 59B33D17 2EB40D81 B7BD5C3B C0BA6CAD EDB88320 ' +
            '9ABFB3B6 03B6E20C 74B1D29A EAD54739 9DD277AF 04DB2615 73DC1683 E3630B12 94643B84 0D6D6A3E ' +
            '7A6A5AA8 E40ECF0B 9309FF9D 0A00AE27 7D079EB1 F00F9344 8708A3D2 1E01F268 6906C2FE F762575D ' +
            '806567CB 196C3671 6E6B06E7 FED41B76 89D32BE0 10DA7A5A 67DD4ACC F9B9DF6F 8EBEEFF9 17B7BE43 ' +
            '60B08ED5 D6D6A3E8 A1D1937E 38D8C2C4 4FDFF252 D1BB67F1 A6BC5767 3FB506DD 48B2364B D80D2BDA ' +
            'AF0A1B4C 36034AF6 41047A60 DF60EFC3 A867DF55 316E8EEF 4669BE79 CB61B38C BC66831A 256FD2A0 ' + 
            '5268E236 CC0C7795 BB0B4703 220216B9 5505262F C5BA3BBE B2BD0B28 2BB45A92 5CB36A04 C2D7FFA7 ' +
            'B5D0CF31 2CD99E8B 5BDEAE1D 9B64C2B0 EC63F226 756AA39C 026D930A 9C0906A9 EB0E363F 72076785 ' +
            '05005713 95BF4A82 E2B87A14 7BB12BAE 0CB61B38 92D28E9B E5D5BE0D 7CDCEFB7 0BDBDF21 86D3D2D4 ' +
            'F1D4E242 68DDB3F8 1FDA836E 81BE16CD F6B9265B 6FB077E1 18B74777 88085AE6 FF0F6A70 66063BCA ' +
            '11010B5C 8F659EFF F862AE69 616BFFD3 166CCF45 A00AE278 D70DD2EE 4E048354 3903B3C2 A7672661 ' +
            'D06016F7 4969474D 3E6E77DB AED16A4A D9D65ADC 40DF0B66 37D83BF0 A9BCAE53 DEBB9EC5 47B2CF7F ' +
            '30B5FFE9 BDBDF21C CABAC28A 53B39330 24B4A3A6 BAD03605 CDD70693 54DE5729 23D967BF B3667A2E ' +
            'C4614AB8 5D681B02 2A6F2B94 B40BBE37 C30C8EA1 5A05DF1B 2D02EF8D';

    crc = crc ^ (-1);
    for (i = 0, iTop = str.length; i < iTop; i+=1 ) {
        y = ( crc ^ str.charCodeAt( i ) ) & 0xFF;
        x = '0x' + table.substr( y * 9, 8 );
        crc = ( crc >>> 8 ) ^ x;
    }
    return crc ^ (-1);
  },
  /**
   * @member Hashes
   * @class MD5
   * @constructor
   * @param {Object} [config]
   * 
   * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
   * Digest Algorithm, as defined in RFC 1321.
   * Version 2.2 Copyright (C) Paul Johnston 1999 - 2009
   * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
   * See <http://pajhome.org.uk/crypt/md5> for more infHashes.
   */
  MD5 : function (options) {  
    /**
     * Private config properties. You may need to tweak these to be compatible with
     * the server-side, but the defaults work in most cases.
     * See {@link Hashes.MD5#method-setUpperCase} and {@link Hashes.SHA1#method-setUpperCase}
     */
    var hexcase = (options && typeof options.uppercase === 'boolean') ? options.uppercase : false, // hexadecimal output case format. false - lowercase; true - uppercase
        b64pad = (options && typeof options.pad === 'string') ? options.pda : '=', // base-64 pad character. Defaults to '=' for strict RFC compliance
        utf8 = (options && typeof options.utf8 === 'boolean') ? options.utf8 : true; // enable/disable utf8 encoding

    // privileged (public) methods 
    this.hex = function (s) { 
      return rstr2hex(rstr(s, utf8), hexcase);
    };
    this.b64 = function (s) { 
      return rstr2b64(rstr(s), b64pad);
    };
    this.any = function(s, e) { 
      return rstr2any(rstr(s, utf8), e); 
    };
    this.hex_hmac = function (k, d) { 
      return rstr2hex(rstr_hmac(k, d), hexcase); 
    };
    this.b64_hmac = function (k, d) { 
      return rstr2b64(rstr_hmac(k,d), b64pad); 
    };
    this.any_hmac = function (k, d, e) { 
      return rstr2any(rstr_hmac(k, d), e); 
    };
    /**
     * Perform a simple self-test to see if the VM is working
     * @return {String} Hexadecimal hash sample
     */
    this.vm_test = function () {
      return hex('abc').toLowerCase() === '900150983cd24fb0d6963f7d28e17f72';
    };
    /** 
     * Enable/disable uppercase hexadecimal returned string 
     * @param {Boolean} 
     * @return {Object} this
     */ 
    this.setUpperCase = function (a) {
      if (typeof a === 'boolean' ) {
        hexcase = a;
      }
      return this;
    };
    /** 
     * Defines a base64 pad string 
     * @param {String} Pad
     * @return {Object} this
     */ 
    this.setPad = function (a) {
      b64pad = a || b64pad;
      return this;
    };
    /** 
     * Defines a base64 pad string 
     * @param {Boolean} 
     * @return {Object} [this]
     */ 
    this.setUTF8 = function (a) {
      if (typeof a === 'boolean') { 
        utf8 = a;
      }
      return this;
    };

    // private methods

    /**
     * Calculate the MD5 of a raw string
     */
    function rstr(s) {
      s = (utf8) ? utf8Encode(s): s;
      return binl2rstr(binl(rstr2binl(s), s.length * 8));
    }
    
    /**
     * Calculate the HMAC-MD5, of a key and some data (raw strings)
     */
    function rstr_hmac(key, data) {
      var bkey, ipad, hash, i;

      key = (utf8) ? utf8Encode(key) : key;
      data = (utf8) ? utf8Encode(data) : data;
      bkey = rstr2binl(key);
      if (bkey.length > 16) { 
        bkey = binl(bkey, key.length * 8); 
      }

      ipad = Array(16), opad = Array(16); 
      for (i = 0; i < 16; i+=1) {
          ipad[i] = bkey[i] ^ 0x36363636;
          opad[i] = bkey[i] ^ 0x5C5C5C5C;
      }
      hash = binl(ipad.concat(rstr2binl(data)), 512 + data.length * 8);
      return binl2rstr(binl(opad.concat(hash), 512 + 128));
    }

    /**
     * Calculate the MD5 of an array of little-endian words, and a bit length.
     */
    function binl(x, len) {
      var i, olda, oldb, oldc, oldd,
          a =  1732584193,
          b = -271733879,
          c = -1732584194,
          d =  271733878;
        
      /* append padding */
      x[len >> 5] |= 0x80 << ((len) % 32);
      x[(((len + 64) >>> 9) << 4) + 14] = len;

      for (i = 0; i < x.length; i += 16) {
        olda = a;
        oldb = b;
        oldc = c;
        oldd = d;

        a = md5_ff(a, b, c, d, x[i+ 0], 7 , -680876936);
        d = md5_ff(d, a, b, c, x[i+ 1], 12, -389564586);
        c = md5_ff(c, d, a, b, x[i+ 2], 17,  606105819);
        b = md5_ff(b, c, d, a, x[i+ 3], 22, -1044525330);
        a = md5_ff(a, b, c, d, x[i+ 4], 7 , -176418897);
        d = md5_ff(d, a, b, c, x[i+ 5], 12,  1200080426);
        c = md5_ff(c, d, a, b, x[i+ 6], 17, -1473231341);
        b = md5_ff(b, c, d, a, x[i+ 7], 22, -45705983);
        a = md5_ff(a, b, c, d, x[i+ 8], 7 ,  1770035416);
        d = md5_ff(d, a, b, c, x[i+ 9], 12, -1958414417);
        c = md5_ff(c, d, a, b, x[i+10], 17, -42063);
        b = md5_ff(b, c, d, a, x[i+11], 22, -1990404162);
        a = md5_ff(a, b, c, d, x[i+12], 7 ,  1804603682);
        d = md5_ff(d, a, b, c, x[i+13], 12, -40341101);
        c = md5_ff(c, d, a, b, x[i+14], 17, -1502002290);
        b = md5_ff(b, c, d, a, x[i+15], 22,  1236535329);

        a = md5_gg(a, b, c, d, x[i+ 1], 5 , -165796510);
        d = md5_gg(d, a, b, c, x[i+ 6], 9 , -1069501632);
        c = md5_gg(c, d, a, b, x[i+11], 14,  643717713);
        b = md5_gg(b, c, d, a, x[i+ 0], 20, -373897302);
        a = md5_gg(a, b, c, d, x[i+ 5], 5 , -701558691);
        d = md5_gg(d, a, b, c, x[i+10], 9 ,  38016083);
        c = md5_gg(c, d, a, b, x[i+15], 14, -660478335);
        b = md5_gg(b, c, d, a, x[i+ 4], 20, -405537848);
        a = md5_gg(a, b, c, d, x[i+ 9], 5 ,  568446438);
        d = md5_gg(d, a, b, c, x[i+14], 9 , -1019803690);
        c = md5_gg(c, d, a, b, x[i+ 3], 14, -187363961);
        b = md5_gg(b, c, d, a, x[i+ 8], 20,  1163531501);
        a = md5_gg(a, b, c, d, x[i+13], 5 , -1444681467);
        d = md5_gg(d, a, b, c, x[i+ 2], 9 , -51403784);
        c = md5_gg(c, d, a, b, x[i+ 7], 14,  1735328473);
        b = md5_gg(b, c, d, a, x[i+12], 20, -1926607734);

        a = md5_hh(a, b, c, d, x[i+ 5], 4 , -378558);
        d = md5_hh(d, a, b, c, x[i+ 8], 11, -2022574463);
        c = md5_hh(c, d, a, b, x[i+11], 16,  1839030562);
        b = md5_hh(b, c, d, a, x[i+14], 23, -35309556);
        a = md5_hh(a, b, c, d, x[i+ 1], 4 , -1530992060);
        d = md5_hh(d, a, b, c, x[i+ 4], 11,  1272893353);
        c = md5_hh(c, d, a, b, x[i+ 7], 16, -155497632);
        b = md5_hh(b, c, d, a, x[i+10], 23, -1094730640);
        a = md5_hh(a, b, c, d, x[i+13], 4 ,  681279174);
        d = md5_hh(d, a, b, c, x[i+ 0], 11, -358537222);
        c = md5_hh(c, d, a, b, x[i+ 3], 16, -722521979);
        b = md5_hh(b, c, d, a, x[i+ 6], 23,  76029189);
        a = md5_hh(a, b, c, d, x[i+ 9], 4 , -640364487);
        d = md5_hh(d, a, b, c, x[i+12], 11, -421815835);
        c = md5_hh(c, d, a, b, x[i+15], 16,  530742520);
        b = md5_hh(b, c, d, a, x[i+ 2], 23, -995338651);

        a = md5_ii(a, b, c, d, x[i+ 0], 6 , -198630844);
        d = md5_ii(d, a, b, c, x[i+ 7], 10,  1126891415);
        c = md5_ii(c, d, a, b, x[i+14], 15, -1416354905);
        b = md5_ii(b, c, d, a, x[i+ 5], 21, -57434055);
        a = md5_ii(a, b, c, d, x[i+12], 6 ,  1700485571);
        d = md5_ii(d, a, b, c, x[i+ 3], 10, -1894986606);
        c = md5_ii(c, d, a, b, x[i+10], 15, -1051523);
        b = md5_ii(b, c, d, a, x[i+ 1], 21, -2054922799);
        a = md5_ii(a, b, c, d, x[i+ 8], 6 ,  1873313359);
        d = md5_ii(d, a, b, c, x[i+15], 10, -30611744);
        c = md5_ii(c, d, a, b, x[i+ 6], 15, -1560198380);
        b = md5_ii(b, c, d, a, x[i+13], 21,  1309151649);
        a = md5_ii(a, b, c, d, x[i+ 4], 6 , -145523070);
        d = md5_ii(d, a, b, c, x[i+11], 10, -1120210379);
        c = md5_ii(c, d, a, b, x[i+ 2], 15,  718787259);
        b = md5_ii(b, c, d, a, x[i+ 9], 21, -343485551);

        a = safe_add(a, olda);
        b = safe_add(b, oldb);
        c = safe_add(c, oldc);
        d = safe_add(d, oldd);
      }
      return Array(a, b, c, d);
    }

    /**
     * These functions implement the four basic operations the algorithm uses.
     */
    function md5_cmn(q, a, b, x, s, t) {
      return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s),b);
    }
    function md5_ff(a, b, c, d, x, s, t) {
      return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
    }
    function md5_gg(a, b, c, d, x, s, t) {
      return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
    }
    function md5_hh(a, b, c, d, x, s, t) {
      return md5_cmn(b ^ c ^ d, a, b, x, s, t);
    }
    function md5_ii(a, b, c, d, x, s, t) {
      return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
    }
  },
  /**
   * @member Hashes
   * @class Hashes.SHA1
   * @param {Object} [config]
   * @constructor
   * 
   * A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined in FIPS 180-1
   * Version 2.2 Copyright Paul Johnston 2000 - 2009.
   * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
   * See http://pajhome.org.uk/crypt/md5 for details.
   */
  SHA1 : function (options) {
   /**
     * Private config properties. You may need to tweak these to be compatible with
     * the server-side, but the defaults work in most cases.
     * See {@link Hashes.MD5#method-setUpperCase} and {@link Hashes.SHA1#method-setUpperCase}
     */
    var hexcase = (options && typeof options.uppercase === 'boolean') ? options.uppercase : false, // hexadecimal output case format. false - lowercase; true - uppercase
        b64pad = (options && typeof options.pad === 'string') ? options.pda : '=', // base-64 pad character. Defaults to '=' for strict RFC compliance
        utf8 = (options && typeof options.utf8 === 'boolean') ? options.utf8 : true; // enable/disable utf8 encoding

    // public methods
    this.hex = function (s) { 
    	return rstr2hex(rstr(s, utf8), hexcase); 
    };
    this.b64 = function (s) { 
    	return rstr2b64(rstr(s, utf8), b64pad);
    };
    this.any = function (s, e) { 
    	return rstr2any(rstr(s, utf8), e);
    };
    this.hex_hmac = function (k, d) {
    	return rstr2hex(rstr_hmac(k, d));
    };
    this.b64_hmac = function (k, d) { 
    	return rstr2b64(rstr_hmac(k, d), b64pad); 
    };
    this.any_hmac = function (k, d, e) { 
    	return rstr2any(rstr_hmac(k, d), e);
    };
    /**
     * Perform a simple self-test to see if the VM is working
     * @return {String} Hexadecimal hash sample
     * @public
     */
    this.vm_test = function () {
      return hex('abc').toLowerCase() === '900150983cd24fb0d6963f7d28e17f72';
    };
    /** 
     * @description Enable/disable uppercase hexadecimal returned string 
     * @param {boolean} 
     * @return {Object} this
     * @public
     */ 
    this.setUpperCase = function (a) {
    	if (typeof a === 'boolean') {
        hexcase = a;
      }
    	return this;
    };
    /** 
     * @description Defines a base64 pad string 
     * @param {string} Pad
     * @return {Object} this
     * @public
     */ 
    this.setPad = function (a) {
      b64pad = a || b64pad;
    	return this;
    };
    /** 
     * @description Defines a base64 pad string 
     * @param {boolean} 
     * @return {Object} this
     * @public
     */ 
    this.setUTF8 = function (a) {
    	if (typeof a === 'boolean') {
        utf8 = a;
      }
    	return this;
    };

    // private methods

    /**
  	 * Calculate the SHA-512 of a raw string
  	 */
  	function rstr(s) {
      s = (utf8) ? utf8Encode(s) : s;
      return binb2rstr(binb(rstr2binb(s), s.length * 8));
  	}

    /**
     * Calculate the HMAC-SHA1 of a key and some data (raw strings)
     */
    function rstr_hmac(key, data) {
      var bkey, ipad, i, hash;
    	key = (utf8) ? utf8Encode(key) : key;
    	data = (utf8) ? utf8Encode(data) : data;
    	bkey = rstr2binb(key);

    	if (bkey.length > 16) {
        bkey = binb(bkey, key.length * 8);
      }
    	ipad = Array(16), opad = Array(16);
    	for (i = 0; i < 16; i+=1) {
    		ipad[i] = bkey[i] ^ 0x36363636;
    		opad[i] = bkey[i] ^ 0x5C5C5C5C;
    	}
    	hash = binb(ipad.concat(rstr2binb(data)), 512 + data.length * 8);
    	return binb2rstr(binb(opad.concat(hash), 512 + 160));
    }

    /**
     * Calculate the SHA-1 of an array of big-endian words, and a bit length
     */
    function binb(x, len) {
      var i, j, t, olda, oldb, oldc, oldd, olde,
          w = Array(80),
          a =  1732584193,
          b = -271733879,
          c = -1732584194,
          d =  271733878,
          e = -1009589776;

      /* append padding */
      x[len >> 5] |= 0x80 << (24 - len % 32);
      x[((len + 64 >> 9) << 4) + 15] = len;

      for (i = 0; i < x.length; i += 16) {
        olda = a,
        oldb = b;
        oldc = c;
        oldd = d;
        olde = e;
      
      	for (j = 0; j < 80; j++)	{
      	  if (j < 16) { 
            w[j] = x[i + j]; 
          } else { 
            w[j] = bit_rol(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1); 
          }
      	  t = safe_add(safe_add(bit_rol(a, 5), sha1_ft(j, b, c, d)),
      					   safe_add(safe_add(e, w[j]), sha1_kt(j)));
      	  e = d;
      	  d = c;
      	  c = bit_rol(b, 30);
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

    /**
     * Perform the appropriate triplet combination function for the current
     * iteration
     */
    function sha1_ft(t, b, c, d) {
      if (t < 20) { return (b & c) | ((~b) & d); }
      if (t < 40) { return b ^ c ^ d; }
      if (t < 60) { return (b & c) | (b & d) | (c & d); }
      return b ^ c ^ d;
    }

    /**
     * Determine the appropriate additive constant for the current iteration
     */
    function sha1_kt(t) {
      return (t < 20) ?  1518500249 : (t < 40) ?  1859775393 :
    		 (t < 60) ? -1894007588 : -899497514;
    }
  },
  /**
   * @class Hashes.SHA256
   * @param {config}
   * 
   * A JavaScript implementation of the Secure Hash Algorithm, SHA-256, as defined in FIPS 180-2
   * Version 2.2 Copyright Angel Marin, Paul Johnston 2000 - 2009.
   * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
   * See http://pajhome.org.uk/crypt/md5 for details.
   * Also http://anmar.eu.org/projects/jssha2/
   */
  SHA256 : function (options) {
    /**
     * Private properties configuration variables. You may need to tweak these to be compatible with
     * the server-side, but the defaults work in most cases.
     * @see this.setUpperCase() method
     * @see this.setPad() method
     */
    var hexcase = (options && typeof options.uppercase === 'boolean') ? options.uppercase : false, // hexadecimal output case format. false - lowercase; true - uppercase  */
              b64pad = (options && typeof options.pad === 'string') ? options.pda : '=', /* base-64 pad character. Default '=' for strict RFC compliance   */
              utf8 = (options && typeof options.utf8 === 'boolean') ? options.utf8 : true, /* enable/disable utf8 encoding */
              sha256_K;

    /* privileged (public) methods */
    this.hex = function (s) { 
      return rstr2hex(rstr(s, utf8)); 
    };
    this.b64 = function (s) { 
      return rstr2b64(rstr(s, utf8), b64pad);
    };
    this.any = function (s, e) { 
      return rstr2any(rstr(s, utf8), e); 
    };
    this.hex_hmac = function (k, d) { 
      return rstr2hex(rstr_hmac(k, d)); 
    };
    this.b64_hmac = function (k, d) { 
      return rstr2b64(rstr_hmac(k, d), b64pad);
    };
    this.any_hmac = function (k, d, e) { 
      return rstr2any(rstr_hmac(k, d), e); 
    };
    /**
     * Perform a simple self-test to see if the VM is working
     * @return {String} Hexadecimal hash sample
     * @public
     */
    this.vm_test = function () {
      return hex('abc').toLowerCase() === '900150983cd24fb0d6963f7d28e17f72';
    };
    /** 
     * Enable/disable uppercase hexadecimal returned string 
     * @param {boolean} 
     * @return {Object} this
     * @public
     */ 
    this.setUpperCase = function (a) {
      if (typeof a === 'boolean') { 
        hexcase = a;
      }
      return this;
    };
    /** 
     * @description Defines a base64 pad string 
     * @param {string} Pad
     * @return {Object} this
     * @public
     */ 
    this.setPad = function (a) {
      b64pad = a || b64pad;
      return this;
    };
    /** 
     * Defines a base64 pad string 
     * @param {boolean} 
     * @return {Object} this
     * @public
     */ 
    this.setUTF8 = function (a) {
      if (typeof a === 'boolean') {
        utf8 = a;
      }
      return this;
    };
    
    // private methods

    /**
     * Calculate the SHA-512 of a raw string
     */
    function rstr(s, utf8) {
      s = (utf8) ? utf8Encode(s) : s;
      return binb2rstr(binb(rstr2binb(s), s.length * 8));
    }

    /**
     * Calculate the HMAC-sha256 of a key and some data (raw strings)
     */
    function rstr_hmac(key, data) {
      key = (utf8) ? utf8Encode(key) : key;
      data = (utf8) ? utf8Encode(data) : data;
      var hash, i = 0,
          bkey = rstr2binb(key), 
          ipad = Array(16), 
          opad = Array(16);

      if (bkey.length > 16) { bkey = binb(bkey, key.length * 8); }
      
      for (; i < 16; i+=1) {
        ipad[i] = bkey[i] ^ 0x36363636;
        opad[i] = bkey[i] ^ 0x5C5C5C5C;
      }
      
      hash = binb(ipad.concat(rstr2binb(data)), 512 + data.length * 8);
      return binb2rstr(binb(opad.concat(hash), 512 + 256));
    }
    
    /*
     * Main sha256 function, with its support functions
     */
    function sha256_S (X, n) {return ( X >>> n ) | (X << (32 - n));}
    function sha256_R (X, n) {return ( X >>> n );}
    function sha256_Ch(x, y, z) {return ((x & y) ^ ((~x) & z));}
    function sha256_Maj(x, y, z) {return ((x & y) ^ (x & z) ^ (y & z));}
    function sha256_Sigma0256(x) {return (sha256_S(x, 2) ^ sha256_S(x, 13) ^ sha256_S(x, 22));}
    function sha256_Sigma1256(x) {return (sha256_S(x, 6) ^ sha256_S(x, 11) ^ sha256_S(x, 25));}
    function sha256_Gamma0256(x) {return (sha256_S(x, 7) ^ sha256_S(x, 18) ^ sha256_R(x, 3));}
    function sha256_Gamma1256(x) {return (sha256_S(x, 17) ^ sha256_S(x, 19) ^ sha256_R(x, 10));}
    function sha256_Sigma0512(x) {return (sha256_S(x, 28) ^ sha256_S(x, 34) ^ sha256_S(x, 39));}
    function sha256_Sigma1512(x) {return (sha256_S(x, 14) ^ sha256_S(x, 18) ^ sha256_S(x, 41));}
    function sha256_Gamma0512(x) {return (sha256_S(x, 1)  ^ sha256_S(x, 8) ^ sha256_R(x, 7));}
    function sha256_Gamma1512(x) {return (sha256_S(x, 19) ^ sha256_S(x, 61) ^ sha256_R(x, 6));}
    
    sha256_K = new Array
    (
      1116352408, 1899447441, -1245643825, -373957723, 961987163, 1508970993,
      -1841331548, -1424204075, -670586216, 310598401, 607225278, 1426881987,
      1925078388, -2132889090, -1680079193, -1046744716, -459576895, -272742522,
      264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986,
      -1740746414, -1473132947, -1341970488, -1084653625, -958395405, -710438585,
      113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291,
      1695183700, 1986661051, -2117940946, -1838011259, -1564481375, -1474664885,
      -1035236496, -949202525, -778901479, -694614492, -200395387, 275423344,
      430227734, 506948616, 659060556, 883997877, 958139571, 1322822218,
      1537002063, 1747873779, 1955562222, 2024104815, -2067236844, -1933114872,
      -1866530822, -1538233109, -1090935817, -965641998
    );
    
    function binb(m, l) {
      var HASH = new Array(1779033703, -1150833019, 1013904242, -1521486534,
                 1359893119, -1694144372, 528734635, 1541459225);
      var W = new Array(64);
      var a, b, c, d, e, f, g, h;
      var i, j, T1, T2;
    
      /* append padding */
      m[l >> 5] |= 0x80 << (24 - l % 32);
      m[((l + 64 >> 9) << 4) + 15] = l;
    
      for (i = 0; i < m.length; i += 16)
      {
      a = HASH[0];
      b = HASH[1];
      c = HASH[2];
      d = HASH[3];
      e = HASH[4];
      f = HASH[5];
      g = HASH[6];
      h = HASH[7];
    
      for (j = 0; j < 64; j++)
      {
        if (j < 16) { 
          W[j] = m[j + i];
        } else { 
          W[j] = safe_add(safe_add(safe_add(sha256_Gamma1256(W[j - 2]), W[j - 7]),
                          sha256_Gamma0256(W[j - 15])), W[j - 16]);
        }
    
        T1 = safe_add(safe_add(safe_add(safe_add(h, sha256_Sigma1256(e)), sha256_Ch(e, f, g)),
                                  sha256_K[j]), W[j]);
        T2 = safe_add(sha256_Sigma0256(a), sha256_Maj(a, b, c));
        h = g;
        g = f;
        f = e;
        e = safe_add(d, T1);
        d = c;
        c = b;
        b = a;
        a = safe_add(T1, T2);
      }
    
      HASH[0] = safe_add(a, HASH[0]);
      HASH[1] = safe_add(b, HASH[1]);
      HASH[2] = safe_add(c, HASH[2]);
      HASH[3] = safe_add(d, HASH[3]);
      HASH[4] = safe_add(e, HASH[4]);
      HASH[5] = safe_add(f, HASH[5]);
      HASH[6] = safe_add(g, HASH[6]);
      HASH[7] = safe_add(h, HASH[7]);
      }
      return HASH;
    }

  },

  /**
   * @class Hashes.SHA512
   * @param {config}
   * 
   * A JavaScript implementation of the Secure Hash Algorithm, SHA-512, as defined in FIPS 180-2
   * Version 2.2 Copyright Anonymous Contributor, Paul Johnston 2000 - 2009.
   * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
   * See http://pajhome.org.uk/crypt/md5 for details. 
   */
  SHA512 : function (options) {
    /**
     * Private properties configuration variables. You may need to tweak these to be compatible with
     * the server-side, but the defaults work in most cases.
     * @see this.setUpperCase() method
     * @see this.setPad() method
     */
    var hexcase = (options && typeof options.uppercase === 'boolean') ? options.uppercase : false , /* hexadecimal output case format. false - lowercase; true - uppercase  */
        b64pad = (options && typeof options.pad === 'string') ? options.pda : '=',  /* base-64 pad character. Default '=' for strict RFC compliance   */
        utf8 = (options && typeof options.utf8 === 'boolean') ? options.utf8 : true, /* enable/disable utf8 encoding */
        sha512_k;

    /* privileged (public) methods */
    this.hex = function (s) { 
      return rstr2hex(rstr(s)); 
    };
    this.b64 = function (s) { 
      return rstr2b64(rstr(s), b64pad);  
    };
    this.any = function (s, e) { 
      return rstr2any(rstr(s), e);
    };
    this.hex_hmac = function (k, d) {
      return rstr2hex(rstr_hmac(k, d));
    };
    this.b64_hmac = function (k, d) { 
      return rstr2b64(rstr_hmac(k, d), b64pad);
    };
    this.any_hmac = function (k, d, e) { 
      return rstr2any(rstr_hmac(k, d), e);
    };
    /**
     * Perform a simple self-test to see if the VM is working
     * @return {String} Hexadecimal hash sample
     * @public
     */
    this.vm_test = function () {
      return hex('abc').toLowerCase() === '900150983cd24fb0d6963f7d28e17f72';
    };
    /** 
     * @description Enable/disable uppercase hexadecimal returned string 
     * @param {boolean} 
     * @return {Object} this
     * @public
     */ 
    this.setUpperCase = function (a) {
      if (typeof a === 'boolean') {
        hexcase = a;
      }
      return this;
    };
    /** 
     * @description Defines a base64 pad string 
     * @param {string} Pad
     * @return {Object} this
     * @public
     */ 
    this.setPad = function (a) {
      b64pad = a || b64pad;
      return this;
    };
    /** 
     * @description Defines a base64 pad string 
     * @param {boolean} 
     * @return {Object} this
     * @public
     */ 
    this.setUTF8 = function (a) {
      if (typeof a === 'boolean') {
        utf8 = a;
      }
      return this;
    };

    /* private methods */
    
    /**
     * Calculate the SHA-512 of a raw string
     */
    function rstr(s) {
      s = (utf8) ? utf8Encode(s) : s;
      return binb2rstr(binb(rstr2binb(s), s.length * 8));
    }
    /*
     * Calculate the HMAC-SHA-512 of a key and some data (raw strings)
     */
    function rstr_hmac(key, data) {
      key = (utf8) ? utf8Encode(key) : key;
      data = (utf8) ? utf8Encode(data) : data;
      
      var hash, i = 0, 
          bkey = rstr2binb(key),
          ipad = Array(32), opad = Array(32);

      if (bkey.length > 32) { bkey = binb(bkey, key.length * 8); }
      
      for (; i < 32; i+=1) {
        ipad[i] = bkey[i] ^ 0x36363636;
        opad[i] = bkey[i] ^ 0x5C5C5C5C;
      }
      
      hash = binb(ipad.concat(rstr2binb(data)), 1024 + data.length * 8);
      return binb2rstr(binb(opad.concat(hash), 1024 + 512));
    }
            
    /**
     * Calculate the SHA-512 of an array of big-endian dwords, and a bit length
     */
    function binb(x, len) {
      var j, i, 
          W = new Array(80);
          hash = new Array(16),
          //Initial hash values
          H = new Array(
            new int64(0x6a09e667, -205731576),
            new int64(-1150833019, -2067093701),
            new int64(0x3c6ef372, -23791573),
            new int64(-1521486534, 0x5f1d36f1),
            new int64(0x510e527f, -1377402159),
            new int64(-1694144372, 0x2b3e6c1f),
            new int64(0x1f83d9ab, -79577749),
            new int64(0x5be0cd19, 0x137e2179)
          ),
          T1 = new int64(0, 0),
          T2 = new int64(0, 0),
          a = new int64(0,0),
          b = new int64(0,0),
          c = new int64(0,0),
          d = new int64(0,0),
          e = new int64(0,0),
          f = new int64(0,0),
          g = new int64(0,0),
          h = new int64(0,0),
          //Temporary variables not specified by the document
          s0 = new int64(0, 0),
          s1 = new int64(0, 0),
          Ch = new int64(0, 0),
          Maj = new int64(0, 0),
          r1 = new int64(0, 0),
          r2 = new int64(0, 0),
          r3 = new int64(0, 0);

      if (sha512_k === undefined) {
          //SHA512 constants
          sha512_k = new Array(
            new int64(0x428a2f98, -685199838), new int64(0x71374491, 0x23ef65cd),
            new int64(-1245643825, -330482897), new int64(-373957723, -2121671748),
            new int64(0x3956c25b, -213338824), new int64(0x59f111f1, -1241133031),
            new int64(-1841331548, -1357295717), new int64(-1424204075, -630357736),
            new int64(-670586216, -1560083902), new int64(0x12835b01, 0x45706fbe),
            new int64(0x243185be, 0x4ee4b28c), new int64(0x550c7dc3, -704662302),
            new int64(0x72be5d74, -226784913), new int64(-2132889090, 0x3b1696b1),
            new int64(-1680079193, 0x25c71235), new int64(-1046744716, -815192428),
            new int64(-459576895, -1628353838), new int64(-272742522, 0x384f25e3),
            new int64(0xfc19dc6, -1953704523), new int64(0x240ca1cc, 0x77ac9c65),
            new int64(0x2de92c6f, 0x592b0275), new int64(0x4a7484aa, 0x6ea6e483),
            new int64(0x5cb0a9dc, -1119749164), new int64(0x76f988da, -2096016459),
            new int64(-1740746414, -295247957), new int64(-1473132947, 0x2db43210),
            new int64(-1341970488, -1728372417), new int64(-1084653625, -1091629340),
            new int64(-958395405, 0x3da88fc2), new int64(-710438585, -1828018395),
            new int64(0x6ca6351, -536640913), new int64(0x14292967, 0xa0e6e70),
            new int64(0x27b70a85, 0x46d22ffc), new int64(0x2e1b2138, 0x5c26c926),
            new int64(0x4d2c6dfc, 0x5ac42aed), new int64(0x53380d13, -1651133473),
            new int64(0x650a7354, -1951439906), new int64(0x766a0abb, 0x3c77b2a8),
            new int64(-2117940946, 0x47edaee6), new int64(-1838011259, 0x1482353b),
            new int64(-1564481375, 0x4cf10364), new int64(-1474664885, -1136513023),
            new int64(-1035236496, -789014639), new int64(-949202525, 0x654be30),
            new int64(-778901479, -688958952), new int64(-694614492, 0x5565a910),
            new int64(-200395387, 0x5771202a), new int64(0x106aa070, 0x32bbd1b8),
            new int64(0x19a4c116, -1194143544), new int64(0x1e376c08, 0x5141ab53),
            new int64(0x2748774c, -544281703), new int64(0x34b0bcb5, -509917016),
            new int64(0x391c0cb3, -976659869), new int64(0x4ed8aa4a, -482243893),
            new int64(0x5b9cca4f, 0x7763e373), new int64(0x682e6ff3, -692930397),
            new int64(0x748f82ee, 0x5defb2fc), new int64(0x78a5636f, 0x43172f60),
            new int64(-2067236844, -1578062990), new int64(-1933114872, 0x1a6439ec),
            new int64(-1866530822, 0x23631e28), new int64(-1538233109, -561857047),
            new int64(-1090935817, -1295615723), new int64(-965641998, -479046869),
            new int64(-903397682, -366583396), new int64(-779700025, 0x21c0c207),
            new int64(-354779690, -840897762), new int64(-176337025, -294727304),
            new int64(0x6f067aa, 0x72176fba), new int64(0xa637dc5, -1563912026),
            new int64(0x113f9804, -1090974290), new int64(0x1b710b35, 0x131c471b),
            new int64(0x28db77f5, 0x23047d84), new int64(0x32caab7b, 0x40c72493),
            new int64(0x3c9ebe0a, 0x15c9bebc), new int64(0x431d67c4, -1676669620),
            new int64(0x4cc5d4be, -885112138), new int64(0x597f299c, -60457430),
            new int64(0x5fcb6fab, 0x3ad6faec), new int64(0x6c44198c, 0x4a475817)
          );
      }
  
      for (i=0; i<80; i+=1) {
        W[i] = new int64(0, 0);
      }
    
      // append padding to the source string. The format is described in the FIPS.
      x[len >> 5] |= 0x80 << (24 - (len & 0x1f));
      x[((len + 128 >> 10)<< 5) + 31] = len;
    
      for (i = 0; i<x.length; i+=32) { //32 dwords is the block size
        int64copy(a, H[0]);
        int64copy(b, H[1]);
        int64copy(c, H[2]);
        int64copy(d, H[3]);
        int64copy(e, H[4]);
        int64copy(f, H[5]);
        int64copy(g, H[6]);
        int64copy(h, H[7]);
      
        for (j=0; j<16; j++) {
          W[j].h = x[i + 2*j];
          W[j].l = x[i + 2*j + 1];
        }
      
        for (j=16; j<80; j++) {
          //sigma1
          int64rrot(r1, W[j-2], 19);
          int64revrrot(r2, W[j-2], 29);
          int64shr(r3, W[j-2], 6);
          s1.l = r1.l ^ r2.l ^ r3.l;
          s1.h = r1.h ^ r2.h ^ r3.h;
          //sigma0
          int64rrot(r1, W[j-15], 1);
          int64rrot(r2, W[j-15], 8);
          int64shr(r3, W[j-15], 7);
          s0.l = r1.l ^ r2.l ^ r3.l;
          s0.h = r1.h ^ r2.h ^ r3.h;
      
          int64add4(W[j], s1, W[j-7], s0, W[j-16]);
        }
      
        for (j = 0; j < 80; j++) {
          //Ch
          Ch.l = (e.l & f.l) ^ (~e.l & g.l);
          Ch.h = (e.h & f.h) ^ (~e.h & g.h);
      
          //Sigma1
          int64rrot(r1, e, 14);
          int64rrot(r2, e, 18);
          int64revrrot(r3, e, 9);
          s1.l = r1.l ^ r2.l ^ r3.l;
          s1.h = r1.h ^ r2.h ^ r3.h;
      
          //Sigma0
          int64rrot(r1, a, 28);
          int64revrrot(r2, a, 2);
          int64revrrot(r3, a, 7);
          s0.l = r1.l ^ r2.l ^ r3.l;
          s0.h = r1.h ^ r2.h ^ r3.h;
      
          //Maj
          Maj.l = (a.l & b.l) ^ (a.l & c.l) ^ (b.l & c.l);
          Maj.h = (a.h & b.h) ^ (a.h & c.h) ^ (b.h & c.h);
      
          int64add5(T1, h, s1, Ch, sha512_k[j], W[j]);
          int64add(T2, s0, Maj);
      
          int64copy(h, g);
          int64copy(g, f);
          int64copy(f, e);
          int64add(e, d, T1);
          int64copy(d, c);
          int64copy(c, b);
          int64copy(b, a);
          int64add(a, T1, T2);
        }
        int64add(H[0], H[0], a);
        int64add(H[1], H[1], b);
        int64add(H[2], H[2], c);
        int64add(H[3], H[3], d);
        int64add(H[4], H[4], e);
        int64add(H[5], H[5], f);
        int64add(H[6], H[6], g);
        int64add(H[7], H[7], h);
      }
    
      //represent the hash as an array of 32-bit dwords
      for (i=0; i<8; i+=1) {
        hash[2*i] = H[i].h;
        hash[2*i + 1] = H[i].l;
      }
      return hash;
    }
    
    //A constructor for 64-bit numbers
    function int64(h, l) {
      this.h = h;
      this.l = l;
      //this.toString = int64toString;
    }
    
    //Copies src into dst, assuming both are 64-bit numbers
    function int64copy(dst, src) {
      dst.h = src.h;
      dst.l = src.l;
    }
    
    //Right-rotates a 64-bit number by shift
    //Won't handle cases of shift>=32
    //The function revrrot() is for that
    function int64rrot(dst, x, shift) {
      dst.l = (x.l >>> shift) | (x.h << (32-shift));
      dst.h = (x.h >>> shift) | (x.l << (32-shift));
    }
    
    //Reverses the dwords of the source and then rotates right by shift.
    //This is equivalent to rotation by 32+shift
    function int64revrrot(dst, x, shift) {
      dst.l = (x.h >>> shift) | (x.l << (32-shift));
      dst.h = (x.l >>> shift) | (x.h << (32-shift));
    }
    
    //Bitwise-shifts right a 64-bit number by shift
    //Won't handle shift>=32, but it's never needed in SHA512
    function int64shr(dst, x, shift) {
      dst.l = (x.l >>> shift) | (x.h << (32-shift));
      dst.h = (x.h >>> shift);
    }
    
    //Adds two 64-bit numbers
    //Like the original implementation, does not rely on 32-bit operations
    function int64add(dst, x, y) {
       var w0 = (x.l & 0xffff) + (y.l & 0xffff);
       var w1 = (x.l >>> 16) + (y.l >>> 16) + (w0 >>> 16);
       var w2 = (x.h & 0xffff) + (y.h & 0xffff) + (w1 >>> 16);
       var w3 = (x.h >>> 16) + (y.h >>> 16) + (w2 >>> 16);
       dst.l = (w0 & 0xffff) | (w1 << 16);
       dst.h = (w2 & 0xffff) | (w3 << 16);
    }
    
    //Same, except with 4 addends. Works faster than adding them one by one.
    function int64add4(dst, a, b, c, d) {
       var w0 = (a.l & 0xffff) + (b.l & 0xffff) + (c.l & 0xffff) + (d.l & 0xffff);
       var w1 = (a.l >>> 16) + (b.l >>> 16) + (c.l >>> 16) + (d.l >>> 16) + (w0 >>> 16);
       var w2 = (a.h & 0xffff) + (b.h & 0xffff) + (c.h & 0xffff) + (d.h & 0xffff) + (w1 >>> 16);
       var w3 = (a.h >>> 16) + (b.h >>> 16) + (c.h >>> 16) + (d.h >>> 16) + (w2 >>> 16);
       dst.l = (w0 & 0xffff) | (w1 << 16);
       dst.h = (w2 & 0xffff) | (w3 << 16);
    }
    
    //Same, except with 5 addends
    function int64add5(dst, a, b, c, d, e) {
      var w0 = (a.l & 0xffff) + (b.l & 0xffff) + (c.l & 0xffff) + (d.l & 0xffff) + (e.l & 0xffff),
          w1 = (a.l >>> 16) + (b.l >>> 16) + (c.l >>> 16) + (d.l >>> 16) + (e.l >>> 16) + (w0 >>> 16),
          w2 = (a.h & 0xffff) + (b.h & 0xffff) + (c.h & 0xffff) + (d.h & 0xffff) + (e.h & 0xffff) + (w1 >>> 16),
          w3 = (a.h >>> 16) + (b.h >>> 16) + (c.h >>> 16) + (d.h >>> 16) + (e.h >>> 16) + (w2 >>> 16);
       dst.l = (w0 & 0xffff) | (w1 << 16);
       dst.h = (w2 & 0xffff) | (w3 << 16);
    }
  },
  /**
   * @class Hashes.RMD160
   * @constructor
   * @param {Object} [config]
   * 
   * A JavaScript implementation of the RIPEMD-160 Algorithm
   * Version 2.2 Copyright Jeremy Lin, Paul Johnston 2000 - 2009.
   * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
   * See http://pajhome.org.uk/crypt/md5 for details.
   * Also http://www.ocf.berkeley.edu/~jjlin/jsotp/
   */
  RMD160 : function (options) {
    /**
     * Private properties configuration variables. You may need to tweak these to be compatible with
     * the server-side, but the defaults work in most cases.
     * @see this.setUpperCase() method
     * @see this.setPad() method
     */
    var hexcase = (options && typeof options.uppercase === 'boolean') ? options.uppercase : false,   /* hexadecimal output case format. false - lowercase; true - uppercase  */
        b64pad = (options && typeof options.pad === 'string') ? options.pda : '=',  /* base-64 pad character. Default '=' for strict RFC compliance   */
        utf8 = (options && typeof options.utf8 === 'boolean') ? options.utf8 : true, /* enable/disable utf8 encoding */
        rmd160_r1 = [
           0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15,
           7,  4, 13,  1, 10,  6, 15,  3, 12,  0,  9,  5,  2, 14, 11,  8,
           3, 10, 14,  4,  9, 15,  8,  1,  2,  7,  0,  6, 13, 11,  5, 12,
           1,  9, 11, 10,  0,  8, 12,  4, 13,  3,  7, 15, 14,  5,  6,  2,
           4,  0,  5,  9,  7, 12,  2, 10, 14,  1,  3,  8, 11,  6, 15, 13
        ],
        rmd160_r2 = [
           5, 14,  7,  0,  9,  2, 11,  4, 13,  6, 15,  8,  1, 10,  3, 12,
           6, 11,  3,  7,  0, 13,  5, 10, 14, 15,  8, 12,  4,  9,  1,  2,
          15,  5,  1,  3,  7, 14,  6,  9, 11,  8, 12,  2, 10,  0,  4, 13,
           8,  6,  4,  1,  3, 11, 15,  0,  5, 12,  2, 13,  9,  7, 10, 14,
          12, 15, 10,  4,  1,  5,  8,  7,  6,  2, 13, 14,  0,  3,  9, 11
        ],
        rmd160_s1 = [
          11, 14, 15, 12,  5,  8,  7,  9, 11, 13, 14, 15,  6,  7,  9,  8,
           7,  6,  8, 13, 11,  9,  7, 15,  7, 12, 15,  9, 11,  7, 13, 12,
          11, 13,  6,  7, 14,  9, 13, 15, 14,  8, 13,  6,  5, 12,  7,  5,
          11, 12, 14, 15, 14, 15,  9,  8,  9, 14,  5,  6,  8,  6,  5, 12,
           9, 15,  5, 11,  6,  8, 13, 12,  5, 12, 13, 14, 11,  8,  5,  6
        ],
        rmd160_s2 = [
           8,  9,  9, 11, 13, 15, 15,  5,  7,  7,  8, 11, 14, 14, 12,  6,
           9, 13, 15,  7, 12,  8,  9, 11,  7,  7, 12,  7,  6, 15, 13, 11,
           9,  7, 15, 11,  8,  6,  6, 14, 12, 13,  5, 14, 13, 13,  7,  5,
          15,  5,  8, 11, 14, 14,  6, 14,  6,  9, 12,  9, 12,  5, 15,  8,
           8,  5, 12,  9, 12,  5, 14,  6,  8, 13,  6,  5, 15, 13, 11, 11
        ];

    /* privileged (public) methods */
    this.hex = function (s) {
      return rstr2hex(rstr(s, utf8)); 
    };
    this.b64 = function (s) {
      return rstr2b64(rstr(s, utf8), b64pad);
    };
    this.any = function (s, e) { 
      return rstr2any(rstr(s, utf8), e);
    };
    this.hex_hmac = function (k, d) { 
      return rstr2hex(rstr_hmac(k, d));
    };
    this.b64_hmac = function (k, d) { 
      return rstr2b64(rstr_hmac(k, d), b64pad);
    };
    this.any_hmac = function (k, d, e) { 
      return rstr2any(rstr_hmac(k, d), e); 
    };
    /**
     * Perform a simple self-test to see if the VM is working
     * @return {String} Hexadecimal hash sample
     * @public
     */
    this.vm_test = function () {
      return hex('abc').toLowerCase() === '900150983cd24fb0d6963f7d28e17f72';
    };
    /** 
     * @description Enable/disable uppercase hexadecimal returned string 
     * @param {boolean} 
     * @return {Object} this
     * @public
     */ 
    this.setUpperCase = function (a) {
      if (typeof a === 'boolean' ) { hexcase = a; }
      return this;
    };
    /** 
     * @description Defines a base64 pad string 
     * @param {string} Pad
     * @return {Object} this
     * @public
     */ 
    this.setPad = function (a) {
      if (typeof a !== 'undefined' ) { b64pad = a; }
      return this;
    };
    /** 
     * @description Defines a base64 pad string 
     * @param {boolean} 
     * @return {Object} this
     * @public
     */ 
    this.setUTF8 = function (a) {
      if (typeof a === 'boolean') { utf8 = a; }
      return this;
    };

    /* private methods */

    /**
     * Calculate the rmd160 of a raw string
     */
    function rstr(s) {
      s = (utf8) ? utf8Encode(s) : s;
      return binl2rstr(binl(rstr2binl(s), s.length * 8));
    }

    /**
     * Calculate the HMAC-rmd160 of a key and some data (raw strings)
     */
    function rstr_hmac(key, data) {
      key = (utf8) ? utf8Encode(key) : key;
      data = (utf8) ? utf8Encode(data) : data;
      var i, hash,
          bkey = rstr2binl(key),
          ipad = Array(16), opad = Array(16);

      if (bkey.length > 16) { 
        bkey = binl(bkey, key.length * 8); 
      }
      
      for (i = 0; i < 16; i+=1) {
        ipad[i] = bkey[i] ^ 0x36363636;
        opad[i] = bkey[i] ^ 0x5C5C5C5C;
      }
      hash = binl(ipad.concat(rstr2binl(data)), 512 + data.length * 8);
      return binl2rstr(binl(opad.concat(hash), 512 + 160));
    }

    /**
     * Convert an array of little-endian words to a string
     */
    function binl2rstr(input) {
      var output = '', i = 0;
      for (; i < input.length * 32; i += 8) {
        output += String.fromCharCode((input[i>>5] >>> (i % 32)) & 0xFF);
      }
      return output;
    }

    /**
     * Calculate the RIPE-MD160 of an array of little-endian words, and a bit length.
     */
    function binl(x, len) {
      var T, j, i,
          h0 = 0x67452301,
          h1 = 0xefcdab89,
          h2 = 0x98badcfe,
          h3 = 0x10325476,
          h4 = 0xc3d2e1f0,
          A1 = h0, B1 = h1, C1 = h2, D1 = h3, E1 = h4,
          A2 = h0, B2 = h1, C2 = h2, D2 = h3, E2 = h4;

      /* append padding */
      x[len >> 5] |= 0x80 << (len % 32);
      x[(((len + 64) >>> 9) << 4) + 14] = len;

      for (i = 0; i < x.length; i += 16) {
        for (j = 0; j <= 79; ++j) {
          T = safe_add(A1, rmd160_f(j, B1, C1, D1));
          T = safe_add(T, x[i + rmd160_r1[j]]);
          T = safe_add(T, rmd160_K1(j));
          T = safe_add(bit_rol(T, rmd160_s1[j]), E1);
          A1 = E1; E1 = D1; D1 = bit_rol(C1, 10); C1 = B1; B1 = T;
          T = safe_add(A2, rmd160_f(79-j, B2, C2, D2));
          T = safe_add(T, x[i + rmd160_r2[j]]);
          T = safe_add(T, rmd160_K2(j));
          T = safe_add(bit_rol(T, rmd160_s2[j]), E2);
          A2 = E2; E2 = D2; D2 = bit_rol(C2, 10); C2 = B2; B2 = T;
        }

        T = safe_add(h1, safe_add(C1, D2));
        h1 = safe_add(h2, safe_add(D1, E2));
        h2 = safe_add(h3, safe_add(E1, A2));
        h3 = safe_add(h4, safe_add(A1, B2));
        h4 = safe_add(h0, safe_add(B1, C2));
        h0 = T;
      }
      return [h0, h1, h2, h3, h4];
    }

    // specific algorithm methods 
    function rmd160_f(j, x, y, z) {
      return ( 0 <= j && j <= 15) ? (x ^ y ^ z) :
         (16 <= j && j <= 31) ? (x & y) | (~x & z) :
         (32 <= j && j <= 47) ? (x | ~y) ^ z :
         (48 <= j && j <= 63) ? (x & z) | (y & ~z) :
         (64 <= j && j <= 79) ? x ^ (y | ~z) :
         'rmd160_f: j out of range';
    }

    function rmd160_K1(j) {
      return ( 0 <= j && j <= 15) ? 0x00000000 :
         (16 <= j && j <= 31) ? 0x5a827999 :
         (32 <= j && j <= 47) ? 0x6ed9eba1 :
         (48 <= j && j <= 63) ? 0x8f1bbcdc :
         (64 <= j && j <= 79) ? 0xa953fd4e :
         'rmd160_K1: j out of range';
    }

    function rmd160_K2(j){
      return ( 0 <= j && j <= 15) ? 0x50a28be6 :
         (16 <= j && j <= 31) ? 0x5c4dd124 :
         (32 <= j && j <= 47) ? 0x6d703ef3 :
         (48 <= j && j <= 63) ? 0x7a6d76e9 :
         (64 <= j && j <= 79) ? 0x00000000 :
         'rmd160_K2: j out of range';
    }
  }
};

  // expose Hashes Object
  (function( window, undefined ) {
    var freeExports = false;
    if (typeof exports === 'object' ) {
      freeExports = exports;
      if (exports && typeof global === 'object' && global && global === global.global ) { window = global; }
    }

    if (typeof define === 'function' && typeof define.amd === 'object' && define.amd) {
      // define as an anonymous module, so, through path mapping, it can be aliased
      define(function () { return Hashes; });
    }
    else if ( freeExports ) {
      // in Node.js or RingoJS v0.8.0+
      if ( typeof module === 'object' && module && module.exports === freeExports ) {
        module.exports = Hashes;
      }
      // in Narwhal or RingoJS v0.7.0-
      else {
        freeExports.Hashes = Hashes;
      }
    }
    else {
      // in a browser or Rhino
      window.Hashes = Hashes;
    }
  }( this ));
}()); // IIFE
})(window)
},{}]},{},[1])
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiIiwic291cmNlcyI6WyIvVXNlcnMvdG1jdy9zcmMvb3NtLWF1dGgvcmVxLmpzIiwiL1VzZXJzL3RtY3cvc3JjL29zbS1hdXRoL2luZGV4LmpzIiwiL1VzZXJzL3RtY3cvc3JjL29zbS1hdXRoL25vZGVfbW9kdWxlcy9zdG9yZS9zdG9yZS5qcyIsIi9Vc2Vycy90bWN3L3NyYy9vc20tYXV0aC9ub2RlX21vZHVsZXMvb2hhdXRoL2luZGV4LmpzIiwiL1VzZXJzL3RtY3cvc3JjL29zbS1hdXRoL25vZGVfbW9kdWxlcy9vaGF1dGgvbm9kZV9tb2R1bGVzL2pzaGFzaGVzL2hhc2hlcy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VSb290IjoiZmlsZTovL2xvY2FsaG9zdCIsInNvdXJjZXNDb250ZW50IjpbIndpbmRvdy5vc21BdXRoID0gcmVxdWlyZSgnLi8nKTtcbiIsInZhciBvaGF1dGggPSByZXF1aXJlKCdvaGF1dGgnKSxcbiAgICBzdG9yZSA9IHJlcXVpcmUoJ3N0b3JlJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24obykge1xuXG4gICAgLy8gbyBpcyBmb3Igb3B0aW9ucy4gZm9yIGV4YW1wbGUsXG4gICAgLy9cbiAgICAvLyB7IG9hdXRoX3NlY3JldDogJzlXZkpud1F4RHZ2WWFneDFVdDB0WkJzT1owWkN6QXZPamUzdTFUVjAnLFxuICAgIC8vICAgb2F1dGhfY29uc3VtZXJfa2V5OiBcIldMd1hibTZYRk1HN1dyVm5FOGVuSUY2R3p5ZWZZSU42b1VKU3hHNjVcIixcbiAgICAvLyAgIG9hdXRoX3NpZ25hdHVyZV9tZXRob2Q6IFwiSE1BQy1TSEExXCIgfVxuXG4gICAgby51cmwgPSBvLnVybCB8fCAnaHR0cDovL3d3dy5vcGVuc3RyZWV0bWFwLm9yZyc7XG5cbiAgICB2YXIgb2F1dGggPSB7fTtcblxuICAgIG9hdXRoLmF1dGhlbnRpY2F0ZWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRva2VuKCdvYXV0aF90b2tlbicpICYmIHRva2VuKCdvYXV0aF90b2tlbl9zZWNyZXQnKTtcbiAgICB9O1xuXG4gICAgb2F1dGgubG9nb3V0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRva2VuKCdvYXV0aF90b2tlbicsICcnKTtcbiAgICAgICAgdG9rZW4oJ29hdXRoX3Rva2VuX3NlY3JldCcsICcnKTtcbiAgICAgICAgdG9rZW4oJ29hdXRoX3JlcXVlc3RfdG9rZW5fc2VjcmV0JywgJycpO1xuICAgICAgICByZXR1cm4gb2F1dGg7XG4gICAgfTtcblxuICAgIC8vIFRPRE86IGRldGVjdCBsYWNrIG9mIGNsaWNrIGV2ZW50XG4gICAgb2F1dGguYXV0aGVudGljYXRlID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKG9hdXRoLmF1dGhlbnRpY2F0ZWQoKSkgcmV0dXJuIGNhbGxiYWNrKCk7XG5cbiAgICAgICAgb2F1dGgubG9nb3V0KCk7XG5cbiAgICAgICAgdmFyIHBhcmFtcyA9IHRpbWVub25jZShnZXRBdXRoKG8pKSxcbiAgICAgICAgICAgIHVybCA9IG8udXJsICsgJy9vYXV0aC9yZXF1ZXN0X3Rva2VuJztcblxuICAgICAgICBwYXJhbXMub2F1dGhfc2lnbmF0dXJlID0gb2hhdXRoLnNpZ25hdHVyZShcbiAgICAgICAgICAgIG8ub2F1dGhfc2VjcmV0LCAnJyxcbiAgICAgICAgICAgIG9oYXV0aC5iYXNlU3RyaW5nKCdQT1NUJywgdXJsLCBwYXJhbXMpKTtcblxuICAgICAgICB2YXIgdyA9IDYwMCwgaCA9IDU1MCxcbiAgICAgICAgICAgIHNldHRpbmdzID0gW1xuICAgICAgICAgICAgICAgIFsnd2lkdGgnLCB3XSwgWydoZWlnaHQnLCBoXSxcbiAgICAgICAgICAgICAgICBbJ2xlZnQnLCBzY3JlZW4ud2lkdGggLyAyIC0gdyAvIDJdLFxuICAgICAgICAgICAgICAgIFsndG9wJywgc2NyZWVuLmhlaWdodCAvIDIgLSBoIC8gMl1dLm1hcChmdW5jdGlvbih4KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB4LmpvaW4oJz0nKTtcbiAgICAgICAgICAgICAgICB9KS5qb2luKCcsJyksXG4gICAgICAgICAgICBwb3B1cCA9IHdpbmRvdy5vcGVuKCdhYm91dDpibGFuaycsICdvYXV0aF93aW5kb3cnLCBzZXR0aW5ncyk7XG5cbiAgICAgICAgb2hhdXRoLnhocignUE9TVCcsIHVybCwgcGFyYW1zLCBudWxsLCB7fSwgcmVxVG9rZW5Eb25lKTtcblxuICAgICAgICBmdW5jdGlvbiByZXFUb2tlbkRvbmUoZXJyLCB4aHIpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB2YXIgcmVzcCA9IG9oYXV0aC5zdHJpbmdRcyh4aHIucmVzcG9uc2UpO1xuICAgICAgICAgICAgdG9rZW4oJ29hdXRoX3JlcXVlc3RfdG9rZW5fc2VjcmV0JywgcmVzcC5vYXV0aF90b2tlbl9zZWNyZXQpO1xuICAgICAgICAgICAgcG9wdXAubG9jYXRpb24gPSBvLnVybCArICcvb2F1dGgvYXV0aG9yaXplPycgKyBvaGF1dGgucXNTdHJpbmcoe1xuICAgICAgICAgICAgICAgIG9hdXRoX3Rva2VuOiByZXNwLm9hdXRoX3Rva2VuLFxuICAgICAgICAgICAgICAgIG9hdXRoX2NhbGxiYWNrOiBsb2NhdGlvbi5ocmVmLnJlcGxhY2UoJ2luZGV4Lmh0bWwnLCAnJylcbiAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoLyMuKy8sICcnKSArICdsYW5kLmh0bWwnXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENhbGxlZCBieSBhIGZ1bmN0aW9uIGluIGBsYW5kLmh0bWxgLCBpbiB0aGUgcG9wdXAgd2luZG93LiBUaGVcbiAgICAgICAgLy8gd2luZG93IGNsb3NlcyBpdHNlbGYuXG4gICAgICAgIHdpbmRvdy5hdXRoQ29tcGxldGUgPSBmdW5jdGlvbih0b2tlbikge1xuICAgICAgICAgICAgdmFyIG9hdXRoX3Rva2VuID0gb2hhdXRoLnN0cmluZ1FzKHRva2VuLnNwbGl0KCc/JylbMV0pO1xuICAgICAgICAgICAgZ2V0X2FjY2Vzc190b2tlbihvYXV0aF90b2tlbi5vYXV0aF90b2tlbik7XG4gICAgICAgICAgICBkZWxldGUgd2luZG93LmF1dGhDb21wbGV0ZTtcbiAgICAgICAgfTtcblxuICAgICAgICBmdW5jdGlvbiBnZXRfYWNjZXNzX3Rva2VuKG9hdXRoX3Rva2VuKSB7XG4gICAgICAgICAgICB2YXIgdXJsID0gby51cmwgKyAnL29hdXRoL2FjY2Vzc190b2tlbicsXG4gICAgICAgICAgICAgICAgcGFyYW1zID0gdGltZW5vbmNlKGdldEF1dGgobykpLFxuICAgICAgICAgICAgICAgIHJlcXVlc3RfdG9rZW5fc2VjcmV0ID0gdG9rZW4oJ29hdXRoX3JlcXVlc3RfdG9rZW5fc2VjcmV0Jyk7XG4gICAgICAgICAgICBwYXJhbXMub2F1dGhfdG9rZW4gPSBvYXV0aF90b2tlbjtcbiAgICAgICAgICAgIHBhcmFtcy5vYXV0aF9zaWduYXR1cmUgPSBvaGF1dGguc2lnbmF0dXJlKFxuICAgICAgICAgICAgICAgIG8ub2F1dGhfc2VjcmV0LFxuICAgICAgICAgICAgICAgIHJlcXVlc3RfdG9rZW5fc2VjcmV0LFxuICAgICAgICAgICAgICAgIG9oYXV0aC5iYXNlU3RyaW5nKCdQT1NUJywgdXJsLCBwYXJhbXMpKTtcbiAgICAgICAgICAgIG9oYXV0aC54aHIoJ1BPU1QnLCB1cmwsIHBhcmFtcywgbnVsbCwge30sIGFjY2Vzc1Rva2VuRG9uZSk7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBhY2Nlc3NUb2tlbkRvbmUoZXJyLCB4aHIpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICB2YXIgYWNjZXNzX3Rva2VuID0gb2hhdXRoLnN0cmluZ1FzKHhoci5yZXNwb25zZSk7XG4gICAgICAgICAgICB0b2tlbignb2F1dGhfdG9rZW4nLCBhY2Nlc3NfdG9rZW4ub2F1dGhfdG9rZW4pO1xuICAgICAgICAgICAgdG9rZW4oJ29hdXRoX3Rva2VuX3NlY3JldCcsIGFjY2Vzc190b2tlbi5vYXV0aF90b2tlbl9zZWNyZXQpO1xuICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBvYXV0aC54aHIgPSBmdW5jdGlvbihvcHRpb25zLCBjYWxsYmFjaykge1xuICAgICAgICBpZiAoIXRva2VuKCdvYXV0aF90b2tlbicpKSB7XG4gICAgICAgICAgICBpZiAoby5hdXRvKSByZXR1cm4gb2F1dGguYXV0aGVudGljYXRlKHJ1bik7XG4gICAgICAgICAgICBlbHNlIHJldHVybiBjYWxsYmFjaygnbm90IGF1dGhlbnRpY2F0ZWQnLCBudWxsKTtcbiAgICAgICAgfSBlbHNlIHJldHVybiBydW4oKTtcblxuICAgICAgICBmdW5jdGlvbiBydW4oKSB7XG4gICAgICAgICAgICB2YXIgcGFyYW1zID0gdGltZW5vbmNlKGdldEF1dGgobykpLFxuICAgICAgICAgICAgICAgIHVybCA9IG8udXJsICsgb3B0aW9ucy5wYXRoLFxuICAgICAgICAgICAgICAgIG9hdXRoX3Rva2VuX3NlY3JldCA9IHRva2VuKCdvYXV0aF90b2tlbl9zZWNyZXQnKTtcblxuICAgICAgICAgICAgcGFyYW1zLm9hdXRoX3Rva2VuID0gdG9rZW4oJ29hdXRoX3Rva2VuJyk7XG4gICAgICAgICAgICBwYXJhbXMub2F1dGhfc2lnbmF0dXJlID0gb2hhdXRoLnNpZ25hdHVyZShcbiAgICAgICAgICAgICAgICBvLm9hdXRoX3NlY3JldCxcbiAgICAgICAgICAgICAgICBvYXV0aF90b2tlbl9zZWNyZXQsXG4gICAgICAgICAgICAgICAgb2hhdXRoLmJhc2VTdHJpbmcob3B0aW9ucy5tZXRob2QsIHVybCwgcGFyYW1zKSk7XG5cbiAgICAgICAgICAgIG9oYXV0aC54aHIob3B0aW9ucy5tZXRob2QsXG4gICAgICAgICAgICAgICAgdXJsLCBwYXJhbXMsIG9wdGlvbnMuY29udGVudCwgb3B0aW9ucy5vcHRpb25zLCBkb25lKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIGRvbmUoZXJyLCB4aHIpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgZWxzZSBpZiAoeGhyLnJlc3BvbnNlWE1MKSByZXR1cm4gY2FsbGJhY2soZXJyLCB4aHIucmVzcG9uc2VYTUwpO1xuICAgICAgICAgICAgZWxzZSByZXR1cm4gY2FsbGJhY2soZXJyLCB4aHIucmVzcG9uc2UpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIHRpbWVub25jZShvKSB7XG4gICAgICAgIG8ub2F1dGhfdGltZXN0YW1wID0gb2hhdXRoLnRpbWVzdGFtcCgpO1xuICAgICAgICBvLm9hdXRoX25vbmNlID0gb2hhdXRoLm5vbmNlKCk7XG4gICAgICAgIHJldHVybiBvO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRva2VuKHgsIHkpIHtcbiAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHJldHVybiBzdG9yZS5nZXQoby51cmwgKyB4KTtcbiAgICAgICAgZWxzZSBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikgcmV0dXJuIHN0b3JlLnNldChvLnVybCArIHgsIHkpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldEF1dGgobykge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgb2F1dGhfY29uc3VtZXJfa2V5OiBvLm9hdXRoX2NvbnN1bWVyX2tleSxcbiAgICAgICAgICAgIG9hdXRoX3NpZ25hdHVyZV9tZXRob2Q6IFwiSE1BQy1TSEExXCIsXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIG9hdXRoO1xufTtcbiIsIi8qIENvcHlyaWdodCAoYykgMjAxMC0yMDEyIE1hcmN1cyBXZXN0aW5cbiAqXG4gKiBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XG4gKiBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXG4gKiBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXG4gKiB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG4gKiBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcbiAqIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4gKlxuICogVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW5cbiAqIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuICpcbiAqIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1JcbiAqIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLFxuICogRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFXG4gKiBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSXG4gKiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLFxuICogT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTlxuICogVEhFIFNPRlRXQVJFLlxuICovXG5cbjsoZnVuY3Rpb24oKXtcblx0dmFyIHN0b3JlID0ge30sXG5cdFx0d2luID0gd2luZG93LFxuXHRcdGRvYyA9IHdpbi5kb2N1bWVudCxcblx0XHRsb2NhbFN0b3JhZ2VOYW1lID0gJ2xvY2FsU3RvcmFnZScsXG5cdFx0bmFtZXNwYWNlID0gJ19fc3RvcmVqc19fJyxcblx0XHRzdG9yYWdlXG5cblx0c3RvcmUuZGlzYWJsZWQgPSBmYWxzZVxuXHRzdG9yZS5zZXQgPSBmdW5jdGlvbihrZXksIHZhbHVlKSB7fVxuXHRzdG9yZS5nZXQgPSBmdW5jdGlvbihrZXkpIHt9XG5cdHN0b3JlLnJlbW92ZSA9IGZ1bmN0aW9uKGtleSkge31cblx0c3RvcmUuY2xlYXIgPSBmdW5jdGlvbigpIHt9XG5cdHN0b3JlLnRyYW5zYWN0ID0gZnVuY3Rpb24oa2V5LCBkZWZhdWx0VmFsLCB0cmFuc2FjdGlvbkZuKSB7XG5cdFx0dmFyIHZhbCA9IHN0b3JlLmdldChrZXkpXG5cdFx0aWYgKHRyYW5zYWN0aW9uRm4gPT0gbnVsbCkge1xuXHRcdFx0dHJhbnNhY3Rpb25GbiA9IGRlZmF1bHRWYWxcblx0XHRcdGRlZmF1bHRWYWwgPSBudWxsXG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgdmFsID09ICd1bmRlZmluZWQnKSB7IHZhbCA9IGRlZmF1bHRWYWwgfHwge30gfVxuXHRcdHRyYW5zYWN0aW9uRm4odmFsKVxuXHRcdHN0b3JlLnNldChrZXksIHZhbClcblx0fVxuXHRzdG9yZS5nZXRBbGwgPSBmdW5jdGlvbigpIHt9XG5cblx0c3RvcmUuc2VyaWFsaXplID0gZnVuY3Rpb24odmFsdWUpIHtcblx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkodmFsdWUpXG5cdH1cblx0c3RvcmUuZGVzZXJpYWxpemUgPSBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdGlmICh0eXBlb2YgdmFsdWUgIT0gJ3N0cmluZycpIHsgcmV0dXJuIHVuZGVmaW5lZCB9XG5cdFx0dHJ5IHsgcmV0dXJuIEpTT04ucGFyc2UodmFsdWUpIH1cblx0XHRjYXRjaChlKSB7IHJldHVybiB2YWx1ZSB8fCB1bmRlZmluZWQgfVxuXHR9XG5cblx0Ly8gRnVuY3Rpb25zIHRvIGVuY2Fwc3VsYXRlIHF1ZXN0aW9uYWJsZSBGaXJlRm94IDMuNi4xMyBiZWhhdmlvclxuXHQvLyB3aGVuIGFib3V0LmNvbmZpZzo6ZG9tLnN0b3JhZ2UuZW5hYmxlZCA9PT0gZmFsc2Vcblx0Ly8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9tYXJjdXN3ZXN0aW4vc3RvcmUuanMvaXNzdWVzI2lzc3VlLzEzXG5cdGZ1bmN0aW9uIGlzTG9jYWxTdG9yYWdlTmFtZVN1cHBvcnRlZCgpIHtcblx0XHR0cnkgeyByZXR1cm4gKGxvY2FsU3RvcmFnZU5hbWUgaW4gd2luICYmIHdpbltsb2NhbFN0b3JhZ2VOYW1lXSkgfVxuXHRcdGNhdGNoKGVycikgeyByZXR1cm4gZmFsc2UgfVxuXHR9XG5cblx0aWYgKGlzTG9jYWxTdG9yYWdlTmFtZVN1cHBvcnRlZCgpKSB7XG5cdFx0c3RvcmFnZSA9IHdpbltsb2NhbFN0b3JhZ2VOYW1lXVxuXHRcdHN0b3JlLnNldCA9IGZ1bmN0aW9uKGtleSwgdmFsKSB7XG5cdFx0XHRpZiAodmFsID09PSB1bmRlZmluZWQpIHsgcmV0dXJuIHN0b3JlLnJlbW92ZShrZXkpIH1cblx0XHRcdHN0b3JhZ2Uuc2V0SXRlbShrZXksIHN0b3JlLnNlcmlhbGl6ZSh2YWwpKVxuXHRcdFx0cmV0dXJuIHZhbFxuXHRcdH1cblx0XHRzdG9yZS5nZXQgPSBmdW5jdGlvbihrZXkpIHsgcmV0dXJuIHN0b3JlLmRlc2VyaWFsaXplKHN0b3JhZ2UuZ2V0SXRlbShrZXkpKSB9XG5cdFx0c3RvcmUucmVtb3ZlID0gZnVuY3Rpb24oa2V5KSB7IHN0b3JhZ2UucmVtb3ZlSXRlbShrZXkpIH1cblx0XHRzdG9yZS5jbGVhciA9IGZ1bmN0aW9uKCkgeyBzdG9yYWdlLmNsZWFyKCkgfVxuXHRcdHN0b3JlLmdldEFsbCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0dmFyIHJldCA9IHt9XG5cdFx0XHRmb3IgKHZhciBpPTA7IGk8c3RvcmFnZS5sZW5ndGg7ICsraSkge1xuXHRcdFx0XHR2YXIga2V5ID0gc3RvcmFnZS5rZXkoaSlcblx0XHRcdFx0cmV0W2tleV0gPSBzdG9yZS5nZXQoa2V5KVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJldFxuXHRcdH1cblx0fSBlbHNlIGlmIChkb2MuZG9jdW1lbnRFbGVtZW50LmFkZEJlaGF2aW9yKSB7XG5cdFx0dmFyIHN0b3JhZ2VPd25lcixcblx0XHRcdHN0b3JhZ2VDb250YWluZXJcblx0XHQvLyBTaW5jZSAjdXNlckRhdGEgc3RvcmFnZSBhcHBsaWVzIG9ubHkgdG8gc3BlY2lmaWMgcGF0aHMsIHdlIG5lZWQgdG9cblx0XHQvLyBzb21laG93IGxpbmsgb3VyIGRhdGEgdG8gYSBzcGVjaWZpYyBwYXRoLiAgV2UgY2hvb3NlIC9mYXZpY29uLmljb1xuXHRcdC8vIGFzIGEgcHJldHR5IHNhZmUgb3B0aW9uLCBzaW5jZSBhbGwgYnJvd3NlcnMgYWxyZWFkeSBtYWtlIGEgcmVxdWVzdCB0b1xuXHRcdC8vIHRoaXMgVVJMIGFueXdheSBhbmQgYmVpbmcgYSA0MDQgd2lsbCBub3QgaHVydCB1cyBoZXJlLiAgV2Ugd3JhcCBhblxuXHRcdC8vIGlmcmFtZSBwb2ludGluZyB0byB0aGUgZmF2aWNvbiBpbiBhbiBBY3RpdmVYT2JqZWN0KGh0bWxmaWxlKSBvYmplY3Rcblx0XHQvLyAoc2VlOiBodHRwOi8vbXNkbi5taWNyb3NvZnQuY29tL2VuLXVzL2xpYnJhcnkvYWE3NTI1NzQodj1WUy44NSkuYXNweClcblx0XHQvLyBzaW5jZSB0aGUgaWZyYW1lIGFjY2VzcyBydWxlcyBhcHBlYXIgdG8gYWxsb3cgZGlyZWN0IGFjY2VzcyBhbmRcblx0XHQvLyBtYW5pcHVsYXRpb24gb2YgdGhlIGRvY3VtZW50IGVsZW1lbnQsIGV2ZW4gZm9yIGEgNDA0IHBhZ2UuICBUaGlzXG5cdFx0Ly8gZG9jdW1lbnQgY2FuIGJlIHVzZWQgaW5zdGVhZCBvZiB0aGUgY3VycmVudCBkb2N1bWVudCAod2hpY2ggd291bGRcblx0XHQvLyBoYXZlIGJlZW4gbGltaXRlZCB0byB0aGUgY3VycmVudCBwYXRoKSB0byBwZXJmb3JtICN1c2VyRGF0YSBzdG9yYWdlLlxuXHRcdHRyeSB7XG5cdFx0XHRzdG9yYWdlQ29udGFpbmVyID0gbmV3IEFjdGl2ZVhPYmplY3QoJ2h0bWxmaWxlJylcblx0XHRcdHN0b3JhZ2VDb250YWluZXIub3BlbigpXG5cdFx0XHRzdG9yYWdlQ29udGFpbmVyLndyaXRlKCc8cycgKyAnY3JpcHQ+ZG9jdW1lbnQudz13aW5kb3c8L3MnICsgJ2NyaXB0PjxpZnJhbWUgc3JjPVwiL2Zhdmljb24uaWNvXCI+PC9mcmFtZT4nKVxuXHRcdFx0c3RvcmFnZUNvbnRhaW5lci5jbG9zZSgpXG5cdFx0XHRzdG9yYWdlT3duZXIgPSBzdG9yYWdlQ29udGFpbmVyLncuZnJhbWVzWzBdLmRvY3VtZW50XG5cdFx0XHRzdG9yYWdlID0gc3RvcmFnZU93bmVyLmNyZWF0ZUVsZW1lbnQoJ2RpdicpXG5cdFx0fSBjYXRjaChlKSB7XG5cdFx0XHQvLyBzb21laG93IEFjdGl2ZVhPYmplY3QgaW5zdGFudGlhdGlvbiBmYWlsZWQgKHBlcmhhcHMgc29tZSBzcGVjaWFsXG5cdFx0XHQvLyBzZWN1cml0eSBzZXR0aW5ncyBvciBvdGhlcndzZSksIGZhbGwgYmFjayB0byBwZXItcGF0aCBzdG9yYWdlXG5cdFx0XHRzdG9yYWdlID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2RpdicpXG5cdFx0XHRzdG9yYWdlT3duZXIgPSBkb2MuYm9keVxuXHRcdH1cblx0XHRmdW5jdGlvbiB3aXRoSUVTdG9yYWdlKHN0b3JlRnVuY3Rpb24pIHtcblx0XHRcdHJldHVybiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDApXG5cdFx0XHRcdGFyZ3MudW5zaGlmdChzdG9yYWdlKVxuXHRcdFx0XHQvLyBTZWUgaHR0cDovL21zZG4ubWljcm9zb2Z0LmNvbS9lbi11cy9saWJyYXJ5L21zNTMxMDgxKHY9VlMuODUpLmFzcHhcblx0XHRcdFx0Ly8gYW5kIGh0dHA6Ly9tc2RuLm1pY3Jvc29mdC5jb20vZW4tdXMvbGlicmFyeS9tczUzMTQyNCh2PVZTLjg1KS5hc3B4XG5cdFx0XHRcdHN0b3JhZ2VPd25lci5hcHBlbmRDaGlsZChzdG9yYWdlKVxuXHRcdFx0XHRzdG9yYWdlLmFkZEJlaGF2aW9yKCcjZGVmYXVsdCN1c2VyRGF0YScpXG5cdFx0XHRcdHN0b3JhZ2UubG9hZChsb2NhbFN0b3JhZ2VOYW1lKVxuXHRcdFx0XHR2YXIgcmVzdWx0ID0gc3RvcmVGdW5jdGlvbi5hcHBseShzdG9yZSwgYXJncylcblx0XHRcdFx0c3RvcmFnZU93bmVyLnJlbW92ZUNoaWxkKHN0b3JhZ2UpXG5cdFx0XHRcdHJldHVybiByZXN1bHRcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBJbiBJRTcsIGtleXMgbWF5IG5vdCBjb250YWluIHNwZWNpYWwgY2hhcnMuIFNlZSBhbGwgb2YgaHR0cHM6Ly9naXRodWIuY29tL21hcmN1c3dlc3Rpbi9zdG9yZS5qcy9pc3N1ZXMvNDBcblx0XHR2YXIgZm9yYmlkZGVuQ2hhcnNSZWdleCA9IG5ldyBSZWdFeHAoXCJbIVxcXCIjJCUmJygpKissL1xcXFxcXFxcOjs8PT4/QFtcXFxcXV5ge3x9fl1cIiwgXCJnXCIpXG5cdFx0ZnVuY3Rpb24gaWVLZXlGaXgoa2V5KSB7XG5cdFx0XHRyZXR1cm4ga2V5LnJlcGxhY2UoZm9yYmlkZGVuQ2hhcnNSZWdleCwgJ19fXycpXG5cdFx0fVxuXHRcdHN0b3JlLnNldCA9IHdpdGhJRVN0b3JhZ2UoZnVuY3Rpb24oc3RvcmFnZSwga2V5LCB2YWwpIHtcblx0XHRcdGtleSA9IGllS2V5Rml4KGtleSlcblx0XHRcdGlmICh2YWwgPT09IHVuZGVmaW5lZCkgeyByZXR1cm4gc3RvcmUucmVtb3ZlKGtleSkgfVxuXHRcdFx0c3RvcmFnZS5zZXRBdHRyaWJ1dGUoa2V5LCBzdG9yZS5zZXJpYWxpemUodmFsKSlcblx0XHRcdHN0b3JhZ2Uuc2F2ZShsb2NhbFN0b3JhZ2VOYW1lKVxuXHRcdFx0cmV0dXJuIHZhbFxuXHRcdH0pXG5cdFx0c3RvcmUuZ2V0ID0gd2l0aElFU3RvcmFnZShmdW5jdGlvbihzdG9yYWdlLCBrZXkpIHtcblx0XHRcdGtleSA9IGllS2V5Rml4KGtleSlcblx0XHRcdHJldHVybiBzdG9yZS5kZXNlcmlhbGl6ZShzdG9yYWdlLmdldEF0dHJpYnV0ZShrZXkpKVxuXHRcdH0pXG5cdFx0c3RvcmUucmVtb3ZlID0gd2l0aElFU3RvcmFnZShmdW5jdGlvbihzdG9yYWdlLCBrZXkpIHtcblx0XHRcdGtleSA9IGllS2V5Rml4KGtleSlcblx0XHRcdHN0b3JhZ2UucmVtb3ZlQXR0cmlidXRlKGtleSlcblx0XHRcdHN0b3JhZ2Uuc2F2ZShsb2NhbFN0b3JhZ2VOYW1lKVxuXHRcdH0pXG5cdFx0c3RvcmUuY2xlYXIgPSB3aXRoSUVTdG9yYWdlKGZ1bmN0aW9uKHN0b3JhZ2UpIHtcblx0XHRcdHZhciBhdHRyaWJ1dGVzID0gc3RvcmFnZS5YTUxEb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuYXR0cmlidXRlc1xuXHRcdFx0c3RvcmFnZS5sb2FkKGxvY2FsU3RvcmFnZU5hbWUpXG5cdFx0XHRmb3IgKHZhciBpPTAsIGF0dHI7IGF0dHI9YXR0cmlidXRlc1tpXTsgaSsrKSB7XG5cdFx0XHRcdHN0b3JhZ2UucmVtb3ZlQXR0cmlidXRlKGF0dHIubmFtZSlcblx0XHRcdH1cblx0XHRcdHN0b3JhZ2Uuc2F2ZShsb2NhbFN0b3JhZ2VOYW1lKVxuXHRcdH0pXG5cdFx0c3RvcmUuZ2V0QWxsID0gd2l0aElFU3RvcmFnZShmdW5jdGlvbihzdG9yYWdlKSB7XG5cdFx0XHR2YXIgYXR0cmlidXRlcyA9IHN0b3JhZ2UuWE1MRG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmF0dHJpYnV0ZXNcblx0XHRcdHN0b3JhZ2UubG9hZChsb2NhbFN0b3JhZ2VOYW1lKVxuXHRcdFx0dmFyIHJldCA9IHt9XG5cdFx0XHRmb3IgKHZhciBpPTAsIGF0dHI7IGF0dHI9YXR0cmlidXRlc1tpXTsgKytpKSB7XG5cdFx0XHRcdHJldFthdHRyXSA9IHN0b3JlLmdldChhdHRyKVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJldFxuXHRcdH0pXG5cdH1cblxuXHR0cnkge1xuXHRcdHN0b3JlLnNldChuYW1lc3BhY2UsIG5hbWVzcGFjZSlcblx0XHRpZiAoc3RvcmUuZ2V0KG5hbWVzcGFjZSkgIT0gbmFtZXNwYWNlKSB7IHN0b3JlLmRpc2FibGVkID0gdHJ1ZSB9XG5cdFx0c3RvcmUucmVtb3ZlKG5hbWVzcGFjZSlcblx0fSBjYXRjaChlKSB7XG5cdFx0c3RvcmUuZGlzYWJsZWQgPSB0cnVlXG5cdH1cblx0c3RvcmUuZW5hYmxlZCA9ICFzdG9yZS5kaXNhYmxlZFxuXG5cdGlmICh0eXBlb2YgbW9kdWxlICE9ICd1bmRlZmluZWQnICYmIHR5cGVvZiBtb2R1bGUgIT0gJ2Z1bmN0aW9uJykgeyBtb2R1bGUuZXhwb3J0cyA9IHN0b3JlIH1cblx0ZWxzZSBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7IGRlZmluZShzdG9yZSkgfVxuXHRlbHNlIHsgdGhpcy5zdG9yZSA9IHN0b3JlIH1cbn0pKCk7XG4iLCJ2YXIgaGFzaGVzID0gcmVxdWlyZSgnanNoYXNoZXMnKSxcbiAgICBzaGExID0gbmV3IGhhc2hlcy5TSEExKCk7XG5cbnZhciBvaGF1dGggPSB7fTtcblxub2hhdXRoLnFzU3RyaW5nID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKG9iaikuc29ydCgpLm1hcChmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgcmV0dXJuIGVuY29kZVVSSUNvbXBvbmVudChrZXkpICsgJz0nICtcbiAgICAgICAgICAgIGVuY29kZVVSSUNvbXBvbmVudChvYmpba2V5XSk7XG4gICAgfSkuam9pbignJicpO1xufTtcblxub2hhdXRoLnN0cmluZ1FzID0gZnVuY3Rpb24oc3RyKSB7XG4gICAgcmV0dXJuIHN0ci5zcGxpdCgnJicpLnJlZHVjZShmdW5jdGlvbihvYmosIHBhaXIpe1xuICAgICAgICB2YXIgcGFydHMgPSBwYWlyLnNwbGl0KCc9Jyk7XG4gICAgICAgIG9ialtwYXJ0c1swXV0gPSAobnVsbCA9PT0gcGFydHNbMV0pID9cbiAgICAgICAgICAgICcnIDogZGVjb2RlVVJJQ29tcG9uZW50KHBhcnRzWzFdKTtcbiAgICAgICAgcmV0dXJuIG9iajtcbiAgICB9LCB7fSk7XG59O1xuXG5vaGF1dGgucmF3eGhyID0gZnVuY3Rpb24obWV0aG9kLCB1cmwsIGRhdGEsIGhlYWRlcnMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpLCB0d29IdW5kcmVkID0gL14yMFxcZCQvO1xuICAgIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKDQgPT0geGhyLnJlYWR5U3RhdGUgJiYgMCAhPT0geGhyLnN0YXR1cykge1xuICAgICAgICAgICAgaWYgKHR3b0h1bmRyZWQudGVzdCh4aHIuc3RhdHVzKSkgY2FsbGJhY2sobnVsbCwgeGhyKTtcbiAgICAgICAgICAgIGVsc2UgcmV0dXJuIGNhbGxiYWNrKHhociwgbnVsbCk7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIHhoci5vbmVycm9yID0gZnVuY3Rpb24oZSkgeyByZXR1cm4gY2FsbGJhY2soZSwgbnVsbCk7IH07XG4gICAgeGhyLm9wZW4obWV0aG9kLCB1cmwsIHRydWUpO1xuICAgIGZvciAodmFyIGggaW4gaGVhZGVycykgeGhyLnNldFJlcXVlc3RIZWFkZXIoaCwgaGVhZGVyc1toXSk7XG4gICAgeGhyLnNlbmQoZGF0YSk7XG59O1xuXG5vaGF1dGgueGhyID0gZnVuY3Rpb24obWV0aG9kLCB1cmwsIGF1dGgsIGRhdGEsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIGhlYWRlcnMgPSAob3B0aW9ucyAmJiBvcHRpb25zLmhlYWRlcikgfHwge1xuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZCdcbiAgICB9O1xuICAgIGhlYWRlcnMuQXV0aG9yaXphdGlvbiA9ICdPQXV0aCAnICsgb2hhdXRoLmF1dGhIZWFkZXIoYXV0aCk7XG4gICAgb2hhdXRoLnJhd3hocihtZXRob2QsIHVybCwgZGF0YSwgaGVhZGVycywgY2FsbGJhY2spO1xufTtcblxub2hhdXRoLm5vbmNlID0gZnVuY3Rpb24oKSB7XG4gICAgZm9yICh2YXIgbyA9ICcnOyBvLmxlbmd0aCA8IDY7KSB7XG4gICAgICAgIG8gKz0gJzAxMjM0NTY3ODlBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hUWmFiY2RlZmdoaWtsbW5vcHFyc3R1dnd4eXonW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDYxKV07XG4gICAgfVxuICAgIHJldHVybiBvO1xufTtcblxub2hhdXRoLmF1dGhIZWFkZXIgPSBmdW5jdGlvbihvYmopIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXMob2JqKS5zb3J0KCkubWFwKGZ1bmN0aW9uKGtleSkge1xuICAgICAgICByZXR1cm4gZW5jb2RlVVJJQ29tcG9uZW50KGtleSkgKyAnPVwiJyArIGVuY29kZVVSSUNvbXBvbmVudChvYmpba2V5XSkgKyAnXCInO1xuICAgIH0pLmpvaW4oJywgJyk7XG59O1xuXG5vaGF1dGgudGltZXN0YW1wID0gZnVuY3Rpb24oKSB7IHJldHVybiB+figoK25ldyBEYXRlKCkpIC8gMTAwMCk7IH07XG5cbm9oYXV0aC5wZXJjZW50RW5jb2RlID0gZnVuY3Rpb24ocykge1xuICAgIHJldHVybiBlbmNvZGVVUklDb21wb25lbnQocylcbiAgICAgICAgLnJlcGxhY2UoL1xcIS9nLCAnJTIxJykucmVwbGFjZSgvXFwnL2csICclMjcnKVxuICAgICAgICAucmVwbGFjZSgvXFwqL2csICclMkEnKS5yZXBsYWNlKC9cXCgvZywgJyUyOCcpLnJlcGxhY2UoL1xcKS9nLCAnJTI5Jyk7XG59O1xuXG5vaGF1dGguYmFzZVN0cmluZyA9IGZ1bmN0aW9uKG1ldGhvZCwgdXJsLCBwYXJhbXMpIHtcbiAgICBpZiAocGFyYW1zLm9hdXRoX3NpZ25hdHVyZSkgZGVsZXRlIHBhcmFtcy5vYXV0aF9zaWduYXR1cmU7XG4gICAgcmV0dXJuIFtcbiAgICAgICAgbWV0aG9kLFxuICAgICAgICBvaGF1dGgucGVyY2VudEVuY29kZSh1cmwpLFxuICAgICAgICBvaGF1dGgucGVyY2VudEVuY29kZShvaGF1dGgucXNTdHJpbmcocGFyYW1zKSldLmpvaW4oJyYnKTtcbn07XG5cbm9oYXV0aC5zaWduYXR1cmUgPSBmdW5jdGlvbihvYXV0aF9zZWNyZXQsIHRva2VuX3NlY3JldCwgYmFzZVN0cmluZykge1xuICAgIHJldHVybiBzaGExLmI2NF9obWFjKFxuICAgICAgICBvaGF1dGgucGVyY2VudEVuY29kZShvYXV0aF9zZWNyZXQpICsgJyYnICtcbiAgICAgICAgb2hhdXRoLnBlcmNlbnRFbmNvZGUodG9rZW5fc2VjcmV0KSxcbiAgICAgICAgYmFzZVN0cmluZyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG9oYXV0aDtcbiIsIihmdW5jdGlvbihnbG9iYWwpey8qKlxyXG4gKiBqc0hhc2hlcyAtIEEgZmFzdCBhbmQgaW5kZXBlbmRlbnQgaGFzaGluZyBsaWJyYXJ5IHB1cmUgSmF2YVNjcmlwdCBpbXBsZW1lbnRlZCBmb3IgYm90aCBzZXJ2ZXIgYW5kIGNsaWVudCBzaWRlXHJcbiAqIFxyXG4gKiBAY2xhc3MgSGFzaGVzXHJcbiAqIEBhdXRob3IgVG9tYXMgQXBhcmljaW8gPHRvbWFzQHJpam5kYWVsLXByb2plY3QuY29tPlxyXG4gKiBAbGljZW5zZSBOZXcgQlNEIChzZWUgTElDRU5TRSBmaWxlKVxyXG4gKiBAdmVyc2lvbiAxLjAuMSAtIDE3LzAyLzIwMTNcclxuICpcclxuICogQWxnb3JpdGhtcyBzcGVjaWZpY2F0aW9uOlxyXG4gKlxyXG4gKiBNRDUgPGh0dHA6Ly93d3cuaWV0Zi5vcmcvcmZjL3JmYzEzMjEudHh0PlxyXG4gKiBSSVBFTUQtMTYwIDxodHRwOi8vaG9tZXMuZXNhdC5rdWxldXZlbi5iZS9+Ym9zc2VsYWUvcmlwZW1kMTYwLmh0bWw+XHJcbiAqIFNIQTEgPGh0dHA6Ly9ob21lcy5lc2F0Lmt1bGV1dmVuLmJlL35ib3NzZWxhZS9yaXBlbWQxNjAuaHRtbD5cclxuICogU0hBMjU2IDxodHRwOi8vY3NyYy5uaXN0Lmdvdi9wdWJsaWNhdGlvbnMvZmlwcy9maXBzMTgwLTIvZmlwczE4MC0yLnBkZj5cclxuICogU0hBNTEyIDxodHRwOi8vY3NyYy5uaXN0Lmdvdi9wdWJsaWNhdGlvbnMvZmlwcy9maXBzMTgwLTIvZmlwczE4MC0yLnBkZj5cclxuICogSE1BQyA8aHR0cDovL3d3dy5pZXRmLm9yZy9yZmMvcmZjMjEwNC50eHQ+XHJcbiAqXHJcbiAqL1xyXG4oZnVuY3Rpb24oKXtcclxuICB2YXIgSGFzaGVzO1xyXG4gIFxyXG4gIC8vIHByaXZhdGUgaGVscGVyIG1ldGhvZHNcclxuICBmdW5jdGlvbiB1dGY4RW5jb2RlKGlucHV0KSB7XHJcbiAgICB2YXIgb3V0cHV0ID0gJycsIGkgPSAtMSwgeCwgeTtcclxuICAgIHdoaWxlICgrK2kgPCBpbnB1dC5sZW5ndGgpIHtcclxuICAgICAgLyogRGVjb2RlIHV0Zi0xNiBzdXJyb2dhdGUgcGFpcnMgKi9cclxuICAgICAgeCA9IGlucHV0LmNoYXJDb2RlQXQoaSk7XHJcbiAgICAgIHkgPSBpICsgMSA8IGlucHV0Lmxlbmd0aCA/IGlucHV0LmNoYXJDb2RlQXQoaSArIDEpIDogMDtcclxuICAgICAgaWYgKDB4RDgwMCA8PSB4ICYmIHggPD0gMHhEQkZGICYmIDB4REMwMCA8PSB5ICYmIHkgPD0gMHhERkZGKSB7XHJcbiAgICAgICAgICB4ID0gMHgxMDAwMCArICgoeCAmIDB4MDNGRikgPDwgMTApICsgKHkgJiAweDAzRkYpO1xyXG4gICAgICAgICAgaSArPSAxO1xyXG4gICAgICB9XHJcbiAgICAgIC8qIEVuY29kZSBvdXRwdXQgYXMgdXRmLTggKi9cclxuICAgICAgaWYgKHggPD0gMHg3Rikge1xyXG4gICAgICAgICAgb3V0cHV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoeCk7XHJcbiAgICAgIH0gZWxzZSBpZiAoeCA8PSAweDdGRikge1xyXG4gICAgICAgICAgb3V0cHV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoMHhDMCB8ICgoeCA+Pj4gNiApICYgMHgxRiksXHJcbiAgICAgICAgICAgICAgICAgICAgICAweDgwIHwgKCB4ICYgMHgzRikpO1xyXG4gICAgICB9IGVsc2UgaWYgKHggPD0gMHhGRkZGKSB7XHJcbiAgICAgICAgICBvdXRwdXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSgweEUwIHwgKCh4ID4+PiAxMikgJiAweDBGKSxcclxuICAgICAgICAgICAgICAgICAgICAgIDB4ODAgfCAoKHggPj4+IDYgKSAmIDB4M0YpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgMHg4MCB8ICggeCAmIDB4M0YpKTtcclxuICAgICAgfSBlbHNlIGlmICh4IDw9IDB4MUZGRkZGKSB7XHJcbiAgICAgICAgICBvdXRwdXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSgweEYwIHwgKCh4ID4+PiAxOCkgJiAweDA3KSxcclxuICAgICAgICAgICAgICAgICAgICAgIDB4ODAgfCAoKHggPj4+IDEyKSAmIDB4M0YpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgMHg4MCB8ICgoeCA+Pj4gNiApICYgMHgzRiksXHJcbiAgICAgICAgICAgICAgICAgICAgICAweDgwIHwgKCB4ICYgMHgzRikpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gb3V0cHV0O1xyXG4gIH1cclxuICBcclxuICBmdW5jdGlvbiB1dGY4RGVjb2RlKHN0cl9kYXRhKSB7XHJcbiAgICB2YXIgaSwgYWMsIGMxLCBjMiwgYzMsIGFyciA9IFtdO1xyXG4gICAgaSA9IGFjID0gYzEgPSBjMiA9IGMzID0gMDtcclxuICAgIHN0cl9kYXRhICs9ICcnO1xyXG5cclxuICAgIHdoaWxlIChpIDwgc3RyX2RhdGEubGVuZ3RoKSB7XHJcbiAgICAgICAgYzEgPSBzdHJfZGF0YS5jaGFyQ29kZUF0KGkpO1xyXG4gICAgICAgIGFjICs9IDE7XHJcbiAgICAgICAgaWYgKGMxIDwgMTI4KSB7XHJcbiAgICAgICAgICAgIGFyclthY10gPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGMxKTtcclxuICAgICAgICAgICAgaSs9MTtcclxuICAgICAgICB9IGVsc2UgaWYgKGMxID4gMTkxICYmIGMxIDwgMjI0KSB7XHJcbiAgICAgICAgICAgIGMyID0gc3RyX2RhdGEuY2hhckNvZGVBdChpICsgMSk7XHJcbiAgICAgICAgICAgIGFyclthY10gPSBTdHJpbmcuZnJvbUNoYXJDb2RlKCgoYzEgJiAzMSkgPDwgNikgfCAoYzIgJiA2MykpO1xyXG4gICAgICAgICAgICBpICs9IDI7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgYzIgPSBzdHJfZGF0YS5jaGFyQ29kZUF0KGkgKyAxKTtcclxuICAgICAgICAgICAgYzMgPSBzdHJfZGF0YS5jaGFyQ29kZUF0KGkgKyAyKTtcclxuICAgICAgICAgICAgYXJyW2FjXSA9IFN0cmluZy5mcm9tQ2hhckNvZGUoKChjMSAmIDE1KSA8PCAxMikgfCAoKGMyICYgNjMpIDw8IDYpIHwgKGMzICYgNjMpKTtcclxuICAgICAgICAgICAgaSArPSAzO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBhcnIuam9pbignJyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGQgaW50ZWdlcnMsIHdyYXBwaW5nIGF0IDJeMzIuIFRoaXMgdXNlcyAxNi1iaXQgb3BlcmF0aW9ucyBpbnRlcm5hbGx5XHJcbiAgICogdG8gd29yayBhcm91bmQgYnVncyBpbiBzb21lIEpTIGludGVycHJldGVycy5cclxuICAgKi9cclxuICBmdW5jdGlvbiBzYWZlX2FkZCh4LCB5KSB7XHJcbiAgICB2YXIgbHN3ID0gKHggJiAweEZGRkYpICsgKHkgJiAweEZGRkYpLFxyXG4gICAgICAgIG1zdyA9ICh4ID4+IDE2KSArICh5ID4+IDE2KSArIChsc3cgPj4gMTYpO1xyXG4gICAgcmV0dXJuIChtc3cgPDwgMTYpIHwgKGxzdyAmIDB4RkZGRik7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBCaXR3aXNlIHJvdGF0ZSBhIDMyLWJpdCBudW1iZXIgdG8gdGhlIGxlZnQuXHJcbiAgICovXHJcbiAgZnVuY3Rpb24gYml0X3JvbChudW0sIGNudCkge1xyXG4gICAgcmV0dXJuIChudW0gPDwgY250KSB8IChudW0gPj4+ICgzMiAtIGNudCkpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ29udmVydCBhIHJhdyBzdHJpbmcgdG8gYSBoZXggc3RyaW5nXHJcbiAgICovXHJcbiAgZnVuY3Rpb24gcnN0cjJoZXgoaW5wdXQsIGhleGNhc2UpIHtcclxuICAgIHZhciBoZXhfdGFiID0gaGV4Y2FzZSA/ICcwMTIzNDU2Nzg5QUJDREVGJyA6ICcwMTIzNDU2Nzg5YWJjZGVmJyxcclxuICAgICAgICBvdXRwdXQgPSAnJywgeCwgaSA9IDA7XHJcbiAgICBmb3IgKDsgaSA8IGlucHV0Lmxlbmd0aDsgaSs9MSkge1xyXG4gICAgICB4ID0gaW5wdXQuY2hhckNvZGVBdChpKTtcclxuICAgICAgb3V0cHV0ICs9IGhleF90YWIuY2hhckF0KCh4ID4+PiA0KSAmIDB4MEYpICsgaGV4X3RhYi5jaGFyQXQoeCAmIDB4MEYpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG91dHB1dDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEVuY29kZSBhIHN0cmluZyBhcyB1dGYtMTZcclxuICAgKi9cclxuICBmdW5jdGlvbiBzdHIycnN0cl91dGYxNmxlKGlucHV0KSB7XHJcbiAgICB2YXIgaSA9IDAsIG91dHB1dCA9ICcnO1xyXG4gICAgZm9yICg7IGkgPCBpbnB1dC5sZW5ndGg7IGkrPTEpIHtcclxuICAgICAgb3V0cHV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoIGlucHV0LmNoYXJDb2RlQXQoaSkgJiAweEZGLCAoaW5wdXQuY2hhckNvZGVBdChpKSA+Pj4gOCkgJiAweEZGKTtcclxuICAgIH1cclxuICAgIHJldHVybiBvdXRwdXQ7XHJcbiAgfVxyXG5cclxuICBmdW5jdGlvbiBzdHIycnN0cl91dGYxNmJlKGlucHV0KSB7XHJcbiAgICB2YXIgaSA9IDAsIG91dHB1dCA9ICcnO1xyXG4gICAgZm9yICg7IGkgPCBpbnB1dC5sZW5ndGg7IGkrPTEpIHtcclxuICAgICAgb3V0cHV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoKGlucHV0LmNoYXJDb2RlQXQoaSkgPj4+IDgpICYgMHhGRiwgaW5wdXQuY2hhckNvZGVBdChpKSAmIDB4RkYpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG91dHB1dDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENvbnZlcnQgYW4gYXJyYXkgb2YgYmlnLWVuZGlhbiB3b3JkcyB0byBhIHN0cmluZ1xyXG4gICAqL1xyXG4gIGZ1bmN0aW9uIGJpbmIycnN0cihpbnB1dCkge1xyXG4gICAgdmFyIGkgPSAwLCBvdXRwdXQgPSAnJztcclxuICAgIGZvciAoO2kgPCBpbnB1dC5sZW5ndGggKiAzMjsgaSArPSA4KSB7XHJcbiAgICAgICAgb3V0cHV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoKGlucHV0W2k+PjVdID4+PiAoMjQgLSBpICUgMzIpKSAmIDB4RkYpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG91dHB1dDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENvbnZlcnQgYW4gYXJyYXkgb2YgbGl0dGxlLWVuZGlhbiB3b3JkcyB0byBhIHN0cmluZ1xyXG4gICAqL1xyXG4gIGZ1bmN0aW9uIGJpbmwycnN0cihpbnB1dCkge1xyXG4gICAgdmFyIGkgPSAwLCBvdXRwdXQgPSAnJztcclxuICAgIGZvciAoO2kgPCBpbnB1dC5sZW5ndGggKiAzMjsgaSArPSA4KSB7XHJcbiAgICAgIG91dHB1dCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKChpbnB1dFtpPj41XSA+Pj4gKGkgJSAzMikpICYgMHhGRik7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gb3V0cHV0O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ29udmVydCBhIHJhdyBzdHJpbmcgdG8gYW4gYXJyYXkgb2YgbGl0dGxlLWVuZGlhbiB3b3Jkc1xyXG4gICAqIENoYXJhY3RlcnMgPjI1NSBoYXZlIHRoZWlyIGhpZ2gtYnl0ZSBzaWxlbnRseSBpZ25vcmVkLlxyXG4gICAqL1xyXG4gIGZ1bmN0aW9uIHJzdHIyYmlubChpbnB1dCkge1xyXG4gICAgdmFyIGksIG91dHB1dCA9IEFycmF5KGlucHV0Lmxlbmd0aCA+PiAyKTtcclxuICAgIGZvciAoaSA9IDA7IGkgPCBvdXRwdXQubGVuZ3RoOyBpKz0xKSB7XHJcbiAgICAgIG91dHB1dFtpXSA9IDA7XHJcbiAgICB9XHJcbiAgICBmb3IgKGkgPSAwOyBpIDwgaW5wdXQubGVuZ3RoICogODsgaSArPSA4KSB7XHJcbiAgICAgIG91dHB1dFtpPj41XSB8PSAoaW5wdXQuY2hhckNvZGVBdChpIC8gOCkgJiAweEZGKSA8PCAoaSUzMik7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gb3V0cHV0O1xyXG4gIH1cclxuICBcclxuICAvKipcclxuICAgKiBDb252ZXJ0IGEgcmF3IHN0cmluZyB0byBhbiBhcnJheSBvZiBiaWctZW5kaWFuIHdvcmRzIFxyXG4gICAqIENoYXJhY3RlcnMgPjI1NSBoYXZlIHRoZWlyIGhpZ2gtYnl0ZSBzaWxlbnRseSBpZ25vcmVkLlxyXG4gICAqL1xyXG4gICBmdW5jdGlvbiByc3RyMmJpbmIoaW5wdXQpIHtcclxuICAgICAgdmFyIGksIG91dHB1dCA9IEFycmF5KGlucHV0Lmxlbmd0aCA+PiAyKTtcclxuICAgICAgZm9yIChpID0gMDsgaSA8IG91dHB1dC5sZW5ndGg7IGkrPTEpIHtcclxuICAgICAgICAgICAgb3V0cHV0W2ldID0gMDtcclxuICAgICAgICB9XHJcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBpbnB1dC5sZW5ndGggKiA4OyBpICs9IDgpIHtcclxuICAgICAgICAgICAgb3V0cHV0W2k+PjVdIHw9IChpbnB1dC5jaGFyQ29kZUF0KGkgLyA4KSAmIDB4RkYpIDw8ICgyNCAtIGkgJSAzMik7XHJcbiAgICAgICAgfVxyXG4gICAgICByZXR1cm4gb3V0cHV0O1xyXG4gICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENvbnZlcnQgYSByYXcgc3RyaW5nIHRvIGFuIGFyYml0cmFyeSBzdHJpbmcgZW5jb2RpbmdcclxuICAgKi9cclxuICBmdW5jdGlvbiByc3RyMmFueShpbnB1dCwgZW5jb2RpbmcpIHtcclxuICAgIHZhciBkaXZpc29yID0gZW5jb2RpbmcubGVuZ3RoLFxyXG4gICAgICAgIHJlbWFpbmRlcnMgPSBBcnJheSgpLFxyXG4gICAgICAgIGksIHEsIHgsIHF1b3RpZW50LCBkaXZpZGVuZCwgb3V0cHV0LCBmdWxsX2xlbmd0aDtcclxuICBcclxuICAgIC8qIENvbnZlcnQgdG8gYW4gYXJyYXkgb2YgMTYtYml0IGJpZy1lbmRpYW4gdmFsdWVzLCBmb3JtaW5nIHRoZSBkaXZpZGVuZCAqL1xyXG4gICAgZGl2aWRlbmQgPSBBcnJheShNYXRoLmNlaWwoaW5wdXQubGVuZ3RoIC8gMikpO1xyXG4gICAgZm9yIChpID0gMDsgaSA8IGRpdmlkZW5kLmxlbmd0aDsgaSs9MSkge1xyXG4gICAgICBkaXZpZGVuZFtpXSA9IChpbnB1dC5jaGFyQ29kZUF0KGkgKiAyKSA8PCA4KSB8IGlucHV0LmNoYXJDb2RlQXQoaSAqIDIgKyAxKTtcclxuICAgIH1cclxuICBcclxuICAgIC8qKlxyXG4gICAgICogUmVwZWF0ZWRseSBwZXJmb3JtIGEgbG9uZyBkaXZpc2lvbi4gVGhlIGJpbmFyeSBhcnJheSBmb3JtcyB0aGUgZGl2aWRlbmQsXHJcbiAgICAgKiB0aGUgbGVuZ3RoIG9mIHRoZSBlbmNvZGluZyBpcyB0aGUgZGl2aXNvci4gT25jZSBjb21wdXRlZCwgdGhlIHF1b3RpZW50XHJcbiAgICAgKiBmb3JtcyB0aGUgZGl2aWRlbmQgZm9yIHRoZSBuZXh0IHN0ZXAuIFdlIHN0b3Agd2hlbiB0aGUgZGl2aWRlbmQgaXMgemVySGFzaGVzLlxyXG4gICAgICogQWxsIHJlbWFpbmRlcnMgYXJlIHN0b3JlZCBmb3IgbGF0ZXIgdXNlLlxyXG4gICAgICovXHJcbiAgICB3aGlsZShkaXZpZGVuZC5sZW5ndGggPiAwKSB7XHJcbiAgICAgIHF1b3RpZW50ID0gQXJyYXkoKTtcclxuICAgICAgeCA9IDA7XHJcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBkaXZpZGVuZC5sZW5ndGg7IGkrPTEpIHtcclxuICAgICAgICB4ID0gKHggPDwgMTYpICsgZGl2aWRlbmRbaV07XHJcbiAgICAgICAgcSA9IE1hdGguZmxvb3IoeCAvIGRpdmlzb3IpO1xyXG4gICAgICAgIHggLT0gcSAqIGRpdmlzb3I7XHJcbiAgICAgICAgaWYgKHF1b3RpZW50Lmxlbmd0aCA+IDAgfHwgcSA+IDApIHtcclxuICAgICAgICAgIHF1b3RpZW50W3F1b3RpZW50Lmxlbmd0aF0gPSBxO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICByZW1haW5kZXJzW3JlbWFpbmRlcnMubGVuZ3RoXSA9IHg7XHJcbiAgICAgIGRpdmlkZW5kID0gcXVvdGllbnQ7XHJcbiAgICB9XHJcbiAgXHJcbiAgICAvKiBDb252ZXJ0IHRoZSByZW1haW5kZXJzIHRvIHRoZSBvdXRwdXQgc3RyaW5nICovXHJcbiAgICBvdXRwdXQgPSAnJztcclxuICAgIGZvciAoaSA9IHJlbWFpbmRlcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcclxuICAgICAgb3V0cHV0ICs9IGVuY29kaW5nLmNoYXJBdChyZW1haW5kZXJzW2ldKTtcclxuICAgIH1cclxuICBcclxuICAgIC8qIEFwcGVuZCBsZWFkaW5nIHplcm8gZXF1aXZhbGVudHMgKi9cclxuICAgIGZ1bGxfbGVuZ3RoID0gTWF0aC5jZWlsKGlucHV0Lmxlbmd0aCAqIDggLyAoTWF0aC5sb2coZW5jb2RpbmcubGVuZ3RoKSAvIE1hdGgubG9nKDIpKSk7XHJcbiAgICBmb3IgKGkgPSBvdXRwdXQubGVuZ3RoOyBpIDwgZnVsbF9sZW5ndGg7IGkrPTEpIHtcclxuICAgICAgb3V0cHV0ID0gZW5jb2RpbmdbMF0gKyBvdXRwdXQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gb3V0cHV0O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ29udmVydCBhIHJhdyBzdHJpbmcgdG8gYSBiYXNlLTY0IHN0cmluZ1xyXG4gICAqL1xyXG4gIGZ1bmN0aW9uIHJzdHIyYjY0KGlucHV0LCBiNjRwYWQpIHtcclxuICAgIHZhciB0YWIgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLycsXHJcbiAgICAgICAgb3V0cHV0ID0gJycsXHJcbiAgICAgICAgbGVuID0gaW5wdXQubGVuZ3RoLCBpLCBqLCB0cmlwbGV0O1xyXG4gICAgYjY0cGFkPSBiNjRwYWQgfHwgJz0nO1xyXG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSArPSAzKSB7XHJcbiAgICAgIHRyaXBsZXQgPSAoaW5wdXQuY2hhckNvZGVBdChpKSA8PCAxNilcclxuICAgICAgICAgICAgfCAoaSArIDEgPCBsZW4gPyBpbnB1dC5jaGFyQ29kZUF0KGkrMSkgPDwgOCA6IDApXHJcbiAgICAgICAgICAgIHwgKGkgKyAyIDwgbGVuID8gaW5wdXQuY2hhckNvZGVBdChpKzIpICAgICAgOiAwKTtcclxuICAgICAgZm9yIChqID0gMDsgaiA8IDQ7IGorKykge1xyXG4gICAgICAgIGlmIChpICogOCArIGogKiA2ID4gaW5wdXQubGVuZ3RoICogOCkgeyBcclxuICAgICAgICAgIG91dHB1dCArPSBiNjRwYWQ7IFxyXG4gICAgICAgIH0gZWxzZSB7IFxyXG4gICAgICAgICAgb3V0cHV0ICs9IHRhYi5jaGFyQXQoKHRyaXBsZXQgPj4+IDYqKDMtaikpICYgMHgzRik7IFxyXG4gICAgICAgIH1cclxuICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBvdXRwdXQ7XHJcbiAgfVxyXG5cclxuICBIYXNoZXMgPSB7XHJcbiAgLyoqXHJcbiAgICogQG1lbWJlciBIYXNoZXNcclxuICAgKiBAY2xhc3MgQmFzZTY0XHJcbiAgICogQGNvbnN0cnVjdG9yXHJcbiAgICovXHJcbiAgQmFzZTY0IDogZnVuY3Rpb24gKCkge1xyXG4gICAgLy8gcHJpdmF0ZSBwcm9wZXJ0aWVzXHJcbiAgICB2YXIgdGFiID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky8nLFxyXG4gICAgICAgIHBhZCA9ICc9JywgLy8gZGVmYXVsdCBwYWQgYWNjb3JkaW5nIHdpdGggdGhlIFJGQyBzdGFuZGFyZFxyXG4gICAgICAgIHVybCA9IGZhbHNlLCAvLyBVUkwgZW5jb2Rpbmcgc3VwcG9ydCBAdG9kb1xyXG4gICAgICAgIHV0ZjggPSB0cnVlOyAvLyBieSBkZWZhdWx0IGVuYWJsZSBVVEYtOCBzdXBwb3J0IGVuY29kaW5nXHJcblxyXG4gICAgLy8gcHVibGljIG1ldGhvZCBmb3IgZW5jb2RpbmdcclxuICAgIHRoaXMuZW5jb2RlID0gZnVuY3Rpb24gKGlucHV0KSB7XHJcbiAgICAgIHZhciBpLCBqLCB0cmlwbGV0LFxyXG4gICAgICAgICAgb3V0cHV0ID0gJycsIFxyXG4gICAgICAgICAgbGVuID0gaW5wdXQubGVuZ3RoO1xyXG5cclxuICAgICAgcGFkID0gcGFkIHx8ICc9JztcclxuICAgICAgaW5wdXQgPSAodXRmOCkgPyB1dGY4RW5jb2RlKGlucHV0KSA6IGlucHV0O1xyXG5cclxuICAgICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSArPSAzKSB7XHJcbiAgICAgICAgdHJpcGxldCA9IChpbnB1dC5jaGFyQ29kZUF0KGkpIDw8IDE2KVxyXG4gICAgICAgICAgICAgIHwgKGkgKyAxIDwgbGVuID8gaW5wdXQuY2hhckNvZGVBdChpKzEpIDw8IDggOiAwKVxyXG4gICAgICAgICAgICAgIHwgKGkgKyAyIDwgbGVuID8gaW5wdXQuY2hhckNvZGVBdChpKzIpIDogMCk7XHJcbiAgICAgICAgZm9yIChqID0gMDsgaiA8IDQ7IGorKykge1xyXG4gICAgICAgICAgaWYgKGkgKiA4ICsgaiAqIDYgPiBpbnB1dC5sZW5ndGggKiA4KSB7XHJcbiAgICAgICAgICAgICAgb3V0cHV0ICs9IHBhZDtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgb3V0cHV0ICs9IHRhYi5jaGFyQXQoKHRyaXBsZXQgPj4+IDYqKDMtaikpICYgMHgzRik7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBvdXRwdXQ7ICAgIFxyXG4gICAgfTtcclxuXHJcbiAgICAvLyBwdWJsaWMgbWV0aG9kIGZvciBkZWNvZGluZ1xyXG4gICAgdGhpcy5kZWNvZGUgPSBmdW5jdGlvbiAoaW5wdXQpIHtcclxuICAgICAgLy8gdmFyIGI2NCA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvPSc7XHJcbiAgICAgIHZhciBpLCBvMSwgbzIsIG8zLCBoMSwgaDIsIGgzLCBoNCwgYml0cywgYWMsXHJcbiAgICAgICAgZGVjID0gJycsXHJcbiAgICAgICAgYXJyID0gW107XHJcbiAgICAgIGlmICghaW5wdXQpIHsgcmV0dXJuIGlucHV0OyB9XHJcblxyXG4gICAgICBpID0gYWMgPSAwO1xyXG4gICAgICBpbnB1dCA9IGlucHV0LnJlcGxhY2UobmV3IFJlZ0V4cCgnXFxcXCcrcGFkLCdnaScpLCcnKTsgLy8gdXNlICc9J1xyXG4gICAgICAvL2lucHV0ICs9ICcnO1xyXG5cclxuICAgICAgZG8geyAvLyB1bnBhY2sgZm91ciBoZXhldHMgaW50byB0aHJlZSBvY3RldHMgdXNpbmcgaW5kZXggcG9pbnRzIGluIGI2NFxyXG4gICAgICAgIGgxID0gdGFiLmluZGV4T2YoaW5wdXQuY2hhckF0KGkrPTEpKTtcclxuICAgICAgICBoMiA9IHRhYi5pbmRleE9mKGlucHV0LmNoYXJBdChpKz0xKSk7XHJcbiAgICAgICAgaDMgPSB0YWIuaW5kZXhPZihpbnB1dC5jaGFyQXQoaSs9MSkpO1xyXG4gICAgICAgIGg0ID0gdGFiLmluZGV4T2YoaW5wdXQuY2hhckF0KGkrPTEpKTtcclxuXHJcbiAgICAgICAgYml0cyA9IGgxIDw8IDE4IHwgaDIgPDwgMTIgfCBoMyA8PCA2IHwgaDQ7XHJcblxyXG4gICAgICAgIG8xID0gYml0cyA+PiAxNiAmIDB4ZmY7XHJcbiAgICAgICAgbzIgPSBiaXRzID4+IDggJiAweGZmO1xyXG4gICAgICAgIG8zID0gYml0cyAmIDB4ZmY7XHJcbiAgICAgICAgYWMgKz0gMTtcclxuXHJcbiAgICAgICAgaWYgKGgzID09PSA2NCkge1xyXG4gICAgICAgICAgYXJyW2FjXSA9IFN0cmluZy5mcm9tQ2hhckNvZGUobzEpO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoaDQgPT09IDY0KSB7XHJcbiAgICAgICAgICBhcnJbYWNdID0gU3RyaW5nLmZyb21DaGFyQ29kZShvMSwgbzIpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBhcnJbYWNdID0gU3RyaW5nLmZyb21DaGFyQ29kZShvMSwgbzIsIG8zKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gd2hpbGUgKGkgPCBpbnB1dC5sZW5ndGgpO1xyXG5cclxuICAgICAgZGVjID0gYXJyLmpvaW4oJycpO1xyXG4gICAgICBkZWMgPSAodXRmOCkgPyB1dGY4RGVjb2RlKGRlYykgOiBkZWM7XHJcblxyXG4gICAgICByZXR1cm4gZGVjO1xyXG4gICAgfTtcclxuXHJcbiAgICAvLyBzZXQgY3VzdG9tIHBhZCBzdHJpbmdcclxuICAgIHRoaXMuc2V0UGFkID0gZnVuY3Rpb24gKHN0cikge1xyXG4gICAgICAgIHBhZCA9IHN0ciB8fCBwYWQ7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9O1xyXG4gICAgLy8gc2V0IGN1c3RvbSB0YWIgc3RyaW5nIGNoYXJhY3RlcnNcclxuICAgIHRoaXMuc2V0VGFiID0gZnVuY3Rpb24gKHN0cikge1xyXG4gICAgICAgIHRhYiA9IHN0ciB8fCB0YWI7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9O1xyXG4gICAgdGhpcy5zZXRVVEY4ID0gZnVuY3Rpb24gKGJvb2wpIHtcclxuICAgICAgICBpZiAodHlwZW9mIGJvb2wgPT09ICdib29sZWFuJykge1xyXG4gICAgICAgICAgdXRmOCA9IGJvb2w7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfTtcclxuICB9LFxyXG5cclxuICAvKipcclxuICAgKiBDUkMtMzIgY2FsY3VsYXRpb25cclxuICAgKiBAbWVtYmVyIEhhc2hlc1xyXG4gICAqIEBtZXRob2QgQ1JDMzJcclxuICAgKiBAc3RhdGljXHJcbiAgICogQHBhcmFtIHtTdHJpbmd9IHN0ciBJbnB1dCBTdHJpbmdcclxuICAgKiBAcmV0dXJuIHtTdHJpbmd9XHJcbiAgICovXHJcbiAgQ1JDMzIgOiBmdW5jdGlvbiAoc3RyKSB7XHJcbiAgICB2YXIgY3JjID0gMCwgeCA9IDAsIHkgPSAwLCB0YWJsZSwgaTtcclxuICAgIHN0ciA9IHV0ZjhFbmNvZGUoc3RyKTtcclxuICAgICAgICBcclxuICAgIHRhYmxlID0gJzAwMDAwMDAwIDc3MDczMDk2IEVFMEU2MTJDIDk5MDk1MUJBIDA3NkRDNDE5IDcwNkFGNDhGIEU5NjNBNTM1IDlFNjQ5NUEzIDBFREI4ODMyICcgK1xyXG4gICAgICAgICAgICAnNzlEQ0I4QTQgRTBENUU5MUUgOTdEMkQ5ODggMDlCNjRDMkIgN0VCMTdDQkQgRTdCODJEMDcgOTBCRjFEOTEgMURCNzEwNjQgNkFCMDIwRjIgRjNCOTcxNDggJyArXHJcbiAgICAgICAgICAgICc4NEJFNDFERSAxQURBRDQ3RCA2RERERTRFQiBGNEQ0QjU1MSA4M0QzODVDNyAxMzZDOTg1NiA2NDZCQThDMCBGRDYyRjk3QSA4QTY1QzlFQyAxNDAxNUM0RiAnICtcclxuICAgICAgICAgICAgJzYzMDY2Q0Q5IEZBMEYzRDYzIDhEMDgwREY1IDNCNkUyMEM4IDRDNjkxMDVFIEQ1NjA0MUU0IEEyNjc3MTcyIDNDMDNFNEQxIDRCMDRENDQ3IEQyMEQ4NUZEICcgK1xyXG4gICAgICAgICAgICAnQTUwQUI1NkIgMzVCNUE4RkEgNDJCMjk4NkMgREJCQkM5RDYgQUNCQ0Y5NDAgMzJEODZDRTMgNDVERjVDNzUgRENENjBEQ0YgQUJEMTNENTkgMjZEOTMwQUMgJyArXHJcbiAgICAgICAgICAgICc1MURFMDAzQSBDOEQ3NTE4MCBCRkQwNjExNiAyMUI0RjRCNSA1NkIzQzQyMyBDRkJBOTU5OSBCOEJEQTUwRiAyODAyQjg5RSA1RjA1ODgwOCBDNjBDRDlCMiAnICtcclxuICAgICAgICAgICAgJ0IxMEJFOTI0IDJGNkY3Qzg3IDU4Njg0QzExIEMxNjExREFCIEI2NjYyRDNEIDc2REM0MTkwIDAxREI3MTA2IDk4RDIyMEJDIEVGRDUxMDJBIDcxQjE4NTg5ICcgK1xyXG4gICAgICAgICAgICAnMDZCNkI1MUYgOUZCRkU0QTUgRThCOEQ0MzMgNzgwN0M5QTIgMEYwMEY5MzQgOTYwOUE4OEUgRTEwRTk4MTggN0Y2QTBEQkIgMDg2RDNEMkQgOTE2NDZDOTcgJyArXHJcbiAgICAgICAgICAgICdFNjYzNUMwMSA2QjZCNTFGNCAxQzZDNjE2MiA4NTY1MzBEOCBGMjYyMDA0RSA2QzA2OTVFRCAxQjAxQTU3QiA4MjA4RjRDMSBGNTBGQzQ1NyA2NUIwRDlDNiAnICtcclxuICAgICAgICAgICAgJzEyQjdFOTUwIDhCQkVCOEVBIEZDQjk4ODdDIDYyREQxRERGIDE1REEyRDQ5IDhDRDM3Q0YzIEZCRDQ0QzY1IDREQjI2MTU4IDNBQjU1MUNFIEEzQkMwMDc0ICcgK1xyXG4gICAgICAgICAgICAnRDRCQjMwRTIgNEFERkE1NDEgM0REODk1RDcgQTREMUM0NkQgRDNENkY0RkIgNDM2OUU5NkEgMzQ2RUQ5RkMgQUQ2Nzg4NDYgREE2MEI4RDAgNDQwNDJENzMgJyArXHJcbiAgICAgICAgICAgICczMzAzMURFNSBBQTBBNEM1RiBERDBEN0NDOSA1MDA1NzEzQyAyNzAyNDFBQSBCRTBCMTAxMCBDOTBDMjA4NiA1NzY4QjUyNSAyMDZGODVCMyBCOTY2RDQwOSAnICtcclxuICAgICAgICAgICAgJ0NFNjFFNDlGIDVFREVGOTBFIDI5RDlDOTk4IEIwRDA5ODIyIEM3RDdBOEI0IDU5QjMzRDE3IDJFQjQwRDgxIEI3QkQ1QzNCIEMwQkE2Q0FEIEVEQjg4MzIwICcgK1xyXG4gICAgICAgICAgICAnOUFCRkIzQjYgMDNCNkUyMEMgNzRCMUQyOUEgRUFENTQ3MzkgOUREMjc3QUYgMDREQjI2MTUgNzNEQzE2ODMgRTM2MzBCMTIgOTQ2NDNCODQgMEQ2RDZBM0UgJyArXHJcbiAgICAgICAgICAgICc3QTZBNUFBOCBFNDBFQ0YwQiA5MzA5RkY5RCAwQTAwQUUyNyA3RDA3OUVCMSBGMDBGOTM0NCA4NzA4QTNEMiAxRTAxRjI2OCA2OTA2QzJGRSBGNzYyNTc1RCAnICtcclxuICAgICAgICAgICAgJzgwNjU2N0NCIDE5NkMzNjcxIDZFNkIwNkU3IEZFRDQxQjc2IDg5RDMyQkUwIDEwREE3QTVBIDY3REQ0QUNDIEY5QjlERjZGIDhFQkVFRkY5IDE3QjdCRTQzICcgK1xyXG4gICAgICAgICAgICAnNjBCMDhFRDUgRDZENkEzRTggQTFEMTkzN0UgMzhEOEMyQzQgNEZERkYyNTIgRDFCQjY3RjEgQTZCQzU3NjcgM0ZCNTA2REQgNDhCMjM2NEIgRDgwRDJCREEgJyArXHJcbiAgICAgICAgICAgICdBRjBBMUI0QyAzNjAzNEFGNiA0MTA0N0E2MCBERjYwRUZDMyBBODY3REY1NSAzMTZFOEVFRiA0NjY5QkU3OSBDQjYxQjM4QyBCQzY2ODMxQSAyNTZGRDJBMCAnICsgXHJcbiAgICAgICAgICAgICc1MjY4RTIzNiBDQzBDNzc5NSBCQjBCNDcwMyAyMjAyMTZCOSA1NTA1MjYyRiBDNUJBM0JCRSBCMkJEMEIyOCAyQkI0NUE5MiA1Q0IzNkEwNCBDMkQ3RkZBNyAnICtcclxuICAgICAgICAgICAgJ0I1RDBDRjMxIDJDRDk5RThCIDVCREVBRTFEIDlCNjRDMkIwIEVDNjNGMjI2IDc1NkFBMzlDIDAyNkQ5MzBBIDlDMDkwNkE5IEVCMEUzNjNGIDcyMDc2Nzg1ICcgK1xyXG4gICAgICAgICAgICAnMDUwMDU3MTMgOTVCRjRBODIgRTJCODdBMTQgN0JCMTJCQUUgMENCNjFCMzggOTJEMjhFOUIgRTVENUJFMEQgN0NEQ0VGQjcgMEJEQkRGMjEgODZEM0QyRDQgJyArXHJcbiAgICAgICAgICAgICdGMUQ0RTI0MiA2OEREQjNGOCAxRkRBODM2RSA4MUJFMTZDRCBGNkI5MjY1QiA2RkIwNzdFMSAxOEI3NDc3NyA4ODA4NUFFNiBGRjBGNkE3MCA2NjA2M0JDQSAnICtcclxuICAgICAgICAgICAgJzExMDEwQjVDIDhGNjU5RUZGIEY4NjJBRTY5IDYxNkJGRkQzIDE2NkNDRjQ1IEEwMEFFMjc4IEQ3MEREMkVFIDRFMDQ4MzU0IDM5MDNCM0MyIEE3NjcyNjYxICcgK1xyXG4gICAgICAgICAgICAnRDA2MDE2RjcgNDk2OTQ3NEQgM0U2RTc3REIgQUVEMTZBNEEgRDlENjVBREMgNDBERjBCNjYgMzdEODNCRjAgQTlCQ0FFNTMgREVCQjlFQzUgNDdCMkNGN0YgJyArXHJcbiAgICAgICAgICAgICczMEI1RkZFOSBCREJERjIxQyBDQUJBQzI4QSA1M0IzOTMzMCAyNEI0QTNBNiBCQUQwMzYwNSBDREQ3MDY5MyA1NERFNTcyOSAyM0Q5NjdCRiBCMzY2N0EyRSAnICtcclxuICAgICAgICAgICAgJ0M0NjE0QUI4IDVENjgxQjAyIDJBNkYyQjk0IEI0MEJCRTM3IEMzMEM4RUExIDVBMDVERjFCIDJEMDJFRjhEJztcclxuXHJcbiAgICBjcmMgPSBjcmMgXiAoLTEpO1xyXG4gICAgZm9yIChpID0gMCwgaVRvcCA9IHN0ci5sZW5ndGg7IGkgPCBpVG9wOyBpKz0xICkge1xyXG4gICAgICAgIHkgPSAoIGNyYyBeIHN0ci5jaGFyQ29kZUF0KCBpICkgKSAmIDB4RkY7XHJcbiAgICAgICAgeCA9ICcweCcgKyB0YWJsZS5zdWJzdHIoIHkgKiA5LCA4ICk7XHJcbiAgICAgICAgY3JjID0gKCBjcmMgPj4+IDggKSBeIHg7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gY3JjIF4gKC0xKTtcclxuICB9LFxyXG4gIC8qKlxyXG4gICAqIEBtZW1iZXIgSGFzaGVzXHJcbiAgICogQGNsYXNzIE1ENVxyXG4gICAqIEBjb25zdHJ1Y3RvclxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbY29uZmlnXVxyXG4gICAqIFxyXG4gICAqIEEgSmF2YVNjcmlwdCBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgUlNBIERhdGEgU2VjdXJpdHksIEluYy4gTUQ1IE1lc3NhZ2VcclxuICAgKiBEaWdlc3QgQWxnb3JpdGhtLCBhcyBkZWZpbmVkIGluIFJGQyAxMzIxLlxyXG4gICAqIFZlcnNpb24gMi4yIENvcHlyaWdodCAoQykgUGF1bCBKb2huc3RvbiAxOTk5IC0gMjAwOVxyXG4gICAqIE90aGVyIGNvbnRyaWJ1dG9yczogR3JlZyBIb2x0LCBBbmRyZXcgS2VwZXJ0LCBZZG5hciwgTG9zdGluZXRcclxuICAgKiBTZWUgPGh0dHA6Ly9wYWpob21lLm9yZy51ay9jcnlwdC9tZDU+IGZvciBtb3JlIGluZkhhc2hlcy5cclxuICAgKi9cclxuICBNRDUgOiBmdW5jdGlvbiAob3B0aW9ucykgeyAgXHJcbiAgICAvKipcclxuICAgICAqIFByaXZhdGUgY29uZmlnIHByb3BlcnRpZXMuIFlvdSBtYXkgbmVlZCB0byB0d2VhayB0aGVzZSB0byBiZSBjb21wYXRpYmxlIHdpdGhcclxuICAgICAqIHRoZSBzZXJ2ZXItc2lkZSwgYnV0IHRoZSBkZWZhdWx0cyB3b3JrIGluIG1vc3QgY2FzZXMuXHJcbiAgICAgKiBTZWUge0BsaW5rIEhhc2hlcy5NRDUjbWV0aG9kLXNldFVwcGVyQ2FzZX0gYW5kIHtAbGluayBIYXNoZXMuU0hBMSNtZXRob2Qtc2V0VXBwZXJDYXNlfVxyXG4gICAgICovXHJcbiAgICB2YXIgaGV4Y2FzZSA9IChvcHRpb25zICYmIHR5cGVvZiBvcHRpb25zLnVwcGVyY2FzZSA9PT0gJ2Jvb2xlYW4nKSA/IG9wdGlvbnMudXBwZXJjYXNlIDogZmFsc2UsIC8vIGhleGFkZWNpbWFsIG91dHB1dCBjYXNlIGZvcm1hdC4gZmFsc2UgLSBsb3dlcmNhc2U7IHRydWUgLSB1cHBlcmNhc2VcclxuICAgICAgICBiNjRwYWQgPSAob3B0aW9ucyAmJiB0eXBlb2Ygb3B0aW9ucy5wYWQgPT09ICdzdHJpbmcnKSA/IG9wdGlvbnMucGRhIDogJz0nLCAvLyBiYXNlLTY0IHBhZCBjaGFyYWN0ZXIuIERlZmF1bHRzIHRvICc9JyBmb3Igc3RyaWN0IFJGQyBjb21wbGlhbmNlXHJcbiAgICAgICAgdXRmOCA9IChvcHRpb25zICYmIHR5cGVvZiBvcHRpb25zLnV0ZjggPT09ICdib29sZWFuJykgPyBvcHRpb25zLnV0ZjggOiB0cnVlOyAvLyBlbmFibGUvZGlzYWJsZSB1dGY4IGVuY29kaW5nXHJcblxyXG4gICAgLy8gcHJpdmlsZWdlZCAocHVibGljKSBtZXRob2RzIFxyXG4gICAgdGhpcy5oZXggPSBmdW5jdGlvbiAocykgeyBcclxuICAgICAgcmV0dXJuIHJzdHIyaGV4KHJzdHIocywgdXRmOCksIGhleGNhc2UpO1xyXG4gICAgfTtcclxuICAgIHRoaXMuYjY0ID0gZnVuY3Rpb24gKHMpIHsgXHJcbiAgICAgIHJldHVybiByc3RyMmI2NChyc3RyKHMpLCBiNjRwYWQpO1xyXG4gICAgfTtcclxuICAgIHRoaXMuYW55ID0gZnVuY3Rpb24ocywgZSkgeyBcclxuICAgICAgcmV0dXJuIHJzdHIyYW55KHJzdHIocywgdXRmOCksIGUpOyBcclxuICAgIH07XHJcbiAgICB0aGlzLmhleF9obWFjID0gZnVuY3Rpb24gKGssIGQpIHsgXHJcbiAgICAgIHJldHVybiByc3RyMmhleChyc3RyX2htYWMoaywgZCksIGhleGNhc2UpOyBcclxuICAgIH07XHJcbiAgICB0aGlzLmI2NF9obWFjID0gZnVuY3Rpb24gKGssIGQpIHsgXHJcbiAgICAgIHJldHVybiByc3RyMmI2NChyc3RyX2htYWMoayxkKSwgYjY0cGFkKTsgXHJcbiAgICB9O1xyXG4gICAgdGhpcy5hbnlfaG1hYyA9IGZ1bmN0aW9uIChrLCBkLCBlKSB7IFxyXG4gICAgICByZXR1cm4gcnN0cjJhbnkocnN0cl9obWFjKGssIGQpLCBlKTsgXHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBQZXJmb3JtIGEgc2ltcGxlIHNlbGYtdGVzdCB0byBzZWUgaWYgdGhlIFZNIGlzIHdvcmtpbmdcclxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gSGV4YWRlY2ltYWwgaGFzaCBzYW1wbGVcclxuICAgICAqL1xyXG4gICAgdGhpcy52bV90ZXN0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICByZXR1cm4gaGV4KCdhYmMnKS50b0xvd2VyQ2FzZSgpID09PSAnOTAwMTUwOTgzY2QyNGZiMGQ2OTYzZjdkMjhlMTdmNzInO1xyXG4gICAgfTtcclxuICAgIC8qKiBcclxuICAgICAqIEVuYWJsZS9kaXNhYmxlIHVwcGVyY2FzZSBoZXhhZGVjaW1hbCByZXR1cm5lZCBzdHJpbmcgXHJcbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59IFxyXG4gICAgICogQHJldHVybiB7T2JqZWN0fSB0aGlzXHJcbiAgICAgKi8gXHJcbiAgICB0aGlzLnNldFVwcGVyQ2FzZSA9IGZ1bmN0aW9uIChhKSB7XHJcbiAgICAgIGlmICh0eXBlb2YgYSA9PT0gJ2Jvb2xlYW4nICkge1xyXG4gICAgICAgIGhleGNhc2UgPSBhO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfTtcclxuICAgIC8qKiBcclxuICAgICAqIERlZmluZXMgYSBiYXNlNjQgcGFkIHN0cmluZyBcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBQYWRcclxuICAgICAqIEByZXR1cm4ge09iamVjdH0gdGhpc1xyXG4gICAgICovIFxyXG4gICAgdGhpcy5zZXRQYWQgPSBmdW5jdGlvbiAoYSkge1xyXG4gICAgICBiNjRwYWQgPSBhIHx8IGI2NHBhZDtcclxuICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9O1xyXG4gICAgLyoqIFxyXG4gICAgICogRGVmaW5lcyBhIGJhc2U2NCBwYWQgc3RyaW5nIFxyXG4gICAgICogQHBhcmFtIHtCb29sZWFufSBcclxuICAgICAqIEByZXR1cm4ge09iamVjdH0gW3RoaXNdXHJcbiAgICAgKi8gXHJcbiAgICB0aGlzLnNldFVURjggPSBmdW5jdGlvbiAoYSkge1xyXG4gICAgICBpZiAodHlwZW9mIGEgPT09ICdib29sZWFuJykgeyBcclxuICAgICAgICB1dGY4ID0gYTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gdGhpcztcclxuICAgIH07XHJcblxyXG4gICAgLy8gcHJpdmF0ZSBtZXRob2RzXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxjdWxhdGUgdGhlIE1ENSBvZiBhIHJhdyBzdHJpbmdcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gcnN0cihzKSB7XHJcbiAgICAgIHMgPSAodXRmOCkgPyB1dGY4RW5jb2RlKHMpOiBzO1xyXG4gICAgICByZXR1cm4gYmlubDJyc3RyKGJpbmwocnN0cjJiaW5sKHMpLCBzLmxlbmd0aCAqIDgpKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxjdWxhdGUgdGhlIEhNQUMtTUQ1LCBvZiBhIGtleSBhbmQgc29tZSBkYXRhIChyYXcgc3RyaW5ncylcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gcnN0cl9obWFjKGtleSwgZGF0YSkge1xyXG4gICAgICB2YXIgYmtleSwgaXBhZCwgaGFzaCwgaTtcclxuXHJcbiAgICAgIGtleSA9ICh1dGY4KSA/IHV0ZjhFbmNvZGUoa2V5KSA6IGtleTtcclxuICAgICAgZGF0YSA9ICh1dGY4KSA/IHV0ZjhFbmNvZGUoZGF0YSkgOiBkYXRhO1xyXG4gICAgICBia2V5ID0gcnN0cjJiaW5sKGtleSk7XHJcbiAgICAgIGlmIChia2V5Lmxlbmd0aCA+IDE2KSB7IFxyXG4gICAgICAgIGJrZXkgPSBiaW5sKGJrZXksIGtleS5sZW5ndGggKiA4KTsgXHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlwYWQgPSBBcnJheSgxNiksIG9wYWQgPSBBcnJheSgxNik7IFxyXG4gICAgICBmb3IgKGkgPSAwOyBpIDwgMTY7IGkrPTEpIHtcclxuICAgICAgICAgIGlwYWRbaV0gPSBia2V5W2ldIF4gMHgzNjM2MzYzNjtcclxuICAgICAgICAgIG9wYWRbaV0gPSBia2V5W2ldIF4gMHg1QzVDNUM1QztcclxuICAgICAgfVxyXG4gICAgICBoYXNoID0gYmlubChpcGFkLmNvbmNhdChyc3RyMmJpbmwoZGF0YSkpLCA1MTIgKyBkYXRhLmxlbmd0aCAqIDgpO1xyXG4gICAgICByZXR1cm4gYmlubDJyc3RyKGJpbmwob3BhZC5jb25jYXQoaGFzaCksIDUxMiArIDEyOCkpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2FsY3VsYXRlIHRoZSBNRDUgb2YgYW4gYXJyYXkgb2YgbGl0dGxlLWVuZGlhbiB3b3JkcywgYW5kIGEgYml0IGxlbmd0aC5cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gYmlubCh4LCBsZW4pIHtcclxuICAgICAgdmFyIGksIG9sZGEsIG9sZGIsIG9sZGMsIG9sZGQsXHJcbiAgICAgICAgICBhID0gIDE3MzI1ODQxOTMsXHJcbiAgICAgICAgICBiID0gLTI3MTczMzg3OSxcclxuICAgICAgICAgIGMgPSAtMTczMjU4NDE5NCxcclxuICAgICAgICAgIGQgPSAgMjcxNzMzODc4O1xyXG4gICAgICAgIFxyXG4gICAgICAvKiBhcHBlbmQgcGFkZGluZyAqL1xyXG4gICAgICB4W2xlbiA+PiA1XSB8PSAweDgwIDw8ICgobGVuKSAlIDMyKTtcclxuICAgICAgeFsoKChsZW4gKyA2NCkgPj4+IDkpIDw8IDQpICsgMTRdID0gbGVuO1xyXG5cclxuICAgICAgZm9yIChpID0gMDsgaSA8IHgubGVuZ3RoOyBpICs9IDE2KSB7XHJcbiAgICAgICAgb2xkYSA9IGE7XHJcbiAgICAgICAgb2xkYiA9IGI7XHJcbiAgICAgICAgb2xkYyA9IGM7XHJcbiAgICAgICAgb2xkZCA9IGQ7XHJcblxyXG4gICAgICAgIGEgPSBtZDVfZmYoYSwgYiwgYywgZCwgeFtpKyAwXSwgNyAsIC02ODA4NzY5MzYpO1xyXG4gICAgICAgIGQgPSBtZDVfZmYoZCwgYSwgYiwgYywgeFtpKyAxXSwgMTIsIC0zODk1NjQ1ODYpO1xyXG4gICAgICAgIGMgPSBtZDVfZmYoYywgZCwgYSwgYiwgeFtpKyAyXSwgMTcsICA2MDYxMDU4MTkpO1xyXG4gICAgICAgIGIgPSBtZDVfZmYoYiwgYywgZCwgYSwgeFtpKyAzXSwgMjIsIC0xMDQ0NTI1MzMwKTtcclxuICAgICAgICBhID0gbWQ1X2ZmKGEsIGIsIGMsIGQsIHhbaSsgNF0sIDcgLCAtMTc2NDE4ODk3KTtcclxuICAgICAgICBkID0gbWQ1X2ZmKGQsIGEsIGIsIGMsIHhbaSsgNV0sIDEyLCAgMTIwMDA4MDQyNik7XHJcbiAgICAgICAgYyA9IG1kNV9mZihjLCBkLCBhLCBiLCB4W2krIDZdLCAxNywgLTE0NzMyMzEzNDEpO1xyXG4gICAgICAgIGIgPSBtZDVfZmYoYiwgYywgZCwgYSwgeFtpKyA3XSwgMjIsIC00NTcwNTk4Myk7XHJcbiAgICAgICAgYSA9IG1kNV9mZihhLCBiLCBjLCBkLCB4W2krIDhdLCA3ICwgIDE3NzAwMzU0MTYpO1xyXG4gICAgICAgIGQgPSBtZDVfZmYoZCwgYSwgYiwgYywgeFtpKyA5XSwgMTIsIC0xOTU4NDE0NDE3KTtcclxuICAgICAgICBjID0gbWQ1X2ZmKGMsIGQsIGEsIGIsIHhbaSsxMF0sIDE3LCAtNDIwNjMpO1xyXG4gICAgICAgIGIgPSBtZDVfZmYoYiwgYywgZCwgYSwgeFtpKzExXSwgMjIsIC0xOTkwNDA0MTYyKTtcclxuICAgICAgICBhID0gbWQ1X2ZmKGEsIGIsIGMsIGQsIHhbaSsxMl0sIDcgLCAgMTgwNDYwMzY4Mik7XHJcbiAgICAgICAgZCA9IG1kNV9mZihkLCBhLCBiLCBjLCB4W2krMTNdLCAxMiwgLTQwMzQxMTAxKTtcclxuICAgICAgICBjID0gbWQ1X2ZmKGMsIGQsIGEsIGIsIHhbaSsxNF0sIDE3LCAtMTUwMjAwMjI5MCk7XHJcbiAgICAgICAgYiA9IG1kNV9mZihiLCBjLCBkLCBhLCB4W2krMTVdLCAyMiwgIDEyMzY1MzUzMjkpO1xyXG5cclxuICAgICAgICBhID0gbWQ1X2dnKGEsIGIsIGMsIGQsIHhbaSsgMV0sIDUgLCAtMTY1Nzk2NTEwKTtcclxuICAgICAgICBkID0gbWQ1X2dnKGQsIGEsIGIsIGMsIHhbaSsgNl0sIDkgLCAtMTA2OTUwMTYzMik7XHJcbiAgICAgICAgYyA9IG1kNV9nZyhjLCBkLCBhLCBiLCB4W2krMTFdLCAxNCwgIDY0MzcxNzcxMyk7XHJcbiAgICAgICAgYiA9IG1kNV9nZyhiLCBjLCBkLCBhLCB4W2krIDBdLCAyMCwgLTM3Mzg5NzMwMik7XHJcbiAgICAgICAgYSA9IG1kNV9nZyhhLCBiLCBjLCBkLCB4W2krIDVdLCA1ICwgLTcwMTU1ODY5MSk7XHJcbiAgICAgICAgZCA9IG1kNV9nZyhkLCBhLCBiLCBjLCB4W2krMTBdLCA5ICwgIDM4MDE2MDgzKTtcclxuICAgICAgICBjID0gbWQ1X2dnKGMsIGQsIGEsIGIsIHhbaSsxNV0sIDE0LCAtNjYwNDc4MzM1KTtcclxuICAgICAgICBiID0gbWQ1X2dnKGIsIGMsIGQsIGEsIHhbaSsgNF0sIDIwLCAtNDA1NTM3ODQ4KTtcclxuICAgICAgICBhID0gbWQ1X2dnKGEsIGIsIGMsIGQsIHhbaSsgOV0sIDUgLCAgNTY4NDQ2NDM4KTtcclxuICAgICAgICBkID0gbWQ1X2dnKGQsIGEsIGIsIGMsIHhbaSsxNF0sIDkgLCAtMTAxOTgwMzY5MCk7XHJcbiAgICAgICAgYyA9IG1kNV9nZyhjLCBkLCBhLCBiLCB4W2krIDNdLCAxNCwgLTE4NzM2Mzk2MSk7XHJcbiAgICAgICAgYiA9IG1kNV9nZyhiLCBjLCBkLCBhLCB4W2krIDhdLCAyMCwgIDExNjM1MzE1MDEpO1xyXG4gICAgICAgIGEgPSBtZDVfZ2coYSwgYiwgYywgZCwgeFtpKzEzXSwgNSAsIC0xNDQ0NjgxNDY3KTtcclxuICAgICAgICBkID0gbWQ1X2dnKGQsIGEsIGIsIGMsIHhbaSsgMl0sIDkgLCAtNTE0MDM3ODQpO1xyXG4gICAgICAgIGMgPSBtZDVfZ2coYywgZCwgYSwgYiwgeFtpKyA3XSwgMTQsICAxNzM1MzI4NDczKTtcclxuICAgICAgICBiID0gbWQ1X2dnKGIsIGMsIGQsIGEsIHhbaSsxMl0sIDIwLCAtMTkyNjYwNzczNCk7XHJcblxyXG4gICAgICAgIGEgPSBtZDVfaGgoYSwgYiwgYywgZCwgeFtpKyA1XSwgNCAsIC0zNzg1NTgpO1xyXG4gICAgICAgIGQgPSBtZDVfaGgoZCwgYSwgYiwgYywgeFtpKyA4XSwgMTEsIC0yMDIyNTc0NDYzKTtcclxuICAgICAgICBjID0gbWQ1X2hoKGMsIGQsIGEsIGIsIHhbaSsxMV0sIDE2LCAgMTgzOTAzMDU2Mik7XHJcbiAgICAgICAgYiA9IG1kNV9oaChiLCBjLCBkLCBhLCB4W2krMTRdLCAyMywgLTM1MzA5NTU2KTtcclxuICAgICAgICBhID0gbWQ1X2hoKGEsIGIsIGMsIGQsIHhbaSsgMV0sIDQgLCAtMTUzMDk5MjA2MCk7XHJcbiAgICAgICAgZCA9IG1kNV9oaChkLCBhLCBiLCBjLCB4W2krIDRdLCAxMSwgIDEyNzI4OTMzNTMpO1xyXG4gICAgICAgIGMgPSBtZDVfaGgoYywgZCwgYSwgYiwgeFtpKyA3XSwgMTYsIC0xNTU0OTc2MzIpO1xyXG4gICAgICAgIGIgPSBtZDVfaGgoYiwgYywgZCwgYSwgeFtpKzEwXSwgMjMsIC0xMDk0NzMwNjQwKTtcclxuICAgICAgICBhID0gbWQ1X2hoKGEsIGIsIGMsIGQsIHhbaSsxM10sIDQgLCAgNjgxMjc5MTc0KTtcclxuICAgICAgICBkID0gbWQ1X2hoKGQsIGEsIGIsIGMsIHhbaSsgMF0sIDExLCAtMzU4NTM3MjIyKTtcclxuICAgICAgICBjID0gbWQ1X2hoKGMsIGQsIGEsIGIsIHhbaSsgM10sIDE2LCAtNzIyNTIxOTc5KTtcclxuICAgICAgICBiID0gbWQ1X2hoKGIsIGMsIGQsIGEsIHhbaSsgNl0sIDIzLCAgNzYwMjkxODkpO1xyXG4gICAgICAgIGEgPSBtZDVfaGgoYSwgYiwgYywgZCwgeFtpKyA5XSwgNCAsIC02NDAzNjQ0ODcpO1xyXG4gICAgICAgIGQgPSBtZDVfaGgoZCwgYSwgYiwgYywgeFtpKzEyXSwgMTEsIC00MjE4MTU4MzUpO1xyXG4gICAgICAgIGMgPSBtZDVfaGgoYywgZCwgYSwgYiwgeFtpKzE1XSwgMTYsICA1MzA3NDI1MjApO1xyXG4gICAgICAgIGIgPSBtZDVfaGgoYiwgYywgZCwgYSwgeFtpKyAyXSwgMjMsIC05OTUzMzg2NTEpO1xyXG5cclxuICAgICAgICBhID0gbWQ1X2lpKGEsIGIsIGMsIGQsIHhbaSsgMF0sIDYgLCAtMTk4NjMwODQ0KTtcclxuICAgICAgICBkID0gbWQ1X2lpKGQsIGEsIGIsIGMsIHhbaSsgN10sIDEwLCAgMTEyNjg5MTQxNSk7XHJcbiAgICAgICAgYyA9IG1kNV9paShjLCBkLCBhLCBiLCB4W2krMTRdLCAxNSwgLTE0MTYzNTQ5MDUpO1xyXG4gICAgICAgIGIgPSBtZDVfaWkoYiwgYywgZCwgYSwgeFtpKyA1XSwgMjEsIC01NzQzNDA1NSk7XHJcbiAgICAgICAgYSA9IG1kNV9paShhLCBiLCBjLCBkLCB4W2krMTJdLCA2ICwgIDE3MDA0ODU1NzEpO1xyXG4gICAgICAgIGQgPSBtZDVfaWkoZCwgYSwgYiwgYywgeFtpKyAzXSwgMTAsIC0xODk0OTg2NjA2KTtcclxuICAgICAgICBjID0gbWQ1X2lpKGMsIGQsIGEsIGIsIHhbaSsxMF0sIDE1LCAtMTA1MTUyMyk7XHJcbiAgICAgICAgYiA9IG1kNV9paShiLCBjLCBkLCBhLCB4W2krIDFdLCAyMSwgLTIwNTQ5MjI3OTkpO1xyXG4gICAgICAgIGEgPSBtZDVfaWkoYSwgYiwgYywgZCwgeFtpKyA4XSwgNiAsICAxODczMzEzMzU5KTtcclxuICAgICAgICBkID0gbWQ1X2lpKGQsIGEsIGIsIGMsIHhbaSsxNV0sIDEwLCAtMzA2MTE3NDQpO1xyXG4gICAgICAgIGMgPSBtZDVfaWkoYywgZCwgYSwgYiwgeFtpKyA2XSwgMTUsIC0xNTYwMTk4MzgwKTtcclxuICAgICAgICBiID0gbWQ1X2lpKGIsIGMsIGQsIGEsIHhbaSsxM10sIDIxLCAgMTMwOTE1MTY0OSk7XHJcbiAgICAgICAgYSA9IG1kNV9paShhLCBiLCBjLCBkLCB4W2krIDRdLCA2ICwgLTE0NTUyMzA3MCk7XHJcbiAgICAgICAgZCA9IG1kNV9paShkLCBhLCBiLCBjLCB4W2krMTFdLCAxMCwgLTExMjAyMTAzNzkpO1xyXG4gICAgICAgIGMgPSBtZDVfaWkoYywgZCwgYSwgYiwgeFtpKyAyXSwgMTUsICA3MTg3ODcyNTkpO1xyXG4gICAgICAgIGIgPSBtZDVfaWkoYiwgYywgZCwgYSwgeFtpKyA5XSwgMjEsIC0zNDM0ODU1NTEpO1xyXG5cclxuICAgICAgICBhID0gc2FmZV9hZGQoYSwgb2xkYSk7XHJcbiAgICAgICAgYiA9IHNhZmVfYWRkKGIsIG9sZGIpO1xyXG4gICAgICAgIGMgPSBzYWZlX2FkZChjLCBvbGRjKTtcclxuICAgICAgICBkID0gc2FmZV9hZGQoZCwgb2xkZCk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIEFycmF5KGEsIGIsIGMsIGQpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGhlc2UgZnVuY3Rpb25zIGltcGxlbWVudCB0aGUgZm91ciBiYXNpYyBvcGVyYXRpb25zIHRoZSBhbGdvcml0aG0gdXNlcy5cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gbWQ1X2NtbihxLCBhLCBiLCB4LCBzLCB0KSB7XHJcbiAgICAgIHJldHVybiBzYWZlX2FkZChiaXRfcm9sKHNhZmVfYWRkKHNhZmVfYWRkKGEsIHEpLCBzYWZlX2FkZCh4LCB0KSksIHMpLGIpO1xyXG4gICAgfVxyXG4gICAgZnVuY3Rpb24gbWQ1X2ZmKGEsIGIsIGMsIGQsIHgsIHMsIHQpIHtcclxuICAgICAgcmV0dXJuIG1kNV9jbW4oKGIgJiBjKSB8ICgofmIpICYgZCksIGEsIGIsIHgsIHMsIHQpO1xyXG4gICAgfVxyXG4gICAgZnVuY3Rpb24gbWQ1X2dnKGEsIGIsIGMsIGQsIHgsIHMsIHQpIHtcclxuICAgICAgcmV0dXJuIG1kNV9jbW4oKGIgJiBkKSB8IChjICYgKH5kKSksIGEsIGIsIHgsIHMsIHQpO1xyXG4gICAgfVxyXG4gICAgZnVuY3Rpb24gbWQ1X2hoKGEsIGIsIGMsIGQsIHgsIHMsIHQpIHtcclxuICAgICAgcmV0dXJuIG1kNV9jbW4oYiBeIGMgXiBkLCBhLCBiLCB4LCBzLCB0KTtcclxuICAgIH1cclxuICAgIGZ1bmN0aW9uIG1kNV9paShhLCBiLCBjLCBkLCB4LCBzLCB0KSB7XHJcbiAgICAgIHJldHVybiBtZDVfY21uKGMgXiAoYiB8ICh+ZCkpLCBhLCBiLCB4LCBzLCB0KTtcclxuICAgIH1cclxuICB9LFxyXG4gIC8qKlxyXG4gICAqIEBtZW1iZXIgSGFzaGVzXHJcbiAgICogQGNsYXNzIEhhc2hlcy5TSEExXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IFtjb25maWddXHJcbiAgICogQGNvbnN0cnVjdG9yXHJcbiAgICogXHJcbiAgICogQSBKYXZhU2NyaXB0IGltcGxlbWVudGF0aW9uIG9mIHRoZSBTZWN1cmUgSGFzaCBBbGdvcml0aG0sIFNIQS0xLCBhcyBkZWZpbmVkIGluIEZJUFMgMTgwLTFcclxuICAgKiBWZXJzaW9uIDIuMiBDb3B5cmlnaHQgUGF1bCBKb2huc3RvbiAyMDAwIC0gMjAwOS5cclxuICAgKiBPdGhlciBjb250cmlidXRvcnM6IEdyZWcgSG9sdCwgQW5kcmV3IEtlcGVydCwgWWRuYXIsIExvc3RpbmV0XHJcbiAgICogU2VlIGh0dHA6Ly9wYWpob21lLm9yZy51ay9jcnlwdC9tZDUgZm9yIGRldGFpbHMuXHJcbiAgICovXHJcbiAgU0hBMSA6IGZ1bmN0aW9uIChvcHRpb25zKSB7XHJcbiAgIC8qKlxyXG4gICAgICogUHJpdmF0ZSBjb25maWcgcHJvcGVydGllcy4gWW91IG1heSBuZWVkIHRvIHR3ZWFrIHRoZXNlIHRvIGJlIGNvbXBhdGlibGUgd2l0aFxyXG4gICAgICogdGhlIHNlcnZlci1zaWRlLCBidXQgdGhlIGRlZmF1bHRzIHdvcmsgaW4gbW9zdCBjYXNlcy5cclxuICAgICAqIFNlZSB7QGxpbmsgSGFzaGVzLk1ENSNtZXRob2Qtc2V0VXBwZXJDYXNlfSBhbmQge0BsaW5rIEhhc2hlcy5TSEExI21ldGhvZC1zZXRVcHBlckNhc2V9XHJcbiAgICAgKi9cclxuICAgIHZhciBoZXhjYXNlID0gKG9wdGlvbnMgJiYgdHlwZW9mIG9wdGlvbnMudXBwZXJjYXNlID09PSAnYm9vbGVhbicpID8gb3B0aW9ucy51cHBlcmNhc2UgOiBmYWxzZSwgLy8gaGV4YWRlY2ltYWwgb3V0cHV0IGNhc2UgZm9ybWF0LiBmYWxzZSAtIGxvd2VyY2FzZTsgdHJ1ZSAtIHVwcGVyY2FzZVxyXG4gICAgICAgIGI2NHBhZCA9IChvcHRpb25zICYmIHR5cGVvZiBvcHRpb25zLnBhZCA9PT0gJ3N0cmluZycpID8gb3B0aW9ucy5wZGEgOiAnPScsIC8vIGJhc2UtNjQgcGFkIGNoYXJhY3Rlci4gRGVmYXVsdHMgdG8gJz0nIGZvciBzdHJpY3QgUkZDIGNvbXBsaWFuY2VcclxuICAgICAgICB1dGY4ID0gKG9wdGlvbnMgJiYgdHlwZW9mIG9wdGlvbnMudXRmOCA9PT0gJ2Jvb2xlYW4nKSA/IG9wdGlvbnMudXRmOCA6IHRydWU7IC8vIGVuYWJsZS9kaXNhYmxlIHV0ZjggZW5jb2RpbmdcclxuXHJcbiAgICAvLyBwdWJsaWMgbWV0aG9kc1xyXG4gICAgdGhpcy5oZXggPSBmdW5jdGlvbiAocykgeyBcclxuICAgIFx0cmV0dXJuIHJzdHIyaGV4KHJzdHIocywgdXRmOCksIGhleGNhc2UpOyBcclxuICAgIH07XHJcbiAgICB0aGlzLmI2NCA9IGZ1bmN0aW9uIChzKSB7IFxyXG4gICAgXHRyZXR1cm4gcnN0cjJiNjQocnN0cihzLCB1dGY4KSwgYjY0cGFkKTtcclxuICAgIH07XHJcbiAgICB0aGlzLmFueSA9IGZ1bmN0aW9uIChzLCBlKSB7IFxyXG4gICAgXHRyZXR1cm4gcnN0cjJhbnkocnN0cihzLCB1dGY4KSwgZSk7XHJcbiAgICB9O1xyXG4gICAgdGhpcy5oZXhfaG1hYyA9IGZ1bmN0aW9uIChrLCBkKSB7XHJcbiAgICBcdHJldHVybiByc3RyMmhleChyc3RyX2htYWMoaywgZCkpO1xyXG4gICAgfTtcclxuICAgIHRoaXMuYjY0X2htYWMgPSBmdW5jdGlvbiAoaywgZCkgeyBcclxuICAgIFx0cmV0dXJuIHJzdHIyYjY0KHJzdHJfaG1hYyhrLCBkKSwgYjY0cGFkKTsgXHJcbiAgICB9O1xyXG4gICAgdGhpcy5hbnlfaG1hYyA9IGZ1bmN0aW9uIChrLCBkLCBlKSB7IFxyXG4gICAgXHRyZXR1cm4gcnN0cjJhbnkocnN0cl9obWFjKGssIGQpLCBlKTtcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIFBlcmZvcm0gYSBzaW1wbGUgc2VsZi10ZXN0IHRvIHNlZSBpZiB0aGUgVk0gaXMgd29ya2luZ1xyXG4gICAgICogQHJldHVybiB7U3RyaW5nfSBIZXhhZGVjaW1hbCBoYXNoIHNhbXBsZVxyXG4gICAgICogQHB1YmxpY1xyXG4gICAgICovXHJcbiAgICB0aGlzLnZtX3Rlc3QgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgIHJldHVybiBoZXgoJ2FiYycpLnRvTG93ZXJDYXNlKCkgPT09ICc5MDAxNTA5ODNjZDI0ZmIwZDY5NjNmN2QyOGUxN2Y3Mic7XHJcbiAgICB9O1xyXG4gICAgLyoqIFxyXG4gICAgICogQGRlc2NyaXB0aW9uIEVuYWJsZS9kaXNhYmxlIHVwcGVyY2FzZSBoZXhhZGVjaW1hbCByZXR1cm5lZCBzdHJpbmcgXHJcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFxyXG4gICAgICogQHJldHVybiB7T2JqZWN0fSB0aGlzXHJcbiAgICAgKiBAcHVibGljXHJcbiAgICAgKi8gXHJcbiAgICB0aGlzLnNldFVwcGVyQ2FzZSA9IGZ1bmN0aW9uIChhKSB7XHJcbiAgICBcdGlmICh0eXBlb2YgYSA9PT0gJ2Jvb2xlYW4nKSB7XHJcbiAgICAgICAgaGV4Y2FzZSA9IGE7XHJcbiAgICAgIH1cclxuICAgIFx0cmV0dXJuIHRoaXM7XHJcbiAgICB9O1xyXG4gICAgLyoqIFxyXG4gICAgICogQGRlc2NyaXB0aW9uIERlZmluZXMgYSBiYXNlNjQgcGFkIHN0cmluZyBcclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBQYWRcclxuICAgICAqIEByZXR1cm4ge09iamVjdH0gdGhpc1xyXG4gICAgICogQHB1YmxpY1xyXG4gICAgICovIFxyXG4gICAgdGhpcy5zZXRQYWQgPSBmdW5jdGlvbiAoYSkge1xyXG4gICAgICBiNjRwYWQgPSBhIHx8IGI2NHBhZDtcclxuICAgIFx0cmV0dXJuIHRoaXM7XHJcbiAgICB9O1xyXG4gICAgLyoqIFxyXG4gICAgICogQGRlc2NyaXB0aW9uIERlZmluZXMgYSBiYXNlNjQgcGFkIHN0cmluZyBcclxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gXHJcbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9IHRoaXNcclxuICAgICAqIEBwdWJsaWNcclxuICAgICAqLyBcclxuICAgIHRoaXMuc2V0VVRGOCA9IGZ1bmN0aW9uIChhKSB7XHJcbiAgICBcdGlmICh0eXBlb2YgYSA9PT0gJ2Jvb2xlYW4nKSB7XHJcbiAgICAgICAgdXRmOCA9IGE7XHJcbiAgICAgIH1cclxuICAgIFx0cmV0dXJuIHRoaXM7XHJcbiAgICB9O1xyXG5cclxuICAgIC8vIHByaXZhdGUgbWV0aG9kc1xyXG5cclxuICAgIC8qKlxyXG4gIFx0ICogQ2FsY3VsYXRlIHRoZSBTSEEtNTEyIG9mIGEgcmF3IHN0cmluZ1xyXG4gIFx0ICovXHJcbiAgXHRmdW5jdGlvbiByc3RyKHMpIHtcclxuICAgICAgcyA9ICh1dGY4KSA/IHV0ZjhFbmNvZGUocykgOiBzO1xyXG4gICAgICByZXR1cm4gYmluYjJyc3RyKGJpbmIocnN0cjJiaW5iKHMpLCBzLmxlbmd0aCAqIDgpKTtcclxuICBcdH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENhbGN1bGF0ZSB0aGUgSE1BQy1TSEExIG9mIGEga2V5IGFuZCBzb21lIGRhdGEgKHJhdyBzdHJpbmdzKVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiByc3RyX2htYWMoa2V5LCBkYXRhKSB7XHJcbiAgICAgIHZhciBia2V5LCBpcGFkLCBpLCBoYXNoO1xyXG4gICAgXHRrZXkgPSAodXRmOCkgPyB1dGY4RW5jb2RlKGtleSkgOiBrZXk7XHJcbiAgICBcdGRhdGEgPSAodXRmOCkgPyB1dGY4RW5jb2RlKGRhdGEpIDogZGF0YTtcclxuICAgIFx0YmtleSA9IHJzdHIyYmluYihrZXkpO1xyXG5cclxuICAgIFx0aWYgKGJrZXkubGVuZ3RoID4gMTYpIHtcclxuICAgICAgICBia2V5ID0gYmluYihia2V5LCBrZXkubGVuZ3RoICogOCk7XHJcbiAgICAgIH1cclxuICAgIFx0aXBhZCA9IEFycmF5KDE2KSwgb3BhZCA9IEFycmF5KDE2KTtcclxuICAgIFx0Zm9yIChpID0gMDsgaSA8IDE2OyBpKz0xKSB7XHJcbiAgICBcdFx0aXBhZFtpXSA9IGJrZXlbaV0gXiAweDM2MzYzNjM2O1xyXG4gICAgXHRcdG9wYWRbaV0gPSBia2V5W2ldIF4gMHg1QzVDNUM1QztcclxuICAgIFx0fVxyXG4gICAgXHRoYXNoID0gYmluYihpcGFkLmNvbmNhdChyc3RyMmJpbmIoZGF0YSkpLCA1MTIgKyBkYXRhLmxlbmd0aCAqIDgpO1xyXG4gICAgXHRyZXR1cm4gYmluYjJyc3RyKGJpbmIob3BhZC5jb25jYXQoaGFzaCksIDUxMiArIDE2MCkpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2FsY3VsYXRlIHRoZSBTSEEtMSBvZiBhbiBhcnJheSBvZiBiaWctZW5kaWFuIHdvcmRzLCBhbmQgYSBiaXQgbGVuZ3RoXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGJpbmIoeCwgbGVuKSB7XHJcbiAgICAgIHZhciBpLCBqLCB0LCBvbGRhLCBvbGRiLCBvbGRjLCBvbGRkLCBvbGRlLFxyXG4gICAgICAgICAgdyA9IEFycmF5KDgwKSxcclxuICAgICAgICAgIGEgPSAgMTczMjU4NDE5MyxcclxuICAgICAgICAgIGIgPSAtMjcxNzMzODc5LFxyXG4gICAgICAgICAgYyA9IC0xNzMyNTg0MTk0LFxyXG4gICAgICAgICAgZCA9ICAyNzE3MzM4NzgsXHJcbiAgICAgICAgICBlID0gLTEwMDk1ODk3NzY7XHJcblxyXG4gICAgICAvKiBhcHBlbmQgcGFkZGluZyAqL1xyXG4gICAgICB4W2xlbiA+PiA1XSB8PSAweDgwIDw8ICgyNCAtIGxlbiAlIDMyKTtcclxuICAgICAgeFsoKGxlbiArIDY0ID4+IDkpIDw8IDQpICsgMTVdID0gbGVuO1xyXG5cclxuICAgICAgZm9yIChpID0gMDsgaSA8IHgubGVuZ3RoOyBpICs9IDE2KSB7XHJcbiAgICAgICAgb2xkYSA9IGEsXHJcbiAgICAgICAgb2xkYiA9IGI7XHJcbiAgICAgICAgb2xkYyA9IGM7XHJcbiAgICAgICAgb2xkZCA9IGQ7XHJcbiAgICAgICAgb2xkZSA9IGU7XHJcbiAgICAgIFxyXG4gICAgICBcdGZvciAoaiA9IDA7IGogPCA4MDsgaisrKVx0e1xyXG4gICAgICBcdCAgaWYgKGogPCAxNikgeyBcclxuICAgICAgICAgICAgd1tqXSA9IHhbaSArIGpdOyBcclxuICAgICAgICAgIH0gZWxzZSB7IFxyXG4gICAgICAgICAgICB3W2pdID0gYml0X3JvbCh3W2otM10gXiB3W2otOF0gXiB3W2otMTRdIF4gd1tqLTE2XSwgMSk7IFxyXG4gICAgICAgICAgfVxyXG4gICAgICBcdCAgdCA9IHNhZmVfYWRkKHNhZmVfYWRkKGJpdF9yb2woYSwgNSksIHNoYTFfZnQoaiwgYiwgYywgZCkpLFxyXG4gICAgICBcdFx0XHRcdFx0ICAgc2FmZV9hZGQoc2FmZV9hZGQoZSwgd1tqXSksIHNoYTFfa3QoaikpKTtcclxuICAgICAgXHQgIGUgPSBkO1xyXG4gICAgICBcdCAgZCA9IGM7XHJcbiAgICAgIFx0ICBjID0gYml0X3JvbChiLCAzMCk7XHJcbiAgICAgIFx0ICBiID0gYTtcclxuICAgICAgXHQgIGEgPSB0O1xyXG4gICAgICBcdH1cclxuXHJcbiAgICAgIFx0YSA9IHNhZmVfYWRkKGEsIG9sZGEpO1xyXG4gICAgICBcdGIgPSBzYWZlX2FkZChiLCBvbGRiKTtcclxuICAgICAgXHRjID0gc2FmZV9hZGQoYywgb2xkYyk7XHJcbiAgICAgIFx0ZCA9IHNhZmVfYWRkKGQsIG9sZGQpO1xyXG4gICAgICBcdGUgPSBzYWZlX2FkZChlLCBvbGRlKTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gQXJyYXkoYSwgYiwgYywgZCwgZSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBQZXJmb3JtIHRoZSBhcHByb3ByaWF0ZSB0cmlwbGV0IGNvbWJpbmF0aW9uIGZ1bmN0aW9uIGZvciB0aGUgY3VycmVudFxyXG4gICAgICogaXRlcmF0aW9uXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIHNoYTFfZnQodCwgYiwgYywgZCkge1xyXG4gICAgICBpZiAodCA8IDIwKSB7IHJldHVybiAoYiAmIGMpIHwgKCh+YikgJiBkKTsgfVxyXG4gICAgICBpZiAodCA8IDQwKSB7IHJldHVybiBiIF4gYyBeIGQ7IH1cclxuICAgICAgaWYgKHQgPCA2MCkgeyByZXR1cm4gKGIgJiBjKSB8IChiICYgZCkgfCAoYyAmIGQpOyB9XHJcbiAgICAgIHJldHVybiBiIF4gYyBeIGQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBEZXRlcm1pbmUgdGhlIGFwcHJvcHJpYXRlIGFkZGl0aXZlIGNvbnN0YW50IGZvciB0aGUgY3VycmVudCBpdGVyYXRpb25cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gc2hhMV9rdCh0KSB7XHJcbiAgICAgIHJldHVybiAodCA8IDIwKSA/ICAxNTE4NTAwMjQ5IDogKHQgPCA0MCkgPyAgMTg1OTc3NTM5MyA6XHJcbiAgICBcdFx0ICh0IDwgNjApID8gLTE4OTQwMDc1ODggOiAtODk5NDk3NTE0O1xyXG4gICAgfVxyXG4gIH0sXHJcbiAgLyoqXHJcbiAgICogQGNsYXNzIEhhc2hlcy5TSEEyNTZcclxuICAgKiBAcGFyYW0ge2NvbmZpZ31cclxuICAgKiBcclxuICAgKiBBIEphdmFTY3JpcHQgaW1wbGVtZW50YXRpb24gb2YgdGhlIFNlY3VyZSBIYXNoIEFsZ29yaXRobSwgU0hBLTI1NiwgYXMgZGVmaW5lZCBpbiBGSVBTIDE4MC0yXHJcbiAgICogVmVyc2lvbiAyLjIgQ29weXJpZ2h0IEFuZ2VsIE1hcmluLCBQYXVsIEpvaG5zdG9uIDIwMDAgLSAyMDA5LlxyXG4gICAqIE90aGVyIGNvbnRyaWJ1dG9yczogR3JlZyBIb2x0LCBBbmRyZXcgS2VwZXJ0LCBZZG5hciwgTG9zdGluZXRcclxuICAgKiBTZWUgaHR0cDovL3BhamhvbWUub3JnLnVrL2NyeXB0L21kNSBmb3IgZGV0YWlscy5cclxuICAgKiBBbHNvIGh0dHA6Ly9hbm1hci5ldS5vcmcvcHJvamVjdHMvanNzaGEyL1xyXG4gICAqL1xyXG4gIFNIQTI1NiA6IGZ1bmN0aW9uIChvcHRpb25zKSB7XHJcbiAgICAvKipcclxuICAgICAqIFByaXZhdGUgcHJvcGVydGllcyBjb25maWd1cmF0aW9uIHZhcmlhYmxlcy4gWW91IG1heSBuZWVkIHRvIHR3ZWFrIHRoZXNlIHRvIGJlIGNvbXBhdGlibGUgd2l0aFxyXG4gICAgICogdGhlIHNlcnZlci1zaWRlLCBidXQgdGhlIGRlZmF1bHRzIHdvcmsgaW4gbW9zdCBjYXNlcy5cclxuICAgICAqIEBzZWUgdGhpcy5zZXRVcHBlckNhc2UoKSBtZXRob2RcclxuICAgICAqIEBzZWUgdGhpcy5zZXRQYWQoKSBtZXRob2RcclxuICAgICAqL1xyXG4gICAgdmFyIGhleGNhc2UgPSAob3B0aW9ucyAmJiB0eXBlb2Ygb3B0aW9ucy51cHBlcmNhc2UgPT09ICdib29sZWFuJykgPyBvcHRpb25zLnVwcGVyY2FzZSA6IGZhbHNlLCAvLyBoZXhhZGVjaW1hbCBvdXRwdXQgY2FzZSBmb3JtYXQuIGZhbHNlIC0gbG93ZXJjYXNlOyB0cnVlIC0gdXBwZXJjYXNlICAqL1xyXG4gICAgICAgICAgICAgIGI2NHBhZCA9IChvcHRpb25zICYmIHR5cGVvZiBvcHRpb25zLnBhZCA9PT0gJ3N0cmluZycpID8gb3B0aW9ucy5wZGEgOiAnPScsIC8qIGJhc2UtNjQgcGFkIGNoYXJhY3Rlci4gRGVmYXVsdCAnPScgZm9yIHN0cmljdCBSRkMgY29tcGxpYW5jZSAgICovXHJcbiAgICAgICAgICAgICAgdXRmOCA9IChvcHRpb25zICYmIHR5cGVvZiBvcHRpb25zLnV0ZjggPT09ICdib29sZWFuJykgPyBvcHRpb25zLnV0ZjggOiB0cnVlLCAvKiBlbmFibGUvZGlzYWJsZSB1dGY4IGVuY29kaW5nICovXHJcbiAgICAgICAgICAgICAgc2hhMjU2X0s7XHJcblxyXG4gICAgLyogcHJpdmlsZWdlZCAocHVibGljKSBtZXRob2RzICovXHJcbiAgICB0aGlzLmhleCA9IGZ1bmN0aW9uIChzKSB7IFxyXG4gICAgICByZXR1cm4gcnN0cjJoZXgocnN0cihzLCB1dGY4KSk7IFxyXG4gICAgfTtcclxuICAgIHRoaXMuYjY0ID0gZnVuY3Rpb24gKHMpIHsgXHJcbiAgICAgIHJldHVybiByc3RyMmI2NChyc3RyKHMsIHV0ZjgpLCBiNjRwYWQpO1xyXG4gICAgfTtcclxuICAgIHRoaXMuYW55ID0gZnVuY3Rpb24gKHMsIGUpIHsgXHJcbiAgICAgIHJldHVybiByc3RyMmFueShyc3RyKHMsIHV0ZjgpLCBlKTsgXHJcbiAgICB9O1xyXG4gICAgdGhpcy5oZXhfaG1hYyA9IGZ1bmN0aW9uIChrLCBkKSB7IFxyXG4gICAgICByZXR1cm4gcnN0cjJoZXgocnN0cl9obWFjKGssIGQpKTsgXHJcbiAgICB9O1xyXG4gICAgdGhpcy5iNjRfaG1hYyA9IGZ1bmN0aW9uIChrLCBkKSB7IFxyXG4gICAgICByZXR1cm4gcnN0cjJiNjQocnN0cl9obWFjKGssIGQpLCBiNjRwYWQpO1xyXG4gICAgfTtcclxuICAgIHRoaXMuYW55X2htYWMgPSBmdW5jdGlvbiAoaywgZCwgZSkgeyBcclxuICAgICAgcmV0dXJuIHJzdHIyYW55KHJzdHJfaG1hYyhrLCBkKSwgZSk7IFxyXG4gICAgfTtcclxuICAgIC8qKlxyXG4gICAgICogUGVyZm9ybSBhIHNpbXBsZSBzZWxmLXRlc3QgdG8gc2VlIGlmIHRoZSBWTSBpcyB3b3JraW5nXHJcbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9IEhleGFkZWNpbWFsIGhhc2ggc2FtcGxlXHJcbiAgICAgKiBAcHVibGljXHJcbiAgICAgKi9cclxuICAgIHRoaXMudm1fdGVzdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgcmV0dXJuIGhleCgnYWJjJykudG9Mb3dlckNhc2UoKSA9PT0gJzkwMDE1MDk4M2NkMjRmYjBkNjk2M2Y3ZDI4ZTE3ZjcyJztcclxuICAgIH07XHJcbiAgICAvKiogXHJcbiAgICAgKiBFbmFibGUvZGlzYWJsZSB1cHBlcmNhc2UgaGV4YWRlY2ltYWwgcmV0dXJuZWQgc3RyaW5nIFxyXG4gICAgICogQHBhcmFtIHtib29sZWFufSBcclxuICAgICAqIEByZXR1cm4ge09iamVjdH0gdGhpc1xyXG4gICAgICogQHB1YmxpY1xyXG4gICAgICovIFxyXG4gICAgdGhpcy5zZXRVcHBlckNhc2UgPSBmdW5jdGlvbiAoYSkge1xyXG4gICAgICBpZiAodHlwZW9mIGEgPT09ICdib29sZWFuJykgeyBcclxuICAgICAgICBoZXhjYXNlID0gYTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gdGhpcztcclxuICAgIH07XHJcbiAgICAvKiogXHJcbiAgICAgKiBAZGVzY3JpcHRpb24gRGVmaW5lcyBhIGJhc2U2NCBwYWQgc3RyaW5nIFxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFBhZFxyXG4gICAgICogQHJldHVybiB7T2JqZWN0fSB0aGlzXHJcbiAgICAgKiBAcHVibGljXHJcbiAgICAgKi8gXHJcbiAgICB0aGlzLnNldFBhZCA9IGZ1bmN0aW9uIChhKSB7XHJcbiAgICAgIGI2NHBhZCA9IGEgfHwgYjY0cGFkO1xyXG4gICAgICByZXR1cm4gdGhpcztcclxuICAgIH07XHJcbiAgICAvKiogXHJcbiAgICAgKiBEZWZpbmVzIGEgYmFzZTY0IHBhZCBzdHJpbmcgXHJcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFxyXG4gICAgICogQHJldHVybiB7T2JqZWN0fSB0aGlzXHJcbiAgICAgKiBAcHVibGljXHJcbiAgICAgKi8gXHJcbiAgICB0aGlzLnNldFVURjggPSBmdW5jdGlvbiAoYSkge1xyXG4gICAgICBpZiAodHlwZW9mIGEgPT09ICdib29sZWFuJykge1xyXG4gICAgICAgIHV0ZjggPSBhO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLy8gcHJpdmF0ZSBtZXRob2RzXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxjdWxhdGUgdGhlIFNIQS01MTIgb2YgYSByYXcgc3RyaW5nXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIHJzdHIocywgdXRmOCkge1xyXG4gICAgICBzID0gKHV0ZjgpID8gdXRmOEVuY29kZShzKSA6IHM7XHJcbiAgICAgIHJldHVybiBiaW5iMnJzdHIoYmluYihyc3RyMmJpbmIocyksIHMubGVuZ3RoICogOCkpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2FsY3VsYXRlIHRoZSBITUFDLXNoYTI1NiBvZiBhIGtleSBhbmQgc29tZSBkYXRhIChyYXcgc3RyaW5ncylcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gcnN0cl9obWFjKGtleSwgZGF0YSkge1xyXG4gICAgICBrZXkgPSAodXRmOCkgPyB1dGY4RW5jb2RlKGtleSkgOiBrZXk7XHJcbiAgICAgIGRhdGEgPSAodXRmOCkgPyB1dGY4RW5jb2RlKGRhdGEpIDogZGF0YTtcclxuICAgICAgdmFyIGhhc2gsIGkgPSAwLFxyXG4gICAgICAgICAgYmtleSA9IHJzdHIyYmluYihrZXkpLCBcclxuICAgICAgICAgIGlwYWQgPSBBcnJheSgxNiksIFxyXG4gICAgICAgICAgb3BhZCA9IEFycmF5KDE2KTtcclxuXHJcbiAgICAgIGlmIChia2V5Lmxlbmd0aCA+IDE2KSB7IGJrZXkgPSBiaW5iKGJrZXksIGtleS5sZW5ndGggKiA4KTsgfVxyXG4gICAgICBcclxuICAgICAgZm9yICg7IGkgPCAxNjsgaSs9MSkge1xyXG4gICAgICAgIGlwYWRbaV0gPSBia2V5W2ldIF4gMHgzNjM2MzYzNjtcclxuICAgICAgICBvcGFkW2ldID0gYmtleVtpXSBeIDB4NUM1QzVDNUM7XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIGhhc2ggPSBiaW5iKGlwYWQuY29uY2F0KHJzdHIyYmluYihkYXRhKSksIDUxMiArIGRhdGEubGVuZ3RoICogOCk7XHJcbiAgICAgIHJldHVybiBiaW5iMnJzdHIoYmluYihvcGFkLmNvbmNhdChoYXNoKSwgNTEyICsgMjU2KSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8qXHJcbiAgICAgKiBNYWluIHNoYTI1NiBmdW5jdGlvbiwgd2l0aCBpdHMgc3VwcG9ydCBmdW5jdGlvbnNcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gc2hhMjU2X1MgKFgsIG4pIHtyZXR1cm4gKCBYID4+PiBuICkgfCAoWCA8PCAoMzIgLSBuKSk7fVxyXG4gICAgZnVuY3Rpb24gc2hhMjU2X1IgKFgsIG4pIHtyZXR1cm4gKCBYID4+PiBuICk7fVxyXG4gICAgZnVuY3Rpb24gc2hhMjU2X0NoKHgsIHksIHopIHtyZXR1cm4gKCh4ICYgeSkgXiAoKH54KSAmIHopKTt9XHJcbiAgICBmdW5jdGlvbiBzaGEyNTZfTWFqKHgsIHksIHopIHtyZXR1cm4gKCh4ICYgeSkgXiAoeCAmIHopIF4gKHkgJiB6KSk7fVxyXG4gICAgZnVuY3Rpb24gc2hhMjU2X1NpZ21hMDI1Nih4KSB7cmV0dXJuIChzaGEyNTZfUyh4LCAyKSBeIHNoYTI1Nl9TKHgsIDEzKSBeIHNoYTI1Nl9TKHgsIDIyKSk7fVxyXG4gICAgZnVuY3Rpb24gc2hhMjU2X1NpZ21hMTI1Nih4KSB7cmV0dXJuIChzaGEyNTZfUyh4LCA2KSBeIHNoYTI1Nl9TKHgsIDExKSBeIHNoYTI1Nl9TKHgsIDI1KSk7fVxyXG4gICAgZnVuY3Rpb24gc2hhMjU2X0dhbW1hMDI1Nih4KSB7cmV0dXJuIChzaGEyNTZfUyh4LCA3KSBeIHNoYTI1Nl9TKHgsIDE4KSBeIHNoYTI1Nl9SKHgsIDMpKTt9XHJcbiAgICBmdW5jdGlvbiBzaGEyNTZfR2FtbWExMjU2KHgpIHtyZXR1cm4gKHNoYTI1Nl9TKHgsIDE3KSBeIHNoYTI1Nl9TKHgsIDE5KSBeIHNoYTI1Nl9SKHgsIDEwKSk7fVxyXG4gICAgZnVuY3Rpb24gc2hhMjU2X1NpZ21hMDUxMih4KSB7cmV0dXJuIChzaGEyNTZfUyh4LCAyOCkgXiBzaGEyNTZfUyh4LCAzNCkgXiBzaGEyNTZfUyh4LCAzOSkpO31cclxuICAgIGZ1bmN0aW9uIHNoYTI1Nl9TaWdtYTE1MTIoeCkge3JldHVybiAoc2hhMjU2X1MoeCwgMTQpIF4gc2hhMjU2X1MoeCwgMTgpIF4gc2hhMjU2X1MoeCwgNDEpKTt9XHJcbiAgICBmdW5jdGlvbiBzaGEyNTZfR2FtbWEwNTEyKHgpIHtyZXR1cm4gKHNoYTI1Nl9TKHgsIDEpICBeIHNoYTI1Nl9TKHgsIDgpIF4gc2hhMjU2X1IoeCwgNykpO31cclxuICAgIGZ1bmN0aW9uIHNoYTI1Nl9HYW1tYTE1MTIoeCkge3JldHVybiAoc2hhMjU2X1MoeCwgMTkpIF4gc2hhMjU2X1MoeCwgNjEpIF4gc2hhMjU2X1IoeCwgNikpO31cclxuICAgIFxyXG4gICAgc2hhMjU2X0sgPSBuZXcgQXJyYXlcclxuICAgIChcclxuICAgICAgMTExNjM1MjQwOCwgMTg5OTQ0NzQ0MSwgLTEyNDU2NDM4MjUsIC0zNzM5NTc3MjMsIDk2MTk4NzE2MywgMTUwODk3MDk5MyxcclxuICAgICAgLTE4NDEzMzE1NDgsIC0xNDI0MjA0MDc1LCAtNjcwNTg2MjE2LCAzMTA1OTg0MDEsIDYwNzIyNTI3OCwgMTQyNjg4MTk4NyxcclxuICAgICAgMTkyNTA3ODM4OCwgLTIxMzI4ODkwOTAsIC0xNjgwMDc5MTkzLCAtMTA0Njc0NDcxNiwgLTQ1OTU3Njg5NSwgLTI3Mjc0MjUyMixcclxuICAgICAgMjY0MzQ3MDc4LCA2MDQ4MDc2MjgsIDc3MDI1NTk4MywgMTI0OTE1MDEyMiwgMTU1NTA4MTY5MiwgMTk5NjA2NDk4NixcclxuICAgICAgLTE3NDA3NDY0MTQsIC0xNDczMTMyOTQ3LCAtMTM0MTk3MDQ4OCwgLTEwODQ2NTM2MjUsIC05NTgzOTU0MDUsIC03MTA0Mzg1ODUsXHJcbiAgICAgIDExMzkyNjk5MywgMzM4MjQxODk1LCA2NjYzMDcyMDUsIDc3MzUyOTkxMiwgMTI5NDc1NzM3MiwgMTM5NjE4MjI5MSxcclxuICAgICAgMTY5NTE4MzcwMCwgMTk4NjY2MTA1MSwgLTIxMTc5NDA5NDYsIC0xODM4MDExMjU5LCAtMTU2NDQ4MTM3NSwgLTE0NzQ2NjQ4ODUsXHJcbiAgICAgIC0xMDM1MjM2NDk2LCAtOTQ5MjAyNTI1LCAtNzc4OTAxNDc5LCAtNjk0NjE0NDkyLCAtMjAwMzk1Mzg3LCAyNzU0MjMzNDQsXHJcbiAgICAgIDQzMDIyNzczNCwgNTA2OTQ4NjE2LCA2NTkwNjA1NTYsIDg4Mzk5Nzg3NywgOTU4MTM5NTcxLCAxMzIyODIyMjE4LFxyXG4gICAgICAxNTM3MDAyMDYzLCAxNzQ3ODczNzc5LCAxOTU1NTYyMjIyLCAyMDI0MTA0ODE1LCAtMjA2NzIzNjg0NCwgLTE5MzMxMTQ4NzIsXHJcbiAgICAgIC0xODY2NTMwODIyLCAtMTUzODIzMzEwOSwgLTEwOTA5MzU4MTcsIC05NjU2NDE5OThcclxuICAgICk7XHJcbiAgICBcclxuICAgIGZ1bmN0aW9uIGJpbmIobSwgbCkge1xyXG4gICAgICB2YXIgSEFTSCA9IG5ldyBBcnJheSgxNzc5MDMzNzAzLCAtMTE1MDgzMzAxOSwgMTAxMzkwNDI0MiwgLTE1MjE0ODY1MzQsXHJcbiAgICAgICAgICAgICAgICAgMTM1OTg5MzExOSwgLTE2OTQxNDQzNzIsIDUyODczNDYzNSwgMTU0MTQ1OTIyNSk7XHJcbiAgICAgIHZhciBXID0gbmV3IEFycmF5KDY0KTtcclxuICAgICAgdmFyIGEsIGIsIGMsIGQsIGUsIGYsIGcsIGg7XHJcbiAgICAgIHZhciBpLCBqLCBUMSwgVDI7XHJcbiAgICBcclxuICAgICAgLyogYXBwZW5kIHBhZGRpbmcgKi9cclxuICAgICAgbVtsID4+IDVdIHw9IDB4ODAgPDwgKDI0IC0gbCAlIDMyKTtcclxuICAgICAgbVsoKGwgKyA2NCA+PiA5KSA8PCA0KSArIDE1XSA9IGw7XHJcbiAgICBcclxuICAgICAgZm9yIChpID0gMDsgaSA8IG0ubGVuZ3RoOyBpICs9IDE2KVxyXG4gICAgICB7XHJcbiAgICAgIGEgPSBIQVNIWzBdO1xyXG4gICAgICBiID0gSEFTSFsxXTtcclxuICAgICAgYyA9IEhBU0hbMl07XHJcbiAgICAgIGQgPSBIQVNIWzNdO1xyXG4gICAgICBlID0gSEFTSFs0XTtcclxuICAgICAgZiA9IEhBU0hbNV07XHJcbiAgICAgIGcgPSBIQVNIWzZdO1xyXG4gICAgICBoID0gSEFTSFs3XTtcclxuICAgIFxyXG4gICAgICBmb3IgKGogPSAwOyBqIDwgNjQ7IGorKylcclxuICAgICAge1xyXG4gICAgICAgIGlmIChqIDwgMTYpIHsgXHJcbiAgICAgICAgICBXW2pdID0gbVtqICsgaV07XHJcbiAgICAgICAgfSBlbHNlIHsgXHJcbiAgICAgICAgICBXW2pdID0gc2FmZV9hZGQoc2FmZV9hZGQoc2FmZV9hZGQoc2hhMjU2X0dhbW1hMTI1NihXW2ogLSAyXSksIFdbaiAtIDddKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBzaGEyNTZfR2FtbWEwMjU2KFdbaiAtIDE1XSkpLCBXW2ogLSAxNl0pO1xyXG4gICAgICAgIH1cclxuICAgIFxyXG4gICAgICAgIFQxID0gc2FmZV9hZGQoc2FmZV9hZGQoc2FmZV9hZGQoc2FmZV9hZGQoaCwgc2hhMjU2X1NpZ21hMTI1NihlKSksIHNoYTI1Nl9DaChlLCBmLCBnKSksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaGEyNTZfS1tqXSksIFdbal0pO1xyXG4gICAgICAgIFQyID0gc2FmZV9hZGQoc2hhMjU2X1NpZ21hMDI1NihhKSwgc2hhMjU2X01haihhLCBiLCBjKSk7XHJcbiAgICAgICAgaCA9IGc7XHJcbiAgICAgICAgZyA9IGY7XHJcbiAgICAgICAgZiA9IGU7XHJcbiAgICAgICAgZSA9IHNhZmVfYWRkKGQsIFQxKTtcclxuICAgICAgICBkID0gYztcclxuICAgICAgICBjID0gYjtcclxuICAgICAgICBiID0gYTtcclxuICAgICAgICBhID0gc2FmZV9hZGQoVDEsIFQyKTtcclxuICAgICAgfVxyXG4gICAgXHJcbiAgICAgIEhBU0hbMF0gPSBzYWZlX2FkZChhLCBIQVNIWzBdKTtcclxuICAgICAgSEFTSFsxXSA9IHNhZmVfYWRkKGIsIEhBU0hbMV0pO1xyXG4gICAgICBIQVNIWzJdID0gc2FmZV9hZGQoYywgSEFTSFsyXSk7XHJcbiAgICAgIEhBU0hbM10gPSBzYWZlX2FkZChkLCBIQVNIWzNdKTtcclxuICAgICAgSEFTSFs0XSA9IHNhZmVfYWRkKGUsIEhBU0hbNF0pO1xyXG4gICAgICBIQVNIWzVdID0gc2FmZV9hZGQoZiwgSEFTSFs1XSk7XHJcbiAgICAgIEhBU0hbNl0gPSBzYWZlX2FkZChnLCBIQVNIWzZdKTtcclxuICAgICAgSEFTSFs3XSA9IHNhZmVfYWRkKGgsIEhBU0hbN10pO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBIQVNIO1xyXG4gICAgfVxyXG5cclxuICB9LFxyXG5cclxuICAvKipcclxuICAgKiBAY2xhc3MgSGFzaGVzLlNIQTUxMlxyXG4gICAqIEBwYXJhbSB7Y29uZmlnfVxyXG4gICAqIFxyXG4gICAqIEEgSmF2YVNjcmlwdCBpbXBsZW1lbnRhdGlvbiBvZiB0aGUgU2VjdXJlIEhhc2ggQWxnb3JpdGhtLCBTSEEtNTEyLCBhcyBkZWZpbmVkIGluIEZJUFMgMTgwLTJcclxuICAgKiBWZXJzaW9uIDIuMiBDb3B5cmlnaHQgQW5vbnltb3VzIENvbnRyaWJ1dG9yLCBQYXVsIEpvaG5zdG9uIDIwMDAgLSAyMDA5LlxyXG4gICAqIE90aGVyIGNvbnRyaWJ1dG9yczogR3JlZyBIb2x0LCBBbmRyZXcgS2VwZXJ0LCBZZG5hciwgTG9zdGluZXRcclxuICAgKiBTZWUgaHR0cDovL3BhamhvbWUub3JnLnVrL2NyeXB0L21kNSBmb3IgZGV0YWlscy4gXHJcbiAgICovXHJcbiAgU0hBNTEyIDogZnVuY3Rpb24gKG9wdGlvbnMpIHtcclxuICAgIC8qKlxyXG4gICAgICogUHJpdmF0ZSBwcm9wZXJ0aWVzIGNvbmZpZ3VyYXRpb24gdmFyaWFibGVzLiBZb3UgbWF5IG5lZWQgdG8gdHdlYWsgdGhlc2UgdG8gYmUgY29tcGF0aWJsZSB3aXRoXHJcbiAgICAgKiB0aGUgc2VydmVyLXNpZGUsIGJ1dCB0aGUgZGVmYXVsdHMgd29yayBpbiBtb3N0IGNhc2VzLlxyXG4gICAgICogQHNlZSB0aGlzLnNldFVwcGVyQ2FzZSgpIG1ldGhvZFxyXG4gICAgICogQHNlZSB0aGlzLnNldFBhZCgpIG1ldGhvZFxyXG4gICAgICovXHJcbiAgICB2YXIgaGV4Y2FzZSA9IChvcHRpb25zICYmIHR5cGVvZiBvcHRpb25zLnVwcGVyY2FzZSA9PT0gJ2Jvb2xlYW4nKSA/IG9wdGlvbnMudXBwZXJjYXNlIDogZmFsc2UgLCAvKiBoZXhhZGVjaW1hbCBvdXRwdXQgY2FzZSBmb3JtYXQuIGZhbHNlIC0gbG93ZXJjYXNlOyB0cnVlIC0gdXBwZXJjYXNlICAqL1xyXG4gICAgICAgIGI2NHBhZCA9IChvcHRpb25zICYmIHR5cGVvZiBvcHRpb25zLnBhZCA9PT0gJ3N0cmluZycpID8gb3B0aW9ucy5wZGEgOiAnPScsICAvKiBiYXNlLTY0IHBhZCBjaGFyYWN0ZXIuIERlZmF1bHQgJz0nIGZvciBzdHJpY3QgUkZDIGNvbXBsaWFuY2UgICAqL1xyXG4gICAgICAgIHV0ZjggPSAob3B0aW9ucyAmJiB0eXBlb2Ygb3B0aW9ucy51dGY4ID09PSAnYm9vbGVhbicpID8gb3B0aW9ucy51dGY4IDogdHJ1ZSwgLyogZW5hYmxlL2Rpc2FibGUgdXRmOCBlbmNvZGluZyAqL1xyXG4gICAgICAgIHNoYTUxMl9rO1xyXG5cclxuICAgIC8qIHByaXZpbGVnZWQgKHB1YmxpYykgbWV0aG9kcyAqL1xyXG4gICAgdGhpcy5oZXggPSBmdW5jdGlvbiAocykgeyBcclxuICAgICAgcmV0dXJuIHJzdHIyaGV4KHJzdHIocykpOyBcclxuICAgIH07XHJcbiAgICB0aGlzLmI2NCA9IGZ1bmN0aW9uIChzKSB7IFxyXG4gICAgICByZXR1cm4gcnN0cjJiNjQocnN0cihzKSwgYjY0cGFkKTsgIFxyXG4gICAgfTtcclxuICAgIHRoaXMuYW55ID0gZnVuY3Rpb24gKHMsIGUpIHsgXHJcbiAgICAgIHJldHVybiByc3RyMmFueShyc3RyKHMpLCBlKTtcclxuICAgIH07XHJcbiAgICB0aGlzLmhleF9obWFjID0gZnVuY3Rpb24gKGssIGQpIHtcclxuICAgICAgcmV0dXJuIHJzdHIyaGV4KHJzdHJfaG1hYyhrLCBkKSk7XHJcbiAgICB9O1xyXG4gICAgdGhpcy5iNjRfaG1hYyA9IGZ1bmN0aW9uIChrLCBkKSB7IFxyXG4gICAgICByZXR1cm4gcnN0cjJiNjQocnN0cl9obWFjKGssIGQpLCBiNjRwYWQpO1xyXG4gICAgfTtcclxuICAgIHRoaXMuYW55X2htYWMgPSBmdW5jdGlvbiAoaywgZCwgZSkgeyBcclxuICAgICAgcmV0dXJuIHJzdHIyYW55KHJzdHJfaG1hYyhrLCBkKSwgZSk7XHJcbiAgICB9O1xyXG4gICAgLyoqXHJcbiAgICAgKiBQZXJmb3JtIGEgc2ltcGxlIHNlbGYtdGVzdCB0byBzZWUgaWYgdGhlIFZNIGlzIHdvcmtpbmdcclxuICAgICAqIEByZXR1cm4ge1N0cmluZ30gSGV4YWRlY2ltYWwgaGFzaCBzYW1wbGVcclxuICAgICAqIEBwdWJsaWNcclxuICAgICAqL1xyXG4gICAgdGhpcy52bV90ZXN0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICByZXR1cm4gaGV4KCdhYmMnKS50b0xvd2VyQ2FzZSgpID09PSAnOTAwMTUwOTgzY2QyNGZiMGQ2OTYzZjdkMjhlMTdmNzInO1xyXG4gICAgfTtcclxuICAgIC8qKiBcclxuICAgICAqIEBkZXNjcmlwdGlvbiBFbmFibGUvZGlzYWJsZSB1cHBlcmNhc2UgaGV4YWRlY2ltYWwgcmV0dXJuZWQgc3RyaW5nIFxyXG4gICAgICogQHBhcmFtIHtib29sZWFufSBcclxuICAgICAqIEByZXR1cm4ge09iamVjdH0gdGhpc1xyXG4gICAgICogQHB1YmxpY1xyXG4gICAgICovIFxyXG4gICAgdGhpcy5zZXRVcHBlckNhc2UgPSBmdW5jdGlvbiAoYSkge1xyXG4gICAgICBpZiAodHlwZW9mIGEgPT09ICdib29sZWFuJykge1xyXG4gICAgICAgIGhleGNhc2UgPSBhO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfTtcclxuICAgIC8qKiBcclxuICAgICAqIEBkZXNjcmlwdGlvbiBEZWZpbmVzIGEgYmFzZTY0IHBhZCBzdHJpbmcgXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gUGFkXHJcbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9IHRoaXNcclxuICAgICAqIEBwdWJsaWNcclxuICAgICAqLyBcclxuICAgIHRoaXMuc2V0UGFkID0gZnVuY3Rpb24gKGEpIHtcclxuICAgICAgYjY0cGFkID0gYSB8fCBiNjRwYWQ7XHJcbiAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfTtcclxuICAgIC8qKiBcclxuICAgICAqIEBkZXNjcmlwdGlvbiBEZWZpbmVzIGEgYmFzZTY0IHBhZCBzdHJpbmcgXHJcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFxyXG4gICAgICogQHJldHVybiB7T2JqZWN0fSB0aGlzXHJcbiAgICAgKiBAcHVibGljXHJcbiAgICAgKi8gXHJcbiAgICB0aGlzLnNldFVURjggPSBmdW5jdGlvbiAoYSkge1xyXG4gICAgICBpZiAodHlwZW9mIGEgPT09ICdib29sZWFuJykge1xyXG4gICAgICAgIHV0ZjggPSBhO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfTtcclxuXHJcbiAgICAvKiBwcml2YXRlIG1ldGhvZHMgKi9cclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxjdWxhdGUgdGhlIFNIQS01MTIgb2YgYSByYXcgc3RyaW5nXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIHJzdHIocykge1xyXG4gICAgICBzID0gKHV0ZjgpID8gdXRmOEVuY29kZShzKSA6IHM7XHJcbiAgICAgIHJldHVybiBiaW5iMnJzdHIoYmluYihyc3RyMmJpbmIocyksIHMubGVuZ3RoICogOCkpO1xyXG4gICAgfVxyXG4gICAgLypcclxuICAgICAqIENhbGN1bGF0ZSB0aGUgSE1BQy1TSEEtNTEyIG9mIGEga2V5IGFuZCBzb21lIGRhdGEgKHJhdyBzdHJpbmdzKVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiByc3RyX2htYWMoa2V5LCBkYXRhKSB7XHJcbiAgICAgIGtleSA9ICh1dGY4KSA/IHV0ZjhFbmNvZGUoa2V5KSA6IGtleTtcclxuICAgICAgZGF0YSA9ICh1dGY4KSA/IHV0ZjhFbmNvZGUoZGF0YSkgOiBkYXRhO1xyXG4gICAgICBcclxuICAgICAgdmFyIGhhc2gsIGkgPSAwLCBcclxuICAgICAgICAgIGJrZXkgPSByc3RyMmJpbmIoa2V5KSxcclxuICAgICAgICAgIGlwYWQgPSBBcnJheSgzMiksIG9wYWQgPSBBcnJheSgzMik7XHJcblxyXG4gICAgICBpZiAoYmtleS5sZW5ndGggPiAzMikgeyBia2V5ID0gYmluYihia2V5LCBrZXkubGVuZ3RoICogOCk7IH1cclxuICAgICAgXHJcbiAgICAgIGZvciAoOyBpIDwgMzI7IGkrPTEpIHtcclxuICAgICAgICBpcGFkW2ldID0gYmtleVtpXSBeIDB4MzYzNjM2MzY7XHJcbiAgICAgICAgb3BhZFtpXSA9IGJrZXlbaV0gXiAweDVDNUM1QzVDO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICBoYXNoID0gYmluYihpcGFkLmNvbmNhdChyc3RyMmJpbmIoZGF0YSkpLCAxMDI0ICsgZGF0YS5sZW5ndGggKiA4KTtcclxuICAgICAgcmV0dXJuIGJpbmIycnN0cihiaW5iKG9wYWQuY29uY2F0KGhhc2gpLCAxMDI0ICsgNTEyKSk7XHJcbiAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBDYWxjdWxhdGUgdGhlIFNIQS01MTIgb2YgYW4gYXJyYXkgb2YgYmlnLWVuZGlhbiBkd29yZHMsIGFuZCBhIGJpdCBsZW5ndGhcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gYmluYih4LCBsZW4pIHtcclxuICAgICAgdmFyIGosIGksIFxyXG4gICAgICAgICAgVyA9IG5ldyBBcnJheSg4MCk7XHJcbiAgICAgICAgICBoYXNoID0gbmV3IEFycmF5KDE2KSxcclxuICAgICAgICAgIC8vSW5pdGlhbCBoYXNoIHZhbHVlc1xyXG4gICAgICAgICAgSCA9IG5ldyBBcnJheShcclxuICAgICAgICAgICAgbmV3IGludDY0KDB4NmEwOWU2NjcsIC0yMDU3MzE1NzYpLFxyXG4gICAgICAgICAgICBuZXcgaW50NjQoLTExNTA4MzMwMTksIC0yMDY3MDkzNzAxKSxcclxuICAgICAgICAgICAgbmV3IGludDY0KDB4M2M2ZWYzNzIsIC0yMzc5MTU3MyksXHJcbiAgICAgICAgICAgIG5ldyBpbnQ2NCgtMTUyMTQ4NjUzNCwgMHg1ZjFkMzZmMSksXHJcbiAgICAgICAgICAgIG5ldyBpbnQ2NCgweDUxMGU1MjdmLCAtMTM3NzQwMjE1OSksXHJcbiAgICAgICAgICAgIG5ldyBpbnQ2NCgtMTY5NDE0NDM3MiwgMHgyYjNlNmMxZiksXHJcbiAgICAgICAgICAgIG5ldyBpbnQ2NCgweDFmODNkOWFiLCAtNzk1Nzc3NDkpLFxyXG4gICAgICAgICAgICBuZXcgaW50NjQoMHg1YmUwY2QxOSwgMHgxMzdlMjE3OSlcclxuICAgICAgICAgICksXHJcbiAgICAgICAgICBUMSA9IG5ldyBpbnQ2NCgwLCAwKSxcclxuICAgICAgICAgIFQyID0gbmV3IGludDY0KDAsIDApLFxyXG4gICAgICAgICAgYSA9IG5ldyBpbnQ2NCgwLDApLFxyXG4gICAgICAgICAgYiA9IG5ldyBpbnQ2NCgwLDApLFxyXG4gICAgICAgICAgYyA9IG5ldyBpbnQ2NCgwLDApLFxyXG4gICAgICAgICAgZCA9IG5ldyBpbnQ2NCgwLDApLFxyXG4gICAgICAgICAgZSA9IG5ldyBpbnQ2NCgwLDApLFxyXG4gICAgICAgICAgZiA9IG5ldyBpbnQ2NCgwLDApLFxyXG4gICAgICAgICAgZyA9IG5ldyBpbnQ2NCgwLDApLFxyXG4gICAgICAgICAgaCA9IG5ldyBpbnQ2NCgwLDApLFxyXG4gICAgICAgICAgLy9UZW1wb3JhcnkgdmFyaWFibGVzIG5vdCBzcGVjaWZpZWQgYnkgdGhlIGRvY3VtZW50XHJcbiAgICAgICAgICBzMCA9IG5ldyBpbnQ2NCgwLCAwKSxcclxuICAgICAgICAgIHMxID0gbmV3IGludDY0KDAsIDApLFxyXG4gICAgICAgICAgQ2ggPSBuZXcgaW50NjQoMCwgMCksXHJcbiAgICAgICAgICBNYWogPSBuZXcgaW50NjQoMCwgMCksXHJcbiAgICAgICAgICByMSA9IG5ldyBpbnQ2NCgwLCAwKSxcclxuICAgICAgICAgIHIyID0gbmV3IGludDY0KDAsIDApLFxyXG4gICAgICAgICAgcjMgPSBuZXcgaW50NjQoMCwgMCk7XHJcblxyXG4gICAgICBpZiAoc2hhNTEyX2sgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgLy9TSEE1MTIgY29uc3RhbnRzXHJcbiAgICAgICAgICBzaGE1MTJfayA9IG5ldyBBcnJheShcclxuICAgICAgICAgICAgbmV3IGludDY0KDB4NDI4YTJmOTgsIC02ODUxOTk4MzgpLCBuZXcgaW50NjQoMHg3MTM3NDQ5MSwgMHgyM2VmNjVjZCksXHJcbiAgICAgICAgICAgIG5ldyBpbnQ2NCgtMTI0NTY0MzgyNSwgLTMzMDQ4Mjg5NyksIG5ldyBpbnQ2NCgtMzczOTU3NzIzLCAtMjEyMTY3MTc0OCksXHJcbiAgICAgICAgICAgIG5ldyBpbnQ2NCgweDM5NTZjMjViLCAtMjEzMzM4ODI0KSwgbmV3IGludDY0KDB4NTlmMTExZjEsIC0xMjQxMTMzMDMxKSxcclxuICAgICAgICAgICAgbmV3IGludDY0KC0xODQxMzMxNTQ4LCAtMTM1NzI5NTcxNyksIG5ldyBpbnQ2NCgtMTQyNDIwNDA3NSwgLTYzMDM1NzczNiksXHJcbiAgICAgICAgICAgIG5ldyBpbnQ2NCgtNjcwNTg2MjE2LCAtMTU2MDA4MzkwMiksIG5ldyBpbnQ2NCgweDEyODM1YjAxLCAweDQ1NzA2ZmJlKSxcclxuICAgICAgICAgICAgbmV3IGludDY0KDB4MjQzMTg1YmUsIDB4NGVlNGIyOGMpLCBuZXcgaW50NjQoMHg1NTBjN2RjMywgLTcwNDY2MjMwMiksXHJcbiAgICAgICAgICAgIG5ldyBpbnQ2NCgweDcyYmU1ZDc0LCAtMjI2Nzg0OTEzKSwgbmV3IGludDY0KC0yMTMyODg5MDkwLCAweDNiMTY5NmIxKSxcclxuICAgICAgICAgICAgbmV3IGludDY0KC0xNjgwMDc5MTkzLCAweDI1YzcxMjM1KSwgbmV3IGludDY0KC0xMDQ2NzQ0NzE2LCAtODE1MTkyNDI4KSxcclxuICAgICAgICAgICAgbmV3IGludDY0KC00NTk1NzY4OTUsIC0xNjI4MzUzODM4KSwgbmV3IGludDY0KC0yNzI3NDI1MjIsIDB4Mzg0ZjI1ZTMpLFxyXG4gICAgICAgICAgICBuZXcgaW50NjQoMHhmYzE5ZGM2LCAtMTk1MzcwNDUyMyksIG5ldyBpbnQ2NCgweDI0MGNhMWNjLCAweDc3YWM5YzY1KSxcclxuICAgICAgICAgICAgbmV3IGludDY0KDB4MmRlOTJjNmYsIDB4NTkyYjAyNzUpLCBuZXcgaW50NjQoMHg0YTc0ODRhYSwgMHg2ZWE2ZTQ4MyksXHJcbiAgICAgICAgICAgIG5ldyBpbnQ2NCgweDVjYjBhOWRjLCAtMTExOTc0OTE2NCksIG5ldyBpbnQ2NCgweDc2Zjk4OGRhLCAtMjA5NjAxNjQ1OSksXHJcbiAgICAgICAgICAgIG5ldyBpbnQ2NCgtMTc0MDc0NjQxNCwgLTI5NTI0Nzk1NyksIG5ldyBpbnQ2NCgtMTQ3MzEzMjk0NywgMHgyZGI0MzIxMCksXHJcbiAgICAgICAgICAgIG5ldyBpbnQ2NCgtMTM0MTk3MDQ4OCwgLTE3MjgzNzI0MTcpLCBuZXcgaW50NjQoLTEwODQ2NTM2MjUsIC0xMDkxNjI5MzQwKSxcclxuICAgICAgICAgICAgbmV3IGludDY0KC05NTgzOTU0MDUsIDB4M2RhODhmYzIpLCBuZXcgaW50NjQoLTcxMDQzODU4NSwgLTE4MjgwMTgzOTUpLFxyXG4gICAgICAgICAgICBuZXcgaW50NjQoMHg2Y2E2MzUxLCAtNTM2NjQwOTEzKSwgbmV3IGludDY0KDB4MTQyOTI5NjcsIDB4YTBlNmU3MCksXHJcbiAgICAgICAgICAgIG5ldyBpbnQ2NCgweDI3YjcwYTg1LCAweDQ2ZDIyZmZjKSwgbmV3IGludDY0KDB4MmUxYjIxMzgsIDB4NWMyNmM5MjYpLFxyXG4gICAgICAgICAgICBuZXcgaW50NjQoMHg0ZDJjNmRmYywgMHg1YWM0MmFlZCksIG5ldyBpbnQ2NCgweDUzMzgwZDEzLCAtMTY1MTEzMzQ3MyksXHJcbiAgICAgICAgICAgIG5ldyBpbnQ2NCgweDY1MGE3MzU0LCAtMTk1MTQzOTkwNiksIG5ldyBpbnQ2NCgweDc2NmEwYWJiLCAweDNjNzdiMmE4KSxcclxuICAgICAgICAgICAgbmV3IGludDY0KC0yMTE3OTQwOTQ2LCAweDQ3ZWRhZWU2KSwgbmV3IGludDY0KC0xODM4MDExMjU5LCAweDE0ODIzNTNiKSxcclxuICAgICAgICAgICAgbmV3IGludDY0KC0xNTY0NDgxMzc1LCAweDRjZjEwMzY0KSwgbmV3IGludDY0KC0xNDc0NjY0ODg1LCAtMTEzNjUxMzAyMyksXHJcbiAgICAgICAgICAgIG5ldyBpbnQ2NCgtMTAzNTIzNjQ5NiwgLTc4OTAxNDYzOSksIG5ldyBpbnQ2NCgtOTQ5MjAyNTI1LCAweDY1NGJlMzApLFxyXG4gICAgICAgICAgICBuZXcgaW50NjQoLTc3ODkwMTQ3OSwgLTY4ODk1ODk1MiksIG5ldyBpbnQ2NCgtNjk0NjE0NDkyLCAweDU1NjVhOTEwKSxcclxuICAgICAgICAgICAgbmV3IGludDY0KC0yMDAzOTUzODcsIDB4NTc3MTIwMmEpLCBuZXcgaW50NjQoMHgxMDZhYTA3MCwgMHgzMmJiZDFiOCksXHJcbiAgICAgICAgICAgIG5ldyBpbnQ2NCgweDE5YTRjMTE2LCAtMTE5NDE0MzU0NCksIG5ldyBpbnQ2NCgweDFlMzc2YzA4LCAweDUxNDFhYjUzKSxcclxuICAgICAgICAgICAgbmV3IGludDY0KDB4Mjc0ODc3NGMsIC01NDQyODE3MDMpLCBuZXcgaW50NjQoMHgzNGIwYmNiNSwgLTUwOTkxNzAxNiksXHJcbiAgICAgICAgICAgIG5ldyBpbnQ2NCgweDM5MWMwY2IzLCAtOTc2NjU5ODY5KSwgbmV3IGludDY0KDB4NGVkOGFhNGEsIC00ODIyNDM4OTMpLFxyXG4gICAgICAgICAgICBuZXcgaW50NjQoMHg1YjljY2E0ZiwgMHg3NzYzZTM3MyksIG5ldyBpbnQ2NCgweDY4MmU2ZmYzLCAtNjkyOTMwMzk3KSxcclxuICAgICAgICAgICAgbmV3IGludDY0KDB4NzQ4ZjgyZWUsIDB4NWRlZmIyZmMpLCBuZXcgaW50NjQoMHg3OGE1NjM2ZiwgMHg0MzE3MmY2MCksXHJcbiAgICAgICAgICAgIG5ldyBpbnQ2NCgtMjA2NzIzNjg0NCwgLTE1NzgwNjI5OTApLCBuZXcgaW50NjQoLTE5MzMxMTQ4NzIsIDB4MWE2NDM5ZWMpLFxyXG4gICAgICAgICAgICBuZXcgaW50NjQoLTE4NjY1MzA4MjIsIDB4MjM2MzFlMjgpLCBuZXcgaW50NjQoLTE1MzgyMzMxMDksIC01NjE4NTcwNDcpLFxyXG4gICAgICAgICAgICBuZXcgaW50NjQoLTEwOTA5MzU4MTcsIC0xMjk1NjE1NzIzKSwgbmV3IGludDY0KC05NjU2NDE5OTgsIC00NzkwNDY4NjkpLFxyXG4gICAgICAgICAgICBuZXcgaW50NjQoLTkwMzM5NzY4MiwgLTM2NjU4MzM5NiksIG5ldyBpbnQ2NCgtNzc5NzAwMDI1LCAweDIxYzBjMjA3KSxcclxuICAgICAgICAgICAgbmV3IGludDY0KC0zNTQ3Nzk2OTAsIC04NDA4OTc3NjIpLCBuZXcgaW50NjQoLTE3NjMzNzAyNSwgLTI5NDcyNzMwNCksXHJcbiAgICAgICAgICAgIG5ldyBpbnQ2NCgweDZmMDY3YWEsIDB4NzIxNzZmYmEpLCBuZXcgaW50NjQoMHhhNjM3ZGM1LCAtMTU2MzkxMjAyNiksXHJcbiAgICAgICAgICAgIG5ldyBpbnQ2NCgweDExM2Y5ODA0LCAtMTA5MDk3NDI5MCksIG5ldyBpbnQ2NCgweDFiNzEwYjM1LCAweDEzMWM0NzFiKSxcclxuICAgICAgICAgICAgbmV3IGludDY0KDB4MjhkYjc3ZjUsIDB4MjMwNDdkODQpLCBuZXcgaW50NjQoMHgzMmNhYWI3YiwgMHg0MGM3MjQ5MyksXHJcbiAgICAgICAgICAgIG5ldyBpbnQ2NCgweDNjOWViZTBhLCAweDE1YzliZWJjKSwgbmV3IGludDY0KDB4NDMxZDY3YzQsIC0xNjc2NjY5NjIwKSxcclxuICAgICAgICAgICAgbmV3IGludDY0KDB4NGNjNWQ0YmUsIC04ODUxMTIxMzgpLCBuZXcgaW50NjQoMHg1OTdmMjk5YywgLTYwNDU3NDMwKSxcclxuICAgICAgICAgICAgbmV3IGludDY0KDB4NWZjYjZmYWIsIDB4M2FkNmZhZWMpLCBuZXcgaW50NjQoMHg2YzQ0MTk4YywgMHg0YTQ3NTgxNylcclxuICAgICAgICAgICk7XHJcbiAgICAgIH1cclxuICBcclxuICAgICAgZm9yIChpPTA7IGk8ODA7IGkrPTEpIHtcclxuICAgICAgICBXW2ldID0gbmV3IGludDY0KDAsIDApO1xyXG4gICAgICB9XHJcbiAgICBcclxuICAgICAgLy8gYXBwZW5kIHBhZGRpbmcgdG8gdGhlIHNvdXJjZSBzdHJpbmcuIFRoZSBmb3JtYXQgaXMgZGVzY3JpYmVkIGluIHRoZSBGSVBTLlxyXG4gICAgICB4W2xlbiA+PiA1XSB8PSAweDgwIDw8ICgyNCAtIChsZW4gJiAweDFmKSk7XHJcbiAgICAgIHhbKChsZW4gKyAxMjggPj4gMTApPDwgNSkgKyAzMV0gPSBsZW47XHJcbiAgICBcclxuICAgICAgZm9yIChpID0gMDsgaTx4Lmxlbmd0aDsgaSs9MzIpIHsgLy8zMiBkd29yZHMgaXMgdGhlIGJsb2NrIHNpemVcclxuICAgICAgICBpbnQ2NGNvcHkoYSwgSFswXSk7XHJcbiAgICAgICAgaW50NjRjb3B5KGIsIEhbMV0pO1xyXG4gICAgICAgIGludDY0Y29weShjLCBIWzJdKTtcclxuICAgICAgICBpbnQ2NGNvcHkoZCwgSFszXSk7XHJcbiAgICAgICAgaW50NjRjb3B5KGUsIEhbNF0pO1xyXG4gICAgICAgIGludDY0Y29weShmLCBIWzVdKTtcclxuICAgICAgICBpbnQ2NGNvcHkoZywgSFs2XSk7XHJcbiAgICAgICAgaW50NjRjb3B5KGgsIEhbN10pO1xyXG4gICAgICBcclxuICAgICAgICBmb3IgKGo9MDsgajwxNjsgaisrKSB7XHJcbiAgICAgICAgICBXW2pdLmggPSB4W2kgKyAyKmpdO1xyXG4gICAgICAgICAgV1tqXS5sID0geFtpICsgMipqICsgMV07XHJcbiAgICAgICAgfVxyXG4gICAgICBcclxuICAgICAgICBmb3IgKGo9MTY7IGo8ODA7IGorKykge1xyXG4gICAgICAgICAgLy9zaWdtYTFcclxuICAgICAgICAgIGludDY0cnJvdChyMSwgV1tqLTJdLCAxOSk7XHJcbiAgICAgICAgICBpbnQ2NHJldnJyb3QocjIsIFdbai0yXSwgMjkpO1xyXG4gICAgICAgICAgaW50NjRzaHIocjMsIFdbai0yXSwgNik7XHJcbiAgICAgICAgICBzMS5sID0gcjEubCBeIHIyLmwgXiByMy5sO1xyXG4gICAgICAgICAgczEuaCA9IHIxLmggXiByMi5oIF4gcjMuaDtcclxuICAgICAgICAgIC8vc2lnbWEwXHJcbiAgICAgICAgICBpbnQ2NHJyb3QocjEsIFdbai0xNV0sIDEpO1xyXG4gICAgICAgICAgaW50NjRycm90KHIyLCBXW2otMTVdLCA4KTtcclxuICAgICAgICAgIGludDY0c2hyKHIzLCBXW2otMTVdLCA3KTtcclxuICAgICAgICAgIHMwLmwgPSByMS5sIF4gcjIubCBeIHIzLmw7XHJcbiAgICAgICAgICBzMC5oID0gcjEuaCBeIHIyLmggXiByMy5oO1xyXG4gICAgICBcclxuICAgICAgICAgIGludDY0YWRkNChXW2pdLCBzMSwgV1tqLTddLCBzMCwgV1tqLTE2XSk7XHJcbiAgICAgICAgfVxyXG4gICAgICBcclxuICAgICAgICBmb3IgKGogPSAwOyBqIDwgODA7IGorKykge1xyXG4gICAgICAgICAgLy9DaFxyXG4gICAgICAgICAgQ2gubCA9IChlLmwgJiBmLmwpIF4gKH5lLmwgJiBnLmwpO1xyXG4gICAgICAgICAgQ2guaCA9IChlLmggJiBmLmgpIF4gKH5lLmggJiBnLmgpO1xyXG4gICAgICBcclxuICAgICAgICAgIC8vU2lnbWExXHJcbiAgICAgICAgICBpbnQ2NHJyb3QocjEsIGUsIDE0KTtcclxuICAgICAgICAgIGludDY0cnJvdChyMiwgZSwgMTgpO1xyXG4gICAgICAgICAgaW50NjRyZXZycm90KHIzLCBlLCA5KTtcclxuICAgICAgICAgIHMxLmwgPSByMS5sIF4gcjIubCBeIHIzLmw7XHJcbiAgICAgICAgICBzMS5oID0gcjEuaCBeIHIyLmggXiByMy5oO1xyXG4gICAgICBcclxuICAgICAgICAgIC8vU2lnbWEwXHJcbiAgICAgICAgICBpbnQ2NHJyb3QocjEsIGEsIDI4KTtcclxuICAgICAgICAgIGludDY0cmV2cnJvdChyMiwgYSwgMik7XHJcbiAgICAgICAgICBpbnQ2NHJldnJyb3QocjMsIGEsIDcpO1xyXG4gICAgICAgICAgczAubCA9IHIxLmwgXiByMi5sIF4gcjMubDtcclxuICAgICAgICAgIHMwLmggPSByMS5oIF4gcjIuaCBeIHIzLmg7XHJcbiAgICAgIFxyXG4gICAgICAgICAgLy9NYWpcclxuICAgICAgICAgIE1hai5sID0gKGEubCAmIGIubCkgXiAoYS5sICYgYy5sKSBeIChiLmwgJiBjLmwpO1xyXG4gICAgICAgICAgTWFqLmggPSAoYS5oICYgYi5oKSBeIChhLmggJiBjLmgpIF4gKGIuaCAmIGMuaCk7XHJcbiAgICAgIFxyXG4gICAgICAgICAgaW50NjRhZGQ1KFQxLCBoLCBzMSwgQ2gsIHNoYTUxMl9rW2pdLCBXW2pdKTtcclxuICAgICAgICAgIGludDY0YWRkKFQyLCBzMCwgTWFqKTtcclxuICAgICAgXHJcbiAgICAgICAgICBpbnQ2NGNvcHkoaCwgZyk7XHJcbiAgICAgICAgICBpbnQ2NGNvcHkoZywgZik7XHJcbiAgICAgICAgICBpbnQ2NGNvcHkoZiwgZSk7XHJcbiAgICAgICAgICBpbnQ2NGFkZChlLCBkLCBUMSk7XHJcbiAgICAgICAgICBpbnQ2NGNvcHkoZCwgYyk7XHJcbiAgICAgICAgICBpbnQ2NGNvcHkoYywgYik7XHJcbiAgICAgICAgICBpbnQ2NGNvcHkoYiwgYSk7XHJcbiAgICAgICAgICBpbnQ2NGFkZChhLCBUMSwgVDIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpbnQ2NGFkZChIWzBdLCBIWzBdLCBhKTtcclxuICAgICAgICBpbnQ2NGFkZChIWzFdLCBIWzFdLCBiKTtcclxuICAgICAgICBpbnQ2NGFkZChIWzJdLCBIWzJdLCBjKTtcclxuICAgICAgICBpbnQ2NGFkZChIWzNdLCBIWzNdLCBkKTtcclxuICAgICAgICBpbnQ2NGFkZChIWzRdLCBIWzRdLCBlKTtcclxuICAgICAgICBpbnQ2NGFkZChIWzVdLCBIWzVdLCBmKTtcclxuICAgICAgICBpbnQ2NGFkZChIWzZdLCBIWzZdLCBnKTtcclxuICAgICAgICBpbnQ2NGFkZChIWzddLCBIWzddLCBoKTtcclxuICAgICAgfVxyXG4gICAgXHJcbiAgICAgIC8vcmVwcmVzZW50IHRoZSBoYXNoIGFzIGFuIGFycmF5IG9mIDMyLWJpdCBkd29yZHNcclxuICAgICAgZm9yIChpPTA7IGk8ODsgaSs9MSkge1xyXG4gICAgICAgIGhhc2hbMippXSA9IEhbaV0uaDtcclxuICAgICAgICBoYXNoWzIqaSArIDFdID0gSFtpXS5sO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBoYXNoO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvL0EgY29uc3RydWN0b3IgZm9yIDY0LWJpdCBudW1iZXJzXHJcbiAgICBmdW5jdGlvbiBpbnQ2NChoLCBsKSB7XHJcbiAgICAgIHRoaXMuaCA9IGg7XHJcbiAgICAgIHRoaXMubCA9IGw7XHJcbiAgICAgIC8vdGhpcy50b1N0cmluZyA9IGludDY0dG9TdHJpbmc7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vQ29waWVzIHNyYyBpbnRvIGRzdCwgYXNzdW1pbmcgYm90aCBhcmUgNjQtYml0IG51bWJlcnNcclxuICAgIGZ1bmN0aW9uIGludDY0Y29weShkc3QsIHNyYykge1xyXG4gICAgICBkc3QuaCA9IHNyYy5oO1xyXG4gICAgICBkc3QubCA9IHNyYy5sO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvL1JpZ2h0LXJvdGF0ZXMgYSA2NC1iaXQgbnVtYmVyIGJ5IHNoaWZ0XHJcbiAgICAvL1dvbid0IGhhbmRsZSBjYXNlcyBvZiBzaGlmdD49MzJcclxuICAgIC8vVGhlIGZ1bmN0aW9uIHJldnJyb3QoKSBpcyBmb3IgdGhhdFxyXG4gICAgZnVuY3Rpb24gaW50NjRycm90KGRzdCwgeCwgc2hpZnQpIHtcclxuICAgICAgZHN0LmwgPSAoeC5sID4+PiBzaGlmdCkgfCAoeC5oIDw8ICgzMi1zaGlmdCkpO1xyXG4gICAgICBkc3QuaCA9ICh4LmggPj4+IHNoaWZ0KSB8ICh4LmwgPDwgKDMyLXNoaWZ0KSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vUmV2ZXJzZXMgdGhlIGR3b3JkcyBvZiB0aGUgc291cmNlIGFuZCB0aGVuIHJvdGF0ZXMgcmlnaHQgYnkgc2hpZnQuXHJcbiAgICAvL1RoaXMgaXMgZXF1aXZhbGVudCB0byByb3RhdGlvbiBieSAzMitzaGlmdFxyXG4gICAgZnVuY3Rpb24gaW50NjRyZXZycm90KGRzdCwgeCwgc2hpZnQpIHtcclxuICAgICAgZHN0LmwgPSAoeC5oID4+PiBzaGlmdCkgfCAoeC5sIDw8ICgzMi1zaGlmdCkpO1xyXG4gICAgICBkc3QuaCA9ICh4LmwgPj4+IHNoaWZ0KSB8ICh4LmggPDwgKDMyLXNoaWZ0KSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vQml0d2lzZS1zaGlmdHMgcmlnaHQgYSA2NC1iaXQgbnVtYmVyIGJ5IHNoaWZ0XHJcbiAgICAvL1dvbid0IGhhbmRsZSBzaGlmdD49MzIsIGJ1dCBpdCdzIG5ldmVyIG5lZWRlZCBpbiBTSEE1MTJcclxuICAgIGZ1bmN0aW9uIGludDY0c2hyKGRzdCwgeCwgc2hpZnQpIHtcclxuICAgICAgZHN0LmwgPSAoeC5sID4+PiBzaGlmdCkgfCAoeC5oIDw8ICgzMi1zaGlmdCkpO1xyXG4gICAgICBkc3QuaCA9ICh4LmggPj4+IHNoaWZ0KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy9BZGRzIHR3byA2NC1iaXQgbnVtYmVyc1xyXG4gICAgLy9MaWtlIHRoZSBvcmlnaW5hbCBpbXBsZW1lbnRhdGlvbiwgZG9lcyBub3QgcmVseSBvbiAzMi1iaXQgb3BlcmF0aW9uc1xyXG4gICAgZnVuY3Rpb24gaW50NjRhZGQoZHN0LCB4LCB5KSB7XHJcbiAgICAgICB2YXIgdzAgPSAoeC5sICYgMHhmZmZmKSArICh5LmwgJiAweGZmZmYpO1xyXG4gICAgICAgdmFyIHcxID0gKHgubCA+Pj4gMTYpICsgKHkubCA+Pj4gMTYpICsgKHcwID4+PiAxNik7XHJcbiAgICAgICB2YXIgdzIgPSAoeC5oICYgMHhmZmZmKSArICh5LmggJiAweGZmZmYpICsgKHcxID4+PiAxNik7XHJcbiAgICAgICB2YXIgdzMgPSAoeC5oID4+PiAxNikgKyAoeS5oID4+PiAxNikgKyAodzIgPj4+IDE2KTtcclxuICAgICAgIGRzdC5sID0gKHcwICYgMHhmZmZmKSB8ICh3MSA8PCAxNik7XHJcbiAgICAgICBkc3QuaCA9ICh3MiAmIDB4ZmZmZikgfCAodzMgPDwgMTYpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvL1NhbWUsIGV4Y2VwdCB3aXRoIDQgYWRkZW5kcy4gV29ya3MgZmFzdGVyIHRoYW4gYWRkaW5nIHRoZW0gb25lIGJ5IG9uZS5cclxuICAgIGZ1bmN0aW9uIGludDY0YWRkNChkc3QsIGEsIGIsIGMsIGQpIHtcclxuICAgICAgIHZhciB3MCA9IChhLmwgJiAweGZmZmYpICsgKGIubCAmIDB4ZmZmZikgKyAoYy5sICYgMHhmZmZmKSArIChkLmwgJiAweGZmZmYpO1xyXG4gICAgICAgdmFyIHcxID0gKGEubCA+Pj4gMTYpICsgKGIubCA+Pj4gMTYpICsgKGMubCA+Pj4gMTYpICsgKGQubCA+Pj4gMTYpICsgKHcwID4+PiAxNik7XHJcbiAgICAgICB2YXIgdzIgPSAoYS5oICYgMHhmZmZmKSArIChiLmggJiAweGZmZmYpICsgKGMuaCAmIDB4ZmZmZikgKyAoZC5oICYgMHhmZmZmKSArICh3MSA+Pj4gMTYpO1xyXG4gICAgICAgdmFyIHczID0gKGEuaCA+Pj4gMTYpICsgKGIuaCA+Pj4gMTYpICsgKGMuaCA+Pj4gMTYpICsgKGQuaCA+Pj4gMTYpICsgKHcyID4+PiAxNik7XHJcbiAgICAgICBkc3QubCA9ICh3MCAmIDB4ZmZmZikgfCAodzEgPDwgMTYpO1xyXG4gICAgICAgZHN0LmggPSAodzIgJiAweGZmZmYpIHwgKHczIDw8IDE2KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy9TYW1lLCBleGNlcHQgd2l0aCA1IGFkZGVuZHNcclxuICAgIGZ1bmN0aW9uIGludDY0YWRkNShkc3QsIGEsIGIsIGMsIGQsIGUpIHtcclxuICAgICAgdmFyIHcwID0gKGEubCAmIDB4ZmZmZikgKyAoYi5sICYgMHhmZmZmKSArIChjLmwgJiAweGZmZmYpICsgKGQubCAmIDB4ZmZmZikgKyAoZS5sICYgMHhmZmZmKSxcclxuICAgICAgICAgIHcxID0gKGEubCA+Pj4gMTYpICsgKGIubCA+Pj4gMTYpICsgKGMubCA+Pj4gMTYpICsgKGQubCA+Pj4gMTYpICsgKGUubCA+Pj4gMTYpICsgKHcwID4+PiAxNiksXHJcbiAgICAgICAgICB3MiA9IChhLmggJiAweGZmZmYpICsgKGIuaCAmIDB4ZmZmZikgKyAoYy5oICYgMHhmZmZmKSArIChkLmggJiAweGZmZmYpICsgKGUuaCAmIDB4ZmZmZikgKyAodzEgPj4+IDE2KSxcclxuICAgICAgICAgIHczID0gKGEuaCA+Pj4gMTYpICsgKGIuaCA+Pj4gMTYpICsgKGMuaCA+Pj4gMTYpICsgKGQuaCA+Pj4gMTYpICsgKGUuaCA+Pj4gMTYpICsgKHcyID4+PiAxNik7XHJcbiAgICAgICBkc3QubCA9ICh3MCAmIDB4ZmZmZikgfCAodzEgPDwgMTYpO1xyXG4gICAgICAgZHN0LmggPSAodzIgJiAweGZmZmYpIHwgKHczIDw8IDE2KTtcclxuICAgIH1cclxuICB9LFxyXG4gIC8qKlxyXG4gICAqIEBjbGFzcyBIYXNoZXMuUk1EMTYwXHJcbiAgICogQGNvbnN0cnVjdG9yXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IFtjb25maWddXHJcbiAgICogXHJcbiAgICogQSBKYXZhU2NyaXB0IGltcGxlbWVudGF0aW9uIG9mIHRoZSBSSVBFTUQtMTYwIEFsZ29yaXRobVxyXG4gICAqIFZlcnNpb24gMi4yIENvcHlyaWdodCBKZXJlbXkgTGluLCBQYXVsIEpvaG5zdG9uIDIwMDAgLSAyMDA5LlxyXG4gICAqIE90aGVyIGNvbnRyaWJ1dG9yczogR3JlZyBIb2x0LCBBbmRyZXcgS2VwZXJ0LCBZZG5hciwgTG9zdGluZXRcclxuICAgKiBTZWUgaHR0cDovL3BhamhvbWUub3JnLnVrL2NyeXB0L21kNSBmb3IgZGV0YWlscy5cclxuICAgKiBBbHNvIGh0dHA6Ly93d3cub2NmLmJlcmtlbGV5LmVkdS9+ampsaW4vanNvdHAvXHJcbiAgICovXHJcbiAgUk1EMTYwIDogZnVuY3Rpb24gKG9wdGlvbnMpIHtcclxuICAgIC8qKlxyXG4gICAgICogUHJpdmF0ZSBwcm9wZXJ0aWVzIGNvbmZpZ3VyYXRpb24gdmFyaWFibGVzLiBZb3UgbWF5IG5lZWQgdG8gdHdlYWsgdGhlc2UgdG8gYmUgY29tcGF0aWJsZSB3aXRoXHJcbiAgICAgKiB0aGUgc2VydmVyLXNpZGUsIGJ1dCB0aGUgZGVmYXVsdHMgd29yayBpbiBtb3N0IGNhc2VzLlxyXG4gICAgICogQHNlZSB0aGlzLnNldFVwcGVyQ2FzZSgpIG1ldGhvZFxyXG4gICAgICogQHNlZSB0aGlzLnNldFBhZCgpIG1ldGhvZFxyXG4gICAgICovXHJcbiAgICB2YXIgaGV4Y2FzZSA9IChvcHRpb25zICYmIHR5cGVvZiBvcHRpb25zLnVwcGVyY2FzZSA9PT0gJ2Jvb2xlYW4nKSA/IG9wdGlvbnMudXBwZXJjYXNlIDogZmFsc2UsICAgLyogaGV4YWRlY2ltYWwgb3V0cHV0IGNhc2UgZm9ybWF0LiBmYWxzZSAtIGxvd2VyY2FzZTsgdHJ1ZSAtIHVwcGVyY2FzZSAgKi9cclxuICAgICAgICBiNjRwYWQgPSAob3B0aW9ucyAmJiB0eXBlb2Ygb3B0aW9ucy5wYWQgPT09ICdzdHJpbmcnKSA/IG9wdGlvbnMucGRhIDogJz0nLCAgLyogYmFzZS02NCBwYWQgY2hhcmFjdGVyLiBEZWZhdWx0ICc9JyBmb3Igc3RyaWN0IFJGQyBjb21wbGlhbmNlICAgKi9cclxuICAgICAgICB1dGY4ID0gKG9wdGlvbnMgJiYgdHlwZW9mIG9wdGlvbnMudXRmOCA9PT0gJ2Jvb2xlYW4nKSA/IG9wdGlvbnMudXRmOCA6IHRydWUsIC8qIGVuYWJsZS9kaXNhYmxlIHV0ZjggZW5jb2RpbmcgKi9cclxuICAgICAgICBybWQxNjBfcjEgPSBbXHJcbiAgICAgICAgICAgMCwgIDEsICAyLCAgMywgIDQsICA1LCAgNiwgIDcsICA4LCAgOSwgMTAsIDExLCAxMiwgMTMsIDE0LCAxNSxcclxuICAgICAgICAgICA3LCAgNCwgMTMsICAxLCAxMCwgIDYsIDE1LCAgMywgMTIsICAwLCAgOSwgIDUsICAyLCAxNCwgMTEsICA4LFxyXG4gICAgICAgICAgIDMsIDEwLCAxNCwgIDQsICA5LCAxNSwgIDgsICAxLCAgMiwgIDcsICAwLCAgNiwgMTMsIDExLCAgNSwgMTIsXHJcbiAgICAgICAgICAgMSwgIDksIDExLCAxMCwgIDAsICA4LCAxMiwgIDQsIDEzLCAgMywgIDcsIDE1LCAxNCwgIDUsICA2LCAgMixcclxuICAgICAgICAgICA0LCAgMCwgIDUsICA5LCAgNywgMTIsICAyLCAxMCwgMTQsICAxLCAgMywgIDgsIDExLCAgNiwgMTUsIDEzXHJcbiAgICAgICAgXSxcclxuICAgICAgICBybWQxNjBfcjIgPSBbXHJcbiAgICAgICAgICAgNSwgMTQsICA3LCAgMCwgIDksICAyLCAxMSwgIDQsIDEzLCAgNiwgMTUsICA4LCAgMSwgMTAsICAzLCAxMixcclxuICAgICAgICAgICA2LCAxMSwgIDMsICA3LCAgMCwgMTMsICA1LCAxMCwgMTQsIDE1LCAgOCwgMTIsICA0LCAgOSwgIDEsICAyLFxyXG4gICAgICAgICAgMTUsICA1LCAgMSwgIDMsICA3LCAxNCwgIDYsICA5LCAxMSwgIDgsIDEyLCAgMiwgMTAsICAwLCAgNCwgMTMsXHJcbiAgICAgICAgICAgOCwgIDYsICA0LCAgMSwgIDMsIDExLCAxNSwgIDAsICA1LCAxMiwgIDIsIDEzLCAgOSwgIDcsIDEwLCAxNCxcclxuICAgICAgICAgIDEyLCAxNSwgMTAsICA0LCAgMSwgIDUsICA4LCAgNywgIDYsICAyLCAxMywgMTQsICAwLCAgMywgIDksIDExXHJcbiAgICAgICAgXSxcclxuICAgICAgICBybWQxNjBfczEgPSBbXHJcbiAgICAgICAgICAxMSwgMTQsIDE1LCAxMiwgIDUsICA4LCAgNywgIDksIDExLCAxMywgMTQsIDE1LCAgNiwgIDcsICA5LCAgOCxcclxuICAgICAgICAgICA3LCAgNiwgIDgsIDEzLCAxMSwgIDksICA3LCAxNSwgIDcsIDEyLCAxNSwgIDksIDExLCAgNywgMTMsIDEyLFxyXG4gICAgICAgICAgMTEsIDEzLCAgNiwgIDcsIDE0LCAgOSwgMTMsIDE1LCAxNCwgIDgsIDEzLCAgNiwgIDUsIDEyLCAgNywgIDUsXHJcbiAgICAgICAgICAxMSwgMTIsIDE0LCAxNSwgMTQsIDE1LCAgOSwgIDgsICA5LCAxNCwgIDUsICA2LCAgOCwgIDYsICA1LCAxMixcclxuICAgICAgICAgICA5LCAxNSwgIDUsIDExLCAgNiwgIDgsIDEzLCAxMiwgIDUsIDEyLCAxMywgMTQsIDExLCAgOCwgIDUsICA2XHJcbiAgICAgICAgXSxcclxuICAgICAgICBybWQxNjBfczIgPSBbXHJcbiAgICAgICAgICAgOCwgIDksICA5LCAxMSwgMTMsIDE1LCAxNSwgIDUsICA3LCAgNywgIDgsIDExLCAxNCwgMTQsIDEyLCAgNixcclxuICAgICAgICAgICA5LCAxMywgMTUsICA3LCAxMiwgIDgsICA5LCAxMSwgIDcsICA3LCAxMiwgIDcsICA2LCAxNSwgMTMsIDExLFxyXG4gICAgICAgICAgIDksICA3LCAxNSwgMTEsICA4LCAgNiwgIDYsIDE0LCAxMiwgMTMsICA1LCAxNCwgMTMsIDEzLCAgNywgIDUsXHJcbiAgICAgICAgICAxNSwgIDUsICA4LCAxMSwgMTQsIDE0LCAgNiwgMTQsICA2LCAgOSwgMTIsICA5LCAxMiwgIDUsIDE1LCAgOCxcclxuICAgICAgICAgICA4LCAgNSwgMTIsICA5LCAxMiwgIDUsIDE0LCAgNiwgIDgsIDEzLCAgNiwgIDUsIDE1LCAxMywgMTEsIDExXHJcbiAgICAgICAgXTtcclxuXHJcbiAgICAvKiBwcml2aWxlZ2VkIChwdWJsaWMpIG1ldGhvZHMgKi9cclxuICAgIHRoaXMuaGV4ID0gZnVuY3Rpb24gKHMpIHtcclxuICAgICAgcmV0dXJuIHJzdHIyaGV4KHJzdHIocywgdXRmOCkpOyBcclxuICAgIH07XHJcbiAgICB0aGlzLmI2NCA9IGZ1bmN0aW9uIChzKSB7XHJcbiAgICAgIHJldHVybiByc3RyMmI2NChyc3RyKHMsIHV0ZjgpLCBiNjRwYWQpO1xyXG4gICAgfTtcclxuICAgIHRoaXMuYW55ID0gZnVuY3Rpb24gKHMsIGUpIHsgXHJcbiAgICAgIHJldHVybiByc3RyMmFueShyc3RyKHMsIHV0ZjgpLCBlKTtcclxuICAgIH07XHJcbiAgICB0aGlzLmhleF9obWFjID0gZnVuY3Rpb24gKGssIGQpIHsgXHJcbiAgICAgIHJldHVybiByc3RyMmhleChyc3RyX2htYWMoaywgZCkpO1xyXG4gICAgfTtcclxuICAgIHRoaXMuYjY0X2htYWMgPSBmdW5jdGlvbiAoaywgZCkgeyBcclxuICAgICAgcmV0dXJuIHJzdHIyYjY0KHJzdHJfaG1hYyhrLCBkKSwgYjY0cGFkKTtcclxuICAgIH07XHJcbiAgICB0aGlzLmFueV9obWFjID0gZnVuY3Rpb24gKGssIGQsIGUpIHsgXHJcbiAgICAgIHJldHVybiByc3RyMmFueShyc3RyX2htYWMoaywgZCksIGUpOyBcclxuICAgIH07XHJcbiAgICAvKipcclxuICAgICAqIFBlcmZvcm0gYSBzaW1wbGUgc2VsZi10ZXN0IHRvIHNlZSBpZiB0aGUgVk0gaXMgd29ya2luZ1xyXG4gICAgICogQHJldHVybiB7U3RyaW5nfSBIZXhhZGVjaW1hbCBoYXNoIHNhbXBsZVxyXG4gICAgICogQHB1YmxpY1xyXG4gICAgICovXHJcbiAgICB0aGlzLnZtX3Rlc3QgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgIHJldHVybiBoZXgoJ2FiYycpLnRvTG93ZXJDYXNlKCkgPT09ICc5MDAxNTA5ODNjZDI0ZmIwZDY5NjNmN2QyOGUxN2Y3Mic7XHJcbiAgICB9O1xyXG4gICAgLyoqIFxyXG4gICAgICogQGRlc2NyaXB0aW9uIEVuYWJsZS9kaXNhYmxlIHVwcGVyY2FzZSBoZXhhZGVjaW1hbCByZXR1cm5lZCBzdHJpbmcgXHJcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFxyXG4gICAgICogQHJldHVybiB7T2JqZWN0fSB0aGlzXHJcbiAgICAgKiBAcHVibGljXHJcbiAgICAgKi8gXHJcbiAgICB0aGlzLnNldFVwcGVyQ2FzZSA9IGZ1bmN0aW9uIChhKSB7XHJcbiAgICAgIGlmICh0eXBlb2YgYSA9PT0gJ2Jvb2xlYW4nICkgeyBoZXhjYXNlID0gYTsgfVxyXG4gICAgICByZXR1cm4gdGhpcztcclxuICAgIH07XHJcbiAgICAvKiogXHJcbiAgICAgKiBAZGVzY3JpcHRpb24gRGVmaW5lcyBhIGJhc2U2NCBwYWQgc3RyaW5nIFxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFBhZFxyXG4gICAgICogQHJldHVybiB7T2JqZWN0fSB0aGlzXHJcbiAgICAgKiBAcHVibGljXHJcbiAgICAgKi8gXHJcbiAgICB0aGlzLnNldFBhZCA9IGZ1bmN0aW9uIChhKSB7XHJcbiAgICAgIGlmICh0eXBlb2YgYSAhPT0gJ3VuZGVmaW5lZCcgKSB7IGI2NHBhZCA9IGE7IH1cclxuICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9O1xyXG4gICAgLyoqIFxyXG4gICAgICogQGRlc2NyaXB0aW9uIERlZmluZXMgYSBiYXNlNjQgcGFkIHN0cmluZyBcclxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gXHJcbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9IHRoaXNcclxuICAgICAqIEBwdWJsaWNcclxuICAgICAqLyBcclxuICAgIHRoaXMuc2V0VVRGOCA9IGZ1bmN0aW9uIChhKSB7XHJcbiAgICAgIGlmICh0eXBlb2YgYSA9PT0gJ2Jvb2xlYW4nKSB7IHV0ZjggPSBhOyB9XHJcbiAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfTtcclxuXHJcbiAgICAvKiBwcml2YXRlIG1ldGhvZHMgKi9cclxuXHJcbiAgICAvKipcclxuICAgICAqIENhbGN1bGF0ZSB0aGUgcm1kMTYwIG9mIGEgcmF3IHN0cmluZ1xyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiByc3RyKHMpIHtcclxuICAgICAgcyA9ICh1dGY4KSA/IHV0ZjhFbmNvZGUocykgOiBzO1xyXG4gICAgICByZXR1cm4gYmlubDJyc3RyKGJpbmwocnN0cjJiaW5sKHMpLCBzLmxlbmd0aCAqIDgpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENhbGN1bGF0ZSB0aGUgSE1BQy1ybWQxNjAgb2YgYSBrZXkgYW5kIHNvbWUgZGF0YSAocmF3IHN0cmluZ3MpXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIHJzdHJfaG1hYyhrZXksIGRhdGEpIHtcclxuICAgICAga2V5ID0gKHV0ZjgpID8gdXRmOEVuY29kZShrZXkpIDoga2V5O1xyXG4gICAgICBkYXRhID0gKHV0ZjgpID8gdXRmOEVuY29kZShkYXRhKSA6IGRhdGE7XHJcbiAgICAgIHZhciBpLCBoYXNoLFxyXG4gICAgICAgICAgYmtleSA9IHJzdHIyYmlubChrZXkpLFxyXG4gICAgICAgICAgaXBhZCA9IEFycmF5KDE2KSwgb3BhZCA9IEFycmF5KDE2KTtcclxuXHJcbiAgICAgIGlmIChia2V5Lmxlbmd0aCA+IDE2KSB7IFxyXG4gICAgICAgIGJrZXkgPSBiaW5sKGJrZXksIGtleS5sZW5ndGggKiA4KTsgXHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIGZvciAoaSA9IDA7IGkgPCAxNjsgaSs9MSkge1xyXG4gICAgICAgIGlwYWRbaV0gPSBia2V5W2ldIF4gMHgzNjM2MzYzNjtcclxuICAgICAgICBvcGFkW2ldID0gYmtleVtpXSBeIDB4NUM1QzVDNUM7XHJcbiAgICAgIH1cclxuICAgICAgaGFzaCA9IGJpbmwoaXBhZC5jb25jYXQocnN0cjJiaW5sKGRhdGEpKSwgNTEyICsgZGF0YS5sZW5ndGggKiA4KTtcclxuICAgICAgcmV0dXJuIGJpbmwycnN0cihiaW5sKG9wYWQuY29uY2F0KGhhc2gpLCA1MTIgKyAxNjApKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENvbnZlcnQgYW4gYXJyYXkgb2YgbGl0dGxlLWVuZGlhbiB3b3JkcyB0byBhIHN0cmluZ1xyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBiaW5sMnJzdHIoaW5wdXQpIHtcclxuICAgICAgdmFyIG91dHB1dCA9ICcnLCBpID0gMDtcclxuICAgICAgZm9yICg7IGkgPCBpbnB1dC5sZW5ndGggKiAzMjsgaSArPSA4KSB7XHJcbiAgICAgICAgb3V0cHV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoKGlucHV0W2k+PjVdID4+PiAoaSAlIDMyKSkgJiAweEZGKTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gb3V0cHV0O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2FsY3VsYXRlIHRoZSBSSVBFLU1EMTYwIG9mIGFuIGFycmF5IG9mIGxpdHRsZS1lbmRpYW4gd29yZHMsIGFuZCBhIGJpdCBsZW5ndGguXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGJpbmwoeCwgbGVuKSB7XHJcbiAgICAgIHZhciBULCBqLCBpLFxyXG4gICAgICAgICAgaDAgPSAweDY3NDUyMzAxLFxyXG4gICAgICAgICAgaDEgPSAweGVmY2RhYjg5LFxyXG4gICAgICAgICAgaDIgPSAweDk4YmFkY2ZlLFxyXG4gICAgICAgICAgaDMgPSAweDEwMzI1NDc2LFxyXG4gICAgICAgICAgaDQgPSAweGMzZDJlMWYwLFxyXG4gICAgICAgICAgQTEgPSBoMCwgQjEgPSBoMSwgQzEgPSBoMiwgRDEgPSBoMywgRTEgPSBoNCxcclxuICAgICAgICAgIEEyID0gaDAsIEIyID0gaDEsIEMyID0gaDIsIEQyID0gaDMsIEUyID0gaDQ7XHJcblxyXG4gICAgICAvKiBhcHBlbmQgcGFkZGluZyAqL1xyXG4gICAgICB4W2xlbiA+PiA1XSB8PSAweDgwIDw8IChsZW4gJSAzMik7XHJcbiAgICAgIHhbKCgobGVuICsgNjQpID4+PiA5KSA8PCA0KSArIDE0XSA9IGxlbjtcclxuXHJcbiAgICAgIGZvciAoaSA9IDA7IGkgPCB4Lmxlbmd0aDsgaSArPSAxNikge1xyXG4gICAgICAgIGZvciAoaiA9IDA7IGogPD0gNzk7ICsraikge1xyXG4gICAgICAgICAgVCA9IHNhZmVfYWRkKEExLCBybWQxNjBfZihqLCBCMSwgQzEsIEQxKSk7XHJcbiAgICAgICAgICBUID0gc2FmZV9hZGQoVCwgeFtpICsgcm1kMTYwX3IxW2pdXSk7XHJcbiAgICAgICAgICBUID0gc2FmZV9hZGQoVCwgcm1kMTYwX0sxKGopKTtcclxuICAgICAgICAgIFQgPSBzYWZlX2FkZChiaXRfcm9sKFQsIHJtZDE2MF9zMVtqXSksIEUxKTtcclxuICAgICAgICAgIEExID0gRTE7IEUxID0gRDE7IEQxID0gYml0X3JvbChDMSwgMTApOyBDMSA9IEIxOyBCMSA9IFQ7XHJcbiAgICAgICAgICBUID0gc2FmZV9hZGQoQTIsIHJtZDE2MF9mKDc5LWosIEIyLCBDMiwgRDIpKTtcclxuICAgICAgICAgIFQgPSBzYWZlX2FkZChULCB4W2kgKyBybWQxNjBfcjJbal1dKTtcclxuICAgICAgICAgIFQgPSBzYWZlX2FkZChULCBybWQxNjBfSzIoaikpO1xyXG4gICAgICAgICAgVCA9IHNhZmVfYWRkKGJpdF9yb2woVCwgcm1kMTYwX3MyW2pdKSwgRTIpO1xyXG4gICAgICAgICAgQTIgPSBFMjsgRTIgPSBEMjsgRDIgPSBiaXRfcm9sKEMyLCAxMCk7IEMyID0gQjI7IEIyID0gVDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIFQgPSBzYWZlX2FkZChoMSwgc2FmZV9hZGQoQzEsIEQyKSk7XHJcbiAgICAgICAgaDEgPSBzYWZlX2FkZChoMiwgc2FmZV9hZGQoRDEsIEUyKSk7XHJcbiAgICAgICAgaDIgPSBzYWZlX2FkZChoMywgc2FmZV9hZGQoRTEsIEEyKSk7XHJcbiAgICAgICAgaDMgPSBzYWZlX2FkZChoNCwgc2FmZV9hZGQoQTEsIEIyKSk7XHJcbiAgICAgICAgaDQgPSBzYWZlX2FkZChoMCwgc2FmZV9hZGQoQjEsIEMyKSk7XHJcbiAgICAgICAgaDAgPSBUO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBbaDAsIGgxLCBoMiwgaDMsIGg0XTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBzcGVjaWZpYyBhbGdvcml0aG0gbWV0aG9kcyBcclxuICAgIGZ1bmN0aW9uIHJtZDE2MF9mKGosIHgsIHksIHopIHtcclxuICAgICAgcmV0dXJuICggMCA8PSBqICYmIGogPD0gMTUpID8gKHggXiB5IF4geikgOlxyXG4gICAgICAgICAoMTYgPD0gaiAmJiBqIDw9IDMxKSA/ICh4ICYgeSkgfCAofnggJiB6KSA6XHJcbiAgICAgICAgICgzMiA8PSBqICYmIGogPD0gNDcpID8gKHggfCB+eSkgXiB6IDpcclxuICAgICAgICAgKDQ4IDw9IGogJiYgaiA8PSA2MykgPyAoeCAmIHopIHwgKHkgJiB+eikgOlxyXG4gICAgICAgICAoNjQgPD0gaiAmJiBqIDw9IDc5KSA/IHggXiAoeSB8IH56KSA6XHJcbiAgICAgICAgICdybWQxNjBfZjogaiBvdXQgb2YgcmFuZ2UnO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHJtZDE2MF9LMShqKSB7XHJcbiAgICAgIHJldHVybiAoIDAgPD0gaiAmJiBqIDw9IDE1KSA/IDB4MDAwMDAwMDAgOlxyXG4gICAgICAgICAoMTYgPD0gaiAmJiBqIDw9IDMxKSA/IDB4NWE4Mjc5OTkgOlxyXG4gICAgICAgICAoMzIgPD0gaiAmJiBqIDw9IDQ3KSA/IDB4NmVkOWViYTEgOlxyXG4gICAgICAgICAoNDggPD0gaiAmJiBqIDw9IDYzKSA/IDB4OGYxYmJjZGMgOlxyXG4gICAgICAgICAoNjQgPD0gaiAmJiBqIDw9IDc5KSA/IDB4YTk1M2ZkNGUgOlxyXG4gICAgICAgICAncm1kMTYwX0sxOiBqIG91dCBvZiByYW5nZSc7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gcm1kMTYwX0syKGope1xyXG4gICAgICByZXR1cm4gKCAwIDw9IGogJiYgaiA8PSAxNSkgPyAweDUwYTI4YmU2IDpcclxuICAgICAgICAgKDE2IDw9IGogJiYgaiA8PSAzMSkgPyAweDVjNGRkMTI0IDpcclxuICAgICAgICAgKDMyIDw9IGogJiYgaiA8PSA0NykgPyAweDZkNzAzZWYzIDpcclxuICAgICAgICAgKDQ4IDw9IGogJiYgaiA8PSA2MykgPyAweDdhNmQ3NmU5IDpcclxuICAgICAgICAgKDY0IDw9IGogJiYgaiA8PSA3OSkgPyAweDAwMDAwMDAwIDpcclxuICAgICAgICAgJ3JtZDE2MF9LMjogaiBvdXQgb2YgcmFuZ2UnO1xyXG4gICAgfVxyXG4gIH1cclxufTtcclxuXHJcbiAgLy8gZXhwb3NlIEhhc2hlcyBPYmplY3RcclxuICAoZnVuY3Rpb24oIHdpbmRvdywgdW5kZWZpbmVkICkge1xyXG4gICAgdmFyIGZyZWVFeHBvcnRzID0gZmFsc2U7XHJcbiAgICBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnICkge1xyXG4gICAgICBmcmVlRXhwb3J0cyA9IGV4cG9ydHM7XHJcbiAgICAgIGlmIChleHBvcnRzICYmIHR5cGVvZiBnbG9iYWwgPT09ICdvYmplY3QnICYmIGdsb2JhbCAmJiBnbG9iYWwgPT09IGdsb2JhbC5nbG9iYWwgKSB7IHdpbmRvdyA9IGdsb2JhbDsgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBkZWZpbmUuYW1kID09PSAnb2JqZWN0JyAmJiBkZWZpbmUuYW1kKSB7XHJcbiAgICAgIC8vIGRlZmluZSBhcyBhbiBhbm9ueW1vdXMgbW9kdWxlLCBzbywgdGhyb3VnaCBwYXRoIG1hcHBpbmcsIGl0IGNhbiBiZSBhbGlhc2VkXHJcbiAgICAgIGRlZmluZShmdW5jdGlvbiAoKSB7IHJldHVybiBIYXNoZXM7IH0pO1xyXG4gICAgfVxyXG4gICAgZWxzZSBpZiAoIGZyZWVFeHBvcnRzICkge1xyXG4gICAgICAvLyBpbiBOb2RlLmpzIG9yIFJpbmdvSlMgdjAuOC4wK1xyXG4gICAgICBpZiAoIHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICYmIG1vZHVsZSAmJiBtb2R1bGUuZXhwb3J0cyA9PT0gZnJlZUV4cG9ydHMgKSB7XHJcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBIYXNoZXM7XHJcbiAgICAgIH1cclxuICAgICAgLy8gaW4gTmFyd2hhbCBvciBSaW5nb0pTIHYwLjcuMC1cclxuICAgICAgZWxzZSB7XHJcbiAgICAgICAgZnJlZUV4cG9ydHMuSGFzaGVzID0gSGFzaGVzO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBlbHNlIHtcclxuICAgICAgLy8gaW4gYSBicm93c2VyIG9yIFJoaW5vXHJcbiAgICAgIHdpbmRvdy5IYXNoZXMgPSBIYXNoZXM7XHJcbiAgICB9XHJcbiAgfSggdGhpcyApKTtcclxufSgpKTsgLy8gSUlGRVxufSkod2luZG93KSJdfQ==
;
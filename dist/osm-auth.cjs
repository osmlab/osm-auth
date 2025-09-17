var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var osm_auth_exports = {};
__export(osm_auth_exports, {
  osmAuth: () => osmAuth
});
module.exports = __toCommonJS(osm_auth_exports);
function osmAuth(o) {
  var oauth = {};
  var CHANNEL_ID = "osm-api-auth-complete";
  var _store = null;
  try {
    _store = window.localStorage;
  } catch (e) {
    var _mock = /* @__PURE__ */ new Map();
    _store = {
      isMocked: true,
      hasItem: (k) => _mock.has(k),
      getItem: (k) => _mock.get(k),
      setItem: (k, v) => _mock.set(k, v),
      removeItem: (k) => _mock.delete(k),
      clear: () => _mock.clear()
    };
  }
  function token(k, v) {
    var key = o.url + k;
    if (arguments.length === 1) {
      var val = _store.getItem(key) || "";
      return val.replace(/"/g, "");
    } else if (arguments.length === 2) {
      if (v) {
        return _store.setItem(key, v);
      } else {
        return _store.removeItem(key);
      }
    }
  }
  oauth.authenticated = function() {
    return !!token("oauth2_access_token");
  };
  oauth.logout = function() {
    token("oauth2_access_token", "");
    token("oauth_token", "");
    token("oauth_token_secret", "");
    token("oauth_request_token_secret", "");
    return oauth;
  };
  oauth.authenticate = function(callback, options) {
    if (oauth.authenticated()) {
      callback(null, oauth);
      return;
    }
    oauth.logout();
    _preopenPopup(function(error, popup) {
      if (error) {
        callback(error);
      } else {
        _generatePkceChallenge(function(pkce) {
          _authenticate(pkce, options, popup, callback);
        });
      }
    });
  };
  oauth.authenticateAsync = function(options) {
    if (oauth.authenticated()) {
      return Promise.resolve(oauth);
    }
    oauth.logout();
    return new Promise((resolve, reject) => {
      var errback = (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      };
      _preopenPopup((error, popup) => {
        if (error) {
          errback(error);
        } else {
          _generatePkceChallenge((pkce) => _authenticate(pkce, options, popup, errback));
        }
      });
    });
  };
  function _preopenPopup(callback) {
    if (o.singlepage) {
      callback(null, void 0);
      return;
    }
    var w = 550;
    var h = 610;
    var settings = [
      ["width", w],
      ["height", h],
      ["left", window.screen.width / 2 - w / 2],
      ["top", window.screen.height / 2 - h / 2]
    ].map(function(x) {
      return x.join("=");
    }).join(",");
    var popup = window.open("about:blank", "oauth_window", settings);
    if (popup) {
      callback(null, popup);
    } else {
      var error = new Error("Popup was blocked");
      error.status = "popup-blocked";
      callback(error);
    }
  }
  function _authenticate(pkce, options, popup, callback) {
    var state = generateState();
    var path = "/oauth2/authorize?" + utilQsString({
      client_id: o.client_id,
      redirect_uri: o.redirect_uri,
      response_type: "code",
      scope: o.scope,
      state,
      code_challenge: pkce.code_challenge,
      code_challenge_method: pkce.code_challenge_method,
      locale: o.locale || ""
    });
    var url = options?.switchUser ? `${o.url}/logout?referer=${encodeURIComponent(`/login?referer=${encodeURIComponent(path)}`)}` : o.url + path;
    if (o.singlepage) {
      if (_store.isMocked) {
        var error = new Error("localStorage unavailable, but required in singlepage mode");
        error.status = "pkce-localstorage-unavailable";
        callback(error);
        return;
      }
      var params = utilStringQs(window.location.search.slice(1));
      if (params.code) {
        oauth.bootstrapToken(params.code, callback);
      } else {
        token("oauth2_state", state);
        token("oauth2_pkce_code_verifier", pkce.code_verifier);
        window.location = url;
      }
    } else {
      oauth.popupWindow = popup;
      popup.location = url;
    }
    var bc = new BroadcastChannel(CHANNEL_ID);
    bc.addEventListener("message", (event) => {
      var url2 = event.data;
      var params2 = utilStringQs(url2.split("?")[1]);
      if (params2.state !== state) {
        var error2 = new Error("Invalid state");
        error2.status = "invalid-state";
        callback(error2);
        return;
      }
      _getAccessToken(params2.code, pkce.code_verifier, accessTokenDone);
      bc.close();
    });
    function accessTokenDone(err, xhr) {
      o.done();
      if (err) {
        callback(err);
        return;
      }
      var access_token = JSON.parse(xhr.response);
      token("oauth2_access_token", access_token.access_token);
      callback(null, oauth);
    }
  }
  function _getAccessToken(auth_code, code_verifier, accessTokenDone) {
    var url = o.url + "/oauth2/token?" + utilQsString({
      client_id: o.client_id,
      redirect_uri: o.redirect_uri,
      grant_type: "authorization_code",
      code: auth_code,
      code_verifier
    });
    oauth.rawxhr("POST", url, null, null, null, accessTokenDone);
    o.loading();
  }
  oauth.bringPopupWindowToFront = function() {
    var broughtPopupToFront = false;
    try {
      if (oauth.popupWindow && !oauth.popupWindow.closed) {
        oauth.popupWindow.focus();
        broughtPopupToFront = true;
      }
    } catch (err) {
    }
    return broughtPopupToFront;
  };
  oauth.bootstrapToken = function(auth_code, callback) {
    var state = token("oauth2_state");
    token("oauth2_state", "");
    var params = utilStringQs(window.location.search.slice(1));
    if (params.state !== state) {
      var error = new Error("Invalid state");
      error.status = "invalid-state";
      callback(error);
      return;
    }
    var code_verifier = token("oauth2_pkce_code_verifier");
    token("oauth2_pkce_code_verifier", "");
    _getAccessToken(auth_code, code_verifier, accessTokenDone);
    function accessTokenDone(err, xhr) {
      o.done();
      if (err) {
        callback(err);
        return;
      }
      var access_token = JSON.parse(xhr.response);
      token("oauth2_access_token", access_token.access_token);
      callback(null, oauth);
    }
  };
  oauth.fetch = function(resource, options) {
    if (oauth.authenticated()) {
      return _doFetch();
    } else {
      if (o.auto) {
        return oauth.authenticateAsync().then(_doFetch);
      } else {
        return Promise.reject(new Error("not authenticated"));
      }
    }
    function _doFetch() {
      options = options || {};
      if (!options.headers) {
        options.headers = { "Content-Type": "application/x-www-form-urlencoded" };
      }
      options.headers.Authorization = "Bearer " + token("oauth2_access_token");
      return fetch(resource, options);
    }
  };
  oauth.xhr = function(options, callback) {
    if (oauth.authenticated()) {
      return _doXHR();
    } else {
      if (o.auto) {
        oauth.authenticate(_doXHR);
        return;
      } else {
        callback("not authenticated", null);
        return;
      }
    }
    function _doXHR() {
      var url = options.prefix !== false ? o.apiUrl + options.path : options.path;
      return oauth.rawxhr(
        options.method,
        url,
        token("oauth2_access_token"),
        options.content,
        options.headers,
        done
      );
    }
    function done(err, xhr) {
      if (err) {
        callback(err);
      } else if (xhr.responseXML) {
        callback(err, xhr.responseXML);
      } else {
        callback(err, xhr.response);
      }
    }
  };
  oauth.rawxhr = function(method, url, access_token, data, headers, callback) {
    headers = headers || { "Content-Type": "application/x-www-form-urlencoded" };
    if (access_token) {
      headers.Authorization = "Bearer " + access_token;
    }
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (4 === xhr.readyState && 0 !== xhr.status) {
        if (/^20\d$/.test(xhr.status)) {
          callback(null, xhr);
        } else {
          callback(xhr, null);
        }
      }
    };
    xhr.onerror = function(e) {
      callback(e, null);
    };
    xhr.open(method, url, true);
    for (var h in headers) xhr.setRequestHeader(h, headers[h]);
    xhr.send(data);
    return xhr;
  };
  oauth.preauth = function(val) {
    if (val && val.access_token) {
      token("oauth2_access_token", val.access_token);
    }
    return oauth;
  };
  oauth.options = function(val) {
    if (!arguments.length) return o;
    o = val;
    o.apiUrl = o.apiUrl || "https://api.openstreetmap.org";
    o.url = o.url || "https://www.openstreetmap.org";
    o.auto = o.auto || false;
    o.singlepage = o.singlepage || false;
    o.loading = o.loading || function() {
    };
    o.done = o.done || function() {
    };
    return oauth.preauth(o);
  };
  oauth.options(o);
  return oauth;
}
function utilQsString(obj) {
  return Object.keys(obj).filter(function(key) {
    return obj[key] !== void 0;
  }).sort().map(function(key) {
    return encodeURIComponent(key) + "=" + encodeURIComponent(obj[key]);
  }).join("&");
}
function utilStringQs(str) {
  var i = 0;
  while (i < str.length && (str[i] === "?" || str[i] === "#")) i++;
  str = str.slice(i);
  return str.split("&").reduce(function(obj, pair) {
    var parts = pair.split("=");
    if (parts.length === 2) {
      obj[parts[0]] = decodeURIComponent(parts[1]);
    }
    return obj;
  }, {});
}
function _generatePkceChallenge(callback) {
  var code_verifier;
  var random = globalThis.crypto.getRandomValues(new Uint8Array(32));
  code_verifier = base64(random.buffer);
  var verifier = Uint8Array.from(Array.from(code_verifier).map(function(char) {
    return char.charCodeAt(0);
  }));
  globalThis.crypto.subtle.digest("SHA-256", verifier).then(function(hash) {
    var code_challenge = base64(hash);
    callback({
      code_challenge,
      code_verifier,
      code_challenge_method: "S256"
    });
  });
}
function generateState() {
  var state;
  var random = globalThis.crypto.getRandomValues(new Uint8Array(32));
  state = base64(random.buffer);
  return state;
}
function base64(buffer) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer))).replace(/\//g, "_").replace(/\+/g, "-").replace(/[=]/g, "");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  osmAuth
});
//# sourceMappingURL=osm-auth.cjs.map

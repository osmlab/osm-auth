var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var osm_auth_exports = {};
__export(osm_auth_exports, {
  osmAuth: () => osmAuth
});
module.exports = __toCommonJS(osm_auth_exports);
var import_store = __toESM(require("store"), 1);
function osmAuth(o) {
  var oauth = {};
  var usePkce = !o.singlepage || import_store.default.enabled;
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
  oauth.authenticate = function(callback) {
    if (oauth.authenticated()) {
      callback(null, oauth);
      return;
    }
    oauth.logout();
    if (usePkce) {
      generatePkceChallenge(function(pkce) {
        _authenticate(pkce, callback);
      });
    } else {
      _authenticate(void 0, callback);
    }
  };
  function _authenticate(pkce, callback) {
    var state = generateState();
    var url = o.url + "/oauth2/authorize?" + utilQsString({
      client_id: o.client_id,
      redirect_uri: o.redirect_uri,
      response_type: "code",
      scope: o.scope,
      state,
      code_challenge: usePkce ? pkce.code_challenge : void 0,
      code_challenge_method: usePkce ? pkce.code_challenge_method : void 0
    });
    if (o.singlepage) {
      var params = utilStringQs(window.location.search.slice(1));
      if (params.code) {
        state = token("oauth2_state");
        token("oauth2_state", "");
        var code_verifier = token("oauth2_pkce_code_verifier");
        token("oauth2_pkce_code_verifier", "");
        getAccessToken(params.code, code_verifier, accessTokenDone);
      } else {
        token("oauth2_state", state);
        if (usePkce) {
          token("oauth2_pkce_code_verifier", pkce.code_verifier);
        }
        window.location = url;
      }
    } else {
      var w = 600;
      var h = 550;
      var settings = [
        ["width", w],
        ["height", h],
        ["left", window.screen.width / 2 - w / 2],
        ["top", window.screen.height / 2 - h / 2]
      ].map(function(x) {
        return x.join("=");
      }).join(",");
      var popup = window.open("about:blank", "oauth_window", settings);
      oauth.popupWindow = popup;
      popup.location = url;
      if (!popup) {
        var error = new Error("Popup was blocked");
        error.status = "popup-blocked";
        callback(error);
      }
    }
    window.authComplete = function(url2) {
      var params2 = utilStringQs(url2.split("?")[1]);
      if (params2.state !== state) {
        error = new Error("Invalid state");
        error.status = "invalid-state";
        callback(error);
      }
      getAccessToken(params2.code, usePkce && pkce.code_verifier, accessTokenDone);
      delete window.authComplete;
    };
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
  function getAccessToken(auth_code, code_verifier, accessTokenDone) {
    var url = o.url + "/oauth2/token?" + utilQsString({
      client_id: o.client_id,
      redirect_uri: o.redirect_uri,
      grant_type: "authorization_code",
      code: auth_code,
      code_verifier: usePkce ? code_verifier : void 0
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
    getAccessToken(auth_code, token("oauth2_code_verifier"), accessTokenDone);
    function accessTokenDone(err, xhr) {
      o.done();
      if (err) {
        callback(err);
        return;
      }
      var access_token = JSON.parse(xhr.response);
      token("oauth2_access_token", access_token.access_token);
      token("oauth2_pkce_code_verifier", "");
      token("oauth2_state", "");
      callback(null, oauth);
    }
  };
  oauth.fetch = function(path, options, callback) {
    if (oauth.authenticated()) {
      return run();
    } else {
      if (o.auto) {
        oauth.authenticate(run);
        return;
      } else {
        callback("not authenticated", null);
        return;
      }
    }
    function run() {
      var url = options.prefix !== false ? o.url + path : path;
      var headers = options.headers || { "Content-Type": "application/x-www-form-urlencoded" };
      headers.Authorization = "Bearer " + token("oauth2_access_token");
      return fetch(url, {
        method: options.method,
        body: options.body,
        headers
      }).then((resp) => {
        var contentType = resp.headers.get("content-type").split(";")[0];
        switch (contentType) {
          case "text/html":
          case "text/xml":
            return resp.text().then(
              (txt) => new window.DOMParser().parseFromString(txt, contentType)
            );
          case "application/html":
            return resp.json();
          default:
            return resp.text();
        }
      });
    }
  };
  oauth.xhr = function(options, callback) {
    if (oauth.authenticated()) {
      return run();
    } else {
      if (o.auto) {
        oauth.authenticate(run);
        return;
      } else {
        callback("not authenticated", null);
        return;
      }
    }
    function run() {
      var url = options.prefix !== false ? o.url + options.path : options.path;
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
    for (var h in headers)
      xhr.setRequestHeader(h, headers[h]);
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
    if (!arguments.length)
      return o;
    o = val;
    o.url = o.url || "https://www.openstreetmap.org";
    o.auto = o.auto || false;
    o.singlepage = o.singlepage || false;
    usePkce = !o.singlepage || import_store.default.enabled;
    o.loading = o.loading || function() {
    };
    o.done = o.done || function() {
    };
    return oauth.preauth(o);
  };
  var token;
  if (import_store.default.enabled) {
    token = function(x, y) {
      if (arguments.length === 1)
        return import_store.default.get(o.url + x);
      else if (arguments.length === 2)
        return import_store.default.set(o.url + x, y);
    };
  } else {
    var storage = {};
    token = function(x, y) {
      if (arguments.length === 1)
        return storage[o.url + x];
      else if (arguments.length === 2)
        return storage[o.url + x] = y;
    };
  }
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
  while (i < str.length && (str[i] === "?" || str[i] === "#"))
    i++;
  str = str.slice(i);
  return str.split("&").reduce(function(obj, pair) {
    var parts = pair.split("=");
    if (parts.length === 2) {
      obj[parts[0]] = decodeURIComponent(parts[1]);
    }
    return obj;
  }, {});
}
function supportsWebCryptoAPI() {
  return window && window.crypto && window.crypto.getRandomValues && window.crypto.subtle && window.crypto.subtle.digest;
}
function generatePkceChallenge(callback) {
  var code_verifier;
  if (supportsWebCryptoAPI()) {
    var random = window.crypto.getRandomValues(new Uint8Array(32));
    code_verifier = base64(random.buffer);
    var verifier = Uint8Array.from(Array.from(code_verifier).map(function(char) {
      return char.charCodeAt(0);
    }));
    window.crypto.subtle.digest("SHA-256", verifier).then(function(hash) {
      var code_challenge = base64(hash);
      callback({
        code_challenge,
        code_verifier,
        code_challenge_method: "S256"
      });
    });
  } else {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    code_verifier = "";
    for (var i = 0; i < 64; i++) {
      code_verifier += chars[Math.floor(Math.random() * chars.length)];
    }
    callback({
      code_verifier,
      code_challenge: code_verifier,
      code_challenge_method: "plain"
    });
  }
}
function generateState() {
  var state;
  if (supportsWebCryptoAPI()) {
    var random = window.crypto.getRandomValues(new Uint8Array(32));
    state = base64(random.buffer);
  } else {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    state = "";
    for (var i = 0; i < 64; i++) {
      state += chars[Math.floor(Math.random() * chars.length)];
    }
  }
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

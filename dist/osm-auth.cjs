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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target, mod));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var osm_auth_exports = {};
__export(osm_auth_exports, {
  osmAuth: () => osmAuth
});
module.exports = __toCommonJS(osm_auth_exports);
var import_ohauth = __toESM(require("ohauth"), 1);
var import_store = __toESM(require("store"), 1);
function osmAuth(o) {
  var oauth = {};
  oauth.authenticated = function() {
    return !!token("access_token");
  };
  oauth.logout = function() {
    token("access_token", "");
    return oauth;
  };
  oauth.authenticate = function(callback) {
    if (oauth.authenticated())
      return callback();
    oauth.logout();
    var url = o.url + "/oauth2/authorize?" + import_ohauth.default.qsString({
      client_id: o.client_id,
      redirect_uri: o.redirect_uri,
      response_type: "code",
      scope: o.scope
    });
    if (!o.singlepage) {
      var w = 600;
      var h = 550;
      var settings = [
        ["width", w],
        ["height", h],
        ["left", screen.width / 2 - w / 2],
        ["top", screen.height / 2 - h / 2]
      ].map(function(x) {
        return x.join("=");
      }).join(",");
      var popup = window.open("about:blank", "oauth_window", settings);
      oauth.popupWindow = popup;
      popup.location = url;
      if (!popup) {
        var error = new Error("Popup was blocked");
        error.status = "popup-blocked";
        throw error;
      }
    }
    window.authComplete = function(url2) {
      var params = import_ohauth.default.stringQs(url2.split("?")[1]);
      get_access_token(params.code);
      delete window.authComplete;
    };
    function get_access_token(auth_code) {
      var url2 = o.url + "/oauth2/token?" + import_ohauth.default.qsString({
        client_id: o.client_id,
        grant_type: "authorization_code",
        code: auth_code,
        redirect_uri: o.redirect_uri,
        client_secret: o.client_secret
      });
      import_ohauth.default.xhr("POST", url2, null, null, {}, accessTokenDone);
      o.loading();
    }
    function accessTokenDone(err, xhr) {
      o.done();
      if (err)
        return callback(err);
      var access_token = JSON.parse(xhr.response);
      token("access_token", access_token.access_token);
      callback(null, oauth);
    }
  };
  oauth.bringPopupWindowToFront = function() {
    var brougtPopupToFront = false;
    try {
      if (oauth.popupWindow && !oauth.popupWindow.closed) {
        oauth.popupWindow.focus();
        brougtPopupToFront = true;
      }
    } catch (err) {
    }
    return brougtPopupToFront;
  };
  oauth.bootstrapToken = function(auth_code, callback) {
    function get_access_token(auth_code2) {
      var url = o.url + "/oauth2/token?" + import_ohauth.default.qsString({
        client_id: o.client_id,
        grant_type: "authorization_code",
        code: auth_code2,
        redirect_uri: o.redirect_uri,
        client_secret: o.client_secret
      });
      import_ohauth.default.xhr("POST", url, null, null, {}, accessTokenDone);
      o.loading();
    }
    function accessTokenDone(err, xhr) {
      o.done();
      if (err)
        return callback(err);
      var access_token = JSON.parse(xhr.response);
      token("access_token", access_token.access_token);
      callback(null, oauth);
    }
    get_access_token(auth_code);
  };
  oauth.xhr = function(options, callback) {
    if (!oauth.authenticated()) {
      if (o.auto) {
        return oauth.authenticate(run);
      } else {
        callback("not authenticated", null);
        return;
      }
    } else {
      return run();
    }
    function run() {
      var url = options.prefix !== false ? o.url + options.path : options.path;
      return import_ohauth.default.xhr(options.method, url, token("access_token"), options.content, options.options, done);
    }
    function done(err, xhr) {
      if (err)
        return callback(err);
      else if (xhr.responseXML)
        return callback(err, xhr.responseXML);
      else
        return callback(err, xhr.response);
    }
  };
  oauth.preauth = function(c) {
    if (!c)
      return;
    if (c.access_token)
      token("access_token", c.access_token);
    return oauth;
  };
  oauth.options = function(_) {
    if (!arguments.length)
      return o;
    o = _;
    o.url = o.url || "https://www.openstreetmap.org";
    o.singlepage = o.singlepage || false;
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  osmAuth
});
//# sourceMappingURL=osm-auth.cjs.map

if (typeof localStorage === "undefined" || localStorage === null) {
  var LocalStorage = require("node-localstorage").LocalStorage;
  global.localStorage = new LocalStorage("./scratch");
}

var test = require("tap").test;
var osmAuth = require("../.");

test("osmauth", function (t) {
  t.test(".options", function (t) {
    t.test("gets and sets new options", function (t) {
      localStorage.clear();
      var keys = {
        url: "https://www.openstreetmap.org",
        client_id: "h55M4tEsJDLVSFOUZ5EhbpJubiFdZh5YdRFA7Sn5gsQ",
        client_secret: "Ud8j4TWzQaNR6_HDSv_MprKDpS2Ewe1jIMTQNXEOAcs",
        redirect_uri: "http://127.0.0.1:8080/land.html",
        scope: "read_prefs write_api",
      };
      var auth = osmAuth(keys);
      t.same(auth.options(), keys);

      auth.options({ url: "foo" });
      t.same(auth.options().url, "foo");
      t.end();
    });

    t.end();
  });

  t.test("pre authorization", function (t) {
    t.test("is not initially authorized", function (t) {
      localStorage.clear();
      var auth = osmAuth({
        url: "https://www.openstreetmap.org",
        client_id: "h55M4tEsJDLVSFOUZ5EhbpJubiFdZh5YdRFA7Sn5gsQ",
        client_secret: "Ud8j4TWzQaNR6_HDSv_MprKDpS2Ewe1jIMTQNXEOAcs",
        redirect_uri: "http://127.0.0.1:8080/land.html",
        scope: "read_prefs write_api",
      });
      t.notOk(auth.authenticated());
      t.end();
    });

    t.test("can be preauthorized", function (t) {
      localStorage.clear();
      var auth = osmAuth({
        url: "https://www.openstreetmap.org",
        client_id: "h55M4tEsJDLVSFOUZ5EhbpJubiFdZh5YdRFA7Sn5gsQ",
        client_secret: "Ud8j4TWzQaNR6_HDSv_MprKDpS2Ewe1jIMTQNXEOAcs",
        redirect_uri: "http://127.0.0.1:8080/land.html",
        scope: "read_prefs write_api",
        access_token: "foo",
      });
      t.ok(auth.authenticated());
      t.end();
    });

    t.end();
  });

  t.end();
});

localStorage._deleteLocation();

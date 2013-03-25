all: osmauth.min.js osmauth.dev.js

osmauth.js: index.js package.json req.js
	browserify req.js > osmauth.js

osmauth.dev.js: index.js package.json req.js
	browserify -d req.js > osmauth.dev.js

osmauth.min.js: osmauth.js
	uglifyjs osmauth.js -c > osmauth.min.js

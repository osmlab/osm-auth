all: osmauth.min.js

osmauth.js: index.js package.json
	browserify index.js -s osmAuth > osmauth.js

osmauth.min.js: osmauth.js
	uglifyjs osmauth.js -c > osmauth.min.js

clean:
	rm osmauth.*

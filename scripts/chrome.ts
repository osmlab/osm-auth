import { launch } from 'chrome-launcher';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { styleText } from 'node:util';
import { stopListenerAsync } from './stop_listener.ts';

//
// Launches Chrome with the remote debugging protocol enabled, opened to the local demo page.
// Tools (and coding agents) can then attach with Playwright's `connectOverCDP('http://127.0.0.1:9222')`
// to drive the demo and the login popup in this browser session (see `scripts/cdp.ts`).
//
// - It uses its own profile in `.chrome-debug/` (gitignored), never your everyday Chrome profile.
//   Log in to an OSM test account there once, and the session is kept between runs.
// - Start the local server first (`bun run start`), so the page has something to load.
// - Close the browser window, or press Ctrl-C here, to stop.
// - Running this again replaces a debug Chrome that is already running (e.g. one a coding agent
//   started in the background), so whoever starts it last gets the window to control.
//
const port = 9222;
const startingUrl = 'http://127.0.0.1:8080/';
const userDataDir = resolve(import.meta.dir, '../.chrome-debug');

mkdirSync(userDataDir, { recursive: true });

// Stop the debug Chrome that's already running, if any. Otherwise chrome-launcher would reuse it,
// and this script couldn't stop it. Only a Chrome using our profile folder is stopped.
await stopListenerAsync(port, /\.chrome-debug/);

const chrome = await launch({
  port: port,
  startingUrl: startingUrl,
  userDataDir: userDataDir,
  ignoreDefaultFlags: true,  // chrome-launcher's defaults disable extensions, which we want to keep
  chromeFlags: [
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding'
  ]
});

console.log(styleText('greenBright', `Chrome is listening for remote debugging on http://127.0.0.1:${chrome.port}`));
console.log(styleText('green', `Profile:  ${userDataDir}`));
console.log(styleText('green', `Opened:   ${startingUrl}`));
console.log('Close the browser window, or press Ctrl-C here, to stop.');

chrome.process.on('exit', () => process.exit(0));

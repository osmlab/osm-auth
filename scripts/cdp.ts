import { chromium, type Page } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { styleText } from 'node:util';

//
// Drives the demo page in a Chrome that was started with remote debugging (`bun run start:chrome`).
// It attaches to the running browser, so it sees exactly what the developer sees.
//
//   bun run cdp pages                        List the open tabs and popups
//   bun run cdp shot <out.png> [match]       Screenshot a tab
//   bun run cdp eval <file.js> [match]       Run a snippet in a tab and print what it returns (as JSON)
//   bun run cdp eval -e "<code>" [match]     Same, with the snippet inline
//   bun run cdp click <selector> [match]     Click an element (a real user gesture, so popups may open)
//   bun run cdp goto <url>                   Navigate the demo tab
//   bun run cdp reload [setup.js]            Reload the demo tab, then run an optional setup snippet
//   bun run cdp press <key> [match]          Press a key in a tab (e.g. Escape)
//
// `match` picks the tab whose URL contains it (e.g. `oauth2/authorize` for the login popup);
// without it, commands go to the demo tab on http://127.0.0.1:8080.
// Snippets are function bodies: use `return` to send a value back. The demo page has `osmAuth` as a global.
// Disconnecting leaves the browser running.
//
const cdpURL = 'http://127.0.0.1:9222';
const demoURL = 'http://127.0.0.1:8080';
const [cmd, ...args] = process.argv.slice(2);

const browser = await chromium.connectOverCDP(cdpURL).catch(() => {
  console.error(styleText('redBright', `No Chrome at ${cdpURL}. Start one with \`bun run start:chrome\`.`));
  process.exit(1);
});

const pages = browser.contexts().flatMap(c => c.pages());

// The tab whose URL contains `match`, or the demo tab
const findPage = (match?: string): Page => {
  const page = match
    ? pages.find(p => p.url().includes(match))
    : (pages.find(p => p.url().startsWith(demoURL)) ?? pages[0]);
  if (!page) {
    console.error(styleText('redBright', match ? `No open tab matching '${match}'.` : 'No open tab found.'));
    process.exit(1);
  }
  return page;
};

// The snippet is sent to the page as a string and runs there, wrapped as an async function body
// (so it can `await`, and `return` a value or a promise).
const run = async (page: Page, body: string): Promise<void> => {
  const result = await page.evaluate(`(async () => {\n${body}\n})()`);
  console.log(JSON.stringify(result, null, 2));
};

if (cmd === 'pages') {
  for (const page of pages) console.log(page.url());

} else if (cmd === 'shot' && args[0]) {
  const page = findPage(args[1]);
  await page.screenshot({ path: args[0] });
  console.log(`Saved ${args[0]} from ${page.url()}`);

} else if (cmd === 'eval' && args[0] === '-e' && args[1]) {
  await run(findPage(args[2]), args[1]);

} else if (cmd === 'eval' && args[0]) {
  await run(findPage(args[1]), readFileSync(args[0], 'utf8'));

} else if (cmd === 'click' && args[0]) {
  await findPage(args[1]).click(args[0]);
  console.log(`Clicked ${args[0]}`);

} else if (cmd === 'goto' && args[0]) {
  const page = findPage();
  await page.goto(args[0]);
  console.log(`Now at ${page.url()}`);

} else if (cmd === 'reload') {
  const page = findPage();
  await page.reload();
  console.log(`Reloaded ${page.url()}`);
  if (args[0]) {
    await run(page, readFileSync(args[0], 'utf8'));
  }

} else if (cmd === 'press' && args[0]) {
  await findPage(args[1]).keyboard.press(args[0]);
  console.log(`Pressed ${args[0]}`);

} else {
  console.log('Usage: bun run cdp pages | shot <out.png> [match] | eval <file.js> [match] | eval -e "<code>" [match]');
  console.log('                       | click <selector> [match] | goto <url> | reload [setup.js] | press <key> [match]');
}

// Disconnect, without closing the developer's browser.
await browser.close().catch(() => {});

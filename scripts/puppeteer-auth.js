/**
 * Connectify Puppeteer Authenticated Launch
 * Runs headless, opening a visible browser window only while the user logs in.
 */

'use strict';

const utils = require('./puppeteer-utils');

async function openPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  return page;
}

/**
 * Launches a browser with an authenticated Connect session.
 *
 * options.headless: true = never show a window (fail if the session is invalid),
 *                   false = visible for the whole run (--headful),
 *                   null  = headless, except for an interactive login window.
 * deps lets tests replace launchBrowser/authenticate.
 * Returns { browser, page, method }.
 */
async function launchAuthenticated(options = {}, deps = {}) {
  const {
    launchBrowser = utils.launchBrowser,
    authenticate = utils.authenticate,
    log = console.log
  } = deps;
  const {
    headless = null,
    username,
    password,
    sessionFile = utils.DEFAULT_SESSION_FILE,
    tag = 'Connectify'
  } = options;
  const keepVisible = headless === false;
  const credentials = { username, password, sessionFile };

  // 1. Saved session or credentials
  let browser = await launchBrowser({ headless: !keepVisible, loadExtension: true });
  let page = await openPage(browser);
  let auth = await authenticate(page, { ...credentials, interactive: keepVisible });
  if (auth?.success) return { browser, page, method: auth.method };

  await browser.close().catch(() => {});
  if (keepVisible) throw new Error('Authentication failed or was cancelled.');
  if (headless === true) {
    throw new Error('The saved session has expired and --headless was requested without valid credentials. ' +
      'Run without --headless to log in, or provide --username and --password.');
  }

  // 2. Visible window for the interactive login only
  log(`[${tag}] Opening a browser window for login. It closes on its own once you're signed in.`);
  browser = await launchBrowser({ headless: false, loadExtension: true });
  page = await openPage(browser);
  auth = await authenticate(page, { ...credentials, interactive: true });
  await browser.close().catch(() => {});
  if (!auth?.success) throw new Error('Interactive login failed or was cancelled.');

  // 3. Back to headless with the session the login just saved
  log(`[${tag}] Login saved. Continuing headless...`);
  browser = await launchBrowser({ headless: true, loadExtension: true });
  page = await openPage(browser);
  auth = await authenticate(page, { ...credentials, interactive: false });
  if (!auth?.success) {
    await browser.close().catch(() => {});
    throw new Error('The saved session was not accepted after relaunching headless.');
  }
  return { browser, page, method: 'interactive' };
}

module.exports = { launchAuthenticated };

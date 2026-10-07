/**
 * Connectify Puppeteer Utilities
 * Shared helper module for browser lifecycle, authentication, session
 * persistence, and WCAG color contrast calculations.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const puppeteer = require('puppeteer');

const DEFAULT_SESSION_FILE = 'connect_session.json';
const EXTENSION_ROOT = path.resolve(__dirname, '..');

/**
 * Resolves the Chrome executable path, falling back to macOS application path.
 */
function getChromeExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (process.platform === 'darwin' && fs.existsSync(macChrome)) {
    return macChrome;
  }
  try {
    return puppeteer.executablePath();
  } catch {
    return undefined;
  }
}

/**
 * Launches a Puppeteer browser instance configured for Connectify.
 */
async function launchBrowser(options = {}) {
  const {
    headless = true,
    loadExtension = true,
    slowMo = 0,
    viewport = { width: 1280, height: 900 }
  } = options;

  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--window-size=1280,900'
  ];

  if (loadExtension) {
    args.push(`--disable-extensions-except=${EXTENSION_ROOT}`);
    args.push(`--load-extension=${EXTENSION_ROOT}`);
  }

  const execPath = getChromeExecutablePath();
  const launchConfig = {
    headless: headless ? 'shell' : false,
    args,
    slowMo,
    defaultViewport: viewport
  };

  if (execPath && fs.existsSync(execPath)) {
    launchConfig.executablePath = execPath;
  }

  const browser = await puppeteer.launch(launchConfig);
  return browser;
}

/**
 * Saves current page/browser cookies to a JSON file.
 */
async function saveSession(page, sessionPath = DEFAULT_SESSION_FILE) {
  try {
    const cookies = await page.cookies();
    const resolvedPath = path.resolve(sessionPath);
    fs.writeFileSync(resolvedPath, JSON.stringify(cookies, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.warn(`[PuppeteerUtils] Failed to save session cookies: ${err.message}`);
    return false;
  }
}

/**
 * Loads session cookies from a JSON file into the page.
 */
async function loadSession(page, sessionPath = DEFAULT_SESSION_FILE) {
  try {
    const resolvedPath = path.resolve(sessionPath);
    if (!fs.existsSync(resolvedPath)) return false;
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    const cookies = JSON.parse(raw);
    if (Array.isArray(cookies) && cookies.length > 0) {
      await page.setCookie(...cookies);
      return true;
    }
  } catch (err) {
    console.warn(`[PuppeteerUtils] Failed to load session cookies: ${err.message}`);
  }
  return false;
}

/**
 * Checks if the page is currently authenticated on Connect.
 */
async function isAuthenticated(page) {
  try {
    const url = page.url();
    if (!url.includes('connect.det.wa.edu.au')) return false;
    if (url.includes('/login') || url.includes('login.det.wa.edu.au')) return false;
    const bodyText = await page.evaluate(() => document.body?.innerText || '');
    if (/sign\s*in|log\s*in\s*to\s*connect|session\s*expired/i.test(bodyText)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Performs login using credentials, saved session, or interactive browser prompt.
 */
async function authenticate(page, options = {}) {
  const {
    username = process.env.CONNECT_USER || process.env.CONNECT_USERNAME,
    password = process.env.CONNECT_PASSWORD || process.env.CONNECT_PASS,
    interactive = false,
    sessionFile = DEFAULT_SESSION_FILE,
    timeoutMs = 120000
  } = options;

  // 1. Try loading existing session
  const hasSession = await loadSession(page, sessionFile);
  if (hasSession) {
    try {
      await page.goto('https://connect.det.wa.edu.au/group/students/ui/my-connect', {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });
      if (await isAuthenticated(page)) {
        console.log('[PuppeteerUtils] Restored authenticated session from file.');
        return { success: true, method: 'session' };
      }
    } catch {}
  }

  // 2. Perform automated credential login if provided
  if (username && password) {
    console.log(`[PuppeteerUtils] Logging in with username "${username}"...`);
    await page.goto('https://connect.det.wa.edu.au/login', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    try {
      await page.waitForSelector('#ssousername, input[name="username"]', { timeout: 15000 });
      const userSel = await page.$('#ssousername') ? '#ssousername' : 'input[name="username"]';
      const passSel = await page.$('#password') ? '#password' : 'input[name="password"]';

      await page.type(userSel, username);
      await page.type(passSel, password);

      const terms = await page.$('input[name="acceptterms"]');
      if (terms) {
        const checked = await (await terms.getProperty('checked')).jsonValue();
        if (!checked) await terms.click();
      }

      const loginBtn = await page.$('#login, button[type="submit"], input[type="submit"]');
      if (loginBtn) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
          loginBtn.click()
        ]);
      }

      if (await isAuthenticated(page)) {
        await saveSession(page, sessionFile);
        console.log('[PuppeteerUtils] Automated login successful. Session saved.');
        return { success: true, method: 'credentials' };
      }
    } catch (err) {
      console.warn(`[PuppeteerUtils] Automated login attempt failed: ${err.message}`);
    }
  }

  // 3. Fallback: Interactive browser login
  if (interactive || (!username && !hasSession)) {
    console.log('\n' + '='.repeat(64));
    console.log('INTERACTIVE LOGIN REQUIRED');
    console.log('Please log into Connect in the browser window.');
    console.log('Complete any department SSO, 2FA or security prompts.');
    console.log('The script will automatically continue once logged in.');
    console.log('='.repeat(64) + '\n');

    await page.goto('https://connect.det.wa.edu.au/login', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    }).catch(() => {});

    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      await new Promise(r => setTimeout(r, 2000));
      if (await isAuthenticated(page)) {
        await saveSession(page, sessionFile);
        console.log('[PuppeteerUtils] Login detected! Session saved.');
        return { success: true, method: 'interactive' };
      }
    }
    throw new Error('Interactive login timed out after ' + (timeoutMs / 1000) + ' seconds.');
  }

  return { success: false, method: 'none' };
}

/**
 * Calculates WCAG 2.1 relative luminance and contrast ratio.
 */
function sRgbToLinear(c) {
  const norm = c / 255;
  return norm <= 0.03928 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
}

function calculateLuminance(r, g, b) {
  return 0.2126 * sRgbToLinear(r) + 0.7152 * sRgbToLinear(g) + 0.0722 * sRgbToLinear(b);
}

function calculateContrastRatio(rgb1, rgb2) {
  const l1 = calculateLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = calculateLuminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

module.exports = {
  EXTENSION_ROOT,
  DEFAULT_SESSION_FILE,
  getChromeExecutablePath,
  launchBrowser,
  saveSession,
  loadSession,
  isAuthenticated,
  authenticate,
  sRgbToLinear,
  calculateLuminance,
  calculateContrastRatio
};

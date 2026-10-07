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

    // Check if interactive login form is present on page
    const hasLoginForm = await page.evaluate(() => {
      return Boolean(document.querySelector('#ssousername, input[name="username"], input[name="password"], form[action*="login"]'));
    }).catch(() => false);
    if (hasLoginForm) return false;

    // Check for positive indicators of authenticated portal
    const hasAuthIndicator = await page.evaluate(() => {
      const hasLogout = Boolean(document.querySelector('a[href*="logout"], a[href*="signout"], button[title*="Logout" i], button[title*="Sign out" i]'));
      const hasPortalNav = Boolean(document.querySelector('.cvr-c-primary-menu, .cvr-c-navbar, #navigation, .navigation-bar, .my-classes, #header-profile, #p_p_id_56_INSTANCE_'));
      return hasLogout || hasPortalNav;
    }).catch(() => false);
    if (hasAuthIndicator) return true;

    const bodyText = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
    if (/sign\s*in\s+to|log\s*in\s*to\s*connect|session\s*expired/i.test(bodyText)) return false;
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
      await waitForPageReady(page, 1500);
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
    console.log('A Chrome browser window has opened for you.');
    console.log('Please log into Connect in the browser window.');
    console.log('Complete any department SSO, 2FA or security prompts.');
    console.log('The script will automatically detect login and proceed.');
    console.log('='.repeat(64) + '\n');

    await page.goto('https://connect.det.wa.edu.au/login', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    }).catch(() => {});

    await page.bringToFront().catch(() => {});

    const startTime = Date.now();
    let lastLogTime = 0;
    while (Date.now() - startTime < timeoutMs) {
      await new Promise(r => setTimeout(r, 2000));
      const now = Date.now();
      const elapsed = Math.round((now - startTime) / 1000);
      const remaining = Math.max(0, Math.round((timeoutMs - (now - startTime)) / 1000));

      if (now - lastLogTime >= 5000) {
        lastLogTime = now;
        const currentUrl = page.url();
        console.log(`[PuppeteerUtils] Waiting for login... (${elapsed}s elapsed, ${remaining}s remaining) | Current URL: ${currentUrl}`);
      }

      if (await isAuthenticated(page)) {
        await saveSession(page, sessionFile);
        console.log('\n[PuppeteerUtils] Login detected! Authenticated session saved to ' + path.basename(sessionFile));
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

/**
 * Audits all UI elements (buttons, glyphs, icons, inputs, tabs) on the current
 * page to ensure a minimum 3.0:1 contrast ratio against their background.
 */
async function auditPageUiContrast(page) {
  return await page.evaluate(() => {
    function parseRgb(colorStr) {
      if (!colorStr) return null;
      const match = colorStr.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
      if (!match) return null;
      return {
        r: parseFloat(match[1]),
        g: parseFloat(match[2]),
        b: parseFloat(match[3]),
        a: match[4] !== undefined ? parseFloat(match[4]) : 1.0
      };
    }

    function sRgbToLinear(c) {
      const norm = c / 255;
      return norm <= 0.03928 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
    }

    function calculateLuminance(r, g, b) {
      return 0.2126 * sRgbToLinear(r) + 0.7152 * sRgbToLinear(g) + 0.0722 * sRgbToLinear(b);
    }

    function calculateContrast(rgb1, rgb2) {
      const l1 = calculateLuminance(rgb1.r, rgb1.g, rgb1.b);
      const l2 = calculateLuminance(rgb2.r, rgb2.g, rgb2.b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }

    function getEffectiveBg(el) {
      let curr = el;
      while (curr && curr !== document.documentElement) {
        const style = window.getComputedStyle(curr);
        const bg = parseRgb(style.backgroundColor);
        if (bg && bg.a > 0.05) return bg;
        curr = curr.parentElement;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    }

    function getSelector(el) {
      if (el.id) return '#' + el.id;
      let path = el.tagName.toLowerCase();
      if (el.className && typeof el.className === 'string') {
        const cls = el.className.trim().split(/\s+/).filter(c => !c.startsWith('ng-')).slice(0, 2).join('.');
        if (cls) path += '.' + cls;
      }
      return path;
    }

    const UI_SELECTOR = [
      'button',
      '[role="button"]',
      '.v-button',
      '.mat-button',
      '.mat-raised-button',
      '.mat-icon-button',
      '.eds-o-button',
      'input[type="button"]',
      'input[type="submit"]',
      '.mat-icon',
      '.material-icons',
      '[class*="icon-"]',
      '[class*="cvr-c-icon"]',
      '[class*="eds-c-icon"]',
      '.connect-webfont',
      '.cx-handle-arrow',
      '.connectea-theme-arrow',
      'svg',
      'i',
      '.v-icon',
      '.mat-tab-label',
      '.mat-tab-link',
      '.v-menubar-menuitem',
      '.cvr-c-primary-navigation a',
      'input:not([type="hidden"])',
      'select',
      'textarea',
      '.mat-select'
    ].join(', ');

    const elements = document.querySelectorAll(UI_SELECTOR);
    const violations = [];
    let auditedCount = 0;

    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const style = window.getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none' || parseFloat(style.opacity) === 0) continue;

      auditedCount++;

      let fg = parseRgb(style.color);
      const tag = el.tagName.toLowerCase();
      if (tag === 'svg' || el.closest('svg')) {
        const fill = parseRgb(style.fill);
        const stroke = parseRgb(style.stroke);
        if (fill && fill.a > 0.05 && style.fill !== 'none') fg = fill;
        else if (stroke && stroke.a > 0.05 && style.stroke !== 'none') fg = stroke;
      }

      const hasText = (el.innerText || el.textContent || '').trim().length > 0;
      if (!hasText && !['svg', 'i'].includes(tag)) {
        const border = parseRgb(style.borderColor);
        if (border && border.a > 0.5 && parseFloat(style.borderWidth) > 0) {
          fg = border;
        }
      }

      const bg = getEffectiveBg(el);
      if (!fg || !bg) continue;

      const cr = calculateContrast(fg, bg);
      if (cr < 3.0) {
        const label = (el.innerText || el.getAttribute('aria-label') || el.title || el.placeholder || tag).trim().slice(0, 30);
        violations.push({
          selector: getSelector(el),
          tagName: tag,
          label,
          contrast: parseFloat(cr.toFixed(2)),
          fgColor: `rgb(${Math.round(fg.r)}, ${Math.round(fg.g)}, ${Math.round(fg.b)})`,
          bgColor: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`
        });
      }
    }

    const uniqueMap = new Map();
    for (const v of violations) {
      const key = `${v.selector}:${v.label}`;
      if (!uniqueMap.has(key)) uniqueMap.set(key, v);
    }

    return {
      auditedCount,
      violations: Array.from(uniqueMap.values())
    };
  });
}

/**
 * Waits for network idle, document readyState, disappearance of loading spinners,
 * and an explicit settling delay to ensure dynamic portlets fully render.
 */
async function waitForPageReady(page, postDelayMs = 1250) {
  try {
    // 1. Wait for document.readyState === 'complete'
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 }).catch(() => {});

    // 2. Wait for short network idle window (graceful timeout)
    if (typeof page.waitForNetworkIdle === 'function') {
      await page.waitForNetworkIdle({ idleTime: 400, timeout: 3000 }).catch(() => {});
    }

    // 3. Wait for any active Connect/CVR loading spinners to clear
    await page.waitForFunction(() => {
      const spinners = document.querySelectorAll(
        '.cvr-c-spinner, .v-loading-indicator, .eds-c-spinner, mat-spinner, .loading-mask, [aria-busy="true"]'
      );
      for (const s of spinners) {
        if (s.offsetParent !== null && window.getComputedStyle(s).display !== 'none' && window.getComputedStyle(s).visibility !== 'hidden') {
          return false;
        }
      }
      return true;
    }, { timeout: 3500 }).catch(() => {});
  } catch {}

  // 4. Post-load delay for async AJAX portlets / animations to settle
  if (postDelayMs > 0) {
    await new Promise(r => setTimeout(r, postDelayMs));
  }
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
  waitForPageReady,
  sRgbToLinear,
  calculateLuminance,
  calculateContrastRatio,
  auditPageUiContrast
};

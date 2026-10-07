/**
 * Connectify Theme Unstyled Elements & Parity Tester
 * Audits one or more URLs (or a crawled URL list) across all registered themes against
 * the Connect Native Theme (untouched native styling) baseline:
 * 1. Ensures identical fonts, sizes, weights, and styles as Connect native styling.
 * 2. Ensures identical margins as Connect native styling.
 * 3. Ensures identical element sizes (bounding boxes) as Connect native styling.
 * 4. Ensures no more or fewer visible elements (exact visibility parity).
 * 5. Dispatches clicks to interactive JavaScript buttons (accordions, tabs, cards)
 *    to audit expanded states.
 * 6. Enforces WCAG contrast standards (>= 4.5:1 body, >= 3.0:1 large, no critical < 2.0:1).
 * 7. Flags unadapted light background bleed in dark themes and native purple ink bars.
 * 8. Accepts multiple URLs sequentially via --urls-file, --urls, --paste, or crawled_urls.txt.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const utils = require('./puppeteer-utils');

const DEFAULT_PAGE = 'https://connect.det.wa.edu.au/group/students/ui/my-settings/assessment-outlines';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: null,
    file: null,
    urlsFile: null,
    urlsList: null,
    paste: false,
    theme: 'all',
    clickButtons: true,
    marginTolerance: 1.0,
    sizeTolerance: 2.0,
    screenshots: false,
    screenshotsDir: path.resolve(__dirname, '..', 'screenshots'),
    outputJson: path.resolve(__dirname, '..', 'theme_unstyled_report.json'),
    outputMd: path.resolve(__dirname, '..', 'theme_unstyled_report.md'),
    headful: false,
    username: null,
    password: null,
    interactive: false,
    session: path.resolve(__dirname, '..', utils.DEFAULT_SESSION_FILE)
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--url' && args[i + 1]) options.url = args[++i];
    else if (a === '--file' && args[i + 1]) options.file = args[++i];
    else if (a === '--urls-file' && args[i + 1]) options.urlsFile = path.resolve(args[++i]);
    else if (a === '--urls' && args[i + 1]) options.urlsList = args[++i].split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--paste') options.paste = true;
    else if (a === '--theme' && args[i + 1]) options.theme = args[++i];
    else if (a === '--no-click-buttons') options.clickButtons = false;
    else if (a === '--margin-tolerance' && args[i + 1]) options.marginTolerance = parseFloat(args[++i]);
    else if (a === '--size-tolerance' && args[i + 1]) options.sizeTolerance = parseFloat(args[++i]);
    else if (a === '--screenshots') options.screenshots = true;
    else if (a === '--screenshots-dir' && args[i + 1]) options.screenshotsDir = path.resolve(args[++i]);
    else if (a === '--output' && args[i + 1]) options.outputJson = path.resolve(args[++i]);
    else if (a === '--report-md' && args[i + 1]) options.outputMd = path.resolve(args[++i]);
    else if (a === '--headful' || a === '--no-headless') options.headful = true;
    else if ((a === '--username' || a === '-u') && args[i + 1]) options.username = args[++i];
    else if ((a === '--password' || a === '-p') && args[i + 1]) options.password = args[++i];
    else if (a === '--interactive') options.interactive = true;
    else if (a === '--session' && args[i + 1]) options.session = path.resolve(args[++i]);
  }
  return options;
}

function readUrlsFromStdin() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    const lines = [];
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        rl.close();
      } else {
        lines.push(trimmed);
      }
    });
    rl.on('close', () => {
      resolve(lines);
    });
  });
}

async function resolveTargetUrls(options) {
  const urls = [];

  if (options.url) {
    urls.push(options.url);
  } else if (options.file) {
    urls.push('file://' + path.resolve(options.file));
  } else if (options.urlsList && options.urlsList.length > 0) {
    urls.push(...options.urlsList);
  } else if (options.urlsFile && fs.existsSync(options.urlsFile)) {
    console.log(`[ThemeAudit] Loading URLs from: ${options.urlsFile}`);
    const raw = fs.readFileSync(options.urlsFile, 'utf8');
    const lines = raw.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    urls.push(...lines);
  } else if (options.paste) {
    console.log('\n[ThemeAudit] Paste your URLs below (one per line). Press Enter on an empty line when finished:');
    const lines = await readUrlsFromStdin();
    urls.push(...lines);
  } else {
    // Check if crawled_urls.txt exists from previous crawler run
    const defaultUrlsPath = path.resolve(__dirname, '..', 'crawled_urls.txt');
    if (fs.existsSync(defaultUrlsPath)) {
      console.log(`[ThemeAudit] Found ${path.basename(defaultUrlsPath)} from directory crawler, loading URLs...`);
      const raw = fs.readFileSync(defaultUrlsPath, 'utf8');
      const lines = raw.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      urls.push(...lines);
    }
  }

  if (urls.length === 0) {
    urls.push(DEFAULT_PAGE);
  }

  return Array.from(new Set(urls));
}

/**
 * Dispatches clicks to interactive JavaScript buttons and accordion/tab triggers
 * on the page to expand collapsible panels and reveal dynamic UI components.
 */
async function clickInteractiveButtons(page) {
  return await page.evaluate(() => {
    const BUTTON_SELECTORS = [
      '.cvr-c-expansion-panel__trigger',
      '.eds-c-card__trigger',
      '.mat-tab-label:not(.mat-tab-disabled)',
      '.v-accordion-item-caption',
      '.v-button:not(.v-disabled)',
      'button:not([disabled]):not([type="submit"])',
      '[role="button"]:not([aria-disabled="true"])',
      '[aria-expanded="false"]'
    ].join(', ');

    const elements = document.querySelectorAll(BUTTON_SELECTORS);
    const clicked = [];

    for (const el of elements) {
      const text = (el.innerText || el.getAttribute('aria-label') || '').toLowerCase();
      if (/logout|signout|delete|remove|cancel|leave|exit|dismiss/i.test(text)) continue;
      if (el.tagName === 'A' || el.closest('a[href]')) continue;
      if (el.type === 'submit') continue;
      if (el.id === 'connectea-theme-toggle') continue;

      try {
        el.click();
        const tag = el.tagName.toLowerCase();
        const id = el.id ? '#' + el.id : '';
        const cls = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : '';
        clicked.push(`${tag}${id}${cls}`);
      } catch {}
    }
    return clicked;
  });
}

/**
 * Stamps all DOM elements with persistent audit IDs and captures the baseline
 * state from the Connect Native Theme (untouched native styling).
 */
async function captureNativeBaseline(page) {
  // Ensure Connect Native Theme is active (no dark mode, no theme tokens)
  await page.evaluate(() => {
    if (window.ConnectifyThemeRegistry?.setTheme) {
      window.ConnectifyThemeRegistry.setTheme('light');
    }
    document.documentElement.classList.remove('connectea-dark');
    document.documentElement.removeAttribute('data-connectea-theme');
    delete document.documentElement.dataset.connecteaTheme;
    if (document.body) {
      document.body.classList.remove('connectea-dark');
      document.body.removeAttribute('data-connectea-theme');
      delete document.body.dataset.connecteaTheme;
    }
    if (window.ConnectifyThemeRegistry?.clearCustomTokens) {
      window.ConnectifyThemeRegistry.clearCustomTokens();
    }
  });

  await new Promise(r => setTimeout(r, 400));

  return await page.evaluate(() => {
    function cleanFontFamily(f) {
      if (!f) return '';
      return f.replace(/['"]/g, '').toLowerCase().split(',').map(s => s.trim()).join(', ');
    }

    function normalizeWeight(w) {
      if (w === 'bold' || w === 'bolder') return 700;
      if (w === 'normal' || w === 'lighter') return 400;
      const num = parseInt(w, 10);
      return isNaN(num) ? 400 : num;
    }

    function getSelector(el) {
      if (el.id) return '#' + el.id;
      let path = el.tagName.toLowerCase();
      if (el.className && typeof el.className === 'string') {
        const cls = el.className.trim().split(/\s+/).filter(c => !c.startsWith('ng-') && !c.startsWith('cx-audit-')).slice(0, 2).join('.');
        if (cls) path += '.' + cls;
      }
      return path;
    }

    const allElements = document.querySelectorAll('body *');
    const baselineMap = {};
    let visibleCount = 0;

    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i];
      const auditId = 'cx_aud_' + i;
      el.dataset.cxAuditId = auditId;

      const tag = el.tagName.toLowerCase();
      if (['script', 'style', 'svg', 'path', 'noscript', 'meta', 'link'].includes(tag)) continue;

      const style = window.getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none' || parseFloat(style.opacity) === 0) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;

      visibleCount++;
      const text = (el.innerText || '').slice(0, 30).trim();

      baselineMap[auditId] = {
        auditId,
        selector: getSelector(el),
        tagName: tag,
        textSnippet: text,
        font: {
          family: cleanFontFamily(style.fontFamily),
          rawFamily: style.fontFamily,
          size: parseFloat(style.fontSize) || 14,
          weight: normalizeWeight(style.fontWeight),
          style: style.fontStyle
        },
        margin: {
          top: parseFloat(style.marginTop) || 0,
          right: parseFloat(style.marginRight) || 0,
          bottom: parseFloat(style.marginBottom) || 0,
          left: parseFloat(style.marginLeft) || 0
        },
        size: {
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10
        }
      };
    }

    return {
      totalElements: allElements.length,
      visibleCount,
      elements: baselineMap
    };
  });
}

/**
 * Audits the current theme against the Connect Native Theme baseline.
 */
async function auditThemeAgainstBaseline(page, themeId, isDarkTheme, baselineData, options) {
  return await page.evaluate((tid, isDark, baseline, opts) => {
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

    function getLuminance(r, g, b) {
      return 0.2126 * sRgbToLinear(r) + 0.7152 * sRgbToLinear(g) + 0.0722 * sRgbToLinear(b);
    }

    function getContrast(rgb1, rgb2) {
      const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
      const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
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
      return isDark ? { r: 18, g: 23, b: 31, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
    }

    function cleanFontFamily(f) {
      if (!f) return '';
      return f.replace(/['"]/g, '').toLowerCase().split(',').map(s => s.trim()).join(', ');
    }

    function normalizeWeight(w) {
      if (w === 'bold' || w === 'bolder') return 700;
      if (w === 'normal' || w === 'lighter') return 400;
      const num = parseInt(w, 10);
      return isNaN(num) ? 400 : num;
    }

    function getSelector(el) {
      if (el.id) return '#' + el.id;
      let path = el.tagName.toLowerCase();
      if (el.className && typeof el.className === 'string') {
        const cls = el.className.trim().split(/\s+/).filter(c => !c.startsWith('ng-') && !c.startsWith('cx-audit-')).slice(0, 2).join('.');
        if (cls) path += '.' + cls;
      }
      return path;
    }

    const issues = [];
    const baseMap = baseline.elements;
    const currentElements = document.querySelectorAll('body *');
    const currentVisibleIds = new Set();
    let currentVisibleCount = 0;

    for (let i = 0; i < currentElements.length; i++) {
      const el = currentElements[i];
      const auditId = el.dataset.cxAuditId || ('cx_aud_' + i);
      const tag = el.tagName.toLowerCase();
      if (['script', 'style', 'svg', 'path', 'noscript', 'meta', 'link'].includes(tag)) continue;

      const style = window.getComputedStyle(el);
      const isVisible = style.visibility !== 'hidden' && style.display !== 'none' && parseFloat(style.opacity) > 0;
      const rect = el.getBoundingClientRect();
      const hasBox = rect.width > 0 && rect.height > 0;
      const selector = getSelector(el);
      const text = (el.innerText || '').slice(0, 30).trim();

      if (isVisible && hasBox) {
        currentVisibleCount++;
        currentVisibleIds.add(auditId);

        // 1. Check Parity against Native Baseline
        const base = baseMap[auditId];
        if (base) {
          // A. Font Parity Check
          const currFontFamily = cleanFontFamily(style.fontFamily);
          const currFontSize = parseFloat(style.fontSize) || 14;
          const currFontWeight = normalizeWeight(style.fontWeight);

          if (currFontFamily !== base.font.family) {
            issues.push({
              category: 'PARITY',
              type: 'FONT_FAMILY_MISMATCH',
              severity: 'HIGH',
              selector,
              details: `Font family changed: Native "${base.font.rawFamily}" vs Theme "${style.fontFamily}"`,
              textSnippet: text
            });
          }

          if (Math.abs(currFontSize - base.font.size) > 0.5) {
            issues.push({
              category: 'PARITY',
              type: 'FONT_SIZE_MISMATCH',
              severity: 'MEDIUM',
              selector,
              details: `Font size changed: Native ${base.font.size}px vs Theme ${currFontSize}px`,
              textSnippet: text
            });
          }

          if (currFontWeight !== base.font.weight) {
            issues.push({
              category: 'PARITY',
              type: 'FONT_WEIGHT_MISMATCH',
              severity: 'HIGH',
              selector,
              details: `Font weight changed: Native ${base.font.weight} vs Theme ${currFontWeight}`,
              textSnippet: text
            });
          }

          // B. Margin Parity Check
          const curMarginTop = parseFloat(style.marginTop) || 0;
          const curMarginRight = parseFloat(style.marginRight) || 0;
          const curMarginBottom = parseFloat(style.marginBottom) || 0;
          const curMarginLeft = parseFloat(style.marginLeft) || 0;
          const mTol = opts.marginTolerance || 1.0;

          if (
            Math.abs(curMarginTop - base.margin.top) > mTol ||
            Math.abs(curMarginRight - base.margin.right) > mTol ||
            Math.abs(curMarginBottom - base.margin.bottom) > mTol ||
            Math.abs(curMarginLeft - base.margin.left) > mTol
          ) {
            issues.push({
              category: 'PARITY',
              type: 'MARGIN_MISMATCH',
              severity: 'MEDIUM',
              selector,
              details: `Margins changed: Native [${base.margin.top}, ${base.margin.right}, ${base.margin.bottom}, ${base.margin.left}] vs Theme [${curMarginTop}, ${curMarginRight}, ${curMarginBottom}, ${curMarginLeft}]`,
              textSnippet: text
            });
          }

          // C. Element Size Parity Check
          const curWidth = Math.round(rect.width * 10) / 10;
          const curHeight = Math.round(rect.height * 10) / 10;
          const sTol = opts.sizeTolerance || 2.0;

          if (Math.abs(curWidth - base.size.width) > sTol || Math.abs(curHeight - base.size.height) > sTol) {
            issues.push({
              category: 'PARITY',
              type: 'SIZE_MISMATCH',
              severity: 'MEDIUM',
              selector,
              details: `Element size changed: Native [${base.size.width}x${base.size.height}] vs Theme [${curWidth}x${curHeight}]`,
              textSnippet: text
            });
          }
        } else {
          issues.push({
            category: 'PARITY',
            type: 'EXTRA_ELEMENT_VISIBLE_IN_THEME',
            severity: 'HIGH',
            selector,
            details: `Extra element visible in theme not visible in Connect native styling`,
            textSnippet: text
          });
        }

        // 2. Styling & Unstyled Elements Checks
        const elBg = parseRgb(style.backgroundColor);
        const elColor = parseRgb(style.color);
        const effectiveBg = getEffectiveBg(el);

        // Native Purple Ink Bar
        if (el.classList.contains('mat-ink-bar')) {
          if (elBg && elBg.r > 90 && elBg.r < 125 && elBg.b > 160) {
            issues.push({
              category: 'STYLE',
              type: 'NATIVE_PURPLE_INK_BAR',
              severity: 'HIGH',
              selector,
              details: `Native purple .mat-ink-bar active: ${style.backgroundColor}`
            });
          }
        }

        // Background Bleed in Dark Mode
        if (isDark && elBg && elBg.a > 0.7 && !['img', 'video', 'canvas'].includes(tag)) {
          const bgLum = getLuminance(elBg.r, elBg.g, elBg.b);
          if (bgLum > 0.65 && elBg.r > 210 && elBg.g > 210 && elBg.b > 210) {
            if (!el.closest('.mat-badge, .badge, .status-pill, .chip-light')) {
              issues.push({
                category: 'STYLE',
                type: 'DARK_MODE_LIGHT_BG_BLEED',
                severity: 'HIGH',
                selector,
                details: `Light background bleed in dark theme: ${style.backgroundColor}`
              });
            }
          }
        }

        // Contrast Checks
        const hasDirectText = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
        if (hasDirectText && elColor && effectiveBg) {
          const cr = getContrast(elColor, effectiveBg);
          const fontSize = parseFloat(style.fontSize) || 14;
          const isBold = normalizeWeight(style.fontWeight) >= 600;
          const isLarge = fontSize >= 18 || (fontSize >= 14 && isBold);
          const minCr = isLarge ? 3.0 : 4.5;

          if (cr < 2.0) {
            issues.push({
              category: 'STYLE',
              type: 'CRITICAL_CONTRAST_VIOLATION',
              severity: 'CRITICAL',
              selector,
              details: `Illegible contrast ratio ${cr.toFixed(2)}:1 (color: ${style.color})`,
              contrast: cr.toFixed(2),
              textSnippet: text
            });
          } else if (cr < minCr) {
            issues.push({
              category: 'STYLE',
              type: 'LOW_CONTRAST_WARNING',
              severity: 'WARNING',
              selector,
              details: `Sub-standard contrast ratio ${cr.toFixed(2)}:1 < ${minCr}:1`,
              contrast: cr.toFixed(2),
              textSnippet: text
            });
          }
        }
      }
    }

    // Elements that were visible in native baseline but hidden in theme
    for (const auditId of Object.keys(baseMap)) {
      if (!currentVisibleIds.has(auditId)) {
        const base = baseMap[auditId];
        issues.push({
          category: 'PARITY',
          type: 'ELEMENT_HIDDEN_IN_THEME',
          severity: 'HIGH',
          selector: base.selector,
          details: `Element visible in Connect native styling is hidden in theme`,
          textSnippet: base.textSnippet
        });
      }
    }

    // Overall visible count check
    if (currentVisibleCount !== baseline.visibleCount) {
      issues.push({
        category: 'PARITY',
        type: 'VISIBLE_COUNT_MISMATCH',
        severity: 'HIGH',
        selector: 'body',
        details: `Visible elements count mismatch: Native ${baseline.visibleCount} vs Theme ${currentVisibleCount}`
      });
    }

    const uniqueMap = new Map();
    for (const iss of issues) {
      const key = `${iss.type}:${iss.selector}:${iss.details}`;
      if (!uniqueMap.has(key)) uniqueMap.set(key, iss);
    }

    return {
      visibleCount: currentVisibleCount,
      baselineVisibleCount: baseline.visibleCount,
      issues: Array.from(uniqueMap.values())
    };
  }, themeId, isDarkTheme, baselineData, options);
}

async function runThemeAudit() {
  const options = parseArgs();
  console.log('[ThemeAudit] Initializing Connectify Theme & Parity Auditor...');

  const targetUrls = await resolveTargetUrls(options);
  console.log(`[ThemeAudit] Loaded ${targetUrls.length} page URL(s) to audit one by one.`);

  const browser = await utils.launchBrowser({
    headless: !options.headful,
    loadExtension: true
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Handle authentication if any URL targets Connect
  const needsAuth = targetUrls.some(u => u.includes('connect.det.wa.edu.au'));
  if (needsAuth) {
    await utils.authenticate(page, {
      username: options.username,
      password: options.password,
      interactive: options.interactive,
      sessionFile: options.session
    });
  }

  // Load available themes (excluding native/light as that is the baseline)
  const availableThemes = [
    { id: 'dark', name: 'Dark', isDark: true },
    { id: 'quantum', name: 'Quantum Dark', isDark: true },
    { id: 'amoled', name: 'AMOLED Black', isDark: true },
    { id: 'midnight', name: 'Midnight Navy', isDark: true },
    { id: 'forest', name: 'Emerald Forest', isDark: true },
    { id: 'sunset', name: 'Twilight Plum', isDark: true },
    { id: 'custom', name: 'Custom Theme', isDark: true }
  ];

  const themesToTest = options.theme === 'all'
    ? availableThemes
    : availableThemes.filter(t => t.id === options.theme || t.name.toLowerCase() === options.theme.toLowerCase());

  if (themesToTest.length === 0) {
    console.error(`[ThemeAudit] Unknown theme: "${options.theme}". Available: ${availableThemes.map(t => t.id).join(', ')}`);
    await browser.close();
    process.exit(1);
  }

  if (options.screenshots && !fs.existsSync(options.screenshotsDir)) {
    fs.mkdirSync(options.screenshotsDir, { recursive: true });
  }

  const allPageResults = {};

  // Iterate across all target URLs one by one
  for (let pageIdx = 0; pageIdx < targetUrls.length; pageIdx++) {
    const targetUrl = targetUrls[pageIdx];
    console.log(`\n========================================================================`);
    console.log(`[Page ${pageIdx + 1}/${targetUrls.length}] Auditing: ${targetUrl}`);
    console.log(`========================================================================`);

    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await new Promise(r => setTimeout(r, 1200));

      if (options.clickButtons) {
        console.log('[ThemeAudit] Expanding interactive JavaScript buttons and accordions...');
        const clicked = await clickInteractiveButtons(page);
        console.log(`  └─ Dispatched clicks to ${clicked.length} interactive elements`);
        await new Promise(r => setTimeout(r, 500));
      }

      // 1. Capture Connect Native Theme Baseline
      console.log('[ThemeAudit] Capturing Connect Native Theme baseline (native styling)...');
      const baseline = await captureNativeBaseline(page);
      console.log(`  └─ Baseline captured: ${baseline.visibleCount} visible elements.`);

      const pageThemeResults = {};
      console.log(`Auditing ${themesToTest.length} theme(s) against Connect Native baseline:`);

      for (const t of themesToTest) {
        await page.evaluate((tid) => {
          if (window.ConnectifyThemeRegistry?.setTheme) {
            window.ConnectifyThemeRegistry.setTheme(tid);
          } else {
            document.documentElement.classList.add('connectea-dark');
            document.documentElement.dataset.connecteaTheme = tid;
          }
        }, t.id);

        if (options.clickButtons) {
          await clickInteractiveButtons(page);
        }
        await new Promise(r => setTimeout(r, 400));

        const auditResult = await auditThemeAgainstBaseline(page, t.id, t.isDark !== false, baseline, options);
        pageThemeResults[t.id] = { theme: t, audit: auditResult };

        const issues = auditResult.issues;
        const parityDiffs = issues.filter(i => i.category === 'PARITY').length;
        const criticalContrast = issues.filter(i => i.type === 'CRITICAL_CONTRAST_VIOLATION').length;
        const styleIssues = issues.filter(i => i.category === 'STYLE' && i.type !== 'CRITICAL_CONTRAST_VIOLATION').length;

        console.log(
          `• ${t.name.padEnd(16)} [${t.id}]: ` +
          `Visible: ${auditResult.visibleCount}/${auditResult.baselineVisibleCount} | ` +
          `Parity Diffs: ${parityDiffs} | Critical Contrast: ${criticalContrast} | Style Issues: ${styleIssues}`
        );

        if (options.screenshots) {
          const pageSlug = targetUrl.replace(/[^a-zA-Z0-9]/g, '_').slice(-30);
          const shotPath = path.join(options.screenshotsDir, `p${pageIdx + 1}_${pageSlug}_${t.id}.png`);
          await page.screenshot({ path: shotPath, fullPage: false });
          console.log(`  └─ Screenshot: ${shotPath}`);
        }
      }

      allPageResults[targetUrl] = {
        url: targetUrl,
        baselineVisibleCount: baseline.visibleCount,
        themes: pageThemeResults
      };
    } catch (err) {
      console.warn(`[ThemeAudit] Error auditing ${targetUrl}: ${err.message}`);
    }
  }

  console.log(`\n` + '='.repeat(72));
  console.log(`[ThemeAudit] Completed audit of ${Object.keys(allPageResults).length} page(s).`);
  console.log('='.repeat(72));

  // Write JSON Manifest
  fs.writeFileSync(options.outputJson, JSON.stringify({
    auditedAt: new Date().toISOString(),
    totalPages: Object.keys(allPageResults).length,
    pages: allPageResults
  }, null, 2), 'utf8');
  console.log(`[ThemeAudit] Saved JSON audit manifest: ${options.outputJson}`);

  // Write Markdown Report (< 150 lines)
  let md = `# Connectify Theme Parity & Style Audit Report\n\n`;
  md += `**Pages Audited:** ${Object.keys(allPageResults).length}  \n`;
  md += `**Baseline Theme:** Connect Native Theme (native styling)  \n`;
  md += `**Audited At:** ${new Date().toUTCString()}  \n\n`;
  md += `## Multi-Page Parity & Compliance Matrix\n\n`;
  md += `| Page URL | Theme | Visible | Parity Diffs | Critical | Status |\n`;
  md += `| :--- | :--- | :---: | :---: | :---: | :---: |\n`;

  let mdRows = 0;
  for (const pageUrl of Object.keys(allPageResults)) {
    const pageData = allPageResults[pageUrl];
    const urlDisplay = pageUrl.replace(/^https?:\/\/connect\.det\.wa\.edu\.au/, '').slice(0, 30) || '/';
    for (const tid of Object.keys(pageData.themes)) {
      if (mdRows >= 45) break;
      const item = pageData.themes[tid];
      const issues = item.audit.issues;
      const pDiff = issues.filter(i => i.category === 'PARITY').length;
      const cCrit = issues.filter(i => i.type === 'CRITICAL_CONTRAST_VIOLATION').length;
      const sDiff = issues.filter(i => i.category === 'STYLE' && i.type !== 'CRITICAL_CONTRAST_VIOLATION').length;
      const status = pDiff === 0 && cCrit === 0 && sDiff === 0 ? '✅ Pass' : (cCrit > 0 ? '❌ Crit' : '⚠️ Warn');

      md += `| \`${urlDisplay}\` | **${item.theme.name}** | ${item.audit.visibleCount}/${pageData.baselineVisibleCount} | ${pDiff} | ${cCrit} | ${status} |\n`;
      mdRows++;
    }
  }

  const mdLines = md.split('\n');
  const finalMd = mdLines.length > 145 ? mdLines.slice(0, 140).join('\n') + '\n\n*Truncated to 150 lines.*' : md;
  fs.writeFileSync(options.outputMd, finalMd, 'utf8');
  console.log(`[ThemeAudit] Saved Markdown audit report: ${options.outputMd}`);

  await browser.close();
  console.log('[ThemeAudit] Theme testing complete.');
}

if (require.main === module) {
  runThemeAudit().catch(err => {
    console.error('[ThemeAudit] Fatal error:', err);
    process.exit(1);
  });
}

module.exports = {
  runThemeAudit,
  resolveTargetUrls,
  clickInteractiveButtons,
  captureNativeBaseline,
  auditThemeAgainstBaseline
};

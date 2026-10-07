/**
 * Connectify Theme Unstyled Elements Tester
 * Tests any Connect or custom web page across all registered themes for:
 * - Low contrast / WCAG AA violations
 * - Background bleed (unadapted light boxes in dark themes or dark boxes in light)
 * - Typography / serif fallback font regressions
 * - Unadapted Angular Material components (native purple ink bars, unstyled panels)
 * - Hardcoded inline color overrides
 */

'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./puppeteer-utils');

const DEFAULT_PAGE = 'https://connect.det.wa.edu.au/group/students/ui/my-settings/assessment-outlines';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: null,
    file: null,
    theme: 'all',
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
    else if (a === '--theme' && args[i + 1]) options.theme = args[++i];
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

/**
 * In-browser DOM auditor function passed to page.evaluate()
 */
function auditPageElements(themeId, isDarkTheme) {
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

  function getLuminance(r, g, b) {
    const fn = (c) => {
      const norm = c / 255;
      return norm <= 0.03928 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * fn(r) + 0.7152 * fn(g) + 0.0722 * fn(b);
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
      if (bg && bg.a > 0.05) {
        return bg;
      }
      curr = curr.parentElement;
    }
    return isDarkTheme ? { r: 18, g: 23, b: 31, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
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

  const issues = [];
  const allElements = document.querySelectorAll('body *');

  for (const el of allElements) {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const tag = el.tagName.toLowerCase();
    if (['script', 'style', 'svg', 'path', 'noscript', 'meta', 'link'].includes(tag)) continue;

    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || parseFloat(style.opacity) === 0) continue;

    const elBg = parseRgb(style.backgroundColor);
    const elColor = parseRgb(style.color);
    const effectiveBg = getEffectiveBg(el);
    const selector = getSelector(el);
    const text = (el.innerText || '').trim();
    const hasDirectText = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 0);

    // 1. Angular Material Purple Ink Bar Check
    if (el.classList.contains('mat-ink-bar')) {
      if (elBg && elBg.r > 90 && elBg.r < 125 && elBg.b > 160) {
        issues.push({
          type: 'NATIVE_PURPLE_INK_BAR',
          severity: 'HIGH',
          selector,
          details: `Native purple .mat-ink-bar detected (${style.backgroundColor})`,
          bg: style.backgroundColor
        });
      }
    }

    // 2. Background Bleed Checks
    if (elBg && elBg.a > 0.7 && !['img', 'video', 'canvas'].includes(tag)) {
      const bgLum = getLuminance(elBg.r, elBg.g, elBg.b);
      if (isDarkTheme && bgLum > 0.65 && (elBg.r > 210 && elBg.g > 210 && elBg.b > 210)) {
        if (!el.closest('.mat-badge, .badge, .status-pill, .chip-light')) {
          issues.push({
            type: 'DARK_MODE_LIGHT_BG_BLEED',
            severity: 'HIGH',
            selector,
            details: `Light background bleed in dark mode (${style.backgroundColor})`,
            bg: style.backgroundColor
          });
        }
      } else if (!isDarkTheme && bgLum < 0.15 && (elBg.r < 45 && elBg.g < 45 && elBg.b < 45)) {
        if (!el.closest('.connectea-theme-toggle, .mat-tooltip')) {
          issues.push({
            type: 'LIGHT_MODE_DARK_BG_BLEED',
            severity: 'MEDIUM',
            selector,
            details: `Unintended dark surface in light mode (${style.backgroundColor})`,
            bg: style.backgroundColor
          });
        }
      }
    }

    // 3. Typography & Serif Fallback Check
    const font = style.fontFamily.toLowerCase();
    const isIcon = el.classList.contains('mat-icon') || el.classList.contains('material-icons') ||
      font.includes('fontawesome') || font.includes('material') || font.includes('glyph');
    if (!isIcon && hasDirectText) {
      if ((font.includes('times') || font.includes('serif')) && !font.includes('sans-serif')) {
        issues.push({
          type: 'SERIF_FALLBACK_FONT',
          severity: 'HIGH',
          selector,
          details: `Serif fallback font active: "${style.fontFamily}"`,
          textSnippet: text.slice(0, 30)
        });
      }
    }

    // 4. Contrast Ratio & Legibility Checks (only on elements with direct visible text)
    if (hasDirectText && elColor && effectiveBg) {
      const cr = getContrast(elColor, effectiveBg);
      const fontSize = parseFloat(style.fontSize) || 14;
      const isBold = parseInt(style.fontWeight, 10) >= 600 || style.fontWeight === 'bold';
      const isLarge = fontSize >= 18 || (fontSize >= 14 && isBold);
      const minCr = isLarge ? 3.0 : 4.5;

      if (cr < 2.0) {
        issues.push({
          type: 'CRITICAL_CONTRAST_VIOLATION',
          severity: 'CRITICAL',
          selector,
          details: `Illegible contrast ratio ${cr.toFixed(2)}:1 (color: ${style.color}, bg: rgba(${effectiveBg.r},${effectiveBg.g},${effectiveBg.b},${effectiveBg.a}))`,
          contrast: cr.toFixed(2),
          textSnippet: text.slice(0, 40)
        });
      } else if (cr < minCr) {
        issues.push({
          type: 'LOW_CONTRAST_WARNING',
          severity: 'WARNING',
          selector,
          details: `Sub-standard contrast ratio ${cr.toFixed(2)}:1 < ${minCr}:1 (color: ${style.color})`,
          contrast: cr.toFixed(2),
          textSnippet: text.slice(0, 40)
        });
      }
    }
  }

  // Deduplicate issues by selector and type
  const uniqueMap = new Map();
  for (const item of issues) {
    const key = `${item.type}:${item.selector}`;
    if (!uniqueMap.has(key)) uniqueMap.set(key, item);
  }
  return Array.from(uniqueMap.values());
}

async function runThemeAudit() {
  const options = parseArgs();
  console.log('[ThemeAudit] Starting Connectify Theme Unstyled Elements Audit...');

  const browser = await utils.launchBrowser({
    headless: !options.headful,
    loadExtension: true
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  let targetUrl = options.url;
  if (options.file) {
    targetUrl = 'file://' + path.resolve(options.file);
  } else if (!targetUrl) {
    targetUrl = DEFAULT_PAGE;
  }

  console.log(`[ThemeAudit] Navigating to target: ${targetUrl}`);

  // Handle authentication if connecting to live Connect
  if (targetUrl.includes('connect.det.wa.edu.au')) {
    await utils.authenticate(page, {
      username: options.username,
      password: options.password,
      interactive: options.interactive,
      sessionFile: options.session
    });
  }

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1500));

  // Determine available themes from Connectify registry or default list
  const themeList = await page.evaluate(() => {
    if (window.ConnectifyThemeRegistry?.getAvailableThemes) {
      return window.ConnectifyThemeRegistry.getAvailableThemes();
    }
    return [
      { id: 'dark', name: 'Dark', isDark: true },
      { id: 'quantum', name: 'Quantum Dark', isDark: true },
      { id: 'amoled', name: 'AMOLED Black', isDark: true },
      { id: 'midnight', name: 'Midnight Navy', isDark: true },
      { id: 'forest', name: 'Emerald Forest', isDark: true },
      { id: 'sunset', name: 'Twilight Plum', isDark: true },
      { id: 'light', name: 'Default', isDark: false },
      { id: 'custom', name: 'Custom Theme', isDark: true }
    ];
  });

  const themesToTest = options.theme === 'all'
    ? themeList
    : themeList.filter(t => t.id === options.theme || t.name.toLowerCase() === options.theme.toLowerCase());

  if (themesToTest.length === 0) {
    console.error(`[ThemeAudit] Unknown theme: "${options.theme}". Available: ${themeList.map(t => t.id).join(', ')}`);
    await browser.close();
    process.exit(1);
  }

  if (options.screenshots && !fs.existsSync(options.screenshotsDir)) {
    fs.mkdirSync(options.screenshotsDir, { recursive: true });
  }

  const results = {};
  console.log(`\nAuditing ${themesToTest.length} theme(s) on ${targetUrl}\n` + '-'.repeat(64));

  for (const t of themesToTest) {
    // Switch theme via ConnectifyThemeRegistry or direct DOM attributes
    await page.evaluate((tid) => {
      if (window.ConnectifyThemeRegistry?.setTheme) {
        window.ConnectifyThemeRegistry.setTheme(tid);
      } else {
        const isDark = tid !== 'light';
        document.documentElement.classList.toggle('connectea-dark', isDark);
        if (isDark) document.documentElement.dataset.connecteaTheme = tid;
        else delete document.documentElement.dataset.connecteaTheme;
      }
    }, t.id);

    await new Promise(r => setTimeout(r, 400));

    const issues = await page.evaluate(auditPageElements, t.id, t.isDark !== false);
    results[t.id] = { theme: t, issues };

    const criticalCount = issues.filter(i => i.severity === 'CRITICAL').length;
    const highCount = issues.filter(i => i.severity === 'HIGH').length;
    const warnCount = issues.filter(i => i.severity === 'WARNING' || i.severity === 'MEDIUM').length;

    console.log(`• ${t.name.padEnd(16)} [${t.id}]: ${criticalCount} critical, ${highCount} high, ${warnCount} warnings`);

    if (options.screenshots) {
      const shotPath = path.join(options.screenshotsDir, `theme-${t.id}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });
      console.log(`  └─ Screenshot: ${shotPath}`);
    }
  }

  console.log('-'.repeat(64));

  // Generate Reports
  fs.writeFileSync(options.outputJson, JSON.stringify({
    url: targetUrl,
    auditedAt: new Date().toISOString(),
    themes: results
  }, null, 2), 'utf8');
  console.log(`\n[ThemeAudit] JSON report saved: ${options.outputJson}`);

  let mdContent = `# Connectify Theme Audit Report\n\n`;
  mdContent += `**Target Page:** \`${targetUrl}\`  \n`;
  mdContent += `**Audited At:** ${new Date().toUTCString()}  \n\n`;
  mdContent += `## Summary Matrix\n\n`;
  mdContent += `| Theme | Critical | High | Warnings | Status |\n`;
  mdContent += `| :--- | :---: | :---: | :---: | :---: |\n`;

  for (const tid of Object.keys(results)) {
    const item = results[tid];
    const c = item.issues.filter(i => i.severity === 'CRITICAL').length;
    const h = item.issues.filter(i => i.severity === 'HIGH').length;
    const w = item.issues.filter(i => i.severity === 'WARNING' || i.severity === 'MEDIUM').length;
    const status = c === 0 && h === 0 ? '✅ Pass' : (c > 0 ? '❌ Critical' : '⚠️ Warning');
    mdContent += `| **${item.theme.name}** (\`${tid}\`) | ${c} | ${h} | ${w} | ${status} |\n`;
  }

  mdContent += `\n## Issue Details by Theme\n\n`;
  for (const tid of Object.keys(results)) {
    const item = results[tid];
    mdContent += `### ${item.theme.name} (\`${tid}\`)\n\n`;
    if (item.issues.length === 0) {
      mdContent += `*No unstyled elements detected.*\n\n`;
    } else {
      mdContent += `| Severity | Type | Selector | Details |\n`;
      mdContent += `| :--- | :--- | :--- | :--- |\n`;
      for (const iss of item.issues.slice(0, 20)) {
        mdContent += `| \`${iss.severity}\` | \`${iss.type}\` | \`${iss.selector}\` | ${iss.details} |\n`;
      }
      if (item.issues.length > 20) {
        mdContent += `\n*... and ${item.issues.length - 20} more issues omitted for brevity.*\n`;
      }
      mdContent += `\n`;
    }
  }

  // Ensure markdown stays under 150 lines if written
  const mdLines = mdContent.split('\n');
  const finalMd = mdLines.length > 145 ? mdLines.slice(0, 140).join('\n') + '\n\n*Report truncated to 150 lines.*' : mdContent;
  fs.writeFileSync(options.outputMd, finalMd, 'utf8');
  console.log(`[ThemeAudit] Markdown report saved: ${options.outputMd}`);

  await browser.close();
  console.log('[ThemeAudit] Theme testing complete.');
}

if (require.main === module) {
  runThemeAudit().catch(err => {
    console.error('[ThemeAudit] Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { runThemeAudit, auditPageElements };

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
const crypto = require('crypto');
const utils = require('./puppeteer-utils');
const { launchAuthenticated } = require('./puppeteer-auth');

const DEFAULT_PAGE = 'https://connect.det.wa.edu.au/group/students/ui/my-settings/assessment-outlines';

function parseArgs() {
  const rawArgs = process.argv.slice(2);
  const isEnvInteractive = process.env.npm_config_interactive === 'true' ||
                          process.env.npm_config_interactive === '1' ||
                          process.env.INTERACTIVE === 'true' ||
                          process.env.INTERACTIVE === '1';

  // Normalize args to expand --key=val and -k=val into separate tokens
  const args = [];
  for (let i = 0; i < rawArgs.length; i++) {
    const item = rawArgs[i];
    if ((item.startsWith('--') || item.startsWith('-')) && item.includes('=')) {
      const eqIdx = item.indexOf('=');
      args.push(item.slice(0, eqIdx));
      args.push(item.slice(eqIdx + 1));
    } else {
      args.push(item);
    }
  }

  const isEnvHelp = process.env.npm_config_help === 'true' || process.env.npm_config_h === 'true';
  const isHelpRequested = isEnvHelp || args.some(a =>
    a === '--help' || a === '-h' || a === 'help' || a === '-help' || a === '/?' || a === '/help'
  );

  if (isHelpRequested) {
    console.log(`
Connectify Theme Parity & Sidebar Auditor

Usage:
  node scripts/test-theme-styles.js [options]
  npm run test:themes -- [options]

Targeting Options:
  --url <url>              Audit a single URL
  --urls <u1,u2,...>       Audit comma-separated list of URLs
  --urls-file <file>       Read URLs from a text file (one per line)
  --file <path>            Audit a local HTML file
  --no-crawled             Do not load crawled_urls.txt (default is to load if present)
  --crawled                Explicitly load crawled_urls.txt
  --paste                  Paste URLs interactively

Sidebar & View Options:
  --sidebar                Audit sidebar and all tabs/sub-tabs (default: true)
  --no-sidebar             Disable sidebar audit
  --sidebar-only           Audit ONLY sidebar views (menu, tools, tabs, sub-tabs)
  --sub-pages              Audit navbar heading sub-views (default: true)
  --no-sub-pages           Disable navbar heading sub-views
  --max-sub-pages <n>      Max navbar headings to audit per page (default: 8)

Audit & Browser Options:
  --theme <id>             Theme to test: dark, quantum, amoled, midnight, forest, sunset, liquid-glass, all (default: all)
  --delay <ms>             Settling delay between views in ms (default: 1250)
  --no-click-buttons       Do not automatically expand accordions/panels
  --click-buttons          Automatically expand accordions/panels (default: true)
  --screenshots            Save comparison screenshots
  --no-screenshots         Disable screenshots (default: false)
  --screenshots-dir <dir>  Directory to save screenshots
  --output <file>          Save JSON audit report
  --report-md <file>       Save Markdown summary report
  --headless               Never open a window (fails if the saved session expired)
  --headful, --no-headless Keep a visible browser window for the whole run
  --interactive, -i        Prompt for login if needed (default: a login window
                           opens only when needed, then the audit runs headless)
  --username, -u, --user   Connect username
  --password, -p, --pass   Connect password
  --session <file>         Session cookies file (default: connect_session.json)
  --scroll                 Incrementally scroll down through the ENTIRE page (default: true)
  --no-scroll              Disable smooth full-page scrolling
  --scroll-step <px>       Scroll step in pixels (default: 800)
  --scroll-delay <ms>      Delay per scroll increment in ms (default: 15)
  --max-scrolls <n>        Max scroll iterations per page (default: 100)
  --margin-tolerance <n>   Margin comparison tolerance in px (default: 1.0)
  --size-tolerance <n>     Size comparison tolerance in px (default: 2.0)
  --help, -h               Show this help message
`);
    process.exit(0);
  }

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
    delay: 1250,
    headful: false,
    headless: null,
    username: null,
    password: null,
    interactive: isEnvInteractive,
    session: path.resolve(__dirname, '..', utils.DEFAULT_SESSION_FILE),
    subPages: true,
    maxSubPages: 8,
    sidebar: true,
    sidebarOnly: false,
    noCrawled: false,
    crawled: true,
    explicitCrawled: false,
    scroll: true,
    scrollStep: 800,
    scrollDelay: 15,
    maxScrolls: 100
  };

  // Inspect npm environment variables
  if (process.env.npm_config_theme) options.theme = process.env.npm_config_theme;
  if (process.env.npm_config_url) options.url = process.env.npm_config_url;
  if (process.env.npm_config_user || process.env.npm_config_username) options.username = process.env.npm_config_user || process.env.npm_config_username;
  if (process.env.npm_config_password || process.env.npm_config_pass) options.password = process.env.npm_config_password || process.env.npm_config_pass;
  if (process.env.npm_config_delay) options.delay = parseInt(process.env.npm_config_delay, 10);
  if (process.env.npm_config_sidebar === 'false') options.sidebar = false;
  if (process.env.npm_config_sidebar_only === 'true') { options.sidebar = true; options.sidebarOnly = true; }
  if (process.env.npm_config_headless === 'true') options.headless = true;
  if (process.env.npm_config_headless === 'false' || process.env.npm_config_headful === 'true') { options.headful = true; options.headless = false; }
  if (process.env.npm_config_crawled === 'false') options.noCrawled = true;
  if (process.env.npm_config_scroll === 'false') options.scroll = false;
  if (process.env.npm_config_scroll_step) options.scrollStep = parseInt(process.env.npm_config_scroll_step, 10);
  if (process.env.npm_config_scroll_delay) options.scrollDelay = parseInt(process.env.npm_config_scroll_delay, 10);

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if ((a === '--url' || a === '-url') && args[i + 1]) options.url = args[++i];
    else if ((a === '--file' || a === '-f') && args[i + 1]) options.file = args[++i];
    else if (a === '--urls-file' && args[i + 1]) options.urlsFile = path.resolve(args[++i]);
    else if (a === '--urls' && args[i + 1]) options.urlsList = args[++i].split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--crawled') { options.crawled = true; options.noCrawled = false; options.explicitCrawled = true; }
    else if (a === '--no-crawled') { options.noCrawled = true; options.crawled = false; }
    else if (a === '--paste') options.paste = true;
    else if ((a === '--theme' || a === '-t') && args[i + 1]) options.theme = args[++i];
    else if ((a === '--delay' || a === '-d') && args[i + 1]) options.delay = parseInt(args[++i], 10);
    else if (a === '--no-click-buttons') options.clickButtons = false;
    else if (a === '--click-buttons') options.clickButtons = true;
    else if (a === '--no-sub-pages') options.subPages = false;
    else if (a === '--sub-pages') options.subPages = true;
    else if (a === '--no-sidebar') options.sidebar = false;
    else if (a === '--sidebar') options.sidebar = true;
    else if (a === '--sidebar-only') { options.sidebar = true; options.sidebarOnly = true; }
    else if (a === '--max-sub-pages' && args[i + 1]) options.maxSubPages = parseInt(args[++i], 10);
    else if (a === '--margin-tolerance' && args[i + 1]) options.marginTolerance = parseFloat(args[++i]);
    else if (a === '--size-tolerance' && args[i + 1]) options.sizeTolerance = parseFloat(args[++i]);
    else if (a === '--screenshots') options.screenshots = true;
    else if (a === '--no-screenshots') options.screenshots = false;
    else if (a === '--screenshots-dir' && args[i + 1]) options.screenshotsDir = path.resolve(args[++i]);
    else if ((a === '--output' || a === '--out' || a === '-o') && args[i + 1]) options.outputJson = path.resolve(args[++i]);
    else if ((a === '--report-md' || a === '--md') && args[i + 1]) options.outputMd = path.resolve(args[++i]);
    else if (a === '--headful' || a === '--no-headless') { options.headful = true; options.headless = false; }
    else if (a === '--headless') options.headless = true;
    else if ((a === '--username' || a === '-u' || a === '--user') && args[i + 1]) options.username = args[++i];
    else if ((a === '--password' || a === '-p' || a === '--pass') && args[i + 1]) options.password = args[++i];
    else if (a === '--interactive' || a === '-i' || a === 'interactive') options.interactive = true;
    else if ((a === '--session' || a === '-s') && args[i + 1]) options.session = path.resolve(args[++i]);
    else if (a === '--no-scroll') options.scroll = false;
    else if (a === '--scroll') options.scroll = true;
    else if (a === '--scroll-step' && args[i + 1]) options.scrollStep = parseInt(args[++i], 10);
    else if (a === '--scroll-delay' && args[i + 1]) options.scrollDelay = parseInt(args[++i], 10);
    else if (a === '--max-scrolls' && args[i + 1]) options.maxScrolls = parseInt(args[++i], 10);
    else if ((a.startsWith('http://') || a.startsWith('https://')) && !options.url) {
      options.url = a;
    }
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
  if (options.sidebarOnly) {
    if (options.url) return [options.url];
    return [DEFAULT_PAGE];
  }

  const urls = [];

  if (options.urlsFile && fs.existsSync(options.urlsFile)) {
    console.log(`[ThemeAudit] Loading URLs from: ${options.urlsFile}`);
    const raw = fs.readFileSync(options.urlsFile, 'utf8');
    const lines = raw.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    urls.push(...lines);
  } else if (options.paste) {
    console.log('\n[ThemeAudit] Paste your URLs below (one per line). Press Enter on an empty line when finished:');
    const lines = await readUrlsFromStdin();
    urls.push(...lines);
  } else if (options.urlsList && options.urlsList.length > 0) {
    urls.push(...options.urlsList);
  } else if (options.file) {
    urls.push('file://' + path.resolve(options.file));
  } else if (options.url && !options.explicitCrawled) {
    urls.push(options.url);
  } else if (!options.noCrawled) {
    // Default behavior: automatically load crawled_urls.txt if present
    const defaultUrlsPath = path.resolve(__dirname, '..', 'crawled_urls.txt');
    if (fs.existsSync(defaultUrlsPath)) {
      console.log(`[ThemeAudit] Found ${path.basename(defaultUrlsPath)} from directory crawler, loading URLs...`);
      const raw = fs.readFileSync(defaultUrlsPath, 'utf8');
      const lines = raw.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      urls.push(...lines);
    }
    if (options.url) {
      urls.unshift(options.url);
    }
  }

  if (urls.length === 0) {
    urls.push(DEFAULT_PAGE);
  }

  // Ensure DEFAULT_PAGE (assessment-outlines) is always audited first if present or in default crawled mode
  const uniqueUrls = Array.from(new Set(urls));
  const defIdx = uniqueUrls.indexOf(DEFAULT_PAGE);
  if (defIdx > 0) {
    uniqueUrls.splice(defIdx, 1);
    uniqueUrls.unshift(DEFAULT_PAGE);
  } else if (defIdx === -1 && !options.url && !options.file) {
    uniqueUrls.unshift(DEFAULT_PAGE);
  }
  return uniqueUrls;
}

/**
 * Incrementally scrolls down the entire page (and any scrollable sub-containers or sidebar)
 * from top to bottom, triggering IntersectionObservers, lazy-loaded components, infinite feeds,
 * and layout calculations, then scrolls smoothly back to the top.
 */
async function scrollEntirePage(page, options = {}) {
  const {
    step = 800,
    delayMs = 15,
    maxScrolls = 100,
    scope = 'page'
  } = options;

  try {
    // Ensure any background expansion animation has completed
    await page.waitForFunction(() => {
      if (window.ConnectifyIsBulkExpanding) return false;
      if (window.ConnectifyIsAccordionAnimating) return false;
      return true;
    }, { timeout: 4000 }).catch(() => {});

    await page.evaluate(async (opts) => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const isSidebar = opts.scope === 'sidebar';

      // Remove scroll freeze if temporarily left by an animation
      if (document.body?.classList?.contains('cx-freeze-scroll')) {
        document.body.classList.remove('cx-freeze-scroll');
      }

      if (isSidebar) {
        const sidebar = document.getElementById('connectify-sidebar');
        const scrollables = [];
        if (sidebar) {
          scrollables.push(sidebar);
          const ws = sidebar.querySelector('.cx-workspace, .cx-tool-workspace');
          if (ws) scrollables.push(ws);
        }
        for (let tIdx = 0; tIdx < scrollables.length; tIdx++) {
          const target = scrollables[tIdx];
          const totalH = target.scrollHeight || 0;
          let curr = 0;
          while (curr < totalH && curr < 15000) {
            curr += (opts.step || 350);
            target.scrollTop = curr;
            await sleep(opts.delayMs || 50);
          }
          await sleep(100);
          target.scrollTop = 0;
          await sleep(50);
        }
        return;
      }

      // 1. Traverse the full window / documentElement height
      const getScrollHeight = () => Math.max(
        document.body ? document.body.scrollHeight : 0,
        document.documentElement ? document.documentElement.scrollHeight : 0,
        window.innerHeight || 0
      );

      let currScroll = 0;
      let iterations = 0;
      const maxIter = opts.maxScrolls || 100;
      const stepSize = opts.step || 400;
      const pauseMs = opts.delayMs || 60;

      while (iterations < maxIter) {
        const totalHeight = getScrollHeight();
        const viewportHeight = window.innerHeight || 900;

        currScroll += stepSize;
        window.scrollTo({ top: currScroll, behavior: 'auto' });

        // Scroll any scrollable content containers found within the page
        const scrollableContainers = document.querySelectorAll(
          '.cvr-c-content, .portlet-body, .eds-c-layout__main, .v-scrollable, [style*="overflow: auto"], [style*="overflow-y: auto"], [style*="overflow-y: scroll"]'
        );
        for (let sIdx = 0; sIdx < scrollableContainers.length; sIdx++) {
          const sc = scrollableContainers[sIdx];
          if (sc.scrollHeight > sc.clientHeight + 25) {
            sc.scrollTop = Math.min(sc.scrollHeight, sc.scrollTop + stepSize);
          }
        }

        await sleep(pauseMs);
        iterations++;

        if (window.scrollY + viewportHeight >= totalHeight - 20) {
          // Pause to check if lazy loading expands the document
          await sleep(150);
          const newHeight = getScrollHeight();
          if (newHeight <= totalHeight) {
            break;
          }
        }
      }

      // 2. Pause at bottom to allow all bottom observers to settle
      await sleep(150);

      // 3. Scroll back to top so sticky headers and initial elements are restored
      window.scrollTo({ top: 0, behavior: 'auto' });
      const scrollableContainers = document.querySelectorAll(
        '.cvr-c-content, .portlet-body, .eds-c-layout__main, .v-scrollable, [style*="overflow: auto"], [style*="overflow-y: auto"], [style*="overflow-y: scroll"]'
      );
      for (let sIdx = 0; sIdx < scrollableContainers.length; sIdx++) {
        scrollableContainers[sIdx].scrollTop = 0;
      }
      await sleep(150);
    }, { step, delayMs, maxScrolls, scope });

    // Allow layout to stabilize after scrolling back to top
    await new Promise(r => setTimeout(r, 200));
  } catch (err) {
    // Non-fatal, continue with page audit
  }
}

/**
 * Computes a unique deterministic SHA-256 signature of a baseline's visible elements,
 * including tag names, selectors, text snippets, and bounding box dimensions.
 * Used to detect and skip redundant in-page views that have the exact same elements.
 */
function computeElementsSignature(baseline) {
  if (!baseline || !baseline.elements) return '';
  const hash = crypto.createHash('sha256');
  hash.update(String(baseline.visibleCount || 0));
  const keys = Object.keys(baseline.elements);
  for (let i = 0; i < keys.length; i++) {
    const el = baseline.elements[keys[i]];
    hash.update(`;${el.tagName}|${el.selector}|${el.textSnippet}|${el.size?.width || 0}x${el.size?.height || 0}`);
  }
  return hash.digest('hex');
}

/**
 * Dispatches clicks to interactive JavaScript buttons and accordion/tab triggers
 * on the page to expand collapsible panels and reveal dynamic UI components.
 */
async function clickInteractiveButtons(page) {
  try {
    const clickTask = page.evaluate(() => {
      const clicked = [];

      // 1. If ConnectifyData.expandAll is available from the extension, run it first
      if (window.ConnectifyData?.expandAll) {
        try {
          window.ConnectifyData.expandAll(true);
          clicked.push('ConnectifyData.expandAll');
        } catch {}
      }

      // 2. Prevent modal dialogs from blocking execution
      window.alert = () => {};
      window.confirm = () => true;
      window.prompt = () => null;

      // 3. Disable beforeunload dialog prompt so synthetic clicks never block the browser
      const origBeforeUnload = window.onbeforeunload;
      window.onbeforeunload = null;

      // 4. Temporarily block navigation and form submissions during synthetic dispatch
      const navBlocker = (e) => {
        const a = e.target?.closest?.('a[href]');
        if (a) {
          const href = (a.getAttribute?.('href') || '').trim();
          const isButton = a.getAttribute?.('role') === 'button' || a.hasAttribute?.('data-toggle') ||
                           a.classList?.contains?.('v-button') || a.classList?.contains?.('eds-c-action-button') ||
                           /\bview\b/i.test(a.textContent || '');
          if (!isButton && href && !href.startsWith('#') && !href.startsWith('javascript:')) {
            e.preventDefault();
            e.stopImmediatePropagation();
          }
        }
      };
      const submitBlocker = (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
      };
      window.addEventListener('click', navBlocker, true);
      window.addEventListener('submit', submitBlocker, true);

      const INTERACTIVE_SELECTORS = [
        // Connect / EDS / CVR Accordions & Expansion Panels
        '.eds-c-accordion__section-heading',
        '.cvr-c-accordion__section-heading',
        '.eds-c-accordion__trigger',
        '.cvr-c-expansion-panel__trigger',
        '.eds-c-card__trigger',
        '.eds-c-card__header',
        '.eds-c-tile__header',
        '.cvr-c-tile__header',
        '.v-accordion-item-caption',
        '.v-accordion-item',

        // Angular Material Accordions & Expansion Panels
        '.mat-expansion-panel-header:not(.mat-expanded):not([aria-disabled="true"])',

        // Notice / Feed Card action triggers and view buttons
        '.cvr-c-feed-item button',
        '.cvr-c-feed-card button',
        'mat-card button',
        '.mat-card button',
        '.eds-c-card button',
        '.eds-o-button--positive',
        '.eds-c-button--positive',
        '.eds-c-action-button',
        '.cvr-c-action-button',
        '.v-button',
        'button[class*="action"]',
        'button[class*="view"]',
        '[class*="action-button"]',
        '[class*="view-button"]',

        // Collapsible Toggles & Details
        '[data-toggle="collapse"]:not(a)',
        '[data-toggle="modal"]',
        '.panel-heading.collapsed',
        'details:not([open]) > summary',
        'summary',
        '[aria-expanded="false"][class*="accordion"]',
        '[aria-expanded="false"][class*="panel"]',
        '[aria-expanded="false"][class*="card"]',
        '[aria-expanded="false"][class*="tile"]',

        // Connectify Built-in Expand Buttons
        '#cx-expand-all',
        '.cx-expand-btn',
        '.cta-expand-outlines',
        '#cx-weakness-expand-all'
      ].join(', ');

      const elements = Array.from(document.querySelectorAll(INTERACTIVE_SELECTORS));

      // Also detect buttons/summaries with explicit expansion text (using fast textContent, no layout reflow)
      const candidateNodes = Array.from(document.querySelectorAll(
        'button, summary, [role="button"], .v-button, .eds-c-button, .eds-o-button, .eds-c-action-button, .cvr-c-action-button, [class*="action-button"], [class*="view-button"], mat-card button, .mat-card button, [class*="feed"] button, [class*="notice"] button'
      ));
      for (const node of candidateNodes) {
        if (node.children.length > 6) continue;
        const rawTxt = (node.innerText || node.textContent || '').trim();
        const cleanTxt = rawTxt.replace(/\s+/g, ' ');
        const isNoticeView = (/\bview\b/i.test(cleanTxt) && !/\b(view\s*all|view\s*more|see\s*more|grid\s*view|list\s*view)\b/i.test(cleanTxt));

        if (/\b(show\s*details|view\s*details|expand\s*all|expand\s*outlines|more\s*details)\b/i.test(cleanTxt) || isNoticeView) {
          if (!elements.includes(node) && !node.closest('nav, .cvr-c-primary-navigation, .pagination, .pager')) {
            elements.push(node);
          }
        }
      }

      const seenSections = new Set();
      const clickedElements = new Set();
      let matNoticeViewClicks = 0;
      let vaadinNoticeViewClicks = 0;

      try {
        for (const el of elements) {
          // Skip theme toggle and Connectify sidebar controls
          if (el.id === 'connectea-theme-toggle' || el.closest?.('#connectea-theme-toggle')) continue;
          if (el.closest?.('#connectify-sidebar, #connectify-sidebar-handle')) continue;

          // Skip site navigation, headers, breadcrumbs, pagination
          if (el.closest?.('.cvr-c-header, .cvr-c-navbar, .cvr-c-primary-navigation, .cvr-c-primary-menu, .cvr-c-side-menu, .cvr-c-user-menu, nav, [role="navigation"], .breadcrumb, .breadcrumbs, .pagination, .pager')) {
            continue;
          }

          // Skip navbar tabs and view switchers (audited separately as distinct sub-views)
          if (el.matches?.('[role="tab"], .mat-tab-label, .mat-tab-link, .nav-tabs a, .nav-pills a, .fc-button')) {
            continue;
          }

          // Skip calendar previous/next/today navigation buttons
          if (el.matches?.('.mat-calendar-previous-button, .mat-calendar-next-button, .fc-prev-button, .fc-next-button, .fc-today-button')) {
            continue;
          }
          if (el.closest?.('.fc-toolbar, .fc-header-toolbar') && el.matches?.('.fc-button, button')) {
            continue;
          }

          // Skip real navigation links (allow in-page hashes, javascript:, and role="button")
          const a = el.tagName === 'A' ? el : el.closest?.('a[href]');
          if (a) {
            const href = (a.getAttribute?.('href') || '').trim();
            const isPageAnchor = !href || href.startsWith('#') || href.startsWith('javascript:');
            const isRoleTrigger = a.getAttribute?.('role') === 'button' || a.hasAttribute?.('data-toggle') ||
                                  a.classList?.contains?.('v-button') || a.classList?.contains?.('eds-c-action-button') ||
                                  /\bview\b/i.test(a.textContent || '');
            if (!isPageAnchor && !isRoleTrigger) {
              continue;
            }
          }

          // Skip form submits and resets
          if ((el.type === 'submit' || el.type === 'reset') && el.closest?.('form')) continue;
          if (el.tagName === 'BUTTON' && el.closest?.('form') && el.getAttribute?.('type') !== 'button') continue;

          // Skip framework route navigation attributes
          if (el.hasAttribute?.('routerlink') || el.hasAttribute?.('data-route') || el.hasAttribute?.('data-url') || el.hasAttribute?.('ng-reflect-router-link')) {
            continue;
          }

          // Skip explicit location redirection in onclick
          const onclick = el.getAttribute?.('onclick') || '';
          if (/window\.location|location\.href|location\.assign|location\.replace|window\.open\(/i.test(onclick)) {
            continue;
          }

          const label = (el.getAttribute?.('aria-label') || el.getAttribute?.('title') || '').trim();
          const directText = (el.textContent || '').trim().slice(0, 50);

          // Skip destructive actions, state-mutating toggles, or pagination/more links
          // EXPLICIT REQUIREMENT: Never click on "see more", "show more", "view all", "follow", or "bookmark"
          if (/\b(log\s*out|sign\s*out|delete|remove|leave|sign\s*off|view\s*all|show\s*more|see\s*more|load\s*more|follow|unfollow|bookmark|favorite|turned_in|turned_in_not|print|export)\b/i.test(label) ||
              /\b(log\s*out|sign\s*out|delete|remove|leave|sign\s*off|view\s*all|show\s*more|see\s*more|load\s*more|follow|unfollow|bookmark|favorite|turned_in|turned_in_not|print|export)\b/i.test(directText)) {
            continue;
          }

          // Limit notice View clicks to reveal modal dialog without stacking duplicates
          const isNoticeViewBtn = /\bview\b/i.test(directText) && !/\b(view\s*all|view\s*more|grid\s*view|list\s*view)\b/i.test(directText);
          if (isNoticeViewBtn) {
            const isVaadin = (typeof el.className === 'string' && el.className.includes('v-button')) ||
                             (typeof el.matches === 'function' && el.matches('.v-button, .v-button *')) ||
                             (typeof el.closest === 'function' && el.closest('.v-button'));
            const hasDialog = typeof document.querySelector === 'function' && document.querySelector('mat-dialog-container');
            if (isVaadin) {
              if (vaadinNoticeViewClicks >= 1) continue;
              vaadinNoticeViewClicks++;
            } else {
              if (hasDialog || matNoticeViewClicks >= 1) continue;
              matNoticeViewClicks++;
            }
          }

          // Skip already expanded panels
          if (el.getAttribute?.('aria-expanded') === 'true') continue;
          if (el.classList?.contains?.('mat-expanded')) continue;
          if (el.matches?.('.mat-tab-label-active, [aria-selected="true"]')) continue;
          if (el.matches?.('details[open] > summary')) continue;
          if (/hide\s*details/i.test(directText)) continue;

          // Deduplicate accordion headings per section/tile
          if (el.matches?.('.eds-c-accordion__section-heading, .cvr-c-accordion__section-heading')) {
            const section = el.closest?.('.eds-c-accordion__section, .cvr-c-accordion__section, .eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile');
            if (section) {
              if (seenSections.has(section)) continue;
              seenSections.add(section);
            }
          }

          // Identify the exact clickable element (target inner trigger if available)
          const target = el.querySelector?.('button, .v-button, [role="button"], .eds-c-accordion__trigger, .cvr-c-expansion-panel__trigger') || el;
          if (clickedElements.has(target)) continue;
          clickedElements.add(target);

          try {
            if (typeof target.click === 'function') {
              target.click();
            } else {
              target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
            }
          } catch {}

          const tag = target.tagName.toLowerCase();
          const id = target.id ? '#' + target.id : '';
          const cls = target.className && typeof target.className === 'string' ? '.' + target.className.trim().split(/\s+/)[0] : '';
          const textSnippet = directText ? `[${directText.slice(0, 15)}]` : '';
          clicked.push(`${tag}${id}${cls}${textSnippet}`);
        }
      } finally {
        window.removeEventListener('click', navBlocker, true);
        window.removeEventListener('submit', submitBlocker, true);
        window.onbeforeunload = origBeforeUnload;
      }

      return clicked;
    });

    // Hard 4-second timeout guarantee: never hang or freeze the audit
    let timer;
    const timeout = new Promise(resolve => {
      timer = setTimeout(() => resolve([]), 4000);
      if (timer?.unref) timer.unref();
    });
    const res = await Promise.race([clickTask, timeout]);
    if (timer) clearTimeout(timer);
    return res;
  } catch (err) {
    return [];
  }
}

/**
 * Discovers in-page sub-views under the same URL:
 * Specifically: different headings on the navbar, tabs, and view switchers
 * (e.g. Month/Week/Day calendar views, tab headings, sub-nav headings).
 */
async function discoverSubPages(page) {
  try {
    return await page.evaluate(() => {
      const views = [];
      const seen = new Set();

      const NAVBAR_HEADING_SELECTORS = [
        // Top navbar headings & primary navigation tabs
        '.cvr-c-navbar [role="tab"]',
        '.cvr-c-primary-navigation [role="tab"]',
        '.cvr-c-primary-menu [role="tab"]',
        '.mat-tab-header .mat-tab-label',
        '.mat-tab-nav-bar .mat-tab-link',
        '.mat-tab-labels .mat-tab-label',
        '[role="tablist"] [role="tab"]',
        '.eds-c-tabs__tab',
        '.eds-c-tabs [role="tab"]',
        '.eds-c-tabs a',
        '.nav-tabs > li > a',
        '.nav-pills > li > a',

        // Calendar sub-views (e.g. Month, Week, Day, Agenda, List)
        '.fc-toolbar .fc-button:not(.fc-prev-button):not(.fc-next-button):not(.fc-today-button)',
        '.fc-header-toolbar button:not(.fc-prev-button):not(.fc-next-button):not(.fc-today-button)',
        '.mat-button-toggle-group .mat-button-toggle button',

        // Feed & section tabs
        '[class*="feed__tab"]',
        '[class*="feed-header__tab"]',
        '.cvr-c-year-selector button',
        '.cvr-c-report-years button'
      ].join(', ');

      const nodes = Array.from(document.querySelectorAll(NAVBAR_HEADING_SELECTORS));

      nodes.forEach((el, idx) => {
        // Skip theme toggle or controls outside main content/nav
        if (el.id === 'connectea-theme-toggle' || el.closest('#connectea-theme-toggle')) return;
        if (el.closest('#connectify-sidebar, #connectify-sidebar-handle')) return;

        const text = (el.innerText || el.getAttribute('aria-label') || el.title || '').trim().replace(/\s+/g, ' ');
        if (!text || text.length > 35) return;
        if (/\b(logout|signout|delete|remove|next|prev|previous)\b/i.test(text)) return;

        const isActive = el.classList.contains('mat-tab-label-active') ||
                         el.classList.contains('active') ||
                         el.classList.contains('eds-c-tabs__tab--active') ||
                         el.classList.contains('fc-state-active') ||
                         el.getAttribute('aria-selected') === 'true' ||
                         el.closest('li')?.classList.contains('active');

        const triggerId = `cx-nav-heading-${idx}`;
        el.setAttribute('data-cx-nav-id', triggerId);

        const key = text.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          views.push({
            id: triggerId,
            selector: `[data-cx-nav-id="${triggerId}"]`,
            title: text,
            isActive: Boolean(isActive)
          });
        }
      });

      return views;
    });
  } catch {
    return [];
  }
}

/**
 * Switches to a different heading on the navbar, tab, or view under the same URL.
 * Safely handles full page reloads, portlet AJAX posts, or client-side tab transitions.
 */
async function activateNavbarHeading(page, headingTitle, delay = 1250) {
  try {
    const navPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => null);

    const clicked = await page.evaluate((title) => {
      const NAVBAR_SELECTORS = [
        '.mat-tab-header .mat-tab-label',
        '.mat-tab-nav-bar .mat-tab-link',
        '.mat-tab-labels .mat-tab-label',
        '.eds-c-tabs__tab',
        '.eds-c-tabs [role="tab"]',
        '.eds-c-tabs a',
        '[role="tab"]',
        '.nav-tabs > li > a',
        '.nav-pills > li > a',
        '.fc-toolbar .fc-button:not(.fc-prev-button):not(.fc-next-button):not(.fc-today-button)',
        '.fc-header-toolbar button:not(.fc-prev-button):not(.fc-next-button):not(.fc-today-button)',
        '.mat-button-toggle-group button',
        '.cvr-c-navbar [role="tab"]',
        '.cvr-c-navbar a.nav-link',
        '.cvr-c-navbar a',
        '.cvr-c-primary-navigation [role="tab"]',
        '.cvr-c-primary-navigation a',
        '.cvr-c-sub-navigation a',
        '.portlet-tabs a',
        '[class*="feed__tab"]',
        '[class*="feed-header__tab"]',
        '.cvr-c-year-selector button',
        '.cvr-c-report-years button',
        'button'
      ].join(', ');

      const nodes = Array.from(document.querySelectorAll(NAVBAR_SELECTORS));
      const target = nodes.find(el => {
        if (el.id === 'connectea-theme-toggle' || el.closest('#connectea-theme-toggle')) return false;
        if (el.closest('#connectify-sidebar, #connectify-sidebar-handle')) return false;
        const t = (el.innerText || el.getAttribute('aria-label') || el.title || '').trim().replace(/\s+/g, ' ');
        return t.toLowerCase() === title.toLowerCase();
      });

      if (target) {
        target.scrollIntoView?.({ block: 'nearest' });
        target.click();
        target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        return true;
      }
      return false;
    }, headingTitle).catch(() => true);

    if (clicked) {
      await navPromise;
      await utils.waitForPageReady(page, delay);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Discovers the Connectify sidebar and all tools, tabs, and sub-tabs within it
 * to audit each as a distinct, independent view.
 */
async function discoverSidebarViews(page, options = {}) {
  try {
    return await page.evaluate(() => {
      const sidebar = document.getElementById('connectify-sidebar');
      if (!sidebar) return [];

      const views = [];

      function ensureOpen() {
        sidebar.hidden = false;
        const handle = document.getElementById('connectify-sidebar-handle');
        if (handle) {
          handle.setAttribute('aria-expanded', 'true');
        }
        if (typeof window.ConnectifyOpenSidebar === 'function') {
          try { window.ConnectifyOpenSidebar(); } catch {}
        }
      }

      function returnToMenu() {
        const homeBtn = sidebar.querySelector('.cx-back-menu');
        if (homeBtn && typeof homeBtn.click === 'function') {
          try { homeBtn.click(); } catch {}
        } else {
          const workspace = sidebar.querySelector('.cx-workspace');
          if (workspace && workspace.children) {
            for (const child of workspace.children) child.hidden = true;
          }
          sidebar.classList?.remove?.('cx-tool-active');
        }
      }

      ensureOpen();
      returnToMenu();

      // 1. Sidebar Main Menu view (drawer open with tool launcher buttons)
      views.push({
        id: 'cx-sidebar-menu',
        title: 'Sidebar: Main Menu',
        auditScope: 'sidebar',
        toolId: null,
        toolName: 'Main Menu',
        isInitial: false
      });

      // Canonical tool configuration list
      const toolConfigs = [
        { id: 'connectify-target-toggle', defaultName: 'Target ATAR', type: 'atar' },
        { id: 'connectify-grade-toggle', defaultName: 'Target Grade', type: 'atar' },
        { id: 'connectify-predictor-toggle', defaultName: 'Predictor', type: 'predictor' },
        { id: 'connectify-progress-toggle', defaultName: 'Year in Progress', type: 'progress' },
        { id: 'connectify-estimate-toggle', defaultName: 'ATAR Estimate', type: 'atar' },
        { id: 'connectify-weakness-toggle', defaultName: 'Weakness Analyzer', type: 'weakness' },
        { id: 'connectify-categories-toggle', defaultName: 'Settings', type: 'settings' }
      ];

      const allToolBtns = Array.from(sidebar.querySelectorAll('.cx-tool-menu button'));

      for (const cfg of toolConfigs) {
        let btn = document.getElementById(cfg.id) ||
                  sidebar.querySelector(`button#${cfg.id}`) ||
                  sidebar.querySelector(`.cx-tool-menu button[id*="${cfg.id}"]`) ||
                  allToolBtns.find(b => b.id === cfg.id || b.id?.includes(cfg.id) || (b.textContent && b.textContent.includes(cfg.defaultName)));

        // If no tool button found in DOM and no buttons in .cx-tool-menu, record standard view (mock/test fallback)
        if (!btn && allToolBtns.length === 0 && !sidebar.querySelector('.cx-tool-menu button')) {
          views.push({
            id: `cx-sidebar-${cfg.id}`,
            title: `Sidebar: ${cfg.defaultName}`,
            auditScope: 'sidebar',
            toolId: cfg.id,
            toolName: cfg.defaultName,
            isInitial: false
          });
          continue;
        }

        const toolName = (btn?.innerText || btn?.textContent || cfg.defaultName).trim();

        // Mount and activate this tool
        returnToMenu();
        if (btn && typeof btn.click === 'function') {
          try { btn.click(); } catch {}
        }

        if (cfg.type === 'atar') {
          // Check for semester buttons
          const semButtons = Array.from(sidebar.querySelectorAll('.cta-semesters:not(.cta-tabs) .cta-semester, .cta-semesters button'));
          if (semButtons.length > 0) {
            semButtons.forEach((sBtn, sIdx) => {
              const semText = (sBtn.innerText || sBtn.textContent || `Semester ${sIdx + 1}`).trim();
              views.push({
                id: `cx-sidebar-${cfg.id}-sem${sIdx}`,
                title: `Sidebar: ${toolName} [${semText}]`,
                auditScope: 'sidebar',
                toolId: cfg.id,
                toolName,
                subTabSelector: `.cta-semesters .cta-semester:nth-child(${sIdx + 1}), .cta-semesters button:nth-child(${sIdx + 1})`,
                subTabIndex: sIdx,
                subTabName: semText,
                isInitial: false
              });
            });
          } else {
            views.push({
              id: `cx-sidebar-${cfg.id}`,
              title: `Sidebar: ${toolName}`,
              auditScope: 'sidebar',
              toolId: cfg.id,
              toolName,
              isInitial: false
            });
          }
        } else if (cfg.type === 'predictor') {
          const gradeBtn = sidebar.querySelector('#cx-pred-btn-grade');
          const atarBtn = sidebar.querySelector('#cx-pred-btn-atar');

          if (gradeBtn || atarBtn) {
            // A. Grade Predictor Tab
            if (gradeBtn && typeof gradeBtn.click === 'function') {
              try { gradeBtn.click(); } catch {}
            }
            const chips = Array.from(sidebar.querySelectorAll('.cx-pred-subtabs .cx-pred-subtab'));
            if (chips.length > 0) {
              chips.forEach((chip, cIdx) => {
                const chipText = (chip.innerText || chip.textContent || `Subject ${cIdx + 1}`).trim();
                views.push({
                  id: `cx-sidebar-pred-grade-chip${cIdx}`,
                  title: `Sidebar: Predictor [Grade Predictor - ${chipText}]`,
                  auditScope: 'sidebar',
                  toolId: cfg.id,
                  toolName,
                  tabSelector: '#cx-pred-btn-grade',
                  tabName: 'Grade Predictor',
                  subTabSelector: `.cx-pred-subtabs .cx-pred-subtab[data-idx="${cIdx}"], .cx-pred-subtabs .cx-pred-subtab:nth-child(${cIdx + 1})`,
                  subTabIndex: cIdx,
                  subTabName: chipText,
                  isInitial: false
                });
              });
            } else {
              views.push({
                id: 'cx-sidebar-pred-grade',
                title: 'Sidebar: Predictor [Grade Predictor]',
                auditScope: 'sidebar',
                toolId: cfg.id,
                toolName,
                tabSelector: '#cx-pred-btn-grade',
                tabName: 'Grade Predictor',
                isInitial: false
              });
            }

            // B. ATAR Predictor Tab
            if (atarBtn) {
              views.push({
                id: 'cx-sidebar-pred-atar',
                title: 'Sidebar: Predictor [ATAR Predictor]',
                auditScope: 'sidebar',
                toolId: cfg.id,
                toolName,
                tabSelector: '#cx-pred-btn-atar',
                tabName: 'ATAR Predictor',
                isInitial: false
              });
            }
          } else {
            views.push({
              id: `cx-sidebar-${cfg.id}`,
              title: `Sidebar: ${toolName}`,
              auditScope: 'sidebar',
              toolId: cfg.id,
              toolName,
              isInitial: false
            });
          }
        } else if (cfg.type === 'progress') {
          const subButtons = Array.from(sidebar.querySelectorAll('.cx-subjects button'));
          if (subButtons.length > 0) {
            subButtons.forEach((subBtn, subIdx) => {
              const subText = (subBtn.innerText || subBtn.textContent || `Subject ${subIdx + 1}`).trim();
              views.push({
                id: `cx-sidebar-prog-sub${subIdx}`,
                title: `Sidebar: Year in Progress [${subText}]`,
                auditScope: 'sidebar',
                toolId: cfg.id,
                toolName,
                subTabSelector: `.cx-subjects button:nth-child(${subIdx + 1})`,
                subTabIndex: subIdx,
                subTabName: subText,
                isInitial: false
              });
            });
          } else {
            views.push({
              id: `cx-sidebar-${cfg.id}`,
              title: `Sidebar: ${toolName}`,
              auditScope: 'sidebar',
              toolId: cfg.id,
              toolName,
              isInitial: false
            });
          }
        } else if (cfg.type === 'weakness') {
          const modeSelect = sidebar.querySelector('#cx-radar-mode');
          const options = modeSelect ? Array.from(modeSelect.options || []) : [];
          if (options.length > 1) {
            options.forEach(opt => {
              const optText = (opt.text || opt.value).trim();
              views.push({
                id: `cx-sidebar-weakness-${opt.value}`,
                title: `Sidebar: Weakness Analyzer [${optText}]`,
                auditScope: 'sidebar',
                toolId: cfg.id,
                toolName,
                selectSelector: '#cx-radar-mode',
                selectValue: opt.value,
                selectName: optText,
                isInitial: false
              });
            });
          } else {
            views.push({
              id: `cx-sidebar-${cfg.id}`,
              title: `Sidebar: ${toolName}`,
              auditScope: 'sidebar',
              toolId: cfg.id,
              toolName,
              isInitial: false
            });
          }
        } else {
          // Settings or other tools
          views.push({
            id: `cx-sidebar-${cfg.id}`,
            title: `Sidebar: ${toolName}`,
            auditScope: 'sidebar',
            toolId: cfg.id,
            toolName,
            isInitial: false
          });
        }
      }

      // Check for any extra unconfigured tools in the sidebar menu
      const handledIds = new Set(toolConfigs.map(c => c.id));
      const extraButtons = Array.from(sidebar.querySelectorAll('.cx-tool-menu button')).filter(b => b.id && !handledIds.has(b.id));
      for (const eBtn of extraButtons) {
        const eName = (eBtn.innerText || eBtn.textContent || eBtn.id).trim();
        views.push({
          id: `cx-sidebar-${eBtn.id}`,
          title: `Sidebar: ${eName}`,
          auditScope: 'sidebar',
          toolId: eBtn.id,
          toolName: eName,
          isInitial: false
        });
      }

      // Reset to home menu after discovery
      returnToMenu();

      return views;
    });
  } catch (err) {
    return [];
  }
}

/**
 * Activates a specific sidebar view (drawer, tool, tab, or sub-tab).
 */
async function activateSidebarView(page, currentView, delay = 1250) {
  try {
    const activated = await page.evaluate((view) => {
      const sidebar = document.getElementById('connectify-sidebar');
      if (!sidebar) return false;

      // 1. Ensure sidebar is open and visible
      sidebar.hidden = false;
      const handle = document.getElementById('connectify-sidebar-handle');
      if (handle) {
        handle.setAttribute('aria-expanded', 'true');
        handle.style.left = 'min(310px, calc(100vw - 30px))';
      }
      if (typeof window.ConnectifyOpenSidebar === 'function') {
        try { window.ConnectifyOpenSidebar(); } catch {}
      }

      // 2. If viewing the main sidebar menu
      if (!view.toolId) {
        const homeBtn = sidebar.querySelector('.cx-back-menu');
        if (homeBtn && typeof homeBtn.click === 'function') {
          homeBtn.click();
        } else {
          const workspace = sidebar.querySelector('.cx-workspace');
          if (workspace && workspace.children) {
            for (const child of workspace.children) child.hidden = true;
          }
          sidebar.classList?.remove?.('cx-tool-active');
        }
        return true;
      }

      // 3. Switch to tool
      // First return to menu to reset tool state cleanly
      const homeBtn = sidebar.querySelector('.cx-back-menu');
      if (homeBtn && typeof homeBtn.click === 'function') {
        try { homeBtn.click(); } catch {}
      }

      // Find and click the tool toggle button
      const toolBtn = document.getElementById(view.toolId) ||
                      sidebar.querySelector(`button#${view.toolId}`) ||
                      sidebar.querySelector(`.cx-tool-menu button[id*="${view.toolId}"]`);
      if (toolBtn && typeof toolBtn.click === 'function') {
        try { toolBtn.click(); } catch {}
      }

      // 4. Activate primary tab if specified (e.g. #cx-pred-btn-grade or #cx-pred-btn-atar)
      if (view.tabSelector) {
        const tabEl = sidebar.querySelector(view.tabSelector) || document.querySelector(view.tabSelector);
        if (tabEl && typeof tabEl.click === 'function') {
          try { tabEl.click(); } catch {}
        }
      }

      // 5. Activate sub-tab if specified (e.g. semester button, chip, subject button)
      if (view.subTabSelector) {
        const subTabEl = sidebar.querySelector(view.subTabSelector) || document.querySelector(view.subTabSelector);
        if (subTabEl && typeof subTabEl.click === 'function') {
          try { subTabEl.click(); } catch {}
        }
      } else if (view.subTabIndex !== undefined && view.toolId?.includes('progress')) {
        const subBtns = Array.from(sidebar.querySelectorAll('.cx-subjects button'));
        if (subBtns[view.subTabIndex] && typeof subBtns[view.subTabIndex].click === 'function') {
          try { subBtns[view.subTabIndex].click(); } catch {}
        }
      }

      // 6. Set select value if specified (e.g. #cx-radar-mode)
      if (view.selectSelector && view.selectValue) {
        const sel = sidebar.querySelector(view.selectSelector) || document.querySelector(view.selectSelector);
        if (sel) {
          sel.value = view.selectValue;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      return true;
    }, currentView).catch(() => false);

    if (activated) {
      await new Promise(r => setTimeout(r, Math.min(delay, 500)));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Stamps all DOM elements with persistent audit IDs and captures the baseline
 * state from the Connect Native Theme (untouched native styling).
 */
async function captureNativeBaseline(page, options = {}) {
  // Ensure Connect Native Theme is active (no dark mode, no theme tokens)
  await page.evaluate((opts) => {
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
    if (opts?.auditScope === 'sidebar') {
      const sidebar = document.getElementById('connectify-sidebar');
      if (sidebar) sidebar.hidden = false;
    }
  }, options);

  await new Promise(r => setTimeout(r, 400));

  return await page.evaluate((opts) => {
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

    function isVisibleBorder(st, side) {
      const borderStyle = st['border' + side + 'Style'] || st.borderStyle || 'none';
      const widthVal = parseFloat(st['border' + side + 'Width'] || st.borderWidth) || 0;
      if (borderStyle === 'none' || borderStyle === 'hidden' || widthVal <= 0) return 0;
      const colorStr = st['border' + side + 'Color'] || st.borderColor;
      if (colorStr) {
        if (colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)' || colorStr === 'rgba(0,0,0,0)') return 0;
        const rgb = parseRgb(colorStr);
        if (rgb && rgb.a <= 0.05) return 0;
      }
      return widthVal;
    }

    function getBorderStyle(st, side) {
      return (st['border' + side + 'Style'] || st.borderStyle || 'none').toLowerCase();
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
      let path = (el.tagName || 'div').toLowerCase();
      if (el.className && typeof el.className === 'string') {
        const cls = el.className.trim().split(/\s+/).filter(c => !c.startsWith('ng-') && !c.startsWith('cx-audit-')).slice(0, 2).join('.');
        if (cls) path += '.' + cls;
      }
      return path;
    }

    opts = opts || {};
    const isSidebarScope = opts.auditScope === 'sidebar';
    let allElements;
    if (isSidebarScope) {
      const sidebarRoot = typeof document.getElementById === 'function' ? document.getElementById('connectify-sidebar') : null;
      const handleRoot = typeof document.getElementById === 'function' ? document.getElementById('connectify-sidebar-handle') : null;
      if (sidebarRoot || handleRoot) {
        allElements = [];
        if (sidebarRoot) {
          allElements.push(sidebarRoot);
          if (typeof sidebarRoot.querySelectorAll === 'function') {
            allElements.push(...Array.from(sidebarRoot.querySelectorAll('*')));
          }
        }
        if (handleRoot) {
          allElements.push(handleRoot);
          if (typeof handleRoot.querySelectorAll === 'function') {
            allElements.push(...Array.from(handleRoot.querySelectorAll('*')));
          }
        }
      } else {
        const bodyEls = typeof document.querySelectorAll === 'function' ? Array.from(document.querySelectorAll('body *')) : [];
        allElements = bodyEls.filter(el =>
          el.id === 'connectify-sidebar' || el.id === 'connectify-sidebar-handle' ||
          Boolean(typeof el.closest === 'function' && el.closest('#connectify-sidebar, #connectify-sidebar-handle'))
        );
      }
    } else {
      allElements = typeof document.querySelectorAll === 'function' ? document.querySelectorAll('body *') : [];
    }

    const baselineMap = {};
    let visibleCount = 0;

    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i];
      const auditId = 'cx_aud_' + i;
      if (!el.dataset) el.dataset = {};
      el.dataset.cxAuditId = auditId;

      const tag = (el.tagName || 'div').toLowerCase();
      if (['script', 'style', 'noscript', 'meta', 'link', 'template', 'title', 'desc', 'defs', 'clippath', 'mask'].includes(tag)) continue;
      
      if (isSidebarScope) {
        const inSidebar = el.id === 'connectify-sidebar' || el.id === 'connectify-sidebar-handle' ||
                          Boolean(typeof el.closest === 'function' && el.closest('#connectify-sidebar, #connectify-sidebar-handle'));
        if (!inSidebar) continue;
        if (el.id === 'connectea-theme-toggle' || (typeof el.closest === 'function' && el.closest('#connectea-theme-toggle'))) continue;
      } else {
        if (el.closest?.('#cx-expand-progress, #cx-expand-btn, [id*="cx-expand-"], [class*="cx-expand-"], mat-progress-bar, .mat-progress-bar, mat-spinner, .mat-spinner, mat-progress-spinner, #connectea-theme-toggle, #connectea-theme-menu, #connectify-sidebar, #connectify-sidebar-handle, [class*="connectify-"], [id*="connectify-"], .connectify-cohort-panel, .cx-compound-progress-container, .cx-workspace-panel, .cx-refresh-btn, .highcharts-container, svg.highcharts-root, .connectea-panel, .connectea-row-wrapper, .connectea-type-container, .connectea-type-select, .connectea-outcome-bar, .connectea-subject-controls')) continue;
      }

      const style = window.getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none' || parseFloat(style.opacity) === 0) continue;

      const rect = el.getBoundingClientRect();
      const isSvg = tag === 'svg' || tag === 'path' || tag === 'g' || tag === 'rect' || tag === 'circle' || tag === 'polygon' || tag === 'polyline' || tag === 'line' || (typeof SVGElement !== 'undefined' && el instanceof SVGElement);
      const isLayoutDropzone = el.classList?.contains?.('portlet-dropzone') ||
                               el.classList?.contains?.('portlet-column') ||
                               el.classList?.contains?.('portlet-column-content') ||
                               el.classList?.contains?.('portlet-layout') ||
                               (typeof el.id === 'string' && el.id.startsWith('layout-column'));
      if (!isSvg && !isLayoutDropzone && (rect.width <= 0 || rect.height <= 0)) continue;
      if (isSvg && (rect.width <= 0 && rect.height <= 0)) continue;

      visibleCount++;
      const text = (el.innerText || el.textContent || '').slice(0, 30).trim();

      const bRadius = parseFloat(style.borderRadius) || 0;
      const rawRadius = style.borderRadius || '';
      const isButton = tag === 'button' || el.getAttribute?.('role') === 'button' ||
                       el.classList?.contains?.('btn') || el.classList?.contains?.('v-button') ||
                       el.classList?.contains?.('mat-button') || el.classList?.contains?.('eds-c-button') ||
                       el.classList?.contains?.('cvr-c-btn');
      const isActionButton = el.classList?.contains?.('eds-c-action-button') ||
                             el.classList?.contains?.('cvr-c-action-button') ||
                             el.classList?.contains?.('action-button') ||
                             el.classList?.contains?.('eds-c-pagination-button') ||
                             (isButton && rect.width <= 36 && rect.height <= 36);
      const isTable = tag === 'table' || el.classList?.contains?.('table') ||
                      el.classList?.contains?.('eds-c-table') || el.classList?.contains?.('tree-panel');
      const isTableCell = tag === 'td' || tag === 'th' || el.classList?.contains?.('table-cell') ||
                          el.classList?.contains?.('eds-c-table__cell');
      const isTableColumn = tag === 'col' || tag === 'colgroup' || el.classList?.contains?.('table-column') ||
                            el.classList?.contains?.('eds-c-table__column');
      const isContainer = el.id === 'main-content' || el.classList?.contains?.('portlet') ||
                          el.classList?.contains?.('portlet-content') || el.classList?.contains?.('portlet-body') ||
                          isLayoutDropzone ||
                          el.classList?.contains?.('cvr-c-service-bar') ||
                          (rect.width >= 300 && (rect.height >= 200 || el.children?.length > 0) && !isTable);

      baselineMap[auditId] = {
        auditId,
        selector: getSelector(el),
        tagName: tag,
        isSvg,
        textSnippet: text,
        font: {
          family: cleanFontFamily(style.fontFamily),
          rawFamily: style.fontFamily,
          size: parseFloat(style.fontSize) || 14,
          weight: normalizeWeight(style.fontWeight),
          style: style.fontStyle || 'normal'
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
        },
        outline: {
          style: (style.outlineStyle || 'none').toLowerCase(),
          width: parseFloat(style.outlineWidth) || 0,
          color: style.outlineColor || ''
        },
        border: {
          topWidth: isVisibleBorder(style, 'Top'),
          rightWidth: isVisibleBorder(style, 'Right'),
          bottomWidth: isVisibleBorder(style, 'Bottom'),
          leftWidth: isVisibleBorder(style, 'Left'),
          topStyle: getBorderStyle(style, 'Top'),
          rightStyle: getBorderStyle(style, 'Right'),
          bottomStyle: getBorderStyle(style, 'Bottom'),
          leftStyle: getBorderStyle(style, 'Left')
        },
        borderRadius: bRadius,
        rawBorderRadius: rawRadius,
        isButton,
        isActionButton,
        isTable,
        isTableCell,
        isTableColumn,
        isContainer,
        svg: isSvg ? {
          fill: style.fill || el.getAttribute('fill') || '',
          stroke: style.stroke || el.getAttribute('stroke') || '',
          strokeWidth: parseFloat(style.strokeWidth || el.getAttribute('stroke-width')) || 0
        } : null
      };
    }

    return {
      totalElements: allElements.length,
      visibleCount,
      elements: baselineMap
    };
  }, options);
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

    const LINEAR_LUT = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const norm = i / 255;
      LINEAR_LUT[i] = norm <= 0.03928 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
    }

    function sRgbToLinear(c) {
      const idx = Math.max(0, Math.min(255, Math.round(c)));
      return LINEAR_LUT[idx];
    }

    function getLuminance(r, g, b) {
      const ir = Math.max(0, Math.min(255, Math.round(r)));
      const ig = Math.max(0, Math.min(255, Math.round(g)));
      const ib = Math.max(0, Math.min(255, Math.round(b)));
      return 0.2126 * LINEAR_LUT[ir] + 0.7152 * LINEAR_LUT[ig] + 0.0722 * LINEAR_LUT[ib];
    }

    function getContrast(rgb1, rgb2) {
      const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
      const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }

    function blendRgb(top, bottom) {
      const a = top.a !== undefined ? top.a : 1.0;
      return {
        r: Math.round(top.r * a + bottom.r * (1.0 - a)),
        g: Math.round(top.g * a + bottom.g * (1.0 - a)),
        b: Math.round(top.b * a + bottom.b * (1.0 - a)),
        a: 1.0
      };
    }

    function getEffectiveBg(el) {
      const defaultBg = isDark ? { r: 18, g: 23, b: 31, a: 1 } : { r: 255, g: 255, b: 255, a: 1 };
      const layers = [];
      let curr = el;
      while (curr && curr !== document.documentElement) {
        if (curr === document.body) {
          if (isDark) {
            layers.unshift({ r: 18, g: 23, b: 31, a: 1 });
            break;
          }
          const bStyle = window.getComputedStyle(curr);
          const bBg = parseRgb(bStyle.backgroundColor);
          layers.unshift((bBg && bBg.a > 0.05) ? bBg : { r: 255, g: 255, b: 255, a: 1 });
          break;
        }
        const style = window.getComputedStyle(curr);
        const bg = parseRgb(style.backgroundColor);
        if (bg && bg.a > 0.01) {
          if (isDark && bg.r > 200 && bg.g > 200 && bg.b > 200 && (curr.id === 'main-content' || curr.classList?.contains?.('portlet-layout') || curr.classList?.contains?.('portlet-dropzone'))) {
            layers.unshift({ r: 18, g: 23, b: 31, a: 1 });
            break;
          }
          layers.unshift(bg);
          if (bg.a >= 0.95) break;
        }
        curr = curr.parentElement;
      }
      if (layers.length === 0) return defaultBg;
      let result = layers[0].a >= 0.95 ? layers[0] : blendRgb(layers[0], defaultBg);
      for (let i = 1; i < layers.length; i++) {
        result = blendRgb(layers[i], result);
      }
      return result;
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
      let path = (el.tagName || 'div').toLowerCase();
      if (el.className && typeof el.className === 'string') {
        const cls = el.className.trim().split(/\s+/).filter(c => !c.startsWith('ng-') && !c.startsWith('cx-audit-')).slice(0, 2).join('.');
        if (cls) path += '.' + cls;
      }
      return path;
    }

    function isVisibleBorder(st, side) {
      const borderStyle = st['border' + side + 'Style'] || st.borderStyle || 'none';
      const widthVal = parseFloat(st['border' + side + 'Width'] || st.borderWidth) || 0;
      if (borderStyle === 'none' || borderStyle === 'hidden' || widthVal <= 0) return 0;
      const colorStr = st['border' + side + 'Color'] || st.borderColor;
      if (colorStr) {
        if (colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)' || colorStr === 'rgba(0,0,0,0)') return 0;
        const rgb = parseRgb(colorStr);
        if (rgb && rgb.a <= 0.05) return 0;
      }
      return widthVal;
    }

    function checkWebfontGlitch(node) {
      try {
        const checkPseudo = (pseudoName) => {
          const ps = pseudoName ? window.getComputedStyle(node, pseudoName) : window.getComputedStyle(node);
          if (!ps) return null;
          const content = (typeof ps.getPropertyValue === 'function' ? ps.getPropertyValue('content') : ps.content) || '';
          if (!pseudoName && node.children && node.children.length > 0) {
            return null;
          }
          const textVal = pseudoName ? content : (node.innerText || node.textContent || '');
          const hasPua = /[\uE000-\uF8FF]/.test(textVal) || /["']\\e[0-9a-f]{3,4}["']/i.test(content);
          if (hasPua) {
            const fontFam = (ps.fontFamily || '').toLowerCase();
            const isWebfont = fontFam.includes('connect-webfont') || fontFam.includes('vaadin') || fontFam.includes('font-awesome') || fontFam.includes('fontawesome') || fontFam.includes('icomoon') || fontFam.includes('material') || fontFam.includes('glyph');
            const isStandardFont = fontFam.startsWith('open sans') || fontFam.startsWith('arial') || fontFam.startsWith('roboto') || fontFam.startsWith('system-ui') || fontFam.startsWith('sans-serif');
            if (!isWebfont || isStandardFont) {
              return { fontFam, pseudo: pseudoName || 'self' };
            }
          }
          return null;
        };
        return checkPseudo(null) || checkPseudo('::before') || checkPseudo('::after');
      } catch {
        return null;
      }
    }

    const issues = [];
    opts = opts || {};
    const isSidebarScope = opts.auditScope === 'sidebar';
    const baseMap = baseline?.elements || {};
    let currentElements;
    if (isSidebarScope) {
      const sidebarRoot = typeof document.getElementById === 'function' ? document.getElementById('connectify-sidebar') : null;
      const handleRoot = typeof document.getElementById === 'function' ? document.getElementById('connectify-sidebar-handle') : null;
      if (sidebarRoot || handleRoot) {
        currentElements = [];
        if (sidebarRoot) {
          currentElements.push(sidebarRoot);
          if (typeof sidebarRoot.querySelectorAll === 'function') {
            currentElements.push(...Array.from(sidebarRoot.querySelectorAll('*')));
          }
        }
        if (handleRoot) {
          currentElements.push(handleRoot);
          if (typeof handleRoot.querySelectorAll === 'function') {
            currentElements.push(...Array.from(handleRoot.querySelectorAll('*')));
          }
        }
      } else {
        const bodyEls = typeof document.querySelectorAll === 'function' ? Array.from(document.querySelectorAll('body *')) : [];
        currentElements = bodyEls.filter(el =>
          el.id === 'connectify-sidebar' || el.id === 'connectify-sidebar-handle' ||
          Boolean(typeof el.closest === 'function' && el.closest('#connectify-sidebar, #connectify-sidebar-handle'))
        );
      }
    } else {
      currentElements = typeof document.querySelectorAll === 'function' ? document.querySelectorAll('body *') : [];
    }
    const currentVisibleIds = new Set();
    let currentVisibleCount = 0;

    for (let i = 0; i < currentElements.length; i++) {
      const el = currentElements[i];
      const auditId = el.dataset?.cxAuditId || ('cx_aud_' + i);
      const tag = (el.tagName || 'div').toLowerCase();
      if (['script', 'style', 'noscript', 'meta', 'link', 'template', 'title', 'desc', 'defs', 'clippath', 'mask'].includes(tag)) continue;
      
      if (isSidebarScope) {
        const inSidebar = el.id === 'connectify-sidebar' || el.id === 'connectify-sidebar-handle' ||
                          Boolean(typeof el.closest === 'function' && el.closest('#connectify-sidebar, #connectify-sidebar-handle'));
        if (!inSidebar) continue;
        if (el.id === 'connectea-theme-toggle' || (typeof el.closest === 'function' && el.closest('#connectea-theme-toggle'))) continue;
      } else {
        if (el.closest?.('#cx-expand-progress, #cx-expand-btn, [id*="cx-expand-"], [class*="cx-expand-"], mat-progress-bar, .mat-progress-bar, mat-spinner, .mat-spinner, mat-progress-spinner, #connectea-theme-toggle, #connectea-theme-menu, #connectify-sidebar, #connectify-sidebar-handle, [class*="connectify-"], [id*="connectify-"], .connectify-cohort-panel, .cx-compound-progress-container, .cx-workspace-panel, .cx-refresh-btn, .highcharts-container, svg.highcharts-root, .connectea-panel, .connectea-row-wrapper, .connectea-type-container, .connectea-type-select, .connectea-outcome-bar, .connectea-subject-controls')) continue;
      }

      const style = window.getComputedStyle(el);
      const isVisible = style.visibility !== 'hidden' && style.display !== 'none' && parseFloat(style.opacity) > 0;
      const rect = el.getBoundingClientRect();
      const isSvg = tag === 'svg' || tag === 'path' || tag === 'g' || tag === 'rect' || tag === 'circle' || tag === 'polygon' || tag === 'polyline' || tag === 'line' || (typeof SVGElement !== 'undefined' && el instanceof SVGElement);
      const isLayoutDropzone = el.classList?.contains?.('portlet-dropzone') ||
                               el.classList?.contains?.('portlet-column') ||
                               el.classList?.contains?.('portlet-column-content') ||
                               el.classList?.contains?.('portlet-layout') ||
                               (typeof el.id === 'string' && el.id.startsWith('layout-column'));
      const hasBox = isSvg ? (rect.width > 0 || rect.height > 0) : (isLayoutDropzone ? (rect.width > 0 || rect.height >= 0) : (rect.width > 0 && rect.height > 0));
      const selector = getSelector(el);
      const text = (el.innerText || el.textContent || '').slice(0, 30).trim();

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
          const currFontStyle = style.fontStyle || 'normal';

          function getPrimaryFont(f) {
            if (!f) return '';
            const cleaned = f.replace(/['"]/g, '').toLowerCase();
            return cleaned.split(',')[0].trim();
          }

          if (currFontFamily !== base.font.family && getPrimaryFont(style.fontFamily) !== getPrimaryFont(base.font.rawFamily)) {
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

          if (base.font.style && currFontStyle !== base.font.style && (currFontStyle === 'italic' || base.font.style === 'italic')) {
            issues.push({
              category: 'PARITY',
              type: 'FONT_STYLE_MISMATCH',
              severity: 'HIGH',
              selector,
              details: `Font style changed: Native "${base.font.style}" vs Theme "${currFontStyle}"`,
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

          // D. Outline Parity Check
          const curOutlineStyle = style.outlineStyle || 'none';
          const curOutlineWidth = parseFloat(style.outlineWidth) || 0;
          const baseOutlineStyle = base.outline?.style || 'none';
          const baseOutlineWidth = base.outline?.width || 0;
          if (
            (curOutlineStyle !== 'none' && curOutlineWidth > 0 && (baseOutlineStyle === 'none' || baseOutlineWidth === 0)) ||
            (baseOutlineStyle !== 'none' && baseOutlineWidth > 0 && (curOutlineStyle === 'none' || curOutlineWidth === 0)) ||
            (curOutlineStyle !== 'none' && baseOutlineStyle !== 'none' && Math.abs(curOutlineWidth - baseOutlineWidth) > 0.5)
          ) {
            issues.push({
              category: 'PARITY',
              type: 'OUTLINE_MISMATCH',
              severity: 'HIGH',
              selector,
              details: `Outline changed: Native "${baseOutlineStyle} ${baseOutlineWidth}px" vs Theme "${curOutlineStyle} ${curOutlineWidth}px"`,
              textSnippet: text
            });
          }

          // E. Border Parity Check
          const curBorderTop = isVisibleBorder(style, 'Top');
          const curBorderBottom = isVisibleBorder(style, 'Bottom');
          const curBorderLeft = isVisibleBorder(style, 'Left');
          const curBorderRight = isVisibleBorder(style, 'Right');

          const baseBorderTop = base.border?.topWidth || 0;
          const baseBorderBottom = base.border?.bottomWidth || 0;
          const baseBorderLeft = base.border?.leftWidth || 0;
          const baseBorderRight = base.border?.rightWidth || 0;

          const addedBorder = (curBorderTop > 0 && baseBorderTop === 0) || (curBorderBottom > 0 && baseBorderBottom === 0) ||
                              (curBorderLeft > 0 && baseBorderLeft === 0) || (curBorderRight > 0 && baseBorderRight === 0);
          const removedBorder = (baseBorderTop > 0 && curBorderTop === 0) || (baseBorderBottom > 0 && curBorderBottom === 0) ||
                                (baseBorderLeft > 0 && curBorderLeft === 0) || (baseBorderRight > 0 && curBorderRight === 0);

          const isPanelCardTileModal = Boolean(
            el.classList?.contains?.('eds-c-card') ||
            el.classList?.contains?.('cvr-c-card') ||
            el.classList?.contains?.('eds-c-panel') ||
            el.classList?.contains?.('cvr-c-panel') ||
            el.classList?.contains?.('eds-c-tile') ||
            el.classList?.contains?.('cvr-c-tile') ||
            el.classList?.contains?.('cvr-c-modal') ||
            el.classList?.contains?.('eds-c-modal') ||
            el.classList?.contains?.('mat-dialog-container') ||
            el.classList?.contains?.('v-modal') ||
            (el.matches && el.matches('.eds-c-card, .cvr-c-card, .eds-c-panel, .cvr-c-panel, .eds-c-tile, .cvr-c-tile, .cvr-c-modal, .eds-c-modal, .mat-dialog-container, .v-modal, [class*="card"], [class*="panel"], [class*="tile"], [class*="modal"]'))
          );

          if (addedBorder || removedBorder) {
            if (tid !== 'liquid-glass' || !isPanelCardTileModal) {
              issues.push({
                category: 'PARITY',
                type: 'BORDER_MISMATCH',
                severity: 'MEDIUM',
                selector,
                details: `Border changed: Native [T:${baseBorderTop}, R:${baseBorderRight}, B:${baseBorderBottom}, L:${baseBorderLeft}] vs Theme [T:${curBorderTop}, R:${curBorderRight}, B:${curBorderBottom}, L:${curBorderLeft}]`,
                textSnippet: text
              });
            }
          }

          // Specific Defect Checks:
          // 1. Table Cell and Column Border Added or Removed
          const isTableElement = Boolean(
            base.isTableCell || base.isTable || base.isTableColumn ||
            tag === 'td' || tag === 'th' || tag === 'col' || tag === 'colgroup' ||
            el.classList?.contains?.('table-cell') || el.classList?.contains?.('table-column') ||
            el.classList?.contains?.('eds-c-table__cell') || el.classList?.contains?.('eds-c-table__column')
          );

          if (isTableElement && (addedBorder || removedBorder)) {
            const addedSides = [];
            const removedSides = [];
            if (curBorderTop > 0 && baseBorderTop === 0) addedSides.push(`Top (${curBorderTop}px)`);
            if (curBorderRight > 0 && baseBorderRight === 0) addedSides.push(`Right (${curBorderRight}px)`);
            if (curBorderBottom > 0 && baseBorderBottom === 0) addedSides.push(`Bottom (${curBorderBottom}px)`);
            if (curBorderLeft > 0 && baseBorderLeft === 0) addedSides.push(`Left (${curBorderLeft}px)`);

            if (baseBorderTop > 0 && curBorderTop === 0) removedSides.push(`Top (${baseBorderTop}px)`);
            if (baseBorderRight > 0 && curBorderRight === 0) removedSides.push(`Right (${baseBorderRight}px)`);
            if (baseBorderBottom > 0 && curBorderBottom === 0) removedSides.push(`Bottom (${baseBorderBottom}px)`);
            if (baseBorderLeft > 0 && curBorderLeft === 0) removedSides.push(`Left (${baseBorderLeft}px)`);

            let actionDesc = '';
            if (addedSides.length > 0 && removedSides.length > 0) {
              actionDesc = `gained unwanted border on [${addedSides.join(', ')}] and lost border on [${removedSides.join(', ')}]`;
            } else if (addedSides.length > 0) {
              actionDesc = `gained unwanted border on [${addedSides.join(', ')}]`;
            } else {
              actionDesc = `lost unwanted border on [${removedSides.join(', ')}]`;
            }

            issues.push({
              category: 'PARITY',
              type: 'TABLE_VERTICAL_BORDER_ADDED',
              severity: 'HIGH',
              selector,
              details: `Table cell/column ${actionDesc}: Native [T:${baseBorderTop}, R:${baseBorderRight}, B:${baseBorderBottom}, L:${baseBorderLeft}] vs Theme [T:${curBorderTop}, R:${curBorderRight}, B:${curBorderBottom}, L:${curBorderLeft}]`,
              textSnippet: text
            });
          }

          // 2. Action Button Border Added
          if (base.isActionButton && baseBorderTop === 0 && baseBorderBottom === 0 && baseBorderLeft === 0 && baseBorderRight === 0) {
            if (curBorderTop > 0 || curBorderBottom > 0 || curBorderLeft > 0 || curBorderRight > 0) {
              issues.push({
                category: 'PARITY',
                type: 'BUTTON_BORDER_ADDED',
                severity: 'HIGH',
                selector,
                details: `Action button gained unwanted visible border: [T:${curBorderTop}, R:${curBorderRight}, B:${curBorderBottom}, L:${curBorderLeft}]`,
                textSnippet: text
              });
            }
          }

          // 3. Circular Outline Added
          const curBorderRadius = parseFloat(style.borderRadius) || 0;
          const isThemeCircular = curBorderRadius >= 16 || (typeof style.borderRadius === 'string' && style.borderRadius.includes('50%'));
          const wasNativeCircular = (base.borderRadius >= 16) || (typeof base.rawBorderRadius === 'string' && base.rawBorderRadius.includes('50%'));
          if ((base.isActionButton || base.isButton) && !wasNativeCircular && isThemeCircular && (addedBorder || curOutlineWidth > 0)) {
            issues.push({
              category: 'PARITY',
              type: 'CIRCULAR_OUTLINE_ADDED',
              severity: 'HIGH',
              selector,
              details: `Button gained circular outline: Native radius ${base.borderRadius}px vs Theme radius ${style.borderRadius}`,
              textSnippet: text
            });
          }

          // 4. Button Radius Mismatch (square corners becoming rounded)
          if (base.isButton && !base.isActionButton && base.borderRadius === 0 && curBorderRadius >= 4) {
            issues.push({
              category: 'PARITY',
              type: 'BUTTON_RADIUS_MISMATCH',
              severity: 'HIGH',
              selector,
              details: `Button corners rounded when native had square corners: Native ${base.borderRadius}px vs Theme ${curBorderRadius}px`,
              textSnippet: text
            });
          }

          // 5. Button Size Mismatch
          if (base.isButton && (Math.abs(curHeight - base.size.height) > 4 || Math.abs(curWidth - base.size.width) > 8)) {
            issues.push({
              category: 'PARITY',
              type: 'BUTTON_SIZE_MISMATCH',
              severity: 'HIGH',
              selector,
              details: `Button size mismatch: Native [${base.size.width}x${base.size.height}] vs Theme [${curWidth}x${curHeight}]`,
              textSnippet: text
            });
          }

          // 6. Container Outline Added (creating unwanted new segments)
          if (base.isContainer && baseBorderTop === 0 && baseBorderBottom === 0 && baseBorderLeft === 0 && baseBorderRight === 0 && (base.outline?.width || 0) === 0) {
            if (curBorderTop > 0 || curBorderBottom > 0 || curBorderLeft > 0 || curBorderRight > 0 || curOutlineWidth > 0) {
              if (tid !== 'liquid-glass' || !isPanelCardTileModal) {
                issues.push({
                  category: 'PARITY',
                  type: 'CONTAINER_OUTLINE_ADDED',
                  severity: 'HIGH',
                  selector,
                  details: `Container gained unwanted border or outline creating a new page segment: [T:${curBorderTop}, R:${curBorderRight}, B:${curBorderBottom}, L:${curBorderLeft}]`,
                  textSnippet: text
                });
              }
            }
          }

          // 7. Dashed or Dotted Border Added (unwanted dashed outlines/segments)
          const curTopStyle = (style.borderTopStyle || 'none').toLowerCase();
          const curRightStyle = (style.borderRightStyle || 'none').toLowerCase();
          const curBottomStyle = (style.borderBottomStyle || 'none').toLowerCase();
          const curLeftStyle = (style.borderLeftStyle || 'none').toLowerCase();
          const curOutStyle = (style.outlineStyle || 'none').toLowerCase();

          const hasDashedBorder = (curBorderTop > 0 && (curTopStyle === 'dashed' || curTopStyle === 'dotted')) ||
                                  (curBorderRight > 0 && (curRightStyle === 'dashed' || curRightStyle === 'dotted')) ||
                                  (curBorderBottom > 0 && (curBottomStyle === 'dashed' || curBottomStyle === 'dotted')) ||
                                  (curBorderLeft > 0 && (curLeftStyle === 'dashed' || curLeftStyle === 'dotted'));
          const hasDashedOutline = curOutlineWidth > 0 && (curOutStyle === 'dashed' || curOutStyle === 'dotted');

          const baseTopStyle = base.border?.topStyle || 'none';
          const baseRightStyle = base.border?.rightStyle || 'none';
          const baseBottomStyle = base.border?.bottomStyle || 'none';
          const baseLeftStyle = base.border?.leftStyle || 'none';
          const baseOutStyle = base.outline?.style || 'none';

          const baseHadDashed = baseTopStyle === 'dashed' || baseTopStyle === 'dotted' ||
                                baseRightStyle === 'dashed' || baseRightStyle === 'dotted' ||
                                baseBottomStyle === 'dashed' || baseBottomStyle === 'dotted' ||
                                baseLeftStyle === 'dashed' || baseLeftStyle === 'dotted' ||
                                baseOutStyle === 'dashed' || baseOutStyle === 'dotted';

          const isLegitUploadZone = el.classList?.contains?.('v-multifileupload-dropzone') ||
                                    el.classList?.contains?.('cvr-c-upload-control') ||
                                    el.classList?.contains?.('cvr-c-upload-gallery') ||
                                    (tag === 'input' && el.getAttribute?.('type') === 'file');

          if ((hasDashedBorder || hasDashedOutline) && !baseHadDashed && !isLegitUploadZone) {
            issues.push({
              category: 'PARITY',
              type: 'DASHED_BORDER_ADDED',
              severity: 'HIGH',
              selector,
              details: `Element gained unwanted dashed or dotted border/outline: [T:${curTopStyle} ${curBorderTop}px, R:${curRightStyle} ${curBorderRight}px, B:${curBottomStyle} ${curBorderBottom}px, L:${curLeftStyle} ${curBorderLeft}px, outline:${curOutStyle} ${curOutlineWidth}px]`,
              textSnippet: text
            });
          }

          // F. SVG Fill and Stroke Parity Check
          if (base.isSvg || isSvg) {
            function normalizeFillVal(f) {
              if (!f || f === 'none' || f === 'transparent' || f === 'rgba(0, 0, 0, 0)') return 'none';
              return f.replace(/\s+/g, '').toLowerCase();
            }
            const curFill = style.fill || el.getAttribute('fill') || '';
            const baseFill = base.svg?.fill || '';
            const normCurFill = normalizeFillVal(curFill);
            const normBaseFill = normalizeFillVal(baseFill);

            if (normCurFill !== normBaseFill && (normCurFill === 'none' || normBaseFill === 'none' || normCurFill === 'currentcolor' || normBaseFill === 'currentcolor')) {
              issues.push({
                category: 'PARITY',
                type: 'SVG_FILL_MISMATCH',
                severity: 'HIGH',
                selector,
                details: `SVG fill changed: Native "${baseFill || 'none'}" vs Theme "${curFill || 'none'}"`,
                textSnippet: text
              });
            }

            const curStroke = style.stroke || el.getAttribute('stroke') || '';
            const baseStroke = base.svg?.stroke || '';
            const normCurStroke = normalizeFillVal(curStroke);
            const normBaseStroke = normalizeFillVal(baseStroke);
            if (normCurStroke !== normBaseStroke && (normCurStroke === 'none' || normBaseStroke === 'none')) {
              issues.push({
                category: 'PARITY',
                type: 'SVG_STROKE_MISMATCH',
                severity: 'HIGH',
                selector,
                details: `SVG stroke changed: Native "${baseStroke || 'none'}" vs Theme "${curStroke || 'none'}"`,
                textSnippet: text
              });
            }
          }
        } else {
          const curTopStyle = (style.borderTopStyle || 'none').toLowerCase();
          const curRightStyle = (style.borderRightStyle || 'none').toLowerCase();
          const curBottomStyle = (style.borderBottomStyle || 'none').toLowerCase();
          const curLeftStyle = (style.borderLeftStyle || 'none').toLowerCase();
          const curOutStyle = (style.outlineStyle || 'none').toLowerCase();
          const curBorderTop = isVisibleBorder(style, 'Top');
          const curBorderRight = isVisibleBorder(style, 'Right');
          const curBorderBottom = isVisibleBorder(style, 'Bottom');
          const curBorderLeft = isVisibleBorder(style, 'Left');
          const curOutlineWidth = parseFloat(style.outlineWidth) || 0;
          const hasDashedBorder = (curBorderTop > 0 && (curTopStyle === 'dashed' || curTopStyle === 'dotted')) ||
                                  (curBorderRight > 0 && (curRightStyle === 'dashed' || curRightStyle === 'dotted')) ||
                                  (curBorderBottom > 0 && (curBottomStyle === 'dashed' || curBottomStyle === 'dotted')) ||
                                  (curBorderLeft > 0 && (curLeftStyle === 'dashed' || curLeftStyle === 'dotted'));
          const hasDashedOutline = curOutlineWidth > 0 && (curOutStyle === 'dashed' || curOutStyle === 'dotted');
          const isLegitUploadZone = el.classList?.contains?.('v-multifileupload-dropzone') ||
                                    el.classList?.contains?.('cvr-c-upload-control') ||
                                    el.classList?.contains?.('cvr-c-upload-gallery') ||
                                    (tag === 'input' && el.getAttribute?.('type') === 'file');
          if ((hasDashedBorder || hasDashedOutline) && !isLegitUploadZone) {
            issues.push({
              category: 'PARITY',
              type: 'DASHED_BORDER_ADDED',
              severity: 'HIGH',
              selector,
              details: `Element became visible with unwanted dashed/dotted border: [T:${curTopStyle} ${curBorderTop}px, R:${curRightStyle} ${curBorderRight}px, B:${curBottomStyle} ${curBorderBottom}px, L:${curLeftStyle} ${curBorderLeft}px]`,
              textSnippet: text
            });
          }
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

        // A. Unicode Webfont Icon Check (Missing webfont renders tofu Unicode placeholder box)
        const iconGlitch = checkWebfontGlitch(el);
        if (iconGlitch) {
          issues.push({
            category: 'STYLE',
            type: 'BROKEN_WEBFONT_ICON',
            severity: 'CRITICAL',
            selector,
            details: `Unicode webfont icon has overridden font family "${iconGlitch.fontFam}" (${iconGlitch.pseudo}), rendering tofu placeholder`,
            textSnippet: text
          });
        }

        // B. Native Purple Ink Bar
        if (el.classList?.contains?.('mat-ink-bar')) {
          if (elBg && elBg.r > 90 && elBg.r < 125 && elBg.g < 100 && elBg.b > 160) {
            issues.push({
              category: 'STYLE',
              type: 'NATIVE_PURPLE_INK_BAR',
              severity: 'HIGH',
              selector,
              details: `Native purple .mat-ink-bar active: ${style.backgroundColor}`
            });
          }
        }

        // C. Background Bleed in Dark Mode
        if (isDark && elBg && elBg.a > 0.6 && !['img', 'video', 'canvas'].includes(tag)) {
          const bgLum = getLuminance(elBg.r, elBg.g, elBg.b);
          const isLightBg = bgLum > 0.45 || (elBg.r > 165 && elBg.g > 165 && elBg.b > 165);
          if (isLightBg) {
            const isControlOrWidget = ['input', 'button'].includes(tag) ||
              el.classList?.contains?.('mat-ink-bar') ||
              el.classList?.contains?.('mat-checkbox-background') ||
              (rect.width <= 140 && rect.height <= 40);
            const isExempt = isControlOrWidget || Boolean(el.closest?.(
              '.mat-badge, .badge, .status-pill, .chip-light, [class*="badge"], [class*="chip"], [class*="timeout"], [class*="session"], [id*="timeout"], [id*="session"], .popup-alert-notice, .popup-alert-warning, .portal-session-warning, .session-timeout, .cvr-c-timeout-alert'
            ));
            if (!isExempt) {
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

        // D. Contrast Checks (Including unadapted native plum/purple #7f375c and dark-on-dark text)
        const hasDirectText = Array.from(el.childNodes || []).some(n => n.nodeType === 3 && n.textContent?.trim().length > 0);
        if (hasDirectText && elColor && effectiveBg && !isSvg && !el.closest?.('svg')) {
          const alpha = elColor.a !== undefined ? elColor.a : 1.0;
          const compColor = {
            r: Math.round(elColor.r * alpha + effectiveBg.r * (1.0 - alpha)),
            g: Math.round(elColor.g * alpha + effectiveBg.g * (1.0 - alpha)),
            b: Math.round(elColor.b * alpha + effectiveBg.b * (1.0 - alpha)),
            a: 1.0
          };
          const cr = getContrast(compColor, effectiveBg);
          const fontSize = parseFloat(style.fontSize) || 14;
          const isBold = normalizeWeight(style.fontWeight) >= 600;
          const isLarge = fontSize >= 18 || (fontSize >= 14 && isBold);
          const minCr = isLarge ? 3.0 : 4.5;
          const isUnadaptedPurple = isDark && elColor.r > 100 && elColor.r < 150 && elColor.g < 80 && elColor.b < 120;
          const effBgLum = getLuminance(effectiveBg.r, effectiveBg.g, effectiveBg.b);
          const isUnadaptedDarkOnDark = isDark && effBgLum < 0.15 && (compColor.r < 95 && compColor.g < 95 && compColor.b < 95);

          if (cr < 3.0 || (isUnadaptedPurple && cr < 4.5) || isUnadaptedDarkOnDark) {
            issues.push({
              category: 'STYLE',
              type: 'CRITICAL_CONTRAST_VIOLATION',
              severity: 'CRITICAL',
              selector,
              details: isUnadaptedPurple
                ? `Illegible unadapted purple text ${style.color} on dark background (contrast ${cr.toFixed(2)}:1)`
                : (isUnadaptedDarkOnDark
                  ? `Illegible unadapted dark text ${style.color} on dark background (contrast ${cr.toFixed(2)}:1)`
                  : `Illegible contrast ratio ${cr.toFixed(2)}:1 (color: ${style.color})`),
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

        // E. Adjacent Container Contrast Standard (<= 1.5:1)
        if (isDark && elBg && elBg.a > 0.5 && el.parentElement && !isSvg && !el.closest?.('svg')) {
          const parentStyle = window.getComputedStyle(el.parentElement);
          const parentBg = parseRgb(parentStyle.backgroundColor);
          // A container and its own padding are one surface: when the element fills the parent's content box
          // (both axes), the parent is that element's padding and should be the same colour
          const isPaddingOf = (() => {
            const pr = el.parentElement.getBoundingClientRect(), er = el.getBoundingClientRect();
            const pad = ['Top', 'Right', 'Bottom', 'Left'].map(sd => parseFloat(parentStyle[`padding${sd}`]) || 0);
            const fills = Math.abs(er.width - (pr.width - pad[1] - pad[3])) <= 2 && Math.abs(er.height - (pr.height - pad[0] - pad[2])) <= 2;
            return pad.some(v => v > 0) && fills;
          })();
          if (isPaddingOf && parentBg && parentBg.a > 0.9 && elBg.a > 0.9 &&
              !el.closest?.('.v-Notification-system, [class*="progress"], [class*="chart"], [class*="box-plot"], .highcharts-container, .cvr-c-task__chart') &&
              (Math.abs(elBg.r - parentBg.r) > 2 || Math.abs(elBg.g - parentBg.g) > 2 || Math.abs(elBg.b - parentBg.b) > 2)) {
            issues.push({
              category: 'STYLE',
              type: 'PADDING_COLOR_MISMATCH',
              severity: 'WARNING',
              selector,
              details: `Element fills its parent's content box, so the parent's padding should be the same colour (${style.backgroundColor} vs ${parentStyle.backgroundColor})`,
              contrast: getContrast(elBg, parentBg).toFixed(2)
            });
          }
          if (parentBg && parentBg.a > 0.5 && !isPaddingOf) {
            const isDistinct = Math.abs(elBg.r - parentBg.r) > 4 || Math.abs(elBg.g - parentBg.g) > 4 || Math.abs(elBg.b - parentBg.b) > 4;
            if (isDistinct) {
              const bgCr = getContrast(elBg, parentBg);
              if (bgCr <= 1.5) {
                // A separator counts on any side (e.g. a thead bottom border or a sidebar right edge),
                // and so does an outline or a 1px box-shadow ring, which separate without changing layout
                const separates = (color, width) => Boolean(color) && color.a > 0.3 && width >= 0.75 &&
                  (getContrast(color, elBg) >= 1.8 || getContrast(color, parentBg) >= 1.8);
                const borderSeparates = ['Top', 'Right', 'Bottom', 'Left'].some(side => {
                  const bStyle = style[`border${side}Style`] || 'none';
                  if (bStyle === 'none' || bStyle === 'hidden') return false;
                  return separates(parseRgb(style[`border${side}Color`]), parseFloat(style[`border${side}Width`]) || 0);
                });
                const outlineSeparates = style.outlineStyle && style.outlineStyle !== 'none' &&
                  separates(parseRgb(style.outlineColor), parseFloat(style.outlineWidth) || 0);
                const ringSeparates = (style.boxShadow || '').split(/,(?![^(]*\))/).some(shadow => {
                  const color = parseRgb(shadow);
                  const lengths = (shadow.replace(/rgba?\([^)]*\)/, '').match(/-?[\d.]+px/g) || []).map(parseFloat);
                  return lengths.length >= 4 && lengths[0] === 0 && lengths[1] === 0 && lengths[2] === 0 && separates(color, lengths[3]);
                });
                const hasSufficientBorderContrast = borderSeparates || outlineSeparates || ringSeparates;
                if (!hasSufficientBorderContrast) {
                  const isExempt = Boolean(el.closest?.(
                    '.v-Notification-system, [class*="progress"], [class*="chart"], [class*="box-plot"], .highcharts-container, .cvr-c-task__chart'
                  ));
                  if (!isExempt) {
                    issues.push({
                      category: 'STYLE',
                      type: 'ADJACENT_SIMILAR_COLOR_WARNING',
                      severity: 'WARNING',
                      selector,
                      details: `Adjacent containers styled with distinct colors have overly similar contrast ratio ${bgCr.toFixed(2)}:1 (<= 1.5:1) without a >= 2.0:1 border separator`,
                      contrast: bgCr.toFixed(2)
                    });
                  }
                }
              }
            }
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
    if (baseline && typeof baseline.visibleCount === 'number' && currentVisibleCount !== baseline.visibleCount) {
      issues.push({
        category: 'PARITY',
        type: 'VISIBLE_COUNT_MISMATCH',
        severity: 'HIGH',
        selector: isSidebarScope ? '#connectify-sidebar' : 'body',
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

async function runThemeAudit(customOptions = {}) {
  const options = Object.assign(parseArgs(), customOptions);
  console.log('[ThemeAudit] Initializing Connectify Theme & Parity Auditor...');

  const targetUrls = await resolveTargetUrls(options);
  console.log(`[ThemeAudit] Loaded ${targetUrls.length} page URL(s) to audit one by one.`);

  // Headless by default; a visible window opens only while logging in (--headful keeps it visible)
  const needsAuth = targetUrls.some(u => u.includes('connect.det.wa.edu.au'));
  const headless = options.headless !== null ? options.headless : (options.headful ? false : null);
  let browser;
  if (needsAuth) {
    try {
      const launched = await launchAuthenticated({
        headless,
        username: options.username,
        password: options.password,
        sessionFile: options.session,
        tag: 'ThemeAudit'
      });
      browser = launched.browser;
      await launched.page.close().catch(() => {});
    } catch (err) {
      console.error(`\n[ThemeAudit] ${err.message} Exiting to avoid auditing unauthenticated login pages.`);
      process.exit(1);
    }
  } else {
    browser = await utils.launchBrowser({ headless: headless !== false, loadExtension: true });
  }

  // Load available themes (excluding native/light as that is the baseline)
  const availableThemes = [
    { id: 'dark', name: 'Dark', isDark: true },
    { id: 'quantum', name: 'Quantum Dark', isDark: true },
    { id: 'amoled', name: 'AMOLED Black', isDark: true },
    { id: 'midnight', name: 'Midnight Navy', isDark: true },
    { id: 'forest', name: 'Emerald Forest', isDark: true },
    { id: 'sunset', name: 'Twilight Plum', isDark: true },
    { id: 'liquid-glass', name: 'Liquid Glass', isDark: true }
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
  const pageResults = {};

  // Iterate across all target URLs one by one
  for (let pageIdx = 0; pageIdx < targetUrls.length; pageIdx++) {
    const targetUrl = targetUrls[pageIdx];
    console.log(`\n========================================================================`);
    console.log(`[Page ${pageIdx + 1}/${targetUrls.length}] Auditing: ${targetUrl}`);
    console.log(`========================================================================`);

    let page = null;
    try {
      page = await browser.newPage();
      page.on('dialog', async (d) => {
        try { await d.dismiss(); } catch {}
      });
      await page.setViewport({ width: 1280, height: 900 });

      // Ensure session cookies are loaded into newly opened page
      if (fs.existsSync(options.session)) {
        await utils.loadSession(page, options.session);
      }

      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await utils.waitForPageReady(page, options.delay);

      // Verify that page didn't redirect to unauthenticated login
      const currentUrl = page.url();
      if (!targetUrl.includes('/login') && (currentUrl.includes('/login') || currentUrl.includes('login.det.wa.edu.au'))) {
        console.warn(`[ThemeAudit] Warning: ${targetUrl} redirected to login (${currentUrl}). Session may have expired. Skipping page audit.`);
        await page.close().catch(() => {});
        continue;
      }

      // Explore and trigger lazy-loaded components across the ENTIRE page
      if (options.scroll) {
        console.log(`    └─ Scrolling down to explore and render ENTIRE page content...`);
        await scrollEntirePage(page, { scope: 'page', step: options.scrollStep, delayMs: options.scrollDelay, maxScrolls: options.maxScrolls });
      }

      // In-page Sub-views Discovery (Navbar headings, tabs, calendar view switchers)
      let subViews = [];
      if (options.subPages) {
        subViews = await discoverSubPages(page);
      }

      // Determine initial/active view title
      const activeSubView = subViews.find(v => v.isActive);
      const initialTitle = activeSubView ? activeSubView.title : 'Default View';

      // Gather all page views to audit under the same URL
      const otherViews = subViews.filter(v => !v.isActive).slice(0, options.maxSubPages);
      const pageViews = [
        { title: initialTitle, isInitial: true, auditScope: 'page' },
        ...otherViews.map(v => ({ title: v.title, isInitial: false, auditScope: 'page' }))
      ];

      // Discover Sidebar Views (sidebar drawer and all tabs/sub-tabs)
      let sidebarViews = [];
      if (options.sidebar) {
        sidebarViews = await discoverSidebarViews(page, options);
      }

      let viewsToAudit = [];
      if (options.sidebarOnly) {
        viewsToAudit = sidebarViews;
      } else {
        viewsToAudit = [...pageViews, ...sidebarViews];
      }

      if (viewsToAudit.length > 1) {
        console.log(`[ThemeAudit] Discovered ${viewsToAudit.length} view(s) to audit under ${targetUrl} (${pageViews.length} page, ${sidebarViews.length} sidebar):`);
        for (let vIdx = 0; vIdx < viewsToAudit.length; vIdx++) {
          const v = viewsToAudit[vIdx];
          const typeLabel = v.auditScope === 'sidebar' ? 'Sidebar view' : (v.isInitial ? 'Initial view' : 'Navbar heading');
          console.log(`  └─ [${vIdx + 1}/${viewsToAudit.length}] ${v.title} (${typeLabel})`);
        }
      }

      const seenViewSignatures = new Map();

      // Audit each view / content state under targetUrl
      for (let vIdx = 0; vIdx < viewsToAudit.length; vIdx++) {
        const currentView = viewsToAudit[vIdx];
        const isSidebar = currentView.auditScope === 'sidebar';
        console.log(`\n  ┌───────────────────────────────────────────────────────────────`);
        console.log(`  │ [View ${vIdx + 1}/${viewsToAudit.length}] Auditing: ${currentView.title}`);
        console.log(`  │ Scope: ${currentView.auditScope || 'page'} | URL: ${targetUrl}`);
        console.log(`  └───────────────────────────────────────────────────────────────`);

        try {
          if (isSidebar) {
            console.log(`    └─ Activating sidebar view: "${currentView.title}"...`);
            const activated = await activateSidebarView(page, currentView, options.delay);
            if (!activated) {
              console.warn(`    └─ Could not activate sidebar view "${currentView.title}", skipping.`);
              continue;
            }
          } else {
            // Ensure sidebar is closed during standard page auditing so page parity is preserved
            await page.evaluate(() => {
              const sidebar = document.getElementById('connectify-sidebar');
              if (sidebar) sidebar.hidden = true;
            }).catch(() => {});

            // Switch to navbar heading if not the initial view
            if (!currentView.isInitial) {
              console.log(`    └─ Switching to navbar heading: "${currentView.title}"...`);
              const activated = await activateNavbarHeading(page, currentView.title, options.delay);
              if (!activated) {
                console.warn(`    └─ Could not activate navbar heading "${currentView.title}", skipping.`);
                continue;
              }
            }
          }

          // B. Open all collapsible panels on this view (page views only)
          if (!isSidebar && options.clickButtons) {
            console.log(`    └─ Expanding interactive panels and accordions...`);
            const clicked = await clickInteractiveButtons(page);
            const sample = clicked.length > 0
              ? ` (${clicked.slice(0, 5).join(', ')}${clicked.length > 5 ? ` +${clicked.length - 5} more` : ''})`
              : '';
            await page.waitForFunction(() => {
              if (window.ConnectifyIsBulkExpanding) return false;
              if (window.ConnectifyIsAccordionAnimating) return false;
              if (document.body?.classList?.contains('cx-freeze-scroll')) return false;
              return true;
            }, { timeout: 6000 }).catch(() => {});
            await new Promise(r => setTimeout(r, 2000));

            // Scroll down through newly revealed and expanded content across the entire page
            if (options.scroll) {
              console.log(`    └─ Scrolling down through newly revealed and expanded page content...`);
              await scrollEntirePage(page, { scope: 'page', step: options.scrollStep, delayMs: options.scrollDelay, maxScrolls: options.maxScrolls });
            }
          }

          // Scroll through the entire view (page or sidebar) so every element is fully rendered before baseline capture
          if (options.scroll) {
            console.log(`    └─ Scrolling down to capture the ENTIRE ${isSidebar ? 'sidebar' : 'page'} view...`);
            await scrollEntirePage(page, { scope: currentView.auditScope, step: options.scrollStep, delayMs: options.scrollDelay, maxScrolls: options.maxScrolls });
          }

          // C. Capture Connect Native Theme Baseline
          console.log(`    └─ Capturing Connect Native Theme baseline for "${currentView.title}"...`);
          const baseline = await captureNativeBaseline(page, { auditScope: currentView.auditScope });
          console.log(`       └─ Baseline captured: ${baseline.visibleCount} visible elements.`);

          // D. Skip redundant view if it has the exact same elements as an already-audited view
          const viewSignature = (isSidebar ? 'sidebar:' + (currentView.id || currentView.title) + ':' : '') + computeElementsSignature(baseline);
          if (seenViewSignatures.has(viewSignature)) {
            const existingTitle = seenViewSignatures.get(viewSignature);
            console.log(`       └─ Skipping "${currentView.title}": exact same elements (${baseline.visibleCount} visible) as view "${existingTitle}".`);
            await page.evaluate(() => {
              if (window.ConnectifyThemeRegistry?.setTheme) {
                window.ConnectifyThemeRegistry.setTheme('light');
              }
              document.documentElement.classList.remove('connectea-dark');
              delete document.documentElement.dataset.connecteaTheme;
              document.documentElement.removeAttribute('data-connectea-theme');
              if (document.body) {
                document.body.classList.remove('connectea-dark');
                delete document.body.dataset.connecteaTheme;
                document.body.removeAttribute('data-connectea-theme');
              }
            }).catch(() => {});
            continue;
          }
          seenViewSignatures.set(viewSignature, currentView.title);

          const viewThemeResults = {};
          console.log(`    └─ Auditing ${themesToTest.length} theme(s) against Connect Native baseline:`);

          // E. Audit all themes
          for (const t of themesToTest) {
            await page.evaluate((tid) => {
              if (window.ConnectifyThemeRegistry?.setTheme) {
                window.ConnectifyThemeRegistry.setTheme(tid);
              }
              document.documentElement.classList.add('connectea-dark');
              document.documentElement.dataset.connecteaTheme = tid;
              if (document.body) {
                document.body.classList.add('connectea-dark');
                document.body.dataset.connecteaTheme = tid;
              }
            }, t.id);

            await new Promise(r => setTimeout(r, 300));

            if (isSidebar) {
              await activateSidebarView(page, currentView, 100);
            }

            // Scroll down through entire themed page/sidebar to trigger any theme-dependent layout/rendering
            if (options.scroll) {
              await scrollEntirePage(page, { scope: currentView.auditScope, step: options.scrollStep, delayMs: options.scrollDelay, maxScrolls: options.maxScrolls });
            }

            const auditResult = await auditThemeAgainstBaseline(page, t.id, t.isDark !== false, baseline, { ...options, auditScope: currentView.auditScope });
            viewThemeResults[t.id] = { theme: t, audit: auditResult };

            const issues = auditResult.issues;
            const parityDiffs = issues.filter(i => i.category === 'PARITY').length;
            const criticalContrast = issues.filter(i => i.type === 'CRITICAL_CONTRAST_VIOLATION').length;
            const styleIssues = issues.filter(i => i.category === 'STYLE' && i.type !== 'CRITICAL_CONTRAST_VIOLATION').length;

            console.log(
              `       • ${t.name.padEnd(16)} [${t.id}]: ` +
              `Visible: ${auditResult.visibleCount}/${auditResult.baselineVisibleCount} | ` +
              `Parity: ${parityDiffs} | Crit: ${criticalContrast} | Style: ${styleIssues}`
            );

            if (options.screenshots) {
              const viewSlug = currentView.title.replace(/[^a-zA-Z0-9]/g, '_').slice(-20);
              const pageSlug = targetUrl.replace(/[^a-zA-Z0-9]/g, '_').slice(-25);
              const shotPath = path.join(options.screenshotsDir, `p${pageIdx + 1}_v${vIdx + 1}_${pageSlug}_${viewSlug}_${t.id}.png`);
              if (isSidebar) {
                const sidebarEl = await page.$('#connectify-sidebar');
                if (sidebarEl) {
                  await sidebarEl.screenshot({ path: shotPath }).catch(async () => {
                    await page.screenshot({ path: shotPath, fullPage: true });
                  });
                } else {
                  await page.screenshot({ path: shotPath, fullPage: true });
                }
              } else {
                await page.screenshot({ path: shotPath, fullPage: true });
              }
            }
          }

          // E. Record results
          const resultKey = viewsToAudit.length > 1
            ? `${targetUrl} [${currentView.title}]`
            : targetUrl;

          const viewRecord = {
            url: targetUrl,
            viewTitle: currentView.title,
            auditScope: currentView.auditScope || 'page',
            baselineVisibleCount: baseline.visibleCount,
            themes: viewThemeResults
          };

          allPageResults[resultKey] = viewRecord;

          if (!pageResults[targetUrl]) {
            pageResults[targetUrl] = {
              url: targetUrl,
              totalViews: 0,
              views: {},
              viewsList: [],
              viewTitle: currentView.title,
              baselineVisibleCount: baseline.visibleCount,
              themes: viewThemeResults
            };
          }

          pageResults[targetUrl].views[currentView.title] = viewRecord;
          pageResults[targetUrl].viewsList.push(viewRecord);
          pageResults[targetUrl].totalViews = Object.keys(pageResults[targetUrl].views).length;

          // F. Reset to Connect Native baseline before switching to next heading
          await page.evaluate(() => {
            const closeButtons = document.querySelectorAll('mat-dialog-container button, .mat-dialog-header button, .v-window-closebox, [aria-label*="close" i]');
            for (const b of closeButtons) {
              if (/close/i.test(b.textContent || '') || /close/i.test(b.getAttribute('aria-label') || '') || b.classList?.contains('v-window-closebox')) {
                try { b.click(); } catch {}
              }
            }
            const sidebar = document.getElementById('connectify-sidebar');
            if (sidebar) {
              const homeBtn = sidebar.querySelector('.cx-back-menu');
              if (homeBtn && typeof homeBtn.click === 'function') {
                try { homeBtn.click(); } catch {}
              }
            }
            if (window.ConnectifyThemeRegistry?.setTheme) {
              window.ConnectifyThemeRegistry.setTheme('light');
            }
            document.documentElement.classList.remove('connectea-dark');
            delete document.documentElement.dataset.connecteaTheme;
            document.documentElement.removeAttribute('data-connectea-theme');
            if (document.body) {
              document.body.classList.remove('connectea-dark');
              delete document.body.dataset.connecteaTheme;
              document.body.removeAttribute('data-connectea-theme');
            }
          }).catch(() => {});
          await page.keyboard.press('Escape').catch(() => {});
          await new Promise(r => setTimeout(r, 200));
        } catch (viewErr) {
          console.warn(`    └─ [ThemeAudit] Failed to audit view "${currentView.title}": ${viewErr.message}`);
        }
      }
    } catch (err) {
      console.warn(`[ThemeAudit] Error auditing ${targetUrl}: ${err.message}`);
    } finally {
      if (page && !page.isClosed()) {
        await page.close().catch(() => {});
      }
    }
  }

  console.log(`\n` + '='.repeat(72));
  console.log(`[ThemeAudit] Completed audit of ${Object.keys(pageResults).length} page(s) across ${Object.keys(allPageResults).length} view(s).`);
  console.log('='.repeat(72));

  // Write JSON Manifest
  const manifestData = buildAuditManifest(pageResults, allPageResults);
  fs.writeFileSync(options.outputJson, JSON.stringify(manifestData, null, 2), 'utf8');
  console.log(`[ThemeAudit] Saved JSON audit manifest: ${options.outputJson}`);

  // Write Markdown Report (< 150 lines)
  let md = `# Connectify Theme Parity & Style Audit Report\n\n`;
  md += `**Pages Audited:** ${Object.keys(allPageResults).length}  \n`;
  md += `**Baseline Theme:** Connect Native Theme (native styling)  \n`;
  md += `**Audited At:** ${new Date().toUTCString()}  \n\n`;
  md += `## Multi-Page Parity & Compliance Matrix\n\n`;
  md += `| Page URL / View | Theme | Visible | Parity Diffs | Critical | Status |\n`;
  md += `| :--- | :--- | :---: | :---: | :---: | :---: |\n`;

  const allRows = [];
  for (const pageUrl of Object.keys(allPageResults)) {
    const pageData = allPageResults[pageUrl];
    let urlDisplay;
    const cleanUrl = (pageData.url || pageUrl).replace(/^https?:\/\/connect\.det\.wa\.edu\.au/, '') || '/';
    if (pageData.viewTitle && pageData.viewTitle !== 'Default View') {
      const shortPath = cleanUrl.length > 25 ? '...' + cleanUrl.slice(-22) : cleanUrl;
      urlDisplay = `${shortPath} [${pageData.viewTitle}]`.slice(0, 60);
    } else {
      urlDisplay = cleanUrl.slice(0, 45);
    }
    for (const tid of Object.keys(pageData.themes)) {
      const item = pageData.themes[tid];
      const issues = item.audit.issues;
      const pDiff = issues.filter(i => i.category === 'PARITY').length;
      const cCrit = issues.filter(i => i.severity === 'CRITICAL' || i.type === 'CRITICAL_CONTRAST_VIOLATION' || i.type === 'BROKEN_WEBFONT_ICON').length;
      const sDiff = issues.filter(i => i.category === 'STYLE' && i.severity !== 'CRITICAL' && i.type !== 'CRITICAL_CONTRAST_VIOLATION' && i.type !== 'BROKEN_WEBFONT_ICON').length;
      const status = pDiff === 0 && cCrit === 0 && sDiff === 0 ? '✅ Pass' : (cCrit > 0 ? '❌ Crit' : '⚠️ Warn');
      allRows.push({ urlDisplay, themeName: item.theme.name, visible: `${item.audit.visibleCount}/${pageData.baselineVisibleCount}`, pDiff, cCrit, sDiff, status });
    }
  }

  // Prioritize displaying pages with parity differences and critical contrast issues
  allRows.sort((a, b) => (b.cCrit - a.cCrit) || (b.pDiff - a.pDiff) || (b.sDiff - a.sDiff));

  for (let i = 0; i < Math.min(allRows.length, 45); i++) {
    const r = allRows[i];
    md += `| \`${r.urlDisplay}\` | **${r.themeName}** | ${r.visible} | ${r.pDiff} | ${r.cCrit} | ${r.status} |\n`;
  }

  const mdLines = md.split('\n');
  const finalMd = mdLines.length > 145 ? mdLines.slice(0, 140).join('\n') + '\n\n*Truncated to 150 lines.*' : md;
  fs.writeFileSync(options.outputMd, finalMd, 'utf8');
  console.log(`[ThemeAudit] Saved Markdown audit report: ${options.outputMd}`);

  await browser.close();
  console.log('[ThemeAudit] Theme testing complete.');
  return manifestData;
}

/**
 * Constructs the structured audit manifest preserving all audited views across all pages.
 * - pages[url] maps each page URL to a record containing all of its views in .views and .viewsList
 * - pages[resultKey] also retains flat individual view records for backwards compatibility
 * - views maps each unique view resultKey to its audit data
 * - totalPages reflects distinct page URLs audited
 * - totalViews reflects all views audited across all pages
 */
function buildAuditManifest(pageResults = {}, allPageResults = {}, auditedAt = new Date().toISOString()) {
  const pagesOutput = {};

  // If pageResults is empty but allPageResults has items, reconstruct page groupings
  const resolvedPageResults = { ...pageResults };
  if (Object.keys(resolvedPageResults).length === 0 && Object.keys(allPageResults).length > 0) {
    for (const [key, vData] of Object.entries(allPageResults)) {
      const url = vData.url || key.split(' [')[0];
      if (!resolvedPageResults[url]) {
        resolvedPageResults[url] = {
          url,
          totalViews: 0,
          views: {},
          viewsList: [],
          viewTitle: vData.viewTitle,
          baselineVisibleCount: vData.baselineVisibleCount,
          themes: vData.themes
        };
      }
      const title = vData.viewTitle || 'Default View';
      resolvedPageResults[url].views[title] = vData;
      resolvedPageResults[url].viewsList.push(vData);
      resolvedPageResults[url].totalViews = Object.keys(resolvedPageResults[url].views).length;
    }
  }

  // 1. Grouped page records where each page contains ALL its views
  for (const [url, pData] of Object.entries(resolvedPageResults)) {
    const viewsMap = pData.views || {};
    const viewsList = pData.viewsList || Object.values(viewsMap);
    const initialView = viewsList[0] || {};
    pagesOutput[url] = {
      url: pData.url || url,
      totalViews: pData.totalViews || Object.keys(viewsMap).length,
      views: viewsMap,
      viewsList: viewsList,
      viewTitle: pData.viewTitle || initialView.viewTitle || 'Default View',
      baselineVisibleCount: pData.baselineVisibleCount || initialView.baselineVisibleCount || 0,
      themes: pData.themes || initialView.themes || {}
    };
  }

  // 2. Also expose individual views under resultKey on pagesOutput for backwards compatibility
  for (const [resKey, vData] of Object.entries(allPageResults)) {
    if (!pagesOutput[resKey]) {
      pagesOutput[resKey] = vData;
    }
  }

  return {
    auditedAt,
    totalPages: Object.keys(resolvedPageResults).length,
    totalViews: Object.keys(allPageResults).length,
    pages: pagesOutput,
    views: allPageResults
  };
}

if (require.main === module) {
  runThemeAudit().catch(err => {
    console.error('[ThemeAudit] Fatal error:', err);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  runThemeAudit,
  buildAuditManifest,
  resolveTargetUrls,
  clickInteractiveButtons,
  captureNativeBaseline,
  auditThemeAgainstBaseline,
  discoverSubPages,
  activateNavbarHeading,
  discoverSidebarViews,
  activateSidebarView,
  computeElementsSignature,
  scrollEntirePage
};

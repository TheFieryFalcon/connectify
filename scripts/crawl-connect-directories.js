/**
 * Connect Portal Directory & Route Crawler
 * Authenticates against Western Australia Department of Education Connect
 * (connect.det.wa.edu.au) and performs a breadth-first crawl to discover, map,
 * and categorize all available directories, portal routes, class spaces, and portlets.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./puppeteer-utils');

const DEFAULT_START_URL = 'https://connect.det.wa.edu.au';
const TARGET_HOST = 'connect.det.wa.edu.au';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    startUrl: DEFAULT_START_URL,
    maxDepth: 4,
    maxPages: 100,
    delay: 600,
    headful: false,
    username: null,
    password: null,
    interactive: false,
    force: false,
    session: path.resolve(__dirname, '..', utils.DEFAULT_SESSION_FILE),
    outputJson: path.resolve(__dirname, '..', 'connect_directories.json'),
    outputMd: path.resolve(__dirname, '..', 'connect_directories.md')
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--url' && args[i + 1]) options.startUrl = args[++i];
    else if (a === '--max-depth' && args[i + 1]) options.maxDepth = parseInt(args[++i], 10);
    else if (a === '--max-pages' && args[i + 1]) options.maxPages = parseInt(args[++i], 10);
    else if (a === '--delay' && args[i + 1]) options.delay = parseInt(args[++i], 10);
    else if (a === '--headful' || a === '--no-headless') options.headful = true;
    else if ((a === '--username' || a === '-u') && args[i + 1]) options.username = args[++i];
    else if ((a === '--password' || a === '-p') && args[i + 1]) options.password = args[++i];
    else if (a === '--interactive') options.interactive = true;
    else if (a === '--force' || a === '-f') options.force = true;
    else if (a === '--session' && args[i + 1]) options.session = path.resolve(args[++i]);
    else if (a === '--output-json' && args[i + 1]) options.outputJson = path.resolve(args[++i]);
    else if (a === '--output-md' && args[i + 1]) options.outputMd = path.resolve(args[++i]);
  }
  return options;
}

function normalizeUrl(rawUrl, baseUrl) {
  try {
    const parsed = new URL(rawUrl, baseUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    parsed.hash = '';
    // Strip jsessionid path parameter if present
    parsed.pathname = parsed.pathname.replace(/;jsessionid=[^/?#]+/gi, '');
    let pathname = parsed.pathname.replace(/\/+/g, '/');
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    parsed.pathname = pathname;
    return parsed.href;
  } catch {
    return null;
  }
}

function isExcludedPath(pathname) {
  const lower = pathname.toLowerCase();
  if (/logout|signout|timeout|inactivity|session_expired/i.test(lower)) return true;
  if (/\.(png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2|ttf|eot|pdf|zip|docx?|xlsx?|pptx?)$/i.test(lower)) {
    return true;
  }
  return false;
}

function categorizePath(pathname) {
  const p = pathname.toLowerCase();
  if (p.startsWith('/connect/cvr/class/')) return 'Class Space';
  if (p.startsWith('/connect/cvr/classes')) return 'Classes Directory';
  if (p.startsWith('/group/students/ui/my-settings/assessment-outlines')) return 'Assessment Outlines';
  if (p.startsWith('/group/students/ui/my-connect')) return 'Student Dashboard';
  if (p.startsWith('/group/students/notices')) return 'Notices & Feed';
  if (p.startsWith('/group/students/calendar')) return 'Calendar';
  if (p.startsWith('/group/students/library')) return 'Library';
  if (p.startsWith('/group/')) return 'Portal Page';
  if (p.startsWith('/connect/cvr/')) return 'CVR Microfrontend';
  if (p.startsWith('/documents/') || p.startsWith('/content/')) return 'Document Repository';
  if (p.startsWith('/c/portal/') || p.startsWith('/api/')) return 'Portlet / API Endpoint';
  return 'General Route';
}

function buildDirectoryTree(paths) {
  const root = { name: '/', count: 0, children: {} };

  for (const rawPath of paths) {
    const segments = rawPath.split('/').filter(Boolean);
    let curr = root;
    curr.count++;

    for (const seg of segments) {
      if (!curr.children[seg]) {
        curr.children[seg] = { name: seg, count: 0, children: {} };
      }
      curr = curr.children[seg];
      curr.count++;
    }
  }
  return root;
}

function formatAsciiTree(node, prefix = '') {
  let lines = [];
  const entries = Object.keys(node.children).sort();

  for (let i = 0; i < entries.length; i++) {
    const key = entries[i];
    const isLast = i === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const child = node.children[key];
    const childHasChildren = Object.keys(child.children).length > 0;

    lines.push(`${prefix}${connector}${key}${childHasChildren ? '/' : ''}`);
    if (childHasChildren) {
      const nextPrefix = prefix + (isLast ? '    ' : '│   ');
      lines = lines.concat(formatAsciiTree(child, nextPrefix));
    }
  }
  return lines;
}

async function extractPageLinks(page) {
  return await page.evaluate(() => {
    const found = new Set();

    // 1. Anchor tags
    document.querySelectorAll('a[href]').forEach(a => {
      const h = a.getAttribute('href');
      if (h && !h.startsWith('#') && !h.startsWith('javascript:')) found.add(h);
    });

    // 2. Angular router links
    document.querySelectorAll('[routerlink], [data-route]').forEach(el => {
      const r = el.getAttribute('routerlink') || el.getAttribute('data-route');
      if (r) found.add(r);
    });

    // 3. Selection lists & menu items
    document.querySelectorAll('.cvr-c-primary-navigation a, .v-link a, .mat-tab-link, .mat-nav-list a').forEach(a => {
      const h = a.getAttribute('href');
      if (h) found.add(h);
    });

    return Array.from(found);
  });
}

async function crawl() {
  const options = parseArgs();

  // Run-once guard: do not re-crawl if manifest already exists unless --force is specified
  if (!options.force && fs.existsSync(options.outputJson)) {
    try {
      const existing = JSON.parse(fs.readFileSync(options.outputJson, 'utf8'));
      if (existing && Array.isArray(existing.routes) && existing.routes.length > 0) {
        console.log(`[ConnectCrawler] Crawl already completed previously (${existing.routes.length} routes found).`);
        console.log(`[ConnectCrawler] Manifest: ${options.outputJson}`);
        console.log('[ConnectCrawler] Skipping crawl (runs once). Use --force to re-crawl.');
        return existing;
      }
    } catch {}
  }

  console.log('[ConnectCrawler] Initializing Connect Directory Crawler...');
  console.log(`[ConnectCrawler] Max depth: ${options.maxDepth} | Max pages: ${options.maxPages} | Delay: ${options.delay}ms`);

  const browser = await utils.launchBrowser({
    headless: !options.headful,
    loadExtension: true
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Authenticate session
  console.log('[ConnectCrawler] Verifying authentication...');
  const auth = await utils.authenticate(page, {
    username: options.username,
    password: options.password,
    interactive: options.interactive,
    sessionFile: options.session
  });

  if (!auth.success && !(await utils.isAuthenticated(page))) {
    console.error('[ConnectCrawler] Authentication failed. Please provide credentials (--user, --pass) or use --interactive.');
    await browser.close();
    process.exit(1);
  }

  console.log('[ConnectCrawler] Authentication confirmed. Beginning crawl...\n');

  // BFS Queue and tracking sets
  const queue = [];
  const visited = new Set();
  const discoveredRoutes = new Map(); // pathname -> { url, title, category, depth, status }
  const externalLinks = new Set();

  // Seed discovery entry points
  const seeds = [
    'https://connect.det.wa.edu.au',
    'https://connect.det.wa.edu.au/group/students',
    'https://connect.det.wa.edu.au/group/students/ui/my-connect',
    'https://connect.det.wa.edu.au/group/students/ui/my-settings/assessment-outlines',
    'https://connect.det.wa.edu.au/connect/cvr/classes',
    'https://connect.det.wa.edu.au/group/students/notices',
    'https://connect.det.wa.edu.au/group/students/calendar',
    'https://connect.det.wa.edu.au/group/students/library'
  ];

  for (const s of seeds) {
    const norm = normalizeUrl(s, options.startUrl);
    if (norm) queue.push({ url: norm, depth: 0 });
  }

  while (queue.length > 0 && visited.size < options.maxPages) {
    const { url, depth } = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch { continue; }

    if (parsedUrl.hostname !== TARGET_HOST) {
      externalLinks.add(url);
      continue;
    }

    if (isExcludedPath(parsedUrl.pathname)) continue;

    console.log(`[Depth ${depth}] [${visited.size}/${options.maxPages}] Visiting: ${parsedUrl.pathname}`);

    let responseStatus = 200;
    let pageTitle = '';

    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (response) responseStatus = response.status();
      await new Promise(r => setTimeout(r, options.delay));
      pageTitle = await page.title().catch(() => '');

      // Trigger lazy navigation menus if present to reveal dropdown routes
      await page.evaluate(() => {
        try {
          const trigger = document.querySelector('.cvr-js-greedy__trigger, .cvr-c-primary-menu__trigger');
          if (trigger) trigger.click();
        } catch {}
      }).catch(() => {});

      const category = categorizePath(parsedUrl.pathname);
      discoveredRoutes.set(parsedUrl.pathname, {
        url,
        pathname: parsedUrl.pathname,
        title: pageTitle.trim(),
        category,
        depth,
        status: responseStatus
      });

      // If within max depth, extract links and enqueue
      if (depth < options.maxDepth) {
        const rawLinks = await extractPageLinks(page);
        for (const raw of rawLinks) {
          const norm = normalizeUrl(raw, url);
          if (!norm) continue;
          try {
            const childHost = new URL(norm).hostname;
            if (childHost === TARGET_HOST) {
              const childPath = new URL(norm).pathname;
              if (!isExcludedPath(childPath) && !visited.has(norm)) {
                queue.push({ url: norm, depth: depth + 1 });
              }
            } else {
              externalLinks.add(norm);
            }
          } catch {}
        }
      }
    } catch (err) {
      console.warn(`  └─ Failed to navigate ${url}: ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(64));
  console.log(`[ConnectCrawler] Crawl completed! Visited ${visited.size} pages.`);
  console.log(`Discovered ${discoveredRoutes.size} unique internal directories/routes.`);
  console.log(`Discovered ${externalLinks.size} external partner resources.`);
  console.log('='.repeat(64) + '\n');

  // Build Hierarchical Directory Tree
  const pathList = Array.from(discoveredRoutes.keys());
  const tree = buildDirectoryTree(pathList);
  const asciiTree = formatAsciiTree(tree);

  console.log('CONNECT DIRECTORY HIERARCHY:');
  console.log(TARGET_HOST + '/');
  console.log(asciiTree.slice(0, 40).join('\n'));
  if (asciiTree.length > 40) {
    console.log(`... and ${asciiTree.length - 40} more directory branches (saved to files)`);
  }
  console.log('\n');

  // Write JSON Manifest
  const manifest = {
    crawledAt: new Date().toISOString(),
    startUrl: options.startUrl,
    totalPagesCrawled: visited.size,
    totalRoutesFound: discoveredRoutes.size,
    totalExternalLinks: externalLinks.size,
    directoryTree: tree,
    routes: Array.from(discoveredRoutes.values()).sort((a, b) => a.pathname.localeCompare(b.pathname)),
    externalResources: Array.from(externalLinks).sort()
  };

  fs.writeFileSync(options.outputJson, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[ConnectCrawler] Saved directory manifest: ${options.outputJson}`);

  // Write Markdown Sitemap (< 150 lines)
  let md = `# Connect Portal Directory & Route Map\n\n`;
  md.push = (str) => { md += str + '\n'; };
  md.push(`**Host:** \`${TARGET_HOST}\`  `);
  md.push(`**Crawled:** ${new Date().toUTCString()}  `);
  md.push(`**Discovered Routes:** ${discoveredRoutes.size} | **Pages Crawled:** ${visited.size}\n`);
  md.push(`## Directory Hierarchy (ASCII Tree)\n`);
  md.push('```text');
  md.push(`${TARGET_HOST}/`);
  for (const line of asciiTree.slice(0, 50)) md.push(line);
  if (asciiTree.length > 50) md.push(`... [${asciiTree.length - 50} more branches in JSON]`);
  md.push('```\n');
  md.push(`## Key Portal Routes & Classifications\n`);
  md.push(`| Status | Category | Path | Page Title |`);
  md.push(`| :---: | :--- | :--- | :--- |`);

  const sortedRoutes = Array.from(discoveredRoutes.values()).sort((a, b) => a.pathname.localeCompare(b.pathname));
  for (const r of sortedRoutes.slice(0, 45)) {
    const title = (r.title || 'Untitled').replace(/\|/g, '-').slice(0, 30);
    md.push(`| \`${r.status}\` | ${r.category} | \`${r.pathname}\` | ${title} |`);
  }
  if (sortedRoutes.length > 45) {
    md.push(`\n*... and ${sortedRoutes.length - 45} additional endpoints recorded in connect_directories.json.*`);
  }

  const mdLines = md.split('\n');
  const finalMd = mdLines.length > 145 ? mdLines.slice(0, 140).join('\n') + '\n\n*Truncated to 150 lines.*' : md;
  fs.writeFileSync(options.outputMd, finalMd, 'utf8');
  console.log(`[ConnectCrawler] Saved markdown sitemap: ${options.outputMd}`);

  await browser.close();
}

if (require.main === module) {
  crawl().catch(err => {
    console.error('[ConnectCrawler] Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { crawl, normalizeUrl, buildDirectoryTree, formatAsciiTree };

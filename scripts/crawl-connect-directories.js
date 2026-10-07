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
  const isEnvForce = process.env.npm_config_force === 'true' || process.env.npm_config_force === '1' ||
                     process.env.FORCE === 'true' || process.env.FORCE === '1';

  const options = {
    startUrl: DEFAULT_START_URL, maxDepth: 7, maxPages: 100, maxClassRedirects: 5, delay: 1250,
    headful: false, headless: null, username: null, password: null, interactive: false, force: isEnvForce,
    session: path.resolve(__dirname, '..', utils.DEFAULT_SESSION_FILE),
    outputJson: path.resolve(__dirname, '..', 'connect_directories.json'),
    outputMd: path.resolve(__dirname, '..', 'connect_directories.md'),
    outputUrls: path.resolve(__dirname, '..', 'crawled_urls.txt')
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--url' && args[i + 1]) options.startUrl = args[++i];
    else if (a === '--max-depth' && args[i + 1]) options.maxDepth = parseInt(args[++i], 10);
    else if (a === '--max-pages' && args[i + 1]) options.maxPages = parseInt(args[++i], 10);
    else if (a === '--max-class-redirects' && args[i + 1]) options.maxClassRedirects = parseInt(args[++i], 10);
    else if (a === '--delay' && args[i + 1]) options.delay = parseInt(args[++i], 10);
    else if (a === '--headful' || a === '--no-headless') options.headful = true;
    else if (a === '--headless') options.headless = true;
    else if ((a === '--username' || a === '-u') && args[i + 1]) options.username = args[++i];
    else if ((a === '--password' || a === '-p') && args[i + 1]) options.password = args[++i];
    else if (a === '--interactive') options.interactive = true;
    else if (a === '--force' || a === '-f' || a === 'force' || a === '--recrawl' || a === 'recrawl') options.force = true;
    else if (a === '--session' && args[i + 1]) options.session = path.resolve(args[++i]);
    else if (a === '--output-json' && args[i + 1]) options.outputJson = path.resolve(args[++i]);
    else if (a === '--output-md' && args[i + 1]) options.outputMd = path.resolve(args[++i]);
    else if (a === '--output-urls' && args[i + 1]) options.outputUrls = path.resolve(args[++i]);
  }
  return options;
}

function normalizeUrl(rawUrl, baseUrl) {
  try {
    const parsed = new URL(rawUrl, baseUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    parsed.hash = '';
    parsed.pathname = parsed.pathname.replace(/;jsessionid=[^/?#]+/gi, '').replace(/\/+/g, '/');
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.href;
  } catch {
    return null;
  }
}

function isExcludedPath(pathname) {
  const lower = pathname.toLowerCase();
  if (/logout|signout|timeout|inactivity|session_expired/i.test(lower)) return true;
  if (lower.startsWith('/cvr') || lower.startsWith('/connect/cvr')) return true;
  if (lower.startsWith('/documents') || lower.startsWith('/content')) return true;
  return /\.(png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2|ttf|eot|pdf|zip|docx?|xlsx?|pptx?)$/i.test(lower);
}

function categorizePath(pathname) {
  const p = pathname.toLowerCase();
  if (p.includes('/cls/') || p.includes('/class/')) return 'Class Space';
  if (p.includes('/classes')) return 'Classes Directory';
  if (p.includes('assessment-outlines')) return 'Assessment Outlines';
  if (p.includes('my-settings') || p.includes('profile') || p.includes('password')) return 'User Settings & Profile';
  if (p.includes('my-connect')) return 'Student Dashboard';
  if (p.includes('feed') || p.includes('notices')) return 'Notices & Feed';
  if (p.includes('calendar')) return 'Calendar';
  if (p.includes('library')) return 'Library';
  if (p.includes('help')) return 'Help & Support';
  if (p.startsWith('/group/')) return 'Portal Page';
  if (p.startsWith('/documents/') || p.startsWith('/content/')) return 'Document Repository';
  if (p.startsWith('/c/portal/') || p.startsWith('/api/')) return 'Portlet / API Endpoint';
  return 'General Route';
}

function extractClassId(urlStr) {
  try {
    const u = new URL(urlStr);
    const m1 = u.pathname.match(/\/redirect\/cls\/([0-9a-zA-Z_-]+)/i);
    if (m1) return m1[1];
    const m2 = (u.search || '').match(/DomainSchoolClass:([0-9a-zA-Z_-]+)/i);
    if (m2) return m2[1];
    const m3 = u.pathname.match(/\/cls\/([0-9a-zA-Z_-]+)/i);
    if (m3) return m3[1];
    if (u.pathname.includes('/ui/class/')) {
      const coisp = u.searchParams.get('coisp');
      if (coisp) {
        const m = coisp.match(/:([0-9a-zA-Z_-]+)/);
        return m ? m[1] : coisp;
      }
      return 'class-space';
    }
  } catch {}
  return null;
}

function filterUrlList(routes, maxClassRedirects = 5) {
  const otherUrls = [];
  const clsUrls = [];
  const seenClassIds = new Set();
  for (const r of routes) {
    const rawUrl = typeof r === 'string' ? r : (r.url || '');
    let pathname = '';
    try {
      pathname = (r.pathname || new URL(rawUrl).pathname).toLowerCase();
    } catch {
      continue;
    }
    if (pathname.startsWith('/documents') || pathname.startsWith('/content')) continue;

    const classId = extractClassId(rawUrl);
    if (classId) {
      if (!seenClassIds.has(classId)) {
        if (seenClassIds.size >= maxClassRedirects) continue;
        seenClassIds.add(classId);
      }
      clsUrls.push(rawUrl);
    } else {
      otherUrls.push(rawUrl);
    }
  }
  return [...otherUrls, ...clsUrls].sort();
}

function buildDirectoryTree(paths) {
  const root = { name: '/', count: 0, children: {} };
  for (const rawPath of paths) {
    let curr = root;
    curr.count++;
    for (const seg of rawPath.split('/').filter(Boolean)) {
      if (!curr.children[seg]) curr.children[seg] = { name: seg, count: 0, children: {} };
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
      lines = lines.concat(formatAsciiTree(child, prefix + (isLast ? '    ' : '│   ')));
    }
  }
  return lines;
}

async function extractPageLinks(page) {
  return await page.evaluate(() => {
    const found = new Set();
    const add = (val) => {
      if (!val || typeof val !== 'string') return;
      const s = val.trim();
      if (!s || s.startsWith('#') || s.startsWith('javascript:') || s.startsWith('mailto:')) return;
      found.add(s);
    };

    // 1. Anchors and area links across DOM
    document.querySelectorAll('a[href], area[href]').forEach(a => add(a.getAttribute('href')));

    // 2. Generic attribute scan across all DOM elements (Angular router links, Lexicon, Vaadin, data routes)
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if (!el.attributes) continue;
      for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        const v = attr.value;
        if (!v || typeof v !== 'string') continue;
        const name = attr.name.toLowerCase();

        if (name.includes('route') || name.includes('link') || name.includes('path') || name.includes('url')) {
          add(v.replace(/,/g, '/'));
        } else if (v.startsWith('/') || v.includes('connect.det.wa.edu.au')) {
          add(v);
        } else if (name === 'onclick') {
          const matches = v.match(/(?:location(?:\.href)?|window\.open|assign|replace|navigate)\s*[=(]\s*['"`]([^'"`]+)['"`]/gi);
          if (matches) {
            for (const m of matches) {
              const u = m.match(/['"`]([^'"`]+)['"`]/);
              if (u && u[1]) add(u[1]);
            }
          }
          const pathMatch = v.match(/['"`](\/(?:group|redirect|connect)\/[^'"`]+)['"`]/);
          if (pathMatch && pathMatch[1]) add(pathMatch[1]);
        }
      }
    }

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
        const urlList = filterUrlList(existing.routes, options.maxClassRedirects);
        fs.writeFileSync(options.outputUrls, urlList.join('\n') + '\n', 'utf8');
        console.log(`[ConnectCrawler] URL List: ${options.outputUrls} (${urlList.length} URLs)`);
        console.log('[ConnectCrawler] Skipping crawl (runs once). Use --force to re-crawl.');
        return existing;
      }
    } catch {}
  }

  console.log('[ConnectCrawler] Initializing Connect Directory Crawler...');
  console.log(`[ConnectCrawler] Max depth: ${options.maxDepth} | Max pages: ${options.maxPages} | Delay: ${options.delay}ms`);

  const hasSession = fs.existsSync(options.session);
  const hasCreds = Boolean(options.username || process.env.CONNECT_USER || process.env.CONNECT_USERNAME);
  const isHeadless = options.headless !== null
    ? options.headless
    : (options.headful ? false : (options.interactive ? false : (hasSession || hasCreds)));

  if (!isHeadless && !options.headful) {
    console.log('[ConnectCrawler] No saved session or credentials found — launching visible browser window for login.');
  }

  const browser = await utils.launchBrowser({
    headless: isHeadless,
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
  const enqueued = new Set();
  const discoveredRoutes = new Map(); // routeKey -> { url, pathname, search, title, category, depth, status }
  const externalLinks = new Set();
  const scannedClassIds = new Set();

  // Canonical portal entry points
  const seeds = [
    'https://connect.det.wa.edu.au',
    'https://connect.det.wa.edu.au/group/students',
    'https://connect.det.wa.edu.au/group/students/ui/my-connect',
    'https://connect.det.wa.edu.au/group/students/ui/classes',
    'https://connect.det.wa.edu.au/group/students/ui/feed',
    'https://connect.det.wa.edu.au/group/students/notices',
    'https://connect.det.wa.edu.au/group/students/calendar',
    'https://connect.det.wa.edu.au/group/students/library'
  ];

  for (const s of seeds) {
    const norm = normalizeUrl(s, options.startUrl);
    if (norm && !enqueued.has(norm)) {
      queue.push({ url: norm, depth: 0 });
      enqueued.add(norm);
    }
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

    // Class limit enforcement before navigation
    const classId = extractClassId(url);
    if (classId) {
      if (!scannedClassIds.has(classId)) {
        if (scannedClassIds.size >= options.maxClassRedirects) {
          continue;
        }
        scannedClassIds.add(classId);
      }
    }

    console.log(`[Depth ${depth}] [${visited.size}/${options.maxPages}] Visiting: ${parsedUrl.pathname}`);

    let responseStatus = 200;
    let pageTitle = '';

    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (response) responseStatus = response.status();
      if (responseStatus >= 400) {
        console.warn(`  └─ Skipped non-success response (${responseStatus}): ${parsedUrl.pathname}`);
        continue;
      }
      await utils.waitForPageReady(page, options.delay);
      pageTitle = await page.title().catch(() => '');

      // Follow redirects: read current destination URL with query params
      const finalUrlStr = page.url();
      const normFinalUrl = normalizeUrl(finalUrlStr, options.startUrl) || finalUrlStr;
      if (normFinalUrl !== url) {
        console.log(`  ↳ Redirected: ${url} -> ${normFinalUrl}`);
        visited.add(normFinalUrl);
        enqueued.add(normFinalUrl);
      }

      // Check class ID on destination URL
      const finalClassId = extractClassId(normFinalUrl);
      if (finalClassId) {
        if (!scannedClassIds.has(finalClassId)) {
          if (scannedClassIds.size >= options.maxClassRedirects) {
            continue;
          }
          scannedClassIds.add(finalClassId);
        }
      }

      let parsedFinal;
      try {
        parsedFinal = new URL(normFinalUrl);
      } catch {
        parsedFinal = parsedUrl;
      }

      const finalPath = parsedFinal.pathname;
      const finalSearch = parsedFinal.search || '';
      const routeKey = finalPath + (finalSearch ? finalSearch : '');
      const category = categorizePath(finalPath);

      discoveredRoutes.set(routeKey, {
        url: normFinalUrl,
        pathname: finalPath,
        search: finalSearch,
        title: pageTitle.trim(),
        category,
        depth,
        status: responseStatus
      });

      // Extract child links and enqueue
      if (depth < options.maxDepth) {
        const rawLinks = await extractPageLinks(page);
        for (const raw of rawLinks) {
          const norm = normalizeUrl(raw, normFinalUrl);
          if (!norm) continue;
          try {
            const childHost = new URL(norm).hostname;
            if (childHost === TARGET_HOST) {
              const childPath = new URL(norm).pathname;
              const childClassId = extractClassId(norm);
              if (childClassId) {
                if (!scannedClassIds.has(childClassId) && scannedClassIds.size >= options.maxClassRedirects) {
                  continue;
                }
              }
              if (!isExcludedPath(childPath) && !visited.has(norm) && !enqueued.has(norm)) {
                queue.push({ url: norm, depth: depth + 1 });
                enqueued.add(norm);
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

  // Write Clean URL List
  const cleanUrls = filterUrlList(Array.from(discoveredRoutes.values()), options.maxClassRedirects);
  fs.writeFileSync(options.outputUrls, cleanUrls.join('\n') + '\n', 'utf8');
  console.log(`[ConnectCrawler] Saved clean URL list: ${options.outputUrls} (${cleanUrls.length} URLs)`);

  // Write Markdown Sitemap (< 150 lines)
  let md = `# Connect Portal Directory & Route Map\n\n`;
  md += `**Host:** \`${TARGET_HOST}\`  \n`;
  md += `**Crawled:** ${new Date().toUTCString()}  \n`;
  md += `**Routes Found:** ${discoveredRoutes.size} | **Pages Crawled:** ${visited.size}\n\n`;
  md += `## Directory Hierarchy (ASCII Tree)\n\n\`\`\`text\n${TARGET_HOST}/\n`;
  for (const line of asciiTree.slice(0, 40)) md += line + '\n';
  if (asciiTree.length > 40) md += `... [${asciiTree.length - 40} more branches in JSON]\n`;
  md += `\`\`\`\n\n## Key Portal Routes & Classifications\n\n`;
  md += `| Status | Category | Path |\n| :---: | :--- | :--- |\n`;

  const sortedRoutes = Array.from(discoveredRoutes.values()).sort((a, b) => a.pathname.localeCompare(b.pathname));
  for (const r of sortedRoutes.slice(0, 40)) {
    md += `| \`${r.status}\` | ${r.category} | \`${r.pathname}\` |\n`;
  }
  if (sortedRoutes.length > 40) {
    md += `\n*... and ${sortedRoutes.length - 40} additional endpoints recorded in connect_directories.json.*\n`;
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

module.exports = { crawl, normalizeUrl, buildDirectoryTree, formatAsciiTree, filterUrlList, extractClassId };

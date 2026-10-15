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
const { launchAuthenticated } = require('./puppeteer-auth');

const DEFAULT_START_URL = 'https://connect.det.wa.edu.au';
const TARGET_HOST = 'connect.det.wa.edu.au';

function parseArgs() {
  const args = process.argv.slice(2);
  const isEnvForce = process.env.npm_config_force === 'true' || process.env.npm_config_force === '1' ||
                     process.env.FORCE === 'true' || process.env.FORCE === '1';
  const isEnvInteractive = process.env.npm_config_interactive === 'true' || process.env.npm_config_interactive === '1' ||
                          process.env.INTERACTIVE === 'true' || process.env.INTERACTIVE === '1';

  const options = {
    startUrl: DEFAULT_START_URL, maxDepth: 7, maxPages: 100, maxClassRedirects: 5, delay: 1250,
    headful: false, headless: null, username: null, password: null, interactive: isEnvInteractive, force: isEnvForce,
    session: path.resolve(__dirname, '..', utils.DEFAULT_SESSION_FILE),
    outputJson: path.resolve(__dirname, '..', 'connect_directories.json'),
    outputMd: path.resolve(__dirname, '..', 'connect_directories.md'),
    outputUrls: path.resolve(__dirname, '..', 'crawled_urls.txt')
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i], next = args[i + 1];
    if (a === '--url' && next) options.startUrl = args[++i];
    else if (a === '--max-depth' && next) options.maxDepth = parseInt(args[++i], 10);
    else if (a === '--max-pages' && next) options.maxPages = parseInt(args[++i], 10);
    else if (a === '--max-class-redirects' && next) options.maxClassRedirects = parseInt(args[++i], 10);
    else if (a === '--delay' && next) options.delay = parseInt(args[++i], 10);
    else if (a === '--headful' || a === '--no-headless') options.headful = true;
    else if (a === '--headless') options.headless = true;
    else if (a === '--interactive' || a === '-i' || a === 'interactive') options.interactive = true;
    else if (a === '--force' || a === '-f' || a === 'force' || a === '--recrawl' || a === 'recrawl') options.force = true;
    else if ((a === '--username' || a === '-u') && next) options.username = args[++i];
    else if ((a === '--password' || a === '-p') && next) options.password = args[++i];
    else if (a === '--session' && next) options.session = path.resolve(args[++i]);
    else if (a === '--output-json' && next) options.outputJson = path.resolve(args[++i]);
    else if (a === '--output-md' && next) options.outputMd = path.resolve(args[++i]);
    else if (a === '--output-urls' && next) options.outputUrls = path.resolve(args[++i]);
  }
  return options;
}

function normalizeUrl(rawUrl, baseUrl) {
  try {
    const parsed = new URL(rawUrl, baseUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    parsed.hash = '';
    parsed.pathname = parsed.pathname.replace(/;jsessionid=[^/?#]+/gi, '').replace(/\/+/g, '/');
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) parsed.pathname = parsed.pathname.slice(0, -1);
    if (parsed.pathname.includes('/class/class/')) parsed.pathname = parsed.pathname.replace(/\/class\/class\//g, '/class/');
    if (parsed.pathname.startsWith('/class/')) parsed.pathname = '/group/students/ui' + parsed.pathname;
    else if (parsed.pathname.startsWith('/group/class/')) parsed.pathname = '/group/students/ui' + parsed.pathname.slice(6);
    else if (parsed.pathname.startsWith('/ui/class/')) parsed.pathname = '/group/students' + parsed.pathname;
    if (!parsed.searchParams.has('coisp') && baseUrl) {
      try {
        const baseObj = new URL(baseUrl);
        const baseCoisp = baseObj.searchParams.get('coisp');
        if (baseCoisp && (parsed.pathname.includes('/class/') || parsed.pathname.includes('/cls/'))) {
          parsed.searchParams.set('coisp', baseCoisp);
        }
      } catch {}
    }
    return parsed.href;
  } catch {
    return null;
  }
}

function isExcludedPath(pathname) {
  const lower = pathname.toLowerCase();
  if (/logout|signout|timeout|inactivity|session_expired|loggedout/i.test(lower)) return true;
  if (lower.startsWith('/cvr') || lower.startsWith('/connect/cvr')) return true;
  if (lower.startsWith('/documents') || (lower.startsWith('/content') && !lower.includes('class'))) return true;
  if (lower.startsWith('/combo') || lower === '/combo') return true;
  if (lower.startsWith('/public/home-screen') || lower.includes('browserconfig') || lower.includes('manifest')) return true;
  if (lower.startsWith('/html/js') || lower.startsWith('/html/css') || lower.startsWith('/o/frontend-') || lower.startsWith('/api/')) return true;
  return /\.(png|jpe?g|gif|svg|ico|webp|avif|css|js|mjs|woff2?|ttf|eot|otf|pdf|zip|tar|gz|docx?|xlsx?|pptx?|xml|json|webmanifest|map|txt|mp[34]|wav)$/i.test(lower);
}

function categorizePath(pathname) {
  const p = pathname.toLowerCase();
  if (p.includes('/cls/') || p.includes('/class/')) return 'Class Space';
  if (p.includes('/classes')) return 'Classes Directory';
  if (p.includes('assessment-outlines')) return 'Assessment Outlines';
  if (p.includes('my-settings') || p.includes('profile') || p.includes('password') || p.includes('preference') || p.includes('notification') || p.includes('attendance') || p.includes('report')) return 'User Settings & Profile';
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
    const u = new URL(urlStr, 'https://connect.det.wa.edu.au');
    const m1 = u.pathname.match(/\/redirect\/cls\/([0-9a-zA-Z_-]+)/i);
    if (m1) return m1[1];
    const m2 = (u.search || urlStr).match(/DomainSchoolClass(?::|%3A)([0-9a-zA-Z_-]+)/i);
    if (m2) return m2[1];
    const m3 = u.pathname.match(/\/cls\/([0-9a-zA-Z_-]+)/i);
    if (m3) return m3[1];
    if (u.pathname.includes('/ui/class/') || u.pathname.includes('/class/')) {
      const coisp = u.searchParams.get('coisp');
      if (coisp) {
        const m = coisp.match(/(?::|%3A)?([0-9a-zA-Z_-]+)$/);
        return m ? m[1] : coisp;
      }
      return 'class-space';
    }
  } catch {}
  return null;
}

function filterUrlList(routes, maxClassRedirects = 5) {
  const otherUrls = [], clsUrls = [];
  const seenClassIds = new Set(), seenUrls = new Set();
  for (const r of routes) {
    const rawUrl = typeof r === 'string' ? r : (r.url || '');
    let pathname = '';
    try { pathname = (r.pathname || new URL(rawUrl).pathname).toLowerCase(); } catch { continue; }
    if (isExcludedPath(pathname)) continue;

    const cleanUrl = rawUrl.replace(/DomainSchoolClass%3A/gi, 'DomainSchoolClass:');
    if (seenUrls.has(cleanUrl)) continue;
    seenUrls.add(cleanUrl);

    const classId = extractClassId(cleanUrl);
    if (classId) {
      if (!seenClassIds.has(classId)) {
        if (seenClassIds.size >= maxClassRedirects) continue;
        seenClassIds.add(classId);
      }
      clsUrls.push(cleanUrl);
    } else {
      otherUrls.push(cleanUrl);
    }
  }
  return [...otherUrls, ...clsUrls].sort();
}

function buildDirectoryTree(paths) {
  const root = { name: '/', count: 0, children: {} };
  for (const rawPath of paths) {
    let curr = root; curr.count++;
    for (const seg of rawPath.split('/').filter(Boolean)) {
      if (!curr.children[seg]) curr.children[seg] = { name: seg, count: 0, children: {} };
      curr = curr.children[seg]; curr.count++;
    }
  }
  return root;
}

function formatAsciiTree(node, prefix = '') {
  let lines = [];
  const entries = Object.keys(node.children).sort();
  for (let i = 0; i < entries.length; i++) {
    const key = entries[i], isLast = i === entries.length - 1;
    const child = node.children[key], hasChildren = Object.keys(child.children).length > 0;
    lines.push(`${prefix}${isLast ? '└── ' : '├── '}${key}${hasChildren ? '/' : ''}`);
    if (hasChildren) lines = lines.concat(formatAsciiTree(child, prefix + (isLast ? '    ' : '│   ')));
  }
  return lines;
}

function extractPageLinks(page) {
  return page.evaluate(() => {
    const found = new Set();
    const add = (val) => {
      if (!val || typeof val !== 'string') return;
      const s = val.replace(/[\[\]'"]/g, '').trim();
      if (!s || s.startsWith('#') || s.startsWith('javascript:') || s.startsWith('mailto:')) return;
      found.add(s);
    };

    // 1. Anchors and area links across DOM
    document.querySelectorAll('a[href], area[href]').forEach(a => add(a.getAttribute('href')));

    // 2. Generic attribute scan across all DOM elements (Angular router links, Lexicon, Vaadin, data routes)
    for (const el of document.querySelectorAll('*')) {
      if (!el.attributes) continue;
      const tag = (el.tagName || '').toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'link' || tag === 'meta') continue;
      for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        const v = attr.value;
        if (!v || typeof v !== 'string') continue;
        const name = attr.name.toLowerCase();
        if (v.includes('coisp=') || v.includes('class/') || v.includes('redirect/cls/') || v.startsWith('/') || v.includes('connect.det.wa.edu.au')) {
          add(v);
        } else if (name.includes('route') || name.includes('link') || name.includes('path') || name.includes('url') || name.includes('target') || name.includes('service') || name.includes('slug')) {
          add(v.replace(/,/g, '/'));
        }
        if (name === 'onclick' || name.startsWith('ng-') || name.startsWith('data-')) {
          const quoted = v.match(/['"`]([^'"`\s>]*(?:class\/|coisp=|\/(?:group|redirect|connect|ui)\/)[^'"`\s>]*)['"`]/gi);
          if (quoted) for (const q of quoted) { const c = q.replace(/^['"`]|['"`]$/g, '').trim(); if (c) add(c); }
          const matches = v.match(/(?:location(?:\.href)?|window\.open|assign|replace|navigate)\s*[=(]\s*['"`]([^'"`]+)['"`]/gi);
          if (matches) for (const m of matches) { const u = m.match(/['"`]([^'"`]+)['"`]/); if (u && u[1]) add(u[1]); }
        }
      }
    }

    // 3. Navigation menus, tabs, and sidebars (e.g. .eds-c-tabs, .cvr-c-service-menu, .cvr-c-category-menu, .mat-tab-label, [role="tab"])
    const navItems = document.querySelectorAll(
      '.eds-c-tabs__tab, .eds-c-tabs li, .eds-c-tabs a, [role="tab"], .mat-tab-label, .mat-tab-link, .nav-tabs li, .nav-tabs a, .cvr-c-service-menu__item, .cvr-c-category-menu__item, .cvr-c-primary-menu__item, .cvr-c-category-toolbar button, .cvr-c-category-toolbar a, .eds-c-nav-list__item, .mat-nav-list .mat-list-item, [class*="service-menu"] li, [class*="service-menu"] a, [class*="service-menu"] button, [role="menuitem"], [class*="category-menu"] li, [class*="category-menu"] a'
    );
    const curPath = window.location.pathname.replace(/\/+$/, '');
    const lastSlash = curPath.lastIndexOf('/');
    const branchBase = lastSlash > 0 ? curPath.substring(0, lastSlash + 1) : '';
    const search = window.location.search || '';
    const mCoisp = search.match(/coisp=([a-zA-Z0-9_:]+)/);
    if (mCoisp) {
      for (const sub of ['announcements', 'learning-content', 'class-library', 'summary', 'discussions', 'submissions', 'learners']) {
        add('/group/students/ui/class/' + sub + '?coisp=' + mCoisp[1]);
      }
    }

    for (const item of navItems) {
      const labelEl = item.querySelector('.cvr-c-service-menu__item-label, .eds-c-tabs__tab, [class*="label"], [class*="title"]') || item;
      const text = (labelEl.innerText || labelEl.textContent || '').trim().replace(/\s+/g, ' ');
      if (text && text.length > 1 && text.length < 40 && !/\b(logout|signout|delete|remove)\b/i.test(text)) {
        let slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (slug === 'notices') slug = 'announcements';
        if (slug === 'content') slug = 'learning-content';
        if (slug === 'library') slug = 'class-library';
        if (slug) {
          add(slug);
          if (branchBase) {
            add(branchBase + slug);
            if (search) add(branchBase + slug + search);
          }
          if (search) {
            add(slug + search);
            if (curPath.includes('/class/')) {
              add('class/' + slug + search);
              add('/group/students/ui/class/' + slug + search);
            }
          }
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

  console.log('[ConnectCrawler] Verifying authentication...');
  const headless = options.headless !== null ? options.headless : (options.headful ? false : null);
  let browser, page;
  try {
    ({ browser, page } = await launchAuthenticated({
      headless, username: options.username, password: options.password,
      sessionFile: options.session, tag: 'ConnectCrawler'
    }));
  } catch (err) {
    console.error(`[ConnectCrawler] ${err.message}`);
    process.exit(1);
  }

  console.log('[ConnectCrawler] Authentication confirmed. Beginning crawl...\n');

  // BFS Queue and tracking sets
  const queue = [], visited = new Set(), enqueued = new Set();
  const discoveredRoutes = new Map(), externalLinks = new Set(), scannedClassIds = new Set();

  // Canonical portal entry points
  const seeds = [
    'https://connect.det.wa.edu.au', 'https://connect.det.wa.edu.au/group/students',
    'https://connect.det.wa.edu.au/group/students/ui/my-connect', 'https://connect.det.wa.edu.au/group/students/ui/classes',
    'https://connect.det.wa.edu.au/group/students/ui/feed', 'https://connect.det.wa.edu.au/group/students/notices',
    'https://connect.det.wa.edu.au/group/students/calendar', 'https://connect.det.wa.edu.au/group/students/library'
  ];

  for (const s of seeds) {
    const norm = normalizeUrl(s, options.startUrl);
    if (norm) {
      const canon = norm.replace(/DomainSchoolClass%3A/gi, 'DomainSchoolClass:');
      if (!enqueued.has(canon)) {
        queue.push({ url: canon, depth: 0 });
        enqueued.add(canon);
      }
    }
  }

  while (queue.length > 0 && visited.size < options.maxPages) {
    const { url, depth } = queue.shift();
    const canonUrl = url.replace(/DomainSchoolClass%3A/gi, 'DomainSchoolClass:');
    if (visited.has(canonUrl)) continue;
    visited.add(canonUrl);

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
    if (classId && !scannedClassIds.has(classId)) {
      if (scannedClassIds.size >= options.maxClassRedirects) continue;
      scannedClassIds.add(classId);
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
        const canonRedirect = normFinalUrl.replace(/DomainSchoolClass%3A/gi, 'DomainSchoolClass:');
        visited.add(canonRedirect);
        enqueued.add(canonRedirect);
      }

      // Check class ID on destination URL
      const finalClassId = extractClassId(normFinalUrl);
      if (finalClassId && !scannedClassIds.has(finalClassId)) {
        if (scannedClassIds.size >= options.maxClassRedirects) continue;
        scannedClassIds.add(finalClassId);
      }

      let parsedFinal;
      try { parsedFinal = new URL(normFinalUrl); } catch { parsedFinal = parsedUrl; }

      const finalPath = parsedFinal.pathname;
      const finalSearch = (parsedFinal.search || '').replace(/DomainSchoolClass%3A/gi, 'DomainSchoolClass:');
      const canonicalFinalUrl = normFinalUrl.replace(/DomainSchoolClass%3A/gi, 'DomainSchoolClass:');
      const routeKey = finalPath + (finalSearch ? finalSearch : '');
      const category = categorizePath(finalPath);

      discoveredRoutes.set(routeKey, {
        url: canonicalFinalUrl,
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
              if (childClassId && !scannedClassIds.has(childClassId) && scannedClassIds.size >= options.maxClassRedirects) {
                continue;
              }
              const canonicalNorm = norm.replace(/DomainSchoolClass%3A/gi, 'DomainSchoolClass:');
              if (!isExcludedPath(childPath) && !visited.has(canonicalNorm) && !enqueued.has(canonicalNorm)) {
                queue.push({ url: canonicalNorm, depth: depth + 1 });
                enqueued.add(canonicalNorm);
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
  let md = `# Connect Portal Directory & Route Map\n\n**Host:** \`${TARGET_HOST}\`  \n**Crawled:** ${new Date().toUTCString()}  \n**Routes Found:** ${discoveredRoutes.size} | **Pages Crawled:** ${visited.size}\n\n## Directory Hierarchy (ASCII Tree)\n\n\`\`\`text\n${TARGET_HOST}/\n${asciiTree.slice(0, 40).join('\n')}\n${asciiTree.length > 40 ? `... [${asciiTree.length - 40} more branches in JSON]\n` : ''}\`\`\`\n\n## Key Portal Routes & Classifications\n\n| Status | Category | Path |\n| :---: | :--- | :--- |\n`;
  const sortedRoutes = Array.from(discoveredRoutes.values()).sort((a, b) => a.pathname.localeCompare(b.pathname));
  for (const r of sortedRoutes.slice(0, 40)) md += `| \`${r.status}\` | ${r.category} | \`${r.pathname}\` |\n`;
  if (sortedRoutes.length > 40) md += `\n*... and ${sortedRoutes.length - 40} additional endpoints recorded in connect_directories.json.*\n`;
  const mdLines = md.split('\n');
  const finalMd = mdLines.length > 145 ? mdLines.slice(0, 140).join('\n') + '\n\n*Truncated to 150 lines.*' : md;
  fs.writeFileSync(options.outputMd, finalMd, 'utf8');
  console.log(`[ConnectCrawler] Saved markdown sitemap: ${options.outputMd}`);

  await browser.close();
}

if (require.main === module) {
  crawl().catch(err => { console.error('[ConnectCrawler] Fatal error:', err); process.exit(1); });
}

module.exports = { crawl, normalizeUrl, buildDirectoryTree, formatAsciiTree, filterUrlList, extractClassId, isExcludedPath, extractPageLinks, categorizePath };

#!/usr/bin/env node
/**
 * Connectify playground server: `npm run playground` (or `node scripts/playground/server.js --port 4173`).
 *
 * Serves the playground editor at the Assessment Outlines path (so Connectify runs as on that page) with
 * every outlines-page content script and Connectify component stylesheet from manifest.json, in manifest
 * order, after a small extension API shim. No theme or Connect styles and no Connect markup: the editor
 * writes Connectify's cache directly.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const HERE = __dirname;
const OUTLINES_PATH = '/group/students/ui/my-settings/assessment-outlines';
const portArg = process.argv.indexOf('--port');
const PORT = Number(portArg > -1 ? process.argv[portArg + 1] : process.env.PORT) || 4173;

/** The outlines page's isolated-world scripts, read from the manifest on every page load. */
function outlineScripts() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const group = manifest.content_scripts.find(cs => !cs.world && cs.matches.some(m => m.includes('assessment-outlines')));
  return { manifest, scripts: group ? group.js : [], styles: group ? group.css || [] : [] };
}

function page() {
  const { manifest, scripts, styles } = outlineScripts();
  const tags = scripts.map(src => `<script src="/${src}"></script>`).join('\n');
  const links = styles.map(href => `<link rel="stylesheet" href="/${href}" data-pg-connectify>`).join('\n');
  const info = JSON.stringify({ version: manifest.version, permissions: manifest.permissions || [] });
  return fs.readFileSync(path.join(HERE, 'index.html'), 'utf8')
    .replace('<!-- manifest -->', `<script>window.__playgroundManifest = ${info};</script>`)
    .replace('<!-- connectify-styles -->', links)
    .replace('<!-- connectify-scripts -->', tags);
}

const TYPES = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

/** Files under src/ and the playground folder only. */
function staticFile(urlPath) {
  const base = urlPath.startsWith('/playground/') ? HERE : urlPath.startsWith('/src/') ? ROOT : null;
  if (!base) return null;
  const rel = urlPath.startsWith('/playground/') ? urlPath.slice('/playground/'.length) : urlPath.slice(1);
  const file = path.resolve(base, decodeURIComponent(rel));
  return file.startsWith(base + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(302, { Location: OUTLINES_PATH });
    return res.end();
  }
  if (url.pathname.replace(/\/$/, '') === OUTLINES_PATH) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(page());
  }
  const file = staticFile(url.pathname);
  if (!file) {
    res.writeHead(404);
    return res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});

if (require.main === module) {
  const url = `http://localhost:${PORT}${OUTLINES_PATH}`;
  server.on('error', err => {
    if (err.code !== 'EADDRINUSE') throw err;
    // Port taken: either a playground is already running there (open it), or something else is
    http.get(`http://127.0.0.1:${PORT}/playground/model.js`, res => {
      res.resume();
      if (res.statusCode === 200) console.log(`The Connectify playground is already running: ${url}`);
      else console.error(`Port ${PORT} is in use by another program. Try: npm run playground -- --port ${PORT + 1}`);
      process.exit(res.statusCode === 200 ? 0 : 1);
    }).on('error', () => {
      console.error(`Port ${PORT} is in use. Try: npm run playground -- --port ${PORT + 1}`);
      process.exit(1);
    });
  });
  server.listen(PORT, '127.0.0.1', () => console.log(`Connectify playground: ${url}`));
}

module.exports = { page, outlineScripts, OUTLINES_PATH };

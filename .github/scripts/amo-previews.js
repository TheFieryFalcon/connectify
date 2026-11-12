/**
 * Connectify: AMO listing screenshots
 *
 * Makes the Firefox Add-ons listing's screenshots ("previews") the PNGs in assets/store/, in file name order, with
 * the captions in assets/store/captions.json. Every screenshot is uploaded first (Preview Create, with its caption
 * and position), and only then are the previews that were there before deleted, so a failed run never leaves the
 * listing without screenshots.
 *
 * AMO throttles these endpoints per user at 3 a minute, 10 an hour and 24 a day, every method counted: writes are
 * spaced 21s apart, a 429 waits as long as AMO says, the current previews are read without signing in, and a
 * caption only costs an edit if the upload did not keep it. Five screenshots: 10 writes.
 *
 * Env: AMO_JWT_ISSUER / AMO_JWT_SECRET (or AMO_API_KEY / AMO_API_SECRET), AMO_ADDON_SLUG (default connectify).
 * Run: node .github/scripts/amo-previews.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const AMO_API_BASE = 'https://addons.mozilla.org/api/v5';
const STORE_DIR = path.resolve(__dirname, '../../assets/store');

/** A short-lived HS256 JWT for the AMO API (one per request: AMO refuses a reused jti). */
function generateJwt(issuer, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iss: issuer,
    jti: crypto.randomBytes(16).toString('hex'),
    iat: now,
    exp: now + 300
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

async function main() {
  const issuer = process.env.AMO_JWT_ISSUER || process.env.AMO_API_KEY;
  const secret = process.env.AMO_JWT_SECRET || process.env.AMO_API_SECRET;
  const slug = process.env.AMO_ADDON_SLUG || 'connectify';
  if (!issuer || !secret) throw new Error('AMO_JWT_ISSUER and AMO_JWT_SECRET are required');

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  let lastWrite = 0;
  const api = async (method, url, body, json = true) => {
    for (let attempt = 1; ; attempt++) {
      const wait = lastWrite + 21000 - Date.now();
      if (wait > 0) await sleep(wait);
      lastWrite = Date.now();
      const headers = { Authorization: `JWT ${generateJwt(issuer, secret)}` };
      if (json && body) headers['Content-Type'] = 'application/json';
      const res = await fetch(`${AMO_API_BASE}${url}`, { method, headers, body: json && body ? JSON.stringify(body) : body });
      const text = await res.text();
      if (res.status === 429 && attempt <= 3) {
        const seconds = Number(res.headers.get('retry-after')) || Number((text.match(/(\d+) seconds?/) || [])[1]) || 600;
        console.log(`  throttled by AMO, waiting ${seconds}s`);
        await sleep((seconds + 5) * 1000);
        continue;
      }
      if (!res.ok) throw new Error(`${method} ${url}: HTTP ${res.status} ${text.slice(0, 500)}`);
      return text ? JSON.parse(text) : null;
    }
  };

  const captions = JSON.parse(fs.readFileSync(path.join(STORE_DIR, 'captions.json'), 'utf8'));
  const files = fs.readdirSync(STORE_DIR).filter(f => /\.png$/i.test(f) && !/^badge/i.test(f)).sort();
  if (!files.length) throw new Error(`No screenshots in ${STORE_DIR}`);
  for (const file of files) if (!captions[file]) throw new Error(`No caption for ${file} in captions.json`);

  const addonUrl = `/addons/addon/${encodeURIComponent(slug)}`;
  const detail = await fetch(`${AMO_API_BASE}${addonUrl}/`);
  if (!detail.ok) throw new Error(`GET ${addonUrl}/: HTTP ${detail.status}`);
  const before = (await detail.json()).previews || [];
  console.log(`Listing has ${before.length} screenshot(s); uploading ${files.length}`);

  for (const [position, file] of files.entries()) {
    const form = new FormData();
    form.append('image', new Blob([fs.readFileSync(path.join(STORE_DIR, file))], { type: 'image/png' }), file);
    form.append('position', String(position));
    form.append('caption', captions[file]);
    const created = await api('POST', `${addonUrl}/previews/`, form, false);
    const kept = typeof created.caption === 'string' ? created.caption : created.caption?.['en-US'];
    if (kept !== captions[file]) await api('PATCH', `${addonUrl}/previews/${created.id}/`, { caption: { 'en-US': captions[file] } });
    console.log(`  ${position + 1}. ${file} -> preview ${created.id}`);
  }

  for (const preview of before) {
    await api('DELETE', `${addonUrl}/previews/${preview.id}/`, null);
    console.log(`  removed old preview ${preview.id}`);
  }
  console.log('AMO screenshots updated');
}

main().catch(err => {
  console.error(`AMO screenshots not updated: ${err.message}`);
  process.exit(1);
});

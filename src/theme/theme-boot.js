/**
 * Connectify Theme Boot (document_start): paints the last theme before Connect's first frame, so a reload
 * never flashes white. The theme scripts run at document_idle; each time they apply a theme they save a
 * snapshot of <html> (theme classes and attributes, inline tokens, canvas colour, where the wallpaper comes
 * from), and this script stamps it back before the page renders. A temporary <style id="cx-theme-boot">
 * paints the canvas until the theme stylesheets are in (Firefox injects them at document_idle); theme.js
 * removes it once the theme is applied.
 *
 * Also gives the wallpaper a URL Chrome can paint: Chrome drops CSS url()s longer than 2 MB, so a large data
 * URL (GIFs, unfitted imports) becomes a blob: URL there. Exposes window.ConnectifyThemeBoot.
 */
(() => {
  'use strict';

  if (window.ConnectifyThemeBoot) return;

  const KEY = 'connectify:theme_boot';
  const THEME_ID = 'connectea:theme:id';
  const SETTINGS_BG = 'connectea:custom_background';
  const THEMES_LIST = 'connectea:custom_themes_list';
  const STYLE_ID = 'cx-theme-boot';
  const ATTRS = ['data-connectea-theme', 'data-connectea-glass', 'data-connectea-tone', 'data-connectea-has-custom-bg'];
  const CSS_URL_MAX = 2 * 1024 * 1024 - 64; // Chrome's URL length limit, less the url("") around it
  const INLINE_BG_MAX = 64 * 1024;          // small wallpapers (SVG presets) are kept in the snapshot itself
  const blobUrls = new Map();               // data URL -> blob: URL, the last two wallpapers

  const isChromium = () => {
    try { return chrome.runtime.getURL('').startsWith('chrome-extension:'); } catch { return false; }
  };

  // Firefox paints long data URLs and may refuse content-script blob: URLs, so only Chromium converts
  function toBlobUrl(url) {
    const comma = url.indexOf(',');
    const meta = url.slice(5, comma);
    const type = meta.split(';')[0];
    if (!/;base64$/i.test(meta)) return URL.createObjectURL(new Blob([decodeURIComponent(url.slice(comma + 1))], { type }));
    const bin = atob(url.slice(comma + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type }));
  }

  /** The URL to put in CSS for a wallpaper: itself, or a blob: URL for a data URL Chrome would drop. */
  function cssUrl(url) {
    if (typeof url !== 'string' || url.length <= CSS_URL_MAX || !/^data:/i.test(url) || !isChromium()) return url;
    if (!blobUrls.has(url)) {
      try { blobUrls.set(url, toBlobUrl(url)); } catch { return url; }
      if (blobUrls.size > 2) {
        const [oldest] = blobUrls.keys();
        URL.revokeObjectURL(blobUrls.get(oldest));
        blobUrls.delete(oldest);
      }
    }
    return blobUrls.get(url);
  }

  // The same pages theme-auth.js switches themes off on; theme.js corrects anything this misses
  const isAuthPage = () => /^\/(login|logout)(\/|$)|\/portal\/(login|logout)|\/web\/guest\/logout|signout|sign-out|logged-?out/i.test(location.pathname)
    || /logout|logged_out|signed_out|session_expired/i.test(location.search);

  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };

  function wallpaperOf(bg, themeId) {
    if (!bg) return null;
    if (bg.url) return bg.url;
    if (bg.settings) return read(SETTINGS_BG);
    if (bg.theme) {
      try { return JSON.parse(read(THEMES_LIST) || '[]').find(t => t?.id === themeId)?.wallpaper || null; } catch { return null; }
    }
    return null;
  }

  function boot() {
    const root = document.documentElement;
    if (!root || isAuthPage()) return;
    let snap = null;
    try { snap = JSON.parse(read(KEY) || 'null'); } catch {}
    if (!snap || snap.id !== read(THEME_ID)) return; // the theme changed elsewhere since: leave it to theme.js
    root.classList.toggle('connectea-dark', Boolean(snap.dark));
    for (const [name, value] of Object.entries(snap.attrs || {})) if (ATTRS.includes(name)) root.setAttribute(name, String(value));
    for (const [prop, value] of Object.entries(snap.props || {})) if (prop.startsWith('--cx-')) root.style.setProperty(prop, String(value));
    const wallpaper = wallpaperOf(snap.bg, snap.id);
    if (wallpaper) root.style.setProperty('--cx-custom-bg-image', `url("${cssUrl(wallpaper)}")`);
    else root.removeAttribute('data-connectea-has-custom-bg');
    const canvas = /^rgba?\([\d.,\s]+\)$/.test(snap.canvas || '') && !/,\s*0\)$/.test(snap.canvas) ? snap.canvas : null;
    if (!canvas) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `html { background-color: ${canvas} !important; } body { background-color: ${wallpaper ? 'transparent' : canvas} !important; }`;
    root.appendChild(style);
  }

  function write() {
    const root = document.documentElement;
    if (!root || window.ConnectifyThemeAuth?.isAuthDisabled()) return;
    const props = {};
    for (let i = 0; i < root.style.length; i++) {
      const prop = root.style[i];
      if (prop.startsWith('--cx-') && prop !== '--cx-custom-bg-image') props[prop] = root.style.getPropertyValue(prop).trim();
    }
    const attrs = {};
    for (const name of ATTRS) if (root.hasAttribute(name)) attrs[name] = root.getAttribute(name);
    const bg = window.ConnectifyThemeTokens?.backgroundSource?.() || null;
    const snap = { id: read(THEME_ID), dark: root.classList.contains('connectea-dark'), attrs, props, canvas: getComputedStyle(root).backgroundColor, bg };
    try { localStorage.setItem(KEY, JSON.stringify(snap)); } catch {}
  }

  let saveQueued = false;
  /** Records the applied theme for the next page load (once per task, however many parts of it changed). */
  function save() {
    if (saveQueued) return;
    saveQueued = true;
    setTimeout(() => { saveQueued = false; write(); }, 0);
  }

  /** The theme stylesheets and scripts have taken over: drop the boot canvas. */
  function done() {
    document.getElementById(STYLE_ID)?.remove();
  }

  /** What the snapshot stores for a wallpaper: small ones inline, large ones by where they are stored. */
  function sourceOf(url, fromTheme) {
    if (!url) return null;
    if (url.length <= INLINE_BG_MAX) return { url };
    return fromTheme ? { theme: true } : { settings: true };
  }

  window.ConnectifyThemeBoot = { cssUrl, save, done, sourceOf, boot, KEY };
  // <html> normally exists at document_start; if not yet, boot the moment the parser adds it
  if (document.documentElement) boot();
  else {
    const wait = new MutationObserver(() => {
      if (!document.documentElement) return;
      wait.disconnect();
      boot();
    });
    wait.observe(document, { childList: true });
  }
})();

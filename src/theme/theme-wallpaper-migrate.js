/**
 * Connectify Wallpaper Migration
 * Wallpapers stored before uploads were fitted to the screen (theme-wallpaper-fit.js) can be tens of megabytes,
 * which every page decodes and paints. Once, in the background, the active wallpaper and the wallpapers inside
 * saved custom themes that are still large raster data URLs are cropped and scaled to the screen and stored back
 * where they came from (localStorage and extension storage). SVG presets are never touched.
 * Exposes window.ConnectifyWallpaperMigrate.
 */
(() => {
  'use strict';

  const fit = window.ConnectifyWallpaperFit;
  const tokens = window.ConnectifyThemeTokens;
  const registry = window.ConnectifyThemeRegistry;
  if (!fit || !tokens || !registry) return;

  const DONE_KEY = 'connectify:wallpaper_fit_done';
  const BG_KEY = 'connectea:custom_background';
  const THEMES_KEY = 'connectea:custom_themes_list';
  const START_DELAY = 5000;
  const extensionStorage = () => (typeof chrome !== 'undefined' && chrome.storage?.local) || null;

  function readExtension(key) {
    const store = extensionStorage();
    if (!store) return Promise.resolve(null);
    return new Promise(resolve => {
      try { store.get([key], res => resolve(res?.[key] ?? null)); } catch { resolve(null); }
    });
  }

  function parseList(raw) {
    try {
      const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(list) ? list : null;
    } catch { return null; }
  }

  // Extension storage always holds the full list (localStorage drops wallpapers over its quota);
  // a theme only localStorage knows is kept too
  async function readThemes() {
    const ext = parseList(await readExtension(THEMES_KEY));
    let local = null;
    try { local = parseList(localStorage.getItem(THEMES_KEY)); } catch {}
    if (!ext || !local) return ext || local || [];
    const ids = new Set(ext.map(t => t?.id));
    return [...ext, ...local.filter(t => t?.id && !ids.has(t.id))];
  }

  /** One fit per distinct wallpaper (a theme's wallpaper is usually the active one too); failures keep the original. */
  function fitter() {
    const fitted = new Map();
    return url => {
      if (!fitted.has(url)) fitted.set(url, fit.fromDataUrl(url).catch(() => url));
      return fitted.get(url);
    };
  }

  const activeBackground = async () => tokens.getCustomBackground() || await readExtension(BG_KEY);

  async function migrateActive(fitOne) {
    const url = await activeBackground();
    if (!fit.needsFit(url)) return false;
    const small = await fitOne(url);
    // Skip if the student picked or cleared a wallpaper meanwhile
    if (small === url || await activeBackground() !== url) return false;
    tokens.setCustomBackground(small);
    return true;
  }

  async function migrateThemes(fitOne) {
    const large = [...new Set((await readThemes()).map(t => t?.wallpaper).filter(fit.needsFit))];
    if (!large.length) return false;
    const fitted = new Map();
    for (const url of large) {
      const small = await fitOne(url);
      if (small !== url) fitted.set(url, small);
    }
    if (!fitted.size) return false;
    // Re-read so a theme saved meanwhile is kept; only the fitted wallpapers change
    const list = (await readThemes()).map(t => (fitted.has(t?.wallpaper) ? { ...t, wallpaper: fitted.get(t.wallpaper) } : t));
    registry.writeCustomThemes(list);
    for (const t of list) {
      const def = t?.id && registry.getThemeDefinition(t.id);
      if (def && fitted.has(def.wallpaper)) def.wallpaper = fitted.get(def.wallpaper);
    }
    return true;
  }

  /** Runs once per browser profile (until it completes); never on the login pages. */
  async function run() {
    if (window.ConnectifyThemeAuth?.isAuthDisabled()) return false;
    try { if (localStorage.getItem(DONE_KEY)) return false; } catch { return false; }
    const fitOne = fitter();
    const active = await migrateActive(fitOne);
    const themes = await migrateThemes(fitOne);
    try { localStorage.setItem(DONE_KEY, '1'); } catch {}
    return active || themes;
  }

  function schedule() {
    const start = () => { run().catch(() => {}); };
    setTimeout(() => {
      if (typeof requestIdleCallback === 'function') requestIdleCallback(start, { timeout: 10000 });
      else start();
    }, START_DELAY);
  }

  window.ConnectifyWallpaperMigrate = { DONE_KEY, run };
  if (typeof document !== 'undefined' && window.top === window) schedule();
})();

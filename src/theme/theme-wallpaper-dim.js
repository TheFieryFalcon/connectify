/**
 * Connectify Theme: keeps text readable straight on the wallpaper. The wallpaper (a GIF's first frame) is
 * sampled on a small canvas and two overlays are found: the least black overlay that keeps every sampled pixel
 * at >= 4.5:1 against white (--cx-wallpaper-dim, for light-text themes) and the least white overlay that keeps
 * every pixel at >= 4.5:1 against the theme's dark text (--cx-wallpaper-brighten, for Light and light-tone
 * themes). theme-wallpaper-layer.css applies the one that matches the theme's ink. Results are cached per
 * wallpaper (and per ink for brightening), so later pages paint at once. Exposes window.ConnectifyWallpaperDim.
 */
(function () {
  'use strict';

  if (window.ConnectifyWallpaperDim) return;

  const CACHE_KEY = 'connectify:wallpaper_dim';
  const TARGET = 4.6; // 4.5:1 with headroom for rounding
  const SAMPLE = 160;
  const FALLBACK = 0.45; // used until the wallpaper is measured, or when it cannot be read
  const DEFAULT_INK = '#0f172a';
  const LINEAR = Array.from({ length: 256 }, (_, v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  let currentKey = null;
  let currentUrl = null;
  let pixels = null;

  /** Cheap fingerprint of a (multi-MB) data URL: its length and ~512 evenly spaced characters. */
  function keyOf(url) {
    let h = 0;
    const step = Math.max(1, Math.floor(url.length / 512));
    for (let i = 0; i < url.length; i += step) h = (h * 31 + url.charCodeAt(i)) | 0;
    return `${url.length}:${h}`;
  }

  function luminanceOfHex(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return 0.2126 * LINEAR[(n >> 16) & 255] + 0.7152 * LINEAR[(n >> 8) & 255] + 0.0722 * LINEAR[n & 255];
  }

  /** Least overlay alpha (0..1) that keeps every pixel's luminance on the right side of the limit. */
  function solve(data, mix, fitsPixel) {
    const fits = a => {
      for (let i = 0; i < data.length; i += 4) {
        const l = 0.2126 * LINEAR[mix(data[i], a)] + 0.7152 * LINEAR[mix(data[i + 1], a)] + 0.0722 * LINEAR[mix(data[i + 2], a)];
        if (!fitsPixel(l)) return false;
      }
      return true;
    };
    if (fits(0)) return 0;
    let lo = 0, hi = 1;
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid; else lo = mid;
    }
    return Math.ceil(hi * 1000) / 1000;
  }

  /** Black overlay over sRGB (each channel c * (1 - a)): white text >= TARGET:1 anywhere on the wallpaper. */
  function dimFor(data) {
    const max = 1.05 / TARGET - 0.05;
    return solve(data, (c, a) => Math.round(c * (1 - a)), l => l <= max);
  }

  /** White overlay over sRGB (each channel c + (255 - c) * a): text of the given ink >= TARGET:1 everywhere. */
  function brightenFor(data, ink = DEFAULT_INK) {
    const min = TARGET * ((luminanceOfHex(ink) ?? luminanceOfHex(DEFAULT_INK)) + 0.05) - 0.05;
    if (min > 1) return 1;
    return solve(data, (c, a) => Math.round(c + (255 - c) * a), l => l >= min);
  }

  /** The theme's text colour when it is dark (Light, light-tone and light custom themes), else the default ink. */
  function currentInk() {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--cx-text-primary').trim();
    const l = luminanceOfHex(value);
    return l != null && l < 0.2 ? value.toLowerCase() : DEFAULT_INK;
  }

  function sample(url) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, SAMPLE / Math.max(img.naturalWidth, img.naturalHeight));
          const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          resolve(ctx.getImageData(0, 0, w, h).data);
        } catch {
          resolve(null); // unreadable (tainted) image: safe default overlays
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
  }

  function setVars(dim, brighten) {
    const style = document.documentElement.style;
    for (const [prop, value] of [['--cx-wallpaper-dim', dim], ['--cx-wallpaper-brighten', brighten]]) {
      if (value == null) style.removeProperty(prop);
      else style.setProperty(prop, String(value));
    }
  }

  /** Applies cached overlays for this wallpaper and ink, measuring what is missing. */
  async function apply(url, key) {
    const ink = currentInk();
    const cached = readCache();
    const entry = cached && cached.key === key ? cached : { key, brighten: {} };
    if (Number.isFinite(entry.dim) && Number.isFinite(entry.brighten?.[ink])) {
      setVars(entry.dim, entry.brighten[ink]);
      return;
    }
    setVars(Number.isFinite(entry.dim) ? entry.dim : FALLBACK, entry.brighten?.[ink] ?? FALLBACK);
    if (!pixels || currentKey !== key) pixels = await sample(url);
    if (currentKey !== key) return; // the wallpaper changed meanwhile
    entry.dim = pixels ? dimFor(pixels) : FALLBACK;
    entry.brighten = { ...entry.brighten, [ink]: pixels ? brightenFor(pixels, ink) : FALLBACK };
    setVars(entry.dim, entry.brighten[ink]);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(entry)); } catch {}
  }

  /** Measures a wallpaper (cached per wallpaper) and applies its overlays; null clears them. */
  function update(url) {
    if (typeof document === 'undefined' || !document.documentElement) return;
    if (!url) {
      currentKey = currentUrl = pixels = null;
      setVars(null, null);
      return;
    }
    const key = keyOf(url);
    if (key === currentKey) return;
    currentKey = key;
    currentUrl = url;
    pixels = null;
    apply(url, key);
  }

  window.ConnectifyWallpaperDim = { update, dimFor, brightenFor, keyOf, TARGET };

  // A theme change can change the ink: brighten for the new text colour once the theme has applied
  window.addEventListener?.('connectea:themechange', () => {
    requestAnimationFrame(() => { if (currentUrl) apply(currentUrl, currentKey); });
  });

  // theme-custom-tokens.js ran first: measure the wallpaper it already applied
  if (document.documentElement?.hasAttribute('data-connectea-has-custom-bg')) {
    update(window.ConnectifyThemeTokens?.getCustomBackground?.());
  }
})();

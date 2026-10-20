/**
 * Connectify Theme: dims the wallpaper just enough for white text. The wallpaper (a GIF's first frame) is
 * sampled on a small canvas and the least black overlay that keeps every sampled pixel at >= 4.5:1 against
 * white is written to --cx-wallpaper-dim on <html>; theme-wallpaper-layer.css applies it only when the
 * theme's text is light. Each result is cached per wallpaper, so later pages paint dimmed at once.
 * Exposes window.ConnectifyWallpaperDim.
 */
(function () {
  'use strict';

  if (window.ConnectifyWallpaperDim) return;

  const CACHE_KEY = 'connectify:wallpaper_dim';
  const TARGET = 4.6; // 4.5:1 with headroom for rounding
  const MAX_LUMINANCE = 1.05 / TARGET - 0.05;
  const SAMPLE = 160;
  const FALLBACK = 0.45; // used until the wallpaper is measured, or when it cannot be read
  const LINEAR = Array.from({ length: 256 }, (_, v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  let currentKey = null;

  /** Cheap fingerprint of a (multi-MB) data URL: its length and ~512 evenly spaced characters. */
  function keyOf(url) {
    let h = 0;
    const step = Math.max(1, Math.floor(url.length / 512));
    for (let i = 0; i < url.length; i += step) h = (h * 31 + url.charCodeAt(i)) | 0;
    return `${url.length}:${h}`;
  }

  /** Least overlay alpha a (black over sRGB, so each channel becomes c * (1 - a)) keeping every pixel's
   *  relative luminance <= MAX_LUMINANCE, i.e. white text >= TARGET:1 anywhere on the wallpaper. */
  function dimFor(pixels) {
    const fits = a => {
      const k = 1 - a;
      for (let i = 0; i < pixels.length; i += 4) {
        const l = 0.2126 * LINEAR[Math.round(pixels[i] * k)] + 0.7152 * LINEAR[Math.round(pixels[i + 1] * k)] + 0.0722 * LINEAR[Math.round(pixels[i + 2] * k)];
        if (l > MAX_LUMINANCE) return false;
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

  function measure(url) {
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
          resolve(dimFor(ctx.getImageData(0, 0, w, h).data));
        } catch {
          resolve(FALLBACK); // unreadable (tainted) image: a safe default dim
        }
      };
      img.onerror = () => resolve(FALLBACK);
      img.src = url;
    });
  }

  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
  }

  function setDim(dim) {
    const root = document.documentElement;
    if (dim == null) root.style.removeProperty('--cx-wallpaper-dim');
    else root.style.setProperty('--cx-wallpaper-dim', String(dim));
  }

  /** Measures a wallpaper (cached per wallpaper) and applies its dim; null clears it. */
  function update(url) {
    if (typeof document === 'undefined' || !document.documentElement) return;
    if (!url) {
      currentKey = null;
      setDim(null);
      return;
    }
    const key = keyOf(url);
    if (key === currentKey) return;
    currentKey = key;
    const cached = readCache();
    if (cached && cached.key === key && Number.isFinite(cached.dim)) {
      setDim(cached.dim);
      return;
    }
    setDim(FALLBACK);
    measure(url).then(dim => {
      if (currentKey !== key) return; // the wallpaper changed meanwhile
      setDim(dim);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ key, dim })); } catch {}
    });
  }

  window.ConnectifyWallpaperDim = { update, dimFor, keyOf, TARGET };

  // theme-custom-tokens.js ran first: measure the wallpaper it already applied
  if (document.documentElement?.hasAttribute('data-connectea-has-custom-bg')) {
    update(window.ConnectifyThemeTokens?.getCustomBackground?.());
  }
})();

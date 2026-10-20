/**
 * Connectify Wallpaper Fit
 * Uploaded wallpapers are painted `center / cover fixed` (theme-tokens.css), so only a screen-sized,
 * centre-cropped part of the image is ever visible. Huge photos are cropped to the screen's aspect ratio
 * and scaled down to its device pixels before they are stored or painted, so every page paints a small JPEG.
 * GIFs are stored as uploaded: re-encoding would keep only the first frame, so animated wallpapers keep moving.
 */
(function () {
  'use strict';

  const MAX_EDGE = 3840;   // 4K long edge is plenty for any wallpaper
  const MAX_DPR = 2;
  const QUALITY = 0.86;
  const KEEP_BYTES = 1.5 * 1024 * 1024; // small images that already fit keep their original encoding
  const FIT_OVER = 1.5 * 1024 * 1024;   // stored data URLs longer than this are fitted (SVG presets never)
  // GIFs cannot be shrunk, so they must fit extension storage as they are: 40 MB with `unlimitedStorage`,
  // 4 MB in Chrome Web Store builds (the permission is stripped there, leaving Chrome's 10 MB storage.local quota)
  const MB = 1024 * 1024;
  const GIF_MAX_UNLIMITED = 40 * MB;
  const GIF_MAX_LIMITED = 4 * MB;

  function gifMax() {
    try {
      const perms = (typeof chrome !== 'undefined' && chrome.runtime?.getManifest?.().permissions) || [];
      return perms.includes('unlimitedStorage') ? GIF_MAX_UNLIMITED : GIF_MAX_LIMITED;
    } catch {
      return GIF_MAX_LIMITED;
    }
  }

  const isGif = file => /^image\/gif$/i.test(file?.type || '');

  function gifTooLarge(file, max) {
    const msg = `GIF wallpapers must be ${max / MB} MB or smaller (this one is ${(file.size / MB).toFixed(1)} MB)`;
    return Object.assign(new Error(msg), { code: 'gif-too-large' });
  }

  /** Status text for a failed upload. */
  const errorText = err => (err?.code === 'gif-too-large' ? err.message : 'That image could not be read');

  /** Device-pixel size of the screen (the most a fixed `cover` background can show), capped at 4K. */
  function targetSize(win = window) {
    const dpr = Math.min(win.devicePixelRatio || 1, MAX_DPR);
    const scr = win.screen || {};
    const w = Math.max(scr.width || 0, win.innerWidth || 0, 1) * dpr;
    const h = Math.max(scr.height || 0, win.innerHeight || 0, 1) * dpr;
    const cap = Math.min(1, MAX_EDGE / Math.max(w, h));
    return { width: Math.round(w * cap), height: Math.round(h * cap) };
  }

  /** Centre crop of an iw x ih image at the target's aspect ratio, scaled down (never up) to the target. */
  function fitRect(iw, ih, tw, th) {
    const cover = Math.max(tw / iw, th / ih);
    const sw = Math.min(iw, tw / cover);
    const sh = Math.min(ih, th / cover);
    const scale = Math.min(1, cover);
    return {
      sx: (iw - sw) / 2, sy: (ih - sh) / 2, sw, sh,
      width: Math.max(1, Math.round(sw * scale)), height: Math.max(1, Math.round(sh * scale))
    };
  }

  function readAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  // createImageBitmap decodes off the main thread; <img> is the fallback
  async function decode(file) {
    if (typeof createImageBitmap === 'function') {
      try { return await createImageBitmap(file); } catch {}
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // Crop and resize in one off-thread step where the browser supports resize options
  async function cropped(source, r) {
    if (typeof createImageBitmap !== 'function') return null;
    try {
      return await createImageBitmap(source, r.sx, r.sy, r.sw, r.sh,
        { resizeWidth: r.width, resizeHeight: r.height, resizeQuality: 'high' });
    } catch {
      return null;
    }
  }

  async function encode(source, r) {
    const canvas = typeof OffscreenCanvas === 'function'
      ? new OffscreenCanvas(r.width, r.height)
      : Object.assign(document.createElement('canvas'), { width: r.width, height: r.height });
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, r.sx, r.sy, r.sw, r.sh, 0, 0, r.width, r.height);
    const blob = canvas.convertToBlob
      ? await canvas.convertToBlob({ type: 'image/jpeg', quality: QUALITY })
      : await new Promise(res => canvas.toBlob(res, 'image/jpeg', QUALITY));
    if (!blob) throw new Error('Wallpaper could not be encoded');
    return readAsDataUrl(blob);
  }

  /** Resolves to a data URL of the wallpaper cropped and scaled to the screen; rejects if it cannot be decoded. */
  async function fromFile(file) {
    if (isGif(file) && file.size > gifMax()) throw gifTooLarge(file, gifMax());
    const image = await decode(file);
    const iw = image.naturalWidth || image.width;
    const ih = image.naturalHeight || image.height;
    const t = targetSize();
    const r = fitRect(iw, ih, t.width, t.height);
    try {
      if (isGif(file)) return await readAsDataUrl(file); // every frame kept; `cover` crops it on screen
      if (r.width === iw && r.height === ih && file.size <= KEEP_BYTES) return await readAsDataUrl(file);
      const small = await cropped(image, r);
      if (!small) return await encode(image, r);
      try {
        return await encode(small, { sx: 0, sy: 0, sw: small.width, sh: small.height, width: r.width, height: r.height });
      } finally {
        small.close?.();
      }
    } finally {
      image.close?.();
    }
  }

  /** A raster image data URL large enough to be worth fitting (wallpapers stored before uploads were fitted, imports); never a GIF. */
  function needsFit(url) {
    return typeof url === 'string' && url.length > FIT_OVER && /^data:image\//i.test(url) && !/^data:image\/(svg|gif)/i.test(url);
  }

  // fetch() decodes the base64 off the main thread; atob is the fallback where a page blocks it
  async function toBlob(url) {
    if (typeof fetch === 'function') {
      try { return await (await fetch(url)).blob(); } catch {}
    }
    const comma = url.indexOf(',');
    const meta = url.slice(5, comma);
    const body = url.slice(comma + 1);
    const type = meta.split(';')[0];
    if (!/;base64$/i.test(meta)) return new Blob([decodeURIComponent(body)], { type });
    const bin = atob(body);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type });
  }

  /** fromFile for a stored data URL; resolves to the original when fitting would not make it smaller. */
  async function fromDataUrl(url) {
    const fitted = await fromFile(await toBlob(url));
    return fitted.length < url.length ? fitted : url;
  }

  window.ConnectifyWallpaperFit = { MAX_EDGE, FIT_OVER, gifMax, targetSize, fitRect, fromFile, needsFit, fromDataUrl, errorText };
})();

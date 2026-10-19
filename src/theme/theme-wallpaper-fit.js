/**
 * Connectify Wallpaper Fit
 * Uploaded wallpapers are painted `center / cover fixed` (theme-tokens.css), so only a screen-sized,
 * centre-cropped part of the image is ever visible. Huge photos are cropped to the screen's aspect ratio
 * and scaled down to its device pixels before they are stored or painted, so every page paints a small JPEG.
 */
(function () {
  'use strict';

  const MAX_EDGE = 3840;   // 4K long edge is plenty for any wallpaper
  const MAX_DPR = 2;
  const QUALITY = 0.86;
  const KEEP_BYTES = 1.5 * 1024 * 1024; // small images that already fit keep their original encoding

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
    const image = await decode(file);
    const iw = image.naturalWidth || image.width;
    const ih = image.naturalHeight || image.height;
    const t = targetSize();
    const r = fitRect(iw, ih, t.width, t.height);
    try {
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

  window.ConnectifyWallpaperFit = { MAX_EDGE, targetSize, fitRect, fromFile };
})();

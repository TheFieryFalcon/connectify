/**
 * Connectify Theme: OKLCH colour maths for token derivation
 *
 * Converts hex colours to and from OKLCH (perceptual lightness L 0-100, chroma C, hue h) so derived
 * tokens can shift lightness the way the presets do: same hue, same chroma-to-lightness ratio.
 * Also WCAG luminance, contrast and a contrast clamp. Exposes window.ConnectifyThemeOklch.
 */
(() => {
  'use strict';

  const hexRgb = hex => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(String(hex || '').trim());
    return m ? [1, 2, 3].map(i => parseInt(m[i], 16)) : [30, 40, 50];
  };
  const toHex = rgb => '#' + rgb.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
  const toLinear = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const fromLinear = v => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

  function toOklch(hex) {
    const [r, g, b] = hexRgb(hex).map(toLinear);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787835 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return { L: L * 100, C: Math.hypot(A, B) * 100, h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
  }

  function linearFromOklch(L, C, h) {
    const rad = (h * Math.PI) / 180, A = (C / 100) * Math.cos(rad), B = (C / 100) * Math.sin(rad), Lf = L / 100;
    const l = (Lf + 0.3963377774 * A + 0.2158037573 * B) ** 3;
    const m = (Lf - 0.1055613458 * A - 0.0638541728 * B) ** 3;
    const s = (Lf - 0.0894841775 * A - 1.291485548 * B) ** 3;
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
    ];
  }

  /** OKLCH back to hex, lowering chroma (never hue or lightness) until it fits the sRGB gamut. */
  function fromOklch(L, C, h) {
    L = Math.max(0, Math.min(100, L));
    for (let c = Math.max(0, C); ; c *= 0.9) {
      const rgb = linearFromOklch(L, c, h);
      if (c < 0.05 || rgb.every(v => v >= -0.0005 && v <= 1.0005)) return toHex(rgb.map(v => fromLinear(Math.max(0, Math.min(1, v)))));
    }
  }

  /** Shifts lightness by dL points, keeping hue and the chroma/lightness ratio (times cScale). */
  function shiftL(hex, dL, cScale = 1) {
    const { L, C, h } = toOklch(hex);
    const next = Math.max(0, Math.min(100, L + dL));
    return fromOklch(next, (L > 1 ? (C * next) / L : C) * cScale, h);
  }

  /** A colour at lightness L with the given hue and chroma. */
  const withLch = (L, C, h) => fromOklch(L, C, h);

  const luminance = hex => {
    const [r, g, b] = hexRgb(hex).map(toLinear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  /** Moves fg's lightness away from bg (same hue) until the contrast ratio reaches min. */
  function ensureContrast(fg, bg, min) {
    const step = luminance(bg) < 0.18 ? 2 : -2;
    for (let i = 0; i < 50 && contrast(fg, bg) < min; i++) fg = shiftL(fg, step);
    return fg;
  }
  /** White or near-black, whichever reads better on bg. */
  const readable = bg => (contrast('#ffffff', bg) >= contrast('#0f172a', bg) ? '#ffffff' : '#0f172a');

  window.ConnectifyThemeOklch = { toOklch, fromOklch, shiftL, withLch, luminance, contrast, ensureContrast, readable };
})();

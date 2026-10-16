/**
 * Connectify Theme: colour utilities for the theme customizer
 *
 * Colour parsing and conversion, HTML escaping and colour-token sanitising; Basic-mode derivation
 * delegates to theme-token-derive.js. Exposes window.ConnectifyThemeColors.
 */
(() => {
  'use strict';

  const FALLBACK_RGB = { r: 30, g: 40, b: 50 };

  // Every colour token a custom theme can carry; anything else (name, icon, swatch...) is not a colour
  const COLOR_KEYS = [
    'canvas', 'canvasSubtle', 'surface', 'surfaceSecondary', 'surfaceElevated', 'surfaceHover',
    'border', 'borderSubtle', 'borderStrong', 'accent', 'accentHover', 'textPrimary', 'textSecondary',
    'textMuted', 'tileLinkColor', 'button', 'buttonHover', 'buttonText', 'inputBg', 'inputBorder'
  ];

  /** Parses #rrggbb, or rgb()/rgba() as used by the Liquid Glass preset (alpha is ignored). */
  function parseHex(value) {
    if (!value || typeof value !== 'string') return { ...FALLBACK_RGB };
    const hex = value.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (hex) return { r: parseInt(hex[1], 16), g: parseInt(hex[2], 16), b: parseInt(hex[3], 16) };
    const rgb = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    return rgb ? { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) } : { ...FALLBACK_RGB };
  }

  function toHex(r, g, b) {
    return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    const s = max === 0 ? 0 : d / max, v = max;
    if (d !== 0) h = (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) / 6;
    return { h: Math.round(h * 360), s, v };
  }

  function hsvToRgb(h, s, v) {
    const i = Math.floor((h / 360) * 6), f = (h / 360) * 6 - i;
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    const arr = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
    return { r: Math.round(arr[0] * 255), g: Math.round(arr[1] * 255), b: Math.round(arr[2] * 255) };
  }

  /** Mixes towards white (pct > 0) or black (pct < 0). */
  function adjustLightness(hex, pct) {
    const { r, g, b } = parseHex(hex), f = pct >= 0 ? 255 : 0, a = Math.abs(pct) / 100;
    return toHex(r + (f - r) * a, g + (f - g) * a, b + (f - b) * a);
  }

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));

  const isColorValue = value => typeof value === 'string' && /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.,\s%]+\))$/i.test(value.trim());

  /** Keeps only valid colour tokens (used for preset inheritance and imported JSON). */
  function pickColors(source) {
    const out = {};
    for (const key of COLOR_KEYS) if (isColorValue(source?.[key])) out[key] = source[key].trim();
    return out;
  }

  /** Basic mode: derives the Full-mode tokens from the six basic ones (theme-token-derive.js; mutates tokens). */
  const deriveSecondaryTokens = tokens => window.ConnectifyThemeDerive.deriveFull(tokens);

  window.ConnectifyThemeColors = {
    COLOR_KEYS, parseHex, toHex, rgbToHsv, hsvToRgb, adjustLightness, escapeHtml, isColorValue, pickColors, deriveSecondaryTokens
  };
})();

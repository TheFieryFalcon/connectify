/**
 * Connectify Theme Token Derivation
 *
 * A custom theme edits at most 14 colour tokens (6 in Basic mode). Everything else the stylesheets read
 * (muted text, nav, table, badge, scrollbar, focus and input tokens ...) is derived here from those, so a
 * custom palette never falls back to the Dark preset's navy values. Exposes window.ConnectifyThemeDerive.
 */
(() => {
  'use strict';

  const colors = window.ConnectifyThemeColors;
  const lum = hex => {
    const { r, g, b } = colors.parseHex(hex);
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const contrast = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const mix = (a, b, t) => {
    const x = colors.parseHex(a), y = colors.parseHex(b);
    return colors.toHex(x.r + (y.r - x.r) * t, x.g + (y.g - x.g) * t, x.b + (y.b - x.b) * t);
  };
  /** Pushes fg towards white or black (whichever contrasts with bg) until the ratio reaches min. */
  function ensureContrast(fg, bg, min) {
    const target = lum(bg) < 0.4 ? '#ffffff' : '#000000';
    for (let t = 0; t <= 1.001 && contrast(fg, bg) < min; t += 0.05) fg = mix(fg, target, 0.05);
    return fg;
  }
  const readable = bg => (contrast('#ffffff', bg) >= contrast('#0f172a', bg) ? '#ffffff' : '#0f172a');
  const valid = v => typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v.trim());

  /** Fills the secondary tokens a theme left out (older Full themes, imports) without touching what it set. */
  function complete(source) {
    const c = { ...source };
    if (!valid(c.canvas) || !valid(c.surface) || !valid(c.border) || !valid(c.accent)) return c;
    if (!valid(c.button)) c.button = colors.adjustLightness(c.surface, 4);
    if (!valid(c.textPrimary)) c.textPrimary = readable(c.surface);
    const filled = colors.deriveSecondaryTokens({ ...c });
    for (const key of Object.keys(filled)) if (!valid(c[key])) c[key] = filled[key];
    return c;
  }

  /** Every CSS custom property a custom theme sets, for a (completed) token set. */
  function cssProps(source) {
    const c = complete(source);
    if (!valid(c.canvas) || !valid(c.surface)) return {};
    const dark = lum(c.surface) < 0.18;
    const toward = (hex, pct) => colors.adjustLightness(hex, dark ? pct : -pct);
    const text = c.textPrimary, secondary = ensureContrast(c.textSecondary || text, c.surface, 5);
    const muted = ensureContrast(mix(text, c.surface, 0.35), c.surface, 5);
    const accentText = readable(c.accent);
    const rgb = colors.parseHex(c.accent);
    return {
      '--cx-text-secondary': secondary, '--cx-text-muted': muted, '--cx-text-disabled': mix(text, c.surface, 0.55),
      '--cx-surface-active': toward(c.surface, 18), '--cx-border-hover': c.borderStrong, '--cx-border-focus': c.accent,
      '--cx-accent-active': toward(c.accent, -12), '--cx-accent-subtle': `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`,
      '--cx-accent-text': accentText, '--cx-accent-link': ensureContrast(c.accent, c.surface, 5),
      '--cx-nav-border': c.border, '--cx-nav-text': secondary, '--cx-nav-text-hover': text, '--cx-nav-item-active': c.canvasSubtle,
      '--cx-button-active': toward(c.button, -8), '--cx-button-border': c.border, '--cx-button-border-hover': c.borderStrong,
      '--cx-button-text-hover': c.buttonText, '--cx-button-primary-bg': c.accent, '--cx-button-primary-hover': c.accentHover,
      '--cx-button-primary-text': accentText,
      '--cx-input-text': text, '--cx-input-placeholder': muted, '--cx-input-border-focus': c.accent,
      '--cx-table-header-bg': c.surfaceSecondary, '--cx-table-row-hover': c.surfaceHover,
      '--cx-table-row-alt': mix(c.surface, c.canvas, 0.5), '--cx-table-border': c.borderSubtle,
      '--cx-badge-bg': c.surfaceElevated, '--cx-badge-border': c.border, '--cx-badge-text': text,
      '--cx-scrollbar-thumb': c.borderStrong, '--cx-scrollbar-track': c.canvas, '--cx-avatar-bg': c.surfaceElevated
    };
  }

  window.ConnectifyThemeDerive = { complete, cssProps, ensureContrast, contrast };
})();

/**
 * Connectify Theme Token Derivation
 *
 * Two layers, each fitted to how the preset palettes relate (OKLCH lightness offsets that keep the
 * base colour's hue and chroma/lightness ratio; offsets flip direction on light themes):
 *   deriveFull(basic)  the 6 Basic tokens -> the 20 Full-mode tokens
 *   cssProps(full)     the Full tokens    -> every other --cx-* property the stylesheets read
 * so every colour on the page traces back to a Basic token. Exposes window.ConnectifyThemeDerive.
 */
(() => {
  'use strict';

  const ok = () => window.ConnectifyThemeOklch;
  const BASIC_KEYS = ['canvas', 'surface', 'button', 'border', 'accent', 'textPrimary'];
  const valid = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim());
  const isDark = surface => ok().toOklch(surface).L < 60;
  // Canvas-based tokens step towards (+) or away from (-) the surface, which sits above the canvas
  // in light and dark presets alike; surface, border and button steps go towards the text instead
  const towardSurface = (canvas, surface) => Math.sign(ok().toOklch(surface).L - ok().toOklch(canvas).L) || 1;
  const mix = (a, b, t) => {
    const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
    const ch = (v, s) => (v >> s) & 255;
    return '#' + [16, 8, 0].map(s => Math.round(ch(x, s) + (ch(y, s) - ch(x, s)) * t).toString(16).padStart(2, '0')).join('');
  };
  const rgba = (hex, a) => `rgba(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ')}, ${a})`;

  /** Text dL points towards the surface, in the surface's hue at a low chroma (muted / disabled text). */
  function quietText(text, surface, dL, dark) {
    const o = ok(), t = o.toOklch(text), s = o.toOklch(surface);
    const L = t.L + (dark ? -dL : dL);
    return o.withLch(L, s.L > 1 ? (s.C / s.L) * L * 0.5 : 0, s.h);
  }

  /** Basic -> Full: fills (and in Basic mode overwrites) the Full-mode tokens from the six basic ones. */
  function deriveFull(tokens) {
    const o = ok(), { canvas, surface, button, border, accent } = tokens;
    const dark = isDark(surface), d = dark ? 1 : -1, up = (hex, dL, c) => o.shiftL(hex, d * dL, c);
    const cd = towardSurface(canvas, surface);
    const text = tokens.textPrimary || o.readable(surface);
    Object.assign(tokens, {
      textPrimary: text,
      canvasSubtle: o.shiftL(canvas, -5 * cd), inputBg: o.shiftL(canvas, 1.5 * cd),
      surfaceSecondary: up(surface, 4), surfaceElevated: up(surface, 7), surfaceHover: up(surface, 11),
      borderSubtle: up(border, -10.5), borderStrong: up(border, 8.5), inputBorder: up(border, -7),
      accentHover: up(accent, 8, 0.8),
      textSecondary: o.ensureContrast(o.shiftL(text, -d * 7), surface, 5),
      textMuted: o.ensureContrast(quietText(text, surface, 26, dark), surface, 5), tileLinkColor: text,
      buttonHover: up(button, 5.5), buttonText: o.ensureContrast(text, button, 5)
    });
    return tokens;
  }

  /** Fills the tokens a theme left out (older themes, imports) without touching what it set. */
  function complete(source) {
    const c = { ...source };
    if (!['canvas', 'surface', 'border', 'accent'].every(k => valid(c[k]))) return c;
    if (!valid(c.button)) c.button = ok().shiftL(c.surface, isDark(c.surface) ? 2 : -2);
    if (!valid(c.textPrimary)) c.textPrimary = ok().readable(c.surface);
    const filled = deriveFull({ ...c });
    for (const key of Object.keys(filled)) if (!valid(c[key])) c[key] = filled[key];
    return c;
  }

  /** Full -> everything else: every derived CSS custom property for a (completed) token set. */
  function cssProps(source) {
    const c = complete(source);
    if (!valid(c.canvas) || !valid(c.surface)) return {};
    const o = ok(), dark = isDark(c.surface), d = dark ? 1 : -1, up = (hex, dL, cs) => o.shiftL(hex, d * dL, cs);
    const cd = towardSurface(c.canvas, c.surface);
    const text = c.textPrimary;
    // Text tokens are used as given: deriveFull already keeps derived ones >= 5:1, and a colour the user set
    // themselves in Full mode must never be swapped for a contrast fix
    const secondary = c.textSecondary;
    // Ink on fills that have no text token of their own: the theme's own text colours when they read (>= 5:1)
    const ink = (fill, ...own) => own.find(t => valid(t) && o.contrast(t, fill) >= 5) || o.readable(fill);
    const disabled = quietText(text, c.surface, 43, dark);
    const accentActive = o.shiftL(c.accent, -9, 1.05);
    // Presets keep a light accent's primary button light with dark text (Quantum); any other accent is
    // darkened until white text reads on it (Dark, Midnight, Forest)
    let primary = accentActive;
    if (o.contrast('#0f172a', c.accent) < 8) {
      for (let i = 0; i < 60 && o.contrast('#ffffff', primary) < 5; i++) primary = o.shiftL(primary, -1);
    }
    const buttonText = c.buttonText || o.readable(c.button);
    return {
      '--cx-text-secondary': secondary, '--cx-text-muted': c.textMuted, '--cx-text-disabled': disabled,
      '--cx-tile-link-color': c.tileLinkColor,
      '--cx-surface-active': up(c.surfaceHover, 4),
      '--cx-border-hover': c.borderStrong, '--cx-border-focus': c.accent,
      '--cx-accent-active': accentActive, '--cx-accent-subtle': rgba(c.accent, 0.15),
      '--cx-accent-text': ink(c.accent, text), '--cx-accent-link': o.ensureContrast(c.accent, c.surface, 5),
      '--cx-nav-bg': o.shiftL(c.canvas, 2.5 * cd), '--cx-nav-border': c.borderSubtle, '--cx-nav-text': secondary,
      '--cx-nav-text-hover': up(text, 3), '--cx-nav-item-active': o.shiftL(c.canvas, -2.5 * cd),
      '--cx-button-active': up(c.button, -3.5), '--cx-button-border': c.border, '--cx-button-border-hover': c.borderStrong,
      '--cx-button-text': buttonText, '--cx-button-text-hover': o.shiftL(buttonText, dark ? 3 : -3),
      '--cx-button-primary-bg': primary, '--cx-button-primary-hover': o.shiftL(primary, -6.5),
      '--cx-button-primary-text': ink(primary, c.buttonText, text),
      '--cx-input-bg': c.inputBg, '--cx-input-border': c.inputBorder,
      '--cx-input-text': text, '--cx-input-placeholder': disabled, '--cx-input-border-focus': c.accent,
      '--cx-table-header-bg': o.shiftL(c.surface, -1.5 * cd), '--cx-table-row-hover': up(c.surface, 5),
      '--cx-table-row-alt': mix(c.surface, c.canvas, 0.5), '--cx-table-border': up(c.borderSubtle, -2),
      '--cx-badge-bg': up(c.surface, 6), '--cx-badge-border': up(c.border, -2), '--cx-badge-text': text,
      '--cx-scrollbar-thumb': up(c.border, -4), '--cx-scrollbar-track': c.canvas, '--cx-avatar-bg': c.surfaceElevated,
      '--cx-avatar-text': ink(c.surfaceElevated, text)
    };
  }

  const { contrast, ensureContrast } = window.ConnectifyThemeOklch || {};
  window.ConnectifyThemeDerive = { BASIC_KEYS, deriveFull, complete, cssProps, contrast, ensureContrast };
})();

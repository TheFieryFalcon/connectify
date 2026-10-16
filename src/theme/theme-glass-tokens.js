/**
 * Connectify Theme: Liquid Glass tokens for custom themes
 *
 * A custom theme with Liquid Glass on becomes a recoloured Liquid Glass theme: its panels take the
 * preset's translucent recipe in the theme's own colours. Fills are the theme's surface/canvas at the
 * Transparency slider's opacity (scaled the way the preset scales secondary, elevated, nav and inputs
 * against its 0.72 surface); hover, border, button, table and badge layers are the theme's text colour
 * at the preset's overlay strengths. Exposes window.ConnectifyThemeGlassTokens.
 */
(() => {
  'use strict';

  const rgb = hex => [1, 3, 5].map(i => parseInt(String(hex).slice(i, i + 2), 16));
  const at = (hex, alpha) => `rgba(${rgb(hex).join(', ')}, ${Math.round(Math.min(1, Math.max(0, alpha)) * 100) / 100})`;
  const isHex = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim());

  // Liquid Glass preset alphas relative to its 0.72 surface, and its overlay strengths
  const FILL = { surface: 1, secondary: 0.68 / 0.72, elevated: 0.8 / 0.72, nav: 0.75 / 0.72, input: 0.6 / 0.72, header: 0.75 / 0.72 };
  const OVERLAY = {
    '--cx-surface-hover': 0.14, '--cx-surface-active': 0.22, '--cx-border': 0.22, '--cx-border-subtle': 0.12,
    '--cx-border-strong': 0.32, '--cx-border-hover': 0.32, '--cx-nav-border': 0.14, '--cx-button-bg': 0.1,
    '--cx-button-hover': 0.18, '--cx-button-active': 0.24, '--cx-button-border': 0.16, '--cx-button-border-hover': 0.3,
    '--cx-input-border': 0.14, '--cx-table-row-hover': 0.08, '--cx-table-row-alt': 0.03, '--cx-table-border': 0.1,
    '--cx-badge-bg': 0.12, '--cx-badge-border': 0.18, '--cx-scrollbar-thumb': 0.22
  };

  /** Glass overrides for a completed custom token set; opacity is the Transparency slider (0.1-1). */
  function props(c, opacity = 0.65) {
    if (!isHex(c?.surface) || !isHex(c?.canvas) || !isHex(c?.textPrimary)) return {};
    const a = Number.isFinite(opacity) ? opacity : 0.65;
    const out = {
      '--cx-surface-bg': at(c.surface, a * FILL.surface), '--cx-card-bg': at(c.surface, a * FILL.surface),
      '--cx-surface-secondary': at(c.surfaceSecondary || c.surface, a * FILL.secondary),
      '--cx-surface-elevated': at(c.surfaceElevated || c.surface, a * FILL.elevated),
      '--cx-nav-bg': at(c.canvas, a * FILL.nav), '--cx-input-bg': at(c.canvas, a * FILL.input),
      '--cx-table-header-bg': at(c.surfaceSecondary || c.surface, a * FILL.header),
      '--cx-nav-item-active': at(c.canvas, 0.3), '--cx-scrollbar-track': at(c.canvas, 0.5),
      '--cx-shadow-sm': '0 2px 8px rgba(0, 0, 0, 0.25)', '--cx-shadow-md': '0 8px 32px rgba(0, 0, 0, 0.35)',
      '--cx-shadow-lg': '0 16px 48px rgba(0, 0, 0, 0.45)'
    };
    for (const [prop, strength] of Object.entries(OVERLAY)) out[prop] = at(c.textPrimary, strength);
    return out;
  }

  window.ConnectifyThemeGlassTokens = { props, PROPS: [...Object.keys(OVERLAY), '--cx-shadow-sm', '--cx-shadow-md', '--cx-shadow-lg'] };
})();

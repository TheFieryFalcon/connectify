/**
 * Connectify Theme: surface adapter
 *
 * Tags Connect surfaces that keep a hard-coded light background (data-connectea-surface) and the
 * dark text on them (data-connectea-ink) so dark themes can restyle them without inline styles.
 * Exposes window.ConnectifyThemeSurfaceAdapter.
 */
(() => {
  'use strict';

  const SURFACE_TARGETS = [
    'header', 'nav', 'aside', '.v-panel', '.v-panel-content', '.eds-c-card', '.cvr-c-promo', '.cvr-c-heading-bar',
    '.cvr-c-page-header', '.cvr-c-report-years', '.cvr-c-year-selector', '.eds-c-tile__action', '.eds-c-standard-button',
    'mat-toolbar', 'mat-tab-header', '.mat-toolbar', '.mat-tab-header', '.eds-c-nav-list', '.eds-c-nav-list__item',
    '.portlet', '.portlet-content', '.portlet-body', '.journal-content-article', '.eds-c-tile__body', '.cvr-c-tile__body',
    '[class*="help"]', '[class*="guide"]', '[class*="resource"]'
  ].join(', ');

  const INK_TARGETS = 'p, span, div, h1, h2, h3, h4, h5, h6, label, strong, a, button, li, i';

  // Connectify UI, charts, the navbar and Connect's own session alerts are never adapted
  const OUTSIDE_PROTECTED_AREAS = [
    ':not(.cvr-c-primary-navigation *)', ':not(.cvr-c-header *)', ':not(#connectify-sidebar *)', ':not(#connectea-theme-toggle)',
    ':not(.connectea-panel *)', ':not(.cvr-c-task__chart *)', ':not(.highcharts-container *)', ':not(#cx-expand-progress)',
    ':not(#cx-expand-progress *)', ':not(.v-Notification-system)', ':not(.v-Notification-system *)'
  ].join('');

  const SURFACE_SELECTOR = `:is(${SURFACE_TARGETS}):not([data-connectea-surface]):not(.cvr-c-primary-navigation):not(.cvr-c-header)${OUTSIDE_PROTECTED_AREAS}`;
  const INK_SELECTOR = `[data-connectea-surface] :is(${INK_TARGETS}):not([data-connectea-ink])${OUTSIDE_PROTECTED_AREAS}`;

  const SKIP_ANCESTORS = [
    '.cvr-c-task__chart', '.highcharts-container', '#cx-expand-progress', '.cvr-c-primary-navigation', '.cvr-c-header',
    '.cvr-c-classes__sort', '.cvr-c-sort-by', '.eds-c-sort-by', '[class*="timeout"]', '[class*="session"]', '[id*="timeout"]',
    '[id*="session"]', '.popup-alert-notice', '.popup-alert-warning', '.v-Notification-system'
  ].join(', ');

  function parseRgb(value, allowTranslucent = false) {
    if (!value) return null;
    const match = value.match(/^rgba?\(([^)]+)\)/);
    if (!match) return null;
    const parts = match[1].split(',').map(Number);
    return (parts.length === 4 && (parts[3] === 0 || (!allowTranslucent && parts[3] < 0.9))) ? null : parts.slice(0, 3);
  }

  const isNeutralColor = rgb => rgb && Math.max(...rgb) - Math.min(...rgb) < 24;

  function isDarkColor(rgb) {
    if (!rgb) return false;
    const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
    const isConnectRed = Math.abs(rgb[0] - 127) < 15 && Math.abs(rgb[1] - 55) < 15 && Math.abs(rgb[2] - 92) < 15;
    return lum < 135 || (isNeutralColor(rgb) && Math.max(...rgb) < 140) || isConnectRed;
  }

  function adaptSurfaces() {
    const isDark = document.documentElement.classList.contains('connectea-dark');
    if (!isDark || window.ConnectifyThemeAuth?.isAuthDisabled()) return;
    try {
      for (const el of document.body.querySelectorAll(SURFACE_SELECTOR)) {
        if (el.closest(SKIP_ANCESTORS) || el.matches('.portlet, .portlet-boundary, .portlet-layout, #main-content')) continue;
        const bgRgb = parseRgb(window.getComputedStyle(el).backgroundColor);
        if (isNeutralColor(bgRgb) && Math.min(...bgRgb) > 165) el.setAttribute('data-connectea-surface', '');
      }
      for (const el of document.querySelectorAll(INK_SELECTOR)) {
        if (el.children.length > 2 || el.hasAttribute('data-connectea-surface') || el.closest(SKIP_ANCESTORS)) continue;
        const fgRgb = parseRgb(window.getComputedStyle(el).color, true);
        if (isDarkColor(fgRgb)) el.setAttribute('data-connectea-ink', '');
      }
    } catch {}
  }

  window.ConnectifyThemeSurfaceAdapter = { adaptSurfaces, parseRgb, isDarkColor, SURFACE_SELECTOR, INK_SELECTOR };
})();

/**
 * Connectify Theme: surface adapter
 *
 * Tags Connect surfaces that keep a hard-coded light background (data-connectea-surface) and the
 * dark text on them (data-connectea-ink) so dark themes can restyle them without inline styles.
 * A theme change scans the whole page; a page change scans only the subtrees it added or re-classed
 * (a whole-page scan, with a computed style per candidate, after every tooltip or row change made every
 * interaction lag). Exposes window.ConnectifyThemeSurfaceAdapter.
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

  // Every element matching selector in roots (the roots included), or in the whole page without roots
  function* candidates(roots, selector) {
    if (!roots) { yield* document.body.querySelectorAll(selector); return; }
    for (const root of roots) {
      if (!root.isConnected) continue;
      if (root.matches(selector)) yield root;
      yield* root.querySelectorAll(selector);
    }
  }

  /** Tags light surfaces and the dark ink on them, in roots (elements) or, without roots, the whole page. */
  function adaptSurfaces(roots) {
    const isDark = document.documentElement.classList.contains('connectea-dark');
    if (!isDark || window.ConnectifyThemeAuth?.isAuthDisabled()) return;
    try {
      for (const el of candidates(roots, SURFACE_SELECTOR)) {
        if (el.closest(SKIP_ANCESTORS) || el.matches('.portlet, .portlet-boundary, .portlet-layout, #main-content')) continue;
        const bgRgb = parseRgb(window.getComputedStyle(el).backgroundColor);
        if (isNeutralColor(bgRgb) && Math.min(...bgRgb) > 165) el.setAttribute('data-connectea-surface', '');
      }
      for (const el of candidates(roots, INK_SELECTOR)) {
        if (el.children.length > 2 || el.hasAttribute('data-connectea-surface') || el.closest(SKIP_ANCESTORS)) continue;
        const fgRgb = parseRgb(window.getComputedStyle(el).color, true);
        if (isDarkColor(fgRgb)) el.setAttribute('data-connectea-ink', '');
      }
    } catch {}
  }

  // Past this many changed subtrees one page scan is cheaper
  const MAX_ROOTS = 150;

  const outermost = list => list.filter(el => !list.some(other => other !== el && other.contains(el)));

  /** Elements the mutation records added or re-classed, outermost only (removals need no scan). */
  function rootsOf(records) {
    const roots = new Set();
    for (const r of records) {
      if (r.type === 'attributes') roots.add(r.target);
      else for (const n of r.addedNodes) if (n.nodeType === 1) roots.add(n);
    }
    return outermost([...roots]);
  }

  // Subtrees waiting to be adapted; null is the whole page
  let pending = [];
  let adaptTimer = null;
  const pageStartTime = Date.now();

  /** Adapts after delay (1.2s while the page starts, else 400ms): the records' subtrees, or the whole page without records. */
  function schedule(delay, records) {
    if (window.ConnectifyIsAccordionAnimating || window.ConnectifyIsBulkExpanding) return;
    if (!records) pending = null;
    else if (pending) pending.push(...rootsOf(records));
    if (pending && pending.length > MAX_ROOTS) pending = null;
    if (pending && !pending.length) return;
    clearTimeout(adaptTimer);
    const effectiveDelay = delay ?? (Date.now() - pageStartTime < 2500 ? 1200 : 400);
    adaptTimer = setTimeout(() => {
      if (window.ConnectifyIsAccordionAnimating || window.ConnectifyIsBulkExpanding) return;
      const roots = pending;
      pending = [];
      adaptSurfaces(roots ? outermost([...new Set(roots)]) : undefined);
    }, effectiveDelay);
  }

  window.ConnectifyThemeSurfaceAdapter = { adaptSurfaces, schedule, rootsOf, parseRgb, isDarkColor, SURFACE_SELECTOR, INK_SELECTOR };
})();

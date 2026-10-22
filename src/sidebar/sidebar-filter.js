/**
 * Connectify Sidebar: outline filter detection
 *
 * Connectify's tools need every course outline on the page. Detects when a Connect filter (or a
 * different year) hides courses, builds the notice shown in the sidebar, and clicks Connect's own
 * "All" filter to recover. Exposes window.ConnectifySidebarFilter.
 */
(() => {
  'use strict';

  // Connect's filter menu is an accordion: a top-level "All" heading, then "Semester 1 Classes" /
  // "Semester 2 Classes" sections whose tree lists start with their own "All" (that semester only)
  const ALL_FILTER_SELECTORS = [
    '.eds-c-accordion--dark .eds-c-accordion__section-label', '.eds-c-accordion--dark .eds-c-accordion__section-heading',
    '.eds-c-accordion__section-label', '.eds-c-accordion__section-heading',
    '.cvr-c-category-toolbar__container .v-label', '.cvr-c-category-toolbar .v-label', '.v-accordion .v-label', '[role="button"]'
  ];
  // A semester section's "All" and Connectify's own UI are never the top-level filter
  const NOT_TOP_LEVEL = '.eds-c-accordion__panel, .cvr-c-tree-list, .cvr-c-tree-list__item, #connectify-sidebar, #cx-semester-notice';

  /** The innermost element of the top-level "All" filter (a wrapper around it reads "All" too), or null. */
  function findAllFilter() {
    for (const sel of ALL_FILTER_SELECTORS) {
      const matches = Array.from(document.querySelectorAll(sel))
        .filter(el => (el.innerText || el.textContent || '').trim().toLowerCase() === 'all' && !el.closest?.(NOT_TOP_LEVEL));
      const match = matches.find(el => !matches.some(other => other !== el && el.contains?.(other)));
      if (match) return match;
    }
    return null;
  }

  // Vaadin's layout click listeners fire on a mousedown + mouseup pair on one target and ignore a bare
  // click(), so a whole press is dispatched, once: an accordion heading toggles on every press
  function press(el) {
    const rect = el.getBoundingClientRect?.() || { left: 0, top: 0, width: 0, height: 0 };
    const at = { bubbles: true, cancelable: true, button: 0, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
    const fire = (Type, type, extra) => {
      try { el.dispatchEvent(new Type(type, { ...at, ...extra })); } catch {}
    };
    const Mouse = window.MouseEvent || window.Event;
    const Pointer = window.PointerEvent;
    if (Pointer) fire(Pointer, 'pointerdown', { buttons: 1, isPrimary: true, pointerType: 'mouse' });
    fire(Mouse, 'mousedown', { buttons: 1 });
    if (Pointer) fire(Pointer, 'pointerup', { buttons: 0, isPrimary: true, pointerType: 'mouse' });
    fire(Mouse, 'mouseup', { buttons: 0 });
    fire(Mouse, 'click', { buttons: 0 });
  }

  /** Presses Connect's "All" category filter; returns whether one was found. */
  function clickConnectAllButton() {
    const match = findAllFilter();
    if (!match) return false;
    press(match);
    return true;
  }

  /** The name of the Connect outline filter applied (e.g. a class), or '' when showing All. */
  function activeFilterTitle() {
    const toolbarTitle = (document.querySelector('.cvr-c-category-toolbar__title .v-label, .cvr-c-category-toolbar__title')?.textContent || '').trim();
    return toolbarTitle.toLowerCase() === 'all' ? '' : toolbarTitle;
  }

  /** True on the outlines page when a filter is applied or fewer than four courses are visible. */
  function isOutlinesFilterRestricted() {
    const outlinesRoot = document.querySelector('.assessmentoutlinesui, [class*="assessmentoutline"], .cvr-c-category-toolbar, .eds-c-accordion--dark');
    if (!outlinesRoot) return false;
    const tiles = document.querySelectorAll('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile, [class*="subject-card"]');
    return Boolean(activeFilterTitle()) || tiles.length < 4;
  }

  /** The sidebar notice with a "Back to All" button; onBackToAll runs after the filter is cleared. */
  function createFilterNotice(onBackToAll) {
    const make = (tag, className, text) => Object.assign(document.createElement(tag), { className, textContent: text || '' });
    const notice = make('div', 'cx-filter-notice');
    notice.hidden = true;
    const backToAllBtn = Object.assign(make('button', 'cx-back-to-all-btn', '← Back to All'), {
      type: 'button',
      id: 'cx-back-to-all-btn',
      onclick: e => {
        e.preventDefault();
        e.stopPropagation();
        clickConnectAllButton();
        onBackToAll?.();
      }
    });
    notice.append(
      make('strong', 'cx-filter-title', 'Filter Applied'),
      make('p', 'cx-filter-text', 'A course outline filter is currently active. Connectify features require all courses to be visible. Please return to "All" to re-enable tools.'),
      backToAllBtn
    );
    return notice;
  }

  window.ConnectifySidebarFilter = { findAllFilter, clickConnectAllButton, activeFilterTitle, isOutlinesFilterRestricted, createFilterNotice };
})();

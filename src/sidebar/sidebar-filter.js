/**
 * Connectify Sidebar: outline filter detection
 *
 * Connectify's tools need every course outline on the page. Detects when a Connect filter (or a
 * different year) hides courses, builds the notice shown in the sidebar, and clicks Connect's own
 * "All" filter to recover. Exposes window.ConnectifySidebarFilter.
 */
(() => {
  'use strict';

  const ALL_FILTER_SELECTORS = [
    '.eds-c-accordion--dark .eds-c-accordion__section-label', '.eds-c-accordion--dark .eds-c-accordion__section-heading',
    '.eds-c-accordion__section-label', '.eds-c-accordion__section-heading',
    '.cvr-c-category-toolbar__container .v-label', '.cvr-c-category-toolbar .v-label',
    '.cvr-c-tree-list__item .v-label', '.cvr-c-tree-list__item', '.v-accordion .v-label', '[role="button"]'
  ];

  /** Clicks Connect's "All" category filter; returns whether one was found. */
  function clickConnectAllButton() {
    for (const sel of ALL_FILTER_SELECTORS) {
      const match = Array.from(document.querySelectorAll(sel)).find(el => (el.innerText || el.textContent || '').trim().toLowerCase() === 'all');
      if (!match) continue;
      match.click();
      if (match.parentElement && typeof match.parentElement.click === 'function' && match.parentElement !== document.body) {
        match.parentElement.click();
      }
      try {
        const Evt = window.MouseEvent || window.Event;
        if (typeof Evt === 'function') match.dispatchEvent(new Evt('click', { bubbles: true, cancelable: true }));
      } catch {}
      return true;
    }
    return false;
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

  window.ConnectifySidebarFilter = { clickConnectAllButton, activeFilterTitle, isOutlinesFilterRestricted, createFilterNotice };
})();

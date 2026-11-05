/**
 * Connectify Cohort: no statistics on Certificate and General courses
 *
 * The Settings option (connectify:hide_course_stats, off by default) leaves every class with Certificate or General
 * in its name as Connect drew it: no statistics or prediction panels, Type dropdowns, meters or goal bars on its
 * rows, and no restored overall row. Only the outline rows change; the sidebar tools still read these classes.
 * Exposes window.ConnectifyCourseFilter.
 */
(() => {
  'use strict';

  const KEY = 'connectify:hide_course_stats';
  const COURSE = /\b(?:certificate|general)\b/i;
  const CARD = '.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile';
  const TITLE = '.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading';
  const OWN_UI = '.connectea-row-wrapper, .connectea-panel, .connectea-subject-average-row, .connectea-xp-fit-probe';

  function isEnabled() {
    try {
      return localStorage.getItem(KEY) === 'true';
    } catch {
      return false;
    }
  }

  function save(enabled) {
    try {
      if (enabled) localStorage.setItem(KEY, 'true');
      else localStorage.removeItem(KEY);
    } catch {}
  }

  const matches = title => COURSE.test(title || '');

  /** Whether this card's rows stay as Connect drew them. */
  const hides = card => isEnabled() && matches(card.querySelector(TITLE)?.textContent);

  const hidesRow = row => {
    const card = row.closest(CARD);
    return Boolean(card) && hides(card);
  };

  /** Removes what Connectify added to a card's rows (the option was turned on with the outlines open). */
  function clear(card) {
    card.querySelectorAll(OWN_UI).forEach(el => el.remove());
  }

  window.ConnectifyCourseFilter = { KEY, isEnabled, save, matches, hides, hidesRow, clear };
})();

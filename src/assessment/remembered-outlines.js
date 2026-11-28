/**
 * Connectify Assessment: remembered outlines when Connect shows none
 *
 * Connect shows "No Assessment Outlines available." at times (exam weeks), when its API returns no outlines. The
 * outline records kept through the year (year-capsule.js, connectify:outline_records:<account>) then stand in for
 * Connect's: outline-api.js serves them as the load, legacy-outlines.js draws them in Connect's zone and
 * remembered-outlines.css hides Connect's notice, so the page and every tool show the year as Connectify last saw it,
 * under a notice with the date they were kept (past-year-bar.js, savedAt()).
 * With nothing remembered nothing is drawn and Connect's notice stays. Nothing in a remembered load is new, so it
 * never decides a new year, refreshes when the classes were last seen, is kept again, or raises a grade toast.
 * Loaded before outline-api.js. Exposes window.ConnectifyRememberedOutlines.
 */
(() => {
  'use strict';
  if (window.ConnectifyRememberedOutlines) return;

  const ATTR = 'data-cx-remembered-outlines';
  let active = false;
  let savedAt = null;

  const read = () => {
    try { return JSON.parse(localStorage.getItem(`connectify:outline_records:${window.ConnectifyUtils.accountKey()}`) || 'null'); } catch { return null; }
  };

  /** The outline records kept through the year for the student in view, or [] when none are. */
  function records() {
    const saved = read();
    return Array.isArray(saved?.records) ? saved.records.filter(r => r?.subject) : [];
  }

  /** Connect's records from a load, or, when Connect has none, the remembered ones (marking the page as showing them). */
  function standIn(loaded) {
    if (loaded.length) return loaded;
    const saved = records();
    if (!saved.length) return loaded;
    active = true;
    savedAt = Number(read()?.savedAt) || null;
    document.documentElement.setAttribute(ATTR, '');
    return saved;
  }

  window.ConnectifyRememberedOutlines = { ATTR, records, standIn, active: () => active, savedAt: () => savedAt };
})();

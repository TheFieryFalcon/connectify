/**
 * Connectify Cohort: "Hide potentially inaccurate prediction bars"
 *
 * The Settings option (connectify:hide_early_meters, off by default, 'true' once on). Off, a subject's outcome meters
 * start from its second marked result; on, from its fourth, since a prediction from one or two results is too unsure
 * to judge a mark by (a 100% then an 87% read red in the top fifth). A numeric subject baseline shows them either way.
 * Exposes window.ConnectifyEarlyMeters.
 */
(() => {
  'use strict';

  const KEY = 'connectify:hide_early_meters';

  function isEnabled() {
    try {
      return localStorage.getItem(KEY) === 'true';
    } catch {
      return false;
    }
  }

  function save(enabled) {
    try { localStorage.setItem(KEY, enabled ? 'true' : 'false'); } catch {}
  }

  /** Earlier marked results a subject needs before a meter shows: 1, or 3 with the option on. */
  const minPriorResults = () => (isEnabled() ? 3 : 1);

  window.ConnectifyEarlyMeters = { KEY, isEnabled, save, minPriorResults };
})();

/**
 * Connectify Past Years: which year this tab shows
 *
 * Viewing a past year (Past Years in the sidebar) runs the whole extension on a copy of that year's data, so the
 * outlines and every tool look as they did at its end and nothing reaches this year's. The choice is kept per tab in
 * sessionStorage (connectify:past_year: { id, year, label, savedAt }) and only holds on Assessment Outlines: any other
 * page ends it, so the notice over the outlines can never be wrong. While it holds, ConnectifyUtils.accountKey()
 * carries suffix() (`~p<id>`), so every per-student key resolves to the copy year-capsule.js wrote, and year() /
 * today() stand for that year's last day wherever the date decides something (term weeks, Early Easter, semesters,
 * year-keyed settings). Loaded right after the scheduler, before utils.js. Exposes window.ConnectifyPastYearMode.
 */
(() => {
  'use strict';
  if (window.ConnectifyPastYearMode) return;

  const KEY = 'connectify:past_year';
  const OUTLINES_PATH = '/group/students/ui/my-settings/assessment-outlines';
  const SUFFIX = '~p';

  const onOutlines = () => {
    try { return new URL(location.href).pathname.startsWith(OUTLINES_PATH); } catch { return false; }
  };

  function read() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      return saved && /^[a-z0-9]+$/i.test(saved.id || '') && Number.isInteger(saved.year) ? saved : null;
    } catch {
      return null;
    }
  }

  let state = read();
  // Leaving the outlines ends the view: coming back shows this year again
  if (state && !onOutlines()) {
    try { sessionStorage.removeItem(KEY); } catch {}
    state = null;
  }
  if (state && typeof document !== 'undefined') document.documentElement?.setAttribute('data-cx-past-year', state.id);

  /** Starts viewing a past year in this tab (the caller writes its copy first, then reloads or opens the outlines). */
  function enter(info) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ id: info.id, year: info.year, label: info.label, savedAt: info.savedAt || null }));
      return true;
    } catch {
      return false;
    }
  }

  function exit() {
    try { sessionStorage.removeItem(KEY); } catch {}
  }

  const active = () => Boolean(state);
  // The last day of the year shown: its Semester 2, its holidays after the last task; else mock outlines' own week
  const today = () => (state ? new Date(state.year, 11, 31, 12) : (window.ConnectifyMockOutlines?.today() || new Date()));

  window.ConnectifyPastYearMode = {
    KEY,
    SUFFIX,
    active,
    entry: () => state,
    suffix: () => (state ? `${SUFFIX}${state.id}` : ''),
    year: () => (state ? state.year : new Date().getFullYear()),
    today,
    enter,
    exit
  };
})();

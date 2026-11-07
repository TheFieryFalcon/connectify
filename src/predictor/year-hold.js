/**
 * Connectify Predictor: a new year waits until the old one is over
 *
 * Connect hides a year's outlines at times, exam weeks above all ("No Assessment Outlines available."), and Year 12
 * courses start in Term 4, so a load showing only next year's classes can come while this year's are only hidden,
 * before their exam marks. A wholly new class set rolls the year over (year-rollover.js) only once the old year is
 * over: every old class's latest outline shows its final letter, or the old classes were last seen HOLD_DAYS ago,
 * longer than any exam block. A load with fewer than MIN_CLASSES classes (Connect's empty state) decides nothing.
 * Exposes window.ConnectifyYearHold.
 */
(() => {
  'use strict';
  if (window.ConnectifyYearHold) return;

  const DAY_MS = 24 * 60 * 60 * 1000;
  const HOLD_DAYS = 21;
  const MIN_CLASSES = 2;

  /** Whether a load names enough classes to say which year the page shows. */
  const decides = names => (names?.length || 0) >= MIN_CLASSES;

  /** When the old year's classes were last on the page: the snapshot's seenAt, else when its averages were saved. */
  const lastSeen = state => {
    const at = Number(state?.seenAt ?? state?.snapshot?.savedAt);
    return Number.isFinite(at) && at > 0 ? at : null;
  };

  /** Whether every class the registry holds of these names shows its final letter on its latest outline. */
  function finalLetters(classNames, registry) {
    const entries = (classNames || []).map(name => registry?.[name]).filter(Boolean);
    return entries.length > 0 && entries.every(sems => Boolean((sems[2] || sems[1])?.finalLetter));
  }

  /** Whether the year the snapshot holds is over, so a wholly new class set may roll it over. */
  function isOver(state, { registry = window.ConnectifyClassSemesters?.get?.() || {}, now = Date.now() } = {}) {
    if (finalLetters(state?.classNames, registry)) return true;
    const seen = lastSeen(state);
    return seen === null || now - seen >= HOLD_DAYS * DAY_MS;
  }

  /**
   * The names of a load that belong to the snapshot's year: next year's classes shown beside this year's (Year 12
   * courses from Term 4) never join it, so the year still rolls over once this year's classes are gone.
   */
  function sameYearNames(liveNames, state) {
    const marker = window.ConnectifyYearArchive?.yearMarker;
    if (!marker || !state?.classNames?.length) return liveNames;
    const year = marker(state.classNames);
    return liveNames.filter(name => {
      const own = marker([name]);
      if (year.calendar && own.calendar) return own.calendar <= year.calendar;
      if (year.level && own.level) return own.level <= year.level;
      return true;
    });
  }

  window.ConnectifyYearHold = { HOLD_DAYS, MIN_CLASSES, decides, lastSeen, finalLetters, isOver, sameYearNames };
})();

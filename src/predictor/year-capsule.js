/**
 * Connectify Past Years: saving the year as it stands
 *
 * Past Years draws a finished year from Connect's own outline records, so the records of every load this year are
 * kept (connectify:outline_records:<account>: { classNames, records, savedAt }), outside the results cache, so neither
 * a cache version bump nor Clear Cache can lose them. A load whose classes are all new is the next year: its records
 * wait until the rollover has taken last year's (takeRecords, from year-rollover.js), unless the year snapshot
 * already holds those classes. settings() is the year's per-student keys the rollover archives with them (task types,
 * week overrides, calibration and calculators, baselines, cohort sizes), {account}-templated like a backup.
 * Exposes window.ConnectifyYearCapsule.
 */
(() => {
  'use strict';
  if (window.ConnectifyYearCapsule) return;

  const PREFIX = 'connectify:outline_records:';
  const utils = window.ConnectifyUtils;
  const key = () => `${PREFIX}${utils.accountKey()}`;
  const readJson = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
  const classesOf = records => [...new Set(records.map(r => r?.subject).filter(Boolean))];
  const overlaps = (a, b) => (a || []).some(name => (b || []).includes(name));
  const taskCount = r => (r?.outlines || []).reduce((n, o) => n + (o?.tasks?.length || 0), 0);

  /**
   * This year's records after a load: Connect hides outlines at times (exam weeks), so a load never drops a class
   * the year's records hold, and a record without tasks never replaces one with them. Connect's order first.
   */
  function mergeRecords(saved, fresh) {
    const before = new Map((saved || []).map(r => [r?.title, r]));
    const titles = new Set(fresh.map(r => r?.title));
    const kept = fresh.map(r => (!taskCount(r) && taskCount(before.get(r?.title)) ? before.get(r.title) : r));
    return [...kept, ...(saved || []).filter(r => !titles.has(r?.title))];
  }

  /** Keeps Connect's outline records from this load (merged into the year's), unless they are a new year's waiting for the rollover. */
  function capture() {
    if (window.ConnectifyPastYearMode?.active() || !utils.isOutlinesPage()) return false;
    const loaded = window.ConnectifyOutlineApi?.records?.() || [];
    if (!loaded.length) return false;
    const saved = readJson(key());
    const snapshot = readJson(`connectify:year_snapshot:${utils.accountKey()}`);
    const sameYear = overlaps(classesOf(loaded), saved?.classNames);
    if (saved?.classNames?.length && !sameYear && !overlaps(classesOf(loaded), snapshot?.classNames)) return false;
    const records = sameYear && Array.isArray(saved.records) ? mergeRecords(saved.records, loaded) : loaded;
    if (saved && JSON.stringify(saved.records) === JSON.stringify(records)) return false;
    try {
      localStorage.setItem(key(), JSON.stringify({ classNames: classesOf(records), records, savedAt: Date.now() }));
      return true;
    } catch {
      return false;
    }
  }

  /** Last year's records for the rollover's archive (those of classNames), removed once taken; null when none were kept. */
  function takeRecords(classNames) {
    const saved = readJson(key());
    if (!Array.isArray(saved?.records) || !overlaps(saved.classNames, classNames)) return null;
    try { localStorage.removeItem(key()); } catch {}
    // Next year's classes shown beside last year's (Year 12 courses from Term 4) stay out of last year
    const keep = new Set(window.ConnectifyYearHold?.sameYearNames?.(classesOf(saved.records), { classNames }) || classesOf(saved.records));
    return saved.records.filter(r => keep.has(r?.subject));
  }

  /** The year's per-student settings, as { templatedKey: raw value }. */
  function settings() {
    const sections = window.ConnectifyBackupSections;
    if (!sections) return {};
    const own = sections.collect(['types', 'weeks', 'calibration', 'baselines']);
    // Of the preferences, only the student's cohort sizes belong to the year
    for (const [k, raw] of Object.entries(sections.collect(['preferences']))) if (k.includes(sections.ACCOUNT)) own[k] = raw;
    return own;
  }

  window.addEventListener('connectify-outlines-loaded', () => setTimeout(capture, 0));

  window.ConnectifyYearCapsule = { PREFIX, key, capture, mergeRecords, takeRecords, settings };
})();

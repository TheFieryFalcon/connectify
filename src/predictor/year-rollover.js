/**
 * Connectify Predictor: new school year baselines
 *
 * Keeps a snapshot of this year's assessment type and subject averages. When every class on the
 * assessment outlines page has a new name (a new school year), the snapshot becomes the previous-year
 * baselines for the assessment types and subjects still present, and last year's cached results are
 * cleared. Viewing an earlier year never triggers it. Exposes window.ConnectifyYearRollover.
 */
(() => {
  'use strict';

  const TILE_SELECTOR = '.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile';
  const TITLE_SELECTOR = '.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading';
  const { normalize, accountKey } = window.ConnectifyUtils;
  const stateKey = () => `connectify:year_snapshot:${accountKey()}`;
  const round1 = n => Math.round(n * 10) / 10;

  /** Class names on the page without the semester suffix, e.g. "12 Chemistry ATAR". */
  function liveClassNames() {
    const names = new Set();
    for (const tile of document.querySelectorAll(TILE_SELECTOR)) {
      const title = normalize(tile.querySelector(TITLE_SELECTOR)?.textContent || tile.getAttribute('data-subject-title') || '');
      const name = title.replace(/\s*[-–—]\s*(Semester|Sem)\s*[12].*$/i, '').trim();
      if (name) names.add(name);
    }
    return Array.from(names);
  }

  /** Year-independent subject identity: "12 Chemistry ATAR" and "Chemistry ATAR Year 11" give "chemistry". */
  function subjectKey(name) {
    return String(name || '').toLowerCase()
      .replace(/\s*[-–—]\s*(semester|sem)\s*[12].*$/i, '')
      .replace(/\b(atar|year\s*\d{1,2}|20\d{2})\b/g, ' ')
      .replace(/\b\d{1,2}\b/g, ' ')
      .replace(/[^a-z0-9&]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Highest calendar year and school year level named in class titles (null when absent). */
  function yearMarker(names) {
    let calendar = null;
    let level = null;
    for (const name of names) {
      for (const m of name.matchAll(/\b(20\d{2})\b/g)) calendar = Math.max(calendar ?? 0, Number(m[1]));
      const lv = name.match(/\byear\s*(\d{1,2})\b/i) || name.match(/^(\d{1,2})\s/);
      if (lv) level = Math.max(level ?? 0, Number(lv[1]));
    }
    return { calendar, level };
  }

  const signature = names => [...names].sort().join('|');

  /**
   * Decides what a page load means. Returns 'first' (nothing stored), 'same' (some class names match),
   * 'new-year' (all names changed to a later or never-seen year) or 'other-year' (an earlier year).
   */
  function classifyYear(liveNames, state) {
    if (!state?.classNames?.length) return 'first';
    if (liveNames.some(n => state.classNames.includes(n))) return 'same';
    const now = yearMarker(liveNames);
    const before = yearMarker(state.classNames);
    if (now.calendar && before.calendar) return now.calendar > before.calendar ? 'new-year' : 'other-year';
    if (now.level && before.level) return now.level > before.level ? 'new-year' : 'other-year';
    return (state.seen || []).includes(signature(liveNames)) ? 'other-year' : 'new-year';
  }

  /** This year's averages: per assessment type, and per subject keyed by subjectKey(). */
  function currentAverages(subjects) {
    const history = window.ConnectifyPredictorHistory?.getHistoricalData?.(subjects) || {};
    const types = {};
    for (const [type, avg] of Object.entries(history.types || {})) if (Number.isFinite(avg)) types[type] = avg;
    const bySubject = {};
    for (const [name, avg] of Object.entries(history.subjects || {})) if (Number.isFinite(avg)) bySubject[subjectKey(name)] = avg;
    // Connect's own running subject marks (kept by the grade-change notifier) are the most accurate
    try {
      const grades = JSON.parse(localStorage.getItem(`connectify:grade_cache:${accountKey()}`) || '{}');
      for (const [name, entry] of Object.entries(grades || {})) if (Number.isFinite(entry?.mark)) bySubject[subjectKey(name)] = entry.mark;
    } catch {}
    return { types, subjects: bySubject };
  }

  /** Builds the new baselines: last year's averages for types and subjects that still exist. */
  function rolledBaselines(snapshot, liveNames, baselines, categoryNames) {
    const types = { ...(baselines.types || {}) };
    const subjects = { ...(baselines.subjects || {}) };
    let typeCount = 0;
    let subjectCount = 0;
    for (const [type, value] of Object.entries(snapshot.types || {})) {
      if (categoryNames.has(type)) { types[type] = round1(value); typeCount++; }
    }
    for (const name of liveNames) {
      const value = snapshot.subjects?.[subjectKey(name)];
      if (Number.isFinite(value)) { subjects[name] = round1(value); subjectCount++; }
    }
    return { types, subjects, typeCount, subjectCount };
  }

  function loadState() {
    try { return JSON.parse(localStorage.getItem(stateKey()) || 'null'); } catch { return null; }
  }

  function saveState(state) {
    try { localStorage.setItem(stateKey(), JSON.stringify(state)); } catch {}
  }

  function rollOver(snapshot, liveNames) {
    const store = window.ConnectifyPredictorBaselines;
    if (!store) return;
    const current = store.getBaselines();
    try { localStorage.setItem(`connectify:baseline_backup:${accountKey()}`, JSON.stringify(current)); } catch {}
    const categoryNames = new Set([...Object.keys(window.ConnectifyCategoryStore?.defaultCategories || {}), ...Object.keys(window.cxCategories || {})]);
    const next = rolledBaselines(snapshot, liveNames, current, categoryNames);
    // Last year's scraped results and grade cache belong to classes that are gone
    window.ConnectifyCache?.clearResultsCache?.();
    store.saveBaselines({ types: next.types, subjects: next.subjects });
    window.ConnectifyNotifications?.show?.({
      id: 'cx-new-year-baselines',
      type: 'info',
      title: 'New school year',
      message: `Last year's averages were added as baselines for ${next.subjectCount} subject(s) and ${next.typeCount} assessment type(s). You can change them in Settings.`
    });
  }

  function check() {
    if (window.ConnectifySidebarFilter?.isOutlinesFilterRestricted?.()) return;
    const liveNames = liveClassNames();
    if (liveNames.length < 2) return;
    const state = loadState() || { classNames: [], seen: [], snapshot: null };
    const sig = signature(liveNames);
    const kind = classifyYear(liveNames, state);
    if (kind === 'other-year') return;

    if (kind === 'new-year') {
      if (state.snapshot) rollOver(state.snapshot, liveNames);
      saveState({ classNames: liveNames, seen: [...new Set([...(state.seen || []), signature(state.classNames), sig])].slice(-8), snapshot: null });
      return;
    }

    // Same year (or first visit): remember the classes and refresh the snapshot from completed results
    const subjects = (window.ConnectifyData?.collect?.(true) || []).filter(s => liveNames.includes(s.name));
    const averages = currentAverages(subjects);
    const hasAverages = Object.keys(averages.types).length > 0 || Object.keys(averages.subjects).length > 0;
    saveState({
      classNames: [...new Set([...(state.classNames || []), ...liveNames])],
      seen: [...new Set([...(state.seen || []), sig])].slice(-8),
      snapshot: hasAverages ? { ...averages, savedAt: Date.now() } : state.snapshot
    });
  }

  let timer = null;
  const scheduleCheck = (delay = 2000) => {
    clearTimeout(timer);
    timer = setTimeout(() => { try { check(); } catch {} }, delay);
  };
  window.addEventListener('connectify-results-updated', () => scheduleCheck());
  scheduleCheck(4000);

  window.ConnectifyYearRollover = { check, subjectKey, yearMarker, classifyYear, currentAverages, rolledBaselines };
})();

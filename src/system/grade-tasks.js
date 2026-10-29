/**
 * Connectify grade change detection: newly marked tasks
 *
 * The running mark can stay put when a new result lands on the student's average, so each outline's marked
 * task ids (ConnectifyParseHelpers ids: every outline from Connect's API once loaded, outline-api.js; else
 * whenever an outline's task rows are on screen: the student opened it, Expand All, auto-expand) are
 * compared with the ones saved for that card's semester in connectify:grade_cache:<student>
 * (entry.tasks[semester]). More newly marked ids than vanished ones is a new result (a renamed task swaps
 * one id for another); a card never seen before is saved quietly.
 * Runs once new-grade.js has checked the marks (start()). Exposes window.ConnectifyGradeTasks.
 */
(() => {
  'use strict';

  if (window.ConnectifyGradeTasks) return;

  const { normalize } = window.ConnectifyUtils;
  const snapshot = window.ConnectifyGradeSnapshot;

  // Rows render over several frames, and an Expand All runs for a while: compare once they settle
  const SETTLE_MS = 1500;

  /** Ids of the card's marked task rows, or null when its rows are not on screen. */
  function markedIds(card) {
    const rows = window.ConnectifyParseHelpers?.cardTaskIds?.(card);
    if (!rows || rows.size === 0) return null;
    return Array.from(rows.values()).filter(t => t.mark.isCompleted).map(t => t.id);
  }

  /** Whether the ids marked now hold a result the saved ids did not. */
  function hasNewResult(prevIds, ids) {
    if (!Array.isArray(prevIds)) return false;
    const prev = new Set(prevIds);
    const now = new Set(ids);
    const added = ids.filter(id => !prev.has(id)).length;
    const vanished = prevIds.filter(id => !now.has(id)).length;
    return added > vanished;
  }

  /** Compares every card with task rows on screen, saves their ids and returns the subjects with a new result. */
  function check() {
    const cache = snapshot.loadCachedGrades();
    if (!cache) return [];
    const changed = new Map();
    let dirty = false;
    for (const outline of outlines()) {
      const { rawTitle } = outline;
      if (!rawTitle) continue;
      const entry = cache[snapshot.extractSubjectName(rawTitle)];
      const ids = entry && outline.ids();
      if (!ids) continue;
      const semester = String(snapshot.parseCardSemester(rawTitle));
      const subjectName = snapshot.extractSubjectName(rawTitle);
      if (hasNewResult(entry.tasks?.[semester], ids) && !changed.has(subjectName)) changed.set(subjectName, outline);
      entry.tasks = { ...entry.tasks, [semester]: ids };
      dirty = true;
    }
    if (dirty) snapshot.saveCachedGrades(cache);
    return Array.from(changed, ([subjectName, outline]) => ({ subjectName, get card() { return outline.card(); } }));
  }

  // Connect's API records once loaded (every outline's tasks, opened or not), else the tiles with rows on screen
  function outlines() {
    const api = window.ConnectifyOutlineApi;
    if (api?.isLoaded?.()) {
      return api.records().map(record => ({
        rawTitle: record.title,
        ids: () => window.ConnectifyApiParse?.markedIds?.(record) ?? null,
        card: () => window.ConnectifyLegacyOutlines?.tileFor?.(record) || null
      }));
    }
    return Array.from(document.querySelectorAll('.eds-c-tile')).map(card => ({
      rawTitle: normalize(card.querySelector('.eds-c-tile__title')?.textContent),
      ids: () => markedIds(card),
      card: () => card
    }));
  }

  let started = false;
  let timer = null;

  function run() {
    if (window.ConnectifyIsBulkExpanding || window.ConnectifyIsAccordionAnimating) { schedule(); return; }
    for (const entry of check()) window.ConnectifyNewGrade?.announce?.(entry);
  }

  function schedule() {
    if (!started) return;
    clearTimeout(timer);
    timer = setTimeout(run, SETTLE_MS);
  }

  /** Called by new-grade.js once the page's marks are compared and saved. */
  function start() {
    started = true;
    schedule();
  }

  // Task rows appearing (unmuted: an Expand All adds them while the scheduler is muted)
  const addsTaskRows = m => m.type === 'childList' && Array.prototype.some.call(m.addedNodes, node =>
    node.nodeType === 1 && (node.matches?.('.cvr-c-task') || node.querySelector?.('.cvr-c-task')));
  window.ConnectifyScheduler.onMutations(schedule, { filter: addsTaskRows, mute: false });

  window.ConnectifyGradeTasks = { SETTLE_MS, markedIds, hasNewResult, check, start };
})();

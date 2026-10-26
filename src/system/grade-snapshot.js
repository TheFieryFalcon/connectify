/**
 * Connectify grade change detection: subject snapshot
 *
 * Reads each subject's running mark (Semester 2 card first once it has results), keeps it in
 * connectify:grade_cache:<student>, and decides whether a subject changed enough to announce.
 * Notifications: new-grade.js. Exposes window.ConnectifyGradeSnapshot.
 */
(() => {
  'use strict';

  const { normalize } = window.ConnectifyUtils;

  /**
   * Whether the student's own running mark moved (>= 0.05) since the cached visit. The cohort boxplot never
   * counts: classmates getting results back moves it while the student's own result is still unmarked.
   * Only a mark from the same semester's card compares: a Semester 2 row not rendered yet would otherwise
   * make the Semester 1 mark look like a change.
   */
  function hasSubjectChanged(prev, entry) {
    if (!prev || !Number.isFinite(prev.mark) || !Number.isFinite(entry.mark)) return false;
    if (prev.semester && entry.semester && prev.semester !== entry.semester) return false;
    return Math.abs(Math.round((entry.mark - prev.mark) * 100) / 100) >= 0.05;
  }

  const getStudentId = () => window.ConnectifyUtils.accountKey();

  function getCacheKey() {
    return `connectify:grade_cache:${getStudentId()}`;
  }

  function loadCachedGrades() {
    try {
      const raw = localStorage.getItem(getCacheKey());
      if (raw) return JSON.parse(raw);
    } catch (err) {
      console.warn('Connectify failed to load grade cache:', err);
    }
    return null;
  }

  function saveCachedGrades(cache) {
    try {
      localStorage.setItem(getCacheKey(), JSON.stringify(cache));
    } catch (err) {
      console.warn('Connectify failed to save grade cache:', err);
    }
  }

  // The cohort row mark reader serves the summary row too
  function readSubjectMark(row) {
    return row ? window.ConnectifyCohortRows?.readMark?.(row) : undefined;
  }

  const parseCardSemester = rawTitle => window.ConnectifyUtils.cardSemester(rawTitle);

  function extractSubjectName(rawTitle) {
    if (!rawTitle) return '';
    return normalize(
      rawTitle
        .replace(/\s*[-–—]\s*Sem(?:ester)?\s*[12].*$/i, '')
        .replace(/\s*[(]?\s*Sem(?:ester)?\s*[12][^)]*\)?/gi, '')
        .replace(/\bATAR\b/gi, '')
        .replace(/\bYear\s*\d+\b/gi, '')
    ) || rawTitle;
  }

  /** One entry per subject with a running mark: { card, rawTitle, subjectName, semester, mark }. */
  function currentEntries() {
    const cards = Array.from(document.querySelectorAll('.eds-c-tile')).filter(
      c => c.querySelector('.eds-c-tile__title')
    );
    if (!cards.length) return [];

    // Group cards by normalized subject name, prioritizing Semester 2 when scores exist
    const subjectMap = new Map();

    for (const card of cards) {
      const rawTitle = normalize(card.querySelector('.eds-c-tile__title')?.textContent);
      if (!rawTitle) continue;

      const semester = parseCardSemester(rawTitle);
      const subjectName = extractSubjectName(rawTitle);

      const summaryRow = Array.from(card.querySelectorAll('.cvr-c-task')).find(
        row => !row.closest('.cvr-c-tasks')
      );
      const mark = readSubjectMark(summaryRow);
      if (!Number.isFinite(mark)) continue;

      // The later semester's card wins: Semester 2 panels carry the year's running mark
      const existing = subjectMap.get(subjectName);
      if (!existing || semester > existing.semester) {
        subjectMap.set(subjectName, { card, rawTitle, subjectName, semester, mark: Math.round(mark * 100) / 100 });
      }
    }

    return Array.from(subjectMap.values());
  }

  window.ConnectifyGradeSnapshot = {
    hasSubjectChanged, getCacheKey, loadCachedGrades, saveCachedGrades,
    readSubjectMark, parseCardSemester, extractSubjectName, currentEntries
  };
})();

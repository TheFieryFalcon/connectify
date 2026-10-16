/**
 * Connectify grade change detection: subject snapshot
 *
 * Reads each subject's running mark and summary boxplot (Semester 2 card first once it has results),
 * keeps them in connectify:grade_cache:<student>, and decides whether a subject changed enough to
 * announce. Notifications: new-grade.js. Exposes window.ConnectifyGradeSnapshot.
 */
(() => {
  'use strict';

  const { normalize } = window.ConnectifyUtils;

  // Percentage points a boxplot quantile must move by (more than) for a subject to count as updated
  const STATS_CHANGE_THRESHOLD = 1;

  /** Whether a subject's cached entry and its current entry differ enough to announce an update. */
  function hasSubjectChanged(prev, entry) {
    if (!prev) return false;
    if (Number.isFinite(prev.mark) && Number.isFinite(entry.mark) && Math.abs(Math.round((entry.mark - prev.mark) * 100) / 100) >= 0.05) {
      return true;
    }
    const hasStats = Array.isArray(entry.stats) && entry.stats.length === 5;
    if (!hasStats) return false;
    // Boxplot stats appearing for the first time count as an update
    if (!Array.isArray(prev.stats) || prev.stats.length !== 5) return true;
    return entry.stats.some((val, idx) => Math.abs(val - prev.stats[idx]) > STATS_CHANGE_THRESHOLD);
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

  // The cohort row readers (dataset bridge, Highcharts, then stats cache) serve the summary row too
  function readSubjectMark(row) {
    return row ? window.ConnectifyCohortRows?.readMark?.(row) : undefined;
  }

  function readSubjectStats(row) {
    const stats = row ? window.ConnectifyCohortRows?.readStats?.(row) : null;
    return Array.isArray(stats) && stats.length === 5 && stats.every(Number.isFinite) ? stats : undefined;
  }

  function parseCardSemester(rawTitle) {
    const match = rawTitle.match(/\bSem(?:ester)?\s*([12])\b/i) || rawTitle.match(/Semester\s*([12])/i);
    return match ? Number(match[1]) : 1;
  }

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

  /** One entry per subject with a running mark or boxplot: { card, rawTitle, subjectName, semester, mark, stats }. */
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
      const stats = readSubjectStats(summaryRow);
      const hasScore = Number.isFinite(mark);
      const hasStats = Array.isArray(stats) && stats.length === 5;

      const candidate = {
        card,
        rawTitle,
        subjectName,
        semester,
        mark: hasScore ? Math.round(mark * 100) / 100 : undefined,
        stats: hasStats ? stats.map(v => Math.round(v * 100) / 100) : undefined
      };

      if (!subjectMap.has(subjectName)) {
        subjectMap.set(subjectName, candidate);
      } else {
        const existing = subjectMap.get(subjectName);
        const candidateHasScore = Number.isFinite(candidate.mark);
        const existingHasScore = Number.isFinite(existing.mark);
        const candidateHasStats = Array.isArray(candidate.stats) && candidate.stats.length === 5;
        const existingHasStats = Array.isArray(existing.stats) && existing.stats.length === 5;

        // Preference rules:
        // 1. If candidate is Semester 2 with a valid score or stats, it always takes precedence.
        // 2. If existing is Semester 1 (even with score/stats) and candidate is Semester 2 with score/stats, replace.
        // 3. If candidate has score/stats but existing has none, candidate wins regardless of semester.
        // 4. Do not let Semester 1 overwrite an existing Semester 2 with score/stats.
        if (candidate.semester === 2 && (candidateHasScore || candidateHasStats)) {
          subjectMap.set(subjectName, candidate);
        } else if (!existingHasScore && !existingHasStats && (candidateHasScore || candidateHasStats)) {
          subjectMap.set(subjectName, candidate);
        } else if (candidate.semester > existing.semester && (candidateHasScore || candidateHasStats)) {
          subjectMap.set(subjectName, candidate);
        }
      }
    }

    // Only subjects with a valid running mark or valid boxplot stats
    return Array.from(subjectMap.values()).filter(
      e => Number.isFinite(e.mark) || (Array.isArray(e.stats) && e.stats.length === 5)
    );
  }

  window.ConnectifyGradeSnapshot = {
    STATS_CHANGE_THRESHOLD, hasSubjectChanged, getCacheKey, loadCachedGrades, saveCachedGrades,
    readSubjectMark, readSubjectStats, parseCardSemester, extractSubjectName, currentEntries
  };
})();

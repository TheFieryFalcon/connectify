/**
 * Connectify New Grade Notification Engine
 *
 * Tracks running subject averages against a persistent local cache.
 * When a subject grade update is detected:
 * 1. Automatically expands the subject card (especially when global auto-expand is off).
 * 2. Emits an actionable toast notification via `window.ConnectifyNotifications`.
 * 3. Provides a "Jump to Subject" action that smoothly scrolls to the card and pulses an outline.
 * 4. Stacks notifications vertically when multiple grades update concurrently.
 */
(() => {
  'use strict';

  if (window.ConnectifyNewGrade) return;

  const normalize = text => String(text ?? '').replace(/\s+/g, ' ').trim();

  function getStudentId() {
    try {
      return new URL(location.href).searchParams.get('coisp') || 'current';
    } catch {
      return 'current';
    }
  }

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

  /**
   * Reads raw score percentage from task row (supports % and X Out of Y).
   */
  /**
   * Reads raw score percentage from task row (supports % and X Out of Y).
   */
  function readSubjectMark(row) {
    if (!row) return undefined;
    if (window.ConnectifyCohortView?.readMark) {
      const m = window.ConnectifyCohortView.readMark(row);
      if (Number.isFinite(m)) return m;
    }

    const cell = row.querySelector('.cvr-c-task__marks .cvr-c-task__mark') || row.querySelector('.cvr-c-task__mark');
    const text = normalize(cell?.textContent);

    let match = text.match(/^(-?\d+(?:\.\d+)?)\s*%$/);
    if (match) return Number(match[1]);

    match = text.match(/^(-?\d+(?:\.\d+)?)\s*Out\s+of\s+(\d+(?:\.\d+)?)$/i);
    if (match && Number(match[2]) > 0) return (100 * Number(match[1])) / Number(match[2]);

    match = text.match(/(-?\d+(?:\.\d+)?)\s*%/);
    if (match) return Number(match[1]);

    return undefined;
  }

  /**
   * Reads 5-number boxplot summary from DOM dataset or Highcharts on the summary row.
   */
  function readSubjectStats(row) {
    if (!row) return undefined;
    if (window.ConnectifyCohortView?.readStats) {
      const s = window.ConnectifyCohortView.readStats(row);
      if (Array.isArray(s) && s.length === 5 && s.every(Number.isFinite)) return s;
    }
    const host = row.querySelector('[data-highcharts-chart]') ||
                 row.querySelector('.cvr-c-task__chart [data-highcharts-chart]') ||
                 row.querySelector('.cvr-c-task__chart');
    if (host) {
      if (host.dataset?.connectifyStats) {
        try {
          const stats = JSON.parse(host.dataset.connectifyStats);
          if (Array.isArray(stats) && stats.length === 5 && stats.every(Number.isFinite)) return stats;
        } catch {}
      }
      const hostWithDataset = host.querySelector?.('[data-connectify-stats]') || host.closest?.('[data-connectify-stats]');
      if (hostWithDataset?.dataset?.connectifyStats) {
        try {
          const stats = JSON.parse(hostWithDataset.dataset.connectifyStats);
          if (Array.isArray(stats) && stats.length === 5 && stats.every(Number.isFinite)) return stats;
        } catch {}
      }
      const chartIndex = Number(host.getAttribute('data-highcharts-chart'));
      const chart = window.Highcharts?.charts?.[chartIndex];
      if (chart) {
        for (const series of chart.series || []) {
          const dataPoints = [...(series.points || []), ...(series.options?.data || [])];
          for (const point of dataPoints) {
            const pointData = point?.options || point;
            const stats = Array.isArray(pointData)
              ? pointData.slice(-5).map(Number)
              : [pointData?.low, pointData?.q1, pointData?.median, pointData?.q3, pointData?.high].map(Number);
            if (Array.isArray(stats) && stats.length === 5 && stats.every(Number.isFinite)) return stats;
          }
        }
      }
    }
    return undefined;
  }

  /**
   * Expands an individual subject tile card if collapsed.
   */
  function expandSubjectCard(card) {
    if (!card) return;
    const heading = card.querySelector('.eds-c-accordion__section-heading');
    if (heading && /show details/i.test(heading.textContent)) {
      const btn = heading.querySelector('button, .v-button, [role="button"]');
      if (btn) btn.click();
    }
  }

  /**
   * For a subject whose average or box plot has changed:
   * Marks that subject stale so that when it is expanded,
   * its portion of the cache is refreshed and unstored from stale tracking.
   */
  function processChangedSubject(entry) {
    if (!entry) return;
    if (window.ConnectifyData?.markSubjectStale) {
      window.ConnectifyData.markSubjectStale(entry.subjectName);
    }
  }

  /**
   * Smoothly scrolls to a subject card, expands it, scrapes tasks,
   * unstores it from stale cache, and plays a visual pulse highlight.
   */
  function jumpToSubject(card) {
    if (!card) return;
    expandSubjectCard(card);
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const rawTitle = normalize(card.querySelector('.eds-c-tile__title, .cvr-c-tile__title, h1, h2, h3, h4')?.textContent);
    const subjectName = extractSubjectName(rawTitle);

    if (window.ConnectifyData?.scrapeSubjectTasks) {
      window.ConnectifyData.scrapeSubjectTasks(card, true);
    }
    if (subjectName && window.ConnectifyData?.unmarkSubjectStale) {
      window.ConnectifyData.unmarkSubjectStale(subjectName);
    }
    if (subjectName && window.ConnectifyPredictorMath?.updatePredictionCache) {
      try {
        window.ConnectifyPredictorMath.updatePredictionCache(subjectName);
      } catch {}
    }
    if (window.ConnectifyData?.notifyResultsUpdated) {
      window.ConnectifyData.notifyResultsUpdated(card);
    }

    card.classList.remove('cx-card-jump-highlight');
    // Force DOM reflow to restart CSS keyframe animation
    void card.offsetWidth;
    card.classList.add('cx-card-jump-highlight');

    setTimeout(() => {
      card.classList.remove('cx-card-jump-highlight');
    }, 2200);
  }

  /**
   * Scans all subject cards in the DOM, compares running averages against cache,
   * emits notifications for any changes, auto-expands the changed cards,
   * and updates the grade cache.
   */
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

  /**
   * Scans all subject cards in the DOM, compares running averages against cache,
   * emits notifications for any changes, auto-expands the changed cards,
   * and updates the grade cache.
   */
  function checkGrades() {
    if (!document.body) return;

    const cards = Array.from(document.querySelectorAll('.eds-c-tile')).filter(
      c => c.querySelector('.eds-c-tile__title')
    );
    if (!cards.length) return;

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

    // Only consider subjects that have a valid running mark or valid boxplot stats
    const currentEntries = Array.from(subjectMap.values()).filter(
      e => Number.isFinite(e.mark) || (Array.isArray(e.stats) && e.stats.length === 5)
    );

    if (!currentEntries.length) return;

    const prevCache = loadCachedGrades();
    const isFirstRun = !prevCache || Object.keys(prevCache).length === 0;

    // First-time users with an empty cache must NOT receive a barrage of notifications;
    // only notify when an existing cached grade or stats has changed by >= 0.05
    if (!isFirstRun && prevCache) {
      for (const entry of currentEntries) {
        const prev = prevCache[entry.subjectName];
        const hasPrevMark = prev && Number.isFinite(prev.mark);
        const hasPrevStats = prev && Array.isArray(prev.stats) && prev.stats.length === 5;

        let markChanged = false;
        let delta = 0;
        if (hasPrevMark && Number.isFinite(entry.mark)) {
          delta = Math.round((entry.mark - prev.mark) * 100) / 100;
          if (Math.abs(delta) >= 0.05) {
            markChanged = true;
          }
        }

        let statsChanged = false;
        if (hasPrevStats && Array.isArray(entry.stats) && entry.stats.length === 5) {
          statsChanged = entry.stats.some((val, idx) => Math.abs(val - prev.stats[idx]) >= 0.05);
        } else if (!hasPrevStats && Array.isArray(entry.stats) && entry.stats.length === 5 && prev) {
          statsChanged = true;
        }

        if (markChanged || statsChanged) {
          // 1. Process targeted invalidation: store as stale subject
          processChangedSubject(entry);

          // 2. Dispatch stacked notification
          let notifTitle = 'Class Updated';
          let notifMsg = `${entry.subjectName} scores have been updated.`;

          if (window.ConnectifyNotifications?.show) {
            window.ConnectifyNotifications.show({
              id: `connectify-grade-${entry.subjectName.replace(/\s+/g, '-').toLowerCase()}`,
              type: 'grade',
              title: notifTitle,
              message: notifMsg,
              duration: 12000,
              actions: [
                {
                  text: 'Dismiss',
                  type: 'secondary',
                  onClick: ({ close }) => {
                    close();
                  }
                },
                {
                  text: 'Jump to Subject',
                  type: 'accent',
                  onClick: () => {
                    jumpToSubject(entry.card);
                  }
                }
              ]
            });
          }
        }
      }
    }

    // Update the averages and stats cache 1 second after the page has loaded / evaluated
    setTimeout(() => {
      const updatedCache = loadCachedGrades() || {};
      for (const entry of currentEntries) {
        updatedCache[entry.subjectName] = {
          mark: entry.mark,
          stats: entry.stats,
          semester: entry.semester,
          updatedAt: Date.now()
        };
      }
      saveCachedGrades(updatedCache);
    }, 1000);
  }

  let hasCheckedThisPage = false;
  let checkTimer = null;

  function scheduleCheck(delay = 600) {
    if (hasCheckedThisPage) return;
    clearTimeout(checkTimer);
    checkTimer = setTimeout(() => {
      if (hasCheckedThisPage) return;
      if (document.querySelectorAll('.eds-c-tile').length > 0) {
        hasCheckedThisPage = true;
        checkGrades();
      }
    }, delay);
  }

  // Trigger on page load after DOM tiles are present
  if (document.readyState === 'complete') {
    scheduleCheck(300);
  } else {
    window.addEventListener('load', () => scheduleCheck(300));
  }
  setTimeout(() => scheduleCheck(600), 600);
  setTimeout(() => scheduleCheck(1500), 1500);
  setTimeout(() => scheduleCheck(3000), 3000);

  // Observe DOM additions so check runs once tiles have settled
  if (typeof MutationObserver !== 'undefined') {
    const pageObserver = new MutationObserver(mutations => {
      if (hasCheckedThisPage) return;
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          scheduleCheck(500);
          break;
        }
      }
    });

    if (document.body) {
      pageObserver.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        pageObserver.observe(document.body, { childList: true, subtree: true });
      });
    }
  }

  // Reset page check guard on navigation
  window.addEventListener('hashchange', () => {
    hasCheckedThisPage = false;
    scheduleCheck(800);
  });
  window.addEventListener('popstate', () => {
    hasCheckedThisPage = false;
    scheduleCheck(800);
  });

  window.ConnectifyNewGrade = {
    checkGrades,
    readSubjectStats,
    getCachedGrades: loadCachedGrades,
    setCachedGrade: (subjectName, mark, stats) => {
      const c = loadCachedGrades() || {};
      c[subjectName] = {
        mark: Number(mark),
        stats: Array.isArray(stats) ? stats : undefined,
        updatedAt: Date.now()
      };
      saveCachedGrades(c);
    },
    clearGradeCache: () => {
      try {
        localStorage.removeItem(getCacheKey());
      } catch {}
    },
    jumpToSubject,
    expandSubjectCard,
    processChangedSubject,
    RESULTS_ALGO_VERSION: window.ConnectifyCache?.VERSIONS?.RESULTS || 'v4_20261001_results'
  };
})();

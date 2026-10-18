/**
 * Connectify New Grade Notification Engine
 *
 * Once per page, compares each subject's running mark and boxplot with the cache (grade-snapshot.js).
 * A changed subject is marked stale (re-scraped when next expanded) and announced with a stacked
 * "Class Updated" toast whose "Jump to Subject" action expands that card, scrolls to it and pulses
 * an outline. Nothing is expanded without the student clicking. Exposes window.ConnectifyNewGrade.
 */
(() => {
  'use strict';

  if (window.ConnectifyNewGrade) return;

  const { normalize } = window.ConnectifyUtils;

  const snapshot = window.ConnectifyGradeSnapshot;
  const { STATS_CHANGE_THRESHOLD, hasSubjectChanged, getCacheKey, loadCachedGrades, saveCachedGrades, readSubjectStats, extractSubjectName } = snapshot;

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
   * Smoothly scrolls to a subject card, expands it and pulses a highlight straight away; the heavy
   * refresh (re-scrape, prediction rebuild over every subject, results notify) waits until the accordion
   * animation and smooth scroll have settled, then runs when the browser is idle, so the click never janks.
   */
  const JUMP_REFRESH_DELAY = 500;
  const whenIdle = fn => (window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 1000 }) : setTimeout(fn, 0));

  function refreshJumpedSubject(card) {
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
  }

  function jumpToSubject(card) {
    if (!card) return;
    expandSubjectCard(card);
    // Scroll and highlight in the next frame: scrolling straight after the expand click (and forcing a reflow to
    // restart the pulse) laid the freshly expanded card out synchronously, a ~60ms hitch on the click. The pulse
    // restarts by re-adding its class a frame after removing it
    card.classList.remove('cx-card-jump-highlight');
    requestAnimationFrame(() => {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      requestAnimationFrame(() => card.classList.add('cx-card-jump-highlight'));
    });

    clearTimeout(card._cxJumpRefresh);
    card._cxJumpRefresh = setTimeout(() => whenIdle(() => refreshJumpedSubject(card)), JUMP_REFRESH_DELAY);

    setTimeout(() => {
      card.classList.remove('cx-card-jump-highlight');
    }, 2200);
  }

  /**
   * Scans all subject cards in the DOM, compares running averages against cache,
   * emits notifications for any changes, auto-expands the changed cards,
   * and updates the grade cache.
   */
  function checkGrades() {
    if (!document.body) return;

    const currentEntries = snapshot.currentEntries();
    if (!currentEntries.length) return;

    const prevCache = loadCachedGrades();
    const isFirstRun = !prevCache || Object.keys(prevCache).length === 0;

    // First-time users with an empty cache must NOT receive a barrage of notifications.
    // A notice needs the student's own running mark to move by >= 0.05, or a boxplot quantile to move by
    // more than STATS_CHANGE_THRESHOLD points: another class uploading results nudges the cohort boxplot
    // slightly, and that alone must not announce an update
    if (!isFirstRun && prevCache) {
      for (const entry of currentEntries) {
        if (hasSubjectChanged(prevCache[entry.subjectName], entry)) {
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
        const previous = updatedCache[entry.subjectName];
        updatedCache[entry.subjectName] = {
          mark: entry.mark,
          // A chart that was not readable this time never erases the boxplot seen before
          stats: entry.stats || previous?.stats,
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
        whenChartsStamped(checkGrades);
      }
    }, delay);
  }

  // Summary charts are stamped by the main-world bridge some time after the tiles appear; comparing earlier
  // reads no boxplot, and the next visit would then report it as new. Waits up to CHART_WAIT_MS, then compares
  // what is there (marks always are).
  const CHART_WAIT_MS = 10000;
  function summaryChartsPending() {
    return Array.from(document.querySelectorAll('.eds-c-tile .cvr-c-task:not(.cvr-c-tasks *)')).some(row => {
      // A chart host not drawn yet is pending too; subjects without results have no chart host at all
      return row.querySelector('.cvr-c-task__chart') && !snapshot.readSubjectStats(row);
    });
  }

  function whenChartsStamped(run, startedAt = Date.now()) {
    if (!summaryChartsPending() || Date.now() - startedAt >= CHART_WAIT_MS) { run(); return; }
    window.ConnectifyUtils.syncCharts();
    setTimeout(() => whenChartsStamped(run, startedAt), 250);
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

  // Nodes being added (e.g. tiles arriving) re-arm the check until it has run on this page
  window.ConnectifyScheduler.onMutations(() => {
    if (!hasCheckedThisPage) scheduleCheck(500);
  }, { filter: m => m.type === 'childList' && m.addedNodes.length > 0, mute: false });

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
    hasSubjectChanged,
    STATS_CHANGE_THRESHOLD,
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

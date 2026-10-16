/**
 * Connectify Assessment Data Scraper
 *
 * Extracts assessment outlines, tasks, raw marks, weights, and cohort boxplot statistics
 * from Connect DOM cards. Provides `window.ConnectifyData`.
 */
(() => {
  'use strict';

  try {
    if (window.__connectifyDataInitialized && window.ConnectifyData) return;
    window.__connectifyDataInitialized = true;

  const { normalize } = window.ConnectifyUtils;

    const cache = window.ConnectifyCache || {};
    const parser = window.ConnectifyParser || {};
    const expander = window.ConnectifyExpand || {};

    const subjectsCache = cache.subjectsCache || new Map();
    const statsCache = cache.statsCache || new Map();

    const orderHint = parser.orderHint || function() { return null; };
    const correctedCaption = parser.correctedCaption || function(t, k, c) { return c || ''; };
    const parseSemester = parser.parseSemester || function() { return 1; };
    const parseCardSubjectTasks = parser.parseCardSubjectTasks || function() { return null; };
    const cohortMean = parser.cohortMean || function() { return null; };

    const expandAll = (exp = true) => (window.ConnectifyExpand?.expandAll || expander.expandAll)(exp);

    const getTaskStats = (...args) => (window.ConnectifyCache?.getTaskStats || cache.getTaskStats)(...args);
    const setTaskStats = (...args) => (window.ConnectifyCache?.setTaskStats || cache.setTaskStats)(...args);
    const getSubjectTasks = (...args) => (window.ConnectifyCache?.getSubjectTasks || cache.getSubjectTasks)(...args);
    const saveSubjectsCache = (...args) => (window.ConnectifyCache?.saveSubjectsCache || cache.saveSubjectsCache)(...args);
    const loadSubjectsCache = (...args) => (window.ConnectifyCache?.loadSubjectsCache || cache.loadSubjectsCache)(...args);
    const markSubjectStale = (...args) => (window.ConnectifyCache?.markSubjectStale || cache.markSubjectStale)(...args);
    const unmarkSubjectStale = (...args) => (window.ConnectifyCache?.unmarkSubjectStale || cache.unmarkSubjectStale)(...args);
    const isSubjectStale = (...args) => (window.ConnectifyCache?.isSubjectStale || cache.isSubjectStale)(...args);
    const getStaleSubjects = (...args) => (window.ConnectifyCache?.getStaleSubjects || cache.getStaleSubjects)(...args);
    const hasCachedSubjects = (...args) => (window.ConnectifyCache?.hasCachedSubjects || cache.hasCachedSubjects)();

    const { scrapeSubjectTasks, formatCollectedSubjects } = window.ConnectifyAssessmentScrape;

  /**
   * Scrape all subject assessment cards currently present in the DOM.
   * Caches results so data persists even when cards are collapsed by the user.
   * Uses cache and stops DOM scraping if a valid cache exists.
   *
   * @param {boolean} includePending - Whether to include pending/unmarked assessments
   * @param {boolean} forceRefresh - Whether to force re-scraping from the DOM
   * @returns {Array<{name: string, tasks: Array<Object>}>} Array of subject records
   */
  let isCollecting = false;
  function collect(includePending = false, forceRefresh = false) {
    if (isCollecting) {
      return formatCollectedSubjects(includePending);
    }
    const staleSet = getStaleSubjects();
    // Use the cache if there is a cache, no forced refresh, and no subjects are marked stale
    if (!forceRefresh && staleSet.size === 0 && hasCachedSubjects()) {
      return formatCollectedSubjects(includePending);
    }

    isCollecting = true;
    const updatedStaleSubjects = new Set();
    try {
      const cards = Array.from(document.querySelectorAll('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile'))
        .sort((a, b) => parseSemester(a) - parseSemester(b));

      for (const card of cards) {
        scrapeSubjectTasks(card, forceRefresh, updatedStaleSubjects);
      }
    } finally {
      isCollecting = false;
    }

    if (updatedStaleSubjects.size > 0 && window.ConnectifyPredictorMath?.updatePredictionCache) {
      try {
        window.ConnectifyPredictorMath.updatePredictionCache();
      } catch {}
    }

    return formatCollectedSubjects(includePending);
  }

  /**
   * Dispatches updates to dependent modules whenever a subject is expanded.
   */
  let notifyUpdateTimer = null;
  function notifyResultsUpdated(card) {
    clearTimeout(notifyUpdateTimer);
    notifyUpdateTimer = setTimeout(() => {
      let subjects = null;
      if (card) {
        const cardTitle = normalize(
          card.querySelector('.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading')?.textContent ||
          card.getAttribute('data-subject-title') ||
          card.getAttribute('aria-label') ||
          ''
        ).replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '').trim();

        if (!subjectsCache.has(cardTitle) || isSubjectStale(cardTitle)) {
          scrapeSubjectTasks(card, isSubjectStale(cardTitle));
        } else {
          scrapeSubjectTasks(card, false);
        }

        if (cardTitle && subjectsCache.has(cardTitle)) {
          subjects = [{ name: cardTitle, tasks: Array.from(subjectsCache.get(cardTitle).values()) }];
        }
      } else {
        subjects = collect(true);
      }

      // Pre-cache predictions only if a valid cache is missing
      if (window.ConnectifyPredictorMath?.populateChronologicalPredictions) {
        try {
          if (!window.ConnectifyPredictorMath.isPredictionCacheCurrent?.()) {
            const list = subjects || collect(true);
            window.ConnectifyPredictorMath.populateChronologicalPredictions(list, false);
          }
        } catch (e) {}
      }

      if (window.ConnectifyCohort?.schedule) {
        window.ConnectifyCohort.schedule();
      }

      // Only refresh tool views that are open (Year in Progress refreshes itself on the event below)
      const weaknessPanel = document.getElementById('connectify-weakness');
      if (weaknessPanel && !weaknessPanel.hidden && window.ConnectifyWeakness?.render) {
        window.ConnectifyWeakness.render();
      }
      if (window.ConnectifyCompoundProgress?.update) {
        window.ConnectifyCompoundProgress.update();
      }
      if (window.ConnectifyAtar?.refreshData) {
        window.ConnectifyAtar.refreshData();
      }

      window.dispatchEvent(new CustomEvent('connectify-results-updated', { detail: { card } }));
    }, 40);
  }


    // Publish public API
    window.ConnectifyData = {
      collect,
      cohortMean,
      orderHint,
      correctedCaption,
      expandAll,
      collapseAll: () => expandAll(false),
      scrapeSubjectTasks,
      parseCardSubjectTasks,
      hasCachedSubjects,
      saveSubjectsCache,
      loadSubjectsCache,
      notifyResultsUpdated,
      // Expand All runs its own statistics pass, so a queued per-card update would only repeat it
      cancelPendingNotify: () => clearTimeout(notifyUpdateTimer),
      getTaskStats,
      setTaskStats,
      getSubjectTasks,
      markSubjectStale,
      unmarkSubjectStale,
      isSubjectStale,
      getStaleSubjects,
      clearCache: () => {
        subjectsCache.clear();
        statsCache.clear();
        try {
          localStorage.removeItem(cache.getSubjectsCacheKey ? cache.getSubjectsCacheKey() : 'connectify:subjects_cache:current');
          localStorage.removeItem('connectify:subjects_cache:current');
          localStorage.removeItem('connectify:stale_subjects');
        } catch {}
      },
      cache: window.ConnectifyCache || cache
    };
  } catch (err) {
    console.error('Connectify error in assessment-data.js:', err);
  }
})();

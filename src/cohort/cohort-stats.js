/**
 * Connectify Cohort Statistics & Rank Estimator (Controller)
 *
 * Runs the two-pass cohort update (one cohort size estimate per subject across both semesters, then
 * every task row's panel) and schedules passes. Page observation and lifecycle: cohort-observer.js.
 * Provides `window.ConnectifyCohort`.
 */
(() => {
  'use strict';

  if (window.__connectTea141) return;
  window.__connectTea141 = true;

  const math = () => window.ConnectifyCohortMath || {
    percentile: () => undefined,
    summary: () => null,
    rankString: () => ''
  };

  const estimator = () => window.ConnectifyCohortEstimator || {
    subjectKey: () => null,
    estimateCohortSize: () => 50,
    observedSpreadsBySubject: new Map(),
    memory: new Map()
  };

  const view = () => window.ConnectifyCohortView || {
    render: () => {}
  };

  const styles = window.ConnectifyCohortStyles || '';

  const persistentEstimates = new Map();

  function pass(precollectedAllSubjects = null) {
    if (!document.getElementById('connectea-style')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'connectea-style';
      styleEl.textContent = styles;
      document.head.append(styleEl);
    }

    const cards = Array.from(document.querySelectorAll('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile')).filter(
      card => card.querySelector('.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading')
    );

    const est = estimator();

    // Pass 1: Group and find best estimates per subject key (retaining empirical refinements)
    const subjectEstimates = {};
    for (const card of cards) {
      const rows = Array.from(card.querySelectorAll('.cvr-c-task')).filter(
        row => row.closest('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile') === card
      );
      if (!rows.length) continue;
      card._cxTaskRows = rows;

      const key = est.subjectKey(card);
      card._cxCohortKey = key;
      if (!key) continue;

      const estimatedSize = est.estimateCohortSize(card);
      const titleEl = card.querySelector('.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading');
      const isSemester2 = titleEl && titleEl.textContent.match(/Semester\s+2/i);

      const hasObservedSpreads = est.observedSpreadsBySubject?.get(key)?.size > 0;
      const existingEstimate = persistentEstimates.get(key);

      if (!(key in subjectEstimates)) {
        subjectEstimates[key] = estimatedSize;
      } else if (hasObservedSpreads && isSemester2) {
        subjectEstimates[key] = estimatedSize;
      } else if (!hasObservedSpreads && existingEstimate) {
        subjectEstimates[key] = existingEstimate;
      }

      if (hasObservedSpreads || !persistentEstimates.has(key)) {
        persistentEstimates.set(key, subjectEstimates[key]);
      }
    }

    // Pass 2: Render using unified best estimates
    const hasDetailTasks = document.querySelector('.cvr-c-tasks .cvr-c-task') !== null;
    const allSubjects = hasDetailTasks && window.ConnectifyData?.collect ? window.ConnectifyData.collect(true) : [];
    for (const card of cards) {
      const rows = card._cxTaskRows || [];
      if (!rows.length) continue;

      const key = card._cxCohortKey;
      const estimatedSize = key
        ? (subjectEstimates[key] || persistentEstimates.get(key) || est.estimateCohortSize(card))
        : est.estimateCohortSize(card);

      for (const row of rows) {
        const isOverall = !row.closest('.cvr-c-tasks');
        try {
          view().render(row, isOverall, key, estimatedSize, schedule, allSubjects);
        } catch (error) {
          console.debug('Connectify:', error);
        }
      }
    }
  }

  let queued = false;
  let isExecutingPass = false;
  let rePassPending = false;
  let scheduleDebounceTimer = null;

  function runPass() {
    queued = false;
    isExecutingPass = true;
    try {
      pass();
    } finally {
      isExecutingPass = false;
      if (rePassPending) {
        rePassPending = false;
        schedule(true);
      }
    }
  }

  function schedule(immediate = false) {
    if (!immediate && window.ConnectifyIsUserActive && !window.ConnectifyIsUserActive()) return;
    if (immediate) {
      if (queued || isExecutingPass) {
        rePassPending = true;
        return;
      }
      queued = true;
      requestAnimationFrame(runPass);
      return;
    }
    clearTimeout(scheduleDebounceTimer);
    scheduleDebounceTimer = setTimeout(() => {
      if (queued || isExecutingPass) {
        rePassPending = true;
        return;
      }
      queued = true;
      requestAnimationFrame(runPass);
    }, 250);
  }

  window.ConnectifyCohort = {
    percentile: (...args) => math().percentile(...args),
    summary: (...args) => math().summary(...args),
    rankString: (...args) => math().rankString(...args),
    estimateCohortSize: (...args) => estimator().estimateCohortSize(...args),
    estimatedSize: (...args) => estimator().estimateCohortSize(...args),
    pass,
    schedule,
    runPass,
    persistentEstimates,
    clearCohortCache: () => window.ConnectifyCache?.clearCohortCache?.(),
    COHORT_ALGO_VERSION: window.ConnectifyCache?.VERSIONS?.COHORT || 'v4_20261001_cohort'
  };
})();

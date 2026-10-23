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
    memory: new Map()
  };

  const view = () => window.ConnectifyCohortView || {
    render: () => {}
  };

  const styles = window.ConnectifyCohortStyles || '';

  let waitTimer = null;
  const estimated = new Set();

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

    // Pass 1: every card's boxplots join its subject's spread pool first, so both semesters' cards get
    // one estimate from the same spreads in this pass (a later card's chart never shifts it next pass);
    // a subject still waiting for a chart it has never seen has no estimate yet (estimator chartsPending)
    const subjectEstimates = {};
    const pending = new Set();
    for (const card of cards) {
      // A class Connect shows no overall row for gets Connectify's own subject average row first
      try { window.ConnectifyCohortSubjectAverage?.sync(card); } catch {}
      const rows = Array.from(card.querySelectorAll('.cvr-c-task')).filter(
        row => row.closest('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile') === card
      );
      if (!rows.length) continue;
      card._cxTaskRows = rows;
      card._cxCohortKey = est.subjectKey(card);
      if (card._cxCohortKey) est.observeSpreads?.(card);
      // Only before a subject's first estimate: a shown one is never taken back
      if (card._cxCohortKey && !estimated.has(card._cxCohortKey) && est.chartsPending?.(card)) pending.add(card._cxCohortKey);
    }
    for (const card of cards) {
      const key = card._cxCohortKey;
      if (card._cxTaskRows?.length && key && !(key in subjectEstimates)) {
        subjectEstimates[key] = pending.has(key) ? undefined : est.estimateCohortSize(card);
        if (subjectEstimates[key] !== undefined) estimated.add(key);
      }
    }
    // A chart that never stamps stops holding the estimate once the wait is over
    if (pending.size && !waitTimer) {
      waitTimer = setTimeout(() => schedule(true), Math.max(0, (est.CHART_WAIT_MS || 0) - performance.now()) + 50);
    }

    // Pass 2: Render using unified best estimates
    const hasDetailTasks = document.querySelector('.cvr-c-tasks .cvr-c-task') !== null;
    const allSubjects = hasDetailTasks && window.ConnectifyData?.collect ? window.ConnectifyData.collect(true) : [];
    for (const card of cards) {
      const rows = card._cxTaskRows || [];
      if (!rows.length) continue;

      const key = card._cxCohortKey;
      const estimatedSize = key && key in subjectEstimates ? subjectEstimates[key] : est.estimateCohortSize(card);

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
    clearCohortCache: () => window.ConnectifyCache?.clearCohortCache?.(),
    COHORT_ALGO_VERSION: window.ConnectifyCache?.VERSIONS?.COHORT || 'v4_20261001_cohort'
  };
})();

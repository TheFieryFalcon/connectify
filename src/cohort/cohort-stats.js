/**
 * Connectify Cohort Statistics & Rank Estimator (Controller)
 *
 * Coordinates cohort estimation, responsive panel injection, DOM observation,
 * and page lifecycle for Connect assessment rows.
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
      const rows = card._cxTaskRows || Array.from(card.querySelectorAll('.cvr-c-task')).filter(
        row => row.closest('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile') === card
      );
      if (!rows.length) continue;

      const key = est.subjectKey(card);
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

  const observer = new MutationObserver(records => {
    if (window.ConnectifyIsAccordionAnimating) return;
    if (window.ConnectifyIsBulkExpanding) return;
    let shouldRun = false;
    for (const r of records) {
      if (
        r.target.parentElement?.closest('.connectea-panel') ||
        r.target.closest?.('.connectea-panel') ||
        r.target.parentElement?.closest('.connectea-type-container') ||
        r.target.closest?.('.connectea-type-container') ||
        r.target.parentElement?.closest('.connectea-row-wrapper') ||
        r.target.closest?.('.connectea-row-wrapper') ||
        r.target.id === 'connectea-style'
      ) {
        continue;
      }

      // Check if all added or removed nodes are internal Connectify UI nodes
      const isConnectifyNode = node => (
        node.nodeType === 1 && (
          node.matches?.('.connectea-panel, .connectea-row-wrapper, .connectea-type-container, .connectea-outcome-bar, .connectea-subject-controls') ||
          node.classList?.contains('connectea-panel') ||
          node.classList?.contains('connectea-row-wrapper') ||
          node.classList?.contains('connectea-type-container')
        )
      );

      const hasOnlyConnectifyNodes = nodes => {
        if (!nodes || nodes.length === 0) return true;
        for (let i = 0; i < nodes.length; i++) {
          if (!isConnectifyNode(nodes[i])) return false;
        }
        return true;
      };

      if (hasOnlyConnectifyNodes(r.addedNodes) && hasOnlyConnectifyNodes(r.removedNodes)) {
        continue;
      }
      const isPanel =
        r.target.matches?.('.eds-c-accordion__panel, .cvr-c-accordion__panel, .eds-c-accordion, .cvr-c-accordion') ||
        r.target.closest?.('.eds-c-accordion__panel, .cvr-c-accordion__panel');
      if (isPanel) {
        let hasTaskNodes = false;
        if (r.addedNodes && r.addedNodes.length > 0) {
          for (const node of r.addedNodes) {
            if (node.nodeType === 1 && (node.matches?.('.cvr-c-task') || node.querySelector?.('.cvr-c-task'))) {
              hasTaskNodes = true;
              break;
            }
          }
        }
        if (!hasTaskNodes) {
          continue;
        }
      }
      shouldRun = true;
      break;
    }
    if (shouldRun) {
      let hasMissingSummaryPanel = false;
      const allCards = document.querySelectorAll('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile');
      for (const card of allCards) {
        const summaryRow = Array.from(card.querySelectorAll('.cvr-c-task')).find(
          row => !row.closest('.cvr-c-tasks')
        );
        if (summaryRow && !summaryRow.querySelector('.connectea-panel')) {
          hasMissingSummaryPanel = true;
          break;
        }
      }
      if (hasMissingSummaryPanel) {
        runPass();
      } else {
        schedule();
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['data-highcharts-chart', 'data-connectify-stats']
  });

  window.addEventListener('hashchange', schedule);
  window.addEventListener('popstate', schedule);
  window.addEventListener('storage', e => {
    if (e.key?.startsWith('connectea:cohort:v3:')) {
      estimator().memory?.delete(e.key);
      schedule(true);
    } else if (e.key === 'connectea:task_type_overrides') {
      schedule(true);
    }
  });
  window.addEventListener('connectify-task-type-changed', () => schedule(true));
  window.addEventListener('connectify-settings-updated', () => {
    persistentEstimates.clear();
    schedule(true);
  });
  window.addEventListener('connectify-cohort-invalidated', () => {
    persistentEstimates.clear();
    schedule(true);
  });
  window.addEventListener('connectify-baselines-updated', () => schedule(true));
  window.addEventListener('connectify-predictions-updated', () => schedule(true));

  let timer = setInterval(schedule, 8000);

  window.addEventListener('pagehide', () => {
    clearInterval(timer);
    observer.disconnect();
  });

  window.addEventListener('pageshow', e => {
    if (!e.persisted) return;
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['data-highcharts-chart', 'data-connectify-stats']
    });
    timer = setInterval(schedule, 8000);
    schedule();
  });

  schedule(true);

  function updateDisplayWidthScale() {
    try {
      const width = window.innerWidth || document.documentElement?.clientWidth || 1920;
      let scale = 1;
      if (width < 650) scale = 0.48;
      else if (width < 800) scale = 0.55;
      else if (width < 950) scale = 0.62;
      else if (width < 1050) scale = 0.76;
      else if (width < 1200) scale = 0.85;
      else if (width < 1400) scale = 0.92;
      else scale = 1;
      document.documentElement?.style.setProperty('--cx-display-scale', scale.toFixed(2));
    } catch {}
  }
  updateDisplayWidthScale();
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateDisplayWidthScale, { passive: true });
  }

  window.ConnectifyCohort = {
    percentile: (...args) => math().percentile(...args),
    summary: (...args) => math().summary(...args),
    rankString: (...args) => math().rankString(...args),
    estimateCohortSize: (...args) => estimator().estimateCohortSize(...args),
    estimatedSize: (...args) => estimator().estimateCohortSize(...args),
    pass,
    schedule,
    updateDisplayWidthScale,
    clearCohortCache: () => window.ConnectifyCache?.clearCohortCache?.(),
    COHORT_ALGO_VERSION: window.ConnectifyCache?.VERSIONS?.COHORT || 'v4_20261001_cohort'
  };
})();

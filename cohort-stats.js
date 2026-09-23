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

  const styles = `
    .cvr-c-task__details {
      overflow: visible !important;
    }
    .connectea-row-wrapper {
      display: flex !important;
      align-items: center !important;
      gap: 14px !important;
      flex-wrap: nowrap !important;
      margin: 4px 0 !important;
      max-width: 100% !important;
      clear: both !important;
      overflow: visible !important;
    }
    .connectea-row-wrapper > .connectea-panel {
      flex: 0 0 auto !important;
      width: auto !important;
      max-width: fit-content !important;
      margin: 0 !important;
    }
    .connectea-panel {
      box-sizing: border-box !important;
      display: block !important;
      min-width: 0 !important;
      max-width: 100% !important;
      width: 100% !important;
      clear: both !important;
      margin: 8px 0 !important;
      padding: 10px 14px !important;
      border: 1px solid #b9cbe1 !important;
      border-radius: 8px !important;
      background: #f3f7fc !important;
      color: #253b53 !important;
      font: 12px/1.5 system-ui, -apple-system, sans-serif !important;
      white-space: normal !important;
      overflow-wrap: anywhere !important;
    }
    .connectea-panel[hidden],
    .connectea-panel.connectea-hidden {
      display: none !important;
    }
    .connectea-type-container {
      display: inline-flex;
      align-items: center;
      flex: 0 0 auto;
    }
    .connectea-type-label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font: 12px/1.4 system-ui, -apple-system, sans-serif;
      color: #4e6076;
      font-weight: 500;
      cursor: pointer;
      user-select: none;
    }
    .connectea-type-select {
      box-sizing: border-box;
      min-height: 26px;
      padding: 2px 8px;
      border: 1px solid #b9cbe1;
      border-radius: 6px;
      background: #f7f9fc;
      color: #203c5e;
      font: inherit;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      outline: none;
      transition: border-color 0.2s, background-color 0.2s, box-shadow 0.2s;
    }
    .connectea-type-select:hover {
      border-color: #3575b9;
      background: #ffffff;
    }
    .connectea-type-select:focus {
      border-color: #3575b9;
      outline: 2px solid #3575b9;
      outline-offset: 1px;
    }
    .connectea-type-select.connectea-overridden {
      border-color: #24618c;
      background: #e9f2fb;
      color: #174c75;
      font-weight: 700;
    }
    .connectea-dark .connectea-type-label {
      color: #a0b2c6;
    }
    .connectea-dark .connectea-type-select {
      background: #2a3b4c;
      color: #e1eaf3;
      border-color: #496178;
    }
    .connectea-dark .connectea-type-select:hover {
      border-color: #6ba5d6;
      background: #33485d;
    }
    .connectea-dark .connectea-type-select:focus {
      border-color: #6ba5d6;
      outline: 2px solid #6ba5d6;
    }
    .connectea-dark .connectea-type-select.connectea-overridden {
      border-color: #6ba5d6;
      background: #364e65;
      color: #ffffff;
    }
    .connectea-distribution {
      display: block !important;
      width: 100% !important;
      font-weight: 600 !important;
      margin-bottom: 6px !important;
      line-height: 1.5 !important;
      clear: both !important;
    }
    .connectea-subject-controls {
      display: block !important;
      width: 100% !important;
      margin-top: 10px !important;
      padding-top: 8px !important;
      border-top: 1px solid #d3dfed !important;
      clear: both !important;
    }
    .connectea-title {
      display: block;
      font-size: 13px;
      color: #203c5e;
    }
    .connectea-controls {
      font-size: 11px !important;
      display: inline-flex !important;
      align-items: center !important;
      flex-wrap: wrap !important;
      gap: 6px !important;
      margin: 4px 6px 3px 0 !important;
      font-weight: 500 !important;
    }
    .connectea-controls input {
      box-sizing: border-box;
      width: 76px;
      min-height: 24px;
      border: 1px solid #8599b1;
      border-radius: 5px;
      background: white;
      color: #203348;
      padding: 2px 6px;
      font: inherit;
    }
    .connectea-controls input:focus {
      outline: 2px solid #3575b9;
      outline-offset: 2px;
    }
    .connectea-controls input[aria-invalid=true] {
      border-color: #b62727;
    }
    .connectea-notice {
      display: block !important;
      color: #4e6076 !important;
      font-size: 11px !important;
      margin-top: 3px !important;
    }
    .connectea-result-row {
      display: flex !important;
      align-items: baseline !important;
      gap: 8px 14px !important;
      flex-wrap: wrap !important;
      width: 100% !important;
      margin-top: 6px !important;
      margin-bottom: 6px !important;
      clear: both !important;
    }
    .connectea-result {
      font-weight: 600 !important;
      line-height: 1.5 !important;
      flex: 1 1 260px !important;
    }
    .connectea-dark .connectea-panel {
      background: #333333 !important;
      color: #cccccc !important;
      border-color: #3a3a3a !important;
    }
    .connectea-dark .connectea-subject-controls {
      border-top-color: #3a3a3a !important;
    }
    .connectea-dark .connectea-notice {
      color: #999999 !important;
    }
    .connectea-dark .connectea-controls input {
      background: #212121 !important;
      color: #dddddd !important;
      border-color: #4a4a4a !important;
    }
  `;

  let queued = false;
  const persistentEstimates = new Map();

  function pass() {
    if (!document.getElementById('connectea-style')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'connectea-style';
      styleEl.textContent = styles;
      document.head.append(styleEl);
    }

    const cards = Array.from(document.querySelectorAll('.eds-c-tile')).filter(
      card => card.querySelector('.eds-c-tile__title')
    );

    const est = estimator();

    // Pass 1: Group and find best estimates per subject key (retaining empirical refinements)
    const subjectEstimates = {};
    for (const card of cards) {
      const rows = Array.from(card.querySelectorAll('.cvr-c-task')).filter(
        row => row.closest('.eds-c-tile') === card
      );
      if (!rows.length) continue;

      const key = est.subjectKey(card);
      if (!key) continue;

      const estimatedSize = est.estimateCohortSize(card);
      const titleEl = card.querySelector('.eds-c-tile__title');
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
    for (const card of cards) {
      const rows = Array.from(card.querySelectorAll('.cvr-c-task')).filter(
        row => row.closest('.eds-c-tile') === card
      );
      if (!rows.length) continue;

      const key = est.subjectKey(card);
      const estimatedSize = key
        ? (subjectEstimates[key] || persistentEstimates.get(key) || est.estimateCohortSize(card))
        : est.estimateCohortSize(card);

      for (const row of rows) {
        const isOverall = !row.closest('.cvr-c-tasks');
        try {
          view().render(row, isOverall, key, estimatedSize, schedule);
        } catch (error) {
          console.debug('Connectify:', error);
        }
      }
    }
  }

  function schedule() {
    if (window.ConnectifyIsUserActive && !window.ConnectifyIsUserActive()) return;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      pass();
    });
  }

  const observer = new MutationObserver(records => {
    if (
      records.some(
        r =>
          !r.target.parentElement?.closest('.connectea-panel') &&
          !r.target.closest?.('.connectea-panel') &&
          !r.target.parentElement?.closest('.connectea-type-container') &&
          !r.target.closest?.('.connectea-type-container') &&
          !r.target.parentElement?.closest('.connectea-row-wrapper') &&
          !r.target.closest?.('.connectea-row-wrapper') &&
          r.target.id !== 'connectea-style'
      ) {
      schedule();
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
      schedule();
    } else if (e.key === 'connectea:task_type_overrides') {
      schedule();
    }
  });
  window.addEventListener('connectify-task-type-changed', schedule);
  window.addEventListener('connectify-settings-updated', () => {
    persistentEstimates.clear();
    schedule();
  });

  let timer = setInterval(schedule, 1500);

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
    timer = setInterval(schedule, 1500);
    schedule();
  });

  schedule();

  window.ConnectifyCohort = {
    percentile: (...args) => math().percentile(...args),
    summary: (...args) => math().summary(...args),
    rankString: (...args) => math().rankString(...args),
    estimateCohortSize: (...args) => estimator().estimateCohortSize(...args),
    estimatedSize: (...args) => estimator().estimateCohortSize(...args),
    pass,
    schedule
  };
})();

/**
 * Connectify Cohort: page observation and lifecycle
 *
 * Re-runs the cohort pass when Connect adds task rows, a mark's text changes or the main-world bridge
 * stamps boxplot stats (ignoring Connectify's own panels and accordion animations), on navigation and
 * data events, and every 8s while the user is active, all through the shared ConnectifyScheduler.
 * Keeps --cx-display-scale in step with the window width. Extends window.ConnectifyCohort.
 */
(() => {
  'use strict';

  const cohort = window.ConnectifyCohort;
  if (!cohort || cohort.observer) return;
  const { schedule, runPass, persistentEstimates } = cohort;

  const CARD_SELECTOR = '.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile';
  const OWN_UI = '.connectea-panel, .connectea-type-container, .connectea-row-wrapper';
  const OWN_NODES = '.connectea-panel, .connectea-row-wrapper, .connectea-type-container, .connectea-outcome-bar, .connectea-subject-controls, .connectea-subject-average-row';
  const STATS_ATTRIBUTES = ['data-highcharts-chart', 'data-connectify-stats'];

  const isOwnNode = node => node.nodeType === 1 && Boolean(
    node.matches?.(OWN_NODES) || ['connectea-panel', 'connectea-row-wrapper', 'connectea-type-container'].some(c => node.classList?.contains(c))
  );
  const onlyOwnNodes = nodes => !nodes || Array.prototype.every.call(nodes, isOwnNode);
  const hasTaskNodes = nodes => Array.prototype.some.call(nodes || [], node => node.nodeType === 1 && (node.matches?.('.cvr-c-task') || node.querySelector?.('.cvr-c-task')));

  function isRelevant(r) {
    const target = r.target;
    if (target.id === 'connectea-style') return false;
    const element = target.closest ? target : target.parentElement;
    if (element?.closest?.(OWN_UI)) return false;
    // Stats stamped by the main-world bridge; other attribute changes (e.g. class) are not ours
    if (r.type === 'attributes') return STATS_ATTRIBUTES.includes(r.attributeName);
    // Text edits count only inside task rows, so unrelated live text elsewhere on the page stays quiet
    if (r.type === 'characterData') return Boolean(element?.closest?.('.cvr-c-task'));
    if (onlyOwnNodes(r.addedNodes) && onlyOwnNodes(r.removedNodes)) return false;
    const isPanel =
      target.matches?.('.eds-c-accordion__panel, .cvr-c-accordion__panel, .eds-c-accordion, .cvr-c-accordion') ||
      target.closest?.('.eds-c-accordion__panel, .cvr-c-accordion__panel');
    // Accordion panels churn while animating; only task rows arriving in them matter
    return !isPanel || hasTaskNodes(r.addedNodes);
  }

  // A subject summary row without its panel (e.g. after Connect re-rendered a card) is filled in at once
  function hasMissingSummaryPanel() {
    for (const card of document.querySelectorAll(CARD_SELECTOR)) {
      const summaryRow = Array.from(card.querySelectorAll('.cvr-c-task')).find(row => !row.closest('.cvr-c-tasks'));
      if (summaryRow && !summaryRow.querySelector('.connectea-panel')) return true;
    }
    return false;
  }

  // Muted while an accordion animates or Expand All runs (they run their own pass afterwards)
  const scheduler = window.ConnectifyScheduler;
  const unsubscribe = scheduler.onMutations(() => {
    if (hasMissingSummaryPanel()) runPass();
    else schedule();
  }, { filter: isRelevant, mute: true });

  // Navigation replaces the outlines, so it re-runs at once
  window.addEventListener('hashchange', () => schedule(true));
  window.addEventListener('popstate', () => schedule(true));
  window.addEventListener('storage', e => {
    if (e.key?.startsWith('connectea:cohort:v3:')) {
      window.ConnectifyCohortEstimator?.memory?.delete(e.key);
      schedule(true);
    } else if (e.key === 'connectea:task_type_overrides') {
      schedule(true);
    }
  });
  // A Type change or baseline save queues a prediction refresh; its connectify-predictions-updated
  // runs the one pass, so rows are not rebuilt twice (once with stale predictions)
  for (const evt of ['connectify-task-type-changed', 'connectify-baselines-updated', 'connectify-predictions-updated']) {
    window.addEventListener(evt, () => {
      if (evt !== 'connectify-predictions-updated' && window.ConnectifyPredictorCache?.isRefreshPending?.()) return;
      schedule(true);
    });
  }
  for (const evt of ['connectify-settings-updated', 'connectify-cohort-invalidated']) {
    window.addEventListener(evt, () => {
      persistentEstimates.clear();
      schedule(true);
    });
  }

  // Heartbeat while the user is active: a cohort pass, and a request for the main-world bridge to
  // re-read charts whose data arrived without a DOM change
  scheduler.every(8000, () => schedule());
  scheduler.every(2500, () => window.ConnectifyDataSyncCharts?.(), { mute: true });
  window.addEventListener('pageshow', e => {
    if (e.persisted) schedule();
  });

  function updateDisplayWidthScale() {
    try {
      const width = window.innerWidth || document.documentElement?.clientWidth || 1920;
      const steps = [[650, 0.48], [800, 0.55], [950, 0.62], [1050, 0.76], [1200, 0.85], [1400, 0.92]];
      const scale = steps.find(([max]) => width < max)?.[1] ?? 1;
      document.documentElement?.style.setProperty('--cx-display-scale', scale.toFixed(2));
    } catch {}
  }
  updateDisplayWidthScale();
  window.addEventListener('resize', updateDisplayWidthScale, { passive: true });

  schedule(true);
  Object.assign(cohort, { observer: { unsubscribe }, isRelevant, updateDisplayWidthScale });
})();

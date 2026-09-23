/**
 * Connectify Main World Data Bridge
 *
 * Runs exclusively in the webpage's MAIN world to interface with page-scoped
 * globals such as `window.Highcharts`. Synchronously stamps extracted boxplot
 * statistics onto DOM elements so content scripts running in the ISOLATED world
 * can read them safely without CSP or context boundary issues.
 */
(() => {
  'use strict';

  if (window.__connectifyDataBridge) return;
  window.__connectifyDataBridge = true;

  const toNumeric = value => {
    if (value !== null && value !== undefined && value !== '') {
      const num = Number(value);
      if (Number.isFinite(num)) return num;
    }
    return undefined;
  };

  const validStats = stats => (
    Array.isArray(stats) &&
    stats.length === 5 &&
    stats.every(Number.isFinite) &&
    stats.every((v, i) => !i || v >= stats[i - 1])
  );

  const validCohortSize = value => {
    const num = toNumeric(value);
    return Number.isSafeInteger(num) && num >= 1 ? num : undefined;
  };

  function syncChartData(host) {
    if (!host || !window.Highcharts?.charts) return;
    const chartIndex = Number(host.getAttribute('data-highcharts-chart'));
    const chart = window.Highcharts.charts[chartIndex];
    if (!chart || (chart.container && !host.contains(chart.container))) return;

    let foundStats = null;
    let foundN = undefined;

    for (const series of chart.series || []) {
      for (const key of ['n', 'count', 'total', 'sampleSize', 'cohortSize']) {
        if (validCohortSize(series.options?.[key])) {
          foundN = series.options[key];
          break;
        }
      }

      const dataPoints = [...(series.points || []), ...(series.options?.data || [])];
      for (const point of dataPoints) {
        const pointData = point?.options || point;
        if (!foundN) {
          for (const key of ['n', 'count', 'total', 'sampleSize', 'cohortSize']) {
            if (validCohortSize(pointData?.[key])) {
              foundN = pointData[key];
              break;
            }
          }
        }

        const stats = Array.isArray(pointData)
          ? pointData.slice(-5).map(toNumeric)
          : [pointData?.low, pointData?.q1, pointData?.median, pointData?.q3, pointData?.high].map(toNumeric);

        if (validStats(stats)) {
          foundStats = stats;
          break;
        }
      }
      if (foundStats) break;
    }

    if (foundStats) {
      const serialized = JSON.stringify(foundStats);
      if (host.dataset.connectifyStats !== serialized) {
        host.dataset.connectifyStats = serialized;
      }
    }
    if (foundN !== undefined) {
      const nStr = String(foundN);
      if (host.dataset.connectifyN !== nStr) {
        host.dataset.connectifyN = nStr;
      }
    }
  }

  function syncAllCharts() {
    const hosts = document.querySelectorAll('.cvr-c-task__chart [data-highcharts-chart]');
    for (const host of hosts) {
      syncChartData(host);
    }
  }

  // Handle radar chart requests from ISOLATED world
  document.addEventListener('connectify-render-radar', e => {
    if (!window.Highcharts) return;
    const config = e.detail;
    if (config && typeof config === 'object') {
      try {
        window.Highcharts.chart('connectify-radar-chart', config);
      } catch (err) {
        console.debug('Connectify Highcharts radar error:', err);
      }
    }
  });

  document.addEventListener('connectify-destroy-radar', () => {
    const chartEl = document.getElementById('connectify-radar-chart');
    if (chartEl && window.Highcharts?.charts) {
      const chartIndex = Number(chartEl.getAttribute('data-highcharts-chart'));
      if (Number.isFinite(chartIndex) && window.Highcharts.charts[chartIndex]) {
        try {
          window.Highcharts.charts[chartIndex].destroy();
        } catch (e) {}
      }
    }
  });

  // Watch for dynamic Highcharts chart creation in Connect
  const observer = new MutationObserver(records => {
    let shouldSync = false;
    for (const record of records) {
      if (
        record.attributeName === 'data-highcharts-chart' ||
        record.target.hasAttribute?.('data-highcharts-chart') ||
        record.addedNodes.length > 0
      ) {
        shouldSync = true;
        break;
      }
    }
    if (shouldSync) {
      syncAllCharts();
    }
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-highcharts-chart']
  });

  // Mark bridge readiness in shared DOM dataset
  document.documentElement.dataset.connectifyMainBridge = 'ready';

  syncAllCharts();
  setInterval(syncAllCharts, 2000);
})();

/**
 * Connectify Cohort: task row readers and DOM helpers
 *
 * Reads a task row's mark and boxplot quantiles (main-world dataset bridge, then Highcharts, then the
 * stats cache) and provides the small DOM helpers the cohort panels share. Fallbacks keep the readers
 * usable before the math, task type and estimator modules load. Exposes window.ConnectifyCohortRows.
 */
(() => {
  'use strict';

  try {
    const { normalize } = window.ConnectifyUtils;
    const clearChildren = el => {
      if (!el) return;
      if (typeof el.replaceChildren === 'function') {
        el.replaceChildren();
      } else {
        while (el.firstChild) el.removeChild(el.firstChild);
      }
    };

    const math = () => window.ConnectifyCohortMath || {
      toNumeric: v => (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined),
      formatPercentage: v => (Number.isFinite(v) ? String(Math.round(v * 100) / 100) : 'unavailable'),
      validCohortSize: v => (Number.isSafeInteger(Number(v)) && Number(v) >= 1 ? Number(v) : undefined),
      validStats: s => Array.isArray(s) && s.length === 5 && s.every(Number.isFinite),
      summary: () => null,
      percentile: () => undefined,
      standing: () => '',
      rankString: () => ''
    };

    const types = () => {
      const t = window.ConnectifyTaskTypes;
      if (t && typeof t.getTaskMeta === 'function') return t;
      return {
        getTaskMeta: () => ({ subjectName: '', taskName: '', labels: [], labelsKey: '' }),
        updateTypeSelect: () => {},
        saveTaskTypeOverride: () => {},
        ...(t || {})
      };
    };

    const estimator = () => window.ConnectifyCohortEstimator || {
      loadCohortSize: () => undefined,
      saveCohortSize: () => false
    };

    function readMark(row) {
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

    function readStats(row) {
      const meta = types().getTaskMeta(row);
      const host = row.querySelector('[data-highcharts-chart]') ||
                   row.querySelector('.cvr-c-task__chart [data-highcharts-chart]') ||
                   row.querySelector('.cvr-c-task__chart');

      let foundStats = null;
      let foundN = undefined;

      if (host) {
        if (host.dataset?.connectifyStats) {
          try {
            const stats = JSON.parse(host.dataset.connectifyStats);
            if (math().validStats(stats)) {
              foundStats = stats;
              foundN = host.dataset.connectifyN;
            }
          } catch {}
        }

        if (!foundStats) {
          const hostWithDataset = host.querySelector?.('[data-connectify-stats]') || host.closest?.('[data-connectify-stats]');
          if (hostWithDataset?.dataset?.connectifyStats) {
            try {
              const stats = JSON.parse(hostWithDataset.dataset.connectifyStats);
              if (math().validStats(stats)) {
                foundStats = stats;
                foundN = hostWithDataset.dataset.connectifyN;
              }
            } catch {}
          }
        }

        if (!foundStats) {
          const chartIndex = Number(host.getAttribute('data-highcharts-chart'));
          const chart = window.Highcharts?.charts?.[chartIndex];
          if (chart) {
            for (const series of chart.series || []) {
              const dataPoints = [...(series.points || []), ...(series.options?.data || [])];
              for (const point of dataPoints) {
                const pointData = point?.options || point;
                const stats = Array.isArray(pointData)
                  ? pointData.slice(-5).map(math().toNumeric)
                  : [pointData?.low, pointData?.q1, pointData?.median, pointData?.q3, pointData?.high].map(math().toNumeric);

                if (math().validStats(stats)) {
                  foundStats = stats;
                  break;
                }
              }
              if (foundStats) break;
            }
          }
        }
      }

      if (foundStats) {
        if (meta?.subjectName && meta?.taskName && window.ConnectifyData?.setTaskStats) {
          window.ConnectifyData.setTaskStats(meta.subjectName, meta.taskName, foundStats, foundN);
        }
        return foundStats;
      }

      if (meta?.subjectName && meta?.taskName && window.ConnectifyData?.getTaskStats) {
        const cached = window.ConnectifyData.getTaskStats(meta.subjectName, meta.taskName);
        if (math().validStats(cached)) return cached;
      }

      return null;
    }

    function setText(element, text) {
      if (element.textContent !== text) {
        element.textContent = text;
      }
    }

    function setHTML(element, html) {
      if (element.innerHTML !== html) {
        element.innerHTML = html;
      }
    }

    function createElement(tag, className, textContent) {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (textContent) el.textContent = textContent;
      return el;
    }

    window.ConnectifyCohortRows = { readMark, readStats, createElement, clearChildren, setText, setHTML, normalize, math, types, estimator };
  } catch (err) {
    console.error('Connectify error in cohort-row-readers.js:', err);
  }
})();

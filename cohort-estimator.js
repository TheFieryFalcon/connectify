/**
 * Connectify Cohort Size Estimator
 *
 * Estimates cohort size dynamically from subject category baselines, course type,
 * Year 11/12 indicators, and empirical boxplot IQR spreads.
 * Provides `window.ConnectifyCohortEstimator`.
 */
(() => {
  'use strict';

  if (window.ConnectifyCohortEstimator) return;

  const memory = new Map();
  const observedSpreadsBySubject = new Map();

  const normalize = text => String(text ?? '').replace(/\s+/g, ' ').trim();

  const math = () => window.ConnectifyCohortMath || {
    toNumeric: v => (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined),
    validCohortSize: v => (Number.isSafeInteger(Number(v)) && Number(v) >= 1 ? Number(v) : undefined),
    validStats: s => Array.isArray(s) && s.length === 5 && s.every(Number.isFinite)
  };

  /**
   * Generates a storage key scoped to current student and subject title.
   */
  function subjectKey(card) {
    const title = normalize(card?.querySelector?.('.eds-c-tile__title')?.textContent);
    if (!title) return null;

    const student = new URL(location.href).searchParams.get('coisp') || 'current';
    const subject = title.replace(/\s*[-–—]\s*Semester\s+[12]\s*$/i, '').trim();
    return `connectea:cohort:v3:${student}:${new Date().getFullYear()}:${subject}`;
  }

  function loadObservedSpreads(key) {
    if (!key) return new Map();
    if (observedSpreadsBySubject.has(key)) return observedSpreadsBySubject.get(key);

    const map = new Map();
    try {
      const raw = sessionStorage.getItem(`connectea:observed_spreads:${key}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const [k, v] of Object.entries(parsed)) {
          if (Number.isFinite(v) && v > 0) map.set(k, v);
        }
      }
    } catch {}
    observedSpreadsBySubject.set(key, map);
    return map;
  }

  function saveObservedSpread(key, taskId, ratio) {
    if (!key || !taskId || !Number.isFinite(ratio) || ratio <= 0) return;
    const map = loadObservedSpreads(key);
    map.set(taskId, ratio);
    try {
      const obj = Object.fromEntries(map);
      sessionStorage.setItem(`connectea:observed_spreads:${key}`, JSON.stringify(obj));
    } catch {}
  }

  /**
   * Reads 5-number boxplot summary from DOM bridge or Highcharts on the task row.
   */
  function readRowStats(row) {
    if (window.ConnectifyCohortView?.readStats) {
      return window.ConnectifyCohortView.readStats(row);
    }
    const host = row.querySelector('[data-highcharts-chart]') ||
                 row.querySelector('.cvr-c-task__chart [data-highcharts-chart]') ||
                 row.querySelector('.cvr-c-task__chart');
    if (!host) return null;

    if (host.dataset?.connectifyStats) {
      try {
        const stats = JSON.parse(host.dataset.connectifyStats);
        if (math().validStats(stats)) return stats;
      } catch {}
    }

    const hostWithDataset = host.querySelector?.('[data-connectify-stats]') || host.closest?.('[data-connectify-stats]');
    if (hostWithDataset?.dataset?.connectifyStats) {
      try {
        const stats = JSON.parse(hostWithDataset.dataset.connectifyStats);
        if (math().validStats(stats)) return stats;
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
            ? pointData.slice(-5).map(math().toNumeric)
            : [pointData?.low, pointData?.q1, pointData?.median, pointData?.q3, pointData?.high].map(math().toNumeric);

          if (math().validStats(stats)) return stats;
        }
      }
    }
    return null;
  }

  /**
   * Estimates cohort size dynamically from course characteristics and available boxplot data.
   */
  function estimateCohortSize(card) {
    const key = subjectKey(card);
    const titleEl = card.querySelector('.eds-c-tile__title');
    const rawTitle = normalize(titleEl?.textContent || '');
    const cleanTitle = rawTitle
      .toLowerCase()
      .replace(/\s*[-–—]\s*semester\s+[12].*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    const rows = Array.from(card.querySelectorAll('.cvr-c-task')).filter(
      row => row.closest('.eds-c-tile') === card
    );

    // 1. Check if any Highcharts series or data point explicitly carries sample count
    for (const row of rows) {
      const host = row.querySelector('.cvr-c-task__chart [data-highcharts-chart]');
      if (host?.dataset.connectifyN) {
        const n = math().validCohortSize(host.dataset.connectifyN);
        if (n) return n;
      }

      if (host) {
        const chartIndex = Number(host.getAttribute('data-highcharts-chart'));
        const chart = window.Highcharts?.charts?.[chartIndex];
        if (chart) {
          for (const series of chart.series || []) {
            for (const k of ['n', 'count', 'total', 'sampleSize', 'cohortSize']) {
              if (math().validCohortSize(series.options?.[k])) return series.options[k];
            }
            for (const pt of series.points || series.options?.data || []) {
              const p = pt?.options || pt;
              for (const k of ['n', 'count', 'total', 'sampleSize', 'cohortSize']) {
                if (math().validCohortSize(p?.[k])) return p[k];
              }
            }
          }
        }
      }
    }

    // 2. Derive dynamic baseline estimate from subject category, course type, and year level
    let baseline = 50;
    const isATAR = /\batar\b/i.test(cleanTitle);
    const isYear12 = /\byear\s*12\b/i.test(cleanTitle);

    if (/\b(methods|mathematics methods)\b/i.test(cleanTitle)) {
      baseline = isYear12 ? 180 : 219;
    } else if (/\bchemistry\b/i.test(cleanTitle)) {
      baseline = isYear12 ? 170 : 224;
    } else if (/\bhuman biolog(y|ical)\b/i.test(cleanTitle)) {
      baseline = isYear12 ? 140 : 183;
    } else if (/\b(mathematics applications?|applications?)\b/i.test(cleanTitle)) {
      baseline = isYear12 ? 160 : 189;
    } else if (/\benglish atar\b/i.test(cleanTitle) || (/\benglish\b/i.test(cleanTitle) && isATAR && !/\badditional\b/i.test(cleanTitle))) {
      baseline = isYear12 ? 180 : 220;
    } else if (/\b(mathematics essentials?|essentials?)\b/i.test(cleanTitle)) {
      baseline = 117;
    } else if (/\bphysics\b/i.test(cleanTitle)) {
      baseline = isYear12 ? 90 : 111;
    } else if (/\bmathematics specialist\b/i.test(cleanTitle)) {
      baseline = isYear12 ? 45 : 64;
    } else if (/\bbiology\b/i.test(cleanTitle)) {
      baseline = 61;
    } else if (/\bliterature\b/i.test(cleanTitle)) {
      baseline = 52;
    } else if (/\beconomics\b/i.test(cleanTitle)) {
      baseline = 44;
    } else if (/\b(accounting|accounting and finance)\b/i.test(cleanTitle)) {
      baseline = 36;
    } else if (/\b(politics and law|politics & law)\b/i.test(cleanTitle)) {
      baseline = 35;
    } else if (/\bpsychology\b/i.test(cleanTitle)) {
      baseline = 45;
    } else if (/\b(physical education studies|pes)\b/i.test(cleanTitle)) {
      baseline = 38;
    } else if (/\b(business management|bme)\b/i.test(cleanTitle)) {
      baseline = 24;
    } else if (/\bmodern history\b/i.test(cleanTitle)) {
      baseline = 15;
    } else if (/\bjapanese\b/i.test(cleanTitle)) {
      baseline = 44;
    } else if (/\bfrench\b/i.test(cleanTitle)) {
      baseline = 21;
    } else if (/\bitalian\b/i.test(cleanTitle)) {
      baseline = 20;
    } else if (/\b(german|chinese|indonesian)\b/i.test(cleanTitle)) {
      baseline = 22;
    } else if (/\bcomputer science\b/i.test(cleanTitle)) {
      baseline = 11;
    } else if (/\bmusic\b/i.test(cleanTitle)) {
      baseline = 10;
    } else if (/\b(eald|english as an additional)\b/i.test(cleanTitle)) {
      baseline = 9;
    } else if (isATAR) {
      baseline = 50;
    } else {
      baseline = 28;
    }

    // 3. Empirical refinement from Highcharts boxplot statistics if present
    if (key) {
      for (const row of rows) {
        const stats = readRowStats(row);
        if (!math().validStats(stats)) continue;
        const [min, q1, , q3, max] = stats;
        const range = max - min;
        const iqr = q3 - q1;
        if (range > 0 && iqr > 0) {
          const labels = Array.from(row.querySelectorAll('.cvr-c-task__details .v-label'))
            .map(e => normalize(e.textContent))
            .filter(Boolean);
          const taskId = labels.join('::') || row.querySelector('.cvr-c-task__details')?.textContent?.trim().slice(0, 50) || 'task';
          saveObservedSpread(key, taskId, range / iqr);
        }
      }
    }

    const observedSpreads = key ? loadObservedSpreads(key) : null;
    const boxplotSpreads = observedSpreads && observedSpreads.size > 0
      ? Array.from(observedSpreads.values())
      : [];

    if (boxplotSpreads.length > 0) {
      const avgRatio = boxplotSpreads.reduce((sum, r) => sum + r, 0) / boxplotSpreads.length;
      const scalingFactor = Math.max(0.75, Math.min(1.25, avgRatio / 3.2));
      const refined = Math.round(baseline * scalingFactor);
      return Math.max(5, refined);
    }

    return baseline;
  }

  function loadCohortSize(key) {
    if (!key) return undefined;
    if (memory.has(key)) return memory.get(key);

    try {
      let stored = localStorage.getItem(key);
      if (stored === null) {
        const oldKey = key.replace('connectea:cohort:v3:', 'connectea:cohort:v2:');
        const migrated =
          math().validCohortSize(localStorage.getItem(`${oldKey} - Semester 2`)) ??
          math().validCohortSize(localStorage.getItem(`${oldKey} - Semester 1`));

        if (migrated !== undefined) {
          stored = String(migrated);
          localStorage.setItem(key, stored);
        }
      }

      const size = math().validCohortSize(stored);
      memory.set(key, size);
      return size;
    } catch {
      return undefined;
    }
  }

  function saveCohortSize(key, size) {
    memory.set(key, size);
    try {
      if (size === undefined) {
        localStorage.setItem(key, '');
      } else {
        localStorage.setItem(key, String(size));
      }
      return true;
    } catch {
      return false;
    }
  }

  window.ConnectifyCohortEstimator = {
    subjectKey,
    loadObservedSpreads,
    saveObservedSpread,
    estimateCohortSize,
    loadCohortSize,
    saveCohortSize,
    observedSpreadsBySubject,
    memory
  };
})();

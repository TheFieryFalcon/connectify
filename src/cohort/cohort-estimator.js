/**
 * Connectify Cohort Size Estimator
 *
 * Estimates cohort size from a sample count on the chart when Connect provides one, otherwise from the
 * typical size for the subject and year level (cohort-size-baselines.js) refined by the subject's boxplot spreads.
 * Provides `window.ConnectifyCohortEstimator`.
 */
(() => {
  'use strict';

  if (window.ConnectifyCohortEstimator) return;

  const memory = new Map();
  // Right after load a subject waits this long for boxplots it has never seen (cold cache), so it shows
  // one estimate from all of them instead of the typical size, then each chart as it is stamped
  const CHART_WAIT_MS = 10000;
  // Boxplot range / IQR per task, per subject (both semesters): subject -> Map(task -> ratio)
  const spreadPools = new Map();

  const { normalize } = window.ConnectifyUtils;

  const math = () => window.ConnectifyCohortMath || {
    validCohortSize: v => (Number.isSafeInteger(Number(v)) && Number(v) >= 1 ? Number(v) : undefined),
    validStats: s => Array.isArray(s) && s.length === 5 && s.every(Number.isFinite)
  };

  /**
   * Generates a storage key scoped to current student and subject title.
   */
  function subjectKey(card) {
    const title = normalize(card?.querySelector?.('.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading')?.textContent);
    if (!title) return null;

    const student = window.ConnectifyUtils.accountKey();
    const subject = title.replace(/\s*[-–—]\s*Semester\s+[12]\s*$/i, '').trim();
    return `connectea:cohort:v3:${student}:${new Date().getFullYear()}:${subject}`;
  }

  const lower = text => normalize(text).toLowerCase();

  function spreadRatio(stats) {
    if (!math().validStats(stats)) return undefined;
    const [min, q1, , q3, max] = stats;
    return max - min > 0 && q3 - q1 > 0 ? (max - min) / (q3 - q1) : undefined;
  }

  /**
   * A subject's spreads, seeded from every boxplot in the stats cache (connectify:stats_cache:, keyed by
   * subject and task name like the rows), so a refreshed page starts from the spreads it last showed
   * instead of growing them chart by chart as the bridge stamps them.
   */
  function spreadPool(subjectName) {
    const subject = lower(subjectName);
    if (!subject) return new Map();
    if (spreadPools.has(subject)) return spreadPools.get(subject);
    const pool = new Map();
    const prefix = `connectify:stats_cache:${window.ConnectifyUtils.accountKey()}:${subject}:`;
    for (const key of window.ConnectifyUtils.storageKeys(k => k.startsWith(prefix))) {
      try {
        const ratio = spreadRatio(JSON.parse(localStorage.getItem(key))?.stats);
        if (ratio) pool.set(key.slice(prefix.length), ratio);
      } catch {}
    }
    spreadPools.set(subject, pool);
    return pool;
  }

  // The shared row reader (cohort-row-readers.js) loads later in the pipeline but before any estimate runs
  const readRowStats = row => window.ConnectifyCohortRows?.readStats?.(row) ?? null;
  const taskMeta = row => window.ConnectifyTaskTypes?.getTaskMeta?.(row) ?? null;

  const cardRows = card => Array.from(card.querySelectorAll('.cvr-c-task')).filter(
    row => row.closest('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile') === card
  );

  function cardSubject(card, rows) {
    const meta = rows.length ? taskMeta(rows[0]) : null;
    if (meta?.subjectName) return meta.subjectName;
    const title = normalize(card.querySelector('.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading')?.textContent);
    return window.ConnectifyTaskTypes?.cleanSubject?.(title) ?? title.replace(/\s*[-–—]\s*Semester\s+[12].*$/i, '').trim();
  }

  /**
   * Adds the card's readable boxplots to its subject's pool under each row's task name (the stats
   * cache's own key: the summary row is `Overall S1` / `Overall S2`), never text Connectify injects.
   */
  function observeSpreads(card) {
    const rows = cardRows(card);
    const pool = spreadPool(cardSubject(card, rows));
    for (const row of rows) {
      const ratio = spreadRatio(readRowStats(row));
      const task = lower(taskMeta(row)?.taskName || '');
      if (ratio && task) pool.set(task, ratio);
    }
    return pool;
  }

  /**
   * True while, shortly after load, a marked row of the card has no boxplot yet, live or cached (Connect
   * draws one for every marked row; Connectify's restored average row has none).
   */
  function chartsPending(card) {
    if (performance.now() >= CHART_WAIT_MS) return false;
    const readMark = window.ConnectifyCohortRows?.readMark;
    return cardRows(card).some(row => !row.classList.contains('connectea-subject-average-row') &&
      Number.isFinite(readMark?.(row)) && !readRowStats(row));
  }

  /**
   * Estimates cohort size dynamically from course characteristics and available boxplot data.
   */
  function estimateCohortSize(card) {
    const key = subjectKey(card);
    const titleEl = card.querySelector('.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading');
    const rawTitle = normalize(titleEl?.textContent || '');
    const cleanTitle = rawTitle
      .toLowerCase()
      .replace(/\s*[-–—]\s*semester\s+[12].*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    const rows = cardRows(card);

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

    // 2. Typical size for this subject and year level, scaled to the General Cohort Size and ATAR % settings
    const isATAR = /\batar\b/i.test(cleanTitle);
    const isYear11 = /\b(?:year\s*11|11)\b/i.test(cleanTitle) || /\bAE[A-Z]{3}\b/i.test(cleanTitle);
    const isYear12Direct = /\b(?:year\s*12|12)\b/i.test(cleanTitle) || /\bAT[A-Z]{3}\b/i.test(cleanTitle);
    const allTitles = Array.from(document.querySelectorAll('.eds-c-tile__title')).map(el => el.textContent || '');
    const pageHasYear11 = allTitles.some(t => /\b(?:year\s*11|11)\b/i.test(t) || /\bAE[A-Z]{3}\b/i.test(t));
    const pageHasYear12 = allTitles.some(t => /\b(?:year\s*12|12)\b/i.test(t) || /\bAT[A-Z]{3}\b/i.test(t));
    const isYear12 = isYear12Direct || (!isYear11 && pageHasYear12 && !pageHasYear11);

    let totalStudents = 500;
    let atarPct = 60;
    try {
      const storedTotal = Number(localStorage.getItem('connectify:general_cohort_size'));
      if (Number.isSafeInteger(storedTotal) && storedTotal >= 1) totalStudents = storedTotal;
      const storedAtar = Number(localStorage.getItem('connectify:atar_percentage'));
      if (Number.isFinite(storedAtar) && storedAtar > 0 && storedAtar <= 100) atarPct = storedAtar;
    } catch {}
    const baseline = window.ConnectifyCohortSizeBaselines.baselineSize(cleanTitle, { isYear12, isATAR, totalStudents, atarPct });

    // 3. Refinement by the subject's boxplot spreads: every one cached, plus the card's live charts
    const spreads = key ? Array.from(observeSpreads(card).values()) : [];
    if (spreads.length > 0) {
      const avgRatio = spreads.reduce((sum, r) => sum + r, 0) / spreads.length;
      const scalingFactor = Math.max(0.75, Math.min(1.25, avgRatio / 3.2));
      return Math.max(5, Math.round(baseline * scalingFactor));
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
    spreadPool,
    observeSpreads,
    estimateCohortSize,
    chartsPending,
    CHART_WAIT_MS,
    loadCohortSize,
    saveCohortSize,
    spreadPools,
    memory
  };
})();

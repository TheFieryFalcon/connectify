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

  const normalize = text => String(text ?? '').replace(/\s+/g, ' ').trim();

  /**
   * Parse a chronological order index from a date/week caption.
   * Maps Term/Week into a numeric sequence (e.g. Term 2 Week 3 -> 13.0).
   *
   * @param {string} text - Raw date or week caption from Connect
   * @returns {number|null} Sequence number for sorting, or null if unreadable
   */
  function orderHint(text) {
    // Matches "Term 3, Week 5" or "Term 3 Week 5"
    let match = text.match(/term\s*(\d).*?week[s]?\s*(\d+)/i);
    if (match) {
      return (+match[1] - 1) * 12 + (+match[2]);
    }

    // Matches "Week 5, Term 3"
    match = text.match(/weeks?\s*(\d+)(?:\s*(?:&|and|[\/–-])\s*\d+)?\s*[,;]?\s*term\s*(\d)/i);
    if (match) {
      return (+match[2] - 1) * 12 + (+match[1]);
    }

    // Matches bare "Week 4" or "Week 4/5"
    match = text.match(/^(?:week[s]?\s*)?(\d{1,2})(?:\s*[\/–-]\s*\d{1,2})?$/i);
    if (match) {
      return +match[1];
    }

    // Fallback: parse month/day date string
    const cleaned = text
      .replace(/(\d)(st|nd|rd|th)\b/gi, '$1')
      .replace(/^(mon|tue|wed|thu|fri|sat|sun)\w*\s+/i, '');

    if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(cleaned)) {
      const year = new Date().getFullYear();
      const parsedDate = Date.parse(`${cleaned} ${year}`);
      if (Number.isFinite(parsedDate)) {
        // Convert to school week starting from late January
        return (parsedDate - Date.UTC(year, 0, 26)) / 604800000 + 1;
      }
    }

    return null;
  }

  /**
   * Return task caption without hardcoded subject overrides.
   */
  function correctedCaption(title, task, caption) {
    return caption;
  }

  const subjectsCache = new Map();
  const statsCache = new Map();

  function getStudentId() {
    try {
      return new URL(location.href).searchParams.get('coisp') || 'current';
    } catch {
      return 'current';
    }
  }

  function statsCacheKey(subjectName, taskName) {
    const s = normalize(subjectName).toLowerCase();
    const t = normalize(taskName).toLowerCase();
    return `connectify:stats_cache:${getStudentId()}:${s}:${t}`;
  }

  function getTaskStats(subjectName, taskName) {
    if (!subjectName || !taskName) return null;
    const memKey = `${normalize(subjectName).toLowerCase()}::${normalize(taskName).toLowerCase()}`;
    if (statsCache.has(memKey)) return statsCache.get(memKey);

    try {
      const raw = localStorage.getItem(statsCacheKey(subjectName, taskName));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.stats) && parsed.stats.length === 5) {
          statsCache.set(memKey, parsed.stats);
          return parsed.stats;
        }
      }
    } catch {}
    return null;
  }

  function setTaskStats(subjectName, taskName, stats, n) {
    if (!subjectName || !taskName || !Array.isArray(stats) || stats.length !== 5) return;
    const memKey = `${normalize(subjectName).toLowerCase()}::${normalize(taskName).toLowerCase()}`;
    statsCache.set(memKey, stats);

    try {
      const payload = { stats, n, timestamp: Date.now() };
      localStorage.setItem(statsCacheKey(subjectName, taskName), JSON.stringify(payload));
    } catch {}
  }

  function getSubjectTasks(subjectName) {
    if (!subjectName) return [];
    const norm = normalize(subjectName)
      .replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '')
      .replace(/\s*[-–—]\s*Sem\s*[12].*$/i, '')
      .replace(/\bATAR\b/gi, '')
      .replace(/\bYear\s*\d+\b/gi, '')
      .trim().toLowerCase();

    for (const [sName, tasksMap] of subjectsCache.entries()) {
      const cleanS = normalize(sName)
        .replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '')
        .replace(/\s*[-–—]\s*Sem\s*[12].*$/i, '')
        .replace(/\bATAR\b/gi, '')
        .replace(/\bYear\s*\d+\b/gi, '')
        .trim().toLowerCase();
      if (cleanS === norm || sName.toLowerCase().includes(norm) || norm.includes(cleanS)) {
        return Array.from(tasksMap.values()).filter(t => {
          if (/^Assessment\s+\d+$/i.test(t.name) && !t.caption && (t.weight === null || t.weight === 0)) return false;
          return true;
        });
      }
    }
    return [];
  }

  // --- SUBSYSTEM CACHE INVALIDATION MANAGER ---
  const CACHE_VERSIONS = {
    PREDICTOR: 'v8_20261001_pred',
    RESULTS: 'v6_20261001_results',
    SETTINGS: 'v4_20261001_settings',
    COHORT: 'v5_20261001_cohort'
  };

  const CACHE_KEYS = {
    PREDICTOR: 'connectify:cache_version:predictor',
    RESULTS: 'connectify:cache_version:results',
    SETTINGS: 'connectify:cache_version:settings',
    COHORT: 'connectify:cache_version:cohort'
  };

  const ConnectifyCache = {
    VERSIONS: CACHE_VERSIONS,
    KEYS: CACHE_KEYS,

    clearPredictorCache() {
      try {
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('connectify:prediction:') || k === 'connectify:prediction_version')) {
            toRemove.push(k);
          }
        }
        for (const k of toRemove) localStorage.removeItem(k);
        localStorage.setItem(CACHE_KEYS.PREDICTOR, CACHE_VERSIONS.PREDICTOR);
      } catch (e) {
        console.warn('ConnectifyCache: failed to clear predictor cache', e);
      }
    },

    clearResultsCache() {
      try {
        subjectsCache.clear();
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('connectify:grade_cache:')) {
            toRemove.push(k);
          }
        }
        for (const k of toRemove) localStorage.removeItem(k);
        localStorage.setItem(CACHE_KEYS.RESULTS, CACHE_VERSIONS.RESULTS);
        window.dispatchEvent(new CustomEvent('connectify-results-updated'));
      } catch (e) {
        console.warn('ConnectifyCache: failed to clear results cache', e);
      }
    },

    clearSettingsCache() {
      try {
        const directKeys = [
          'connectea:categories',
          'cx-categories',
          'connectea:task_type_overrides',
          'connectea:preferences',
          'connectify:preferences',
          'connectify:general_cohort_size',
          'connectify:atar_percentage',
          'connectify:auto_expand'
        ];
        for (const k of directKeys) localStorage.removeItem(k);
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('connectify:baselines:') || k.startsWith('connectea:baselines:') || k.startsWith('connectea:class_categories:'))) {
            toRemove.push(k);
          }
        }
        for (const k of toRemove) localStorage.removeItem(k);
        localStorage.setItem(CACHE_KEYS.SETTINGS, CACHE_VERSIONS.SETTINGS);
        window.dispatchEvent(new CustomEvent('connectify-settings-updated'));
      } catch (e) {
        console.warn('ConnectifyCache: failed to clear settings cache', e);
      }
    },

    clearCohortCache() {
      try {
        statsCache.clear();
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('connectea:cohort:v3:') || k.startsWith('connectify:stats_cache:'))) {
            toRemove.push(k);
          }
        }
        for (const k of toRemove) localStorage.removeItem(k);
        if (window.ConnectifyCohortEstimator?.memory) {
          window.ConnectifyCohortEstimator.memory.clear();
        }
        localStorage.setItem(CACHE_KEYS.COHORT, CACHE_VERSIONS.COHORT);
        window.dispatchEvent(new CustomEvent('connectify-cohort-invalidated'));
      } catch (e) {
        console.warn('ConnectifyCache: failed to clear cohort cache', e);
      }
    },

    clearAllCaches() {
      this.clearPredictorCache();
      this.clearResultsCache();
      this.clearSettingsCache();
      this.clearCohortCache();
    },

    invalidateSubsystem(name) {
      const norm = String(name || '').toLowerCase().trim();
      if (norm === 'predictor' || norm === 'pred') {
        this.clearPredictorCache();
      } else if (norm === 'results' || norm === 'result' || norm === 'grades') {
        this.clearResultsCache();
      } else if (norm === 'settings' || norm === 'categories') {
        this.clearSettingsCache();
      } else if (norm === 'cohort') {
        this.clearCohortCache();
      } else if (norm === 'all') {
        this.clearAllCaches();
      }
    },

    checkAndInvalidateAll() {
      try {
        if (localStorage.getItem(CACHE_KEYS.PREDICTOR) !== CACHE_VERSIONS.PREDICTOR) {
          this.clearPredictorCache();
        }
        if (localStorage.getItem(CACHE_KEYS.RESULTS) !== CACHE_VERSIONS.RESULTS) {
          this.clearResultsCache();
        }
        const storedSettingsVer = localStorage.getItem(CACHE_KEYS.SETTINGS);
        if (storedSettingsVer === null) {
          localStorage.setItem(CACHE_KEYS.SETTINGS, CACHE_VERSIONS.SETTINGS);
        } else if (storedSettingsVer !== CACHE_VERSIONS.SETTINGS) {
          this.clearSettingsCache();
        }
        if (localStorage.getItem(CACHE_KEYS.COHORT) !== CACHE_VERSIONS.COHORT) {
          this.clearCohortCache();
        }
      } catch {}
    }
  };

  window.ConnectifyCache = ConnectifyCache;
  ConnectifyCache.checkAndInvalidateAll();

  function parseSemester(card) {
    const title = normalize(
      card.querySelector('.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading')?.textContent ||
      card.getAttribute('data-subject-title') ||
      card.getAttribute('aria-label') ||
      ''
    );
    const match = title.match(/Semester\s*([12])/i) || title.match(/Sem\s*([12])/i);
    return match ? +match[1] : 1;
  }

  /**
   * Scrapes tasks from a single subject card and updates subjectsCache.
   */
  function scrapeSubjectTasks(card) {
    if (!card) return;
    const title = normalize(
      card.querySelector('.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading')?.textContent ||
      card.getAttribute('data-subject-title') ||
      card.getAttribute('aria-label') ||
      ''
    );
    if (!title) return;

    const subjectName = title
      .replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '')
      .replace(/\s*[-–—]\s*Sem\s*[12].*$/i, '')
      .trim();
    if (!subjectName) return;

    const taskRows = Array.from(card.querySelectorAll('.cvr-c-tasks .cvr-c-task'));
    if (taskRows.length === 0) return;

    if (!subjectsCache.has(subjectName)) {
      subjectsCache.set(subjectName, new Map());
    }
    const tasks = subjectsCache.get(subjectName);
    const occurrences = new Map();

    for (const row of taskRows) {
      if (!row.closest('.cvr-c-tasks')) continue;

      const labels = Array.from(row.querySelectorAll('.cvr-c-task__details .v-label'))
        .map(e => normalize(e.textContent))
        .filter(Boolean);
      if (labels.length === 0) continue;

      const rawMarkText = normalize(row.querySelector('.cvr-c-task__marks .cvr-c-task__mark')?.textContent);
      const scoreMatch = rawMarkText.match(/^(\d+(?:\.\d+)?)\s*Out\s+of\s+(\d+(?:\.\d+)?)$/i);
      const slashMatch = rawMarkText.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/i);
      const percentMatch = rawMarkText.match(/^(-?\d+(?:\.\d+)?)\s*%$/i) || rawMarkText.match(/(-?\d+(?:\.\d+)?)\s*%/i);
      const isPending = /^[-–—]\s*(?:Out\s+of|\/)\s*\d/i.test(rawMarkText) ||
                        /^[-–—\s]+$/i.test(rawMarkText) ||
                        /pending|not\s*marked/i.test(rawMarkText);

      let score = null;
      let maxScore = null;
      let isCompleted = false;

      if (scoreMatch && +scoreMatch[2] > 0) {
        if (+scoreMatch[1] <= +scoreMatch[2]) {
          score = (+scoreMatch[1] / +scoreMatch[2]) * 100;
          maxScore = +scoreMatch[2];
          isCompleted = true;
        }
      } else if (slashMatch && +slashMatch[2] > 0) {
        if (+slashMatch[1] <= +slashMatch[2]) {
          score = (+slashMatch[1] / +slashMatch[2]) * 100;
          maxScore = +slashMatch[2];
          isCompleted = true;
        }
      } else if (percentMatch) {
        score = Number(percentMatch[1]);
        maxScore = 100;
        isCompleted = true;
      }

      if (!isCompleted && !isPending) continue;

      if (!maxScore) {
        maxScore = Number(rawMarkText.match(/(?:Out\s+of|\/)\s*(\d+(?:\.\d+)?)/i)?.[1]) || 100;
      }

      const weightElement = row.querySelectorAll('.cvr-c-task__marks .cvr-c-task__mark')[1];
      const weightText = normalize(weightElement?.textContent);
      let weight = null;
      const weightFracMatch = weightText.match(/^(\d+(?:\.\d+)?|[-–—])\s*(?:Out\s+of|\/)\s*(\d+(?:\.\d+)?)$/i);
      if (weightFracMatch) {
        const den = Number(weightFracMatch[2]);
        const num = (weightFracMatch[1] === '-' || weightFracMatch[1] === '–' || weightFracMatch[1] === '—')
          ? null
          : Number(weightFracMatch[1]);
        if (den === 0) {
          weight = 0;
        } else if (den === 100) {
          weight = num !== null ? num : 100;
        } else if (den > 0 && den < 100) {
          weight = den;
        } else {
          weight = (num !== null && den > 0) ? (num / den) * 100 : den;
        }
      } else {
        const weightMatch = weightText.match(/(\d+(?:\.\d+)?)\s*%/i) ||
                            weightText.match(/(?:Out\s+of|\/)\s*(\d+(?:\.\d+)?)/i) ||
                            weightText.match(/^(\d+(?:\.\d+)?)$/i);
        weight = weightMatch ? Number(weightMatch[1]) : null;
      }
      if (weight !== null && !Number.isFinite(weight)) {
        weight = null;
      }

      const taskName = (labels.length ? labels[labels.length - 1] : '') || `Assessment ${tasks.size + 1}`;
      const caption = correctedCaption(title, taskName, labels[1] || '');

      // Deduplicate tasks repeated across Semester 1 and Semester 2 outlines:
      const existingSameName = Array.from(tasks.values()).find(
        t => normalize(t.name).toLowerCase() === normalize(taskName).toLowerCase()
      );
      if (existingSameName) {
        // If already completed in Sem 1 and current is pending, ignore the unfinished Sem 2 clone
        if (existingSameName.score !== null && !isCompleted) {
          continue;
        }
        // If both are unfinished/pending, avoid duplicating the task in the list
        if (existingSameName.pending && !isCompleted) {
          Object.defineProperty(existingSameName, 'row', { value: row });
          continue;
        }
      }

      const identityKey = JSON.stringify([labels, maxScore]);
      const occurrenceCount = occurrences.get(identityKey) || 0;
      occurrences.set(identityKey, occurrenceCount + 1);

      const id = `${identityKey}:${occurrenceCount}`;
      const existingTask = tasks.get(id);

      const record = {
        id,
        name: taskName,
        caption,
        score: isCompleted ? score : null,
        pending: !isCompleted,
        weight,
        mean: cohortMean(row),
        semester: Math.min(parseSemester(card), existingTask?.semester ?? 2),
        order: (() => {
           const customOrder = localStorage.getItem(`connectea:time_override:${subjectName}:${taskName}`) ||
                               localStorage.getItem(`connectea:time_override:${title}:${taskName}`);
           if (customOrder !== null && customOrder !== '') {
              const num = Number(customOrder);
              if (Number.isFinite(num) && num > 0) {
                 const term = Math.floor((num - 1) / 10) + 1;
                 const week = ((num - 1) % 10) + 1;
                 return (term - 1) * 12 + week;
              }
           }
           return orderHint(caption);
        })(),
        sequence: existingTask?.sequence ?? tasks.size
      };

      // Extract and cache 5-number boxplot statistics if present on the row
      const chartHost = row.querySelector('[data-highcharts-chart], .cvr-c-task__chart');
      if (chartHost?.dataset?.connectifyStats) {
        try {
          const parsed = JSON.parse(chartHost.dataset.connectifyStats);
          if (Array.isArray(parsed) && parsed.length === 5) {
            setTaskStats(subjectName, taskName, parsed, chartHost.dataset.connectifyN);
            record.stats = parsed;
          }
        } catch {}
      }
      if (!record.stats) {
        const cached = getTaskStats(subjectName, taskName);
        if (cached) record.stats = cached;
      }

      Object.defineProperty(record, 'row', { value: row });
      tasks.set(id, record);
    }
  }

  /**
   * Scrape all subject assessment cards currently present in the DOM.
   * Caches results so data persists even when cards are collapsed by the user.
   *
   * @param {boolean} includePending - Whether to include pending/unmarked assessments
   * @returns {Array<{name: string, tasks: Array<Object>}>} Array of subject records
   */
  function collect(includePending = false) {
    const cards = Array.from(document.querySelectorAll('.eds-c-tile, .cvr-c-tile, [data-subject-card]'))
      .sort((a, b) => parseSemester(a) - parseSemester(b));

    for (const card of cards) {
      scrapeSubjectTasks(card);
    }

    return Array.from(subjectsCache, ([name, tasks]) => ({
      name,
      tasks: Array.from(tasks.values())
        .filter(t => {
          if (/^Assessment\s+\d+$/i.test(t.name) && !t.caption && (t.weight === null || t.weight === 0)) return false;
          return includePending || !t.pending;
        })
        .sort((a, b) => {
          if (a.order !== null && b.order !== null) return a.order - b.order;
          return a.sequence - b.sequence;
        })
    }));
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
        scrapeSubjectTasks(card);
        const cardTitle = normalize(
          card.querySelector('.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading')?.textContent ||
          card.getAttribute('data-subject-title') ||
          card.getAttribute('aria-label') ||
          ''
        ).replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '').trim();
        if (cardTitle && subjectsCache.has(cardTitle)) {
          subjects = [{ name: cardTitle, tasks: Array.from(subjectsCache.get(cardTitle).values()) }];
        }
      } else {
        subjects = collect(true);
      }

      // Pre-cache predictions for newly revealed tasks so row renders hit cache in O(1)
      if (window.ConnectifyPredictorMath?.populateChronologicalPredictions) {
        try {
          const list = subjects || collect(true);
          window.ConnectifyPredictorMath.populateChronologicalPredictions(list, false);
        } catch (e) {}
      }

      if (window.ConnectifyCohort?.schedule) {
        window.ConnectifyCohort.schedule();
      }

      // Only run visual updates on open/active tool views to prevent layout thrashing
      const weaknessOpen = !document.getElementById('connectea-radar')?.hidden;
      if (weaknessOpen && window.ConnectifyWeakness?.renderChart) {
        window.ConnectifyWeakness.renderChart();
      }
      const progressOpen = !document.getElementById('connectea-progress')?.hidden;
      if (progressOpen && window.ConnectifyProgress?.update) {
        window.ConnectifyProgress.update();
      }
      if (window.ConnectifyCompoundProgress?.update) {
        window.ConnectifyCompoundProgress.update();
      }
      if (window.ConnectifyAtar?.refreshData) {
        window.ConnectifyAtar.refreshData();
      }

      window.dispatchEvent(new CustomEvent('connectify-results-updated', { detail: { card } }));
    }, 250);
  }

  /**
   * Extract estimated cohort mean from Highcharts boxplot series on a task row.
   *
   * @param {Element} row - The task row DOM node
   * @returns {number|null} Estimated cohort mean percentage, or null
   */
  function cohortMean(row) {
    const host = row.querySelector('[data-highcharts-chart]') ||
                 row.querySelector('.cvr-c-task__chart [data-highcharts-chart]') ||
                 row.querySelector('.cvr-c-task__chart');
    if (!host) return null;

    if (host.dataset?.connectifyStats) {
      try {
        const stats = JSON.parse(host.dataset.connectifyStats);
        if (Array.isArray(stats) && stats.length === 5 && stats.every(Number.isFinite)) {
          return (stats[0] + 2 * stats[1] + 2 * stats[2] + 2 * stats[3] + stats[4]) / 8;
        }
      } catch {}
    }

    const hostWithDataset = host.querySelector?.('[data-connectify-stats]') || host.closest?.('[data-connectify-stats]');
    if (hostWithDataset?.dataset?.connectifyStats) {
      try {
        const stats = JSON.parse(hostWithDataset.dataset.connectifyStats);
        if (Array.isArray(stats) && stats.length === 5 && stats.every(Number.isFinite)) {
          return (stats[0] + 2 * stats[1] + 2 * stats[2] + 2 * stats[3] + stats[4]) / 8;
        }
      } catch {}
    }

    const chartIndex = Number(host.getAttribute('data-highcharts-chart'));
    const chart = window.Highcharts?.charts?.[chartIndex];
    if (!chart || (chart.container && !host.contains(chart.container))) return null;

    for (const series of chart.series || []) {
      const dataPoints = [...(series.points || []), ...(series.options?.data || [])];
      for (const point of dataPoints) {
        const pointData = point?.options || point;
        const stats = Array.isArray(pointData)
          ? pointData.slice(-5)
          : [pointData?.low, pointData?.q1, pointData?.median, pointData?.q3, pointData?.high];

        const isCompleteBoxplot =
          stats.length === 5 &&
          stats.every(v => typeof v === 'number' && Number.isFinite(v)) &&
          stats.every((v, i) => !i || v >= stats[i - 1]);

        if (isCompleteBoxplot) {
          // Weighted 5-number summary mean estimation: (min + 2*Q1 + 2*Median + 2*Q3 + max) / 8
          return (stats[0] + 2 * stats[1] + 2 * stats[2] + 2 * stats[3] + stats[4]) / 8;
        }
      }
    }

    return null;
  }

  let isBulkExpanding = false;
  let bulkExpandTimer = null;

  /**
   * Programmatically click the accordion headers to expand or collapse details.
   * Staggered across animation frames to eliminate thread blocking and extreme lag.
   * On first bulk expansion, mounts an animated progress pill (#cx-expand-progress)
   * and pre-caches chronological predictions across all tasks.
   */
  function expandAll(expand = true) {
    if (isBulkExpanding) return;
    const pattern = expand ? /show details/i : /hide details/i;
    const headings = Array.from(
      document.querySelectorAll(
        '.eds-c-tile .eds-c-accordion__section-heading, .cvr-c-tile .eds-c-accordion__section-heading, .cvr-c-tile .cvr-c-accordion__section-heading, .eds-c-accordion__section-heading, .cvr-c-accordion__section-heading'
      )
    ).filter(h => pattern.test(h.textContent));

    if (headings.length === 0) return;

    isBulkExpanding = true;
    let clickedAny = false;
    let index = 0;
    const total = headings.length;

    // Progress bar initialization for expanding outlines
    let progressPill = null;
    let progressBar = null;
    let progressText = null;

    if (expand) {
      progressPill = document.getElementById('cx-expand-progress');
      if (!progressPill) {
        progressPill = document.createElement('div');
        progressPill.id = 'cx-expand-progress';
        progressPill.className = 'cx-expand-progress-pill';
        progressPill.innerHTML = `
          <div class="cx-expand-spinner"></div>
          <span class="cx-expand-label">Expanding outlines... 0%</span>
          <div class="cx-expand-track"><div class="cx-expand-bar" style="width: 0%"></div></div>
        `;
        document.body.appendChild(progressPill);
      }
      progressBar = progressPill.querySelector('.cx-expand-bar');
      progressText = progressPill.querySelector('.cx-expand-label');
      updateProgress(0, 'Expanding outlines... 0%');
    }

    function updateProgress(pct, msg) {
      if (!progressPill) return;
      if (progressBar) progressBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
      if (progressText && msg) progressText.textContent = msg;
    }

    function finishProgress() {
      if (!progressPill) return;
      updateProgress(100, '✓ Outlines expanded & predictions cached');
      setTimeout(() => {
        if (progressPill) {
          progressPill.style.opacity = '0';
          progressPill.style.transform = 'translate(-50%, -10px)';
          setTimeout(() => progressPill?.remove(), 350);
        }
      }, 600);
    }

    function clickNext() {
      if (index >= total) {
        clearTimeout(bulkExpandTimer);

        function finalizeExpansion() {
          isBulkExpanding = false;
          if (expand && clickedAny) {
            updateProgress(90, 'Caching predictions...');
            try {
              const all = collect(true);
              if (window.ConnectifyPredictorMath?.populateChronologicalPredictions) {
                window.ConnectifyPredictorMath.populateChronologicalPredictions(all, false);
              }
            } catch (e) {
              console.warn('Prediction pre-cache error:', e);
            }
            notifyResultsUpdated();
            if (window.ConnectifyCohort?.schedule) {
              window.ConnectifyCohort.schedule(true);
            }
            if (window.ConnectifyCompoundProgress?.update) {
              window.ConnectifyCompoundProgress.update();
            }
          }
          finishProgress();
        }

        if (!clickedAny || !expand) {
          bulkExpandTimer = setTimeout(finalizeExpansion, 150);
          return;
        }

        // Active readiness polling: wait for all opened cards to mount their task rows
        const startTime = Date.now();
        const pollTimer = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const allSettled = headings.every(h => {
            const card = h.closest('.eds-c-tile, .cvr-c-tile') || h.parentElement;
            if (!card) return true;
            if (/show details/i.test(h.textContent)) return false;
            return card.querySelectorAll('.cvr-c-task').length > 0 || elapsed > 2500;
          });

          if (allSettled || elapsed > 2500) {
            clearInterval(pollTimer);
            finalizeExpansion();
          }
        }, 60);
        return;
      }

      const heading = headings[index++];
      const pct = Math.round((index / total) * (expand ? 85 : 100));
      if (progressPill) {
        updateProgress(pct, `Expanding outlines... ${index}/${total} (${pct}%)`);
      }

      if (pattern.test(heading.textContent)) {
        const btn = heading.querySelector('button, .v-button, [role="button"]') ||
          (heading.matches('button, [role="button"]') ? heading : null);
        if (btn) {
          btn.click();
          clickedAny = true;
        } else {
          heading.click();
          clickedAny = true;
        }
      }
      setTimeout(clickNext, 65);
    }

    clickNext();
  }

  let animGuardTimer = null;
  function triggerAccordionAnimationGuard(duration = 380) {
    window.ConnectifyIsAccordionAnimating = true;
    clearTimeout(animGuardTimer);
    animGuardTimer = setTimeout(() => {
      window.ConnectifyIsAccordionAnimating = false;
    }, duration);
  }
  window.ConnectifyTriggerAccordionAnimationGuard = triggerAccordionAnimationGuard;

  // Listen for user clicks on subject accordion headers to update results cache immediately upon expansion
  document.addEventListener('click', e => {
    const heading = e.target.closest('.eds-c-accordion__section-heading, .cvr-c-accordion__section-heading');
    if (!heading) return;

    // Immediately trigger global animation guard so all background observers stay completely silent
    triggerAccordionAnimationGuard(380);

    if (isBulkExpanding) return;
    const card = heading.closest('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile');
    if (!card) return;

    // Detect intent immediately at click time:
    const wasCollapsed = /show details/i.test(heading.textContent);
    if (!wasCollapsed) {
      // User is collapsing the accordion, skip expensive rescrapes and re-renders
      return;
    }

    setTimeout(() => {
      // If heading indicates collapsed state (or was collapsed), skip heavy whole-page updates
      if (/show details/i.test(heading.textContent)) return;
      if (card.querySelector('.cvr-c-tasks .cvr-c-task') || /hide details/i.test(heading.textContent)) {
        notifyResultsUpdated(card);
      }
    }, 320);
  }, true);

  // Observe DOM additions inside subject tiles when expanded
  const expandMutationObserver = new MutationObserver(mutations => {
    if (isBulkExpanding || window.ConnectifyIsAccordionAnimating) return;
    let expandedCard = null;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            if (node.matches?.('.cvr-c-task') || node.querySelector?.('.cvr-c-task')) {
              expandedCard = node.closest('.eds-c-tile');
              if (expandedCard) break;
            }
          }
        }
      }
      if (expandedCard) break;
    }
    if (expandedCard) {
      notifyResultsUpdated(expandedCard);
    }
  });

  if (document.body) {
    expandMutationObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      expandMutationObserver.observe(document.body, { childList: true, subtree: true });
    });
  }

  // Publish public API
  window.ConnectifyData = {
    collect,
    cohortMean,
    orderHint,
    correctedCaption,
    expandAll,
    scrapeSubjectTasks,
    notifyResultsUpdated,
    getTaskStats,
    setTaskStats,
    getSubjectTasks,
    clearCache: () => {
      subjectsCache.clear();
      statsCache.clear();
    },
    cache: ConnectifyCache
  };
  } catch (err) {
    console.error('Connectify error in assessment-data.js:', err);
  }
})();

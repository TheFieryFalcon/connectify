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
    PREDICTOR: 'v9_20261001_pred',
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
          if (k && (k.startsWith('connectify:grade_cache:') || k.startsWith('connectify:subjects_cache'))) {
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

  function getSubjectsCacheKey() {
    return `connectify:subjects_cache:${getStudentId()}`;
  }

  function serializeSubjects(sourceMapOrArray) {
    const out = {};
    if (sourceMapOrArray instanceof Map) {
      for (const [sName, tasksMap] of sourceMapOrArray.entries()) {
        const list = tasksMap instanceof Map ? Array.from(tasksMap.values()) : (Array.isArray(tasksMap) ? tasksMap : []);
        out[sName] = list.map(t => {
          const copy = { ...t };
          delete copy.row;
          return copy;
        });
      }
    } else if (Array.isArray(sourceMapOrArray)) {
      for (const item of sourceMapOrArray) {
        if (item && item.name) {
          out[item.name] = (item.tasks || []).map(t => {
            const copy = { ...t };
            delete copy.row;
            return copy;
          });
        }
      }
    }
    return out;
  }

  function saveSubjectsCache(source) {
    try {
      const serialized = serializeSubjects(source || subjectsCache);
      const json = JSON.stringify(serialized);
      localStorage.setItem(getSubjectsCacheKey(), json);
      localStorage.setItem('connectify:subjects_cache:current', json);
    } catch (e) {
      console.warn('Connectify failed to save subjects cache:', e);
    }
  }

  function loadSubjectsCache() {
    try {
      const raw = localStorage.getItem(getSubjectsCacheKey()) || localStorage.getItem('connectify:subjects_cache:current');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return false;

      subjectsCache.clear();
      for (const [subjName, tasksList] of Object.entries(parsed)) {
        const tasksMap = new Map();
        if (Array.isArray(tasksList)) {
          for (const t of tasksList) {
            if (t && t.id) tasksMap.set(t.id, t);
          }
        }
        if (tasksMap.size > 0) {
          subjectsCache.set(subjName, tasksMap);
        }
      }
      return subjectsCache.size > 0;
    } catch (e) {
      console.warn('Connectify failed to load subjects cache:', e);
      return false;
    }
  }

  loadSubjectsCache();

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

  function setTaskRow(task, rowEl) {
    if (!task) return;
    try {
      Object.defineProperty(task, 'row', {
        value: rowEl,
        writable: true,
        configurable: true,
        enumerable: false
      });
    } catch {
      task.row = rowEl;
    }
  }

  /**
   * Parses tasks from a single subject card into records without modifying cache or DOM.
   */
  function parseCardSubjectTasks(card) {
    if (!card) return null;
    const title = normalize(
      card.querySelector('.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading')?.textContent ||
      card.getAttribute('data-subject-title') ||
      card.getAttribute('aria-label') ||
      ''
    );
    if (!title) return null;

    const subjectName = title
      .replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '')
      .replace(/\s*[-–—]\s*Sem\s*[12].*$/i, '')
      .trim();
    if (!subjectName) return null;

    const taskRows = Array.from(card.querySelectorAll('.cvr-c-tasks .cvr-c-task'));
    if (taskRows.length === 0) return null;

    const parsedTasks = [];
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

      const taskName = (labels.length ? labels[labels.length - 1] : '') || `Assessment ${parsedTasks.length + 1}`;
      const caption = correctedCaption(title, taskName, labels[1] || '');

      const identityKey = JSON.stringify([labels, maxScore]);
      const occurrenceCount = occurrences.get(identityKey) || 0;
      occurrences.set(identityKey, occurrenceCount + 1);

      const id = `${identityKey}:${occurrenceCount}`;

      const record = {
        id,
        name: taskName,
        caption,
        score: isCompleted ? score : null,
        pending: !isCompleted,
        weight,
        mean: cohortMean(row),
        semester: parseSemester(card),
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
        sequence: parsedTasks.length
      };

      const chartHost = row.querySelector('[data-highcharts-chart], .cvr-c-task__chart');
      if (chartHost?.dataset?.connectifyStats) {
        try {
          const parsed = JSON.parse(chartHost.dataset.connectifyStats);
          if (Array.isArray(parsed) && parsed.length === 5) {
            record.stats = parsed;
          }
        } catch {}
      }
      if (!record.stats) {
        const cached = getTaskStats(subjectName, taskName);
        if (cached) record.stats = cached;
      }

      setTaskRow(record, row);
      parsedTasks.push(record);
    }

    return { title, subjectName, tasks: parsedTasks };
  }

  const STALE_SUBJECTS_KEY = 'connectify:stale_subjects';

  function getStaleSubjects() {
    try {
      const raw = localStorage.getItem(STALE_SUBJECTS_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr.map(s => normalize(s).toLowerCase()));
      }
    } catch {}
    return new Set();
  }

  function saveStaleSubjects(staleSet) {
    try {
      localStorage.setItem(STALE_SUBJECTS_KEY, JSON.stringify(Array.from(staleSet)));
    } catch {}
  }

  function markSubjectStale(subjectName) {
    if (!subjectName) return;
    const staleSet = getStaleSubjects();
    staleSet.add(normalize(subjectName).toLowerCase());
    saveStaleSubjects(staleSet);

    if (window.ConnectifyPredictorMath?.clearSubjectPredictionCache) {
      try {
        window.ConnectifyPredictorMath.clearSubjectPredictionCache(subjectName);
      } catch {}
    }
  }

  function unmarkSubjectStale(subjectName) {
    if (!subjectName) return;
    const staleSet = getStaleSubjects();
    const key = normalize(subjectName).toLowerCase().replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '').trim();
    if (staleSet.has(key)) {
      staleSet.delete(key);
    }
    for (const item of Array.from(staleSet)) {
      const cleanItem = normalize(item).toLowerCase().replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '').trim();
      if (cleanItem && (key === cleanItem || key.includes(cleanItem) || cleanItem.includes(key))) {
        staleSet.delete(item);
      }
    }
    saveStaleSubjects(staleSet);
  }

  function isSubjectStale(subjectName) {
    if (!subjectName) return false;
    const staleSet = getStaleSubjects();
    if (staleSet.size === 0) return false;
    const norm = normalize(subjectName).toLowerCase().replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '').trim();
    if (!norm) return false;
    if (staleSet.has(norm)) return true;
    for (const item of staleSet) {
      const cleanItem = normalize(item).toLowerCase().replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '').trim();
      if (cleanItem && (norm === cleanItem || norm.includes(cleanItem) || cleanItem.includes(norm))) {
        return true;
      }
    }
    return false;
  }

  /**
   * Scrapes tasks from a single subject card and updates subjectsCache.
   */
  function scrapeSubjectTasks(card, forceRefresh = false, updatedStaleSubjects = null) {
    if (!card) return;
    const parsed = parseCardSubjectTasks(card);
    if (!parsed) return;
    const { title, subjectName, tasks: parsedTasks } = parsed;

    const isStale = isSubjectStale(subjectName);
    const hasCache = subjectsCache.has(subjectName) && subjectsCache.get(subjectName).size > 0;

    // If cache exists and card is not stale, check if all parsed tasks from this card are already in cache
    if (!forceRefresh && !isStale && hasCache) {
      const existingMap = subjectsCache.get(subjectName);
      const allTasksPresent = parsedTasks.every(t => existingMap.has(t.id));
      if (allTasksPresent) {
        for (const t of parsedTasks) {
          const cached = existingMap.get(t.id);
          if (cached && t.row && !cached.row) {
            setTaskRow(cached, t.row);
          }
        }
        return;
      }
    }

    if (!subjectsCache.has(subjectName)) {
      subjectsCache.set(subjectName, new Map());
    }
    const tasks = subjectsCache.get(subjectName);

    for (const record of parsedTasks) {
      const taskName = record.name;
      const isCompleted = !record.pending;

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
          if (record.row) setTaskRow(existingSameName, record.row);
          continue;
        }
      }

      const existingTask = tasks.get(record.id);
      if (existingTask) {
        record.semester = Math.min(record.semester, existingTask.semester ?? 2);
        record.sequence = existingTask.sequence ?? tasks.size;
      }

      if (record.stats && record.row) {
        const chartHost = record.row.querySelector('[data-highcharts-chart], .cvr-c-task__chart');
        if (chartHost?.dataset?.connectifyStats) {
          setTaskStats(subjectName, taskName, record.stats, chartHost.dataset.connectifyN);
        }
      }

      tasks.set(record.id, record);
    }

    if (isStale) {
      unmarkSubjectStale(subjectName);
      if (updatedStaleSubjects) {
        updatedStaleSubjects.add(subjectName);
      } else if (window.ConnectifyPredictorMath?.updatePredictionCache) {
        try {
          window.ConnectifyPredictorMath.updatePredictionCache(subjectName);
        } catch {}
      }
    }

    saveSubjectsCache();
  }

  function hasCachedSubjects() {
    if (subjectsCache.size === 0) return false;
    for (const tasks of subjectsCache.values()) {
      if (tasks && tasks.size > 0) return true;
    }
    return false;
  }

  function formatCollectedSubjects(includePending) {
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
   * Scrape all subject assessment cards currently present in the DOM.
   * Caches results so data persists even when cards are collapsed by the user.
   * Uses cache and stops DOM scraping if a valid cache exists.
   *
   * @param {boolean} includePending - Whether to include pending/unmarked assessments
   * @param {boolean} forceRefresh - Whether to force re-scraping from the DOM
   * @returns {Array<{name: string, tasks: Array<Object>}>} Array of subject records
   */
  let isCollecting = false;
  function collect(includePending = false, forceRefresh = false) {
    if (isCollecting) {
      return formatCollectedSubjects(includePending);
    }
    const staleSet = getStaleSubjects();
    // Use the cache if there is a cache, no forced refresh, and no subjects are marked stale
    if (!forceRefresh && staleSet.size === 0 && hasCachedSubjects()) {
      return formatCollectedSubjects(includePending);
    }

    isCollecting = true;
    const updatedStaleSubjects = new Set();
    try {
      const cards = Array.from(document.querySelectorAll('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile'))
        .sort((a, b) => parseSemester(a) - parseSemester(b));

      for (const card of cards) {
        scrapeSubjectTasks(card, forceRefresh, updatedStaleSubjects);
      }
    } finally {
      isCollecting = false;
    }

    if (updatedStaleSubjects.size > 0 && window.ConnectifyPredictorMath?.updatePredictionCache) {
      try {
        window.ConnectifyPredictorMath.updatePredictionCache();
      } catch {}
    }

    return formatCollectedSubjects(includePending);
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
        const cardTitle = normalize(
          card.querySelector('.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading')?.textContent ||
          card.getAttribute('data-subject-title') ||
          card.getAttribute('aria-label') ||
          ''
        ).replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '').trim();

        if (!subjectsCache.has(cardTitle) || isSubjectStale(cardTitle)) {
          scrapeSubjectTasks(card, isSubjectStale(cardTitle));
        } else {
          scrapeSubjectTasks(card, false);
        }

        if (cardTitle && subjectsCache.has(cardTitle)) {
          subjects = [{ name: cardTitle, tasks: Array.from(subjectsCache.get(cardTitle).values()) }];
        }
      } else {
        subjects = collect(true);
      }

      // Pre-cache predictions only if a valid cache is missing
      if (window.ConnectifyPredictorMath?.populateChronologicalPredictions) {
        try {
          if (!window.ConnectifyPredictorMath.isPredictionCacheCurrent?.()) {
            const list = subjects || collect(true);
            window.ConnectifyPredictorMath.populateChronologicalPredictions(list, false);
          }
        } catch (e) {}
      }

      if (window.ConnectifyCohort?.schedule) {
        window.ConnectifyCohort.schedule();
      }

      // Only run visual updates on open/active tool views to prevent layout thrashing
      const weaknessOpen = !document.getElementById('connectea-radar')?.hidden;
      const progressOpen = !document.getElementById('connectify-progress-graph-container')?.hidden;
      if (weaknessOpen && window.ConnectifyWeakness?.render) {
        window.ConnectifyWeakness.render();
      }
      if (progressOpen && window.ConnectifyProgressGraph?.render) {
        window.ConnectifyProgressGraph.render();
      }
      if (window.ConnectifyCompoundProgress?.update) {
        window.ConnectifyCompoundProgress.update();
      }
      if (window.ConnectifyAtar?.refreshData) {
        window.ConnectifyAtar.refreshData();
      }

      window.dispatchEvent(new CustomEvent('connectify-results-updated', { detail: { card } }));
    }, 40);
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
    const rawHeadings = Array.from(
      document.querySelectorAll(
        '.eds-c-tile .eds-c-accordion__section-heading, .cvr-c-tile .eds-c-accordion__section-heading, .cvr-c-tile .cvr-c-accordion__section-heading, .eds-c-accordion__section-heading, .cvr-c-accordion__section-heading'
      )
    ).filter(h => pattern.test(h.textContent));

    // Deduplicate by card: each card must only have its single canonical accordion heading clicked once
    const seenCards = new Set();
    const headings = [];
    for (const h of rawHeadings) {
      const card = typeof h.closest === 'function' ? h.closest('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile, [class*="tile"], [class*="card"]') : null;
      if (card && seenCards.has(card)) continue;
      if (card) seenCards.add(card);
      headings.push(h);
    }

    if (headings.length === 0) return;

    isBulkExpanding = true;
    window.ConnectifyIsBulkExpanding = true;
    window.ConnectifyIsAccordionAnimating = true;
    let clickedAny = false;
    let index = 0;
    const total = headings.length;

    // Progress bar initialization for expanding outlines
    let progressPill = null;
    let progressBar = null;
    let progressText = null;

    function unlockScroll() {
      document.documentElement.classList.remove('cx-freeze-scroll');
      document.body.classList.remove('cx-freeze-scroll');
    }

    if (expand) {
      document.documentElement.classList.add('cx-freeze-scroll');
      document.body.classList.add('cx-freeze-scroll');

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
      unlockScroll();
      if (!progressPill) return;
      updateProgress(100, '✓ Outlines expanded & statistics updated');
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
          try {
            if (expand && clickedAny) {
              const hasValidCache = Boolean(window.ConnectifyPredictorMath?.isPredictionCacheCurrent?.());
              if (!hasValidCache) {
                updateProgress(90, 'Caching predictions... 90%');
                try {
                  const all = collect(true);
                  if (window.ConnectifyPredictorMath?.populateChronologicalPredictions) {
                    window.ConnectifyPredictorMath.populateChronologicalPredictions(all, true);
                  }
                } catch (e) {
                  console.warn('Prediction pre-cache error:', e);
                }
              }

              updateProgress(95, 'Rendering statistics & outcome bars... 95%');

              setTimeout(() => {
                try {
                  clearTimeout(notifyUpdateTimer);
                  if (window.ConnectifyCohort?.pass) {
                    window.ConnectifyCohort.pass();
                  } else if (window.ConnectifyCohort?.schedule) {
                    window.ConnectifyCohort.schedule(true);
                  }
                  if (window.ConnectifyCompoundProgress?.update) {
                    window.ConnectifyCompoundProgress.update();
                  }
                  if (window.ConnectifyDataSyncCharts) {
                    window.ConnectifyDataSyncCharts();
                  }
                  const staleSet = getStaleSubjects();
                  if (staleSet.size > 0) {
                    collect(true, true);
                  }

                  const completeFinalize = () => {
                    try {
                      updateProgress(100, 'Ready! 100%');
                    } finally {
                      isBulkExpanding = false;
                      window.ConnectifyIsBulkExpanding = false;
                      window.ConnectifyIsAccordionAnimating = false;
                      finishProgress();
                    }
                  };

                  if (typeof requestAnimationFrame === 'function') {
                    requestAnimationFrame(() => {
                      requestAnimationFrame(completeFinalize);
                    });
                  } else {
                    completeFinalize();
                  }
                } catch (e) {
                  isBulkExpanding = false;
                  window.ConnectifyIsBulkExpanding = false;
                  window.ConnectifyIsAccordionAnimating = false;
                  finishProgress();
                }
              }, 40);
            } else {
              isBulkExpanding = false;
              window.ConnectifyIsBulkExpanding = false;
              finishProgress();
              setTimeout(() => {
                window.ConnectifyIsAccordionAnimating = false;
              }, 250);
            }
          } catch (err) {
            console.error('finalizeExpansion error:', err);
            isBulkExpanding = false;
            window.ConnectifyIsBulkExpanding = false;
            window.ConnectifyIsAccordionAnimating = false;
            finishProgress();
          }
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
            const card = (typeof h.closest === 'function' ? h.closest('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile') : null) || h.parentElement;
            if (!card) return true;
            if (/show details/i.test(h.textContent)) return false;
            return (typeof card.querySelectorAll === 'function' && card.querySelectorAll('.cvr-c-task').length > 0) || elapsed > 1500;
          });

          if (allSettled || elapsed > 1500) {
            clearInterval(pollTimer);
            finalizeExpansion();
          }
        }, 50);
        return;
      }

      const heading = headings[index++];
      const pct = Math.round((index / total) * (expand ? 85 : 100));
      if (progressPill) {
        updateProgress(pct, `Expanding outlines... ${index}/${total} (${pct}%)`);
      }

      if (pattern.test(heading.textContent)) {
        const btn = (typeof heading.querySelector === 'function' ? heading.querySelector('button, .v-button, [role="button"]') : null) ||
          (typeof heading.closest === 'function' ? heading.closest('button, [role="button"]') : null) ||
          (typeof heading.matches === 'function' && heading.matches('button, [role="button"]') ? heading : null);
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
  const pendingCardsToUpdate = new Set();
  function triggerAccordionAnimationGuard(duration = 380, cardToUpdate = null) {
    window.ConnectifyIsAccordionAnimating = true;
    if (cardToUpdate) {
      pendingCardsToUpdate.add(cardToUpdate);
    }
    clearTimeout(animGuardTimer);
    animGuardTimer = setTimeout(() => {
      window.ConnectifyIsAccordionAnimating = false;
      const cards = Array.from(pendingCardsToUpdate);
      pendingCardsToUpdate.clear();
      for (const card of cards) {
        if (!isBulkExpanding) {
          notifyResultsUpdated(card);
        }
      }
      if (cards.length > 0) {
        if (window.ConnectifyCohort?.schedule) {
          window.ConnectifyCohort.schedule(true);
        }
        if (window.ConnectifyCompoundProgress?.update) {
          window.ConnectifyCompoundProgress.update();
        }
        if (window.ConnectifyDataSyncCharts) {
          window.ConnectifyDataSyncCharts();
        }
      }
    }, duration);
  }
  window.ConnectifyTriggerAccordionAnimationGuard = triggerAccordionAnimationGuard;

  // Listen for user clicks on subject accordion headers to update results cache immediately upon expansion
  document.addEventListener('click', e => {
    const heading = e.target.closest('.eds-c-accordion__section-heading, .cvr-c-accordion__section-heading');
    if (!heading) return;

    if (isBulkExpanding) return;
    const card = heading.closest('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile');

    // Detect intent immediately at click time:
    const wasCollapsed = /show details/i.test(heading.textContent);
    if (!wasCollapsed) {
      // User is collapsing the accordion, trigger guard to suppress background observer churn
      triggerAccordionAnimationGuard(380, null);
      return;
    }

    // User is expanding: register card for guaranteed update pass when animation completes
    triggerAccordionAnimationGuard(380, card);
  });

  // Observe DOM additions inside subject tiles when expanded
  const expandMutationObserver = new MutationObserver(mutations => {
    if (window.ConnectifyIsAccordionAnimating || window.ConnectifyIsBulkExpanding) return;
    let expandedCard = null;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            if (node.matches?.('.cvr-c-task') || node.querySelector?.('.cvr-c-task')) {
              expandedCard = node.closest('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile');
              if (expandedCard) break;
            }
          }
        }
      }
      if (expandedCard) break;
    }
    if (expandedCard) {
      if (window.ConnectifyIsAccordionAnimating) {
        pendingCardsToUpdate.add(expandedCard);
      } else if (!isBulkExpanding) {
        notifyResultsUpdated(expandedCard);
      }
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
    parseCardSubjectTasks,
    hasCachedSubjects,
    saveSubjectsCache,
    loadSubjectsCache,
    notifyResultsUpdated,
    getTaskStats,
    setTaskStats,
    getSubjectTasks,
    markSubjectStale,
    unmarkSubjectStale,
    isSubjectStale,
    getStaleSubjects,
    clearCache: () => {
      subjectsCache.clear();
      statsCache.clear();
      try {
        localStorage.removeItem(getSubjectsCacheKey());
        localStorage.removeItem('connectify:subjects_cache:current');
        localStorage.removeItem('connectify:stale_subjects');
      } catch {}
    },
    cache: ConnectifyCache
  };
  } catch (err) {
    console.error('Connectify error in assessment-data.js:', err);
  }
})();

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

    const cache = window.ConnectifyCache || {};
    const parser = window.ConnectifyParser || {};
    const expander = window.ConnectifyExpand || {};

    const subjectsCache = cache.subjectsCache || new Map();
    const statsCache = cache.statsCache || new Map();

    const orderHint = parser.orderHint || function() { return null; };
    const correctedCaption = parser.correctedCaption || function(t, k, c) { return c || ''; };
    const parseSemester = parser.parseSemester || function() { return 1; };
    const setTaskRow = parser.setTaskRow || function(task, el) { task.row = el; };
    const parseCardSubjectTasks = parser.parseCardSubjectTasks || function() { return null; };
    const cohortMean = parser.cohortMean || function() { return null; };

    const expandAll = (exp = true) => (window.ConnectifyExpand?.expandAll || expander.expandAll)(exp);
    const triggerAccordionAnimationGuard = (...args) => (window.ConnectifyExpand?.triggerAccordionAnimationGuard || expander.triggerAccordionAnimationGuard)(...args);

    const getTaskStats = (...args) => (window.ConnectifyCache?.getTaskStats || cache.getTaskStats)(...args);
    const setTaskStats = (...args) => (window.ConnectifyCache?.setTaskStats || cache.setTaskStats)(...args);
    const getSubjectTasks = (...args) => (window.ConnectifyCache?.getSubjectTasks || cache.getSubjectTasks)(...args);
    const saveSubjectsCache = (...args) => (window.ConnectifyCache?.saveSubjectsCache || cache.saveSubjectsCache)(...args);
    const loadSubjectsCache = (...args) => (window.ConnectifyCache?.loadSubjectsCache || cache.loadSubjectsCache)(...args);
    const markSubjectStale = (...args) => (window.ConnectifyCache?.markSubjectStale || cache.markSubjectStale)(...args);
    const unmarkSubjectStale = (...args) => (window.ConnectifyCache?.unmarkSubjectStale || cache.unmarkSubjectStale)(...args);
    const isSubjectStale = (...args) => (window.ConnectifyCache?.isSubjectStale || cache.isSubjectStale)(...args);
    const getStaleSubjects = (...args) => (window.ConnectifyCache?.getStaleSubjects || cache.getStaleSubjects)(...args);
    const hasCachedSubjects = (...args) => (window.ConnectifyCache?.hasCachedSubjects || cache.hasCachedSubjects)();

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

  function resolveTaskOrder(subjectName, task) {
    if (!task) return null;
    const taskName = task.name || '';
    const taskId = task.id || '';

    let customOrder = null;
    if (taskId) {
      customOrder = localStorage.getItem(`connectea:time_override:${subjectName}:${taskId}`) ||
                    localStorage.getItem(`connectify:time_override:${subjectName}:${taskId}`);
    }

    if (customOrder === null || customOrder === '') {
      const cachedMap = subjectsCache.get(subjectName);
      const allTasks = cachedMap ? Array.from(cachedMap.values()) : (arguments[2] || []);
      const duplicateTasks = (Array.isArray(allTasks) && taskName)
        ? allTasks.filter(t => t && normalize(t.name).toLowerCase() === normalize(taskName).toLowerCase())
        : [];
      const isDuplicate = duplicateTasks.length > 1;
      const isFirst = !isDuplicate || (duplicateTasks.length > 0 && duplicateTasks[0] === task);

      if (isFirst && taskName) {
        customOrder = localStorage.getItem(`connectea:time_override:${subjectName}:${taskName}`) ||
                      localStorage.getItem(`connectify:time_override:${subjectName}:${taskName}`);
      }
    }

    if (customOrder !== null && customOrder !== '') {
      const num = Number(customOrder);
      if (Number.isFinite(num) && num > 0) {
        const term = Math.floor((num - 1) / 10) + 1;
        const week = ((num - 1) % 10) + 1;
        return (term - 1) * 12 + week;
      }
      const twMatch = String(customOrder).match(/t(?:erm)?\s*(\d+)\s*[,;]?\s*w(?:eek)?\s*(\d+)/i);
      if (twMatch) {
        const term = parseInt(twMatch[1], 10);
        const week = parseInt(twMatch[2], 10);
        return (term - 1) * 12 + week;
      }
    }
    if (Number.isFinite(task.order)) return task.order;
    return (task.caption && typeof orderHint === 'function') ? orderHint(task.caption) : (task.order ?? null);
  }

  function formatCollectedSubjects(includePending) {
    return Array.from(subjectsCache, ([name, tasks]) => {
      const taskList = Array.from((tasks && typeof tasks.values === 'function') ? tasks.values() : (Array.isArray(tasks) ? tasks : []))
        .filter(Boolean);
      return {
        name,
        tasks: taskList
          .map(t => {
            const resolvedOrder = resolveTaskOrder(name, t);
            return resolvedOrder !== t.order ? { ...t, order: resolvedOrder } : t;
          })
          .filter(t => {
            if (/^Assessment\s+\d+$/i.test(t.name) && !t.caption && (t.weight === null || t.weight === 0)) return false;
            return includePending || !t.pending;
          })
          .sort((a, b) => {
            if (a.order !== null && b.order !== null) return a.order - b.order;
            return a.sequence - b.sequence;
          })
      };
    });
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


    // Publish public API
    window.ConnectifyData = {
      collect,
      cohortMean,
      orderHint,
      correctedCaption,
      expandAll,
      collapseAll: () => expandAll(false),
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
          localStorage.removeItem(cache.getSubjectsCacheKey ? cache.getSubjectsCacheKey() : 'connectify:subjects_cache:current');
          localStorage.removeItem('connectify:subjects_cache:current');
          localStorage.removeItem('connectify:stale_subjects');
        } catch {}
      },
      cache: window.ConnectifyCache || cache
    };
  } catch (err) {
    console.error('Connectify error in assessment-data.js:', err);
  }
})();

/**
 * Connectify Assessment: card scraping and task ordering
 *
 * Scrapes one subject card into the subjects cache (deduplicating tasks repeated across Semester 1
 * and 2 outlines), resolves each task's chronological order (custom week overrides first), and formats
 * the cache for collect(). Exposes window.ConnectifyAssessmentScrape.
 */
(() => {
  'use strict';

  const { normalize, customWeekOrder, readTimeOverride } = window.ConnectifyUtils;
  const cache = window.ConnectifyCache;
  const parser = window.ConnectifyParser;
  const subjectsCache = cache.subjectsCache;
  const { orderHint, setTaskRow, parseCardSubjectTasks } = parser;
  const { setTaskStats, saveSubjectsCache, unmarkSubjectStale, isSubjectStale } = cache;
  const TASK_ROWS = '.cvr-c-tasks .cvr-c-task';

  // Task rows each card had when it was last read, so collect() can find expanded cards it never read
  // (Expand All skips the per-card update) without re-reading cards whose subjects are already complete
  const scrapedRows = new WeakMap();
  function needsScrape(card) {
    const rows = card.querySelectorAll(TASK_ROWS).length;
    return rows > 0 && scrapedRows.get(card) !== rows;
  }

  /** Copies cohort statistics (mean, boxplot) from source onto target where target has none; true if any. */
  function keepCohortStats(target, source) {
    let changed = false;
    if (!Number.isFinite(target.mean) && Number.isFinite(source.mean)) { target.mean = source.mean; changed = true; }
    if (!Array.isArray(target.stats) && Array.isArray(source.stats)) { target.stats = source.stats; changed = true; }
    return changed;
  }

  // The cohort mean from the task's boxplot, else from the stats cache the cohort pass keeps for every row
  function cohortMeanOf(subjectName, task) {
    if (Number.isFinite(task.mean)) return task.mean;
    const stats = Array.isArray(task.stats) ? task.stats : cache.getTaskStats?.(subjectName, task.name);
    return Array.isArray(stats) && stats.length === 5 && stats.every(Number.isFinite)
      ? window.ConnectifyParseHelpers.weightedMean(stats)
      : task.mean;
  }

  /**
   * Scrapes tasks from a single subject card and updates subjectsCache.
   */
  function scrapeSubjectTasks(card, forceRefresh = false, updatedStaleSubjects = null) {
    if (!card) return;
    const parsed = parseCardSubjectTasks(card);
    if (!parsed) return;
    const { title, subjectName, tasks: parsedTasks } = parsed;
    if (parsedTasks.length > 0) scrapedRows.set(card, card.querySelectorAll(TASK_ROWS).length);
    // The class registry keeps which tasks each semester's outline lists (the cache merges both)
    const classes = window.ConnectifyClassSemesters;
    classes?.recordCards?.([card], true);
    classes?.recordTasks?.(subjectName, classes.cardInfo(card).semester, parsedTasks);

    const isStale = isSubjectStale(subjectName);
    const hasCache = subjectsCache.has(subjectName) && subjectsCache.get(subjectName).size > 0;

    // If cache exists and card is not stale, check if all parsed tasks from this card are already in cache
    if (!forceRefresh && !isStale && hasCache) {
      const existingMap = subjectsCache.get(subjectName);
      const allTasksPresent = parsedTasks.every(t => existingMap.has(t.id));
      if (allTasksPresent) {
        let filled = false;
        for (const t of parsedTasks) {
          const cached = existingMap.get(t.id);
          if (cached && t.row && !cached.row) {
            setTaskRow(cached, t.row);
          }
          // A card read before its charts were stamped cached no cohort statistics: fill them in now
          if (cached && keepCohortStats(cached, t)) filled = true;
        }
        if (filled) saveSubjectsCache();
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
        // A copy without a chart (or not stamped yet) never erases the statistics already cached
        keepCohortStats(record, existingTask);
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

  // The generic name key belongs to the first task of that name; repeats need their own id key
  function isFirstOfName(subjectName, task) {
    const name = normalize(task.name).toLowerCase();
    const cachedMap = subjectsCache.get(subjectName);
    const sameName = cachedMap ? Array.from(cachedMap.values()).filter(t => t && normalize(t.name).toLowerCase() === name) : [];
    return sameName.length <= 1 || sameName[0] === task;
  }

  // A week past its term's end belongs to the next term (Early Easter: Term 1 Week 10 is Term 2 Week 1)
  const termWeekOrder = order => window.ConnectifySchoolTerms?.normalizeOrder(order) ?? order;

  function resolveTaskOrder(subjectName, task) {
    if (!task) return null;
    const override = readTimeOverride([subjectName], [task.id]) ??
      (task.name && isFirstOfName(subjectName, task) ? readTimeOverride([subjectName], [task.name]) : null);
    const order = customWeekOrder(override);
    if (order !== null) return termWeekOrder(order);
    // A date caption is read again each time, so the term calendar (Early Easter) and caches from
    // before dates were placed in their real term and week both give today's order
    const fromDate = window.ConnectifyParseHelpers.dateOrder(task.caption);
    if (fromDate !== null) return fromDate;
    if (Number.isFinite(task.order)) return termWeekOrder(task.order);
    return task.caption ? termWeekOrder(orderHint(task.caption)) : (task.order ?? null);
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
            const mean = cohortMeanOf(name, t);
            return resolvedOrder !== t.order || mean !== t.mean ? { ...t, order: resolvedOrder, mean } : t;
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

  window.ConnectifyAssessmentScrape = { scrapeSubjectTasks, needsScrape, resolveTaskOrder, formatCollectedSubjects };
})();

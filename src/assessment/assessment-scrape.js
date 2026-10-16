/**
 * Connectify Assessment: card scraping and task ordering
 *
 * Scrapes one subject card into the subjects cache (deduplicating tasks repeated across Semester 1
 * and 2 outlines), resolves each task's chronological order (custom week overrides first), and formats
 * the cache for collect(). Exposes window.ConnectifyAssessmentScrape.
 */
(() => {
  'use strict';

  const { normalize } = window.ConnectifyUtils;
  const cache = window.ConnectifyCache;
  const parser = window.ConnectifyParser;
  const subjectsCache = cache.subjectsCache;
  const { orderHint, setTaskRow, parseCardSubjectTasks } = parser;
  const { setTaskStats, saveSubjectsCache, unmarkSubjectStale, isSubjectStale } = cache;

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
      const allTasks = cachedMap ? Array.from(cachedMap.values()) : [];
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

  window.ConnectifyAssessmentScrape = { scrapeSubjectTasks, resolveTaskOrder, formatCollectedSubjects };
})();

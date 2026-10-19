/**
 * Connectify Predictor: chronological prediction pipeline
 *
 * Predicts every task in date order from only the results before it, caches the results in the
 * prediction store, and recomputes them when results, categories or baselines change.
 * Exposes window.ConnectifyPredictorCache (including the store and prior-history functions).
 */
(() => {
  'use strict';

  const store = window.ConnectifyPredictorStore;
  const {
    PREDICTOR_ALGO_VERSION, PREDICTOR_CACHE_VERSION_KEY, LEGACY_PREDICTION_VERSION_KEY, predictionMemoryCache,
    isPredictionCacheCurrent, setPredictionCacheCurrent, cacheTaskPrediction, getCachedPrediction, clearSubjectPredictionCache
  } = store;
  const predictTask = (...args) => window.ConnectifyPredictorEngine.predictTask(...args);
  const getBaselines = (...args) => window.ConnectifyPredictorBaselines.getBaselines(...args);
  const getTaskChronologicalStamp = (...args) => window.ConnectifyPredictorDates.getTaskChronologicalStamp(...args);
  const getHistoricalDataPriorTo = (...args) => window.ConnectifyPredictorHistory.getHistoricalDataPriorTo(...args);

  /**
   * Pre-populates the historical prediction cache for all tasks across all subjects
   * in strict chronological order. Runs only once on first launch or when prediction
   * calculation versions increment.
   */
  function populateChronologicalPredictions(subjectsList, force = false) {
    if (!force && isPredictionCacheCurrent()) {
      return;
    }

    const rawSubjects = subjectsList || (window.ConnectifyData?.collect ? window.ConnectifyData.collect(true) : []);
    if (!rawSubjects || rawSubjects.length === 0) return;

    const allTasks = [];
    for (const subj of rawSubjects) {
      for (const t of subj.tasks || []) {
        allTasks.push({
          subjectName: subj.name,
          task: t,
          stamp: getTaskChronologicalStamp(t, subj.name)
        });
      }
    }

    allTasks.sort((a, b) => a.stamp - b.stamp);

    const baselines = getBaselines();
    for (const item of allTasks) {
      const priorHistorical = getHistoricalDataPriorTo(rawSubjects, item.subjectName, item.task);
      const isCompleted = Number.isFinite(item.task?.score) || Number.isFinite(item.task?.mark) || (item.task?.pending === false && item.task?.weight > 0);
      const pred = predictTask(item.subjectName, item.task, priorHistorical, baselines, isCompleted);
      if (!pred.unpredicted) {
        cacheTaskPrediction(item.subjectName, item.task, pred);
      }
    }

    setPredictionCacheCurrent();
    needsRecompute = false;
  }

  /**
   * Resolves prediction for a task: queries the cache first, and if missing,
   * calculates prediction using only tasks chronologically prior to this task,
   * caches the result, and returns it.
   */
  function getOrComputeTaskPrediction(subjectName, task, allSubjects) {
    if (!task) return null;

    // 1. Fast cache check FIRST before doing any calculation or DOM scraping
    const identifiers = [task.id, task.labelsKey, task.name].filter(Boolean);
    for (const id of identifiers) {
      const cached = getCachedPrediction(subjectName, id);
      if (cached) return cached;
    }

    // Use allSubjects if provided; avoid inline collect(true) to prevent quadratic DOM scrapes
    const rawSubjects = allSubjects || [];

    if (!isPredictionCacheCurrent()) {
      populateChronologicalPredictions(rawSubjects, true);
      for (const id of identifiers) {
        const cached = getCachedPrediction(subjectName, id);
        if (cached) return cached;
      }
    }

    const isCompleted = Number.isFinite(task.score) || Number.isFinite(task.mark) || (task.pending === false && task.weight > 0);
    const priorHistorical = getHistoricalDataPriorTo(rawSubjects, subjectName, task);
    const baselines = getBaselines();
    let fresh = predictTask(subjectName, task, priorHistorical, baselines, isCompleted);

    if (fresh && fresh.unpredicted && isCompleted) {
      fresh = predictTask(subjectName, task, priorHistorical, baselines, true);
    }

    if (fresh && !fresh.unpredicted) {
      cacheTaskPrediction(subjectName, task, fresh);
    }
    return fresh;
  }

  let isUpdatingPredictionCache = false;
  // Type averages span every course, so a refresh recomputes every task. Refreshes requested in
  // one task (a Type change, a rescan, a baseline save) share a single recompute and event.
  let refreshTimer = null;
  let refreshSubject = null;
  let needsRecompute = false;

  function flushPredictionRefresh() {
    refreshTimer = null;
    const subjectName = refreshSubject;
    isUpdatingPredictionCache = true;
    try {
      // A row read since the request may already have recomputed everything (a cleared version key)
      const rawSubjects = needsRecompute && window.ConnectifyData?.collect ? window.ConnectifyData.collect(true) : [];
      if (rawSubjects && rawSubjects.length > 0) {
        populateChronologicalPredictions(rawSubjects, true);
      }
    } catch (e) {
      console.warn('ConnectifyPredictorMath: failed to re-populate predictions', e);
    } finally {
      isUpdatingPredictionCache = false;
    }
    window.dispatchEvent(new CustomEvent('connectify-predictions-updated', {
      detail: { subject: subjectName }
    }));
  }

  // Stale predictions are dropped at once (a row read before the recompute computes its own);
  // the recompute runs after the current task, so the dropdown that changed closes without waiting
  function updatePredictionCache(subjectName = null) {
    if (isUpdatingPredictionCache) return;
    if (subjectName) {
      clearSubjectPredictionCache(subjectName);
    } else {
      predictionMemoryCache.clear();
      if (window.ConnectifyCache?.clearPredictorCache) {
        window.ConnectifyCache.clearPredictorCache();
      } else {
        window.ConnectifyUtils.removeStorageKeys(k => k.startsWith('connectify:prediction:') || k === LEGACY_PREDICTION_VERSION_KEY);
      }
    }
    needsRecompute = true;
    refreshSubject = refreshTimer && refreshSubject !== subjectName ? null : subjectName;
    if (!refreshTimer) refreshTimer = setTimeout(flushPredictionRefresh, 0);
  }

  window.ConnectifyPredictorCache = {
    ...store,
    getHistoricalDataPriorTo,
    populateChronologicalPredictions,
    getOrComputeTaskPrediction,
    updatePredictionCache,
    // true until the queued recompute dispatches connectify-predictions-updated
    isRefreshPending: () => refreshTimer !== null
  };
})();

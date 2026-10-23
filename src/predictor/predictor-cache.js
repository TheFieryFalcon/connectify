/**
 * Connectify Predictor: chronological prediction pipeline
 *
 * Predicts every marked task in date order from only the results before it (unmarked tasks from every result), caches the results in the
 * prediction store, and recomputes them when results, categories or baselines change.
 * Exposes window.ConnectifyPredictorCache (including the store and prior-history functions).
 */
(() => {
  'use strict';

  const store = window.ConnectifyPredictorStore;
  const {
    PREDICTOR_ALGO_VERSION, PREDICTOR_CACHE_VERSION_KEY, LEGACY_PREDICTION_VERSION_KEY, predictionMemoryCache,
    isPredictionCacheCurrent, setPredictionCacheCurrent, cacheTaskPrediction, getCachedPrediction, clearSubjectPredictionCache,
    predictionId
  } = store;
  const predictTask = (...args) => window.ConnectifyPredictorEngine.predictTask(...args);
  const getBaselines = (...args) => window.ConnectifyPredictorBaselines.getBaselines(...args);
  const getTaskChronologicalStamp = (...args) => window.ConnectifyPredictorDates.getTaskChronologicalStamp(...args);
  const getHistoricalDataPriorTo = (...args) => window.ConnectifyPredictorHistory.getHistoricalDataPriorTo(...args);
  const getHistoricalData = (...args) => window.ConnectifyPredictorHistory.getHistoricalData(...args);
  const isCompletedTask = t => Number.isFinite(t?.score) || Number.isFinite(t?.mark) || (t?.pending === false && t?.weight > 0);
  // A marked task is predicted from the results before it; an unmarked one from every result in the cache
  const historyFor = (rawSubjects, subjectName, task, everything) => (isCompletedTask(task)
    ? getHistoricalDataPriorTo(rawSubjects, subjectName, task)
    : everything || getHistoricalData(rawSubjects));

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
    const memo = window.ConnectifyPredictorDates.withStampMemo || (fn => fn());
    memo(() => populateInOrder(rawSubjects));
    setPredictionCacheCurrent();
    needsRecompute = false;
  }

  function populateInOrder(rawSubjects) {
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
    const everything = getHistoricalData(rawSubjects);
    for (const item of allTasks) {
      const history = historyFor(rawSubjects, item.subjectName, item.task, everything);
      const pred = predictTask(item.subjectName, item.task, history, baselines, isCompletedTask(item.task));
      if (!pred.unpredicted) {
        cacheTaskPrediction(item.subjectName, item.task, pred);
      }
    }
  }

  /**
   * Resolves prediction for a task: queries the cache first, and if missing,
   * calculates prediction using only tasks chronologically prior to this task,
   * caches the result, and returns it.
   */
  function getOrComputeTaskPrediction(subjectName, task, allSubjects) {
    if (!task) return null;

    // 1. Fast cache check FIRST before doing any calculation or DOM scraping
    const cached = getCachedPrediction(subjectName, predictionId(task));
    if (cached) return cached;

    // Use allSubjects if provided; avoid inline collect(true) to prevent quadratic DOM scrapes
    const rawSubjects = allSubjects || [];

    if (!isPredictionCacheCurrent()) {
      populateChronologicalPredictions(rawSubjects, true);
      const populated = getCachedPrediction(subjectName, predictionId(task));
      if (populated) return populated;
    }

    const isCompleted = isCompletedTask(task);
    const history = historyFor(rawSubjects, subjectName, task);
    const fresh = predictTask(subjectName, task, history, getBaselines(), isCompleted);

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

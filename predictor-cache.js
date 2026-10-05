/**
 * Connectify Predictor Caching & Chronological Pipeline
 *
 * In-memory and localStorage prediction caching, single-task regression, and chronologic sequence sweeps.
 * Exposes window.ConnectifyPredictorCache.
 */
(() => {
  'use strict';

  try {
    const engine = window.ConnectifyPredictorEngine || {};
    const dates = window.ConnectifyPredictorDates || {};

    const round = (val, decimals = 1) => (window.ConnectifyPredictorEngine?.round || engine.round || ((v, d = 1) => Number(Math.round(v + 'e' + d) + 'e-' + d)))(val, decimals);
    const cleanSubject = (...args) => (window.ConnectifyPredictorEngine?.cleanSubject || engine.cleanSubject || (s => String(s || '').trim()))(...args);
    const getAccountKey = (...args) => (window.ConnectifyPredictorEngine?.getAccountKey || engine.getAccountKey || (() => 'current'))(...args);
    const getHistoricalData = (...args) => (window.ConnectifyPredictorEngine?.getHistoricalData || engine.getHistoricalData)(...args);
    const predictTask = (...args) => (window.ConnectifyPredictorEngine?.predictTask || engine.predictTask)(...args);
    const getBaselines = (...args) => (window.ConnectifyPredictorEngine?.getBaselines || engine.getBaselines)(...args);

    const resolveCustomDate = (...args) => (window.ConnectifyPredictorDates?.resolveCustomDate || dates.resolveCustomDate)(...args);
    const getTaskChronologicalStamp = (...args) => (window.ConnectifyPredictorDates?.getTaskChronologicalStamp || dates.getTaskChronologicalStamp)(...args);
  const PREDICTOR_ALGO_VERSION = window.ConnectifyCache?.VERSIONS?.PREDICTOR || 'v10_20261003_pred';
  const PREDICTOR_CACHE_VERSION_KEY = window.ConnectifyCache?.KEYS?.PREDICTOR || 'connectify:cache_version:predictor';
  const LEGACY_PREDICTION_VERSION_KEY = 'connectify:prediction_version';

  function isPredictionCacheCurrent() {
    try {
      const stored = localStorage.getItem(PREDICTOR_CACHE_VERSION_KEY) || localStorage.getItem(LEGACY_PREDICTION_VERSION_KEY);
      return stored === PREDICTOR_ALGO_VERSION;
    } catch {
      return false;
    }
  }

  function setPredictionCacheCurrent() {
    try {
      localStorage.setItem(PREDICTOR_CACHE_VERSION_KEY, PREDICTOR_ALGO_VERSION);
      localStorage.setItem(LEGACY_PREDICTION_VERSION_KEY, PREDICTOR_ALGO_VERSION);
    } catch {}
  }

  function getTaskPredictionKey(subjectName, taskId) {
    const account = getAccountKey();
    const cleanSubj = cleanSubject(subjectName).toLowerCase();
    return `connectify:prediction:${account}:${cleanSubj}:${taskId}`;
  }

  const predictionMemoryCache = new Map();

  function cachePrediction(subjectName, taskId, prediction) {
    if (!taskId || !prediction || prediction.unpredicted) return;
    try {
      const key = getTaskPredictionKey(subjectName, taskId);
      const payload = {
        low: prediction.low,
        mid: prediction.mid,
        high: prediction.high,
        breakoutScore: prediction.breakoutScore || round(1.10 * prediction.high, 2),
        taskType: prediction.taskType || prediction.type,
        type: prediction.type || prediction.taskType,
        timestamp: Date.now()
      };
      predictionMemoryCache.set(key, payload);
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {}
  }

  function cacheTaskPrediction(subjectName, task, prediction) {
    if (!task || !prediction || prediction.unpredicted) return;
    const identifiers = [task.id, task.labelsKey, task.name].filter(Boolean);
    for (const id of identifiers) {
      cachePrediction(subjectName, id, prediction);
    }
  }

  function getCachedPrediction(subjectName, taskIdOrName) {
    if (!taskIdOrName) return null;
    try {
      const candidates = [
        getTaskPredictionKey(subjectName, taskIdOrName),
        getTaskPredictionKey(subjectName, encodeURIComponent(taskIdOrName))
      ];
      for (const key of candidates) {
        if (predictionMemoryCache.has(key)) {
          return predictionMemoryCache.get(key);
        }
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Number.isFinite(parsed.low) && Number.isFinite(parsed.mid) && Number.isFinite(parsed.high)) {
            if (!Number.isFinite(parsed.breakoutScore)) {
              parsed.breakoutScore = round(1.10 * parsed.high, 2);
            }
            if (!parsed.taskType && parsed.type) parsed.taskType = parsed.type;
            if (!parsed.type && parsed.taskType) parsed.type = parsed.taskType;
            predictionMemoryCache.set(key, parsed);
            return parsed;
          }
        }
      }
    } catch {}
    return null;
  }

  function getHistoricalDataPriorTo(allSubjects, targetSubjectName, targetTask) {
    const rawSubjects = allSubjects || (window.ConnectifyData?.collect ? window.ConnectifyData.collect(true) : []);
    const targetStamp = getTaskChronologicalStamp(targetTask, targetSubjectName);
    const targetSubjClean = cleanSubject(targetSubjectName);
    const targetTaskName = (targetTask?.name || '').trim().toLowerCase();
    const targetTaskId = targetTask?.id;

    const priorCompletedTasks = [];
    for (const subj of rawSubjects) {
      const sName = subj.name;
      const sClean = cleanSubject(sName);
      for (const t of subj.tasks || []) {
        if (t.pending || !Number.isFinite(t.score) || !(t.weight > 0)) continue;

        // Strictly exclude the target task itself
        const tName = (t.name || '').trim().toLowerCase();
        if (
          sClean === targetSubjClean &&
          (t === targetTask ||
            (targetTaskId && t.id === targetTaskId) ||
            (tName && targetTaskName && tName === targetTaskName && t.sequence === targetTask.sequence))
        ) {
          continue;
        }

        const tStamp = getTaskChronologicalStamp(t, sName);
        if (tStamp < targetStamp) {
          priorCompletedTasks.push({ subjName: sName, task: t });
        }
      }
    }

    const subjectStats = {};
    const typeStats = {};
    const typeCounts = {};
    let totalScoreWeight = 0;
    let totalWeight = 0;
    const allTaskScores = [];

    for (const { subjName, task } of priorCompletedTasks) {
      const cleanName = cleanSubject(subjName);
      if (!subjectStats[cleanName]) {
        subjectStats[cleanName] = { earned: 0, weight: 0, tasks: [] };
      }
      const earned = (task.score / 100) * task.weight;
      subjectStats[cleanName].earned += earned;
      subjectStats[cleanName].weight += task.weight;
      subjectStats[cleanName].tasks.push(task.score);
      allTaskScores.push(task.score);

      const taskType = window.ConnectifyTaskTypes?.getEffectiveType
        ? window.ConnectifyTaskTypes.getEffectiveType(subjName, task)
        : 'Take-Home';

      if (!typeStats[taskType]) {
        typeStats[taskType] = { earned: 0, weight: 0 };
        typeCounts[taskType] = 0;
      }
      typeStats[taskType].earned += earned;
      typeStats[taskType].weight += task.weight;
      typeCounts[taskType]++;

      totalScoreWeight += earned;
      totalWeight += task.weight;
    }

    const subjectAverages = {};
    const subjectSpreads = {};
    for (const [name, data] of Object.entries(subjectStats)) {
      if (data.weight > 0) {
        subjectAverages[name] = round((data.earned / data.weight) * 100, 2);
      }
      if (data.tasks.length >= 2 && subjectAverages[name] !== undefined) {
        const mean = subjectAverages[name];
        const sumSq = data.tasks.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0);
        subjectSpreads[name] = Math.sqrt(sumSq / (data.tasks.length - 1));
      }
    }

    const typeAverages = {};
    for (const [type, data] of Object.entries(typeStats)) {
      if (data.weight > 0) {
        typeAverages[type] = round((data.earned / data.weight) * 100, 2);
      }
    }

    const overallAverage = totalWeight > 0 ? round((totalScoreWeight / totalWeight) * 100, 2) : null;

    let scoreVariance = 0;
    if (allTaskScores.length >= 3 && overallAverage !== null) {
      const sumSq = allTaskScores.reduce((acc, s) => acc + Math.pow(s - overallAverage, 2), 0);
      scoreVariance = Math.sqrt(sumSq / (allTaskScores.length - 1));
    }
    const spread = Math.min(9.0, Math.max(4.0, scoreVariance > 0 ? scoreVariance : 6.5));

    return {
      subjects: subjectAverages,
      subjectSpreads,
      types: typeAverages,
      typeCounts,
      overallAverage,
      spread,
      totalCompletedTasks: allTaskScores.length
    };
  }

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

  function clearSubjectPredictionCache(subjectName) {
    if (!subjectName) return;
    const cleanSubj = cleanSubject(subjectName).toLowerCase();
    for (const k of Array.from(predictionMemoryCache.keys())) {
      if (k.toLowerCase().includes(`:${cleanSubj}:`)) {
        predictionMemoryCache.delete(k);
      }
    }
    try {
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('connectify:prediction:')) {
          const lowerKey = k.toLowerCase();
          if (lowerKey.includes(`:${cleanSubj}:`)) {
            toRemove.push(k);
          }
        }
      }
      for (const k of toRemove) localStorage.removeItem(k);
    } catch (e) {
      console.warn('ConnectifyPredictorMath: failed to clear subject prediction cache', e);
    }
  }

  let isUpdatingPredictionCache = false;

  function updatePredictionCache(subjectName = null) {
    if (isUpdatingPredictionCache) return;
    isUpdatingPredictionCache = true;
    try {
      if (subjectName) {
        clearSubjectPredictionCache(subjectName);
      } else {
        predictionMemoryCache.clear();
        if (window.ConnectifyCache?.clearPredictorCache) {
          window.ConnectifyCache.clearPredictorCache();
        } else {
          try {
            const toRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && (k.startsWith('connectify:prediction:') || k === LEGACY_PREDICTION_VERSION_KEY)) {
                toRemove.push(k);
              }
            }
            for (const k of toRemove) localStorage.removeItem(k);
          } catch {}
        }
      }

      try {
        const rawSubjects = window.ConnectifyData?.collect ? window.ConnectifyData.collect(true) : [];
        if (rawSubjects && rawSubjects.length > 0) {
          populateChronologicalPredictions(rawSubjects, true);
        }
      } catch (e) {
        console.warn('ConnectifyPredictorMath: failed to re-populate predictions', e);
      }

      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('connectify-predictions-updated', {
          detail: { subject: subjectName }
        }));
      }
    } finally {
      isUpdatingPredictionCache = false;
    }
  }

  // --- OUTCOME EVALUATION (Vertical Bar Segments) ---
  /**
   * Evaluates actual score against prediction:
   * - Breakout: Score > 1.10 * High (multiplicative) -> 5 segments (Red, Orange, Yellow, Green, Purple double-height)
   * - High: Score >= High -> 4 segments (Red, Orange, Yellow, Green)
   * - Middle: Score >= Middle -> 3 segments (Red, Orange, Yellow)
   * - Low: Score >= Low -> 2 segments (Red, Orange)
   * - Below Low: Score < Low -> 1 segment (Red)
   * - Critical Shortfall: Score <= Low - 10 (additive) -> 0 segments (Empty glowing red bar)
   * Note: The purple breakout threshold is secret and never revealed in advance or in the tooltip legend.
   */

    window.ConnectifyPredictorCache = {
      PREDICTOR_ALGO_VERSION,
      PREDICTOR_CACHE_VERSION_KEY,
      LEGACY_PREDICTION_VERSION_KEY,
      isPredictionCacheCurrent,
      setPredictionCacheCurrent,
      getTaskPredictionKey,
      predictionMemoryCache,
      cachePrediction,
      cacheTaskPrediction,
      getCachedPrediction,
      getHistoricalDataPriorTo,
      populateChronologicalPredictions,
      getOrComputeTaskPrediction,
      clearSubjectPredictionCache,
      updatePredictionCache
    };
  } catch (err) {
    console.error('Connectify error in predictor-cache.js:', err);
  }
})();

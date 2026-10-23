/**
 * Connectify Predictor: prediction store
 *
 * Persists task predictions in memory and localStorage (connectify:prediction:<account>:<subject>:<task>)
 * and tracks whether the stored predictions match the current algorithm version.
 * Exposes window.ConnectifyPredictorStore.
 */
(() => {
  'use strict';

  const round = (...args) => window.ConnectifyPredictorEngine.round(...args);
  const cleanSubject = (...args) => window.ConnectifyPredictorEngine.cleanSubject(...args);
  const getAccountKey = () => window.ConnectifyUtils.accountKey();

  const PREDICTOR_ALGO_VERSION = window.ConnectifyCache?.VERSIONS?.PREDICTOR || 'v20_20261023_pred';
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
        // Kept so the prediction card names what fed it (and the subject) when read back from the cache
        ...(prediction.basis ? { basis: prediction.basis } : {}),
        ...(prediction.subjectName ? { subjectName: prediction.subjectName } : {}),
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

  function clearSubjectPredictionCache(subjectName) {
    if (!subjectName) return;
    const cleanSubj = cleanSubject(subjectName).toLowerCase();
    for (const k of Array.from(predictionMemoryCache.keys())) {
      if (k.toLowerCase().includes(`:${cleanSubj}:`)) {
        predictionMemoryCache.delete(k);
      }
    }
    try {
      window.ConnectifyUtils.removeStorageKeys(k => k.startsWith('connectify:prediction:') && k.toLowerCase().includes(`:${cleanSubj}:`));
    } catch (e) {
      console.warn('ConnectifyPredictorMath: failed to clear subject prediction cache', e);
    }
  }

  window.ConnectifyPredictorStore = {
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
    clearSubjectPredictionCache
  };
})();

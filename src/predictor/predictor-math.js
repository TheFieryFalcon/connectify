/**
 * Connectify Subject Mark & ATAR Predictor
 *
 * Implements historical mark prediction, trajectory variance extrapolation,
 * outcome tier evaluation, and subject grade projection.
 * Exposes window.ConnectifyPredictorMath.
 */
(() => {
  'use strict';

  // Late-bound forwarders: each call uses the module's current function, falling back to the one
  // present when this file loaded (the modules load first in manifest order)
  const forwarder = name => {
    const captured = window[name] || {};
    return fn => (...args) => (window[name]?.[fn] || captured[fn])(...args);
  };
  const viaEngine = forwarder('ConnectifyPredictorEngine');
  const viaDates = forwarder('ConnectifyPredictorDates');
  const viaCache = forwarder('ConnectifyPredictorCache');
  const viaProjection = forwarder('ConnectifyPredictorProjection');
  const cacheModule = window.ConnectifyPredictorCache || {};

  const round = (val, decimals = 1) => viaEngine('round')(val, decimals);
  const cleanSubject = viaEngine('cleanSubject');
  const applyLogarithmicCeiling = viaEngine('applyLogarithmicCeiling');
  const getBaselines = viaEngine('getBaselines');
  const saveBaselines = viaEngine('saveBaselines');
  const predictTask = viaEngine('predictTask');
  const getHistoricalData = viaEngine('getHistoricalData');

  const resolveCustomDate = viaDates('resolveCustomDate');
  const hasParsableDate = viaDates('hasParsableDate');
  const getTaskChronologicalStamp = viaDates('getTaskChronologicalStamp');

  const isPredictionCacheCurrent = viaCache('isPredictionCacheCurrent');
  const predictionMemoryCache = cacheModule.predictionMemoryCache || new Map();
  const cachePrediction = viaCache('cachePrediction');
  const cacheTaskPrediction = viaCache('cacheTaskPrediction');
  const getCachedPrediction = viaCache('getCachedPrediction');
  const getHistoricalDataPriorTo = viaCache('getHistoricalDataPriorTo');
  const populateChronologicalPredictions = viaCache('populateChronologicalPredictions');
  const getOrComputeTaskPrediction = viaCache('getOrComputeTaskPrediction');
  const clearSubjectPredictionCache = viaCache('clearSubjectPredictionCache');
  const updatePredictionCache = viaCache('updatePredictionCache');
  const PREDICTOR_ALGO_VERSION = cacheModule.PREDICTOR_ALGO_VERSION || 'v12_20261019_pred';

  const projectSubjectGrades = viaProjection('projectSubjectGrades');
  const projectATAR = viaProjection('projectATAR');

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
  function evaluateOutcome(score, prediction) {
    if (!Number.isFinite(score) || !prediction || prediction.unpredicted) return null;

    const low = prediction.low;
    const mid = prediction.mid;
    const high = prediction.high;
    const breakoutThreshold = Number.isFinite(prediction.breakoutScore)
      ? prediction.breakoutScore
      : round(1.10 * high, 2);

    const legend = [
      'Target Tiers & Color Guide:',
      `• Green: High Target (≥ ${high}%)`,
      `• Yellow: Mid Momentum Target (≥ ${mid}%)`,
      `• Orange: Low Boundary (≥ ${low}%)`,
      `• Red: Below Low (< ${low}%)`,
      `• Empty (Glowing Red): Critical Shortfall (≤ ${round(low - 10, 1)}%)`
    ].join('\n');

    // 1. Breakout (> 1.10 * High multiplicative) - secret purple segment
    if (score > breakoutThreshold) {
      return {
        segments: 5,
        broken: true,
        critical: false,
        colors: ['red', 'orange', 'yellow', 'green', 'purple'],
        label: `Breakout! Scored ${round(score, 1)}% (Exceptional Achievement)`,
        details: `Actual Score: ${round(score, 1)}%\nOutcome: Breakout! Surpassed High prediction.\n\n${legend}`
      };
    }

    // 2. High (>= High)
    if (score >= high) {
      return {
        segments: 4,
        broken: false,
        critical: false,
        colors: ['red', 'orange', 'yellow', 'green'],
        label: `High Target Met! Scored ${round(score, 1)}% (High: ${high}%)`,
        details: `Actual Score: ${round(score, 1)}%\nOutcome: High Target Met (Green - 4 segments)\n\n${legend}`
      };
    }

    // 3. Mid (>= Mid)
    if (score >= mid) {
      return {
        segments: 3,
        broken: false,
        critical: false,
        colors: ['red', 'orange', 'yellow'],
        label: `Mid Momentum Met! Scored ${round(score, 1)}% (Mid: ${mid}%)`,
        details: `Actual Score: ${round(score, 1)}%\nOutcome: Mid Momentum Met (Yellow - 3 segments)\n\n${legend}`
      };
    }

    // 4. Low (>= Low)
    if (score >= low) {
      return {
        segments: 2,
        broken: false,
        critical: false,
        colors: ['red', 'orange'],
        label: `Low Target Met! Scored ${round(score, 1)}% (Low: ${low}%)`,
        details: `Actual Score: ${round(score, 1)}%\nOutcome: Low Target Met (Orange - 2 segments)\n\n${legend}`
      };
    }

    // 5. Critical Shortfall: 10% (additive) lower than Low estimate
    if (score <= round(low - 10, 2)) {
      return {
        segments: 0,
        broken: false,
        critical: true,
        colors: [],
        label: `Critical Shortfall! Scored ${round(score, 1)}% (≥10% below Low estimate ${low}%)`,
        details: `Actual Score: ${round(score, 1)}%\nOutcome: Critical Shortfall (Empty Bar - Glowing Red)\nScore is ${round(low - score, 1)}% below Low estimate.\n\n${legend}`
      };
    }

    // 6. Below Low (< Low, but not critical)
    return {
      segments: 1,
      broken: false,
      critical: false,
      colors: ['red'],
      label: `Below Low! Scored ${round(score, 1)}% (under Low estimate ${low}%)`,
      details: `Actual Score: ${round(score, 1)}%\nOutcome: Below Low (Red - 1 segment)\n\n${legend}`
    };
  }

  // --- EXPORTS ---
  window.ConnectifyPredictorMath = {
    applyLogarithmicCeiling,
    getBaselines,
    saveBaselines,
    getHistoricalData,
    getHistoricalDataPriorTo,
    getTaskChronologicalStamp,
    predictTask,
    cachePrediction,
    cacheTaskPrediction,
    getCachedPrediction,
    evaluateOutcome,
    projectSubjectGrades,
    projectATAR,
    cleanSubject,
    populateChronologicalPredictions,
    getOrComputeTaskPrediction,
    isPredictionCacheCurrent,
    clearPredictionCache: () => {
      predictionMemoryCache.clear();
      window.ConnectifyCache?.clearPredictorCache?.();
    },
    clearSubjectPredictionCache,
    updatePredictionCache,
    hasParsableDate,
    resolveCustomDate,
    PREDICTOR_ALGO_VERSION,
    PREDICTION_CACHE_VERSION: PREDICTOR_ALGO_VERSION,
    predictionMemoryCache
  };

  // Populate chronological predictions when results are scraped/updated if cache is not current
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('connectify-results-updated', () => {
      try {
        if (!isPredictionCacheCurrent()) {
          populateChronologicalPredictions();
        }
      } catch (e) {}
    });

    window.addEventListener('storage', e => {
      if (e.key && (e.key.includes('baseline') || e.key.includes('prediction'))) {
        predictionMemoryCache.clear();
      }
    });

    window.addEventListener('connectify-task-type-changed', e => {
      try {
        updatePredictionCache(e?.detail?.subject);
      } catch (e) {}
    });
  }
})();

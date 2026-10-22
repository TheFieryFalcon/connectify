/**
 * Connectify Predictor Engine
 *
 * Core prediction model: logarithmic headroom, historical subject/type averages and per-task
 * low / mid / high predictions. Baselines are stored by predictor-baselines.js.
 * Exposes window.ConnectifyPredictorEngine.
 */
(() => {
  'use strict';

  try {
  const round = (val, decimals = 1) => {
    if (!Number.isFinite(val)) return val;
    const factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
  };

  const getAccountKey = () => window.ConnectifyUtils.accountKey();

  const cleanSubject = name => {
    return String(name || '')
      .replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  /**
   * Logarithmic scaling for predictions above 80%.
   * Scores above 80% become exponentially harder to achieve (e.g. 97% is far harder than 94%).
   * For baseScore > 80 and positive delta:
   * Score = 100 - (100 - baseScore) * exp(-delta / 20)
   *
   * @param {number} baseScore - Starting percentage score (0-100)
   * @param {number} delta - Positive or negative performance adjustment
   * @returns {number} Logarithmically scaled score clamped to [0, 100]
   */
  function applyLogarithmicCeiling(baseScore, delta) {
    if (!Number.isFinite(baseScore)) return baseScore;
    if (!Number.isFinite(delta) || delta === 0) return Math.min(100, Math.max(0, baseScore));

    if (delta < 0) {
      return Math.max(0, baseScore + delta);
    }

    // When baseScore <= 80:
    if (baseScore <= 80) {
      if (baseScore + delta <= 80) {
        return baseScore + delta;
      }
      const linearDelta = 80 - baseScore;
      const surplus = delta - linearDelta;
      // Headroom above 80 is 20
      const scaledAbove = 20 * (1 - Math.exp(-surplus / 20));
      return Math.min(100, 80 + scaledAbove);
    }

    // When baseScore > 80:
    const headroom = 100 - baseScore;
    if (headroom <= 0) return 100;
    const scaledGain = headroom * (1 - Math.exp(-delta / 20));
    return Math.min(100, baseScore + scaledGain);
  }

  // Baselines live in predictor-baselines.js; forwarded so callers keep using the engine API
  const getBaselines = (...args) => window.ConnectifyPredictorBaselines.getBaselines(...args);
  const saveBaselines = (...args) => window.ConnectifyPredictorBaselines.saveBaselines(...args);

  // Completed-result history lives in predictor-history.js
  const getHistoricalData = (...args) => window.ConnectifyPredictorHistory.getHistoricalData(...args);


  // --- TASK PREDICTION ENGINE ---
  function predictTask(subjectName, task, customHistorical, customBaselines, customIsCompleted = false) {
    const cleanSubj = cleanSubject(subjectName);
    const baselines = customBaselines || getBaselines();
    const historical = customHistorical || getHistoricalData();

    const isCompleted = Boolean(
      customIsCompleted ||
      (task && Number.isFinite(task.score)) ||
      (task && Number.isFinite(task.mark)) ||
      (task && task.pending === false && Number.isFinite(task.weight) && task.weight > 0)
    );

    const taskType = window.ConnectifyTaskTypes?.getEffectiveType
      ? window.ConnectifyTaskTypes.getEffectiveType(subjectName, task)
      : 'Take-Home';

    // 1. Resolve subject performance:
    let subjectAvg = historical?.subjects?.[cleanSubj];
    let subjectSource = 'subject-history';
    if (subjectAvg === undefined && baselines?.subjects) {
      subjectSource = 'subject-baseline';
      if (baselines.subjects[cleanSubj] !== undefined) {
        subjectAvg = Number(baselines.subjects[cleanSubj]);
      } else if (baselines.subjects[subjectName] !== undefined) {
        subjectAvg = Number(baselines.subjects[subjectName]);
      }
    }

    if (subjectAvg === undefined || !Number.isFinite(subjectAvg)) {
      return {
        unpredicted: true,
        reason: 'missing_subject_baseline',
        taskType,
        type: taskType,
        subjectName: cleanSubj
      };
    }

    // 2. Resolve assessment type performance:
    const completedTypeCount = historical?.typeCounts?.[taskType] || 0;
    let typeAvg = historical?.types?.[taskType];
    // What the prediction rests on, for the expanded prediction card (cohort-expanded.js)
    let basis = { source: 'type-history', count: completedTypeCount };

    if (completedTypeCount === 0 && baselines?.types?.[taskType] !== undefined) {
      typeAvg = Number(baselines.types[taskType]);
      basis = { source: 'type-baseline', count: 0 };
    } else if (typeAvg === undefined || !Number.isFinite(typeAvg) || completedTypeCount === 0) {
      typeAvg = subjectAvg;
      basis = { source: subjectSource, count: 0 };
    }

    if (typeAvg === undefined || !Number.isFinite(typeAvg)) {
      return {
        unpredicted: true,
        reason: 'No previous tasks of this type have been done, unable to make prediction',
        taskType,
        type: taskType,
        subjectName: cleanSubj
      };
    }

    // 3. Overall student baseline anchor:
    const overallAnchor = historical.overallAverage !== null
      ? historical.overallAverage
      : subjectAvg;

    // 4. Assessment Type relative modifier (affinity):
    const typeModifier = typeAvg - overallAnchor;

    // 5. Middle Prediction (Expected Momentum):
    // High scores have an outsized upward leverage on arithmetic averages.
    // When variance is present, apply a gentle regression adjustment above 82% to protect student momentum
    // while accounting for regression to typical performance on upcoming high-stakes tasks:
    let sigma = historical.spread || 6.5;
    if (historical.subjectSpreads && Number.isFinite(historical.subjectSpreads[cleanSubj])) {
      sigma = historical.subjectSpreads[cleanSubj];
    }
    const varianceDampener = Math.min(1.0, Math.max(0, (sigma - 1.0) / 4.0));
    const highScoreElevation = Math.max(0, subjectAvg - 82);
    const effectiveSubjectAvg = subjectAvg - (highScoreElevation * 0.10 * varianceDampener);

    // Blend subject ability with half of type bias, passed through logarithmic ceiling:
    const rawMid = applyLogarithmicCeiling(effectiveSubjectAvg, 0.5 * typeModifier);
    const mid = Math.min(99.5, Math.max(10, round(rawMid, 1)));

    // 6. Low & High Spreads:
    // Scale Low and High moderately with variance, avoiding excessive spreads on volatile subjects
    // while reflecting realistic downside and upside potential:
    const lowHighScorePenalty = Math.max(0, mid - 75) * 0.20 * varianceDampener;
    const lowDelta = Math.min(18.0, Math.max(1.5, (sigma * sigma) / 20 + 0.45 * sigma + lowHighScorePenalty));
    const low = Math.max(0, round(mid - lowDelta, 1));
    const highDelta = Math.min(8.5, Math.max(1.5, 0.88 * sigma));
    const high = Math.min(100, round(applyLogarithmicCeiling(mid, highDelta), 1));

    // 7. Multiplicative 10% Breakout Score threshold (Score > 1.10 * High):
    const breakoutScore = round(1.10 * high, 2);

    return {
      unpredicted: false,
      hasPrecedent: true,
      low: Math.round(low),
      mid: Math.round(mid),
      high: Math.round(high),
      breakoutScore,
      taskType,
      type: taskType,
      subjectName: cleanSubj,
      basis
    };
  }

    window.ConnectifyPredictorEngine = {
      round,
      getAccountKey,
      cleanSubject,
      applyLogarithmicCeiling,
      getBaselines,
      saveBaselines,
      getHistoricalData,
      predictTask
    };
  } catch (err) {
    console.error('Connectify error in predictor-engine.js:', err);
  }
})();

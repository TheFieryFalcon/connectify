/**
 * Connectify Predictor Engine
 *
 * Core algorithmic prediction model, baseline regression, and prior task weighting.
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

  const getAccountKey = () => {
    try {
      return new URL(location.href).searchParams.get('coisp') || 'current';
    } catch {
      return 'current';
    }
  };

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

  // --- BASELINE STORAGE (Cold-Start Early in the Year) ---
  function getBaselines() {
    const account = getAccountKey();
    let types = {};
    let subjects = {};

    if (cachedBaselines) return cachedBaselines;

    const candidateTypeKeys = [
      'connectea:baseline:types',
      'connectea:baselines:types',
      'connectify:baseline:types',
      'connectify:baselines:types',
      `connectea:baseline:types:${account}`,
      `connectea:baselines:types:${account}`,
      `connectify:baselines:types:${account}`,
      `connectify:baseline:types:${account}`
    ];
    for (const key of candidateTypeKeys) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            types = { ...types, ...parsed };
          }
        }
      } catch {}
    }

    const candidateSubjKeys = [
      'connectea:baseline:subjects',
      'connectea:baselines:subjects',
      'connectify:baseline:subjects',
      'connectify:baselines:subjects',
      `connectea:baseline:subjects:${account}`,
      `connectea:baselines:subjects:${account}`,
      `connectify:baselines:subjects:${account}`,
      `connectify:baseline:subjects:${account}`
    ];
    for (const key of candidateSubjKeys) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            subjects = { ...subjects, ...parsed };
          }
        }
      } catch {}
    }

    cachedBaselines = { types, subjects };
    return cachedBaselines;
  }

  let cachedBaselines = null;

  function saveBaselines(updatedBaselines = {}) {
    cachedBaselines = null;
    const account = getAccountKey();
    const typeKey = `connectify:baseline:types:${account}`;
    const subjectKey = `connectify:baseline:subjects:${account}`;

    const candidateTypeKeys = [
      'connectea:baseline:types',
      'connectea:baselines:types',
      'connectify:baseline:types',
      'connectify:baselines:types',
      `connectea:baseline:types:${account}`,
      `connectea:baselines:types:${account}`,
      `connectify:baselines:types:${account}`,
      `connectify:baseline:types:${account}`
    ];
    const candidateSubjKeys = [
      'connectea:baseline:subjects',
      'connectea:baselines:subjects',
      'connectify:baseline:subjects',
      'connectify:baselines:subjects',
      `connectea:baseline:subjects:${account}`,
      `connectea:baselines:subjects:${account}`,
      `connectify:baselines:subjects:${account}`,
      `connectify:baseline:subjects:${account}`
    ];

    if (updatedBaselines.types !== undefined) {
      try {
        localStorage.setItem(typeKey, JSON.stringify(updatedBaselines.types || {}));
        for (const k of candidateTypeKeys) {
          if (k !== typeKey) {
            try { localStorage.removeItem(k); } catch {}
          }
        }
      } catch {}
    }
    if (updatedBaselines.subjects !== undefined) {
      try {
        localStorage.setItem(subjectKey, JSON.stringify(updatedBaselines.subjects || {}));
        for (const k of candidateSubjKeys) {
          if (k !== subjectKey) {
            try { localStorage.removeItem(k); } catch {}
          }
        }
      } catch {}
    }

    cachedBaselines = {
      types: updatedBaselines.types || {},
      subjects: updatedBaselines.subjects || {}
    };

    if (window.ConnectifyPredictorMath?.updatePredictionCache) {
      window.ConnectifyPredictorMath.updatePredictionCache();
    } else {
      updatePredictionCache();
    }

    window.dispatchEvent(new CustomEvent('connectify-baselines-updated', {
      detail: updatedBaselines
    }));
  }

  // --- HISTORICAL PERFORMANCE SCRAPER ---
  function getHistoricalData(subjectList) {
    const subjects = subjectList || (window.ConnectifyData?.collect ? window.ConnectifyData.collect(true) : []);
    const subjectStats = {};
    const typeStats = {};
    const typeCounts = {};
    let totalScoreWeight = 0;
    let totalWeight = 0;
    const allTaskScores = [];

    for (const subj of subjects) {
      const cleanName = cleanSubject(subj.name);
      if (!subjectStats[cleanName]) {
        subjectStats[cleanName] = { earned: 0, weight: 0, tasks: [] };
      }

      for (const t of subj.tasks || []) {
        if (t.weight > 0 && !t.pending && Number.isFinite(t.score)) {
          const earned = (t.score / 100) * t.weight;
          subjectStats[cleanName].earned += earned;
          subjectStats[cleanName].weight += t.weight;
          subjectStats[cleanName].tasks.push(t.score);
          allTaskScores.push(t.score);

          const taskType = window.ConnectifyTaskTypes?.getEffectiveType
            ? window.ConnectifyTaskTypes.getEffectiveType(subj.name, t)
            : 'Take-Home';

          if (!typeStats[taskType]) {
            typeStats[taskType] = { earned: 0, weight: 0 };
            typeCounts[taskType] = 0;
          }
          typeStats[taskType].earned += earned;
          typeStats[taskType].weight += t.weight;
          typeCounts[taskType]++;

          totalScoreWeight += earned;
          totalWeight += t.weight;
        }
      }
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

    // Calculate empirical score standard deviation across completed tasks
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
    if (subjectAvg === undefined && baselines?.subjects) {
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

    if (completedTypeCount === 0 && baselines?.types?.[taskType] !== undefined) {
      typeAvg = Number(baselines.types[taskType]);
    } else if (typeAvg === undefined || !Number.isFinite(typeAvg) || completedTypeCount === 0) {
      typeAvg = subjectAvg;
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
      subjectName: cleanSubj
    };
  }

  // --- PREDICTION PERSISTENCE & CACHING ---

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('connectify-baselines-updated', () => {
        cachedBaselines = null;
      });
      window.addEventListener('storage', e => {
        if (e.key && (e.key.includes('baseline') || e.key.includes('prediction'))) {
          cachedBaselines = null;
        }
      });
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

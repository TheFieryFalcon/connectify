/**
 * Connectify Subject Mark & ATAR Predictor
 *
 * Implements historical mark prediction, trajectory variance extrapolation,
 * outcome tier evaluation, and subject grade projection.
 * Exposes window.ConnectifyPredictorMath.
 */
(() => {
  'use strict';

  let cachedBaselines = null;

  const engine = window.ConnectifyPredictorEngine || {};
  const dates = window.ConnectifyPredictorDates || {};
  const cache = window.ConnectifyPredictorCache || {};

  const round = (val, decimals = 1) => (window.ConnectifyPredictorEngine?.round || engine.round || ((v, d = 1) => Number(Math.round(v + 'e' + d) + 'e-' + d)))(val, decimals);
  const cleanSubject = (...args) => (window.ConnectifyPredictorEngine?.cleanSubject || engine.cleanSubject)(...args);
  const getAccountKey = (...args) => (window.ConnectifyPredictorEngine?.getAccountKey || engine.getAccountKey || (() => 'current'))(...args);
  const applyLogarithmicCeiling = (...args) => (window.ConnectifyPredictorEngine?.applyLogarithmicCeiling || engine.applyLogarithmicCeiling || ((b, d) => b + d))(...args);
  const getBaselines = (...args) => (window.ConnectifyPredictorEngine?.getBaselines || engine.getBaselines)(...args);
  const saveBaselines = (...args) => (window.ConnectifyPredictorEngine?.saveBaselines || engine.saveBaselines)(...args);
  const predictTask = (...args) => (window.ConnectifyPredictorEngine?.predictTask || engine.predictTask)(...args);
  const getHistoricalData = (...args) => (window.ConnectifyPredictorEngine?.getHistoricalData || engine.getHistoricalData)(...args);

  const resolveCustomDate = (...args) => (window.ConnectifyPredictorDates?.resolveCustomDate || dates.resolveCustomDate)(...args);
  const formatCustomWeek = (...args) => (window.ConnectifyPredictorDates?.formatCustomWeek || dates.formatCustomWeek)(...args);
  const hasParsableDate = (...args) => (window.ConnectifyPredictorDates?.hasParsableDate || dates.hasParsableDate)(...args);
  const getTaskChronologicalStamp = (...args) => (window.ConnectifyPredictorDates?.getTaskChronologicalStamp || dates.getTaskChronologicalStamp)(...args);

  const isPredictionCacheCurrent = (...args) => (window.ConnectifyPredictorCache?.isPredictionCacheCurrent || cache.isPredictionCacheCurrent)(...args);
  const setPredictionCacheCurrent = (...args) => (window.ConnectifyPredictorCache?.setPredictionCacheCurrent || cache.setPredictionCacheCurrent)(...args);
  const predictionMemoryCache = window.ConnectifyPredictorCache?.predictionMemoryCache || cache.predictionMemoryCache || new Map();
  const cachePrediction = (...args) => (window.ConnectifyPredictorCache?.cachePrediction || cache.cachePrediction)(...args);
  const cacheTaskPrediction = (...args) => (window.ConnectifyPredictorCache?.cacheTaskPrediction || cache.cacheTaskPrediction)(...args);
  const getCachedPrediction = (...args) => (window.ConnectifyPredictorCache?.getCachedPrediction || cache.getCachedPrediction)(...args);
  const getHistoricalDataPriorTo = (...args) => (window.ConnectifyPredictorCache?.getHistoricalDataPriorTo || cache.getHistoricalDataPriorTo)(...args);
  const populateChronologicalPredictions = (...args) => (window.ConnectifyPredictorCache?.populateChronologicalPredictions || cache.populateChronologicalPredictions)(...args);
  const getOrComputeTaskPrediction = (...args) => (window.ConnectifyPredictorCache?.getOrComputeTaskPrediction || cache.getOrComputeTaskPrediction)(...args);
  const clearSubjectPredictionCache = (...args) => (window.ConnectifyPredictorCache?.clearSubjectPredictionCache || cache.clearSubjectPredictionCache)(...args);
  const updatePredictionCache = (...args) => (window.ConnectifyPredictorCache?.updatePredictionCache || cache.updatePredictionCache)(...args);

  const PREDICTOR_ALGO_VERSION = window.ConnectifyPredictorCache?.PREDICTOR_ALGO_VERSION || cache.PREDICTOR_ALGO_VERSION || 'v10_20261003_pred';
  const PREDICTOR_CACHE_VERSION_KEY = window.ConnectifyPredictorCache?.PREDICTOR_CACHE_VERSION_KEY || cache.PREDICTOR_CACHE_VERSION_KEY || 'connectify:cache_version:predictor';

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

  // --- SUBJECT GRADE PROJECTIONS ---
  function projectSubjectGrades(subjectsList) {
    const rawSubjects = subjectsList || (window.ConnectifyData?.collect ? window.ConnectifyData.collect(true) : []);
    const baselines = getBaselines();
    const historical = getHistoricalData(rawSubjects);
    const results = [];

    // Group subjects by clean name so Semester 1 and Semester 2 outlines are unified per subject course
    const subjectsMap = new Map();
    for (const s of rawSubjects) {
      const cleanName = cleanSubject(s.name);
      if (!subjectsMap.has(cleanName)) {
        subjectsMap.set(cleanName, {
          name: cleanName,
          tasks: []
        });
      }
      const entry = subjectsMap.get(cleanName);
      if (Array.isArray(s.tasks)) {
        entry.tasks.push(...s.tasks);
      }
    }
    const subjects = Array.from(subjectsMap.values());

    for (const subj of subjects) {
      const cleanName = subj.name;
      let completedEarned = 0;
      let completedWeight = 0;
      const completedTasks = [];
      const upcomingTasks = [];
      const seenUpcomingTaskNames = new Set();

      for (const t of subj.tasks || []) {
        if (t.weight > 0 && !t.pending && Number.isFinite(t.score)) {
          completedEarned += (t.score / 100) * t.weight;
          completedWeight += t.weight;
          completedTasks.push(t);
        } else {
          // Unfinished task candidate:
          // Strictly exclude tasks with 0% weight, non-positive weight, or non-finite weight (e.g. NaN%):
          if (!t.weight || t.weight <= 0 || !Number.isFinite(t.weight)) {
            continue;
          }

          const normName = cleanSubject(t.name).toLowerCase();

          // Deduplication: skip if already seen in upcoming or already completed in this subject
          if (seenUpcomingTaskNames.has(normName)) continue;
          if (completedTasks.some(ct => cleanSubject(ct.name).toLowerCase() === normName)) continue;

          // Check if custom date is set in Progress Graph:
          const customTime = resolveCustomDate(subj.name, t);
          if (customTime !== null) {
            if (customTime === '') {
              // Explicitly cleared or suppressed by user
              continue;
            }
            const formatted = formatCustomWeek(customTime);
            if (formatted) {
              t.order = formatted.order;
              t.caption = formatted.display;
              t.customDate = formatted.display;
              t.dateDisplay = formatted.display;
            } else {
              // Invalid custom date format
              continue;
            }
          }

          // If date cannot be parsed and no valid custom date set, do not predict in the predictor
          if (!hasParsableDate(t, subj.name)) {
            continue;
          }

          if (!Number.isFinite(t.order)) {
            const parsed = formatCustomWeek(t.caption);
            if (parsed && Number.isFinite(parsed.order)) {
              t.order = parsed.order;
            }
          }
          if (!t.dateDisplay && Number.isFinite(t.order) && window.ConnectifyProgressMath?.formatTimestamp) {
            t.dateDisplay = window.ConnectifyProgressMath.formatTimestamp(t.order, t.caption);
          }

          seenUpcomingTaskNames.add(normName);
          upcomingTasks.push(t);
        }
      }

      const runningMark = completedWeight > 0 ? (completedEarned / completedWeight) * 100 : null;
      const baselineMark = baselines.subjects[cleanName] !== undefined ? Number(baselines.subjects[cleanName]) : null;
      const hasSubjectAverage = runningMark !== null || baselineMark !== null;

      let upcomingLowEarned = 0;
      let upcomingMidEarned = 0;
      let upcomingHighEarned = 0;
      let predictedUpcomingWeight = 0;
      let unpredictedUpcomingWeight = 0;

      const upcomingPredictions = [];

      for (const task of upcomingTasks) {
        const taskWeight = task.weight || 0;
        if (taskWeight <= 0 || !Number.isFinite(taskWeight)) continue;

        const pred = getOrComputeTaskPrediction(subj.name, task, rawSubjects) || {
          unpredicted: true,
          reason: 'Prediction unavailable',
          taskType: window.ConnectifyTaskTypes?.getEffectiveType ? window.ConnectifyTaskTypes.getEffectiveType(subj.name, task) : 'Take-Home'
        };

        if (!pred.unpredicted) {
          upcomingLowEarned += (pred.low / 100) * taskWeight;
          upcomingMidEarned += (pred.mid / 100) * taskWeight;
          upcomingHighEarned += (pred.high / 100) * taskWeight;
          predictedUpcomingWeight += taskWeight;
        } else {
          unpredictedUpcomingWeight += taskWeight;
          // If subject has a running or baseline mark, fallback unpredicted task to subject baseline for projection:
          const fallbackScore = runningMark ?? baselineMark;
          if (fallbackScore !== null) {
            upcomingLowEarned += (Math.max(0, fallbackScore - 7) / 100) * taskWeight;
            upcomingMidEarned += (fallbackScore / 100) * taskWeight;
            upcomingHighEarned += (Math.min(100, fallbackScore + 7) / 100) * taskWeight;
          }
        }

        upcomingPredictions.push({
          task,
          prediction: pred
        });
      }

      const totalSubjectWeight = completedWeight + predictedUpcomingWeight + unpredictedUpcomingWeight;
      let projectedLow = null;
      let projectedMid = null;
      let projectedHigh = null;

      if (hasSubjectAverage && totalSubjectWeight > 0) {
        projectedLow = round(((completedEarned + upcomingLowEarned) / totalSubjectWeight) * 100, 1);
        projectedMid = round(((completedEarned + upcomingMidEarned) / totalSubjectWeight) * 100, 1);
        projectedHigh = round(((completedEarned + upcomingHighEarned) / totalSubjectWeight) * 100, 1);

        // Ensure distinct scenario bounds for subject projections
        const remainingRatio = Math.max(0.15, (predictedUpcomingWeight + unpredictedUpcomingWeight) / totalSubjectWeight);
        const minSubjectSpread = Math.max(2.0, round(7.5 * remainingRatio, 1));
        if (projectedMid - projectedLow < minSubjectSpread) {
          projectedLow = Math.max(0, round(projectedMid - minSubjectSpread, 1));
        }
        if (projectedHigh - projectedMid < minSubjectSpread) {
          projectedHigh = Math.min(100, round(applyLogarithmicCeiling(projectedMid, minSubjectSpread), 1));
        }
      } else if (hasSubjectAverage && completedWeight > 0) {
        const midScore = round(runningMark, 1);
        projectedMid = midScore;
        projectedLow = Math.max(0, round(midScore - 2.5, 1));
        projectedHigh = Math.min(100, round(applyLogarithmicCeiling(midScore, 2.5), 1));
      } else if (hasSubjectAverage && baselineMark !== null) {
        const baseScore = round(baselineMark, 1);
        projectedMid = baseScore;
        projectedLow = Math.max(0, round(baseScore - 4.0, 1));
        projectedHigh = Math.min(100, round(applyLogarithmicCeiling(baseScore, 4.0), 1));
      }

      results.push({
        rawName: subj.name,
        cleanName,
        runningMark: runningMark !== null ? round(runningMark, 1) : null,
        baselineMark: baselineMark !== null ? round(baselineMark, 1) : null,
        hasSubjectAverage,
        completedWeight: round(completedWeight, 1),
        completedCount: completedTasks.length,
        upcomingCount: upcomingTasks.length,
        projected: {
          low: projectedLow,
          mid: projectedMid,
          high: projectedHigh
        },
        upcomingPredictions
      });
    }

    return results;
  }

  // --- ATAR PROJECTION AGGREGATOR ---
  function projectATAR(projectedSubjectsList) {
    const math = window.ConnectifyMath;
    if (!math || !math.calculate) {
      return { error: 'Connectify ATAR Math engine not loaded.' };
    }

    const projectedSubjects = projectedSubjectsList || projectSubjectGrades();
    const eligibleCourses = projectedSubjects.filter(s =>
      !/\bGeneral\b|\bmathematics essentials?\b/i.test(s.cleanName)
    );

    if (eligibleCourses.length < 4) {
      return {
        error: 'At least four ATAR courses are required to project ATAR.',
        eligibleCount: eligibleCourses.length
      };
    }

    let preferences = {};
    try {
      if (window.ConnectifyAtarCalc?.getPreferences) {
        preferences = window.ConnectifyAtarCalc.getPreferences() || {};
      } else {
        const account = getAccountKey();
        const storageKey = `connectea:atar:2025:${account}:${new Date().getFullYear()}`;
        preferences = JSON.parse(localStorage.getItem(storageKey) || '{}');
        const rawPrefs = localStorage.getItem('connectea:preferences');
        if (rawPrefs) {
          preferences = { ...preferences, ...JSON.parse(rawPrefs) };
        }
      }
    } catch {}

    let sem1Courses = [];
    if (window.ConnectifyAtarScraper?.readCourses) {
      try {
        const read = window.ConnectifyAtarScraper.readCourses(true);
        sem1Courses = read[0] || [];
      } catch {}
    }

    const scenarios = ['low', 'mid', 'high'];
    const atarResults = {};

    for (const scenario of scenarios) {
      const coursesForCalc = eligibleCourses.map(course => {
        const rawScore = course.projected[scenario] ?? course.runningMark ?? course.baselineMark;
        const courseId = course.cleanName.toLowerCase();
        const calibration = preferences[`sem1_calibration:${courseId}`];
        const knownSem1Raw = calibration?.raw !== undefined
          ? calibration.raw
          : sem1Courses.find(r => r.id === courseId)?.mark;
        const knownSem1Scaled = calibration?.scaled;

        let scaledScore = rawScore;
        if (math.calculateShiftedScaledScore && Number.isFinite(rawScore)) {
          const shifted = math.calculateShiftedScaledScore(course.cleanName, rawScore, knownSem1Raw, knownSem1Scaled, 2025);
          if (Number.isFinite(shifted)) scaledScore = shifted;
        }

        const roundedScore = math.wholeScore
          ? math.wholeScore(scaledScore)
          : (Number.isFinite(scaledScore) ? Math.round(scaledScore) : undefined);

        return {
          name: course.cleanName,
          id: courseId,
          mark: rawScore !== null && Number.isFinite(rawScore) ? round(rawScore, 1) : rawScore,
          score: roundedScore,
          include: Number.isFinite(roundedScore)
        };
      });

      const res = math.calculate(coursesForCalc);
      const teaAdjustment = 0; // Year 11 TEA scaling adjustment penalty removed

      if (res && !res.error) {
        const finalTEA = Math.max(0, res.tea + teaAdjustment);
        const finalAtar = math.convertTEAtoATAR ? math.convertTEAtoATAR(finalTEA) : '—';
        atarResults[scenario] = {
          atar: finalAtar,
          tea: round(finalTEA, 1),
          baseTEA: round(res.base, 1),
          bonusTEA: round(res.bonus, 1),
          topCourses: res.top || [],
          courses: coursesForCalc,
          yearAdjustment: 0
        };
      } else {
        atarResults[scenario] = {
          atar: '—',
          tea: 0,
          error: res?.error || 'Unable to calculate'
        };
      }
    }

    return {
      low: atarResults.low,
      mid: atarResults.mid,
      high: atarResults.high,
      courses: eligibleCourses
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

    window.addEventListener('connectify-baselines-updated', () => {
      cachedBaselines = null;
    });

    window.addEventListener('storage', e => {
      if (e.key && (e.key.includes('baseline') || e.key.includes('prediction'))) {
        cachedBaselines = null;
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

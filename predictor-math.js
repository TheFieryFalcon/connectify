/**
 * Connectify Grade & ATAR Predictor Mathematics & Caching Engine
 *
 * Implements:
 * - Cold-start baseline lookups & persistence (Assessment Types & Subject Grades)
 * - Historical assessment momentum modeling
 * - Logarithmic scaling above 80% (as scores approach 100%, incremental gains require exponential effort)
 * - Task-level Low, Middle, High predictions and persistent localStorage caching
 * - Four-segment outcome evaluation + double-height Purple "breakout" segment (>15% over High)
 * - Subject final average projections and ATAR Low/Mid/High aggregations.
 *
 * Provides `window.ConnectifyPredictorMath`.
 */
(() => {
  'use strict';

  if (window.ConnectifyPredictorMath) return;

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
    const typeKey = `connectify:baseline:types:${account}`;
    const subjectKey = `connectify:baseline:subjects:${account}`;
    let types = {};
    let subjects = {};

    try {
      const storedTypes = localStorage.getItem(typeKey);
      if (storedTypes) types = JSON.parse(storedTypes) || {};
    } catch {}

    try {
      const storedSubj = localStorage.getItem(subjectKey);
      if (storedSubj) subjects = JSON.parse(storedSubj) || {};
    } catch {}

    return { types, subjects };
  }

  function saveBaselines(updatedBaselines = {}) {
    const account = getAccountKey();
    const typeKey = `connectify:baseline:types:${account}`;
    const subjectKey = `connectify:baseline:subjects:${account}`;

    if (updatedBaselines.types) {
      try {
        localStorage.setItem(typeKey, JSON.stringify(updatedBaselines.types));
      } catch {}
    }
    if (updatedBaselines.subjects) {
      try {
        localStorage.setItem(subjectKey, JSON.stringify(updatedBaselines.subjects));
      } catch {}
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
        subjectAverages[name] = (data.earned / data.weight) * 100;
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
        typeAverages[type] = (data.earned / data.weight) * 100;
      }
    }

    const overallAverage = totalWeight > 0 ? (totalScoreWeight / totalWeight) * 100 : null;

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
  function predictTask(subjectName, task, customHistorical, customBaselines) {
    const cleanSubj = cleanSubject(subjectName);
    const baselines = customBaselines || getBaselines();
    const historical = customHistorical || getHistoricalData();

    const taskType = window.ConnectifyTaskTypes?.getEffectiveType
      ? window.ConnectifyTaskTypes.getEffectiveType(subjectName, task)
      : 'Take-Home';

    // 1. Resolve subject performance:
    let subjectAvg = historical.subjects[cleanSubj];
    if (subjectAvg === undefined && baselines.subjects[cleanSubj] !== undefined) {
      subjectAvg = Number(baselines.subjects[cleanSubj]);
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
    const completedTypeCount = historical.typeCounts[taskType] || 0;
    let typeAvg = historical.types[taskType];

    if (completedTypeCount === 0 && baselines.types[taskType] !== undefined) {
      typeAvg = Number(baselines.types[taskType]);
    }

    // Cold-start rule: Do not predict first assessment of a given type without precedent or baseline
    if (typeAvg === undefined || !Number.isFinite(typeAvg) || (completedTypeCount === 0 && baselines.types[taskType] === undefined)) {
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
    // Blend subject ability with half of type bias, passed through logarithmic ceiling:
    const rawMid = applyLogarithmicCeiling(subjectAvg, 0.5 * typeModifier);
    const mid = Math.min(99.5, Math.max(10, round(rawMid, 1)));

    // 6. Low & High Spreads (scaling Low more strongly with variance):
    let sigma = historical.spread || 6.5;
    if (historical.subjectSpreads && Number.isFinite(historical.subjectSpreads[cleanSubj])) {
      sigma = historical.subjectSpreads[cleanSubj];
    }
    const lowDelta = Math.min(14.0, Math.max(2.0, (sigma * sigma) / 12 + 0.5 * sigma));
    const low = Math.max(0, round(mid - lowDelta, 1));
    const high = Math.min(100, round(applyLogarithmicCeiling(mid, 1.25 * sigma), 1));

    // 7. Multiplicative 15% Breakout Score threshold (Score > 1.15 * High):
    const breakoutScore = round(1.15 * high, 2);

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
  function getTaskPredictionKey(subjectName, taskId) {
    const account = getAccountKey();
    const cleanSubj = cleanSubject(subjectName).toLowerCase();
    return `connectify:prediction:${account}:${cleanSubj}:${taskId}`;
  }

  function cachePrediction(subjectName, taskId, prediction) {
    if (!taskId || !prediction || prediction.unpredicted) return;
    try {
      const key = getTaskPredictionKey(subjectName, taskId);
      const payload = {
        low: prediction.low,
        mid: prediction.mid,
        high: prediction.high,
        breakoutScore: prediction.breakoutScore,
        taskType: prediction.taskType || prediction.type,
        type: prediction.type || prediction.taskType,
        timestamp: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {}
  }

  function getCachedPrediction(subjectName, taskId) {
    if (!taskId) return null;
    try {
      const key = getTaskPredictionKey(subjectName, taskId);
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Number.isFinite(parsed.low) && Number.isFinite(parsed.mid) && Number.isFinite(parsed.high)) {
          if (!Number.isFinite(parsed.breakoutScore)) {
            parsed.breakoutScore = round(1.15 * parsed.high, 2);
          }
          if (!parsed.taskType && parsed.type) parsed.taskType = parsed.type;
          if (!parsed.type && parsed.taskType) parsed.type = parsed.taskType;
          return parsed;
        }
      }
    } catch {}
    return null;
  }

  // --- OUTCOME EVALUATION (Vertical Bar Segments) ---
  /**
   * Evaluates actual score against prediction:
   * - Breakout: Score > 1.15 * High (multiplicative) -> 5 segments (Red, Orange, Yellow, Green, Purple double-height)
   * - High: Score >= High -> 4 segments (Red, Orange, Yellow, Green)
   * - Middle: Score >= Middle -> 3 segments (Red, Orange, Yellow)
   * - Low: Score >= Low -> 2 segments (Red, Orange)
   * - Below Low: Score < Low -> 1 segment (Red)
   */
  function evaluateOutcome(score, prediction) {
    if (!Number.isFinite(score) || !prediction || prediction.unpredicted) return null;

    const low = prediction.low;
    const mid = prediction.mid;
    const high = prediction.high;
    const breakoutThreshold = Number.isFinite(prediction.breakoutScore)
      ? prediction.breakoutScore
      : round(1.15 * high, 2);

    if (score > breakoutThreshold) {
      return {
        segments: 5,
        broken: true,
        colors: ['red', 'orange', 'yellow', 'green', 'purple'],
        label: `Breakout! Scored ${round(score, 1)}% (+15% over High ${high}%)`,
        details: `Actual: ${round(score, 1)}% | Low: ${low}% · Mid: ${mid}% · High: ${high}% · Breakout: >${breakoutThreshold}%`
      };
    }

    if (score >= high) {
      return {
        segments: 4,
        broken: false,
        colors: ['red', 'orange', 'yellow', 'green'],
        label: `High! Scored ${round(score, 1)}% (met/exceeded High estimate ${high}%)`,
        details: `Actual: ${round(score, 1)}% | Low: ${low}% · Mid: ${mid}% · High: ${high}%`
      };
    }

    if (score >= mid) {
      return {
        segments: 3,
        broken: false,
        colors: ['red', 'orange', 'yellow'],
        label: `Middle! Scored ${round(score, 1)}% (met expected momentum ${mid}%)`,
        details: `Actual: ${round(score, 1)}% | Low: ${low}% · Mid: ${mid}% · High: ${high}%`
      };
    }

    if (score >= low) {
      return {
        segments: 2,
        broken: false,
        colors: ['red', 'orange'],
        label: `Low! Scored ${round(score, 1)}% (within Low estimate ${low}%)`,
        details: `Actual: ${round(score, 1)}% | Low: ${low}% · Mid: ${mid}% · High: ${high}%`
      };
    }

    return {
      segments: 1,
      broken: false,
      colors: ['red'],
      label: `Below Low! Scored ${round(score, 1)}% (under Low estimate ${low}%)`,
      details: `Actual: ${round(score, 1)}% | Low: ${low}% · Mid: ${mid}% · High: ${high}%`
    };
  }

  // --- SUBJECT GRADE PROJECTIONS ---
  function projectSubjectGrades(subjectsList) {
    const subjects = subjectsList || (window.ConnectifyData?.collect ? window.ConnectifyData.collect(true) : []);
    const baselines = getBaselines();
    const historical = getHistoricalData(subjects);
    const results = [];

    for (const subj of subjects) {
      const cleanName = cleanSubject(subj.name);
      let completedEarned = 0;
      let completedWeight = 0;
      const completedTasks = [];
      const upcomingTasks = [];

      for (const t of subj.tasks || []) {
        if (t.weight > 0 && !t.pending && Number.isFinite(t.score)) {
          completedEarned += (t.score / 100) * t.weight;
          completedWeight += t.weight;
          completedTasks.push(t);
        } else {
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
        const pred = predictTask(subj.name, task, historical, baselines);
        // Cache upcoming prediction so it persists when task gets graded later:
        if (!pred.unpredicted && task.id) {
          cachePrediction(subj.name, task.id, pred);
        }

        const taskWeight = task.weight || 0;
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
      } else if (hasSubjectAverage && completedWeight > 0) {
        projectedLow = projectedMid = projectedHigh = round(runningMark, 1);
      } else if (hasSubjectAverage && baselineMark !== null) {
        projectedLow = projectedMid = projectedHigh = round(baselineMark, 1);
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
    predictTask,
    cachePrediction,
    getCachedPrediction,
    evaluateOutcome,
    projectSubjectGrades,
    projectATAR,
    cleanSubject
  };
})();

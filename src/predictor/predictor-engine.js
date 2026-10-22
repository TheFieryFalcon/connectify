/**
 * Connectify Predictor Engine
 *
 * Core prediction model: the subject's own results (recent ones count more) shifted by how the student
 * does on the type across all subjects (each result against its own subject's average), a spread from the subject's results, logarithmic headroom, and per-task
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
  const RECENCY = 0.85;     // each later result in the subject makes an earlier one count this much less
  const SPREAD_PRIOR = 3;   // results' worth of the student's typical spread blended into the subject's own
  const RANGE_Z = 0.85;     // Low / High sit near the 20th / 80th percentiles of the predicted result
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /** Weighted mean, spread and effective count: recent and heavier results count more. */
  function summarise(results) {
    let sw = 0, sw2 = 0, sx = 0;
    for (const r of results) { sw += r.w; sw2 += r.w * r.w; sx += r.w * r.score; }
    if (!(sw > 0)) return null;
    const mean = sx / sw;
    const denom = sw - sw2 / sw;
    const sd = results.length >= 2 && denom > 0
      ? Math.sqrt(results.reduce((acc, r) => acc + r.w * Math.pow(r.score - mean, 2), 0) / denom)
      : null;
    return { mean, sd, nEff: (sw * sw) / sw2, count: results.length };
  }

  /** This subject's results (date order) with their weights, from the history (or its averages alone). */
  function subjectResults(historical, cleanSubj) {
    const list = historical?.subjectResults?.[cleanSubj];
    if (Array.isArray(list) && list.length) {
      return list.map((r, i) => ({ ...r, w: Math.pow(RECENCY, list.length - 1 - i) * Math.sqrt(r.weight > 0 ? r.weight : 1) }));
    }
    return null;
  }

  /**
   * How the student does on a type compared with each subject's own average, pooled across every subject:
   * a weak subject full of one type says nothing about the type, so its results only count against that subject.
   */
  function typeShift(historical, taskType) {
    let sw = 0, sx = 0, count = 0;
    for (const [name, list] of Object.entries(historical?.subjectResults || {})) {
      const mean = historical.subjects?.[name];
      if (!Number.isFinite(mean)) continue;
      for (const r of list) {
        if (r.type !== taskType) continue;
        const w = r.weight > 0 ? r.weight : 1;
        sw += w; sx += w * (r.score - mean); count++;
      }
    }
    return count ? { shift: sx / sw, count } : null;
  }

  function predictTask(subjectName, task, customHistorical, customBaselines, customIsCompleted = false) {
    const cleanSubj = cleanSubject(subjectName);
    const baselines = customBaselines || getBaselines();
    const historical = customHistorical || getHistoricalData();
    const taskType = window.ConnectifyTaskTypes?.getEffectiveType
      ? window.ConnectifyTaskTypes.getEffectiveType(subjectName, task)
      : 'Take-Home';
    const unpredicted = reason => ({ unpredicted: true, reason, taskType, type: taskType, subjectName: cleanSubj });

    // 1. The subject: its own results, else its averages, else last year's baseline
    const results = subjectResults(historical, cleanSubj);
    let subject = results ? summarise(results) : null;
    if (!subject && Number.isFinite(historical?.subjects?.[cleanSubj])) {
      const sd = historical.subjectSpreads?.[cleanSubj];
      const count = historical.subjectCounts?.[cleanSubj] || (Number.isFinite(sd) ? 2 : 1);
      subject = { mean: historical.subjects[cleanSubj], sd: Number.isFinite(sd) ? sd : null, nEff: count, count };
    }
    const subjectSource = subject ? 'history' : 'baseline';
    if (!subject) {
      const base = Number(baselines?.subjects?.[cleanSubj] ?? baselines?.subjects?.[subjectName]);
      if (!Number.isFinite(base)) return unpredicted('missing_subject_baseline');
      subject = { mean: base, sd: null, nEff: 0, count: 0 };
    }

    // 2. The type: how the student does on it across all subjects, each result against its own subject's
    //    average (else the type average against the overall one, or last year's type average), at half strength
    const shifted = typeShift(historical, taskType);
    const typeCount = shifted ? shifted.count : (historical?.typeCounts?.[taskType] || 0);
    const overall = Number.isFinite(historical?.overallAverage) ? historical.overallAverage : subject.mean;
    const typeBaseline = Number(baselines?.types?.[taskType]);
    let typeSource = 'subject';
    let affinity = 0;
    if (shifted) {
      typeSource = 'history';
      affinity = shifted.shift;
    } else if (typeCount > 0 && Number.isFinite(historical?.types?.[taskType])) {
      typeSource = 'history';
      affinity = historical.types[taskType] - overall;
    } else if (baselines?.types?.[taskType] !== undefined && Number.isFinite(typeBaseline)) {
      typeSource = 'baseline';
      affinity = typeBaseline - overall;
    }
    const expected = subject.mean + 0.5 * affinity;

    // What the prediction rests on, for the expanded prediction card (cohort-expanded.js)
    const basis = {
      typeSource,
      typeCount: typeSource === 'history' ? typeCount : 0,
      subjectSource,
      subjectCount: subjectSource === 'history' ? subject.count : 0
    };

    // 3. Spread: the subject's own spread, blended with the student's typical spread across subjects;
    //    a prediction from few results is less certain, so it widens further
    const typical = Number.isFinite(historical?.spread) ? clamp(historical.spread, 4, 14) : 8;
    const df = subject.sd !== null ? Math.max(1, subject.nEff - 1) : 0;
    const sigma = Math.sqrt((SPREAD_PRIOR * typical * typical + df * Math.pow(subject.sd || 0, 2)) / (SPREAD_PRIOR + df));
    const predictive = sigma * Math.sqrt(1 + 1 / Math.max(1, subject.nEff));

    // 4. Mid: very high averages regress slightly when results vary
    const varianceDampener = Math.min(1.0, Math.max(0, (sigma - 1.0) / 4.0));
    const elevated = expected - Math.max(0, expected - 82) * 0.10 * varianceDampener;
    const mid = clamp(round(elevated, 1), 10, 99.5);

    // 5. Low / High: the same distance either side, gains above 80% through the logarithmic headroom
    const delta = clamp(RANGE_Z * predictive, 2.5, 22);
    const low = Math.max(0, round(mid - delta, 1));
    const high = Math.min(100, round(applyLogarithmicCeiling(mid, delta), 1));

    return {
      unpredicted: false,
      hasPrecedent: true,
      low: Math.round(low),
      mid: Math.round(mid),
      high: Math.round(high),
      // Multiplicative 10% breakout threshold (Score > 1.10 * High)
      breakoutScore: round(1.10 * high, 2),
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

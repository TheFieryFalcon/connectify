(() => {
  'use strict';

  const TEA_ATAR_TABLE = [
    [128.2, 30],
    [156.6, 40],
    [179, 50],
    [188.3, 55],
    [197.7, 60.05],
    [199.2, 61],
    [201, 62],
    [203, 63],
    [204.8, 64],
    [206.9, 65],
    [208.8, 66],
    [210.7, 67],
    [212.5, 68],
    [214.6, 69],
    [216.4, 70],
    [218.3, 71.05],
    [220.3, 72],
    [222.4, 73.05],
    [224.6, 74],
    [226.6, 75],
    [228.6, 76],
    [230.7, 77],
    [232.9, 78],
    [235.1, 79],
    [237.3, 80],
    [240.1, 81.05],
    [242.7, 82],
    [245.5, 83],
    [248.5, 84],
    [251.4, 85],
    [254.7, 86],
    [258, 87],
    [261.5, 88],
    [265.1, 89],
    [269.4, 90],
    [273.4, 91],
    [278.1, 92],
    [283.5, 93],
    [289.5, 94],
    [296.4, 95],
    [303.7, 96],
    [313, 97],
    [324.6, 98],
    [334.1, 98.5],
    [345.1, 99],
    [363.8, 99.5],
    [376.4, 99.7],
    [382.1, 99.8],
    [393, 99.9],
    [402.5, 99.95]
  ];

  const normalize = text => String(text ?? '').replace(/\s+/g, ' ').trim();
  const scoreValue = value => {
    if (value !== '' && value !== null && value !== undefined) {
      const num = Number(value);
      if (Number.isFinite(num) && num >= 0 && num <= 100) return num;
    }
    return undefined;
  };
  const wholeScore = value => {
    if (scoreValue(value) === undefined) return undefined;
    return Math.max(0, Math.ceil(Number(value) - 0.5));
  };

  function convertTEAtoATAR(tea) {
    if (tea < TEA_ATAR_TABLE[0][0]) return '<30';
    if (tea >= TEA_ATAR_TABLE.at(-1)[0]) return '99.95';
    for (let i = 1; i < TEA_ATAR_TABLE.length; i++) {
      const [teaLower, atarLower] = TEA_ATAR_TABLE[i - 1];
      const [teaUpper, atarUpper] = TEA_ATAR_TABLE[i];
      if (tea <= teaUpper) {
        const interpolated = atarLower + ((tea - teaLower) / (teaUpper - teaLower)) * (atarUpper - atarLower);
        return (Math.round(interpolated * 20) / 20).toFixed(2);
      }
    }
  }

  const LANGUAGE_SUBJECTS = new Set(['arabic', 'auslan', 'bengali', 'bosnian', 'chinese', 'croatian', 'dutch', 'filipino', 'french', 'german', 'hebrew', 'hindi', 'hungarian', 'indonesian', 'italian', 'japanese', 'korean', 'modern greek', 'persian', 'polish', 'portuguese', 'punjabi', 'russian', 'serbian', 'sinhala', 'spanish', 'swedish', 'tamil', 'turkish', 'vietnamese']);

  function bonusType(name) {
    const normalized = normalize(name).toLowerCase();
    if (normalized === 'mathematics methods' || normalized === 'mathematics specialist') return normalized;
    const language = normalized.split(':')[0].replace(/ (second|first|background) language$/, '').trim();
    return LANGUAGE_SUBJECTS.has(language) ? 'language' : '';
  }

  function calculate(rows) {
    const eligible = rows.filter(r => !/\bGeneral\b|\bmathematics essentials?\b/i.test(r.name));
    const used = eligible.filter(r => r.include && scoreValue(r.score) !== undefined).map(r => ({ ...r, score: wholeScore(r.score) }));
    if (used.length < 4) return { error: 'At least four ATAR subject scores are needed.' };
    
    const sorted = [...used].sort((a, b) => b.score - a.score);
    const topFour = sorted.slice(0, 4);
    const bestLanguage = Math.max(0, ...used.filter(r => bonusType(r.name) === 'language').map(r => r.score));
    const methods = Math.max(0, ...used.filter(r => bonusType(r.name) === 'mathematics methods').map(r => r.score));
    const specialist = Math.max(0, ...used.filter(r => bonusType(r.name) === 'mathematics specialist').map(r => r.score));

    const baseTEA = topFour.reduce((sum, r) => sum + r.score, 0);
    const bonusTEA = (bestLanguage + methods + specialist) * 0.1;
    const totalTEA = Math.min(430, baseTEA + bonusTEA);

    return {
      atar: convertTEAtoATAR(totalTEA),
      tea: totalTEA,
      base: baseTEA,
      bonus: bonusTEA,
      top: topFour
    };
  }

  // --- SCALING LOGIC ---
  const subjectAliases = {
    'accounting': 'accounting and finance',
    'mathematics application': 'mathematics applications',
    'maths applications': 'mathematics applications',
    'methods': 'mathematics methods',
    'specialist': 'mathematics specialist',
    'eald': 'english as an additional language or dialect',
    'english as an additional language dialect': 'english as an additional language or dialect',
    'children family and community': 'children family and the community'
  };

  function normalizeSubject(name) {
    return String(name).toLowerCase().replace(/\batar\b|\byear\s*\d+\b/gi, '').replace(/[:;/]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function getSubjectData(name, year = 2025) {
    const data = window.ConnectifyScalingData || window.ConnextScalingData;
    if (!data || !data[year] || !data[year].subjects) return null;
    const n = normalizeSubject(name);
    const wanted = subjectAliases[n] || n;
    return Object.entries(data[year].subjects).find(([label]) => normalizeSubject(label) === wanted)?.[1];
  }

  function estimateScaledScore(name, percentile, year = 2025) {
    const curve = getSubjectData(name, year)?.curve;
    if (!curve || !Number.isFinite(percentile)) return undefined;
    if (percentile <= 0) return curve[0][1];
    if (percentile >= 1) return curve.at(-1)[1];
    for (let i = 1; i < curve.length; i++) {
      const [a, x] = curve[i - 1], [b, z] = curve[i];
      if (percentile <= b) return x + (percentile - a) / (b - a) * (z - x);
    }
    return undefined;
  }

  // Default WA ATAR mark distribution approximation (Min, Q1, Median, Q3, Max)
  const DEFAULT_BOXPLOT = [25, 48, 60, 72, 95];

  function getBasePercentile(rawMark) {
    if (!Number.isFinite(rawMark)) return undefined;
    if (rawMark <= DEFAULT_BOXPLOT[0]) return 0;
    if (rawMark >= DEFAULT_BOXPLOT[4]) return 1;
    for (let i = 0; i < 4; i++) {
      if (rawMark >= DEFAULT_BOXPLOT[i] && rawMark <= DEFAULT_BOXPLOT[i + 1]) {
        return (i + (rawMark - DEFAULT_BOXPLOT[i]) / (DEFAULT_BOXPLOT[i + 1] - DEFAULT_BOXPLOT[i])) / 4;
      }
    }
    return 0.5;
  }

  function calculateShiftedScaledScore(name, liveRawMark, knownSem1Raw, knownSem1Scaled, year = 2025) {
    if (!Number.isFinite(liveRawMark)) return undefined;

    // 1. Calculate the base TISC scaled score using the standard percentile mapping
    const basePercentile = getBasePercentile(liveRawMark);
    let modelScaled = estimateScaledScore(name, basePercentile, year);
    
    // If we don't have TISC data for this subject, default to the raw mark directly
    if (modelScaled === undefined) {
        modelScaled = liveRawMark;
    }

    // 2. Apply calibration shift if the user has provided their school's actual Semester 1 scaled score
    if (scoreValue(knownSem1Raw) !== undefined && scoreValue(knownSem1Scaled) !== undefined) {
        const sem1BasePercentile = getBasePercentile(knownSem1Raw);
        let sem1ModelScaled = estimateScaledScore(name, sem1BasePercentile, year);
        
        if (sem1ModelScaled === undefined) {
            sem1ModelScaled = knownSem1Raw;
        }

        // The shift represents the difference between our base model and the school's actual historical cohort performance
        const shift = knownSem1Scaled - sem1ModelScaled;
        return Math.max(0, Math.min(100, modelScaled + shift));
    }

    return modelScaled;
  }

  window.ConnectifyMath = {
    calculate,
    convertTEAtoATAR,
    wholeScore,
    scoreValue,
    estimateScaledScore,
    calculateShiftedScaledScore,
    normalizeSubject
  };
})();

(() => {
  const { calculate, scoreValue } = window.ConnectifyMath;
  
  function parseAssessment(rawScore, weightedMark, name) {
    const normalize = text => String(text ?? '').replace(/\s+/g, ' ').trim();
    const scoreMatch = normalize(rawScore).match(/^(\d+(?:\.\d+)?)\s*Out\s+of\s+(\d+(?:\.\d+)?)$/i);
    const isPending = /^[-–—]\s*Out\s+of\s+\d+(?:\.\d+)?$/i.test(normalize(rawScore));
    const weightMatch = normalize(weightedMark).match(/^(?:\d+(?:\.\d+)?|[-–—])\s*Out\s+of\s+(\d+(?:\.\d+)?)$/i);
    if (!weightMatch || (!scoreMatch && !isPending)) return null;
    const weight = Number(weightMatch[1]);
    if (weight < 0 || weight > 100 || (scoreMatch && (Number(scoreMatch[2]) <= 0 || Number(scoreMatch[1]) > Number(scoreMatch[2])))) return null;
    const scorePercentage = scoreMatch ? (Number(scoreMatch[1]) / Number(scoreMatch[2])) * 100 : undefined;
    const earnedWeight = scoreMatch ? (Number(scoreMatch[1]) / Number(scoreMatch[2])) * weight : 0;
    return { name, weight, pending: isPending, score: scorePercentage, earned: earnedWeight };
  }

  function taskProgress(tasks, mark, semesterNumber = 2) {
    if (!tasks.length || tasks.some(t => !t)) return { error: 'Assessment weights are missing or unreadable.' };
    const totalWeight = tasks.reduce((sum, t) => sum + t.weight, 0);
    if (totalWeight <= 0 || totalWeight > 100.05) return { error: 'The outline total weight must be greater than 0 and at most 100%.' };
    if (semesterNumber === 2 && Math.abs(totalWeight - 100) > 0.05) {
      return { error: `Visible annual weights total ${Number(totalWeight.toFixed(2))}%, not 100%. Expand the complete semester 2 outline.` };
    }
    const remainingWeight = tasks.filter(t => t.pending).reduce((sum, t) => sum + t.weight, 0);
    const earnedWeight = tasks.reduce((sum, t) => sum + t.earned, 0);
    const completedWeight = totalWeight - remainingWeight;
    if (completedWeight > 0 && scoreValue(mark) !== undefined && Math.abs((earnedWeight / completedWeight) * 100 - mark) > 1.5) {
      return { error: 'Task weights do not reconcile with the displayed overall mark.' };
    }
    return {
      earned: (earnedWeight / totalWeight) * 100,
      remaining: (remainingWeight / totalWeight) * 100,
      total: totalWeight,
      rawEarned: earnedWeight,
      rawRemaining: remainingWeight,
      allTasks: tasks,
      tasks: tasks.filter(t => t.pending && t.weight > 0)
    };
  }

  function gradePlan(progress, target) {
    if (progress.error) return { error: progress.error };
    if (scoreValue(target) === undefined) return { error: 'Enter an overall target percentage from 0 to 100.' };
    const maximum = progress.earned + progress.remaining;
    if (target > maximum + 1e-9) return { impossible: true, maximum };
    if (progress.remaining <= 1e-9) return { finished: true, maximum, final: progress.earned };
    const exactRequired = Math.max(0, ((target - progress.earned) / progress.remaining) * 100);
    return { required: Math.min(100, Math.ceil((exactRequired - 1e-9) * 10) / 10), maximum };
  }

  function targetPlan(rows, target) {
    if (!Number.isFinite(target) || target < 30 || target > 99.95) return { error: 'Enter a target ATAR from 30 to 99.95.' };
    if (rows.length < 4) return { error: 'Include at least four ATAR subjects.' };

    const missing = rows.filter(r => !r.progress || r.progress.error);
    if (missing.length) {
      return { error: missing.map(r => `${r.name}: ${r.progress.error}`).join('\n') };
    }

    const projectedRows = p =>
      rows.map(r => ({
        name: r.name,
        include: true,
        score: Math.max(0, Math.min(100, (r.progress?.earned ?? 0) + ((r.progress?.remaining ?? 0) * p) / 100 + (r.offset ?? 0)))
      }));

    const calculateAtPercentage = p => calculate(projectedRows(p));
    const reachesTarget = r => !r.error && r.atar !== '<30' && Number(r.atar) >= target;

    const maximumResult = calculateAtPercentage(100);
    if (maximumResult.error) return { error: maximumResult.error };
    if (!reachesTarget(maximumResult)) {
      return { impossible: true, maximum: maximumResult, rows: projectedRows(100) };
    }

    let low = 0, high = 100;
    if (reachesTarget(calculateAtPercentage(0))) {
      high = 0;
    } else {
      for (let i = 0; i < 50; i++) {
        const mid = (low + high) / 2;
        if (reachesTarget(calculateAtPercentage(mid))) {
          high = mid;
        } else {
          low = mid;
        }
      }
    }

    let required = Math.min(100, Math.ceil(high * 10) / 10);
    if (!reachesTarget(calculateAtPercentage(required))) {
      required = Math.min(100, required + 0.1);
    }

    return {
      required,
      maximum: maximumResult,
      result: calculateAtPercentage(required),
      rows: projectedRows(required)
    };
  }

  Object.assign(window.ConnectifyMath, { parseAssessment, taskProgress, gradePlan, targetPlan });
})();
(() => {
  window.ConnectifyMath.normalize = text => String(text ?? '').replace(/\s+/g, ' ').trim();
  window.ConnectifyMath.isAtarCourse = title => /\bATAR\b/i.test(title) && !/\bGeneral\b|\bmathematics essentials?\b/i.test(title);
})();

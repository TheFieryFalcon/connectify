/**
 * Connectify ATAR Mathematics & Subject Scaling Model
 *
 * Implements published 2025 TISC table interpolation, best four ATAR calculation,
 * 10% TEA bonus rules (Methods, Specialist, Languages), subject alias normalization,
 * and empirical Semester 1 scaling calibration shift.
 * Provides `window.ConnectifyMath`.
 */
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
    if (tea >= TEA_ATAR_TABLE[TEA_ATAR_TABLE.length - 1][0]) return '99.95';
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
    const raw = String(name || '').toLowerCase();
    if (/\b(mathematics methods|methods)\b/i.test(raw)) return 'mathematics methods';
    if (/\b(mathematics specialist|specialist)\b/i.test(raw)) return 'mathematics specialist';
    const cleanLang = raw.replace(/\batar\b|\byear\s*\d+\b|semester\s*\d+/gi, '').replace(/[:;/]/g, ' ').replace(/\s+/g, ' ').trim();
    for (const lang of LANGUAGE_SUBJECTS) {
      if (new RegExp(`\\b${lang}\\b`, 'i').test(cleanLang)) return 'language';
    }
    return '';
  }

  function calculate(rows, options = {}) {
    const eligible = rows.filter(r => !/\bGeneral\b|\bmathematics essentials?\b/i.test(r.name));
    const used = eligible.filter(r => r.include && scoreValue(r.score) !== undefined).map(r => ({ ...r, score: wholeScore(r.score) }));
    if (used.length < 4) return { error: 'At least four ATAR subject scores are needed.' };

    const sorted = [...used].sort((a, b) => b.score - a.score);
    const topFour = sorted.slice(0, 4);

    let bonusTEA = 0;
    if (options?.fixedBonus !== undefined && Number.isFinite(Number(options.fixedBonus))) {
      bonusTEA = Number(options.fixedBonus);
    } else if (!options?.ignoreBonus) {
      const bestLanguage = Math.max(0, ...used.filter(r => bonusType(r.name) === 'language').map(r => r.score));
      const methods = Math.max(0, ...used.filter(r => bonusType(r.name) === 'mathematics methods').map(r => r.score));
      const specialist = Math.max(0, ...used.filter(r => bonusType(r.name) === 'mathematics specialist').map(r => r.score));

      // Maximum 2 bonus subjects (Methods, Specialist, or Languages)
      const bonuses = [];
      if (methods > 0) bonuses.push(methods * 0.1);
      if (specialist > 0) bonuses.push(specialist * 0.1);
      if (bestLanguage > 0) bonuses.push(bestLanguage * 0.1);
      bonuses.sort((a, b) => b - a);
      bonusTEA = (bonuses[0] || 0) + (bonuses[1] || 0);
    }

    const baseTEA = topFour.reduce((sum, r) => sum + r.score, 0);
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
    if (percentile >= 1) return curve[curve.length - 1][1];
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

  window.ConnectifyMath = window.ConnectifyMath || {};
  Object.assign(window.ConnectifyMath, {
    calculate,
    convertTEAtoATAR,
    wholeScore,
    scoreValue,
    estimateScaledScore,
    calculateShiftedScaledScore,
    normalizeSubject,
    normalize,
    isAtarCourse: title => /\bATAR\b/i.test(title) && !/\bGeneral\b|\bmathematics essentials?\b/i.test(title),
    bonusType
  });
})();

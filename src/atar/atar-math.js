/**
 * Connectify ATAR Mathematics & Subject Scaling Model
 *
 * Implements the TEA-to-ATAR table, best four ATAR calculation, TISC Average Marks Scaling,
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

  const { normalize } = window.ConnectifyUtils;
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

  /** TEA bonus: 10% of each of the best two of Mathematics Methods, Mathematics Specialist and the best language. */
  function teaBonus(rows) {
    const best = type => Math.max(0, ...rows.filter(r => bonusType(r.name) === type).map(r => wholeScore(r.score) || 0));
    const bonuses = [best('mathematics methods'), best('mathematics specialist'), best('language')]
      .filter(score => score > 0)
      .map(score => score * 0.1)
      .sort((a, b) => b - a);
    return (bonuses[0] || 0) + (bonuses[1] || 0);
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
      bonusTEA = teaBonus(used);
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

  // TISC Average Marks Scaling is linear in each course: scaled = 60 + d + 14c * z, where 60 + d and 14c are
  // the course's published scaled mean and SD (average-marks-scaling.pdf, equation 2). z is the student's place in
  // the course's standardised combined marks, which SCSA sets to a mean of 60 and an SD of 14 in every course.
  const STANDARDISED_MEAN = 60;
  const STANDARDISED_SD = 14;

  function estimateScaledScore(name, rawMark, year = 2025) {
    const course = getSubjectData(name, year);
    if (!Number.isFinite(rawMark) || !Number.isFinite(course?.mean)) return undefined;
    const z = (rawMark - STANDARDISED_MEAN) / STANDARDISED_SD;
    const sd = Number.isFinite(course.sd) ? course.sd : STANDARDISED_SD;
    return Math.max(0, Math.min(100, course.mean + sd * z));
  }

  function calculateShiftedScaledScore(name, liveRawMark, knownSem1Raw, knownSem1Scaled, year = 2025) {
    if (!Number.isFinite(liveRawMark)) return undefined;

    // Courses TISC publishes no statistics for keep the raw mark.
    const modelScaled = estimateScaledScore(name, liveRawMark, year) ?? liveRawMark;

    // The school's actual Semester 1 scaled score shifts the model by however far it was out for that mark.
    if (scoreValue(knownSem1Raw) !== undefined && scoreValue(knownSem1Scaled) !== undefined) {
      const sem1ModelScaled = estimateScaledScore(name, Number(knownSem1Raw), year) ?? Number(knownSem1Raw);
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
    isAtarCourse: title => {
      if (/\bGeneral\b|\bmathematics essentials?\b|\bFoundation\b/i.test(title)) return false;
      if (/\bATAR\b/i.test(title)) return true;
      const clean = String(title || '').toLowerCase().replace(/\b(year\s*\d+|semester\s*[12]|sem\s*[12])\b/gi, '').trim();
      const knownAtar = [
        'chemistry', 'physics', 'biology', 'human biology',
        'mathematics methods', 'mathematics specialist', 'mathematics applications',
        'literature', 'english', 'philosophy and ethics', 'philosophy', 'ethics',
        'economics', 'accounting and finance', 'accounting',
        'modern history', 'ancient history', 'politics and law', 'psychology', 'geography'
      ];
      return knownAtar.some(sub => clean.includes(sub));
    },
    bonusType,
    teaBonus
  });
})();

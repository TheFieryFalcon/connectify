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

  window.ConnectifyMath = {
    calculate,
    convertTEAtoATAR,
    wholeScore,
    scoreValue,
    estimateScaledScore,
    calculateShiftedScaledScore,
    normalizeSubject,
    bonusType
  };
})();

(() => {
  const { calculate, scoreValue, wholeScore, bonusType } = window.ConnectifyMath;
  
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

  function targetPlan(rows, target, options = {}) {
    if (!Number.isFinite(target) || target < 30 || target > 99.95) return { error: 'Enter a target ATAR from 30 to 99.95.' };

    const eligibleRows = rows.filter(r => !/\bGeneral\b|\bmathematics essentials?\b/i.test(r.name));
    const includedCount = eligibleRows.filter(r => r.include !== false).length;
    if (includedCount < 4) return { error: 'Select at least four ATAR subjects to target for your top four.' };

    const missing = eligibleRows.filter(r => r.include !== false && (!r.progress || r.progress.error));
    if (missing.length) {
      return { error: missing.map(r => `${r.name}: ${r.progress.error}`).join('\n') };
    }

    // Determine current TEA bonus to hold fixed during target projections
    let currentBonus = 0;
    if (options.currentBonus !== undefined && Number.isFinite(Number(options.currentBonus))) {
      currentBonus = Number(options.currentBonus);
    } else if (options.fixedBonus !== undefined && Number.isFinite(Number(options.fixedBonus))) {
      currentBonus = Number(options.fixedBonus);
    } else {
      const currentRowsForBonus = eligibleRows.map(r => ({
        name: r.name,
        include: true,
        score: r.score !== undefined ? r.score : r.mark
      }));
      const bestLanguage = Math.max(0, ...currentRowsForBonus.filter(r => bonusType(r.name) === 'language').map(r => wholeScore(r.score) || 0));
      const methods = Math.max(0, ...currentRowsForBonus.filter(r => bonusType(r.name) === 'mathematics methods').map(r => wholeScore(r.score) || 0));
      const specialist = Math.max(0, ...currentRowsForBonus.filter(r => bonusType(r.name) === 'mathematics specialist').map(r => wholeScore(r.score) || 0));
      const bonuses = [];
      if (methods > 0) bonuses.push(methods * 0.1);
      if (specialist > 0) bonuses.push(specialist * 0.1);
      if (bestLanguage > 0) bonuses.push(bestLanguage * 0.1);
      bonuses.sort((a, b) => b - a);
      currentBonus = (bonuses[0] || 0) + (bonuses[1] || 0);
    }

    const difficultyWeighted = Boolean(options.difficultyWeighted);

    const getTaskType = (subjectName, task) => {
      if (window.ConnectifyTaskTypes?.getEffectiveType) {
        return window.ConnectifyTaskTypes.getEffectiveType(subjectName, task);
      }
      const lower = (task?.name || '').toLowerCase();
      if (lower.includes('exam') || lower.includes('semester')) return 'Exam';
      if (lower.includes('test') || lower.includes('quiz') || lower.includes('in-class') || lower.includes('in class')) return 'Test';
      if (lower.includes('essay') || lower.includes('short answer') || lower.includes('written response') || lower.includes('close reading')) return 'Essay';
      if (lower.includes('application') || lower.includes('investigation') || lower.includes('portfolio') || lower.includes('validation') || lower.includes('practical') || lower.includes('speaking') || lower.includes('listening')) return 'Application';
      return 'Take-Home';
    };

    const taskMetaList = [];

    if (difficultyWeighted) {
      const catTotalsOverall = {};
      eligibleRows.forEach(r => {
        const completed = (r.progress?.allTasks || []).filter(t => !t.pending && Number.isFinite(t.score));
        completed.forEach(t => {
          const cat = getTaskType(r.name, t);
          if (!catTotalsOverall[cat]) catTotalsOverall[cat] = { earned: 0, weight: 0 };
          catTotalsOverall[cat].earned += (t.score / 100) * t.weight;
          catTotalsOverall[cat].weight += t.weight;
        });
      });

      eligibleRows.forEach(r => {
        if (r.include === false) return;
        const completed = (r.progress?.allTasks || []).filter(t => !t.pending && Number.isFinite(t.score));
        const courseAvg = Number.isFinite(r.mark)
          ? r.mark
          : (completed.length && completed.reduce((s, t) => s + t.weight, 0) > 0)
          ? (completed.reduce((s, t) => s + (t.score / 100) * t.weight, 0) / completed.reduce((s, t) => s + t.weight, 0)) * 100
          : 75;

        const catTotalsCourse = {};
        completed.forEach(t => {
          const cat = getTaskType(r.name, t);
          if (!catTotalsCourse[cat]) catTotalsCourse[cat] = { earned: 0, weight: 0 };
          catTotalsCourse[cat].earned += (t.score / 100) * t.weight;
          catTotalsCourse[cat].weight += t.weight;
        });

        (r.progress?.tasks || []).forEach(task => {
          const cat = getTaskType(r.name, task);
          let baseline = courseAvg;
          if (catTotalsCourse[cat] && catTotalsCourse[cat].weight > 0) {
            baseline = (catTotalsCourse[cat].earned / catTotalsCourse[cat].weight) * 100;
          } else if (catTotalsOverall[cat] && catTotalsOverall[cat].weight > 0) {
            const overallCatAvg = (catTotalsOverall[cat].earned / catTotalsOverall[cat].weight) * 100;
            baseline = (courseAvg + overallCatAvg) / 2;
          }
          baseline = Math.max(30, Math.min(99.5, baseline));
          taskMetaList.push({
            course: r.name,
            taskName: task.name,
            task,
            weight: task.weight,
            category: cat,
            baseline
          });
        });
      });
    }

    const calcTaskScore = (meta, t) => {
      const b = meta.baseline;
      if (t >= 0) {
        return Math.max(0, Math.min(100, b + t * (100 - b)));
      } else {
        return Math.max(0, Math.min(100, b * (1 + t)));
      }
    };

    const projectCourseScore = (r, pOrT) => {
      if (r.include === false) {
        return r.score !== undefined ? r.score : (r.mark !== undefined ? r.mark : 0);
      }
      if (!r.progress?.remaining || (r.progress?.tasks || []).length === 0) {
        return r.score !== undefined ? r.score : (r.mark !== undefined ? r.mark : 0);
      }

      if (difficultyWeighted) {
        const t = pOrT;
        let earnedRemaining = 0;
        (r.progress.tasks || []).forEach(task => {
          const meta = taskMetaList.find(m => m.course === r.name && m.taskName === task.name);
          const score = meta ? calcTaskScore(meta, t) : Math.max(0, Math.min(100, 75 + t * 25));
          earnedRemaining += (score / 100) * task.weight;
        });
        const totalWeight = r.progress.total || 100;
        const rawScore = ((r.progress.rawEarned || 0) + earnedRemaining) / totalWeight * 100;
        return Math.max(0, Math.min(100, rawScore + (r.offset ?? 0)));
      } else {
        const p = pOrT;
        const rawScore = (r.progress.earned ?? 0) + ((r.progress.remaining ?? 0) * p) / 100;
        return Math.max(0, Math.min(100, rawScore + (r.offset ?? 0)));
      }
    };

    const projectedRows = pOrT =>
      eligibleRows.map(r => ({
        name: r.name,
        include: r.include !== false,
        score: projectCourseScore(r, pOrT)
      }));

    const calculateAtVal = pOrT => calculate(projectedRows(pOrT), { fixedBonus: currentBonus });
    const reachesTarget = res => !res.error && res.atar !== '<30' && Number(res.atar) >= target;

    const maxVal = difficultyWeighted ? 1.0 : 100.0;
    const minVal = difficultyWeighted ? -1.0 : 0.0;

    const maximumResult = calculateAtVal(maxVal);
    if (maximumResult.error) return { error: maximumResult.error };
    if (!reachesTarget(maximumResult)) {
      return {
        impossible: true,
        maximum: maximumResult,
        rows: projectedRows(maxVal),
        difficultyWeighted,
        bonus: currentBonus
      };
    }

    let low = minVal, high = maxVal;
    if (reachesTarget(calculateAtVal(minVal))) {
      high = minVal;
    } else {
      for (let i = 0; i < 50; i++) {
        const mid = (low + high) / 2;
        if (reachesTarget(calculateAtVal(mid))) {
          high = mid;
        } else {
          low = mid;
        }
      }
    }

    let finalT = high;
    let finalProjected = projectedRows(finalT);
    let finalResult = calculate(finalProjected, { fixedBonus: currentBonus });

    const taskRequirements = {};
    let totalReqSum = 0;
    let totalReqCount = 0;

    if (difficultyWeighted) {
      taskMetaList.forEach(meta => {
        let score = Math.round(calcTaskScore(meta, finalT) * 10) / 10;
        score = Math.min(100, Math.max(0, score));
        taskRequirements[`${meta.course}::${meta.taskName}`] = {
          required: score,
          baseline: Math.round(meta.baseline * 10) / 10,
          category: meta.category
        };
        totalReqSum += score;
        totalReqCount++;
      });
    } else {
      let req = Math.min(100, Math.ceil(high * 10) / 10);
      if (!reachesTarget(calculateAtVal(req))) {
        req = Math.min(100, req + 0.1);
      }
      finalT = req;
      finalProjected = projectedRows(finalT);
      finalResult = calculate(finalProjected, { fixedBonus: currentBonus });
    }

    const avgRequired = totalReqCount > 0 ? Math.round((totalReqSum / totalReqCount) * 10) / 10 : Math.round(finalT * 10) / 10;

    return {
      required: difficultyWeighted ? avgRequired : finalT,
      parameter: finalT,
      difficultyWeighted,
      maximum: maximumResult,
      result: finalResult,
      rows: finalProjected,
      taskRequirements,
      bonus: currentBonus
    };
  }

  Object.assign(window.ConnectifyMath, { parseAssessment, taskProgress, gradePlan, targetPlan });
})();
(() => {
  window.ConnectifyMath.normalize = text => String(text ?? '').replace(/\s+/g, ' ').trim();
  window.ConnectifyMath.isAtarCourse = title => /\bATAR\b/i.test(title) && !/\bGeneral\b|\bmathematics essentials?\b/i.test(title);
})();

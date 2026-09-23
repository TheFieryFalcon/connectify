/**
 * Connectify Target Solver & Grade Planner Math
 *
 * Implements assessment parsing, syllabus weight validation, target grade calculation,
 * and multi-subject difficulty-weighted optimization solver for Target ATAR.
 * Provides `window.ConnectifyTargetSolver`.
 */
(() => {
  'use strict';

  if (window.ConnectifyTargetSolver) return;

  const math = () => window.ConnectifyMath || {};

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
    const scoreVal = math().scoreValue || (v => (Number.isFinite(Number(v)) ? Number(v) : undefined));

    if (completedWeight > 0 && scoreVal(mark) !== undefined && Math.abs((earnedWeight / completedWeight) * 100 - mark) > 1.5) {
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
    const scoreVal = math().scoreValue || (v => (Number.isFinite(Number(v)) ? Number(v) : undefined));
    if (scoreVal(target) === undefined) return { error: 'Enter an overall target percentage from 0 to 100.' };
    const maximum = progress.earned + progress.remaining;
    if (target > maximum + 1e-9) return { impossible: true, maximum };
    if (progress.remaining <= 1e-9) return { finished: true, maximum, final: progress.earned };
    const exactRequired = Math.max(0, ((target - progress.earned) / progress.remaining) * 100);
    return { required: Math.min(100, Math.ceil((exactRequired - 1e-9) * 10) / 10), maximum };
  }

  function targetPlan(rows, target, options = {}) {
    if (!Number.isFinite(target) || target < 30 || target > 99.95) return { error: 'Enter a target ATAR from 30 to 99.95.' };

    const m = math();
    const calculate = m.calculate;
    const bonusType = m.bonusType || (() => '');
    const wholeScore = m.wholeScore || (v => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : undefined));

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

    const calculateAtVal = pOrT => calculate ? calculate(projectedRows(pOrT), { fixedBonus: currentBonus }) : { error: 'Calculation unavailable' };
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

  window.ConnectifyTargetSolver = {
    parseAssessment,
    taskProgress,
    gradePlan,
    targetPlan
  };

  window.ConnectifyMath = window.ConnectifyMath || {};
  Object.assign(window.ConnectifyMath, {
    parseAssessment,
    taskProgress,
    gradePlan,
    targetPlan
  });
})();

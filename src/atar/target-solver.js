/**
 * Connectify Target Solver & Grade Planner Math
 *
 * Assessment parsing, syllabus weight validation, the score needed on remaining tasks for a target grade,
 * and the Target ATAR solver across the top four subjects. Both solvers can weight each task by the
 * student's record on its assessment type (target-difficulty.js). Provides `window.ConnectifyTargetSolver`.
 */
(() => {
  'use strict';

  if (window.ConnectifyTargetSolver) return;

  const math = () => window.ConnectifyMath || {};
  const D = window.ConnectifyTargetDifficulty;
  const scoreVal = v => (math().scoreValue || (x => (Number.isFinite(Number(x)) ? Number(x) : undefined)))(v);

  function parseAssessment(rawScore, weightedMark, name) {
    const { normalize } = window.ConnectifyUtils;
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
    const completedWeight = totalWeight - remainingWeight;
    // Connect's mark is the class result (schools may adjust it away from the task marks, e.g. Biology
    // 71.8% over tasks averaging 66.3%), so it stands for the marked weight as one block, as in Estimate Grade
    const earnedWeight = completedWeight > 0 && scoreVal(mark) !== undefined
      ? (Number(mark) / 100) * completedWeight
      : tasks.reduce((sum, t) => sum + t.earned, 0);
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

  // Tasks are keyed by id (same-named tasks such as each semester's exam are two), the name only without one
  const taskKey = task => task?.id || task?.name;
  const clamp100 = v => Math.max(0, Math.min(100, v));

  /**
   * Score needed on the remaining tasks. Without `difficultyWeighted` or `offsets` every task needs the same
   * score; otherwise each task starts from a baseline (past performance, or the uniform score for all), moved
   * by its effort offset in points (`offsets[taskKey]`), and one shared effort is solved for.
   */
  function gradePlan(progress, target, options = {}) {
    if (progress.error) return { error: progress.error };
    if (scoreVal(target) === undefined) return { error: 'Enter an overall target percentage from 0 to 100.' };
    const maximum = progress.earned + progress.remaining;
    if (target > maximum + 1e-9) return { impossible: true, maximum };
    if (progress.remaining <= 1e-9) return { finished: true, maximum, final: progress.earned };

    const difficultyWeighted = Boolean(options.difficultyWeighted);
    const offsetOf = task => Number(options.offsets?.[taskKey(task)]) || 0;
    const exactRequired = Math.max(0, ((target - progress.earned) / progress.remaining) * 100);
    if (!difficultyWeighted && !(progress.tasks || []).some(offsetOf)) {
      return { required: Math.min(100, Math.ceil((exactRequired - 1e-9) * 10) / 10), maximum };
    }

    // Type overrides are stored per subject, so the subject is needed to honour them
    const subjectName = options.subjectName || '';
    const courseAvg = D.weightedAverage(D.completedTasks(progress.allTasks)) ?? 75;
    const totals = D.typeTotals(subjectName, progress.allTasks);
    const taskMetaList = (progress.tasks || []).map(task => {
      const category = D.taskType(subjectName, task);
      const base = difficultyWeighted ? D.clampBaseline(D.typeAverage(totals, category) ?? courseAvg) : Math.min(100, exactRequired);
      return { task, category, weight: task.weight, baseline: clamp100(base + offsetOf(task)) };
    });
    const calcTaskScore = (meta, t) => D.scoreAt(meta.baseline, t);
    const totalWeight = progress.total || 100;
    const projectScoreAtT = t =>
      ((progress.rawEarned || 0) + taskMetaList.reduce((sum, m) => sum + (calcTaskScore(m, t) / 100) * m.weight, 0)) / totalWeight * 100;

    if (projectScoreAtT(1.0) < target - 1e-9) return { impossible: true, maximum, difficultyWeighted };
    const finalT = D.bisect(t => projectScoreAtT(t) >= target, -1.0, 1.0);

    const taskRequirements = {};
    let totalReqSum = 0;
    for (const m of taskMetaList) {
      const score = Math.min(100, Math.max(0, D.round1(calcTaskScore(m, finalT))));
      taskRequirements[taskKey(m.task)] = { required: score, baseline: D.round1(m.baseline), category: m.category };
      totalReqSum += score;
    }
    const avgRequired = taskMetaList.length > 0 ? D.round1(totalReqSum / taskMetaList.length) : D.round1(finalT);
    return { required: avgRequired, parameter: finalT, difficultyWeighted, effort: true, maximum, taskRequirements };
  }

  // The TEA bonus is held at its current value while solving, so the solver moves raw marks only
  function heldBonus(eligibleRows, options) {
    for (const value of [options.currentBonus, options.fixedBonus]) {
      if (value !== undefined && Number.isFinite(Number(value))) return Number(value);
    }
    const teaBonus = math().teaBonus;
    return teaBonus ? teaBonus(eligibleRows.map(r => ({ name: r.name, score: r.score !== undefined ? r.score : r.mark }))) : 0;
  }

  /**
   * Pending tasks of the included courses with their baselines: the course's own average on that type,
   * else halfway between the course average and that type's average across all courses, else the course average
   * (`flat`: one baseline for every task).
   */
  function difficultyTasks(eligibleRows, flat) {
    const overall = {};
    for (const r of eligibleRows) D.typeTotals(r.name, r.progress?.allTasks, overall);
    const list = [];
    for (const r of eligibleRows) {
      if (r.include === false) continue;
      const courseAvg = Number.isFinite(r.mark) ? r.mark : (D.weightedAverage(D.completedTasks(r.progress?.allTasks)) ?? 75);
      const course = D.typeTotals(r.name, r.progress?.allTasks);
      for (const task of r.progress?.tasks || []) {
        const category = D.taskType(r.name, task);
        const overallAvg = D.typeAverage(overall, category);
        const baseline = D.typeAverage(course, category) ?? (overallAvg !== undefined ? (courseAvg + overallAvg) / 2 : courseAvg);
        list.push({ course: r.name, taskName: taskKey(task), task, weight: task.weight, category, baseline: flat ?? D.clampBaseline(baseline) });
      }
    }
    return list;
  }

  function targetPlan(rows, target, options = {}) {
    if (!Number.isFinite(target) || target < 30 || target > 99.95) return { error: 'Enter a target ATAR from 30 to 99.95.' };
    const calculate = math().calculate;

    const eligibleRows = rows.filter(r => !/\bGeneral\b|\bmathematics essentials?\b/i.test(r.name));
    if (eligibleRows.filter(r => r.include !== false).length < 4) return { error: 'Select at least four ATAR subjects to target for your top four.' };
    const missing = eligibleRows.filter(r => r.include !== false && (!r.progress || r.progress.error));
    if (missing.length) return { error: missing.map(r => `${r.name}: ${r.progress.error}`).join('\n') };

    const currentBonus = heldBonus(eligibleRows, options);
    const difficultyWeighted = Boolean(options.difficultyWeighted);
    // Effort offsets in points: a subject's (`offsets[course]`) plus its task's (`offsets[course::taskKey]`)
    const offsetOf = (course, task) => (Number(options.offsets?.[course]) || 0) + (Number(options.offsets?.[`${course}::${taskKey(task)}`]) || 0);
    const hasOffsets = eligibleRows.some(r => r.include !== false && (r.progress?.tasks || []).some(t => offsetOf(r.name, t)));
    let taskMetaList = difficultyWeighted ? difficultyTasks(eligibleRows) : [];
    if (!difficultyWeighted && hasOffsets) {
      // Without performance baselines every task starts at the uniform score the target needs
      const uniform = targetPlan(rows, target, { ...options, offsets: null });
      if (uniform.error || uniform.impossible) return uniform;
      taskMetaList = difficultyTasks(eligibleRows, uniform.parameter);
    }
    for (const meta of taskMetaList) meta.baseline = clamp100(meta.baseline + offsetOf(meta.course, meta.task));
    const effort = difficultyWeighted || taskMetaList.length > 0;
    const metaByTask = new Map();
    for (const meta of taskMetaList) {
      const key = `${meta.course}::${meta.taskName}`;
      if (!metaByTask.has(key)) metaByTask.set(key, meta);
    }
    const calcTaskScore = (meta, t) => D.scoreAt(meta.baseline, t);
    const currentScore = r => (r.score !== undefined ? r.score : (r.mark !== undefined ? r.mark : 0));

    // A course's projected mark at effort t (difficulty weighted) or with p% on every remaining task
    const projectCourseScore = (r, pOrT) => {
      if (r.include === false || !r.progress?.remaining || (r.progress?.tasks || []).length === 0) return currentScore(r);
      let rawScore;
      if (effort) {
        const earnedRemaining = r.progress.tasks.reduce((sum, task) => {
          const meta = metaByTask.get(`${r.name}::${taskKey(task)}`);
          const score = meta ? calcTaskScore(meta, pOrT) : Math.max(0, Math.min(100, 75 + pOrT * 25));
          return sum + (score / 100) * task.weight;
        }, 0);
        rawScore = ((r.progress.rawEarned || 0) + earnedRemaining) / (r.progress.total || 100) * 100;
      } else {
        rawScore = (r.progress.earned ?? 0) + ((r.progress.remaining ?? 0) * pOrT) / 100;
      }
      return Math.max(0, Math.min(100, rawScore + (r.offset ?? 0)));
    };

    const projectedRows = pOrT => eligibleRows.map(r => ({ name: r.name, include: r.include !== false, score: projectCourseScore(r, pOrT) }));
    const calculateAtVal = pOrT => (calculate ? calculate(projectedRows(pOrT), { fixedBonus: currentBonus }) : { error: 'Calculation unavailable' });
    const reachesTarget = res => !res.error && res.atar !== '<30' && Number(res.atar) >= target;

    const maxVal = effort ? 1.0 : 100.0;
    const minVal = effort ? -1.0 : 0.0;
    const maximumResult = calculateAtVal(maxVal);
    if (maximumResult.error) return { error: maximumResult.error };
    if (!reachesTarget(maximumResult)) {
      return { impossible: true, maximum: maximumResult, rows: projectedRows(maxVal), difficultyWeighted, bonus: currentBonus };
    }

    let finalT = D.bisect(v => reachesTarget(calculateAtVal(v)), minVal, maxVal);
    const taskRequirements = {};
    let totalReqSum = 0;
    if (effort) {
      for (const meta of taskMetaList) {
        const score = Math.min(100, Math.max(0, D.round1(calcTaskScore(meta, finalT))));
        taskRequirements[`${meta.course}::${meta.taskName}`] = { required: score, baseline: D.round1(meta.baseline), category: meta.category };
        totalReqSum += score;
      }
    } else {
      // Round the uniform requirement up to one decimal, nudging up once more if rounding fell short
      let req = Math.min(100, Math.ceil(finalT * 10) / 10);
      if (!reachesTarget(calculateAtVal(req))) req = Math.min(100, req + 0.1);
      finalT = req;
    }
    const finalProjected = projectedRows(finalT);
    const finalResult = calculate(finalProjected, { fixedBonus: currentBonus });
    const avgRequired = taskMetaList.length > 0 ? D.round1(totalReqSum / taskMetaList.length) : D.round1(finalT);

    return {
      required: effort ? avgRequired : finalT,
      parameter: finalT,
      difficultyWeighted,
      effort,
      maximum: maximumResult,
      result: finalResult,
      rows: finalProjected,
      taskRequirements,
      bonus: currentBonus
    };
  }

  window.ConnectifyTargetSolver = { parseAssessment, taskProgress, gradePlan, targetPlan };
  window.ConnectifyMath = window.ConnectifyMath || {};
  Object.assign(window.ConnectifyMath, { parseAssessment, taskProgress, gradePlan, targetPlan });
})();

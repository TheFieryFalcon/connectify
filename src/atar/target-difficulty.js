/**
 * Connectify Target Solver: difficulty-weighted task model
 *
 * Shared by the Target Grade and Target ATAR solvers. Each pending task gets a baseline (the student's
 * average on that assessment type, else the course average), and all tasks move together along one
 * effort parameter t in [-1, 1]: t > 0 closes that share of the gap to 100%, t < 0 scales the baseline
 * down towards 0. Exposes window.ConnectifyTargetDifficulty.
 */
(() => {
  'use strict';

  // Stands in for the task type module when it has not loaded
  function guessType(name) {
    const lower = String(name || '').toLowerCase();
    if (lower.includes('exam') || lower.includes('semester')) return 'Exam';
    if (/test|quiz|in-class|in class/.test(lower)) return 'Test';
    if (/essay|short answer|written response|close reading/.test(lower)) return 'Essay';
    if (/application|investigation|portfolio|validation|practical|speaking|listening/.test(lower)) return 'Application';
    return 'Take-Home';
  }

  /** The task's type, honouring the student's override for this subject. */
  const taskType = (subjectName, task) => (window.ConnectifyTaskTypes?.getEffectiveType
    ? window.ConnectifyTaskTypes.getEffectiveType(subjectName, task)
    : guessType(task?.name));

  const completedTasks = tasks => (tasks || []).filter(t => !t.pending && Number.isFinite(t.score));

  /** Weighted average percentage of completed tasks, or undefined when they carry no weight. */
  function weightedAverage(tasks) {
    const weight = tasks.reduce((s, t) => s + t.weight, 0);
    return weight > 0 ? (tasks.reduce((s, t) => s + (t.score / 100) * t.weight, 0) / weight) * 100 : undefined;
  }

  /** Adds each completed task's earned and total weight to its type: { [type]: { earned, weight } }. */
  function typeTotals(subjectName, tasks, totals = {}) {
    for (const t of completedTasks(tasks)) {
      const cat = taskType(subjectName, t);
      if (!totals[cat]) totals[cat] = { earned: 0, weight: 0 };
      totals[cat].earned += (t.score / 100) * t.weight;
      totals[cat].weight += t.weight;
    }
    return totals;
  }

  const typeAverage = (totals, cat) => (totals[cat]?.weight > 0 ? (totals[cat].earned / totals[cat].weight) * 100 : undefined);
  const clampBaseline = b => Math.max(30, Math.min(99.5, b));
  const round1 = v => Math.round(v * 10) / 10;

  /** A task's score at effort t. */
  function scoreAt(baseline, t) {
    return t >= 0
      ? Math.max(0, Math.min(100, baseline + t * (100 - baseline)))
      : Math.max(0, Math.min(100, baseline * (1 + t)));
  }

  /** Smallest value in [low, high] that reaches the target (50 bisection steps); low when low already does. */
  function bisect(reaches, low, high) {
    if (reaches(low)) return low;
    for (let i = 0; i < 50; i++) {
      const mid = (low + high) / 2;
      if (reaches(mid)) high = mid;
      else low = mid;
    }
    return high;
  }

  window.ConnectifyTargetDifficulty = {
    guessType, taskType, completedTasks, weightedAverage, typeTotals, typeAverage, clampBaseline, round1, scoreAt, bisect
  };
})();

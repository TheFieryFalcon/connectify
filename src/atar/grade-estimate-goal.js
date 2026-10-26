/**
 * Connectify Estimator: goal lines
 *
 * Under Estimate Grade, whether the typed marks (or the current average) meet the class's goal (a subject's own,
 * or the target an ATAR goal gives it; a custom-week goal counts only its tasks in range); under Estimate ATAR,
 * whether the estimate meets the ATAR goal for that semester: `Goal 85%: met` / `Goal 85%: 3.2 short`.
 * Exposes window.ConnectifyGradeEstimateGoal.
 */
(() => {
  'use strict';

  if (window.ConnectifyGradeEstimateGoal) return;

  const round1 = v => Math.round(v * 10) / 10;
  const line = (label, value, target, digits) => {
    const p = document.createElement('p');
    p.className = 'cta-note cx-goal-estimate';
    const short = target - value;
    p.textContent = `Goal ${label}: ${short <= 1e-9 ? 'met' : `${digits ? short.toFixed(digits) : round1(short)} short`}`;
    return p;
  };

  /** The class goal's target and range for a course, or null. */
  function gradeGoal(course) {
    const store = window.ConnectifyGoalStore;
    const goal = course && store?.activeFor(course.subject || course.name);
    if (!goal) return null;
    const target = goal.kind === 'atar'
      ? window.ConnectifyGoalEvents?.stateOf(goal)?.children?.[course.id]?.target
      : Number(goal.target);
    if (!Number.isFinite(target)) return null;
    const child = goal.kind === 'atar' ? store.childrenOf(goal.id).find(c => c.subject === course.id) : null;
    return { goal: child || goal, target };
  }

  /** Estimate Grade's goal line (null without a goal or a mark to compare). */
  function gradeLine(course, tasks, entered, result) {
    const found = gradeGoal(course);
    if (!found) return null;
    let value = result.entered ? result.estimate : result.current;
    if (found.goal.end?.type === 'week') {
      const plan = window.ConnectifyGoalPlan;
      const inRange = new Set(plan.rangeTasks(found.goal, plan.entryFor(plan.readCourses(false), course.id)).tasks.map(t => t.id || t.name));
      const keep = tasks.map(t => inRange.has(t.id || t.name));
      const sub = window.ConnectifyGradeEstimate.estimate(tasks.filter((t, i) => keep[i]), entered.filter((v, i) => keep[i]), undefined);
      value = sub.entered ? sub.estimate : sub.current;
    }
    return Number.isFinite(value) ? line(`${round1(found.target)}%`, value, found.target) : null;
  }

  /** Estimate ATAR's goal line, added under the semester's summary. */
  function atarLine(container, res, semIdx) {
    container.querySelector?.('.cx-goal-estimate')?.remove();
    const goal = window.ConnectifyGoalStore?.active().find(g => g.kind === 'atar' && !g.parent && (g.end?.semester === 1 ? 0 : 1) === semIdx);
    const value = window.ConnectifyGoalReplay?.atarValue({ atar: res?.finalAtar ?? res?.atar });
    if (!goal || !Number.isFinite(value)) return;
    container.append(line(Number(goal.target).toFixed(2), value, Number(goal.target), 2));
  }

  window.ConnectifyGradeEstimateGoal = { gradeLine, atarLine };
})();

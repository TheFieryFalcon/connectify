/**
 * Connectify Progress: goal targets
 *
 * Subject charts plot the goal's target mark for each task it covers as a dashed line with markers: a judged
 * task's requirement R just before it was marked (the goal bars' verdict), a remaining task's requirement in the
 * current plan (sliders and difficulty weighting included). Tasks marked before the goal was set, or outside its
 * range, have none. Average modes average the targets like the scores (a task without one counts its own mark).
 * ATAR Progression keeps one dashed line at the ATAR goal. Drawn under the series, like the semester divider.
 * Exposes window.ConnectifyProgressGoalLine.
 */
(() => {
  'use strict';

  if (window.ConnectifyProgressGoalLine) return;

  const round1 = v => Math.round(v * 10) / 10;

  /** `{ value, label }` of the active ATAR goal for ATAR Progression, or null. */
  function atarGoal() {
    const atar = window.ConnectifyGoalStore?.active().find(g => g.kind === 'atar' && !g.parent);
    return atar ? { value: Number(atar.target), label: `Goal ${Number(atar.target).toFixed(2)}` } : null;
  }

  /** `{ label, plan, targetOf(point) }` for the subject's goal (or the target an ATAR goal gives it), or null.
   *  `goals`: the stored goals when the caller already read them. */
  function goalFor(subjectName, goals) {
    const store = window.ConnectifyGoalStore;
    const goal = store?.activeFor(subjectName, goals);
    const state = goal && window.ConnectifyGoalEvents?.stateOf(goal);
    if (!state || state.error || !state.plan) return null;
    const subject = store.subjectKey(subjectName);
    const child = goal.kind === 'atar' ? state.children?.[subject] : null;
    if (goal.kind === 'atar' && !child) return null;
    const plan = state.plan;
    const targetOf = point => {
      const id = point.id || point.name;
      const key = `${subject}::${id}`;
      const verdict = state.verdicts?.[key];
      if (verdict) return Number.isFinite(verdict.required) ? verdict.required : null;
      const marked = !point.pending && Number.isFinite(point.ownScore ?? point.score);
      if (marked || !state.rangeKeys?.has(key) || !(point.weight > 0)) return null;
      if (plan.guaranteed) return 0;
      if (plan.impossible) return 100;
      return window.ConnectifyGoalPlan.requiredOf(plan, child ? `${child.name}::${id}` : id);
    };
    const label = goal.kind === 'atar' ? `ATAR goal ${Number(goal.target).toFixed(2)}` : `Goal ${round1(Number(goal.target))}%`;
    return { label, plan, targetOf };
  }

  /** Each point's target in the chart's mode (null where there is none). */
  function targetsFor(points, goal, mode) {
    const own = points.map(goal.targetOf);
    const modes = window.ConnectifyProgressModes;
    const id = modes?.find(mode).id || 'tasks';
    if (id === 'tasks') return own;
    const weightOf = modes.weightResolver(points);
    const seen = [];
    return points.map((p, i) => {
      const mark = p.ownScore ?? p.score;
      const value = Number.isFinite(own[i]) ? own[i] : !p.pending && Number.isFinite(mark) ? mark : null;
      if (value === null) return null;
      seen.push({ ...p, target: value });
      const span = id === 'rolling' ? seen.slice(-modes.ROLLING_WINDOW) : seen;
      return Number.isFinite(own[i]) ? modes.weightedAverage(span, 'target', weightOf) : null;
    });
  }

  /** ATAR Progression: one dashed line at the goal, labelled at its end. */
  function renderAtar(svg, { yFor, minY, maxY, createSvgElement }) {
    const goal = atarGoal();
    if (!goal || goal.value < minY || goal.value > maxY) return;
    const y = yFor(goal.value);
    svg.append(createSvgElement('line', { x1: 44, y1: y, x2: 655, y2: y, class: 'cx-goal-line' }));
    svg.append(createSvgElement('text', { x: 651, y: y - 5, 'text-anchor': 'end', class: 'cx-goal-line-label' }, goal.label));
  }

  /** Draws the goal's targets on `svg` and names them in `legend`; returns whether anything was drawn. */
  function render(svg, opts) {
    const { points, xFor, yFor, subjectName, isHistory, mode, legend, createSvgElement } = opts;
    if (isHistory) {
      renderAtar(svg, opts);
      return false;
    }
    const goal = goalFor(subjectName);
    if (!goal) return false;
    const targets = targetsFor(points, goal, mode);
    if (!targets.some(Number.isFinite)) return false;
    const name = window.ConnectifyProgressModes?.find(mode).target || 'Target mark';
    // Lines first, then markers, all before the series (drawn after this)
    const clampY = value => Math.max(40, Math.min(260, yFor(value)));
    const spots = targets.map((value, idx) => (Number.isFinite(value) ? { idx, value, cx: xFor(idx), cy: clampY(value) } : null));
    // Remaining tasks' targets run on from the last plotted score (the plan starts where the results end);
    // marked tasks' requirements are their own line, ending at the last of them
    const scored = idx => Number.isFinite(points[idx]?.score);
    const firstAhead = spots.findIndex(spot => spot && !scored(spot.idx));
    let anchor = -1;
    for (let idx = firstAhead - 1; idx >= 0; idx--) if (scored(idx)) { anchor = idx; break; }
    let segment = [];
    const flush = () => {
      if (segment.length > 1) svg.append(createSvgElement('polyline', { points: segment.join(' '), fill: 'none', class: 'cx-goal-line' }));
      segment = [];
    };
    spots.forEach((spot, idx) => {
      if (idx === firstAhead) {
        flush();
        if (anchor > -1) segment.push(`${xFor(anchor)},${clampY(points[anchor].score)}`);
      }
      if (spot) segment.push(`${spot.cx},${spot.cy}`);
      else flush();
    });
    flush();
    for (const spot of spots.filter(Boolean)) {
      const dot = createSvgElement('circle', { cx: spot.cx, cy: spot.cy, r: 3, tabindex: 0, class: 'cx-goal-target-point' });
      dot.append(createSvgElement('title', {}, `${points[spot.idx].name}: ${name} ${round1(spot.value)}%`));
      svg.append(dot);
    }
    legend?.append(Object.assign(document.createElement('span'), { className: 'cx-goal-key', textContent: `Dashed: ${name} (${goal.label})` }));
    return true;
  }

  window.ConnectifyProgressGoalLine = { goalFor, targetsFor, render };
})();

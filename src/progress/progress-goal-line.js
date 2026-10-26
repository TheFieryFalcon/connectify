/**
 * Connectify Progress: goal line
 *
 * A dashed horizontal line at the goal on Year Progression charts: a subject's own goal (or the target an ATAR
 * goal gives it) on its chart, the ATAR goal on ATAR Progression; labelled `Goal 85%` / `Goal 95.00`. A
 * custom-week goal's line ends at its last task in range. Drawn under the series, like the semester divider.
 * Exposes window.ConnectifyProgressGoalLine.
 */
(() => {
  'use strict';

  if (window.ConnectifyProgressGoalLine) return;

  /** `{ value, endOrder }` for the chart's subject (or the ATAR goal on ATAR charts), or null. */
  function goalFor(subjectName, isHistory) {
    const store = window.ConnectifyGoalStore;
    if (!store) return null;
    if (isHistory) {
      const atar = store.active().find(g => g.kind === 'atar' && !g.parent);
      return atar ? { value: Number(atar.target), label: `Goal ${Number(atar.target).toFixed(2)}` } : null;
    }
    const goal = store.activeFor(subjectName);
    if (!goal) return null;
    const value = goal.kind === 'atar'
      ? window.ConnectifyGoalEvents?.stateOf(goal)?.children?.[store.subjectKey(subjectName)]?.target
      : Number(goal.target);
    if (!Number.isFinite(value)) return null;
    const endOrder = goal.end?.type === 'week' ? window.ConnectifySchoolTerms?.weekOrder(goal.end.week) ?? null : null;
    return { value, endOrder, label: `Goal ${Math.round(value * 10) / 10}%` };
  }

  /** Draws the line on `svg` when the goal sits inside the chart's range. */
  function render(svg, { points, xFor, yFor, minY, maxY, subjectName, isHistory, createSvgElement }) {
    const goal = goalFor(subjectName, isHistory);
    if (!goal || goal.value < minY || goal.value > maxY) return;
    let x2 = 655;
    if (Number.isFinite(goal.endOrder) && !isHistory) {
      const last = points.reduce((idx, p, i) => (Number.isFinite(p.order) && p.order <= goal.endOrder ? i : idx), -1);
      if (last >= 0 && last < points.length - 1) x2 = (xFor(last) + xFor(last + 1)) / 2;
    }
    const y = yFor(goal.value);
    const line = createSvgElement('line', { x1: 44, y1: y, x2, y2: y, class: 'cx-goal-line' });
    const label = createSvgElement('text', { x: x2 - 4, y: y - 5, 'text-anchor': 'end', class: 'cx-goal-line-label' }, goal.label);
    const first = svg.querySelector('polyline, circle');
    if (first) svg.insertBefore(line, first);
    else svg.append(line);
    svg.append(label);
  }

  window.ConnectifyProgressGoalLine = { goalFor, render };
})();

/**
 * Connectify Progress Graph: semester divider
 *
 * A dashed vertical line splitting every Year Progression chart into Semester 1 (left) and
 * Semester 2 (right), labelled on either side. Semester 1 is every task before Term 2 Week 7
 * (order < SEMESTER_TWO_ORDER, as ConnectifyParseHelpers.taskSemester decides). Calendar ATAR
 * charts place it at that week on their time axis; task and assessment-round charts place it
 * between the last Semester 1 point and the first Semester 2 point. Exposes
 * window.ConnectifyProgressSemesterDivider.
 */
(() => {
  'use strict';

  if (window.ConnectifyProgressSemesterDivider) return;

  const LABEL_GAP = 6;
  const LABEL_WIDTH = 58;
  const twoOrder = () => window.ConnectifyParseHelpers?.SEMESTER_TWO_ORDER || 19;

  /** A task's semester: its week when known (never later than its outline's semester), else the outline's. */
  function taskSemester(task) {
    const outline = task?.semester === 1 || task?.semester === 2 ? task.semester : null;
    if (Number.isFinite(task?.order)) return Math.min(task.order < twoOrder() ? 1 : 2, outline || 2);
    return outline;
  }

  /** 1 or 2 when every task shares that semester, else null (none, or a round spanning both). */
  function commonSemester(tasks) {
    const semesters = new Set((tasks || []).map(taskSemester));
    return semesters.size === 1 ? [...semesters][0] : null;
  }

  /**
   * The divider's x, or null when the chart does not span both semesters.
   * xForOrder is given for charts whose x axis is calendar time (order); otherwise semesterOf reads each
   * point's semester (tasks by default; assessment rounds carry theirs, null when a round spans both).
   */
  function boundaryX(points, xFor, xForOrder, semesterOf = taskSemester) {
    if (!Array.isArray(points) || points.length < 2) return null;
    if (xForOrder) {
      const at = twoOrder() - 0.5;
      return points[0].order < at && at < points[points.length - 1].order ? xForOrder(at) : null;
    }
    const semesters = points.map(semesterOf);
    const last = semesters.lastIndexOf(1);
    const first = semesters.indexOf(2);
    if (last < 0 || first < 0 || last > first) return null;
    return (xFor(last) + xFor(first)) / 2;
  }

  /** Appends the dashed line and its Semester 1 / Semester 2 labels to svg (plot area y 40-260). */
  function render(svg, { points, xFor, xForOrder, semesterOf, createSvgElement }) {
    const x = boundaryX(points, xFor, xForOrder, semesterOf);
    if (!Number.isFinite(x)) return null;
    const group = createSvgElement('g', { class: 'cx-semester-divider-group' });
    group.append(createSvgElement('line', { x1: x, y1: 40, x2: x, y2: 260, class: 'cx-semester-divider' }));
    if (x - LABEL_GAP - LABEL_WIDTH >= 0) {
      group.append(createSvgElement('text', { x: x - LABEL_GAP, y: 32, 'text-anchor': 'end', class: 'cx-semester-label' }, 'Semester 1'));
    }
    if (x + LABEL_GAP + LABEL_WIDTH <= 680) {
      group.append(createSvgElement('text', { x: x + LABEL_GAP, y: 32, 'text-anchor': 'start', class: 'cx-semester-label' }, 'Semester 2'));
    }
    svg.append(group);
    return group;
  }

  window.ConnectifyProgressSemesterDivider = { taskSemester, commonSemester, boundaryX, render };
})();

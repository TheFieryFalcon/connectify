/**
 * Connectify Task Dates: task data cells
 *
 * What the Normal view shows of a task beside its date: its cleaned subject, its grade or prediction and its type, on the outline
 * rows' own Type dropdown (same options and saved overrides, so a change here reaches the outlines, and one there
 * reaches this list, through connectify-task-type-changed). Exposes window.ConnectifyTaskDatesCells.
 */
(() => {
  'use strict';

  if (window.ConnectifyTaskDatesCells) return;

  // Before a dropdown opens, by pointer or keyboard
  const FILL_ON = ['pointerdown', 'focus'];

  /** "12 Chemistry ATAR" or "Chemistry ATAR Year 12" -> "Chemistry". */
  const subjectText = row => window.ConnectifyUtils.cleanSubjectName(row.subject) || row.subject;

  const percent = value => `${Math.round(value * 10) / 10}%`;
  /** A completed task's grade ("85.5%"), or a dash. */
  const gradeText = row => (row.marked ? percent(row.score) : '—');
  /** A task's predicted grade (the Predictor's Mid), or a dash. */
  const predictedText = row => (Number.isFinite(row.predicted) ? percent(row.predicted) : '—');

  /**
   * The task's Type dropdown; `track` keeps its focus across the list's rebuilds. It holds only its choice until it is
   * used: the options of every row were two fifths of the list's elements, for dropdowns that are rarely opened.
   */
  function typeSelect(row, track) {
    const types = window.ConnectifyTaskTypes;
    const { task, subjectName } = row;
    const labelsKey = types.labelsKeyOf(task);
    const meta = { subjectName, taskName: task.name, labelsKey, labels: labelsKey ? labelsKey.split('::') : (task.caption ? [task.caption] : []) };
    const select = document.createElement('select');
    select.className = 'cx-dates-select cx-dates-type';
    select.setAttribute('aria-label', `${row.name} type`);
    const sync = opts => types.updateTypeSelect(select, meta.subjectName, meta.taskName, meta.labelsKey, meta.labels, opts);
    sync({ chosenOnly: true });
    const fill = () => {
      for (const evt of FILL_ON) select.removeEventListener(evt, fill);
      sync();
    };
    for (const evt of FILL_ON) select.addEventListener(evt, fill);
    types.bindTypeSelect(select, () => meta);
    return track(select, `type:${row.key}`);
  }

  window.ConnectifyTaskDatesCells = { subjectText, gradeText, predictedText, typeSelect };
})();

/**
 * Connectify Task Dates: task data cells
 *
 * What the Normal view shows of a task beside its date: its cleaned subject, its grade and its type, on the outline
 * rows' own Type dropdown (same options and saved overrides, so a change here reaches the outlines, and one there
 * reaches this list, through connectify-task-type-changed). Exposes window.ConnectifyTaskDatesCells.
 */
(() => {
  'use strict';

  if (window.ConnectifyTaskDatesCells) return;

  /** "12 Chemistry ATAR" or "Chemistry ATAR Year 12" -> "Chemistry". */
  const subjectText = row => window.ConnectifyUtils.normalize(
    String(row.subject || '').replace(/\bATAR\b/gi, '').replace(/\bYear\s*\d+\b/gi, '').replace(/^\s*\d{1,2}\s+/, '')
  ) || row.subject;

  /** A completed task's grade ("85.5%"), or a dash. */
  const gradeText = row => (row.completed ? `${Math.round(row.score * 10) / 10}%` : '—');

  /** The task's Type dropdown; `track` keeps its focus across the list's rebuilds. */
  function typeSelect(row, track) {
    const types = window.ConnectifyTaskTypes;
    const { task, subjectName } = row;
    const labelsKey = types.labelsKeyOf(task);
    const meta = { subjectName, taskName: task.name, labelsKey, labels: labelsKey ? labelsKey.split('::') : (task.caption ? [task.caption] : []) };
    const select = document.createElement('select');
    select.className = 'cx-dates-select cx-dates-type';
    select.setAttribute('aria-label', `${row.name} type`);
    types.updateTypeSelect(select, meta.subjectName, meta.taskName, meta.labelsKey, meta.labels);
    types.bindTypeSelect(select, () => meta);
    return track(select, `type:${row.key}`);
  }

  window.ConnectifyTaskDatesCells = { subjectText, gradeText, typeSelect };
})();

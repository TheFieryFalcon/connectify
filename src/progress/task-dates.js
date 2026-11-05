/**
 * Connectify Task Dates: rows, groups and order
 *
 * The Task Dates tab's list: every cached task of every class. Group By (None, Subject, Type, Completed,
 * Predicted Grade: uncompleted tasks only, Grade Achieved: completed tasks only; grades in university bands) with
 * a direction for the groups (not Completed), then Sort By inside each group (Chronological, Alphabetical,
 * Grade Achieved/Predicted Grade: the predicted grade when grouped by it, else the grade achieved), Show Uncompleted
 * Only, which Export mode forces on, and the subjects and types hidden from the list. A task without the value sorted on comes
 * last whatever the direction. The choices are kept in connectify:task_dates_view.
 * Exposes window.ConnectifyTaskDates.
 */
(() => {
  'use strict';

  if (window.ConnectifyTaskDates) return;

  const KEY = 'connectify:task_dates_view';
  const byText = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  // Infinity is "none": equal to itself, after everything else
  const byNumber = (a, b) => (a === b ? 0 : a - b);

  // WA letter grades have no fixed cutoffs, so marks group by the university scheme, each tied to its school letter
  const GRADE_BANDS = [
    { min: 80, label: 'High Distinction (A)' },
    { min: 70, label: 'Distinction (B)' },
    { min: 60, label: 'Credit (C)' },
    { min: 50, label: 'Pass (C)' },
    { min: -Infinity, label: 'Fail (D)' }
  ];

  function gradeBand(value, none) {
    if (!Number.isFinite(value)) return { key: Infinity, label: none };
    const band = GRADE_BANDS.find(b => value >= b.min);
    return { key: band.min, label: band.label };
  }

  // needsCompleted: says nothing once only uncompleted tasks are listed
  const GROUPS = [
    { id: 'none', label: 'None' },
    { id: 'subject', label: 'Subject', ordered: true, of: r => {
      const label = window.ConnectifyUtils.cleanSubjectName(r.subject) || r.subject;
      return { key: label, label };
    } },
    { id: 'type', label: 'Type', ordered: true, of: r => ({ key: r.type, label: r.type || 'No type' }) },
    { id: 'completed', label: 'Completed', needsCompleted: true, of: r => ({ key: r.completed ? 1 : 0, label: r.completed ? 'Completed' : 'Not completed' }) },
    { id: 'predicted', label: 'Predicted Grade', ordered: true, only: r => !r.completed, of: r => gradeBand(r.predicted, 'No prediction') },
    { id: 'achieved', label: 'Grade Achieved', ordered: true, needsCompleted: true, only: r => r.completed, of: r => gradeBand(r.score, 'No grade') }
  ];
  const DIRECTIONS = [{ id: 'asc', label: 'Ascending' }, { id: 'desc', label: 'Descending' }];
  const SORTS = [
    { id: 'chronological', label: 'Chronological' },
    { id: 'alphabetical', label: 'Alphabetical' },
    { id: 'grade', label: 'Grade Achieved/Predicted Grade', needsCompleted: true }
  ];
  const pick = (list, id) => list.find(item => item.id === id) || list[0];

  const rank = value => (Number.isFinite(value) ? -value : Infinity);
  const chronological = (a, b) => byNumber(a.at, b.at) || byText(a.subject, b.subject) || a.sequence - b.sequence;
  const COMPARE = {
    chronological,
    alphabetical: (a, b) => byText(a.name, b.name) || chronological(a, b),
    // Highest first; tasks without a mark or prediction last
    grade: (a, b) => byNumber(a.gradeRank, b.gradeRank) || chronological(a, b),
    predicted: (a, b) => byNumber(rank(a.predicted), rank(b.predicted)) || chronological(a, b)
  };
  // Grouped by Predicted Grade, the grades in the list are predictions
  const showsPredicted = groupBy => groupBy === 'predicted';

  function readView() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
    return {
      groupBy: saved.groupBy === undefined ? 'subject' : pick(GROUPS, saved.groupBy).id,
      direction: pick(DIRECTIONS, saved.direction).id,
      sortBy: pick(SORTS, saved.sortBy).id,
      uncompletedOnly: saved.uncompletedOnly === true,
      hiddenSubjects: Array.isArray(saved.hiddenSubjects) ? saved.hiddenSubjects : [],
      hiddenTypes: Array.isArray(saved.hiddenTypes) ? saved.hiddenTypes : []
    };
  }

  function saveView(view) {
    try { localStorage.setItem(KEY, JSON.stringify(view)); } catch {}
  }

  /**
   * The view as listed. `exporting` forces Show Uncompleted Only; a group or sort that needs completed tasks then
   * falls back to the default, leaving the saved choice for when the option is off. Sorting by grade stays while the
   * predicted grades are listed.
   */
  function effectiveView(view, exporting) {
    const uncompletedOnly = Boolean(exporting || view.uncompletedOnly);
    if (!uncompletedOnly) return { ...view, uncompletedOnly };
    const groupBy = pick(GROUPS, view.groupBy).needsCompleted ? 'subject' : view.groupBy;
    return {
      ...view,
      uncompletedOnly,
      groupBy,
      sortBy: pick(SORTS, view.sortBy).needsCompleted && !showsPredicted(groupBy) ? 'chronological' : view.sortBy
    };
  }

  const isOrdered = groupBy => Boolean(pick(GROUPS, groupBy).ordered);

  function typeOf(subjectName, task) {
    try {
      return window.ConnectifyTaskTypes?.getEffectiveType?.(subjectName, task, task.labelsKey) || '';
    } catch {
      return '';
    }
  }

  function predictedMid(subjectName, task, subjects) {
    try {
      const mid = window.ConnectifyPredictorMath?.getOrComputeTaskPrediction?.(subjectName, task, subjects)?.mid;
      return Number.isFinite(mid) ? mid : null;
    } catch {
      return null;
    }
  }

  /**
   * One row per task; `siblings` and `subjectName` are what the week editor keys overrides by. Predictions are
   * read only for opts.predictions, on uncompleted tasks. `key` is the export's task key.
   */
  function rows(subjects, opts = {}) {
    const terms = window.ConnectifySchoolTerms;
    const cleanSubject = window.ConnectifyExportTasks.cleanSubject;
    const seen = new Set();
    const out = [];
    for (const subject of subjects || []) {
      const name = cleanSubject(subject.name);
      if (!name) continue;
      for (const task of subject.tasks || []) {
        if (!task) continue;
        const key = `${name}::${task.id ?? task.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const completed = !task.pending && Number.isFinite(task.score);
        out.push({
          key, task, subject: name, name: task.name || '', siblings: subject.tasks, subjectName: subject.name,
          type: typeOf(subject.name, task), completed, score: completed ? task.score : null,
          gradeRank: completed ? -task.score : Infinity,
          predicted: opts.predictions && !completed ? predictedMid(subject.name, task, subjects) : null,
          // The week the row shows: a date caption in the holidays reads as the next term's first week
          at: Number.isFinite(task.order) ? terms.normalizeOrder(task.order) ?? task.order : Infinity,
          sequence: task.sequence ?? 0
        });
      }
    }
    return out;
  }

  /** Whether the Subjects and Type filters leave a row on the list. */
  const isShown = (row, view) => !view.hiddenSubjects.includes(row.subject) && !view.hiddenTypes.includes(row.type);

  /** The classes with only the tasks those filters leave, for what Export builds from. */
  function shownSubjects(subjects, view) {
    const cleanSubject = window.ConnectifyExportTasks.cleanSubject;
    return (subjects || []).filter(s => !view.hiddenSubjects.includes(cleanSubject(s.name))).map(s => ({
      ...s, tasks: (s.tasks || []).filter(t => t && !view.hiddenTypes.includes(typeOf(s.name, t)))
    }));
  }

  /** An effective view -> `[{ label, rows }]`; one group with a null label when not grouped. */
  function arrange(list, view) {
    const group = pick(GROUPS, view.groupBy);
    const sortId = pick(SORTS, view.sortBy).id;
    const sorted = list
      .filter(row => isShown(row, view) && (!view.uncompletedOnly || !row.completed) && (!group.only || group.only(row)))
      .sort(COMPARE[sortId === 'grade' && showsPredicted(view.groupBy) ? 'predicted' : sortId]);
    if (!group.of) return sorted.length ? [{ label: null, rows: sorted }] : [];
    const groups = new Map();
    for (const row of sorted) {
      const { key, label } = group.of(row);
      if (!groups.has(label)) groups.set(label, { key, label, rows: [] });
      groups.get(label).rows.push(row);
    }
    const sign = group.ordered && view.direction === 'desc' ? -1 : 1;
    return Array.from(groups.values()).sort((a, b) => {
      // "No prediction" and "No grade" stay last in either direction
      if (a.key === Infinity || b.key === Infinity) return byNumber(a.key, b.key);
      return sign * (typeof a.key === 'string' ? byText(a.key, b.key) : byNumber(a.key, b.key));
    });
  }

  window.ConnectifyTaskDates = { KEY, GROUPS, DIRECTIONS, SORTS, readView, saveView, effectiveView, isOrdered, showsPredicted, rows, isShown, shownSubjects, arrange, gradeBand };
})();

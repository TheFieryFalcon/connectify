/**
 * Connectify Task Dates: rows, groups and order
 *
 * The Task Dates tab's list: every cached task of every class. Group By (None, Subject, Type, Completed,
 * Predicted Grade: unmarked tasks only, Grade Achieved: marked tasks only; grades in university bands; Completed in
 * four: Uncompleted, Unmarked (its week over), Marked (its week not over or unknown), Completed (both)) with
 * a direction for the groups (not Completed), then Sort By inside each group (Chronological, Alphabetical,
 * Mark: the predicted grade when grouped by it, else the grade achieved), Show (All, Completed, Uncompleted, Marked,
 * Unmarked; Export mode starts on Uncompleted) and the subjects and types hidden from the list. A task is completed once it
 * is marked or its week is over, by the calendar. A task without the value sorted on comes last whatever the
 * direction. The choices are kept in connectify:task_dates_view.
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

  // Show: which tasks are listed; `none` is the list's empty text
  const SHOWS = [
    { id: 'all', label: 'All', keep: () => true },
    { id: 'completed', label: 'Completed', keep: r => r.completed, none: 'No completed assessments.' },
    { id: 'uncompleted', label: 'Uncompleted', keep: r => !r.completed, none: 'No upcoming assessments.' },
    { id: 'marked', label: 'Marked', keep: r => r.marked, none: 'No marked assessments.' },
    { id: 'unmarked', label: 'Unmarked', keep: r => !r.marked, none: 'No unmarked assessments.' }
  ];
  // Whether a Show choice can list a mark (an uncompleted task is never marked)
  const listsMarks = show => show === 'all' || show === 'completed' || show === 'marked';

  // Group By Completed: a task's mark and its calendar week together, in this order
  const STAGES = ['Uncompleted', 'Unmarked', 'Marked', 'Completed'];
  const stageOf = r => (r.marked ? 2 : 0) + (r.past ? 1 : 0);

  // fits(show): says something about the tasks that Show choice lists
  const GROUPS = [
    { id: 'none', label: 'None' },
    { id: 'subject', label: 'Subject', ordered: true, of: r => {
      const label = window.ConnectifyUtils.cleanSubjectName(r.subject) || r.subject;
      return { key: label, label };
    } },
    { id: 'type', label: 'Type', ordered: true, of: r => ({ key: r.type, label: r.type || 'No type' }) },
    { id: 'completed', label: 'Completed', fits: show => show !== 'uncompleted', of: r => ({ key: stageOf(r), label: STAGES[stageOf(r)] }) },
    { id: 'predicted', label: 'Predicted Grade', ordered: true, fits: show => show !== 'marked', only: r => !r.marked, of: r => gradeBand(r.predicted, 'No prediction') },
    { id: 'achieved', label: 'Grade Achieved', ordered: true, fits: listsMarks, only: r => r.marked, of: r => gradeBand(r.score, 'No grade') }
  ];
  const DIRECTIONS = [{ id: 'asc', label: 'Ascending' }, { id: 'desc', label: 'Descending' }];
  const SORTS = [
    { id: 'chronological', label: 'Chronological' },
    { id: 'alphabetical', label: 'Alphabetical' },
    { id: 'grade', label: 'Mark', fits: listsMarks }
  ];
  const pick = (list, id) => list.find(item => item.id === id) || list[0];
  const fits = (option, show) => !option.fits || option.fits(show);

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
      // Show Uncompleted Only, saved before Show, listed the unmarked tasks
      show: saved.show === undefined ? (saved.uncompletedOnly === true ? 'unmarked' : 'all') : pick(SHOWS, saved.show).id,
      hiddenSubjects: Array.isArray(saved.hiddenSubjects) ? saved.hiddenSubjects : [],
      hiddenTypes: Array.isArray(saved.hiddenTypes) ? saved.hiddenTypes : []
    };
  }

  function saveView(view) {
    try { localStorage.setItem(KEY, JSON.stringify(view)); } catch {}
  }

  /**
   * The view as listed: a group or sort that says nothing about the tasks Show lists falls back to the default,
   * leaving the saved choice for when Show changes back. Sorting by grade stays while the predicted grades are listed.
   */
  function effectiveView(view) {
    const show = pick(SHOWS, view.show).id;
    const groupBy = fits(pick(GROUPS, view.groupBy), show) ? view.groupBy : 'subject';
    const sortBy = fits(pick(SORTS, view.sortBy), show) || showsPredicted(groupBy) ? view.sortBy : 'chronological';
    return { ...view, show, groupBy, sortBy };
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

  // The last school week a task's caption runs to ("Term 4 Week 5-6"), unless a week override moved it off it
  function lastWeek(task, at) {
    const helpers = window.ConnectifyParseHelpers;
    const span = task.caption ? helpers?.weekSpan?.(task.caption) || 0 : 0;
    if (!span || !Number.isFinite(at)) return at;
    const start = window.ConnectifySchoolTerms.normalizeOrder(helpers.orderHint(task.caption));
    return start === at ? at + span : at;
  }

  /**
   * One row per task; `siblings` and `subjectName` are what the week editor keys overrides by. `marked`: it has a
   * mark; `past`: its last week (`lastAt`) is over by `opts.today` (a past year: its last day); `completed`: either.
   * Predictions are read only for opts.predictions, on unmarked tasks. `key` is the export's task key.
   */
  function rows(subjects, opts = {}) {
    const terms = window.ConnectifySchoolTerms;
    const today = opts.today || (window.ConnectifyPastYearMode?.today() ?? new Date());
    const thisWeek = Math.floor(terms.orderOf(terms.utc(today.getFullYear(), today.getMonth(), today.getDate())));
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
        const marked = !task.pending && Number.isFinite(task.score);
        // The week the row shows: a date caption in the holidays reads as the next term's first week
        const at = Number.isFinite(task.order) ? terms.normalizeOrder(task.order) ?? task.order : Infinity;
        const lastAt = lastWeek(task, at);
        const past = Number.isFinite(lastAt) && lastAt < thisWeek;
        out.push({
          key, task, subject: name, name: task.name || '', siblings: subject.tasks, subjectName: subject.name,
          type: typeOf(subject.name, task), marked, past, completed: marked || past,
          score: marked ? task.score : null, gradeRank: marked ? -task.score : Infinity,
          predicted: opts.predictions && !marked ? predictedMid(subject.name, task, subjects) : null,
          at, lastAt, sequence: task.sequence ?? 0
        });
      }
    }
    return labelled(out);
  }

  // A name a subject lists in both semesters (each exam's "Close reading") reads with its semester
  function labelled(list) {
    const semesters = new Map();
    const keyOf = row => `${row.subject}::${row.name.trim().toLowerCase()}`;
    for (const row of list) {
      if (!semesters.has(keyOf(row))) semesters.set(keyOf(row), new Set());
      semesters.get(keyOf(row)).add(row.task.semester || 1);
    }
    return list.map(row => ({ ...row, label: semesters.get(keyOf(row)).size > 1 ? `${row.name} (Semester ${row.task.semester || 1})` : row.name }));
  }

  /** Whether the Subjects and Type filters leave a row on the list. */
  const isShown = (row, view) => !view.hiddenSubjects.includes(row.subject) && !view.hiddenTypes.includes(row.type);

  /**
   * The classes with only the tasks those filters leave, for what Export builds from; given the list's rows, only
   * the tasks Show lists too, so the files hold what the table shows.
   */
  function shownSubjects(subjects, view, list) {
    const cleanSubject = window.ConnectifyExportTasks.cleanSubject;
    const listed = list && new Set(list.filter(row => pick(SHOWS, view.show).keep(row)).map(row => row.task));
    return (subjects || []).filter(s => !view.hiddenSubjects.includes(cleanSubject(s.name))).map(s => ({
      ...s, tasks: (s.tasks || []).filter(t => t && !view.hiddenTypes.includes(typeOf(s.name, t)) && (!listed || listed.has(t)))
    }));
  }

  /** An effective view -> `[{ label, rows }]`; one group with a null label when not grouped. */
  function arrange(list, view) {
    const group = pick(GROUPS, view.groupBy);
    const sortId = pick(SORTS, view.sortBy).id;
    const sorted = list
      .filter(row => isShown(row, view) && pick(SHOWS, view.show).keep(row) && (!group.only || group.only(row)))
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

  window.ConnectifyTaskDates = { KEY, SHOWS, GROUPS, DIRECTIONS, SORTS, fits, listsMarks, pick, readView, saveView, effectiveView, isOrdered, showsPredicted, rows, isShown, shownSubjects, arrange, gradeBand };
})();

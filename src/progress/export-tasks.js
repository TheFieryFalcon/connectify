/**
 * Connectify Assessment Export: tasks and dates
 *
 * Turns the cached classes into the export list: every unmarked task, grouped by subject, placed on a
 * day from the Progress graph's own date system (each task's `order` from ConnectifyData: the Progress
 * week override, else its caption's week; read through ConnectifyProgressMath.termWeek) and the task's
 * or subject's weekday (ConnectifySchoolTerms). Tasks with no week, or past Term 4, are left out and
 * listed. Subjects order by their next due task. Exposes window.ConnectifyExportTasks.
 */
(() => {
  'use strict';

  if (window.ConnectifyExportTasks) return;

  // Same cleaning as the Predictor tabs: a "- Semester N" suffix is not part of the subject
  const cleanSubject = name => String(name || '').replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '').replace(/\s+/g, ' ').trim();

  function typeOf(subjectName, task) {
    try {
      return window.ConnectifyTaskTypes?.getEffectiveType?.(subjectName, task, task.labelsKey) || '';
    } catch {
      return '';
    }
  }

  /**
   * opts: { year, early, subjectDays: { subject: 1-5 }, taskDays: { key: 1-5 }, unticked: Set<key> }
   * -> { groups: [{ subject, day, tasks }], leftOut: [item with reason 'noWeek' | 'afterTerm4'] }
   */
  function build(subjects, opts) {
    const terms = window.ConnectifySchoolTerms;
    const progressMath = window.ConnectifyProgressMath;
    const subjectDays = opts.subjectDays || {};
    const taskDays = opts.taskDays || {};
    const unticked = opts.unticked || new Set();
    const groups = new Map();
    const leftOut = [];
    const seen = new Set();

    for (const subject of subjects || []) {
      const name = cleanSubject(subject.name);
      if (!name) continue;
      for (const task of subject.tasks || []) {
        if (!task?.pending) continue;
        const key = `${name}::${task.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const week = progressMath.termWeek(task.order);
        const item = {
          key, subject: name, name: task.name || '',
          // The week as the Progress graph shows it ("Term 2, Week 6")
          when: week ? progressMath.formatTimestamp(task.order) : '',
          weight: Number.isFinite(task.weight) && task.weight > 0 ? task.weight : null,
          type: typeOf(subject.name, task), semester: task.semester === 2 ? 2 : 1,
          sequence: task.sequence ?? 0, ticked: !unticked.has(key), day: taskDays[key] || null, date: null
        };
        if (!week) {
          leftOut.push({ ...item, reason: 'noWeek' });
          continue;
        }
        Object.assign(item, week);
        item.date = terms.dateFor(opts.year, week.term, week.week, item.day || subjectDays[name] || 1, opts.early);
        if (!item.date) {
          leftOut.push({ ...item, reason: 'afterTerm4' });
          continue;
        }
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push(item);
      }
    }

    const byDate = (a, b) => a.date - b.date || a.sequence - b.sequence;
    const list = Array.from(groups, ([subject, tasks]) => ({ subject, day: subjectDays[subject] || 1, tasks: tasks.sort(byDate) }));
    // Next due first, from every upcoming task (ticked or not), so ticking never reorders
    list.sort((a, b) => a.tasks[0].date - b.tasks[0].date || a.subject.localeCompare(b.subject));
    return { groups: list, leftOut };
  }

  /** Ticked tasks in list order. */
  const ticked = groups => groups.flatMap(g => g.tasks.filter(t => t.ticked));

  /** Ticked Exam-type tasks per semester, across subjects, where a semester has two or more. */
  function examGroups(items) {
    const bySemester = new Map();
    for (const item of items) {
      if (!item.ticked || !item.date || String(item.type).toLowerCase() !== 'exam') continue;
      if (!bySemester.has(item.semester)) bySemester.set(item.semester, []);
      bySemester.get(item.semester).push(item);
    }
    return Array.from(bySemester, ([semester, exams]) => {
      exams.sort((a, b) => a.date - b.date);
      return { semester, exams, start: exams[0].date, end: exams[exams.length - 1].date };
    }).filter(g => g.exams.length >= 2).sort((a, b) => a.semester - b.semester);
  }

  window.ConnectifyExportTasks = { cleanSubject, build, ticked, examGroups };
})();

/**
 * Connectify Assessment Export: tasks and dates
 *
 * Turns the cached classes into the export list: every unmarked task, grouped by subject, placed on a
 * day from its school week (a Progress week override, else its caption's term and week, a range's first
 * week; a caption with a real date keeps that date) and the task's or subject's weekday
 * (ConnectifySchoolTerms). Tasks with no week, or past Term 4, are left out and listed.
 * Subjects order by their next due task. Exposes window.ConnectifyExportTasks.
 */
(() => {
  'use strict';

  if (window.ConnectifyExportTasks) return;

  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const MONTH = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';

  // Same cleaning as the Predictor tabs: a "- Semester N" suffix is not part of the subject
  const cleanSubject = name => String(name || '').replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '').replace(/\s+/g, ' ').trim();

  /** "Term 2 Week 6/7" or "Week 6, Term 2" -> { term, week } (a range's first week); a bare "Week 4" is no week. */
  function captionWeek(caption) {
    const text = String(caption || '');
    let match = text.match(/term\s*(\d).*?weeks?\s*(\d+)/i);
    if (match) return { term: +match[1], week: +match[2] };
    match = text.match(/weeks?\s*(\d+)(?:\s*(?:&|and|[\/–-])\s*\d+)?\s*[,;]?\s*term\s*(\d)/i);
    if (match) return { term: +match[2], week: +match[1] };
    return null;
  }

  /** "Fri 14 Mar", "14th March" or "March 14" in `year`, else null. */
  function captionDate(caption, year) {
    const text = String(caption || '');
    let day, month;
    let match = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH}`, 'i'));
    if (match) [day, month] = [+match[1], match[2]];
    else if ((match = text.match(new RegExp(`\\b${MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i')))) [month, day] = [match[1], +match[2]];
    else return null;
    const m = MONTHS.indexOf(month.toLowerCase());
    const date = new Date(Date.UTC(year, m, day));
    return day >= 1 && date.getUTCMonth() === m ? date : null;
  }

  /** A week typed in the Progress table (by task id; by name only for the first task of that name). */
  function overrideWeek(subjectName, task, firstOfName) {
    const utils = window.ConnectifyUtils;
    if (!utils?.readTimeOverride) return null;
    const value = utils.readTimeOverride([subjectName], [task.id]) ??
      (firstOfName && task.name ? utils.readTimeOverride([subjectName], [task.name]) : null);
    const order = utils.customWeekOrder(value);
    if (order === null) return null;
    // customWeekOrder gives the 12-slot order (term - 1) * 12 + week
    const term = Math.floor((order - 1) / 12) + 1;
    return { term, week: order - (term - 1) * 12 };
  }

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
    const subjectDays = opts.subjectDays || {};
    const taskDays = opts.taskDays || {};
    const unticked = opts.unticked || new Set();
    const groups = new Map();
    const leftOut = [];
    const seen = new Set();

    for (const subject of subjects || []) {
      const name = cleanSubject(subject.name);
      if (!name) continue;
      const tasks = (subject.tasks || []).filter(Boolean);
      const firstSequence = new Map();
      for (const task of tasks) {
        const seq = task.sequence ?? 0;
        if (!firstSequence.has(task.name) || seq < firstSequence.get(task.name)) firstSequence.set(task.name, seq);
      }

      for (const task of tasks) {
        if (!task.pending) continue;
        const key = `${name}::${task.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const item = {
          key, subject: name, name: task.name || '', caption: task.caption || '',
          weight: Number.isFinite(task.weight) && task.weight > 0 ? task.weight : null,
          type: typeOf(subject.name, task), semester: task.semester === 2 ? 2 : 1,
          sequence: task.sequence ?? 0, ticked: !unticked.has(key), day: taskDays[key] || null,
          fixed: false, date: null
        };
        const week = overrideWeek(subject.name, task, firstSequence.get(task.name) === (task.sequence ?? 0)) || captionWeek(item.caption);
        if (week) {
          Object.assign(item, week);
          item.date = terms.dateFor(opts.year, week.term, week.week, item.day || subjectDays[name] || 1, opts.early);
          if (!item.date) {
            leftOut.push({ ...item, reason: 'afterTerm4' });
            continue;
          }
        } else {
          item.date = captionDate(item.caption, opts.year);
          item.fixed = true;
          if (!item.date) {
            leftOut.push({ ...item, reason: 'noWeek' });
            continue;
          }
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

  window.ConnectifyExportTasks = { cleanSubject, captionWeek, captionDate, overrideWeek, build, ticked, examGroups };
})();

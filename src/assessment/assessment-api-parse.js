/**
 * Connectify Assessment: tasks from Connect's API records
 *
 * Turns one ConnectifyOutlineApi record (an outline card) into the parser's { title, subjectName, tasks }
 * without reading the page. Each task's labels (type, caption, name) and mark and weight texts are the
 * ones the old outline rows showed (legacy-outlines-markup.js draws exactly these), so every task gets
 * the same id, labels key and stats key it had when the rows were scraped, and caches, overrides and
 * predictions saved before carry on. Exposes window.ConnectifyApiParse.
 */
(() => {
  'use strict';

  if (window.ConnectifyApiParse) return;

  const { normalize } = window.ConnectifyUtils;
  const helpers = () => window.ConnectifyParseHelpers;

  /** The task's labels as its row listed them: type, caption (when set) and name. */
  const labelsOf = task => [task.type, task.when, task.name].map(v => normalize(v || '')).filter(Boolean);
  const fraction = (value, max) => (max ? `${value || '-'} Out of ${max}` : (value || '-'));
  /** Raw Score text ("17 Out of 20", "- Out of 30" while unmarked). */
  const markText = task => fraction(task.mark, task.max);
  /** Weighted Mark text, '' when the task has no weighting. */
  const weightText = task => (task.weightedMax || task.weighted ? fraction(task.weighted, task.weightedMax) : '');

  const tasksOf = record => (record.outlines || []).flatMap(o => o.tasks || []);

  /** Id entries (ConnectifyParseHelpers.assignTaskIds) for the record's tasks, in order; null for unreadable ones. */
  function ids(record) {
    const list = tasksOf(record);
    const entries = helpers().assignTaskIds(list.map(t => ({ labels: labelsOf(t), mark: helpers().markFromText(markText(t)) })));
    return list.map((task, i) => (entries[i] ? { ...entries[i], task } : null));
  }

  /** Ids of the record's marked tasks (grade-tasks.js compares them with the last visit's). */
  const markedIds = record => ids(record).filter(e => e?.mark.isCompleted).map(e => e.id);

  /**
   * { title, subjectName, tasks } for a record, or null when it lists no tasks. A tile drawn from the record
   * (tile) links each task to its row while the tile is expanded, as rows scraped from the page are.
   */
  function parse(record, tile = null) {
    const parser = window.ConnectifyParser;
    if (!record?.subject || !parser?.taskRecord) return null;
    const rows = tile ? helpers().cardTaskIds(tile) : null;
    const rowFor = new Map();
    rows?.forEach((entry, row) => rowFor.set(entry.id, row));
    const tasks = [];
    for (const entry of ids(record)) {
      if (!entry) continue;
      const { task } = entry;
      const stats = task.showChart && entry.mark.isCompleted ? task.stats : null;
      const result = parser.taskRecord({
        title: record.title,
        subjectName: record.subject,
        cardSemester: record.semester,
        entry,
        weightText: weightText(task),
        stats,
        mean: stats ? helpers().weightedMean(stats) : null,
        sequence: tasks.length
      });
      if (rowFor.has(entry.id)) parser.setTaskRow(result, rowFor.get(entry.id));
      tasks.push(result);
    }
    return tasks.length ? { title: record.title, subjectName: record.subject, tasks } : null;
  }

  /** The overall mark as a number (83.3 from "83.3%"), or null. */
  function overallMark(record) {
    const match = String(record?.mark || '').match(/(-?\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : null;
  }

  const hasFinalLetter = record => /^[A-E]$/i.test(record?.grade || '');

  window.ConnectifyApiParse = { labelsOf, markText, weightText, ids, markedIds, parse, overallMark, hasFinalLetter };
})();

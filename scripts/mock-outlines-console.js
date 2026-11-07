/**
 * Connectify mock outlines: paste this whole file into the DevTools console on Connect's Assessment Outlines page
 * (the page's own console context is fine: it only writes localStorage). It defines window.cxMock:
 *
 *   cxMock.seed()     a Year 11, 2026 student: six ATAR subjects and one General, Semester 1 graded, Semester 2
 *                     part-marked, tasks due this week and next, results awaited; starts mock mode and reloads
 *   cxMock.release()  marks the earliest unmarked task (Class Updated and goal toasts), then reloads
 *   cxMock.finish()   marks every task and gives Semester 2 its letters (the year is over), then reloads
 *   cxMock.newYear()  replaces the classes with Year 12's (run after finish(): the rollover archives Year 11, so
 *                     Past Years lists it), then reloads
 *   cxMock.exit()     leaves mock mode (the mock account's data stays for next time), then reloads
 *   cxMock.wipe()     leaves mock mode and deletes the mock account's data, then reloads
 *
 * While connectify:mock_outlines is set, Connectify runs as a separate student (`<account>~mock`, mock-outlines.js)
 * and never fetches Connect's outlines, so the real account's class registry, snapshot and records are never
 * touched and Connect's real outlines can never start a new year from mock classes. Settings shared by every
 * student (theme, categories, Settings checkboxes) are shared with the mock too; Clear Cache clears every account's.
 */
(() => {
  const KEY = 'connectify:mock_outlines';

  // [semester, Connect task type, name, term, week, weight (of the year), max, percent or null while unmarked]
  const YEAR_11 = {
    '11 Mathematics Methods ATAR': [
      [1, 'Response', 'Response 1', 1, 5, 8, 40, 82], [1, 'Response', 'Response 2', 1, 9, 8, 40, 75],
      [1, 'Investigation', 'Investigation 1', 2, 3, 7, 30, 88], [1, 'Examination', 'Semester 1 Examination', 2, 8, 15, 100, 71],
      [2, 'Response', 'Response 3', 3, 3, 8, 40, 79], [2, 'Investigation', 'Investigation 2', 3, 7, 7, 30, 84],
      [2, 'Response', 'Response 4', 4, 3, 12, 50, null], [2, 'Examination', 'Semester 2 Examination', 4, 6, 35, 100, null]
    ],
    '11 Literature ATAR': [
      [1, 'Short written response', 'Close Reading: Poetry', 1, 6, 8, 20, 74], [1, 'Extended written response', 'Extended Response', 2, 2, 10, 30, 69],
      [1, 'Creative production', 'Creative Response: Short Story', 2, 5, 7, 25, 81], [1, 'Examination', 'Semester 1 Examination: Extended Response', 2, 8, 15, 40, 66],
      [2, 'Oral', 'Oral Presentation: Drama', 3, 4, 8, 20, 78], [2, 'Extended written response', 'Extended Response', 3, 8, 12, 30, 72],
      [2, 'Short written response', 'Close Reading: Prose', 4, 2, 10, 20, null], [2, 'Examination', 'Extended Response', 4, 6, 30, 40, null]
    ],
    '11 Human Biology ATAR': [
      [1, 'Science inquiry', 'Science Inquiry: Reaction Time', 1, 7, 8, 40, 85], [1, 'Test', 'Topic Test 1: Cells', 1, 9, 7, 50, 79],
      [1, 'Extended response', 'Extended Response: Homeostasis', 2, 4, 8, 30, 73], [1, 'Examination', 'Semester 1 Examination', 2, 8, 15, 100, 70],
      [2, 'Science inquiry', 'Practical: Enzymes', 3, 2, 8, 40, 88], [2, 'Test', 'Topic Test 2: Reproduction', 3, 6, 7, 50, 76],
      [2, 'Extended response', 'Extended Response: Disease', 4, 3, 12, 30, null], [2, 'Examination', 'Semester 2 Examination', 4, 7, 35, 100, null]
    ],
    '11 Economics ATAR': [
      [1, 'Investigation', 'Investigation: Market Failure', 1, 8, 10, 50, 77], [1, 'Data interpretation/Short answer', 'Data Interpretation 1', 2, 3, 10, 40, 68],
      [1, 'Examination', 'Semester 1 Examination', 2, 8, 20, 100, 64],
      [2, 'Extended response', 'Extended Response: Inflation', 3, 5, 10, 25, 71], [2, 'Data interpretation/Short answer', 'Data Interpretation 2', 3, 9, 10, 40, 74],
      [2, 'Investigation', 'Investigation: Trade', 4, 5, 10, 50, null], [2, 'Examination', 'Semester 2 Examination', 4, 6, 30, 100, null]
    ],
    '11 Japanese: Second Language ATAR': [
      [1, 'Oral communication', 'Oral Communication: Interview', 1, 8, 10, 30, 86], [1, 'Response: Listening', 'Listening Task 1', 2, 2, 8, 40, 79],
      [1, 'Written communication', 'Writing Task: Letter', 2, 5, 7, 25, 83], [1, 'Practical (oral) examination', 'Semester 1 Oral Exam', 2, 7, 7, 30, 88],
      [1, 'Written examination', 'Semester 1 Written Exam', 2, 8, 10, 80, 75],
      [2, 'Response: Viewing and reading', 'Reading Task', 3, 4, 8, 40, 81], [2, 'Oral communication', 'Conversation', 3, 8, 10, 30, 84],
      [2, 'Practical (oral) examination', 'Semester 2 Oral Exam', 4, 4, 15, 30, null], [2, 'Written examination', 'Semester 2 Written Exam', 4, 6, 25, 80, null]
    ],
    '11 Modern History ATAR': [
      [1, 'Historical inquiry', 'Historical Inquiry: Russian Revolution', 1, 9, 12, 40, 80], [1, 'Source analysis', 'Source Analysis 1', 2, 3, 8, 30, 72],
      [1, 'Examination', 'Semester 1 Examination', 2, 8, 20, 100, 69],
      [2, 'Explanation', 'Explanation: Cold War', 3, 5, 10, 30, 75], [2, 'Source analysis', 'Source Analysis 2', 3, 9, 10, 30, 70],
      [2, 'Examination', 'Semester 2 Examination', 4, 6, 40, 100, null]
    ],
    '11 Career and Enterprise General': [
      [1, 'Portfolio', 'Portfolio 1', 1, 8, 30, 50, 90], [1, 'Assignment', 'Workplace Assignment', 2, 6, 20, 40, 85],
      [2, 'Presentation', 'Career Presentation', 3, 6, 20, 30, 88], [2, 'Externally set task', 'Externally Set Task', 4, 2, 30, 50, 80]
    ]
  };

  // Year 12 courses start in Term 4: a few tasks each, none marked
  const YEAR_12 = Object.fromEntries(Object.entries(YEAR_11).filter(([name]) => /ATAR/.test(name)).map(([name]) => [
    name.replace(/^11 /, '12 '),
    [[1, 'Test', 'Unit 3 Test 1', 4, 7, 10, 50, null], [1, 'Investigation', 'Unit 3 Investigation', 4, 9, 15, 40, null]]
  ]));

  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const round = (v, p = 2) => Math.round(v * 10 ** p) / 10 ** p;
  const letter = m => (m >= 85 ? 'A' : m >= 70 ? 'B' : m >= 55 ? 'C' : m >= 45 ? 'D' : 'E');

  /** A boxplot [min, Q1, median, Q3, max] around a cohort mean a little under the student's percent. */
  function boxplot(pct) {
    const median = Math.max(35, Math.min(92, pct - 4 - rand() * 10));
    const stats = [median - 30 - rand() * 10, median - 9, median, median + 8, median + 18 + rand() * 6].map(v => round(Math.max(0, Math.min(100, v))));
    stats[0] = Math.min(stats[0], pct);
    stats[4] = Math.max(stats[4], pct);
    return stats;
  }

  function task(row, id) {
    const [, type, name, term, week, weight, max, pct] = row;
    const marked = Number.isFinite(pct);
    const mark = marked ? Math.round((pct * max) / 100) : null;
    const percent = marked ? round((mark / max) * 100) : null;
    return {
      taskId: id, type, when: `Term ${term}, Week ${week}`, name,
      mark: marked ? String(mark) : '', max: String(max),
      weighted: marked ? String(round((percent * weight) / 100)) : '', weightedMax: String(weight),
      showChart: true, stats: marked ? boxplot(percent) : null, percent
    };
  }

  const pctOf = t => (t.mark ? (Number(t.mark) / Number(t.max)) * 100 : null);
  /** Weight-weighted mean of the marked tasks, or null. */
  function overall(tasks) {
    const marked = tasks.filter(t => t.mark);
    const total = marked.reduce((s, t) => s + Number(t.weightedMax), 0);
    return total ? marked.reduce((s, t) => s + pctOf(t) * Number(t.weightedMax), 0) / total : null;
  }

  /** Sets each record's overall mark and class boxplot from its tasks; Semester 1 graded when its tasks are. */
  function settle(records, { gradeSemester2 = false } = {}) {
    for (const r of records) {
      const tasks = r.outlines.flatMap(o => o.tasks);
      const mark = overall(tasks);
      r.mark = mark === null ? '' : `${round(mark)}%`;
      r.percent = mark === null ? null : round(mark);
      r.stats = mark === null ? null : boxplot(mark);
      const done = tasks.every(t => t.mark);
      r.grade = mark !== null && done && (r.semester === 1 || gradeSemester2) ? letter(mark) : '';
    }
    return records;
  }

  function build(classes) {
    let id = 900000;
    const records = [];
    Object.entries(classes).forEach(([subject, rows], c) => {
      const tasks = rows.map(row => ({ semester: row[0], task: task(row, ++id) }));
      const outline = semester => ({ id: 5000 + c * 2 + semester, code: `${subject.replace(/^\d+ /, '')} Unit ${semester}`, tasks: tasks.filter(t => t.semester === semester).map(t => t.task) });
      const staff = [`${['Ms', 'Mr', 'Dr'][c % 3]} ${['R. Patel', 'J. Nguyen', 'A. Smith', 'K. Tanaka', 'L. Brown', 'M. Rossi', 'S. Lee'][c % 7]}`];
      const base = { apiOutline: true, subject, statusLine: '', staff, school: 'Mock Senior High School', showChart: true };
      records.push({ ...base, title: `${subject} - Semester 1`, semester: 1, outlines: [outline(1)] });
      records.push({ ...base, title: `${subject} - Semester 2`, semester: 2, outlines: [outline(1), outline(2)] });
    });
    return settle(records);
  }

  const read = () => JSON.parse(localStorage.getItem(KEY) || 'null');
  const write = records => localStorage.setItem(KEY, JSON.stringify({ records, savedAt: Date.now() }));
  const mockKeys = () => Object.keys(localStorage).filter(k => k.includes('~mock'));
  const unmarked = records => records.flatMap(r => r.outlines.flatMap(o => o.tasks)).filter(t => !t.mark);
  const when = t => { const [, term, week] = t.when.match(/Term (\d+), Week (\d+)/) || []; return Number(term) * 100 + Number(week); };

  /** Gives every copy of one task (Semester 1 tasks are on both outlines) the same mark and boxplot. */
  function markTask(records, taskId, pct) {
    let stats = null;
    for (const t of records.flatMap(r => r.outlines.flatMap(o => o.tasks)).filter(t => t.taskId === taskId)) {
      const mark = Math.round((pct * Number(t.max)) / 100);
      t.mark = String(mark);
      t.percent = round((mark / Number(t.max)) * 100);
      t.weighted = String(round((t.percent * Number(t.weightedMax)) / 100));
      t.stats = stats || (stats = boxplot(t.percent));
    }
  }

  window.cxMock = {
    seed() {
      mockKeys().forEach(k => localStorage.removeItem(k));
      write(build(YEAR_11));
      location.reload();
    },
    release(pct = 60 + Math.round(Math.random() * 35)) {
      const saved = read();
      if (!saved) return console.warn('Mock mode is off: run cxMock.seed() first');
      const next = unmarked(saved.records).sort((a, b) => when(a) - when(b))[0];
      if (!next) return console.log('Every mock task is marked');
      markTask(saved.records, next.taskId, pct);
      write(settle(saved.records));
      console.log(`Released ${next.name}: ${pct}%`);
      location.reload();
    },
    finish() {
      const saved = read();
      if (!saved) return console.warn('Mock mode is off: run cxMock.seed() first');
      for (const t of unmarked(saved.records)) markTask(saved.records, t.taskId, 60 + Math.round(Math.random() * 35));
      write(settle(saved.records, { gradeSemester2: true }));
      location.reload();
    },
    newYear() {
      write(build(YEAR_12));
      location.reload();
    },
    exit() {
      localStorage.removeItem(KEY);
      location.reload();
    },
    wipe() {
      localStorage.removeItem(KEY);
      mockKeys().forEach(k => localStorage.removeItem(k));
      location.reload();
    },
    build: () => build(YEAR_11),
    buildYear12: () => build(YEAR_12)
  };
  console.log('cxMock ready: seed(), release(), finish(), newYear(), exit(), wipe()');
})();

/**
 * Connectify playground: data model
 *
 * Playground state (classes, each with a Semester 1 and a Semester 2 outline of tasks) and its translation
 * into what Connectify's scraper would have cached from Connect: subjects-cache task records and the class
 * registry. Runs in the page (window.PlaygroundModel) and in Node (test_suite.js).
 */
(function (root) {
  'use strict';

  const TYPES = ['Test', 'Exam', 'Essay', 'Application', 'Take-Home'];

  const SUBJECTS = {
    'Chemistry': ['Stoichiometry', 'Equilibrium', 'Acids and Bases', 'Organic Chemistry', 'Redox'],
    'Physics': ['Motion and Forces', 'Electromagnetism', 'Waves', 'Relativity', 'Circular Motion'],
    'Mathematics Methods': ['Differentiation', 'Integration', 'Probability', 'Logarithms', 'Statistics'],
    'Mathematics Specialist': ['Vectors', 'Complex Numbers', 'Calculus', 'Proof', 'Mechanics'],
    'English': ['Persuasive Writing', 'Comparative Essay', 'Close Reading', 'Film Study', 'Poetry'],
    'Literature': ['Poetry', 'Prose', 'Drama', 'Close Reading', 'Critical Theory'],
    'Biology': ['Genetics', 'Evolution', 'Homeostasis', 'Ecology', 'Immunity'],
    'Economics': ['Markets', 'Macroeconomics', 'Trade', 'Fiscal Policy', 'Monetary Policy'],
    'Modern History': ['Russia', 'Cold War', 'Australia', 'China', 'Elective'],
    'Psychology': ['Memory', 'Learning', 'Development', 'Personality', 'Research Methods']
  };
  const WRITTEN = new Set(['English', 'Literature', 'Modern History']);

  const pick = (list, rand) => list[Math.floor(rand() * list.length) % list.length];
  const caption = t => (t.term && t.week ? `Term ${t.term}, Week ${t.week}` : '');
  const labelsOf = t => [t.type, caption(t), t.name].filter(Boolean);

  let counter = 0;
  const uid = () => `t${Date.now().toString(36)}${(counter++).toString(36)}`;

  /** A new task in a semester outline; its Connect id is fixed now, so later edits keep the task's identity. */
  function makeTask(cls, fields) {
    const task = { uid: uid(), type: 'Test', name: 'New task', term: 1, week: 1, weight: 0, score: null, mean: null, ...fields };
    const identity = JSON.stringify([labelsOf(task), 100]);
    const taken = new Set(cls.tasks.map(t => t.connectId));
    let occurrence = 0;
    while (taken.has(`${identity}:${occurrence}`)) occurrence++;
    task.connectId = `${identity}:${occurrence}`;
    return task;
  }

  /** A class with an unused subject name, two tasks per semester and weights totalling 100. */
  function generateClass(existingNames = [], rand = Math.random) {
    const free = Object.keys(SUBJECTS).filter(s => !existingNames.includes(`12 ${s} ATAR`));
    const subject = free.length ? pick(free, rand) : `Subject ${existingNames.length + 1}`;
    const topics = [...(SUBJECTS[subject] || ['Foundations', 'Applications', 'Analysis', 'Review'])];
    const topic = () => topics.splice(Math.floor(rand() * topics.length) % topics.length, 1)[0] || 'Review';
    const firstType = WRITTEN.has(subject) ? 'Essay' : 'Test';
    const secondType = WRITTEN.has(subject) ? 'Essay' : 'Application';
    const cls = { id: uid(), name: `12 ${subject} ATAR`, letters: { 1: '', 2: '' }, markOverride: { 1: null, 2: null }, tasks: [] };
    const add = (semester, fields) => cls.tasks.push({ ...makeTask(cls, fields), semester });
    add(1, { type: firstType, name: `${firstType} – ${topic()}`, term: 1, week: 7, weight: 20 });
    add(1, { type: 'Exam', name: 'Semester 1 Examination', term: 2, week: 5, weight: 30 });
    add(2, { type: secondType, name: `${secondType} – ${topic()}`, term: 3, week: 4, weight: 20 });
    add(2, { type: 'Exam', name: 'Semester 2 Examination', term: 3, week: 9, weight: 30 });
    return cls;
  }

  const isMarked = t => Number.isFinite(t.score);

  /** Weight-weighted mean of the marked tasks (plain mean when no weights), to 2 decimal places. */
  function weightedMark(tasks) {
    const marked = tasks.filter(isMarked);
    if (!marked.length) return null;
    const weighted = marked.filter(t => t.weight > 0);
    const list = weighted.length ? weighted : marked;
    const total = list.reduce((s, t) => s + (weighted.length ? t.weight : 1), 0);
    const sum = list.reduce((s, t) => s + t.score * (weighted.length ? t.weight : 1), 0);
    return Math.round((sum / total) * 100) / 100;
  }

  /** Tasks each semester's outline lists: Semester 1's own, and every task on Semester 2's (as Connect does). */
  const outlineTasks = (cls, semester) => cls.tasks.filter(t => semester === 2 || t.semester === 1);
  const autoMark = (cls, semester) => weightedMark(outlineTasks(cls, semester));
  const overallMark = (cls, semester) => (Number.isFinite(cls.markOverride?.[semester]) ? cls.markOverride[semester] : autoMark(cls, semester));
  const weightTotal = cls => cls.tasks.reduce((s, t) => s + (Number(t.weight) || 0), 0);

  /**
   * { subjects: { name: [task records] }, registry } as the scraper and class registry would have stored
   * them. helpers: ConnectifyParseHelpers (orderHint, taskSemester), so weeks resolve as on Connect.
   */
  function toConnectify(state, helpers) {
    const subjects = {};
    const registry = {};
    for (const cls of state.classes) {
      const names = new Set();
      subjects[cls.name] = cls.tasks.map((t, sequence) => {
        const text = caption(t);
        const nameKey = t.name.toLowerCase();
        const record = {
          id: t.connectId,
          name: t.name,
          caption: text,
          labelsKey: labelsOf(t).join('::'),
          statsKey: names.has(nameKey) ? t.connectId : t.name,
          score: isMarked(t) ? t.score : null,
          pending: !isMarked(t),
          weight: Number.isFinite(t.weight) ? t.weight : null,
          mean: Number.isFinite(t.mean) ? t.mean : null,
          semester: helpers.taskSemester(t.semester, text, null),
          order: text ? helpers.orderHint(text) : null,
          sequence
        };
        names.add(nameKey);
        return record;
      });
      registry[cls.name] = {};
      for (const semester of [1, 2]) {
        registry[cls.name][semester] = {
          title: `${cls.name} - Semester ${semester}`,
          mark: overallMark(cls, semester),
          finalLetter: Boolean(cls.letters?.[semester]),
          tasks: outlineTasks(cls, semester).map(t => [t.connectId, t.name])
        };
      }
    }
    return { subjects, registry };
  }

  /** The earliest unmarked weighted task across every class (by term and week, then position). */
  function nextUnmarked(state) {
    const all = state.classes.flatMap(cls => cls.tasks.map((t, i) => ({ cls, t, i })));
    const when = ({ t }) => (t.term && t.week ? t.term * 100 + t.week : 1e6);
    return all.filter(({ t }) => !isMarked(t) && t.weight > 0).sort((a, b) => when(a) - when(b) || a.i - b.i)[0] || null;
  }

  const api = { TYPES, SUBJECTS, caption, labelsOf, makeTask, generateClass, weightedMark, outlineTasks, autoMark, overallMark, weightTotal, toConnectify, nextUnmarked };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlaygroundModel = api;
})(typeof window !== 'undefined' ? window : globalThis);

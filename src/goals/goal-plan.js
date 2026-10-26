/**
 * Connectify Goals: plans
 *
 * Which tasks a goal covers (a semester's outline, or every task up to a school week of the year by its Year
 * Progression week), the week snapshot (each task's week and semester as first read this page load: after a
 * week override or Early Easter change goals are held until reload), effort sliders as solver offsets, and the
 * grade and ATAR plans a goal solves. Exposes window.ConnectifyGoalPlan.
 */
(() => {
  'use strict';

  if (window.ConnectifyGoalPlan) return;

  const NOTCHES = ['Much less', 'Less', 'Normal', 'More', 'Much more'];
  const POINTS_PER_NOTCH = 5;
  const notchName = value => NOTCHES[Math.max(-2, Math.min(2, Math.round(Number(value) || 0))) + 2];
  const solver = () => window.ConnectifyTargetSolver || window.ConnectifyMath || {};
  const isMarked = t => !t.pending && Number.isFinite(t.score);

  // --- Week snapshot and hold ---
  const snapshot = new Map();
  let held = false;
  const hold = () => {
    if (held) return;
    held = true;
    window.dispatchEvent(new CustomEvent('connectify-goals-held'));
  };
  window.addEventListener('connectify-terms-updated', hold);
  window.addEventListener('connectify-week-override-saved', hold);

  const taskKey = (subject, t) => `${subject}::${t.id || t.name}`;

  /** The task's `{ week, semester }` as first read this page load (school week of the year, or null). */
  function weekOf(subject, t) {
    const key = taskKey(subject, t);
    if (!snapshot.has(key)) {
      const week = Number.isFinite(t.order) ? window.ConnectifySchoolTerms?.schoolWeek(t.order) ?? null : null;
      snapshot.set(key, { week: Number.isFinite(week) ? week : null, semester: Number(t.semester) === 2 ? 2 : 1 });
    }
    return snapshot.get(key);
  }

  // --- Courses ---
  /** `[[Semester 1 courses], [Semester 2 courses]]` from the cache (every class, or ATAR classes only). */
  function readCourses(atarOnly = false) {
    try {
      return window.ConnectifyAtarScraper?.readCourses?.(atarOnly) || [[], []];
    } catch {
      return [[], []];
    }
  }

  /** A subject's semester outlines: `{ 1: course, 2: course }` (either may be missing). */
  const entryFor = (courses, subject) => ({ 1: courses[0]?.find(c => c.id === subject), 2: courses[1]?.find(c => c.id === subject) });

  /** A goal's semester: its end semester, or the semester its end week falls in. */
  function semesterOf(goal) {
    if (goal.end?.type !== 'week') return goal.end?.semester === 1 ? 1 : 2;
    const order = window.ConnectifySchoolTerms?.weekOrder(goal.end.week);
    const two = window.ConnectifyParseHelpers?.semesterTwoOrder?.() ?? 19;
    return Number.isFinite(order) && order < two ? 1 : 2;
  }

  /**
   * The tasks a grade goal covers, each with its snapshot `week`: `{ tasks, undated, subject }` (undated: names of
   * tasks a custom-week goal leaves out for want of a week). A semester end is that outline's tasks.
   */
  function rangeTasks(goal, entry) {
    if (goal.end?.type !== 'week') {
      const course = entry[goal.end?.semester === 1 ? 1 : 2];
      if (!course) return { tasks: [], undated: [], subject: null };
      return { tasks: (course.tasks || []).map(t => ({ ...t, ...weekOf(course.subject, t) })), undated: [], subject: course.subject };
    }
    const seen = new Set();
    const tasks = [];
    const undated = [];
    for (const course of [entry[2], entry[1]].filter(Boolean)) {
      for (const t of course.tasks || []) {
        const key = t.id || t.name;
        if (seen.has(key)) continue;
        seen.add(key);
        const { week, semester } = weekOf(course.subject, t);
        if (week === null) undated.push(t.name);
        else if (week <= goal.end.week) tasks.push({ ...t, week, semester });
      }
    }
    const subject = (entry[2] || entry[1])?.subject || null;
    return { tasks, undated, subject };
  }

  /** Date order of tasks (school week, then outline position): replays walk results in this order. */
  const byWeek = (a, b) => (a.week ?? 99) - (b.week ?? 99) || (a.order ?? 0) - (b.order ?? 0);

  /** Copies of `tasks` with only those `isDone` accepts kept as marked (the rest pending again). */
  const asOf = (tasks, isDone) => tasks.map(t => (isMarked(t) && isDone(t) ? t : { ...t, pending: true, score: undefined, earned: 0 }));

  /** Weighted points earned (`isDone` tasks) and needed for `target` over `tasks`. */
  function points(tasks, target, isDone = isMarked) {
    let earned = 0;
    let total = 0;
    for (const t of tasks) {
      total += t.weight || 0;
      if (isMarked(t) && isDone(t)) earned += (t.score / 100) * t.weight;
    }
    return { earned, required: (target / 100) * total, total };
  }

  // --- Plans ---
  /** Slider notches as solver offsets in points: `{ taskKey: pts }`, or `{ course: pts, course::taskKey: pts }` for ATAR. */
  function offsets(goal, courseName) {
    const out = {};
    for (const [key, notch] of Object.entries(goal.sliders || {})) {
      if (Number(notch)) out[courseName ? `${courseName}::${key}` : key] = Number(notch) * POINTS_PER_NOTCH;
    }
    return out;
  }

  /** The grade plan for `tasks` (marked ones done unless `isDone` says otherwise). */
  function gradePlan(goal, tasks, subject, isDone = () => true, semesterNumber = 1) {
    const progress = solver().taskProgress?.(asOf(tasks, isDone), undefined, semesterNumber);
    if (!progress) return { error: 'Target solver unavailable.' };
    const plan = solver().gradePlan(progress, Number(goal.target), {
      difficultyWeighted: Boolean(goal.difficultyWeighted), subjectName: subject || '', offsets: offsets(goal)
    });
    const guaranteed = !plan.error && !plan.impossible && progress.earned >= Number(goal.target) - 1e-9;
    return { ...plan, progress, guaranteed };
  }

  /** The required mark of one task in a plan (its own under effort, else the uniform score). */
  const requiredOf = (plan, key) => (plan.impossible ? null : plan.taskRequirements?.[key]?.required ?? plan.required ?? null);

  /**
   * The Target ATAR planner's rows for a semester (index 0 / 1): each course's scaled school mark, outline
   * progress and calibration offset, `include` from `isIncluded(course)`, plus the TEA bonus to hold.
   */
  function atarRows(courses, semIdx, isIncluded) {
    const calc = window.ConnectifyAtarCalc;
    const wholeScore = window.ConnectifyMath?.wholeScore || (v => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : undefined));
    const eligible = (courses[semIdx] || []).filter(r => !/\bGeneral\b|\bmathematics essentials?\b/i.test(r.name));
    const rows = eligible.map(r => {
      const current = calc?.getCourseState ? calc.getCourseState(r, semIdx, courses) : r;
      return {
        ...r,
        include: isIncluded(r),
        score: current.score,
        progress: current.score === undefined ? { error: 'Enter a valid school mark in the ATAR Estimate tab.' } : r.progress,
        offset: current.score === undefined || current.raw === undefined ? 0 : current.score - wholeScore(current.raw)
      };
    });
    let currentBonus;
    try {
      const result = calc?.calculateResults ? calc.calculateResults(courses)[semIdx] : null;
      if (result && Number.isFinite(result.bonus)) currentBonus = result.bonus;
    } catch {}
    return { rows, eligible, currentBonus };
  }

  /** Every subject's and task's offsets of an ATAR goal (`subjectSliders` plus its children's task sliders). */
  function atarOffsets(goal, rows, children = []) {
    const out = {};
    for (const r of rows) {
      const notch = Number(goal.subjectSliders?.[r.id]) || 0;
      if (notch) out[r.name] = notch * POINTS_PER_NOTCH;
      const child = children.find(c => c.subject === r.id);
      if (child) Object.assign(out, offsets(child, r.name));
    }
    return out;
  }

  /** The ATAR plan over `rows` (already cut to a point in time when replaying). */
  function atarPlan(goal, rows, currentBonus, children) {
    const plan = solver().targetPlan(rows, Number(goal.target), {
      difficultyWeighted: Boolean(goal.difficultyWeighted), currentBonus, offsets: atarOffsets(goal, rows, children)
    });
    const floor = plan.effort ? -1 : 0;
    const guaranteed = !plan.error && !plan.impossible && Number(plan.parameter) <= floor + 1e-9;
    return { ...plan, guaranteed };
  }

  /** "Week 24 · Term 3 Week 4" (the term form from this year's calendar). */
  function weekLabel(week) {
    const order = window.ConnectifySchoolTerms?.weekOrder(Number(week));
    const tw = window.ConnectifyProgressMath?.termWeek(order);
    return tw ? `Week ${week} · Term ${tw.term} Week ${tw.week}` : `Week ${week}`;
  }

  /** "85% by Semester 2", "80% by Term 3 Week 4", "ATAR 95.00 by Semester 1". */
  function describe(goal) {
    const end = goal.end?.type === 'week'
      ? (weekLabel(goal.end.week).split(' · ')[1] || `Week ${goal.end.week}`)
      : `Semester ${goal.end?.semester === 1 ? 1 : 2}`;
    const target = goal.kind === 'atar' ? `ATAR ${Number(goal.target).toFixed(2)}` : `${Math.round(Number(goal.target) * 10) / 10}%`;
    return `${target} by ${end}`;
  }

  /** "Chemistry · 85% by Semester 2", or "ATAR 95.00 by Semester 1". */
  const title = goal => (goal.kind === 'atar' ? describe(goal) : `${goal.name || goal.subject} · ${describe(goal)}`);

  /** Everything an evaluation reads, gathered once: every course, ATAR courses and the cached subjects. */
  function context() {
    let allSubjects = [];
    try { allSubjects = window.ConnectifyData?.collect?.(true) || []; } catch {}
    return { courses: readCourses(false), atarCourses: readCourses(true), allSubjects };
  }

  window.ConnectifyGoalPlan = {
    weekLabel, describe, title, context,
    NOTCHES, POINTS_PER_NOTCH, notchName, isMarked, isHeld: () => held, hold, weekOf, readCourses, entryFor, semesterOf,
    rangeTasks, byWeek, asOf, points, offsets, gradePlan, requiredOf, atarRows, atarOffsets, atarPlan
  };
})();

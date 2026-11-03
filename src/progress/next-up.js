/**
 * Connectify Next Up: which tasks and what is known about them
 *
 * The two school weeks the Next Up tab lists: this week and next week by the term calendar. A week with no school in it
 * gives way to the next school week, so in the holidays the tab shows the first two weeks back, named by term and week.
 * A task belongs to the week the Task Dates list shows it in. Each task carries its weight, its prediction (the
 * Predictor's Low / Mid / High) and what an active goal asks of it. Exposes window.ConnectifyNextUp.
 */
(() => {
  'use strict';

  if (window.ConnectifyNextUp) return;

  const byText = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

  /** `today` -> up to two `{ order, label, detail }` school weeks (none past Term 4's last). */
  function weeks(today) {
    const T = window.ConnectifySchoolTerms;
    const year = today.getFullYear();
    const early = T.earlyEaster(year);
    const day = T.utc(year, today.getMonth(), today.getDate());
    const monday = T.addDays(day, -((day.getUTCDay() + 6) % 7));
    const nextMonday = T.addDays(monday, 7);
    const school = T.terms(year, early).flatMap(t => Array.from({ length: t.weeks }, (_, i) => ({
      term: t.term, week: i + 1, order: (t.term - 1) * 12 + i + 1, monday: T.addDays(t.monday, i * 7)
    })));
    return school.filter(w => w.monday >= monday).slice(0, 2).map(w => {
      const name = `Term ${w.term} Wk ${w.week}`;
      const span = `${T.formatDate(T.dateFor(year, w.term, w.week, 1, early))} – ${T.formatDate(T.dateFor(year, w.term, w.week, 5, early))}`;
      const label = +w.monday === +monday ? 'This Week' : +w.monday === +nextMonday ? 'Next Week' : null;
      return { order: w.order, label: label || name, detail: label ? `${name} ${span}` : span };
    });
  }

  function predictionOf(row, subjects) {
    if (row.completed) return null;
    try {
      const p = window.ConnectifyPredictorMath?.getOrComputeTaskPrediction?.(row.subjectName, row.task, subjects);
      return window.ConnectifyCohortForecast.isPredicted(p) ? { low: p.low, mid: p.mid, high: p.high } : null;
    } catch {
      return null;
    }
  }

  /** A row with what the tab shows of it beside the Task Dates row's own data. */
  function detailed(row, subjects, goals) {
    const prediction = predictionOf(row, subjects);
    const weight = row.task.weight;
    return {
      ...row, prediction,
      weight: Number.isFinite(weight) && weight > 0 ? weight : null,
      goal: window.ConnectifyGoalForecast?.targetForTask(row.subjectName, row.task, prediction, goals) || null
    };
  }

  /** `{ weeks: [{ order, label, detail, rows }], undated }`; undated: unmarked tasks no week can show. */
  function build(subjects, today) {
    const rows = window.ConnectifyTaskDates.rows(subjects);
    const goals = window.ConnectifyGoalStore?.all() || [];
    const list = weeks(today).map(week => ({
      ...week,
      rows: rows.filter(row => Math.floor(row.at) === week.order)
        .sort((a, b) => a.at - b.at || byText(a.subject, b.subject) || a.sequence - b.sequence)
        .map(row => detailed(row, subjects, goals))
    }));
    return { weeks: list, undated: rows.filter(row => !row.completed && !Number.isFinite(row.task.order)).length };
  }

  window.ConnectifyNextUp = { now: () => new Date(), weeks, build };
})();

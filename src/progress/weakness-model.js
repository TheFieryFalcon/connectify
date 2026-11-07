/**
 * Connectify Weaknesses: what the radar plots
 *
 * Per subject: the student's and the cohort's weighted averages. Per type: the weighted average of that type's
 * results across subjects; with "Compare against subject average" (relative) the Predictor's type shift instead, the
 * overall average plus how each result of that type sits against its own subject's average, pooled, so a weak subject
 * full of one type says nothing about the type. The cohort's means go through the same sums, so the two lines compare
 * like with like. Tasks with no type yet count towards no type's axis.
 * Exposes window.ConnectifyWeaknessModel.
 */
(() => {
  'use strict';

  const clamp = v => Math.max(0, Math.min(100, Math.round(v)));

  /** Weighted mean of a task's `key` over the tasks that have it, or null. */
  function mean(tasks, key) {
    let sw = 0, sx = 0;
    for (const t of tasks) {
      if (!Number.isFinite(t[key])) continue;
      sw += t.weight;
      sx += t.weight * t[key];
    }
    return sw > 0 ? sx / sw : null;
  }

  /** One line's value per type: overall + the type's pooled gap to each result's own subject average. */
  function typeValues(groups, key) {
    const overall = mean(groups.flatMap(g => g.tasks), key);
    const gaps = {};
    for (const { tasks } of groups) {
      const subjectAverage = mean(tasks, key);
      if (subjectAverage === null) continue;
      for (const t of tasks) {
        if (!Number.isFinite(t[key]) || t.isUnknown) continue;
        const gap = gaps[t.type] || (gaps[t.type] = { sw: 0, sx: 0 });
        gap.sw += t.weight;
        gap.sx += t.weight * (t[key] - subjectAverage);
      }
    }
    return Object.fromEntries(Object.entries(gaps).map(([type, g]) => [type, clamp(overall + g.sx / g.sw)]));
  }

  /** One line's value per type: the weighted average of that type's results, every subject together. */
  function rawTypeValues(groups, key) {
    const byType = {};
    for (const { tasks } of groups) {
      for (const t of tasks) if (Number.isFinite(t[key]) && !t.isUnknown) (byType[t.type] || (byType[t.type] = [])).push(t);
    }
    return Object.fromEntries(Object.entries(byType).map(([type, tasks]) => [type, clamp(mean(tasks, key))]));
  }

  /**
   * `groups`: `[{ label, tasks: [{ score, mean, weight, type, isUnknown }] }]`, completed weighted tasks of the
   * included subjects -> `{ labels, you, cohort, untyped }`; cohort holds null where no mean is known.
   * `relative`: types measured against each result's subject average (typeValues) instead of raw averages.
   */
  function compute(groups, mode, { relative = false } = {}) {
    const untyped = groups.reduce((n, g) => n + g.tasks.filter(t => t.isUnknown).length, 0);
    if (mode === 'subject') {
      const shown = groups.filter(g => g.tasks.length);
      return {
        labels: shown.map(g => g.label),
        you: shown.map(g => clamp(mean(g.tasks, 'score'))),
        cohort: shown.map(g => { const m = mean(g.tasks, 'mean'); return m === null ? null : clamp(m); }),
        untyped
      };
    }
    const measure = relative ? typeValues : rawTypeValues;
    const you = measure(groups, 'score');
    const cohort = measure(groups, 'mean');
    const labels = Object.keys(you);
    return { labels, you: labels.map(l => you[l]), cohort: labels.map(l => cohort[l] ?? null), untyped };
  }

  window.ConnectifyWeaknessModel = { compute };
})();

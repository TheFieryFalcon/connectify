/**
 * Connectify Goals: evaluation and replay
 *
 * Works out a goal now (plan, tier, progress, whether it has finished) and replays its judged tasks: each
 * completed task in date order is planned with only the results before it (its requirement R), then its mark
 * is added (the tier and progress as of that task). Verdicts are keyed `<subject>::<task id>`.
 * Exposes window.ConnectifyGoalReplay.
 */
(() => {
  'use strict';

  if (window.ConnectifyGoalReplay) return;

  const P = () => window.ConnectifyGoalPlan;
  const D = () => window.ConnectifyGoalDifficulty;
  const solver = () => window.ConnectifyTargetSolver || window.ConnectifyMath || {};
  const keyOf = (subject, t) => `${subject}::${t.id || t.name}`;
  const required = (plan, key) => (plan.guaranteed ? 0 : plan.impossible ? 100 : P().requiredOf(plan, key));
  const atarValue = res => {
    if (!res || res.error) return null;
    const n = Number(String(res.atar).replace('<', ''));
    return Number.isFinite(n) ? (String(res.atar).startsWith('<') ? n - 0.05 : n) : null;
  };

  /** Judged tasks: marked, weighted and not already marked when the goal was set; plus a date-order index. */
  function judgedOf(goal, list, subjectOf, ctx) {
    const prior = new Set(goal.priorMarked || []);
    const sorted = list.slice().sort(P().byWeek);
    const index = new Map(sorted.map((t, i) => [t, i]));
    const judged = ctx.noReplay ? [] : sorted.filter(t => t.weight > 0 && P().isMarked(t) && !prior.has(keyOf(subjectOf(t), t)));
    return { judged, index };
  }

  function evaluateGrade(goal, ctx) {
    const entry = P().entryFor(ctx.courses, goal.subject);
    const { tasks, undated, subject } = P().rangeTasks(goal, entry);
    if (!tasks.length) return { kind: 'grade', error: 'No tasks', undated, verdicts: {} };
    const semNum = goal.end?.type === 'week' ? 1 : goal.end?.semester === 1 ? 1 : 2;
    const target = Number(goal.target);
    const tierAt = isDone => {
      const plan = P().gradePlan(goal, tasks, subject, isDone, semNum);
      if (plan.error) return { plan, tier: null, range: null };
      const range = D().projectTasks(subject, tasks, t => P().isMarked(t) && isDone(t), ctx.allSubjects);
      const p = D().chance(target, range);
      return { plan, range, chance: p, tier: D().tierFor({ guaranteed: plan.guaranteed, impossible: plan.impossible, chance: p }) };
    };

    const now = tierAt(() => true);
    const progress = P().points(tasks, target);
    const { judged, index } = judgedOf(goal, tasks, () => goal.subject, ctx);
    const verdicts = {};
    for (const k of judged) {
      const pos = index.get(k);
      const before = P().gradePlan(goal, tasks, subject, t => index.get(t) < pos, semNum);
      const R = before.error ? null : required(before, k.id || k.name);
      const through = t => index.get(t) <= pos;
      verdicts[keyOf(goal.subject, k)] = {
        required: R, mark: k.score, perfTier: D().perfTier(k.score, R),
        progress: P().points(tasks, target, through), goalTier: tierAt(through).tier
      };
    }

    const weighted = tasks.filter(t => t.weight > 0);
    const measured = progress.total > 0 ? (progress.earned / progress.total) * 100 : null;
    const letter = goal.end?.type !== 'week' && entry[semNum]?.finalLetter;
    let finished = null;
    if (now.tier === 'guaranteed') finished = 'achieved';
    else if (now.tier === 'impossible') finished = 'missed';
    else if ((weighted.length && weighted.every(P().isMarked)) || letter) finished = measured >= target - 1e-9 ? 'achieved' : 'missed';
    return {
      kind: 'grade', ...now, progress, verdicts, undated, tasks, subject, finished, finalValue: measured,
      rangeKeys: new Set(tasks.map(t => keyOf(goal.subject, t)))
    };
  }

  /** ATAR rows with snapshot weeks on their tasks, and a way to cut every row to the results `isDone` keeps. */
  function atarSetup(goal, ctx) {
    const semIdx = goal.end?.semester === 1 ? 0 : 1;
    const included = new Set(goal.included || goal.topFour || []);
    const { rows, currentBonus } = P().atarRows(ctx.atarCourses, semIdx, r => included.has(r.id));
    for (const r of rows) r.goalTasks = (r.tasks || []).map(t => ({ ...t, ...P().weekOf(r.subject, t), course: r }));
    const cut = isDone => rows.map(r => (r.progress?.error || !r.include
      ? r
      : { ...r, progress: solver().taskProgress(P().asOf(r.goalTasks, isDone), undefined, semIdx + 1) }));
    return { rows, cut, currentBonus, semIdx };
  }

  /** Child subject targets (raw percent) from a solved plan's projected rows. */
  function childTargets(plan, rows) {
    const out = {};
    for (const r of rows) {
      const projected = (plan.rows || plan.maximum?.rows || []).find(p => p.name === r.name)?.score;
      if (Number.isFinite(projected)) out[r.id] = Math.max(0, Math.min(100, projected - (r.offset || 0)));
    }
    return out;
  }

  function evaluateAtar(goal, ctx) {
    const { rows, cut, currentBonus } = atarSetup(goal, ctx);
    const target = Number(goal.target);
    const children = ctx.children || [];
    const childRows = rows.filter(r => (goal.topFour || []).includes(r.id));
    const math = window.ConnectifyMath || {};

    // ATAR at the Low / Mid / High projection of every included course
    const atarRange = isDone => {
      const range = {};
      for (const scenario of ['low', 'mid', 'high']) {
        const projected = rows.map(r => {
          if (!r.include) return { name: r.name, include: false, score: r.score };
          const p = D().projectTasks(r.subject, r.goalTasks, t => P().isMarked(t) && isDone(t), ctx.allSubjects);
          const raw = p ? p[scenario] : r.mark;
          return { name: r.name, include: true, score: Number.isFinite(raw) ? Math.max(0, Math.min(100, raw + (r.offset || 0))) : r.score };
        });
        range[scenario] = atarValue(math.calculate?.(projected, { fixedBonus: currentBonus }));
      }
      return Number.isFinite(range.mid) ? range : null;
    };
    const childState = (plan, isDone) => {
      const targets = childTargets(plan, rows);
      const out = {};
      for (const r of childRows) {
        const t = targets[r.id];
        const pts = P().points(r.goalTasks, Number.isFinite(t) ? t : 0, isDone);
        const earnedPct = pts.total > 0 ? (pts.earned / pts.total) * 100 : 0;
        const maxPct = pts.total > 0 ? earnedPct + (r.goalTasks.filter(x => x.weight > 0 && !(P().isMarked(x) && isDone(x)))
          .reduce((s, x) => s + x.weight, 0) / pts.total) * 100 : 0;
        const p = D().chance(t, D().projectTasks(r.subject, r.goalTasks, x => P().isMarked(x) && isDone(x), ctx.allSubjects));
        out[r.id] = {
          name: r.name, target: t, progress: pts,
          tier: D().tierFor({ guaranteed: earnedPct >= t - 1e-9, impossible: t > maxPct + 1e-9, chance: p })
        };
      }
      return out;
    };

    const all = () => true;
    const now = atarPlan(goal, cut(all), currentBonus, children);
    if (now.error) return { kind: 'atar', error: now.error, plan: now, verdicts: {}, children: {} };
    const range = atarRange(all);
    const p = D().chance(target, range);
    const tier = D().tierFor({ guaranteed: now.guaranteed, impossible: now.impossible, chance: p });
    const kids = childState(now, all);

    const list = rows.filter(r => r.include).flatMap(r => r.goalTasks);
    const { judged, index } = judgedOf(goal, list.filter(t => childRows.includes(t.course)), t => t.course.id, ctx);
    const order = new Map(list.slice().sort(P().byWeek).map((t, i) => [t, i]));
    const verdicts = {};
    for (const k of judged) {
      const pos = order.get(k);
      const before = atarPlan(goal, cut(t => order.get(t) < pos), currentBonus, children);
      const R = before.error ? null : required(before, `${k.course.name}::${k.id || k.name}`);
      const through = t => order.get(t) <= pos;
      const after = atarPlan(goal, cut(through), currentBonus, children);
      const kid = after.error ? null : childState(after, through)[k.course.id];
      verdicts[keyOf(k.course.id, k)] = {
        required: R, mark: k.score, perfTier: D().perfTier(k.score, R), progress: kid?.progress || null, goalTier: kid?.tier || null
      };
    }

    const progress = Object.values(kids).reduce((s, c) => ({ earned: s.earned + c.progress.earned, required: s.required + c.progress.required }), { earned: 0, required: 0 });
    const complete = rows.filter(r => r.include).every(r => !(r.goalTasks.some(t => t.weight > 0 && !P().isMarked(t))) || r.finalLetter);
    const measured = atarValue(math.calculate?.(rows.map(r => ({ name: r.name, include: r.include, score: r.score })), { fixedBonus: currentBonus }));
    let finished = null;
    if (tier === 'guaranteed') finished = 'achieved';
    else if (tier === 'impossible') finished = 'missed';
    else if (complete && Number.isFinite(measured)) finished = measured >= target - 1e-9 ? 'achieved' : 'missed';
    return {
      kind: 'atar', plan: now, range, chance: p, tier, children: kids, progress, verdicts, finished, finalValue: measured,
      rangeKeys: new Set(childRows.flatMap(r => r.goalTasks.map(t => keyOf(r.id, t))))
    };
  }

  const atarPlan = (goal, rows, bonus, children) => P().atarPlan(goal, rows, bonus, children);

  /**
   * `ctx`: { courses, atarCourses, allSubjects, children, noReplay } (ConnectifyGoalPlan.context(); children default
   * to the stored ones; noReplay skips the per-task replay when only the goal's tier is wanted).
   */
  function evaluate(goal, ctx = P().context()) {
    if (goal.kind !== 'atar') return evaluateGrade(goal, ctx);
    const children = ctx.children || window.ConnectifyGoalStore?.childrenOf(goal.id) || [];
    return evaluateAtar(goal, { ...ctx, children });
  }

  window.ConnectifyGoalReplay = { evaluate, keyOf, atarValue, childTargets };
})();

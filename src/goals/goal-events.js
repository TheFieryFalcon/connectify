/**
 * Connectify Goals: evaluation cache and lifecycle
 *
 * Keeps every active goal's evaluation (re-worked after results, predictions, task types or goals change,
 * unless goals are held after a week change), ends goals that lock in (Guaranteed -> Achieved, Impossible ->
 * Missed) or finish (every task in range marked, or the final letter shows), freezing their verdicts, and gives
 * the Class Updated toast its goal line. A completed goal celebrates with that toast, or, when none comes, the
 * next time the Goals dialog opens. Exposes window.ConnectifyGoalEvents.
 */
(() => {
  'use strict';

  if (window.ConnectifyGoalEvents) return;

  const store = () => window.ConnectifyGoalStore;
  const P = () => window.ConnectifyGoalPlan;
  const D = () => window.ConnectifyGoalDifficulty;

  const states = new Map();
  let ctxMemo = null;
  let timer = null;
  let version = 0;

  // One context per task: every goal evaluated together reads the cache once
  function context() {
    if (!ctxMemo) {
      ctxMemo = P().context();
      setTimeout(() => { ctxMemo = null; }, 0);
    }
    return ctxMemo;
  }

  /** A goal's evaluation, cached per revision until results change (held: the last one is kept). */
  function stateOf(goal) {
    const cached = states.get(goal.id);
    if (cached && (P().isHeld() || cached.revision === goal.revision)) return cached.state;
    let state = null;
    try {
      state = window.ConnectifyGoalReplay.evaluate(goal, context());
    } catch (err) {
      console.warn('Connectify could not evaluate a goal:', err);
    }
    states.set(goal.id, { revision: goal.revision, state });
    return state;
  }

  /** Ends a goal that finished, freezing its verdicts; an achieved goal waits to celebrate. */
  function settle(goal, state) {
    if (!state?.finished || goal.status !== 'active' || P().isHeld()) return false;
    const achieved = state.finished === 'achieved';
    store().finish(goal.id, state.finished, { finalValue: state.finalValue, verdicts: state.verdicts, progress: state.progress });
    store().patch(goal.id, { finalTier: state.tier, announcePending: true, celebratePending: achieved && !goal.celebrated });
    return true;
  }

  /** Re-evaluates every active goal and settles the finished ones. */
  function refresh() {
    timer = null;
    if (P().isHeld()) return;
    states.clear();
    for (const goal of store().active().filter(g => !g.parent)) settle(goal, stateOf(goal));
    version++;
    window.dispatchEvent(new CustomEvent('connectify-goals-evaluated'));
    window.ConnectifyCohort?.schedule?.();
  }

  function invalidate() {
    if (P().isHeld()) return;
    clearTimeout(timer);
    timer = setTimeout(refresh, 400);
  }
  for (const type of ['connectify-results-updated', 'connectify-predictions-updated', 'connectify-goals-changed', 'connectify-task-type-changed', 'connectify-settings-updated']) {
    window.addEventListener(type, invalidate);
  }

  /** Plays a completed goal's celebration once and makes its card glow next time the Goals dialog opens. */
  function celebrate(goal) {
    if (goal.celebrated) return;
    store().patch(goal.id, { celebrated: true, celebratePending: false, glowPending: true });
    window.ConnectifyGoalCelebrate?.play();
  }

  /** Goals that finished with no toast to celebrate them (called when the Goals dialog opens). */
  function celebratePending() {
    const pending = store().all().find(g => g.celebratePending && !g.celebrated);
    if (pending) celebrate(pending);
  }

  /**
   * The Class Updated toast's goal line for a subject, or null: `Goal: Medium`, `Goal is now Hard (was Medium)`,
   * `Goal complete!` (with the celebration) or `Goal missed!` (`ATAR goal ...` for a subject an ATAR goal holds).
   */
  function toastLine(subjectName) {
    const key = store().subjectKey(subjectName);
    let goal = store().activeFor(subjectName);
    if (goal && !P().isHeld()) {
      states.delete(goal.id);
      ctxMemo = null;
      if (settle(goal, stateOf(goal))) goal = store().byId(goal.id);
    }
    goal = goal || store().all().find(g => !g.parent && g.announcePending && store().subjectsOf(g).includes(key));
    if (!goal) return null;
    const prefix = goal.kind === 'atar' ? 'ATAR goal' : 'Goal';
    if (goal.status !== 'active') {
      store().patch(goal.id, { announcePending: false });
      if (goal.status !== 'achieved') return `${prefix} missed!`;
      celebrate(goal);
      return `${prefix} complete!`;
    }
    const tier = stateOf(goal)?.tier;
    if (!tier) return null;
    const before = goal.lastTier;
    store().patch(goal.id, { lastTier: tier });
    return before && before !== tier ? `${prefix} is now ${D().name(tier)} (was ${D().name(before)})` : `${prefix}: ${D().name(tier)}`;
  }

  /** New school year: every active goal is judged on what is marked and ended; all goals go to the archive. */
  function endYear() {
    if (!store()) return null;
    states.clear();
    for (const goal of store().active().filter(g => !g.parent)) {
      const state = stateOf(goal);
      const measured = state?.finalValue;
      const status = state?.finished || (Number.isFinite(measured) && measured >= Number(goal.target) - 1e-9 ? 'achieved' : 'missed');
      store().finish(goal.id, status, { finalValue: Number.isFinite(measured) ? measured : null, verdicts: state?.verdicts || {}, progress: state?.progress || null });
    }
    return store().takeAll();
  }

  window.ConnectifyGoalEvents = { stateOf, refresh, invalidate, toastLine, celebratePending, celebrate, endYear, version: () => version };
  if (window.ConnectifyUtils?.isOutlinesPage()) invalidate();
})();

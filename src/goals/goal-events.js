/**
 * Connectify Goals: evaluation cache and lifecycle
 *
 * Keeps every active goal's evaluation (re-worked after results, predictions, task types or goals change,
 * unless goals are held after a week change), ends goals that lock in (Guaranteed -> Achieved, Impossible ->
 * Missed) or finish (every task in range marked, or the final letter shows), freezing their verdicts. When a
 * newly marked task is read (an outline expanded, Expand All, auto-expand) or a goal ends, a Goal Updated toast
 * of its own names the tier; a completed goal celebrates with it, or, when no toast could show, the next time
 * the Goals dialog opens. Exposes window.ConnectifyGoalEvents.
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

  /** Marked tasks in range the goal has not told the student about yet (`seenMarked`, else those marked when set). */
  const unseen = (goal, state) => {
    const seen = new Set(goal.seenMarked || goal.priorMarked || []);
    return (state?.markedKeys || []).filter(key => !seen.has(key));
  };

  // What an evaluation reads: goals, and each course's tasks and final letter. Connect re-reads a card on every
  // accordion open, so most results events change nothing; those skip the replay (a bisection per judged task)
  // and the cohort pass after it. Predictions, task types and settings always re-evaluate (`stale`).
  let lastInputs = null;
  let stale = true;
  function inputsOf(ctx) {
    const goals = store().all().map(g => [g.id, g.revision, g.status]);
    const courses = [...ctx.courses, ...ctx.atarCourses].flat().map(c => [c.id, c.finalLetter || '', c.mark,
      (c.tasks || []).map(t => [t.id || t.name, t.score, t.weight, t.order, t.pending ? 1 : 0])]);
    return JSON.stringify([goals, courses]);
  }

  /** Re-evaluates every active goal, settles the finished ones and announces the ones with new results. */
  function refresh() {
    timer = null;
    if (P().isHeld()) return;
    const inputs = inputsOf(context());
    if (!stale && inputs === lastInputs) return;
    stale = false;
    lastInputs = inputs;
    states.clear();
    for (const goal of store().active().filter(g => !g.parent)) {
      const state = stateOf(goal);
      const fresh = unseen(goal, state);
      const ended = settle(goal, state);
      if (!fresh.length && !ended) continue;
      store().patch(goal.id, { seenMarked: state?.markedKeys || [] });
      announce(store().byId(goal.id), fresh);
    }
    version++;
    window.dispatchEvent(new CustomEvent('connectify-goals-evaluated'));
    window.ConnectifyCohort?.schedule?.();
  }

  function invalidate(event) {
    if (P().isHeld()) return;
    if (event && !['connectify-results-updated', 'connectify-goals-changed'].includes(event.type)) stale = true;
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
   * The goal's toast line: `Goal: Medium`, `Goal is now Hard (was Medium)`, `Goal complete!` (with the
   * celebration) or `Goal missed!` (`ATAR goal ...` for an ATAR goal). Remembers the tier it named.
   */
  function lineFor(goal) {
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

  /** The outline card of the subject a new result belongs to (the later semester's), for Jump to Subject. */
  function cardFor(subject) {
    const cards = Array.from(document.querySelectorAll('.eds-c-tile')).filter(card =>
      store().subjectKey(card.querySelector('.eds-c-tile__title, .cvr-c-tile__title')?.textContent || '') === subject);
    return cards[cards.length - 1] || null;
  }

  /** The Goal Updated toast (one per goal at a time): the goal, and its line under it. */
  function announce(goal, fresh = []) {
    const line = lineFor(goal);
    if (!line) return;
    const card = cardFor((fresh[fresh.length - 1] || '').split('::')[0] || goal.subject);
    const actions = [{ text: 'Dismiss', type: 'secondary', onClick: ({ close }) => close() }];
    if (card && window.ConnectifyNewGrade?.jumpToSubject) actions.push({ text: 'Jump to Subject', type: 'accent', onClick: () => window.ConnectifyNewGrade.jumpToSubject(card) });
    window.ConnectifyNotifications?.show?.({
      id: `connectify-goal-${goal.id}`, type: 'grade', title: 'Goal Updated', message: P().title(goal), details: [line], duration: 12000, actions
    });
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

  window.ConnectifyGoalEvents = { stateOf, refresh, invalidate, lineFor, announce, celebratePending, celebrate, endYear, version: () => version };
  if (window.ConnectifyUtils?.isOutlinesPage()) invalidate();
})();

/**
 * Connectify Goals: Set as Goal, in the planner
 *
 * Saving a plan as a goal happens on the planner itself, whose task table and sliders stay live: the End (Semester
 * 1 / 2, which are the planner's semester buttons, or a custom school week for grade goals), which goal-editor.js puts
 * beside the planner's inputs, and Confirm (Save Changes when editing) where Set as Goal was; what the plan needs and
 * how far along it is are on the planner already. Confirm is disabled, with the reason, for a goal
 * already secured or out of reach and for one that clashes with an ATAR goal; a plan for a subject that has a goal
 * changes that goal (same id, tasks it has judged and notices kept), and an ATAR goal over subject goals asks to
 * replace them. Exposes window.ConnectifyGoalCompose.
 */
(() => {
  'use strict';

  if (window.ConnectifyGoalCompose) return;

  const M = () => window.ConnectifyGoalModal;
  const P = () => window.ConnectifyGoalPlan;
  const store = () => window.ConnectifyGoalStore;
  const keyOf = (...args) => window.ConnectifyGoalReplay.keyOf(...args);

  // A planner re-render replaces these controls, so the one in use gets focus back
  let refocus = null;

  /** Marked tasks of the goal's subjects now: they are judged by earlier goals, never this one. */
  function markedNow(goal, ctx) {
    const keys = new Set();
    for (const subject of store().subjectsOf(goal)) {
      for (const course of [ctx.courses[0], ctx.courses[1]].map(list => list?.find(c => c.id === subject)).filter(Boolean)) {
        for (const t of course.tasks || []) if (P().isMarked(t)) keys.add(keyOf(subject, t));
      }
    }
    return [...keys];
  }

  /** Why Confirm is disabled (text), or null. */
  function blocker(goal, state) {
    if (state.error) return { text: state.error === 'No tasks' ? 'No assessments up to that week.' : state.error };
    if (state.plan?.error) return { text: state.plan.error };
    if (state.tier === 'guaranteed') return { text: 'Already secured.' };
    if (state.tier === 'impossible') {
      const max = goal.kind === 'atar' ? state.plan?.maximum?.atar : M().round1(state.plan?.maximum);
      return { text: `Highest possible: ${max}${goal.kind === 'atar' ? '' : '%'}.` };
    }
    const clash = store().conflicts(goal);
    if (clash.atar) return { text: 'You already have an ATAR goal.' };
    const other = clash.subjects[0]?.goal;
    if (other?.kind === 'atar' && goal.kind !== 'atar') return { text: `Set by your ATAR ${Number(other.target).toFixed(2)} goal.` };
    return null;
  }

  /**
   * The controls for draft `goal` (a saved goal it changes means editing). `onEnd(end)`: another end was picked; the
   * planner applies it and draws again. `isClosed(semester)`: that semester's button is disabled. `lockEnd`: the
   * end cannot change (ATAR-held subject). `cancelLabel` names the way out.
   */
  function create({ goal, lockEnd = false, onEnd, isClosed, onSaved, onCancel, cancelLabel = 'Cancel' }) {
    const saved = store().current(goal);
    const isEdit = Boolean(saved);
    const draft = { ...(saved || {}), ...goal, id: saved?.id, end: { ...(goal.end || { type: 'semester', semester: 2 }) } };
    const ctx = P().context();
    const node = M().el('div', 'cx-goal-compose');

    const endRow = M().el('div', 'cx-goal-end');
    const endSelect = M().el('select', 'cx-settings-select cx-goal-end-select');
    const options = [['1', 'Semester 1'], ['2', 'Semester 2']].concat(draft.kind === 'atar' ? [] : [['week', 'Custom week…']]);
    for (const [value, text] of options) {
      const option = M().el('option', '', text);
      option.value = value;
      if (value !== 'week' && isClosed?.(Number(value))) option.disabled = true;
      endSelect.append(option);
    }
    const custom = draft.end.type === 'week';
    endSelect.value = custom ? 'week' : String(draft.end.semester === 1 ? 1 : 2);
    endSelect.disabled = lockEnd;
    const endLabel = M().el('label', 'cta-target-label cx-goal-end-label', 'End ');
    endLabel.append(endSelect);
    endRow.append(endLabel);
    const week = M().el('input', 'cta-score cx-goal-week');
    if (custom) {
      Object.assign(week, { type: 'number', min: '1', max: '40', step: '1' });
      week.setAttribute('aria-label', 'End week');
      week.value = String(draft.end.week || 20);
      week.disabled = lockEnd;
      endRow.append(week, M().el('span', 'cx-goal-week-hint', P().weekTerm(draft.end.week || 20)));
    }

    const state = window.ConnectifyGoalReplay.evaluate(draft, { ...ctx, noReplay: true });
    const undated = state.undated?.length ? M().el('p', 'cta-note', `No week: ${state.undated.join(', ')}. Set one in Task Dates.`) : null;
    const block = blocker(draft, state);
    const reason = M().el('p', 'cx-goal-reason', block ? block.text : '');
    reason.setAttribute('aria-live', 'polite');

    const actions = M().el('div', 'cx-goal-actions');
    const confirm = M().el('button', 'cx-goal-confirm', isEdit ? 'Save Changes' : 'Confirm');
    confirm.type = 'button';
    confirm.disabled = Boolean(block);
    const cancel = M().el('button', 'cx-goal-cancel-edit', cancelLabel);
    cancel.type = 'button';
    actions.append(confirm, cancel);
    node.append(...[undated, reason, actions].filter(Boolean));

    const save = () => {
      for (const clash of store().conflicts(draft).subjects) if (clash.goal.kind !== 'atar') store().remove(clash.goal.id);
      // An edit keeps what the goal judges; it is no new result, so the toast's next "was" tier starts from the edit
      const marked = markedNow(draft, ctx);
      store().save({ ...draft, ...(isEdit ? { seenMarked: marked, lastTier: state.tier } : { priorMarked: marked }) });
      onSaved?.();
    };
    confirm.addEventListener('click', () => {
      const replace = draft.kind === 'atar' ? store().conflicts(draft).subjects.filter(c => c.goal.kind !== 'atar') : [];
      if (!replace.length) return save();
      const [first] = replace;
      const names = replace.map(c => window.ConnectifyGoalPlan.shownName(c.goal)).join(', ');
      reason.replaceChildren(`${names} already ${replace.length > 1 ? 'have goals' : `has a goal (${P().describe(first.goal)})`}. Replace ${replace.length > 1 ? 'them' : 'it'}?`);
      const yes = M().el('button', 'cx-goal-confirm', 'Replace');
      const back = M().el('button', 'cx-goal-cancel-edit', 'Back');
      yes.type = back.type = 'button';
      yes.addEventListener('click', save);
      back.addEventListener('click', () => {
        reason.replaceChildren(block ? block.text : '');
        actions.replaceChildren(confirm, cancel);
      });
      actions.replaceChildren(yes, back);
      yes.focus();
    });
    cancel.addEventListener('click', () => onCancel?.());

    endSelect.addEventListener('change', () => {
      refocus = 'end';
      if (endSelect.value === 'week') onEnd?.({ type: 'week', week: draft.end.week || 20 });
      else onEnd?.({ type: 'semester', semester: Number(endSelect.value) });
    });
    // On commit, not per key: applying the end redraws the planner, which would drop a week being typed
    week.addEventListener('change', () => {
      refocus = 'week';
      onEnd?.({ type: 'week', week: Math.max(1, Math.min(40, Math.round(Number(week.value) || 20))) });
    });

    const focused = refocus === 'end' ? endSelect : refocus === 'week' ? week : null;
    refocus = null;
    return { node, endRow, state, focus: () => focused?.focus?.() };
  }

  window.ConnectifyGoalCompose = { create, blocker, markedNow };
})();

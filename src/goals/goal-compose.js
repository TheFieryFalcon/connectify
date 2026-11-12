/**
 * Connectify Goals: Set as Goal, in the planner
 *
 * Set as Goal saves the plan at once (`quickSave`) when it replaces nothing, ending on the planner's semester. The
 * controls below open on the planner itself, whose task table and sliders stay live, only where more is needed:
 * Custom End (a school week for grade goals), a save that is blocked (the reason under a disabled Confirm: a goal
 * already secured or out of reach, one that clashes with an ATAR goal), an ATAR goal over subject goals (asks to
 * Replace them) and Update Goal (Save Changes: same id, tasks it has judged and notices kept). The End (Semester 1 /
 * 2, which are the planner's semester buttons, or a custom week) goes beside the planner's inputs (goal-editor.js).
 * Exposes window.ConnectifyGoalCompose.
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

  /** Draft `goal` as it would be saved: the goal it changes, its plan's state and why it cannot be saved. */
  function prepare(goal) {
    const saved = store().current(goal);
    const draft = { ...(saved || {}), ...goal, id: saved?.id, end: { ...(goal.end || { type: 'semester', semester: 2 }) } };
    const ctx = P().context();
    const state = window.ConnectifyGoalReplay.evaluate(draft, { ...ctx, noReplay: true });
    return { isEdit: Boolean(saved), draft, ctx, state, block: blocker(draft, state) };
  }

  /** Subject goals an ATAR draft would replace. */
  const replaced = draft => (draft.kind === 'atar' ? store().conflicts(draft).subjects.filter(c => c.goal.kind !== 'atar') : []);

  function commit({ isEdit, draft, ctx, state }) {
    for (const clash of store().conflicts(draft).subjects) if (clash.goal.kind !== 'atar') store().remove(clash.goal.id);
    // An edit keeps what the goal judges; it is no new result, so the toast's next "was" tier starts from the edit
    const marked = markedNow(draft, ctx);
    store().save({ ...draft, ...(isEdit ? { seenMarked: marked, lastTier: state.tier } : { priorMarked: marked }) });
  }

  /** Set as Goal's one click: `'saved'`, or why the controls must open (`'blocked'`, `'replace'`, `'edit'`). */
  function quickSave(goal) {
    const prep = prepare(goal);
    if (prep.isEdit) return 'edit';
    if (prep.block) return 'blocked';
    if (replaced(prep.draft).length) return 'replace';
    commit(prep);
    return 'saved';
  }

  /**
   * The controls for draft `goal` (a saved goal it changes means editing). `onEnd(end)`: another end was picked; the
   * planner applies it and draws again. `isClosed(semester)`: that semester's button is disabled. `lockEnd`: the
   * end cannot change (ATAR-held subject). `cancelLabel` names the way out. `ask`: open on the Replace question.
   */
  function create({ goal, lockEnd = false, onEnd, isClosed, onSaved, onCancel, cancelLabel = 'Cancel', ask = false }) {
    const prep = prepare(goal);
    const { isEdit, draft, state, block } = prep;
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

    const undated = state.undated?.length ? M().el('p', 'cta-note', `No week: ${state.undated.join(', ')}. Set one in Task Dates.`) : null;
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
      commit(prep);
      onSaved?.();
    };
    const askReplace = () => {
      const replace = replaced(draft);
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
    };
    confirm.addEventListener('click', askReplace);
    if (ask && !block && replaced(draft).length) askReplace();
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

  window.ConnectifyGoalCompose = { create, quickSave, blocker, markedNow };
})();

/**
 * Connectify Goals: Set as Goal dialog (#cx-goal-dialog)
 *
 * A preview of the goal the planner describes (target and tier, the tasks or subjects it covers with their
 * effort, required mark and tier, progress so far), its End (Semester 1 / 2, or a custom school week for grade
 * goals) and Confirm (Save Changes when editing). Confirm is disabled, with the reason, for a goal already
 * secured or out of reach and for one that clashes with an ATAR goal; a grade goal for a subject that has one
 * asks to overwrite it (Confirm replaces it), and an ATAR goal over subject goals asks to replace them.
 * Exposes window.ConnectifyGoalDialog.
 */
(() => {
  'use strict';

  if (window.ConnectifyGoalDialog) return;

  const M = () => window.ConnectifyGoalModal;
  const P = () => window.ConnectifyGoalPlan;
  const D = () => window.ConnectifyGoalDifficulty;
  const store = () => window.ConnectifyGoalStore;
  const keyOf = (...args) => window.ConnectifyGoalReplay.keyOf(...args);

  const goalName = goal => (goal.kind === 'atar' ? 'ATAR' : goal.name || goal.subject);

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

  function previewRows(goal, state, ctx) {
    const table = M().el('table', 'cta-grade-table cx-goal-preview-table');
    const head = M().el('tr');
    [goal.kind === 'atar' ? 'Subject' : 'Assessment', 'Effort', 'Needs', 'Difficulty'].forEach(t => head.append(M().el('th', '', t)));
    table.append(head);
    const add = (name, notch, needs, tier) => {
      const row = M().el('tr');
      const tierCell = M().el('td');
      tierCell.append(M().tierLabel(tier));
      row.append(M().el('td', '', name), M().el('td', '', P().notchName(notch)), M().el('td', '', Number.isFinite(needs) ? `${M().round1(needs)}%` : '—'), tierCell);
      table.append(row);
    };
    if (goal.kind === 'atar') {
      for (const [id, child] of Object.entries(state.children || {})) add(child.name, goal.subjectSliders?.[id], child.target, child.tier);
    } else {
      for (const t of (state.tasks || []).filter(x => x.weight > 0 && !P().isMarked(x))) {
        const key = t.id || t.name;
        const required = state.plan?.impossible ? null : P().requiredOf(state.plan || {}, key);
        add(t.name, goal.sliders?.[key], required, D().taskTier(required, D().predictionFor(state.subject, t, ctx.allSubjects)));
      }
    }
    return table.children.length > 1 ? table : null;
  }

  /** Why Confirm is disabled (text), or a question Confirm answers (`overwrite`: the subject goal it replaces), or null. */
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
    if (other && goal.kind !== 'atar') {
      return other.kind === 'atar'
        ? { text: `Set by your ATAR ${Number(other.target).toFixed(2)} goal.` }
        : { text: `${goalName(goal)} already has a goal. Overwrite?`, overwrite: other };
    }
    return null;
  }

  /** Opens the dialog for a draft `goal` (an id means editing). `lockEnd`: the end cannot change (ATAR-held subject). */
  function open({ goal, opener, lockEnd = false, onSaved }) {
    const isEdit = Boolean(goal.id && store().byId(goal.id));
    const draft = { ...goal, end: { ...(goal.end || { type: 'semester', semester: 2 }) } };
    M().open({
      id: 'cx-goal-dialog',
      title: isEdit ? 'Update Goal' : 'Set as Goal',
      opener,
      build: (body, close) => {
        const ctx = P().context();
        const headLine = M().el('div', 'cx-goal-preview-head');
        const endRow = M().el('div', 'cx-goal-end');
        const endSelect = M().el('select', 'cx-settings-select cx-goal-end-select');
        const options = [['1', 'Semester 1'], ['2', 'Semester 2']].concat(draft.kind === 'atar' ? [] : [['week', 'Custom week…']]);
        for (const [value, text] of options) {
          const option = M().el('option', '', text);
          option.value = value;
          endSelect.append(option);
        }
        endSelect.value = draft.end.type === 'week' ? 'week' : String(draft.end.semester === 1 ? 1 : 2);
        const weekInput = M().el('input', 'cta-score cx-goal-week');
        Object.assign(weekInput, { type: 'number', min: '1', max: '40', step: '1' });
        weekInput.setAttribute('aria-label', 'End week');
        weekInput.value = String(draft.end.week || 20);
        const weekHint = M().el('span', 'cx-goal-week-hint');
        endSelect.disabled = weekInput.disabled = lockEnd;
        const endLabel = M().el('label', 'cx-goal-end-label', 'End ');
        endLabel.append(endSelect);
        endRow.append(endLabel, weekInput, weekHint);
        const preview = M().el('div', 'cx-goal-preview');
        const reason = M().el('p', 'cx-goal-reason');
        reason.setAttribute('aria-live', 'polite');
        const actions = M().el('div', 'cx-goal-dialog-actions');
        const cancel = M().el('button', 'cx-goal-cancel', 'Cancel');
        cancel.type = 'button';
        const confirm = M().el('button', 'cx-goal-confirm', isEdit ? 'Save Changes' : 'Confirm');
        confirm.type = 'button';
        actions.append(cancel, confirm);
        body.append(headLine, endRow, preview, reason, actions);

        const render = () => {
          const custom = endSelect.value === 'week';
          const week = Math.max(1, Math.min(40, Math.round(Number(weekInput.value) || 20)));
          draft.end = custom ? { type: 'week', week } : { type: 'semester', semester: Number(endSelect.value) };
          weekInput.hidden = weekHint.hidden = !custom;
          weekHint.textContent = custom ? P().weekLabel(week).split(' · ')[1] || '' : '';
          const state = window.ConnectifyGoalReplay.evaluate(draft, { ...ctx, noReplay: true });
          headLine.replaceChildren(M().el('strong', '', P().title(draft)), ' ', M().tierLabel(state.tier));
          const points = draft.kind === 'atar' ? null : M().el('span', 'cx-goal-points', M().pointsText(state.progress));
          preview.replaceChildren(...[previewRows(draft, state, ctx), M().progressBar(state.progress, state.tier), points].filter(Boolean));
          if (state.undated?.length) preview.append(M().el('p', 'cta-note', `No week: ${state.undated.join(', ')}. Set one in the Progress table.`));
          const block = blocker(draft, state);
          reason.replaceChildren(block ? block.text : '');
          confirm.disabled = Boolean(block) && !block.overwrite;
        };

        const save = () => {
          for (const clash of store().conflicts(draft).subjects) if (clash.goal.kind !== 'atar') store().remove(clash.goal.id);
          store().save({ ...draft, priorMarked: isEdit ? draft.priorMarked || [] : markedNow(draft, ctx) });
          close();
          onSaved?.();
        };
        confirm.addEventListener('click', () => {
          const replace = draft.kind === 'atar' ? store().conflicts(draft).subjects.filter(c => c.goal.kind !== 'atar') : [];
          if (!replace.length) return save();
          const [first] = replace;
          const names = replace.map(c => c.goal.name || c.subject).join(', ');
          reason.replaceChildren(`${names} already ${replace.length > 1 ? 'have goals' : `has a goal (${P().describe(first.goal)})`}. Replace ${replace.length > 1 ? 'them' : 'it'}?`);
          const yes = M().el('button', 'cx-goal-confirm', 'Replace');
          const back = M().el('button', 'cx-goal-cancel', 'Back');
          yes.type = back.type = 'button';
          yes.addEventListener('click', save);
          back.addEventListener('click', () => { actions.replaceChildren(cancel, confirm); render(); });
          actions.replaceChildren(back, yes);
          yes.focus();
        });
        cancel.addEventListener('click', close);
        endSelect.addEventListener('change', render);
        weekInput.addEventListener('input', render);
        render();
      }
    });
  }

  window.ConnectifyGoalDialog = { open, blocker, markedNow };
})();

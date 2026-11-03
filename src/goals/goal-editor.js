/**
 * Connectify Goals: planner controls
 *
 * Adds to the Goal Setter's planners: the goal tier beside each plan's headline, Set as Goal (Update Goal while
 * editing), which opens the end and Confirm on the planner itself (goal-compose.js), and the Goals (n) button in
 * the panel heading. A custom end week narrows the planner's own task table to that range. Edit loads a saved goal
 * into its planner tab. A subject an ATAR goal holds plans for the target that goal gives it.
 * Exposes window.ConnectifyGoalEditor.
 */
(() => {
  'use strict';

  if (window.ConnectifyGoalEditor) return;

  const M = () => window.ConnectifyGoalModal;
  const P = () => window.ConnectifyGoalPlan;
  const S = () => window.ConnectifyGoalSliders;
  const store = () => window.ConnectifyGoalStore;
  const stateOf = goal => window.ConnectifyGoalEvents?.stateOf(goal) || window.ConnectifyGoalReplay.evaluate(goal);

  // The goal each tab is editing ({ goal, before }: the planner as it was, for Cancel Editing)
  const editing = { grade: null, target: null };
  const latest = { grade: null, target: null };
  // Set as Goal open on a tab: { week } (a custom end week, null for the planner's semester)
  const composing = { grade: null, target: null };
  let status = { kind: null, until: 0 };

  /** `{ target, goal }` when an active ATAR goal holds the subject, else null. */
  function heldTarget(subject) {
    const goal = store()?.activeFor(subject);
    if (!goal || goal.kind !== 'atar') return null;
    const target = stateOf(goal)?.children?.[subject]?.target;
    return Number.isFinite(target) ? { target: Math.round(target * 10) / 10, goal } : null;
  }

  /** The Goals (n) button in the panel heading, shown with the Goal Setter's tabs only. */
  function paintGoalsButton(show) {
    const heading = document.querySelector('#connectea-atar .cta-heading');
    if (!heading) return;
    let btn = heading.querySelector('#cx-goals-open');
    if (!btn) {
      btn = M().el('button', 'cx-goals-open');
      btn.type = 'button';
      btn.id = 'cx-goals-open';
      btn.addEventListener('click', () => window.ConnectifyGoalListUI?.open(btn));
      heading.append(btn);
    }
    const goals = store()?.all().filter(g => !g.parent) || [];
    btn.textContent = `Goals (${goals.filter(g => g.status === 'active').length})`;
    btn.disabled = !goals.length;
    btn.hidden = !show;
  }
  window.addEventListener('connectify-goals-changed', () => {
    const btn = document.getElementById('cx-goals-open');
    if (btn) paintGoalsButton(!btn.hidden);
  });

  const endOf = (kind, ctx) => (composing[kind]?.week
    ? { type: 'week', week: composing[kind].week }
    : { type: 'semester', semester: ctx.getActiveSemester() + 1 });

  const semesterButton = idx => document.querySelectorAll('#connectea-atar .cta-semester')[idx];

  function gradeDraft({ refs, ctx, course }) {
    const id = editing.grade?.goal.id;
    return {
      ...(editing.grade?.goal || {}), id, kind: 'grade', subject: course.id, name: course.name,
      target: Number(refs.gradeTargetInput.value), end: endOf('grade', ctx),
      difficultyWeighted: Boolean(refs.difficultyCheckbox.checked), sliders: { ...S().gradeSliders(course.id) }
    };
  }

  function atarDraft({ refs, ctx, plan, rows }) {
    const topFour = (plan.result?.top || []).map(t => rows.find(r => r.name === t.name)?.id).filter(Boolean);
    return {
      ...(editing.target?.goal || {}), id: editing.target?.goal.id, kind: 'atar', target: Number(refs.targetInput.value),
      end: endOf('target', ctx), difficultyWeighted: Boolean(refs.difficultyCheckbox.checked),
      subjectSliders: { ...S().atarSliders() }, included: rows.filter(r => r.include).map(r => r.id), topFour,
      childSliders: S().childSliders(topFour)
    };
  }

  const redraw = (kind, info) => (kind === 'target' ? info.ctx.renderTargetOutput() : info.ctx.renderGradeOutput());

  const formOf = container => container.parentElement?.querySelector('.cta-form-controls');
  /** Takes the end out of the planner's inputs: each render puts it back only while Set as Goal is open. */
  function clearEnd(container) {
    formOf(container)?.querySelector('.cx-goal-end')?.remove();
  }

  /** Tier beside the headline, then Set as Goal / Update Goal, or Confirm with the end beside the inputs, and the saved status. */
  function controls(container, kind, info, draftFor) {
    const headline = container.querySelector('strong');
    const draft = draftFor(info);
    let tier = null;
    try { tier = info.plan.error ? null : window.ConnectifyGoalReplay.evaluate(draft, { ...P().context(), noReplay: true })?.tier; } catch {}
    if (headline && tier) headline.append(' ', M().tierLabel(tier));

    const edit = editing[kind];
    if (edit) container.prepend(M().el('p', 'cx-goal-editing', `Editing ${kind === 'target' ? 'ATAR' : edit.goal.name || 'subject'} goal`));
    else if (info.held) container.prepend(M().el('p', 'cx-goal-editing', `Set by your ATAR ${Number(info.held.goal.target).toFixed(2)} goal`));

    if (composing[kind]) {
      const goal = info.held ? { ...info.held.goal, childSliders: S().childSliders(info.held.goal.topFour || []) } : draft;
      const compose = window.ConnectifyGoalCompose.create({
        goal, lockEnd: Boolean(info.held), cancelLabel: edit ? 'Cancel Editing' : 'Cancel',
        isClosed: semester => Boolean(semesterButton(semester - 1)?.disabled),
        onEnd: end => {
          composing[kind] = { week: end.type === 'week' ? end.week : null };
          if (end.type === 'semester' && info.ctx.getActiveSemester() !== end.semester - 1) semesterButton(end.semester - 1)?.click();
          else redraw(kind, info);
        },
        onSaved: () => saved(kind, info),
        onCancel: () => stopEditing(kind, info, Boolean(edit))
      });
      container.append(compose.node);
      formOf(container)?.querySelector('.cta-reset')?.after(compose.endRow);
      compose.focus();
      return;
    }

    const bar = M().el('div', 'cx-goal-actions');
    const setBtn = M().el('button', 'cx-goal-set', info.held ? 'Update Goal' : 'Set as Goal');
    setBtn.type = 'button';
    setBtn.disabled = Boolean(info.plan.error) || !window.ConnectifyUtils.isOutlinesPage();
    setBtn.addEventListener('click', () => {
      composing[kind] = { week: null };
      redraw(kind, info);
    });
    bar.append(setBtn);
    if (status.kind === kind && Date.now() < status.until) bar.append(M().el('span', 'cx-goal-status', 'Goal set.'));
    container.append(bar);
  }

  function saved(kind, info) {
    status = { kind, until: Date.now() + 3000 };
    stopEditing(kind, info, false);
    setTimeout(() => redraw(kind, info), 3050);
  }

  function stopEditing(kind, info, restore) {
    const edit = editing[kind];
    editing[kind] = null;
    composing[kind] = null;
    if (restore && edit?.before) edit.before();
    redraw(kind, info);
  }

  // A custom end week: the planner's table and headline show that range, never a second copy of the plan
  function narrowToEnd(container, info) {
    if (!composing.grade?.week) return;
    const state = window.ConnectifyGoalReplay.evaluate(gradeDraft(info), { ...P().context(), noReplay: true });
    const table = container.querySelector('.cx-goal-tasks');
    if (state.error || !state.plan || state.plan.error || !table) return;
    const parent = table.parentElement;
    table.remove();
    const tasks = (state.tasks || []).filter(t => !P().isMarked(t));
    S().renderGradeTasks(parent, { course: { ...info.course, progress: { tasks } }, plan: state.plan, onChange: () => info.ctx.renderGradeOutput() });
    const headline = container.querySelector('strong');
    if (headline && Number.isFinite(state.plan.required)) {
      headline.textContent = `Requires scores averaging ${M().round1(state.plan.required)}% on assessments up to Week ${composing.grade.week} to achieve ${info.refs.gradeTargetInput.value}% overall.`;
    }
  }

  function afterGrade(container, info) {
    latest.grade = info;
    narrowToEnd(container, info);
    controls(container, 'grade', info, gradeDraft);
  }

  function afterTarget(container, info) {
    latest.target = info;
    controls(container, 'target', info, atarDraft);
  }

  /** Loads a saved goal into its planner tab (grade goals: subject, target, semester, checkbox, sliders). */
  function edit(goal) {
    const kind = goal.kind === 'atar' ? 'target' : 'grade';
    window.ConnectifyAtar?.openCalculator?.(kind);
    const info = latest[kind];
    if (!info) return;
    const { refs } = info;
    const semIdx = P().semesterOf(goal) - 1;
    composing[kind] = { week: goal.end?.type === 'week' ? goal.end.week : null };
    if (kind === 'grade') {
      const before = { subject: refs.gradeSelectedSubjects.slice(), target: refs.gradeTargetInput.value, checked: refs.difficultyCheckbox.checked, sliders: { ...S().gradeSliders(goal.subject) } };
      editing.grade = { goal, before: () => { refs.gradeSelectedSubjects.splice(0, 2, ...before.subject); refs.gradeTargetInput.value = before.target; refs.difficultyCheckbox.checked = before.checked; S().setGrade(goal.subject, before.sliders); } };
      refs.gradeSelectedSubjects[semIdx] = goal.subject;
      refs.gradeTargetInput.value = String(goal.target);
      refs.difficultyCheckbox.checked = Boolean(goal.difficultyWeighted);
      S().setGrade(goal.subject, goal.sliders);
    } else {
      const before = { target: refs.targetInput.value, checked: refs.difficultyCheckbox.checked, sliders: { ...S().atarSliders() } };
      editing.target = { goal, before: () => { refs.targetInput.value = before.target; refs.difficultyCheckbox.checked = before.checked; S().setAtar(before.sliders); } };
      refs.targetInput.value = String(goal.target);
      refs.difficultyCheckbox.checked = Boolean(goal.difficultyWeighted);
      S().setAtar(goal.subjectSliders);
      for (const child of store().childrenOf(goal.id)) S().setGrade(child.subject, child.sliders);
    }
    if (info.ctx.getActiveSemester() !== semIdx) semesterButton(semIdx)?.click();
    else if (kind === 'target') info.ctx.renderTargetOutput();
    else info.ctx.renderGradeOutput();
  }

  window.ConnectifyGoalEditor = { heldTarget, paintGoalsButton, afterGrade, afterTarget, clearEnd, edit, isEditing: kind => Boolean(editing[kind]), isComposing: kind => Boolean(composing[kind]) };
})();

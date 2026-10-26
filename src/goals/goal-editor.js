/**
 * Connectify Goals: planner controls
 *
 * Adds to the Goal Setter's planners: the goal tier beside each plan's headline, Set as Goal (Update Goal while
 * editing) with Cancel Editing, and the Goals (n) button in the panel heading. Edit loads a saved goal into its
 * planner tab. A subject an ATAR goal holds plans for the target that goal gives it.
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

  function gradeDraft({ refs, ctx, course }) {
    const id = editing.grade?.goal.id;
    return {
      ...(editing.grade?.goal || {}), id, kind: 'grade', subject: course.id, name: course.name,
      target: Number(refs.gradeTargetInput.value), end: editing.grade?.goal.end || { type: 'semester', semester: ctx.getActiveSemester() + 1 },
      difficultyWeighted: Boolean(refs.difficultyCheckbox.checked), sliders: { ...S().gradeSliders(course.id) }
    };
  }

  function atarDraft({ refs, ctx, plan, rows }) {
    const topFour = (plan.result?.top || []).map(t => rows.find(r => r.name === t.name)?.id).filter(Boolean);
    return {
      ...(editing.target?.goal || {}), id: editing.target?.goal.id, kind: 'atar', target: Number(refs.targetInput.value),
      end: { type: 'semester', semester: ctx.getActiveSemester() + 1 }, difficultyWeighted: Boolean(refs.difficultyCheckbox.checked),
      subjectSliders: { ...S().atarSliders() }, included: rows.filter(r => r.include).map(r => r.id), topFour,
      childSliders: S().childSliders(topFour)
    };
  }

  /** Tier beside the headline, then Set as Goal / Update Goal, Cancel Editing and the saved status. */
  function controls(container, kind, info, draftFor) {
    const headline = container.querySelector('strong');
    const draft = draftFor(info);
    let tier = null;
    try { tier = info.plan.error ? null : window.ConnectifyGoalReplay.evaluate(draft, { ...P().context(), noReplay: true })?.tier; } catch {}
    if (headline && tier) headline.append(' ', M().tierLabel(tier));

    const bar = M().el('div', 'cx-goal-actions');
    const edit = editing[kind];
    if (edit) container.prepend(M().el('p', 'cx-goal-editing', `Editing ${kind === 'target' ? 'ATAR' : edit.goal.name || 'subject'} goal`));
    else if (info.held) container.prepend(M().el('p', 'cx-goal-editing', `Set by your ATAR ${Number(info.held.goal.target).toFixed(2)} goal`));
    const setBtn = M().el('button', 'cx-goal-set', edit || info.held ? 'Update Goal' : 'Set as Goal');
    setBtn.type = 'button';
    setBtn.disabled = Boolean(info.plan.error) || !window.ConnectifyUtils.isOutlinesPage();
    setBtn.addEventListener('click', () => {
      const goal = info.held ? { ...info.held.goal, childSliders: S().childSliders(info.held.goal.topFour || []) } : draftFor(info);
      window.ConnectifyGoalDialog.open({ goal, opener: setBtn, lockEnd: Boolean(info.held), focusSubject: info.held ? info.course.id : null, onSaved: () => saved(kind, info) });
    });
    bar.append(setBtn);
    if (edit) {
      const cancel = M().el('button', 'cx-goal-cancel-edit', 'Cancel Editing');
      cancel.type = 'button';
      cancel.addEventListener('click', () => stopEditing(kind, info, true));
      bar.append(cancel);
    }
    if (status.kind === kind && Date.now() < status.until) bar.append(M().el('span', 'cx-goal-status', 'Goal set.'));
    container.append(bar);
  }

  function saved(kind, info) {
    status = { kind, until: Date.now() + 3000 };
    stopEditing(kind, info, false);
    setTimeout(() => (kind === 'target' ? info.ctx.renderTargetOutput() : info.ctx.renderGradeOutput()), 3050);
  }

  function stopEditing(kind, info, restore) {
    const edit = editing[kind];
    editing[kind] = null;
    if (restore && edit?.before) edit.before();
    if (kind === 'target') info.ctx.renderTargetOutput();
    else info.ctx.renderGradeOutput();
  }

  function afterGrade(container, info) {
    latest.grade = info;
    controls(container, 'grade', info, gradeDraft);
  }

  function afterTarget(container, info) {
    latest.target = info;
    controls(container, 'target', info, atarDraft);
  }

  const semesterButton = idx => document.querySelectorAll('#connectea-atar .cta-semester')[idx];

  /** Loads a saved goal into its planner tab (grade goals: subject, target, semester, checkbox, sliders). */
  function edit(goal) {
    const kind = goal.kind === 'atar' ? 'target' : 'grade';
    window.ConnectifyAtar?.openCalculator?.(kind);
    const info = latest[kind];
    if (!info) return;
    const { refs } = info;
    const semIdx = P().semesterOf(goal) - 1;
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

  window.ConnectifyGoalEditor = { heldTarget, paintGoalsButton, afterGrade, afterTarget, edit, isEditing: kind => Boolean(editing[kind]) };
})();

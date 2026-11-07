/**
 * Connectify Target Grade UI
 *
 * Implements the interactive Target Grade planner form, subject selector dropdown,
 * and individual assessment requirement calculations and breakdown table.
 * Provides `window.ConnectifyTargetGradeUI`.
 */
(() => {
  'use strict';

  if (window.ConnectifyTargetGradeUI) return;

  const { createEl, round, prefs, savePref, expandOutlinesButton } = window.ConnectifyTargetUiHelpers;

  /** A plan's headline. `scope` names the tasks it covers (a custom end week: only those up to that week). */
  function planSummary(plan, target, { difficulty = false, scope = 'remaining assessments' } = {}) {
    if (plan.impossible) return `Goal unattainable. Highest possible mark: ${round(plan.maximum)}%.`;
    if (plan.finished) return `All tasks marked. Final mark: ${round(plan.final)}%.`;
    if (plan.required === 0) return 'Target secured.';
    if (difficulty || plan.effort) return `Requires ${round(plan.required)}% average on ${scope} for ${target}%.`;
    return `Requires ${plan.required}% on ${scope} for ${target}%.`;
  }

  function createGradeView(ctx) {
    const calc = ctx.calc;
    const gradeContainer = createEl('div', 'cta-planner');
    const subjectLabel = createEl('label', 'cta-target-label', 'Subject ');
    const subjectSelect = createEl('select', 'cta-subject-select');
    subjectLabel.append(subjectSelect);

    const gradeTargetLabel = createEl('label', 'cta-target-label', 'Overall target (%) ');
    const gradeTargetInput = createEl('input', 'cta-score');
    gradeTargetInput.type = 'number';
    gradeTargetInput.min = '0';
    gradeTargetInput.max = '100';
    gradeTargetInput.step = 'any';
    const saved = prefs(calc);
    gradeTargetInput.value = saved.gradeTarget ?? '80';
    gradeTargetLabel.append(gradeTargetInput);

    const difficultyLabel = createEl('label', 'cta-difficulty-label');
    const difficultyCheckbox = createEl('input');
    difficultyCheckbox.type = 'checkbox';
    difficultyCheckbox.checked = Boolean(saved.gradeDifficultyWeighted);
    difficultyLabel.append(
      difficultyCheckbox,
      document.createTextNode(' Adjust by task type performance')
    );

    difficultyCheckbox.addEventListener('change', () => {
      savePref(calc, 'gradeDifficultyWeighted', difficultyCheckbox.checked);
      window.ConnectifyGoalSliders?.reset('grade');
      ctx.renderGradeOutput();
    });

    const gradeOutputContainer = createEl('div', 'cta-target-output');
    gradeOutputContainer.setAttribute('aria-live', 'polite');

    const gradeControls = createEl('div', 'cta-form-controls');
    subjectLabel.classList.add('cta-subject-label');
    gradeControls.append(subjectLabel, gradeTargetLabel, difficultyLabel);
    gradeContainer.append(gradeControls, gradeOutputContainer);

    const gradeSelectedSubjects = ['', ''];
    subjectSelect.addEventListener('change', () => {
      gradeSelectedSubjects[ctx.getActiveSemester()] = subjectSelect.value;
      window.ConnectifySubjectChoice?.set(subjectSelect.selectedOptions[0]?.textContent);
      ctx.renderGradeOutput();
    });

    gradeTargetInput.addEventListener('input', () => {
      savePref(calc, 'gradeTarget', gradeTargetInput.value);
      ctx.renderGradeOutput();
    });

    return {
      container: gradeContainer,
      subjectSelect,
      gradeTargetInput,
      difficultyCheckbox,
      gradeOutputContainer,
      gradeSelectedSubjects
    };
  }

  function renderGradeOutput(viewRefs, ctx) {
    const { subjectSelect, gradeTargetInput, difficultyCheckbox, gradeOutputContainer, gradeSelectedSubjects } = viewRefs;
    const activeSemester = ctx.getActiveSemester();
    const gradeCourses = ctx.getGradeCourses();
    const available = gradeCourses[activeSemester] || [];
    // A subject picked in another tool since the last draw
    const choice = window.ConnectifySubjectChoice;
    if (choice && viewRefs.choiceVersion !== choice.version()) {
      viewRefs.choiceVersion = choice.version();
      const chosen = choice.find(available, r => r.name);
      if (chosen) gradeSelectedSubjects[activeSemester] = chosen.id;
    }
    const wanted = gradeSelectedSubjects[activeSemester];
    const selected = available.find(r => r.id === wanted) || available[0];

    const optionSignature = JSON.stringify(available.map(r => [r.id, r.name]));
    if (subjectSelect.dataset.options !== optionSignature) {
      subjectSelect.replaceChildren();
      for (const course of available) {
        const option = createEl('option', '', course.name);
        option.value = course.id;
        subjectSelect.append(option);
      }
      subjectSelect.dataset.options = optionSignature;
    }

    if (selected) {
      subjectSelect.value = selected.id;
      gradeSelectedSubjects[activeSemester] = selected.id;
    }

    gradeOutputContainer.replaceChildren();
    window.ConnectifyGoalEditor?.clearEnd(gradeOutputContainer);

    if (!selected) {
      const expandBtn = expandOutlinesButton(ctx);
      gradeOutputContainer.append(
        createEl('p', '', 'No subjects found for this semester. Show all classes in Connect.'),
        expandBtn
      );
      return;
    }

    const progress = selected.progress;
    const gradePlanFn = window.ConnectifyTargetSolver?.gradePlan || window.ConnectifyMath?.gradePlan;
    if (!gradePlanFn) return;

    // A subject an ATAR goal holds plans for the target that goal gives it (read-only here)
    const held = window.ConnectifyGoalEditor?.heldTarget(selected.id) || null;
    gradeTargetInput.disabled = difficultyCheckbox.disabled = Boolean(held);
    if (held) gradeTargetInput.value = String(held.target);
    else if (gradeTargetInput.dataset.goalHeld) gradeTargetInput.value = prefs(ctx.calc).gradeTarget ?? '80';
    gradeTargetInput.dataset.goalHeld = held ? '1' : '';
    const isDifficulty = Boolean(difficultyCheckbox?.checked);
    const scoreValue = window.ConnectifyMath?.scoreValue || (v => (Number.isFinite(Number(v)) ? Number(v) : undefined));
    const plan = gradePlanFn(progress, scoreValue(gradeTargetInput.value), {
      difficultyWeighted: isDifficulty,
      subjectName: selected.name,
      offsets: window.ConnectifyGoalPlan?.offsets({ sliders: window.ConnectifyGoalSliders?.gradeSliders(selected.id) })
    });

    if (plan.error) {
      const expandBtn = expandOutlinesButton(ctx);

      gradeOutputContainer.append(
        createEl('p', '', plan.error),
        createEl('p', 'cta-note', 'Expand assessment details in Connect. Ensure full outline is visible.'),
        expandBtn
      );
      return;
    }

    gradeOutputContainer.append(
      createEl('strong', '', planSummary(plan, gradeTargetInput.value, { difficulty: isDifficulty })),
      createEl(
        'p',
        'cta-note',
        progress.remaining < 100
          ? `${round(progress.total - progress.rawRemaining)} of ${round(progress.total)} marked, averaging ${round((progress.earned / (100 - progress.remaining)) * 100)}%.`
          : 'Nothing marked yet.'
      )
    );

    const assessmentDetails = createEl('section', 'cta-assessment-details');
    assessmentDetails.append(createEl('strong', 'cta-breakdown-title', `Assessments (${(progress.allTasks || []).length})`));
    gradeOutputContainer.append(assessmentDetails);

    // One table: every task's mark and weight, and each remaining task's effort slider, needed mark and difficulty
    const rerender = () => renderGradeOutput(viewRefs, ctx);
    window.ConnectifyGoalSliders?.renderGradeTasks(assessmentDetails, { course: selected, tasks: progress.allTasks || [], plan, onChange: rerender });
    window.ConnectifyGoalEditor?.afterGrade(gradeOutputContainer, { refs: viewRefs, ctx, course: selected, plan, held });
  }

  window.ConnectifyTargetGradeUI = {
    createGradeView,
    renderGradeOutput,
    planSummary
  };
})();

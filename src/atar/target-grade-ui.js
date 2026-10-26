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

    const calculateGradeBtn = createEl('button', 'cta-reset', 'Recalculate');
    calculateGradeBtn.type = 'button';
    calculateGradeBtn.addEventListener('click', () => ctx.scanAndRefresh());

    const difficultyLabel = createEl('label', 'cta-difficulty-label');
    const difficultyCheckbox = createEl('input');
    difficultyCheckbox.type = 'checkbox';
    difficultyCheckbox.checked = Boolean(saved.gradeDifficultyWeighted);
    difficultyLabel.append(
      difficultyCheckbox,
      document.createTextNode(' Dynamically adjust required grade based on prior performance')
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
    gradeControls.append(subjectLabel, gradeTargetLabel, calculateGradeBtn, difficultyLabel);
    gradeContainer.append(gradeControls, gradeOutputContainer);

    const gradeSelectedSubjects = ['', ''];
    subjectSelect.addEventListener('change', () => {
      gradeSelectedSubjects[ctx.getActiveSemester()] = subjectSelect.value;
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
      calculateGradeBtn,
      gradeOutputContainer,
      gradeSelectedSubjects
    };
  }

  function renderGradeOutput(viewRefs, ctx) {
    const { subjectSelect, gradeTargetInput, difficultyCheckbox, gradeOutputContainer, gradeSelectedSubjects } = viewRefs;
    const activeSemester = ctx.getActiveSemester();
    const gradeCourses = ctx.getGradeCourses();
    const available = gradeCourses[activeSemester] || [];
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
        createEl('p', 'cta-note', 'Expand assessment details in Connect, then recalculate. Ensure full outline is visible.'),
        expandBtn
      );
      return;
    }

    const summaryText = plan.impossible
      ? `Goal unattainable. Maximum achievable mark: ${round(plan.maximum)}%.`
      : plan.finished
      ? `All weighted tasks completed. Final mark: ${round(plan.final)}%.`
      : plan.required === 0
      ? 'Target secured with remaining assessments at 0%.'
      : isDifficulty
      ? `Requires performance-adjusted scores (averaging ${round(plan.required)}%) on remaining assessments to achieve ${gradeTargetInput.value}% overall.`
      : plan.effort
      ? `Requires scores averaging ${round(plan.required)}% on remaining assessments to achieve ${gradeTargetInput.value}% overall.`
      : `Requires ${plan.required}% on remaining assessments to achieve ${gradeTargetInput.value}% overall.`;

    gradeOutputContainer.append(
      createEl('strong', '', summaryText),
      createEl(
        'p',
        'cta-note',
        `Outline total: ${round(progress.total)} annual-weight points. Completed: ${round(
          progress.total - progress.rawRemaining
        )}; remaining: ${round(progress.rawRemaining)} (${round(
          progress.remaining
        )}% of this semester). Current completed-task average: ${
          progress.remaining < 100 ? `${round((progress.earned / (100 - progress.remaining)) * 100)}%` : 'not marked'
        }.`
      )
    );

    const table = createEl('table', 'cta-grade-table');
    const headerRow = createEl('tr');
    ['Assessment', 'Score', 'Weight'].forEach(t => headerRow.append(createEl('th', '', t)));
    table.append(headerRow);

    for (const task of progress.allTasks || []) {
      const tr = createEl('tr');
      tr.append(
        createEl('td', '', task.name),
        createEl(
          'td',
          '',
          task.pending ? 'Pending' : `${round(task.score ?? (task.weight ? (task.earned / task.weight) * 100 : 0))}%`
        ),
        createEl('td', '', `${round(task.weight)}%`)
      );
      table.append(tr);
    }

    const assessmentDetails = createEl('section', 'cta-assessment-details');
    assessmentDetails.append(
      createEl('strong', 'cta-breakdown-title', `Assessment breakdown (${(progress.allTasks || []).length})`),
      table
    );
    gradeOutputContainer.append(assessmentDetails);

    // Each remaining task: its effort slider, the mark it needs and its difficulty; then Set as Goal
    const rerender = () => renderGradeOutput(viewRefs, ctx);
    window.ConnectifyGoalSliders?.renderGradeTasks(assessmentDetails, { course: selected, plan, onChange: rerender });
    window.ConnectifyGoalEditor?.afterGrade(gradeOutputContainer, { refs: viewRefs, ctx, course: selected, plan, held });
  }

  window.ConnectifyTargetGradeUI = {
    createGradeView,
    renderGradeOutput
  };
})();

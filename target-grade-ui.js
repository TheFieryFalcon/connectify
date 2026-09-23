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

  const createEl = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  };

  const round = v => (Number.isFinite(v) ? Math.round(v * 10) / 10 : '—');

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
    const prefs = calc?.getPreferences ? calc.getPreferences() : {};
    gradeTargetInput.value = prefs.gradeTarget ?? '80';
    gradeTargetLabel.append(gradeTargetInput);

    const calculateGradeBtn = createEl('button', 'cta-reset', 'Recalculate');
    calculateGradeBtn.type = 'button';
    calculateGradeBtn.addEventListener('click', () => ctx.scanAndRefresh(true));

    const gradeOutputContainer = createEl('div', 'cta-target-output');
    gradeOutputContainer.setAttribute('aria-live', 'polite');

    const gradeControls = createEl('div', 'cta-form-controls');
    subjectLabel.classList.add('cta-subject-label');
    gradeControls.append(subjectLabel, gradeTargetLabel, calculateGradeBtn);
    gradeContainer.append(gradeControls, gradeOutputContainer);

    const gradeSelectedSubjects = ['', ''];
    subjectSelect.addEventListener('change', () => {
      gradeSelectedSubjects[ctx.getActiveSemester()] = subjectSelect.value;
      ctx.renderGradeOutput();
    });

    gradeTargetInput.addEventListener('input', () => {
      const p = calc?.getPreferences ? calc.getPreferences() : {};
      p.gradeTarget = gradeTargetInput.value;
      if (calc?.persistPreferences) calc.persistPreferences();
      ctx.renderGradeOutput();
    });

    return {
      container: gradeContainer,
      subjectSelect,
      gradeTargetInput,
      calculateGradeBtn,
      gradeOutputContainer,
      gradeSelectedSubjects
    };
  }

  function renderGradeOutput(viewRefs, ctx) {
    const { subjectSelect, gradeTargetInput, gradeOutputContainer, gradeSelectedSubjects } = viewRefs;
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
      gradeOutputContainer.append(
        createEl('p', '', 'No subjects found for this semester. Show all classes in Connect.')
      );
      return;
    }

    const progress = selected.progress;
    const gradePlanFn = window.ConnectifyTargetSolver?.gradePlan || window.ConnectifyMath?.gradePlan;
    if (!gradePlanFn) return;

    const scoreValue = window.ConnectifyMath?.scoreValue || (v => (Number.isFinite(Number(v)) ? Number(v) : undefined));
    const plan = gradePlanFn(progress, scoreValue(gradeTargetInput.value));

    if (plan.error) {
      gradeOutputContainer.append(
        createEl('p', '', plan.error),
        createEl('p', 'cta-note', 'Expand assessment details in Connect, then recalculate. Ensure full outline is visible.')
      );
      return;
    }

    const summaryText = plan.impossible
      ? `Goal unattainable. Maximum achievable mark: ${round(plan.maximum)}%.`
      : plan.finished
      ? `All weighted tasks completed. Final mark: ${round(plan.final)}%.`
      : plan.required === 0
      ? 'Target secured with remaining assessments at 0%.'
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

    if (!plan.impossible && !plan.finished) {
      for (const task of progress.tasks || []) {
        assessmentDetails.append(
          createEl('p', 'cta-note', `${task.name}: requires ${plan.required}% (${round(task.weight)}% weight)`)
        );
      }
    }
  }

  window.ConnectifyTargetGradeUI = {
    createGradeView,
    renderGradeOutput
  };
})();

/**
 * Connectify Estimate Grade: view
 *
 * The Estimator's Estimate Grade tab: pick a class, type a mark for any of its unmarked tasks and see
 * the average it would come to (ConnectifyGradeEstimate). Blank tasks are left out, so one mark is
 * enough. Typed marks are kept per class in the calculator preferences (`gradeEstimates`). The table
 * is only rebuilt when the class or its tasks change, so typing never loses focus.
 * Exposes window.ConnectifyGradeEstimateUI.
 */
(() => {
  'use strict';

  if (window.ConnectifyGradeEstimateUI) return;

  const { createEl, round, prefs, savePref, expandOutlinesButton } = window.ConnectifyTargetUiHelpers;
  const model = () => window.ConnectifyGradeEstimate;

  const savedMarks = (calc, courseId) => prefs(calc).gradeEstimates?.[courseId] || {};

  function saveMark(calc, courseId, taskName, text) {
    const all = { ...(prefs(calc).gradeEstimates || {}) };
    const marks = { ...(all[courseId] || {}) };
    if (text.trim()) marks[taskName] = text.trim();
    else delete marks[taskName];
    if (Object.keys(marks).length) all[courseId] = marks;
    else delete all[courseId];
    savePref(calc, 'gradeEstimates', all);
  }

  function createView(ctx) {
    const container = createEl('div', 'cta-planner cta-grade-estimate');
    const subjectLabel = createEl('label', 'cta-target-label cta-subject-label', 'Subject ');
    const subjectSelect = createEl('select', 'cta-subject-select');
    subjectLabel.append(subjectSelect);
    const clearBtn = createEl('button', 'cta-reset', 'Clear Marks');
    clearBtn.type = 'button';
    const controls = createEl('div', 'cta-form-controls');
    controls.append(subjectLabel, clearBtn);

    const output = createEl('div', 'cta-target-output');
    output.setAttribute('aria-live', 'polite');
    const tasksContainer = createEl('div', 'cta-estimate-tasks');
    container.append(controls, output, tasksContainer);

    const refs = { container, subjectSelect, clearBtn, output, tasksContainer, selected: ['', ''], inputs: [], course: null };
    subjectSelect.addEventListener('change', () => {
      refs.selected[ctx.getActiveSemester()] = subjectSelect.value;
      render(refs, ctx);
    });
    clearBtn.addEventListener('click', () => {
      if (!refs.course) return;
      const all = { ...(prefs(ctx.calc).gradeEstimates || {}) };
      delete all[refs.course.id];
      savePref(ctx.calc, 'gradeEstimates', all);
      refs.tasksContainer.dataset.signature = '';
      render(refs, ctx);
    });
    return refs;
  }

  const courseTasks = course => course?.tasks || course?.progress?.allTasks || [];

  // An unweighted task never moves a weighted average, so it gets no input (unless nothing is weighted)
  function taskRow(task, index, refs, ctx, weighted) {
    const tr = createEl('tr', task.pending ? 'cta-estimate-pending' : '');
    const cell = createEl('td');
    if (task.pending && weighted && !(task.weight > 0)) {
      cell.textContent = 'Not weighted';
    } else if (task.pending) {
      const input = createEl('input', 'cta-score cta-estimate-input');
      input.type = 'text';
      input.inputMode = 'decimal';
      input.placeholder = 'e.g. 75 or 18/20';
      input.setAttribute('aria-label', `Mark for ${task.name}`);
      input.value = savedMarks(ctx.calc, refs.course.id)[task.name] || '';
      input.addEventListener('input', () => {
        saveMark(ctx.calc, refs.course.id, task.name, input.value);
        updateSummary(refs);
      });
      refs.inputs[index] = input;
      cell.append(input);
    } else {
      cell.textContent = Number.isFinite(task.score) ? `${round(task.score)}%` : '—';
    }
    tr.append(createEl('td', '', task.name), createEl('td', '', `${round(task.weight)}%`), cell);
    return tr;
  }

  function buildTable(refs, ctx, tasks) {
    refs.inputs = [];
    const table = createEl('table', 'cta-grade-table');
    const head = createEl('tr');
    ['Assessment', 'Weight', 'Mark'].forEach(t => head.append(createEl('th', '', t)));
    table.append(head);
    const weighted = tasks.some(t => t.weight > 0);
    tasks.forEach((task, i) => table.append(taskRow(task, i, refs, ctx, weighted)));
    const details = createEl('section', 'cta-assessment-details');
    details.append(createEl('strong', 'cta-breakdown-title', `Assessments (${tasks.length})`), table);
    refs.tasksContainer.replaceChildren(details);
  }

  function updateSummary(refs) {
    const tasks = courseTasks(refs.course);
    const entered = refs.inputs.map(input => {
      if (!input) return undefined;
      const value = model().parseMark(input.value);
      const invalid = input.value.trim() !== '' && value === undefined;
      input.setAttribute('aria-invalid', String(invalid));
      return value;
    });
    const result = model().estimate(tasks, entered, refs.course.mark);
    const current = Number.isFinite(result.current) ? `${round(result.current)}%` : 'no marked tasks yet';
    // One line only: the table already shows which tasks are marked, typed or blank
    let headline = `Current average: ${current}.`;
    if (result.entered) {
      const change = Number.isFinite(result.current) ? result.estimate - result.current : undefined;
      const delta = change === undefined ? '' : ` (${change >= 0 ? '+' : '−'}${round(Math.abs(change))} from ${current})`;
      headline = `${result.complete ? 'Estimated final mark' : 'Estimated average'}: ${round(result.estimate)}%${delta}.`;
    }
    const goalLine = window.ConnectifyGradeEstimateGoal?.gradeLine(refs.course, tasks, entered, result);
    refs.output.replaceChildren(...[createEl('strong', 'cta-estimate-result', headline), goalLine].filter(Boolean));
  }

  function render(refs, ctx) {
    const available = ctx.getGradeCourses()[ctx.getActiveSemester()] || [];
    const wanted = refs.selected[ctx.getActiveSemester()];
    const course = available.find(r => r.id === wanted) || available[0];

    const optionSignature = JSON.stringify(available.map(r => [r.id, r.name]));
    if (refs.subjectSelect.dataset.options !== optionSignature) {
      refs.subjectSelect.replaceChildren(...available.map(r => Object.assign(createEl('option', '', r.name), { value: r.id })));
      refs.subjectSelect.dataset.options = optionSignature;
    }
    refs.course = course || null;
    if (course) {
      refs.subjectSelect.value = course.id;
      refs.selected[ctx.getActiveSemester()] = course.id;
    }

    const tasks = courseTasks(course);
    if (!course || !tasks.length) {
      refs.tasksContainer.dataset.signature = '';
      refs.tasksContainer.replaceChildren();
      refs.inputs = [];
      refs.output.replaceChildren(
        createEl('p', '', course ? 'No assessments found for this class. Expand its outline in Connect.' : 'No subjects found for this semester. Show all classes in Connect.'),
        expandOutlinesButton(ctx)
      );
      return;
    }

    const signature = JSON.stringify([course.id, tasks.map(t => [t.name, t.weight, t.pending, t.score])]);
    if (refs.tasksContainer.dataset.signature !== signature) {
      buildTable(refs, ctx, tasks);
      refs.tasksContainer.dataset.signature = signature;
    }
    updateSummary(refs);
  }

  window.ConnectifyGradeEstimateUI = { createView, render };
})();

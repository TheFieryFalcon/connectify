/**
 * Connectify Target ATAR UI
 *
 * Implements the interactive Target ATAR planner form, top-4 subject checkboxes,
 * difficulty-weighting performance adjustments, and the projected task mark breakdown.
 * Provides `window.ConnectifyTargetAtarUI`.
 */
(() => {
  'use strict';

  if (window.ConnectifyTargetAtarUI) return;

  const { createEl, prefs, savePref, expandOutlinesButton } = window.ConnectifyTargetUiHelpers;

  function createPlannerView(ctx) {
    const calc = ctx.calc;
    const plannerContainer = createEl('div', 'cta-planner');
    const targetLabel = createEl('label', 'cta-target-label', 'Target ATAR ');
    const targetInput = createEl('input', 'cta-score');
    targetInput.type = 'number';
    targetInput.min = '30';
    targetInput.max = '99.95';
    targetInput.step = '0.05';
    const saved = prefs(calc);
    targetInput.value = saved.target ?? '98';
    targetLabel.append(targetInput);

    const difficultyLabel = createEl('label', 'cta-difficulty-label');
    const difficultyCheckbox = createEl('input');
    difficultyCheckbox.type = 'checkbox';
    difficultyCheckbox.checked = Boolean(saved.targetDifficultyWeighted);
    difficultyLabel.append(
      difficultyCheckbox,
      document.createTextNode(' Adjust by how you do in each subject and task type')
    );

    difficultyCheckbox.addEventListener('change', () => {
      savePref(calc, 'targetDifficultyWeighted', difficultyCheckbox.checked);
      window.ConnectifyGoalSliders?.reset('atar', (ctx.getCourses()[ctx.getActiveSemester()] || []).map(c => c.id));
      ctx.renderTargetOutput();
    });

    const topFourContainer = createEl('div', 'cta-top-four-selector');
    const targetOutputContainer = createEl('div', 'cta-target-output');
    targetOutputContainer.setAttribute('aria-live', 'polite');

    const targetControls = createEl('div', 'cta-form-controls');
    targetControls.append(targetLabel, difficultyLabel);
    plannerContainer.append(targetControls, topFourContainer, targetOutputContainer);

    targetInput.addEventListener('input', () => {
      savePref(calc, 'target', targetInput.value);
      ctx.renderTargetOutput();
    });

    return {
      container: plannerContainer,
      targetInput,
      difficultyCheckbox,
      topFourContainer,
      targetOutputContainer
    };
  }

  function renderTargetOutput(viewRefs, ctx) {
    window.ConnectifyGoalEditor?.clearEnd(viewRefs.targetOutputContainer);
    const { targetInput, difficultyCheckbox, topFourContainer, targetOutputContainer } = viewRefs;
    const activeSemester = ctx.getActiveSemester();
    const isClosed = ctx.isTargetClosed(activeSemester);
    targetInput.disabled = isClosed;

    if (isClosed) {
      topFourContainer.replaceChildren();
      targetOutputContainer.replaceChildren(
        createEl(
          'p',
          '',
          activeSemester === 0
            ? 'Semester 1 Target ATAR is closed.'
            : ((ctx.getGradeCourses()[1] || []).some(r => r.finalLetter)
                ? 'Semester 2 Target ATAR is closed because overall A–E grades have been published.'
                : 'Semester 2 Target ATAR is not open yet. Use semester 1 until overall A–E grades are published.')
        )
      );
      return;
    }

    const courses = ctx.getCourses();
    const eligibleCourses = (courses[activeSemester] || []).filter(
      r => !/\bGeneral\b|\bmathematics essentials?\b/i.test(r.name)
    );

    const calc = ctx.calc;
    const excluded = prefs(calc).targetExcludedSubjects;
    const excludedSubjects = new Set(Array.isArray(excluded) ? excluded : []);

    topFourContainer.replaceChildren();
    if (eligibleCourses.length > 0) {
      const topHeader = createEl('div');
      topHeader.style.display = 'flex';
      topHeader.style.justifyContent = 'space-between';
      topHeader.style.alignItems = 'center';
      topHeader.style.marginBottom = '6px';

      const topTitle = createEl('strong', '', 'Subjects That Can Count:');
      topTitle.style.fontSize = '12px';

      const selectedCount = eligibleCourses.filter(c => !excludedSubjects.has(c.id || c.name)).length;
      const countSpan = createEl('span', 'cta-count-span', `${selectedCount} of ${eligibleCourses.length} ticked, your best 4 count`);

      topHeader.append(topTitle, countSpan);
      topFourContainer.append(topHeader);

      const grid = createEl('div', 'cta-top-four-grid');
      eligibleCourses.forEach(c => {
        const key = c.id || c.name;
        const isIncluded = !excludedSubjects.has(key);

        const lbl = createEl('label', 'cta-checkbox-label');
        const cb = createEl('input');
        cb.type = 'checkbox';
        cb.checked = isIncluded;
        cb.addEventListener('change', () => {
          if (cb.checked) {
            excludedSubjects.delete(key);
          } else {
            excludedSubjects.add(key);
          }
          savePref(calc, 'targetExcludedSubjects', [...excludedSubjects]);
          renderTargetOutput(viewRefs, ctx);
        });

        const nameSpan = createEl('span', '', c.name);
        nameSpan.style.whiteSpace = 'nowrap';
        nameSpan.style.overflow = 'hidden';
        nameSpan.style.textOverflow = 'ellipsis';
        lbl.append(cb, nameSpan);
        grid.append(lbl);
      });
      topFourContainer.append(grid);
    }

    const scoreValue = window.ConnectifyMath?.scoreValue || (v => (Number.isFinite(Number(v)) ? Number(v) : undefined));
    const { rows, currentBonus } = window.ConnectifyGoalPlan.atarRows(courses, activeSemester, r => !excludedSubjects.has(r.id || r.name));

    if (eligibleCourses.length === 0) {
      topFourContainer.replaceChildren();
      const expandBtn = expandOutlinesButton(ctx);
      targetOutputContainer.replaceChildren(
        createEl(
          'p',
          '',
          `No ATAR subjects found for Semester ${activeSemester + 1}. Show all classes in Connect.`
        ),
        expandBtn
      );
      return;
    }

    const includedRowsCount = rows.filter(r => r.include).length;
    if (includedRowsCount < 4) {
      targetOutputContainer.replaceChildren(
        createEl(
          'p',
          'cta-note',
          'Tick at least 4 subjects.'
        )
      );
      return;
    }

    const targetPlanFn = window.ConnectifyTargetSolver?.targetPlan || window.ConnectifyMath?.targetPlan;
    if (!targetPlanFn) {
      targetOutputContainer.replaceChildren(createEl('p', 'cta-note', 'Target solver unavailable.'));
      return;
    }

    targetOutputContainer.replaceChildren();

    let plan = null;
    // Effort: each subject's slider plus the task sliders of the subjects it holds (set in Target Grade)
    const sliders = window.ConnectifyGoalSliders;
    const draft = { subjectSliders: sliders?.atarSliders() || {} };
    const children = rows.map(r => ({ subject: r.id, sliders: sliders?.gradeSliders(r.id) || {} }));
    try {
      plan = targetPlanFn(rows, scoreValue(targetInput.value), {
        difficultyWeighted: difficultyCheckbox.checked,
        currentBonus,
        offsets: window.ConnectifyGoalPlan.atarOffsets(draft, rows, children)
      });
    } catch (err) {
      console.warn('Target ATAR plan calculation error:', err);
      targetOutputContainer.replaceChildren(
        createEl('p', 'cta-note', 'Error calculating Target ATAR plan. Please expand all outlines.')
      );
      return;
    }

    if (!plan) return;

    if (plan.error) {
      const expandBtn = expandOutlinesButton(ctx);

      targetOutputContainer.append(
        createEl('p', '', plan.error),
        createEl(
          'p',
          'cta-note',
          'Expand assessment details in Connect. Missing task weights cannot be omitted.'
        ),
        expandBtn
      );
      return;
    }

    const rerender = () => renderTargetOutput(viewRefs, ctx);
    window.ConnectifyTargetAtarBreakdown.renderPlan(targetOutputContainer, plan, rows, difficultyCheckbox.checked, rerender);
    window.ConnectifyGoalEditor?.afterTarget(targetOutputContainer, { refs: viewRefs, ctx, plan, rows, semester: activeSemester });
  }

  window.ConnectifyTargetAtarUI = {
    createPlannerView,
    renderTargetOutput
  };
})();

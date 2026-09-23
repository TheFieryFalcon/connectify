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

  const createEl = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  };

  const round = v => (Number.isFinite(v) ? Math.round(v * 10) / 10 : '—');

  function createPlannerView(ctx) {
    const calc = ctx.calc;
    const plannerContainer = createEl('div', 'cta-planner');
    const targetLabel = createEl('label', 'cta-target-label', 'Target ATAR ');
    const targetInput = createEl('input', 'cta-score');
    targetInput.type = 'number';
    targetInput.min = '30';
    targetInput.max = '99.95';
    targetInput.step = '0.05';
    const prefs = calc?.getPreferences ? calc.getPreferences() : {};
    targetInput.value = prefs.target ?? '98';
    targetLabel.append(targetInput);

    const calculateTargetBtn = createEl('button', 'cta-reset', 'Recalculate');
    calculateTargetBtn.type = 'button';

    const difficultyLabel = createEl('label', 'cta-difficulty-label');
    const difficultyCheckbox = createEl('input');
    difficultyCheckbox.type = 'checkbox';
    difficultyCheckbox.checked = Boolean(prefs.targetDifficultyWeighted);
    difficultyLabel.append(
      difficultyCheckbox,
      document.createTextNode(' Adjust marks by subject & task type performance')
    );

    difficultyCheckbox.addEventListener('change', () => {
      const p = calc?.getPreferences ? calc.getPreferences() : {};
      p.targetDifficultyWeighted = difficultyCheckbox.checked;
      if (calc?.persistPreferences) calc.persistPreferences();
      ctx.renderTargetOutput();
    });

    const topFourContainer = createEl('div', 'cta-top-four-selector');
    const targetOutputContainer = createEl('div', 'cta-target-output');
    targetOutputContainer.setAttribute('aria-live', 'polite');

    const targetControls = createEl('div', 'cta-form-controls');
    targetControls.append(targetLabel, calculateTargetBtn, difficultyLabel);
    plannerContainer.append(targetControls, topFourContainer, targetOutputContainer);

    targetInput.addEventListener('input', () => {
      const p = calc?.getPreferences ? calc.getPreferences() : {};
      p.target = targetInput.value;
      if (calc?.persistPreferences) calc.persistPreferences();
      ctx.renderTargetOutput();
    });

    calculateTargetBtn.addEventListener('click', () => ctx.scanAndRefresh(false));

    return {
      container: plannerContainer,
      targetInput,
      difficultyCheckbox,
      calculateTargetBtn,
      topFourContainer,
      targetOutputContainer
    };
  }

  function renderTargetOutput(viewRefs, ctx) {
    const { targetInput, difficultyCheckbox, calculateTargetBtn, topFourContainer, targetOutputContainer } = viewRefs;
    const activeSemester = ctx.getActiveSemester();
    const isClosed = ctx.isTargetClosed(activeSemester);
    targetInput.disabled = calculateTargetBtn.disabled = isClosed;

    if (isClosed) {
      topFourContainer.replaceChildren();
      targetOutputContainer.replaceChildren(
        createEl(
          'p',
          '',
          (ctx.getGradeCourses()[activeSemester] || []).some(r => r.finalLetter)
            ? `Semester ${activeSemester + 1} Target ATAR is closed because overall A–E grades have been published.`
            : 'Semester 2 Target ATAR is not open yet. Use semester 1 until overall A–E grades are published.'
        )
      );
      return;
    }

    const courses = ctx.getCourses();
    const eligibleCourses = (courses[activeSemester] || []).filter(
      r => !/\bGeneral\b|\bmathematics essentials?\b/i.test(r.name)
    );

    const calc = ctx.calc;
    const prefsNow = calc?.getPreferences ? calc.getPreferences() : {};
    const excludedSubjects = new Set(
      Array.isArray(prefsNow.targetExcludedSubjects) ? prefsNow.targetExcludedSubjects : []
    );

    topFourContainer.replaceChildren();
    if (eligibleCourses.length > 0) {
      const topHeader = createEl('div');
      topHeader.style.display = 'flex';
      topHeader.style.justifyContent = 'space-between';
      topHeader.style.alignItems = 'center';
      topHeader.style.marginBottom = '6px';

      const topTitle = createEl('strong', '', 'Targeted Subjects for Top Four:');
      topTitle.style.fontSize = '12px';

      const selectedCount = eligibleCourses.filter(c => !excludedSubjects.has(c.id || c.name)).length;
      const countSpan = createEl('span', '', `${selectedCount} of ${eligibleCourses.length} selected`);
      countSpan.style.fontSize = '11px';
      countSpan.style.color = '#788896';
      countSpan.style.fontWeight = '500';

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
          const p = calc?.getPreferences ? calc.getPreferences() : {};
          p.targetExcludedSubjects = [...excludedSubjects];
          if (calc?.persistPreferences) calc.persistPreferences();
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

    const wholeScore = window.ConnectifyMath?.wholeScore || (v => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : undefined));
    const scoreValue = window.ConnectifyMath?.scoreValue || (v => (Number.isFinite(Number(v)) ? Number(v) : undefined));

    const rows = eligibleCourses.map(r => {
      const key = r.id || r.name;
      const isIncluded = !excludedSubjects.has(key);
      const current = calc?.getCourseState ? calc.getCourseState(r, activeSemester, courses) : r;
      return {
        ...r,
        include: isIncluded,
        score: current.score,
        progress:
          current.score === undefined
            ? { error: 'Enter a valid scaled-score assumption in the ATAR estimate tab.' }
            : r.progress,
        offset: current.score === undefined || r.mark === undefined ? 0 : current.score - wholeScore(r.mark)
      };
    });

    const includedRowsCount = rows.filter(r => r.include).length;
    if (includedRowsCount < 4) {
      targetOutputContainer.replaceChildren(
        createEl(
          'p',
          'cta-note',
          'Please select at least 4 subjects above to target for your top four.'
        )
      );
      return;
    }

    const targetPlanFn = window.ConnectifyTargetSolver?.targetPlan || window.ConnectifyMath?.targetPlan;
    if (!targetPlanFn) return;

    const currentCalcResult = calc?.calculateResults ? calc.calculateResults(courses)[activeSemester] : null;
    const currentBonus = currentCalcResult && Number.isFinite(currentCalcResult.bonus)
      ? currentCalcResult.bonus
      : undefined;

    const plan = targetPlanFn(rows, scoreValue(targetInput.value), {
      difficultyWeighted: difficultyCheckbox.checked,
      currentBonus: currentBonus
    });
    targetOutputContainer.replaceChildren();

    if (plan.error) {
      targetOutputContainer.append(
        createEl('p', '', plan.error),
        createEl(
          'p',
          'cta-note',
          'Expand assessment details in Connect, then recalculate. Missing task weights cannot be omitted.'
        )
      );
      return;
    }

    if (plan.impossible) {
      targetOutputContainer.append(
        createEl(
          'strong',
          '',
          `Goal unattainable with remaining tasks. Maximum achievable ATAR: ${plan.maximum?.atar ?? '—'} (assuming 100% on all remaining assessments).`
        )
      );
    } else {
      const bannerText =
        plan.required === 0
          ? 'Target secured under current assumptions.'
          : difficultyCheckbox.checked
          ? `Requires performance-adjusted scores (averaging ${round(plan.required)}%) on remaining assessments for an estimated ATAR of ${
              plan.result?.atar ?? '—'
            }.`
          : `Requires ${round(plan.required)}% on remaining assessments for an estimated ATAR of ${
              plan.result?.atar ?? '—'
            }.`;

      targetOutputContainer.append(createEl('strong', '', bannerText));
    }

    const bonusNote = plan.bonus > 0 ? ` (assumes current TEA bonus of ${round(plan.bonus)} points)` : '';
    targetOutputContainer.append(
      createEl(
        'p',
        'cta-note',
        difficultyCheckbox.checked
          ? `Maximum achievable ATAR: ${plan.maximum?.atar ?? '—'}${bonusNote}. Marks are scaled proportionally based on demonstrated subject and assessment type performance.`
          : `Maximum achievable ATAR: ${plan.maximum?.atar ?? '—'}${bonusNote}. Assumes uniform performance across remaining tasks.`
      )
    );

    const taskDetails = createEl('section', 'cta-assessment-details');
    taskDetails.append(
      createEl('strong', 'cta-breakdown-title', `Subject and assessment breakdown (${rows.length} subjects)`)
    );
    targetOutputContainer.append(taskDetails);

    rows.forEach((course, idx) => {
      const block = createEl('div', 'cta-course');
      const projectedScore = plan.rows?.[idx]?.score ?? course.score ?? 0;

      if (!course.include) {
        block.style.opacity = '0.65';
        block.append(
          createEl('strong', '', `${course.name} (Excluded from top four target)`),
          createEl(
            'small',
            '',
            `Current score: ${
              course.score !== undefined
                ? wholeScore(course.score)
                : course.mark !== undefined
                ? wholeScore(course.mark)
                : '—'
            }`
          )
        );
        taskDetails.append(block);
        return;
      }

      block.append(
        createEl('strong', '', course.name),
        createEl(
          'small',
          '',
          `Outline weight ${round(course.progress?.total ?? 0)}% · ${round(
            course.progress?.earned ?? 0
          )} normalized points earned · ${round(course.progress?.remaining ?? 0)}% of semester remaining · projected rounded score ${wholeScore(
            projectedScore
          )}`
        )
      );

      for (const task of course.progress?.tasks || []) {
        let reqText = '';
        if (plan.impossible) {
          reqText = 'max 100%';
        } else if (difficultyCheckbox.checked) {
          const meta = plan.taskRequirements?.[`${course.name}::${task.name}`];
          const reqVal = meta ? meta.required : plan.required;
          const baseVal = meta ? meta.baseline : null;
          reqText = `required ${round(reqVal)}%${baseVal !== null ? ` (baseline: ${round(baseVal)}%)` : ''}`;
        } else {
          reqText = `required ${round(plan.required)}%`;
        }

        block.append(
          createEl(
            'small',
            '',
            `${task.name}: weight ${round(task.weight)}% · ${reqText}`
          )
        );
      }

      if (!course.progress?.remaining) {
        block.append(createEl('small', '', 'All weighted tasks completed.'));
      }
      taskDetails.append(block);
    });
  }

  window.ConnectifyTargetAtarUI = {
    createPlannerView,
    renderTargetOutput
  };
})();

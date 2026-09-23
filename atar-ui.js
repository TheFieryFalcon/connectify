/**
 * Connectify ATAR UI & Planner Interface
 *
 * Coordinates the ATAR estimate view, Target ATAR planner, and Target Grade planner modals.
 * Delegates data scraping to ConnectifyAtarScraper and core calculation to ConnectifyAtarCalc.
 */
(() => {
  'use strict';

  try {
    if (window.__connectifyAtarUiInitialized) return;
    window.__connectifyAtarUiInitialized = true;

    if (!Element.prototype.replaceChildren) {
      Element.prototype.replaceChildren = function(...nodes) {
        while (this.firstChild) this.removeChild(this.firstChild);
        this.append(...nodes);
      };
    }

    window.ConnectifyAtar = window.ConnectifyAtar || {};

    const math = window.ConnectifyMath || {};
    const scraper = window.ConnectifyAtarScraper;
    const calc = window.ConnectifyAtarCalc;

    const round = v => (Number.isFinite(v) ? Math.round(v * 10) / 10 : '—');
    const scoreValue = math.scoreValue || (v => {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    });
    const wholeScore = math.wholeScore || (v => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : undefined));

    if (math.calculate) {
      window.ConnectifyAtar.calculate = math.calculate;
    }

    let courses = [[], []];
    let gradeCourses = [[], []];
    let activeSemester = 1;
    let lastStateSignature = '';
    let isPlanningMode = false;
    let isGradingMode = false;

    const createEl = (tag, className, text) => {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (text) el.textContent = text;
      return el;
    };

    const calculatorPanel = createEl('aside', '', '');
    calculatorPanel.id = 'connectea-atar';
    calculatorPanel.hidden = true;
    calculatorPanel.setAttribute('aria-label', '2025 ATAR estimates');

    const headingContainer = createEl('div', 'cta-heading');
    const panelTitle = createEl('strong', '', 'Estimated ATAR');
    panelTitle.tabIndex = -1;
    headingContainer.append(panelTitle);

    const estimateTab = createEl('button', 'cta-semester', 'ATAR Estimate');
    const targetTab = createEl('button', 'cta-semester', 'Target ATAR');
    const gradeTab = createEl('button', 'cta-semester', 'Target Grade');
    estimateTab.type = targetTab.type = gradeTab.type = 'button';
    estimateTab.id = 'connectify-estimate-toggle';
    targetTab.id = 'connectify-target-toggle';
    gradeTab.id = 'connectify-grade-toggle';

    for (const button of [estimateTab, targetTab, gradeTab]) {
      button.className = 'cx-calculator-tool';
      button.setAttribute('aria-controls', 'connectea-atar');
    }

    window.ConnectifyAtar.calculatorButtons = [estimateTab, targetTab, gradeTab];
    if (!window.ConnectifyAtar.toolButtons) {
      window.ConnectifyAtar.toolButtons = [estimateTab, targetTab, gradeTab];
    } else {
      for (const b of [estimateTab, targetTab, gradeTab]) {
        if (!window.ConnectifyAtar.toolButtons.includes(b)) {
          window.ConnectifyAtar.toolButtons.unshift(b);
        }
      }
    }

    const hasSemesterTwoStarted = () => (gradeCourses || []).flat().some(r => r?.finalLetter);
    const isTargetClosed = semesterIdx =>
      (gradeCourses?.[semesterIdx] || []).some(r => r?.finalLetter) ||
      (semesterIdx === 1 && !(gradeCourses || []).flat().some(r => r?.finalLetter));

    function selectTab(mode) {
      const isEligible = scraper ? scraper.isAtarEligible() : true;
      if (!isEligible) mode = 'grade';

      isPlanningMode = mode === 'target';
      isGradingMode = mode === 'grade';

      panelTitle.textContent = isPlanningMode
        ? 'Target ATAR Planner'
        : isGradingMode
        ? 'Target Grade Planner'
        : 'Estimated ATAR';

      calculatorPanel.setAttribute('aria-label', panelTitle.textContent);

      if (isGradingMode && hasSemesterTwoStarted()) {
        activeSemester = 1;
      }

      estimateTab.setAttribute('aria-pressed', String(!isPlanningMode && !isGradingMode));
      targetTab.setAttribute('aria-pressed', String(isPlanningMode));
      gradeTab.setAttribute('aria-pressed', String(isGradingMode));

      courseListContainer.hidden = detailSummary.hidden = resetBtn.hidden = calculationDetails.hidden =
        isPlanningMode || isGradingMode;
      plannerContainer.hidden = !isPlanningMode;
      gradeContainer.hidden = !isGradingMode;

      renderCourseRows();
    }

    function openCalculator(mode) {
      if (window.ConnectifyData?.expandAll) window.ConnectifyData.expandAll();
      refreshData();
      calculatorPanel.hidden = false;
      window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'calculator' }));
      selectTab(mode);
      panelTitle.focus();
    }

    estimateTab.addEventListener('click', () => openCalculator('estimate'));
    targetTab.addEventListener('click', () => openCalculator('target'));
    gradeTab.addEventListener('click', () => openCalculator('grade'));

    const semesterCardsContainer = createEl('div', 'cta-semesters');
    const semesterButtons = [0, 1].map(semesterIdx => {
      const btn = createEl('button', 'cta-semester', `Semester ${semesterIdx + 1} ATAR`);
      btn.type = 'button';
      btn.addEventListener('click', () => {
        if (
          isGradingMode ||
          (isPlanningMode && isTargetClosed(semesterIdx))
        ) {
          return;
        }
        activeSemester = semesterIdx;
        renderCourseRows();
      });
      semesterCardsContainer.append(btn);
      return btn;
    });

    const courseListContainer = createEl('div', 'cta-courses');
    const detailSummary = createEl('p', 'cta-breakdown');
    detailSummary.setAttribute('aria-live', 'polite');

    const resetBtn = createEl('button', 'cta-reset', 'Reset to School Marks');
    resetBtn.type = 'button';
    resetBtn.addEventListener('click', () => {
      if (calc?.resetPreferencesForSemester) {
        calc.resetPreferencesForSemester(courses[activeSemester], activeSemester);
      }
      renderCourseRows();
    });

    const calculationDetails = createEl('details', 'cta-method');
    calculationDetails.append(createEl('summary', '', 'Calculation Methodology & Sources'));
    calculationDetails.append(
      createEl(
        'p',
        '',
        'Scores round to whole numbers before the best four and bonuses are calculated; exact .5 values round down (69.9 → 70; 69.5 → 69). Best four included scaled-score assumptions, plus 10% of Methods, 10% of Specialist and 10% of the best language score. General and other non-ATAR courses are excluded. Estimates interpolate the published 2025 TISC table. Below the table range, <30 is shown.'
      )
    );
    calculationDetails.append(
      createEl(
        'p',
        '',
        'Semester 2 uses the cumulative percentage shown by Connect. This does not check WACE eligibility, English competency or unacceptable course combinations. Exclude an incompatible course before calculating. No marks are sent to another website.'
      )
    );

    // Target ATAR Planner form
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
      renderTargetOutput();
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
      renderTargetOutput();
    });

    function scanAndRefresh(allSubjects = false) {
      if (scraper?.scanOutlineDetails) {
        scraper.scanOutlineDetails(allSubjects, activeSemester);
      }
      refreshData();
      if (isGradingMode) renderGradeOutput();
      else renderTargetOutput();
    }

    calculateTargetBtn.addEventListener('click', () => scanAndRefresh(false));

    // Grade Planner form
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
    gradeTargetInput.value = prefs.gradeTarget ?? '80';
    gradeTargetLabel.append(gradeTargetInput);

    const calculateGradeBtn = createEl('button', 'cta-reset', 'Recalculate');
    calculateGradeBtn.type = 'button';
    calculateGradeBtn.addEventListener('click', () => scanAndRefresh(true));

    const gradeOutputContainer = createEl('div', 'cta-target-output');
    gradeOutputContainer.setAttribute('aria-live', 'polite');

    const gradeControls = createEl('div', 'cta-form-controls');
    subjectLabel.classList.add('cta-subject-label');
    gradeControls.append(subjectLabel, gradeTargetLabel, calculateGradeBtn);
    gradeContainer.append(gradeControls, gradeOutputContainer);

    const gradeSelectedSubjects = ['', ''];
    subjectSelect.addEventListener('change', () => {
      gradeSelectedSubjects[activeSemester] = subjectSelect.value;
      renderGradeOutput();
    });

    gradeTargetInput.addEventListener('input', () => {
      const p = calc?.getPreferences ? calc.getPreferences() : {};
      p.gradeTarget = gradeTargetInput.value;
      if (calc?.persistPreferences) calc.persistPreferences();
      renderGradeOutput();
    });

    calculatorPanel.append(
      headingContainer,
      semesterCardsContainer,
      courseListContainer,
      detailSummary,
      resetBtn,
      calculationDetails,
      plannerContainer,
      gradeContainer
    );
    document.body.append(calculatorPanel);
    selectTab('estimate');

    function renderGradeOutput() {
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
      const gradePlanFn = window.ConnectifyMath?.gradePlan;
      if (!gradePlanFn) return;

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

    function renderTargetOutput() {
      targetInput.disabled = calculateTargetBtn.disabled = isTargetClosed(activeSemester);

      if (isTargetClosed(activeSemester)) {
        topFourContainer.replaceChildren();
        targetOutputContainer.replaceChildren(
          createEl(
            'p',
            '',
            (gradeCourses[activeSemester] || []).some(r => r.finalLetter)
              ? `Semester ${activeSemester + 1} Target ATAR is closed because overall A–E grades have been published.`
              : 'Semester 2 Target ATAR is not open yet. Use semester 1 until overall A–E grades are published.'
          )
        );
        return;
      }

      const eligibleCourses = (courses[activeSemester] || []).filter(
        r => !/\bGeneral\b|\bmathematics essentials?\b/i.test(r.name)
      );

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
            renderTargetOutput();
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

      const targetPlanFn = window.ConnectifyMath?.targetPlan;
      if (!targetPlanFn) return;

      const plan = targetPlanFn(rows, scoreValue(targetInput.value), {
        difficultyWeighted: difficultyCheckbox.checked,
        ignoreBonus: true
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

      targetOutputContainer.append(
        createEl(
          'p',
          'cta-note',
          difficultyCheckbox.checked
            ? `Maximum achievable ATAR: ${plan.maximum?.atar ?? '—'}. Marks are scaled proportionally based on demonstrated subject and assessment type performance.`
            : `Maximum achievable ATAR: ${plan.maximum?.atar ?? '—'}. Assumes uniform performance across remaining tasks.`
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

    function updateResults() {
      if (isGradingMode && hasSemesterTwoStarted()) {
        activeSemester = 1;
      }
      if (isPlanningMode && isTargetClosed(activeSemester) && !isTargetClosed(1 - activeSemester)) {
        activeSemester = 1 - activeSemester;
      }

      const results = calc?.calculateResults ? calc.calculateResults(courses) : [{}, {}];

      for (let i = 0; i < 2; i++) {
        const res = results[i] || {};
        const isClosed = isPlanningMode && isTargetClosed(i);

        let semesterLabel = `Semester ${i + 1} ATAR\n${res.error ? '—' : (res.finalAtar || res.atar || '—')}`;
        if (isGradingMode) {
          semesterLabel = `Semester ${i + 1} Target Grade`;
        } else if (isPlanningMode) {
          semesterLabel = isClosed ? `Semester ${i + 1} Target ATAR (Closed)` : `Semester ${i + 1} Target ATAR`;
        }
        semesterButtons[i].textContent = semesterLabel;

        semesterButtons[i].hidden = isGradingMode && hasSemesterTwoStarted() && i === 0;
        semesterButtons[i].disabled = semesterButtons[i].hidden || isClosed;

        if (isGradingMode) {
          semesterButtons[i].className = 'cta-semester cta-non-button cta-semester-indicator';
        } else if (isPlanningMode) {
          semesterButtons[i].className = isClosed
            ? 'cta-semester cta-non-button cta-semester-closed'
            : 'cta-semester cta-non-button cta-semester-indicator';
        } else {
          semesterButtons[i].className = 'cta-semester';
        }

        semesterButtons[i].setAttribute('aria-pressed', String(i === activeSemester));

        if (i === activeSemester) {
          detailSummary.textContent = res.detailText || res.error || 'Calculating ATAR...';
        }
      }

      if (isPlanningMode) renderTargetOutput();
      if (isGradingMode) renderGradeOutput();
    }

    function renderCourseRows() {
      const eligible = scraper ? scraper.isAtarEligible() : true;
      estimateTab.hidden = targetTab.hidden = !eligible;
      if (!eligible && !isGradingMode) {
        selectTab('grade');
        return;
      }

      if (calc?.renderCourseList) {
        calc.renderCourseList(courseListContainer, courses, activeSemester, updateResults);
      }
      updateResults();
    }

    function refreshData() {
      if (!scraper) return;
      const nextCourses = scraper.readCourses(false);
      const eligible = scraper.isAtarEligible();
      const signature = JSON.stringify([eligible, nextCourses]);

      estimateTab.hidden = targetTab.hidden = !eligible;

      if (signature !== lastStateSignature) {
        gradeCourses = nextCourses;
        courses = scraper.readCourses(true);
        lastStateSignature = signature;
        if (!calculatorPanel.hidden) renderCourseRows();
      }
    }

    window.addEventListener('connectify-settings-updated', () => {
      if (calc?.reloadPreferences) calc.reloadPreferences();
      updateResults();
    });

    window.addEventListener('connectify-open', e => {
      if (e.detail !== 'calculator') {
        calculatorPanel.hidden = true;
        for (const b of [estimateTab, targetTab, gradeTab]) b.setAttribute('aria-pressed', 'false');
      }
    });

    function closeCalculator() {
      calculatorPanel.hidden = true;
      for (const b of [estimateTab, targetTab, gradeTab]) b.setAttribute('aria-pressed', 'false');
      (isGradingMode ? gradeTab : isPlanningMode ? targetTab : estimateTab).focus();
    }

    calculatorPanel.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeCalculator();
    });

    window.ConnectifyAtar.openCalculator = openCalculator;
    window.ConnectifyAtar.selectTab = selectTab;
    window.ConnectifyAtar.refreshData = refreshData;
    window.ConnectifyAtar.updateResults = updateResults;

    setInterval(refreshData, 1500);
    refreshData();
  } catch (err) {
    console.error('Connectify error in atar-ui.js:', err);
  }
})();

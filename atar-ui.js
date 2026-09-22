(() => {
  'use strict';
  const { calculate, convertTEAtoATAR, wholeScore, scoreValue, estimateScaledScore, calculateShiftedScaledScore, normalizeSubject, parseAssessment, taskProgress, gradePlan, targetPlan, normalize, isAtarCourse } = window.ConnectifyMath;

  window.ConnectifyAtar = window.ConnectifyAtar || {};
  window.ConnectifyAtar.calculate = calculate;
  function readCourses(atarOnly = true) {
    const result = [[], []];
    const seen = [new Set(), new Set()];

    for (const card of document.querySelectorAll('.eds-c-tile')) {
      const title = normalize(card.querySelector('.eds-c-tile__title')?.textContent);
      const semesterMatch = title.match(/\bSemester\s*([12])\b/i);
      if (!semesterMatch || (atarOnly && !isAtarCourse(title))) continue;

      const name = normalize(
        title
          .replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '')
          .replace(/\bATAR\b/gi, '')
          .replace(/\bYear\s*\d+\b/gi, '')
      );
      const index = Number(semesterMatch[1]) - 1;
      const id = name.toLowerCase();

      if (seen[index].has(id)) continue;
      seen[index].add(id);

      const summaryRow = Array.from(card.querySelectorAll('.cvr-c-task')).find(row => !row.closest('.cvr-c-tasks'));
      const summaryText = normalize(summaryRow?.querySelector('.cvr-c-task__marks .cvr-c-task__mark')?.textContent);
      const markMatch = summaryText.match(/^(\d+(?:\.\d+)?)\s*%$/);

      let tasks = Array.from(card.querySelectorAll('.cvr-c-tasks .cvr-c-task'))
        .filter(r => r.closest('.eds-c-tile') === card)
        .map((r, i) => {
          const cells = r.querySelectorAll('.cvr-c-task__marks .cvr-c-task__mark');
          const labels = Array.from(r.querySelectorAll('.cvr-c-task__details .v-label'))
            .map(e => normalize(e.textContent))
            .filter(Boolean);
          return parseAssessment(cells[0]?.textContent, cells[1]?.textContent, labels.at(-1) || `Assessment ${i + 1}`);
        });

      let markValue = markMatch ? scoreValue(markMatch[1]) : undefined;

      const hasFinalLetter = Array.from(
        summaryRow?.querySelectorAll('.cvr-c-task__marks .cvr-c-task__mark') || []
      ).some(c => /^[ABCDE]$/i.test(normalize(c.textContent)));

      result[index].push({
        id,
        name,
        mark: markValue,
        finalLetter: hasFinalLetter,
        progress: taskProgress(tasks, markValue, index + 1)
      });
    }

    return result;
  }

  // --- UI and State Management ---

  const account = new URL(location.href).searchParams.get('coisp') || 'current';
  const storageKey = `connectea:atar:2025:${account}:${new Date().getFullYear()}`;
  let savedPreferences = {};

  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      savedPreferences = stored;
    }
  } catch {}

  window.addEventListener('connectify-settings-updated', () => {
    // Reload preferences since Settings might have changed calibration
    const rawPrefs = localStorage.getItem('connectea:preferences');
    if (rawPrefs) {
        try {
            const parsed = JSON.parse(rawPrefs);
            // Since savedPreferences is a const, we can modify its keys
            for (const key in parsed) savedPreferences[key] = parsed[key];
        } catch(e){}
    }
    updateResults();
  });

  let courses = [[], []];
  let gradeCourses = [[], []];
  let activeSemester = 1;
  let lastStateSignature = '';

  function persistPreferences() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(savedPreferences));
    } catch {}
  }

  function getCourseState(row, semesterIdx) {
    const entry = savedPreferences[`${semesterIdx}:${row.id}`];
    const calibration = savedPreferences[`sem1_calibration:${row.id}`];
    
    // Instead of raw marks or manually entered final scores, use the shifted model!
    let finalScore;
    if (entry?.score !== undefined) {
      finalScore = entry.score; // Fallback to manual override
    } else if (row.mark !== undefined) {
      const knownSem1Raw = calibration?.raw !== undefined ? calibration.raw : (semesterIdx === 1 ? courses[0].find(r => r.id === row.id)?.mark : undefined);
      const knownSem1Scaled = calibration?.scaled;
      finalScore = calculateShiftedScaledScore(row.name, row.mark, knownSem1Raw, knownSem1Scaled, 2025);
    }
    
    return {
      ...row,
      include: entry?.include ?? row.mark !== undefined,
      score: wholeScore(finalScore)
    };
  }

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

  for (const button of [estimateTab, targetTab, gradeTab]) {
    button.className = 'cx-calculator-tool';
    button.setAttribute('aria-controls', 'connectea-atar');
  }

  window.ConnectifyAtar.toolButtons = [estimateTab, targetTab, gradeTab];

  let isPlanningMode = false;
  let isGradingMode = false;

  const isAtarEligible = () =>
    /\bYear\s*(?:11|12)\b/i.test(
      Array.from(document.querySelectorAll('.eds-c-tile'))
        .map(c => c.innerText)
        .join(' ')
    );

  const hasSemesterTwoStarted = () => gradeCourses.flat().some(r => r.finalLetter);
  const isTargetClosed = semesterIdx =>
    gradeCourses[semesterIdx].some(r => r.finalLetter) ||
    (semesterIdx === 1 && !gradeCourses.flat().some(r => r.finalLetter));

  function selectTab(mode) {
    if (!isAtarEligible()) mode = 'grade';

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
    window.ConnectifyData?.expandAll();
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
        (isGradingMode && hasSemesterTwoStarted() && semesterIdx === 0) ||
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
    for (const r of courses[activeSemester]) {
      delete savedPreferences[`${activeSemester}:${r.id}`];
    }
    persistPreferences();
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
  targetInput.value = savedPreferences.target ?? '98';
  targetLabel.append(targetInput);

  const calculateTargetBtn = createEl('button', 'cta-reset', 'Recalculate');
  calculateTargetBtn.type = 'button';

  const targetOutputContainer = createEl('div', 'cta-target-output');
  targetOutputContainer.setAttribute('aria-live', 'polite');

  const targetControls = createEl('div', 'cta-form-controls');
  targetControls.append(targetLabel, calculateTargetBtn);
  plannerContainer.append(targetControls, targetOutputContainer);

  targetInput.addEventListener('input', () => {
    savedPreferences.target = targetInput.value;
    persistPreferences();
    renderTargetOutput();
  });

  function scanOutlineDetails(allSubjects = false) {
    for (const card of document.querySelectorAll('.eds-c-tile')) {
      const title = normalize(card.querySelector('.eds-c-tile__title')?.textContent);
      if (
        (!allSubjects && !isAtarCourse(title)) ||
        !new RegExp(`Semester\\s*${activeSemester + 1}\\b`, 'i').test(title)
      ) {
        continue;
      }
      for (const heading of card.querySelectorAll('.eds-c-accordion__section-heading')) {
        if (/show details/i.test(heading.textContent)) {
          const btn = heading.querySelector('button, .v-button, [role="button"]');
          if (btn) btn.click();
        }
      }
    }
    refreshData();
    if (isGradingMode) renderGradeOutput();
    else renderTargetOutput();
  }

  calculateTargetBtn.addEventListener('click', () => scanOutlineDetails());

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
  gradeTargetInput.value = savedPreferences.gradeTarget ?? '80';
  gradeTargetLabel.append(gradeTargetInput);

  const calculateGradeBtn = createEl('button', 'cta-reset', 'Recalculate');
  calculateGradeBtn.type = 'button';
  calculateGradeBtn.addEventListener('click', () => scanOutlineDetails(true));

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
    savedPreferences.gradeTarget = gradeTargetInput.value;
    persistPreferences();
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
    const available = gradeCourses[activeSemester];
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
    const plan = gradePlan(progress, scoreValue(gradeTargetInput.value));

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

    for (const task of progress.allTasks) {
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
      createEl('strong', 'cta-breakdown-title', `Assessment breakdown (${progress.allTasks.length})`),
      table
    );
    gradeOutputContainer.append(assessmentDetails);

    if (!plan.impossible && !plan.finished) {
      for (const task of progress.tasks) {
        assessmentDetails.append(
          createEl('p', 'cta-note', `${task.name}: requires ${plan.required}% (${round(task.weight)}% weight)`)
        );
      }
    }
  }

  function renderTargetOutput() {
    targetInput.disabled = calculateTargetBtn.disabled = isTargetClosed(activeSemester);

    if (isTargetClosed(activeSemester)) {
      targetOutputContainer.replaceChildren(
        createEl(
          'p',
          '',
          gradeCourses[activeSemester].some(r => r.finalLetter)
            ? `Semester ${activeSemester + 1} Target ATAR is closed because overall A–E grades have been published.`
            : 'Semester 2 Target ATAR is not open yet. Use semester 1 until overall A–E grades are published.'
        )
      );
      return;
    }

    const rows = courses[activeSemester]
      .filter(r => getCourseState(r, activeSemester).include)
      .map(r => {
        const current = getCourseState(r, activeSemester);
        return {
          ...r,
          progress:
            current.score === undefined
              ? { error: 'Enter a valid scaled-score assumption in the ATAR estimate tab.' }
              : r.progress,
          offset: current.score === undefined || r.mark === undefined ? 0 : current.score - wholeScore(r.mark)
        };
      });

    const plan = targetPlan(rows, scoreValue(targetInput.value));
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
          `Goal unattainable with remaining tasks. Maximum achievable ATAR: ${plan.maximum.atar} (assuming 100% on all remaining assessments).`
        )
      );
    } else {
      targetOutputContainer.append(
        createEl(
          'strong',
          '',
          plan.required === 0
            ? 'Target secured under current assumptions.'
            : `Requires ${round(plan.required)}% on remaining assessments for an estimated ATAR of ${
                plan.result.atar
              }.`
        )
      );
    }

    targetOutputContainer.append(
      createEl(
        'p',
        'cta-note',
        `Maximum achievable ATAR: ${plan.maximum.atar}. Assumes uniform performance across remaining tasks.`
      )
    );

    const taskDetails = createEl('section', 'cta-assessment-details');
    taskDetails.append(
      createEl('strong', 'cta-breakdown-title', `Subject and assessment breakdown (${rows.length} subjects)`)
    );
    targetOutputContainer.append(taskDetails);

    rows.forEach((course, idx) => {
      const block = createEl('div', 'cta-course');
      block.append(
        createEl('strong', '', course.name),
        createEl(
          'small',
          '',
          `Outline weight ${round(course.progress.total)}% · ${round(
            course.progress.earned
          )} normalized points earned · ${round(course.progress.remaining)}% of semester remaining · projected rounded score ${wholeScore(
            plan.rows[idx].score
          )}`
        )
      );

      for (const task of course.progress.tasks) {
        block.append(
          createEl(
            'small',
            '',
            `${task.name}: weight ${round(task.weight)}% · ${plan.impossible ? 'max 100%' : `required ${round(plan.required)}%`}`
          )
        );
      }

      if (!course.progress.remaining) {
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

    for (let i = 0; i < 2; i++) {
      const result = calculate(courses[i].map(row => getCourseState(row, i)));
      semesterButtons[i].textContent = isGradingMode
        ? `Semester ${i + 1} Target Grade`
        : isPlanningMode
        ? (isTargetClosed(i) ? `Semester ${i + 1} Target ATAR (Closed)` : `Semester ${i + 1} Target ATAR`)
        : `Semester ${i + 1} ATAR\n${result.error ? '—' : result.atar}`;

      semesterButtons[i].hidden = isGradingMode && hasSemesterTwoStarted() && i === 0;
      semesterButtons[i].disabled = semesterButtons[i].hidden || (isPlanningMode && isTargetClosed(i));

      if (isPlanningMode && isTargetClosed(i)) {
        semesterButtons[i].textContent = `Semester ${i + 1} Target ATAR (Closed)`;
      }
      semesterButtons[i].setAttribute('aria-pressed', String(i === activeSemester));

      if (i === activeSemester) {
        const titles = Array.from(document.querySelectorAll('.eds-c-tile__title')).map(el => el.textContent);
        const isYear12 = titles.some(t => /\b12\b/i.test(t) || /\bAT[A-Z]*\b/.test(t));
        const yearLevel = isYear12 ? 12 : 11;
        let teaAdjustment = yearLevel === 11 ? -15 : 0; // Penalize TEA by 15 points (roughly -5%) for Year 11 unscaled marks
        const finalTEA = Math.max(0, result.tea + teaAdjustment);
        const finalAtar = result.error ? '—' : convertTEAtoATAR(finalTEA);
        
        semesterButtons[i].textContent = isGradingMode
          ? `Semester ${i + 1} Target Grade`
          : isPlanningMode
          ? (isTargetClosed(i) ? `Semester ${i + 1} Target ATAR (Closed)` : `Semester ${i + 1} Target ATAR`)
          : `Semester ${i + 1} ATAR\n${finalAtar}`;

        detailSummary.textContent =
          result.error ||
          `TEA ${round(finalTEA)} = best four ${round(result.base)} + bonuses ${round(
            result.bonus
          )}.` + (yearLevel === 11 ? ' (Year 11 TEA scaling adjustment applied).' : ` Best four: ${result.top.map(x => x.name).join(', ')}.`);
      }
    }

    if (isPlanningMode) renderTargetOutput();
    if (isGradingMode) renderGradeOutput();
  }

    function renderCourseRows() {
    const eligible = isAtarEligible();
    estimateTab.hidden = targetTab.hidden = !eligible;
    if (!eligible && !isGradingMode) {
      selectTab('grade');
      return;
    }

    courseListContainer.replaceChildren();

    if (!courses[activeSemester].length) {
      courseListContainer.append(
        createEl('p', '', 'No ATAR subjects found for this semester. Ensure classes are visible in Connect.')
      );
    }

    

    for (const course of courses[activeSemester]) {
      const entry = savedPreferences[`${activeSemester}:${course.id}`] || {};
      const state = getCourseState(course, activeSemester);
      
      const wrapper = createEl('div', 'cta-course');
      const label = createEl('label', 'cta-include');

      const checkbox = createEl('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'connectea-subject-checkbox';
      checkbox.checked = state.include;
      
      label.append(checkbox, createEl('span', '', course.name));
      
      const estMark = state.score !== undefined ? state.score : course.mark;

      const input = createEl('input', 'cta-score');
      input.type = 'number';
      input.min = '0';
      input.max = '100';
      input.step = 'any';
      input.placeholder = isGradingMode ? 'Raw' : (estMark !== undefined ? String(estMark) : '');
      input.value = entry.score !== undefined ? entry.score : '';
      input.disabled = !checkbox.checked;
      input.setAttribute('aria-label', `${course.name} semester ${activeSemester + 1} estimated scaled score`);

      const source = createEl(
        'small',
        '',
        course.mark === undefined ? 'No school mark' : `School ${Math.round(course.mark * 10) / 10}%`
      );

      const updateCourse = () => {
        savedPreferences[`${activeSemester}:${course.id}`] = {
          include: checkbox.checked,
          score: scoreValue(input.value)
        };
        input.setAttribute('aria-invalid', String(checkbox.checked && scoreValue(input.value) === undefined));
        persistPreferences();
        updateResults();
      };

      checkbox.addEventListener('change', () => {
        updateCourse();
        input.disabled = !checkbox.checked;
      });

      input.addEventListener('input', updateCourse);
      input.addEventListener('change', () => {
        const score = wholeScore(input.value);
        if (score !== undefined) {
          input.value = score;
          updateCourse();
        }
      });

      wrapper.append(label, input, source);
      courseListContainer.append(wrapper);
    }
    
    updateResults();
  }

  function refreshData() {
    const nextCourses = readCourses(false);
    const eligible = isAtarEligible();
    const signature = JSON.stringify([eligible, nextCourses]);

    estimateTab.hidden = targetTab.hidden = !eligible;

    if (signature !== lastStateSignature) {
      gradeCourses = nextCourses;
      courses = readCourses();
      lastStateSignature = signature;
      if (!calculatorPanel.hidden) renderCourseRows();
    }
  }

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

  window.ConnectifyAtar.readCourses = readCourses;

  setInterval(refreshData, 1500);
  refreshData();
})();

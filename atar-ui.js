(() => {
  'use strict';
  const { calculate, convertTEAtoATAR, wholeScore, scoreValue, estimateScaledScore, calculateShiftedScaledScore, normalizeSubject, parseAssessment, taskProgress, gradePlan, targetPlan, normalize, isAtarCourse } = window.ConnectifyMath;

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
  const panelTitle = createEl('strong', '', 'Your estimated ATAR based on 2025 scaling');
  panelTitle.tabIndex = -1;
  headingContainer.append(panelTitle);

  const estimateTab = createEl('button', 'cta-semester', 'ATAR estimate');
  const targetTab = createEl('button', 'cta-semester', 'Target ATAR');
  const gradeTab = createEl('button', 'cta-semester', 'Target grade');
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
      ? 'Calculate whether or not an ATAR of your choosing is still possible'
      : isGradingMode
      ? 'Calculate whether or not a subject average of your pleasing is still possible'
      : 'Your estimated ATAR based on 2025 scaling';

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

  const resetBtn = createEl('button', 'cta-reset', 'Reset this semester to school marks');
  resetBtn.type = 'button';
  resetBtn.addEventListener('click', () => {
    for (const r of courses[activeSemester]) {
      delete savedPreferences[`${activeSemester}:${r.id}`];
    }
    persistPreferences();
    renderCourseRows();
  });

  const calculationDetails = createEl('details', 'cta-method');
  calculationDetails.append(createEl('summary', '', 'Calculation & sources'));
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

  const calculateTargetBtn = createEl('button', 'cta-reset', 'Calculate');
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

  const calculateGradeBtn = createEl('button', 'cta-reset', 'Calculate');
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
        createEl('p', 'cta-note', 'Expand Show Details, then scan again. Include the entire published semester outline.')
      );
      return;
    }

    const summaryText = plan.impossible
      ? `Not achievable from the remaining tasks. Maximum overall mark: ${round(plan.maximum)}%.`
      : plan.finished
      ? `No weighted tasks remain. Final overall mark: ${round(plan.final)}%.`
      : plan.required === 0
      ? 'Your target is already secured even with 0% on the remaining tasks.'
      : `Aim for at least ${plan.required}% across the remaining assessments to reach ${gradeTargetInput.value}% overall.`;

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
          createEl('p', 'cta-note', `${task.name}: aim ${plan.required}% · ${round(task.weight)}% annual weight`)
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
          'Expand Show Details for each included subject, then scan again. Missing weights are never treated as zero.'
        )
      );
      return;
    }

    if (plan.impossible) {
      targetOutputContainer.append(
        createEl(
          'strong',
          '',
          `Not achievable with the remaining weights under these assumptions. Maximum ATAR: ${plan.maximum.atar}, even with 100% on every remaining task.`
        )
      );
    } else {
      targetOutputContainer.append(
        createEl(
          'strong',
          '',
          plan.required === 0
            ? 'Target already secured under these assumptions, even with 0% on remaining tasks.'
            : `Aim for at least ${round(plan.required)}% on every remaining assessment. Projected ATAR: ${
                plan.result.atar
              }.`
        )
      );
    }

    targetOutputContainer.append(
      createEl(
        'p',
        'cta-note',
        `Maximum possible in this model: ${plan.maximum.atar}. This is one uniform-score plan, not the only possible combination.`
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
            `${task.name}: weight ${round(task.weight)}% · ${plan.impossible ? 'maximum 100%' : `aim ${round(plan.required)}%`}`
          )
        );
      }

      if (!course.progress.remaining) {
        block.append(createEl('small', '', 'No unmarked weighted tasks remain.'));
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
        ? `Semester ${i + 1} target grade`
        : `Semester ${i + 1} ATAR\n${result.error ? '—' : result.atar}`;

      semesterButtons[i].hidden = isGradingMode && hasSemesterTwoStarted() && i === 0;
      semesterButtons[i].disabled = semesterButtons[i].hidden || (isPlanningMode && isTargetClosed(i));

      if (isPlanningMode && isTargetClosed(i)) {
        semesterButtons[i].textContent = `Semester ${i + 1} Target ATAR · Closed`;
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
          ? `Semester ${i + 1} target grade`
          : `Semester ${i + 1} ATAR\n${finalAtar}`;

        detailSummary.textContent =
          result.error ||
          `TEA ${round(finalTEA)} = best four ${round(result.base)} + bonuses ${round(
            result.bonus
          )}.` + (yearLevel === 11 ? ' (Year 11 Penalty Applied)' : ` Best four: ${result.top.map(x => x.name).join(', ')}.`);
      }
    }

    if (isPlanningMode) renderTargetOutput();
    if (isGradingMode) renderGradeOutput();
  }

  function renderCourseRows() {
    controlsContainer.innerHTML = '';
    
    // Create Semester 1 Calibration Table (only if there are courses)
    if (courses[0].length > 0 && !isGradingMode && !isPlanningMode) {
      const calibTitle = createEl('h3', 'cx-calculator-subtitle', 'Semester 1 Calibration (Improves Accuracy)');
      calibTitle.style.marginTop = '16px';
      calibTitle.style.marginBottom = '8px';
      calibTitle.style.fontSize = '12px';
      calibTitle.style.fontWeight = 'bold';
      calibTitle.style.color = 'var(--cvr-color-text-secondary)';
      controlsContainer.append(calibTitle);
      
      const calibTable = createEl('div', 'connectea-controls connectea-grid');
      controlsContainer.append(calibTable);
      
      for (const course of courses[0]) {
        const calibEntry = savedPreferences[`sem1_calibration:${course.id}`] || {};
        const knownSem1Raw = calibEntry.raw !== undefined ? calibEntry.raw : course.mark;
        
        const wrapper = createEl('div', 'connectea-subject-row');
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '8px';
        wrapper.style.marginBottom = '4px';
        
        const nameLabel = createEl('span', 'connectea-controls connectea-course-name', course.name);
        nameLabel.style.flex = '1';
        
        const rawInput = createEl('input', 'connectea-subject-score-input');
        rawInput.type = 'number';
        rawInput.placeholder = 'Raw';
        rawInput.title = 'Semester 1 Raw Mark';
        rawInput.value = knownSem1Raw !== undefined ? knownSem1Raw : '';
        rawInput.style.width = '60px';
        
        const scaledInput = createEl('input', 'connectea-subject-score-input');
        scaledInput.type = 'number';
        scaledInput.placeholder = 'Scaled';
        scaledInput.title = 'School Scaled Score';
        scaledInput.value = calibEntry.scaled !== undefined ? calibEntry.scaled : '';
        scaledInput.style.width = '60px';
        
        wrapper.append(nameLabel, rawInput, scaledInput);
        calibTable.append(wrapper);
        
        const updateCalib = () => {
          savedPreferences[`sem1_calibration:${course.id}`] = {
            raw: scoreValue(rawInput.value),
            scaled: scoreValue(scaledInput.value)
          };
          persistPreferences();
          updateResults();
        };
        rawInput.addEventListener('input', updateCalib);
        scaledInput.addEventListener('input', updateCalib);
      }
      
      const estTitle = createEl('h3', 'cx-calculator-subtitle', 'Current Estimate');
      estTitle.style.marginTop = '16px';
      estTitle.style.marginBottom = '8px';
      estTitle.style.fontSize = '12px';
      estTitle.style.fontWeight = 'bold';
      estTitle.style.color = 'var(--cvr-color-text-secondary)';
      controlsContainer.append(estTitle);
    }
    
    // Render standard active semester courses
    for (const course of courses[activeSemester]) {
      const entry = savedPreferences[`${activeSemester}:${course.id}`] || {};
      const wrapper = createEl('label', 'connectea-controls connectea-grid');

      const checkbox = createEl('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'connectea-subject-checkbox';
      checkbox.checked = entry.include ?? course.mark !== undefined;

      const nameSpan = createEl('span', 'connectea-course-name', course.name);
      
      // Calculate what the model estimates for this subject
      const state = getCourseState(course, activeSemester);
      const estMark = state.score !== undefined ? state.score : course.mark;

      const input = createEl('input', 'connectea-subject-score-input');
      input.type = 'number';
      input.min = '0';
      input.max = '100';
      input.step = '1';
      input.placeholder = isGradingMode ? 'Raw' : (estMark !== undefined ? String(estMark) : '');
      input.value = entry.score !== undefined ? entry.score : '';
      input.disabled = !checkbox.checked;
      input.setAttribute('aria-label', `${course.name} semester ${activeSemester + 1} estimated scaled score`);

      checkbox.addEventListener('change', () => {
        entry.include = checkbox.checked;
        savedPreferences[`${activeSemester}:${course.id}`] = entry;
        persistPreferences();
        input.disabled = !checkbox.checked;
        updateResults();
      });

      input.addEventListener('input', () => {
        entry.score = scoreValue(input.value);
        savedPreferences[`${activeSemester}:${course.id}`] = entry;
        persistPreferences();
        updateResults();
      });

      wrapper.append(checkbox, nameSpan, input);
      controlsContainer.append(wrapper);
    }
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

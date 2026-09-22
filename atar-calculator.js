/**
 * Connext ATAR & Grade Calculator
 *
 * Implements the TISC 2025 TEA/ATAR scaling model, Target ATAR planner,
 * and Subject Grade planner. Provides `window.ConnextAtar`.
 */
(() => {
  'use strict';

  // Published facts: TISC 2025 TEA/ATAR summary table, accessed 14 September 2026.
  // https://www.tisc.edu.au/static/guide/atar-about.tisc
  const TEA_ATAR_TABLE = [
    [127.4, 30],
    [157.5, 40.05],
    [178.4, 50],
    [187.4, 55],
    [197.2, 60],
    [198.9, 61],
    [201, 62],
    [202.8, 63],
    [204.6, 64],
    [206.2, 65],
    [207.8, 66],
    [209.7, 67.05],
    [211.7, 68],
    [213.8, 69.05],
    [215.7, 70.05],
    [217.9, 71],
    [220, 72],
    [222.2, 73],
    [224.3, 74],
    [226.4, 75],
    [228.7, 76],
    [231.1, 77],
    [233.1, 78],
    [235.4, 79],
    [237.9, 80],
    [240.3, 81],
    [243, 82],
    [245.7, 83],
    [248.4, 84],
    [251.7, 85],
    [254.9, 86],
    [257.9, 87],
    [261.9, 88],
    [265.5, 89],
    [269.6, 90],
    [273.9, 91],
    [278.5, 92],
    [283.6, 93],
    [289.2, 94],
    [295.3, 95],
    [303.6, 96],
    [313.6, 97],
    [326.7, 98],
    [335.5, 98.5],
    [348.1, 99],
    [364.1, 99.5],
    [375.5, 99.7],
    [385.2, 99.8],
    [395, 99.9],
    [405.5, 99.95]
  ];

  const normalize = text => String(text ?? '').replace(/\s+/g, ' ').trim();

  const scoreValue = value => {
    if (value !== '' && value !== null && value !== undefined) {
      const num = Number(value);
      if (Number.isFinite(num) && num >= 0 && num <= 100) {
        return num;
      }
    }
    return undefined;
  };

  const round = num => Number(num.toFixed(2));

  // User-selected rule: nearest integer, with exact halves rounded down (e.g. 69.5 -> 69, 69.6 -> 70)
  const wholeScore = value => {
    if (scoreValue(value) === undefined) return undefined;
    return Math.max(0, Math.ceil(Number(value) - 0.5));
  };

  const isAtarCourse = title =>
    /\bATAR\b/i.test(title) && !/\bGeneral\b|\bmathematics essentials?\b/i.test(title);

  /**
   * Convert TEA (Tertiary Entrance Aggregate) to ATAR via piecewise linear interpolation.
   */
  function convertTEAtoATAR(tea) {
    if (tea < TEA_ATAR_TABLE[0][0]) return '<30';
    if (tea >= TEA_ATAR_TABLE.at(-1)[0]) return '99.95';

    for (let i = 1; i < TEA_ATAR_TABLE.length; i++) {
      const [teaLower, atarLower] = TEA_ATAR_TABLE[i - 1];
      const [teaUpper, atarUpper] = TEA_ATAR_TABLE[i];

      if (tea <= teaUpper) {
        const interpolated = atarLower + ((tea - teaLower) / (teaUpper - teaLower)) * (atarUpper - atarLower);
        return (Math.round(interpolated * 20) / 20).toFixed(2);
      }
    }
  }

  const LANGUAGE_SUBJECTS = new Set([
    'arabic', 'auslan', 'bengali', 'bosnian', 'chinese', 'croatian', 'dutch',
    'filipino', 'french', 'german', 'hebrew', 'hindi', 'hungarian', 'indonesian',
    'italian', 'japanese', 'korean', 'modern greek', 'persian', 'polish',
    'portuguese', 'punjabi', 'russian', 'serbian', 'sinhala', 'spanish',
    'swedish', 'tamil', 'turkish', 'vietnamese'
  ]);

  function bonusType(name) {
    const normalized = normalize(name).toLowerCase();
    if (normalized === 'mathematics methods' || normalized === 'mathematics specialist') {
      return normalized;
    }
    const language = normalized.split(':')[0].replace(/ (second|first|background) language$/, '').trim();
    return LANGUAGE_SUBJECTS.has(language) ? 'language' : '';
  }

  /**
   * Calculate TEA and ATAR from course score rows.
   * Applies the best 4 subjects rule and 10% LOTE / Methods / Specialist bonuses.
   *
   * @param {Array<{name: string, include: boolean, score: number}>} rows
   */
  function calculate(rows) {
    const eligible = rows.filter(r => !/\bGeneral\b|\bmathematics essentials?\b/i.test(r.name));
    const used = eligible
      .filter(r => r.include && scoreValue(r.score) !== undefined)
      .map(r => ({ ...r, score: wholeScore(r.score) }));

    if (used.length < 4) {
      return { error: 'At least four ATAR subject scores are needed.' };
    }
    if (eligible.some(r => r.include && scoreValue(r.score) === undefined)) {
      return { error: 'Enter a score from 0 to 100 for every included subject.' };
    }

    const sorted = [...used].sort((a, b) => b.score - a.score);
    const topFour = sorted.slice(0, 4);

    const bestLanguage = Math.max(0, ...used.filter(r => bonusType(r.name) === 'language').map(r => r.score));
    const methods = Math.max(0, ...used.filter(r => bonusType(r.name) === 'mathematics methods').map(r => r.score));
    const specialist = Math.max(0, ...used.filter(r => bonusType(r.name) === 'mathematics specialist').map(r => r.score));

    const baseTEA = topFour.reduce((sum, r) => sum + r.score, 0);
    const bonusTEA = (bestLanguage + methods + specialist) * 0.1;
    const totalTEA = Math.min(430, baseTEA + bonusTEA);

    return {
      atar: convertTEAtoATAR(totalTEA),
      tea: totalTEA,
      base: baseTEA,
      bonus: bonusTEA,
      top: topFour
    };
  }

  function parseAssessment(rawScore, weightedMark, name) {
    const scoreMatch = normalize(rawScore).match(/^(\d+(?:\.\d+)?)\s*Out\s+of\s+(\d+(?:\.\d+)?)$/i);
    const isPending = /^[-–—]\s*Out\s+of\s+\d+(?:\.\d+)?$/i.test(normalize(rawScore));
    const weightMatch = normalize(weightedMark).match(/^(?:\d+(?:\.\d+)?|[-–—])\s*Out\s+of\s+(\d+(?:\.\d+)?)$/i);

    if (!weightMatch || (!scoreMatch && !isPending)) return null;

    const weight = Number(weightMatch[1]);
    if (
      weight < 0 ||
      weight > 100 ||
      (scoreMatch && (Number(scoreMatch[2]) <= 0 || Number(scoreMatch[1]) > Number(scoreMatch[2])))
    ) {
      return null;
    }

    const scorePercentage = scoreMatch ? (Number(scoreMatch[1]) / Number(scoreMatch[2])) * 100 : undefined;
    const earnedWeight = scoreMatch ? (Number(scoreMatch[1]) / Number(scoreMatch[2])) * weight : 0;

    return {
      name,
      weight,
      pending: isPending,
      score: scorePercentage,
      earned: earnedWeight
    };
  }

  function taskProgress(tasks, mark, semesterNumber = 2) {
    if (!tasks.length || tasks.some(t => !t)) {
      return { error: 'Assessment weights are missing or unreadable.' };
    }

    const totalWeight = tasks.reduce((sum, t) => sum + t.weight, 0);
    if (totalWeight <= 0 || totalWeight > 100.05) {
      return { error: 'The outline total weight must be greater than 0 and at most 100%.' };
    }
    if (semesterNumber === 2 && Math.abs(totalWeight - 100) > 0.05) {
      return {
        error: `Visible annual weights total ${round(totalWeight)}%, not 100%. Expand the complete semester 2 outline.`
      };
    }

    const remainingWeight = tasks.filter(t => t.pending).reduce((sum, t) => sum + t.weight, 0);
    const earnedWeight = tasks.reduce((sum, t) => sum + t.earned, 0);
    const completedWeight = totalWeight - remainingWeight;

    if (completedWeight > 0 && scoreValue(mark) !== undefined && Math.abs((earnedWeight / completedWeight) * 100 - mark) > 1.5) {
      return { error: 'Task weights do not reconcile with the displayed overall mark.' };
    }

    return {
      earned: (earnedWeight / totalWeight) * 100,
      remaining: (remainingWeight / totalWeight) * 100,
      total: totalWeight,
      rawEarned: earnedWeight,
      rawRemaining: remainingWeight,
      allTasks: tasks,
      tasks: tasks.filter(t => t.pending && t.weight > 0)
    };
  }

  function gradePlan(progress, target) {
    if (progress.error) return { error: progress.error };
    if (scoreValue(target) === undefined) {
      return { error: 'Enter an overall target percentage from 0 to 100.' };
    }

    const maximum = progress.earned + progress.remaining;
    if (target > maximum + 1e-9) {
      return { impossible: true, maximum };
    }
    if (progress.remaining <= 1e-9) {
      return { finished: true, maximum, final: progress.earned };
    }

    const exactRequired = Math.max(0, ((target - progress.earned) / progress.remaining) * 100);
    return {
      required: Math.min(100, Math.ceil((exactRequired - 1e-9) * 10) / 10),
      maximum
    };
  }

  function targetPlan(rows, target) {
    if (!Number.isFinite(target) || target < 30 || target > 99.95) {
      return { error: 'Enter a target ATAR from 30 to 99.95.' };
    }
    if (rows.length < 4) {
      return { error: 'Include at least four ATAR subjects.' };
    }

    const missing = rows.filter(r => r.progress.error);
    if (missing.length) {
      return { error: missing.map(r => `${r.name}: ${r.progress.error}`).join('\n') };
    }

    const projectedRows = p =>
      rows.map(r => ({
        name: r.name,
        include: true,
        score: Math.max(0, Math.min(100, r.progress.earned + (r.progress.remaining * p) / 100 + r.offset))
      }));

    const calculateAtPercentage = p => calculate(projectedRows(p));
    const reachesTarget = r => !r.error && r.atar !== '<30' && Number(r.atar) >= target;

    const maximumResult = calculateAtPercentage(100);
    if (maximumResult.error) return { error: maximumResult.error };
    if (!reachesTarget(maximumResult)) {
      return { impossible: true, maximum: maximumResult, rows: projectedRows(100) };
    }

    // Binary search for the minimum required score across remaining assessments
    let low = 0;
    let high = 100;
    if (reachesTarget(calculateAtPercentage(0))) {
      high = 0;
    } else {
      for (let i = 0; i < 50; i++) {
        const mid = (low + high) / 2;
        if (reachesTarget(calculateAtPercentage(mid))) {
          high = mid;
        } else {
          low = mid;
        }
      }
    }

    let required = Math.min(100, Math.ceil(high * 10) / 10);
    if (!reachesTarget(calculateAtPercentage(required))) {
      required = Math.min(100, required + 0.1);
    }

    return {
      required,
      maximum: maximumResult,
      result: calculateAtPercentage(required),
      rows: projectedRows(required)
    };
  }

  // Publish public calculation API
  if (typeof window !== 'undefined') {
    window.ConnextAtar = { calculate };
  }

  /**
   * Scrapes courses and tasks from assessment outline cards in the page.
   */
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
    return {
      ...row,
      include: entry?.include ?? row.mark !== undefined,
      score: wholeScore(entry?.score !== undefined ? entry.score : row.mark)
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

  window.ConnextAtar.toolButtons = [estimateTab, targetTab, gradeTab];

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
    window.ConnextData?.expandAll();
    refreshData();
    calculatorPanel.hidden = false;
    window.dispatchEvent(new CustomEvent('connext-open', { detail: 'calculator' }));
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
        const yearLevel = Array.from(document.querySelectorAll('.eds-c-tile__title')).some(el => /\b(?:12|Twelve)\b/i.test(el.textContent)) ? 12 : 11;
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
    const eligible = isAtarEligible();
    estimateTab.hidden = targetTab.hidden = !eligible;
    if (!eligible && !isGradingMode) {
      selectTab('grade');
      return;
    }

    courseListContainer.replaceChildren();

    if (!courses[activeSemester].length) {
      courseListContainer.append(
        createEl('p', '', 'No ATAR subjects found for this semester. Show all classes in Connect.')
      );
    }

    for (const course of courses[activeSemester]) {
      const current = getCourseState(course, activeSemester);
      const semesterIdx = activeSemester;

      const row = createEl('div', 'cta-course');
      const label = createEl('label', 'cta-include');

      const checkbox = createEl('input');
      checkbox.type = 'checkbox';
      checkbox.checked = current.include;
      label.append(checkbox, createEl('span', '', course.name));

      const input = createEl('input', 'cta-score');
      input.type = 'number';
      input.min = '0';
      input.max = '100';
      input.step = 'any';
      input.value = current.score ?? '';
      input.setAttribute('aria-label', `${course.name} semester ${semesterIdx + 1} estimated scaled score`);

      const source = createEl(
        'small',
        '',
        course.mark === undefined
          ? 'No school mark'
          : `School ${round(course.mark)}%`
      );

      const updateCourse = () => {
        savedPreferences[`${semesterIdx}:${course.id}`] = {
          include: checkbox.checked,
          score: input.value
        };
        input.setAttribute('aria-invalid', String(checkbox.checked && scoreValue(input.value) === undefined));
        persistPreferences();
        updateResults();
      };

      checkbox.addEventListener('change', updateCourse);
      input.addEventListener('input', updateCourse);
      input.addEventListener('change', () => {
        const score = wholeScore(input.value);
        if (score !== undefined) {
          input.value = score;
          updateCourse();
        }
      });

      row.append(label, input, source);
      courseListContainer.append(row);
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

  window.addEventListener('connext-open', e => {
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

  window.ConnextAtar.readCourses = readCourses;

  setInterval(refreshData, 1500);
  refreshData();
})();

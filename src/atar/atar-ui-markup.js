/**
 * Connectify ATAR calculator: panel markup
 *
 * Builds the calculator panel (#connectea-atar): the Goal Setting and Estimator launchers the sidebar
 * mounts, the mode tabs (Target ATAR / Target Grade, Estimate ATAR / Estimate Grade), the semester
 * buttons, course list, summary, reset and Expand All Outlines buttons, and the
 * methodology notes; plus the semester labels and closing rules. Behaviour lives in atar-ui.js.
 * Exposes window.ConnectifyAtarMarkup.
 */
(() => {
  'use strict';

  const { createEl } = window.ConnectifyTargetUiHelpers;

  const METHOD_NOTES = [
    'Scores round to whole numbers before the best four and bonuses are calculated; exact .5 values round down (69.9 → 70; 69.5 → 69). Each school mark (entered or from Connect) is scaled with TISC Average Marks Scaling; best four included scaled scores, plus 10% of Methods, 10% of Specialist and 10% of the best language score. General and other non-ATAR courses are excluded. Estimates interpolate the published 2025 TISC table. Below the table range, <30 is shown.',
    'Semester 2 uses the cumulative percentage shown by Connect. This does not check WACE eligibility, English competency or unacceptable course combinations. Exclude an incompatible course before calculating. No marks are sent to another website.'
  ];

  // Each launcher opens one group of modes; the tabs under the heading switch between its modes
  const GROUPS = {
    goals: { title: 'Goal Setting', launcher: 'connectify-goals-toggle', modes: ['target', 'grade'] },
    estimator: { title: 'Estimator', launcher: 'connectify-estimator-toggle', modes: ['estimate', 'grade-estimate'] }
  };
  const MODES = {
    target: { tab: 'Target ATAR', title: 'Target ATAR Planner' },
    grade: { tab: 'Target Grade', title: 'Target Grade Planner' },
    estimate: { tab: 'Estimate ATAR', title: 'Estimated ATAR' },
    'grade-estimate': { tab: 'Estimate Grade', title: 'Estimated Grade' }
  };
  const groupOf = mode => Object.keys(GROUPS).find(g => GROUPS[g].modes.includes(mode));
  // Target Grade and Estimate Grade pick one class, so their semester buttons carry no ATAR
  const isGradeMode = mode => mode === 'grade' || mode === 'grade-estimate';

  function toolTab(group) {
    const button = createEl('button', 'cx-calculator-tool', GROUPS[group].title);
    button.type = 'button';
    button.id = GROUPS[group].launcher;
    button.setAttribute('aria-controls', 'connectea-atar');
    return button;
  }

  // The mode tabs share the Predictor's tab bar (.cx-pred-main-tabs), so both tools look alike in every theme
  function modeTabBar() {
    const bar = createEl('div', 'cx-pred-main-tabs cta-mode-tabs');
    bar.setAttribute('role', 'tablist');
    const buttons = {};
    for (const mode of Object.keys(MODES)) {
      const btn = createEl('button', 'cx-pred-main-tab cta-mode-tab', MODES[mode].tab);
      btn.type = 'button';
      btn.dataset.mode = mode;
      btn.setAttribute('role', 'tab');
      buttons[mode] = btn;
      bar.append(btn);
    }
    return { bar, buttons };
  }

  /** Shows the active group's tabs and selects the active mode's. */
  function paintModeTabs(buttons, mode) {
    for (const [tabMode, btn] of Object.entries(buttons)) {
      btn.hidden = groupOf(tabMode) !== groupOf(mode);
      btn.classList.toggle('active', tabMode === mode);
      btn.setAttribute('aria-selected', String(tabMode === mode));
    }
  }

  /** The panel and its static parts; semester buttons are added by the caller. */
  function build() {
    const calculatorPanel = createEl('aside', '', '');
    calculatorPanel.id = 'connectea-atar';
    calculatorPanel.hidden = true;
    calculatorPanel.setAttribute('aria-label', '2025 ATAR estimates');

    const headingContainer = createEl('div', 'cta-heading');
    const panelTitle = createEl('strong', '', GROUPS.estimator.title);
    panelTitle.tabIndex = -1;
    headingContainer.append(panelTitle);
    const modeTabs = modeTabBar();

    const resetBtn = createEl('button', 'cta-reset', 'Reset to School Marks');
    resetBtn.type = 'button';
    const expandAllBtn = createEl('button', 'cta-reset cta-expand-outlines', 'Expand All Outlines');
    expandAllBtn.type = 'button';
    expandAllBtn.style.marginLeft = '8px';

    const calculationDetails = createEl('details', 'cta-method');
    calculationDetails.append(createEl('summary', '', 'Calculation Methodology & Sources'));
    for (const note of METHOD_NOTES) calculationDetails.append(createEl('p', '', note));

    const detailSummary = createEl('p', 'cta-breakdown');
    detailSummary.setAttribute('aria-live', 'polite');
    const semesterCardsContainer = createEl('div', 'cta-semesters');
    const courseListContainer = createEl('div', 'cta-courses');

    calculatorPanel.append(headingContainer, modeTabs.bar, semesterCardsContainer, courseListContainer, detailSummary, resetBtn, expandAllBtn, calculationDetails);
    return {
      calculatorPanel,
      panelTitle,
      goalsTab: toolTab('goals'),
      estimatorTab: toolTab('estimator'),
      modeButtons: modeTabs.buttons,
      semesterCardsContainer,
      courseListContainer,
      detailSummary,
      resetBtn,
      expandAllBtn,
      calculationDetails
    };
  }

  // Semester 2 starts only once a class has a final A–E grade. Semester 2 marks never count: the
  // cumulative percent and the Semester 1 task rows on a Semester 2 panel are marked from day one, and a
  // Semester 2 task can be marked before Semester 1 grades are final.
  const hasSemesterTwoStarted = gradeCourses =>
    (gradeCourses?.[0] || []).some(r => r?.finalLetter) ||
    (gradeCourses?.[1] || []).some(r => r?.finalLetter);

  /**
   * A semester closes in every mode (both estimates, Target ATAR, Target Grade) once its A–E grades are final
   * (Semester 1 task marks on a Semester 2 panel never close it); Semester 2 stays closed until it has classes.
   */
  function isTargetClosed(gradeCourses, semesterIdx) {
    if ((gradeCourses?.[semesterIdx] || []).some(r => r?.finalLetter)) return true;
    return semesterIdx === 1 && (gradeCourses?.[1] || []).length === 0;
  }

  /** A semester button's label for the current mode. */
  function semesterLabel(i, res, mode, isClosed) {
    if (isGradeMode(mode)) return isClosed ? `Semester ${i + 1} (Closed)` : `Semester ${i + 1}`;
    if (mode === 'target') return isClosed ? `Semester ${i + 1} Target ATAR (Closed)` : `Semester ${i + 1} Target ATAR`;
    const atar = res.error ? '—' : (res.finalAtar || res.atar || '—');
    return isClosed ? `Semester ${i + 1} ATAR (Closed)\n${atar}` : `Semester ${i + 1} ATAR\n${atar}`;
  }

  /** Label, state and style of one semester button. */
  function paintSemesterButton(btn, i, res, mode, isClosed, isActive) {
    btn.textContent = semesterLabel(i, res, mode, isClosed);
    btn.hidden = false;
    btn.disabled = isClosed;
    btn.className = isClosed ? 'cta-semester cta-semester-closed' : isActive ? 'cta-semester cta-semester-indicator' : 'cta-semester';
    btn.setAttribute('aria-pressed', String(isActive));
  }

  /** The two semester buttons; onSelect(semesterIdx) runs on click. */
  function semesterButtons(container, onSelect) {
    return [0, 1].map(semesterIdx => {
      const btn = createEl('button', 'cta-semester', `Semester ${semesterIdx + 1}`);
      btn.type = 'button';
      btn.addEventListener('click', () => onSelect(semesterIdx));
      container.append(btn);
      return btn;
    });
  }

  window.ConnectifyAtarMarkup = { GROUPS, MODES, groupOf, isGradeMode, paintModeTabs, build, semesterLabel, paintSemesterButton, semesterButtons, hasSemesterTwoStarted, isTargetClosed };
})();

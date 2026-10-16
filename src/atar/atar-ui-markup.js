/**
 * Connectify ATAR calculator: panel markup
 *
 * Builds the calculator panel (#connectea-atar): the three tool tabs that the sidebar mounts as
 * launchers, the semester buttons, course list, summary, reset and Expand All Outlines buttons, and the
 * methodology notes; plus the semester labels and closing rules. Behaviour lives in atar-ui.js.
 * Exposes window.ConnectifyAtarMarkup.
 */
(() => {
  'use strict';

  const { createEl } = window.ConnectifyTargetUiHelpers;

  const METHOD_NOTES = [
    'Scores round to whole numbers before the best four and bonuses are calculated; exact .5 values round down (69.9 → 70; 69.5 → 69). Best four included scaled-score assumptions, plus 10% of Methods, 10% of Specialist and 10% of the best language score. General and other non-ATAR courses are excluded. Estimates interpolate the published 2025 TISC table. Below the table range, <30 is shown.',
    'Semester 2 uses the cumulative percentage shown by Connect. This does not check WACE eligibility, English competency or unacceptable course combinations. Exclude an incompatible course before calculating. No marks are sent to another website.'
  ];

  function toolTab(label, id) {
    const button = createEl('button', 'cx-calculator-tool', label);
    button.type = 'button';
    button.id = id;
    button.setAttribute('aria-controls', 'connectea-atar');
    return button;
  }

  /** The panel and its static parts; semester buttons are added by the caller. */
  function build() {
    const calculatorPanel = createEl('aside', '', '');
    calculatorPanel.id = 'connectea-atar';
    calculatorPanel.hidden = true;
    calculatorPanel.setAttribute('aria-label', '2025 ATAR estimates');

    const headingContainer = createEl('div', 'cta-heading');
    const panelTitle = createEl('strong', '', 'Estimated ATAR');
    panelTitle.tabIndex = -1;
    headingContainer.append(panelTitle);

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

    calculatorPanel.append(headingContainer, semesterCardsContainer, courseListContainer, detailSummary, resetBtn, expandAllBtn, calculationDetails);
    return {
      calculatorPanel,
      panelTitle,
      estimateTab: toolTab('ATAR Estimate', 'connectify-estimate-toggle'),
      targetTab: toolTab('Target ATAR', 'connectify-target-toggle'),
      gradeTab: toolTab('Target Grade', 'connectify-grade-toggle'),
      semesterCardsContainer,
      courseListContainer,
      detailSummary,
      resetBtn,
      expandAllBtn,
      calculationDetails
    };
  }

  /** Semester 2 has begun once Semester 1 grades are final or a Semester 2 mark exists. */
  const hasSemesterTwoStarted = gradeCourses =>
    (gradeCourses?.[0] || []).some(r => r?.finalLetter) ||
    (gradeCourses?.[1] || []).some(r => r?.mark !== undefined && r?.mark > 0);

  /** Targets close for a semester once its grades are final; Semester 2 stays closed until it has classes. */
  function isTargetClosed(gradeCourses, semesterIdx) {
    if ((gradeCourses?.[semesterIdx] || []).some(r => r?.finalLetter)) return true;
    return semesterIdx === 1 && (gradeCourses?.[1] || []).length === 0;
  }

  /** A semester button's label for the current mode. */
  function semesterLabel(i, res, mode, isClosed) {
    if (mode === 'grade') return isClosed ? `Semester ${i + 1} (Closed)` : `Semester ${i + 1}`;
    if (mode === 'target') return isClosed ? `Semester ${i + 1} Target ATAR (Closed)` : `Semester ${i + 1} Target ATAR`;
    return `Semester ${i + 1} ATAR\n${res.error ? '—' : (res.finalAtar || res.atar || '—')}`;
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

  window.ConnectifyAtarMarkup = { build, semesterLabel, paintSemesterButton, semesterButtons, hasSemesterTwoStarted, isTargetClosed };
})();

/**
 * Connectify ATAR UI & Calculator Interface
 *
 * Coordinates the ATAR estimate view, Target ATAR planner, and Target Grade planner modals.
 * Delegates data scraping to ConnectifyAtarScraper, calculations to ConnectifyAtarCalc,
 * and planner forms to ConnectifyTargetPlannerUI.
 * Provides `window.ConnectifyAtar`.
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
    const plannerUI = () => window.ConnectifyTargetPlannerUI;

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

    // Planner UI Context
    const plannerContext = {
      calc,
      getActiveSemester: () => activeSemester,
      getCourses: () => courses,
      getGradeCourses: () => gradeCourses,
      isTargetClosed,
      renderTargetOutput: () => {
        if (plannerUI() && plannerRefs) {
          plannerUI().renderTargetOutput(plannerRefs, plannerContext);
        }
      },
      renderGradeOutput: () => {
        if (plannerUI() && gradeRefs) {
          plannerUI().renderGradeOutput(gradeRefs, plannerContext);
        }
      },
      scanAndRefresh: (allSubjects = false) => {
        if (scraper?.scanOutlineDetails) {
          scraper.scanOutlineDetails(allSubjects, activeSemester);
        }
        refreshData();
        if (isGradingMode) plannerContext.renderGradeOutput();
        else plannerContext.renderTargetOutput();
      }
    };

    let plannerRefs = null;
    let gradeRefs = null;

    if (plannerUI()) {
      plannerRefs = plannerUI().createPlannerView(plannerContext);
      gradeRefs = plannerUI().createGradeView(plannerContext);
    }

    calculatorPanel.append(
      headingContainer,
      semesterCardsContainer,
      courseListContainer,
      detailSummary,
      resetBtn,
      calculationDetails
    );

    if (plannerRefs) calculatorPanel.append(plannerRefs.container);
    if (gradeRefs) calculatorPanel.append(gradeRefs.container);

    document.body.append(calculatorPanel);

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

      if (plannerRefs) plannerRefs.container.hidden = !isPlanningMode;
      if (gradeRefs) gradeRefs.container.hidden = !isGradingMode;

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

    selectTab('estimate');

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

      if (isPlanningMode && plannerRefs) plannerContext.renderTargetOutput();
      if (isGradingMode && gradeRefs) plannerContext.renderGradeOutput();
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

    setInterval(() => {
      if (window.ConnectifyIsUserActive && !window.ConnectifyIsUserActive()) return;
      refreshData();
    }, 1500);
    refreshData();
  } catch (err) {
    console.error('Connectify error in atar-ui.js:', err);
  }
})();

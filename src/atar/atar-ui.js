/**
 * Connectify ATAR UI & Calculator Interface
 *
 * Coordinates the ATAR estimate view, Target ATAR planner and Target Grade planner in one panel.
 * Markup: atar-ui-markup.js; scraping: ConnectifyAtarScraper; calculations: ConnectifyAtarCalc;
 * planner forms: ConnectifyTargetPlannerUI. Provides `window.ConnectifyAtar`.
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

    const markupMod = window.ConnectifyAtarMarkup;
    const {
      calculatorPanel, panelTitle, estimateTab, targetTab, gradeTab,
      semesterCardsContainer, courseListContainer, detailSummary, resetBtn, expandAllBtn, calculationDetails
    } = markupMod.build();
    const toolTabs = [estimateTab, targetTab, gradeTab];

    window.ConnectifyAtar.calculatorButtons = [estimateTab, targetTab, gradeTab];
    window.ConnectifyAtar.toolButtons = toolTabs;
    window.ConnectifyAtar.calculatorPanel = calculatorPanel;
    if (window.ConnectifyInitSidebar) window.ConnectifyInitSidebar();

    // The tabs are the sidebar launchers, so their pressed state is the sidebar's too
    function setPressed(mode) {
      estimateTab.setAttribute('aria-pressed', String(mode === 'estimate'));
      targetTab.setAttribute('aria-pressed', String(mode === 'target'));
      gradeTab.setAttribute('aria-pressed', String(mode === 'grade'));
    }
    const currentMode = () => (isPlanningMode ? 'target' : isGradingMode ? 'grade' : 'estimate');

    const hasSemesterTwoStarted = () => markupMod.hasSemesterTwoStarted(gradeCourses);
    const isTargetClosed = semesterIdx => markupMod.isTargetClosed(gradeCourses, semesterIdx);

    const semesterButtons = markupMod.semesterButtons(semesterCardsContainer, semesterIdx => {
      if ((isPlanningMode || isGradingMode) && isTargetClosed(semesterIdx)) return;
      activeSemester = semesterIdx;
      renderCourseRows();
    });

    resetBtn.addEventListener('click', () => {
      if (calc?.resetPreferencesForSemester) {
        calc.resetPreferencesForSemester(courses[activeSemester], activeSemester);
      }
      renderCourseRows();
    });

    expandAllBtn.addEventListener('click', () => {
      if (window.ConnectifyData?.expandAll) {
        window.ConnectifyData.expandAll(true);
      }
      plannerContext.scanAndRefresh();
    });

    // Planner UI Context
    const plannerContext = {
      calc,
      getActiveSemester: () => activeSemester,
      getCourses: () => courses,
      getGradeCourses: () => gradeCourses,
      isTargetClosed,
      renderTargetOutput: () => plannerRefs && plannerUI()?.renderTargetOutput(plannerRefs, plannerContext),
      renderGradeOutput: () => gradeRefs && plannerUI()?.renderGradeOutput(gradeRefs, plannerContext),
      scanAndRefresh: () => {
        setTimeout(() => {
          if (window.ConnectifyData?.collect) {
            window.ConnectifyData.collect(true);
          }
          lastStateSignature = '';
          refreshData();
          if (isGradingMode) plannerContext.renderGradeOutput();
          else plannerContext.renderTargetOutput();
        }, 300);
      }
    };

    let plannerRefs = null;
    let gradeRefs = null;

    if (plannerUI()) {
      plannerRefs = plannerUI().createPlannerView(plannerContext);
      gradeRefs = plannerUI().createGradeView(plannerContext);
    }

    if (plannerRefs) calculatorPanel.append(plannerRefs.container);
    if (gradeRefs) calculatorPanel.append(gradeRefs.container);

    document.body.append(calculatorPanel);

    function selectTab(mode) {
      isPlanningMode = mode === 'target';
      isGradingMode = mode === 'grade';

      panelTitle.textContent = isPlanningMode ? 'Target ATAR Planner' : isGradingMode ? 'Target Grade Planner' : 'Estimated ATAR';

      calculatorPanel.setAttribute('aria-label', panelTitle.textContent);

      if (isGradingMode && (hasSemesterTwoStarted() || isTargetClosed(0))) {
        activeSemester = 1;
      }

      setPressed(currentMode());

      courseListContainer.hidden = detailSummary.hidden = resetBtn.hidden = expandAllBtn.hidden = calculationDetails.hidden =
        isPlanningMode || isGradingMode;

      if (plannerRefs) plannerRefs.container.hidden = !isPlanningMode;
      if (gradeRefs) gradeRefs.container.hidden = !isGradingMode;

      renderCourseRows();
      if (isPlanningMode && plannerRefs) plannerContext.renderTargetOutput();
      if (isGradingMode && gradeRefs) plannerContext.renderGradeOutput();
    }

    function openCalculator(mode) {
      calculatorPanel.hidden = false;
      lastStateSignature = '';
      refreshData();
      window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'calculator' }));
      selectTab(mode);
      panelTitle.focus();
    }

    estimateTab.addEventListener('click', () => openCalculator('estimate'));
    targetTab.addEventListener('click', () => openCalculator('target'));
    gradeTab.addEventListener('click', () => openCalculator('grade'));
    selectTab('estimate');
    setPressed(null);

    function updateResults() {
      if (isGradingMode && (hasSemesterTwoStarted() || isTargetClosed(0))) {
        activeSemester = 1;
      }
      if ((isPlanningMode || isGradingMode) && isTargetClosed(activeSemester) && !isTargetClosed(1 - activeSemester)) {
        activeSemester = 1 - activeSemester;
      }

      let results = [{}, {}];
      try {
        results = calc?.calculateResults ? calc.calculateResults(courses) : [{}, {}];
      } catch (err) {
        console.warn('Connectify atar-ui calculateResults error:', err);
        results = [{ error: err.message }, { error: err.message }];
      }

      for (let i = 0; i < 2; i++) {
        const res = results[i] || {};
        const isClosed = (isPlanningMode || isGradingMode) && isTargetClosed(i);

        markupMod.paintSemesterButton(semesterButtons[i], i, res, currentMode(), isClosed, i === activeSemester);
        if (i === activeSemester) detailSummary.textContent = res.detailText || res.error || 'Calculating ATAR...';
      }

      if (isPlanningMode && plannerRefs) plannerContext.renderTargetOutput();
      if (isGradingMode && gradeRefs) plannerContext.renderGradeOutput();
    }

    function renderCourseRows() {
      if (calc?.renderCourseList) {
        calc.renderCourseList(courseListContainer, courses, activeSemester, updateResults);
      }
      updateResults();
    }

    function refreshData() {
      if (!scraper) return;
      if (calculatorPanel.hidden) {
        lastStateSignature = '';
        return;
      }
      const nextCourses = scraper.readCourses(false);
      const eligible = scraper.isAtarEligible();
      const signature = JSON.stringify([eligible, nextCourses]);

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
        setPressed(null);
      }
    });

    function closeCalculator() {
      calculatorPanel.hidden = true;
      setPressed(null);
      (isGradingMode ? gradeTab : isPlanningMode ? targetTab : estimateTab).focus();
    }

    calculatorPanel.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeCalculator();
    });

    window.ConnectifyAtar.openCalculator = openCalculator;
    window.ConnectifyAtar.selectTab = selectTab;
    window.ConnectifyAtar.refreshData = refreshData;
    window.ConnectifyAtar.updateResults = updateResults;

    // Only an open calculator re-reads courses on the shared heartbeat
    window.ConnectifyScheduler.every(1500, refreshData, { when: () => !calculatorPanel.hidden });
    refreshData();
  } catch (err) {
    console.error('Connectify error in atar-ui.js:', err);
  }
})();

/**
 * Connectify ATAR UI & Calculator Interface
 *
 * Coordinates the calculator panel's four modes in two launcher groups: Goal Setting (Target ATAR,
 * Target Grade) and Estimator (Estimate ATAR, Estimate Grade). Markup and groups: atar-ui-markup.js;
 * scraping: ConnectifyAtarScraper; calculations: ConnectifyAtarCalc; planner forms:
 * ConnectifyTargetPlannerUI; Estimate Grade: ConnectifyGradeEstimateUI. Provides `window.ConnectifyAtar`.
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

    if (math.calculate) window.ConnectifyAtar.calculate = math.calculate;

    let courses = [[], []];
    let gradeCourses = [[], []];
    let activeSemester = 1;
    let lastStateSignature = '';
    let mode = 'estimate';

    const markupMod = window.ConnectifyAtarMarkup;
    const {
      calculatorPanel, panelTitle, goalsTab, estimatorTab, modeButtons,
      semesterCardsContainer, courseListContainer, detailSummary, resetBtn, expandAllBtn, calculationDetails
    } = markupMod.build();
    const launchers = { goals: goalsTab, estimator: estimatorTab };
    // The mode each launcher reopens on
    const lastMode = { goals: 'target', estimator: 'estimate' };

    window.ConnectifyAtar.calculatorButtons = [goalsTab, estimatorTab];
    window.ConnectifyAtar.toolButtons = window.ConnectifyAtar.calculatorButtons;
    window.ConnectifyAtar.calculatorPanel = calculatorPanel;
    if (window.ConnectifyInitSidebar) window.ConnectifyInitSidebar();

    // The launchers are the sidebar's, so their pressed state is the sidebar's too (null: closed)
    function setPressed(activeMode) {
      const group = activeMode && markupMod.groupOf(activeMode);
      for (const [name, btn] of Object.entries(launchers)) btn.setAttribute('aria-pressed', String(name === group));
    }
    const isGradeMode = () => markupMod.isGradeMode(mode);

    const hasSemesterTwoStarted = () => markupMod.hasSemesterTwoStarted(gradeCourses);
    const isTargetClosed = semesterIdx => markupMod.isTargetClosed(gradeCourses, semesterIdx);

    const semesterButtons = markupMod.semesterButtons(semesterCardsContainer, semesterIdx => {
      if (isTargetClosed(semesterIdx)) return;
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
      window.ConnectifyData?.expandAll?.(true);
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
      renderEstimateOutput: () => estimateRefs && window.ConnectifyGradeEstimateUI.render(estimateRefs, plannerContext),
      renderModeOutput: () => {
        if (mode === 'target') plannerContext.renderTargetOutput();
        else if (mode === 'grade') plannerContext.renderGradeOutput();
        else if (mode === 'grade-estimate') plannerContext.renderEstimateOutput();
      },
      scanAndRefresh: () => {
        setTimeout(() => {
          if (window.ConnectifyData?.collect) {
            window.ConnectifyData.collect(true);
          }
          lastStateSignature = '';
          refreshData();
          plannerContext.renderModeOutput();
        }, 300);
      }
    };

    let plannerRefs = null;
    let gradeRefs = null;
    const estimateRefs = window.ConnectifyGradeEstimateUI?.createView(plannerContext) || null;

    if (plannerUI()) {
      plannerRefs = plannerUI().createPlannerView(plannerContext);
      gradeRefs = plannerUI().createGradeView(plannerContext);
    }

    if (plannerRefs) calculatorPanel.append(plannerRefs.container);
    if (gradeRefs) calculatorPanel.append(gradeRefs.container);
    if (estimateRefs) calculatorPanel.append(estimateRefs.container);

    document.body.append(calculatorPanel);

    function selectTab(nextMode) {
      mode = markupMod.MODES[nextMode] ? nextMode : 'estimate';
      const group = markupMod.groupOf(mode);
      lastMode[group] = mode;

      panelTitle.textContent = markupMod.GROUPS[group].title;
      calculatorPanel.setAttribute('aria-label', markupMod.MODES[mode].title);
      markupMod.paintModeTabs(modeButtons, mode);

      if (isGradeMode() && (hasSemesterTwoStarted() || isTargetClosed(0))) {
        activeSemester = 1;
      }

      setPressed(mode);

      courseListContainer.hidden = detailSummary.hidden = resetBtn.hidden = expandAllBtn.hidden = calculationDetails.hidden =
        mode !== 'estimate';

      if (plannerRefs) plannerRefs.container.hidden = mode !== 'target';
      if (gradeRefs) gradeRefs.container.hidden = mode !== 'grade';
      if (estimateRefs) estimateRefs.container.hidden = mode !== 'grade-estimate';

      renderCourseRows();
    }

    /** Opens the panel on a group (its last mode) or on one mode. */
    function openCalculator(groupOrMode) {
      calculatorPanel.hidden = false;
      lastStateSignature = '';
      refreshData();
      window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'calculator' }));
      selectTab(lastMode[groupOrMode] || groupOrMode);
      panelTitle.focus();
    }

    goalsTab.addEventListener('click', () => openCalculator('goals'));
    estimatorTab.addEventListener('click', () => openCalculator('estimator'));
    for (const [tabMode, btn] of Object.entries(modeButtons)) btn.addEventListener('click', () => selectTab(tabMode));
    selectTab('estimate');
    setPressed(null);

    function updateResults() {
      if (isGradeMode() && (hasSemesterTwoStarted() || isTargetClosed(0))) {
        activeSemester = 1;
      }
      if (isTargetClosed(activeSemester) && !isTargetClosed(1 - activeSemester)) {
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
        const isClosed = isTargetClosed(i);

        markupMod.paintSemesterButton(semesterButtons[i], i, res, mode, isClosed, i === activeSemester);
        if (i === activeSemester) detailSummary.textContent = res.detailText || res.error || 'Calculating ATAR...';
      }

      plannerContext.renderModeOutput();
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
      launchers[markupMod.groupOf(mode)].focus();
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

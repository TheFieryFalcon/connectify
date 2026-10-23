/**
 * Connectify Predictions panel (Predict Grade, Predict ATAR)
 *
 * The Predictor tool (#connectify-predictor, launcher #connectify-predictor-toggle) with Grade and
 * ATAR tabs. Grade views come from predictor-grade-view.js, the shell and ATAR view from
 * predictor-atar-view.js. Exposes window.ConnectifyPredictorUI.
 */
(() => {
  'use strict';

  if (window.ConnectifyPredictorUI) return;

  const views = window.ConnectifyPredictorAtarView;
  let activeMainTab = 'grade'; // 'grade' | 'atar'
  let activeSubjectIndex = 0;
  let predictorInstance = null;

  function createPredictorPanel() {
    let toggleBtn = document.getElementById('connectify-predictor-toggle');
    if (!toggleBtn) {
      toggleBtn = document.createElement('button');
      toggleBtn.textContent = 'Predictor';
      toggleBtn.type = 'button';
      toggleBtn.id = 'connectify-predictor-toggle';
      toggleBtn.className = 'cx-calculator-tool';
      toggleBtn.setAttribute('aria-controls', 'connectify-predictor');
      toggleBtn.setAttribute('aria-pressed', 'false');
    }

    let panel = document.getElementById('connectify-predictor');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'connectify-predictor';
      panel.hidden = true;
      panel.className = 'cx-workspace-panel';
      panel.setAttribute('aria-label', 'Predictor');
    }

    function renderPanel() {
      const livePanel = document.getElementById('connectify-predictor') || panel;
      const predMath = window.ConnectifyPredictorMath;
      if (!predMath) {
        livePanel.innerHTML = views.loadingHtml();
        return;
      }

      let allProjectedSubjects = [];
      try {
        // Only the classes "Show this semester's classes only" keeps, from the centralized cache
        allProjectedSubjects = predMath.projectSubjectGrades(window.ConnectifyData?.collectClasses?.(true)) || [];
      } catch (err) {
        console.error('Error projecting subject grades in Predictor:', err);
        allProjectedSubjects = [];
      }
      livePanel.innerHTML = views.panelHtml(activeMainTab);

      const content = livePanel.querySelector('#cx-pred-content');
      if (!content) return;

      if (activeMainTab === 'grade') {
        renderGradePredictor(content, allProjectedSubjects);
      } else {
        renderAtarPredictor(content, allProjectedSubjects);
      }
    }

    function renderGradePredictor(container, subjects) {
      if (window.ConnectifyPredictorGradeView?.renderGradePredictor) {
        window.ConnectifyPredictorGradeView.renderGradePredictor(
          container,
          subjects,
          activeSubjectIndex,
          idx => { activeSubjectIndex = idx; },
          renderPanel
        );
      }
    }

    function renderAtarPredictor(container, allSubjects) {
      views.renderAtarPredictor(container, window.ConnectifyPredictorMath.projectATAR(allSubjects));
    }

    function openPredictor() {
      const livePanel = document.getElementById('connectify-predictor') || panel;
      const liveBtn = document.getElementById('connectify-predictor-toggle') || toggleBtn;
      const sidebar = document.getElementById('connectify-sidebar');
      const workspace = sidebar?.querySelector('.cx-workspace');

      if (workspace && !workspace.contains(livePanel)) {
        workspace.append(livePanel);
      }

      livePanel.hidden = false;
      liveBtn.setAttribute('aria-pressed', 'true');
      window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'predictor' }));

      renderPanel();
    }

    function closePredictor() {
      const livePanel = document.getElementById('connectify-predictor') || panel;
      const liveBtn = document.getElementById('connectify-predictor-toggle') || toggleBtn;
      livePanel.hidden = true;
      liveBtn.setAttribute('aria-pressed', 'false');
    }

    toggleBtn.onclick = (e) => {
      if (e) e.stopPropagation();
      const livePanel = document.getElementById('connectify-predictor') || panel;
      if (livePanel.hidden) {
        openPredictor();
      } else {
        closePredictor();
        window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'home' }));
      }
    };

    document.addEventListener('click', e => {
      const toggle = e.target.closest('#connectify-predictor-toggle');
      if (toggle) {
        const livePanel = document.getElementById('connectify-predictor') || panel;
        if (livePanel.hidden) {
          openPredictor();
        } else {
          closePredictor();
          window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'home' }));
        }
        return;
      }

      const livePanel = document.getElementById('connectify-predictor') || panel;
      if (!livePanel.contains(e.target)) return;

      const gradeTab = e.target.closest('#cx-pred-btn-grade');
      if (gradeTab) {
        activeMainTab = 'grade';
        renderPanel();
        return;
      }

      const atarTab = e.target.closest('#cx-pred-btn-atar');
      if (atarTab) {
        activeMainTab = 'atar';
        renderPanel();
        return;
      }

      const subtab = e.target.closest('.cx-pred-subtab');
      if (subtab && subtab.dataset.idx !== undefined) {
        activeSubjectIndex = Number(subtab.dataset.idx);
        renderPanel();
        return;
      }

      const expandBtn = e.target.closest('#cx-pred-expand-outlines, .cx-pred-expand-outlines-btn');
      if (expandBtn) {
        if (window.ConnectifyData?.expandAll) {
          window.ConnectifyData.expandAll(true);
        }
        return;
      }

      const gotoSettingsBtn = e.target.closest('#cx-pred-goto-settings');
      if (gotoSettingsBtn) {
        const settingsToggle = document.getElementById('connectify-categories-toggle');
        if (settingsToggle) settingsToggle.click();
        else window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'categories' }));
        return;
      }
    });

    window.addEventListener('connectify-open', e => {
      if (e.detail !== 'predictor') closePredictor();
    });

    window.addEventListener('connectify-baselines-updated', () => {
      const livePanel = document.getElementById('connectify-predictor') || panel;
      if (!livePanel.hidden) renderPanel();
    });

    window.addEventListener('connectify-results-updated', () => {
      const livePanel = document.getElementById('connectify-predictor') || panel;
      if (!livePanel.hidden) renderPanel();
    });

    window.addEventListener('connectify-task-type-changed', () => {
      const livePanel = document.getElementById('connectify-predictor') || panel;
      if (!livePanel.hidden) renderPanel();
    });

    return {
      toggleBtn,
      panel,
      openPredictor,
      closePredictor,
      renderPredictor: renderPanel
    };
  }

  function ensurePredictorPanel() {
    if (!predictorInstance) {
      predictorInstance = createPredictorPanel();
    }
    const sidebar = document.getElementById('connectify-sidebar');
    const toolMenu = sidebar?.querySelector('.cx-tool-menu');
    const workspace = sidebar?.querySelector('.cx-workspace');

    if (toolMenu && !toolMenu.contains(predictorInstance.toggleBtn)) {
      toolMenu.append(predictorInstance.toggleBtn);
    }
    if (workspace && !workspace.contains(predictorInstance.panel)) {
      workspace.append(predictorInstance.panel);
    }
    return predictorInstance;
  }

  window.ConnectifyPredictorUI = {
    createPredictorPanel,
    ensurePredictorPanel,
    getInstance: () => ensurePredictorPanel(),
    get panelRefs() {
      const inst = ensurePredictorPanel();
      return {
        toggleBtn: inst.toggleBtn,
        panel: inst.panel,
        openPredictor: inst.openPredictor,
        closePredictor: inst.closePredictor,
        renderPredictor: inst.renderPredictor
      };
    }
  };

  ensurePredictorPanel();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensurePredictorPanel);
  }
  window.addEventListener('load', ensurePredictorPanel);
})();

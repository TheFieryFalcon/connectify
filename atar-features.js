/**
 * Connectify ATAR Features & Tools Coordinator
 *
 * Coordinates the sidebar tools (Weakness Analyzer, Category Settings),
 * floating expand/collapse buttons, countdown timer, and compound progress bars.
 */
(() => {
  'use strict';

  try {
    if (window.__connectifyAtarFeaturesInitialized) return;
    window.__connectifyAtarFeaturesInitialized = true;

    let hasInitializedSidebar = false;
    let hasAutoExpanded = false;

    let weaknessInstance = null;
    let settingsInstance = null;
    let predictorInstance = null;

    function isAutoExpandEnabled() {
      try {
        const val = localStorage.getItem('connectify:auto_expand');
        if (val !== null) return val !== 'false';
      } catch (e) {}
      return true;
    }

    function syncFeatures() {
      initSidebarTools();
      if (!window.ConnectifyData) return;

      if (!hasAutoExpanded) {
        if (!isAutoExpandEnabled()) {
          hasAutoExpanded = true;
        } else if (document.querySelectorAll('.eds-c-tile').length > 0) {
          window.ConnectifyData.expandAll(true);
          hasAutoExpanded = true;
        } else {
          return;
        }
      }

      // --- Expand/Collapse Floating Buttons ---
      if (!document.getElementById('cx-expand-btn')) {
        const btnContainer = document.createElement('div');
        btnContainer.id = 'cx-expand-btn';
        btnContainer.style.position = 'fixed';
        btnContainer.style.bottom = '16px';
        btnContainer.style.left = '16px';
        btnContainer.style.display = 'flex';
        btnContainer.style.flexDirection = 'column';
        btnContainer.style.gap = '8px';
        btnContainer.style.zIndex = '10000';

        const createBtn = (text, isExpand) => {
          const btn = document.createElement('button');
          btn.textContent = text;
          btn.type = 'button';
          btn.className = 'eds-c-button';
          btn.style.padding = '6px';
          btn.style.fontSize = '11px';
          btn.style.width = '100%';
          btn.onclick = () => window.ConnectifyData.expandAll(isExpand);
          return btn;
        };
        btnContainer.append(createBtn('Expand All', true), createBtn('Collapse All', false));
        document.body.appendChild(btnContainer);
      }

      // --- WACE Countdown Timer ---
      if (window.ConnectifyCountdown?.update) {
        window.ConnectifyCountdown.update();
      }

      if (window.ConnectifyCategorySettings?.resolveCategories) {
        window.ConnectifyCategorySettings.resolveCategories();
      }

      // --- Compound Progress Bars ---
      if (window.ConnectifyCompoundProgress?.update) {
        window.ConnectifyCompoundProgress.update();
      }
    }

    function initSidebarTools() {
      const sidebar = document.querySelector('#connectify-sidebar');
      if (!sidebar) return;

      const toolMenu = sidebar.querySelector('.cx-tool-menu');
      const workspace = sidebar.querySelector('.cx-workspace');
      if (!toolMenu || !workspace) return;

      if (!predictorInstance) {
        if (window.ConnectifyPredictorUI?.ensurePredictorPanel) {
          predictorInstance = window.ConnectifyPredictorUI.ensurePredictorPanel();
        } else if (window.ConnectifyPredictorUI?.createPredictorPanel) {
          predictorInstance = window.ConnectifyPredictorUI.createPredictorPanel();
        }
      }

      if (!weaknessInstance && window.ConnectifyWeakness?.createWeaknessPanel) {
        weaknessInstance = window.ConnectifyWeakness.createWeaknessPanel();
      }

      if (!settingsInstance && window.ConnectifyCategorySettings?.createSettingsPanel) {
        settingsInstance = window.ConnectifyCategorySettings.createSettingsPanel();
      }

      if (predictorInstance) {
        if (!toolMenu.contains(predictorInstance.toggleBtn)) toolMenu.append(predictorInstance.toggleBtn);
        if (!workspace.contains(predictorInstance.panel)) workspace.append(predictorInstance.panel);
      }

      if (weaknessInstance) {
        if (!toolMenu.contains(weaknessInstance.toggleBtn)) toolMenu.append(weaknessInstance.toggleBtn);
        if (!workspace.contains(weaknessInstance.panel)) workspace.append(weaknessInstance.panel);
      }

      if (settingsInstance) {
        if (!toolMenu.contains(settingsInstance.catBtn)) toolMenu.append(settingsInstance.catBtn);
        if (!workspace.contains(settingsInstance.catPanel)) workspace.append(settingsInstance.catPanel);
      }

      if (typeof window.ConnectifyInitSidebar === 'function') {
        window.ConnectifyInitSidebar();
      }
    }

    window.addEventListener('connectify-open', e => {
      if (e.detail !== 'predictor' && predictorInstance) {
        predictorInstance.closePredictor();
      }
      if (e.detail !== 'weakness' && weaknessInstance) {
        weaknessInstance.closeWeakness();
      }
      if (e.detail !== 'categories' && settingsInstance) {
        settingsInstance.closeCategories();
      }
    });

    window.addEventListener('connectify-task-type-changed', () => {
      try {
        if (window.ConnectifyCompoundProgress?.update) {
          window.ConnectifyCompoundProgress.update();
        }
        if (window.ConnectifyWeakness?.renderChart) {
          window.ConnectifyWeakness.renderChart();
        }
      } catch (e) {}
    });

    window.addEventListener('hashchange', () => {
      hasAutoExpanded = false;
      hasInitializedSidebar = false;
      setTimeout(syncFeatures, 500);
    });
    window.addEventListener('popstate', () => {
      hasAutoExpanded = false;
      hasInitializedSidebar = false;
      setTimeout(syncFeatures, 500);
    });

    initSidebarTools();
    setInterval(() => {
      if (window.ConnectifyIsUserActive && !window.ConnectifyIsUserActive()) return;
      initSidebarTools();
    }, 1000);
    setInterval(() => {
      if (window.ConnectifyIsUserActive && !window.ConnectifyIsUserActive()) return;
      syncFeatures();
    }, 1500);

    window.ConnectifySync = syncFeatures;
    window.ConnectifyInitSidebar = initSidebarTools;
  } catch (err) {
    console.error('Connectify error in atar-features.js:', err);
  }
})();

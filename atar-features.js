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
      if (hasInitializedSidebar || document.getElementById('connectify-weakness-toggle')) {
        hasInitializedSidebar = true;
        return;
      }
      if (!document.querySelector('#connectify-sidebar')) return;
      hasInitializedSidebar = true;

      const toolMenu = document.querySelector('.cx-tool-menu');
      const workspace = document.querySelector('.cx-workspace');

      if (window.ConnectifyWeakness?.createWeaknessPanel && !weaknessInstance) {
        weaknessInstance = window.ConnectifyWeakness.createWeaknessPanel();
      }
      if (window.ConnectifyCategorySettings?.createSettingsPanel && !settingsInstance) {
        settingsInstance = window.ConnectifyCategorySettings.createSettingsPanel();
      }

      if (weaknessInstance && settingsInstance && toolMenu && workspace) {
        toolMenu.append(weaknessInstance.toggleBtn, settingsInstance.catBtn);
        workspace.append(weaknessInstance.panel, settingsInstance.catPanel);
      }

      window.addEventListener('connectify-open', e => {
        if (e.detail !== 'weakness' && weaknessInstance) {
          weaknessInstance.closeWeakness();
        }
        if (e.detail !== 'categories' && settingsInstance) {
          settingsInstance.closeCategories();
        }
      });

      window.ConnectifyAtar = window.ConnectifyAtar || {};
      window.ConnectifyAtar.toolPanels = window.ConnectifyAtar.toolPanels || [];
      window.ConnectifyAtar.toolButtons = window.ConnectifyAtar.toolButtons || [];

      if (weaknessInstance && settingsInstance) {
        const existingPanels = new Set(window.ConnectifyAtar.toolPanels.map(p => p.id));
        if (!existingPanels.has(weaknessInstance.panel.id)) window.ConnectifyAtar.toolPanels.push(weaknessInstance.panel);
        if (!existingPanels.has(settingsInstance.catPanel.id)) window.ConnectifyAtar.toolPanels.push(settingsInstance.catPanel);

        const existingIds = new Set(window.ConnectifyAtar.toolButtons.map(b => b.id));
        if (!existingIds.has(weaknessInstance.toggleBtn.id)) window.ConnectifyAtar.toolButtons.push(weaknessInstance.toggleBtn);
        if (!existingIds.has(settingsInstance.catBtn.id)) window.ConnectifyAtar.toolButtons.push(settingsInstance.catBtn);
      }
    }

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

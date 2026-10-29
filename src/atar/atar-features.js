/**
 * Connectify ATAR Features & Tools Coordinator
 *
 * Creates the Predictor, Weaknesses and Settings panels for the sidebar to mount, runs the
 * startup auto-expand (only when the setting is on), and keeps the outline controls
 * (outline-controls.js), countdown and compound progress bars in sync across Connect re-renders.
 */
(() => {
  'use strict';

  try {
    if (window.__connectifyAtarFeaturesInitialized) return;
    window.__connectifyAtarFeaturesInitialized = true;

    let hasAutoExpanded = false;
    const controls = () => window.ConnectifyOutlineControls || {};
    const syncBackToTop = () => controls().syncBackToTop?.();

    let weaknessInstance = null;
    let settingsInstance = null;
    let predictorInstance = null;

    function isAutoExpandEnabled() {
      try {
        const val = localStorage.getItem('connectify:auto_expand');
        return val === 'true';
      } catch (e) {}
      return false;
    }

    function checkStartupAutoExpand() {
      if (hasAutoExpanded) return;
      if (!isAutoExpandEnabled()) {
        hasAutoExpanded = true;
        return;
      }
      const tiles = document.querySelectorAll('.eds-c-tile, .cvr-c-tile');
      if (tiles.length > 0 && window.ConnectifyData?.expandAll) {
        hasAutoExpanded = true;
        window.ConnectifyData.expandAll(true);
      }
    }

    function syncFeatures() {
      initSidebarTools();
      syncBackToTop();

      if (window.ConnectifyData) {
        if (!hasAutoExpanded) {
          checkStartupAutoExpand();
        }

        controls().ensureExpandButtons?.();
      }

      // --- WACE Countdown Timer ---
      if (window.ConnectifyCountdown?.update) {
        window.ConnectifyCountdown.update();
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

      if (!weaknessInstance) {
        if (window.ConnectifyWeakness?.ensureWeaknessPanel) {
          weaknessInstance = window.ConnectifyWeakness.ensureWeaknessPanel();
        } else if (window.ConnectifyWeakness?.createWeaknessPanel) {
          weaknessInstance = window.ConnectifyWeakness.createWeaknessPanel();
        }
      }

      if (!settingsInstance) {
        if (window.ConnectifyCategorySettings?.ensureSettingsPanel) {
          settingsInstance = window.ConnectifyCategorySettings.ensureSettingsPanel();
        } else if (window.ConnectifyCategorySettings?.createSettingsPanel) {
          settingsInstance = window.ConnectifyCategorySettings.createSettingsPanel();
        }
      }

      // sidebar.js mounts the launchers and panels
      if (typeof window.ConnectifyInitSidebar === 'function' && window.ConnectifyInitSidebar !== initSidebarTools) {
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

    // Compound progress bars listen for type changes themselves
    window.addEventListener('connectify-task-type-changed', () => {
      try { window.ConnectifyWeakness?.renderChart?.(); } catch {}
    });

    for (const evt of ['hashchange', 'popstate']) {
      window.addEventListener(evt, () => {
        hasAutoExpanded = false;
        setTimeout(syncFeatures, 500);
      });
    }

    initSidebarTools();
    syncBackToTop();
    syncFeatures();
    checkStartupAutoExpand();

    if (typeof document !== 'undefined' && document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        syncFeatures();
        checkStartupAutoExpand();
      });
    }

    let startupPollTicks = 0;
    const startupPollInterval = setInterval(() => {
      startupPollTicks++;
      checkStartupAutoExpand();
      if (!document.getElementById('cx-expand-btn') && window.ConnectifyData) {
        syncFeatures();
      }
      if (hasAutoExpanded || startupPollTicks >= 60) {
        clearInterval(startupPollInterval);
      }
    }, 25);

    // The scheduler batches page changes per frame and mutes them during accordion animations
    const scheduler = window.ConnectifyScheduler;
    scheduler.onMutations(() => {
      if (!hasAutoExpanded) checkStartupAutoExpand();
      syncBackToTop();
      window.ConnectifyOutlineJump?.sync();
      if (!document.getElementById('cx-expand-btn') && window.ConnectifyData) syncFeatures();
    }, { filter: r => r.type === 'childList', mute: true });

    // Startup auto-expand opens the outlines as soon as they are drawn, before their boxplots arrive
    window.addEventListener('connectify-outlines-preview', () => checkStartupAutoExpand());

    scheduler.every(2000, initSidebarTools, { mute: true });
    scheduler.every(5000, syncFeatures, { mute: true });

    window.ConnectifySync = syncFeatures;
    window.ConnectifyIsAutoExpandEnabled = isAutoExpandEnabled;
    if (!window.ConnectifyInitSidebar) {
      window.ConnectifyInitSidebar = initSidebarTools;
    }
  } catch (err) {
    console.error('Connectify error in atar-features.js:', err);
  }
})();

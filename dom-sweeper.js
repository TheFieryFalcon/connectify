/**
 * Connectify DOM Sweeper & Health Checker
 *
 * Periodically and reactively sweeps the Connect DOM for injected Connectify components
 * (sidebar, sidebar handle, cohort statistics panels, countdown banner, compound progress).
 * If any expected component is missing due to dynamic client-side SPA navigation,
 * prompts the user with an actionable restore banner.
 */
(() => {
  'use strict';

  if (window.ConnectifyDomSweeper) return;

  const HEALTH_NOTIFICATION_ID = 'connectify-health-sweeper';
  let isDismissed = false;
  let sweepTimer = null;
  let lastDismissTime = 0;
  const DISMISS_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Sweeps DOM for expected Connectify components.
   * Returns an array of descriptions of missing components.
   */
  function inspectDOM() {
    const missing = [];

    // 1. Sidebar and Handle check
    const sidebar = document.getElementById('connectify-sidebar');
    const handle = document.getElementById('connectify-sidebar-handle');

    if (!sidebar) {
      missing.push('Connectify Sidebar');
    }
    if (!handle) {
      missing.push('Sidebar Toggle Handle');
    }

    // 2. Highcharts Bridge Check
    if (!document.documentElement.dataset.connectifyMainBridge) {
      missing.push('Highcharts Data Bridge');
    }

    // 3. Assessment rows check
    const taskRows = document.querySelectorAll('.cvr-c-task');
    if (taskRows.length > 0) {
      let missingPanelCount = 0;
      taskRows.forEach(row => {
        const isOverall = !row.closest('.cvr-c-tasks');
        const readMark = window.ConnectifyCohortView?.readMark;
        const mark = typeof readMark === 'function' ? readMark(row) : undefined;
        const isMarked = Number.isFinite(mark);

        // Incomplete / pending tasks intentionally do not render statistics panels
        if (!isOverall && !isMarked) return;

        const hasPanel = row.querySelector('.connectea-panel') || row.querySelector('.connectea-row-wrapper');
        if (!hasPanel) {
          missingPanelCount++;
        }
      });
      if (missingPanelCount > 0) {
        missing.push(`Cohort statistics missing on ${missingPanelCount} assessment task${missingPanelCount > 1 ? 's' : ''}`);
      }
    }

    // 4. Year 12 Countdown & Progress check
    const tiles = Array.from(document.querySelectorAll('.eds-c-tile__title, .eds-c-tile'));
    const pageText = tiles.map(t => t.textContent || '').join(' ');
    const isYear12 = /\b(?:Year\s*12|12)\b/i.test(pageText) || /\bAT[A-Z]{3}\b/.test(pageText);

    if (isYear12 && !document.getElementById('connectify-wace-countdown')) {
      const mainContainer = document.querySelector('.cvr-c-assessment__main, main, [role="main"], .cvr-c-overview');
      if (mainContainer) {
        missing.push('WACE Exam Countdown Banner');
      }
    }

    return missing;
  }

  /**
   * Restores missing components by calling the respective initialization hooks.
   */
  function restoreComponents() {
    try {
      if (typeof window.ConnectifyInitSidebar === 'function') {
        window.ConnectifyInitSidebar();
      }
      if (window.ConnectifyCohort && typeof window.ConnectifyCohort.pass === 'function') {
        window.ConnectifyCohort.pass();
      }
      if (window.ConnectifyCountdown && typeof window.ConnectifyCountdown.update === 'function') {
        window.ConnectifyCountdown.update();
      }
      if (window.ConnectifyCompoundProgress && typeof window.ConnectifyCompoundProgress.update === 'function') {
        window.ConnectifyCompoundProgress.update();
      }
      window.dispatchEvent(new CustomEvent('connectify-settings-updated'));
    } catch (err) {
      console.warn('Connectify restore encountered an error:', err);
    }
  }

  /**
   * Dismisses the prompt and sets cooldown.
   */
  function dismissPrompt() {
    isDismissed = true;
    lastDismissTime = Date.now();
    if (window.ConnectifyNotifications?.dismiss) {
      window.ConnectifyNotifications.dismiss(HEALTH_NOTIFICATION_ID);
    }
  }

  /**
   * Renders the health prompt banner using ConnectifyNotifications.
   */
  function promptUser(missingItems) {
    if (isDismissed && (Date.now() - lastDismissTime < DISMISS_COOLDOWN_MS)) {
      return;
    }

    if (window.ConnectifyNotifications?.show) {
      window.ConnectifyNotifications.show({
        id: HEALTH_NOTIFICATION_ID,
        type: 'warning',
        title: 'Connectify Component Notice',
        message: 'Some Connectify features were not detected on this page or were removed during page transition:',
        details: missingItems,
        dismissible: true,
        onDismiss: () => {
          isDismissed = true;
          lastDismissTime = Date.now();
        },
        actions: [
          {
            text: 'Dismiss',
            type: 'secondary',
            onClick: ({ close }) => {
              dismissPrompt();
              close();
            }
          },
          {
            text: 'Restore Components',
            type: 'primary',
            onClick: () => {
              restoreComponents();
              setTimeout(sweep, 500);
            }
          }
        ]
      });
    }
  }

  /**
   * Performs a sweep of the DOM and prompts or clears accordingly.
   */
  function sweep() {
    // Only sweep on actual Connect pages with content
    if (!document.body || (!document.querySelector('.eds-c-tile') && !document.querySelector('.cvr-c-task') && !document.querySelector('.cvr-c-overview'))) {
      return;
    }

    const missing = inspectDOM();
    if (missing.length > 0) {
      promptUser(missing);
    } else if (window.ConnectifyNotifications?.dismiss) {
      window.ConnectifyNotifications.dismiss(HEALTH_NOTIFICATION_ID);
    }
  }

  function scheduleSweep(delay = 1200) {
    clearTimeout(sweepTimer);
    sweepTimer = setTimeout(sweep, delay);
  }

  // Observe SPA navigation mutations
  const observer = new MutationObserver(mutations => {
    let relevantChange = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0 || m.removedNodes.length > 0) {
        relevantChange = true;
        break;
      }
    }
    if (relevantChange) {
      scheduleSweep(1500);
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  // Initial sweeps
  setTimeout(sweep, 2000);
  setTimeout(sweep, 5000);

  // Periodic health check
  setInterval(() => {
    if (window.ConnectifyIsUserActive && !window.ConnectifyIsUserActive()) return;
    sweep();
  }, 15000);

  window.ConnectifyDomSweeper = {
    sweep,
    promptUser,
    dismissPrompt,
    restoreComponents,
    inspectDOM
  };
})();

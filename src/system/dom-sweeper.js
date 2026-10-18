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
        const readMark = window.ConnectifyCohortRows?.readMark || window.ConnectifyCohortView?.readMark;
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

  // A component counts as missing only if it is still missing after the cohort pass has had a chance to run: right
  // after an accordion opens or Connect re-renders rows, the pass (debounced, muted during animations) has not drawn
  // the new rows' panels yet, and reporting then was a false positive
  const CONFIRM_DELAY_MS = 3000;
  let confirmTimer = null;

  const isBusy = () => Boolean(window.ConnectifyIsAccordionAnimating || window.ConnectifyIsBulkExpanding || document.hidden);

  function clearNotice() {
    if (window.ConnectifyNotifications?.dismiss) window.ConnectifyNotifications.dismiss(HEALTH_NOTIFICATION_ID);
  }

  /**
   * Performs a sweep of the DOM; a miss is confirmed by a second sweep after a cohort pass before prompting.
   */
  function sweep() {
    // Only sweep on actual Connect pages with content, and never mid-expansion
    if (!document.body || (!document.querySelector('.eds-c-tile') && !document.querySelector('.cvr-c-task') && !document.querySelector('.cvr-c-overview'))) {
      return;
    }
    if (isBusy()) { scheduleSweep(1500); return; }

    if (inspectDOM().length === 0) { clearTimeout(confirmTimer); confirmTimer = null; clearNotice(); return; }
    if (confirmTimer) return;
    window.ConnectifyCohort?.schedule?.(true);
    confirmTimer = setTimeout(() => {
      confirmTimer = null;
      if (isBusy()) { scheduleSweep(1500); return; }
      const missing = inspectDOM();
      if (missing.length > 0) promptUser(missing);
      else clearNotice();
    }, CONFIRM_DELAY_MS);
  }

  function scheduleSweep(delay = 1200) {
    clearTimeout(sweepTimer);
    sweepTimer = setTimeout(sweep, delay);
  }

  // SPA navigation: nodes added or removed outside accordion panels and Connectify's own UI
  const isNavigationChange = m => m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0) &&
    !m.target?.closest?.('.eds-c-accordion__panel, .cvr-c-accordion__panel, .connectea-panel, .connectea-row-wrapper, #connectify-sidebar');
  const scheduler = window.ConnectifyScheduler;
  scheduler.onMutations(() => scheduleSweep(1500), { filter: isNavigationChange, mute: true });

  // Initial sweep, then a periodic health check while the user is active
  setTimeout(sweep, 5000);
  scheduler.every(15000, sweep);

  window.ConnectifyDomSweeper = {
    sweep,
    promptUser,
    dismissPrompt,
    restoreComponents,
    inspectDOM
  };
})();

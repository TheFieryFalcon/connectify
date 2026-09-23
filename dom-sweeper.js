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

  let promptElement = null;
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
        // Look for rows that have marks but lack connectea-panel
        const hasMarks = row.querySelector('.cvr-c-task__marks');
        const hasPanel = row.querySelector('.connectea-panel');
        if (hasMarks && !hasPanel) {
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
    const isYear12 = /\bYear\s*12\b/i.test(pageText);

    if (isYear12 && !document.getElementById('connectify-countdown')) {
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
      if (typeof window.ConnectifyPass === 'function') {
        window.ConnectifyPass();
      }
      if (typeof window.ConnectifySync === 'function') {
        window.ConnectifySync();
      }
      if (window.ConnectifyCountdown && typeof window.ConnectifyCountdown.render === 'function') {
        window.ConnectifyCountdown.render();
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
    if (promptElement) {
      promptElement.remove();
      promptElement = null;
    }
  }

  /**
   * Renders the health prompt banner to notify the user.
   */
  function promptUser(missingItems) {
    if (isDismissed && (Date.now() - lastDismissTime < DISMISS_COOLDOWN_MS)) {
      return;
    }

    if (!promptElement) {
      promptElement = document.createElement('div');
      promptElement.id = 'connectify-health-prompt';
      promptElement.setAttribute('role', 'alert');
      promptElement.setAttribute('aria-live', 'assertive');
      document.body.append(promptElement);
    }

    promptElement.replaceChildren();

    const header = document.createElement('div');
    header.className = 'cx-health-header';
    header.innerHTML = '<span>⚠️</span> <span>Connectify Component Notice</span>';

    const body = document.createElement('div');
    body.className = 'cx-health-body';
    body.textContent = 'Some Connectify features were not detected on this page or were removed during page transition:';

    const list = document.createElement('ul');
    list.className = 'cx-health-details';
    missingItems.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      list.append(li);
    });

    const actions = document.createElement('div');
    actions.className = 'cx-health-actions';

    const reinjectBtn = document.createElement('button');
    reinjectBtn.type = 'button';
    reinjectBtn.className = 'cx-health-btn cx-health-reinject';
    reinjectBtn.textContent = 'Restore Components';
    reinjectBtn.onclick = () => {
      restoreComponents();
      setTimeout(sweep, 500);
    };

    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.className = 'cx-health-btn cx-health-dismiss';
    dismissBtn.textContent = 'Dismiss';
    dismissBtn.onclick = dismissPrompt;

    actions.append(dismissBtn, reinjectBtn);
    promptElement.append(header, body, list, actions);
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
    } else if (promptElement) {
      promptElement.remove();
      promptElement = null;
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
  setInterval(sweep, 15000);

  window.ConnectifyDomSweeper = {
    sweep,
    promptUser,
    dismissPrompt,
    restoreComponents,
    inspectDOM
  };
})();

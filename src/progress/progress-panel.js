/**
 * Connectify Progress Graph: panel markup
 *
 * Builds the Year in Progress launcher (#connectify-progress-toggle) and panel (#connectify-progress):
 * header with title and Refresh Assessments button, subject chips and chart area. A panel or launcher
 * left by an earlier injection is adopted rather than duplicated. Exposes window.ConnectifyProgressPanel.
 */
(() => {
  'use strict';

  const createElement = (...args) => window.ConnectifyProgressChart.createElement(...args);

  function build() {
    const toggleBtn = document.getElementById('connectify-progress-toggle') || createElement('button', 'Year in Progress');
    toggleBtn.id = 'connectify-progress-toggle';
    toggleBtn.type = 'button';
    toggleBtn.setAttribute('aria-expanded', 'false');

    let panel = document.getElementById('connectify-progress');
    let title, choicesContainer, chartContainer, scanBtn, head;
    if (panel) {
      head = panel.querySelector('header');
      if (!head) {
        head = createElement('header');
        panel.prepend(head);
      }
      title = head.querySelector('strong') || createElement('strong', 'Year in Progress');
      title.tabIndex = -1;
      if (!head.contains(title)) head.prepend(title);

      scanBtn = Array.from(panel.querySelectorAll('button')).find(b => b.textContent.includes('Refresh Assessments')) || createElement('button', 'Refresh Assessments');
      scanBtn.type = 'button';
      scanBtn.className = 'cx-refresh-btn';
      if (!head.contains(scanBtn)) head.append(scanBtn);

      choicesContainer = panel.querySelector('.cx-subjects') || createElement('div', null, 'cx-subjects');
      chartContainer = panel.querySelector('div:not(.cx-subjects)') || createElement('div');
      if (!panel.contains(choicesContainer)) panel.append(choicesContainer);
      if (!panel.contains(chartContainer)) panel.append(chartContainer);
    } else {
      panel = createElement('section');
      panel.id = 'connectify-progress';
      panel.hidden = true;
      panel.setAttribute('aria-label', 'Assessment progress');

      head = createElement('header');
      title = createElement('strong', 'Year in Progress');
      title.tabIndex = -1;

      scanBtn = createElement('button', 'Refresh Assessments');
      scanBtn.type = 'button';
      scanBtn.className = 'cx-refresh-btn';

      head.append(title, scanBtn);

      choicesContainer = createElement('div', null, 'cx-subjects');
      chartContainer = createElement('div');

      panel.append(head, choicesContainer, chartContainer);
      document.body.append(toggleBtn, panel);
    }

    return { toggleBtn, panel, title, scanBtn, choicesContainer, chartContainer };
  }

  window.ConnectifyProgressPanel = { build };
})();

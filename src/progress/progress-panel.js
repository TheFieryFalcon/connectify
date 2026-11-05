/**
 * Connectify Progress Graph: panel markup
 *
 * Builds the Progress launcher (#connectify-progress-toggle) and panel (#connectify-progress):
 * header with title, subject chips and chart area. A panel or launcher
 * left by an earlier injection is adopted rather than duplicated. Exposes window.ConnectifyProgressPanel.
 */
(() => {
  'use strict';

  const createElement = (...args) => window.ConnectifyProgressChart.createElement(...args);

  function build() {
    const toggleBtn = document.getElementById('connectify-progress-toggle') || createElement('button', 'Year Progression');
    toggleBtn.id = 'connectify-progress-toggle';
    toggleBtn.type = 'button';
    toggleBtn.setAttribute('aria-expanded', 'false');

    let panel = document.getElementById('connectify-progress');
    let title, choicesContainer, chartContainer, head;
    if (panel) {
      head = panel.querySelector('header');
      if (!head) {
        head = createElement('header');
        panel.prepend(head);
      }
      title = head.querySelector('strong') || createElement('strong', 'Year Progression');
      title.tabIndex = -1;
      if (!head.contains(title)) head.prepend(title);

      choicesContainer = panel.querySelector('.cx-subjects') || createElement('div', null, 'cx-subjects');
      chartContainer = panel.querySelector('.cx-progress-chart') || panel.querySelector('div:not(.cx-subjects)') || createElement('div');
      chartContainer.classList.add('cx-progress-chart');
      if (!panel.contains(choicesContainer)) panel.append(choicesContainer);
      if (!panel.contains(chartContainer)) panel.append(chartContainer);
    } else {
      panel = createElement('section');
      panel.id = 'connectify-progress';
      panel.hidden = true;
      panel.setAttribute('aria-label', 'Assessment progress');

      head = createElement('header');
      title = createElement('strong', 'Year Progression');
      title.tabIndex = -1;

      head.append(title);

      choicesContainer = createElement('div', null, 'cx-subjects');
      chartContainer = createElement('div', null, 'cx-progress-chart');

      panel.append(head, choicesContainer, chartContainer);
      document.body.append(toggleBtn, panel);
    }

    return { toggleBtn, panel, title, choicesContainer, chartContainer };
  }

  window.ConnectifyProgressPanel = { build };
})();

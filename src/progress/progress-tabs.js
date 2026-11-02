/**
 * Connectify Year Progression: subtabs
 *
 * The panel's two tabs under its header, on the Predictor's tab bar (.cx-pred-main-tabs): Progress Graph (subject
 * chips, chart, marks and weights) and Task Dates (task-dates-view.js). The panel opens on Progress Graph, then
 * reopens on the tab it was left on. Exposes window.ConnectifyProgressTabs.
 */
(() => {
  'use strict';

  try {
    if (window.ConnectifyProgressTabs) return;
    const refs = window.ConnectifyProgress?.panelRefs;
    const panel = refs?.panel;
    const head = panel?.querySelector('header');
    const datesView = window.ConnectifyTaskDatesView;
    if (!head || !datesView) return;

    const createElement = window.ConnectifyProgressChart.createElement;
    const TABS = [{ id: 'graph', label: 'Progress Graph' }, { id: 'dates', label: 'Task Dates' }];

    const bar = document.getElementById('cx-progress-tabs') || createElement('div', null, 'cx-pred-main-tabs cx-progress-tabs');
    bar.id = 'cx-progress-tabs';
    bar.setAttribute('role', 'tablist');
    bar.replaceChildren();
    if (head.nextElementSibling !== bar) head.insertAdjacentElement('afterend', bar);

    const buttons = {};
    for (const tab of TABS) {
      const btn = createElement('button', tab.label, 'cx-pred-main-tab cx-progress-tab');
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      btn.addEventListener('click', e => {
        e.stopPropagation();
        select(tab.id);
      });
      buttons[tab.id] = btn;
      bar.append(btn);
    }

    let active = 'graph';

    function select(id) {
      active = id;
      for (const [tabId, btn] of Object.entries(buttons)) {
        btn.classList.toggle('active', tabId === id);
        btn.setAttribute('aria-selected', String(tabId === id));
      }
      for (const pane of panel.querySelectorAll('.cx-subjects, .cx-progress-chart')) pane.hidden = id !== 'graph';
      datesView.section.hidden = id !== 'dates';
      // Rebuilt only if a task or choice changed while it was hidden
      if (id === 'dates') datesView.render();
      else refs.refresh?.(true);
    }

    select(active);
    // Reopening the panel shows what changed while it was closed on the tab it was left on
    window.addEventListener('connectify-open', e => {
      if (e.detail === 'progress' && active === 'dates') datesView.render();
    });

    window.ConnectifyProgressTabs = { TABS, select, active: () => active, bar };
  } catch (err) {
    console.error('Connectify error in progress-tabs.js:', err);
  }
})();

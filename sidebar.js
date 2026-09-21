/**
 * Connext Sidebar & Tool Launcher
 *
 * Provides a slide-out drawer hosting Connext tools:
 * - ATAR / Target ATAR / Grade calculators
 * - Assessment Progress graphs
 * - Economics average calculator
 * - Expand all / Unexpand all outline controls
 */
(() => {
  'use strict';

  const createElement = (tag, text) => {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    return el;
  };

  const sidebar = createElement('aside');
  sidebar.id = 'connext-sidebar';
  sidebar.hidden = true;
  sidebar.setAttribute('aria-label', 'Connext tools');

  const handle = createElement('button', '❮');
  handle.id = 'connext-sidebar-handle';
  handle.type = 'button';
  handle.title = 'Open Connext tools';
  handle.setAttribute('aria-label', 'Open Connext tools');
  handle.setAttribute('aria-expanded', 'false');

  function updateHandleState(isOpen) {
    const icon = createElement('span', isOpen ? '❮' : '❯');
    icon.className = 'cx-handle-arrow';
    handle.replaceChildren(icon);

    if (!isOpen) {
      const label = createElement('span');
      label.className = 'cx-handle-label';
      label.append(
        createElement('strong', 'Connext tools'),
        createElement('small', 'ATAR · Grades · Progress')
      );
      handle.append(label);
    }

    handle.title = isOpen ? 'Close Connext tools' : 'Open Connext tools';
    handle.setAttribute('aria-label', handle.title);
    handle.setAttribute('aria-expanded', String(isOpen));
  }

  updateHandleState(false);

  // Header and navigation
  const header = createElement('header');
  const brand = createElement('strong', 'Connext');
  const homeBtn = createElement('button', '← Back to Main Menu');
  const closeBtn = createElement('button', '❮ Close');

  homeBtn.type = closeBtn.type = 'button';
  homeBtn.className = 'cx-back-menu';
  header.append(brand, homeBtn, closeBtn);

  const toolMenu = createElement('nav');
  toolMenu.className = 'cx-tool-menu';
  toolMenu.setAttribute('aria-label', 'Tools');

  const workspace = createElement('div');
  workspace.className = 'cx-workspace';

  const outlineActions = createElement('div');
  outlineActions.className = 'cx-outline-actions';

  const expandBtn = createElement('button', 'Expand all');
  const collapseBtn = createElement('button', 'Unexpand all');
  expandBtn.type = collapseBtn.type = 'button';

  expandBtn.onclick = () => window.ConnextData.expandAll(true);
  collapseBtn.onclick = () => window.ConnextData.expandAll(false);
  outlineActions.append(expandBtn, collapseBtn);

  // Economics section
  const economicsBtn = createElement('button', 'Calculate Economics average');
  economicsBtn.type = 'button';
  economicsBtn.hidden = true;

  const economicsSection = createElement('section');
  economicsSection.id = 'cx-economics';
  economicsSection.hidden = true;

  const introText = createElement('p', 'Choose a tool to explore your results.');
  introText.className = 'cx-tools-intro';

  sidebar.append(header, introText, toolMenu, outlineActions, workspace);
  document.body.append(sidebar, handle);

  /**
   * Mount tool launcher buttons into the sidebar menu and tool panels into the workspace.
   */
  function mountTools() {
    const progressToggle = document.getElementById('connext-progress-toggle');
    const toolButtons = [...(window.ConnextAtar.toolButtons || []), progressToggle];

    for (const btn of toolButtons) {
      if (btn && btn.parentElement !== toolMenu) {
        toolMenu.append(btn);
      }
    }

    if (economicsBtn.parentElement !== toolMenu) {
      toolMenu.append(economicsBtn);
    }

    for (const panelId of ['connectea-atar', 'connext-progress']) {
      const panel = document.getElementById(panelId);
      if (panel && panel.parentElement !== workspace) {
        workspace.append(panel);
      }
    }

    if (economicsSection.parentElement !== workspace) {
      workspace.append(economicsSection);
    }
  }

  function openSidebar() {
    sidebar.hidden = false;
    updateHandleState(true);
  }

  function closeAllTools() {
    window.dispatchEvent(new CustomEvent('connext-open', { detail: 'home' }));
    economicsSection.hidden = true;
  }

  handle.onclick = () => {
    if (sidebar.hidden) {
      openSidebar();
    } else {
      closeAllTools();
      sidebar.hidden = true;
      updateHandleState(false);
    }
  };

  closeBtn.onclick = () => {
    if (!sidebar.hidden) handle.click();
  };

  homeBtn.onclick = closeAllTools;

  window.addEventListener('connext-open', e => {
    if (e.detail !== 'home') openSidebar();
    economicsSection.hidden = e.detail !== 'economics';
  });

  let lastEconomicsSignature = '';

  function renderEconomics() {
    const rows = window.ConnextAtar.readCourses(false).map(list => list.find(r => r.economics));
    const signature = JSON.stringify(rows);
    if (signature === lastEconomicsSignature) return;
    lastEconomicsSignature = signature;

    economicsSection.replaceChildren(
      createElement('h2', 'Economics overall average'),
      createElement('p', 'Weighted average of completed assessments. Semester 2 includes semester 1 results once.')
    );

    rows.forEach((r, idx) => {
      const card = createElement('div', 'cx-econ-result');
      card.append(createElement('h3', `Semester ${idx + 1}`));
      card.append(
        createElement(
          'strong',
          Number.isFinite(r?.mark) ? `${r.mark.toFixed(2)}%` : 'Expand the Economics outline to calculate.'
        )
      );
      if (r?.progress.error) {
        card.append(createElement('p', r.progress.error));
      }
      economicsSection.append(card);
    });
  }

  economicsBtn.onclick = () => {
    window.ConnextData.expandAll();
    window.dispatchEvent(new CustomEvent('connext-open', { detail: 'economics' }));
    lastEconomicsSignature = '';
    renderEconomics();
  };

  function syncState() {
    mountTools();

    const isEconomicsActive = window.ConnextData.economicsStatus().active;
    economicsBtn.hidden = !isEconomicsActive;
    if (economicsBtn.hidden && !economicsSection.hidden) {
      economicsSection.hidden = true;
    }

    const hasActiveTool = Array.from(workspace.children).some(p => !p.hidden);
    sidebar.classList.toggle('cx-tool-active', hasActiveTool);
    introText.hidden = hasActiveTool;

    if (!economicsSection.hidden) {
      renderEconomics();
    }
  }

  new MutationObserver(syncState).observe(workspace, {
    attributes: true,
    attributeFilter: ['hidden'],
    subtree: true
  });

  sidebar.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeBtn.click();
      handle.focus();
    }
  });

  setInterval(syncState, 1000);
  syncState();
})();

/**
 * Connext Sidebar & Tool Launcher
 *
 * Provides a slide-out drawer hosting Connext tools:
 * - ATAR / Target ATAR / Grade calculators
 * - Assessment Progress graphs
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

  const introText = createElement('p', 'Choose a tool to explore your results.');
  introText.className = 'cx-tools-intro';

  sidebar.append(header, introText, toolMenu, workspace);
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

    for (const panelId of ['connectea-atar', 'connext-progress', 'connext-weakness']) {
      const panel = document.getElementById(panelId);
      if (panel && panel.parentElement !== workspace) {
        workspace.append(panel);
      }
    }
  }

  function openSidebar() {
    sidebar.hidden = false;
    updateHandleState(true);
  }

  function closeAllTools() {
    window.dispatchEvent(new CustomEvent('connext-open', { detail: 'home' }));
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
  });

  function syncState() {
    mountTools();

    const hasActiveTool = Array.from(workspace.children).some(p => !p.hidden);
    sidebar.classList.toggle('cx-tool-active', hasActiveTool);
    introText.hidden = hasActiveTool;
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

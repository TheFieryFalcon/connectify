/**
 * Connectify Sidebar & Tool Launcher
 *
 * Provides a slide-out drawer hosting Connectify tools:
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
  sidebar.id = 'connectify-sidebar';
  sidebar.hidden = true;
  sidebar.setAttribute('aria-label', 'Connectify tools');

  const handle = createElement('button', '❮');
  handle.id = 'connectify-sidebar-handle';
  handle.type = 'button';
  handle.title = 'Open Connectify tools';
  handle.setAttribute('aria-label', 'Open Connectify tools');
  handle.setAttribute('aria-expanded', 'false');

  function updateHandleState(isOpen) {
    const icon = createElement('span', isOpen ? '❮' : '❯');
    icon.className = 'cx-handle-arrow';
    handle.replaceChildren(icon);

    if (!isOpen) {
      const label = createElement('span');
      label.className = 'cx-handle-label';
      label.append(
        createElement('strong', 'Connectify Tools'),
        createElement('small', 'ATAR · Grades · Progress')
      );
      handle.append(label);
    }

    handle.title = isOpen ? 'Close Connectify tools' : 'Open Connectify tools';
    handle.setAttribute('aria-label', handle.title);
    handle.setAttribute('aria-expanded', String(isOpen));
  }

  updateHandleState(false);

  // Header and navigation
  const header = createElement('header');
  const brand = createElement('strong', 'Connectify');
  const homeBtn = createElement('button', '← Back to Menu');
  const closeBtn = createElement('button', '❮ Close');

  homeBtn.type = closeBtn.type = 'button';
  homeBtn.className = 'cx-back-menu';
  header.append(brand, homeBtn, closeBtn);

  const toolMenu = createElement('nav');
  toolMenu.className = 'cx-tool-menu';
  toolMenu.setAttribute('aria-label', 'Tools');

  const workspace = createElement('div');
  workspace.className = 'cx-workspace';

  const introText = createElement('p', 'Select a tool below to view your analytics. Ensure subject outlines are expanded in Connect to load assessment data.');
  introText.className = 'cx-tools-intro';

  sidebar.append(header, introText, toolMenu, workspace);
  document.body.append(sidebar, handle);

  /**
   * Mount tool launcher buttons into the sidebar menu and tool panels into the workspace.
   */
  function mountTools() {
    const progressToggle = document.getElementById('connectify-progress-toggle');
    const toolButtons = [...(window.ConnectifyAtar.toolButtons || []), progressToggle];

    for (const btn of toolButtons) {
      if (btn && btn.parentElement !== toolMenu) {
        toolMenu.append(btn);
      }
    }

    for (const panelId of ['connectea-atar', 'connectify-progress', 'connectify-weakness', 'connectify-categories']) {
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
    window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'home' }));
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

  window.addEventListener('connectify-open', e => {
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

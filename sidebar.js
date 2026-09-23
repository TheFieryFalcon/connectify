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

  try {
    // Prevent duplicate instances from being mounted
    if (window.__connectifySidebarInitialized) return;
    window.__connectifySidebarInitialized = true;

    const createElement = (tag, text) => {
      const el = document.createElement(tag);
      if (text) el.textContent = text;
      return el;
    };

    // Reuse existing DOM nodes if another script run created them, or create fresh ones
    let sidebar = document.getElementById('connectify-sidebar');
    let handle = document.getElementById('connectify-sidebar-handle');

    // Clean up any extra duplicate handles or sidebars in the document
    const allSidebars = document.querySelectorAll('#connectify-sidebar');
    if (allSidebars.length > 1) {
      for (let i = 1; i < allSidebars.length; i++) allSidebars[i].remove();
    }
    const allHandles = document.querySelectorAll('#connectify-sidebar-handle');
    if (allHandles.length > 1) {
      for (let i = 1; i < allHandles.length; i++) allHandles[i].remove();
    }

    if (!sidebar) {
      sidebar = createElement('aside');
      sidebar.id = 'connectify-sidebar';
      sidebar.hidden = true;
      sidebar.setAttribute('aria-label', 'Connectify tools');
    }

    if (!handle) {
      handle = createElement('button', '❮');
      handle.id = 'connectify-sidebar-handle';
      handle.type = 'button';
      handle.title = 'Open Connectify tools';
      handle.setAttribute('aria-label', 'Open Connectify tools');
      handle.setAttribute('aria-expanded', 'false');
    }

    function updateHandleState(isOpen) {
      const icon = createElement('span', isOpen ? '❮' : '❯');
      icon.className = 'cx-handle-arrow';
      if (typeof handle.replaceChildren === 'function') {
        handle.replaceChildren(icon);
      } else {
        while (handle.firstChild) handle.removeChild(handle.firstChild);
        handle.append(icon);
      }

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
    let header = sidebar.querySelector('header');
    let homeBtn = sidebar.querySelector('.cx-back-menu');
    let closeBtn = sidebar.querySelector('.cx-close-btn');

    if (!header) {
      header = createElement('header');
      const brand = createElement('strong', 'Connectify');
      homeBtn = createElement('button', '← Back to Menu');
      closeBtn = createElement('button', '❮ Close');

      homeBtn.type = closeBtn.type = 'button';
      homeBtn.className = 'cx-back-menu';
      closeBtn.className = 'cx-close-btn';
      header.append(brand, homeBtn, closeBtn);
    }

    let toolMenu = sidebar.querySelector('.cx-tool-menu');
    if (!toolMenu) {
      toolMenu = createElement('nav');
      toolMenu.className = 'cx-tool-menu';
      toolMenu.setAttribute('aria-label', 'Tools');
    }

    let workspace = sidebar.querySelector('.cx-workspace');
    if (!workspace) {
      workspace = createElement('div');
      workspace.className = 'cx-workspace';
    }

    let introText = sidebar.querySelector('.cx-tools-intro');
    if (!introText) {
      introText = createElement('p', 'Select a tool below to view your analytics. Ensure subject outlines are expanded in Connect to load assessment data.');
      introText.className = 'cx-tools-intro';
    }

    if (!sidebar.contains(header)) sidebar.append(header);
    if (!sidebar.contains(introText)) sidebar.append(introText);
    if (!sidebar.contains(toolMenu)) sidebar.append(toolMenu);
    if (!sidebar.contains(workspace)) sidebar.append(workspace);

    function attachSidebar() {
      const parent = document.body || document.documentElement;
      if (!parent) return;

      // Ensure no duplicate handle exists
      const existingHandles = document.querySelectorAll('#connectify-sidebar-handle');
      existingHandles.forEach(h => { if (h !== handle) h.remove(); });

      const existingSidebars = document.querySelectorAll('#connectify-sidebar');
      existingSidebars.forEach(s => { if (s !== sidebar) s.remove(); });

      if (sidebar.parentElement !== parent) {
        parent.appendChild(sidebar);
      }
      if (handle.parentElement !== parent) {
        parent.appendChild(handle);
      }
    }

    attachSidebar();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', attachSidebar);
    }
    window.addEventListener('load', attachSidebar);

    /**
     * Mount tool launcher buttons into the sidebar menu and tool panels into the workspace.
     */
    function mountTools() {
      const progressToggle = document.getElementById('connectify-progress-toggle');
      const weaknessToggle = document.getElementById('connectify-weakness-toggle');
      const categoriesToggle = document.getElementById('connectify-categories-toggle');
      const estimateToggle = document.getElementById('connectify-estimate-toggle');
      const targetToggle = document.getElementById('connectify-target-toggle');
      const gradeToggle = document.getElementById('connectify-grade-toggle');

      const atarButtons = window.ConnectifyAtar?.toolButtons || [];
      const fallbackAtarButtons = [estimateToggle, targetToggle, gradeToggle].filter(Boolean);
      const resolvedAtarButtons = atarButtons.length > 0 ? atarButtons : fallbackAtarButtons;

      const rawButtons = [
        ...resolvedAtarButtons,
        progressToggle,
        weaknessToggle,
        categoriesToggle
      ].filter(Boolean);

      // Deduplicate buttons by element and ID to prevent duplicates
      const seenButtons = new Set();
      const uniqueButtons = [];
      for (const btn of rawButtons) {
        const key = btn.id || btn;
        if (!seenButtons.has(key)) {
          seenButtons.add(key);
          uniqueButtons.push(btn);
        }
      }

      for (const btn of uniqueButtons) {
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
      syncState();
    }

    function closeAllTools() {
      window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'home' }));
      for (const child of workspace.children) {
        child.hidden = true;
      }
      sidebar.classList.remove('cx-tool-active');
      introText.hidden = false;
    }

    function closeSidebar() {
      closeAllTools();
      sidebar.hidden = true;
      updateHandleState(false);
    }

    handle.onclick = () => {
      if (sidebar.hidden) {
        openSidebar();
      } else {
        closeSidebar();
      }
    };

    if (closeBtn) {
      closeBtn.onclick = () => {
        if (!sidebar.hidden) closeSidebar();
      };
    }

    if (homeBtn) {
      homeBtn.onclick = closeAllTools;
    }

    window.addEventListener('connectify-open', e => {
      if (e.detail !== 'home') openSidebar();
    });

    let isSyncing = false;
    function syncState() {
      if (isSyncing) return;
      isSyncing = true;
      try {
        attachSidebar();
        mountTools();

        const hasActiveTool = Array.from(workspace.children).some(p => !p.hidden);
        sidebar.classList.toggle('cx-tool-active', hasActiveTool);
        introText.hidden = hasActiveTool;
      } finally {
        isSyncing = false;
      }
    }

    // Debounce mutation sync to prevent infinite loops
    let syncTimer = null;
    const debouncedSync = () => {
      if (syncTimer) return;
      syncTimer = requestAnimationFrame(() => {
        syncTimer = null;
        syncState();
      });
    };

    // Observe only direct children of workspace for hidden changes (not deep subtrees)
    new MutationObserver(debouncedSync).observe(workspace, {
      attributes: true,
      attributeFilter: ['hidden'],
      childList: true
    });

    sidebar.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeSidebar();
        handle.focus();
      }
    });

    window.ConnectifyInitSidebar = syncState;
    setInterval(() => {
      if (window.ConnectifyIsUserActive && !window.ConnectifyIsUserActive()) return;
      syncState();
    }, 1500);
    syncState();
  } catch (err) {
    console.error('Connectify error in sidebar.js:', err);
  }
})();

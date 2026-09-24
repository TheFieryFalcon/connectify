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
      // Ensure predictor instance exists
      if (!document.getElementById('connectify-predictor-toggle') && window.ConnectifyPredictorUI?.ensurePredictorPanel) {
        window.ConnectifyPredictorUI.ensurePredictorPanel();
      }

      const canonicalButtons = [
        { id: 'connectify-estimate-toggle', label: 'ATAR Estimate' },
        { id: 'connectify-target-toggle', label: 'Target ATAR' },
        { id: 'connectify-grade-toggle', label: 'Target Grade' },
        { id: 'connectify-predictor-toggle', label: 'Predictor' },
        { id: 'connectify-progress-toggle', label: 'Progress Graph' },
        { id: 'connectify-weakness-toggle', label: 'Weakness Analyzer' },
        { id: 'connectify-categories-toggle', label: 'Settings' }
      ];

      const resolvedButtons = [];
      for (const item of canonicalButtons) {
        let matches = Array.from(document.querySelectorAll('#' + item.id));
        if (matches.length === 0) {
          const atarBtns = window.ConnectifyAtar?.calculatorButtons || window.ConnectifyAtar?.toolButtons || [];
          const found = atarBtns.find(b => b && b.id === item.id);
          if (found) {
            matches = [found];
          }
        }
        let btn = null;
        if (matches.length > 0) {
          const inMenu = matches.find(m => m.parentElement === toolMenu);
          btn = inMenu || matches[0];
          // Purge duplicate button nodes with same ID from DOM
          for (const m of matches) {
            if (m !== btn && m.parentElement) {
              m.remove();
            }
          }
        }
        if (btn) {
          btn.className = 'cx-calculator-tool';
          resolvedButtons.push(btn);
        }
      }

      // Purge any unknown, stray, or obsolete child buttons from toolMenu
      const resolvedSet = new Set(resolvedButtons);
      Array.from(toolMenu.children).forEach(child => {
        if (!resolvedSet.has(child)) {
          child.remove();
        }
      });

      // Append all resolved buttons in the canonical sequence
      for (const btn of resolvedButtons) {
        toolMenu.append(btn);
      }

      // Mount and deduplicate workspace panels
      const panelIds = [
        'connectea-atar',
        'connectify-predictor',
        'connectify-progress',
        'connectify-weakness',
        'connectify-categories'
      ];
      for (const panelId of panelIds) {
        let matches = Array.from(document.querySelectorAll('#' + panelId));
        if (matches.length === 0 && panelId === 'connectea-atar' && window.ConnectifyAtar?.calculatorPanel) {
          matches = [window.ConnectifyAtar.calculatorPanel];
        }
        if (matches.length > 0) {
          const inWorkspace = matches.find(m => m.parentElement === workspace);
          const panel = inWorkspace || matches[0];
          for (const m of matches) {
            if (m !== panel && m.parentElement) {
              m.remove();
            }
          }
          if (panel.parentElement !== workspace) {
            workspace.append(panel);
          }
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
      toolMenu.querySelectorAll('button').forEach(btn => btn.setAttribute('aria-pressed', 'false'));
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

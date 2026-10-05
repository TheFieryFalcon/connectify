/**
 * Connectify Sidebar Drawer & Tool Launcher Workspace
 *
 * Provides the slide-out drawer hosting Connectify tools and panel navigation.
 */
(() => {
  'use strict';

  try {
    if (window.__connectifySidebarInitialized) return;
    window.__connectifySidebarInitialized = true;

    const createElement = (tag, text) => {
      const el = document.createElement(tag);
      if (text) el.textContent = text;
      return el;
    };

    let sidebar = document.getElementById('connectify-sidebar');
    let handle = window.ConnectifySidebarHandle?.handle || document.getElementById('connectify-sidebar-handle');

    document.querySelectorAll('#connectify-sidebar').forEach((el, i) => { if (i > 0) el.remove(); });
    document.querySelectorAll('#connectify-sidebar-handle').forEach((el, i) => { if (i > 0) el.remove(); });

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

    const updateHandlePosition = () => (window._connectifyUpdateHandlePosition || window.ConnectifySidebarHandle?.updateHandlePosition || function() {})();
    const updateHandleState = (isOpen) => (window.ConnectifySidebarHandle?.updateHandleState || function() {})(isOpen);

    // Header and navigation
    let header = sidebar.querySelector('header');
    let homeBtn = sidebar.querySelector('.cx-back-menu');

    // Remove any legacy or stray close button from header
    const strayCloseBtn = sidebar.querySelector('.cx-close-btn');
    if (strayCloseBtn) strayCloseBtn.remove();

    if (!header) {
      header = createElement('header');
      const brand = createElement('strong', 'Connectify');
      homeBtn = createElement('button', '← Back to Menu');
      homeBtn.type = 'button';
      homeBtn.className = 'cx-back-menu';
      header.append(brand, homeBtn);
    } else if (!homeBtn) {
      homeBtn = createElement('button', '← Back to Menu');
      homeBtn.type = 'button';
      homeBtn.className = 'cx-back-menu';
      header.append(homeBtn);
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
      // Ensure all tool components and panels are instantiated
      if (!window.ConnectifyWeakness?.panelRefs) {
        if (window.ConnectifyWeakness?.ensureWeaknessPanel) window.ConnectifyWeakness.ensureWeaknessPanel();
        else if (window.ConnectifyWeakness?.createWeaknessPanel) window.ConnectifyWeakness.createWeaknessPanel();
      }
      if (!window.ConnectifyCategorySettings?.panelRefs) {
        if (window.ConnectifyCategorySettings?.ensureSettingsPanel) window.ConnectifyCategorySettings.ensureSettingsPanel();
        else if (window.ConnectifyCategorySettings?.createSettingsPanel) window.ConnectifyCategorySettings.createSettingsPanel();
      }
      if (!window.ConnectifyProgress?.panelRefs && window.ConnectifyProgress?.ensureProgressPanel) {
        window.ConnectifyProgress.ensureProgressPanel();
      }

      if (!document.getElementById('connectify-predictor-toggle') && window.ConnectifyPredictorUI?.ensurePredictorPanel) {
        window.ConnectifyPredictorUI.ensurePredictorPanel();
      }

      const canonicalButtons = [
        { id: 'connectify-target-toggle', label: 'Target ATAR' },
        { id: 'connectify-grade-toggle', label: 'Target Grade' },
        { id: 'connectify-predictor-toggle', label: 'Predictor' },
        { id: 'connectify-progress-toggle', label: 'Year in Progress' },
        { id: 'connectify-estimate-toggle', label: 'ATAR Estimate' },
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
          } else if (item.id === 'connectify-predictor-toggle') {
            const predBtn = window.ConnectifyPredictorUI?.panelRefs?.toggleBtn || window.ConnectifyPredictorUI?.getInstance?.()?.toggleBtn;
            if (predBtn) matches = [predBtn];
          } else if (item.id === 'connectify-progress-toggle') {
            const progBtn = document.getElementById('connectify-progress-toggle') || window.ConnectifyProgress?.panelRefs?.toggleBtn;
            if (progBtn) matches = [progBtn];
          } else if (item.id === 'connectify-weakness-toggle' && window.ConnectifyWeakness?.panelRefs?.toggleBtn) {
            matches = [window.ConnectifyWeakness.panelRefs.toggleBtn];
          } else if (item.id === 'connectify-categories-toggle' && window.ConnectifyCategorySettings?.panelRefs?.catBtn) {
            matches = [window.ConnectifyCategorySettings.panelRefs.catBtn];
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
        if (!btn) {
          btn = createElement('button', item.label);
          btn.id = item.id;
          btn.type = 'button';
        } else if (item.label) {
          btn.textContent = item.label;
        }
        if (item.id === 'connectify-weakness-toggle' || item.id === 'connectify-categories-toggle') {
          btn.className = 'cx-secondary-tool';
        } else {
          btn.className = 'cx-calculator-tool';
        }
        btn.setAttribute('aria-pressed', 'false');
        resolvedButtons.push(btn);
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
        } else if (matches.length === 0 && panelId === 'connectify-predictor') {
          const pPanel = window.ConnectifyPredictorUI?.panelRefs?.panel || window.ConnectifyPredictorUI?.getInstance?.()?.panel;
          if (pPanel) matches = [pPanel];
        } else if (matches.length === 0 && panelId === 'connectify-progress') {
          const progPanel = document.getElementById('connectify-progress') || window.ConnectifyProgress?.panelRefs?.panel;
          if (progPanel) matches = [progPanel];
        } else if (matches.length === 0 && panelId === 'connectify-weakness') {
          const wPanel = window.ConnectifyWeakness?.panelRefs?.panel || (window.ConnectifyWeakness?.ensureWeaknessPanel && window.ConnectifyWeakness.ensureWeaknessPanel().panel);
          if (wPanel) matches = [wPanel];
        } else if (matches.length === 0 && panelId === 'connectify-categories') {
          const cPanel = window.ConnectifyCategorySettings?.panelRefs?.catPanel || (window.ConnectifyCategorySettings?.ensureSettingsPanel && window.ConnectifyCategorySettings.ensureSettingsPanel().catPanel);
          if (cPanel) matches = [cPanel];
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

    let justReturnedToMenu = false;
    const setJustReturnedToMenu = (val) => {
      justReturnedToMenu = val;
      window._connectifyJustReturnedToMenu = val;
    };

    function openSidebar() {
      setJustReturnedToMenu(false);
      sidebar.hidden = false;
      handle.setAttribute('aria-expanded', 'true');
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
      setJustReturnedToMenu(false);
      closeAllTools();
      sidebar.hidden = true;
      handle.setAttribute('aria-expanded', 'false');
      updateHandleState(false);
    }

    handle.onclick = () => {
      setJustReturnedToMenu(false);
      if (sidebar.hidden) {
        openSidebar();
      } else {
        closeSidebar();
      }
    };

    handle.addEventListener('mouseenter', () => {
      if (sidebar.hidden) openSidebar();
    });

    if (homeBtn) {
      homeBtn.onclick = () => {
        if (sidebar.classList.contains('cx-tool-active')) {
          setJustReturnedToMenu(true);
        }
        closeAllTools();
      };
    }

    // Collapse sidebar when clicking outside the sidebar and handle
    if (window._connectifyOutsideClickAttached) {
      document.removeEventListener('click', window._connectifyOutsideClickAttached);
    }
    const handleOutsideClick = e => {
      if (sidebar.hidden) return;
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
      const isInside = path.includes(sidebar) ||
                       path.includes(handle) ||
                       sidebar.contains(e.target) ||
                       handle.contains(e.target);
      if (!isInside) {
        setJustReturnedToMenu(false);
        closeSidebar();
      }
    };
    window._connectifyOutsideClickAttached = handleOutsideClick;
    document.addEventListener('click', handleOutsideClick);

    // Central delegated tool launcher listener
    const handleToolLaunchClick = e => {
      if (e._connectifyToolHandled) return;
      const toggle = e.target.closest('#connectify-target-toggle, #connectify-grade-toggle, #connectify-estimate-toggle, #connectify-predictor-toggle, #connectify-progress-toggle, #connectify-weakness-toggle, #connectify-categories-toggle');
      if (!toggle) return;
      e._connectifyToolHandled = true;
      setJustReturnedToMenu(false);

      const id = toggle.id;
      if (id === 'connectify-target-toggle' || id === 'connectify-grade-toggle' || id === 'connectify-estimate-toggle') {
        const mode = id === 'connectify-target-toggle' ? 'target' : (id === 'connectify-grade-toggle' ? 'grade' : 'estimate');
        ['connectify-target-toggle', 'connectify-grade-toggle', 'connectify-estimate-toggle'].forEach(tid => {
          document.getElementById(tid)?.setAttribute('aria-pressed', tid === id ? 'true' : 'false');
        });
        if (window.ConnectifyAtar?.openCalculator) {
          window.ConnectifyAtar.openCalculator(mode);
        } else {
          window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'calculator' }));
        }
      } else if (id === 'connectify-predictor-toggle') {
        const refs = window.ConnectifyPredictorUI?.panelRefs || (window.ConnectifyPredictorUI?.ensurePredictorPanel && window.ConnectifyPredictorUI.ensurePredictorPanel());
        if (refs?.openPredictor) {
          const pPanel = refs.panel || document.getElementById('connectify-predictor');
          if (pPanel && !pPanel.hidden) {
            refs.closePredictor();
            window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'home' }));
          } else {
            refs.openPredictor();
          }
        } else {
          window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'predictor' }));
        }
      } else if (id === 'connectify-progress-toggle') {
        const refs = window.ConnectifyProgress?.panelRefs || (window.ConnectifyProgress?.ensureProgressPanel && window.ConnectifyProgress.ensureProgressPanel());
        if (refs?.openProgress) {
          const progPanel = refs.panel || document.getElementById('connectify-progress');
          if (progPanel && !progPanel.hidden) {
            refs.closeProgress();
            window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'home' }));
          } else {
            refs.openProgress();
          }
        } else {
          const progPanel = document.getElementById('connectify-progress');
          if (progPanel) {
            const willShow = progPanel.hidden;
            progPanel.hidden = !willShow;
            toggle.setAttribute('aria-expanded', String(willShow));
            toggle.setAttribute('aria-pressed', String(willShow));
            if (willShow) {
              window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'progress' }));
              if (window.ConnectifyProgress?.panelRefs?.refresh) {
                window.ConnectifyProgress.panelRefs.refresh();
              }
            } else {
              window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'home' }));
            }
          }
        }
      } else if (id === 'connectify-weakness-toggle') {
        const refs = window.ConnectifyWeakness?.panelRefs || (window.ConnectifyWeakness?.ensureWeaknessPanel && window.ConnectifyWeakness.ensureWeaknessPanel());
        if (refs?.openWeakness) {
          const wPanel = refs.panel || document.getElementById('connectify-weakness');
          if (wPanel && !wPanel.hidden) {
            refs.closeWeakness();
            window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'home' }));
          } else {
            refs.openWeakness();
          }
        } else {
          window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'weakness' }));
        }
      } else if (id === 'connectify-categories-toggle') {
        const refs = window.ConnectifyCategorySettings?.panelRefs || (window.ConnectifyCategorySettings?.ensureSettingsPanel && window.ConnectifyCategorySettings.ensureSettingsPanel());
        if (refs?.openCategories) {
          const cPanel = refs.catPanel || document.getElementById('connectify-categories');
          if (cPanel && !cPanel.hidden) {
            refs.closeCategories();
            window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'home' }));
          } else {
            refs.openCategories();
          }
        } else {
          window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'categories' }));
        }
      }
    };

    if (window._connectifyToolLaunchAttached) {
      sidebar.removeEventListener('click', window._connectifyToolLaunchAttached);
      document.removeEventListener('click', window._connectifyToolLaunchAttached);
    }
    window._connectifyToolLaunchAttached = handleToolLaunchClick;
    sidebar.addEventListener('click', handleToolLaunchClick);
    document.addEventListener('click', handleToolLaunchClick);

    const handleConnectifyOpen = e => {
      if (e.detail !== 'home') openSidebar();
      const activeTool = e.detail;
      const btnMap = {
        calculator: ['connectify-target-toggle', 'connectify-grade-toggle', 'connectify-estimate-toggle'],
        predictor: ['connectify-predictor-toggle'],
        progress: ['connectify-progress-toggle'],
        weakness: ['connectify-weakness-toggle'],
        categories: ['connectify-categories-toggle']
      };
      if (activeTool === 'calculator') {
        toolMenu.querySelectorAll('button').forEach(btn => {
          if (!btnMap.calculator.includes(btn.id)) {
            btn.setAttribute('aria-pressed', 'false');
          }
        });
        return;
      }
      toolMenu.querySelectorAll('button').forEach(btn => {
        const isActive = btnMap[activeTool]?.includes(btn.id) || false;
        btn.setAttribute('aria-pressed', String(isActive));
      });
    };

    if (window._connectifyOpenAttached) {
      window.removeEventListener('connectify-open', window._connectifyOpenAttached);
    }
    window._connectifyOpenAttached = handleConnectifyOpen;
    window.addEventListener('connectify-open', handleConnectifyOpen);

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

    window.ConnectifyOpenSidebar = openSidebar;
    window.ConnectifyCloseSidebar = closeSidebar;
  } catch (err) {
    console.error('Connectify error in sidebar.js:', err);
  }
})();

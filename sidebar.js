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

    function getTopBarBottom() {
      const selectors = [
        '.cvr-c-header',
        '.cvr-c-primary-navigation',
        '.cvr-c-primary-navigation__container',
        '.cvr-c-primary-navigation__bar',
        '.cvr-c-branding',
        'header.cvr-c-header',
        'nav.cvr-c-primary-navigation'
      ];
      let maxBottom = 0;
      for (const sel of selectors) {
        const matches = document.querySelectorAll(sel);
        for (const el of matches) {
          if (sidebar.contains(el) || el.id === 'connectify-sidebar-handle') continue;
          if (typeof el.getBoundingClientRect === 'function') {
            const rect = el.getBoundingClientRect();
            // Must be docked at or above viewport top to be part of the top navigation bar
            if (rect.top <= 25 && rect.bottom > maxBottom) {
              maxBottom = rect.bottom;
            }
          }
        }
      }
      return Math.max(0, maxBottom);
    }

    function updateHandlePosition() {
      try {
        const topBarBottom = getTopBarBottom();
        const vh = window.innerHeight || document.documentElement?.clientHeight || 800;
        const availableHeight = Math.max(0, vh - topBarBottom);
        const centerY = Math.round(topBarBottom + availableHeight / 2);
        handle.style.top = `${centerY}px`;
        handle.style.transform = 'translateY(-50%)';
      } catch {}
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

      handle.title = isOpen ? 'Close Connectify tools' : 'Open Connectify tools';
      handle.setAttribute('aria-label', handle.title);
      handle.setAttribute('aria-expanded', String(isOpen));
      updateHandlePosition();
    }

    handle.updatePosition = updateHandlePosition;
    window._connectifyUpdateHandlePosition = updateHandlePosition;
    updateHandleState(false);
    if (window._connectifyScrollAttached) {
      window.removeEventListener('scroll', window._connectifyScrollAttached, true);
    }
    window._connectifyScrollAttached = updateHandlePosition;
    window.addEventListener('scroll', updateHandlePosition, { passive: true, capture: true });

    if (window._connectifyResizeAttached) {
      window.removeEventListener('resize', window._connectifyResizeAttached);
    }
    window._connectifyResizeAttached = updateHandlePosition;
    window.addEventListener('resize', updateHandlePosition, { passive: true });

    [50, 150, 300, 600, 1200].forEach(delay => setTimeout(updateHandlePosition, delay));
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', updateHandlePosition);
    }
    window.addEventListener('load', updateHandlePosition);

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
      if (!window.ConnectifyWeakness?.panelRefs && window.ConnectifyWeakness?.ensureWeaknessPanel) {
        window.ConnectifyWeakness.ensureWeaknessPanel();
      } else if (!window.ConnectifyWeakness?.panelRefs && window.ConnectifyWeakness?.createWeaknessPanel) {
        window.ConnectifyWeakness.createWeaknessPanel();
      }

      if (!window.ConnectifyCategorySettings?.panelRefs && window.ConnectifyCategorySettings?.ensureSettingsPanel) {
        window.ConnectifyCategorySettings.ensureSettingsPanel();
      } else if (!window.ConnectifyCategorySettings?.panelRefs && window.ConnectifyCategorySettings?.createSettingsPanel) {
        window.ConnectifyCategorySettings.createSettingsPanel();
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

    function openSidebar() {
      justReturnedToMenu = false;
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
      justReturnedToMenu = false;
      if (hoverCollapseTimeout) {
        clearTimeout(hoverCollapseTimeout);
        hoverCollapseTimeout = null;
      }
      closeAllTools();
      sidebar.hidden = true;
      updateHandleState(false);
    }

    handle.onclick = () => {
      justReturnedToMenu = false;
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
          justReturnedToMenu = true;
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
        justReturnedToMenu = false;
        closeSidebar();
      }
    };
    window._connectifyOutsideClickAttached = handleOutsideClick;
    document.addEventListener('click', handleOutsideClick);

    // Edge push to expand & hover collapse when no panel is active
    let hoverCollapseTimeout = null;

    if (window._connectifyMouseMoveAttached) {
      document.removeEventListener('mousemove', window._connectifyMouseMoveAttached);
    }
    const handleMouseMove = e => {
      // 1. Moving mouse to the left edge of the screen expands the sidebar
      if (sidebar.hidden) {
        if (e.clientX <= 12 || handle.contains(e.target)) {
          justReturnedToMenu = false;
          if (hoverCollapseTimeout) {
            clearTimeout(hoverCollapseTimeout);
            hoverCollapseTimeout = null;
          }
          openSidebar();
        }
        return;
      }

      // 2. If sidebar is open and NO panel is active:
      // Collapse when mouse moves outside of the sidebar and handle,
      // unless user just returned to menu from an active tool panel
      if (!sidebar.classList.contains('cx-tool-active') && !justReturnedToMenu) {
        const sidebarRect = typeof sidebar.getBoundingClientRect === 'function' ? sidebar.getBoundingClientRect() : null;
        const handleRect = typeof handle.getBoundingClientRect === 'function' ? handle.getBoundingClientRect() : null;

        const inSidebar = sidebar.contains(e.target) ||
          (sidebarRect && e.clientX >= sidebarRect.left && e.clientX <= sidebarRect.right && e.clientY >= sidebarRect.top && e.clientY <= sidebarRect.bottom);
        const inHandle = handle.contains(e.target) ||
          (handleRect && e.clientX >= handleRect.left && e.clientX <= handleRect.right && e.clientY >= handleRect.top && e.clientY <= handleRect.bottom);

        if (inSidebar || inHandle) {
          if (hoverCollapseTimeout) {
            clearTimeout(hoverCollapseTimeout);
            hoverCollapseTimeout = null;
          }
        } else {
          // Mouse is outside sidebar and handle, no tool is active, and didn't just return to menu
          if (!hoverCollapseTimeout) {
            hoverCollapseTimeout = setTimeout(() => {
              hoverCollapseTimeout = null;
              if (!sidebar.hidden && !sidebar.classList.contains('cx-tool-active') && !justReturnedToMenu) {
                closeSidebar();
              }
            }, 120);
          }
        }
      } else {
        // A panel is active or user just returned to menu: hover-out should NOT collapse
        if (hoverCollapseTimeout) {
          clearTimeout(hoverCollapseTimeout);
          hoverCollapseTimeout = null;
        }
      }
    };
    window._connectifyMouseMoveAttached = handleMouseMove;
    document.addEventListener('mousemove', handleMouseMove, { passive: true });

    if (window._connectifyMouseLeaveAttached) {
      document.removeEventListener('mouseleave', window._connectifyMouseLeaveAttached);
    }
    const handleMouseLeaveDoc = () => {
      if (!sidebar.hidden && !sidebar.classList.contains('cx-tool-active') && !justReturnedToMenu) {
        closeSidebar();
      }
    };
    window._connectifyMouseLeaveAttached = handleMouseLeaveDoc;
    document.addEventListener('mouseleave', handleMouseLeaveDoc);

    // Central delegated tool launcher listener
    const handleToolLaunchClick = e => {
      const toggle = e.target.closest('#connectify-target-toggle, #connectify-grade-toggle, #connectify-estimate-toggle, #connectify-progress-toggle, #connectify-weakness-toggle, #connectify-categories-toggle');
      if (!toggle) return;
      justReturnedToMenu = false;

      const id = toggle.id;
      if (id === 'connectify-target-toggle') {
        if (window.ConnectifyAtar?.openCalculator) {
          window.ConnectifyAtar.openCalculator('target');
        } else {
          window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'calculator' }));
        }
      } else if (id === 'connectify-grade-toggle') {
        if (window.ConnectifyAtar?.openCalculator) {
          window.ConnectifyAtar.openCalculator('grade');
        } else {
          window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'calculator' }));
        }
      } else if (id === 'connectify-estimate-toggle') {
        if (window.ConnectifyAtar?.openCalculator) {
          window.ConnectifyAtar.openCalculator('estimate');
        } else {
          window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'calculator' }));
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

    sidebar.addEventListener('click', handleToolLaunchClick);
    document.addEventListener('click', handleToolLaunchClick);

    window.addEventListener('connectify-open', e => {
      if (e.detail !== 'home') openSidebar();
      const activeTool = e.detail;
      const btnMap = {
        calculator: ['connectify-target-toggle', 'connectify-grade-toggle', 'connectify-estimate-toggle'],
        predictor: ['connectify-predictor-toggle'],
        progress: ['connectify-progress-toggle'],
        weakness: ['connectify-weakness-toggle'],
        categories: ['connectify-categories-toggle']
      };
      toolMenu.querySelectorAll('button').forEach(btn => {
        const isActive = btnMap[activeTool]?.includes(btn.id) || false;
        btn.setAttribute('aria-pressed', String(isActive));
      });
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

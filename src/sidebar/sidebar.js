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

    let sidebar = document.getElementById('connectify-sidebar') || window.ConnectifySidebarHandle?.sidebar;
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
      handle = Object.assign(createElement('button', '❮'), {
        id: 'connectify-sidebar-handle',
        type: 'button',
        title: 'Open Connectify tools'
      });
      handle.setAttribute('aria-label', 'Open Connectify tools');
      handle.setAttribute('aria-expanded', 'false');
    }

    const updateHandlePosition = () => (window._connectifyUpdateHandlePosition || window.ConnectifySidebarHandle?.updateHandlePosition || function() {})();
    const updateHandleState = (isOpen) => (window.ConnectifySidebarHandle?.updateHandleState || function() {})(isOpen);

    // Header and navigation
    let header = sidebar.querySelector('header');
    let homeBtn = sidebar.querySelector('.cx-back-menu');
    const strayCloseBtn = sidebar.querySelector('.cx-close-btn');
    if (strayCloseBtn) strayCloseBtn.remove();

    if (!header) {
      header = createElement('header');
      const brand = createElement('strong', 'Connectify');
      homeBtn = Object.assign(createElement('button', '← Back to Menu'), { type: 'button', className: 'cx-back-menu' });
      header.append(brand, homeBtn);
    } else if (!homeBtn) {
      homeBtn = Object.assign(createElement('button', '← Back to Menu'), { type: 'button', className: 'cx-back-menu' });
      header.append(homeBtn);
    }

    let toolMenu = sidebar.querySelector('.cx-tool-menu') || Object.assign(createElement('nav'), { className: 'cx-tool-menu' });
    toolMenu.setAttribute('aria-label', 'Tools');

    let workspace = sidebar.querySelector('.cx-workspace') || Object.assign(createElement('div'), { className: 'cx-workspace' });

    let introText = sidebar.querySelector('.cx-tools-intro') || Object.assign(
      createElement('p', 'Select a tool below to view your analytics. Ensure subject outlines are expanded in Connect to load assessment data.'),
      { className: 'cx-tools-intro' }
    );

    function clickConnectAllButton() {
      const selectors = [
        '.eds-c-accordion--dark .eds-c-accordion__section-label', '.eds-c-accordion--dark .eds-c-accordion__section-heading',
        '.eds-c-accordion__section-label', '.eds-c-accordion__section-heading',
        '.cvr-c-category-toolbar__container .v-label', '.cvr-c-category-toolbar .v-label',
        '.cvr-c-tree-list__item .v-label', '.cvr-c-tree-list__item', '.v-accordion .v-label', '[role="button"]'
      ];
      for (const sel of selectors) {
        const match = Array.from(document.querySelectorAll(sel)).find(el => (el.innerText || el.textContent || '').trim().toLowerCase() === 'all');
        if (match) {
          match.click();
          if (match.parentElement && typeof match.parentElement.click === 'function' && match.parentElement !== document.body) {
            match.parentElement.click();
          }
          try {
            const Evt = window.MouseEvent || window.Event;
            if (typeof Evt === 'function') {
              match.dispatchEvent(new Evt('click', { bubbles: true, cancelable: true }));
            }
          } catch (_) {}
          return true;
        }
      }
      return false;
    }

    function isOutlinesFilterRestricted() {
      const outlinesRoot = document.querySelector('.assessmentoutlinesui, [class*="assessmentoutline"], .cvr-c-category-toolbar, .eds-c-accordion--dark');
      if (!outlinesRoot) return false;

      const tiles = document.querySelectorAll('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile, [class*="subject-card"]');
      const toolbarTitle = (document.querySelector('.cvr-c-category-toolbar__title .v-label, .cvr-c-category-toolbar__title')?.textContent || '').trim();

      const filterApplied = Boolean(toolbarTitle && toolbarTitle.toLowerCase() !== 'all');
      const insufficientClasses = tiles.length < 4;

      return filterApplied || insufficientClasses;
    }

    let filterNotice = sidebar.querySelector('.cx-filter-notice');
    if (!filterNotice) {
      filterNotice = Object.assign(createElement('div'), { className: 'cx-filter-notice', hidden: true });
      const noticeTitle = Object.assign(createElement('strong', 'Filter Applied'), { className: 'cx-filter-title' });
      const noticeMsg = Object.assign(createElement('p', 'A course outline filter is currently active. Connectify features require all courses to be visible. Please return to "All" to re-enable tools.'), { className: 'cx-filter-text' });
      const backToAllBtn = Object.assign(createElement('button', '← Back to All'), {
        type: 'button', className: 'cx-back-to-all-btn', id: 'cx-back-to-all-btn',
        onclick: (e) => {
          e.preventDefault(); e.stopPropagation();
          clickConnectAllButton();
          setTimeout(syncState, 250);
          setTimeout(syncState, 800);
        }
      });
      filterNotice.append(noticeTitle, noticeMsg, backToAllBtn);
    }

    [header, filterNotice, introText, toolMenu, workspace].forEach(el => {
      if (el && !sidebar.contains(el)) sidebar.append(el);
    });

    function attachSidebar() {
      const parent = document.body || document.documentElement;
      if (!parent) return;

      const existingHandles = document.querySelectorAll('#connectify-sidebar-handle');
      existingHandles.forEach(h => { if (h !== handle) h.remove(); });

      const existingSidebars = document.querySelectorAll('#connectify-sidebar');
      existingSidebars.forEach(s => { if (s !== sidebar) s.remove(); });

      if (sidebar.parentElement !== parent) parent.appendChild(sidebar);
      parent.appendChild(handle);
    }

    attachSidebar();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachSidebar);
    window.addEventListener('load', attachSidebar);

    /**
     * Mount tool launcher buttons into the sidebar menu and tool panels into the workspace.
     */
    function mountTools() {
      if (!window.ConnectifyWeakness?.panelRefs) (window.ConnectifyWeakness?.ensureWeaknessPanel || window.ConnectifyWeakness?.createWeaknessPanel)?.();
      if (!window.ConnectifyCategorySettings?.panelRefs) (window.ConnectifyCategorySettings?.ensureSettingsPanel || window.ConnectifyCategorySettings?.createSettingsPanel)?.();
      if (!window.ConnectifyProgress?.panelRefs) window.ConnectifyProgress?.ensureProgressPanel?.();
      if (!document.getElementById('connectify-predictor-toggle')) window.ConnectifyPredictorUI?.ensurePredictorPanel?.();

      const canonicalButtons = [
        { id: 'connectify-target-toggle', label: 'Target ATAR' }, { id: 'connectify-grade-toggle', label: 'Target Grade' },
        { id: 'connectify-predictor-toggle', label: 'Predictor' }, { id: 'connectify-progress-toggle', label: 'Year in Progress' },
        { id: 'connectify-estimate-toggle', label: 'ATAR Estimate' }, { id: 'connectify-weakness-toggle', label: 'Weakness Analyzer' },
        { id: 'connectify-categories-toggle', label: 'Settings' }
      ];

      const resolvedButtons = [];
      for (const item of canonicalButtons) {
        let matches = Array.from(document.querySelectorAll('#' + item.id));
        if (matches.length === 0) {
          const atarBtns = window.ConnectifyAtar?.calculatorButtons || window.ConnectifyAtar?.toolButtons || [];
          const found = atarBtns.find(b => b && b.id === item.id) ||
            (item.id === 'connectify-predictor-toggle' && (window.ConnectifyPredictorUI?.panelRefs?.toggleBtn || window.ConnectifyPredictorUI?.getInstance?.()?.toggleBtn)) ||
            (item.id === 'connectify-progress-toggle' && (document.getElementById('connectify-progress-toggle') || window.ConnectifyProgress?.panelRefs?.toggleBtn)) ||
            (item.id === 'connectify-weakness-toggle' && window.ConnectifyWeakness?.panelRefs?.toggleBtn) ||
            (item.id === 'connectify-categories-toggle' && window.ConnectifyCategorySettings?.panelRefs?.catBtn);
          if (found) matches = [found];
        }
        let btn = matches.find(m => m.parentElement === toolMenu) || matches[0];
        matches.forEach(m => { if (m !== btn && m.parentElement) m.remove(); });
        if (!btn) {
          btn = createElement('button', item.label);
          btn.id = item.id;
          btn.type = 'button';
        } else if (item.label) {
          btn.textContent = item.label;
        }
        btn.className = (item.id === 'connectify-weakness-toggle' || item.id === 'connectify-categories-toggle') ? 'cx-secondary-tool' : 'cx-calculator-tool';
        btn.setAttribute('aria-pressed', 'false');
        resolvedButtons.push(btn);
      }

      const resolvedSet = new Set(resolvedButtons);
      Array.from(toolMenu.children).forEach(child => {
        if (!resolvedSet.has(child)) child.remove();
      });

      for (const btn of resolvedButtons) toolMenu.append(btn);

      const panelDefs = [
        ['connectea-atar', () => window.ConnectifyAtar?.calculatorPanel],
        ['connectify-predictor', () => window.ConnectifyPredictorUI?.panelRefs?.panel || window.ConnectifyPredictorUI?.getInstance?.()?.panel],
        ['connectify-progress', () => document.getElementById('connectify-progress') || window.ConnectifyProgress?.panelRefs?.panel],
        ['connectify-weakness', () => window.ConnectifyWeakness?.panelRefs?.panel || (window.ConnectifyWeakness?.ensureWeaknessPanel && window.ConnectifyWeakness.ensureWeaknessPanel().panel)],
        ['connectify-categories', () => window.ConnectifyCategorySettings?.panelRefs?.catPanel || (window.ConnectifyCategorySettings?.ensureSettingsPanel && window.ConnectifyCategorySettings.ensureSettingsPanel().catPanel)]
      ];

      for (const [panelId, getter] of panelDefs) {
        let matches = Array.from(document.querySelectorAll('#' + panelId));
        if (matches.length === 0) {
          const fallback = getter();
          if (fallback) matches = [fallback];
        }
        if (matches.length > 0) {
          const panel = matches.find(m => m.parentElement === workspace) || matches[0];
          matches.forEach(m => { if (m !== panel && m.parentElement) m.remove(); });
          if (panel.parentElement !== workspace) workspace.append(panel);
        }
      }
    }

    let justReturnedToMenu = false;
    let justReturnedToMenuTimer = null;
    const setJustReturnedToMenu = (val) => {
      justReturnedToMenu = val;
      window._connectifyJustReturnedToMenu = val;
      if (justReturnedToMenuTimer) clearTimeout(justReturnedToMenuTimer);
      if (val) {
        justReturnedToMenuTimer = setTimeout(() => {
          justReturnedToMenu = false;
          window._connectifyJustReturnedToMenu = false;
          justReturnedToMenuTimer = null;
        }, 2000);
      }
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
      for (const child of workspace.children) child.hidden = true;
      sidebar.classList.remove('cx-tool-active');
      introText.hidden = isOutlinesFilterRestricted();
      toolMenu.querySelectorAll('button').forEach(btn => btn.setAttribute('aria-pressed', 'false'));
      if (handle) {
        handle.dataset.toolActive = 'false';
        handle.style.left = sidebar.hidden ? '' : 'min(310px, calc(100vw - 30px))';
      }
      updateHandlePosition();
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
      if (sidebar.hidden) openSidebar(); else closeSidebar();
    };

    handle.addEventListener('mouseenter', () => {
      if (sidebar.hidden) openSidebar();
    });

    if (homeBtn) {
      homeBtn.onclick = () => {
        if (sidebar.classList.contains('cx-tool-active')) setJustReturnedToMenu(true);
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
      const isInside = path.includes(sidebar) || path.includes(handle) || sidebar.contains(e.target) || handle.contains(e.target);
      if (!isInside) {
        setJustReturnedToMenu(false);
        closeSidebar();
      }
    };
    window._connectifyOutsideClickAttached = handleOutsideClick;
    document.addEventListener('click', handleOutsideClick);

    // Central delegated tool launcher listener
    const handleToolLaunchClick = e => {
      if (e._connectifyToolHandled || sidebar.classList.contains('cx-filter-disabled')) return;
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
      } else {
        const toolMap = {
          'connectify-predictor-toggle': {
            getRefs: () => window.ConnectifyPredictorUI?.panelRefs || window.ConnectifyPredictorUI?.ensurePredictorPanel?.(),
            panelId: 'connectify-predictor',
            open: (r) => r?.openPredictor?.(),
            close: (r) => r?.closePredictor?.(),
            detail: 'predictor'
          },
          'connectify-progress-toggle': {
            getRefs: () => window.ConnectifyProgress?.panelRefs || window.ConnectifyProgress?.ensureProgressPanel?.(),
            panelId: 'connectify-progress',
            open: (r) => r?.openProgress?.(),
            close: (r) => r?.closeProgress?.(),
            detail: 'progress'
          },
          'connectify-weakness-toggle': {
            getRefs: () => window.ConnectifyWeakness?.panelRefs || window.ConnectifyWeakness?.ensureWeaknessPanel?.(),
            panelId: 'connectify-weakness',
            open: (r) => r?.openWeakness?.(),
            close: (r) => r?.closeWeakness?.(),
            detail: 'weakness'
          },
          'connectify-categories-toggle': {
            getRefs: () => window.ConnectifyCategorySettings?.panelRefs || window.ConnectifyCategorySettings?.ensureSettingsPanel?.(),
            panelId: 'connectify-categories',
            open: (r) => r?.openCategories?.(),
            close: (r) => r?.closeCategories?.(),
            detail: 'categories'
          }
        };
        const cfg = toolMap[id];
        if (cfg) {
          const refs = cfg.getRefs();
          const panel = refs?.panel || refs?.catPanel || document.getElementById(cfg.panelId);
          if (panel && !panel.hidden) {
            cfg.close(refs);
            window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'home' }));
          } else if (refs && (refs.openPredictor || refs.openProgress || refs.openWeakness || refs.openCategories)) {
            cfg.open(refs);
          } else if (panel) {
            panel.hidden = false;
            toggle.setAttribute('aria-expanded', 'true');
            toggle.setAttribute('aria-pressed', 'true');
            window.dispatchEvent(new CustomEvent('connectify-open', { detail: cfg.detail }));
            if (id === 'connectify-progress-toggle') refs?.refresh?.();
          } else {
            window.dispatchEvent(new CustomEvent('connectify-open', { detail: cfg.detail }));
          }
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
      if (sidebar.classList.contains('cx-filter-disabled')) return;
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
          if (!btnMap.calculator.includes(btn.id)) btn.setAttribute('aria-pressed', 'false');
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

        const isRestricted = isOutlinesFilterRestricted();
        sidebar.classList.toggle('cx-filter-disabled', isRestricted);
        if (filterNotice) filterNotice.hidden = !isRestricted;

        if (isRestricted) {
          for (const child of workspace.children) child.hidden = true;
          sidebar.classList.remove('cx-tool-active');
          introText.hidden = true;
          toolMenu.querySelectorAll('button').forEach(btn => {
            btn.disabled = true;
            btn.setAttribute('aria-disabled', 'true');
            btn.setAttribute('aria-pressed', 'false');
          });
        } else {
          toolMenu.querySelectorAll('button').forEach(btn => {
            btn.disabled = false;
            btn.removeAttribute('aria-disabled');
          });
          const hasActiveTool = Array.from(workspace.children).some(p => !p.hidden);
          sidebar.classList.toggle('cx-tool-active', hasActiveTool);
          introText.hidden = hasActiveTool;
        }

        const hasActiveTool = !isRestricted && Array.from(workspace.children).some(p => !p.hidden);
        if (handle) {
          handle.dataset.toolActive = hasActiveTool ? 'true' : 'false';
          if (!sidebar.hidden) {
            handle.style.left = hasActiveTool ? 'min(900px, calc(100vw - 30px))' : 'min(310px, calc(100vw - 30px))';
          }
        }
        updateHandlePosition();
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

    window.ConnectifySidebar = { isOutlinesFilterRestricted, clickConnectAllButton, syncState, openSidebar, closeSidebar };
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

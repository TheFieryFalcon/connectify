/**
 * Connectify Sidebar Drawer & Tool Launcher Workspace
 *
 * The slide-out drawer hosting Connectify's tools on every Connect page: builds the shell, opens and
 * closes it, keeps the active tool in sync and, away from Assessment Outlines, leaves only Settings
 * enabled under a notice linking there (sidebar-page-notice.js). The shell is built in sidebar-shell.js,
 * tools are mounted and launched by sidebar-tools.js.
 */
(() => {
  'use strict';

  try {
    if (window.__connectifySidebarInitialized || window.ConnectifyThemeAuth?.isAuthDisabled()) return;
    window.__connectifySidebarInitialized = true;

    const tools = window.ConnectifySidebarTools;
    const { ANYWHERE_TOOLS } = window.ConnectifySidebarPageNotice;
    const onOutlines = () => window.ConnectifyUtils.isOutlinesPage();
    // Off the outlines page only Settings opens
    const isLimited = () => !onOutlines();
    const allowsTool = id => !isLimited() || ANYWHERE_TOOLS.has(id);

    const updateHandlePosition = () => (window._connectifyUpdateHandlePosition || window.ConnectifySidebarHandle?.updateHandlePosition || function() {})();
    const updateHandleState = (isOpen) => (window.ConnectifySidebarHandle?.updateHandleState || function() {})(isOpen);

    const shell = window.ConnectifySidebarShell.build();
    const { sidebar, handle, homeBtn, toolMenu, workspace, introText, pageNotice } = shell;
    const attachSidebar = shell.attach;

    attachSidebar();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachSidebar);
    window.addEventListener('load', attachSidebar);

    // The "just returned to menu" grace period is owned by sidebar-handle.js
    const setJustReturnedToMenu = value => window.ConnectifySidebarHandle?.setJustReturnedToMenu(value);

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
      introText.hidden = isLimited();
      pageNotice.hidden = !isLimited();
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
      if (e._connectifyToolHandled) return;
      const toggle = e.target.closest(tools.LAUNCHER_SELECTOR);
      if (!toggle || !allowsTool(toggle.id)) return;
      e._connectifyToolHandled = true;
      setJustReturnedToMenu(false);
      tools.launchTool(toggle);
    };

    if (window._connectifyToolLaunchAttached) {
      sidebar.removeEventListener('click', window._connectifyToolLaunchAttached);
      document.removeEventListener('click', window._connectifyToolLaunchAttached);
    }
    window._connectifyToolLaunchAttached = handleToolLaunchClick;
    sidebar.addEventListener('click', handleToolLaunchClick);
    document.addEventListener('click', handleToolLaunchClick);

    const handleConnectifyOpen = e => {
      if (isLimited() && e.detail !== 'home' && e.detail !== 'categories') return;
      if (e.detail !== 'home') openSidebar();
      const activeTool = e.detail;
      const btnMap = {
        calculator: ['connectify-goals-toggle', 'connectify-estimator-toggle'],
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
        tools.mountTools(toolMenu, workspace);
        tools.syncPressedState(toolMenu);

        const limited = isLimited();
        sidebar.classList.toggle('cx-page-limited', limited);
        for (const btn of toolMenu.querySelectorAll('button')) {
          const off = !allowsTool(btn.id);
          if (btn.disabled !== off) btn.disabled = off;
          // Written only on change: this runs every 1.5s
          if (off && btn.getAttribute('aria-disabled') !== 'true') btn.setAttribute('aria-disabled', 'true');
          if (off && btn.getAttribute('aria-pressed') === 'true') btn.setAttribute('aria-pressed', 'false');
          if (!off && btn.hasAttribute('aria-disabled')) btn.removeAttribute('aria-disabled');
        }
        if (limited) {
          for (const child of workspace.children) if (child.id !== 'connectify-categories' && !child.hidden) child.hidden = true;
        }
        const hasActiveTool = Array.from(workspace.children).some(p => !p.hidden);
        sidebar.classList.toggle('cx-tool-active', hasActiveTool);
        introText.hidden = hasActiveTool || limited;
        // The notice belongs to the launcher menu, never above an open tool (Settings)
        const noticeHidden = !limited || hasActiveTool;
        if (pageNotice && pageNotice.hidden !== noticeHidden) pageNotice.hidden = noticeHidden;

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

    window.ConnectifySidebar = { isLimited, syncState, openSidebar, closeSidebar };
    window.ConnectifyInitSidebar = syncState;
    window.ConnectifyScheduler.every(1500, syncState, { mute: true });
    syncState();

    window.ConnectifyOpenSidebar = openSidebar;
    window.ConnectifyCloseSidebar = closeSidebar;
  } catch (err) {
    console.error('Connectify error in sidebar.js:', err);
  }
})();

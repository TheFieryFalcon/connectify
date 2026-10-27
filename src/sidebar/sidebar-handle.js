/**
 * Connectify Sidebar Handle & Positioning Engine
 *
 * Creates the handle, keeps it positioned (see sidebar-handle-position.js) while the page scrolls or
 * resizes, and expands or collapses the drawer from the left screen edge and on hover.
 * Exposes window.ConnectifySidebarHandle.
 */
(() => {
  'use strict';

  try {
    // Never on login or logout pages (manifest excludes login URLs; logged-out pages are known by content)
    if (window.ConnectifyThemeAuth?.isAuthDisabled()) return;

    const createElement = (tag, text) => {
      const el = document.createElement(tag);
      if (text) el.textContent = text;
      return el;
    };

    let sidebar = document.getElementById('connectify-sidebar');
    let handle = document.getElementById('connectify-sidebar-handle');

    if (!handle) {
      handle = createElement('button', '❮');
      handle.id = 'connectify-sidebar-handle';
      handle.type = 'button';
      handle.title = 'Open Connectify tools';
      handle.setAttribute('aria-label', 'Open Connectify tools');
      handle.setAttribute('aria-expanded', 'false');
    }

    if (!sidebar) {
      sidebar = createElement('aside');
      sidebar.id = 'connectify-sidebar';
      sidebar.hidden = true;
      sidebar.setAttribute('aria-label', 'Connectify tools');
    }

    const parent = document.body || document.documentElement;
    if (parent && !sidebar.parentElement) {
      parent.appendChild(sidebar);
    }
    if (parent && !handle.parentElement) {
      parent.appendChild(handle);
    }

    const getSidebar = () => document.getElementById('connectify-sidebar') || sidebar;

    let justReturnedToMenu = false;
    let justReturnedToMenuTimer = null;
    const isJustReturnedToMenu = () => justReturnedToMenu || window._connectifyJustReturnedToMenu;
    const setJustReturnedToMenu = (v) => {
      justReturnedToMenu = v;
      window._connectifyJustReturnedToMenu = v;
      if (justReturnedToMenuTimer) {
        clearTimeout(justReturnedToMenuTimer);
        justReturnedToMenuTimer = null;
      }
      if (v) {
        justReturnedToMenuTimer = setTimeout(() => {
          justReturnedToMenu = false;
          window._connectifyJustReturnedToMenu = false;
          justReturnedToMenuTimer = null;
        }, 2000);
      }
    };
    const openSidebar = () => {
      setJustReturnedToMenu(false);
      if (window.ConnectifyOpenSidebar) {
        window.ConnectifyOpenSidebar();
      } else {
        const sb = getSidebar();
        if (sb) sb.hidden = false;
        updateHandleState(true);
      }
    };

    const closeSidebar = () => {
      setJustReturnedToMenu(false);
      if (window.ConnectifyCloseSidebar) {
        window.ConnectifyCloseSidebar();
      } else {
        const sb = getSidebar();
        if (sb) sb.hidden = true;
        updateHandleState(false);
      }
    };

    const position = window.ConnectifySidebarHandlePosition;
    function updateHandlePosition() {
      position.update(handle, getSidebar(), () => {
        const s = getSidebar();
        if (s && s.hidden) updateHandlePosition();
      });
    }

    function updateHandleState(isOpen) {
      const h = document.getElementById('connectify-sidebar-handle') || handle;
      if (!h) return;
      const icon = createElement('span', isOpen ? '❮' : '❯');
      icon.className = 'cx-handle-arrow';
      if (typeof h.replaceChildren === 'function') {
        h.replaceChildren(icon);
      } else {
        while (h.firstChild) h.removeChild(h.firstChild);
        h.append(icon);
      }

      h.title = isOpen ? 'Close Connectify tools' : 'Open Connectify tools';
      h.setAttribute('aria-label', h.title);
      h.setAttribute('aria-expanded', String(isOpen));
      updateHandlePosition();
    }

    handle.updatePosition = updateHandlePosition;
    window._connectifyUpdateHandlePosition = updateHandlePosition;
    updateHandleState(false);
    let handleRafPending = false;
    let scrollTransitionTimer = null;
    const handleScrollThrottled = e => {
      const sb = getSidebar();
      if (e && e.target && ((sb && sb.contains(e.target)) || handle.contains(e.target))) {
        return;
      }
      if (sb && sb.hidden) {
        handle.style.transition = 'left 0.2s cubic-bezier(0.16,1,0.3,1), background 0.15s ease';
        if (scrollTransitionTimer) clearTimeout(scrollTransitionTimer);
        scrollTransitionTimer = setTimeout(() => {
          handle.style.transition = '';
        }, 150);
      }
      if (!handleRafPending) {
        handleRafPending = true;
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => {
            handleRafPending = false;
            updateHandlePosition();
          });
        } else {
          handleRafPending = false;
          updateHandlePosition();
        }
      }
    };
    if (window._connectifyScrollAttached) {
      window.removeEventListener('scroll', window._connectifyScrollAttached, true);
    }
    window._connectifyScrollAttached = handleScrollThrottled;
    window.addEventListener('scroll', handleScrollThrottled, { passive: true, capture: true });

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

    // A click on the handle must win over hover, whatever order the browser sends its events in (Dia
    // fires hover events around clicks differently): after a click-close the drawer stays closed until
    // the pointer moves somewhere off the handle and outside the left-edge zone (the handle sliding out
    // from under a still pointer doesn't count), and a click that lands right after a
    // hover-open belongs to the same gesture, so it keeps the drawer open.
    const HOVER_CLICK_GRACE_MS = 400;
    let holdClosed = false;
    let hoverOpenedAt = 0;
    const isHoldingClosed = () => holdClosed;
    const releaseHold = () => { holdClosed = false; };
    function hoverOpen() {
      if (holdClosed) return false;
      hoverOpenedAt = Date.now();
      openSidebar();
      return true;
    }

    handle.onclick = () => {
      setJustReturnedToMenu(false);
      const sb = getSidebar();
      if (sb && sb.hidden) {
        holdClosed = false;
        openSidebar();
      } else if (Date.now() - hoverOpenedAt > HOVER_CLICK_GRACE_MS) {
        holdClosed = true;
        closeSidebar();
      }
    };

    handle.addEventListener('mouseenter', () => {
      const sb = getSidebar();
      if (sb && sb.hidden) hoverOpen();
    });

    window.ConnectifySidebarHandle = {
      handle,
      sidebar,
      getSidebar,
      getTopBarBottom: () => position.getTopBarBottom(getSidebar()),
      isElementFixedOrSticky: position.isElementFixedOrSticky,
      getConnectSidebar: () => position.getConnectSidebar(getSidebar()),
      updateHandlePosition,
      updateHandleState,
      openSidebar,
      closeSidebar,
      setJustReturnedToMenu,
      isJustReturnedToMenu,
      hoverOpen,
      isHoldingClosed,
      releaseHold
    };
  } catch (err) {
    console.error('Connectify error in sidebar-handle.js:', err);
  }
})();

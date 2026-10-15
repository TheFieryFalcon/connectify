/**
 * Connectify Sidebar: edge expand and hover collapse
 *
 * Moving the mouse to the left screen edge opens the drawer. While no tool is open (and the user did
 * not just come back to the menu), moving away collapses it after 120ms; leaving the page does too.
 * Extends window.ConnectifySidebarHandle.
 */
(() => {
  'use strict';

  const api = window.ConnectifySidebarHandle;
  if (!api) return;
  const { handle, sidebar, getSidebar, openSidebar, closeSidebar, setJustReturnedToMenu, isJustReturnedToMenu } = api;

  // Edge push to expand & hover collapse when no panel is active
  let hoverCollapseTimeout = null;

  if (window._connectifyMouseMoveAttached) {
    document.removeEventListener('mousemove', window._connectifyMouseMoveAttached);
  }
  const handleMouseMove = e => {
    const sb = getSidebar();
    if (!sb) return;

    // 1. Moving mouse to the left edge of the screen expands the sidebar
    if (sb.hidden) {
      if (e.clientX <= 12 || handle.contains(e.target)) {
        setJustReturnedToMenu(false);
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
    if (!sb.classList.contains('cx-tool-active') && !isJustReturnedToMenu()) {
      const sidebarRect = typeof sb.getBoundingClientRect === 'function' ? sb.getBoundingClientRect() : null;
      const handleRect = typeof handle.getBoundingClientRect === 'function' ? handle.getBoundingClientRect() : null;

      const inSidebar = sb.contains(e.target) ||
        (sidebarRect && e.clientX >= (sidebarRect.left - 5) && e.clientX <= (sidebarRect.right + 25) && e.clientY >= (sidebarRect.top - 5) && e.clientY <= (sidebarRect.bottom + 5));
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
            const curSb = getSidebar();
            if (curSb && !curSb.hidden && !curSb.classList.contains('cx-tool-active') && !isJustReturnedToMenu()) {
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

  const cancelCollapse = () => {
    if (hoverCollapseTimeout) {
      clearTimeout(hoverCollapseTimeout);
      hoverCollapseTimeout = null;
    }
  };
  const attachCancelEvents = (el) => {
    if (!el || typeof el.addEventListener !== 'function') return;
    el.addEventListener('scroll', cancelCollapse, { passive: true });
    el.addEventListener('wheel', cancelCollapse, { passive: true });
  };
  attachCancelEvents(sidebar);
  document.addEventListener('DOMContentLoaded', () => {
    const sb = getSidebar();
    attachCancelEvents(sb);
    attachCancelEvents(sb?.querySelector?.('.cx-workspace'));
  });

  if (window._connectifyMouseLeaveAttached) {
    document.removeEventListener('mouseleave', window._connectifyMouseLeaveAttached);
  }
  const handleMouseLeaveDoc = () => {
    const sb = getSidebar();
    if (sb && !sb.hidden && !sb.classList.contains('cx-tool-active') && !isJustReturnedToMenu()) {
      closeSidebar();
    }
  };
  window._connectifyMouseLeaveAttached = handleMouseLeaveDoc;
  document.addEventListener('mouseleave', handleMouseLeaveDoc);

  Object.assign(api, { handleMouseMove, handleMouseLeaveDoc });
})();

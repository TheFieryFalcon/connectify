/**
 * Connectify Sidebar Handle & Positioning Engine
 *
 * Controls handle positioning, Connect sidebar docking, scroll follow,
 * and mouse hover edge expanding.
 * Exposes window.ConnectifySidebarHandle.
 */
(() => {
  'use strict';

  try {
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

    function isElementFixedOrSticky(el) {
      let cur = el;
      while (cur && cur !== document.body && cur !== document.documentElement) {
        if (typeof window.getComputedStyle === 'function') {
          const style = window.getComputedStyle(cur);
          if (style) {
            const pos = style.position;
            if (pos === 'fixed' || pos === 'sticky') {
              return true;
            }
          }
        }
        cur = cur.parentElement;
      }
      return false;
    }

    function getConnectSidebar() {
      const selectors = [
        '.cvr-c-service-menu',
        '.cvr-c-service-menu__wrapper',
        '.cvr-c-side-menu',
        '.cvr-c-classes-menu',
        '.cvr-c-category-menu',
        '.product-menu',
        '.sidenav-menu-slider'
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && typeof el.getBoundingClientRect === 'function') {
          if (sidebar.contains(el) || el.id === 'connectify-sidebar-handle') continue;
          const rect = el.getBoundingClientRect();
          const height = el.offsetHeight || rect.height || 0;
          const width = el.offsetWidth || rect.width || 0;
          if (height >= 120 && (width > 0 || rect.width > 0) && rect.left <= 60 && rect.right > 0) {
            return el;
          }
        }
      }
      return null;
    }

    function updateHandlePosition() {
      try {
        const topBarBottom = getTopBarBottom();
        const vh = window.innerHeight || document.documentElement?.clientHeight || 800;
        const availableHeight = Math.max(0, vh - topBarBottom);
        const centerY = Math.round(topBarBottom + availableHeight / 2);

        const sb = getSidebar();
        // When Connectify tool drawer is OPEN: dock to drawer edge in the active viewport
        if (sb && !sb.hidden) {
          handle.style.position = 'fixed';
          handle.style.top = `${centerY}px`;
          handle.style.transform = 'translateY(-50%)';
          const isToolActive = sb.classList.contains('cx-tool-active');
          handle.dataset.toolActive = isToolActive ? 'true' : 'false';
          handle.style.left = isToolActive
            ? 'min(900px, calc(100vw - 30px))'
            : 'min(310px, calc(100vw - 30px))';
          return;
        }

        handle.dataset.toolActive = 'false';
        handle.style.left = '';

        // When Connectify tool drawer is CLOSED:
        // Anchor to Connect's native left sidebar if present, moving directly with it as the page scrolls
        const connectSidebar = getConnectSidebar();
        if (connectSidebar) {
          if (typeof ResizeObserver === 'function' && !connectSidebar._connectifyHandleObserved) {
            connectSidebar._connectifyHandleObserved = true;
            try {
              new ResizeObserver(() => {
                const s = getSidebar();
                if (s && s.hidden) updateHandlePosition();
              }).observe(connectSidebar);
            } catch {}
          }

          const rect = connectSidebar.getBoundingClientRect();
          const pageY = (typeof window.pageYOffset !== 'undefined') ? window.pageYOffset : (document.documentElement?.scrollTop || document.body?.scrollTop || 0);
          const sidebarDocTop = rect.top + pageY;
          const sidebarHeight = connectSidebar.offsetHeight || rect.height || 350;
          const isFixed = isElementFixedOrSticky(connectSidebar);

          const bodyRect = (document.body && typeof document.body.getBoundingClientRect === 'function') ? document.body.getBoundingClientRect() : null;
          const bodyTop = bodyRect ? (bodyRect.top + pageY) : 0;

          const targetDocY = Math.round(sidebarDocTop - bodyTop + (sidebarHeight <= vh ? sidebarHeight / 2 : Math.min(sidebarHeight, vh) / 2));
          handle._lastViewportY = centerY;

          if (isFixed) {
            handle.style.position = 'fixed';
            handle.style.top = `${centerY}px`;
          } else {
            handle.style.position = 'absolute';
            handle.style.top = `${targetDocY}px`;
          }
          handle.style.transform = 'translateY(-50%)';
          return;
        }

        // Fallback when no Connect sidebar is present: center within visible viewport below top bar
        handle._lastViewportY = centerY;
        handle.style.position = 'fixed';
        handle.style.top = `${centerY}px`;
        handle.style.transform = 'translateY(-50%)';
      } catch {}
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

    handle.onclick = () => {
      setJustReturnedToMenu(false);
      const sb = getSidebar();
      if (sb && sb.hidden) {
        openSidebar();
      } else {
        closeSidebar();
      }
    };

    handle.addEventListener('mouseenter', () => {
      const sb = getSidebar();
      if (sb && sb.hidden) openSidebar();
    });

    const workspace = sidebar.querySelector('.cx-workspace') || { addEventListener: () => {} };
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

    window.ConnectifySidebarHandle = {
      handle,
      sidebar,
      getSidebar,
      getTopBarBottom,
      isElementFixedOrSticky,
      getConnectSidebar,
      updateHandlePosition,
      updateHandleState,
      handleMouseMove,
      handleMouseLeaveDoc
    };
  } catch (err) {
    console.error('Connectify error in sidebar-handle.js:', err);
  }
})();

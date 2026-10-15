/**
 * Connectify Sidebar: handle positioning
 *
 * Works out where the sidebar handle sits: on the open drawer's edge, anchored to Connect's native
 * left sidebar (height >= 120, moving with it as the page scrolls), or centred in the viewport below
 * Connect's top bar. Exposes window.ConnectifySidebarHandlePosition.
 */
(() => {
  'use strict';

  function getTopBarBottom(sidebar) {
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

  function getConnectSidebar(sidebar) {
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

  /**
   * Positions the handle: docked to the open drawer's edge, anchored to Connect's own left sidebar
   * (moving with it as the page scrolls), or centred below the top bar when neither exists.
   * onConnectSidebarResize runs when Connect's sidebar changes size.
   */
  function update(handle, sb, onConnectSidebarResize) {
    try {
      const topBarBottom = getTopBarBottom(sb);
      const vh = window.innerHeight || document.documentElement?.clientHeight || 800;
      const availableHeight = Math.max(0, vh - topBarBottom);
      const centerY = Math.round(topBarBottom + availableHeight / 2);

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
      const connectSidebar = getConnectSidebar(sb);
      if (connectSidebar) {
        if (typeof ResizeObserver === 'function' && !connectSidebar._connectifyHandleObserved) {
          connectSidebar._connectifyHandleObserved = true;
          try {
            new ResizeObserver(() => onConnectSidebarResize?.()).observe(connectSidebar);
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

  window.ConnectifySidebarHandlePosition = { getTopBarBottom, isElementFixedOrSticky, getConnectSidebar, update };
})();

/**
 * Connectify Sidebar: drawer shell
 *
 * Builds (or adopts) the drawer, its handle, header with "Back to Menu", the filter notice, intro
 * text, tool menu and workspace, and keeps them attached to the page.
 * Exposes window.ConnectifySidebarShell.
 */
(() => {
  'use strict';

  /** Builds or adopts the drawer elements; onBackToAll runs after the "Back to All" filter button. */
  function build(onBackToAll) {
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

    const filterNotice = sidebar.querySelector('.cx-filter-notice') || window.ConnectifySidebarFilter.createFilterNotice(onBackToAll);

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

      // Re-appending an attached node still fires mutations for every page observer, so only move when detached
      if (sidebar.parentElement !== parent) parent.appendChild(sidebar);
      if (handle.parentElement !== parent) parent.appendChild(handle);
    }

    return { sidebar, handle, header, homeBtn, toolMenu, workspace, introText, filterNotice, attach: attachSidebar };
  }

  window.ConnectifySidebarShell = { build };
})();

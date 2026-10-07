/**
 * Connectify Dark Theme Engine
 *
 * Provides instant, flicker-free site-wide dark mode styling for Connect,
 * dynamic theme switching, and comprehensive surface adaptations.
 */
(() => {
  'use strict';

  if (window.ConnectifyThemeLoaded) return;
  window.ConnectifyThemeLoaded = true;

  const STORAGE_KEY = 'connectea:theme:v1';
  const RESTORE_KEY = 'connectea:theme:restore_dark';
  const RESTORE_THEME_KEY = 'connectea:theme:restore_theme';
  const STORAGE_THEME_ID = 'connectea:theme:id';
  let isDarkMode = false;
  let activeTheme = 'dark';
  let toggleButton = null;
  let themeMenu = null;
  const closeThemeMenu = () => { if (themeMenu) { themeMenu.remove(); themeMenu = null; } };

  const isLoginUrl = (url = (typeof window !== 'undefined' ? window.location?.href : '')) => {
    try {
      const loc = new URL(url);
      const isConnect = loc.hostname === 'connect.det.wa.edu.au';
      const isLoginHost = loc.hostname === 'login.det.wa.edu.au';
      const isLoginPath = loc.pathname === '/login' ||
        loc.pathname.startsWith('/login/') ||
        loc.pathname.includes('/portal/login');
      return (isConnect && isLoginPath) || isLoginHost;
    } catch {
      return typeof url === 'string' && (
        url === 'https://connect.det.wa.edu.au/login' ||
        url.startsWith('https://connect.det.wa.edu.au/login') ||
        url.includes('login.det.wa.edu.au')
      );
    }
  };

  const isLogoutUrl = (url = (typeof window !== 'undefined' ? window.location?.href : '')) => {
    try {
      const loc = new URL(url, typeof window !== 'undefined' && window.location?.href ? window.location.href : 'https://connect.det.wa.edu.au');
      const isConnect = loc.hostname === 'connect.det.wa.edu.au';
      const path = loc.pathname.toLowerCase(), search = loc.search.toLowerCase();
      const isPath = path === '/logout' || path.startsWith('/logout/') || path.includes('/portal/logout') || path.includes('/c/portal/logout') || path.includes('/web/guest/logout') || path.includes('/signout') || path.includes('/sign-out') || path.includes('loggedout') || path.includes('logged-out');
      const isParam = search.includes('logout') || search.includes('logged_out') || search.includes('signed_out') || search.includes('session_expired');
      if ((isConnect && (isPath || isParam)) || loc.hostname === 'logout.det.wa.edu.au' || isPath) return true;
      if (typeof document !== 'undefined' && (!url || (typeof window !== 'undefined' && url === window.location?.href))) {
        if (/logged out|signed out/i.test(document.title || '')) return true;
        const msg = document.querySelector('.portlet-msg-info, .alert-info, .login-status, .cvr-c-status-message');
        if (msg && /logged out|signed out|session.*expired/i.test(msg.textContent || '')) return true;
      }
      return false;
    } catch { return typeof url === 'string' && /logout|signout|sign-out|loggedout/i.test(url); }
  };

  const isAuthDisabled = (url) => isLoginUrl(url) || isLogoutUrl(url);

  function updateDomThemeAttributes(dark, themeId, isAuth) {
    const isLogout = isLogoutUrl();
    if (isAuth || isLogout) {
      document.documentElement.classList.remove('connectea-dark');
      delete document.documentElement.dataset.connecteaTheme;
      document.documentElement.removeAttribute('data-connectea-theme');
      document.documentElement.setAttribute('data-connectea-login', 'true');
      if (isLogout) document.documentElement.setAttribute('data-connectea-logout', 'true');
      else document.documentElement.removeAttribute('data-connectea-logout');
      if (document.body) {
        document.body.classList.remove('connectea-dark');
        delete document.body.dataset.connecteaTheme;
        document.body.removeAttribute('data-connectea-theme');
      }
      if (window.ConnectifyThemeRegistry?.clearCustomTokens) window.ConnectifyThemeRegistry.clearCustomTokens();
      if (toggleButton?.parentElement) toggleButton.remove();
      if (themeMenu) closeThemeMenu();
    } else {
      document.documentElement.removeAttribute('data-connectea-login');
      document.documentElement.removeAttribute('data-connectea-logout');
      document.documentElement.classList.toggle('connectea-dark', dark);
      if (document.body) document.body.classList.toggle('connectea-dark', dark);
      const cur = themeId || (window.ConnectifyThemeRegistry ? window.ConnectifyThemeRegistry.getTheme() : (dark ? 'dark' : 'light'));
      if (dark) document.documentElement.dataset.connecteaTheme = cur;
      else { delete document.documentElement.dataset.connecteaTheme; document.documentElement.removeAttribute('data-connectea-theme'); }
    }
  }

  try {
    if (isAuthDisabled()) {
      const isDarkActive = localStorage.getItem(STORAGE_KEY) === 'dark' || localStorage.getItem(RESTORE_KEY) === 'true';
      if (isDarkActive) {
        localStorage.setItem(RESTORE_KEY, 'true');
        const currentTheme = localStorage.getItem(STORAGE_THEME_ID);
        if (currentTheme && currentTheme !== 'light') localStorage.setItem(RESTORE_THEME_KEY, currentTheme);
      }
      localStorage.setItem(STORAGE_KEY, 'light');
      localStorage.setItem(STORAGE_THEME_ID, 'light');
      isDarkMode = false;
      activeTheme = 'light';
    } else if (localStorage.getItem(RESTORE_KEY) === 'true') {
      activeTheme = localStorage.getItem(RESTORE_THEME_KEY) || 'dark';
      localStorage.removeItem(RESTORE_KEY);
      localStorage.removeItem(RESTORE_THEME_KEY);
      localStorage.setItem(STORAGE_KEY, 'dark');
      localStorage.setItem(STORAGE_THEME_ID, activeTheme);
      isDarkMode = true;
    } else {
      isDarkMode = localStorage.getItem(STORAGE_KEY) === 'dark';
      activeTheme = isDarkMode ? (localStorage.getItem(STORAGE_THEME_ID) || 'dark') : 'light';
    }
  } catch {}

  toggleButton = document.getElementById('connectea-theme-toggle');
  if (!toggleButton) {
    toggleButton = document.createElement('button');
    toggleButton.id = 'connectea-theme-toggle';
    toggleButton.type = 'button';
  }
  toggleButton.className = 'connectea-theme-toggle';

  updateDomThemeAttributes(isDarkMode, activeTheme, isAuthDisabled());

  function cleanupDuplicateButtons() {
    for (const btn of document.querySelectorAll('#connectea-theme-toggle, .connectea-theme-toggle')) if (btn !== toggleButton) btn.remove();
    for (const btn of document.querySelectorAll('#connectea-theme-select-btn, .connectea-theme-select-btn')) btn.remove();
    const containers = [document.querySelector('.cvr-c-primary-navigation'), document.body].filter(Boolean);
    for (const container of containers) {
      for (const btn of container.querySelectorAll('button:not(#connectea-theme-toggle):not(.cx-calculator-tool):not(.cx-back-menu):not(.cx-close-btn)')) {
        if (btn.closest('#connectify-sidebar')) continue;
        const text = (btn.textContent || '').trim().toLowerCase();
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (text.includes('dark mode') || text.includes('light mode') || aria.includes('dark mode') || aria.includes('light mode')) btn.remove();
      }
    }
  }

  function updateToggleButtonLabel(dark) {
    if (!toggleButton) return;
    const label = dark ? 'Default' : 'Themes';
    const iconChar = dark ? '☀' : '🎨';
    toggleButton.textContent = `${iconChar} ${label}`;
    toggleButton.setAttribute('aria-label', label);
    toggleButton.setAttribute('aria-pressed', String(dark));
    const arrow = document.createElement('span');
    arrow.className = 'connectea-theme-arrow';
    arrow.setAttribute('title', 'Theme options');
    arrow.setAttribute('aria-label', 'Open theme menu');
    arrow.textContent = ' ▾';
    arrow.onclick = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      if (themeMenu) closeThemeMenu(); else openThemeMenu(toggleButton);
    };
    toggleButton.appendChild(arrow);
  }

  cleanupDuplicateButtons();
  updateToggleButtonLabel(isDarkMode);

  let headerRightInset = null;

  function updateTogglePosition(forceReset = false) {
    cleanupDuplicateButtons();
    if (isAuthDisabled()) {
      if (toggleButton.parentElement) toggleButton.remove();
      if (themeMenu) closeThemeMenu();
      return;
    }
    if (forceReset) headerRightInset = null;
    const nav = document.querySelector('.cvr-c-primary-navigation');
    if (!nav) {
      if (toggleButton.parentElement) toggleButton.remove();
      return;
    }
    if (toggleButton.parentElement !== nav) nav.append(toggleButton);

    const bell = nav.querySelector(':is(.cvr-c-icon--notification-hollow, .cvr-c-icon--notification, .cvr-c-icon--notification-solid, [class*="notification"])')?.closest('[role="button"], button') || nav.querySelector('[aria-label*="notification" i], [data-automation-id="notifications"]');
    const bellRect = bell?.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    let computedInset = null;
    if (bellRect?.width && bellRect.left > 60 && navRect.right >= bellRect.left) {
      computedInset = Math.max(8, navRect.right - bellRect.left + 12);
    } else {
      const avatar = nav.querySelector('.cvr-c-primary-navigation__button--avatar, [class*="avatar"]')?.closest('[role="button"], button');
      const avatarRect = avatar?.getBoundingClientRect();
      if (avatarRect?.width && avatarRect.left > 60 && navRect.right >= avatarRect.left) {
        computedInset = Math.max(8, navRect.right - avatarRect.left + 140);
      }
    }
    if (computedInset !== null) headerRightInset = computedInset;
    const baseInset = headerRightInset ?? 90;
    toggleButton.style.right = `${baseInset}px`;
  }

  function parseRgb(value, allowTranslucent = false) {
    if (!value) return null;
    const match = value.match(/^rgba?\(([^)]+)\)/);
    if (!match) return null;
    const parts = match[1].split(',').map(Number);
    return (parts.length === 4 && (parts[3] === 0 || (!allowTranslucent && parts[3] < 0.9))) ? null : parts.slice(0, 3);
  }
  const isNeutralColor = rgb => rgb && Math.max(...rgb) - Math.min(...rgb) < 24;
  function isDarkColor(rgb) {
    if (!rgb) return false;
    const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
    const isConnectRed = Math.abs(rgb[0] - 127) < 15 && Math.abs(rgb[1] - 55) < 15 && Math.abs(rgb[2] - 92) < 15;
    return lum < 135 || (isNeutralColor(rgb) && Math.max(...rgb) < 140) || isConnectRed;
  }

  function adaptSurfaces() {
    if (!isDarkMode || isAuthDisabled()) return;
    try {
      const surfaceCandidates = document.body.querySelectorAll(
        ':is(header, nav, aside, .v-panel, .v-panel-content, .eds-c-card, .cvr-c-promo, .cvr-c-heading-bar, .cvr-c-page-header, .cvr-c-report-years, .cvr-c-year-selector, .eds-c-tile__action, .eds-c-standard-button, mat-toolbar, mat-tab-header, .mat-toolbar, .mat-tab-header, .eds-c-nav-list, .eds-c-nav-list__item, .portlet, .portlet-content, .portlet-body, .journal-content-article, .eds-c-tile__body, .cvr-c-tile__body, [class*="help"], [class*="guide"], [class*="resource"]):not([data-connectea-surface]):not(.cvr-c-primary-navigation):not(.cvr-c-primary-navigation *):not(.cvr-c-header):not(.cvr-c-header *):not(#connectify-sidebar *):not(#connectea-theme-toggle):not(.connectea-panel *):not(.cvr-c-task__chart *):not(.highcharts-container *):not(#cx-expand-progress):not(#cx-expand-progress *)'
      );
      for (const el of surfaceCandidates) {
        if (['SCRIPT', 'STYLE', 'LINK', 'CANVAS', 'VIDEO', 'IFRAME', 'SVG'].includes(el.tagName)) continue;
        if (el.closest('.cvr-c-task__chart, .highcharts-container, #cx-expand-progress, .cvr-c-primary-navigation, .cvr-c-header, .cvr-c-classes__sort, .cvr-c-sort-by, .eds-c-sort-by')) continue;
        const bgRgb = parseRgb(window.getComputedStyle(el).backgroundColor);
        if (isNeutralColor(bgRgb) && Math.min(...bgRgb) > 165) el.setAttribute('data-connectea-surface', '');
      }
      const inkCandidates = document.querySelectorAll(
        '[data-connectea-surface] :is(p, span, div, h1, h2, h3, h4, h5, h6, label, strong, a, button, li, i):not([data-connectea-ink]):not(.cvr-c-primary-navigation *):not(.cvr-c-header *):not(#connectify-sidebar *):not(#connectea-theme-toggle):not(.connectea-panel *):not(.cvr-c-task__chart *):not(.highcharts-container *):not(#cx-expand-progress):not(#cx-expand-progress *)'
      );
      for (const el of inkCandidates) {
        if (el.children.length > 2 || el.hasAttribute('data-connectea-surface')) continue;
        if (el.closest('.cvr-c-task__chart, .highcharts-container, #cx-expand-progress, .cvr-c-primary-navigation, .cvr-c-header, .cvr-c-classes__sort, .cvr-c-sort-by, .eds-c-sort-by')) continue;
        const fgRgb = parseRgb(window.getComputedStyle(el).color, true);
        if (isDarkColor(fgRgb)) el.setAttribute('data-connectea-ink', '');
      }
    } catch (e) {}
  }

  function openThemeMenu(anchorEl) {
    closeThemeMenu();
    if (isAuthDisabled()) return;
    themeMenu = document.createElement('div');
    themeMenu.id = 'connectea-theme-menu';
    themeMenu.setAttribute('role', 'menu');

    const reg = window.ConnectifyThemeRegistry;
    const defaultList = [
      { id: 'dark', name: 'Dark', icon: '🌙', swatch: ['#12171f', '#1e2632', '#3b82f6'] },
      { id: 'quantum', name: 'Quantum Dark', icon: '⚛️', swatch: ['#282828', '#32302f', '#fabd2f'] },
      { id: 'amoled', name: 'AMOLED Black', icon: '🌑', swatch: ['#000000', '#0a0a0a', '#38bdf8'] },
      { id: 'midnight', name: 'Midnight Navy', icon: '🌌', swatch: ['#0b132b', '#141f36', '#60a5fa'] },
      { id: 'forest', name: 'Emerald Forest', icon: '🌲', swatch: ['#0a1914', '#11261f', '#10b981'] },
      { id: 'sunset', name: 'Twilight Plum', icon: '🌅', swatch: ['#19111c', '#26182a', '#f43f5e'] }
    ];
    const available = reg ? reg.getAvailableThemes() : defaultList;
    const themes = available.filter(t => t.id !== 'light' && t.id !== 'custom');
    const activeId = reg ? reg.getTheme() : (localStorage.getItem(STORAGE_THEME_ID) || 'dark');

    for (const t of themes) {
      const opt = document.createElement('button');
      opt.type = 'button';
      opt.className = `connectea-theme-option${t.id === activeId ? ' eds-s-is-active' : ''}`;
      opt.setAttribute('role', 'menuitem');
      opt.setAttribute('aria-selected', String(t.id === activeId));
      const swatch = document.createElement('span');
      swatch.className = 'connectea-theme-swatch';
      swatch.style.backgroundColor = (t.swatch && t.swatch[1]) || '#1e2632';
      const icon = document.createElement('span');
      icon.className = 'connectea-theme-icon';
      icon.textContent = t.icon;
      const name = document.createElement('span');
      name.className = 'connectea-theme-name';
      name.textContent = t.name;
      opt.append(swatch, icon, name);
      opt.onclick = (e) => {
        e.stopPropagation();
        if (reg) reg.setTheme(t.id);
        applyTheme(true, t.id);
        closeThemeMenu();
      };
      themeMenu.appendChild(opt);
    }

    const target = anchorEl || toggleButton;
    const rect = target.getBoundingClientRect();
    themeMenu.style.position = 'fixed';
    themeMenu.style.top = `${Math.round(rect.bottom + 6)}px`;
    themeMenu.style.right = `${Math.max(8, Math.round(window.innerWidth - rect.right))}px`;
    document.body.appendChild(themeMenu);
  }

  function applyTheme(isDark, themeId) {
    if (isAuthDisabled()) {
      if (isDark || isDarkMode) {
        try {
          localStorage.setItem(RESTORE_KEY, 'true');
          const cur = themeId || (window.ConnectifyThemeRegistry ? window.ConnectifyThemeRegistry.getTheme() : null);
          if (cur && cur !== 'light') localStorage.setItem(RESTORE_THEME_KEY, cur);
        } catch {}
      }
      isDark = false;
      try { localStorage.setItem(STORAGE_KEY, 'light'); localStorage.setItem(STORAGE_THEME_ID, 'light'); } catch {}
    } else {
      try {
        if (localStorage.getItem(RESTORE_KEY) === 'true') {
          const restored = localStorage.getItem(RESTORE_THEME_KEY) || 'dark';
          localStorage.removeItem(RESTORE_KEY);
          localStorage.removeItem(RESTORE_THEME_KEY);
          isDark = true;
          themeId = restored;
          localStorage.setItem(STORAGE_KEY, 'dark');
          localStorage.setItem(STORAGE_THEME_ID, restored);
          if (window.ConnectifyThemeRegistry) window.ConnectifyThemeRegistry.setTheme(restored);
        }
      } catch {}
    }
    isDarkMode = isDark;
    updateDomThemeAttributes(isDarkMode, themeId, isAuthDisabled());
    updateToggleButtonLabel(isDarkMode);
    updateTogglePosition();
    if (isDarkMode) scheduleAdaptSurfaces();
  }

  let lastToggleTime = 0;
  toggleButton.onclick = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (e?.target?.closest?.('.connectea-theme-arrow')) {
      if (themeMenu) closeThemeMenu(); else openThemeMenu(toggleButton);
      return;
    }
    const now = Date.now();
    if (now - lastToggleTime < 300) return;
    lastToggleTime = now;
    if (isAuthDisabled()) { applyTheme(false); return; }
    try { localStorage.removeItem(RESTORE_KEY); } catch {}
    const isCurrentlyDark = document.documentElement.classList.contains('connectea-dark');
    const nextDark = !isCurrentlyDark;
    try { localStorage.setItem(STORAGE_KEY, nextDark ? 'dark' : 'light'); } catch {}
    if (typeof window.ConnectifyThemeRegistry !== 'undefined') {
      const savedTheme = localStorage.getItem(STORAGE_THEME_ID);
      const activeThemeId = (savedTheme && savedTheme !== 'light' && savedTheme !== 'custom') ? savedTheme : 'dark';
      window.ConnectifyThemeRegistry.setTheme(nextDark ? activeThemeId : 'light');
    }
    applyTheme(nextDark);
  };

  toggleButton.oncontextmenu = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (themeMenu) closeThemeMenu(); else openThemeMenu(toggleButton);
  };

  document.addEventListener('click', (e) => {
    if (themeMenu && !themeMenu.contains(e.target) && !toggleButton.contains(e.target)) {
      closeThemeMenu();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && themeMenu) closeThemeMenu();
  });

  let adaptTimer = null;
  const pageStartTime = Date.now();
  function scheduleAdaptSurfaces(delay) {
    if (window.ConnectifyIsAccordionAnimating || window.ConnectifyIsBulkExpanding) return;
    clearTimeout(adaptTimer);
    const effectiveDelay = delay ?? (Date.now() - pageStartTime < 2500 ? 1200 : 400);
    adaptTimer = setTimeout(() => {
      if (window.ConnectifyIsAccordionAnimating || window.ConnectifyIsBulkExpanding) return;
      if (isDarkMode && !isAuthDisabled()) adaptSurfaces();
    }, effectiveDelay);
  }

  let syncScheduled = false;
  const debouncedSync = () => {
    if (syncScheduled) return;
    syncScheduled = true;
    requestAnimationFrame(() => {
      syncScheduled = false;
      if (isAuthDisabled()) {
        if (isDarkMode || document.documentElement.classList.contains('connectea-dark')) {
          try {
            localStorage.setItem(RESTORE_KEY, 'true');
            const cur = localStorage.getItem(STORAGE_THEME_ID);
            if (cur && cur !== 'light') localStorage.setItem(RESTORE_THEME_KEY, cur);
          } catch {}
          applyTheme(false);
        }
        updateDomThemeAttributes(false, 'light', true);
        return;
      }
      try {
        if (localStorage.getItem(RESTORE_KEY) === 'true') {
          const restored = localStorage.getItem(RESTORE_THEME_KEY) || 'dark';
          localStorage.removeItem(RESTORE_KEY);
          localStorage.removeItem(RESTORE_THEME_KEY);
          localStorage.setItem(STORAGE_KEY, 'dark');
          localStorage.setItem(STORAGE_THEME_ID, restored);
          applyTheme(true, restored);
          return;
        }
      } catch {}
      cleanupDuplicateButtons();
      const nav = document.querySelector('.cvr-c-primary-navigation');
      updateTogglePosition(!nav || toggleButton.parentElement !== nav || !toggleButton.isConnected);
      if (isDarkMode) scheduleAdaptSurfaces();
    });
  };

  new MutationObserver(records => {
    if (window.ConnectifyIsAccordionAnimating || window.ConnectifyIsBulkExpanding) return;
    const shouldUpdate = records.some(r => {
      if (r.target === toggleButton || r.target.parentElement?.closest('#connectea-theme-toggle') || r.target.closest?.('#connectify-sidebar')) return false;
      if (r.type === 'attributes' && (r.attributeName === 'data-connectea-surface' || r.attributeName === 'data-connectea-ink')) return false;
      if (r.target?.closest?.('.eds-c-accordion, .eds-c-accordion__panel, .cvr-c-task, .cvr-c-tasks, .connectea-panel')) return false;
      return true;
    });
    if (shouldUpdate) debouncedSync();
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  window.addEventListener('resize', () => updateTogglePosition(true));
  window.addEventListener('storage', e => {
    if (e.key === STORAGE_KEY && e.newValue) applyTheme(!isAuthDisabled() && e.newValue === 'dark');
  });

  updateTogglePosition();
  if (isDarkMode) scheduleAdaptSurfaces(600);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      try {
        if (isAuthDisabled()) {
          const isDark = isDarkMode || localStorage.getItem(STORAGE_KEY) === 'dark' || localStorage.getItem(RESTORE_KEY) === 'true';
          if (isDark) {
            localStorage.setItem(RESTORE_KEY, 'true');
            const cur = localStorage.getItem(STORAGE_THEME_ID);
            if (cur && cur !== 'light') localStorage.setItem(RESTORE_THEME_KEY, cur);
          }
          localStorage.setItem(STORAGE_KEY, 'light');
          localStorage.setItem(STORAGE_THEME_ID, 'light');
          isDarkMode = false;
        } else if (localStorage.getItem(RESTORE_KEY) === 'true') {
          const restored = localStorage.getItem(RESTORE_THEME_KEY) || 'dark';
          localStorage.removeItem(RESTORE_KEY);
          localStorage.removeItem(RESTORE_THEME_KEY);
          localStorage.setItem(STORAGE_KEY, 'dark');
          localStorage.setItem(STORAGE_THEME_ID, restored);
          isDarkMode = true;
          activeTheme = restored;
        }
      } catch {}
      if (isAuthDisabled()) {
        updateDomThemeAttributes(false, 'light', true);
      } else {
        if (document.body) document.body.classList.toggle('connectea-dark', isDarkMode);
        updateTogglePosition(true);
        if (isDarkMode) scheduleAdaptSurfaces(800);
      }
    });
  }

  let mountPollCount = 0;
  const mountPollInterval = setInterval(() => {
    mountPollCount++;
    if (isAuthDisabled()) {
      updateDomThemeAttributes(false, 'light', true);
      clearInterval(mountPollInterval);
      return;
    }
    try {
      if (localStorage.getItem(RESTORE_KEY) === 'true') {
        const restored = localStorage.getItem(RESTORE_THEME_KEY) || 'dark';
        localStorage.removeItem(RESTORE_KEY);
        localStorage.removeItem(RESTORE_THEME_KEY);
        localStorage.setItem(STORAGE_KEY, 'dark');
        localStorage.setItem(STORAGE_THEME_ID, restored);
        applyTheme(true, restored);
      }
    } catch {}
    const nav = document.querySelector('.cvr-c-primary-navigation');
    if (nav && toggleButton.parentElement !== nav) updateTogglePosition(true);
    if (mountPollCount >= 30 || (nav && toggleButton.parentElement === nav)) clearInterval(mountPollInterval);
  }, 100);

  window.ConnectifyTheme = {
    isLoginUrl,
    isLogoutUrl,
    isLoginOrLogoutUrl: isAuthDisabled,
    isAuthDisabled,
    isDarkMode: () => (isAuthDisabled() ? false : (window.ConnectifyThemeRegistry ? window.ConnectifyThemeRegistry.isDarkMode() : isDarkMode)),
    applyTheme,
    getTheme: () => (isAuthDisabled() ? 'light' : (window.ConnectifyThemeRegistry ? window.ConnectifyThemeRegistry.getTheme() : (isDarkMode ? 'dark' : 'light'))),
    setTheme: (id, colors) => {
      if (isAuthDisabled()) return false;
      const res = window.ConnectifyThemeRegistry ? window.ConnectifyThemeRegistry.setTheme(id, colors) : true;
      applyTheme(id !== 'light', id);
      return res;
    },
    getAvailableThemes: () => (window.ConnectifyThemeRegistry ? window.ConnectifyThemeRegistry.getAvailableThemes().filter(t => t.id !== 'light' && t.id !== 'custom') : [{ id: 'dark', name: 'Dark', icon: '☾' }]),
    registerTheme: def => (window.ConnectifyThemeRegistry ? window.ConnectifyThemeRegistry.registerTheme(def) : false),
    getCustomColors: () => (window.ConnectifyThemeRegistry ? window.ConnectifyThemeRegistry.getCustomColors() : null),
    setCustomColors: c => (window.ConnectifyThemeRegistry ? window.ConnectifyThemeRegistry.setCustomColors(c) : false)
  };
})();

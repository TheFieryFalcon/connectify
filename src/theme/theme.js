/**
 * Connectify Theme Engine
 *
 * Applies the active theme to the page, restores it after login, keeps the navbar toggle mounted
 * and re-adapts unstyled surfaces as Connect re-renders. Depends on theme-auth.js,
 * theme-registry.js, theme-surface-adapter.js, theme-toggle.js and theme-menu.js.
 * Exposes window.ConnectifyTheme.
 */
(() => {
  'use strict';

  if (window.ConnectifyThemeLoaded) return;
  window.ConnectifyThemeLoaded = true;

  const STORAGE_KEY = 'connectea:theme:v1';
  const RESTORE_KEY = 'connectea:theme:restore_dark';
  const STORAGE_THEME_ID = 'connectea:theme:id';

  const { isLoginUrl, isLogoutUrl, isAuthDisabled, markAuthPage, rememberThemeForLogin, takeThemeToRestore } = window.ConnectifyThemeAuth;
  const registry = window.ConnectifyThemeRegistry;
  const toggle = window.ConnectifyThemeToggle;
  const menu = window.ConnectifyThemeMenu;
  const surfaceAdapter = window.ConnectifyThemeSurfaceAdapter;
  const toggleButton = toggle.button;

  let isDarkMode = false;
  let activeTheme = 'dark';

  function updateDomThemeAttributes(dark, themeId, isAuth) {
    if (isAuth || isLogoutUrl()) {
      markAuthPage();
      registry.clearCustomTokens();
      toggle.remove();
      menu.close();
      return;
    }
    const root = document.documentElement;
    root.removeAttribute('data-connectea-login');
    root.removeAttribute('data-connectea-logout');
    const cur = themeId || registry.getTheme();
    for (const el of [root, document.body].filter(Boolean)) {
      el.classList.toggle('connectea-dark', dark);
      if (dark) el.dataset.connecteaTheme = cur;
      else { delete el.dataset.connecteaTheme; el.removeAttribute('data-connectea-theme'); }
    }
  }

  try {
    const restored = isAuthDisabled() ? null : takeThemeToRestore();
    if (isAuthDisabled()) {
      if (localStorage.getItem(STORAGE_KEY) === 'dark' || localStorage.getItem(RESTORE_KEY) === 'true') rememberThemeForLogin();
      localStorage.setItem(STORAGE_KEY, 'light'); localStorage.setItem(STORAGE_THEME_ID, 'light');
      isDarkMode = false; activeTheme = 'light';
    } else if (restored) {
      isDarkMode = true; activeTheme = restored;
    } else {
      isDarkMode = localStorage.getItem(STORAGE_KEY) === 'dark';
      activeTheme = isDarkMode ? (localStorage.getItem(STORAGE_THEME_ID) || 'dark') : 'light';
    }
  } catch {}

  updateDomThemeAttributes(isDarkMode, activeTheme, isAuthDisabled());
  if (isDarkMode) registry.setTheme(activeTheme);
  // The theme stylesheets are in and the theme is applied: theme-boot.js's canvas is no longer needed
  window.ConnectifyThemeBoot?.done();
  window.ConnectifyThemeBoot?.save();

  const updateToggleButtonLabel = dark => toggle.setLabel(dark, () => menu.toggle(toggleButton));

  function updateTogglePosition(forceReset = false) {
    if (isAuthDisabled()) {
      toggle.cleanupDuplicateButtons();
      toggle.remove();
      menu.close();
      return;
    }
    toggle.position(forceReset);
  }

  toggle.cleanupDuplicateButtons();
  updateToggleButtonLabel(isDarkMode);

  function checkReadingView() {
    if (typeof document === 'undefined' || !document.documentElement) return;
    const isReading = Boolean(document.querySelector('cnt-notice-view, [class*="notice-view"], cnt-discussion-view, cnt-discussion-item-view, [class*="discussion-view"], cnt-notice-item-view-dialog'));
    if (isReading) document.documentElement.setAttribute('data-connectea-reading-view', 'true');
    else document.documentElement.removeAttribute('data-connectea-reading-view');
  }

  let adaptTimer = null;
  const pageStartTime = Date.now();
  function scheduleAdaptSurfaces(delay) {
    if (window.ConnectifyIsAccordionAnimating || window.ConnectifyIsBulkExpanding) return;
    clearTimeout(adaptTimer);
    const effectiveDelay = delay ?? (Date.now() - pageStartTime < 2500 ? 1200 : 400);
    adaptTimer = setTimeout(() => {
      if (window.ConnectifyIsAccordionAnimating || window.ConnectifyIsBulkExpanding) return;
      if (isDarkMode && !isAuthDisabled()) surfaceAdapter.adaptSurfaces();
    }, effectiveDelay);
  }

  function applyTheme(isDark, themeId) {
    if (isAuthDisabled()) {
      if (isDark || isDarkMode) rememberThemeForLogin(themeId);
      isDark = false;
      try { localStorage.setItem(STORAGE_KEY, 'light'); localStorage.setItem(STORAGE_THEME_ID, 'light'); } catch {}
    } else {
      const restored = takeThemeToRestore();
      if (restored) {
        isDark = true;
        themeId = restored;
        registry.setTheme(restored);
      }
    }
    isDarkMode = isDark;
    updateDomThemeAttributes(isDarkMode, themeId, isAuthDisabled());
    updateToggleButtonLabel(isDarkMode);
    updateTogglePosition();
    checkReadingView();
    if (isDarkMode) scheduleAdaptSurfaces();
  }

  // Clicking the button switches between Default and the last dark theme; the chevron opens the menu.
  // registry.setTheme() fires connectea:themechange, whose listener below applies the theme.
  let lastToggleTime = 0;
  toggleButton.onclick = e => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (e?.target?.closest?.('.connectea-theme-arrow')) {
      menu.toggle(toggleButton);
      return;
    }
    const now = Date.now();
    if (now - lastToggleTime < 300) return;
    lastToggleTime = now;
    if (isAuthDisabled()) { applyTheme(false); return; }
    try { localStorage.removeItem(RESTORE_KEY); } catch {}
    const nextDark = !document.documentElement.classList.contains('connectea-dark');
    try { localStorage.setItem(STORAGE_KEY, nextDark ? 'dark' : 'light'); } catch {}
    registry.setTheme(nextDark ? registry.getLastTheme() : 'light');
  };

  toggleButton.oncontextmenu = e => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    menu.toggle(toggleButton);
  };

  let syncScheduled = false;
  const debouncedSync = () => {
    if (syncScheduled) return;
    syncScheduled = true;
    requestAnimationFrame(() => {
      syncScheduled = false;
      if (isAuthDisabled()) {
        if (isDarkMode || document.documentElement.classList.contains('connectea-dark')) {
          rememberThemeForLogin();
          applyTheme(false);
        }
        updateDomThemeAttributes(false, 'light', true);
        return;
      }
      const restored = takeThemeToRestore();
      if (restored) { applyTheme(true, restored); return; }
      checkReadingView();
      toggle.cleanupDuplicateButtons();
      const nav = document.querySelector('.cvr-c-primary-navigation');
      updateTogglePosition(!nav || toggleButton.parentElement !== nav || !toggleButton.isConnected);
      if (isDarkMode) scheduleAdaptSurfaces();
    });
  };

  // Page changes through the shared scheduler (muted during accordion animations): added or removed
  // nodes and class changes outside the toggle, the sidebar, accordions and task rows
  window.ConnectifyScheduler.onMutations(debouncedSync, {
    mute: true,
    filter: r => {
      if (r.type === 'characterData' || (r.type === 'attributes' && r.attributeName !== 'class')) return false;
      if (r.target === toggleButton || r.target.parentElement?.closest('#connectea-theme-toggle') || r.target.closest?.('#connectify-sidebar')) return false;
      return !r.target?.closest?.('.eds-c-accordion, .eds-c-accordion__panel, .cvr-c-task, .cvr-c-tasks, .connectea-panel');
    }
  });

  window.addEventListener('resize', () => updateTogglePosition(true));
  window.addEventListener('storage', e => { if (e.key === STORAGE_KEY && e.newValue) applyTheme(!isAuthDisabled() && e.newValue === 'dark'); });
  window.addEventListener('connectea:themechange', e => {
    if (isAuthDisabled()) return;
    const tId = e.detail?.themeId || 'dark';
    const isDark = e.detail?.theme ? e.detail.theme.isDark : (tId !== 'light');
    activeTheme = tId;
    applyTheme(isDark, tId);
  });

  updateTogglePosition();
  if (isDarkMode) scheduleAdaptSurfaces(600);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      try {
        if (isAuthDisabled()) {
          if (isDarkMode || localStorage.getItem(STORAGE_KEY) === 'dark' || localStorage.getItem(RESTORE_KEY) === 'true') rememberThemeForLogin();
          localStorage.setItem(STORAGE_KEY, 'light'); localStorage.setItem(STORAGE_THEME_ID, 'light');
          isDarkMode = false;
        } else {
          const restored = takeThemeToRestore();
          if (restored) { isDarkMode = true; activeTheme = restored; }
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

  // Connect mounts its navbar late; poll briefly until the toggle is in place
  let mountPollCount = 0;
  const mountPollInterval = setInterval(() => {
    mountPollCount++;
    if (isAuthDisabled()) {
      updateDomThemeAttributes(false, 'light', true);
      clearInterval(mountPollInterval);
      return;
    }
    const restored = takeThemeToRestore();
    if (restored) applyTheme(true, restored);
    const nav = document.querySelector('.cvr-c-primary-navigation');
    if (nav && toggleButton.parentElement !== nav) updateTogglePosition(true);
    if (mountPollCount >= 30 || (nav && toggleButton.parentElement === nav)) clearInterval(mountPollInterval);
  }, 100);

  window.ConnectifyTheme = {
    isLoginUrl, isLogoutUrl, isLoginOrLogoutUrl: isAuthDisabled, isAuthDisabled, applyTheme,
    isDarkMode: () => (isAuthDisabled() ? false : registry.isDarkMode()),
    getTheme: () => (isAuthDisabled() ? 'light' : registry.getTheme()),
    getLastTheme: () => registry.getLastTheme(),
    setTheme: (id, colors) => (isAuthDisabled() ? false : registry.setTheme(id, colors)),
    getAvailableThemes: () => registry.getAvailableThemes().filter(t => t.id !== 'light' && t.id !== 'custom'),
    registerTheme: def => registry.registerTheme(def),
    getCustomColors: () => registry.getCustomColors(),
    setCustomColors: c => registry.setCustomColors(c),
    getCustomBackground: () => registry.getCustomBackground(),
    setCustomBackground: url => registry.setCustomBackground(url),
    clearCustomBackground: () => registry.clearCustomBackground(),
    setGlassDiffusion: en => registry.setGlassDiffusion(en)
  };
})();

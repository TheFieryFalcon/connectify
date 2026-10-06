/**
 * Connectify Dark Theme Engine
 *
 * Provides instant, flicker-free site-wide dark mode styling for Connect
 * and accordion arrow enhancements.
 */
(() => {
  'use strict';

  if (window.ConnectifyThemeLoaded) return;
  window.ConnectifyThemeLoaded = true;

  const STORAGE_KEY = 'connectea:theme:v1';
  const RESTORE_KEY = 'connectea:theme:restore_dark';
  let isDarkMode = false;

  const isLoginUrl = (url = (typeof window !== 'undefined' ? window.location?.href : '')) => {
    try {
      const loc = new URL(url);
      return loc.hostname === 'connect.det.wa.edu.au' && (loc.pathname === '/login' || loc.pathname.startsWith('/login/'));
    } catch {
      return typeof url === 'string' && (url === 'https://connect.det.wa.edu.au/login' || url.startsWith('https://connect.det.wa.edu.au/login'));
    }
  };

  try {
    if (isLoginUrl()) {
      if (localStorage.getItem(STORAGE_KEY) === 'dark' || localStorage.getItem(RESTORE_KEY) === 'true') {
        localStorage.setItem(RESTORE_KEY, 'true');
      }
      localStorage.setItem(STORAGE_KEY, 'light');
      isDarkMode = false;
    } else if (localStorage.getItem(RESTORE_KEY) === 'true') {
      localStorage.removeItem(RESTORE_KEY);
      localStorage.setItem(STORAGE_KEY, 'dark');
      isDarkMode = true;
    } else {
      isDarkMode = localStorage.getItem(STORAGE_KEY) === 'dark';
    }
  } catch {}

  // Apply dark mode class immediately to avoid any initial page flash
  document.documentElement.classList.toggle('connectea-dark', isDarkMode);
  if (document.body) document.body.classList.toggle('connectea-dark', isDarkMode);

  // Reuse existing button if already in DOM or create once
  let toggleButton = document.getElementById('connectea-theme-toggle');
  if (!toggleButton) {
    toggleButton = document.createElement('button');
    toggleButton.id = 'connectea-theme-toggle';
    toggleButton.type = 'button';
  }
  toggleButton.className = 'connectea-theme-toggle';

  function cleanupDuplicateButtons() {
    const existingButtons = document.querySelectorAll('#connectea-theme-toggle, .connectea-theme-toggle');
    for (const btn of existingButtons) {
      if (btn !== toggleButton) btn.remove();
    }

    const containers = [document.querySelector('.cvr-c-primary-navigation'), document.body].filter(Boolean);
    for (const container of containers) {
      const candidates = container.querySelectorAll('button:not(#connectea-theme-toggle):not(.cx-calculator-tool):not(.cx-back-menu):not(.cx-close-btn)');
      for (const btn of candidates) {
        if (btn.closest('#connectify-sidebar')) continue;
        const text = (btn.textContent || '').trim().toLowerCase();
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (text.includes('dark mode') || text.includes('light mode') || aria.includes('dark mode') || aria.includes('light mode')) {
          btn.remove();
        }
      }
    }
  }

  cleanupDuplicateButtons();

  toggleButton.setAttribute('aria-label', isDarkMode ? 'Light mode' : 'Dark mode');
  toggleButton.textContent = isDarkMode ? '☀ Light mode' : '☾ Dark mode';
  toggleButton.setAttribute('aria-pressed', String(isDarkMode));

  let headerRightInset = null;

  function updateTogglePosition(forceReset = false) {
    cleanupDuplicateButtons();
    if (isLoginUrl()) {
      if (toggleButton.parentElement) toggleButton.remove();
      return;
    }
    if (forceReset) headerRightInset = null;
    const nav = document.querySelector('.cvr-c-primary-navigation');
    if (!nav) {
      if (toggleButton.parentElement) toggleButton.remove();
      return;
    }

    if (toggleButton.parentElement !== nav) {
      nav.append(toggleButton);
    }

    // Find notification bell icon whether hollow, solid, or with notification dot/badge
    const bell = nav
      .querySelector(':is(.cvr-c-icon--notification-hollow, .cvr-c-icon--notification, .cvr-c-icon--notification-solid, [class*="notification"])')
      ?.closest('[role="button"], button') ||
      nav.querySelector('[aria-label*="notification" i], [data-automation-id="notifications"]');
    const bellRect = bell?.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();

    let computedInset = null;
    if (bellRect?.width && bellRect.left > 60 && navRect.right >= bellRect.left) {
      computedInset = Math.max(8, navRect.right - bellRect.left + 12);
    } else {
      // Fallback: position to the left of the avatar/user menu if bell is still loading
      const avatar = nav.querySelector('.cvr-c-primary-navigation__button--avatar, [class*="avatar"]')?.closest('[role="button"], button');
      const avatarRect = avatar?.getBoundingClientRect();
      if (avatarRect?.width && avatarRect.left > 60 && navRect.right >= avatarRect.left) {
        computedInset = Math.max(8, navRect.right - avatarRect.left + 140);
      }
    }

    if (computedInset !== null) headerRightInset = computedInset;
    toggleButton.style.right = `${headerRightInset ?? 90}px`;
  }

  function parseRgb(value, allowTranslucent = false) {
    if (!value) return null;
    const match = value.match(/^rgba?\(([^)]+)\)/);
    if (!match) return null;
    const parts = match[1].split(',').map(Number);
    return (parts.length === 4 && (parts[3] === 0 || (!allowTranslucent && parts[3] < 0.9))) ? null : parts.slice(0, 3);
  }

  function isNeutralColor(rgb) {
    return rgb && Math.max(...rgb) - Math.min(...rgb) < 24;
  }

  function isDarkColor(rgb) {
    if (!rgb) return false;
    const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
    const isConnectRed = Math.abs(rgb[0] - 127) < 15 && Math.abs(rgb[1] - 55) < 15 && Math.abs(rgb[2] - 92) < 15;
    return lum < 135 || (isNeutralColor(rgb) && Math.max(...rgb) < 140) || isConnectRed;
  }

  /**
   * Identifies unstyled bright neutral surfaces and dark text outside Assessment Outlines
   * and tags them with [data-connectea-surface] and [data-connectea-ink].
   * Does NOT touch el.style directly, ensuring zero flickering and zero MutationObserver feedback loops.
   */
  function adaptSurfaces() {
    if (!isDarkMode || isLoginUrl()) return;

    try {
      const surfaceCandidates = document.body.querySelectorAll(
        ':is(header, nav, aside, .v-panel, .v-panel-content, .eds-c-card, .cvr-c-promo, .cvr-c-heading-bar, .cvr-c-page-header, .cvr-c-report-years, .cvr-c-year-selector, .eds-c-tile__action, .eds-c-standard-button, mat-toolbar, mat-tab-header, .mat-toolbar, .mat-tab-header, .eds-c-nav-list, .eds-c-nav-list__item, .portlet-content, .portlet-body):not([data-connectea-surface]):not(.cvr-c-primary-navigation):not(.cvr-c-primary-navigation *):not(.cvr-c-header):not(.cvr-c-header *):not(#connectify-sidebar *):not(#connectea-theme-toggle):not(.connectea-panel *):not(.cvr-c-task__chart *):not(.highcharts-container *):not(#cx-expand-progress):not(#cx-expand-progress *)'
      );

      for (const el of surfaceCandidates) {
        if (['SCRIPT', 'STYLE', 'LINK', 'CANVAS', 'VIDEO', 'IFRAME', 'SVG'].includes(el.tagName)) continue;
        if (el.closest('.cvr-c-task__chart, .highcharts-container, #cx-expand-progress, .cvr-c-primary-navigation, .cvr-c-header')) continue;
        const style = window.getComputedStyle(el);
        const bgRgb = parseRgb(style.backgroundColor);
        if (isNeutralColor(bgRgb) && Math.min(...bgRgb) > 165) {
          el.setAttribute('data-connectea-surface', '');
        }
      }

      const inkCandidates = document.querySelectorAll(
        '[data-connectea-surface] :is(p, span, div, h1, h2, h3, h4, h5, h6, label, strong, a, button, li, i):not([data-connectea-ink]):not(.cvr-c-primary-navigation *):not(.cvr-c-header *):not(#connectify-sidebar *):not(#connectea-theme-toggle):not(.connectea-panel *):not(.cvr-c-task__chart *):not(.highcharts-container *):not(#cx-expand-progress):not(#cx-expand-progress *)'
      );
      for (const el of inkCandidates) {
        if (el.children.length > 2) continue;
        if (el.hasAttribute('data-connectea-surface')) continue;
        if (el.closest('.cvr-c-task__chart, .highcharts-container, #cx-expand-progress, .cvr-c-primary-navigation, .cvr-c-header')) continue;
        const style = window.getComputedStyle(el);
        const fgRgb = parseRgb(style.color, true);
        if (isDarkColor(fgRgb)) {
          el.setAttribute('data-connectea-ink', '');
        }
      }
    } catch (e) {}
  }

  let themeMenu = null;
  const closeThemeMenu = () => { if (themeMenu) { themeMenu.remove(); themeMenu = null; } };

  function openThemeMenu() {
    closeThemeMenu();
    if (isLoginUrl()) return;
    themeMenu = document.createElement('div');
    themeMenu.id = 'connectea-theme-menu';
    themeMenu.setAttribute('role', 'menu');

    const reg = window.ConnectifyThemeRegistry;
    const themes = reg ? reg.getAvailableThemes() : [
      { id: 'dark', name: 'Classic Dark', icon: '☾', swatch: ['#12171f', '#1e2632', '#3b82f6'] },
      { id: 'amoled', name: 'AMOLED Black', icon: '🌑', swatch: ['#000000', '#0a0a0a', '#38bdf8'] },
      { id: 'midnight', name: 'Midnight Navy', icon: '🌌', swatch: ['#0b132b', '#141f36', '#60a5fa'] },
      { id: 'forest', name: 'Emerald Forest', icon: '🌲', swatch: ['#0a1914', '#11261f', '#10b981'] },
      { id: 'sunset', name: 'Twilight Plum', icon: '🌅', swatch: ['#19111c', '#26182a', '#f43f5e'] },
      { id: 'light', name: 'Default Light', icon: '☀', swatch: ['#f8fafc', '#ffffff', '#3b82f6'] },
      { id: 'custom', name: 'Custom Theme', icon: '🎨', swatch: ['#111827', '#1f2937', '#6366f1'] }
    ];
    const activeId = reg ? reg.getTheme() : (isDarkMode ? 'dark' : 'light');

    for (const t of themes) {
      const opt = document.createElement('button');
      opt.type = 'button';
      opt.className = `connectea-theme-option${t.id === activeId ? ' eds-s-is-active' : ''}`;
      opt.setAttribute('role', 'menuitem');
      opt.setAttribute('aria-selected', String(t.id === activeId));
      const swatch = document.createElement('span');
      swatch.className = 'connectea-theme-swatch';
      swatch.style.backgroundColor = (t.swatch && t.swatch[1]) || '#1e2632';
      const label = document.createElement('span');
      label.textContent = `${t.icon} ${t.name}`;
      opt.appendChild(swatch);
      opt.appendChild(label);
      opt.onclick = (e) => {
        e.stopPropagation();
        if (reg) reg.setTheme(t.id);
        applyTheme(t.id !== 'light', t.id);
        closeThemeMenu();
      };
      themeMenu.appendChild(opt);
    }

    const customPanel = document.createElement('div');
    customPanel.className = 'connectea-theme-custom-panel';
    const cColors = reg ? reg.getCustomColors() : { canvas: '#111827', surface: '#1f2937', accent: '#6366f1' };
    for (const f of [{ k: 'canvas', l: 'Canvas' }, { k: 'surface', l: 'Surface' }, { k: 'accent', l: 'Accent' }]) {
      const row = document.createElement('div');
      row.className = 'connectea-theme-custom-row';
      row.innerHTML = `<span>${f.l}</span><input type="color" value="${cColors[f.k] || '#1f2937'}">`;
      row.querySelector('input').onchange = (e) => {
        if (reg) { reg.setCustomColors({ [f.k]: e.target.value }); reg.setTheme('custom'); }
        applyTheme(true, 'custom');
      };
      customPanel.appendChild(row);
    }
    themeMenu.appendChild(customPanel);
    toggleButton.appendChild(themeMenu);
  }

  function applyTheme(isDark, themeId) {
    if (isLoginUrl()) {
      if (isDark || isDarkMode) {
        try {
          localStorage.setItem(RESTORE_KEY, 'true');
        } catch {}
      }
      isDark = false;
      try {
        localStorage.setItem(STORAGE_KEY, 'light');
      } catch {}
    } else {
      try {
        if (localStorage.getItem(RESTORE_KEY) === 'true') {
          localStorage.removeItem(RESTORE_KEY);
          isDark = true;
          localStorage.setItem(STORAGE_KEY, 'dark');
        }
      } catch {}
    }
    isDarkMode = isDark;
    document.documentElement.classList.toggle('connectea-dark', isDarkMode);
    if (document.body) {
      document.body.classList.toggle('connectea-dark', isDarkMode);
    }

    const currentTheme = themeId || (typeof window.ConnectifyThemeRegistry !== 'undefined'
      ? window.ConnectifyThemeRegistry.getTheme()
      : (isDarkMode ? 'dark' : 'light'));

    if (isDarkMode) {
      document.documentElement.dataset.connecteaTheme = currentTheme;
    } else {
      delete document.documentElement.dataset.connecteaTheme;
    }

    const label = isDarkMode ? '☀ Light mode' : '☾ Dark mode';
    if (toggleButton.textContent !== label) {
      toggleButton.textContent = label;
    }
    toggleButton.setAttribute('aria-label', label);
    toggleButton.setAttribute('aria-pressed', String(isDarkMode));

    if (typeof document !== 'undefined' && document.createElement) {
      let arrow = toggleButton.querySelector('.connectea-theme-arrow');
      if (!arrow) {
        arrow = document.createElement('span');
        arrow.className = 'connectea-theme-arrow';
        arrow.setAttribute('title', 'Theme options');
        arrow.textContent = ' ▾';
        toggleButton.appendChild(arrow);
      }
    }

    updateTogglePosition();
    if (isDarkMode) {
      scheduleAdaptSurfaces();
    }
  }

  let lastToggleTime = 0;
  toggleButton.onclick = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (e?.target?.closest?.('.connectea-theme-arrow')) {
      if (themeMenu) closeThemeMenu();
      else openThemeMenu();
      return;
    }
    const now = Date.now();
    if (now - lastToggleTime < 300) return; // 300ms debounce
    lastToggleTime = now;

    if (isLoginUrl()) {
      applyTheme(false);
      return;
    }

    try {
      localStorage.removeItem(RESTORE_KEY);
    } catch {}

    // Use current DOM state as ground truth to prevent any desync
    const isCurrentlyDark = document.documentElement.classList.contains('connectea-dark');
    const nextDark = !isCurrentlyDark;
    try {
      localStorage.setItem(STORAGE_KEY, nextDark ? 'dark' : 'light');
    } catch {}
    if (typeof window.ConnectifyThemeRegistry !== 'undefined') {
      window.ConnectifyThemeRegistry.setTheme(nextDark ? 'dark' : 'light');
    }
    applyTheme(nextDark);
  };

  toggleButton.oncontextmenu = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (themeMenu) closeThemeMenu(); else openThemeMenu();
  };

  document.addEventListener('click', (e) => {
    if (themeMenu && toggleButton && !toggleButton.contains(e.target)) closeThemeMenu();
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
      if (isDarkMode && !isLoginUrl()) adaptSurfaces();
    }, effectiveDelay);
  }

  // Re-attach toggle button and adapt surfaces across client-side SPA route navigations
  let syncScheduled = false;
  const debouncedSync = () => {
    if (syncScheduled) return;
    syncScheduled = true;
    requestAnimationFrame(() => {
      syncScheduled = false;
      if (isLoginUrl()) {
        if (isDarkMode || document.documentElement.classList.contains('connectea-dark')) {
          try {
            localStorage.setItem(RESTORE_KEY, 'true');
          } catch {}
          applyTheme(false);
        }
        if (toggleButton.parentElement) toggleButton.remove();
        return;
      }
      try {
        if (localStorage.getItem(RESTORE_KEY) === 'true') {
          localStorage.removeItem(RESTORE_KEY);
          localStorage.setItem(STORAGE_KEY, 'dark');
          applyTheme(true);
          return;
        }
      } catch {}
      cleanupDuplicateButtons();
      const nav = document.querySelector('.cvr-c-primary-navigation');
      if (!nav || toggleButton.parentElement !== nav || !toggleButton.isConnected) {
        updateTogglePosition(true);
      } else {
        updateTogglePosition();
      }
      if (isDarkMode) {
        scheduleAdaptSurfaces();
      }
    });
  };

  new MutationObserver(records => {
    if (window.ConnectifyIsAccordionAnimating || window.ConnectifyIsBulkExpanding) return;
    const shouldUpdate = records.some(record => {
      if (record.target === toggleButton || record.target.parentElement?.closest('#connectea-theme-toggle') || record.target.closest?.('#connectify-sidebar')) {
        return false;
      }
      if (record.type === 'attributes' && (record.attributeName === 'data-connectea-surface' || record.attributeName === 'data-connectea-ink')) {
        return false;
      }
      if (record.target?.closest?.('.eds-c-tile, .cvr-c-tile, .eds-c-accordion, .eds-c-accordion__panel, .cvr-c-task, .cvr-c-tasks, .connectea-panel')) {
        return false;
      }
      return true;
    });
    if (shouldUpdate) debouncedSync();
  }).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });

  window.addEventListener('resize', () => updateTogglePosition(true));
  window.addEventListener('storage', e => {
    if (e.key === STORAGE_KEY && e.newValue) {
      applyTheme(!isLoginUrl() && e.newValue === 'dark');
    }
  });

  // Initial mount with fast polling during initial SPA render
  updateTogglePosition();
  if (isDarkMode) scheduleAdaptSurfaces(600);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      try {
        if (isLoginUrl()) {
          if (isDarkMode || localStorage.getItem(STORAGE_KEY) === 'dark' || localStorage.getItem(RESTORE_KEY) === 'true') {
            localStorage.setItem(RESTORE_KEY, 'true');
          }
          localStorage.setItem(STORAGE_KEY, 'light');
          isDarkMode = false;
        } else if (localStorage.getItem(RESTORE_KEY) === 'true') {
          localStorage.removeItem(RESTORE_KEY);
          localStorage.setItem(STORAGE_KEY, 'dark');
          isDarkMode = true;
        }
      } catch {}
      if (document.body) document.body.classList.toggle('connectea-dark', isDarkMode);
      updateTogglePosition(true);
      if (isDarkMode) scheduleAdaptSurfaces(800);
    });
  }

  let mountPollCount = 0;
  const mountPollInterval = setInterval(() => {
    mountPollCount++;
    if (isLoginUrl()) {
      if (toggleButton.parentElement) toggleButton.remove();
      clearInterval(mountPollInterval);
      return;
    }
    try {
      if (localStorage.getItem(RESTORE_KEY) === 'true') {
        localStorage.removeItem(RESTORE_KEY);
        localStorage.setItem(STORAGE_KEY, 'dark');
        applyTheme(true);
      }
    } catch {}
    const nav = document.querySelector('.cvr-c-primary-navigation');
    if (nav && toggleButton.parentElement !== nav) updateTogglePosition(true);
    if (mountPollCount >= 30 || (nav && toggleButton.parentElement === nav)) {
      clearInterval(mountPollInterval);
    }
  }, 100);

  window.ConnectifyTheme = {
    isLoginUrl,
    isDarkMode: () => isDarkMode,
    applyTheme,
    getTheme: () => (window.ConnectifyThemeRegistry ? window.ConnectifyThemeRegistry.getTheme() : (isDarkMode ? 'dark' : 'light')),
    setTheme: (id, colors) => {
      const res = window.ConnectifyThemeRegistry ? window.ConnectifyThemeRegistry.setTheme(id, colors) : true;
      applyTheme(id !== 'light', id);
      return res;
    },
    getAvailableThemes: () => (window.ConnectifyThemeRegistry ? window.ConnectifyThemeRegistry.getAvailableThemes() : [
      { id: 'dark', name: 'Classic Dark', icon: '☾' },
      { id: 'light', name: 'Default Light', icon: '☀' }
    ]),
    registerTheme: def => (window.ConnectifyThemeRegistry ? window.ConnectifyThemeRegistry.registerTheme(def) : false),
    getCustomColors: () => (window.ConnectifyThemeRegistry ? window.ConnectifyThemeRegistry.getCustomColors() : null),
    setCustomColors: c => (window.ConnectifyThemeRegistry ? window.ConnectifyThemeRegistry.setCustomColors(c) : false)
  };
})();

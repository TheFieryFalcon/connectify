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
  let isDarkMode = false;

  try {
    isDarkMode = localStorage.getItem(STORAGE_KEY) === 'dark';
  } catch {}

  // Apply dark mode class immediately to avoid any initial page flash
  document.documentElement.classList.toggle('connectea-dark', isDarkMode);
  if (document.body) {
    document.body.classList.toggle('connectea-dark', isDarkMode);
  }

  // Reuse existing button if already in DOM or create once
  let toggleButton = document.getElementById('connectea-theme-toggle');
  if (!toggleButton) {
    toggleButton = document.createElement('button');
    toggleButton.id = 'connectea-theme-toggle';
    toggleButton.type = 'button';
  }
  toggleButton.className = 'connectea-theme-toggle';

  function cleanupDuplicateButtons() {
    // Purge duplicate #connectea-theme-toggle nodes
    const existingButtons = document.querySelectorAll('#connectea-theme-toggle, .connectea-theme-toggle');
    for (const btn of existingButtons) {
      if (btn !== toggleButton) {
        btn.remove();
      }
    }

    // Purge any stray/cloned buttons with dark/light mode text in nav or body
    const containers = [
      document.querySelector('.cvr-c-primary-navigation'),
      document.body
    ].filter(Boolean);

    for (const container of containers) {
      const candidates = container.querySelectorAll('button:not(#connectea-theme-toggle):not(.cx-calculator-tool):not(.cx-back-menu):not(.cx-close-btn)');
      for (const btn of candidates) {
        if (btn.closest('#connectify-sidebar')) continue;
        const text = (btn.textContent || '').trim().toLowerCase();
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (
          text.includes('dark mode') || text.includes('light mode') ||
          aria.includes('dark mode') || aria.includes('light mode')
        ) {
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
    if (forceReset) headerRightInset = null;
    const nav = document.querySelector('.cvr-c-primary-navigation');
    if (!nav) {
      // Navbar not in DOM yet on page load: do not show misplaced on body
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

    if (computedInset !== null) {
      headerRightInset = computedInset;
    }
    toggleButton.style.right = `${headerRightInset ?? 90}px`;
  }

  function parseRgb(value, allowTranslucent = false) {
    if (!value) return null;
    const match = value.match(/^rgba?\(([^)]+)\)/);
    if (!match) return null;
    const parts = match[1].split(',').map(Number);
    const isInvalidAlpha = parts.length === 4 && (parts[3] === 0 || (!allowTranslucent && parts[3] < 0.9));
    return isInvalidAlpha ? null : parts.slice(0, 3);
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
    if (!isDarkMode) return;

    try {
      const surfaceCandidates = document.body.querySelectorAll(
        ':is(div, section, article, header, nav, main, aside, form, table, tr, td, th, ul, li, mat-toolbar, mat-tab-header, .mat-toolbar, .mat-tab-header, .v-panel, .v-panel-content, .eds-c-card, .cvr-c-promo, .cvr-c-heading-bar, .cvr-c-page-header, .cvr-c-report-years, .cvr-c-year-selector, .eds-c-tile__action, .eds-c-standard-button):not([data-connectea-surface]):not(#connectify-sidebar *):not(#connectea-theme-toggle):not(.connectea-panel *):not(.eds-c-tile *):not(.cvr-c-tile *):not(.cvr-c-task__chart *):not(.highcharts-container *):not(#cx-expand-progress):not(#cx-expand-progress *)'
      );

      for (const el of surfaceCandidates) {
        if (['SCRIPT', 'STYLE', 'LINK', 'CANVAS', 'VIDEO', 'IFRAME', 'SVG'].includes(el.tagName)) continue;
        if (el.closest('.eds-c-tile, .cvr-c-tile, .cvr-c-task__chart, .highcharts-container, #cx-expand-progress')) continue;
        const style = window.getComputedStyle(el);
        const bgRgb = parseRgb(style.backgroundColor);
        if (isNeutralColor(bgRgb) && Math.min(...bgRgb) > 165) {
          el.setAttribute('data-connectea-surface', '');
        }
      }

      const inkCandidates = document.body.querySelectorAll(
        ':is(p, span, div, h1, h2, h3, h4, h5, h6, label, strong, a, button, li, i):not([data-connectea-ink]):not(#connectify-sidebar *):not(#connectea-theme-toggle):not(.connectea-panel *):not(.eds-c-tile *):not(.cvr-c-tile *):not(.cvr-c-task__chart *):not(.highcharts-container *):not(#cx-expand-progress):not(#cx-expand-progress *)'
      );
      for (const el of inkCandidates) {
        if (el.children.length > 2) continue;
        if (el.hasAttribute('data-connectea-surface')) continue;
        if (el.closest('.eds-c-tile, .cvr-c-tile, .cvr-c-task__chart, .highcharts-container, #cx-expand-progress')) continue;
        const style = window.getComputedStyle(el);
        const fgRgb = parseRgb(style.color, true);
        if (isDarkColor(fgRgb)) {
          el.setAttribute('data-connectea-ink', '');
        }
      }
    } catch (e) {}
  }

  function applyTheme(isDark) {
    isDarkMode = isDark;
    document.documentElement.classList.toggle('connectea-dark', isDarkMode);
    if (document.body) {
      document.body.classList.toggle('connectea-dark', isDarkMode);
    }

    const label = isDarkMode ? '☀ Light mode' : '☾ Dark mode';
    if (toggleButton.textContent !== label) {
      toggleButton.textContent = label;
    }
    toggleButton.setAttribute('aria-label', label);
    toggleButton.setAttribute('aria-pressed', String(isDarkMode));

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
    const now = Date.now();
    if (now - lastToggleTime < 300) return; // 300ms debounce
    lastToggleTime = now;

    // Use current DOM state as ground truth to prevent any desync
    const isCurrentlyDark = document.documentElement.classList.contains('connectea-dark');
    const nextDark = !isCurrentlyDark;
    try {
      localStorage.setItem(STORAGE_KEY, nextDark ? 'dark' : 'light');
    } catch {}
    applyTheme(nextDark);
  };

  let adaptTimer = null;
  function scheduleAdaptSurfaces() {
    clearTimeout(adaptTimer);
    adaptTimer = setTimeout(() => {
      if (isDarkMode) adaptSurfaces();
    }, 400);
  }

  // Re-attach toggle button and adapt surfaces across client-side SPA route navigations
  let syncScheduled = false;
  const debouncedSync = () => {
    if (syncScheduled) return;
    syncScheduled = true;
    requestAnimationFrame(() => {
      syncScheduled = false;
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
      applyTheme(e.newValue === 'dark');
    }
  });

  // Initial mount with fast polling during initial SPA render
  updateTogglePosition();
  if (isDarkMode) adaptSurfaces();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body) {
        document.body.classList.toggle('connectea-dark', isDarkMode);
      }
      updateTogglePosition(true);
      if (isDarkMode) adaptSurfaces();
    });
  }

  let mountPollCount = 0;
  const mountPollInterval = setInterval(() => {
    mountPollCount++;
    const nav = document.querySelector('.cvr-c-primary-navigation');
    if (nav && toggleButton.parentElement !== nav) {
      updateTogglePosition(true);
    }
    if (mountPollCount >= 30 || (nav && toggleButton.parentElement === nav)) {
      clearInterval(mountPollInterval);
    }
  }, 100);
})();

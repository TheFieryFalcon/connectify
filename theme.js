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
    const container = nav || document.body;
    if (toggleButton.parentElement !== container) {
      container.append(toggleButton);
    }

    // Find notification bell icon whether hollow, solid, or with notification dot/badge
    const bell = document
      .querySelector(':is(.cvr-c-icon--notification-hollow, .cvr-c-icon--notification, .cvr-c-icon--notification-solid, [class*="notification"])')
      ?.closest('[role="button"], button') ||
      document.querySelector('[aria-label*="notification" i], [data-automation-id="notifications"]');
    const rect = bell?.getBoundingClientRect();

    if (rect?.width && rect.left > 120) {
      headerRightInset = Math.max(8, window.innerWidth - rect.left + 12);
    } else {
      // Fallback: position to the left of the avatar/user menu if bell is still loading
      const avatar = document.querySelector('.cvr-c-primary-navigation__button--avatar, [class*="avatar"]')?.closest('[role="button"], button');
      const avatarRect = avatar?.getBoundingClientRect();
      if (avatarRect?.width && avatarRect.left > 120) {
        headerRightInset = Math.max(8, window.innerWidth - avatarRect.left + 140);
      }
    }

    toggleButton.style.right = `${headerRightInset ?? 90}px`;
  }

  function updateDetailArrows() {
    for (const heading of document.querySelectorAll('.eds-c-tile .eds-c-accordion__section-heading')) {
      const text = heading.textContent.replace(/\s+/g, ' ').trim();
      const arrow = /hide details/i.test(text) ? '▴' : /show details/i.test(text) ? '▾' : null;

      if (arrow && heading.getAttribute('data-cx-details-arrow') !== arrow) {
        heading.setAttribute('data-cx-details-arrow', arrow);
      } else if (!arrow && heading.hasAttribute('data-cx-details-arrow')) {
        heading.removeAttribute('data-cx-details-arrow');
      }
    }
  }

  function applyTheme(isDark) {
    isDarkMode = isDark;
    document.documentElement.classList.toggle('connectea-dark', isDarkMode);

    const label = isDarkMode ? '☀ Light mode' : '☾ Dark mode';
    if (toggleButton.textContent !== label) {
      toggleButton.textContent = label;
    }
    toggleButton.setAttribute('aria-label', label);
    toggleButton.setAttribute('aria-pressed', String(isDarkMode));

    updateTogglePosition();
    updateDetailArrows();
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

  // Re-attach toggle button and update arrows across client-side SPA route navigations
  let syncScheduled = false;
  const debouncedSync = () => {
    if (syncScheduled) return;
    syncScheduled = true;
    requestAnimationFrame(() => {
      syncScheduled = false;
      cleanupDuplicateButtons();
      if (!toggleButton.isConnected) updateTogglePosition();
      updateDetailArrows();
    });
  };

  new MutationObserver(debouncedSync).observe(document.body, {
    childList: true,
    subtree: true
  });

  window.addEventListener('resize', () => updateTogglePosition(true));
  window.addEventListener('storage', e => {
    if (e.key === STORAGE_KEY && e.newValue) {
      applyTheme(e.newValue === 'dark');
    }
  });

  // Initial mount
  updateTogglePosition();
  updateDetailArrows();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      updateTogglePosition();
      updateDetailArrows();
    });
  }
})();

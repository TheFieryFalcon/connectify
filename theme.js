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

  // Purge duplicate buttons if any exist
  const existingButtons = document.querySelectorAll('#connectea-theme-toggle');
  for (let i = 1; i < existingButtons.length; i++) {
    existingButtons[i].remove();
  }

  toggleButton.setAttribute('aria-label', isDarkMode ? 'Light mode' : 'Dark mode');
  toggleButton.textContent = isDarkMode ? '☀ Light mode' : '☾ Dark mode';
  toggleButton.setAttribute('aria-pressed', String(isDarkMode));

  let headerRightInset = null;

  function updateTogglePosition(forceReset = false) {
    if (forceReset) headerRightInset = null;
    const nav = document.querySelector('.cvr-c-primary-navigation');
    const container = nav || document.body;
    if (toggleButton.parentElement !== container) {
      container.append(toggleButton);
    }

    const bell = document
      .querySelector('.cvr-c-icon--notification-hollow')
      ?.closest('[role="button"], button');
    const rect = bell?.getBoundingClientRect();

    if (headerRightInset === null && rect?.width && rect.left > 120) {
      headerRightInset = Math.max(8, window.innerWidth - rect.left + 12);
    }

    toggleButton.style.right = `${headerRightInset ?? 16}px`;
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

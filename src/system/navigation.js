/**
 * Connectify Navigation Shortcuts
 *
 * Injects a direct "Assessment Outlines" shortcut into Connect's primary navigation
 * bar (both desktop greedy menu and mobile drawer).
 */
(() => {
  'use strict';

  if (window.__connectifyNavInitialized) return;
  window.__connectifyNavInitialized = true;

  const DESTINATION_URL = 'https://connect.det.wa.edu.au/group/students/ui/my-settings/assessment-outlines';
  const SHORTCUT_LABEL = 'Assessment Outlines';

  function addShortcut() {
    // Do not remove the shortcut on the assessment-outlines page.

    // Desktop greedy navigation bar
    for (const menu of document.querySelectorAll('.cvr-c-primary-navigation__links')) {
      if (menu.querySelector('[data-connectea-shortcut]')) continue;

      const originalLink = menu.querySelector('a[href="/group/students/ui/my-connect"]');
      const item = originalLink?.closest('.cvr-js-greedy__item');
      if (!item) continue;

      const shortcut = document.createElement('div');
      shortcut.className = 'v-csslayout v-layout v-widget cvr-js-greedy__item v-csslayout-cvr-js-greedy__item';
      shortcut.dataset.connecteaShortcut = '';
      shortcut.style.display = 'inline-block';

      const wrapper = document.createElement('div');
      wrapper.className = 'v-link v-widget';

      const link = document.createElement('a');
      link.href = DESTINATION_URL;

      const text = document.createElement('span');
      text.textContent = SHORTCUT_LABEL;

      link.append(text);
      wrapper.append(link);
      shortcut.append(wrapper);
      item.after(shortcut);
    }

    // Mobile / small-screen primary menu drawer
    for (const menu of document.querySelectorAll('.cvr-c-primary-menu__list')) {
      if (menu.querySelector('[data-connectea-shortcut]')) continue;

      const originalLabel = Array.from(menu.querySelectorAll('.cvr-c-primary-menu__item-label')).find(
        e => e.textContent.trim() === 'My Connect'
      );
      const item = originalLabel?.closest('.cvr-c-primary-menu__item');
      if (!item) continue;

      const link = document.createElement('a');
      link.dataset.connecteaShortcut = '';
      link.href = DESTINATION_URL;
      link.className = 'cvr-c-primary-menu__item';
      link.style.cssText = 'display:block;color:inherit;text-decoration:none';

      const text = document.createElement('div');
      text.className = originalLabel.className;
      text.textContent = SHORTCUT_LABEL;

      link.append(text);
      item.after(link);
    }
  }

  let scheduled = false;

  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      addShortcut();
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  addShortcut();

  // User activity tracking to allow quiet idle periods and detect session timeouts
  window.__connectifyLastActive = Date.now();
  window.ConnectifyIsUserActive = () => (Date.now() - (window.__connectifyLastActive || Date.now())) < 90000;

  const onUserActivity = () => {
    window.__connectifyLastActive = Date.now();
  };
  for (const evt of ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll']) {
    window.addEventListener(evt, onUserActivity, { passive: true, capture: true });
  }

  const getStorageApi = () => {
    return (typeof browser !== 'undefined' && browser?.storage)
      ? browser
      : (typeof chrome !== 'undefined' && chrome?.storage ? chrome : null);
  };

  // Intercept logout clicks to temporarily disable auto-login on the sign-in page
  document.addEventListener('click', (e) => {
    if (e.target.closest('.cvr-c-primary-navigation__button--sign-out, a[href*="logout"], button[name*="logout"]')) {
      try {
        const api = getStorageApi();
        if (api?.storage?.local) {
          api.storage.local.set({ 'cx-manual-logout': true });
        }
      } catch (err) {}
    }
  }, true);

  // If page unloads or redirects while user was idle (> 5 mins), mark session as expired
  window.addEventListener('beforeunload', () => {
    if (Date.now() - (window.__connectifyLastActive || Date.now()) > 300000) {
      try {
        const api = getStorageApi();
        if (api?.storage?.local) {
          api.storage.local.set({ 'cx-session-expired': true });
        }
      } catch (err) {}
    }
  });

  // Watch for session warning/expiry modal dialogs in Connect
  const checkSessionStatus = () => {
    const text = document.body ? document.body.innerText : '';
    if (/session\s*(has\s*)?(expired|timed\s*out)|your\s*session\s*will\s*expire/i.test(text)) {
      try {
        const api = getStorageApi();
        if (api?.storage?.local) {
          api.storage.local.set({ 'cx-session-expired': true });
        }
      } catch (err) {}
    }
  };
  setInterval(checkSessionStatus, 10000);
})();

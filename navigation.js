/**
 * Connectify Navigation Shortcuts
 *
 * Injects a direct "Assessment Outlines" shortcut into Connect's primary navigation
 * bar (both desktop greedy menu and mobile drawer).
 */
(() => {
  'use strict';

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

  // Intercept logout clicks to temporarily disable auto-login on the sign-in page
  document.addEventListener('click', (e) => {
      if (e.target.closest('.cvr-c-primary-navigation__button--sign-out')) {
          if (typeof chrome !== 'undefined' && chrome.storage) {
              chrome.storage.local.set({'cx-manual-logout': true});
          }
      }
  }, true);
})();

/**
 * Connectify Theme: navbar toggle button
 *
 * The "Themes" / "Default" button mounted in Connect's top navigation, with a chevron that opens
 * the theme menu. Exposes window.ConnectifyThemeToggle.
 */
(() => {
  'use strict';

  const SVG_CHEVRON = '<svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M2 3.75L5 6.75L8 3.75"/></svg>';

  let button = document.getElementById('connectea-theme-toggle');
  if (!button) {
    button = document.createElement('button');
    button.id = 'connectea-theme-toggle';
    button.type = 'button';
  }
  button.className = 'connectea-theme-toggle';

  // Distance from the navbar's right edge, measured from the notification bell (or avatar)
  let headerRightInset = null;

  /** Removes stale copies of the toggle and legacy dark/light mode buttons from older versions. */
  function cleanupDuplicateButtons() {
    for (const btn of document.querySelectorAll('#connectea-theme-toggle, .connectea-theme-toggle')) if (btn !== button) btn.remove();
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

  /** Labels the button for the current mode; onArrowClick runs when the chevron is clicked. */
  function setLabel(dark, onArrowClick) {
    const label = dark ? 'Default' : 'Themes';
    button.textContent = label;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(dark));
    const arrow = document.createElement('span');
    arrow.className = 'connectea-theme-arrow';
    arrow.setAttribute('title', 'Theme options');
    arrow.setAttribute('aria-label', 'Open theme menu');
    arrow.innerHTML = SVG_CHEVRON;
    arrow.onclick = e => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      onArrowClick?.();
    };
    button.appendChild(arrow);
  }

  function remove() {
    if (button.parentElement) button.remove();
  }

  /** Mounts the button in the top navigation, left of the notification bell. */
  function position(forceReset = false) {
    cleanupDuplicateButtons();
    if (forceReset) headerRightInset = null;
    const nav = document.querySelector('.cvr-c-primary-navigation');
    if (!nav) {
      remove();
      return;
    }
    if (button.parentElement !== nav) nav.append(button);

    const bell = nav.querySelector(':is(.cvr-c-icon--notification-hollow, .cvr-c-icon--notification, .cvr-c-icon--notification-solid, [class*="notification"])')?.closest('[role="button"], button') ||
      nav.querySelector('[aria-label*="notification" i], [data-automation-id="notifications"]');
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
    button.style.right = `${headerRightInset ?? 90}px`;
  }

  window.ConnectifyThemeToggle = { button, cleanupDuplicateButtons, setLabel, position, remove };
})();

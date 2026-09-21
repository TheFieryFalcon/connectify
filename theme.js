/**
 * Connext Dark Theme Engine
 *
 * Provides site-wide dark mode styling for Connect, dynamic contrast adaptation
 * for neutral surfaces, and accordion arrow enhancements.
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'connectea:theme:v1';
  let isDarkMode = false;
  let isScheduled = false;

  try {
    isDarkMode = localStorage.getItem(STORAGE_KEY) === 'dark';
  } catch {}

  const toggleButton = document.createElement('button');
  toggleButton.id = 'connectea-theme-toggle';
  toggleButton.type = 'button';
  toggleButton.setAttribute('aria-label', 'Dark mode');
  document.body.append(toggleButton);

  /**
   * Parse RGB/RGBA color string into [r, g, b] array.
   */
  function parseRgb(value, allowTranslucent = false) {
    const match = value.match(/^rgba?\(([^)]+)\)/);
    if (!match) return null;

    const parts = match[1].split(',').map(Number);
    const isInvalidAlpha = parts.length === 4 && (parts[3] === 0 || (!allowTranslucent && parts[3] < 0.9));
    return isInvalidAlpha ? null : parts.slice(0, 3);
  }

  function isNeutralColor(rgb) {
    return rgb && Math.max(...rgb) - Math.min(...rgb) < 24;
  }

  const savedTextColors = new Map();

  function restoreTextColors() {
    for (const [el, saved] of savedTextColors) {
      if (el.style.getPropertyValue(saved.property) === 'rgb(255, 255, 255)') {
        if (saved.value) {
          el.style.setProperty(saved.property, saved.value, saved.priority);
        } else {
          el.style.removeProperty(saved.property);
        }
      }
    }
    savedTextColors.clear();
  }

  /**
   * Adjust neutral backgrounds and dark text to high-contrast white in dark mode.
   * Preserves charts, video, canvas, brand colors, and status indicators.
   */
  function adaptSurfaces() {
    if (!isDarkMode) return;

    for (const el of document.body.querySelectorAll('*')) {
      const isSvgText = el instanceof SVGElement && ['text', 'tspan'].includes(el.localName);
      if (!(el instanceof HTMLElement) && !isSvgText) continue;

      if (
        el.closest('video, canvas, iframe, #connectea-theme-toggle') ||
        ['SCRIPT', 'STYLE', 'LINK'].includes(el.tagName)
      ) {
        continue;
      }

      const style = getComputedStyle(el);
      const bgRgb = parseRgb(style.backgroundColor);
      const fgRgb = parseRgb(isSvgText ? style.fill : style.color, true);

      // Tag bright neutral backgrounds for CSS inversion
      if (!isSvgText && !el.closest('.connectea-panel') && isNeutralColor(bgRgb) && Math.min(...bgRgb) > 165) {
        el.setAttribute('data-connectea-surface', '');
      }

      // Brighten dark text against dark mode backgrounds
      if (isNeutralColor(fgRgb) && Math.max(...fgRgb) < 170) {
        const property = isSvgText ? 'fill' : 'color';
        savedTextColors.set(el, {
          property,
          value: el.style.getPropertyValue(property),
          priority: el.style.getPropertyPriority(property)
        });
        el.style.setProperty(property, 'rgb(255, 255, 255)', 'important');
      }
    }
  }

  let headerRightInset = null;

  function updateTogglePosition(forceReset = false) {
    if (forceReset) headerRightInset = null;
    if (toggleButton.parentElement !== document.body) {
      document.body.append(toggleButton);
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

  function updateTheme() {
    if (!toggleButton.isConnected) document.body.append(toggleButton);
    if (!isDarkMode) restoreTextColors();

    document.documentElement.classList.toggle('connectea-dark', isDarkMode);
    const label = isDarkMode ? '☀ Light mode' : '☾ Dark mode';

    if (toggleButton.textContent !== label) {
      toggleButton.textContent = label;
    }
    toggleButton.setAttribute('aria-pressed', String(isDarkMode));

    updateTogglePosition();
    adaptSurfaces();
    updateDetailArrows();
  }

  function scheduleUpdate() {
    if (isScheduled) return;
    isScheduled = true;
    setTimeout(() => {
      isScheduled = false;
      updateTheme();
    }, 100);
  }

  toggleButton.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    try {
      localStorage.setItem(STORAGE_KEY, isDarkMode ? 'dark' : 'light');
    } catch {}
    updateTheme();
  });

  new MutationObserver(records => {
    const shouldUpdate = records.some(record => {
      if (record.target === toggleButton || record.target.parentElement?.closest('#connectea-theme-toggle')) {
        return false;
      }
      const saved = savedTextColors.get(record.target);
      return !(
        record.type === 'attributes' &&
        record.attributeName === 'style' &&
        saved &&
        record.target.style.getPropertyValue(saved.property) === 'rgb(255, 255, 255)'
      );
    });

    if (shouldUpdate) scheduleUpdate();
  }).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'style']
  });

  window.addEventListener('resize', () => updateTogglePosition(true));
  window.addEventListener('storage', e => {
    if (e.key === STORAGE_KEY) {
      isDarkMode = e.newValue === 'dark';
      updateTheme();
    }
  });

  setInterval(() => {
    if (!toggleButton.isConnected) updateTheme();
  }, 1000);

  updateTheme();
})();

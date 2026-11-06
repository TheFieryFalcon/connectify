/**
 * Connectify Past Years: the notice over a past year's outlines
 *
 * While a past year is viewed (past-year-mode.js), #cx-past-year-bar sits just above the drawn outlines and stays in
 * view under Connect's top bars as the page scrolls: the year, when its marks were last read, and Back to This Year.
 * Connect's own cards and filter bar are this year's, so past-year.css hides them. Exposes window.ConnectifyPastYearBar.
 */
(() => {
  'use strict';

  try {
    if (window.ConnectifyPastYearBar) return;
    const mode = window.ConnectifyPastYearMode;
    if (!mode?.active()) return;

    const info = mode.entry();
    const el = (tag, className, text) => Object.assign(document.createElement(tag), { className, textContent: text || '' });
    const bar = el('div', 'cx-past-year-bar');
    bar.id = 'cx-past-year-bar';
    bar.setAttribute('role', 'status');
    const saved = Number.isFinite(info.savedAt)
      ? new Date(info.savedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
      : '';
    const text = el('div', 'cx-past-year-bar__text');
    text.append(el('strong', 'cx-past-year-bar__label', info.label || String(info.year)));
    if (saved) text.append(el('span', 'cx-past-year-bar__saved', `Marks as of ${saved}`));
    const back = el('button', 'cx-past-year-bar__back', 'Back to This Year');
    back.type = 'button';
    back.addEventListener('click', () => window.ConnectifyPastYearOpen?.back());
    bar.append(text, back);

    // Under the bars Connect keeps fixed at the top of the window, measured as they are
    const TOP_BARS = '.cvr-c-primary-navigation, .cvr-c-location-bar, .cvr-c-service-bar, .cvr-c-service-bar__container';
    function measureTop() {
      let bottom = 0;
      for (const node of document.querySelectorAll(TOP_BARS)) {
        const position = getComputedStyle(node).position;
        if (position !== 'fixed' && position !== 'sticky') continue;
        const rect = node.getBoundingClientRect();
        if (rect.height && rect.top <= 1) bottom = Math.max(bottom, rect.bottom);
      }
      document.documentElement.style.setProperty('--cx-past-year-top', `${Math.round(bottom)}px`);
    }

    function place() {
      const host = document.getElementById(window.ConnectifyLegacyOutlines?.HOST_ID || 'cx-legacy-outlines');
      if (!host?.parentElement) return;
      if (host.previousElementSibling !== bar) host.before(bar);
      measureTop();
    }

    window.addEventListener('connectify-outlines-preview', place);
    window.addEventListener('connectify-outlines-loaded', place);
    window.addEventListener('resize', measureTop);
    window.ConnectifyScheduler?.onMutations?.(place, {
      filter: m => m.type === 'childList' && [...m.addedNodes, ...m.removedNodes].some(n => n.nodeType === 1 && (n.id === 'cx-legacy-outlines' || n.id === bar.id)),
      mute: false
    });
    place();

    window.ConnectifyPastYearBar = { bar, place, measureTop };
  } catch (err) {
    console.error('Connectify error in past-year-bar.js:', err);
  }
})();

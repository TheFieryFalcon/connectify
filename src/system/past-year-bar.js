/**
 * Connectify Past Years: the notice over a past year's outlines
 *
 * While a past year is viewed (past-year-mode.js), #cx-past-year-bar sits just above the drawn outlines and stays in
 * view under Connect's fixed top bars as the page scrolls (measured as they move): the year, when its marks were last
 * read, and Back to This Year. Connect's own cards and filter bar are this year's, so past-year.css hides them. Exposes window.ConnectifyPastYearBar.
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

    // Under the bars Connect keeps fixed at the top of the window. Its service bar moves up as the page scrolls
    // (50px from the top, then 0), so the bars are measured where they are, again after each scroll
    const TOP_BARS = '.cvr-c-primary-navigation, .cvr-c-location-bar, .cvr-c-service-bar, .cvr-c-service-bar__container';
    let lastTop = null;
    function measureTop() {
      let bottom = 0;
      for (const node of document.querySelectorAll(TOP_BARS)) {
        const position = getComputedStyle(node).position;
        if (position !== 'fixed' && position !== 'sticky') continue;
        const rect = node.getBoundingClientRect();
        if (rect.height && rect.top < 150) bottom = Math.max(bottom, rect.bottom);
      }
      const top = `${Math.round(bottom)}px`;
      if (top !== lastTop) document.documentElement.style.setProperty('--cx-past-year-top', (lastTop = top));
    }
    // Connect moves the bar after its own scroll handling, so once more when the scroll settles
    let frame = 0;
    let settle = null;
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; measureTop(); });
      clearTimeout(settle);
      settle = setTimeout(measureTop, 150);
    };

    function place() {
      const host = document.getElementById(window.ConnectifyLegacyOutlines?.HOST_ID || 'cx-legacy-outlines');
      if (!host?.parentElement) return;
      if (host.previousElementSibling !== bar) host.before(bar);
      measureTop();
    }

    window.addEventListener('connectify-outlines-preview', place);
    window.addEventListener('connectify-outlines-loaded', place);
    window.addEventListener('resize', measureTop);
    window.addEventListener('scroll', onScroll, { passive: true });
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

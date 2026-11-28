/**
 * Connectify Past Years: the notice over a past year's or remembered outlines
 *
 * While a past year is viewed (past-year-mode.js), #cx-past-year-bar sits just above the drawn outlines and stays in
 * view under Connect's fixed top bars as the page scrolls (measured as they move): the year, when its marks were last
 * read, and Back to This Year. Connect's own cards and filter bar are this year's, so past-year.css hides them. When
 * Connect shows no outlines and the remembered ones are drawn instead (remembered-outlines.js), #cx-remembered-bar is
 * the same notice with only when their marks were kept. Exposes window.ConnectifyPastYearBar.
 */
(() => {
  'use strict';

  try {
    if (window.ConnectifyPastYearBar) return;
    const mode = window.ConnectifyPastYearMode;
    const remembered = () => window.ConnectifyRememberedOutlines;
    if (!mode?.active() && !window.ConnectifyUtils?.isOutlinesPage?.()) return;

    const el = (tag, className, text) => Object.assign(document.createElement(tag), { className, textContent: text || '' });
    const dateText = at => (Number.isFinite(at) && at > 0
      ? new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

    /** The notice: a past year's bold label, when the marks were kept, and Back to This Year for a past year. */
    function build(id, label, savedAt, back) {
      const node = el('div', 'cx-past-year-bar');
      node.id = id;
      node.setAttribute('role', 'status');
      const text = el('div', 'cx-past-year-bar__text');
      if (label) text.append(el('strong', 'cx-past-year-bar__label', label));
      const saved = dateText(savedAt);
      if (saved) text.append(el('span', 'cx-past-year-bar__saved', `Marks as of ${saved}`));
      node.append(text);
      if (back) {
        const button = el('button', 'cx-past-year-bar__back', 'Back to This Year');
        button.type = 'button';
        button.addEventListener('click', () => window.ConnectifyPastYearOpen?.back());
        node.append(button);
      }
      return node;
    }

    // A past year is known at once; remembered outlines only once Connect's load came back empty
    let bar = null;
    function ensureBar() {
      if (bar) return bar;
      if (mode?.active()) {
        const info = mode.entry();
        bar = build('cx-past-year-bar', info.label || String(info.year), info.savedAt, true);
      } else if (remembered()?.active()) {
        bar = build('cx-remembered-bar', '', remembered().savedAt(), false);
      }
      return bar;
    }

    // Under the bars Connect keeps fixed at the top of the window. Its service bar moves up as the page scrolls
    // (50px from the top, then 0), so the bars are measured where they are, again after each scroll
    const TOP_BARS = '.cvr-c-primary-navigation, .cvr-c-location-bar, .cvr-c-service-bar, .cvr-c-service-bar__container';
    let lastTop = null;
    function measureTop() {
      if (!bar) return;
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
      if (!bar) return;
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; measureTop(); });
      clearTimeout(settle);
      settle = setTimeout(measureTop, 150);
    };

    function place() {
      const host = document.getElementById(window.ConnectifyLegacyOutlines?.HOST_ID || 'cx-legacy-outlines');
      if (!host?.parentElement || !ensureBar()) return;
      if (host.previousElementSibling !== bar) host.before(bar);
      measureTop();
    }

    const IDS = ['cx-legacy-outlines', 'cx-past-year-bar', 'cx-remembered-bar'];
    window.addEventListener('connectify-outlines-preview', place);
    window.addEventListener('connectify-outlines-loaded', place);
    window.addEventListener('resize', measureTop);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.ConnectifyScheduler?.onMutations?.(place, {
      filter: m => m.type === 'childList' && [...m.addedNodes, ...m.removedNodes].some(n => n.nodeType === 1 && IDS.includes(n.id)),
      mute: false
    });
    place();

    window.ConnectifyPastYearBar = { get bar() { return bar; }, place, measureTop };
  } catch (err) {
    console.error('Connectify error in past-year-bar.js:', err);
  }
})();

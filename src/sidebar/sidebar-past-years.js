/**
 * Connectify Sidebar: Past Years
 *
 * The Past Years launcher (#connectify-past-years-toggle, between Weakness Analyzer and Settings) and its panel
 * (#connectify-past-years): each archived year (year-archive.js) with its classes and View, which opens Assessment
 * Outlines as that year ended (past-year-open.js). The year being viewed reads Back to This Year instead. The
 * launcher shows only once a past year exists, and works on every Connect page. Exposes window.ConnectifyPastYears.
 */
(() => {
  'use strict';

  try {
    if (window.ConnectifyPastYears) return;

    const archive = () => window.ConnectifyYearArchive;
    const mode = () => window.ConnectifyPastYearMode;
    const el = (tag, className, text) => Object.assign(document.createElement(tag), { className: className || '', textContent: text || '' });

    const toggleBtn = document.getElementById('connectify-past-years-toggle') || el('button', 'cx-secondary-tool', 'Past Years');
    toggleBtn.id = 'connectify-past-years-toggle';
    toggleBtn.type = 'button';
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.setAttribute('aria-pressed', 'false');

    const panel = document.getElementById('connectify-past-years') || el('section', 'cx-workspace-panel');
    panel.id = 'connectify-past-years';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Past Years');
    const head = el('header');
    const title = el('strong', '', 'Past Years');
    title.tabIndex = -1;
    head.append(title);
    const list = el('ul', 'cx-past-years-list');
    const status = el('p', 'cx-past-years-status');
    status.setAttribute('aria-live', 'polite');
    panel.replaceChildren(head, list, status);

    const FAILED = {
      full: 'There is not enough room in this browser to open this year.',
      missing: 'This year is no longer saved.'
    };

    /** Whether the launcher shows: a past year to open, or one being viewed. */
    const available = () => Boolean(mode()?.active()) || Boolean(archive()?.years().length);

    function row(year) {
      const viewing = mode()?.entry()?.id === year.id;
      const item = el('li', 'cx-past-year');
      if (viewing) item.setAttribute('aria-current', 'true');
      const text = el('div', 'cx-past-year__text');
      const names = window.ConnectifyUtils.subjectLabels(year.entry.classNames);
      text.append(el('strong', 'cx-past-year__label', year.label), el('span', 'cx-past-year__classes', year.entry.classNames.map(n => names.get(n)).join(', ')));
      const btn = el('button', 'cx-past-year__view', viewing ? 'Back to This Year' : 'View');
      btn.type = 'button';
      btn.setAttribute('aria-label', viewing ? 'Back to This Year' : `View ${year.label}`);
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (viewing) { window.ConnectifyPastYearOpen.back(); return; }
        status.textContent = '';
        const result = window.ConnectifyPastYearOpen.view(year.id);
        if (FAILED[result]) status.textContent = FAILED[result];
        else btn.disabled = true;
      });
      item.append(text, btn);
      return item;
    }

    function render() {
      list.replaceChildren(...(archive()?.years() || []).map(row));
    }

    function openPastYears() {
      panel.hidden = false;
      toggleBtn.setAttribute('aria-expanded', 'true');
      toggleBtn.setAttribute('aria-pressed', 'true');
      window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'past-years' }));
      status.textContent = '';
      render();
      title.focus();
    }

    function closePastYears() {
      panel.hidden = true;
      toggleBtn.setAttribute('aria-expanded', 'false');
      toggleBtn.setAttribute('aria-pressed', 'false');
    }

    panel.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      closePastYears();
      toggleBtn.focus();
    });
    window.addEventListener('connectify-open', e => {
      if (e.detail !== 'past-years') closePastYears();
    });
    // Extension storage answers after load: a year kept only there appears then
    window.addEventListener('connectify-archive-ready', () => { if (!panel.hidden) render(); });

    window.ConnectifyPastYears = {
      available,
      render,
      panelRefs: { toggleBtn, panel, openPastYears, closePastYears }
    };
  } catch (err) {
    console.error('Connectify error in sidebar-past-years.js:', err);
  }
})();

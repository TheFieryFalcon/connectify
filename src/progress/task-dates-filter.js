/**
 * Connectify Task Dates: show or hide subjects and types
 *
 * A dropdown of ticks, with Hide All / Show All, for each of the second toolbar row's Subjects and Type. What is
 * unticked (connectify:task_dates_view) leaves the list and, in Export mode, the downloads.
 * Exposes window.ConnectifyTaskDatesFilter.
 */
(() => {
  'use strict';

  if (window.ConnectifyTaskDatesFilter) return;

  /**
   * `{ wrap, paint(items, hidden) }`: paint with `[{ id, label }]` and the hidden ids. onChange gets the new hidden
   * ids. The ticks are rebuilt only when the items change, so an open list and its focus survive a repaint.
   */
  function create(label, onChange) {
    const el = window.ConnectifyProgressChart.createElement;
    const { checkbox } = window.ConnectifyExportRows;

    const wrap = el('div', null, 'cx-dates-control cx-dates-filter');
    const button = el('button', 'All', 'cx-dates-filter-btn');
    button.type = 'button';
    button.setAttribute('aria-label', `${label} shown`);
    button.setAttribute('aria-expanded', 'false');
    const popup = el('div', null, 'cx-dates-filter-list');
    popup.hidden = true;
    popup.setAttribute('role', 'group');
    popup.setAttribute('aria-label', `${label} shown`);
    const all = el('button', 'Hide All', 'cx-export-all');
    all.type = 'button';
    const ticks = el('div', null, 'cx-dates-filter-ticks');
    popup.append(all, ticks);
    wrap.append(el('span', `${label}:`), button, popup);

    let boxes = new Map();
    let builtFor = '';
    let current = new Set();

    const isOpen = () => !popup.hidden;
    function close() {
      if (!isOpen()) return;
      popup.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      document.removeEventListener('click', onDocumentClick, true);
    }
    // Captured, since the toolbar's other buttons stop their clicks
    function onDocumentClick(e) {
      if (!wrap.contains(e.target)) close();
    }
    button.addEventListener('click', e => {
      e.stopPropagation();
      if (isOpen()) { close(); return; }
      popup.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      document.addEventListener('click', onDocumentClick, true);
    });
    // Escape closes the list only, never the drawer
    wrap.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !isOpen()) return;
      e.stopPropagation();
      close();
      button.focus();
    });
    window.addEventListener('connectify-open', close);
    all.addEventListener('click', () => onChange(current.size ? [] : Array.from(boxes.keys())));

    function build(items) {
      boxes = new Map();
      ticks.replaceChildren(...items.map(item => {
        const box = checkbox(item.label, true, shown => {
          const next = new Set(current);
          shown ? next.delete(item.id) : next.add(item.id);
          onChange(Array.from(next));
        });
        boxes.set(item.id, box.input);
        return box.wrap;
      }));
    }

    function paint(items, hidden) {
      const key = JSON.stringify(items);
      if (key !== builtFor) {
        builtFor = key;
        build(items);
      }
      // Only what is on the list counts: something saved as hidden may have gone
      current = new Set(hidden.filter(id => boxes.has(id)));
      for (const [id, input] of boxes) input.checked = !current.has(id);
      const shown = items.length - current.size;
      button.textContent = !current.size ? 'All' : shown ? `${shown} of ${items.length}` : 'None';
      all.textContent = current.size ? 'Show All' : 'Hide All';
    }

    return { wrap, paint, close };
  }

  window.ConnectifyTaskDatesFilter = { create };
})();

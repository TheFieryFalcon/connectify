/**
 * Connectify Outlines: Jump To subject
 *
 * A "Jump To" dropdown (#cx-jump-subject) above the floating Expand All / Collapse All buttons. It lists each
 * shown outline's cleaned subject name once, in page order; choosing one expands that subject's card, scrolls to
 * its overall row (the subject average panel) and pulses it (ConnectifyNewGrade.jumpToSubject).
 * The dropdown is Connectify's own listbox, not a native <select>: the row sits at the bottom of the screen,
 * where macOS opens a native list downwards from the chosen name and cuts it off, so the list opens upwards
 * and shows every subject without scrolling. Styles: outline-jump.css. Exposes window.ConnectifyOutlineJump.
 */
(() => {
  'use strict';

  const TILE_SELECTOR = '.eds-c-tile, .cvr-c-tile';
  const TITLE_SELECTOR = '.eds-c-tile__title, .cvr-c-tile__title';
  const { normalize, cleanSubjectName, cardSemester } = window.ConnectifyUtils;

  const cleanName = title => cleanSubjectName(title) || normalize(title);

  /**
   * Shown outlines as [{ name, card }], one per subject in page order. A subject with both semesters' outlines
   * shown jumps to this semester's.
   */
  function subjects() {
    const current = window.ConnectifySemesterFilter?.currentSemester?.() || null;
    const byName = new Map();
    for (const card of document.querySelectorAll(TILE_SELECTOR)) {
      if (card.classList.contains('cx-semester-hidden') || window.ConnectifyCourseFilter?.hides(card)) continue;
      const title = normalize(card.querySelector(TITLE_SELECTOR)?.textContent);
      if (!title) continue;
      const name = cleanName(title);
      const entry = byName.get(name);
      if (!entry) byName.set(name, { name, card });
      else if (current && cardSemester(title) === current && cardSemester(entry.card.querySelector(TITLE_SELECTOR)?.textContent) !== current) {
        entry.card = card;
      }
    }
    return Array.from(byName.values());
  }

  function jump(name) {
    const entry = subjects().find(s => s.name === name);
    if (!entry) return;
    if (window.ConnectifyNewGrade?.jumpToSubject) window.ConnectifyNewGrade.jumpToSubject(entry.card);
    else entry.card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  const parts = () => ({
    trigger: document.getElementById('cx-jump-subject-select'),
    list: document.getElementById('cx-jump-subject-list')
  });
  const options = list => Array.from(list?.children || []);

  /** Remembers the subject last jumped to: the list opens on it. */
  function choose(trigger, list, name) {
    trigger.dataset.value = name || '';
    for (const opt of options(list)) opt.setAttribute('aria-selected', String(opt.dataset.value === name));
  }

  function onOutside(e) {
    if (!e.target?.closest?.('#cx-jump-subject')) close();
  }

  function close(refocus) {
    const { trigger, list } = parts();
    if (!list || list.hidden) return;
    list.hidden = true;
    trigger?.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onOutside, true);
    if (refocus) trigger?.focus();
  }

  /** Opens the list above the box, focusing the chosen subject. */
  function open() {
    sync();
    const { trigger, list } = parts();
    if (!trigger || !list || trigger.disabled) return;
    list.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', onOutside, true);
    const all = options(list);
    (all.find(o => o.dataset.value === trigger.dataset.value) || all[0])?.focus();
  }

  /** Rewrites the list only when the subject list changed, keeping the chosen subject. */
  function sync() {
    const { trigger, list } = parts();
    if (!trigger || !list) return;
    const names = subjects().map(s => s.name);
    const signature = names.join('\n');
    if (list._cxSignature === signature) return;
    list._cxSignature = signature;
    list.replaceChildren(...names.map(name => {
      const opt = document.createElement('button');
      opt.type = 'button';
      opt.className = 'cx-jump-subject-option';
      opt.setAttribute('role', 'option');
      opt.tabIndex = -1;
      opt.dataset.value = name;
      opt.textContent = name;
      return opt;
    }));
    const chosen = trigger.dataset.value;
    choose(trigger, list, names.includes(chosen) ? chosen : names[0]);
    trigger.disabled = names.length === 0;
    if (!names.length) close();
  }

  function onListKey(e, trigger, list) {
    const all = options(list);
    const at = all.indexOf(document.activeElement);
    const move = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (move) all[Math.min(all.length - 1, Math.max(0, at + move))]?.focus();
    else if (e.key === 'Home') all[0]?.focus();
    else if (e.key === 'End') all[all.length - 1]?.focus();
    else if (e.key === 'Escape') close(true);
    else if (e.key === 'Tab') { close(); return; }
    else return;
    e.preventDefault();
  }

  /** The dropdown: its box and the upward list. */
  function create() {
    const row = document.createElement('div');
    row.id = 'cx-jump-subject';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.id = 'cx-jump-subject-select';
    trigger.className = 'cx-jump-subject-select';
    trigger.textContent = 'Jump To';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-controls', 'cx-jump-subject-list');
    trigger.setAttribute('aria-expanded', 'false');
    const list = document.createElement('div');
    list.id = 'cx-jump-subject-list';
    list.className = 'cx-jump-subject-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Subjects');
    list.hidden = true;
    trigger.addEventListener('click', () => (list.hidden ? open() : close()));
    trigger.addEventListener('keydown', e => {
      if (!['ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      open();
    });
    list.addEventListener('click', e => {
      const opt = e.target?.closest?.('.cx-jump-subject-option');
      if (!opt) return;
      choose(trigger, list, opt.dataset.value);
      close(true);
      jump(opt.dataset.value);
    });
    list.addEventListener('keydown', e => onListKey(e, trigger, list));
    row.append(trigger, list);
    return row;
  }

  window.ConnectifyOutlineJump = { create, sync, subjects, cleanName, jump, open, close };
})();

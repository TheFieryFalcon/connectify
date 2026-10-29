/**
 * Connectify Outlines: Jump To subject
 *
 * A subject dropdown and a "Jump To" button (#cx-jump-subject) above the floating Expand All / Collapse All
 * buttons. The dropdown lists each shown outline's cleaned subject name once, in page order; Jump To expands
 * that subject's card, scrolls to it and pulses its highlight (ConnectifyNewGrade.jumpToSubject).
 * The dropdown is 108px wide; names over MAX_LABEL (10) characters end in an ellipsis (full name as value and title).
 * Styles: outline-jump.css. Exposes window.ConnectifyOutlineJump.
 */
(() => {
  'use strict';

  const TILE_SELECTOR = '.eds-c-tile, .cvr-c-tile';
  const TITLE_SELECTOR = '.eds-c-tile__title, .cvr-c-tile__title';
  // Longer names end in an ellipsis, so the row stays about as wide as the buttons under it
  const MAX_LABEL = 10;
  const { normalize, cardSemester } = window.ConnectifyUtils;

  // Same cleaning as the grade snapshot: no semester suffix, ATAR or year level
  const cleanName = title => normalize(
    String(title || '')
      .replace(/\s*[-–—]\s*Sem(?:ester)?\s*[12].*$/i, '')
      .replace(/\s*[(]?\s*Sem(?:ester)?\s*[12][^)]*\)?/gi, '')
      .replace(/\bATAR\b/gi, '')
      .replace(/\bYear\s*\d+\b/gi, '')
  ) || normalize(title);

  const label = name => (name.length > MAX_LABEL ? `${name.slice(0, MAX_LABEL - 1).trimEnd()}…` : name);

  function option(name) {
    const opt = new Option(label(name), name);
    opt.title = name;
    return opt;
  }

  /**
   * Shown outlines as [{ name, card }], one per subject in page order. A subject with both semesters' outlines
   * shown jumps to this semester's.
   */
  function subjects() {
    const current = window.ConnectifySemesterFilter?.currentSemester?.() || null;
    const byName = new Map();
    for (const card of document.querySelectorAll(TILE_SELECTOR)) {
      if (card.classList.contains('cx-semester-hidden')) continue;
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

  /** Rewrites the dropdown's options only when the subject list changed, keeping the chosen subject. */
  function sync() {
    const select = document.getElementById('cx-jump-subject-select');
    if (!select) return;
    const names = subjects().map(s => s.name);
    const signature = names.join('\n');
    if (select._cxSignature === signature) return;
    select._cxSignature = signature;
    const chosen = select.value;
    select.replaceChildren(...names.map(option));
    if (names.includes(chosen)) select.value = chosen;
    select.disabled = names.length === 0;
    const btn = document.getElementById('cx-jump-subject-btn');
    if (btn) btn.disabled = names.length === 0;
  }

  /** The dropdown and Jump To button row. */
  function create() {
    const row = document.createElement('div');
    row.id = 'cx-jump-subject';
    const select = document.createElement('select');
    select.id = 'cx-jump-subject-select';
    select.className = 'cx-jump-subject-select';
    select.setAttribute('aria-label', 'Subject to jump to');
    // Tiles can change between passes: refresh the list as the student opens it
    select.addEventListener('pointerdown', sync);
    select.addEventListener('focus', sync);
    const btn = document.createElement('button');
    btn.id = 'cx-jump-subject-btn';
    btn.type = 'button';
    btn.className = 'eds-c-button cx-jump-subject-btn';
    btn.textContent = 'Jump To';
    btn.onclick = () => jump(select.value);
    row.append(select, btn);
    return row;
  }

  window.ConnectifyOutlineJump = { create, sync, subjects, cleanName, label, jump, MAX_LABEL };
})();

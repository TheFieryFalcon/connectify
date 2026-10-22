/**
 * Connectify Assessment: "Show this semester's classes only"
 *
 * Setting connectify:semester_filter = { enabled } (off by default). While on, the current semester is
 * always the detected one (ConnectifyClassSemesters.detectSemester): the other semester's outline tiles
 * are hidden, only this semester's cards refresh the cache (the other semester's cached results stay,
 * frozen) and sidebar tools list only this semester's classes. Exposes window.ConnectifySemesterFilter.
 */
(() => {
  'use strict';

  if (window.ConnectifySemesterFilter) return;

  const KEY = 'connectify:semester_filter';
  const HIDDEN = 'cx-semester-hidden';
  const CARD_SELECTOR = '.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile';
  const registry = () => window.ConnectifyClassSemesters;
  /** The current semester (1 or 2), detected from the outlines. */
  const currentSemester = () => registry()?.detectSemester?.() || 1;

  function readSetting() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
    return { enabled: false };
  }

  const isEnabled = () => readSetting().enabled === true;
  /** The semester being filtered to, or null when the option is off. */
  const activeSemester = () => (isEnabled() ? currentSemester() : null);

  function save(enabled) {
    try { localStorage.setItem(KEY, JSON.stringify({ enabled: Boolean(enabled) })); } catch {}
  }

  // Tiles naming no semester belong to both
  function allowsCardIn(card, active) {
    if (!active) return true;
    const semester = registry()?.cardInfo?.(card)?.semester;
    return !semester || semester === active;
  }
  const allowsCard = card => allowsCardIn(card, activeSemester());
  const allowedCards = cards => {
    const active = activeSemester();
    return active ? cards.filter(card => allowsCardIn(card, active)) : cards;
  };

  // Subjects the registry has never seen (older caches) stay listed
  function includesSubject(name, active, reg) {
    const entry = reg?.[name];
    return !entry || Boolean(entry[active]);
  }

  /** Subjects (collect() records) of the active semester's classes, with all of their cached tasks. */
  function filterSubjects(subjects) {
    const active = activeSemester();
    if (!active || !Array.isArray(subjects)) return subjects;
    const reg = registry()?.get?.() || {};
    return subjects.filter(s => includesSubject(s?.name, active, reg));
  }

  /**
   * readCourses() [[Semester 1], [Semester 2]] limited to the active semester's classes: the other
   * semester keeps (from the frozen cache) only the classes that continue into the active one.
   */
  function filterCourses(courses) {
    const active = activeSemester();
    if (!active || !Array.isArray(courses)) return courses;
    const keep = new Set((courses[active - 1] || []).map(c => c.id));
    return courses.map((list, i) => (i === active - 1 ? list : (list || []).filter(c => keep.has(c.id))));
  }

  // Connectify's own nodes (e.g. compound progress bars) can sit beside a tile
  const isOwnNode = el => /(^|\s)(cx-|connectify|connectea)/.test(el.className || '') || /^(cx-|connectify)/.test(el.id || '');

  // The tile and its layout slot, when the slot holds only that tile, so no gap is left behind
  function hideTargets(tile) {
    const slot = tile.parentElement;
    const lonelySlot = slot?.classList?.contains('v-slot') && Array.from(slot.children).every(c => c === tile || isOwnNode(c));
    return lonelySlot ? [tile, slot] : [tile];
  }

  /**
   * Hides the other semester's outline tiles (and shows them all when the option is off). Only tiles
   * whose state changes are touched, so re-renders never make hidden tiles flash. When every outline in
   * view is hidden (e.g. a Connect filter picked a class with no outline this semester), a notice
   * takes their place (ConnectifySemesterFilterNotice).
   */
  function applyToPage() {
    const active = activeSemester();
    const hide = new Set();
    let firstHidden = null, shown = 0, hidden = 0;
    if (active) {
      for (const tile of document.querySelectorAll(CARD_SELECTOR)) {
        if (tile.parentElement?.closest?.(CARD_SELECTOR)) continue;
        if (allowsCardIn(tile, active)) { shown++; continue; }
        hidden++;
        const targets = hideTargets(tile);
        targets.forEach(el => hide.add(el));
        firstHidden = firstHidden || targets[targets.length - 1];
      }
    }
    for (const el of document.querySelectorAll(`.${HIDDEN}`)) if (!hide.has(el)) el.classList.remove(HIDDEN);
    for (const el of hide) if (!el.classList.contains(HIDDEN)) el.classList.add(HIDDEN);
    window.ConnectifySemesterFilterNotice?.update?.(shown ? null : firstHidden, active, hidden);
  }

  const addsElements = rec => rec.type === 'childList' && Array.from(rec.addedNodes || []).some(n => n.nodeType === 1);
  window.ConnectifyScheduler?.onMutations?.(() => { if (isEnabled() || document.querySelector(`.${HIDDEN}`)) applyToPage(); }, { filter: addsElements });
  applyToPage();

  window.ConnectifySemesterFilter = {
    KEY, HIDDEN, readSetting, isEnabled, currentSemester, activeSemester, save,
    allowsCard, allowedCards, filterSubjects, filterCourses, applyToPage
  };
})();

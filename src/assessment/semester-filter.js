/**
 * Connectify Assessment: "Show [Semester N] classes only"
 *
 * Setting connectify:semester_filter = { enabled, semester, period } (off by default). While on, the
 * other semester's outline tiles are hidden, only the chosen semester's cards refresh the cache (the
 * other semester's cached results stay, frozen) and sidebar tools list only the chosen semester's
 * classes. A saved pick lasts for the school period (year and detected semester) it was made in, then
 * the dropdown follows detection again.
 * Exposes window.ConnectifySemesterFilter.
 */
(() => {
  'use strict';

  if (window.ConnectifySemesterFilter) return;

  const KEY = 'connectify:semester_filter';
  const HIDDEN = 'cx-semester-hidden';
  const CARD_SELECTOR = '.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile';
  const registry = () => window.ConnectifyClassSemesters;
  const detect = () => registry()?.detectSemester?.() || 1;
  // With two semesters, "detection changed" alone cannot tell a new year from the same semester
  const period = semester => `${new Date().getFullYear()}-${semester}`;

  function readSetting() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
    return { enabled: false };
  }

  /** The semester shown in the dropdown: the saved pick, unless the school period has moved on. */
  function chosenSemester() {
    const setting = readSetting();
    const detected = detect();
    const pick = Number(setting.semester);
    return (pick === 1 || pick === 2) && setting.period === period(detected) ? pick : detected;
  }

  const isEnabled = () => readSetting().enabled === true;
  /** The semester being filtered to, or null when the option is off. */
  const activeSemester = () => (isEnabled() ? chosenSemester() : null);

  function save(enabled, semester) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ enabled: Boolean(enabled), semester: Number(semester) === 2 ? 2 : 1, period: period(detect()) }));
    } catch {}
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

  /** Hides the other semester's outline tiles (and shows them all when the option is off). */
  function applyToPage() {
    const active = activeSemester();
    for (const el of document.querySelectorAll(`.${HIDDEN}`)) el.classList.remove(HIDDEN);
    if (!active) return;
    for (const tile of document.querySelectorAll(CARD_SELECTOR)) {
      if (tile.parentElement?.closest?.(CARD_SELECTOR)) continue;
      if (!allowsCardIn(tile, active)) hideTargets(tile).forEach(el => el.classList.add(HIDDEN));
    }
  }

  const addsElements = rec => rec.type === 'childList' && Array.from(rec.addedNodes || []).some(n => n.nodeType === 1);
  window.ConnectifyScheduler?.onMutations?.(() => { if (isEnabled() || document.querySelector(`.${HIDDEN}`)) applyToPage(); }, { filter: addsElements });
  applyToPage();

  window.ConnectifySemesterFilter = {
    KEY, HIDDEN, readSetting, isEnabled, chosenSemester, activeSemester, save,
    allowsCard, allowedCards, filterSubjects, filterCourses, applyToPage
  };
})();

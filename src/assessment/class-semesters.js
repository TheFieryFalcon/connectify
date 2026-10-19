/**
 * Connectify Assessment: class registry by semester
 *
 * Which semester outlines each class has, with each card's overall mark, final A–E letter and the
 * tasks it lists: { subject: { 1: { title, mark, finalLetter, tasks: [[id, name]] }, 2: {...} } },
 * persisted at connectify:class_semesters:<student> (written only on change). The subjects cache merges
 * both semesters under one name, so sidebar tools read semester groupings from here instead of the
 * outline tiles. Also detects the current semester (Semester 2 once any class shows a final Semester 1
 * grade). Exposes window.ConnectifyClassSemesters.
 */
(() => {
  'use strict';

  if (window.ConnectifyClassSemesters) return;

  const { normalize, accountKey } = window.ConnectifyUtils;
  const CARD_SELECTOR = '.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile';
  const TITLE_SELECTOR = '.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading';
  const PREFIX = 'connectify:class_semesters:';
  const storageKey = () => `${PREFIX}${accountKey()}`;

  let registry = null;
  let savedJson = '';

  function load() {
    if (registry) return registry;
    registry = {};
    try {
      const raw = localStorage.getItem(storageKey());
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        registry = parsed;
        savedJson = raw;
      }
    } catch {}
    return registry;
  }

  function save() {
    const json = JSON.stringify(registry || {});
    if (json === savedJson) return;
    savedJson = json;
    try { localStorage.setItem(storageKey(), json); } catch {}
  }

  const cardTitle = card => normalize(
    card.querySelector(TITLE_SELECTOR)?.textContent || card.getAttribute('data-subject-title') || card.getAttribute('aria-label') || ''
  );

  // A card element keeps its title, so it is read once (collect() runs on every cohort pass)
  const infoCache = new WeakMap();
  /** { title, subject, semester } for a card; semester is null when the title names none. */
  function cardInfo(card) {
    if (infoCache.has(card)) return infoCache.get(card);
    const title = cardTitle(card);
    const match = title.match(/\bSem(?:ester)?\s*([12])\b/i);
    const subject = title.replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '').replace(/\s*[-–—]\s*Sem\s*[12].*$/i, '').trim();
    const info = { title, subject, semester: match ? Number(match[1]) : null };
    if (title) infoCache.set(card, info);
    return info;
  }

  // The overall row sits outside .cvr-c-tasks and is rendered even while the card is collapsed
  function cardSummary(card) {
    const summaryRow = Array.from(card.querySelectorAll('.cvr-c-task')).find(row => !row.closest('.cvr-c-tasks'));
    const cells = Array.from(summaryRow?.querySelectorAll('.cvr-c-task__marks .cvr-c-task__mark') || []);
    const markMatch = normalize(cells[0]?.textContent).match(/(-?\d+(?:\.\d+)?)\s*%/);
    return {
      mark: markMatch ? Number(markMatch[1]) : null,
      finalLetter: cells.some(c => /^[ABCDE]$/i.test(normalize(c.textContent)))
    };
  }

  function entryFor(subject, semester) {
    const reg = load();
    reg[subject] = reg[subject] || {};
    reg[subject][semester] = reg[subject][semester] || { title: '', mark: null, finalLetter: false, tasks: [] };
    return reg[subject][semester];
  }

  /**
   * A page whose classes share no name with the registry is a new school year or an earlier one.
   * The year rollover decides: a new year turns last year's averages into baselines and archives and
   * clears last year's results (this registry too); an earlier year is not recorded.
   */
  function acceptsClassSet(cards) {
    const known = Object.keys(load());
    const live = [...new Set(cards.map(c => cardInfo(c)).filter(i => i.subject && i.semester).map(i => i.subject))];
    if (!known.length || live.length < 2 || live.some(s => known.includes(s))) return true;
    const kind = window.ConnectifyYearRollover?.handleClassChange?.(live, known);
    return kind !== 'other-year' && kind !== 'restricted';
  }

  // Cards already recorded; a card is read again only when it is scraped (force)
  const recorded = new WeakSet();

  /** Records each new card's title, overall mark and final letter (tasks are kept from the last scrape). */
  function recordCards(cards, force = false) {
    const fresh = force ? cards : cards.filter(card => !recorded.has(card));
    if (!fresh.length) return;
    const accepted = acceptsClassSet(cards);
    fresh.forEach(card => recorded.add(card));
    if (!accepted) return;
    for (const card of fresh) {
      const { title, subject, semester } = cardInfo(card);
      if (!subject || !semester) continue;
      const entry = entryFor(subject, semester);
      const { mark, finalLetter } = cardSummary(card);
      entry.title = title;
      // A collapsed or still-rendering card shows no mark; the last one read stays
      if (mark !== null) entry.mark = mark;
      entry.finalLetter = finalLetter || (mark === null && entry.finalLetter);
    }
    save();
  }

  /** Records the tasks one card listed when it was scraped. */
  function recordTasks(subject, semester, tasks) {
    if (!subject || !semester || !tasks?.length) return;
    entryFor(subject, semester).tasks = tasks.map(t => [t.id, t.name]);
    save();
  }

  /** Subject names with an outline in the given semester. */
  const classesIn = semester => Object.keys(load()).filter(s => load()[s]?.[semester]);

  // Semester 2 starts only once a class has a final A–E grade. Marks never count: a Semester 2 panel's
  // cumulative percent and its Semester 1 task rows are marked from day one, and a Semester 2 task can
  // be marked before Semester 1 grades are final. (A letter on a Semester 2 card means the year is over.)
  function evidenceFromPage() {
    const cards = Array.from(document.querySelectorAll(CARD_SELECTOR)).filter(card => cardInfo(card).semester);
    if (!cards.length) return null;
    return cards.some(card => cardSummary(card).finalLetter) ? 2 : 1;
  }

  function evidenceFromRegistry() {
    return Object.values(load()).some(e => e?.[1]?.finalLetter || e?.[2]?.finalLetter) ? 2 : 1;
  }

  let detected = null;
  let detectedAt = 0;
  /** Current semester (1 or 2), re-read from the page at most once a second. */
  function detectSemester() {
    const now = Date.now();
    if (detected && now - detectedAt < 1000) return detected;
    detected = evidenceFromPage() || evidenceFromRegistry();
    detectedAt = now;
    return detected;
  }

  function clear() {
    registry = {};
    savedJson = '';
    detected = null;
    try { window.ConnectifyUtils.removeStorageKeys(k => k.startsWith(PREFIX)); } catch {}
  }

  window.ConnectifyClassSemesters = {
    PREFIX, cardInfo, cardSummary, recordCards, recordTasks, classesIn, detectSemester, clear,
    get: () => load()
  };
})();

/**
 * Connectify Assessment: class registry by semester
 *
 * Which semester outlines each class has, with each card's overall mark, final A–E letter and the
 * tasks it lists: { subject: { 1: { title, mark, finalLetter, tasks: [[id, name]] }, 2: {...} } },
 * persisted at connectify:class_semesters:<student> (written only on change). The subjects cache merges
 * both semesters under one name, so sidebar tools read semester groupings from here instead of the
 * outline tiles. Also detects the current semester (Semester 2 once any class shows a final Semester 1
 * grade). Cards are Connect's API records once loaded (outline-api.js), else its tiles.
 * Exposes window.ConnectifyClassSemesters.
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
    // Connect's API records (outline-api.js) name their class and semester
    if (card?.apiOutline) return { title: card.title, subject: card.subject, semester: card.semester };
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
    const api = window.ConnectifyApiParse;
    if (card?.apiOutline && api) return { mark: api.overallMark(card), finalLetter: api.hasFinalLetter(card) };
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

  const SEMESTER_KEY = 'connectify:current_semester';

  function isNewYear() {
    if (window.ConnectifyUtils?.isOutlinesPage?.() === false) return false;
    const records = window.ConnectifyOutlineApi?.drawable?.() || [];
    const cards = records.length ? records : (typeof document !== 'undefined' ? Array.from(document.querySelectorAll(CARD_SELECTOR)).filter(card => cardInfo(card).semester) : []);
    if (!cards.length) return false;
    const known = Object.keys(load());
    if (!known.length) return false;
    const live = [...new Set(cards.map(card => cardInfo(card).subject).filter(Boolean))];
    if (live.length && !live.some(s => known.includes(s))) {
      return true;
    }
    return false;
  }

  function isSemesterTwoCutoff(date = new Date(Date.now())) {
    const terms = window.ConnectifySchoolTerms;
    const helpers = window.ConnectifyParseHelpers;
    if (terms) {
      const order = terms.orderOf(date);
      const cutoff = helpers?.semesterTwoOrder ? helpers.semesterTwoOrder(date.getFullYear()) : (terms.weekOrder ? terms.weekOrder(helpers?.SEMESTER_TWO_WEEK ?? 17, date.getFullYear()) : 19);
      if (Number.isFinite(order) && Number.isFinite(cutoff)) {
        return order >= cutoff;
      }
      const sw = terms.schoolWeek ? terms.schoolWeek(order, date.getFullYear()) : null;
      if (Number.isFinite(sw)) {
        return sw >= (helpers?.SEMESTER_TWO_WEEK ?? 17);
      }
    }
    return date.getMonth() >= 5;
  }

  function evidenceFromPage() {
    if (!window.ConnectifyUtils.isOutlinesPage()) return null;
    const records = window.ConnectifyOutlineApi?.drawable?.() || [];
    if (records.length) return records.some(r => cardSummary(r).finalLetter || r?.semester === 2) ? 2 : 1;
    const cards = Array.from(document.querySelectorAll(CARD_SELECTOR)).filter(card => cardInfo(card).semester);
    if (!cards.length) return null;
    if (cards.some(card => cardSummary(card).finalLetter)) return 2;
    return isNewYear() ? 1 : null;
  }

  let detected = null;
  let detectedAt = 0;

  function setSemester(sem) {
    const s = Number(sem) === 1 ? 1 : 2;
    detected = s;
    detectedAt = Date.now();
    try { localStorage.setItem(SEMESTER_KEY, String(s)); } catch {}
    return s;
  }

  /**
   * Sets the current semester using existing semester cutoff times instead of searching for letter grades.
   * If the current school week is in Semester 2, set the current semester to 2; if a new year is detected, set to 1.
   */
  function detectSemester(forDate = new Date(Date.now())) {
    const now = Date.now();
    if (detected && now - detectedAt < 1000) return detected;

    if (isNewYear()) {
      return setSemester(1);
    }

    if (window.ConnectifySchoolTerms || window.ConnectifyParseHelpers) {
      return setSemester(isSemesterTwoCutoff(forDate) ? 2 : 1);
    }

    const fromPage = evidenceFromPage();
    if (fromPage !== null) return setSemester(fromPage);
    return setSemester(isSemesterTwoCutoff(forDate) ? 2 : 1);
  }

  // Connect's first outlines decide at once (startup Expand All hides the other semester's tiles first)
  window.addEventListener('connectify-outlines-preview', () => { detected = null; });

  function clear() {
    registry = {};
    savedJson = '';
    detected = null;
    try { window.ConnectifyUtils.removeStorageKeys(k => k.startsWith(PREFIX)); } catch {}
  }

  window.ConnectifyClassSemesters = {
    PREFIX, SEMESTER_KEY, cardInfo, cardSummary, recordCards, recordTasks, classesIn, detectSemester, setSemester, isSemesterTwoCutoff, clear,
    get: () => load()
  };
})();

/**
 * Connectify School Terms
 *
 * Generated WA school-term calendar, shared by the caption parser (a date caption's term and week) and
 * the assessment export. Term 1 starts on the Monday falling 1–4 Feb, else the Wednesday falling
 * 31 Jan–3 Feb (Week 1 is then Wed–Fri). Terms are 10 weeks with 2-week breaks; Early Easter makes
 * Term 1 nine weeks and Term 2 eleven (Terms 3 and 4 unchanged), and is on by default when Easter
 * Monday falls in Term 1 Week 10 (the student's choice is kept per year). Dates are UTC midnight.
 * Exposes window.ConnectifySchoolTerms.
 */
(() => {
  'use strict';

  if (window.ConnectifySchoolTerms) return;

  const DAY = 86400000;
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const utc = (year, month, day) => new Date(Date.UTC(year, month, day));
  const addDays = (date, days) => new Date(date.getTime() + days * DAY);
  const mondayOf = date => addDays(date, -((date.getUTCDay() + 6) % 7));

  function term1Start(year) {
    for (let day = 1; day <= 4; day++) {
      const date = utc(year, 1, day);
      if (date.getUTCDay() === 1) return date;
    }
    // No Monday on 1–4 Feb: the Wednesday falling 31 Jan–3 Feb (there is always one)
    for (let day = 31; day <= 34; day++) {
      const date = utc(year, 0, day);
      if (date.getUTCDay() === 3) return date;
    }
    return null;
  }

  /** Easter Monday by the anonymous Gregorian computus. */
  function easterMonday(year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return addDays(utc(year, month - 1, day), 1);
  }

  /** On when Easter Monday falls in Term 1 Week 10, so the holidays would otherwise start a week after Easter. */
  function autoEarlyEaster(year) {
    const week10 = addDays(mondayOf(term1Start(year)), 63);
    const monday = easterMonday(year);
    return monday >= week10 && monday <= addDays(week10, 4);
  }

  /** The four terms: first school day, Monday of Week 1, number of weeks and first school week of the year (1-40). */
  function terms(year, early) {
    const start = term1Start(year);
    const week1 = mondayOf(start);
    const monday = weeks => addDays(week1, weeks * 7);
    return [
      { term: 1, start, monday: week1, weeks: early ? 9 : 10, yearWeek: 1 },
      { term: 2, start: monday(early ? 11 : 12), monday: monday(early ? 11 : 12), weeks: early ? 11 : 10, yearWeek: early ? 10 : 11 },
      { term: 3, start: monday(24), monday: monday(24), weeks: 10, yearWeek: 21 },
      { term: 4, start: monday(36), monday: monday(36), weeks: 10, yearWeek: 31 }
    ];
  }

  /**
   * The date of a weekday (1 = Mon .. 5 = Fri) in school week `week` of `term`. A week past its term's
   * length spills into the next term (Term 1 Week 10 under Early Easter is Term 2 Week 1); past Term 4
   * gives null. A day before Term 1 starts (Mon/Tue of a Wednesday-start Week 1) moves to the start day.
   */
  function dateFor(year, term, week, weekday, early) {
    const list = terms(year, early);
    let t = Number(term), w = Number(week);
    if (!Number.isInteger(t) || !Number.isInteger(w) || t < 1 || w < 1) return null;
    while (t <= 4 && w > list[t - 1].weeks) {
      w -= list[t - 1].weeks;
      t++;
    }
    if (t > 4) return null;
    const day = Math.min(5, Math.max(1, Number(weekday) || 1));
    const date = addDays(list[t - 1].monday, (w - 1) * 7 + day - 1);
    return date < list[t - 1].start ? list[t - 1].start : date;
  }

  // The student's Early Easter choice per year; the export stored it with its own choices at first
  const STORAGE_KEY = 'connectify:school_terms';
  const readJson = key => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch { return {}; }
  };

  /** Early Easter for `year`: the student's choice, else the automatic value. */
  function earlyEaster(year) {
    const saved = readJson(STORAGE_KEY).earlyEaster?.[year];
    if (typeof saved === 'boolean') return saved;
    const account = window.ConnectifyUtils?.accountKey?.();
    const legacy = account ? readJson(`connectify:calendar_export:${account}`).earlyEaster?.[year] : undefined;
    return typeof legacy === 'boolean' ? legacy : autoEarlyEaster(year);
  }

  function setEarlyEaster(year, on) {
    const prefs = readJson(STORAGE_KEY);
    prefs.earlyEaster = { ...(prefs.earlyEaster || {}), [year]: Boolean(on) };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch {}
  }

  /**
   * A date's chronological order in the Progress graph's 12 slots per term: (term - 1) * 12 + week.
   * Holidays count on from the term before (Term 1 Week 11), never past slot 12; dates before Term 1
   * are Week 1.
   */
  function orderOf(date, early = earlyEaster(date.getUTCFullYear())) {
    const list = terms(date.getUTCFullYear(), early);
    if (date < list[0].start) return 1;
    let i = 0;
    while (i < 3 && date >= list[i + 1].monday) i++;
    const week = Math.floor((date - list[i].monday) / (7 * DAY)) + 1;
    return i * 12 + Math.min(12, Math.max(1, week));
  }

  /**
   * A 12-slot order (Term 1 Week 10 -> 10) with a week past its term's length moved into the next term,
   * as dateFor places it: under Early Easter Term 1 has nine weeks, so Term 1 Week 10 is Term 2 Week 1.
   * Past Term 4 it is left as it is.
   */
  function normalizeOrder(order, year = new Date().getFullYear(), early = earlyEaster(year)) {
    if (!Number.isFinite(order) || order < 1) return order;
    const list = terms(year, early);
    let t = Math.floor((order - 1) / 12) + 1;
    let w = order - (t - 1) * 12;
    while (t <= 4 && w >= list[t - 1].weeks + 1) {
      w -= list[t - 1].weeks;
      t++;
    }
    return t > 4 ? order : (t - 1) * 12 + w;
  }

  /**
   * The 12-slot order of school week `n` of the year, counted through the terms as the Export's term
   * list numbers them (under Early Easter Term 1 is Weeks 1-9 and Term 2 starts at Week 10). Weeks past
   * Term 4's last run on in Term 4. Null for anything but a positive number.
   */
  function weekOrder(n, year = new Date().getFullYear(), early = earlyEaster(year)) {
    if (!Number.isFinite(n) || n < 1) return null;
    const list = terms(year, early);
    let i = 3;
    while (i > 0 && n < list[i].yearWeek) i--;
    return i * 12 + (n - list[i].yearWeek + 1);
  }

  /** The school week of the year for a 12-slot order (the inverse of weekOrder: Term 4 runs on past Week 40). */
  function schoolWeek(order, year = new Date().getFullYear(), early = earlyEaster(year)) {
    const n = normalizeOrder(order, year, early);
    if (!Number.isFinite(n) || n < 1) return null;
    const t = Math.min(4, Math.floor((n - 1) / 12) + 1);
    return terms(year, early)[t - 1].yearWeek + Math.round(n - (t - 1) * 12) - 1;
  }

  /** "25 May" */
  const formatDate = date => `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
  /** "Mon 25 May" */
  const formatDay = date => `${WEEKDAYS[date.getUTCDay()]} ${formatDate(date)}`;

  window.ConnectifySchoolTerms = {
    term1Start, easterMonday, autoEarlyEaster, earlyEaster, setEarlyEaster, terms, dateFor, orderOf, normalizeOrder, weekOrder, schoolWeek, formatDate, formatDay, addDays, utc
  };
})();

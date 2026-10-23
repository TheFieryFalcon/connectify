/**
 * Connectify School Terms
 *
 * Generated WA school-term calendar for the assessment export. Term 1 starts on the Monday falling
 * 1–4 Feb, else the Wednesday falling 31 Jan–3 Feb (Week 1 is then Wed–Fri). Terms are 10 weeks with
 * 2-week breaks; Early Easter makes Term 1 nine weeks and Term 2 eleven (Terms 3 and 4 unchanged), and
 * is on by default when Easter Monday falls in Term 1 Week 10. Dates are UTC midnight.
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

  /** The four terms: first school day, Monday of Week 1 and number of weeks. */
  function terms(year, early) {
    const start = term1Start(year);
    const week1 = mondayOf(start);
    const monday = weeks => addDays(week1, weeks * 7);
    return [
      { term: 1, start, monday: week1, weeks: early ? 9 : 10 },
      { term: 2, start: monday(early ? 11 : 12), monday: monday(early ? 11 : 12), weeks: early ? 11 : 10 },
      { term: 3, start: monday(24), monday: monday(24), weeks: 10 },
      { term: 4, start: monday(36), monday: monday(36), weeks: 10 }
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

  /** "Mon 25 May" */
  const formatDay = date => `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;

  window.ConnectifySchoolTerms = { term1Start, easterMonday, autoEarlyEaster, terms, dateFor, formatDay, addDays, utc };
})();

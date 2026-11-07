/**
 * Connectify: the TEA bonus once subject bonuses end. The 10% bonuses for Methods, Specialist and a language are phased
 * out from the class of 2028 (students finishing Year 12 in 2028). TISC's TEA-to-ATAR table was built on TEAs that
 * carried those bonuses, so a student from that class adds no subject bonus; the TEA is raised instead by the share of
 * TEA that students with that best-four TEA typically earned in bonuses: stronger students took Methods and Specialist
 * far more often, and scored higher in them.
 *
 * The rates are an estimate of expected bonus / best-four TEA: for an average scaled score s (TEA ~ 4s), the chance of
 * taking Methods, Specialist and a language (roughly 15%, 2%, 3% at s = 50 rising to 90%, 65%, 20% at s = 92), the best
 * two worth 10% of s each. The ceiling is 5%: two bonus courses at the student's own average.
 */
(function () {
  'use strict';

  /** [best-four TEA, bonus as a share of it]; linear between points, flat past the ends (0 below the first). */
  const RATES = [
    [140, 0],
    [200, 0.005],
    [250, 0.012],
    [300, 0.0225],
    [340, 0.034],
    [370, 0.0425],
    [400, 0.045]
  ];

  function rate(baseTEA) {
    const tea = Number(baseTEA);
    if (!Number.isFinite(tea) || tea <= RATES[0][0]) return 0;
    for (let i = 1; i < RATES.length; i++) {
      const [x1, y1] = RATES[i];
      if (tea <= x1) {
        const [x0, y0] = RATES[i - 1];
        return y0 + ((tea - x0) / (x1 - x0)) * (y1 - y0);
      }
    }
    return RATES[RATES.length - 1][1];
  }

  /** The typical bonus at a best-four TEA, to one decimal place. */
  function bonus(baseTEA) {
    return Math.round(Number(baseTEA) * rate(baseTEA) * 10) / 10 || 0;
  }

  /** The first class (year finishing Year 12) without subject bonuses. */
  const FIRST_CLASS = 2028;

  const YEAR_11 = /\b(?:year|yr)\s*11\b|^\s*11\s|\bAE[A-Z]{3}\b/i;
  const YEAR_12 = /\b(?:year|yr)\s*12\b|^\s*12\s|\bAT[A-Z]{3}\b/i;

  /** This year's class titles: the class registry (only this year's classes), else the outline tiles. */
  function titles() {
    const registry = window.ConnectifyClassSemesters?.get?.() || {};
    const named = Object.values(registry).flatMap(s => [s?.[1]?.title, s?.[2]?.title]).filter(Boolean);
    if (named.length) return named;
    return Array.from(document.querySelectorAll('.eds-c-tile__title')).map(el => el.textContent || '');
  }

  /** 11 when this year's classes are Year 11 and none Year 12, else 12. */
  function yearLevel(names = titles()) {
    return names.some(t => YEAR_11.test(t)) && !names.some(t => YEAR_12.test(t)) ? 11 : 12;
  }

  /**
   * The calendar year of this school year: one named in the class titles, else today's (a past year's last day while
   * one is viewed), plus one when this year's classes arrived in its second half (Year 12 courses start in Term 4).
   */
  function schoolYear(names = titles(), now = window.ConnectifyPastYearMode?.active?.() ? window.ConnectifyPastYearMode.today() : new Date()) {
    const named = window.ConnectifyYearArchive?.yearMarker?.(names)?.calendar;
    if (Number.isInteger(named)) return named;
    const year = now.getFullYear();
    const at = window.ConnectifyClassSemesters?.newYearAt?.();
    const start = at ? new Date(at) : null;
    return start && start.getFullYear() === year && start.getMonth() >= 6 && start <= now ? year + 1 : year;
  }

  /** The year this student finishes Year 12. */
  function classOf(names = titles(), now) {
    return schoolYear(names, now) + (12 - yearLevel(names));
  }

  /** Whether a class has no subject bonuses (from the class of 2028). */
  function phasedOut(year = classOf()) {
    return Number(year) >= FIRST_CLASS;
  }

  window.ConnectifyTypicalBonus = { RATES, FIRST_CLASS, rate, bonus, yearLevel, schoolYear, classOf, phasedOut };
})();

/**
 * Connectify Cohort: typical class sizes per subject
 *
 * Typical WA cohort sizes per subject (Year 12 / Year 11) for a school of 500 students with 60% on
 * the ATAR pathway, scaled to the student's General Cohort Size and ATAR percentage settings.
 * Used by cohort-estimator.js before boxplot spreads refine the estimate.
 * Exposes window.ConnectifyCohortSizeBaselines.
 */
(() => {
  'use strict';

  const englishAtar = (title, isATAR) => /\benglish atar\b/i.test(title) || (/\benglish\b/i.test(title) && isATAR && !/\badditional\b/i.test(title));

  // First match wins, so specific names come before the general ones they contain (Human Biology before Biology).
  // y12/y11 are sizes per 300 ATAR students; `size` is the same in both years; general courses scale with the non-ATAR pool
  const SUBJECTS = [
    { re: /\b(methods|mathematics methods)\b/i, y12: 180, y11: 219 },
    { re: /\bchemistry\b/i, y12: 170, y11: 224 },
    { re: /\bhuman biolog(y|ical)\b/i, y12: 140, y11: 183 },
    { re: /\b(mathematics applications?|applications?)\b/i, y12: 160, y11: 189 },
    { test: englishAtar, y12: 180, y11: 220 },
    { re: /\b(mathematics essentials?|essentials?)\b/i, size: 117, general: true },
    { re: /\bphysics\b/i, y12: 90, y11: 111 },
    { re: /\bmathematics specialist\b/i, y12: 45, y11: 64 },
    { re: /\bbiology\b/i, size: 61 },
    { re: /\bliterature\b/i, size: 52 },
    { re: /\beconomics\b/i, size: 44 },
    { re: /\b(accounting|accounting and finance)\b/i, size: 36 },
    { re: /\b(politics and law|politics & law)\b/i, size: 35 },
    { re: /\bpsychology\b/i, size: 45 },
    { re: /\b(physical education studies|pes)\b/i, size: 38 },
    { re: /\b(business management|bme)\b/i, size: 24 },
    { re: /\bmodern history\b/i, size: 15 },
    { re: /\bjapanese\b/i, size: 44 },
    { re: /\bfrench\b/i, size: 21 },
    { re: /\bitalian\b/i, size: 20 },
    { re: /\b(german|chinese|indonesian)\b/i, size: 22 },
    { re: /\bcomputer science\b/i, size: 11 },
    { re: /\bmusic\b/i, size: 10 },
    { re: /\b(eald|english as an additional)\b/i, size: 9 }
  ];

  /** Typical cohort size for a lower-case subject title without its semester suffix. */
  function baselineSize(cleanTitle, { isYear12, isATAR, totalStudents = 500, atarPct = 60 }) {
    const atarScale = (totalStudents * (atarPct / 100)) / 300;
    const generalScale = (totalStudents * (1 - atarPct / 100)) / 200;
    const entry = SUBJECTS.find(s => (s.test ? s.test(cleanTitle, isATAR) : s.re.test(cleanTitle)));
    if (!entry) return isATAR ? Math.round(50 * atarScale) : Math.max(5, Math.round(28 * generalScale));
    const size = entry.size ?? (isYear12 ? entry.y12 : entry.y11);
    return Math.round(size * (entry.general ? generalScale : atarScale));
  }

  window.ConnectifyCohortSizeBaselines = { SUBJECTS, baselineSize };
})();

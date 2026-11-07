#!/usr/bin/env node
/**
 * Derives ConnectifyTypicalBonus.RATES (src/atar/atar-typical-bonus.js) from TISC's published scaled-score statistics
 * bundled in src/atar/scaling-data.js (every ATAR course, 2023 to 2025: enrolments and scaled-score percentile curves).
 *
 * For each 10-mark band of scaled score s:
 *   students(s)  = every course's enrolments scoring in the band / courses per student
 *                  (courses per student = all enrolments / English, Literature and EAL/D enrolments: one English each)
 *   P_M, P_S, P_L = Methods, Specialist and language enrolments scoring in the band / students(s)
 *   E(s)        = expected bonus courses, the best two counting: P_M + P_S + P_L - P_S P_L
 *                  (Specialist students all take Methods; a language is taken independently of them)
 * A bonus course is worth 10% of its scaled score (~s), and the best-four TEA of a student averaging s is
 * 4 (s + d), d the lift of dropping a fifth course (courses per student - 4, times 0.29 of an 8-mark spread within a
 * student: the mean of the top four of five normals), so the bonus is 0.025 min(2, E) s / (s + d) of the best-four TEA.
 * Bands below 30 hold too few students to say anything and are left out (the first rate stands below them).
 *
 * Run `node scripts/derive-typical-bonus.js` to print the table; Test 359 checks RATES against it.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const BAND = 10;
const FIRST_BAND = 30;
const SPREAD_WITHIN_STUDENT = 8;
const ENGLISH = /^(English|English as an Additional Language or Dialect|Literature)$/;

function load() {
  const window = { ConnectifyUtils: { normalize: s => String(s || '').toLowerCase().trim() } };
  const context = vm.createContext({ window, console });
  for (const file of ['src/atar/scaling-data.js', 'src/atar/atar-math.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context);
  }
  return { data: window.ConnectifyScalingData, bonusType: window.ConnectifyMath.bonusType };
}

function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

/** Share of a course scoring at or below x: its published curve, else a normal on its mean and SD. */
function cdf(course, x) {
  const curve = course.curve;
  if (curve) {
    if (x <= curve[0][1]) return 0;
    if (x >= curve[curve.length - 1][1]) return 1;
    for (let i = 1; i < curve.length; i++) {
      if (x <= curve[i][1]) {
        const [p0, x0] = curve[i - 1];
        const [p1, x1] = curve[i];
        return p0 + ((x - x0) / (x1 - x0)) * (p1 - p0);
      }
    }
  }
  return 0.5 * (1 + erf((x - course.mean) / (course.sd * Math.SQRT2)));
}

function derive() {
  const { data, bonusType } = load();
  const kindOf = name => ({ 'mathematics methods': 'M', 'mathematics specialist': 'S', language: 'L' })[bonusType(name)] || '';
  const bands = [];
  for (let s = FIRST_BAND; s < 100; s += BAND) bands.push({ from: s, students: 0, M: 0, S: 0, L: 0 });
  let enrolments = 0;
  let english = 0;
  for (const year of Object.values(data)) {
    const courses = Object.entries(year.subjects).filter(([, c]) => c.curve || (Number.isFinite(c.mean) && Number.isFinite(c.sd)));
    const total = courses.reduce((sum, [, c]) => sum + c.n, 0);
    const students = courses.filter(([name]) => ENGLISH.test(name)).reduce((sum, [, c]) => sum + c.n, 0);
    enrolments += total;
    english += students;
    for (const [name, course] of courses) {
      const kind = kindOf(name);
      for (const band of bands) {
        const inBand = course.n * (cdf(course, band.from + BAND) - cdf(course, band.from));
        band.students += inBand / (total / students);
        if (kind) band[kind] += inBand;
      }
    }
  }
  const perStudent = enrolments / english;
  const lift = Math.max(0, perStudent - 4) * 0.29 * SPREAD_WITHIN_STUDENT;
  return bands.map(band => {
    const s = band.from + BAND / 2;
    const pm = Math.min(1, band.M / band.students);
    const ps = Math.min(pm, band.S / band.students);
    const pl = Math.min(1, band.L / band.students);
    const expected = pm + ps + pl - ps * pl;
    return {
      score: s,
      tea: Math.round(4 * (s + lift)),
      students: Math.round(band.students),
      methods: pm, specialist: ps, language: pl, expected,
      rate: Math.round(0.025 * Math.min(2, expected) * (s / (s + lift)) * 10000) / 10000
    };
  });
}

/** The table for atar-typical-bonus.js: [best-four TEA, rate], rising (a band below the one before keeps its rate). */
function rates(rows = derive()) {
  let best = 0;
  return rows.map(r => [r.tea, (best = Math.max(best, r.rate))]);
}

module.exports = { derive, rates };

if (require.main === module) {
  const rows = derive();
  console.log('score\tTEA\tstudents\tMethods\tSpecial\tLanguage\tE\trate');
  for (const r of rows) {
    console.log([r.score, r.tea, r.students, r.methods.toFixed(3), r.specialist.toFixed(3), r.language.toFixed(3), r.expected.toFixed(3), `${(r.rate * 100).toFixed(2)}%`].join('\t'));
  }
  console.log(`\nRATES = ${JSON.stringify(rates(rows))}`);
}

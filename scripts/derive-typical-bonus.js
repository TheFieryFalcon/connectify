#!/usr/bin/env node
/**
 * Derives ConnectifyTypicalBonus.RATES (src/atar/atar-typical-bonus.js): the share of best-four TEA that students at
 * each level earned in Methods, Specialist and language bonuses, from TISC's "WACE courses used in ATAR for 2025 school
 * leavers" (TR307C, 18/12/2025): for every course, the 2025 school leavers with an ATAR and a scaled score in it, and the
 * median ATAR of those using it.
 *
 * 1. Every school leaver's ATAR. English, Literature and EAL/D hold one course per student (N students, their median M
 *    the student-weighted mean of the three medians). The ATAR ranks the whole age cohort, so above M, where nearly
 *    every member of the cohort is an ATAR student, students are spread evenly (N/2 over 100 - M); below, they thin out
 *    linearly to none (the other N/2).
 * 2. Each bonus course's take-up at ATAR a: a logistic curve in a, fitted so the course has its TR307C number of
 *    students and half of them above its median ATAR. Languages without a median (under 5 students) take the shape of
 *    the fitted languages, scaled to their numbers. Which courses carry a bonus: atar-math.js's bonusType.
 * 3. Expected bonus courses E(a), the best two counting: P_M + P_S + P_L - P_S P_L (Specialist students all take
 *    Methods; a language is taken independently of them). Each is worth 10% of the course's scaled score, taken as the
 *    student's best-four average (TEA / 4), so the bonus is 0.025 min(2, E) of the best-four TEA.
 * 4. The best-four TEA at ATAR a: the TISC table's TEA for a (atar-math.js), less the typical bonus it carried.
 *
 * Run `node scripts/derive-typical-bonus.js` to print the table; Test 359 checks RATES against it.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

/** TR307C 2025: [course, students, median ATAR of those using it (null when under 5 students)]; English courses and
 *  every course atar-math.js may count as a language (the bonus filter below keeps only those). */
const TR307C_2025 = [
  ['English', 8445, 79.50], ['Literature', 1553, 88.95], ['English as an Additional Language or Dialect', 198, 79.85],
  ['Mathematics Methods', 3724, 92.55], ['Mathematics Specialist', 1179, 97.00],
  ['Arabic', 29, 83.15], ['Auslan', 11, 91.05], ['Bengali', 1, null], ['Bosnian', 1, null],
  ['Chinese: Background Language', 15, null], ['Chinese: First Language', 21, 85.45], ['Chinese: Second Language', 78, 97.00],
  ['Croatian', 1, null], ['Dutch', 2, null], ['Filipino', 2, null],
  ['French: Background Language', 7, 83.75], ['French: Second Language', 319, 94.05],
  ['German: Background Language', 13, 90.75], ['German: Second Language', 18, 96.80],
  ['Hebrew', 2, null], ['Hindi: Background Language', 30, 91.85], ['Hungarian', 1, null],
  ['Indonesian: Background Language', 8, 87.80], ['Indonesian: Second Language', 27, 78.80],
  ['Italian: Background Language', 6, null], ['Italian: Second Language', 160, 91.10],
  ['Japanese: Background Language', 16, 90.30], ['Japanese: Second Language', 240, 93.45],
  ['Korean: Background Language', 7, null], ['Korean: Second Language', 5, null],
  ['Modern Greek', 2, null], ['Persian', 2, null], ['Polish', 3, null], ['Portuguese', 1, null],
  ['Punjabi: Background Language', 8, 76.95], ['Russian', 6, null], ['Serbian', 2, null], ['Sinhala', 3, null],
  ['Spanish', 4, null], ['Swedish', 1, null], ['Tamil: Background Language', 16, 86.25], ['Turkish', 1, null],
  ['Vietnamese', 7, 88.05]
];

/** ATARs the table is drawn at. */
const ATARS = [50, 60, 70, 80, 85, 90, 93, 95, 97, 98, 99, 99.5];
const STEP = 0.1;

function load() {
  const window = { ConnectifyUtils: { normalize: s => String(s || '').toLowerCase().trim() } };
  const context = vm.createContext({ window, console });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/atar/atar-math.js'), 'utf8'), context);
  return window.ConnectifyMath;
}

/** Students per ATAR point: even above the median, thinning linearly below it. */
function atarDensity() {
  const english = TR307C_2025.slice(0, 3);
  const students = english.reduce((sum, [, n]) => sum + n, 0);
  const median = english.reduce((sum, [, n, m]) => sum + n * m, 0) / students;
  const top = students / 2 / (100 - median);
  const floor = median - students / top;
  const density = a => (a >= median ? top : a <= floor ? 0 : top * (a - floor) / (median - floor));
  const grid = [];
  for (let a = Math.max(0, floor); a <= 100 + 1e-9; a += STEP) grid.push([a, density(a) * STEP]);
  return { students, median, top, floor, grid };
}

const logistic = (alpha, beta, a) => 1 / (1 + Math.exp(-(alpha + beta * (a - 90))));

function bisect(f, lo, hi) {
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid)) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

/** The logistic take-up with n students over the grid and half of them above `median`. */
function fitTakeUp(grid, n, median) {
  const total = (alpha, beta) => grid.reduce((s, [a, w]) => s + w * logistic(alpha, beta, a), 0);
  const above = (alpha, beta) => grid.reduce((s, [a, w]) => s + (a >= median ? w * logistic(alpha, beta, a) : 0), 0);
  const alphaFor = beta => bisect(alpha => total(alpha, beta) >= n, -60, 60);
  const beta = bisect(b => above(alphaFor(b), b) >= n / 2, -2, 3);
  const alpha = alphaFor(beta);
  return a => logistic(alpha, beta, a);
}

function derive() {
  const math = load();
  const { students, median, top, floor, grid } = atarDensity();
  const take = {};
  for (const [name, n, m] of TR307C_2025.slice(3)) {
    const type = math.bonusType(name);
    if (type) take[name] = { type, n, median: m, curve: m == null ? null : fitTakeUp(grid, n, m) };
  }
  const courses = Object.values(take);
  const fitted = courses.filter(c => c.type === 'language' && c.curve);
  const fittedN = fitted.reduce((s, c) => s + c.n, 0);
  const unfittedN = courses.filter(c => c.type === 'language' && !c.curve).reduce((s, c) => s + c.n, 0);
  const share = (type, a) => courses.filter(c => c.type === type && c.curve).reduce((s, c) => s + c.curve(a), 0);
  const methods = a => Math.min(1, share('mathematics methods', a));
  const specialist = a => Math.min(methods(a), share('mathematics specialist', a));
  const language = a => Math.min(1, share('language', a) * (1 + unfittedN / fittedN));

  // The TEA the TISC table gives each ATAR
  const teaAt = atar => bisect(tea => Number(math.convertTEAtoATAR(tea)) >= atar, 0, 430);
  const rows = ATARS.map(atar => {
    const pm = methods(atar), ps = specialist(atar), pl = language(atar);
    const expected = pm + ps + pl - ps * pl;
    const rate = 0.025 * Math.min(2, expected);
    const tea = teaAt(atar);
    return { atar, tea: Math.round(tea / (1 + rate)), methods: pm, specialist: ps, language: pl, expected, rate: Math.round(rate * 10000) / 10000 };
  });
  return { students, median, top, floor, rows };
}

/** The table for atar-typical-bonus.js: [best-four TEA, rate], rising. */
function rates(rows = derive().rows) {
  let best = 0;
  return rows.map(r => [r.tea, (best = Math.max(best, r.rate))]);
}

module.exports = { TR307C_2025, derive, rates };

if (require.main === module) {
  const { students, median, top, floor, rows } = derive();
  console.log(`${students} students, median ATAR ${median.toFixed(2)}: ${top.toFixed(0)} per ATAR point above it, none below ${floor.toFixed(1)}\n`);
  console.log('ATAR\tTEA\tMethods\tSpecial\tLanguage\tE\trate');
  for (const r of rows) {
    console.log([r.atar, r.tea, r.methods.toFixed(3), r.specialist.toFixed(3), r.language.toFixed(3), r.expected.toFixed(3), `${(r.rate * 100).toFixed(2)}%`].join('\t'));
  }
  console.log(`\nRATES = ${JSON.stringify(rates(rows))}`);
}

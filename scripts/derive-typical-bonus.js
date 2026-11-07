#!/usr/bin/env node
/**
 * Derives ConnectifyTypicalBonus.RATES (src/atar/atar-typical-bonus.js): the share of best-four TEA that students at
 * each level earned in Methods, Specialist and language bonuses, from two TISC tables for 2025 school leavers:
 * "WACE courses used in ATAR" (TR307C, 18/12/2025: for every course, the students with an ATAR and a scaled score in it,
 * and the median ATAR of those using it) and the "ATAR Distribution for ATAR Calculator Population" (18/12/2025: how many
 * students got each ATAR, data/tisc-atar-frequency-2025.json).
 *
 * 1. Every school leaver's ATAR: the published distribution (10,265 students), scaled to TR307C's 10,196 (English,
 *    Literature and EAL/D hold one course per student; TR307C leaves out mature age and international students).
 * 2. Each bonus course's take-up at ATAR a: a logistic curve in a, fitted so the course has its TR307C number of
 *    students, with half of those using it in their ATAR above their median and every student who took it without
 *    using it above it too: a course left out of the best four was beaten by four others, so its students rank higher. Languages without a median (under 5 students) take the shape of
 *    the fitted languages, scaled to their numbers. Which courses carry a bonus: atar-math.js's bonusType.
 * 3. Expected bonus courses E(a): only the best two of Methods, Specialist and a language earn a bonus, so a student
 *    with all three counts two. E = P_M + P_S + P_L - P(all three), with P(all three) = P_S P_L (Specialist students
 *    all take Methods; a language is taken independently of them). Each is worth 10% of the course's scaled score, taken
 *    as the student's best-four average (TEA / 4), so the bonus is 0.025 E of the best-four TEA (E is at most 2).
 * 4. The best-four TEA at ATAR a: the TISC table's TEA for a (atar-math.js), less the typical bonus it carried.
 *
 * Run `node scripts/derive-typical-bonus.js` to print the table; Test 359 checks RATES against it.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

/** TR307C 2025: [course, students, students using it in their ATAR, their median ATAR (null under 5 students)]; English
 *  courses and every course atar-math.js may count as a language (the bonus filter below keeps only those). Its students
 *  are 2025 school leavers with an ATAR (no mature age or international students), so 1,179 took Specialist where 1,309
 *  sat its exam. */
const TR307C_2025 = [
  ['English', 8445, 6555, 79.50], ['Literature', 1553, 1193, 88.95], ['English as an Additional Language or Dialect', 198, 155, 79.85],
  ['Mathematics Methods', 3724, 2936, 92.55], ['Mathematics Specialist', 1179, 851, 97.00],
  ['Arabic', 29, 18, 83.15], ['Auslan', 11, 8, 91.05], ['Bengali', 1, 1, null], ['Bosnian', 1, 1, null],
  ['Chinese: Background Language', 15, 4, null], ['Chinese: First Language', 21, 9, 85.45], ['Chinese: Second Language', 78, 58, 97.00],
  ['Croatian', 1, 1, null], ['Dutch', 2, 1, null], ['Filipino', 2, 1, null],
  ['French: Background Language', 7, 5, 83.75], ['French: Second Language', 319, 230, 94.05],
  ['German: Background Language', 13, 10, 90.75], ['German: Second Language', 18, 12, 96.80],
  ['Hebrew', 2, 0, null], ['Hindi: Background Language', 30, 17, 91.85], ['Hungarian', 1, 1, null],
  ['Indonesian: Background Language', 8, 7, 87.80], ['Indonesian: Second Language', 27, 20, 78.80],
  ['Italian: Background Language', 6, 4, null], ['Italian: Second Language', 160, 126, 91.10],
  ['Japanese: Background Language', 16, 9, 90.30], ['Japanese: Second Language', 240, 179, 93.45],
  ['Korean: Background Language', 7, 4, null], ['Korean: Second Language', 5, 2, null],
  ['Modern Greek', 2, 2, null], ['Persian', 2, 2, null], ['Polish', 3, 1, null], ['Portuguese', 1, 0, null],
  ['Punjabi: Background Language', 8, 7, 76.95], ['Russian', 6, 4, null], ['Serbian', 2, 1, null], ['Sinhala', 3, 3, null],
  ['Spanish', 4, 4, null], ['Swedish', 1, 1, null], ['Tamil: Background Language', 16, 10, 86.25], ['Turkish', 1, 0, null],
  ['Vietnamese', 7, 6, 88.05]
];

/** ATARs the table is drawn at. */
const ATARS = [50, 60, 70, 80, 85, 90, 93, 95, 97, 98, 99, 99.5];

function load() {
  const window = { ConnectifyUtils: { normalize: s => String(s || '').toLowerCase().trim() } };
  const context = vm.createContext({ window, console });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/atar/atar-math.js'), 'utf8'), context);
  return window.ConnectifyMath;
}

/** Students at each ATAR: TISC's published distribution, scaled to TR307C's school leavers. */
function atarDensity() {
  const students = TR307C_2025.slice(0, 3).reduce((sum, [, n]) => sum + n, 0);
  const frequency = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/tisc-atar-frequency-2025.json'), 'utf8'));
  const scale = students / frequency.students;
  const grid = frequency.rows.map(([atar, count]) => [atar, count * scale]);
  let below = 0;
  const median = grid.slice().sort((x, y) => x[0] - y[0]).find(([, w]) => (below += w) >= students / 2)[0];
  return { students, published: frequency.students, median, grid };
}

const logistic = (alpha, beta, a) => 1 / (1 + Math.exp(-(alpha + beta * (a - 90))));

function bisect(f, lo, hi) {
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid)) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

/** The logistic take-up with n students over the grid and `high` of them at or above `median`. */
function fitTakeUp(grid, n, median, high) {
  const total = (alpha, beta) => grid.reduce((s, [a, w]) => s + w * logistic(alpha, beta, a), 0);
  const above = (alpha, beta) => grid.reduce((s, [a, w]) => s + (a >= median ? w * logistic(alpha, beta, a) : 0), 0);
  const alphaFor = beta => bisect(alpha => total(alpha, beta) >= n, -60, 60);
  const beta = bisect(b => above(alphaFor(b), b) >= high, -2, 3);
  const alpha = alphaFor(beta);
  return a => logistic(alpha, beta, a);
}

function derive() {
  const math = load();
  const { students, published, median, grid } = atarDensity();
  const take = {};
  for (const [name, n, used, m] of TR307C_2025.slice(3)) {
    const type = math.bonusType(name);
    if (type) take[name] = { type, n, median: m, curve: m == null ? null : fitTakeUp(grid, n, m, used / 2 + (n - used)) };
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
    const rate = 0.025 * expected;
    const tea = teaAt(atar);
    return { atar, tea: Math.round(tea / (1 + rate)), methods: pm, specialist: ps, language: pl, expected, rate: Math.round(rate * 10000) / 10000 };
  });
  return { students, published, median, rows };
}

/** The table for atar-typical-bonus.js: [best-four TEA, rate], rising. */
function rates(rows = derive().rows) {
  let best = 0;
  return rows.map(r => [r.tea, (best = Math.max(best, r.rate))]);
}

module.exports = { TR307C_2025, derive, rates };

if (require.main === module) {
  const { students, published, median, rows } = derive();
  console.log(`${published} students in the ATAR distribution, scaled to ${students}; median ATAR ${median.toFixed(2)}\n`);
  console.log('ATAR\tTEA\tMethods\tSpecial\tLanguage\tE\trate');
  for (const r of rows) {
    console.log([r.atar, r.tea, r.methods.toFixed(3), r.specialist.toFixed(3), r.language.toFixed(3), r.expected.toFixed(3), `${(r.rate * 100).toFixed(2)}%`].join('\t'));
  }
  console.log(`\nRATES = ${JSON.stringify(rates(rows))}`);
}

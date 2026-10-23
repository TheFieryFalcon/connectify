/**
 * Connectify Cohort: the lowest and highest final mark a class can still reach
 *
 * For a class without a final A-E letter, the overall card's mark with every unmarked weighted task at 0%
 * (lowest) or 100% (highest), worked out like Estimate Grade (grade-estimate.js: Connect's average as one
 * block at the marked weight). Tasks come from the cache, up to the card's semester (Semester 2 panels are
 * cumulative), so a collapsed card has a range too. No range once every task is marked. Expanded cards show
 * it as Lowest / Highest Possible cells (cohort-expanded.js), compact panels at the end of the result line.
 * Exposes window.ConnectifyCohortGradeRange.
 */
(() => {
  'use strict';

  try {
    const { normalize } = window.ConnectifyCohortRows;
    const CARD = '.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile';
    const TITLE = '.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading';

    /** The card's cached tasks up to its semester. */
    function cardTasks(card) {
      const title = normalize(card?.querySelector(TITLE)?.textContent);
      if (!title) return [];
      const semester = Number(title.match(/Semester\s*([12])/i)?.[1]) || 1;
      return (window.ConnectifyData?.getSubjectTasks?.(title) || []).filter(t => t && (t.semester || 1) <= semester);
    }

    /** { low, high } from Connect's mark and the tasks, or null with no unmarked weighted task or no marked one. */
    function range(tasks, mark) {
      const est = window.ConnectifyGradeEstimate;
      if (!est || !Number.isFinite(mark) || !tasks.some(t => !t.pending && Number.isFinite(t.score))) return null;
      const all = value => tasks.map(t => (t.pending ? value : undefined));
      const low = est.estimate(tasks, all(0), mark);
      if (!low.complete || !Number.isFinite(low.estimate)) return null;
      const high = est.estimate(tasks, all(100), mark).estimate;
      return Number.isFinite(high) ? { low: low.estimate, high } : null;
    }

    /** The overall row's range (null once its class shows a letter). */
    function forRow(overallRow, mark) {
      if (window.ConnectifyCohortUpcoming?.hasLetter(overallRow)) return null;
      return range(cardTasks(overallRow.closest(CARD)), mark);
    }

    const percent = v => `${Number(v.toFixed(1))}%`;

    /** Compact panels: "Lowest possible 41.2%  •  Highest possible 93.5%" ('' without a range). */
    const compactText = r => (r ? `Lowest possible ${percent(r.low)}  •  Highest possible ${percent(r.high)}` : '');

    window.ConnectifyCohortGradeRange = { range, forRow, cardTasks, percent, compactText };
  } catch (err) {
    console.error('Connectify error in cohort-grade-range.js:', err);
  }
})();

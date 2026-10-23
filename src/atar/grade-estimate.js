/**
 * Connectify Estimate Grade: math
 *
 * The running average a class would show if the student got the marks they enter on some of its
 * unmarked tasks. Connect's average leaves unmarked tasks out, so a blank task is simply left out
 * too: one entered mark is enough for an estimate. Exposes window.ConnectifyGradeEstimate.
 */
(() => {
  'use strict';

  if (window.ConnectifyGradeEstimate) return;

  /** '85', '85%', '17/20' or '17 out of 20' -> a percentage from 0 to 100; anything else -> undefined. */
  function parseMark(text) {
    const value = String(text ?? '').trim().replace(/%$/, '').trim();
    if (!value) return undefined;
    const fraction = value.match(/^(\d+(?:\.\d+)?)\s*(?:\/|out\s+of)\s*(\d+(?:\.\d+)?)$/i);
    const percent = fraction
      ? (Number(fraction[2]) > 0 ? (Number(fraction[1]) / Number(fraction[2])) * 100 : NaN)
      : (/^\d+(?:\.\d+)?$/.test(value) ? Number(value) : NaN);
    return Number.isFinite(percent) && percent >= 0 && percent <= 100 ? percent : undefined;
  }

  // Weight-weighted mean of [percent, weight] pairs; a plain mean when no pair has a weight
  function weightedMean(pairs) {
    if (!pairs.length) return { mean: undefined, weight: 0 };
    const weight = pairs.reduce((sum, [, w]) => sum + w, 0);
    if (weight > 0) return { mean: pairs.reduce((sum, [p, w]) => sum + p * w, 0) / weight, weight };
    return { mean: pairs.reduce((sum, [p]) => sum + p, 0) / pairs.length, weight: 0 };
  }

  /**
   * tasks: [{ name, weight, pending, score }]; entered: percentages by task index (blank = undefined);
   * mark: the class's current average as Connect shows it, used for the marked part when it is known.
   * Returns { current, estimate, entered, pending, complete } (complete: every unmarked task has a mark).
   */
  function estimate(tasks, entered, mark) {
    const list = Array.isArray(tasks) ? tasks : [];
    const weightOf = t => (Number(t?.weight) > 0 ? Number(t.weight) : 0);
    // With any weights, an unweighted task never counts (as in Connect); with none, every task counts once
    const weighted = list.some(t => weightOf(t) > 0);
    const counts = t => !weighted || weightOf(t) > 0;
    const marked = list.filter(t => !t?.pending && Number.isFinite(t?.score) && counts(t)).map(t => [t.score, weightOf(t)]);
    const pendingIdx = list.map((t, i) => (t?.pending && counts(t) ? i : -1)).filter(i => i >= 0);
    const guesses = pendingIdx.filter(i => Number.isFinite(entered?.[i])).map(i => [entered[i], weightOf(list[i])]);

    const done = weightedMean(marked);
    const current = Number.isFinite(mark) && marked.length ? mark : done.mean;
    let result = current;
    if (guesses.length) {
      // Marked tasks count as one block at the current average, so Connect's own rounding carries through
      const block = marked.length ? [[current, weighted ? done.weight : 0]] : [];
      result = weighted ? weightedMean(block.concat(guesses)).mean : weightedMean(marked.concat(guesses)).mean;
    }
    return {
      current,
      estimate: result,
      entered: guesses.length,
      pending: pendingIdx.length,
      complete: pendingIdx.length > 0 && guesses.length === pendingIdx.length
    };
  }

  window.ConnectifyGradeEstimate = { parseMark, estimate };
})();

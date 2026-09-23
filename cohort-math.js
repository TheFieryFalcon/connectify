/**
 * Connectify Cohort Statistics Math
 *
 * Implements Fritsch-Carlson Monotone Piecewise Cubic Hermite Interpolation (PCHIP),
 * 5-number summary sample variance integration, weighted cohort mean,
 * z-score estimation, percentile ranking, and standing formatters.
 */
(() => {
  'use strict';

  if (window.ConnectifyCohortMath) return;

  const toNumeric = value => {
    if (value !== null && value !== undefined && value !== '') {
      const num = Number(value);
      if (Number.isFinite(num)) return num;
    }
    return undefined;
  };

  const formatPercentage = value => (
    Number.isFinite(value) ? String(Math.round(value * 100) / 100) : 'unavailable'
  );

  const validCohortSize = value => {
    const num = toNumeric(value);
    return Number.isSafeInteger(num) && num >= 1 ? num : undefined;
  };

  const validStats = stats => (
    Array.isArray(stats) &&
    stats.length === 5 &&
    stats.every(Number.isFinite) &&
    stats.every((v, i) => !i || v >= stats[i - 1])
  );

  /**
   * Monotone Piecewise Cubic Hermite Interpolation (PCHIP) across the 5 published quantiles.
   * Enforces zero slopes at the minimum and maximum observed cohort scores to realistically
   * model bell-shaped score clustering and tail drop-off without overshooting or oscillation.
   *
   * @param {number[]} stats - [min, Q1, median, Q3, max]
   * @param {number} mark - Student percentage score
   * @param {number} [cohortSize] - Total students in subject
   * @returns {number|undefined} Estimated cumulative percentile in [0, 1]
   */
  function percentile(stats, mark, cohortSize) {
    if (!validStats(stats) || !Number.isFinite(mark)) return undefined;
    if (mark <= stats[0]) return 0;
    if (mark >= stats[4]) return 1;

    // Direct anchor hits: if the mark matches one or more quantiles, return their average rank
    const ties = [];
    for (let i = 0; i < 5; i++) {
      if (stats[i] === mark) ties.push(i);
    }
    if (ties.length > 0) {
      const qValues = [0, 0.25, 0.5, 0.75, 1];
      return (qValues[ties[0]] + qValues[ties[ties.length - 1]]) / 2;
    }

    const n = validCohortSize(cohortSize);
    const p0 = n ? 0.5 / n : 0.005;
    const p4 = n ? 1 - 0.5 / n : 0.995;
    const x = [stats[0], stats[1], stats[2], stats[3], stats[4]];
    const y = [p0, 0.25, 0.5, 0.75, p4];

    // Compute interval spans and secant slopes
    const h = [];
    const delta = [];
    for (let i = 0; i < 4; i++) {
      h[i] = x[i + 1] - x[i];
      delta[i] = h[i] > 0 ? (y[i + 1] - y[i]) / h[i] : 0;
    }

    // Compute interior slopes using Fritsch-Carlson harmonic means
    const d = [0, 0, 0, 0, 0];
    for (let i = 1; i < 4; i++) {
      if (delta[i - 1] > 0 && delta[i] > 0) {
        d[i] = 2 / (1 / delta[i - 1] + 1 / delta[i]);
      } else {
        d[i] = 0;
      }
    }
    d[0] = 0;
    d[4] = 0;

    // Evaluate cubic Hermite polynomial within the containing quantile interval
    for (let i = 0; i < 4; i++) {
      if (mark >= x[i] && mark <= x[i + 1]) {
        if (h[i] === 0) return y[i];
        const t = (mark - x[i]) / h[i];
        const t2 = t * t;
        const t3 = t2 * t;
        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;

        const val = y[i] * h00 + h[i] * d[i] * h10 + y[i + 1] * h01 + h[i] * d[i + 1] * h11;
        return Math.max(0, Math.min(1, val));
      }
    }

    return 0.5;
  }

  /**
   * Computes sample statistics and estimated rank from the 5-number boxplot summary.
   */
  function summary(stats, mark, cohortSize) {
    if (!validStats(stats)) return null;

    // Weighted mean: (min + 2*Q1 + 2*Median + 2*Q3 + max) / 8
    const mean = (stats[0] + 2 * stats[1] + 2 * stats[2] + 2 * stats[3] + stats[4]) / 8;

    // Integrate variance across the estimated quantile intervals
    let variance = 0;
    for (let i = 0; i < 4; i++) {
      const a = stats[i] - mean;
      const b = stats[i + 1] - mean;
      variance += (a * a + a * b + b * b) / 12;
    }
    const sd = Math.sqrt(Math.max(0, variance));

    const p = percentile(stats, mark, cohortSize);
    const n = validCohortSize(cohortSize);
    const rank = Number.isFinite(p) && n ? Math.max(1, Math.min(n, Math.round(1 + (n - 1) * (1 - p)))) : undefined;

    return {
      mean,
      sd,
      p,
      rank,
      z: Number.isFinite(mark) && sd > 0 ? (mark - mean) / sd : undefined
    };
  }

  /**
   * Generates readable cohort standing text with decimal precision.
   */
  function standing(p) {
    if (!Number.isFinite(p)) return '';
    if (p >= 1) return 'Top of cohort';
    if (p <= 0) return 'Bottom of cohort';

    const side = p <= 0.5 ? 'Bottom' : 'Top';
    const pct = 100 * (p <= 0.5 ? p : 1 - p);

    let pctString;
    if (pct < 0.1) {
      pctString = '< 0.1%';
    } else if (pct < 10) {
      pctString = Number(pct.toFixed(1)) + '%';
    } else {
      pctString = Math.round(pct) + '%';
    }

    return ;
  }

  function rankString(rank, cohortSize) {
    if (!rank || !cohortSize) return '';
    return ;
  }

  window.ConnectifyCohortMath = {
    toNumeric,
    formatPercentage,
    validCohortSize,
    validStats,
    percentile,
    summary,
    standing,
    rankString
  };
})();

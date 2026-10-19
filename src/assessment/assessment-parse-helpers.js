/**
 * Connectify Assessment: parsing helpers
 *
 * Turns Connect date/week captions into a chronological order number, and estimates a task's cohort
 * mean from its boxplot (bridged stats first, Highcharts as a fallback).
 * Exposes window.ConnectifyParseHelpers.
 */
(() => {
  'use strict';

  /**
   * Parse a chronological order index from a date/week caption.
   * Maps Term/Week into a numeric sequence (e.g. Term 2 Week 3 -> 13.0).
   *
   * @param {string} text - Raw date or week caption from Connect
   * @returns {number|null} Sequence number for sorting, or null if unreadable
   */
  function orderHint(text) {
    // Matches "Term 3, Week 5" or "Term 3 Week 5"
    let match = text.match(/term\s*(\d).*?week[s]?\s*(\d+)/i);
    if (match) {
      return (+match[1] - 1) * 12 + (+match[2]);
    }

    // Matches "Week 5, Term 3"
    match = text.match(/weeks?\s*(\d+)(?:\s*(?:&|and|[\/–-])\s*\d+)?\s*[,;]?\s*term\s*(\d)/i);
    if (match) {
      return (+match[2] - 1) * 12 + (+match[1]);
    }

    // Matches bare "Week 4" or "Week 4/5"
    match = text.match(/^(?:week[s]?\s*)?(\d{1,2})(?:\s*[\/–-]\s*\d{1,2})?$/i);
    if (match) {
      return +match[1];
    }

    // Fallback: parse month/day date string
    const cleaned = text
      .replace(/(\d)(st|nd|rd|th)\b/gi, '$1')
      .replace(/^(mon|tue|wed|thu|fri|sat|sun)\w*\s+/i, '');

    if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(cleaned)) {
      const year = new Date().getFullYear();
      const parsedDate = Date.parse(`${cleaned} ${year}`);
      if (Number.isFinite(parsedDate)) {
        // Convert to school week starting from late January
        return (parsedDate - Date.UTC(year, 0, 26)) / 604800000 + 1;
      }
    }

    return null;
  }

  // Mean estimated from a 5-number summary: (min + 2*Q1 + 2*median + 2*Q3 + max) / 8
  const weightedMean = stats => (stats[0] + 2 * stats[1] + 2 * stats[2] + 2 * stats[3] + stats[4]) / 8;

  /**
   * Extract estimated cohort mean from Highcharts boxplot series on a task row.
   *
   * @param {Element} row - The task row DOM node
   * @returns {number|null} Estimated cohort mean percentage, or null
   */
  function cohortMean(row) {
    const host = row.querySelector('[data-highcharts-chart]') ||
                 row.querySelector('.cvr-c-task__chart [data-highcharts-chart]') ||
                 row.querySelector('.cvr-c-task__chart');
    if (!host) return null;

    if (host.dataset?.connectifyStats) {
      try {
        const stats = JSON.parse(host.dataset.connectifyStats);
        if (Array.isArray(stats) && stats.length === 5 && stats.every(Number.isFinite)) {
          return weightedMean(stats);
        }
      } catch {}
    }

    const hostWithDataset = host.querySelector?.('[data-connectify-stats]') || host.closest?.('[data-connectify-stats]');
    if (hostWithDataset?.dataset?.connectifyStats) {
      try {
        const stats = JSON.parse(hostWithDataset.dataset.connectifyStats);
        if (Array.isArray(stats) && stats.length === 5 && stats.every(Number.isFinite)) {
          return weightedMean(stats);
        }
      } catch {}
    }

    const chartIndex = Number(host.getAttribute('data-highcharts-chart'));
    const chart = window.Highcharts?.charts?.[chartIndex];
    if (!chart || (chart.container && !host.contains(chart.container))) return null;

    for (const series of chart.series || []) {
      const dataPoints = [...(series.points || []), ...(series.options?.data || [])];
      for (const point of dataPoints) {
        const pointData = point?.options || point;
        const stats = Array.isArray(pointData)
          ? pointData.slice(-5)
          : [pointData?.low, pointData?.q1, pointData?.median, pointData?.q3, pointData?.high];

        const isCompleteBoxplot =
          stats.length === 5 &&
          stats.every(v => typeof v === 'number' && Number.isFinite(v)) &&
          stats.every((v, i) => !i || v >= stats[i - 1]);

        if (isCompleteBoxplot) {
          return weightedMean(stats);
        }
      }
    }

    return null;
  }

  // Semester 1 is every task before Term 2 Week 7: chronological week 19 (12 per term), school week 17
  const SEMESTER_TWO_ORDER = 19;
  const TERM_AND_WEEK = /term\s*\d[\s\S]*?weeks?\s*\d|weeks?\s*\d+[\s\S]*?term\s*\d/i;

  /**
   * The semester a task belongs to. Semester 2 outlines also list the Semester 1 tasks, so the card title
   * alone is not enough: a week override (order) or a "Term N, Week W" caption decides first (a bare
   * "Term 1" / "Term 3|4" too; Term 2 spans both), never later than the card's own semester.
   */
  function taskSemester(cardSemester, caption, overrideOrder = null) {
    const card = Number(cardSemester) === 2 ? 2 : 1;
    const text = String(caption || '');
    const order = Number.isFinite(overrideOrder) ? overrideOrder : (TERM_AND_WEEK.test(text) ? orderHint(text) : null);
    let semester = null;
    if (Number.isFinite(order)) semester = order < SEMESTER_TWO_ORDER ? 1 : 2;
    else {
      const term = Number(text.match(/\bterm\s*([1-4])\b/i)?.[1]);
      if (term === 1) semester = 1;
      else if (term >= 3) semester = 2;
    }
    return semester ? Math.min(semester, card) : card;
  }

  window.ConnectifyParseHelpers = { orderHint, cohortMean, weightedMean, taskSemester, SEMESTER_TWO_ORDER };
})();

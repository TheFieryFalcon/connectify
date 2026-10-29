/**
 * Connectify Assessment: parsing helpers
 *
 * Turns Connect date/week captions into a chronological order number, estimates a task's cohort
 * mean from its boxplot (bridged stats first, Highcharts as a fallback), and reads each task row's mark and id.
 * Exposes window.ConnectifyParseHelpers.
 */
(() => {
  'use strict';

  /** Order from a term/week caption ("Term 2 Week 3" -> 15, 12 slots per term), or null. */
  function weekOrder(text) {
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
    return null;
  }

  /**
   * Order from a caption that is a calendar date ("Fri 13 Mar", "14th March"), this year: its real term
   * and week from the generated term calendar (ConnectifySchoolTerms, Early Easter included).
   * Null for term/week captions and unreadable text.
   */
  function dateOrder(text) {
    if (!text || weekOrder(text) !== null) return null;
    const cleaned = text
      .replace(/(\d)(st|nd|rd|th)\b/gi, '$1')
      .replace(/^(mon|tue|wed|thu|fri|sat|sun)\w*\s+/i, '');
    if (!/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(cleaned)) return null;
    const year = new Date().getFullYear();
    const parsed = new Date(Date.parse(`${cleaned} ${year}`));
    if (!Number.isFinite(parsed.getTime())) return null;
    const date = new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
    const terms = window.ConnectifySchoolTerms;
    // Without the calendar, weeks count from late January as before
    return terms ? terms.orderOf(date) : (date - Date.UTC(year, 0, 26)) / 604800000 + 1;
  }

  /**
   * Chronological order from a date or week caption: 12 slots per term (Term 2 Week 3 -> 15).
   *
   * @param {string} text - Raw date or week caption from Connect
   * @returns {number|null} Sequence number for sorting, or null if unreadable
   */
  const orderHint = text => weekOrder(text) ?? dateOrder(text);

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

  // Semester 2 starts at canonical school week 17 through the term calendar: Term 2 Week 7 (order 19,
  // 12 per term), or Term 2 Week 8 (order 20) under Early Easter, whose Term 1 has nine weeks
  const SEMESTER_TWO_WEEK = 17;
  const semesterTwoOrder = (year = new Date().getFullYear()) =>
    window.ConnectifySchoolTerms?.weekOrder(SEMESTER_TWO_WEEK, year) ?? 19;
  const TERM_AND_WEEK = /term\s*\d[\s\S]*?weeks?\s*\d|weeks?\s*\d+[\s\S]*?term\s*\d/i;

  /**
   * The semester a task belongs to. Semester 2 outlines also list the Semester 1 tasks, so the card title
   * alone is not enough: a week override (order), a "Term N, Week W" caption or a date caption ("Thur 5th
   * March") decides first (a bare "Term 1" / "Term 3|4" too; Term 2 spans both), never later than the card's own semester.
   */
  function taskSemester(cardSemester, caption, overrideOrder = null) {
    const card = Number(cardSemester) === 2 ? 2 : 1;
    const text = String(caption || '');
    const order = Number.isFinite(overrideOrder) ? overrideOrder : (TERM_AND_WEEK.test(text) ? orderHint(text) : dateOrder(text));
    let semester = null;
    if (Number.isFinite(order)) semester = order < semesterTwoOrder() ? 1 : 2;
    else {
      const term = Number(text.match(/\bterm\s*([1-4])\b/i)?.[1]);
      if (term === 1) semester = 1;
      else if (term >= 3) semester = 2;
    }
    return semester ? Math.min(semester, card) : card;
  }

  /** A task's mark text ("17 Out of 20", "85%", "- Out of 30"): { score, maxScore, isCompleted, isPending } (maxScore 100 when none is shown). */
  function markFromText(text) {
    const fraction = text.match(/^(\d+(?:\.\d+)?)\s*(?:Out\s+of|\/)\s*(\d+(?:\.\d+)?)$/i);
    const percent = text.match(/^(-?\d+(?:\.\d+)?)\s*%$/i) || text.match(/(-?\d+(?:\.\d+)?)\s*%/i);
    const isPending = /^[-–—]\s*(?:Out\s+of|\/)\s*\d/i.test(text) || /^[-–—\s]+$/i.test(text) || /pending|not\s*marked/i.test(text);
    let score = null;
    let maxScore = null;
    if (fraction && +fraction[2] > 0) {
      if (+fraction[1] <= +fraction[2]) {
        score = (+fraction[1] / +fraction[2]) * 100;
        maxScore = +fraction[2];
      }
    } else if (percent) {
      score = Number(percent[1]);
      maxScore = 100;
    }
    const isCompleted = score !== null;
    if (!maxScore) maxScore = Number(text.match(/(?:Out\s+of|\/)\s*(\d+(?:\.\d+)?)/i)?.[1]) || 100;
    return { score, maxScore, isCompleted, isPending };
  }

  /** A task row's mark cell, read as markFromText. */
  const readTaskMark = row => markFromText(window.ConnectifyUtils.normalize(row.querySelector('.cvr-c-task__marks .cvr-c-task__mark')?.textContent));

  const taskLabels = row => Array.from(row.querySelectorAll('.cvr-c-task__details .v-label'))
    .map(e => window.ConnectifyUtils.normalize(e.textContent))
    .filter(Boolean);

  /**
   * Ids for one card's tasks ({ labels, mark } in card order): their labels and out-of mark, then how many
   * earlier tasks share both. A Semester 2 outline lists the Semester 1 exam before its own, so two "Close
   * reading" tasks get :0 and :1. statsKey keys the boxplot stats cache: the task name, or the id when an
   * earlier task has the same name. Tasks without labels or a readable mark get null.
   */
  function assignTaskIds(tasks) {
    const occurrences = new Map();
    const names = new Set();
    return tasks.map(({ labels, mark }) => {
      if (!labels.length || (!mark.isCompleted && !mark.isPending)) return null;
      const identity = JSON.stringify([labels, mark.maxScore]);
      const occurrence = occurrences.get(identity) || 0;
      occurrences.set(identity, occurrence + 1);
      const id = `${identity}:${occurrence}`;
      const name = labels[labels.length - 1];
      const nameKey = name.toLowerCase();
      const entry = { id, occurrence, labels, mark, statsKey: names.has(nameKey) ? id : name };
      names.add(nameKey);
      return entry;
    });
  }

  /**
   * Every task row's id in a card (assignTaskIds over its rows). The parser, the API records
   * (assessment-api-parse.js) and the row readers all number tasks this way, so a row always finds its own
   * cached task and prediction.
   */
  function cardTaskIds(card) {
    const rows = Array.from(card.querySelectorAll('.cvr-c-tasks .cvr-c-task'));
    const entries = assignTaskIds(rows.map(row => ({ labels: taskLabels(row), mark: readTaskMark(row) })));
    const ids = new Map();
    rows.forEach((row, i) => { if (entries[i]) ids.set(row, entries[i]); });
    return ids;
  }

  window.ConnectifyParseHelpers = {
    orderHint, dateOrder, cohortMean, weightedMean, taskSemester, SEMESTER_TWO_WEEK, semesterTwoOrder,
    markFromText, readTaskMark, taskLabels, assignTaskIds, cardTaskIds
  };
})();

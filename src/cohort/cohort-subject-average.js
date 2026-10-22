/**
 * Connectify Cohort: subject average when Connect leaves it out
 *
 * Some classes (seen in Economics) have no "Semester N Cumulative Percent" row at all, so students only
 * learn their average from their teacher. When a card has marked tasks but no overall row, Connectify adds
 * its own, labelled as worked out by Connectify, before the task list: the weight-weighted mean of the
 * card's marked tasks (each task's percent times the weight its weighted-mark cell is out of; a plain mean
 * when a weight is missing), or of its cached tasks while the card shows no rows. The row sits outside
 * .cvr-c-tasks like Connect's own, so the overall panel, class prediction and expanded card all use it. It
 * is removed as soon as Connect shows its own row. Exposes window.ConnectifyCohortSubjectAverage.
 */
(() => {
  'use strict';

  try {
    const { readMark, createElement, setText, normalize, math } = window.ConnectifyCohortRows;
    const ROW_CLASS = 'connectea-subject-average-row';
    const LABEL = 'Subject average (worked out by Connectify: Connect shows none for this class)';
    const TITLE = '.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading';

    /** The weight a task counts for: what its weighted-mark cell ("7.4 Out of 10", "10%") is out of. */
    function rowWeight(row) {
      const text = normalize(row.querySelectorAll('.cvr-c-task__marks .cvr-c-task__mark')[1]?.textContent);
      const match = text.match(/(?:Out\s+of|\/)\s*(\d+(?:\.\d+)?)/i) || text.match(/(\d+(?:\.\d+)?)\s*%/);
      const weight = match ? Number(match[1]) : NaN;
      return weight > 0 ? weight : null;
    }

    /** Weighted mean of [{ score, weight }], or a plain mean when any weight is unknown. */
    function mean(results) {
      if (!results.length) return null;
      const weighted = results.every(r => r.weight > 0);
      const total = results.reduce((sum, r) => sum + (weighted ? r.weight : 1), 0);
      const earned = results.reduce((sum, r) => sum + r.score * (weighted ? r.weight : 1), 0);
      return { mark: earned / total, count: results.length };
    }

    const fromRows = rows => mean(rows
      .map(row => ({ score: readMark(row), weight: rowWeight(row) }))
      .filter(r => Number.isFinite(r.score)));

    /** A collapsed card shows no task rows: its cached tasks up to the card's semester (cumulative). */
    function fromCache(card) {
      const title = normalize(card.querySelector(TITLE)?.textContent);
      const semester = Number(title.match(/Semester\s*([12])/i)?.[1]) || 1;
      const tasks = window.ConnectifyData?.getSubjectTasks?.(title) || [];
      return mean(tasks
        .filter(t => !t.pending && Number.isFinite(t.score) && (t.semester || 1) <= semester)
        .map(t => ({ score: t.score, weight: t.weight > 0 ? t.weight : null })));
    }

    const isOwn = row => row.classList.contains(ROW_CLASS);
    const hasConnectRow = card => Array.from(card.querySelectorAll('.cvr-c-task')).some(row => !row.closest('.cvr-c-tasks') && !isOwn(row));

    /** The card's average from its marked tasks, or null. */
    function average(card) {
      const rows = Array.from(card.querySelectorAll('.cvr-c-tasks .cvr-c-task'));
      return rows.length ? fromRows(rows) : fromCache(card);
    }

    function buildRow() {
      const row = createElement('div', `cvr-c-task ${ROW_CLASS}`);
      const details = createElement('div', 'cvr-c-task__details');
      details.append(createElement('span', 'v-label', LABEL));
      const marks = createElement('div', 'cvr-c-task__marks');
      marks.append(createElement('div', 'cvr-c-task__mark'));
      row.append(details, marks);
      return row;
    }

    /** Adds, updates or removes the card's own subject average row; returns it (or null). */
    function sync(card) {
      const own = card.querySelector(`.${ROW_CLASS}`);
      const tasks = card.querySelector('.cvr-c-tasks');
      const avg = hasConnectRow(card) || !tasks ? null : average(card);
      if (!avg) {
        own?.remove();
        return null;
      }
      const row = own || buildRow();
      if (!own) tasks.insertAdjacentElement('beforebegin', row);
      setText(row.querySelector('.cvr-c-task__mark'), `${math().formatPercentage(avg.mark)}%`);
      return row;
    }

    window.ConnectifyCohortSubjectAverage = { ROW_CLASS, LABEL, sync, average, rowWeight };
  } catch (err) {
    console.error('Connectify error in cohort-subject-average.js:', err);
  }
})();

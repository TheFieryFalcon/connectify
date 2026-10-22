/**
 * Connectify Cohort: restores Connect's overall row when Connect leaves it out
 *
 * Connect sometimes renders a card's "Semester 2 Cumulative Percent" heading with nothing under it (seen in
 * Economics, with or without Connectify): the summary row is missing, so students have no subject average.
 * Connectify fills Connect's own empty container with a row in Connect's native markup (marks cell with the
 * percent, no boxplot: Connect gives no cohort data for it): the weight-weighted mean of the card's marked
 * tasks (each task's percent times the weight its weighted-mark cell is out of; a plain mean when a weight is
 * missing), or of its cached tasks while the card is collapsed. A note in the row says Connectify worked it
 * out. The overall panel, class prediction and expanded card then attach to it as to Connect's row, and it is
 * removed as soon as Connect renders its own. Exposes window.ConnectifyCohortSubjectAverage.
 */
(() => {
  'use strict';

  try {
    const { readMark, createElement, setText, normalize } = window.ConnectifyCohortRows;
    const ROW_CLASS = 'connectea-subject-average-row';
    const NOTE = 'Worked out by Connectify from your marked tasks (Connect shows no average for this class)';
    const HEADING = /\b(?:Cumulative Percent|Total Percent)\b/i;
    const TITLE = '.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading';
    const LABEL = 'v-label v-widget eds-u-white-space--normal v-label-eds-u-white-space--normal v-label-undef-w';

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

    /** The card's average from its marked tasks, or null. */
    function average(card) {
      const rows = Array.from(card.querySelectorAll('.cvr-c-tasks .cvr-c-task'));
      return rows.length ? fromRows(rows) : fromCache(card);
    }

    /** Connect's container for the overall row: the layout right after the "... Percent" heading. */
    function summarySlot(card) {
      for (const heading of card.querySelectorAll('.eds-c-text--bold')) {
        if (!HEADING.test(normalize(heading.textContent))) continue;
        const siblings = Array.from(heading.parentElement?.children || []);
        const slot = siblings[siblings.indexOf(heading) + 1];
        return slot?.classList.contains('v-csslayout') ? slot : null;
      }
      return null;
    }

    /** Connect's summary row markup (as Chemistry's), with an empty second cell and no chart. */
    function buildRow() {
      const row = createElement('div', `cvr-c-task v-layout v-widget eds-s-is-first cvr-c-task-eds-s-is-first eds-s-is-last cvr-c-task-eds-s-is-last ${ROW_CLASS}`);
      const details = createElement('div', 'cvr-c-task__details v-layout v-widget');
      details.append(createElement('div', 'connectea-subject-average-note', NOTE));
      const achievement = createElement('div', 'cvr-c-task__achievement v-layout v-widget');
      const marks = createElement('div', 'cvr-c-task__marks v-layout v-widget');
      for (let i = 0; i < 2; i++) {
        const mark = createElement('div', 'cvr-c-task__mark v-layout v-widget');
        const grade = createElement('div', 'cvr-c-task__grade v-layout v-widget');
        grade.append(createElement('div', LABEL));
        mark.append(grade);
        marks.append(mark);
      }
      achievement.append(marks);
      row.append(details, createElement('div', 'cvr-c-task-mark__headers v-layout v-widget'), achievement);
      return row;
    }

    const isOwn = row => row.classList.contains(ROW_CLASS);

    /** Fills, updates or clears Connect's empty overall row container; returns the restored row (or null). */
    function sync(card) {
      const slot = summarySlot(card);
      if (!slot) return null;
      const own = slot.querySelector(`.${ROW_CLASS}`);
      const native = Array.from(slot.querySelectorAll('.cvr-c-task')).some(row => !isOwn(row));
      const avg = native ? null : average(card);
      if (!avg) {
        own?.remove();
        return null;
      }
      const row = own || buildRow();
      if (!own) slot.append(row);
      // Connect's own format: one decimal place ("86.1%")
      setText(row.querySelector('.cvr-c-task__mark .v-label'), `${Number(avg.mark.toFixed(1))}%`);
      return row;
    }

    window.ConnectifyCohortSubjectAverage = { ROW_CLASS, NOTE, sync, average, rowWeight, summarySlot };
  } catch (err) {
    console.error('Connectify error in cohort-subject-average.js:', err);
  }
})();

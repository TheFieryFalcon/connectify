/**
 * Connectify Cohort: uncompleted tasks panel on a class's overall row
 *
 * A class without a final A-E letter lists its unmarked assessments under the overall statistics, each with
 * the Low / Mid / High prediction of the task row (same values and colours as the row's own forecast line,
 * or what the prediction still needs). Hidden once the class shows a letter or has nothing left to mark.
 * Exposes window.ConnectifyCohortUpcoming.
 */
(() => {
  'use strict';

  try {
    const { createElement, setHTML, types } = window.ConnectifyCohortRows;
    const getTaskMeta = row => types().getTaskMeta(row);
    const esc = (...args) => window.ConnectifyUtils.escapeHtml(...args);
    const hasMark = row => Number.isFinite(window.ConnectifyCohortRows.readMark(row));

    /** Whether the overall row shows a final A-E letter (the class is finished). */
    function hasLetter(overallRow) {
      const cells = overallRow.querySelectorAll('.cvr-c-task__marks .cvr-c-task__mark');
      return Array.from(cells).some(cell => /^[ABCDE]$/i.test((cell.textContent || '').trim()));
    }

    /** The card's unmarked task rows; empty when the class already has a letter grade. */
    function pendingRows(overallRow) {
      if (hasLetter(overallRow)) return [];
      const card = overallRow.closest('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile');
      if (!card) return [];
      return window.ConnectifyCohortOutcomeEval.cardTaskRows(card, overallRow).filter(r => r !== overallRow && r.closest('.cvr-c-tasks') && !hasMark(r));
    }

    /** Memo signature: which rows are still unmarked (a mark or a letter changes it). */
    const signature = overallRow => pendingRows(overallRow).map(r => getTaskMeta(r).taskName).join('|');

    function line(meta, prediction) {
      const forecast = window.ConnectifyCohortForecast;
      const name = `<strong class="connectea-upcoming-name">${esc(meta.taskName)}</strong>`;
      if (!forecast.isPredicted(prediction)) return `<div class="connectea-upcoming-row">${name}: ${esc(forecast.NEEDS)}</div>`;
      const value = (level, text, v) => `<span class="connectea-forecast-value connectea-forecast-value--${level}">${text} ${Math.round(v)}%</span>`;
      return `<div class="connectea-upcoming-row">${name}: ${value('low', 'Low', prediction.low)}  •  ${value('mid', 'Mid', prediction.mid)}  •  ${value('high', 'High', prediction.high)}</div>`;
    }

    function hide(ui) {
      const box = ui?.upcoming;
      if (!box) return;
      box.hidden = true;
      box.style.setProperty('display', 'none', 'important');
    }

    function show(ui, overallRow, subjects) {
      if (!ui?.box) return;
      const rows = pendingRows(overallRow);
      if (!rows.length) return hide(ui);
      if (!ui.upcoming?.isConnected) {
        ui.upcoming = createElement('section', 'connectea-panel connectea-upcoming');
        ui.upcoming.setAttribute('aria-label', 'Connectify uncompleted tasks');
        ui.box.insertAdjacentElement('afterend', ui.upcoming);
      }
      const lines = rows.map(r => {
        const meta = getTaskMeta(r);
        return line(meta, window.ConnectifyCohortOutcomeEval.precacheUpcoming(r, meta, subjects));
      });
      setHTML(ui.upcoming, `<div class="connectea-upcoming-title">Uncompleted tasks (${rows.length})</div>${lines.join('')}`);
      ui.upcoming.hidden = false;
      ui.upcoming.style.setProperty('display', 'block', 'important');
    }

    window.ConnectifyCohortUpcoming = { show, hide, signature, pendingRows, hasLetter };
  } catch (err) {
    console.error('Connectify error in cohort-upcoming.js:', err);
  }
})();

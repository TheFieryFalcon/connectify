/**
 * Connectify Cohort: class prediction on the overall row
 *
 * A class without a final A-E letter shows its projected final mark under the overall statistics: one
 * line in the task forecast's style, Low / Mid / High from the Predictor's subject projection (completed
 * results plus predictions for the uncompleted tasks), or what the projection still needs. Hidden once the
 * class shows a letter. Exposes window.ConnectifyCohortUpcoming.
 */
(() => {
  'use strict';

  try {
    const { createElement, setHTML, setText, readMark } = window.ConnectifyCohortRows;
    const CARD = '.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile';
    const TITLE = '.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading';
    const NEEDS = 'No class prediction yet: needs a marked result or a subject baseline in Settings';

    /** Whether the overall row shows a final A-E letter (the class is finished). */
    function hasLetter(overallRow) {
      const cells = overallRow.querySelectorAll('.cvr-c-task__marks .cvr-c-task__mark');
      return Array.from(cells).some(cell => /^[ABCDE]$/i.test((cell.textContent || '').trim()));
    }

    const cardOf = overallRow => overallRow.closest(CARD);

    /** Memo signature: letter state and every task mark, so a new result refreshes the projection. */
    function signature(overallRow) {
      if (hasLetter(overallRow)) return 'letter';
      const card = cardOf(overallRow);
      if (!card) return '';
      return window.ConnectifyCohortOutcomeEval.cardTaskRows(card, overallRow)
        .filter(r => r !== overallRow).map(r => readMark(r)).join('|');
    }

    /** The class's projection from the Predictor, or null when it has no marks or baseline. */
    function projection(overallRow, subjects) {
      const predMath = window.ConnectifyPredictorMath;
      const card = cardOf(overallRow);
      const title = window.ConnectifyUtils.normalize(card?.querySelector(TITLE)?.textContent);
      if (!predMath?.projectSubjectGrades || !title) return null;
      const list = subjects?.length ? subjects : (window.ConnectifyData?.hasCachedSubjects?.() ? window.ConnectifyData.collect(true) : []);
      const clean = predMath.cleanSubject ? predMath.cleanSubject(title) : title;
      const found = predMath.projectSubjectGrades(list).find(s => s.cleanName === clean);
      const p = found?.projected;
      return found?.hasSubjectAverage && p && [p.low, p.mid, p.high].every(Number.isFinite) ? p : null;
    }

    function hide(ui) {
      const box = ui?.upcoming;
      if (!box) return;
      box.hidden = true;
      box.style.setProperty('display', 'none', 'important');
    }

    function show(ui, overallRow, subjects) {
      if (!ui?.box) return;
      if (hasLetter(overallRow)) return hide(ui);
      if (!ui.upcoming?.isConnected) {
        ui.upcoming = createElement('section', 'connectea-panel connectea-upcoming');
        ui.upcoming.setAttribute('aria-label', 'Connectify predicted class result');
        ui.box.insertAdjacentElement('afterend', ui.upcoming);
      }
      const p = projection(overallRow, subjects);
      if (p) {
        const value = (level, text, v) => {
          const tag = level === 'mid' ? 'strong' : 'span';
          return `<${tag} class="connectea-forecast-value connectea-forecast-value--${level}">${text} ${Math.round(v)}%</${tag}>`;
        };
        setHTML(ui.upcoming, `Predicted class result: ${value('low', 'Low', p.low)}  •  ${value('mid', 'Mid', p.mid)}  •  ${value('high', 'High', p.high)}`);
      } else {
        setText(ui.upcoming, NEEDS);
      }
      ui.upcoming.hidden = false;
      ui.upcoming.style.setProperty('display', 'block', 'important');
    }

    window.ConnectifyCohortUpcoming = { show, hide, signature, hasLetter, projection, NEEDS };
  } catch (err) {
    console.error('Connectify error in cohort-upcoming.js:', err);
  }
})();

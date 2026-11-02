/**
 * Connectify Progress: Early Easter checkbox
 *
 * One Early Easter choice for the year (ConnectifySchoolTerms), shown on the Task Dates tab. Changing it
 * moves Term 2's start, so task weeks past Term 1's end, date captions and export dates follow
 * (connectify-terms-updated). Predictions depend only on the order of the tasks, which Early Easter almost never changes, so
 * they are recomputed only when it does; the page statistics are redrawn only when a task changes semester.
 * Exposes window.ConnectifyEarlyEaster.
 */
(() => {
  'use strict';

  if (window.ConnectifyEarlyEaster) return;

  const year = () => new Date().getFullYear();

  /**
   * { order, semesters }: every cached task in the predictor's chronological order (tied stamps marked
   * as ties, so only a real reordering differs) and the semester side of each task's week.
   */
  function taskOrder() {
    const subjects = window.ConnectifyData?.collect?.(true) || [];
    const stampOf = window.ConnectifyPredictorDates?.getTaskChronologicalStamp || (t => Number(t.order) || 0);
    const semesterTwo = window.ConnectifyParseHelpers?.semesterTwoOrder?.() ?? 19;
    const items = subjects.flatMap(s => (s.tasks || []).map(t => ({
      key: `${s.name}\u0000${t.id ?? t.name}`, stamp: stampOf(t, s.name), order: t.order
    })));
    items.sort((a, b) => a.stamp - b.stamp || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    return {
      order: items.map((it, i) => (i && items[i - 1].stamp === it.stamp ? '=' : '<') + it.key).join(''),
      semesters: items.map(it => `${it.key}:${Number.isFinite(it.order) && it.order >= semesterTwo ? 2 : 1}`).sort().join('|')
    };
  }

  /** { wrap, input }: a labelled checkbox holding this year's choice; onChange runs after it is applied. */
  function checkbox(className, onChange) {
    const terms = window.ConnectifySchoolTerms;
    const wrap = document.createElement('label');
    wrap.className = className;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = terms.earlyEaster(year());
    input.addEventListener('change', () => {
      const before = taskOrder();
      terms.setEarlyEaster(year(), input.checked);
      const after = taskOrder();
      if (after.order !== before.order) window.ConnectifyPredictorMath?.updatePredictionCache?.();
      // A task moving semester changes the page's first-result meters, so every row is redrawn then
      if (after.semesters !== before.semesters) window.dispatchEvent(new CustomEvent('connectify-settings-updated'));
      window.dispatchEvent(new CustomEvent('connectify-terms-updated'));
      if (typeof onChange === 'function') onChange(input.checked);
    });
    const text = document.createElement('span');
    text.textContent = 'Early Easter';
    wrap.append(input, text);
    return { wrap, input };
  }

  window.ConnectifyEarlyEaster = { checkbox, taskOrder };
})();

/**
 * Connectify Progress: Early Easter checkbox
 *
 * One Early Easter choice for the year (ConnectifySchoolTerms), shown both beside the Progress graph's
 * "Show:" dropdown and in the Export view. Changing it moves Term 2's start, so task weeks past Term 1's
 * end, date captions, export dates and predictions all follow (connectify-settings-updated,
 * updatePredictionCache), and either view shows the other's choice. Exposes window.ConnectifyEarlyEaster.
 */
(() => {
  'use strict';

  if (window.ConnectifyEarlyEaster) return;

  const year = () => new Date().getFullYear();

  /** { wrap, input }: a labelled checkbox holding this year's choice; onChange runs after it is applied. */
  function checkbox(className, onChange) {
    const terms = window.ConnectifySchoolTerms;
    const wrap = document.createElement('label');
    wrap.className = className;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = terms.earlyEaster(year());
    input.addEventListener('change', () => {
      terms.setEarlyEaster(year(), input.checked);
      window.ConnectifyPredictorMath?.updatePredictionCache?.();
      window.dispatchEvent(new CustomEvent('connectify-settings-updated'));
      if (typeof onChange === 'function') onChange(input.checked);
    });
    const text = document.createElement('span');
    text.textContent = 'Early Easter';
    wrap.append(input, text);
    return { wrap, input };
  }

  /** The graph's control row: the "Show:" dropdown, then the Early Easter checkbox. */
  function controls(showLabel, onChange) {
    const row = document.createElement('div');
    row.className = 'cx-progress-controls';
    row.append(showLabel, checkbox('cx-progress-easter', onChange).wrap);
    return row;
  }

  window.ConnectifyEarlyEaster = { checkbox, controls };
})();

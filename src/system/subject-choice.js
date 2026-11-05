/**
 * Connectify: the subject chosen across tools
 *
 * A subject picked in the Predictor, Year Progression, Target Grade or Estimate Grade stays picked when another of
 * them opens. Tools match it by cleaned name, as each lists its own form of the name, and take it once per
 * choice (`version`), so what a tool does after that stays its own. Kept for the page. Exposes
 * window.ConnectifySubjectChoice.
 */
(() => {
  'use strict';

  if (window.ConnectifySubjectChoice) return;

  const keyOf = name => (window.ConnectifyUtils.cleanSubjectName(name) || String(name || '').trim()).toLowerCase();
  let chosen = '';
  let version = 0;

  function set(name) {
    const key = keyOf(name);
    if (!key || key === chosen) return;
    chosen = key;
    version++;
  }

  /** The list's item for the chosen subject, or null. */
  function find(list, nameOf) {
    return chosen ? (list || []).find(item => keyOf(nameOf(item)) === chosen) || null : null;
  }

  window.ConnectifySubjectChoice = { set, find, version: () => version };
})();

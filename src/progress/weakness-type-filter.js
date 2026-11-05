/**
 * Connectify Weaknesses: the assessment types the analyzer includes
 *
 * Ticks under the subjects' ones. An unticked type's results leave the analyzer as an unticked subject's do, so the
 * averages are worked out without them. Only types with a marked result are listed; a task with no type is never
 * listed, since it is on no axis and the panel's note counts it. Exposes window.ConnectifyWeaknessTypeFilter.
 */
(() => {
  'use strict';

  const KEY = 'connectify:weakness_disabled_types';
  const storageKey = () => window.ConnectifyUtils.userKey(KEY);

  let disabled = new Set();
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey()) || '[]');
    if (Array.isArray(stored)) disabled = new Set(stored);
  } catch (e) {}

  const save = () => {
    try { localStorage.setItem(storageKey(), JSON.stringify([...disabled])); } catch (e) {}
  };

  const isIncluded = type => !disabled.has(type);

  /** The named types among `tasks` (`{ type, isUnknown }`), alphabetically. */
  const typesOf = tasks => [...new Set(tasks.filter(t => !t.isUnknown).map(t => t.type))].sort((a, b) => a.localeCompare(b));

  /** Ticks or unticks every one of `types`. */
  function setAll(types, included) {
    types.forEach(type => { if (included) disabled.delete(type); else disabled.add(type); });
    save();
  }

  /** One tick of the analyzer's filters, drawn the same for subjects and types. */
  function checkbox(text, checked, onChange) {
    const label = document.createElement('label');
    label.className = 'cx-weakness-checkbox-label';
    label.title = text;
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = checked;
    cb.onchange = () => onChange(cb.checked);
    const span = document.createElement('span');
    span.textContent = text;
    label.appendChild(cb);
    label.appendChild(span);
    return label;
  }

  /** Draws `types` into `box`; `onChange` runs after a tick is saved. */
  function render(box, types, onChange) {
    box.innerHTML = '';
    types.forEach(type => box.appendChild(checkbox(type, isIncluded(type), checked => {
      setAll([type], checked);
      onChange();
    })));
  }

  window.ConnectifyWeaknessTypeFilter = { isIncluded, typesOf, setAll, checkbox, render };
})();

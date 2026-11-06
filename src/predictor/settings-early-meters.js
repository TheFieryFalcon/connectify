/**
 * Connectify Settings: "Hide potentially inaccurate prediction bars"
 *
 * Wires the General Preferences checkbox to ConnectifyEarlyMeters. A change applies straight away: every row's memo
 * is dropped (connectify-settings-updated) and a cohort pass shows or hides the meters on a subject's second and third
 * results. bind(panel) returns refresh(). Exposes window.ConnectifySettingsEarlyMeters.
 */
(() => {
  'use strict';

  /** Wires the checkbox and returns refresh(), which reloads it from storage. */
  function bind(panel) {
    const toggle = panel.querySelector('#cx-early-meters-toggle');
    const store = () => window.ConnectifyEarlyMeters;
    if (!toggle) return () => {};

    toggle.addEventListener('change', () => {
      store()?.save(toggle.checked);
      window.dispatchEvent(new CustomEvent('connectify-settings-updated'));
      window.ConnectifyCohort?.schedule?.(true);
    });

    const refresh = () => {
      if (store()) toggle.checked = store().isEnabled();
    };
    refresh();
    return refresh;
  }

  window.ConnectifySettingsEarlyMeters = { bind };
})();

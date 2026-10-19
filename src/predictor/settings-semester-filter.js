/**
 * Connectify Settings: "Show [Semester N] classes only"
 *
 * Wires the checkbox and semester dropdown in General Preferences to ConnectifySemesterFilter. The
 * dropdown shows the saved pick, or the detected semester. A change hides or shows outline tiles,
 * refreshes the cache from the chosen semester's cards, redraws the page statistics and tells the
 * tools (connectify-settings-updated). bind(panel) returns refresh(). Exposes
 * window.ConnectifySettingsSemesterFilter.
 */
(() => {
  'use strict';

  function apply() {
    const filter = window.ConnectifySemesterFilter;
    filter?.applyToPage?.();
    try { window.ConnectifyData?.collect?.(true); } catch {}
    window.ConnectifyCohort?.schedule?.();
    window.ConnectifyCompoundProgress?.update?.();
    window.dispatchEvent(new CustomEvent('connectify-settings-updated'));
  }

  /** Wires the controls and returns refresh(), which reloads them from storage. */
  function bind(panel) {
    const toggle = panel.querySelector('#cx-semester-filter-toggle');
    const select = panel.querySelector('#cx-semester-filter-select');
    const detectedLabel = panel.querySelector('#cx-semester-filter-detected');
    const filter = () => window.ConnectifySemesterFilter;
    if (!toggle || !select) return () => {};

    const onChange = () => {
      filter()?.save?.(toggle.checked, select.value);
      apply();
    };
    toggle.addEventListener('change', onChange);
    select.addEventListener('change', onChange);

    const refresh = () => {
      const f = filter();
      if (!f) return;
      toggle.checked = f.isEnabled();
      select.value = String(f.chosenSemester());
      const detected = window.ConnectifyClassSemesters?.detectSemester?.();
      if (detectedLabel) detectedLabel.textContent = detected ? `Detected: Semester ${detected}.` : '';
    };
    refresh();
    return refresh;
  }

  window.ConnectifySettingsSemesterFilter = { bind };
})();

/**
 * Connectify Settings: "Show this semester's classes only"
 *
 * Wires the General Preferences checkbox to ConnectifySemesterFilter and names the detected semester
 * beside it. A change hides or shows outline tiles, refreshes the cache from this semester's cards,
 * redraws the page statistics and tells the tools (connectify-settings-updated). bind(panel) returns
 * refresh(). Exposes window.ConnectifySettingsSemesterFilter.
 */
(() => {
  'use strict';

  function apply() {
    window.ConnectifySemesterFilter?.applyToPage?.();
    try { window.ConnectifyData?.collect?.(true); } catch {}
    window.ConnectifyCohort?.schedule?.();
    window.ConnectifyCompoundProgress?.update?.();
    window.dispatchEvent(new CustomEvent('connectify-settings-updated'));
  }

  /** Wires the checkbox and returns refresh(), which reloads it from storage. */
  function bind(panel) {
    const toggle = panel.querySelector('#cx-semester-filter-toggle');
    const detectedLabel = panel.querySelector('#cx-semester-filter-detected');
    const filter = () => window.ConnectifySemesterFilter;
    if (!toggle) return () => {};

    toggle.addEventListener('change', () => {
      filter()?.save?.(toggle.checked);
      apply();
    });

    const refresh = () => {
      const f = filter();
      if (!f) return;
      toggle.checked = f.isEnabled();
      if (detectedLabel) detectedLabel.textContent = `This semester: Semester ${f.currentSemester()}.`;
    };
    refresh();
    return refresh;
  }

  window.ConnectifySettingsSemesterFilter = { bind };
})();

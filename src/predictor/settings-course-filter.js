/**
 * Connectify Settings: "Ignore Certificate and General courses"
 *
 * Wires the General Preferences checkbox to ConnectifyCourseFilter. A change applies straight away: the cohort pass
 * clears a matching card's panels or draws them again, every prediction is recomputed, the tools are told
 * (connectify-settings-updated) and Settings' own class lists are redrawn. bind(panel) returns refresh().
 * Exposes window.ConnectifySettingsCourseFilter.
 */
(() => {
  'use strict';

  /** Wires the checkbox and returns refresh(), which reloads it from storage. */
  function bind(panel) {
    const toggle = panel.querySelector('#cx-course-filter-toggle');
    const filter = () => window.ConnectifyCourseFilter;
    if (!toggle) return () => {};

    toggle.addEventListener('change', () => {
      filter()?.save(toggle.checked);
      window.ConnectifyCohort?.schedule?.(true);
      window.ConnectifyPredictorMath?.updatePredictionCache?.();
      window.dispatchEvent(new CustomEvent('connectify-settings-updated'));
      const settings = window.ConnectifyCategorySettings?.panelRefs;
      settings?.renderCalibTable?.();
      settings?.renderBaselines?.();
    });

    const refresh = () => {
      if (filter()) toggle.checked = filter().isEnabled();
    };
    refresh();
    return refresh;
  }

  window.ConnectifySettingsCourseFilter = { bind };
})();

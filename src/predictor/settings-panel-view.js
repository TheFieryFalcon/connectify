/**
 * Connectify Settings: "Statistics Panels"
 *
 * Wires the General Preferences dropdown to ConnectifyPanelView (connectify:panel_view): Compact view,
 * Expanded view on subject panels only, or Expanded view on all panels. The page reads the mode once when
 * it loads (the description says it takes effect after reload). bind(panel) returns refresh().
 * Exposes window.ConnectifySettingsPanelView.
 */
(() => {
  'use strict';

  /** Wires the dropdown and returns refresh(), which reloads it from storage. */
  function bind(panel) {
    const select = panel.querySelector('#cx-panel-view-select');
    const view = () => window.ConnectifyPanelView;
    if (!select) return () => {};

    select.addEventListener('change', () => view()?.save(select.value));

    const refresh = () => {
      if (view()) select.value = view().read();
    };
    refresh();
    return refresh;
  }

  window.ConnectifySettingsPanelView = { bind };
})();

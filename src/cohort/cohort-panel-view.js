/**
 * Connectify Cohort: statistics panel view setting
 *
 * The Settings "Statistics Panels" option (connectify:panel_view): compact one-line panels (default),
 * expanded cards on overall subject rows only, or expanded cards on every row. Read once when the outlines
 * scripts load, so a change takes effect after reload. Exposes window.ConnectifyPanelView.
 */
(() => {
  'use strict';

  const KEY = 'connectify:panel_view';
  const MODES = ['compact', 'subjects', 'all'];

  /** The stored mode; missing or unknown values are compact. */
  function read() {
    try {
      const value = localStorage.getItem(KEY);
      return MODES.includes(value) ? value : 'compact';
    } catch {
      return 'compact';
    }
  }

  function save(value) {
    try {
      if (MODES.includes(value) && value !== 'compact') localStorage.setItem(KEY, value);
      else localStorage.removeItem(KEY);
    } catch {}
  }

  const current = read();

  window.ConnectifyPanelView = {
    KEY,
    MODES,
    read,
    save,
    mode: () => current,
    expandsOverall: () => current !== 'compact',
    expandsTasks: () => current === 'all'
  };
})();

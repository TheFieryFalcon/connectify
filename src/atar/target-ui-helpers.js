/**
 * Connectify Target planners: shared view helpers
 *
 * Element creation, one-decimal rounding, planner preferences and the "Expand Subject Outlines" button
 * shared by the Target ATAR and Target Grade planners. Exposes window.ConnectifyTargetUiHelpers.
 */
(() => {
  'use strict';

  if (window.ConnectifyTargetUiHelpers) return;

  const createEl = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  };

  const round = v => (Number.isFinite(v) ? Math.round(v * 10) / 10 : '—');

  const prefs = calc => (calc?.getPreferences ? calc.getPreferences() : {});

  /** Stores one planner preference and persists the calculator preferences. */
  function savePref(calc, key, value) {
    prefs(calc)[key] = value;
    if (calc?.persistPreferences) calc.persistPreferences();
  }

  /** Expands every outline only when the student clicks it, then recalculates. */
  function expandOutlinesButton(ctx) {
    const btn = createEl('button', 'cta-reset', 'Expand Subject Outlines');
    btn.type = 'button';
    btn.style.marginTop = '8px';
    btn.addEventListener('click', () => {
      if (window.ConnectifyData?.expandAll) window.ConnectifyData.expandAll(true);
      ctx.scanAndRefresh();
    });
    return btn;
  }

  window.ConnectifyTargetUiHelpers = { createEl, round, prefs, savePref, expandOutlinesButton };
})();

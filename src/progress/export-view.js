/**
 * Connectify Assessment Export: Export mode of the Task Dates list
 *
 * The Export toggle in the Task Dates toolbar keeps the list where it is and adds to it: ticks and days on its rows
 * (export-rows.js), the exam merge option (both files), Select All / None and the Google Calendar (.ics) / Notion
 * (CSV) downloads, with Show Uncompleted Only forced on. Choices are kept in connectify:calendar_export:<account>.
 * Exposes window.ConnectifyExportView.
 */
(() => {
  'use strict';

  try {
    if (window.ConnectifyExportView) return;
    const dates = window.ConnectifyTaskDatesView;
    if (!dates) return;

    const createElement = window.ConnectifyProgressChart.createElement;
    const terms = window.ConnectifySchoolTerms;
    const tasksAPI = window.ConnectifyExportTasks;
    const rows = window.ConnectifyExportRows;
    const storageKey = () => `connectify:calendar_export:${window.ConnectifyUtils.accountKey()}`;

    const load = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey()) || '{}');
        return saved && typeof saved === 'object' ? saved : {};
      } catch { return {}; }
    };
    const save = prefs => { try { localStorage.setItem(storageKey(), JSON.stringify(prefs)); } catch {} };

    const toggleBtn = document.getElementById('cx-export-toggle') || createElement('button', 'Export', 'cx-refresh-btn');
    toggleBtn.id = 'cx-export-toggle';
    toggleBtn.type = 'button';
    toggleBtn.setAttribute('aria-pressed', 'false');
    if (!dates.toolbar.contains(toggleBtn)) dates.toolbar.append(toggleBtn);
    // A past year has nothing left to put in a calendar
    toggleBtn.hidden = Boolean(window.ConnectifyPastYearMode?.active());

    let exporting = false;
    let latest = null;

    function download(text, type, name) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type }));
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 0);
    }

    /** Paints the option and download rows; returns what the table's rows need (export-rows.js). */
    function prepare(subjects, track) {
      const prefs = load();
      const year = window.ConnectifyPastYearMode?.year() ?? new Date().getFullYear();
      const merge = prefs.mergeExams !== false;
      const update = change => {
        const next = load();
        change(next);
        save(next);
        dates.render(true);
      };
      const { groups, leftOut } = tasksAPI.build(subjects, {
        year, early: terms.earlyEaster(year), subjectDays: prefs.subjectDays, taskDays: prefs.taskDays, unticked: new Set(prefs.unticked || [])
      });
      const ticked = tasksAPI.ticked(groups);
      const merged = merge ? tasksAPI.examGroups(ticked) : [];
      const items = new Map([...groups.flatMap(g => g.tasks), ...leftOut].map(item => [item.key, item]));
      latest = { items: ticked, year, merge };
      const ctx = { items, mergedIn: new Map(merged.flatMap(g => g.exams.map(e => [e.key, g.semester]))), subjectDays: prefs.subjectDays || {}, update, track };

      const mergeBox = rows.checkbox('Merge exams into one event per semester', merge, on => update(p => { p.mergeExams = on; }));
      track(mergeBox.input, 'merge');
      dates.optionsSlot.replaceChildren(mergeBox.wrap, rows.selectAll(Array.from(items.keys()), ctx, 'all'));

      const ics = track(createElement('button', 'Google Calendar (.ics)', 'cx-export-download'), 'ics');
      const csv = track(createElement('button', 'Notion (CSV)', 'cx-export-download'), 'csv');
      for (const btn of [ics, csv]) {
        btn.type = 'button';
        btn.disabled = ticked.length === 0;
      }
      ics.id = 'cx-export-ics';
      csv.id = 'cx-export-csv';
      ics.addEventListener('click', exportIcs);
      csv.addEventListener('click', exportCsv);
      const actions = createElement('div', null, 'cx-export-actions');
      actions.append(ics, csv);
      dates.footerSlot.replaceChildren(actions, createElement('p', 'To update an earlier export, import into a new calendar.', 'cx-export-hint'));
      return ctx;
    }

    function exportIcs() {
      if (!latest?.items.length) return;
      const text = window.ConnectifyExportIcs.build(latest.items, {
        account: window.ConnectifyUtils.accountKey(), year: latest.year, merge: latest.merge
      });
      download(text, 'text/calendar;charset=utf-8', `connectify_assessments_${latest.year}.ics`);
    }
    function exportCsv() {
      if (!latest?.items.length) return;
      download(window.ConnectifyExportCsv.build(latest.items, { merge: latest.merge }), 'text/csv;charset=utf-8', `connectify_assessments_${latest.year}.csv`);
    }

    function setActive(on) {
      if (exporting === on) return;
      exporting = on;
      toggleBtn.setAttribute('aria-pressed', String(on));
      if (!on) {
        dates.optionsSlot.replaceChildren();
        dates.footerSlot.replaceChildren();
      }
      dates.render(true);
    }

    toggleBtn.addEventListener('click', e => {
      e.stopPropagation();
      setActive(!exporting);
    });
    // Opening Progress again (or another tool) starts out of Export mode
    window.addEventListener('connectify-open', () => setActive(false));

    window.ConnectifyExportView = { active: () => exporting, setActive, prepare, storageKey, toggleBtn };
  } catch (err) {
    console.error('Connectify error in export-view.js:', err);
  }
})();

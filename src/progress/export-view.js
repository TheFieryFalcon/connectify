/**
 * Connectify Assessment Export: Progress panel view
 *
 * An Export button in the Progress header swaps the graph for the export view: the generated term
 * starts with Early Easter, the exam merge option (both files), every upcoming task grouped by subject
 * (tick, weekday per subject and per task, export date; exams merged into a semester exam are shown
 * without either) and the Google Calendar (.ics) / Notion (CSV) downloads. Choices are kept in connectify:calendar_export:<account>. Exposes window.ConnectifyExportView.
 */
(() => {
  'use strict';

  try {
    if (window.ConnectifyExportView) return;
    const refs = window.ConnectifyProgress?.panelRefs;
    const panel = refs?.panel;
    const head = panel?.querySelector('header');
    if (!head) return;

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
    const scanBtn = Array.from(head.children).find(el => el !== toggleBtn && el.classList?.contains('cx-refresh-btn'));
    if (!head.contains(toggleBtn)) scanBtn ? scanBtn.insertAdjacentElement('beforebegin', toggleBtn) : head.append(toggleBtn);

    const view = document.getElementById('cx-export-view') || createElement('section', null, 'cx-export');
    view.id = 'cx-export-view';
    view.hidden = true;
    view.setAttribute('aria-label', 'Export assessments');
    if (!panel.contains(view)) panel.append(view);

    let hiddenByExport = [];
    let lastSignature = '';
    let latest = null;

    // Classes on the page that Connectify has no tasks for yet (never expanded)
    function hasUncachedClasses(subjects) {
      if (!window.ConnectifyUtils.isOutlinesPage()) return false;
      const known = new Set(subjects.filter(s => s.tasks?.length).map(s => s.name));
      const tiles = Array.from(document.querySelectorAll('.eds-c-tile'));
      const cards = window.ConnectifySemesterFilter?.allowedCards ? window.ConnectifySemesterFilter.allowedCards(tiles) : tiles;
      return cards.some(card => {
        const info = window.ConnectifyClassSemesters?.cardInfo(card);
        return info?.subject && info.semester && !known.has(info.subject);
      });
    }

    function download(text, type, name) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type }));
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 0);
    }

    function render(force = false) {
      if (view.hidden) return;
      const subjects = window.ConnectifyData ? window.ConnectifyData.collectClasses(true) : [];
      const prefs = load();
      const year = new Date().getFullYear();
      const early = terms.earlyEaster(year);
      const merge = prefs.mergeExams !== false;
      const signature = JSON.stringify([subjects, prefs, year, early]);
      if (!force && signature === lastSignature) return;
      lastSignature = signature;

      const update = change => {
        const next = load();
        change(next);
        save(next);
        render(true);
      };
      const { groups, leftOut } = tasksAPI.build(subjects, {
        year, early, subjectDays: prefs.subjectDays, taskDays: prefs.taskDays, unticked: new Set(prefs.unticked || [])
      });
      const items = tasksAPI.ticked(groups);
      const merged = merge ? tasksAPI.examGroups(items) : [];
      const mergedIn = new Map(merged.flatMap(g => g.exams.map(e => [e.key, g.semester])));
      latest = { items, year, merge };

      // Focus survives the rebuild: each control has a stable id
      const focusId = view.contains(document.activeElement) ? document.activeElement.dataset?.cxFocus : null;
      const focusables = new Map();
      const track = (el, id) => { el.dataset.cxFocus = id; focusables.set(id, el); return el; };

      const termLine = createElement('div', null, 'cx-export-terms');
      // Each term's start in its own cell: "Term 2" over "20 Apr (Week 10)" (its first school week of the year)
      const starts = createElement('div', null, 'cx-export-term-list');
      for (const t of terms.terms(year, early)) {
        const cell = createElement('span', null, 'cx-export-term');
        cell.append(createElement('strong', `Term ${t.term}`), createElement('span', `${terms.formatDate(t.start)} (Week ${t.yearWeek})`));
        starts.append(cell);
      }
      termLine.append(starts);
      // The term calendar is shared with the graph's own checkbox, its weeks and predictions
      const easter = window.ConnectifyEarlyEaster.checkbox('cx-export-check', () => render(true));
      track(easter.input, 'easter');
      termLine.append(easter.wrap);
      const nodes = [termLine];

      if (hasUncachedClasses(subjects)) {
        nodes.push(window.ConnectifyTargetUiHelpers.expandOutlinesButton({ scanAndRefresh: () => render(true) }));
      }
      const mergeBox = rows.checkbox('Merge exams into one event per semester', merge, on => update(p => { p.mergeExams = on; }));
      track(mergeBox.input, 'merge');
      mergeBox.wrap.classList.add('cx-export-merge');
      nodes.push(mergeBox.wrap);

      const list = createElement('div', null, 'cx-export-list');
      for (const group of groups) list.append(rows.subjectBlock(group, { mergedIn, update, track }));
      nodes.push(groups.length ? list : createElement('p', 'No upcoming assessments.', 'cx-export-empty'));

      const named = reason => leftOut.filter(t => t.reason === reason).map(t => `${t.name} (${t.subject})`).join(', ');
      if (named('noWeek')) nodes.push(createElement('p', `No week: ${named('noWeek')}. Set one in the Progress table.`, 'cx-export-left'));
      if (named('afterTerm4')) nodes.push(createElement('p', `After Term 4: ${named('afterTerm4')}.`, 'cx-export-left'));

      const actions = createElement('div', null, 'cx-export-actions');
      const ics = track(createElement('button', 'Google Calendar (.ics)', 'cx-export-download'), 'ics');
      const csv = track(createElement('button', 'Notion (CSV)', 'cx-export-download'), 'csv');
      for (const btn of [ics, csv]) {
        btn.type = 'button';
        btn.disabled = items.length === 0;
      }
      ics.id = 'cx-export-ics';
      csv.id = 'cx-export-csv';
      ics.addEventListener('click', exportIcs);
      csv.addEventListener('click', exportCsv);
      actions.append(ics, csv);
      nodes.push(actions, createElement('p', 'To update an earlier export, import into a new calendar.', 'cx-export-hint'));

      view.replaceChildren(...nodes);
      if (focusId && focusables.has(focusId)) focusables.get(focusId).focus();
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

    function showExport() {
      hiddenByExport = Array.from(panel.children).filter(el => el !== head && el !== view && !el.hidden);
      hiddenByExport.forEach(el => { el.hidden = true; });
      view.hidden = false;
      toggleBtn.textContent = '← Back to Graph';
      toggleBtn.setAttribute('aria-pressed', 'true');
      render(true);
    }
    function showGraph() {
      if (view.hidden) return;
      view.hidden = true;
      hiddenByExport.forEach(el => { el.hidden = false; });
      hiddenByExport = [];
      toggleBtn.textContent = 'Export';
      toggleBtn.setAttribute('aria-pressed', 'false');
    }

    toggleBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (view.hidden) showExport();
      else showGraph();
    });
    // Opening Progress again (or another tool) starts on the graph
    window.addEventListener('connectify-open', showGraph);
    for (const evt of ['connectify-results-updated', 'connectify-task-type-changed', 'connectify-settings-updated']) {
      window.addEventListener(evt, () => render());
    }

    window.ConnectifyExportView = { render, showExport, showGraph, storageKey, view, toggleBtn };
  } catch (err) {
    console.error('Connectify error in export-view.js:', err);
  }
})();

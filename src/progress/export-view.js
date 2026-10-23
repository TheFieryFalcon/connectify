/**
 * Connectify Assessment Export: Progress panel view
 *
 * An Export button in the Progress header swaps the graph for the export view: the generated term
 * starts with Early Easter, the exam merge option, every upcoming task grouped by subject (tick,
 * weekday per subject and per task, export date) and the Google Calendar (.ics) / Notion (CSV)
 * downloads. Choices are kept in connectify:calendar_export:<account>. Exposes window.ConnectifyExportView.
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
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
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

    const daySelect = (value, first) => {
      const select = createElement('select', null, 'cx-settings-select');
      const option = (value, label) => Object.assign(document.createElement('option'), { value, textContent: label });
      if (first) select.append(option('', first));
      DAYS.forEach((day, i) => select.append(option(String(i + 1), day)));
      select.value = value ? String(value) : '';
      return select;
    };

    function checkbox(label, checked, onChange) {
      const wrap = createElement('label', null, 'cx-export-check');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = checked;
      input.addEventListener('change', () => onChange(input.checked));
      wrap.append(input, document.createTextNode(` ${label}`));
      return { wrap, input };
    }

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
      termLine.append(createElement('span', `Terms start ${terms.terms(year, early).map(t => terms.formatDay(t.start)).join(' · ')}`));
      // The term calendar is shared: date captions move with it in the graph and predictions too
      const easter = checkbox('Early Easter', early, on => {
        terms.setEarlyEaster(year, on);
        window.ConnectifyPredictorMath?.updatePredictionCache?.();
        window.dispatchEvent(new CustomEvent('connectify-settings-updated'));
        render(true);
      });
      track(easter.input, 'easter');
      termLine.append(easter.wrap);
      const nodes = [termLine];

      if (hasUncachedClasses(subjects)) {
        nodes.push(window.ConnectifyTargetUiHelpers.expandOutlinesButton({ scanAndRefresh: () => render(true) }));
      }
      const mergeBox = checkbox('Merge exams into one event per semester (.ics)', merge, on => update(p => { p.mergeExams = on; }));
      track(mergeBox.input, 'merge');
      mergeBox.wrap.classList.add('cx-export-merge');
      nodes.push(mergeBox.wrap);

      const list = createElement('div', null, 'cx-export-list');
      for (const group of groups) {
        const block = createElement('div', null, 'cx-export-subject');
        const heading = createElement('div', null, 'cx-export-subject-head');
        const dayLabel = createElement('label', 'Day: ', 'cx-export-day');
        const subjectDay = track(daySelect(group.day), `day:${group.subject}`);
        subjectDay.addEventListener('change', () => update(p => { p.subjectDays = { ...(p.subjectDays || {}), [group.subject]: Number(subjectDay.value) }; }));
        dayLabel.append(subjectDay);
        const allTicked = group.tasks.every(t => t.ticked);
        const all = track(createElement('button', allTicked ? 'Select None' : 'Select All', 'cx-export-all'), `all:${group.subject}`);
        all.type = 'button';
        all.addEventListener('click', () => update(p => {
          const keys = new Set(p.unticked || []);
          for (const t of group.tasks) allTicked ? keys.add(t.key) : keys.delete(t.key);
          p.unticked = Array.from(keys);
        }));
        heading.append(createElement('strong', group.subject), dayLabel, all);
        block.append(heading);

        for (const task of group.tasks) {
          const row = createElement('div', null, 'cx-export-task');
          const tick = checkbox(task.name, task.ticked, on => update(p => {
            const keys = new Set(p.unticked || []);
            on ? keys.delete(task.key) : keys.add(task.key);
            p.unticked = Array.from(keys);
          }));
          track(tick.input, `tick:${task.key}`);
          const taskDay = track(daySelect(task.day, 'Subject day'), `taskday:${task.key}`);
          taskDay.setAttribute('aria-label', `Day for ${task.name}`);
          taskDay.addEventListener('change', () => update(p => {
            const days = { ...(p.taskDays || {}) };
            if (taskDay.value) days[task.key] = Number(taskDay.value);
            else delete days[task.key];
            p.taskDays = days;
          }));
          row.append(tick.wrap, createElement('span', task.when, 'cx-export-week'), taskDay,
            createElement('span', terms.formatDay(task.date), 'cx-export-date'));
          if (mergedIn.has(task.key)) row.append(createElement('span', `In Semester ${mergedIn.get(task.key)} Exam`, 'cx-export-tag'));
          block.append(row);
        }
        list.append(block);
      }
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
      download(window.ConnectifyExportCsv.build(latest.items), 'text/csv;charset=utf-8', `connectify_assessments_${latest.year}.csv`);
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

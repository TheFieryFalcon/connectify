/**
 * Connectify Task Dates: view
 *
 * The Year Progression panel's Task Dates tab (#cx-task-dates), one list for dates and export: the generated term
 * starts with Early Easter, Group By (and its direction), Sort By, Show Uncompleted Only, the Export toggle and the
 * task table, each task with its week and the week editor (progress-week-editor.js). Export mode
 * (export-view.js) adds the ticks, days and downloads to this same table and forces Show Uncompleted Only on.
 * Exposes window.ConnectifyTaskDatesView.
 */
(() => {
  'use strict';

  try {
    if (window.ConnectifyTaskDatesView) return;
    const refs = window.ConnectifyProgress?.panelRefs;
    const panel = refs?.panel;
    if (!panel) return;

    const createElement = window.ConnectifyProgressChart.createElement;
    const terms = window.ConnectifySchoolTerms;
    const dates = window.ConnectifyTaskDates;
    const exportRows = window.ConnectifyExportRows;

    const section = document.getElementById('cx-task-dates') || createElement('section', null, 'cx-task-dates');
    section.id = 'cx-task-dates';
    section.hidden = true;
    section.setAttribute('aria-label', 'Task dates');
    if (!panel.contains(section)) panel.append(section);

    const termLine = createElement('div', null, 'cx-dates-terms');
    const starts = createElement('div', null, 'cx-dates-term-list');
    // The term calendar is shared with the graph's weeks and predictions
    const easter = window.ConnectifyEarlyEaster.checkbox('cx-dates-check', () => render(true));
    termLine.append(starts, easter.wrap);

    const expandSlot = createElement('div', null, 'cx-dates-expand');
    const toolbar = createElement('div', null, 'cx-dates-toolbar');
    const controls = createElement('div', null, 'cx-dates-controls');

    const change = next => {
      dates.saveView({ ...dates.readView(), ...next });
      render(true);
    };
    const dropdown = (label, options, onChange) => {
      const wrap = createElement('label', null, 'cx-dates-control');
      const select = createElement('select', null, 'cx-settings-select');
      for (const option of options) {
        select.append(Object.assign(document.createElement('option'), { value: option.id, textContent: option.label }));
      }
      select.addEventListener('change', () => onChange(select.value));
      wrap.append(createElement('span', label), select);
      controls.append(wrap);
      return { wrap, select };
    };
    const group = dropdown('Group By:', dates.GROUPS, groupBy => change({ groupBy }));
    const direction = dropdown('Order:', dates.DIRECTIONS, value => change({ direction: value }));
    const sort = dropdown('Sort By:', dates.SORTS, sortBy => change({ sortBy }));
    const uncompleted = exportRows.checkbox('Show Uncompleted Only', false, uncompletedOnly => change({ uncompletedOnly }));
    controls.append(uncompleted.wrap);
    toolbar.append(controls);

    // Filled by export-view.js in Export mode
    const optionsSlot = createElement('div', null, 'cx-dates-export-options');
    const list = createElement('div', null, 'cx-dates-list');
    const footerSlot = createElement('div', null, 'cx-dates-export-footer');
    section.replaceChildren(termLine, expandSlot, toolbar, optionsSlot, list, footerSlot);

    let lastSignature = '';

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

    // Each term's start in its own cell: "Term 2" over "20 Apr (Week 10)" (its first school week of the year)
    function paintTerms(year, early) {
      starts.replaceChildren(...terms.terms(year, early).map(t => {
        const cell = createElement('span', null, 'cx-dates-term');
        cell.append(createElement('strong', `Term ${t.term}`), createElement('span', `${terms.formatDate(t.start)} (Week ${t.yearWeek})`));
        return cell;
      }));
      easter.input.checked = early;
    }

    function paintControls(view, exporting) {
      group.select.value = view.groupBy;
      direction.select.value = view.direction;
      sort.select.value = view.sortBy;
      direction.wrap.hidden = !dates.isOrdered(view.groupBy);
      uncompleted.input.checked = view.uncompletedOnly;
      uncompleted.input.disabled = exporting;
      // Options that say nothing about uncompleted tasks are off while only those are listed
      const needs = (select, options) => options.forEach((option, i) => {
        select.children[i].disabled = view.uncompletedOnly && Boolean(option.needsCompleted);
      });
      needs(group.select, dates.GROUPS);
      needs(sort.select, dates.SORTS);
    }

    function taskRow(row, showSubject, exportCtx) {
      const tr = createElement('tr');
      const cells = exportCtx ? exportRows.taskCells(row, exportCtx) : null;
      if (cells?.merged) tr.classList.add('cx-export-task--merged');
      tr.append(createElement('td', cells ? cells.name : row.name));
      if (showSubject) tr.append(createElement('td', row.subject));
      tr.append(createElement('td', window.ConnectifyProgressWeekEditor.weekCell(row.task, row.siblings, row.subjectName, onWeekSaved), 'cx-dates-when'));
      if (cells) tr.append(createElement('td', cells.day), createElement('td', cells.date));
      return tr;
    }

    function table(groups, view, exportCtx) {
      const showSubject = view.groupBy !== 'subject';
      const headers = ['Assessment', ...(showSubject ? ['Subject'] : []), 'Date', ...(exportCtx ? ['Day', 'Export Date'] : [])];
      const el = createElement('table', null, 'cx-dates-table');
      const head = createElement('tr');
      headers.forEach(h => head.append(createElement('th', h)));
      el.append(head);
      for (const item of groups) {
        if (item.label !== null) {
          const heading = createElement('tr', null, 'cx-dates-group');
          const cell = createElement('th');
          cell.setAttribute('colspan', String(headers.length));
          cell.setAttribute('scope', 'colgroup');
          if (exportCtx) cell.append(exportRows.groupHead(item, view, exportCtx));
          else cell.textContent = item.label;
          heading.append(cell);
          el.append(heading);
        }
        item.rows.forEach(row => el.append(taskRow(row, showSubject, exportCtx)));
      }
      return el;
    }

    function emptyText(hasTasks, view) {
      if (!hasTasks) return 'No assessments found. Expand subjects in Connect to load data.';
      return view.groupBy === 'achieved' ? 'No completed assessments.' : 'No upcoming assessments.';
    }

    function render(force = false) {
      if (panel.hidden || section.hidden) return;
      // Never rebuilt under a week being typed: the input commits on blur, Enter or Escape
      const active = document.activeElement;
      if (!force && section.contains(active) && active.tagName === 'INPUT' && active.type === 'number') return;
      const subjects = window.ConnectifyData ? window.ConnectifyData.collectClasses(true) : [];
      const year = new Date().getFullYear();
      const early = terms.earlyEaster(year);
      const exportView = window.ConnectifyExportView;
      const exporting = Boolean(exportView?.active());
      const view = dates.effectiveView(dates.readView(), exporting);
      const rows = dates.rows(subjects, { predictions: view.groupBy === 'predicted' });
      const uncached = hasUncachedClasses(subjects);
      const signature = JSON.stringify([subjects, view, exporting, year, early, uncached, rows.map(r => [r.type, r.predicted])]);
      if (!force && signature === lastSignature) return;
      lastSignature = signature;

      // Focus survives the rebuild: each control has a stable id
      const focusId = section.contains(active) ? active.dataset?.cxFocus : null;
      const focusables = new Map();
      const track = (el, id) => { el.dataset.cxFocus = id; focusables.set(id, el); return el; };

      paintTerms(year, early);
      paintControls(view, exporting);
      expandSlot.replaceChildren(...(uncached ? [window.ConnectifyTargetUiHelpers.expandOutlinesButton({ scanAndRefresh: () => render(true) })] : []));
      const exportCtx = exporting ? exportView.prepare(subjects, track) : null;
      const groups = dates.arrange(rows, view);
      list.replaceChildren(groups.length ? table(groups, view, exportCtx) : createElement('p', emptyText(rows.length > 0, view), 'cx-dates-empty'));
      if (focusId && focusables.has(focusId)) focusables.get(focusId).focus();
    }

    // A saved week moves the task here, on the graph and in the files
    function onWeekSaved() {
      render(true);
      refs.refresh?.(true);
    }

    for (const evt of ['connectify-results-updated', 'connectify-task-type-changed', 'connectify-predictions-updated', 'connectify-settings-updated', 'connectify-terms-updated']) {
      window.addEventListener(evt, () => render());
    }

    window.ConnectifyTaskDatesView = { section, toolbar, list, optionsSlot, footerSlot, render };
  } catch (err) {
    console.error('Connectify error in task-dates-view.js:', err);
  }
})();

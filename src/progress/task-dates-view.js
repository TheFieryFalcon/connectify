/**
 * Connectify Task Dates: view
 *
 * The Year Progression panel's Task Dates tab (#cx-task-dates), one list for dates and export: the term starts with
 * Early Easter in one line, Group By (and its direction arrow), Sort By and the Export toggle, then a row with Subjects
 * and Type (task-dates-filter.js) and Show: (All, Completed, Uncompleted, Marked, Unmarked), then the task table: each task with its short week and the week
 * editor (progress-week-editor.js), then its subject, type and grade, or predicted grade when grouped by it
 * (task-dates-cells.js). Export mode (export-view.js) adds the ticks and downloads to this same table,
 * swaps that right half for the day and export date, leaving the left half where it was, and starts Show on Uncompleted:
 * a choice of its own for as long as Export is on, so the saved Show returns after.
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
    const taskCells = window.ConnectifyTaskDatesCells;

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
    const dropdown = (label, options, onChange, parent = controls) => {
      const wrap = createElement('label', null, 'cx-dates-control');
      const select = createElement('select', null, 'cx-dates-select');
      for (const option of options) {
        select.append(Object.assign(document.createElement('option'), { value: option.id, textContent: option.label }));
      }
      select.addEventListener('change', () => onChange(select.value));
      wrap.append(createElement('span', label), select);
      parent.append(wrap);
      return { wrap, select };
    };
    const group = dropdown('Group By:', dates.GROUPS, groupBy => change({ groupBy }));
    // The groups' direction: an arrow beside Group By
    const direction = createElement('button', null, 'cx-dates-direction');
    direction.type = 'button';
    direction.addEventListener('click', e => {
      e.stopPropagation();
      change({ direction: dates.readView().direction === 'desc' ? 'asc' : 'desc' });
    });
    controls.append(direction);
    const sort = dropdown('Sort By:', dates.SORTS, sortBy => change({ sortBy }));
    toolbar.append(controls);
    const filterRow = createElement('div', null, 'cx-dates-filters');
    const subjectFilter = window.ConnectifyTaskDatesFilter.create('Subjects', hiddenSubjects => change({ hiddenSubjects }));
    const typeFilter = window.ConnectifyTaskDatesFilter.create('Type', hiddenTypes => change({ hiddenTypes }));
    filterRow.append(subjectFilter.wrap, typeFilter.wrap);
    // In Export mode Show is the export's own: Uncompleted each time Export is turned on, never saved
    let exportShow = 'uncompleted';
    let wasExporting = false;
    const show = dropdown('Show:', dates.SHOWS, value => {
      if (!window.ConnectifyExportView?.active()) return change({ show: value });
      exportShow = value;
      render(true);
    }, filterRow);
    show.wrap.classList.add('cx-dates-show');

    // Filled by export-view.js in Export mode
    const optionsSlot = createElement('div', null, 'cx-dates-export-options');
    const list = createElement('div', null, 'cx-dates-list');
    const footerSlot = createElement('div', null, 'cx-dates-export-footer');
    section.replaceChildren(termLine, expandSlot, toolbar, filterRow, optionsSlot, list, footerSlot);

    let lastSignature = '';

    // Classes on the page that Connectify has no tasks for yet (never expanded)
    function hasUncachedClasses(subjects) {
      if (!window.ConnectifyUtils.isOutlinesPage()) return false;
      const known = new Set(subjects.filter(s => s.tasks?.length).map(s => s.name));
      const tiles = Array.from(document.querySelectorAll('.eds-c-tile'));
      const cards = window.ConnectifySemesterFilter?.allowedCards ? window.ConnectifySemesterFilter.allowedCards(tiles) : tiles;
      return cards.some(card => {
        const info = window.ConnectifyClassSemesters?.cardInfo(card);
        return info?.subject && info.semester && !known.has(info.subject) && !window.ConnectifyCourseFilter?.ignores(info.subject);
      });
    }

    // Each term's start: "Term 2 20 Apr"
    function paintTerms(year, early) {
      starts.replaceChildren(...terms.terms(year, early).map(t => {
        const cell = createElement('span', null, 'cx-dates-term');
        cell.append(createElement('span', `Term ${t.term}`), createElement('span', terms.formatDate(t.start)));
        return cell;
      }));
      easter.input.checked = early;
    }

    function paintControls(view) {
      group.select.value = view.groupBy;
      sort.select.value = view.sortBy;
      const descending = view.direction === 'desc';
      direction.textContent = descending ? '↓' : '↑';
      direction.title = descending ? 'Descending' : 'Ascending';
      direction.setAttribute('aria-label', `Group order: ${direction.title}`);
      direction.hidden = !dates.isOrdered(view.groupBy);
      show.select.value = view.show;
      // Options that say nothing about the tasks Show lists are off
      const needs = (select, options, exempt) => options.forEach((option, i) => {
        select.children[i].disabled = !dates.fits(option, view.show) && !exempt;
      });
      needs(group.select, dates.GROUPS, false);
      needs(sort.select, dates.SORTS, dates.showsPredicted(view.groupBy));
    }

    // Each subject and type once, alphabetically
    function paintFilters(rows, view) {
      const items = (idOf, labelOf) => {
        const labels = new Map();
        for (const row of rows) if (!labels.has(idOf(row))) labels.set(idOf(row), labelOf(row));
        return Array.from(labels, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));
      };
      subjectFilter.paint(items(row => row.subject, taskCells.subjectText), view.hiddenSubjects);
      typeFilter.paint(items(row => row.type, row => row.type || 'No type'), view.hiddenTypes);
    }

    function taskRow(row, columns, exportCtx, track) {
      const tr = createElement('tr', null, row.completed ? 'cx-dates-row cx-dates-row--done' : 'cx-dates-row');
      const cells = exportCtx ? exportRows.taskCells(row, exportCtx) : null;
      tr.append(createElement('td', cells ? cells.name : row.label));
      tr.append(createElement('td', window.ConnectifyProgressWeekEditor.weekCell(row.task, row.siblings, row.subjectName, onWeekSaved), 'cx-dates-when'));
      if (cells) {
        tr.append(createElement('td', cells.day), createElement('td', cells.date));
        return tr;
      }
      if (columns.subject) tr.append(createElement('td', taskCells.subjectText(row), 'cx-dates-subject-cell'));
      tr.append(createElement('td', taskCells.typeSelect(row, track)));
      if (columns.grade) tr.append(createElement('td', columns.predicted ? taskCells.predictedText(row) : taskCells.gradeText(row), 'cx-dates-grade'));
      return tr;
    }

    function table(groups, view, exportCtx, track) {
      // A subject heading already names the subject; a Show choice with no marked tasks lists no grades, only predicted ones
      const predicted = dates.showsPredicted(view.groupBy);
      const columns = { subject: view.groupBy !== 'subject', grade: predicted || dates.listsMarks(view.show), predicted };
      const rightHalf = exportCtx ? ['Day', 'Export Date'] : [...(columns.subject ? ['Subject'] : []), 'Type', ...(columns.grade ? [predicted ? 'Predicted' : 'Mark'] : [])];
      const headers = ['Assessment', 'Date', ...rightHalf];
      const el = createElement('table', null, 'cx-dates-table');
      const head = createElement('tr', null, 'cx-dates-head');
      const columnClass = { Assessment: 'cx-dates-col-name', Date: 'cx-dates-col-when', Mark: 'cx-dates-col-grade', Predicted: 'cx-dates-col-grade' };
      headers.forEach(h => head.append(createElement('th', h, columnClass[h] || null)));
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
        item.rows.forEach(row => el.append(taskRow(row, columns, exportCtx, track)));
      }
      return el;
    }

    function emptyText(rows, view) {
      if (!rows.length) return 'No assessments found. Expand subjects in Connect to load data.';
      if (!rows.some(row => dates.isShown(row, view))) return 'All tasks are hidden.';
      const none = dates.pick(dates.SHOWS, view.show).none;
      return none || (view.groupBy === 'achieved' ? 'No marked assessments.' : view.groupBy === 'predicted' ? 'No unmarked assessments.' : 'No assessments.');
    }

    function render(force = false) {
      if (panel.hidden || section.hidden) return;
      // Never rebuilt under a week being typed: the input commits on blur, Enter or Escape
      const active = document.activeElement;
      if (!force && section.contains(active) && active.tagName === 'INPUT' && active.type === 'number') return;
      const subjects = window.ConnectifyData ? window.ConnectifyData.collectClasses(true) : [];
      const year = window.ConnectifyPastYearMode?.year() ?? new Date().getFullYear();
      const early = terms.earlyEaster(year);
      const exportView = window.ConnectifyExportView;
      const exporting = Boolean(exportView?.active());
      if (exporting && !wasExporting) exportShow = 'uncompleted';
      wasExporting = exporting;
      const saved = dates.readView();
      const view = dates.effectiveView(exporting ? { ...saved, show: exportShow } : saved);
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
      paintControls(view);
      expandSlot.replaceChildren(...(uncached ? [window.ConnectifyTargetUiHelpers.expandOutlinesButton({ scanAndRefresh: () => render(true) })] : []));
      paintFilters(rows, view);
      // What is hidden from the list is left out of the downloads too
      const exportCtx = exporting ? exportView.prepare(dates.shownSubjects(subjects, view, rows), track) : null;
      const groups = dates.arrange(rows, view);
      list.replaceChildren(groups.length ? table(groups, view, exportCtx, track) : createElement('p', emptyText(rows, view), 'cx-dates-empty'));
      if (focusId && focusables.has(focusId)) focusables.get(focusId).focus();
    }

    // A saved week moves the task here, on the graph and in the files
    function onWeekSaved() {
      render(true);
      refs.refresh?.(true);
    }

    for (const evt of ['connectify-results-updated', 'connectify-predictions-updated', 'connectify-settings-updated', 'connectify-terms-updated']) {
      window.addEventListener(evt, () => render());
    }
    // A saved type can add a class category, which changes the options of rows whose own type stayed put
    window.addEventListener('connectify-task-type-changed', () => render(true));

    window.ConnectifyTaskDatesView = { section, toolbar, filterRow, list, optionsSlot, footerSlot, render, hasUncachedClasses };
  } catch (err) {
    console.error('Connectify error in task-dates-view.js:', err);
  }
})();

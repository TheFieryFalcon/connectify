/**
 * Connectify Next Up: view
 *
 * The Year Progression panel's Next Up tab (#cx-next-up): one table, drawn like the Task Dates list, of this week's and
 * next week's assessments, each with its subject, type (the outline rows' own dropdown), weight, Low / Mid / High
 * prediction, or its grade once marked, and what an active goal asks of it (no Goal column when no goal covers these
 * tasks). A week is edited on Task Dates, which a note points to when unmarked tasks have none.
 * Exposes window.ConnectifyNextUpView.
 */
(() => {
  'use strict';

  try {
    if (window.ConnectifyNextUpView) return;
    const refs = window.ConnectifyProgress?.panelRefs;
    const panel = refs?.panel;
    if (!panel) return;

    const createElement = window.ConnectifyProgressChart.createElement;
    const model = window.ConnectifyNextUp;
    const taskCells = window.ConnectifyTaskDatesCells;

    const section = document.getElementById('cx-next-up') || createElement('section', null, 'cx-next-up');
    section.id = 'cx-next-up';
    section.hidden = true;
    section.setAttribute('aria-label', 'Next up');
    if (!panel.contains(section)) panel.append(section);

    const expandSlot = createElement('div', null, 'cx-next-expand');
    const list = createElement('div', null, 'cx-next-list');
    const noteSlot = createElement('div', null, 'cx-next-note-slot');
    section.replaceChildren(expandSlot, list, noteSlot);

    let lastSignature = '';
    const percent = value => `${Math.round(value)}%`;

    function predictionCell(row) {
      if (row.completed) return createElement('td', `Grade ${taskCells.gradeText(row)}`, 'cx-next-prediction');
      const cell = createElement('td', row.prediction ? null : '—', 'cx-next-prediction');
      if (!row.prediction) return cell;
      const value = (level, text, tag) => createElement(tag, `${text} ${percent(row.prediction[level])}`, `connectea-forecast-value connectea-forecast-value--${level}`);
      cell.append(value('low', 'Low', 'span'), ' ', value('mid', 'Mid', 'strong'), ' ', value('high', 'High', 'span'));
      return cell;
    }

    function goalCell(row) {
      const cell = createElement('td', row.goal ? null : '—', 'cx-next-goal');
      if (!row.goal) return cell;
      cell.append(createElement('span', percent(row.goal.required), 'cx-next-goal-value'));
      if (row.goal.tier && !row.completed) cell.append(window.ConnectifyGoalModal.tierLabel(row.goal.tier));
      return cell;
    }

    function taskRow(row, showGoal, track) {
      const tr = createElement('tr', null, row.completed ? 'cx-dates-row cx-dates-row--done' : 'cx-dates-row');
      tr.append(
        createElement('td', row.name),
        createElement('td', taskCells.subjectText(row), 'cx-dates-subject-cell'),
        createElement('td', taskCells.typeSelect(row, track)),
        createElement('td', row.weight === null ? '—' : `${Math.round(row.weight * 10) / 10}%`, 'cx-next-weight'),
        predictionCell(row)
      );
      if (showGoal) tr.append(goalCell(row));
      return tr;
    }

    function table(weeks, track) {
      const showGoal = weeks.some(week => week.rows.some(row => row.goal));
      const columns = [['Assessment', 'cx-next-col-name'], ['Subject', 'cx-next-col-subject'], ['Type', 'cx-next-col-type'], ['Weight', 'cx-next-col-weight'], ['Prediction', 'cx-next-col-prediction'], ...(showGoal ? [['Goal', 'cx-next-col-goal']] : [])];
      const el = createElement('table', null, 'cx-dates-table');
      const head = createElement('tr', null, 'cx-dates-head');
      columns.forEach(([text, className]) => head.append(createElement('th', text, className)));
      el.append(head);
      const spanning = (tag, className) => {
        const tr = createElement('tr', null, className);
        const cell = createElement(tag);
        cell.setAttribute('colspan', String(columns.length));
        tr.append(cell);
        el.append(tr);
        return cell;
      };
      for (const week of weeks) {
        const heading = spanning('th', 'cx-dates-group');
        heading.setAttribute('scope', 'colgroup');
        heading.append(createElement('span', week.label), createElement('span', week.detail, 'cx-next-week-detail'));
        if (week.rows.length) week.rows.forEach(row => el.append(taskRow(row, showGoal, track)));
        else spanning('td', 'cx-next-none').textContent = 'No assessments';
      }
      return el;
    }

    function note(undated) {
      if (!undated) return [];
      const line = createElement('p', `${undated} unmarked ${undated === 1 ? 'task has' : 'tasks have'} no week.`, 'cx-next-note');
      const open = createElement('button', 'Set in Task Dates', 'cx-refresh-btn');
      open.type = 'button';
      open.addEventListener('click', e => {
        e.stopPropagation();
        window.ConnectifyProgressTabs.select('dates');
      });
      line.append(open);
      return [line];
    }

    function render(force = false) {
      if (panel.hidden || section.hidden) return;
      const subjects = window.ConnectifyData ? window.ConnectifyData.collectClasses(true) : [];
      const plan = model.build(subjects, model.now());
      const uncached = window.ConnectifyTaskDatesView.hasUncachedClasses(subjects);
      // What the tab shows, not the row's task records: a task elsewhere in the year changes nothing here
      const shown = plan.weeks.map(w => [w.label, w.detail, w.rows.map(r => [r.key, r.name, r.subject, r.type, r.completed, r.score, r.weight, r.prediction, r.goal])]);
      const signature = JSON.stringify([shown, plan.undated, uncached]);
      if (!force && signature === lastSignature) return;
      lastSignature = signature;

      // Focus survives the rebuild, as on Task Dates: a changed Type brings new predictions
      const active = document.activeElement;
      const focusId = section.contains(active) ? active.dataset?.cxFocus : null;
      const focusables = new Map();
      const track = (el, id) => { el.dataset.cxFocus = id; focusables.set(id, el); return el; };

      expandSlot.replaceChildren(...(uncached ? [window.ConnectifyTargetUiHelpers.expandOutlinesButton({ scanAndRefresh: () => render(true) })] : []));
      const empty = !subjects.length ? 'No assessments found. Expand subjects in Connect to load data.' : !plan.weeks.length ? 'No school weeks left this year.' : null;
      list.replaceChildren(empty ? createElement('p', empty, 'cx-next-empty') : table(plan.weeks, track));
      noteSlot.replaceChildren(...note(plan.undated));
      if (focusId && focusables.has(focusId)) focusables.get(focusId).focus();
    }

    for (const evt of ['connectify-results-updated', 'connectify-predictions-updated', 'connectify-settings-updated', 'connectify-terms-updated', 'connectify-goals-evaluated', 'connectify-goals-changed']) {
      window.addEventListener(evt, () => render());
    }
    // A saved type can add a class category, which changes the options of rows whose own type stayed put
    window.addEventListener('connectify-task-type-changed', () => render(true));

    window.ConnectifyNextUpView = { section, list, noteSlot, render };
  } catch (err) {
    console.error('Connectify error in next-up-view.js:', err);
  }
})();

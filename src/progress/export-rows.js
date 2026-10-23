/**
 * Connectify Assessment Export: subject blocks
 *
 * One subject of the export view: its heading (weekday, Select All / None) and a row per upcoming task
 * (tick, week, weekday defaulting to the subject's, export date). A task merged into the semester exam
 * is shown without a tick or weekday, tagged with the exam it is part of. Exposes window.ConnectifyExportRows.
 */
(() => {
  'use strict';

  if (window.ConnectifyExportRows) return;

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const el = (tag, text, cls) => window.ConnectifyProgressChart.createElement(tag, text, cls);

  function daySelect(value, first) {
    const select = el('select', null, 'cx-settings-select');
    const option = (value, label) => Object.assign(document.createElement('option'), { value, textContent: label });
    if (first) select.append(option('', first));
    DAYS.forEach((day, i) => select.append(option(String(i + 1), day)));
    select.value = value ? String(value) : '';
    return select;
  }

  function checkbox(label, checked, onChange) {
    const wrap = el('label', null, 'cx-export-check');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    wrap.append(input, el('span', label));
    return { wrap, input };
  }

  /** ctx: { mergedIn: Map<key, semester>, update(change), track(el, id) }. */
  function subjectBlock(group, { mergedIn, update, track }) {
    const formatDay = window.ConnectifySchoolTerms.formatDay;
    const block = el('div', null, 'cx-export-subject');
    const heading = el('div', null, 'cx-export-subject-head');
    const dayLabel = el('label', null, 'cx-export-day');
    const subjectDay = track(daySelect(group.day), `day:${group.subject}`);
    subjectDay.addEventListener('change', () => update(p => { p.subjectDays = { ...(p.subjectDays || {}), [group.subject]: Number(subjectDay.value) }; }));
    dayLabel.append(el('span', 'Day:'), subjectDay);
    const allTicked = group.tasks.every(t => t.ticked);
    const all = track(el('button', allTicked ? 'Select None' : 'Select All', 'cx-export-all'), `all:${group.subject}`);
    all.type = 'button';
    all.addEventListener('click', () => update(p => {
      const keys = new Set(p.unticked || []);
      for (const t of group.tasks) allTicked ? keys.add(t.key) : keys.delete(t.key);
      p.unticked = Array.from(keys);
    }));
    heading.append(el('strong', group.subject), dayLabel, all);
    block.append(heading);

    for (const task of group.tasks) {
      const row = el('div', null, 'cx-export-task');
      const week = el('span', task.when, 'cx-export-week');
      const date = el('span', formatDay(task.date), 'cx-export-date');
      if (mergedIn.has(task.key)) {
        // Part of the merged semester exam: no tick or day of its own
        row.classList.add('cx-export-task--merged');
        row.setAttribute('aria-disabled', 'true');
        row.append(el('span', task.name, 'cx-export-name'), week, date,
          el('span', `In Semester ${mergedIn.get(task.key)} Exam`, 'cx-export-tag'));
        block.append(row);
        continue;
      }
      const tick = checkbox(task.name, task.ticked, on => update(p => {
        const keys = new Set(p.unticked || []);
        on ? keys.delete(task.key) : keys.add(task.key);
        p.unticked = Array.from(keys);
      }));
      track(tick.input, `tick:${task.key}`);
      const taskDay = track(daySelect(task.day, `Default (${DAYS[group.day - 1]})`), `taskday:${task.key}`);
      taskDay.setAttribute('aria-label', `Day for ${task.name}`);
      taskDay.addEventListener('change', () => update(p => {
        const days = { ...(p.taskDays || {}) };
        if (taskDay.value) days[task.key] = Number(taskDay.value);
        else delete days[task.key];
        p.taskDays = days;
      }));
      row.append(tick.wrap, week, taskDay, date);
      block.append(row);
    }
    return block;
  }

  window.ConnectifyExportRows = { DAYS, daySelect, checkbox, subjectBlock };
})();

/**
 * Connectify Assessment Export: the Task Dates table in Export mode
 *
 * What Export mode adds to a row: a tick on the task's name, a weekday defaulting to its subject's and the export
 * date; and to a group heading: Select All / None, and the subject's weekday when grouped by Subject. A task merged
 * into the semester exam has no tick or weekday, tagged with the exam it is part of; a task with no week or past
 * Term 4 has no tick. Exposes window.ConnectifyExportRows.
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
    const wrap = el('label', null, 'cx-dates-check');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    wrap.append(input, el('span', label));
    return { wrap, input };
  }

  /** Select All / None over the tickable tasks among `keys`. */
  function selectAll(keys, ctx, id) {
    const tickable = keys.filter(key => ctx.items.get(key)?.date);
    const allTicked = tickable.length > 0 && tickable.every(key => ctx.items.get(key).ticked);
    const btn = ctx.track(el('button', allTicked ? 'Select None' : 'Select All', 'cx-export-all'), id);
    btn.type = 'button';
    btn.disabled = !tickable.length;
    btn.addEventListener('click', () => ctx.update(p => {
      const unticked = new Set(p.unticked || []);
      for (const key of tickable) allTicked ? unticked.add(key) : unticked.delete(key);
      p.unticked = Array.from(unticked);
    }));
    return btn;
  }

  /** A group heading in Export mode. ctx: { items: Map<key, item>, mergedIn, subjectDays, update, track }. */
  function groupHead(group, view, ctx) {
    const head = el('div', null, 'cx-export-group-head');
    head.append(el('span', group.label, 'cx-export-group-name'));
    if (view.groupBy === 'subject') {
      const dayLabel = el('label', null, 'cx-export-day');
      const subjectDay = ctx.track(daySelect(ctx.subjectDays[group.label] || 1), `day:${group.label}`);
      subjectDay.addEventListener('change', () => ctx.update(p => { p.subjectDays = { ...(p.subjectDays || {}), [group.label]: Number(subjectDay.value) }; }));
      dayLabel.append(el('span', 'Day:'), subjectDay);
      head.append(dayLabel);
    }
    head.append(selectAll(group.rows.map(r => r.key), ctx, `all:${group.label}`));
    return head;
  }

  /** `{ name, day, date, merged }`: the cells Export mode gives one row. */
  function taskCells(row, ctx) {
    const formatDay = window.ConnectifySchoolTerms.formatDay;
    const item = ctx.items.get(row.key);
    const plainName = el('span', row.name, 'cx-export-name');
    const blank = () => el('span', null);
    if (!item?.date) {
      return { name: plainName, day: item?.reason === 'afterTerm4' ? el('span', 'After Term 4', 'cx-export-tag') : blank(), date: blank(), merged: false };
    }
    const date = el('span', formatDay(item.date), 'cx-export-date');
    if (ctx.mergedIn.has(item.key)) {
      // Part of the merged semester exam: no tick or day of its own
      return { name: plainName, day: el('span', `In Semester ${ctx.mergedIn.get(item.key)} Exam`, 'cx-export-tag'), date, merged: true };
    }
    const tick = checkbox(row.name, item.ticked, on => ctx.update(p => {
      const keys = new Set(p.unticked || []);
      on ? keys.delete(item.key) : keys.add(item.key);
      p.unticked = Array.from(keys);
    }));
    ctx.track(tick.input, `tick:${item.key}`);
    const subjectDay = ctx.subjectDays[row.subject] || 1;
    const taskDay = ctx.track(daySelect(item.day, `Default (${DAYS[subjectDay - 1]})`), `taskday:${item.key}`);
    taskDay.setAttribute('aria-label', `Day for ${row.name}`);
    taskDay.addEventListener('change', () => ctx.update(p => {
      const days = { ...(p.taskDays || {}) };
      if (taskDay.value) days[item.key] = Number(taskDay.value);
      else delete days[item.key];
      p.taskDays = days;
    }));
    return { name: tick.wrap, day: taskDay, date, merged: false };
  }

  window.ConnectifyExportRows = { DAYS, daySelect, checkbox, selectAll, groupHead, taskCells };
})();

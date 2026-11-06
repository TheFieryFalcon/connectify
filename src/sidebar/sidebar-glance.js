/**
 * Connectify Sidebar: Next Up and Awaiting Results under the launcher buttons
 *
 * One widget at the bottom of the launcher menu, Assessment Outlines only, from the cache. Next Up: unmarked tasks in
 * this week and next week, soonest first. Awaiting Results: unmarked tasks whose week has passed, latest first, leaving
 * out a semester with final grades, which will never mark them, and 0% rows. At most three rows each; a list with
 * nothing to show is left out, and the widget with it when both have nothing.
 * Exposes window.ConnectifySidebarGlance.
 */
(() => {
  'use strict';

  try {
    if (window.ConnectifySidebarGlance) return;

    const MAX_ROWS = 3;
    const byText = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

    const weightText = task => (Number.isFinite(task.weight) && task.weight > 0 ? `${Math.round(task.weight * 10) / 10}%` : '');
    const subjectText = row => window.ConnectifyUtils.cleanSubjectName(row.subject) || row.subject;
    const line = (...parts) => parts.filter(Boolean).join(', ');

    // The last school week a row's caption runs to ("Term 4 Week 5-6"), unless a week override moved the task off it
    function lastWeek(row) {
      const helpers = window.ConnectifyParseHelpers;
      const caption = row.task.caption;
      const span = caption ? helpers?.weekSpan?.(caption) || 0 : 0;
      if (!span) return row.at;
      const start = window.ConnectifySchoolTerms.normalizeOrder(helpers.orderHint(caption));
      return start === row.at ? row.at + span : row.at;
    }

    function hasFinalGrades(row, registry) {
      return Boolean(registry[row.subjectName]?.[row.task.semester || 1]?.finalLetter);
    }

    /** `{ nextUp, awaiting }`, each at most three `{ key, name, detail }`. */
    function build(subjects, today) {
      const T = window.ConnectifySchoolTerms;
      const registry = window.ConnectifyClassSemesters?.get?.() || {};
      const week = window.ConnectifyNextUp.weeks(today);
      const now = T.orderOf(T.utc(today.getFullYear(), today.getMonth(), today.getDate()));
      const unmarked = window.ConnectifyTaskDates.rows(subjects)
        .filter(row => !row.completed && row.task.weight !== 0 && Number.isFinite(row.at));

      const nextUp = unmarked
        .map(row => ({ row, when: week.find(w => w.order === Math.floor(row.at)) }))
        .filter(item => item.when)
        .sort((a, b) => a.row.at - b.row.at || byText(a.row.subject, b.row.subject) || a.row.sequence - b.row.sequence)
        .slice(0, MAX_ROWS)
        .map(({ row, when }) => ({ key: row.key, name: row.label, detail: line(subjectText(row), weightText(row.task), when.label) }));

      const awaiting = unmarked
        .filter(row => lastWeek(row) < Math.floor(now) && !hasFinalGrades(row, registry))
        .sort((a, b) => b.at - a.at || byText(a.subject, b.subject) || a.sequence - b.sequence)
        .slice(0, MAX_ROWS)
        .map(row => ({ key: row.key, name: row.label, detail: line(subjectText(row), window.ConnectifyProgressMath.shortTimestamp(row.task.order, row.task.caption)) }));

      return { nextUp, awaiting };
    }

    function element(tag, className, text) {
      const el = document.createElement(tag);
      el.className = className;
      if (text !== undefined) el.textContent = text;
      return el;
    }

    function listOf(title, rows) {
      if (!rows.length) return [];
      const list = element('ul', 'cx-glance-list');
      for (const row of rows) {
        const item = element('li', 'cx-glance-row');
        item.append(element('span', 'cx-glance-name', row.name), element('span', 'cx-glance-detail', row.detail));
        list.append(item);
      }
      return [element('h3', 'cx-glance-heading', title), list];
    }

    let widget = null;
    let lastSignature = null;
    let wasShown = false;

    function render() {
      const sidebar = document.getElementById('connectify-sidebar');
      if (!sidebar || !window.ConnectifyUtils.isOutlinesPage()) return;
      if (!widget) {
        widget = element('section', 'cx-glance');
        widget.id = 'cx-sidebar-glance';
        widget.setAttribute('aria-label', 'Next Up and Awaiting Results');
        widget.hidden = true;
      }
      if (widget.parentElement !== sidebar) sidebar.append(widget);
      const plan = build(window.ConnectifyData?.collectClasses(true) || [], window.ConnectifyNextUp.now());
      const signature = JSON.stringify(plan);
      if (signature === lastSignature) return;
      lastSignature = signature;
      widget.replaceChildren(...listOf('Next Up', plan.nextUp), ...listOf('Awaiting Results', plan.awaiting));
      widget.hidden = !plan.nextUp.length && !plan.awaiting.length;
    }

    /** From the drawer's sync, which runs every 1.5s: reads the cache only as the launcher menu comes into view. */
    function sync(shown) {
      // A past year has nothing coming up and nothing awaiting
      if (window.ConnectifyPastYearMode?.active()) { if (widget) widget.hidden = true; return; }
      if (shown && !wasShown) render();
      wasShown = shown;
    }

    const whileShown = () => { if (wasShown) render(); };
    for (const evt of ['connectify-results-updated', 'connectify-settings-updated', 'connectify-terms-updated', 'connectify-week-override-saved', 'connectify-outlines-loaded']) {
      window.addEventListener(evt, whileShown);
    }

    window.ConnectifySidebarGlance = { MAX_ROWS, build, render, sync };
  } catch (err) {
    console.error('Connectify error in sidebar-glance.js:', err);
  }
})();

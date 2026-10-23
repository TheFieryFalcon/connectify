/**
 * Connectify Assessment Export: Notion CSV
 *
 * One RFC 4180 CSV (UTF-8 with BOM) that Notion imports as a database: a row per ticked task. With
 * merging on, a semester's two or more Exam-type tasks become one "Semester N Exam" row whose Date is
 * the span "June 8, 2026 → June 19, 2026" (Notion's date range). Dates read "May 25, 2026", which
 * Notion's importer takes as a date.
 * Exposes window.ConnectifyExportCsv.
 */
(() => {
  'use strict';

  if (window.ConnectifyExportCsv) return;

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const HEADER = ['Name', 'Date', 'Subject', 'Type', 'Weight (%)', 'Term / Week'];

  const cell = value => {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const dateText = date => `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;

  /** items: ticked, dated tasks in list order; opts: { merge }. */
  function build(items, opts = {}) {
    const merged = opts.merge ? window.ConnectifyExportTasks.examGroups(items) : [];
    const inMerge = new Set(merged.flatMap(g => g.exams.map(e => e.key)));
    const rows = [HEADER];
    for (const item of items) {
      if (!item.date || inMerge.has(item.key)) continue;
      const weight = item.weight !== null && item.weight !== undefined ? Math.round(item.weight * 100) / 100 : '';
      rows.push([`${item.name} (${item.subject})`, dateText(item.date), item.subject, item.type, weight, item.when]);
    }
    for (const group of merged) {
      const first = group.exams[0], last = group.exams[group.exams.length - 1];
      const subjects = Array.from(new Set(group.exams.map(e => e.subject))).join(', ');
      const when = first.when === last.when ? first.when : `${first.when} – ${last.when}`;
      rows.push([`Semester ${group.semester} Exam`, `${dateText(group.start)} → ${dateText(group.end)}`, subjects, 'Exam', '', when]);
    }
    return '﻿' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
  }

  window.ConnectifyExportCsv = { build, HEADER };
})();

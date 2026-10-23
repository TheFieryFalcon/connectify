/**
 * Connectify Assessment Export: Notion CSV
 *
 * One RFC 4180 CSV (UTF-8 with BOM) that Notion imports as a database: a row per ticked task
 * (exams are never merged here). Dates read "May 25, 2026", which Notion's importer takes as a date.
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

  /** items: ticked, dated tasks in list order. */
  function build(items) {
    const rows = [HEADER];
    for (const item of items) {
      if (!item.date) continue;
      const weight = item.weight !== null && item.weight !== undefined ? Math.round(item.weight * 100) / 100 : '';
      rows.push([`${item.name} (${item.subject})`, dateText(item.date), item.subject, item.type, weight, item.when]);
    }
    return '﻿' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
  }

  window.ConnectifyExportCsv = { build, HEADER };
})();

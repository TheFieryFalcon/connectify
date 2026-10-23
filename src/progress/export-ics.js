/**
 * Connectify Assessment Export: iCalendar (.ics)
 *
 * One RFC 5545 calendar ("Connectify Assessments") of all-day events, for Google Calendar, Apple
 * Calendar and Outlook. UIDs are stable per account, year and task, so a re-import never duplicates.
 * With merging on, a semester's two or more Exam-type tasks become one "Semester N Exam" span.
 * Exposes window.ConnectifyExportIcs.
 */
(() => {
  'use strict';

  if (window.ConnectifyExportIcs) return;

  const CALENDAR_NAME = 'Connectify Assessments';
  const pad = n => String(n).padStart(2, '0');
  const ymd = date => `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
  const stamp = date => `${ymd(date)}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
  const nextDay = date => new Date(date.getTime() + 86400000);

  const escapeText = text => String(text ?? '')
    .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

  /** Two FNV-1a passes: a 64-bit hex id that stays the same for the same input. */
  function hash(text) {
    let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      a = Math.imul(a ^ c, 0x01000193) >>> 0;
      b = Math.imul(b ^ c, 0x01000193 + 2) >>> 0;
    }
    return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
  }

  const byteLength = ch => {
    const code = ch.codePointAt(0);
    return code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  };

  /** Folds a content line at 75 octets (continuations start with a space), never inside a character. */
  function fold(line) {
    const out = [];
    let current = '', size = 0, limit = 75;
    for (const ch of line) {
      const len = byteLength(ch);
      if (size + len > limit) {
        out.push(current);
        current = ' ';
        size = 1;
        limit = 75;
      }
      current += ch;
      size += len;
    }
    out.push(current);
    return out.join('\r\n');
  }

  const weightText = weight => `${Math.round(weight * 100) / 100}%`;
  const title = item => `${item.name} (${item.subject})`;

  function event(lines, { uid, start, end, summary, description, now }) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}@connectify`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${ymd(start)}`,
      `DTEND;VALUE=DATE:${ymd(nextDay(end))}`,
      `SUMMARY:${escapeText(summary)}`
    );
    if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
    lines.push('TRANSP:TRANSPARENT', 'END:VEVENT');
  }

  /** items: ticked, dated tasks in list order; opts: { account, year, merge, now }. */
  function build(items, opts = {}) {
    const now = opts.now || new Date();
    const prefix = `${opts.account || 'current'}|${opts.year}|`;
    const merged = opts.merge ? window.ConnectifyExportTasks.examGroups(items) : [];
    const inMerge = new Set(merged.flatMap(g => g.exams.map(e => e.key)));
    const formatDay = window.ConnectifySchoolTerms.formatDay;
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Connectify//Assessments//EN',
      'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${CALENDAR_NAME}`
    ];

    for (const item of items) {
      if (!item.date || inMerge.has(item.key)) continue;
      const details = [];
      if (item.type) details.push(`Type: ${item.type}`);
      if (item.weight !== null && item.weight !== undefined) details.push(`Weight: ${weightText(item.weight)}`);
      if (item.caption) details.push(item.caption);
      event(lines, {
        uid: hash(prefix + item.key), start: item.date, end: item.date,
        summary: title(item), description: details.join('\n'), now
      });
    }
    for (const group of merged) {
      event(lines, {
        uid: hash(`${prefix}s${group.semester}-exam`), start: group.start, end: group.end,
        summary: `Semester ${group.semester} Exam`,
        description: group.exams.map(e => `${formatDay(e.date)}: ${title(e)}`).join('\n'), now
      });
    }

    lines.push('END:VCALENDAR');
    return lines.map(fold).join('\r\n') + '\r\n';
  }

  window.ConnectifyExportIcs = { build, fold, escapeText, hash, CALENDAR_NAME };
})();

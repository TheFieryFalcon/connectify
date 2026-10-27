/**
 * Connectify Predictor Chronological Date Resolution
 *
 * Resolves custom chronological week dates, terms, and sequence stamps.
 * Exposes window.ConnectifyPredictorDates.
 */
(() => {
  'use strict';

  try {
    const round = (val, decimals = 1) => (window.ConnectifyPredictorEngine?.round || ((v, d = 1) => Number(Math.round(v + 'e' + d) + 'e-' + d)))(val, decimals);
    const cleanSubject = (...args) => (window.ConnectifyPredictorEngine?.cleanSubject || (s => String(s || '').trim()))(...args);
  // --- DATE RESOLUTION & PROGRESS GRAPH SYNC ---
  // Saved week overrides, lower-cased, for the case-insensitive match. Scanning every storage key per task
  // made each cohort pass seconds long on slow machines, so the index is rebuilt only when keys change
  let overrideCache = null;
  const dropOverrideIndex = () => { overrideCache = null; };
  window.addEventListener?.('connectify-week-override-saved', dropOverrideIndex);
  window.addEventListener?.('storage', dropOverrideIndex);
  function overrideIndex() {
    const length = localStorage.length;
    if (overrideCache?.length === length) return overrideCache.entries;
    const entries = [];
    const prefixLength = window.ConnectifyUtils.userKey('').length;
    for (const k of window.ConnectifyUtils.userKeys(key => key.startsWith('connectea:time_override:') || key.startsWith('connectify:time_override:'))) {
      const parts = k.slice(prefixLength).split(':');
      if (parts.length >= 4) entries.push({ k, s: parts[2].toLowerCase().trim(), t: parts.slice(3).join(':').toLowerCase().trim() });
    }
    overrideCache = { length, entries };
    return entries;
  }

  function resolveCustomDate(subjectName, taskOrName, taskId) {
    if (!taskOrName) return null;
    const taskName = typeof taskOrName === 'string' ? taskOrName : (taskOrName.name || '');
    const actualTaskId = typeof taskOrName === 'object' && taskOrName ? (taskOrName.id || taskId) : taskId;
    const cleanSubj = cleanSubject(subjectName);

    if (actualTaskId) {
      const idCandidates = [
        window.ConnectifyUtils.userKey(`connectea:time_override:${subjectName}:${actualTaskId}`),
        window.ConnectifyUtils.userKey(`connectea:time_override:${cleanSubj}:${actualTaskId}`),
        window.ConnectifyUtils.userKey(`connectify:time_override:${subjectName}:${actualTaskId}`),
        window.ConnectifyUtils.userKey(`connectify:time_override:${cleanSubj}:${actualTaskId}`)
      ];
      for (const key of idCandidates) {
        try {
          const val = localStorage.getItem(key);
          if (val !== null) return val.trim();
        } catch (e) {}
      }
    }

    if (taskName) {
      const candidates = [
        window.ConnectifyUtils.userKey(`connectea:time_override:${subjectName}:${taskName}`),
        window.ConnectifyUtils.userKey(`connectea:time_override:${cleanSubj}:${taskName}`),
        window.ConnectifyUtils.userKey(`connectify:time_override:${subjectName}:${taskName}`),
        window.ConnectifyUtils.userKey(`connectify:time_override:${cleanSubj}:${taskName}`)
      ];
      for (const key of candidates) {
        try {
          const val = localStorage.getItem(key);
          if (val !== null) return val.trim();
        } catch (e) {}
      }
    }
    try {
      const lowerTask = taskName.toLowerCase().trim();
      const lowerSubj = subjectName ? subjectName.toLowerCase().trim() : '';
      const lowerClean = cleanSubj ? cleanSubj.toLowerCase().trim() : '';
      for (const { k, s, t } of overrideIndex()) {
        if ((!lowerSubj || s === lowerSubj || s === lowerClean) && (t === lowerTask || (actualTaskId && t === String(actualTaskId).toLowerCase().trim()))) {
          const val = localStorage.getItem(k);
          if (val !== null) return val.trim();
        }
      }
    } catch (e) {}
    return null;
  }

  function formatCustomWeek(val) {
    if (!val) return null;
    const str = String(val).trim();

    // 1. Check for Term X Week Y format (e.g. "t3w5", "Term 3, Week 5", "t2 w7")
    const twMatch = str.match(/t(?:erm)?\s*(\d+)\s*[,;]?\s*w(?:eek)?\s*(\d+)/i);
    if (twMatch) {
      const term = parseInt(twMatch[1], 10);
      const week = parseInt(twMatch[2], 10);
      return {
        term,
        week,
        order: (term - 1) * 12 + week,
        display: `Term ${term}, Week ${week}`
      };
    }

    // 2. Check for numeric school week (e.g. 17 for Term 2 Week 5, matching Progress Graph schedule)
    const num = Number(str.replace(/^[^\d]*/, '').replace(/[^\d]*$/, ''));
    if (Number.isFinite(num) && num > 0) {
      if (window.ConnectifyProgressMath?.formatTimestamp) {
        return {
          order: num,
          display: window.ConnectifyProgressMath.formatTimestamp(num)
        };
      }
      const term = Math.floor((num - 1) / 12) + 1;
      const week = Math.floor((num - 1) % 12) + 1;
      return {
        term,
        week,
        order: num,
        display: `Term ${term}, Week ${week}`
      };
    }

    return null;
  }

  /** A Progress Graph override (school week of the year, "w17" or an older bare "17", or "t2w7") as { term, week, order, display }. */
  function formatOverrideWeek(val) {
    const order = window.ConnectifyUtils.customWeekOrder(val);
    if (order === null) return null;
    const term = Math.floor((order - 1) / 12) + 1;
    const week = ((order - 1) % 12) + 1;
    return { term, week, order, display: `Term ${term}, Week ${week}` };
  }

  function hasParsableDate(task, subjectName) {
    if (!task) return false;
    const sName = subjectName || task.subjectName;
    const customTime = resolveCustomDate(sName, task);
    if (customTime !== null) {
      if (customTime === '') return false;
      const formatted = formatOverrideWeek(customTime);
      return Boolean(formatted);
    }
    if (task.customDate) return true;
    if (Number.isFinite(task.order) && task.order > 0) return true;

    const text = task.caption || '';
    if (!text) return false;
    if (/term\s*\d.*?week[s]?\s*\d+/i.test(text)) return true;
    if (/weeks?\s*\d+(?:\s*(?:&|and|[\/–-])\s*\d+)?\s*[,;]?\s*term\s*\d/i.test(text)) return true;
    if (/^(?:week[s]?\s*)?(\d{1,2})(?:\s*[\/–-]\s*\d{1,2})?$/i.test(text.trim())) return true;
    if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(text)) return true;
    return false;
  }

  // --- CHRONOLOGICAL HISTORICAL PREDICTION ENGINE ---
  // While a batch runs (withStampMemo), each task's stamp is worked out once: a full recompute asks for
  // every task's stamp once per other task, and each lookup without an override scans localStorage
  let stampMemo = null;

  function withStampMemo(fn) {
    if (stampMemo) return fn();
    stampMemo = new WeakMap();
    try { return fn(); } finally { stampMemo = null; }
  }

  function getTaskChronologicalStamp(task, subjectName) {
    if (!task) return 0;
    const memo = stampMemo && typeof task === 'object' ? stampMemo.get(task) : null;
    if (memo && memo.has(subjectName)) return memo.get(subjectName);
    const stamp = computeStamp(task, subjectName);
    if (stampMemo && typeof task === 'object') {
      if (!memo) stampMemo.set(task, new Map([[subjectName, stamp]]));
      else memo.set(subjectName, stamp);
    }
    return stamp;
  }

  function computeStamp(task, subjectName) {
    const semester = Number(task.semester) || 1;

    let order = null;
    if (subjectName && (task.name || task.id)) {
      const customTime = resolveCustomDate(subjectName, task);
      if (customTime !== null) {
        const formatted = formatOverrideWeek(customTime);
        if (formatted && Number.isFinite(formatted.order)) {
          order = formatted.order;
        }
      }
    }

    if (order === null && Number.isFinite(task.order) && task.order > 0) {
      order = task.order;
    }

    if (order === null && task.caption) {
      const formatted = formatCustomWeek(task.caption);
      if (formatted && Number.isFinite(formatted.order)) {
        order = formatted.order;
      }
    }

    // The school week (1-40) already spans the year, so it alone orders dated tasks: an unmarked row read
    // from the page carries no semester, and must not sort a Term 4 task before Semester 2's results
    const seq = Number.isFinite(task.sequence) ? task.sequence : 0;
    if (order !== null) {
      return order * 10 + seq * 0.01;
    }
    return (semester === 2 ? 190 : 0) + seq * 10;
  }

  /**
   * Aggregates historical subject, type, and overall statistics strictly from tasks
   * that took place chronologically BEFORE the target task.
   */

    window.ConnectifyPredictorDates = {
      resolveCustomDate,
      formatCustomWeek,
      formatOverrideWeek,
      hasParsableDate,
      getTaskChronologicalStamp,
      withStampMemo
    };
  } catch (err) {
    console.error('Connectify error in predictor-dates.js:', err);
  }
})();

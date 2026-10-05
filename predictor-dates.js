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
  function resolveCustomDate(subjectName, taskOrName, taskId) {
    if (!taskOrName) return null;
    const taskName = typeof taskOrName === 'string' ? taskOrName : (taskOrName.name || '');
    const actualTaskId = typeof taskOrName === 'object' && taskOrName ? (taskOrName.id || taskId) : taskId;
    const cleanSubj = cleanSubject(subjectName);

    if (actualTaskId) {
      const idCandidates = [
        `connectea:time_override:${subjectName}:${actualTaskId}`,
        `connectea:time_override:${cleanSubj}:${actualTaskId}`,
        `connectify:time_override:${subjectName}:${actualTaskId}`,
        `connectify:time_override:${cleanSubj}:${actualTaskId}`
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
        `connectea:time_override:${subjectName}:${taskName}`,
        `connectea:time_override:${cleanSubj}:${taskName}`,
        `connectify:time_override:${subjectName}:${taskName}`,
        `connectify:time_override:${cleanSubj}:${taskName}`
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
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('connectea:time_override:') || k.startsWith('connectify:time_override:'))) {
          const parts = k.split(':');
          if (parts.length >= 4) {
            const s = parts[2].toLowerCase().trim();
            const t = parts.slice(3).join(':').toLowerCase().trim();
            if ((!lowerSubj || s === lowerSubj || s === lowerClean) && (t === lowerTask || (actualTaskId && t === String(actualTaskId).toLowerCase().trim()))) {
              const val = localStorage.getItem(k);
              if (val !== null) return val.trim();
            }
          }
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

  function hasParsableDate(task, subjectName) {
    if (!task) return false;
    const sName = subjectName || task.subjectName;
    const customTime = resolveCustomDate(sName, task);
    if (customTime !== null) {
      if (customTime === '') return false;
      const formatted = formatCustomWeek(customTime);
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
  function getTaskChronologicalStamp(task, subjectName) {
    if (!task) return 0;
    const semester = Number(task.semester) || 1;

    let order = null;
    if (subjectName && (task.name || task.id)) {
      const customTime = resolveCustomDate(subjectName, task);
      if (customTime !== null) {
        const formatted = formatCustomWeek(customTime);
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

    const seq = Number.isFinite(task.sequence) ? task.sequence : 0;
    if (order !== null) {
      return semester * 1000 + order * 10 + seq * 0.01;
    }
    return semester * 1000 + seq * 10;
  }

  /**
   * Aggregates historical subject, type, and overall statistics strictly from tasks
   * that took place chronologically BEFORE the target task.
   */

    window.ConnectifyPredictorDates = {
      resolveCustomDate,
      formatCustomWeek,
      hasParsableDate,
      getTaskChronologicalStamp
    };
  } catch (err) {
    console.error('Connectify error in predictor-dates.js:', err);
  }
})();

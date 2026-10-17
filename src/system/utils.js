/**
 * Connectify Shared Utilities
 *
 * Text normalisation, HTML escaping, the current account key, localStorage key scanning, legacy baseline key resolution,
 * Progress Graph week overrides and the chart resync request to the main-world bridge
 * shared by every content script. Loaded first in the assessment outlines pipeline.
 * Exposes window.ConnectifyUtils.
 */
(() => {
  'use strict';
  if (window.ConnectifyUtils) return;

  const normalize = text => String(text ?? '').replace(/\s+/g, ' ').trim();

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));

  /** The student account in the current Connect URL (?coisp=...), or 'current'. */
  function accountKey() {
    try {
      return new URL(location.href).searchParams.get('coisp') || 'current';
    } catch {
      return 'current';
    }
  }

  /** Returns every localStorage key accepted by predicate (keys are collected before any removal). */
  function storageKeys(predicate) {
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && predicate(key)) keys.push(key);
      }
    } catch {}
    return keys;
  }

  /** Removes every localStorage key accepted by predicate; returns how many were removed. */
  function removeStorageKeys(predicate) {
    const keys = storageKeys(predicate);
    for (const key of keys) {
      try { localStorage.removeItem(key); } catch {}
    }
    return keys.length;
  }

  // Every prefix baselines have ever been stored under (singular is current, plural is legacy)
  const BASELINE_PREFIXES = ['connectea:baseline:', 'connectea:baselines:', 'connectify:baseline:', 'connectify:baselines:'];

  /**
   * Candidate storage keys for a baseline kind ('types' or 'subjects'), oldest first so that
   * merging them in order lets the current key (connectify:baseline:<kind>:<account>) win.
   */
  function baselineKeys(kind, account) {
    return [
      `connectea:baseline:${kind}`,
      `connectea:baselines:${kind}`,
      `connectify:baseline:${kind}`,
      `connectify:baselines:${kind}`,
      `connectea:baseline:${kind}:${account}`,
      `connectea:baselines:${kind}:${account}`,
      `connectify:baselines:${kind}:${account}`,
      `connectify:baseline:${kind}:${account}`
    ];
  }

  const isBaselineKey = key => BASELINE_PREFIXES.some(prefix => key.startsWith(prefix));

  /**
   * Converts a Progress Graph week override to the internal order (12-week terms, as formatTimestamp reads it).
   * Overrides are typed as school weeks 1-40 with 10-week terms (17 = Term 2 Week 7) or as "t2w7".
   */
  function customWeekOrder(value) {
    const str = String(value ?? '').trim();
    const tw = str.match(/t(?:erm)?\s*(\d+)\s*[,;]?\s*w(?:eek)?\s*(\d+)/i);
    if (tw) return (Number(tw[1]) - 1) * 12 + Number(tw[2]);
    const num = Number(str);
    if (!str || !Number.isFinite(num) || num <= 0) return null;
    return Math.floor((num - 1) / 10) * 12 + ((num - 1) % 10) + 1;
  }

  /** First saved week override for any subject and task id/name pair (ids in priority order), or null. */
  function readTimeOverride(subjects, ids) {
    for (const id of ids) {
      if (!id) continue;
      for (const subject of subjects) {
        if (!subject) continue;
        for (const prefix of ['connectea', 'connectify']) {
          try {
            const value = localStorage.getItem(`${prefix}:time_override:${subject}:${id}`);
            if (value !== null && value !== '') return value;
          } catch {}
        }
      }
    }
    return null;
  }

  /**
   * Asks the main-world bridge (data.js) to re-read every chart's boxplot. The bridge lives in the page's
   * world, so a DOM event is the only way to reach it from here.
   */
  const syncCharts = () => document.dispatchEvent(new CustomEvent('connectify-sync-charts'));

  /** Semester (1 or 2) named in a subject card title; 1 when the title names none. */
  function cardSemester(title) {
    const match = String(title || '').match(/\bSem(?:ester)?\s*([12])\b/i);
    return match ? Number(match[1]) : 1;
  }
  window.ConnectifyDataSyncCharts = syncCharts;

  window.ConnectifyUtils = {
    normalize, escapeHtml, accountKey, storageKeys, removeStorageKeys, BASELINE_PREFIXES, baselineKeys, isBaselineKey,
    customWeekOrder, readTimeOverride, syncCharts, cardSemester
  };
})();

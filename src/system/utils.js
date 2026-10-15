/**
 * Connectify Shared Utilities
 *
 * Text normalisation, the current account key, localStorage key scanning and legacy baseline key resolution
 * shared by every content script. Loaded first in the assessment outlines pipeline.
 * Exposes window.ConnectifyUtils.
 */
(() => {
  'use strict';
  if (window.ConnectifyUtils) return;

  const normalize = text => String(text ?? '').replace(/\s+/g, ' ').trim();

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

  window.ConnectifyUtils = { normalize, accountKey, storageKeys, removeStorageKeys, BASELINE_PREFIXES, baselineKeys, isBaselineKey };
})();

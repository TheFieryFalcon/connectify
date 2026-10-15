/**
 * Connectify Predictor: previous-year baselines store
 *
 * Reads the cold-start baselines (assessment type averages and subject grades) from every legacy key
 * they have been stored under, writes them to the current key, and keeps an in-memory copy that is
 * dropped whenever baselines change. Exposes window.ConnectifyPredictorBaselines.
 */
(() => {
  'use strict';

  const { accountKey, baselineKeys } = window.ConnectifyUtils;
  let cachedBaselines = null;

  // Oldest keys first, so the current key wins when they are merged
  function readMerged(kind, account) {
    let merged = {};
    for (const key of baselineKeys(kind, account)) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key));
        if (parsed && typeof parsed === 'object') merged = { ...merged, ...parsed };
      } catch {}
    }
    return merged;
  }

  function getBaselines() {
    if (cachedBaselines) return cachedBaselines;
    const account = accountKey();
    cachedBaselines = { types: readMerged('types', account), subjects: readMerged('subjects', account) };
    return cachedBaselines;
  }

  function writeKind(kind, account, values) {
    const key = `connectify:baseline:${kind}:${account}`;
    try {
      localStorage.setItem(key, JSON.stringify(values || {}));
      // Legacy and plural copies are removed so a deleted baseline cannot be resurrected
      for (const k of baselineKeys(kind, account)) {
        if (k !== key) {
          try { localStorage.removeItem(k); } catch {}
        }
      }
    } catch {}
  }

  /** Saves types and/or subjects; a half that is not passed keeps its current values. */
  function saveBaselines(updated = {}) {
    const account = accountKey();
    const current = getBaselines();
    if (updated.types !== undefined) writeKind('types', account, updated.types);
    if (updated.subjects !== undefined) writeKind('subjects', account, updated.subjects);
    // Predictions are recomputed below with this copy, before the event drops it
    cachedBaselines = {
      types: updated.types !== undefined ? (updated.types || {}) : current.types,
      subjects: updated.subjects !== undefined ? (updated.subjects || {}) : current.subjects
    };
    (window.ConnectifyPredictorMath?.updatePredictionCache || window.ConnectifyPredictorCache?.updatePredictionCache)?.();
    window.dispatchEvent(new CustomEvent('connectify-baselines-updated', { detail: updated }));
  }

  const invalidate = () => { cachedBaselines = null; };

  if (typeof window.addEventListener === 'function') {
    window.addEventListener('connectify-baselines-updated', invalidate);
    window.addEventListener('storage', e => {
      if (e.key && (e.key.includes('baseline') || e.key.includes('prediction'))) invalidate();
    });
  }

  window.ConnectifyPredictorBaselines = { getBaselines, saveBaselines, invalidate };
})();

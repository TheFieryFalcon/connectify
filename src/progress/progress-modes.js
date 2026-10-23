/**
 * Connectify Progress Graph: data point modes
 *
 * The Progress "Show:" dropdown. Single tasks plots each mark as it is; Weighted average plots
 * the running weighted average of every completed task so far; Rolling average plots the weighted
 * average of the last three completed tasks. The cohort mean is averaged the same way. The choice is
 * kept in connectify:progress_mode. Exposes window.ConnectifyProgressModes.
 */
(() => {
  'use strict';

  if (window.ConnectifyProgressModes) return;

  const KEY = 'connectify:progress_mode';
  const ROLLING_WINDOW = 3;
  const MODES = [
    { id: 'tasks', label: 'Single tasks' },
    { id: 'weighted', label: 'Weighted average', score: 'Your weighted average', mean: 'Cohort weighted average' },
    { id: 'rolling', label: 'Rolling average (last 3)', score: 'Your rolling average', mean: 'Cohort rolling average' }
  ];
  const find = id => MODES.find(m => m.id === id) || MODES[0];

  function read() {
    try { return find(localStorage.getItem(KEY)).id; } catch { return MODES[0].id; }
  }

  function save(mode) {
    try { localStorage.setItem(KEY, find(mode).id); } catch {}
  }

  // A task without a known weight counts as an average task (the mean of the known positive weights)
  function weightResolver(points) {
    const known = points.map(p => p.weight).filter(w => Number.isFinite(w) && w > 0);
    const fallback = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 1;
    return p => (Number.isFinite(p.weight) && p.weight >= 0 ? p.weight : fallback);
  }

  // Weighted mean of key over entries; a set whose weights are all 0 falls back to a plain mean
  function weightedAverage(entries, key, weightOf) {
    if (!entries.length) return null;
    const total = entries.reduce((sum, p) => sum + weightOf(p), 0);
    if (total > 0) return entries.reduce((sum, p) => sum + p[key] * weightOf(p), 0) / total;
    return entries.reduce((sum, p) => sum + p[key], 0) / entries.length;
  }

  /** Points for the chart in the given mode: same order, names, dates and pending flags. */
  function apply(points, mode) {
    const id = find(mode).id;
    if (id === 'tasks' || !Array.isArray(points)) return points;
    const weightOf = weightResolver(points);
    const done = { score: [], mean: [] };
    return points.map(point => {
      if (point.pending || !Number.isFinite(point.score)) return { ...point, score: null, mean: null };
      const out = { ...point };
      for (const key of ['score', 'mean']) {
        if (Number.isFinite(point[key])) done[key].push(point);
        const span = id === 'rolling' ? done[key].slice(-ROLLING_WINDOW) : done[key];
        out[key] = Number.isFinite(point[key]) ? weightedAverage(span, key, weightOf) : null;
      }
      return out;
    });
  }

  /** The "Show:" dropdown; onChange receives the new mode after it is saved. */
  function select(current, onChange) {
    const label = document.createElement('label');
    label.className = 'cx-progress-mode';
    label.append('Show: ');
    const dropdown = document.createElement('select');
    for (const m of MODES) {
      const option = document.createElement('option');
      option.value = m.id;
      option.textContent = m.label;
      dropdown.append(option);
    }
    dropdown.value = find(current).id;
    dropdown.addEventListener('change', () => {
      save(dropdown.value);
      onChange(dropdown.value);
    });
    label.append(dropdown);
    return label;
  }

  window.ConnectifyProgressModes = { KEY, MODES, find, read, save, apply, select };
})();

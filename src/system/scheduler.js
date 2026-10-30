/**
 * Connectify Shared Scheduler
 *
 * One page-wide MutationObserver and one heartbeat for every content script, instead of one observer and
 * timer per module. Mutation records are batched per animation frame (a timeout while the tab is
 * hidden, when frames stop) and handed to each subscriber, filtered by its own test. Subscribers that
 * ask to be muted get nothing while an accordion animates or Expand All runs. Heartbeat tasks skip
 * while the tab is hidden or the user is idle unless they opt out, and can add their own condition
 * (e.g. only while a panel is open). Loaded first in every isolated content-script group; the first
 * copy wins. Exposes window.ConnectifyScheduler.
 */
(() => {
  'use strict';

  if (window.ConnectifyScheduler) return;

  const OBSERVE_OPTIONS = {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'data-highcharts-chart', 'data-connectify-stats']
  };
  const TICK_MS = 500;
  // Batches this small are filtered as they are
  const NESTED_MIN = 50;

  const isMuted = () => Boolean(window.ConnectifyIsAccordionAnimating || window.ConnectifyIsBulkExpanding);
  const isUserActive = () => (typeof window.ConnectifyIsUserActive === 'function' ? window.ConnectifyIsUserActive() : true);

  const subscribers = new Set();
  let pending = [];
  let flushHandle = null;

  /**
   * Drops records inside a subtree added in the same batch: whoever cares about an addition scans the added
   * subtree. Connect rendering its cards adds each node into a parent it added just before, thousands of
   * records that every subscriber's filter walked up the tree for.
   */
  function withoutNested(records) {
    if (records.length < NESTED_MIN) return records;
    const added = new Set();
    for (const r of records) if (r.type === 'childList') for (const n of r.addedNodes) if (n.nodeType === 1) added.add(n);
    if (!added.size) return records;
    return records.filter(r => {
      for (let node = r.target; node; node = node.parentNode) if (added.has(node)) return false;
      return true;
    });
  }

  function flush() {
    flushHandle = null;
    const records = withoutNested(pending);
    pending = [];
    const muted = isMuted();
    for (const sub of [...subscribers]) {
      if (sub.mute && muted) continue;
      const relevant = sub.filter ? records.filter(sub.filter) : records;
      if (!relevant.length) continue;
      try {
        sub.callback(relevant);
      } catch (err) {
        console.warn('Connectify scheduler subscriber error:', err);
      }
    }
  }

  function scheduleFlush() {
    if (flushHandle) return;
    flushHandle = document.hidden || typeof requestAnimationFrame !== 'function'
      ? setTimeout(flush, 100)
      : requestAnimationFrame(flush);
  }

  const observer = new MutationObserver(records => {
    if (!subscribers.size) return;
    pending.push(...records);
    scheduleFlush();
  });

  function observe() {
    const root = document.body || document.documentElement;
    if (root) observer.observe(root, OBSERVE_OPTIONS);
  }

  /**
   * Calls callback(records) once per frame with the page's mutation records that pass filter(record).
   * mute (default true): skip while an accordion animates or Expand All runs. Returns an unsubscribe function.
   */
  function onMutations(callback, { filter = null, mute = true } = {}) {
    const sub = { callback, filter, mute };
    subscribers.add(sub);
    return () => subscribers.delete(sub);
  }

  const tasks = new Set();

  function tick() {
    const now = Date.now();
    for (const task of [...tasks]) {
      if (now - task.last < task.ms) continue;
      if (task.whenVisible && document.hidden) continue;
      if (task.whenActive && !isUserActive()) continue;
      if (task.mute && isMuted()) continue;
      if (task.when && !task.when()) continue;
      task.last = now;
      try {
        task.fn();
      } catch (err) {
        console.warn('Connectify scheduler task error:', err);
      }
    }
  }

  /**
   * Runs fn about every ms milliseconds (in 500ms steps). By default only while the tab is visible and
   * the user is active; when() adds a condition, mute skips animations. Returns a cancel function.
   */
  function every(ms, fn, { whenActive = true, whenVisible = true, mute = false, when = null } = {}) {
    const task = { ms, fn, whenActive, whenVisible, mute, when, last: Date.now() };
    tasks.add(task);
    return () => tasks.delete(task);
  }

  let tickTimer = null;
  const startTicking = () => {
    if (!tickTimer) tickTimer = setInterval(tick, TICK_MS);
  };

  if (document.body) observe();
  else document.addEventListener('DOMContentLoaded', observe);
  startTicking();

  // Pages kept in the back/forward cache stop observing until they are shown again
  window.addEventListener('pagehide', () => {
    observer.disconnect();
    clearInterval(tickTimer);
    tickTimer = null;
  });
  window.addEventListener('pageshow', e => {
    if (!e.persisted) return;
    observe();
    startTicking();
  });

  window.ConnectifyScheduler = { onMutations, every, isMuted, tick, flush, withoutNested };
})();

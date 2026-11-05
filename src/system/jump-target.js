/**
 * Connectify Jump to Subject: where the jump lands
 *
 * A grade notice jumps to a task it announced (any of them: the first row on the card whose parser id,
 * ConnectifyParseHelpers.cardTaskIds, is one of taskIds) and pulses that row; every other jump (the Jump To
 * row, a notice whose tasks are not known) lands on the card's overall row, the subject average panel at the
 * top. The whole card always pulses, and a task row landed on pulses with it. A task row only exists once the
 * card is expanded, so it is looked for until it appears (TASK_WAIT_MS), then the overall row stands in. Used by
 * new-grade.js. Exposes window.ConnectifyJumpTarget.
 */
(() => {
  'use strict';

  if (window.ConnectifyJumpTarget) return;

  const HIGHLIGHT = 'cx-card-jump-highlight';
  const TASK_WAIT_MS = 1500;
  const RETRY_MS = 100;
  const PULSE_MS = 2200;
  const DRAWN_TILES = '#cx-legacy-outlines .eds-c-tile';
  const MEASURING = 'cx-jump-measuring';
  const FOLLOW_MS = 50;
  const SETTLE_MS = 150;
  const CENTRED_PX = 40;
  const MAX_REAIMS = 3;
  const STUDENT_SCROLL = ['wheel', 'touchstart', 'keydown', 'pointerdown'];

  /** The card's overall (summary) row: its first task row outside the task list. */
  function overallRow(card) {
    return Array.from(card?.querySelectorAll?.('.cvr-c-task') || []).find(row => !row.closest('.cvr-c-tasks')) || null;
  }

  /** The first task row on the card whose id is one of taskIds, or null (none given, or rows not shown). */
  function taskRow(card, taskIds) {
    if (!card || !taskIds?.length) return null;
    const wanted = new Set(taskIds);
    const rows = window.ConnectifyParseHelpers?.cardTaskIds?.(card);
    for (const [row, entry] of rows || []) if (wanted.has(entry.id)) return row;
    return null;
  }

  /** Where a jump lands: the task row, else the overall row, else the card. */
  function resolve(card, taskIds) {
    return taskRow(card, taskIds) || overallRow(card) || card;
  }

  // Restarts the pulse by re-adding its class a frame after removing it (no forced reflow)
  function pulse(el) {
    el.classList.remove(HIGHLIGHT);
    requestAnimationFrame(() => el.classList.add(HIGHLIGHT));
    clearTimeout(el._cxJumpPulse);
    el._cxJumpPulse = setTimeout(() => el.classList.remove(HIGHLIGHT), PULSE_MS);
  }

  /**
   * Off-screen drawn outlines skip layout (content-visibility: auto) at a 600px stand-in until first shown, and an
   * expanded one is ~2000px, so a scroll worked out over them landed thousands of pixels short as each grew on the
   * way. The card and every outline above it are laid out for real for the jump, which also makes the browser
   * remember their heights; returns the function that lets them skip layout again.
   */
  function measureAbove(card) {
    const tiles = Array.from(document.querySelectorAll(DRAWN_TILES));
    const above = tiles.slice(0, tiles.indexOf(card) + 1);
    above.forEach(tile => tile.classList.add(MEASURING));
    return () => above.forEach(tile => tile.classList.remove(MEASURING));
  }

  const offCentre = target => {
    const rect = target.getBoundingClientRect();
    return rect.top + rect.height / 2 - window.innerHeight / 2;
  };

  let stopFollowing = null;

  /**
   * Re-aims once the scroll stops if the target has moved (a boxplot or panel arriving above it), until it is
   * centred, or MAX_REAIMS (the page's end can keep it from centring). The student scrolling ends it, as does the next jump.
   */
  function follow(target, done) {
    let lastY = window.scrollY;
    let movedAt = Date.now();
    let reaims = 0;
    let timer = null;
    const stop = () => {
      clearTimeout(timer);
      for (const type of STUDENT_SCROLL) window.removeEventListener(type, stop, true);
      stopFollowing = null;
      done();
    };
    const tick = () => {
      if (window.scrollY !== lastY) {
        lastY = window.scrollY;
        movedAt = Date.now();
      } else if (Date.now() - movedAt >= SETTLE_MS) {
        if (Math.abs(offCentre(target)) <= CENTRED_PX || reaims++ >= MAX_REAIMS) { stop(); return; }
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        movedAt = Date.now();
      }
      timer = setTimeout(tick, FOLLOW_MS);
    };
    for (const type of STUDENT_SCROLL) window.addEventListener(type, stop, { capture: true, passive: true });
    stopFollowing = stop;
    timer = setTimeout(tick, FOLLOW_MS);
  }

  /**
   * Scrolls to the jump's target and pulses the card (and a task row landed on), in a later frame: scrolling straight after the expand click
   * laid the freshly expanded card out synchronously, a ~60ms hitch on the click. Expand All holds the page's
   * scroll while it runs, so a jump made during it waits.
   */
  function go(card, taskIds, startedAt = Date.now()) {
    if (!card) return;
    if (window.ConnectifyIsBulkExpanding) {
      setTimeout(() => go(card, taskIds), RETRY_MS);
      return;
    }
    requestAnimationFrame(() => {
      const row = taskRow(card, taskIds);
      if (!row && taskIds?.length && Date.now() - startedAt < TASK_WAIT_MS) {
        setTimeout(() => go(card, taskIds, startedAt), RETRY_MS);
        return;
      }
      const target = row || overallRow(card) || card;
      stopFollowing?.();
      const release = measureAbove(card);
      // This frame lays them out and records their heights; the scroll is worked out from those in the next
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        pulse(card);
        if (row) pulse(row);
        follow(target, release);
      });
    });
  }

  window.ConnectifyJumpTarget = { TASK_WAIT_MS, overallRow, taskRow, resolve, measureAbove, go };
})();

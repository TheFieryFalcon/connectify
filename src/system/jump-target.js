/**
 * Connectify Jump to Subject: where the jump lands
 *
 * A grade notice jumps to a task it announced (any of them: the first row on the card whose parser id,
 * ConnectifyParseHelpers.cardTaskIds, is one of taskIds) and pulses that row; every other jump (the Jump To
 * row, a notice whose tasks are not known) lands on the card's overall row, the subject average panel at the
 * top. A task row only exists once the card is expanded, so it is looked for until it appears (TASK_WAIT_MS),
 * then the overall row stands in. Used by new-grade.js. Exposes window.ConnectifyJumpTarget.
 */
(() => {
  'use strict';

  if (window.ConnectifyJumpTarget) return;

  const HIGHLIGHT = 'cx-card-jump-highlight';
  const TASK_WAIT_MS = 1500;
  const RETRY_MS = 100;
  const PULSE_MS = 2200;

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
   * Scrolls to the jump's target and pulses it, in the next frame: scrolling straight after the expand click
   * laid the freshly expanded card out synchronously, a ~60ms hitch on the click.
   */
  function go(card, taskIds, startedAt = Date.now()) {
    if (!card) return;
    requestAnimationFrame(() => {
      const row = taskRow(card, taskIds);
      if (!row && taskIds?.length && Date.now() - startedAt < TASK_WAIT_MS) {
        setTimeout(() => go(card, taskIds, startedAt), RETRY_MS);
        return;
      }
      const target = row || overallRow(card) || card;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      pulse(target);
    });
  }

  window.ConnectifyJumpTarget = { TASK_WAIT_MS, overallRow, taskRow, resolve, go };
})();

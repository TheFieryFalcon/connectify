/**
 * Connectify Goals: modal shell
 *
 * The solid dialog the Set as Goal and Goals popups share (the crop prompt's pattern): page dimmed behind,
 * focus moved in and given back to the opener, Escape / close button / a click outside close it, and clicks
 * inside never reach the sidebar's outside-click handler, so the drawer stays open. Also the small shared
 * pieces: elements, the tier label and the horizontal progress bar. Exposes window.ConnectifyGoalModal.
 */
(() => {
  'use strict';

  if (window.ConnectifyGoalModal) return;

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };

  /** The tier's name in its colour (`data-tier`), or nothing without a tier. */
  function tierLabel(tier) {
    const name = window.ConnectifyGoalDifficulty?.name(tier) || (tier === 'achieved' ? 'Achieved' : tier === 'missed' ? 'Missed' : '');
    if (!name) return el('span', 'cx-goal-tier cx-goal-tier--none');
    const label = el('span', 'cx-goal-tier', name);
    label.dataset.tier = tier;
    return label;
  }

  /** A horizontal goal-progress bar: earned / required, in the tier's colour (no segments). */
  function progressBar(progress, tier) {
    const bar = el('div', 'cx-goal-hbar');
    const fill = el('div', 'cx-goal-hbar__fill');
    const share = progress?.required > 0 ? Math.max(0, Math.min(1, progress.earned / progress.required)) : 0;
    fill.style.setProperty('--cx-goal-fill', `${Math.round(share * 1000) / 10}%`);
    bar.dataset.tier = tier || '';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', String(Math.round(share * 100)));
    bar.append(fill);
    return bar;
  }

  const round1 = v => (Number.isFinite(v) ? Math.round(v * 10) / 10 : '—');
  /** "41.2 of 80 weighted points" */
  const pointsText = p => (p && p.required > 0 ? `${round1(p.earned)} of ${round1(p.required)} weighted points` : '');

  let openModal = null;

  /**
   * Opens a dialog: `{ id, title, build(body, close), onClose }`. Only one at a time (opening closes the last).
   * Returns `{ overlay, body, close }`.
   */
  function open({ id, title, build, onClose, opener = document.activeElement }) {
    openModal?.close();
    const overlay = el('div', 'cx-goal-overlay');
    overlay.id = id;
    const dialog = el('div', 'cx-goal-modal');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const head = el('div', 'cx-goal-modal__head');
    const heading = el('strong', 'cx-goal-modal__title', title);
    heading.id = `${id}-title`;
    dialog.setAttribute('aria-labelledby', heading.id);
    const closeBtn = el('button', 'cx-goal-modal__close', '✕');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    head.append(heading, closeBtn);
    const body = el('div', 'cx-goal-modal__body');
    dialog.append(head, body);
    overlay.append(dialog);

    let closed = false;
    const onKey = e => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      close();
    };
    function close() {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      if (openModal?.overlay === overlay) openModal = null;
      if (opener?.isConnected && typeof opener.focus === 'function') opener.focus();
      onClose?.();
    }

    let downOnBackdrop = false;
    overlay.addEventListener('pointerdown', e => { downOnBackdrop = e.target === overlay; });
    overlay.addEventListener('click', e => {
      e.stopPropagation();
      if (e.target === overlay && downOnBackdrop) close();
    });
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', onKey, true);
    document.body.append(overlay);
    build(body, close);
    requestAnimationFrame(() => (dialog.querySelector('button:not([disabled]), select, input') || closeBtn).focus?.());
    openModal = { overlay, body, close };
    return openModal;
  }

  const current = () => openModal;

  window.ConnectifyGoalModal = { el, tierLabel, progressBar, pointsText, round1, open, current };
})();

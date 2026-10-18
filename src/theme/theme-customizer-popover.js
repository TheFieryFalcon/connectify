/**
 * Connectify Theme Customizer: the colour picker as a popover beside the token being edited
 *
 * Clicking a token in the Basic/Full grid opens the picker next to it (below when there is room, else above), so
 * tokens high in the Full list are edited where they are. Clicking the same token again, outside the popover,
 * its close button or Escape closes it; it follows the token while the controls pane scrolls. The picker's own
 * controls (theme-customizer-controls.js) are unchanged. Exposes window.ConnectifyCustomizerPopover.
 */
(() => {
  'use strict';

  if (window.ConnectifyCustomizerPopover) return;

  const GAP = 8;

  // A fixed element is positioned against the nearest ancestor that creates a containing block (the customizer
  // overlay has a backdrop-filter), not always the viewport
  function containingRect(box) {
    for (let el = box.parentElement; el; el = el.parentElement) {
      const cs = getComputedStyle(el);
      if (cs.transform !== 'none' || cs.filter !== 'none' || (cs.backdropFilter && cs.backdropFilter !== 'none') ||
          (cs.webkitBackdropFilter && cs.webkitBackdropFilter !== 'none') || cs.perspective !== 'none') {
        return el.getBoundingClientRect();
      }
    }
    return { top: 0, left: 0 };
  }

  function bind(modal) {
    const box = modal.querySelector('#cx-picker-box');
    const grid = modal.querySelector('#cx-token-grid');
    if (!box || !grid) return;
    box.classList.add('cx-picker-popover');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Colour picker');
    box.hidden = true;
    let anchorKey = null;

    const anchorItem = () => anchorKey && grid.querySelector(`.cx-token-item[data-key="${CSS.escape(anchorKey)}"]`);

    function place(item) {
      box.hidden = false;
      const a = item.getBoundingClientRect();
      const width = box.offsetWidth;
      const height = box.offsetHeight;
      let top = a.bottom + GAP;
      if (top + height > window.innerHeight - GAP && a.top - GAP - height >= GAP) top = a.top - GAP - height;
      top = Math.max(GAP, Math.min(top, window.innerHeight - height - GAP));
      const left = Math.max(GAP, Math.min(a.left, window.innerWidth - width - GAP));
      const origin = containingRect(box);
      box.style.top = `${Math.round(top - origin.top)}px`;
      box.style.left = `${Math.round(left - origin.left)}px`;
    }

    function close() {
      box.hidden = true;
      anchorKey = null;
    }

    // The token's own click handler (theme-customizer.js) has already selected it and synced the picker
    grid.addEventListener('click', e => {
      const item = e.target.closest('.cx-token-item');
      if (!item) return;
      if (!box.hidden && anchorKey === item.dataset.key) { close(); return; }
      anchorKey = item.dataset.key;
      place(item);
    });

    modal.addEventListener('pointerdown', e => {
      if (box.hidden || box.contains(e.target) || e.target.closest('.cx-token-item')) return;
      close();
    });

    // Escape closes only the popover, not the customizer. Focus is often outside the modal, so this listens on the
    // document and removes itself (and the resize listener) once the customizer has closed
    const follow = () => { const item = anchorItem(); if (item && !box.hidden) place(item); };
    const onKey = e => {
      if (!box.isConnected) { document.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', follow); return; }
      if (e.key === 'Escape' && !box.hidden) { e.stopPropagation(); close(); }
    };
    document.addEventListener('keydown', onKey, true);
    modal.querySelectorAll('.cx-controls-pane, .cx-customizer-body').forEach(pane => pane.addEventListener('scroll', follow, { passive: true }));
    window.addEventListener('resize', follow, { passive: true });

    box.querySelector('.cx-picker-close')?.addEventListener('click', close);
  }

  window.ConnectifyCustomizerPopover = { bind };
})();

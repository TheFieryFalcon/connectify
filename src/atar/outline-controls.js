/**
 * Connectify Outlines: floating Expand All / Collapse All and Back to top
 *
 * Keeps the fixed #cx-expand-btn pair (bottom left, under the Jump To row from outline-jump.js) and the
 * #cx-back-to-top-container button after the last subject tile in place across Connect re-renders.
 * Exposes window.ConnectifyOutlineControls.
 */
(() => {
  'use strict';

  const TILE_SELECTOR = '.eds-c-tile, .cvr-c-tile';

  function placeAfter(node, ref) {
    if (!ref.parentNode) return;
    if (ref.nextSibling) ref.parentNode.insertBefore(node, ref.nextSibling);
    else ref.parentNode.appendChild(node);
  }

  // Connect scrolls the window on some pages and the document element or body on others
  function scrollToTop() {
    const firstTile = document.querySelector(TILE_SELECTOR);
    if (typeof firstTile?.scrollIntoView === 'function') firstTile.scrollIntoView({ behavior: 'smooth', block: 'start' });
    for (const target of [window, document.documentElement, document.body]) {
      if (typeof target?.scrollTo === 'function') target.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function createBackToTop() {
    const container = document.createElement('div');
    container.id = 'cx-back-to-top-container';
    container.className = 'cx-back-to-top-container';
    const btn = document.createElement('button');
    btn.id = 'cx-back-to-top-btn';
    btn.type = 'button';
    btn.className = 'cx-back-to-top-btn eds-c-button';
    btn.textContent = '↑ Back to top';
    btn.setAttribute('aria-label', 'Back to top of assessment outlines');
    btn.onclick = scrollToTop;
    container.appendChild(btn);
    return container;
  }

  /** Keeps the Back to top button directly after the last tile, or removes it when there are no tiles. */
  function syncBackToTop() {
    try {
      const tiles = document.querySelectorAll(TILE_SELECTOR);
      const existing = document.getElementById('cx-back-to-top-container');
      if (tiles.length === 0) {
        existing?.remove();
        return;
      }
      const lastTile = tiles[tiles.length - 1];
      if (!existing) placeAfter(createBackToTop(), lastTile);
      else if (existing.previousElementSibling !== lastTile) placeAfter(existing, lastTile);
    } catch (err) {
      console.error('Error syncing back to top button:', err);
    }
  }

  /** Adds the floating Expand All / Collapse All buttons once, with the Jump To row above them. */
  function ensureExpandButtons() {
    const existing = document.getElementById('cx-expand-btn');
    if (existing) {
      if (!document.getElementById('cx-jump-subject') && window.ConnectifyOutlineJump) existing.prepend(window.ConnectifyOutlineJump.create());
      window.ConnectifyOutlineJump?.sync();
      return;
    }
    if (!window.ConnectifyData) return;
    const btnContainer = document.createElement('div');
    btnContainer.id = 'cx-expand-btn';
    Object.assign(btnContainer.style, {
      position: 'fixed', bottom: '16px', left: '16px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: '10000'
    });
    const createBtn = (text, isExpand) => {
      const btn = document.createElement('button');
      btn.textContent = text;
      btn.type = 'button';
      btn.className = 'eds-c-button';
      Object.assign(btn.style, { padding: '6px', fontSize: '11px', width: '100%' });
      btn.onclick = () => window.ConnectifyData.expandAll(isExpand);
      return btn;
    };
    if (window.ConnectifyOutlineJump) btnContainer.append(window.ConnectifyOutlineJump.create());
    btnContainer.append(createBtn('Expand All', true), createBtn('Collapse All', false));
    document.body.appendChild(btnContainer);
    window.ConnectifyOutlineJump?.sync();
  }

  window.ConnectifyOutlineControls = { syncBackToTop, ensureExpandButtons, scrollToTop };
})();

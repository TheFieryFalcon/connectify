/**
 * Connectify Theme: overlay blur floor. Layers that cover other text (the Connectify drawer, menus, popups,
 * dialogs, tooltips and the top bars the page scrolls under) blur at least FLOOR px in Liquid Glass, even when a
 * custom theme's Blur Strength is lower, so the text under them never reads through. A theme turns it off with
 * `overlayBlurFloor: false` (the customizer's checkbox under Blur Strength). The registry writes the result to
 * --cx-glass-blur-overlay, which theme-overlay-blur.css hands to those layers.
 * Exposes window.ConnectifyOverlayBlur.
 */
(() => {
  'use strict';

  const FLOOR = 12;

  /** Whether a theme (or customizer state) keeps the floor: on unless set to false. */
  const keeps = theme => theme?.overlayBlurFloor !== false;

  /** Blur in px for layers over text. */
  function of(blur, keepFloor = true) {
    const px = Number.isFinite(blur) ? blur : FLOOR;
    return keepFloor === false ? px : Math.max(FLOOR, px);
  }

  function html(s) {
    return `<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--cx-text-muted);cursor:pointer;"><input type="checkbox" id="cx-overlay-blur-toggle" ${keeps(s) ? 'checked' : ''}><span>Always blur sidebar, menus, and dialogs</span></label>`;
  }

  function sync(modal, state) {
    const box = modal?.querySelector('#cx-overlay-blur-toggle');
    if (box) box.checked = keeps(state);
  }

  function bind(modal, state) {
    const box = modal?.querySelector('#cx-overlay-blur-toggle');
    if (box) box.onchange = () => { state.overlayBlurFloor = box.checked; };
  }

  window.ConnectifyOverlayBlur = { FLOOR, keeps, of, html, sync, bind };
})();

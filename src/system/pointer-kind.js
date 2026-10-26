/**
 * Connectify pointer kind (document_start): touch-targets.css grows Connectify's controls on touchscreens,
 * but a touch laptop used with a mouse or trackpad keeps the normal sizes. The first mouse input sets
 * <html data-cx-mouse> (remembered, so the next page starts that way); a touch input clears it again.
 */
(() => {
  'use strict';

  if (window.ConnectifyPointerKind) return;

  const KEY = 'connectify:pointer_mouse';
  const ATTR = 'data-cx-mouse';
  const root = () => document.documentElement;

  function setMouse(mouse) {
    const el = root();
    if (!el || el.hasAttribute(ATTR) === mouse) return;
    el.toggleAttribute(ATTR, mouse);
    try { if (mouse) localStorage.setItem(KEY, 'true'); else localStorage.removeItem(KEY); } catch {}
  }

  try { if (localStorage.getItem(KEY) === 'true') root()?.setAttribute(ATTR, ''); } catch {}

  // Touch input fires pointer events with pointerType 'touch' (its compatibility mouse events are not pointer events)
  const onPointer = e => {
    if (e.pointerType === 'mouse') setMouse(true);
    else if (e.pointerType === 'touch') setMouse(false);
  };
  window.addEventListener('pointermove', onPointer, { capture: true, passive: true });
  window.addEventListener('pointerdown', onPointer, { capture: true, passive: true });

  window.ConnectifyPointerKind = { isMouse: () => Boolean(root()?.hasAttribute(ATTR)), setMouse };
})();

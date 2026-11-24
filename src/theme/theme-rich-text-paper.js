/**
 * Connectify Theme: paper colours in rich text
 *
 * Text pasted into a notice from Word keeps its page colour as an inline background: white, but also off-whites
 * (cornsilk, ivory, a light grey shading). theme-rich-text.css clears exact white by its spelling; any other pale,
 * nearly colourless background (every channel >= 205, at most 40 apart) is tagged data-cx-paper-bg here so the same
 * themes clear it. A space between two runs kept a cream strip beside each highlight on the wallpaper. Highlights
 * (yellow, lime, a pale green #ccffcc) are coloured, so they are kept. Reads inline styles only, never computed ones.
 * Exposes window.ConnectifyRichTextPaper.
 */
(() => {
  'use strict';

  const ATTR = 'data-cx-paper-bg';
  const SELECTOR = `.rtf-content [style*="background" i]:not([${ATTR}])`;
  const MIN_CHANNEL = 205;
  const MAX_SPREAD = 40;

  let ctx = null;

  /** [r, g, b, a] of any CSS colour (names, hex, rgb, hsl), via the canvas parser; null if unreadable. */
  function rgbaOf(value) {
    const text = String(value || '').trim();
    if (!text || /^(transparent|inherit|initial|unset|currentcolor)$/i.test(text)) return null;
    try {
      ctx = ctx || document.createElement('canvas').getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#010203';
      ctx.fillStyle = text;
      const out = String(ctx.fillStyle);
      if (out === '#010203' && !/^#010203$/i.test(text)) return null;
      const hex = out.match(/^#([0-9a-f]{6})$/i);
      if (hex) return [0, 2, 4].map(i => parseInt(hex[1].slice(i, i + 2), 16)).concat(1);
      const rgba = out.match(/^rgba?\(([^)]+)\)/i);
      if (!rgba) return null;
      const parts = rgba[1].split(',').map(Number);
      return parts.length === 3 ? parts.concat(1) : parts;
    } catch {
      return null;
    }
  }

  /** True for a page colour: pale and nearly colourless, so it is no highlight. */
  function isPaper(value) {
    const c = rgbaOf(value);
    if (!c || !(c[3] > 0)) return false;
    const rgb = c.slice(0, 3);
    return Math.min(...rgb) >= MIN_CHANNEL && Math.max(...rgb) - Math.min(...rgb) <= MAX_SPREAD;
  }

  /** Tags paper backgrounds in roots (their subtrees included), or in the whole page without roots. */
  function tag(roots) {
    const found = [];
    const visit = el => { if (isPaper(el.style?.backgroundColor)) found.push(el); };
    if (!roots) document.querySelectorAll(SELECTOR).forEach(visit);
    else {
      for (const root of roots) {
        if (!root.isConnected || root.nodeType !== 1) continue;
        if (root.matches(SELECTOR)) visit(root);
        root.querySelectorAll(SELECTOR).forEach(visit);
      }
    }
    found.forEach(el => el.setAttribute(ATTR, ''));
    return found.length;
  }

  window.ConnectifyRichTextPaper = { ATTR, rgbaOf, isPaper, tag };

  if (!window.ConnectifyScheduler || typeof document === 'undefined') return;
  tag();
  window.ConnectifyScheduler.onMutations(records => {
    const roots = [];
    for (const r of records) for (const n of r.addedNodes || []) if (n.nodeType === 1) roots.push(n);
    if (roots.length) tag(roots);
  }, { filter: r => r.type === 'childList' && r.addedNodes.length > 0 });
})();

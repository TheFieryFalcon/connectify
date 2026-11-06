/**
 * Connectify Cohort: expanded statistics cards fit their task column
 *
 * A card (cohort-expanded.js) is one short row up to ~920px wide and never reflows, while Connect's task column is
 * far narrower on an iPad or beside the drawer. CSS zoom cannot be trusted to fit it: WebKit keeps text at a minimum
 * size under zoom, so the text stayed wide while the layout shrank. Instead the card keeps its natural size and is
 * scaled with a transform, which every browser applies to text alike, by its own measured width against the column's;
 * the height the scale frees is taken back with a negative margin (cohort-expanded-fit.css). ResizeObserver reports
 * both sizes without forcing a layout and before the frame paints. It watches a zero-height probe for the column's
 * width: the column's own height changes with that margin, which raises a loop error. Exposes
 * window.ConnectifyCohortExpandedFit.
 */
(() => {
  'use strict';

  if (window.ConnectifyCohortExpandedFit) return;

  const MIN_SCALE = 0.35; // phones

  /** The scale fitting a card into a column, rounded down so the card never runs past it; never above 1. */
  const scaleFor = (available, width) => Math.max(MIN_SCALE, Math.min(1, Math.floor((available / width) * 1000) / 1000));

  const fits = new WeakMap(); // card or probe -> { card, probe, available, width, height, scale, slack }

  function apply(fit) {
    if (!fit.available || !fit.width) return; // hidden, or waiting for its other size
    const scale = scaleFor(fit.available, fit.width);
    const slack = Math.round(fit.height * (1 - scale) * 10) / 10;
    if (scale === fit.scale && slack === fit.slack) return;
    fit.scale = scale;
    fit.slack = slack;
    fit.card.style.setProperty('--cx-fit-scale', String(scale));
    fit.card.style.setProperty('--cx-fit-slack', `${slack}px`);
  }

  function onResize(entries, observer) {
    const changed = new Set();
    for (const entry of entries) {
      const fit = fits.get(entry.target);
      if (!fit) continue;
      if (!fit.card.isConnected) {
        // Replaced by a redraw: its column's probe may already serve the next card
        observer.unobserve(fit.card);
        if (fits.get(fit.probe) === fit) observer.unobserve(fit.probe);
        continue;
      }
      if (entry.target === fit.probe) {
        fit.available = entry.contentRect.width;
      } else {
        const size = entry.borderBoxSize?.[0];
        fit.width = size ? size.inlineSize : entry.target.offsetWidth;
        fit.height = size ? size.blockSize : entry.target.offsetHeight;
      }
      changed.add(fit);
    }
    changed.forEach(apply);
  }

  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(onResize) : null;

  /** Keeps a card (a task row's wrapper, or an overall panel) fitted to its task column. */
  function watch(card, column) {
    card.classList.add('connectify-xp-fit');
    if (!observer || !column) return;
    const probe = column.querySelector(':scope > .connectify-xp-fit-probe') || column.appendChild(Object.assign(document.createElement('div'), { className: 'connectify-xp-fit-probe' }));
    if (fits.get(card)?.probe === probe) return;
    // Observing an observed probe reports nothing, so a redraw's new card starts it again
    if (fits.has(probe)) observer.unobserve(probe);
    const fit = { card, probe, available: 0, width: 0, height: 0, scale: 1, slack: 0 };
    fits.set(card, fit);
    fits.set(probe, fit);
    observer.observe(probe);
    observer.observe(card);
  }

  window.ConnectifyCohortExpandedFit = { watch, scaleFor, MIN_SCALE };
})();

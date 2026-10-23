/**
 * Connectify Predictor Tab Scrollbar
 *
 * A plain scrollbar under the Predictor's subject tabs. macOS overlay scrollbars widen and show a track
 * on hover, and Firefox ignores scrollbar-color for them, so the tabs hide the native bar and this one,
 * which never changes on hover, takes its place: it follows the tabs' scroll, its thumb drags, and a
 * click on the track pages towards the pointer. It is hidden while every tab fits.
 * Exposes window.ConnectifyPredictorTabScroll.
 */
(() => {
  'use strict';

  const MIN_THUMB = 24;

  function attach(bar) {
    if (!bar || typeof bar.insertAdjacentElement !== 'function') return null;
    const track = document.createElement('div');
    track.className = 'cx-pred-subtabs-scroll';
    track.setAttribute('aria-hidden', 'true');
    const thumb = document.createElement('div');
    thumb.className = 'cx-pred-subtabs-thumb';
    track.append(thumb);
    bar.insertAdjacentElement('afterend', track);

    const overflow = () => bar.scrollWidth - bar.clientWidth;
    const update = () => {
      const extra = overflow();
      const idle = !(extra > 1) || !(track.clientWidth > 0);
      track.classList.toggle('cx-pred-subtabs-scroll--idle', idle);
      if (idle) return;
      const width = Math.max(MIN_THUMB, track.clientWidth * bar.clientWidth / bar.scrollWidth);
      thumb.style.width = `${width}px`;
      thumb.style.transform = `translateX(${(track.clientWidth - width) * bar.scrollLeft / extra}px)`;
    };

    thumb.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const start = bar.scrollLeft;
      const ratio = overflow() / Math.max(1, track.clientWidth - thumb.offsetWidth);
      const move = ev => { bar.scrollLeft = start + (ev.clientX - startX) * ratio; };
      const end = () => {
        thumb.removeEventListener('pointermove', move);
        thumb.removeEventListener('pointerup', end);
        thumb.removeEventListener('pointercancel', end);
      };
      thumb.setPointerCapture?.(e.pointerId);
      thumb.addEventListener('pointermove', move);
      thumb.addEventListener('pointerup', end);
      thumb.addEventListener('pointercancel', end);
    });

    track.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target === thumb) return;
      e.preventDefault();
      const before = e.clientX < thumb.getBoundingClientRect().left;
      bar.scrollBy({ left: (before ? -1 : 1) * bar.clientWidth * 0.8, behavior: 'smooth' });
    });

    bar.addEventListener('scroll', update, { passive: true });
    if (typeof ResizeObserver === 'function') {
      // Re-measures as the drawer widens; a re-render detaches the bar, which ends the observer
      const observer = new ResizeObserver(() => {
        if (!bar.isConnected) observer.disconnect();
        else update();
      });
      observer.observe(bar);
    } else {
      update();
    }
    return { track, thumb, update };
  }

  window.ConnectifyPredictorTabScroll = { attach };
})();

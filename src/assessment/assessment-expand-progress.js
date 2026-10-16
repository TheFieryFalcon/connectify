/**
 * Connectify Assessment: Expand All progress pill
 *
 * The #cx-expand-progress pill shown while Expand All runs. Starting it freezes page scrolling;
 * finishing it unfreezes, restores the scroll position and fades the pill out.
 * Exposes window.ConnectifyExpandProgress.
 */
(() => {
  'use strict';

  function getPill() {
    let pill = document.getElementById('cx-expand-progress');
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'cx-expand-progress';
      pill.className = 'cx-expand-progress-pill';
      pill.innerHTML = `
          <div class="cx-expand-spinner"></div>
          <span class="cx-expand-label">Expanding outlines... 0%</span>
          <div class="cx-expand-track"><div class="cx-expand-bar" style="width: 0%"></div></div>
        `;
      document.body.appendChild(pill);
    }
    return pill;
  }

  /** Shows the pill and returns { update(pct, msg), finish() }; finish restores initialScrollY. */
  function start(initialScrollY) {
    document.documentElement.classList.add('cx-freeze-scroll');
    document.body.classList.add('cx-freeze-scroll');
    const pill = getPill();
    const bar = pill.querySelector('.cx-expand-bar');
    const text = pill.querySelector('.cx-expand-label');

    const update = (pct, msg) => {
      if (bar) bar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
      if (text && msg) text.textContent = msg;
    };

    const finish = () => {
      document.documentElement.classList.remove('cx-freeze-scroll');
      document.body.classList.remove('cx-freeze-scroll');
      if (typeof window.scrollTo === 'function') window.scrollTo(0, initialScrollY);
      update(100, '✓ Outlines expanded & statistics updated');
      setTimeout(() => {
        pill.style.opacity = '0';
        pill.style.transform = 'translate(-50%, -10px)';
        setTimeout(() => pill.remove(), 350);
      }, 600);
    };

    update(0, 'Expanding outlines... 0%');
    return { update, finish };
  }

  window.ConnectifyExpandProgress = { start };
})();

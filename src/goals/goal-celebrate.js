/**
 * Connectify Goals: celebration
 *
 * A completed goal's celebration: about 4s of confetti bursting from the toast corner across a full-screen
 * canvas (#cx-goal-confetti, never takes the pointer, removed afterwards, stopped when the tab is hidden) and a
 * short shake of Connect's page layout (never <html> or <body>, so fixed elements and the drawer stay put).
 * With reduced motion: no shake, and the confetti is one still burst that fades in and out.
 * Exposes window.ConnectifyGoalCelebrate.
 */
(() => {
  'use strict';

  if (window.ConnectifyGoalCelebrate) return;

  const DURATION = 4000;
  const COLORS = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444', '#a78bfa', '#38bdf8', '#f472b6'];
  const reducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  /** Where the burst starts: the toast stack's corner, else the bottom right of the window. */
  function origin() {
    const rect = document.getElementById('connectify-notifications-container')?.getBoundingClientRect?.();
    return rect && rect.width ? { x: rect.left + rect.width / 2, y: rect.top + 20 } : { x: innerWidth - 160, y: innerHeight - 80 };
  }

  function particles(count, from, still) {
    return Array.from({ length: count }, () => {
      const angle = -Math.PI / 2 + (Math.random() - 0.65) * Math.PI * 0.9;
      const speed = 9 + Math.random() * 13;
      return {
        x: still ? Math.random() * innerWidth : from.x, y: still ? Math.random() * innerHeight * 0.8 : from.y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: 6 + Math.random() * 6,
        spin: (Math.random() - 0.5) * 0.4, turn: Math.random() * Math.PI, color: COLORS[Math.floor(Math.random() * COLORS.length)]
      };
    });
  }

  function draw(ctx, list) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    for (const p of list) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.turn);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
  }

  function shake() {
    const layout = document.querySelector('.cvr-c-app-layout') || document.getElementById('main-content');
    if (!layout) return;
    layout.classList.remove('cx-goal-shake');
    void layout.offsetWidth;
    layout.classList.add('cx-goal-shake');
    setTimeout(() => layout.classList.remove('cx-goal-shake'), 700);
  }

  /** Plays the celebration (a second call while one runs is ignored). */
  function play() {
    if (document.getElementById('cx-goal-confetti') || !document.body) return;
    const still = reducedMotion();
    const canvas = document.createElement('canvas');
    canvas.id = 'cx-goal-confetti';
    canvas.setAttribute('aria-hidden', 'true');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    if (still) canvas.classList.add('cx-goal-confetti--still');
    document.body.append(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas.remove();
    ctx.scale(dpr, dpr);
    const list = particles(still ? 120 : 220, origin(), still);
    const end = () => canvas.remove();
    if (still) {
      draw(ctx, list);
      setTimeout(end, DURATION);
      return;
    }
    shake();
    const start = performance.now();
    let last = start;
    const frame = now => {
      if (!canvas.isConnected) return;
      if (document.hidden || now - start > DURATION) return end();
      const dt = Math.min(2, (now - last) / 16.7);
      last = now;
      for (const p of list) {
        p.vy += 0.35 * dt;
        p.vx *= 0.99;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.turn += p.spin * dt;
      }
      canvas.style.opacity = String(Math.min(1, (DURATION - (now - start)) / 600));
      draw(ctx, list);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  window.ConnectifyGoalCelebrate = { play, DURATION };
})();

/**
 * Connectify Theme: preset wallpapers
 *
 * Simple geometric gradient wallpapers (three dark, three light) generated as small SVG data URIs, so
 * they need no image files and fit easily in storage. mount(container, onPick) renders a row of
 * thumbnails for the Settings panel and the customizer; a theme names one by id (wallpaperPreset). Exposes window.ConnectifyWallpaperPresets.
 */
(() => {
  'use strict';

  const W = 1600, H = 1000;
  const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => '#' + hexRgb(a).map((v, i) => Math.round(v + (hexRgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
  const along = (stops, t) => {
    const x = Math.max(0, Math.min(1, t)) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x));
    return mix(stops[i], stops[i + 1], x - i);
  };
  const svg = body => 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${body}</svg>`);
  const linear = (id, stops, x2 = 1, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${
    stops.map((c, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>`;

  /** Low-poly facets: a triangle grid shaded along a diagonal gradient, with a fixed light/dark ripple. */
  function facets(stops) {
    const cols = 8, rows = 5, w = W / cols, h = H / rows;
    let out = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * w, y = r * h, t = (c / cols + r / rows) / 2;
        const shade = ((r * 7 + c * 3) % 5 - 2) * 0.025;
        const a = along(stops, t + shade), b = along(stops, t + 0.06 - shade);
        out += `<polygon points="${x},${y} ${x + w},${y} ${x},${y + h}" fill="${a}"/>`;
        out += `<polygon points="${x + w},${y} ${x + w},${y + h} ${x},${y + h}" fill="${b}"/>`;
      }
    }
    return svg(out);
  }

  /** Soft orbs: a diagonal gradient with three large translucent circles. */
  function orbs(stops, orb) {
    return svg(`<defs>${linear('g', stops)}</defs><rect width="${W}" height="${H}" fill="url(#g)"/>` +
      `<circle cx="320" cy="260" r="300" fill="${orb}" opacity="0.28"/>` +
      `<circle cx="1240" cy="760" r="380" fill="${orb}" opacity="0.2"/>` +
      `<circle cx="980" cy="180" r="160" fill="${orb}" opacity="0.16"/>`);
  }

  /** Diagonal bands: a gradient crossed by translucent parallelograms. */
  function bands(stops, band) {
    const strips = [0, 1, 2, 3].map(i => {
      const x = -400 + i * 520;
      return `<polygon points="${x},${H} ${x + 260},${H} ${x + 900},0 ${x + 640},0" fill="${band}" opacity="${0.08 + i * 0.03}"/>`;
    }).join('');
    return svg(`<defs>${linear('g', stops, 1, 0)}</defs><rect width="${W}" height="${H}" fill="url(#g)"/>${strips}`);
  }

  const PRESETS = [
    { id: 'night-facets', name: 'Night Facets', tone: 'dark', url: facets(['#0b1120', '#1e1b4b', '#312e81', '#0e7490']) },
    { id: 'aurora', name: 'Aurora', tone: 'dark', url: orbs(['#020617', '#134e4a', '#1e3a8a'], '#22d3ee') },
    { id: 'ember', name: 'Ember', tone: 'dark', url: bands(['#18181b', '#3b0764', '#7c2d12'], '#f97316') },
    { id: 'morning-mist', name: 'Morning Mist', tone: 'light', url: orbs(['#e0f2fe', '#ede9fe', '#fdf2f8'], '#ffffff') },
    { id: 'peach-facets', name: 'Peach Facets', tone: 'light', url: facets(['#fff7ed', '#fed7aa', '#fbcfe8', '#ddd6fe']) },
    { id: 'mint', name: 'Mint', tone: 'light', url: bands(['#ecfdf5', '#ccfbf1', '#e0f2fe'], '#ffffff') }
  ];

  const find = url => PRESETS.find(p => p.url === url) || null;
  // A theme names a preset by id (wallpaperPreset), so it never stores or ships the SVG itself
  const byId = id => PRESETS.find(p => p.id === id) || null;

  /** Renders the preset thumbnails into container; onPick(preset) runs when one is chosen. */
  function mount(container, onPick) {
    if (!container) return;
    container.innerHTML = '';
    for (const p of PRESETS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cx-bg-preset';
      btn.dataset.preset = p.id;
      btn.dataset.tone = p.tone;
      btn.title = `${p.name} (${p.tone})`;
      btn.setAttribute('aria-label', `Use the ${p.name} ${p.tone} wallpaper`);
      btn.style.backgroundImage = `url("${p.url}")`;
      btn.onclick = () => onPick(p);
      container.appendChild(btn);
    }
  }

  window.ConnectifyWallpaperPresets = { PRESETS, find, byId, mount };
})();

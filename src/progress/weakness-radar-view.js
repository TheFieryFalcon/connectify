/**
 * Connectify Weaknesses: radar chart and panel markup
 *
 * Builds the SVG radar (spider) chart for labelled percentages, the status messages shown instead of
 * it, and the analyzer panel markup. Labels are subject and category names, so they are escaped.
 * Exposes window.ConnectifyWeaknessView.
 */
(() => {
  'use strict';

  const { escapeHtml } = window.ConnectifyUtils;

  const message = text => `<div class="cx-radar-message" style="padding:20px;text-align:center;display:flex;align-items:center;justify-content:center;height:100%;">${escapeHtml(text)}</div>`;

  const warning = text => `<div class="cx-radar-warning" style="padding:30px 20px;text-align:center;font-size:13px;font-weight:600;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;box-sizing:border-box;"><span style="font-size:26px;margin-bottom:8px;">⚠️</span><span>${escapeHtml(text)}</span></div>`;

  /** SVG markup: 20-100% grid rings, spokes, the score polygon, vertex markers and outer labels. */
  function radarSvg(labels, data) {
    const N = labels.length;
    // Wide enough for a 24-character label (plus its score) beside a side spoke
    const width = 760;
    const height = 350;
    const cx = width / 2;
    const cy = height / 2 + 5;
    const R = 115;

    const angle = i => -Math.PI / 2 + (2 * Math.PI * i) / N;

    // 1. Concentric grid polygons (20%, 40%, 60%, 80%, 100%)
    const levels = [20, 40, 60, 80, 100];
    let gridPolygons = '';
    levels.forEach(lvl => {
      const r = (R * lvl) / 100;
      const pts = [];
      for (let i = 0; i < N; i++) {
        const a = angle(i);
        pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
      }
      gridPolygons += `<polygon points="${pts.join(' ')}" fill="none" stroke="#485c70" stroke-width="1" stroke-dasharray="${lvl === 100 ? 'none' : '3,3'}" opacity="0.6"/>`;
      gridPolygons += `<text x="${cx + 4}" y="${(cy - r + 3).toFixed(1)}" fill="#8fa6bd" font-size="9" font-family="system-ui" opacity="0.85">${lvl}%</text>`;
    });

    // 2. Radial spoke lines from center to outer ring
    let spokes = '';
    for (let i = 0; i < N; i++) {
      const a = angle(i);
      const x = (cx + R * Math.cos(a)).toFixed(1);
      const y = (cy + R * Math.sin(a)).toFixed(1);
      spokes += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#485c70" stroke-width="1" opacity="0.7"/>`;
    }

    // 3. Data points and polygon
    const dataPoints = [];
    for (let i = 0; i < N; i++) {
      const val = Math.max(0, Math.min(100, data[i]));
      const r = (R * val) / 100;
      const a = angle(i);
      const x = (cx + r * Math.cos(a)).toFixed(1);
      const y = (cy + r * Math.sin(a)).toFixed(1);
      dataPoints.push({ x, y, val, label: labels[i] });
    }
    const polyPts = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

    const dataPolygon = `
      <polygon points="${polyPts}" fill="#2ecc71" fill-opacity="0.32" stroke="#2ecc71" stroke-width="2.5" stroke-linejoin="round"/>
    `;

    // 4. Data vertex markers
    let markers = '';
    dataPoints.forEach(p => {
      markers += `
        <circle cx="${p.x}" cy="${p.y}" r="4.5" fill="#2ecc71" stroke="#ffffff" stroke-width="1.5" style="cursor:pointer;">
          <title>${escapeHtml(p.label)}: ${p.val}%</title>
        </circle>
      `;
    });

    // 5. Category labels just past each spoke's end: the label's nearest corner or edge sits GAP from it.
    // Baselines are set with y (never dominant-baseline, which Firefox does not pass to the score's tspan).
    const GAP = 12;
    const FONT = 11;
    let labelElements = '';
    for (let i = 0; i < N; i++) {
      const a = angle(i);
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      const lx = cx + (R + GAP) * cosA;
      let ly = cy + (R + GAP) * sinA;
      if (sinA > 0.5) ly += FONT * 0.8; // below the ring: hang from the point
      else if (sinA >= -0.5) ly += FONT * 0.35; // beside it: centred on the point

      let anchor = 'middle';
      if (cosA > 0.3) anchor = 'start';
      else if (cosA < -0.3) anchor = 'end';

      const name = labels[i];
      const val = data[i];
      const displayName = escapeHtml(name.length > 24 ? name.substring(0, 22) + '…' : name);

      // No whitespace around the label: it would shift the anchored text
      labelElements += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" fill="#e1eaf3" font-size="${FONT}" font-weight="600" font-family="system-ui">${displayName} <tspan fill="#2ecc71" font-weight="700">(${val}%)</tspan></text>`;
    }

    return `
      <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:100%;display:block;overflow:visible;user-select:none;" role="img" aria-label="Weaknesses radar chart">
        ${gridPolygons}
        ${spokes}
        ${dataPolygon}
        ${markers}
        ${labelElements}
      </svg>
    `;
  }

  const PANEL_HTML = `
      <header><strong>Weakness Analyzer</strong></header>
      <div style="margin-bottom:14px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
         <label for="cx-radar-mode" class="cx-radar-mode-label" style="font-weight:600; font-size:12px; color:inherit;">Group by:</label>
         <select id="cx-radar-mode">
            <option value="type">Assessment Type</option>
            <option value="subject">Subject</option>
         </select>
         <button type="button" id="cx-weakness-expand-all" class="cx-weakness-expand-btn" style="margin-left:auto;">Expand All Outlines</button>
      </div>
      <div id="connectify-radar-chart" style="width:100%;height:350px;overflow:hidden;"></div>
      <div id="cx-weakness-filters">
         <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong style="font-size:12px;">Include in Analyzer:</strong>
            <div>
              <button type="button" id="cx-weakness-all" class="cx-weakness-filter-btn">Select All</button>
              <span style="color:#666; font-size:10px; margin:0 4px;">|</span>
              <button type="button" id="cx-weakness-none" class="cx-weakness-filter-btn">Deselect All</button>
            </div>
         </div>
         <div id="cx-weakness-checkboxes"></div>
      </div>
    `;

  window.ConnectifyWeaknessView = { message, warning, radarSvg, PANEL_HTML };
})();

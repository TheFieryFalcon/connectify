/**
 * Connectify Weakness Radar Analyzer
 *
 * Implements the SVG spider/radar chart visualizing performance breakdown
 * across assessment categories or academic subjects, with selective subject filtering.
 * Provides `window.ConnectifyWeakness`.
 */
(() => {
  'use strict';

  if (window.ConnectifyWeakness) return;

  let disabledWeaknessSubjects = new Set();
  try {
    const stored = JSON.parse(localStorage.getItem('connectify:weakness_disabled_subjects') || '[]');
    if (Array.isArray(stored)) disabledWeaknessSubjects = new Set(stored);
  } catch (e) {}

  const saveDisabledSubjects = () => {
    try {
      localStorage.setItem('connectify:weakness_disabled_subjects', JSON.stringify([...disabledWeaknessSubjects]));
    } catch (e) {}
  };

  const cleanSubjectName = name => {
    if (!name) return '';
    return name.replace(/ ATAR | Year\s*\d+ /gi, '').replace(/\s+/g, ' ').trim();
  };

  function getEffectiveTaskType(subjectName, task) {
    if (window.ConnectifyTaskTypes?.getEffectiveType) {
      return window.ConnectifyTaskTypes.getEffectiveType(subjectName, task);
    }
    return 'Take-Home';
  }

  function getSubjectList() {
    const subjects = new Map();
    const collected = window.ConnectifyData?.collect ? window.ConnectifyData.collect(true) : [];
    collected.forEach(s => {
      const clean = cleanSubjectName(s.name) || s.name;
      if (clean && !subjects.has(clean)) {
        subjects.set(clean, s.name);
      }
    });
    return subjects;
  }

  let currentChart = null;

  function destroyChart() {
    if (currentChart && currentChart.destroy) {
      try { currentChart.destroy(); } catch (e) {}
    }
    currentChart = null;
    document.dispatchEvent(new CustomEvent('connectify-destroy-radar'));
  }

  function renderChart() {
    const chartDiv = document.getElementById('connectify-radar-chart');
    if (!chartDiv) return;

    const subjectMap = getSubjectList();
    let selectedCount = 0;
    for (const cleanName of subjectMap.keys()) {
      const rawName = subjectMap.get(cleanName);
      if (!disabledWeaknessSubjects.has(cleanName) && (!rawName || !disabledWeaknessSubjects.has(rawName))) {
        selectedCount++;
      }
    }

    if (subjectMap.size === 0) {
      destroyChart();
      chartDiv.innerHTML = '<div style="padding:20px;color:#999;text-align:center;display:flex;align-items:center;justify-content:center;height:100%;">No subjects detected yet. Expand course outlines in Connect to load subjects.</div>';
      return;
    }

    if (selectedCount === 0) {
      destroyChart();
      chartDiv.innerHTML = '<div style="padding:20px;color:#999;text-align:center;display:flex;align-items:center;justify-content:center;height:100%;">All subjects deselected. Please check at least 3 subjects below to view radar analytics.</div>';
      return;
    }

    const perf = {};
    const mode = document.getElementById('cx-radar-mode')?.value || 'type';

    const collectedSubjects = window.ConnectifyData?.collect ? window.ConnectifyData.collect(true) : [];
    collectedSubjects.forEach(subject => {
      const cleaned = cleanSubjectName(subject.name) || subject.name;
      if (disabledWeaknessSubjects.has(cleaned) || disabledWeaknessSubjects.has(subject.name)) return;
      subject.tasks.forEach(t => {
        if (t.weight > 0 && !t.pending && t.score !== null) {
          const earned = (t.score / 100) * t.weight;
          const label = mode === 'subject' ? cleaned : getEffectiveTaskType(subject.name, t);
          if (!perf[label]) perf[label] = { earned: 0, total: 0 };
          perf[label].earned += earned;
          perf[label].total += t.weight;
        }
      });
    });

    const labels = [];
    const data = [];
    for (const [label, stats] of Object.entries(perf)) {
      labels.push(label);
      data.push(stats.total > 0 ? Math.round((stats.earned / stats.total) * 100) : 0);
    }

    if (labels.length === 0) {
      destroyChart();
      chartDiv.innerHTML = '<div style="padding:20px;color:#999;text-align:center;display:flex;align-items:center;justify-content:center;height:100%;">No completed assessments to plot for the selected subjects.</div>';
      return;
    }

    if (labels.length < 3) {
      destroyChart();
      const entityType = mode === 'type' ? 'assessment types' : 'subjects';
      chartDiv.innerHTML = `<div style="padding:30px 20px;color:#d4b483;text-align:center;font-size:13px;font-weight:600;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;box-sizing:border-box;"><span style="font-size:26px;margin-bottom:8px;">⚠️</span><span>At least 3 ${entityType} must have graded tasks for radar charts!</span></div>`;
      return;
    }

    const N = labels.length;
    const width = 500;
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
          <title>${p.label}: ${p.val}%</title>
        </circle>
      `;
    });

    // 5. Category labels positioned outside the outer ring
    let labelElements = '';
    for (let i = 0; i < N; i++) {
      const a = angle(i);
      const labelR = R + 24;
      const lx = cx + labelR * Math.cos(a);
      const ly = cy + labelR * Math.sin(a);

      const cosA = Math.cos(a);
      let anchor = 'middle';
      if (cosA > 0.3) anchor = 'start';
      else if (cosA < -0.3) anchor = 'end';

      const name = labels[i];
      const val = data[i];
      const displayName = name.length > 24 ? name.substring(0, 22) + '…' : name;

      labelElements += `
        <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="central" fill="#e1eaf3" font-size="11" font-weight="600" font-family="system-ui">
          ${displayName} <tspan fill="#2ecc71" font-weight="700">(${val}%)</tspan>
        </text>
      `;
    }

    chartDiv.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:100%;display:block;user-select:none;" role="img" aria-label="Weakness Analyzer Radar Chart">
        ${gridPolygons}
        ${spokes}
        ${dataPolygon}
        ${markers}
        ${labelElements}
      </svg>
    `;
  }

  function updateCheckboxes(panel) {
    const boxContainer = panel.querySelector('#cx-weakness-checkboxes');
    if (!boxContainer) return;
    boxContainer.innerHTML = '';
    const subjectMap = getSubjectList();

    subjectMap.forEach((rawName, cleanName) => {
      const label = document.createElement('label');
      label.className = 'cx-weakness-checkbox-label';
      label.title = cleanName;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      const isOff = disabledWeaknessSubjects.has(cleanName) || disabledWeaknessSubjects.has(rawName);
      cb.checked = !isOff;

      cb.onchange = () => {
        if (cb.checked) {
          disabledWeaknessSubjects.delete(cleanName);
          disabledWeaknessSubjects.delete(rawName);
        } else {
          disabledWeaknessSubjects.add(cleanName);
        }
        saveDisabledSubjects();
        renderChart();
      };

      const textSpan = document.createElement('span');
      textSpan.textContent = cleanName;

      label.appendChild(cb);
      label.appendChild(textSpan);
      boxContainer.appendChild(label);
    });
  }

  function createWeaknessPanel() {
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = 'Weakness Analyzer';
    toggleBtn.type = 'button';
    toggleBtn.id = 'connectify-weakness-toggle';

    const panel = document.createElement('section');
    panel.id = 'connectify-weakness';
    panel.hidden = true;
    panel.className = 'cx-workspace-panel';
    panel.innerHTML = `
      <header><strong>Weakness Analyzer</strong></header>
      <div style="margin-bottom:14px; display:flex; gap:10px; align-items:center;">
         <label for="cx-radar-mode" style="font-weight:600; font-size:12px;">Group by:</label>
         <select id="cx-radar-mode">
            <option value="type">Assessment Type</option>
            <option value="subject">Subject</option>
         </select>
      </div>
      <div id="connectify-radar-chart" style="width:100%;height:350px;background:#333333;border-radius:8px;border:1px solid #3a3a3a;overflow:hidden;"></div>
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

    panel.querySelector('#cx-radar-mode').onchange = renderChart;
    panel.querySelector('#cx-weakness-all').onclick = () => {
      disabledWeaknessSubjects.clear();
      saveDisabledSubjects();
      updateCheckboxes(panel);
      renderChart();
    };
    panel.querySelector('#cx-weakness-none').onclick = () => {
      const subjectMap = getSubjectList();
      subjectMap.forEach((rawName, cleanName) => {
        disabledWeaknessSubjects.add(cleanName);
      });
      saveDisabledSubjects();
      updateCheckboxes(panel);
      renderChart();
    };

    function openWeakness() {
      panel.hidden = false;
      toggleBtn.setAttribute('aria-pressed', 'true');
      window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'weakness' }));
      updateCheckboxes(panel);
      setTimeout(renderChart, 50);
    }

    function closeWeakness() {
      panel.hidden = true;
      toggleBtn.setAttribute('aria-pressed', 'false');
      destroyChart();
    }

    toggleBtn.onclick = () => {
      if (panel.hidden) {
        openWeakness();
      } else {
        closeWeakness();
        window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'home' }));
      }
    };

    return {
      toggleBtn,
      panel,
      openWeakness,
      closeWeakness,
      renderChart,
      updateCheckboxes: () => updateCheckboxes(panel),
      destroyChart
    };
  }

  window.ConnectifyWeakness = {
    createWeaknessPanel,
    renderChart,
    destroyChart
  };
})();

/**
 * Connectify ATAR Features (Weakness Analyzer & Coordinator)
 *
 * Implements the Weakness Analyzer radar chart, category keyword customizer,
 * and coordinates compound progress bars and WACE countdown timer.
 */
(() => {
  'use strict';

  try {
    if (window.__connectifyAtarFeaturesInitialized) return;
    window.__connectifyAtarFeaturesInitialized = true;

    let hasInitializedSidebar = false;
    let hasAutoExpanded = false;

    const defaultCategories = {
       Exam: { color: '#e74c3c', keywords: ['exam', 'semester'] },
       Test: { color: '#2ecc71', keywords: ['test', 'quiz', 'in-class', 'in class'] },
       Application: { color: '#3498db', keywords: ['application', 'investigation', 'portfolio', 'validation', 'practical', 'speaking', 'listening', 'dictation'] },
       Essay: { color: '#9b59b6', keywords: ['essay', 'short answer', 'written response', 'close reading'] },
       'Take-Home': { color: '#f1c40f', keywords: ['take-home', 'assignment', 'project', 'extended', 'presentation', 'oral', 'creative'] }
    };
    
    if (!window.cxCategories) {
        window.cxCategories = defaultCategories;
    }

    const safeStorageGet = (keys, cb) => {
      try {
        const api = (typeof browser !== 'undefined' && browser?.storage)
          ? browser
          : (typeof chrome !== 'undefined' && chrome?.storage ? chrome : null);
        if (!api?.storage?.local) return;
        let handled = false;
        const callback = res => {
          if (handled) return;
          handled = true;
          if (res) cb(res);
        };
        const p = api.storage.local.get(keys, callback);
        if (p && typeof p.then === 'function') {
          p.then(callback).catch(() => {});
        }
      } catch (e) {}
    };

    const safeStorageSet = obj => {
      try {
        const api = (typeof browser !== 'undefined' && browser?.storage)
          ? browser
          : (typeof chrome !== 'undefined' && chrome?.storage ? chrome : null);
        if (!api?.storage?.local) return;
        const p = api.storage.local.set(obj);
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      } catch (e) {}
    };

    const safeStorageRemove = key => {
      try {
        const api = (typeof browser !== 'undefined' && browser?.storage)
          ? browser
          : (typeof chrome !== 'undefined' && chrome?.storage ? chrome : null);
        if (!api?.storage?.local) return;
        const p = api.storage.local.remove(key);
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      } catch (e) {}
    };

    const resolveCategories = () => {
      try {
        const stored = localStorage.getItem('connectea:categories') || localStorage.getItem('cx-categories');
        if (stored) {
          window.cxCategories = JSON.parse(stored);
        }
      } catch (e) {}
      safeStorageGet(['cx-categories'], res => {
        if (res && res['cx-categories']) {
          window.cxCategories = res['cx-categories'];
          try {
            localStorage.setItem('cx-categories', JSON.stringify(window.cxCategories));
            localStorage.setItem('connectea:categories', JSON.stringify(window.cxCategories));
          } catch (e) {}
        }
      });
    };
    resolveCategories();

    function getEffectiveTaskType(subjectName, task) {
      if (window.ConnectifyTaskTypes?.getEffectiveType) {
        return window.ConnectifyTaskTypes.getEffectiveType(subjectName, task);
      }
      return 'Take-Home';
    }

    function syncFeatures() {
      initSidebarTools();
      if (!window.ConnectifyData) return;
      
      if (!hasAutoExpanded) {
          if (document.querySelectorAll('.eds-c-tile').length > 0) {
              window.ConnectifyData.expandAll(true);
              hasAutoExpanded = true;
          } else {
              return;
          }
      }

      // --- Expand/Collapse Floating Buttons ---
      if (!document.getElementById('cx-expand-btn')) {
          const btnContainer = document.createElement('div');
          btnContainer.id = 'cx-expand-btn';
          btnContainer.style.position = 'fixed';
          btnContainer.style.bottom = '16px';
          btnContainer.style.left = '16px';
          btnContainer.style.display = 'flex';
          btnContainer.style.flexDirection = 'column';
          btnContainer.style.gap = '8px';
          btnContainer.style.zIndex = '10000';
          
          const createBtn = (text, isExpand) => {
             const btn = document.createElement('button');
             btn.textContent = text;
             btn.type = 'button';
             btn.className = 'eds-c-button';
             btn.style.padding = '6px';
             btn.style.fontSize = '11px';
             btn.style.width = '100%';
             btn.onclick = () => window.ConnectifyData.expandAll(isExpand);
             return btn;
          };
          btnContainer.append(createBtn('Expand All', true), createBtn('Collapse All', false));
          document.body.appendChild(btnContainer);
      }

      // --- WACE Countdown Timer ---
      if (window.ConnectifyCountdown?.update) {
        window.ConnectifyCountdown.update();
      }

      resolveCategories();

      // --- Compound Progress Bars ---
      if (window.ConnectifyCompoundProgress?.update) {
        window.ConnectifyCompoundProgress.update();
      }
    }

    // --- Weakness Analyzer & Categories Panel ---
    function initSidebarTools() {
      if (hasInitializedSidebar || document.getElementById('connectify-weakness-toggle')) {
        hasInitializedSidebar = true;
        return;
      }
      if (!document.querySelector('#connectify-sidebar')) return;
      hasInitializedSidebar = true;
      
      const toolMenu = document.querySelector('.cx-tool-menu');
      const workspace = document.querySelector('.cx-workspace');
         
      const toggleBtn = document.createElement('button');
      toggleBtn.textContent = 'Weakness Analyzer';
      toggleBtn.type = 'button';
      toggleBtn.id = 'connectify-weakness-toggle';
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

      const cleanSubjectName = (name) => {
        if (!name) return '';
        return name.replace(/ATAR|Year\s*\d+/gi, '').replace(/\s+/g, ' ').trim();
      };

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

      const getSubjectList = () => {
        const subjects = new Map();
        const collected = window.ConnectifyData?.collect ? window.ConnectifyData.collect(true) : [];
        collected.forEach(s => {
          const clean = cleanSubjectName(s.name) || s.name;
          if (clean && !subjects.has(clean)) {
             subjects.set(clean, s.name);
          }
        });
        return subjects;
      };

      let currentChart = null;

      const destroyChart = () => {
        if (currentChart && currentChart.destroy) {
          try { currentChart.destroy(); } catch (e) {}
        }
        currentChart = null;
        document.dispatchEvent(new CustomEvent('connectify-destroy-radar'));
      };

      const renderChart = () => {
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
      };

      const updateCheckboxes = () => {
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
      };

      panel.querySelector('#cx-radar-mode').onchange = renderChart;
      panel.querySelector('#cx-weakness-all').onclick = () => {
         disabledWeaknessSubjects.clear();
         saveDisabledSubjects();
         updateCheckboxes();
         renderChart();
      };
      panel.querySelector('#cx-weakness-none').onclick = () => {
         const subjectMap = getSubjectList();
         subjectMap.forEach((rawName, cleanName) => {
            disabledWeaknessSubjects.add(cleanName);
         });
         saveDisabledSubjects();
         updateCheckboxes();
         renderChart();
      };

      function openWeakness() {
         panel.hidden = false;
         toggleBtn.setAttribute('aria-pressed', 'true');
         window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'weakness' }));
         updateCheckboxes();
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

      // --- Categories Settings View ---
      const catBtn = document.createElement('button');
      catBtn.textContent = 'Settings';
      catBtn.type = 'button';
      catBtn.id = 'connectify-categories-toggle';

      const catPanel = document.createElement('section');
      catPanel.id = 'connectify-categories';
      catPanel.hidden = true;
      catPanel.className = 'cx-workspace-panel';
      catPanel.innerHTML = `
        <header style="margin-bottom:20px;">
          <strong style="font-size:18px;">Settings</strong>
        </header>

        <section class="cx-settings-section" style="margin-bottom:28px;">
          <header style="margin-bottom:8px;"><strong>Semester 1 Scaling Calibration</strong></header>
          <p style="font-size:12px;color:#788896;margin:0 0 14px 0;">Enter your school's Semester 1 scaled scores to calibrate the model to your cohort's historical distribution.</p>
          <div id="cx-calibration-table" style="display:grid;grid-template-columns:minmax(140px, 220px) 85px 85px;gap:10px 14px;align-items:center;margin-top:12px;"></div>
        </section>

        <section class="cx-settings-section" style="margin-top:36px;border-top:1px solid #d8e3ee;padding-top:24px;">
          <header style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
            <strong>Assessment Categories</strong>
            <button type="button" id="cx-cat-add" class="eds-c-button" style="background:#3498db;color:#fff;border:none;padding:5px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">+ Add Category</button>
          </header>
          <p style="font-size:12px;color:#788896;margin:0 0 16px 0;">Customize the comma-separated keywords used to automatically detect your assessment types:</p>
          <div id="cx-categories-inputs"></div>
          <div style="margin-top:16px;display:flex;gap:10px;align-items:center;">
             <button type="button" id="cx-cat-save" class="eds-c-button" style="background:#2ecc71;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-weight:600;">Save Changes</button>
             <button type="button" id="cx-cat-reset" class="eds-c-button" style="background:#95a5a6;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;">Reset Defaults</button>
          </div>
        </section>
      `;

      const renderCalibTable = () => {
         const table = catPanel.querySelector('#cx-calibration-table');
         if (!table) return;
         table.innerHTML = '';

         const readCoursesFn = window.ConnectifyAtar?.readCourses;
         let courses = null;
         if (readCoursesFn) {
           courses = readCoursesFn(false);
         }

         const courseList = new Map();
         if (courses) {
           for (const course of [...(courses[0] || []), ...(courses[1] || [])]) {
             if (course.name && !courseList.has(course.id || course.name)) {
               courseList.set(course.id || course.name, course);
             }
           }
         }
         if (courseList.size === 0 && window.ConnectifyData?.collect) {
           const collected = window.ConnectifyData.collect(true);
           collected.forEach(c => {
             if (c.name && !courseList.has(c.name)) {
               courseList.set(c.name, { id: c.name.toLowerCase(), name: c.name, mark: c.score });
             }
           });
         }

         if (courseList.size === 0) {
           table.innerHTML = '<div style="font-size:12px;color:#8fa6bd;grid-column:1/-1;">Expand course outlines in Connect to load subjects for calibration.</div>';
           return;
         }

         const hSubject = document.createElement('span');
         hSubject.textContent = 'Subject';
         hSubject.style.fontSize = '11px';
         hSubject.style.fontWeight = '700';
         hSubject.style.color = '#788896';

         const hRaw = document.createElement('span');
         hRaw.textContent = 'Sem 1 Raw (%)';
         hRaw.style.fontSize = '11px';
         hRaw.style.fontWeight = '700';
         hRaw.style.color = '#788896';

         const hScaled = document.createElement('span');
         hScaled.textContent = 'Sem 1 Scaled';
         hScaled.style.fontSize = '11px';
         hScaled.style.fontWeight = '700';
         hScaled.style.color = '#788896';

         table.append(hSubject, hRaw, hScaled);

         const prefsStr = localStorage.getItem('connectea:preferences');
         const savedPrefs = prefsStr ? JSON.parse(prefsStr) : {};

         for (const course of courseList.values()) {
           const calibEntry = savedPrefs[`sem1_calibration:${course.id}`] || savedPrefs[`sem1_calibration:${course.name}`] || {};
           const knownSem1Raw = calibEntry.raw !== undefined ? calibEntry.raw : (course.mark !== undefined ? Math.round(course.mark * 10) / 10 : '');

           const nameLabel = document.createElement('span');
           nameLabel.textContent = course.name;
           nameLabel.style.fontSize = '12px';
           nameLabel.style.fontWeight = '600';

           const rawInput = document.createElement('input');
           rawInput.type = 'number';
           rawInput.placeholder = 'Raw';
           rawInput.title = 'Semester 1 School Raw Mark (%)';
           rawInput.value = knownSem1Raw !== undefined ? knownSem1Raw : '';
           rawInput.style.width = '85px';
           rawInput.style.padding = '5px 8px';
           rawInput.style.borderRadius = '6px';
           rawInput.style.border = '1px solid #bacddd';
           rawInput.style.boxSizing = 'border-box';

           const scaledInput = document.createElement('input');
           scaledInput.type = 'number';
           scaledInput.placeholder = 'Scaled';
           scaledInput.title = 'Semester 1 School Scaled Mark';
           scaledInput.value = calibEntry.scaled !== undefined ? calibEntry.scaled : '';
           scaledInput.style.width = '85px';
           scaledInput.style.padding = '5px 8px';
           scaledInput.style.borderRadius = '6px';
           scaledInput.style.border = '1px solid #bacddd';
           scaledInput.style.boxSizing = 'border-box';

           table.append(nameLabel, rawInput, scaledInput);

           const updateCalib = () => {
             const currentPrefsStr = localStorage.getItem('connectea:preferences');
             const prefs = currentPrefsStr ? JSON.parse(currentPrefsStr) : {};
             const key = `sem1_calibration:${course.id}`;
             prefs[key] = {
               raw: rawInput.value !== '' ? Number(rawInput.value) : undefined,
               scaled: scaledInput.value !== '' ? Number(scaledInput.value) : undefined
             };
             if (course.name && course.name !== course.id) {
               prefs[`sem1_calibration:${course.name}`] = prefs[key];
             }
             localStorage.setItem('connectea:preferences', JSON.stringify(prefs));
             window.dispatchEvent(new CustomEvent('connectify-settings-updated'));
           };

           rawInput.addEventListener('input', updateCalib);
           scaledInput.addEventListener('input', updateCalib);
         }
      };

      const renderCategoryInputs = () => {
        const inputContainer = catPanel.querySelector('#cx-categories-inputs');
        if (!inputContainer) return;
        inputContainer.innerHTML = '';

        const currentCats = window.cxCategories || defaultCategories;
        for (const [cat, data] of Object.entries(currentCats)) {
          const wrap = document.createElement('div');
          wrap.className = 'cx-cat-wrap';
          wrap.dataset.cat = cat;
          wrap.style.display = 'flex';
          wrap.style.alignItems = 'center';
          wrap.style.marginBottom = '10px';
          wrap.style.gap = '8px';

          const label = document.createElement('label');
          label.textContent = cat;
          label.style.width = '90px';
          label.style.fontSize = '12px';
          label.style.fontWeight = '600';
          label.style.color = data.color || '#3498db';
          label.style.overflow = 'hidden';
          label.style.textOverflow = 'ellipsis';
          label.style.whiteSpace = 'nowrap';
          label.title = cat;

          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'cx-cat-keyword-input';
          input.id = `cx-cat-input-${cat.replace(/\s+/g, '_')}`;
          input.value = Array.isArray(data.keywords) ? data.keywords.join(', ') : '';
          input.style.flex = '1';
          input.style.padding = '4px 8px';
          input.style.border = '1px solid #ccc';
          input.style.borderRadius = '4px';

          wrap.append(label, input);

          if (!defaultCategories[cat]) {
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.textContent = '✕';
            delBtn.title = `Delete category "${cat}"`;
            delBtn.style.background = 'transparent';
            delBtn.style.color = '#e74c3c';
            delBtn.style.border = '1px solid #e74c3c';
            delBtn.style.borderRadius = '4px';
            delBtn.style.cursor = 'pointer';
            delBtn.style.padding = '2px 7px';
            delBtn.style.fontSize = '11px';
            delBtn.onclick = () => {
              delete window.cxCategories[cat];
              wrap.remove();
            };
            wrap.append(delBtn);
          }

          inputContainer.append(wrap);
        }
      };

      catPanel.querySelector('#cx-cat-add').onclick = () => {
        const catName = prompt('Enter new assessment category name (e.g. Practical, Investigation):');
        if (!catName || !catName.trim()) return;
        const cleanName = catName.trim();
        if (!window.cxCategories) {
          window.cxCategories = JSON.parse(JSON.stringify(defaultCategories));
        }
        const currentCats = window.cxCategories;
        const exists = Object.keys(currentCats).some(k => k.toLowerCase() === cleanName.toLowerCase());
        if (exists) {
          alert(`Category "${cleanName}" already exists!`);
          return;
        }

        const color = window.ConnectifyTaskTypes?.getCategoryColor
          ? window.ConnectifyTaskTypes.getCategoryColor(cleanName)
          : '#3498db';

        window.cxCategories[cleanName] = {
          color,
          keywords: [cleanName.toLowerCase()]
        };

        renderCategoryInputs();
        const newInput = catPanel.querySelector(`#cx-cat-input-${cleanName.replace(/\s+/g, '_')}`);
        if (newInput) newInput.focus();
      };

      function openCategories() {
         catPanel.hidden = false;
         catBtn.setAttribute('aria-pressed', 'true');
         window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'categories' }));
         resolveCategories();
         renderCategoryInputs();
         renderCalibTable();
      }

      function closeCategories() {
         catPanel.hidden = true;
         catBtn.setAttribute('aria-pressed', 'false');
      }

      catBtn.onclick = () => {
         if (catPanel.hidden) {
            openCategories();
         } else {
            closeCategories();
            window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'home' }));
         }
      };

      window.addEventListener('connectify-open', e => {
         if (e.detail !== 'weakness') {
            closeWeakness();
         }
         if (e.detail !== 'categories') {
            closeCategories();
         }
      });

      catPanel.querySelector('#cx-cat-save').onclick = () => {
         const wraps = catPanel.querySelectorAll('.cx-cat-wrap');
         const updatedCats = {};

         wraps.forEach(wrap => {
           const cat = wrap.dataset.cat;
           const input = wrap.querySelector('.cx-cat-keyword-input');
           const oldData = (window.cxCategories && window.cxCategories[cat]) || defaultCategories[cat] || {};
           const keywords = input?.value
             ? input.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
             : (oldData.keywords || [cat.toLowerCase()]);
           updatedCats[cat] = {
             color: oldData.color || '#3498db',
             keywords: keywords.length ? keywords : [cat.toLowerCase()]
           };
         });

         window.cxCategories = updatedCats;
         try {
           localStorage.setItem('cx-categories', JSON.stringify(updatedCats));
           localStorage.setItem('connectea:categories', JSON.stringify(updatedCats));
         } catch (e) {}
         safeStorageSet({ 'cx-categories': updatedCats });

         // Rescan every assessment set to Auto immediately!
         if (window.ConnectifyTaskTypes?.rescanAllAutoAssessments) {
           window.ConnectifyTaskTypes.rescanAllAutoAssessments();
         } else {
           window.dispatchEvent(new CustomEvent('connectify-task-type-changed'));
         }

         const saveBtn = catPanel.querySelector('#cx-cat-save');
         const origText = saveBtn.textContent;
         saveBtn.textContent = '✓ Saved & Rescanned!';
         setTimeout(() => { saveBtn.textContent = origText; }, 2000);
      };

      catPanel.querySelector('#cx-cat-reset').onclick = () => {
         if (confirm('Reset assessment category keywords to factory defaults?')) {
             safeStorageRemove('cx-categories');
             try {
               localStorage.removeItem('cx-categories');
               localStorage.removeItem('connectea:categories');
             } catch (e) {}
             window.cxCategories = JSON.parse(JSON.stringify(defaultCategories));
             renderCategoryInputs();
             if (window.ConnectifyTaskTypes?.rescanAllAutoAssessments) {
               window.ConnectifyTaskTypes.rescanAllAutoAssessments();
             } else {
               window.dispatchEvent(new CustomEvent('connectify-task-type-changed'));
             }
         }
      };

      if (toolMenu && workspace) {
          toolMenu.append(toggleBtn, catBtn);
          workspace.append(panel, catPanel);
      }

      window.ConnectifyAtar = window.ConnectifyAtar || {};
      window.ConnectifyAtar.toolPanels = window.ConnectifyAtar.toolPanels || [];
      window.ConnectifyAtar.toolButtons = window.ConnectifyAtar.toolButtons || [];
      
      const existingPanels = new Set(window.ConnectifyAtar.toolPanels.map(p => p.id));
      if (!existingPanels.has(panel.id)) window.ConnectifyAtar.toolPanels.push(panel);
      if (!existingPanels.has(catPanel.id)) window.ConnectifyAtar.toolPanels.push(catPanel);

      const existingIds = new Set(window.ConnectifyAtar.toolButtons.map(b => b.id));
      if (!existingIds.has(toggleBtn.id)) window.ConnectifyAtar.toolButtons.push(toggleBtn);
      if (!existingIds.has(catBtn.id)) window.ConnectifyAtar.toolButtons.push(catBtn);

      window.ConnectifyWeakness = {
        renderChart,
        updateCheckboxes,
        destroyChart
      };
    }

    window.addEventListener('connectify-task-type-changed', () => {
      try {
        if (window.ConnectifyCompoundProgress?.update) {
          window.ConnectifyCompoundProgress.update();
        }
        if (window.ConnectifyWeakness?.renderChart) {
          window.ConnectifyWeakness.renderChart();
        }
      } catch (e) {}
    });

    initSidebarTools();
    setInterval(initSidebarTools, 1000);
    setInterval(syncFeatures, 1500);

    window.ConnectifySync = syncFeatures;
    window.ConnectifyInitSidebar = initSidebarTools;
  } catch (err) {
    console.error('Connectify error in atar-features.js:', err);
  }
})();

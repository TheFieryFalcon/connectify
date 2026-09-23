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
      safeStorageGet(['cx-categories'], res => {
        if (res && res['cx-categories']) {
          window.cxCategories = res['cx-categories'];
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

        const chartConfig = {
           chart: {
             polar: true,
             type: 'area',
             backgroundColor: 'transparent',
             spacing: [15, 15, 15, 15]
           },
           title: { text: '' },
           pane: {
             size: '72%',
             center: ['50%', '50%']
           },
           xAxis: {
             categories: labels,
             tickmarkPlacement: 'on',
             lineWidth: 0,
             labels: {
               style: { color: '#e1eaf3', fill: '#e1eaf3', fontSize: '11px' }
             }
           },
           yAxis: {
             gridLineInterpolation: 'polygon',
             lineWidth: 0,
             min: 0,
             max: 100,
             labels: { style: { color: '#8fa6bd', fill: '#8fa6bd' } }
           },
           tooltip: {
             shared: true,
             pointFormat: '<span style="color:{series.color}">{series.name}: <b>{point.y}%</b><br/>'
           },
           legend: { enabled: false },
           series: [{
             name: 'Performance',
             data: data,
             pointPlacement: 'on',
             color: '#2ecc71',
             fillOpacity: 0.35
           }]
        };

        if (window.Highcharts?.chart) {
          try {
            currentChart = window.Highcharts.chart('connectify-radar-chart', chartConfig);
          } catch (e) {
            document.dispatchEvent(new CustomEvent('connectify-render-radar', { detail: chartConfig }));
          }
        } else {
          document.dispatchEvent(new CustomEvent('connectify-render-radar', { detail: chartConfig }));
        }
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
      catBtn.textContent = 'Category Settings';
      catBtn.type = 'button';
      catBtn.id = 'connectify-categories-toggle';

      const catPanel = document.createElement('section');
      catPanel.id = 'connectify-categories';
      catPanel.hidden = true;
      catPanel.className = 'cx-workspace-panel';
      catPanel.innerHTML = `
        <header><strong>Assessment Categorization</strong></header>
        <p style="font-size:12px;color:#777;margin-bottom:16px;">Customize the comma-separated keywords used to automatically detect your assessment types:</p>
        <div id="cx-categories-inputs"></div>
        <div style="margin-top:16px;display:flex;gap:10px;">
           <button type="button" id="cx-cat-save" style="background:#2ecc71;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-weight:600;">Save Changes</button>
           <button type="button" id="cx-cat-reset" style="background:#95a5a6;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;">Reset Defaults</button>
        </div>
      `;

      const inputContainer = catPanel.querySelector('#cx-categories-inputs');
      for (const [cat, data] of Object.entries(defaultCategories)) {
          const wrap = document.createElement('div');
          wrap.className = 'cx-cat-wrap';
          wrap.style.display = 'flex';
          wrap.style.alignItems = 'center';
          wrap.style.marginBottom = '10px';
          wrap.style.gap = '8px';

          const label = document.createElement('label');
          label.textContent = cat;
          label.style.width = '90px';
          label.style.fontSize = '12px';
          label.style.fontWeight = '600';
          label.style.color = data.color;

          const input = document.createElement('input');
          input.type = 'text';
          input.id = `cx-cat-input-${cat}`;
          input.value = data.keywords.join(', ');
          input.style.flex = '1';
          input.style.padding = '4px 8px';
          input.style.border = '1px solid #ccc';
          input.style.borderRadius = '4px';

          wrap.append(label, input);
          inputContainer.append(wrap);
      }

      const updateInputValues = () => {
         for (const cat of Object.keys(defaultCategories)) {
             const input = catPanel.querySelector(`#cx-cat-input-${cat}`);
             if (input) {
                 const currentVal = (window.cxCategories[cat] || defaultCategories[cat]).keywords.join(', ');
                 input.value = currentVal;
             }
         }
      };

      function openCategories() {
         catPanel.hidden = false;
         catBtn.setAttribute('aria-pressed', 'true');
         window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'categories' }));
         resolveCategories();
         updateInputValues();
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
         for (const [cat, data] of Object.entries(defaultCategories)) {
             const input = catPanel.querySelector(`#cx-cat-input-${cat}`);
             if (input) {
                 const keywords = input.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                 window.cxCategories[cat] = {
                     color: data.color,
                     keywords: keywords.length ? keywords : data.keywords
                 };
             }
         }
         safeStorageSet({ 'cx-categories': window.cxCategories });
         window.dispatchEvent(new CustomEvent('connectify-task-type-changed'));
         alert('Assessment category keywords saved!');
      };

      catPanel.querySelector('#cx-cat-reset').onclick = () => {
         if (confirm('Reset assessment category keywords to factory defaults?')) {
             safeStorageRemove('cx-categories');
             window.cxCategories = JSON.parse(JSON.stringify(defaultCategories));
             updateInputValues();
             window.dispatchEvent(new CustomEvent('connectify-task-type-changed'));
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

/**
 * Connectify ATAR Features
 * Implements Compound Progress Bars, WACE Countdown, and Weakness Analyzer.
 */
(() => {
  'use strict';

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

  const resolveCategories = () => {
      const isFirefox = typeof browser !== 'undefined';
      const api = isFirefox ? browser : (typeof chrome !== 'undefined' ? chrome : null);
      if (api && api.storage) {
          const cb = (res) => {
              if (res['cx-categories']) window.cxCategories = res['cx-categories'];
          };
          if (isFirefox) api.storage.local.get(['cx-categories']).then(cb);
          else api.storage.local.get(['cx-categories'], cb);
      }
  };
  resolveCategories();

  function categorizeTask(taskName) {
     const lower = (taskName || '').toLowerCase();
     if (lower.includes('exam')) return 'Exam';
     for (const [cat, data] of Object.entries(window.cxCategories)) {
        if (data.keywords.some(k => lower.includes(k))) return cat;
     }
     return 'Take-Home';
  }

  if (!document.getElementById('cx-compound-styles')) {
      const style = document.createElement('style');
      style.id = 'cx-compound-styles';
      style.textContent = `
          .cx-compound-segment { transition: filter 0.2s; cursor: pointer; }
          .cx-compound-segment:hover { filter: brightness(1.5); }
      `;
      document.head.appendChild(style);
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

    // --- Expand/Collapse Buttons ---
    // User requested: "if the sidebar doesn't work, move the buttons below the connectify menu and make it scroll with the user."
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

    // --- WACE Exam Countdown ---
    const titles = Array.from(document.querySelectorAll('.eds-c-tile__title')).map(el => el.textContent);
    const isYear12 = titles.some(t => /\b12\b/i.test(t) || /\bAT[A-Z]{3}\b/.test(t));
    const yearLevel = isYear12 ? 12 : 11;
    
    if (yearLevel === 12) {
      const mainContent = document.getElementById('main-content') || document.body;
      if (!document.getElementById('connectify-wace-countdown')) {
        const countdown = document.createElement('div');
        countdown.id = 'connectify-wace-countdown';
        countdown.className = 'connectea-panel';
        countdown.style.textAlign = 'center';
        countdown.style.fontWeight = 'bold';
        countdown.style.fontSize = '14px';
        countdown.style.margin = '16px auto';
        countdown.style.maxWidth = '600px';
        countdown.style.background = '#333333';
        countdown.style.color = '#d4b483';
        countdown.style.border = '1px solid #d4b483';
        
        const now = new Date();
        const examDate = new Date(now.getFullYear(), 9, 28); 
        if (now > examDate && now.getMonth() > 10) examDate.setFullYear(now.getFullYear() + 1);
        
        const days = Math.ceil((examDate - now) / (1000 * 60 * 60 * 24));
        if (days >= 0 && days <= 300) {
          countdown.innerHTML = `⏳ <span>${days} days until WACE Exams</span>`;
          mainContent.prepend(countdown);
        }
      }
    }

    resolveCategories();

    const subjects = window.ConnectifyData.collect(true);

    // --- Compound Subject Progress Bars ---
    subjects.forEach(subject => {
       const matchingTitles = Array.from(document.querySelectorAll('.eds-c-tile__title')).filter(t => t.textContent.includes(subject.name));
       matchingTitles.forEach(cardTitle => {
           const card = cardTitle.closest('.eds-c-tile');
           if (!card) return;
           
           const header = card.querySelector('.eds-c-tile__header');
           if (!header) return;

           const signature = JSON.stringify({ tasks: subject.tasks, cats: window.cxCategories });
           
           if (header.nextElementSibling && header.nextElementSibling.classList.contains('cx-compound-progress-container')) {
              if (header.nextElementSibling.dataset.signature === signature) {
                  return; // Unchanged, don't destroy DOM!
              }
              header.nextElementSibling.remove();
           }

           const cardSemesterMatch = cardTitle.textContent.match(/Semester\s*([12])/i);
           const cardSemester = cardSemesterMatch ? +cardSemesterMatch[1] : null;

           const sortedTasks = [...subject.tasks]
               .filter(t => t.weight > 0 && (!cardSemester || t.semester === cardSemester))
               .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

           if (sortedTasks.length === 0) return;

           let totalWeight = 0;
           let overallCompleted = 0;
           let labelBreakdowns = {};

           sortedTasks.forEach(t => {
               totalWeight += t.weight;
               if (!t.pending) overallCompleted += t.weight;
               const cat = categorizeTask(t.name);
               if (!labelBreakdowns[cat]) labelBreakdowns[cat] = 0;
               labelBreakdowns[cat] += t.weight;
           });

           if (totalWeight <= 0) return;

           const bar = document.createElement('div');
           bar.style.display = 'flex';
           bar.style.height = '6px';
           bar.style.borderRadius = '3px';
           bar.style.overflow = 'hidden';
           bar.style.margin = '8px 0 4px 0';
           bar.style.border = '1px solid #3a3a3a';

           sortedTasks.forEach(t => {
              const cat = categorizeTask(t.name);
              const isCompleted = !t.pending;
              
              const pct = (t.weight / totalWeight) * 100;
              const segment = document.createElement('div');
              segment.className = 'cx-compound-segment';
              segment.style.width = `${pct}%`;
              segment.style.backgroundColor = window.cxCategories[cat] ? window.cxCategories[cat].color : '#999';
              if (!isCompleted) {
                 segment.style.opacity = '0.25';
              }
              segment.style.borderRight = '1px solid #1e1e1e';
              segment.title = `${t.name}: ${t.weight}% (${isCompleted ? 'Completed' : 'Remaining'})`;
              bar.appendChild(segment);
           });

           let tooltipParts = [];
           for (const [cat, weight] of Object.entries(labelBreakdowns)) {
               tooltipParts.push(`${cat} ${Math.round((weight / totalWeight) * 100)}%`);
           }

           const label = document.createElement('div');
           label.style.fontSize = '10px';
           label.style.color = '#999';
           label.style.textAlign = 'right';
           label.textContent = `${tooltipParts.join(' • ')} | ${Math.round((overallCompleted / totalWeight) * 100)}% Done`;

           const container = document.createElement('div');
           container.className = 'cx-compound-progress-container';
           container.dataset.signature = signature;
           container.style.padding = '0 16px';
           container.appendChild(bar);
           container.appendChild(label);

            header.after(container);
        });
     });
  }

  // --- Weakness Analyzer & Categories Panel ---
  function initSidebarTools() {
    if (hasInitializedSidebar || !document.querySelector('#connectify-sidebar')) return;
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
          return name.replace(/\bATAR\b|\bYear\s*\d+\b/gi, '').replace(/\s+/g, ' ').trim();
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
             <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="font-weight:600; font-size:12px;">Included Subjects</span>
                <span style="display:flex; gap:8px; align-items:center;">
                   <button type="button" id="cx-weakness-select-all" class="cx-weakness-filter-btn">All</button>
                   <span style="color:#a0b0c0; font-size:11px;">|</span>
                   <button type="button" id="cx-weakness-deselect-all" class="cx-weakness-filter-btn">None</button>
                </span>
             </div>
             <div id="cx-weakness-checkboxes"></div>
          </div>
        `;

        if (toolMenu) toolMenu.append(toggleBtn);
        if (workspace) workspace.append(panel);

        const getSubjectList = () => {
          const subjects = window.ConnectifyData?.collect ? window.ConnectifyData.collect(true) : [];
          let rawNames = subjects.map(s => s.name).filter(Boolean);
          
          if (rawNames.length === 0 && window.ConnectifyAtar?.readCourses) {
            const rawCourses = window.ConnectifyAtar.readCourses(false);
            if (rawCourses) {
              rawNames = [...(rawCourses[0] || []), ...(rawCourses[1] || [])].map(c => c.name).filter(Boolean);
            }
          }

          const map = new Map();
          for (const raw of rawNames) {
            const clean = cleanSubjectName(raw) || raw;
            if (!map.has(clean)) {
              map.set(clean, raw);
            }
          }
          return map;
        };

        const renderSubjectCheckboxes = () => {
          const container = document.getElementById('cx-weakness-checkboxes');
          if (!container) return;

          const subjectMap = getSubjectList();
          const cleanNames = Array.from(subjectMap.keys()).sort();

          if (cleanNames.length === 0) {
            container.innerHTML = '<span style="font-size:11px;color:#8898aa;grid-column:1/-1;">No subjects detected yet. Expand course outlines in Connect to load subjects.</span>';
            return;
          }

          const sig = cleanNames.join('|');
          if (container.dataset.signature !== sig) {
            container.dataset.signature = sig;
            container.innerHTML = '';

            for (const cleanName of cleanNames) {
              const rawName = subjectMap.get(cleanName);
              const label = document.createElement('label');
              label.className = 'cx-weakness-checkbox-label';
              label.title = rawName || cleanName;
              label.style.display = 'flex';
              label.style.alignItems = 'center';

              const cb = document.createElement('input');
              cb.type = 'checkbox';
              cb.value = cleanName;
              cb.style.margin = '0 8px 0 0';
              cb.style.cursor = 'pointer';
              cb.style.flexShrink = '0';
              cb.checked = !disabledWeaknessSubjects.has(cleanName) && (!rawName || !disabledWeaknessSubjects.has(rawName));

              cb.addEventListener('change', () => {
                if (cb.checked) {
                  disabledWeaknessSubjects.delete(cleanName);
                  if (rawName) disabledWeaknessSubjects.delete(rawName);
                } else {
                  disabledWeaknessSubjects.add(cleanName);
                  if (rawName) disabledWeaknessSubjects.add(rawName);
                }
                saveDisabledSubjects();
                renderChart();
              });

              const span = document.createElement('span');
              span.textContent = cleanName;

              label.append(cb, span);
              container.append(label);
            }
          } else {
            container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
              const clean = cb.value;
              const raw = subjectMap.get(clean);
              cb.checked = !disabledWeaknessSubjects.has(clean) && (!raw || !disabledWeaknessSubjects.has(raw));
            });
          }
        };

        const selectAllBtn = panel.querySelector('#cx-weakness-select-all');
        const deselectAllBtn = panel.querySelector('#cx-weakness-deselect-all');
        if (selectAllBtn) {
          selectAllBtn.addEventListener('click', () => {
            disabledWeaknessSubjects.clear();
            saveDisabledSubjects();
            renderSubjectCheckboxes();
            renderChart();
          });
        }
        if (deselectAllBtn) {
          deselectAllBtn.addEventListener('click', () => {
            const subjectMap = getSubjectList();
            for (const [clean, raw] of subjectMap.entries()) {
              disabledWeaknessSubjects.add(clean);
              if (raw) disabledWeaknessSubjects.add(raw);
            }
            saveDisabledSubjects();
            renderSubjectCheckboxes();
            renderChart();
          });
        }

        let currentChart = null;

        const renderChart = () => {
          renderSubjectCheckboxes();
          const chartDiv = document.getElementById('connectify-radar-chart');
          if (!window.Highcharts || !chartDiv) return;

          const subjectMap = getSubjectList();
          let selectedCount = 0;
          for (const cleanName of subjectMap.keys()) {
            const rawName = subjectMap.get(cleanName);
            if (!disabledWeaknessSubjects.has(cleanName) && (!rawName || !disabledWeaknessSubjects.has(rawName))) {
              selectedCount++;
            }
          }

          if (subjectMap.size === 0) {
            if (currentChart && currentChart.destroy) {
              currentChart.destroy();
            }
            chartDiv.innerHTML = '<div style="padding:20px;color:#999;text-align:center;display:flex;align-items:center;justify-content:center;height:100%;">No subjects detected yet. Expand course outlines in Connect to load subjects.</div>';
            currentChart = null;
            return;
          }

          if (selectedCount < 3) {
            if (currentChart && currentChart.destroy) {
              currentChart.destroy();
            }
            chartDiv.innerHTML = '<div style="padding:30px 20px;color:#d4b483;text-align:center;font-size:13px;font-weight:600;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;box-sizing:border-box;"><span style="font-size:26px;margin-bottom:8px;">⚠️</span><span>At least 3 subjects must be selected for radar charts!</span></div>';
            currentChart = null;
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
                      const label = mode === 'subject' ? cleaned : categorizeTask(t.name);
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
              if (currentChart && currentChart.destroy) {
                currentChart.destroy();
              }
              chartDiv.innerHTML = '<div style="padding:20px;color:#999;text-align:center;display:flex;align-items:center;justify-content:center;height:100%;">No completed assessments to plot for the selected subjects.</div>';
              currentChart = null;
              return;
          }

          if (labels.length < 3) {
              if (currentChart && currentChart.destroy) {
                currentChart.destroy();
              }
              chartDiv.innerHTML = '<div style="padding:30px 20px;color:#d4b483;text-align:center;font-size:13px;font-weight:600;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;box-sizing:border-box;"><span style="font-size:26px;margin-bottom:8px;">⚠️</span><span>At least 3 subjects must be selected for radar charts!</span></div>';
              currentChart = null;
              return;
          }

          currentChart = window.Highcharts.chart('connectify-radar-chart', {
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
               color: '#d4b483',
               fillOpacity: 0.2
             }],
             credits: { enabled: false }
          });
        };

        document.getElementById('cx-radar-mode').addEventListener('change', renderChart);

        const openWeaknessTool = () => {
          const sidebarEl = document.getElementById('connectify-sidebar');
          if (sidebarEl) {
            sidebarEl.classList.add('cx-tool-active');
            sidebarEl.hidden = false;
          }
          document.querySelectorAll('.cx-workspace-panel').forEach(p => p.hidden = true);
          document.querySelectorAll('.cx-tool-menu button').forEach(b => b.setAttribute('aria-expanded', 'false'));
          toggleBtn.setAttribute('aria-expanded', 'true');
          panel.hidden = false;
          renderSubjectCheckboxes();
          renderChart();
          requestAnimationFrame(() => {
            if (currentChart && currentChart.reflow) {
              currentChart.reflow();
            }
            setTimeout(() => {
              if (currentChart && currentChart.reflow) {
                currentChart.reflow();
              }
            }, 100);
          });
        };

        toggleBtn.addEventListener('click', () => {
          openWeaknessTool();
          window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'weakness' }));
        });
       
        window.addEventListener('connectify-open', e => {
          if (e.detail !== 'weakness') {
            panel.hidden = true;
            toggleBtn.setAttribute('aria-expanded', 'false');
          } else if (panel.hidden) {
            openWeaknessTool();
          }
        });

        if (window.ResizeObserver) {
          const chartDiv = document.getElementById('connectify-radar-chart');
          if (chartDiv) {
            const ro = new ResizeObserver(() => {
              if (currentChart && currentChart.reflow && !panel.hidden) {
                currentChart.reflow();
              }
            });
            ro.observe(chartDiv);
          }
        }

        const catBtn = document.createElement('button');
       catBtn.textContent = 'Settings';
       catBtn.type = 'button';
       catBtn.id = 'connectify-categories-toggle';
       
       const catPanel = document.createElement('section');
       catPanel.id = 'connectify-categories';
       catPanel.hidden = true;
       catPanel.className = 'cx-workspace-panel';
       
       const catInner = document.createElement('div');
       catInner.innerHTML = `
         <header style="margin-bottom:20px;">
           <strong style="font-size:18px;">Settings</strong>
         </header>
       `;

       // === CALIBRATION SECTION ===
       const calibSection = document.createElement('section');
       calibSection.className = 'cx-settings-section';
       calibSection.style.marginBottom = '28px';
       calibSection.innerHTML = `
         <header style="margin-bottom:8px;"><strong>Semester 1 Scaling Calibration</strong></header>
         <p style="font-size:12px;color:#788896;margin:0 0 14px 0;">Enter your school's Semester 1 scaled scores to calibrate the model to your cohort's historical distribution.</p>
       `;
       
       const calibTable = document.createElement('div');
       calibTable.style.display = 'grid';
       calibTable.style.gridTemplateColumns = 'minmax(140px, 220px) 75px 75px';
       calibTable.style.gap = '10px 14px';
       calibTable.style.alignItems = 'center';
       calibTable.style.marginTop = '12px';
       
       // Function to re-render the calibration table dynamically
       const renderCalibTable = () => {
         if (!window.ConnectifyAtar || !window.ConnectifyAtar.readCourses) return;
         const courses = window.ConnectifyAtar.readCourses(false);
         if (!courses) return;

         const courseList = new Map();
         for (const course of [...(courses[0] || []), ...(courses[1] || [])]) {
           if (!courseList.has(course.id)) {
             courseList.set(course.id, course);
           }
         }
         if (courseList.size === 0) return;
         
         calibTable.innerHTML = '';
         const prefsStr = localStorage.getItem('connectea:preferences');
         const savedPrefs = prefsStr ? JSON.parse(prefsStr) : {};
         
         for (const course of courseList.values()) {
           const calibEntry = savedPrefs[`sem1_calibration:${course.id}`] || {};
           const knownSem1Raw = calibEntry.raw !== undefined ? calibEntry.raw : course.mark;
           
           const nameLabel = document.createElement('span');
           nameLabel.textContent = course.name;
           nameLabel.style.fontSize = '12px';
           nameLabel.style.fontWeight = 'bold';
           
           const rawInput = document.createElement('input');
           rawInput.type = 'number';
           rawInput.placeholder = 'Raw';
           rawInput.title = 'Semester 1 School Raw Mark (%)';
           rawInput.value = knownSem1Raw !== undefined ? knownSem1Raw : '';
           rawInput.style.width = '75px';
           rawInput.style.padding = '5px 8px';
           rawInput.style.borderRadius = '6px';
           rawInput.style.border = '1px solid #bacddd';
           
           const scaledInput = document.createElement('input');
           scaledInput.type = 'number';
           scaledInput.placeholder = 'Scaled';
           scaledInput.title = 'Semester 1 School Scaled Mark';
           scaledInput.value = calibEntry.scaled !== undefined ? calibEntry.scaled : '';
           scaledInput.style.width = '75px';
           scaledInput.style.padding = '5px 8px';
           scaledInput.style.borderRadius = '6px';
           scaledInput.style.border = '1px solid #bacddd';
           
           calibTable.append(nameLabel, rawInput, scaledInput);
           
           const updateCalib = () => {
             const prefsStr = localStorage.getItem('connectea:preferences');
             const prefs = prefsStr ? JSON.parse(prefsStr) : {};
             
             prefs[`sem1_calibration:${course.id}`] = {
                raw: rawInput.value ? Number(rawInput.value) : undefined,
                scaled: scaledInput.value ? Number(scaledInput.value) : undefined
             };
             localStorage.setItem('connectea:preferences', JSON.stringify(prefs));
             window.dispatchEvent(new CustomEvent('connectify-settings-updated'));
           };
           rawInput.addEventListener('input', updateCalib);
           scaledInput.addEventListener('input', updateCalib);
         }
       };
       
       calibSection.append(calibTable);

       // === CATEGORIES SECTION ===
       const catSection = document.createElement('section');
       catSection.className = 'cx-settings-section';
       catSection.style.marginTop = '36px';
       catSection.style.borderTop = '1px solid #d8e3ee';
       catSection.style.paddingTop = '24px';
       catSection.innerHTML = `
         <header style="margin-bottom:8px;"><strong>Assessment Categories</strong></header>
         <p style="font-size:12px;color:#788896;margin:0 0 16px 0;">Configure task categorization keywords to customize subject breakdown analytics.</p>
       `;

       const catListContainer = document.createElement('div');
       catListContainer.id = 'cx-categories-inputs';
       catSection.append(catListContainer);

       // Populate inputs from window.cxCategories which was loaded async
       const renderInputs = () => {
           catListContainer.innerHTML = '';
           for (const cat of Object.keys(defaultCategories)) {
               const wrap = document.createElement('div');
               wrap.className = 'cx-cat-wrap';
               wrap.style.marginBottom = '10px';
               const currentVal = (window.cxCategories[cat] || defaultCategories[cat]).keywords.join(', ');
               wrap.innerHTML = `<label style="display:inline-block;width:90px;font-size:12px;font-weight:600;">${cat}</label>
                                 <input type="text" id="cx-cat-${cat}" value="${currentVal}" style="width:200px; padding:6px 8px; border-radius:6px; border:1px solid #bacddd; font-size:12px;">`;
               catListContainer.append(wrap);
           }
       };

       const btnRow = document.createElement('div');
       btnRow.style.marginTop = '18px';

       const saveBtn = document.createElement('button');
       saveBtn.textContent = 'Save Categories';
       saveBtn.type = 'button';
       saveBtn.className = 'eds-c-button';
       saveBtn.onclick = () => {
           for (const cat of Object.keys(defaultCategories)) {
               const val = document.getElementById(`cx-cat-${cat}`).value;
               window.cxCategories[cat] = {
                   color: defaultCategories[cat].color,
                   keywords: val.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
               };
           }
           const api = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);
           if (api && api.storage) {
               api.storage.local.set({ 'cx-categories': window.cxCategories });
           }
           alert('Categories saved!');
       };
       
       const resetBtn = document.createElement('button');
       resetBtn.textContent = 'Reset to Defaults';
       resetBtn.type = 'button';
       resetBtn.className = 'eds-c-button';
       resetBtn.style.marginLeft = '8px';
       resetBtn.onclick = () => {
           window.cxCategories = JSON.parse(JSON.stringify(defaultCategories));
           const api = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);
           if (api && api.storage) {
               api.storage.local.remove('cx-categories');
           }
           renderInputs();
           alert('Categories reset to default.');
       };

       btnRow.append(saveBtn, resetBtn);
       catSection.append(btnRow);

       catInner.append(calibSection, catSection);
       catPanel.appendChild(catInner);

       if (toolMenu) toolMenu.append(catBtn);
       if (workspace) workspace.append(catPanel);

       catBtn.addEventListener('click', () => {
          renderInputs();
          renderCalibTable();
          document.querySelectorAll('.cx-workspace-panel').forEach(p => p.hidden = true);
          document.querySelectorAll('.cx-tool-menu button').forEach(b => b.setAttribute('aria-expanded', 'false'));
          catBtn.setAttribute('aria-expanded', 'true');
          catPanel.hidden = false;
          window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'categories' }));
       });
       
       window.addEventListener('connectify-open', e => {
           if (e.detail !== 'categories') {
               catPanel.hidden = true;
               catBtn.setAttribute('aria-expanded', 'false');
           }
       });
              window.ConnectifyAtar = window.ConnectifyAtar || {};
        window.ConnectifyAtar.toolButtons = window.ConnectifyAtar.toolButtons || [];
        if (!window.ConnectifyAtar.toolButtons.includes(toggleBtn)) {
          window.ConnectifyAtar.toolButtons.push(toggleBtn);
        }
        if (!window.ConnectifyAtar.toolButtons.includes(catBtn)) {
          window.ConnectifyAtar.toolButtons.push(catBtn);
        }
    }

  initSidebarTools();
  setInterval(initSidebarTools, 1000);
  setInterval(syncFeatures, 1500);
})();

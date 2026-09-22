/**
 * Connext ATAR Features
 * Implements Compound Progress Bars, WACE Countdown, and Weakness Analyzer.
 */
(() => {
  'use strict';

  let hasInitializedSidebar = false;
  let hasAutoExpanded = false;

  function syncFeatures() {
    if (!window.ConnextData) return;
    
    if (!hasAutoExpanded) {
        if (document.querySelectorAll('.eds-c-tile').length > 0) {
            window.ConnextData.expandAll(true);
            hasAutoExpanded = true;
        } else {
            return; // Wait for Vaadin to render the cards!
        }
    }

    // --- Left Sidebar Expand/Collapse ---
    const leftMenu = document.querySelector('.cvr-c-category-menu__list');
    if (leftMenu && !document.getElementById('cx-expand-btn')) {
        const btnContainer = document.createElement('div');
        btnContainer.id = 'cx-expand-btn';
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '8px';
        btnContainer.style.padding = '12px 16px';
        
        const createBtn = (text, isExpand) => {
           const btn = document.createElement('button');
           btn.textContent = text;
           btn.type = 'button';
           btn.className = 'eds-c-button';
           btn.style.flex = '1';
           btn.style.padding = '6px';
           btn.style.fontSize = '12px';
           btn.onclick = () => window.ConnextData.expandAll(isExpand);
           return btn;
        };
        btnContainer.append(createBtn('Expand', true), createBtn('Collapse', false));
        leftMenu.prepend(btnContainer);
    }

    // --- WACE Exam Countdown ---
    const titles = Array.from(document.querySelectorAll('.eds-c-tile__title')).map(el => el.textContent);
    const isYear12 = titles.some(t => /\b12\b/i.test(t) || /\bAT[A-Z]*\b/.test(t));
    const yearLevel = isYear12 ? 12 : 11;
    
    if (yearLevel === 12) {
      const mainContent = document.getElementById('main-content') || document.body;
      if (!document.getElementById('connext-wace-countdown')) {
        const countdown = document.createElement('div');
        countdown.id = 'connext-wace-countdown';
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

    // --- Custom Categories Management ---
    const defaultCategories = {
       Exam: { color: '#e74c3c', keywords: ['exam', 'semester'] },
       Test: { color: '#2ecc71', keywords: ['test', 'quiz', 'in-class', 'in class'] },
       Application: { color: '#3498db', keywords: ['application', 'investigation', 'validation', 'practical'] },
       Essay: { color: '#9b59b6', keywords: ['essay', 'response', 'analysis', 'extended'] },
       'Take-Home': { color: '#f1c40f', keywords: ['take-home', 'assignment', 'project', 'portfolio'] }
    };
    
    let categories = defaultCategories;
    try {
        const saved = localStorage.getItem('cx-categories');
        if (saved) categories = JSON.parse(saved);
    } catch (e) {}

    function categorizeTask(taskName) {
       const lower = (taskName || '').toLowerCase();
       if (lower.includes('exam')) return 'Exam';
       for (const [cat, data] of Object.entries(categories)) {
          if (data.keywords.some(k => lower.includes(k))) return cat;
       }
       return 'Take-Home';
    }

    const subjects = window.ConnextData.collect(true);

    // --- Compound Subject Progress Bars ---
    subjects.forEach(subject => {
       // Inject into ALL instances of the subject card (e.g. Sem 1 and Sem 2)
       const matchingTitles = Array.from(document.querySelectorAll('.eds-c-tile__title')).filter(t => t.textContent.includes(subject.name));
       matchingTitles.forEach(cardTitle => {
           const card = cardTitle.closest('.eds-c-tile');
           if (!card) return;
           
           const header = card.querySelector('.eds-c-tile__header');
           if (!header) return;

           if (header.nextElementSibling && header.nextElementSibling.classList.contains('cx-compound-progress-container')) {
              // Already injected or dirty. Let's remove and re-render to update
              header.nextElementSibling.remove();
           }

           let totalWeight = 0;
           let overallCompleted = 0;
           const breakdowns = {};
           for (const cat of Object.keys(categories)) {
               breakdowns[cat] = { completed: 0, remaining: 0 };
           }
           
           subject.tasks.forEach(t => {
              if (t.weight === undefined || t.weight === null || isNaN(t.weight)) return;
              totalWeight += t.weight;
              const cat = categorizeTask(t.name);
              const isCompleted = !t.pending;
              
              if (!breakdowns[cat]) breakdowns[cat] = { completed: 0, remaining: 0 };

              if (isCompleted) {
                 breakdowns[cat].completed += t.weight;
                 overallCompleted += t.weight;
              } else {
                 breakdowns[cat].remaining += t.weight;
              }
           });

           if (totalWeight <= 0) return;

           const bar = document.createElement('div');
           bar.style.display = 'flex';
           bar.style.height = '6px';
           bar.style.borderRadius = '3px';
           bar.style.overflow = 'hidden';
           bar.style.margin = '8px 0 4px 0';
           bar.style.border = '1px solid #3a3a3a';

           let tooltipParts = [];

           for (const [cat, data] of Object.entries(breakdowns)) {
              const catTotal = data.completed + data.remaining;
              if (catTotal <= 0) continue;
              
              if (data.completed > 0) {
                 const pctComp = (data.completed / totalWeight) * 100;
                 const segmentC = document.createElement('div');
                 segmentC.style.width = `${pctComp}%`;
                 segmentC.style.backgroundColor = categories[cat] ? categories[cat].color : '#999';
                 segmentC.title = `${cat} (Completed): ${data.completed.toFixed(1)}%`;
                 bar.appendChild(segmentC);
              }
              
              if (data.remaining > 0) {
                 const pctRem = (data.remaining / totalWeight) * 100;
                 const segmentR = document.createElement('div');
                 segmentR.style.width = `${pctRem}%`;
                 segmentR.style.backgroundColor = categories[cat] ? categories[cat].color : '#999';
                 segmentR.style.opacity = '0.25';
                 segmentR.title = `${cat} (Remaining): ${data.remaining.toFixed(1)}%`;
                 bar.appendChild(segmentR);
              }
              
              tooltipParts.push(`${cat} ${Math.round((catTotal / totalWeight) * 100)}%`);
           }

           const label = document.createElement('div');
           label.style.fontSize = '10px';
           label.style.color = '#999';
           label.style.textAlign = 'right';
           label.textContent = `${tooltipParts.join(' • ')} | ${Math.round((overallCompleted / totalWeight) * 100)}% Done`;

           const container = document.createElement('div');
           container.className = 'cx-compound-progress-container';
           container.style.padding = '0 16px';
           container.appendChild(bar);
           container.appendChild(label);

           header.after(container);
       });
    });

    // --- Weakness Analyzer ---
    if (!hasInitializedSidebar && document.querySelector('#connext-sidebar')) {
       hasInitializedSidebar = true;
       const toggleBtn = document.createElement('button');
       toggleBtn.textContent = 'Weakness Analyzer';
       toggleBtn.type = 'button';
       toggleBtn.id = 'connext-weakness-toggle';
       
       const panel = document.createElement('section');
       panel.id = 'connext-weakness';
       panel.hidden = true;
       panel.className = 'cx-workspace-panel';
       panel.innerHTML = `
         <header><strong>Weakness Analyzer</strong></header>
         <div style="margin-bottom:12px; display:flex; gap:8px;">
            <select id="cx-radar-mode" style="flex:1; padding:4px;">
               <option value="type">By Assessment Type</option>
               <option value="subject">By Subject</option>
            </select>
            <button id="cx-radar-config-btn" type="button" class="eds-c-button" style="padding:4px 8px;">⚙️ Edit Categories</button>
         </div>
         <div id="cx-radar-config" style="display:none; margin-bottom:12px; font-size:12px;"></div>
         <div id="connext-radar-chart" style="width:100%;height:300px;background:#333333;border-radius:6px;border:1px solid #3a3a3a;"></div>
       `;

       const toolMenu = document.querySelector('.cx-tool-menu');
       if (toolMenu) toolMenu.append(toggleBtn);
       else document.body.append(toggleBtn);

       const workspace = document.querySelector('.cx-workspace');
       if (workspace) workspace.append(panel);
       else document.body.append(panel);
       
       if (window.ConnextAtar) {
          window.ConnextAtar.toolButtons = window.ConnextAtar.toolButtons || [];
          window.ConnextAtar.toolButtons.push(toggleBtn);
       }

       // Config UI logic
       const configBtn = panel.querySelector('#cx-radar-config-btn');
       const configDiv = panel.querySelector('#cx-radar-config');
       const modeSelect = panel.querySelector('#cx-radar-mode');

       configBtn.onclick = () => {
           if (configDiv.style.display !== 'none') {
               configDiv.style.display = 'none';
               return;
           }
           configDiv.style.display = 'block';
           configDiv.innerHTML = '<p style="color:#999; margin:0 0 8px 0;">Comma-separated keywords for each category:</p>';
           
           for (const cat of Object.keys(defaultCategories)) {
               const wrap = document.createElement('div');
               wrap.style.marginBottom = '4px';
               wrap.innerHTML = `<label style="display:inline-block;width:80px;">${cat}</label>
                                 <input type="text" id="cx-cat-${cat}" value="${(categories[cat] || defaultCategories[cat]).keywords.join(', ')}" style="width:180px; padding:2px;">`;
               configDiv.appendChild(wrap);
           }
           const saveBtn = document.createElement('button');
           saveBtn.textContent = 'Save & Render';
           saveBtn.type = 'button';
           saveBtn.className = 'eds-c-button';
           saveBtn.style.marginTop = '8px';
           saveBtn.onclick = () => {
               for (const cat of Object.keys(defaultCategories)) {
                   const val = document.getElementById(`cx-cat-${cat}`).value;
                   categories[cat] = {
                       color: defaultCategories[cat].color,
                       keywords: val.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
                   };
               }
               localStorage.setItem('cx-categories', JSON.stringify(categories));
               configDiv.style.display = 'none';
               renderChart();
           };
           const resetBtn = document.createElement('button');
           resetBtn.textContent = 'Reset';
           resetBtn.type = 'button';
           resetBtn.className = 'eds-c-button';
           resetBtn.style.marginTop = '8px';
           resetBtn.style.marginLeft = '8px';
           resetBtn.onclick = () => {
               categories = JSON.parse(JSON.stringify(defaultCategories));
               localStorage.removeItem('cx-categories');
               configDiv.style.display = 'none';
               renderChart();
           };
           configDiv.append(saveBtn, resetBtn);
       };

       const renderChart = () => {
         const chartDiv = document.getElementById('connext-radar-chart');
         if (!window.Highcharts) {
           chartDiv.innerHTML = '<div style="padding:20px;color:red;">Highcharts not loaded by Connect.</div>';
           return;
         }
         
         const perf = {};
         const mode = modeSelect.value; // 'type' or 'subject'

         window.ConnextData.collect(true).forEach(subject => {
             subject.tasks.forEach(t => {
                 if (t.weight > 0 && !t.pending && t.score !== null) {
                     const earned = (t.score / 100) * t.weight;
                     const label = mode === 'subject' ? subject.name : categorizeTask(t.name);
                     
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
             chartDiv.innerHTML = '<div style="padding:20px;color:#999;">No completed assessments found to plot.</div>';
             return;
         }

         window.Highcharts.chart('connext-radar-chart', {
            chart: { polar: true, type: 'line', backgroundColor: 'transparent' },
            title: { text: '' },
            pane: { size: '80%' },
            xAxis: { categories: labels, tickmarkPlacement: 'on', lineWidth: 0, labels: { style: { color: '#cccccc' } } },
            yAxis: { gridLineInterpolation: 'polygon', lineWidth: 0, min: 0, max: 100, labels: { style: { color: '#999' } } },
            tooltip: { shared: true, pointFormat: '<span style="color:{series.color}">{series.name}: <b>{point.y}%</b><br/>' },
            legend: { enabled: false },
            series: [{ name: 'Performance', data: data, pointPlacement: 'on', color: '#d4b483' }],
            credits: { enabled: false }
         });
       };

       modeSelect.addEventListener('change', renderChart);

       toggleBtn.addEventListener('click', () => {
          const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
          document.querySelectorAll('section[id^="connectea-"], section[id^="connext-"]').forEach(p => p.hidden = true);
          document.querySelectorAll('button[aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
          
          if (!expanded) {
            toggleBtn.setAttribute('aria-expanded', 'true');
            panel.hidden = false;
            renderChart();
          }
       });
    }
  }

  setInterval(syncFeatures, 1500);
})();

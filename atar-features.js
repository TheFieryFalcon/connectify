/**
 * Connectify ATAR Features
 * Implements Compound Progress Bars, WACE Countdown, and Weakness Analyzer.
 */
(() => {
  'use strict';

  let hasInitializedSidebar = false;
  let hasAutoExpanded = false;

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

    // --- Custom Categories Management ---
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

    // Fallback if extension storage fails to load yet
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

    // --- Weakness Analyzer & Categories Panel ---
    if (!hasInitializedSidebar && document.querySelector('#connectify-sidebar')) {
       hasInitializedSidebar = true;
       
       const toolMenu = document.querySelector('.cx-tool-menu');
       const workspace = document.querySelector('.cx-workspace');
       
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
         <div style="margin-bottom:12px; display:flex; gap:8px;">
            <select id="cx-radar-mode" style="flex:1; padding:4px;">
               <option value="type">By Assessment Type</option>
               <option value="subject">By Subject</option>
            </select>
         </div>
         <div id="connectify-radar-chart" style="width:100%;height:300px;background:#333333;border-radius:6px;border:1px solid #3a3a3a;"></div>
       `;

       if (toolMenu) toolMenu.append(toggleBtn);
       if (workspace) workspace.append(panel);

       const renderChart = () => {
         const chartDiv = document.getElementById('connectify-radar-chart');
         if (!window.Highcharts) return;
         
         const perf = {};
         const mode = document.getElementById('cx-radar-mode').value;

         window.ConnectifyData.collect(true).forEach(subject => {
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

         window.Highcharts.chart('connectify-radar-chart', {
            chart: { polar: true, type: 'area', backgroundColor: 'transparent' },
            title: { text: '' },
            pane: { size: '80%' },
            xAxis: { categories: labels, tickmarkPlacement: 'on', lineWidth: 0, labels: { style: { color: '#cccccc' } } },
            yAxis: { gridLineInterpolation: 'polygon', lineWidth: 0, min: 0, max: 100, labels: { style: { color: '#999' } } },
            tooltip: { shared: true, pointFormat: '<span style="color:{series.color}">{series.name}: <b>{point.y}%</b><br/>' },
            legend: { enabled: false },
            series: [{ name: 'Performance', data: data, pointPlacement: 'on', color: '#d4b483', fillOpacity: 0.2 }],
            credits: { enabled: false }
         });
       };

       document.getElementById('cx-radar-mode').addEventListener('change', renderChart);

       toggleBtn.addEventListener('click', () => {
          document.querySelectorAll('.cx-workspace-panel').forEach(p => p.hidden = true);
          document.querySelectorAll('.cx-tool-menu button').forEach(b => b.setAttribute('aria-expanded', 'false'));
          toggleBtn.setAttribute('aria-expanded', 'true');
          panel.hidden = false;
          renderChart();
       });
       
       window.addEventListener('connectify-open', e => {
           if (e.detail !== 'weakness') {
               panel.hidden = true;
               toggleBtn.setAttribute('aria-expanded', 'false');
           }
       });

       const catBtn = document.createElement('button');
       catBtn.textContent = 'Settings / Categories';
       catBtn.type = 'button';
       catBtn.id = 'connectify-categories-toggle';
       
       const catPanel = document.createElement('section');
       catPanel.id = 'connectify-categories';
       catPanel.hidden = true;
       catPanel.className = 'cx-workspace-panel';
       
       const catInner = document.createElement('div');
       catInner.innerHTML = `
         <header><strong>Category Settings</strong></header>
         <p style="font-size:12px;color:#999;margin-bottom:12px;">Comma-separated keywords for each category.</p>
       `;
       
       // Populate inputs from window.cxCategories which was loaded async
       const renderInputs = () => {
           Array.from(catInner.querySelectorAll('.cx-cat-wrap')).forEach(e => e.remove());
           for (const cat of Object.keys(defaultCategories)) {
               const wrap = document.createElement('div');
               wrap.className = 'cx-cat-wrap';
               wrap.style.marginBottom = '6px';
               const currentVal = (window.cxCategories[cat] || defaultCategories[cat]).keywords.join(', ');
               wrap.innerHTML = `<label style="display:inline-block;width:80px;font-size:12px;">${cat}</label>
                                 <input type="text" id="cx-cat-${cat}" value="${currentVal}" style="width:180px; padding:4px; background:#212121; color:#ddd; border:1px solid #4a4a4a; font-size:12px;">`;
               catInner.insertBefore(wrap, saveBtn);
           }
       };
       
       const saveBtn = document.createElement('button');
       saveBtn.textContent = 'Save Categories';
       saveBtn.type = 'button';
       saveBtn.className = 'eds-c-button';
       saveBtn.style.marginTop = '12px';
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
       resetBtn.textContent = 'Reset to Default';
       resetBtn.type = 'button';
       resetBtn.className = 'eds-c-button';
       resetBtn.style.marginTop = '12px';
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
       
       catInner.append(saveBtn, resetBtn);
       catPanel.appendChild(catInner);

       if (toolMenu) toolMenu.append(catBtn);
       if (workspace) workspace.append(catPanel);

       catBtn.addEventListener('click', () => {
          renderInputs();
          document.querySelectorAll('.cx-workspace-panel').forEach(p => p.hidden = true);
          document.querySelectorAll('.cx-tool-menu button').forEach(b => b.setAttribute('aria-expanded', 'false'));
          catBtn.setAttribute('aria-expanded', 'true');
          catPanel.hidden = false;
       });
       
       window.addEventListener('connectify-open', e => {
           if (e.detail !== 'categories') {
               catPanel.hidden = true;
               catBtn.setAttribute('aria-expanded', 'false');
           }
       });
       
       if (window.ConnectifyAtar) {
          window.ConnectifyAtar.toolButtons = window.ConnectifyAtar.toolButtons || [];
          window.ConnectifyAtar.toolButtons.push(toggleBtn, catBtn);
       }
    }
  }

  setInterval(syncFeatures, 1500);
})();

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
        window.ConnextData.expandAll(true);
        hasAutoExpanded = true;
    }

    // --- 1. WACE Exam Countdown ---
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

    // --- 2. Assessment Categorization ---
    const categories = {
       Exam: { color: '#e74c3c', keywords: ['exam', 'semester'] },
       Test: { color: '#2ecc71', keywords: ['test', 'quiz', 'in-class', 'in class'] },
       Application: { color: '#3498db', keywords: ['application', 'investigation', 'validation', 'practical'] },
       Essay: { color: '#9b59b6', keywords: ['essay', 'response', 'analysis', 'extended'] },
       'Take-Home': { color: '#f1c40f', keywords: ['take-home', 'assignment', 'project', 'portfolio'] }
    };

    function categorizeTask(taskName) {
       const lower = (taskName || '').toLowerCase();
       if (lower.includes('exam')) return 'Exam';
       for (const [cat, data] of Object.entries(categories)) {
          if (data.keywords.some(k => lower.includes(k))) return cat;
       }
       return 'Take-Home';
    }

    const subjects = window.ConnextData.collect(true);

    // --- 3. Compound Subject Progress Bars ---
    subjects.forEach(subject => {
       const cardTitle = Array.from(document.querySelectorAll('.eds-c-tile__title')).find(t => t.textContent.includes(subject.name));
       if (!cardTitle) return;
       const card = cardTitle.closest('.eds-c-tile');
       if (!card) return;
       
       const header = card.querySelector('.eds-c-tile__header');
       if (!header) return;

       if (header.nextElementSibling && header.nextElementSibling.classList.contains('cx-compound-progress-container')) {
          // Already injected here
          return;
       }

       let totalWeight = 0;
       let overallCompleted = 0;
       const breakdowns = { 
          Exam: { completed: 0, remaining: 0 }, 
          Test: { completed: 0, remaining: 0 }, 
          Application: { completed: 0, remaining: 0 }, 
          Essay: { completed: 0, remaining: 0 }, 
          'Take-Home': { completed: 0, remaining: 0 } 
       };
       
       subject.tasks.forEach(t => {
          if (t.weight === undefined || t.weight === null || isNaN(t.weight)) return;
          totalWeight += t.weight;
          const cat = categorizeTask(t.name);
          
          let isCompleted = false;
          if (t.scoreText && t.scoreText.includes('Out of')) {
             if (!t.scoreText.startsWith('-') && !t.scoreText.startsWith('–')) {
                isCompleted = true;
             }
          }
          
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
             segmentC.style.backgroundColor = categories[cat].color;
             segmentC.title = `${cat} (Completed): ${data.completed.toFixed(1)}%`;
             bar.appendChild(segmentC);
          }
          
          if (data.remaining > 0) {
             const pctRem = (data.remaining / totalWeight) * 100;
             const segmentR = document.createElement('div');
             segmentR.style.width = `${pctRem}%`;
             segmentR.style.backgroundColor = categories[cat].color;
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

    // --- 4. Weakness Analyzer (Radar Charts in Sidebar) ---
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
         <p style="font-size:12px;color:#999;margin-bottom:12px;">Radar charts of your performance by Assessment Type.</p>
         <div id="connext-radar-chart" style="width:100%;height:300px;background:#333333;border-radius:6px;border:1px solid #3a3a3a;"></div>
       `;

       document.body.append(toggleBtn, panel);
       
       if (window.ConnextAtar) {
          window.ConnextAtar.toolButtons = window.ConnextAtar.toolButtons || [];
          window.ConnextAtar.toolButtons.push(toggleBtn);
       }

       toggleBtn.addEventListener('click', () => {
          const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
          document.querySelectorAll('section[id^="connectea-"], section[id^="connext-"]').forEach(p => p.hidden = true);
          document.querySelectorAll('button[aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
          
          if (!expanded) {
            toggleBtn.setAttribute('aria-expanded', 'true');
            panel.hidden = false;
            
            // Render Highcharts
            const chartDiv = document.getElementById('connext-radar-chart');
            if (!window.Highcharts) {
              chartDiv.innerHTML = '<div style="padding:20px;color:red;">Highcharts not loaded by Connect.</div>';
              return;
            }
            
            const perf = { Exam: { earned: 0, total: 0 }, Test: { earned: 0, total: 0 }, Application: { earned: 0, total: 0 }, Essay: { earned: 0, total: 0 }, 'Take-Home': { earned: 0, total: 0 } };
            
            Array.from(document.querySelectorAll('.cvr-c-task')).forEach(row => {
               const titleEl = row.querySelector('.v-label');
               if (!titleEl) return;
               const title = titleEl.textContent;
               const rawMarkText = row.querySelector('.cvr-c-task__marks .cvr-c-task__mark')?.textContent || '';
               const scoreMatch = rawMarkText.match(/^(\d+(?:\.\d+)?)\s*Out\s+of\s+(\d+(?:\.\d+)?)$/i);
               
               let weight = 0;
               const detailsEl = row.querySelector('.cvr-c-task__details');
               if (detailsEl) {
                  const wtText = detailsEl.textContent;
                  const wMatch = wtText.match(/(\d+(?:\.\d+)?)\s*Out\s+of\s+\d+(?:\.\d+)?$/i);
                  if (wMatch) weight = Number(wMatch[1]);
               }

               if (scoreMatch && weight > 0) {
                  const earned = (Number(scoreMatch[1]) / Number(scoreMatch[2])) * weight;
                  const cat = categorizeTask(title);
                  perf[cat].earned += earned;
                  perf[cat].total += weight;
               }
            });

            const labels = [];
            const data = [];
            for (const [cat, stats] of Object.entries(perf)) {
               labels.push(cat);
               data.push(stats.total > 0 ? Math.round((stats.earned / stats.total) * 100) : 0);
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
          }
       });
    }
  }

  setInterval(syncFeatures, 1500);
})();

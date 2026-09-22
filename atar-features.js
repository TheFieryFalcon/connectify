/**
 * Connext ATAR Features
 * Implements Compound Progress Bars, WACE Countdown, and Weakness Analyzer.
 */
(() => {
  'use strict';

  setTimeout(() => {
    if (!window.ConnextData) return;

    // --- 1. WACE Exam Countdown ---
    const yearLevel = Array.from(document.querySelectorAll('.eds-c-tile__title')).some(el => /\b(?:12|Twelve)\b/i.test(el.textContent)) ? 12 : 11;
    
    if (yearLevel === 12) {
      const countdown = document.createElement('div');
      countdown.className = 'connectea-panel';
      countdown.style.textAlign = 'center';
      countdown.style.fontWeight = 'bold';
      countdown.style.fontSize = '14px';
      countdown.style.margin = '16px auto';
      countdown.style.maxWidth = '600px';
      countdown.style.background = '#2b2b2b';
      countdown.style.color = '#d4b483';
      countdown.style.border = '1px solid #d4b483';
      
      const now = new Date();
      // Approximate WACE start date: October 28th
      const examDate = new Date(now.getFullYear(), 9, 28); 
      if (now > examDate && now.getMonth() > 10) examDate.setFullYear(now.getFullYear() + 1);
      
      const days = Math.ceil((examDate - now) / (1000 * 60 * 60 * 24));
      
      if (days >= 0 && days <= 300) {
        countdown.innerHTML = `⏳ <span>${days} days until WACE Exams</span>`;
        const mainContent = document.getElementById('main-content') || document.body;
        mainContent.prepend(countdown);
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
       const lower = taskName.toLowerCase();
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
       
       let totalWeight = 0;
       const breakdowns = { Exam: 0, Test: 0, Application: 0, Essay: 0, 'Take-Home': 0 };
       
       subject.tasks.forEach(t => {
          if (t.weight === undefined || t.weight === null || isNaN(t.weight)) return;
          totalWeight += t.weight;
          const cat = categorizeTask(t.name);
          breakdowns[cat] += t.weight;
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

       for (const [cat, weight] of Object.entries(breakdowns)) {
          if (weight <= 0) continue;
          const pct = (weight / totalWeight) * 100;
          const segment = document.createElement('div');
          segment.style.width = `${pct}%`;
          segment.style.backgroundColor = categories[cat].color;
          segment.title = `${cat}: ${weight.toFixed(1)}%`;
          bar.appendChild(segment);
          tooltipParts.push(`${cat} ${Math.round(pct)}%`);
       }

       const label = document.createElement('div');
       label.style.fontSize = '10px';
       label.style.color = '#999';
       label.style.textAlign = 'right';
       label.textContent = tooltipParts.join(' • ');

       const container = document.createElement('div');
       container.style.padding = '0 16px';
       container.appendChild(bar);
       container.appendChild(label);

       const header = card.querySelector('.eds-c-tile__header');
       if (header) header.after(container);
    });

    // --- 4. Weakness Analyzer (Radar Charts in Sidebar) ---
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = 'Weakness Analyzer';
    toggleBtn.type = 'button';
    
    const panel = document.createElement('section');
    panel.id = 'connext-weakness';
    panel.hidden = true;
    panel.className = 'cx-workspace-panel';
    panel.innerHTML = `
      <header><strong>Weakness Analyzer</strong></header>
      <p style="font-size:12px;color:#999;margin-bottom:12px;">Radar charts of your performance by Assessment Type.</p>
      <div id="connext-radar-chart" style="width:100%;height:300px;background:#2b2b2b;border-radius:6px;border:1px solid #3a3a3a;"></div>
    `;

    document.body.append(toggleBtn, panel);
    
    if (window.ConnextAtar) {
       window.ConnextAtar.toolButtons = window.ConnextAtar.toolButtons || [];
       window.ConnextAtar.toolButtons.push(toggleBtn);
    } else {
       window.ConnextAtar = { toolButtons: [toggleBtn] };
    }

    toggleBtn.addEventListener('click', () => {
       const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
       // Close others
       document.querySelectorAll('section[id^="connectea-"], section[id^="connext-"]').forEach(p => p.hidden = true);
       document.querySelectorAll('button[aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
       
       if (!expanded) {
         toggleBtn.setAttribute('aria-expanded', 'true');
         panel.hidden = false;
         renderRadarChart();
       }
    });

    function renderRadarChart() {
       const chartDiv = document.getElementById('connext-radar-chart');
       if (!window.Highcharts) {
         chartDiv.innerHTML = '<div style="padding:20px;color:red;">Highcharts not loaded by Connect.</div>';
         return;
       }
       
       const perf = { Exam: { earned: 0, total: 0 }, Test: { earned: 0, total: 0 }, Application: { earned: 0, total: 0 }, Essay: { earned: 0, total: 0 }, 'Take-Home': { earned: 0, total: 0 } };
       
       // Scrape raw scores
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
          xAxis: {
             categories: labels,
             tickmarkPlacement: 'on',
             lineWidth: 0,
             labels: { style: { color: '#cccccc' } }
          },
          yAxis: {
             gridLineInterpolation: 'polygon',
             lineWidth: 0,
             min: 0,
             max: 100,
             labels: { style: { color: '#999' } }
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
             color: '#d4b483'
          }],
          credits: { enabled: false }
       });
    }

  }, 1500);
})();

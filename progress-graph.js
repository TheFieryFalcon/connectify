/**
 * Connectify Progress Graph & ATAR Progression
 *
 * Renders SVG progress charts for individual subject assessments (showing student marks
 * vs cohort means) and an estimated ATAR Progression timeline across school weeks / rounds.
 * Dynamically scales the Y-axis based on the student's second lowest estimated ATAR.
 */
(() => {
  'use strict';

  const dataAPI = window.ConnectifyData;

  const createElement = (tag, text) => {
    const el = document.createElement(tag);
    if (text instanceof Node) el.append(text);
    else if (text !== undefined && text !== null) el.textContent = text;
    return el;
  };

  const createSvgElement = (tag, attrs, text) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, val] of Object.entries(attrs || {})) {
      el.setAttribute(key, val);
    }
    if (text) el.textContent = text;
    return el;
  };

  
  function formatTimestamp(order, fallbackCaption) {
    if (!Number.isFinite(order)) return fallbackCaption || 'Unknown';
    const term = Math.floor((order - 1) / 12) + 1;
    const week = Math.floor((order - 1) % 12) + 1;
    return `Term ${term}, Week ${week}`;
  }

  const getMonthName = (week) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIndex = 1 + Math.floor((week - 1) / 4.3);
      return months[Math.max(0, Math.min(11, monthIndex))];
  };

  // UI elements
  const toggleBtn = createElement('button', 'Progress Graph');
  toggleBtn.id = 'connectify-progress-toggle';
  toggleBtn.type = 'button';
  toggleBtn.setAttribute('aria-expanded', 'false');

  const panel = createElement('section');
  panel.id = 'connectify-progress';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Assessment progress');

  const head = createElement('header');
  const title = createElement('strong', 'Progress Graph');
  title.tabIndex = -1;
  head.append(title);

  const choicesContainer = createElement('div');
  choicesContainer.className = 'cx-subjects';

  const chartContainer = createElement('div');

  const scanBtn = createElement('button', 'Refresh assessments');
  scanBtn.type = 'button';

  panel.append(head, choicesContainer, scanBtn, chartContainer);
  document.body.append(toggleBtn, panel);

  let selectedSubject = '';
  let lastDataSignature = '';

  /**
   * Reconstruct historical running ATAR points at each assessment chronological step.
   *
   * @param {Array<Object>} subjects - Array of subject outline data from ConnectifyData
   * @returns {{points?: Array<Object>, byAssessment?: boolean, error?: string}}
   */
  function history(subjects) {
    // Exam component rows worth 0% are already represented by the weighted full exam
    const eligible = subjects
      .filter(s => /\bATAR\b/i.test(s.name) && !/\bGeneral\b/i.test(s.name))
      .map(s => ({
        ...s,
        tasks: s.tasks.filter(t => t.weight !== 0)
      }));

    const invalid = eligible.flatMap(s =>
      s.tasks.filter(t => !Number.isFinite(t.weight) || t.weight < 0).map(t => `${s.name}: ${t.name}`)
    );

    if (invalid.length) {
      return {
        error: `Assessment weights are unavailable for: ${invalid.join('; ')}. Expand all outlines and refresh.`
      };
    }

    const byAssessment = eligible.some(s => s.tasks.some(t => !Number.isFinite(t.order)));

    const ordered = eligible.map(s => ({
      ...s,
      tasks: byAssessment
        ? [...s.tasks].sort((a, b) => a.sequence - b.sequence).map((t, i) => ({ ...t, order: i + 1 }))
        : s.tasks
    }));

    const steps = [...new Set(ordered.flatMap(s => s.tasks.map(t => t.order)))].sort((a, b) => a - b);
    const points = [];

    for (const step of steps) {
      const rows = ordered.map(s => {
        const completedTasks = s.tasks.filter(t => t.order <= step);
        const totalWeight = completedTasks.reduce((acc, t) => acc + t.weight, 0);

        return {
          name: s.name.replace(/\bATAR\b|\bYear\s*\d+\b/gi, '').trim(),
          include: totalWeight > 0,
          score: (() => {
            if (!totalWeight) return undefined;
            const rawAvg = completedTasks.reduce((acc, t) => acc + t.score * t.weight, 0) / totalWeight;
            
            const prefsStr = localStorage.getItem('connectea:preferences');
            const savedPrefs = prefsStr ? JSON.parse(prefsStr) : {};
            const calibration = savedPrefs[`sem1_calibration:${s.id}`] || {};
            
            if (window.ConnectifyMath && window.ConnectifyMath.calculateShiftedScaledScore) {
               return window.ConnectifyMath.calculateShiftedScaledScore(s.name, rawAvg, calibration.raw, calibration.scaled, 2025);
            }
            return rawAvg;
          })()
        };
      });

      const calculation = window.ConnectifyAtar.calculate(rows);
      if (!calculation.error) {
        points.push({
          name: byAssessment ? `Assessment round ${step}` : getMonthName(step),
          caption: '',
          score: calculation.atar === '<30' ? null : Number(calculation.atar),
          display: calculation.atar,
          order: step
        });
      }
    }

    return { points, byAssessment };
  }

  function refresh() {
    if (panel.hidden) return;
    const data = dataAPI.collect();
    const sig = JSON.stringify(data);
    if (sig === lastDataSignature) return;
    lastDataSignature = sig;
    render(data);
  }

  /**
   * Main render function for the progress graph panel.
   */
  function render(data) {
    choicesContainer.replaceChildren();
    chartContainer.replaceChildren();

    const isHistory = selectedSubject === '__atar';
    const current = data.find(s => s.name === selectedSubject) || data[0];

    // Build subject selector buttons
    for (const subject of data) {
      const displayName = subject.name.replace(/\bATAR\b|\bYear\s*\d+\b/gi, '').trim();
      const btn = createElement('button', displayName);
      btn.type = 'button';
      btn.setAttribute('aria-pressed', String(!isHistory && subject === current));
      btn.onclick = () => {
        selectedSubject = subject.name;
        render(data);
      };
      choicesContainer.append(btn);
    }

    // Add ATAR Progression option if Year 11 or Year 12 is present
    const hasSeniorYears = /\bYear\s*(11|12)\b/i.test(data.map(s => s.name).join(' '));
    if (hasSeniorYears) {
      const btn = createElement('button', 'ATAR Progression');
      btn.type = 'button';
      btn.setAttribute('aria-pressed', String(isHistory));
      btn.onclick = () => {
        selectedSubject = '__atar';
        render(data);
      };
      choicesContainer.append(btn);
    }

    if (!current) {
      chartContainer.append(createElement('p', 'No assessments found. Expand all subjects and refresh.'));
      return;
    }

    let points;
    let byAssessment = false;

    if (isHistory) {
      const result = history(data);
      chartContainer.append(createElement('h3', 'ATAR Progression'));

      if (result.error) {
        chartContainer.append(createElement('p', result.error));
        return;
      }

      points = result.points;
      byAssessment = result.byAssessment;

      if (!byAssessment) {
        const monthGroups = new Map();
        
        points.forEach(p => {
          if (p.score === null) return;
          const monthIndex = 1 + Math.floor((p.order - 1) / 4.3);
          const mIdx = Math.max(0, Math.min(11, monthIndex));
          
          if (!monthGroups.has(mIdx)) {
            monthGroups.set(mIdx, {
              name: p.name,
              caption: '',
              sum: 0,
              count: 0,
              orderSum: 0
            });
          }
          const group = monthGroups.get(mIdx);
          group.sum += p.score;
          group.count++;
          group.orderSum += p.order;
        });

        const averagedPoints = [];
        const sortedMonths = Array.from(monthGroups.keys()).sort((a, b) => a - b);
        for (const mIdx of sortedMonths) {
          const group = monthGroups.get(mIdx);
          const avgScore = group.sum / group.count;
          averagedPoints.push({
            name: group.name,
            caption: 'Monthly Average',
            score: avgScore,
            display: avgScore.toFixed(2),
            order: group.orderSum / group.count
          });
        }
        
        if (averagedPoints.length > 0) {
            points = averagedPoints;
        }
      }

      chartContainer.append(
        createElement(
          'p',
          'Estimated from weighted running school averages using the 2025 model. Begins once four subjects have results.'
        )
      );

      if (byAssessment) {
        chartContainer.append(
          createElement(
            'p',
            'Some assessments have chapter labels or no readable date. Each assessment round uses the first N completed weighted assessments in each subject’s outline order (or all available if fewer). These rounds are not calendar dates.'
          )
        );
      }
    } else {
      selectedSubject = current.name;
      points = current.tasks;
      chartContainer.append(createElement('h3', current.name));

      const legend = createElement('div');
      legend.className = 'cx-legend';

      const redKey = createElement('span', 'Red line -> Average Cohort performance');
      redKey.className = 'cx-red-key';
      const blueKey = createElement('span', 'Blue line -> Your performance');
      blueKey.className = 'cx-blue-key';

      legend.append(redKey, blueKey);
      chartContainer.append(legend);
    }

    if (!points.length) {
      chartContainer.append(
        createElement(
          'p',
          isHistory
            ? 'Not enough completed results yet to estimate ATAR progression.'
            : 'No completed assessments found. Expand all subjects and refresh.'
        )
      );
      return;
    }

    // Determine Y-axis bounds: scale dynamically for ATAR progression based on second lowest ATAR
    let minY = 0;
    const maxY = 100;

    if (isHistory) {
      const validScores = points.map(p => p.score).filter(Number.isFinite);
      if (validScores.length) {
        const sorted = [...validScores].sort((a, b) => a - b);
        const secondLowest = sorted.length > 1 ? sorted[1] : sorted[0];
        minY = Math.max(0, Math.floor(secondLowest) - 1);
        if (minY >= maxY) minY = maxY - 1;
      }
    }

    const range = maxY - minY;
    const gridStep = !isHistory || range === 100 ? 25 : range > 30 && range % 10 === 0 ? 10 : (range <= 10 ? 1 : 5);
    const yFor = val => 260 - ((val - minY) / range) * 220;

    const svg = createSvgElement('svg', {
      viewBox: '0 0 680 310',
      role: 'img',
      'aria-label': isHistory
        ? byAssessment
          ? 'Estimated ATAR progression by assessment round'
          : 'Estimated ATAR progression over months'
        : `${current.name}: your assessment scores and estimated cohort means`
    });

    // Render horizontal grid lines and Y-axis value labels
    for (let val = minY; val <= maxY; val += gridStep) {
      const py = yFor(val);
      svg.append(
        createSvgElement('line', {
          x1: 44,
          y1: py,
          x2: 655,
          y2: py,
          class: 'cx-grid'
        }),
        createSvgElement(
          'text',
          {
            x: 36,
            y: py + 4,
            'text-anchor': 'end'
          },
          val + (isHistory ? '' : '%')
        )
      );
    }

    const firstOrder = points[0].order;
    const lastOrder = points.at(-1).order;

    const xFor = index =>
      points.length === 1
        ? 350
        : isHistory && lastOrder > firstOrder
        ? 52 + ((points[index].order - firstOrder) * 595) / (lastOrder - firstOrder)
        : 52 + (index * 595) / (points.length - 1);

    /**
     * Plots a polyline series and interactive point markers.
     */
    function renderSeries(key, className) {
      let segment = [];

      const flushSegment = () => {
        if (segment.length) {
          svg.append(
            createSvgElement('polyline', {
              points: segment.join(' '),
              fill: 'none',
              class: className
            })
          );
        }
        segment = [];
      };

      points.forEach((point, idx) => {
        if (!Number.isFinite(point[key])) {
          flushSegment();
          return;
        }

        const cx = xFor(idx);
        const cy = Math.max(40, Math.min(260, yFor(point[key])));
        segment.push(`${cx},${cy}`);

        const circle = createSvgElement('circle', {
          cx,
          cy,
          r: 4.5,
          tabindex: 0,
          class: `${className}-point`
        });

        const labelType = key === 'mean' ? 'Cohort mean' : isHistory ? 'Estimated ATAR' : 'Your score';
        const formattedValue = Number(point[key].toFixed(2)) + (isHistory ? '' : '%');

        circle.append(createSvgElement('title', {}, `${point.name}: ${labelType} ${formattedValue}`));
        svg.append(circle);
      });

      flushSegment();
    }

    if (!isHistory) {
      renderSeries('mean', 'cx-cohort');
    }
    renderSeries('score', 'cx-line');

    const getMonthName = (week) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIndex = 1 + Math.floor((week - 1) / 4.3);
      return months[Math.max(0, Math.min(11, monthIndex))];
    };

    // X-axis tick labels
    if (isHistory && !byAssessment) {
      // Draw evenly spaced months independent of data points
      const getMonthIndex = (week) => Math.max(0, Math.min(11, Math.floor((week - 1) / 4.3)));
      const startMonth = getMonthIndex(firstOrder);
      const endMonth = getMonthIndex(lastOrder);
      
      for (let m = startMonth; m <= endMonth; m++) {
        const monthStartWeek = 1 + m * 4.3;
        const cx = lastOrder > firstOrder 
          ? 52 + ((monthStartWeek - firstOrder) * 595) / (lastOrder - firstOrder)
          : 350;
          
        if (cx >= 40 && cx <= 660) {
          svg.append(
            createSvgElement('text', { x: cx, y: 283, 'text-anchor': 'middle' }, getMonthName(monthStartWeek))
          );
        }
      }
    } else {
      points.forEach((point, idx) => {
        if (points.length <= 18 || idx % Math.ceil(points.length / 14) === 0) {
          svg.append(
            createSvgElement('text', { x: xFor(idx), y: 283, 'text-anchor': 'middle' }, 
              isHistory ? Number(point.order.toFixed(1)) : String(idx + 1)
            )
          );
        }
      });
    }

    // X-axis caption
    svg.append(
      createSvgElement(
        'text',
        {
          x: 350,
          y: 306,
          'text-anchor': 'middle'
        },
        isHistory ? (byAssessment ? 'Assessment round' : 'Month') : 'Assessment'
      )
    );

    chartContainer.append(svg);

    if (!isHistory && points.some(p => p.mean === null)) {
      chartContainer.append(
        createElement('p', 'Gaps in the red line mean cohort statistics are not available for that task.')
      );
    }

    // Detail table of plotted points
    const table = createElement('table');
    const headerRow = createElement('tr');
    const headers = isHistory
      ? ['When', 'Estimated ATAR']
      : ['#', 'Assessment', 'When', 'Your score', 'Cohort mean'];

    headers.forEach(h => headerRow.append(createElement('th', h)));
    table.append(headerRow);

    points.forEach((point, idx) => {
      const row = createElement('tr');
      let whenCell;
      if (isHistory) {
        whenCell = point.name;
      } else if (Number.isFinite(point.order)) {
        whenCell = formatTimestamp(point.order, point.caption);
      } else {
        const wrapper = createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.gap = '4px';
        const msg = createElement('small', 'No time detected, please input a time yourself');
        msg.style.color = '#d32f2f';
        const input = createElement('input');
        input.type = 'number';
        input.placeholder = 'e.g. 17 for T2 Wk7';
        input.style.width = '140px';
        
        const customKey = `connectea:time_override:${selectedSubject}:${point.name}`;
        const savedTime = localStorage.getItem(customKey);
        if (savedTime !== null) {
           input.value = savedTime;
        }
        
        input.addEventListener('input', () => {
           if (input.value) localStorage.setItem(customKey, input.value);
           else localStorage.removeItem(customKey);
           
           // Reload graph with new data
           clearTimeout(window._cxTimeRefresh);
           window._cxTimeRefresh = setTimeout(() => {
               // Must clear cached data to recalculate everything
               lastDataSignature = '';
               refresh();
           }, 800);
        });
        
        wrapper.append(msg, input);
        whenCell = wrapper;
      }

      const cells = isHistory
        ? [point.name, point.display]
        : [
            String(idx + 1),
            point.name,
            whenCell,
            `${Number(point.score.toFixed(2))}%`,
            Number.isFinite(point.mean) ? `${Number(point.mean.toFixed(2))}%` : 'Unavailable'
          ];

      cells.forEach(c => row.append(createElement('td', c)));
      table.append(row);
    });

    chartContainer.append(table);
  }

  function expandAndRefresh() {
    dataAPI.expandAll();
    lastDataSignature = '';
    refresh();
  }

  // Toggle button interactions
  toggleBtn.onclick = () => {
    panel.hidden = !panel.hidden;
    toggleBtn.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) {
      window.dispatchEvent(new CustomEvent('connectify-open', { detail: 'progress' }));
      expandAndRefresh();
      title.focus();
    }
  };

  panel.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      panel.hidden = true;
      toggleBtn.setAttribute('aria-expanded', 'false');
      toggleBtn.focus();
    }
  });

  scanBtn.onclick = expandAndRefresh;

  window.addEventListener('connectify-open', e => {
    if (e.detail !== 'progress') {
      panel.hidden = true;
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
  });

  /**
   * Attaches visual improvement indicators (↑) to task rows where the latest
   * score exceeds the student's current overall running average.
   */
  function updateImprovementArrows() {
    const activeTasks = new Set();
    const courses = window.ConnectifyAtar.readCourses(false);

    for (const subject of dataAPI.collect()) {
      const latestTask = subject.tasks.at(-1);
      if (!latestTask?.row) continue;

      const subjectName = subject.name.replace(/\bATAR\b|\bYear\s*\d+\b/gi, '').trim();
      const currentCourse =
        courses[1].find(r => r.name === subjectName) || courses[0].find(r => r.name === subjectName);

      if (!Number.isFinite(currentCourse?.mark) || latestTask.score <= currentCourse.mark) continue;

      const row = latestTask.row;
      const statsPanel = row.querySelector('.connectea-panel');
      if (!statsPanel) continue;

      activeTasks.add(row);

      if (!row.querySelector('.cx-improved')) {
        const badge = createElement('span', '↑');
        badge.className = 'cx-improved';
        badge.title = 'Latest assessment is above your current overall subject average';
        badge.setAttribute('aria-label', badge.title);

        const group = createElement('div');
        group.className = 'cx-performance-row';
        statsPanel.before(group);
        group.append(statsPanel, badge);
      }
    }

    // Clean up outdated badges
    for (const group of document.querySelectorAll('.cx-performance-row')) {
      if (!activeTasks.has(group.closest('.cvr-c-task')) || !group.querySelector('.connectea-panel')) {
        group.querySelector('.cx-improved')?.remove();
        group.replaceWith(...group.childNodes);
      }
    }
  }

  window.ConnectifyProgress = { history };

  setInterval(() => {
    refresh();
    updateImprovementArrows();
  }, 1500);

  updateImprovementArrows();
})();

/**
 * Connectify Progress Graph & ATAR Progression
 *
 * Coordinates UI panel, subject toggle chips, scan button, and improvement arrows.
 * Delegates mathematical modeling to ConnectifyProgressMath and SVG chart rendering to ConnectifyProgressChart.
 */
(() => {
  'use strict';

  try {
    if (window.__connectifyProgressInitialized || document.getElementById('connectify-progress-toggle')) return;
    window.__connectifyProgressInitialized = true;

    if (!Element.prototype.replaceChildren) {
      Element.prototype.replaceChildren = function(...nodes) {
        while (this.firstChild) this.removeChild(this.firstChild);
        this.append(...nodes);
      };
    }

    const dataAPI = window.ConnectifyData;
    const mathAPI = window.ConnectifyProgressMath;
    const chartAPI = window.ConnectifyProgressChart;

    const createElement = (tag, text, className) => {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (text instanceof Node) el.append(text);
      else if (text !== undefined && text !== null) el.textContent = text;
      return el;
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

    const choicesContainer = createElement('div', null, 'cx-subjects');
    const chartContainer = createElement('div');

    const scanBtn = createElement('button', 'Refresh Assessments');
    scanBtn.type = 'button';

    panel.append(head, choicesContainer, scanBtn, chartContainer);
    document.body.append(toggleBtn, panel);

    let selectedSubject = '';
    let lastDataSignature = '';

    function refresh() {
      if (panel.hidden) return;
      const data = dataAPI ? dataAPI.collect() : [];
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
        chartContainer.append(createElement('p', 'No assessments found. Expand subjects in Connect to load data.'));
        return;
      }

      let points;
      let byAssessment = false;
      let titleSubject = current.name;

      if (isHistory) {
        const result = (mathAPI?.history || window.ConnectifyProgressMath?.history)(data);
        chartContainer.append(createElement('h3', 'ATAR Progression'));

        if (result.error) {
          chartContainer.append(createElement('p', result.error));
          return;
        }

        points = result.points;
        byAssessment = result.byAssessment;

        if (!byAssessment && mathAPI?.aggregateMonthlyPoints) {
          points = mathAPI.aggregateMonthlyPoints(points);
        }

        chartContainer.append(
          createElement(
            'p',
            'Estimated from running school marks using 2025 TISC scaling. Requires at least four graded subjects.'
          )
        );

        if (byAssessment) {
          chartContainer.append(
            createElement(
              'p',
              'Sequential assessment rounds are displayed when calendar dates are unavailable. These reflect syllabus outline order rather than calendar dates.'
            )
          );
        }
      } else {
        selectedSubject = current.name;
        titleSubject = current.name;
        points = current.tasks;
        chartContainer.append(createElement('h3', current.name));
      }

      const chartRenderer = chartAPI?.renderChart || window.ConnectifyProgressChart?.renderChart;
      if (chartRenderer) {
        const chartWrapper = createElement('div');
        chartContainer.append(chartWrapper);
        chartRenderer(chartWrapper, {
          points,
          isHistory,
          byAssessment,
          subjectName: titleSubject,
          onRefresh: () => {
            lastDataSignature = '';
            refresh();
          }
        });
      }
    }

    function expandAndRefresh() {
      if (dataAPI?.expandAll) dataAPI.expandAll();
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
      const readCoursesFn = window.ConnectifyAtarScraper?.readCourses || window.ConnectifyAtar?.readCourses;
      const courses = readCoursesFn ? readCoursesFn(false) : [[], []];
      if (!courses || !courses[0] || !courses[1]) return;

      const collectFn = dataAPI?.collect || window.ConnectifyData?.collect;
      if (!collectFn) return;
      for (const subject of collectFn()) {
        const latestTask = subject.tasks?.length ? subject.tasks[subject.tasks.length - 1] : null;
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
          const badge = createElement('span', '↑', 'cx-improved');
          badge.title = 'Latest assessment is above your current overall subject average';
          badge.setAttribute('aria-label', badge.title);

          const group = createElement('div', null, 'cx-performance-row');
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

    window.ConnectifyProgress = {
      history: (...args) => (mathAPI?.history || window.ConnectifyProgressMath?.history)(...args)
    };

    setInterval(() => {
      refresh();
      updateImprovementArrows();
    }, 1500);

    updateImprovementArrows();
  } catch (err) {
    console.error('Connectify error in progress-graph.js:', err);
  }
})();

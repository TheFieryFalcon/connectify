/**
 * Connectify Progress Chart
 *
 * SVG chart rendering, polyline series generation, axes, tooltips, legend, and the data detail
 * table (week override cells: progress-week-editor.js). Exposes window.ConnectifyProgressChart.
 */
(() => {
  'use strict';

  if (window.ConnectifyProgressChart) return;

  const createElement = (tag, text, className) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if ((typeof Node !== 'undefined' && text instanceof Node) || (text && typeof text === 'object' && (text.tagName || text.nodeType))) el.append(text);
    else if (text !== undefined && text !== null) el.textContent = text;
    return el;
  };

  const createSvgElement = (tag, attrs, text) => {
    const el = typeof document.createElementNS === 'function'
      ? document.createElementNS('http://www.w3.org/2000/svg', tag)
      : document.createElement(tag);
    for (const [key, val] of Object.entries(attrs || {})) {
      el.setAttribute(key, val);
    }
    if (text) el.textContent = text;
    return el;
  };

  /**
   * Renders the complete progress SVG chart and data table into container.
   *
   * @param {HTMLElement} container
   * @param {Object} options
   * @param {Array<Object>} options.points
   * @param {boolean} options.isHistory
   * @param {boolean} options.byAssessment
   * @param {string} [options.mode] - ConnectifyProgressModes id; average modes rename the series
   * @param {string} options.subjectName
   * @param {Function} [options.onRefresh]
   */
  function renderChart(container, options) {
    const { points, isHistory, byAssessment, subjectName, onRefresh, mode } = options;
    const math = window.ConnectifyProgressMath;
    const modeInfo = window.ConnectifyProgressModes?.find(mode);
    const scoreLabel = modeInfo?.score || 'Your score';
    const meanLabel = modeInfo?.mean || 'Cohort mean';

    container.replaceChildren();

    if (!points || !points.length) {
      container.append(
        createElement(
          'p',
          isHistory
            ? 'Not enough completed results yet to estimate ATAR progression.'
            : 'No completed assessments found. Expand all subjects and refresh.'
        )
      );
      return;
    }

    if (!isHistory) {
      const legend = createElement('div', null, 'cx-legend');
      const redKey = createElement('span', modeInfo?.mean ? `Red: ${meanLabel}` : 'Red: Cohort Mean', 'cx-red-key');
      const blueKey = createElement('span', modeInfo?.score ? `Blue: ${scoreLabel}` : 'Blue: Student Score', 'cx-blue-key');
      legend.append(redKey, blueKey);
      container.append(legend);
    }

    const { minY, maxY, gridStep, yFor } = math.computeYBounds(points, isHistory);

    const svg = createSvgElement('svg', {
      viewBox: '0 0 680 310',
      role: 'img',
      'aria-label': isHistory
        ? byAssessment
          ? 'Estimated ATAR progression by assessment round'
          : 'Estimated ATAR progression over months'
        : modeInfo?.score
        ? `${subjectName}: ${scoreLabel.toLowerCase()} and ${meanLabel.toLowerCase()}`
        : `${subjectName}: your assessment scores and estimated cohort means`
    });

    // Render horizontal grid lines and Y-axis value labels
    for (let val = minY; val <= maxY; val += gridStep) {
      const py = yFor(val);
      svg.append(
        createSvgElement('line', { x1: 44, y1: py, x2: 655, y2: py, class: 'cx-grid' }),
        createSvgElement('text', { x: 36, y: py + 4, 'text-anchor': 'end' }, val + (isHistory ? '' : '%'))
      );
    }

    const firstOrder = points[0].order;
    const lastOrder = points.length ? points[points.length - 1].order : 0;

    const xForOrder = order => 52 + ((order - firstOrder) * 595) / (lastOrder - firstOrder);
    const xFor = index =>
      points.length === 1
        ? 350
        : isHistory && lastOrder > firstOrder
        ? xForOrder(points[index].order)
        : 52 + (index * 595) / (points.length - 1);

    // Dashed Semester 1 | Semester 2 line (progress-semester-divider.js), under the series
    window.ConnectifyProgressSemesterDivider?.render(svg, {
      points, xFor, createSvgElement,
      xForOrder: isHistory && !byAssessment && lastOrder > firstOrder ? xForOrder : null,
      semesterOf: isHistory ? p => p.semester ?? null : undefined
    });

    // Dashed goal line (progress-goal-line.js), under the series too
    window.ConnectifyProgressGoalLine?.render(svg, { points, xFor, yFor, minY, maxY, subjectName, isHistory, createSvgElement });

    /**
     * Plots a polyline series and interactive point markers.
     */
    function renderSeries(key, className) {
      let segment = [];

      const flushSegment = () => {
        if (segment.length) svg.append(createSvgElement('polyline', { points: segment.join(' '), fill: 'none', class: className }));
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

        const circle = createSvgElement('circle', { cx, cy, r: 4.5, tabindex: 0, class: `${className}-point` });

        const labelType = key === 'mean' ? meanLabel : isHistory ? 'Estimated ATAR' : scoreLabel;
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

    // X-axis tick labels
    if (isHistory && !byAssessment) {
      const getMonthIndex = week => Math.max(0, Math.min(11, Math.floor((week - 1) / 4.3)));
      const startMonth = getMonthIndex(firstOrder);
      const endMonth = getMonthIndex(lastOrder);

      for (let m = startMonth; m <= endMonth; m++) {
        const monthStartWeek = 1 + m * 4.3;
        const cx = lastOrder > firstOrder
          ? 52 + ((monthStartWeek - firstOrder) * 595) / (lastOrder - firstOrder)
          : 350;

        if (cx >= 40 && cx <= 660) {
          svg.append(
            createSvgElement('text', { x: cx, y: 283, 'text-anchor': 'middle' }, math.getMonthName(monthStartWeek))
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
    svg.append(createSvgElement('text', { x: 350, y: 306, 'text-anchor': 'middle' }, isHistory ? (byAssessment ? 'Assessment round' : 'Month') : 'Assessment'));

    container.append(svg);

    if (!isHistory && points.some(p => p.mean === null)) {
      container.append(
        createElement('p', 'Note: Discontinuities in the cohort trend indicate tasks without available cohort statistics.')
      );
    }

    // Detail table of plotted points
    const table = createElement('table');
    const headerRow = createElement('tr');
    const headers = isHistory
      ? ['When', 'Estimated ATAR']
      : ['#', 'Assessment', 'When', scoreLabel, meanLabel];

    headers.forEach(h => headerRow.append(createElement('th', h)));
    table.append(headerRow);

    points.forEach((point, idx) => {
      const row = createElement('tr');
      const isPending = !isHistory && (Boolean(point.pending) || !Number.isFinite(point.score));
      if (isPending) {
        row.className = 'cx-task-pending';
      }

      const whenCell = isHistory ? point.name : window.ConnectifyProgressWeekEditor.weekCell(point, points, subjectName, onRefresh);

      const cells = isHistory
        ? [point.name, point.display]
        : [
            String(idx + 1),
            point.name,
            whenCell,
            Number.isFinite(point.score) ? `${Number(point.score.toFixed(2))}%` : '—',
            Number.isFinite(point.mean) ? `${Number(point.mean.toFixed(2))}%` : 'Unavailable'
          ];

      cells.forEach((c, cIdx) => {
        const td = createElement('td', c);
        if (!isHistory && cIdx === 3 && !Number.isFinite(point.score)) {
          td.title = 'Not yet completed';
        }
        row.append(td);
      });
      table.append(row);
    });

    container.append(table);
  }

  window.ConnectifyProgressChart = {
    createElement,
    createSvgElement,
    renderChart
  };
})();

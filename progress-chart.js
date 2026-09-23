/**
 * Connectify Progress Chart
 *
 * SVG chart rendering, polyline series generation, axes, tooltips, legend,
 * and data detail table with custom week timestamp overrides.
 */
(() => {
  'use strict';

  if (window.ConnectifyProgressChart) return;

  const createElement = (tag, text, className) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
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

  /**
   * Renders the complete progress SVG chart and data table into container.
   *
   * @param {HTMLElement} container
   * @param {Object} options
   * @param {Array<Object>} options.points
   * @param {boolean} options.isHistory
   * @param {boolean} options.byAssessment
   * @param {string} options.subjectName
   * @param {Function} [options.onRefresh]
   */
  function renderChart(container, options) {
    const { points, isHistory, byAssessment, subjectName, onRefresh } = options;
    const math = window.ConnectifyProgressMath;

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
      const redKey = createElement('span', 'Red: Cohort Mean', 'cx-red-key');
      const blueKey = createElement('span', 'Blue: Student Score', 'cx-blue-key');
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
        : `${subjectName}: your assessment scores and estimated cohort means`
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
    const lastOrder = points.length ? points[points.length - 1].order : 0;

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
      : ['#', 'Assessment', 'When', 'Your score', 'Cohort mean'];

    headers.forEach(h => headerRow.append(createElement('th', h)));
    table.append(headerRow);

    points.forEach((point, idx) => {
      const row = createElement('tr');
      let whenCell;
      if (isHistory) {
        whenCell = point.name;
      } else {
        const customKey = `connectea:time_override:${subjectName}:${point.name}`;
        const savedTime = localStorage.getItem(customKey);

        const createInputField = (currentVal, showWarning = false) => {
          const wrapper = createElement('div');
          wrapper.style.display = 'flex';
          wrapper.style.flexDirection = 'column';
          wrapper.style.gap = '4px';

          if (showWarning) {
            const msg = createElement('small', 'No date detected. Enter school week (e.g. 17 for Term 2 Week 7):');
            msg.style.color = '#d32f2f';
            wrapper.append(msg);
          }

          const inputRow = createElement('div');
          inputRow.style.display = 'flex';
          inputRow.style.gap = '4px';
          inputRow.style.alignItems = 'center';

          const input = createElement('input');
          input.type = 'number';
          input.min = '1';
          input.max = '40';
          input.placeholder = 'Week (e.g. 17)';
          input.title = 'Single week number: 1-10 for Term 1, 11-20 for Term 2, 21-30 for Term 3, 31-40 for Term 4';
          input.style.width = '110px';
          if (currentVal) input.value = currentVal;

          input.addEventListener('input', () => {
            const val = input.value.trim();
            if (val) localStorage.setItem(customKey, val);
            else localStorage.removeItem(customKey);

            clearTimeout(window._cxTimeRefresh);
            window._cxTimeRefresh = setTimeout(() => {
              if (typeof onRefresh === 'function') onRefresh();
            }, 600);
          });

          inputRow.append(input);
          if (currentVal) {
            const clearBtn = createElement('button', '✕');
            clearBtn.type = 'button';
            clearBtn.title = 'Clear custom time override';
            clearBtn.style.padding = '0 4px';
            clearBtn.style.cursor = 'pointer';
            clearBtn.onclick = () => {
              localStorage.removeItem(customKey);
              if (typeof onRefresh === 'function') onRefresh();
            };
            inputRow.append(clearBtn);
          }

          wrapper.append(inputRow);
          return wrapper;
        };

        if (Number.isFinite(point.order)) {
          const text = math.formatTimestamp(point.order, point.caption);
          if (savedTime !== null) {
            const containerSpan = createElement('span');
            containerSpan.style.display = 'inline-flex';
            containerSpan.style.alignItems = 'center';
            containerSpan.style.gap = '6px';
            containerSpan.append(createElement('span', text));

            const editBtn = createElement('button', '✏️');
            editBtn.type = 'button';
            editBtn.title = `Custom week ${savedTime} (click to change)`;
            editBtn.style.background = 'none';
            editBtn.style.border = 'none';
            editBtn.style.cursor = 'pointer';
            editBtn.style.fontSize = '12px';
            editBtn.style.padding = '0';
            editBtn.onclick = () => {
              containerSpan.replaceWith(createInputField(savedTime, false));
            };
            containerSpan.append(editBtn);
            whenCell = containerSpan;
          } else {
            whenCell = text;
          }
        } else {
          whenCell = createInputField(savedTime, true);
        }
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

    container.append(table);
  }

  window.ConnectifyProgressChart = {
    createElement,
    createSvgElement,
    renderChart
  };
})();

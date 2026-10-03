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
      const isPending = !isHistory && (Boolean(point.pending) || !Number.isFinite(point.score));
      if (isPending) {
        row.className = 'cx-task-pending';
      }

      let whenCell;
      if (isHistory) {
        whenCell = point.name;
      } else {
        const taskId = point.id;
        const taskName = point.name || '';

        // Check if there are other tasks with the same name in this subject
        const duplicateTasks = points.filter(
          p => (p.name || '').toLowerCase().trim() === taskName.toLowerCase().trim()
        );
        const isDuplicateName = duplicateTasks.length > 1;
        const isFirstOccurrence = !isDuplicateName || (duplicateTasks.length > 0 && duplicateTasks[0] === point);

        // Build specific key using point.id (or sequence if id missing) for duplicate-named tasks
        const disambiguator = taskId || (isDuplicateName && point.sequence !== undefined ? `seq_${point.sequence}` : null);
        const specificKey = disambiguator ? `connectea:time_override:${subjectName}:${disambiguator}` : null;
        const genericKey = `connectea:time_override:${subjectName}:${taskName}`;

        // Retrieve saved custom date:
        // Priority 1: Specific key (exact task instance)
        // Priority 2: Generic key, BUT ONLY for non-duplicates or the first occurrence.
        // This ensures subsequent tasks of the same name (like Row 9 & 10) never inherit the first task's date.
        let savedTime = null;
        if (specificKey) {
          savedTime = localStorage.getItem(specificKey) ||
                      localStorage.getItem(specificKey.replace('connectea:', 'connectify:'));
        }
        if (savedTime === null && isFirstOccurrence && genericKey) {
          savedTime = localStorage.getItem(genericKey) ||
                      localStorage.getItem(genericKey.replace('connectea:', 'connectify:'));
        }

        const createInputField = (currentVal, showWarning = false) => {
          const wrapper = createElement('div');
          wrapper.style.display = 'flex';
          wrapper.style.flexDirection = 'column';
          wrapper.style.gap = '4px';

          if (showWarning) {
            const msg = createElement('small', 'No date detected. Enter school week (e.g. 17 for Term 2 Week 7):', 'cx-date-warning');
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
          const initialVal = currentVal || '';

          const saveValue = (val) => {
            const targetKey = isDuplicateName && specificKey ? specificKey : (specificKey || genericKey);
            if (val) {
              localStorage.setItem(targetKey, val);
            } else {
              if (specificKey) {
                localStorage.removeItem(specificKey);
                localStorage.removeItem(specificKey.replace('connectea:', 'connectify:'));
              }
              if (isFirstOccurrence && genericKey) {
                localStorage.removeItem(genericKey);
                localStorage.removeItem(genericKey.replace('connectea:', 'connectify:'));
              }
            }
          };

          let committed = false;
          const commit = () => {
            if (committed) return;
            committed = true;
            clearTimeout(window._cxTimeRefresh);
            if (typeof onRefresh === 'function') onRefresh();
          };

          input.addEventListener('input', () => {
            const val = input.value.trim();
            saveValue(val);

            // Avoid premature kick-out / auto-refresh while actively focused and typing.
            // Programmatic/headless inputs (document.activeElement !== input) can refresh after debounce.
            clearTimeout(window._cxTimeRefresh);
            if (document.activeElement !== input) {
              window._cxTimeRefresh = setTimeout(() => {
                commit();
              }, 600);
            }
          });

          input.addEventListener('blur', () => {
            commit();
          });

          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (document.activeElement === input && typeof input.blur === 'function') {
                input.blur();
              }
              commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              input.value = initialVal;
              saveValue(initialVal);
              if (document.activeElement === input && typeof input.blur === 'function') {
                input.blur();
              }
              commit();
            }
          });

          inputRow.append(input);
          if (currentVal) {
            const clearBtn = createElement('button', '✕', 'cx-time-clear-btn');
            clearBtn.type = 'button';
            clearBtn.title = 'Clear custom time override';
            clearBtn.style.padding = '0 4px';
            clearBtn.style.cursor = 'pointer';
            clearBtn.onmousedown = (e) => {
              if (e && typeof e.preventDefault === 'function') e.preventDefault();
            };
            clearBtn.onclick = () => {
              committed = true;
              clearTimeout(window._cxTimeRefresh);
              if (specificKey) {
                localStorage.removeItem(specificKey);
                localStorage.removeItem(specificKey.replace('connectea:', 'connectify:'));
              }
              if (isFirstOccurrence && genericKey) {
                localStorage.removeItem(genericKey);
                localStorage.removeItem(genericKey.replace('connectea:', 'connectify:'));
              }
              if (typeof onRefresh === 'function') onRefresh();
            };
            inputRow.append(clearBtn);
          }

          wrapper.append(inputRow);
          return wrapper;
        };

        if (Number.isFinite(point.order)) {
          const text = math.formatTimestamp(point.order, point.caption);
          const containerSpan = createElement('span');
          containerSpan.style.display = 'inline-flex';
          containerSpan.style.alignItems = 'center';
          containerSpan.style.gap = '6px';
          containerSpan.append(createElement('span', text));

          const editBtn = createElement('button', '✏️', savedTime !== null ? 'cx-time-edit-btn' : 'cx-time-edit-btn cx-time-edit-btn--unconfigured');
          editBtn.type = 'button';
          editBtn.setAttribute('aria-label', savedTime !== null ? `Custom week ${savedTime} (click to change)` : 'Edit date (set custom week)');
          editBtn.title = savedTime !== null ? `Custom week ${savedTime} (click to change)` : 'Edit date (set custom week)';
          editBtn.style.background = 'none';
          editBtn.style.border = 'none';
          editBtn.style.cursor = 'pointer';
          editBtn.style.fontSize = '12px';
          editBtn.style.padding = '0';
          editBtn.onclick = () => {
            const inputWrapper = createInputField(savedTime || '', false);
            if (typeof containerSpan.replaceWith === 'function') {
              containerSpan.replaceWith(inputWrapper);
            } else if (containerSpan.parentElement) {
              containerSpan.parentElement.replaceChild(inputWrapper, containerSpan);
            }
            const inputEl = inputWrapper.querySelector('input');
            if (inputEl) {
              if (typeof inputEl.focus === 'function') inputEl.focus();
              if (typeof inputEl.select === 'function') inputEl.select();
            }
          };
          containerSpan.append(editBtn);
          whenCell = containerSpan;
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

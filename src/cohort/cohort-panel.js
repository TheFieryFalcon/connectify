/**
 * Connectify Cohort Panel & Task DOM Builder
 *
 * Handles DOM element creation for statistics panels, type selectors, and cohorts.
 * Exposes window.ConnectifyCohortPanel.
 */
(() => {
  'use strict';

  try {
    const normalize = text => String(text ?? '').replace(/\s+/g, ' ').trim();
    const clearChildren = el => {
      if (!el) return;
      if (typeof el.replaceChildren === 'function') {
        el.replaceChildren();
      } else {
        while (el.firstChild) el.removeChild(el.firstChild);
      }
    };

    const math = () => window.ConnectifyCohortMath || {
      toNumeric: v => (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined),
      formatPercentage: v => (Number.isFinite(v) ? String(Math.round(v * 100) / 100) : 'unavailable'),
      validCohortSize: v => (Number.isSafeInteger(Number(v)) && Number(v) >= 1 ? Number(v) : undefined),
      validStats: s => Array.isArray(s) && s.length === 5 && s.every(Number.isFinite),
      summary: () => null,
      percentile: () => undefined,
      standing: () => '',
      rankString: () => ''
    };

    const types = () => {
      const t = window.ConnectifyTaskTypes;
      if (t && typeof t.getTaskMeta === 'function') return t;
      return {
        getTaskMeta: () => ({ subjectName: '', taskName: '', labels: [], labelsKey: '' }),
        updateTypeSelect: () => {},
        saveTaskTypeOverride: () => {},
        ...(t || {})
      };
    };

    const estimator = () => window.ConnectifyCohortEstimator || {
      loadCohortSize: () => undefined,
      saveCohortSize: () => false
    };

    function readMark(row) {
      const cell = row.querySelector('.cvr-c-task__marks .cvr-c-task__mark') || row.querySelector('.cvr-c-task__mark');
      const text = normalize(cell?.textContent);

      let match = text.match(/^(-?\d+(?:\.\d+)?)\s*%$/);
      if (match) return Number(match[1]);

      match = text.match(/^(-?\d+(?:\.\d+)?)\s*Out\s+of\s+(\d+(?:\.\d+)?)$/i);
      if (match && Number(match[2]) > 0) return (100 * Number(match[1])) / Number(match[2]);

      match = text.match(/(-?\d+(?:\.\d+)?)\s*%/);
      if (match) return Number(match[1]);

      return undefined;
    }

    function readStats(row) {
      const meta = types().getTaskMeta(row);
      const host = row.querySelector('[data-highcharts-chart]') ||
                   row.querySelector('.cvr-c-task__chart [data-highcharts-chart]') ||
                   row.querySelector('.cvr-c-task__chart');

      let foundStats = null;
      let foundN = undefined;

      if (host) {
        if (host.dataset?.connectifyStats) {
          try {
            const stats = JSON.parse(host.dataset.connectifyStats);
            if (math().validStats(stats)) {
              foundStats = stats;
              foundN = host.dataset.connectifyN;
            }
          } catch {}
        }

        if (!foundStats) {
          const hostWithDataset = host.querySelector?.('[data-connectify-stats]') || host.closest?.('[data-connectify-stats]');
          if (hostWithDataset?.dataset?.connectifyStats) {
            try {
              const stats = JSON.parse(hostWithDataset.dataset.connectifyStats);
              if (math().validStats(stats)) {
                foundStats = stats;
                foundN = hostWithDataset.dataset.connectifyN;
              }
            } catch {}
          }
        }

        if (!foundStats) {
          const chartIndex = Number(host.getAttribute('data-highcharts-chart'));
          const chart = window.Highcharts?.charts?.[chartIndex];
          if (chart) {
            for (const series of chart.series || []) {
              const dataPoints = [...(series.points || []), ...(series.options?.data || [])];
              for (const point of dataPoints) {
                const pointData = point?.options || point;
                const stats = Array.isArray(pointData)
                  ? pointData.slice(-5).map(math().toNumeric)
                  : [pointData?.low, pointData?.q1, pointData?.median, pointData?.q3, pointData?.high].map(math().toNumeric);

                if (math().validStats(stats)) {
                  foundStats = stats;
                  break;
                }
              }
              if (foundStats) break;
            }
          }
        }
      }

      if (foundStats) {
        if (meta?.subjectName && meta?.taskName && window.ConnectifyData?.setTaskStats) {
          window.ConnectifyData.setTaskStats(meta.subjectName, meta.taskName, foundStats, foundN);
        }
        return foundStats;
      }

      if (meta?.subjectName && meta?.taskName && window.ConnectifyData?.getTaskStats) {
        const cached = window.ConnectifyData.getTaskStats(meta.subjectName, meta.taskName);
        if (math().validStats(cached)) return cached;
      }

      return null;
    }

    function setText(element, text) {
      if (element.textContent !== text) {
        element.textContent = text;
      }
    }

    function setHTML(element, html) {
      if (element.innerHTML !== html) {
        element.innerHTML = html;
      }
    }

    function createElement(tag, className, textContent) {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (textContent) el.textContent = textContent;
      return el;
    }

    const panels = window.ConnectifyCohortPanels || (window.ConnectifyCohortPanels = new WeakMap());

    function createPanel(row, isOverall, key, estimatedSize, onCohortChange) {
      const box = createElement('section', 'connectea-panel');
      box.setAttribute(
        'aria-label',
        isOverall ? 'Connectify overall subject statistics' : 'Connectify assessment statistics'
      );

      const distribution = createElement('div', 'connectea-distribution');
      const result = createElement('div', 'connectea-result');
      result.setAttribute('aria-live', 'polite');

      const resultRow = createElement('div', 'connectea-result-row');
      resultRow.append(result);
      box.append(distribution, resultRow);

      const isMarked = Number.isFinite(readMark(row));
      if (!isOverall && !isMarked) {
        box.hidden = true;
        box.classList.add('connectea-hidden');
        box.style.setProperty('display', 'none', 'important');
      }

      let wrapper;
      let typeContainer;
      let typeSelect;
      let outcomeBar;

      if (!isOverall) {
        wrapper = createElement('div', 'connectea-row-wrapper');
        typeContainer = createElement('div', 'connectea-type-container');

        const typeLabel = createElement('label', 'connectea-type-label');
        const typeTitle = createElement('span', 'connectea-type-title', 'Type');

        typeSelect = createElement('select', 'connectea-type-select');
        typeSelect.setAttribute('aria-label', 'Assessment type override');

        typeLabel.append(typeTitle, typeSelect);
        typeContainer.append(typeLabel);

        outcomeBar = createElement('div', 'connectea-outcome-bar');
        outcomeBar.hidden = true;
        outcomeBar.style.setProperty('display', 'none', 'important');

        wrapper.append(box, typeContainer, outcomeBar);

        const meta = types().getTaskMeta(row);
        types().updateTypeSelect(typeSelect, meta.subjectName, meta.taskName, meta.labelsKey, meta.labels);

        typeSelect.addEventListener('change', () => {
          const val = typeSelect.value;
          const currentMeta = types().getTaskMeta(row);

          if (val === '__custom__') {
            const custom = prompt('Enter custom assessment type:');
            if (custom && custom.trim()) {
              const cleanCustom = custom.trim();
              if (types().addCustomCategoryForClass) {
                types().addCustomCategoryForClass(currentMeta.subjectName, cleanCustom);
              }
              types().saveTaskTypeOverride(currentMeta.subjectName, currentMeta.taskName, currentMeta.labelsKey, cleanCustom);
              types().updateTypeSelect(typeSelect, currentMeta.subjectName, currentMeta.taskName, currentMeta.labelsKey, currentMeta.labels);
              if (types().rescanAllAutoAssessments) {
                types().rescanAllAutoAssessments();
              }
            } else {
              types().updateTypeSelect(typeSelect, currentMeta.subjectName, currentMeta.taskName, currentMeta.labelsKey, currentMeta.labels);
            }
          } else {
            types().saveTaskTypeOverride(currentMeta.subjectName, currentMeta.taskName, currentMeta.labelsKey, val || undefined);
            types().updateTypeSelect(typeSelect, currentMeta.subjectName, currentMeta.taskName, currentMeta.labelsKey, currentMeta.labels);
          }
        });

        for (const evt of ['click', 'mousedown', 'mouseup', 'keydown']) {
          typeSelect.addEventListener(evt, e => e.stopPropagation());
        }
      } else {
        wrapper = box;
      }

      let input;
      let notice;
      const stateRef = {};

      if (isOverall && key) {
        const label = createElement('label', 'connectea-controls', 'Cohort Size ');
        input = createElement('input', 'connectea-subject-cohort-input');
        input.type = 'number';
        input.min = '1';
        input.step = '1';
        input.placeholder = estimatedSize !== undefined ? `~${estimatedSize}` : 'e.g. 120';
        input.setAttribute('aria-label', 'Students in this subject');
        const saved = estimator().loadCohortSize(key);
        input.value = saved !== undefined ? String(saved) : '';
        label.append(input);

        const warningText = estimatedSize < 50 ? ' (Estimates under 50 students have reduced precision)' : '';
        notice = createElement(
          'span',
          'connectea-notice',
          saved !== undefined
            ? `Original Estimate ~${estimatedSize}${warningText} • Saved.`
            : warningText ? warningText.trim() : 'Enter custom size to override.'
        );
        notice.setAttribute('aria-live', 'polite');

        const controls = createElement('div', 'connectea-subject-controls');
        controls.append(label, notice);
        box.append(controls);

        input.addEventListener('input', () => {
          const size = math().validCohortSize(input.value);
          const isInvalid = (input.value !== '' && !size) || input.validity.badInput;
          input.setAttribute('aria-invalid', String(Boolean(isInvalid)));

          const currentEstimate = stateRef.state ? stateRef.state.estimatedSize : estimatedSize;
          const currentWarning = currentEstimate < 50 ? ' (Estimates under 50 students have reduced precision)' : '';

          const persisted = estimator().saveCohortSize(key, size);
          setText(
            notice,
            isInvalid
              ? 'Enter a whole number of students, at least 1.'
              : size !== undefined
              ? `Original Estimate ~${currentEstimate}${currentWarning} • ${persisted ? 'Saved.' : 'Browser storage unavailable.'}`
              : currentWarning ? currentWarning.trim() : 'Enter custom size to override.'
          );
          if (typeof onCohortChange === 'function') onCohortChange();
        });

        for (const event of ['click', 'keydown']) {
          input.addEventListener(event, e => e.stopPropagation());
        }
      }

      const target = row.querySelector('.cvr-c-task__details') || row;
      target.querySelectorAll('.connectea-panel, .connectea-row-wrapper').forEach(el => {
        if (el !== wrapper && el !== box) el.remove();
      });
    if (!target.contains(wrapper)) {
      target.append(wrapper);
    }

      const state = {
        wrapper,
        box,
        distribution,
        result,
        input,
        notice,
        key,
        isOverall,
        estimatedSize,
        typeContainer,
        typeSelect,
        outcomeBar
      };

      if (isOverall && key) {
        stateRef.state = state;
      }
      panels.set(row, state);
      return state;
    }

    window.ConnectifyCohortPanel = {
      readMark,
      readStats,
      createPanel,
      createElement,
      clearChildren,
      setText,
      setHTML,
      normalize,
      math,
      types,
      estimator,
      panels
    };
  } catch (err) {
    console.error('Connectify error in cohort-panel.js:', err);
  }
})();

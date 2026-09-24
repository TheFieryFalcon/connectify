/**
 * Connectify Cohort Statistics View
 *
 * Injects responsive cohort statistics panels, distribution summaries, and assessment type controls
 * directly into Connect assessment rows.
 * Provides `window.ConnectifyCohortView`.
 */
(() => {
  'use strict';

  if (window.ConnectifyCohortView) return;

  const panels = new WeakMap();

  const normalize = text => String(text ?? '').replace(/\s+/g, ' ').trim();

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

  const types = () => window.ConnectifyTaskTypes || {
    getTaskMeta: () => ({ subjectName: '', taskName: '', labels: [], labelsKey: '' }),
    updateTypeSelect: () => {},
    saveTaskTypeOverride: () => {}
  };

  const estimator = () => window.ConnectifyCohortEstimator || {
    loadCohortSize: () => undefined,
    saveCohortSize: () => false
  };

  /**
   * Reads raw assessment score percentage from the task row.
   */
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

  /**
   * Reads 5-number boxplot summary from DOM bridge or Highcharts on the task row.
   */
  function readStats(row) {
    const host = row.querySelector('[data-highcharts-chart]') ||
                 row.querySelector('.cvr-c-task__chart [data-highcharts-chart]') ||
                 row.querySelector('.cvr-c-task__chart');
    if (!host) return null;

    // Check shared DOM dataset bridge first (fast & cross-world compatible)
    if (host.dataset?.connectifyStats) {
      try {
        const stats = JSON.parse(host.dataset.connectifyStats);
        if (math().validStats(stats)) return stats;
      } catch {}
    }

    const hostWithDataset = host.querySelector?.('[data-connectify-stats]') || host.closest?.('[data-connectify-stats]');
    if (hostWithDataset?.dataset?.connectifyStats) {
      try {
        const stats = JSON.parse(hostWithDataset.dataset.connectifyStats);
        if (math().validStats(stats)) return stats;
      } catch {}
    }

    // Direct Highcharts instance check if available
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

          if (math().validStats(stats)) return stats;
        }
      }
    }

    return null;
  }

  function setText(element, text) {
    if (element.textContent !== text) {
      element.textContent = text;
    }
  }

  function createElement(tag, className, textContent) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
  }

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
      const typeTitle = createElement('span', 'connectea-type-title', 'Type:');

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
      const label = createElement('label', 'connectea-controls', 'Cohort Size: ');
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
          ? `Original Estimate: ~${estimatedSize}${warningText} • Saved.`
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
            ? `Original Estimate: ~${currentEstimate}${currentWarning} • ${persisted ? 'Saved.' : 'Browser storage unavailable.'}`
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
    target.append(wrapper);

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

  function render(row, isOverall, key, estimatedSize, onCohortChange) {
    let ui = panels.get(row);
    const mark = readMark(row);

    if (
      ui &&
      (!ui.wrapper.isConnected || ui.key !== key || ui.isOverall !== isOverall)
    ) {
      ui.wrapper.remove();
      ui = null;
    }

    if (!ui) ui = createPanel(row, isOverall, key, estimatedSize, onCohortChange);
    ui.estimatedSize = estimatedSize;

    // If assessment row, keep dropdown in sync
    if (!isOverall && ui.typeSelect) {
      const meta = types().getTaskMeta(row);
      types().updateTypeSelect(ui.typeSelect, meta.subjectName, meta.taskName, meta.labelsKey, meta.labels);
    }

    if (isOverall) {
      const userSize = estimator().loadCohortSize(key);
      if (ui.input && document.activeElement !== ui.input && ui.input.getAttribute('aria-invalid') !== 'true') {
        const valStr = userSize === undefined ? '' : String(userSize);
        if (ui.input.value !== valStr) ui.input.value = valStr;
        const expectedPlaceholder = estimatedSize !== undefined ? `~${estimatedSize}` : 'e.g. 120';
        if (ui.input.placeholder !== expectedPlaceholder) ui.input.placeholder = expectedPlaceholder;

        if (ui.notice) {
          const currentWarning = estimatedSize < 50 ? ' (Estimates under 50 students have reduced precision)' : '';
          if (userSize === undefined) {
            setText(ui.notice, currentWarning ? currentWarning.trim() : 'Enter custom size to override.');
          } else {
            setText(ui.notice, `Original Estimate: ~${estimatedSize}${currentWarning} • Saved.`);
          }
        }
      }
    }

    const stats = readStats(row);
    const userSize = estimator().loadCohortSize(key);
    const cohortSize = userSize ?? estimatedSize;
    const data = math().summary(stats, mark, cohortSize);

    const isIncomplete = !isOverall && !Number.isFinite(mark);
    if (isIncomplete) {
      ui.box.hidden = true;
      ui.box.classList.add('connectea-hidden');
      ui.box.style.setProperty('display', 'none', 'important');
      if (ui.typeContainer) ui.typeContainer.style.setProperty('display', 'inline-flex', 'important');
      if (ui.outcomeBar) {
        ui.outcomeBar.hidden = true;
        ui.outcomeBar.style.setProperty('display', 'none', 'important');
      }
      if (!isOverall && ui.wrapper) ui.wrapper.style.setProperty('display', 'flex', 'important');

      // Pre-cache prediction for upcoming task if possible:
      if (window.ConnectifyPredictorMath) {
        try {
          const meta = types().getTaskMeta(row);
          const taskMock = { name: meta.taskName, caption: meta.labels?.[1] || '', row };
          const pred = window.ConnectifyPredictorMath.predictTask(meta.subjectName, taskMock);
          if (!pred.unpredicted) {
            window.ConnectifyPredictorMath.cachePrediction(meta.subjectName, meta.labelsKey || meta.taskName, pred);
          }
        } catch (e) {}
      }
      return;
    }

    ui.box.hidden = false;
    ui.box.classList.remove('connectea-hidden');
    ui.box.style.setProperty('display', 'block', 'important');
    if (ui.typeContainer) ui.typeContainer.style.setProperty('display', 'inline-flex', 'important');
    if (!isOverall && ui.wrapper) ui.wrapper.style.setProperty('display', 'flex', 'important');

    // Outcome Meter evaluation against cached prediction
    if (!isOverall && ui.outcomeBar) {
      if (!Number.isFinite(mark) || !window.ConnectifyPredictorMath) {
        ui.outcomeBar.hidden = true;
        ui.outcomeBar.style.setProperty('display', 'none', 'important');
      } else {
        try {
          const meta = types().getTaskMeta(row);
          const predMath = window.ConnectifyPredictorMath;
          let cached = predMath.getCachedPrediction(meta.subjectName, meta.labelsKey || meta.taskName);
          if (!cached) {
            const taskMock = { name: meta.taskName, caption: meta.labels?.[1] || '', row };
            const fresh = predMath.predictTask(meta.subjectName, taskMock);
            if (!fresh.unpredicted) {
              cached = fresh;
              predMath.cachePrediction(meta.subjectName, meta.labelsKey || meta.taskName, fresh);
            }
          }
          if (cached) {
            const outcome = predMath.evaluateOutcome(mark, cached);
            renderOutcomeBar(ui.outcomeBar, outcome);
          } else {
            ui.outcomeBar.hidden = true;
            ui.outcomeBar.style.setProperty('display', 'none', 'important');
          }
        } catch (e) {
          ui.outcomeBar.hidden = true;
          ui.outcomeBar.style.setProperty('display', 'none', 'important');
        }
      }
    }

    if (!data) {
      setText(ui.distribution, 'Cohort statistics unavailable');
      setText(
        ui.result,
        Number.isFinite(mark) ? 'Rank and z-score unavailable' : 'Not marked · Rank and z-score unavailable'
      );
      return;
    }

    setText(
      ui.distribution,
      `Min ${math().formatPercentage(stats[0])}%  •  Q1 ${math().formatPercentage(stats[1])}%  •  Med ${math().formatPercentage(
        stats[2]
      )}%  •  Q3 ${math().formatPercentage(stats[3])}%  •  Max ${math().formatPercentage(stats[4])}%  •  Mean ${math().formatPercentage(
        data.mean
      )}%  •  SD ${math().formatPercentage(data.sd)}`
    );

    const parts = [];
    if (Number.isFinite(mark)) {
      if (!isOverall) parts.push(`Score: ${math().formatPercentage(mark)}%`);
      parts.push(`z ≈ ${Number.isFinite(data.z) ? String(Number(data.z.toFixed(2))) : 'N/A'}`);
      parts.push(math().standing(data.p));

      if (data.rank !== undefined) {
        const isEstimated = userSize === undefined && estimatedSize !== undefined;
        const totalDisplay = isEstimated ? `~${cohortSize}` : `${cohortSize}`;
        parts.push(
          data.rank === 1
            ? `Top of ${isOverall ? 'subject' : 'assessment'}`
            : `Rank: ${data.rank} / ${totalDisplay}`
        );
      } else {
        parts.push('Cohort size needed for rank');
      }
    } else {
      parts.push('Not marked · Rank and z-score unavailable');
    }

    setText(ui.result, parts.filter(Boolean).join('  •  '));
  }

  function renderOutcomeBar(bar, outcome) {
    if (!bar) return;
    if (!outcome || !Number.isFinite(outcome.segments)) {
      bar.hidden = true;
      bar.style.setProperty('display', 'none', 'important');
      return;
    }

    bar.title = outcome.details || outcome.label || '';
    bar.setAttribute('aria-label', bar.title);
    bar.classList.toggle('connectea-outcome-broken', Boolean(outcome.broken));
    bar.classList.toggle('connectea-outcome-critical', Boolean(outcome.critical));

    while (bar.firstChild) bar.removeChild(bar.firstChild);

    const baseColors = ['red', 'orange', 'yellow', 'green'];
    for (const colorName of baseColors) {
      const seg = createElement('div', 'connectea-outcome-segment');
      if (outcome.colors && outcome.colors.includes(colorName)) {
        seg.classList.add(`connectea-active-${colorName}`);
      }
      bar.append(seg);
    }

    if (outcome.broken) {
      const purpleSeg = createElement('div', 'connectea-outcome-segment connectea-active-purple');
      bar.append(purpleSeg);
    }

    bar.hidden = false;
    bar.style.setProperty('display', 'inline-flex', 'important');
  }

  window.ConnectifyCohortView = {
    readMark,
    readStats,
    createPanel,
    render,
    panels
  };
})();

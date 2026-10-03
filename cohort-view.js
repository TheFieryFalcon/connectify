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

  let cachedBaselinesSig = null;
  function getBaselinesSig() {
    if (cachedBaselinesSig !== null) return cachedBaselinesSig;
    if (window.ConnectifyPredictorMath?.getBaselines) {
      try {
        const b = window.ConnectifyPredictorMath.getBaselines();
        cachedBaselinesSig = JSON.stringify(b || {});
      } catch {
        cachedBaselinesSig = '';
      }
    } else {
      cachedBaselinesSig = '';
    }
    return cachedBaselinesSig;
  }

  let typesVersion = 0;
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('connectify-baselines-updated', () => {
      cachedBaselinesSig = null;
      typesVersion++;
    });
    window.addEventListener('storage', e => {
      if (e.key && (e.key.includes('baseline') || e.key.includes('prediction') || e.key.includes('categories') || e.key.includes('overrides'))) {
        cachedBaselinesSig = null;
        typesVersion++;
      }
    });
    window.addEventListener('connectify-task-type-changed', () => {
      cachedBaselinesSig = null;
      typesVersion++;
    });
    window.addEventListener('connectify-settings-updated', () => {
      cachedBaselinesSig = null;
      typesVersion++;
    });
  }

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
    const meta = types().getTaskMeta(row);
    const host = row.querySelector('[data-highcharts-chart]') ||
                 row.querySelector('.cvr-c-task__chart [data-highcharts-chart]') ||
                 row.querySelector('.cvr-c-task__chart');

    let foundStats = null;
    let foundN = undefined;

    if (host) {
      // Check shared DOM dataset bridge first (fast & cross-world compatible)
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

      // Direct Highcharts instance check if available
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

    // Fall back to persistent stats cache
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

  function render(row, isOverall, key, estimatedSize, onCohortChange, precollectedSubjects) {
    let ui = panels.get(row);
    const mark = readMark(row);

    if (
      ui &&
      (!ui.wrapper.isConnected || ui.isOverall !== isOverall)
    ) {
      ui.wrapper.remove();
      ui = null;
    }

    const stats = readStats(row);
    const statsKey = stats ? stats.join(',') : null;
    const baselinesSig = getBaselinesSig();
    const userSize = estimator().loadCohortSize(key);
    const cohortSize = userSize ?? estimatedSize;

    // Fast-path memoization: skip entire DOM query and type select overhead if inputs are unchanged
    const memo = ui?._memo;
    const taskType = memo?.taskType;
    if (
      memo &&
      memo.typesVersion === typesVersion &&
      memo.mark === mark &&
      memo.statsKey === statsKey &&
      memo.cohortSize === cohortSize &&
      memo.key === key &&
      memo.isOverall === isOverall &&
      memo.baselinesSig === baselinesSig &&
      memo.taskType === taskType &&
      ui.wrapper?.isConnected
    ) {
      return;
    }

    if (!ui) {
      ui = createPanel(row, isOverall, key, estimatedSize, onCohortChange);
    } else if (ui.key !== key) {
      ui.key = key;
    }
    ui.estimatedSize = estimatedSize;

    // If assessment row, keep dropdown in sync
    let currentTaskType = null;
    let cachedMeta = null;
    if (!isOverall) {
      cachedMeta = types().getTaskMeta(row);
      currentTaskType = types().getEffectiveType(cachedMeta.subjectName, cachedMeta.taskName, cachedMeta.labelsKey);
      if (ui.typeSelect) {
        types().updateTypeSelect(ui.typeSelect, cachedMeta.subjectName, cachedMeta.taskName, cachedMeta.labelsKey, cachedMeta.labels);
      }
    }

    if (isOverall) {
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
            setText(ui.notice, `Original Estimate ~${estimatedSize}${currentWarning} • Saved.`);
          }
        }
      }
    }

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

      // Pre-cache prediction for upcoming task only if not already cached
      if (window.ConnectifyPredictorMath) {
        try {
          const meta = cachedMeta || types().getTaskMeta(row);
          const cached = window.ConnectifyPredictorMath.getCachedPrediction?.(meta.subjectName, meta.labelsKey) ||
                         window.ConnectifyPredictorMath.getCachedPrediction?.(meta.subjectName, meta.taskName);
          if (!cached) {
            const taskMock = {
              id: meta.labelsKey ? `${meta.labelsKey}:0` : undefined,
              name: meta.taskName,
              caption: meta.labels?.[1] || '',
              labelsKey: meta.labelsKey,
              row
            };
            if (window.ConnectifyPredictorMath.getOrComputeTaskPrediction) {
              window.ConnectifyPredictorMath.getOrComputeTaskPrediction(meta.subjectName, taskMock, precollectedSubjects);
            } else {
              const pred = window.ConnectifyPredictorMath.predictTask(meta.subjectName, taskMock);
              if (!pred.unpredicted) {
                window.ConnectifyPredictorMath.cachePrediction(meta.subjectName, meta.labelsKey || meta.taskName, pred);
              }
            }
          }
        } catch (e) {}
      }
      ui._memo = { mark, statsKey, cohortSize, key, isOverall, baselinesSig, taskType: currentTaskType, typesVersion };
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

          // Populate task mock with row's metadata, semester, sequence, and actual score
          let taskSemester = 1;
          const card = row.closest('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile');
          if (card) {
            const cardTitle = card.querySelector('.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading')?.textContent || '';
            const semMatch = cardTitle.match(/Semester\s*([12])/i);
            if (semMatch) taskSemester = Number(semMatch[1]);
          }
          const allRows = card ? ((card._cxTaskRows && card._cxTaskRows.includes(row)) ? card._cxTaskRows : (card._cxTaskRows = (function() {
            const insideTasks = card.querySelectorAll('.cvr-c-tasks .cvr-c-task');
            if (insideTasks.length > 0) return Array.from(insideTasks);
            return Array.from(card.querySelectorAll('.cvr-c-task'));
          })())) : [];
          const taskSeq = allRows.indexOf(row) >= 0 ? allRows.indexOf(row) : 0;

          let taskOrder = null;
          const taskName = meta.taskName || '';
          const taskId = meta.taskId || (meta.labelsKey ? `${meta.labelsKey}:0` : '');
          const caption = meta.labels?.[1] || '';
          const cardTitle = card ? (card.querySelector('.eds-c-tile__title, .cvr-c-tile__title, h2, h3')?.textContent || '') : '';
          let customOrder = null;
          if (taskId) {
            customOrder = localStorage.getItem(`connectea:time_override:${meta.subjectName}:${taskId}`) ||
                          localStorage.getItem(`connectea:time_override:${cardTitle}:${taskId}`) ||
                          localStorage.getItem(`connectify:time_override:${meta.subjectName}:${taskId}`);
          }
          if (customOrder === null || customOrder === '') {
            customOrder = localStorage.getItem(`connectea:time_override:${meta.subjectName}:${taskName}`) ||
                          localStorage.getItem(`connectea:time_override:${cardTitle}:${taskName}`) ||
                          localStorage.getItem(`connectify:time_override:${meta.subjectName}:${taskName}`);
          }
          if (customOrder !== null && customOrder !== '') {
            const num = Number(customOrder);
            if (Number.isFinite(num) && num > 0) {
              const term = Math.floor((num - 1) / 10) + 1;
              const week = ((num - 1) % 10) + 1;
              taskOrder = (term - 1) * 12 + week;
            }
          }
          if (taskOrder === null && window.ConnectifyData?.orderHint) {
            taskOrder = window.ConnectifyData.orderHint(caption);
          }

          const weightElement = row.querySelectorAll('.cvr-c-task__marks .cvr-c-task__mark')[1];
          const weightText = weightElement?.textContent?.trim() || '';
          let rowWeight = 10;
          const wMatch = weightText.match(/(\d+(?:\.\d+)?)\s*%/i) || weightText.match(/(?:Out\s+of|\/)\s*(\d+(?:\.\d+)?)/i);
          if (wMatch) rowWeight = Number(wMatch[1]);

          const taskMock = {
            id: meta.labelsKey ? `${meta.labelsKey}:0` : undefined,
            name: meta.taskName,
            caption: meta.labels?.[1] || '',
            labelsKey: meta.labelsKey,
            row,
            score: mark,
            mark: mark,
            pending: false,
            semester: taskSemester,
            sequence: taskSeq,
            order: taskOrder,
            weight: rowWeight
          };

          const cleanSubj = predMath.cleanSubject ? predMath.cleanSubject(meta.subjectName) : meta.subjectName;
          const baselines = predMath.getBaselines ? predMath.getBaselines() : { subjects: {}, types: {} };
          const hasSubjectBaseline = Boolean(baselines?.subjects && (baselines.subjects[cleanSubj] !== undefined || baselines.subjects[meta.subjectName] !== undefined));

          // Determine if there is prior subject data (fast O(1) check)
          let hasPriorSubjectData = false;
          if (taskSemester > 1 || taskSeq > 0) {
            hasPriorSubjectData = true;
          } else {
            const subjObj = (precollectedSubjects || []).find(s => s.name === meta.subjectName || (predMath.cleanSubject && predMath.cleanSubject(s.name) === cleanSubj));
            if (subjObj && Array.isArray(subjObj.tasks)) {
              hasPriorSubjectData = subjObj.tasks.some(t => {
                if (t.pending || !Number.isFinite(t.score)) return false;
                if (t.row && t.row === row) return false;
                if (t.id && taskMock.id && t.id === taskMock.id) return false;
                if (t.name && meta.taskName && t.name.toLowerCase().trim() === meta.taskName.toLowerCase().trim()) return false;
                const tSem = t.semester || 1;
                const tSeq = t.sequence !== undefined ? t.sequence : 0;
                return tSem < taskSemester || (tSem === taskSemester && tSeq < taskSeq);
              });
            }
          }

          // Four segment bars render for the first task of a type, but are suppressed
          // if it's the very first task of the entire subject without subject baseline.
          const isFirstOfSubject = !hasPriorSubjectData && !hasSubjectBaseline;

          if (isFirstOfSubject) {
            ui.outcomeBar.hidden = true;
            ui.outcomeBar.style.setProperty('display', 'none', 'important');
          } else {
            let prediction = predMath.getCachedPrediction
              ? (predMath.getCachedPrediction(meta.subjectName, taskMock.id) ||
                 predMath.getCachedPrediction(meta.subjectName, meta.labelsKey) ||
                 predMath.getCachedPrediction(meta.subjectName, meta.taskName))
              : null;

            if (!prediction || prediction.unpredicted) {
              const allSubjects = precollectedSubjects || (window.ConnectifyData?.hasCachedSubjects?.() ? window.ConnectifyData.collect(true) : []);
              prediction = predMath.getOrComputeTaskPrediction
                ? predMath.getOrComputeTaskPrediction(meta.subjectName, taskMock, allSubjects)
                : predMath.predictTask(meta.subjectName, taskMock, null, baselines, true);
            }

            if (!prediction || prediction.unpredicted) {
              ui.outcomeBar.hidden = true;
              ui.outcomeBar.style.setProperty('display', 'none', 'important');
            } else {
              const outcome = predMath.evaluateOutcome(mark, prediction);
              renderOutcomeBar(ui.outcomeBar, outcome);
            }
          }
        } catch (e) {
          console.error('cohort-view error in outcomeBar:', e);
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
      ui._memo = { mark, statsKey, cohortSize, key, isOverall, baselinesSig, taskType: currentTaskType, typesVersion };
      return;
    }

    setHTML(
      ui.distribution,
      `Min ${math().formatPercentage(stats[0])}%  •  Q1 ${math().formatPercentage(stats[1])}%  •  <strong>Med ${math().formatPercentage(
        stats[2]
      )}%</strong>  •  Q3 ${math().formatPercentage(stats[3])}%  •  <strong>Max ${math().formatPercentage(stats[4])}%</strong>  •  <strong>Mean ${math().formatPercentage(
        data.mean
      )}%</strong>  •  SD ${math().formatPercentage(data.sd)}`
    );

    const parts = [];
    if (Number.isFinite(mark)) {
      if (!isOverall) parts.push(`<strong>Score ${math().formatPercentage(mark)}%</strong>`);
      const zStr = Number.isFinite(data.z) ? String(Number(data.z.toFixed(2))) : 'N/A';
      parts.push(`<strong>Z-Score ${zStr}</strong>`);
      const standingText = math().standing(data.p);
      if (standingText) {
        parts.push(`<strong>${standingText}</strong>`);
      }

      if (data.rank !== undefined) {
        const isEstimated = userSize === undefined && estimatedSize !== undefined;
        const totalDisplay = isEstimated ? `~${cohortSize}` : `${cohortSize}`;
        const rankStr = data.rank === 1
          ? `Top of ${isOverall ? 'subject' : 'assessment'}`
          : `${data.rank} / ${totalDisplay}`;
        parts.push(`<strong>${rankStr}</strong>`);
      } else {
        parts.push('Cohort size needed');
      }
    } else {
      parts.push('Not marked · Stats unavailable');
    }

    setHTML(ui.result, parts.filter(Boolean).join('  •  '));
    ui._memo = { mark, statsKey, cohortSize, key, isOverall, baselinesSig, taskType: currentTaskType, typesVersion };
  }

  let floatingTooltipEl = null;
  function getFloatingTooltip() {
    if (!floatingTooltipEl || !floatingTooltipEl.isConnected) {
      floatingTooltipEl = document.getElementById('connectea-outcome-tooltip');
      if (!floatingTooltipEl) {
        floatingTooltipEl = createElement('div', '');
        floatingTooltipEl.id = 'connectea-outcome-tooltip';
        floatingTooltipEl.setAttribute('role', 'tooltip');
        document.body.append(floatingTooltipEl);
      }
    }
    return floatingTooltipEl;
  }

  function showFloatingTooltip(e, text) {
    if (!text) return;
    const tooltip = getFloatingTooltip();
    tooltip.textContent = text;
    tooltip.classList.add('connectea-tooltip-visible');

    const pad = 14;
    let left = e.clientX + pad;
    let top = e.clientY - 12;

    const width = 340;
    const height = 180;
    if (left + width > window.innerWidth - 10) {
      left = Math.max(10, e.clientX - width - pad);
    }
    if (top + height > window.innerHeight - 10) {
      top = Math.max(10, window.innerHeight - height - 10);
    }
    if (top < 10) top = 10;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function hideFloatingTooltip() {
    if (floatingTooltipEl) {
      floatingTooltipEl.classList.remove('connectea-tooltip-visible');
    }
  }

  function renderOutcomeBar(bar, outcome) {
    if (!bar) return;
    if (!outcome || !Number.isFinite(outcome.segments)) {
      bar.hidden = true;
      bar.style.setProperty('display', 'none', 'important');
      return;
    }

    const tooltipText = outcome.details || outcome.label || '';
    bar.dataset.connecteaTooltip = tooltipText;
    bar.removeAttribute('title');
    bar.setAttribute('aria-label', tooltipText);
    bar.classList.toggle('connectea-outcome-broken', Boolean(outcome.broken));
    bar.classList.toggle('connectea-outcome-critical', Boolean(outcome.critical));

    if (!bar._tooltipBound) {
      bar._tooltipBound = true;
      bar.addEventListener('mouseenter', (e) => {
        showFloatingTooltip(e, bar.dataset.connecteaTooltip);
      });
      bar.addEventListener('mousemove', (e) => {
        showFloatingTooltip(e, bar.dataset.connecteaTooltip);
      });
      bar.addEventListener('mouseleave', () => {
        hideFloatingTooltip();
      });
    }

    // Memoize rendered outcome segments to avoid destroying and recreating DOM nodes on scroll
    const outcomeKey = `${outcome.segments}:${outcome.colors ? outcome.colors.join(',') : ''}:${Boolean(outcome.broken)}:${Boolean(outcome.critical)}`;
    if (bar._renderedKey === outcomeKey && bar.children.length > 0) {
      bar.hidden = false;
      bar.style.setProperty('display', 'inline-flex', 'important');
      return;
    }
    bar._renderedKey = outcomeKey;

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

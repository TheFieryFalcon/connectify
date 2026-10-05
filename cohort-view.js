/**
 * Connectify Cohort Statistics View
 *
 * Injects responsive cohort statistics panels, distribution summaries, and assessment type controls
 * directly into Connect assessment rows.
 * Provides `window.ConnectifyCohortView`.
 */
(() => {
  'use strict';

  try {
    const panelMod = () => window.ConnectifyCohortPanel || {};
    const outcomeMod = () => window.ConnectifyCohortOutcome || {};

    const math = () => panelMod().math ? panelMod().math() : (window.ConnectifyCohortMath || {
      formatPercentage: v => String(v ?? '')
    });
    const types = () => panelMod().types ? panelMod().types() : (window.ConnectifyTaskTypes || {});
    const estimator = () => panelMod().estimator ? panelMod().estimator() : (window.ConnectifyCohortEstimator || {});
    const readMark = row => (panelMod().readMark || function() { return undefined; })(row);
    const readStats = row => (panelMod().readStats || function() { return null; })(row);
    const createPanel = (row, isOverall, key, estimatedSize, onCohortChange) =>
      (panelMod().createPanel || function() {})(row, isOverall, key, estimatedSize, onCohortChange);
    const renderOutcomeBar = (bar, outcome) =>
      (outcomeMod().renderOutcomeBar || function() {})(bar, outcome);
    const clearChildren = el => (panelMod().clearChildren || function() {})(el);
    const setText = (el, txt) => (panelMod().setText || function() {})(el, txt);
    const setHTML = (el, htm) => (panelMod().setHTML || function() {})(el, htm);

    const panels = window.ConnectifyCohortPanels || (window.ConnectifyCohortPanels = new WeakMap());

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
      window.addEventListener('connectify-predictions-updated', () => {
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
              clearChildren(ui.outcomeBar);
              delete ui.outcomeBar._renderedKey;
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
                clearChildren(ui.outcomeBar);
                delete ui.outcomeBar._renderedKey;
              } else {
                const outcome = predMath.evaluateOutcome(mark, prediction);
                renderOutcomeBar(ui.outcomeBar, outcome);
              }
            }
          } catch (e) {
            console.error('cohort-view error in outcomeBar:', e);
            ui.outcomeBar.hidden = true;
            ui.outcomeBar.style.setProperty('display', 'none', 'important');
            clearChildren(ui.outcomeBar);
            delete ui.outcomeBar._renderedKey;
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

    window.ConnectifyCohortView = {
      readMark,
      readStats,
      createPanel,
      render,
      panels
    };
  } catch (err) {
    console.error('Connectify error in cohort-view.js:', err);
  }
})();

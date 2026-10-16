/**
 * Connectify Cohort Statistics View
 *
 * Renders a task row's statistics panel: distribution summary, score, z-score, standing and rank, the
 * cohort size notice on the overall row, and the outcome meter (evaluated in cohort-outcome-eval.js).
 * Each row memoises its inputs so unchanged rows are skipped while scrolling.
 * Provides `window.ConnectifyCohortView`.
 */
(() => {
  'use strict';

  try {
    const rows = window.ConnectifyCohortRows;
    const panelMod = window.ConnectifyCohortPanel;
    const outcomeEval = window.ConnectifyCohortOutcomeEval;
    const { readMark, readStats, clearChildren, setText, setHTML, math, types, estimator } = rows;
    const { createPanel, noticeText } = panelMod;
    const renderOutcomeBar = (bar, outcome) => window.ConnectifyCohortOutcome?.renderOutcomeBar?.(bar, outcome);

    const panels = window.ConnectifyCohortPanels || (window.ConnectifyCohortPanels = new WeakMap());

    let cachedBaselinesSig = null;
    function getBaselinesSig() {
      if (cachedBaselinesSig !== null) return cachedBaselinesSig;
      try {
        cachedBaselinesSig = JSON.stringify(window.ConnectifyPredictorMath?.getBaselines?.() || {});
      } catch {
        cachedBaselinesSig = '';
      }
      return cachedBaselinesSig;
    }

    // Any change to baselines, predictions, categories or overrides invalidates every row's memo
    let typesVersion = 0;
    const invalidate = () => {
      cachedBaselinesSig = null;
      typesVersion++;
    };
    for (const evt of ['connectify-baselines-updated', 'connectify-predictions-updated', 'connectify-task-type-changed', 'connectify-settings-updated']) {
      window.addEventListener(evt, invalidate);
    }
    window.addEventListener('storage', e => {
      if (e.key && /baseline|prediction|categories|overrides/.test(e.key)) invalidate();
    });

    const hide = el => {
      el.hidden = true;
      el.style.setProperty('display', 'none', 'important');
    };
    function hideOutcome(bar) {
      hide(bar);
      clearChildren(bar);
      delete bar._renderedKey;
    }

    function showPanel(ui, isOverall, visible) {
      ui.box.hidden = !visible;
      ui.box.classList.toggle('connectea-hidden', !visible);
      ui.box.style.setProperty('display', visible ? 'block' : 'none', 'important');
      if (ui.typeContainer) ui.typeContainer.style.setProperty('display', 'inline-flex', 'important');
      if (!isOverall && ui.wrapper) ui.wrapper.style.setProperty('display', 'flex', 'important');
    }

    function syncCohortInput(ui, userSize, estimatedSize) {
      const input = ui.input;
      if (!input || document.activeElement === input || input.getAttribute('aria-invalid') === 'true') return;
      const valStr = userSize === undefined ? '' : String(userSize);
      if (input.value !== valStr) input.value = valStr;
      const placeholder = estimatedSize !== undefined ? `~${estimatedSize}` : 'e.g. 120';
      if (input.placeholder !== placeholder) input.placeholder = placeholder;
      if (ui.notice) setText(ui.notice, noticeText(estimatedSize, userSize));
    }

    function renderOutcome(ui, row, mark, meta, precollectedSubjects) {
      try {
        const outcome = outcomeEval.evaluateRow(row, mark, meta, precollectedSubjects);
        if (outcome) renderOutcomeBar(ui.outcomeBar, outcome);
        else hideOutcome(ui.outcomeBar);
      } catch (e) {
        console.error('cohort-view error in outcomeBar:', e);
        hideOutcome(ui.outcomeBar);
      }
    }

    function resultParts(data, mark, isOverall, userSize, estimatedSize, cohortSize) {
      if (!Number.isFinite(mark)) return ['Not marked · Stats unavailable'];
      const parts = [];
      if (!isOverall) parts.push(`<strong>Score ${math().formatPercentage(mark)}%</strong>`);
      const zStr = Number.isFinite(data.z) ? String(Number(data.z.toFixed(2))) : 'N/A';
      parts.push(`<strong>Z-Score ${zStr}</strong>`);
      const standingText = math().standing(data.p);
      if (standingText) parts.push(`<strong>${standingText}</strong>`);
      if (data.rank === undefined) {
        parts.push('Cohort size needed');
        return parts;
      }
      const isEstimated = userSize === undefined && estimatedSize !== undefined;
      const totalDisplay = isEstimated ? `~${cohortSize}` : `${cohortSize}`;
      const rankStr = data.rank === 1 ? `Top of ${isOverall ? 'subject' : 'assessment'}` : `${data.rank} / ${totalDisplay}`;
      parts.push(`<strong>${rankStr}</strong>`);
      return parts;
    }

    function render(row, isOverall, key, estimatedSize, onCohortChange, precollectedSubjects) {
      let ui = panels.get(row);
      const mark = readMark(row);
      if (ui && (!ui.wrapper.isConnected || ui.isOverall !== isOverall)) {
        ui.wrapper.remove();
        ui = null;
      }

      const stats = readStats(row);
      const statsKey = stats ? stats.join(',') : null;
      const baselinesSig = getBaselinesSig();
      const userSize = estimator().loadCohortSize(key);
      const cohortSize = userSize ?? estimatedSize;

      // Fast path: nothing that affects this row has changed. A task type change bumps typesVersion,
      // so the memoised taskType never needs recomputing here
      const memo = ui?._memo;
      if (
        memo &&
        memo.typesVersion === typesVersion &&
        memo.mark === mark &&
        memo.statsKey === statsKey &&
        memo.cohortSize === cohortSize &&
        memo.key === key &&
        memo.isOverall === isOverall &&
        memo.baselinesSig === baselinesSig &&
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

      let taskType = null;
      let meta = null;
      if (isOverall) {
        syncCohortInput(ui, userSize, estimatedSize);
      } else {
        meta = types().getTaskMeta(row);
        taskType = types().getEffectiveType(meta.subjectName, meta.taskName, meta.labelsKey);
        if (ui.typeSelect) types().updateTypeSelect(ui.typeSelect, meta.subjectName, meta.taskName, meta.labelsKey, meta.labels);
      }
      const remember = () => {
        ui._memo = { mark, statsKey, cohortSize, key, isOverall, baselinesSig, taskType, typesVersion };
      };

      // Unmarked assessments show only the type dropdown; their prediction is pre-cached
      if (!isOverall && !Number.isFinite(mark)) {
        showPanel(ui, isOverall, false);
        if (ui.outcomeBar) hide(ui.outcomeBar);
        outcomeEval.precacheUpcoming(row, meta, precollectedSubjects);
        remember();
        return;
      }

      showPanel(ui, isOverall, true);
      if (!isOverall && ui.outcomeBar) {
        if (window.ConnectifyPredictorMath) renderOutcome(ui, row, mark, meta, precollectedSubjects);
        else hide(ui.outcomeBar);
      }

      const data = math().summary(stats, mark, cohortSize);
      if (!data) {
        setText(ui.distribution, 'Cohort statistics unavailable');
        setText(ui.result, Number.isFinite(mark) ? 'Rank and z-score unavailable' : 'Not marked · Rank and z-score unavailable');
        remember();
        return;
      }

      setHTML(
        ui.distribution,
        `Min ${math().formatPercentage(stats[0])}%  •  Q1 ${math().formatPercentage(stats[1])}%  •  ` +
        `<strong>Med ${math().formatPercentage(stats[2])}%</strong>  •  Q3 ${math().formatPercentage(stats[3])}%  •  ` +
        `<strong>Max ${math().formatPercentage(stats[4])}%</strong>  •  <strong>Mean ${math().formatPercentage(data.mean)}%</strong>  •  ` +
        `SD ${math().formatPercentage(data.sd)}`
      );
      setHTML(ui.result, resultParts(data, mark, isOverall, userSize, estimatedSize, cohortSize).join('  •  '));
      remember();
    }

    window.ConnectifyCohortView = { readMark, readStats, createPanel, render, panels };
  } catch (err) {
    console.error('Connectify error in cohort-view.js:', err);
  }
})();

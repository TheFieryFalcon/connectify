/**
 * Connectify Cohort Panel
 *
 * Builds a task row's statistics panel: the distribution and result lines, the "Type:" dropdown and
 * outcome meter for assessments, and the cohort size input on the overall subject row.
 * Row readers and DOM helpers: cohort-row-readers.js. Exposes window.ConnectifyCohortPanel.
 */
(() => {
  'use strict';

  try {
    const rows = window.ConnectifyCohortRows;
    const { readMark, createElement, setText, math, types, estimator } = rows;

    const SMALL_COHORT = ' (Estimates under 50 students have reduced precision)';
    /** The cohort size notice: the estimate, the small-cohort warning and whether the override was saved. */
    function noticeText(estimatedSize, size, status = 'Saved.') {
      const warning = estimatedSize < 50 ? SMALL_COHORT : '';
      if (size === undefined) return warning ? warning.trim() : 'Enter custom size to override.';
      return `Original Estimate ~${estimatedSize}${warning} • ${status}`;
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
        const typeTitle = createElement('span', 'connectea-type-title', 'Type: ');

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

        notice = createElement('span', 'connectea-notice', noticeText(estimatedSize, saved));
        notice.setAttribute('aria-live', 'polite');

        const controls = createElement('div', 'connectea-subject-controls');
        controls.append(label, notice);
        box.append(controls);

        input.addEventListener('input', () => {
          const size = math().validCohortSize(input.value);
          const isInvalid = (input.value !== '' && !size) || input.validity.badInput;
          input.setAttribute('aria-invalid', String(Boolean(isInvalid)));

          const currentEstimate = stateRef.state ? stateRef.state.estimatedSize : estimatedSize;
          const persisted = estimator().saveCohortSize(key, size);
          setText(
            notice,
            isInvalid
              ? 'Enter a whole number of students, at least 1.'
              : noticeText(currentEstimate, size, persisted ? 'Saved.' : 'Browser storage unavailable.')
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

    window.ConnectifyCohortPanel = { ...rows, createPanel, noticeText, panels };
  } catch (err) {
    console.error('Connectify error in cohort-panel.js:', err);
  }
})();

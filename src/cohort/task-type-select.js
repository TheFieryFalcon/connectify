/**
 * Connectify Task Types: row metadata and the assessment type dropdown
 *
 * Reads a task row's subject, task name and labels, keeps each row's "Type:" dropdown in sync with the
 * automatic category and the student's override, and re-detects every Auto row when categories change.
 * Extends window.ConnectifyTaskTypes (task-types.js).
 */
(() => {
  'use strict';

  const types = window.ConnectifyTaskTypes;
  if (!types || types.updateTypeSelect) return;
  const { normalize } = window.ConnectifyUtils;
  const { cleanSubject, categorizeTask, getSavedTaskType, getCategories, getCustomCategoriesForClass, invalidateTypesMemoryCache } = types;

  function getTaskMeta(row) {
    const card = row.closest('.eds-c-tile, .cvr-c-tile, [data-subject-card], .c-tile');
    const titleEl = card?.querySelector('.eds-c-tile__title, .cvr-c-tile__title, [class*="tile__title"], [class*="card-title"], h1, h2, h3, h4, .c-tile__title, .eds-c-heading');
    const cardTitle = normalize(titleEl?.textContent || '');
    const subjectName = cleanSubject(cardTitle);
    const labels = Array.from(row.querySelectorAll('.cvr-c-task__details .v-label'))
      .map(e => normalize(e.textContent))
      .filter(Boolean);
    const taskName = (labels.length ? labels[labels.length - 1] : '') ||
      normalize(row.querySelector('.cvr-c-task__details')?.childNodes[0]?.textContent) ||
      'Assessment';
    const labelsKey = labels.join('::');
    return { subjectName, taskName, labels, labelsKey };
  }

  function updateTypeSelect(select, subjectName, taskName, labelsKey, allLabels) {
    const autoType = categorizeTask(taskName, allLabels);
    const savedOverride = getSavedTaskType(subjectName, taskName, labelsKey);
    const categories = getCategories();
    const classCustoms = getCustomCategoriesForClass(subjectName);

    const currentSelection = savedOverride !== undefined ? savedOverride : '';

    // Merge standard categories and class custom categories
    const allCatList = [...Object.keys(categories)];
    for (const cc of classCustoms) {
      if (!allCatList.includes(cc)) allCatList.push(cc);
    }
    if (savedOverride && !allCatList.includes(savedOverride)) {
      allCatList.push(savedOverride);
    }

    const optSignature = `${autoType}|${allCatList.join(',')}|${savedOverride || ''}`;
    if (select.dataset.signature !== optSignature) {
      select.dataset.signature = optSignature;
      select.innerHTML = '';

      const autoOpt = document.createElement('option');
      autoOpt.value = '';
      autoOpt.textContent = `Auto (${autoType})`;
      select.appendChild(autoOpt);

      for (const cat of allCatList) {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
      }

      const addOpt = document.createElement('option');
      addOpt.value = '__custom__';
      addOpt.textContent = '+ Custom...';
      select.appendChild(addOpt);
    }

    select.value = currentSelection;
    if (currentSelection) {
      select.classList.add('connectea-overridden');
      select.title = `Assessment type manually set to "${currentSelection}". Click to change or reset to Auto.`;
    } else {
      select.classList.remove('connectea-overridden');
      select.title = `Automatically detected as "${autoType}". Click to override.`;
    }
  }

  function rescanAllAutoAssessments() {
    const selects = Array.from(document.querySelectorAll('.connectea-type-select'));
    for (const select of selects) {
      const row = select.closest('.cvr-c-task');
      if (!row) continue;
      const meta = getTaskMeta(row);
      delete select.dataset.signature;
      updateTypeSelect(select, meta.subjectName, meta.taskName, meta.labelsKey, meta.labels);
    }

    if (window.ConnectifyCompoundProgress?.update) {
      window.ConnectifyCompoundProgress.update();
    }
    if (window.ConnectifyWeakness?.renderChart) {
      window.ConnectifyWeakness.renderChart();
    }
    if (window.ConnectifyPredictorMath?.updatePredictionCache) {
      try {
        window.ConnectifyPredictorMath.updatePredictionCache();
      } catch {}
    }
    window.dispatchEvent(new CustomEvent('connectify-task-type-changed'));
  }

  window.addEventListener('storage', e => {
    if (e.key === 'cx-categories' || e.key === 'connectea:categories') {
      try {
        if (e.newValue) window.cxCategories = JSON.parse(e.newValue);
      } catch {}
      invalidateTypesMemoryCache();
      rescanAllAutoAssessments();
    } else if (e.key === 'connectea:task_type_overrides' || e.key?.startsWith('connectea:class_categories:')) {
      invalidateTypesMemoryCache();
    }
  });

  window.addEventListener('connectify-settings-updated', () => {
    invalidateTypesMemoryCache();
  });

  window.addEventListener('connectify-rescan-auto-types', rescanAllAutoAssessments);

  Object.assign(types, { getTaskMeta, updateTypeSelect, rescanAllAutoAssessments });
})();

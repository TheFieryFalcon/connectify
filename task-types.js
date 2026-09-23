/**
 * Connectify Task Type Categorizer & Override Manager
 *
 * Handles automated assessment categorization (Exam, Test, Application, Essay, Take-Home),
 * persistent student category overrides in localStorage, dynamic category colors,
 * class-level custom category sharing across Semesters 1 and 2,
 * and the interactive assessment type selector dropdown.
 */
(() => {
  'use strict';

  if (window.ConnectifyTaskTypes) return;

  const defaultCategories = {
    Exam: { color: '#e74c3c', keywords: ['exam', 'semester'] },
    Test: { color: '#2ecc71', keywords: ['test', 'quiz', 'in-class', 'in class'] },
    Application: { color: '#3498db', keywords: ['application', 'investigation', 'portfolio', 'validation', 'practical', 'speaking', 'listening', 'dictation'] },
    Essay: { color: '#9b59b6', keywords: ['essay', 'short answer', 'written response', 'close reading'] },
    'Take-Home': { color: '#f1c40f', keywords: ['take-home', 'assignment', 'project', 'extended', 'presentation', 'oral', 'creative'] }
  };

  const normalize = text => String(text ?? '').replace(/\s+/g, ' ').trim();

  function cleanSubject(subjectName) {
    return (subjectName || '')
      .replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getCategories() {
    if (window.cxCategories && Object.keys(window.cxCategories).length > 0) {
      return window.cxCategories;
    }
    try {
      const stored = localStorage.getItem('connectea:categories') || localStorage.getItem('cx-categories');
      if (stored) {
        window.cxCategories = JSON.parse(stored);
        return window.cxCategories;
      }
    } catch {}
    return defaultCategories;
  }

  function getCustomCategoriesForClass(subjectName) {
    const subjKey = cleanSubject(subjectName).toLowerCase();
    if (!subjKey) return [];
    try {
      const stored = localStorage.getItem(`connectea:class_categories:${subjKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      }
    } catch {}
    return [];
  }

  function addCustomCategoryForClass(subjectName, categoryName) {
    const cat = normalize(categoryName);
    if (!cat) return;
    const subjKey = cleanSubject(subjectName).toLowerCase();
    if (!subjKey) return;

    const existing = getCustomCategoriesForClass(subjKey);
    if (!existing.some(c => c.toLowerCase() === cat.toLowerCase())) {
      existing.push(cat);
      try {
        localStorage.setItem(`connectea:class_categories:${subjKey}`, JSON.stringify(existing));
      } catch {}
    }
  }

  function getTaskTypeOverrides() {
    try {
      return JSON.parse(localStorage.getItem('connectea:task_type_overrides') || '{}');
    } catch {
      return {};
    }
  }

  function getSavedTaskType(subjectName, taskName, labelsKey) {
    const overrides = getTaskTypeOverrides();
    const cleanSubj = cleanSubject(subjectName);
    if (labelsKey && overrides[`${cleanSubj}::${labelsKey}`]) {
      return overrides[`${cleanSubj}::${labelsKey}`];
    }
    if (taskName && overrides[`${cleanSubj}::${taskName}`]) {
      return overrides[`${cleanSubj}::${taskName}`];
    }
    return undefined;
  }

  function saveTaskTypeOverride(subjectName, taskName, labelsKey, type) {
    const overrides = getTaskTypeOverrides();
    const cleanSubj = cleanSubject(subjectName);
    const fullKey = labelsKey ? `${cleanSubj}::${labelsKey}` : null;
    const nameKey = taskName ? `${cleanSubj}::${taskName}` : null;

    if (type) {
      if (fullKey) overrides[fullKey] = type;
      if (nameKey) overrides[nameKey] = type;
      addCustomCategoryForClass(cleanSubj, type);
    } else {
      if (fullKey) delete overrides[fullKey];
      if (nameKey) delete overrides[nameKey];
    }

    try {
      localStorage.setItem('connectea:task_type_overrides', JSON.stringify(overrides));
    } catch {}

    window.dispatchEvent(new CustomEvent('connectify-task-type-changed', {
      detail: { subject: cleanSubj, task: taskName, type }
    }));
  }

  function categorizeTask(taskName, allLabels = []) {
    const combined = [taskName, ...allLabels].join(' ').toLowerCase();
    const cats = getCategories();
    for (const [cat, data] of Object.entries(cats)) {
      if (data?.keywords?.some(k => k && combined.includes(k.toLowerCase()))) {
        return cat;
      }
    }
    return 'Take-Home';
  }

  function getEffectiveType(subjectName, task, labelsKey) {
    const taskName = typeof task === 'string' ? task : task?.name;
    let actualLabelsKey = labelsKey;
    if (!actualLabelsKey && task && typeof task === 'object' && task.row) {
      const labels = Array.from(task.row.querySelectorAll('.cvr-c-task__details .v-label'))
        .map(e => (e.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      if (labels.length) actualLabelsKey = labels.join('::');
    }
    const saved = getSavedTaskType(subjectName, taskName, actualLabelsKey);
    if (saved) return saved;
    const labelsList = actualLabelsKey ? actualLabelsKey.split('::') : (task?.caption ? [task.caption] : []);
    return categorizeTask(taskName, labelsList);
  }

  function getCategoryColor(cat) {
    const cats = getCategories();
    if (cats?.[cat]?.color) return cats[cat].color;
    if (defaultCategories[cat]?.color) return defaultCategories[cat].color;
    const palette = ['#1abc9c', '#e67e22', '#16a085', '#d35400', '#27ae60', '#8e44ad', '#2980b9', '#f39c12', '#9c27b0', '#009688'];
    let hash = 0;
    for (let i = 0; i < (cat || '').length; i++) hash = (hash << 5) - hash + cat.charCodeAt(i);
    return palette[Math.abs(hash) % palette.length];
  }

  function getTaskMeta(row) {
    const card = row.closest('.eds-c-tile');
    const cardTitle = normalize(card?.querySelector('.eds-c-tile__title')?.textContent || '');
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
    window.dispatchEvent(new CustomEvent('connectify-task-type-changed'));
  }

  window.addEventListener('storage', e => {
    if (e.key === 'cx-categories' || e.key === 'connectea:categories') {
      try {
        if (e.newValue) window.cxCategories = JSON.parse(e.newValue);
      } catch {}
      rescanAllAutoAssessments();
    }
  });

  window.addEventListener('connectify-rescan-auto-types', rescanAllAutoAssessments);

  window.ConnectifyTaskTypes = {
    defaultCategories,
    getCategories,
    getOverrides: getTaskTypeOverrides,
    getSavedTaskType,
    saveTaskTypeOverride,
    getCustomCategoriesForClass,
    addCustomCategoryForClass,
    categorizeTask,
    getEffectiveType,
    getCategoryColor,
    getTaskMeta,
    updateTypeSelect,
    rescanAllAutoAssessments
  };
})();

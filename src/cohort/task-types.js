/**
 * Connectify Task Type Categorizer & Override Manager
 *
 * Automated assessment categorization (Exam, Test, Application, Essay, Take-Home and custom categories),
 * persistent student overrides, category colours and class-level custom categories shared across
 * Semesters 1 and 2. Row metadata and the type dropdown: task-type-select.js.
 * Exposes window.ConnectifyTaskTypes.
 */
(() => {
  'use strict';

  if (window.ConnectifyTaskTypes) return;

  const { UNKNOWN_TYPE, UNKNOWN_COLOR, defaultCategories, isCategoryName } = window.ConnectifyCategoryStore;
  const { normalize } = window.ConnectifyUtils;

  function cleanSubject(subjectName) {
    return (subjectName || '')
      .replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  let cachedOverrides = null;
  const cachedClassCategories = new Map();

  function invalidateTypesMemoryCache() {
    cachedOverrides = null;
    cachedClassCategories.clear();
  }

  // The category store keeps the live set in window.cxCategories and replaces it on every save, so it is
  // read directly: a memoised copy would keep detecting tasks with the old keywords after a save
  function getCategories() {
    const live = window.cxCategories;
    return live && Object.keys(live).length > 0 ? live : defaultCategories;
  }

  function getCustomCategoriesForClass(subjectName) {
    const subjKey = cleanSubject(subjectName).toLowerCase();
    if (!subjKey) return [];
    if (cachedClassCategories.has(subjKey)) {
      return cachedClassCategories.get(subjKey);
    }
    try {
      const stored = localStorage.getItem(window.ConnectifyUtils.userKey(`connectify:class_categories:${subjKey}`));
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const res = parsed.filter(isCategoryName);
          cachedClassCategories.set(subjKey, res);
          return res;
        }
      }
    } catch {}
    cachedClassCategories.set(subjKey, []);
    return [];
  }

  function addCustomCategoryForClass(subjectName, categoryName) {
    const cat = normalize(categoryName);
    if (!isCategoryName(cat)) return;
    const subjKey = cleanSubject(subjectName).toLowerCase();
    if (!subjKey) return;

    const existing = [...getCustomCategoriesForClass(subjKey)];
    if (!existing.some(c => c.toLowerCase() === cat.toLowerCase())) {
      existing.push(cat);
      cachedClassCategories.set(subjKey, existing);
      try {
        localStorage.setItem(window.ConnectifyUtils.userKey(`connectify:class_categories:${subjKey}`), JSON.stringify(existing));
      } catch {}
    }
  }

  function getTaskTypeOverrides() {
    if (cachedOverrides !== null) return cachedOverrides;
    try {
      cachedOverrides = JSON.parse(localStorage.getItem(window.ConnectifyUtils.userKey('connectify:task_type_overrides')) || '{}');
      return cachedOverrides;
    } catch {
      cachedOverrides = {};
      return cachedOverrides;
    }
  }

  function getSavedTaskType(subjectName, taskName, labelsKey) {
    const overrides = getTaskTypeOverrides();
    const cleanSubj = cleanSubject(subjectName);
    // An override picked from a damaged category list ("undefined") reads as Auto
    if (labelsKey && isCategoryName(overrides[`${cleanSubj}::${labelsKey}`])) {
      return overrides[`${cleanSubj}::${labelsKey}`];
    }
    if (taskName && isCategoryName(overrides[`${cleanSubj}::${taskName}`])) {
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
      localStorage.setItem(window.ConnectifyUtils.userKey('connectify:task_type_overrides'), JSON.stringify(overrides));
    } catch {}

    if (window.ConnectifyPredictorMath?.updatePredictionCache) {
      try {
        window.ConnectifyPredictorMath.updatePredictionCache(cleanSubj);
      } catch {}
    }

    window.dispatchEvent(new CustomEvent('connectify-task-type-changed', {
      detail: { subject: cleanSubj, task: taskName, type }
    }));
  }

  // The most specific keyword in the name and labels decides, read in the subject's sense (task-type-rules.js)
  function categorizeTask(taskName, allLabels = [], subjectName = '') {
    return window.ConnectifyTaskTypeRules.classify(taskName, allLabels, subjectName, getCategories(), defaultCategories) || UNKNOWN_TYPE;
  }

  // Task ids are JSON.stringify([labels, maxScore]) + ':n', so tasks cached before labelsKey existed still carry their labels
  function labelsFromId(id) {
    try {
      const labels = JSON.parse(String(id).replace(/:\d+$/, ''))?.[0];
      return Array.isArray(labels) && labels.length ? labels.join('::') : '';
    } catch { return ''; }
  }

  // The every-label key a cached task's type is saved and detected under
  const labelsKeyOf = task => task?.labelsKey || labelsFromId(task?.id);

  function getEffectiveType(subjectName, task, labelsKey) {
    const taskName = typeof task === 'string' ? task : task?.name;
    let actualLabelsKey = labelsKey;
    if (!actualLabelsKey && task && typeof task === 'object') {
      if (labelsKeyOf(task)) {
        actualLabelsKey = labelsKeyOf(task);
      } else if (task.row) {
        const labels = Array.from(task.row.querySelectorAll('.cvr-c-task__details .v-label'))
          .map(e => (e.textContent || '').replace(/\s+/g, ' ').trim())
          .filter(Boolean);
        if (labels.length) actualLabelsKey = labels.join('::');
      }
    }
    const saved = getSavedTaskType(subjectName, taskName, actualLabelsKey);
    if (saved) return saved;

    // Check if there is an active select dropdown in the DOM
    if (task && typeof task === 'object' && task.row) {
      const sel = task.row.querySelector('.connectify-type-select');
      if (sel && sel.value) return sel.value;
    }

    const labelsList = actualLabelsKey ? actualLabelsKey.split('::') : (task?.caption ? [task.caption] : []);
    return categorizeTask(taskName, labelsList, subjectName);
  }

  function getCategoryColor(cat) {
    const cats = getCategories();
    if (cats?.[cat]?.color) return cats[cat].color;
    if (defaultCategories[cat]?.color) return defaultCategories[cat].color;
    if (cat === UNKNOWN_TYPE) return UNKNOWN_COLOR;
    const palette = ['#1abc9c', '#e67e22', '#16a085', '#d35400', '#27ae60', '#8e44ad', '#2980b9', '#f39c12', '#9c27b0', '#009688'];
    let hash = 0;
    for (let i = 0; i < (cat || '').length; i++) hash = (hash << 5) - hash + cat.charCodeAt(i);
    return palette[Math.abs(hash) % palette.length];
  }

  window.ConnectifyTaskTypes = {
    UNKNOWN_TYPE,
    defaultCategories,
    getCategories,
    getOverrides: getTaskTypeOverrides,
    getSavedTaskType,
    saveTaskTypeOverride,
    getCustomCategoriesForClass,
    addCustomCategoryForClass,
    categorizeTask,
    getEffectiveType,
    labelsKeyOf,
    getCategoryColor,
    cleanSubject,
    invalidateTypesMemoryCache
  };
})();

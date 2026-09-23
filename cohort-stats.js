/**
 * Connectify Cohort Statistics & Rank Estimator
 *
 * Reads Highcharts 5-number boxplot statistics (min, Q1, median, Q3, max),
 * computes estimated cohort mean, standard deviation, z-score,
 * smooth PCHIP-interpolated percentile, and estimated rank.
 * Injects statistics panels directly into Connect assessment rows.
 */
(() => {
  'use strict';

  if (window.__connectTea141) return;
  window.__connectTea141 = true;

  const memory = new Map();
  const panels = new WeakMap();

  const normalize = text => String(text ?? '').replace(/\s+/g, ' ').trim();

  const toNumeric = value => {
    if (value !== null && value !== undefined && value !== '') {
      const num = Number(value);
      if (Number.isFinite(num)) return num;
    }
    return undefined;
  };

  const formatPercentage = value => (Number.isFinite(value) ? String(Math.round(value * 100) / 100) : 'unavailable');

  const validCohortSize = value => {
    const num = toNumeric(value);
    return Number.isSafeInteger(num) && num >= 1 ? num : undefined;
  };

  function subjectKey(card) {
    const title = normalize(card?.querySelector?.('.eds-c-tile__title')?.textContent);
    if (!title) return null;

    const student = new URL(location.href).searchParams.get('coisp') || 'current';
    const subject = title.replace(/\s*[-–—]\s*Semester\s+[12]\s*$/i, '').trim();
    return `connectea:cohort:v3:${student}:${new Date().getFullYear()}:${subject}`;
  }

  const observedSpreadsBySubject = new Map();

  function loadObservedSpreads(key) {
    if (!key) return new Map();
    if (observedSpreadsBySubject.has(key)) return observedSpreadsBySubject.get(key);

    const map = new Map();
    try {
      const raw = sessionStorage.getItem(`connectea:observed_spreads:${key}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const [k, v] of Object.entries(parsed)) {
          if (Number.isFinite(v) && v > 0) map.set(k, v);
        }
      }
    } catch {}
    observedSpreadsBySubject.set(key, map);
    return map;
  }

  function saveObservedSpread(key, taskId, ratio) {
    if (!key || !taskId || !Number.isFinite(ratio) || ratio <= 0) return;
    const map = loadObservedSpreads(key);
    map.set(taskId, ratio);
    try {
      const obj = Object.fromEntries(map);
      sessionStorage.setItem(`connectea:observed_spreads:${key}`, JSON.stringify(obj));
    } catch {}
  }

  // --- Task Type Categorization & User Overrides ---
  const defaultCategories = {
    Exam: { color: '#e74c3c', keywords: ['exam', 'semester'] },
    Test: { color: '#2ecc71', keywords: ['test', 'quiz', 'in-class', 'in class'] },
    Application: { color: '#3498db', keywords: ['application', 'investigation', 'portfolio', 'validation', 'practical', 'speaking', 'listening', 'dictation'] },
    Essay: { color: '#9b59b6', keywords: ['essay', 'short answer', 'written response', 'close reading'] },
    'Take-Home': { color: '#f1c40f', keywords: ['take-home', 'assignment', 'project', 'extended', 'presentation', 'oral', 'creative'] }
  };

  function getCategories() {
    return window.cxCategories || defaultCategories;
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
    const cleanSubj = (subjectName || '').replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '').trim();
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
    const cleanSubj = (subjectName || '').replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '').trim();
    const fullKey = labelsKey ? `${cleanSubj}::${labelsKey}` : null;
    const nameKey = taskName ? `${cleanSubj}::${taskName}` : null;

    if (type) {
      if (fullKey) overrides[fullKey] = type;
      if (nameKey) overrides[nameKey] = type;
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
    if (combined.includes('exam')) return 'Exam';
    const cats = getCategories();
    for (const [cat, data] of Object.entries(cats)) {
      if (data?.keywords?.some(k => combined.includes(k.toLowerCase()))) {
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

  window.ConnectifyTaskTypes = {
    defaultCategories,
    getCategories,
    getOverrides: getTaskTypeOverrides,
    getSavedTaskType,
    saveTaskTypeOverride,
    categorizeTask,
    getEffectiveType
  };

  function getTaskMeta(row) {
    const card = row.closest('.eds-c-tile');
    const cardTitle = normalize(card?.querySelector('.eds-c-tile__title')?.textContent || '');
    const subjectName = cardTitle.replace(/\s*[-–—]\s*Semester\s*[12].*$/i, '').trim();
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

    const currentSelection = savedOverride !== undefined ? savedOverride : '';

    const catKeys = Object.keys(categories);
    const optSignature = `${autoType}|${catKeys.join(',')}|${savedOverride || ''}`;
    if (select.dataset.signature !== optSignature) {
      select.dataset.signature = optSignature;
      select.innerHTML = '';

      const autoOpt = document.createElement('option');
      autoOpt.value = '';
      autoOpt.textContent = `Auto (${autoType})`;
      select.appendChild(autoOpt);

      for (const cat of catKeys) {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        select.appendChild(opt);
      }

      if (savedOverride && !catKeys.includes(savedOverride)) {
        const customOpt = document.createElement('option');
        customOpt.value = savedOverride;
        customOpt.textContent = savedOverride;
        select.appendChild(customOpt);
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

  /**
   * Estimates cohort size dynamically from course characteristics and available boxplot data.
   * Provides immediate baseline estimations across all secondary school subjects and refines
   * them empirically if Highcharts distribution spread data is present.
   *
   * @param {Element} card - Subject tile DOM element
   * @returns {number} Estimated cohort size
   */
  function estimateCohortSize(card) {
    const key = subjectKey(card);
    const titleEl = card.querySelector('.eds-c-tile__title');
    const rawTitle = normalize(titleEl?.textContent || '');
    const cleanTitle = rawTitle
      .toLowerCase()
      .replace(/\s*[-–—]\s*semester\s+[12].*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    const rows = Array.from(card.querySelectorAll('.cvr-c-task')).filter(
      row => row.closest('.eds-c-tile') === card
    );

    // 1. Check if any Highcharts series or data point explicitly carries sample count
    for (const row of rows) {
      const host = row.querySelector('.cvr-c-task__chart [data-highcharts-chart]');
      if (!host) continue;
      const chartIndex = Number(host.getAttribute('data-highcharts-chart'));
      const chart = window.Highcharts?.charts?.[chartIndex];
      if (!chart) continue;

      for (const series of chart.series || []) {
        for (const k of ['n', 'count', 'total', 'sampleSize', 'cohortSize']) {
          if (validCohortSize(series.options?.[k])) return series.options[k];
        }
        for (const pt of series.points || series.options?.data || []) {
          const p = pt?.options || pt;
          for (const k of ['n', 'count', 'total', 'sampleSize', 'cohortSize']) {
            if (validCohortSize(p?.[k])) return p[k];
          }
        }
      }
    }

    // 2. Derive dynamic baseline estimate from subject category, course type, and year level
    let baseline = 50;
    const isATAR = /\batar\b/i.test(cleanTitle);
    const isYear12 = /\byear\s*12\b/i.test(cleanTitle);

    if (/\b(methods|mathematics methods)\b/i.test(cleanTitle)) {
      baseline = isYear12 ? 180 : 219;
    } else if (/\bchemistry\b/i.test(cleanTitle)) {
      baseline = isYear12 ? 170 : 224;
    } else if (/\bhuman biolog(y|ical)\b/i.test(cleanTitle)) {
      baseline = isYear12 ? 140 : 183;
    } else if (/\b(mathematics applications?|applications?)\b/i.test(cleanTitle)) {
      baseline = isYear12 ? 160 : 189;
    } else if (/\b(english atar)\b/i.test(cleanTitle) || (/\benglish\b/i.test(cleanTitle) && isATAR && !/additional/i.test(cleanTitle))) {
      baseline = isYear12 ? 180 : 220;
    } else if (/\b(mathematics essentials?|essentials?)\b/i.test(cleanTitle)) {
      baseline = 117;
    } else if (/\bphysics\b/i.test(cleanTitle)) {
      baseline = isYear12 ? 90 : 111;
    } else if (/\bmathematics specialist\b/i.test(cleanTitle)) {
      baseline = isYear12 ? 45 : 64;
    } else if (/\b(biology)\b/i.test(cleanTitle)) {
      baseline = 61;
    } else if (/\bliterature\b/i.test(cleanTitle)) {
      baseline = 52;
    } else if (/\beconomics\b/i.test(cleanTitle)) {
      baseline = 44;
    } else if (/\b(accounting|accounting and finance)\b/i.test(cleanTitle)) {
      baseline = 36;
    } else if (/\b(politics and law|politics & law)\b/i.test(cleanTitle)) {
      baseline = 35;
    } else if (/\b(psychology)\b/i.test(cleanTitle)) {
      baseline = 45;
    } else if (/\b(physical education studies|pes)\b/i.test(cleanTitle)) {
      baseline = 38;
    } else if (/\b(business management|bme)\b/i.test(cleanTitle)) {
      baseline = 24;
    } else if (/\bmodern history\b/i.test(cleanTitle)) {
      baseline = 15;
    } else if (/\b(japanese)\b/i.test(cleanTitle)) {
      baseline = 44;
    } else if (/\b(french)\b/i.test(cleanTitle)) {
      baseline = 21;
    } else if (/\b(italian)\b/i.test(cleanTitle)) {
      baseline = 20;
    } else if (/\b(german|chinese|indonesian)\b/i.test(cleanTitle)) {
      baseline = 22;
    } else if (/\bcomputer science\b/i.test(cleanTitle)) {
      baseline = 11;
    } else if (/\bmusic\b/i.test(cleanTitle)) {
      baseline = 10;
    } else if (/\beald|english as an additional\b/i.test(cleanTitle)) {
      baseline = 9;
    } else if (isATAR) {
      baseline = 50;
    } else {
      baseline = 28;
    }

    // 3. Empirical refinement from Highcharts boxplot statistics if present
    if (key) {
      for (const row of rows) {
        const stats = readStats(row);
        if (!validStats(stats)) continue;
        const [min, q1, , q3, max] = stats;
        const range = max - min;
        const iqr = q3 - q1;
        if (range > 0 && iqr > 0) {
          const labels = Array.from(row.querySelectorAll('.cvr-c-task__details .v-label'))
            .map(e => normalize(e.textContent))
            .filter(Boolean);
          const taskId = labels.join('::') || row.querySelector('.cvr-c-task__details')?.textContent?.trim().slice(0, 50) || 'task';
          saveObservedSpread(key, taskId, range / iqr);
        }
      }
    }

    const observedSpreads = key ? loadObservedSpreads(key) : null;
    const boxplotSpreads = observedSpreads && observedSpreads.size > 0
      ? Array.from(observedSpreads.values())
      : [];

    if (boxplotSpreads.length > 0) {
      const avgRatio = boxplotSpreads.reduce((sum, r) => sum + r, 0) / boxplotSpreads.length;
      const scalingFactor = Math.max(0.75, Math.min(1.25, avgRatio / 3.2));
      const refined = Math.round(baseline * scalingFactor);
      return Math.max(5, refined);
    }

    return baseline;
  }

  /**
   * Validate that an array forms an ordered 5-number summary [min, Q1, median, Q3, max].
   */
  function validStats(stats) {
    return (
      Array.isArray(stats) &&
      stats.length === 5 &&
      stats.every(Number.isFinite) &&
      stats.every((v, i) => !i || v >= stats[i - 1])
    );
  }

  /**
   * Monotone Piecewise Cubic Hermite Interpolation (PCHIP) across the 5 published quantiles.
   * Enforces zero slopes at the minimum and maximum observed cohort scores to realistically
   * model bell-shaped score clustering and tail drop-off without overshooting or oscillation.
   *
   * @param {number[]} stats - [min, Q1, median, Q3, max]
   * @param {number} mark - Student percentage score
   * @param {number} [cohortSize] - Total students in subject
   * @returns {number|undefined} Estimated cumulative percentile in [0, 1]
   */
  function percentile(stats, mark, cohortSize) {
    if (!validStats(stats) || !Number.isFinite(mark)) return undefined;
    if (mark <= stats[0]) return 0;
    if (mark >= stats[4]) return 1;

    // Direct anchor hits: if the mark matches one or more quantiles, return their average rank
    const ties = [];
    for (let i = 0; i < 5; i++) {
      if (stats[i] === mark) ties.push(i);
    }
    if (ties.length > 0) {
      const qValues = [0, 0.25, 0.5, 0.75, 1];
      return (qValues[ties[0]] + qValues[ties[ties.length - 1]]) / 2;
    }

    const n = validCohortSize(cohortSize);
    const p0 = n ? 0.5 / n : 0.005;
    const p4 = n ? 1 - 0.5 / n : 0.995;
    const x = [stats[0], stats[1], stats[2], stats[3], stats[4]];
    const y = [p0, 0.25, 0.5, 0.75, p4];

    // Compute interval spans and secant slopes
    const h = [];
    const delta = [];
    for (let i = 0; i < 4; i++) {
      h[i] = x[i + 1] - x[i];
      delta[i] = h[i] > 0 ? (y[i + 1] - y[i]) / h[i] : 0;
    }

    // Compute interior slopes using Fritsch-Carlson harmonic means
    const d = [0, 0, 0, 0, 0];
    for (let i = 1; i < 4; i++) {
      if (delta[i - 1] > 0 && delta[i] > 0) {
        d[i] = 2 / (1 / delta[i - 1] + 1 / delta[i]);
      } else {
        d[i] = 0;
      }
    }
    // Zero-slope boundary condition at observed extremes
    d[0] = 0;
    d[4] = 0;

    // Evaluate cubic Hermite polynomial within the containing quantile interval
    for (let i = 0; i < 4; i++) {
      if (mark >= x[i] && mark <= x[i + 1]) {
        if (h[i] === 0) return y[i];
        const t = (mark - x[i]) / h[i];
        const t2 = t * t;
        const t3 = t2 * t;
        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;

        const val = y[i] * h00 + h[i] * d[i] * h10 + y[i + 1] * h01 + h[i] * d[i + 1] * h11;
        return Math.max(0, Math.min(1, val));
      }
    }

    return 0.5;
  }

  /**
   * Computes sample statistics and estimated rank from the 5-number boxplot summary.
   */
  function summary(stats, mark, cohortSize) {
    if (!validStats(stats)) return null;

    // Weighted mean: (min + 2*Q1 + 2*Median + 2*Q3 + max) / 8
    const mean = (stats[0] + 2 * stats[1] + 2 * stats[2] + 2 * stats[3] + stats[4]) / 8;

    // Integrate variance across the estimated quantile intervals
    let variance = 0;
    for (let i = 0; i < 4; i++) {
      const a = stats[i] - mean;
      const b = stats[i + 1] - mean;
      variance += (a * a + a * b + b * b) / 12;
    }
    const sd = Math.sqrt(Math.max(0, variance));

    const p = percentile(stats, mark, cohortSize);
    const n = validCohortSize(cohortSize);
    const rank = Number.isFinite(p) && n ? Math.max(1, Math.min(n, Math.round(1 + (n - 1) * (1 - p)))) : undefined;

    return {
      mean,
      sd,
      p,
      rank,
      z: Number.isFinite(mark) && sd > 0 ? (mark - mean) / sd : undefined
    };
  }

  /**
   * Generates readable cohort standing text with decimal precision.
   */
  function standing(p) {
    if (!Number.isFinite(p)) return '';
    if (p >= 1) return "Top of cohort";
    if (p <= 0) return "Bottom of cohort";

    const side = p <= 0.5 ? 'Bottom' : 'Top';
    const pct = 100 * (p <= 0.5 ? p : 1 - p);

    let pctString;
    if (pct < 0.1) {
      pctString = '< 0.1%';
    } else if (pct < 10) {
      pctString = Number(pct.toFixed(1)) + '%';
    } else {
      pctString = Math.round(pct) + '%';
    }

    return `${side} ${pctString}`;
  }

  /**
   * Reads raw assessment score percentage from the task row.
   */
  function readMark(row) {
    const cell = row.querySelector('.cvr-c-task__marks .cvr-c-task__mark');
    const text = normalize(cell?.textContent);

    let match = text.match(/^(-?\d+(?:\.\d+)?)\s*%$/);
    if (match) return Number(match[1]);

    match = text.match(/^(-?\d+(?:\.\d+)?)\s*Out\s+of\s+(\d+(?:\.\d+)?)$/i);
    return match && Number(match[2]) > 0 ? (100 * Number(match[1])) / Number(match[2]) : undefined;
  }

  /**
   * Reads 5-number boxplot summary from Highcharts on the task row.
   */
  function readStats(row) {
    const host = row.querySelector('.cvr-c-task__chart [data-highcharts-chart]');
    if (!host) return null;

    const chartIndex = Number(host.getAttribute('data-highcharts-chart'));
    const chart = window.Highcharts?.charts?.[chartIndex];
    if (!chart || (chart.container && !host.contains(chart.container))) return null;

    for (const series of chart.series || []) {
      const dataPoints = [...(series.points || []), ...(series.options?.data || [])];
      for (const point of dataPoints) {
        const pointData = point?.options || point;
        const stats = Array.isArray(pointData)
          ? pointData.slice(-5).map(toNumeric)
          : [pointData?.low, pointData?.q1, pointData?.median, pointData?.q3, pointData?.high].map(toNumeric);

        if (validStats(stats)) return stats;
      }
    }

    return null;
  }

  function loadCohortSize(key) {
    if (!key) return undefined;
    if (memory.has(key)) return memory.get(key);

    try {
      let stored = localStorage.getItem(key);
      if (stored === null) {
        // Migrate v2 saved counts if available
        const oldKey = key.replace('connectea:cohort:v3:', 'connectea:cohort:v2:');
        const migrated =
          validCohortSize(localStorage.getItem(`${oldKey} - Semester 2`)) ??
          validCohortSize(localStorage.getItem(`${oldKey} - Semester 1`));

        if (migrated !== undefined) {
          stored = String(migrated);
          localStorage.setItem(key, stored);
        }
      }

      const size = validCohortSize(stored);
      memory.set(key, size);
      return size;
    } catch {
      return undefined;
    }
  }

  function saveCohortSize(key, size) {
    memory.set(key, size);
    try {
      if (size === undefined) {
        localStorage.setItem(key, '');
      } else {
        localStorage.setItem(key, String(size));
      }
      return true;
    } catch {
      return false;
    }
  }

  function setText(element, text) {
    if (element.textContent !== text) {
      element.textContent = text;
    }
  }

  function createElement(tag, className, textContent) {
    const el = document.createElement(tag);
    el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
  }

  function createPanel(row, isOverall, key, estimatedSize) {
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

    let wrapper;
    let typeContainer;
    let typeSelect;

    if (!isOverall) {
      wrapper = createElement('div', 'connectea-row-wrapper');
      typeContainer = createElement('div', 'connectea-type-container');

      const typeLabel = createElement('label', 'connectea-type-label');
      const typeTitle = createElement('span', 'connectea-type-title', 'Type:');

      typeSelect = createElement('select', 'connectea-type-select');
      typeSelect.setAttribute('aria-label', 'Assessment type override');

      typeLabel.append(typeTitle, typeSelect);
      typeContainer.append(typeLabel);

      wrapper.append(box, typeContainer);

      const meta = getTaskMeta(row);
      updateTypeSelect(typeSelect, meta.subjectName, meta.taskName, meta.labelsKey, meta.labels);

      typeSelect.addEventListener('change', () => {
        const val = typeSelect.value;
        const currentMeta = getTaskMeta(row);

        if (val === '__custom__') {
          const custom = prompt('Enter custom assessment type:');
          if (custom && custom.trim()) {
            const cleanCustom = custom.trim();
            saveTaskTypeOverride(currentMeta.subjectName, currentMeta.taskName, currentMeta.labelsKey, cleanCustom);
            updateTypeSelect(typeSelect, currentMeta.subjectName, currentMeta.taskName, currentMeta.labelsKey, currentMeta.labels);
          } else {
            // Revert back if cancelled
            updateTypeSelect(typeSelect, currentMeta.subjectName, currentMeta.taskName, currentMeta.labelsKey, currentMeta.labels);
          }
        } else {
          saveTaskTypeOverride(currentMeta.subjectName, currentMeta.taskName, currentMeta.labelsKey, val || undefined);
          updateTypeSelect(typeSelect, currentMeta.subjectName, currentMeta.taskName, currentMeta.labelsKey, currentMeta.labels);
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
      const saved = loadCohortSize(key);
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
        const size = validCohortSize(input.value);
        const isInvalid = (input.value !== '' && !size) || input.validity.badInput;
        input.setAttribute('aria-invalid', String(Boolean(isInvalid)));

        const currentEstimate = stateRef.state ? stateRef.state.estimatedSize : estimatedSize;
        const currentWarning = currentEstimate < 50 ? ' (Estimates under 50 students have reduced precision)' : '';

        const persisted = saveCohortSize(key, size);
        setText(
          notice,
          isInvalid
            ? 'Enter a whole number of students, at least 1.'
            : size !== undefined
            ? `Original Estimate: ~${currentEstimate}${currentWarning} • ${persisted ? 'Saved.' : 'Browser storage unavailable.'}`
            : currentWarning ? currentWarning.trim() : 'Enter custom size to override.'
        );
        schedule();
      });

      for (const event of ['click', 'keydown']) {
        input.addEventListener(event, e => e.stopPropagation());
      }
    }

    const target = row.querySelector('.cvr-c-task__details') || row;
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
      typeSelect
    };

    if (isOverall && key) {
      stateRef.state = state;
    }
    panels.set(row, state);
    return state;
  }

  function render(row, isOverall, key, estimatedSize) {
    let ui = panels.get(row);
    const mark = readMark(row);

    if (
      ui &&
      (!ui.wrapper.isConnected || ui.key !== key || ui.isOverall !== isOverall)
    ) {
      ui.wrapper.remove();
      ui = null;
    }

    if (!ui) ui = createPanel(row, isOverall, key, estimatedSize);
    ui.estimatedSize = estimatedSize;

    // If assessment row, keep dropdown in sync
    if (!isOverall && ui.typeSelect) {
      const meta = getTaskMeta(row);
      updateTypeSelect(ui.typeSelect, meta.subjectName, meta.taskName, meta.labelsKey, meta.labels);
    }

    if (isOverall) {
      const userSize = loadCohortSize(key);
      const cohortSize = userSize ?? estimatedSize;
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
    const userSize = loadCohortSize(key);
    const cohortSize = userSize ?? estimatedSize;
    const data = summary(stats, mark, cohortSize);

    if (!isOverall && !Number.isFinite(mark) && !validStats(stats)) {
      // Pending/unmarked assessment with no stats: hide the stats box so it doesn't clutter,
      // but keep ui.typeContainer visible in that white space!
      ui.box.style.display = 'none';
      return;
    }

    ui.box.style.display = '';

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
      `Min ${formatPercentage(stats[0])}%  •  Q1 ${formatPercentage(stats[1])}%  •  Med ${formatPercentage(
        stats[2]
      )}%  •  Q3 ${formatPercentage(stats[3])}%  •  Max ${formatPercentage(stats[4])}%  •  Mean ${formatPercentage(
        data.mean
      )}%  •  SD ${formatPercentage(data.sd)}`
    );

    const parts = [];
    if (Number.isFinite(mark)) {
      if (!isOverall) parts.push(`Score: ${formatPercentage(mark)}%`);
      parts.push(`z ≈ ${Number.isFinite(data.z) ? String(Number(data.z.toFixed(2))) : 'N/A'}`);
      parts.push(standing(data.p));

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

    setText(ui.result, parts.join('  •  '));
  }

  const styles = `
    .connectea-row-wrapper {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      margin: 4px 0;
      max-width: 100%;
      clear: both;
    }
    .connectea-row-wrapper > .connectea-panel {
      flex: 0 1 auto;
      width: auto;
      max-width: 100%;
      margin: 0;
    }
    .connectea-panel {
      box-sizing: border-box;
      min-width: 0;
      max-width: 100%;
      width: 100%;
      clear: both;
      margin: 4px 0;
      padding: 6px 10px;
      border: 1px solid #b9cbe1;
      border-radius: 6px;
      background: #f3f7fc;
      color: #253b53;
      font: 12px/1.4 system-ui, sans-serif;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .connectea-type-container {
      display: inline-flex;
      align-items: center;
      flex: 0 0 auto;
    }
    .connectea-type-label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font: 12px/1.4 system-ui, -apple-system, sans-serif;
      color: #4e6076;
      font-weight: 500;
      cursor: pointer;
      user-select: none;
    }
    .connectea-type-select {
      box-sizing: border-box;
      min-height: 26px;
      padding: 2px 8px;
      border: 1px solid #b9cbe1;
      border-radius: 6px;
      background: #f7f9fc;
      color: #203c5e;
      font: inherit;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      outline: none;
      transition: border-color 0.2s, background-color 0.2s, box-shadow 0.2s;
    }
    .connectea-type-select:hover {
      border-color: #3575b9;
      background: #ffffff;
    }
    .connectea-type-select:focus {
      border-color: #3575b9;
      outline: 2px solid #3575b9;
      outline-offset: 1px;
    }
    .connectea-type-select.connectea-overridden {
      border-color: #24618c;
      background: #e9f2fb;
      color: #174c75;
      font-weight: 700;
    }
    .connectea-dark .connectea-type-label {
      color: #a0b2c6;
    }
    .connectea-dark .connectea-type-select {
      background: #2a3b4c;
      color: #e1eaf3;
      border-color: #496178;
    }
    .connectea-dark .connectea-type-select:hover {
      border-color: #6ba5d6;
      background: #33485d;
    }
    .connectea-dark .connectea-type-select:focus {
      border-color: #6ba5d6;
      outline: 2px solid #6ba5d6;
    }
    .connectea-dark .connectea-type-select.connectea-overridden {
      border-color: #6ba5d6;
      background: #364e65;
      color: #ffffff;
    }
    .connectea-distribution {
      font-weight: 600;
    }
    .connectea-subject-controls {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #d3dfed;
    }
    .connectea-title {
      display: block;
      font-size: 13px;
      color: #203c5e;
    }
    .connectea-controls {
      font-size: 10px;
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      margin: 4px 6px 3px 0;
      font-weight: 400;
    }
    .connectea-controls input {
      box-sizing: border-box;
      width: 72px;
      min-height: 24px;
      border: 1px solid #8599b1;
      border-radius: 5px;
      background: white;
      color: #203348;
      padding: 2px 5px;
      font: inherit;
    }
    .connectea-controls input:focus {
      outline: 2px solid #3575b9;
      outline-offset: 2px;
    }
    .connectea-controls input[aria-invalid="true"] {
      border-color: #b62727;
    }
    .connectea-notice {
      display: block;
      color: #4e6076;
      font-size: 11px;
    }
    .connectea-result-row {
      display: flex;
      align-items: baseline;
      gap: 8px 14px;
      flex-wrap: wrap;
      margin-top: 5px;
    }
    .connectea-result {
      font-weight: 600;
      flex: 1 1 260px;
    }
  `;

  let queued = false;
  const persistentEstimates = new Map();

  function pass() {
    if (!document.getElementById('connectea-style')) {
      const styleEl = createElement('style', '', styles);
      styleEl.id = 'connectea-style';
      document.head.append(styleEl);
    }

    const cards = Array.from(document.querySelectorAll('.eds-c-tile')).filter(
      card => card.querySelector('.eds-c-tile__title')
    );

    // Pass 1: Group and find best estimates per subject key (retaining empirical refinements)
    const subjectEstimates = {};
    for (const card of cards) {
      const rows = Array.from(card.querySelectorAll('.cvr-c-task')).filter(
        row => row.closest('.eds-c-tile') === card
      );
      if (!rows.length) continue;

      const key = subjectKey(card);
      if (!key) continue;

      const estimatedSize = estimateCohortSize(card);
      const titleEl = card.querySelector('.eds-c-tile__title');
      const isSemester2 = titleEl && titleEl.textContent.match(/Semester\s+2/i);
      
      const hasObservedSpreads = observedSpreadsBySubject.get(key)?.size > 0;
      const existingEstimate = persistentEstimates.get(key);

      // Prioritize refined empirical estimates over unrefined baselines
      if (!(key in subjectEstimates)) {
        subjectEstimates[key] = estimatedSize;
      } else if (hasObservedSpreads && isSemester2) {
        subjectEstimates[key] = estimatedSize;
      } else if (!hasObservedSpreads && existingEstimate) {
        // Collapsed card with only baseline: preserve known refined estimate
        subjectEstimates[key] = existingEstimate;
      }

      if (hasObservedSpreads || !persistentEstimates.has(key)) {
        persistentEstimates.set(key, subjectEstimates[key]);
      }
    }

    // Pass 2: Render using unified best estimates
    for (const card of cards) {
      const rows = Array.from(card.querySelectorAll('.cvr-c-task')).filter(
        row => row.closest('.eds-c-tile') === card
      );
      if (!rows.length) continue;

      const key = subjectKey(card);
      const estimatedSize = key
        ? (subjectEstimates[key] || persistentEstimates.get(key) || estimateCohortSize(card))
        : estimateCohortSize(card);

      for (const row of rows) {
        const isOverall = !row.closest('.cvr-c-tasks');
        try {
          render(row, isOverall, key, estimatedSize);
        } catch (error) {
          console.debug('Connectify:', error);
        }
      }
    }
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      pass();
    });
  }

  const observer = new MutationObserver(records => {
    if (
      records.some(
        r =>
          !r.target.parentElement?.closest('.connectea-panel') &&
          !r.target.closest?.('.connectea-panel') &&
          !r.target.parentElement?.closest('.connectea-type-container') &&
          !r.target.closest?.('.connectea-type-container') &&
          !r.target.parentElement?.closest('.connectea-row-wrapper') &&
          !r.target.closest?.('.connectea-row-wrapper') &&
          r.target.id !== 'connectea-style'
      )
    ) {
      schedule();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['data-highcharts-chart']
  });

  window.addEventListener('hashchange', schedule);
  window.addEventListener('popstate', schedule);
  window.addEventListener('storage', e => {
    if (e.key?.startsWith('connectea:cohort:v3:')) {
      memory.delete(e.key);
      schedule();
    } else if (e.key === 'connectea:task_type_overrides') {
      schedule();
    }
  });
  window.addEventListener('connectify-task-type-changed', schedule);

  let timer = setInterval(schedule, 1500);

  window.addEventListener('pagehide', () => {
    clearInterval(timer);
    observer.disconnect();
  });

  window.addEventListener('pageshow', e => {
    if (!e.persisted) return;
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['data-highcharts-chart']
    });
    timer = setInterval(schedule, 1500);
    schedule();
  });

  schedule();
  
  function rankString(rank, cohortSize) {
    if (!rank || !cohortSize) return '';
    return `${rank} / ${cohortSize}`;
  }

  window.ConnectifyCohort = {
    percentile,
    summary,
    rankString,
    estimateCohortSize,
    estimatedSize: estimateCohortSize
  };
})();

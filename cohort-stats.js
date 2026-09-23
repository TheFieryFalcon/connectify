/**
 * Connectify Cohort Statistics & Rank Estimator (View & Controller)
 *
 * Reads 5-number boxplot statistics, computes dynamic empirical cohort size estimates,
 * and injects responsive statistics panels and assessment type controls directly
 * into Connect assessment rows.
 */
(() => {
  'use strict';

  if (window.__connectTea141) return;
  window.__connectTea141 = true;

  const memory = new Map();
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
   * Reads 5-number boxplot summary from DOM bridge or Highcharts on the task row.
   */
  function readStats(row) {
    const host = row.querySelector('.cvr-c-task__chart [data-highcharts-chart]');
    if (!host) return null;

    // Check shared DOM dataset bridge first (fast & cross-world compatible)
    if (host.dataset.connectifyStats) {
      try {
        const stats = JSON.parse(host.dataset.connectifyStats);
        if (math().validStats(stats)) return stats;
      } catch {}
    }

    // Direct Highcharts instance check if available
    const chartIndex = Number(host.getAttribute('data-highcharts-chart'));
    const chart = window.Highcharts?.charts?.[chartIndex];
    if (chart && (!chart.container || host.contains(chart.container))) {
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

  /**
   * Estimates cohort size dynamically from course characteristics and available boxplot data.
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
      if (host?.dataset.connectifyN) {
        const n = math().validCohortSize(host.dataset.connectifyN);
        if (n) return n;
      }

      if (host) {
        const chartIndex = Number(host.getAttribute('data-highcharts-chart'));
        const chart = window.Highcharts?.charts?.[chartIndex];
        if (chart) {
          for (const series of chart.series || []) {
            for (const k of ['n', 'count', 'total', 'sampleSize', 'cohortSize']) {
              if (math().validCohortSize(series.options?.[k])) return series.options[k];
            }
            for (const pt of series.points || series.options?.data || []) {
              const p = pt?.options || pt;
              for (const k of ['n', 'count', 'total', 'sampleSize', 'cohortSize']) {
                if (math().validCohortSize(p?.[k])) return p[k];
              }
            }
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
    } else if (/\benglish atar\b/i.test(cleanTitle) || (/\benglish\b/i.test(cleanTitle) && isATAR && !/\badditional\b/i.test(cleanTitle))) {
      baseline = isYear12 ? 180 : 220;
    } else if (/\b(mathematics essentials?|essentials?)\b/i.test(cleanTitle)) {
      baseline = 117;
    } else if (/\bphysics\b/i.test(cleanTitle)) {
      baseline = isYear12 ? 90 : 111;
    } else if (/\bmathematics specialist\b/i.test(cleanTitle)) {
      baseline = isYear12 ? 45 : 64;
    } else if (/\bbiology\b/i.test(cleanTitle)) {
      baseline = 61;
    } else if (/\bliterature\b/i.test(cleanTitle)) {
      baseline = 52;
    } else if (/\beconomics\b/i.test(cleanTitle)) {
      baseline = 44;
    } else if (/\b(accounting|accounting and finance)\b/i.test(cleanTitle)) {
      baseline = 36;
    } else if (/\b(politics and law|politics & law)\b/i.test(cleanTitle)) {
      baseline = 35;
    } else if (/\bpsychology\b/i.test(cleanTitle)) {
      baseline = 45;
    } else if (/\b(physical education studies|pes)\b/i.test(cleanTitle)) {
      baseline = 38;
    } else if (/\b(business management|bme)\b/i.test(cleanTitle)) {
      baseline = 24;
    } else if (/\bmodern history\b/i.test(cleanTitle)) {
      baseline = 15;
    } else if (/\bjapanese\b/i.test(cleanTitle)) {
      baseline = 44;
    } else if (/\bfrench\b/i.test(cleanTitle)) {
      baseline = 21;
    } else if (/\bitalian\b/i.test(cleanTitle)) {
      baseline = 20;
    } else if (/\b(german|chinese|indonesian)\b/i.test(cleanTitle)) {
      baseline = 22;
    } else if (/\bcomputer science\b/i.test(cleanTitle)) {
      baseline = 11;
    } else if (/\bmusic\b/i.test(cleanTitle)) {
      baseline = 10;
    } else if (/\b(eald|english as an additional)\b/i.test(cleanTitle)) {
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
        if (!math().validStats(stats)) continue;
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

  function loadCohortSize(key) {
    if (!key) return undefined;
    if (memory.has(key)) return memory.get(key);

    try {
      let stored = localStorage.getItem(key);
      if (stored === null) {
        const oldKey = key.replace('connectea:cohort:v3:', 'connectea:cohort:v2:');
        const migrated =
          math().validCohortSize(localStorage.getItem(`${oldKey} - Semester 2`)) ??
          math().validCohortSize(localStorage.getItem(`${oldKey} - Semester 1`));

        if (migrated !== undefined) {
          stored = String(migrated);
          localStorage.setItem(key, stored);
        }
      }

      const size = math().validCohortSize(stored);
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

    const isMarked = Number.isFinite(readMark(row));
    if (!isOverall && !isMarked) {
      box.hidden = true;
      box.classList.add('connectea-hidden');
      box.style.setProperty('display', 'none', 'important');
    }

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
        const size = math().validCohortSize(input.value);
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
      const meta = types().getTaskMeta(row);
      types().updateTypeSelect(ui.typeSelect, meta.subjectName, meta.taskName, meta.labelsKey, meta.labels);
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
    const data = math().summary(stats, mark, cohortSize);

    const isIncomplete = !isOverall && !Number.isFinite(mark);
    if (isIncomplete) {
      ui.box.hidden = true;
      ui.box.classList.add('connectea-hidden');
      ui.box.style.setProperty('display', 'none', 'important');
      if (ui.typeContainer) ui.typeContainer.style.setProperty('display', 'inline-flex', 'important');
      if (ui.wrapper) ui.wrapper.style.setProperty('display', 'flex', 'important');
      return;
    }

    ui.box.hidden = false;
    ui.box.classList.remove('connectea-hidden');
    ui.box.style.setProperty('display', 'block', 'important');
    if (ui.typeContainer) ui.typeContainer.style.setProperty('display', 'inline-flex', 'important');
    if (ui.wrapper) ui.wrapper.style.setProperty('display', 'flex', 'important');

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

  const styles = `
    .cvr-c-task__details {
      overflow: visible !important;
    }
    .connectea-row-wrapper {
      display: flex !important;
      align-items: center !important;
      gap: 14px !important;
      flex-wrap: nowrap !important;
      margin: 4px 0 !important;
      max-width: 100% !important;
      clear: both !important;
      overflow: visible !important;
    }
    .connectea-row-wrapper > .connectea-panel {
      flex: 0 0 auto !important;
      width: auto !important;
      max-width: fit-content !important;
      margin: 0 !important;
    }
    .connectea-panel {
      box-sizing: border-box !important;
      display: block !important;
      min-width: 0 !important;
      max-width: 100% !important;
      width: 100% !important;
      clear: both !important;
      margin: 8px 0 !important;
      padding: 10px 14px !important;
      border: 1px solid #b9cbe1 !important;
      border-radius: 8px !important;
      background: #f3f7fc !important;
      color: #253b53 !important;
      font: 12px/1.5 system-ui, -apple-system, sans-serif !important;
      white-space: normal !important;
      overflow-wrap: anywhere !important;
    }
    .connectea-panel[hidden],
    .connectea-panel.connectea-hidden {
      display: none !important;
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
      display: block !important;
      width: 100% !important;
      font-weight: 600 !important;
      margin-bottom: 6px !important;
      line-height: 1.5 !important;
      clear: both !important;
    }
    .connectea-subject-controls {
      display: block !important;
      width: 100% !important;
      margin-top: 10px !important;
      padding-top: 8px !important;
      border-top: 1px solid #d3dfed !important;
      clear: both !important;
    }
    .connectea-title {
      display: block;
      font-size: 13px;
      color: #203c5e;
    }
    .connectea-controls {
      font-size: 11px !important;
      display: inline-flex !important;
      align-items: center !important;
      flex-wrap: wrap !important;
      gap: 6px !important;
      margin: 4px 6px 3px 0 !important;
      font-weight: 500 !important;
    }
    .connectea-controls input {
      box-sizing: border-box;
      width: 76px;
      min-height: 24px;
      border: 1px solid #8599b1;
      border-radius: 5px;
      background: white;
      color: #203348;
      padding: 2px 6px;
      font: inherit;
    }
    .connectea-controls input:focus {
      outline: 2px solid #3575b9;
      outline-offset: 2px;
    }
    .connectea-controls input[aria-invalid=true] {
      border-color: #b62727;
    }
    .connectea-notice {
      display: block !important;
      color: #4e6076 !important;
      font-size: 11px !important;
      margin-top: 3px !important;
    }
    .connectea-result-row {
      display: flex !important;
      align-items: baseline !important;
      gap: 8px 14px !important;
      flex-wrap: wrap !important;
      width: 100% !important;
      margin-top: 6px !important;
      margin-bottom: 6px !important;
      clear: both !important;
    }
    .connectea-result {
      font-weight: 600 !important;
      line-height: 1.5 !important;
      flex: 1 1 260px !important;
    }
    .connectea-dark .connectea-panel {
      background: #333333 !important;
      color: #cccccc !important;
      border-color: #3a3a3a !important;
    }
    .connectea-dark .connectea-subject-controls {
      border-top-color: #3a3a3a !important;
    }
    .connectea-dark .connectea-notice {
      color: #999999 !important;
    }
    .connectea-dark .connectea-controls input {
      background: #212121 !important;
      color: #dddddd !important;
      border-color: #4a4a4a !important;
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

      if (!(key in subjectEstimates)) {
        subjectEstimates[key] = estimatedSize;
      } else if (hasObservedSpreads && isSemester2) {
        subjectEstimates[key] = estimatedSize;
      } else if (!hasObservedSpreads && existingEstimate) {
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
    attributeFilter: ['data-highcharts-chart', 'data-connectify-stats']
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
      attributeFilter: ['data-highcharts-chart', 'data-connectify-stats']
    });
    timer = setInterval(schedule, 1500);
    schedule();
  });

  schedule();
  
  window.ConnectifyCohort = {
    percentile: (...args) => math().percentile(...args),
    summary: (...args) => math().summary(...args),
    rankString: (...args) => math().rankString(...args),
    estimateCohortSize,
    estimatedSize: estimateCohortSize,
    pass,
    schedule
  };
})();
